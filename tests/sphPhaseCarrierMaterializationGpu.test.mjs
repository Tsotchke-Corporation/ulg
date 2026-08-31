import assert from 'node:assert/strict';
import test from 'node:test';

import {
  ULG_MLS_MPM_GPU_PARTICLE_BUFFER_SCHEMA,
  ULG_SPH_GPU_PARTICLE_BUFFER_SCHEMA
} from '../ulg-gpu-abi/src/index.js';
import {
  ULG_MLS_MPM_GPU_PARTICLE_BUFFER_SET_SCHEMA,
  ULG_SPH_GPU_PARTICLE_BUFFER_SET_SCHEMA,
  ULG_SPH_GPU_PARTICLE_IDENTITY_BUFFER_SCHEMA
} from '../src/runtime/sph/sphGpuBuffers.js';
import { tagWebGpuBufferDevice } from '../src/runtime/sph/sphGpuDeviceIdentity.js';
import {
  ULG_SPH_PHASE_CARRIER_ONE_TO_FOUR_COUNT_SUMMARY_SCHEMA,
  ULG_SPH_PHASE_CARRIER_ONE_TO_FOUR_EXECUTION_SCHEMA,
  createSphPhaseCarrierOneToFourMaterializationPlan,
  createSphPhaseCarrierOneToFourMaterializationWebGpuEncoderStage,
  deriveSphPhaseCarrierOneToFourLineage,
  runSphPhaseCarrierOneToFourMaterializationWebGpu,
  sphPhaseCarrierOneToFourMaterializationWgsl,
  validateSphPhaseCarrierOneToFourExecution
} from '../src/runtime/sph/sphPhaseCarrierMaterializationGpu.js';
import {
  ULG_WORKER_SCHEDULE_LAW_ACTIVATION_RECEIPT_SCHEMA,
  workerScheduleRequiresPhaseCarrierOneToFourMaterialization
} from '../src/services/ulgMechanicsResidentStage.worker.js';

const LINEAGE = Object.freeze({
  storageGeneration: 7,
  physicsTick: 41,
  physicsSubstep: 0,
  positionEpoch: 12,
  topologyEpoch: 3,
  chartEpoch: 5,
  levelEpoch: 9,
  supportEpoch: 11
});

function singleLanePlan(particleCount = 3) {
  return {
    schema: 'peercompute.ulg.sph-phase-carrier-plan.v2',
    status: 'phase-lane-capacity-ready',
    lineageCapacity: particleCount,
    primaryCapacity: particleCount,
    phaseLaneCount: 1,
    phaseLaneStride: particleCount,
    companionStart: particleCount,
    companionCapacity: 0,
    particleCapacity: particleCount,
    stableLaneAddress: 'phaseLane*phaseLaneStride+lineageIndex',
    phaseCompanionLanesRequired: false,
    reason: 'laws-quiescent-no-phase-mutation-path'
  };
}

function fakeDevice({
  failCreateBindGroup = false,
  validationError = null,
  validationScopeFailure = null
} = {}) {
  const buffers = [];
  const submissions = [];
  const writes = [];
  const bindGroups = [];
  let queueFenceCount = 0;
  const device = {
    buffers,
    submissions,
    writes,
    bindGroups,
    limits: {
      maxBufferSize: 256 * 1024 * 1024,
      maxStorageBufferBindingSize: 128 * 1024 * 1024,
      maxStorageBuffersPerShaderStage: 8,
      maxComputeWorkgroupsPerDimension: 65_535
    },
    pushErrorScope() {},
    async popErrorScope() {
      if (validationScopeFailure) throw validationScopeFailure;
      return validationError;
    },
    get queueFenceCount() { return queueFenceCount; },
    queue: {
      writeBuffer(buffer, offset, data) {
        writes.push({
          buffer,
          offset,
          bytes: new Uint8Array(data instanceof ArrayBuffer ? data : data.buffer).slice()
        });
      },
      submit(commandBuffers) { submissions.push(commandBuffers); },
      async onSubmittedWorkDone() { queueFenceCount += 1; }
    },
    createBuffer(descriptor) {
      const buffer = {
        ...descriptor,
        destroyed: false,
        destroyCount: 0,
        destroy() {
          this.destroyed = true;
          this.destroyCount += 1;
        }
      };
      buffers.push(buffer);
      return buffer;
    },
    createShaderModule(descriptor) { return descriptor; },
    createBindGroupLayout(descriptor) { return descriptor; },
    createPipelineLayout(descriptor) { return descriptor; },
    createComputePipeline(descriptor) { return descriptor; },
    createBindGroup(descriptor) {
      if (failCreateBindGroup) throw new Error('injected-bind-group-failure');
      bindGroups.push(descriptor);
      return descriptor;
    },
    createCommandEncoder() {
      const passes = [];
      return {
        passes,
        beginComputePass(descriptor) {
          const record = {
            descriptor,
            pipeline: null,
            bindGroup: null,
            dispatch: null,
            ended: false
          };
          passes.push(record);
          return {
            setPipeline(pipeline) { record.pipeline = pipeline; },
            setBindGroup(index, bindGroup) {
              record.bindGroup = { index, bindGroup };
            },
            dispatchWorkgroups(x, y = 1, z = 1) {
              record.dispatch = [x, y, z];
            },
            end() { record.ended = true; }
          };
        },
        finish() { return { passes }; }
      };
    }
  };
  return device;
}

