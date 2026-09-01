import assert from 'node:assert/strict';
import test from 'node:test';

import {
  ULG_RESIDENT_RENDER_CANDIDATE_SCHEMA
} from '../src/visualization/residentRenderCandidateMailbox.js';
import {
  RESIDENT_SPH_STORAGE_BUFFERS_PER_STAGE
} from '../src/runtime/webgpuDeviceLimits.js';

// The offscreen presentation worker is a module worker script: it has no DOM
// dependency at import time but binds `self.onmessage` and posts through
// `self.postMessage`. Shim a worker-global BEFORE importing so the module's
// exported handlers (the W3 test seams) can be driven directly in node with a
// fake WebGPU device — no browser, no GPU.
const postedMessages = [];
const fakeGpuRecords = {
  shaderModules: [],
  renderPipelines: [],
  computePipelines: [],
  textures: [],
  renderPasses: [],
  computePasses: [],
  draws: [],
  submits: [],
  writes: []
};
const fakeSelf = {
  onmessage: null,
  postMessage(data) {
    postedMessages.push(data);
  },
  performance: { now: () => Date.now() },
  GPUBufferUsage: { COPY_DST: 0x08, UNIFORM: 0x40, STORAGE: 0x80 },
  GPUTextureUsage: { RENDER_ATTACHMENT: 0x10 },
  GPUShaderStage: { VERTEX: 0x1, FRAGMENT: 0x2, COMPUTE: 0x4 },
  GPUColorWrite: { ALL: 0xF },
  navigator: {}
};
globalThis.self = fakeSelf;

const workerModule = await import('../src/services/ulgOffscreenRender.worker.js');

const fakeDevice = {
  createShaderModule(descriptor) {
    const module = { descriptor, label: descriptor?.label ?? null };
    fakeGpuRecords.shaderModules.push(module);
    return module;
  },
  createBindGroupLayout: (descriptor) => ({ descriptor }),
  createPipelineLayout: (descriptor) => ({ descriptor }),
  createRenderPipeline(descriptor) {
    const pipeline = { descriptor, label: descriptor?.label ?? null };
    fakeGpuRecords.renderPipelines.push(pipeline);
    return pipeline;
  },
  createComputePipeline(descriptor) {
    const pipeline = { descriptor, label: descriptor?.label ?? null };
    fakeGpuRecords.computePipelines.push(pipeline);
    return pipeline;
  },
  createBuffer(descriptor) {
    return {
      descriptor,
      label: descriptor?.label ?? null,
      size: descriptor?.size ?? 0,
      destroyed: false,
      destroy() { this.destroyed = true; }
    };
  },
  createTexture(descriptor) {
    const texture = {
      descriptor,
      label: descriptor?.label ?? null,
      destroyed: false,
      createView: () => ({ texture }),
      destroy() { this.destroyed = true; }
    };
    fakeGpuRecords.textures.push(texture);
    return texture;
  },
  createBindGroup: (descriptor) => ({ descriptor }),
  createCommandEncoder(descriptor = {}) {
    const encoded = { descriptor, renderPasses: [], computePasses: [] };
    return {
      beginComputePass(passDescriptor = {}) {
        let activePipeline = null;
        const record = { descriptor: passDescriptor, dispatches: [] };
        encoded.computePasses.push(record);
        fakeGpuRecords.computePasses.push(record);
        return {
          setPipeline(pipeline) { activePipeline = pipeline; },
          setBindGroup() {},
          dispatchWorkgroups(...args) {
            record.dispatches.push({ pipeline: activePipeline, args });
          },
          end() {}
        };
      },
      beginRenderPass(passDescriptor = {}) {
        let activePipeline = null;
        const record = { descriptor: passDescriptor, draws: [] };
        encoded.renderPasses.push(record);
        fakeGpuRecords.renderPasses.push(record);
        return {
          setPipeline(pipeline) { activePipeline = pipeline; },
          setBindGroup() {},
          draw(...args) {
            const draw = { pipeline: activePipeline, args, pass: record };
            record.draws.push(draw);
            fakeGpuRecords.draws.push(draw);
          },
          end() {}
        };
      },
      finish: () => encoded
    };
  },
  queue: {
    submit(commandBuffers) { fakeGpuRecords.submits.push(commandBuffers); },
    writeBuffer(...args) { fakeGpuRecords.writes.push(args); }
  },
  lost: new Promise(() => {})
};
let fakeCanvasConfigureCount = 0;
let fakeCanvasUnconfigureCount = 0;
const fakeCanvasContext = {
  configure() {
    fakeCanvasConfigureCount += 1;
  },
  unconfigure() {
    fakeCanvasUnconfigureCount += 1;
  },
  getCurrentTexture: () => ({ createView: () => ({}) })
};
const fakeCanvas = {
  width: 0,
  height: 0,
  getContext: (kind) => (kind === 'webgpu' ? fakeCanvasContext : null)
};
let requestedDeviceDescriptor = null;
fakeSelf.navigator = {
  gpu: {
    requestAdapter: async () => ({
      requestDevice: async (descriptor) => {
        requestedDeviceDescriptor = descriptor;
        return fakeDevice;
      }
    }),
    getPreferredCanvasFormat: () => 'bgra8unorm'
  }
};

function candidateMessages() {
  return postedMessages.filter((message) => message?.type === 'resident-schedule-candidate');
}

function residentStageStatuses() {
  return postedMessages
    .map((message) => message?.workerOffscreenResidentStage)
    .filter(Boolean);
}

