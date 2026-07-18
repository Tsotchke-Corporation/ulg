import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ULG_SCHROEDER_LEVEL_ASSIGNMENT_EXECUTION_SCHEMA,
  ULG_SPH_GPU_PARTICLE_BUFFER_SET_SCHEMA
} from '../ulg-gpu-abi/src/index.js';
import {
  SCHROEDER_FROZEN_LEVEL_ASSIGNMENT_REFRESH_PARAMS_BYTES,
  schroederFrozenLevelAssignmentRefreshWgsl
} from '../ulg-gpu-abi/src/schroederFrozenLevelAssignmentRefreshWgsl.js';
import {
  SCHROEDER_FROZEN_LEVEL_ASSIGNMENT_REFRESH_MODE,
  ULG_SCHROEDER_FROZEN_LEVEL_ASSIGNMENT_REFRESH_SCHEMA,
  createSchroederFrozenLevelAssignmentRefreshGpu,
  refreshSchroederFrozenLevelAssignmentRowsCpuOracle
} from '../src/runtime/sph/schroederFrozenLevelAssignmentRefreshGpu.js';
import { tagWebGpuBufferDevice } from '../src/runtime/sph/sphGpuDeviceIdentity.js';

const RUN_NATIVE = process.env.ULG_RUN_NATIVE_FROZEN_LEVEL_REFRESH === '1';
const NATIVE_BASE_URL = process.env.ULG_FROZEN_LEVEL_REFRESH_BASE_URL
  || 'https://127.0.0.1:5174/';

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  promise.catch(() => {});
  return { promise, resolve, reject };
}

function createFakeEncoder() {
  const events = [];
  return {
    events,
    clearBuffer(buffer, offset = 0, size = null) {
      events.push({ kind: 'clear', buffer, offset, size });
    },
    beginComputePass(descriptor = {}) {
      const event = { kind: 'pass', descriptor, commands: [] };
      events.push(event);
      return {
        setPipeline(pipeline) { event.pipeline = pipeline; },
        setBindGroup(index, bindGroup) { event.bindGroup = { index, bindGroup }; },
        dispatchWorkgroups(x, y = 1, z = 1) {
          event.commands.push({ dispatch: [x, y, z] });
        },
        end() { event.ended = true; }
      };
    }
  };
}

function createFakeDevice() {
  const buffers = [];
  const shaderModules = [];
  const pipelines = [];
  const bindGroups = [];
  const writes = [];
  const fences = [];
  const device = {
    buffers,
    shaderModules,
    pipelines,
    bindGroups,
    writes,
    fences,
    limits: {
      maxBufferSize: 256 * 1024 * 1024,
      maxStorageBufferBindingSize: 128 * 1024 * 1024,
      maxStorageBuffersPerShaderStage: 8,
      maxComputeWorkgroupsPerDimension: 65535
    },
    queue: {
      writeBuffer(buffer, offset, data) {
        writes.push({
          buffer,
          offset,
          data: new Uint32Array(data.buffer, data.byteOffset, data.byteLength / 4).slice()
        });
      },
      onSubmittedWorkDone() {
        const fence = Promise.resolve();
        fences.push(fence);
        return fence;
      }
    },
    createBuffer(descriptor) {
      const buffer = {
        ...descriptor,
        destroyed: false,
        destroyCount: 0,
        destroy() {
          this.destroyCount += 1;
          this.destroyed = true;
        }
      };
      buffers.push(buffer);
      return buffer;
    },
    createShaderModule(descriptor) {
      shaderModules.push(descriptor);
      return descriptor;
    },
    createComputePipeline(descriptor) {
      const pipeline = {
        ...descriptor,
        getBindGroupLayout(index) { return { pipeline: descriptor.label, index }; }
      };
      pipelines.push(pipeline);
      return pipeline;
    },
    createBindGroup(descriptor) {
      bindGroups.push(descriptor);
      return descriptor;
    }
  };
  return device;
}