function fixture(device, particleCount = 3) {
  const phaseCarrierPlan = singleLanePlan(particleCount);
  const sourceBuffer = (label, size) => tagWebGpuBufferDevice(
    device.createBuffer({ label, size, usage: 128 | 4 }),
    device
  );
  const sphParticleState = {
    schema: ULG_SPH_GPU_PARTICLE_BUFFER_SCHEMA,
    particleCount,
    phaseCarrierPlan,
    identityRevision: 'identity-seed-7',
    state: new Float32Array(particleCount * 8),
    thermo: new Float32Array(particleCount * 12),
    ...LINEAGE
  };
  const mlsMpmParticleState = {
    schema: ULG_MLS_MPM_GPU_PARTICLE_BUFFER_SCHEMA,
    particleCount,
    phaseCarrierPlan,
    mechanics: new Float32Array(particleCount * 32),
    ...LINEAGE
  };
  const sphParticleUpload = {
    schema: ULG_SPH_GPU_PARTICLE_BUFFER_SET_SCHEMA,
    status: 'webgpu-uploaded',
    particleCount,
    phaseCarrierPlan,
    stateBuffer: sourceBuffer('source-state', particleCount * 8 * 4),
    thermoBuffer: sourceBuffer('source-thermo', particleCount * 12 * 4),
    identityBuffer: sourceBuffer('source-identity', particleCount * 4),
    stateBufferByteLength: particleCount * 8 * 4,
    thermoBufferByteLength: particleCount * 12 * 4,
    identityBufferByteLength: particleCount * 4,
    identitySchema: ULG_SPH_GPU_PARTICLE_IDENTITY_BUFFER_SCHEMA,
    identityStrideBytes: 4,
    identityRevision: 'identity-seed-7',
    renderDomainKeys: { 17: 'water', 29: 'iron' },
    ownsStateBuffer: true,
    ownsThermoBuffer: true,
    ownsIdentityBuffer: true,
    bufferFamilyGeneration: LINEAGE.storageGeneration,
    ...LINEAGE
  };
  const mlsMpmParticleUpload = {
    schema: ULG_MLS_MPM_GPU_PARTICLE_BUFFER_SET_SCHEMA,
    status: 'webgpu-uploaded',
    particleCount,
    phaseCarrierPlan,
    mechanicsBuffer: sourceBuffer(
      'source-mechanics',
      particleCount * 32 * 4
    ),
    mechanicsBufferByteLength: particleCount * 32 * 4,
    ownsMechanicsBuffer: true,
    bufferFamilyGeneration: LINEAGE.storageGeneration,
    ...LINEAGE
  };
  return {
    device,
    sphParticleState,
    mlsMpmParticleState,
    sphParticleUpload,
    mlsMpmParticleUpload,
    phaseCarrierPlan
  };
}

