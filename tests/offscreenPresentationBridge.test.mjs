import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createUlgWorkerOffscreenPresentationBridge,
  ULG_WORKER_OFFSCREEN_PRESENTATION_HANDOFF,
  ULG_REMOTE_TASK_GRAPH_COMPACT_BUFFER_SNAPSHOT_SCHEMA,
  ULG_WORKER_OFFSCREEN_RETAINED_COMPACT_SNAPSHOT_SCHEMA,
  ULG_WORKER_OFFSCREEN_PRESENTATION_RESIDENT_STAGE_SCHEMA,
  ULG_WORKER_OFFSCREEN_PRESENTATION_RESIDENT_STAGE_TRANSPORT,
  ULG_WORKER_OFFSCREEN_PRESENTATION_SCHEMA,
  ULG_WORKER_OFFSCREEN_PRESENTATION_TRANSPORT,
  ULG_WORKER_OFFSCREEN_RESIDENT_PARTICLE_STATE_PRODUCER_SCHEMA,
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

test('worker offscreen render rows pack compact transferable particle rows', () => {
  const payload = packUlgWorkerOffscreenRenderRowsPayload({
    positionsM: new Float32Array([1, 2, 3, 4, 5, 6]),
    colorsRgb: new Float32Array([0.1, 0.2, 0.3, 0.4, 0.5, 0.6]),
    particleRadiiM: new Float32Array([0.07, 0.08]),
    alpha: 0.75
  });

  assert.equal(payload.schema, ULG_WORKER_OFFSCREEN_RENDER_ROWS_SCHEMA);
  assert.equal(payload.status, 'worker-offscreen-render-rows-packed');
  assert.equal(payload.inputTransport, ULG_WORKER_OFFSCREEN_RENDER_ROWS_INPUT_TRANSPORT);
  assert.equal(payload.particleCount, 2);
  assert.equal(payload.strideFloats, ULG_WORKER_OFFSCREEN_RENDER_ROW_PARTICLE_STRIDE_FLOATS);
  assert.equal(payload.particleRows.length, 16);
  assert.equal(payload.particleRows[0], 1);
  assert.equal(payload.particleRows[3].toFixed(2), '0.07');
  assert.equal(payload.particleRows[7], 0.75);
  assert.equal(payload.particleRows[8], 4);
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
    positionsM: new Float32Array([0, 0, 0, 1, 0, 0]),
    colorsRgb: new Float32Array([1, 0, 0, 0, 1, 0]),
    particleRadiiM: new Float32Array([0.05, 0.05]),
    sourceCacheKey: 'source:a',
    viewProjectionMatrix: new Float32Array(16).fill(0)
  };
  drawInput.viewProjectionMatrix[0] = 1;
  drawInput.viewProjectionMatrix[5] = 1;
  drawInput.viewProjectionMatrix[10] = 1;
  drawInput.viewProjectionMatrix[15] = 1;

  const uploaded = bridge.drawResidentRenderProducer(drawInput);
  const reused = bridge.drawResidentRenderProducer(drawInput);
  const firstDraw = worker.messages[1]?.data;
  const secondDraw = worker.messages[2]?.data;

  assert.equal(firstDraw.schema, ULG_WORKER_OFFSCREEN_RESIDENT_RENDER_PRODUCER_SCHEMA);
  assert.equal(firstDraw.type, 'draw-resident-render-producer');
  assert.equal(firstDraw.reuseSourceCache, false);
  assert.equal(firstDraw.sourceCacheStatus, 'source-cache-uploaded');
  assert.equal(firstDraw.sourceRowsPacked, true);
  assert.ok(firstDraw.sourceParticleRows instanceof Float32Array);
  assert.equal(uploaded.sourceTransferBytes, 64);

  assert.equal(secondDraw.schema, ULG_WORKER_OFFSCREEN_RESIDENT_RENDER_PRODUCER_SCHEMA);
  assert.equal(secondDraw.reuseSourceCache, true);
  assert.equal(secondDraw.sourceCacheStatus, 'source-cache-reused');
  assert.equal(secondDraw.sourceRowsPacked, false);
  assert.equal(secondDraw.sourceParticleRows, undefined);
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
    sphParticleState,
    materialColorRows,
    sourceCacheKey: 'resident-state:a',
    viewProjectionMatrix
  });
  const secondStatus = bridge.drawResidentParticleStateProducer({
    sphParticleState,
    materialColorRows,
    sourceCacheKey: 'resident-state:a',
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
  assert.equal(firstStatus.sourceStateTransferBytes, 192);
  assert.equal(firstStatus.sourceTransferBytes, 0);

  assert.equal(secondDraw.schema, ULG_WORKER_OFFSCREEN_RESIDENT_PARTICLE_STATE_PRODUCER_SCHEMA);
  assert.equal(secondDraw.reuseSourceCache, true);
  assert.equal(secondDraw.sourceRowsPacked, false);
  assert.equal(secondDraw.sourceState, undefined);
  assert.equal(secondDraw.sourceThermo, undefined);
  assert.equal(secondDraw.materialColorRows, undefined);
  assert.equal(secondStatus.sourceCacheHit, true);
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