function createFixture(device, overrides = {}) {
  const particleCount = overrides.particleCount ?? 3;
  const assignmentBuffer = tagWebGpuBufferDevice(device.createBuffer({
    label: 'macro-assignment',
    size: particleCount * 16 * 4,
    usage: 128
  }), device);
  const macroStateBuffer = tagWebGpuBufferDevice(device.createBuffer({
    label: 'macro-state',
    size: particleCount * 8 * 4,
    usage: 128
  }), device);
  const currentStateBuffer = tagWebGpuBufferDevice(device.createBuffer({
    label: 'current-substep-state',
    size: particleCount * 8 * 4,
    usage: 128
  }), device);
  const priorLevelAssignment = {
    schema: ULG_SCHROEDER_LEVEL_ASSIGNMENT_EXECUTION_SCHEMA,
    assignmentSchema: 'peercompute.ulg.schroeder-level-assignment.v0',
    status: 'schroeder-level-assignment-submitted',
    bufferFamilyGenerationStatus:
      'schroeder-particle-buffer-family-generation-ready',
    particleCount,
    assignmentStrideFloats: 16,
    assignmentStrideBytes: 64,
    assignmentBuffer,
    assignmentBufferByteLength: particleCount * 16 * 4,
    sourceStateBuffer: macroStateBuffer,
    sourceStateBufferBorrowed: true,
    storageGeneration: 7,
    physicsTick: 11,
    physicsSubstep: 0,
    positionEpoch: 13,
    topologyEpoch: 17,
    chartEpoch: 19,
    levelEpoch: 23,
    supportEpoch: 29,
    minLevel: 0,
    maxLevel: 1,
    chartId: 0,
    baseGridSpacingM: 0.25,
    ...overrides.prior
  };
  const currentSphParticleUpload = {
    schema: ULG_SPH_GPU_PARTICLE_BUFFER_SET_SCHEMA,
    status: 'webgpu-uploaded',
    particleCount,
    storageGeneration: 8,
    bufferFamilyGeneration: 8,
    bufferFamilyGenerationStatus:
      'resident-particle-buffer-family-generation-advanced',
    positionEpoch: 14,
    topologyEpoch: 17,
    chartEpoch: 19,
    levelEpoch: 14,
    supportEpoch: 14,
    stateStrideBytes: 8 * 4,
    stateBufferByteLength: particleCount * 8 * 4,
    stateBuffer: currentStateBuffer,
    ...overrides.current
  };
  return { particleCount, priorLevelAssignment, currentSphParticleUpload };
}

test('frozen assignment WGSL copies all words bitwise and replaces only current XYZ', () => {
  assert.equal(SCHROEDER_FROZEN_LEVEL_ASSIGNMENT_REFRESH_PARAMS_BYTES, 16);
  assert.match(schroederFrozenLevelAssignmentRefreshWgsl, /prior_assignments: array<u32>/);
  assert.match(schroederFrozenLevelAssignmentRefreshWgsl, /current_state: array<u32>/);
  assert.match(schroederFrozenLevelAssignmentRefreshWgsl, /word < ASSIGNMENT_STRIDE_WORDS/);
  assert.match(
    schroederFrozenLevelAssignmentRefreshWgsl,
    /POSITION_X_WORD\] = current_state\[state_offset \+ 0u\]/
  );
  assert.doesNotMatch(schroederFrozenLevelAssignmentRefreshWgsl, /log2|exp2|support_radius/);

  const prior = new Float32Array(2 * 16);
  const priorWords = new Uint32Array(prior.buffer);
  for (let index = 0; index < priorWords.length; index += 1) {
    priorWords[index] = (0x3f000000 + index * 131) >>> 0;
  }
  // Preserve a noncanonical payload to prove that copying is by word, not by
  // floating-point round trip.
  priorWords[7] = 0x7fc01234;
  const state = new Float32Array(2 * 8);
  state.set([1.25, -2.5, 3.75], 0);
  state.set([-4.5, 5.25, 6.5], 8);
  const output = refreshSchroederFrozenLevelAssignmentRowsCpuOracle({
    priorAssignments: prior,
    currentState: state,
    particleCount: 2
  });
  const outputWords = new Uint32Array(output.buffer);
  const stateWords = new Uint32Array(state.buffer);
  for (let particle = 0; particle < 2; particle += 1) {
    for (let word = 0; word < 16; word += 1) {
      const outputIndex = particle * 16 + word;
      if (word >= 12 && word <= 14) {
        assert.equal(outputWords[outputIndex], stateWords[particle * 8 + word - 12]);
      } else {
        assert.equal(outputWords[outputIndex], priorWords[outputIndex]);
      }
    }
  }
});