test('1-to-4 plan publishes exact counts, fixed correspondence, and topology lineage', () => {
  const input = fixture(fakeDevice(), 3);
  const plan = createSphPhaseCarrierOneToFourMaterializationPlan(input);

  assert.equal(plan.sourceParticleCount, 3);
  assert.equal(plan.terminalParticleCount, 12);
  assert.equal(plan.companionParticleCount, 9);
  assert.equal(
    plan.countSummary.schema,
    ULG_SPH_PHASE_CARRIER_ONE_TO_FOUR_COUNT_SUMMARY_SCHEMA
  );
  assert.equal(plan.countSummary.exactCountAuthority, true);
  assert.equal(
    plan.countSummary.terminalIndexFromSource,
    'phaseLane*sourceParticleCount+sourceParticleIndex'
  );
  assert.deepEqual(plan.phaseCarrierPlan, {
    schema: 'peercompute.ulg.sph-phase-carrier-plan.v2',
    status: 'phase-lane-capacity-ready',
    lineageCapacity: 3,
    primaryCapacity: 3,
    phaseLaneCount: 4,
    phaseLaneStride: 3,
    companionStart: 3,
    companionCapacity: 9,
    particleCapacity: 12,
    stableLaneAddress: 'phaseLane*phaseLaneStride+lineageIndex',
    phaseCompanionLanesRequired: true,
    reason: 'static-schedule-law-activation-requires-four-phase-carrier-lanes'
  });
  assert.deepEqual(plan.lineage.target, {
    ...LINEAGE,
    storageGeneration: 8,
    topologyEpoch: 4
  });
  assert.equal(plan.stateBufferByteLength, 384);
  assert.equal(plan.thermoBufferByteLength, 576);
  assert.equal(plan.mechanicsBufferByteLength, 1536);
  assert.equal(plan.identityBufferByteLength, 48);
  assert.equal(plan.routingAuthority, false);
  assert.equal(plan.dynamicLawRoutingAuthority, false);
});

test('1-to-4 plan rejects drifted address, count mismatch, and lineage overflow', () => {
  const wrongAddress = fixture(fakeDevice(), 2);
  wrongAddress.phaseCarrierPlan = {
    ...wrongAddress.phaseCarrierPlan,
    stableLaneAddress: 'lineageIndex*4+phaseLane'
  };
  assert.throws(
    () => createSphPhaseCarrierOneToFourMaterializationPlan(wrongAddress),
    /exact laws-quiescent single-lane plan/
  );

  const wrongCount = fixture(fakeDevice(), 2);
  wrongCount.mlsMpmParticleUpload.particleCount = 3;
  assert.throws(
    () => createSphPhaseCarrierOneToFourMaterializationPlan(wrongCount),
    /exact matching positive source counts/
  );

  assert.throws(
    () => deriveSphPhaseCarrierOneToFourLineage({
      ...LINEAGE,
      topologyEpoch: 0xffff_ffff
    }),
    /incrementable exact source lineage/
  );
});

test('1-to-4 plan fails closed on torn upload, topology, lineage, byte, and identity authority', () => {
  const cases = [
    {
      mutate(input) { input.sphParticleUpload.status = 'stale'; },
      pattern: /resident SPH upload descriptor/
    },
    {
      mutate(input) {
        input.sphParticleState.phaseCarrierPlan = {
          ...input.phaseCarrierPlan,
          phaseLaneStride: input.phaseCarrierPlan.phaseLaneStride + 1
        };
      },
      pattern: /torn source topology descriptors/
    },
    {
      mutate(input) { input.mlsMpmParticleState.positionEpoch += 1; },
      pattern: /torn CPU-metadata lineage descriptors/
    },
    {
      mutate(input) { input.sphParticleUpload.stateBufferByteLength -= 4; },
      pattern: /torn source byte-length descriptors/
    },
    {
      mutate(input) { input.sphParticleUpload.identitySchema = 'wrong'; },
      pattern: /exact identity schema, stride, and revision authority/
    },
    {
      mutate(input) { input.sphParticleUpload.identityStrideBytes = 8; },
      pattern: /exact identity schema, stride, and revision authority/
    },
    {
      mutate(input) { input.sphParticleUpload.identityRevision = ' '; },
      pattern: /exact identity schema, stride, and revision authority/
    }
  ];
  for (const { mutate, pattern } of cases) {
    const input = fixture(fakeDevice(), 2);
    mutate(input);
    assert.throws(
      () => createSphPhaseCarrierOneToFourMaterializationPlan(input),
      pattern
    );
  }
});