async function flushUntil(predicate, { tries = 50 } = {}) {
  for (let attempt = 0; attempt < tries; attempt += 1) {
    if (predicate()) return true;
    await new Promise((resolve) => setImmediate(resolve));
  }
  return predicate();
}

async function ensureFakePresentationReady() {
  if (postedMessages.some(
    (message) => message?.status === 'worker-offscreen-presentation-ready'
  )) return;
  fakeSelf.onmessage({
    data: {
      type: 'init-offscreen-presentation',
      canvas: fakeCanvas,
      width: 8,
      height: 8,
      cssWidth: 8,
      cssHeight: 8,
      pixelRatio: 1,
      backgroundColor: '#000000',
      clearAlpha: 0
    }
  });
  const ready = await flushUntil(() => postedMessages.some(
    (message) => message?.status === 'worker-offscreen-presentation-ready'
  ));
  assert.equal(ready, true, 'presentation worker never reported ready on the fake device');
}

function scheduleEpochIdentity(stepOrdinal, { storageGeneration = 7 } = {}) {
  return {
    storageGeneration,
    physicsTick: 100 + stepOrdinal,
    physicsSubstep: 0,
    positionEpoch: 200 + stepOrdinal,
    topologyEpoch: 2,
    chartEpoch: 3,
    levelEpoch: 1,
    supportEpoch: 1
  };
}

// Same deep-walk pattern as tests/ulgMechanicsResidentStageWorker.test.mjs
// (assertNoWorkerGpuBuffers) followed by an actual structuredClone.
function assertCloneableOnly(value, path = 'candidate', seen = new Set()) {
  if (value == null || typeof value !== 'object') return;
  if (seen.has(value)) return;
  seen.add(value);
  const bufferLike = typeof value.mapAsync === 'function'
    || typeof value.getMappedRange === 'function'
    || value.constructor?.name === 'GPUBuffer'
    || value.constructor?.name === 'FakeGpuBuffer';
  assert.equal(bufferLike, false, `GPU buffer leaked into candidate at ${path}`);
  if (ArrayBuffer.isView(value) || value instanceof ArrayBuffer) return;
  for (const [key, entry] of Object.entries(value)) {
    assert.notEqual(typeof entry, 'function', `function leaked at ${path}.${key}`);
    assertCloneableOnly(entry, `${path}.${key}`, seen);
  }
}

test('presentation worker schedule verb fails closed before the WebGPU device exists', async () => {
  await workerModule.runResidentScheduleOnPresentationDevice({
    payload: { schedule: { stepCount: 2 } }
  });
  const status = residentStageStatuses().at(-1);
  assert.equal(
    status.status,
    'worker-offscreen-resident-schedule-on-presentation-device-blocked-webgpu-unavailable'
  );
  assert.equal(status.workerDeviceProvided, false);
  assert.equal(candidateMessages().length, 0);
});

test('presentation worker initializes on a synthetic WebGPU device through the message path', async () => {
  assert.equal(typeof fakeSelf.onmessage, 'function');
  await ensureFakePresentationReady();
  assert.equal(
    requestedDeviceDescriptor?.requiredLimits?.maxStorageBuffersPerShaderStage,
    RESIDENT_SPH_STORAGE_BUFFERS_PER_STAGE,
    'presentation-owned physics must request the resident solver storage-buffer limit'
  );
});

test('presentation worker reuses an unchanged canvas configuration and reconfigures only on resize', async () => {
  await ensureFakePresentationReady();
  const configureCountAfterInit = fakeCanvasConfigureCount;
  assert.equal(configureCountAfterInit, 1);

  const messagesBeforeSameSize = postedMessages.length;
  fakeSelf.onmessage({
    data: {
      type: 'resize',
      width: 8,
      height: 8,
      cssWidth: 8,
      cssHeight: 8,
      pixelRatio: 1,
      reason: 'test-same-size-resize'
    }
  });
  const sameSizeReady = await flushUntil(() => postedMessages
    .slice(messagesBeforeSameSize)
    .some((message) => message?.reason === 'test-same-size-resize'));
  assert.equal(sameSizeReady, true);
  assert.equal(fakeCanvasConfigureCount, configureCountAfterInit);
  const sameSizeReceipt = postedMessages.findLast(
    (message) => message?.reason === 'test-same-size-resize'
  );
  assert.equal(sameSizeReceipt.canvasConfigureCount, configureCountAfterInit);
  assert.equal(sameSizeReceipt.canvasConfigureSkipCount, 1);

  const messagesBeforeRealResize = postedMessages.length;
  fakeSelf.onmessage({
    data: {
      type: 'resize',
      width: 16,
      height: 12,
      cssWidth: 16,
      cssHeight: 12,
      pixelRatio: 1,
      reason: 'test-backing-size-resize'
    }
  });
  const resizedReady = await flushUntil(() => postedMessages
    .slice(messagesBeforeRealResize)
    .some((message) => message?.reason === 'test-backing-size-resize'));
  assert.equal(resizedReady, true);
  assert.equal(fakeCanvasConfigureCount, configureCountAfterInit + 1);
  assert.equal(fakeCanvas.width, 16);
  assert.equal(fakeCanvas.height, 12);
  const resizedReceipt = postedMessages.findLast(
    (message) => message?.reason === 'test-backing-size-resize'
  );
  assert.equal(resizedReceipt.canvasConfigureCount, configureCountAfterInit + 1);
  assert.equal(resizedReceipt.canvasConfigureSkipCount, 1);

  const messagesBeforeCandidate = postedMessages.length;
  fakeSelf.onmessage({
    data: {
      type: 'draw-resident-particle-state-producer',
      width: 16,
      height: 12,
      cssWidth: 16,
      cssHeight: 12,
      pixelRatio: 1,
      particleCount: 0,
      reason: 'test-empty-resident-candidate'
    }
  });
  const candidateSkipped = await flushUntil(() => postedMessages
    .slice(messagesBeforeCandidate)
    .some((message) => message?.workerOffscreenRenderRows?.status
      === 'worker-offscreen-resident-particle-state-producer-skipped-empty'));
  assert.equal(candidateSkipped, true);
  assert.equal(fakeCanvasConfigureCount, configureCountAfterInit + 1);
  const candidateReceipt = postedMessages.findLast(
    (message) => message?.workerOffscreenRenderRows?.status
      === 'worker-offscreen-resident-particle-state-producer-skipped-empty'
  );
  assert.equal(candidateReceipt.canvasConfigureSkipCount, 2);
  assert.equal(candidateReceipt.lastCanvasConfigureAction, 'reused');
  assert.equal(
    candidateReceipt.lastCanvasConfigureReason,
    'draw-resident-particle-state-producer'
  );
});