test('caller-owned encoder publishes a fresh position epoch while freezing macro classification', async () => {
  const device = createFakeDevice();
  const fixture = createFixture(device);
  const runtime = createSchroederFrozenLevelAssignmentRefreshGpu(device, {
    maxParticleCount: fixture.particleCount,
    arenaCount: 2
  });
  const encoder = createFakeEncoder();
  const execution = runtime.encode(encoder, {
    priorLevelAssignment: fixture.priorLevelAssignment,
    currentSphParticleUpload: fixture.currentSphParticleUpload,
    physicsTick: 11,
    physicsSubstep: 1
  });

  assert.equal(execution.refreshSchema, ULG_SCHROEDER_FROZEN_LEVEL_ASSIGNMENT_REFRESH_SCHEMA);
  assert.equal(execution.status, 'schroeder-frozen-level-assignment-refresh-gpu-encoded');
  assert.equal(execution.sourceStateBuffer, fixture.currentSphParticleUpload.stateBuffer);
  assert.equal(execution.sourceAssignmentBuffer, fixture.priorLevelAssignment.assignmentBuffer);
  assert.equal(execution.storageGeneration, 8);
  assert.equal(execution.physicsTick, 11);
  assert.equal(execution.physicsSubstep, 1);
  assert.equal(execution.positionEpoch, 14);
  assert.equal(execution.topologyEpoch, fixture.priorLevelAssignment.topologyEpoch);
  assert.equal(execution.chartEpoch, fixture.priorLevelAssignment.chartEpoch);
  assert.equal(execution.levelEpoch, fixture.priorLevelAssignment.levelEpoch);
  assert.equal(execution.supportEpoch, fixture.priorLevelAssignment.supportEpoch);
  assert.equal(execution.levelReclassificationPerformed, false);
  assert.equal(execution.fullReadbackPerformed, false);
  assert.equal(execution.normalHotLoopReadbackFree, true);
  assert.equal(device.writes.length, 1);
  assert.deepEqual(Array.from(device.writes[0].data), [fixture.particleCount, 16, 8, 1]);
  assert.equal(encoder.events[0].kind, 'clear');
  assert.equal(encoder.events[0].size, fixture.particleCount * 16 * 4);
  assert.deepEqual(encoder.events[1].commands[0].dispatch, [1, 1, 1]);
  assert.equal(device.bindGroups[0].entries[0].resource.buffer, fixture.priorLevelAssignment.assignmentBuffer);
  assert.equal(device.bindGroups[0].entries[1].resource.buffer, fixture.currentSphParticleUpload.stateBuffer);
  assert.equal(device.bindGroups[0].entries[2].resource.buffer, execution.assignmentBuffer);
  assert.notEqual(execution.assignmentBuffer.usage & 8, 0, 'clearBuffer requires COPY_DST');
  assert.equal('submit' in device.queue, false);
  assert.equal(device.buffers.some((buffer) => String(buffer.label).includes('readback')), false);

  assert.equal(runtime.markExecutionSubmitted(execution), true);
  assert.equal(execution.status, 'schroeder-level-assignment-submitted');
  assert.equal(runtime.isExecutionSubmitted(execution), true);
  await runtime.releaseAfterQueue(execution);
  assert.equal(execution.released, true);
  assert.equal(device.fences.length, 1);
  assert.equal(runtime.destroy(), true);
  assert.equal(device.buffers.filter(
    (buffer) => String(buffer.label).includes('frozen-level-assignment-refresh')
  ).every((buffer) => buffer.destroyed), true);
  assert.equal(fixture.priorLevelAssignment.assignmentBuffer.destroyed, false);
  assert.equal(fixture.currentSphParticleUpload.stateBuffer.destroyed, false);
});

