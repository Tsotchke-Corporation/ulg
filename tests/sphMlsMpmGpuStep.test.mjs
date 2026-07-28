import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  ULG_MLS_MPM_GPU_G2P_RECONSTRUCTION_SCHEMA,
  ULG_MLS_MPM_GPU_GRID_PROJECTION_SCHEMA,
  ULG_MLS_MPM_GPU_GRID_UPDATE_SCHEMA,
  MLS_MPM_GPU_PARTICLE_MECHANICS_ROW_LAYOUT,
  ULG_MLS_MPM_GPU_PARTICLE_BUFFER_SCHEMA,
  ULG_MLS_MPM_GPU_RESIDENT_SUMMARY_SCHEMA,
  ULG_SPH_GPU_REACTION_STEP_SCHEMA,
  ULG_SPH_GPU_REACTION_ATOM_RESIDUAL_SCHEMA,
  ULG_SPH_GPU_REACTION_GAS_SPECIES_SUMMARY_SCHEMA,
  ULG_SPH_GPU_REACTION_PRODUCT_PLACEMENT_SUMMARY_SCHEMA,
  ULG_SPH_GPU_REACTION_SUMMARY_SCHEMA,
  ULG_SPH_PRESSURE_INTERFACE_FORCE_SOLVER_SCHEMA,
  ULG_SPH_GPU_THERMAL_RESPONSE_GRAPH_BUFFER_SET_SCHEMA,
  ULG_SPH_GPU_THERMAL_STEP_SCHEMA,
  ULG_SPH_GPU_PARTICLE_BUFFER_SCHEMA,
  ULG_SPH_GPU_PARTICLE_IDENTITY_BUFFER_SCHEMA,
  SPH_PRESSURE_INTERFACE_FORCE_ROW_LAYOUT,
  SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_MAGIC,
  SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX,
  SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_STATUS,
  SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_VERSION,
  SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_WORDS,
  SCHROEDER_ACTIVE_NODE_ROW_LAYOUT,
  SCHROEDER_FAR_AGGREGATE_FORCE_APPLICATION_ROW_LAYOUT,
  SCHROEDER_FAR_AGGREGATE_GAS_CELL_IMPORT_ROW_LAYOUT,
  SCHROEDER_FAR_AGGREGATE_GAS_STATE_DELTA_ROW_LAYOUT,
  SCHROEDER_LEVEL_ASSIGNMENT_ROW_LAYOUT,
  SCHROEDER_SPATIAL_MECHANICS_FIELD_STATE_ENCODING_MASS_MOMENTUM_GRADIENT,
  SCHROEDER_SPATIAL_MECHANICS_FIELD_STATE_ENCODING_MASS_VELOCITY_GRADIENT,
  SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_RECEIPT_WORDS,
  SCHROEDER_SPATIAL_SOURCE_ADAPTER_EXACT_NEAR_QUERY,
  ULG_SCHROEDER_ACTIVE_NODE_LIST_EXECUTION_SCHEMA,
  ULG_SCHROEDER_FAR_AGGREGATE_FORCE_APPLICATION_EXECUTION_SCHEMA,
  ULG_SCHROEDER_FAR_AGGREGATE_GAS_CELL_IMPORT_EXECUTION_SCHEMA,
  ULG_SCHROEDER_FAR_AGGREGATE_GAS_STATE_DELTA_EXECUTION_SCHEMA,
  ULG_SCHROEDER_LEVEL_ASSIGNMENT_EXECUTION_SCHEMA,
  ULG_SCHROEDER_PARTICLE_STORAGE_MATERIALIZATION_EXECUTION_SCHEMA,
  ULG_SCHROEDER_SPATIAL_EXACT_NEAR_VIEW_SCHEMA
} from '../ulg-gpu-abi/src/index.js';
import {
  ULG_MLS_MPM_RESIDENT_COMPUTE_TASK_SCHEMA,
  ULG_MLS_MPM_RESIDENT_COMPUTE_TASK_RESULT_SCHEMA,
  ULG_MLS_MPM_RESIDENT_STEPS_COMPUTE_TASK_SCHEMA,
  ULG_MLS_MPM_RESIDENT_STEPS_COMPUTE_TASK_RESULT_SCHEMA,
  ULG_MLS_MPM_RESIDENT_STEPS_COMMIT_DELTA_SCHEMA,
  ULG_MLS_MPM_RESIDENT_STEPS_STATE_DELTA_SCHEMA,
  ULG_MLS_MPM_RESIDENT_STEPS_SOLVER_TASK_BRIDGE_SCHEMA,
  ULG_SCHROEDER_ADOPTED_PARTICLE_STORAGE_DESCRIPTOR_SCHEMA,
  ULG_SCHROEDER_ADOPTED_PARTICLE_STORAGE_CONTINUATION_SCHEDULE_SCHEMA,
  ULG_SCHROEDER_ADOPTED_PARTICLE_STORAGE_LOCAL_RESOLVER_SCHEMA,
  ULG_MLS_MPM_WEBGPU_OCEAN_HOT_LOOP_BUDGET_SCHEMA,
  ULG_SPH_PRESSURE_INTERFACE_STAGE_COMPUTE_TASK_SCHEMA,
  ULG_SPH_PRESSURE_INTERFACE_STAGE_COMPUTE_TASK_RESULT_SCHEMA,
  ULG_SPH_REACTION_PRODUCT_STAGE_COMPUTE_TASK_SCHEMA,
  ULG_SPH_REACTION_PRODUCT_STAGE_COMPUTE_TASK_RESULT_SCHEMA,
  ULG_SPH_THERMAL_PHASE_STAGE_COMPUTE_TASK_SCHEMA,
  ULG_SPH_THERMAL_PHASE_STAGE_COMPUTE_TASK_RESULT_SCHEMA,
  ULG_MLS_MPM_MECHANICS_GRID_UPDATE_STAGE_COMPUTE_TASK_SCHEMA,
  ULG_MLS_MPM_MECHANICS_GRID_UPDATE_STAGE_COMPUTE_TASK_RESULT_SCHEMA,
  ULG_MLS_MPM_GPU_RESIDENT_STEP_EXECUTION_SCHEMA,
  ULG_MLS_MPM_GPU_RESIDENT_STEP_SCHEMA,
  ULG_MLS_MPM_GPU_RESIDENT_STEPS_EXECUTION_SCHEMA,
  SCHROEDER_FAR_AGGREGATE_GAS_CELL_IMPORT_FLOATS,
  ULG_SCHROEDER_FAR_FORCE_DELTA_FUSION_EXECUTION_SCHEMA,
  createSchroederFarForceDeltaFusionParamsArray,
  ULG_SPH_SPATIAL_GAS_LEDGER_PRODUCER_STAGE_COMPUTE_TASK_SCHEMA,
  ULG_SPH_SPATIAL_GAS_LEDGER_PRODUCER_STAGE_COMPUTE_TASK_RESULT_SCHEMA,
  ULG_SPH_SPATIAL_GAS_SPECIES_LEDGER_SCHEMA,
  ULG_SPH_RETAINED_SPATIAL_GAS_LEDGER_SOURCE_SCHEMA,
  SPH_SPATIAL_GAS_LEDGER_COMPACT_ROW_FLOATS,
  ULG_SPH_GAS_CELL_EOS_PRODUCER_STAGE_COMPUTE_TASK_SCHEMA,
  ULG_SPH_GAS_CELL_EOS_PRODUCER_STAGE_COMPUTE_TASK_RESULT_SCHEMA,
  ULG_PRESSURE_INTERFACE_GAS_CELL_FIELD_ADMISSION_SCHEMA,
  ULG_PRESSURE_INTERFACE_GAS_CELL_FIELD_IMPORT_SCHEMA,
  ULG_PRESSURE_INTERFACE_RETAINED_GAS_CELL_FIELD_SOURCE_SCHEMA,
  ULG_SPH_PRESSURE_INTERFACE_SOURCE_KEY_REPLAY_DESCRIPTOR_SCHEMA,
  createSphThermalPhaseStageComputeTask,
  createSphSpatialGasLedgerProducerStageComputeTask,
  createSphGasCellEosProducerStageComputeTask,
  createSphPressureInterfaceStageComputeTask,
  createMlsMpmMechanicsGridUpdateStageComputeTask,
  createMlsMpmResidentStepComputeTask,
  createMlsMpmResidentStepsComputeTask,
  createMlsMpmResidentStepGpuFenceReport,
  compactResidentProductEventBufferWebGpu,
  mergeResidentProductMassBuffersWebGpu,
  destroyMlsMpmResidentStepBuffers,
  destroyMlsMpmResidentStepsBuffers,
  destroyReactionOutputAfterFailedMechanicsRefresh,
  FUSED_SINGLE_LEVEL_MECHANICS_FIELD_G2P_RECEIPT_ENTRY_POINTS,
  MLS_MPM_MECHANICS_FIELD_CONTACT_POLICY,
  SCHROEDER_MECHANICAL_DEFERRED_DISPATCH_COUNT,
  SCHROEDER_MECHANICAL_DEFERRED_ENTRY_POINTS,
  mlsMpmP2gGridProjectionCanonicalSpatialMechanicsFieldWgsl,
  mlsMpmP2gGridProjectionCanonicalSpatialSingleLevelMechanicsFieldWgsl,
  mlsMpmP2gGridProjectionCanonicalSpatialUnobservedMechanicsFieldWgsl,
  mlsMpmP2gGridProjectionCanonicalSpatialUnobservedSingleLevelMechanicsFieldWgsl,
  mlsMpmP2gGridProjectionCanonicalSpatialActiveSourceV2SingleLevelMechanicsFieldWgsl,
  mlsMpmP2gGridProjectionCanonicalSpatialUnobservedActiveSourceV2SingleLevelMechanicsFieldWgsl,
  mlsMpmG2pReconstructCanonicalSpatialMechanicsFieldWgsl,
  mlsMpmG2pReconstructCanonicalSpatialSingleLevelMechanicsFieldWgsl,
  mlsMpmG2pReconstructCanonicalSpatialUnobservedMechanicsFieldWgsl,
  mlsMpmG2pReconstructCanonicalSpatialUnobservedSingleLevelMechanicsFieldWgsl,
  mlsMpmG2pReconstructCanonicalSpatialActiveSourceV2MechanicsFieldWgsl,
  mlsMpmG2pReconstructCanonicalSpatialUnobservedActiveSourceV2MechanicsFieldWgsl,
  mlsMpmG2pReconstructCanonicalSpatialActiveSourceV2SingleLevelMechanicsFieldWgsl,
  mlsMpmG2pReconstructCanonicalSpatialUnobservedActiveSourceV2SingleLevelMechanicsFieldWgsl,
  mlsMpmMechanicsFieldGridUpdateWgsl,
  classifyMlsMpmMechanicsFieldContactPair,
  reactionOutputComponentMutations,
  reactionOutputMutatesParticles,
  resolveFusedSchroederMechanicsLevelView,
  runSphThermalPhaseStageComputeTask,
  runSphSpatialGasLedgerProducerStageComputeTask,
  runSphGasCellEosProducerStageComputeTask,
  scheduleSphGasCellEosFinalConsumerRelease,
  runSphPressureInterfaceStageComputeTask,
  runMlsMpmMechanicsGridUpdateStageComputeTask,
  runMlsMpmResidentStepComputeTask,
  runMlsMpmResidentStepsComputeTask,
  runMlsMpmResidentStepsWithOptionalWebGpu,
  runMlsMpmResidentStepWithOptionalWebGpu,
  runSchroederFarForceDeltaFusionWebGpu,
  createSphReactionProductStageComputeTask,
  runSphReactionProductStageComputeTask,
  runMlsMpmMechanicsOnlyResidentStepWithComputeManagerStageTasks,
  runMlsMpmMechanicsP2gStageComputeTask,
  runMlsMpmMechanicsG2pStageComputeTask,
  submitMlsMpmResidentStepComputeTask,
  submitMlsMpmResidentStepsComputeTask,
  summarizeGpuTimestampRecorderQueueStages,
  summarizeMlsMpmResidentHotLoopBudget
} from '../src/runtime/sph/sphMlsMpmGpuStep.js';
import {
  schroederSpatialPhaseVolumeTransportWgsl
} from '../ulg-gpu-abi/src/schroederSpatialPhaseVolumeTransportWgsl.js';
import {
  MLS_MPM_P2G_BACKEND_OCEAN_TILED_EXPERIMENTAL,
  MLS_MPM_P2G_BACKEND_RESIDENT_SCATTER,
  ULG_MLS_MPM_P2G_BACKEND_POLICY_SCHEMA,
  createMlsMpmGridSpec,
  projectMlsMpmP2gGridCpu
} from '../src/runtime/sph/sphGridGpuKernel.js';
import {
  runMlsMpmGridUpdateWithOptionalWebGpu,
  updateMlsMpmGridCpu
} from '../src/runtime/sph/sphGridUpdateGpuKernel.js';
import { reconstructMlsMpmG2pCpu } from '../src/runtime/sph/sphG2pGpuKernel.js';
import {
  MLS_MPM_GPU_RESIDENT_SUMMARY_FLOATS,
  runMlsMpmResidentSummaryWebGpu
} from '../src/runtime/sph/sphMlsMpmGpuSummary.js';
import {
  SPH_GPU_REACTION_PRODUCT_PLACEMENT_SUMMARY_FLOATS,
  ULG_SPH_RESIDENT_PRODUCT_MASS_SCHEMA
} from '../src/runtime/sph/sphReactionGpuSummary.js';
import {
  tagResidentProductMassDevice,
  tagWebGpuBufferDevice,
  webGpuDeviceId
} from '../src/runtime/sph/sphGpuDeviceIdentity.js';
import {
  ULG_SPH_RETAINED_GAS_CELL_EOS_SOURCE_SCHEMA,
  isExactSphSpatialGasPressureAuthoritySource
} from '../src/runtime/sph/sphSpatialGasLedgerEosGpu.js';
import {
  SCHROEDER_SPATIAL_EPOCH_READER,
  SCHROEDER_SPATIAL_EPOCH_SUPPORT_PROFILE_ID,
  createSchroederSpatialEpochTransaction,
  summarizeSchroederSpatialEpochTransaction
} from '../src/runtime/sph/schroederSpatialEpochTransaction.js';
import {
  releaseSchroederSpatialEpochGenerationAfterQueue,
  runSchroederSpatialEpochGenerationWebGpu
} from '../src/runtime/sph/schroederSpatialEpochGpu.js';
import {
  SCHROEDER_SPATIAL_MECHANICAL_PROPOSAL_MODE,
  SCHROEDER_SPATIAL_MECHANICAL_PROPOSAL_STATUS,
  SCHROEDER_SPATIAL_MECHANICAL_SOLVER_ITERATIONS,
  SCHROEDER_SPATIAL_MECHANICAL_SOURCE_POSITION_AUTHORITY,
  SCHROEDER_SPATIAL_MECHANICAL_TRAVERSAL_COUNT,
  ULG_SCHROEDER_SPATIAL_MECHANICAL_PROPOSAL_SCHEMA
} from '../src/runtime/sph/schroederSpatialMechanicalProposalsGpu.js';
import { buildSphThermalMaterialTable } from '../src/runtime/sph/sphThermalGpuKernel.js';
import { buildSphReactionTable } from '../src/runtime/sph/sphReactionGpuKernel.js';
import { buildMlsMpmMechanicsMaterialTable } from '../src/runtime/sph/sphMechanicsMaterialTable.js';
import {
  RESIDENT_STATE_FAMILIES,
  ULG_RESIDENT_STATE_AUTHORITY_LEDGER_SCHEMA
} from '../src/runtime/residentStateAuthority.js';
import {
  createSchroederHierarchyArtifactLedger,
  registerSchroederHierarchyArtifactFamily,
  releaseSchroederHierarchyArtifactTransfers,
  scheduleSchroederHierarchyArtifactRetirement,
  transferSchroederHierarchyArtifactFamily,
  summarizeSchroederHierarchyArtifactLedger
} from '../src/runtime/sph/schroederHierarchyArtifactLedger.js';

const RUN_NATIVE_PHASE_LINEAGE_SUMMARY =
  process.env.ULG_RUN_NATIVE_PHASE_LINEAGE_SUMMARY === '1';
const NATIVE_PHASE_LINEAGE_SUMMARY_BASE_URL =
  process.env.ULG_PHASE_LINEAGE_SUMMARY_BASE_URL || 'https://127.0.0.1:5174/';
const RUN_NATIVE_ACTIVE_SOURCE_P2G =
  process.env.ULG_RUN_NATIVE_ACTIVE_SOURCE_P2G === '1';
const NATIVE_ACTIVE_SOURCE_P2G_BASE_URL =
  process.env.ULG_ACTIVE_SOURCE_P2G_BASE_URL || 'https://127.0.0.1:5174/';

test('mechanics-field indirect consumers authenticate and flatten public x/y dispatches', () => {
  for (const wgsl of [
    mlsMpmP2gGridProjectionCanonicalSpatialMechanicsFieldWgsl,
    mlsMpmMechanicsFieldGridUpdateWgsl,
    schroederSpatialPhaseVolumeTransportWgsl
  ]) {
    assert.match(
      wgsl,
      /workgroup_id\.x \+ workgroup_id\.y \* (?:p2g_field_word\([\s\S]*?60u[\s\S]*?\)|field_(?:word|load)\(60u\)|dispatch_x)/
    );
    assert.match(
      wgsl,
      /dispatch_y == expected_y[\s\S]*(?:p2g_field_word|field_(?:word|load))\(44u\) == dispatch_x[\s\S]*(?:p2g_field_word|field_(?:word|load))\(45u\) == dispatch_y[\s\S]*(?:p2g_field_word|field_(?:word|load))\(46u\) == dispatch_z/
    );
  }

  for (const entryPoint of [
    'finalize_grid',
    'clear_accumulators',
    'validate_mechanics_field_keys'
  ]) {
    assert.match(
      mlsMpmP2gGridProjectionCanonicalSpatialMechanicsFieldWgsl,
      new RegExp(
        `fn ${entryPoint}\\([\\s\\S]*p2g_field_linear_invocation\\(local_id, workgroup_id\\)`
      )
    );
  }
  for (const entryPoint of [
    'clear_heat_rows',
    'main',
    'contact_fields',
    'summarize_heat_rows'
  ]) {
    assert.match(
      mlsMpmMechanicsFieldGridUpdateWgsl,
      new RegExp(
        `fn ${entryPoint}\\([\\s\\S]*field_linear_invocation\\(local_id, workgroup_id\\)`
      )
    );
  }
  for (const entryPoint of [
    'stage_transport',
    'validate_staged_transport',
    'commit_transport'
  ]) {
    assert.match(
      schroederSpatialPhaseVolumeTransportWgsl,
      new RegExp(
        `fn ${entryPoint}\\([\\s\\S]*field_linear_invocation\\(local_id, workgroup_id\\)`
      )
    );
  }
});

test('active timestamp-query span recorders explicitly omit synchronous queue summaries', () => {
  const summary = summarizeGpuTimestampRecorderQueueStages({
    schema: 'peercompute.ulg.test-span-recorder.v0',
    recorderKind: 'timestamp-query-span',
    active: true,
    encoderSpansSupported: true,
    beginEncoderSpan() {},
    endEncoderSpan() {},
    async measureQueueStage(_descriptor, runner) {
      return runner();
    }
  });

  assert.equal(
    summary.status,
    'gpu-timestamp-recorder-stage-summary-unavailable'
  );
  assert.equal(summary.stageGpuMs, null);
  assert.equal(summary.stageGpuStats, null);
  assert.equal(summary.recorderKind, 'timestamp-query-span');
  assert.equal(summary.capabilities.measureQueueStage, true);
  assert.equal(summary.capabilities.encoderSpans, true);
  assert.equal(summary.capabilities.stageGpuMs, false);
  assert.equal(summary.capabilities.stageGpuStats, false);
});

test('queue-stage recorder summaries are captured only through declared methods', () => {
  const stageGpuMs = { fusedMechanicsSequence: 2.5 };
  const stageGpuStats = {
    fusedMechanicsSequence: {
      totalMs: 2.5,
      count: 1,
      maxMs: 2.5,
      meanMs: 2.5
    }
  };
  const summary = summarizeGpuTimestampRecorderQueueStages({
    schema: 'peercompute.ulg.test-queue-recorder.v0',
    recorderKind: 'queue-fence-stage-summary',
    active: true,
    encoderSpansSupported: false,
    stageGpuMs: () => stageGpuMs,
    stageGpuStats: () => stageGpuStats
  });

  assert.equal(
    summary.status,
    'gpu-timestamp-recorder-stage-summary-ready'
  );
  assert.equal(summary.stageGpuMs, stageGpuMs);
  assert.equal(summary.stageGpuStats, stageGpuStats);
  assert.equal(summary.capabilities.encoderSpans, false);
  assert.equal(summary.capabilities.stageGpuMs, true);
  assert.equal(summary.capabilities.stageGpuStats, true);
});

test('inactive or invalid recorder summaries return null instead of fabricated zero', () => {
  const inactive = summarizeGpuTimestampRecorderQueueStages({
    active: false,
    stageGpuMs() {
      throw new Error('inactive summary method must not be called');
    },
    stageGpuStats() {
      throw new Error('inactive summary method must not be called');
    }
  });
  assert.equal(inactive.status, 'gpu-timestamp-recorder-inactive');
  assert.equal(inactive.stageGpuMs, null);
  assert.equal(inactive.stageGpuStats, null);

  const invalid = summarizeGpuTimestampRecorderQueueStages({
    active: true,
    stageGpuMs: () => 0,
    stageGpuStats: () => 0
  });
  assert.equal(
    invalid.status,
    'gpu-timestamp-recorder-stage-summary-invalid'
  );
  assert.equal(invalid.stageGpuMs, null);
  assert.equal(invalid.stageGpuStats, null);
});

test('mechanics-field contact requires interface authority for mixed noncondensed pairs and defers all-noncondensed pairs to EOS', () => {
  const classify = (left, right) =>
    classifyMlsMpmMechanicsFieldContactPair(left, right);
  const excluded = MLS_MPM_MECHANICS_FIELD_CONTACT_POLICY.excluded;
  const eligible = MLS_MPM_MECHANICS_FIELD_CONTACT_POLICY.eligible;
  const rejected = MLS_MPM_MECHANICS_FIELD_CONTACT_POLICY.rejected;

  const mixedPairs = [
    [[42, 3, 7, 0], [42, 2, 7, 0]],
    [[42, 2, 7, 0], [42, 3, 7, 0]],
    [[42, 3, 7, 0], [42, 1, 7, 11]],
    [[42, 4, 8, 0], [42, 1, 7, 11]],
    [[42, 2, 8, 0], [42, 4, 7, 0]]
  ];
  for (const [left, right] of mixedPairs) {
    const result = classify(left, right);
    assert.equal(result.policy, excluded);
    assert.equal(result.eligible, false);
    assert.equal(
      result.reason,
      'mixed-noncondensed-contact-requires-authenticated-interface-receipt'
    );
  }

  const allNoncondensedPairs = [
    [[42, 3, 7, 0], [42, 3, 8, 0]],
    [[42, 3, 7, 0], [42, 4, 8, 0]],
    [[42, 4, 8, 0], [42, 3, 7, 0]],
    [[42, 4, 7, 0], [42, 4, 8, 0]]
  ];
  for (const [left, right] of allNoncondensedPairs) {
    const result = classify(left, right);
    assert.equal(result.policy, excluded);
    assert.equal(result.eligible, false);
    assert.equal(result.reason, 'all-noncondensed-contact-owned-by-eos');
  }

  assert.equal(classify([42, 1, 7, 11], [42, 1, 7, 12]).policy, eligible);
  assert.equal(classify([42, 1, 7, 11], [42, 2, 7, 0]).policy, eligible);
  assert.equal(classify([42, 2, 7, 0], [42, 2, 8, 0]).policy, eligible);
  assert.equal(classify([42, 2, 7, 0], [42, 1, 8, 13]).policy, eligible);
  assert.equal(classify([42, 1, 7, 0], [42, 2, 8, 0]).policy, rejected);
  assert.equal(classify([42, 2, 7, 9], [42, 2, 8, 0]).policy, rejected);
  assert.equal(classify([42, 5, 7, 0], [42, 2, 8, 0]).policy, rejected);

  assert.match(mlsMpmMechanicsFieldGridUpdateWgsl, /fn field_contact_pair_policy\(/);
  assert.match(
    mlsMpmMechanicsFieldGridUpdateWgsl,
    /let left_noncondensed = left_phase >= 3u;[\s\S]*let right_noncondensed = right_phase >= 3u;/
  );
  assert.match(
    mlsMpmMechanicsFieldGridUpdateWgsl,
    /if \(left_noncondensed && right_noncondensed\) \{\s*return FIELD_CONTACT_PAIR_EXCLUDED;\s*\}/
  );
  assert.match(
    mlsMpmMechanicsFieldGridUpdateWgsl,
    /if \(left_noncondensed != right_noncondensed\) \{[\s\S]*return FIELD_CONTACT_PAIR_EXCLUDED;\s*\}/
  );
  assert.match(
    mlsMpmMechanicsFieldGridUpdateWgsl,
    /left_material != right_material[\s\S]*FIELD_CONTACT_PAIR_ELIGIBLE/
  );
  assert.match(
    mlsMpmMechanicsFieldGridUpdateWgsl,
    /solid_liquid_interface[\s\S]*FIELD_CONTACT_PAIR_ELIGIBLE/
  );
  assert.match(
    mlsMpmMechanicsFieldGridUpdateWgsl,
    /left_phase == 1u[\s\S]*right_phase == 1u[\s\S]*left_key \+ 3u[\s\S]*right_key \+ 3u/
  );
  assert.match(
    mlsMpmMechanicsFieldGridUpdateWgsl,
    /contact_policy != FIELD_CONTACT_PAIR_ELIGIBLE\) \{ continue; \}[\s\S]*let left_gradient/
  );
  assert.equal(SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_RECEIPT_WORDS, 36);
  assert.match(
    mlsMpmMechanicsFieldGridUpdateWgsl,
    /fn summarize_heat_rows\([\s\S]*receipt \+ 20u, ambient_impulse\.x[\s\S]*receipt \+ 21u, ambient_impulse\.y[\s\S]*receipt \+ 22u, ambient_impulse\.z[\s\S]*receipt \+ 23u,[\s\S]*ambient_external_work_j/
  );
});

test('single-level fused mechanics measures signed field energy without reflux consumers', () => {
  assert.deepEqual(
    FUSED_SINGLE_LEVEL_MECHANICS_FIELD_G2P_RECEIPT_ENTRY_POINTS,
    [
      { id: 'claim', entryPoint: 'claim_g2p_energy_receipt' },
      { id: 'measure', entryPoint: 'measure_g2p_energy_receipt' },
      { id: 'consume-field', entryPoint: 'consume_g2p_energy_receipt' }
    ]
  );
});

test('single-level fused mechanics G2P keeps local heat but omits route sampling', () => {
  const variants = [
    [
      mlsMpmG2pReconstructCanonicalSpatialMechanicsFieldWgsl,
      mlsMpmG2pReconstructCanonicalSpatialSingleLevelMechanicsFieldWgsl
    ],
    [
      mlsMpmG2pReconstructCanonicalSpatialUnobservedMechanicsFieldWgsl,
      mlsMpmG2pReconstructCanonicalSpatialUnobservedSingleLevelMechanicsFieldWgsl
    ]
  ];
  const occurrenceCount = (source, needle) => source.split(needle).length - 1;
  const sourceSection = (source, start, end) => {
    const startIndex = source.indexOf(start);
    const endIndex = source.indexOf(end, startIndex + start.length);
    assert.notEqual(startIndex, -1);
    assert.notEqual(endIndex, -1);
    return source.slice(startIndex, endIndex);
  };
  for (const [crossLevel, singleLevel] of variants) {
    assert.equal(occurrenceCount(
      crossLevel,
      'g2p_field_route_specific_energy('
    ), 2);
    assert.equal(occurrenceCount(
      crossLevel,
      'g2p_reflux_specific_energy('
    ), 2);
    assert.equal(occurrenceCount(
      singleLevel,
      'g2p_field_route_specific_energy('
    ), 1);
    assert.equal(occurrenceCount(
      singleLevel,
      'g2p_reflux_specific_energy('
    ), 1);
    assert.match(
      singleLevel,
      /This fused route always binds the four-word dummy reflux buffer\./
    );
    assert.match(
      singleLevel,
      /runFusedNoFullMlsMpmMechanicsWebGpu always binds the dummy ledger\./
    );
    assert.match(
      sourceSection(
        singleLevel,
        'fn g2p_reflux_present()',
        'fn g2p_reflux_admitted()'
      ),
      /return false;/
    );
    assert.doesNotMatch(
      sourceSection(
        singleLevel,
        'fn g2p_field_find(',
        'fn g2p_scale_close('
      ),
      /g2p_field_view_admitted\(\)/
    );
    assert.doesNotMatch(
      sourceSection(
        singleLevel,
        'fn g2p_field_specific_energy(',
        'fn g2p_field_route_specific_energy('
      ),
      /g2p_field_receipt_structural/
    );
    assert.match(
      sourceSection(
        crossLevel,
        'fn g2p_field_specific_energy(',
        'fn g2p_field_route_specific_energy('
      ),
      /g2p_field_receipt_structural/
    );
    assert.match(singleLevel, /g2p_field_receipt_offset\(\) \+ 10u/);
    assert.match(singleLevel, /g2p_field_receipt_offset\(\) \+ 18u/);
    assert.match(singleLevel, /g2p_field_receipt_offset\(\) \+ 19u/);
    assert.match(singleLevel, /fn claim_g2p_energy_receipt\(\)/);
    assert.match(singleLevel, /fn measure_g2p_energy_receipt\(/);
    assert.match(singleLevel, /fn consume_g2p_energy_receipt\(\)/);
    assert.doesNotMatch(singleLevel, /sampled_field_route_internal_energy_delta/);
    assert.doesNotMatch(singleLevel, /sampled_route_internal_energy_delta/);
    assert.match(crossLevel, /fn measure_g2p_energy_receipt\(/);
    // The particle-side measurement differences stored f32 internal energy,
    // so it is bounded one-sided against that state per particle. There is no
    // sound receipt-level measured-vs-expected equality at this conditioning.
    assert.doesNotMatch(crossLevel, /fn g2p_energy_receipt_close\(/);
    assert.match(
      crossLevel,
      /measure_gamma_n \* mass \* \(abs\(prior\) \+ abs\(next\)\)/
    );
    assert.match(crossLevel, /delta_j < -measure_tolerance/);
    for (const source of [crossLevel, singleLevel]) {
      assert.match(
        source,
        /let local_energy_evidence_count = g2p_saturating_add\([\s\S]*params\.particle_count \* 28u[\s\S]*g2p_field_load\(34u\)/
      );
      assert.match(
        source,
        /measure_gamma_n \* mass \* \(abs\(prior\) \+ abs\(next\)\)/
      );
      assert.match(
        source,
        /g2p_scale_close\([\s\S]*published_field_heat,[\s\S]*consumed_field_heat,[\s\S]*energy_evidence_count[\s\S]*g2p_scale_close\([\s\S]*published_pressure_internal_compensation,[\s\S]*consumed_pressure_internal_compensation,[\s\S]*energy_evidence_count/
      );
    }
    assert.match(
      crossLevel,
      /energy_evidence_count = max\([\s\S]*g2p_reflux_load\(94u\)/
    );
    assert.match(
      crossLevel,
      /consumed_coarse_reflux_heat[\s\S]*84u,[\s\S]*consumed_field_heat \+ consumed_coarse_reflux_heat/
    );
    assert.match(crossLevel, /fn consume_g2p_fine_reflux_receipt\(\)/);
    assert.match(crossLevel, /fn consume_g2p_coarse_reflux_receipt\(\)/);
    assert.match(
      crossLevel,
      /consumed_coarse_reflux_heat[\s\S]*g2p_selected_is_coarse\(\)[\s\S]*g2p_reflux_load\(115u\)[\s\S]*84u,[\s\S]*consumed_field_heat \+ consumed_coarse_reflux_heat/
    );
    assert.match(
      singleLevel,
      /if \(g2p_reflux_present\(\) && g2p_selected_is_coarse\(\)\) \{[\s\S]*g2p_reflux_load\(115u\)/
    );
  }
});

test('mechanics-field P2G emits records and reduces them in retained stable order', () => {
  const variants = [
    [
      mlsMpmP2gGridProjectionCanonicalSpatialMechanicsFieldWgsl,
      mlsMpmP2gGridProjectionCanonicalSpatialSingleLevelMechanicsFieldWgsl
    ],
    [
      mlsMpmP2gGridProjectionCanonicalSpatialUnobservedMechanicsFieldWgsl,
      mlsMpmP2gGridProjectionCanonicalSpatialUnobservedSingleLevelMechanicsFieldWgsl
    ]
  ];
  for (const [crossLevel, singleLevel] of variants) {
    const finalizeSection = (source) => {
      const start = source.indexOf('fn finalize_grid(');
      const end = source.indexOf('\n\nfn compact_mechanics_view_word', start);
      assert.notEqual(start, -1);
      assert.notEqual(end, -1);
      return source.slice(start, end);
    };
    for (const source of [crossLevel, singleLevel]) {
      assert.match(
        source,
        /@binding\(5\) var<storage, read_write> product_events/
      );
      assert.match(
        source,
        /@binding\(6\) var<storage, read> p2g_field_sorted_candidate_indices/
      );
      assert.match(source, /fn p2g_field_group_lower_bound\(field_index: u32\)/);
      assert.match(source, /candidate_index <= previous_candidate/);
      assert.match(source, /contribution_published != 1\.0/);
      assert.match(
        source,
        /p2g_field_word\(33u\) \/ P2G_FIELD_STENCIL_SIZE == params\.particle_count/
      );
      assert.doesNotMatch(source, /p2g_field_atomic_add_f32/);
      assert.doesNotMatch(source, /bitcast<f32>\(candidate_index \+ 1u\)/);
      assert.doesNotMatch(
        finalizeSection(source),
        /word < P2G_FIELD_ACCUMULATOR_WORDS/
      );
    }
    assert.match(
      finalizeSection(singleLevel),
      /transient deterministic reduction buffer/
    );
    assert.doesNotMatch(
      finalizeSection(crossLevel),
      /transient deterministic reduction buffer/
    );
  }
});

test('ActiveSource-v2 P2G is sparse while single-level and cross-level G2P stay distinct', () => {
  const p2gVariants = [
    mlsMpmP2gGridProjectionCanonicalSpatialActiveSourceV2SingleLevelMechanicsFieldWgsl,
    mlsMpmP2gGridProjectionCanonicalSpatialUnobservedActiveSourceV2SingleLevelMechanicsFieldWgsl
  ];
  const singleLevelG2pVariants = [
    mlsMpmG2pReconstructCanonicalSpatialActiveSourceV2SingleLevelMechanicsFieldWgsl,
    mlsMpmG2pReconstructCanonicalSpatialUnobservedActiveSourceV2SingleLevelMechanicsFieldWgsl
  ];
  const crossLevelG2pVariants = [
    mlsMpmG2pReconstructCanonicalSpatialActiveSourceV2MechanicsFieldWgsl,
    mlsMpmG2pReconstructCanonicalSpatialUnobservedActiveSourceV2MechanicsFieldWgsl
  ];
  const section = (source, start, end) => {
    const startIndex = source.indexOf(start);
    const endIndex = source.indexOf(end, startIndex + start.length);
    assert.notEqual(startIndex, -1);
    assert.notEqual(endIndex, -1);
    return source.slice(startIndex, endIndex);
  };

  for (const source of p2gVariants) {
    assert.match(
      source,
      /@binding\(7\) var<storage, read> schroeder_spatial_authority_evidence: array<u32>/
    );
    assert.match(
      source,
      /@binding\(8\) var<storage, read> active_source_view: array<u32>/
    );
    assert.doesNotMatch(source, /var<storage, read_write> schroeder_spatial_authority_evidence/);
    assert.doesNotMatch(source, /atomic(?:Store|Add)\(&schroeder_spatial_authority_evidence/);
    assert.match(
      source,
      /active_source_view\[47u\] == p2g_active_source_projection_seal\(\)/
    );
    assert.match(
      source,
      /if \(invocation_count == 0u\) \{\s*return x == 0u && y == 1u && z == 1u;/
    );
    assert.match(source, /active_candidate_count == active_count \* 27u/);
    assert.match(
      source,
      /let active_ordinal =\s*\(workgroup_id\.x \+ workgroup_id\.y \* dispatch_x\) \* 64u \+ local_id\.x;/
    );
    assert.match(
      source,
      /let particle_index = p2g_physical_for_active\(active_ordinal\);/
    );
    assert.match(
      source,
      /let candidate_index = active_ordinal \* P2G_FIELD_STENCIL_SIZE\s*\+ stencil_ordinal;/
    );
    assert.doesNotMatch(
      section(
        source,
        'fn p2g_physical_for_active(',
        'fn p2g_active_for_physical('
      ),
      /p2g_spatial_directory_admitted/
    );
    assert.doesNotMatch(
      section(
        source,
        'fn p2g_particle_enabled(',
        '\n}'
      ),
      /p2g_authenticate_spatial_header/
    );
  }

  for (const source of [
    ...singleLevelG2pVariants,
    ...crossLevelG2pVariants
  ]) {
    assert.match(
      source,
      /@binding\(7\) var<storage, read> schroeder_spatial_authority_evidence: array<u32>/
    );
    assert.match(
      source,
      /@binding\(8\) var<storage, read> active_source_view: array<u32>/
    );
    assert.doesNotMatch(source, /var<storage, read_write> schroeder_spatial_authority_evidence/);
    assert.doesNotMatch(source, /atomic(?:Store|Add)\(&schroeder_spatial_authority_evidence/);
    assert.match(
      source,
      /active_source_view\[47u\] == g2p_active_source_projection_seal\(\)/
    );
    assert.match(source, /let particle_index = global_id\.x;/);
    assert.match(
      source,
      /if \(active_ordinal == G2P_ACTIVE_SOURCE_MISSING\) \{\s*return false;/
    );
    assert.match(
      source,
      /active_source_view\[active_source_view\[25u\] \+ active_ordinal\]\s*!= particle_index/
    );
  }
  for (const source of singleLevelG2pVariants) {
    assert.match(
      source,
      /fn g2p_reflux_present\(\) -> bool \{\s*\/\/ runFusedNoFullMlsMpmMechanicsWebGpu always binds the dummy ledger\.\s*return false;/
    );
  }
  for (const source of crossLevelG2pVariants) {
    assert.match(
      source,
      /fn g2p_reflux_present\(\) -> bool \{\s*return arrayLength\(&cross_level_reflux\) >= G2P_REFLUX_HEADER_WORDS/
    );
    assert.match(source, /fn consume_g2p_fine_reflux_receipt\(\)/);
    assert.match(source, /fn consume_g2p_coarse_reflux_receipt\(\)/);
    assert.doesNotMatch(
      source,
      /runFusedNoFullMlsMpmMechanicsWebGpu always binds the dummy ledger/
    );
  }
});

test('fused mechanics resolves exact compact views per selected level', () => {
  const fine = {
    selectedLevel: 0,
    mechanicsView: { id: 'fine-mechanics' },
    mechanicsViewRuntime: { id: 'fine-mechanics-runtime' },
    mechanicsFieldView: { id: 'fine-fields' },
    mechanicsFieldViewRuntime: { id: 'fine-fields-runtime' }
  };
  const coarse = {
    selectedLevel: 1,
    mechanicsView: { id: 'coarse-mechanics' },
    mechanicsViewRuntime: { id: 'coarse-mechanics-runtime' },
    mechanicsFieldView: { id: 'coarse-fields' },
    mechanicsFieldViewRuntime: { id: 'coarse-fields-runtime' }
  };
  const generation = {
    mechanicsLevelViews: [fine, coarse],
    mechanicsView: fine.mechanicsView,
    mechanicsViewRuntime: fine.mechanicsViewRuntime,
    mechanicsFieldView: fine.mechanicsFieldView,
    mechanicsFieldViewRuntime: fine.mechanicsFieldViewRuntime
  };

  const selected = resolveFusedSchroederMechanicsLevelView(generation, 1);
  assert.equal(selected.mechanicsView, coarse.mechanicsView);
  assert.equal(selected.mechanicsViewRuntime, coarse.mechanicsViewRuntime);
  assert.equal(selected.mechanicsFieldView, coarse.mechanicsFieldView);
  assert.equal(
    selected.mechanicsFieldViewRuntime,
    coarse.mechanicsFieldViewRuntime
  );
  assert.equal(selected.matchedSelectedLevel, 1);
  assert.equal(
    selected.source,
    'generation-mechanics-level-view-exact-match'
  );

  const missing = resolveFusedSchroederMechanicsLevelView(generation, 2);
  assert.equal(missing.mechanicsView, null);
  assert.equal(missing.mechanicsFieldView, null);
  assert.equal(missing.mechanicsViewPublished, true);
  assert.equal(missing.mechanicsFieldViewPublished, true);
  assert.equal(
    missing.source,
    'generation-mechanics-level-view-missing-exact-match'
  );

  const oneLevel = resolveFusedSchroederMechanicsLevelView({
    ...generation,
    mechanicsLevelViews: [coarse]
  }, null);
  assert.equal(oneLevel.mechanicsView, coarse.mechanicsView);
  assert.equal(oneLevel.mechanicsFieldView, coarse.mechanicsFieldView);
  assert.equal(
    oneLevel.source,
    'generation-mechanics-level-view-one-level-alias'
  );
});

function manualBuffers({
  position = [1.25, 1.25, 1.25],
  velocity = [2, 0, 0],
  massKg = 8,
  smoothingLengthM = 1,
  restDensityKgPerM3 = 8,
  mechanicsDtS = 0.1,
  algorithmMaterialContactRows = null,
  particleCount = 1
} = {}) {
  const boundedParticleCount = Math.max(1, Math.floor(particleCount));
  const state = new Float32Array(boundedParticleCount * 8);
  const thermo = new Float32Array(boundedParticleCount * 12);
  const mechanics = new Float32Array(
    boundedParticleCount * MLS_MPM_GPU_PARTICLE_MECHANICS_ROW_LAYOUT.length
  );
  for (let index = 0; index < boundedParticleCount; index += 1) {
    const stateBase = index * 8;
    state.set([
      position[0] + index * 0.25, position[1], position[2], massKg,
      velocity[0], velocity[1], velocity[2], 123
    ], stateBase);
    thermo[index * 12 + 3] = restDensityKgPerM3;
    const mechanicsBase = index * MLS_MPM_GPU_PARTICLE_MECHANICS_ROW_LAYOUT.length;
    mechanics.set([1, 0, 0, 0, 1, 0, 0, 0, 1], mechanicsBase);
    mechanics[mechanicsBase + 18] = 1;
    mechanics[mechanicsBase + 19] = massKg / restDensityKgPerM3;
    mechanics[mechanicsBase + 20] = 1;
    mechanics[mechanicsBase + 21] = 1;
  }
  return {
    sphParticleState: {
      schema: ULG_SPH_GPU_PARTICLE_BUFFER_SCHEMA,
      particleCount: boundedParticleCount,
      smoothingLengthM,
      step: 0,
      time: 0,
      state,
      thermo
    },
    mlsMpmParticleState: {
      schema: ULG_MLS_MPM_GPU_PARTICLE_BUFFER_SCHEMA,
      particleCount: boundedParticleCount,
      step: 0,
      time: 0,
      mechanicsDtS,
      gridCflFactor: 10,
      gravityMPerS2: [0, 0, 0],
      mechanics,
      algorithmMaterialContactRows
    }
  };
}

function nearlyEqual(actual, expected, tolerance = 1e-6) {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `expected ${actual} to be within ${tolerance} of ${expected}`
  );
}

const MLS_MPM_GPU_RESIDENT_SUMMARY_BYTES = MLS_MPM_GPU_RESIDENT_SUMMARY_FLOATS * Float32Array.BYTES_PER_ELEMENT;

function nodeOffset(gridSpec, nodeI, nodeJ, nodeK, strideFloats) {
  const [, gny, gnz] = gridSpec.gridDims;
  return (((nodeI + gridSpec.gridShift) * gny + (nodeJ + gridSpec.gridShift)) * gnz + (nodeK + gridSpec.gridShift))
    * strideFloats;
}

function pressureInterfaceForceSolverFixture({
  centroid = [1, 1, 1],
  force = [8, 0, 0],
  reactionForce = [-8, 0, 0],
  pressurePa = 100000,
  status = 1,
  forceApplicationStatus = 'solver-ready-not-applied',
  gridForceApplicationApproved = false
} = {}) {
  const forceRowValues = new Float32Array(SPH_PRESSURE_INTERFACE_FORCE_ROW_LAYOUT.length);
  forceRowValues.set([
    0, 1, 2, 0,
    centroid[0], centroid[1], centroid[2], 1,
    force[0], force[1], force[2],
    reactionForce[0], reactionForce[1], reactionForce[2],
    pressurePa, status
  ]);
  return {
    schema: ULG_SPH_PRESSURE_INTERFACE_FORCE_SOLVER_SCHEMA,
    status: 'pressure-interface-force-solver-ready',
    forceCouplingStatus: 'pressure-force-solver-ready-not-applied',
    forceApplicationStatus,
    gridForceApplicationApproved,
    forceApplicationTarget: 'pending-mls-mpm-grid-force-consumer',
    forceRowCount: 1,
    forceRowValues
  };
}

function sharedSpatialPressureSolverAuthorityFixture(overrides = {}) {
  return {
    schroederSpatialExactNearViewSchema:
      ULG_SCHROEDER_SPATIAL_EXACT_NEAR_VIEW_SCHEMA,
    schroederSpatialExactNearGenerationSupplied: true,
    schroederSpatialExactNearHostAdmissionStatus:
      'schroeder-spatial-exact-near-shared-generation-selected',
    schroederSpatialExactNearSelected: true,
    schroederSpatialExactNearBorrowedGeneration: true,
    schroederSpatialExactNearDirectoryOwnership:
      'borrowed-caller-owned-canonical-generation',
    schroederSpatialExactNearConsumerReleaseAuthority: 'generation-owner',
    schroederSpatialExactNearGpuQueryEvidenceRequired: true,
    schroederSpatialExactNearGpuQueryEvidenceSourceAdapterId:
      SCHROEDER_SPATIAL_SOURCE_ADAPTER_EXACT_NEAR_QUERY,
    schroederSpatialExactNearGpuQueryEvidenceEnforcementStatus:
      'shader-validates-query-tail-at-dispatch-no-host-readback',
    schroederSpatialExactNearArenaReleaseStatus:
      'borrowed-generation-release-owned-by-caller',
    schroederSpatialExactNearDirectoryBuildCount: 0,
    schroederSpatialExactNearPrivateParticleBinBuildSuppressed: true,
    schroederSpatialExactNearPrivateParticleBinBuildCount: 0,
    schroederSpatialExactNearFixedCandidateBuildCount: 0,
    schroederSpatialExactNearExhaustiveParticleScanCount: 0,
    schroederSpatialExactNearGpuFallbackObserved: null,
    interfaceContactKinematicsParticleBinGridEnabled: false,
    pressureInterfaceSpatialIndexStatus:
      'pressure-interface-canonical-spatial-epoch-selected',
    ...overrides
  };
}

function pressureInterfaceGridForceAdmissionFixture({
  forceRowCount = 1,
  sourceHotBufferKey = 'ulg:test:pressure-interface-admitted-hot-buffer'
} = {}) {
  return {
    schema: 'peercompute.ulg.pressure-interface-grid-force-consumption-admission.v0',
    status: 'pressure-interface-grid-force-consumption-approved',
    gridForceApplicationApproved: true,
    publicationStatus: 'worker-retained-pressure-interface-output-admitted',
    pressureInterfacePublication: {
      status: 'worker-retained-pressure-interface-output-admitted',
      committed: true,
      sourceHotBufferKey,
      pressureInterfaceForceRowCount: forceRowCount,
      outputFamilies: ['pressure-interface-force-rows']
    },
    hotBufferKey: sourceHotBufferKey,
    pressureInterfaceForceRowCount: forceRowCount,
    outputFamilies: ['pressure-interface-force-rows']
  };
}

function algorithmContactRowsFixture({
  normalStiffnessPa = 3.5e6,
  pairKey = 'drop:Na|base:h2o'
} = {}) {
  return {
    schema: 'peercompute.ulg.algorithm-material-contact-rows.v0',
    status: 'algorithm-derived-contact-rows-ready',
    rowCount: 1,
    rows: [
      {
        schema: 'peercompute.ulg.algorithm-material-contact-row.v0',
        status: 'algorithm-derived-contact-row-ready',
        pairKey,
        roles: ['drop', 'base'],
        materials: ['Na', 'h2o'],
        materialIds: [2, 1],
        phases: ['solid', 'liquid'],
        phaseIds: [1, 2],
        normalStiffnessPa,
        supportRadiusM: 0.25,
        forceMutationAuthority: 'not-authoritative-contact-policy-row'
      }
    ]
  };
}

function webGpuNavigator() {
  return {
    gpu: {
      async requestAdapter() {
        return {
          async requestDevice() {
            return { lost: new Promise(() => {}) };
          }
        };
      }
    }
  };
}

function fakeBufferTracker() {
  return {
    destroyed: 0,
    buffer(label) {
      return {
        label,
        destroy: () => {
          this.destroyed += 1;
        }
      };
    }
  };
}

function canonicalMechanicalProposalFixture({
  generation,
  makeBuffer,
  encodeApply,
  releaseAfterSubmittedWork = () => true,
  labelPrefix = 'canonical-mechanical-proposal'
}) {
  const traversalBuffers = Object.freeze(
    Array.from(
      { length: SCHROEDER_SPATIAL_MECHANICAL_TRAVERSAL_COUNT },
      (_, index) => makeBuffer(`${labelPrefix}-evidence-${index}`)
    )
  );
  const graphControlBuffer = makeBuffer(`${labelPrefix}-graph-control`);
  const indirectDispatchBuffer = makeBuffer(`${labelPrefix}-indirect-dispatch`);
  const sourceCountBuffer = makeBuffer(`${labelPrefix}-source-counts`);
  const sourceOffsetBuffer = makeBuffer(`${labelPrefix}-source-offsets`);
  const appendStagingBuffer = makeBuffer(`${labelPrefix}-append-staging`);
  const directedPeerBuffer = makeBuffer(`${labelPrefix}-directed-peers`);
  const scratchStateABuffer = makeBuffer(`${labelPrefix}-scratch-a`);
  const scratchStateBBuffer = makeBuffer(`${labelPrefix}-scratch-b`);
  const scaleBuffer = makeBuffer(`${labelPrefix}-scales`);
  const proposalBuffer = makeBuffer(`${labelPrefix}-rows`);
  const energyLedgerBuffer = proposalBuffer;
  const evidence = Object.freeze({
    buffer: traversalBuffers[0],
    traversalBuffers,
    scaleMeasurementBuffer: scaleBuffer,
    traversalCount: SCHROEDER_SPATIAL_MECHANICAL_TRAVERSAL_COUNT
  });
  const contactGraph = Object.freeze({
    schema: 'peercompute.ulg.schroeder-spatial-mechanical-pair-graph.v3',
    status: 'schroeder-spatial-mechanical-pair-graph-prepared',
    selectedLevel: 0,
    directedPairCapacity: 4,
    controlBuffer: graphControlBuffer,
    indirectDispatchBuffer,
    sourceCountBuffer,
    sourceOffsetBuffer,
    appendStagingBuffer,
    directedPeerBuffer,
    scratchStateABuffer,
    scratchStateBBuffer,
    scaleBuffer,
    energyLedgerBuffer,
    energyLedgerAliasedToProposalRows: true,
    energyLedgerByteOffset: 64,
    energyLedgerAliasLifetime: 'solver-scratch-until-proposal-publication',
    layout: Object.freeze({
      readbackRequired: false,
      energyLedgerAliasedToProposalRows: true,
      energyLedgerAliasByteOffset: 64
    })
  });
  return Object.freeze({
    schema: ULG_SCHROEDER_SPATIAL_MECHANICAL_PROPOSAL_SCHEMA,
    status: SCHROEDER_SPATIAL_MECHANICAL_PROPOSAL_STATUS,
    ready: true,
    lifecycleStatus: 'prepared',
    encodePolicy: 'single-use-immutable-selected-level',
    selectedLevel: 0,
    proposalMode: SCHROEDER_SPATIAL_MECHANICAL_PROPOSAL_MODE,
    sourcePositionAuthority:
      SCHROEDER_SPATIAL_MECHANICAL_SOURCE_POSITION_AUTHORITY,
    generation,
    generationId: generation.execution.generationId,
    supportEpoch: generation.execution.supportEpoch,
    traversalCount: SCHROEDER_SPATIAL_MECHANICAL_TRAVERSAL_COUNT,
    solverIterationCount: SCHROEDER_SPATIAL_MECHANICAL_SOLVER_ITERATIONS,
    encodedDispatchCount: SCHROEDER_MECHANICAL_DEFERRED_DISPATCH_COUNT,
    encodedComputePassCount: 1,
    privateBuildCount: 0,
    fixedCandidateBuildCount: 0,
    exhaustiveTraversalCount: 0,
    fullParticleReadbackPerformed: false,
    releaseScheduled: false,
    released: false,
    consumerReceipts: Object.freeze({}),
    consumerReceipt() { return null; },
    proposalBuffer,
    proposalRowByteOffset: 64,
    proposalRowWords: 8,
    proposalRowStrideFloats: 8,
    contactGraph,
    graphControlBuffer,
    indirectDispatchBuffer,
    sourceCountBuffer,
    sourceOffsetBuffer,
    appendStagingBuffer,
    directedPeerBuffer,
    scratchStateABuffer,
    scratchStateBBuffer,
    scaleBuffer,
    energyLedgerBuffer,
    energyLedgerAliasedToProposalRows: true,
    energyLedgerByteOffset: 64,
    energyLedgerAliasLifetime: 'solver-scratch-until-proposal-publication',
    energyLedgerRowStrideFloats: 8,
    directedPairCapacity: 4,
    evidence,
    encodeApply,
    releaseAfterSubmittedWork
  });
}

function encodeCanonicalMechanicalFixtureBundle(encoder) {
  const pass = encoder.beginComputePass();
  for (const entryPoint of SCHROEDER_MECHANICAL_DEFERRED_ENTRY_POINTS) {
    pass.setPipeline({ compute: { entryPoint } });
    pass.dispatchWorkgroups(1);
  }
  pass.end();
}

function fakeGpuResidentLaneManager() {
  const activeLeases = new Map();
  const calls = {
    acquire: [],
    complete: [],
    reject: []
  };
  let leaseOrdinal = 0;
  const fenceSatisfied = (status) => [
    'gpu-fence-completed',
    'queue-work-completed',
    'readback-map-completed',
    'ordered-before-consumer-queue-completed'
  ].includes(String(status || ''));
  return {
    calls,
    get activeLeaseCount() {
      return activeLeases.size;
    },
    acquireLease(spec) {
      const leaseId = `${spec.laneId || 'gpu-lane'}:lease:${++leaseOrdinal}`;
      const lease = {
        schema: 'peercompute.compute.gpu-resident-lane-lease.v0',
        leaseId,
        laneId: spec.laneId,
        stateKey: spec.stateKey,
        domainKey: spec.domainKey,
        solverId: spec.solverId,
        taskId: spec.taskId,
        owner: spec.owner,
        readFamilies: [...(spec.readFamilies || [])],
        writeFamilies: [...(spec.writeFamilies || [])],
        retainedBufferRefs: [...(spec.retainedBufferRefs || [])],
        queueFencePolicy: spec.queueFencePolicy,
        copyBudget: { ...(spec.copyBudget || {}) },
        status: 'active'
      };
      activeLeases.set(leaseId, lease);
      calls.acquire.push({ spec: { ...spec, copyBudget: { ...(spec.copyBudget || {}) } }, lease });
      return { ...lease, readFamilies: [...lease.readFamilies], writeFamilies: [...lease.writeFamilies], retainedBufferRefs: [...lease.retainedBufferRefs] };
    },
    completeLease(leaseId, options = {}) {
      const lease = activeLeases.get(leaseId);
      if (!lease) throw new Error(`unknown fake GPU resident lane lease: ${leaseId}`);
      const retainedBufferRefs = [...(options.retainedBufferRefs || lease.retainedBufferRefs || [])];
      const gpuFence = {
        schema: 'peercompute.compute.gpu-fence-report.v0',
        status: options.status || options.queueCompletionStatus || 'queue-work-completed',
        method: options.method || options.queueCompletionMethod || 'queue.onSubmittedWorkDone',
        fenceSatisfied: fenceSatisfied(options.status || options.queueCompletionStatus || 'queue-work-completed'),
        required: true,
        laneId: lease.laneId,
        stateKey: lease.stateKey,
        queueFencePolicy: lease.queueFencePolicy,
        queueCompletionStatus: options.queueCompletionStatus || options.status || null,
        queueCompletionMethod: options.queueCompletionMethod || options.method || null,
        retainedBufferRefs,
        source: options.source || 'fake-gpu-resident-lane-manager'
      };
      const completedLease = {
        ...lease,
        status: gpuFence.fenceSatisfied ? 'completed' : 'completed-unsatisfied-fence',
        retainedBufferRefs,
        gpuFence
      };
      const execution = {
        schema: 'peercompute.compute.gpu-resident-lane-execution.v0',
        lease: completedLease,
        gpuFence,
        lane: {
          laneId: lease.laneId,
          stateKey: lease.stateKey,
          retainedBufferRefs,
          lastFence: gpuFence
        }
      };
      activeLeases.delete(leaseId);
      calls.complete.push({ leaseId, options: { ...options, retainedBufferRefs }, execution });
      return execution;
    },
    rejectLease(leaseId, reason) {
      const lease = activeLeases.get(leaseId);
      activeLeases.delete(leaseId);
      calls.reject.push({ leaseId, reason, lease });
      return {
        schema: 'peercompute.compute.gpu-resident-lane-execution.v0',
        lease: lease ? { ...lease, status: 'rejected', releaseReason: reason } : null,
        gpuFence: null,
        lane: lease ? { laneId: lease.laneId, stateKey: lease.stateKey } : null
      };
    }
  };
}

function noFullReadbackResidentStepFixture() {
  const buffers = manualBuffers();
  const tracker = fakeBufferTracker();
  const sourceThermoBuffer = tracker.buffer('source-thermo');
  const options = {
    ...buffers,
    sphParticleUpload: {
      status: 'webgpu-uploaded',
      stateBuffer: tracker.buffer('source-state'),
      thermoBuffer: sourceThermoBuffer,
      slot: 0
    },
    mlsMpmParticleUpload: {
      status: 'webgpu-uploaded',
      mechanicsBuffer: tracker.buffer('source-mechanics'),
      slot: 0
    },
    preferWebGpu: true,
    navigatorRef: webGpuNavigator(),
    boxDimsM: [3, 3, 3],
    readbackMode: 'no-full-readback',
    p2gRunner() {
      return {
        schema: ULG_MLS_MPM_GPU_GRID_PROJECTION_SCHEMA,
        backend: 'webgpu',
        status: 'projected',
        particleCount: buffers.sphParticleState.particleCount,
        dt: buffers.mlsMpmParticleState.mechanicsDtS,
        gridSpacingM: buffers.sphParticleState.smoothingLengthM,
        gridDims: [8, 8, 8],
        gridNodeCount: 512,
        gridShift: 1,
        gridNodeStrideFloats: 8,
        gridNodes: new Float32Array(),
        gridBuffer: tracker.buffer('p2g-grid-unread'),
        gridBufferByteLength: 512 * 8 * Float32Array.BYTES_PER_ELEMENT,
        readbackMode: 'no-full-readback',
        normalHotLoopReadbackFree: true,
        destroyGridBuffer() {
          this.gridBuffer.destroy();
        }
      };
    },
    gridUpdateRunner(args) {
      return {
        schema: ULG_MLS_MPM_GPU_GRID_UPDATE_SCHEMA,
        backend: 'webgpu',
        status: 'updated',
        sourceSchema: args.p2gGridProjection.schema,
        particleCount: buffers.sphParticleState.particleCount,
        dt: buffers.mlsMpmParticleState.mechanicsDtS,
        gridSpacingM: buffers.sphParticleState.smoothingLengthM,
        gridDims: [8, 8, 8],
        gridNodeCount: 512,
        gridShift: 1,
        gridNodeStrideFloats: 8,
        updatedGridNodes: new Float32Array(),
        updatedGridBuffer: tracker.buffer('updated-grid-unread'),
        updatedGridBufferByteLength: 512 * 8 * Float32Array.BYTES_PER_ELEMENT,
        readbackMode: 'no-full-readback',
        normalHotLoopReadbackFree: true,
        queueCompletionStatus: 'queue-work-completed',
        queueCompletionMethod: 'queue.onSubmittedWorkDone',
        destroyUpdatedGridBuffer() {
          this.updatedGridBuffer.destroy();
        }
      };
    },
    g2pRunner() {
      return {
        schema: ULG_MLS_MPM_GPU_G2P_RECONSTRUCTION_SCHEMA,
        backend: 'webgpu',
        status: 'reconstructed',
        particleCount: buffers.sphParticleState.particleCount,
        gridNodeCount: 512,
        gridSpacingM: buffers.sphParticleState.smoothingLengthM,
        gridDims: [8, 8, 8],
        gridShift: 1,
        dt: buffers.mlsMpmParticleState.mechanicsDtS,
        stateStrideFloats: 8,
        thermoStrideFloats: 12,
        mechanicsStrideFloats: 32,
        state: new Float32Array(),
        mechanics: new Float32Array(),
        stateBuffer: tracker.buffer('g2p-state-unread'),
        mechanicsBuffer: tracker.buffer('g2p-mechanics-unread'),
        stateBufferByteLength: buffers.sphParticleState.state.byteLength,
        mechanicsBufferByteLength: buffers.mlsMpmParticleState.mechanics.byteLength,
        retainedOutputParticleBuffers: true,
        readbackMode: 'no-full-readback',
        normalHotLoopReadbackFree: true,
        destroyOutputParticleBuffers() {
          this.stateBuffer.destroy();
          this.mechanicsBuffer.destroy();
        }
      };
    }
  };
  return { buffers, tracker, sourceThermoBuffer, options };
}

function residentSpatialEpochTransactionFixture({
  device,
  tracker,
  sphParticleUpload,
  mlsMpmParticleUpload,
  generationId = 83,
  storageGeneration = 12
}) {
  const activeNodeBuffer = tracker.buffer(`active-node-${generationId}`);
  const directoryBuffer = tracker.buffer(`directory-${generationId}`);
  const evidenceBuffer = tracker.buffer(`evidence-${generationId}`);
  evidenceBuffer.size = 80;
  const exactNearQueryProfile = { ready: true };
  const epochIdentity = {
    storageGeneration,
    physicsTick: 21,
    physicsSubstep: 1,
    positionEpoch: 22,
    topologyEpoch: 9,
    chartEpoch: 3,
    levelEpoch: 4,
    supportEpoch: 5
  };
  Object.assign(sphParticleUpload, {
    particleCount: sphParticleUpload.particleCount
      ?? 1,
    ...epochIdentity
  });
  Object.assign(mlsMpmParticleUpload, {
    particleCount: mlsMpmParticleUpload.particleCount
      ?? sphParticleUpload.particleCount,
    storageGeneration
  });
  const generation = {
    schema: 'peercompute.ulg.schroeder-spatial-epoch-generation.v1',
    status: 'schroeder-spatial-epoch-generation-submitted',
    selected: true,
    ready: true,
    directoryBuildCount: 1,
    privateLookupBuildCount: 0,
    source: {
      ready: true,
      activeNodeBuffer,
      sourceCount: sphParticleUpload.particleCount,
      sourceStateBuffer: sphParticleUpload.stateBuffer,
      phaseVolumeAssignmentOverlayEnabled: false,
      ...epochIdentity
    },
    execution: {
      schema: 'peercompute.ulg.schroeder-spatial-epoch.v1',
      status: 'schroeder-spatial-epoch-gpu-build-submitted',
      submitPerformed: true,
      deviceId: webGpuDeviceId(device),
      activeNodeBuffer,
      directoryBuffer,
      evidenceBuffer,
      evidenceBufferByteLength: 80,
      sourceAdapterId: SCHROEDER_SPATIAL_SOURCE_ADAPTER_EXACT_NEAR_QUERY,
      exactNearQueryProfile,
      queryGeometryEvidence: exactNearQueryProfile,
      generationId,
      buildOrdinal: generationId,
      sortUniqueOrdinal: generationId,
      deviceOrdinal: 2,
      laneOrdinal: 3,
      leaseToken: generationId,
      sourceFamilyId: 4,
      sourceCount: sphParticleUpload.particleCount,
      layout: { byteLength: 256 },
      ...epochIdentity
    }
  };
  return {
    generation,
    transaction: createSchroederSpatialEpochTransaction({
      device,
      generation,
      sphParticleUpload,
      mlsMpmParticleUpload
    })
  };
}

test('MLS-MPM spatial epoch transaction admits non-fused readers and quarantines nested stale reaction views', async () => {
  const { buffers, tracker, options } = noFullReadbackResidentStepFixture();
  const device = { queue: {}, lost: new Promise(() => {}) };
  const { generation, transaction } = residentSpatialEpochTransactionFixture({
    device,
    tracker,
    sphParticleUpload: options.sphParticleUpload,
    mlsMpmParticleUpload: options.mlsMpmParticleUpload
  });
  const nestedLawQueue = { id: 'nested-x-n-law-queue' };
  const nestedCandidates = { id: 'nested-x-n-candidates' };
  let observedReactionArgs = null;

  await runMlsMpmResidentStepWithOptionalWebGpu({
    ...options,
    device,
    schroederSpatialEpochGeneration: generation,
    schroederSpatialEpochTransaction: transaction,
    canonicalSpatialRequired: false,
    schroederLawQueue: null,
    schroederLawNeighborCandidates: null,
    thermalMaterialTable: { schema: 'test-thermal-table', materialCount: 1 },
    thermalStepRunner(args) {
      return {
        schema: ULG_SPH_GPU_THERMAL_STEP_SCHEMA,
        backend: 'webgpu',
        status: 'thermal-step-executed',
        particleCount: buffers.sphParticleState.particleCount,
        state: new Float32Array(),
        thermo: new Float32Array(),
        stateBuffer: tracker.buffer('transaction-thermal-state'),
        thermoBuffer: tracker.buffer('transaction-thermal-thermo'),
        retainedOutputParticleBuffers: true,
        readbackMode: args.readbackMode,
        neighborLookupMode: 'exhaustive-particle-scan',
        legacyPrivateSpatialBuildCount: 0,
        legacyExhaustiveTraversalCount: 1
      };
    },
    reactionTable: { schema: 'test-reaction-table', reactionCount: 1, gasProductCount: 0 },
    reactionStepOptions: {
      schroederLawQueue: nestedLawQueue,
      schroederLawNeighborCandidates: nestedCandidates
    },
    reactionStepRunner(args) {
      observedReactionArgs = args;
      return {
        schema: ULG_SPH_GPU_REACTION_STEP_SCHEMA,
        backend: 'webgpu',
        status: 'reaction-step-executed',
        particleCount: buffers.sphParticleState.particleCount,
        state: new Float32Array(),
        thermo: new Float32Array(),
        mechanics: new Float32Array(),
        stateBuffer: tracker.buffer('transaction-reaction-state'),
        thermoBuffer: tracker.buffer('transaction-reaction-thermo'),
        mechanicsBuffer: tracker.buffer('transaction-reaction-mechanics'),
        retainedOutputParticleBuffers: true,
        readbackMode: args.readbackMode,
        reactionProposalNeighborMode: 'fixed-capacity-particle-bin-grid',
        reactionParticleBins: { enabled: true }
      };
    }
  });

  assert.ok(observedReactionArgs);
  assert.equal(observedReactionArgs.schroederLawQueue, null);
  assert.equal(observedReactionArgs.schroederLawNeighborCandidates, null);
  const summary = summarizeSchroederSpatialEpochTransaction(transaction);
  assert.equal(summary.state, 'readers-complete');
  assert.deepEqual(
    summary.admittedReaders.map(({ readerId }) => readerId),
    ['mechanics-p2g', 'mechanics-g2p']
  );
  assert.equal(summary.counters.quarantinedLawQueueCount, 1);
  assert.equal(summary.counters.quarantinedCandidateViewCount, 1);
  assert.equal(summary.counters.staleLawInputForwardCount, 0);
  assert.equal(summary.counters.legacyPrivateLookupBuildCount, 1);
  assert.equal(summary.counters.legacyExhaustiveTraversalCount, 1);
});

test('MLS-MPM spatial epoch transaction records zero law lookup when laws are disabled', async () => {
  const { tracker, options } = noFullReadbackResidentStepFixture();
  const device = { queue: {}, lost: new Promise(() => {}) };
  const { generation, transaction } = residentSpatialEpochTransactionFixture({
    device,
    tracker,
    sphParticleUpload: options.sphParticleUpload,
    mlsMpmParticleUpload: options.mlsMpmParticleUpload,
    generationId: 84,
    storageGeneration: 13
  });

  await runMlsMpmResidentStepWithOptionalWebGpu({
    ...options,
    device,
    schroederSpatialEpochGeneration: generation,
    schroederSpatialEpochTransaction: transaction,
    canonicalSpatialRequired: false,
    thermalMaterialTable: null,
    reactionTable: null,
    schroederLawQueue: null,
    schroederLawNeighborCandidates: null
  });

  const summary = summarizeSchroederSpatialEpochTransaction(transaction);
  assert.equal(summary.counters.readerAdmissionCount, 2);
  assert.equal(summary.counters.quarantinedLawQueueCount, 0);
  assert.equal(summary.counters.quarantinedCandidateViewCount, 0);
  assert.equal(summary.counters.staleLawInputForwardCount, 0);
  assert.equal(summary.counters.legacyPrivateLookupBuildCount, 0);
  assert.equal(summary.counters.legacyExhaustiveTraversalCount, 0);
});

function residentProductMassHandle({
  label,
  rowCount,
  byteLength,
  unplacedProductMassKg = rowCount,
  unplacedGasProductMassKg = 0,
  generationCount = 1,
  sourceRowCounts = null,
  sourceByteLengths = null,
  gasSpeciesRows = []
} = {}) {
  const productEventBuffer = {
    label,
    destroyed: false,
    destroy() {
      this.destroyed = true;
    }
  };
  let destroyCalls = 0;
  const gasSpeciesLedger = gasSpeciesRows.length > 0
    ? {
        schema: ULG_SPH_GPU_REACTION_GAS_SPECIES_SUMMARY_SCHEMA,
        status: 'gas-species-compact-ledger-ready',
        records: gasSpeciesRows.map((row, index) => ({
          status: 'ready',
          statusCode: 1,
          gasProductIndex: index,
          eventCount: row.eventCount ?? 1,
          visibleMassKg: row.visibleMassKg ?? 0,
          unplacedMassKg: row.unplacedMassKg ?? row.massKg ?? 0,
          ...row
        })),
        bySpecies: Object.fromEntries(gasSpeciesRows.map((row, index) => [
          String(row.material).toLowerCase(),
          {
            material: String(row.material).toLowerCase(),
            materialId: row.materialId ?? index + 1,
            massKg: row.massKg ?? 0,
            moles: row.moles ?? 0,
            visibleMassKg: row.visibleMassKg ?? 0,
            unplacedMassKg: row.unplacedMassKg ?? row.massKg ?? 0,
            eventCount: row.eventCount ?? 1,
            gasProductIndices: [index],
            fullParticleReadbackPerformed: false
          }
        ])),
        recordCount: gasSpeciesRows.length,
        speciesCount: gasSpeciesRows.length,
        fullParticleReadbackPerformed: false
      }
    : null;
  const handle = {
    schema: ULG_SPH_RESIDENT_PRODUCT_MASS_SCHEMA,
    status: 'resident-product-mass-buffer-retained',
    source: 'test-resident-product-event-buffer',
    productEventBuffer,
    productEventBufferRetained: true,
    productEventBufferByteLength: byteLength,
    productEventRowCount: rowCount,
    productEventActiveEventCount: rowCount,
    productEventStrideFloats: 32,
    productEventStrideBytes: 128,
    productEventGenerationCount: generationCount,
    productEventSourceRowCounts: sourceRowCounts ? [...sourceRowCounts] : [rowCount],
    productInventorySchema: 'peercompute.ulg.sph-gpu-reaction-product-inventory.v0',
    productInventoryCount: rowCount,
    gasSpeciesLedgerSchema: gasSpeciesLedger?.schema ?? null,
    gasSpeciesLedger,
    gasSpeciesLedgerCount: gasSpeciesLedger?.recordCount ?? 0,
    gasSpeciesReadbackByteLength: gasSpeciesLedger ? gasSpeciesLedger.recordCount * 32 : 0,
    sealedBoxGasProductMoles: gasSpeciesRows.reduce((sum, row) => sum + (Number(row.moles) || 0), 0),
    visibleProductMassKg: 0,
    unplacedProductMassKg,
    unplacedGasProductMassKg,
    consumeMassPolicy: 'unplaced-product-mass-only',
    visibleMassAlreadyInParticleBuffers: true,
    mergeSourceProductEventBufferCount: sourceByteLengths?.length ?? generationCount,
    mergeSourceProductEventRowCounts: sourceRowCounts ? [...sourceRowCounts] : [rowCount],
    mergeSourceProductEventBufferByteLengths: sourceByteLengths ? [...sourceByteLengths] : [byteLength],
    eosCouplingStatus: 'resident-product-mass-eos-sidecar-ready',
    forceCouplingStatus: 'strict-force-coupling-blocked',
    destroyResidentProductMassBuffers() {
      destroyCalls += 1;
      productEventBuffer.destroy();
    },
    scientificValidation: false,
    chemistryValidation: false,
    gasValidation: false,
    sphValidation: false,
    fullPhysicsValidation: false
  };
  Object.defineProperty(handle, 'destroyCalls', {
    get() {
      return destroyCalls;
    }
  });
  return handle;
}

function compactSpatialGasRowsFixture(rows = [
  {
    positionM: [0.5, 1, 1],
    materialId: 7,
    massKg: 0.04,
    moles: 100,
    temperatureK: 300,
    supportVolumeM3: 1,
    productTermIndex: 0,
    sourceRowIndex: 0
  },
  {
    positionM: [1.5, 1, 1],
    materialId: 7,
    massKg: 0.06,
    moles: 200,
    temperatureK: 300,
    supportVolumeM3: 1,
    productTermIndex: 0,
    sourceRowIndex: 1
  }
]) {
  const values = new Float32Array(rows.length * SPH_SPATIAL_GAS_LEDGER_COMPACT_ROW_FLOATS);
  rows.forEach((row, index) => {
    const offset = index * SPH_SPATIAL_GAS_LEDGER_COMPACT_ROW_FLOATS;
    values[offset] = row.positionM[0];
    values[offset + 1] = row.positionM[1];
    values[offset + 2] = row.positionM[2];
    values[offset + 3] = row.materialId;
    values[offset + 4] = row.massKg;
    values[offset + 5] = row.moles;
    values[offset + 6] = row.temperatureK;
    values[offset + 7] = row.supportVolumeM3;
    values[offset + 8] = row.productTermIndex;
    values[offset + 9] = row.sourceRowIndex ?? index;
    values[offset + 10] = row.statusCode ?? 1;
    values[offset + 11] = row.routingId ?? 1;
  });
  return values;
}

function productEventRowsFixture(rows = [
  {
    positionM: [0.5, 0.5, 0.5],
    materialId: 3022823,
    massKg: 0.01,
    moles: 5,
    temperatureK: 293.15,
    supportVolumeM3: 0,
    productTermIndex: 0,
    sourceParticleIndex: 0
  },
  {
    positionM: [3.5, 3.5, 3.5],
    materialId: 3022823,
    massKg: 0.02,
    moles: 10,
    temperatureK: 293.15,
    supportVolumeM3: 0,
    productTermIndex: 0,
    sourceParticleIndex: 1
  }
]) {
  const stride = 32;
  const values = new Float32Array(rows.length * stride);
  rows.forEach((row, index) => {
    const offset = index * stride;
    values[offset] = row.positionM[0];
    values[offset + 1] = row.positionM[1];
    values[offset + 2] = row.positionM[2];
    values[offset + 3] = row.massKg;
    values[offset + 4] = row.materialId;
    values[offset + 5] = row.productTermIndex;
    values[offset + 6] = row.reactionIndex ?? 0;
    values[offset + 7] = row.sourceParticleIndex ?? index;
    values[offset + 8] = row.partnerParticleIndex ?? -1;
    values[offset + 9] = row.moles;
    values[offset + 10] = row.routingId ?? 1;
    values[offset + 11] = row.phaseId ?? 2;
    values[offset + 12] = row.visibleMassKg ?? 0;
    values[offset + 13] = row.unplacedMassKg ?? row.massKg;
    values[offset + 14] = row.coefficient ?? 1;
    values[offset + 15] = row.molarMassKgPerMol ?? (row.massKg / row.moles);
    values[offset + 16] = row.temperatureK;
    values[offset + 17] = row.restDensityKgPerM3 ?? 0;
    values[offset + 18] = row.statusCode ?? 1;
    values[offset + 20] = row.velocityMPerS?.[0] ?? 0;
    values[offset + 21] = row.velocityMPerS?.[1] ?? 0;
    values[offset + 22] = row.velocityMPerS?.[2] ?? 0;
    values[offset + 23] = row.supportVolumeM3 ?? 0;
  });
  return values;
}

function fakeSummaryDevice(summaryValues) {
  const createdBuffers = [];
  const bindGroups = [];
  const dispatches = [];
  const indirectDispatches = [];
  const shaderModules = [];
  const copies = [];
  const clears = [];
  const submissions = [];
  const writes = [];
  return {
    lost: new Promise(() => {}),
    createdBuffers,
    bindGroups,
    dispatches,
    indirectDispatches,
    shaderModules,
    copies,
    clears,
    submissions,
    writes,
    queue: {
      writeBuffer(buffer, offset, data) {
        const copy = data instanceof ArrayBuffer
          ? data.slice(0)
          : data?.buffer
            ? data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength)
            : null;
        buffer.lastWrite = copy;
        if (copy) {
          const byteLength = Number(buffer.size) > 0
            ? Number(buffer.size)
            : offset + copy.byteLength;
          if (!buffer._writeBytes || buffer._writeBytes.byteLength < byteLength) {
            const next = new Uint8Array(byteLength);
            if (buffer._writeBytes) next.set(buffer._writeBytes);
            buffer._writeBytes = next;
          }
          buffer._writeBytes.set(new Uint8Array(copy), offset);
        }
        writes.push({ label: buffer.label, offset, byteLength: data.byteLength, data: copy });
      },
      async onSubmittedWorkDone() {},
      submit(commands) {
        submissions.push(commands);
      }
    },
    createBuffer({ label, size, usage }) {
      const buffer = {
        label,
        size,
        usage,
        destroyed: false,
        destroy() {
          this.destroyed = true;
        },
        async mapAsync() {},
        getMappedRange() {
          if (this._mappedData) return this._mappedData.buffer;
          return summaryValues.buffer.slice(
            summaryValues.byteOffset,
            summaryValues.byteOffset + summaryValues.byteLength
          );
        },
        unmap() {
          this.unmapped = true;
        }
      };
      createdBuffers.push(buffer);
      return buffer;
    },
    createShaderModule({ code }) {
      const module = { code };
      shaderModules.push(module);
      return module;
    },
    createComputePipeline({ compute }) {
      return {
        compute,
        getBindGroupLayout(index) {
          return { index, entryPoint: compute.entryPoint };
        }
      };
    },
    createBindGroup({ layout, entries }) {
      const bindGroup = { layout, entries };
      bindGroups.push(bindGroup);
      return bindGroup;
    },
    createCommandEncoder() {
      return {
        beginComputePass() {
          return {
            setPipeline(pipeline) {
              this.pipeline = pipeline;
            },
            setBindGroup(index, bindGroup) {
              this.bindGroup = { index, bindGroup };
            },
            dispatchWorkgroups(count) {
              dispatches.push({ count, pipeline: this.pipeline, bindGroup: this.bindGroup?.bindGroup });
            },
            dispatchWorkgroupsIndirect(buffer, offset) {
              const bytes = buffer._writeBytes
                ?? (buffer.lastWrite ? new Uint8Array(buffer.lastWrite) : new Uint8Array());
              const view = new DataView(
                bytes.buffer,
                bytes.byteOffset,
                bytes.byteLength
              );
              const readWord = (wordOffset) => (
                offset + wordOffset * Uint32Array.BYTES_PER_ELEMENT
                  + Uint32Array.BYTES_PER_ELEMENT <= bytes.byteLength
                  ? view.getUint32(
                      offset + wordOffset * Uint32Array.BYTES_PER_ELEMENT,
                      true
                    )
                  : null
              );
              indirectDispatches.push({
                buffer,
                offset,
                workgroupCountX: readWord(0),
                workgroupCountY: readWord(1),
                workgroupCountZ: readWord(2),
                pipeline: this.pipeline,
                bindGroup: this.bindGroup?.bindGroup
              });
            },
            end() {
              this.ended = true;
            }
          };
        },
        copyBufferToBuffer(source, sourceOffset, destination, destinationOffset, size) {
          if (String(source?.label || '').includes('reaction-discovery-evidence')) {
            const words = source.lastWrite
              ? new Uint32Array(source.lastWrite).slice()
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
            String(source?.label || '').includes(
              'reaction-product-placement-completion-receipt'
            )
          ) {
            const placementCommitBindGroup = [...bindGroups].reverse().find((bindGroup) => {
              const receiptEntry = bindGroup.entries.find(
                (entry) => entry.resource?.buffer === source
              );
              const paramsEntry = bindGroup.entries.find(
                (entry) => /^ulg-sph-reaction-placement-segmented-arena-.*-params$/
                  .test(String(entry.resource?.buffer?.label || ''))
              );
              return receiptEntry && paramsEntry;
            });
            const paramsBuffer = placementCommitBindGroup?.entries.find(
              (entry) => /^ulg-sph-reaction-placement-segmented-arena-.*-params$/
                .test(String(entry.resource?.buffer?.label || ''))
            )?.resource?.buffer;
            const params = paramsBuffer?._writeBytes
              ? new Uint32Array(
                  paramsBuffer._writeBytes.buffer,
                  paramsBuffer._writeBytes.byteOffset,
                  paramsBuffer._writeBytes.byteLength / Uint32Array.BYTES_PER_ELEMENT
                )
              : new Uint32Array(16);
            const words = new Uint32Array(
              SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_WORDS
            );
            const setReceipt = (field, value) => {
              words[SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX[field]] = value;
            };
            const eventCapacity = params[1] ?? 0;
            const particleCount = params[0] ?? 0;
            const reductionDepth = Math.max(
              0,
              Math.ceil(Math.log2(Math.max(1, eventCapacity)))
            );
            setReceipt('magic', SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_MAGIC);
            setReceipt('version', SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_VERSION);
            setReceipt('generationId', params[13] ?? 0);
            setReceipt('supportProfileId', params[14] ?? 0);
            setReceipt('eventCapacity', eventCapacity);
            setReceipt('compactCountPassCount', 1);
            setReceipt('compactScanPassCount', 1);
            setReceipt('compactScatterPassCount', 1);
            setReceipt('compactionInputVisitCount', eventCapacity);
            setReceipt('envelopePartialPassCount', 1);
            setReceipt('envelopeFinalizePassCount', 1);
            setReceipt('envelopeInputVisitCount', particleCount);
            setReceipt('envelopeAdmitted', 1);
            setReceipt('classifierPassCount', 1);
            setReceipt('spareFlagPassCount', 2);
            setReceipt('spareScanPassCount', 2);
            setReceipt('spareAssignPassCount', 2);
            setReceipt('spareCandidateVisitCount', particleCount);
            setReceipt('spareAvailableCount', particleCount);
            setReceipt('applyPassCount', 1);
            setReceipt('applyPreflightPassCount', 1);
            setReceipt('intentEmitPassCount', 1);
            setReceipt('mutationIntentCapacity', eventCapacity * 2);
            setReceipt('mutationIntentCount', 0);
            setReceipt('destinationRadixPassCount', 24);
            setReceipt('destinationSegmentReducePassCount', reductionDepth * 2);
            setReceipt('destinationApplyPassCount', 2);
            setReceipt('destinationIntentVisitedCount', eventCapacity * 2);
            setReceipt('destinationMutationCount', 0);
            setReceipt('maxDestinationSegmentSize', 0);
            setReceipt('summaryRadixPassCount', 8);
            setReceipt('summarySegmentReducePassCount', reductionDepth);
            setReceipt('summaryApplyPassCount', 1);
            setReceipt('summaryContributionCount', 0);
            setReceipt('globalSerialEventFoldCount', 0);
            setReceipt('hostCompletionReadbackCount', 1);
            setReceipt(
              'status',
              SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_STATUS.COMPLETE
            );
            destination._mappedData = words;
          }
          copies.push({ source, sourceOffset, destination, destinationOffset, size });
        },
        clearBuffer(buffer, offset, size) {
          clears.push({ buffer, offset, size });
        },
        finish() {
          return {
            dispatches: [...dispatches],
            indirectDispatches: [...indirectDispatches],
            copies: [...copies],
            clears: [...clears]
          };
        }
      };
    }
  };
}

function deferredTestPromise() {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

async function releaseResidentProductHistoryTestHandles(...handles) {
  for (const handle of new Set(handles.filter(Boolean))) {
    handle.destroyResidentProductMassBuffers?.();
  }
  await new Promise((resolve) => setTimeout(resolve, 0));
}

function fusedMechanicsSummaryStub(buffers) {
  return ({ gridUpdate, summaryScope }) => ({
    schema: 'peercompute.ulg.mls-mpm-resident-summary-execution.v0',
    backend: 'webgpu',
    status: 'compact-summary-ready',
    compactGpuSummaryAvailable: true,
    readbackMode: 'no-full-readback',
    summaryScope,
    particleCount: buffers.sphParticleState.particleCount,
    gridNodeCount: gridUpdate.gridNodeCount,
    activeGridNodeCount: null,
    activeGridNodeCountAvailable: false,
    activeGridNodeSummaryStatus: 'active-grid-node-summary-not-requested',
    gridNodeScanCount: 0,
    gridNodeScanSkipped: true,
    sourceMassKg: 8,
    nextMassKg: 8,
    massDeltaKg: 0,
    sourceMomentumKgMPerS: [0, 0, 0],
    nextMomentumKgMPerS: [0, 0, 0],
    momentumDeltaKgMPerS: [0, 0, 0],
    sourceCenterOfMassM: [1.25, 1.25, 1.25],
    nextCenterOfMassM: [1.25, 1.25, 1.25],
    centerOfMassDeltaM: [0, 0, 0],
    sourcePositionBoundsM: {
      status: 'position-bounds-ready',
      min: [1.25, 1.25, 1.25],
      max: [1.25, 1.25, 1.25],
      massKg: 8
    },
    nextPositionBoundsM: {
      status: 'position-bounds-ready',
      min: [1.25, 1.25, 1.25],
      max: [1.25, 1.25, 1.25],
      massKg: 8
    },
    maxSpeedMPerS: 0,
    maxDisplacementM: 0,
    minVolumeRatioJ: 1,
    maxVolumeRatioJ: 1,
    phaseMassKg: { solid: 0, liquid: 8, gas: 0, plasma: 0 },
    phaseMassTotalKg: 8,
    temperatureMassWeightedMeanK: 0,
    minTemperatureK: 0,
    maxTemperatureK: 0,
    thermalReadyCount: 1,
    thermalProblemCount: 0,
    thermalPhaseSummaryAvailable: true,
    compactReadbackByteLength: MLS_MPM_GPU_RESIDENT_SUMMARY_BYTES,
    timing: {
      schema: 'peercompute.ulg.mls-mpm-resident-summary-timing.v0',
      totalMs: 0,
      setupMs: 0,
      encodeMs: 0,
      submitMs: 0,
      mapAsyncWaitMs: 0,
      decodeMs: 0,
      queueFenceAttribution: 'unit-summary-runner',
      summaryKernelDispatchCount: 0,
      summaryWorkgroupCount: 0,
      compactReadbackByteLength: MLS_MPM_GPU_RESIDENT_SUMMARY_BYTES
    },
    mapAsyncWaitMs: 0,
    queueFenceAttribution: 'unit-summary-runner'
  });
}

function placementAccumulatorSequenceFixture({
  productTermCount = 2,
  suppliedAccumulatorBuffer = null,
  failOnReactionCall = null,
  includeFinalProvenance = true,
  finalProvenanceAvailable = true,
  omitPlacementEvidenceOnReactionCalls = []
} = {}) {
  const { buffers, tracker, options } = noFullReadbackResidentStepFixture();
  const device = fakeSummaryDevice(new Float32Array(MLS_MPM_GPU_RESIDENT_SUMMARY_FLOATS));
  const expectedAccumulatorByteLength = productTermCount
    * SPH_GPU_REACTION_PRODUCT_PLACEMENT_SUMMARY_FLOATS
    * Float32Array.BYTES_PER_ELEMENT;
  let queueFenceCount = 0;
  device.queue.onSubmittedWorkDone = () => {
    queueFenceCount += 1;
    return Promise.resolve();
  };
  const createBuffer = device.createBuffer.bind(device);
  device.createBuffer = (descriptor) => {
    const buffer = createBuffer(descriptor);
    const destroy = buffer.destroy.bind(buffer);
    buffer.destroyCallCount = 0;
    buffer.destroy = () => {
      buffer.destroyCallCount += 1;
      destroy();
    };
    return buffer;
  };

  const reactionCalls = [];
  const sequenceOptions = {
    ...options,
    device,
    stepCount: 3,
    compactSummaryMode: 'final-only',
    summaryRunner: null,
    thermalMaterialTable: {
      schema: 'peercompute.ulg.sph-gpu-thermal-material-table.v0'
    },
    thermalStepRunner: null,
    reactionTable: {
      schema: 'peercompute.ulg.sph-gpu-reaction-table.v1',
      reactionCount: 1,
      productTermCount,
      gasProductCount: 0
    },
    reactionStepOptions: suppliedAccumulatorBuffer
      ? { productPlacementAccumulatorBuffer: suppliedAccumulatorBuffer }
      : {},
    reactionStepRunner(args) {
      const callNumber = reactionCalls.length + 1;
      reactionCalls.push({
        productPlacementAccumulatorBuffer: args.productPlacementAccumulatorBuffer,
        readReactionProductPlacementSummary: args.readReactionProductPlacementSummary,
        reactionProductPlacementReadbackCadence: args.reactionProductPlacementReadbackCadence,
        reactionProductPlacementSourceSummaryCount: args.reactionProductPlacementSourceSummaryCount,
        readCompactReactionSummary: args.readCompactReactionSummary,
        readReactionGasSpeciesSummary: args.readReactionGasSpeciesSummary,
        readReactionProductInventory: args.readReactionProductInventory,
        readReactionAtomResidual: args.readReactionAtomResidual
      });
      if (failOnReactionCall === callNumber) {
        throw new Error(`placement accumulator fixture reaction failure ${callNumber}`);
      }
      const stateBuffer = tracker.buffer(`placement-reaction-state-${callNumber}`);
      const thermoBuffer = tracker.buffer(`placement-reaction-thermo-${callNumber}`);
      const mechanicsBuffer = tracker.buffer(`placement-reaction-mechanics-${callNumber}`);
      const includePlacementEvidence = includeFinalProvenance
        && !omitPlacementEvidenceOnReactionCalls.includes(callNumber);
      const productPlacementProvenance = includePlacementEvidence
        && args.readReactionProductPlacementSummary === true
        ? {
            schema: ULG_SPH_GPU_REACTION_PRODUCT_PLACEMENT_SUMMARY_SCHEMA,
            status: finalProvenanceAvailable
              ? 'product-placement-provenance-ready'
              : 'product-placement-provenance-not-run',
            available: finalProvenanceAvailable,
            productTermCount,
            recordCount: productTermCount,
            records: Array.from({ length: productTermCount }, (_, productTermIndex) => ({
              schema: ULG_SPH_GPU_REACTION_PRODUCT_PLACEMENT_SUMMARY_SCHEMA,
              productTermIndex,
              material: `product-${productTermIndex}`,
              materialId: 100 + productTermIndex,
              status: 'product-placement-term-ready',
              statusCode: 1,
              readyProductMassKg: productTermIndex + 1,
              placedMassKg: productTermIndex + 1,
              mergedMassKg: 0,
              unplacedMassKg: 0
            })),
            byMaterial: Object.fromEntries(
              Array.from({ length: productTermCount }, (_, productTermIndex) => [
                `product-${productTermIndex}`,
                {
                  material: `product-${productTermIndex}`,
                  materialId: 100 + productTermIndex,
                  productTermIndices: [productTermIndex],
                  placedMassKg: productTermIndex + 1,
                  mergedMassKg: 0,
                  unplacedMassKg: 0
                }
              ])
            ),
            placedMassKg: productTermCount * (productTermCount + 1) / 2,
            mergedMassKg: 0,
            unplacedMassKg: 0,
            sourceSummaryCount: args.reactionProductPlacementSourceSummaryCount,
            readbackCadence: args.reactionProductPlacementReadbackCadence,
            readbackFloatCount:
              productTermCount * SPH_GPU_REACTION_PRODUCT_PLACEMENT_SUMMARY_FLOATS,
            readbackByteLength: expectedAccumulatorByteLength,
            fullParticleReadbackPerformed: false
          }
        : null;
      return {
        schema: ULG_SPH_GPU_REACTION_STEP_SCHEMA,
        backend: 'webgpu',
        status: 'reaction-step-executed',
        particleCount: buffers.sphParticleState.particleCount,
        state: new Float32Array(),
        thermo: new Float32Array(),
        mechanics: new Float32Array(),
        stateBuffer,
        thermoBuffer,
        mechanicsBuffer,
        stateBufferByteLength: buffers.sphParticleState.state.byteLength,
        thermoBufferByteLength: buffers.sphParticleState.thermo.byteLength,
        mechanicsBufferByteLength: buffers.mlsMpmParticleState.mechanics.byteLength,
        retainedOutputParticleBuffers: true,
        readbackMode: 'no-full-readback',
        normalHotLoopReadbackFree: true,
        reactionSummary: {
          schema: ULG_SPH_GPU_REACTION_SUMMARY_SCHEMA,
          backend: 'webgpu',
          status: productPlacementProvenance?.status ?? 'reaction-summary-runner-returned-no-placement-evidence',
          reactionSummaryAvailable: false,
          ...(includePlacementEvidence ? {
            productPlacementProvenance,
            productPlacementProvenanceStatus: productPlacementProvenance?.status
              ?? 'product-placement-provenance-gpu-resident-not-read',
            productPlacementProvenanceReadbackByteLength:
              productPlacementProvenance?.readbackByteLength ?? 0,
            productPlacementAccumulatorByteLength: expectedAccumulatorByteLength
          } : {})
        },
        destroyOutputParticleBuffers() {
          stateBuffer.destroy();
          thermoBuffer.destroy();
          mechanicsBuffer.destroy();
        }
      };
    }
  };

  return {
    device,
    expectedAccumulatorByteLength,
    reactionCalls,
    sequenceOptions,
    tracker,
    get queueFenceCount() {
      return queueFenceCount;
    }
  };
}

test('resident product-event compaction rejects legacy or torn row strides before GPU dispatch', async () => {
  await assert.rejects(
    compactResidentProductEventBufferWebGpu({
      device: null,
      sourceBuffer: {},
      rowCount: 1,
      strideFloats: 20,
      strideBytes: 80
    }),
    /exact current 32-float\/128-byte row stride/
  );
  await assert.rejects(
    compactResidentProductEventBufferWebGpu({
      device: null,
      sourceBuffer: {},
      rowCount: 1,
      strideFloats: 32,
      strideBytes: 124
    }),
    /exact current 32-float\/128-byte row stride/
  );
});

test('reaction mutation authority exposes independent state thermo and mechanics components', () => {
  const stateBuffer = { label: 'reaction-state' };
  const thermoBuffer = { label: 'reaction-thermo' };
  const mechanicsBuffer = { label: 'reaction-mechanics' };
  assert.equal(reactionOutputMutatesParticles({ stateBuffer }), true);
  assert.equal(reactionOutputMutatesParticles({ stateBuffer, thermoBuffer }), true);
  assert.equal(reactionOutputMutatesParticles({ stateBuffer, mechanicsBuffer }), true);
  assert.equal(reactionOutputMutatesParticles({ thermoBuffer, mechanicsBuffer }), true);
  assert.equal(reactionOutputMutatesParticles({ stateBuffer, thermoBuffer, mechanicsBuffer }), true);
  assert.deepEqual(reactionOutputComponentMutations({ stateBuffer }), {
    state: true,
    thermo: false,
    mechanics: false,
    any: true,
    complete: false,
    summarySuppressed: false
  });
  assert.deepEqual(reactionOutputComponentMutations({
    thermoBuffer,
    mechanicsBuffer
  }), {
    state: false,
    thermo: true,
    mechanics: true,
    any: true,
    complete: false,
    summarySuppressed: false
  });
  assert.equal(reactionOutputMutatesParticles({
    stateBuffer,
    thermoBuffer,
    mechanicsBuffer,
    reactionSummary: { reactionSummaryAvailable: true, canonicalReactionEventCount: 0 }
  }), false);
});

test('failed post-reaction mechanics refresh destroys retained reaction outputs', () => {
  const destroyed = [];
  const buffer = (label) => ({ label, destroy() { destroyed.push(label); } });
  const residentProductMass = {
    destroyResidentProductMassBuffers() {
      destroyed.push('reaction-product-events');
    }
  };
  assert.equal(destroyReactionOutputAfterFailedMechanicsRefresh({
    stateBuffer: buffer('reaction-state'),
    thermoBuffer: buffer('reaction-thermo'),
    mechanicsBuffer: buffer('reaction-mechanics'),
    residentProductMass
  }), true);
  assert.deepEqual(destroyed, [
    'reaction-state',
    'reaction-thermo',
    'reaction-mechanics',
    'reaction-product-events'
  ]);

  let ownedDestroyCalls = 0;
  assert.equal(destroyReactionOutputAfterFailedMechanicsRefresh({
    stateBuffer: buffer('must-not-destroy-directly'),
    destroyOutputParticleBuffers() {
      ownedDestroyCalls += 1;
    }
  }), true);
  assert.equal(ownedDestroyCalls, 1);
  assert.equal(destroyed.includes('must-not-destroy-directly'), false);
});

test('Schroeder far-force delta fusion emits retained state without full readback', async () => {
  const buffers = manualBuffers({ velocity: [0, 0, 0] });
  const device = fakeSummaryDevice({
    buffer: new ArrayBuffer(buffers.sphParticleState.state.byteLength),
    byteOffset: 0,
    byteLength: buffers.sphParticleState.state.byteLength
  });
  const sourceStateBuffer = device.createBuffer({
    label: 'retained-g2p-state',
    size: buffers.sphParticleState.state.byteLength,
    usage: 0
  });
  const forceApplicationBuffer = device.createBuffer({
    label: 'retained-schroeder-far-force-application',
    size: SCHROEDER_FAR_AGGREGATE_FORCE_APPLICATION_ROW_LAYOUT.length * Float32Array.BYTES_PER_ELEMENT,
    usage: 0
  });
  const schroederFarAggregateForceApplication = {
    schema: ULG_SCHROEDER_FAR_AGGREGATE_FORCE_APPLICATION_EXECUTION_SCHEMA,
    status: 'schroeder-far-aggregate-force-application-submitted',
    forceApplicationRowCount: 1,
    forceApplicationStrideFloats: SCHROEDER_FAR_AGGREGATE_FORCE_APPLICATION_ROW_LAYOUT.length,
    forceApplicationBuffer,
    farAggregateForceApplicationAdmissionApproved: true,
    stateMutationRequired: true
  };

  const params = createSchroederFarForceDeltaFusionParamsArray({
    particleCount: 1,
    forceApplicationRowCount: 1
  });
  const view = new DataView(params);
  assert.equal(params.byteLength, 32);
  assert.equal(view.getUint32(0, true), 1);
  assert.equal(view.getUint32(4, true), 8);
  assert.equal(view.getUint32(8, true), 1);
  assert.equal(view.getUint32(12, true), SCHROEDER_FAR_AGGREGATE_FORCE_APPLICATION_ROW_LAYOUT.length);

  const fusion = await runSchroederFarForceDeltaFusionWebGpu({
    device,
    sphParticleState: buffers.sphParticleState,
    sourceStateBuffer,
    schroederFarAggregateForceApplication,
    readbackMode: 'no-full-readback'
  });

  assert.equal(fusion.schema, ULG_SCHROEDER_FAR_FORCE_DELTA_FUSION_EXECUTION_SCHEMA);
  assert.equal(fusion.status, 'schroeder-far-force-delta-fusion-submitted');
  assert.equal(fusion.readbackMode, 'no-full-readback');
  assert.equal(fusion.fullReadbackPerformed, false);
  assert.equal(fusion.normalHotLoopReadbackFree, true);
  assert.equal(fusion.forceApplicationRowCount, 1);
  assert.equal(fusion.stateBufferByteLength, buffers.sphParticleState.state.byteLength);
  assert.ok(fusion.stateBuffer);
  assert.equal(fusion.stateBuffer.label, 'ulg-schroeder-far-force-delta-fusion-state-out');
  assert.equal(fusion.velocityDeltaFusionStatus, 'admitted-far-force-deltas-applied-to-sph-state-buffer');
  assert.equal(fusion.stateMutationStatus, 'admitted-far-force-delta-fused-state-buffer-submitted');
  assert.equal(fusion.stateAuthorityStatus, 'resident-state-manager-admitted-far-force-delta-state-owner');
  assert.deepEqual(device.dispatches.map((entry) => entry.count), [1, 1]);
  assert.ok(device.shaderModules.some((module) => module.code.includes('fn apply_delta')));
  assert.equal(
    device.createdBuffers.some((buffer) => String(buffer.label).includes('schroeder-far-force-delta-fusion-readback')),
    false
  );
});

test('MLS-MPM resident step runs the full CPU reference chain when WebGPU is not requested', async () => {
  const buffers = manualBuffers();
  const step = await runMlsMpmResidentStepWithOptionalWebGpu({
    ...buffers,
    preferWebGpu: false,
    boxDimsM: [3, 3, 3]
  });

  assert.equal(step.schema, ULG_MLS_MPM_GPU_RESIDENT_STEP_EXECUTION_SCHEMA);
  assert.equal(step.stepSchema, ULG_MLS_MPM_GPU_RESIDENT_STEP_SCHEMA);
  assert.equal(step.backend, 'cpu-reference');
  assert.equal(step.status, 'resident-step-cpu-or-fallback');
  assert.equal(step.stageBackends.p2g, 'cpu-reference');
  assert.equal(step.stageBackends.gridUpdate, 'cpu-reference');
  assert.equal(step.stageBackends.g2p, 'cpu-reference');
  assert.equal(step.readbackMode, 'full-parity-readback');
  assert.equal(step.normalHotLoopReadbackFree, false);
  assert.equal(step.gpuAuthoritativeState, false);
  assert.equal(step.residentBuffersRetained, false);
  assert.equal(step.residentAuthorityLedger.schema, ULG_RESIDENT_STATE_AUTHORITY_LEDGER_SCHEMA);
  assert.equal(step.residentAuthorityLedgerStatus, 'resident-authority-ledger-ready');
  assert.equal(step.residentAuthorityFamilyOwners[RESIDENT_STATE_FAMILIES.PARTICLE_KINEMATICS].ownerStage, 'g2p');
  assert.equal(step.residentAuthorityFamilyOwners[RESIDENT_STATE_FAMILIES.MECHANICS].ownerStage, 'g2p');
  assert.equal(step.diagnostics.residentAuthorityParticleOwner, 'g2p');
  assert.equal(step.diagnostics.particleCount, 1);
  assert.equal(step.diagnostics.sourceMassKg, 8);
  assert.equal(step.diagnostics.massDeltaKg, 0);
  assert.ok(step.state instanceof Float32Array);
  assert.ok(step.mechanics instanceof Float32Array);
  assert.equal(step.fullPhysicsValidation, false);
});

test('MLS-MPM resident step derives wall barrier policy from algorithm contact rows', async () => {
  const buffers = manualBuffers({
    position: [1.25, 0.25, 1.25],
    velocity: [0, -3, 0],
    smoothingLengthM: 0.5,
    mechanicsDtS: 0.1,
    algorithmMaterialContactRows: algorithmContactRowsFixture({ normalStiffnessPa: 6.5e6 })
  });
  const step = await runMlsMpmResidentStepWithOptionalWebGpu({
    ...buffers,
    preferWebGpu: false,
    gridSpacingM: 0.5,
    boxDimsM: [3, 3, 3],
    dt: 0.1,
    gravityMPerS2: [0, 0, 0],
    cflFactor: 10
  });

  assert.equal(step.gridUpdate.wallBarrierElasticStiffnessSource, 'algorithm-contact-row-normal-stiffness-support');
  assert.equal(
    step.gridUpdate.wallBarrierContactMaterialPolicyStatus,
    'wall-barrier-contact-material-policy-algorithm-contact-row'
  );
  assert.equal(step.gridUpdate.wallBarrierContactAlgorithmPairKey, 'drop:Na|base:h2o');
  assert.equal(step.gridUpdate.wallBarrierContactAlgorithmNormalStiffnessPa, 6.5e6);
  assert.equal(step.wallBarrierContactMaterialPolicyStatus, 'wall-barrier-contact-material-policy-algorithm-contact-row');
  assert.equal(step.wallBarrierContactAlgorithmPairKey, 'drop:Na|base:h2o');
  assert.equal(step.diagnostics.wallBarrierContactMaterialPolicyStatus, 'wall-barrier-contact-material-policy-algorithm-contact-row');
});

test('MLS-MPM resident step preserves shifted grid origin into G2P', async () => {
  const buffers = manualBuffers({
    position: [2.5, 2.5, 2.5],
    velocity: [0, 0, 0],
    smoothingLengthM: 1,
    mechanicsDtS: 0.01
  });
  const gravity = [0, -9.80665, 0];
  const step = await runMlsMpmResidentStepWithOptionalWebGpu({
    ...buffers,
    preferWebGpu: false,
    gridSpacingM: 1,
    boxDimsM: [3, 3, 3],
    dt: 0.01,
    gravityMPerS2: gravity,
    cflFactor: 10
  });

  assert.equal(step.gridUpdate.gridShift, 1);
  assert.equal(step.g2pReconstruction.gridShift, 1);
  nearlyEqual(step.state[5], gravity[1] * 0.01, 1e-6);
  nearlyEqual(step.state[1], 2.5 + gravity[1] * 0.01 * 0.01, 1e-6);
});

test('MLS-MPM grid update blocks pressure-interface force rows without admitted grid-force approval', () => {
  const buffers = manualBuffers({
    position: [2, 2, 2],
    velocity: [0, 0, 0],
    mechanicsDtS: 0.25
  });
  const projection = projectMlsMpmP2gGridCpu({
    ...buffers,
    gridSpacingM: 1,
    boxDimsM: [5, 5, 5]
  });
  const pressureInterfaceForceSolver = pressureInterfaceForceSolverFixture({
    centroid: [2, 2, 2],
    forceApplicationStatus: 'apply-to-mls-mpm-grid',
    gridForceApplicationApproved: true
  });
  const update = updateMlsMpmGridCpu({
    p2gGridProjection: projection,
    dt: 0.25,
    gravityMPerS2: [0, 0, 0],
    boxDimsM: [5, 5, 5],
    cflFactor: 10,
    pressureInterfaceForceSolver
  });

  assert.equal(update.pressureInterfaceForceSolverSchema, ULG_SPH_PRESSURE_INTERFACE_FORCE_SOLVER_SCHEMA);
  assert.equal(update.pressureInterfaceGridForceAdmissionApproved, false);
  assert.equal(update.pressureInterfaceGridForceAdmissionStatus, 'pressure-interface-grid-force-consumption-blocked');
  assert.equal(update.pressureInterfaceForceApplicationStatus, 'pressure-interface-grid-force-consumer-blocked-not-approved');
  assert.equal(update.pressureInterfaceForceConsumerStatus, 'blocked-pressure-force-solver-not-approved-for-grid-application');
  assert.equal(update.pressureInterfaceForceRowCount, 0);
  assert.equal(update.pressureInterfaceAppliedImpulseMagnitudeNSeconds, 0);
});

test('MLS-MPM grid update consumes admitted pressure-interface force rows as grid impulses', () => {
  const buffers = manualBuffers({
    position: [2, 2, 2],
    velocity: [0, 0, 0],
    mechanicsDtS: 0.25
  });
  const projection = projectMlsMpmP2gGridCpu({
    ...buffers,
    gridSpacingM: 1,
    boxDimsM: [5, 5, 5]
  });
  const pressureInterfaceForceSolver = pressureInterfaceForceSolverFixture({
    centroid: [2, 2, 2],
    forceApplicationStatus: 'apply-to-mls-mpm-grid',
    gridForceApplicationApproved: true
  });
  const pressureInterfaceGridForceAdmission = pressureInterfaceGridForceAdmissionFixture();
  const update = updateMlsMpmGridCpu({
    p2gGridProjection: projection,
    dt: 0.25,
    gravityMPerS2: [0, 0, 0],
    boxDimsM: [5, 5, 5],
    cflFactor: 10,
    pressureInterfaceForceSolver,
    pressureInterfaceGridForceAdmission
  });
  const sourceCenterOffset = nodeOffset(projection, 2, 2, 2, projection.gridNodeStrideFloats);
  const centerOffset = nodeOffset(update, 2, 2, 2, update.gridNodeStrideFloats);
  const centerWeight = 0.75 ** 3;
  const expectedCenterImpulse = 0.25 * 8 * centerWeight;
  const expectedCenterVelocity = expectedCenterImpulse / projection.gridNodes[sourceCenterOffset];

  assert.equal(update.schema, ULG_MLS_MPM_GPU_GRID_UPDATE_SCHEMA);
  assert.equal(update.pressureInterfaceForceSolverSchema, ULG_SPH_PRESSURE_INTERFACE_FORCE_SOLVER_SCHEMA);
  assert.equal(update.pressureInterfaceForceSolverStatus, 'pressure-interface-force-solver-ready');
  assert.equal(update.pressureInterfaceGridForceAdmissionApproved, true);
  assert.equal(update.pressureInterfaceGridForceAdmissionStatus, 'pressure-interface-grid-force-consumption-approved');
  assert.equal(update.pressureInterfaceGridForceAdmissionSourceHotBufferKey, 'ulg:test:pressure-interface-admitted-hot-buffer');
  assert.equal(update.pressureInterfaceForceCouplingStatus, 'pressure-force-solver-ready-not-applied');
  assert.equal(update.pressureInterfaceForceApplicationStatus, 'pressure-interface-grid-force-consumer-applied');
  assert.equal(update.pressureInterfaceForceConsumerStatus, 'grid-momentum-impulse-consumed');
  assert.equal(update.pressureInterfaceAppliedImpulseSource, 'grid-node-distributed-impulse');
  assert.equal(update.pressureInterfaceImpulseProofStatus, 'actual-grid-node-impulse');
  assert.equal(update.pressureInterfaceForceRowCount, 1);
  nearlyEqual(update.pressureInterfaceAppliedImpulseNSeconds[0], 2, 1e-5);
  nearlyEqual(update.pressureInterfaceAppliedImpulseMagnitudeNSeconds, 2, 1e-5);
  nearlyEqual(update.updatedGridNodes[centerOffset], projection.gridNodes[sourceCenterOffset], 1e-5);
  nearlyEqual(update.updatedGridNodes[centerOffset + 1], expectedCenterVelocity, 1e-5);
  nearlyEqual(update.updatedGridNodes[centerOffset + 2], 0, 1e-6);
  nearlyEqual(update.updatedGridNodes[centerOffset + 3], 0, 1e-6);
});

test('MLS-MPM grid update optional WebGPU path forwards pressure force rows', async () => {
  const buffers = manualBuffers({
    position: [1, 1, 1],
    velocity: [0, 0, 0],
    mechanicsDtS: 0.25
  });
  const projection = projectMlsMpmP2gGridCpu({
    ...buffers,
    gridSpacingM: 1,
    boxDimsM: [3, 3, 3]
  });
  const pressureInterfaceForceSolver = pressureInterfaceForceSolverFixture({
    forceApplicationStatus: 'apply-to-mls-mpm-grid',
    gridForceApplicationApproved: true
  });
  const pressureInterfaceGridForceAdmission = pressureInterfaceGridForceAdmissionFixture();
  const pressureInterfaceForceRowsBuffer = { label: 'pressure-interface-force-rows' };
  let runnerCalls = 0;
  const execution = await runMlsMpmGridUpdateWithOptionalWebGpu({
    p2gGridProjection: projection,
    pressureInterfaceForceRowsBuffer,
    pressureInterfaceForceSolver,
    pressureInterfaceGridForceAdmission,
    dt: 0.25,
    gravityMPerS2: [0, 0, 0],
    boxDimsM: [5, 5, 5],
    cflFactor: 10,
    preferWebGpu: true,
    navigatorRef: webGpuNavigator(),
    webGpuRunner(args) {
      runnerCalls += 1;
      assert.equal(args.pressureInterfaceForceRowsBuffer, pressureInterfaceForceRowsBuffer);
      assert.equal(args.pressureInterfaceForceSolver, pressureInterfaceForceSolver);
      assert.equal(args.pressureInterfaceGridForceAdmission, pressureInterfaceGridForceAdmission);
      const result = updateMlsMpmGridCpu(args);
      return { ...result, backend: 'webgpu' };
    }
  });

  assert.equal(runnerCalls, 1);
  assert.equal(execution.backend, 'webgpu');
  assert.equal(execution.webgpuStatus.status, 'webgpu-executed');
  assert.equal(execution.pressureInterfaceForceSolverSchema, ULG_SPH_PRESSURE_INTERFACE_FORCE_SOLVER_SCHEMA);
  assert.equal(execution.pressureInterfaceGridForceAdmissionApproved, true);
  assert.equal(execution.pressureInterfaceForceApplicationStatus, 'pressure-interface-grid-force-consumer-applied');
  assert.equal(execution.pressureInterfaceForceConsumerStatus, 'grid-momentum-impulse-consumed');
  assert.equal(execution.pressureInterfaceAppliedImpulseSource, 'grid-node-distributed-impulse');
  assert.equal(execution.pressureInterfaceImpulseProofStatus, 'actual-grid-node-impulse');
  assert.equal(execution.pressureInterfaceForceRowCount, 1);
  nearlyEqual(execution.pressureInterfaceAppliedImpulseNSeconds[0], 2, 1e-5);
});

test('MLS-MPM resident step replaces admitted render-surface rows with uniform condensed P2G stress', async () => {
  const buffers = manualBuffers({
    position: [1, 1, 1],
    velocity: [0, 0, 0],
    mechanicsDtS: 0.25
  });
  const pressureInterfaceForceSolver = pressureInterfaceForceSolverFixture({
    forceApplicationStatus: 'apply-to-mls-mpm-grid',
    gridForceApplicationApproved: true
  });
  Object.assign(pressureInterfaceForceSolver, {
    pressureFieldMode: 'uniform-single-cell-sealed-gas',
    localPressureGradientReady: false,
    gasInterfaceGaugePressurePa: 100,
    uniformGaugePressureStressEligible: true,
    uniformGaugePressureStressPa: 100,
    uniformGaugePressureStressRangePa: [100, 100],
    uniformGaugePressureStressSource: 'uniform-sealed-gas-pressure'
  });
  buffers.sphParticleState.thermo[4] = 1;
  const pressureInterfaceGridForceAdmission = pressureInterfaceGridForceAdmissionFixture();
  const step = await runMlsMpmResidentStepWithOptionalWebGpu({
    ...buffers,
    preferWebGpu: false,
    boxDimsM: [3, 3, 3],
    dt: 0.25,
    gravityMPerS2: [0, 0, 0],
    cflFactor: 10,
    pressureInterfaceForceSolver,
    pressureInterfaceGridForceAdmission
  });

  assert.equal(step.schema, ULG_MLS_MPM_GPU_RESIDENT_STEP_EXECUTION_SCHEMA);
  assert.equal(step.gridUpdate.pressureInterfaceForceSolverSchema, null);
  assert.equal(step.gridUpdate.pressureInterfaceGridForceAdmissionApproved, false);
  assert.equal(step.gridUpdate.pressureInterfaceForceRowCount, 0);
  assert.equal(step.pressureInterfaceForceSolver, pressureInterfaceForceSolver);
  assert.equal(step.pressureInterfaceForceSolverSchema, ULG_SPH_PRESSURE_INTERFACE_FORCE_SOLVER_SCHEMA);
  assert.equal(step.pressureInterfaceGridForceAdmissionApproved, false);
  assert.equal(step.pressureInterfaceForceApplicationStatus, 'applied-as-condensed-particle-p2g-stress');
  assert.equal(step.uniformGaugePressureStressAdmissionApproved, true);
  assert.equal(step.uniformGaugePressureStressPa, 100);
  assert.equal(step.pressureInterfaceLegacySurfaceTractionSuppressed, true);
  assert.equal(step.p2gGridProjection.externalGaugePressureEnabled, true);
  assert.equal(step.p2gGridProjection.externalGaugePressurePa, 100);
  assert.equal(step.diagnostics.pressureInterfaceForceApplicationStatus, 'applied-as-condensed-particle-p2g-stress');
  assert.equal(step.diagnostics.uniformGaugePressureStressAdmissionApproved, true);
  assert.equal(step.diagnostics.pressureInterfaceForceRowCount, 0);
  nearlyEqual(step.diagnostics.pressureInterfaceAppliedImpulseNSeconds[0], 0, 1e-5);
});

test('MLS-MPM grid-update stage task consumes admitted pressure-interface rows with evidence', async () => {
  const buffers = manualBuffers({
    position: [1, 1, 1],
    velocity: [0, 0, 0],
    mechanicsDtS: 0.25
  });
  const projection = projectMlsMpmP2gGridCpu({
    ...buffers,
    gridSpacingM: 1,
    boxDimsM: [3, 3, 3]
  });
  const pressureInterfaceForceSolver = pressureInterfaceForceSolverFixture({
    forceApplicationStatus: 'apply-to-mls-mpm-grid',
    gridForceApplicationApproved: true
  });
  const pressureInterfaceGridForceAdmission = pressureInterfaceGridForceAdmissionFixture();
  const task = createMlsMpmMechanicsGridUpdateStageComputeTask({
    p2gGridProjection: projection,
    modulePath: './sphMlsMpmGpuStep.js',
    taskId: 'ulg:test:grid-update-pressure-admitted',
    pressureInterfaceForceSolver,
    pressureInterfaceGridForceAdmission,
    dt: 0.25,
    gravityMPerS2: [0, 0, 0],
    boxDimsM: [3, 3, 3],
    cflFactor: 10,
    preferWebGpu: false
  });

  assert.equal(task.schema, ULG_MLS_MPM_MECHANICS_GRID_UPDATE_STAGE_COMPUTE_TASK_SCHEMA);
  assert.equal(task.data.pressureInterfaceForceSolver, pressureInterfaceForceSolver);
  assert.equal(task.data.pressureInterfaceGridForceAdmission, pressureInterfaceGridForceAdmission);

  const result = await runMlsMpmMechanicsGridUpdateStageComputeTask(task.data);

  assert.equal(result.computeTaskResultSchema, ULG_MLS_MPM_MECHANICS_GRID_UPDATE_STAGE_COMPUTE_TASK_RESULT_SCHEMA);
  assert.equal(result.computeTaskSchema, ULG_MLS_MPM_MECHANICS_GRID_UPDATE_STAGE_COMPUTE_TASK_SCHEMA);
  assert.equal(result.pressureInterfaceGridForceAdmissionApproved, true);
  assert.equal(result.pressureInterfaceForceApplicationStatus, 'pressure-interface-grid-force-consumer-applied');
  assert.equal(result.pressureInterfaceForceConsumerStatus, 'grid-momentum-impulse-consumed');
  assert.equal(result.pressureInterfaceImpulseProofStatus, 'actual-grid-node-impulse');
  assert.equal(result.mechanicsGridUpdateStageTaskEvidence.passed, true);
  assert.equal(result.mechanicsGridUpdateStageTaskEvidence.pressureInterface.suppressed, false);
  assert.equal(result.mechanicsGridUpdateStageTaskEvidence.pressureInterface.admittedAndApproved, true);
  assert.equal(result.mechanicsGridUpdateStageTaskAuthority.authoritativeStateMutation, false);
});

test('MLS-MPM resident summary WebGPU runner uses two-pass compact readback', async () => {
  const particleCount = 65;
  const gridNodeCount = 130;
  const summaryValues = new Float32Array([
    particleCount, gridNodeCount, 17, 12,
    12, 0, 4, 5,
    6, 7, 8, 9,
    3, 3, 3, 2.5,
    0.125, 0.9, 1.1, 1,
    5, 4, 2, 1,
    450, 273, 900, 65,
    0, 65, 12, 1,
    1, 2, 3, 4,
    5, 6, -1, -2,
    -3, 7, 8, 9,
    0, 0.5, 1, 10,
    11, 12, 1, 1,
    12, 12, 0, 0,
    1, 0, 10, 10,
    20, 12, 1, 2,
    3, -1, -2, -3,
    7, 8, 9, 2.5,
    4, 4, 5, 6,
    0, 0.5, 1, 10,
    11, 12, 1.5, 0,
    1.25, 410, 2.5, 1
  ]);
  const device = fakeSummaryDevice(summaryValues);
  const tracker = fakeBufferTracker();
  const sourceStateBuffer = tracker.buffer('source-state');
  const sourceThermoBuffer = tracker.buffer('source-thermo');
  const retainedThermoBuffer = tracker.buffer('retained-thermal-thermo');
  const sourceMechanicsBuffer = tracker.buffer('source-mechanics');
  const nextStateBuffer = tracker.buffer('next-state');
  const nextMechanicsBuffer = tracker.buffer('next-mechanics');
  const updatedGridBuffer = tracker.buffer('updated-grid');
  const summary = await runMlsMpmResidentSummaryWebGpu({
    device,
    sphParticleState: {
      schema: ULG_SPH_GPU_PARTICLE_BUFFER_SCHEMA,
      particleCount,
      state: new Float32Array(particleCount * 8)
    },
    mlsMpmParticleState: {
      schema: ULG_MLS_MPM_GPU_PARTICLE_BUFFER_SCHEMA,
      particleCount,
      mechanics: new Float32Array(particleCount * MLS_MPM_GPU_PARTICLE_MECHANICS_ROW_LAYOUT.length)
    },
    sphParticleUpload: {
      status: 'webgpu-uploaded',
      stateBuffer: sourceStateBuffer,
      thermoBuffer: sourceThermoBuffer
    },
    mlsMpmParticleUpload: {
      status: 'webgpu-uploaded',
      mechanicsBuffer: sourceMechanicsBuffer
    },
    gridUpdate: {
      gridNodeCount,
      gpuResult: { updatedGridBuffer }
    },
    g2pReconstruction: {
      stateBuffer: nextStateBuffer,
      mechanicsBuffer: nextMechanicsBuffer
    },
    thermalStep: {
      result: {
        thermoBuffer: retainedThermoBuffer
      }
    }
  });

  assert.equal(summary.status, 'compact-summary-ready');
  assert.equal(summary.reductionStrategy, 'two-pass-workgroup-reduction');
  assert.equal(summary.compactPartialSummaryCount, 5);
  assert.equal(summary.compactPartialSummaryByteLength, 5 * MLS_MPM_GPU_RESIDENT_SUMMARY_BYTES);
  assert.equal(summary.compactReductionWorkgroupSize, 32);
  assert.equal(summary.compactReadbackByteLength, MLS_MPM_GPU_RESIDENT_SUMMARY_BYTES);
  assert.equal(summary.compactReadbackFloatCount, MLS_MPM_GPU_RESIDENT_SUMMARY_FLOATS);
  assert.equal(summary.queueCompletionStatus, 'readback-map-completed');
  assert.equal(summary.queueCompletionMethod, 'mapAsync(readback-buffer)');
  assert.equal(summary.timing.schema, 'peercompute.ulg.mls-mpm-resident-summary-timing.v0');
  assert.equal(summary.timing.queueFenceAttribution, 'mapAsync(readback-buffer)-may-include-prior-queued-resident-work');
  assert.equal(summary.timing.compactReadbackByteLength, MLS_MPM_GPU_RESIDENT_SUMMARY_BYTES);
  assert.equal(summary.timing.summaryKernelDispatchCount, 2);
  assert.equal(summary.timing.summaryWorkgroupCount, 6);
  assert.equal(Number.isFinite(summary.timing.mapAsyncWaitMs), true);
  assert.equal(summary.mapAsyncWaitMs, summary.timing.mapAsyncWaitMs);
  assert.equal(summary.queueFenceAttribution, summary.timing.queueFenceAttribution);
  assert.equal(summary.sourceStateBufferMode, 'borrowed-webgpu-upload');
  assert.equal(summary.thermoBufferMode, 'retained-thermal-output');
  assert.equal(summary.sourceMechanicsBufferMode, 'borrowed-webgpu-upload');
  assert.equal(summary.summaryScope, 'full');
  assert.equal(summary.gridNodeScanCount, gridNodeCount);
  assert.equal(summary.gridNodeScanSkipped, false);
  assert.equal(summary.activeGridNodeCountAvailable, true);
  assert.equal(summary.activeGridNodeSummaryStatus, 'active-grid-node-summary-ready');
  assert.equal(summary.activeGridNodeCount, 17);
  assert.equal(summary.massDeltaKg, 0);
  assert.deepEqual(summary.momentumDeltaKgMPerS, [3, 3, 3]);
  assert.deepEqual(summary.sourceCenterOfMassM, [1, 2, 3]);
  assert.deepEqual(summary.nextCenterOfMassM, [4, 5, 6]);
  assert.deepEqual(summary.centerOfMassDeltaM, [3, 3, 3]);
  assert.deepEqual(summary.sourcePositionBoundsM, {
    status: 'position-bounds-ready',
    min: [-1, -2, -3],
    max: [7, 8, 9],
    massKg: 12
  });
  assert.deepEqual(summary.nextPositionBoundsM, {
    status: 'position-bounds-ready',
    min: [0, 0.5, 1],
    max: [10, 11, 12],
    massKg: 12
  });
  assert.equal(summary.cohortSummaryAvailable, true);
  assert.equal(summary.cohortDiagnostics.status, 'cohort-summary-ready');
  assert.equal(summary.cohortDiagnostics.readbackRequired, false);
  assert.equal(summary.cohortDiagnostics.base.status, 'cohort-summary-ready');
  assert.equal(summary.cohortDiagnostics.base.startIndex, 0);
  assert.equal(summary.cohortDiagnostics.base.endIndex, 10);
  assert.equal(summary.cohortDiagnostics.base.count, 10);
  assert.equal(summary.cohortDiagnostics.base.massKg, 12);
  assert.deepEqual(summary.cohortDiagnostics.base.centerOfMassM, [1, 2, 3]);
  assert.deepEqual(summary.cohortDiagnostics.base.boundsM.min, [-1, -2, -3]);
  assert.deepEqual(summary.cohortDiagnostics.base.boundsM.max, [7, 8, 9]);
  assert.equal(summary.cohortDiagnostics.base.maxSpeedMPerS, 2.5);
  assert.equal(summary.cohortDiagnostics.drop.status, 'cohort-summary-ready');
  assert.equal(summary.cohortDiagnostics.drop.startIndex, 10);
  assert.equal(summary.cohortDiagnostics.drop.endIndex, 20);
  assert.equal(summary.cohortDiagnostics.drop.count, 10);
  assert.equal(summary.cohortDiagnostics.drop.massKg, 4);
  assert.deepEqual(summary.cohortDiagnostics.drop.centerOfMassM, [4, 5, 6]);
  assert.deepEqual(summary.cohortDiagnostics.drop.boundsM.min, [0, 0.5, 1]);
  assert.deepEqual(summary.cohortDiagnostics.drop.boundsM.max, [10, 11, 12]);
  assert.equal(summary.cohortDiagnostics.drop.maxSpeedMPerS, 1.5);
  assert.deepEqual(summary.phaseMassKg, { solid: 5, liquid: 4, gas: 2, plasma: 1 });
  assert.equal(summary.temperatureMassWeightedMeanK, 450);
  assert.equal(summary.minTemperatureK, 273);
  assert.equal(summary.maxTemperatureK, 900);
  assert.equal(summary.thermalReadyCount, 65);
  assert.equal(summary.thermalProblemCount, 0);
  assert.equal(summary.thermalPhaseSummaryAvailable, true);
  assert.equal(summary.residentPhaseGasSpeciesSummary.status, 'resident-phase-gas-species-summary-ready');
  assert.deepEqual(summary.residentPhaseGasSpeciesSummary.bySpecies.h2o, {
    material: 'h2o',
    massKg: 1.25,
    temperatureK: 410,
    phaseWeight: 2.5,
    status: 'resident-phase-gas-species-ready'
  });
  assert.deepEqual(device.dispatches.map((entry) => entry.count), [5, 1]);
  assert.equal(device.bindGroups.length, 2);
  assert.equal(device.bindGroups[0].entries.length, 8);
  assert.equal(device.bindGroups[1].entries.length, 3);
  assert.equal(device.copies.length, 1);
  assert.equal(device.copies[0].size, MLS_MPM_GPU_RESIDENT_SUMMARY_BYTES);
  assert.equal(device.writes[0].byteLength, 48);
  assert.equal(device.createdBuffers.find((buffer) => buffer.label === 'ulg-mls-mpm-resident-summary-partials').size, 5 * MLS_MPM_GPU_RESIDENT_SUMMARY_BYTES);
  assert.equal(device.createdBuffers.find((buffer) => buffer.label === 'ulg-mls-mpm-resident-summary-readback').unmapped, true);
  assert.equal(summary.compactSummaryBufferAuthority, 'diagnostics-only');
  assert.equal(summary.residentBufferLeaseLedgerStatus, 'resident-buffer-lease-ledger-cleaned');
  assert.equal(summary.residentBufferLeaseResourceCount, 3);
  assert.equal(summary.residentBufferLeaseActiveLeaseCount, 0);
  assert.equal(summary.residentBufferLeaseSummary.destroyedResourceCount, 3);
  assert.equal(device.createdBuffers.every((buffer) => buffer.destroyed), true);
});

test('MLS-MPM resident summary packs v2 cohort ranges in lineage space', async () => {
  const lineageCapacity = 2;
  const phaseLaneCount = 4;
  const particleCount = lineageCapacity * phaseLaneCount;
  const summaryValues = new Float32Array(MLS_MPM_GPU_RESIDENT_SUMMARY_FLOATS);
  const device = fakeSummaryDevice(summaryValues);
  const tracker = fakeBufferTracker();
  const phaseCarrierPlan = {
    schema: 'peercompute.ulg.sph-phase-carrier-plan.v2',
    status: 'phase-lane-capacity-ready',
    lineageCapacity,
    primaryCapacity: lineageCapacity,
    phaseLaneCount,
    phaseLaneStride: lineageCapacity,
    companionStart: lineageCapacity,
    companionCapacity: lineageCapacity * (phaseLaneCount - 1),
    particleCapacity: particleCount
  };

  await runMlsMpmResidentSummaryWebGpu({
    device,
    cohortRanges: {
      base: { startIndex: -100, endIndex: 1 },
      drop: { startIndex: 1, endIndex: 100 }
    },
    sphParticleState: {
      schema: ULG_SPH_GPU_PARTICLE_BUFFER_SCHEMA,
      particleCount,
      phaseCarrierPlan,
      state: new Float32Array(particleCount * 8),
      thermo: new Float32Array(particleCount * 12)
    },
    mlsMpmParticleState: {
      schema: ULG_MLS_MPM_GPU_PARTICLE_BUFFER_SCHEMA,
      particleCount,
      mechanics: new Float32Array(
        particleCount * MLS_MPM_GPU_PARTICLE_MECHANICS_ROW_LAYOUT.length
      )
    },
    sphParticleUpload: {
      status: 'webgpu-uploaded',
      phaseCarrierPlan,
      stateBuffer: tracker.buffer('v2-source-state'),
      thermoBuffer: tracker.buffer('v2-source-thermo')
    },
    mlsMpmParticleUpload: {
      status: 'webgpu-uploaded',
      mechanicsBuffer: tracker.buffer('v2-source-mechanics')
    },
    gridUpdate: {
      gridNodeCount: 0,
      gpuResult: { updatedGridBuffer: tracker.buffer('v2-updated-grid') }
    },
    g2pReconstruction: {
      stateBuffer: tracker.buffer('v2-next-state'),
      mechanicsBuffer: tracker.buffer('v2-next-mechanics')
    }
  });

  const paramsWrite = device.writes.find(
    (write) => write.label === 'ulg-mls-mpm-resident-summary-params'
  );
  assert.ok(paramsWrite);
  assert.equal(paramsWrite.byteLength, 48);
  const params = new DataView(paramsWrite.data);
  assert.equal(params.getUint32(0, true), particleCount);
  assert.equal(params.getUint32(12, true), 0);
  assert.equal(params.getUint32(16, true), 1);
  assert.equal(params.getUint32(20, true), 1);
  assert.equal(params.getUint32(24, true), lineageCapacity);
  assert.equal(params.getUint32(32, true), lineageCapacity);
  assert.equal(params.getUint32(36, true), phaseLaneCount);
  assert.equal(params.getUint32(40, true), 0);
  assert.equal(params.getUint32(44, true), 0);

  const partialsShader = device.shaderModules.find((module) => (
    module.code.includes('phase_lineage_capacity')
    && module.code.includes('partial_summaries')
  ))?.code || '';
  assert.match(partialsShader, /params\.phase_lineage_capacity \* params\.phase_lane_count == params\.particle_count/);
  assert.match(partialsShader, /index % max\(params\.phase_lineage_capacity, 1u\)/);
  assert.match(partialsShader, /cohort_index >= params\.base_start_index/);
});

test('native four-lane resident summary keeps a live companion and ignores poisoned dormant lanes', {
  skip: RUN_NATIVE_PHASE_LINEAGE_SUMMARY
    ? false
    : 'set ULG_RUN_NATIVE_PHASE_LINEAGE_SUMMARY=1 for native WebGPU readback',
  timeout: 120_000
}, async () => {
  const { chromium } = await import('@playwright/test');
  const browser = await chromium.launch({
    executablePath: process.env.ULG_PHASE_LINEAGE_SUMMARY_CHROME || '/usr/bin/google-chrome',
    headless: true,
    args: [
      '--use-angle=vulkan',
      '--enable-features=Vulkan,UseSkiaRenderer',
      '--enable-unsafe-webgpu',
      '--ignore-gpu-blocklist'
    ]
  });

  let native;
  try {
    const page = await browser.newPage({ ignoreHTTPSErrors: true });
    await page.goto(NATIVE_PHASE_LINEAGE_SUMMARY_BASE_URL, {
      waitUntil: 'domcontentloaded',
      timeout: 60_000
    });
    native = await page.evaluate(async () => {
      const adapter = await navigator.gpu?.requestAdapter({ powerPreference: 'high-performance' });
      if (!adapter) return { status: 'unsupported', reason: 'WebGPU adapter unavailable' };
      const device = await adapter.requestDevice();
      const uncapturedErrors = [];
      device.addEventListener('uncapturederror', (event) => {
        uncapturedErrors.push(event.error?.message || String(event.error));
      });
      device.pushErrorScope('validation');
      const nonce = Date.now();
      const summaryModule = await import(
        `/src/runtime/sph/sphMlsMpmGpuSummary.js?nativePhaseLineageSummary=${nonce}`
      );
      const abi = await import(`/ulg-gpu-abi/src/index.js?nativePhaseLineageSummary=${nonce}`);
      const particleCount = 8;
      const lineageCapacity = 2;
      const phaseLaneCount = 4;
      const livePhysicalIndex = 3 * lineageCapacity;
      const sourceState = new Float32Array(particleCount * 8);
      const nextState = new Float32Array(particleCount * 8);
      const thermo = new Float32Array(particleCount * 12);
      const mechanics = new Float32Array(particleCount * 32);
      for (let index = 0; index < particleCount; index += 1) {
        mechanics[index * 32 + 18] = 1;
        mechanics[index * 32 + 19] = 1;
      }
      sourceState.set([1000, 1000, 1000, 0, 100000, -200000, 300000, 1e12], 0);
      nextState.set([-1000, -1000, -1000, 0, -400000, 500000, -600000, -1e12], 0);
      thermo.set([1, 1, 1000000, 1e12, 1, 0, 0, 0, 0.1, 1, 0, 0], 0);
      mechanics[18] = 0.000001;
      mechanics[32 + 18] = 999;
      sourceState.set([2, 3, 4, 7, 1, -2, 0.5, 100], livePhysicalIndex * 8);
      nextState.set([2, 3, 4, 7, 1, -2, 0.5, 100], livePhysicalIndex * 8);
      thermo.set([1, 4, 0, 1, 0, 0, 0, 1, 0.1, 1, 1, 0], livePhysicalIndex * 12);
      const phaseCarrierPlan = {
        schema: 'peercompute.ulg.sph-phase-carrier-plan.v2',
        status: 'phase-lane-capacity-ready',
        lineageCapacity,
        primaryCapacity: lineageCapacity,
        phaseLaneCount,
        phaseLaneStride: lineageCapacity,
        companionStart: lineageCapacity,
        companionCapacity: lineageCapacity * (phaseLaneCount - 1),
        particleCapacity: particleCount
      };
      const upload = (label, values) => {
        const buffer = device.createBuffer({
          label,
          size: Math.max(16, values.byteLength),
          usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
        });
        if (values.byteLength > 0) device.queue.writeBuffer(buffer, 0, values);
        return buffer;
      };
      const sourceStateBuffer = upload('phase-lineage-source-state', sourceState);
      const nextStateBuffer = upload('phase-lineage-next-state', nextState);
      const thermoBuffer = upload('phase-lineage-thermo', thermo);
      const mechanicsBuffer = upload('phase-lineage-mechanics', mechanics);
      const updatedGridBuffer = upload('phase-lineage-grid', new Float32Array(8));
      let summary;
      try {
        summary = await summaryModule.runMlsMpmResidentSummaryWebGpu({
          device,
          cohortRanges: {
            base: { startIndex: 0, endIndex: 1 },
            drop: { startIndex: 1, endIndex: 2 }
          },
          sphParticleState: {
            schema: abi.ULG_SPH_GPU_PARTICLE_BUFFER_SCHEMA,
            particleCount,
            phaseCarrierPlan,
            state: sourceState,
            thermo
          },
          mlsMpmParticleState: {
            schema: abi.ULG_MLS_MPM_GPU_PARTICLE_BUFFER_SCHEMA,
            particleCount,
            mechanics
          },
          sphParticleUpload: {
            status: 'webgpu-uploaded',
            phaseCarrierPlan,
            stateBuffer: sourceStateBuffer,
            thermoBuffer
          },
          mlsMpmParticleUpload: {
            status: 'webgpu-uploaded',
            mechanicsBuffer
          },
          gridUpdate: {
            gridNodeCount: 1,
            gpuResult: { updatedGridBuffer }
          },
          g2pReconstruction: {
            stateBuffer: nextStateBuffer,
            mechanicsBuffer
          }
        });
        await device.queue.onSubmittedWorkDone();
        const validationError = await device.popErrorScope();
        return {
          status: 'complete',
          validationError: validationError?.message || null,
          uncapturedErrors,
          base: summary.cohortDiagnostics.base,
          drop: summary.cohortDiagnostics.drop,
          sourceMassKg: summary.sourceMassKg,
          nextMassKg: summary.nextMassKg,
          maxSpeedMPerS: summary.maxSpeedMPerS,
          maxDisplacementM: summary.maxDisplacementM,
          minVolumeRatioJ: summary.minVolumeRatioJ,
          maxVolumeRatioJ: summary.maxVolumeRatioJ,
          minTemperatureK: summary.minTemperatureK,
          maxTemperatureK: summary.maxTemperatureK,
          finiteTemperatureCount: summary.finiteTemperatureCount,
          thermalReadyCount: summary.thermalReadyCount,
          thermalProblemCount: summary.thermalProblemCount,
          livePhysicalIndex
        };
      } finally {
        sourceStateBuffer.destroy();
        nextStateBuffer.destroy();
        thermoBuffer.destroy();
        mechanicsBuffer.destroy();
        updatedGridBuffer.destroy();
        device.destroy();
      }
    });
  } finally {
    await browser.close();
  }

  assert.equal(native.status, 'complete', native.reason || 'native WebGPU did not run');
  assert.equal(native.validationError, null);
  assert.deepEqual(native.uncapturedErrors, []);
  assert.equal(native.livePhysicalIndex, 6);
  assert.equal(native.sourceMassKg, 7);
  assert.equal(native.nextMassKg, 7);
  nearlyEqual(native.maxSpeedMPerS, Math.sqrt(5.25));
  assert.equal(native.maxDisplacementM, 0);
  assert.equal(native.minVolumeRatioJ, 1);
  assert.equal(native.maxVolumeRatioJ, 1);
  assert.equal(native.minTemperatureK, 0);
  assert.equal(native.maxTemperatureK, 0);
  assert.equal(native.finiteTemperatureCount, 1);
  assert.equal(native.thermalReadyCount, 1);
  assert.equal(native.thermalProblemCount, 0);
  assert.equal(native.base.status, 'cohort-summary-ready');
  assert.equal(native.base.startIndex, 0);
  assert.equal(native.base.endIndex, 1);
  assert.equal(native.base.count, 1);
  assert.equal(native.base.massKg, 7);
  native.base.centerOfMassM.forEach((value, axis) => {
    nearlyEqual(value, [2, 3, 4][axis]);
  });
  assert.equal(native.drop.status, 'cohort-summary-empty');
  assert.equal(native.drop.massKg, 0);
});

test('native WebGPU executes ActiveSource-v2 sparse/A=0 P2G and compiles physical-direct G2P pipelines', {
  skip: RUN_NATIVE_ACTIVE_SOURCE_P2G
    ? false
    : 'set ULG_RUN_NATIVE_ACTIVE_SOURCE_P2G=1 for native WebGPU execution',
  timeout: 120_000
}, async () => {
  const { chromium } = await import('@playwright/test');
  const browser = await chromium.launch({
    executablePath: process.env.ULG_ACTIVE_SOURCE_P2G_CHROME
      || '/usr/bin/google-chrome',
    headless: true,
    args: [
      '--use-angle=vulkan',
      '--enable-features=Vulkan,UseSkiaRenderer',
      '--enable-unsafe-webgpu',
      '--ignore-gpu-blocklist'
    ]
  });

  let native;
  try {
    const page = await browser.newPage({ ignoreHTTPSErrors: true });
    await page.goto(NATIVE_ACTIVE_SOURCE_P2G_BASE_URL, {
      waitUntil: 'domcontentloaded',
      timeout: 60_000
    });
    native = await page.evaluate(async () => {
      const adapter = await navigator.gpu?.requestAdapter({
        powerPreference: 'high-performance'
      });
      if (!adapter) {
        return { status: 'unsupported', reason: 'WebGPU adapter unavailable' };
      }
      const device = await adapter.requestDevice();
      const uncapturedErrors = [];
      device.addEventListener('uncapturederror', (event) => {
        uncapturedErrors.push(event.error?.message || String(event.error));
      });
      device.pushErrorScope('validation');
      try {
        const nonce = Date.now();
        const step = await import(
          `/src/runtime/sph/sphMlsMpmGpuStep.js?nativeActiveSourceP2g=${nonce}`
        );
        const definitions = [
          [
            'p2g-observed',
            step.mlsMpmP2gGridProjectionCanonicalSpatialActiveSourceV2SingleLevelMechanicsFieldWgsl,
            ['main', 'finalize_grid', 'preflight_compact_mechanics_view']
          ],
          [
            'p2g-unobserved',
            step.mlsMpmP2gGridProjectionCanonicalSpatialUnobservedActiveSourceV2SingleLevelMechanicsFieldWgsl,
            ['main', 'finalize_grid', 'preflight_compact_mechanics_view']
          ],
          [
            'g2p-observed',
            step.mlsMpmG2pReconstructCanonicalSpatialActiveSourceV2SingleLevelMechanicsFieldWgsl,
            ['main', 'finalize_canonical_spatial_authority']
          ],
          [
            'g2p-unobserved',
            step.mlsMpmG2pReconstructCanonicalSpatialUnobservedActiveSourceV2SingleLevelMechanicsFieldWgsl,
            ['main', 'finalize_canonical_spatial_authority']
          ],
          [
            'g2p-cross-level-observed',
            step.mlsMpmG2pReconstructCanonicalSpatialActiveSourceV2MechanicsFieldWgsl,
            [
              'main',
              'finalize_canonical_spatial_authority',
              'claim_g2p_energy_receipt',
              'measure_g2p_energy_receipt',
              'consume_g2p_energy_receipt',
              'consume_g2p_fine_reflux_receipt',
              'consume_g2p_coarse_reflux_receipt'
            ]
          ],
          [
            'g2p-cross-level-unobserved',
            step.mlsMpmG2pReconstructCanonicalSpatialUnobservedActiveSourceV2MechanicsFieldWgsl,
            [
              'main',
              'finalize_canonical_spatial_authority',
              'claim_g2p_energy_receipt',
              'measure_g2p_energy_receipt',
              'consume_g2p_energy_receipt',
              'consume_g2p_fine_reflux_receipt',
              'consume_g2p_coarse_reflux_receipt'
            ]
          ]
        ];
        const compilationErrors = [];
        const compiledEntryPoints = [];
        for (const [label, code, entryPoints] of definitions) {
          const module = device.createShaderModule({
            label: `native-active-source-v2-${label}`,
            code
          });
          const info = await module.getCompilationInfo();
          for (const message of info.messages) {
            if (message.type === 'error') {
              compilationErrors.push(`${label}: ${message.message}`);
            }
          }
          for (const entryPoint of entryPoints) {
            await device.createComputePipelineAsync({
              label: `native-active-source-v2-${label}-${entryPoint}`,
              layout: 'auto',
              compute: { module, entryPoint }
            });
            compiledEntryPoints.push(`${label}:${entryPoint}`);
          }
        }
        const [
          abi,
          buffersModule,
          hierarchyModule,
          spatialModule,
          gridModule
        ] = await Promise.all([
          import(`/ulg-gpu-abi/src/index.js?nativeActiveSourceP2g=${nonce}`),
          import(
            `/src/runtime/sph/sphGpuBuffers.js`
              + `?nativeActiveSourceP2g=${nonce}`
          ),
          import(
            `/src/runtime/sph/schroederHierarchyGpu.js`
              + `?nativeActiveSourceP2g=${nonce}`
          ),
          import(
            `/src/runtime/sph/schroederSpatialEpochGpu.js`
              + `?nativeActiveSourceP2g=${nonce}`
          ),
          import(
            `/src/runtime/sph/sphGridGpuKernel.js`
              + `?nativeActiveSourceP2g=${nonce}`
          )
        ]);
        const readWords = async (buffer, byteLength, label) => {
          const readback = device.createBuffer({
            label,
            size: byteLength,
            usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
          });
          const encoder = device.createCommandEncoder();
          encoder.copyBufferToBuffer(buffer, 0, readback, 0, byteLength);
          device.queue.submit([encoder.finish()]);
          await readback.mapAsync(GPUMapMode.READ);
          const words = new Uint32Array(readback.getMappedRange()).slice();
          readback.unmap();
          readback.destroy();
          return words;
        };
        const runExecutionCase = async ({
          label,
          activePhysicalSources
        }) => {
          const physicalSourceCount = 1024;
          const activePhysicalSet = new Set(activePhysicalSources);
          const state = new Float32Array(physicalSourceCount * 8);
          const thermo = new Float32Array(physicalSourceCount * 12);
          const identity = new Uint32Array(physicalSourceCount);
          const mechanics = new Float32Array(physicalSourceCount * 32);
          for (let physical = 0;
            physical < physicalSourceCount;
            physical += 1) {
            const active = activePhysicalSet.has(physical);
            state.set([
              1,
              1,
              1,
              active ? 1 : 0,
              0,
              0,
              0,
              0
            ], physical * 8);
            thermo.set([
              7,
              1,
              300,
              1000,
              1,
              0,
              0,
              0,
              0.25,
              active ? 1 : 0,
              active ? 1 : 254,
              active ? 0.1 : 0
            ], physical * 12);
            identity[physical] = 1;
            const mechanicsOffset = physical * 32;
            mechanics.set([
              1, 0, 0,
              0, 1, 0,
              0, 0, 1
            ], mechanicsOffset);
            mechanics[mechanicsOffset + 18] = 1;
            mechanics[mechanicsOffset + 19] = active ? 0.001 : 0;
            mechanics[mechanicsOffset + 20] = 1;
            mechanics[mechanicsOffset + 21] = active ? 1 : 254;
            mechanics[mechanicsOffset + 27] = active ? 1 : 254;
            mechanics[mechanicsOffset + 31] = active ? 1 : 0;
          }
          const sphParticleState = {
            schema: abi.ULG_SPH_GPU_PARTICLE_BUFFER_SCHEMA,
            status: 'cpu-derived-gpu-buffer-ready',
            particleCount: physicalSourceCount,
            dimension: 3,
            step: 0,
            time: 0,
            positionEpoch: 0,
            topologyEpoch: 0,
            chartEpoch: 0,
            levelEpoch: 0,
            supportEpoch: 0,
            smoothingLengthM: 0.25,
            storageGeneration: 1,
            stateStrideFloats: 8,
            thermoStrideFloats: 12,
            identityStrideUints: 1,
            stateStrideBytes: 32,
            thermoStrideBytes: 48,
            identityStrideBytes: 4,
            identityRequired: true,
            identityRevision: `native-active-source-p2g-${label}`,
            renderDomainKeys: { 1: `native-active-source-p2g-${label}` },
            state,
            thermo,
            identity,
            metadata: []
          };
          const mlsMpmParticleState = {
            schema: abi.ULG_MLS_MPM_GPU_PARTICLE_BUFFER_SCHEMA,
            status: 'cpu-derived-gpu-buffer-ready',
            particleCount: physicalSourceCount,
            step: 0,
            time: 0,
            storageGeneration: 1,
            mechanicsStrideFloats: 32,
            mechanicsStrideBytes: 128,
            mechanicsDtS: 0,
            mechanicalSubsteps: 1,
            gridCflFactor: 0.4,
            gravityMPerS2: [0, 0, 0],
            particleSeparationRelaxation: 0,
            particleSeparationVelocityDamping: 0,
            mechanics,
            metadata: [],
            algorithmMaterialContactRows: null
          };
          const sphParticleUpload =
            buffersModule.uploadSphGpuParticleBuffers(
              device,
              sphParticleState
            );
          const mlsMpmParticleUpload =
            buffersModule.uploadMlsMpmGpuParticleBuffers(
              device,
              mlsMpmParticleState
            );
          sphParticleUpload.slot = 0;
          mlsMpmParticleUpload.slot = 0;
          let levelAssignment = null;
          let generation = null;
          try {
            levelAssignment =
              await hierarchyModule.runSchroederLevelAssignmentWebGpu({
                device,
                sphParticleState,
                mlsMpmParticleState,
                sphParticleUpload,
                mlsMpmParticleUpload,
                baseGridSpacingM: 0.25,
                minLevel: 0,
                maxLevel: 0,
                targetSupportCells: 1,
                supportRadiusScale: 1,
                chartId: 0,
                retainAssignmentBuffer: true
              });
            const gridSpec = gridModule.createMlsMpmGridSpec({
              boxDimsM: [2, 2, 2],
              gridSpacingM: 0.25
            });
            generation =
              spatialModule.runSchroederSpatialEpochGenerationWebGpu({
                device,
                levelAssignment,
                particleCount: physicalSourceCount,
                particleIdentityBuffer: sphParticleUpload.identityBuffer,
                particleIdentityStrideWords: 1,
                selectedLevel: 0,
                mechanicsGrid: {
                  gridNodeCount: gridSpec.gridNodeCount,
                  gridDims: gridSpec.gridDims,
                  gridShift: gridSpec.shift,
                  gridSpacingM: gridSpec.gridSpacingM
                }
              });
            if (!generation.ready) {
              throw new Error(
                `${label} directory-v2 generation rejected: `
                  + (generation.reason || generation.status)
              );
            }
            const projection =
              await gridModule.runMlsMpmP2gGridProjectionWebGpu({
                device,
                sphParticleState,
                mlsMpmParticleState,
                sphParticleUpload,
                mlsMpmParticleUpload,
                schroederSelectedLevel: 0,
                schroederSpatialEpochGeneration: generation,
                canonicalSpatialRequired: true,
                mechanicsFieldMode: 'required',
                gridSpacingM: 0.25,
                boxDimsM: [2, 2, 2],
                dt: 0,
                internalPressureScale: 0,
                readbackMode: 'no-full-readback'
              });
            await device.queue.onSubmittedWorkDone();
            const activeSourceView = generation.activeSourceView
              ?? generation.execution.activeSourceView;
            const activeWords = await readWords(
              activeSourceView.activeSourceViewBuffer,
              activeSourceView.layout.byteLength,
              `native-active-source-p2g-${label}-active`
            );
            const field = generation.mechanicsFieldView;
            const fieldWords = await readWords(
              field.fieldViewBuffer,
              field.layout.byteLength,
              `native-active-source-p2g-${label}-field`
            );
            const fieldFloats = new Float32Array(fieldWords.buffer);
            const fieldCount = fieldWords[34];
            const descriptorStatuses = Array.from(
              { length: physicalSourceCount },
              (_, physical) => fieldWords[
                field.layout.descriptorOffsetWords
                  + physical * field.layout.descriptorWords
                  + 3
              ]
            );
            const contributionCounts = Array.from(
              { length: fieldCount },
              (_, fieldIndex) => fieldWords[
                field.layout.stateOffsetWords
                  + fieldIndex * field.layout.stateWords
                  + 7
              ]
            );
            const depositedMass = Array.from(
              { length: fieldCount },
              (_, fieldIndex) => fieldFloats[
                field.layout.stateOffsetWords
                  + fieldIndex * field.layout.stateWords
              ]
            ).reduce((sum, mass) => sum + mass, 0);
            return {
              label,
              activeCount: activeWords[18],
              activeCandidateCount: activeWords[43],
              highWaterMark: activeWords[36],
              activeToPhysical: Array.from(activeWords.slice(
                activeSourceView.layout.activeToPhysicalOffsetWords,
                activeSourceView.layout.activeToPhysicalOffsetWords
                  + activeWords[18]
              )),
              activeDispatch: Array.from(activeWords.slice(
                activeSourceView.layout.activeDispatchOffsetWords,
                activeSourceView.layout.activeDispatchOffsetWords + 3
              )),
              fieldAdmitted: fieldWords[2]
                === (
                  abi.SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_STATUS_READY
                    | abi.SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_STATUS_ADMITTED
                ),
              fieldCount,
              fieldDispatch: Array.from(fieldWords.slice(60, 63)),
              descriptorStatuses,
              contributionCounts,
              depositedMass,
              stateEncoding: fieldWords[59],
              activeSourceP2gEnabled:
                projection.activeSourceP2gEnabled === true,
              activeSourceP2gDispatchMode:
                projection.activeSourceP2gDispatchMode,
              activeSourceP2gWorkIdentity:
                projection.activeSourceP2gWorkIdentity,
              activeCountHostKnown:
                projection.activeSourceP2gActiveCountHostKnown,
              executionActiveCount: generation.execution.activeSourceCount,
              activeSourceCountReadbackPerformed:
                generation.execution.activeSourceCountReadbackPerformed,
              sourceWorkIdentity: generation.execution.sourceWorkIdentity,
              fieldCandidateCount: field.candidateCount,
              fieldStableCandidateOrderCount:
                field.stableCandidateOrderCount,
              fieldCandidateCountAuthorityOffsetWords:
                field.stableCandidateOrderCountAuthority?.offsetWords ?? null,
              fullReadbackPerformed:
                projection.fullReadbackPerformed === true,
              normalHotLoopReadbackFree:
                projection.normalHotLoopReadbackFree === true,
              denseGridBufferAllocatedBytes:
                projection.denseGridBufferAllocatedBytes,
              denseAccumulatorBufferAllocatedBytes:
                projection.denseAccumulatorBufferAllocatedBytes
            };
          } finally {
            if (generation) {
              spatialModule.releaseSchroederSpatialEpochGenerationAfterQueue(
                generation,
                device
              );
              await generation.releasePromise;
            }
            levelAssignment?.destroyAssignmentBuffer?.();
            buffersModule.destroySphGpuParticleBuffers(sphParticleUpload);
            buffersModule.destroyMlsMpmGpuParticleBuffers(
              mlsMpmParticleUpload
            );
          }
        };
        const executionCases = [
          await runExecutionCase({
            label: 'all-dormant-a0',
            activePhysicalSources: []
          }),
          await runExecutionCase({
            label: 'sparse-high-slot',
            activePhysicalSources: [7, 1000]
          })
        ];
        const validationError = await device.popErrorScope();
        return {
          status: 'complete',
          compilationErrors,
          validationError: validationError?.message || null,
          uncapturedErrors,
          compiledEntryPoints,
          executionCases
        };
      } finally {
        device.destroy();
      }
    });
  } finally {
    await browser.close();
  }

  assert.equal(native.status, 'complete', native.reason || 'native WebGPU did not run');
  assert.deepEqual(native.compilationErrors, []);
  assert.equal(native.validationError, null);
  assert.deepEqual(native.uncapturedErrors, []);
  assert.deepEqual(native.compiledEntryPoints, [
    'p2g-observed:main',
    'p2g-observed:finalize_grid',
    'p2g-observed:preflight_compact_mechanics_view',
    'p2g-unobserved:main',
    'p2g-unobserved:finalize_grid',
    'p2g-unobserved:preflight_compact_mechanics_view',
    'g2p-observed:main',
    'g2p-observed:finalize_canonical_spatial_authority',
    'g2p-unobserved:main',
    'g2p-unobserved:finalize_canonical_spatial_authority',
    'g2p-cross-level-observed:main',
    'g2p-cross-level-observed:finalize_canonical_spatial_authority',
    'g2p-cross-level-observed:claim_g2p_energy_receipt',
    'g2p-cross-level-observed:measure_g2p_energy_receipt',
    'g2p-cross-level-observed:consume_g2p_energy_receipt',
    'g2p-cross-level-observed:consume_g2p_fine_reflux_receipt',
    'g2p-cross-level-observed:consume_g2p_coarse_reflux_receipt',
    'g2p-cross-level-unobserved:main',
    'g2p-cross-level-unobserved:finalize_canonical_spatial_authority',
    'g2p-cross-level-unobserved:claim_g2p_energy_receipt',
    'g2p-cross-level-unobserved:measure_g2p_energy_receipt',
    'g2p-cross-level-unobserved:consume_g2p_energy_receipt',
    'g2p-cross-level-unobserved:consume_g2p_fine_reflux_receipt',
    'g2p-cross-level-unobserved:consume_g2p_coarse_reflux_receipt'
  ]);
  assert.deepEqual(native.executionCases, [
    {
      label: 'all-dormant-a0',
      activeCount: 0,
      activeCandidateCount: 0,
      highWaterMark: 0,
      activeToPhysical: [],
      activeDispatch: [0, 1, 1],
      fieldAdmitted: true,
      fieldCount: 0,
      fieldDispatch: [0, 0, 0],
      descriptorStatuses: new Array(1024).fill(0),
      contributionCounts: [],
      depositedMass: 0,
      stateEncoding:
        SCHROEDER_SPATIAL_MECHANICS_FIELD_STATE_ENCODING_MASS_MOMENTUM_GRADIENT,
      activeSourceP2gEnabled: true,
      activeSourceP2gDispatchMode: 'gpu-authored-active-source-indirect',
      activeSourceP2gWorkIdentity: 'gpu-active-ordinal-to-physical',
      activeCountHostKnown: false,
      executionActiveCount: null,
      activeSourceCountReadbackPerformed: false,
      sourceWorkIdentity: 'gpu-active-ordinal',
      fieldCandidateCount: null,
      fieldStableCandidateOrderCount: null,
      fieldCandidateCountAuthorityOffsetWords: 43,
      fullReadbackPerformed: false,
      normalHotLoopReadbackFree: true,
      denseGridBufferAllocatedBytes: 0,
      denseAccumulatorBufferAllocatedBytes: 0
    },
    {
      label: 'sparse-high-slot',
      activeCount: 2,
      activeCandidateCount: 54,
      highWaterMark: 1001,
      activeToPhysical: [7, 1000],
      activeDispatch: [1, 1, 1],
      fieldAdmitted: true,
      fieldCount: 27,
      fieldDispatch: [1, 1, 1],
      descriptorStatuses: Array.from(
        { length: 1024 },
        (_, physical) => (
          physical === 7 || physical === 1000 ? 1 : 0
        )
      ),
      contributionCounts: new Array(27).fill(2),
      depositedMass: 2,
      stateEncoding:
        SCHROEDER_SPATIAL_MECHANICS_FIELD_STATE_ENCODING_MASS_MOMENTUM_GRADIENT,
      activeSourceP2gEnabled: true,
      activeSourceP2gDispatchMode: 'gpu-authored-active-source-indirect',
      activeSourceP2gWorkIdentity: 'gpu-active-ordinal-to-physical',
      activeCountHostKnown: false,
      executionActiveCount: null,
      activeSourceCountReadbackPerformed: false,
      sourceWorkIdentity: 'gpu-active-ordinal',
      fieldCandidateCount: null,
      fieldStableCandidateOrderCount: null,
      fieldCandidateCountAuthorityOffsetWords: 43,
      fullReadbackPerformed: false,
      normalHotLoopReadbackFree: true,
      denseGridBufferAllocatedBytes: 0,
      denseAccumulatorBufferAllocatedBytes: 0
    }
  ]);
});

test('MLS-MPM resident summary can skip the active-grid scan for particle-visual diagnostics', async () => {
  const particleCount = 20;
  const gridNodeCount = 160;
  const summaryValues = new Float32Array(MLS_MPM_GPU_RESIDENT_SUMMARY_FLOATS);
  summaryValues[0] = particleCount;
  summaryValues[1] = 0;
  summaryValues[2] = 123;
  summaryValues[3] = 12;
  summaryValues[4] = 12;
  summaryValues[5] = 0;
  summaryValues[19] = 1;
  summaryValues[20] = 5;
  summaryValues[21] = 4;
  summaryValues[22] = 2;
  summaryValues[23] = 1;
  summaryValues[24] = 450;
  summaryValues[27] = particleCount;
  summaryValues[30] = 12;
  summaryValues[31] = 1;
  summaryValues[50] = 1;
  summaryValues[51] = 1;
  summaryValues[52] = 12;
  summaryValues[53] = 12;
  summaryValues[56] = 1;
  summaryValues[57] = 0;
  summaryValues[58] = 8;
  summaryValues[59] = 8;
  summaryValues[60] = 20;
  summaryValues[61] = 8;
  summaryValues[72] = 4;
  const device = fakeSummaryDevice(summaryValues);
  const tracker = fakeBufferTracker();
  const summary = await runMlsMpmResidentSummaryWebGpu({
    device,
    summaryScope: 'particle-visual',
    sphParticleState: {
      schema: ULG_SPH_GPU_PARTICLE_BUFFER_SCHEMA,
      particleCount,
      state: new Float32Array(particleCount * 8)
    },
    mlsMpmParticleState: {
      schema: ULG_MLS_MPM_GPU_PARTICLE_BUFFER_SCHEMA,
      particleCount,
      mechanics: new Float32Array(particleCount * MLS_MPM_GPU_PARTICLE_MECHANICS_ROW_LAYOUT.length)
    },
    sphParticleUpload: {
      status: 'webgpu-uploaded',
      stateBuffer: tracker.buffer('source-state'),
      thermoBuffer: tracker.buffer('source-thermo')
    },
    mlsMpmParticleUpload: {
      status: 'webgpu-uploaded',
      mechanicsBuffer: tracker.buffer('source-mechanics')
    },
    gridUpdate: {
      gridNodeCount,
      gpuResult: { updatedGridBuffer: tracker.buffer('updated-grid') }
    },
    g2pReconstruction: {
      stateBuffer: tracker.buffer('next-state'),
      mechanicsBuffer: tracker.buffer('next-mechanics')
    }
  });

  assert.equal(summary.summaryScope, 'particle-visual');
  assert.equal(summary.gridNodeCount, gridNodeCount);
  assert.equal(summary.gridNodeScanCount, 0);
  assert.equal(summary.gridNodeScanSkipped, true);
  assert.equal(summary.activeGridNodeCount, null);
  assert.equal(summary.activeGridNodeCountAvailable, false);
  assert.equal(summary.activeGridNodeSummaryStatus, 'active-grid-node-summary-not-requested');
  assert.equal(summary.compactPartialSummaryCount, 1);
  assert.equal(summary.compactPartialSummaryByteLength, MLS_MPM_GPU_RESIDENT_SUMMARY_BYTES);
  assert.equal(summary.timing.summaryWorkgroupCount, 2);
  assert.equal(summary.timing.queueFenceAttribution, 'mapAsync(readback-buffer)-may-include-prior-queued-resident-work');
  assert.equal(summary.massDeltaKg, 0);
  assert.equal(summary.cohortSummaryAvailable, true);
  assert.equal(summary.cohortDiagnostics.base.count, 8);
  assert.equal(summary.cohortDiagnostics.drop.count, 12);
  assert.deepEqual(device.dispatches.map((entry) => entry.count), [1, 1]);
  assert.equal(device.createdBuffers.find((buffer) => buffer.label === 'ulg-mls-mpm-resident-summary-partials').size, MLS_MPM_GPU_RESIDENT_SUMMARY_BYTES);
  assert.equal(device.createdBuffers.every((buffer) => buffer.destroyed), true);
});

test('MLS-MPM resident summary does not scan or regenerate the superseded dense grid in mechanics-field mode', async () => {
  const particleCount = 4;
  const gridNodeCount = 512;
  const summaryValues = new Float32Array(MLS_MPM_GPU_RESIDENT_SUMMARY_FLOATS);
  summaryValues[0] = particleCount;
  summaryValues[1] = 0;
  summaryValues[2] = 99;
  summaryValues[19] = 1;
  const device = fakeSummaryDevice(summaryValues);
  const tracker = fakeBufferTracker();
  const summary = await runMlsMpmResidentSummaryWebGpu({
    device,
    sphParticleState: {
      schema: ULG_SPH_GPU_PARTICLE_BUFFER_SCHEMA,
      particleCount,
      state: new Float32Array(particleCount * 8)
    },
    mlsMpmParticleState: {
      schema: ULG_MLS_MPM_GPU_PARTICLE_BUFFER_SCHEMA,
      particleCount,
      mechanics: new Float32Array(particleCount * MLS_MPM_GPU_PARTICLE_MECHANICS_ROW_LAYOUT.length)
    },
    sphParticleUpload: {
      status: 'webgpu-uploaded',
      stateBuffer: tracker.buffer('source-state'),
      thermoBuffer: tracker.buffer('source-thermo')
    },
    mlsMpmParticleUpload: {
      status: 'webgpu-uploaded',
      mechanicsBuffer: tracker.buffer('source-mechanics')
    },
    gridUpdate: {
      gridNodeCount,
      gridDims: [8, 8, 8],
      gridShift: 4,
      gridSpacingM: 0.25,
      mechanicsFieldViewEnabled: true,
      gridStateAuthority: 'schroeder-spatial-mechanics-field-view-v1',
      gpuResult: { updatedGridBuffer: tracker.buffer('unused-updated-grid') }
    },
    g2pReconstruction: {
      stateBuffer: tracker.buffer('next-state'),
      mechanicsBuffer: tracker.buffer('next-mechanics')
    },
    activeGridDispatchPlan: {
      requested: true,
      dt: 0.001,
      stepCount: 2,
      gravityMPerS2: [0, -9.80665, 0],
      safetyCells: 1
    }
  });

  assert.equal(summary.status, 'compact-summary-ready');
  assert.equal(summary.mechanicsFieldViewEnabled, true);
  assert.equal(summary.gridNodeSummaryAuthority, 'schroeder-spatial-mechanics-field-view-v1');
  assert.equal(summary.gridNodeScanCount, 0);
  assert.equal(summary.gridNodeScanSkipped, true);
  assert.equal(summary.activeGridNodeCount, null);
  assert.equal(summary.activeGridNodeCountAvailable, false);
  assert.equal(
    summary.activeGridNodeSummaryStatus,
    'superseded-by-schroeder-spatial-mechanics-field-view'
  );
  assert.equal(summary.activeGridDispatchPlan.status, 'active-grid-summary-dispatch-plan-superseded');
  assert.equal(
    summary.activeGridDispatchPlan.reason,
    'schroeder-spatial-mechanics-field-view-owns-indirect-dispatch'
  );
  assert.equal(summary.activeGridDispatchPlan.source, 'schroeder-spatial-mechanics-field-view-v1');
  assert.equal(summary.activeGridDispatchPlanBuffersRetained, false);
  assert.deepEqual(device.dispatches.map((entry) => entry.count), [1, 1]);
  assert.equal(device.bindGroups.length, 2);
  assert.equal(
    device.createdBuffers.some((buffer) => buffer.label === 'ulg-mls-mpm-active-grid-summary-dispatch-args'),
    false
  );
  assert.equal(device.createdBuffers.every((buffer) => buffer.destroyed), true);
});

test('MLS-MPM resident summary can emit GPU active-grid dispatch plan buffers', async () => {
  const particleCount = 4;
  const gridNodeCount = 512;
  const summaryValues = new Float32Array(MLS_MPM_GPU_RESIDENT_SUMMARY_FLOATS);
  summaryValues[0] = particleCount;
  summaryValues[1] = gridNodeCount;
  summaryValues[15] = 2;
  summaryValues[19] = 1;
  summaryValues[44] = 1.25;
  summaryValues[45] = 1.25;
  summaryValues[46] = 1.25;
  summaryValues[47] = 1.5;
  summaryValues[48] = 1.5;
  summaryValues[49] = 1.5;
  summaryValues[51] = 1;
  const device = fakeSummaryDevice(summaryValues);
  const tracker = fakeBufferTracker();
  const summary = await runMlsMpmResidentSummaryWebGpu({
    device,
    sphParticleState: {
      schema: ULG_SPH_GPU_PARTICLE_BUFFER_SCHEMA,
      particleCount,
      state: new Float32Array(particleCount * 8)
    },
    mlsMpmParticleState: {
      schema: ULG_MLS_MPM_GPU_PARTICLE_BUFFER_SCHEMA,
      particleCount,
      mechanics: new Float32Array(particleCount * MLS_MPM_GPU_PARTICLE_MECHANICS_ROW_LAYOUT.length)
    },
    sphParticleUpload: {
      status: 'webgpu-uploaded',
      stateBuffer: tracker.buffer('source-state'),
      thermoBuffer: tracker.buffer('source-thermo')
    },
    mlsMpmParticleUpload: {
      status: 'webgpu-uploaded',
      mechanicsBuffer: tracker.buffer('source-mechanics')
    },
    gridUpdate: {
      gridNodeCount,
      gridDims: [8, 8, 8],
      gridShift: 4,
      gridSpacingM: 0.25,
      gpuResult: { updatedGridBuffer: tracker.buffer('updated-grid') }
    },
    g2pReconstruction: {
      gridNodeCount,
      gridDims: [8, 8, 8],
      gridShift: 4,
      gridSpacingM: 0.25,
      stateBuffer: tracker.buffer('next-state'),
      mechanicsBuffer: tracker.buffer('next-mechanics')
    },
    activeGridDispatchPlan: {
      requested: true,
      dt: 0.001,
      stepCount: 2,
      gravityMPerS2: [0, -9.80665, 0],
      safetyCells: 1
    }
  });

  assert.equal(summary.status, 'compact-summary-ready');
  assert.equal(summary.timing.summaryKernelDispatchCount, 3);
  assert.equal(summary.timing.summaryWorkgroupCount, 18);
  assert.deepEqual(device.dispatches.map((entry) => entry.count), [16, 1, 1]);
  assert.equal(device.bindGroups.length, 3);
  assert.match(device.shaderModules.at(-1).code, /ActiveGridDispatchFromSummaryParams|dispatch_args|dispatch_metadata/);
  assert.equal(summary.activeGridDispatchPlan.status, 'gpu-active-grid-summary-dispatch-plan-ready');
  assert.equal(summary.activeGridDispatchPlan.source, 'compact-summary-gpu-sidecar');
  assert.equal(summary.activeGridDispatchPlan.dispatchArgsBufferRetained, true);
  assert.equal(summary.activeGridDispatchPlan.dispatchArgsBufferByteLength, 12);
  assert.equal(summary.activeGridDispatchPlan.metadataBufferRetained, true);
  assert.equal(summary.activeGridDispatchPlan.metadataBufferByteLength, 64);
  assert.deepEqual(summary.activeGridDispatchPlan.gridDims, [8, 8, 8]);
  assert.equal(summary.activeGridDispatchPlan.gridShift, 4);
  assert.equal(summary.activeGridDispatchPlan.gridSpacingM, 0.25);
  assert.equal(summary.activeGridDispatchPlan.safetyCells, 1);
  assert.equal(summary.activeGridDispatchPlan.stepCount, 2);
  assert.equal(summary.activeGridDispatchPlan.normalHotLoopReadbackFree, true);
  assert.equal(summary.activeGridDispatchPlanBuffersRetained, true);
  assert.equal(summary.activeGridDispatchPlanDispatchArgsBuffer.label, 'ulg-mls-mpm-active-grid-summary-dispatch-args');
  assert.equal(summary.activeGridDispatchPlanMetadataBuffer.label, 'ulg-mls-mpm-active-grid-summary-dispatch-metadata');
  assert.equal(summary.activeGridDispatchPlanDispatchArgsBuffer.destroyed, false);
  assert.equal(summary.activeGridDispatchPlanMetadataBuffer.destroyed, false);
  assert.equal(device.createdBuffers.find((buffer) => buffer.label === 'ulg-mls-mpm-active-grid-summary-dispatch-params').destroyed, true);
  summary.destroyActiveGridDispatchPlanBuffers();
  assert.equal(summary.activeGridDispatchPlanDispatchArgsBuffer.destroyed, true);
  assert.equal(summary.activeGridDispatchPlanMetadataBuffer.destroyed, true);
});

test('MLS-MPM resident summary can emit active-grid dispatch plan buffers without compact readback', async () => {
  const particleCount = 4;
  const gridNodeCount = 512;
  const summaryValues = new Float32Array(MLS_MPM_GPU_RESIDENT_SUMMARY_FLOATS);
  summaryValues[0] = particleCount;
  summaryValues[1] = gridNodeCount;
  summaryValues[15] = 2;
  summaryValues[19] = 1;
  summaryValues[44] = 1.25;
  summaryValues[45] = 1.25;
  summaryValues[46] = 1.25;
  summaryValues[47] = 1.5;
  summaryValues[48] = 1.5;
  summaryValues[49] = 1.5;
  summaryValues[51] = 1;
  const device = fakeSummaryDevice(summaryValues);
  const tracker = fakeBufferTracker();
  const summary = await runMlsMpmResidentSummaryWebGpu({
    device,
    sphParticleState: {
      schema: ULG_SPH_GPU_PARTICLE_BUFFER_SCHEMA,
      particleCount,
      state: new Float32Array(particleCount * 8)
    },
    mlsMpmParticleState: {
      schema: ULG_MLS_MPM_GPU_PARTICLE_BUFFER_SCHEMA,
      particleCount,
      mechanics: new Float32Array(particleCount * MLS_MPM_GPU_PARTICLE_MECHANICS_ROW_LAYOUT.length)
    },
    sphParticleUpload: {
      status: 'webgpu-uploaded',
      stateBuffer: tracker.buffer('source-state'),
      thermoBuffer: tracker.buffer('source-thermo')
    },
    mlsMpmParticleUpload: {
      status: 'webgpu-uploaded',
      mechanicsBuffer: tracker.buffer('source-mechanics')
    },
    gridUpdate: {
      gridNodeCount,
      gridDims: [8, 8, 8],
      gridShift: 4,
      gridSpacingM: 0.25,
      gpuResult: { updatedGridBuffer: tracker.buffer('updated-grid') }
    },
    g2pReconstruction: {
      gridNodeCount,
      gridDims: [8, 8, 8],
      gridShift: 4,
      gridSpacingM: 0.25,
      stateBuffer: tracker.buffer('next-state'),
      mechanicsBuffer: tracker.buffer('next-mechanics')
    },
    readCompactSummary: false,
    activeGridDispatchPlan: {
      requested: true,
      dt: 0.001,
      stepCount: 2,
      gravityMPerS2: [0, -9.80665, 0],
      safetyCells: 1
    }
  });

  assert.equal(summary.status, 'compact-summary-plan-only-ready');
  assert.equal(summary.readbackMode, 'no-compact-summary-readback');
  assert.equal(summary.compactGpuSummaryAvailable, false);
  assert.equal(summary.compactGpuSummaryStatus, 'not-read-no-compact-summary-readback');
  assert.equal(summary.timing.mapAsyncWaitMs, null);
  assert.equal(summary.timing.decodeMs, 0);
  assert.equal(summary.timing.compactReadbackByteLength, 0);
  assert.equal(summary.normalHotLoopReadbackFree, true);
  assert.equal(summary.activeGridDispatchPlan.status, 'gpu-active-grid-summary-dispatch-plan-ready');
  assert.equal(summary.activeGridDispatchPlan.source, 'compact-summary-gpu-sidecar');
  assert.equal(summary.activeGridDispatchPlanBuffersRetained, true);
  assert.equal(summary.activeGridDispatchPlanDispatchArgsBuffer.label, 'ulg-mls-mpm-active-grid-summary-dispatch-args');
  assert.equal(summary.activeGridDispatchPlanMetadataBuffer.label, 'ulg-mls-mpm-active-grid-summary-dispatch-metadata');
  assert.equal(summary.activeGridDispatchPlanDispatchArgsBuffer.destroyed, false);
  assert.equal(summary.activeGridDispatchPlanMetadataBuffer.destroyed, false);
  assert.deepEqual(device.dispatches.map((entry) => entry.count), [16, 1, 1]);
  assert.equal(device.bindGroups.length, 3);
  assert.equal(device.copies.length, 0);
  assert.equal(device.createdBuffers.some((buffer) => buffer.label === 'ulg-mls-mpm-resident-summary-readback'), false);
  summary.destroyActiveGridDispatchPlanBuffers();
  assert.equal(summary.activeGridDispatchPlanDispatchArgsBuffer.destroyed, true);
  assert.equal(summary.activeGridDispatchPlanMetadataBuffer.destroyed, true);
});

test('MLS-MPM resident step shares retained stage buffers across WebGPU stages', async () => {
  const buffers = manualBuffers();
  const tracker = fakeBufferTracker();
  const sourceStateBuffer = tracker.buffer('source-state');
  const sourceThermoBuffer = tracker.buffer('source-thermo');
  const sourceMechanicsBuffer = tracker.buffer('source-mechanics');
  let identityDestroyCount = 0;
  const sourceIdentityBuffer = {
    label: 'source-identity',
    destroy() {
      identityDestroyCount += 1;
    }
  };
  const sourceSphUpload = {
    status: 'webgpu-uploaded',
    stateBuffer: sourceStateBuffer,
    thermoBuffer: sourceThermoBuffer,
    identityBuffer: sourceIdentityBuffer,
    identitySchema: ULG_SPH_GPU_PARTICLE_IDENTITY_BUFFER_SCHEMA,
    identityStrideBytes: Uint32Array.BYTES_PER_ELEMENT,
    identityBufferByteLength: buffers.sphParticleState.particleCount * Uint32Array.BYTES_PER_ELEMENT,
    ownsIdentityBuffer: true,
    slot: 0
  };
  const step = await runMlsMpmResidentStepWithOptionalWebGpu({
    ...buffers,
    sphParticleUpload: sourceSphUpload,
    mlsMpmParticleUpload: {
      status: 'webgpu-uploaded',
      mechanicsBuffer: sourceMechanicsBuffer,
      slot: 0
    },
    preferWebGpu: true,
    navigatorRef: webGpuNavigator(),
    boxDimsM: [3, 3, 3],
    p2gRunner(args) {
      const result = projectMlsMpmP2gGridCpu(args);
      return {
        ...result,
        backend: 'webgpu',
        gridBuffer: tracker.buffer('p2g-grid'),
        gridBufferByteLength: result.gridNodes.byteLength,
        destroyGridBuffer() {
          this.gridBuffer.destroy();
        }
      };
    },
    gridUpdateRunner(args) {
      assert.equal(args.p2gGridBuffer?.label, 'p2g-grid');
      const result = updateMlsMpmGridCpu(args);
      return {
        ...result,
        backend: 'webgpu',
        updatedGridBuffer: tracker.buffer('updated-grid'),
        updatedGridBufferByteLength: result.updatedGridNodes.byteLength,
        destroyUpdatedGridBuffer() {
          this.updatedGridBuffer.destroy();
        }
      };
    },
    g2pRunner(args) {
      assert.equal(args.updatedGridBuffer?.label, 'updated-grid');
      assert.equal(args.retainOutputParticleBuffers, true);
      const result = reconstructMlsMpmG2pCpu(args);
      return {
        ...result,
        backend: 'webgpu',
        stateBuffer: tracker.buffer('g2p-state'),
        mechanicsBuffer: tracker.buffer('g2p-mechanics'),
        stateBufferByteLength: result.state.byteLength,
        mechanicsBufferByteLength: result.mechanics.byteLength,
        retainedOutputParticleBuffers: true,
        destroyOutputParticleBuffers() {
          this.stateBuffer.destroy();
          this.mechanicsBuffer.destroy();
        }
      };
    }
  });

  assert.equal(step.backend, 'webgpu');
  assert.equal(step.status, 'resident-step-webgpu-executed');
  assert.equal(step.stageStatus.p2g, 'webgpu-executed');
  assert.equal(step.stageStatus.gridUpdate, 'webgpu-executed');
  assert.equal(step.stageStatus.g2p, 'webgpu-executed');
  assert.equal(step.residentBuffersRetained, true);
  assert.equal(step.stageBuffersRetained, true);
  assert.equal(step.g2pOutputBuffersRetained, true);
  assert.equal(step.residentBufferMode, 'retained-stage-and-output-buffers');
  assert.equal(step.nextParticleStateBufferByteLength, step.state.byteLength);
  assert.equal(step.nextParticleMechanicsBufferByteLength, step.mechanics.byteLength);
  assert.equal(step.nextParticleBufferMode, 'retained-g2p-output-buffers');
  assert.deepEqual(step.particlePingPong, {
    sourceSlot: 0,
    nextSlot: 1,
    step: 0,
    nextStep: 1,
    time: 0,
    nextTime: 0.1
  });
  assert.equal(step.nextParticleUploads.sphParticleUpload.slot, 1);
  assert.equal(step.nextParticleUploads.sphParticleUpload.ownsStateBuffer, true);
  assert.equal(step.nextParticleUploads.sphParticleUpload.ownsThermoBuffer, false);
  assert.equal(step.nextParticleUploads.sphParticleUpload.thermoBuffer, sourceThermoBuffer);
  assert.equal(step.nextParticleUploads.sphParticleUpload.identityBuffer, sourceIdentityBuffer);
  assert.equal(step.nextParticleUploads.sphParticleUpload.ownsIdentityBuffer, true);
  assert.equal(
    step.nextParticleUploads.sphParticleUpload.identityOwnership,
    'owned-source-to-continuation-transfer'
  );
  assert.equal(sourceSphUpload.ownsIdentityBuffer, false);
  assert.equal(sourceSphUpload.identityOwnership, 'transferred-to-next-resident-continuation');
  assert.equal(step.nextParticleUploads.mlsMpmParticleUpload.slot, 1);
  assert.equal(step.nextParticleUploads.mlsMpmParticleUpload.ownsMechanicsBuffer, true);
  const nextParticleDevice = step.nextParticleUploads.sphParticleUpload
    .stateBuffer.__peercomputeUlgWebGpuDevice;
  assert.ok(nextParticleDevice);
  assert.equal(
    step.nextParticleUploads.sphParticleUpload.thermoBuffer.__peercomputeUlgWebGpuDevice,
    nextParticleDevice
  );
  assert.equal(
    step.nextParticleUploads.mlsMpmParticleUpload.mechanicsBuffer.__peercomputeUlgWebGpuDevice,
    nextParticleDevice
  );
  assert.equal(step.diagnostics.activeGridNodeCount > 0, true);
  assert.equal(step.diagnostics.sourceMomentumKgMPerS[0], 16);
  assert.equal(Number.isFinite(step.diagnostics.maxSpeedMPerS), true);
  assert.equal(tracker.destroyed, 0);
  destroyMlsMpmResidentStepBuffers(step);
  assert.equal(tracker.destroyed, 4);
  assert.equal(identityDestroyCount, 1);
});

test('MLS-MPM resident step treats one exact mechanics field as retained stage storage', async () => {
  const buffers = manualBuffers();
  const tracker = fakeBufferTracker();
  let fieldDestroyCount = 0;
  const fieldBuffer = {
    label: 'retained-mechanics-field',
    size: 4096,
    destroy() { fieldDestroyCount += 1; }
  };
  const fieldExecution = {
    fieldViewBuffer: fieldBuffer,
    submitPerformed: true,
    ownerRuntime: {
      ownsExecution(candidate) { return candidate === fieldExecution; },
      isExecutionSubmitted(candidate) {
        return candidate === fieldExecution && candidate.submitPerformed === true;
      }
    }
  };
  let projection = null;
  const step = await runMlsMpmResidentStepWithOptionalWebGpu({
    ...buffers,
    preferWebGpu: true,
    navigatorRef: webGpuNavigator(),
    boxDimsM: [3, 3, 3],
    readbackMode: 'no-full-readback',
    p2gRunner(args) {
      const result = projectMlsMpmP2gGridCpu(args);
      projection = {
        ...result,
        backend: 'webgpu',
        readbackMode: 'no-full-readback',
        fullReadbackPerformed: false,
        normalHotLoopReadbackFree: true,
        gridBuffer: null,
        gridBufferByteLength: 0,
        denseGridAuthoritative: false,
        gridStateAuthority: 'schroeder-spatial-mechanics-field-view-v1',
        mechanicsFieldViewEnabled: true,
        mechanicsFieldViewExecution: fieldExecution,
        mechanicsFieldViewBuffer: fieldBuffer,
        mechanicsFieldViewByteLength: fieldBuffer.size,
        mechanicsFieldMutationOutputOrdinal: 1,
        mechanicsFieldMutationOutputStateEncoding:
          SCHROEDER_SPATIAL_MECHANICS_FIELD_STATE_ENCODING_MASS_MOMENTUM_GRADIENT
      };
      return projection;
    },
    gridUpdateRunner(args) {
      assert.equal(args.p2gGridBuffer, null);
      const result = updateMlsMpmGridCpu(args);
      return {
        ...result,
        backend: 'webgpu',
        readbackMode: 'no-full-readback',
        fullReadbackPerformed: false,
        normalHotLoopReadbackFree: true,
        sourceProjection: projection,
        updatedGridBuffer: null,
        updatedGridBufferByteLength: 0,
        denseGridAuthoritative: false,
        gridStateAuthority: 'schroeder-spatial-mechanics-field-view-v1',
        mechanicsFieldViewEnabled: true,
        mechanicsFieldViewExecution: fieldExecution,
        mechanicsFieldViewBuffer: fieldBuffer,
        mechanicsFieldViewByteLength: fieldBuffer.size,
        mechanicsFieldMutationInputOrdinal: 1,
        mechanicsFieldMutationOutputOrdinal: 2,
        mechanicsFieldMutationOutputStateEncoding:
          SCHROEDER_SPATIAL_MECHANICS_FIELD_STATE_ENCODING_MASS_VELOCITY_GRADIENT
      };
    },
    g2pRunner(args) {
      assert.equal(args.updatedGridBuffer, null);
      const result = reconstructMlsMpmG2pCpu(args);
      return {
        ...result,
        backend: 'webgpu',
        readbackMode: 'no-full-readback',
        fullReadbackPerformed: false,
        normalHotLoopReadbackFree: true,
        stateBuffer: tracker.buffer('field-g2p-state'),
        mechanicsBuffer: tracker.buffer('field-g2p-mechanics'),
        stateBufferByteLength: result.state.byteLength,
        mechanicsBufferByteLength: result.mechanics.byteLength,
        retainedOutputParticleBuffers: true,
        destroyOutputParticleBuffers() {
          this.stateBuffer.destroy();
          this.mechanicsBuffer.destroy();
        }
      };
    }
  });

  assert.equal(step.stageBuffersRetained, true);
  assert.equal(step.residentBuffersRetained, true);
  assert.equal(step.readbackMode, 'no-full-readback');
  assert.equal(step.readbackDowngradeReasons.includes('stage-buffers-not-retained'), false);
  assert.equal(step.p2gGridProjection.gridBuffer ?? null, null);
  assert.equal(step.gridUpdate.updatedGridBuffer ?? null, null);
  assert.equal(fieldDestroyCount, 0);
  destroyMlsMpmResidentStepBuffers(step);
  assert.equal(fieldDestroyCount, 0);
});

test('MLS-MPM resident step cleanup destroys locally retained hierarchy render buffers', () => {
  const destroyCounts = { activeNode: 0, aggregateNode: 0 };
  const activeNodeBuffer = {
    label: 'locally-retained-active-node-buffer',
    destroy() {
      destroyCounts.activeNode += 1;
    }
  };
  const aggregateNodeBuffer = {
    label: 'locally-retained-hierarchy-aggregate-node-buffer',
    destroy() {
      destroyCounts.aggregateNode += 1;
    }
  };
  let resolverDestroyCalls = 0;
  const localRetainedRenderBuffers = {
    schema: 'peercompute.ulg.schroeder-local-retained-render-buffer-resolver.v0',
    buffers: [
      { buffer: activeNodeBuffer },
      { gpuBuffer: aggregateNodeBuffer }
    ],
    destroyRetainedBuffers() {
      resolverDestroyCalls += 1;
      activeNodeBuffer.destroy();
      aggregateNodeBuffer.destroy();
      return true;
    }
  };

  destroyMlsMpmResidentStepBuffers({ localRetainedRenderBuffers });

  assert.equal(resolverDestroyCalls, 1);
  assert.deepEqual(destroyCounts, { activeNode: 1, aggregateNode: 1 });
});

test('MLS-MPM resident cleanup retires continuation buffers before finalizing after an earlier destroyer throws', async () => {
  const buffers = {
    particleStateBuffer: { label: 'continued-state', destroyCount: 0, destroy() { this.destroyCount += 1; } },
    particleThermoBuffer: { label: 'continued-thermo', destroyCount: 0, destroy() { this.destroyCount += 1; } },
    particleMechanicsBuffer: { label: 'continued-mechanics', destroyCount: 0, destroy() { this.destroyCount += 1; } },
    particleIdentityBuffer: { label: 'continued-identity', destroyCount: 0, destroy() { this.destroyCount += 1; } }
  };
  const ledger = createSchroederHierarchyArtifactLedger({
    ledgerId: 'resident-throwing-cleanup-continuation'
  });
  registerSchroederHierarchyArtifactFamily(ledger, {
    family: 'particle-storage-compaction',
    artifact: buffers
  });
  transferSchroederHierarchyArtifactFamily(ledger, 'particle-storage-compaction', {
    roles: ['particle-state', 'particle-thermo', 'particle-mechanics', 'particle-identity'],
    transferClass: 'continuation',
    retirementAuthority: 'external-owner'
  });
  await scheduleSchroederHierarchyArtifactRetirement(ledger, {
    after: Promise.resolve()
  });
  const step = {
    schroederHierarchyArtifactLedger: ledger,
    nextParticleUploads: {
      sphParticleUpload: {
        stateBuffer: buffers.particleStateBuffer,
        thermoBuffer: buffers.particleThermoBuffer,
        identityBuffer: buffers.particleIdentityBuffer
      },
      mlsMpmParticleUpload: {
        mechanicsBuffer: buffers.particleMechanicsBuffer
      }
    },
    localRetainedRenderBuffers: {
      buffers: [{ buffer: { label: 'throwing-render-buffer' } }],
      destroyRetainedBuffers() {
        throw new Error('intentional render cleanup failure');
      }
    },
    releaseSchroederHierarchyArtifactTransfers(options) {
      return releaseSchroederHierarchyArtifactTransfers(ledger, options);
    }
  };

  assert.throws(
    () => destroyMlsMpmResidentStepBuffers(step),
    /intentional render cleanup failure/
  );
  assert.deepEqual(
    Object.values(buffers).map((buffer) => buffer.destroyCount),
    [1, 1, 1, 1]
  );
  const summary = summarizeSchroederHierarchyArtifactLedger(ledger);
  assert.equal(summary.pendingTransferCount, 0);
  assert.equal(summary.unretiredOwnedResourceCount, 0);
  assert.ok(Object.values(summary.resources).every((resource) => resource.externallyOwned));
});

test('MLS-MPM resident cleanup finalizes successful continuation siblings once and keeps a failed destroy active', async () => {
  const buffers = {
    particleStateBuffer: {
      label: 'failed-continued-state',
      destroyCount: 0,
      destroy() {
        this.destroyCount += 1;
        throw new Error('intentional continuation destroy failure');
      }
    },
    particleThermoBuffer: {
      label: 'continued-thermo-after-failure',
      destroyCount: 0,
      destroy() { this.destroyCount += 1; }
    },
    particleMechanicsBuffer: {
      label: 'continued-mechanics-after-failure',
      destroyCount: 0,
      destroy() { this.destroyCount += 1; }
    },
    particleIdentityBuffer: {
      label: 'continued-identity-after-failure',
      destroyCount: 0,
      destroy() { this.destroyCount += 1; }
    }
  };
  const ledger = createSchroederHierarchyArtifactLedger({
    ledgerId: 'resident-partial-failure-cleanup-continuation'
  });
  registerSchroederHierarchyArtifactFamily(ledger, {
    family: 'particle-storage-compaction',
    artifact: buffers
  });
  transferSchroederHierarchyArtifactFamily(ledger, 'particle-storage-compaction', {
    roles: ['particle-state', 'particle-thermo', 'particle-mechanics', 'particle-identity'],
    transferClass: 'continuation',
    retirementAuthority: 'external-owner'
  });
  await scheduleSchroederHierarchyArtifactRetirement(ledger, {
    after: Promise.resolve()
  });
  const step = {
    schroederHierarchyArtifactLedger: ledger,
    nextParticleUploads: {
      sphParticleUpload: {
        stateBuffer: buffers.particleStateBuffer,
        thermoBuffer: buffers.particleThermoBuffer,
        identityBuffer: buffers.particleIdentityBuffer
      },
      mlsMpmParticleUpload: {
        mechanicsBuffer: buffers.particleMechanicsBuffer
      }
    },
    localRetainedRenderBuffers: {
      buffers: [{ buffer: { label: 'throwing-render-buffer-before-partial-failure' } }],
      destroyRetainedBuffers() {
        throw new Error('intentional early render cleanup failure');
      }
    },
    releaseSchroederHierarchyArtifactTransfers(options) {
      return releaseSchroederHierarchyArtifactTransfers(ledger, options);
    }
  };

  assert.throws(
    () => destroyMlsMpmResidentStepBuffers(step),
    /intentional early render cleanup failure/
  );
  assert.deepEqual(
    Object.values(buffers).map((buffer) => buffer.destroyCount),
    [1, 1, 1, 1]
  );
  const summary = summarizeSchroederHierarchyArtifactLedger(ledger);
  assert.equal(summary.pendingTransferCount, 1);
  assert.equal(summary.unretiredOwnedResourceCount, 1);
  assert.equal(
    summary.resources['particle-storage-compaction:particle-state'].transfer.status,
    'active'
  );
  assert.equal(
    summary.resources['particle-storage-compaction:particle-state'].externallyOwned,
    false
  );
  for (const role of ['particle-thermo', 'particle-mechanics', 'particle-identity']) {
    const resource = summary.resources[`particle-storage-compaction:${role}`];
    assert.equal(resource.transfer.status, 'ownership-transferred');
    assert.equal(resource.externallyOwned, true);
  }
});

test('MLS-MPM resident cleanup never destroys ledger-classified borrowed materialization buffers', () => {
  const tracker = fakeBufferTracker();
  const materialization = {
    particleStateBuffer: tracker.buffer('borrowed-materialized-state'),
    particleThermoBuffer: tracker.buffer('borrowed-materialized-thermo'),
    particleMechanicsBuffer: tracker.buffer('borrowed-materialized-mechanics'),
    particleIdentityBuffer: tracker.buffer('borrowed-materialized-identity'),
    materializationBuffer: tracker.buffer('borrowed-materialization-rows')
  };
  const ledger = createSchroederHierarchyArtifactLedger({
    ledgerId: 'resident-borrowed-materialization-cleanup'
  });
  registerSchroederHierarchyArtifactFamily(ledger, {
    family: 'particle-storage-materialization',
    artifact: materialization,
    owned: false
  });

  destroyMlsMpmResidentStepBuffers({
    schroederHierarchyArtifactLedger: ledger,
    schroederParticleStorageMaterialization: materialization
  });

  const summary = summarizeSchroederHierarchyArtifactLedger(ledger);
  assert.equal(tracker.destroyed, 0);
  assert.equal(summary.borrowedResourceCount, 5);
  assert.equal(summary.destroyedResourceCount, 0);
});

test('MLS-MPM resident step cleanup releases unpreserved hierarchy render families independently', () => {
  const activeNodeBuffer = { label: 'preserved-active-node-buffer' };
  const aggregateNodeBuffer = { label: 'retired-aggregate-node-buffer' };
  const releasedFamilies = [];
  const localRetainedRenderBuffers = {
    schema: 'peercompute.ulg.schroeder-local-retained-render-buffer-resolver.v0',
    scopedFamilyRelease: true,
    buffers: [
      { family: 'schroeder-active-node-list', buffer: activeNodeBuffer },
      { family: 'schroeder-hierarchy-aggregate-node', gpuBuffer: aggregateNodeBuffer }
    ],
    destroyRetainedBuffers({ families = [] } = {}) {
      releasedFamilies.push(...families);
      return true;
    }
  };

  destroyMlsMpmResidentStepBuffers(
    { localRetainedRenderBuffers },
    { preserveBuffers: [activeNodeBuffer] }
  );

  assert.deepEqual(releasedFamilies, ['schroeder-hierarchy-aggregate-node']);
});

test('MLS-MPM resident step cleanup preserves a live level overlay until its consumer releases it', () => {
  const levelUpdateBuffer = { label: 'next-tick-level-update' };
  const transferReleases = [];
  const createStep = () => ({
    schroederPhaseVolumeNextTickAssignmentOverlay: { levelUpdateBuffer },
    releaseSchroederHierarchyArtifactTransfers(options) {
      transferReleases.push(options);
    }
  });

  destroyMlsMpmResidentStepBuffers(createStep(), {
    preserveBuffers: [levelUpdateBuffer]
  });
  assert.equal(
    transferReleases.some((release) => release.families === 'phase-volume-level-update'),
    false
  );

  destroyMlsMpmResidentStepBuffers(createStep());
  const overlayReleases = transferReleases.filter(
    (release) => release.families === 'phase-volume-level-update'
  );
  assert.equal(overlayReleases.length, 1);
  assert.equal(overlayReleases[0].transferClass, 'next-tick');
  assert.equal(overlayReleases[0].submitted, true);
});

test('MLS-MPM resident step cleanup releases intermediate gas but preserves a published gas owner', () => {
  const gasPressureCellsBuffer = { label: 'next-tick-gas-pressure-cells' };
  const transferReleases = [];
  const createStep = () => ({
    schroederFarAggregateGasCellImport: {
      gasPressureCellsBuffer,
      pressureInterfaceGasPressureCellsBuffer: gasPressureCellsBuffer
    },
    releaseSchroederHierarchyArtifactTransfers(options) {
      transferReleases.push(options);
    }
  });

  destroyMlsMpmResidentStepBuffers(createStep(), {
    preserveBuffers: [gasPressureCellsBuffer]
  });
  assert.equal(
    transferReleases.some((release) => release.families === 'far-aggregate-gas-cell-import'),
    false
  );

  destroyMlsMpmResidentStepBuffers(createStep());
  const gasReleases = transferReleases.filter(
    (release) => release.families === 'far-aggregate-gas-cell-import'
  );
  assert.equal(gasReleases.length, 1);
  assert.equal(gasReleases[0].transferClass, 'next-tick');
  assert.equal(gasReleases[0].submitted, true);
});

test('MLS-MPM resident step cleanup preserves continuation buffers requested by the next owner', async () => {
  const buffers = manualBuffers();
  const tracker = fakeBufferTracker();
  const sourceThermoBuffer = tracker.buffer('source-thermo');
  const step = await runMlsMpmResidentStepWithOptionalWebGpu({
    ...buffers,
    sphParticleUpload: {
      status: 'webgpu-uploaded',
      stateBuffer: tracker.buffer('source-state'),
      thermoBuffer: sourceThermoBuffer,
      slot: 0
    },
    mlsMpmParticleUpload: {
      status: 'webgpu-uploaded',
      mechanicsBuffer: tracker.buffer('source-mechanics'),
      slot: 0
    },
    preferWebGpu: true,
    navigatorRef: webGpuNavigator(),
    readbackMode: 'no-full-readback',
    boxDimsM: [3, 3, 3],
    p2gRunner(args) {
      const projection = projectMlsMpmP2gGridCpu(args);
      return {
        ...projection,
        backend: 'webgpu',
        readbackMode: 'no-full-readback',
        fullReadbackPerformed: false,
        gridBuffer: tracker.buffer('p2g-grid'),
        destroyGridBuffer() {
          this.gridBuffer.destroy();
        }
      };
    },
    gridUpdateRunner(args) {
      const update = updateMlsMpmGridCpu(args);
      return {
        ...update,
        backend: 'webgpu',
        readbackMode: 'no-full-readback',
        fullReadbackPerformed: false,
        updatedGridBuffer: tracker.buffer('updated-grid'),
        destroyUpdatedGridBuffer() {
          this.updatedGridBuffer.destroy();
        }
      };
    },
    g2pRunner(args) {
      const reconstruction = reconstructMlsMpmG2pCpu(args);
      const stateBuffer = tracker.buffer('next-state');
      const mechanicsBuffer = tracker.buffer('next-mechanics');
      return {
        ...reconstruction,
        backend: 'webgpu',
        readbackMode: 'no-full-readback',
        fullReadbackPerformed: false,
        stateBuffer,
        mechanicsBuffer,
        retainedOutputParticleBuffers: true,
        destroyOutputParticleBuffers() {
          stateBuffer.destroy();
          mechanicsBuffer.destroy();
        }
      };
    }
  });

  const continuationBuffers = [
    step.nextParticleUploads.sphParticleUpload.stateBuffer,
    step.nextParticleUploads.sphParticleUpload.thermoBuffer,
    step.nextParticleUploads.mlsMpmParticleUpload.mechanicsBuffer
  ];
  destroyMlsMpmResidentStepBuffers(step, { preserveBuffers: continuationBuffers });
  assert.equal(tracker.destroyed, 2);
});

test('MLS-MPM resident step falls forward through CPU stages after a WebGPU parity failure', async () => {
  const buffers = manualBuffers();
  const step = await runMlsMpmResidentStepWithOptionalWebGpu({
    ...buffers,
    preferWebGpu: true,
    navigatorRef: webGpuNavigator(),
    boxDimsM: [3, 3, 3],
    p2gRunner(args) {
      const result = projectMlsMpmP2gGridCpu(args);
      result.gridNodes = result.gridNodes.slice();
      result.gridNodes[0] += 100;
      return { ...result, backend: 'webgpu' };
    },
    parityTolerances: { p2g: 1e-9 }
  });

  assert.equal(step.backend, 'cpu-reference');
  assert.equal(step.stageStatus.p2g, 'webgpu-parity-failed');
  assert.equal(step.stageBackends.p2g, 'cpu-reference');
  assert.equal(step.stageBackends.gridUpdate, 'cpu-reference');
  assert.equal(step.stageBackends.g2p, 'cpu-reference');
  assert.equal(step.residentBuffersRetained, false);
  assert.equal(step.fullPhysicsValidation, false);
});

test('MLS-MPM resident step can retain buffers without full readback', async () => {
  const buffers = manualBuffers();
  const tracker = fakeBufferTracker();
  const gpuResidentLaneManager = fakeGpuResidentLaneManager();
  const sourceThermoBuffer = tracker.buffer('source-thermo');
  const p2gInputs = [];
  const step = await runMlsMpmResidentStepWithOptionalWebGpu({
    ...buffers,
    sphParticleUpload: {
      status: 'webgpu-uploaded',
      stateBuffer: tracker.buffer('source-state'),
      thermoBuffer: sourceThermoBuffer,
      slot: 0
    },
    mlsMpmParticleUpload: {
      status: 'webgpu-uploaded',
      mechanicsBuffer: tracker.buffer('source-mechanics'),
      slot: 0
    },
    preferWebGpu: true,
    navigatorRef: webGpuNavigator(),
    boxDimsM: [3, 3, 3],
    readbackMode: 'no-full-readback',
    gpuResidentLaneManager,
    gpuResidentLaneId: 'ulg:test:sph-resident',
    gpuResidentLaneStateKey: 'ulg:test:sph-resident-state',
    gpuResidentLaneDomainKey: 'ulg:test-domain',
    p2gRunner(args) {
      p2gInputs.push({
        readbackMode: args.readbackMode,
        stateBufferLabel: args.sphParticleUpload?.stateBuffer?.label ?? null
      });
      return {
        schema: ULG_MLS_MPM_GPU_GRID_PROJECTION_SCHEMA,
        backend: 'webgpu',
        status: 'projected',
        particleCount: buffers.sphParticleState.particleCount,
        dt: buffers.mlsMpmParticleState.mechanicsDtS,
        gridSpacingM: buffers.sphParticleState.smoothingLengthM,
        gridDims: [8, 8, 8],
        gridNodeCount: 512,
        gridShift: 1,
        gridNodeStrideFloats: 8,
        gridNodes: new Float32Array(),
        gridBuffer: tracker.buffer('p2g-grid-unread'),
        gridBufferByteLength: 512 * 8 * Float32Array.BYTES_PER_ELEMENT,
        readbackMode: 'no-full-readback',
        normalHotLoopReadbackFree: true,
        destroyGridBuffer() {
          this.gridBuffer.destroy();
        }
      };
    },
    gridUpdateRunner(args) {
      assert.equal(args.readbackMode, 'no-full-readback');
      assert.equal(args.p2gGridBuffer?.label, 'p2g-grid-unread');
      return {
        schema: ULG_MLS_MPM_GPU_GRID_UPDATE_SCHEMA,
        backend: 'webgpu',
        status: 'updated',
        sourceSchema: args.p2gGridProjection.schema,
        particleCount: buffers.sphParticleState.particleCount,
        dt: buffers.mlsMpmParticleState.mechanicsDtS,
        gridSpacingM: buffers.sphParticleState.smoothingLengthM,
        gridDims: [8, 8, 8],
        gridNodeCount: 512,
        gridShift: 1,
        gridNodeStrideFloats: 8,
        updatedGridNodes: new Float32Array(),
        updatedGridBuffer: tracker.buffer('updated-grid-unread'),
        updatedGridBufferByteLength: 512 * 8 * Float32Array.BYTES_PER_ELEMENT,
        readbackMode: 'no-full-readback',
        normalHotLoopReadbackFree: true,
        queueCompletionStatus: 'queue-work-completed',
        queueCompletionMethod: 'queue.onSubmittedWorkDone',
        destroyUpdatedGridBuffer() {
          this.updatedGridBuffer.destroy();
        }
      };
    },
    g2pRunner(args) {
      assert.equal(args.readbackMode, 'no-full-readback');
      assert.equal(args.updatedGridBuffer?.label, 'updated-grid-unread');
      assert.equal(args.retainOutputParticleBuffers, true);
      return {
        schema: ULG_MLS_MPM_GPU_G2P_RECONSTRUCTION_SCHEMA,
        backend: 'webgpu',
        status: 'reconstructed',
        particleCount: buffers.sphParticleState.particleCount,
        gridNodeCount: 512,
        gridSpacingM: buffers.sphParticleState.smoothingLengthM,
        gridDims: [8, 8, 8],
        gridShift: 1,
        dt: buffers.mlsMpmParticleState.mechanicsDtS,
        stateStrideFloats: 8,
        thermoStrideFloats: 12,
        mechanicsStrideFloats: 32,
        state: new Float32Array(),
        mechanics: new Float32Array(),
        stateBuffer: tracker.buffer('g2p-state-unread'),
        mechanicsBuffer: tracker.buffer('g2p-mechanics-unread'),
        stateBufferByteLength: buffers.sphParticleState.state.byteLength,
        mechanicsBufferByteLength: buffers.mlsMpmParticleState.mechanics.byteLength,
        retainedOutputParticleBuffers: true,
        readbackMode: 'no-full-readback',
        normalHotLoopReadbackFree: true,
        destroyOutputParticleBuffers() {
          this.stateBuffer.destroy();
          this.mechanicsBuffer.destroy();
        }
      };
    }
  });

  assert.equal(p2gInputs[0].readbackMode, 'no-full-readback');
  assert.equal(p2gInputs[0].stateBufferLabel, 'source-state');
  assert.equal(step.backend, 'webgpu');
  assert.equal(step.status, 'resident-step-webgpu-executed');
  assert.equal(step.stageStatus.p2g, 'webgpu-executed-no-full-readback');
  assert.equal(step.stageStatus.gridUpdate, 'webgpu-executed-no-full-readback');
  assert.equal(step.stageStatus.g2p, 'webgpu-executed-no-full-readback');
  assert.equal(step.readbackMode, 'no-full-readback');
  assert.equal(step.normalHotLoopReadbackFree, true);
  assert.equal(step.renderStateReadbackAvailable, false);
  assert.equal(step.gpuAuthoritativeState, false);
  assert.equal(step.residentBuffersRetained, true);
  assert.equal(step.residentAuthorityLedgerStatus, 'resident-authority-ledger-ready');
  assert.equal(step.residentAuthorityFamilyOwners[RESIDENT_STATE_FAMILIES.PARTICLE_KINEMATICS].ownerStage, 'g2p');
  assert.equal(step.residentAuthorityFamilyOwners[RESIDENT_STATE_FAMILIES.MECHANICS].ownerStage, 'g2p');
  assert.ok(step.residentAuthorityWarnings.includes('cpu-mirrors-stale-unless-admitted-readback'));
  assert.equal(step.diagnostics.residentAuthorityLedgerStatus, 'resident-authority-ledger-ready');
  assert.equal(step.nextParticleBufferMode, 'retained-g2p-output-buffers');
  assert.equal(step.nextParticleStateBufferByteLength, buffers.sphParticleState.state.byteLength);
  assert.equal(step.nextParticleMechanicsBufferByteLength, buffers.mlsMpmParticleState.mechanics.byteLength);
  assert.equal(step.state.length, 0);
  assert.equal(step.mechanics.length, 0);
  assert.equal(step.p2gGridProjection.webgpuParity.status, 'not-run-no-full-readback');
  assert.equal(step.gridUpdate.webgpuParity.status, 'not-run-no-full-readback');
  assert.equal(step.g2pReconstruction.webgpuParity.status, 'not-run-no-full-readback');
  assert.equal(step.diagnostics.activeGridNodeCount, null);
  assert.equal(step.diagnostics.massDeltaKg, null);
  assert.equal(step.diagnostics.compactGpuSummaryAvailable, false);
  assert.equal(gpuResidentLaneManager.calls.acquire.length, 1);
  assert.equal(gpuResidentLaneManager.calls.complete.length, 1);
  assert.equal(gpuResidentLaneManager.calls.reject.length, 0);
  assert.equal(gpuResidentLaneManager.activeLeaseCount, 0);
  assert.equal(gpuResidentLaneManager.calls.acquire[0].spec.laneId, 'ulg:test:sph-resident');
  assert.equal(gpuResidentLaneManager.calls.acquire[0].spec.stateKey, 'ulg:test:sph-resident-state');
  assert.equal(gpuResidentLaneManager.calls.acquire[0].spec.domainKey, 'ulg:test-domain');
  assert.equal(gpuResidentLaneManager.calls.acquire[0].spec.copyBudget.uploadBytes, 0);
  assert.equal(gpuResidentLaneManager.calls.acquire[0].spec.copyBudget.readbackBytes, MLS_MPM_GPU_RESIDENT_SUMMARY_BYTES);
  assert.equal(gpuResidentLaneManager.calls.acquire[0].spec.copyBudget.retainedBytes, buffers.sphParticleState.state.byteLength + buffers.sphParticleState.thermo.byteLength + buffers.mlsMpmParticleState.mechanics.byteLength);
  assert.equal(gpuResidentLaneManager.calls.acquire[0].spec.copyBudget.compactSummaryBytes, MLS_MPM_GPU_RESIDENT_SUMMARY_BYTES);
  assert.equal(gpuResidentLaneManager.calls.complete[0].options.queueCompletionStatus, 'queue-work-completed');
  assert.equal(gpuResidentLaneManager.calls.complete[0].options.queueCompletionMethod, 'queue.onSubmittedWorkDone');
  assert.deepEqual(gpuResidentLaneManager.calls.complete[0].options.retainedBufferRefs, [
    'p2g-grid-buffer',
    'updated-grid-buffer',
    'sph-state-buffer',
    'sph-thermo-buffer',
    'mls-mpm-mechanics-buffer'
  ]);
  assert.equal(step.gpuResidentLane.schema, 'peercompute.ulg.mls-mpm-resident-gpu-lane-adapter.v0');
  assert.equal(step.gpuResidentLaneStatus, 'gpu-resident-lane-completed');
  assert.equal(step.gpuResidentLaneLeaseId, gpuResidentLaneManager.calls.acquire[0].lease.leaseId);
  assert.equal(step.gpuResidentLaneFenceStatus, 'queue-work-completed');
  assert.equal(step.gpuResidentLaneFenceSatisfied, true);
  assert.deepEqual(step.gpuResidentLaneRetainedBufferRefs, [
    'p2g-grid-buffer',
    'updated-grid-buffer',
    'sph-state-buffer',
    'sph-thermo-buffer',
    'mls-mpm-mechanics-buffer'
  ]);
  assert.equal(step.diagnostics.gpuResidentLaneStatus, 'gpu-resident-lane-completed');
  assert.equal(step.diagnostics.gpuResidentLaneLeaseId, gpuResidentLaneManager.calls.acquire[0].lease.leaseId);
  assert.equal(step.diagnostics.gpuResidentLaneFenceStatus, 'queue-work-completed');
  assert.equal(step.diagnostics.gpuResidentLaneFenceSatisfied, true);
  assert.equal(step.diagnostics.gpuResidentLaneRetainedBufferRefCount, 5);
  assert.equal(step.nextParticleUploads.sphParticleUpload.thermoBuffer, sourceThermoBuffer);
  assert.equal(tracker.destroyed, 0);
  destroyMlsMpmResidentStepBuffers(step);
  assert.equal(tracker.destroyed, 4);
});

test('MLS-MPM resident step fuses admitted Schroeder far-force deltas into next resident state', async () => {
  const { buffers, tracker, sourceThermoBuffer, options } = noFullReadbackResidentStepFixture();
  const fusedStateBuffer = tracker.buffer('schroeder-far-force-fused-state');
  const forceApplicationBuffer = tracker.buffer('schroeder-force-application');
  const schroederFarAggregateForceApplication = {
    schema: ULG_SCHROEDER_FAR_AGGREGATE_FORCE_APPLICATION_EXECUTION_SCHEMA,
    status: 'schroeder-far-aggregate-force-application-submitted',
    forceApplicationRowCount: 1,
    forceApplicationStrideFloats: SCHROEDER_FAR_AGGREGATE_FORCE_APPLICATION_ROW_LAYOUT.length,
    forceApplicationBuffer,
    farAggregateForceApplicationAdmissionApproved: true,
    stateMutationRequired: true
  };
  let fusionCalls = 0;

  const step = await runMlsMpmResidentStepWithOptionalWebGpu({
    ...options,
    schroederFarAggregateForceApplication,
    schroederFarForceDeltaFusionRunner: async (args) => {
      fusionCalls += 1;
      assert.equal(args.sourceStateBuffer.label, 'g2p-state-unread');
      assert.equal(args.schroederFarAggregateForceApplication, schroederFarAggregateForceApplication);
      assert.equal(args.readbackMode, 'no-full-readback');
      return {
        schema: ULG_SCHROEDER_FAR_FORCE_DELTA_FUSION_EXECUTION_SCHEMA,
        backend: 'webgpu',
        status: 'schroeder-far-force-delta-fusion-submitted',
        readbackMode: 'no-full-readback',
        normalHotLoopReadbackFree: true,
        fullReadbackPerformed: false,
        particleCount: buffers.sphParticleState.particleCount,
        forceApplicationRowCount: 1,
        state: new Float32Array(),
        stateBuffer: fusedStateBuffer,
        outputStateBuffer: fusedStateBuffer,
        stateBufferByteLength: buffers.sphParticleState.state.byteLength,
        retainedOutputParticleBuffers: true,
        velocityDeltaFusionStatus: 'admitted-far-force-deltas-applied-to-sph-state-buffer',
        stateMutationStatus: 'admitted-far-force-delta-fused-state-buffer-submitted',
        stateAuthorityStatus: 'resident-state-manager-admitted-far-force-delta-state-owner',
        destroyOutputParticleBuffers() {
          fusedStateBuffer.destroy();
        }
      };
    }
  });

  assert.equal(fusionCalls, 1);
  assert.equal(step.schroederFarForceDeltaFusionStatus, 'schroeder-far-force-delta-fusion-submitted');
  assert.equal(step.schroederFarForceDeltaFusionVelocityDeltaStatus, 'admitted-far-force-deltas-applied-to-sph-state-buffer');
  assert.equal(step.schroederFarForceDeltaFusionStateMutationStatus, 'admitted-far-force-delta-fused-state-buffer-submitted');
  assert.equal(step.schroederFarForceDeltaFusionStateAuthorityStatus, 'resident-state-manager-admitted-far-force-delta-state-owner');
  assert.equal(step.schroederFarForceDeltaFusionRowCount, 1);
  assert.equal(step.schroederFarForceDeltaFusionStateBufferRetained, true);
  assert.equal(step.schroederFarForceDeltaFusionStateBufferByteLength, buffers.sphParticleState.state.byteLength);
  assert.equal(step.stageStatus.schroederFarForceDeltaFusion, 'schroeder-far-force-delta-fusion-submitted');
  assert.equal(step.stageBackends.schroederFarForceDeltaFusion, 'webgpu');
  assert.equal(step.nextParticleUploads.sphParticleUpload.stateBuffer, fusedStateBuffer);
  assert.equal(step.nextParticleUploads.sphParticleUpload.thermoBuffer, sourceThermoBuffer);
  assert.equal(step.nextParticleUploads.mlsMpmParticleUpload.mechanicsBuffer.label, 'g2p-mechanics-unread');
  assert.equal(step.nextParticleBufferMode, 'retained-schroeder-far-force-fused-state-and-g2p-mechanics-buffers');
  assert.equal(step.nextParticleStateBufferByteLength, buffers.sphParticleState.state.byteLength);
  assert.equal(step.nextParticleMechanicsBufferByteLength, buffers.mlsMpmParticleState.mechanics.byteLength);
  assert.equal(step.g2pStateBufferReplacedBySchroederFarForceDeltaFusion, true);
  assert.equal(step.g2pStateBufferReplacedByThermalStep, false);
  assert.equal(
    step.residentAuthorityFamilyOwners[RESIDENT_STATE_FAMILIES.PARTICLE_KINEMATICS].ownerStage,
    'schroeder-far-force-delta-fusion'
  );
  assert.equal(
    step.residentAuthorityFamilyOwners[RESIDENT_STATE_FAMILIES.SCHROEDER_FAR_FORCE].ownerStage,
    'schroeder-far-force-delta-fusion'
  );
  assert.equal(step.diagnostics.schroederFarForceDeltaFusionStatus, 'schroeder-far-force-delta-fusion-submitted');
  assert.equal(
    step.diagnostics.schroederFarForceDeltaFusionVelocityDeltaStatus,
    'admitted-far-force-deltas-applied-to-sph-state-buffer'
  );
  assert.equal(step.diagnostics.schroederFarForceDeltaFusionStateBufferRetained, true);
  assert.equal(step.diagnostics.schroederFarForceDeltaFusionReadbackMode, 'no-full-readback');
});

test('MLS-MPM resident step adopts admitted Schroeder materialized particle storage', async () => {
  const { buffers, tracker, options } = noFullReadbackResidentStepFixture();
  const materializedStateBuffer = tracker.buffer('schroeder-materialized-state');
  const materializedThermoBuffer = tracker.buffer('schroeder-materialized-thermo');
  const materializedMechanicsBuffer = tracker.buffer('schroeder-materialized-mechanics');
  const materializationBuffer = tracker.buffer('schroeder-materialization-rows');
  const outputParticleCapacity = 4;
  const schroederParticleStorageMaterialization = {
    schema: ULG_SCHROEDER_PARTICLE_STORAGE_MATERIALIZATION_EXECUTION_SCHEMA,
    backend: 'webgpu',
    status: 'schroeder-particle-storage-materialization-submitted',
    readbackMode: 'no-full-readback',
    normalHotLoopReadbackFree: true,
    particleStorageMaterializationAdmissionApproved: true,
    retainedParticleBuffers: true,
    retainedMaterializationBuffer: true,
    targetStateFamilies: [
      'sph-particle-state',
      'mls-mpm-particle-mechanics',
      'sph-particle-thermo'
    ],
    sourceParticleCount: buffers.sphParticleState.particleCount,
    outputParticleCapacity,
    particleStateBuffer: materializedStateBuffer,
    particleThermoBuffer: materializedThermoBuffer,
    particleMechanicsBuffer: materializedMechanicsBuffer,
    materializationBuffer,
    stateBufferByteLength: outputParticleCapacity * 8 * Float32Array.BYTES_PER_ELEMENT,
    thermoBufferByteLength: outputParticleCapacity * 12 * Float32Array.BYTES_PER_ELEMENT,
    mechanicsBufferByteLength: outputParticleCapacity * 32 * Float32Array.BYTES_PER_ELEMENT,
    materializationBufferByteLength: 3 * 32 * Float32Array.BYTES_PER_ELEMENT,
    materializationMode: 'state-manager-admitted-particle-buffer-materialization',
    replacementPolicy: 'retained-output-buffers-await-state-manager-swap',
    stateMutationStatus: 'particle-storage-materialization-buffer-submitted',
    stateAuthorityStatus: 'state-manager-admitted-particle-storage-materialization-materialized',
    queueCompletionStatus: 'queue-work-completed',
    queueCompletionMethod: 'queue.onSubmittedWorkDone'
  };

  const step = await runMlsMpmResidentStepWithOptionalWebGpu({
    ...options,
    schroederParticleStorageMaterialization
  });

  assert.equal(step.schroederParticleStorageAdoptionStatus, 'schroeder-particle-storage-adopted');
  assert.equal(step.schroederParticleStorageAdopted, true);
  assert.equal(
    step.schroederParticleStorageAdoptionMode,
    'state-manager-admitted-retained-particle-buffer-swap'
  );
  assert.equal(step.schroederParticleStorageMaterializationStatus, 'schroeder-particle-storage-materialization-submitted');
  // Adopted buffers carry capacity headroom, but the live particle count only
  // grows through an explicitly admitted split/merge count delta.
  assert.equal(step.schroederParticleStorageAuthoritativeParticleCount, buffers.sphParticleState.particleCount);
  assert.equal(step.nextParticleCount, buffers.sphParticleState.particleCount);
  assert.equal(step.nextParticleUploads.sphParticleUpload.particleCount, buffers.sphParticleState.particleCount);
  assert.equal(step.nextParticleUploads.mlsMpmParticleUpload.particleCount, buffers.sphParticleState.particleCount);
  assert.equal(step.nextParticleUploads.sphParticleUpload.stateBuffer, materializedStateBuffer);
  assert.equal(step.nextParticleUploads.sphParticleUpload.thermoBuffer, materializedThermoBuffer);
  assert.equal(step.nextParticleUploads.mlsMpmParticleUpload.mechanicsBuffer, materializedMechanicsBuffer);
  assert.equal(step.nextParticleUploads.sphParticleUpload.sourceStage, 'schroeder-particle-storage-materialization');
  assert.equal(step.nextParticleBufferMode, 'retained-schroeder-particle-storage-materialized-buffers');
  assert.equal(step.nextParticleStateBufferByteLength, outputParticleCapacity * 8 * Float32Array.BYTES_PER_ELEMENT);
  assert.equal(step.nextParticleThermoBufferByteLength, outputParticleCapacity * 12 * Float32Array.BYTES_PER_ELEMENT);
  assert.equal(step.nextParticleMechanicsBufferByteLength, outputParticleCapacity * 32 * Float32Array.BYTES_PER_ELEMENT);
  assert.equal(step.g2pStateBufferReplacedBySchroederParticleStorageMaterialization, true);
  assert.equal(step.g2pMechanicsBufferReplacedBySchroederParticleStorageMaterialization, true);
  assert.equal(step.sourceThermoBufferReplacedBySchroederParticleStorageMaterialization, true);
  assert.equal(
    step.residentAuthorityFamilyOwners[RESIDENT_STATE_FAMILIES.SCHROEDER_PARTICLE_STORAGE].ownerStage,
    'schroeder-particle-storage-materialization'
  );
  assert.equal(
    step.residentAuthorityFamilyOwners[RESIDENT_STATE_FAMILIES.PARTICLE_KINEMATICS].ownerStage,
    'schroeder-particle-storage-materialization'
  );
  assert.equal(
    step.residentAuthorityFamilyOwners[RESIDENT_STATE_FAMILIES.MECHANICS].ownerStage,
    'schroeder-particle-storage-materialization'
  );
  assert.equal(
    step.residentAuthorityFamilyOwners[RESIDENT_STATE_FAMILIES.THERMO_PHASE].ownerStage,
    'schroeder-particle-storage-materialization'
  );
  assert.equal(step.diagnostics.schroederParticleStorageAdopted, true);
  assert.equal(
    step.diagnostics.schroederParticleStorageAuthoritativeParticleCount,
    buffers.sphParticleState.particleCount
  );
  assert.equal(step.residentBufferLeaseActiveLeaseCount, 3);
  assert.equal(tracker.destroyed, 0);
  destroyMlsMpmResidentStepBuffers(step);
  assert.equal(tracker.destroyed, 8);
});

test('MLS-MPM resident step keeps no-full mode when optional Schroeder materialization is admission-blocked', async () => {
  const { options } = noFullReadbackResidentStepFixture();
  const schroederParticleStorageMaterialization = {
    schema: ULG_SCHROEDER_PARTICLE_STORAGE_MATERIALIZATION_EXECUTION_SCHEMA,
    backend: 'webgpu',
    status: 'schroeder-particle-storage-materialization-blocked-admission-required',
    readbackMode: 'no-full-readback',
    fullReadbackPerformed: false,
    fullParticleReadbackPerformed: false,
    normalHotLoopReadbackFree: true,
    particleStorageMaterializationAdmissionApproved: false,
    retainedParticleBuffers: false,
    retainedMaterializationBuffer: false,
    stateMutationRequired: false,
    stateMutationStatus: 'blocked-particle-storage-materialization-admission-required'
  };

  const step = await runMlsMpmResidentStepWithOptionalWebGpu({
    ...options,
    schroederParticleStorageMaterialization
  });

  assert.equal(step.readbackMode, 'no-full-readback');
  assert.equal(step.normalHotLoopReadbackFree, true);
  assert.deepEqual(step.readbackDowngradeReasons, []);
  assert.equal(step.schroederParticleStorageAdopted, false);
  assert.equal(step.nextParticleBufferMode, 'retained-g2p-output-buffers');
  destroyMlsMpmResidentStepBuffers(step);
});

test('MLS-MPM resident step strictly downgrades admitted Schroeder materialization with missing outputs', async () => {
  const { options } = noFullReadbackResidentStepFixture();
  const schroederParticleStorageMaterialization = {
    schema: ULG_SCHROEDER_PARTICLE_STORAGE_MATERIALIZATION_EXECUTION_SCHEMA,
    backend: 'webgpu',
    status: 'schroeder-particle-storage-materialization-submitted',
    readbackMode: 'no-full-readback',
    fullReadbackPerformed: false,
    fullParticleReadbackPerformed: false,
    normalHotLoopReadbackFree: true,
    particleStorageMaterializationAdmissionApproved: true,
    retainedParticleBuffers: false,
    retainedMaterializationBuffer: false,
    stateMutationRequired: true,
    stateMutationStatus: 'particle-storage-materialization-buffer-submitted'
  };

  const step = await runMlsMpmResidentStepWithOptionalWebGpu({
    ...options,
    schroederParticleStorageMaterialization
  });

  assert.equal(step.readbackMode, 'full-parity-readback');
  assert.equal(step.normalHotLoopReadbackFree, false);
  assert.deepEqual(step.readbackDowngradeReasons, [
    'schroeder-particle-storage-not-adopted'
  ]);
  assert.equal(step.schroederParticleStorageAdopted, false);
  assert.equal(step.nextParticleBufferMode, 'retained-g2p-output-buffers');
  destroyMlsMpmResidentStepBuffers(step);
});

test('MLS-MPM resident step carries admitted Schroeder gas state deltas as retained pressure descriptors', async () => {
  const { buffers, tracker, sourceThermoBuffer, options } = noFullReadbackResidentStepFixture();
  const gasStateDeltaBuffer = tracker.buffer('schroeder-gas-state-delta');
  const schroederFarAggregateGasStateDelta = {
    schema: ULG_SCHROEDER_FAR_AGGREGATE_GAS_STATE_DELTA_EXECUTION_SCHEMA,
    backend: 'webgpu',
    status: 'schroeder-far-aggregate-gas-state-delta-submitted',
    readbackMode: 'no-full-readback',
    normalHotLoopReadbackFree: true,
    fullParticleReadbackPerformed: false,
    lawConsumerRowCount: 1,
    gasStateDeltaRowCount: 1,
    stateDeltaRowCount: 1,
    gasStateDeltaStrideFloats: SCHROEDER_FAR_AGGREGATE_GAS_STATE_DELTA_ROW_LAYOUT.length,
    gasStateDeltaBuffer,
    gasStateDeltaBufferByteLength:
      SCHROEDER_FAR_AGGREGATE_GAS_STATE_DELTA_ROW_LAYOUT.length * Float32Array.BYTES_PER_ELEMENT,
    farAggregateGasStateDeltaAdmissionApproved: true,
    stateMutationRequired: true,
    stateMutationStatus: 'admitted-far-aggregate-gas-state-delta-buffer-submitted',
    stateAuthorityStatus: 'state-manager-admitted-retained-gas-state-delta-buffer',
    targetStateFamily: 'gas-pressure',
    pressureInterfaceImportRequired: true
  };

  const step = await runMlsMpmResidentStepWithOptionalWebGpu({
    ...options,
    schroederFarAggregateGasStateDelta
  });

  assert.equal(step.schroederFarAggregateGasStateDelta, schroederFarAggregateGasStateDelta);
  assert.equal(step.schroederFarAggregateGasStateDeltaStatus, 'schroeder-far-aggregate-gas-state-delta-submitted');
  assert.equal(
    step.schroederFarAggregateGasStateDeltaStateMutationStatus,
    'admitted-far-aggregate-gas-state-delta-buffer-submitted'
  );
  assert.equal(
    step.schroederFarAggregateGasStateDeltaStateAuthorityStatus,
    'state-manager-admitted-retained-gas-state-delta-buffer'
  );
  assert.equal(step.schroederFarAggregateGasStateDeltaTargetStateFamily, 'gas-pressure');
  assert.equal(step.schroederFarAggregateGasStateDeltaPressureInterfaceImportRequired, true);
  assert.equal(step.schroederFarAggregateGasStateDeltaRowCount, 1);
  assert.equal(step.schroederFarAggregateGasStateDeltaBufferRetained, true);
  assert.equal(
    step.schroederFarAggregateGasStateDeltaBufferByteLength,
    SCHROEDER_FAR_AGGREGATE_GAS_STATE_DELTA_ROW_LAYOUT.length * Float32Array.BYTES_PER_ELEMENT
  );
  assert.equal(step.stageStatus.schroederFarAggregateGasStateDelta, 'schroeder-far-aggregate-gas-state-delta-submitted');
  assert.equal(step.stageBackends.schroederFarAggregateGasStateDelta, 'webgpu');
  assert.equal(step.nextParticleUploads.sphParticleUpload.stateBuffer.label, 'g2p-state-unread');
  assert.equal(step.nextParticleUploads.sphParticleUpload.thermoBuffer, sourceThermoBuffer);
  assert.equal(step.nextParticleUploads.mlsMpmParticleUpload.mechanicsBuffer.label, 'g2p-mechanics-unread');
  assert.equal(step.nextParticleBufferMode, 'retained-g2p-output-buffers');
  assert.equal(
    step.diagnostics.schroederFarAggregateGasStateDeltaStatus,
    'schroeder-far-aggregate-gas-state-delta-submitted'
  );
  assert.equal(step.diagnostics.schroederFarAggregateGasStateDeltaTargetStateFamily, 'gas-pressure');
  assert.equal(step.diagnostics.schroederFarAggregateGasStateDeltaPressureInterfaceImportRequired, true);
  assert.equal(step.diagnostics.schroederFarAggregateGasStateDeltaBufferRetained, true);
});

test('MLS-MPM resident step carries Schroeder gas-cell imports as retained pressure descriptors', async () => {
  const { tracker, sourceThermoBuffer, options } = noFullReadbackResidentStepFixture();
  const gpuResidentLaneManager = fakeGpuResidentLaneManager();
  const gasPressureCellsBuffer = tracker.buffer('schroeder-gas-pressure-cells');
  const gasCellStride = SCHROEDER_FAR_AGGREGATE_GAS_CELL_IMPORT_ROW_LAYOUT.length;
  assert.equal(gasCellStride, SCHROEDER_FAR_AGGREGATE_GAS_CELL_IMPORT_FLOATS);
  const schroederFarAggregateGasCellImport = {
    schema: ULG_SCHROEDER_FAR_AGGREGATE_GAS_CELL_IMPORT_EXECUTION_SCHEMA,
    backend: 'webgpu',
    status: 'schroeder-far-aggregate-gas-cell-import-submitted',
    readbackMode: 'no-full-readback',
    normalHotLoopReadbackFree: true,
    fullParticleReadbackPerformed: false,
    gasPressureCellRowCount: 1,
    pressureInterfaceGasPressureCellRowCount: 1,
    gasPressureCellRowStrideFloats: gasCellStride,
    pressureInterfaceGasPressureCellRowStrideFloats: gasCellStride,
    gasPressureCellRowByteLength: gasCellStride * Float32Array.BYTES_PER_ELEMENT,
    pressureInterfaceGasPressureCellRowByteLength: gasCellStride * Float32Array.BYTES_PER_ELEMENT,
    pressureInterfaceImportReady: true,
    pressureFieldMode: 'local-gas-cell-pressure-gradient',
    pressureFieldResolution: 'structured-gas-cell-grid',
    retainedGasCellFieldSourceReady: true,
    retainedGasPressureBufferRefs: ['resident-gas-pressure-cells-buffer'],
    localPressureGradientReady: false,
    localPressureGradientStatus: 'retained-gpu-gas-cell-rows-ready-cpu-snapshot-not-read',
    gasPressureCellsBuffer
  };

  const step = await runMlsMpmResidentStepWithOptionalWebGpu({
    ...options,
    gpuResidentLaneManager,
    gpuResidentLaneId: 'ulg:test:sph-resident',
    gpuResidentLaneStateKey: 'ulg:test:sph-resident-state',
    gpuResidentLaneDomainKey: 'ulg:test-domain',
    schroederFarAggregateGasCellImport
  });

  assert.equal(step.schroederFarAggregateGasCellImport, schroederFarAggregateGasCellImport);
  assert.equal(step.schroederFarAggregateGasCellImportStatus, 'schroeder-far-aggregate-gas-cell-import-submitted');
  assert.equal(step.schroederFarAggregateGasCellImportPressureInterfaceImportReady, true);
  assert.equal(step.schroederFarAggregateGasCellImportRetainedSourceReady, true);
  assert.equal(step.schroederFarAggregateGasCellImportRowCount, 1);
  assert.equal(step.schroederFarAggregateGasCellImportBufferRetained, true);
  assert.equal(
    step.schroederFarAggregateGasCellImportBufferByteLength,
    gasCellStride * Float32Array.BYTES_PER_ELEMENT
  );
  assert.equal(
    step.schroederFarAggregateGasCellImportPressureFieldMode,
    'local-gas-cell-pressure-gradient'
  );
  assert.equal(
    step.schroederFarAggregateGasCellImportPressureFieldResolution,
    'structured-gas-cell-grid'
  );
  assert.deepEqual(
    step.schroederFarAggregateGasCellImportRetainedGasPressureBufferRefs,
    ['resident-gas-pressure-cells-buffer']
  );
  assert.equal(step.schroederFarAggregateGasCellImportLocalPressureGradientReady, false);
  assert.equal(
    step.schroederFarAggregateGasCellImportLocalPressureGradientStatus,
    'retained-gpu-gas-cell-rows-ready-cpu-snapshot-not-read'
  );
  assert.equal(
    step.stageStatus.schroederFarAggregateGasCellImport,
    'schroeder-far-aggregate-gas-cell-import-submitted'
  );
  assert.equal(step.stageBackends.schroederFarAggregateGasCellImport, 'webgpu');
  assert.equal(step.nextParticleUploads.sphParticleUpload.stateBuffer.label, 'g2p-state-unread');
  assert.equal(step.nextParticleUploads.sphParticleUpload.thermoBuffer, sourceThermoBuffer);
  assert.equal(step.nextParticleUploads.mlsMpmParticleUpload.mechanicsBuffer.label, 'g2p-mechanics-unread');
  assert.equal(step.nextParticleBufferMode, 'retained-g2p-output-buffers');
  assert.equal(
    step.diagnostics.schroederFarAggregateGasCellImportStatus,
    'schroeder-far-aggregate-gas-cell-import-submitted'
  );
  assert.equal(step.diagnostics.schroederFarAggregateGasCellImportPressureInterfaceImportReady, true);
  assert.equal(step.diagnostics.schroederFarAggregateGasCellImportRetainedSourceReady, true);
  assert.equal(step.diagnostics.schroederFarAggregateGasCellImportBufferRetained, true);
  assert.equal(step.diagnostics.schroederFarAggregateGasCellImportLocalPressureGradientReady, false);
  assert.ok(step.gpuResidentLaneRetainedBufferRefs.includes('resident-gas-pressure-cells-buffer'));
  assert.ok(
    gpuResidentLaneManager.calls.complete[0].options.retainedBufferRefs.includes(
      'resident-gas-pressure-cells-buffer'
    )
  );
});

test('MLS-MPM resident step can opt into fused no-full mechanics dispatch', async () => {
  const buffers = manualBuffers();
  const tracker = fakeBufferTracker();
  const device = fakeSummaryDevice(new Float32Array(MLS_MPM_GPU_RESIDENT_SUMMARY_FLOATS));
  const sourceThermoBuffer = tracker.buffer('source-thermo');
  const step = await runMlsMpmResidentStepWithOptionalWebGpu({
    ...buffers,
    sphParticleUpload: {
      status: 'webgpu-uploaded',
      stateBuffer: tracker.buffer('source-state'),
      thermoBuffer: sourceThermoBuffer,
      slot: 0
    },
    mlsMpmParticleUpload: {
      status: 'webgpu-uploaded',
      mechanicsBuffer: tracker.buffer('source-mechanics'),
      slot: 0
    },
    preferWebGpu: true,
    device,
    boxDimsM: [3, 3, 3],
    readbackMode: 'no-full-readback',
    fuseNoFullResidentMechanics: true,
    p2gBackend: MLS_MPM_P2G_BACKEND_OCEAN_TILED_EXPERIMENTAL,
    summaryRunner({ gridUpdate, g2pReconstruction, summaryScope }) {
      assert.equal(gridUpdate.fusedResidentMechanics, true);
      assert.equal(g2pReconstruction.fusedResidentMechanics, true);
      return {
        schema: 'peercompute.ulg.mls-mpm-resident-summary-execution.v0',
        backend: 'webgpu',
        status: 'compact-summary-ready',
        compactGpuSummaryAvailable: true,
        readbackMode: 'no-full-readback',
        summaryScope,
        particleCount: buffers.sphParticleState.particleCount,
        gridNodeCount: gridUpdate.gridNodeCount,
        activeGridNodeCount: null,
        activeGridNodeCountAvailable: false,
        activeGridNodeSummaryStatus: 'active-grid-node-summary-not-requested',
        gridNodeScanCount: 0,
        gridNodeScanSkipped: true,
        sourceMassKg: 8,
        nextMassKg: 8,
        massDeltaKg: 0,
        sourceMomentumKgMPerS: [0, 0, 0],
        nextMomentumKgMPerS: [0, 0, 0],
        momentumDeltaKgMPerS: [0, 0, 0],
        sourceCenterOfMassM: [1.25, 1.25, 1.25],
        nextCenterOfMassM: [1.25, 1.25, 1.25],
        centerOfMassDeltaM: [0, 0, 0],
        sourcePositionBoundsM: {
          status: 'position-bounds-ready',
          min: [1.25, 1.25, 1.25],
          max: [1.25, 1.25, 1.25],
          massKg: 8
        },
        nextPositionBoundsM: {
          status: 'position-bounds-ready',
          min: [1.25, 1.25, 1.25],
          max: [1.25, 1.25, 1.25],
          massKg: 8
        },
        maxSpeedMPerS: 0,
        maxDisplacementM: 0,
        minVolumeRatioJ: 1,
        maxVolumeRatioJ: 1,
        phaseMassKg: { solid: 0, liquid: 8, gas: 0, plasma: 0 },
        phaseMassTotalKg: 8,
        temperatureMassWeightedMeanK: 0,
        minTemperatureK: 0,
        maxTemperatureK: 0,
        thermalReadyCount: 1,
        thermalProblemCount: 0,
        thermalPhaseSummaryAvailable: true,
        compactReadbackByteLength: MLS_MPM_GPU_RESIDENT_SUMMARY_BYTES,
        timing: {
          schema: 'peercompute.ulg.mls-mpm-resident-summary-timing.v0',
          totalMs: 0,
          setupMs: 0,
          encodeMs: 0,
          submitMs: 0,
          mapAsyncWaitMs: 0,
          decodeMs: 0,
          queueFenceAttribution: 'unit-summary-runner',
          summaryKernelDispatchCount: 0,
          summaryWorkgroupCount: 0,
          compactReadbackByteLength: MLS_MPM_GPU_RESIDENT_SUMMARY_BYTES
        },
        mapAsyncWaitMs: 0,
        queueFenceAttribution: 'unit-summary-runner'
      };
    }
  });

  assert.equal(step.backend, 'webgpu');
  assert.equal(step.status, 'resident-step-webgpu-executed');
  assert.equal(step.readbackMode, 'no-full-readback');
  assert.equal(step.stageTiming.fusedResidentMechanics, true);
  assert.equal(step.stageTiming.stageMs.p2gGridProjection, 0);
  assert.equal(step.stageTiming.stageMs.gridUpdate, 0);
  assert.equal(step.stageTiming.stageMs.g2pReconstruction, 0);
  assert.equal(step.p2gGridProjection.fusedResidentMechanics, true);
  assert.equal(step.p2gGridProjection.ambientPressureAppliedInStressProjection, true);
  assert.equal(step.ambientPressureAppliedInStressProjection, true);
  assert.equal(step.gridUpdate.fusedResidentMechanics, true);
  assert.equal(step.g2pReconstruction.fusedResidentMechanics, true);
  assert.equal(step.dispatchTopologyStatus, 'resident-dispatch-topology-ready');
  assert.equal(step.p2gBackendPolicy.schema, ULG_MLS_MPM_P2G_BACKEND_POLICY_SCHEMA);
  assert.equal(step.p2gBackendPolicyStatus, 'ocean-tiled-backend-fallback-resident-scatter');
  assert.equal(step.p2gBackendRequested, MLS_MPM_P2G_BACKEND_OCEAN_TILED_EXPERIMENTAL);
  assert.equal(step.p2gBackendEffective, MLS_MPM_P2G_BACKEND_RESIDENT_SCATTER);
  assert.equal(step.p2gBackendFallbackReason, 'ocean-tiled-p2g-kernel-not-available');
  assert.equal(step.cpuParticleLoopInHotPath, false);
  assert.equal(step.stageTiming.dispatchTopology.status, 'resident-dispatch-topology-ready');
  assert.equal(step.stageTiming.dispatchTopology.p2gBackendPolicyStatus, 'ocean-tiled-backend-fallback-resident-scatter');
  assert.equal(step.stageTiming.dispatchTopology.p2g.backendPolicyStatus, 'ocean-tiled-backend-fallback-resident-scatter');
  assert.equal(step.stageTiming.dispatchTopology.p2g.effectiveBackend, MLS_MPM_P2G_BACKEND_RESIDENT_SCATTER);
  assert.equal(step.stageTiming.dispatchTopology.p2g.topology, 'particle-parallel-scatter');
  assert.equal(step.stageTiming.dispatchTopology.p2g.dispatchAxis, 'particle');
  assert.equal(step.stageTiming.dispatchTopology.p2g.particleLoopInShader, false);
  assert.equal(step.stageTiming.dispatchTopology.p2g.perParticleLocalStencilNodeCount, 27);
  assert.equal(step.stageTiming.dispatchTopology.g2p.topology, 'particle-parallel-gather');
  assert.equal(step.stageTiming.dispatchTopology.g2p.dispatchAxis, 'particle');
  assert.deepEqual(step.stageTiming.dispatchTopology.particleParallelStages, ['p2g', 'g2p']);
  assert.equal(step.stageTiming.dispatchTopology.cpuParticleLoopInHotPath, false);
  assert.equal(step.stageTiming.dispatchTopology.totalDispatches, 4);
  assert.equal(step.stageTiming.dispatchTopology.g2pAuthorityFinalize.enabled, false);
  assert.equal(step.p2gGridProjection.dispatchTopology.topology, 'particle-parallel-scatter');
  assert.equal(step.p2gGridProjection.residentDispatchTopology, step.stageTiming.dispatchTopology);
  assert.equal(step.diagnostics.dispatchTopologyStatus, 'resident-dispatch-topology-ready');
  assert.equal(step.diagnostics.p2gBackendPolicyStatus, 'ocean-tiled-backend-fallback-resident-scatter');
  assert.equal(step.diagnostics.p2gBackendRequested, MLS_MPM_P2G_BACKEND_OCEAN_TILED_EXPERIMENTAL);
  assert.equal(step.diagnostics.p2gBackendEffective, MLS_MPM_P2G_BACKEND_RESIDENT_SCATTER);
  assert.equal(step.diagnostics.p2gBackendFallbackReason, 'ocean-tiled-p2g-kernel-not-available');
  assert.equal(step.diagnostics.cpuParticleLoopInHotPath, false);
  assert.deepEqual(step.diagnostics.particleParallelStages, ['p2g', 'g2p']);
  assert.equal(step.diagnostics.particleScaleStabilitySchema, 'peercompute.ulg.mls-mpm-g2p-particle-scale-stability.v0');
  assert.equal(step.diagnostics.particleScaleStabilityStatus, 'gpu-g2p-cap-policy-applied-in-shader');
  assert.equal(step.diagnostics.particleScalePolicyAppliedInG2p, true);
  assert.equal(step.diagnostics.particleScalePolicyAppliedInShader, true);
  assert.equal(step.diagnostics.particleScaleMaxRadiusGrowthRatioAllowed, 4);
  assert.equal(step.diagnostics.particleScaleMaxVolumeRatioJAllowed, 64);
  assert.equal(step.nextParticleBufferMode, 'retained-g2p-output-buffers');
  assert.equal(step.nextParticleStateBufferByteLength, buffers.sphParticleState.state.byteLength);
  assert.equal(step.nextParticleMechanicsBufferByteLength, buffers.mlsMpmParticleState.mechanics.byteLength);
  assert.equal(step.nextParticleUploads.sphParticleUpload.thermoBuffer, sourceThermoBuffer);
  assert.equal(device.submissions.length, 1);
  assert.equal(device.dispatches.length, 4);
});

test('MLS-MPM resident fused mechanics uses one canonical directory in P2G and G2P', async () => {
  const buffers = manualBuffers({ particleCount: 2 });
  const tracker = fakeBufferTracker();
  const device = fakeSummaryDevice(new Float32Array(MLS_MPM_GPU_RESIDENT_SUMMARY_FLOATS));
  const sourceThermoBuffer = tracker.buffer('source-thermo');
  const schroederAssignmentBuffer = tracker.buffer('retained-schroeder-assignment');
  const schroederSpatialDirectoryBuffer = tracker.buffer('retained-schroeder-spatial-directory');
  const schroederSpatialEvidenceBuffer = tracker.buffer('retained-schroeder-spatial-evidence');
  const schroederActiveNodeBuffer = tracker.buffer('retained-schroeder-active-node');
  const sourceStateBuffer = tracker.buffer('source-state');
  const sourceMechanicsBuffer = tracker.buffer('source-mechanics');
  schroederSpatialEvidenceBuffer.size = 80;
  const exactNearQueryProfile = { ready: true };
  const epochIdentity = {
    storageGeneration: 23,
    positionEpoch: 29,
    topologyEpoch: 31,
    physicsTick: 53,
    physicsSubstep: 59,
    chartEpoch: 61,
    levelEpoch: 67,
    supportEpoch: 71
  };
  const schroederSpatialEpochGeneration = {
    schema: 'peercompute.ulg.schroeder-spatial-epoch-generation.v1',
    selected: true,
    ready: true,
    directoryBuildCount: 1,
    privateLookupBuildCount: 0,
    source: {
      ready: true,
      activeNodeBuffer: schroederActiveNodeBuffer,
      phaseVolumeAssignmentOverlayEnabled: false,
      ...epochIdentity
    },
    execution: {
      schema: 'peercompute.ulg.schroeder-spatial-epoch.v1',
      submitPerformed: true,
      deviceId: webGpuDeviceId(device),
      activeNodeBuffer: schroederActiveNodeBuffer,
      directoryBuffer: schroederSpatialDirectoryBuffer,
      evidenceBuffer: schroederSpatialEvidenceBuffer,
      evidenceBufferByteLength: 80,
      sourceAdapterId: SCHROEDER_SPATIAL_SOURCE_ADAPTER_EXACT_NEAR_QUERY,
      exactNearQueryProfile,
      queryGeometryEvidence: exactNearQueryProfile,
      generationId: 17,
      buildOrdinal: 17,
      sortUniqueOrdinal: 17,
      ...epochIdentity,
      deviceOrdinal: 37,
      laneOrdinal: 41,
      leaseToken: 43,
      sourceFamilyId: 47,
      layout: { byteLength: 256 }
    }
  };
  const sphParticleUpload = {
    status: 'webgpu-uploaded',
    particleCount: buffers.sphParticleState.particleCount,
    ...epochIdentity,
    stateBuffer: sourceStateBuffer,
    thermoBuffer: sourceThermoBuffer,
    slot: 0
  };
  const mlsMpmParticleUpload = {
    status: 'webgpu-uploaded',
    particleCount: buffers.mlsMpmParticleState.particleCount,
    storageGeneration: epochIdentity.storageGeneration,
    mechanicsBuffer: sourceMechanicsBuffer,
    slot: 0
  };
  const proposalApplyCalls = [];
  const canonicalMechanicalProposalRunner = async ({ generation }) => (
    canonicalMechanicalProposalFixture({
      generation,
      makeBuffer: (label) => tracker.buffer(label),
      encodeApply(encoder, options = {}) {
        proposalApplyCalls.push(options);
        encodeCanonicalMechanicalFixtureBundle(encoder);
      }
    })
  );
  const schroederSpatialEpochTransaction =
    createSchroederSpatialEpochTransaction({
      device,
      generation: schroederSpatialEpochGeneration,
      sphParticleUpload,
      mlsMpmParticleUpload
    });
  const step = await runMlsMpmResidentStepWithOptionalWebGpu({
    ...buffers,
    sphParticleUpload,
    mlsMpmParticleUpload,
    schroederLevelAssignment: {
      schema: ULG_SCHROEDER_LEVEL_ASSIGNMENT_EXECUTION_SCHEMA,
      status: 'schroeder-level-assignment-submitted',
      particleCount: buffers.sphParticleState.particleCount,
      // Deliberately contradictory legacy metadata: canonical mode must not
      // inspect or bind it.
      assignmentStrideFloats: 0,
      assignmentBuffer: schroederAssignmentBuffer,
      assignmentBufferByteLength: SCHROEDER_LEVEL_ASSIGNMENT_ROW_LAYOUT.length * Float32Array.BYTES_PER_ELEMENT,
      retainedAssignmentBuffer: true
    },
    schroederSelectedLevel: 2,
    schroederSpatialEpochGeneration,
    schroederSpatialEpochTransaction,
    spatialMechanicalProposalRunner: canonicalMechanicalProposalRunner,
    canonicalSpatialRequired: true,
    preferWebGpu: true,
    device,
    boxDimsM: [3, 3, 3],
    ambientPressurePa: 101325,
    readbackMode: 'no-full-readback',
    fuseNoFullResidentMechanics: true,
    summaryRunner({ gridUpdate, g2pReconstruction, summaryScope }) {
      assert.equal(gridUpdate.fusedResidentMechanics, true);
      assert.equal(g2pReconstruction.fusedResidentMechanics, true);
      return {
        schema: 'peercompute.ulg.mls-mpm-resident-summary-execution.v0',
        backend: 'webgpu',
        status: 'compact-summary-ready',
        compactGpuSummaryAvailable: true,
        readbackMode: 'no-full-readback',
        summaryScope,
        particleCount: buffers.sphParticleState.particleCount,
        gridNodeCount: gridUpdate.gridNodeCount,
        sourceMassKg: 8,
        nextMassKg: 8,
        massDeltaKg: 0,
        sourceMomentumKgMPerS: [0, 0, 0],
        nextMomentumKgMPerS: [0, 0, 0],
        momentumDeltaKgMPerS: [0, 0, 0],
        sourceCenterOfMassM: [1.25, 1.25, 1.25],
        nextCenterOfMassM: [1.25, 1.25, 1.25],
        centerOfMassDeltaM: [0, 0, 0],
        nextPositionBoundsM: {
          status: 'position-bounds-ready',
          min: [1.25, 1.25, 1.25],
          max: [1.25, 1.25, 1.25],
          massKg: 8
        },
        maxSpeedMPerS: 0,
        maxDisplacementM: 0,
        minVolumeRatioJ: 1,
        maxVolumeRatioJ: 1,
        phaseMassKg: { solid: 0, liquid: 8, gas: 0, plasma: 0 },
        phaseMassTotalKg: 8,
        temperatureMassWeightedMeanK: 0,
        minTemperatureK: 0,
        maxTemperatureK: 0,
        thermalReadyCount: 1,
        thermalProblemCount: 0,
        thermalPhaseSummaryAvailable: true,
        compactReadbackByteLength: MLS_MPM_GPU_RESIDENT_SUMMARY_BYTES,
        timing: {
          schema: 'peercompute.ulg.mls-mpm-resident-summary-timing.v0',
          totalMs: 0,
          setupMs: 0,
          encodeMs: 0,
          submitMs: 0,
          mapAsyncWaitMs: 0,
          decodeMs: 0,
          queueFenceAttribution: 'unit-summary-runner',
          summaryKernelDispatchCount: 0,
          summaryWorkgroupCount: 0,
          compactReadbackByteLength: MLS_MPM_GPU_RESIDENT_SUMMARY_BYTES
        },
        mapAsyncWaitMs: 0,
        queueFenceAttribution: 'unit-summary-runner'
      };
    }
  });

  assert.equal(step.stageTiming.fusedResidentMechanics, true);
  const transactionSummary = summarizeSchroederSpatialEpochTransaction(
    schroederSpatialEpochTransaction
  );
  assert.equal(transactionSummary.state, 'readers-complete');
  assert.deepEqual(
    transactionSummary.admittedReaders.map(({ readerId }) => readerId),
    ['mechanics-p2g', 'mechanics-g2p']
  );
  assert.equal(transactionSummary.counters.readerAdmissionCount, 2);
  assert.equal(transactionSummary.counters.staleReaderRejectCount, 0);
  assert.equal(step.stageTiming.stageMs.p2gGridProjection, 0);
  assert.equal(step.stageTiming.dispatchTopology.canonicalSpatialAuthority, true);
  assert.deepEqual(
    step.stageTiming.dispatchTopology.particleParallelStages,
    ['p2g', 'g2p', 'spatialMechanicalProposalApply', 'g2pAuthorityFinalize']
  );
  assert.equal(
    step.stageTiming.dispatchTopology.totalDispatches,
    5 + SCHROEDER_MECHANICAL_DEFERRED_DISPATCH_COUNT
  );
  const proposalTopology =
    step.stageTiming.dispatchTopology.spatialMechanicalProposalApply;
  assert.equal(proposalTopology.enabled, true);
  assert.equal(
    proposalTopology.dispatchCountPerSubstep,
    SCHROEDER_MECHANICAL_DEFERRED_DISPATCH_COUNT
  );
  assert.equal(proposalTopology.dispatchCountPerSubstepExact, true);
  assert.equal(proposalTopology.exclusiveScanDispatchCountPerSubstep, 0);
  assert.equal(proposalTopology.encodedComputePassCountPerSubstep, 1);
  assert.equal(proposalTopology.dispatchCountEvidence,
    'post-encode-proposal-artifact');
  assert.equal(proposalTopology.dispatchWorkgroupsPerSubstep, null);
  assert.equal(proposalTopology.dispatchWorkgroupsPerSubstepExact, false);
  assert.equal(step.stageTiming.dispatchTopology.workgroupsPerSubstep, null);
  assert.equal(step.stageTiming.dispatchTopology.totalWorkgroups, null);
  assert.deepEqual(
    proposalTopology.entryPoints,
    SCHROEDER_MECHANICAL_DEFERRED_ENTRY_POINTS
  );
  assert.equal(
    proposalTopology.proposalStatus,
    SCHROEDER_SPATIAL_MECHANICAL_PROPOSAL_STATUS
  );
  assert.equal(
    proposalTopology.proposalMode,
    SCHROEDER_SPATIAL_MECHANICAL_PROPOSAL_MODE
  );
  assert.equal(
    proposalTopology.proposalSource,
    SCHROEDER_SPATIAL_MECHANICAL_SOURCE_POSITION_AUTHORITY
  );
  assert.equal(
    proposalTopology.exactNearTraversalCount,
    SCHROEDER_SPATIAL_MECHANICAL_TRAVERSAL_COUNT
  );
  assert.equal(
    proposalTopology.solverIterationCount,
    SCHROEDER_SPATIAL_MECHANICAL_SOLVER_ITERATIONS
  );
  assert.equal(proposalApplyCalls.length, 1);
  assert.equal(proposalApplyCalls[0].selectedLevel, 2);
  assert.equal(step.stageTiming.dispatchTopology.g2pAuthorityFinalize.enabled, true);
  assert.equal(
    step.stageTiming.dispatchTopology.g2pAuthorityFinalize.entryPoint,
    'finalize_canonical_spatial_authority'
  );
  assert.equal(
    step.stageTiming.dispatchTopology.g2pAuthorityFinalize.rejectionPolicy,
    'global-copy-through-to-immutable-input-family'
  );
  assert.equal(step.p2gGridProjection.fusedResidentMechanics, true);
  assert.equal(step.p2gGridProjection.schroederLevelFilterEnabled, true);
  assert.equal(step.p2gGridProjection.schroederSelectedLevel, 2);
  assert.equal(step.p2gGridProjection.schroederLevelFilter.assignmentStrideFloats, SCHROEDER_LEVEL_ASSIGNMENT_ROW_LAYOUT.length);
  assert.equal(step.p2gGridProjection.schroederLevelFilter.retainedAssignmentBuffer, false);
  assert.equal(step.p2gGridProjection.schroederLevelFilter.assignmentBufferSource, null);
  assert.equal(step.p2gGridProjection.schroederSpatialAuthorityMode, 'canonical-spatial-epoch');
  assert.equal(step.p2gGridProjection.schroederOldLevelAssignmentLookupRemoved, true);
  assert.equal(step.p2gGridProjection.schroederSpatialDirectoryEnabled, true);
  assert.equal(step.p2gGridProjection.schroederSpatialDirectoryFallbackScope, 'host-binding-only');
  assert.equal(step.p2gGridProjection.schroederSpatialHostBindingAdmitted, true);
  assert.equal(step.p2gGridProjection.schroederSpatialHostBindingFallback, false);
  assert.equal(step.p2gGridProjection.schroederSpatialGpuAdmissionObserved, false);
  assert.equal(
    step.p2gGridProjection.schroederSpatialGpuAdmissionStatus,
    'shader-validates-at-dispatch-no-host-readback'
  );
  assert.equal(step.p2gGridProjection.schroederSpatialGpuFallbackObserved, null);
  assert.equal(step.p2gGridProjection.schroederSpatialDirectory.generationId, 17);
  assert.equal(step.p2gGridProjection.schroederSpatialDirectory.storageGeneration, 23);
  assert.equal(step.p2gGridProjection.schroederSpatialDirectory.retainedDirectoryBuffer, true);
  assert.equal(step.p2gGridProjection.schroederSpatialDirectory.directoryBufferSource, 'retained-schroeder-spatial-directory');
  assert.equal(step.p2gGridProjection.schroederActiveNodeFilterEnabled, false);
  assert.equal(step.g2pReconstruction.schroederSpatialDirectoryEnabled, true);
  assert.equal(step.g2pReconstruction.schroederLevelFilterEnabled, true);
  assert.equal(step.g2pReconstruction.schroederSpatialAuthorityMode, 'canonical-spatial-epoch');
  assert.equal(step.g2pReconstruction.schroederOldLevelAssignmentLookupRemoved, true);
  const p2gParamWrite = device.writes.find((write) => write.label === 'ulg-mls-mpm-fused-p2g-params');
  assert.ok(p2gParamWrite);
  assert.equal(p2gParamWrite.byteLength, 160);
  const p2gParams = new DataView(p2gParamWrite.data);
  assert.equal(p2gParams.getUint32(44, true), 1);
  assert.equal(p2gParams.getInt32(48, true), 2);
  assert.equal(p2gParams.getUint32(52, true), SCHROEDER_LEVEL_ASSIGNMENT_ROW_LAYOUT.length);
  assert.equal(p2gParams.getUint32(56, true), 1);
  assert.equal(p2gParams.getUint32(60, true), 23);
  assert.equal(p2gParams.getFloat32(68, true), 101325);
  assert.equal(p2gParams.getUint32(80, true), 29);
  assert.equal(p2gParams.getUint32(84, true), 31);
  assert.equal(p2gParams.getUint32(88, true), 1);
  assert.equal(p2gParams.getUint32(92, true), 17);
  assert.equal(p2gParams.getUint32(96, true), 37);
  assert.equal(p2gParams.getUint32(100, true), 41);
  assert.equal(p2gParams.getUint32(104, true), 43);
  assert.equal(p2gParams.getUint32(108, true), 47);
  assert.equal(p2gParams.getUint32(112, true), 53);
  assert.equal(p2gParams.getUint32(116, true), 59);
  assert.equal(p2gParams.getUint32(120, true), 61);
  assert.equal(p2gParams.getUint32(124, true), 67);
  assert.equal(p2gParams.getUint32(128, true), 71);
  assert.equal(p2gParams.getUint32(132, true), 0);
  const g2pParamWrite = device.writes.find((write) => write.label === 'ulg-mls-mpm-fused-g2p-params');
  assert.ok(g2pParamWrite);
  assert.equal(g2pParamWrite.byteLength, 144);
  const g2pParams = new DataView(g2pParamWrite.data);
  assert.equal(g2pParams.getUint32(24, true), 1);
  assert.equal(g2pParams.getInt32(28, true), 2);
  // G2P particle filtering reads particle-parallel level-assignment rows;
  // the compacted active-node list must never gate particles.
  assert.equal(g2pParams.getUint32(68, true), SCHROEDER_LEVEL_ASSIGNMENT_ROW_LAYOUT.length);
  assert.equal(g2pParams.getUint32(72, true), 1);
  assert.equal(g2pParams.getUint32(76, true), 1);
  assert.equal(g2pParams.getUint32(80, true), 23);
  assert.equal(g2pParams.getUint32(84, true), 29);
  assert.equal(g2pParams.getUint32(88, true), 31);
  assert.equal(g2pParams.getUint32(92, true), 1);
  assert.equal(g2pParams.getUint32(96, true), 17);
  assert.equal(g2pParams.getUint32(100, true), 37);
  assert.equal(g2pParams.getUint32(104, true), 41);
  assert.equal(g2pParams.getUint32(108, true), 43);
  assert.equal(g2pParams.getUint32(112, true), 47);
  assert.equal(g2pParams.getUint32(116, true), 53);
  assert.equal(g2pParams.getUint32(120, true), 59);
  assert.equal(g2pParams.getUint32(124, true), 61);
  assert.equal(g2pParams.getUint32(128, true), 67);
  assert.equal(g2pParams.getUint32(132, true), 71);
  assert.equal(g2pParams.getUint32(136, true), 0);
  const canonicalSchroederBindGroups = device.bindGroups.filter((group) => {
    return group.entries.some((entry) => entry.binding === 8);
  });
  assert.equal(canonicalSchroederBindGroups.length, 4);
  assert.ok(canonicalSchroederBindGroups.every((group) => {
    return group.entries.find((entry) => entry.binding === 7)?.resource?.buffer
      === schroederSpatialEvidenceBuffer;
  }));
  assert.ok(canonicalSchroederBindGroups.every((group) => {
    return group.entries.find((entry) => entry.binding === 8)?.resource?.buffer === schroederSpatialDirectoryBuffer;
  }));
  const g2pSchroederBindGroups = device.bindGroups.filter((group) => {
    return group.entries.find((entry) => entry.binding === 4)?.resource?.buffer?.label
      === 'ulg-mls-mpm-fused-g2p-state-out';
  });
  assert.equal(g2pSchroederBindGroups.length, 2);
  const canonicalG2pFinalizeDispatch = device.dispatches.find((dispatch) => (
    dispatch.pipeline?.compute?.entryPoint === 'finalize_canonical_spatial_authority'
  ));
  assert.ok(canonicalG2pFinalizeDispatch);
  const legacyCanonicalSeparationBinFillDispatch = device.dispatches.find((dispatch) => (
    /authority_restore_state[\s\S]*authority_restore_mechanics/.test(
      dispatch.pipeline?.compute?.module?.code || ''
    )
  ));
  assert.equal(legacyCanonicalSeparationBinFillDispatch, undefined);
  assert.ok(device.dispatches.some((dispatch) => (
    dispatch.pipeline?.compute?.entryPoint === 'seal_contact_proposal'
  )));
  assert.ok(device.dispatches.some((dispatch) => (
    dispatch.pipeline?.compute?.entryPoint === 'commit_contact_proposal'
  )));
  assert.equal(
    device.bindGroups.some((group) => group.entries.some((entry) => (
      entry.resource?.buffer === schroederAssignmentBuffer
    ))),
    false
  );
  assert.ok(device.clears.some((clear) => (
    clear.buffer === schroederSpatialEvidenceBuffer
    && clear.offset === 16
    && clear.size === 64
  )));
  assert.equal(
    device.createdBuffers.some((buffer) => buffer.label === 'ulg-mls-mpm-fused-empty-schroeder-level-assignments'),
    false
  );
  assert.equal(
    device.createdBuffers.some((buffer) => buffer.label === 'ulg-mls-mpm-fused-empty-schroeder-spatial-directory'),
    false
  );
  assert.equal(
    device.dispatches.length,
    5 + SCHROEDER_MECHANICAL_DEFERRED_DISPATCH_COUNT
  );
  assert.notEqual(schroederSpatialEvidenceBuffer.destroyed, true);
});

test('MLS-MPM canonical fused mechanics consumes the SS compact mechanics view indirectly', async () => {
  const buffers = manualBuffers({
    particleCount: 2,
    smoothingLengthM: 0.25,
    mechanicsDtS: 1 / 120
  });
  const device = fakeSummaryDevice(
    new Float32Array(MLS_MPM_GPU_RESIDENT_SUMMARY_FLOATS)
  );
  const taggedBuffer = (label, size, usage = 128 | 8) => tagWebGpuBufferDevice(
    device.createBuffer({ label, size, usage }),
    device
  );
  const particleCount = buffers.sphParticleState.particleCount;
  const sourceStateBuffer = taggedBuffer(
    'compact-source-state',
    buffers.sphParticleState.state.byteLength
  );
  const sphParticleUpload = {
    status: 'webgpu-uploaded',
    particleCount,
    storageGeneration: 11,
    stateBuffer: sourceStateBuffer,
    thermoBuffer: taggedBuffer(
      'compact-source-thermo',
      buffers.sphParticleState.thermo.byteLength
    ),
    identityBuffer: taggedBuffer('compact-source-identity', particleCount * 16),
    slot: 0
  };
  const mlsMpmParticleUpload = {
    status: 'webgpu-uploaded',
    particleCount,
    storageGeneration: 11,
    mechanicsBuffer: taggedBuffer(
      'compact-source-mechanics',
      buffers.mlsMpmParticleState.mechanics.byteLength
    ),
    slot: 0
  };
  const assignmentBuffer = taggedBuffer(
    'compact-level-assignment',
    particleCount * SCHROEDER_LEVEL_ASSIGNMENT_ROW_LAYOUT.length
      * Float32Array.BYTES_PER_ELEMENT
  );
  const levelAssignment = {
    schema: ULG_SCHROEDER_LEVEL_ASSIGNMENT_EXECUTION_SCHEMA,
    status: 'schroeder-level-assignment-submitted',
    bufferFamilyGenerationStatus:
      'schroeder-particle-buffer-family-generation-ready',
    particleCount,
    assignmentStrideFloats: SCHROEDER_LEVEL_ASSIGNMENT_ROW_LAYOUT.length,
    assignmentBuffer,
    assignmentBufferByteLength: assignmentBuffer.size,
    sourceStateBuffer,
    sourceStateBufferBorrowed: true,
    storageGeneration: 11,
    physicsTick: 13,
    physicsSubstep: 0,
    positionEpoch: 17,
    topologyEpoch: 19,
    chartEpoch: 23,
    levelEpoch: 29,
    supportEpoch: 31,
    minLevel: -1,
    maxLevel: 1,
    chartId: 0,
    baseGridSpacingM: 0.25
  };
  Object.assign(sphParticleUpload, {
    physicsTick: levelAssignment.physicsTick,
    physicsSubstep: levelAssignment.physicsSubstep,
    positionEpoch: levelAssignment.positionEpoch,
    topologyEpoch: levelAssignment.topologyEpoch,
    chartEpoch: levelAssignment.chartEpoch,
    levelEpoch: levelAssignment.levelEpoch,
    supportEpoch: levelAssignment.supportEpoch
  });
  const gridSpec = createMlsMpmGridSpec({
    boxDimsM: [3, 3, 3],
    gridSpacingM: 0.25
  });
  const generation = runSchroederSpatialEpochGenerationWebGpu({
    device,
    levelAssignment,
    particleCount,
    selectedLevel: 0,
    mechanicsGrid: {
      gridNodeCount: gridSpec.gridNodeCount,
      gridDims: gridSpec.gridDims,
      gridShift: gridSpec.shift,
      gridSpacingM: gridSpec.gridSpacingM
    }
  });
  assert.equal(generation.ready, true);
  assert.ok(generation.mechanicsView);
  const mechanicsViewBuffer = generation.mechanicsView.mechanicsViewBuffer;
  const spatialDirectoryBuffer = generation.execution.directoryBuffer;
  const spatialMechanicalProposalRunner = async ({
    generation: proposalGeneration
  }) => canonicalMechanicalProposalFixture({
    generation: proposalGeneration,
    makeBuffer: (label) => taggedBuffer(label, Math.max(64, particleCount * 16)),
    labelPrefix: 'compact-mechanical-proposal',
    encodeApply(encoder) {
      encodeCanonicalMechanicalFixtureBundle(encoder);
    }
  });
  const staleStateGeneration = {
    ...generation,
    source: {
      ...generation.source,
      sourceStateBuffer: taggedBuffer(
        'compact-stale-source-state',
        buffers.sphParticleState.state.byteLength
      )
    }
  };
  const staleStateTransaction = createSchroederSpatialEpochTransaction({
    device,
    generation: staleStateGeneration,
    sphParticleUpload,
    mlsMpmParticleUpload
  });
  await assert.rejects(
    () => runMlsMpmResidentStepWithOptionalWebGpu({
      ...buffers,
      sphParticleUpload,
      mlsMpmParticleUpload,
      schroederSelectedLevel: 0,
      schroederSpatialEpochGeneration: staleStateGeneration,
      schroederSpatialEpochTransaction: staleStateTransaction,
      spatialMechanicalProposalRunner,
      canonicalSpatialRequired: true,
      preferWebGpu: true,
      device,
      boxDimsM: [3, 3, 3],
      readbackMode: 'no-full-readback',
      fuseNoFullResidentMechanics: true,
      summaryRunner: fusedMechanicsSummaryStub(buffers)
    }),
    /mechanics-view-rejected-shape/
  );
  const transaction = createSchroederSpatialEpochTransaction({
    device,
    generation,
    sphParticleUpload,
    mlsMpmParticleUpload
  });
  const step = await runMlsMpmResidentStepWithOptionalWebGpu({
    ...buffers,
    sphParticleUpload,
    mlsMpmParticleUpload,
    schroederLevelAssignment: levelAssignment,
    schroederSelectedLevel: 0,
    schroederSpatialEpochGeneration: generation,
    schroederSpatialEpochTransaction: transaction,
    spatialMechanicalProposalRunner,
    canonicalSpatialRequired: true,
    preferWebGpu: true,
    device,
    boxDimsM: [3, 3, 3],
    gravityMPerS2: [0, 0, 0],
    readbackMode: 'no-full-readback',
    fuseNoFullResidentMechanics: true,
    summaryRunner: fusedMechanicsSummaryStub(buffers)
  });

  assert.equal(step.p2gGridProjection.schroederSpatialDirectory.mechanicsViewEnabled, true);
  assert.equal(step.p2gGridProjection.activeGridDispatch.mode, 'canonical-compact-mechanics-view');
  assert.equal(step.p2gGridProjection.activeGridDispatch.activeNodeCount, null);
  assert.equal(step.p2gGridProjection.activeGridDispatch.activeNodeCountKnown, false);
  assert.equal(step.p2gGridProjection.activeGridDispatch.activeNodeCapacity, gridSpec.gridNodeCount);
  assert.equal(step.stageTiming.dispatchTopology.activeGridNodeCount, null);
  assert.equal(step.stageTiming.dispatchTopology.activeGridNodeCountKnown, false);
  assert.equal(step.stageTiming.dispatchTopology.activeGridNodeCapacity, gridSpec.gridNodeCount);
  assert.equal(step.stageTiming.dispatchTopology.totalWorkgroupsExact, false);
  assert.equal(step.stageTiming.dispatchTopology.compactMechanicsNodeValidation.enabled, true);
  assert.equal(
    step.stageTiming.dispatchTopology.totalDispatches,
    13 + SCHROEDER_MECHANICAL_DEFERRED_DISPATCH_COUNT
  );
  assert.deepEqual(
    step.stageTiming.dispatchTopology.compactMechanicsViewPreflight.entryPoints,
    [
      'preflight_compact_mechanics_view',
      'preflight_compact_mechanics_owner_identity',
      'preflight_compact_mechanics_epoch_identity',
      'preflight_compact_mechanics_grid_geometry',
      'preflight_compact_mechanics_topology_counts',
      'preflight_compact_mechanics_dispatch'
    ]
  );
  assert.equal(
    device.dispatches.filter(({ pipeline }) => (
      pipeline?.compute?.entryPoint?.startsWith('preflight_compact_mechanics')
    )).length,
    6
  );

  const p2gParamsWrite = device.writes.find(
    (write) => write.label === 'ulg-mls-mpm-fused-p2g-params'
  );
  const p2gParams = new DataView(p2gParamsWrite.data);
  assert.equal(p2gParamsWrite.byteLength, 160);
  assert.equal(p2gParams.getUint32(136, true), 1);
  assert.equal(p2gParams.getUint32(140, true), generation.execution.buildOrdinal);

  const canonicalBindGroups = device.bindGroups.filter((group) => (
    group.entries.find((entry) => entry.binding === 8)?.resource?.buffer
      === spatialDirectoryBuffer
  ));
  const ownedG2pEvidenceBuffer = device.createdBuffers.find((buffer) => (
    buffer.label === 'ulg-mls-mpm-fused-compact-mechanics-g2p-owned-evidence'
  ));
  assert.ok(ownedG2pEvidenceBuffer);
  assert.ok(canonicalBindGroups.length >= 7);
  assert.ok(canonicalBindGroups.every((group) => (
    [
      mechanicsViewBuffer,
      ownedG2pEvidenceBuffer
    ].includes(group.entries.find((entry) => entry.binding === 7)?.resource?.buffer)
  )));
  assert.ok(canonicalBindGroups.some((group) => (
    group.entries.find((entry) => entry.binding === 7)?.resource?.buffer
      === ownedG2pEvidenceBuffer
  )));
  assert.ok(canonicalBindGroups.every((group) => (
    group.entries.find((entry) => entry.binding === 8)?.resource?.buffer
      === spatialDirectoryBuffer
  )));
  const compactGridUpdateBindGroup = device.bindGroups.find((group) => (
    group.entries.find((entry) => entry.binding === 0)?.resource?.buffer?.label
      === 'ulg-mls-mpm-fused-p2g-grid-out'
    && group.entries.find((entry) => entry.binding === 4)?.resource?.buffer
      === mechanicsViewBuffer
  ));
  assert.ok(compactGridUpdateBindGroup);

  const stagingBuffer = device.createdBuffers.find((buffer) => (
    buffer.label === 'ulg-mls-mpm-compact-mechanics-indirect-dispatch-staging'
  ));
  assert.ok(stagingBuffer);
  const compactIndirectDispatches = device.indirectDispatches.filter(
    (dispatch) => dispatch.buffer === stagingBuffer
  );
  assert.equal(compactIndirectDispatches.length, 4);
  assert.ok(compactIndirectDispatches.every((dispatch) => dispatch.offset === 0));
  const dispatchCopies = device.copies.filter((copy) => (
    copy.source === mechanicsViewBuffer
    && copy.destination === stagingBuffer
  ));
  assert.equal(dispatchCopies.length, 2);
  assert.ok(dispatchCopies.every((copy) => (
    copy.sourceOffset === 240 && copy.destinationOffset === 0 && copy.size === 12
  )));
  assert.equal(device.clears.some((clear) => (
    clear.buffer === mechanicsViewBuffer
    && clear.offset === 16
    && clear.size === 64
  )), false);
  const p2gAccumulator = device.createdBuffers.find((buffer) => (
    buffer.label === 'ulg-mls-mpm-fused-p2g-grid-accumulators'
  ));
  assert.ok(p2gAccumulator);
  assert.ok(device.clears.some((clear) => (
    clear.buffer === p2gAccumulator
    && clear.offset === gridSpec.gridNodeCount * 4 * Int32Array.BYTES_PER_ELEMENT
    && clear.size === 80
  )));
  assert.ok(device.clears.some((clear) => (
    clear.buffer === ownedG2pEvidenceBuffer
    && clear.offset === 0
    && clear.size === 80
  )));
  assert.ok(device.copies.some((copy) => (
    copy.source === p2gAccumulator
    && copy.sourceOffset
      === gridSpec.gridNodeCount * 4 * Int32Array.BYTES_PER_ELEMENT
    && copy.destination === ownedG2pEvidenceBuffer
    && copy.destinationOffset === 0
    && copy.size === 80
  )));
  assert.equal(mechanicsViewBuffer.destroyed, false);

  const activeSourceV2Generation = runSchroederSpatialEpochGenerationWebGpu({
    device,
    levelAssignment,
    particleCount,
    particleIdentityBuffer: sphParticleUpload.identityBuffer,
    particleIdentityStrideWords: 1,
    selectedLevel: 0,
    mechanicsGrid: {
      gridNodeCount: gridSpec.gridNodeCount,
      gridDims: gridSpec.gridDims,
      gridShift: gridSpec.shift,
      gridSpacingM: gridSpec.gridSpacingM
    }
  });
  assert.equal(activeSourceV2Generation.ready, true);
  assert.ok(activeSourceV2Generation.activeSourceView);
  assert.ok(activeSourceV2Generation.mechanicsFieldView);
  const activeSourceV2Transaction = createSchroederSpatialEpochTransaction({
    device,
    generation: activeSourceV2Generation,
    sphParticleUpload,
    mlsMpmParticleUpload
  });
  const indirectDispatchCountBeforeV2 = device.indirectDispatches.length;
  const createdBufferCountBeforeV2 = device.createdBuffers.length;
  const activeSourceV2Step = await runMlsMpmResidentStepWithOptionalWebGpu({
    ...buffers,
    sphParticleUpload,
    mlsMpmParticleUpload,
    schroederLevelAssignment: levelAssignment,
    schroederSelectedLevel: 0,
    schroederSpatialEpochGeneration: activeSourceV2Generation,
    schroederSpatialEpochTransaction: activeSourceV2Transaction,
    spatialMechanicalProposalRunner,
    canonicalSpatialRequired: true,
    preferWebGpu: true,
    device,
    boxDimsM: [3, 3, 3],
    gravityMPerS2: [0, 0, 0],
    readbackMode: 'no-full-readback',
    fuseNoFullResidentMechanics: true,
    summaryRunner: fusedMechanicsSummaryStub(buffers)
  });
  assert.equal(
    activeSourceV2Step.p2gGridProjection.schroederSpatialDirectory
      .activeSourceP2gEnabled,
    true
  );
  assert.equal(
    activeSourceV2Step.p2gGridProjection.mechanicsFieldViewEnabled,
    true
  );
  const activeSourceV2P2gParamsWrite = device.writes.findLast(
    (write) => write.label === 'ulg-mls-mpm-fused-p2g-params'
  );
  const activeSourceV2G2pParamsWrite = device.writes.findLast(
    (write) => write.label === 'ulg-mls-mpm-fused-g2p-params'
  );
  assert.equal(activeSourceV2P2gParamsWrite.byteLength, 192);
  assert.equal(activeSourceV2G2pParamsWrite.byteLength, 176);
  assert.ok(device.indirectDispatches
    .slice(indirectDispatchCountBeforeV2)
    .some((dispatch) => (
      dispatch.buffer
        === activeSourceV2Generation.activeSourceView.activeSourceViewBuffer
      && dispatch.offset
        === activeSourceV2Generation.activeSourceView.activeDispatchOffsetBytes
      && dispatch.pipeline?.compute?.entryPoint === 'main'
    )));
  assert.equal(
    device.createdBuffers
      .slice(createdBufferCountBeforeV2)
      .some((buffer) => (buffer.usage & 1) !== 0),
    false,
    'ActiveSource-v2 fused production must not allocate MAP_READ buffers'
  );
  assert.equal(device.createdBuffers.some((buffer) => (
    /private.*spatial|spatial.*private/i.test(buffer.label ?? '')
  )), false);

  const createCommandEncoder = device.createCommandEncoder.bind(device);
  device.createCommandEncoder = (...args) => {
    const encoder = createCommandEncoder(...args);
    const beginComputePass = encoder.beginComputePass.bind(encoder);
    encoder.beginComputePass = (...passArgs) => {
      const pass = beginComputePass(...passArgs);
      pass.dispatchWorkgroupsIndirect = undefined;
      return pass;
    };
    return encoder;
  };
  const missingIndirectTransaction = createSchroederSpatialEpochTransaction({
    device,
    generation,
    sphParticleUpload,
    mlsMpmParticleUpload
  });
  const submissionCountBeforeMissingIndirect = device.submissions.length;
  await assert.rejects(
    () => runMlsMpmResidentStepWithOptionalWebGpu({
      ...buffers,
      sphParticleUpload,
      mlsMpmParticleUpload,
      schroederSelectedLevel: 0,
      schroederSpatialEpochGeneration: generation,
      schroederSpatialEpochTransaction: missingIndirectTransaction,
      spatialMechanicalProposalRunner,
      canonicalSpatialRequired: true,
      preferWebGpu: true,
      device,
      boxDimsM: [3, 3, 3],
      readbackMode: 'no-full-readback',
      fuseNoFullResidentMechanics: true,
      summaryRunner: fusedMechanicsSummaryStub(buffers)
    }),
    /dispatchWorkgroupsIndirect/
  );
  assert.equal(device.submissions.length, submissionCountBeforeMissingIndirect);

  assert.equal(releaseSchroederSpatialEpochGenerationAfterQueue(
    generation,
    device
  ), true);
  assert.equal(await generation.releasePromise, true);
});

test('MLS-MPM resident step authenticates every enabled Slice 5 consumer before P2G and removes legacy spatial work', async () => {
  const buffers = manualBuffers({
    particleCount: 2,
    position: [0.5, 0.5, 0.5],
    velocity: [0, 0, 0],
    smoothingLengthM: 0.25,
    mechanicsDtS: 1 / 120
  });
  const device = fakeSummaryDevice(
    new Float32Array(MLS_MPM_GPU_RESIDENT_SUMMARY_FLOATS)
  );
  const taggedBuffer = (label, size) => tagWebGpuBufferDevice(
    device.createBuffer({ label, size, usage: 128 | 8 }),
    device
  );
  const particleCount = buffers.sphParticleState.particleCount;
  const sphParticleUpload = {
    status: 'webgpu-uploaded',
    particleCount,
    storageGeneration: 11,
    stateBuffer: taggedBuffer(
      'slice5-source-state',
      buffers.sphParticleState.state.byteLength
    ),
    thermoBuffer: taggedBuffer(
      'slice5-source-thermo',
      buffers.sphParticleState.thermo.byteLength
    ),
    identityBuffer: taggedBuffer('slice5-source-identity', particleCount * 16),
    slot: 0
  };
  const mlsMpmParticleUpload = {
    status: 'webgpu-uploaded',
    particleCount,
    storageGeneration: 11,
    mechanicsBuffer: taggedBuffer(
      'slice5-source-mechanics',
      buffers.mlsMpmParticleState.mechanics.byteLength
    ),
    slot: 0
  };
  const activeNodeBuffer = taggedBuffer(
    'slice5-active-node-source',
    particleCount * 16 * Float32Array.BYTES_PER_ELEMENT
  );
  const activeNodeList = {
    schema: ULG_SCHROEDER_ACTIVE_NODE_LIST_EXECUTION_SCHEMA,
    status: 'schroeder-active-node-list-submitted',
    spatialDirectorySourceSchema:
      'peercompute.ulg.schroeder-spatial-directory-active-node-source.v1',
    spatialDirectorySourceStatus: 'schroeder-spatial-directory-source-ready',
    spatialDirectorySourceReady: true,
    spatialEpochSourceSchema:
      'peercompute.ulg.schroeder-spatial-active-node-source.v1',
    spatialEpochSourceStatus: 'schroeder-spatial-active-node-source-ready',
    spatialEpochSourceReady: true,
    spatialEpochLevelSpacingMode: 'base-grid-spacing-times-pow2-level',
    spatialEpochPositionAuthority: 'same-epoch-pre-integration-particle-state',
    spatialEpochMinLevel: 0,
    spatialEpochMaxLevel: 0,
    spatialEpochBaseGridSpacingM: 0.25,
    spatialEpochChartId: 0,
    activeCandidateCount: particleCount,
    activeNodeStrideFloats: 16,
    activeNodeBuffer,
    sourceStateBuffer: sphParticleUpload.stateBuffer,
    sourceStateBufferBorrowed: true,
    spatialEpochStorageGeneration: 11,
    spatialEpochPhysicsTick: 7,
    spatialEpochPhysicsSubstep: 0,
    spatialEpochPositionEpoch: 13,
    spatialEpochTopologyEpoch: 17,
    spatialEpochChartEpoch: 19,
    spatialEpochLevelEpoch: 23,
    spatialEpochSupportEpoch: 29,
    phaseVolumeAssignmentOverlayEnabled: false
  };
  Object.assign(sphParticleUpload, {
    physicsTick: activeNodeList.spatialEpochPhysicsTick,
    physicsSubstep: activeNodeList.spatialEpochPhysicsSubstep,
    positionEpoch: activeNodeList.spatialEpochPositionEpoch,
    topologyEpoch: activeNodeList.spatialEpochTopologyEpoch,
    chartEpoch: activeNodeList.spatialEpochChartEpoch,
    levelEpoch: activeNodeList.spatialEpochLevelEpoch,
    supportEpoch: activeNodeList.spatialEpochSupportEpoch
  });
  const generation = runSchroederSpatialEpochGenerationWebGpu({
    device,
    activeNodeList,
    particleCount
  });
  const enabledConsumerReaderIds = [
    SCHROEDER_SPATIAL_EPOCH_READER.PRESSURE_CONTACT_INTERFACE,
    SCHROEDER_SPATIAL_EPOCH_READER.REACTION_DISCOVERY,
    SCHROEDER_SPATIAL_EPOCH_READER.SEPARATION,
    SCHROEDER_SPATIAL_EPOCH_READER.THERMAL_CONDUCTION,
    SCHROEDER_SPATIAL_EPOCH_READER.THERMAL_RADIATION,
    SCHROEDER_SPATIAL_EPOCH_READER.LOCAL_MATERIAL_INTERFACE
  ];
  const consumerSupportProfileIds = {
    [SCHROEDER_SPATIAL_EPOCH_READER.PRESSURE_CONTACT_INTERFACE]:
      SCHROEDER_SPATIAL_EPOCH_SUPPORT_PROFILE_ID.PRESSURE_CONTACT_INTERFACE,
    [SCHROEDER_SPATIAL_EPOCH_READER.REACTION_DISCOVERY]:
      SCHROEDER_SPATIAL_EPOCH_SUPPORT_PROFILE_ID.REACTION_DISCOVERY,
    [SCHROEDER_SPATIAL_EPOCH_READER.SEPARATION]:
      SCHROEDER_SPATIAL_EPOCH_SUPPORT_PROFILE_ID.SEPARATION,
    [SCHROEDER_SPATIAL_EPOCH_READER.THERMAL_CONDUCTION]:
      SCHROEDER_SPATIAL_EPOCH_SUPPORT_PROFILE_ID.THERMAL_CONDUCTION,
    [SCHROEDER_SPATIAL_EPOCH_READER.THERMAL_RADIATION]:
      SCHROEDER_SPATIAL_EPOCH_SUPPORT_PROFILE_ID.THERMAL_RADIATION,
    [SCHROEDER_SPATIAL_EPOCH_READER.LOCAL_MATERIAL_INTERFACE]:
      SCHROEDER_SPATIAL_EPOCH_SUPPORT_PROFILE_ID.LOCAL_MATERIAL_INTERFACE
  };
  const transaction = createSchroederSpatialEpochTransaction({
    device,
    generation,
    sphParticleUpload,
    mlsMpmParticleUpload,
    enabledConsumerReaderIds,
    consumerSupportProfileIds
  });
  const materialProperties = {
    a: {
      molarMassKgPerMol: 0.01,
      phases: [{
        name: 'solid',
        temperatureRange: [0, 2000],
        cpJPerKgK: 1000,
        densityKgPerM3: 1000,
        bulkModulusPa: 1e6,
        shearModulusPa: 2e5
      }],
      transitions: []
    },
    b: {
      molarMassKgPerMol: 0.02,
      phases: [{
        name: 'liquid',
        temperatureRange: [0, 2000],
        cpJPerKgK: 1200,
        densityKgPerM3: 800,
        bulkModulusPa: 8e5,
        shearModulusPa: 0
      }],
      transitions: []
    },
    ab: {
      molarMassKgPerMol: 0.03,
      phases: [{
        name: 'liquid',
        temperatureRange: [0, 3000],
        cpJPerKgK: 1500,
        densityKgPerM3: 500,
        bulkModulusPa: 5e5,
        shearModulusPa: 0
      }],
      transitions: []
    }
  };
  const thermalMaterialTable = buildSphThermalMaterialTable(materialProperties);
  const reactionTable = buildSphReactionTable([{
    a: 'a',
    b: 'b',
    product: 'ab',
    activationTemperatureK: 0,
    phaseRequirements: { b: ['liquid'] },
    specificEnthalpyJPerKg: -1000
  }], {
    materialProperties,
    contactRadiusM: 0.25
  });

  const step = await runMlsMpmResidentStepWithOptionalWebGpu({
    ...buffers,
    sphParticleUpload,
    mlsMpmParticleUpload,
    schroederSelectedLevel: 0,
    schroederSpatialEpochGeneration: generation,
    schroederSpatialEpochTransaction: transaction,
    canonicalSpatialRequired: true,
    preferWebGpu: true,
    device,
    boxDimsM: [2, 2, 2],
    gravityMPerS2: [0, 0, 0],
    readbackMode: 'no-full-readback',
    fuseNoFullResidentMechanics: true,
    thermalMaterialTable,
    reactionTable,
    measureFusedSequenceQueueFence: true,
    summaryRunner: null
  });

  const summary = summarizeSchroederSpatialEpochTransaction(transaction);
  assert.equal(summary.state, 'readers-complete');
  assert.deepEqual(
    summary.admittedReaders.map(({ readerId }) => readerId),
    [
      SCHROEDER_SPATIAL_EPOCH_READER.PRESSURE_CONTACT_INTERFACE,
      SCHROEDER_SPATIAL_EPOCH_READER.SEPARATION,
      SCHROEDER_SPATIAL_EPOCH_READER.THERMAL_CONDUCTION,
      SCHROEDER_SPATIAL_EPOCH_READER.THERMAL_RADIATION,
      SCHROEDER_SPATIAL_EPOCH_READER.LOCAL_MATERIAL_INTERFACE,
      'mechanics-p2g',
      'mechanics-g2p',
      SCHROEDER_SPATIAL_EPOCH_READER.REACTION_DISCOVERY
    ]
  );
  assert.equal(summary.consumerReceipts.length, 6);
  assert.equal(summary.counters.authenticatedConsumerTraversalCount, 1);
  assert.equal(summary.counters.residentDeferredConsumerCount, 5);
  assert.equal(summary.counters.residentDeferredSharedExecutionCount, 3);
  assert.equal(summary.counters.legacyPrivateLookupBuildCount, 0);
  assert.equal(summary.counters.legacyExhaustiveTraversalCount, 0);
  assert.equal(step.schroederSpatialExactNearProposalSummary.directoryBuildCount, 1);
  assert.deepEqual(
    step.schroederSpatialExactNearProposalSummary.authenticatedConsumerIds,
    [
      SCHROEDER_SPATIAL_EPOCH_READER.PRESSURE_CONTACT_INTERFACE,
      SCHROEDER_SPATIAL_EPOCH_READER.SEPARATION,
      SCHROEDER_SPATIAL_EPOCH_READER.THERMAL_CONDUCTION,
      SCHROEDER_SPATIAL_EPOCH_READER.THERMAL_RADIATION,
      SCHROEDER_SPATIAL_EPOCH_READER.LOCAL_MATERIAL_INTERFACE,
      SCHROEDER_SPATIAL_EPOCH_READER.REACTION_DISCOVERY
    ]
  );
  assert.deepEqual(
    step.schroederSpatialExactNearProposalSummary.residentBoundConsumerIds,
    [
      SCHROEDER_SPATIAL_EPOCH_READER.PRESSURE_CONTACT_INTERFACE,
      SCHROEDER_SPATIAL_EPOCH_READER.SEPARATION,
      SCHROEDER_SPATIAL_EPOCH_READER.THERMAL_CONDUCTION,
      SCHROEDER_SPATIAL_EPOCH_READER.THERMAL_RADIATION,
      SCHROEDER_SPATIAL_EPOCH_READER.LOCAL_MATERIAL_INTERFACE
    ]
  );
  assert.deepEqual(
    step.schroederSpatialExactNearProposalSummary.resultAuthenticatedConsumerIds,
    [
      SCHROEDER_SPATIAL_EPOCH_READER.REACTION_DISCOVERY
    ]
  );
  assert.equal(
    step.schroederSpatialExactNearProposalSummary
      .residentMechanicalSharedExecutionCount,
    1
  );
  assert.equal(step.thermalStep.canonicalSpatialThermalProposal, true);
  assert.equal(step.thermalStep.legacyExhaustiveTraversalCount, 0);
  assert.equal(step.reactionStep.canonicalSpatialReactionDiscovery, true);
  assert.equal(step.reactionStep.legacyPrivateSpatialBuildCount, 0);
  assert.equal(step.reactionStep.legacyExhaustiveTraversalCount, 0);
  assert.equal(
    step.stageTiming.queueFenceStatus.fusedMechanicsSequence,
    'complete'
  );
  assert.equal(
    step.stageTiming.queueFenceMethod.fusedMechanicsSequence,
    'queue.onSubmittedWorkDone'
  );
  assert.equal(
    device.createdBuffers.some(({ label }) => (
      String(label).startsWith('ulg-sph-reaction-particle-bin-')
      || String(label).startsWith('ulg-mls-mpm-separation-')
      || label === 'ulg-sph-thermal-bin-placeholder'
    )),
    false
  );
});

test('MLS-MPM canonical fused cleanup releases proposals without legacy separation scratch after evidence readback failure', async () => {
  const buffers = manualBuffers({ smoothingLengthM: 0.5 });
  const stateStrideFloats = buffers.sphParticleState.state.length;
  const duplicateRows = (source) => {
    const values = new Float32Array(source.length * 2);
    values.set(source, 0);
    values.set(source, source.length);
    return values;
  };
  buffers.sphParticleState.particleCount = 2;
  buffers.sphParticleState.state = duplicateRows(buffers.sphParticleState.state);
  buffers.sphParticleState.state[stateStrideFloats] += 0.1;
  buffers.sphParticleState.thermo = duplicateRows(buffers.sphParticleState.thermo);
  buffers.mlsMpmParticleState.particleCount = 2;
  buffers.mlsMpmParticleState.mechanics = duplicateRows(
    buffers.mlsMpmParticleState.mechanics
  );

  const tracker = fakeBufferTracker();
  const device = fakeSummaryDevice(new Float32Array(MLS_MPM_GPU_RESIDENT_SUMMARY_FLOATS));
  const createBuffer = device.createBuffer.bind(device);
  device.createBuffer = (descriptor) => {
    const buffer = createBuffer(descriptor);
    if (descriptor.label === 'ulg-mls-mpm-fused-canonical-spatial-authority-evidence-readback') {
      buffer.mapAsync = async () => {
        throw new Error('synthetic canonical evidence map failure');
      };
    }
    return buffer;
  };
  const directoryBuffer = tracker.buffer('retained-schroeder-spatial-directory');
  const evidenceBuffer = tracker.buffer('retained-schroeder-spatial-evidence');
  evidenceBuffer.size = 80;
  const exactNearQueryProfile = { ready: true };
  const generation = {
    schema: 'peercompute.ulg.schroeder-spatial-epoch-generation.v1',
    selected: true,
    ready: true,
    source: { phaseVolumeAssignmentOverlayEnabled: false },
    execution: {
      schema: 'peercompute.ulg.schroeder-spatial-epoch.v1',
      submitPerformed: true,
      directoryBuffer,
      evidenceBuffer,
      evidenceBufferByteLength: 80,
      sourceAdapterId: SCHROEDER_SPATIAL_SOURCE_ADAPTER_EXACT_NEAR_QUERY,
      exactNearQueryProfile,
      queryGeometryEvidence: exactNearQueryProfile,
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
      supportEpoch: 71,
      layout: { byteLength: 256 }
    }
  };
  let proposalReleaseCount = 0;
  const canonicalMechanicalProposalRunner = async ({
    generation: sourceGeneration
  }) => canonicalMechanicalProposalFixture({
    generation: sourceGeneration,
    makeBuffer: (label) => tracker.buffer(label),
    encodeApply(encoder) {
      encodeCanonicalMechanicalFixtureBundle(encoder);
    },
    releaseAfterSubmittedWork() {
      proposalReleaseCount += 1;
      return proposalReleaseCount === 1;
    }
  });

  await assert.rejects(
    () => runMlsMpmResidentStepWithOptionalWebGpu({
      ...buffers,
      sphParticleUpload: {
        status: 'webgpu-uploaded',
        stateBuffer: tracker.buffer('source-state'),
        thermoBuffer: tracker.buffer('source-thermo'),
        slot: 0
      },
      mlsMpmParticleUpload: {
        status: 'webgpu-uploaded',
        mechanicsBuffer: tracker.buffer('source-mechanics'),
        slot: 0
      },
      schroederSelectedLevel: 2,
      schroederSpatialEpochGeneration: generation,
      spatialMechanicalProposalRunner: canonicalMechanicalProposalRunner,
      canonicalSpatialRequired: true,
      observeCanonicalSpatialAuthority: true,
      preferWebGpu: true,
      device,
      boxDimsM: [3, 3, 3],
      readbackMode: 'no-full-readback',
      fuseNoFullResidentMechanics: true,
      summaryRunner: null
    }),
    /synthetic canonical evidence map failure/
  );
  await new Promise((resolve) => setImmediate(resolve));

  const separationScratch = device.createdBuffers.filter((buffer) => (
    [
      'ulg-mls-mpm-separation-params',
      'ulg-mls-mpm-separation-corrections',
      'ulg-mls-mpm-separation-bins'
    ].includes(buffer.label)
  ));
  assert.equal(separationScratch.length, 0);
  assert.equal(proposalReleaseCount, 1);
  assert.notEqual(directoryBuffer.destroyed, true);
  assert.notEqual(evidenceBuffer.destroyed, true);
});

test('MLS-MPM resident fused P2G rejects host-invalid canonical generations', async (t) => {
  const cases = [
    {
      name: 'released execution',
      status: 'canonical-spatial-directory-rejected-released-generation',
      invalidate(generation) {
        generation.execution.released = true;
      }
    },
    {
      name: 'wrong generation schema',
      status: 'canonical-spatial-directory-rejected-schema',
      invalidate(generation) {
        generation.schema = 'peercompute.ulg.schroeder-spatial-epoch-generation.invalid';
      }
    },
    {
      name: 'wrong execution schema',
      status: 'canonical-spatial-directory-rejected-schema',
      invalidate(generation) {
        generation.execution.schema = 'peercompute.ulg.schroeder-spatial-epoch.invalid';
      }
    },
    {
      name: 'cross-device directory buffer',
      status: 'canonical-spatial-directory-rejected-device',
      invalidate(generation) {
        tagWebGpuBufferDevice(generation.execution.directoryBuffer, {});
      }
    },
    {
      name: 'cross-device evidence buffer',
      status: 'canonical-spatial-directory-rejected-device',
      invalidate(generation) {
        tagWebGpuBufferDevice(generation.execution.evidenceBuffer, {});
      }
    },
    {
      name: 'undersized evidence buffer',
      status: 'canonical-spatial-directory-rejected-evidence-capacity',
      invalidate(generation) {
        generation.execution.evidenceBuffer.size = 76;
      }
    },
    {
      name: 'torn exact-near query profile',
      status: 'canonical-spatial-directory-rejected-query-geometry',
      invalidate(generation) {
        generation.execution.queryGeometryEvidence = { ready: true };
      }
    },
    {
      name: 'phase-volume overlay authority',
      status: 'canonical-spatial-directory-rejected-overlay-authority',
      invalidate(generation) {
        generation.source.phaseVolumeAssignmentOverlayEnabled = true;
      }
    },
    {
      name: 'overlay authority takes precedence over a wrong schema',
      status: 'canonical-spatial-directory-rejected-overlay-authority',
      invalidate(generation) {
        generation.source.phaseVolumeAssignmentOverlayEnabled = true;
        generation.schema = 'peercompute.ulg.schroeder-spatial-epoch-generation.invalid';
      }
    },
    {
      name: 'selected level is not an exact i32',
      status: 'canonical-spatial-selected-level-rejected',
      selectedLevel: Number.NaN,
      invalidate() {}
    }
  ];

  for (const testCase of cases) {
    await t.test(testCase.name, async () => {
      const buffers = manualBuffers();
      const tracker = fakeBufferTracker();
      const device = fakeSummaryDevice(new Float32Array(MLS_MPM_GPU_RESIDENT_SUMMARY_FLOATS));
      const schroederAssignmentBuffer = tracker.buffer('retained-schroeder-assignment');
      const schroederSpatialDirectoryBuffer = tracker.buffer('retained-schroeder-spatial-directory');
      const schroederSpatialEvidenceBuffer = tracker.buffer('retained-schroeder-spatial-evidence');
      schroederSpatialEvidenceBuffer.size = 80;
      const exactNearQueryProfile = { ready: true };
      const generation = {
        schema: 'peercompute.ulg.schroeder-spatial-epoch-generation.v1',
        selected: true,
        ready: true,
        source: { phaseVolumeAssignmentOverlayEnabled: false },
        execution: {
          schema: 'peercompute.ulg.schroeder-spatial-epoch.v1',
          submitPerformed: true,
          directoryBuffer: schroederSpatialDirectoryBuffer,
          evidenceBuffer: schroederSpatialEvidenceBuffer,
          evidenceBufferByteLength: 80,
          sourceAdapterId: SCHROEDER_SPATIAL_SOURCE_ADAPTER_EXACT_NEAR_QUERY,
          exactNearQueryProfile,
          queryGeometryEvidence: exactNearQueryProfile,
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
          supportEpoch: 71,
          layout: { byteLength: 256 }
        }
      };
      testCase.invalidate(generation);

      await assert.rejects(
        () => runMlsMpmResidentStepWithOptionalWebGpu({
          ...buffers,
          sphParticleUpload: {
            status: 'webgpu-uploaded',
            stateBuffer: tracker.buffer('source-state'),
            thermoBuffer: tracker.buffer('source-thermo'),
            slot: 0
          },
          mlsMpmParticleUpload: {
            status: 'webgpu-uploaded',
            mechanicsBuffer: tracker.buffer('source-mechanics'),
            slot: 0
          },
          schroederLevelAssignment: {
            schema: ULG_SCHROEDER_LEVEL_ASSIGNMENT_EXECUTION_SCHEMA,
            status: 'schroeder-level-assignment-submitted',
            particleCount: buffers.sphParticleState.particleCount,
            assignmentStrideFloats: SCHROEDER_LEVEL_ASSIGNMENT_ROW_LAYOUT.length,
            assignmentBuffer: schroederAssignmentBuffer,
            assignmentBufferByteLength:
              SCHROEDER_LEVEL_ASSIGNMENT_ROW_LAYOUT.length * Float32Array.BYTES_PER_ELEMENT,
            retainedAssignmentBuffer: true
          },
          schroederSelectedLevel: testCase.selectedLevel ?? 2,
          schroederSpatialEpochGeneration: generation,
          canonicalSpatialRequired: true,
          preferWebGpu: true,
          device,
          boxDimsM: [3, 3, 3],
          readbackMode: 'no-full-readback',
          fuseNoFullResidentMechanics: true,
          summaryRunner: null
        }),
        (error) => {
          assert.equal(error.code, 'ERR_CANONICAL_SPATIAL_AUTHORITY_REJECTED');
          assert.equal(error.status, testCase.status);
          return true;
        }
      );
      assert.equal(device.submissions.length, 0);
      assert.equal(device.dispatches.length, 0);
      assert.equal(device.bindGroups.length, 0);
    });
  }
});

test('MLS-MPM resident step can active-grid fused no-full mechanics dispatch', async () => {
  const buffers = manualBuffers({
    position: [1.5, 1.5, 1.5],
    velocity: [0, 0, 0],
    smoothingLengthM: 0.25
  });
  const tracker = fakeBufferTracker();
  const device = fakeSummaryDevice(new Float32Array(MLS_MPM_GPU_RESIDENT_SUMMARY_FLOATS));
  const step = await runMlsMpmResidentStepWithOptionalWebGpu({
    ...buffers,
    sphParticleUpload: {
      status: 'webgpu-uploaded',
      stateBuffer: tracker.buffer('source-state'),
      thermoBuffer: tracker.buffer('source-thermo'),
      slot: 0
    },
    mlsMpmParticleUpload: {
      status: 'webgpu-uploaded',
      mechanicsBuffer: tracker.buffer('source-mechanics'),
      slot: 0
    },
    preferWebGpu: true,
    device,
    boxDimsM: [3, 3, 3],
    gravityMPerS2: [0, 0, 0],
    ambientPressurePa: 101325,
    readbackMode: 'no-full-readback',
    fuseNoFullResidentMechanics: true,
    fuseNoFullResidentMechanicsActiveGrid: true,
    activeGridSafetyCells: 1,
    summaryRunner: null
  });

  const activeGridDispatch = step.stageTiming.activeGridDispatch;
  assert.equal(step.stageTiming.fusedResidentMechanics, true);
  assert.equal(activeGridDispatch.useActiveGrid, true);
  assert.ok(activeGridDispatch.activeNodeCount < activeGridDispatch.fullGridNodeCount);
  assert.equal(step.p2gGridProjection.activeGridDispatch.useActiveGrid, true);
  assert.equal(step.gridUpdate.activeGridDispatch.useActiveGrid, true);
  assert.equal(step.g2pReconstruction.activeGridDispatch.useActiveGrid, true);
  assert.equal(step.stageTiming.dispatchTopology.gridUpdate.dispatchAxis, 'active-grid-node');
  assert.equal(step.stageTiming.dispatchTopology.p2gFinalize.dispatchAxis, 'active-grid-node');
  assert.equal(step.stageTiming.dispatchTopology.p2gAccumulatorClear.dispatchAxis, 'active-grid-node');
  assert.equal(step.stageTiming.dispatchTopology.p2gAccumulatorClear.bufferClearMode, 'active-grid-compute-clear');
  assert.equal(
    step.stageTiming.dispatchTopology.p2gFinalize.dispatchWorkgroupsPerSubstep,
    Math.ceil(activeGridDispatch.activeNodeCount / 64)
  );
  assert.equal(
    step.stageTiming.dispatchTopology.p2gAccumulatorClear.dispatchWorkgroupsPerSubstep,
    Math.ceil(activeGridDispatch.activeNodeCount / 64)
  );
  assert.equal(step.stageTiming.dispatchTopology.totalDispatches, 5);
  assert.equal(step.stageTiming.activeGridIndirectDispatch.status, 'cpu-seeded-active-grid-indirect-dispatch-ready');
  assert.equal(step.stageTiming.activeGridIndirectDispatch.dispatchMode, 'dispatchWorkgroupsIndirect');
  assert.equal(step.stageTiming.activeGridIndirectDispatch.indirectDispatchUseCount, 3);
  assert.equal(step.stageTiming.dispatchTopology.p2gFinalize.dispatchSubmissionMode, 'dispatchWorkgroupsIndirect');
  assert.equal(step.stageTiming.dispatchTopology.gridUpdate.indirectDispatchUsed, true);
  assert.equal(step.stageTiming.compactSummaryRequested, false);
  assert.equal(step.stageTiming.activeGridDispatchPlanOnlyRequested, true);
  assert.equal(step.compactGpuSummary.status, 'compact-summary-plan-only-ready');
  assert.equal(step.compactGpuSummary.readbackMode, 'no-compact-summary-readback');
  assert.equal(step.compactGpuSummary.timing.mapAsyncWaitMs, null);
  assert.equal(step.residentActiveGridDispatchPlanHint.status, 'active-grid-summary-dispatch-plan-hint-ready');
  assert.equal(step.nextParticleUploads.activeGridDispatchPlanHint.status, 'active-grid-summary-dispatch-plan-hint-ready');
  assert.equal(device.dispatches.length, 5);
  assert.deepEqual(device.dispatches.map((entry) => entry.count), [1, 1, 154, 1, 1]);
  assert.equal(device.indirectDispatches.length, 3);
  assert.deepEqual(
    device.indirectDispatches.map((entry) => entry.workgroupCountX),
    Array(3).fill(Math.ceil(activeGridDispatch.activeNodeCount / 64))
  );
  assert.ok(device.indirectDispatches[0].workgroupCountX < Math.ceil(activeGridDispatch.fullGridNodeCount / 64));
  const p2gParamWrite = device.writes.find((write) => write.label === 'ulg-mls-mpm-fused-p2g-params');
  assert.ok(p2gParamWrite);
  assert.equal(new DataView(p2gParamWrite.data).getFloat32(68, true), 101325);
  assert.equal(device.copies.length, 0);
  assert.equal(device.clears.length, 0);
  assert.ok(device.shaderModules.length > 0);
  assert.equal(
    device.shaderModules.every((module) => (
      typeof module.code === 'string' && module.code.length > 0
    )),
    true
  );
  destroyMlsMpmResidentStepBuffers(step);
});

test('MLS-MPM resident step rejects a GPU resident lane lease when WebGPU device acquisition fails', async () => {
  const buffers = manualBuffers();
  const gpuResidentLaneManager = fakeGpuResidentLaneManager();
  await assert.rejects(
    () => runMlsMpmResidentStepWithOptionalWebGpu({
      ...buffers,
      preferWebGpu: true,
      navigatorRef: {
        gpu: {
          async requestAdapter() {
            throw new Error('synthetic adapter failure');
          }
        }
      },
      gpuResidentLaneManager,
      gpuResidentLaneId: 'ulg:test:sph-resident-failure',
      gpuResidentLaneStateKey: 'ulg:test:sph-resident-state'
    }),
    /synthetic adapter failure/
  );

  assert.equal(gpuResidentLaneManager.calls.acquire.length, 1);
  assert.equal(gpuResidentLaneManager.calls.complete.length, 0);
  assert.equal(gpuResidentLaneManager.calls.reject.length, 1);
  assert.equal(gpuResidentLaneManager.calls.reject[0].leaseId, gpuResidentLaneManager.calls.acquire[0].lease.leaseId);
  assert.equal(gpuResidentLaneManager.calls.reject[0].reason, 'resident-step-error');
  assert.equal(gpuResidentLaneManager.activeLeaseCount, 0);
});

test('MLS-MPM resident step compute task declares ComputeManager GPU lane and fence requirements', async () => {
  const { buffers, options } = noFullReadbackResidentStepFixture();
  const task = createMlsMpmResidentStepComputeTask({
    ...options,
    modulePath: './sphMlsMpmGpuStep.js',
    taskId: 'ulg:test:resident-step-task',
    laneId: 'ulg:test:sph-resident',
    stateKey: 'ulg:test:sph-state',
    domainKey: 'ulg:test-domain',
    retainedBufferRefs: ['sph-state-buffer', 'mls-mpm-mechanics-buffer']
  });

  assert.equal(task.schema, ULG_MLS_MPM_RESIDENT_COMPUTE_TASK_SCHEMA);
  assert.equal(task.runtime, 'js');
  assert.equal(task.module, './sphMlsMpmGpuStep.js');
  assert.equal(task.exportName, 'runMlsMpmResidentStepComputeTask');
  assert.equal(task.residency, 'gpu-lane');
  assert.equal(task.returnEnvelope, true);
  assert.equal(task.gpuFence.schema, 'peercompute.compute.gpu-fence-requirement.v0');
  assert.equal(task.gpuFence.required, true);
  assert.equal(task.gpuFence.laneId, 'ulg:test:sph-resident');
  assert.equal(task.gpuFence.stateKey, 'ulg:test:sph-state');
  assert.equal(task.gpuResidentLane.schema, 'peercompute.compute.gpu-resident-lane-task.v0');
  assert.equal(task.gpuResidentLane.localExecution, 'inline');
  assert.equal(task.gpuResidentLane.laneId, 'ulg:test:sph-resident');
  assert.equal(task.gpuResidentLane.stateKey, 'ulg:test:sph-state');
  assert.equal(task.gpuResidentLane.domainKey, 'ulg:test-domain');
  assert.equal(task.gpuResidentLane.copyBudget.readbackBytes, MLS_MPM_GPU_RESIDENT_SUMMARY_BYTES);
  assert.equal(task.gpuResidentLane.copyBudget.retainedBytes, buffers.sphParticleState.state.byteLength + buffers.sphParticleState.thermo.byteLength + buffers.mlsMpmParticleState.mechanics.byteLength);
  assert.deepEqual(task.webgpu.retainedBufferRefs, ['sph-state-buffer', 'mls-mpm-mechanics-buffer']);
  assert.equal(task.data.gpuResidentLaneManager, undefined);
  assert.equal(task.data.gpuFenceRequirement.laneId, 'ulg:test:sph-resident');
  assert.equal(task.data.gpuResidentLane.stateKey, 'ulg:test:sph-state');
});

test('MLS-MPM resident step compute task handler returns explicit GPU fence evidence without local double leasing', async () => {
  const { options } = noFullReadbackResidentStepFixture();
  const ignoredLaneManager = fakeGpuResidentLaneManager();
  const task = createMlsMpmResidentStepComputeTask({
    ...options,
    modulePath: './sphMlsMpmGpuStep.js',
    laneId: 'ulg:test:sph-resident',
    stateKey: 'ulg:test:sph-state',
    gpuResidentLaneManager: ignoredLaneManager
  });
  const result = await runMlsMpmResidentStepComputeTask(task.data);

  assert.equal(result.schema, ULG_MLS_MPM_GPU_RESIDENT_STEP_EXECUTION_SCHEMA);
  assert.equal(result.computeTaskResultSchema, ULG_MLS_MPM_RESIDENT_COMPUTE_TASK_RESULT_SCHEMA);
  assert.equal(result.computeTaskSchema, ULG_MLS_MPM_RESIDENT_COMPUTE_TASK_SCHEMA);
  assert.equal(result.status, 'resident-step-webgpu-executed');
  assert.equal(result.gpuFence.schema, 'peercompute.compute.gpu-fence-report.v0');
  assert.equal(result.gpuFence.status, 'queue-work-completed');
  assert.equal(result.gpuFence.method, 'queue.onSubmittedWorkDone');
  assert.equal(result.gpuFence.fenceSatisfied, true);
  assert.equal(result.gpuFence.required, true);
  assert.equal(result.gpuFence.laneId, 'ulg:test:sph-resident');
  assert.equal(result.gpuFence.stateKey, 'ulg:test:sph-state');
  assert.deepEqual(result.gpuFence.retainedBufferRefs, [
    'p2g-grid-buffer',
    'updated-grid-buffer',
    'sph-state-buffer',
    'sph-thermo-buffer',
    'mls-mpm-mechanics-buffer'
  ]);
  assert.equal(result.gpuResidentLaneStatus, undefined);
  assert.equal(ignoredLaneManager.calls.acquire.length, 0);
  const directFence = createMlsMpmResidentStepGpuFenceReport(result, task.gpuFence);
  assert.equal(directFence.fenceSatisfied, true);
  assert.equal(directFence.laneId, 'ulg:test:sph-resident');
});

test('MLS-MPM resident step compute task observes a real outer queue fence for deferred cleanup', async () => {
  const { options } = noFullReadbackResidentStepFixture();
  const originalGridUpdateRunner = options.gridUpdateRunner;
  let queueFenceCallCount = 0;
  const device = {
    queue: {
      async onSubmittedWorkDone() {
        queueFenceCallCount += 1;
      }
    }
  };
  const task = createMlsMpmResidentStepComputeTask({
    ...options,
    device,
    gridUpdateRunner(args) {
      return {
        ...originalGridUpdateRunner(args),
        queueCompletionStatus: 'queue-submitted-cleanup-deferred',
        queueCompletionMethod: 'deferred unified fused mechanics cleanup'
      };
    },
    modulePath: './sphMlsMpmGpuStep.js',
    laneId: 'ulg:test:sph-resident-outer-fence',
    stateKey: 'ulg:test:sph-state-outer-fence'
  });

  const result = await runMlsMpmResidentStepComputeTask(task.data);

  assert.equal(queueFenceCallCount, 1);
  assert.equal(result.gpuFence.status, 'queue-work-completed');
  assert.equal(result.gpuFence.method, 'queue.onSubmittedWorkDone');
  assert.equal(result.gpuFence.fenceSatisfied, true);
  assert.equal(result.gpuFence.satisfactionReason, 'compute-task-observed-real-queue-completion');
});

test('MLS-MPM resident step fence rejects deferred cleanup without a completed queue fence', () => {
  const fence = createMlsMpmResidentStepGpuFenceReport({
    backend: 'webgpu',
    status: 'resident-step-webgpu-executed',
    readbackMode: 'no-full-readback',
    normalHotLoopReadbackFree: true,
    residentBuffersRetained: true,
    gridUpdate: {
      queueCompletionStatus: 'queue-submitted-cleanup-deferred',
      queueCompletionMethod: 'deferred unified fused mechanics cleanup'
    },
    nextParticleUploads: {
      sphParticleUpload: {
        stateBuffer: { label: 'retained-state-buffer' },
        thermoBuffer: { label: 'retained-thermo-buffer' }
      },
      mlsMpmParticleUpload: {
        mechanicsBuffer: { label: 'retained-mechanics-buffer' }
      }
    }
  }, {
    required: true,
    laneId: 'ulg:test:sph-resident',
    stateKey: 'ulg:test:sph-state'
  });

  assert.equal(fence.status, 'queue-submitted-cleanup-deferred');
  assert.equal(fence.method, 'deferred unified fused mechanics cleanup');
  assert.equal(fence.fenceSatisfied, false);
  assert.equal(fence.satisfactionReason, null);
  assert.equal(fence.laneId, 'ulg:test:sph-resident');
  assert.equal(fence.stateKey, 'ulg:test:sph-state');
});

test('SPH thermal phase stage compute task declares retained thermo lane output without authority mutation', async () => {
  const buffers = manualBuffers();
  const tracker = fakeBufferTracker();
  const sourceStateBuffer = tracker.buffer('g2p-state-in');
  const sourceThermoBuffer = tracker.buffer('source-thermo-in');
  const task = createSphThermalPhaseStageComputeTask({
    modulePath: './sphMlsMpmGpuStep.js',
    taskId: 'ulg:test:thermal-phase-stage',
    laneId: 'ulg:test:thermal-phase-lane',
    stateKey: 'ulg:test:thermal-phase-state',
    domainKey: 'ulg:test-domain',
    preferWebGpu: true,
    sphParticleState: buffers.sphParticleState,
    thermalMaterialTable: { schema: 'peercompute.ulg.sph-gpu-thermal-material-table.v0' },
    sphParticleUpload: {
      status: 'webgpu-uploaded',
      stateBuffer: tracker.buffer('source-state-upload'),
      thermoBuffer: sourceThermoBuffer
    },
    sourceStateBuffer,
    sourceThermoBuffer,
    boxDimsM: [5, 5, 5],
    dtS: 0.1
  });

  assert.equal(task.schema, ULG_SPH_THERMAL_PHASE_STAGE_COMPUTE_TASK_SCHEMA);
  assert.equal(task.exportName, 'runSphThermalPhaseStageComputeTask');
  assert.equal(task.residency, 'gpu-lane');
  assert.equal(task.suppressCommitDelta, true);
  assert.equal(task.gpuFence.required, true);
  assert.equal(task.gpuFence.laneId, 'ulg:test:thermal-phase-lane');
  assert.equal(task.gpuResidentLane.owner, 'ulg-thermal-phase-law');
  assert.deepEqual(task.writeFamilies, ['sph-thermo-phase']);
  assert.deepEqual(task.webgpu.retainedBufferRefs, ['sph-state-buffer', 'sph-thermo-buffer']);

  const result = await runSphThermalPhaseStageComputeTask({
    ...task.data,
    thermalStepRunner(args) {
      assert.equal(args.sphParticleUpload.thermoBuffer, sourceThermoBuffer);
      assert.equal(args.sourceStateBuffer, sourceStateBuffer);
      assert.equal(args.sourceThermoBuffer, sourceThermoBuffer);
      assert.equal(args.retainOutputParticleBuffers, true);
      return {
        schema: 'peercompute.ulg.sph-gpu-thermal-step-execution.v0',
        backend: 'webgpu',
        status: 'webgpu-accepted',
        webgpuStatus: { status: 'webgpu-executed' },
        result: {
          schema: ULG_SPH_GPU_THERMAL_STEP_SCHEMA,
          backend: 'webgpu',
          status: 'thermal-step-executed',
          particleCount: buffers.sphParticleState.particleCount,
          state: new Float32Array(),
          thermo: new Float32Array(),
          stateBuffer: tracker.buffer('thermal-state-out'),
          thermoBuffer: tracker.buffer('thermal-thermo-out'),
          stateBufferByteLength: buffers.sphParticleState.state.byteLength,
          thermoBufferByteLength: buffers.sphParticleState.thermo.byteLength,
          retainedOutputParticleBuffers: true,
          readbackMode: 'full-parity-readback',
          fullReadbackPerformed: true,
          normalHotLoopReadbackFree: false
        }
      };
    }
  });

  assert.equal(result.computeTaskResultSchema, ULG_SPH_THERMAL_PHASE_STAGE_COMPUTE_TASK_RESULT_SCHEMA);
  assert.equal(result.computeTaskSchema, ULG_SPH_THERMAL_PHASE_STAGE_COMPUTE_TASK_SCHEMA);
  assert.equal(result.computeTaskId, 'ulg:test:thermal-phase-stage');
  assert.equal(result.backend, 'webgpu');
  assert.equal(result.status, 'webgpu-accepted');
  assert.equal(result.stateBuffer.label, 'thermal-state-out');
  assert.equal(result.thermoBuffer.label, 'thermal-thermo-out');
  assert.equal(result.gpuFence.schema, 'peercompute.compute.gpu-fence-report.v0');
  assert.equal(result.gpuFence.required, true);
  assert.equal(result.gpuFence.fenceSatisfied, true);
  assert.equal(result.thermalPhaseStageTaskEvidence.schema, 'peercompute.ulg.thermal-phase-stage-task-evidence.v0');
  assert.equal(result.thermalPhaseStageTaskEvidence.passed, true);
  assert.deepEqual(result.thermalPhaseStageTaskEvidence.candidateWriteFamilies, ['sph-thermo-phase']);
  assert.ok(result.thermalPhaseStageTaskEvidence.mustNotWriteFamilies.includes('resident-product-mass'));
  assert.equal(result.thermalPhaseStageTaskAuthority.status, 'compute-manager-owned-non-mutating-thermal-phase-stage-task');
  assert.equal(result.thermalPhaseStageTaskAuthority.authoritativeStateMutation, false);
  assert.equal(result.thermalPhaseStageTaskAuthority.commitDeltaSuppressed, true);
});

test('SPH gas-cell EOS producer stage publishes retained gas pressure cell rows', async () => {
  const spatialGasSpeciesLedger = {
    schema: 'peercompute.ulg.sph-spatial-gas-species-ledger.v0',
    status: 'spatial-gas-species-ledger-ready',
    source: 'test-spatial-product-events',
    spatialGasSourceBufferRetained: true,
    retainedSpatialGasSourceBufferRefs: ['resident-product-mass-buffer'],
    cellDims: [2, 1, 1],
    cellCount: 2,
    cells: [
      {
        index: 0,
        gridIndex: [0, 0, 0],
        centerM: [0.5, 1, 1],
        volumeM3: 4,
        bySpecies: {
          h2: { material: 'h2', massKg: 0.04, moles: 200, temperatureK: 300 }
        }
      },
      {
        index: 1,
        gridIndex: [1, 0, 0],
        centerM: [1.5, 1, 1],
        volumeM3: 4,
        bySpecies: {
          h2: { material: 'h2', massKg: 0.06, moles: 300, temperatureK: 300 }
        }
      }
    ]
  };
  const gasPressureSummary = {
    schema: 'peercompute.ulg.sph-sealed-gas-pressure-summary.v0',
    status: 'gpu-resident-reaction-pressure-summary',
    source: 'gpu-resident-product-mass-gas-species-ledger',
    totalPressurePa: 180000,
    boxVolumeM3: 8,
    boxDimsM: [2, 2, 2],
    bySpecies: {},
    spatialGasSpeciesLedger
  };
  const device = fakeSummaryDevice(new Float32Array(0));
  const task = createSphGasCellEosProducerStageComputeTask({
    modulePath: './sphMlsMpmGpuStep.js',
    taskId: 'ulg:test:gas-cell-eos-producer-stage',
    laneId: 'ulg:test:gas-cell-eos-lane',
    stateKey: 'ulg:test:gas-cell-eos-state',
    domainKey: 'ulg:test-domain',
    preferWebGpu: true,
    readbackMode: 'no-full-readback',
    gasPressureSummary,
    device
  });

  assert.equal(task.schema, ULG_SPH_GAS_CELL_EOS_PRODUCER_STAGE_COMPUTE_TASK_SCHEMA);
  assert.equal(task.exportName, 'runSphGasCellEosProducerStageComputeTask');
  assert.equal(task.residency, 'gpu-lane');
  assert.equal(task.suppressCommitDelta, true);
  assert.deepEqual(task.readFamilies, ['resident-spatial-gas-species-ledger', 'resident-product-mass']);
  assert.deepEqual(task.writeFamilies, ['resident-gas-pressure']);
  assert.deepEqual(task.webgpu.retainedBufferRefs, ['resident-gas-pressure-cells-buffer']);
  assert.equal(task.gpuFence.required, true);
  assert.equal(task.gpuFence.laneId, 'ulg:test:gas-cell-eos-lane');
  assert.equal(task.gpuResidentLane.owner, 'ulg-resident-gas-cell-eos-law');

  const result = await runSphGasCellEosProducerStageComputeTask(task.data);

  assert.equal(result.computeTaskResultSchema, ULG_SPH_GAS_CELL_EOS_PRODUCER_STAGE_COMPUTE_TASK_RESULT_SCHEMA);
  assert.equal(result.computeTaskSchema, ULG_SPH_GAS_CELL_EOS_PRODUCER_STAGE_COMPUTE_TASK_SCHEMA);
  assert.equal(result.computeTaskId, 'ulg:test:gas-cell-eos-producer-stage');
  assert.equal(result.backend, 'webgpu');
  assert.equal(result.status, 'gas-cell-eos-producer-stage-ready');
  assert.equal(result.fullReadbackPerformed, false);
  assert.equal(result.normalHotLoopReadbackFree, true);
  assert.equal(result.queueCompletionStatus, 'queue-work-completed');
  assert.equal(result.queueCompletionMethod, 'queue.onSubmittedWorkDone');
  assert.equal(result.gasCellField.localPressureGradientReady, true);
  assert.equal(result.gasCellField.pressureFieldMode, 'local-gas-cell-pressure-gradient');
  assert.equal(result.pressureInterfaceGasPressureCellRowCount, 2);
  assert.equal(result.pressureInterfaceGasPressureCellRowStrideFloats, 12);
  assert.equal(result.pressureInterfaceGasPressureCellRowByteLength, 96);
  assert.equal(result.pressureInterfaceGasPressureCellRowsBufferRetained, true);
  assert.equal(result.gasPressureCellsBuffer.label, 'ulg-sph-gas-cell-eos-pressure-cells-out');
  assert.deepEqual(result.retainedGasPressureBufferRefs, ['resident-gas-pressure-cells-buffer']);
  assert.equal(result.retainedGasCellFieldSourceReady, true);
  assert.equal(result.retainedGasCellFieldSource.schema, 'peercompute.ulg.pressure-interface-retained-gas-cell-field-source.v0');
  assert.equal(result.retainedGasCellFieldSource.sourceTaskId, 'ulg:test:gas-cell-eos-producer-stage');
  assert.deepEqual(result.retainedGasCellFieldSource.retainedGasPressureBufferRefs, ['resident-gas-pressure-cells-buffer']);
  assert.equal(result.retainedGasCellFieldSource.pressureInterfaceGasPressureCellRowByteLength, 96);
  assert.equal(result.gpuFence.schema, 'peercompute.compute.gpu-fence-report.v0');
  assert.equal(result.gpuFence.required, true);
  assert.equal(result.gpuFence.fenceSatisfied, true);
  assert.equal(result.gasCellEosProducerStageTaskEvidence.schema, 'peercompute.ulg.gas-cell-eos-producer-stage-task-evidence.v0');
  assert.equal(result.gasCellEosProducerStageTaskEvidence.passed, true);
  assert.deepEqual(result.gasCellEosProducerStageTaskEvidence.candidateWriteFamilies, ['resident-gas-pressure']);
  assert.ok(result.gasCellEosProducerStageTaskEvidence.mustNotWriteFamilies.includes('pressure-interface-force-rows'));
  assert.equal(result.gasCellEosProducerStageTaskAuthority.status, 'compute-manager-owned-non-mutating-gas-cell-eos-producer-stage-task');
  assert.equal(result.gasCellEosProducerStageTaskAuthority.authoritativeStateMutation, false);
  assert.equal(result.gasCellEosProducerStageTaskAuthority.pressureInterfaceMutationApproved, false);

  result.destroyGasPressureCellsBuffer?.();
  assert.equal(result.gasPressureCellsBuffer.destroyed, true);
});

test('gas-cell EOS final-consumer retirement covers every pressure terminal exactly once', async () => {
  const cases = [
    [true, 'completed', 'gas-cell-eos-final-consumer-release-scheduled-after-pressure-submit'],
    [false, 'completed', 'gas-cell-eos-final-consumer-release-scheduled-after-pressure-nonconsuming-terminal'],
    [false, 'error', 'gas-cell-eos-final-consumer-release-scheduled-after-pressure-error'],
    [false, 'omitted', 'gas-cell-eos-final-consumer-release-scheduled-after-pressure-omitted'],
    [false, 'not-run', 'gas-cell-eos-final-consumer-release-scheduled-after-pressure-not-run'],
    [false, 'lane-aborted', 'gas-cell-eos-final-consumer-release-scheduled-after-lane-abort']
  ];
  for (const [retainedGasPressureRowsConsumed, pressureStageStatus, expectedStatus] of cases) {
    let calls = 0;
    let releaseScheduled = false;
    let released = false;
    let releasePromise = null;
    const owner = {
      releaseAfterFinalConsumerQueue() {
        assert.equal(this, owner);
        calls += 1;
        releaseScheduled = true;
        releasePromise = Promise.resolve().then(() => {
          released = true;
          return true;
        });
        return true;
      }
    };
    Object.defineProperties(owner, {
      releaseScheduled: { get: () => releaseScheduled },
      releasePromise: { get: () => releasePromise },
      released: { get: () => released }
    });
    const first = scheduleSphGasCellEosFinalConsumerRelease({
      gasCellEosProducerResult: owner,
      retainedGasPressureRowsConsumed,
      pressureStageStatus
    });
    assert.equal(first.scheduled, true, pressureStageStatus);
    assert.equal(first.status, expectedStatus, pressureStageStatus);
    assert.equal(first.source, 'gas-cell-eos-producer-result');
    assert.equal(calls, 1);
    assert.equal(await first.releasePromise, true);
    const repeated = scheduleSphGasCellEosFinalConsumerRelease({
      gasCellEosProducerResult: owner,
      retainedGasPressureRowsConsumed,
      pressureStageStatus
    });
    assert.equal(repeated.scheduled, true);
    assert.equal(repeated.alreadyScheduled, true);
    assert.equal(calls, 1);
  }
});

test('gas-cell EOS final-consumer retirement rejects unrelated imports and preserves callback failures', () => {
  let unrelatedCalls = 0;
  let gasCalls = 0;
  const producedBuffer = {};
  const gasResult = {
    gasPressureCellsBuffer: producedBuffer,
    releaseAfterFinalConsumerQueue() {
      gasCalls += 1;
      return true;
    }
  };
  const unrelatedImport = {
    gasPressureCellsBuffer: {},
    releaseAfterFinalConsumerQueue() {
      unrelatedCalls += 1;
      return true;
    }
  };
  const selected = scheduleSphGasCellEosFinalConsumerRelease({
    pressureInterfaceGasCellFieldImport: unrelatedImport,
    gasCellEosProducerResult: gasResult,
    pressureStageStatus: 'completed'
  });
  assert.equal(selected.source, 'gas-cell-eos-producer-result');
  assert.equal(selected.scheduled, true);
  assert.equal(unrelatedCalls, 0);
  assert.equal(gasCalls, 1);

  let rejectedCalls = 0;
  const rejectedOwner = {
    releaseAfterFinalConsumerQueue() {
      rejectedCalls += 1;
      return false;
    }
  };
  const rejected = scheduleSphGasCellEosFinalConsumerRelease({
    gasCellEosProducerResult: rejectedOwner,
    pressureStageStatus: 'error'
  });
  assert.equal(rejected.scheduled, false);
  assert.equal(rejected.status, 'gas-cell-eos-final-consumer-release-schedule-rejected');
  const rejectedAgain = scheduleSphGasCellEosFinalConsumerRelease({
    gasCellEosProducerResult: rejectedOwner,
    pressureStageStatus: 'error'
  });
  assert.equal(rejectedAgain.status, 'gas-cell-eos-final-consumer-release-already-invoked');
  assert.equal(rejectedCalls, 1);

  let thrownCalls = 0;
  const thrownOwner = {
    releaseAfterFinalConsumerQueue() {
      thrownCalls += 1;
      throw new Error('synthetic release failure');
    }
  };
  const thrown = scheduleSphGasCellEosFinalConsumerRelease({
    spatialGasLedgerProducerResult: thrownOwner,
    pressureStageStatus: 'lane-aborted'
  });
  assert.equal(thrown.scheduled, false);
  assert.equal(thrown.status, 'gas-cell-eos-final-consumer-release-schedule-error');
  assert.equal(thrown.error, 'synthetic release failure');
  scheduleSphGasCellEosFinalConsumerRelease({
    spatialGasLedgerProducerResult: thrownOwner,
    pressureStageStatus: 'lane-aborted'
  });
  assert.equal(thrownCalls, 1);

  const cpuOnly = scheduleSphGasCellEosFinalConsumerRelease({
    gasCellEosProducerResult: { backend: 'cpu-reference' },
    pressureStageStatus: 'completed'
  });
  assert.equal(cpuOnly.status, 'gas-cell-eos-final-consumer-release-not-applicable');
});

test('stage chain retires inline gas-cell owners when pressure is omitted or the lane aborts', async () => {
  const runCase = async ({ includePressureInterfaceStage, abortAfterGas }) => {
    const buffers = manualBuffers();
    let releaseCalls = 0;
    let laneContract = null;
    const gasResult = {
      computeTaskResultSchema: ULG_SPH_GAS_CELL_EOS_PRODUCER_STAGE_COMPUTE_TASK_RESULT_SCHEMA,
      gasCellEosProducerStageTask: true,
      gasCellEosProducerStageTaskEvidence: { passed: true },
      backend: 'webgpu',
      status: 'gas-cell-eos-producer-stage-ready',
      releaseAfterFinalConsumerQueue() {
        releaseCalls += 1;
        return true;
      }
    };
    const computeManager = {
      async submitTask(task) {
        if (task.exportName === 'runSphGasCellEosProducerStageComputeTask') {
          return gasResult;
        }
        const data = { ...task.data, preferWebGpu: false };
        if (task.exportName === 'runMlsMpmMechanicsP2gStageComputeTask') {
          return runMlsMpmMechanicsP2gStageComputeTask(data);
        }
        if (task.exportName === 'runMlsMpmMechanicsGridUpdateStageComputeTask') {
          return runMlsMpmMechanicsGridUpdateStageComputeTask(data);
        }
        if (task.exportName === 'runMlsMpmMechanicsG2pStageComputeTask') {
          return runMlsMpmMechanicsG2pStageComputeTask(data);
        }
        throw new Error(`unexpected task export ${task.exportName}`);
      },
      acquireGpuResidentLaneLease(spec) {
        laneContract = spec.residentSequenceLaneContract;
        return {
          leaseId: `${spec.laneId}:lease`,
          laneId: spec.laneId,
          stateKey: spec.stateKey,
          residentSequenceLaneContract: laneContract
        };
      },
      async executeGpuResidentLaneStagePlan(leaseId, options = {}) {
        const stageResults = [];
        let input = options.input || null;
        for (const stage of laneContract.passDagStages) {
          if (abortAfterGas && stage.id === 'pressureInterface') {
            throw new Error('synthetic lane abort after gas producer');
          }
          const stageResult = await options.stageExecutors[stage.id]({
            stage,
            input,
            leaseId,
            context: options.context || {}
          });
          stageResults.push({ stageId: stage.id, status: 'completed' });
          input = stageResult.value;
        }
        return {
          schema: 'peercompute.compute.gpu-resident-lane-stage-execution.v0',
          status: 'completed',
          completedStageCount: stageResults.length,
          stageResults,
          retainedBufferRefs: []
        };
      },
      completeGpuResidentLaneLease() {
        return {
          status: 'queue-work-completed',
          gpuFence: {
            schema: 'peercompute.compute.gpu-fence-report.v0',
            status: 'queue-work-completed',
            required: true,
            fenceSatisfied: true
          }
        };
      },
      rejectGpuResidentLaneLease() {
        return { status: 'rejected' };
      }
    };
    const step = await runMlsMpmMechanicsOnlyResidentStepWithComputeManagerStageTasks({
      ...buffers,
      computeManager,
      modulePath: './sphMlsMpmGpuStep.js',
      stageTaskIdPrefix: `ulg:test:gas-owner-${abortAfterGas ? 'abort' : 'omit'}`,
      useNativeTaskGraph: false,
      useGpuHubResidentStageExecutors: false,
      includeGasCellEosProducerStage: true,
      includePressureInterfaceStage,
      preferWebGpu: false,
      readbackMode: 'full-parity-readback'
    });
    return { step, releaseCalls };
  };

  const omitted = await runCase({
    includePressureInterfaceStage: false,
    abortAfterGas: false
  });
  assert.equal(omitted.releaseCalls, 1);
  assert.equal(
    omitted.step.mechanicsStageTaskChain.gasCellEosProducerFinalConsumerReleaseStatus,
    'gas-cell-eos-final-consumer-release-scheduled-after-pressure-omitted'
  );

  const aborted = await runCase({
    includePressureInterfaceStage: true,
    abortAfterGas: true
  });
  assert.equal(aborted.releaseCalls, 1);
  assert.equal(
    aborted.step.mechanicsStageTaskChain.gasCellEosProducerFinalConsumerReleaseStatus,
    'gas-cell-eos-final-consumer-release-scheduled-after-lane-abort'
  );
});

test('SPH retained gas-cell EOS handoff forwards canonical release and exact v1 import identity', async () => {
  const gasPressureCellsBuffer = {
    label: 'retained-v1-gas-pressure-cells',
    destroyed: false,
    destroy() {
      this.destroyed = true;
    }
  };
  const epochIdentity = Object.freeze({
    storageGeneration: 41,
    physicsTick: 40,
    physicsSubstep: 2,
    positionEpoch: 101,
    topologyEpoch: 17,
    chartEpoch: 9,
    levelEpoch: 102,
    supportEpoch: 103
  });
  let releaseCalls = 0;
  const releaseAfterFinalConsumerQueue = async () => {
    releaseCalls += 1;
    gasPressureCellsBuffer.destroy();
    return true;
  };
  const retainedSpatialGasLedgerSource = {
    schema: 'peercompute.ulg.sph-retained-spatial-gas-ledger-source.v1',
    status: 'retained-spatial-gas-ledger-source-submitted',
    ready: true,
    deviceId: 'ulg-webgpu-device:test-v1-eos',
    spatialEpochGenerationId: 73,
    epochIdentity
  };
  const retainedGasCellFieldSource = {
    schema: 'peercompute.ulg.sph-retained-gas-cell-eos-source.v1',
    status: 'retained-gas-cell-eos-source-submitted',
    ready: true,
    deviceId: 'ulg-webgpu-device:test-v1-eos',
    gasPressureCellsBuffer,
    retainedGasPressureCellsBuffer: gasPressureCellsBuffer,
    pressureInterfaceGasPressureCellsBuffer: gasPressureCellsBuffer,
    pressureInterfaceGasPressureCellRowCount: 2,
    pressureInterfaceGasPressureCellRowStrideFloats: 12,
    pressureInterfaceGasPressureCellRowByteLength: 96,
    pressureInterfaceGasPressureCellRowsBufferRetained: true,
    sourceSpatialGasLedgerGenerationId: 73,
    sourceSpatialGasLedger: retainedSpatialGasLedgerSource,
    localPressureGradientReady: true,
    localPressureGradientStatus: 'gpu-sealed-local-pressure-gradient-field-submitted',
    pressureFieldMode: 'local-gas-cell-pressure-gradient',
    pressureFieldResolution: 'schroeder-spatial-directory-cells',
    releaseAfterFinalConsumerQueue
  };
  const retainedExecution = {
    ready: true,
    deviceId: 'ulg-webgpu-device:test-v1-eos',
    spatialGenerationId: 73,
    queueCompletionStatus: 'queue-submitted-no-host-wait',
    queueCompletionMethod: 'same-device-queue-order',
    retainedSpatialGasLedgerSource,
    retainedGasCellFieldSource,
    releaseAfterFinalConsumerQueue,
    mapAsyncCount: 0,
    hostMaterializedRowCount: 0,
    queueCompletionFenceWaited: false
  };
  const task = createSphGasCellEosProducerStageComputeTask({
    modulePath: './sphMlsMpmGpuStep.js',
    taskId: 'ulg:test:retained-v1-gas-cell-eos',
    laneId: 'ulg:test:retained-v1-gas-cell-eos-lane',
    stateKey: 'ulg:test:retained-v1-gas-cell-eos-state',
    preferWebGpu: true,
    readbackMode: 'no-full-readback',
    spatialGasLedgerProducerResult: {
      stateKey: 'ulg:test:producer-fallback-state',
      spatialGenerationId: 73,
      retainedSpatialGasLedgerSourceReady: true,
      retainedSpatialGasLedgerSource,
      retainedGasCellFieldSourceReady: true,
      retainedGasCellFieldSource,
      spatialGasLedgerEosExecution: retainedExecution,
      gasPressureCellsBuffer,
      retainedGasPressureCellsBuffer: gasPressureCellsBuffer,
      pressureInterfaceGasPressureCellRowCount: 2,
      pressureInterfaceGasPressureCellRowStrideFloats: 12,
      pressureInterfaceGasPressureCellRowByteLength: 96
    }
  });

  const result = await runSphGasCellEosProducerStageComputeTask(task.data);

  assert.equal(result.status, 'gas-cell-eos-producer-stage-ready');
  assert.equal(result.releaseAfterFinalConsumerQueue, releaseAfterFinalConsumerQueue);
  assert.equal(result.destroyGasPressureCellsBuffer, releaseAfterFinalConsumerQueue);
  assert.equal(result.stateKey, 'ulg:test:retained-v1-gas-cell-eos-state');
  assert.equal(result.sourceTaskId, 'ulg:test:retained-v1-gas-cell-eos');
  assert.equal(result.deviceId, 'ulg-webgpu-device:test-v1-eos');
  assert.equal(result.spatialGenerationId, 73);
  assert.equal(result.sourceSpatialGasLedgerGenerationId, 73);
  assert.equal(result.epochIdentity, epochIdentity);
  assert.equal(result.retainedGasCellFieldSource.stateKey, result.stateKey);
  assert.equal(result.retainedGasCellFieldSource.sourceTaskId, result.sourceTaskId);
  assert.equal(
    result.retainedGasCellFieldSource.sourceSpatialGasLedgerGenerationId,
    result.sourceSpatialGasLedgerGenerationId
  );
  assert.equal(
    result.retainedGasCellFieldSource.sourceSpatialGasLedger.epochIdentity,
    result.epochIdentity
  );
  await result.releaseAfterFinalConsumerQueue();
  assert.equal(releaseCalls, 1);
  assert.equal(gasPressureCellsBuffer.destroyed, true);
});

test('SPH retained spatial-gas EOS result exposes one canonical final-consumer release identity', async () => {
  const device = fakeSummaryDevice(new Float32Array(0));
  const residentProductMass = tagResidentProductMassDevice(residentProductMassHandle({
    label: 'retained-spatial-v1-product-events',
    rowCount: 2,
    byteLength: 2 * 32 * Float32Array.BYTES_PER_ELEMENT
  }), device);
  const epochIdentity = {
    storageGeneration: 51,
    physicsTick: 50,
    physicsSubstep: 3,
    positionEpoch: 201,
    topologyEpoch: 18,
    chartEpoch: 10,
    levelEpoch: 202,
    supportEpoch: 203
  };
  const task = createSphSpatialGasLedgerProducerStageComputeTask({
    modulePath: './sphMlsMpmGpuStep.js',
    taskId: 'ulg:test:retained-spatial-v1-eos',
    laneId: 'ulg:test:retained-spatial-v1-eos-lane',
    stateKey: 'ulg:test:retained-spatial-v1-eos-state',
    preferWebGpu: true,
    readbackMode: 'no-full-readback',
    residentProductMass,
    spatialGasEpochIdentity: epochIdentity,
    boxDimsM: [2, 2, 2],
    device
  });

  const result = await runSphSpatialGasLedgerProducerStageComputeTask(task.data);

  assert.equal(result.status, 'spatial-gas-ledger-producer-stage-ready');
  assert.equal(result.retainedSpatialGasLedgerSourceReady, true);
  assert.equal(result.retainedGasCellFieldSourceReady, true);
  assert.equal(
    result.releaseAfterFinalConsumerQueue,
    result.spatialGasLedgerEosExecution.releaseAfterFinalConsumerQueue
  );
  assert.equal(result.destroySpatialGasLedgerRowsBuffer, result.releaseAfterFinalConsumerQueue);
  assert.equal(result.destroyGasPressureCellsBuffer, result.releaseAfterFinalConsumerQueue);
  assert.equal(result.stateKey, 'ulg:test:retained-spatial-v1-eos-state');
  assert.equal(result.sourceTaskId, 'ulg:test:retained-spatial-v1-eos');
  assert.equal(result.deviceId, result.retainedGasCellFieldSource.deviceId);
  assert.equal(result.spatialGenerationId, result.retainedSpatialGasLedgerSource.spatialEpochGenerationId);
  assert.equal(
    result.sourceSpatialGasLedgerGenerationId,
    result.retainedGasCellFieldSource.sourceSpatialGasLedgerGenerationId
  );
  assert.deepEqual(result.epochIdentity, epochIdentity);
  const eosTask = createSphGasCellEosProducerStageComputeTask({
    modulePath: './sphMlsMpmGpuStep.js',
    taskId: 'ulg:test:retained-spatial-v2-eos-forward',
    laneId: 'ulg:test:retained-spatial-v2-eos-forward-lane',
    stateKey: 'ulg:test:retained-spatial-v2-eos-forward-state',
    preferWebGpu: true,
    readbackMode: 'no-full-readback',
    spatialGasLedgerProducerResult: result
  });
  const eosResult = await runSphGasCellEosProducerStageComputeTask(
    eosTask.data
  );
  assert.equal(
    eosResult.retainedGasCellFieldSource,
    result.retainedGasCellFieldSource
  );
  assert.equal(
    isExactSphSpatialGasPressureAuthoritySource(
      eosResult.retainedGasCellFieldSource
    ),
    true
  );
  assert.equal(eosResult.gasPressureCellRowCount, 0);
  assert.equal(
    eosResult.gasPressureCellRowCapacity,
    result.retainedGasCellFieldSource.gasPressureCellRowCapacity
  );
  assert.equal(eosResult.gasPressureCellLogicalCountGpuAuthored, true);
  assert.equal(eosResult.releaseAfterFinalConsumerQueue(), true);
  await result.spatialGasLedgerEosExecution.releasePromise;
  assert.equal(result.spatialGasLedgerEosExecution.released, true);
});

test('SPH spatial gas ledger producer stage derives compact ledger from retained product-event rows', async () => {
  const compactRows = compactSpatialGasRowsFixture();
  const device = fakeSummaryDevice(compactRows);
  const residentProductMass = residentProductMassHandle({
    label: 'resident-product-events',
    rowCount: 2,
    byteLength: 2 * 32 * Float32Array.BYTES_PER_ELEMENT
  });
  const reactionTable = {
    schema: 'peercompute.ulg.sph-gpu-reaction-table.v1',
    productTermMetadata: [
      { productTermIndex: 0, material: 'h2', routing: 'gas' }
    ]
  };
  const task = createSphSpatialGasLedgerProducerStageComputeTask({
    modulePath: './sphMlsMpmGpuStep.js',
    taskId: 'ulg:test:spatial-gas-ledger-producer-stage',
    laneId: 'ulg:test:spatial-gas-ledger-lane',
    stateKey: 'ulg:test:spatial-gas-ledger-state',
    domainKey: 'ulg:test-domain',
    preferWebGpu: true,
    readbackMode: 'full-parity-readback',
    residentProductMass,
    reactionTable,
    boxDimsM: [2, 2, 2],
    device
  });

  assert.equal(task.schema, ULG_SPH_SPATIAL_GAS_LEDGER_PRODUCER_STAGE_COMPUTE_TASK_SCHEMA);
  assert.equal(task.exportName, 'runSphSpatialGasLedgerProducerStageComputeTask');
  assert.equal(task.residency, 'gpu-lane');
  assert.equal(task.suppressCommitDelta, true);
  assert.deepEqual(task.readFamilies, ['resident-product-mass', 'reaction-closure-table']);
  assert.deepEqual(task.writeFamilies, ['resident-spatial-gas-species-ledger']);
  assert.deepEqual(task.webgpu.retainedBufferRefs, ['resident-spatial-gas-species-ledger-buffer']);
  assert.equal(task.gpuFence.required, true);
  assert.equal(task.gpuResidentLane.owner, 'ulg-resident-spatial-gas-ledger-law');

  const result = await runSphSpatialGasLedgerProducerStageComputeTask(task.data);

  assert.equal(result.computeTaskResultSchema, ULG_SPH_SPATIAL_GAS_LEDGER_PRODUCER_STAGE_COMPUTE_TASK_RESULT_SCHEMA);
  assert.equal(result.computeTaskSchema, ULG_SPH_SPATIAL_GAS_LEDGER_PRODUCER_STAGE_COMPUTE_TASK_SCHEMA);
  assert.equal(result.computeTaskId, 'ulg:test:spatial-gas-ledger-producer-stage');
  assert.equal(result.backend, 'webgpu');
  assert.equal(result.status, 'spatial-gas-ledger-producer-stage-ready');
  assert.equal(result.fullProductEventReadbackPerformed, false);
  assert.equal(result.compactSpatialGasReadbackPerformed, true);
  assert.equal(result.compactSpatialGasReadbackByteLength, 96);
  assert.equal(result.compactSpatialGasRowCount, 2);
  assert.equal(result.spatialGasSpeciesLedger.schema, ULG_SPH_SPATIAL_GAS_SPECIES_LEDGER_SCHEMA);
  assert.equal(result.spatialGasSpeciesLedger.status, 'spatial-gas-species-ledger-ready');
  assert.equal(result.spatialGasSpeciesLedger.cellCount, 2);
  assert.equal(result.aggregateSpatialGasLedgerFallbackUsed, false);
  assert.equal(result.spatialGasLedgerDerivation, 'positioned-product-event-rows');
  assert.equal(result.spatialGasPositionSource, 'resident-product-event-row-positions');
  assert.equal(result.spatialGasSpeciesLedger.cells[0].bySpecies.h2.moles, 100);
  assert.equal(result.spatialGasSpeciesLedger.cells[1].bySpecies.h2.moles, 200);
  assert.deepEqual(result.retainedSpatialGasSourceBufferRefs, ['resident-product-mass-buffer']);
  assert.deepEqual(result.retainedSpatialGasLedgerBufferRefs, ['resident-spatial-gas-species-ledger-buffer']);
  assert.equal(result.retainedSpatialGasLedgerSourceReady, true);
  assert.equal(result.retainedSpatialGasLedgerSource.schema, ULG_SPH_RETAINED_SPATIAL_GAS_LEDGER_SOURCE_SCHEMA);
  assert.equal(result.retainedSpatialGasLedgerSource.sourceTaskId, 'ulg:test:spatial-gas-ledger-producer-stage');
  assert.equal(result.gpuFence.schema, 'peercompute.compute.gpu-fence-report.v0');
  assert.equal(result.gpuFence.required, true);
  assert.equal(result.gpuFence.fenceSatisfied, true);
  assert.equal(result.spatialGasLedgerProducerStageTaskEvidence.schema, 'peercompute.ulg.spatial-gas-ledger-producer-stage-task-evidence.v0');
  assert.equal(result.spatialGasLedgerProducerStageTaskEvidence.passed, true);
  assert.deepEqual(result.spatialGasLedgerProducerStageTaskEvidence.candidateWriteFamilies, ['resident-spatial-gas-species-ledger']);
  assert.ok(
    result.spatialGasLedgerProducerStageTaskEvidence
      .mustNotWriteFamilies.includes('pressure-interface-force-rows')
  );
  assert.equal(result.spatialGasLedgerProducerStageTaskAuthority.status, 'compute-manager-owned-non-mutating-spatial-gas-ledger-producer-stage-task');
  assert.equal(result.spatialGasLedgerProducerStageTaskAuthority.authoritativeStateMutation, false);

  result.destroySpatialGasLedgerRowsBuffer?.();
  assert.equal(result.spatialGasLedgerRowsBuffer.destroyed, true);
});

test('SPH spatial gas ledger producer blocks cross-device retained product-event buffers before binding', async () => {
  const sourceDevice = fakeSummaryDevice(compactSpatialGasRowsFixture());
  const consumerDevice = fakeSummaryDevice(compactSpatialGasRowsFixture());
  const residentProductMass = tagResidentProductMassDevice(residentProductMassHandle({
    label: 'cross-device-product-events',
    rowCount: 2,
    byteLength: 2 * 32 * Float32Array.BYTES_PER_ELEMENT,
    gasSpeciesRows: [
      { material: 'h2', materialId: 1, massKg: 0.002016, moles: 1, unplacedMassKg: 0.002016 }
    ]
  }), sourceDevice);

  const result = await runSphSpatialGasLedgerProducerStageComputeTask({
    preferWebGpu: true,
    readbackMode: 'no-full-readback',
    residentProductMass,
    reactionTable: {
      schema: 'peercompute.ulg.sph-gpu-reaction-table.v1',
      productTermMetadata: [
        { productTermIndex: 0, material: 'h2', routing: 'gas' }
      ]
    },
    boxDimsM: [2, 2, 2],
    device: consumerDevice
  });

  assert.equal(result.backend, 'webgpu');
  assert.equal(result.status, 'spatial-gas-ledger-eos-rejected-cross-device-source');
  assert.equal(result.executionSource, 'retained-same-device-spatial-gas-ledger-eos-gpu');
  assert.equal(result.webgpuStatus.status, 'webgpu-retained-spatial-gas-ledger-eos-rejected');
  assert.equal(result.productEventBufferDeviceMismatch, true);
  assert.equal(result.failClosed, true);
  assert.equal(result.compactSpatialGasReadbackPerformed, false);
  assert.equal(result.fullProductEventReadbackPerformed, false);
  assert.equal(consumerDevice.bindGroups.length, 0);
  assert.equal(consumerDevice.dispatches.length, 0);
  assert.equal(result.spatialGasSpeciesLedger, null);
});

test('SPH spatial gas ledger producer pins resident product events before device acquisition awaits', async () => {
  const device = fakeSummaryDevice(compactSpatialGasRowsFixture());
  const residentProductMass = residentProductMassHandle({
    label: 'device-acquisition-borrowed-product-events',
    rowCount: 2,
    byteLength: 2 * 32 * Float32Array.BYTES_PER_ELEMENT
  });
  let resolveAdapter;
  const adapterPromise = new Promise((resolve) => { resolveAdapter = resolve; });
  const executionPromise = runSphSpatialGasLedgerProducerStageComputeTask({
    preferWebGpu: true,
    readbackMode: 'no-full-readback',
    residentProductMass,
    boxDimsM: [2, 2, 2],
    navigatorRef: {
      gpu: {
        requestAdapter() {
          return adapterPromise;
        }
      }
    }
  });

  await Promise.resolve();
  assert.equal(residentProductMass.__ulgActiveBorrowCount, 1);
  assert.equal(residentProductMass.productEventBuffer.destroyed, false);

  resolveAdapter({
    limits: {},
    async requestDevice() {
      return device;
    }
  });
  const result = await executionPromise;

  assert.equal(result.backend, 'webgpu');
  assert.equal(residentProductMass.__ulgActiveBorrowCount, 0);
  assert.equal(residentProductMass.productEventBuffer.destroyed, false);
  result.destroySpatialGasLedgerRowsBuffer?.();
});

test('SPH spatial gas ledger producer blocks globally tagged cross-device product-event buffers', async () => {
  const sourceDevice = fakeSummaryDevice(compactSpatialGasRowsFixture());
  const consumerDevice = fakeSummaryDevice(compactSpatialGasRowsFixture());
  const residentProductMass = residentProductMassHandle({
    label: 'globally-tagged-product-events',
    rowCount: 2,
    byteLength: 2 * 32 * Float32Array.BYTES_PER_ELEMENT,
    gasSpeciesRows: [
      { material: 'h2', materialId: 1, massKg: 0.002016, moles: 1, unplacedMassKg: 0.002016 }
    ]
  });
  Object.defineProperty(residentProductMass, Symbol.for('peercompute.ulg.webgpu.device'), {
    value: sourceDevice,
    configurable: true
  });
  Object.defineProperty(residentProductMass.productEventBuffer, Symbol.for('peercompute.ulg.webgpu.device'), {
    value: sourceDevice,
    configurable: true
  });

  const result = await runSphSpatialGasLedgerProducerStageComputeTask({
    preferWebGpu: true,
    readbackMode: 'no-full-readback',
    residentProductMass,
    reactionTable: {
      schema: 'peercompute.ulg.sph-gpu-reaction-table.v1',
      productTermMetadata: [
        { productTermIndex: 0, material: 'h2', routing: 'gas' }
      ]
    },
    boxDimsM: [2, 2, 2],
    device: consumerDevice
  });

  assert.equal(result.status, 'spatial-gas-ledger-eos-rejected-cross-device-source');
  assert.equal(result.webgpuStatus.status, 'webgpu-retained-spatial-gas-ledger-eos-rejected');
  assert.equal(result.productEventBufferDeviceMismatch, true);
  assert.equal(result.productEventBufferSourceDeviceId.startsWith('ulg-webgpu-device:'), true);
  assert.equal(result.productEventBufferConsumerDeviceId.startsWith('ulg-webgpu-device:'), true);
  assert.notEqual(result.productEventBufferSourceDeviceId, result.productEventBufferConsumerDeviceId);
  assert.equal(consumerDevice.bindGroups.length, 0);
  assert.equal(consumerDevice.dispatches.length, 0);
});

test('SPH spatial gas ledger producer derives positioned gas rows when product support volume is missing', async () => {
  const productEventRows = productEventRowsFixture();
  const result = await runSphSpatialGasLedgerProducerStageComputeTask({
    preferWebGpu: false,
    readbackMode: 'no-full-readback',
    productEventRows,
    productEventRowCount: 2,
    productEventStrideFloats: 32,
    boxDimsM: [4, 4, 4],
    reactionTable: {
      schema: 'peercompute.ulg.sph-gpu-reaction-table.v1',
      productTermMetadata: [
        { productTermIndex: 0, material: 'h2', routing: 'gas' }
      ]
    },
    residentProductMass: {
      schema: 'peercompute.ulg.sph-resident-product-mass.v0',
      status: 'resident-product-mass-buffer-retained',
      productEventBufferRetained: true,
      productEventRowCount: 2,
      productEventStrideFloats: 32,
      gasSpeciesLedger: {
        schema: ULG_SPH_GPU_REACTION_GAS_SPECIES_SUMMARY_SCHEMA,
        status: 'gas-species-resident-ledger-ready',
        records: [{
          material: 'h2',
          materialId: 3022823,
          massKg: 0.03,
          moles: 15,
          temperatureK: 293.15,
          eventCount: 2,
          status: 'ready'
        }]
      }
    }
  });

  assert.equal(result.status, 'spatial-gas-ledger-producer-stage-ready');
  assert.equal(result.backend, 'cpu-reference');
  assert.equal(result.aggregateSpatialGasLedgerFallbackUsed, false);
  assert.equal(result.executionSource, 'cpu-product-event-compact-spatial-gas-ledger');
  assert.equal(result.spatialGasLedgerDerivation, 'positioned-product-event-rows');
  assert.equal(result.spatialGasPositionSource, 'resident-product-event-row-positions');
  assert.equal(result.spatialGasSupportVolumeFallbackM3, 32);
  assert.equal(result.spatialGasSpeciesLedger.spatialGasSupportVolumeSource, 'product-event-row-support-volume-or-derived-gas-ledger-share');
  assert.equal(result.spatialGasSpeciesLedger.sourceEventRowCount, 2);
  assert.equal(result.spatialGasSpeciesLedger.cellCount, 2);
  assert.deepEqual(result.spatialGasSpeciesLedger.cellDims, [2, 2, 2]);
  assert.equal(result.spatialGasSpeciesLedger.cells[0].bySpecies.h2.moles, 5);
  assert.equal(result.spatialGasSpeciesLedger.cells[1].bySpecies.h2.moles, 10);
  assert.equal(result.compactSpatialGasRows[7], 32);
  assert.equal(result.compactSpatialGasRows[SPH_SPATIAL_GAS_LEDGER_COMPACT_ROW_FLOATS + 7], 32);
});

test('SPH spatial gas ledger producer stage falls back to aggregate gas ledger when retained event rows are positionless', async () => {
  const compactRows = new Float32Array(2 * SPH_SPATIAL_GAS_LEDGER_COMPACT_ROW_FLOATS);
  const result = await runSphSpatialGasLedgerProducerStageComputeTask({
    preferWebGpu: false,
    readbackMode: 'no-full-readback',
    productEventCompactRows: compactRows,
    productEventRowCount: 2,
    productEventStrideFloats: 32,
    boxDimsM: [4, 4, 4],
    residentProductMass: {
      schema: 'peercompute.ulg.sph-resident-product-mass.v0',
      status: 'resident-product-mass-buffer-retained',
      productEventBufferRetained: true,
      productEventRowCount: 2,
      productEventStrideFloats: 32,
      gasSpeciesLedger: {
        schema: ULG_SPH_GPU_REACTION_GAS_SPECIES_SUMMARY_SCHEMA,
        status: 'gas-species-resident-ledger-ready',
        records: [{
          material: 'h2',
          materialId: 3022823,
          massKg: 0.02,
          moles: 10,
          temperatureK: 293.15,
          eventCount: 4,
          status: 'ready'
        }]
      }
    },
    gasPressureSummary: {
      schema: 'peercompute.ulg.sph-sealed-gas-pressure-summary.v0',
      status: 'gpu-resident-reaction-pressure-summary',
      boxDimsM: [4, 4, 4]
    }
  });

  assert.equal(result.status, 'spatial-gas-ledger-producer-stage-ready');
  assert.equal(result.aggregateSpatialGasLedgerFallbackUsed, true);
  assert.equal(result.executionSource, 'aggregate-gas-ledger-single-cell-spatial-fallback');
  assert.equal(result.fullProductEventReadbackPerformed, false);
  assert.equal(result.compactSpatialGasRowCount, 2);
  assert.equal(result.spatialGasLedgerDerivation, 'aggregate-gas-ledger-single-cell-sealed-box');
  assert.equal(result.spatialGasPositionSource, 'aggregate-gas-ledger-no-positioned-product-events');
  assert.equal(result.spatialGasSpeciesLedger.status, 'spatial-gas-species-ledger-ready');
  assert.equal(result.spatialGasSpeciesLedger.cellCount, 1);
  assert.deepEqual(result.spatialGasSpeciesLedger.cellDims, [1, 1, 1]);
  assert.deepEqual(result.spatialGasSpeciesLedger.cells[0].centerM, [2, 2, 2]);
  assert.equal(result.spatialGasSpeciesLedger.cells[0].volumeM3, 64);
  assert.equal(result.spatialGasSpeciesLedger.cells[0].bySpecies.h2.moles, 10);
  assert.equal(result.retainedSpatialGasLedgerSourceReady, false);
});

test('ComputeManager stage chain runs gas-cell EOS producer before pressureInterface import consumption', async () => {
  const buffers = manualBuffers({
    position: [1, 1, 1],
    velocity: [0, 0, 0],
    massKg: 8,
    restDensityKgPerM3: 8,
    mechanicsDtS: 1 / 60
  });
  const pressureFor = (pressurePa) => (pressurePa * 4) / (8.31446261815324 * 300);
  const compactRows = compactSpatialGasRowsFixture([
    {
      positionM: [0.5, 1, 1],
      materialId: 7,
      massKg: 0.04,
      moles: pressureFor(120000),
      temperatureK: 300,
      supportVolumeM3: 4,
      productTermIndex: 0,
      sourceRowIndex: 0
    },
    {
      positionM: [1.5, 1, 1],
      materialId: 7,
      massKg: 0.06,
      moles: pressureFor(180000),
      temperatureK: 300,
      supportVolumeM3: 4,
      productTermIndex: 0,
      sourceRowIndex: 1
    }
  ]);
  const device = fakeSummaryDevice(compactRows);
  const residentProductMass = residentProductMassHandle({
    label: 'resident-product-events-for-spatial-ledger',
    rowCount: 2,
    byteLength: 2 * 32 * Float32Array.BYTES_PER_ELEMENT
  });
  tagResidentProductMassDevice(residentProductMass, device);
  const reactionTable = {
    schema: 'peercompute.ulg.sph-gpu-reaction-table.v1',
    productTermMetadata: [
      { productTermIndex: 0, material: 'h2', routing: 'gas' }
    ]
  };
  const materialInterfaceField = {
    schema: 'peercompute.ulg.sph-material-interface-field.v0',
    status: 'material-interface-field-ready',
    surfaceCount: 1,
    readySurfaceCount: 1,
    totalSurfaceAreaM2: 2,
    elementCount: 2,
    elements: [
      {
        status: 'interface-element-ready',
        surfaceIndex: 0,
        surfaceKey: 'h2o|liquid',
        material: 'h2o',
        phase: 'liquid',
        materialId: 1,
        phaseId: 2,
        axisId: 0,
        centroidM: [0.5, 1, 1],
        areaM2: 1,
        normalAreaVectorM2: [1, 0, 0],
        gapM: 0.2,
        normalVelocityMPerS: 0,
        representativeMassKg: 0
      },
      {
        status: 'interface-element-ready',
        surfaceIndex: 0,
        surfaceKey: 'h2o|liquid',
        material: 'h2o',
        phase: 'liquid',
        materialId: 1,
        phaseId: 2,
        axisId: 0,
        centroidM: [1.5, 1, 1],
        areaM2: 1,
        normalAreaVectorM2: [-1, 0, 0],
        gapM: 0.2,
        normalVelocityMPerS: 0,
        representativeMassKg: 0
      }
    ]
  };
  const admissionCalls = [];
  const importCalls = [];
  const finalConsumerEvents = [];
  let finalConsumerReleaseCalls = 0;
  let pressureConsumedGasCellsBuffer = null;
  let submittedPressureResult = null;
  let submittedSpatialGasResult = null;
  let submittedGasEosResult = null;
  const residentAuthorityHost = {
    publishPressureInterfaceGasCellFieldAdmission(options) {
      admissionCalls.push(options);
      return {
        schema: 'peercompute.ulg.pressure-interface-gas-cell-field-admission-hot-buffer-publication.v0',
        status: 'pressure-interface-gas-cell-field-admission-published',
        committed: true,
        hotBufferKey: 'ulg:test:gas-eos-stage-chain-admission-hot-buffer',
        pressureInterfaceGasCellFieldAdmission: {
          schema: ULG_PRESSURE_INTERFACE_GAS_CELL_FIELD_ADMISSION_SCHEMA,
          status: 'pressure-interface-gas-cell-field-consumption-approved',
          gasCellFieldConsumptionApproved: true,
          sourceHotBufferKey: 'ulg:test:gas-eos-stage-chain-admission-hot-buffer',
          retainedGasCellFieldSource: options.source.retainedGasCellFieldSource,
          retainedGasPressureBufferRefs: options.retainedGasPressureBufferRefs,
          workerRetainedGasPressureBufferRefs: options.workerRetainedGasPressureBufferRefs
        }
      };
    },
    publishPressureInterfaceGasCellFieldImportSource(options) {
      importCalls.push(options);
      const retainedGasCellFieldSource = options.source.retainedGasCellFieldSource;
      const sourceReleaseAfterFinalConsumerQueue =
        options.source.releaseAfterFinalConsumerQueue;
      return {
        schema: 'peercompute.ulg.pressure-interface-gas-cell-field-import-hot-buffer-publication.v0',
        status: 'pressure-interface-gas-cell-field-import-published',
        committed: true,
        hotBufferKey: 'ulg:test:gas-eos-stage-chain-import-hot-buffer',
        pressureInterfaceGasCellFieldImport: {
          schema: ULG_PRESSURE_INTERFACE_GAS_CELL_FIELD_IMPORT_SCHEMA,
          status: 'pressure-interface-gas-cell-field-import-ready',
          sourceHotBufferKey: 'ulg:test:gas-eos-stage-chain-import-hot-buffer',
          retainedGasCellFieldSource: options.source.retainedGasCellFieldSource,
          retainedGasPressureBufferRefs: options.retainedGasPressureBufferRefs,
          workerRetainedGasPressureBufferRefs: options.workerRetainedGasPressureBufferRefs,
          pressureInterfaceGasPressureCellRowCount: options.source.pressureInterfaceGasPressureCellRowCount,
          pressureInterfaceGasPressureCellRowStrideFloats: options.source.pressureInterfaceGasPressureCellRowStrideFloats,
          pressureInterfaceGasPressureCellRowByteLength: options.source.pressureInterfaceGasPressureCellRowByteLength,
          pressureInterfaceGasCellFieldAdmission: options.pressureInterfaceGasCellFieldAdmission,
          gasCellFieldSnapshot: options.gasCellFieldSnapshot,
          gasPressureCellsBuffer: options.source.gasPressureCellsBuffer,
          retainedGasPressureCellsBuffer: options.source.gasPressureCellsBuffer,
          pressureInterfaceGasPressureCellsBuffer: options.source.gasPressureCellsBuffer,
          pressureInterfaceGasPressureCellRowsBufferRetained: true,
          sameDevice: true,
          deviceId: retainedGasCellFieldSource.deviceId,
          stateKey: retainedGasCellFieldSource.stateKey,
          sourceTaskId: retainedGasCellFieldSource.sourceTaskId,
          spatialGeneration: retainedGasCellFieldSource.spatialGeneration,
          spatialEpoch: retainedGasCellFieldSource.spatialEpoch,
          spatialEpochPositionEpoch:
            retainedGasCellFieldSource.spatialEpochPositionEpoch,
          spatialEpochTopologyEpoch:
            retainedGasCellFieldSource.spatialEpochTopologyEpoch,
          spatialEpochChartEpoch:
            retainedGasCellFieldSource.spatialEpochChartEpoch,
          spatialEpochLevelEpoch:
            retainedGasCellFieldSource.spatialEpochLevelEpoch,
          spatialEpochSupportEpoch:
            retainedGasCellFieldSource.spatialEpochSupportEpoch,
          lifecycleStatus: 'retained-gas-cell-final-consumer-available',
          releaseScheduled: false,
          released: false,
          spatialGasLedgerEosExecution:
            options.source.spatialGasLedgerEosExecution,
          releaseAfterFinalConsumerQueue() {
            finalConsumerEvents.push('final-consumer-release-scheduled');
            finalConsumerReleaseCalls += 1;
            return sourceReleaseAfterFinalConsumerQueue();
          }
        }
      };
    }
  };
  const leases = new Map();
  const computeManager = {
    submitTask(task) {
      const data = { ...task.data };
      if (task.exportName === 'runSphSpatialGasLedgerProducerStageComputeTask') {
        return runSphSpatialGasLedgerProducerStageComputeTask({
          ...data,
          preferWebGpu: true,
          device
        }).then((result) => {
          submittedSpatialGasResult = result;
          return result;
        });
      }
      if (task.exportName === 'runSphGasCellEosProducerStageComputeTask') {
        return runSphGasCellEosProducerStageComputeTask({
          ...data,
          preferWebGpu: true,
          device
        }).then((result) => {
          submittedGasEosResult = result;
          return result;
        });
      }
      if (task.exportName === 'runSphPressureInterfaceStageComputeTask') {
        return runSphPressureInterfaceStageComputeTask({
          ...data,
          preferWebGpu: true,
          device,
          pressureInterfaceForceRowsWebGpuRunner: async ({
            retainedGasPressureCellsBuffer,
            retainedGasPressureCellImport
          }) => {
            finalConsumerEvents.push('pressure-consumer-submitted');
            pressureConsumedGasCellsBuffer = retainedGasPressureCellsBuffer;
            assert.equal(
              retainedGasPressureCellsBuffer,
              importCalls[0].source.gasPressureCellsBuffer
            );
            assert.equal(retainedGasPressureCellImport.sameDevice, true);
            assert.equal(
              retainedGasPressureCellImport.deviceId,
              webGpuDeviceId(device)
            );
            assert.equal(
              retainedGasPressureCellImport.lifecycleStatus,
              'retained-gas-cell-final-consumer-available'
            );
            assert.equal(retainedGasPressureCellImport.releaseScheduled, false);
            assert.equal(
              typeof retainedGasPressureCellImport.releaseAfterFinalConsumerQueue,
              'function'
            );
            const forceRowsBuffer = {
              label: 'pressure-interface-final-consumer-test-force-rows',
              size: 16 * Float32Array.BYTES_PER_ELEMENT
            };
            return {
              backend: 'webgpu',
              status: 'pressure-interface-stage-solver-ready',
              readbackMode: 'no-full-readback',
              fullReadbackPerformed: false,
              normalHotLoopReadbackFree: true,
              queueCompletionStatus: 'queue-work-completed',
              retainedGasPressureRowsStatus:
                'retained-gas-pressure-rows-admitted-same-device',
              forceRowCount: 1,
              forceRowByteLength: forceRowsBuffer.size,
              forceRowsBuffer,
              pressureInterfaceForceRowsRetained: true,
              pressureInterfaceForceSolver: {
                schema: 'peercompute.ulg.sph-pressure-interface-force-solver.v0',
                status: 'pressure-interface-force-solver-ready',
                backend: 'webgpu',
                forceRowCount: 1,
                forceRowStrideFloats: 16,
                forceRowByteLength: forceRowsBuffer.size,
                forceRowsBufferRetained: true,
                retainedGasPressureRowsStatus:
                  'retained-gas-pressure-rows-admitted-same-device'
              }
            };
          }
        }).then((result) => {
          submittedPressureResult = result;
          return result;
        });
      }
      if (task.exportName === 'runMlsMpmMechanicsP2gStageComputeTask') {
        return runMlsMpmMechanicsP2gStageComputeTask({ ...data, preferWebGpu: false });
      }
      if (task.exportName === 'runMlsMpmMechanicsGridUpdateStageComputeTask') {
        return runMlsMpmMechanicsGridUpdateStageComputeTask({ ...data, preferWebGpu: false });
      }
      if (task.exportName === 'runMlsMpmMechanicsG2pStageComputeTask') {
        return runMlsMpmMechanicsG2pStageComputeTask({ ...data, preferWebGpu: false });
      }
      throw new Error(`unexpected task export ${task.exportName}`);
    },
    acquireGpuResidentLaneLease(spec) {
      const lease = {
        schema: 'peercompute.compute.gpu-resident-lane-lease.v0',
        leaseId: `${spec.laneId}:lease`,
        laneId: spec.laneId,
        stateKey: spec.stateKey,
        domainKey: spec.domainKey || null,
        queueFencePolicy: spec.queueFencePolicy,
        stagePlan: {
          schema: 'peercompute.compute.gpu-resident-lane-stage-plan.v0',
          contractSchema: spec.residentSequenceLaneContract.schema,
          status: 'stage-plan-ready',
          defaultEnabled: spec.residentSequenceLaneContract.defaultEnabled === true,
          stageCount: spec.residentSequenceLaneContract.passDagStages.length
        },
        residentSequenceLaneContract: spec.residentSequenceLaneContract
      };
      leases.set(lease.leaseId, lease);
      return lease;
    },
    async executeGpuResidentLaneStagePlan(leaseId, options = {}) {
      const lease = leases.get(leaseId);
      const stageResults = [];
      let input = options.input || null;
      for (const stage of lease.residentSequenceLaneContract.passDagStages) {
        const stageResult = await options.stageExecutors[stage.id]({ stage, input, lease });
        stageResults.push({
          stageId: stage.id,
          status: 'completed',
          executorSource: 'test-stage-executor',
          retainedBufferRefs: stageResult.retainedBufferRefs || [],
          summary: stageResult.summary || {},
          workerResidency: { status: 'blocked-worker-backend-missing' }
        });
        input = stageResult.value;
      }
      return {
        schema: 'peercompute.compute.gpu-resident-lane-stage-execution.v0',
        status: 'completed',
        completedStageCount: stageResults.length,
        stageResults,
        retainedBufferRefs: [...new Set(stageResults.flatMap((entry) => entry.retainedBufferRefs))],
        stagePlan: lease.stagePlan,
        gpuFence: {
          schema: 'peercompute.compute.gpu-fence-report.v0',
          status: 'queue-work-completed',
          required: true,
          fenceSatisfied: true
        }
      };
    },
    completeGpuResidentLaneLease(leaseId, result = {}) {
      const lease = leases.get(leaseId);
      return {
        schema: 'peercompute.compute.gpu-resident-lane-execution.v0',
        status: result.status || 'queue-work-completed',
        stagePlan: lease.stagePlan,
        gpuFence: {
          schema: 'peercompute.compute.gpu-fence-report.v0',
          status: 'queue-work-completed',
          required: true,
          fenceSatisfied: true,
          retainedBufferRefs: result.retainedBufferRefs || []
        }
      };
    },
    rejectGpuResidentLaneLease(leaseId, reason) {
      return { schema: 'peercompute.compute.gpu-resident-lane-rejection.v0', leaseId, status: 'rejected', reason };
    }
  };

  const step = await runMlsMpmMechanicsOnlyResidentStepWithComputeManagerStageTasks({
    ...buffers,
    computeManager,
    modulePath: './sphMlsMpmGpuStep.js',
    stageTaskIdPrefix: 'ulg:test:gas-cell-eos-stage-chain',
    useNativeTaskGraph: false,
    useGpuHubResidentStageExecutors: false,
    preferWebGpu: true,
    readbackMode: 'no-full-readback',
    includeSpatialGasLedgerProducerStage: true,
    includeGasCellEosProducerStage: true,
    includePressureInterfaceStage: true,
    residentProductMass,
    reactionTable,
    gasPressureSummary: {
      schema: 'peercompute.ulg.sph-sealed-gas-pressure-summary.v0',
      status: 'gpu-resident-reaction-pressure-summary',
      totalPressurePa: 180000,
      boxVolumeM3: 8,
      boxDimsM: [2, 2, 2],
      bySpecies: {}
    },
    materialInterfaceField,
    residentAuthorityHost,
    gpuResidentLaneId: 'ulg:test:gas-cell-eos-stage-chain-lane',
    gpuResidentLaneStateKey: 'ulg:test:gas-cell-eos-stage-chain-state'
  });

  assert.deepEqual(step.mechanicsStageTaskChain.stageOrder, [
    'p2g',
    'spatialGasLedgerProducer',
    'gasCellEosProducer',
    'pressureInterface',
    'gridUpdate',
    'g2p'
  ]);
  assert.equal(step.mechanicsStageTaskChain.gpuResidentLaneStageExecutionCompletedStageCount, 6);
  assert.equal(step.mechanicsStageTaskChain.stageTaskResultSchemas.spatialGasLedgerProducer, ULG_SPH_SPATIAL_GAS_LEDGER_PRODUCER_STAGE_COMPUTE_TASK_RESULT_SCHEMA);
  assert.equal(step.mechanicsStageTaskChain.stageTaskResultSchemas.gasCellEosProducer, ULG_SPH_GAS_CELL_EOS_PRODUCER_STAGE_COMPUTE_TASK_RESULT_SCHEMA);
  assert.equal(step.mechanicsStageTaskChain.stageTaskResultSchemas.pressureInterface, ULG_SPH_PRESSURE_INTERFACE_STAGE_COMPUTE_TASK_RESULT_SCHEMA);
  assert.equal(
    step.mechanicsStageTaskChain.stageTaskEvidencePassed.spatialGasLedgerProducer,
    true,
    JSON.stringify({
      status: submittedSpatialGasResult?.status,
      backend: submittedSpatialGasResult?.backend,
      rowCount: submittedSpatialGasResult?.compactSpatialGasRowCount,
      retainedReady: submittedSpatialGasResult?.retainedSpatialGasLedgerSourceReady,
      retainedSchema: submittedSpatialGasResult?.retainedSpatialGasLedgerSource?.schema,
      evidence: submittedSpatialGasResult?.spatialGasLedgerProducerStageTaskEvidence
    })
  );
  assert.equal(step.mechanicsStageTaskChain.stageTaskEvidencePassed.gasCellEosProducer, true);
  assert.equal(step.mechanicsStageTaskChain.stageTaskEvidencePassed.pressureInterface, true);
  assert.equal(step.mechanicsStageTaskChain.spatialGasLedgerProducerReady, true);
  assert.equal(step.mechanicsStageTaskChain.spatialGasLedgerProducerCellCount, 0);
  assert.equal(step.mechanicsStageTaskChain.spatialGasLedgerProducerCompactRowCount, 2);
  assert.equal(step.mechanicsStageTaskChain.spatialGasLedgerProducerRetainedSourceReady, true);
  assert.equal(step.mechanicsStageTaskChain.spatialGasLedgerProducerFullProductEventReadbackPerformed, false);
  assert.equal(step.mechanicsStageTaskChain.gasCellEosProducerImportPublicationStatus, 'gas-cell-eos-producer-import-published');
  assert.equal(step.mechanicsStageTaskChain.gasCellEosProducerPressureInterfaceImportReady, true);
  assert.equal(step.mechanicsStageTaskChain.gasCellEosProducerPressureInterfaceAdmissionApproved, true);
  assert.deepEqual(step.mechanicsStageTaskChain.gasCellEosProducerRetainedGasPressureBufferRefs, ['resident-gas-pressure-cells-buffer']);
  assert.equal(admissionCalls.length, 1);
  assert.equal(importCalls.length, 1);
  assert.equal(admissionCalls[0].sourceStage, 'gasCellEosProducer');
  assert.equal(
    importCalls[0].source.retainedGasCellFieldSource.schema,
    ULG_SPH_RETAINED_GAS_CELL_EOS_SOURCE_SCHEMA
  );
  assert.equal(
    importCalls[0].source.retainedGasCellFieldSource,
    submittedGasEosResult.retainedGasCellFieldSource
  );
  assert.equal(
    isExactSphSpatialGasPressureAuthoritySource(
      importCalls[0].source.retainedGasCellFieldSource
    ),
    true
  );
  assert.equal(importCalls[0].gasCellFieldSnapshot, null);
  assert.equal(importCalls[0].source.hostMaterializedRowCount, 0);
  assert.equal(
    pressureConsumedGasCellsBuffer,
    importCalls[0].source.gasPressureCellsBuffer
  );
  assert.equal(
    submittedPressureResult.backend,
    'webgpu',
    submittedPressureResult.webgpuStatus?.reason || 'pressure backend'
  );
  assert.equal(
    submittedPressureResult.retainedGasPressureRowsStatus,
    'retained-gas-pressure-rows-admitted-same-device'
  );
  assert.equal(
    step.mechanicsStageTaskChain.gasCellEosProducerPressureImportReady,
    true,
    step.mechanicsStageTaskChain.gasCellEosProducerPressureRetainedRowsStatus
      || step.mechanicsStageTaskChain.gasCellEosProducerFinalConsumerReleaseStatus
  );
  assert.equal(
    step.mechanicsStageTaskChain.gasCellEosProducerRetainedGasPressureRowsConsumed,
    true,
    step.mechanicsStageTaskChain.gasCellEosProducerPressureRetainedRowsStatus
      || step.mechanicsStageTaskChain.gasCellEosProducerFinalConsumerReleaseStatus
  );
  assert.deepEqual(finalConsumerEvents, [
    'pressure-consumer-submitted',
    'final-consumer-release-scheduled'
  ]);
  assert.equal(finalConsumerReleaseCalls, 1);
  assert.equal(
    step.mechanicsStageTaskChain.gasCellEosProducerFinalConsumerReleaseScheduled,
    true
  );
  assert.equal(
    step.mechanicsStageTaskChain.gasCellEosProducerFinalConsumerReleaseStatus,
    'gas-cell-eos-final-consumer-release-scheduled-after-pressure-submit'
  );
  assert.equal(
    step.mechanicsStageTaskChain.gasCellEosProducerFinalConsumerReleaseSource,
    'pressure-interface-import-publication'
  );
  const retainedEosExecution =
    importCalls[0].source.spatialGasLedgerEosExecution;
  assert.equal(retainedEosExecution.releaseScheduled, true);
  assert.equal(await retainedEosExecution.releasePromise, true);
  assert.equal(retainedEosExecution.released, true);
  const pressureLaneSummary =
    step.mechanicsStageTaskChain.gpuResidentLaneStageTaskLaneSummaries.pressureInterface;
  assert.equal(pressureLaneSummary.pressureInterfaceGasCellFieldImportReady, true);
  assert.equal(pressureLaneSummary.pressureInterfaceGasPressureCellRowCount, 0);
  assert.equal(pressureLaneSummary.pressureInterfaceGasPressureCellRowCapacity, 2);
  assert.equal(
    pressureLaneSummary.pressureInterfaceGasPressureCellLogicalCountGpuAuthored,
    true
  );
  assert.equal(
    pressureLaneSummary.pressureInterfaceGasPressureAuthorityReady,
    true
  );
  assert.ok(pressureLaneSummary.pressureInterfaceGasPressureCellRowByteLength > 0);
});

test('MLS-MPM stage scheduler uses same-device Schroeder adopted storage continuation from hot-buffer plan', async () => {
  const buffers = manualBuffers();
  const submittedTasks = [];
  const computeManager = {
    async submitTask(task) {
      submittedTasks.push(task);
      const data = { ...task.data, preferWebGpu: false };
      if (task.exportName === 'runMlsMpmMechanicsP2gStageComputeTask') {
        return runMlsMpmMechanicsP2gStageComputeTask(data);
      }
      if (task.exportName === 'runMlsMpmMechanicsGridUpdateStageComputeTask') {
        return runMlsMpmMechanicsGridUpdateStageComputeTask(data);
      }
      if (task.exportName === 'runMlsMpmMechanicsG2pStageComputeTask') {
        return runMlsMpmMechanicsG2pStageComputeTask(data);
      }
      throw new Error(`unexpected task export ${task.exportName}`);
    }
  };
  const planCalls = [];
  const sameDeviceRefs = ['sph-state-buffer', 'sph-thermo-buffer', 'mls-mpm-mechanics-buffer'];
  const resolvedStateBuffer = { label: 'resolved-ss-adopted-state-buffer' };
  const resolvedThermoBuffer = { label: 'resolved-ss-adopted-thermo-buffer' };
  const resolvedMechanicsBuffer = { label: 'resolved-ss-adopted-mechanics-buffer' };
  const retainedBufferResolver = new Map([
    ['sph-state-buffer', {
      buffer: resolvedStateBuffer,
      byteLength: buffers.sphParticleState.state.byteLength,
      particleCount: buffers.sphParticleState.particleCount,
      status: 'retained-buffer-ready'
    }],
    ['sph-thermo-buffer', {
      buffer: resolvedThermoBuffer,
      byteLength: buffers.sphParticleState.thermo.byteLength,
      particleCount: buffers.sphParticleState.particleCount,
      status: 'retained-buffer-ready'
    }],
    ['mls-mpm-mechanics-buffer', {
      buffer: resolvedMechanicsBuffer,
      byteLength: buffers.mlsMpmParticleState.mechanics.byteLength,
      particleCount: buffers.mlsMpmParticleState.particleCount,
      status: 'retained-buffer-ready'
    }]
  ]);
  const residentAuthorityHost = {
    planSchroederAdoptedParticleStorageContinuation(options) {
      planCalls.push(options);
      return {
        schema: 'peercompute.ulg.schroeder-adopted-particle-storage-continuation-plan.v0',
        status: 'schroeder-adopted-particle-storage-same-device-continuation-ready',
        ready: true,
        consumerMode: 'same-device',
        hotBufferKey: options.hotBufferKey,
        stateKey: 'ulg:test:ss-adopted-same-device-state',
        cacheKey: 'ulg:test:ss-adopted-same-device-cache',
        sameDeviceContinuationReady: true,
        sameDevicePrivateLaneContinuation: true,
        sameDevicePrivateLaneRefs: sameDeviceRefs,
        retainedBufferRefs: sameDeviceRefs,
        retainedBufferRefCount: sameDeviceRefs.length,
        crossPeerContinuationReady: false,
        crossPeerReplayReady: false,
        portableReplayAvailable: false,
        rawGpuBufferTransferDetected: false
      };
    }
  };

  const step = await runMlsMpmMechanicsOnlyResidentStepWithComputeManagerStageTasks({
    ...buffers,
    computeManager,
    residentAuthorityHost,
    schroederAdoptedParticleStorageRetainedBufferResolver: retainedBufferResolver,
    modulePath: './sphMlsMpmGpuStep.js',
    stageTaskIdPrefix: 'ulg:test:ss-adopted-same-device-stage-chain',
    useNativeTaskGraph: false,
    useGpuResidentLaneStagePlan: false,
    useGpuHubResidentStageExecutors: false,
    preferWebGpu: false,
    readbackMode: 'full-parity-readback',
    schroederAdoptedParticleStorageContinuationHotBufferKey:
      'ulg:test:ss-adopted-storage-hot-buffer',
    schroederAdoptedParticleStorageContinuationConsumerMode: 'same-device'
  });

  assert.equal(planCalls.length, 1);
  assert.equal(planCalls[0].hotBufferKey, 'ulg:test:ss-adopted-storage-hot-buffer');
  assert.equal(planCalls[0].consumerMode, 'same-device');
  assert.equal(
    step.mechanicsStageTaskChain.schroederAdoptedParticleStorageContinuationScheduleSchema,
    ULG_SCHROEDER_ADOPTED_PARTICLE_STORAGE_CONTINUATION_SCHEDULE_SCHEMA
  );
  assert.equal(
    step.mechanicsStageTaskChain.schroederAdoptedParticleStorageContinuationScheduleStatus,
    'schroeder-adopted-particle-storage-same-device-scheduled'
  );
  assert.equal(step.mechanicsStageTaskChain.schroederAdoptedParticleStorageContinuationScheduled, true);
  assert.equal(step.mechanicsStageTaskChain.schroederAdoptedParticleStorageContinuationScheduleFailClosed, false);
  assert.equal(step.mechanicsStageTaskChain.schroederAdoptedParticleStorageContinuationConsumerMode, 'same-device');
  assert.equal(
    step.mechanicsStageTaskChain.schroederAdoptedParticleStorageContinuationSourceHotBufferKey,
    'ulg:test:ss-adopted-storage-hot-buffer'
  );
  assert.deepEqual(
    step.mechanicsStageTaskChain.schroederAdoptedParticleStorageContinuationSameDevicePrivateLaneRefs,
    sameDeviceRefs
  );
  assert.equal(
    step.mechanicsStageTaskChain.schroederAdoptedParticleStorageLocalResolverSchema,
    ULG_SCHROEDER_ADOPTED_PARTICLE_STORAGE_LOCAL_RESOLVER_SCHEMA
  );
  assert.equal(
    step.mechanicsStageTaskChain.schroederAdoptedParticleStorageLocalResolverStatus,
    'schroeder-adopted-particle-storage-local-resolver-ready'
  );
  assert.equal(step.mechanicsStageTaskChain.schroederAdoptedParticleStorageLocalResolverReady, true);
  assert.equal(step.mechanicsStageTaskChain.schroederAdoptedParticleStorageLocalResolverSphUploadReady, true);
  assert.equal(step.mechanicsStageTaskChain.schroederAdoptedParticleStorageLocalResolverMlsMpmUploadReady, true);
  assert.equal(
    step.mechanicsStageTaskChain.schroederAdoptedParticleStorageLocalResolverRawGpuBufferPeerComputeTransfer,
    false
  );
  assert.deepEqual(
    step.mechanicsStageTaskChain.schroederAdoptedParticleStorageLocalResolverResolvedRefs,
    sameDeviceRefs
  );
  assert.equal(
    step.mechanicsStageTaskChain.schroederAdoptedParticleStorageLocalResolverBinding.sphParticleUpload,
    undefined
  );
  assert.equal(submittedTasks.length, 3);
  const p2gTask = submittedTasks.find((task) => task.exportName === 'runMlsMpmMechanicsP2gStageComputeTask');
  assert.equal(
    p2gTask.data.schroederAdoptedParticleStorageContinuationSchedule.status,
    'schroeder-adopted-particle-storage-same-device-scheduled'
  );
  assert.equal(p2gTask.data.sphParticleUpload.stateBuffer, resolvedStateBuffer);
  assert.equal(p2gTask.data.sphParticleUpload.thermoBuffer, resolvedThermoBuffer);
  assert.equal(p2gTask.data.mlsMpmParticleUpload.mechanicsBuffer, resolvedMechanicsBuffer);
  assert.equal(
    p2gTask.data.schroederAdoptedParticleStorageLocalResolverBinding.rawGpuBufferPeerComputeTransfer,
    false
  );
  assert.deepEqual(
    step.mechanicsOnlySplitPath.stageTaskChain.schroederAdoptedParticleStorageContinuationSameDevicePrivateLaneRefs,
    sameDeviceRefs
  );
  assert.equal(
    step.mechanicsOnlySplitPath.stageTaskChain.schroederAdoptedParticleStorageLocalResolverReady,
    true
  );
});

test('MLS-MPM stage scheduler blocks same-device Schroeder adopted storage when retained refs are unresolved', async () => {
  const buffers = manualBuffers();
  const submittedTasks = [];
  const computeManager = {
    async submitTask(task) {
      submittedTasks.push(task);
      throw new Error(`blocked local resolver should not submit ${task.exportName}`);
    }
  };
  const sameDeviceRefs = ['sph-state-buffer', 'sph-thermo-buffer', 'mls-mpm-mechanics-buffer'];
  const retainedBufferResolver = new Map([
    ['sph-state-buffer', {
      buffer: { label: 'resolved-ss-adopted-state-buffer' },
      byteLength: buffers.sphParticleState.state.byteLength,
      particleCount: buffers.sphParticleState.particleCount,
      status: 'retained-buffer-ready'
    }],
    ['sph-thermo-buffer', {
      buffer: { label: 'resolved-ss-adopted-thermo-buffer' },
      byteLength: buffers.sphParticleState.thermo.byteLength,
      particleCount: buffers.sphParticleState.particleCount,
      status: 'retained-buffer-ready'
    }]
  ]);

  const step = await runMlsMpmMechanicsOnlyResidentStepWithComputeManagerStageTasks({
    ...buffers,
    computeManager,
    modulePath: './sphMlsMpmGpuStep.js',
    stageTaskIdPrefix: 'ulg:test:ss-adopted-same-device-missing-ref-stage-chain',
    useNativeTaskGraph: false,
    useGpuResidentLaneStagePlan: false,
    useGpuHubResidentStageExecutors: false,
    preferWebGpu: false,
    readbackMode: 'full-parity-readback',
    schroederAdoptedParticleStorageRetainedBufferResolver: retainedBufferResolver,
    schroederAdoptedParticleStorageContinuationConsumerMode: 'same-device',
    schroederAdoptedParticleStorageContinuationPlan: {
      schema: 'peercompute.ulg.schroeder-adopted-particle-storage-continuation-plan.v0',
      status: 'schroeder-adopted-particle-storage-same-device-continuation-ready',
      ready: true,
      consumerMode: 'same-device',
      hotBufferKey: 'ulg:test:ss-adopted-storage-hot-buffer',
      sameDeviceContinuationReady: true,
      sameDevicePrivateLaneContinuation: true,
      sameDevicePrivateLaneRefs: sameDeviceRefs,
      retainedBufferRefs: sameDeviceRefs,
      retainedBufferRefCount: sameDeviceRefs.length,
      crossPeerContinuationReady: false,
      crossPeerReplayReady: false,
      portableReplayAvailable: false,
      rawGpuBufferTransferDetected: false
    }
  });

  assert.equal(submittedTasks.length, 0);
  assert.equal(
    step.mechanicsStageTaskChain.schedulerStatus,
    'blocked-schroeder-adopted-particle-storage-continuation'
  );
  assert.equal(
    step.mechanicsStageTaskChain.schroederAdoptedParticleStorageContinuationScheduleStatus,
    'schroeder-adopted-particle-storage-same-device-scheduled'
  );
  assert.equal(step.mechanicsStageTaskChain.schroederAdoptedParticleStorageContinuationScheduleFailClosed, false);
  assert.equal(
    step.mechanicsStageTaskChain.schroederAdoptedParticleStorageLocalResolverStatus,
    'blocked-schroeder-adopted-particle-storage-local-resolver'
  );
  assert.equal(step.mechanicsStageTaskChain.schroederAdoptedParticleStorageLocalResolverReady, false);
  assert.deepEqual(
    step.mechanicsStageTaskChain.schroederAdoptedParticleStorageLocalResolverMissingResolvedRefs,
    ['mls-mpm-mechanics-buffer']
  );
  assert.equal(step.mechanicsStageTaskChain.schroederAdoptedParticleStorageLocalResolverSphUploadReady, false);
  assert.equal(step.mechanicsStageTaskChain.schroederAdoptedParticleStorageLocalResolverMlsMpmUploadReady, false);
  assert.equal(
    step.mechanicsStageTaskChain.schroederAdoptedParticleStorageLocalResolverRawGpuBufferPeerComputeTransfer,
    false
  );
  assert.equal(
    step.mechanicsOnlySplitPath.stageTaskChain.schroederAdoptedParticleStorageLocalResolverStatus,
    'blocked-schroeder-adopted-particle-storage-local-resolver'
  );
});

test('MLS-MPM stage scheduler refuses cross-peer Schroeder adopted storage without portable replay', async () => {
  const buffers = manualBuffers();
  const submittedTasks = [];
  const computeManager = {
    async submitTask(task) {
      submittedTasks.push(task);
      throw new Error(`blocked cross-peer schedule should not submit ${task.exportName}`);
    }
  };
  const blocker = 'materialized-gpu-buffers-remain-device-local';
  const step = await runMlsMpmMechanicsOnlyResidentStepWithComputeManagerStageTasks({
    ...buffers,
    computeManager,
    modulePath: './sphMlsMpmGpuStep.js',
    stageTaskIdPrefix: 'ulg:test:ss-adopted-cross-peer-blocked-stage-chain',
    useNativeTaskGraph: false,
    useGpuResidentLaneStagePlan: false,
    preferWebGpu: false,
    readbackMode: 'full-parity-readback',
    schroederAdoptedParticleStorageContinuationPlan: {
      schema: 'peercompute.ulg.schroeder-adopted-particle-storage-continuation-plan.v0',
      status: 'blocked-schroeder-adopted-particle-storage-cross-peer-continuation',
      ready: false,
      reason: blocker,
      consumerMode: 'cross-peer',
      hotBufferKey: 'ulg:test:ss-adopted-storage-hot-buffer',
      sameDeviceContinuationReady: false,
      crossPeerContinuationReady: false,
      crossPeerReplayReady: false,
      crossPeerReplayBlocker: blocker,
      portableSnapshotRequired: true,
      portableReplayAvailable: false,
      rawGpuBufferTransferDetected: false
    }
  });

  assert.equal(submittedTasks.length, 0);
  assert.equal(
    step.mechanicsStageTaskChain.schedulerStatus,
    'blocked-schroeder-adopted-particle-storage-continuation'
  );
  assert.equal(
    step.mechanicsStageTaskChain.schroederAdoptedParticleStorageContinuationScheduleStatus,
    'blocked-schroeder-adopted-particle-storage-cross-peer-scheduling'
  );
  assert.equal(step.mechanicsStageTaskChain.schroederAdoptedParticleStorageContinuationScheduled, false);
  assert.equal(step.mechanicsStageTaskChain.schroederAdoptedParticleStorageContinuationScheduleFailClosed, true);
  assert.equal(step.mechanicsStageTaskChain.schroederAdoptedParticleStorageContinuationScheduleReason, blocker);
  assert.equal(step.mechanicsStageTaskChain.schroederAdoptedParticleStorageContinuationConsumerMode, 'cross-peer');
  assert.equal(
    step.mechanicsStageTaskChain.gpuHubResidentStageExecutorMode,
    'blocked-schroeder-adopted-particle-storage-continuation'
  );
  assert.deepEqual(step.mechanicsStageTaskChain.submittedStageTasks, []);
  assert.equal(
    step.mechanicsOnlySplitPath.stageTaskChain.schroederAdoptedParticleStorageContinuationScheduleStatus,
    'blocked-schroeder-adopted-particle-storage-cross-peer-scheduling'
  );
});

test('MLS-MPM outer stage chain propagates supplied-generation pressure failures while preserving legacy fallback', async () => {
  const buffers = manualBuffers();
  const pressureFailure = new Error('shared-generation pressure/interface GPU failure');
  const schroederSpatialEpochGeneration = {
    schema: 'peercompute.ulg.schroeder-spatial-epoch-generation.v1',
    generationId: 61
  };
  const createThrowingPressureComputeManager = ({
    expectedGeneration = null,
    registerResidentExecutors = false
  } = {}) => {
    const submittedTaskExports = [];
    const rejectedLeaseReasons = [];
    const registeredExecutors = new Map();
    const workerExecutionStageIds = [];
    let laneContract = null;
    const gpuHub = {
      registerResidentStageExecutor(spec) {
        registeredExecutors.set(spec.stageId, spec);
        return {
          schema: 'peercompute.gpu.resident-stage-executor.v0',
          stageId: spec.stageId,
          workerPolicy: { ...spec.workerPolicy }
        };
      },
      hasResidentStageExecutor(stage) {
        return registeredExecutors.has(stage?.id || stage);
      },
      async executeResidentStage(args = {}) {
        const stageId = args.stage?.id || args.stage;
        const registration = registeredExecutors.get(stageId);
        if (!registration) throw new Error(`missing registered stage ${stageId}`);
        if (registration.workerRunner) {
          workerExecutionStageIds.push(stageId);
          return registration.workerRunner(args);
        }
        return registration.executor(args);
      }
    };
    const computeManager = {
      ...(registerResidentExecutors ? { gpuHub } : {}),
      async submitTask(task) {
        submittedTaskExports.push(task.exportName);
        if (task.exportName === 'runSphPressureInterfaceStageComputeTask') {
          if (expectedGeneration) {
            assert.equal(task.data.schroederSpatialEpochGeneration, expectedGeneration);
          }
          throw pressureFailure;
        }
        const data = { ...task.data, preferWebGpu: false };
        if (task.exportName === 'runMlsMpmMechanicsP2gStageComputeTask') {
          return runMlsMpmMechanicsP2gStageComputeTask(data);
        }
        if (task.exportName === 'runMlsMpmMechanicsGridUpdateStageComputeTask') {
          return runMlsMpmMechanicsGridUpdateStageComputeTask(data);
        }
        if (task.exportName === 'runMlsMpmMechanicsG2pStageComputeTask') {
          return runMlsMpmMechanicsG2pStageComputeTask(data);
        }
        throw new Error(`unexpected task export ${task.exportName}`);
      },
      acquireGpuResidentLaneLease(spec) {
        laneContract = spec.residentSequenceLaneContract;
        return {
          leaseId: `${spec.laneId}:lease`,
          laneId: spec.laneId,
          stateKey: spec.stateKey,
          residentSequenceLaneContract: laneContract
        };
      },
      async executeGpuResidentLaneStagePlan(leaseId, options = {}) {
        let input = options.input || null;
        const stageResults = [];
        for (const stage of laneContract.passDagStages) {
          const stageExecutor = options.stageExecutors?.[stage.id]
            || ((args) => gpuHub.executeResidentStage(args));
          const stageResult = await stageExecutor({
            stage,
            input,
            leaseId,
            context: options.context || {}
          });
          stageResults.push({ stageId: stage.id, status: 'completed' });
          input = stageResult.value;
        }
        return {
          schema: 'peercompute.compute.gpu-resident-lane-stage-execution.v0',
          status: 'completed',
          completedStageCount: stageResults.length,
          stageResults,
          retainedBufferRefs: []
        };
      },
      completeGpuResidentLaneLease() {
        throw new Error('a failed pressure stage must not complete its lane lease');
      },
      rejectGpuResidentLaneLease(leaseId, reason) {
        rejectedLeaseReasons.push({ leaseId, reason });
        return { leaseId, status: 'rejected', reason };
      }
    };
    return {
      computeManager,
      submittedTaskExports,
      rejectedLeaseReasons,
      registeredExecutors,
      workerExecutionStageIds
    };
  };

  const sharedGenerationRun = createThrowingPressureComputeManager({
    expectedGeneration: schroederSpatialEpochGeneration
  });
  await assert.rejects(
    runMlsMpmMechanicsOnlyResidentStepWithComputeManagerStageTasks({
      ...buffers,
      computeManager: sharedGenerationRun.computeManager,
      modulePath: './sphMlsMpmGpuStep.js',
      stageTaskIdPrefix: 'ulg:test:shared-generation-pressure-failure-stage-chain',
      useNativeTaskGraph: false,
      useGpuHubResidentStageExecutors: false,
      includePressureInterfaceStage: true,
      preferWebGpu: true,
      readbackMode: 'full-parity-readback',
      schroederSpatialEpochGeneration
    }),
    (error) => error === pressureFailure
  );
  assert.deepEqual(sharedGenerationRun.submittedTaskExports, [
    'runMlsMpmMechanicsP2gStageComputeTask',
    'runSphPressureInterfaceStageComputeTask'
  ]);
  assert.equal(sharedGenerationRun.rejectedLeaseReasons.length, 1);
  assert.equal(
    sharedGenerationRun.rejectedLeaseReasons[0].reason,
    'mechanics-stage-plan-executor-error'
  );

  const registeredWorkerRun = createThrowingPressureComputeManager({
    expectedGeneration: schroederSpatialEpochGeneration,
    registerResidentExecutors: true
  });
  await assert.rejects(
    runMlsMpmMechanicsOnlyResidentStepWithComputeManagerStageTasks({
      ...buffers,
      computeManager: registeredWorkerRun.computeManager,
      modulePath: './sphMlsMpmGpuStep.js',
      stageTaskIdPrefix:
        'ulg:test:shared-generation-registered-worker-pressure-failure-stage-chain',
      useNativeTaskGraph: false,
      includePressureInterfaceStage: true,
      preferWebGpu: true,
      readbackMode: 'full-parity-readback',
      gpuHubResidentStageWorkerRunner() {
        throw new Error(
          'caller-owned spatial generation must never cross the dedicated-worker boundary'
        );
      },
      schroederSpatialEpochGeneration
    }),
    (error) => error === pressureFailure
  );
  assert.deepEqual(registeredWorkerRun.workerExecutionStageIds, []);
  assert.ok(registeredWorkerRun.registeredExecutors.size > 0);
  for (const registration of registeredWorkerRun.registeredExecutors.values()) {
    assert.equal(registration.workerRunner, undefined);
    assert.equal(registration.workerPolicy.mode, 'inline');
    assert.equal(registration.workerPolicy.sameDeviceRequired, true);
  }
  assert.deepEqual(registeredWorkerRun.submittedTaskExports, [
    'runMlsMpmMechanicsP2gStageComputeTask',
    'runSphPressureInterfaceStageComputeTask'
  ]);
  assert.equal(registeredWorkerRun.rejectedLeaseReasons.length, 1);

  const disabledLaneRun = createThrowingPressureComputeManager({
    expectedGeneration: schroederSpatialEpochGeneration
  });
  await assert.rejects(
    runMlsMpmMechanicsOnlyResidentStepWithComputeManagerStageTasks({
      ...buffers,
      computeManager: disabledLaneRun.computeManager,
      modulePath: './sphMlsMpmGpuStep.js',
      stageTaskIdPrefix:
        'ulg:test:shared-generation-disabled-lane-pressure-stage-chain',
      useNativeTaskGraph: false,
      useGpuHubResidentStageExecutors: false,
      useGpuResidentLaneStagePlan: false,
      includePressureInterfaceStage: true,
      preferWebGpu: true,
      readbackMode: 'full-parity-readback',
      schroederSpatialEpochGeneration
    }),
    /cannot continue without a completed same-device pressure\/interface lane stage/
  );
  assert.deepEqual(disabledLaneRun.submittedTaskExports, []);

  const unavailableLaneRun = createThrowingPressureComputeManager({
    expectedGeneration: schroederSpatialEpochGeneration
  });
  delete unavailableLaneRun.computeManager.acquireGpuResidentLaneLease;
  delete unavailableLaneRun.computeManager.executeGpuResidentLaneStagePlan;
  delete unavailableLaneRun.computeManager.completeGpuResidentLaneLease;
  await assert.rejects(
    runMlsMpmMechanicsOnlyResidentStepWithComputeManagerStageTasks({
      ...buffers,
      computeManager: unavailableLaneRun.computeManager,
      modulePath: './sphMlsMpmGpuStep.js',
      stageTaskIdPrefix:
        'ulg:test:shared-generation-unavailable-lane-pressure-stage-chain',
      useNativeTaskGraph: false,
      useGpuHubResidentStageExecutors: false,
      includePressureInterfaceStage: true,
      preferWebGpu: true,
      readbackMode: 'full-parity-readback',
      schroederSpatialEpochGeneration
    }),
    /cannot continue without a completed same-device pressure\/interface lane stage/
  );
  assert.deepEqual(unavailableLaneRun.submittedTaskExports, []);

  const encodedFailedLaneRun = createThrowingPressureComputeManager({
    expectedGeneration: schroederSpatialEpochGeneration
  });
  encodedFailedLaneRun.computeManager.executeGpuResidentLaneStagePlan = async () => ({
    schema: 'peercompute.compute.gpu-resident-lane-stage-execution.v0',
    status: 'failed',
    completedStageCount: 0,
    stageResults: [],
    retainedBufferRefs: []
  });
  await assert.rejects(
    runMlsMpmMechanicsOnlyResidentStepWithComputeManagerStageTasks({
      ...buffers,
      computeManager: encodedFailedLaneRun.computeManager,
      modulePath: './sphMlsMpmGpuStep.js',
      stageTaskIdPrefix:
        'ulg:test:shared-generation-encoded-failed-lane-pressure-stage-chain',
      useNativeTaskGraph: false,
      useGpuHubResidentStageExecutors: false,
      includePressureInterfaceStage: true,
      preferWebGpu: true,
      readbackMode: 'full-parity-readback',
      schroederSpatialEpochGeneration
    }),
    /requires a completed same-device pressure\/interface lane stage with valid WebGPU evidence/
  );
  assert.deepEqual(encodedFailedLaneRun.submittedTaskExports, []);
  assert.equal(encodedFailedLaneRun.rejectedLeaseReasons.length, 1);

  const legacyRun = createThrowingPressureComputeManager();
  const legacyStep = await runMlsMpmMechanicsOnlyResidentStepWithComputeManagerStageTasks({
    ...buffers,
    computeManager: legacyRun.computeManager,
    modulePath: './sphMlsMpmGpuStep.js',
    stageTaskIdPrefix: 'ulg:test:legacy-pressure-failure-stage-chain',
    useNativeTaskGraph: false,
    useGpuHubResidentStageExecutors: false,
    includePressureInterfaceStage: true,
    preferWebGpu: true,
    readbackMode: 'full-parity-readback'
  });
  assert.equal(legacyStep.mechanicsStageTaskChain.status, 'compute-manager-stage-task-chain-executed');
  assert.equal(legacyStep.mechanicsStageTaskChain.gpuResidentLaneStageExecutionStatus, 'failed');
  assert.deepEqual(legacyRun.submittedTaskExports, [
    'runMlsMpmMechanicsP2gStageComputeTask',
    'runSphPressureInterfaceStageComputeTask',
    'runMlsMpmMechanicsGridUpdateStageComputeTask',
    'runMlsMpmMechanicsG2pStageComputeTask'
  ]);
});

test('MLS-MPM shared-generation stage chain requires accepted pressure and final lane fences', async () => {
  const buffers = manualBuffers();
  const schroederSpatialEpochGeneration = {
    schema: 'peercompute.ulg.schroeder-spatial-epoch-generation.v1',
    generationId: 71
  };
  const createManager = ({ malformedCompletion = false, completionOverride = null } = {}) => {
    let laneContract = null;
    let completeCount = 0;
    let rejectCount = 0;
    const computeManager = {
      async submitTask(task) {
        if (task.exportName === 'runSphPressureInterfaceStageComputeTask') {
          assert.equal(
            task.data.schroederSpatialEpochGeneration,
            schroederSpatialEpochGeneration
          );
          return {
            computeTaskResultSchema:
              ULG_SPH_PRESSURE_INTERFACE_STAGE_COMPUTE_TASK_RESULT_SCHEMA,
            backend: 'webgpu',
            status: 'pressure-interface-stage-solver-ready',
            pressureInterfaceStageTask: true,
            pressureInterfaceStageTaskEvidence: {
              passed: true,
              sharedSpatialGenerationRequired: true,
              sharedSpatialAuthorityPassed: true
            },
            gpuFence: {
              schema: 'peercompute.compute.gpu-fence-report.v0',
              required: true,
              fenceSatisfied: true,
              status: 'gpu-fence-satisfied'
            },
            pressureInterfaceForceSolver: {
              schema: ULG_SPH_PRESSURE_INTERFACE_FORCE_SOLVER_SCHEMA,
              status: 'pressure-interface-force-solver-ready',
              backend: 'webgpu',
              ...sharedSpatialPressureSolverAuthorityFixture()
            }
          };
        }
        const data = { ...task.data, preferWebGpu: false };
        if (task.exportName === 'runMlsMpmMechanicsP2gStageComputeTask') {
          return runMlsMpmMechanicsP2gStageComputeTask(data);
        }
        if (task.exportName === 'runMlsMpmMechanicsGridUpdateStageComputeTask') {
          return runMlsMpmMechanicsGridUpdateStageComputeTask(data);
        }
        if (task.exportName === 'runMlsMpmMechanicsG2pStageComputeTask') {
          return runMlsMpmMechanicsG2pStageComputeTask(data);
        }
        throw new Error(`unexpected task export ${task.exportName}`);
      },
      acquireGpuResidentLaneLease(spec) {
        laneContract = spec.residentSequenceLaneContract;
        return {
          leaseId: `${spec.laneId}:lease`,
          laneId: spec.laneId,
          stateKey: spec.stateKey,
          residentSequenceLaneContract: laneContract
        };
      },
      async executeGpuResidentLaneStagePlan(leaseId, options = {}) {
        let input = options.input || null;
        const stageResults = [];
        for (const stage of laneContract.passDagStages) {
          const stageResult = await options.stageExecutors[stage.id]({
            stage,
            input,
            leaseId
          });
          stageResults.push({ stageId: stage.id, status: 'completed' });
          input = stageResult.value;
        }
        return {
          schema: 'peercompute.compute.gpu-resident-lane-stage-execution.v0',
          status: 'completed',
          completedStageCount: stageResults.length,
          stageResults,
          retainedBufferRefs: []
        };
      },
      completeGpuResidentLaneLease() {
        completeCount += 1;
        return completionOverride || (malformedCompletion
          ? {
              status: 'rejected',
              gpuFence: {
                schema: 'peercompute.compute.gpu-fence-report.v0',
                status: 'gpu-fence-unsatisfied',
                required: true,
                fenceSatisfied: false
              }
            }
          : {
              status: 'queue-work-completed',
              gpuFence: {
                schema: 'peercompute.compute.gpu-fence-report.v0',
                status: 'queue-work-completed',
                required: true,
                fenceSatisfied: true
              }
            });
      },
      rejectGpuResidentLaneLease() {
        rejectCount += 1;
        return { status: 'rejected' };
      }
    };
    return {
      computeManager,
      counts: () => ({ completeCount, rejectCount })
    };
  };
  const run = (manager, extra = {}) => (
    runMlsMpmMechanicsOnlyResidentStepWithComputeManagerStageTasks({
      ...buffers,
      computeManager: manager.computeManager,
      modulePath: './sphMlsMpmGpuStep.js',
      stageTaskIdPrefix: 'ulg:test:shared-generation-lane-fence-stage-chain',
      useNativeTaskGraph: false,
      useGpuHubResidentStageExecutors: false,
      includePressureInterfaceStage: true,
      preferWebGpu: true,
      readbackMode: 'full-parity-readback',
      schroederSpatialEpochGeneration,
      ...extra
    })
  );

  const valid = createManager();
  const validStep = await run(valid);
  assert.equal(validStep.mechanicsStageTaskChain.status, 'compute-manager-stage-task-chain-executed');
  assert.deepEqual(valid.counts(), { completeCount: 1, rejectCount: 0 });

  const malformed = createManager({ malformedCompletion: true });
  await assert.rejects(
    run(malformed),
    /requires an accepted lane completion with a satisfied queue fence/
  );
  assert.deepEqual(malformed.counts(), { completeCount: 1, rejectCount: 1 });

  const contradictoryTop = createManager({
    completionOverride: {
      schema: 'peercompute.compute.gpu-resident-lane-execution.v0',
      status: 'rejected',
      lease: { status: 'completed' },
      gpuFence: {
        schema: 'peercompute.compute.gpu-fence-report.v0',
        status: 'queue-work-completed',
        required: true,
        fenceSatisfied: true
      }
    }
  });
  await assert.rejects(
    run(contradictoryTop),
    /requires an accepted lane completion with a satisfied queue fence/
  );
  assert.deepEqual(contradictoryTop.counts(), { completeCount: 1, rejectCount: 1 });

  const contradictoryLease = createManager({
    completionOverride: {
      schema: 'peercompute.compute.gpu-resident-lane-execution.v0',
      status: 'queue-work-completed',
      lease: { status: 'rejected' },
      gpuFence: {
        schema: 'peercompute.compute.gpu-fence-report.v0',
        status: 'queue-work-completed',
        required: true,
        fenceSatisfied: true
      }
    }
  });
  await assert.rejects(
    run(contradictoryLease),
    /requires an accepted lane completion with a satisfied queue fence/
  );
  assert.deepEqual(contradictoryLease.counts(), { completeCount: 1, rejectCount: 1 });

  const omittedRequired = createManager({
    completionOverride: {
      schema: 'peercompute.compute.gpu-resident-lane-execution.v0',
      status: 'queue-work-completed',
      gpuFence: {
        schema: 'peercompute.compute.gpu-fence-report.v0',
        status: 'queue-work-completed',
        fenceSatisfied: true
      }
    }
  });
  await assert.rejects(
    run(omittedRequired),
    /requires an accepted lane completion with a satisfied queue fence/
  );
  assert.deepEqual(omittedRequired.counts(), { completeCount: 1, rejectCount: 1 });

  const remoteRefresh = createManager();
  const nodeKernel = {
    async executeGpuResidentLaneStagePlan(leaseId, options) {
      const execution = await remoteRefresh.computeManager.executeGpuResidentLaneStagePlan(
        leaseId,
        options
      );
      return {
        ...execution,
        nodeKernelGpuResidentStageAuthority: {
          localHotBufferRefreshRequired: true
        }
      };
    }
  };
  await assert.rejects(
    run(remoteRefresh, { nodeKernel }),
    /requires an accepted lane completion with a satisfied queue fence/
  );
  assert.equal(remoteRefresh.counts().completeCount, 0);
  assert.ok(remoteRefresh.counts().rejectCount >= 1);
});

test('SPH pressure interface stage compute task declares retained force-row output without authority mutation', async () => {
  const materialInterfaceField = {
    schema: 'peercompute.ulg.sph-material-interface-field.v0',
    status: 'material-interface-field-ready',
    surfaceCount: 1,
    readySurfaceCount: 1,
    totalSurfaceAreaM2: 2,
    elementCount: 2,
    elements: [
      {
        status: 'interface-element-ready',
        surfaceIndex: 0,
        surfaceKey: 'h2o|liquid',
        material: 'h2o',
        phase: 'liquid',
        materialId: 1,
        phaseId: 2,
        axisId: 0,
        centroidM: [0.5, 1, 1],
        areaM2: 1,
        normalAreaVectorM2: [1, 0, 0],
        gapM: 0.2,
        normalVelocityMPerS: 0,
        representativeMassKg: 0
      },
      {
        status: 'interface-element-ready',
        surfaceIndex: 0,
        surfaceKey: 'h2o|liquid',
        material: 'h2o',
        phase: 'liquid',
        materialId: 1,
        phaseId: 2,
        axisId: 0,
        centroidM: [1.5, 1, 1],
        areaM2: 1,
        normalAreaVectorM2: [-1, 0, 0],
        gapM: 0.2,
        normalVelocityMPerS: 0,
        representativeMassKg: 0
      }
    ]
  };
  const gasPressureSummary = {
    schema: 'peercompute.ulg.sph-sealed-gas-pressure-summary.v0',
    status: 'synthetic-pressure',
    totalPressurePa: 120000,
    boxVolumeM3: 8,
    boxDimsM: [2, 2, 2],
    bySpecies: {},
    strictReactionGate: { status: 'strict-reaction-gate-pass', blockers: [] }
  };
  const task = createSphPressureInterfaceStageComputeTask({
    modulePath: './sphMlsMpmGpuStep.js',
    taskId: 'ulg:test:pressure-interface-stage',
    laneId: 'ulg:test:pressure-interface-lane',
    stateKey: 'ulg:test:pressure-interface-state',
    domainKey: 'ulg:test-domain',
    preferWebGpu: true,
    readbackMode: 'no-full-readback',
    gasPressureSummary,
    materialInterfaceField
  });

  assert.equal(task.schema, ULG_SPH_PRESSURE_INTERFACE_STAGE_COMPUTE_TASK_SCHEMA);
  assert.equal(task.exportName, 'runSphPressureInterfaceStageComputeTask');
  assert.equal(task.residency, 'gpu-lane');
  assert.equal(task.suppressCommitDelta, true);
  assert.equal(task.gpuFence.required, true);
  assert.equal(task.gpuFence.laneId, 'ulg:test:pressure-interface-lane');
  assert.equal(task.gpuResidentLane.owner, 'ulg-pressure-interface-force-law');
  assert.deepEqual(task.writeFamilies, ['pressure-interface-force-rows']);
  assert.deepEqual(task.webgpu.retainedBufferRefs, ['pressure-interface-force-rows-buffer']);

  const result = await runSphPressureInterfaceStageComputeTask(task.data);

  assert.equal(result.computeTaskResultSchema, ULG_SPH_PRESSURE_INTERFACE_STAGE_COMPUTE_TASK_RESULT_SCHEMA);
  assert.equal(result.computeTaskSchema, ULG_SPH_PRESSURE_INTERFACE_STAGE_COMPUTE_TASK_SCHEMA);
  assert.equal(result.computeTaskId, 'ulg:test:pressure-interface-stage');
  assert.equal(result.backend, 'cpu-reference');
  assert.equal(result.status, 'pressure-interface-stage-solver-ready');
  assert.equal(result.pressureInterfaceForcePreview.schema, 'peercompute.ulg.sph-pressure-interface-force-preview.v0');
  assert.equal(result.pressureInterfaceForceSolver.schema, ULG_SPH_PRESSURE_INTERFACE_FORCE_SOLVER_SCHEMA);
  assert.equal(result.pressureInterfaceForceSolver.status, 'pressure-interface-force-solver-ready');
  assert.equal(result.pressureInterfaceForceSolver.pressureFieldMode, 'uniform-single-cell-sealed-gas');
  assert.equal(result.pressureInterfaceForceSolver.localPressureGradientReady, false);
  assert.equal(result.pressureInterfaceForceSolver.localPressureGradientForceCouplingStatus, 'blocked-local-pressure-gradient-field-required');
  assert.equal(result.forceRowCount, 2);
  assert.equal(result.forceRowValues.length, 2 * SPH_PRESSURE_INTERFACE_FORCE_ROW_LAYOUT.length);
  assert.equal(result.pressureInterfaceForceRowsRetained, true);
  assert.equal(result.gpuFence.schema, 'peercompute.compute.gpu-fence-report.v0');
  assert.equal(result.gpuFence.required, true);
  assert.equal(result.gpuFence.fenceSatisfied, true);
  assert.equal(result.pressureInterfaceStageTaskEvidence.schema, 'peercompute.ulg.pressure-interface-stage-task-evidence.v0');
  assert.equal(result.pressureInterfaceStageTaskEvidence.passed, true);
  assert.equal(result.pressureInterfaceStageTaskEvidence.pressureFieldMode, 'uniform-single-cell-sealed-gas');
  assert.equal(result.pressureInterfaceStageTaskEvidence.localPressureGradientReady, false);
  assert.equal(result.pressureInterfaceStageTaskEvidence.localPressureGradientForceCouplingStatus, 'blocked-local-pressure-gradient-field-required');
  assert.deepEqual(result.pressureInterfaceStageTaskEvidence.candidateWriteFamilies, ['pressure-interface-force-rows']);
  assert.ok(result.pressureInterfaceStageTaskEvidence.mustNotWriteFamilies.includes('resident-product-mass'));
  assert.equal(result.pressureInterfaceStageTaskAuthority.status, 'compute-manager-owned-non-mutating-pressure-interface-stage-task');
  assert.equal(result.pressureInterfaceStageTaskAuthority.authoritativeStateMutation, false);
  assert.equal(result.pressureInterfaceStageTaskAuthority.gridForceApplicationApproved, false);
  assert.equal(result.pressureInterfaceStageTaskAuthority.commitDeltaSuppressed, true);
});

test('SPH pressure interface stage compute task conditionally declares shared Schroeder spatial-epoch reads', () => {
  const schroederSpatialEpochGeneration = {
    schema: 'peercompute.ulg.schroeder-spatial-epoch-generation.v1',
    generationId: 41
  };
  const commonOptions = {
    modulePath: './sphMlsMpmGpuStep.js',
    preferWebGpu: true,
    readbackMode: 'no-full-readback'
  };
  const taskWithoutGeneration = createSphPressureInterfaceStageComputeTask({
    ...commonOptions,
    taskId: 'ulg:test:pressure-interface-stage-without-spatial-epoch'
  });
  const taskWithGeneration = createSphPressureInterfaceStageComputeTask({
    ...commonOptions,
    taskId: 'ulg:test:pressure-interface-stage-with-spatial-epoch',
    schroederSpatialEpochGeneration
  });

  assert.deepEqual(taskWithoutGeneration.readFamilies, [
    'resident-gas-pressure',
    'sph-material-interface-field'
  ]);
  assert.deepEqual(taskWithGeneration.readFamilies, [
    'resident-gas-pressure',
    'sph-material-interface-field',
    'schroeder-spatial-epoch'
  ]);
  assert.deepEqual(taskWithGeneration.lawGraphNode.readFamilies, taskWithGeneration.readFamilies);
  assert.deepEqual(taskWithGeneration.gpuResidentLane.readFamilies, taskWithGeneration.readFamilies);
  assert.equal(taskWithGeneration.data.schroederSpatialEpochGeneration, schroederSpatialEpochGeneration);
});

test('SPH pressure interface stage carries algorithm contact pair response into force rows', async () => {
  const materialInterfaceField = {
    schema: 'peercompute.ulg.sph-material-interface-field.v0',
    status: 'material-interface-field-ready',
    surfaceCount: 1,
    readySurfaceCount: 1,
    totalSurfaceAreaM2: 2,
    elementCount: 2,
    elements: [
      {
        status: 'interface-element-ready',
        surfaceIndex: 0,
        surfaceKey: 'h2o|liquid',
        material: 'h2o',
        phase: 'liquid',
        materialId: 1,
        phaseId: 2,
        axisId: 0,
        centroidM: [0.5, 1, 1],
        areaM2: 1,
        normalAreaVectorM2: [1, 0, 0],
        gapM: 0.2,
        normalVelocityMPerS: 0,
        representativeMassKg: 0
      },
      {
        status: 'interface-element-ready',
        surfaceIndex: 0,
        surfaceKey: 'h2o|liquid',
        material: 'h2o',
        phase: 'liquid',
        materialId: 1,
        phaseId: 2,
        axisId: 0,
        centroidM: [1.5, 1, 1],
        areaM2: 1,
        normalAreaVectorM2: [-1, 0, 0],
        gapM: 0.2,
        normalVelocityMPerS: 0,
        representativeMassKg: 0
      }
    ]
  };
  const gasPressureSummary = {
    schema: 'peercompute.ulg.sph-sealed-gas-pressure-summary.v0',
    status: 'synthetic-pressure',
    totalPressurePa: 120000,
    boxVolumeM3: 8,
    boxDimsM: [2, 2, 2],
    bySpecies: {},
    strictReactionGate: { status: 'strict-reaction-gate-pass', blockers: [] }
  };
  const result = await runSphPressureInterfaceStageComputeTask({
    modulePath: './sphMlsMpmGpuStep.js',
    computeTaskId: 'ulg:test:pressure-interface-contact-stage',
    gasPressureSummary,
    materialInterfaceField,
    algorithmMaterialContactRows: algorithmContactRowsFixture({ normalStiffnessPa: 4e9 }),
    algorithmContactPairResponseScale: 1e-4,
    algorithmContactMaxPressurePa: 500000,
    expectedOutputFamilies: ['pressure-interface-force-rows'],
    pressureInterfaceStageTask: true
  });

  assert.equal(result.backend, 'cpu-reference');
  assert.equal(result.status, 'pressure-interface-stage-solver-ready');
  assert.equal(result.algorithmContactPairResponseStatus, 'algorithm-contact-pair-response-applied');
  assert.equal(result.algorithmContactPolicyRowCount, 1);
  assert.equal(result.algorithmContactForceRowCount, 2);
  assert.equal(result.interfaceContactKinematicsReadyCount, 2);
  assert.equal(result.pressureInterfaceForceSolver.forceResolution, 'uniform-interface-traction+algorithm-contact-pair-response');
  assert.equal(result.pressureInterfaceForceSolver.gasInterfacePressureReferencePa, 101325);
  assert.equal(result.pressureInterfaceForceSolver.gasInterfaceGaugePressurePa, 18675);
  nearlyEqual(result.pressureInterfaceForceSolver.gasInterfacePressureRangePa[0], 143675);
  nearlyEqual(result.pressureInterfaceForceSolver.gasInterfacePressureRangePa[1], 143675);
  const packedForceRow = [...result.forceRowValues.slice(8, 16)];
  nearlyEqual(packedForceRow[0], -143675);
  assert.deepEqual(packedForceRow.slice(1, 6), [0, 0, 143675, 0, 0]);
  nearlyEqual(packedForceRow[6], 143675);
  assert.equal(packedForceRow[7], 1);
  assert.equal(result.pressureInterfaceStageTaskEvidence.algorithmContactPairResponseStatus, 'algorithm-contact-pair-response-applied');
  assert.equal(result.pressureInterfaceStageTaskEvidence.algorithmContactForceRowCount, 2);
  assert.equal(result.pressureInterfaceStageTaskEvidence.interfaceContactKinematicsReadyCount, 2);
});

test('SPH pressure interface stage forwards resident particle buffers for contact kinematics', async () => {
  const stateBuffer = { label: 'stage-test-sph-state-buffer' };
  const thermoBuffer = { label: 'stage-test-sph-thermo-buffer' };
  const identityBuffer = { label: 'stage-test-sph-identity-buffer' };
  const schroederSpatialEpochGeneration = {
    schema: 'peercompute.ulg.schroeder-spatial-epoch-generation.v1',
    generationId: 43
  };
  let observedRunnerArgs = null;
  const materialInterfaceField = {
    schema: 'peercompute.ulg.sph-material-interface-field.v0',
    status: 'material-interface-field-ready',
    surfaceCount: 1,
    readySurfaceCount: 1,
    totalSurfaceAreaM2: 1,
    elementCount: 1,
    elements: [
      {
        status: 'interface-element-ready',
        surfaceIndex: 0,
        surfaceKey: 'h2o|liquid',
        material: 'h2o',
        phase: 'liquid',
        materialId: 1,
        phaseId: 2,
        axisId: 0,
        centroidM: [0.5, 1, 1],
        areaM2: 1,
        normalAreaVectorM2: [1, 0, 0]
      }
    ]
  };
  const result = await runSphPressureInterfaceStageComputeTask({
    modulePath: './sphMlsMpmGpuStep.js',
    computeTaskId: 'ulg:test:pressure-interface-stage-particle-forward',
    preferWebGpu: true,
    device: {
      createBuffer() {},
      queue: { writeBuffer() {} }
    },
    pressureInterfaceForceRowsWebGpuRunner(args) {
      observedRunnerArgs = args;
      return {
        backend: 'webgpu',
        status: 'pressure-interface-stage-solver-ready',
        executionSource: 'sphPressureInterfaceForceRowsWebGpu',
        readbackMode: 'no-full-readback',
        fullReadbackPerformed: false,
        normalHotLoopReadbackFree: true,
        queueCompletionStatus: 'queue-work-completed',
        queueCompletionMethod: 'queue.onSubmittedWorkDone',
        forceRowCount: 1,
        forceRowStrideFloats: SPH_PRESSURE_INTERFACE_FORCE_ROW_LAYOUT.length,
        forceRowByteLength: SPH_PRESSURE_INTERFACE_FORCE_ROW_LAYOUT.length * Float32Array.BYTES_PER_ELEMENT,
        forceRowValues: new Float32Array(),
        pressureInterfaceForceSolver: {
          schema: ULG_SPH_PRESSURE_INTERFACE_FORCE_SOLVER_SCHEMA,
          status: 'pressure-interface-force-solver-ready',
          backend: 'webgpu',
          forceApplicationStatus: 'solver-ready-not-applied',
          forceRowCount: 1,
          forceRowStrideFloats: SPH_PRESSURE_INTERFACE_FORCE_ROW_LAYOUT.length,
          forceRowValues: new Float32Array(),
          forceRowsBufferRetained: true,
          conservationStatus: 'pairwise-equal-opposite-force-conservative',
          conservationResidualMagnitudeN: 0,
          algorithmContactForceRowCount: null,
          maxAlgorithmContactPressurePa: null,
          interfaceContactKinematicsReadyCount: null,
          interfaceContactKinematicsDomainPairReadyCount: null,
          interfaceContactKinematicsGpuDerivationEligible: true,
          interfaceContactKinematicsGpuDerived: true,
          interfaceContactKinematicsDerivationStatus:
            'interface-contact-kinematics-spatial-exact-near-submitted',
          interfaceContactKinematicsParticleSourceStatus: 'interface-contact-kinematics-particle-source-ready',
          interfaceContactKinematicsParticleCount: 2,
          interfaceContactKinematicsParticleBinGridStatus:
            'suppressed-canonical-spatial-exact-near-selected',
          interfaceContactKinematicsParticleBinGridEnabled: false,
          interfaceContactKinematicsParticleBinGridCellCount: 0,
          interfaceContactKinematicsParticleBinGridBinCapacity: 0,
          interfaceContactKinematicsParticleBinGridAverageOccupancy: 0,
          interfaceContactKinematicsParticleBinGridEstimatedOverflowRisk: false,
          interfaceContactKinematicsParticleBinGridIndexBufferByteLength: 0,
          interfaceContactKinematicsParticleBinOverflowStatus: null,
          interfaceContactKinematicsParticleBinOverflowCount: null,
          schroederSpatialExactNearViewSchema:
            ULG_SCHROEDER_SPATIAL_EXACT_NEAR_VIEW_SCHEMA,
          schroederSpatialExactNearGenerationSupplied: true,
          schroederSpatialExactNearHostAdmissionStatus:
            'schroeder-spatial-exact-near-shared-generation-selected',
          schroederSpatialExactNearSelected: true,
          schroederSpatialExactNearBorrowedGeneration: true,
          schroederSpatialExactNearDirectoryOwnership:
            'borrowed-caller-owned-canonical-generation',
          schroederSpatialExactNearConsumerReleaseAuthority: 'generation-owner',
          schroederSpatialExactNearGpuQueryEvidenceRequired: true,
          schroederSpatialExactNearGpuQueryEvidenceSourceAdapterId:
            SCHROEDER_SPATIAL_SOURCE_ADAPTER_EXACT_NEAR_QUERY,
          schroederSpatialExactNearGpuQueryEvidenceEnforcementStatus:
            'shader-validates-query-tail-at-dispatch-no-host-readback',
          schroederSpatialExactNearArenaReleaseStatus:
            'borrowed-generation-release-owned-by-caller',
          schroederSpatialExactNearDirectoryBuildCount: 0,
          schroederSpatialExactNearPrivateParticleBinBuildSuppressed: true,
          schroederSpatialExactNearPrivateParticleBinBuildCount: 0,
          schroederSpatialExactNearFixedCandidateBuildCount: 0,
          schroederSpatialExactNearExhaustiveParticleScanCount: 0,
          schroederSpatialExactNearGpuFallbackObserved: null,
          pressureInterfaceSpatialIndexStatus:
            'pressure-interface-canonical-spatial-epoch-selected'
        }
      };
    },
    pressureFeedback: {
      schema: 'peercompute.ulg.sph-sealed-gas-pressure-feedback.v0',
      status: 'wall-pressure-ledger-ready',
      totalPressurePa: 120000
    },
    pressureInterfaceCoupling: {
      schema: 'peercompute.ulg.sph-pressure-interface-coupling.v0',
      status: 'pressure-interface-coupling-ready-for-solver',
      forceCouplingStatus: 'pressure-interface-coupling-ready'
    },
    materialInterfaceField,
    algorithmMaterialContactRows: algorithmContactRowsFixture({ normalStiffnessPa: 4e9 }),
    schroederSpatialEpochGeneration,
    sphParticleState: {
      schema: ULG_SPH_GPU_PARTICLE_BUFFER_SCHEMA,
      particleCount: 2,
      step: 4
    },
    sphParticleUpload: {
      schema: 'peercompute.ulg.test-sph-particle-upload.v0',
      status: 'webgpu-uploaded',
      particleCount: 2,
      stateBuffer,
      thermoBuffer,
      identityBuffer
    },
    boxDimsM: [4, 4, 4],
    contactKinematicsParticleBinMetadataReadback: true,
    readbackMode: 'no-full-readback',
    expectedOutputFamilies: ['pressure-interface-force-rows'],
    pressureInterfaceStageTask: true
  });

  assert.equal(observedRunnerArgs.sphParticleUpload.stateBuffer, stateBuffer);
  assert.equal(observedRunnerArgs.sphParticleUpload.thermoBuffer, thermoBuffer);
  assert.equal(observedRunnerArgs.particleStateBuffer, stateBuffer);
  assert.equal(observedRunnerArgs.particleThermoBuffer, thermoBuffer);
  assert.equal(observedRunnerArgs.particleIdentityBuffer, identityBuffer);
  assert.equal(
    observedRunnerArgs.schroederSpatialEpochGeneration,
    schroederSpatialEpochGeneration
  );
  assert.equal(observedRunnerArgs.particleCount, 2);
  assert.deepEqual(observedRunnerArgs.boxDimsM, [4, 4, 4]);
  assert.equal(observedRunnerArgs.contactKinematicsParticleBinMetadataReadback, true);
  assert.equal(result.interfaceContactKinematicsGpuDerived, true);
  assert.equal(result.pressureInterfaceStageTaskEvidence.interfaceContactKinematicsGpuDerived, true);
  assert.equal(
    result.pressureInterfaceStageTaskEvidence.interfaceContactKinematicsDerivationStatus,
    'interface-contact-kinematics-spatial-exact-near-submitted'
  );
  assert.equal(
    result.pressureInterfaceStageTaskEvidence.interfaceContactKinematicsParticleBinGridStatus,
    'suppressed-canonical-spatial-exact-near-selected'
  );
  assert.equal(result.pressureInterfaceStageTaskEvidence.interfaceContactKinematicsParticleBinGridEnabled, false);
  assert.equal(result.pressureInterfaceStageTaskEvidence.interfaceContactKinematicsParticleBinGridCellCount, 0);
  assert.equal(result.pressureInterfaceStageTaskEvidence.interfaceContactKinematicsParticleBinGridBinCapacity, 0);
  assert.equal(result.pressureInterfaceStageTaskEvidence.interfaceContactKinematicsParticleBinGridAverageOccupancy, 0);
  assert.equal(result.pressureInterfaceStageTaskEvidence.interfaceContactKinematicsParticleBinGridEstimatedOverflowRisk, false);
  assert.equal(result.pressureInterfaceStageTaskEvidence.interfaceContactKinematicsParticleBinGridIndexBufferByteLength, 0);
  assert.equal(result.pressureInterfaceStageTaskEvidence.interfaceContactKinematicsParticleBinOverflowStatus, null);
  assert.equal(result.pressureInterfaceStageTaskEvidence.interfaceContactKinematicsParticleBinOverflowCount, null);
  assert.equal(result.algorithmContactForceRowCount, null);
  assert.equal(result.maxAlgorithmContactPressurePa, null);
  assert.equal(result.interfaceContactKinematicsReadyCount, null);
  assert.equal(result.interfaceContactKinematicsDomainPairReadyCount, null);
  assert.equal(result.pressureInterfaceStageTaskEvidence.algorithmContactForceRowCount, null);
  assert.equal(result.pressureInterfaceStageTaskEvidence.maxAlgorithmContactPressurePa, null);
  assert.equal(result.pressureInterfaceStageTaskEvidence.interfaceContactKinematicsReadyCount, null);
  assert.equal(
    result.pressureInterfaceStageTaskEvidence.interfaceContactKinematicsDomainPairReadyCount,
    null
  );
  assert.equal(result.pressureInterfaceStageTaskEvidence.sharedSpatialGenerationRequired, true);
  assert.equal(result.pressureInterfaceStageTaskEvidence.sharedSpatialAuthorityPassed, true);
  assert.equal(result.gpuFence.required, true);
  assert.equal(result.gpuFence.fenceSatisfied, true);
  assert.equal(result.pressureInterfaceStageTaskAuthority.gpuFenceRequired, true);
});

test('SPH pressure interface stage rethrows supplied-generation WebGPU failures without CPU fallback', async () => {
  const webGpuFailure = new Error('shared spatial generation rejected by WebGPU runner');
  const schroederSpatialEpochGeneration = {
    schema: 'peercompute.ulg.schroeder-spatial-epoch-generation.v1',
    generationId: 47
  };
  let webGpuRunnerCalls = 0;
  let cpuFallbackCalls = 0;

  await assert.rejects(
    runSphPressureInterfaceStageComputeTask({
      computeTaskId: 'ulg:test:pressure-interface-stage-shared-generation-rejection',
      preferWebGpu: true,
      device: {
        createBuffer() {},
        queue: { writeBuffer() {} }
      },
      schroederSpatialEpochGeneration,
      pressureInterfaceForceRowsWebGpuRunner() {
        webGpuRunnerCalls += 1;
        throw webGpuFailure;
      },
      pressureInterfaceForceSolverRunner() {
        cpuFallbackCalls += 1;
        throw new Error('CPU fallback must not run for a supplied spatial generation');
      }
    }),
    (error) => error === webGpuFailure
  );

  assert.equal(webGpuRunnerCalls, 1);
  assert.equal(cpuFallbackCalls, 0);
});

test('SPH pressure interface stage refuses CPU fallback when a shared generation has no local WebGPU device', async () => {
  let cpuFallbackCalls = 0;
  await assert.rejects(
    runSphPressureInterfaceStageComputeTask({
      computeTaskId: 'ulg:test:pressure-interface-stage-shared-generation-no-device',
      preferWebGpu: true,
      navigatorRef: {},
      schroederSpatialEpochGeneration: {
        schema: 'peercompute.ulg.schroeder-spatial-epoch-generation.v1',
        generationId: 53
      },
      pressureInterfaceForceSolverRunner() {
        cpuFallbackCalls += 1;
        return null;
      }
    }),
    /cannot fall back without a local WebGPU device|webgpu|navigator/i
  );
  assert.equal(cpuFallbackCalls, 0);
});

test('SPH pressure interface stage rejects incomplete shared-generation WebGPU results without CPU fallback', async () => {
  const invalidResults = [
    ['null result', null, /requires a valid local WebGPU pressure\/interface solver result/],
    ['missing solver', { backend: 'webgpu' }, /requires a valid local WebGPU pressure\/interface solver result/],
    ['wrong backend', {
      backend: 'cpu-reference',
      pressureInterfaceForceSolver: {
        schema: ULG_SPH_PRESSURE_INTERFACE_FORCE_SOLVER_SCHEMA
      }
    }, /requires a valid local WebGPU pressure\/interface solver result/],
    ['blocked solver', {
      backend: 'webgpu',
      pressureInterfaceForceSolver: {
        schema: ULG_SPH_PRESSURE_INTERFACE_FORCE_SOLVER_SCHEMA,
        status: 'pressure-interface-force-solver-blocked'
      }
    }, /requires a valid local WebGPU pressure\/interface solver result/],
    ['ready solver without force-row evidence', {
      backend: 'webgpu',
      status: 'pressure-interface-stage-solver-ready',
      forceRowCount: 1,
      forceRowStrideFloats: SPH_PRESSURE_INTERFACE_FORCE_ROW_LAYOUT.length,
      forceRowByteLength:
        SPH_PRESSURE_INTERFACE_FORCE_ROW_LAYOUT.length * Float32Array.BYTES_PER_ELEMENT,
      pressureInterfaceForceSolver: {
        schema: ULG_SPH_PRESSURE_INTERFACE_FORCE_SOLVER_SCHEMA,
        status: 'pressure-interface-force-solver-ready',
        backend: 'webgpu',
        ...sharedSpatialPressureSolverAuthorityFixture(),
        forceRowCount: 1,
        forceRowStrideFloats: SPH_PRESSURE_INTERFACE_FORCE_ROW_LAYOUT.length,
        forceRowValues: new Float32Array(0)
      }
    }, /requires complete WebGPU pressure\/interface force-row/],
    ['blocked top-level status', {
      backend: 'webgpu',
      status: 'pressure-interface-stage-solver-blocked',
      pressureInterfaceForceSolver: {
        schema: ULG_SPH_PRESSURE_INTERFACE_FORCE_SOLVER_SCHEMA,
        status: 'pressure-interface-force-solver-ready',
        backend: 'webgpu'
      }
    }, /requires a valid local WebGPU pressure\/interface solver result/],
    ['nested CPU solver backend', {
      backend: 'webgpu',
      status: 'pressure-interface-stage-solver-ready',
      pressureInterfaceForceSolver: {
        schema: ULG_SPH_PRESSURE_INTERFACE_FORCE_SOLVER_SCHEMA,
        status: 'pressure-interface-force-solver-ready',
        backend: 'cpu-reference'
      }
    }, /requires a valid local WebGPU pressure\/interface solver result/],
    ['missing shared-generation authority', {
      backend: 'webgpu',
      status: 'pressure-interface-stage-solver-ready',
      forceRowCount: 1,
      forceRowStrideFloats: SPH_PRESSURE_INTERFACE_FORCE_ROW_LAYOUT.length,
      forceRowByteLength:
        SPH_PRESSURE_INTERFACE_FORCE_ROW_LAYOUT.length * Float32Array.BYTES_PER_ELEMENT,
      pressureInterfaceForceSolver: {
        schema: ULG_SPH_PRESSURE_INTERFACE_FORCE_SOLVER_SCHEMA,
        status: 'pressure-interface-force-solver-ready',
        backend: 'webgpu',
        forceRowCount: 1,
        forceRowStrideFloats: SPH_PRESSURE_INTERFACE_FORCE_ROW_LAYOUT.length,
        forceRowValues: new Float32Array(
          SPH_PRESSURE_INTERFACE_FORCE_ROW_LAYOUT.length
        )
      }
    }, /requires exact-near borrowed-generation authority/],
    ['private lookup authority', {
      backend: 'webgpu',
      status: 'pressure-interface-stage-solver-ready',
      forceRowCount: 1,
      forceRowStrideFloats: SPH_PRESSURE_INTERFACE_FORCE_ROW_LAYOUT.length,
      forceRowByteLength:
        SPH_PRESSURE_INTERFACE_FORCE_ROW_LAYOUT.length * Float32Array.BYTES_PER_ELEMENT,
      pressureInterfaceForceSolver: {
        schema: ULG_SPH_PRESSURE_INTERFACE_FORCE_SOLVER_SCHEMA,
        status: 'pressure-interface-force-solver-ready',
        backend: 'webgpu',
        ...sharedSpatialPressureSolverAuthorityFixture({
          schroederSpatialExactNearPrivateParticleBinBuildSuppressed: false,
          schroederSpatialExactNearPrivateParticleBinBuildCount: 1
        }),
        forceRowCount: 1,
        forceRowStrideFloats: SPH_PRESSURE_INTERFACE_FORCE_ROW_LAYOUT.length,
        forceRowValues: new Float32Array(
          SPH_PRESSURE_INTERFACE_FORCE_ROW_LAYOUT.length
        )
      }
    }, /requires exact-near borrowed-generation authority/],
    ['contradictory selected authority', {
      backend: 'webgpu',
      status: 'pressure-interface-stage-solver-ready',
      forceRowCount: 1,
      forceRowStrideFloats: SPH_PRESSURE_INTERFACE_FORCE_ROW_LAYOUT.length,
      forceRowByteLength:
        SPH_PRESSURE_INTERFACE_FORCE_ROW_LAYOUT.length * Float32Array.BYTES_PER_ELEMENT,
      pressureInterfaceForceSolver: {
        schema: ULG_SPH_PRESSURE_INTERFACE_FORCE_SOLVER_SCHEMA,
        status: 'pressure-interface-force-solver-ready',
        backend: 'webgpu',
        ...sharedSpatialPressureSolverAuthorityFixture({
          schroederSpatialExactNearSelected: false
        }),
        forceRowCount: 1,
        forceRowStrideFloats: SPH_PRESSURE_INTERFACE_FORCE_ROW_LAYOUT.length,
        forceRowValues: new Float32Array(
          SPH_PRESSURE_INTERFACE_FORCE_ROW_LAYOUT.length
        )
      }
    }, /requires exact-near borrowed-generation authority/]
  ];
  for (const [name, invalidResult, expectedError] of invalidResults) {
    let cpuFallbackCalls = 0;
    const cleanupCalls = {
      temporary: 0,
      forceRows: 0,
      gasRows: 0
    };
    const invalidResultWithCleanup = invalidResult && {
      ...invalidResult,
      destroyOwnerScopeTemporaryBuffers() {
        cleanupCalls.temporary += 1;
      },
      destroyForceRowsBuffer() {
        cleanupCalls.forceRows += 1;
      },
      destroyGasPressureCellsBuffer() {
        cleanupCalls.gasRows += 1;
      }
    };
    await assert.rejects(
      runSphPressureInterfaceStageComputeTask({
        computeTaskId: `ulg:test:pressure-interface-stage-invalid-shared-result:${name}`,
        preferWebGpu: true,
        device: {
          createBuffer() {},
          queue: { writeBuffer() {} }
        },
        schroederSpatialEpochGeneration: {
          schema: 'peercompute.ulg.schroeder-spatial-epoch-generation.v1',
          generationId: 59
        },
        pressureInterfaceForceRowsWebGpuRunner() {
          return invalidResultWithCleanup;
        },
        pressureInterfaceForceSolverRunner() {
          cpuFallbackCalls += 1;
          return null;
        }
      }),
      expectedError,
      name
    );
    assert.equal(cpuFallbackCalls, 0, name);
    if (invalidResultWithCleanup) {
      assert.deepEqual(cleanupCalls, {
        temporary: 1,
        forceRows: 1,
        gasRows: 1
      }, name);
    }
  }
});

test('SPH pressure interface stage preserves malformed falsy supplied generations and never CPU-falls back', async () => {
  for (const malformedGeneration of [false, 0, '']) {
    const webGpuFailure = new Error(
      `malformed supplied generation reached WebGPU runner: ${String(malformedGeneration)}`
    );
    let observedGeneration = Symbol('not-observed');
    let cpuFallbackCalls = 0;
    await assert.rejects(
      runSphPressureInterfaceStageComputeTask({
        computeTaskId: 'ulg:test:pressure-interface-stage-malformed-falsy-shared-generation',
        preferWebGpu: true,
        device: {
          createBuffer() {},
          queue: { writeBuffer() {} }
        },
        schroederSpatialEpochGeneration: malformedGeneration,
        pressureInterfaceForceRowsWebGpuRunner(args) {
          observedGeneration = args.schroederSpatialEpochGeneration;
          throw webGpuFailure;
        },
        pressureInterfaceForceSolverRunner() {
          cpuFallbackCalls += 1;
          return null;
        }
      }),
      (error) => error === webGpuFailure
    );
    assert.equal(observedGeneration, malformedGeneration);
    assert.equal(cpuFallbackCalls, 0);
  }
});

test('SPH pressure interface stage rejects supplied-generation results without the required queue fence', async () => {
  let cpuFallbackCalls = 0;
  await assert.rejects(
    runSphPressureInterfaceStageComputeTask({
      computeTaskId: 'ulg:test:pressure-interface-stage-shared-generation-unsatisfied-fence',
      preferWebGpu: true,
      device: {
        createBuffer() {},
        queue: { writeBuffer() {} }
      },
      gpuFenceRequirement: {
        required: true,
        laneId: 'ulg:test:shared-generation-lane',
        stateKey: 'ulg:test:shared-generation-state'
      },
      schroederSpatialEpochGeneration: {
        schema: 'peercompute.ulg.schroeder-spatial-epoch-generation.v1',
        generationId: 67
      },
      pressureInterfaceForceRowsWebGpuRunner() {
        return {
          backend: 'webgpu',
          status: 'pressure-interface-stage-solver-ready',
          readbackMode: 'no-full-readback',
          fullReadbackPerformed: false,
          queueCompletionStatus: 'queue-submitted-cleanup-deferred',
          forceRowCount: 1,
          forceRowStrideFloats: SPH_PRESSURE_INTERFACE_FORCE_ROW_LAYOUT.length,
          forceRowByteLength:
            SPH_PRESSURE_INTERFACE_FORCE_ROW_LAYOUT.length * Float32Array.BYTES_PER_ELEMENT,
          pressureInterfaceForceSolver: {
            schema: ULG_SPH_PRESSURE_INTERFACE_FORCE_SOLVER_SCHEMA,
            status: 'pressure-interface-force-solver-ready',
            backend: 'webgpu',
            ...sharedSpatialPressureSolverAuthorityFixture(),
            forceRowCount: 1,
            forceRowStrideFloats: SPH_PRESSURE_INTERFACE_FORCE_ROW_LAYOUT.length,
            forceRowValues: new Float32Array(
              SPH_PRESSURE_INTERFACE_FORCE_ROW_LAYOUT.length
            )
          }
        };
      },
      pressureInterfaceForceSolverRunner() {
        cpuFallbackCalls += 1;
        return null;
      }
    }),
    /requires complete WebGPU pressure\/interface force-row and queue-fence evidence/
  );
  assert.equal(cpuFallbackCalls, 0);
});

test('SPH pressure interface stage requires admission before consuming local gas-cell pressure fields', async () => {
  const materialInterfaceField = {
    schema: 'peercompute.ulg.sph-material-interface-field.v0',
    status: 'material-interface-field-ready',
    surfaceCount: 1,
    readySurfaceCount: 1,
    totalSurfaceAreaM2: 2,
    elementCount: 2,
    elements: [
      {
        status: 'interface-element-ready',
        surfaceIndex: 0,
        surfaceKey: 'h2o|liquid',
        material: 'h2o',
        phase: 'liquid',
        materialId: 1,
        phaseId: 2,
        axisId: 0,
        centroidM: [0.5, 1, 1],
        areaM2: 1,
        normalAreaVectorM2: [1, 0, 0]
      },
      {
        status: 'interface-element-ready',
        surfaceIndex: 0,
        surfaceKey: 'h2o|liquid',
        material: 'h2o',
        phase: 'liquid',
        materialId: 1,
        phaseId: 2,
        axisId: 0,
        centroidM: [1.5, 1, 1],
        areaM2: 1,
        normalAreaVectorM2: [-1, 0, 0]
      }
    ]
  };
  const gasPressureSummary = {
    schema: 'peercompute.ulg.sph-sealed-gas-pressure-summary.v0',
    status: 'synthetic-pressure',
    totalPressurePa: 120000,
    boxVolumeM3: 8,
    boxDimsM: [2, 2, 2],
    bySpecies: {},
    strictReactionGate: { status: 'strict-reaction-gate-pass', blockers: [] },
    gasCellField: {
      localPressureGradientReady: true,
      cellDims: [2, 1, 1],
      cells: [
        {
          gridIndex: [0, 0, 0],
          centerM: [0.5, 1, 1],
          pressurePa: 120000,
          pressureGradientPaPerM: [0, 0, 0],
          volumeM3: 4
        },
        {
          gridIndex: [1, 0, 0],
          centerM: [1.5, 1, 1],
          pressurePa: 180000,
          pressureGradientPaPerM: [0, 0, 0],
          volumeM3: 4
        }
      ]
    }
  };

  const result = await runSphPressureInterfaceStageComputeTask({
    computeTaskId: 'ulg:test:pressure-interface-stage-local-gas-blocked',
    preferWebGpu: false,
    readbackMode: 'no-full-readback',
    gasPressureSummary,
    materialInterfaceField,
    expectedOutputFamilies: ['pressure-interface-force-rows'],
    pressureInterfaceStageTask: true
  });

  assert.equal(result.status, 'pressure-interface-stage-solver-ready');
  assert.equal(result.pressureInterfaceForceSolver.pressureFieldMode, 'local-gas-cell-pressure-gradient');
  assert.equal(result.pressureInterfaceForceSolver.localPressureGradientReady, true);
  assert.equal(result.pressureInterfaceGasCellFieldAdmissionStatus, 'pressure-interface-gas-cell-field-admission-required');
  assert.equal(result.pressureInterfaceGasCellFieldAdmissionApproved, false);
  assert.equal(result.pressureInterfaceGasCellFieldConsumerStatus, 'blocked-local-gas-cell-field-admission-required');
  assert.equal(result.pressureInterfaceStageTaskEvidence.pressureInterfaceGasCellFieldAdmissionStatus, 'pressure-interface-gas-cell-field-admission-required');
  assert.equal(result.pressureInterfaceStageTaskEvidence.pressureInterfaceGasCellFieldAdmissionApproved, false);
  assert.equal(result.pressureInterfaceStageTaskAuthority.pressureInterfaceGasCellFieldAdmissionRequired, true);
  assert.equal(result.pressureInterfaceStageTaskAuthority.pressureInterfaceGasCellFieldAdmissionApproved, false);
});

test('SPH pressure interface stage retains interface source-key descriptors', () => {
  const materialInterfaceField = {
    schema: 'peercompute.ulg.sph-material-interface-field.v0',
    status: 'material-interface-field-ready',
    readySurfaceCount: 1,
    totalSurfaceAreaM2: 1,
    elements: [],
    interfaceSourceKeySchema: 'peercompute.ulg.sph-interface-source-key.v0',
    interfaceSourceKeyStatus: 'interface-source-key-retained',
    interfaceSourceKeyBuffer: { label: 'retained-interface-source-key-buffer' },
    interfaceSourceKeyBufferRetained: true,
    interfaceSourceKeyRowCount: 2,
    interfaceSourceKeyReadyCount: 2,
    interfaceSourceKeyStrideFloats: 4,
    interfaceSourceKeySurfaceIndexFallbackEnabled: false
  };

  const task = createSphPressureInterfaceStageComputeTask({
    modulePath: './sphMlsMpmGpuStep.js',
    taskId: 'ulg:test:pressure-interface-stage-source-key-ref',
    preferWebGpu: true,
    readbackMode: 'no-full-readback',
    gasPressureSummary: {
      schema: 'peercompute.ulg.sph-sealed-gas-pressure-summary.v0',
      status: 'synthetic-pressure',
      totalPressurePa: 120000,
      boxVolumeM3: 8,
      boxDimsM: [2, 2, 2],
      bySpecies: {}
    },
    materialInterfaceField
  });

  assert.deepEqual(task.webgpu.retainedBufferRefs, [
    'pressure-interface-force-rows-buffer',
    'sph-interface-source-key-buffer'
  ]);
  assert.deepEqual(task.gpuFence.retainedBufferRefs, [
    'pressure-interface-force-rows-buffer',
    'sph-interface-source-key-buffer'
  ]);
  assert.deepEqual(task.gpuResidentLane.retainedBufferRefs, [
    'pressure-interface-force-rows-buffer',
    'sph-interface-source-key-buffer'
  ]);
  assert.deepEqual(task.data.gpuFenceRequirement.retainedBufferRefs, [
    'pressure-interface-force-rows-buffer',
    'sph-interface-source-key-buffer'
  ]);
  assert.equal(task.portableReplayDescriptorOnly, true);
  assert.equal(task.portableReplayInputDescriptors.length, 1);
  assert.equal(
    task.portableReplayInputDescriptors[0].schema,
    ULG_SPH_PRESSURE_INTERFACE_SOURCE_KEY_REPLAY_DESCRIPTOR_SCHEMA
  );
  assert.equal(
    task.portableReplayInputDescriptors[0].status,
    'pressure-interface-source-key-replay-descriptor-ready'
  );
  assert.deepEqual(task.portableReplayInputDescriptors[0].retainedBufferRefs, [
    'sph-interface-source-key-buffer'
  ]);
  assert.equal(task.portableReplayInputDescriptors[0].rawGpuBufferSerialized, false);
  assert.equal(task.data.pressureInterfaceSourceKeyReplayDescriptor.rawGpuBufferSerialized, false);
  const portableReplayPayload = JSON.stringify(task.portableReplayInputDescriptors);
  assert.match(portableReplayPayload, /sph-interface-source-key-buffer/);
  assert.doesNotMatch(portableReplayPayload, /retained-interface-source-key-buffer/);
  assert.equal(Object.hasOwn(task.portableReplayInputDescriptors[0], 'interfaceSourceKeyBuffer'), false);
});

test('SPH pressure interface stage records admitted local gas-cell pressure field consumption', async () => {
  const materialInterfaceField = {
    schema: 'peercompute.ulg.sph-material-interface-field.v0',
    status: 'material-interface-field-ready',
    surfaceCount: 1,
    readySurfaceCount: 1,
    totalSurfaceAreaM2: 1,
    elementCount: 1,
    elements: [
      {
        status: 'interface-element-ready',
        surfaceIndex: 0,
        surfaceKey: 'h2o|liquid',
        material: 'h2o',
        phase: 'liquid',
        materialId: 1,
        phaseId: 2,
        axisId: 0,
        centroidM: [0.5, 1, 1],
        areaM2: 1,
        normalAreaVectorM2: [1, 0, 0]
      }
    ]
  };
  const gasPressureSummary = {
    schema: 'peercompute.ulg.sph-sealed-gas-pressure-summary.v0',
    status: 'synthetic-pressure',
    totalPressurePa: 120000,
    boxVolumeM3: 8,
    boxDimsM: [2, 2, 2],
    bySpecies: {},
    strictReactionGate: { status: 'strict-reaction-gate-pass', blockers: [] },
    gasCellField: {
      localPressureGradientReady: true,
      cellDims: [1, 1, 1],
      cells: [
        {
          gridIndex: [0, 0, 0],
          centerM: [0.5, 1, 1],
          pressurePa: 120000,
          pressureGradientPaPerM: [0, 0, 0],
          volumeM3: 8
        }
      ]
    }
  };
  const pressureInterfaceGasCellFieldAdmission = {
    schema: ULG_PRESSURE_INTERFACE_GAS_CELL_FIELD_ADMISSION_SCHEMA,
    status: 'pressure-interface-gas-cell-field-consumption-approved',
    gasCellFieldConsumptionApproved: true,
    sourceHotBufferKey: 'ulg:test:gas-cell-hot-buffer',
    retainedGasPressureBufferRefs: ['resident-gas-pressure-cells-buffer']
  };

  const result = await runSphPressureInterfaceStageComputeTask({
    computeTaskId: 'ulg:test:pressure-interface-stage-local-gas-admitted',
    preferWebGpu: false,
    readbackMode: 'no-full-readback',
    gasPressureSummary,
    materialInterfaceField,
    pressureInterfaceGasCellFieldAdmission,
    expectedOutputFamilies: ['pressure-interface-force-rows'],
    pressureInterfaceStageTask: true
  });

  assert.equal(result.status, 'pressure-interface-stage-solver-ready');
  assert.equal(result.pressureInterfaceForceSolver.pressureFieldMode, 'local-gas-cell-pressure-gradient');
  assert.equal(result.pressureInterfaceGasCellFieldAdmissionSchema, ULG_PRESSURE_INTERFACE_GAS_CELL_FIELD_ADMISSION_SCHEMA);
  assert.equal(result.pressureInterfaceGasCellFieldAdmissionStatus, 'pressure-interface-gas-cell-field-consumption-approved');
  assert.equal(result.pressureInterfaceGasCellFieldAdmissionApproved, true);
  assert.equal(result.pressureInterfaceGasCellFieldConsumerStatus, 'admitted-local-gas-cell-field-consumer-ready');
  assert.equal(result.pressureInterfaceStageTaskEvidence.pressureInterfaceGasCellFieldAdmissionApproved, true);
  assert.equal(result.pressureInterfaceStageTaskAuthority.pressureInterfaceGasCellFieldAdmissionRequired, true);
  assert.equal(result.pressureInterfaceStageTaskAuthority.pressureInterfaceGasCellFieldAdmissionApproved, true);
});

test('SPH pressure interface stage consumes an admitted retained gas-cell field import', async () => {
  const materialInterfaceField = {
    schema: 'peercompute.ulg.sph-material-interface-field.v0',
    status: 'material-interface-field-ready',
    surfaceCount: 1,
    readySurfaceCount: 1,
    totalSurfaceAreaM2: 2,
    elementCount: 2,
    elements: [
      {
        status: 'interface-element-ready',
        surfaceIndex: 0,
        surfaceKey: 'h2o|liquid',
        material: 'h2o',
        phase: 'liquid',
        materialId: 1,
        phaseId: 2,
        axisId: 0,
        centroidM: [0.5, 1, 1],
        areaM2: 1,
        normalAreaVectorM2: [1, 0, 0]
      },
      {
        status: 'interface-element-ready',
        surfaceIndex: 0,
        surfaceKey: 'h2o|liquid',
        material: 'h2o',
        phase: 'liquid',
        materialId: 1,
        phaseId: 2,
        axisId: 0,
        centroidM: [1.5, 1, 1],
        areaM2: 1,
        normalAreaVectorM2: [-1, 0, 0]
      }
    ]
  };
  const gasPressureSummary = {
    schema: 'peercompute.ulg.sph-sealed-gas-pressure-summary.v0',
    status: 'synthetic-pressure',
    totalPressurePa: 120000,
    boxVolumeM3: 8,
    boxDimsM: [2, 2, 2],
    bySpecies: {},
    strictReactionGate: { status: 'strict-reaction-gate-pass', blockers: [] }
  };
  const pressureInterfaceGasCellFieldAdmission = {
    schema: ULG_PRESSURE_INTERFACE_GAS_CELL_FIELD_ADMISSION_SCHEMA,
    status: 'pressure-interface-gas-cell-field-consumption-approved',
    gasCellFieldConsumptionApproved: true,
    sourceHotBufferKey: 'ulg:test:gas-cell-import-hot-buffer',
    retainedGasPressureBufferRefs: ['resident-gas-pressure-cells-buffer']
  };
  const pressureInterfaceGasCellFieldImport = {
    schema: ULG_PRESSURE_INTERFACE_GAS_CELL_FIELD_IMPORT_SCHEMA,
    status: 'pressure-interface-gas-cell-field-import-ready',
    sourceHotBufferKey: 'ulg:test:gas-cell-import-hot-buffer',
    retainedGasPressureBufferRefs: ['resident-gas-pressure-cells-buffer'],
    pressureInterfaceGasCellFieldAdmission,
    gasCellFieldSnapshot: {
      localPressureGradientReady: true,
      cellDims: [2, 1, 1],
      cells: [
        {
          gridIndex: [0, 0, 0],
          centerM: [0.5, 1, 1],
          pressurePa: 120000,
          pressureGradientPaPerM: [0, 0, 0],
          volumeM3: 4
        },
        {
          gridIndex: [1, 0, 0],
          centerM: [1.5, 1, 1],
          pressurePa: 180000,
          pressureGradientPaPerM: [0, 0, 0],
          volumeM3: 4
        }
      ]
    }
  };

  const result = await runSphPressureInterfaceStageComputeTask({
    computeTaskId: 'ulg:test:pressure-interface-stage-local-gas-import',
    preferWebGpu: false,
    readbackMode: 'no-full-readback',
    gasPressureSummary,
    materialInterfaceField,
    pressureInterfaceGasCellFieldImport,
    expectedOutputFamilies: ['pressure-interface-force-rows'],
    pressureInterfaceStageTask: true
  });

  assert.equal(result.status, 'pressure-interface-stage-solver-ready');
  assert.equal(result.pressureInterfaceForceSolver.pressureFieldMode, 'local-gas-cell-pressure-gradient');
  assert.equal(result.pressureInterfaceForceSolver.localPressureGradientReady, true);
  assert.equal(result.pressureInterfaceForceSolver.gasInterfacePressureReferencePa, 101325);
  assert.deepEqual(result.pressureInterfaceForceSolver.gasInterfacePressureRangePa, [18675, 78675]);
  assert.equal(result.pressureInterfaceGasCellFieldAdmissionApproved, true);
  assert.equal(result.pressureInterfaceGasCellFieldImportSchema, ULG_PRESSURE_INTERFACE_GAS_CELL_FIELD_IMPORT_SCHEMA);
  assert.equal(result.pressureInterfaceGasCellFieldImportStatus, 'pressure-interface-gas-cell-field-import-ready');
  assert.equal(result.pressureInterfaceGasCellFieldImportReady, true);
  assert.equal(result.pressureInterfaceGasCellFieldImportSourceHotBufferKey, 'ulg:test:gas-cell-import-hot-buffer');
  assert.deepEqual(result.pressureInterfaceGasCellFieldImportRetainedGasPressureBufferRefs, ['resident-gas-pressure-cells-buffer']);
  assert.equal(result.pressureInterfaceStageTaskEvidence.pressureInterfaceGasCellFieldImportReady, true);
  assert.equal(result.pressureInterfaceStageTaskEvidence.pressureInterfaceGasCellFieldImportSourceHotBufferKey, 'ulg:test:gas-cell-import-hot-buffer');
  assert.equal(result.pressureInterfaceStageTaskAuthority.pressureInterfaceGasCellFieldImportReady, true);
});

test('SPH pressure interface stage declares retained gas-cell buffers for local imports', () => {
  const pressureInterfaceGasCellFieldAdmission = {
    schema: ULG_PRESSURE_INTERFACE_GAS_CELL_FIELD_ADMISSION_SCHEMA,
    status: 'pressure-interface-gas-cell-field-consumption-approved',
    gasCellFieldConsumptionApproved: true,
    sourceHotBufferKey: 'ulg:test:gas-cell-import-hot-buffer',
    retainedGasPressureBufferRefs: ['resident-gas-pressure-cells-buffer']
  };
  const pressureInterfaceGasCellFieldImport = {
    schema: ULG_PRESSURE_INTERFACE_GAS_CELL_FIELD_IMPORT_SCHEMA,
    status: 'pressure-interface-gas-cell-field-import-ready',
    sourceHotBufferKey: 'ulg:test:gas-cell-import-hot-buffer',
    retainedGasPressureBufferRefs: ['resident-gas-pressure-cells-buffer'],
    pressureInterfaceGasCellFieldAdmission,
    gasCellFieldSnapshot: {
      localPressureGradientReady: true,
      cellDims: [2, 1, 1],
      cells: [
        {
          gridIndex: [0, 0, 0],
          centerM: [0.5, 1, 1],
          pressurePa: 120000,
          pressureGradientPaPerM: [0, 0, 0],
          volumeM3: 4
        },
        {
          gridIndex: [1, 0, 0],
          centerM: [1.5, 1, 1],
          pressurePa: 180000,
          pressureGradientPaPerM: [0, 0, 0],
          volumeM3: 4
        }
      ]
    }
  };

  const task = createSphPressureInterfaceStageComputeTask({
    modulePath: './sphMlsMpmGpuStep.js',
    taskId: 'ulg:test:pressure-interface-stage-local-gas-import-retained-refs',
    preferWebGpu: true,
    readbackMode: 'no-full-readback',
    pressureInterfaceGasCellFieldImport,
    materialInterfaceField: {
      schema: 'peercompute.ulg.sph-material-interface-field.v0',
      status: 'material-interface-field-ready',
      readySurfaceCount: 1,
      totalSurfaceAreaM2: 1,
      elements: []
    }
  });

  assert.deepEqual(task.webgpu.retainedBufferRefs, [
    'pressure-interface-force-rows-buffer',
    'resident-gas-pressure-cells-buffer'
  ]);
  assert.deepEqual(task.gpuFence.retainedBufferRefs, [
    'pressure-interface-force-rows-buffer',
    'resident-gas-pressure-cells-buffer'
  ]);
  assert.deepEqual(task.gpuResidentLane.retainedBufferRefs, [
    'pressure-interface-force-rows-buffer',
    'resident-gas-pressure-cells-buffer'
  ]);
  assert.deepEqual(task.data.gpuFenceRequirement.retainedBufferRefs, [
    'pressure-interface-force-rows-buffer',
    'resident-gas-pressure-cells-buffer'
  ]);
});

test('SPH pressure interface stage consumes retained Schroeder gas-cell rows without snapshot upload', async () => {
  const device = fakeSummaryDevice(new Float32Array(2 * SPH_PRESSURE_INTERFACE_FORCE_ROW_LAYOUT.length));
  const retainedGasPressureCellsBuffer = device.createBuffer({
    label: 'retained-schroeder-gas-pressure-cells',
    size: 2 * SCHROEDER_FAR_AGGREGATE_GAS_CELL_IMPORT_ROW_LAYOUT.length * Float32Array.BYTES_PER_ELEMENT,
    usage: 0
  });
  const schroederGasCellImport = {
    schema: ULG_SCHROEDER_FAR_AGGREGATE_GAS_CELL_IMPORT_EXECUTION_SCHEMA,
    status: 'schroeder-far-aggregate-gas-cell-import-submitted',
    pressureInterfaceImportReady: true,
    gasPressureCellRowCount: 2,
    pressureInterfaceGasPressureCellRowCount: 2,
    gasPressureCellRowStrideFloats: SCHROEDER_FAR_AGGREGATE_GAS_CELL_IMPORT_ROW_LAYOUT.length,
    pressureInterfaceGasPressureCellRowStrideFloats: SCHROEDER_FAR_AGGREGATE_GAS_CELL_IMPORT_ROW_LAYOUT.length,
    gasPressureCellRowByteLength:
      2 * SCHROEDER_FAR_AGGREGATE_GAS_CELL_IMPORT_ROW_LAYOUT.length * Float32Array.BYTES_PER_ELEMENT,
    pressureInterfaceGasPressureCellRowByteLength:
      2 * SCHROEDER_FAR_AGGREGATE_GAS_CELL_IMPORT_ROW_LAYOUT.length * Float32Array.BYTES_PER_ELEMENT,
    gasPressureCellsBuffer: retainedGasPressureCellsBuffer,
    pressureInterfaceGasPressureCellsBuffer: retainedGasPressureCellsBuffer,
    gasPressureCellRowsBufferRetained: true,
    pressureInterfaceGasPressureCellRowsBufferRetained: true,
    pressureFieldMode: 'local-gas-cell-pressure-gradient',
    pressureFieldResolution: 'structured-gas-cell-grid',
    localPressureGradientStatus: 'retained-gpu-gas-cell-rows-ready-cpu-snapshot-not-read',
    retainedGasPressureBufferRefs: ['resident-gas-pressure-cells-buffer'],
    retainedGasCellFieldSourceReady: true,
    retainedGasCellFieldSource: {
      schema: ULG_PRESSURE_INTERFACE_RETAINED_GAS_CELL_FIELD_SOURCE_SCHEMA,
      status: 'pressure-interface-retained-gas-cell-field-source-ready',
      sourceStage: 'schroederFarAggregateGasCellImport',
      retainedGasPressureBufferRefs: ['resident-gas-pressure-cells-buffer'],
      workerRetainedGasPressureBufferRefs: [],
      pressureInterfaceGasPressureCellRowCount: 2,
      pressureInterfaceGasPressureCellRowStrideFloats: SCHROEDER_FAR_AGGREGATE_GAS_CELL_IMPORT_ROW_LAYOUT.length,
      pressureInterfaceGasPressureCellRowByteLength:
        2 * SCHROEDER_FAR_AGGREGATE_GAS_CELL_IMPORT_ROW_LAYOUT.length * Float32Array.BYTES_PER_ELEMENT,
      pressureInterfaceGasPressureCellRowsBufferRetained: true,
      pressureFieldMode: 'local-gas-cell-pressure-gradient',
      pressureFieldResolution: 'structured-gas-cell-grid',
      sourceFamilies: ['resident-gas-pressure'],
      consumerAccessProtocol: 'same-device-retained-buffer-ref',
      stateManagerAdmissionRequired: true
    }
  };
  const materialInterfaceField = {
    schema: 'peercompute.ulg.sph-material-interface-field.v0',
    status: 'material-interface-field-ready',
    readySurfaceCount: 2,
    surfaceCount: 2,
    totalSurfaceAreaM2: 2,
    elementCount: 2,
    elements: [
      {
        status: 'interface-element-ready',
        surfaceIndex: 0,
        surfaceKey: 'h2o|liquid',
        material: 'h2o',
        phase: 'liquid',
        materialId: 1,
        phaseId: 2,
        axisId: 0,
        centroidM: [0.5, 1, 1],
        areaM2: 1,
        normalAreaVectorM2: [1, 0, 0]
      },
      {
        status: 'interface-element-ready',
        surfaceIndex: 1,
        surfaceKey: 'h2o|liquid',
        material: 'h2o',
        phase: 'liquid',
        materialId: 1,
        phaseId: 2,
        axisId: 0,
        centroidM: [1.5, 1, 1],
        areaM2: 1,
        normalAreaVectorM2: [-1, 0, 0]
      }
    ]
  };

  const task = createSphPressureInterfaceStageComputeTask({
    modulePath: './sphMlsMpmGpuStep.js',
    taskId: 'ulg:test:pressure-interface-stage-schroeder-gas-cells',
    preferWebGpu: true,
    readbackMode: 'no-full-readback',
    pressureInterfaceGasCellFieldImport: schroederGasCellImport,
    materialInterfaceField
  });
  assert.ok(task.webgpu.retainedBufferRefs.includes('resident-gas-pressure-cells-buffer'));

  const result = await runSphPressureInterfaceStageComputeTask({
    computeTaskId: 'ulg:test:pressure-interface-stage-schroeder-gas-cells',
    preferWebGpu: true,
    readbackMode: 'no-full-readback',
    device,
    gasPressureSummary: {
      schema: 'peercompute.ulg.sph-sealed-gas-pressure-summary.v0',
      status: 'schroeder-retained-gas-cell-pressure-summary',
      totalPressurePa: 0,
      boxVolumeM3: 8,
      boxDimsM: [2, 2, 2],
      bySpecies: {},
      strictReactionGate: { status: 'strict-reaction-gate-pass', blockers: [] }
    },
    materialInterfaceField,
    pressureInterfaceGasCellFieldImport: schroederGasCellImport,
    expectedOutputFamilies: ['pressure-interface-force-rows'],
    pressureInterfaceStageTask: true
  });

  assert.equal(result.backend, 'webgpu');
  assert.equal(result.status, 'pressure-interface-stage-solver-ready');
  assert.equal(result.pressureInterfaceGasCellFieldImportReady, true);
  assert.equal(result.pressureInterfaceGasCellFieldImportRetainedLocalPressureGradientReady, true);
  assert.equal(result.pressureInterfaceGasCellFieldImportRetainedGasPressureCellsBuffer, true);
  assert.equal(result.pressureInterfaceGasCellFieldAdmissionApproved, true);
  assert.equal(result.pressureInterfaceGasCellFieldConsumerStatus, 'admitted-local-gas-cell-field-consumer-ready');
  assert.equal(result.pressureInterfaceForceSolver.pressureFieldMode, 'local-gas-cell-pressure-gradient');
  assert.equal(result.pressureInterfaceForceSolver.localPressureGradientReady, true);
  assert.equal(result.pressureFeedback.gasCellField.eosPressureClosure, 'retained-gpu-gas-pressure-cell-rows');
  assert.equal(result.pressureFeedback.gasCellField.localPressureGradientReady, true);
  assert.equal(result.pressureFeedback.gasCellField.retainedGasPressureCellsBufferAvailable, true);
  assert.equal(
    result.pressureInterfaceForceSolver.localPressureGradientForceCouplingStatus,
    'retained-gpu-gas-cell-rows-ready-for-force-coupling'
  );
  assert.equal(result.pressureInterfaceForceSolver.gasPressureCellRowCount, 2);
  assert.equal(result.pressureInterfaceForceSolver.gasPressureCellRowsBufferBorrowed, true);
  assert.equal(result.gasPressureCellsBuffer, retainedGasPressureCellsBuffer);
  assert.equal(result.gasPressureCellRowsBufferBorrowed, true);
  assert.equal(result.gasPressureCellRowsBufferRetained, true);
  assert.equal(result.pressureInterfaceStageTaskEvidence.localPressureGradientReady, true);
  assert.equal(
    result.pressureInterfaceStageTaskEvidence.pressureInterfaceGasCellFieldImportRetainedLocalPressureGradientReady,
    true
  );
  assert.equal(result.pressureInterfaceStageTaskEvidence.pressureInterfaceGasPressureCellRowCount, 2);
  assert.equal(result.pressureInterfaceStageTaskAuthority.pressureInterfaceGasCellFieldImportReady, true);
  assert.equal(
    result.pressureInterfaceStageTaskAuthority.pressureInterfaceGasCellFieldImportRetainedLocalPressureGradientReady,
    true
  );
  assert.equal(
    device.writes.some((entry) => entry.label === 'ulg-sph-pressure-interface-gas-cells-in'),
    false
  );
  assert.equal(
    device.bindGroups.at(-1).entries.find((entry) => entry.binding === 3)?.resource.buffer,
    retainedGasPressureCellsBuffer
  );
});

test('SPH pressure interface stage blocks gas-cell field imports without retained refs', async () => {
  const materialInterfaceField = {
    schema: 'peercompute.ulg.sph-material-interface-field.v0',
    status: 'material-interface-field-ready',
    surfaceCount: 1,
    readySurfaceCount: 1,
    totalSurfaceAreaM2: 1,
    elementCount: 1,
    elements: [
      {
        status: 'interface-element-ready',
        surfaceIndex: 0,
        surfaceKey: 'h2o|liquid',
        material: 'h2o',
        phase: 'liquid',
        materialId: 1,
        phaseId: 2,
        axisId: 0,
        centroidM: [0.5, 1, 1],
        areaM2: 1,
        normalAreaVectorM2: [1, 0, 0]
      }
    ]
  };
  const pressureInterfaceGasCellFieldAdmission = {
    schema: ULG_PRESSURE_INTERFACE_GAS_CELL_FIELD_ADMISSION_SCHEMA,
    status: 'pressure-interface-gas-cell-field-consumption-approved',
    gasCellFieldConsumptionApproved: true,
    sourceHotBufferKey: 'ulg:test:gas-cell-import-hot-buffer'
  };
  const result = await runSphPressureInterfaceStageComputeTask({
    computeTaskId: 'ulg:test:pressure-interface-stage-local-gas-import-blocked',
    preferWebGpu: false,
    readbackMode: 'no-full-readback',
    gasPressureSummary: {
      schema: 'peercompute.ulg.sph-sealed-gas-pressure-summary.v0',
      status: 'synthetic-pressure',
      totalPressurePa: 120000,
      boxVolumeM3: 8,
      boxDimsM: [2, 2, 2],
      bySpecies: {},
      strictReactionGate: { status: 'strict-reaction-gate-pass', blockers: [] }
    },
    materialInterfaceField,
    pressureInterfaceGasCellFieldImport: {
      schema: ULG_PRESSURE_INTERFACE_GAS_CELL_FIELD_IMPORT_SCHEMA,
      status: 'pressure-interface-gas-cell-field-import-ready',
      sourceHotBufferKey: 'ulg:test:gas-cell-import-hot-buffer',
      retainedGasPressureBufferRefs: [],
      pressureInterfaceGasCellFieldAdmission,
      gasCellFieldSnapshot: {
        localPressureGradientReady: true,
        cellDims: [1, 1, 1],
        cells: [
          {
            gridIndex: [0, 0, 0],
            centerM: [0.5, 1, 1],
            pressurePa: 180000,
            pressureGradientPaPerM: [0, 0, 0],
            volumeM3: 8
          }
        ]
      }
    },
    expectedOutputFamilies: ['pressure-interface-force-rows'],
    pressureInterfaceStageTask: true
  });

  assert.equal(result.status, 'pressure-interface-stage-solver-ready');
  assert.equal(result.pressureInterfaceForceSolver.pressureFieldMode, 'uniform-single-cell-sealed-gas');
  assert.equal(result.pressureInterfaceForceSolver.localPressureGradientReady, false);
  assert.equal(result.pressureInterfaceGasCellFieldImportReady, false);
  assert.equal(result.pressureInterfaceGasCellFieldImportStatus, 'pressure-interface-gas-cell-field-import-retained-buffer-ref-required');
  assert.equal(result.pressureInterfaceGasCellFieldAdmissionStatus, 'not-required-uniform-pressure-field');
  assert.equal(result.pressureInterfaceGasCellFieldAdmissionApproved, true);
  assert.equal(result.pressureInterfaceStageTaskEvidence.pressureInterfaceGasCellFieldImportReady, false);
});

test('SPH pressure interface stage compute task can produce force rows with WebGPU', async () => {
  const materialInterfaceField = {
    schema: 'peercompute.ulg.sph-material-interface-field.v0',
    status: 'material-interface-field-ready',
    surfaceCount: 1,
    readySurfaceCount: 1,
    totalSurfaceAreaM2: 2,
    elementCount: 2,
    elements: [
      {
        status: 'interface-element-ready',
        surfaceIndex: 0,
        surfaceKey: 'h2o|liquid',
        material: 'h2o',
        phase: 'liquid',
        materialId: 1,
        phaseId: 2,
        axisId: 0,
        centroidM: [0.5, 1, 1],
        areaM2: 1,
        normal: [1, 0, 0],
        normalAreaVectorM2: [1, 0, 0]
      },
      {
        status: 'interface-element-ready',
        surfaceIndex: 0,
        surfaceKey: 'h2o|liquid',
        material: 'h2o',
        phase: 'liquid',
        materialId: 1,
        phaseId: 2,
        axisId: 0,
        centroidM: [1.5, 1, 1],
        areaM2: 1,
        normal: [-1, 0, 0],
        normalAreaVectorM2: [-1, 0, 0]
      }
    ]
  };
  const gasPressureSummary = {
    schema: 'peercompute.ulg.sph-sealed-gas-pressure-summary.v0',
    status: 'synthetic-pressure',
    totalPressurePa: 120000,
    boxVolumeM3: 8,
    boxDimsM: [2, 2, 2],
    bySpecies: {},
    strictReactionGate: { status: 'strict-reaction-gate-pass', blockers: [] }
  };
  const device = fakeSummaryDevice(new Float32Array(2 * SPH_PRESSURE_INTERFACE_FORCE_ROW_LAYOUT.length));
  const result = await runSphPressureInterfaceStageComputeTask({
    modulePath: './sphMlsMpmGpuStep.js',
    computeTaskId: 'ulg:test:pressure-interface-stage-webgpu',
    preferWebGpu: true,
    readbackMode: 'full-parity-readback',
    device,
    gpuFenceRequirement: {
      schema: 'peercompute.compute.gpu-fence-requirement.v0',
      required: true,
      laneId: 'ulg:test:pressure-interface-lane',
      stateKey: 'ulg:test:pressure-interface-state'
    },
    gasPressureSummary,
    materialInterfaceField,
    expectedOutputFamilies: ['pressure-interface-force-rows'],
    pressureInterfaceStageTask: true
  });

  assert.equal(result.computeTaskResultSchema, ULG_SPH_PRESSURE_INTERFACE_STAGE_COMPUTE_TASK_RESULT_SCHEMA);
  assert.equal(result.backend, 'webgpu');
  assert.equal(result.webgpuStatus.status, 'webgpu-executed');
  assert.equal(result.status, 'pressure-interface-stage-solver-ready');
  assert.equal(result.queueCompletionStatus, 'readback-map-completed');
  assert.equal(result.queueCompletionMethod, 'mapAsync(readback-buffer)');
  assert.equal(result.fullReadbackPerformed, true);
  assert.equal(result.normalHotLoopReadbackFree, false);
  assert.equal(result.forceRowCount, 2);
  assert.equal(result.forceRowValues.length, 2 * SPH_PRESSURE_INTERFACE_FORCE_ROW_LAYOUT.length);
  assert.equal(result.forceRowsBuffer.label, 'ulg-sph-pressure-interface-force-rows-out');
  assert.equal(result.forceRowsBufferByteLength, 2 * SPH_PRESSURE_INTERFACE_FORCE_ROW_LAYOUT.length * Float32Array.BYTES_PER_ELEMENT);
  assert.equal(result.forceRowStrideFloats, SPH_PRESSURE_INTERFACE_FORCE_ROW_LAYOUT.length);
  assert.equal(result.forceRowByteLength, 2 * SPH_PRESSURE_INTERFACE_FORCE_ROW_LAYOUT.length * Float32Array.BYTES_PER_ELEMENT);
  assert.equal(result.pressureInterfaceForceRowsBufferRetained, true);
  assert.equal(result.pressureInterfaceForceSolver.backend, 'webgpu');
  assert.equal(result.pressureInterfaceForceSolver.status, 'pressure-interface-force-solver-ready');
  assert.equal(result.pressureInterfaceForceSolver.pressureFieldMode, 'uniform-single-cell-sealed-gas');
  assert.equal(result.pressureInterfaceForceSolver.localPressureGradientReady, false);
  assert.equal(result.pressureInterfaceForceSolver.localPressureGradientForceCouplingStatus, 'blocked-local-pressure-gradient-field-required');
  assert.equal(result.pressureInterfaceStageTaskEvidence.passed, true);
  assert.equal(result.pressureInterfaceStageTaskEvidence.pressureFieldMode, 'uniform-single-cell-sealed-gas');
  assert.equal(result.pressureInterfaceStageTaskEvidence.localPressureGradientForceCouplingStatus, 'blocked-local-pressure-gradient-field-required');
  assert.equal(result.pressureInterfaceStageTaskEvidence.executionSource, 'sphPressureInterfaceForceRowsWebGpu');
  assert.equal(result.gpuFence.required, true);
  assert.equal(result.gpuFence.fenceSatisfied, true);
  assert.equal(device.dispatches.length > 0, true);
  assert.ok(device.writes.some((entry) => entry.label === 'ulg-sph-pressure-interface-elements-in'));
  assert.ok(device.writes.some((entry) => entry.label === 'ulg-sph-pressure-interface-force-params'));
});

test('SPH reaction product stage compute task declares retained product lane output without authority mutation', async () => {
  const buffers = manualBuffers();
  const tracker = fakeBufferTracker();
  const sourceStateBuffer = tracker.buffer('reaction-state-in');
  const sourceThermoBuffer = tracker.buffer('reaction-thermo-in');
  const sourceMechanicsBuffer = tracker.buffer('reaction-mechanics-in');
  const productEventBuffer = tracker.buffer('reaction-product-events');
  const task = createSphReactionProductStageComputeTask({
    modulePath: './sphMlsMpmGpuStep.js',
    taskId: 'ulg:test:reaction-product-stage',
    laneId: 'ulg:test:reaction-product-lane',
    stateKey: 'ulg:test:reaction-product-state',
    domainKey: 'ulg:test-domain',
    preferWebGpu: true,
    sphParticleState: buffers.sphParticleState,
    mlsMpmParticleState: buffers.mlsMpmParticleState,
    reactionTable: { schema: 'peercompute.ulg.sph-gpu-reaction-table.v1', reactionCount: 1, productTermCount: 1, gasProductCount: 0 },
    thermalMaterialTable: { schema: 'peercompute.ulg.sph-gpu-thermal-material-table.v0' },
    sphParticleUpload: {
      status: 'webgpu-uploaded',
      stateBuffer: sourceStateBuffer,
      thermoBuffer: sourceThermoBuffer
    },
    mlsMpmParticleUpload: {
      status: 'webgpu-uploaded',
      mechanicsBuffer: sourceMechanicsBuffer
    },
    sourceStateBuffer,
    sourceThermoBuffer,
    sourceMechanicsBuffer
  });

  assert.equal(task.schema, ULG_SPH_REACTION_PRODUCT_STAGE_COMPUTE_TASK_SCHEMA);
  assert.equal(task.exportName, 'runSphReactionProductStageComputeTask');
  assert.equal(task.residency, 'gpu-lane');
  assert.equal(task.suppressCommitDelta, true);
  assert.equal(task.gpuFence.required, true);
  assert.equal(task.gpuFence.laneId, 'ulg:test:reaction-product-lane');
  assert.equal(task.gpuResidentLane.owner, 'ulg-reaction-product-gas-law');
  assert.deepEqual(task.writeFamilies, ['sph-particle-state', 'sph-thermo-phase', 'mls-mpm-mechanics', 'resident-product-mass']);
  assert.deepEqual(task.webgpu.retainedBufferRefs, ['sph-state-buffer', 'sph-thermo-buffer', 'mls-mpm-mechanics-buffer', 'resident-product-mass-buffer']);

  const result = await runSphReactionProductStageComputeTask({
    ...task.data,
    reactionStepRunner(args) {
      assert.equal(args.sphParticleUpload.thermoBuffer, sourceThermoBuffer);
      assert.equal(args.mlsMpmParticleUpload.mechanicsBuffer, sourceMechanicsBuffer);
      assert.equal(args.sourceStateBuffer, sourceStateBuffer);
      assert.equal(args.sourceThermoBuffer, sourceThermoBuffer);
      assert.equal(args.sourceMechanicsBuffer, sourceMechanicsBuffer);
      assert.equal(args.retainOutputParticleBuffers, true);
      return {
        schema: 'peercompute.ulg.sph-gpu-reaction-step-execution.v0',
        backend: 'webgpu',
        status: 'webgpu-accepted',
        webgpuStatus: { status: 'webgpu-executed' },
        result: {
          schema: ULG_SPH_GPU_REACTION_STEP_SCHEMA,
          backend: 'webgpu',
          status: 'reaction-step-executed',
          particleCount: buffers.sphParticleState.particleCount,
          reactionCount: 1,
          productTermCount: 1,
          gasProductCount: 0,
          state: new Float32Array(),
          thermo: new Float32Array(),
          mechanics: new Float32Array(),
          stateBuffer: tracker.buffer('reaction-state-out'),
          thermoBuffer: tracker.buffer('reaction-thermo-out'),
          mechanicsBuffer: tracker.buffer('reaction-mechanics-out'),
          stateBufferByteLength: buffers.sphParticleState.state.byteLength,
          thermoBufferByteLength: buffers.sphParticleState.thermo.byteLength,
          mechanicsBufferByteLength: buffers.mlsMpmParticleState.mechanics.byteLength,
          residentProductMass: {
            schema: ULG_SPH_RESIDENT_PRODUCT_MASS_SCHEMA,
            status: 'resident-product-mass-buffer-retained',
            productEventBuffer,
            productEventBufferRetained: true,
            productEventBufferByteLength: 64,
            productEventRowCount: 1
          },
          residentProductMassStatus: 'resident-product-mass-buffer-retained',
          residentProductMassBufferRetained: true,
          retainedOutputParticleBuffers: true,
          readbackMode: 'full-parity-readback',
          fullReadbackPerformed: true,
          normalHotLoopReadbackFree: false
        }
      };
    }
  });

  assert.equal(result.computeTaskResultSchema, ULG_SPH_REACTION_PRODUCT_STAGE_COMPUTE_TASK_RESULT_SCHEMA);
  assert.equal(result.computeTaskSchema, ULG_SPH_REACTION_PRODUCT_STAGE_COMPUTE_TASK_SCHEMA);
  assert.equal(result.computeTaskId, 'ulg:test:reaction-product-stage');
  assert.equal(result.backend, 'webgpu');
  assert.equal(result.status, 'webgpu-accepted');
  assert.equal(result.stateBuffer.label, 'reaction-state-out');
  assert.equal(result.thermoBuffer.label, 'reaction-thermo-out');
  assert.equal(result.mechanicsBuffer.label, 'reaction-mechanics-out');
  assert.equal(result.residentProductMass.productEventBuffer, productEventBuffer);
  assert.equal(result.gpuFence.schema, 'peercompute.compute.gpu-fence-report.v0');
  assert.equal(result.gpuFence.required, true);
  assert.equal(result.gpuFence.fenceSatisfied, true);
  assert.equal(result.reactionProductStageTaskEvidence.schema, 'peercompute.ulg.reaction-product-stage-task-evidence.v0');
  assert.equal(result.reactionProductStageTaskEvidence.passed, true);
  assert.deepEqual(result.reactionProductStageTaskEvidence.candidateWriteFamilies, [
    'sph-particle-state',
    'sph-thermo-phase',
    'mls-mpm-mechanics',
    'resident-product-mass'
  ]);
  assert.ok(result.reactionProductStageTaskEvidence.mustNotWriteFamilies.includes('pressure-interface-force-rows'));
  assert.equal(result.reactionProductStageTaskAuthority.status, 'compute-manager-owned-non-mutating-reaction-product-stage-task');
  assert.equal(result.reactionProductStageTaskAuthority.authoritativeStateMutation, false);
  assert.equal(result.reactionProductStageTaskAuthority.commitDeltaSuppressed, true);
});

test('MLS-MPM resident step compute task submit helper uses a ComputeManager-compatible submitTask surface', async () => {
  const { options } = noFullReadbackResidentStepFixture();
  const submitted = [];
  const computeManager = {
    submitTask(task) {
      submitted.push(task);
      return Promise.resolve({ acceptedTaskId: task.id, laneId: task.gpuResidentLane?.laneId });
    }
  };

  const result = await submitMlsMpmResidentStepComputeTask({
    computeManager,
    ...options,
    modulePath: './sphMlsMpmGpuStep.js',
    taskId: 'ulg:test:submit-task',
    laneId: 'ulg:test:sph-resident-submit',
    stateKey: 'ulg:test:sph-state-submit'
  });

  assert.equal(submitted.length, 1);
  assert.equal(submitted[0].schema, ULG_MLS_MPM_RESIDENT_COMPUTE_TASK_SCHEMA);
  assert.equal(submitted[0].gpuResidentLane.laneId, 'ulg:test:sph-resident-submit');
  assert.equal(submitted[0].gpuFence.stateKey, 'ulg:test:sph-state-submit');
  assert.deepEqual(result, {
    acceptedTaskId: 'ulg:test:submit-task',
    laneId: 'ulg:test:sph-resident-submit'
  });
});

test('MLS-MPM resident steps compute task declares a ComputeManager GPU lane pass DAG', async () => {
  const { options } = noFullReadbackResidentStepFixture();
  const task = createMlsMpmResidentStepsComputeTask({
    ...options,
    modulePath: './sphMlsMpmGpuStep.js',
    taskId: 'ulg:test:resident-steps-task',
    laneId: 'ulg:test:sph-resident-steps',
    stateKey: 'ulg:test:sph-state-steps',
    domainKey: 'ulg:test-domain',
    stepCount: 3,
    compactSummaryMode: 'final-only'
  });

  assert.equal(task.schema, ULG_MLS_MPM_RESIDENT_STEPS_COMPUTE_TASK_SCHEMA);
  assert.equal(task.runtime, 'js');
  assert.equal(task.exportName, 'runMlsMpmResidentStepsComputeTask');
  assert.equal(task.residency, 'gpu-lane');
  assert.equal(task.gpuResidentLane.schema, 'peercompute.compute.gpu-resident-lane-task.v0');
  assert.equal(task.gpuResidentLane.laneId, 'ulg:test:sph-resident-steps');
  assert.equal(task.gpuResidentLane.stateKey, 'ulg:test:sph-state-steps');
  assert.equal(task.gpuResidentLane.domainKey, 'ulg:test-domain');
  assert.equal(task.gpuResidentLane.copyBudget.readbackBytes, MLS_MPM_GPU_RESIDENT_SUMMARY_BYTES);
  assert.equal(task.gpuResidentLane.copyBudget.compactSummaryBytes, MLS_MPM_GPU_RESIDENT_SUMMARY_BYTES);
  assert.equal(task.gpuResidentLane.activeGridDispatchPolicy.enabled, false);
  assert.equal(task.gpuResidentLane.residentSequenceLaneContract.schema, 'peercompute.ulg.mls-mpm-resident-sequence-lane-contract.v0');
  assert.equal(task.gpuResidentLane.residentSequenceLaneContract.sequenceRequested, false);
  assert.equal(task.gpuResidentLane.residentSequenceLaneContract.sequenceRunnable, false);
  assert.equal(task.gpuResidentLane.residentSequenceLaneContract.defaultEnabled, false);
  assert.equal(task.gpuResidentLane.residentSequenceLaneContract.sequenceMode, 'per-step-resident-pass-dag');
  assert.equal(task.gpuResidentLane.residentSequenceLaneContract.activeGridDispatchPolicy.enabled, false);
  assert.equal(task.webgpu.activeGridDispatchPolicy.enabled, false);
  assert.equal(task.webgpu.residentSequenceLaneContract.sequenceRunnable, false);
  assert.equal(task.lawGraphNode.schema, 'peercompute.ulg.law-graph-node-task-ref.v0');
  assert.equal(task.lawGraphNode.nodeId, 'ulg-mls-mpm-sph-resident-pass-dag');
  assert.equal(task.lawGraphNode.runtimeTarget, 'webgpu-resident-lane');
  assert.equal(task.lawGraphNode.activeGridDispatchPolicy.enabled, false);
  assert.equal(task.lawGraphNode.residentSequenceLaneContract.authority, 'compute-manager-gpuhub-resident-lane-contract');
  assert.deepEqual(task.readFamilies, task.gpuResidentLane.readFamilies);
  assert.deepEqual(task.expectedOutputFamilies, task.writeFamilies);
  assert.equal(task.data.gpuResidentLaneManager, undefined);
  assert.equal(task.data.stepCount, 3);
  assert.equal(task.data.lawGraphNode.nodeId, 'ulg-mls-mpm-sph-resident-pass-dag');
  assert.equal(task.data.residentSequenceLaneContract.sequenceMode, 'per-step-resident-pass-dag');
});

test('MLS-MPM resident steps compute task can budget no compact-summary readback', async () => {
  const { options } = noFullReadbackResidentStepFixture();
  const task = createMlsMpmResidentStepsComputeTask({
    ...options,
    modulePath: './sphMlsMpmGpuStep.js',
    taskId: 'ulg:test:resident-steps-no-summary-task',
    laneId: 'ulg:test:sph-resident-steps',
    stateKey: 'ulg:test:sph-state-steps',
    domainKey: 'ulg:test-domain',
    stepCount: 3,
    compactSummaryMode: 'none'
  });

  assert.equal(task.data.compactSummaryMode, 'none');
  assert.equal(task.gpuResidentLane.copyBudget.readbackBytes, 0);
  assert.equal(task.gpuResidentLane.copyBudget.compactSummaryBytes, 0);
  assert.equal(task.webgpu.copyBudget.readbackBytes, 0);
  assert.equal(task.webgpu.copyBudget.compactSummaryBytes, 0);
  assert.equal(task.gpuResidentLane.residentSequenceLaneContract.compactSummaryMode, 'none');
  assert.equal(task.gpuResidentLane.residentSequenceLaneContract.sequenceRunnable, false);
});

test('MLS-MPM resident steps expose WebGPU-Ocean hot-loop budget diagnostics', async () => {
  const { options } = noFullReadbackResidentStepFixture();
  const budget = summarizeMlsMpmResidentHotLoopBudget({
    ...options,
    stepCount: 4,
    compactSummaryMode: 'none'
  });

  assert.equal(budget.schema, ULG_MLS_MPM_WEBGPU_OCEAN_HOT_LOOP_BUDGET_SCHEMA);
  assert.equal(budget.status, 'webgpu-ocean-hot-loop-no-readback-budget');
  assert.equal(budget.normalHotLoopReadbackFree, true);
  assert.equal(budget.noSummaryReadback, true);
  assert.equal(budget.activeGridPlanOnlySummary, false);
  assert.equal(budget.compactSummaryStepCount, 0);
  assert.equal(budget.readbackBytes, 0);
  assert.equal(budget.compactSummaryBytes, 0);

  const planOnlyBudget = summarizeMlsMpmResidentHotLoopBudget({
    ...options,
    stepCount: 4,
    compactSummaryMode: 'active-grid-plan-only'
  });

  assert.equal(planOnlyBudget.compactSummaryMode, 'plan-only');
  assert.equal(planOnlyBudget.status, 'webgpu-ocean-hot-loop-active-grid-plan-only-budget');
  assert.equal(planOnlyBudget.normalHotLoopReadbackFree, true);
  assert.equal(planOnlyBudget.noSummaryReadback, true);
  assert.equal(planOnlyBudget.activeGridPlanOnlySummary, true);
  assert.equal(planOnlyBudget.compactSummaryStepCount, 0);
  assert.equal(planOnlyBudget.readbackBytes, 0);
  assert.equal(planOnlyBudget.compactSummaryBytes, 0);

  const activeGridTask = createMlsMpmResidentStepsComputeTask({
    ...options,
    modulePath: './sphMlsMpmGpuStep.js',
    taskId: 'ulg:test:resident-steps-hot-loop-budget-task',
    laneId: 'ulg:test:sph-resident-steps',
    stateKey: 'ulg:test:sph-state-steps',
    domainKey: 'ulg:test-domain',
    stepCount: 4,
    compactSummaryMode: 'none',
    activeGridDispatchPlanRefreshMode: 'final-only',
    fuseNoFullResidentMechanicsSequence: true,
    fuseNoFullResidentMechanicsActiveGrid: true
  });

  assert.equal(activeGridTask.webgpu.hotLoopBudget.schema, ULG_MLS_MPM_WEBGPU_OCEAN_HOT_LOOP_BUDGET_SCHEMA);
  assert.equal(activeGridTask.webgpu.hotLoopBudget.status, 'webgpu-ocean-hot-loop-no-readback-budget');
  assert.equal(activeGridTask.webgpu.hotLoopBudget.activeGridEnabled, true);
  assert.equal(activeGridTask.webgpu.hotLoopBudget.activeGridDispatchPlanFinalOnly, true);
  assert.equal(activeGridTask.webgpu.hotLoopBudget.readbackBytes, 0);
  assert.equal(activeGridTask.gpuResidentLane.hotLoopBudget, activeGridTask.webgpu.hotLoopBudget);
  assert.equal(activeGridTask.lawGraphNode.hotLoopBudget.status, 'webgpu-ocean-hot-loop-no-readback-budget');
  assert.equal(activeGridTask.data.hotLoopBudget.copyBudget.readbackBytes, 0);
  assert.equal(activeGridTask.gpuResidentLane.copyBudget.readbackBytes, 0);

  const planOnlyTask = createMlsMpmResidentStepsComputeTask({
    ...options,
    modulePath: './sphMlsMpmGpuStep.js',
    taskId: 'ulg:test:resident-steps-hot-loop-plan-only-task',
    laneId: 'ulg:test:sph-resident-steps',
    stateKey: 'ulg:test:sph-state-steps',
    domainKey: 'ulg:test-domain',
    stepCount: 4,
    compactSummaryMode: 'plan-only',
    activeGridDispatchPlanRefreshMode: 'final-only',
    fuseNoFullResidentMechanicsSequence: true,
    fuseNoFullResidentMechanicsActiveGrid: true
  });

  assert.equal(planOnlyTask.data.compactSummaryMode, 'plan-only');
  assert.equal(planOnlyTask.webgpu.hotLoopBudget.status, 'webgpu-ocean-hot-loop-active-grid-plan-only-budget');
  assert.equal(planOnlyTask.webgpu.hotLoopBudget.activeGridPlanOnlySummary, true);
  assert.equal(planOnlyTask.webgpu.hotLoopBudget.readbackBytes, 0);
  assert.equal(planOnlyTask.gpuResidentLane.residentSequenceLaneContract.compactSummaryMode, 'plan-only');
});

test('MLS-MPM resident steps compute task blocks fused sequence when sidecars require per-step ordering', async () => {
  const { options } = noFullReadbackResidentStepFixture();
  const task = createMlsMpmResidentStepsComputeTask({
    ...options,
    modulePath: './sphMlsMpmGpuStep.js',
    taskId: 'ulg:test:resident-steps-sidecar-sequence-task',
    laneId: 'ulg:test:sph-resident-steps',
    stateKey: 'ulg:test:sph-state-steps',
    stepCount: 2,
    compactSummaryMode: 'final-only',
    activeGridDispatchPlanRefreshMode: 'final-only',
    fuseNoFullResidentMechanicsSequence: true,
    fuseNoFullResidentMechanicsActiveGrid: true,
    thermalMaterialTable: { schema: 'peercompute.ulg.sph-gpu-thermal-material-table.v0' },
    reactionTable: { schema: 'peercompute.ulg.sph-gpu-reaction-table.v1', reactionCount: 1 }
  });

  const contract = task.gpuResidentLane.residentSequenceLaneContract;
  assert.equal(contract.sequenceRequested, true);
  assert.equal(contract.sequenceRunnable, false);
  assert.equal(contract.status, 'blocked-fused-sequence-requirements-not-met');
  assert.equal(contract.sequenceMode, 'per-step-resident-pass-dag');
  assert.equal(contract.fallbackMode, 'per-step-fused-mechanics-active-grid');
  assert.deepEqual(contract.sidecarBlockers, ['thermal-sidecar', 'reaction-sidecar']);
  assert.equal(contract.thermalAwareFusionRequired, true);
  assert.equal(contract.reactionAwareFusionRequired, true);
  assert.equal(contract.sidecarFusionRequired, true);
  assert.equal(contract.sidecarFusionRunnable, false);
  assert.equal(contract.sidecarFusionPlanStatus, 'sidecar-fusion-plan-ready-execution-blocked');
  assert.equal(contract.sidecarFusionStageCount, 3);
  assert.equal(contract.sidecarFusionPlan.schema, 'peercompute.ulg.mls-mpm-fused-resident-sidecar-plan.v0');
  assert.deepEqual(contract.sidecarFusionPlan.sidecarBlockers, ['thermal-sidecar', 'reaction-sidecar']);
  assert.deepEqual(contract.sidecarFusionPlan.requiredStageOrder, [
    'mechanics-p2g',
    'mechanics-grid-update',
    'mechanics-g2p',
    'thermal-phase',
    'reaction-product',
    'mechanics-refresh',
    'resident-compact-summary-or-active-grid-plan'
  ]);
  assert.deepEqual(
    contract.sidecarFusionPlan.stages.map((stage) => stage.id),
    ['thermal-phase', 'reaction-product', 'mechanics-refresh']
  );
  assert.equal(contract.sidecarFusionPlan.stages[0].implementedInCurrentFusedSequence, false);
  assert.equal(task.webgpu.residentSequenceLaneContract.sequenceRunnable, false);
  assert.equal(task.data.residentSequenceLaneContract.fallbackMode, 'per-step-fused-mechanics-active-grid');
});

test('MLS-MPM resident steps compute task can opt into thermal sidecar fused sequence', async () => {
  const { options } = noFullReadbackResidentStepFixture();
  const materialProperties = {
    h2o: {
      molarMassKgPerMol: 0.018,
      phases: [
        { name: 'liquid', densityKgPerM3: 1000, bulkModulusPa: 2.2e9, shearModulusPa: 0, cpJPerKgK: 4184, temperatureRange: [273.15, 373.15] }
      ]
    }
  };
  const task = createMlsMpmResidentStepsComputeTask({
    ...options,
    modulePath: './sphMlsMpmGpuStep.js',
    taskId: 'ulg:test:resident-steps-thermal-sidecar-fused-task',
    laneId: 'ulg:test:sph-resident-steps',
    stateKey: 'ulg:test:sph-state-steps',
    stepCount: 2,
    compactSummaryMode: 'final-only',
    activeGridDispatchPlanRefreshMode: 'final-only',
    fuseNoFullResidentMechanicsSequence: true,
    fuseNoFullResidentMechanicsActiveGrid: true,
    fuseThermalSidecarResidentSequence: true,
    thermalMaterialTable: buildSphThermalMaterialTable(materialProperties),
    mechanicsMaterialTable: buildMlsMpmMechanicsMaterialTable(materialProperties)
  });

  const contract = task.gpuResidentLane.residentSequenceLaneContract;
  assert.equal(contract.sequenceRequested, true);
  assert.equal(contract.sequenceRunnable, true);
  assert.equal(contract.status, 'lane-owned-fused-sequence-contract-ready');
  assert.deepEqual(contract.blockers, []);
  assert.deepEqual(contract.sidecarBlockers, ['thermal-sidecar']);
  assert.equal(contract.sidecarFusionRequired, true);
  assert.equal(contract.sidecarFusionRunnable, true);
  assert.equal(contract.sequenceRunnableWithSidecars, true);
  assert.equal(contract.sidecarFusionPromotesFusedSequence, true);
  assert.equal(contract.sidecarFusionPlan.status, 'sidecar-fusion-plan-runnable');
  assert.deepEqual(
    contract.sidecarFusionPlan.stages.map((stage) => stage.implementedInCurrentFusedSequence),
    [true, true]
  );
  assert.equal(task.webgpu.residentSequenceLaneContract.sequenceRunnable, true);
  assert.equal(task.data.residentSequenceLaneContract.sidecarFusionPlan.status, 'sidecar-fusion-plan-runnable');
});

test('MLS-MPM resident steps compute task sidecar fusion plan orders pressure and product blockers', async () => {
  const { options } = noFullReadbackResidentStepFixture();
  const task = createMlsMpmResidentStepsComputeTask({
    ...options,
    modulePath: './sphMlsMpmGpuStep.js',
    taskId: 'ulg:test:resident-steps-pressure-product-sidecar-plan-task',
    laneId: 'ulg:test:sph-resident-steps',
    stateKey: 'ulg:test:sph-state-steps',
    stepCount: 2,
    compactSummaryMode: 'plan-only',
    activeGridDispatchPlanRefreshMode: 'final-only',
    fuseNoFullResidentMechanicsSequence: true,
    fuseNoFullResidentMechanicsActiveGrid: true,
    pressureInterfaceForceRowsBuffer: { label: 'pressure-interface-force-rows' },
    residentProductMass: {
      schema: 'peercompute.ulg.sph-resident-product-mass.v0',
      status: 'resident-product-mass-buffer-retained',
      productEventBufferRetained: true
    }
  });

  const plan = task.webgpu.residentSequenceLaneContract.sidecarFusionPlan;
  assert.equal(plan.status, 'sidecar-fusion-plan-ready-execution-blocked');
  assert.equal(plan.required, true);
  assert.equal(plan.sidecarFusionRunnable, false);
  assert.deepEqual(plan.sidecarBlockers, ['pressure-interface-force-rows', 'resident-product-mass-sidecar']);
  assert.deepEqual(
    plan.stages.map((stage) => stage.id),
    ['resident-product-mass-eos-p2g', 'pressure-interface-grid-force-consumption']
  );
  assert.deepEqual(plan.requiredStageOrder, [
    'resident-product-mass-eos-p2g',
    'mechanics-p2g',
    'pressure-interface-grid-force-consumption',
    'mechanics-grid-update',
    'mechanics-g2p',
    'resident-compact-summary-or-active-grid-plan'
  ]);
  assert.equal(plan.stages[0].orderConstraint, 'before-mechanics-p2g');
  assert.equal(plan.stages[1].orderConstraint, 'before-mechanics-grid-update');
  assert.equal(plan.stages[1].stateManagerAdmissionRequired, true);
  assert.equal(task.data.residentSequenceLaneContract.sidecarFusionStageCount, 2);
  assert.equal(task.lawGraphNode.residentSequenceLaneContract.sidecarFusionRequired, true);
});

test('MLS-MPM resident steps compute task handler returns fence evidence without local double leasing', async () => {
  const { options } = noFullReadbackResidentStepFixture();
  const ignoredLaneManager = fakeGpuResidentLaneManager();
  const task = createMlsMpmResidentStepsComputeTask({
    ...options,
    modulePath: './sphMlsMpmGpuStep.js',
    laneId: 'ulg:test:sph-resident-steps',
    stateKey: 'ulg:test:sph-state-steps',
    stepCount: 2,
    compactSummaryMode: 'final-only',
    gpuResidentLaneManager: ignoredLaneManager
  });
  task.data.peerComputeSolverTask = {
    schema: ULG_MLS_MPM_RESIDENT_STEPS_SOLVER_TASK_BRIDGE_SCHEMA,
    status: 'solver-task-created',
    created: true,
    solverTaskSchema: 'peercompute.compute.solver-task.v0',
    solverId: 'ulg-mls-mpm-sph-resident-steps',
    taskFamily: 'ulg-mls-mpm-sph-resident-steps',
    affinityKey: 'ulg-mls-mpm-sph-resident-steps:ulg:test:sph-state-steps',
    warmDeltaScope: 'ulg-sph-resident-pass-dag'
  };
  const result = await runMlsMpmResidentStepsComputeTask(task.data);

  assert.equal(result.schema, ULG_MLS_MPM_GPU_RESIDENT_STEPS_EXECUTION_SCHEMA);
  assert.equal(result.computeTaskResultSchema, ULG_MLS_MPM_RESIDENT_STEPS_COMPUTE_TASK_RESULT_SCHEMA);
  assert.equal(result.computeTaskSchema, ULG_MLS_MPM_RESIDENT_STEPS_COMPUTE_TASK_SCHEMA);
  assert.equal(result.peerComputeSolverTask.schema, ULG_MLS_MPM_RESIDENT_STEPS_SOLVER_TASK_BRIDGE_SCHEMA);
  assert.equal(result.peerComputeSolverTask.created, true);
  assert.equal(result.peerComputeSolverTask.solverTaskSchema, 'peercompute.compute.solver-task.v0');
  assert.equal(result.status, 'resident-steps-executed');
  assert.equal(result.completedStepCount, 2);
  assert.equal(result.gpuFence.schema, 'peercompute.compute.gpu-fence-report.v0');
  assert.equal(result.gpuFence.fenceSatisfied, true);
  assert.equal(result.gpuFence.laneId, 'ulg:test:sph-resident-steps');
  assert.equal(result.gpuFence.stateKey, 'ulg:test:sph-state-steps');
  assert.equal(result.residentSequenceLaneContract.schema, 'peercompute.ulg.mls-mpm-resident-sequence-lane-contract.v0');
  assert.equal(result.residentSequenceLaneContract.sequenceRequested, false);
  assert.equal(result.residentSequenceLaneContract.defaultEnabled, false);
  assert.deepEqual(result.gpuFence.retainedBufferRefs, [
    'p2g-grid-buffer',
    'updated-grid-buffer',
    'sph-state-buffer',
    'sph-thermo-buffer',
    'mls-mpm-mechanics-buffer'
  ]);
  assert.equal(result.lawGraphNode.nodeId, 'ulg-mls-mpm-sph-resident-pass-dag');
  assert.equal(result.commitDelta.schema, ULG_MLS_MPM_RESIDENT_STEPS_COMMIT_DELTA_SCHEMA);
  assert.equal(result.commitDelta.taskId, task.id);
  assert.equal(result.commitDelta.scope, 'ulg-sph-resident-pass-dag');
  assert.equal(result.commitDelta.payload.schema, ULG_MLS_MPM_RESIDENT_STEPS_STATE_DELTA_SCHEMA);
  assert.equal(result.commitDelta.payload.stateKey, 'ulg:test:sph-state-steps');
  assert.equal(result.commitDelta.payload.completedStepCount, 2);
  assert.equal(result.commitDelta.payload.lawGraphNode.nodeId, 'ulg-mls-mpm-sph-resident-pass-dag');
  assert.equal(result.commitDelta.payload.residentSequenceLaneContract.schema, 'peercompute.ulg.mls-mpm-resident-sequence-lane-contract.v0');
  assert.equal(result.commitDelta.payload.residentSequenceLaneContract.sequenceMode, 'per-step-resident-pass-dag');
  assert.deepEqual(result.commitDelta.payload.outputFamilies, task.expectedOutputFamilies);
  assert.equal(result.commitDelta.payload.outputFamilies.includes('resident-compact-summary'), false);
  assert.equal(result.commitDelta.payload.gpuFence.fenceSatisfied, true);
  assert.deepEqual(result.commitDelta.payload.retainedBufferRefs, [
    'p2g-grid-buffer',
    'updated-grid-buffer',
    'sph-state-buffer',
    'sph-thermo-buffer',
    'mls-mpm-mechanics-buffer'
  ]);
  assert.equal(result.commitDelta.payload.finalStep.normalHotLoopReadbackFree, true);
  assert.equal(result.commitDelta.payload.finalStep.compactSummaryAuthority, 'diagnostic-only-unless-state-manager-admitted');
  assert.equal(result.commitDelta.payload.finalStep.compactSummaryAdmissionStatus, 'not-admitted-diagnostic-only');
  assert.equal(result.commitDelta.payload.finalStep.compactSummaryAuthoritativeMutation, false);
  assert.equal(result.commitDelta.payload.stepSummaries.length, 2);
  assert.equal(result.commitDelta.payload.stepSummaries[1].compactSummaryAuthority, 'diagnostic-only-unless-state-manager-admitted');
  assert.equal(result.commitDelta.payload.stepSummaries[1].compactSummaryAuthoritativeMutation, false);
  assert.equal(result.commitDelta.payload.finalStep.diagnostics.gpuResidentLaneFenceSatisfied, false);
  assert.equal(result.gpuResidentLaneStatus, undefined);
  assert.equal(ignoredLaneManager.calls.acquire.length, 0);
  destroyMlsMpmResidentStepsBuffers(result);
});

test('MLS-MPM resident steps commit delta carries descriptor-only Schroeder adopted particle storage', async () => {
  const { buffers, options, tracker } = noFullReadbackResidentStepFixture();
  const materializedStateBuffer = tracker.buffer('schroeder-materialized-state');
  const materializedThermoBuffer = tracker.buffer('schroeder-materialized-thermo');
  const materializedMechanicsBuffer = tracker.buffer('schroeder-materialized-mechanics');
  const materializationBuffer = tracker.buffer('schroeder-materialization-rows');
  const outputParticleCapacity = 4;
  const schroederParticleStorageMaterialization = {
    schema: ULG_SCHROEDER_PARTICLE_STORAGE_MATERIALIZATION_EXECUTION_SCHEMA,
    backend: 'webgpu',
    status: 'schroeder-particle-storage-materialization-submitted',
    readbackMode: 'no-full-readback',
    normalHotLoopReadbackFree: true,
    particleStorageMaterializationAdmissionApproved: true,
    retainedParticleBuffers: true,
    retainedMaterializationBuffer: true,
    targetStateFamilies: [
      'sph-particle-state',
      'mls-mpm-particle-mechanics',
      'sph-particle-thermo'
    ],
    sourceParticleCount: buffers.sphParticleState.particleCount,
    outputParticleCapacity,
    particleStateBuffer: materializedStateBuffer,
    particleThermoBuffer: materializedThermoBuffer,
    particleMechanicsBuffer: materializedMechanicsBuffer,
    materializationBuffer,
    stateBufferByteLength: outputParticleCapacity * 8 * Float32Array.BYTES_PER_ELEMENT,
    thermoBufferByteLength: outputParticleCapacity * 12 * Float32Array.BYTES_PER_ELEMENT,
    mechanicsBufferByteLength: outputParticleCapacity * 32 * Float32Array.BYTES_PER_ELEMENT,
    materializationBufferByteLength: 3 * 32 * Float32Array.BYTES_PER_ELEMENT,
    materializationMode: 'state-manager-admitted-particle-buffer-materialization',
    replacementPolicy: 'retained-output-buffers-await-state-manager-swap',
    stateMutationStatus: 'particle-storage-materialization-buffer-submitted',
    stateAuthorityStatus: 'state-manager-admitted-particle-storage-materialization-materialized',
    queueCompletionStatus: 'queue-work-completed',
    queueCompletionMethod: 'queue.onSubmittedWorkDone'
  };
  const task = createMlsMpmResidentStepsComputeTask({
    ...options,
    modulePath: './sphMlsMpmGpuStep.js',
    taskId: 'ulg:test:resident-steps-schroeder-adopted-storage-task',
    laneId: 'ulg:test:sph-resident-steps',
    stateKey: 'ulg:test:sph-state-steps',
    stepCount: 1,
    compactSummaryMode: 'final-only',
    schroederParticleStorageMaterialization
  });

  const result = await runMlsMpmResidentStepsComputeTask(task.data);

  assert.equal(result.completedStepCount, 1);
  assert.equal(result.finalStep.schroederParticleStorageAdopted, true);
  // Adoption swaps buffers with headroom capacity, but the live particle
  // count only grows through an explicitly admitted split/merge count delta.
  assert.equal(result.finalStep.nextParticleCount, buffers.sphParticleState.particleCount);
  assert.equal(result.schroederParticleStorageContinuationAvailable, true);
  const descriptor = result.schroederAdoptedParticleStorageDescriptor;
  assert.equal(descriptor.schema, ULG_SCHROEDER_ADOPTED_PARTICLE_STORAGE_DESCRIPTOR_SCHEMA);
  assert.equal(descriptor.status, 'schroeder-adopted-particle-storage-descriptor-ready');
  assert.equal(descriptor.ready, true);
  assert.equal(descriptor.copyMode, 'descriptor-only-no-raw-gpubuffer-transfer');
  assert.equal(descriptor.rawGpuBufferTransferAllowed, false);
  assert.equal(descriptor.rawGpuBufferTransferDetected, false);
  assert.equal(descriptor.sameDeviceReplayReady, true);
  assert.equal(descriptor.crossPeerReplayReady, false);
  assert.equal(descriptor.portableSnapshotRequired, true);
  assert.equal(descriptor.authoritativeStateMutation, true);
  assert.equal(descriptor.authoritativeParticleCount, buffers.sphParticleState.particleCount);
  assert.equal(descriptor.outputParticleCapacity, outputParticleCapacity);
  assert.equal(descriptor.stateBufferRef, 'sph-state-buffer');
  assert.equal(descriptor.thermoBufferRef, 'sph-thermo-buffer');
  assert.equal(descriptor.mechanicsBufferRef, 'mls-mpm-mechanics-buffer');
  assert.deepEqual(descriptor.retainedBufferRefs, [
    'sph-state-buffer',
    'sph-thermo-buffer',
    'mls-mpm-mechanics-buffer'
  ]);
  assert.deepEqual(
    descriptor.retainedRefs.map((entry) => entry.transferMode),
    [
      'descriptor-only-no-raw-gpubuffer-transfer',
      'descriptor-only-no-raw-gpubuffer-transfer',
      'descriptor-only-no-raw-gpubuffer-transfer'
    ]
  );
  assert.equal(descriptor.gpuFence.fenceSatisfied, true);
  assert.equal(descriptor.gpuFence.stateKey, 'ulg:test:sph-state-steps');

  const payloadDescriptor = result.commitDelta.payload.schroederAdoptedParticleStorageDescriptor;
  assert.equal(payloadDescriptor.schema, ULG_SCHROEDER_ADOPTED_PARTICLE_STORAGE_DESCRIPTOR_SCHEMA);
  assert.equal(payloadDescriptor.ready, true);
  assert.equal(payloadDescriptor.rawGpuBufferTransferDetected, false);
  assert.equal(result.commitDelta.payload.schroederParticleStorageContinuationAvailable, true);
  assert.equal(result.commitDelta.payload.schroederParticleStorageStateManagerAdmissionRequired, true);
  assert.equal(result.commitDelta.payload.finalStep.schroederParticleStorageAdopted, true);
  assert.equal(
    result.commitDelta.payload.finalStep.schroederParticleStorageAuthoritativeParticleCount,
    buffers.sphParticleState.particleCount
  );
  assert.equal(
    result.commitDelta.payload.finalStep.nextParticleCount,
    buffers.sphParticleState.particleCount
  );
  const portablePayload = JSON.stringify(payloadDescriptor);
  assert.doesNotMatch(portablePayload, /schroeder-materialized-state/);
  assert.doesNotMatch(portablePayload, /schroeder-materialized-thermo/);
  assert.doesNotMatch(portablePayload, /schroeder-materialized-mechanics/);
  assert.doesNotMatch(portablePayload, /"stateBuffer":/);
  assert.doesNotMatch(portablePayload, /"thermoBuffer":/);
  assert.doesNotMatch(portablePayload, /"mechanicsBuffer":/);
  assert.doesNotMatch(portablePayload, /"materializationBuffer":/);

  destroyMlsMpmResidentStepsBuffers(result);
  assert.equal(tracker.destroyed, 8);
});

test('MLS-MPM resident steps compute task submit helper uses a ComputeManager-compatible submitTask surface', async () => {
  const { options } = noFullReadbackResidentStepFixture();
  const submitted = [];
  const solverCreateCalls = [];
  const computeManager = {
    solverRegistry: {
      createTask(solverId, input = {}) {
        solverCreateCalls.push({ solverId, input });
        return {
          id: input.id,
          solverId,
          taskFamily: solverId,
          runtime: 'js',
          module: './registered-resident-solver.js',
          exportName: 'runMlsMpmResidentStepsComputeTask',
          webgpu: input.webgpu,
          affinityKey: `${solverId}:${input.stateKey}`,
          data: {
            schema: 'peercompute.compute.solver-task.v0',
            solver: {
              id: solverId,
              kind: 'sph-mls-mpm-resident-pass-dag',
              warmDelta: {
                scope: input.scope,
                schema: 'peercompute.ulg.mls-mpm-resident-steps.delta.v0'
              }
            },
            stateKey: input.stateKey,
            scope: input.scope,
            input: input.input,
            ...input.data
          }
        };
      }
    },
    submitTask(task) {
      submitted.push(task);
      return Promise.resolve({ acceptedTaskId: task.id, laneId: task.gpuResidentLane?.laneId });
    }
  };

  const result = await submitMlsMpmResidentStepsComputeTask({
    computeManager,
    ...options,
    modulePath: './sphMlsMpmGpuStep.js',
    taskId: 'ulg:test:submit-steps-task',
    laneId: 'ulg:test:sph-resident-steps-submit',
    stateKey: 'ulg:test:sph-state-steps-submit',
    stepCount: 2,
    compactSummaryMode: 'final-only',
    fuseNoFullResidentMechanicsSequence: true,
    fuseNoFullResidentMechanicsActiveGrid: true,
    activeGridSafetyCells: 4
  });

  assert.equal(submitted.length, 1);
  assert.equal(solverCreateCalls.length, 1);
  assert.equal(solverCreateCalls[0].solverId, 'ulg-mls-mpm-sph-resident-steps');
  assert.equal(solverCreateCalls[0].input.id, 'ulg:test:submit-steps-task');
  assert.equal(solverCreateCalls[0].input.stateKey, 'ulg:test:sph-state-steps-submit');
  assert.equal(solverCreateCalls[0].input.input.laneId, 'ulg:test:sph-resident-steps-submit');
  assert.equal(solverCreateCalls[0].input.input.stepCount, 2);
  assert.equal(solverCreateCalls[0].input.input.activeGridDispatchPolicy.enabled, true);
  assert.equal(solverCreateCalls[0].input.input.activeGridDispatchPolicy.safetyCells, 4);
  assert.equal(solverCreateCalls[0].input.input.residentSequenceLaneContract.sequenceRunnable, true);
  assert.equal(
    solverCreateCalls[0].input.input.residentSequenceLaneContract.sequenceMode,
    'fused-no-full-active-grid-mechanics-sequence'
  );
  assert.equal(submitted[0].schema, ULG_MLS_MPM_RESIDENT_STEPS_COMPUTE_TASK_SCHEMA);
  assert.equal(submitted[0].module, './registered-resident-solver.js');
  assert.equal(submitted[0].data.schema, 'peercompute.compute.solver-task.v0');
  assert.equal(submitted[0].peerComputeSolverTask.schema, ULG_MLS_MPM_RESIDENT_STEPS_SOLVER_TASK_BRIDGE_SCHEMA);
  assert.equal(submitted[0].peerComputeSolverTask.created, true);
  assert.equal(submitted[0].peerComputeSolverTask.solverTaskSchema, 'peercompute.compute.solver-task.v0');
  assert.equal(submitted[0].peerComputeSolverTask.affinityKey, 'ulg-mls-mpm-sph-resident-steps:ulg:test:sph-state-steps-submit');
  assert.equal(submitted[0].data.peerComputeSolverTask.created, true);
  assert.equal(submitted[0].gpuResidentLane.laneId, 'ulg:test:sph-resident-steps-submit');
  assert.equal(submitted[0].gpuResidentLane.activeGridDispatchPolicy.enabled, true);
  assert.equal(submitted[0].gpuResidentLane.residentSequenceLaneContract.sequenceRunnable, true);
  assert.equal(submitted[0].gpuResidentLane.residentSequenceLaneContract.activeGridDispatchPolicy.enabled, true);
  assert.equal(submitted[0].gpuResidentLane.residentSequenceLaneContract.defaultEnabled, false);
  assert.equal(submitted[0].webgpu.activeGridDispatchPolicy.enabled, true);
  assert.equal(submitted[0].webgpu.residentSequenceLaneContract.sequenceMode, 'fused-no-full-active-grid-mechanics-sequence');
  assert.equal(submitted[0].data.activeGridDispatchPolicy.enabled, true);
  assert.equal(submitted[0].data.residentSequenceLaneContract.promotionStatus, 'active-grid-opt-in-scene-evidence-ready');
  assert.equal(submitted[0].data.activeGridDispatchPolicy.requiresFusedResidentSequence, true);
  assert.equal(submitted[0].gpuFence.stateKey, 'ulg:test:sph-state-steps-submit');
  assert.equal(submitted[0].lawGraphNode.nodeId, 'ulg-mls-mpm-sph-resident-pass-dag');
  assert.equal(submitted[0].data.gpuResidentLane.laneId, 'ulg:test:sph-resident-steps-submit');
  assert.equal(submitted[0].data.gpuFenceRequirement.stateKey, 'ulg:test:sph-state-steps-submit');
  assert.deepEqual(result, {
    acceptedTaskId: 'ulg:test:submit-steps-task',
    laneId: 'ulg:test:sph-resident-steps-submit'
  });
});

test('MLS-MPM resident step can attach a compact GPU summary without full state readback', async () => {
  const buffers = manualBuffers();
  const tracker = fakeBufferTracker();
  const sourceThermoBuffer = tracker.buffer('source-thermo');
  let summaryCalls = 0;
  const step = await runMlsMpmResidentStepWithOptionalWebGpu({
    ...buffers,
    sphParticleUpload: {
      status: 'webgpu-uploaded',
      stateBuffer: tracker.buffer('source-state'),
      thermoBuffer: sourceThermoBuffer,
      slot: 0
    },
    mlsMpmParticleUpload: {
      status: 'webgpu-uploaded',
      mechanicsBuffer: tracker.buffer('source-mechanics'),
      slot: 0
    },
    preferWebGpu: true,
    navigatorRef: webGpuNavigator(),
    boxDimsM: [3, 3, 3],
    readbackMode: 'no-full-readback',
    compactSummaryScope: 'particle-visual',
    p2gRunner() {
      return {
        schema: ULG_MLS_MPM_GPU_GRID_PROJECTION_SCHEMA,
        backend: 'webgpu',
        status: 'projected',
        particleCount: buffers.sphParticleState.particleCount,
        dt: buffers.mlsMpmParticleState.mechanicsDtS,
        gridSpacingM: buffers.sphParticleState.smoothingLengthM,
        gridDims: [8, 8, 8],
        gridNodeCount: 512,
        gridShift: 1,
        gridNodeStrideFloats: 8,
        gridNodes: new Float32Array(),
        gridBuffer: tracker.buffer('p2g-grid-summary'),
        gridBufferByteLength: 512 * 8 * Float32Array.BYTES_PER_ELEMENT,
        readbackMode: 'no-full-readback',
        normalHotLoopReadbackFree: true,
        destroyGridBuffer() {
          this.gridBuffer.destroy();
        }
      };
    },
    gridUpdateRunner(args) {
      return {
        schema: ULG_MLS_MPM_GPU_GRID_UPDATE_SCHEMA,
        backend: 'webgpu',
        status: 'updated',
        sourceSchema: args.p2gGridProjection.schema,
        particleCount: buffers.sphParticleState.particleCount,
        dt: buffers.mlsMpmParticleState.mechanicsDtS,
        gridSpacingM: buffers.sphParticleState.smoothingLengthM,
        gridDims: [8, 8, 8],
        gridNodeCount: 512,
        gridShift: 1,
        gridNodeStrideFloats: 8,
        updatedGridNodes: new Float32Array(),
        updatedGridBuffer: tracker.buffer('updated-grid-summary'),
        updatedGridBufferByteLength: 512 * 8 * Float32Array.BYTES_PER_ELEMENT,
        readbackMode: 'no-full-readback',
        normalHotLoopReadbackFree: true,
        destroyUpdatedGridBuffer() {
          this.updatedGridBuffer.destroy();
        }
      };
    },
    g2pRunner(args) {
      return {
        schema: ULG_MLS_MPM_GPU_G2P_RECONSTRUCTION_SCHEMA,
        backend: 'webgpu',
        status: 'reconstructed',
        particleCount: buffers.sphParticleState.particleCount,
        gridNodeCount: 512,
        gridSpacingM: buffers.sphParticleState.smoothingLengthM,
        gridDims: [8, 8, 8],
        gridShift: 1,
        dt: buffers.mlsMpmParticleState.mechanicsDtS,
        stateStrideFloats: 8,
        thermoStrideFloats: 12,
        mechanicsStrideFloats: 32,
        state: new Float32Array(),
        mechanics: new Float32Array(),
        stateBuffer: tracker.buffer('g2p-state-summary'),
        mechanicsBuffer: tracker.buffer('g2p-mechanics-summary'),
        stateBufferByteLength: buffers.sphParticleState.state.byteLength,
        mechanicsBufferByteLength: buffers.mlsMpmParticleState.mechanics.byteLength,
        retainedOutputParticleBuffers: true,
        readbackMode: 'no-full-readback',
        normalHotLoopReadbackFree: true,
        destroyOutputParticleBuffers() {
          this.stateBuffer.destroy();
          this.mechanicsBuffer.destroy();
        }
      };
    },
    summaryRunner(args) {
      summaryCalls += 1;
      assert.equal(args.summaryScope, 'particle-visual');
      assert.equal(args.sphParticleUpload.stateBuffer.label, 'source-state');
      assert.equal(args.mlsMpmParticleUpload.mechanicsBuffer.label, 'source-mechanics');
      assert.equal(args.gridUpdate.gpuResult.updatedGridBuffer.label, 'updated-grid-summary');
      assert.equal(args.g2pReconstruction.stateBuffer.label, 'g2p-state-summary');
      assert.equal(args.g2pReconstruction.mechanicsBuffer.label, 'g2p-mechanics-summary');
      return {
        schema: ULG_MLS_MPM_GPU_RESIDENT_SUMMARY_SCHEMA,
        backend: 'webgpu',
        status: 'compact-summary-ready',
        summaryScope: 'particle-visual',
        particleCount: 1,
        gridNodeCount: 512,
        gridNodeScanCount: 0,
        gridNodeScanSkipped: true,
        activeGridNodeCount: null,
        activeGridNodeCountAvailable: false,
        activeGridNodeSummaryStatus: 'active-grid-node-summary-not-requested',
        sourceMassKg: 8,
        nextMassKg: 8,
        massDeltaKg: 0,
        sourceMomentumKgMPerS: [16, 0, 0],
        nextMomentumKgMPerS: [15, 0, 0],
        momentumDeltaKgMPerS: [-1, 0, 0],
        maxSpeedMPerS: 1.875,
        maxDisplacementM: 0.1875,
        minVolumeRatioJ: 0.98,
        maxVolumeRatioJ: 1.02,
        phaseMassKg: { solid: 3, liquid: 4, gas: 1, plasma: 0 },
        temperatureMassWeightedMeanK: 420,
        minTemperatureK: 273,
        maxTemperatureK: 1200,
        thermalReadyCount: 1,
        thermalProblemCount: 0,
        finiteTemperatureCount: 1,
        phaseMassTotalKg: 8,
        thermalPhaseSummaryAvailable: true,
        thermalSummaryStatus: 'thermal-phase-summary-ready',
        readbackMode: 'compact-summary-readback',
        compactGpuSummaryAvailable: true,
        compactReadbackByteLength: MLS_MPM_GPU_RESIDENT_SUMMARY_BYTES,
        reductionStrategy: 'two-pass-workgroup-reduction',
        scientificValidation: false,
        sphValidation: false,
        phaseChangeValidation: false,
        fullPhysicsValidation: false
      };
    }
  });

  assert.equal(summaryCalls, 1);
  assert.equal(step.readbackMode, 'no-full-readback');
  assert.equal(step.state.length, 0);
  assert.equal(step.mechanics.length, 0);
  assert.equal(step.compactGpuSummary.status, 'compact-summary-ready', step.compactGpuSummary.reason);
  assert.equal(step.diagnostics.compactGpuSummaryAvailable, true);
  assert.equal(step.diagnostics.compactGpuSummaryStatus, 'compact-summary-ready');
  assert.equal(step.diagnostics.compactGpuSummaryReadbackMode, 'compact-summary-readback');
  assert.equal(step.diagnostics.compactSummaryScope, 'particle-visual');
  assert.equal(step.diagnostics.activeGridNodeCountAvailable, false);
  assert.equal(step.diagnostics.activeGridNodeSummaryStatus, 'active-grid-node-summary-not-requested');
  assert.equal(step.diagnostics.gridNodeScanCount, 0);
  assert.equal(step.diagnostics.gridNodeScanSkipped, true);
  assert.equal(step.diagnostics.compactReadbackByteLength, MLS_MPM_GPU_RESIDENT_SUMMARY_BYTES);
  assert.equal(step.diagnostics.compactSummaryReductionStrategy, 'two-pass-workgroup-reduction');
  assert.equal(step.diagnostics.activeGridNodeCount, null);
  assert.equal(step.stageTiming.compactSummaryScope, 'particle-visual');
  assert.equal(step.diagnostics.massDeltaKg, 0);
  assert.equal(step.diagnostics.maxSpeedMPerS, 1.875);
  assert.deepEqual(step.diagnostics.phaseMassKg, { solid: 3, liquid: 4, gas: 1, plasma: 0 });
  assert.equal(step.diagnostics.temperatureMassWeightedMeanK, 420);
  assert.equal(step.diagnostics.thermalReadyCount, 1);
  assert.equal(step.diagnostics.thermalProblemCount, 0);
  assert.equal(step.diagnostics.thermalPhaseSummaryAvailable, true);
  assert.deepEqual(step.diagnostics.momentumDeltaKgMPerS, [-1, 0, 0]);
  assert.equal(step.nextParticleUploads.sphParticleUpload.thermoBuffer, sourceThermoBuffer);
  destroyMlsMpmResidentStepBuffers(step);
  assert.equal(tracker.destroyed, 4);
});

test('MLS-MPM resident step can refresh SPH state and thermo through a retained thermal GPU step', async () => {
  const buffers = manualBuffers();
  const tracker = fakeBufferTracker();
  const sourceThermoBuffer = tracker.buffer('source-thermo');
  const thermalResponseGraphUpload = {
    schema: ULG_SPH_GPU_THERMAL_RESPONSE_GRAPH_BUFFER_SET_SCHEMA,
    status: 'webgpu-uploaded',
    responseCount: 3,
    graphCount: 3
  };
  let thermalCalls = 0;
  const step = await runMlsMpmResidentStepWithOptionalWebGpu({
    ...buffers,
    sphParticleUpload: {
      status: 'webgpu-uploaded',
      stateBuffer: tracker.buffer('source-state'),
      thermoBuffer: sourceThermoBuffer,
      slot: 0
    },
    mlsMpmParticleUpload: {
      status: 'webgpu-uploaded',
      mechanicsBuffer: tracker.buffer('source-mechanics'),
      slot: 0
    },
    preferWebGpu: true,
    navigatorRef: webGpuNavigator(),
    boxDimsM: [3, 3, 3],
    readbackMode: 'no-full-readback',
    thermalMaterialTable: { schema: 'peercompute.ulg.sph-gpu-thermal-material-table.v0' },
    thermalStepOptions: {
      thermalResponseGraphUpload
    },
    p2gRunner() {
      return {
        schema: ULG_MLS_MPM_GPU_GRID_PROJECTION_SCHEMA,
        backend: 'webgpu',
        status: 'projected',
        particleCount: buffers.sphParticleState.particleCount,
        dt: buffers.mlsMpmParticleState.mechanicsDtS,
        gridSpacingM: buffers.sphParticleState.smoothingLengthM,
        gridDims: [8, 8, 8],
        gridNodeCount: 512,
        gridShift: 1,
        gridNodeStrideFloats: 8,
        gridNodes: new Float32Array(),
        gridBuffer: tracker.buffer('p2g-grid-thermal'),
        gridBufferByteLength: 512 * 8 * Float32Array.BYTES_PER_ELEMENT,
        readbackMode: 'no-full-readback',
        normalHotLoopReadbackFree: true,
        destroyGridBuffer() {
          this.gridBuffer.destroy();
        }
      };
    },
    gridUpdateRunner(args) {
      return {
        schema: ULG_MLS_MPM_GPU_GRID_UPDATE_SCHEMA,
        backend: 'webgpu',
        status: 'updated',
        sourceSchema: args.p2gGridProjection.schema,
        particleCount: buffers.sphParticleState.particleCount,
        dt: buffers.mlsMpmParticleState.mechanicsDtS,
        gridSpacingM: buffers.sphParticleState.smoothingLengthM,
        gridDims: [8, 8, 8],
        gridNodeCount: 512,
        gridShift: 1,
        gridNodeStrideFloats: 8,
        updatedGridNodes: new Float32Array(),
        updatedGridBuffer: tracker.buffer('updated-grid-thermal'),
        updatedGridBufferByteLength: 512 * 8 * Float32Array.BYTES_PER_ELEMENT,
        readbackMode: 'no-full-readback',
        normalHotLoopReadbackFree: true,
        destroyUpdatedGridBuffer() {
          this.updatedGridBuffer.destroy();
        }
      };
    },
    g2pRunner() {
      return {
        schema: ULG_MLS_MPM_GPU_G2P_RECONSTRUCTION_SCHEMA,
        backend: 'webgpu',
        status: 'reconstructed',
        particleCount: buffers.sphParticleState.particleCount,
        gridNodeCount: 512,
        gridSpacingM: buffers.sphParticleState.smoothingLengthM,
        gridDims: [8, 8, 8],
        gridShift: 1,
        dt: buffers.mlsMpmParticleState.mechanicsDtS,
        stateStrideFloats: 8,
        thermoStrideFloats: 12,
        mechanicsStrideFloats: 32,
        state: new Float32Array(),
        mechanics: new Float32Array(),
        stateBuffer: tracker.buffer('g2p-state-before-thermal'),
        mechanicsBuffer: tracker.buffer('g2p-mechanics-after-thermal'),
        stateBufferByteLength: buffers.sphParticleState.state.byteLength,
        mechanicsBufferByteLength: buffers.mlsMpmParticleState.mechanics.byteLength,
        retainedOutputParticleBuffers: true,
        readbackMode: 'no-full-readback',
        normalHotLoopReadbackFree: true,
        destroyOutputParticleBuffers() {
          this.stateBuffer.destroy();
          this.mechanicsBuffer.destroy();
        }
      };
    },
    thermalStepRunner(args) {
      thermalCalls += 1;
      assert.equal(args.sourceStateBuffer.label, 'g2p-state-before-thermal');
      assert.equal(args.sourceThermoBuffer, sourceThermoBuffer);
      assert.equal(args.readbackMode, 'no-full-readback');
      assert.equal(args.retainOutputParticleBuffers, true);
      assert.equal(args.thermalResponseGraphUpload, thermalResponseGraphUpload);
      return {
        schema: ULG_SPH_GPU_THERMAL_STEP_SCHEMA,
        backend: 'webgpu',
        status: 'thermal-step-executed',
        particleCount: buffers.sphParticleState.particleCount,
        state: new Float32Array(),
        thermo: new Float32Array(),
        stateBuffer: tracker.buffer('thermal-state-after-g2p'),
        thermoBuffer: tracker.buffer('thermal-thermo-after-g2p'),
        stateBufferByteLength: buffers.sphParticleState.state.byteLength,
        thermoBufferByteLength: buffers.sphParticleState.thermo.byteLength,
        retainedOutputParticleBuffers: true,
        readbackMode: 'no-full-readback',
        normalHotLoopReadbackFree: true,
        destroyOutputParticleBuffers() {
          this.stateBuffer.destroy();
          this.thermoBuffer.destroy();
        },
        scientificValidation: false,
        phaseChangeValidation: false,
        fullPhysicsValidation: false
      };
    }
  });

  assert.equal(thermalCalls, 1);
  assert.equal(step.stageStatus.thermal, 'thermal-step-executed');
  assert.equal(step.stageBackends.thermal, 'webgpu');
  assert.equal(step.g2pStateBufferReplacedByThermalStep, true);
  assert.equal(step.thermalStateBufferHandoffStatus, 'thermal-state-buffer-drives-next-particles');
  assert.equal(step.thermalThermoBufferHandoffStatus, 'thermal-thermo-buffer-drives-next-particles');
  assert.equal(step.thermalMechanicsRefreshStatus, 'mechanics-constitutive-refresh-pending-after-thermal-state');
  assert.ok(step.residentAuthorityWarnings.includes('mechanics-constitutive-refresh-pending-after-thermal-state'));
  assert.equal(step.diagnostics.thermalMechanicsRefreshStatus, 'mechanics-constitutive-refresh-pending-after-thermal-state');
  assert.equal(step.nextParticleBufferMode, 'retained-thermal-output-and-g2p-mechanics-buffers');
  assert.equal(step.nextParticleUploads.sphParticleUpload.stateBuffer.label, 'thermal-state-after-g2p');
  assert.equal(step.nextParticleUploads.sphParticleUpload.thermoBuffer.label, 'thermal-thermo-after-g2p');
  assert.equal(step.nextParticleUploads.sphParticleUpload.ownsThermoBuffer, true);
  assert.equal(step.nextParticleUploads.mlsMpmParticleUpload.mechanicsBuffer.label, 'g2p-mechanics-after-thermal');
  assert.equal(step.nextParticleThermoBufferByteLength, buffers.sphParticleState.thermo.byteLength);
  assert.equal(tracker.destroyed, 0);
  destroyMlsMpmResidentStepBuffers(step);
  assert.equal(tracker.destroyed, 6);
});

test('MLS-MPM resident step refreshes mechanics after a retained thermal GPU step', async () => {
  const buffers = manualBuffers();
  const tracker = fakeBufferTracker();
  const sourceThermoBuffer = tracker.buffer('source-thermo');
  const thermalResponseGraphUpload = {
    schema: ULG_SPH_GPU_THERMAL_RESPONSE_GRAPH_BUFFER_SET_SCHEMA,
    status: 'webgpu-uploaded',
    responseCount: 3,
    graphCount: 3
  };
  const mechanicsMaterialTable = buildMlsMpmMechanicsMaterialTable({
    h2o: {
      molarMassKgPerMol: 0.018,
      phases: [
        { name: 'liquid', densityKgPerM3: 1000, bulkModulusPa: 2.2e9, shearModulusPa: 0, cpJPerKgK: 4184, temperatureRange: [273.15, 373.15] }
      ]
    }
  });
  let mechanicsRefreshCalls = 0;
  const step = await runMlsMpmResidentStepWithOptionalWebGpu({
    ...buffers,
    sphParticleUpload: {
      status: 'webgpu-uploaded',
      stateBuffer: tracker.buffer('source-state'),
      thermoBuffer: sourceThermoBuffer,
      slot: 0
    },
    mlsMpmParticleUpload: {
      status: 'webgpu-uploaded',
      mechanicsBuffer: tracker.buffer('source-mechanics'),
      slot: 0
    },
    preferWebGpu: true,
    navigatorRef: webGpuNavigator(),
    boxDimsM: [3, 3, 3],
    readbackMode: 'no-full-readback',
    sidecarFusionPlan: {
      schema: 'peercompute.ulg.mls-mpm-fused-resident-sidecar-plan.v0',
      status: 'sidecar-fusion-plan-ready-execution-blocked',
      required: true,
      sidecarFusionRunnable: false,
      sidecarBlockers: ['thermal-sidecar'],
      requiredStageOrder: [
        'mechanics-p2g',
        'mechanics-grid-update',
        'mechanics-g2p',
        'thermal-phase',
        'mechanics-refresh',
        'resident-compact-summary-or-active-grid-plan'
      ],
      stages: [
        { id: 'thermal-phase', blocker: 'thermal-sidecar', lawNodeId: 'ulg-sph-thermal-phase-law' },
        { id: 'mechanics-refresh', blocker: 'thermal-sidecar', lawNodeId: 'ulg-mls-mpm-mechanics-refresh-law' }
      ]
    },
    thermalMaterialTable: { schema: 'peercompute.ulg.sph-gpu-thermal-material-table.v0' },
    mechanicsMaterialTable,
    thermalStepOptions: {
      thermalResponseGraphUpload
    },
    p2gRunner() {
      return {
        schema: ULG_MLS_MPM_GPU_GRID_PROJECTION_SCHEMA,
        backend: 'webgpu',
        status: 'projected',
        particleCount: buffers.sphParticleState.particleCount,
        dt: buffers.mlsMpmParticleState.mechanicsDtS,
        gridSpacingM: buffers.sphParticleState.smoothingLengthM,
        gridDims: [8, 8, 8],
        gridNodeCount: 512,
        gridShift: 1,
        gridNodeStrideFloats: 8,
        gridNodes: new Float32Array(),
        gridBuffer: tracker.buffer('p2g-grid-mechanics-refresh'),
        gridBufferByteLength: 512 * 8 * Float32Array.BYTES_PER_ELEMENT,
        readbackMode: 'no-full-readback',
        normalHotLoopReadbackFree: true,
        destroyGridBuffer() {
          this.gridBuffer.destroy();
        }
      };
    },
    gridUpdateRunner(args) {
      return {
        schema: ULG_MLS_MPM_GPU_GRID_UPDATE_SCHEMA,
        backend: 'webgpu',
        status: 'updated',
        sourceSchema: args.p2gGridProjection.schema,
        particleCount: buffers.sphParticleState.particleCount,
        dt: buffers.mlsMpmParticleState.mechanicsDtS,
        gridSpacingM: buffers.sphParticleState.smoothingLengthM,
        gridDims: [8, 8, 8],
        gridNodeCount: 512,
        gridShift: 1,
        gridNodeStrideFloats: 8,
        updatedGridNodes: new Float32Array(),
        updatedGridBuffer: tracker.buffer('updated-grid-mechanics-refresh'),
        updatedGridBufferByteLength: 512 * 8 * Float32Array.BYTES_PER_ELEMENT,
        readbackMode: 'no-full-readback',
        normalHotLoopReadbackFree: true,
        destroyUpdatedGridBuffer() {
          this.updatedGridBuffer.destroy();
        }
      };
    },
    g2pRunner() {
      return {
        schema: ULG_MLS_MPM_GPU_G2P_RECONSTRUCTION_SCHEMA,
        backend: 'webgpu',
        status: 'reconstructed',
        particleCount: buffers.sphParticleState.particleCount,
        gridNodeCount: 512,
        gridSpacingM: buffers.sphParticleState.smoothingLengthM,
        gridDims: [8, 8, 8],
        gridShift: 1,
        dt: buffers.mlsMpmParticleState.mechanicsDtS,
        stateStrideFloats: 8,
        thermoStrideFloats: 12,
        mechanicsStrideFloats: 32,
        state: new Float32Array(),
        mechanics: new Float32Array(),
        stateBuffer: tracker.buffer('g2p-state-before-mechanics-refresh'),
        mechanicsBuffer: tracker.buffer('g2p-mechanics-before-refresh'),
        stateBufferByteLength: buffers.sphParticleState.state.byteLength,
        mechanicsBufferByteLength: buffers.mlsMpmParticleState.mechanics.byteLength,
        retainedOutputParticleBuffers: true,
        readbackMode: 'no-full-readback',
        normalHotLoopReadbackFree: true
      };
    },
    thermalStepRunner() {
      return {
        schema: ULG_SPH_GPU_THERMAL_STEP_SCHEMA,
        backend: 'webgpu',
        status: 'thermal-step-executed',
        phaseTransitionStatus: 'thermal-phase-transition-applied',
        phaseTransitionCount: 1,
        phaseTransitionSourcePhaseId: 1,
        phaseTransitionNextPhaseId: 2,
        particleCount: buffers.sphParticleState.particleCount,
        state: new Float32Array(),
        thermo: new Float32Array(),
        stateBuffer: tracker.buffer('thermal-state-for-mechanics-refresh'),
        thermoBuffer: tracker.buffer('thermal-thermo-for-mechanics-refresh'),
        stateBufferByteLength: buffers.sphParticleState.state.byteLength,
        thermoBufferByteLength: buffers.sphParticleState.thermo.byteLength,
        retainedOutputParticleBuffers: true,
        readbackMode: 'no-full-readback',
        normalHotLoopReadbackFree: true
      };
    },
    mechanicsRefreshRunner(args) {
      mechanicsRefreshCalls += 1;
      assert.equal(args.sourceStateBuffer.label, 'thermal-state-for-mechanics-refresh');
      assert.equal(args.sourceThermoBuffer.label, 'thermal-thermo-for-mechanics-refresh');
      assert.equal(args.sourceMechanicsBuffer.label, 'g2p-mechanics-before-refresh');
      assert.equal(args.mechanicsMaterialTable, mechanicsMaterialTable);
      assert.equal(args.readbackMode, 'no-full-readback');
      assert.equal(args.retainOutputParticleBuffers, true);
      return {
        schema: 'peercompute.ulg.mls-mpm-mechanics-refresh.v0',
        backend: 'webgpu',
        status: 'mechanics-constitutive-refresh-executed',
        particleCount: buffers.sphParticleState.particleCount,
        mechanics: new Float32Array(),
        mechanicsBuffer: tracker.buffer('refreshed-mechanics-after-thermal'),
        mechanicsBufferByteLength: buffers.mlsMpmParticleState.mechanics.byteLength,
        retainedOutputParticleBuffers: true,
        readbackMode: 'no-full-readback',
        normalHotLoopReadbackFree: true
      };
    }
  });

  assert.equal(mechanicsRefreshCalls, 1);
  assert.equal(step.stageStatus.mechanicsRefresh, 'mechanics-constitutive-refresh-executed');
  assert.equal(step.stageBackends.mechanicsRefresh, 'webgpu');
  assert.equal(step.sidecarFusionStepEvidence.status, 'sidecar-fusion-step-evidence-ready');
  assert.equal(step.sidecarFusionStepEvidence.stageCount, 2);
  assert.equal(step.sidecarFusionStepEvidence.executedStageCount, 2);
  assert.equal(step.sidecarFusionStepEvidence.passedStageCount, 2);
  assert.equal(step.sidecarFusionStepEvidence.allRequiredStagesPassed, true);
  assert.equal(step.sidecarFusionStepEvidence.promotesFusedSequence, false);
  assert.equal(step.stageTiming.sidecarFusionStepEvidence.status, 'sidecar-fusion-step-evidence-ready');
  assert.equal(step.diagnostics.sidecarFusionStepEvidencePassedStageCount, 2);
  assert.equal(step.thermalMechanicsRefreshStatus, 'mechanics-constitutive-refreshed-after-thermal-state');
  assert.equal(step.diagnostics.thermalMechanicsRefreshStatus, 'mechanics-constitutive-refreshed-after-thermal-state');
  assert.equal(step.thermalPhaseTransitionStatus, 'thermal-phase-transition-applied');
  assert.equal(step.thermalPhaseTransitionCount, 1);
  assert.equal(step.thermalPhaseTransitionRowsRetained, true);
  assert.equal(step.thermalPhaseTransitionSourcePhaseId, 1);
  assert.equal(step.thermalPhaseTransitionNextPhaseId, 2);
  assert.equal(step.thermalPhaseTransitionCouplingStatus, 'phase-transition-thermal-thermo-mechanics-advanced');
  assert.equal(step.diagnostics.thermalPhaseTransitionStatus, 'thermal-phase-transition-applied');
  assert.equal(step.diagnostics.thermalPhaseTransitionCount, 1);
  assert.equal(step.diagnostics.thermalPhaseTransitionRowsRetained, true);
  assert.equal(step.diagnostics.thermalPhaseTransitionCouplingStatus, 'phase-transition-thermal-thermo-mechanics-advanced');
  assert.equal(step.g2pMechanicsBufferReplacedByMechanicsRefresh, true);
  assert.equal(step.nextParticleBufferMode, 'retained-thermal-output-and-refreshed-mechanics-buffers');
  assert.equal(step.nextParticleUploads.sphParticleUpload.stateBuffer.label, 'thermal-state-for-mechanics-refresh');
  assert.equal(step.nextParticleUploads.sphParticleUpload.thermoBuffer.label, 'thermal-thermo-for-mechanics-refresh');
  assert.equal(step.nextParticleUploads.mlsMpmParticleUpload.mechanicsBuffer.label, 'refreshed-mechanics-after-thermal');
  assert.equal(step.residentAuthorityFamilyOwners.mechanics.ownerStage, 'mechanics-constitutive-refresh');
  assert.equal(step.residentAuthorityFamilyOwners.mechanics.status, 'mechanics-constitutive-refresh-drives-next-particles');
  assert.equal(step.residentAuthorityWarnings.includes('mechanics-constitutive-refresh-pending-after-thermal-state'), false);
  assert.equal(step.residentAuthorityWarnings.includes('thermal-stage-not-mechanics-authority'), false);
  assert.equal(tracker.destroyed, 0);
  destroyMlsMpmResidentStepBuffers(step);
  assert.equal(tracker.destroyed, 7);
});

test('MLS-MPM resident no-full step runs reaction from retained GPU buffers', async () => {
  const buffers = manualBuffers();
  const tracker = fakeBufferTracker();
  const sourceThermoBuffer = tracker.buffer('source-thermo');
  const thermalResponseGraphUpload = {
    schema: ULG_SPH_GPU_THERMAL_RESPONSE_GRAPH_BUFFER_SET_SCHEMA,
    status: 'webgpu-uploaded',
    responseCount: 3,
    graphCount: 3
  };
  const mechanicsMaterialTable = buildMlsMpmMechanicsMaterialTable({
    h2o: {
      molarMassKgPerMol: 0.018,
      phases: [
        { name: 'liquid', densityKgPerM3: 1000, bulkModulusPa: 2.2e9, shearModulusPa: 0, cpJPerKgK: 4184, temperatureRange: [273.15, 373.15] }
      ]
    }
  });
  let reactionCalls = 0;
  let mechanicsRefreshCalls = 0;
  let thermalDestroyCalls = 0;
  const step = await runMlsMpmResidentStepWithOptionalWebGpu({
    ...buffers,
    sphParticleUpload: {
      status: 'webgpu-uploaded',
      stateBuffer: tracker.buffer('source-state'),
      thermoBuffer: sourceThermoBuffer,
      slot: 0
    },
    mlsMpmParticleUpload: {
      status: 'webgpu-uploaded',
      mechanicsBuffer: tracker.buffer('source-mechanics'),
      slot: 0
    },
    preferWebGpu: true,
    navigatorRef: webGpuNavigator(),
    boxDimsM: [3, 3, 3],
    readbackMode: 'no-full-readback',
    thermalMaterialTable: { schema: 'peercompute.ulg.sph-gpu-thermal-material-table.v0' },
    mechanicsMaterialTable,
    reactionParticleBinMetadataReadback: true,
    reactionTable: { schema: 'peercompute.ulg.sph-gpu-reaction-table.v1', reactionCount: 1 },
    thermalStepOptions: {
      thermalResponseGraphUpload
    },
    reactionStepOptions: {
      thermalResponseGraphUpload
    },
    p2gRunner() {
      return {
        schema: ULG_MLS_MPM_GPU_GRID_PROJECTION_SCHEMA,
        backend: 'webgpu',
        status: 'projected',
        particleCount: buffers.sphParticleState.particleCount,
        dt: buffers.mlsMpmParticleState.mechanicsDtS,
        gridSpacingM: buffers.sphParticleState.smoothingLengthM,
        gridDims: [8, 8, 8],
        gridNodeCount: 512,
        gridShift: 1,
        gridNodeStrideFloats: 8,
        gridNodes: new Float32Array(),
        gridBuffer: tracker.buffer('p2g-grid-reaction'),
        gridBufferByteLength: 512 * 8 * Float32Array.BYTES_PER_ELEMENT,
        readbackMode: 'no-full-readback',
        normalHotLoopReadbackFree: true,
        destroyGridBuffer() {
          this.gridBuffer.destroy();
        }
      };
    },
    gridUpdateRunner(args) {
      return {
        schema: ULG_MLS_MPM_GPU_GRID_UPDATE_SCHEMA,
        backend: 'webgpu',
        status: 'updated',
        sourceSchema: args.p2gGridProjection.schema,
        particleCount: buffers.sphParticleState.particleCount,
        dt: buffers.mlsMpmParticleState.mechanicsDtS,
        gridSpacingM: buffers.sphParticleState.smoothingLengthM,
        gridDims: [8, 8, 8],
        gridNodeCount: 512,
        gridShift: 1,
        gridNodeStrideFloats: 8,
        updatedGridNodes: new Float32Array(),
        updatedGridBuffer: tracker.buffer('updated-grid-reaction'),
        updatedGridBufferByteLength: 512 * 8 * Float32Array.BYTES_PER_ELEMENT,
        readbackMode: 'no-full-readback',
        normalHotLoopReadbackFree: true,
        destroyUpdatedGridBuffer() {
          this.updatedGridBuffer.destroy();
        }
      };
    },
    g2pRunner() {
      return {
        schema: ULG_MLS_MPM_GPU_G2P_RECONSTRUCTION_SCHEMA,
        backend: 'webgpu',
        status: 'reconstructed',
        particleCount: buffers.sphParticleState.particleCount,
        gridNodeCount: 512,
        gridSpacingM: buffers.sphParticleState.smoothingLengthM,
        gridDims: [8, 8, 8],
        gridShift: 1,
        dt: buffers.mlsMpmParticleState.mechanicsDtS,
        stateStrideFloats: 8,
        thermoStrideFloats: 12,
        mechanicsStrideFloats: 32,
        state: new Float32Array(),
        mechanics: new Float32Array(),
        stateBuffer: tracker.buffer('g2p-state-before-thermal'),
        mechanicsBuffer: tracker.buffer('g2p-mechanics-before-reaction'),
        stateBufferByteLength: buffers.sphParticleState.state.byteLength,
        mechanicsBufferByteLength: buffers.mlsMpmParticleState.mechanics.byteLength,
        retainedOutputParticleBuffers: true,
        readbackMode: 'no-full-readback',
        normalHotLoopReadbackFree: true,
        destroyOutputParticleBuffers() {
          this.stateBuffer.destroy();
          this.mechanicsBuffer.destroy();
        }
      };
    },
    thermalStepRunner(args) {
      assert.equal(args.thermalResponseGraphUpload, thermalResponseGraphUpload);
      const thermalStateBuffer = tracker.buffer('thermal-state-before-reaction');
      const thermalThermoBuffer = tracker.buffer('thermal-thermo-before-reaction');
      return {
        schema: ULG_SPH_GPU_THERMAL_STEP_SCHEMA,
        backend: 'webgpu',
        status: 'thermal-step-executed',
        particleCount: buffers.sphParticleState.particleCount,
        state: new Float32Array(),
        thermo: new Float32Array(),
        stateBuffer: thermalStateBuffer,
        thermoBuffer: thermalThermoBuffer,
        stateBufferByteLength: buffers.sphParticleState.state.byteLength,
        thermoBufferByteLength: buffers.sphParticleState.thermo.byteLength,
        retainedOutputParticleBuffers: true,
        readbackMode: args.readbackMode,
        normalHotLoopReadbackFree: true,
        destroyOutputParticleBuffers() {
          thermalDestroyCalls += 1;
          thermalStateBuffer.destroy();
          thermalThermoBuffer.destroy();
        }
      };
    },
    reactionStepRunner(args) {
      reactionCalls += 1;
      assert.equal(args.sourceStateBuffer.label, 'thermal-state-before-reaction');
      assert.equal(args.sourceThermoBuffer.label, 'thermal-thermo-before-reaction');
      assert.equal(args.sourceMechanicsBuffer.label, 'g2p-mechanics-before-reaction');
      assert.equal(args.readbackMode, 'no-full-readback');
      assert.equal(args.retainOutputParticleBuffers, true);
      assert.equal(args.readCompactReactionSummary, false);
      assert.equal(args.readReactionGasSpeciesSummary, false);
      assert.equal(args.readReactionProductInventory, false);
      assert.equal(args.readReactionAtomResidual, false);
      assert.equal(args.reactionParticleBinMetadataReadback, true);
      assert.equal(args.thermalResponseGraphUpload, thermalResponseGraphUpload);
      const productEventBuffer = tracker.buffer('reaction-product-events-after-thermal');
      return {
        schema: ULG_SPH_GPU_REACTION_STEP_SCHEMA,
        backend: 'webgpu',
        status: 'reaction-step-executed',
        particleCount: buffers.sphParticleState.particleCount,
        state: new Float32Array(),
        thermo: new Float32Array(),
        mechanics: new Float32Array(),
        stateBuffer: tracker.buffer('reaction-state-after-thermal'),
        thermoBuffer: tracker.buffer('reaction-thermo-after-thermal'),
        mechanicsBuffer: tracker.buffer('reaction-mechanics-after-thermal'),
        stateBufferByteLength: buffers.sphParticleState.state.byteLength,
        thermoBufferByteLength: buffers.sphParticleState.thermo.byteLength,
        mechanicsBufferByteLength: buffers.mlsMpmParticleState.mechanics.byteLength,
        retainedOutputParticleBuffers: true,
        readbackMode: 'no-full-readback',
        normalHotLoopReadbackFree: true,
        reactionSummary: {
          schema: ULG_SPH_GPU_REACTION_SUMMARY_SCHEMA,
          backend: 'webgpu',
          status: 'reaction-compact-summary-ready',
          reactionSummaryAvailable: true,
          visibleProductMassKg: 3,
          visibleGasProductMassKg: 1,
          outputGasPhaseMassKg: 1,
          changedMaterialCount: 2,
          changedMassCount: 1,
          canonicalReactionEventCount: 1,
          consumedReactantMassKg: 6,
          expectedProductMassKg: 6,
          rawProductMassKg: 6.4,
          ledgerVisibleProductMassKg: 5,
          ledgerUnplacedProductMassKg: 1,
          ledgerGasProductMassKg: 1,
          ledgerVisibleGasProductMassKg: 0.5,
          ledgerUnplacedGasProductMassKg: 0.5,
          sealedBoxGasProductMoles: 250,
          reactionHeatJ: 6000,
          ledgerMassResidualKg: 0.4,
          ledgerReadyEventCount: 1,
          ledgerProblemEventCount: 0,
	          proposalMutualPairCount: 1,
	          compactLedgerAvailable: true,
	          productInventoryCount: 2,
	          productInventoryReadbackByteLength: 128,
	          productEventRowCount: 64,
	          productEventActiveEventCount: 1,
	          productEventReadbackByteLength: 0,
	          productEventBufferByteLength: 4096,
	          productEventBufferRetained: true,
	          productEventBuffer,
	          destroyProductEventBuffer() {
	            productEventBuffer.destroy();
	          },
	          productInventory: {
            schema: 'peercompute.ulg.sph-gpu-reaction-product-inventory.v0',
            status: 'product-inventory-compact-ledger-ready',
            recordCount: 2,
            materialCount: 2,
            records: [
              { material: 'ab', materialId: 300, massKg: 5, visibleMassKg: 5, unplacedMassKg: 0, moles: 83.333, productTermIndex: 0 },
              { material: 'c2', materialId: 400, massKg: 1, visibleMassKg: 0.5, unplacedMassKg: 0.5, moles: 250, productTermIndex: 1 }
            ],
            byMaterial: {
              ab: { material: 'ab', materialId: 300, massKg: 5, visibleMassKg: 5, unplacedMassKg: 0, moles: 83.333, productTermIndices: [0] },
              c2: { material: 'c2', materialId: 400, massKg: 1, visibleMassKg: 0.5, unplacedMassKg: 0.5, moles: 250, productTermIndices: [1] }
            },
            fullParticleReadbackPerformed: false
          },
          atomResidualCount: 2,
          atomResidualReadbackByteLength: 64,
          atomResidualSummary: {
            schema: ULG_SPH_GPU_REACTION_ATOM_RESIDUAL_SCHEMA,
            status: 'atom-residual-compact-ledger-ready',
            recordCount: 2,
            maxAbsAtomResidualMol: 0,
            chargeResidualMol: 0,
            atomResidualMolByZ: { 1: 0 },
            records: [
              { reactionIndex: 0, termKind: 'reactant', termIndex: 0, atomicNumberZ: 1, atomResidualMol: -2, chargeResidualMol: 0, eventCount: 1 },
              { reactionIndex: 0, termKind: 'product', termIndex: 0, atomicNumberZ: 1, atomResidualMol: 2, chargeResidualMol: 0, eventCount: 1 }
            ],
            fullParticleReadbackPerformed: false
          },
          strictReactionGate: {
            schema: 'peercompute.ulg.sph-reaction-strict-gate.v0',
            status: 'strict-reaction-gate-pass',
            blockers: [],
            warnings: [],
            strictForceCouplingAllowed: true
          },
          readbackMode: 'compact-reaction-summary-readback',
          compactReadbackByteLength: 128,
          reductionStrategy: 'two-pass-workgroup-reduction',
          visibleOnly: true,
          unplacedProductInventoryIncluded: true
        },
        destroyOutputParticleBuffers() {
          this.stateBuffer.destroy();
          this.thermoBuffer.destroy();
          this.mechanicsBuffer.destroy();
        }
      };
    },
    mechanicsRefreshRunner(args) {
      mechanicsRefreshCalls += 1;
      assert.equal(args.sourceStateBuffer.label, 'reaction-state-after-thermal');
      assert.equal(args.sourceThermoBuffer.label, 'reaction-thermo-after-thermal');
      assert.equal(args.sourceMechanicsBuffer.label, 'reaction-mechanics-after-thermal');
      assert.equal(args.mechanicsMaterialTable, mechanicsMaterialTable);
      assert.equal(args.readbackMode, 'no-full-readback');
      const mechanicsBuffer = tracker.buffer('refreshed-mechanics-after-reaction');
      return {
        schema: 'peercompute.ulg.mls-mpm-mechanics-refresh.v0',
        backend: 'webgpu',
        status: 'mechanics-constitutive-refresh-executed',
        particleCount: buffers.sphParticleState.particleCount,
        mechanics: new Float32Array(),
        mechanicsBuffer,
        mechanicsBufferByteLength: buffers.mlsMpmParticleState.mechanics.byteLength,
        retainedOutputParticleBuffers: true,
        readbackMode: 'no-full-readback',
        normalHotLoopReadbackFree: true,
        destroyOutputParticleBuffers() {
          mechanicsBuffer.destroy();
        }
      };
    }
  });

  assert.equal(reactionCalls, 1);
  assert.equal(mechanicsRefreshCalls, 1);
  assert.equal(step.stageStatus.thermal, 'thermal-step-executed');
  assert.equal(step.stageStatus.reaction, 'reaction-step-executed');
  assert.equal(step.stageBackends.reaction, 'webgpu');
  assert.equal(step.thermalOutputReplacedByReactionStep, true);
  assert.equal(step.g2pMechanicsBufferReplacedByReactionStep, false);
  assert.equal(step.g2pMechanicsBufferReplacedByMechanicsRefresh, true);
  assert.equal(
    step.thermalMechanicsRefreshStatus,
    'mechanics-constitutive-refreshed-after-reaction-output'
  );
  assert.equal(
    step.nextParticleBufferMode,
    'retained-reaction-state-thermo-and-refreshed-mechanics-buffers'
  );
  assert.equal(step.nextParticleUploads.sphParticleUpload.stateBuffer.label, 'reaction-state-after-thermal');
  assert.equal(step.nextParticleUploads.sphParticleUpload.thermoBuffer.label, 'reaction-thermo-after-thermal');
  assert.equal(
    step.nextParticleUploads.mlsMpmParticleUpload.mechanicsBuffer.label,
    'refreshed-mechanics-after-reaction'
  );
  assert.equal(step.nextParticleMechanicsBufferByteLength, buffers.mlsMpmParticleState.mechanics.byteLength);
  assert.equal(step.diagnostics.reactionSummaryStatus, 'reaction-compact-summary-ready');
  assert.equal(step.diagnostics.reactionSummaryAvailable, true);
  assert.equal(step.diagnostics.reactionSummaryReadbackMode, 'compact-reaction-summary-readback');
  assert.equal(step.diagnostics.reactionSummaryReadbackByteLength, 128);
  assert.equal(step.diagnostics.reactionVisibleProductMassKg, 3);
  assert.equal(step.diagnostics.reactionVisibleGasProductMassKg, 1);
  assert.equal(step.diagnostics.reactionOutputGasPhaseMassKg, 1);
  assert.equal(step.diagnostics.reactionChangedMaterialCount, 2);
  assert.equal(step.diagnostics.reactionChangedMassCount, 1);
  assert.equal(step.diagnostics.reactionCanonicalEventCount, 1);
  assert.equal(step.diagnostics.reactionConsumedReactantMassKg, 6);
  assert.equal(step.diagnostics.reactionLedgerUnplacedProductMassKg, 1);
  assert.equal(step.diagnostics.reactionLedgerGasProductMassKg, 1);
  assert.equal(step.diagnostics.reactionLedgerUnplacedGasProductMassKg, 0.5);
  assert.equal(step.diagnostics.reactionSealedBoxGasProductMoles, 250);
  assert.equal(step.diagnostics.reactionHeatJ, 6000);
  assert.equal(step.diagnostics.reactionLedgerMassResidualKg, 0.4);
	  assert.equal(step.diagnostics.reactionCompactLedgerAvailable, true);
	  assert.equal(step.diagnostics.reactionProductInventoryCount, 2);
	  assert.equal(step.diagnostics.reactionProductInventoryReadbackByteLength, 128);
	  assert.equal(step.diagnostics.reactionProductEventRowCount, 64);
	  assert.equal(step.diagnostics.reactionProductEventActiveEventCount, 1);
	  assert.equal(step.diagnostics.reactionProductEventReadbackByteLength, 0);
	  assert.equal(step.diagnostics.reactionProductEventBufferByteLength, 4096);
	  assert.equal(step.diagnostics.reactionProductEventBufferRetained, true);
	  assert.equal(step.residentProductMass.schema, ULG_SPH_RESIDENT_PRODUCT_MASS_SCHEMA);
	  assert.equal(step.residentProductMass.status, 'resident-product-mass-buffer-retained');
	  assert.equal(step.residentProductMass.productEventBuffer.label, 'reaction-product-events-after-thermal');
	  assert.equal(step.residentProductMass.consumeMassPolicy, 'unplaced-product-mass-only');
	  assert.equal(step.residentProductMassEosCouplingStatus, 'resident-product-mass-p2g-eos-sidecar-ready');
	  assert.equal(step.diagnostics.reactionResidentProductMassStatus, 'resident-product-mass-buffer-retained');
	  assert.equal(step.diagnostics.reactionResidentProductMassBufferRetained, true);
	  assert.equal(step.diagnostics.reactionResidentProductMassBufferByteLength, 4096);
	  assert.equal(step.diagnostics.reactionResidentProductMassProductEventRowCount, 64);
	  assert.equal(step.diagnostics.reactionResidentProductMassUnplacedProductMassKg, 1);
	  assert.equal(step.diagnostics.reactionResidentProductMassUnplacedGasProductMassKg, 0.5);
	  assert.equal(step.diagnostics.reactionResidentProductMassEosCouplingStatus, 'resident-product-mass-p2g-eos-sidecar-ready');
	  assert.equal(step.diagnostics.reactionProductInventory.byMaterial.c2.unplacedMassKg, 0.5);
  assert.deepEqual(step.diagnostics.reactionProductInventory.byMaterial.ab.productTermIndices, [0]);
  assert.equal(step.diagnostics.reactionAtomResidualCount, 2);
  assert.equal(step.diagnostics.reactionAtomResidualReadbackByteLength, 64);
  assert.equal(step.diagnostics.reactionAtomResidualSummary.maxAbsAtomResidualMol, 0);
  assert.equal(step.diagnostics.reactionAtomResidualSummary.chargeResidualMol, 0);
  assert.equal(step.diagnostics.reactionAtomResidualSummary.records[0].termKind, 'reactant');
  assert.equal(step.diagnostics.reactionStrictGateStatus, 'strict-reaction-gate-pass');
  assert.deepEqual(step.diagnostics.reactionStrictGateBlockers, []);
  assert.equal(tracker.destroyed, 0);
  destroyMlsMpmResidentStepBuffers(step);
  assert.equal(thermalDestroyCalls, 1);
	  assert.equal(tracker.destroyed, 11);
});

test('MLS-MPM resident no-full step skips no-op reaction output buffers for next source', async () => {
  const buffers = manualBuffers();
  const tracker = fakeBufferTracker();
  const sourceThermoBuffer = tracker.buffer('source-thermo');
  const thermalResponseGraphUpload = {
    schema: ULG_SPH_GPU_THERMAL_RESPONSE_GRAPH_BUFFER_SET_SCHEMA,
    status: 'webgpu-uploaded',
    responseCount: 3,
    graphCount: 3
  };
  const step = await runMlsMpmResidentStepWithOptionalWebGpu({
    ...buffers,
    sphParticleUpload: {
      status: 'webgpu-uploaded',
      stateBuffer: tracker.buffer('source-state'),
      thermoBuffer: sourceThermoBuffer,
      slot: 0
    },
    mlsMpmParticleUpload: {
      status: 'webgpu-uploaded',
      mechanicsBuffer: tracker.buffer('source-mechanics'),
      slot: 0
    },
    preferWebGpu: true,
    navigatorRef: webGpuNavigator(),
    boxDimsM: [3, 3, 3],
    readbackMode: 'no-full-readback',
    thermalMaterialTable: { schema: 'peercompute.ulg.sph-gpu-thermal-material-table.v0' },
    reactionTable: { schema: 'peercompute.ulg.sph-gpu-reaction-table.v1', reactionCount: 1 },
    thermalStepOptions: { thermalResponseGraphUpload },
    reactionStepOptions: { thermalResponseGraphUpload },
    p2gRunner() {
      return {
        schema: ULG_MLS_MPM_GPU_GRID_PROJECTION_SCHEMA,
        backend: 'webgpu',
        status: 'projected',
        particleCount: buffers.sphParticleState.particleCount,
        dt: buffers.mlsMpmParticleState.mechanicsDtS,
        gridSpacingM: buffers.sphParticleState.smoothingLengthM,
        gridDims: [8, 8, 8],
        gridNodeCount: 512,
        gridShift: 1,
        gridNodeStrideFloats: 8,
        gridNodes: new Float32Array(),
        gridBuffer: tracker.buffer('p2g-grid-noop-reaction'),
        gridBufferByteLength: 512 * 8 * Float32Array.BYTES_PER_ELEMENT,
        readbackMode: 'no-full-readback',
        normalHotLoopReadbackFree: true,
        destroyGridBuffer() {
          this.gridBuffer.destroy();
        }
      };
    },
    gridUpdateRunner(args) {
      return {
        schema: ULG_MLS_MPM_GPU_GRID_UPDATE_SCHEMA,
        backend: 'webgpu',
        status: 'updated',
        sourceSchema: args.p2gGridProjection.schema,
        particleCount: buffers.sphParticleState.particleCount,
        dt: buffers.mlsMpmParticleState.mechanicsDtS,
        gridSpacingM: buffers.sphParticleState.smoothingLengthM,
        gridDims: [8, 8, 8],
        gridNodeCount: 512,
        gridShift: 1,
        gridNodeStrideFloats: 8,
        updatedGridNodes: new Float32Array(),
        updatedGridBuffer: tracker.buffer('updated-grid-noop-reaction'),
        updatedGridBufferByteLength: 512 * 8 * Float32Array.BYTES_PER_ELEMENT,
        readbackMode: 'no-full-readback',
        normalHotLoopReadbackFree: true,
        destroyUpdatedGridBuffer() {
          this.updatedGridBuffer.destroy();
        }
      };
    },
    g2pRunner() {
      return {
        schema: ULG_MLS_MPM_GPU_G2P_RECONSTRUCTION_SCHEMA,
        backend: 'webgpu',
        status: 'reconstructed',
        particleCount: buffers.sphParticleState.particleCount,
        gridNodeCount: 512,
        gridSpacingM: buffers.sphParticleState.smoothingLengthM,
        gridDims: [8, 8, 8],
        gridShift: 1,
        dt: buffers.mlsMpmParticleState.mechanicsDtS,
        stateStrideFloats: 8,
        thermoStrideFloats: 12,
        mechanicsStrideFloats: 32,
        state: new Float32Array(),
        mechanics: new Float32Array(),
        stateBuffer: tracker.buffer('g2p-state-before-noop-reaction'),
        mechanicsBuffer: tracker.buffer('g2p-mechanics-before-noop-reaction'),
        stateBufferByteLength: buffers.sphParticleState.state.byteLength,
        mechanicsBufferByteLength: buffers.mlsMpmParticleState.mechanics.byteLength,
        retainedOutputParticleBuffers: true,
        readbackMode: 'no-full-readback',
        normalHotLoopReadbackFree: true,
        destroyOutputParticleBuffers() {
          this.stateBuffer.destroy();
          this.mechanicsBuffer.destroy();
        }
      };
    },
    thermalStepRunner() {
      return {
        schema: ULG_SPH_GPU_THERMAL_STEP_SCHEMA,
        backend: 'webgpu',
        status: 'thermal-step-executed',
        particleCount: buffers.sphParticleState.particleCount,
        state: new Float32Array(),
        thermo: new Float32Array(),
        stateBuffer: tracker.buffer('thermal-state-before-noop-reaction'),
        thermoBuffer: tracker.buffer('thermal-thermo-before-noop-reaction'),
        stateBufferByteLength: buffers.sphParticleState.state.byteLength,
        thermoBufferByteLength: buffers.sphParticleState.thermo.byteLength,
        retainedOutputParticleBuffers: true,
        readbackMode: 'no-full-readback',
        normalHotLoopReadbackFree: true
      };
    },
    reactionStepRunner() {
      return {
        schema: ULG_SPH_GPU_REACTION_STEP_SCHEMA,
        backend: 'webgpu',
        status: 'reaction-step-executed',
        particleCount: buffers.sphParticleState.particleCount,
        state: new Float32Array(),
        thermo: new Float32Array(),
        mechanics: new Float32Array(),
        stateBuffer: tracker.buffer('reaction-state-noop'),
        thermoBuffer: tracker.buffer('reaction-thermo-noop'),
        mechanicsBuffer: tracker.buffer('reaction-mechanics-noop'),
        stateBufferByteLength: buffers.sphParticleState.state.byteLength,
        thermoBufferByteLength: buffers.sphParticleState.thermo.byteLength,
        mechanicsBufferByteLength: buffers.mlsMpmParticleState.mechanics.byteLength,
        retainedOutputParticleBuffers: true,
        readbackMode: 'no-full-readback',
        normalHotLoopReadbackFree: true,
        reactionSummary: {
          schema: ULG_SPH_GPU_REACTION_SUMMARY_SCHEMA,
          backend: 'webgpu',
          status: 'reaction-compact-summary-ready',
          reactionSummaryAvailable: true,
          changedMaterialCount: 0,
          changedMassCount: 0,
          visibleProductMassKg: 0,
          visibleGasProductMassKg: 0,
          outputGasPhaseMassKg: 0,
          canonicalReactionEventCount: 0,
          consumedReactantMassKg: 0,
          expectedProductMassKg: 0,
          rawProductMassKg: 0,
          ledgerVisibleProductMassKg: 0,
          ledgerUnplacedProductMassKg: 0,
          ledgerGasProductMassKg: 0,
          ledgerVisibleGasProductMassKg: 0,
          ledgerUnplacedGasProductMassKg: 0,
          sealedBoxGasProductMoles: 0,
          reactionHeatJ: 0,
          ledgerReadyEventCount: 0,
          ledgerProblemEventCount: 0,
          productEventActiveEventCount: 0,
          compactLedgerAvailable: true,
          readbackMode: 'compact-reaction-summary-readback',
          compactReadbackByteLength: MLS_MPM_GPU_RESIDENT_SUMMARY_BYTES,
          reductionStrategy: 'two-pass-workgroup-reduction'
        }
      };
    }
  });

  assert.equal(step.reactionOutputParticleMutation, false);
  assert.equal(step.reactionOutputBufferHandoffStatus, 'reaction-output-buffers-skipped-no-particle-mutation');
  assert.equal(step.thermalOutputReplacedByReactionStep, false);
  assert.equal(step.g2pMechanicsBufferReplacedByReactionStep, false);
  assert.equal(step.thermalStateBufferHandoffStatus, 'thermal-state-buffer-drives-next-particles');
  assert.equal(step.thermalThermoBufferHandoffStatus, 'thermal-thermo-buffer-drives-next-particles');
  assert.equal(step.thermalMechanicsRefreshStatus, 'mechanics-constitutive-refresh-pending-after-thermal-state');
  assert.ok(step.residentAuthorityWarnings.includes('mechanics-constitutive-refresh-pending-after-thermal-state'));
  assert.equal(step.nextParticleBufferMode, 'retained-thermal-output-and-g2p-mechanics-buffers');
  assert.equal(step.nextParticleUploads.sphParticleUpload.stateBuffer.label, 'thermal-state-before-noop-reaction');
  assert.equal(step.nextParticleUploads.sphParticleUpload.thermoBuffer.label, 'thermal-thermo-before-noop-reaction');
  assert.equal(step.nextParticleUploads.mlsMpmParticleUpload.mechanicsBuffer.label, 'g2p-mechanics-before-noop-reaction');
  assert.equal(step.diagnostics.reactionSummaryAvailable, true);
  assert.equal(step.diagnostics.reactionCanonicalEventCount, 0);
  assert.equal(step.diagnostics.reactionConsumedReactantMassKg, 0);
  assert.equal(tracker.destroyed, 0);
  destroyMlsMpmResidentStepBuffers(step);
  assert.equal(tracker.destroyed, 9);
});

test('MLS-MPM resident step merges carried and emitted product-event buffers on the GPU', async () => {
  const buffers = manualBuffers();
  const tracker = fakeBufferTracker();
  const device = fakeSummaryDevice(new Float32Array(MLS_MPM_GPU_RESIDENT_SUMMARY_FLOATS));
  const carriedResidentProductMass = residentProductMassHandle({
    label: 'carried-product-events',
    rowCount: 2,
    byteLength: 256,
    unplacedProductMassKg: 2,
    unplacedGasProductMassKg: 1,
    generationCount: 2,
    sourceRowCounts: [1, 1],
    sourceByteLengths: [128, 128],
    gasSpeciesRows: [
      { material: 'h2', materialId: 1, massKg: 0.002016, moles: 1, unplacedMassKg: 0.002016 },
      { material: 'o2', materialId: 2, massKg: 0.032, moles: 1, unplacedMassKg: 0.032 }
    ]
  });
  const emittedResidentProductMass = residentProductMassHandle({
    label: 'emitted-product-events',
    rowCount: 3,
    byteLength: 384,
    unplacedProductMassKg: 3,
    unplacedGasProductMassKg: 1.5,
    gasSpeciesRows: [
      { material: 'h2', materialId: 1, massKg: 0.004032, moles: 2, unplacedMassKg: 0.004032 }
    ]
  });
  const p2gInputs = [];
  let mergeFenceCount = 0;
  device.queue.onSubmittedWorkDone = async () => {
    mergeFenceCount += 1;
  };

  const step = await runMlsMpmResidentStepWithOptionalWebGpu({
    ...buffers,
    sphParticleUpload: {
      status: 'webgpu-uploaded',
      stateBuffer: tracker.buffer('source-state'),
      thermoBuffer: tracker.buffer('source-thermo'),
      slot: 0
    },
    mlsMpmParticleUpload: {
      status: 'webgpu-uploaded',
      mechanicsBuffer: tracker.buffer('source-mechanics'),
      slot: 0
    },
    residentProductMass: carriedResidentProductMass,
    preferWebGpu: true,
    device,
    boxDimsM: [3, 3, 3],
    readbackMode: 'no-full-readback',
    thermalMaterialTable: { schema: 'peercompute.ulg.sph-gpu-thermal-material-table.v0' },
    thermalStepRunner: null,
    reactionTable: { schema: 'peercompute.ulg.sph-gpu-reaction-table.v1', reactionCount: 1 },
    summaryRunner: null,
    p2gRunner(args) {
      p2gInputs.push(args.residentProductMass);
      return {
        schema: ULG_MLS_MPM_GPU_GRID_PROJECTION_SCHEMA,
        backend: 'webgpu',
        status: 'projected',
        particleCount: buffers.sphParticleState.particleCount,
        dt: buffers.mlsMpmParticleState.mechanicsDtS,
        gridSpacingM: buffers.sphParticleState.smoothingLengthM,
        gridDims: [8, 8, 8],
        gridNodeCount: 512,
        gridShift: 1,
        gridNodeStrideFloats: 8,
        gridNodes: new Float32Array(),
        gridBuffer: tracker.buffer('p2g-grid-merge'),
        gridBufferByteLength: 512 * 8 * Float32Array.BYTES_PER_ELEMENT,
        residentProductMassGridCouplingStatus: 'resident-product-mass-grid-coupled',
        readbackMode: 'no-full-readback',
        normalHotLoopReadbackFree: true,
        destroyGridBuffer() {
          this.gridBuffer.destroy();
        }
      };
    },
    gridUpdateRunner(args) {
      return {
        schema: ULG_MLS_MPM_GPU_GRID_UPDATE_SCHEMA,
        backend: 'webgpu',
        status: 'updated',
        sourceSchema: args.p2gGridProjection.schema,
        particleCount: buffers.sphParticleState.particleCount,
        dt: buffers.mlsMpmParticleState.mechanicsDtS,
        gridSpacingM: buffers.sphParticleState.smoothingLengthM,
        gridDims: [8, 8, 8],
        gridNodeCount: 512,
        gridShift: 1,
        gridNodeStrideFloats: 8,
        updatedGridNodes: new Float32Array(),
        updatedGridBuffer: tracker.buffer('updated-grid-merge'),
        updatedGridBufferByteLength: 512 * 8 * Float32Array.BYTES_PER_ELEMENT,
        readbackMode: 'no-full-readback',
        normalHotLoopReadbackFree: true,
        destroyUpdatedGridBuffer() {
          this.updatedGridBuffer.destroy();
        }
      };
    },
    g2pRunner() {
      return {
        schema: ULG_MLS_MPM_GPU_G2P_RECONSTRUCTION_SCHEMA,
        backend: 'webgpu',
        status: 'reconstructed',
        particleCount: buffers.sphParticleState.particleCount,
        gridNodeCount: 512,
        gridSpacingM: buffers.sphParticleState.smoothingLengthM,
        gridDims: [8, 8, 8],
        gridShift: 1,
        dt: buffers.mlsMpmParticleState.mechanicsDtS,
        stateStrideFloats: 8,
        thermoStrideFloats: 12,
        mechanicsStrideFloats: 32,
        state: new Float32Array(),
        mechanics: new Float32Array(),
        stateBuffer: tracker.buffer('g2p-state-merge'),
        mechanicsBuffer: tracker.buffer('g2p-mechanics-merge'),
        stateBufferByteLength: buffers.sphParticleState.state.byteLength,
        mechanicsBufferByteLength: buffers.mlsMpmParticleState.mechanics.byteLength,
        retainedOutputParticleBuffers: true,
        readbackMode: 'no-full-readback',
        normalHotLoopReadbackFree: true,
        destroyOutputParticleBuffers() {
          this.stateBuffer.destroy();
          this.mechanicsBuffer.destroy();
        }
      };
    },
    reactionStepRunner() {
      return {
        schema: ULG_SPH_GPU_REACTION_STEP_SCHEMA,
        backend: 'webgpu',
        status: 'reaction-step-executed',
        particleCount: buffers.sphParticleState.particleCount,
        state: new Float32Array(),
        thermo: new Float32Array(),
        mechanics: new Float32Array(),
        stateBuffer: tracker.buffer('reaction-state-merge'),
        thermoBuffer: tracker.buffer('reaction-thermo-merge'),
        mechanicsBuffer: tracker.buffer('reaction-mechanics-merge'),
        stateBufferByteLength: buffers.sphParticleState.state.byteLength,
        thermoBufferByteLength: buffers.sphParticleState.thermo.byteLength,
        mechanicsBufferByteLength: buffers.mlsMpmParticleState.mechanics.byteLength,
        retainedOutputParticleBuffers: true,
        readbackMode: 'no-full-readback',
        normalHotLoopReadbackFree: true,
        residentProductMass: emittedResidentProductMass,
        destroyOutputParticleBuffers() {
          this.stateBuffer.destroy();
          this.thermoBuffer.destroy();
          this.mechanicsBuffer.destroy();
        }
      };
    }
  });

  assert.equal(p2gInputs[0], carriedResidentProductMass);
  assert.equal(step.inputResidentProductMassStatus, 'resident-product-mass-buffer-retained');
  assert.equal(step.emittedResidentProductMassStatus, 'resident-product-mass-buffer-retained');
  assert.equal(step.residentProductMassStatus, 'resident-product-mass-merged-gpu-resident');
  assert.equal(step.residentProductMassMergeStatus, 'resident-product-mass-merged-gpu-resident');
  assert.equal(
    step.residentProductMassMergeQueueCompletionStatus,
    'queue-submitted-owner-fence-delegated'
  );
  assert.equal(
    step.residentProductMassMergeQueueCompletionMethod,
    'queue.submit-same-queue-ordering'
  );
  assert.equal(
    step.residentProductMass.productEventMergeQueueCompletionStatus,
    'queue-submitted-owner-fence-delegated'
  );
  assert.equal(
    step.residentProductMass.productEventMergeQueueCompletionMethod,
    'queue.submit-same-queue-ordering'
  );
  assert.equal(step.residentProductMassProductEventRowCount, 5);
  assert.equal(step.mergedResidentProductMassProductEventRowCount, 5);
  assert.equal(step.residentProductMassGenerationCount, 3);
  assert.equal(step.residentProductMassBufferByteLength, 640);
  assert.equal(step.residentProductMassMergedBufferByteLength, 640);
  assert.equal(step.residentProductMass.productEventHistoryArenaWarmReuse, false);
  assert.equal(step.residentProductMass.productEventMergeCopyCount, 2);
  assert.equal(step.residentProductMass.productEventMergeCopiedByteLength, 640);
  assert.equal(step.residentProductMass.productEventMergeHostFenceAwaited, false);
  assert.equal(step.residentProductMassUnplacedProductMassKg, 5);
  assert.equal(step.residentProductMassUnplacedGasProductMassKg, 2.5);
  assert.equal(step.residentProductMassGasSpeciesLedgerCount, 2);
  assert.equal(step.residentProductMassSealedBoxGasProductMoles, 4);
  assert.equal(step.residentProductMass.gasSpeciesLedger.bySpecies.h2.moles, 3);
  assert.equal(step.residentProductMass.gasSpeciesLedger.bySpecies.o2.moles, 1);
  assert.equal(step.residentProductMassMergedInputBufferRetained, true);
  assert.equal(step.residentProductMassMergedEmittedBufferRetained, true);
  assert.equal(step.residentProductMassGridCouplingStatus, 'resident-product-mass-grid-coupled');
  assert.deepEqual(step.residentProductMass.productEventSourceRowCounts, [1, 1, 3]);
  assert.equal(step.residentProductMass.mergeSourceProductEventBufferCount, 3);
  assert.deepEqual(step.residentProductMass.mergeSourceProductEventBufferByteLengths, [128, 128, 384]);
  assert.equal(step.nextParticleUploads.residentProductMass, step.residentProductMass);
  assert.equal(step.residentBufferLeaseLedgerStatus, 'resident-buffer-lease-ledger-active');
  assert.equal(step.residentBufferLeaseResourceCount, 3);
  assert.equal(step.residentBufferLeaseActiveLeaseCount, 1);
  assert.equal(
    step.residentBufferLeaseSummary.resources['resident-product-mass:ulg-sph-resident-product-history-arena-1:5:640'].activeLeaseCount,
    1
  );
  assert.equal(device.copies.length, 2);
  assert.equal(device.copies[0].source, carriedResidentProductMass.productEventBuffer);
  assert.equal(device.copies[0].destination, step.residentProductMass.productEventBuffer);
  assert.equal(device.copies[0].destinationOffset, 0);
  assert.equal(device.copies[0].size, 256);
  assert.equal(device.copies[1].source, emittedResidentProductMass.productEventBuffer);
  assert.equal(device.copies[1].destination, step.residentProductMass.productEventBuffer);
  assert.equal(device.copies[1].destinationOffset, 256);
  assert.equal(device.copies[1].size, 384);
  assert.equal(device.submissions.length, 1);
  assert.equal(mergeFenceCount, 0);

  destroyMlsMpmResidentStepBuffers(step);
  assert.equal(carriedResidentProductMass.destroyCalls, 0);
  assert.equal(carriedResidentProductMass.productEventBuffer.destroyed, false);
  assert.equal(emittedResidentProductMass.destroyCalls, 1);
  assert.equal(emittedResidentProductMass.productEventBuffer.destroyed, true);
  // Logical release returns the slot to the bounded warm pool after its owner
  // fence; the physical buffer remains cached for the next history chain.
  assert.equal(step.residentProductMass.productEventBuffer.destroyed, false);
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(step.residentProductMass.productEventBuffer.destroyed, false);
  assert.equal(step.residentBufferLeaseCleanupStatus, 'resident-buffer-lease-ledger-cleaned');
  assert.equal(step.residentBufferLeaseCleanup.destroyedResourceCount, 2);
});

test('resident product-history arena appends 128 warm generations without reallocating or fencing', async () => {
  const device = fakeSummaryDevice(new Float32Array(MLS_MPM_GPU_RESIDENT_SUMMARY_FLOATS));
  let mergeFenceCount = 0;
  device.queue.onSubmittedWorkDone = async () => {
    mergeFenceCount += 1;
  };
  let current = residentProductMassHandle({
    label: 'arena-seed-product-events',
    rowCount: 1,
    byteLength: 128,
    generationCount: 1,
    sourceRowCounts: [1],
    sourceByteLengths: [128]
  });
  let arenaBuffer = null;
  const warmCreatedBufferCounts = [];
  for (let generation = 0; generation < 128; generation += 1) {
    const input = current;
    const emitted = residentProductMassHandle({
      label: `arena-emitted-product-events-${generation}`,
      rowCount: 1,
      byteLength: 128
    });
    current = await mergeResidentProductMassBuffersWebGpu({
      device,
      inputResidentProductMass: input,
      emittedResidentProductMass: emitted
    });
    if (generation === 0) {
      arenaBuffer = current.productEventBuffer;
      assert.equal(current.productEventHistoryArenaWarmReuse, false);
      assert.equal(current.productEventMergeCopyCount, 2);
    } else {
      assert.equal(current.productEventBuffer, arenaBuffer);
      assert.equal(current.productEventHistoryArenaWarmReuse, true);
      assert.equal(current.productEventMergeCopyCount, 1);
      assert.equal(current.productEventMergeCopiedByteLength, 128);
      input.destroyResidentProductMassBuffers();
    }
    warmCreatedBufferCounts.push(device.createdBuffers.length);
  }

  assert.equal(current.productEventRowCount, 129);
  assert.equal(current.productEventBufferByteLength, 129 * 128);
  assert.equal(current.productEventSourceRowCounts.length, 129);
  assert.deepEqual(new Set(current.productEventSourceRowCounts), new Set([1]));
  assert.equal(device.createdBuffers.length, 1);
  assert.deepEqual(new Set(warmCreatedBufferCounts), new Set([1]));
  assert.equal(device.copies.length, 129);
  assert.equal(device.copies.at(-1).destination, arenaBuffer);
  assert.equal(device.copies.at(-1).destinationOffset, 128 * 128);
  assert.equal(device.copies.at(-1).size, 128);
  assert.equal(device.submissions.length, 128);
  assert.equal(mergeFenceCount, 0);
  assert.equal(current.productEventMergeHostFenceAwaited, false);
  await releaseResidentProductHistoryTestHandles(current);
  assert.equal(mergeFenceCount, 1);
});

test('resident product-history arena reuses compact destination and four-byte observation workspace', async () => {
  const device = fakeSummaryDevice(new Uint32Array([1024]));
  let compactMapCount = 0;
  let mergeFenceCount = 0;
  const createBuffer = device.createBuffer.bind(device);
  device.createBuffer = (descriptor) => {
    const buffer = createBuffer(descriptor);
    if (descriptor.label === 'ulg-sph-resident-product-history-arena-compact-count-readback') {
      const mapAsync = buffer.mapAsync.bind(buffer);
      buffer.mapAsync = async (...args) => {
        compactMapCount += 1;
        return mapAsync(...args);
      };
    }
    return buffer;
  };
  device.queue.onSubmittedWorkDone = async () => {
    mergeFenceCount += 1;
  };
  const sourceRows = Array.from({ length: 16 }, (_, index) => (
    index === 15 ? 32 : 127
  ));
  const sourceBytes = sourceRows.map((count) => count * 128);
  const seed = residentProductMassHandle({
    label: 'compact-arena-seed',
    rowCount: 2047,
    byteLength: 2047 * 128,
    generationCount: 16,
    sourceRowCounts: sourceRows,
    sourceByteLengths: sourceBytes
  });
  const first = await mergeResidentProductMassBuffersWebGpu({
    device,
    inputResidentProductMass: seed,
    emittedResidentProductMass: residentProductMassHandle({
      label: 'compact-arena-emitted-1',
      rowCount: 1,
      byteLength: 128
    })
  });
  assert.equal(first.productEventCompactionStatus, 'product-event-compaction-performed');
  assert.equal(first.productEventRowCount, 1024);
  assert.equal(first.productEventCompactionDroppedRowCount, 1024);
  assert.equal(first.productEventBufferByteLength, 1024 * 128);
  assert.equal(first.productEventHistoryArenaSlotCount, 2);
  assert.equal(compactMapCount, 1);
  assert.equal(mergeFenceCount, 0);
  const createdAfterFirstCompaction = device.createdBuffers.length;
  assert.equal(createdAfterFirstCompaction, 5);

  const secondSourceRows = Array.from({ length: 15 }, () => 1024 / 15);
  const second = await mergeResidentProductMassBuffersWebGpu({
    device,
    inputResidentProductMass: first,
    emittedResidentProductMass: residentProductMassHandle({
      label: 'compact-arena-emitted-2',
      rowCount: 1024,
      byteLength: 1024 * 128,
      generationCount: 15,
      sourceRowCounts: secondSourceRows,
      sourceByteLengths: secondSourceRows.map((count) => count * 128)
    })
  });
  assert.equal(second.productEventCompactionStatus, 'product-event-compaction-performed');
  assert.equal(second.productEventRowCount, 1024);
  assert.equal(second.productEventHistoryArenaWarmReuse, true);
  assert.equal(second.productEventMergeCopyCount, 1);
  assert.notEqual(second.productEventBuffer, first.productEventBuffer);
  assert.equal(device.createdBuffers.length, createdAfterFirstCompaction);
  assert.equal(compactMapCount, 2);
  assert.equal(mergeFenceCount, 0);
  await releaseResidentProductHistoryTestHandles(first, second);
  assert.ok(mergeFenceCount >= 1);
});

test('resident product-history arena reserves concurrent tail forks on distinct physical slots', async () => {
  const device = fakeSummaryDevice(new Uint32Array([2048]));
  const seedRows = Array.from({ length: 15 }, () => 1);
  const seed = residentProductMassHandle({
    label: 'concurrent-tail-seed',
    rowCount: 15,
    byteLength: 15 * 128,
    generationCount: 15,
    sourceRowCounts: seedRows,
    sourceByteLengths: seedRows.map(() => 128)
  });
  const seedTail = residentProductMassHandle({
    label: 'concurrent-tail-seed-append',
    rowCount: 1,
    byteLength: 128
  });
  const history = await mergeResidentProductMassBuffersWebGpu({
    device,
    inputResidentProductMass: seed,
    emittedResidentProductMass: seedTail
  });
  const emittedA = residentProductMassHandle({
    label: 'concurrent-tail-emitted-a',
    rowCount: 2032,
    byteLength: 2032 * 128
  });
  const emittedB = residentProductMassHandle({
    label: 'concurrent-tail-emitted-b',
    rowCount: 2032,
    byteLength: 2032 * 128
  });

  const [branchA, branchB] = await Promise.all([
    mergeResidentProductMassBuffersWebGpu({
      device,
      inputResidentProductMass: history,
      emittedResidentProductMass: emittedA
    }),
    mergeResidentProductMassBuffersWebGpu({
      device,
      inputResidentProductMass: history,
      emittedResidentProductMass: emittedB
    })
  ]);

  const emittedCopyA = device.copies.find((copy) => copy.source === emittedA.productEventBuffer);
  const emittedCopyB = device.copies.find((copy) => copy.source === emittedB.productEventBuffer);
  assert.ok(emittedCopyA);
  assert.ok(emittedCopyB);
  assert.notEqual(emittedCopyA.destination, emittedCopyB.destination);
  assert.notEqual(branchA.productEventBuffer, branchB.productEventBuffer);
  assert.equal(branchA.productEventRowCount, 2048);
  assert.equal(branchB.productEventRowCount, 2048);
  assert.equal(
    [branchA, branchB].filter(
      (branch) => branch.productEventCompactionStatus === 'product-event-compaction-performed'
    ).length,
    1
  );
  assert.equal(
    [branchA, branchB].filter(
      (branch) => branch.productEventCompactionStatus.startsWith('product-event-compaction-failed:')
    ).length,
    1
  );
  assert.equal(device.createdBuffers.filter(
    (buffer) => /^ulg-sph-resident-product-history-arena-\d+$/.test(buffer.label)
  ).length, 3);

  await releaseResidentProductHistoryTestHandles(
    history,
    branchA,
    branchB,
    seed,
    seedTail,
    emittedA,
    emittedB
  );
});

test('resident product-history arena retains concatenated history after scoped compaction validation failure', async () => {
  const device = fakeSummaryDevice(new Uint32Array([1024]));
  device.pushErrorScope = () => {};
  device.popErrorScope = async () => ({ message: 'injected compaction validation failure' });
  const sourceRows = Array.from({ length: 16 }, (_, index) => (
    index === 15 ? 32 : 127
  ));
  const seed = residentProductMassHandle({
    label: 'validation-fallback-seed',
    rowCount: 2047,
    byteLength: 2047 * 128,
    generationCount: 16,
    sourceRowCounts: sourceRows,
    sourceByteLengths: sourceRows.map((rowCount) => rowCount * 128)
  });
  const emitted = residentProductMassHandle({
    label: 'validation-fallback-emitted',
    rowCount: 1,
    byteLength: 128
  });

  const result = await mergeResidentProductMassBuffersWebGpu({
    device,
    inputResidentProductMass: seed,
    emittedResidentProductMass: emitted
  });

  assert.match(
    result.productEventCompactionStatus,
    /^product-event-compaction-failed:resident product-history compaction validation failed:/
  );
  assert.equal(result.productEventRowCount, 2048);
  assert.equal(result.productEventBufferByteLength, 2048 * 128);
  assert.equal(result.productEventCompactionDroppedRowCount, 0);
  assert.equal(result.productEventMergeQueueCompletionStatus, 'queue-submitted-owner-fence-delegated');
  await releaseResidentProductHistoryTestHandles(result, seed, emitted);
});

test('resident product-history arena unmaps failed compaction observation and reuses its workspace', async () => {
  const device = fakeSummaryDevice(new Uint32Array([1024]));
  let failFirstMappedRange = true;
  let unmapCount = 0;
  const createBuffer = device.createBuffer.bind(device);
  device.createBuffer = (descriptor) => {
    const buffer = createBuffer(descriptor);
    if (descriptor.label === 'ulg-sph-resident-product-history-arena-compact-count-readback') {
      const getMappedRange = buffer.getMappedRange.bind(buffer);
      const unmap = buffer.unmap.bind(buffer);
      buffer.getMappedRange = () => {
        if (failFirstMappedRange) {
          failFirstMappedRange = false;
          throw new Error('injected mapped-range failure');
        }
        return getMappedRange();
      };
      buffer.unmap = () => {
        unmapCount += 1;
        unmap();
      };
    }
    return buffer;
  };
  const eligibleSource = (suffix) => {
    const sourceRows = Array.from({ length: 16 }, (_, index) => (
      index === 15 ? 32 : 127
    ));
    return residentProductMassHandle({
      label: `mapped-recovery-seed-${suffix}`,
      rowCount: 2047,
      byteLength: 2047 * 128,
      generationCount: 16,
      sourceRowCounts: sourceRows,
      sourceByteLengths: sourceRows.map((rowCount) => rowCount * 128)
    });
  };
  const firstSeed = eligibleSource('first');
  const firstEmitted = residentProductMassHandle({
    label: 'mapped-recovery-emitted-first',
    rowCount: 1,
    byteLength: 128
  });
  const first = await mergeResidentProductMassBuffersWebGpu({
    device,
    inputResidentProductMass: firstSeed,
    emittedResidentProductMass: firstEmitted
  });
  assert.match(first.productEventCompactionStatus, /injected mapped-range failure/);
  assert.equal(unmapCount, 1);
  const createdAfterFirst = device.createdBuffers.length;
  await releaseResidentProductHistoryTestHandles(first, firstSeed, firstEmitted);

  const secondSeed = eligibleSource('second');
  const secondEmitted = residentProductMassHandle({
    label: 'mapped-recovery-emitted-second',
    rowCount: 1,
    byteLength: 128
  });
  const second = await mergeResidentProductMassBuffersWebGpu({
    device,
    inputResidentProductMass: secondSeed,
    emittedResidentProductMass: secondEmitted
  });
  assert.equal(second.productEventCompactionStatus, 'product-event-compaction-performed');
  assert.equal(unmapCount, 2);
  assert.equal(device.createdBuffers.length, createdAfterFirst);
  await releaseResidentProductHistoryTestHandles(second, secondSeed, secondEmitted);
});

test('resident product-history arena terminates a pending compaction map promptly on device loss', async () => {
  const device = fakeSummaryDevice(new Uint32Array([1024]));
  const deviceLost = deferredTestPromise();
  const mapStarted = deferredTestPromise();
  device.lost = deviceLost.promise;
  const createBuffer = device.createBuffer.bind(device);
  device.createBuffer = (descriptor) => {
    const buffer = createBuffer(descriptor);
    if (descriptor.label === 'ulg-sph-resident-product-history-arena-compact-count-readback') {
      buffer.mapAsync = () => {
        mapStarted.resolve();
        return new Promise(() => {});
      };
    }
    return buffer;
  };
  const sourceRows = Array.from({ length: 16 }, (_, index) => (
    index === 15 ? 32 : 127
  ));
  const seed = residentProductMassHandle({
    label: 'device-loss-map-seed',
    rowCount: 2047,
    byteLength: 2047 * 128,
    generationCount: 16,
    sourceRowCounts: sourceRows,
    sourceByteLengths: sourceRows.map((rowCount) => rowCount * 128)
  });
  const emitted = residentProductMassHandle({
    label: 'device-loss-map-emitted',
    rowCount: 1,
    byteLength: 128
  });
  const mergePromise = mergeResidentProductMassBuffersWebGpu({
    device,
    inputResidentProductMass: seed,
    emittedResidentProductMass: emitted
  });
  await mapStarted.promise;
  deviceLost.resolve({ reason: 'destroyed', message: 'injected device loss' });

  await assert.rejects(mergePromise, {
    code: 'ERR_SPH_PRODUCT_HISTORY_ARENA_DEVICE_LOST'
  });
  assert.ok(
    device.createdBuffers
      .filter((buffer) => buffer.label.includes('resident-product-history-arena'))
      .every((buffer) => buffer.destroyed === true)
  );
  await releaseResidentProductHistoryTestHandles(seed, emitted);
});

test('resident product-history arena enforces three live slots and resumes after an exact release fence', async () => {
  const device = fakeSummaryDevice(new Float32Array(0));
  const makeColdHistory = (suffix) => mergeResidentProductMassBuffersWebGpu({
    device,
    inputResidentProductMass: residentProductMassHandle({
      label: `backpressure-input-${suffix}`,
      rowCount: 1,
      byteLength: 128
    }),
    emittedResidentProductMass: residentProductMassHandle({
      label: `backpressure-emitted-${suffix}`,
      rowCount: 1,
      byteLength: 128
    })
  });
  const held = [
    await makeColdHistory('a'),
    await makeColdHistory('b'),
    await makeColdHistory('c')
  ];
  assert.equal(device.createdBuffers.length, 3);
  await assert.rejects(makeColdHistory('blocked'), {
    code: 'ERR_SPH_PRODUCT_HISTORY_ARENA_BACKPRESSURE'
  });

  const releaseFence = deferredTestPromise();
  let fenceCalls = 0;
  device.queue.onSubmittedWorkDone = () => {
    fenceCalls += 1;
    return releaseFence.promise;
  };
  const releasePromise = held[0].destroyResidentProductMassBuffers();
  const resumedPromise = makeColdHistory('resumed');
  await Promise.resolve();
  assert.equal(fenceCalls, 1);
  releaseFence.resolve();
  await releasePromise;
  const resumed = await resumedPromise;
  assert.equal(device.createdBuffers.length, 3);
  assert.equal(resumed.productEventHistoryArenaWarmReuse, false);
  await releaseResidentProductHistoryTestHandles(held[1], held[2], resumed);
});

test('resident product-history arena quarantines a slot whose release fence rejects', async () => {
  const device = fakeSummaryDevice(new Float32Array(0));
  const makeColdHistory = (suffix) => mergeResidentProductMassBuffersWebGpu({
    device,
    inputResidentProductMass: residentProductMassHandle({
      label: `quarantine-input-${suffix}`,
      rowCount: 1,
      byteLength: 128
    }),
    emittedResidentProductMass: residentProductMassHandle({
      label: `quarantine-emitted-${suffix}`,
      rowCount: 1,
      byteLength: 128
    })
  });
  const held = [
    await makeColdHistory('a'),
    await makeColdHistory('b'),
    await makeColdHistory('c')
  ];
  const quarantinedBuffer = held[0].productEventBuffer;
  device.queue.onSubmittedWorkDone = async () => {
    throw new Error('injected release rejection');
  };
  held[0].destroyResidentProductMassBuffers();
  const replacement = await makeColdHistory('replacement');
  assert.equal(quarantinedBuffer.destroyed, true);
  assert.equal(device.createdBuffers.length, 4);
  assert.equal(replacement.productEventHistoryArenaSlotCount, 3);
  device.queue.onSubmittedWorkDone = async () => {};
  await releaseResidentProductHistoryTestHandles(held[1], held[2], replacement);
});

test('resident product-history arena does not let a hung release hide a separately quarantined slot', async () => {
  const device = fakeSummaryDevice(new Float32Array(0));
  const makeColdHistory = (suffix) => mergeResidentProductMassBuffersWebGpu({
    device,
    inputResidentProductMass: residentProductMassHandle({
      label: `mixed-release-input-${suffix}`,
      rowCount: 1,
      byteLength: 128
    }),
    emittedResidentProductMass: residentProductMassHandle({
      label: `mixed-release-emitted-${suffix}`,
      rowCount: 1,
      byteLength: 128
    })
  });
  const held = [
    await makeColdHistory('a'),
    await makeColdHistory('b'),
    await makeColdHistory('c')
  ];
  const hungFence = deferredTestPromise();
  let fenceCall = 0;
  device.queue.onSubmittedWorkDone = () => {
    fenceCall += 1;
    if (fenceCall === 1) return hungFence.promise;
    if (fenceCall === 2) return Promise.reject(new Error('injected mixed release rejection'));
    return Promise.resolve();
  };
  const hungBuffer = held[0].productEventBuffer;
  const quarantinedBuffer = held[1].productEventBuffer;
  held[0].destroyResidentProductMassBuffers();
  held[1].destroyResidentProductMassBuffers();

  const replacement = await makeColdHistory('replacement');

  assert.equal(hungBuffer.destroyed, false);
  assert.equal(quarantinedBuffer.destroyed, true);
  assert.equal(replacement.productEventHistoryArenaSlotCount, 3);
  assert.equal(device.createdBuffers.length, 4);
  hungFence.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
  await releaseResidentProductHistoryTestHandles(held[2], replacement);
});

test('resident product-history arena isolates stale handle borrows across slot reuse', async () => {
  const device = fakeSummaryDevice(new Float32Array(0));
  let fenceCalls = 0;
  device.queue.onSubmittedWorkDone = async () => {
    fenceCalls += 1;
  };
  const first = await mergeResidentProductMassBuffersWebGpu({
    device,
    inputResidentProductMass: residentProductMassHandle({
      label: 'stale-borrow-seed',
      rowCount: 1,
      byteLength: 128
    }),
    emittedResidentProductMass: residentProductMassHandle({
      label: 'stale-borrow-emitted-1',
      rowCount: 1,
      byteLength: 128
    })
  });
  const second = await mergeResidentProductMassBuffersWebGpu({
    device,
    inputResidentProductMass: first,
    emittedResidentProductMass: residentProductMassHandle({
      label: 'stale-borrow-emitted-2',
      rowCount: 1,
      byteLength: 128
    })
  });
  const reusedBuffer = second.productEventBuffer;
  first.__ulgActiveBorrowCount += 1;
  first.destroyResidentProductMassBuffers();
  second.destroyResidentProductMassBuffers();
  await Promise.resolve();
  assert.equal(fenceCalls, 0);
  first.__ulgActiveBorrowCount -= 1;
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(fenceCalls, 1);

  const third = await mergeResidentProductMassBuffersWebGpu({
    device,
    inputResidentProductMass: residentProductMassHandle({
      label: 'stale-borrow-reuse-seed',
      rowCount: 1,
      byteLength: 128
    }),
    emittedResidentProductMass: residentProductMassHandle({
      label: 'stale-borrow-reuse-emitted',
      rowCount: 1,
      byteLength: 128
    })
  });
  assert.equal(third.productEventBuffer, reusedBuffer);
  first.__ulgActiveBorrowCount = 5;
  assert.equal(first.__ulgActiveBorrowCount, 0);
  assert.equal(third.__ulgActiveBorrowCount, 0);
  await assert.rejects(mergeResidentProductMassBuffersWebGpu({
    device,
    inputResidentProductMass: first,
    emittedResidentProductMass: residentProductMassHandle({
      label: 'stale-borrow-rejected-emitted',
      rowCount: 1,
      byteLength: 128
    })
  }), {
    code: 'ERR_SPH_PRODUCT_HISTORY_ARENA_STALE_HANDLE'
  });
  await releaseResidentProductHistoryTestHandles(third);
});

test('resident product-history arena grows transactionally and preserves an idle slot after a capacity rejection', async () => {
  const device = fakeSummaryDevice(new Float32Array(0));
  const first = await mergeResidentProductMassBuffersWebGpu({
    device,
    inputResidentProductMass: residentProductMassHandle({
      label: 'growth-seed',
      rowCount: 2047,
      byteLength: 2047 * 128
    }),
    emittedResidentProductMass: residentProductMassHandle({
      label: 'growth-emitted-1',
      rowCount: 1,
      byteLength: 128
    })
  });
  assert.equal(first.productEventHistoryArenaCapacityByteLength, 262144);
  const second = await mergeResidentProductMassBuffersWebGpu({
    device,
    inputResidentProductMass: first,
    emittedResidentProductMass: residentProductMassHandle({
      label: 'growth-emitted-2',
      rowCount: 1,
      byteLength: 128
    })
  });
  assert.notEqual(second.productEventBuffer, first.productEventBuffer);
  assert.equal(second.productEventHistoryArenaCapacityByteLength, 524288);
  assert.equal(second.productEventMergeBufferCreationCount, 1);
  await releaseResidentProductHistoryTestHandles(first, second);

  const limitedDevice = fakeSummaryDevice(new Float32Array(0));
  limitedDevice.limits = {
    maxBufferSize: 300000,
    maxStorageBufferBindingSize: 300000
  };
  const warm = await mergeResidentProductMassBuffersWebGpu({
    device: limitedDevice,
    inputResidentProductMass: residentProductMassHandle({
      label: 'limit-warm-seed',
      rowCount: 1,
      byteLength: 128
    }),
    emittedResidentProductMass: residentProductMassHandle({
      label: 'limit-warm-emitted',
      rowCount: 1,
      byteLength: 128
    })
  });
  const idleBuffer = warm.productEventBuffer;
  await releaseResidentProductHistoryTestHandles(warm);
  const createdBeforeRejection = limitedDevice.createdBuffers.length;
  await assert.rejects(mergeResidentProductMassBuffersWebGpu({
    device: limitedDevice,
    inputResidentProductMass: residentProductMassHandle({
      label: 'limit-oversized-seed',
      rowCount: 2048,
      byteLength: 2048 * 128
    }),
    emittedResidentProductMass: residentProductMassHandle({
      label: 'limit-oversized-emitted',
      rowCount: 1,
      byteLength: 128
    })
  }), {
    code: 'ERR_SPH_PRODUCT_HISTORY_ARENA_CAPACITY'
  });
  assert.equal(limitedDevice.createdBuffers.length, createdBeforeRejection);
  assert.equal(idleBuffer.destroyed, false);
  const reused = await mergeResidentProductMassBuffersWebGpu({
    device: limitedDevice,
    inputResidentProductMass: residentProductMassHandle({
      label: 'limit-reuse-seed',
      rowCount: 1,
      byteLength: 128
    }),
    emittedResidentProductMass: residentProductMassHandle({
      label: 'limit-reuse-emitted',
      rowCount: 1,
      byteLength: 128
    })
  });
  assert.equal(reused.productEventBuffer, idleBuffer);
  await releaseResidentProductHistoryTestHandles(reused);

  const resizeFailureDevice = fakeSummaryDevice(new Float32Array(0));
  const resizeWarm = await mergeResidentProductMassBuffersWebGpu({
    device: resizeFailureDevice,
    inputResidentProductMass: residentProductMassHandle({
      label: 'resize-failure-warm-seed',
      rowCount: 1,
      byteLength: 128
    }),
    emittedResidentProductMass: residentProductMassHandle({
      label: 'resize-failure-warm-emitted',
      rowCount: 1,
      byteLength: 128
    })
  });
  const resizeSurvivor = resizeWarm.productEventBuffer;
  await releaseResidentProductHistoryTestHandles(resizeWarm);
  const createResizeBuffer = resizeFailureDevice.createBuffer.bind(resizeFailureDevice);
  let rejectResize = true;
  resizeFailureDevice.createBuffer = (descriptor) => {
    if (
      rejectResize
      && /^ulg-sph-resident-product-history-arena-\d+$/.test(descriptor.label)
    ) {
      rejectResize = false;
      throw new Error('injected arena resize allocation failure');
    }
    return createResizeBuffer(descriptor);
  };
  await assert.rejects(mergeResidentProductMassBuffersWebGpu({
    device: resizeFailureDevice,
    inputResidentProductMass: residentProductMassHandle({
      label: 'resize-failure-oversized-seed',
      rowCount: 2048,
      byteLength: 2048 * 128
    }),
    emittedResidentProductMass: residentProductMassHandle({
      label: 'resize-failure-oversized-emitted',
      rowCount: 1,
      byteLength: 128
    })
  }), /injected arena resize allocation failure/);
  assert.equal(resizeSurvivor.destroyed, false);
  assert.equal(resizeFailureDevice.createdBuffers.length, 1);
  const resizeRecovered = await mergeResidentProductMassBuffersWebGpu({
    device: resizeFailureDevice,
    inputResidentProductMass: residentProductMassHandle({
      label: 'resize-failure-recovered-seed',
      rowCount: 1,
      byteLength: 128
    }),
    emittedResidentProductMass: residentProductMassHandle({
      label: 'resize-failure-recovered-emitted',
      rowCount: 1,
      byteLength: 128
    })
  });
  assert.equal(resizeRecovered.productEventBuffer, resizeSurvivor);
  await releaseResidentProductHistoryTestHandles(resizeRecovered);
});

test('resident product-history arena rejects malformed metadata and ambiguous aliases before encoding', async () => {
  for (const invalidRowCount of ['1', 1.5, -1]) {
    const device = fakeSummaryDevice(new Float32Array(0));
    await assert.rejects(mergeResidentProductMassBuffersWebGpu({
      device,
      inputResidentProductMass: residentProductMassHandle({
        label: `invalid-row-${String(invalidRowCount)}`,
        rowCount: invalidRowCount,
        byteLength: 128
      }),
      emittedResidentProductMass: residentProductMassHandle({
        label: 'invalid-row-emitted',
        rowCount: 1,
        byteLength: 128
      })
    }), RangeError);
    assert.equal(device.submissions.length, 0);
  }

  const undersizedDevice = fakeSummaryDevice(new Float32Array(0));
  const undersized = residentProductMassHandle({
    label: 'undersized-source',
    rowCount: 1,
    byteLength: 128
  });
  undersized.productEventBuffer.size = 64;
  await assert.rejects(mergeResidentProductMassBuffersWebGpu({
    device: undersizedDevice,
    inputResidentProductMass: undersized,
    emittedResidentProductMass: residentProductMassHandle({
      label: 'undersized-emitted',
      rowCount: 1,
      byteLength: 128
    })
  }), /exceeds GPUBuffer\.size/);
  assert.equal(undersizedDevice.submissions.length, 0);

  const rawAliasDevice = fakeSummaryDevice(new Float32Array(0));
  const rawAliasLeft = residentProductMassHandle({
    label: 'raw-alias-left',
    rowCount: 1,
    byteLength: 128
  });
  const rawAliasRight = residentProductMassHandle({
    label: 'raw-alias-right',
    rowCount: 1,
    byteLength: 128
  });
  rawAliasRight.productEventBuffer = rawAliasLeft.productEventBuffer;
  await assert.rejects(mergeResidentProductMassBuffersWebGpu({
    device: rawAliasDevice,
    inputResidentProductMass: rawAliasLeft,
    emittedResidentProductMass: rawAliasRight
  }), {
    code: 'ERR_SPH_PRODUCT_HISTORY_AMBIGUOUS_SHARED_BUFFER'
  });
  assert.equal(rawAliasDevice.submissions.length, 0);

  const aliasDevice = fakeSummaryDevice(new Float32Array(0));
  const first = await mergeResidentProductMassBuffersWebGpu({
    device: aliasDevice,
    inputResidentProductMass: residentProductMassHandle({
      label: 'alias-seed',
      rowCount: 1,
      byteLength: 128
    }),
    emittedResidentProductMass: residentProductMassHandle({
      label: 'alias-emitted-1',
      rowCount: 1,
      byteLength: 128
    })
  });
  const second = await mergeResidentProductMassBuffersWebGpu({
    device: aliasDevice,
    inputResidentProductMass: first,
    emittedResidentProductMass: residentProductMassHandle({
      label: 'alias-emitted-2',
      rowCount: 1,
      byteLength: 128
    })
  });
  for (const [inputResidentProductMass, emittedResidentProductMass] of [
    [first, second],
    [second, first]
  ]) {
    await assert.rejects(mergeResidentProductMassBuffersWebGpu({
      device: aliasDevice,
      inputResidentProductMass,
      emittedResidentProductMass
    }), {
      code: 'ERR_SPH_PRODUCT_HISTORY_AMBIGUOUS_SHARED_BUFFER'
    });
  }
  await releaseResidentProductHistoryTestHandles(first, second);
});

test('resident product-history arena releases cold slots after pre-publication encode failures', async () => {
  for (const stage of ['createCommandEncoder', 'copyBufferToBuffer', 'finish', 'submit']) {
    const device = fakeSummaryDevice(new Float32Array(0));
    let injected = false;
    if (stage === 'submit') {
      const submit = device.queue.submit.bind(device.queue);
      device.queue.submit = (...args) => {
        if (!injected) {
          injected = true;
          throw new Error(`injected ${stage} failure`);
        }
        return submit(...args);
      };
    } else {
      const createCommandEncoder = device.createCommandEncoder.bind(device);
      device.createCommandEncoder = (...args) => {
        if (stage === 'createCommandEncoder' && !injected) {
          injected = true;
          throw new Error(`injected ${stage} failure`);
        }
        const encoder = createCommandEncoder(...args);
        const method = encoder[stage];
        if (typeof method === 'function') {
          encoder[stage] = (...methodArgs) => {
            if (!injected) {
              injected = true;
              throw new Error(`injected ${stage} failure`);
            }
            return method.apply(encoder, methodArgs);
          };
        }
        return encoder;
      };
    }
    const merge = (suffix) => mergeResidentProductMassBuffersWebGpu({
      device,
      inputResidentProductMass: residentProductMassHandle({
        label: `${stage}-seed-${suffix}`,
        rowCount: 1,
        byteLength: 128
      }),
      emittedResidentProductMass: residentProductMassHandle({
        label: `${stage}-emitted-${suffix}`,
        rowCount: 1,
        byteLength: 128
      })
    });
    await assert.rejects(merge('failed'), new RegExp(`injected ${stage} failure`));
    const recovered = await merge('recovered');
    assert.equal(device.createdBuffers.length, 1, `${stage} leaked its cold arena slot`);
    await releaseResidentProductHistoryTestHandles(recovered);
  }
});

test('resident product-history arena destroys partial compaction workspaces and retries cleanly', async () => {
  for (const failingLabel of [
    'ulg-sph-resident-product-history-arena-compact-count-readback',
    'ulg-sph-resident-product-history-arena-compact-params'
  ]) {
    const device = fakeSummaryDevice(new Uint32Array([1024]));
    let injected = false;
    const createBuffer = device.createBuffer.bind(device);
    device.createBuffer = (descriptor) => {
      if (descriptor.label === failingLabel && !injected) {
        injected = true;
        throw new Error(`injected ${failingLabel} allocation failure`);
      }
      return createBuffer(descriptor);
    };
    const eligibleSource = (suffix) => {
      const sourceRows = Array.from({ length: 16 }, (_, index) => (
        index === 15 ? 32 : 127
      ));
      return residentProductMassHandle({
        label: `partial-workspace-seed-${suffix}`,
        rowCount: 2047,
        byteLength: 2047 * 128,
        generationCount: 16,
        sourceRowCounts: sourceRows,
        sourceByteLengths: sourceRows.map((rowCount) => rowCount * 128)
      });
    };
    const firstSeed = eligibleSource('failed');
    const first = await mergeResidentProductMassBuffersWebGpu({
      device,
      inputResidentProductMass: firstSeed,
      emittedResidentProductMass: residentProductMassHandle({
        label: 'partial-workspace-emitted-failed',
        rowCount: 1,
        byteLength: 128
      })
    });
    assert.match(first.productEventCompactionStatus, /allocation failure/);
    const partialWorkspaceBuffers = device.createdBuffers.filter(
      (buffer) => buffer.label.includes('arena-compact')
    );
    assert.ok(partialWorkspaceBuffers.length > 0);
    assert.ok(partialWorkspaceBuffers.every((buffer) => buffer.destroyed === true));
    await releaseResidentProductHistoryTestHandles(first, firstSeed);

    const secondSeed = eligibleSource('recovered');
    const second = await mergeResidentProductMassBuffersWebGpu({
      device,
      inputResidentProductMass: secondSeed,
      emittedResidentProductMass: residentProductMassHandle({
        label: 'partial-workspace-emitted-recovered',
        rowCount: 1,
        byteLength: 128
      })
    });
    assert.equal(second.productEventCompactionStatus, 'product-event-compaction-performed');
    await releaseResidentProductHistoryTestHandles(second, secondSeed);
  }
});

test('MLS-MPM resident step cleanup preserves explicitly leased product-event buffers', () => {
  const preservedResidentProductMass = residentProductMassHandle({
    label: 'preserved-product-events',
    rowCount: 1,
    byteLength: 128
  });
  const step = {
    particlePingPong: { nextStep: 7, nextTime: 0.7 },
    residentProductMass: preservedResidentProductMass,
    nextParticleUploads: {
      residentProductMass: preservedResidentProductMass,
      sphParticleUpload: {
        ownsStateBuffer: false,
        ownsThermoBuffer: false
      },
      mlsMpmParticleUpload: {
        ownsMechanicsBuffer: false
      }
    }
  };

  destroyMlsMpmResidentStepBuffers(step, {
    preserveResidentProductMass: preservedResidentProductMass
  });

  assert.equal(preservedResidentProductMass.destroyCalls, 0);
  assert.equal(preservedResidentProductMass.productEventBuffer.destroyed, false);
  assert.equal(step.residentBufferLeaseCleanupStatus, 'resident-buffer-lease-ledger-active');
  assert.equal(step.residentBufferLeaseCleanup.skippedDestroyCount, 1);
  assert.equal(step.residentBufferLeaseCleanup.events[0].status, 'destroy-skipped-active-lease');
});

test('MLS-MPM resident step cleanup returns reaction-owned continuation buffers through their owner callback', () => {
  const rawDestroyCounts = { state: 0, thermo: 0, mechanics: 0 };
  const stateBuffer = {
    label: 'reaction-arena-state',
    destroy() { rawDestroyCounts.state += 1; }
  };
  const thermoBuffer = {
    label: 'reaction-arena-thermo',
    destroy() { rawDestroyCounts.thermo += 1; }
  };
  const mechanicsBuffer = {
    label: 'reaction-arena-mechanics',
    destroy() { rawDestroyCounts.mechanics += 1; }
  };
  const residentProductMass = residentProductMassHandle({
    label: 'reaction-arena-product-events',
    rowCount: 1,
    byteLength: 128
  });
  const ownerReleaseOptions = [];
  const step = {
    particlePingPong: { nextStep: 4, nextTime: 0.004 },
    reactionStep: {
      result: {
        stateBuffer,
        thermoBuffer,
        mechanicsBuffer,
        residentProductMass,
        destroyOutputParticleBuffers(options) {
          ownerReleaseOptions.push(options);
          return false;
        }
      }
    },
    residentProductMass,
    nextParticleUploads: {
      residentProductMass,
      sphParticleUpload: {
        ownsStateBuffer: true,
        ownsThermoBuffer: true,
        ownsIdentityBuffer: false,
        stateBuffer,
        thermoBuffer
      },
      mlsMpmParticleUpload: {
        ownsMechanicsBuffer: true,
        mechanicsBuffer
      }
    }
  };

  destroyMlsMpmResidentStepBuffers(step, {
    preserveResidentProductMass: residentProductMass
  });

  assert.equal(ownerReleaseOptions.length, 1);
  assert.deepEqual(ownerReleaseOptions[0], {
    preserveResidentProductMass: true
  });
  assert.deepEqual(rawDestroyCounts, { state: 0, thermo: 0, mechanics: 0 });
  assert.equal(residentProductMass.destroyCalls, 0);
  assert.equal(residentProductMass.productEventBuffer.destroyed, false);
});

test('MLS-MPM resident cleanup invokes a sync-refusing shared reaction/product owner exactly once', () => {
  const rawDestroyCounts = { state: 0, thermo: 0, mechanics: 0, product: 0 };
  const tracked = (component) => ({
    label: `sync-refusing-shared-${component}`,
    destroy() { rawDestroyCounts[component] += 1; }
  });
  const stateBuffer = tracked('state');
  const thermoBuffer = tracked('thermo');
  const mechanicsBuffer = tracked('mechanics');
  const productEventBuffer = tracked('product');
  let ownerCallCount = 0;
  const sharedOwner = () => {
    ownerCallCount += 1;
    return false;
  };
  const residentProductMass = {
    status: 'resident-product-mass-buffer-retained',
    productEventBuffer,
    productEventBufferRetained: true,
    productEventBufferByteLength: 128,
    productEventRowCount: 1,
    destroyResidentProductMassBuffers: sharedOwner
  };
  const step = {
    particlePingPong: { nextStep: 6, nextTime: 0.006 },
    reactionStep: {
      result: {
        stateBuffer,
        thermoBuffer,
        mechanicsBuffer,
        residentProductMass,
        destroyOutputParticleBuffers: sharedOwner
      }
    },
    residentProductMass,
    nextParticleUploads: {
      residentProductMass,
      sphParticleUpload: {
        ownsStateBuffer: true,
        ownsThermoBuffer: true,
        ownsIdentityBuffer: false,
        stateBuffer,
        thermoBuffer
      },
      mlsMpmParticleUpload: {
        ownsMechanicsBuffer: true,
        mechanicsBuffer
      }
    }
  };

  destroyMlsMpmResidentStepBuffers(step);

  assert.equal(ownerCallCount, 1);
  assert.deepEqual(rawDestroyCounts, {
    state: 0,
    thermo: 0,
    mechanics: 0,
    product: 0
  });
  assert.equal(
    step.residentBufferLeaseCleanupStatus,
    'resident-buffer-lease-ledger-blocked'
  );
  assert.equal(
    step.residentBufferLeaseCleanup.events[0].status,
    'destroy-owner-refused'
  );
});

test('MLS-MPM partial-step cleanup retires every retained family and contains rejected owners', async () => {
  const ownerCalls = [];
  const rawDestroyed = [];
  const buffer = (label) => ({
    label,
    destroy() { rawDestroyed.push(label); }
  });
  const family = (name, components, release = () => true) => ({
    result: {
      ...Object.fromEntries(components.map((component) => [
        `${component}Buffer`,
        buffer(`${name}-${component}`)
      ])),
      destroyOutputParticleBuffers() {
        ownerCalls.push(name);
        return release();
      }
    }
  });
  const step = {
    particlePingPong: { nextStep: 9, nextTime: 0.009 },
    schroederFarForceDeltaFusion: family('far', ['state']),
    thermalStep: family('thermal', ['state', 'thermo']),
    reactionStep: family('reaction', ['state', 'thermo', 'mechanics']),
    mechanicsRefreshStep: family(
      'mechanics-refresh',
      ['mechanics'],
      () => Promise.reject(new Error('injected-partial-owner-rejection'))
    ),
    phaseCarrierTransferStep: family(
      'phase-transfer',
      ['state', 'thermo', 'mechanics'],
      () => Promise.resolve(true)
    ),
    g2pReconstruction: {
      gpuResult: family(
        'g2p',
        ['state', 'mechanics'],
        () => Promise.resolve(true)
      ).result
    }
  };

  destroyMlsMpmResidentStepBuffers(step);
  const completion = await step.residentCleanupCompletion;

  assert.deepEqual(ownerCalls.sort(), [
    'far',
    'g2p',
    'mechanics-refresh',
    'phase-transfer',
    'reaction',
    'thermal'
  ]);
  assert.deepEqual(rawDestroyed, []);
  assert.equal(
    step.residentOutputOwnerReleaseReceipt.status,
    'owner-release-incomplete'
  );
  assert.equal(completion.status, 'resident-cleanup-incomplete');
  assert.equal(
    step.residentOutputOwnerReleaseReceipt.releases.find(
      (receipt) => receipt.status === 'owner-release-failed'
    )?.error,
    'injected-partial-owner-rejection'
  );
});

test('MLS-MPM resident cleanup defers continuation authority until an async reaction owner confirms release', async () => {
  for (const outcome of ['confirmed', 'refused', 'rejected']) {
    const tracked = (label) => ({
      label,
      destroyCount: 0,
      destroy() { this.destroyCount += 1; }
    });
    const buffers = {
      particleStateBuffer: tracked(`async-owner-state-${outcome}`),
      particleThermoBuffer: tracked(`async-owner-thermo-${outcome}`),
      particleMechanicsBuffer: tracked(`async-owner-mechanics-${outcome}`)
    };
    const ledger = createSchroederHierarchyArtifactLedger({
      ledgerId: `async-reaction-owner-${outcome}`
    });
    registerSchroederHierarchyArtifactFamily(ledger, {
      family: 'particle-storage-compaction',
      artifact: buffers
    });
    transferSchroederHierarchyArtifactFamily(
      ledger,
      'particle-storage-compaction',
      {
        roles: ['particle-state', 'particle-thermo', 'particle-mechanics'],
        transferClass: 'continuation',
        retirementAuthority: 'external-owner'
      }
    );
    await scheduleSchroederHierarchyArtifactRetirement(ledger, {
      after: Promise.resolve()
    });
    let resolveOwner;
    let rejectOwner;
    const ownerPromise = new Promise((resolve, reject) => {
      resolveOwner = resolve;
      rejectOwner = reject;
    });
    let ownerReleaseCount = 0;
    const ownerRelease = () => {
      ownerReleaseCount += 1;
      return ownerPromise;
    };
    const residentProductMass = residentProductMassHandle({
      label: `async-owner-product-events-${outcome}`,
      rowCount: 1,
      byteLength: 128
    });
    residentProductMass.destroyResidentProductMassBuffers = ownerRelease;
    const step = {
      particlePingPong: { nextStep: 12, nextTime: 0.012 },
      schroederHierarchyArtifactLedger: ledger,
      releaseSchroederHierarchyArtifactTransfers(options) {
        return releaseSchroederHierarchyArtifactTransfers(ledger, options);
      },
      reactionStep: {
        result: {
          stateBuffer: buffers.particleStateBuffer,
          thermoBuffer: buffers.particleThermoBuffer,
          mechanicsBuffer: buffers.particleMechanicsBuffer,
          residentProductMass,
          destroyOutputParticleBuffers: ownerRelease
        }
      },
      residentProductMass,
      nextParticleUploads: {
        residentProductMass,
        sphParticleUpload: {
          ownsStateBuffer: true,
          ownsThermoBuffer: true,
          ownsIdentityBuffer: false,
          stateBuffer: buffers.particleStateBuffer,
          thermoBuffer: buffers.particleThermoBuffer
        },
        mlsMpmParticleUpload: {
          ownsMechanicsBuffer: true,
          mechanicsBuffer: buffers.particleMechanicsBuffer
        }
      }
    };

    destroyMlsMpmResidentStepBuffers(step);

    assert.equal(ownerReleaseCount, 1);
    assert.equal(
      step.residentOutputOwnerReleaseReceipt.status,
      'owner-release-pending'
    );
    assert.equal(
      step.residentBufferLeaseCleanupStatus,
      'resident-buffer-lease-ledger-cleanup-pending'
    );
    assert.equal(
      summarizeSchroederHierarchyArtifactLedger(ledger).pendingTransferCount,
      3
    );
    assert.deepEqual(
      Object.values(buffers).map((entry) => entry.destroyCount),
      [0, 0, 0]
    );

    if (outcome === 'confirmed') resolveOwner(true);
    else if (outcome === 'refused') resolveOwner(false);
    else rejectOwner(new Error('injected-async-reaction-owner-failure'));
    await Promise.all([
      step.residentOutputOwnerReleaseCompletion,
      step.residentProductMassCleanupCompletion
    ]);

    assert.equal(ownerReleaseCount, 1);
    assert.equal(
      step.residentOutputOwnerReleaseReceipt.status,
      outcome === 'confirmed'
        ? 'owner-release-confirmed'
        : 'owner-release-incomplete'
    );
    assert.equal(
      summarizeSchroederHierarchyArtifactLedger(ledger).pendingTransferCount,
      outcome === 'confirmed' ? 0 : 3
    );
    assert.deepEqual(
      Object.values(buffers).map((entry) => entry.destroyCount),
      [0, 0, 0]
    );
  }
});

test('MLS-MPM resident cleanup releases a superseded reaction arena even when its product handle was a successor input', () => {
  const previousResidentProductMass = residentProductMassHandle({
    label: 'previous-reaction-arena-product-events',
    rowCount: 1,
    byteLength: 128
  });
  const carriedResidentProductMass = residentProductMassHandle({
    label: 'new-merged-carried-product-events',
    rowCount: 2,
    byteLength: 256
  });
  const ownerReleaseOptions = [];
  const buffer = (label) => ({ label, destroy() {} });
  const stateBuffer = buffer('previous-reaction-arena-state');
  const thermoBuffer = buffer('previous-reaction-arena-thermo');
  const mechanicsBuffer = buffer('previous-reaction-arena-mechanics');
  const step = {
    particlePingPong: { nextStep: 5, nextTime: 0.005 },
    reactionStep: {
      result: {
        stateBuffer,
        thermoBuffer,
        mechanicsBuffer,
        residentProductMass: previousResidentProductMass,
        destroyOutputParticleBuffers(options) {
          ownerReleaseOptions.push(options);
        }
      }
    },
    residentProductMass: previousResidentProductMass,
    nextParticleUploads: {
      residentProductMass: previousResidentProductMass,
      sphParticleUpload: {
        ownsStateBuffer: true,
        ownsThermoBuffer: true,
        ownsIdentityBuffer: false,
        stateBuffer,
        thermoBuffer
      },
      mlsMpmParticleUpload: {
        ownsMechanicsBuffer: true,
        mechanicsBuffer
      }
    }
  };

  destroyMlsMpmResidentStepBuffers(step, {
    preserveResidentProductMass: carriedResidentProductMass,
    preserveResidentProductMassHandles: [
      previousResidentProductMass,
      carriedResidentProductMass
    ]
  });

  assert.deepEqual(ownerReleaseOptions, [{
    preserveResidentProductMass: false
  }]);
});

test('MLS-MPM resident step cleanup preserves product-event buffers from preserveBuffers', () => {
  const preservedResidentProductMass = residentProductMassHandle({
    label: 'preserved-product-events-by-buffer',
    rowCount: 1,
    byteLength: 128
  });
  const step = {
    particlePingPong: { nextStep: 8, nextTime: 0.8 },
    residentProductMass: preservedResidentProductMass,
    nextParticleUploads: {
      sphParticleUpload: {
        ownsStateBuffer: false,
        ownsThermoBuffer: false
      },
      mlsMpmParticleUpload: {
        ownsMechanicsBuffer: false
      }
    }
  };

  destroyMlsMpmResidentStepBuffers(step, {
    preserveBuffers: [preservedResidentProductMass.productEventBuffer]
  });

  assert.equal(preservedResidentProductMass.destroyCalls, 0);
  assert.equal(preservedResidentProductMass.productEventBuffer.destroyed, false);
  assert.equal(step.residentBufferLeaseCleanupStatus, 'resident-buffer-lease-ledger-active');
  assert.equal(step.residentBufferLeaseCleanup.skippedDestroyCount, 1);
  assert.equal(
    step.residentBufferLeaseCleanup.leases[0].reason,
    'preserve-resident-product-event-buffer'
  );
});

test('MLS-MPM resident step rejects stale CPU mirrors without retained GPU uploads', async () => {
  const buffers = manualBuffers();
  await assert.rejects(
    () => runMlsMpmResidentStepWithOptionalWebGpu({
      ...buffers,
      sphParticleState: {
        ...buffers.sphParticleState,
        status: 'gpu-resident-unread-ready',
        cpuStateStale: true
      },
      preferWebGpu: false
    }),
    /Stale SPH CPU mirror cannot drive/
  );

  await assert.rejects(
    () => runMlsMpmResidentStepWithOptionalWebGpu({
      ...buffers,
      mlsMpmParticleState: {
        ...buffers.mlsMpmParticleState,
        status: 'gpu-resident-unread-ready',
        cpuStateStale: true
      },
      preferWebGpu: false
    }),
    /Stale MLS-MPM CPU mirror cannot drive/
  );
});

test('MLS-MPM resident step accepts stale CPU mirrors when retained GPU uploads are authoritative', async () => {
  const buffers = manualBuffers();
  const tracker = fakeBufferTracker();
  const sphParticleUpload = {
    status: 'webgpu-uploaded',
    stateBuffer: tracker.buffer('authoritative-stale-sph-state'),
    thermoBuffer: tracker.buffer('authoritative-stale-sph-thermo'),
    ownsStateBuffer: false,
    ownsThermoBuffer: false,
    slot: 1
  };
  const mlsMpmParticleUpload = {
    status: 'webgpu-uploaded',
    mechanicsBuffer: tracker.buffer('authoritative-stale-mls-mechanics'),
    ownsMechanicsBuffer: false,
    slot: 1
  };
  const step = await runMlsMpmResidentStepWithOptionalWebGpu({
    ...buffers,
    sphParticleState: {
      ...buffers.sphParticleState,
      status: 'gpu-resident-unread-ready',
      cpuStateStale: true
    },
    mlsMpmParticleState: {
      ...buffers.mlsMpmParticleState,
      status: 'gpu-resident-unread-ready',
      cpuStateStale: true
    },
    sphParticleUpload,
    mlsMpmParticleUpload,
    preferWebGpu: true,
    navigatorRef: webGpuNavigator(),
    boxDimsM: [3, 3, 3],
    readbackMode: 'no-full-readback',
    p2gRunner(args) {
      assert.equal(args.sphParticleUpload.stateBuffer.label, 'authoritative-stale-sph-state');
      assert.equal(args.mlsMpmParticleUpload.mechanicsBuffer.label, 'authoritative-stale-mls-mechanics');
      return {
        schema: ULG_MLS_MPM_GPU_GRID_PROJECTION_SCHEMA,
        backend: 'webgpu',
        status: 'projected',
        particleCount: buffers.sphParticleState.particleCount,
        dt: buffers.mlsMpmParticleState.mechanicsDtS,
        gridSpacingM: buffers.sphParticleState.smoothingLengthM,
        gridDims: [8, 8, 8],
        gridNodeCount: 512,
        gridShift: 1,
        gridNodeStrideFloats: 8,
        gridNodes: new Float32Array(),
        gridBuffer: tracker.buffer('stale-guard-p2g-grid'),
        gridBufferByteLength: 512 * 8 * Float32Array.BYTES_PER_ELEMENT,
        readbackMode: 'no-full-readback',
        normalHotLoopReadbackFree: true,
        destroyGridBuffer() {
          this.gridBuffer.destroy();
        }
      };
    },
    gridUpdateRunner(args) {
      assert.equal(args.p2gGridBuffer.label, 'stale-guard-p2g-grid');
      return {
        schema: ULG_MLS_MPM_GPU_GRID_UPDATE_SCHEMA,
        backend: 'webgpu',
        status: 'updated',
        sourceSchema: args.p2gGridProjection.schema,
        particleCount: buffers.sphParticleState.particleCount,
        dt: buffers.mlsMpmParticleState.mechanicsDtS,
        gridSpacingM: buffers.sphParticleState.smoothingLengthM,
        gridDims: [8, 8, 8],
        gridNodeCount: 512,
        gridShift: 1,
        gridNodeStrideFloats: 8,
        updatedGridNodes: new Float32Array(),
        updatedGridBuffer: tracker.buffer('stale-guard-updated-grid'),
        updatedGridBufferByteLength: 512 * 8 * Float32Array.BYTES_PER_ELEMENT,
        readbackMode: 'no-full-readback',
        normalHotLoopReadbackFree: true,
        destroyUpdatedGridBuffer() {
          this.updatedGridBuffer.destroy();
        }
      };
    },
    g2pRunner(args) {
      assert.equal(args.updatedGridBuffer.label, 'stale-guard-updated-grid');
      return {
        schema: ULG_MLS_MPM_GPU_G2P_RECONSTRUCTION_SCHEMA,
        backend: 'webgpu',
        status: 'reconstructed',
        particleCount: buffers.sphParticleState.particleCount,
        gridNodeCount: 512,
        gridSpacingM: buffers.sphParticleState.smoothingLengthM,
        gridDims: [8, 8, 8],
        gridShift: 1,
        dt: buffers.mlsMpmParticleState.mechanicsDtS,
        stateStrideFloats: 8,
        thermoStrideFloats: 12,
        mechanicsStrideFloats: 32,
        state: new Float32Array(),
        mechanics: new Float32Array(),
        stateBuffer: tracker.buffer('stale-guard-next-state'),
        mechanicsBuffer: tracker.buffer('stale-guard-next-mechanics'),
        stateBufferByteLength: buffers.sphParticleState.state.byteLength,
        mechanicsBufferByteLength: buffers.mlsMpmParticleState.mechanics.byteLength,
        retainedOutputParticleBuffers: true,
        readbackMode: 'no-full-readback',
        normalHotLoopReadbackFree: true,
        destroyOutputParticleBuffers() {
          this.stateBuffer.destroy();
          this.mechanicsBuffer.destroy();
        }
      };
    }
  });

  assert.equal(step.status, 'resident-step-webgpu-executed');
  assert.equal(step.readbackMode, 'no-full-readback');
  assert.equal(step.normalHotLoopReadbackFree, true);
  assert.equal(step.nextParticleUploads.sphParticleUpload.stateBuffer.label, 'stale-guard-next-state');
  assert.equal(step.nextParticleUploads.mlsMpmParticleUpload.mechanicsBuffer.label, 'stale-guard-next-mechanics');
});

test('MLS-MPM resident steps ping-pong retained particle buffers across repeated steps', async () => {
  const buffers = manualBuffers();
  const tracker = fakeBufferTracker();
  const sourceThermoBuffer = tracker.buffer('source-thermo');
  const p2gInputs = [];
  const execution = await runMlsMpmResidentStepsWithOptionalWebGpu({
    ...buffers,
    sphParticleUpload: {
      status: 'webgpu-uploaded',
      stateBuffer: tracker.buffer('source-state'),
      thermoBuffer: sourceThermoBuffer,
      slot: 0
    },
    mlsMpmParticleUpload: {
      status: 'webgpu-uploaded',
      mechanicsBuffer: tracker.buffer('source-mechanics'),
      slot: 0
    },
    stepCount: 2,
    preferWebGpu: true,
    navigatorRef: webGpuNavigator(),
    boxDimsM: [3, 3, 3],
    p2gRunner(args) {
      p2gInputs.push({
        stateBufferLabel: args.sphParticleUpload?.stateBuffer?.label ?? null,
        mechanicsBufferLabel: args.mlsMpmParticleUpload?.mechanicsBuffer?.label ?? null
      });
      const result = projectMlsMpmP2gGridCpu(args);
      return {
        ...result,
        backend: 'webgpu',
        gridBuffer: tracker.buffer(`p2g-grid-${p2gInputs.length}`),
        destroyGridBuffer() {
          this.gridBuffer.destroy();
        }
      };
    },
    gridUpdateRunner(args) {
      const result = updateMlsMpmGridCpu(args);
      return {
        ...result,
        backend: 'webgpu',
        updatedGridBuffer: tracker.buffer(`updated-grid-${p2gInputs.length}`),
        destroyUpdatedGridBuffer() {
          this.updatedGridBuffer.destroy();
        }
      };
    },
    g2pRunner(args) {
      const result = reconstructMlsMpmG2pCpu(args);
      return {
        ...result,
        backend: 'webgpu',
        stateBuffer: tracker.buffer(`g2p-state-${p2gInputs.length}`),
        mechanicsBuffer: tracker.buffer(`g2p-mechanics-${p2gInputs.length}`),
        stateBufferByteLength: result.state.byteLength,
        mechanicsBufferByteLength: result.mechanics.byteLength,
        retainedOutputParticleBuffers: true,
        destroyOutputParticleBuffers() {
          this.stateBuffer.destroy();
          this.mechanicsBuffer.destroy();
        }
      };
    }
  });

  assert.equal(execution.schema, ULG_MLS_MPM_GPU_RESIDENT_STEPS_EXECUTION_SCHEMA);
  assert.equal(execution.stepCount, 2);
  assert.equal(execution.completedStepCount, 2);
  assert.equal(execution.retainedIntermediateStepCount, 0);
  assert.equal(execution.finalStep.particlePingPong.sourceSlot, 1);
  assert.equal(execution.finalStep.particlePingPong.nextSlot, 0);
  assert.equal(execution.finalStep.particlePingPong.step, 1);
  assert.equal(execution.finalStep.particlePingPong.nextStep, 2);
  assert.equal(execution.nextSphParticleState.step, 2);
  assert.equal(execution.nextSphParticleState.time, 0.2);
  assert.equal(execution.nextSphParticleState.status, 'gpu-resident-readback-ready');
  assert.equal(execution.nextSphParticleState.cpuStateStale, false);
  assert.equal(execution.nextMlsMpmParticleState.step, 2);
  assert.equal(execution.nextMlsMpmParticleState.status, 'gpu-resident-readback-ready');
  assert.equal(execution.nextParticleBufferMode, 'retained-g2p-output-buffers');
  assert.equal(execution.nextParticleUploads.sphParticleUpload.stateBuffer.label, 'g2p-state-2');
  assert.equal(execution.nextParticleUploads.mlsMpmParticleUpload.mechanicsBuffer.label, 'g2p-mechanics-2');
  assert.equal(execution.stepSummaries[0].particlePingPong.sourceSlot, 0);
  assert.equal(execution.stepSummaries[0].particlePingPong.nextSlot, 1);
  assert.equal(execution.stepSummaries[1].particlePingPong.sourceSlot, 1);
  assert.equal(execution.stepSummaries[1].particlePingPong.nextSlot, 0);
  assert.equal(p2gInputs[0].stateBufferLabel, 'source-state');
  assert.equal(p2gInputs[1].stateBufferLabel, 'g2p-state-1');
  assert.equal(p2gInputs[1].mechanicsBufferLabel, 'g2p-mechanics-1');
  assert.equal(execution.finalStep.nextParticleUploads.sphParticleUpload.thermoBuffer, sourceThermoBuffer);
  assert.equal(tracker.destroyed, 4);
  destroyMlsMpmResidentStepsBuffers(execution);
  assert.equal(tracker.destroyed, 8);
});

test('MLS-MPM resident steps compactSummaryMode none skips no-full summary readback', async () => {
  const { options, tracker } = noFullReadbackResidentStepFixture();
  let summaryCallCount = 0;
  const execution = await runMlsMpmResidentStepsWithOptionalWebGpu({
    ...options,
    stepCount: 2,
    compactSummaryMode: 'none',
    summaryRunner() {
      summaryCallCount += 1;
      throw new Error('compact summary should not run in none mode');
    }
  });

  assert.equal(summaryCallCount, 0);
  assert.equal(execution.compactSummaryMode, 'none');
  assert.equal(execution.completedStepCount, 2);
  assert.equal(execution.finalStep.stageTiming.compactSummaryRequested, false);
  assert.equal(execution.finalStep.stageTiming.stageMs.compactSummary, 0);
  assert.equal(execution.finalStep.diagnostics.compactGpuSummaryAvailable, false);
  assert.equal(execution.stepSummaries[0].diagnostics.compactGpuSummaryAvailable, false);
  assert.equal(execution.stepSummaries[1].diagnostics.compactGpuSummaryAvailable, false);
  assert.equal(execution.nextSphParticleState.status, 'gpu-resident-unread-ready');
  assert.equal(execution.nextMlsMpmParticleState.status, 'gpu-resident-unread-ready');
  destroyMlsMpmResidentStepsBuffers(execution);
  assert.ok(tracker.destroyed > 0);
});

test('MLS-MPM resident reaction sequence reuses one owned placement accumulator and reads only the final step', async () => {
  const fixture = placementAccumulatorSequenceFixture({ productTermCount: 3 });
  const execution = await runMlsMpmResidentStepsWithOptionalWebGpu(fixture.sequenceOptions);
  await new Promise((resolve) => setImmediate(resolve));

  assert.equal(fixture.reactionCalls.length, 3);
  const accumulator = fixture.reactionCalls[0].productPlacementAccumulatorBuffer;
  assert.ok(accumulator);
  assert.ok(fixture.reactionCalls.every((call) => (
    call.productPlacementAccumulatorBuffer === accumulator
  )));
  assert.deepEqual(
    fixture.reactionCalls.map((call) => call.readReactionProductPlacementSummary),
    [false, false, true]
  );
  assert.deepEqual(
    fixture.reactionCalls.map((call) => call.readCompactReactionSummary),
    [false, false, true]
  );
  assert.deepEqual(
    fixture.reactionCalls.map((call) => call.readReactionGasSpeciesSummary),
    [false, false, true]
  );
  assert.deepEqual(
    fixture.reactionCalls.map((call) => call.readReactionProductInventory),
    [false, false, true]
  );
  assert.deepEqual(
    fixture.reactionCalls.map((call) => call.readReactionAtomResidual),
    [false, false, true]
  );
  assert.deepEqual(
    fixture.reactionCalls.map((call) => call.reactionProductPlacementReadbackCadence),
    ['resident-sequence-final-only', 'resident-sequence-final-only', 'resident-sequence-final-only']
  );
  assert.deepEqual(
    fixture.reactionCalls.map((call) => call.reactionProductPlacementSourceSummaryCount),
    [1, 2, 3]
  );
  assert.equal(accumulator.size, fixture.expectedAccumulatorByteLength);
  assert.equal(
    fixture.expectedAccumulatorByteLength,
    3 * SPH_GPU_REACTION_PRODUCT_PLACEMENT_SUMMARY_FLOATS * Float32Array.BYTES_PER_ELEMENT
  );
  assert.equal(execution.reactionProductPlacementAccumulatorByteLength, fixture.expectedAccumulatorByteLength);
  assert.equal(execution.reactionProductPlacementAccumulatorOwned, true);
  assert.equal(execution.reactionProductPlacementReadbackCadence, 'resident-sequence-final-only');
  assert.equal(execution.reactionProductPlacementAccumulatorStatus, 'product-placement-provenance-ready');
  assert.equal(execution.reactionProductPlacementSuccessfulDispatchCount, 3);
  assert.equal(execution.reactionProductPlacementDispatchEvidenceComplete, true);
  assert.equal(execution.reactionProductPlacementSourceCountVerified, true);
  assert.equal(execution.reactionProductPlacementProvenance.sourceSummaryCount, 3);
  assert.equal(
    execution.reactionProductPlacementProvenance.readbackCadence,
    'resident-sequence-final-only'
  );
  assert.equal(
    execution.reactionProductPlacementProvenance.readbackByteLength,
    fixture.expectedAccumulatorByteLength
  );
  const accumulatorWrites = fixture.device.writes.filter((write) => (
    write.label === 'ulg-sph-reaction-product-placement-resident-sequence-accumulator'
  ));
  assert.equal(accumulatorWrites.length, 1);
  assert.equal(accumulatorWrites[0].offset, 0);
  assert.equal(accumulatorWrites[0].byteLength, fixture.expectedAccumulatorByteLength);
  assert.equal(fixture.queueFenceCount, 1);
  assert.equal(accumulator.destroyCallCount, 1);

  destroyMlsMpmResidentStepsBuffers(execution);
  assert.equal(accumulator.destroyCallCount, 1);
});

test('MLS-MPM resident reaction sequence borrows a placement accumulator without zeroing or destroying it', async () => {
  const productTermCount = 2;
  const expectedAccumulatorByteLength = productTermCount
    * SPH_GPU_REACTION_PRODUCT_PLACEMENT_SUMMARY_FLOATS
    * Float32Array.BYTES_PER_ELEMENT;
  const borrowedAccumulator = {
    label: 'borrowed-product-placement-accumulator',
    size: expectedAccumulatorByteLength,
    destroyCallCount: 0,
    destroy() {
      this.destroyCallCount += 1;
    }
  };
  const fixture = placementAccumulatorSequenceFixture({
    productTermCount,
    suppliedAccumulatorBuffer: borrowedAccumulator
  });
  const execution = await runMlsMpmResidentStepsWithOptionalWebGpu(fixture.sequenceOptions);
  await new Promise((resolve) => setImmediate(resolve));

  assert.equal(fixture.reactionCalls.length, 3);
  assert.ok(fixture.reactionCalls.every((call) => (
    call.productPlacementAccumulatorBuffer === borrowedAccumulator
  )));
  assert.equal(execution.reactionProductPlacementAccumulatorByteLength, expectedAccumulatorByteLength);
  assert.equal(execution.reactionProductPlacementAccumulatorOwned, false);
  assert.equal(borrowedAccumulator.destroyCallCount, 0);
  assert.equal(fixture.queueFenceCount, 0);
  assert.equal(
    fixture.device.createdBuffers.some((buffer) => (
      buffer.label === 'ulg-sph-reaction-product-placement-resident-sequence-accumulator'
    )),
    false
  );
  assert.equal(
    fixture.device.writes.some((write) => write.label === borrowedAccumulator.label),
    false
  );

  destroyMlsMpmResidentStepsBuffers(execution);
  assert.equal(borrowedAccumulator.destroyCallCount, 0);
});

test('MLS-MPM resident reaction sequence destroys its owned placement accumulator after a failed step', async () => {
  const fixture = placementAccumulatorSequenceFixture({
    productTermCount: 2,
    failOnReactionCall: 2
  });

  await assert.rejects(
    runMlsMpmResidentStepsWithOptionalWebGpu(fixture.sequenceOptions),
    /placement accumulator fixture reaction failure 2/
  );
  await new Promise((resolve) => setImmediate(resolve));

  assert.equal(fixture.reactionCalls.length, 2);
  const accumulator = fixture.reactionCalls[0].productPlacementAccumulatorBuffer;
  assert.ok(accumulator);
  assert.equal(fixture.reactionCalls[1].productPlacementAccumulatorBuffer, accumulator);
  // A failed resident sequence may also fence cleanup for the successfully
  // submitted prefix. The accumulator's own lifetime guarantee is that at
  // least one completion fence precedes its exact-once destruction, not that
  // it is the only resource retired by the device in this failure path.
  assert.ok(fixture.queueFenceCount >= 1);
  assert.equal(accumulator.destroyCallCount, 1);
});

test('MLS-MPM resident reaction sequence does not claim placement readback when a runner returns no evidence', async () => {
  const fixture = placementAccumulatorSequenceFixture({
    productTermCount: 2,
    includeFinalProvenance: false
  });
  const execution = await runMlsMpmResidentStepsWithOptionalWebGpu(fixture.sequenceOptions);
  await new Promise((resolve) => setImmediate(resolve));

  assert.deepEqual(
    fixture.reactionCalls.map((call) => call.readReactionProductPlacementSummary),
    [false, false, true]
  );
  assert.equal(execution.reactionProductPlacementProvenance, null);
  assert.equal(execution.reactionProductPlacementSuccessfulDispatchCount, 0);
  assert.equal(execution.reactionProductPlacementDispatchEvidenceComplete, false);
  assert.equal(execution.reactionProductPlacementSourceCountVerified, false);
  assert.equal(
    execution.reactionProductPlacementAccumulatorStatus,
    'resident-sequence-product-placement-dispatch-evidence-incomplete'
  );
  const accumulator = fixture.reactionCalls[0].productPlacementAccumulatorBuffer;
  assert.equal(fixture.queueFenceCount, 1);
  assert.equal(accumulator.destroyCallCount, 1);

  destroyMlsMpmResidentStepsBuffers(execution);
  assert.equal(accumulator.destroyCallCount, 1);
});

test('MLS-MPM resident reaction sequence fails closed when any placement dispatch is unproven', async () => {
  const fixture = placementAccumulatorSequenceFixture({
    productTermCount: 2,
    omitPlacementEvidenceOnReactionCalls: [2]
  });
  const execution = await runMlsMpmResidentStepsWithOptionalWebGpu(fixture.sequenceOptions);
  await new Promise((resolve) => setImmediate(resolve));

  assert.deepEqual(
    fixture.reactionCalls.map((call) => call.reactionProductPlacementSourceSummaryCount),
    [1, 2, 2]
  );
  assert.equal(execution.reactionProductPlacementSuccessfulDispatchCount, 2);
  assert.equal(execution.reactionProductPlacementDispatchEvidenceComplete, false);
  assert.equal(execution.reactionProductPlacementSourceCountVerified, false);
  assert.equal(execution.reactionProductPlacementProvenance, null);
  assert.equal(
    execution.reactionProductPlacementAccumulatorStatus,
    'resident-sequence-product-placement-dispatch-evidence-incomplete'
  );
  assert.equal(
    execution.finalStep.diagnostics.reactionProductPlacementProvenanceStatus,
    'resident-sequence-product-placement-dispatch-evidence-incomplete'
  );
  assert.equal(
    execution.finalStep.diagnostics.reactionProductPlacementMechanicsRefreshCarried,
    false
  );
  assert.equal(
    execution.finalStep.reactionProductPlacementMechanicsRefreshStatus,
    'product-placement-provenance-not-available-unproven-sequence'
  );
  assert.equal(execution.finalStep.reactionProductPlacementMechanicsRefreshCarried, false);
  assert.equal(
    (execution.finalStep.reactionStep.result || execution.finalStep.reactionStep)
      .reactionSummary.productPlacementProvenance,
    null
  );

  destroyMlsMpmResidentStepsBuffers(execution);
});

test('MLS-MPM resident reaction step does not call unavailable placement provenance carried', async () => {
  const fixture = placementAccumulatorSequenceFixture({
    productTermCount: 2,
    finalProvenanceAvailable: false
  });
  const execution = await runMlsMpmResidentStepsWithOptionalWebGpu(fixture.sequenceOptions);
  await new Promise((resolve) => setImmediate(resolve));

  assert.equal(
    execution.finalStep.diagnostics.reactionProductPlacementMechanicsRefreshStatus,
    'product-placement-provenance-not-available-unproven-sequence'
  );
  assert.equal(
    execution.finalStep.diagnostics.reactionProductPlacementMechanicsRefreshCarried,
    false
  );
  assert.equal(execution.reactionProductPlacementProvenance, null);
  assert.equal(execution.reactionProductPlacementDispatchEvidenceComplete, false);
  assert.equal(execution.reactionProductPlacementSourceCountVerified, false);
  assert.equal(
    execution.reactionProductPlacementAccumulatorStatus,
    'resident-sequence-product-placement-dispatch-evidence-incomplete'
  );

  destroyMlsMpmResidentStepsBuffers(execution);
});

test('MLS-MPM fused resident sequence can run active-grid with compactSummaryMode none', async () => {
  const buffers = manualBuffers();
  const tracker = fakeBufferTracker();
  const device = fakeSummaryDevice(new Float32Array(MLS_MPM_GPU_RESIDENT_SUMMARY_FLOATS));
  const originalOnSubmittedWorkDone = device.queue.onSubmittedWorkDone;
  let summaryCallCount = 0;
  let queueFenceCount = 0;
  device.queue.onSubmittedWorkDone = async () => {
    queueFenceCount += 1;
    await originalOnSubmittedWorkDone.call(device.queue);
  };
  const execution = await runMlsMpmResidentStepsWithOptionalWebGpu({
    ...buffers,
    sphParticleUpload: {
      status: 'webgpu-uploaded',
      stateBuffer: tracker.buffer('source-state'),
      thermoBuffer: tracker.buffer('source-thermo'),
      slot: 0
    },
    mlsMpmParticleUpload: {
      status: 'webgpu-uploaded',
      mechanicsBuffer: tracker.buffer('source-mechanics'),
      slot: 0
    },
    stepCount: 2,
    preferWebGpu: true,
    device,
    boxDimsM: [3, 3, 3],
    readbackMode: 'no-full-readback',
    compactSummaryMode: 'none',
    fuseNoFullResidentMechanicsSequence: true,
    fuseNoFullResidentMechanicsActiveGrid: true,
    activeGridSafetyCells: 1,
    measureFusedSequenceQueueFence: true,
    summaryRunner() {
      summaryCallCount += 1;
      throw new Error('compact summary should not run in none-mode fused sequence');
    }
  });

  assert.equal(summaryCallCount, 0);
  assert.equal(execution.status, 'resident-steps-executed');
  assert.equal(execution.compactSummaryMode, 'none');
  assert.equal(execution.fusedResidentSequence.status, 'fused-resident-sequence-executed');
  assert.equal(execution.fusedResidentSequence.activeGridDispatch.useActiveGrid, true);
  assert.equal(execution.finalStep.stageTiming.fusedResidentSequence, true);
  assert.equal(execution.finalStep.stageTiming.fusedResidentSequenceStepCount, 2);
  assert.equal(execution.finalStep.stageTiming.compactSummaryRequested, false);
  assert.equal(execution.finalStep.stageTiming.activeGridDispatchPlanOnlyRequested, true);
  assert.equal(execution.finalStep.compactGpuSummary.status, 'compact-summary-plan-only-ready');
  assert.equal(execution.finalStep.compactGpuSummary.readbackMode, 'no-compact-summary-readback');
  assert.equal(execution.finalStep.compactGpuSummary.timing.mapAsyncWaitMs, null);
  assert.equal(Number.isFinite(execution.finalStep.stageTiming.stageMs.compactSummary), true);
  assert.equal(execution.finalStep.stageTiming.activeGridDispatch.useActiveGrid, true);
  assert.ok(queueFenceCount >= 1);
  assert.equal(execution.finalStep.stageTiming.queueFenceStatus.fusedMechanicsSequence, 'complete');
  assert.equal(execution.finalStep.stageTiming.queueFenceMethod.fusedMechanicsSequence, 'queue.onSubmittedWorkDone');
  assert.equal(Number.isFinite(execution.finalStep.stageTiming.queueFenceMs.fusedMechanicsSequence), true);
  assert.equal(execution.fusedResidentSequence.queueFenceRequested, true);
  assert.equal(execution.fusedResidentSequence.queueFenceStatus, 'complete');
  assert.equal(execution.stepSummaries[0].compactSummaryAvailable ?? false, false);
  assert.equal(execution.stepSummaries[1].compactSummaryAvailable ?? false, false);
  assert.equal(device.submissions.length, 2);
  assert.equal(execution.finalStep.stageTiming.activeGridIndirectDispatch.dispatchMode, 'dispatchWorkgroupsIndirect');
  assert.equal(execution.finalStep.stageTiming.activeGridIndirectDispatch.indirectDispatchUseCount, 6);
  assert.equal(device.dispatches.length, 7);
  assert.equal(device.indirectDispatches.length, 6);
  // Spatial-density EOS copies are gated off while the estimator is
  // disabled (aliasing instability); no grid->previous copies are encoded.
  assert.equal(device.copies.length, 0);
  destroyMlsMpmResidentStepsBuffers(execution);
});

test('MLS-MPM resident steps compute task accepts fused active-grid no-summary retained handoff as fence evidence', async () => {
  const buffers = manualBuffers();
  const tracker = fakeBufferTracker();
  const device = fakeSummaryDevice(new Float32Array(MLS_MPM_GPU_RESIDENT_SUMMARY_FLOATS));
  const task = createMlsMpmResidentStepsComputeTask({
    ...buffers,
    sphParticleUpload: {
      status: 'webgpu-uploaded',
      stateBuffer: tracker.buffer('source-state'),
      thermoBuffer: tracker.buffer('source-thermo'),
      slot: 0
    },
    mlsMpmParticleUpload: {
      status: 'webgpu-uploaded',
      mechanicsBuffer: tracker.buffer('source-mechanics'),
      slot: 0
    },
    modulePath: './sphMlsMpmGpuStep.js',
    laneId: 'ulg:test:sph-resident-steps-fused-active-grid',
    stateKey: 'ulg:test:sph-state-steps-fused-active-grid',
    stepCount: 2,
    preferWebGpu: true,
    device,
    boxDimsM: [3, 3, 3],
    readbackMode: 'no-full-readback',
    compactSummaryMode: 'none',
    activeGridDispatchPlanRefreshMode: 'final-only',
    fuseNoFullResidentMechanicsSequence: true,
    fuseNoFullResidentMechanicsActiveGrid: true,
    activeGridSafetyCells: 1
  });

  const result = await runMlsMpmResidentStepsComputeTask(task.data);

  assert.equal(result.status, 'resident-steps-executed');
  assert.equal(result.finalStep.fusedResidentSequence.status, 'fused-resident-sequence-executed');
  assert.equal(result.finalStep.compactGpuSummary.status, 'compact-summary-plan-only-ready');
  assert.equal(result.gpuFence.status, 'queue-work-completed');
  assert.equal(result.gpuFence.method, 'queue.onSubmittedWorkDone');
  assert.equal(result.gpuFence.fenceSatisfied, true);
  assert.equal(
    result.gpuFence.satisfactionReason,
    'compute-task-observed-real-queue-completion'
  );
  assert.equal(result.commitDelta.payload.gpuFence.fenceSatisfied, true);
  assert.equal(result.commitDelta.payload.gpuFence.status, 'queue-work-completed');
  destroyMlsMpmResidentStepsBuffers(result);
});

test('MLS-MPM resident steps can opt into one-submit fused mechanics sequence', async () => {
  const buffers = manualBuffers();
  const tracker = fakeBufferTracker();
  const device = fakeSummaryDevice(new Float32Array(MLS_MPM_GPU_RESIDENT_SUMMARY_FLOATS));
  const sourceThermoBuffer = tracker.buffer('source-thermo');
  const execution = await runMlsMpmResidentStepsWithOptionalWebGpu({
    ...buffers,
    sphParticleUpload: {
      status: 'webgpu-uploaded',
      stateBuffer: tracker.buffer('source-state'),
      thermoBuffer: sourceThermoBuffer,
      slot: 0
    },
    mlsMpmParticleUpload: {
      status: 'webgpu-uploaded',
      mechanicsBuffer: tracker.buffer('source-mechanics'),
      slot: 0
    },
    stepCount: 2,
    preferWebGpu: true,
    device,
    boxDimsM: [3, 3, 3],
    readbackMode: 'no-full-readback',
    compactSummaryMode: 'final-only',
    fuseNoFullResidentMechanicsSequence: true,
    summaryRunner({ sphParticleUpload, mlsMpmParticleUpload, g2pReconstruction, gridUpdate }) {
      assert.equal(sphParticleUpload.stateBuffer.label, 'ulg-mls-mpm-fused-sequence-g2p-state-ping-a');
      assert.equal(mlsMpmParticleUpload.mechanicsBuffer.label, 'ulg-mls-mpm-fused-sequence-g2p-mechanics-ping-a');
      assert.equal(g2pReconstruction.stateBuffer.label, 'ulg-mls-mpm-fused-sequence-g2p-state-ping-b');
      assert.equal(gridUpdate.fusedResidentSequence, true);
      return {
        schema: 'peercompute.ulg.mls-mpm-resident-summary-execution.v0',
        backend: 'webgpu',
        status: 'compact-summary-ready',
        compactGpuSummaryAvailable: true,
        readbackMode: 'no-full-readback',
        summaryScope: 'full',
        particleCount: buffers.sphParticleState.particleCount,
        gridNodeCount: gridUpdate.gridNodeCount,
        activeGridNodeCount: null,
        activeGridNodeCountAvailable: false,
        activeGridNodeSummaryStatus: 'active-grid-node-summary-not-requested',
        gridNodeScanCount: 0,
        gridNodeScanSkipped: true,
        sourceMassKg: 8,
        nextMassKg: 8,
        massDeltaKg: 0,
        maxSpeedMPerS: 0,
        maxDisplacementM: 0,
        minVolumeRatioJ: 1,
        maxVolumeRatioJ: 1,
        phaseMassKg: { solid: 0, liquid: 8, gas: 0, plasma: 0 },
        phaseMassTotalKg: 8,
        thermalPhaseSummaryAvailable: true,
        compactReadbackByteLength: MLS_MPM_GPU_RESIDENT_SUMMARY_BYTES,
        timing: {
          schema: 'peercompute.ulg.mls-mpm-resident-summary-timing.v0',
          totalMs: 0,
          setupMs: 0,
          encodeMs: 0,
          submitMs: 0,
          mapAsyncWaitMs: 0,
          decodeMs: 0,
          queueFenceAttribution: 'unit-summary-runner',
          summaryKernelDispatchCount: 0,
          summaryWorkgroupCount: 0,
          compactReadbackByteLength: MLS_MPM_GPU_RESIDENT_SUMMARY_BYTES
        },
        mapAsyncWaitMs: 0,
        queueFenceAttribution: 'unit-summary-runner'
      };
    }
  });

  assert.equal(execution.schema, ULG_MLS_MPM_GPU_RESIDENT_STEPS_EXECUTION_SCHEMA);
  assert.equal(execution.status, 'resident-steps-executed');
  assert.equal(execution.stepCount, 2);
  assert.equal(execution.completedStepCount, 2);
  assert.equal(execution.fusedResidentSequence.status, 'fused-resident-sequence-executed');
  assert.equal(execution.fusedResidentSequence.commandSubmissionCount, 1);
  assert.equal(execution.finalStep.stageTiming.fusedResidentSequence, true);
  assert.equal(execution.finalStep.stageTiming.fusedResidentSequenceStepCount, 2);
  assert.equal(execution.finalStep.particlePingPong.sourceSlot, 1);
  assert.equal(execution.finalStep.particlePingPong.nextSlot, 0);
  assert.equal(execution.finalStep.particlePingPong.step, 1);
  assert.equal(execution.finalStep.particlePingPong.nextStep, 2);
  assert.equal(execution.nextSphParticleState.step, 2);
  assert.equal(execution.nextSphParticleState.time, 0.2);
  assert.equal(execution.nextSphParticleState.cpuStateStale, true);
  assert.equal(execution.nextParticleUploads.sphParticleUpload.stateBuffer.label, 'ulg-mls-mpm-fused-sequence-g2p-state-ping-b');
  assert.equal(execution.nextParticleUploads.sphParticleUpload.thermoBuffer, sourceThermoBuffer);
  assert.equal(execution.nextParticleUploads.mlsMpmParticleUpload.mechanicsBuffer.label, 'ulg-mls-mpm-fused-sequence-g2p-mechanics-ping-b');
  assert.equal(execution.stepSummaries.length, 2);
  assert.equal(execution.stepSummaries[0].status, 'resident-step-fused-sequence-intermediate');
  assert.equal(execution.stepSummaries[1].status, 'resident-step-webgpu-executed');
  assert.equal(execution.stepSummaries[0].fusedResidentSequence, true);
  assert.equal(device.submissions.length, 1);
  assert.equal(device.dispatches.length, 8);
  // These two are read-only all-zero rows that stand in for a disabled feature.
  // They are shared per device rather than rebuilt and destroyed per substep,
  // so they are created exactly once and deliberately never destroyed --
  // destroying one would pull the binding out from under every later substep.
  for (const label of [
    'ulg-mls-mpm-fused-sequence-empty-schroeder-level-assignments',
    'ulg-mls-mpm-fused-sequence-empty-schroeder-spatial-directory'
  ]) {
    const shared = device.createdBuffers.filter((buffer) => buffer.label === label);
    assert.equal(shared.length, 1, `${label} must be allocated once, not per substep`);
    assert.equal(shared[0].destroyed, false, `${label} is shared and must not be destroyed`);
  }
  // 11 -> 10: the previous-grid EOS buffer is gone - its binding 9 pushed
  // P2G past the DEFAULT 8-storage-buffer per-stage limit and invalidated
  // every P2G pipeline on default-limit devices. 10 -> 8: the two shared
  // zero-row placeholders above are no longer destroyed with the substep.
  assert.equal(device.createdBuffers.filter((buffer) => buffer.destroyed).length, 8);
  destroyMlsMpmResidentStepsBuffers(execution);
  const undestroyed = device.createdBuffers.filter((buffer) => !buffer.destroyed);
  assert.deepEqual(
    undestroyed.map((buffer) => buffer.label).sort(),
    [
      'ulg-mls-mpm-fused-sequence-empty-schroeder-level-assignments',
      'ulg-mls-mpm-fused-sequence-empty-schroeder-spatial-directory'
    ],
    'only the shared zero-row placeholders outlive the execution'
  );
});

test('MLS-MPM multi-step sequence rejects one canonical generation across position epochs', async () => {
  const buffers = manualBuffers();
  const tracker = fakeBufferTracker();
  const device = fakeSummaryDevice(new Float32Array(MLS_MPM_GPU_RESIDENT_SUMMARY_FLOATS));
  const sourceThermoBuffer = tracker.buffer('source-thermo');
  const schroederAssignmentBuffer = tracker.buffer('retained-schroeder-sequence-assignment');
  const schroederSpatialDirectoryBuffer = tracker.buffer('retained-schroeder-sequence-spatial-directory');
  await assert.rejects(() => runMlsMpmResidentStepsWithOptionalWebGpu({
    ...buffers,
    sphParticleUpload: {
      status: 'webgpu-uploaded',
      stateBuffer: tracker.buffer('source-state'),
      thermoBuffer: sourceThermoBuffer,
      slot: 0
    },
    mlsMpmParticleUpload: {
      status: 'webgpu-uploaded',
      mechanicsBuffer: tracker.buffer('source-mechanics'),
      slot: 0
    },
    schroederLevelAssignment: {
      schema: ULG_SCHROEDER_LEVEL_ASSIGNMENT_EXECUTION_SCHEMA,
      status: 'schroeder-level-assignment-submitted',
      particleCount: buffers.sphParticleState.particleCount,
      assignmentStrideFloats: SCHROEDER_LEVEL_ASSIGNMENT_ROW_LAYOUT.length,
      assignmentBuffer: schroederAssignmentBuffer,
      assignmentBufferByteLength: SCHROEDER_LEVEL_ASSIGNMENT_ROW_LAYOUT.length * Float32Array.BYTES_PER_ELEMENT,
      retainedAssignmentBuffer: true
    },
    schroederSelectedLevel: 2,
    schroederSpatialEpochGeneration: {
      schema: 'peercompute.ulg.schroeder-spatial-epoch-generation.v1',
      selected: true,
      ready: true,
      source: { phaseVolumeAssignmentOverlayEnabled: false },
      execution: {
        schema: 'peercompute.ulg.schroeder-spatial-epoch.v1',
        submitPerformed: true,
        directoryBuffer: schroederSpatialDirectoryBuffer,
        generationId: 41,
        storageGeneration: 43,
        positionEpoch: 47,
        topologyEpoch: 53,
        deviceOrdinal: 59,
        laneOrdinal: 61,
        leaseToken: 67,
        sourceFamilyId: 71,
        physicsTick: 73,
        physicsSubstep: 79,
        chartEpoch: 83,
        levelEpoch: 89,
        supportEpoch: 97,
        layout: { byteLength: 256 }
      }
    },
    canonicalSpatialRequired: true,
    stepCount: 2,
    preferWebGpu: true,
    device,
    boxDimsM: [3, 3, 3],
    ambientPressurePa: 101325,
    readbackMode: 'no-full-readback',
    compactSummaryMode: 'final-only',
    fuseNoFullResidentMechanicsSequence: true,
    summaryRunner({ gridUpdate, g2pReconstruction }) {
      assert.equal(gridUpdate.fusedResidentSequence, true);
      assert.equal(g2pReconstruction.fusedResidentSequence, true);
      return {
        schema: 'peercompute.ulg.mls-mpm-resident-summary-execution.v0',
        backend: 'webgpu',
        status: 'compact-summary-ready',
        compactGpuSummaryAvailable: true,
        readbackMode: 'no-full-readback',
        summaryScope: 'full',
        particleCount: buffers.sphParticleState.particleCount,
        gridNodeCount: gridUpdate.gridNodeCount,
        activeGridNodeCount: null,
        activeGridNodeCountAvailable: false,
        activeGridNodeSummaryStatus: 'active-grid-node-summary-not-requested',
        gridNodeScanCount: 0,
        gridNodeScanSkipped: true,
        sourceMassKg: 8,
        nextMassKg: 8,
        massDeltaKg: 0,
        maxSpeedMPerS: 0,
        maxDisplacementM: 0,
        minVolumeRatioJ: 1,
        maxVolumeRatioJ: 1,
        phaseMassKg: { solid: 0, liquid: 8, gas: 0, plasma: 0 },
        phaseMassTotalKg: 8,
        thermalPhaseSummaryAvailable: true,
        compactReadbackByteLength: MLS_MPM_GPU_RESIDENT_SUMMARY_BYTES,
        timing: {
          schema: 'peercompute.ulg.mls-mpm-resident-summary-timing.v0',
          totalMs: 0,
          setupMs: 0,
          encodeMs: 0,
          submitMs: 0,
          mapAsyncWaitMs: 0,
          decodeMs: 0,
          queueFenceAttribution: 'unit-summary-runner',
          summaryKernelDispatchCount: 0,
          summaryWorkgroupCount: 0,
          compactReadbackByteLength: MLS_MPM_GPU_RESIDENT_SUMMARY_BYTES
        },
        mapAsyncWaitMs: 0,
        queueFenceAttribution: 'unit-summary-runner'
      };
    }
  }), (error) => {
    assert.equal(error.code, 'ERR_CANONICAL_SPATIAL_AUTHORITY_REJECTED');
    assert.equal(error.status, 'canonical-spatial-generation-cannot-span-position-epochs');
    return true;
  });

  assert.equal(device.submissions.length, 0);
  assert.equal(device.dispatches.length, 0);
  assert.equal(device.createdBuffers.length, 0);
  assert.notEqual(schroederAssignmentBuffer.destroyed, true);
  assert.notEqual(schroederSpatialDirectoryBuffer.destroyed, true);
});

test('MLS-MPM resident fused mechanics sequence can opt into active-grid dispatch', async () => {
  const buffers = manualBuffers({ velocity: [0, 0, 0] });
  const tracker = fakeBufferTracker();
  const device = fakeSummaryDevice(new Float32Array(MLS_MPM_GPU_RESIDENT_SUMMARY_FLOATS));
  const summaryPlanArgsBuffer = tracker.buffer('summary-plan-args');
  summaryPlanArgsBuffer.lastWrite = new Uint32Array([4, 1, 1]).buffer;
  const summaryPlanMetadataBuffer = tracker.buffer('summary-plan-metadata');
  const execution = await runMlsMpmResidentStepsWithOptionalWebGpu({
    ...buffers,
    sphParticleUpload: {
      status: 'webgpu-uploaded',
      stateBuffer: tracker.buffer('source-state'),
      thermoBuffer: tracker.buffer('source-thermo'),
      slot: 0
    },
    mlsMpmParticleUpload: {
      status: 'webgpu-uploaded',
      mechanicsBuffer: tracker.buffer('source-mechanics'),
      slot: 0
    },
    stepCount: 2,
    preferWebGpu: true,
    device,
    boxDimsM: [3, 3, 3],
    gravityMPerS2: [0, 0, 0],
    readbackMode: 'no-full-readback',
    compactSummaryMode: 'final-only',
    fuseNoFullResidentMechanicsSequence: true,
    fuseNoFullResidentMechanicsActiveGrid: true,
    activeGridSafetyCells: 1,
    summaryRunner({ gridUpdate }) {
      assert.equal(gridUpdate.fusedResidentSequence, true);
      assert.equal(gridUpdate.activeGridDispatch.useActiveGrid, true);
      return {
        schema: 'peercompute.ulg.mls-mpm-resident-summary-execution.v0',
        backend: 'webgpu',
        status: 'compact-summary-ready',
        compactGpuSummaryAvailable: true,
        readbackMode: 'no-full-readback',
        summaryScope: 'full',
        particleCount: buffers.sphParticleState.particleCount,
        gridNodeCount: gridUpdate.gridNodeCount,
        activeGridNodeCount: null,
        activeGridNodeCountAvailable: false,
        activeGridNodeSummaryStatus: 'active-grid-node-summary-not-requested',
        gridNodeScanCount: 0,
        gridNodeScanSkipped: true,
        sourcePositionBoundsM: {
          status: 'position-bounds-ready',
          min: [1.25, 1.25, 1.25],
          max: [1.25, 1.25, 1.25],
          massKg: 8
        },
        nextPositionBoundsM: {
          status: 'position-bounds-ready',
          min: [1.125, 1.2, 1.175],
          max: [1.375, 1.4, 1.425],
          massKg: 8
        },
        sourceMassKg: 8,
        nextMassKg: 8,
        massDeltaKg: 0,
        maxSpeedMPerS: 0,
        maxDisplacementM: 0,
        minVolumeRatioJ: 1,
        maxVolumeRatioJ: 1,
        phaseMassKg: { solid: 0, liquid: 8, gas: 0, plasma: 0 },
        phaseMassTotalKg: 8,
        thermalPhaseSummaryAvailable: true,
        compactReadbackByteLength: MLS_MPM_GPU_RESIDENT_SUMMARY_BYTES,
        activeGridDispatchPlan: {
          schema: 'peercompute.ulg.mls-mpm-active-grid-summary-dispatch-plan.v0',
          status: 'gpu-active-grid-summary-dispatch-plan-ready',
          source: 'compact-summary-gpu-sidecar',
          dispatchArgsBufferRetained: true,
          dispatchArgsBufferByteLength: 12,
          metadataBufferRetained: true,
          metadataBufferByteLength: 64,
          metadataUintCount: 16,
          workgroupSize: 64,
          gridDims: [...gridUpdate.gridDims],
          gridShift: gridUpdate.gridShift,
          gridNodeCount: gridUpdate.gridNodeCount,
          gridSpacingM: gridUpdate.gridSpacingM,
          safetyCells: 1,
          stepCount: 2,
          dt: buffers.mlsMpmParticleState.mechanicsDtS,
          gravityMPerS2: [0, 0, 0],
          normalHotLoopReadbackFree: true
        },
        activeGridDispatchPlanDispatchArgsBuffer: summaryPlanArgsBuffer,
        activeGridDispatchPlanMetadataBuffer: summaryPlanMetadataBuffer,
        activeGridDispatchPlanDispatchArgsBufferByteLength: 12,
        activeGridDispatchPlanMetadataBufferByteLength: 64,
        activeGridDispatchPlanBuffersRetained: true,
        destroyActiveGridDispatchPlanBuffers() {
          summaryPlanArgsBuffer.destroy();
          summaryPlanMetadataBuffer.destroy();
        },
        timing: {
          schema: 'peercompute.ulg.mls-mpm-resident-summary-timing.v0',
          totalMs: 0,
          setupMs: 0,
          encodeMs: 0,
          submitMs: 0,
          mapAsyncWaitMs: 0,
          decodeMs: 0,
          queueFenceAttribution: 'unit-summary-runner',
          summaryKernelDispatchCount: 0,
          summaryWorkgroupCount: 0,
          compactReadbackByteLength: MLS_MPM_GPU_RESIDENT_SUMMARY_BYTES
        },
        mapAsyncWaitMs: 0,
        queueFenceAttribution: 'unit-summary-runner'
      };
    }
  });

  const activeGridDispatch = execution.fusedResidentSequence.activeGridDispatch;
  assert.equal(activeGridDispatch.status, 'active-grid-dispatch-ready');
  assert.equal(activeGridDispatch.useActiveGrid, true);
  assert.equal(activeGridDispatch.fullGridNodeCount, 512);
  assert.ok(activeGridDispatch.activeNodeCount < activeGridDispatch.fullGridNodeCount);
  assert.equal(execution.finalStep.p2gGridProjection.activeGridDispatch.useActiveGrid, true);
  assert.equal(execution.finalStep.gridUpdate.activeGridDispatch.useActiveGrid, true);
  assert.equal(execution.finalStep.stageTiming.activeGridDispatch.useActiveGrid, true);
  assert.equal(execution.finalStep.stageTiming.dispatchTopology.substepCount, 2);
  assert.equal(execution.finalStep.stageTiming.dispatchTopology.totalDispatches, 10);
  assert.equal(execution.finalStep.stageTiming.dispatchTopology.p2g.topology, 'particle-parallel-scatter');
  assert.equal(execution.finalStep.stageTiming.dispatchTopology.g2p.dispatchAxis, 'particle');
  assert.equal(execution.finalStep.stageTiming.dispatchTopology.p2gAccumulatorClear.dispatchAxis, 'active-grid-node');
  assert.equal(
    execution.finalStep.stageTiming.dispatchTopology.p2gAccumulatorClear.bufferClearMode,
    'active-grid-compute-clear'
  );
  assert.equal(execution.finalStep.stageTiming.dispatchTopology.gridUpdate.dispatchAxis, 'active-grid-node');
  assert.equal(execution.finalStep.fusedResidentSequence.dispatchTopology.totalDispatches, 10);
  assert.equal(execution.finalStep.fusedResidentSequence.dispatchCount, 10);
  assert.equal(
    execution.finalStep.stageTiming.activeGridIndirectDispatch.status,
    'cpu-seeded-active-grid-indirect-dispatch-ready'
  );
  assert.equal(execution.finalStep.stageTiming.activeGridIndirectDispatch.dispatchMode, 'dispatchWorkgroupsIndirect');
  assert.equal(execution.finalStep.stageTiming.activeGridIndirectDispatch.indirectDispatchUseCount, 6);
  assert.equal(execution.finalStep.stageTiming.dispatchTopology.gridUpdate.dispatchSubmissionMode, 'dispatchWorkgroupsIndirect');
  assert.equal(execution.stepSummaries[0].diagnostics.dispatchTopologyStatus, 'resident-dispatch-topology-ready');
  assert.equal(execution.stepSummaries[0].diagnostics.cpuParticleLoopInHotPath, false);
  assert.equal(execution.finalStep.residentPositionBoundsSource, 'compact-gpu-summary-next-bounds');
  assert.equal(execution.nextSphParticleState.residentPositionBoundsSource, 'compact-gpu-summary-next-bounds');
  assert.deepEqual(execution.nextSphParticleState.residentPositionBoundsM.min, [1.125, 1.2, 1.175]);
  assert.deepEqual(execution.nextSphParticleState.residentPositionBoundsM.max, [1.375, 1.4, 1.425]);
  assert.equal(execution.nextSphParticleState.residentMaxSpeedMPerS, 0);
  assert.equal(
    execution.nextSphParticleState.residentActiveGridDispatchPlanHint.status,
    'active-grid-summary-dispatch-plan-hint-ready'
  );
  assert.equal(execution.nextSphParticleState.residentActiveGridDispatchPlanHint.dispatchArgsBuffer, summaryPlanArgsBuffer);
  assert.equal(execution.nextParticleUploads.activeGridDispatchPlanHint.metadataBuffer, summaryPlanMetadataBuffer);
  assert.equal(device.clears.length, 0);
  assert.deepEqual(device.dispatches.map((entry) => entry.count), [1, 1, 1, 1]);
  assert.deepEqual(device.indirectDispatches.map((entry) => entry.workgroupCountX), [4, 4, 4, 4, 4, 4]);
  const second = await runMlsMpmResidentStepsWithOptionalWebGpu({
    ...buffers,
    sphParticleState: execution.nextSphParticleState,
    mlsMpmParticleState: execution.nextMlsMpmParticleState,
    sphParticleUpload: execution.nextParticleUploads.sphParticleUpload,
    mlsMpmParticleUpload: execution.nextParticleUploads.mlsMpmParticleUpload,
    stepCount: 2,
    preferWebGpu: true,
    device,
    boxDimsM: [3, 3, 3],
    gravityMPerS2: [0, 0, 0],
    readbackMode: 'no-full-readback',
    compactSummaryMode: 'none',
    fuseNoFullResidentMechanicsSequence: true,
    fuseNoFullResidentMechanicsActiveGrid: true,
    activeGridSafetyCells: 1
  });
  assert.equal(
    second.finalStep.stageTiming.activeGridIndirectDispatch.status,
    'gpu-summary-active-grid-indirect-dispatch-ready'
  );
  assert.equal(second.finalStep.stageTiming.activeGridIndirectDispatch.source, 'compact-summary-gpu-sidecar');
  assert.equal(second.finalStep.stageTiming.activeGridIndirectDispatch.dispatchPlanHintBorrowed, true);
  assert.equal(second.finalStep.stageTiming.activeGridIndirectDispatch.ownsBuffer, false);
  assert.equal(second.finalStep.stageTiming.activeGridIndirectDispatch.metadataBufferByteLength, 64);
  assert.equal(second.finalStep.stageTiming.activeGridDispatchPlanOnlyRequested, true);
  assert.equal(second.finalStep.compactGpuSummary.status, 'compact-summary-plan-only-ready');
  assert.equal(second.finalStep.compactGpuSummary.readbackMode, 'no-compact-summary-readback');
  assert.equal(
    second.nextSphParticleState.residentActiveGridDispatchPlanHint.status,
    'active-grid-summary-dispatch-plan-hint-ready'
  );
  assert.equal(second.nextSphParticleState.residentActiveGridDispatchPlanHint.source, 'compact-summary-gpu-sidecar');
  assert.deepEqual(device.indirectDispatches.slice(-6).map((entry) => entry.buffer.label), [
    'summary-plan-args',
    'summary-plan-args',
    'summary-plan-args',
    'summary-plan-args',
    'summary-plan-args',
    'summary-plan-args'
  ]);
  destroyMlsMpmResidentStepsBuffers(execution);
  destroyMlsMpmResidentStepsBuffers(second);
});

test('MLS-MPM resident fused mechanics sequence carries active-grid bounds across unread batches', async () => {
  const buffers = manualBuffers({
    position: [2.5, 2.5, 2.5],
    velocity: [0, 0, 0],
    smoothingLengthM: 0.25
  });
  const tracker = fakeBufferTracker();
  const device = fakeSummaryDevice(new Float32Array(MLS_MPM_GPU_RESIDENT_SUMMARY_FLOATS));
  const baseOptions = {
    ...buffers,
    stepCount: 2,
    preferWebGpu: true,
    device,
    boxDimsM: [5, 5, 5],
    gravityMPerS2: [0, 0, 0],
    readbackMode: 'no-full-readback',
    compactSummaryMode: 'none',
    fuseNoFullResidentMechanicsSequence: true,
    fuseNoFullResidentMechanicsActiveGrid: true,
    activeGridSafetyCells: 1
  };
  const first = await runMlsMpmResidentStepsWithOptionalWebGpu({
    ...baseOptions,
    sphParticleUpload: {
      status: 'webgpu-uploaded',
      stateBuffer: tracker.buffer('source-state'),
      thermoBuffer: tracker.buffer('source-thermo'),
      slot: 0
    },
    mlsMpmParticleUpload: {
      status: 'webgpu-uploaded',
      mechanicsBuffer: tracker.buffer('source-mechanics'),
      slot: 0
    }
  });
  const second = await runMlsMpmResidentStepsWithOptionalWebGpu({
    ...baseOptions,
    sphParticleState: first.nextSphParticleState,
    mlsMpmParticleState: first.nextMlsMpmParticleState,
    sphParticleUpload: first.nextParticleUploads.sphParticleUpload,
    mlsMpmParticleUpload: first.nextParticleUploads.mlsMpmParticleUpload
  });

  assert.equal(first.fusedResidentSequence.activeGridDispatch.useActiveGrid, true);
  assert.equal(first.nextSphParticleState.cpuStateStale, true);
  assert.equal(first.nextSphParticleState.residentPositionBoundsM.status, 'resident-active-grid-predicted-bounds');
  assert.equal(first.nextSphParticleState.residentPositionBoundsSource, 'active-grid-predicted-bounds');
  assert.equal(second.fusedResidentSequence.activeGridDispatch.useActiveGrid, true);
  assert.equal(second.fusedResidentSequence.activeGridDispatch.boundsSource, 'resident-position-bounds');
  assert.notEqual(second.fusedResidentSequence.activeGridDispatch.reason, 'position-bounds-unavailable');
  assert.equal(
    second.fusedResidentSequence.activeGridDispatch.activeNodeCount,
    first.fusedResidentSequence.activeGridDispatch.activeNodeCount
  );
  assert.deepEqual(first.nextSphParticleState.residentPositionBoundsM.min, [2.5, 2.5, 2.5]);
  assert.deepEqual(first.nextSphParticleState.residentPositionBoundsM.max, [2.5, 2.5, 2.5]);
  destroyMlsMpmResidentStepsBuffers(first);
  destroyMlsMpmResidentStepsBuffers(second);
});

test('MLS-MPM resident steps avoid full-grid per-step fused fallback when thermal blocks fused sequence', async () => {
  const buffers = manualBuffers();
  const tracker = fakeBufferTracker();
  const device = fakeSummaryDevice(new Float32Array(MLS_MPM_GPU_RESIDENT_SUMMARY_FLOATS));
  const thermalInputs = [];
  const execution = await runMlsMpmResidentStepsWithOptionalWebGpu({
    ...buffers,
    sphParticleUpload: {
      status: 'webgpu-uploaded',
      stateBuffer: tracker.buffer('source-state'),
      thermoBuffer: tracker.buffer('source-thermo'),
      slot: 0
    },
    mlsMpmParticleUpload: {
      status: 'webgpu-uploaded',
      mechanicsBuffer: tracker.buffer('source-mechanics'),
      slot: 0
    },
    stepCount: 2,
    preferWebGpu: true,
    device,
    boxDimsM: [3, 3, 3],
    readbackMode: 'no-full-readback',
    compactSummaryMode: 'final-only',
    compactSummaryScope: 'particle-visual',
    fuseNoFullResidentMechanicsSequence: true,
    thermalMaterialTable: { schema: 'peercompute.ulg.sph-gpu-thermal-material-table.v0' },
    thermalStepRunner(args) {
      thermalInputs.push({
        stateBufferLabel: args.sourceStateBuffer?.label ?? null,
        thermoBufferLabel: args.sourceThermoBuffer?.label ?? null,
        readbackMode: args.readbackMode
      });
      const index = thermalInputs.length;
      return {
        schema: ULG_SPH_GPU_THERMAL_STEP_SCHEMA,
        backend: 'webgpu',
        status: 'thermal-step-executed',
        particleCount: buffers.sphParticleState.particleCount,
        state: new Float32Array(),
        thermo: new Float32Array(),
        stateBuffer: tracker.buffer(`thermal-state-${index}`),
        thermoBuffer: tracker.buffer(`thermal-thermo-${index}`),
        stateBufferByteLength: buffers.sphParticleState.state.byteLength,
        thermoBufferByteLength: buffers.sphParticleState.thermo.byteLength,
        retainedOutputParticleBuffers: true,
        readbackMode: args.readbackMode,
        normalHotLoopReadbackFree: true,
        destroyOutputParticleBuffers() {
          this.stateBuffer.destroy();
          this.thermoBuffer.destroy();
        }
      };
    },
    summaryRunner({ gridUpdate, g2pReconstruction, thermalStep, summaryScope }) {
      assert.notEqual(gridUpdate.fusedResidentMechanics, true);
      assert.notEqual(g2pReconstruction.fusedResidentMechanics, true);
      assert.equal(thermalStep?.backend, 'webgpu');
      return {
        schema: 'peercompute.ulg.mls-mpm-resident-summary-execution.v0',
        backend: 'webgpu',
        status: 'compact-summary-ready',
        compactGpuSummaryAvailable: true,
        readbackMode: 'no-full-readback',
        summaryScope,
        particleCount: buffers.sphParticleState.particleCount,
        gridNodeCount: gridUpdate.gridNodeCount,
        activeGridNodeCount: null,
        activeGridNodeCountAvailable: false,
        activeGridNodeSummaryStatus: 'active-grid-node-summary-not-requested',
        gridNodeScanCount: 0,
        gridNodeScanSkipped: true,
        sourceMassKg: 8,
        nextMassKg: 8,
        massDeltaKg: 0,
        maxSpeedMPerS: 0,
        maxDisplacementM: 0,
        minVolumeRatioJ: 1,
        maxVolumeRatioJ: 1,
        phaseMassKg: { solid: 0, liquid: 8, gas: 0, plasma: 0 },
        phaseMassTotalKg: 8,
        thermalPhaseSummaryAvailable: true,
        compactReadbackByteLength: MLS_MPM_GPU_RESIDENT_SUMMARY_BYTES,
        timing: {
          schema: 'peercompute.ulg.mls-mpm-resident-summary-timing.v0',
          totalMs: 0,
          setupMs: 0,
          encodeMs: 0,
          submitMs: 0,
          mapAsyncWaitMs: 0,
          decodeMs: 0,
          queueFenceAttribution: 'unit-summary-runner',
          summaryKernelDispatchCount: 0,
          summaryWorkgroupCount: 0,
          compactReadbackByteLength: MLS_MPM_GPU_RESIDENT_SUMMARY_BYTES
        },
        mapAsyncWaitMs: 0,
        queueFenceAttribution: 'unit-summary-runner'
      };
    }
  });

  assert.equal(execution.fusedResidentSequence, undefined);
  assert.equal(
    execution.fusedResidentSequencePreflight.schema,
    'peercompute.ulg.mls-mpm-fused-resident-sequence-preflight.v0'
  );
  assert.equal(execution.fusedResidentSequencePreflight.status, 'blocked-fused-resident-sequence');
  assert.equal(execution.fusedResidentSequencePreflight.sequenceRequested, true);
  assert.equal(execution.fusedResidentSequencePreflight.sequenceRunnable, false);
  assert.equal(execution.fusedResidentSequencePreflight.fallbackMode, 'per-step-resident-pass-dag');
  assert.deepEqual(execution.fusedResidentSequencePreflight.sidecarBlockers, ['thermal-sidecar']);
  assert.equal(execution.fusedResidentSequencePreflight.thermalAwareFusionRequired, true);
  assert.equal(execution.fusedResidentSequencePreflight.sidecarFusionRequired, true);
  assert.equal(execution.fusedResidentSequencePreflight.sidecarFusionRunnable, false);
  assert.equal(
    execution.fusedResidentSequencePreflight.sidecarFusionPlan.status,
    'sidecar-fusion-plan-ready-execution-blocked'
  );
  assert.deepEqual(
    execution.fusedResidentSequencePreflight.sidecarFusionPlan.stages.map((stage) => stage.id),
    ['thermal-phase', 'mechanics-refresh']
  );
  assert.equal(
    execution.finalStep.stageTiming.fusedResidentSequencePreflight.status,
    'blocked-fused-resident-sequence'
  );
  assert.equal(execution.finalStep.sidecarFusionStepEvidence.status, 'sidecar-fusion-step-evidence-partial');
  assert.equal(execution.finalStep.sidecarFusionStepEvidence.stageCount, 2);
  assert.equal(execution.finalStep.sidecarFusionStepEvidence.executedStageCount, 1);
  assert.equal(execution.finalStep.sidecarFusionStepEvidence.passedStageCount, 1);
  assert.equal(execution.finalStep.sidecarFusionStepEvidence.promotesFusedSequence, false);
  assert.equal(execution.stepSummaries[1].sidecarFusionStepEvidenceStatus, 'sidecar-fusion-step-evidence-partial');
  assert.equal(execution.stepSummaries[1].sidecarFusionStepEvidencePassedStageCount, 1);
  assert.equal(execution.finalStep.stageTiming.fusedResidentMechanics, false);
  assert.equal(execution.finalStep.stageTiming.fusedResidentSequence, undefined);
  assert.equal(execution.finalStep.stageTiming.thermalRequested, true);
  assert.ok(execution.finalStep.stageTiming.stageMs.p2gGridProjection > 0);
  assert.ok(execution.finalStep.stageTiming.stageMs.gridUpdate > 0);
  assert.ok(execution.finalStep.stageTiming.stageMs.g2pReconstruction > 0);
  assert.equal(thermalInputs.length, 2);
  assert.notEqual(thermalInputs[0].stateBufferLabel, 'ulg-mls-mpm-fused-g2p-state-out');
  assert.notEqual(thermalInputs[1].stateBufferLabel, 'ulg-mls-mpm-fused-g2p-state-out');
  assert.equal(device.submissions.length, 6);
  assert.equal(device.dispatches.length, 8);
  destroyMlsMpmResidentStepsBuffers(execution);
});

test('MLS-MPM resident steps can defer active-grid plan-only summary until final thermal step', async () => {
  const buffers = manualBuffers({
    position: [1.25, 1.25, 1.25],
    velocity: [0, 0, 0],
    smoothingLengthM: 0.25
  });
  const tracker = fakeBufferTracker();
  const device = fakeSummaryDevice(new Float32Array(MLS_MPM_GPU_RESIDENT_SUMMARY_FLOATS));
  const thermalInputs = [];
  const execution = await runMlsMpmResidentStepsWithOptionalWebGpu({
    ...buffers,
    sphParticleUpload: {
      status: 'webgpu-uploaded',
      stateBuffer: tracker.buffer('source-state'),
      thermoBuffer: tracker.buffer('source-thermo'),
      slot: 0
    },
    mlsMpmParticleUpload: {
      status: 'webgpu-uploaded',
      mechanicsBuffer: tracker.buffer('source-mechanics'),
      slot: 0
    },
    stepCount: 3,
    preferWebGpu: true,
    device,
    boxDimsM: [3, 3, 3],
    gravityMPerS2: [0, 0, 0],
    readbackMode: 'no-full-readback',
    compactSummaryMode: 'none',
    fuseNoFullResidentMechanicsSequence: true,
    fuseNoFullResidentMechanicsActiveGrid: true,
    activeGridDispatchPlanRefreshMode: 'final-only',
    activeGridSafetyCells: 1,
    thermalMaterialTable: { schema: 'peercompute.ulg.sph-gpu-thermal-material-table.v0' },
    thermalStepRunner(args) {
      thermalInputs.push({
        sourceStateBuffer: args.sourceStateBuffer?.label ?? null,
        readbackMode: args.readbackMode
      });
      const index = thermalInputs.length;
      return {
        schema: ULG_SPH_GPU_THERMAL_STEP_SCHEMA,
        backend: 'webgpu',
        status: 'thermal-step-executed',
        particleCount: buffers.sphParticleState.particleCount,
        state: new Float32Array(),
        thermo: new Float32Array(),
        stateBuffer: tracker.buffer(`deferred-thermal-state-${index}`),
        thermoBuffer: tracker.buffer(`deferred-thermal-thermo-${index}`),
        stateBufferByteLength: buffers.sphParticleState.state.byteLength,
        thermoBufferByteLength: buffers.sphParticleState.thermo.byteLength,
        retainedOutputParticleBuffers: true,
        readbackMode: args.readbackMode,
        normalHotLoopReadbackFree: true,
        destroyOutputParticleBuffers() {
          this.stateBuffer.destroy();
          this.thermoBuffer.destroy();
        }
      };
    }
  });

  assert.equal(execution.activeGridDispatchPlanRefreshMode, 'final-only');
  assert.equal(execution.fusedResidentSequence, undefined);
  assert.equal(execution.fusedResidentSequencePreflight.status, 'blocked-fused-resident-sequence');
  assert.equal(execution.fusedResidentSequencePreflight.fallbackMode, 'per-step-fused-mechanics-active-grid');
  assert.deepEqual(execution.fusedResidentSequencePreflight.sidecarBlockers, ['thermal-sidecar']);
  assert.equal(execution.fusedResidentSequencePreflight.sidecarFusionPlan.stageCount, 2);
  assert.deepEqual(execution.fusedResidentSequencePreflight.sidecarFusionPlan.requiredStageOrder, [
    'mechanics-p2g',
    'mechanics-grid-update',
    'mechanics-g2p',
    'thermal-phase',
    'mechanics-refresh',
    'resident-compact-summary-or-active-grid-plan'
  ]);
  assert.equal(execution.finalStep.stageTiming.fusedResidentSequencePreflight.fallbackMode, 'per-step-fused-mechanics-active-grid');
  assert.equal(thermalInputs.length, 3);
  assert.equal(execution.stepSummaries.length, 3);
  for (const summary of execution.stepSummaries.slice(0, 2)) {
    assert.equal(summary.stageTiming.activeGridDispatchPlanOnlyEligible, true);
    assert.equal(summary.stageTiming.activeGridDispatchPlanOnlyRequested, false);
    assert.equal(summary.stageTiming.activeGridDispatchPlanRefreshMode, 'final-only');
    assert.equal(summary.stageTiming.activeGridDispatchPlanRefreshFinalStep, false);
    assert.equal(
      summary.stageTiming.activeGridDispatchPlanRefreshSkippedReason,
      'active-grid-plan-refresh-deferred-until-final-step'
    );
    assert.equal(summary.diagnostics.activeGridDispatchPlanStatus ?? null, null);
  }
  assert.equal(execution.finalStep.stageTiming.activeGridDispatchPlanOnlyEligible, true);
  assert.equal(execution.finalStep.stageTiming.activeGridDispatchPlanOnlyRequested, true);
  assert.equal(execution.finalStep.stageTiming.activeGridDispatchPlanRefreshMode, 'final-only');
  assert.equal(execution.finalStep.stageTiming.activeGridDispatchPlanRefreshFinalStep, true);
  assert.equal(execution.finalStep.stageTiming.activeGridDispatchPlanRefreshSkippedReason, null);
  assert.equal(execution.finalStep.compactGpuSummary.status, 'compact-summary-plan-only-ready');
  assert.equal(execution.finalStep.compactGpuSummary.readbackMode, 'no-compact-summary-readback');
  assert.equal(
    execution.nextSphParticleState.residentActiveGridDispatchPlanHint.status,
    'active-grid-summary-dispatch-plan-hint-ready'
  );
  destroyMlsMpmResidentStepsBuffers(execution);
});

test('MLS-MPM resident steps summarize thermal sidecar-aware sequence evidence after mechanics refresh', async () => {
  const buffers = manualBuffers({
    position: [1.25, 1.25, 1.25],
    velocity: [0, 0, 0],
    smoothingLengthM: 0.25
  });
  const tracker = fakeBufferTracker();
  const device = fakeSummaryDevice(new Float32Array(MLS_MPM_GPU_RESIDENT_SUMMARY_FLOATS));
  const mechanicsMaterialTable = buildMlsMpmMechanicsMaterialTable({
    h2o: {
      molarMassKgPerMol: 0.018,
      phases: [
        { name: 'liquid', densityKgPerM3: 1000, bulkModulusPa: 2.2e9, shearModulusPa: 0, cpJPerKgK: 4184, temperatureRange: [273.15, 373.15] }
      ]
    }
  });
  const thermalInputs = [];
  const mechanicsRefreshInputs = [];
  const progressEvents = [];
  const execution = await runMlsMpmResidentStepsWithOptionalWebGpu({
    ...buffers,
    sphParticleUpload: {
      status: 'webgpu-uploaded',
      stateBuffer: tracker.buffer('source-state'),
      thermoBuffer: tracker.buffer('source-thermo'),
      slot: 0
    },
    mlsMpmParticleUpload: {
      status: 'webgpu-uploaded',
      mechanicsBuffer: tracker.buffer('source-mechanics'),
      slot: 0
    },
    stepCount: 2,
    preferWebGpu: true,
    device,
    boxDimsM: [3, 3, 3],
    gravityMPerS2: [0, 0, 0],
    ambientPressurePa: 101325,
    readbackMode: 'no-full-readback',
    compactSummaryMode: 'none',
    fuseNoFullResidentMechanicsSequence: true,
    fuseNoFullResidentMechanicsActiveGrid: true,
    activeGridDispatchPlanRefreshMode: 'final-only',
    activeGridSafetyCells: 1,
    thermalMaterialTable: { schema: 'peercompute.ulg.sph-gpu-thermal-material-table.v0' },
    mechanicsMaterialTable,
    onResidentStageProgress(event) {
      progressEvents.push(event);
    },
    thermalStepRunner(args) {
      thermalInputs.push({
        sourceStateBuffer: args.sourceStateBuffer?.label ?? null,
        readbackMode: args.readbackMode
      });
      const index = thermalInputs.length;
      return {
        schema: ULG_SPH_GPU_THERMAL_STEP_SCHEMA,
        backend: 'webgpu',
        status: 'thermal-step-executed',
        particleCount: buffers.sphParticleState.particleCount,
        state: new Float32Array(),
        thermo: new Float32Array(),
        stateBuffer: tracker.buffer(`aware-thermal-state-${index}`),
        thermoBuffer: tracker.buffer(`aware-thermal-thermo-${index}`),
        stateBufferByteLength: buffers.sphParticleState.state.byteLength,
        thermoBufferByteLength: buffers.sphParticleState.thermo.byteLength,
        retainedOutputParticleBuffers: true,
        readbackMode: args.readbackMode,
        normalHotLoopReadbackFree: true,
        destroyOutputParticleBuffers() {
          this.stateBuffer.destroy();
          this.thermoBuffer.destroy();
        }
      };
    },
    mechanicsRefreshRunner(args) {
      mechanicsRefreshInputs.push({
        sourceStateBuffer: args.sourceStateBuffer?.label ?? null,
        sourceThermoBuffer: args.sourceThermoBuffer?.label ?? null,
        readbackMode: args.readbackMode,
        mechanicsMaterialTable: args.mechanicsMaterialTable
      });
      const index = mechanicsRefreshInputs.length;
      return {
        schema: 'peercompute.ulg.mls-mpm-mechanics-refresh.v0',
        backend: 'webgpu',
        status: 'mechanics-constitutive-refresh-executed',
        particleCount: buffers.sphParticleState.particleCount,
        mechanics: new Float32Array(),
        mechanicsBuffer: tracker.buffer(`aware-refreshed-mechanics-${index}`),
        mechanicsBufferByteLength: buffers.mlsMpmParticleState.mechanics.byteLength,
        retainedOutputParticleBuffers: true,
        readbackMode: args.readbackMode,
        normalHotLoopReadbackFree: true
      };
    }
  });

  assert.equal(execution.fusedResidentSequence, undefined);
  assert.equal(execution.fusedResidentSequencePreflight.status, 'blocked-fused-resident-sequence');
  assert.equal(execution.fusedResidentSequencePreflight.sequenceRunnable, false);
  assert.equal(execution.fusedResidentSequencePreflight.sidecarOnlySequenceBlocked, true);
  assert.equal(execution.fusedResidentSequencePreflight.sidecarAwareSequenceCandidate, true);
  assert.equal(
    execution.fusedResidentSequencePreflight.sidecarAwareSequenceMode,
    'thermal-mechanics-refresh-per-step-fused-mechanics-active-grid'
  );
  assert.equal(
    execution.fusedResidentSequencePreflight.sidecarAwareSequenceRunner,
    'resident-sidecar-aware-sequence-loop'
  );
  assert.equal(
    execution.fusedResidentSequencePreflight.sidecarAwareSequencePath,
    'explicit-sidecar-aware-per-step-resident-loop'
  );
  assert.equal(
    execution.fusedResidentSequencePreflight.sidecarAwareDirectRunnerContract.schema,
    'peercompute.ulg.mls-mpm-thermal-sidecar-direct-runner-contract.v0'
  );
  assert.equal(
    execution.fusedResidentSequencePreflight.sidecarAwareDirectRunnerContractStatus,
    'thermal-sidecar-direct-runner-selected'
  );
  assert.equal(execution.fusedResidentSequencePreflight.sidecarAwareDirectRunnerEligible, true);
  assert.equal(execution.fusedResidentSequencePreflight.sidecarAwareDirectRunnerRunnable, true);
  assert.equal(execution.fusedResidentSequencePreflight.sidecarAwareDirectRunnerSelected, true);
  assert.equal(execution.fusedResidentSequencePreflight.sidecarAwareSequencePromotesFusedSequence, false);
  assert.equal(execution.sidecarAwareResidentSequenceActive, true);
  assert.equal(execution.sidecarAwareResidentSequenceRunner, 'resident-sidecar-aware-sequence-loop');
  assert.equal(execution.sidecarAwareResidentSequencePath, 'explicit-sidecar-aware-per-step-resident-loop');
  assert.equal(
    execution.sidecarAwareDirectRunnerContractStatus,
    'thermal-sidecar-direct-runner-selected'
  );
  assert.equal(execution.sidecarAwareDirectRunnerEligible, true);
  assert.equal(execution.sidecarAwareDirectRunnerRunnable, true);
  assert.equal(execution.sidecarAwareDirectRunnerSelected, true);
  assert.equal(execution.sidecarAwareResidentSequence.schema, 'peercompute.ulg.mls-mpm-sidecar-aware-resident-sequence.v0');
  assert.equal(execution.sidecarAwareResidentSequence.status, 'sidecar-aware-resident-sequence-evidence-ready');
  assert.equal(execution.sidecarAwareResidentSequence.mode, 'thermal-mechanics-refresh-per-step-fused-mechanics-active-grid');
  assert.equal(execution.sidecarAwareResidentSequence.runner, 'resident-sidecar-aware-sequence-loop');
  assert.equal(execution.sidecarAwareResidentSequence.sequencePath, 'explicit-sidecar-aware-per-step-resident-loop');
  assert.equal(
    execution.sidecarAwareResidentSequence.directRunnerContractStatus,
    'thermal-sidecar-direct-runner-selected'
  );
  assert.equal(execution.sidecarAwareResidentSequence.directRunnerEligible, true);
  assert.equal(execution.sidecarAwareResidentSequence.directRunnerRunnable, true);
  assert.equal(execution.sidecarAwareResidentSequence.directRunnerSelected, true);
  assert.deepEqual(
    execution.sidecarAwareResidentSequence.directRunnerContract.directRunnerSelectionBlockers,
    []
  );
  assert.equal(execution.sidecarAwareResidentSequence.stepCount, 2);
  assert.equal(execution.sidecarAwareResidentSequence.completedStepCount, 2);
  assert.equal(execution.sidecarAwareResidentSequence.passedStepCount, 2);
  assert.equal(execution.sidecarAwareResidentSequence.partialStepCount, 0);
  assert.equal(execution.sidecarAwareResidentSequence.allStepsPassed, true);
  assert.equal(execution.sidecarAwareResidentSequence.promotesFusedResidentSequence, false);
  assert.equal(execution.finalStep.sidecarAwareResidentSequence.status, 'sidecar-aware-resident-sequence-evidence-ready');
  assert.equal(
    execution.finalStep.stageTiming.sidecarAwareResidentSequence.status,
    'sidecar-aware-resident-sequence-evidence-ready'
  );
  assert.equal(execution.finalStep.stageTiming.sidecarAwareResidentSequenceActive, true);
  assert.equal(
    execution.finalStep.stageTiming.sidecarAwareResidentSequenceRunner,
    'resident-sidecar-aware-sequence-loop'
  );
  assert.equal(
    execution.finalStep.stageTiming.sidecarAwareDirectRunnerContractStatus,
    'thermal-sidecar-direct-runner-selected'
  );
  assert.equal(execution.finalStep.stageTiming.sidecarAwareDirectRunnerSelected, true);
  assert.equal(
    execution.finalStep.stageTiming.thermalSidecarDirectRunnerStatus,
    'thermal-sidecar-direct-runner-step-executed'
  );
  assert.equal(
    execution.finalStep.stageTiming.thermalSidecarDirectRunner.genericResidentStepEntrypointBypassed,
    true
  );
  assert.equal(execution.stepSummaries.length, 2);
  for (const summary of execution.stepSummaries) {
    assert.equal(summary.sidecarFusionStepEvidenceStatus, 'sidecar-fusion-step-evidence-ready');
    assert.equal(summary.sidecarFusionStepEvidenceStageCount, 2);
    assert.equal(summary.sidecarFusionStepEvidenceExecutedStageCount, 2);
    assert.equal(summary.sidecarFusionStepEvidencePassedStageCount, 2);
    assert.equal(summary.sidecarFusionStepEvidenceAllRequiredStagesPassed, true);
    assert.equal(summary.sidecarFusionStepEvidencePromotesFusedSequence, false);
    assert.equal(summary.sidecarAwareResidentSequenceActive, true);
    assert.equal(summary.sidecarAwareResidentSequenceRunner, 'resident-sidecar-aware-sequence-loop');
    assert.equal(summary.sidecarAwareResidentSequencePath, 'explicit-sidecar-aware-per-step-resident-loop');
    assert.equal(
      summary.sidecarAwareDirectRunnerContractStatus,
      'thermal-sidecar-direct-runner-selected'
    );
    assert.equal(summary.sidecarAwareDirectRunnerEligible, true);
    assert.equal(summary.sidecarAwareDirectRunnerRunnable, true);
    assert.equal(summary.sidecarAwareDirectRunnerSelected, true);
    assert.equal(summary.thermalSidecarDirectRunnerStatus, 'thermal-sidecar-direct-runner-step-executed');
    assert.equal(summary.thermalSidecarDirectRunnerGenericEntrypointBypassed, true);
  }
  assert.ok(progressEvents.some((event) => event.status === 'resident-sequence-thermal-sidecar-direct-runner-started'));
  assert.equal(
    progressEvents.filter((event) => event.status === 'resident-sequence-thermal-sidecar-direct-runner-step-started').length,
    2
  );
  assert.equal(
    progressEvents.filter((event) => event.status === 'resident-sequence-thermal-sidecar-direct-runner-step-complete').length,
    2
  );
  assert.ok(progressEvents.some((event) => event.status === 'resident-sequence-thermal-sidecar-direct-runner-complete'));
  assert.equal(thermalInputs.length, 2);
  assert.equal(mechanicsRefreshInputs.length, 2);
  assert.equal(mechanicsRefreshInputs[0].sourceStateBuffer, 'aware-thermal-state-1');
  assert.equal(mechanicsRefreshInputs[1].sourceStateBuffer, 'aware-thermal-state-2');
  assert.equal(mechanicsRefreshInputs[0].mechanicsMaterialTable, mechanicsMaterialTable);
  assert.equal(mechanicsRefreshInputs[1].readbackMode, 'no-full-readback');
  const p2gParamWrites = device.writes.filter((write) => write.label === 'ulg-mls-mpm-fused-p2g-params');
  assert.equal(p2gParamWrites.length, 2);
  for (const write of p2gParamWrites) {
    assert.equal(new DataView(write.data).getFloat32(68, true), 101325);
  }
  assert.equal(execution.ambientPressurePa, 101325);
  assert.equal(execution.ambientPressureAppliedInStressProjection, true);
  destroyMlsMpmResidentStepsBuffers(execution);
});

test('MLS-MPM fused resident sequence encodes thermal sidecar fusion in one submission', async () => {
  const buffers = manualBuffers({
    position: [1.25, 1.25, 1.25],
    velocity: [0, 0, 0],
    smoothingLengthM: 0.25
  });
  const tracker = fakeBufferTracker();
  const device = fakeSummaryDevice(new Float32Array(MLS_MPM_GPU_RESIDENT_SUMMARY_FLOATS));
  const materialProperties = {
    h2o: {
      molarMassKgPerMol: 0.018,
      phases: [
        {
          name: 'liquid',
          densityKgPerM3: 1000,
          bulkModulusPa: 2.2e9,
          shearModulusPa: 0,
          cpJPerKgK: 4184,
          temperatureRange: [273.15, 373.15],
          dynamicViscosityPaS: 1e-3,
          surfaceTensionNPerM: 0.072
        }
      ]
    }
  };
  const thermalMaterialTable = buildSphThermalMaterialTable(materialProperties);
  const mechanicsMaterialTable = buildMlsMpmMechanicsMaterialTable(materialProperties, {
    viscosityEnabled: true,
    viscosityLengthM: buffers.sphParticleState.smoothingLengthM,
    surfaceTensionEnabled: true
  });
  const execution = await runMlsMpmResidentStepsWithOptionalWebGpu({
    ...buffers,
    sphParticleUpload: {
      status: 'webgpu-uploaded',
      stateBuffer: tracker.buffer('source-state'),
      thermoBuffer: tracker.buffer('source-thermo'),
      slot: 0
    },
    mlsMpmParticleUpload: {
      status: 'webgpu-uploaded',
      mechanicsBuffer: tracker.buffer('source-mechanics'),
      slot: 0
    },
    stepCount: 2,
    preferWebGpu: true,
    device,
    boxDimsM: [3, 3, 3],
    gravityMPerS2: [0, 0, 0],
    readbackMode: 'no-full-readback',
    compactSummaryMode: 'none',
    fuseNoFullResidentMechanicsSequence: true,
    thermalMaterialTable,
    mechanicsMaterialTable
  });

  assert.equal(execution.fusedResidentSequencePreflight.status, 'fused-resident-sequence-preflight-ready');
  assert.equal(execution.fusedResidentSequencePreflight.sequenceRunnable, true);
  assert.deepEqual(execution.fusedResidentSequencePreflight.blockers, []);
  assert.deepEqual(execution.fusedResidentSequencePreflight.sidecarBlockers, ['thermal-sidecar']);
  assert.equal(execution.fusedResidentSequencePreflight.sidecarFusionRequired, true);
  assert.equal(execution.fusedResidentSequencePreflight.sidecarFusionRunnable, true);
  assert.equal(execution.fusedResidentSequencePreflight.sequenceRunnableWithSidecars, true);
  assert.equal(execution.fusedResidentSequencePreflight.sidecarFusionPromotesFusedSequence, true);
  assert.equal(execution.fusedResidentSequencePreflight.sidecarAwareSequenceCandidate, false);
  assert.equal(execution.fusedResidentSequencePreflight.sidecarFusionPlan.status, 'sidecar-fusion-plan-runnable');
  assert.deepEqual(
    execution.fusedResidentSequencePreflight.sidecarFusionPlan.stages.map((stage) => stage.id),
    ['thermal-phase', 'mechanics-refresh']
  );
  assert.deepEqual(
    execution.fusedResidentSequencePreflight.sidecarFusionPlan.stages.map((stage) => stage.implementedInCurrentFusedSequence),
    [true, true]
  );

  assert.equal(execution.fusedResidentSequence.status, 'fused-resident-sequence-executed');
  assert.equal(execution.fusedResidentSequence.commandSubmissionCount, 1);
  assert.equal(execution.fusedResidentSequence.sidecarFusionPromotesFusedSequence, true);
  assert.equal(execution.fusedResidentSequence.thermalSidecarFused, true);
  assert.equal(execution.fusedResidentSequence.sidecarFusionDispatchCount, 4);
  assert.deepEqual(execution.fusedResidentSequence.sidecarFusionStageOrder, ['thermal-phase', 'mechanics-refresh']);
  assert.equal(execution.finalStep.sidecarFusionStepEvidence.status, 'sidecar-fusion-step-evidence-ready');
  assert.equal(execution.finalStep.sidecarFusionStepEvidence.executedStageCount, 2);
  assert.equal(execution.finalStep.sidecarFusionStepEvidence.passedStageCount, 2);
  assert.equal(execution.finalStep.sidecarFusionStepEvidence.promotesFusedSequence, true);
  assert.equal(execution.finalStep.sidecarFusionStepEvidence.fallbackEvidence, false);
  assert.equal(execution.finalStep.stageTiming.thermalRequested, true);
  assert.equal(execution.finalStep.stageTiming.mechanicsRefreshRequested, true);
  assert.equal(execution.finalStep.stageTiming.sidecarFusionSequence, true);
  assert.equal(execution.finalStep.stageTiming.sidecarFusionPromotesFusedSequence, true);
  assert.equal(execution.finalStep.g2pStateBufferReplacedByThermalStep, true);
  assert.equal(execution.finalStep.g2pMechanicsBufferReplacedByMechanicsRefresh, true);
  assert.equal(execution.nextParticleBufferMode, 'retained-thermal-output-and-refreshed-mechanics-buffers');
  assert.equal(execution.sidecarAwareResidentSequenceActive, false);
  assert.equal(execution.sidecarAwareDirectRunnerContractStatus, 'thermal-sidecar-direct-runner-not-candidate');
  assert.equal(device.submissions.length, 1);
  assert.equal(device.dispatches.length, 22);
  const dispatchEntryPoints = device.dispatches.map(
    (dispatch) => dispatch.pipeline?.compute?.entryPoint ?? null
  );
  const thermalProducerApplyGroup = [
    'derive',
    'budget',
    'resolve_budget',
    'propose',
    'main'
  ];
  const thermalGroupOffsets = dispatchEntryPoints.flatMap(
    (entryPoint, index) => entryPoint === 'derive' ? [index] : []
  );
  assert.equal(thermalGroupOffsets.length, 2);
  for (const offset of thermalGroupOffsets) {
    assert.deepEqual(
      dispatchEntryPoints.slice(
        offset,
        offset + thermalProducerApplyGroup.length
      ),
      thermalProducerApplyGroup
    );
  }
  destroyMlsMpmResidentStepsBuffers(execution);
});

test('MLS-MPM resident steps compactSummaryMode plan-only preserves active-grid hints without readback', async () => {
  const buffers = manualBuffers({
    position: [1.25, 1.25, 1.25],
    velocity: [0, 0, 0],
    smoothingLengthM: 0.25
  });
  const tracker = fakeBufferTracker();
  const device = fakeSummaryDevice(new Float32Array(MLS_MPM_GPU_RESIDENT_SUMMARY_FLOATS));
  const thermalInputs = [];
  const execution = await runMlsMpmResidentStepsWithOptionalWebGpu({
    ...buffers,
    sphParticleUpload: {
      status: 'webgpu-uploaded',
      stateBuffer: tracker.buffer('source-state'),
      thermoBuffer: tracker.buffer('source-thermo'),
      slot: 0
    },
    mlsMpmParticleUpload: {
      status: 'webgpu-uploaded',
      mechanicsBuffer: tracker.buffer('source-mechanics'),
      slot: 0
    },
    stepCount: 2,
    preferWebGpu: true,
    device,
    boxDimsM: [3, 3, 3],
    gravityMPerS2: [0, 0, 0],
    readbackMode: 'no-full-readback',
    compactSummaryMode: 'active-grid-plan-only',
    fuseNoFullResidentMechanicsSequence: true,
    fuseNoFullResidentMechanicsActiveGrid: true,
    activeGridDispatchPlanRefreshMode: 'final-only',
    activeGridSafetyCells: 1,
    thermalMaterialTable: { schema: 'peercompute.ulg.sph-gpu-thermal-material-table.v0' },
    thermalStepRunner(args) {
      thermalInputs.push({
        sourceStateBuffer: args.sourceStateBuffer?.label ?? null,
        readbackMode: args.readbackMode
      });
      const index = thermalInputs.length;
      return {
        schema: ULG_SPH_GPU_THERMAL_STEP_SCHEMA,
        backend: 'webgpu',
        status: 'thermal-step-executed',
        particleCount: buffers.sphParticleState.particleCount,
        state: new Float32Array(),
        thermo: new Float32Array(),
        stateBuffer: tracker.buffer(`plan-only-thermal-state-${index}`),
        thermoBuffer: tracker.buffer(`plan-only-thermal-thermo-${index}`),
        stateBufferByteLength: buffers.sphParticleState.state.byteLength,
        thermoBufferByteLength: buffers.sphParticleState.thermo.byteLength,
        retainedOutputParticleBuffers: true,
        readbackMode: args.readbackMode,
        normalHotLoopReadbackFree: true,
        destroyOutputParticleBuffers() {
          this.stateBuffer.destroy();
          this.thermoBuffer.destroy();
        }
      };
    }
  });

  assert.equal(execution.compactSummaryMode, 'plan-only');
  assert.equal(execution.fusedResidentSequencePreflight.fallbackMode, 'per-step-fused-mechanics-active-grid');
  assert.equal(execution.stepSummaries.length, 2);
  assert.equal(execution.stepSummaries[0].compactSummaryAvailable ?? false, false);
  assert.equal(execution.stepSummaries[1].compactSummaryAvailable ?? false, false);
  assert.equal(execution.stepSummaries[0].stageTiming.compactSummaryRequested ?? false, false);
  assert.equal(execution.stepSummaries[0].stageTiming.activeGridDispatchPlanOnlyRequested ?? false, false);
  assert.equal(
    execution.stepSummaries[0].stageTiming.activeGridDispatchPlanRefreshSkippedReason,
    'active-grid-plan-refresh-deferred-until-final-step'
  );
  assert.equal(execution.finalStep.stageTiming.compactSummaryRequested, false);
  assert.equal(execution.finalStep.stageTiming.activeGridDispatchPlanOnlyRequested, true);
  assert.equal(execution.finalStep.compactGpuSummary.status, 'compact-summary-plan-only-ready');
  assert.equal(execution.finalStep.compactGpuSummary.readbackMode, 'no-compact-summary-readback');
  assert.equal(execution.finalStep.compactGpuSummary.timing.mapAsyncWaitMs, null);
  assert.equal(
    execution.nextSphParticleState.residentActiveGridDispatchPlanHint.status,
    'active-grid-summary-dispatch-plan-hint-ready'
  );
  assert.equal(thermalInputs.length, 2);
  destroyMlsMpmResidentStepsBuffers(execution);
});

test('MLS-MPM resident steps ping-pong unread retained buffers across repeated steps', async () => {
  const buffers = manualBuffers();
  const tracker = fakeBufferTracker();
  const sourceThermoBuffer = tracker.buffer('source-thermo');
  const p2gInputs = [];
  const reactionInputs = [];
  const execution = await runMlsMpmResidentStepsWithOptionalWebGpu({
    ...buffers,
    sphParticleUpload: {
      status: 'webgpu-uploaded',
      stateBuffer: tracker.buffer('source-state'),
      thermoBuffer: sourceThermoBuffer,
      slot: 0
    },
    mlsMpmParticleUpload: {
      status: 'webgpu-uploaded',
      mechanicsBuffer: tracker.buffer('source-mechanics'),
      slot: 0
    },
    stepCount: 2,
    preferWebGpu: true,
    navigatorRef: webGpuNavigator(),
    boxDimsM: [3, 3, 3],
    readbackMode: 'no-full-readback',
    thermalMaterialTable: { schema: 'peercompute.ulg.sph-gpu-thermal-material-table.v0' },
    reactionTable: { schema: 'peercompute.ulg.sph-gpu-reaction-table.v1', reactionCount: 1 },
    p2gRunner(args) {
      p2gInputs.push({
        readbackMode: args.readbackMode,
        stateBufferLabel: args.sphParticleUpload?.stateBuffer?.label ?? null,
        mechanicsBufferLabel: args.mlsMpmParticleUpload?.mechanicsBuffer?.label ?? null,
        cpuStateStale: args.sphParticleState?.cpuStateStale ?? false,
        residentProductMassStatus: args.residentProductMass?.status ?? null,
        residentProductMassProductEventRowCount: args.residentProductMass?.productEventRowCount ?? 0,
        residentProductMassUnplacedProductMassKg: args.residentProductMass?.unplacedProductMassKg ?? null
      });
      const index = p2gInputs.length;
      return {
        schema: ULG_MLS_MPM_GPU_GRID_PROJECTION_SCHEMA,
        backend: 'webgpu',
        status: 'projected',
        particleCount: buffers.sphParticleState.particleCount,
        dt: buffers.mlsMpmParticleState.mechanicsDtS,
        gridSpacingM: buffers.sphParticleState.smoothingLengthM,
        gridDims: [8, 8, 8],
        gridNodeCount: 512,
        gridShift: 1,
        gridNodeStrideFloats: 8,
        gridNodes: new Float32Array(),
        gridBuffer: tracker.buffer(`p2g-grid-unread-${index}`),
        gridBufferByteLength: 512 * 8 * Float32Array.BYTES_PER_ELEMENT,
        readbackMode: 'no-full-readback',
        normalHotLoopReadbackFree: true,
        destroyGridBuffer() {
          this.gridBuffer.destroy();
        }
      };
    },
    gridUpdateRunner(args) {
      const index = p2gInputs.length;
      return {
        schema: ULG_MLS_MPM_GPU_GRID_UPDATE_SCHEMA,
        backend: 'webgpu',
        status: 'updated',
        sourceSchema: args.p2gGridProjection.schema,
        particleCount: buffers.sphParticleState.particleCount,
        dt: buffers.mlsMpmParticleState.mechanicsDtS,
        gridSpacingM: buffers.sphParticleState.smoothingLengthM,
        gridDims: [8, 8, 8],
        gridNodeCount: 512,
        gridShift: 1,
        gridNodeStrideFloats: 8,
        updatedGridNodes: new Float32Array(),
        updatedGridBuffer: tracker.buffer(`updated-grid-unread-${index}`),
        updatedGridBufferByteLength: 512 * 8 * Float32Array.BYTES_PER_ELEMENT,
        readbackMode: 'no-full-readback',
        normalHotLoopReadbackFree: true,
        destroyUpdatedGridBuffer() {
          this.updatedGridBuffer.destroy();
        }
      };
    },
    g2pRunner(args) {
      const index = p2gInputs.length;
      return {
        schema: ULG_MLS_MPM_GPU_G2P_RECONSTRUCTION_SCHEMA,
        backend: 'webgpu',
        status: 'reconstructed',
        particleCount: buffers.sphParticleState.particleCount,
        gridNodeCount: 512,
        gridSpacingM: buffers.sphParticleState.smoothingLengthM,
        gridDims: [8, 8, 8],
        gridShift: 1,
        dt: buffers.mlsMpmParticleState.mechanicsDtS,
        stateStrideFloats: 8,
        thermoStrideFloats: 12,
        mechanicsStrideFloats: 32,
        state: new Float32Array(),
        mechanics: new Float32Array(),
        stateBuffer: tracker.buffer(`g2p-state-unread-${index}`),
        mechanicsBuffer: tracker.buffer(`g2p-mechanics-unread-${index}`),
        stateBufferByteLength: buffers.sphParticleState.state.byteLength,
        mechanicsBufferByteLength: buffers.mlsMpmParticleState.mechanics.byteLength,
        retainedOutputParticleBuffers: true,
        readbackMode: 'no-full-readback',
        normalHotLoopReadbackFree: true,
        destroyOutputParticleBuffers() {
          this.stateBuffer.destroy();
          this.mechanicsBuffer.destroy();
        }
      };
    },
    thermalStepRunner(args) {
      const index = p2gInputs.length;
      return {
        schema: ULG_SPH_GPU_THERMAL_STEP_SCHEMA,
        backend: 'webgpu',
        status: 'thermal-step-executed',
        particleCount: buffers.sphParticleState.particleCount,
        state: new Float32Array(),
        thermo: new Float32Array(),
        stateBuffer: tracker.buffer(`thermal-state-unread-${index}`),
        thermoBuffer: tracker.buffer(`thermal-thermo-unread-${index}`),
        stateBufferByteLength: buffers.sphParticleState.state.byteLength,
        thermoBufferByteLength: buffers.sphParticleState.thermo.byteLength,
        retainedOutputParticleBuffers: true,
        readbackMode: args.readbackMode,
        normalHotLoopReadbackFree: true,
        destroyOutputParticleBuffers() {
          this.stateBuffer.destroy();
          this.thermoBuffer.destroy();
        }
      };
    },
    reactionStepRunner(args) {
      const index = p2gInputs.length;
      reactionInputs.push({
        stateBufferLabel: args.sourceStateBuffer?.label ?? null,
        thermoBufferLabel: args.sourceThermoBuffer?.label ?? null,
        mechanicsBufferLabel: args.sourceMechanicsBuffer?.label ?? null,
        cpuStateStale: args.sphParticleState?.cpuStateStale ?? false
      });
      return {
        schema: ULG_SPH_GPU_REACTION_STEP_SCHEMA,
        backend: 'webgpu',
        status: 'reaction-step-executed',
        particleCount: buffers.sphParticleState.particleCount,
        state: new Float32Array(),
        thermo: new Float32Array(),
        mechanics: new Float32Array(),
        stateBuffer: tracker.buffer(`reaction-state-unread-${index}`),
        thermoBuffer: tracker.buffer(`reaction-thermo-unread-${index}`),
        mechanicsBuffer: tracker.buffer(`reaction-mechanics-unread-${index}`),
        stateBufferByteLength: buffers.sphParticleState.state.byteLength,
        thermoBufferByteLength: buffers.sphParticleState.thermo.byteLength,
        mechanicsBufferByteLength: buffers.mlsMpmParticleState.mechanics.byteLength,
        retainedOutputParticleBuffers: true,
        readbackMode: 'no-full-readback',
        normalHotLoopReadbackFree: true,
        reactionSummary: {
          schema: ULG_SPH_GPU_REACTION_SUMMARY_SCHEMA,
          backend: 'webgpu',
          status: 'reaction-compact-summary-ready',
          reactionSummaryAvailable: true,
          canonicalReactionEventCount: index,
          consumedReactantMassKg: 6 * index,
          ledgerVisibleProductMassKg: 5 * index,
          ledgerUnplacedProductMassKg: index,
          ledgerGasProductMassKg: index,
          ledgerVisibleGasProductMassKg: 0,
          ledgerUnplacedGasProductMassKg: index,
          sealedBoxGasProductMoles: 250 * index,
          reactionHeatJ: 6000 * index,
	          ledgerMassResidualKg: 0.4 * index,
	          compactLedgerAvailable: true,
	          productInventoryCount: 2,
	          productInventoryReadbackByteLength: 128,
	          productEventRowCount: 32 * index,
	          productEventActiveEventCount: index,
	          productEventReadbackByteLength: 0,
	          productEventBufferByteLength: 2048 * index,
	          productEventBufferRetained: true,
	          productInventory: {
            schema: 'peercompute.ulg.sph-gpu-reaction-product-inventory.v0',
            status: 'product-inventory-compact-ledger-ready',
            recordCount: 2,
            materialCount: 2,
            records: [
              { material: 'ab', materialId: 300, massKg: 5 * index, visibleMassKg: 5 * index, unplacedMassKg: 0, moles: 83.333 * index, productTermIndex: 0 },
              { material: 'c2', materialId: 400, massKg: index, visibleMassKg: 0, unplacedMassKg: index, moles: 250 * index, productTermIndex: 1 }
            ],
            byMaterial: {
              ab: { material: 'ab', materialId: 300, massKg: 5 * index, visibleMassKg: 5 * index, unplacedMassKg: 0, moles: 83.333 * index, productTermIndices: [0] },
              c2: { material: 'c2', materialId: 400, massKg: index, visibleMassKg: 0, unplacedMassKg: index, moles: 250 * index, productTermIndices: [1] }
            },
            fullParticleReadbackPerformed: false
          },
          atomResidualCount: 2,
          atomResidualReadbackByteLength: 64,
          atomResidualSummary: {
            schema: ULG_SPH_GPU_REACTION_ATOM_RESIDUAL_SCHEMA,
            status: 'atom-residual-compact-ledger-ready',
            recordCount: 2,
            maxAbsAtomResidualMol: 0,
            chargeResidualMol: 0,
            atomResidualMolByZ: { 1: 0 },
            records: [
              { reactionIndex: 0, termKind: 'reactant', termIndex: 0, atomicNumberZ: 1, atomResidualMol: -2 * index, chargeResidualMol: 0, eventCount: index },
              { reactionIndex: 0, termKind: 'product', termIndex: 0, atomicNumberZ: 1, atomResidualMol: 2 * index, chargeResidualMol: 0, eventCount: index }
            ],
            fullParticleReadbackPerformed: false
          },
          strictReactionGate: {
            schema: 'peercompute.ulg.sph-reaction-strict-gate.v0',
            status: 'strict-reaction-gate-pass',
            blockers: [],
            warnings: [],
            strictForceCouplingAllowed: true
          },
          readbackMode: 'compact-reaction-summary-readback',
          compactReadbackByteLength: MLS_MPM_GPU_RESIDENT_SUMMARY_BYTES,
          visibleOnly: true,
          unplacedProductInventoryIncluded: true
        },
        destroyOutputParticleBuffers() {
          this.stateBuffer.destroy();
          this.thermoBuffer.destroy();
          this.mechanicsBuffer.destroy();
        }
      };
    }
  });

  assert.equal(execution.readbackMode, 'no-full-readback');
  assert.equal(execution.normalHotLoopReadbackFree, true);
  assert.equal(execution.renderStateReadbackAvailable, false);
  assert.equal(execution.gpuAuthoritativeState, false);
  assert.equal(execution.residentAuthorityLedgerStatus, 'resident-authority-ledger-ready');
  assert.equal(execution.residentAuthorityFamilyOwners[RESIDENT_STATE_FAMILIES.PARTICLE_KINEMATICS].ownerStage, 'reaction-step');
  assert.equal(execution.residentAuthorityFamilyOwners[RESIDENT_STATE_FAMILIES.MECHANICS].ownerStage, 'reaction-step');
  assert.equal(execution.finalStep.particlePingPong.sourceSlot, 1);
  assert.equal(execution.finalStep.particlePingPong.nextSlot, 0);
  assert.equal(execution.nextSphParticleState.step, 2);
  assert.equal(execution.nextSphParticleState.time, 0.2);
  assert.equal(execution.nextSphParticleState.status, 'gpu-resident-unread-ready');
  assert.equal(execution.nextSphParticleState.cpuStateStale, true);
  assert.equal(execution.nextSphParticleState.state, buffers.sphParticleState.state);
  assert.equal(execution.nextMlsMpmParticleState.step, 2);
  assert.equal(execution.nextMlsMpmParticleState.status, 'gpu-resident-unread-ready');
  assert.equal(execution.nextMlsMpmParticleState.cpuStateStale, true);
  assert.equal(execution.nextMlsMpmParticleState.mechanics, buffers.mlsMpmParticleState.mechanics);
  assert.equal(execution.nextParticleBufferMode, 'retained-reaction-output-buffers');
  assert.equal(execution.nextParticleUploads.sphParticleUpload.stateBuffer.label, 'reaction-state-unread-2');
  assert.equal(execution.nextParticleUploads.mlsMpmParticleUpload.mechanicsBuffer.label, 'reaction-mechanics-unread-2');
  assert.equal(execution.stepSummaries[0].readbackMode, 'no-full-readback');
  assert.equal(execution.stepSummaries[1].readbackMode, 'no-full-readback');
  assert.equal(execution.stepSummaries[0].residentAuthorityLedgerStatus, 'resident-authority-ledger-ready');
  assert.equal(execution.stepSummaries[1].residentAuthorityFamilyOwners[RESIDENT_STATE_FAMILIES.PARTICLE_KINEMATICS].ownerStage, 'reaction-step');
  assert.equal(execution.stepSummaries[1].residentAuthorityFamilyOwners[RESIDENT_STATE_FAMILIES.REACTION_PRODUCTS].ownerStage, 'resident-product-mass-handle');
  assert.equal(execution.stepSummaries[0].normalHotLoopReadbackFree, true);
  assert.equal(execution.stepSummaries[1].normalHotLoopReadbackFree, true);
  assert.equal(execution.stepSummaries[0].diagnostics.reactionSummaryStatus, 'reaction-compact-summary-ready');
  assert.equal(execution.stepSummaries[1].diagnostics.reactionSummaryStatus, 'reaction-compact-summary-ready');
  assert.equal(execution.stepSummaries[1].diagnostics.reactionCanonicalEventCount, 2);
  assert.equal(execution.stepSummaries[1].diagnostics.reactionLedgerUnplacedGasProductMassKg, 2);
	  assert.equal(execution.stepSummaries[1].diagnostics.reactionSealedBoxGasProductMoles, 500);
	  assert.equal(execution.stepSummaries[1].diagnostics.reactionProductInventoryCount, 2);
	  assert.equal(execution.stepSummaries[1].diagnostics.reactionProductInventoryReadbackByteLength, 128);
	  assert.equal(execution.stepSummaries[1].diagnostics.reactionProductEventRowCount, 64);
	  assert.equal(execution.stepSummaries[1].diagnostics.reactionProductEventActiveEventCount, 2);
	  assert.equal(execution.stepSummaries[1].diagnostics.reactionProductEventReadbackByteLength, 0);
	  assert.equal(execution.stepSummaries[1].diagnostics.reactionProductEventBufferByteLength, 4096);
	  assert.equal(execution.stepSummaries[1].diagnostics.reactionProductEventBufferRetained, true);
	  assert.equal(execution.stepSummaries[1].residentProductMassStatus, 'resident-product-mass-summary-only');
	  assert.equal(execution.stepSummaries[1].residentProductMassProductEventRowCount, 64);
	  assert.equal(execution.stepSummaries[1].residentProductMassUnplacedProductMassKg, 2);
	  assert.equal(execution.stepSummaries[1].residentProductMassEosCouplingStatus, 'resident-product-mass-summary-only-no-eos-buffer');
	  assert.equal(execution.stepSummaries[1].diagnostics.reactionResidentProductMassStatus, 'resident-product-mass-summary-only');
	  assert.equal(execution.stepSummaries[1].diagnostics.reactionResidentProductMassProductEventRowCount, 64);
	  assert.equal(execution.stepSummaries[1].diagnostics.reactionResidentProductMassUnplacedProductMassKg, 2);
	  assert.equal(execution.stepSummaries[1].diagnostics.reactionResidentProductMassEosCouplingStatus, 'resident-product-mass-summary-only-no-eos-buffer');
	  assert.equal(execution.stepSummaries[1].diagnostics.reactionAtomResidualCount, 2);
  assert.equal(execution.stepSummaries[1].diagnostics.reactionAtomResidualReadbackByteLength, 64);
  assert.equal(execution.stepSummaries[1].diagnostics.reactionStrictGateStatus, 'strict-reaction-gate-pass');
  assert.equal(p2gInputs[0].stateBufferLabel, 'source-state');
  assert.equal(p2gInputs[0].residentProductMassStatus, null);
  assert.equal(p2gInputs[1].stateBufferLabel, 'reaction-state-unread-1');
  assert.equal(p2gInputs[1].mechanicsBufferLabel, 'reaction-mechanics-unread-1');
  assert.equal(p2gInputs[1].cpuStateStale, true);
  assert.equal(p2gInputs[1].residentProductMassStatus, 'resident-product-mass-summary-only');
  assert.equal(p2gInputs[1].residentProductMassProductEventRowCount, 32);
  assert.equal(p2gInputs[1].residentProductMassUnplacedProductMassKg, 1);
  assert.equal(reactionInputs[0].stateBufferLabel, 'thermal-state-unread-1');
  assert.equal(reactionInputs[1].cpuStateStale, true);
  assert.equal(execution.finalStep.state.length, 0);
  assert.equal(execution.finalStep.diagnostics.massDeltaKg, null);
  assert.equal(execution.finalStep.nextParticleUploads.sphParticleUpload.thermoBuffer.label, 'reaction-thermo-unread-2');
  assert.equal(tracker.destroyed, 9);
  destroyMlsMpmResidentStepsBuffers(execution);
  assert.equal(tracker.destroyed, 18);
});
