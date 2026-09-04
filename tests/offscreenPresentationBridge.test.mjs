import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createUlgWorkerOffscreenPresentationBridge,
  buildUlgWorkerOffscreenCommittedResidentSchedulePresentationAdmission,
  ULG_WORKER_LANE_COMPUTE_MANAGER_COMPLETION_SCHEMA,
  ULG_RESIDENT_RENDER_CANDIDATE_SCHEMA,
  ULG_WORKER_OFFSCREEN_COMMITTED_RESIDENT_SCHEDULE_PRESENTATION_SCHEMA,
  ULG_WORKER_OFFSCREEN_PRESENTATION_HANDOFF,
  ULG_REMOTE_TASK_GRAPH_COMPACT_BUFFER_SNAPSHOT_SCHEMA,
  ULG_WORKER_OFFSCREEN_RETAINED_COMPACT_SNAPSHOT_SCHEMA,
  ULG_WORKER_OFFSCREEN_PRESENTATION_RESIDENT_STAGE_SCHEMA,
  ULG_WORKER_OFFSCREEN_PRESENTATION_RESIDENT_STAGE_TRANSPORT,
  ULG_WORKER_OFFSCREEN_PRESENTATION_SCHEMA,
  ULG_WORKER_OFFSCREEN_PRESENTATION_TRANSPORT,
  ULG_WORKER_OFFSCREEN_RESIDENT_PARTICLE_KEYFRAME_PRESENTATION_FRAME_SCHEMA,
  ULG_WORKER_OFFSCREEN_RESIDENT_PARTICLE_TEMPORAL_MOTION_FRAME_SCHEMA,
  ULG_WORKER_OFFSCREEN_RESIDENT_PARTICLE_STATE_PRODUCER_SCHEMA,
  ULG_WORKER_OFFSCREEN_RESIDENT_ISOSURFACE_PRESENTATION_ENQUEUED_STATUS,
  ULG_WORKER_OFFSCREEN_RESIDENT_ISOSURFACE_PRESENTATION_FRAME_SCHEMA,
  ULG_WORKER_OFFSCREEN_RESIDENT_ISOSURFACE_PRESENTATION_GEOMETRY,
  ULG_WORKER_OFFSCREEN_RESIDENT_ISOSURFACE_PRESENTATION_RENDERED_STATUS,
  ULG_WORKER_OFFSCREEN_RESIDENT_ISOSURFACE_PRESENTATION_SCHEMA,
  ULG_WORKER_OFFSCREEN_RESIDENT_RENDER_PRODUCER_SCHEMA,
  ULG_WORKER_OFFSCREEN_RENDER_ROWS_INPUT_TRANSPORT,
  ULG_WORKER_OFFSCREEN_RENDER_ROWS_SCHEMA,
  ULG_WORKER_OFFSCREEN_RENDER_ROW_PARTICLE_STRIDE_FLOATS,
  ULG_WORKER_OFFSCREEN_RETAINED_GPU_BUFFER_HANDOFF_SCHEMA,
  ULG_WORKER_OFFSCREEN_RETAINED_GPU_BUFFER_TRANSPORT,
  ULG_WORKER_OFFSCREEN_WORKER_LOCAL_PRODUCER_TRANSPORT,
  ULG_WORKER_OFFSCREEN_REJECTED_TRANSPORT,
  packUlgWorkerOffscreenRenderRowsPayload,
  resolveUlgWorkerOffscreenRetainedGpuBufferHandoffCapability,
  resolveUlgWorkerOffscreenPresentationCapability,
  resolveUlgWorkerOffscreenPresentationSize
} from '../src/visualization/offscreenPresentationBridge.js';

const COMMITTED_CANDIDATE_RECEIPT_FIELDS = Object.freeze({
  workerFramebufferEpoch: 2,
  stateManagerCommittedPresentation: true,
  committedPresentationSchema:
    ULG_WORKER_OFFSCREEN_COMMITTED_RESIDENT_SCHEDULE_PRESENTATION_SCHEMA,
  committedPresentationStatus:
    'state-manager-committed-resident-schedule-presentation-admission',
  scheduleId: 'schedule:committed-frame',
  laneId: 'lane:committed-frame',
  stateKey: 'state:committed-frame',
  presentationLaneEpoch: 1,
  residentExecutionGeneration: 7,
  stepOrdinal: 1,
  authorityStatus: 'state-manager-committed-worker-schedule',
  computeManagerLeaseStatus: 'completed',
  computeManagerCompletionSchema:
    ULG_WORKER_LANE_COMPUTE_MANAGER_COMPLETION_SCHEMA,
  computeManagerLeaseId: 'lease:committed-frame',
  computeManagerFenceSatisfied: true,
  stateManagerCommitStatus: 'committed',
  stateManagerCommitAccepted: true,
  terminalScheduleFence: true,
  terminalFenceScope: 'resident-schedule-terminal',
  terminalFenceSatisfied: true,
  terminalFenceAuthorityAdmissionReady: true
});

const IMPOSTOR_PRESENTATION_RECEIPT_FIELDS = Object.freeze({
  presentationGeometry: 'sphere-impostor-depth-fallback',
  particleImpostorShape: 'projective-circular-lit-disc',
  particleImpostorPassCount: 2,
  projectiveParticleSizing: true,
  particleDepthModel: 'center-plane-depth',
  depthAttachmentFormat: 'depth24plus',
  depthAttachmentReady: true,
  condensedDepthTestEnabled: true,
  condensedDepthWriteEnabled: true,
  vaporDepthTestEnabled: true,
  vaporDepthWriteEnabled: false,
  boxWireframeDrawCount: 1,
  boxDimsM: [12, 8, 6],
  sameDevicePresentation: true
});

const ADMITTED_KEYFRAME_PRESENTATION_RECEIPT_FIELDS = Object.freeze({
  presentationFrameSchema:
    ULG_WORKER_OFFSCREEN_RESIDENT_PARTICLE_KEYFRAME_PRESENTATION_FRAME_SCHEMA,
  presentationFrameStatus:
    'worker-particle-keyframe-presentation-opportunity',
  presentationFrameAdmitted: true,
  presentationFrameGpuCompleted: true,
  presentationFrameGpuCompletedAtMs: 101,
  presentationFramePresentationOpportunity: true,
  presentationFramePresentationOpportunityMethod:
    'worker-request-animation-frame-after-gpu-completion',
  presentationFrameSubmitToGpuCompleteMs: 4,
  presentationFrameSubmitToPresentationOpportunityMs: 16,
  presentationQueueCompletionCount: 3,
  presentationQueueCompletionSerial: 3,
  presentationQueueCompletionMethod:
    'worker-device.queue.onSubmittedWorkDone',
  presentationQueueCompletionScope:
    'worker-offscreen-shared-device-queue-frame-proof',
  physicsQueuePrefixCoverage: 'physics-queue-prefix-not-attributed',
  physicsHostQueueFenceParticipation: null,
  workerLocalRenderRowsProduced: true
});

test('worker offscreen presentation capability is fail-closed around transferred canvas ownership', () => {
  const notRequested = resolveUlgWorkerOffscreenPresentationCapability({
    requested: false,
    workerAvailable: true
  });
  assert.equal(notRequested.schema, ULG_WORKER_OFFSCREEN_PRESENTATION_SCHEMA);
  assert.equal(notRequested.status, 'worker-offscreen-presentation-not-requested');
  assert.equal(notRequested.frameCopyBackRejected, true);
  assert.equal(notRequested.copiedBytesPerFrame, 0);

  const missingTransfer = resolveUlgWorkerOffscreenPresentationCapability({
    requested: true,
    workerAvailable: true,
    canvas: {}
  });
  assert.equal(missingTransfer.status, 'worker-offscreen-presentation-blocked-transfer-unavailable');
  assert.equal(missingTransfer.transport, ULG_WORKER_OFFSCREEN_PRESENTATION_TRANSPORT);
  assert.equal(missingTransfer.displayHandoff, ULG_WORKER_OFFSCREEN_PRESENTATION_HANDOFF);
  assert.equal(missingTransfer.rejectedTransport, ULG_WORKER_OFFSCREEN_REJECTED_TRANSPORT);

  const transferReady = resolveUlgWorkerOffscreenPresentationCapability({
    requested: true,
    workerAvailable: true,
    navigatorRef: { gpu: {} },
    canvas: {
      transferControlToOffscreen() {
        return {};
      }
    }
  });
  assert.equal(transferReady.status, 'worker-offscreen-presentation-transfer-ready');
  assert.equal(transferReady.transferControlToOffscreenAvailable, true);
  assert.equal(transferReady.mainThreadWebGpuAvailable, true);
  assert.equal(transferReady.frameCopyBackRejected, true);
  assert.equal(transferReady.copiedBytesPerSecond, 0);
});

test('worker offscreen presentation sizing caps device-pixel ratio for display canvas setup', () => {
  const size = resolveUlgWorkerOffscreenPresentationSize({
    width: 390,
    height: 844,
    devicePixelRatio: 3
  });

  assert.equal(size.cssWidth, 390);
  assert.equal(size.cssHeight, 844);
  assert.equal(size.pixelRatio, 2);
  assert.equal(size.backingWidth, 780);
  assert.equal(size.backingHeight, 1688);
});

