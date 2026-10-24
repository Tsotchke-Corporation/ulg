import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

import {
  ULG_RESIDENT_RENDER_CANDIDATE_SCHEMA
} from '../src/visualization/residentRenderCandidateMailbox.js';
import {
  RESIDENT_SPH_STORAGE_BUFFERS_PER_STAGE
} from '../src/runtime/webgpuDeviceLimits.js';
import {
  hasResidentPresentationSubmissionGap,
  requestResidentPresentationSubmissionGap
} from '../src/runtime/sph/residentPresentationSubmissionGap.js';
import {
  ULG_WORKER_TIER0_ISOSURFACE_PRESENTATION_QOS_BOUNDARY_PROOF_STATUS,
  isExactWorkerTier0PresentationQosBoundaryProof
} from '../src/runtime/sph/sphWorkerPresentationQos.js';

// The offscreen presentation worker is a module worker script: it has no DOM
// dependency at import time but binds `self.onmessage` and posts through
// `self.postMessage`. Shim a worker-global BEFORE importing so the module's
// exported handlers (the W3 test seams) can be driven directly in node with a
// fake WebGPU device — no browser, no GPU.
const postedMessages = [];
let workerTestClockFloorMs = 0;
let playbackTestRevision = 0;
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
  performance: { now: () => Math.max(Date.now(), workerTestClockFloorMs) },
  GPUBufferUsage: { COPY_DST: 0x08, UNIFORM: 0x40, STORAGE: 0x80 },
  GPUTextureUsage: { RENDER_ATTACHMENT: 0x10 },
  GPUShaderStage: { VERTEX: 0x1, FRAGMENT: 0x2, COMPUTE: 0x4 },
  GPUColorWrite: { ALL: 0xF },
  navigator: {},
  requestAnimationFrame(callback) {
    const handle = ++this._rafHandle;
    const immediate = setImmediate(() => {
      this._rafImmediates.delete(handle);
      callback(Date.now());
    });
    this._rafImmediates.set(handle, immediate);
    return handle;
  },
  cancelAnimationFrame(handle) {
    const immediate = this._rafImmediates.get(handle);
    if (immediate) clearImmediate(immediate);
    this._rafImmediates.delete(handle);
  },
  _rafHandle: 0,
  _rafImmediates: new Map()
};
globalThis.self = fakeSelf;

const workerModule = await import('../src/services/ulgOffscreenRender.worker.js');

function isosurfaceBoundaryFrameProof(boundary, serial = 19) {
  return {
    presentationFrameSchema: 'peercompute.ulg.worker-offscreen-resident-isosurface-presentation-frame.v0',
    presentationFrameStatus: 'worker-owned-isosurface-presentation-opportunity',
    presentationFrameAdmitted: true,
    isosurfaceTemporalPresentation: true,
    isosurfacePresentationMotionAgeS: 0.004,
    isosurfacePresentationSourceTimeS: 0.016,
    isosurfacePresentationMotionMethod: 'bounded-gpu-field-velocity-extrapolation',
    presentationOnly: true,
    authoritativeStateMutation: false,
    presentationFrameGpuCompleted: true,
    presentationFrameGpuCompletionMethod: 'worker-device.queue.onSubmittedWorkDone',
    presentationFramePresentationOpportunity: true,
    presentationFramePresentationOpportunityMethod: 'worker-request-animation-frame-after-gpu-completion',
    presentationQueueCompletionCount: serial,
    presentationQueueCompletionSerial: serial,
    presentationQueueCompletionMethod: 'worker-device.queue.onSubmittedWorkDone',
    presentationQueueCompletionScope: 'worker-offscreen-shared-device-queue-frame-proof',
    physicsQueuePrefixCoverage: 'physics-queue-prefix-included',
    physicsHostQueueFenceParticipation: true,
    physicsContinuationBlocked: true,
    presentationQosHostQueueFenceCount: 1,
    motionPresentationQosBoundary: { ...boundary }
  };
}

test('isosurface submission boundary waits for the presenter and preserves its true-geometry proof', async () => {
  const boundary = Object.freeze({
    submissionOrdinal: 1, completedSubstepCount: 2, totalSubstepCount: 7, chunkStepCount: 2
  });
  let finishFrame;
  const frame = isosurfaceBoundaryFrameProof(boundary);
  const pendingFrame = new Promise((resolve) => { finishFrame = resolve; });
  let returned = false;
  const completion = workerModule.runWorkerIsosurfaceTemporalPresentationSubmissionBoundary(
    boundary,
    { presenter: {
      presentSubmissionBoundary(received) {
        assert.equal(received, boundary);
        return pendingFrame;
      }
    } }
  ).then((receipt) => { returned = true; return receipt; });
  await Promise.resolve();
  assert.equal(returned, false, 'the solver boundary must await a completed mesh frame');
  finishFrame(frame);
  const receipt = await completion;
  assert.equal(receipt.status, ULG_WORKER_TIER0_ISOSURFACE_PRESENTATION_QOS_BOUNDARY_PROOF_STATUS);
  assert.equal(receipt.isosurfaceFrameProof, frame);
  assert.equal(isExactWorkerTier0PresentationQosBoundaryProof(receipt, boundary), true);
  assert.equal(Object.hasOwn(receipt, 'motionFrameSerial'), false);
  assert.equal(Object.isFrozen(receipt), true);
});

test('isosurface boundary suppresses late host-blocked claims after deadline abort', async () => {
  const boundary = Object.freeze({
    submissionOrdinal: 1, completedSubstepCount: 1, totalSubstepCount: 64, chunkStepCount: 1
  });
  const controller = new AbortController();
  let finish;
  const pending = workerModule.runWorkerIsosurfaceTemporalPresentationSubmissionBoundary(boundary, {
    signal: controller.signal,
    presenter: { presentSubmissionBoundary(received, { signal }) {
      assert.equal(received, boundary);
      assert.equal(signal, controller.signal);
      return new Promise(resolve => { finish = resolve; });
    } }
  });
  controller.abort();
  finish(isosurfaceBoundaryFrameProof(boundary));
  await assert.rejects(pending, /lacked a fresh completed boundary frame/);
});

test('isosurface submission boundary rejects unavailable or unproved frame opportunities', async () => {
  const boundary = Object.freeze({
    submissionOrdinal: 1, completedSubstepCount: 2, totalSubstepCount: 7, chunkStepCount: 2
  });
  for (const frame of [
    false,
    { ...isosurfaceBoundaryFrameProof(boundary), presentationFrameGpuCompleted: false },
    { ...isosurfaceBoundaryFrameProof(boundary), physicsQueuePrefixCoverage: 'physics-queue-prefix-not-attributed' },
    { ...isosurfaceBoundaryFrameProof(boundary), motionPresentationQosBoundary: { ...boundary, submissionOrdinal: 2 } }
  ]) {
    await assert.rejects(
      workerModule.runWorkerIsosurfaceTemporalPresentationSubmissionBoundary(boundary, {
        presenter: { async presentSubmissionBoundary() { return frame; } }
      }),
      /lacked a fresh completed boundary frame/
    );
  }
  await assert.rejects(
    workerModule.runWorkerIsosurfaceTemporalPresentationSubmissionBoundary(boundary, { presenter: {} }),
    /unavailable at the fused submission boundary/
  );
});

