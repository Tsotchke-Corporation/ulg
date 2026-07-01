import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  SCHROEDER_ACTIVE_NODE_ROW_LAYOUT,
  SCHROEDER_LEVEL_ASSIGNMENT_ROW_LAYOUT,
  ULG_MLS_MPM_GPU_PARTICLE_BUFFER_SCHEMA,
  ULG_SCHROEDER_ACTIVE_NODE_LIST_EXECUTION_SCHEMA,
  ULG_SCHROEDER_ACTIVE_NODE_LIST_SCHEMA,
  ULG_SCHROEDER_LEVEL_ASSIGNMENT_EXECUTION_SCHEMA,
  ULG_SCHROEDER_LEVEL_ASSIGNMENT_SCHEMA,
  ULG_SPH_GPU_PARTICLE_BUFFER_SCHEMA
} from '../ulg-gpu-abi/src/index.js';
import {
  SCHROEDER_ACTIVE_NODE_FLOATS,
  SCHROEDER_LEVEL_ASSIGNMENT_FLOATS,
  SCHROEDER_NO_FULL_READBACK_MODE,
  createSchroederActiveNodeListPlan,
  createSchroederActiveNodeParamsArray,
  createSchroederLevelAssignmentParamsArray,
  createSchroederLevelAssignmentPlan,
  estimateSchroederLevelDeltaForVolumeRatio,
  estimateSchroederLevelFromSupportRadius,
  runSchroederActiveNodeListWebGpu,
  runSchroederLevelAssignmentWebGpu
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
});

test('Schroeder level estimates model water-to-steam scale migration without 700x particles', () => {
  assert.equal(estimateSchroederLevelDeltaForVolumeRatio(700), 3);
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