test('macro-boundary mode admits one fresh full reclassification at N+1/substep 0', async () => {
  const device = createFakeDevice();
  const fixture = createFixture(device, {
    current: {
      physicsTick: 12,
      physicsSubstep: 0,
      levelEpoch: 24,
      supportEpoch: 30
    }
  });
  const macroAssignmentBuffer = tagWebGpuBufferDevice(device.createBuffer({
    label: 'macro-boundary-reclassified-assignment',
    size: fixture.particleCount * 16 * 4,
    usage: 128
  }), device);
  const macroBoundaryLevelAssignment = {
    ...fixture.priorLevelAssignment,
    assignmentBuffer: macroAssignmentBuffer,
    sourceStateBuffer: fixture.currentSphParticleUpload.stateBuffer,
    storageGeneration: 8,
    physicsTick: 12,
    physicsSubstep: 0,
    positionEpoch: 14,
    topologyEpoch: 17,
    chartEpoch: 19,
    levelEpoch: 24,
    supportEpoch: 30
  };
  const runtime = createSchroederFrozenLevelAssignmentRefreshGpu(device, {
    maxParticleCount: fixture.particleCount,
    arenaCount: 1
  });
  const runnerCalls = [];
  const result = await runtime.advance({
    refreshMode:
      SCHROEDER_FROZEN_LEVEL_ASSIGNMENT_REFRESH_MODE.MACRO_BOUNDARY,
    priorLevelAssignment: fixture.priorLevelAssignment,
    currentSphParticleUpload: fixture.currentSphParticleUpload,
    physicsTick: 12,
    physicsSubstep: 0,
    macroBoundaryLevelAssignmentRunner: async (options) => {
      runnerCalls.push(options);
      return macroBoundaryLevelAssignment;
    },
    macroBoundaryRunnerOptions: { marker: 'full-classifier' }
  });

  assert.equal(result, macroBoundaryLevelAssignment);
  assert.equal(runnerCalls.length, 1);
  assert.equal(runnerCalls[0].marker, 'full-classifier');
  assert.equal(result.refreshMode,
    SCHROEDER_FROZEN_LEVEL_ASSIGNMENT_REFRESH_MODE.MACRO_BOUNDARY);
  assert.equal(result.physicsTick, 12);
  assert.equal(result.physicsSubstep, 0);
  assert.equal(result.levelEpoch, 24);
  assert.equal(result.supportEpoch, 30);
  assert.equal(result.levelReclassificationPerformed, true);
  assert.equal(
    result.levelClassificationMode,
    'macro-boundary-full-reclassification'
  );
  assert.equal(result.sourceAssignmentBuffer,
    fixture.priorLevelAssignment.assignmentBuffer);
  assert.equal(device.writes.length, 0);
  assert.equal(device.bindGroups.length, 0);
  assert.equal(runtime.destroy(), true);
  assert.equal(macroAssignmentBuffer.destroyed, false);
  assert.equal(fixture.priorLevelAssignment.assignmentBuffer.destroyed, false);
  assert.equal(fixture.currentSphParticleUpload.stateBuffer.destroyed, false);
});

test('macro-boundary mode rejects stale copy output, wrong epoch, and missing classifier', async () => {
  const device = createFakeDevice();
  const fixture = createFixture(device, {
    current: {
      physicsTick: 12,
      physicsSubstep: 0,
      levelEpoch: 24,
      supportEpoch: 30
    }
  });
  const runtime = createSchroederFrozenLevelAssignmentRefreshGpu(device, {
    maxParticleCount: fixture.particleCount,
    arenaCount: 1
  });
  const common = {
    refreshMode:
      SCHROEDER_FROZEN_LEVEL_ASSIGNMENT_REFRESH_MODE.MACRO_BOUNDARY,
    priorLevelAssignment: fixture.priorLevelAssignment,
    currentSphParticleUpload: fixture.currentSphParticleUpload,
    physicsTick: 12,
    physicsSubstep: 0
  };
  await assert.rejects(
    runtime.advance(common),
    { code: 'ERR_SCHROEDER_FROZEN_REFRESH_MACRO_RUNNER_REQUIRED' }
  );
  await assert.rejects(runtime.advance({
    ...common,
    physicsTick: 11,
    macroBoundaryLevelAssignment: {
      ...fixture.priorLevelAssignment,
      assignmentBuffer: tagWebGpuBufferDevice(device.createBuffer({
        label: 'wrong-tick-macro-assignment',
        size: fixture.particleCount * 16 * 4,
        usage: 128
      }), device),
      sourceStateBuffer: fixture.currentSphParticleUpload.stateBuffer
    }
  }), { code: 'ERR_SCHROEDER_FROZEN_REFRESH_MACRO_IDENTITY' });
  await assert.rejects(runtime.advance({
    ...common,
    macroBoundaryLevelAssignment: fixture.priorLevelAssignment
  }), { code: 'ERR_SCHROEDER_FROZEN_REFRESH_MACRO_RECLASSIFICATION' });
  assert.equal(runtime.destroy(), true);
});

