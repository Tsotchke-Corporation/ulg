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

const ISOSURFACE_SOURCE_INPUT_FIELDS = Object.freeze({
  isosurfaceTemporalPresentation: false,
  isosurfacePresentationMotionAgeS: 0,
  isosurfacePresentationSourceTimeS: 0.011,
  isosurfacePresentationMotionMethod: 'committed-source-mesh',
  presentationOnly: false,
  authoritativeStateMutation: false
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

function presentationPlaybackBridgeFixture(presentationPlaying = false) {
  let worker;
  class FakeWorker {
    constructor() { worker = this; this.messages = []; this.listeners = []; }
    postMessage(data) { this.messages.push(data); }
    addEventListener(type, listener) {
      if (type === 'message') this.listeners.push(listener);
    }
    removeEventListener(type, listener) {
      this.listeners = this.listeners.filter((candidate) => candidate !== listener);
    }
    terminate() {}
  }
  const canvas = {
    style: {}, setAttribute() {},
    transferControlToOffscreen: () => ({})
  };
  const container = {
    clientWidth: 64, clientHeight: 64,
    appendChild(child) { child.parentNode = this; },
    removeChild(child) { child.parentNode = null; },
    ownerDocument: { createElement: () => canvas }
  };
  const bridge = createUlgWorkerOffscreenPresentationBridge({
    requested: true, presentationPlaying, container, width: 64, height: 64,
    workerFactory: FakeWorker, navigatorRef: { gpu: {} },
    windowRef: { document: container.ownerDocument }
  });
  return { bridge, worker, canvas };
}

test('presentation playback is explicitly paused at init and revision-ordered before worker readiness', () => {
  const { bridge, worker } = presentationPlaybackBridgeFixture();
  const init = worker.messages[0];
  assert.equal(init.type, 'init-offscreen-presentation');
  assert.deepEqual(init.playbackState, { playing: false, revision: 0 });
  assert.equal(bridge.status.workerReady, false);
  const statusBefore = bridge.status;
  const authorityBefore = {
    lifecycle: bridge.lifecycleGeneration,
    framebuffer: bridge.workerFramebufferEpoch,
    owner: bridge.displayOwnerEpoch,
    serial: bridge.workerFramebufferQueueCompletionSerialHighWater,
    candidateMailbox: bridge.residentRenderCandidateMailbox
  };
  const playing = bridge.setPresentationPlaying(true);
  assert.deepEqual(playing, { playing: true, revision: 1 });
  const paused = bridge.setPresentationPlaying(false);
  assert.deepEqual(paused, { playing: false, revision: 2 });
  assert.equal(Object.isFrozen(paused), true);
  assert.deepEqual(worker.messages.slice(1), [
    { type: 'set-presentation-playback-state', playbackState: { playing: true, revision: 1 } },
    { type: 'set-presentation-playback-state', playbackState: { playing: false, revision: 2 } }
  ]);
  assert.deepEqual(init.playbackState, { playing: false, revision: 0 });
  assert.equal(bridge.setPresentationPlaying(false), paused);
  assert.equal(worker.messages.length, 3, 'duplicate state is not another revision');
  for (const malformed of [undefined, null, 'false', 0, 1, {}, { playing: false }]) {
    assert.equal(bridge.setPresentationPlaying(malformed), false);
  }
  assert.equal(worker.messages.length, 3);
  assert.equal(bridge.playbackState, paused);
  assert.equal(bridge.status, statusBefore, 'playback cannot replace a source status');
  assert.deepEqual({
    lifecycle: bridge.lifecycleGeneration,
    framebuffer: bridge.workerFramebufferEpoch,
    owner: bridge.displayOwnerEpoch,
    serial: bridge.workerFramebufferQueueCompletionSerialHighWater,
    candidateMailbox: bridge.residentRenderCandidateMailbox
  }, authorityBefore, 'playback is not a source/frame/authority reset');
  bridge.dispose();
});

test('scene replacement seeds current playback and stale disposed bridge events cannot resume it', () => {
  const old = presentationPlaybackBridgeFixture();
  old.bridge.setPresentationPlaying(true);
  const lateHandler = old.worker.listeners[0];
  const replacement = presentationPlaybackBridgeFixture(old.bridge.playbackState.playing);
  assert.deepEqual(replacement.worker.messages[0].playbackState, {
    playing: true, revision: 0
  }, 'new worker has its own revision namespace and current intent');
  replacement.bridge.setPresentationPlaying(false);
  const replacementPaused = replacement.bridge.playbackState;
  old.bridge.dispose();
  const oldMessageCount = old.worker.messages.length;
  assert.equal(old.bridge.setPresentationPlaying(false).disposed, true);
  lateHandler({ data: {
    schema: ULG_WORKER_OFFSCREEN_PRESENTATION_SCHEMA,
    status: 'worker-offscreen-presentation-ready',
    playbackState: { playing: true, revision: 9 }
  } });
  assert.equal(old.worker.messages.length, oldMessageCount);
  assert.equal(old.bridge.status.status, 'worker-offscreen-presentation-disposed');
  assert.equal(replacement.bridge.playbackState, replacementPaused);
  assert.deepEqual(replacementPaused, { playing: false, revision: 1 });
  replacement.bridge.dispose();
});

test('presentation playback caches without a worker and rejects invalid constructor state', () => {
  const bridge = createUlgWorkerOffscreenPresentationBridge();
  assert.deepEqual(bridge.setPresentationPlaying(true), { playing: true, revision: 1 });
  assert.deepEqual(bridge.setPresentationPlaying(false), { playing: false, revision: 2 });
  for (const malformed of [null, 0, 'true']) {
    assert.throws(() => createUlgWorkerOffscreenPresentationBridge({
      presentationPlaying: malformed
    }), /presentationPlaying must be a boolean/);
  }
  bridge.dispose();
});

function particleResizeBridgeFixture({ motionAgeS = 0.025, keyframeOnly = false, resizeOnSetup = true } = {}) {
  const fixture = presentationPlaybackBridgeFixture();
  const { bridge, worker } = fixture;
  const emit = (receipt) => {
    for (const listener of worker.listeners) listener({ data: {
      schema: ULG_WORKER_OFFSCREEN_PRESENTATION_SCHEMA,
      frameCount: receipt.frameCount, readyFrameCount: receipt.readyFrameCount,
      workerOffscreenRenderRows: receipt
    } });
  };
  const keyframe = {
    ...COMMITTED_CANDIDATE_RECEIPT_FIELDS,
    ...ADMITTED_KEYFRAME_PRESENTATION_RECEIPT_FIELDS,
    ...IMPOSTOR_PRESENTATION_RECEIPT_FIELDS,
    schema: ULG_WORKER_OFFSCREEN_RESIDENT_PARTICLE_STATE_PRODUCER_SCHEMA,
    renderRowsSchema: ULG_WORKER_OFFSCREEN_RENDER_ROWS_SCHEMA,
    status: 'worker-offscreen-resident-particle-state-producer-rendered',
    sphStep: 64, particleCount: 1, frameCount: 1, readyFrameCount: 1,
    workerFramebufferEpoch: bridge.workerFramebufferEpoch,
    displayOwnerEpoch: bridge.displayOwnerEpoch,
    residentScheduleCandidatePresentation: true,
    producerSourceKind: 'worker-retained-resident-stage-output',
    producerSourceTransport: 'worker-retained-resident-stage-output',
    sourceStageId: 'schroederSameLevelMechanics',
    retainedParticleStateStatus: 'worker-retained-particle-state-ready'
  };
  emit(keyframe);
  assert.equal(bridge.displayOwnerContentReady, true, 'keyframe fixture admitted');
  const motion = {
    ...keyframe,
    frameCount: 2, readyFrameCount: 2,
    motionFrameSchema: ULG_WORKER_OFFSCREEN_RESIDENT_PARTICLE_TEMPORAL_MOTION_FRAME_SCHEMA,
    motionFrameStatus: 'worker-particle-temporal-motion-frame-presentation-opportunity',
    motionFrameAdmitted: true, motionFrameGpuCompleted: true,
    motionFramePresentationOpportunity: true,
    motionFramePresentationOpportunityMethod: 'worker-request-animation-frame-after-gpu-completion',
    motionFrameSerial: 1, motionFrameSubmittedSerial: 1,
    motionSourceFrameCount: 1, motionSourceSphStep: 64,
    motionAgeS, motionAgeSource: 'bounded-wall-clock',
    motionMethod: 'bounded-keyframe-velocity-extrapolation',
    motionVelocityBufferRetained: true,
    presentationQueueCompletionCount: 4, presentationQueueCompletionSerial: 4
  };
  if (!keyframeOnly) {
    emit(motion);
    assert.equal(bridge.displayOwnerLastRenderedContent.motionAgeS, motionAgeS);
  }
  const before = bridge.displayOwnerLastRenderedContent;
  if (resizeOnSetup) bridge.resize({ width: 80, height: 72, devicePixelRatio: 1 });
  const redraw = {
    ...motion,
    workerFramebufferEpoch: bridge.workerFramebufferEpoch,
    frameCount: 3, readyFrameCount: 3,
    motionFrameSerial: 2, motionFrameSubmittedSerial: 2,
    motionAgeS: keyframeOnly ? 0 : motionAgeS,
    motionAgeSource: 'explicit-frozen-redraw',
    presentationQueueCompletionCount: 5, presentationQueueCompletionSerial: 5
  };
  return { ...fixture, emit, keyframe, before, redraw };
}

for (const keyframeOnly of [false, true]) {
  test(`particle resize admits a fresh frozen redraw from the exact ${keyframeOnly ? 'keyframe age zero' : 'last admitted motion age'}`, () => {
    const { bridge, canvas, emit, before, redraw } = particleResizeBridgeFixture({ keyframeOnly });
    assert.equal(bridge.workerCanvasLastRenderedContent, null);
    assert.equal(bridge.displayOwnerLastRenderedContent, null);
    assert.equal(bridge.displayOwnerContentReady, false);
    assert.equal(canvas.style.visibility, 'hidden', 'old pixels stay invalidated');
    emit(redraw);
    assert.equal(bridge.displayOwnerContentReady, true, 'new-epoch frozen redraw is admitted');
    assert.equal(canvas.style.visibility, 'visible');
    assert.equal(bridge.displayOwnerLastRenderedContent.sphStep, before.sphStep);
    assert.equal(bridge.displayOwnerLastRenderedContent.motionAgeS, keyframeOnly ? 0 : before.motionAgeS);
    assert.equal(bridge.displayOwnerLastRenderedContent.workerFramebufferEpoch, redraw.workerFramebufferEpoch);
    assert.ok(bridge.workerFramebufferQueueCompletionSerialHighWater > before.presentationQueueCompletionSerial);
    bridge.dispose();
  });
}

test('particle resize rapid viewport changes accept only the newest epoch and preserve replay high-water', () => {
  const { bridge, canvas, emit, redraw } = particleResizeBridgeFixture();
  const firstResizeEpoch = bridge.workerFramebufferEpoch;
  bridge.resize({ width: 96, height: 80, devicePixelRatio: 1 });
  assert.equal(bridge.workerFramebufferEpoch, firstResizeEpoch + 1);
  emit(redraw);
  assert.equal(bridge.displayOwnerContentReady, false, 'intermediate-epoch draw is stale');
  assert.equal(canvas.style.visibility, 'hidden');
  const current = {
    ...redraw, workerFramebufferEpoch: bridge.workerFramebufferEpoch,
    frameCount: 4, readyFrameCount: 4,
    motionFrameSerial: 3, motionFrameSubmittedSerial: 3,
    presentationQueueCompletionCount: 6, presentationQueueCompletionSerial: 6
  };
  emit({ ...current, presentationQueueCompletionCount: 4, presentationQueueCompletionSerial: 4 });
  assert.equal(bridge.displayOwnerContentReady, false, 'resize cannot reset worker queue serial floor');
  emit(current);
  assert.equal(bridge.displayOwnerContentReady, true);
  assert.equal(bridge.workerParticleResizeSource, null, 'binding consumed after true admission');
  const admitted = bridge.displayOwnerLastRenderedContent;
  emit(current);
  assert.equal(bridge.displayOwnerLastRenderedContent, admitted, 'exact receipt replay is rejected');
  bridge.resize({ width: 104, height: 88, devicePixelRatio: 1 });
  emit({ ...current, workerFramebufferEpoch: bridge.workerFramebufferEpoch,
    frameCount: 5, readyFrameCount: 5, motionFrameSerial: 4, motionFrameSubmittedSerial: 4,
    presentationQueueCompletionCount: 7, presentationQueueCompletionSerial: 7 });
  assert.equal(bridge.displayOwnerContentReady, true, 'subsequent resize binds the newly admitted frozen frame');
  assert.equal(bridge.displayOwnerLastRenderedContent.motionAgeS, 0.025);
  bridge.dispose();
});

test('particle resize recovery rejects mismatched source age authority and incomplete framebuffer proofs', () => {
  const cases = [
    ['schedule', { scheduleId: 'schedule:other' }],
    ['source generation', { residentExecutionGeneration: 8 }],
    ['source step', { sphStep: 65, motionSourceSphStep: 65 }],
    ['source keyframe', { motionSourceFrameCount: 9 }],
    ['source lane', { laneId: 'lane:other' }],
    ['source state', { stateKey: 'state:other' }],
    ['source ordinal', { stepOrdinal: 2 }],
    ['authority lease', { computeManagerLeaseId: 'lease:other' }],
    ['advanced age', { motionAgeS: 0.026 }],
    ['rewound age', { motionAgeS: 0 }],
    ['missing age', { motionAgeS: null }],
    ['string age', { motionAgeS: '0.025' }],
    ['unbounded method', { motionAgeSource: 'bounded-wall-clock' }],
    ['motion serial replay', { motionFrameSerial: 1 }],
    ['GPU incomplete', { motionFrameGpuCompleted: false }],
    ['no opportunity', { motionFramePresentationOpportunity: false }],
    ['wrong queue method', { presentationQueueCompletionMethod: 'unproved' }],
    ['queue replay', { presentationQueueCompletionCount: 4, presentationQueueCompletionSerial: 4 }],
    ['authority incomplete', { stateManagerCommitAccepted: false }],
    ['terminal fence incomplete', { terminalFenceSatisfied: false }],
    ['old framebuffer epoch', { workerFramebufferEpoch: 1 }],
    ['unsolicited future framebuffer epoch', { workerFramebufferEpoch: 3 }],
    ['old framebuffer counters', { frameCount: 2, readyFrameCount: 2 }],
    ['QOS is not frozen redraw', { physicsQueuePrefixCoverage: 'physics-queue-prefix-included',
      physicsHostQueueFenceParticipation: true,
      motionPresentationQosBoundary: { submissionOrdinal: 1, completedSubstepCount: 2,
        totalSubstepCount: 64, chunkStepCount: 2 } }]
  ];
  for (const [label, changes] of cases) {
    const { bridge, canvas, emit, redraw } = particleResizeBridgeFixture();
    emit({ ...redraw, ...changes });
    assert.equal(bridge.displayOwnerContentReady, false, label);
    assert.equal(bridge.workerCanvasLastRenderedContent, null, label);
    assert.equal(canvas.style.visibility, 'hidden', label);
    assert.equal(bridge.workerFramebufferQueueCompletionSerialHighWater, 4, label);
    bridge.dispose();
  }
});

for (const resizeOnSetup of [false, true]) {
  test(`background appearance preserves the exact ${resizeOnSetup ? 'resizing' : 'visible'} particle source`, () => {
    const { bridge, worker, canvas, emit, redraw } = particleResizeBridgeFixture({ resizeOnSetup });
    const before = {
      epoch: bridge.workerFramebufferEpoch, ownerEpoch: bridge.displayOwnerEpoch,
      serial: bridge.workerFramebufferQueueCompletionSerialHighWater,
      content: bridge.workerCanvasLastRenderedContent,
      ready: bridge.displayOwnerContentReady,
      resizeSource: bridge.workerParticleResizeSource,
      visibility: canvas.style.visibility
    };
    const appearance = { backgroundImageUrl: null, backgroundColor: '#112233',
      lightingProfile: { mode: 'normal' }, backgroundClearValue: { r: 1 / 15, g: 2 / 15, b: 3 / 15, a: 1 } };
    const original = structuredClone(appearance);
    bridge.setBackgroundColor('#112233', { nativeSurfaceAppearance: appearance });
    const message = worker.messages.at(-1);
    assert.equal(message.type, 'update-presentation-background');
    assert.equal(message.workerFramebufferEpoch, before.epoch);
    assert.deepEqual(message.nativeSurfaceAppearance, original);
    appearance.lightingProfile.mode = 'dark-lab';
    assert.deepEqual(message.nativeSurfaceAppearance, original, 'snapshot is independent of later UI mutation');
    assert.equal(bridge.workerFramebufferEpoch, before.epoch);
    assert.equal(bridge.displayOwnerEpoch, before.ownerEpoch);
    assert.equal(bridge.workerFramebufferQueueCompletionSerialHighWater, before.serial);
    assert.equal(bridge.workerCanvasLastRenderedContent, before.content);
    assert.equal(bridge.displayOwnerContentReady, before.ready);
    assert.equal(bridge.workerParticleResizeSource, before.resizeSource);
    assert.equal(canvas.style.visibility, before.visibility, 'message neither hides nor reveals unproved content');
    emit(redraw);
    assert.equal(bridge.displayOwnerContentReady, true);
    assert.equal(bridge.displayOwnerLastRenderedContent.sphStep, 64);
    assert.equal(bridge.displayOwnerLastRenderedContent.motionAgeS, 0.025);
    assert.ok(bridge.workerFramebufferQueueCompletionSerialHighWater > before.serial);
    const count = worker.messages.length;
    bridge.dispose();
    assert.equal(bridge.setBackgroundColor('#ffffff').disposed, true);
    assert.equal(worker.messages.length, count + 1, 'disposed appearance cannot post after dispose');
  });
}

test('particle resize binding retires on ownership reset disposal or replacement', () => {
  const cases = [
    ['explicit presentation clear', (bridge) => bridge.clearPresentation({ backgroundColor: '#112233' })],
    ['ownership retirement', (bridge) => {
      bridge.setDisplayOwner({ owner: 'none' });
      bridge.setDisplayOwner({ owner: 'worker' });
    }],
    ['native ownership clear', (bridge) => {
      bridge.setDisplayOwner({ owner: 'main-native' });
      bridge.setDisplayOwner({ owner: 'worker' });
    }],
    ['particle source reset', (bridge) => bridge.clearResidentParticleStateProducerCache()],
    ['render producer reset', (bridge) => bridge.clearResidentRenderProducerSourceCache()],
    ['pending authority handoff', (bridge) => bridge.presentCommittedResidentScheduleCandidate()],
    ['dispose', (bridge) => bridge.dispose()]
  ];
  for (const [label, retire] of cases) {
    const { bridge, emit, redraw } = particleResizeBridgeFixture();
    assert.ok(bridge.workerParticleResizeSource, label);
    retire(bridge);
    assert.equal(bridge.workerParticleResizeSource, null, label);
    emit({ ...redraw, workerFramebufferEpoch: 1,
      motionAgeS: 0.03, motionAgeSource: 'bounded-wall-clock' });
    assert.equal(bridge.workerParticleResizeSource, null,
      label + ' cannot be undone by a late old-frame proof');
    emit({ ...redraw, workerFramebufferEpoch: bridge.workerFramebufferEpoch });
    assert.equal(bridge.displayOwnerContentReady, false, label);
    bridge.dispose();
  }
  const old = particleResizeBridgeFixture();
  const lateHandler = old.worker.listeners[0];
  old.bridge.dispose();
  const replacement = presentationPlaybackBridgeFixture();
  const lateReceipt = { ...old.redraw, workerFramebufferEpoch: replacement.bridge.workerFramebufferEpoch };
  lateHandler({ data: { schema: ULG_WORKER_OFFSCREEN_PRESENTATION_SCHEMA,
    frameCount: 3, readyFrameCount: 3, workerOffscreenRenderRows: lateReceipt } });
  for (const listener of replacement.worker.listeners) listener({ data: {
    schema: ULG_WORKER_OFFSCREEN_PRESENTATION_SCHEMA,
    frameCount: 3, readyFrameCount: 3, workerOffscreenRenderRows: lateReceipt
  } });
  assert.equal(replacement.bridge.displayOwnerContentReady, false,
    'a new worker lifecycle never inherits an old resize source');
  replacement.bridge.dispose();
});

test('particle resize pending successor keyframe cannot resurrect the old source before its own proof', () => {
  const { bridge, emit, redraw, keyframe } = particleResizeBridgeFixture();
  const pending = {
    ...keyframe, residentExecutionGeneration: 8, sphStep: 128,
    scheduleId: 'schedule:successor', workerFramebufferEpoch: bridge.workerFramebufferEpoch,
    frameCount: 3, readyFrameCount: 3,
    presentationFrameAdmitted: false, presentationFrameGpuCompleted: false,
    presentationFramePresentationOpportunity: false,
    presentationQueueCompletionCount: 5, presentationQueueCompletionSerial: 5
  };
  emit(pending);
  assert.equal(bridge.workerParticleResizeSource, null);
  emit(redraw);
  assert.equal(bridge.displayOwnerContentReady, false,
    'last admitted predecessor cannot bypass a pending newer keyframe');
  emit({ ...pending, presentationFrameAdmitted: true, presentationFrameGpuCompleted: true,
    presentationFramePresentationOpportunity: true, frameCount: 4, readyFrameCount: 4,
    presentationQueueCompletionCount: 6, presentationQueueCompletionSerial: 6 });
  assert.equal(bridge.displayOwnerContentReady, true, 'new keyframe still admits by its own proof');
  assert.equal(bridge.displayOwnerLastRenderedContent.sphStep, 128);
  bridge.dispose();
});

test('particle resize source cannot outlive a newer candidate even after mailbox takeLatest', () => {
  const { bridge, worker, emit, redraw, keyframe } = particleResizeBridgeFixture();
  const candidate = {
    schema: ULG_RESIDENT_RENDER_CANDIDATE_SCHEMA,
    presentationLaneEpoch: keyframe.presentationLaneEpoch,
    laneId: keyframe.laneId, stateKey: keyframe.stateKey,
    version: { residentExecutionGeneration: 8, nextStep: 128,
      scheduleId: 'schedule:new-candidate', stepOrdinal: 1 },
    epochIdentity: { storageGeneration: 8, physicsTick: 128, physicsSubstep: 0,
      positionEpoch: 1, topologyEpoch: 1, chartEpoch: 1, levelEpoch: 1, supportEpoch: 1 }
  };
  for (const listener of worker.listeners) listener({ data: {
    type: 'resident-schedule-candidate', candidate
  } });
  assert.equal(bridge.workerParticleResizeSource, null);
  assert.ok(bridge.residentRenderCandidateMailbox.takeLatest());
  bridge.resize({ width: 96, height: 88, devicePixelRatio: 1 });
  emit({ ...redraw, workerFramebufferEpoch: bridge.workerFramebufferEpoch });
  assert.equal(bridge.displayOwnerContentReady, false);
  bridge.dispose();
});

test('particle resize cannot rearm an explicitly retired source from its still-visible receipt', () => {
  for (const method of ['clearResidentParticleStateProducerCache', 'clearResidentRenderProducerSourceCache']) {
    const { bridge, emit, redraw } = particleResizeBridgeFixture({ resizeOnSetup: false });
    bridge[method]();
    assert.equal(bridge.displayOwnerContentReady, true, 'retiring source does not itself erase visible pixels');
    bridge.resize({ width: 80, height: 72, devicePixelRatio: 1 });
    emit({ ...redraw, workerFramebufferEpoch: bridge.workerFramebufferEpoch });
    assert.equal(bridge.displayOwnerContentReady, false, method + ' must remain retired on later resize');
    bridge.dispose();
  }
});

test('particle resize binds a late proved old-epoch motion frame without admitting its invalidated pixels', () => {
  const { bridge, canvas, emit, redraw, before } = particleResizeBridgeFixture();
  const late = { ...redraw, workerFramebufferEpoch: before.workerFramebufferEpoch,
    motionAgeS: 0.03, motionAgeSource: 'bounded-wall-clock' };
  emit(late);
  assert.equal(bridge.displayOwnerContentReady, false);
  assert.equal(bridge.workerCanvasLastRenderedContent, null);
  assert.equal(bridge.displayOwnerLastRenderedContent, null);
  assert.equal(canvas.style.visibility, 'hidden');
  assert.equal(bridge.workerFramebufferQueueCompletionSerialHighWater, 4,
    'retired pixels are not an admitted current framebuffer');
  emit({ ...redraw, motionAgeS: late.motionAgeS, frameCount: 4, readyFrameCount: 4,
    motionFrameSerial: 3, motionFrameSubmittedSerial: 3 });
  assert.equal(bridge.displayOwnerContentReady, false,
    'new framebuffer serial must exceed non-visible late proof B as well as visible A');
  emit({ ...redraw, motionAgeS: late.motionAgeS, frameCount: 4, readyFrameCount: 4,
    motionFrameSerial: 3, motionFrameSubmittedSerial: 3,
    presentationQueueCompletionCount: 6, presentationQueueCompletionSerial: 6 });
  assert.equal(bridge.displayOwnerContentReady, true,
    'fresh frozen redraw matches the exact worker-admitted old-epoch age');
  assert.equal(bridge.displayOwnerLastRenderedContent.motionAgeS, 0.03);
  bridge.dispose();
});

test('particle resize non-visible late proof remains exact-source ordered and cannot regress age', () => {
  const cases = [
    ['regressed age', { motionAgeS: 0.024 }],
    ['missing age', { motionAgeS: null }],
    ['wrong source', { sphStep: 65, motionSourceSphStep: 65 }],
    ['wrong source keyframe', { motionSourceFrameCount: 9 }],
    ['wrong lease', { computeManagerLeaseId: 'lease:other' }],
    ['no authority', { stateManagerCommitAccepted: false }],
    ['no GPU proof', { motionFrameGpuCompleted: false }],
    ['no presentation opportunity', { motionFramePresentationOpportunity: false }],
    ['serial replay', { presentationQueueCompletionCount: 4, presentationQueueCompletionSerial: 4 }],
    ['motion replay', { motionFrameSerial: 1 }],
    ['before original framebuffer', { workerFramebufferEpoch: 0 }],
    ['unrequested future framebuffer', { workerFramebufferEpoch: 3 }]
  ];
  for (const [label, changes] of cases) {
    const { bridge, emit, before, redraw } = particleResizeBridgeFixture();
    emit({ ...redraw, workerFramebufferEpoch: before.workerFramebufferEpoch,
      motionAgeS: 0.03, motionAgeSource: 'bounded-wall-clock', ...changes });
    assert.equal(bridge.displayOwnerContentReady, false, label);
    assert.equal(bridge.workerParticleResizeSource.receipt.motionAgeS, 0.025, label);
    assert.equal(bridge.workerFramebufferQueueCompletionSerialHighWater, 4, label);
    emit(redraw);
    assert.equal(bridge.displayOwnerContentReady, true,
      label + ': valid original frozen source remains eligible');
    bridge.dispose();
  }
});

test('preview camera stream snapshots appearance and forwards the latest appearance without a source frame', () => {
  let worker;
  class FakeWorker {
    constructor() { worker = this; this.messages = []; }
    postMessage(data) { this.messages.push(data); }
    addEventListener() {}
    terminate() {}
  }
  const canvas = {
    style: {}, setAttribute() {},
    transferControlToOffscreen: () => ({})
  };
  const container = {
    clientWidth: 64, clientHeight: 64,
    appendChild(child) { child.parentNode = this; },
    removeChild(child) { child.parentNode = null; },
    ownerDocument: { createElement: () => canvas }
  };
  const bridge = createUlgWorkerOffscreenPresentationBridge({
    requested: true, container, width: 64, height: 64,
    workerFactory: FakeWorker, navigatorRef: { gpu: {} },
    windowRef: { document: container.ownerDocument }
  });
  const matrix = new Float32Array(16);
  for (const index of [0, 5, 10, 15]) matrix[index] = 1;
  const cameraPositionM = new Float32Array([1, 2, 3]);
  const appearance = {
    lightingProfile: {
      mode: 'normal', ambientIntensity: 1.4, hemisphereIntensity: 0.9,
      keyIntensity: 1.1, fillIntensity: 0.5, environmentIntensity: 1,
      nativeAmbientSuppression: 0, nativeDirectSuppression: 0,
      nativeEnvironmentSuppression: 0, containerWireOpacity: 0.6,
      containerGridOpacity: 1, nativeContainerWireOpacity: 0.42
    },
    backgroundImageUrl: '/background.webp',
    backgroundColor: '#18222b',
    backgroundClearValue: { r: 0, g: 0, b: 0, a: 1 }
  };
  const originalAppearance = structuredClone(appearance);
  const initialStatus = bridge.status;
  const initialEpoch = bridge.workerFramebufferEpoch;
  bridge.updatePreviewViewProjection(matrix, {
    cameraPositionM, nativeSurfaceAppearance: appearance
  });
  const first = worker.messages.at(-1);
  assert.deepEqual(first.nativeSurfaceAppearance, originalAppearance);
  assert.notEqual(first.nativeSurfaceAppearance, appearance);
  assert.notEqual(first.nativeSurfaceAppearance.lightingProfile, appearance.lightingProfile);
  assert.notEqual(first.nativeSurfaceAppearance.backgroundClearValue, appearance.backgroundClearValue);
  matrix[0] = 2;
  cameraPositionM[0] = 9;
  appearance.lightingProfile.mode = 'dark-lab';
  appearance.lightingProfile.keyIntensity = 0;
  appearance.backgroundImageUrl = null;
  appearance.backgroundClearValue.r = 0.25;
  assert.equal(first.viewProjectionMatrix[0], 1);
  assert.deepEqual(first.cameraPositionM, [1, 2, 3]);
  assert.deepEqual(first.nativeSurfaceAppearance, originalAppearance);

  // Two appearance changes at exactly the same camera must both reach the
  // worker; its redraw coalescer, not this bridge, selects the latest view.
  const beforeChanges = worker.messages.length;
  bridge.updatePreviewViewProjection(matrix, { nativeSurfaceAppearance: appearance });
  appearance.backgroundClearValue.r = 0.5;
  bridge.updatePreviewViewProjection(matrix, { nativeSurfaceAppearance: appearance });
  assert.equal(worker.messages.length, beforeChanges + 2);
  assert.equal(worker.messages.at(-2).nativeSurfaceAppearance.backgroundClearValue.r, 0.25);
  assert.equal(worker.messages.at(-1).nativeSurfaceAppearance.backgroundClearValue.r, 0.5);
  assert.equal(worker.messages.at(-1).nativeSurfaceAppearance.backgroundImageUrl, null);
  assert.equal(worker.messages.at(-1).nativeSurfaceAppearance.lightingProfile.keyIntensity, 0);
  bridge.updatePreviewViewProjection(matrix, { cameraPositionM });
  assert.equal(Object.hasOwn(worker.messages.at(-1), 'nativeSurfaceAppearance'), false);
  assert.equal(Object.hasOwn(worker.messages.at(-1), 'sphStep'), false);
  assert.equal(bridge.workerCanvasLastRenderedContent, null);
  assert.equal(bridge.committedResidentSchedulePresentationStatus, null);
  assert.equal(bridge.workerFramebufferEpoch, initialEpoch);
  assert.equal(bridge.status, initialStatus, 'camera/appearance stream does not publish source state');

  const messageCount = worker.messages.length;
  assert.throws(() => bridge.updatePreviewViewProjection(matrix, {
    nativeSurfaceAppearance: {
      ...appearance, lightingProfile: { mode: 'normal', invalid: () => {} }
    }
  }), /clone/i);
  assert.equal(worker.messages.length, messageCount);
  bridge.dispose();
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
      ...ISOSURFACE_SOURCE_INPUT_FIELDS,
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
  for (const [field, value] of Object.entries(ISOSURFACE_SOURCE_INPUT_FIELDS)) {
    assert.equal(bridge.workerCanvasLastRenderedContent[field], value, field);
  }
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
    ...ISOSURFACE_SOURCE_INPUT_FIELDS,
    isosurfaceTemporalPresentation: true,
    isosurfacePresentationMotionAgeS: 0.02,
    isosurfacePresentationMotionMethod: 'bounded-gpu-field-velocity-extrapolation',
    presentationOnly: true,
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
  assert.equal(bridge.workerCanvasLastRenderedContent.isosurfacePresentationMotionAgeS, 0.02);
  for (const [field, value] of [
    ['isosurfacePresentationMotionAgeS', 0.01],
    ['isosurfacePresentationMotionAgeS', NaN],
    ['isosurfacePresentationMotionAgeS', null],
    ['isosurfacePresentationSourceTimeS', 0.012],
    ['isosurfaceTemporalPresentation', false],
    ['isosurfacePresentationMotionMethod', 'camera-redraw'],
    ['presentationOnly', false], ['authoritativeStateMutation', true],
    ['requestGeneration', 0]
  ]) {
    worker.emit({
      schema: ULG_WORKER_OFFSCREEN_PRESENTATION_SCHEMA,
      frameCount: 3, readyFrameCount: 3,
      workerOffscreenRenderRows: {
        ...redrawReceipt, frameCount: 3, readyFrameCount: 3,
        presentationQueueCompletionCount: 3, presentationQueueCompletionSerial: 3,
        [field]: value
      }
    });
    assert.equal(bridge.workerCanvasLastRenderedContent.frameCount, 2, field);
    assert.equal(bridge.workerCanvasLastRenderedContent.isosurfacePresentationMotionAgeS, 0.02, field);
  }

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
  const boundaryReceipt = {
    ...unseenQueueSerialAfterResize,
    frameCount: 5, readyFrameCount: 5, workerFramebufferEpoch: 2,
    presentationQueueCompletionCount: 5, presentationQueueCompletionSerial: 5,
    isosurfacePresentationMotionAgeS: 0.03,
    physicsQueuePrefixCoverage: 'physics-queue-prefix-included',
    physicsHostQueueFenceParticipation: true,
    physicsContinuationBlocked: true,
    presentationQosHostQueueFenceCount: 1,
    motionPresentationQosBoundary: {
      submissionOrdinal: 1, completedSubstepCount: 2,
      totalSubstepCount: 64, chunkStepCount: 2
    }
  };
  for (const mutate of [
    (row) => {
      for (const field of Object.keys(ISOSURFACE_SOURCE_INPUT_FIELDS)) delete row[field];
    },
    (row) => { Object.assign(row, ISOSURFACE_SOURCE_INPUT_FIELDS); },
    (row) => { row.motionPresentationQosBoundary = null; },
    (row) => { row.motionPresentationQosBoundary.completedSubstepCount = 64; },
    (row) => { row.motionPresentationQosBoundary.chunkStepCount = 3; },
    (row) => { row.physicsHostQueueFenceParticipation = false; },
    (row) => { row.physicsContinuationBlocked = false; },
    (row) => { row.presentationQosHostQueueFenceCount = 0; },
    (row) => { row.presentationQueueCompletionSerial = 4; }
  ]) {
    const row = structuredClone(boundaryReceipt);
    mutate(row);
    worker.emit({ schema: ULG_WORKER_OFFSCREEN_PRESENTATION_SCHEMA,
      frameCount: 5, readyFrameCount: 5, workerOffscreenRenderRows: row });
    assert.equal(bridge.workerCanvasLastRenderedContent.frameCount, 4);
  }
  worker.emit({ schema: ULG_WORKER_OFFSCREEN_PRESENTATION_SCHEMA,
    frameCount: 5, readyFrameCount: 5, workerOffscreenRenderRows: boundaryReceipt });
  const compactBoundary = bridge.workerCanvasLastRenderedContent;
  assert.equal(compactBoundary.frameCount, 5);
  assert.equal(compactBoundary.isosurfacePresentationMotionAgeS, 0.03);
  assert.equal(compactBoundary.physicsQueuePrefixCoverage, 'physics-queue-prefix-included');
  assert.equal(compactBoundary.physicsHostQueueFenceParticipation, true);
  assert.equal(compactBoundary.physicsContinuationBlocked, true);
  assert.equal(compactBoundary.presentationQosHostQueueFenceCount, 1);
  assert.deepEqual(compactBoundary.motionPresentationQosBoundary, boundaryReceipt.motionPresentationQosBoundary);
  assert.equal(Object.isFrozen(compactBoundary.motionPresentationQosBoundary), true);
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