test('committed resident schedule presentation posts only after exact authority', () => {
  let worker = null;
  class FakeWorker {
    constructor() {
      this.messages = [];
      worker = this;
    }
    postMessage(data, transfer = []) {
      this.messages.push({ data, transfer });
    }
    addEventListener() {}
    terminate() {}
  }
  const canvas = {
    style: {},
    width: 0,
    height: 0,
    setAttribute() {},
    transferControlToOffscreen() { return { offscreen: true }; }
  };
  const container = {
    clientWidth: 32,
    clientHeight: 32,
    appendChild(child) { child.parentNode = this; },
    removeChild(child) { if (child.parentNode === this) child.parentNode = null; },
    ownerDocument: { createElement() { return canvas; } }
  };
  const bridge = createUlgWorkerOffscreenPresentationBridge({
    requested: true,
    container,
    width: 32,
    height: 32,
    workerFactory: FakeWorker,
    navigatorRef: { gpu: {} },
    windowRef: { document: container.ownerDocument }
  });
  const terminalFence = {
    required: true,
    scope: 'resident-schedule-terminal',
    terminalScheduleFence: true,
    fenceSatisfied: true,
    authorityAdmissionReady: true,
    scheduleId: 'schedule:authority',
    laneId: 'lane:authority',
    stateKey: 'state:authority',
    completedStepCount: 1,
    queueCompletionStatus: 'queue-work-completed',
    queueCompletionMethod: 'worker-device.queue.onSubmittedWorkDone'
  };
  const authority = {
    status: 'state-manager-committed-worker-schedule',
    taskId: 'task:authority',
    scheduleId: 'schedule:authority',
    laneId: 'lane:authority',
    stateKey: 'state:authority',
    scheduleResult: {
      scheduleId: 'schedule:authority',
      laneId: 'lane:authority',
      stateKey: 'state:authority',
      completedStepCount: 1,
      finalEpochIdentity: { storageGeneration: 9, physicsTick: 4 },
      gpuFence: terminalFence
    },
    gpuResidentLaneExecution: {
      lease: {
        leaseId: 'lease:authority',
        taskId: 'task:authority',
        laneId: 'lane:authority',
        stateKey: 'state:authority',
        status: 'completed'
      },
      gpuFence: {
        fenceSatisfied: true,
        laneId: 'lane:authority',
        stateKey: 'state:authority'
      }
    },
    computeManagerCompletion: {
      schema: ULG_WORKER_LANE_COMPUTE_MANAGER_COMPLETION_SCHEMA,
      status: 'completed',
      taskId: 'task:authority',
      leaseId: 'lease:authority',
      laneId: 'lane:authority',
      stateKey: 'state:authority',
      fenceSatisfied: true
    },
    stateManagerCommit: {
      status: 'committed',
      accepted: true,
      taskId: 'task:authority'
    }
  };
  const admission =
    buildUlgWorkerOffscreenCommittedResidentSchedulePresentationAdmission({
      workerLaneAuthority: authority
    });
  assert.equal(admission.ready, true);
  assert.equal(
    admission.schema,
    ULG_WORKER_OFFSCREEN_COMMITTED_RESIDENT_SCHEDULE_PRESENTATION_SCHEMA
  );
  assert.equal(admission.candidateVersion.nextStep, 4);
  assert.doesNotThrow(() => structuredClone(admission));

  const activeLeaseAdmission =
    buildUlgWorkerOffscreenCommittedResidentSchedulePresentationAdmission({
      workerLaneAuthority: {
        ...authority,
        gpuResidentLaneExecution: {
          ...authority.gpuResidentLaneExecution,
          lease: {
            ...authority.gpuResidentLaneExecution.lease,
            status: 'active'
          }
        }
      }
    });
  assert.equal(activeLeaseAdmission.ready, false);

  const messageCountBeforeBlocked = worker.messages.length;
  const blocked = bridge.presentCommittedResidentScheduleCandidate({
    workerLaneAuthority: {
      ...authority,
      stateManagerCommit: { status: 'committed', accepted: false }
    }
  });
  assert.equal(blocked.ready, false);
  assert.equal(worker.messages.length, messageCountBeforeBlocked);

  const posted = bridge.presentCommittedResidentScheduleCandidate({
    workerLaneAuthority: authority
  });
  assert.equal(
    posted.status,
    'state-manager-committed-resident-schedule-presentation-admission-posted'
  );
  const message = worker.messages.at(-1).data;
  assert.equal(message.type, 'present-committed-resident-schedule-candidate');
  assert.equal(message.scheduleId, 'schedule:authority');
  assert.equal(message.authority.stateManagerCommitAccepted, true);
  assert.equal(message.terminalFence.terminalScheduleFence, true);
  assert.equal(
    Number.isFinite(Number(message.presentationAdmissionPostedAtMs)),
    true
  );
  assert.equal(
    posted.presentationAdmissionPostedAtMs,
    message.presentationAdmissionPostedAtMs
  );
  bridge.dispose();
});