test('encoder preflight rejects undersized, unbindable, and over-limit GPU families before allocation', () => {
  const undersized = fixture(fakeDevice(), 2);
  undersized.sphParticleUpload.stateBuffer.size -= 4;
  assert.throws(
    () => createSphPhaseCarrierOneToFourMaterializationWebGpuEncoderStage(
      undersized
    ),
    /smaller than its exact source count/
  );

  const unbindable = fixture(fakeDevice(), 2);
  unbindable.sphParticleUpload.identityBuffer.usage = 4;
  assert.throws(
    () => createSphPhaseCarrierOneToFourMaterializationWebGpuEncoderStage(
      unbindable
    ),
    /lacks GPUBufferUsage\.STORAGE/
  );

  const missingLimit = fixture(fakeDevice(), 2);
  delete missingLimit.device.limits.maxBufferSize;
  assert.throws(
    () => createSphPhaseCarrierOneToFourMaterializationWebGpuEncoderStage(
      missingLimit
    ),
    /exact maxBufferSize device authority/
  );

  const bindingLimit = fixture(fakeDevice(), 2);
  bindingLimit.device.limits.maxStorageBufferBindingSize = 512;
  assert.throws(
    () => createSphPhaseCarrierOneToFourMaterializationWebGpuEncoderStage(
      bindingLimit
    ),
    /exceeds the exact buffer or storage-binding device limit/
  );

  const dispatchLimit = fixture(fakeDevice(), 65);
  dispatchLimit.device.limits.maxComputeWorkgroupsPerDimension = 4;
  assert.throws(
    () => createSphPhaseCarrierOneToFourMaterializationWebGpuEncoderStage(
      dispatchLimit
    ),
    /exceeds the exact compute-dispatch device limit/
  );
});

test('encoder stage allocates a complete S/T/M/I 4N family without touching sources', () => {
  const device = fakeDevice();
  const input = fixture(device, 3);
  const sourceBuffers = [
    input.sphParticleUpload.stateBuffer,
    input.sphParticleUpload.thermoBuffer,
    input.mlsMpmParticleUpload.mechanicsBuffer,
    input.sphParticleUpload.identityBuffer
  ];
  for (const buffer of sourceBuffers) buffer.size += 1024;
  const stage =
    createSphPhaseCarrierOneToFourMaterializationWebGpuEncoderStage(input);
  const encoder = device.createCommandEncoder();
  stage.encode(encoder);

  assert.equal(stage.result.schema, ULG_SPH_PHASE_CARRIER_ONE_TO_FOUR_EXECUTION_SCHEMA);
  assert.equal(stage.stateBuffer.size, 384);
  assert.equal(stage.thermoBuffer.size, 576);
  assert.equal(stage.mechanicsBuffer.size, 1536);
  assert.equal(stage.identityBuffer.size, 48);
  assert.equal(device.bindGroups.length, 1);
  assert.equal(device.bindGroups[0].entries.length, 9);
  assert.deepEqual(
    device.bindGroups[0].entries.map(({ resource }) => resource.size),
    [96, 144, 384, 12, 384, 576, 1536, 48, 16]
  );
  assert.deepEqual(encoder.passes[0].dispatch, [1, 1, 1]);
  assert.equal(stage.result.nextSphParticleUpload.particleCount, 12);
  assert.equal(stage.result.nextMlsMpmParticleUpload.particleCount, 12);
  assert.equal(stage.result.nextSphParticleState.cpuIdentityStale, true);
  assert.equal(stage.result.nextMlsMpmParticleState.cpuStateStale, true);
  assert.match(
    stage.result.identityRevision,
    /^identity-seed-7:phase-carrier-1-to-4:3->12:/
  );
  assert.ok(sourceBuffers.every((buffer) => buffer.destroyCount === 0));

  stage.cleanupSubmittedWork();
  stage.cleanupRetainedOutput();
  assert.ok(sourceBuffers.every((buffer) => buffer.destroyCount === 0));
});

test('submitted materialization is one command, zero readback, caller-fenced, and valid', async () => {
  const device = fakeDevice();
  const input = fixture(device, 3);
  const result = await runSphPhaseCarrierOneToFourMaterializationWebGpu({
    ...input,
    submittedWorkCleanup: 'caller-terminal-fence'
  });
  const validation = validateSphPhaseCarrierOneToFourExecution(result, {
    device,
    sourceParticleCount: 3,
    sourceLineage: LINEAGE
  });

  assert.equal(result.status, 'phase-carrier-one-to-four-materialization-submitted');
  assert.equal(result.commandSubmissionCount, 1);
  assert.equal(device.submissions.length, 1);
  assert.equal(result.mapAsyncCount, 0);
  assert.equal(result.readbackBytes, 0);
  assert.equal(result.fullParticleReadbackPerformed, false);
  assert.equal(result.submittedWorkCleanupStatus, 'held-for-caller-terminal-fence');
  assert.equal(device.queueFenceCount, 0);
  assert.equal(validation.valid, true, validation.failures.join(', '));
  assert.deepEqual(validation.targetLineage, {
    ...LINEAGE,
    storageGeneration: 8,
    topologyEpoch: 4
  });

  assert.equal(result.cleanupSubmittedWork(), true);
  assert.equal(result.cleanupSubmittedWork(), true);
  assert.equal(
    device.buffers.find((buffer) => buffer.label.endsWith('-params')).destroyCount,
    1
  );
  result.destroyOutputParticleBuffers();
});

