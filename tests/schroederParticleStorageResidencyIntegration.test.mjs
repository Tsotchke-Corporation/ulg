import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  ULG_MLS_MPM_GPU_PARTICLE_BUFFER_SCHEMA,
  ULG_SPH_GPU_PARTICLE_BUFFER_SCHEMA
} from '../ulg-gpu-abi/src/index.js';
import {
  runSchroederResidentStepsWithOptionalWebGpu,
  runSchroederSameLevelMechanicsWebGpu
} from '../src/runtime/sph/schroederHierarchyGpu.js';
import {
  createSchroederParticleStorageResidencyAdoptionCandidate
} from '../src/runtime/sph/schroederParticleStorageAdoptionGpu.js';
import {
  MLS_MPM_GPU_PARTICLE_MECHANICS_ROW_LAYOUT
} from '../src/runtime/sph/sphGpuBuffers.js';

function fakeDevice() {
  const createdBuffers = [];
  const submissions = [];
  const dispatches = [];
  const device = {
    createdBuffers,
    submissions,
    dispatches,
    createBuffer(descriptor) {
      const buffer = {
        ...descriptor,
        destroyed: false,
        destroy() { buffer.destroyed = true; },
        async mapAsync() {},
        getMappedRange() { return new ArrayBuffer(descriptor.size); },
        unmap() {}
      };
      createdBuffers.push(buffer);
      return buffer;
    },
    createShaderModule(descriptor) { return descriptor; },
    createComputePipeline(descriptor) {
      return {
        label: descriptor.label,
        getBindGroupLayout(index) { return { label: `${descriptor.label}-layout-${index}` }; }
      };
    },
    createBindGroup(descriptor) { return descriptor; },
    createCommandEncoder() {
      return {
        clearBuffer() {},
        beginComputePass() {
          return {
            setPipeline() {},
            setBindGroup() {},
            dispatchWorkgroups(x, y = 1, z = 1) { dispatches.push({ direct: [x, y, z] }); },
            dispatchWorkgroupsIndirect(buffer, offset) {
              dispatches.push({ indirect: { buffer, offset } });
            },
            end() {}
          };
        },
        copyBufferToBuffer() {
          throw new Error('GPU-resident particle storage must not encode a readback copy');
        },
        finish() { return { label: 'fake-command-buffer' }; }
      };
    },
    queue: {
      writeBuffer() {},
      submit(commands) { submissions.push(commands); },
      async onSubmittedWorkDone() {}
    }
  };
  return device;
}