test('refresh fails closed before encoding on count, layout, epoch and device mismatch', () => {
  const cases = [
    {
      name: 'count',
      mutate(fixture) { fixture.currentSphParticleUpload.particleCount += 1; },
      code: 'ERR_SCHROEDER_FROZEN_REFRESH_COUNT_MISMATCH'
    },
    {
      name: 'layout',
      mutate(fixture) { fixture.currentSphParticleUpload.stateStrideBytes = 16; },
      code: 'ERR_SCHROEDER_FROZEN_REFRESH_LAYOUT'
    },
    {
      name: 'stale position',
      mutate(fixture) { fixture.currentSphParticleUpload.positionEpoch = 13; },
      code: 'ERR_SCHROEDER_FROZEN_REFRESH_STALE_POSITION'
    },
    {
      name: 'topology changed',
      mutate(fixture) { fixture.currentSphParticleUpload.topologyEpoch = 18; },
      code: 'ERR_SCHROEDER_FROZEN_REFRESH_MACRO_IDENTITY'
    },
    {
      name: 'foreign current state',
      mutate(fixture) {
        const foreign = createFakeDevice();
        fixture.currentSphParticleUpload.stateBuffer = tagWebGpuBufferDevice(
          foreign.createBuffer({ label: 'foreign', size: fixture.particleCount * 8 * 4, usage: 128 }),
          foreign
        );
      },
      code: 'ERR_SCHROEDER_FROZEN_REFRESH_DEVICE_MISMATCH'
    }
  ];

  for (const entry of cases) {
    const device = createFakeDevice();
    const fixture = createFixture(device);
    entry.mutate(fixture);
    const runtime = createSchroederFrozenLevelAssignmentRefreshGpu(device, {
      maxParticleCount: fixture.particleCount
    });
    const encoder = createFakeEncoder();
    const writesBefore = device.writes.length;
    assert.throws(
      () => runtime.encode(encoder, {
        priorLevelAssignment: fixture.priorLevelAssignment,
        currentSphParticleUpload: fixture.currentSphParticleUpload,
        physicsTick: 11,
        physicsSubstep: 1
      }),
      (error) => error.code === entry.code,
      entry.name
    );
    assert.equal(device.writes.length, writesBefore, entry.name);
    assert.equal(device.bindGroups.length, 0, entry.name);
    assert.equal(encoder.events.length, 0, entry.name);
    assert.equal(runtime.destroy(), true, entry.name);
  }
});

test('persistent arenas apply bounded backpressure until abandonment or a queue fence', async () => {
  const device = createFakeDevice();
  const fixture = createFixture(device);
  const runtime = createSchroederFrozenLevelAssignmentRefreshGpu(device, {
    maxParticleCount: fixture.particleCount,
    arenaCount: 1
  });
  const first = runtime.encode(createFakeEncoder(), {
    priorLevelAssignment: fixture.priorLevelAssignment,
    currentSphParticleUpload: fixture.currentSphParticleUpload,
    physicsSubstep: 1
  });
  assert.throws(
    () => runtime.encode(createFakeEncoder(), {
      priorLevelAssignment: fixture.priorLevelAssignment,
      currentSphParticleUpload: fixture.currentSphParticleUpload,
      physicsSubstep: 1
    }),
    (error) => error.code === 'ERR_SCHROEDER_FROZEN_REFRESH_BACKPRESSURE'
  );
  assert.equal(runtime.abandonExecution(first), true);

  const second = runtime.encode(createFakeEncoder(), {
    priorLevelAssignment: fixture.priorLevelAssignment,
    currentSphParticleUpload: fixture.currentSphParticleUpload,
    physicsSubstep: 1
  });
  runtime.markExecutionSubmitted(second);
  assert.throws(
    () => runtime.abandonExecution(second),
    (error) => error.code === 'ERR_SCHROEDER_FROZEN_REFRESH_FENCE_REQUIRED'
  );
  assert.equal(runtime.destroy(), false);
  await runtime.releaseAfterQueue(second);
  assert.equal(runtime.destroy(), true);
});