test('isosurface camera dispatch forwards the trailing camera event without an outer throttle', async () => {
  const source = await readFile(new URL('../src/services/ulgOffscreenRender.worker.js', import.meta.url), 'utf8');
  const cameraStart = source.indexOf("if (data.type === 'update-preview-view-projection')");
  const particleStart = source.indexOf('const workerParticleTemporalCameraUpdated', cameraStart);
  const isosurfaceDispatch = source.slice(cameraStart, particleStart);
  assert.match(isosurfaceDispatch, /if \(workerOwnedIsosurfacePresenter\) \{/);
  assert.match(isosurfaceDispatch, /await workerOwnedIsosurfacePresenter\.redraw\(/);
  assert.doesNotMatch(isosurfaceDispatch, /now - previewCameraRedrawLastMs\s*>=/);
  const cameraEnd = source.indexOf("if (data.type === 'present-committed-resident-schedule-candidate')", particleStart);
  assert.match(source.slice(particleStart, cameraEnd), /now - previewCameraRedrawLastMs >= 33/,
    'the legacy preview throttle is unchanged');
});

test('terminal presentation completion is handled immediately but rejects at its later join', async () => {
  let rejectCompletion;
  const error = new Error('injected terminal presentation failure');
  const completion = new Promise((_resolve, reject) => {
    rejectCompletion = reject;
  });
  const retained = workerModule.retainHandledPromiseForLaterJoin(completion);
  rejectCompletion(error);
  await new Promise((resolve) => setImmediate(resolve));
  await assert.rejects(retained, (received) => received === error);
});

test('worker particle temporal motion request preserves bounded simulation-time pacing', () => {
  const motion = workerModule.normalizeWorkerParticleTemporalMotionRequest({
    schema: 'peercompute.ulg.worker-offscreen-particle-temporal-motion.v0',
    enabled: true,
    targetHz: 60,
    presentationSlotCount: 32,
    maxHorizonS: 0.25,
    simulationTimeScale: 0.48,
    maxSimulationAgeS: 0.064,
    maxDisplacementM: 0.04
  });
  assert.equal(motion.targetHz, 60);
  assert.equal(motion.presentationSlotCount, 32);
  assert.equal(motion.maxHorizonS, 0.25);
  assert.equal(motion.simulationTimeScale, 0.48);
  assert.equal(motion.maxSimulationAgeS, 0.064);
  assert.equal(motion.maxDisplacementM, 0.04);
  assert.deepEqual(motion.sourceVelocityLanes, [4, 5, 6]);
  assert.equal(motion.authoritativeStateMutation, false);
  assert.equal(Object.isFrozen(motion), true);
  assert.equal(
    workerModule.normalizeWorkerParticleTemporalMotionRequest({
      schema: 'peercompute.ulg.worker-offscreen-particle-temporal-motion.v0',
      enabled: true,
      maxDisplacementM: 0
    }),
    null
  );
});

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
    writeBuffer(...args) { fakeGpuRecords.writes.push(args); },
    onSubmittedWorkDone() { return Promise.resolve(); }
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
let fakeAdapterRequestCount = 0;
let fakeAdapterGate = null;
fakeSelf.navigator = {
  gpu: {
    requestAdapter: async () => {
      fakeAdapterRequestCount += 1;
      if (fakeAdapterGate) await fakeAdapterGate;
      return {
        requestDevice: async (descriptor) => {
          requestedDeviceDescriptor = descriptor;
          return fakeDevice;
        }
      };
    },
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
      clearAlpha: 0,
      workerFramebufferEpoch: 1
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
  fakeSelf.onmessage({ data: { type: 'set-presentation-playback-state',
    playbackState: { playing: false, revision: ++playbackTestRevision } } });
  let releaseAdapter = null;
  fakeAdapterGate = new Promise((resolve) => {
    releaseAdapter = resolve;
  });
  fakeSelf.onmessage({
    data: {
      type: 'init-offscreen-presentation',
      playbackState: { playing: true, revision: 0 },
      canvas: fakeCanvas,
      width: 4,
      height: 4,
      cssWidth: 4,
      cssHeight: 4,
      pixelRatio: 1,
      backgroundColor: '#000000',
      clearAlpha: 0,
      workerFramebufferEpoch: 1
    }
  });
  assert.equal(
    await flushUntil(() => fakeAdapterRequestCount === 1),
    true,
    'adapter acquisition did not begin'
  );
  await assert.rejects(workerModule.runWorkerIsosurfaceTemporalPresentationSubmissionBoundary({}, {
    presenter: { presentSubmissionBoundary() { assert.fail('stale init must not resume presentation'); } }
  }), /unavailable/);
  for (const playing of [true, false]) {
    fakeSelf.onmessage({ data: { type: 'set-presentation-playback-state',
      playbackState: { playing, revision: ++playbackTestRevision } } });
  }
  fakeSelf.onmessage({
    data: {
      type: 'resize',
      width: 8,
      height: 8,
      cssWidth: 8,
      cssHeight: 8,
      pixelRatio: 1,
      workerFramebufferEpoch: 2,
      reason: 'test-resize-during-adapter-acquisition'
    }
  });
  await new Promise((resolve) => setImmediate(resolve));
  releaseAdapter();
  fakeAdapterGate = null;
  await new Promise(resolve => setImmediate(resolve));
  await assert.rejects(workerModule.runWorkerIsosurfaceTemporalPresentationSubmissionBoundary({}, {
    presenter: { presentSubmissionBoundary() { assert.fail('async init must preserve the latest pause'); } }
  }), /unavailable/);
  workerModule.setWorkerPresentationPlaybackState({ playing: true, revision: ++playbackTestRevision });
  assert.equal(
    await flushUntil(() => postedMessages.some(
      (message) => message?.status === 'worker-offscreen-presentation-ready'
    )),
    true,
    'presentation worker never reported ready on the fake device'
  );
  assert.equal(fakeCanvas.width, 8);
  assert.equal(fakeCanvas.height, 8);
  assert.equal(
    postedMessages.findLast((message) =>
      message?.status === 'worker-offscreen-presentation-ready')
      ?.workerFramebufferEpoch,
    2
  );
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
      workerFramebufferEpoch: 2,
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
      workerFramebufferEpoch: 3,
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

  const messagesBeforeMissingEpoch = postedMessages.length;
  fakeSelf.onmessage({
    data: {
      type: 'draw-resident-particle-state-producer',
      width: 16,
      height: 12,
      particleCount: 0,
      reason: 'test-missing-framebuffer-epoch'
    }
  });
  assert.equal(await flushUntil(() => postedMessages
    .slice(messagesBeforeMissingEpoch)
    .some((message) => message?.workerOffscreenRenderRows?.status
      === 'worker-offscreen-presentation-superseded-stale-framebuffer-epoch')), true);
  assert.equal(
    fakeCanvasConfigureCount,
    configureCountAfterInit + 1,
    'an untagged page draw must be rejected before it can reconfigure or draw'
  );

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
      workerFramebufferEpoch: 3,
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

test('presentation worker schedule verb omits offscreen progress work and emits only its terminal candidate by default', async () => {
  await ensureFakePresentationReady();
  const candidateCountBefore = candidateMessages().length;
  const statsBefore = workerModule.presentationResidentScheduleCandidateMailbox.stats();
  let capturedPayload = null;
  let capturedId = null;
  let capturedRunnerOptions = null;
  let suppressedProgressReadCount = 0;
  const fakeRunner = {
    async runUlgMechanicsResidentStageWorkerSchedulePayload(payload, options) {
      capturedPayload = payload;
      capturedId = options.id;
      capturedRunnerOptions = options;
      for (let stepOrdinal = 1; stepOrdinal <= 3; stepOrdinal += 1) {
        const progress = {
          schema: 'peercompute.ulg.worker-resident-schedule-progress.v0',
          scheduleId: 'ulg:test:sched-candidates',
          completedStepCount: stepOrdinal,
          stepOrdinal
        };
        Object.defineProperties(progress, {
          epochIdentity: {
            enumerable: true,
            get() {
              suppressedProgressReadCount += 1;
              return scheduleEpochIdentity(stepOrdinal);
            }
          },
          stepSummary: {
            enumerable: true,
            get() {
              suppressedProgressReadCount += 1;
              return {
                schema:
                  'peercompute.ulg.worker-resident-schedule-step-summary.v0',
                scheduleId: 'ulg:test:sched-candidates',
                stepOrdinal,
                particleCount: 2,
                retainedBufferRefs: [`ulg-worker:test:state:${stepOrdinal}`]
              };
            }
          }
        });
        options.postProgress?.(progress);
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
  assert.equal(
    Object.hasOwn(capturedRunnerOptions, 'postProgress'),
    false,
    'offscreen progress must have no consumer when live preview is disabled'
  );
  assert.equal(
    suppressedProgressReadCount,
    0,
    'default schedules must not inspect progress candidate fields'
  );
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

  // The offscreen path publishes only the exact terminal result by default.
  const candidates = candidateMessages().slice(candidateCountBefore);
  assert.equal(candidates.length, 1);
  const candidate = candidates[0].candidate;
  assert.equal(candidate.schema, ULG_RESIDENT_RENDER_CANDIDATE_SCHEMA);
  assert.equal(candidate.version.scheduleId, 'ulg:test:sched-candidates');
  assert.equal(candidate.version.residentExecutionGeneration, 7);
  assert.equal(candidate.version.nextStep, 103);
  assert.equal(candidate.version.stepOrdinal, 3);
  assert.equal(candidate.epochIdentity.physicsTick, 103);
  assert.equal(candidate.epochIdentity.positionEpoch, 203);
  assert.deepEqual(candidate.retainedBufferRefs, ['ulg-worker:test:state:3']);
  assertCloneableOnly(candidate, 'terminalCandidate');
  structuredClone(candidate);

  // Worker-local mailbox: one accepted terminal candidate and no duplicate.
  const stats = workerModule.presentationResidentScheduleCandidateMailbox.stats();
  assert.equal(stats.publishedCount - statsBefore.publishedCount, 1);
  assert.equal(stats.droppedStaleCount - statsBefore.droppedStaleCount, 0);
  assert.equal(stats.latestVersion.residentExecutionGeneration, 7);
  assert.equal(stats.latestVersion.nextStep, 103);
  const latest = workerModule.presentationResidentScheduleCandidateMailbox.peekLatest();
  assert.equal(latest.version.stepOrdinal, 3);
  assert.ok(Object.isFrozen(latest));
});

test('explicit live preview time-coalesces sparse progress before candidate construction and always publishes terminal', async () => {
  await ensureFakePresentationReady();
  const candidateCountBefore = candidateMessages().length;
  const statsBefore =
    workerModule.presentationResidentScheduleCandidateMailbox.stats();
  const previousNow = fakeSelf.performance.now;
  let clockMs = 0;
  let retainedResolveCount = 0;
  let suppressedStepFourReadCount = 0;
  let runnerOptions = null;
  let terminalAdmissionConsumed = false;
  let terminalCandidateVersion = null;
  const scheduleId = 'ulg:test:sched-live-preview-coalescing';
  const laneId = 'ulg:test:lane-live-preview-coalescing';
  const stateKey = 'ulg:test:state-live-preview-coalescing';
  const terminalFence = {
    required: true,
    scope: 'resident-schedule-terminal',
    terminalScheduleFence: true,
    fenceSatisfied: true,
    authorityAdmissionReady: true,
    scheduleId,
    laneId,
    stateKey,
    completedStepCount: 7,
    queueCompletionStatus: 'queue-work-completed',
    queueCompletionMethod: 'worker-device.queue.onSubmittedWorkDone'
  };
  const terminalAdmission = {
    schema:
      'peercompute.ulg.presentation-worker-committed-resident-schedule-presentation.v0',
    status:
      'state-manager-committed-resident-schedule-presentation-admission',
    scheduleId,
    laneId,
    stateKey,
    candidateVersion: {
      residentExecutionGeneration: 11,
      nextStep: 107,
      scheduleId,
      stepOrdinal: 7
    },
    authority: {
      status: 'state-manager-committed-worker-schedule',
      computeManagerCompletionSchema:
        'peercompute.ulg.schroeder-worker-lane-compute-manager-completion.v0',
      computeManagerLeaseId: 'lease:live-preview-coalescing',
      computeManagerLeaseStatus: 'completed',
      computeManagerFenceSatisfied: true,
      stateManagerCommitStatus: 'committed',
      stateManagerCommitAccepted: true
    },
    terminalFence
  };
  const fakeBuffer = { mapAsync() {} };
  const fakeRunner = {
    async runUlgMechanicsResidentStageWorkerSchedulePayload(_payload, options) {
      runnerOptions = options;
      for (const [stepOrdinal, atMs] of [[2, 10], [4, 30], [6, 76]]) {
        clockMs = atMs;
        const progress = {};
        Object.defineProperties(progress, {
          scheduleId: {
            enumerable: true,
            get() {
              if (stepOrdinal === 4) suppressedStepFourReadCount += 1;
              return scheduleId;
            }
          },
          stepOrdinal: {
            enumerable: true,
            get() {
              if (stepOrdinal === 4) suppressedStepFourReadCount += 1;
              return stepOrdinal;
            }
          },
          epochIdentity: {
            enumerable: true,
            get() {
              if (stepOrdinal === 4) suppressedStepFourReadCount += 1;
              return scheduleEpochIdentity(stepOrdinal, {
                storageGeneration: 11
              });
            }
          },
          stepSummary: {
            enumerable: true,
            get() {
              if (stepOrdinal === 4) suppressedStepFourReadCount += 1;
              return {
                stepOrdinal,
                particleCount: 2,
                retainedBufferRefs: [`retained:live-preview:${stepOrdinal}`]
              };
            }
          }
        });
        options.postProgress(progress);
      }
      clockMs = 80;
      return {
        schema: 'peercompute.ulg.worker-resident-schedule-result.v0',
        status: 'worker-resident-schedule-completed',
        scheduleId,
        laneId,
        stateKey,
        requestedStepCount: 7,
        completedStepCount: 7,
        cancelled: false,
        finalEpochIdentity: scheduleEpochIdentity(7, {
          storageGeneration: 11
        }),
        perStepSummaries: {
          lastStep: { stepOrdinal: 7, particleCount: 2 }
        },
        retainedBufferRefs: ['retained:live-preview:7'],
        gpuFence: terminalFence
      };
    },
    resolveUlgMechanicsResidentStageWorkerRetainedParticleState() {
      retainedResolveCount += 1;
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
    residentScheduleLivePreview: true,
    livePreviewMinIntervalMs: 66,
    particleCount: 2,
    stateStrideFloats: 8,
    thermoStrideFloats: 12,
    stateByteLength: 64,
    thermoByteLength: 96,
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

  fakeSelf.performance.now = () => clockMs;
  try {
    await workerModule.runResidentScheduleOnPresentationDevice(
      {
        id: 'ulg:test:message-live-preview-coalescing',
        payload: {
          schedule: {
            scheduleId,
            stepCount: 7,
            progressEverySteps: 2
          },
          lease: { laneId, stateKey },
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

    assert.equal(typeof runnerOptions.postProgress, 'function');
    assert.equal(suppressedStepFourReadCount, 0);
    const candidates = candidateMessages().slice(candidateCountBefore);
    terminalCandidateVersion = candidates.at(-1)?.candidate?.version ?? null;
    assert.deepEqual(
      candidates.map((message) => message.candidate.version.nextStep),
      [102, 106, 107]
    );
    assert.deepEqual(
      candidates.map((message) => message.candidate.version.stepOrdinal),
      [2, 6, 7]
    );
    candidates.forEach((message, index) => {
      assertCloneableOnly(message.candidate, `livePreviewCandidate[${index}]`);
      structuredClone(message.candidate);
    });
    const stats =
      workerModule.presentationResidentScheduleCandidateMailbox.stats();
    assert.equal(stats.publishedCount - statsBefore.publishedCount, 3);
    assert.equal(stats.droppedStaleCount - statsBefore.droppedStaleCount, 0);
    assert.equal(stats.latestVersion.nextStep, 107);
    assert.equal(
      retainedResolveCount,
      2,
      'the terminal draw may wait for the prior keyframe proof until admission'
    );

    const admitted = await
      workerModule.presentCommittedResidentScheduleCandidate(
        terminalAdmission
      );
    assert.equal(admitted.stateManagerCommittedPresentation, true);
    assert.equal(admitted.committedPresentationPromotedWithoutRedraw, true);
    assert.equal(retainedResolveCount, 3);
    terminalAdmissionConsumed = true;
  } finally {
    fakeSelf.performance.now = previousNow;
    if (!terminalAdmissionConsumed) {
      await workerModule.presentCommittedResidentScheduleCandidate(
        {
          ...terminalAdmission,
          candidateVersion:
            terminalCandidateVersion ?? terminalAdmission.candidateVersion
        }
      );
    }
  }
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
      postProgress?.({
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
  const admissionMessageCount = postedMessages.length;
  const submittedAdmission =
    workerModule.presentCommittedResidentScheduleCandidate(
    exactAdmission
  );
  assert.equal(
    submittedAdmission.status,
    'worker-offscreen-resident-particle-keyframe-submitted'
  );
  assert.equal(await flushUntil(() => postedMessages
    .slice(admissionMessageCount)
    .some((message) => (
      message?.workerOffscreenRenderRows?.status
        === 'worker-offscreen-resident-particle-state-producer-rendered'
      && message.workerOffscreenRenderRows.stateManagerCommittedPresentation
        === true
    ))), true, 'committed keyframe never reached its presentation opportunity');
  const admitted = postedMessages
    .slice(admissionMessageCount)
    .map((message) => message?.workerOffscreenRenderRows)
    .findLast((receipt) => (
      receipt?.status
        === 'worker-offscreen-resident-particle-state-producer-rendered'
      && receipt.stateManagerCommittedPresentation === true
    ));
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
      workerFramebufferEpoch: 4,
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
  assert.equal(retainedResolveCount, 1, 'camera/resize redraw reuses immutable display buffers without recapturing physics');

  const replay = workerModule.presentCommittedResidentScheduleCandidate(
    exactAdmission
  );
  assert.equal(
    replay.status,
    'worker-offscreen-committed-resident-schedule-presentation-blocked'
  );
  assert.equal(retainedResolveCount, 1, 'replayed admission must not add another retained draw');

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
      postProgress?.({
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
  assert.equal(retainedResolveCount, 2, 'only the next authoritative source recaptures physics');

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
    boxDimsM: [12, 8, 6],
    presentationFrameSchema:
      'peercompute.ulg.worker-offscreen-particle-keyframe-presentation-frame.v0',
    presentationFrameStatus:
      'worker-particle-keyframe-presentation-opportunity',
    presentationFrameAdmitted: true,
    presentationFrameGpuCompleted: true,
    presentationFramePresentationOpportunity: true,
    presentationFramePresentationOpportunityMethod:
      'worker-request-animation-frame-after-gpu-completion',
    presentationQueueCompletionCount: 1,
    presentationQueueCompletionSerial: 1,
    presentationQueueCompletionMethod:
      'worker-device.queue.onSubmittedWorkDone',
    presentationQueueCompletionScope:
      'worker-offscreen-shared-device-queue-frame-proof',
    physicsQueuePrefixCoverage: 'physics-queue-prefix-not-attributed',
    physicsHostQueueFenceParticipation: null
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
  const keyframeProofSchema =
    'peercompute.ulg.worker-offscreen-particle-keyframe-presentation-frame.v0';
  assert.equal(
    workerModule.resolveCommittedResidentSchedulePreviewPromotion({
      admission,
      candidate,
      lastDrawnCandidate: candidate,
      lastDrawnStatus: {
        ...renderedPreview,
        presentationFrameSchema: keyframeProofSchema,
        presentationFrameAdmitted: false,
        presentationFrameGpuCompleted: true,
        presentationFramePresentationOpportunity: false
      }
    }),
    null,
    'a submitted or merely GPU-completed keyframe cannot be promoted'
  );
  const proofPromoted =
    workerModule.resolveCommittedResidentSchedulePreviewPromotion({
      admission,
      candidate,
      lastDrawnCandidate: candidate,
      lastDrawnStatus: {
        ...renderedPreview,
        presentationFrameSchema: keyframeProofSchema,
        presentationFrameAdmitted: true,
        presentationFrameGpuCompleted: true,
        presentationFramePresentationOpportunity: true
      }
    });
  assert.equal(proofPromoted?.presentationFrameAdmitted, true);
  assert.equal(proofPromoted?.committedPresentationPromotedWithoutRedraw, true);
});

let playbackTestFramebufferEpoch = 5;

test('worker presentation playback rejects malformed, stale and conflicting revisions', async () => {
  assert.equal(typeof workerModule.setWorkerPresentationPlaybackState, 'function');
  for (const state of [null, {}, { playing: 'false', revision: 1 },
    { playing: false, revision: '1' }, { playing: false, revision: -1 },
    { playing: false, revision: Infinity }, { playing: false, revision: 1.5 }]) {
    assert.equal(workerModule.setWorkerPresentationPlaybackState(state), false);
  }
  const revision = ++playbackTestRevision;
  assert.equal(workerModule.setWorkerPresentationPlaybackState({ playing: false, revision }), true);
  assert.equal(workerModule.setWorkerPresentationPlaybackState({ playing: true, revision }), false);
  assert.equal(workerModule.setWorkerPresentationPlaybackState({ playing: false, revision }), false);
  assert.equal(workerModule.setWorkerPresentationPlaybackState({ playing: true, revision: revision - 1 }), false);
  assert.equal(workerModule.setWorkerPresentationPlaybackState({ playing: true, revision: ++playbackTestRevision }), true);
});

for (const playbackCase of ['ordinary', 'pause-before-fence', 'pause-after-fence',
  'rapid-pause-resume', 'paused-keyframe-camera', 'paused-keyframe-resize',
  'paused-keyframe-background', 'paused-keyframe-background-resize',
  'pause-qos-wait', 'exhausted-resume']) {
test(`particle presentation controlled fence/RAF proof: ${playbackCase}`, async () => {
  await ensureFakePresentationReady();
  const scheduleId = `ulg:test:controlled-presentation-proof:${playbackCase}`;
  const laneId = `ulg:test:controlled-presentation-proof-lane:${playbackCase}`;
  const stateKey = `ulg:test:controlled-presentation-proof-state:${playbackCase}`;
  const terminalFence = {
    required: true,
    scope: 'resident-schedule-terminal',
    terminalScheduleFence: true,
    fenceSatisfied: true,
    authorityAdmissionReady: true,
    scheduleId,
    laneId,
    stateKey,
    completedStepCount: 1,
    queueCompletionStatus: 'queue-work-completed',
    queueCompletionMethod: 'worker-device.queue.onSubmittedWorkDone'
  };
  const retainedBuffer = { mapAsync() {} };
  const fakeRunner = {
    async runUlgMechanicsResidentStageWorkerSchedulePayload() {
      return {
        schema: 'peercompute.ulg.worker-resident-schedule-result.v0',
        status: 'worker-resident-schedule-completed',
        scheduleId,
        laneId,
        stateKey,
        requestedStepCount: 1,
        completedStepCount: 1,
        cancelled: false,
        retainedBufferRefs: ['retained:controlled-presentation-proof'],
        finalEpochIdentity: scheduleEpochIdentity(1, {
          storageGeneration: 101
        }),
        perStepSummaries: {
          lastStep: { stepOrdinal: 1, particleCount: 2 }
        },
        gpuFence: terminalFence
      };
    },
    resolveUlgMechanicsResidentStageWorkerRetainedParticleState() {
      return {
        status: 'worker-retained-particle-state-ready',
        sourceStateBuffer: retainedBuffer,
        sourceThermoBuffer: retainedBuffer,
        particleCount: 2,
        stateStrideFloats: 8,
        thermoStrideFloats: 12,
        stateBufferByteLength: 64,
        thermoBufferByteLength: 96
      };
    }
  };
  await workerModule.runResidentScheduleOnPresentationDevice({
    payload: {
      schedule: { scheduleId, stepCount: 1 },
      lease: { laneId, stateKey },
      context: {
        ulgMechanicsResidentStageWorker: {
          common: {
            presentationWorkerRenderRetainedStageOutput: {
              enabled: true,
              sourceStageId: 'schroederSameLevelMechanics',
              particleCount: 2,
              stateStrideFloats: 8,
              thermoStrideFloats: 12,
              stateByteLength: 64,
              thermoByteLength: 96,
              colorRowCount: 1,
              colorRowsByteLength: 32,
              materialColorRows: new Float32Array(8),
              viewProjectionMatrix: new Float32Array(16),
              boxDimsM: [12, 8, 6],
              temporalMotion: {
                schema:
                  'peercompute.ulg.worker-offscreen-particle-temporal-motion.v0',
                enabled: true,
                targetHz: 60,
                presentationSlotCount: 32,
                maxHorizonS: 0.25,
                simulationTimeScale: 1,
                maxSimulationAgeS: 0.064,
                maxDisplacementM: 0.04
              }
            }
          }
        }
      }
    }
  }, { runnerModuleOverride: fakeRunner });

  const candidate =
    workerModule.presentationResidentScheduleCandidateMailbox.peekLatest();
  const admission = {
    schema:
      'peercompute.ulg.presentation-worker-committed-resident-schedule-presentation.v0',
    status:
      'state-manager-committed-resident-schedule-presentation-admission',
    scheduleId,
    laneId,
    stateKey,
    candidateVersion: candidate.version,
    authority: {
      status: 'state-manager-committed-worker-schedule',
      computeManagerCompletionSchema:
        'peercompute.ulg.schroeder-worker-lane-compute-manager-completion.v0',
      computeManagerLeaseId: 'lease:controlled-presentation-proof',
      computeManagerLeaseStatus: 'completed',
      computeManagerFenceSatisfied: true,
      stateManagerCommitStatus: 'committed',
      stateManagerCommitAccepted: true
    },
    terminalFence
  };
  const previousFence = fakeDevice.queue.onSubmittedWorkDone;
  const previousRequestAnimationFrame = fakeSelf.requestAnimationFrame;
  const previousCancelAnimationFrame = fakeSelf.cancelAnimationFrame;
  const previousNow = fakeSelf.performance.now;
  const pendingFences = [];
  const pendingRafs = new Map();
  let nextRafHandle = 0;
  let clockMs = previousNow() + 1_000;
  fakeDevice.queue.onSubmittedWorkDone = () => new Promise((resolve) => {
    pendingFences.push(resolve);
  });
  fakeSelf.requestAnimationFrame = (callback) => {
    const handle = ++nextRafHandle;
    pendingRafs.set(handle, callback);
    return handle;
  };
  fakeSelf.cancelAnimationFrame = (handle) => {
    pendingRafs.delete(handle);
  };
  fakeSelf.performance.now = () => clockMs;
  const takeRaf = () => {
    const entry = pendingRafs.entries().next().value;
    assert.ok(entry, 'expected a pending worker RAF callback');
    pendingRafs.delete(entry[0]);
    return entry[1];
  };
  try {
    const messageCountBefore = postedMessages.length;
    const pausedKeyframe = playbackCase.startsWith('paused-keyframe-');
    if (pausedKeyframe) {
      workerModule.setWorkerPresentationPlaybackState({ playing: false, revision: ++playbackTestRevision });
    }
    const submitted =
      workerModule.presentCommittedResidentScheduleCandidate(admission);
    assert.equal(
      submitted.status,
      'worker-offscreen-resident-particle-keyframe-submitted'
    );
    assert.equal(pendingFences.length, 1);
    assert.equal(pendingRafs.size, 1,
      'the keyframe callback is armed before its exact GPU fence fulfills');
    assert.equal(postedMessages.slice(messageCountBefore).some((message) => (
      message?.workerOffscreenRenderRows?.presentationFrameAdmitted === true
    )), false);

    if (pausedKeyframe) {
      const computeCount = fakeGpuRecords.computePasses.length;
      const initialCallback = takeRaf();
      const camera = new Float32Array(16);
      camera[0] = 7;
      fakeSelf.onmessage({ data: {
        type: 'update-preview-view-projection', viewProjectionMatrix: camera
      } });
      const backgroundCase = playbackCase.includes('background');
      const backgroundAlpha = playbackCase.endsWith('-resize') ? 0 : 0.5;
      const expectedBackground = { r: 0x12 / 255 * backgroundAlpha,
        g: 0x34 / 255 * backgroundAlpha, b: 0x56 / 255 * backgroundAlpha, a: backgroundAlpha };
      if (backgroundCase) {
        let invalidRedraws = 0;
        for (const epoch of [null, 0, playbackTestFramebufferEpoch - 1, playbackTestFramebufferEpoch + 1]) {
          assert.equal(await workerModule.updateWorkerPresentationBackground({
            workerFramebufferEpoch: epoch, backgroundColor: '#ffffff', clearAlpha: 1
          }, { presenter: { redraw() { invalidRedraws++; } } }), false);
        }
        assert.equal(invalidRedraws, 0, 'stale/future/absent epochs cannot redraw or adopt authority');
        fakeSelf.onmessage({ data: {
          type: 'update-presentation-background', backgroundColor: '#123456', clearAlpha: backgroundAlpha,
          workerFramebufferEpoch: playbackTestFramebufferEpoch
        } });
      }
      if (playbackCase.endsWith('-resize')) {
        fakeSelf.onmessage({ data: {
          type: 'resize', width: 37, height: 23, cssWidth: 37, cssHeight: 23,
          pixelRatio: 1, workerFramebufferEpoch: ++playbackTestFramebufferEpoch,
          reason: 'paused-pending-keyframe-resize'
        } });
        assert.equal(await flushUntil(() => fakeCanvas.width === 37), true);
      }
      await new Promise(resolve => setImmediate(resolve));
      pendingFences[0]();
      await new Promise(resolve => setImmediate(resolve));
      clockMs += 16;
      initialCallback(clockMs);
      assert.equal(await flushUntil(() => pendingFences.length === 2), true,
        'pending camera/resize survives the first keyframe proof wait');
      const uniforms = () => fakeGpuRecords.writes.findLast(args =>
        args[0]?.label === 'ulg-offscreen-render-rows-uniforms')?.[2];
      assert.equal(uniforms()[0], 7);
      assert.equal(uniforms()[22], 0);
      assert.equal(uniforms()[16], fakeCanvas.width);
      assert.equal(uniforms()[17], fakeCanvas.height);
      if (backgroundCase) {
        const clear = fakeGpuRecords.renderPasses.at(-1).descriptor.colorAttachments[0].clearValue;
        assert.deepEqual(clear, expectedBackground, 'particle clear remains correctly premultiplied');
      }
      pendingFences[1]();
      await new Promise(resolve => setImmediate(resolve));
      clockMs += 16;
      takeRaf()(clockMs);
      assert.equal(await flushUntil(() => postedMessages.slice(messageCountBefore)
        .some(message => message?.workerOffscreenRenderRows?.presentationFrameAdmitted === true
          && message.workerOffscreenRenderRows.workerFramebufferEpoch === playbackTestFramebufferEpoch)), true);
      await new Promise(resolve => setImmediate(resolve));
      clockMs += 10_000;
      assert.equal(pendingRafs.size, 0, 'manual keyframe stays frozen after proof');
      assert.equal(pendingFences.length, 2);
      for (const x of [8, 9, 10]) {
        const trailing = new Float32Array(16); trailing[0] = x;
        fakeSelf.onmessage({ data: {
          type: 'update-preview-view-projection', viewProjectionMatrix: trailing
        } });
        if (backgroundCase) fakeSelf.onmessage({ data: {
          type: 'update-presentation-background', backgroundColor: x === 9 ? '#abcdef' : '#123456', clearAlpha: backgroundAlpha,
          workerFramebufferEpoch: playbackTestFramebufferEpoch
        } });
      }
      assert.equal(await flushUntil(() => pendingFences.length === 3), true);
      assert.equal(uniforms()[0], 10, 'burst keeps the trailing camera matrix');
      assert.equal(uniforms()[22], 0);
      if (backgroundCase) {
        assert.deepEqual(fakeGpuRecords.renderPasses.at(-1).descriptor.colorAttachments[0].clearValue,
          expectedBackground, 'A/B/A retains the trailing appearance');
      }
      pendingFences[2]();
      await new Promise(resolve => setImmediate(resolve));
      clockMs += 16;
      takeRaf()(clockMs);
      await new Promise(resolve => setImmediate(resolve));
      assert.equal(pendingFences.length, 3, 'camera burst coalesces to one fresh draw');
      assert.equal(fakeGpuRecords.computePasses.length, computeCount,
        'frozen controls cannot recapture/produce mutable physics rows');
      workerModule.setWorkerPresentationPlaybackState({ playing: true, revision: ++playbackTestRevision });
      assert.equal(await flushUntil(() => pendingRafs.size === 1), true);
      clockMs += 16;
      takeRaf()(clockMs);
      assert.equal(await flushUntil(() => pendingFences.length === 4), true);
      assert.ok(Math.abs(uniforms()[22] - 0.016) < 1e-6,
        'resume spends only new active wall time, not the ten-second pause');
      return;
    }

    clockMs += 1;
    takeRaf()(clockMs);
    assert.equal(pendingRafs.size, 0,
      'an early callback is consumed without spinning another callback while GPU work is pending');
    assert.equal(pendingFences.length, 1);
    assert.equal(postedMessages.slice(messageCountBefore).some((message) => (
      message?.workerOffscreenRenderRows?.presentationFrameAdmitted === true
    )), false, 'a callback preceding GPU completion cannot admit a keyframe');

    pendingFences[0]();
    assert.equal(await flushUntil(() => pendingRafs.size === 1), true);
    assert.equal(nextRafHandle, 2, 'one fresh callback replaces the consumed early callback');
    assert.equal(postedMessages.slice(messageCountBefore).some((message) => (
      message?.workerOffscreenRenderRows?.presentationFrameAdmitted === true
    )), false, 'GPU completion alone must not admit the keyframe');

    clockMs += 20;
    takeRaf()(clockMs);
    assert.equal(await flushUntil(() => pendingFences.length >= 2), true);
    const keyframe = postedMessages
      .slice(messageCountBefore)
      .map((message) => message?.workerOffscreenRenderRows)
      .findLast((receipt) => receipt?.presentationFrameAdmitted === true);
    assert.equal(
      keyframe.presentationFramePresentationOpportunityMethod,
      'worker-request-animation-frame-after-gpu-completion'
    );
    assert.equal(keyframe.motionFrameAdmitted, false);
    assert.equal(workerModule.hasWorkerParticleTemporalSubmissionBoundaryOpportunity(), true,
      'an admitted source with unspent active-wall budget offers boundary work');
    assert.equal(pendingRafs.size, 1,
      'the next submitted motion frame also prearms its own callback');

    if (playbackCase !== 'ordinary') {
      const boundaryRejection = playbackCase === 'pause-qos-wait'
        ? assert.rejects(workerModule.runWorkerParticleTemporalPresentationSubmissionBoundary({
          submissionOrdinal: 1, completedSubstepCount: 2, totalSubstepCount: 64, chunkStepCount: 2
        }), /superseded|unavailable|completed presentation opportunity/)
        : null;
      if (playbackCase === 'exhausted-resume') clockMs += 300;
      if (playbackCase === 'pause-after-fence') {
        pendingFences[1]();
        await new Promise(resolve => setImmediate(resolve));
      }
      const staleRaf = takeRaf();
      const messageStart = postedMessages.length;
      workerModule.setWorkerPresentationPlaybackState({ playing: false, revision: ++playbackTestRevision });
      if (playbackCase === 'rapid-pause-resume') {
        workerModule.setWorkerPresentationPlaybackState({ playing: true, revision: ++playbackTestRevision });
      }
      pendingFences[1]();
      await new Promise(resolve => setImmediate(resolve));
      clockMs += 5_000;
      staleRaf(clockMs);
      await new Promise(resolve => setImmediate(resolve));
      if (boundaryRejection) await boundaryRejection;
      assert.equal(postedMessages.slice(messageStart).some(message =>
        message?.workerOffscreenRenderRows?.motionFrameAdmitted === true), false,
      'playback revision invalidates the old motion proof even after pause/resume');
      assert.equal(await flushUntil(() => pendingFences.length === 3), true,
        'one same-source repaint follows drained unadmitted pixels');
      const repaintUniforms = fakeGpuRecords.writes.findLast(args =>
        args[0]?.label === 'ulg-offscreen-render-rows-uniforms')?.[2];
      assert.equal(repaintUniforms?.[22], 0, 'repaint uses last admitted age0, not submitted future motion');
      pendingFences[2]();
      assert.equal(await flushUntil(() => pendingRafs.size > 0), true);
      clockMs += 16;
      takeRaf()(clockMs);
      assert.equal(await flushUntil(() => postedMessages.slice(messageStart).some(message =>
        message?.workerOffscreenRenderRows?.motionFrameAdmitted === true)), true);
      const frozen = postedMessages.map(message => message?.workerOffscreenRenderRows)
        .findLast(receipt => receipt?.motionFrameAdmitted === true);
      assert.equal(frozen.motionAgeS, 0);
      assert.equal(frozen.motionSourceSphStep, keyframe.sphStep);
      assert.equal(frozen.motionAgeSource, 'explicit-frozen-redraw');
      assert.ok(frozen.presentationQueueCompletionSerial > keyframe.presentationQueueCompletionSerial);
      if (playbackCase !== 'rapid-pause-resume') {
        clockMs += 10_000;
        await new Promise(resolve => setImmediate(resolve));
        assert.equal(pendingRafs.size, 0, 'paused source has no autonomous work');
        assert.equal(pendingFences.length, 3);
      }
      if (playbackCase === 'exhausted-resume') {
        workerModule.setWorkerPresentationPlaybackState({ playing: true, revision: ++playbackTestRevision });
        assert.equal(workerModule.hasWorkerParticleTemporalSubmissionBoundaryOpportunity(), false,
          'an exhausted active-wall budget cannot request presentation-only queue flushes');
        assert.equal(await flushUntil(() => pendingRafs.size === 1), true);
        clockMs += 16;
        takeRaf()(clockMs);
        await new Promise(resolve => setImmediate(resolve));
        assert.equal(pendingFences.length, 3, 'resume cannot renew an exhausted active-wall budget');
        assert.equal(pendingRafs.size, 0);
      }
      return;
    }

    const registrationsBeforeMotionGpu = nextRafHandle;
    pendingFences[1]();
    assert.equal(await flushUntil(() => pendingRafs.size === 1), true);
    assert.equal(nextRafHandle, registrationsBeforeMotionGpu,
      'a pending callback after GPU completion needs no second registration');
    clockMs += 16;
    takeRaf()(clockMs);
    assert.equal(await flushUntil(() => postedMessages
      .slice(messageCountBefore)
      .some((message) => (
        message?.workerOffscreenRenderRows?.motionFrameAdmitted === true
      ))), true);
    const motion = postedMessages
      .slice(messageCountBefore)
      .map((message) => message?.workerOffscreenRenderRows)
      .findLast((receipt) => receipt?.motionFrameAdmitted === true);
    assert.equal(
      motion.motionFrameSchema,
      'peercompute.ulg.worker-offscreen-particle-temporal-motion-frame.v0'
    );
    assert.equal(motion.motionSourceSphStep, keyframe.sphStep);
    assert.equal(motion.motionSourceFrameCount, keyframe.frameCount);
    assert.ok(motion.frameCount > keyframe.frameCount);
    assert.equal(motion.motionAgeSource, 'explicit-qos-midpoint');
    assert.equal(
      motion.motionAgeS,
      0.001,
      'the first autonomous cover samples the midpoint before boundary 1/32'
    );
    assert.equal(
      motion.presentationQueueCompletionCount,
      motion.presentationQueueCompletionSerial
    );
    assert.equal(
      motion.presentationQueueCompletionScope,
      'worker-offscreen-shared-device-queue-frame-proof'
    );
    assert.equal(
      motion.physicsQueuePrefixCoverage,
      'physics-queue-prefix-not-attributed'
    );
    assert.equal(motion.physicsHostQueueFenceParticipation, null);
    const boundary = {
      submissionOrdinal: 1, completedSubstepCount: 2, totalSubstepCount: 64, chunkStepCount: 2
    };
    const controller = new AbortController();
    const abortedBoundary = workerModule.runWorkerParticleTemporalPresentationSubmissionBoundary(
      boundary, { signal: controller.signal }
    );
    assert.equal(await flushUntil(() => pendingFences.length === 3), true);
    controller.abort();
    pendingFences[2]();
    assert.equal(await flushUntil(() => pendingRafs.size === 1), true);
    clockMs += 16;
    takeRaf()(clockMs);
    await assert.rejects(abortedBoundary, /generation-superseded|was superseded|completed presentation opportunity/);
    assert.equal(await flushUntil(() => pendingRafs.size === 1), true,
      'failed boundary must restart ordinary autonomous motion');
    clockMs += 16;
    takeRaf()(clockMs);
    assert.equal(await flushUntil(() => pendingFences.length === 4), true);
    pendingFences[3]();
    assert.equal(await flushUntil(() => pendingRafs.size === 1), true);
    clockMs += 16;
    takeRaf()(clockMs);
    assert.equal(await flushUntil(() => postedMessages.some(message =>
      message?.workerOffscreenRenderRows?.motionFrameSerial > motion.motionFrameSerial)), true);
    const resumed = postedMessages.map(message => message?.workerOffscreenRenderRows)
      .findLast(receipt => receipt?.motionFrameAdmitted === true);
    assert.equal(resumed.physicsQueuePrefixCoverage, 'physics-queue-prefix-not-attributed');
    assert.equal(resumed.physicsHostQueueFenceParticipation, null);
    assert.equal(resumed.motionSourceSphStep, keyframe.sphStep);
  } finally {
    fakeSelf.onmessage({
      data: {
        type: 'clear',
        workerFramebufferEpoch: ++playbackTestFramebufferEpoch,
        reason: 'controlled-presentation-proof-cleanup'
      }
    });
    await flushUntil(() => postedMessages.some((message) => (
      message?.status === 'worker-offscreen-presentation-ready'
      && message?.reason === 'controlled-presentation-proof-cleanup'
    )));
    fakeDevice.queue.onSubmittedWorkDone = previousFence;
    fakeSelf.requestAnimationFrame = previousRequestAnimationFrame;
    fakeSelf.cancelAnimationFrame = previousCancelAnimationFrame;
    workerTestClockFloorMs = Math.max(workerTestClockFloorMs, clockMs);
    fakeSelf.performance.now = previousNow;
    for (const resolve of pendingFences) resolve();
    if (typeof workerModule.setWorkerPresentationPlaybackState === 'function') {
      workerModule.setWorkerPresentationPlaybackState({ playing: true, revision: ++playbackTestRevision });
    }
  }
});
}

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

test('worker true-isosurface admission forwards the exact retained product-history handle', async () => {
  await ensureFakePresentationReady();
  const scheduleId = 'ulg:test:worker-isosurface-product-handoff';
  const laneId = 'ulg:test:worker-isosurface-product-handoff-lane';
  const stateKey = 'ulg:test:worker-isosurface-product-handoff-state';
  const terminalFence = {
    required: true,
    scope: 'resident-schedule-terminal',
    terminalScheduleFence: true,
    fenceSatisfied: true,
    authorityAdmissionReady: true,
    scheduleId,
    laneId,
    stateKey,
    completedStepCount: 1,
    queueCompletionStatus: 'queue-work-completed',
    queueCompletionMethod: 'worker-device.queue.onSubmittedWorkDone'
  };
  const retainedBuffer = { mapAsync() {} };
  const residentProductMass = { id: 'exact-worker-retained-product-history' };
  const retained = {
    status: 'worker-retained-particle-state-ready',
    sourceStateBuffer: retainedBuffer,
    sourceThermoBuffer: retainedBuffer,
    residentProductMass,
    particleCount: 2,
    stateStrideFloats: 8,
    thermoStrideFloats: 12,
    stateBufferByteLength: 64,
    thermoBufferByteLength: 96
  };
  let presentationBoundaryCallback;
  let canonicalPresentationBoundaryCallback;
  const canonicalBoundary = Object.freeze({
    submissionOrdinal: 1, completedSubstepCount: 1, totalSubstepCount: 2, chunkStepCount: 1
  });
  const canonicalFrameProof = isosurfaceBoundaryFrameProof(canonicalBoundary, 23);
  const canonicalController = new AbortController();
  const boundaryCalls = [];
  const fakeRunner = {
    async runUlgMechanicsResidentStageWorkerSchedulePayload(_payload, options) {
      presentationBoundaryCallback = options.onTier0PresentationSubmissionBoundary;
      canonicalPresentationBoundaryCallback = options.onCanonicalPresentationSubmissionBoundary;
      assert.equal(options.canPresentCanonicalSubmissionBoundary(), true);
      assert.equal(canonicalPresentationBoundaryCallback, presentationBoundaryCallback,
        'both schedule routes must redraw the same committed display source');
      assert.equal(options.postProgress, undefined,
        'true isosurfaces use retained mesh opportunities, never intermediate particle previews');
      const boundaryReceipt = await canonicalPresentationBoundaryCallback(canonicalBoundary, {
        signal: canonicalController.signal
      });
      assert.equal(boundaryReceipt.isosurfaceFrameProof, canonicalFrameProof);
      assert.equal(enqueueCalls.length, 0,
        'canonical between-step rendering must not enqueue intermediate solver state');
      return {
        schema: 'peercompute.ulg.worker-resident-schedule-result.v0',
        status: 'worker-resident-schedule-completed',
        scheduleId,
        laneId,
        stateKey,
        requestedStepCount: 1,
        completedStepCount: 1,
        cancelled: false,
        finalEpochIdentity: scheduleEpochIdentity(1, {
          storageGeneration: 211
        }),
        perStepSummaries: {
          lastStep: { stepOrdinal: 1, particleCount: 2 }
        },
        gpuFence: terminalFence
      };
    },
    resolveUlgMechanicsResidentStageWorkerRetainedParticleState() {
      return retained;
    }
  };
  const enqueueCalls = [];
  const isosurfacePresenter = {
    async presentSubmissionBoundary(boundary, { signal }) {
      assert.equal(signal, canonicalController.signal);
      boundaryCalls.push(boundary);
      return canonicalFrameProof;
    },
    async enqueue(options) {
      enqueueCalls.push(options);
      return {
        status:
          'worker-offscreen-resident-isosurface-presentation-enqueued',
        reason: 'unit-product-history-handoff'
      };
    }
  };
  await workerModule.runResidentScheduleOnPresentationDevice({
    payload: {
      schedule: { scheduleId, stepCount: 1 },
      lease: { laneId, stateKey },
      context: {
        ulgMechanicsResidentStageWorker: {
          common: {
            presentationWorkerRenderRetainedStageOutput: {
              enabled: true,
              sourceStageId: 'schroederSameLevelMechanics',
              particleCount: 2,
              stateStrideFloats: 8,
              thermoStrideFloats: 12,
              stateByteLength: 64,
              thermoByteLength: 96,
              residentScheduleLivePreview: true,
              workerOwnedIsosurface: {
                enabled: true,
                marker: 'unit-product-history-handoff'
              }
            }
          }
        }
      }
    }
  }, {
    runnerModuleOverride: fakeRunner,
    workerOwnedIsosurfacePresenterOverride: isosurfacePresenter
  });
  assert.equal(typeof presentationBoundaryCallback, 'function',
    'true-isosurface requests must enable the existing bounded solver-submission hook');
  assert.equal(typeof canonicalPresentationBoundaryCallback, 'function');
  assert.deepEqual(boundaryCalls, [canonicalBoundary]);
  const candidate =
    workerModule.presentationResidentScheduleCandidateMailbox.peekLatest();
  const receipt = await workerModule.presentCommittedResidentScheduleCandidate({
    schema:
      'peercompute.ulg.presentation-worker-committed-resident-schedule-presentation.v0',
    status:
      'state-manager-committed-resident-schedule-presentation-admission',
    scheduleId,
    laneId,
    stateKey,
    candidateVersion: candidate.version,
    authority: {
      status: 'state-manager-committed-worker-schedule',
      computeManagerCompletionSchema:
        'peercompute.ulg.schroeder-worker-lane-compute-manager-completion.v0',
      computeManagerLeaseId: 'lease:worker-isosurface-product-handoff',
      computeManagerLeaseStatus: 'completed',
      computeManagerFenceSatisfied: true,
      stateManagerCommitStatus: 'committed',
      stateManagerCommitAccepted: true
    },
    terminalFence
  });

  assert.equal(
    receipt.status,
    'worker-offscreen-resident-isosurface-presentation-enqueued'
  );
  assert.equal(enqueueCalls.length, 1);
  assert.equal(enqueueCalls[0].retained, retained);
  assert.equal(
    enqueueCalls[0].retained.residentProductMass,
    residentProductMass
  );
  assert.equal(
    enqueueCalls[0].request.marker,
    'unit-product-history-handoff'
  );
});

async function runIsosurfaceBootstrapFixture({
  label,
  seedPatch = null,
  onRun = null,
  resultPatch = null,
  beforeAdmission = null,
  rejectAdmissionFirst = false,
  presenterMethods = null,
  expectProgress = false,
  afterSchedule = null,
  skipAdmission = false,
  timeoutMs = undefined,
  synchronousRunnerError = null
}) {
  await ensureFakePresentationReady();
  const scheduleId = `ulg:test:bootstrap:${label}`;
  const laneId = `${scheduleId}:lane`;
  const stateKey = `${scheduleId}:state`;
  const sourceLineage = scheduleEpochIdentity(0, { storageGeneration: 41 });
  const targetLineage = scheduleEpochIdentity(2, { storageGeneration: 42 });
  // Canonical final spatial seal and post-step particle lineage are distinct.
  const finalEpochIdentity = scheduleEpochIdentity(1, { storageGeneration: 42 });
  const retainedBuffer = { mapAsync() {} };
  const makeRetained = (lineage, time) => ({
    status: 'worker-retained-particle-state-ready',
    sameWorkerPrivateReferences: true,
    laneId, stateKey,
    sourceStateBuffer: retainedBuffer,
    sourceThermoBuffer: retainedBuffer,
    particleCount: 2, stateStrideFloats: 8, thermoStrideFloats: 12,
    stateBufferByteLength: 64, thermoBufferByteLength: 96,
    sphParticleUpload: { ...lineage, time },
    mlsMpmParticleUpload: { ...lineage }
  });
  const seed = makeRetained(sourceLineage, 2);
  const terminal = makeRetained(targetLineage, 2.064);
  seedPatch?.(seed);
  let retained = seed;
  const terminalFence = {
    required: true, scope: 'resident-schedule-terminal', terminalScheduleFence: true,
    fenceSatisfied: true, authorityAdmissionReady: true,
    scheduleId, laneId, stateKey, completedStepCount: 2,
    queueCompletionStatus: 'queue-work-completed',
    queueCompletionMethod: 'worker-device.queue.onSubmittedWorkDone'
  };
  const routeSchema = 'peercompute.ulg.worker-schedule-execution-route-receipt.v6';
  const result = {
    schema: 'peercompute.ulg.worker-resident-schedule-result.v0',
    status: 'worker-resident-schedule-completed',
    scheduleId, laneId, stateKey,
    requestedStepCount: 2, completedStepCount: 2, cancelled: false,
    finalEpochIdentity,
    finalMechanicsLineage: { ...targetLineage },
    executionRouteReceipt: {
      schema: routeSchema, status: 'canonical-schroeder-admitted',
      scheduleId, laneId, stateKey,
      lineage: { source: { ...sourceLineage }, target: { ...targetLineage } }
    },
    perStepSummaries: { lastStep: { stepOrdinal: 2, particleCount: 2 } },
    gpuFence: terminalFence
  };
  const enqueueCalls = [];
  const resolverCalls = [];
  let runnerOptions = null;
  const firstMessage = postedMessages.length;
  const oldClock = fakeSelf.performance.now;
  let clockMs = 1000;
  fakeSelf.performance.now = () => clockMs;
  const fakeRunner = {
    ULG_WORKER_SCHEDULE_EXECUTION_ROUTE_RECEIPT_SCHEMA: routeSchema,
    resolveUlgMechanicsResidentStageWorkerRetainedParticleState(options) {
      resolverCalls.push({ ...options, time: retained.sphParticleUpload?.time });
      return retained;
    },
    async runUlgMechanicsResidentStageWorkerSchedulePayload(_payload, options) {
      runnerOptions = options;
      assert.equal(enqueueCalls.length, 0, 'a seed must never be presented as committed');
      if (expectProgress) {
        assert.equal(typeof options.postProgress, 'function', 'accepted private progress must reach the runner');
      } else {
        assert.equal(options.postProgress, undefined, 'isosurfaces must not draw live previews');
      }
      await onRun?.({ seed, terminal, result, options, scheduleId, laneId, stateKey,
        enqueueCalls, resolverCalls, firstMessage });
      retained = terminal;
      clockMs = 1500;
      resultPatch?.(result);
      return result;
    }
  };
  if (synchronousRunnerError) {
    fakeRunner.runUlgMechanicsResidentStageWorkerSchedulePayload = (_payload, options) => {
      runnerOptions = options;
      throw synchronousRunnerError;
    };
  }
  try {
    await workerModule.runResidentScheduleOnPresentationDevice({ timeoutMs, payload: {
      schedule: { scheduleId, stepCount: 2 },
      lease: { laneId, stateKey },
      context: { ulgMechanicsResidentStageWorker: { common: {
        presentationWorkerRenderRetainedStageOutput: {
          enabled: true, sourceStageId: 'schroederSameLevelMechanics',
          workerOwnedIsosurface: { enabled: true },
          residentScheduleLivePreview: true
        }
      } } }
    } }, {
      runnerModuleOverride: fakeRunner,
      workerOwnedIsosurfacePresenterOverride: {
        ...presenterMethods,
        async enqueue(options) {
          enqueueCalls.push(options);
          return { status: 'worker-offscreen-resident-isosurface-presentation-enqueued' };
        }
      }
    });
    assert.equal(enqueueCalls.length, 0, 'terminal timing alone cannot authorize presentation');
    await afterSchedule?.({ runnerOptions, scheduleId, laneId, stateKey, result, enqueueCalls });
    if (skipAdmission) {
      return { enqueueCalls, resolverCalls, runnerOptions,
        messages: postedMessages.slice(firstMessage) };
    }
    const candidate = workerModule.presentationResidentScheduleCandidateMailbox.peekLatest();
    const admission = {
      schema: 'peercompute.ulg.presentation-worker-committed-resident-schedule-presentation.v0',
      status: 'state-manager-committed-resident-schedule-presentation-admission',
      scheduleId, laneId, stateKey,
      candidateVersion: candidate?.version,
      terminalFence,
      authority: {
        status: 'state-manager-committed-worker-schedule',
        computeManagerCompletionSchema: 'peercompute.ulg.schroeder-worker-lane-compute-manager-completion.v0',
        computeManagerLeaseId: `${scheduleId}:lease`, computeManagerLeaseStatus: 'completed',
        computeManagerFenceSatisfied: true,
        stateManagerCommitStatus: 'committed', stateManagerCommitAccepted: true
      }
    };
    if (rejectAdmissionFirst) {
      const blocked = await workerModule.presentCommittedResidentScheduleCandidate({
        ...admission, authority: { ...admission.authority, stateManagerCommitAccepted: false }
      });
      assert.equal(blocked.stateManagerCommittedPresentation, false);
      assert.equal(enqueueCalls.length, 0);
    }
    await beforeAdmission?.({ terminal, result, candidate });
    clockMs = 1800;
    const receipt = await workerModule.presentCommittedResidentScheduleCandidate(admission);
    assert.equal(JSON.stringify(postedMessages.slice(firstMessage)).includes(
      'peercompute.ulg.isosurface-source-timing-bootstrap.v0'
    ), false, 'private timing must not change any posted candidate or authority schema');
    return { enqueueCalls, resolverCalls, receipt, candidate, seed, terminal, sourceLineage, targetLineage,
      runnerOptions, messages: postedMessages.slice(firstMessage) };
  } finally {
    fakeSelf.performance.now = oldClock;
  }
}

test('first-source timing snapshots the actual seed and reaches only the exact committed isosurface', async () => {
  const result = await runIsosurfaceBootstrapFixture({
    label: 'exact', rejectAdmissionFirst: true,
    onRun({ seed }) {
      seed.sphParticleUpload.time = 99;
      seed.sphParticleUpload.supportEpoch = 99;
      seed.mlsMpmParticleUpload.supportEpoch = 99;
    },
    beforeAdmission({ result: schedule }) {
      schedule.executionRouteReceipt.lineage.target.supportEpoch = 99;
      schedule.finalMechanicsLineage.supportEpoch = 99;
    }
  });
  assert.equal(result.enqueueCalls.length, 1);
  assert.equal(result.resolverCalls.length, 2, 'only seed and existing committed resolver are needed');
  assert.equal(result.resolverCalls[0].time, 2);
  const timing = result.enqueueCalls[0].sourceTimingBootstrap;
  assert.equal(timing.schema, 'peercompute.ulg.isosurface-source-timing-bootstrap.v0');
  assert.equal(timing.sourceTimeS, 2);
  assert.equal(timing.sourceObservedAtMs, 1000);
  assert.equal(timing.terminalSourceTimeS, 2.064);
  assert.deepEqual(timing.sourceLineage, result.sourceLineage);
  assert.deepEqual(timing.targetLineage, result.targetLineage);
  assert.deepEqual(timing.candidateVersion, result.candidate.version);
  assert.equal(timing.presentationLaneEpoch, result.candidate.presentationLaneEpoch);
  assert.notEqual(timing.candidateVersion.nextStep, timing.targetLineage.physicsTick);
  for (const value of [timing, timing.candidateVersion, timing.sourceLineage, timing.targetLineage]) {
    assert.equal(Object.isFrozen(value), true);
  }
  result.terminal.sphParticleUpload.time = 100;
  assert.equal(timing.terminalSourceTimeS, 2.064, 'terminal time must also be a scalar snapshot');
});

test('first-source timing accepts an actual zero-time seed without inventing a previous frame', async () => {
  const result = await runIsosurfaceBootstrapFixture({
    label: 'zero-time', seedPatch: seed => { seed.sphParticleUpload.time = 0; }
  });
  assert.equal(result.enqueueCalls.length, 1);
  assert.equal(result.enqueueCalls[0].sourceTimingBootstrap.sourceTimeS, 0);
});

function useActualRematerializedSeedClockShape(seed) {
  delete seed.sphParticleUpload.time;
  for (const upload of [seed.sphParticleUpload, seed.mlsMpmParticleUpload]) {
    upload.sourceStage = 'schroeder-adopted-particle-storage-worker-rematerialization';
    upload.particleCount = seed.particleCount;
  }
  seed.sphParticleState = {
    particleCount: seed.particleCount, step: seed.sphParticleUpload.physicsTick, time: 0
  };
  seed.mlsMpmParticleState = { ...seed.sphParticleState };
}

test('real rematerialized seed shape uses its matching retained descriptor clock', async () => {
  const result = await runIsosurfaceBootstrapFixture({
    label: 'rematerialized-seed-clock', seedPatch: useActualRematerializedSeedClockShape,
    onRun({ seed }) {
      seed.sphParticleState.time = 999;
      seed.mlsMpmParticleState.time = 999;
    }
  });
  assert.equal(result.resolverCalls[0].time, undefined, 'the real seed upload has no time');
  assert.equal(result.enqueueCalls.length, 1);
  assert.equal(result.enqueueCalls[0].sourceTimingBootstrap.sourceTimeS, 0);
  assert.equal(result.enqueueCalls[0].sourceTimingBootstrap.sourceObservedAtMs, 1000);
});

for (const [label, change] of [
  ['explicit-undefined', seed => { seed.sphParticleUpload.time = undefined; }],
  ['explicit-null', seed => { seed.sphParticleUpload.time = null; }],
  ['explicit-nan', seed => { seed.sphParticleUpload.time = NaN; }],
  ['explicit-string', seed => { seed.sphParticleUpload.time = '0'; }],
  ['wrong-producer', seed => { seed.mlsMpmParticleUpload.sourceStage = 'other'; }],
  ['missing-descriptor', seed => { seed.mlsMpmParticleState = null; }],
  ['descriptor-clock-mismatch', seed => { seed.mlsMpmParticleState.time = 1; }],
  ['descriptor-step-mismatch', seed => { seed.sphParticleState.step++; }],
  ['descriptor-count-mismatch', seed => { seed.mlsMpmParticleState.particleCount++; }],
  ['upload-count-mismatch', seed => { seed.sphParticleUpload.particleCount++; }]
]) {
  test(`retained seed descriptor fallback rejects ${label} without inventing timing`, async () => {
    const result = await runIsosurfaceBootstrapFixture({
      label: `seed-descriptor-${label}`,
      seedPatch(seed) { useActualRematerializedSeedClockShape(seed); change(seed); }
    });
    assert.equal(result.enqueueCalls.length, 1);
    assert.equal(result.enqueueCalls[0].sourceTimingBootstrap, null);
  });
}

for (const [label, options] of [
  ['missing-seed', { seedPatch: seed => { seed.status = 'worker-retained-particle-state-missing-lane'; } }],
  ['invalid-seed-time', { seedPatch: seed => { seed.sphParticleUpload.time = NaN; } }],
  ['negative-seed-time', { seedPatch: seed => { seed.sphParticleUpload.time = -1; } }],
  ['coerced-seed-lineage', { seedPatch: seed => { seed.sphParticleUpload.physicsTick = '100'; } }],
  ['wrong-route-schema', { resultPatch: result => { result.executionRouteReceipt.schema = 'forged'; } }],
  ['wrong-route-schedule', { resultPatch: result => { result.executionRouteReceipt.scheduleId = 'other'; } }],
  ['wrong-route-source', { resultPatch: result => { result.executionRouteReceipt.lineage.source.supportEpoch++; } }],
  ['wrong-route-target', { resultPatch: result => { result.executionRouteReceipt.lineage.target.supportEpoch++; } }],
  ['cancelled-schedule', { resultPatch: result => { result.cancelled = true; } }],
  ['replaced-terminal-family', { beforeAdmission: ({ terminal }) => {
    terminal.sphParticleUpload.supportEpoch++;
    terminal.mlsMpmParticleUpload.supportEpoch++;
  } }],
  ['mismatched-terminal-mls', { beforeAdmission: ({ terminal }) => { terminal.mlsMpmParticleUpload.physicsTick++; } }],
  ['nonadvancing-time', { beforeAdmission: ({ terminal }) => { terminal.sphParticleUpload.time = 2; } }],
  ['invalid-terminal-time', { beforeAdmission: ({ terminal }) => { terminal.sphParticleUpload.time = Infinity; } }]
]) {
  test(`optional first-source timing rejects ${label} without blocking committed geometry`, async () => {
    const result = await runIsosurfaceBootstrapFixture({ label, ...options });
    assert.equal(result.enqueueCalls.length, 1);
    assert.equal(result.enqueueCalls[0].sourceTimingBootstrap, null);
    assert.equal(result.receipt.status, 'worker-offscreen-resident-isosurface-presentation-enqueued');
  });
}

async function changeBootstrapCanvas(type, reason) {
  const workerFramebufferEpoch = Math.max(1, ...postedMessages.map(message =>
    Number.isSafeInteger(message.workerFramebufferEpoch) ? message.workerFramebufferEpoch : 0
  )) + 1;
  fakeSelf.onmessage({ data: {
    type, reason, workerFramebufferEpoch, width: 8, height: 8,
    cssWidth: 8, cssHeight: 8, pixelRatio: 1
  } });
  assert.equal(await flushUntil(() => postedMessages.some(message =>
    message.status === 'worker-offscreen-presentation-ready' && message.reason === reason
  )), true);
}

test('first-source timing survives a legitimate resize during schedule execution', async () => {
  const result = await runIsosurfaceBootstrapFixture({
    label: 'resize',
    onRun: () => changeBootstrapCanvas('resize', 'bootstrap-resize')
  });
  assert.equal(result.enqueueCalls.length, 1);
  assert.equal(result.enqueueCalls[0].sourceTimingBootstrap.sourceTimeS, 2);
  assert.equal(Object.hasOwn(result.enqueueCalls[0].sourceTimingBootstrap, 'workerFramebufferEpoch'), false);
});

test('a cleared candidate stream cannot forward an old first-source timing anchor', async () => {
  const result = await runIsosurfaceBootstrapFixture({
    label: 'cleared-stream',
    onRun: () => changeBootstrapCanvas('clear', 'bootstrap-clear-stream')
  });
  assert.equal(result.enqueueCalls.length, 0);
  assert.equal(result.receipt.stateManagerCommittedPresentation, false);
});

test('pending-source progress forwards only scalar counts from an authenticated seed without presenting intermediate state', async () => {
  const starts = [];
  const progress = [];
  const result = await runIsosurfaceBootstrapFixture({
    label: 'pending-progress-exact', expectProgress: true,
    presenterMethods: {
      beginPendingSourceProgress(options) {
        starts.push(options);
        return update => { progress.push(update); };
      }
    },
    onRun({ options, seed, scheduleId, laneId, stateKey, enqueueCalls, resolverCalls }) {
      assert.equal(resolverCalls.length, 1, 'initialize only after validating the actual retained seed');
      assert.equal(starts.length, 1);
      const presentationLaneEpoch = starts[0].presentationLaneEpoch;
      assert.equal(Number.isSafeInteger(presentationLaneEpoch) && presentationLaneEpoch > 0, true);
      assert.deepEqual(starts, [{ scheduleId, laneId, stateKey, presentationLaneEpoch,
        sourceTimeS: 2, totalStepCount: 2 }]);
      seed.sphParticleUpload.time = 99;
      assert.equal(starts[0].sourceTimeS, 2, 'the start clock must not retain a mutable upload alias');
      const raw = { scheduleId, stepOrdinal: 1, completedStepCount: 1 };
      for (const key of ['stepSummary', 'epochIdentity', 'retainedBufferRefs', 'sourceStateBuffer']) {
        Object.defineProperty(raw, key, {
          enumerable: true,
          get() { throw new Error(`private progress must not read ${key}`); }
        });
      }
      const messageCount = postedMessages.length;
      const submitCount = fakeGpuRecords.submits.length;
      assert.doesNotThrow(() => options.postProgress(raw));
      assert.deepEqual(progress, [{ scheduleId, stepOrdinal: 1, completedStepCount: 1 }]);
      assert.notEqual(progress[0], raw, 'never forward the original progress envelope');
      raw.stepOrdinal = 999;
      assert.equal(progress[0].stepOrdinal, 1);
      assert.equal(postedMessages.length, messageCount, 'no intermediate candidate or status publication');
      assert.equal(fakeGpuRecords.submits.length, submitCount, 'no progress-only preview or queue flush');
      assert.equal(enqueueCalls.length, 0, 'progress is not committed-source admission');
    },
    afterSchedule({ runnerOptions, scheduleId }) {
      runnerOptions.postProgress({ scheduleId, stepOrdinal: 2, completedStepCount: 2 });
      assert.equal(progress.length, 1, 'settled runner callbacks are no longer live');
    }
  });
  assert.equal(result.enqueueCalls.length, 1, 'only the existing terminal admission enqueues geometry');
  assert.equal(starts[0].presentationLaneEpoch, result.candidate.presentationLaneEpoch);
  assert.equal(result.receipt.stateManagerCommittedPresentation, true);
});

test('pending-source progress accepts the real rematerialized seed descriptor clock', async () => {
  let start;
  const result = await runIsosurfaceBootstrapFixture({
    label: 'pending-progress-real-seed', expectProgress: true,
    seedPatch: useActualRematerializedSeedClockShape,
    presenterMethods: { beginPendingSourceProgress(options) { start = options; return () => {}; } }
  });
  assert.equal(start.sourceTimeS, 0, 'zero comes from actual matched descriptors, not a default');
  assert.equal(result.resolverCalls[0].time, undefined);
  assert.equal(result.enqueueCalls.length, 1);
});

for (const [label, seedPatch] of [
  ['missing-seed', seed => { seed.status = 'worker-retained-particle-state-missing-lane'; }],
  ['invalid-time', seed => { seed.sphParticleUpload.time = NaN; }],
  ['negative-time', seed => { seed.sphParticleUpload.time = -1; }],
  ['coerced-time', seed => { seed.sphParticleUpload.time = '2'; }],
  ['mismatched-lineage', seed => { seed.mlsMpmParticleUpload.physicsTick++; }]
]) {
  test(`pending-source progress stays absent for ${label}`, async () => {
    let starts = 0;
    const result = await runIsosurfaceBootstrapFixture({
      label: `pending-progress-${label}`, seedPatch,
      presenterMethods: { beginPendingSourceProgress() { starts++; return () => {}; } }
    });
    assert.equal(starts, 0, 'invalid timing must not initialize a progress observer');
    assert.equal(Object.hasOwn(result.runnerOptions, 'postProgress'), false);
    assert.equal(result.enqueueCalls.length, 1, 'optional timing must not block committed geometry');
  });
}

for (const [label, initializer] of [
  ['no-method', undefined],
  ['non-function-method', true],
  ['declined', () => null],
  ['non-function-result', () => ({ enabled: true })],
  ['initializer-error', () => { throw new Error('optional observer unavailable'); }]
]) {
  test(`pending-source progress preserves the original no-callback path when ${label}`, async () => {
    const result = await runIsosurfaceBootstrapFixture({
      label: `pending-progress-${label}`,
      presenterMethods: { beginPendingSourceProgress: initializer }
    });
    assert.equal(Object.hasOwn(result.runnerOptions, 'postProgress'), false);
    assert.equal(result.enqueueCalls.length, 1);
  });
}

test('pending-source progress handler exceptions cannot fail the authoritative schedule', async () => {
  let calls = 0;
  const result = await runIsosurfaceBootstrapFixture({
    label: 'pending-progress-handler-error', expectProgress: true,
    presenterMethods: { beginPendingSourceProgress() { return () => {
      calls++;
      throw new Error('presentation-only handler failed');
    }; } },
    onRun({ options, scheduleId }) {
      assert.doesNotThrow(() => options.postProgress({ scheduleId, stepOrdinal: 1, completedStepCount: 1 }));
    }
  });
  assert.equal(calls, 1);
  assert.equal(result.enqueueCalls.length, 1);
  assert.equal(result.receipt.stateManagerCommittedPresentation, true);
});

test('pending-source progress ignores a callback after its stream is cleared', async () => {
  let calls = 0;
  const result = await runIsosurfaceBootstrapFixture({
    label: 'pending-progress-cleared', expectProgress: true,
    presenterMethods: { beginPendingSourceProgress() { return () => { calls++; }; } },
    async onRun({ options, scheduleId }) {
      await changeBootstrapCanvas('clear', 'pending-progress-clear');
      options.postProgress({ scheduleId, stepOrdinal: 1, completedStepCount: 1 });
    }
  });
  assert.equal(calls, 0);
  assert.equal(result.enqueueCalls.length, 0);
});

test('pending-source progress survives a legitimate framebuffer resize without rebinding source authority', async () => {
  let calls = 0;
  const result = await runIsosurfaceBootstrapFixture({
    label: 'pending-progress-resize', expectProgress: true,
    presenterMethods: { beginPendingSourceProgress() { return () => { calls++; }; } },
    async onRun({ options, scheduleId }) {
      await changeBootstrapCanvas('resize', 'pending-progress-resize');
      options.postProgress({ scheduleId, stepOrdinal: 1, completedStepCount: 1 });
    }
  });
  assert.equal(calls, 1);
  assert.equal(result.enqueueCalls.length, 1);
});

test('pending-source progress ignores an older stream after a different lane takes over', async () => {
  let calls = 0;
  const result = await runIsosurfaceBootstrapFixture({
    label: 'pending-progress-superseded', expectProgress: true,
    presenterMethods: { beginPendingSourceProgress() { return () => { calls++; }; } },
    async onRun({ options, scheduleId }) {
      const successor = await runIsosurfaceBootstrapFixture({ label: 'pending-progress-successor' });
      assert.equal(successor.enqueueCalls.length, 1);
      options.postProgress({ scheduleId, stepOrdinal: 1, completedStepCount: 1 });
    }
  });
  assert.equal(calls, 0);
  assert.equal(result.enqueueCalls.length, 0);
});

test('pending-source progress ignores callbacks after a cancelled runner settles', async () => {
  let calls = 0;
  const result = await runIsosurfaceBootstrapFixture({
    label: 'pending-progress-cancelled', expectProgress: true,
    presenterMethods: { beginPendingSourceProgress() { return () => { calls++; }; } },
    resultPatch: result => { result.cancelled = true; },
    afterSchedule({ runnerOptions, scheduleId }) {
      runnerOptions.postProgress({ scheduleId, stepOrdinal: 1, completedStepCount: 1 });
    }
  });
  assert.equal(calls, 0);
  assert.equal(result.enqueueCalls[0].sourceTimingBootstrap, null,
    'cancelled timing cannot be promoted to a first-source bootstrap');
});

for (const outcome of ['rejected', 'timeout']) {
  test(`pending-source progress ignores late callbacks after the runner ${outcome}`, async () => {
    let calls = 0;
    let releaseRunner;
    const result = await runIsosurfaceBootstrapFixture({
      label: `pending-progress-${outcome}`, expectProgress: true, skipAdmission: true,
      timeoutMs: outcome === 'timeout' ? 5 : undefined,
      presenterMethods: { beginPendingSourceProgress() { return () => { calls++; }; } },
      onRun() {
        if (outcome === 'rejected') throw new Error('injected schedule failure');
        return new Promise(resolve => { releaseRunner = resolve; });
      },
      afterSchedule({ runnerOptions, scheduleId }) {
        runnerOptions.postProgress({ scheduleId, stepOrdinal: 1, completedStepCount: 1 });
        releaseRunner?.();
      }
    });
    assert.equal(calls, 0);
    assert.equal(result.enqueueCalls.length, 0);
    assert.equal(result.messages.some(message => message.status ===
      `worker-offscreen-resident-schedule-on-presentation-device-${outcome === 'timeout' ? 'timeout' : 'failed'}`), true);
  });
}

test('pending-source progress ignores callbacks retained by a synchronously throwing runner', async () => {
  let calls = 0;
  const result = await runIsosurfaceBootstrapFixture({
    label: 'pending-progress-synchronous-throw', expectProgress: true, skipAdmission: true,
    synchronousRunnerError: new Error('synchronous runner failure'),
    presenterMethods: { beginPendingSourceProgress() { return () => { calls++; }; } },
    afterSchedule({ runnerOptions, scheduleId }) {
      assert.equal(typeof runnerOptions.postProgress, 'function');
      runnerOptions.postProgress({ scheduleId, stepOrdinal: 1, completedStepCount: 1 });
    }
  });
  assert.equal(calls, 0);
  assert.equal(result.enqueueCalls.length, 0);
});

test('retained gaps use only a current playing isosurface schedule and retire after terminal completion', async () => {
  let ready = true;
  let calls = 0;
  let submittedSignal;
  await runIsosurfaceBootstrapFixture({
    label: 'retained-gap-completion',
    presenterMethods: {
      hasRetainedSubmissionGapOpportunity: () => ready,
      async presentRetainedSubmissionGap({ signal }) {
        calls++;
        submittedSignal = signal;
        ready = false;
        return true;
      }
    },
    async onRun({ enqueueCalls }) {
      assert.equal(hasResidentPresentationSubmissionGap(fakeDevice), true);
      assert.equal(hasResidentPresentationSubmissionGap({}), false);
      assert.equal(calls, 0, 'readiness is not a draw');
      assert.equal(await requestResidentPresentationSubmissionGap(fakeDevice), true);
      assert.equal(submittedSignal.aborted, false, 'submitted frame still awaits its own full proof');
      assert.equal(hasResidentPresentationSubmissionGap(fakeDevice), false, 'occupied/horizon-exhausted frames cannot split physics');
      assert.equal(enqueueCalls.length, 0, 'gap scheduling cannot publish a solver source');
      ready = true;
      workerModule.setWorkerPresentationPlaybackState({ playing: false, revision: ++playbackTestRevision });
      assert.equal(hasResidentPresentationSubmissionGap(fakeDevice), false);
      assert.equal(await requestResidentPresentationSubmissionGap(fakeDevice), false);
      workerModule.setWorkerPresentationPlaybackState({ playing: true, revision: ++playbackTestRevision });
    },
    async afterSchedule() {
      assert.equal(hasResidentPresentationSubmissionGap(fakeDevice), false);
      assert.equal(await requestResidentPresentationSubmissionGap(fakeDevice), false);
      assert.equal(submittedSignal.aborted, true, 'schedule retirement cancels its unfinished display proof');
    }
  });
  assert.equal(calls, 1);
});

test('worker forwards final-only waiting through readiness and presentation without widening playback eligibility', async () => {
  let busy = false;
  const readinessOptions = [];
  const presentationOptions = [];
  await runIsosurfaceBootstrapFixture({
    label: 'retained-final-wait-forwarding',
    presenterMethods: {
      hasRetainedSubmissionGapOpportunity(options) {
        readinessOptions.push(options);
        return !busy || options?.waitForPendingSlot === true;
      },
      async presentRetainedSubmissionGap({ signal, waitForPendingSlot }) {
        assert.equal(signal.aborted, false);
        presentationOptions.push(waitForPendingSlot);
        busy = true;
        return true;
      }
    },
    async onRun() {
      assert.equal(hasResidentPresentationSubmissionGap(fakeDevice), true);
      assert.deepEqual(readinessOptions[0], { waitForPendingSlot: false });
      assert.equal(await requestResidentPresentationSubmissionGap(fakeDevice), true);
      assert.equal(hasResidentPresentationSubmissionGap(fakeDevice), false);
      assert.equal(await requestResidentPresentationSubmissionGap(fakeDevice), false);
      assert.equal(await requestResidentPresentationSubmissionGap(fakeDevice, { waitForPendingSlot: true }), true);
      assert.deepEqual(presentationOptions, [false, true]);
      const queryCount = readinessOptions.length;
      assert.equal(await requestResidentPresentationSubmissionGap(fakeDevice, { waitForPendingSlot: 'true' }), false);
      assert.equal(readinessOptions.length, queryCount);
      workerModule.setWorkerPresentationPlaybackState({ playing: false, revision: ++playbackTestRevision });
      assert.equal(await requestResidentPresentationSubmissionGap(fakeDevice, { waitForPendingSlot: true }), false);
      workerModule.setWorkerPresentationPlaybackState({ playing: true, revision: ++playbackTestRevision });
    },
    async afterSchedule() {
      assert.equal(await requestResidentPresentationSubmissionGap(fakeDevice, { waitForPendingSlot: true }), false);
    }
  });
  assert.deepEqual(presentationOptions, [false, true]);
});

test('an older isosurface schedule cannot request gaps after another lane replaces its stream', async () => {
  let calls = 0;
  await runIsosurfaceBootstrapFixture({
    label: 'retained-gap-superseded',
    presenterMethods: {
      hasRetainedSubmissionGapOpportunity: () => true,
      async presentRetainedSubmissionGap() { calls++; return true; }
    },
    async onRun() {
      assert.equal(hasResidentPresentationSubmissionGap(fakeDevice), true);
      await runIsosurfaceBootstrapFixture({ label: 'retained-gap-replacement' });
      assert.equal(hasResidentPresentationSubmissionGap(fakeDevice), false);
      assert.equal(await requestResidentPresentationSubmissionGap(fakeDevice), false);
    }
  });
  assert.equal(calls, 0);
});

for (const outcome of ['rejected', 'timeout']) {
  test(`retained gap registration is retired when the schedule ${outcome}`, async () => {
    let releaseRunner;
    let submittedSignal;
    await runIsosurfaceBootstrapFixture({
      label: `retained-gap-${outcome}`, skipAdmission: true,
      timeoutMs: outcome === 'timeout' ? 5 : undefined,
      presenterMethods: {
        hasRetainedSubmissionGapOpportunity: () => true,
        async presentRetainedSubmissionGap({ signal }) { submittedSignal = signal; return true; }
      },
      async onRun() {
        assert.equal(await requestResidentPresentationSubmissionGap(fakeDevice), true);
        if (outcome === 'rejected') throw Error('injected schedule failure');
        await new Promise(resolve => { releaseRunner = resolve; });
      },
      async afterSchedule() {
        assert.equal(hasResidentPresentationSubmissionGap(fakeDevice), false);
        assert.equal(await requestResidentPresentationSubmissionGap(fakeDevice), false);
        assert.equal(submittedSignal.aborted, true);
        releaseRunner?.();
      }
    });
  });
}

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