test('a submitted validation error returns an owned invalid publication for terminal-fenced cleanup', async () => {
  const device = fakeDevice({
    validationError: new Error('injected-native-validation-error')
  });
  const input = fixture(device, 2);
  const sourceBuffers = [...device.buffers];
  const result = await runSphPhaseCarrierOneToFourMaterializationWebGpu({
    ...input,
    submittedWorkCleanup: 'caller-terminal-fence'
  });
  const validation = validateSphPhaseCarrierOneToFourExecution(result, {
    device,
    sourceParticleCount: 2,
    sourceLineage: LINEAGE
  });

  assert.equal(
    result.status,
    'phase-carrier-one-to-four-materialization-publication-invalid'
  );
  assert.equal(result.validationErrorObserved, true);
  assert.equal(result.validationErrorScopeStatus, 'validation-error-observed');
  assert.match(result.validationErrorMessage, /injected-native-validation-error/);
  assert.equal(validation.valid, false);
  assert.ok(validation.failures.includes('execution-status'));
  assert.ok(validation.failures.includes('validation-error-scope'));
  assert.ok(sourceBuffers.every((buffer) => buffer.destroyCount === 0));
  assert.equal(
    device.buffers.filter((buffer) => !sourceBuffers.includes(buffer))
      .every((buffer) => buffer.destroyCount === 0),
    true
  );

  result.cleanupSubmittedWork();
  result.destroyOutputParticleBuffers();
  assert.ok(sourceBuffers.every((buffer) => buffer.destroyCount === 0));
});

test('construction failure retires every local allocation exactly once and leaves sources', () => {
  const device = fakeDevice({ failCreateBindGroup: true });
  const input = fixture(device, 2);
  const sourceBuffers = [...device.buffers];
  assert.throws(
    () => createSphPhaseCarrierOneToFourMaterializationWebGpuEncoderStage(input),
    /injected-bind-group-failure/
  );
  const locals = device.buffers.filter((buffer) => !sourceBuffers.includes(buffer));
  assert.equal(locals.length, 5);
  assert.ok(locals.every((buffer) => buffer.destroyCount === 1));
  assert.ok(sourceBuffers.every((buffer) => buffer.destroyCount === 0));
});

test('shader fixes lane-major correspondence, repeats identity, and reserves companions', () => {
  assert.match(
    sphPhaseCarrierOneToFourMaterializationWgsl,
    /source_index = terminal_index % params\.source_particle_count/
  );
  assert.match(
    sphPhaseCarrierOneToFourMaterializationWgsl,
    /phase_lane = terminal_index \/ params\.source_particle_count/
  );
  assert.match(
    sphPhaseCarrierOneToFourMaterializationWgsl,
    /out_identity\[terminal_index\] = source_identity\[source_index\]/
  );
  assert.match(
    sphPhaseCarrierOneToFourMaterializationWgsl,
    /source_position_mass\.xyz, 0\.0/
  );
  assert.match(
    sphPhaseCarrierOneToFourMaterializationWgsl,
    /f32\(params\.reserved_status\)/
  );
});

test('worker topology trigger accepts static phase-capable activation only', () => {
  const activation = {
    schema: ULG_WORKER_SCHEDULE_LAW_ACTIVATION_RECEIPT_SCHEMA,
    thermal: true,
    reaction: false,
    activationAuthority: 'schedule-config-static-declaration-no-readback'
  };
  const base = {
    phaseCarrierPlan: singleLanePlan(3),
    scheduleLawActivation: activation,
    canonicalRouteSelected: true,
    tier0ContinuationIdentityPresent: true
  };
  assert.equal(
    workerScheduleRequiresPhaseCarrierOneToFourMaterialization(base),
    true
  );
  assert.equal(
    workerScheduleRequiresPhaseCarrierOneToFourMaterialization({
      ...base,
      scheduleLawActivation: {
        ...activation,
        activationAuthority: 'gpu-dynamic-law-observation'
      }
    }),
    false
  );
  assert.equal(
    workerScheduleRequiresPhaseCarrierOneToFourMaterialization({
      ...base,
      tier0ContinuationIdentityPresent: false
    }),
    false
  );
  assert.equal(
    workerScheduleRequiresPhaseCarrierOneToFourMaterialization({
      ...base,
      scheduleLawActivation: {
        ...activation,
        thermal: false,
        reaction: false
      }
    }),
    false
  );
});
