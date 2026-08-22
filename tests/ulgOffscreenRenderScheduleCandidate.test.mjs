import assert from 'node:assert/strict';
import test from 'node:test';

import {
  ULG_RESIDENT_RENDER_CANDIDATE_SCHEMA
} from '../src/visualization/residentRenderCandidateMailbox.js';

// The offscreen presentation worker is a module worker script: it has no DOM
// dependency at import time but binds `self.onmessage` and posts through
// `self.postMessage`. Shim a worker-global BEFORE importing so the module's
// exported handlers (the W3 test seams) can be driven directly in node with a
// fake WebGPU device — no browser, no GPU.
const postedMessages = [];
const fakeSelf = {
  onmessage: null,
  postMessage(data) {
    postedMessages.push(data);
  },
  performance: { now: () => Date.now() },
  navigator: {}
};
globalThis.self = fakeSelf;

const workerModule = await import('../src/services/ulgOffscreenRender.worker.js');

const fakeDevice = {
  createCommandEncoder: () => ({
    beginRenderPass: () => ({ end() {} }),
    finish: () => ({})
  }),
  queue: { submit() {} },
  lost: new Promise(() => {})
};
const fakeCanvasContext = {
  configure() {},
  unconfigure() {},
  getCurrentTexture: () => ({ createView: () => ({}) })
};
const fakeCanvas = {
  width: 0,
  height: 0,
  getContext: (kind) => (kind === 'webgpu' ? fakeCanvasContext : null)
};
fakeSelf.navigator = {
  gpu: {
    requestAdapter: async () => ({ requestDevice: async () => fakeDevice }),
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
});

test('presentation worker schedule verb injects its own device, drives the W2 schedule driver, and emits versioned candidates', async () => {
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

test('presentation worker schedule verb skips candidates truthfully when no epoch identity exists', async () => {
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