test('presentation worker schedule verb injects its own device, drives the W2 schedule driver, and emits versioned candidates', async () => {
  await ensureFakePresentationReady();
  const candidateCountBefore = candidateMessages().length;
  const statsBefore = workerModule.presentationResidentScheduleCandidateMailbox.stats();
  let capturedPayload = null;
  let capturedId = null;
  const fakeRunner = {
    async runUlgMechanicsResidentStageWorkerSchedulePayload(payload, { id, postProgress }) {
      capturedPayload = payload;
      capturedId = id;
      for (let stepOrdinal = 1; stepOrdinal <= 3; stepOrdinal += 1) {
        postProgress({
          schema: 'peercompute.ulg.worker-resident-schedule-progress.v0',
          scheduleId: 'ulg:test:sched-candidates',
          completedStepCount: stepOrdinal,
          stepOrdinal,
          epochIdentity: scheduleEpochIdentity(stepOrdinal),
          stepSummary: {
            schema: 'peercompute.ulg.worker-resident-schedule-step-summary.v0',
            scheduleId: 'ulg:test:sched-candidates',
            stepOrdinal,
            particleCount: 2,
            retainedBufferRefs: [`ulg-worker:test:state:${stepOrdinal}`]
          }
        });
      }
      return {
        schema: 'peercompute.ulg.worker-resident-schedule-result.v0',
        status: 'worker-resident-schedule-completed',
        scheduleId: 'ulg:test:sched-candidates',
        laneId: 'ulg:test:lane',
        stateKey: 'ulg:test:state',
        requestedStepCount: 3,
        completedStepCount: 3,
        cancelled: false,
        retainedBufferRefs: ['ulg-worker:test:state:3'],
        finalEpochIdentity: scheduleEpochIdentity(3),
        perStepSummaries: {
          lastStep: {
            schema: 'peercompute.ulg.worker-resident-schedule-step-summary.v0',
            stepOrdinal: 3
          }
        },
        gpuFence: { fenceSatisfied: true }
      };
    }
  };

  await workerModule.runResidentScheduleOnPresentationDevice(
    {
      id: 'ulg:test:message-1',
      payload: {
        schedule: { stepCount: 3, scheduleId: 'ulg:test:sched-candidates' },
        lease: { laneId: 'ulg:test:lane', stateKey: 'ulg:test:state' }
      }
    },
    { runnerModuleOverride: fakeRunner }
  );

  // Device injection mirrors the single-stage verb exactly.
  assert.equal(capturedId, 'ulg:test:message-1');
  const injectedContext = capturedPayload.context.ulgMechanicsResidentStageWorker;
  assert.equal(injectedContext.preferWebGpu, true);
  assert.equal(injectedContext.common.sameWorkerQueueFenceFallback, true);
  assert.equal(injectedContext.common.deviceResult.device, fakeDevice);
  assert.equal(injectedContext.common.deviceResult.workerDeviceProvided, true);
  assert.equal(
    injectedContext.common.deviceResult.workerDeviceSource,
    'offscreen-presentation-worker-device'
  );
  assert.equal(
    injectedContext.common.deviceResult.status,
    'webgpu-ready-presentation-worker-device'
  );
  assert.equal(capturedPayload.lease.laneId, 'ulg:test:lane');

  // Status envelopes mirror the single-stage verb lifecycle.
  const statuses = residentStageStatuses().map((entry) => entry.status);
  assert.ok(statuses.includes(
    'worker-offscreen-resident-schedule-on-presentation-device-started'
  ));
  assert.ok(statuses.includes(
    'worker-offscreen-resident-schedule-on-presentation-device-completed'
  ));

  // One bridge candidate message per progress envelope AND one for the
  // terminal result.
  const candidates = candidateMessages().slice(candidateCountBefore);
  assert.equal(candidates.length, 4);
  candidates.forEach((message, index) => {
    const candidate = message.candidate;
    assert.equal(candidate.schema, ULG_RESIDENT_RENDER_CANDIDATE_SCHEMA);
    assert.equal(candidate.version.scheduleId, 'ulg:test:sched-candidates');
    // Version mapping: residentExecutionGeneration := storageGeneration,
    // nextStep := physicsTick (strictly advancing per the W2 driver's
    // epoch-identity seal).
    assert.equal(candidate.version.residentExecutionGeneration, 7);
    const stepOrdinal = Math.min(index + 1, 3);
    assert.equal(candidate.version.nextStep, 100 + stepOrdinal);
    assert.equal(candidate.version.stepOrdinal, stepOrdinal);
    assert.equal(candidate.epochIdentity.physicsTick, 100 + stepOrdinal);
    assert.equal(candidate.epochIdentity.positionEpoch, 200 + stepOrdinal);
    assertCloneableOnly(candidate, `candidate[${index}]`);
    structuredClone(candidate);
  });
  // The terminal candidate duplicates the last progress candidate's version.
  assert.deepEqual(
    { ...candidates[3].candidate.version },
    { ...candidates[2].candidate.version }
  );

  // Worker-local mailbox: three accepted progress candidates; the terminal
  // duplicate is truthfully dropped and counted, never reordered forward.
  const stats = workerModule.presentationResidentScheduleCandidateMailbox.stats();
  assert.equal(stats.publishedCount - statsBefore.publishedCount, 3);
  assert.equal(stats.droppedStaleCount - statsBefore.droppedStaleCount, 1);
  assert.equal(stats.latestVersion.residentExecutionGeneration, 7);
  assert.equal(stats.latestVersion.nextStep, 103);
  const latest = workerModule.presentationResidentScheduleCandidateMailbox.peekLatest();
  assert.equal(latest.version.stepOrdinal, 3);
  assert.ok(Object.isFrozen(latest));
});