test('worker offscreen display ownership hides native non-owner and reveals only matching content receipt', () => {
  let worker = null;
  class FakeWorker {
    constructor() {
      this.messages = [];
      this.listeners = [];
      worker = this;
    }

    postMessage(data, transfer = []) {
      this.messages.push({ data, transfer });
    }

    addEventListener(type, listener) {
      if (type === 'message') this.listeners.push(listener);
    }

    removeEventListener(type, listener) {
      if (type === 'message') {
        this.listeners = this.listeners.filter((entry) => entry !== listener);
      }
    }

    emit(data) {
      for (const listener of this.listeners) listener({ data });
    }

    terminate() {}
  }
  const canvas = {
    style: {},
    width: 0,
    height: 0,
    setAttribute() {},
    transferControlToOffscreen() {
      return { offscreen: true };
    }
  };
  const container = {
    clientWidth: 64,
    clientHeight: 64,
    appendChild(child) {
      child.parentNode = this;
    },
    removeChild(child) {
      if (child.parentNode === this) child.parentNode = null;
    },
    ownerDocument: {
      createElement() {
        return canvas;
      }
    }
  };
  const bridge = createUlgWorkerOffscreenPresentationBridge({
    requested: true,
    container,
    width: 64,
    height: 64,
    workerFactory: FakeWorker,
    navigatorRef: { gpu: {} },
    windowRef: { document: container.ownerDocument }
  });

  const nativeOwner = bridge.setDisplayOwner({
    owner: 'main-native',
    epoch: 7,
    reason: 'unit-native-owner'
  });
  assert.equal(nativeOwner.displayOwner, 'main-native');
  assert.equal(nativeOwner.displayCanvasVisible, false);
  assert.equal(canvas.style.visibility, 'hidden');
  assert.equal(worker.messages.at(-1)?.data?.type, 'clear');
  assert.equal(worker.messages.at(-1)?.data?.displayOwnerEpoch, 7);

  const implicitSameOwner = bridge.setDisplayOwner({
    owner: 'main-native',
    reason: 'unit-implicit-same-owner'
  });
  assert.equal(implicitSameOwner.displayOwner, 'main-native');
  assert.equal(implicitSameOwner.displayOwnerEpoch, 7);

  const stale = bridge.setDisplayOwner({ owner: 'worker', epoch: 6 });
  assert.equal(stale.status, 'worker-offscreen-display-owner-stale-epoch-rejected');
  assert.equal(bridge.displayOwner, 'main-native');
  assert.equal(canvas.style.visibility, 'hidden');

  // The worker can finish a candidate while the validated native seed still
  // owns composition. Keep the exact framebuffer receipt hidden but durable
  // so the subsequent worker handoff can adopt those already-rendered pixels.
  worker.emit({
    schema: ULG_WORKER_OFFSCREEN_PRESENTATION_SCHEMA,
    frameCount: 1,
    readyFrameCount: 1,
    workerOffscreenRenderRows: {
      schema: ULG_WORKER_OFFSCREEN_RESIDENT_PARTICLE_STATE_PRODUCER_SCHEMA,
      renderRowsSchema: ULG_WORKER_OFFSCREEN_RENDER_ROWS_SCHEMA,
      status: 'worker-offscreen-resident-particle-state-producer-rendered',
      displayOwnerEpoch: 7,
      sphStep: 11,
      particleCount: 1,
      frameCount: 1,
      readyFrameCount: 1,
      workerFramebufferEpoch: 2,
      residentScheduleCandidatePresentation: true,
      producerSourceKind: 'worker-retained-resident-stage-output',
      producerSourceTransport: 'worker-retained-resident-stage-output',
      sourceStageId: 'schroederSameLevelMechanics',
      retainedParticleStateStatus: 'worker-retained-particle-state-ready',
      ...IMPOSTOR_PRESENTATION_RECEIPT_FIELDS
    }
  });
  assert.equal(
    bridge.workerCanvasLastRenderedContent,
    null,
    'an uncommitted progress/terminal marker must not become drawable content'
  );
  assert.equal(canvas.style.visibility, 'hidden');

  worker.emit({
    schema: ULG_WORKER_OFFSCREEN_PRESENTATION_SCHEMA,
    frameCount: 1,
    readyFrameCount: 1,
    workerOffscreenRenderRows: {
      schema: ULG_WORKER_OFFSCREEN_RESIDENT_PARTICLE_STATE_PRODUCER_SCHEMA,
      renderRowsSchema: ULG_WORKER_OFFSCREEN_RENDER_ROWS_SCHEMA,
      status: 'worker-offscreen-resident-particle-state-producer-rendered',
      displayOwnerEpoch: 7,
      sphStep: 11,
      particleCount: 1,
      frameCount: 1,
      readyFrameCount: 1,
      residentScheduleCandidatePresentation: true,
      ...COMMITTED_CANDIDATE_RECEIPT_FIELDS,
      ...ADMITTED_KEYFRAME_PRESENTATION_RECEIPT_FIELDS,
      producerSourceKind: 'worker-retained-resident-stage-output',
      producerSourceTransport: 'worker-retained-resident-stage-output',
      sourceStageId: 'schroederSameLevelMechanics',
      retainedParticleStateStatus: 'worker-retained-particle-state-ready',
      ...IMPOSTOR_PRESENTATION_RECEIPT_FIELDS
    }
  });
  assert.equal(canvas.style.visibility, 'hidden');
  assert.equal(bridge.displayOwnerContentReady, true);
  assert.equal(bridge.displayOwnerLastRenderedContent, null);
  assert.equal(bridge.workerCanvasLastRenderedContent.sphStep, 11);

  const workerOwner = bridge.setDisplayOwner({
    owner: 'worker',
    revealWhenContentReady: true,
    reason: 'unit-worker-owner'
  });
  assert.equal(workerOwner.displayOwnerEpoch, 8);
  assert.equal(workerOwner.displayCanvasVisible, true);
  assert.equal(canvas.style.visibility, 'visible');
  assert.equal(bridge.displayOwnerContentReady, true);
  assert.equal(bridge.displayOwnerPresentedSphStep, 11);

  const drawStatus = bridge.drawRenderRows({
    sphStep: 12,
    boxDimsM: [4, 5, 6],
    positionsM: new Float32Array([0, 0, 0]),
    colorsRgb: new Float32Array([1, 1, 1]),
    particleRadiiM: new Float32Array([0.05]),
    viewProjectionMatrix: new Float32Array(16)
  });
  assert.equal(drawStatus.particleCount, 1);
  assert.equal(worker.messages.at(-1)?.data?.displayOwnerEpoch, 8);
  assert.deepEqual(worker.messages.at(-1)?.data?.boxDimsM, [4, 5, 6]);

  worker.emit({
    schema: ULG_WORKER_OFFSCREEN_PRESENTATION_SCHEMA,
    frameCount: 1,
    readyFrameCount: 1,
    workerOffscreenRenderRows: {
      schema: ULG_WORKER_OFFSCREEN_RENDER_ROWS_SCHEMA,
      status: 'worker-offscreen-render-rows-rendered',
      displayOwnerEpoch: 7,
      sphStep: 11,
      particleCount: 1,
      frameCount: 1,
      readyFrameCount: 1,
      workerFramebufferEpoch: 2
    }
  });
  assert.equal(canvas.style.visibility, 'visible');
  assert.equal(bridge.displayOwnerContentReady, true);
  assert.equal(bridge.displayOwnerPresentedSphStep, 11);

  worker.emit({
    schema: ULG_WORKER_OFFSCREEN_PRESENTATION_SCHEMA,
    frameCount: 1,
    readyFrameCount: 1,
    workerOffscreenRenderRows: {
      schema: ULG_WORKER_OFFSCREEN_RENDER_ROWS_SCHEMA,
      status: 'worker-offscreen-render-rows-rendered',
      displayOwnerEpoch: 8,
      sphStep: 12,
      particleCount: 1,
      frameCount: 1,
      readyFrameCount: 1,
      workerFramebufferEpoch: 2
    }
  });
  assert.equal(canvas.style.visibility, 'visible');
  assert.equal(bridge.displayOwnerContentReady, true);
  assert.equal(bridge.displayOwnerContentFrameSerial, 2);
  assert.equal(bridge.displayOwnerPresentedSphStep, 12);

  const sameWorkerNextEpoch = bridge.setDisplayOwner({
    owner: 'worker',
    epoch: 9,
    revealWhenContentReady: true,
    reason: 'unit-worker-same-owner-next-epoch'
  });
  assert.equal(sameWorkerNextEpoch.displayCanvasVisible, true);
  assert.equal(canvas.style.visibility, 'visible');
  assert.equal(bridge.displayOwnerContentReady, true);
  assert.equal(bridge.displayOwnerPresentedSphStep, 12);

  worker.emit({
    schema: ULG_WORKER_OFFSCREEN_PRESENTATION_SCHEMA,
    frameCount: 1,
    readyFrameCount: 1,
    workerOffscreenRenderRows: {
      schema: ULG_WORKER_OFFSCREEN_RENDER_ROWS_SCHEMA,
      status: 'worker-offscreen-render-rows-rendered',
      displayOwnerEpoch: 8,
      sphStep: 13,
      particleCount: 1,
      frameCount: 1,
      readyFrameCount: 1,
      workerFramebufferEpoch: 2
    }
  });
  assert.equal(canvas.style.visibility, 'visible');
  assert.equal(bridge.displayOwnerPresentedSphStep, 12);

  // A submit-only terminal row cannot reveal or replace the durable frame,
  // even if every authority field and framebuffer counter otherwise match.
  worker.emit({
    schema: ULG_WORKER_OFFSCREEN_PRESENTATION_SCHEMA,
    frameCount: 2,
    readyFrameCount: 2,
    workerOffscreenRenderRows: {
      schema: ULG_WORKER_OFFSCREEN_RESIDENT_PARTICLE_STATE_PRODUCER_SCHEMA,
      renderRowsSchema: ULG_WORKER_OFFSCREEN_RENDER_ROWS_SCHEMA,
      status: 'worker-offscreen-resident-particle-state-producer-rendered',
      displayOwnerEpoch: 9,
      sphStep: 14,
      particleCount: 1,
      frameCount: 2,
      readyFrameCount: 2,
      residentScheduleCandidatePresentation: true,
      ...COMMITTED_CANDIDATE_RECEIPT_FIELDS,
      ...ADMITTED_KEYFRAME_PRESENTATION_RECEIPT_FIELDS,
      presentationFrameStatus:
        'worker-particle-keyframe-submitted-awaiting-presentation-opportunity',
      presentationFrameAdmitted: false,
      presentationFrameGpuCompleted: false,
      presentationFramePresentationOpportunity: false,
      producerSourceKind: 'worker-retained-resident-stage-output',
      producerSourceTransport: 'worker-retained-resident-stage-output',
      sourceStageId: 'schroederSameLevelMechanics',
      retainedParticleStateStatus: 'worker-retained-particle-state-ready',
      ...IMPOSTOR_PRESENTATION_RECEIPT_FIELDS
    }
  });
  assert.equal(bridge.displayOwnerPresentedSphStep, 12);
  assert.equal(bridge.displayOwnerContentFrameSerial, 2);

  worker.emit({
    schema: ULG_WORKER_OFFSCREEN_PRESENTATION_SCHEMA,
    frameCount: 2,
    readyFrameCount: 2,
    workerOffscreenRenderRows: {
      schema: ULG_WORKER_OFFSCREEN_RESIDENT_PARTICLE_STATE_PRODUCER_SCHEMA,
      renderRowsSchema: ULG_WORKER_OFFSCREEN_RENDER_ROWS_SCHEMA,
      status: 'worker-offscreen-resident-particle-state-producer-rendered',
      displayOwnerEpoch: 9,
      sphStep: 14,
      particleCount: 1,
      frameCount: 2,
      readyFrameCount: 2,
      residentScheduleCandidatePresentation: true,
      ...COMMITTED_CANDIDATE_RECEIPT_FIELDS,
      ...ADMITTED_KEYFRAME_PRESENTATION_RECEIPT_FIELDS,
      presentationQueueCompletionCount: 5,
      presentationQueueCompletionSerial: 4,
      presentationQueueCompletionMethod: 'unproved-queue-method',
      producerSourceKind: 'worker-retained-resident-stage-output',
      producerSourceTransport: 'worker-retained-resident-stage-output',
      sourceStageId: 'schroederSameLevelMechanics',
      retainedParticleStateStatus: 'worker-retained-particle-state-ready',
      ...IMPOSTOR_PRESENTATION_RECEIPT_FIELDS
    }
  });
  assert.equal(
    bridge.displayOwnerPresentedSphStep,
    12,
    'a mismatched count/serial and wrong queue method cannot prove a keyframe'
  );

  worker.emit({
    schema: ULG_WORKER_OFFSCREEN_PRESENTATION_SCHEMA,
    frameCount: 2,
    readyFrameCount: 2,
    workerOffscreenRenderRows: {
      schema: ULG_WORKER_OFFSCREEN_RESIDENT_PARTICLE_STATE_PRODUCER_SCHEMA,
      renderRowsSchema: ULG_WORKER_OFFSCREEN_RENDER_ROWS_SCHEMA,
      status: 'worker-offscreen-resident-particle-state-producer-rendered',
      displayOwnerEpoch: 9,
      sphStep: 14,
      particleCount: 1,
      frameCount: 2,
      readyFrameCount: 2,
      residentScheduleCandidatePresentation: true,
      ...COMMITTED_CANDIDATE_RECEIPT_FIELDS,
      ...ADMITTED_KEYFRAME_PRESENTATION_RECEIPT_FIELDS,
      presentationQueueCompletionCount: 4,
      presentationQueueCompletionSerial: 4,
      producerSourceKind: 'worker-retained-resident-stage-output',
      producerSourceTransport: 'worker-retained-resident-stage-output',
      sourceStageId: 'schroederSameLevelMechanics',
      retainedParticleStateStatus: 'worker-retained-particle-state-ready',
      ...IMPOSTOR_PRESENTATION_RECEIPT_FIELDS
    }
  });
  assert.equal(canvas.style.visibility, 'visible');
  assert.equal(bridge.displayOwnerPresentedSphStep, 14);
  assert.equal(bridge.displayOwnerContentFrameSerial, 3);
  assert.deepEqual(bridge.displayOwnerLastRenderedContent, {
    schema: ULG_WORKER_OFFSCREEN_RESIDENT_PARTICLE_STATE_PRODUCER_SCHEMA,
    renderRowsSchema: ULG_WORKER_OFFSCREEN_RENDER_ROWS_SCHEMA,
    status: 'worker-offscreen-resident-particle-state-producer-rendered',
    sphStep: 14,
    particleCount: 1,
    frameCount: 2,
    readyFrameCount: 2,
    displayOwnerEpoch: 9,
    residentScheduleCandidatePresentation: true,
    ...COMMITTED_CANDIDATE_RECEIPT_FIELDS,
    ...ADMITTED_KEYFRAME_PRESENTATION_RECEIPT_FIELDS,
    presentationQueueCompletionCount: 4,
    presentationQueueCompletionSerial: 4,
    producerSourceKind: 'worker-retained-resident-stage-output',
    producerSourceTransport: 'worker-retained-resident-stage-output',
    sourceStageId: 'schroederSameLevelMechanics',
    retainedParticleStateStatus: 'worker-retained-particle-state-ready',
    ...IMPOSTOR_PRESENTATION_RECEIPT_FIELDS
  });

  const motionReceipt = {
    schema: ULG_WORKER_OFFSCREEN_RESIDENT_PARTICLE_STATE_PRODUCER_SCHEMA,
    renderRowsSchema: ULG_WORKER_OFFSCREEN_RENDER_ROWS_SCHEMA,
    status: 'worker-offscreen-resident-particle-state-producer-rendered',
    displayOwnerEpoch: 9,
    sphStep: 14,
    particleCount: 1,
    frameCount: 3,
    readyFrameCount: 3,
    residentScheduleCandidatePresentation: true,
    ...COMMITTED_CANDIDATE_RECEIPT_FIELDS,
    ...ADMITTED_KEYFRAME_PRESENTATION_RECEIPT_FIELDS,
    motionFrameSchema:
      ULG_WORKER_OFFSCREEN_RESIDENT_PARTICLE_TEMPORAL_MOTION_FRAME_SCHEMA,
    motionFrameStatus:
      'worker-particle-temporal-motion-frame-presentation-opportunity',
    motionFrameAdmitted: true,
    motionFrameGpuCompleted: true,
    motionFramePresentationOpportunity: true,
    motionFramePresentationOpportunityMethod:
      'worker-request-animation-frame-after-gpu-completion',
    motionFrameSerial: 1,
    motionFrameSubmittedSerial: 1,
    motionSourceFrameCount: 2,
    motionSourceSphStep: 14,
    motionMethod: 'bounded-keyframe-velocity-extrapolation',
    motionVelocityBufferRetained: true,
    presentationQueueCompletionCount: 5,
    presentationQueueCompletionSerial: 5,
    presentationQueueCompletionMethod:
      'worker-device.queue.onSubmittedWorkDone',
    presentationQueueCompletionScope:
      'worker-offscreen-shared-device-queue-frame-proof',
    physicsQueuePrefixCoverage: 'physics-queue-prefix-not-attributed',
    physicsHostQueueFenceParticipation: null,
    producerSourceKind: 'worker-retained-resident-stage-output',
    producerSourceTransport: 'worker-retained-resident-stage-output',
    sourceStageId: 'schroederSameLevelMechanics',
    retainedParticleStateStatus: 'worker-retained-particle-state-ready',
    ...IMPOSTOR_PRESENTATION_RECEIPT_FIELDS
  };
  worker.emit({
    schema: ULG_WORKER_OFFSCREEN_PRESENTATION_SCHEMA,
    frameCount: 3,
    readyFrameCount: 3,
    workerOffscreenRenderRows: {
      ...motionReceipt,
      motionFrameSchema: 'bogus-motion-frame-schema'
    }
  });
  assert.equal(
    bridge.workerCanvasLastRenderedContent.frameCount,
    2,
    'a motion assertion with the wrong schema cannot advance the framebuffer'
  );

  worker.emit({
    schema: ULG_WORKER_OFFSCREEN_PRESENTATION_SCHEMA,
    frameCount: 3,
    readyFrameCount: 3,
    workerOffscreenRenderRows: motionReceipt
  });
  assert.equal(bridge.workerCanvasLastRenderedContent.frameCount, 3);
  assert.equal(bridge.workerCanvasLastRenderedContent.motionFrameSerial, 1);
  assert.equal(bridge.displayOwnerContentFrameSerial, 4);

  worker.emit({
    schema: ULG_WORKER_OFFSCREEN_PRESENTATION_SCHEMA,
    frameCount: 4,
    readyFrameCount: 4,
    workerOffscreenRenderRows: {
      ...motionReceipt,
      frameCount: 4,
      readyFrameCount: 4,
      motionFrameSerial: 2,
      motionFrameSubmittedSerial: 2
    }
  });
  assert.equal(
    bridge.workerCanvasLastRenderedContent.frameCount,
    3,
    'a reused queue-completion serial cannot prove a new framebuffer'
  );

  worker.emit({
    schema: ULG_WORKER_OFFSCREEN_PRESENTATION_SCHEMA,
    frameCount: 4,
    readyFrameCount: 4,
    workerOffscreenRenderRows: {
      ...motionReceipt,
      frameCount: 4,
      readyFrameCount: 4,
      motionFrameSerial: 2,
      motionFrameSubmittedSerial: 2,
      motionSourceFrameCount: 999,
      presentationQueueCompletionCount: 6,
      presentationQueueCompletionSerial: 6
    }
  });
  assert.equal(
    bridge.workerCanvasLastRenderedContent.frameCount,
    3,
    'motion must remain bound to the exact source keyframe'
  );

  worker.emit({
    schema: ULG_WORKER_OFFSCREEN_PRESENTATION_SCHEMA,
    frameCount: 4,
    readyFrameCount: 4,
    workerOffscreenRenderRows: {
      ...motionReceipt,
      frameCount: 4,
      readyFrameCount: 4,
      motionFrameSerial: 2,
      motionFrameSubmittedSerial: 2,
      presentationQueueCompletionCount: 6,
      presentationQueueCompletionSerial: 6,
      physicsQueuePrefixCoverage: 'physics-queue-prefix-included',
      physicsHostQueueFenceParticipation: true,
      motionPresentationQosBoundary: {
        submissionOrdinal: 2,
        completedSubstepCount: 2,
        totalSubstepCount: 64,
        chunkStepCount: 2
      }
    }
  });
  assert.equal(
    bridge.workerCanvasLastRenderedContent.frameCount,
    4,
    'an exact shared physics/presentation queue-prefix proof advances motion'
  );

  worker.emit({
    schema: ULG_WORKER_OFFSCREEN_PRESENTATION_SCHEMA,
    frameCount: 4,
    readyFrameCount: 4,
    workerOffscreenRenderRows: {
      ...motionReceipt,
      sphStep: 15,
      frameCount: 4,
      readyFrameCount: 4,
      presentationFrameSchema: null,
      motionFrameSchema: null,
      motionFrameAdmitted: false,
      motionFrameSerial: null
    }
  });
  assert.equal(
    bridge.workerCanvasLastRenderedContent.frameCount,
    4,
    'a candidate without the exact keyframe proof cannot reveal pixels'
  );

  // A page-side legacy draw may arrive after the newer worker candidate and
  // be rejected as stale. That last status must not erase the exact positive
  // content receipt or hide the pixels that remain on the canvas.
  worker.emit({
    schema: ULG_WORKER_OFFSCREEN_PRESENTATION_SCHEMA,
    workerOffscreenRenderRows: {
      schema: ULG_WORKER_OFFSCREEN_RENDER_ROWS_SCHEMA,
      status: 'worker-offscreen-presentation-superseded-stale-step',
      sphStep: 0,
      lastPresentedSphStep: 14,
      particleCount: 1,
      frameCount: 2,
      readyFrameCount: 2
    }
  });
  assert.equal(canvas.style.visibility, 'visible');
  assert.equal(bridge.displayOwnerContentReady, true);
  assert.equal(bridge.displayOwnerPresentedSphStep, 14);
  assert.equal(
    bridge.displayOwnerLastRenderedContent.status,
    'worker-offscreen-resident-particle-state-producer-rendered'
  );

  // Viewport refresh calls resize on every sample. An identical size must not
  // clear the OffscreenCanvas or invalidate the durable worker frame.
  const redundantResizeMessageCount = worker.messages.length;
  const redundantResize = bridge.resize({
    width: 64,
    height: 64,
    devicePixelRatio: 1,
    reason: 'unit-identical-viewport-refresh'
  });
  assert.equal(redundantResize.workerResizeRequired, false);
  assert.equal(worker.messages.length, redundantResizeMessageCount);
  assert.equal(canvas.style.visibility, 'visible');
  assert.equal(bridge.displayOwnerContentReady, true);
  assert.equal(bridge.displayOwnerLastRenderedContent.sphStep, 14);

  const rejectedCas = bridge.setDisplayOwner({
    owner: 'main-native',
    epoch: 9,
    expectedOwner: 'worker',
    expectedEpoch: 8,
    expectedLifecycleGeneration: bridge.lifecycleGeneration,
    reason: 'unit-stale-native-handoff'
  });
  assert.equal(
    rejectedCas.status,
    'worker-offscreen-display-owner-compare-and-swap-rejected'
  );
  assert.equal(bridge.displayOwner, 'worker');
  assert.equal(canvas.style.visibility, 'visible');

  const capturedLateListener = worker.listeners[0];
  const committedNativeOwner = bridge.setDisplayOwner({
    owner: 'main-native',
    epoch: 9,
    expectedOwner: 'worker',
    expectedEpoch: 9,
    expectedLifecycleGeneration: bridge.lifecycleGeneration,
    reason: 'unit-validated-native-handoff'
  });
  assert.equal(committedNativeOwner.displayOwner, 'main-native');
  assert.equal(canvas.style.visibility, 'hidden');

  const replayTargetOwner = bridge.setDisplayOwner({
    owner: 'worker',
    epoch: 10,
    revealWhenContentReady: true,
    reason: 'unit-replay-target-owner'
  });
  assert.equal(replayTargetOwner.displayCanvasVisible, false);
  worker.emit({
    schema: ULG_WORKER_OFFSCREEN_PRESENTATION_SCHEMA,
    frameCount: 3,
    readyFrameCount: 3,
    workerOffscreenRenderRows: {
      ...motionReceipt,
      displayOwnerEpoch: 10
    }
  });
  assert.equal(
    bridge.displayOwnerContentReady,
    false,
    'an exact completed-frame replay cannot repopulate cleared worker pixels'
  );
  assert.equal(canvas.style.visibility, 'hidden');
  bridge.setDisplayOwner({
    owner: 'main-native',
    epoch: 11,
    reason: 'unit-replay-test-cleanup'
  });

  const disposed = bridge.dispose();
  const disposedLifecycleGeneration = bridge.lifecycleGeneration;
  const disposedMessageCount = worker.messages.length;
  assert.equal(disposed.status, 'worker-offscreen-presentation-disposed');
  assert.equal(disposed.disposed, true);
  assert.equal(bridge.worker, null);
  assert.equal(worker.listeners.length, 0);

  capturedLateListener({
    data: {
      schema: ULG_WORKER_OFFSCREEN_PRESENTATION_SCHEMA,
      status: 'worker-offscreen-presentation-ready',
      workerOffscreenRenderRows: {
        schema: ULG_WORKER_OFFSCREEN_RENDER_ROWS_SCHEMA,
        status: 'worker-offscreen-render-rows-rendered',
        displayOwnerEpoch: 9,
        sphStep: 99,
        particleCount: 1
      }
    }
  });
  const lateMutation = bridge.setDisplayOwner({ owner: 'worker', epoch: 10 });
  assert.equal(
    lateMutation.status,
    'worker-offscreen-presentation-disposed-mutation-rejected'
  );
  assert.equal(bridge.status.status, 'worker-offscreen-presentation-disposed');
  assert.equal(bridge.lifecycleGeneration, disposedLifecycleGeneration);
  assert.equal(bridge.displayOwner, 'main-native');
  assert.equal(bridge.displayOwnerPresentedSphStep, null);
  assert.equal(worker.messages.length, disposedMessageCount);
});

