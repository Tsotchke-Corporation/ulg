import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  SCHROEDER_ACTIVE_NODE_ROW_LAYOUT,
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
  ULG_SCHROEDER_LEVEL_ASSIGNMENT_EXECUTION_SCHEMA,
  ULG_SCHROEDER_LEVEL_ASSIGNMENT_SCHEMA,
  ULG_SCHROEDER_PHASE_VOLUME_MIGRATION_EXECUTION_SCHEMA,
  ULG_SCHROEDER_PHASE_VOLUME_DIAGNOSTIC_SUMMARY_EXECUTION_SCHEMA,
  ULG_SCHROEDER_PHASE_VOLUME_DIAGNOSTIC_SUMMARY_SCHEMA,
  ULG_SCHROEDER_PHASE_VOLUME_LEVEL_UPDATE_EXECUTION_SCHEMA,
  ULG_SCHROEDER_PHASE_VOLUME_LEVEL_UPDATE_SCHEMA,
  ULG_SCHROEDER_PHASE_VOLUME_MIGRATION_ADMISSION_SCHEMA,
  ULG_SCHROEDER_PHASE_VOLUME_MIGRATION_SCHEMA,
  ULG_SCHROEDER_SAME_LEVEL_MECHANICS_EXECUTION_SCHEMA,
  ULG_SCHROEDER_SAME_LEVEL_MECHANICS_SCHEMA,
  ULG_SCHROEDER_STATE_DELTA_MERGE_ADMISSION_SCHEMA,
  ULG_SPH_GPU_PARTICLE_BUFFER_SCHEMA
} from '../ulg-gpu-abi/src/index.js';
import {
  SCHROEDER_ACTIVE_NODE_FLOATS,
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
  SCHROEDER_COMPACT_LAW_NEIGHBOR_DIAGNOSTIC_READBACK_MODE,
  SCHROEDER_COMPACT_PHASE_VOLUME_DIAGNOSTIC_READBACK_MODE,
  SCHROEDER_LAW_NEIGHBOR_TRAVERSAL_POLICY_AUTO_MODE,
  SCHROEDER_LAW_NEIGHBOR_TRAVERSAL_POLICY_BUCKET_MODE,
  SCHROEDER_LAW_NEIGHBOR_TRAVERSAL_POLICY_EXACT_SCAN_MODE,
  SCHROEDER_LAW_NEIGHBOR_TRAVERSAL_POLICY_SORTED_RADIX_MODE,
  SCHROEDER_LAW_NEIGHBOR_DIAGNOSTIC_COUNTER_COUNT,
  SCHROEDER_NO_FULL_READBACK_MODE,
  SCHROEDER_LOCAL_LAW_QUEUE_MASK,
  SCHROEDER_BUCKETED_HIERARCHY_AGGREGATE_NODE_REDUCTION_MODE,
  DEFAULT_AGGREGATE_NODE_BUCKET_REDUCTION_MIN_ROWS,
  DEFAULT_AGGREGATE_NODE_BUCKET_SLOT_CAPACITY,
  DEFAULT_ACTIVE_NODE_INDEX_BUCKET_SLOT_CAPACITY,
  DEFAULT_SCHROEDER_LAW_NEIGHBOR_BUCKET_PRESSURE_RATIO_THRESHOLD,
  DEFAULT_SCHROEDER_LAW_NEIGHBOR_FALLBACK_SCAN_RATIO_THRESHOLD,
  DEFAULT_SCHROEDER_LAW_QUEUE_CANDIDATE_BUDGET,
  SCHROEDER_PHASE_VOLUME_DIAGNOSTIC_SUMMARY_FLOATS,
  SCHROEDER_PHASE_VOLUME_LEVEL_UPDATE_FLOATS,
  SCHROEDER_PHASE_VOLUME_MIGRATION_FLOATS,
  createSchroederActiveNodeIndexParamsArray,
  createSchroederActiveNodeIndexPlan,
  createSchroederActiveNodeListPlan,
  createSchroederActiveNodeParamsArray,
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
  createSchroederPhaseVolumeDiagnosticSummaryParamsArray,
  createSchroederPhaseVolumeDiagnosticSummaryPlan,
  createSchroederPhaseVolumeLevelUpdateParamsArray,
  createSchroederPhaseVolumeLevelUpdatePlan,
  createSchroederPhaseVolumeMigrationParamsArray,
  createSchroederPhaseVolumeMigrationPlan,
  createSchroederSameLevelMechanicsPlan,
  decodeSchroederLawNeighborTraversalDiagnostics,
  estimateSchroederLevelDeltaForVolumeRatio,
  estimateSchroederLevelFromSupportRadius,
  runSchroederActiveNodeIndexWebGpu,
  runSchroederActiveNodeListWebGpu,
  runSchroederConservationSummaryWebGpu,
  runSchroederCrossLevelCouplingWebGpu,
  runSchroederCrossLevelStateDeltaMergeWebGpu,
  runSchroederCrossLevelStateDeltaWebGpu,
  runSchroederCrossLevelTransferWebGpu,
  runSchroederHierarchyAggregateNodeReductionWebGpu,
  runSchroederHierarchyAggregateWebGpu,
  runSchroederLawNeighborCandidateWebGpu,
  runSchroederLawQueueWebGpu,
  runSchroederLevelAssignmentWebGpu,
  runSchroederPhaseVolumeDiagnosticSummaryWebGpu,
  runSchroederPhaseVolumeLevelUpdateWebGpu,
  runSchroederPhaseVolumeMigrationWebGpu,
  runSchroederSameLevelMechanicsWebGpu,
  schroederGridSpacingForLevel,
  schroederPhaseVolumeMigrationAdmissionAllowsApplication,
  schroederStateDeltaMergeAdmissionAllowsApplication
} from '../src/runtime/sph/schroederHierarchyGpu.js';
import { MLS_MPM_GPU_PARTICLE_MECHANICS_ROW_LAYOUT } from '../src/runtime/sph/sphGpuBuffers.js';

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
  return {
    createdBuffers,
    writes,
    shaderModules,
    dispatches,
    submitted,
    bindGroups,
    createBuffer({ label, size, usage }) {
      const buffer = {
        label,
        size,
        usage,
        destroyed: false,
        destroy() {
          this.destroyed = true;
        },
        async mapAsync() {
          return undefined;
        },
        getMappedRange() {
          return new ArrayBuffer(size);
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
      return {
        beginComputePass() {
          return {
            setPipeline() {},
            setBindGroup() {},
            dispatchWorkgroups(x, y = 1, z = 1) {
              dispatches.push([x, y, z]);
            },
            end() {}
          };
        },
        copyBufferToBuffer() {
          if (!allowReadbackCopies) {
            throw new Error('Schroeder no-full-readback test should not copy to a readback buffer');
          }
        },
        finish() {
          return { label: 'fake-schroeder-command-buffer' };
        }
      };
    },
    queue: {
      writeBuffer(buffer, offset, data) {
        writes.push({ label: buffer.label, offset, byteLength: data?.byteLength ?? 0 });
      },
      submit(commands) {
        submitted.push(commands);
      },
      async onSubmittedWorkDone() {
        return undefined;
      }
    }
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
  assert.equal(SCHROEDER_PHASE_VOLUME_MIGRATION_FLOATS % 4, 0);
  assert.equal(
    ULG_SCHROEDER_PHASE_VOLUME_MIGRATION_ADMISSION_SCHEMA,
    'peercompute.ulg.schroeder-phase-volume-migration-admission.v0'
  );
  assert.equal(
    ULG_SCHROEDER_PHASE_VOLUME_LEVEL_UPDATE_SCHEMA,
    'peercompute.ulg.schroeder-phase-volume-level-update.v0'
  );
  assert.equal(
    ULG_SCHROEDER_PHASE_VOLUME_LEVEL_UPDATE_EXECUTION_SCHEMA,
    'peercompute.ulg.schroeder-phase-volume-level-update-execution.v0'
  );
  assert.equal(SCHROEDER_PHASE_VOLUME_LEVEL_UPDATE_FLOATS, 32);
  assert.equal(
    SCHROEDER_PHASE_VOLUME_LEVEL_UPDATE_ROW_LAYOUT.length,
    SCHROEDER_PHASE_VOLUME_LEVEL_UPDATE_FLOATS
  );
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
  assert.equal(SCHROEDER_PHASE_VOLUME_DIAGNOSTIC_SUMMARY_FLOATS % 4, 0);
  assert.equal(ULG_SCHROEDER_CONSERVATION_SUMMARY_SCHEMA, 'peercompute.ulg.schroeder-conservation-summary.v0');
  assert.equal(
    ULG_SCHROEDER_CONSERVATION_SUMMARY_EXECUTION_SCHEMA,
    'peercompute.ulg.schroeder-conservation-summary-execution.v0'
  );
  assert.equal(SCHROEDER_CONSERVATION_SUMMARY_FLOATS, 16);
  assert.equal(SCHROEDER_CONSERVATION_SUMMARY_ROW_LAYOUT.length, SCHROEDER_CONSERVATION_SUMMARY_FLOATS);
  assert.equal(SCHROEDER_CONSERVATION_SUMMARY_FLOATS % 4, 0);
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

test('Schroeder active-node plan uses retained level assignments as unsorted tile ranges', () => {
  const levelAssignment = {
    schema: ULG_SCHROEDER_LEVEL_ASSIGNMENT_EXECUTION_SCHEMA,
    status: 'schroeder-level-assignment-submitted',
    particleCount: 5,
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

  const params = createSchroederActiveNodeParamsArray(plan);
  const view = new DataView(params);
  assert.equal(view.getUint32(0, true), 5);
  assert.equal(view.getUint32(4, true), 4);
  assert.equal(view.getFloat32(16, true), 2);
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
  assert.equal(params.byteLength, 64);
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
  assert.equal(policy.sortedRadixIndexRequired, false);
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
  assert.equal(policy.sortedRadixIndexRequired, true);
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
  assert.equal(policy.sortedRadixIndexRequired, false);
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
  assert.equal(result.normalHotLoopReadbackFree, true);
  assert.equal(result.retainedAssignmentBuffer, true);
  assert.ok(result.assignmentBuffer);
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
});

test('Schroeder WebGPU active-node list consumes retained assignments without default readback', async () => {
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

  assert.equal(activeNodes.schema, ULG_SCHROEDER_ACTIVE_NODE_LIST_EXECUTION_SCHEMA);
  assert.equal(activeNodes.activeNodeListSchema, ULG_SCHROEDER_ACTIVE_NODE_LIST_SCHEMA);
  assert.equal(activeNodes.status, 'schroeder-active-node-list-submitted');
  assert.equal(activeNodes.sourceAssignmentSchema, ULG_SCHROEDER_LEVEL_ASSIGNMENT_EXECUTION_SCHEMA);
  assert.equal(activeNodes.readbackMode, SCHROEDER_NO_FULL_READBACK_MODE);
  assert.equal(activeNodes.fullReadbackPerformed, false);
  assert.equal(activeNodes.fullParticleReadbackPerformed, false);
  assert.equal(activeNodes.normalHotLoopReadbackFree, true);
  assert.equal(activeNodes.retainedActiveNodeBuffer, true);
  assert.ok(activeNodes.activeNodeBuffer);
  assert.equal(activeNodes.activeNodeBuffer.destroyed, false);
  assert.equal(activeNodes.activeNodeBufferByteLength, 3 * 16 * Float32Array.BYTES_PER_ELEMENT);
  assert.equal(activeNodes.activeNodes.length, 0);
  assert.deepEqual(device.dispatches, [[1, 1, 1], [1, 1, 1]]);
  assert.ok(device.shaderModules.some((module) => module.code.includes('SchroederActiveNodeParams')));
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
  assert.equal(index.normalHotLoopReadbackFree, true);
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
  assert.equal(lawQueue.normalHotLoopReadbackFree, true);
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
  assert.equal(candidates.normalHotLoopReadbackFree, true);
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
  assert.equal(device.bindGroups.at(-1).entries.length, 8);
  assert.equal(device.bindGroups.at(-1).entries[1].resource.buffer, activeNodeBuffer);
  assert.equal(device.bindGroups.at(-1).entries[4].resource.buffer, candidates.sourceCandidateSpanBuffer);
  assert.equal(device.bindGroups.at(-1).entries[6].resource.buffer.label, 'ulg-schroeder-law-neighbor-active-node-index-slots-dummy');
  assert.equal(device.bindGroups.at(-1).entries[7].resource.buffer, candidates.diagnosticCounterBuffer);
  assert.ok(device.writes.some((write) => (
    write.label === 'ulg-schroeder-law-neighbor-candidates-params'
    && write.byteLength === 64
  )));
  assert.ok(device.writes.some((write) => (
    write.label === 'ulg-schroeder-law-neighbor-diagnostic-counters'
    && write.byteLength === SCHROEDER_LAW_NEIGHBOR_DIAGNOSTIC_COUNTER_COUNT * Uint32Array.BYTES_PER_ELEMENT
  )));
  assert.ok(device.createdBuffers.some((buffer) => (
    buffer.label === 'ulg-schroeder-law-neighbor-candidates-params'
    && buffer.size === 64
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
  assert.equal(device.bindGroups.at(-1).entries.length, 8);
  assert.equal(device.bindGroups.at(-1).entries[6].resource.buffer, activeNodeIndexBucketSlotBuffer);
  assert.equal(device.bindGroups.at(-1).entries[7].resource.buffer, candidates.diagnosticCounterBuffer);
  assert.equal(activeNodeIndexBucketSlotBuffer.destroyed, false);
  assert.ok(device.writes.some((write) => (
    write.label === 'ulg-schroeder-law-neighbor-candidates-params'
    && write.byteLength === 64
  )));
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
  assert.equal(crossLevel.normalHotLoopReadbackFree, true);
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
  assert.equal(summary.normalHotLoopReadbackFree, true);
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
  assert.equal(transfer.normalHotLoopReadbackFree, true);
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
  assert.equal(stateDelta.normalHotLoopReadbackFree, true);
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
  assert.equal(aggregateNode.normalHotLoopReadbackFree, true);
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
  assert.equal(aggregateNode.normalHotLoopReadbackFree, true);
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

test('Schroeder phase-volume migration consumes retained aggregate nodes without default readback', async () => {
  const device = createFakeWebGpuDevice();
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
  assert.equal(migration.normalHotLoopReadbackFree, true);
  assert.equal(migration.retainedMigrationBuffer, true);
  assert.ok(migration.migrationBuffer);
  assert.equal(migration.migrationBuffer.destroyed, false);
  assert.equal(migration.migrationBufferByteLength, 130 * 32 * Float32Array.BYTES_PER_ELEMENT);
  assert.equal(migration.migrationRows.length, 0);
  assert.equal(migration.phaseVolumeStatus, 'phase-volume-migration-submitted');
  assert.equal(migration.migrationMode, 'physical-volume-level-target-with-aggregate-coherence');
  assert.equal(migration.aggregateCoherenceRequirement, 'retained-aggregate-node-buffer-consumed');
  assert.equal(migration.conservativeTransferStatus, 'phase-volume-migration-submitted');
  assert.equal(migration.stateMutationStatus, 'phase-volume-migration-buffer-submitted');
  assert.equal(migration.stateAuthorityStatus, 'requires-state-manager-admission-for-authoritative-level-migration');
  assert.deepEqual(device.dispatches, [[3, 1, 1]]);
  assert.ok(device.shaderModules.some((module) => module.code.includes('SchroederPhaseVolumeMigrationParams')));
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
  assert.equal(update.retainedLevelUpdateBuffer, false);
  assert.equal(update.levelUpdateBufferByteLength, 0);
  assert.equal(update.levelUpdateRows.length, 0);
  assert.equal(update.conservativeTransferStatus, 'phase-volume-level-update-blocked-admission-required');
  assert.equal(update.stateMutationStatus, 'blocked-phase-volume-level-update-admission-required');
  assert.deepEqual(device.dispatches, []);
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
  assert.equal(update.normalHotLoopReadbackFree, true);
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
  assert.equal(summary.retainedSummaryBuffer, true);
  assert.ok(summary.summaryBuffer);
  assert.equal(summary.summaryBuffer.destroyed, false);
  assert.equal(summary.summaryBufferByteLength, 32 * Float32Array.BYTES_PER_ELEMENT);
  assert.equal(summary.summaryRows.length, 32);
  assert.equal(summary.diagnosticStatus, 'phase-volume-diagnostics-submitted');
  assert.equal(summary.visibleStressCaseStatus, 'water-to-steam-level-migration-diagnostics-submitted');
  assert.equal(summary.conservativeTransferStatus, 'diagnostic-summary-only-no-conservative-transfer');
  assert.equal(summary.stateMutationStatus, 'diagnostic-summary-only-no-state-mutation');
  assert.deepEqual(device.dispatches, [[1, 1, 1]]);
  assert.ok(device.shaderModules.some((module) => module.code.includes('SchroederPhaseVolumeDiagnosticSummaryParams')));
});

test('Schroeder same-level mechanics runs SS prepasses before dense resident backend', async () => {
  const device = createFakeWebGpuDevice();
  const buffers = manualBuffers({ particleCount: 3, smoothingLengthM: 0.25 });
  const calls = [];
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
      hasPhaseVolumeLevelUpdate: Boolean(options.schroederPhaseVolumeLevelUpdate),
      hasPhaseVolumeDiagnosticSummary: Boolean(options.schroederPhaseVolumeDiagnosticSummary),
      fuseNoFullResidentMechanics: options.fuseNoFullResidentMechanics
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
    residentStepRunner
  });

  assert.equal(result.schema, ULG_SCHROEDER_SAME_LEVEL_MECHANICS_EXECUTION_SCHEMA);
  assert.equal(result.sameLevelMechanicsSchema, ULG_SCHROEDER_SAME_LEVEL_MECHANICS_SCHEMA);
  assert.equal(result.status, 'schroeder-same-level-mechanics-submitted');
  assert.equal(result.selectedLevel, 2);
  assert.equal(result.mechanicsGridSpacingM, 1);
  assert.equal(result.normalHotLoopReadbackFree, true);
  assert.equal(result.levelAssignment.retainedAssignmentBuffer, true);
  assert.equal(result.activeNodeList.retainedActiveNodeBuffer, true);
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
  assert.equal(result.residentStep.hasPhaseVolumeLevelUpdate, false);
  assert.equal(result.residentStep.hasPhaseVolumeDiagnosticSummary, false);
  assert.equal(result.activeNodeConsumerStatus, 'active-node-list-forwarded-to-mls-mpm-p2g-g2p');
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
  assert.equal(result.activeNodeConsumerStatus, 'active-node-list-forwarded-to-mls-mpm-p2g-g2p');
  assert.equal(result.lawQueue, null);
  assert.equal(result.lawQueueStatus, 'disabled-local-law-queue');
  assert.equal(result.residentStep.hasActiveNodeList, true);
  assert.equal(result.residentStep.hasLawQueue, false);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].schroederActiveNodeList.schema, ULG_SCHROEDER_ACTIVE_NODE_LIST_EXECUTION_SCHEMA);
  assert.equal(calls[0].schroederLawQueue, null);
  assert.deepEqual(device.dispatches, [[1, 1, 1], [1, 1, 1], [1, 1, 1], [1, 1, 1]]);
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
    lawNeighborTraversalPolicyMode: SCHROEDER_LAW_NEIGHBOR_TRAVERSAL_POLICY_SORTED_RADIX_MODE,
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
        traversalPolicyStatus: 'traversal-policy-forced-sorted-radix-index',
        traversalPolicyMode: options.traversalPolicyMode,
        appliedTraversalIndexMode: SCHROEDER_LAW_NEIGHBOR_TRAVERSAL_POLICY_BUCKET_MODE,
        recommendedTraversalIndexMode: SCHROEDER_LAW_NEIGHBOR_TRAVERSAL_POLICY_SORTED_RADIX_MODE,
        selectedTraversalIndexMode: SCHROEDER_LAW_NEIGHBOR_TRAVERSAL_POLICY_BUCKET_MODE,
        sortedRadixIndexRequired: true,
        sortedRadixIndexStatus: 'sorted-radix-active-node-index-required-pending-implementation',
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
  assert.equal(lawNeighborCalls[0].traversalPolicyMode, SCHROEDER_LAW_NEIGHBOR_TRAVERSAL_POLICY_SORTED_RADIX_MODE);
  assert.equal(lawNeighborCalls[0].traversalPolicyFallbackScanRatioThreshold, 0.125);
  assert.equal(lawNeighborCalls[0].traversalPolicyBucketPressureRatioThreshold, 0.03125);
  assert.equal(result.lawNeighborCandidates.activeNodeIndexEnabled, true);
  assert.equal(
    result.lawNeighborCandidates.activeNodeIndexConsumerStatus,
    'active-node-bucket-index-consumed-with-exact-scan-fallback'
  );
  assert.equal(result.lawNeighborCandidates.treeTraversalStatus, 'active-node-bucket-index-traversal-with-exact-scan-fallback');
  assert.equal(result.lawNeighborCandidates.traversalPolicyStatus, 'traversal-policy-forced-sorted-radix-index');
  assert.equal(
    result.lawNeighborCandidates.recommendedTraversalIndexMode,
    SCHROEDER_LAW_NEIGHBOR_TRAVERSAL_POLICY_SORTED_RADIX_MODE
  );
  assert.equal(result.lawNeighborCandidates.selectedTraversalIndexMode, SCHROEDER_LAW_NEIGHBOR_TRAVERSAL_POLICY_BUCKET_MODE);
  assert.equal(result.lawNeighborCandidates.sortedRadixIndexRequired, true);
  assert.equal(
    result.lawNeighborCandidates.sortedRadixIndexStatus,
    'sorted-radix-active-node-index-required-pending-implementation'
  );
  assert.equal(result.lawNeighborCandidates.diagnosticCountersAvailable, true);
  assert.equal(result.lawNeighborCandidates.retainedDiagnosticCounterBuffer, true);
  assert.equal(result.activeNodeIndexConsumerStatus, 'active-node-bucket-index-consumed-with-exact-scan-fallback');
  assert.equal(result.lawNeighborCandidateConsumerStatus, 'law-neighbor-candidates-forwarded-to-resident-backend');
  assert.equal(result.residentStep.hasLawNeighborCandidates, true);
});

test('Schroeder same-level mechanics can run admitted state-delta merge before resident backend', async () => {
  const device = createFakeWebGpuDevice();
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
    mergeEpoch: 9,
    residentStepRunner: async (options) => {
      calls.push(options);
      return {
        schema: 'peercompute.ulg.mls-mpm-gpu-resident-step-execution.v0',
        status: 'resident-step-stubbed',
        hasCrossLevelStateDeltaMerge: Boolean(options.schroederCrossLevelStateDeltaMerge),
        hasHierarchyAggregate: Boolean(options.schroederHierarchyAggregate),
        hasHierarchyAggregateNode: Boolean(options.schroederHierarchyAggregateNode),
        hasPhaseVolumeMigration: Boolean(options.schroederPhaseVolumeMigration),
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
  assert.equal(result.phaseVolumeMigration.retainedMigrationBuffer, true);
  assert.equal(result.phaseVolumeMigration.particleCount, 3);
  assert.equal(result.phaseVolumeMigration.aggregateNodeCount, 3);
  assert.equal(result.phaseVolumeMigration.phaseVolumeStatus, 'phase-volume-migration-submitted');
  assert.equal(result.phaseVolumeMigration.migrationMode, 'physical-volume-level-target-with-aggregate-coherence');
  assert.equal(result.phaseVolumeMigration.aggregateCoherenceRequirement, 'retained-aggregate-node-buffer-consumed');
  assert.equal(result.phaseVolumeMigration.conservativeTransferStatus, 'phase-volume-migration-submitted');
  assert.equal(result.phaseVolumeMigration.stateMutationStatus, 'phase-volume-migration-buffer-submitted');
  assert.equal(
    result.phaseVolumeMigration.stateAuthorityStatus,
    'requires-state-manager-admission-for-authoritative-level-migration'
  );
  assert.equal(result.phaseVolumeLevelUpdate, null);
  assert.equal(result.phaseVolumeDiagnosticSummary, null);
  assert.equal(result.crossLevelStateDeltaMergeStatus, 'schroeder-cross-level-state-delta-merge-submitted');
  assert.equal(result.hierarchyAggregateStatus, 'schroeder-hierarchy-aggregate-submitted');
  assert.equal(result.hierarchyAggregateNodeStatus, 'schroeder-hierarchy-aggregate-node-reduction-submitted');
  assert.equal(result.phaseVolumeMigrationStatus, 'schroeder-phase-volume-migration-submitted');
  assert.equal(result.phaseVolumeLevelUpdateStatus, 'disabled-phase-volume-level-update-admission-not-provided');
  assert.equal(result.phaseVolumeDiagnosticSummaryStatus, 'disabled-phase-volume-level-update-admission-not-provided');
  assert.equal(result.conservativeTransferStatus, 'phase-volume-migration-submitted');
  assert.equal(result.stateMutationStatus, 'phase-volume-migration-buffer-submitted');
  assert.equal(result.stateAuthorityStatus, 'requires-state-manager-admission-for-authoritative-level-migration');
  assert.equal(result.residentStep.hasCrossLevelStateDeltaMerge, true);
  assert.equal(result.residentStep.hasHierarchyAggregate, true);
  assert.equal(result.residentStep.hasHierarchyAggregateNode, true);
  assert.equal(result.residentStep.hasPhaseVolumeMigration, true);
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
    calls[0].schroederPhaseVolumeMigration.schema,
    ULG_SCHROEDER_PHASE_VOLUME_MIGRATION_EXECUTION_SCHEMA
  );
  assert.equal(calls[0].schroederPhaseVolumeLevelUpdate, null);
  assert.equal(calls[0].schroederPhaseVolumeDiagnosticSummary, null);
  assert.deepEqual(
    device.dispatches,
    [[1, 1, 1], [1, 1, 1], [1, 1, 1], [3, 1, 1], [1, 1, 1], [1, 1, 1], [1, 1, 1], [1, 1, 1], [1, 1, 1], [1, 1, 1], [1, 1, 1], [1, 1, 1]]
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
    mergeEpoch: 12,
    residentStepRunner: async (options) => {
      calls.push(options);
      return {
        schema: 'peercompute.ulg.mls-mpm-gpu-resident-step-execution.v0',
        status: 'resident-step-stubbed',
        hasPhaseVolumeMigration: Boolean(options.schroederPhaseVolumeMigration),
        hasPhaseVolumeLevelUpdate: Boolean(options.schroederPhaseVolumeLevelUpdate),
        hasPhaseVolumeDiagnosticSummary: Boolean(options.schroederPhaseVolumeDiagnosticSummary)
      };
    }
  });

  assert.equal(result.phaseVolumeMigration.retainedMigrationBuffer, true);
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
  assert.equal(result.phaseVolumeMigrationStatus, 'schroeder-phase-volume-migration-submitted');
  assert.equal(result.phaseVolumeLevelUpdateStatus, 'schroeder-phase-volume-level-update-submitted');
  assert.equal(result.phaseVolumeDiagnosticSummaryStatus, 'schroeder-phase-volume-diagnostic-summary-submitted');
  assert.equal(result.conservativeTransferStatus, 'phase-volume-level-update-submitted');
  assert.equal(result.stateMutationStatus, 'phase-volume-level-update-buffer-submitted');
  assert.equal(result.stateAuthorityStatus, 'state-manager-admitted-phase-volume-level-update-materialized');
  assert.equal(result.residentStep.hasPhaseVolumeMigration, true);
  assert.equal(result.residentStep.hasPhaseVolumeLevelUpdate, true);
  assert.equal(result.residentStep.hasPhaseVolumeDiagnosticSummary, true);
  assert.equal(calls.length, 1);
  assert.equal(
    calls[0].schroederPhaseVolumeLevelUpdate.schema,
    ULG_SCHROEDER_PHASE_VOLUME_LEVEL_UPDATE_EXECUTION_SCHEMA
  );
  assert.equal(
    calls[0].schroederPhaseVolumeDiagnosticSummary.schema,
    ULG_SCHROEDER_PHASE_VOLUME_DIAGNOSTIC_SUMMARY_EXECUTION_SCHEMA
  );
  assert.deepEqual(
    device.dispatches,
    [[1, 1, 1], [1, 1, 1], [1, 1, 1], [3, 1, 1], [1, 1, 1], [1, 1, 1], [1, 1, 1], [1, 1, 1], [1, 1, 1], [1, 1, 1], [1, 1, 1], [1, 1, 1], [1, 1, 1], [1, 1, 1]]
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
  assert.deepEqual(device.dispatches, [[1, 1, 1], [1, 1, 1], [1, 1, 1], [3, 1, 1]]);
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
  assert.deepEqual(device.dispatches, [[1, 1, 1], [1, 1, 1]]);
});