test('resident schedule candidates stay telemetry-only until exact committed admission', async () => {
  await ensureFakePresentationReady();
  let retainedResolveCount = 0;
  let retainedResolveArgs = null;
  const terminalFence = {
    required: true,
    scope: 'resident-schedule-terminal',
    terminalScheduleFence: true,
    fenceSatisfied: true,
    authorityAdmissionReady: true,
    scheduleId: 'ulg:test:sched-committed-draw',
    laneId: 'ulg:test:lane-committed-draw',
    stateKey: 'ulg:test:state-committed-draw',
    completedStepCount: 1,
    queueCompletionStatus: 'queue-work-completed',
    queueCompletionMethod: 'worker-device.queue.onSubmittedWorkDone'
  };
  const fakeBuffer = { mapAsync() {} };
  const fakeRunner = {
    async runUlgMechanicsResidentStageWorkerSchedulePayload(_payload, { postProgress }) {
      postProgress({
        scheduleId: 'ulg:test:sched-committed-draw',
        stepOrdinal: 1,
        epochIdentity: scheduleEpochIdentity(1, { storageGeneration: 8 }),
        stepSummary: {
          particleCount: 1,
          retainedBufferRefs: ['retained:committed-draw']
        }
      });
      return {
        schema: 'peercompute.ulg.worker-resident-schedule-result.v0',
        status: 'worker-resident-schedule-completed',
        scheduleId: 'ulg:test:sched-committed-draw',
        laneId: 'ulg:test:lane-committed-draw',
        stateKey: 'ulg:test:state-committed-draw',
        requestedStepCount: 1,
        completedStepCount: 1,
        cancelled: false,
        retainedBufferRefs: ['retained:committed-draw'],
        finalEpochIdentity: scheduleEpochIdentity(1, { storageGeneration: 8 }),
        perStepSummaries: {
          lastStep: { stepOrdinal: 1, particleCount: 2 }
        },
        gpuFence: terminalFence
      };
    },
    resolveUlgMechanicsResidentStageWorkerRetainedParticleState(args) {
      retainedResolveCount += 1;
      retainedResolveArgs = args;
      return {
        status: 'worker-retained-particle-state-ready',
        sourceStateBuffer: fakeBuffer,
        sourceThermoBuffer: fakeBuffer,
        particleCount: 2,
        stateStrideFloats: 8,
        thermoStrideFloats: 12,
        stateBufferByteLength: 64,
        thermoBufferByteLength: 96
      };
    }
  };
  const retainedRenderRequest = {
    enabled: true,
    sourceStageId: 'schroederSameLevelMechanics',
    particleCount: 1,
    stateStrideFloats: 8,
    thermoStrideFloats: 12,
    stateByteLength: 32,
    thermoByteLength: 48,
    colorRowCount: 1,
    colorRowsByteLength: 32,
    materialColorRows: new Float32Array(8),
    viewProjectionMatrix: new Float32Array(16),
    boxDimsM: [12, 8, 6],
    width: 8,
    height: 8,
    cssWidth: 8,
    cssHeight: 8,
    pixelRatio: 1
  };
  await workerModule.runResidentScheduleOnPresentationDevice(
    {
      payload: {
        schedule: {
          scheduleId: 'ulg:test:sched-committed-draw',
          stepCount: 1
        },
        lease: {
          laneId: 'ulg:test:lane-committed-draw',
          stateKey: 'ulg:test:state-committed-draw'
        },
        context: {
          ulgMechanicsResidentStageWorker: {
            common: {
              presentationWorkerRenderRetainedStageOutput:
                retainedRenderRequest
            }
          }
        }
      }
    },
    { runnerModuleOverride: fakeRunner }
  );
  assert.equal(
    retainedResolveCount,
    0,
    'progress and terminal candidate telemetry must not resolve/draw retained buffers'
  );
  let noRenderScheduleCallCount = 0;
  await workerModule.runResidentScheduleOnPresentationDevice(
    {
      payload: {
        schedule: { scheduleId: 'ulg:test:must-not-run', stepCount: 1 },
        lease: {
          laneId: 'ulg:test:other-lane',
          stateKey: 'ulg:test:other-state'
        }
      }
    },
    {
      runnerModuleOverride: {
        async runUlgMechanicsResidentStageWorkerSchedulePayload() {
          noRenderScheduleCallCount += 1;
          return {};
        }
      }
    }
  );
  assert.equal(noRenderScheduleCallCount, 0);
  assert.equal(
    residentStageStatuses().at(-1).status,
    'worker-offscreen-resident-schedule-on-presentation-device-blocked-pending-committed-presentation'
  );
  assert.ok(
    workerModule.presentationResidentScheduleCandidateMailbox.takeLatest(),
    'telemetry mailbox should contain the schedule candidate before admission'
  );

  const exactAdmission = {
    schema:
      'peercompute.ulg.presentation-worker-committed-resident-schedule-presentation.v0',
    status:
      'state-manager-committed-resident-schedule-presentation-admission',
    scheduleId: 'ulg:test:sched-committed-draw',
    laneId: 'ulg:test:lane-committed-draw',
    stateKey: 'ulg:test:state-committed-draw',
    candidateVersion: {
      residentExecutionGeneration: 8,
      nextStep: 101,
      scheduleId: 'ulg:test:sched-committed-draw',
      stepOrdinal: 1
    },
    authority: {
      status: 'state-manager-committed-worker-schedule',
      computeManagerCompletionSchema:
        'peercompute.ulg.schroeder-worker-lane-compute-manager-completion.v0',
      computeManagerLeaseId: 'lease:committed-draw',
      computeManagerLeaseStatus: 'completed',
      computeManagerFenceSatisfied: true,
      stateManagerCommitStatus: 'committed',
      stateManagerCommitAccepted: true
    },
    terminalFence
  };
  const wrongAdmission = workerModule.presentCommittedResidentScheduleCandidate({
    ...exactAdmission,
    scheduleId: 'ulg:test:wrong-schedule'
  });
  assert.equal(
    wrongAdmission.status,
    'worker-offscreen-committed-resident-schedule-presentation-blocked'
  );
  assert.equal(retainedResolveCount, 0);

  // Arm the camera-redraw closure only after the schedule has finished, so
  // the telemetry-only assertions above still prove that uncommitted
  // progress cannot resolve retained buffers.
  retainedRenderRequest.residentScheduleLivePreview = true;
  const admitted = workerModule.presentCommittedResidentScheduleCandidate(
    exactAdmission
  );
  assert.equal(retainedResolveCount, 1);
  assert.deepEqual(retainedResolveArgs, {
    laneId: 'ulg:test:lane-committed-draw',
    stateKey: 'ulg:test:state-committed-draw',
    sourceStageId: 'schroederSameLevelMechanics'
  });
  assert.equal(
    admitted.status,
    'worker-offscreen-resident-particle-state-producer-rendered'
  );
  assert.equal(admitted.stateManagerCommittedPresentation, true);
  assert.equal(admitted.scheduleId, 'ulg:test:sched-committed-draw');
  assert.equal(admitted.stepOrdinal, 1);
  assert.equal(admitted.presentationGeometry, 'sphere-impostor-depth-fallback');
  assert.equal(admitted.particleImpostorShape, 'projective-circular-lit-disc');
  assert.equal(admitted.projectiveParticleSizing, true);
  assert.equal(admitted.depthAttachmentFormat, 'depth24plus');
  assert.equal(admitted.depthAttachmentReady, true);
  assert.equal(admitted.condensedDepthWriteEnabled, true);
  assert.equal(admitted.vaporDepthWriteEnabled, false);
  assert.equal(admitted.boxWireframeDrawCount, 1);
  assert.deepEqual(admitted.boxDimsM, [12, 8, 6]);

  const condensedPipeline = fakeGpuRecords.renderPipelines.find(
    (pipeline) => pipeline.label === 'ulg-offscreen-condensed-sphere-impostor-pipeline'
  );
  const vaporPipeline = fakeGpuRecords.renderPipelines.find(
    (pipeline) => pipeline.label === 'ulg-offscreen-vapor-sphere-impostor-pipeline'
  );
  const boxPipeline = fakeGpuRecords.renderPipelines.find(
    (pipeline) => pipeline.label === 'ulg-offscreen-presentation-box-wireframe-pipeline'
  );
  assert.deepEqual(condensedPipeline?.descriptor?.depthStencil, {
    format: 'depth24plus',
    depthWriteEnabled: true,
    depthCompare: 'less-equal'
  });
  assert.deepEqual(vaporPipeline?.descriptor?.depthStencil, {
    format: 'depth24plus',
    depthWriteEnabled: false,
    depthCompare: 'less-equal'
  });
  assert.equal(boxPipeline?.descriptor?.primitive?.topology, 'line-list');
  assert.equal(boxPipeline?.descriptor?.depthStencil?.depthWriteEnabled, false);
  const particleRenderPass = fakeGpuRecords.renderPasses.findLast(
    (pass) => pass.draws.some((draw) => draw.pipeline === condensedPipeline)
  );
  assert.equal(particleRenderPass?.descriptor?.depthStencilAttachment?.depthClearValue, 1);
  assert.equal(particleRenderPass?.descriptor?.depthStencilAttachment?.depthStoreOp, 'discard');
  assert.ok(particleRenderPass.draws.some(
    (draw) => draw.pipeline === condensedPipeline && draw.args[0] === 6 && draw.args[1] === 2
  ));
  assert.ok(particleRenderPass.draws.some(
    (draw) => draw.pipeline === vaporPipeline && draw.args[0] === 6 && draw.args[1] === 2
  ));
  assert.ok(particleRenderPass.draws.some(
    (draw) => draw.pipeline === boxPipeline && draw.args[0] === 24
  ));
  const impostorShader = fakeGpuRecords.shaderModules.find(
    (module) => module.label === 'ulg-offscreen-projective-sphere-impostor-shader'
  )?.descriptor?.code;
  const producerShader = fakeGpuRecords.shaderModules.find(
    (module) => module.label === 'ulg-offscreen-resident-particle-state-producer-shader'
  )?.descriptor?.code;
  assert.match(impostorShader, /radiusSquared > 1\.0/);
  assert.match(impostorShader, /fn projectiveRadiusPx/);
  assert.match(impostorShader, /fn vsCondensed/);
  assert.match(impostorShader, /fn vsVapor/);
  assert.match(producerShader, /let signedRadiusM = select/);
  assert.match(producerShader, /let vaporLike = abs\(phaseId - 3\.0\) < 0\.5/);
  assert.deepEqual(
    [1, 2, 3, 4].map((phaseId) => Math.abs(phaseId - 3) < 0.5),
    [false, false, true, false],
    'only gas phase 3 belongs to the non-depth-writing vapor pass'
  );

  const messagesBeforeResize = postedMessages.length;
  fakeSelf.onmessage({
    data: {
      type: 'resize',
      width: 29,
      height: 17,
      cssWidth: 29,
      cssHeight: 17,
      pixelRatio: 1,
      reason: 'test-live-preview-resize'
    }
  });
  assert.equal(await flushUntil(() => postedMessages
    .slice(messagesBeforeResize)
    .some((message) => message?.reason === 'test-live-preview-resize')), true);
  const messagesBeforeCameraRedraw = postedMessages.length;
  fakeSelf.onmessage({
    data: {
      type: 'update-preview-view-projection',
      viewProjectionMatrix: new Float32Array(16),
      reason: 'test-live-preview-camera-after-resize'
    }
  });
  assert.equal(await flushUntil(() => postedMessages
    .slice(messagesBeforeCameraRedraw)
    .some((message) => (
      message?.workerOffscreenRenderRows?.status
        === 'worker-offscreen-resident-particle-state-producer-rendered'
      && message.workerOffscreenRenderRows.frameCount > admitted.frameCount
    ))), true, 'camera update did not redraw the retained preview');
  const resizedCameraReceipt = postedMessages
    .slice(messagesBeforeCameraRedraw)
    .map((message) => message?.workerOffscreenRenderRows)
    .findLast((receipt) => receipt?.status
      === 'worker-offscreen-resident-particle-state-producer-rendered');
  assert.equal(resizedCameraReceipt.canvasWidth, 29);
  assert.equal(resizedCameraReceipt.canvasHeight, 17);
  assert.equal(fakeCanvas.width, 29);
  assert.equal(fakeCanvas.height, 17);
  assert.equal(retainedResolveCount, 2, 'camera redraw should resolve the retained source once');

  const replay = workerModule.presentCommittedResidentScheduleCandidate(
    exactAdmission
  );
  assert.equal(
    replay.status,
    'worker-offscreen-committed-resident-schedule-presentation-blocked'
  );
  assert.equal(retainedResolveCount, 2, 'replayed admission must not add another retained draw');

  const nextTerminalFence = {
    ...terminalFence,
    scheduleId: 'ulg:test:sched-committed-draw-next-lane',
    laneId: 'ulg:test:lane-committed-draw-next',
    stateKey: 'ulg:test:state-committed-draw-next'
  };
  const nextLaneRunner = {
    ...fakeRunner,
    async runUlgMechanicsResidentStageWorkerSchedulePayload(_payload, { postProgress }) {
      const epochIdentity = scheduleEpochIdentity(1, { storageGeneration: 8 });
      postProgress({
        scheduleId: 'ulg:test:sched-committed-draw-next-lane',
        stepOrdinal: 1,
        epochIdentity,
        stepSummary: { particleCount: 2 }
      });
      return {
        schema: 'peercompute.ulg.worker-resident-schedule-result.v0',
        status: 'worker-resident-schedule-completed',
        scheduleId: 'ulg:test:sched-committed-draw-next-lane',
        laneId: 'ulg:test:lane-committed-draw-next',
        stateKey: 'ulg:test:state-committed-draw-next',
        requestedStepCount: 1,
        completedStepCount: 1,
        cancelled: false,
        finalEpochIdentity: epochIdentity,
        perStepSummaries: { lastStep: { particleCount: 2 } },
        retainedBufferRefs: ['retained:next-lane'],
        gpuFence: nextTerminalFence
      };
    }
  };
  await workerModule.runResidentScheduleOnPresentationDevice(
    {
      payload: {
        schedule: {
          scheduleId: 'ulg:test:sched-committed-draw-next-lane',
          stepCount: 1
        },
        lease: {
          laneId: 'ulg:test:lane-committed-draw-next',
          stateKey: 'ulg:test:state-committed-draw-next'
        },
        context: {
          ulgMechanicsResidentStageWorker: {
            common: {
              presentationWorkerRenderRetainedStageOutput: {
                enabled: true,
                sourceStageId: 'schroederSameLevelMechanics',
                particleCount: 1,
                stateStrideFloats: 8,
                thermoStrideFloats: 12,
                stateByteLength: 32,
                thermoByteLength: 48,
                colorRowCount: 1,
                colorRowsByteLength: 32,
                materialColorRows: new Float32Array(8),
                viewProjectionMatrix: new Float32Array(16),
                boxDimsM: [12, 8, 6]
              }
            }
          }
        }
      }
    },
    { runnerModuleOverride: nextLaneRunner }
  );
  assert.equal(
    workerModule.presentCommittedResidentScheduleCandidate(exactAdmission).status,
    'worker-offscreen-committed-resident-schedule-presentation-blocked'
  );
  const nextAdmission = {
    ...exactAdmission,
    scheduleId: 'ulg:test:sched-committed-draw-next-lane',
    laneId: 'ulg:test:lane-committed-draw-next',
    stateKey: 'ulg:test:state-committed-draw-next',
    candidateVersion: {
      ...exactAdmission.candidateVersion,
      scheduleId: 'ulg:test:sched-committed-draw-next-lane'
    },
    terminalFence: nextTerminalFence
  };
  workerModule.presentCommittedResidentScheduleCandidate(nextAdmission);
  assert.equal(retainedResolveCount, 3);

});

