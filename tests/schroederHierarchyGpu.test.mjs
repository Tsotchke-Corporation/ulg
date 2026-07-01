import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  SCHROEDER_ACTIVE_NODE_ROW_LAYOUT,
  SCHROEDER_CONSERVATION_SUMMARY_ROW_LAYOUT,
  SCHROEDER_CROSS_LEVEL_COUPLING_ROW_LAYOUT,
  SCHROEDER_CROSS_LEVEL_TRANSFER_ROW_LAYOUT,
  SCHROEDER_LEVEL_ASSIGNMENT_ROW_LAYOUT,
  ULG_MLS_MPM_GPU_PARTICLE_BUFFER_SCHEMA,
  ULG_SCHROEDER_ACTIVE_NODE_LIST_EXECUTION_SCHEMA,
  ULG_SCHROEDER_ACTIVE_NODE_LIST_SCHEMA,
  ULG_SCHROEDER_CONSERVATION_SUMMARY_EXECUTION_SCHEMA,
  ULG_SCHROEDER_CONSERVATION_SUMMARY_SCHEMA,
  ULG_SCHROEDER_CROSS_LEVEL_COUPLING_EXECUTION_SCHEMA,
  ULG_SCHROEDER_CROSS_LEVEL_COUPLING_SCHEMA,
  ULG_SCHROEDER_CROSS_LEVEL_TRANSFER_EXECUTION_SCHEMA,
  ULG_SCHROEDER_CROSS_LEVEL_TRANSFER_SCHEMA,
  ULG_SCHROEDER_LEVEL_ASSIGNMENT_EXECUTION_SCHEMA,
  ULG_SCHROEDER_LEVEL_ASSIGNMENT_SCHEMA,
  ULG_SCHROEDER_SAME_LEVEL_MECHANICS_EXECUTION_SCHEMA,
  ULG_SCHROEDER_SAME_LEVEL_MECHANICS_SCHEMA,
  ULG_SPH_GPU_PARTICLE_BUFFER_SCHEMA
} from '../ulg-gpu-abi/src/index.js';
import {
  SCHROEDER_ACTIVE_NODE_FLOATS,
  SCHROEDER_CONSERVATION_SUMMARY_FLOATS,
  SCHROEDER_CROSS_LEVEL_COUPLING_FLOATS,
  SCHROEDER_CROSS_LEVEL_TRANSFER_FLOATS,
  SCHROEDER_LEVEL_ASSIGNMENT_FLOATS,
  SCHROEDER_NO_FULL_READBACK_MODE,
  createSchroederActiveNodeListPlan,
  createSchroederActiveNodeParamsArray,
  createSchroederCrossLevelCouplingParamsArray,
  createSchroederCrossLevelCouplingPlan,
  createSchroederConservationSummaryParamsArray,
  createSchroederConservationSummaryPlan,
  createSchroederCrossLevelTransferParamsArray,
  createSchroederCrossLevelTransferPlan,
  createSchroederLevelAssignmentParamsArray,
  createSchroederLevelAssignmentPlan,
  createSchroederSameLevelMechanicsPlan,
  estimateSchroederLevelDeltaForVolumeRatio,
  estimateSchroederLevelFromSupportRadius,
  runSchroederActiveNodeListWebGpu,
  runSchroederConservationSummaryWebGpu,
  runSchroederCrossLevelCouplingWebGpu,
  runSchroederCrossLevelTransferWebGpu,
  runSchroederLevelAssignmentWebGpu,
  runSchroederSameLevelMechanicsWebGpu,
  schroederGridSpacingForLevel
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

function createFakeWebGpuDevice() {
  const createdBuffers = [];
  const writes = [];
  const shaderModules = [];
  const dispatches = [];
  const submitted = [];
  return {
    createdBuffers,
    writes,
    shaderModules,
    dispatches,
    submitted,
    createBuffer({ label, size, usage }) {
      const buffer = {
        label,
        size,
        usage,
        destroyed: false,
        destroy() {
          this.destroyed = true;
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
          throw new Error('Schroeder no-full-readback test should not copy to a readback buffer');
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
      hasCrossLevelCoupling: Boolean(options.schroederCrossLevelCoupling),
      hasConservationSummary: Boolean(options.schroederConservationSummary),
      hasCrossLevelTransfer: Boolean(options.schroederCrossLevelTransfer),
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
  assert.equal(result.crossLevelCoupling.retainedCrossLevelBuffer, true);
  assert.equal(result.crossLevelCoupling.crossLevelCandidateCount, 3);
  assert.equal(result.conservationSummary.retainedSummaryBuffer, true);
  assert.equal(result.conservationSummary.summaryRowCount, 1);
  assert.equal(result.conservationSummary.conservativeTransferStatus, 'summary-only-no-state-mutation');
  assert.equal(result.crossLevelTransfer.retainedTransferBuffer, true);
  assert.equal(result.crossLevelTransfer.crossLevelCandidateCount, 3);
  assert.equal(result.crossLevelTransfer.conservativeTransferStatus, 'transfer-rows-ready-no-state-mutation');
  assert.equal(result.residentStep.hasCrossLevelCoupling, true);
  assert.equal(result.residentStep.hasConservationSummary, true);
  assert.equal(result.residentStep.hasCrossLevelTransfer, true);
  assert.equal(result.activeNodeConsumerStatus, 'planned-not-yet-consumed-by-mls-mpm-kernels');
  assert.equal(
    result.crossLevelCouplingStatus,
    'candidate-generation-submitted-not-yet-consumed-by-mls-mpm-grid-transfer'
  );
  assert.equal(result.conservationSummaryStatus, 'schroeder-conservation-summary-submitted');
  assert.equal(result.crossLevelTransferStatus, 'schroeder-cross-level-transfer-submitted');
  assert.equal(result.conservativeTransferStatus, 'transfer-rows-ready-no-state-mutation');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].gridSpacingM, 1);
  assert.equal(calls[0].schroederSelectedLevel, 2);
  assert.equal(calls[0].schroederLevelAssignment.schema, ULG_SCHROEDER_LEVEL_ASSIGNMENT_EXECUTION_SCHEMA);
  assert.equal(calls[0].readbackMode, SCHROEDER_NO_FULL_READBACK_MODE);
  assert.equal(calls[0].preferWebGpu, true);
  assert.equal(calls[0].schroederCrossLevelCoupling.schema, ULG_SCHROEDER_CROSS_LEVEL_COUPLING_EXECUTION_SCHEMA);
  assert.equal(calls[0].schroederConservationSummary.schema, ULG_SCHROEDER_CONSERVATION_SUMMARY_EXECUTION_SCHEMA);
  assert.equal(calls[0].schroederCrossLevelTransfer.schema, ULG_SCHROEDER_CROSS_LEVEL_TRANSFER_EXECUTION_SCHEMA);
  assert.equal(calls[0].fuseNoFullResidentMechanics, true);
  assert.equal(calls[0].fuseNoFullResidentMechanicsActiveGrid, true);
  assert.deepEqual(device.dispatches, [[1, 1, 1], [1, 1, 1], [1, 1, 1], [1, 1, 1], [1, 1, 1]]);
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
        hasCrossLevelCoupling: Boolean(options.schroederCrossLevelCoupling)
      };
    }
  });

  assert.equal(result.crossLevelCoupling, null);
  assert.equal(result.conservationSummary, null);
  assert.equal(result.crossLevelTransfer, null);
  assert.equal(result.crossLevelCouplingStatus, 'disabled-same-level-only-mechanics');
  assert.equal(result.conservationSummaryStatus, 'disabled-same-level-only-mechanics');
  assert.equal(result.crossLevelTransferStatus, 'disabled-same-level-only-mechanics');
  assert.equal(result.conservativeTransferStatus, 'not-run');
  assert.equal(result.residentStep.hasCrossLevelCoupling, false);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].schroederCrossLevelCoupling, null);
  assert.equal(calls[0].schroederConservationSummary, null);
  assert.equal(calls[0].schroederCrossLevelTransfer, null);
  assert.deepEqual(device.dispatches, [[1, 1, 1], [1, 1, 1]]);
});