function particleStates(particleCount = 3) {
  const state = new Float32Array(particleCount * 8);
  const thermo = new Float32Array(particleCount * 12);
  const mechanics = new Float32Array(
    particleCount * MLS_MPM_GPU_PARTICLE_MECHANICS_ROW_LAYOUT.length
  );
  for (let index = 0; index < particleCount; index += 1) {
    state[index * 8 + 3] = 1;
    thermo[index * 12] = 1;
    thermo[index * 12 + 1] = 2;
    thermo[index * 12 + 3] = 1000;
    thermo[index * 12 + 8] = 0.25;
    mechanics[index * MLS_MPM_GPU_PARTICLE_MECHANICS_ROW_LAYOUT.length + 19] = 0.001;
  }
  return {
    sphParticleState: {
      schema: ULG_SPH_GPU_PARTICLE_BUFFER_SCHEMA,
      particleCount,
      smoothingLengthM: 0.25,
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

function particleStorageFixture(device) {
  const materializationRows = device.createBuffer({
    label: 'retained-materialization-rows',
    size: 3 * 32 * Float32Array.BYTES_PER_ELEMENT,
    usage: 128
  });
  const materialization = {
    status: 'schroeder-particle-storage-materialization-submitted',
    particleStorageMaterializationAdmissionApproved: true,
    materializationBuffer: materializationRows,
    particleStateBuffer: device.createBuffer({ label: 'materialized-state', size: 192, usage: 128 }),
    particleThermoBuffer: device.createBuffer({ label: 'materialized-thermo', size: 288, usage: 128 }),
    particleMechanicsBuffer: device.createBuffer({ label: 'materialized-mechanics', size: 768, usage: 128 }),
    assignmentRowCount: 3,
    materializationStrideFloats: 32,
    sourceParticleCount: 3,
    outputParticleCapacity: 6,
    materializationEpoch: 4,
    targetStateFamilies: [
      'sph-particle-state',
      'mls-mpm-particle-mechanics',
      'sph-particle-thermo'
    ],
    retainedParticleBuffers: true
  };
  const laneIdentity = {
    schema: 'peercompute.compute.gpu-resident-lane-lease.v0',
    authoritative: true,
    taskId: 'ulg:test:ss-resident-task',
    stateKey: 'ulg:test:ss-resident-state',
    laneId: 'ulg:test:ss-resident-lane',
    leaseId: 'ulg:test:ss-resident-lease',
    sourceFamily: 'schroeder-particle-storage'
  };
  return { materialization, laneIdentity };
}

test('authoritative Schroeder lane publishes GPU count token and never calls mapped storage wrappers', async () => {
  const device = fakeDevice();
  const states = particleStates();
  const { materialization, laneIdentity } = particleStorageFixture(device);
  const residentCalls = [];
  let legacyCountCalls = 0;
  let legacyCompactionCalls = 0;

  const result = await runSchroederSameLevelMechanicsWebGpu({
    device,
    ...states,
    selectedLevel: 0,
    baseGridSpacingM: 0.25,
    mergeEpoch: 4,
    particleStorageMaterialization: materialization,
    particleStorageResidencyMode: 'gpu-resident-metadata',
    particleStorageCountSummaryRunner: async () => {
      legacyCountCalls += 1;
      throw new Error('legacy count wrapper must not run');
    },
    particleStorageCompactionRunner: async () => {
      legacyCompactionCalls += 1;
      throw new Error('legacy compaction wrapper must not run');
    },
    residentStepOptions: { gpuResidentLaneLeaseIdentity: laneIdentity },
    residentStepRunner: async (options) => {
      residentCalls.push(options);
      return { status: 'resident-step-stubbed', normalHotLoopReadbackFree: true };
    }
  });

  assert.equal(legacyCountCalls, 0);
  assert.equal(legacyCompactionCalls, 0);
  assert.equal(residentCalls.length, 1);
  assert.equal(residentCalls[0].schroederParticleStorageMaterialization, null);
  assert.equal(
    residentCalls[0].schroederParticleStorageResidencyAdoptionToken,
    result.particleStorageResidencyAdoptionToken
  );
  assert.equal(result.particleStorageResidencyMode, 'gpu-resident-metadata');
  assert.equal(result.particleStorageResidencyAuthorityEnabled, true);
  assert.equal(result.normalHotLoopReadbackFree, true);
  assert.equal(result.particleStorageCountSummary.authoritativeParticleCount, null);
  assert.equal(result.particleStorageCountSummary.authoritativeParticleCountMetadataWord, 4);
  assert.equal(result.particleStorageCountSummary.compactSummaryReadbackPerformed, false);
  assert.equal(result.particleStorageCountSummary.residencyMetadataRetained, false);
  assert.equal(result.particleStorageCountSummary.residencyMetadataIntermediate, true);
  assert.equal(result.particleStorageCompaction.authoritativeParticleCount, null);
  assert.equal(result.particleStorageCompaction.outputParticleCapacity, 6);
  assert.equal(result.particleStorageCompaction.residencyMetadataRetained, true);
  assert.equal(result.particleStorageCompaction.activeDispatchIndirectByteOffset, 0);
  assert.equal(result.particleStorageCompaction.selectionDispatchIndirectByteOffset, 12);
  assert.equal(result.particleStorageResidencyAdoptionToken.authoritativeParticleCount, null);
  assert.equal(result.particleStorageResidencyAdoptionToken.outputParticleCapacity, 6);
  assert.equal(result.residentStep.schroederParticleStorageAuthoritativeParticleCount, null);
  assert.equal(
    result.residentStep.schroederParticleStorageAuthoritativeParticleCountMetadataWord,
    4
  );
  assert.equal(device.createdBuffers.some((buffer) => /readback/i.test(buffer.label)), false);
  assert.ok(device.dispatches.some((dispatch) => dispatch.indirect?.offset === 12));
  result.particleStorageResidencyAdoptionCandidate.destroy();
});

test('resident sequence releases superseded intermediate storage candidates', async () => {
  const device = fakeDevice();
  const states = particleStates();
  const { materialization, laneIdentity } = particleStorageFixture(device);
  const candidates = [];
  const execution = await runSchroederResidentStepsWithOptionalWebGpu({
    device,
    ...states,
    stepCount: 2,
    gpuResidentLaneLeaseIdentity: laneIdentity,
    particleStorageMaterialization: materialization,
    particleStorageResidencyMode: 'gpu-resident-metadata',
    particleStorageResidencyAdoptionCandidateFactory: (options) => {
      const candidate = createSchroederParticleStorageResidencyAdoptionCandidate(options);
      candidates.push(candidate);
      return candidate;
    },
    residentStepRunner: async () => ({
      status: 'resident-step-stubbed',
      normalHotLoopReadbackFree: true
    })
  });

  assert.equal(candidates.length, 2);
  assert.equal(candidates[0].stateBuffer.destroyed, true);
  assert.equal(candidates[0].residencyMetadataBuffer.destroyed, true);
  assert.equal(candidates[1].stateBuffer.destroyed, false);
  assert.equal(
    execution.schroederParticleStorageResidencyAdoptionCandidate,
    candidates[1]
  );
  candidates[1].destroy();
});