test('device loss supersedes a frozen-refresh fence without stale recycling or borrowed destruction', async () => {
  const device = createFakeDevice();
  const fixture = createFixture(device);
  const runtime = createSchroederFrozenLevelAssignmentRefreshGpu(device, {
    maxParticleCount: fixture.particleCount,
    arenaCount: 2
  });
  const execution = runtime.encode(createFakeEncoder(), {
    priorLevelAssignment: fixture.priorLevelAssignment,
    currentSphParticleUpload: fixture.currentSphParticleUpload,
    physicsSubstep: 1
  });
  runtime.markExecutionSubmitted(execution);
  const arenaBuffers = device.buffers.filter(
    (buffer) => String(buffer.label).includes('frozen-level-assignment-refresh')
      && String(buffer.label).endsWith('-0')
  );
  assert.equal(arenaBuffers.length, 2);
  const queueFence = deferred();
  const deviceLoss = deferred();
  device.lost = deviceLoss.promise;
  let queueFenceCount = 0;
  device.queue.onSubmittedWorkDone = () => {
    queueFenceCount += 1;
    return queueFence.promise;
  };

  const normalRelease = runtime.releaseAfterQueue(execution);
  const lossRelease = runtime.quarantineExecutionAfterDeviceLoss(execution);
  assert.equal(
    runtime.quarantineExecutionAfterDeviceLoss(execution),
    lossRelease
  );
  const completion = runtime.executionRetirementCompletionPromise(execution);
  assert.equal(queueFenceCount, 1);
  assert.equal(runtime.ownsExecution(execution), true);
  assert.equal(arenaBuffers.every((buffer) => !buffer.destroyed), true);

  deviceLoss.resolve({ reason: 'destroyed', message: 'injected frozen loss' });
  assert.equal(await lossRelease, true);
  assert.equal(execution.released, true);
  assert.equal(runtime.ownsExecution(execution), false);
  assert.equal(arenaBuffers.every((buffer) => buffer.destroyed), true);
  assert.equal(arenaBuffers.every((buffer) => buffer.destroyCount === 1), true);
  assert.equal(fixture.priorLevelAssignment.assignmentBuffer.destroyed, false);
  assert.equal(fixture.priorLevelAssignment.sourceStateBuffer.destroyed, false);
  assert.equal(fixture.currentSphParticleUpload.stateBuffer.destroyed, false);

  queueFence.reject(new Error('stale queue fence rejected after loss'));
  assert.equal(await normalRelease, true);
  assert.equal(
    execution.status,
    'schroeder-frozen-level-assignment-refresh-device-loss-retired'
  );
  assert.equal(runtime.quarantineExecutionAfterDeviceLoss(execution), completion);
  assert.equal(await completion, true);
  assert.throws(
    () => runtime.encode(createFakeEncoder(), {
      priorLevelAssignment: fixture.priorLevelAssignment,
      currentSphParticleUpload: fixture.currentSphParticleUpload,
      physicsSubstep: 1
    }),
    (error) => error.code === 'ERR_SCHROEDER_FROZEN_REFRESH_DEVICE_LOST'
  );
  assert.equal(runtime.destroy(), true);
  assert.equal(arenaBuffers.every((buffer) => buffer.destroyCount === 1), true);
});

test('frozen-refresh loss retry retains exact ownership after partial owned-buffer destruction', async () => {
  const device = createFakeDevice();
  const fixture = createFixture(device);
  const runtime = createSchroederFrozenLevelAssignmentRefreshGpu(device, {
    maxParticleCount: fixture.particleCount,
    arenaCount: 1
  });
  const execution = runtime.encode(createFakeEncoder(), {
    priorLevelAssignment: fixture.priorLevelAssignment,
    currentSphParticleUpload: fixture.currentSphParticleUpload,
    physicsSubstep: 1
  });
  runtime.markExecutionSubmitted(execution);
  device.lost = Promise.resolve({ reason: 'destroyed' });
  const owned = device.buffers.filter(
    (buffer) => String(buffer.label).includes('frozen-level-assignment-refresh')
  );
  const flaky = owned[0];
  const originalDestroy = flaky.destroy;
  let injected = true;
  flaky.destroy = function destroyWithOneFailure() {
    if (injected) {
      injected = false;
      this.destroyCount += 1;
      throw new Error('injected frozen arena destroy failure');
    }
    return originalDestroy.call(this);
  };
  const completion = runtime.executionRetirementCompletionPromise(execution);

  await assert.rejects(
    runtime.quarantineExecutionAfterDeviceLoss(execution),
    /injected frozen arena destroy failure/
  );
  assert.equal(runtime.ownsExecution(execution), true);
  assert.equal(execution.released, false);
  assert.equal(owned[1].destroyCount, 1);
  assert.equal(await runtime.quarantineExecutionAfterDeviceLoss(execution), true);
  assert.equal(await completion, true);
  assert.equal(flaky.destroyCount, 2);
  assert.equal(owned[1].destroyCount, 1);
  assert.equal(fixture.priorLevelAssignment.assignmentBuffer.destroyed, false);
  assert.equal(fixture.currentSphParticleUpload.stateBuffer.destroyed, false);
});