test('exact rendered terminal preview promotes to committed authority without redraw', () => {
  const version = {
    residentExecutionGeneration: 9,
    nextStep: 101,
    scheduleId: 'ulg:test:sched-terminal-preview-promotion',
    stepOrdinal: 1
  };
  const candidate = {
    scheduleId: version.scheduleId,
    laneId: 'ulg:test:lane-terminal-preview-promotion',
    stateKey: 'ulg:test:state-terminal-preview-promotion',
    version
  };
  const admission = {
    schema:
      'peercompute.ulg.presentation-worker-committed-resident-schedule-presentation.v0',
    status:
      'state-manager-committed-resident-schedule-presentation-admission',
    scheduleId: candidate.scheduleId,
    laneId: candidate.laneId,
    stateKey: candidate.stateKey,
    candidateVersion: version
  };
  const renderedPreview = {
    status: 'worker-offscreen-resident-particle-state-producer-rendered',
    stateManagerCommittedPresentation: false,
    residentSchedulePresentationMode: 'uncommitted-live-preview',
    workerLocalRenderRowsProduced: true,
    presentationGeometry: 'sphere-impostor-depth-fallback',
    depthAttachmentFormat: 'depth24plus',
    depthAttachmentReady: true,
    boxWireframeDrawCount: 1,
    boxDimsM: [12, 8, 6]
  };
  const promoted = workerModule.resolveCommittedResidentSchedulePreviewPromotion({
    admission,
    candidate,
    lastDrawnCandidate: candidate,
    lastDrawnStatus: renderedPreview,
    reason: 'test-terminal-preview-promotion'
  });
  assert.equal(promoted.stateManagerCommittedPresentation, true);
  assert.equal(promoted.committedPresentationPromotedWithoutRedraw, true);
  assert.equal(
    promoted.residentSchedulePresentationMode,
    'committed-terminal-live-preview-promotion'
  );
  assert.equal(promoted.presentationGeometry, 'sphere-impostor-depth-fallback');
  assert.equal(promoted.depthAttachmentReady, true);
  assert.equal(promoted.boxWireframeDrawCount, 1);
  assert.deepEqual(promoted.boxDimsM, [12, 8, 6]);
  assert.equal(
    workerModule.resolveCommittedResidentSchedulePreviewPromotion({
      admission,
      candidate,
      lastDrawnCandidate: {
        ...candidate,
        version: { ...version, nextStep: version.nextStep - 1 }
      },
      lastDrawnStatus: renderedPreview
    }),
    null,
    'a stale preview cannot be promoted'
  );
  assert.equal(
    workerModule.resolveCommittedResidentSchedulePreviewPromotion({
      admission,
      candidate,
      lastDrawnCandidate: candidate,
      lastDrawnStatus: {
        ...renderedPreview,
        status: 'worker-offscreen-resident-schedule-candidate-render-failed'
      }
    }),
    null,
    'a failed preview cannot be promoted'
  );
});