test('worker true-isosurface enqueue advances continuation without claiming pixels', () => {
  let worker = null;
  class FakeWorker {
    constructor() {
      this.listeners = [];
      worker = this;
    }
    postMessage() {}
    addEventListener(type, listener) {
      if (type === 'message') this.listeners.push(listener);
    }
    removeEventListener() {}
    emit(data) {
      for (const listener of this.listeners) listener({ data });
    }
    terminate() {}
  }
  const canvas = {
    style: {},
    width: 0,
    height: 0,
    setAttribute() {},
    transferControlToOffscreen() { return {}; }
  };
  const container = {
    clientWidth: 64,
    clientHeight: 64,
    appendChild(child) { child.parentNode = this; },
    removeChild(child) { child.parentNode = null; },
    ownerDocument: { createElement() { return canvas; } }
  };
  const bridge = createUlgWorkerOffscreenPresentationBridge({
    requested: true,
    container,
    width: 64,
    height: 64,
    workerFactory: FakeWorker,
    navigatorRef: { gpu: {} },
    windowRef: { document: container.ownerDocument }
  });
  bridge.setDisplayOwner({
    owner: 'worker',
    epoch: 1,
    revealWhenContentReady: true,
    reason: 'unit-worker-isosurface-owner'
  });
  assert.equal(canvas.style.visibility, 'hidden');

  const common = {
    schema: ULG_WORKER_OFFSCREEN_RESIDENT_ISOSURFACE_PRESENTATION_SCHEMA,
    renderRowsSchema: ULG_WORKER_OFFSCREEN_RENDER_ROWS_SCHEMA,
    presentationGeometry:
      ULG_WORKER_OFFSCREEN_RESIDENT_ISOSURFACE_PRESENTATION_GEOMETRY,
    displayOwnerEpoch: 1,
    sphStep: 11,
    requestGeneration: 1,
    particleCount: 32,
    residentScheduleCandidatePresentation: true,
    ...COMMITTED_CANDIDATE_RECEIPT_FIELDS,
    workerFramebufferEpoch: 1,
    producerSourceKind: 'worker-retained-resident-stage-output',
    producerSourceTransport: 'worker-retained-resident-stage-output',
    sourceStageId: 'schroederSameLevelMechanics',
    retainedParticleStateStatus: 'worker-retained-particle-state-ready'
  };
  worker.emit({
    schema: ULG_WORKER_OFFSCREEN_PRESENTATION_SCHEMA,
    frameCount: 0,
    readyFrameCount: 0,
    workerOffscreenRenderRows: {
      ...common,
      status:
        ULG_WORKER_OFFSCREEN_RESIDENT_ISOSURFACE_PRESENTATION_ENQUEUED_STATUS,
      sourceCapturedBeforePhysicsContinuation: true,
      frameCount: 0,
      readyFrameCount: 0
    }
  });
  assert.equal(
    bridge.committedResidentSchedulePresentationStatus.status,
    ULG_WORKER_OFFSCREEN_RESIDENT_ISOSURFACE_PRESENTATION_ENQUEUED_STATUS
  );
  assert.equal(bridge.workerCanvasLastRenderedContent, null);
  assert.equal(bridge.displayOwnerContentReady, false);
  assert.equal(canvas.style.visibility, 'hidden');

  // queue.submit() alone is not proof that the image reached a presentation
  // opportunity. The bridge must keep the worker canvas hidden until the
  // exact GPU-completion + subsequent RAF receipt arrives.
  worker.emit({
    schema: ULG_WORKER_OFFSCREEN_PRESENTATION_SCHEMA,
    frameCount: 1,
    readyFrameCount: 1,
    workerOffscreenRenderRows: {
      ...common,
      status:
        ULG_WORKER_OFFSCREEN_RESIDENT_ISOSURFACE_PRESENTATION_RENDERED_STATUS,
      frameCount: 1,
      readyFrameCount: 1,
      sameDevicePresentation: true,
      surfaceCount: 1,
      indirectDrawCount: 1
    }
  });
  assert.equal(
    bridge.committedResidentSchedulePresentationStatus.status,
    ULG_WORKER_OFFSCREEN_RESIDENT_ISOSURFACE_PRESENTATION_ENQUEUED_STATUS
  );
  assert.equal(bridge.workerCanvasLastRenderedContent, null);
  assert.equal(bridge.displayOwnerContentReady, false);
  assert.equal(canvas.style.visibility, 'hidden');

  worker.emit({
    schema: ULG_WORKER_OFFSCREEN_PRESENTATION_SCHEMA,
    frameCount: 1,
    readyFrameCount: 1,
    workerOffscreenRenderRows: {
      ...common,
      status:
        ULG_WORKER_OFFSCREEN_RESIDENT_ISOSURFACE_PRESENTATION_RENDERED_STATUS,
      frameCount: 1,
      readyFrameCount: 1,
      sameDevicePresentation: true,
      surfaceCount: 1,
      indirectDrawCount: 1,
      presentationFrameSchema:
        ULG_WORKER_OFFSCREEN_RESIDENT_ISOSURFACE_PRESENTATION_FRAME_SCHEMA,
      presentationFrameStatus:
        'worker-owned-isosurface-presentation-opportunity',
      presentationFrameAdmitted: true,
      presentationFrameGpuCompleted: true,
      presentationFrameGpuCompletionMethod:
        'worker-device.queue.onSubmittedWorkDone',
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
      physicsHostQueueFenceParticipation: null,
      workerOwnedOpticalPresentation: {
        schema: 'peercompute.ulg.worker-isosurface-optical-presentation.v0',
        status: 'all-gas-surfaces-closure-governed',
        gasSurfaceCount: 2,
        closureGovernedGasSurfaceCount: 2,
        visibleClosureGasSurfaceCount: 1,
        opticallyThinHiddenGasSurfaceCount: 1,
        allGasSurfacesClosureGoverned: true,
        heuristicGasOpacityUsed: false,
        opticalProvenanceSources: [
          'molecular-gas-electronic-band-absorption',
          'water-droplet-scattering'
        ]
      },
      workerOwnedParticipatingMediumPresentation: {
        schema:
          'peercompute.ulg.worker-participating-medium-presentation.v0',
        status: 'participating-medium-ready',
        presentationComposition:
          'marching-cubes-isosurfaces-plus-participating-medium',
        marchingCubesSurfaceCount: 1,
        collectiveOpticalSurfaceCount: 2,
        participatingMediumAggregateDrawCount: 1,
        collectiveOpticalShellFallbackCount: 0,
        participatingMediumDepthClipped: true,
        participatingMediumPremultipliedAlpha: true,
        presentationPassOrder: [
          'opaque-isosurface',
          'depth-clipped-participating-medium',
          'transparent-isosurface-and-overlay'
        ]
      },
      presentationComposition:
        'marching-cubes-isosurfaces-plus-participating-medium',
      marchingCubesSurfaceCount: 1,
      collectiveOpticalSurfaceCount: 2,
      participatingMediumStatus: 'participating-medium-ready',
      participatingMediumAggregateDrawCount: 1,
      collectiveOpticalShellFallbackCount: 0,
      participatingMediumDepthClipped: true,
      participatingMediumPremultipliedAlpha: true,
      presentationPassOrder: [
        'opaque-isosurface',
        'depth-clipped-participating-medium',
        'transparent-isosurface-and-overlay'
      ]
    }
  });
  assert.equal(canvas.style.visibility, 'visible');
  assert.equal(bridge.displayOwnerContentReady, true);
  assert.equal(bridge.displayOwnerPresentedSphStep, 11);
  assert.equal(
    bridge.workerCanvasLastRenderedContent.presentationGeometry,
    ULG_WORKER_OFFSCREEN_RESIDENT_ISOSURFACE_PRESENTATION_GEOMETRY
  );
  assert.deepEqual(
    bridge.workerCanvasLastRenderedContent.workerOwnedOpticalPresentation,
    {
      schema: 'peercompute.ulg.worker-isosurface-optical-presentation.v0',
      status: 'all-gas-surfaces-closure-governed',
      gasSurfaceCount: 2,
      closureGovernedGasSurfaceCount: 2,
      visibleClosureGasSurfaceCount: 1,
      opticallyThinHiddenGasSurfaceCount: 1,
      allGasSurfacesClosureGoverned: true,
      heuristicGasOpacityUsed: false,
      opticalProvenanceSources: [
        'molecular-gas-electronic-band-absorption',
        'water-droplet-scattering'
      ]
    }
  );
  assert.deepEqual(
    bridge.workerCanvasLastRenderedContent
      .workerOwnedParticipatingMediumPresentation,
    {
      schema: 'peercompute.ulg.worker-participating-medium-presentation.v0',
      status: 'participating-medium-ready',
      presentationComposition:
        'marching-cubes-isosurfaces-plus-participating-medium',
      marchingCubesSurfaceCount: 1,
      collectiveOpticalSurfaceCount: 2,
      participatingMediumAggregateDrawCount: 1,
      collectiveOpticalShellFallbackCount: 0,
      participatingMediumDepthClipped: true,
      participatingMediumPremultipliedAlpha: true,
      presentationPassOrder: [
        'opaque-isosurface',
        'depth-clipped-participating-medium',
        'transparent-isosurface-and-overlay'
      ]
    }
  );
  assert.equal(
    bridge.workerCanvasLastRenderedContent.presentationComposition,
    'marching-cubes-isosurfaces-plus-participating-medium'
  );
  assert.equal(
    bridge.workerCanvasLastRenderedContent.marchingCubesSurfaceCount,
    1
  );
  assert.equal(
    bridge.workerCanvasLastRenderedContent.collectiveOpticalSurfaceCount,
    2
  );
  assert.equal(
    bridge.workerCanvasLastRenderedContent.participatingMediumStatus,
    'participating-medium-ready'
  );

  const redrawReceipt = {
    ...common,
    status:
      ULG_WORKER_OFFSCREEN_RESIDENT_ISOSURFACE_PRESENTATION_RENDERED_STATUS,
    frameCount: 2,
    readyFrameCount: 2,
    sameDevicePresentation: true,
    surfaceCount: 1,
    indirectDrawCount: 1,
    presentationFrameSchema:
      ULG_WORKER_OFFSCREEN_RESIDENT_ISOSURFACE_PRESENTATION_FRAME_SCHEMA,
    presentationFrameStatus:
      'worker-owned-isosurface-presentation-opportunity',
    presentationFrameAdmitted: true,
    presentationFrameGpuCompleted: true,
    presentationFrameGpuCompletionMethod:
      'worker-device.queue.onSubmittedWorkDone',
    presentationFramePresentationOpportunity: true,
    presentationFramePresentationOpportunityMethod:
      'worker-request-animation-frame-after-gpu-completion',
    presentationQueueCompletionCount: 2,
    presentationQueueCompletionSerial: 2,
    presentationQueueCompletionMethod:
      'worker-device.queue.onSubmittedWorkDone',
    presentationQueueCompletionScope:
      'worker-offscreen-shared-device-queue-frame-proof',
    physicsQueuePrefixCoverage: 'physics-queue-prefix-not-attributed',
    physicsHostQueueFenceParticipation: null
  };
  worker.emit({
    schema: ULG_WORKER_OFFSCREEN_PRESENTATION_SCHEMA,
    frameCount: 2,
    readyFrameCount: 2,
    workerOffscreenRenderRows: redrawReceipt
  });
  assert.equal(bridge.workerCanvasLastRenderedContent.frameCount, 2);
  assert.equal(bridge.workerFramebufferQueueCompletionSerialHighWater, 2);

  worker.emit({
    schema: ULG_WORKER_OFFSCREEN_PRESENTATION_SCHEMA,
    frameCount: 3,
    readyFrameCount: 3,
    workerOffscreenRenderRows: {
      ...redrawReceipt,
      frameCount: 3,
      readyFrameCount: 3
    }
  });
  assert.equal(
    bridge.workerCanvasLastRenderedContent.frameCount,
    2,
    'an equal-version redraw replay must not advance without a fresh queue serial'
  );

  worker.emit({
    schema: ULG_WORKER_OFFSCREEN_PRESENTATION_SCHEMA,
    frameCount: 1,
    readyFrameCount: 1,
    workerOffscreenRenderRows: {
      ...common,
      status: 'worker-offscreen-resident-isosurface-presentation-failed',
      reason: 'later extraction failed',
      frameCount: 1,
      readyFrameCount: 1
    }
  });
  assert.equal(canvas.style.visibility, 'visible');
  assert.equal(bridge.displayOwnerPresentedSphStep, 11);
  assert.equal(
    bridge.workerCanvasLastRenderedContent.status,
    ULG_WORKER_OFFSCREEN_RESIDENT_ISOSURFACE_PRESENTATION_RENDERED_STATUS
  );

  const newer = {
    ...common,
    scheduleId: 'schedule:newer-isosurface-frame',
    computeManagerLeaseId: 'lease:newer-isosurface-frame',
    residentExecutionGeneration: 8,
    stepOrdinal: 2,
    sphStep: 12,
    requestGeneration: 2
  };
  worker.emit({
    schema: ULG_WORKER_OFFSCREEN_PRESENTATION_SCHEMA,
    frameCount: 1,
    readyFrameCount: 1,
    workerOffscreenRenderRows: {
      ...newer,
      status:
        ULG_WORKER_OFFSCREEN_RESIDENT_ISOSURFACE_PRESENTATION_ENQUEUED_STATUS,
      sourceCapturedBeforePhysicsContinuation: true,
      frameCount: 1,
      readyFrameCount: 1
    }
  });
  assert.equal(
    bridge.committedResidentSchedulePresentationStatus.status,
    ULG_WORKER_OFFSCREEN_RESIDENT_ISOSURFACE_PRESENTATION_ENQUEUED_STATUS
  );
  assert.equal(bridge.committedResidentSchedulePresentationStatus.sphStep, 12);
  assert.equal(bridge.displayOwnerPresentedSphStep, 11);

  worker.emit({
    schema: ULG_WORKER_OFFSCREEN_PRESENTATION_SCHEMA,
    frameCount: 2,
    readyFrameCount: 2,
    workerOffscreenRenderRows: {
      ...common,
      status:
        ULG_WORKER_OFFSCREEN_RESIDENT_ISOSURFACE_PRESENTATION_RENDERED_STATUS,
      frameCount: 2,
      readyFrameCount: 2,
      sameDevicePresentation: true,
      surfaceCount: 1,
      indirectDrawCount: 1
    }
  });
  assert.equal(
    bridge.committedResidentSchedulePresentationStatus.status,
    ULG_WORKER_OFFSCREEN_RESIDENT_ISOSURFACE_PRESENTATION_ENQUEUED_STATUS
  );
  assert.equal(bridge.committedResidentSchedulePresentationStatus.sphStep, 12);
  assert.equal(bridge.displayOwnerPresentedSphStep, 11);
  assert.equal(
    bridge.workerCanvasLastRenderedContent.requestGeneration,
    1
  );

  const preResizeQueueSerialHighWater =
    bridge.workerFramebufferQueueCompletionSerialHighWater;
  bridge.resize({
    width: 80,
    height: 64,
    devicePixelRatio: 1,
    reason: 'unit-isosurface-framebuffer-epoch-resize'
  });
  assert.equal(bridge.workerFramebufferEpoch, 2);
  assert.equal(bridge.workerCanvasLastRenderedContent, null);
  assert.equal(canvas.style.visibility, 'hidden');

  const unseenQueueSerialAfterResize = {
    ...redrawReceipt,
    ...newer,
    status:
      ULG_WORKER_OFFSCREEN_RESIDENT_ISOSURFACE_PRESENTATION_RENDERED_STATUS,
    frameCount: 3,
    readyFrameCount: 3,
    presentationQueueCompletionCount: 3,
    presentationQueueCompletionSerial: 3
  };
  worker.emit({
    schema: ULG_WORKER_OFFSCREEN_PRESENTATION_SCHEMA,
    frameCount: 3,
    readyFrameCount: 3,
    workerOffscreenRenderRows: unseenQueueSerialAfterResize
  });
  assert.equal(
    bridge.workerCanvasLastRenderedContent,
    null,
    'a fresh queue serial from the pre-resize framebuffer must be rejected'
  );
  assert.equal(
    bridge.workerFramebufferQueueCompletionSerialHighWater,
    preResizeQueueSerialHighWater,
    'a stale framebuffer epoch must not consume the queue-serial high water'
  );
  assert.equal(canvas.style.visibility, 'hidden');

  worker.emit({
    schema: ULG_WORKER_OFFSCREEN_PRESENTATION_SCHEMA,
    frameCount: 4,
    readyFrameCount: 4,
    workerOffscreenRenderRows: {
      ...unseenQueueSerialAfterResize,
      frameCount: 4,
      readyFrameCount: 4,
      workerFramebufferEpoch: 2,
      presentationQueueCompletionCount: 4,
      presentationQueueCompletionSerial: 4
    }
  });
  assert.equal(bridge.workerCanvasLastRenderedContent.workerFramebufferEpoch, 2);
  assert.equal(bridge.workerFramebufferQueueCompletionSerialHighWater, 4);
  assert.equal(canvas.style.visibility, 'visible');
  bridge.dispose();
});