test('one observed device loss redirects every live frozen refresh without a queue call', async () => {
  const device = createFakeDevice();
  const fixture = createFixture(device);
  const runtime = createSchroederFrozenLevelAssignmentRefreshGpu(device, {
    maxParticleCount: fixture.particleCount,
    arenaCount: 2
  });
  const first = runtime.encode(createFakeEncoder(), {
    priorLevelAssignment: fixture.priorLevelAssignment,
    currentSphParticleUpload: fixture.currentSphParticleUpload,
    physicsSubstep: 1
  });
  const second = runtime.encode(createFakeEncoder(), {
    priorLevelAssignment: fixture.priorLevelAssignment,
    currentSphParticleUpload: fixture.currentSphParticleUpload,
    physicsSubstep: 1
  });
  runtime.markExecutionSubmitted(first);
  runtime.markExecutionSubmitted(second);
  const deviceLoss = deferred();
  device.lost = deviceLoss.promise;
  let queueFenceCount = 0;
  device.queue.onSubmittedWorkDone = () => {
    queueFenceCount += 1;
    throw new Error('lost device queue must not be fenced');
  };
  const firstLoss = runtime.quarantineExecutionAfterDeviceLoss(first);
  const secondLoss = runtime.releaseAfterQueue(second);
  assert.equal(queueFenceCount, 0);
  deviceLoss.resolve({ reason: 'destroyed' });
  assert.deepEqual(await Promise.all([firstLoss, secondLoss]), [true, true]);
  assert.equal(queueFenceCount, 0);
});