test('presentation worker schedule verb skips candidates truthfully when no epoch identity exists', async () => {
  await ensureFakePresentationReady();
  const candidateCountBefore = candidateMessages().length;
  const statsBefore = workerModule.presentationResidentScheduleCandidateMailbox.stats();
  const fakeRunner = {
    async runUlgMechanicsResidentStageWorkerSchedulePayload() {
      // A schedule cancelled before step 1: no progress, null identity.
      return {
        schema: 'peercompute.ulg.worker-resident-schedule-result.v0',
        status: 'worker-resident-schedule-cancelled',
        scheduleId: 'ulg:test:sched-cancelled-early',
        requestedStepCount: 4,
        completedStepCount: 0,
        cancelled: true,
        retainedBufferRefs: [],
        finalEpochIdentity: null,
        perStepSummaries: { lastStep: null }
      };
    }
  };
  await workerModule.runResidentScheduleOnPresentationDevice(
    {
      payload: {
        schedule: { stepCount: 4 },
        lease: { laneId: 'ulg:test:lane', stateKey: 'ulg:test:state' }
      }
    },
    { runnerModuleOverride: fakeRunner }
  );
  assert.equal(candidateMessages().length, candidateCountBefore);
  const stats = workerModule.presentationResidentScheduleCandidateMailbox.stats();
  assert.equal(stats.publishedCount, statsBefore.publishedCount);
  assert.equal(stats.droppedStaleCount, statsBefore.droppedStaleCount);
  assert.equal(
    residentStageStatuses().at(-1).status,
    'worker-offscreen-resident-schedule-on-presentation-device-completed'
  );
});