test('worker offscreen render rows pack compact transferable particle rows', () => {
  const payload = packUlgWorkerOffscreenRenderRowsPayload({
    positionsM: new Float32Array([1, 2, 3, 4, 5, 6]),
    colorsRgb: new Float32Array([0.1, 0.2, 0.3, 0.4, 0.5, 0.6]),
    particleRadiiM: new Float32Array([0.07, 0.08]),
    particlePhaseIds: new Float32Array([3, 4]),
    alpha: 0.75
  });

  assert.equal(payload.schema, ULG_WORKER_OFFSCREEN_RENDER_ROWS_SCHEMA);
  assert.equal(payload.status, 'worker-offscreen-render-rows-packed');
  assert.equal(payload.inputTransport, ULG_WORKER_OFFSCREEN_RENDER_ROWS_INPUT_TRANSPORT);
  assert.equal(payload.particleCount, 2);
  assert.equal(payload.strideFloats, ULG_WORKER_OFFSCREEN_RENDER_ROW_PARTICLE_STRIDE_FLOATS);
  assert.equal(payload.particleRows.length, 16);
  assert.equal(payload.particleRows[0], 1);
  assert.equal(payload.particleRows[3].toFixed(2), '-0.07');
  assert.equal(payload.particleRows[7], 0.75);
  assert.equal(payload.particleRows[8], 4);
  assert.equal(payload.particleRows[11].toFixed(2), '0.08');
  assert.equal(payload.byteLength, payload.particleRows.byteLength);
});