test('native WebGPU refresh preserves macro assignment words and replaces only substep XYZ', {
  skip: RUN_NATIVE
    ? false
    : 'set ULG_RUN_NATIVE_FROZEN_LEVEL_REFRESH=1 for native WebGPU validation',
  timeout: 120_000
}, async () => {
  const { chromium } = await import('@playwright/test');
  const browser = await chromium.launch({
    executablePath: process.env.ULG_FROZEN_LEVEL_REFRESH_CHROME
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
    await page.goto(NATIVE_BASE_URL, {
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
      const module = await import(
        `/src/runtime/sph/schroederFrozenLevelAssignmentRefreshGpu.js?native=${nonce}`
      );
      const particleCount = 2;
      const priorRows = new Float32Array(particleCount * 16);
      priorRows.set([
        0, 0.25, 0.4, 1, 1, 1, 2, 1000,
        1, 7, 1, 0.125, -1, -2, -3, 0,
        1, 0.5, 0.8, 2, 2, 2, 3, 800,
        2, 9, 5, 0.25, 4, 5, 6, 0
      ]);
      const macroState = new Float32Array(particleCount * 8);
      macroState.set([-1, -2, -3, 2, 0, 0, 0, 0], 0);
      macroState.set([4, 5, 6, 3, 0, 0, 0, 0], 8);
      const currentState = macroState.slice();
      currentState.set([10.5, -11.25, 12.75], 0);
      currentState.set([-13.5, 14.25, 15.75], 8);
      const storageBuffer = (label, data) => {
        const buffer = device.createBuffer({
          label,
          size: data.byteLength,
          usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
        });
        device.queue.writeBuffer(buffer, 0, data);
        return buffer;
      };
      const priorBuffer = storageBuffer('native-prior-assignments', priorRows);
      const macroStateBuffer = storageBuffer('native-macro-state', macroState);
      const currentStateBuffer = storageBuffer('native-current-state', currentState);
      const priorLevelAssignment = {
        schema: 'peercompute.ulg.schroeder-level-assignment-execution.v0',
        assignmentSchema: 'peercompute.ulg.schroeder-level-assignment.v0',
        status: 'schroeder-level-assignment-submitted',
        bufferFamilyGenerationStatus:
          'schroeder-particle-buffer-family-generation-ready',
        particleCount,
        assignmentStrideFloats: 16,
        assignmentStrideBytes: 64,
        assignmentBuffer: priorBuffer,
        assignmentBufferByteLength: priorRows.byteLength,
        sourceStateBuffer: macroStateBuffer,
        sourceStateBufferBorrowed: true,
        storageGeneration: 7,
        physicsTick: 11,
        physicsSubstep: 0,
        positionEpoch: 13,
        topologyEpoch: 17,
        chartEpoch: 19,
        levelEpoch: 23,
        supportEpoch: 29,
        minLevel: 0,
        maxLevel: 1,
        chartId: 0,
        baseGridSpacingM: 0.25
      };
      const currentSphParticleUpload = {
        schema: 'peercompute.ulg.sph-gpu-particle-buffer-set.v0',
        status: 'webgpu-uploaded',
        particleCount,
        storageGeneration: 8,
        bufferFamilyGeneration: 8,
        positionEpoch: 14,
        topologyEpoch: 17,
        chartEpoch: 19,
        stateStrideBytes: 32,
        stateBufferByteLength: currentState.byteLength,
        stateBuffer: currentStateBuffer
      };
      const runtime = module.createSchroederFrozenLevelAssignmentRefreshGpu(device, {
        maxParticleCount: particleCount,
        arenaCount: 1
      });
      const encoder = device.createCommandEncoder();
      const execution = runtime.encode(encoder, {
        priorLevelAssignment,
        currentSphParticleUpload,
        physicsSubstep: 1
      });
      device.queue.submit([encoder.finish()]);
      runtime.markExecutionSubmitted(execution);

      const readback = device.createBuffer({
        label: 'native-frozen-refresh-readback',
        size: priorRows.byteLength,
        usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
      });
      const readEncoder = device.createCommandEncoder();
      readEncoder.copyBufferToBuffer(
        execution.assignmentBuffer,
        0,
        readback,
        0,
        priorRows.byteLength
      );
      device.queue.submit([readEncoder.finish()]);
      await readback.mapAsync(GPUMapMode.READ);
      const outputWords = Array.from(new Uint32Array(readback.getMappedRange()).slice());
      readback.unmap();
      const validationError = await device.popErrorScope();
      await new Promise((resolve) => setTimeout(resolve, 50));
      await runtime.releaseAfterQueue(execution);
      runtime.destroy();
      readback.destroy();
      priorBuffer.destroy();
      macroStateBuffer.destroy();
      currentStateBuffer.destroy();
      return {
        status: 'complete',
        outputWords,
        priorWords: Array.from(new Uint32Array(priorRows.buffer)),
        stateWords: Array.from(new Uint32Array(currentState.buffer)),
        provenance: {
          physicsSubstep: execution.physicsSubstep,
          positionEpoch: execution.positionEpoch,
          levelEpoch: execution.levelEpoch,
          supportEpoch: execution.supportEpoch,
          reclassified: execution.levelReclassificationPerformed
        },
        validationError: validationError?.message || null,
        uncapturedErrors
      };
    });
  } finally {
    await browser.close();
  }

  assert.equal(native.status, 'complete', native.reason || 'native WebGPU did not run');
  for (let particle = 0; particle < 2; particle += 1) {
    for (let word = 0; word < 16; word += 1) {
      const outputIndex = particle * 16 + word;
      const expected = word >= 12 && word <= 14
        ? native.stateWords[particle * 8 + word - 12]
        : native.priorWords[outputIndex];
      assert.equal(native.outputWords[outputIndex], expected);
    }
  }
  assert.deepEqual(native.provenance, {
    physicsSubstep: 1,
    positionEpoch: 14,
    levelEpoch: 23,
    supportEpoch: 29,
    reclassified: false
  });
  assert.equal(native.validationError, null);
  assert.deepEqual(native.uncapturedErrors, []);
});