test('presentation worker schedule verb reports driver failures fail-closed', async () => {
  await ensureFakePresentationReady();
  const fakeRunner = {
    async runUlgMechanicsResidentStageWorkerSchedulePayload() {
      const error = new Error(
        'Worker resident schedule failed closed: epoch-identity-regressed'
      );
      error.reason = 'epoch-identity-regressed';
      throw error;
    }
  };
  await workerModule.runResidentScheduleOnPresentationDevice(
    { payload: { schedule: { stepCount: 2 } } },
    { runnerModuleOverride: fakeRunner }
  );
  const status = residentStageStatuses().at(-1);
  assert.equal(
    status.status,
    'worker-offscreen-resident-schedule-on-presentation-device-failed'
  );
  assert.match(status.errorMessage, /epoch-identity-regressed/);
});

test('presentation worker cancel verb forwards to the W2 cancel entry', async () => {
  const cancelCalls = [];
  const fakeRunner = {
    cancelUlgMechanicsResidentStageWorkerSchedule(id) {
      cancelCalls.push(id);
      return {
        status: 'resident-schedule-cancel-requested',
        scheduleId: id,
        cancelRequested: true
      };
    }
  };
  const outcome = await workerModule.cancelResidentScheduleOnPresentationDevice(
    { id: 'ulg:test:sched-to-cancel' },
    { runnerModuleOverride: fakeRunner }
  );
  assert.deepEqual(cancelCalls, ['ulg:test:sched-to-cancel']);
  assert.equal(outcome.cancelRequested, true);
  const message = postedMessages.findLast(
    (entry) => entry?.status === 'worker-offscreen-resident-schedule-cancel-forwarded'
  );
  assert.equal(
    message.workerOffscreenResidentScheduleCancel.scheduleId,
    'ulg:test:sched-to-cancel'
  );
  assert.equal(message.workerOffscreenResidentScheduleCancel.cancelRequested, true);
});