test('worker-owned resident render producer reuses worker source cache on repeated source key', () => {
  let worker = null;
  class FakeWorker {
    constructor() {
      this.messages = [];
      worker = this;
    }

    postMessage(data, transfer = []) {
      this.messages.push({ data, transfer });
    }

    addEventListener() {}

    terminate() {}
  }

  const canvas = {
    style: {},
    width: 0,
    height: 0,
    setAttribute() {},
    transferControlToOffscreen() {
      return { offscreen: true };
    }
  };
  const container = {
    clientWidth: 64,
    clientHeight: 64,
    appendChild(child) {
      child.parentNode = this;
    },
    ownerDocument: {
      createElement(name) {
        assert.equal(name, 'canvas');
        return canvas;
      }
    }
  };
  const bridge = createUlgWorkerOffscreenPresentationBridge({
    requested: true,
    retainedGpuBufferHandoffRequested: false,
    container,
    width: 64,
    height: 64,
    devicePixelRatio: 1,
    workerFactory: FakeWorker,
    navigatorRef: { gpu: {} },
    windowRef: { document: container.ownerDocument }
  });

  assert.equal(bridge.worker, worker);
  assert.equal(worker.messages[0]?.data?.type, 'init-offscreen-presentation');

  const drawInput = {
    boxDimsM: [4, 5, 6],
    positionsM: new Float32Array([0, 0, 0, 1, 0, 0]),
    colorsRgb: new Float32Array([1, 0, 0, 0, 1, 0]),
    particleRadiiM: new Float32Array([0.05, 0.05]),
    particlePhaseIds: new Float32Array([3, 4]),
    sourceCacheKey: 'source:a',
    viewProjectionMatrix: new Float32Array(16).fill(0)
  };
  drawInput.viewProjectionMatrix[0] = 1;
  drawInput.viewProjectionMatrix[5] = 1;
  drawInput.viewProjectionMatrix[10] = 1;
  drawInput.viewProjectionMatrix[15] = 1;

  const uploaded = bridge.drawResidentRenderProducer(drawInput);
  const reused = bridge.drawResidentRenderProducer({
    ...drawInput,
    boxDimsM: [7, 8, 9]
  });
  const firstDraw = worker.messages[1]?.data;
  const secondDraw = worker.messages[2]?.data;

  assert.equal(firstDraw.schema, ULG_WORKER_OFFSCREEN_RESIDENT_RENDER_PRODUCER_SCHEMA);
  assert.equal(firstDraw.type, 'draw-resident-render-producer');
  assert.equal(firstDraw.reuseSourceCache, false);
  assert.equal(firstDraw.sourceCacheStatus, 'source-cache-uploaded');
  assert.equal(firstDraw.sourceRowsPacked, true);
  assert.ok(firstDraw.sourceParticleRows instanceof Float32Array);
  assert.equal(firstDraw.sourceParticleRows[3].toFixed(2), '-0.05');
  assert.equal(firstDraw.sourceParticleRows[11].toFixed(2), '0.05');
  assert.deepEqual(firstDraw.boxDimsM, [4, 5, 6]);
  assert.equal(uploaded.sourceTransferBytes, 64);

  assert.equal(secondDraw.schema, ULG_WORKER_OFFSCREEN_RESIDENT_RENDER_PRODUCER_SCHEMA);
  assert.equal(secondDraw.reuseSourceCache, true);
  assert.equal(secondDraw.sourceCacheStatus, 'source-cache-reused');
  assert.equal(secondDraw.sourceRowsPacked, false);
  assert.equal(secondDraw.sourceParticleRows, undefined);
  assert.deepEqual(secondDraw.boxDimsM, [7, 8, 9]);
  assert.equal(reused.sourceCacheHit, true);
  assert.equal(reused.sourceRowsPacked, false);
  assert.equal(reused.sourceTransferBytes, 0);
  assert.equal(reused.inputTransferBytes, 64);
  assert.equal(reused.producerSourceTransport, 'worker-resident-source-cache');
});

test('worker-owned resident particle-state producer imports state once then reuses worker cache', () => {
  let worker = null;
  class FakeWorker {
    constructor() {
      this.messages = [];
      worker = this;
    }

    postMessage(data, transfer = []) {
      this.messages.push({ data, transfer });
    }

    addEventListener() {}

    terminate() {}
  }

  const canvas = {
    style: {},
    width: 0,
    height: 0,
    setAttribute() {},
    transferControlToOffscreen() {
      return { offscreen: true };
    }
  };
  const container = {
    clientWidth: 64,
    clientHeight: 64,
    appendChild(child) {
      child.parentNode = this;
    },
    ownerDocument: {
      createElement(name) {
        assert.equal(name, 'canvas');
        return canvas;
      }
    }
  };
  const bridge = createUlgWorkerOffscreenPresentationBridge({
    requested: true,
    retainedGpuBufferHandoffRequested: false,
    container,
    width: 64,
    height: 64,
    devicePixelRatio: 1,
    workerFactory: FakeWorker,
    navigatorRef: { gpu: {} },
    windowRef: { document: container.ownerDocument }
  });

  assert.equal(bridge.worker, worker);
  const viewProjectionMatrix = new Float32Array(16);
  viewProjectionMatrix[0] = 1;
  viewProjectionMatrix[5] = 1;
  viewProjectionMatrix[10] = 1;
  viewProjectionMatrix[15] = 1;
  const sphParticleState = {
    particleCount: 2,
    stateStrideFloats: 8,
    thermoStrideFloats: 12,
    state: new Float32Array(16),
    thermo: new Float32Array(24)
  };
  const materialColorRows = new Float32Array([
    7, 2, 0, 0,
    0.2, 0.4, 0.6, 1
  ]);
  const firstStatus = bridge.drawResidentParticleStateProducer({
    boxDimsM: [4, 5, 6],
    sphParticleState,
    materialColorRows,
    sourceCacheKey: 'resident-state:a',
    sourceCacheKeyStrategy: 'step-time',
    sourceCpuStateStale: false,
    viewProjectionMatrix
  });
  const secondStatus = bridge.drawResidentParticleStateProducer({
    boxDimsM: [7, 8, 9],
    sphParticleState,
    materialColorRows,
    sourceCacheKey: 'resident-state:a',
    sourceCacheKeyStrategy: 'step-time',
    sourceCpuStateStale: false,
    viewProjectionMatrix
  });
  const firstDraw = worker.messages[1]?.data;
  const secondDraw = worker.messages[2]?.data;

  assert.equal(firstDraw.schema, ULG_WORKER_OFFSCREEN_RESIDENT_PARTICLE_STATE_PRODUCER_SCHEMA);
  assert.equal(firstDraw.type, 'draw-resident-particle-state-producer');
  assert.equal(firstDraw.reuseSourceCache, false);
  assert.equal(firstDraw.sourceRowsPacked, false);
  assert.ok(firstDraw.sourceState instanceof Float32Array);
  assert.ok(firstDraw.sourceThermo instanceof Float32Array);
  assert.ok(firstDraw.materialColorRows instanceof Float32Array);
  assert.equal(firstDraw.sourceParticleRows, undefined);
  assert.equal(firstDraw.sourceCacheKeyStrategy, 'step-time');
  assert.equal(firstDraw.sourceCpuStateStale, false);
  assert.equal(firstDraw.sourceCacheMissReason, 'source-cache-empty');
  assert.deepEqual(firstDraw.boxDimsM, [4, 5, 6]);
  assert.equal(firstStatus.sourceStateTransferBytes, 192);
  assert.equal(firstStatus.sourceTransferBytes, 0);
  assert.equal(firstStatus.sourceCacheKeyStrategy, 'step-time');
  assert.equal(firstStatus.sourceCacheMissReason, 'source-cache-empty');

  assert.equal(secondDraw.schema, ULG_WORKER_OFFSCREEN_RESIDENT_PARTICLE_STATE_PRODUCER_SCHEMA);
  assert.equal(secondDraw.reuseSourceCache, true);
  assert.equal(secondDraw.sourceRowsPacked, false);
  assert.equal(secondDraw.sourceState, undefined);
  assert.equal(secondDraw.sourceThermo, undefined);
  assert.equal(secondDraw.materialColorRows, undefined);
  assert.deepEqual(secondDraw.boxDimsM, [7, 8, 9]);
  assert.equal(secondStatus.sourceCacheHit, true);
  assert.equal(secondStatus.sourceCacheKeyStrategy, 'step-time');
  assert.equal(secondStatus.sourceCacheMissReason, null);
  assert.equal(secondStatus.sourceStateTransferBytes, 0);
  assert.equal(secondStatus.inputTransferBytes, 64);
});

test('worker offscreen bridge can submit resident stage work to the presentation device', () => {
  let worker = null;
  class FakeWorker {
    constructor() {
      this.messages = [];
      this.listeners = [];
      worker = this;
    }

    postMessage(data, transfer = []) {
      this.messages.push({ data, transfer });
    }

    addEventListener(type, listener) {
      if (type === 'message') this.listeners.push(listener);
    }

    emit(data) {
      for (const listener of this.listeners) listener({ data });
    }

    terminate() {}
  }

  const canvas = {
    style: {},
    width: 0,
    height: 0,
    setAttribute() {},
    transferControlToOffscreen() {
      return { offscreen: true };
    }
  };
  const container = {
    clientWidth: 64,
    clientHeight: 64,
    appendChild(child) {
      child.parentNode = this;
    },
    ownerDocument: {
      createElement(name) {
        assert.equal(name, 'canvas');
        return canvas;
      }
    }
  };
  const bridge = createUlgWorkerOffscreenPresentationBridge({
    requested: true,
    retainedGpuBufferHandoffRequested: false,
    container,
    width: 64,
    height: 64,
    devicePixelRatio: 1,
    workerFactory: FakeWorker,
    navigatorRef: { gpu: {} },
    windowRef: { document: container.ownerDocument }
  });

  const payload = {
    stage: { id: 'g2p' },
    lease: {
      laneId: 'ulg:test:presentation-worker-lane',
      stateKey: 'ulg:test:presentation-worker-state'
    },
    context: {
      ulgMechanicsResidentStageWorker: {
        schema: 'peercompute.ulg.mechanics-resident-stage-worker-context.v0',
        common: {}
      }
    }
  };
  const submitted = bridge.runResidentStageOnPresentationDevice({
    payload,
    reason: 'unit-test-resident-stage'
  });
  const message = worker.messages.at(-1)?.data;

  assert.equal(submitted.schema, ULG_WORKER_OFFSCREEN_PRESENTATION_RESIDENT_STAGE_SCHEMA);
  assert.equal(submitted.status, 'worker-offscreen-resident-stage-on-presentation-device-submit-posted');
  assert.equal(submitted.inputTransport, ULG_WORKER_OFFSCREEN_PRESENTATION_RESIDENT_STAGE_TRANSPORT);
  assert.equal(submitted.stageId, 'g2p');
  assert.equal(submitted.workerDeviceProvided, true);
  assert.equal(message.type, 'run-resident-stage-on-presentation-device');
  assert.equal(message.schema, ULG_WORKER_OFFSCREEN_PRESENTATION_RESIDENT_STAGE_SCHEMA);
  assert.equal(message.payload, payload);

  worker.emit({
    schema: ULG_WORKER_OFFSCREEN_PRESENTATION_SCHEMA,
    workerOffscreenResidentStage: {
      schema: ULG_WORKER_OFFSCREEN_PRESENTATION_RESIDENT_STAGE_SCHEMA,
      status: 'worker-offscreen-resident-stage-on-presentation-device-completed',
      stageId: 'g2p',
      residentStageRetainedBufferRefs: ['sph-state-buffer']
    }
  });

  assert.equal(
    bridge.residentStageStatus.status,
    'worker-offscreen-resident-stage-on-presentation-device-completed'
  );
  assert.deepEqual(bridge.residentStageStatus.residentStageRetainedBufferRefs, ['sph-state-buffer']);
});

test('worker offscreen bridge can request retained compact snapshot export', () => {
  let worker = null;
  class FakeWorker {
    constructor() {
      this.messages = [];
      this.listeners = [];
      worker = this;
    }

    postMessage(data, transfer = []) {
      this.messages.push({ data, transfer });
    }

    addEventListener(type, listener) {
      if (type === 'message') this.listeners.push(listener);
    }

    emit(data) {
      for (const listener of this.listeners) listener({ data });
    }

    terminate() {}
  }

  const canvas = {
    style: {},
    width: 0,
    height: 0,
    setAttribute() {},
    transferControlToOffscreen() {
      return { offscreen: true };
    }
  };
  const container = {
    clientWidth: 64,
    clientHeight: 64,
    appendChild(child) {
      child.parentNode = this;
    },
    ownerDocument: {
      createElement(name) {
        assert.equal(name, 'canvas');
        return canvas;
      }
    }
  };
  const bridge = createUlgWorkerOffscreenPresentationBridge({
    requested: true,
    retainedGpuBufferHandoffRequested: false,
    container,
    width: 64,
    height: 64,
    devicePixelRatio: 1,
    workerFactory: FakeWorker,
    navigatorRef: { gpu: {} },
    windowRef: { document: container.ownerDocument }
  });

  const submitted = bridge.exportRetainedCompactSnapshot({
    laneId: 'ulg:test:presentation-worker-lane',
    stateKey: 'ulg:test:presentation-worker-state',
    cacheKey: 'ulg:test:presentation-worker-cache',
    particleCount: 2,
    stateStrideFloats: 8,
    thermoStrideFloats: 12,
    mechanicsStrideFloats: 24,
    reason: 'unit-test-retained-snapshot'
  });
  const message = worker.messages.at(-1)?.data;

  assert.equal(submitted.schema, ULG_WORKER_OFFSCREEN_RETAINED_COMPACT_SNAPSHOT_SCHEMA);
  assert.equal(submitted.status, 'presentation-worker-retained-compact-snapshot-export-submit-posted');
  assert.equal(submitted.workerDeviceProvided, true);
  assert.equal(message.type, 'export-retained-compact-snapshot');
  assert.equal(message.schema, ULG_WORKER_OFFSCREEN_RETAINED_COMPACT_SNAPSHOT_SCHEMA);
  assert.equal(message.laneId, 'ulg:test:presentation-worker-lane');
  assert.equal(message.stateKey, 'ulg:test:presentation-worker-state');
  assert.equal(message.cacheKey, 'ulg:test:presentation-worker-cache');
  assert.equal(message.particleCount, 2);

  worker.emit({
    schema: ULG_WORKER_OFFSCREEN_PRESENTATION_SCHEMA,
    workerOffscreenRetainedCompactSnapshot: {
      schema: ULG_WORKER_OFFSCREEN_RETAINED_COMPACT_SNAPSHOT_SCHEMA,
      status: 'presentation-worker-retained-compact-snapshot-exported',
      compactBufferSnapshotSchema: ULG_REMOTE_TASK_GRAPH_COMPACT_BUFFER_SNAPSHOT_SCHEMA,
      portableSnapshotAvailable: true,
      crossPeerReplayReady: true,
      readbackByteLength: 256
    }
  });

  assert.equal(
    bridge.retainedCompactSnapshotStatus.status,
    'presentation-worker-retained-compact-snapshot-exported'
  );
  assert.equal(bridge.retainedCompactSnapshotStatus.portableSnapshotAvailable, true);
  assert.equal(bridge.retainedCompactSnapshotStatus.readbackByteLength, 256);
});

test('worker offscreen compact snapshot stays private, rejects stale exports, and clears on dispose', () => {
  let worker = null;
  class FakeWorker {
    constructor() {
      this.messages = [];
      this.listeners = [];
      worker = this;
    }

    postMessage(data, transfer = []) {
      this.messages.push({ data, transfer });
    }

    addEventListener(type, listener) {
      if (type === 'message') this.listeners.push(listener);
    }

    removeEventListener(type, listener) {
      if (type === 'message') {
        this.listeners = this.listeners.filter((entry) => entry !== listener);
      }
    }

    emit(data) {
      for (const listener of this.listeners) listener({ data });
    }

    terminate() {}
  }

  const canvas = {
    style: {},
    width: 0,
    height: 0,
    setAttribute() {},
    transferControlToOffscreen() {
      return { offscreen: true };
    }
  };
  const container = {
    clientWidth: 64,
    clientHeight: 64,
    appendChild(child) {
      child.parentNode = this;
    },
    removeChild(child) {
      if (child.parentNode === this) child.parentNode = null;
    },
    ownerDocument: {
      createElement(name) {
        assert.equal(name, 'canvas');
        return canvas;
      }
    }
  };
  const bridge = createUlgWorkerOffscreenPresentationBridge({
    requested: true,
    retainedGpuBufferHandoffRequested: false,
    container,
    width: 64,
    height: 64,
    devicePixelRatio: 1,
    workerFactory: FakeWorker,
    navigatorRef: { gpu: {} },
    windowRef: { document: container.ownerDocument }
  });
  const laneId = 'ulg:test:private-snapshot-lane';
  const stateKey = 'ulg:test:private-snapshot-state';
  const emitSnapshot = (cacheKey, step) => {
    const compactBufferSnapshot = {
      schema: ULG_REMOTE_TASK_GRAPH_COMPACT_BUFFER_SNAPSHOT_SCHEMA,
      status: 'compact-buffer-snapshot-exported-from-worker-retained-state',
      laneId,
      stateKey,
      cacheKey,
      sourceStageId: 'schroederSameLevelMechanics',
      particleCount: 1,
      step,
      time: step * 0.001,
      topologyEpoch: step,
      sharedSlotIdentityVerified: true,
      sphState: new Float32Array(8),
      sphThermo: new Float32Array(12),
      sphIdentity: new Uint32Array(4),
      mlsMpmMechanics: new Float32Array(32)
    };
    worker.emit({
      schema: ULG_WORKER_OFFSCREEN_PRESENTATION_SCHEMA,
      status: 'presentation-worker-retained-compact-snapshot-exported',
      workerOffscreenRetainedCompactSnapshot: {
        schema: ULG_WORKER_OFFSCREEN_RETAINED_COMPACT_SNAPSHOT_SCHEMA,
        status: 'presentation-worker-retained-compact-snapshot-exported',
        laneId,
        stateKey,
        cacheKey,
        sourceStageId: 'schroederSameLevelMechanics',
        portableSnapshotAvailable: true,
        crossPeerReplayReady: true,
        readbackByteLength: 224,
        compactBufferSnapshot
      }
    });
    return compactBufferSnapshot;
  };
  const requestSnapshot = (cacheKey) => bridge.exportRetainedCompactSnapshot({
    laneId,
    stateKey,
    cacheKey,
    sourceStageId: 'schroederSameLevelMechanics',
    particleCount: 1,
    stateStrideFloats: 8,
    thermoStrideFloats: 12,
    mechanicsStrideFloats: 32,
    allowLocalMaterializationBypass: false
  });

  requestSnapshot('snapshot:a');
  const snapshotA = emitSnapshot('snapshot:a', 4);
  assert.equal(
    bridge.retainedCompactSnapshotStatus.compactBufferSnapshot,
    snapshotA
  );
  assert.ok(
    bridge.retainedCompactSnapshotStatus.compactBufferSnapshot.sphState
      instanceof Float32Array
  );
  assert.equal(
    bridge.status.workerOffscreenRetainedCompactSnapshot.compactBufferSnapshot,
    null
  );
  assert.equal(
    bridge.status.workerOffscreenRetainedCompactSnapshot
      .compactBufferSnapshotPayloadRetainedPrivately,
    true
  );
  assert.equal(
    bridge.status.workerOffscreenRetainedCompactSnapshot
      .compactBufferSnapshotStep,
    4
  );

  requestSnapshot('snapshot:b');
  assert.equal(
    bridge.retainedCompactSnapshotStatus.status,
    'presentation-worker-retained-compact-snapshot-export-submit-posted'
  );
  assert.equal(
    bridge.retainedCompactSnapshotStatus.compactBufferSnapshot,
    undefined
  );
  emitSnapshot('snapshot:a', 4);
  assert.equal(bridge.retainedCompactSnapshotRejectedStaleCount, 1);
  assert.equal(bridge.retainedCompactSnapshotStatus.cacheKey, 'snapshot:b');
  assert.equal(
    bridge.retainedCompactSnapshotStatus.status,
    'presentation-worker-retained-compact-snapshot-export-submit-posted'
  );
  assert.equal(
    bridge.status.status,
    'presentation-worker-retained-compact-snapshot-stale-response-rejected'
  );
  assert.equal(
    bridge.status.workerOffscreenRetainedCompactSnapshot.compactBufferSnapshot,
    null
  );

  const snapshotB = emitSnapshot('snapshot:b', 5);
  assert.equal(
    bridge.retainedCompactSnapshotStatus.compactBufferSnapshot,
    snapshotB
  );
  assert.equal(
    bridge.status.workerOffscreenRetainedCompactSnapshot.compactBufferSnapshot,
    null
  );
  assert.equal(
    bridge.status.workerOffscreenRetainedCompactSnapshot
      .compactBufferSnapshotStep,
    5
  );

  bridge.dispose();
  assert.equal(bridge.retainedCompactSnapshotStatus, null);
  assert.equal(bridge.retainedCompactSnapshotRequestIdentity, null);
  assert.equal(bridge.status.workerOffscreenRetainedCompactSnapshot, null);
});