test('presentation worker message loop dispatches the schedule and cancel verbs through the real mechanics module', async () => {
  await ensureFakePresentationReady();
  // Cancel with an unknown id: the real W2 cancel entry answers
  // 'resident-schedule-not-active' without needing any device.
  const cancelCountBefore = postedMessages.filter(
    (entry) => entry?.status === 'worker-offscreen-resident-schedule-cancel-forwarded'
  ).length;
  fakeSelf.onmessage({
    data: {
      type: 'cancel-resident-schedule-on-presentation-device',
      id: 'ulg:test:never-started'
    }
  });
  const cancelForwarded = await flushUntil(() => postedMessages.filter(
    (entry) => entry?.status === 'worker-offscreen-resident-schedule-cancel-forwarded'
  ).length > cancelCountBefore);
  assert.equal(cancelForwarded, true);
  const cancelMessage = postedMessages.findLast(
    (entry) => entry?.status === 'worker-offscreen-resident-schedule-cancel-forwarded'
  );
  assert.equal(
    cancelMessage.workerOffscreenResidentScheduleCancel.status,
    'resident-schedule-not-active'
  );
  assert.equal(
    cancelMessage.workerOffscreenResidentScheduleCancel.cancelRequested,
    false
  );

  // Run with an invalid stepCount: the real W2 driver fails closed before it
  // touches the (fake) device, and the verb reports the failure envelope.
  fakeSelf.onmessage({
    data: {
      type: 'run-resident-schedule-on-presentation-device',
      payload: {
        schedule: { stepCount: 0 },
        lease: { laneId: 'ulg:test:lane', stateKey: 'ulg:test:state' }
      }
    }
  });
  const failed = await flushUntil(() => residentStageStatuses().some(
    (entry) => entry.status
      === 'worker-offscreen-resident-schedule-on-presentation-device-failed'
      && /stepCount/.test(entry.errorMessage || '')
  ), { tries: 400 });
  assert.equal(failed, true, 'schedule dispatch never reported the fail-closed driver error');
});

test('presentation worker disposes its active canvas configuration exactly once', async () => {
  await ensureFakePresentationReady();
  let fakeDeviceDestroyCount = 0;
  let fakeWorkerCloseCount = 0;
  fakeDevice.destroy = () => {
    fakeDeviceDestroyCount += 1;
  };
  fakeSelf.close = () => {
    fakeWorkerCloseCount += 1;
  };

  fakeSelf.onmessage({
    data: { type: 'dispose', reason: 'test-dispose' }
  });
  const disposedReceiptReady = await flushUntil(() => postedMessages.some(
    (message) => message?.status === 'worker-offscreen-presentation-disposed'
      && message?.reason === 'test-dispose'
  ));
  assert.equal(disposedReceiptReady, true);
  const receipt = postedMessages.findLast(
    (message) => message?.status === 'worker-offscreen-presentation-disposed'
  );
  assert.equal(fakeCanvasUnconfigureCount, 1);
  assert.equal(fakeDeviceDestroyCount, 1);
  assert.equal(fakeWorkerCloseCount, 1);
  assert.equal(receipt.canvasConfigured, false);
  assert.equal(receipt.canvasUnconfigureCount, 1);
  assert.equal(receipt.lastCanvasConfigureAction, 'unconfigured');
  assert.equal(receipt.lastCanvasConfigureReason, 'test-dispose');

  fakeSelf.onmessage({
    data: { type: 'dispose', reason: 'test-duplicate-dispose' }
  });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(fakeCanvasUnconfigureCount, 1);
  assert.equal(fakeDeviceDestroyCount, 1);
  assert.equal(fakeWorkerCloseCount, 1);
});