test('worker offscreen retained compact snapshot export bypasses mapAsync when local materialization is ready', () => {
  let worker = null;
  class FakeWorker {
    constructor() {
      this.messages = [];
      this.listeners = [];
      worker = this;
    }

    postMessage(data, transfer = []) {
      this.messages.push({ data, transfer });
    }

    addEventListener(type, listener) {
      if (type === 'message') this.listeners.push(listener);
    }

    terminate() {}
  }

  const canvas = {
    style: {},
    width: 0,
    height: 0,
    setAttribute() {},
    transferControlToOffscreen() {
      return { offscreen: true };
    }
  };
  const container = {
    clientWidth: 64,
    clientHeight: 64,
    appendChild(child) {
      child.parentNode = this;
    },
    ownerDocument: {
      createElement(name) {
        assert.equal(name, 'canvas');
        return canvas;
      }
    }
  };
  const bridge = createUlgWorkerOffscreenPresentationBridge({
    requested: true,
    retainedGpuBufferHandoffRequested: false,
    container,
    width: 64,
    height: 64,
    devicePixelRatio: 1,
    workerFactory: FakeWorker,
    navigatorRef: { gpu: {} },
    windowRef: { document: container.ownerDocument }
  });
  const messageCountBeforeExport = worker.messages.length;

  const submitted = bridge.exportRetainedCompactSnapshot({
    laneId: 'ulg:test:presentation-worker-lane',
    stateKey: 'ulg:test:presentation-worker-state',
    cacheKey: 'ulg:test:presentation-worker-cache',
    particleCount: 2,
    localMaterializationSource: {
      schema: 'peercompute.ulg.presentation-worker-retained-local-materialization-source.v0',
      status: 'presentation-worker-retained-state-continuation-completed',
      hotBufferKey: 'ulg:test:presentation-worker-hot-buffer',
      workerRetainedContinuationApplied: true,
      useWorkerRetainedInput: true,
      workerRetainedBufferRefs: [
        'ulg-worker:test:presentation:g2p:state',
        'ulg-worker:test:presentation:g2p:mechanics'
      ],
      crossPeerReplayStatus: 'blocked-portable-compact-buffer-snapshot-required',
      crossPeerReplayBlocker: 'worker-retained-gpu-handles-are-not-cross-peer-portable'
    },
    reason: 'unit-test-local-materialization'
  });

  assert.equal(submitted.schema, ULG_WORKER_OFFSCREEN_RETAINED_COMPACT_SNAPSHOT_SCHEMA);
  assert.equal(
    submitted.status,
    'presentation-worker-retained-compact-snapshot-export-bypassed-local-materialization-ready'
  );
  assert.equal(submitted.localMaterializationReady, true);
  assert.equal(submitted.localMaterializationMode, 'same-worker-lane-retained-buffer-ref');
  assert.equal(submitted.workerReadbackBypassed, true);
  assert.equal(submitted.workerMapAsyncBypassed, true);
  assert.equal(submitted.portableSnapshotAvailable, false);
  assert.equal(submitted.crossPeerReplayReady, false);
  assert.equal(submitted.readbackByteLength, 0);
  assert.deepEqual(submitted.workerRetainedBufferRefs, [
    'ulg-worker:test:presentation:g2p:state',
    'ulg-worker:test:presentation:g2p:mechanics'
  ]);
  assert.equal(worker.messages.length, messageCountBeforeExport);
  assert.equal(
    worker.messages.some((entry) => entry.data?.type === 'export-retained-compact-snapshot'),
    false
  );
  assert.equal(
    bridge.retainedCompactSnapshotStatus.status,
    'presentation-worker-retained-compact-snapshot-export-bypassed-local-materialization-ready'
  );
});

test('worker offscreen retained GPUBuffer handoff fails closed before plan change', () => {
  const blockedClone = resolveUlgWorkerOffscreenRetainedGpuBufferHandoffCapability({
    requested: true,
    presentationStatus: {
      status: 'worker-offscreen-presentation-ready',
      canvasTransferred: true,
      workerReady: true
    },
    retainedRenderRowsBufferAvailable: true,
    retainedRenderRowsBufferByteLength: 1024,
    crossOriginIsolated: false,
    gpuBufferStructuredCloneSupported: false,
    gpuBufferStructuredCloneProbeStatus: 'gpubuffer-worker-structured-clone-blocked-local-https-probe',
    gpuBufferStructuredCloneProbeReason:
      'DataCloneError: GPUBuffer object could not be cloned'
  });

  assert.equal(blockedClone.schema, ULG_WORKER_OFFSCREEN_RETAINED_GPU_BUFFER_HANDOFF_SCHEMA);
  assert.equal(
    blockedClone.status,
    'worker-offscreen-retained-gpubuffer-handoff-blocked-structured-clone-unavailable'
  );
  assert.equal(blockedClone.inputTransport, ULG_WORKER_OFFSCREEN_RETAINED_GPU_BUFFER_TRANSPORT);
  assert.equal(
    blockedClone.preferredReplacementTransport,
    ULG_WORKER_OFFSCREEN_WORKER_LOCAL_PRODUCER_TRANSPORT
  );
  assert.equal(blockedClone.planChangeRequired, true);
  assert.equal(blockedClone.frameCopyBackRejected, true);
  assert.equal(blockedClone.copiedBytesPerFrame, 0);

  const deviceSplit = resolveUlgWorkerOffscreenRetainedGpuBufferHandoffCapability({
    requested: true,
    presentationStatus: {
      status: 'worker-offscreen-presentation-ready',
      canvasTransferred: true,
      workerReady: true
    },
    retainedRenderRowsBufferAvailable: true,
    gpuBufferStructuredCloneSupported: true,
    workerPresentationDeviceOwner: 'worker-owned-presentation-device',
    residentBufferDeviceOwner: 'main-thread-resident-device'
  });

  assert.equal(
    deviceSplit.status,
    'worker-offscreen-retained-gpubuffer-handoff-blocked-device-owner-split'
  );
  assert.equal(deviceSplit.sameDeviceOwner, false);
});

test('worker offscreen bridge arbitrates resident-schedule-candidate messages through a versioned mailbox', () => {
  let worker = null;
  class FakeWorker {
    constructor() {
      this.messages = [];
      this.listeners = [];
      worker = this;
    }

    postMessage(data, transfer = []) {
      this.messages.push({ data, transfer });
    }

    addEventListener(type, listener) {
      if (type === 'message') this.listeners.push(listener);
    }

    removeEventListener(type, listener) {
      if (type === 'message') {
        this.listeners = this.listeners.filter((entry) => entry !== listener);
      }
    }

    emit(data) {
      for (const listener of this.listeners) listener({ data });
    }

    terminate() {}
  }
  const canvas = {
    style: {},
    width: 0,
    height: 0,
    setAttribute() {},
    transferControlToOffscreen() {
      return { offscreen: true };
    }
  };
  const container = {
    clientWidth: 64,
    clientHeight: 64,
    appendChild(child) {
      child.parentNode = this;
    },
    removeChild(child) {
      if (child.parentNode === this) child.parentNode = null;
    },
    ownerDocument: {
      createElement() {
        return canvas;
      }
    }
  };
  const acceptedCandidates = [];
  const bridge = createUlgWorkerOffscreenPresentationBridge({
    requested: true,
    container,
    width: 64,
    height: 64,
    workerFactory: FakeWorker,
    navigatorRef: { gpu: {} },
    windowRef: { document: container.ownerDocument },
    onResidentRenderCandidate: (candidate) => acceptedCandidates.push(candidate)
  });
  assert.equal(typeof bridge.residentRenderCandidateMailbox?.publish, 'function');
  assert.equal(bridge.residentRenderCandidateRejectedCount, 0);

  const identity = (step) => ({
    storageGeneration: 7,
    physicsTick: 100 + step,
    physicsSubstep: 0,
    positionEpoch: 200 + step,
    topologyEpoch: 2,
    chartEpoch: 3,
    levelEpoch: 1,
    supportEpoch: 1
  });
  const candidate = (step, stepOrdinal = step) => ({
    schema: ULG_RESIDENT_RENDER_CANDIDATE_SCHEMA,
    laneId: 'ulg:test:bridge-lane',
    stateKey: 'ulg:test:bridge-state',
    presentationLaneEpoch: 1,
    version: {
      residentExecutionGeneration: 7,
      nextStep: 100 + step,
      scheduleId: 'ulg:test:bridge-sched',
      stepOrdinal
    },
    epochIdentity: identity(step),
    retainedBufferRefs: [`ulg-worker:test:state:${step}`]
  });

  worker.emit({ type: 'resident-schedule-candidate', candidate: candidate(1) });
  worker.emit({ type: 'resident-schedule-candidate', candidate: candidate(2) });
  // Stale republish: dropped by the bridge mailbox, never reordered forward.
  worker.emit({ type: 'resident-schedule-candidate', candidate: candidate(1) });

  assert.equal(acceptedCandidates.length, 2);
  assert.equal(acceptedCandidates[1].version.nextStep, 102);
  const latest = bridge.residentRenderCandidateMailbox.peekLatest();
  assert.equal(latest.version.nextStep, 102);
  assert.ok(Object.isFrozen(latest));
  const stats = bridge.residentRenderCandidateMailbox.stats();
  assert.equal(stats.publishedCount, 2);
  assert.equal(stats.droppedStaleCount, 1);
  assert.equal(bridge.residentRenderCandidateRejectedCount, 0);

  // Malformed candidates fail closed: counted, never accepted, and the
  // handler survives to process later messages.
  worker.emit({ type: 'resident-schedule-candidate', candidate: { schema: 'wrong' } });
  worker.emit({ type: 'resident-schedule-candidate', candidate: null });
  assert.equal(bridge.residentRenderCandidateRejectedCount, 2);
  assert.equal(bridge.residentRenderCandidateMailbox.stats().publishedCount, 2);

  // Existing handlers stay untouched: a presentation status envelope emitted
  // after candidate traffic still flows through the status path.
  worker.emit({
    schema: ULG_WORKER_OFFSCREEN_PRESENTATION_SCHEMA,
    status: 'worker-offscreen-presentation-ready',
    workerOffscreenResidentStage: {
      schema: ULG_WORKER_OFFSCREEN_PRESENTATION_RESIDENT_STAGE_SCHEMA,
      status: 'worker-offscreen-resident-schedule-on-presentation-device-completed'
    }
  });
  assert.equal(
    bridge.residentStageStatus.status,
    'worker-offscreen-resident-schedule-on-presentation-device-completed'
  );
  assert.equal(bridge.status.status, 'worker-offscreen-presentation-ready');

  // takeLatest clears the slot but the version gate persists on the bridge
  // mailbox exactly as on the worker-local one.
  const taken = bridge.residentRenderCandidateMailbox.takeLatest();
  assert.equal(taken, latest);
  assert.equal(bridge.residentRenderCandidateMailbox.peekLatest(), null);
  worker.emit({ type: 'resident-schedule-candidate', candidate: candidate(2) });
  assert.equal(bridge.residentRenderCandidateMailbox.peekLatest(), null);
  assert.equal(bridge.residentRenderCandidateMailbox.stats().droppedStaleCount, 2);

  const nextLaneCandidate = {
    ...candidate(1),
    laneId: 'ulg:test:bridge-lane-next',
    stateKey: 'ulg:test:bridge-state-next',
    presentationLaneEpoch: 2,
    version: {
      ...candidate(1).version,
      scheduleId: 'ulg:test:bridge-sched-next'
    }
  };
  worker.emit({
    type: 'resident-schedule-candidate',
    candidate: nextLaneCandidate
  });
  assert.equal(
    bridge.residentRenderCandidateMailbox.peekLatest().version.nextStep,
    101,
    'a newer presentation lane must accept a lower physics version'
  );
  worker.emit({
    type: 'resident-schedule-candidate',
    candidate: candidate(9)
  });
  assert.equal(
    bridge.residentRenderCandidateMailbox.peekLatest().laneId,
    'ulg:test:bridge-lane-next'
  );
  assert.equal(bridge.residentRenderCandidateRejectedCount, 3);
});
