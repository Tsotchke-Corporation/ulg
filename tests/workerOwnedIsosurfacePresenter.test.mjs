import assert from 'node:assert/strict';
import test from 'node:test';

import {
  ULG_WORKER_OFFSCREEN_RESIDENT_ISOSURFACE_PRESENTATION_GEOMETRY,
  ULG_WORKER_OFFSCREEN_RESIDENT_ISOSURFACE_PRESENTATION_RENDERED_STATUS,
  ULG_WORKER_OFFSCREEN_RESIDENT_ISOSURFACE_PRESENTATION_SUPERSEDED_STATUS,
  ULG_WORKER_OFFSCREEN_RESIDENT_ISOSURFACE_REQUEST_SCHEMA,
  createWorkerOwnedIsosurfacePresenter,
  resolveWorkerOwnedIsosurfaceAdmission
} from '../src/services/workerOwnedIsosurfacePresenter.js';

class GPUBuffer {
  constructor(size = 4096) {
    this.size = size;
  }
}

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

async function waitFor(predicate, label) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (predicate()) return;
    await new Promise((resolve) => setImmediate(resolve));
  }
  throw new Error(`timed out waiting for ${label}`);
}

function createPresenterRig({
  queueCompletion = Promise.resolve(),
  captureRenderRows = async () => ({ destroyRenderRowsBuffer() {} }),
  buildPresentationFrame = null
} = {}) {
  const terminals = [];
  const submittedFrames = [];
  const drawnViewProjectionMatrices = [];
  let presentationOpportunityCalls = 0;
  let queueCompletionPromise = queueCompletion;
  let framebufferEpoch = 1;
  const pass = {
    setPipeline() {},
    setBindGroup() {},
    setVertexBuffer() {},
    drawIndirect() {},
    end() {}
  };
  const device = {
    createBuffer({ size = 4096 } = {}) {
      return new GPUBuffer(size);
    },
    createShaderModule() {
      return {};
    },
    async createRenderPipelineAsync() {
      return {
        getBindGroupLayout() {
          return {};
        }
      };
    },
    createCommandEncoder() {
      return {
        beginRenderPass() {
          return pass;
        },
        finish() {
          return {};
        }
      };
    },
    queue: {
      submit(commandBuffers) {
        submittedFrames.push(commandBuffers);
      },
      writeBuffer() {},
      onSubmittedWorkDone() {
        return queueCompletionPromise;
      }
    }
  };
  const presenter = createWorkerOwnedIsosurfacePresenter({
    device,
    context: {
      getCurrentTexture() {
        return { createView: () => ({}) };
      }
    },
    format: 'rgba8unorm',
    getDepthView: () => ({}),
    drawOverlay: (_pass, viewProjectionMatrix) => {
      drawnViewProjectionMatrices.push([...viewProjectionMatrix]);
    },
    onTerminal: (receipt) => terminals.push(receipt),
    onFrameSubmitted: (receipt) => submittedFrames.push(receipt),
    waitForPresentationOpportunity: async () => {
      presentationOpportunityCalls += 1;
      return {
        available: true,
        method: 'test-presentation-opportunity',
        observedAtMs: 1
      };
    },
    getFramebufferEpoch: () => framebufferEpoch,
    captureRenderRows,
    buildPresentationFrame: buildPresentationFrame ?? (
      async (job) => ({
        generation: job.generation,
        invalidationEpoch: job.invalidationEpoch,
        sphStep: job.sphStep,
        receiptFields: job.receiptFields,
        viewProjectionMatrix: [...job.admission.viewProjectionMatrix],
        cameraPositionM: [...job.admission.cameraPositionM],
        boxDimsM: null,
        surfaces: []
      })
    )
  });
  return {
    presenter,
    terminals,
    submittedFrames,
    drawnViewProjectionMatrices,
    get presentationOpportunityCalls() {
      return presentationOpportunityCalls;
    },
    setQueueCompletion(promise) {
      queueCompletionPromise = promise;
    },
    setFramebufferEpoch(epoch) {
      framebufferEpoch = epoch;
    }
  };
}

function viewProjectionWithTranslation(x) {
  const matrix = [...validRequest().viewProjectionMatrix];
  matrix[12] = x;
  return matrix;
}

function queueSubmissionCount(rig) {
  return rig.submittedFrames.filter(Array.isArray).length;
}

function validRequest() {
  return {
    schema: ULG_WORKER_OFFSCREEN_RESIDENT_ISOSURFACE_REQUEST_SCHEMA,
    enabled: true,
    geometryMode: 'true-isosurface',
    presentationGeometry:
      ULG_WORKER_OFFSCREEN_RESIDENT_ISOSURFACE_PRESENTATION_GEOMETRY,
    surfaceTable: {
      schema: 'peercompute.ulg.sph-gpu-render-field.v1',
      status: 'render-field-surface-table-built',
      surfaceCount: 1,
      totalFieldCells: 64,
      maxFieldCellCount: 64,
      records: new Float32Array(16),
      metadata: [{
        index: 0,
        resolution: 4,
        fieldOffset: 0,
        fieldCellCount: 64,
        isolation: 80,
        colorLinear: [0.1, 0.4, 0.9]
      }]
    },
    viewProjectionMatrix: new Float32Array([
      1, 0, 0, 0,
      0, 1, 0, 0,
      0, 0, 1, 0,
      0, 0, 0, 1
    ]),
    cameraPositionM: [1, 2, 3],
    fieldPadding: 0.22,
    refEdgeM: 1
  };
}

function validRetained() {
  return {
    status: 'worker-retained-particle-state-ready',
    sameWorkerPrivateReferences: true,
    postMessageTransportAllowed: false,
    particleCount: 32,
    sphParticleState: {},
    mlsMpmParticleState: {},
    sphParticleUpload: {},
    mlsMpmParticleUpload: {},
    successorSourceFamily: {},
    sourceStateBuffer: new GPUBuffer(),
    sourceThermoBuffer: new GPUBuffer(),
    sourceMechanicsBuffer: new GPUBuffer(),
    sourceIdentityBuffer: new GPUBuffer()
  };
}

test('worker-owned true-isosurface admission requires exact same-worker GPU authority', () => {
  const admission = resolveWorkerOwnedIsosurfaceAdmission({
    request: validRequest(),
    retained: validRetained()
  });
  assert.equal(admission.ok, true);
  assert.equal(admission.status, 'worker-owned-isosurface-admission-ready');
  assert.equal(admission.surfaceCount, 1);
  assert.equal(admission.totalFieldCells, 64);
  assert.equal(admission.particleCount, 32);
  assert.equal(Object.isFrozen(admission), true);
  assert.equal(Object.isFrozen(admission.blockers), true);

  for (const [field, value, blocker] of [
    ['sameWorkerPrivateReferences', false, 'same-worker-retained-authority'],
    ['postMessageTransportAllowed', true, 'same-worker-retained-authority'],
    ['successorSourceFamily', null, 'retained-private-references'],
    ['sourceIdentityBuffer', null, 'retained-gpu-buffers']
  ]) {
    const blocked = resolveWorkerOwnedIsosurfaceAdmission({
      request: validRequest(),
      retained: { ...validRetained(), [field]: value }
    });
    assert.equal(blocked.ok, false, `${field} must fail closed`);
    assert.ok(blocked.blockers.includes(blocker));
  }
});

test('worker-owned true-isosurface admission rejects torn tables and camera state', () => {
  const request = validRequest();
  const cases = [
    { surfaceTable: { ...request.surfaceTable, records: [] }, blocker: 'surface-table' },
    { surfaceTable: { ...request.surfaceTable, metadata: [] }, blocker: 'surface-table' },
    { viewProjectionMatrix: [1, 2, 3], blocker: 'view-projection' },
    { cameraPositionM: [1, 2], blocker: 'camera-position' },
    { refEdgeM: 0, blocker: 'reference-edge' }
  ];
  for (const { blocker, ...override } of cases) {
    const admission = resolveWorkerOwnedIsosurfaceAdmission({
      request: { ...request, ...override },
      retained: validRetained()
    });
    assert.equal(admission.ok, false);
    assert.ok(admission.blockers.includes(blocker));
  }
});

test('clear during source capture retires the pre-clear isosurface before submit', async () => {
  const capture = deferred();
  let captureStarted = false;
  let captureReleased = false;
  const rig = createPresenterRig({
    captureRenderRows: async () => {
      captureStarted = true;
      return capture.promise;
    }
  });
  const enqueuePromise = rig.presenter.enqueue({
    request: validRequest(),
    retained: validRetained(),
    sphStep: 10
  });
  await waitFor(() => captureStarted, 'the deferred isosurface source capture');

  rig.setFramebufferEpoch(2);
  assert.equal(rig.presenter.clear({ reason: 'test-clear-during-capture' }), true);
  rig.setFramebufferEpoch(3);
  const resizeAfterClear = rig.presenter.resize({
    reason: 'test-resize-after-clear-during-capture'
  });
  capture.resolve({
    destroyRenderRowsBuffer() {
      captureReleased = true;
    }
  });
  const receipt = await enqueuePromise;

  assert.equal(
    receipt.status,
    ULG_WORKER_OFFSCREEN_RESIDENT_ISOSURFACE_PRESENTATION_SUPERSEDED_STATUS
  );
  assert.equal(queueSubmissionCount(rig), 0);
  assert.equal(await resizeAfterClear, false);
  assert.equal(
    rig.terminals.some((terminal) =>
      terminal.status
        === ULG_WORKER_OFFSCREEN_RESIDENT_ISOSURFACE_PRESENTATION_RENDERED_STATUS),
    false
  );
  await waitFor(() => captureReleased, 'the invalidated capture cleanup');
  await rig.presenter.dispose();
});

test('clear during a committed-frame GPU fence supersedes the stale isosurface', async () => {
  const fence = deferred();
  const rig = createPresenterRig({ queueCompletion: fence.promise });
  await rig.presenter.enqueue({
    request: validRequest(),
    retained: validRetained(),
    sphStep: 12
  });
  await waitFor(
    () => rig.submittedFrames.length === 1,
    'the committed isosurface queue submission'
  );

  rig.setFramebufferEpoch(2);
  assert.equal(rig.presenter.clear({ reason: 'test-clear-during-fence' }), true);
  fence.resolve();
  await waitFor(
    () => rig.presenter.getStatus().running === false,
    'the invalidated isosurface job to retire'
  );

  assert.equal(
    rig.terminals.some((receipt) =>
      receipt.status === ULG_WORKER_OFFSCREEN_RESIDENT_ISOSURFACE_PRESENTATION_RENDERED_STATUS),
    false
  );
  assert.equal(
    rig.terminals.some((receipt) =>
      receipt.status === ULG_WORKER_OFFSCREEN_RESIDENT_ISOSURFACE_PRESENTATION_SUPERSEDED_STATUS),
    true
  );
  assert.equal(rig.presentationOpportunityCalls, 0);
  assert.equal(rig.presenter.getStatus().visibleGeneration, null);
  await rig.presenter.dispose();
});

test('a resize after clear cannot rebase a pre-clear frame waiting on its GPU fence', async () => {
  const fence = deferred();
  const rig = createPresenterRig({ queueCompletion: fence.promise });
  await rig.presenter.enqueue({
    request: validRequest(),
    retained: validRetained(),
    sphStep: 14
  });
  await waitFor(
    () => queueSubmissionCount(rig) === 1,
    'the pre-clear isosurface queue submission'
  );

  rig.setFramebufferEpoch(2);
  assert.equal(rig.presenter.clear({ reason: 'test-clear-before-resize' }), true);
  rig.setFramebufferEpoch(3);
  const resizeAfterClear = rig.presenter.resize({
    reason: 'test-resize-after-clear-during-fence'
  });
  fence.resolve();

  assert.equal(await resizeAfterClear, false);
  await waitFor(
    () => rig.presenter.getStatus().running === false,
    'the pre-clear isosurface frame to retire'
  );
  assert.equal(
    queueSubmissionCount(rig),
    1,
    'the pre-clear frame must not be resubmitted at the post-resize epoch'
  );
  assert.equal(
    rig.terminals.some((receipt) =>
      receipt.status
        === ULG_WORKER_OFFSCREEN_RESIDENT_ISOSURFACE_PRESENTATION_RENDERED_STATUS),
    false
  );
  assert.equal(rig.presenter.getStatus().visibleGeneration, null);
  await rig.presenter.dispose();
});

test('clear during a redraw fence cannot republish the retired visible frame', async () => {
  const rig = createPresenterRig();
  await rig.presenter.enqueue({
    request: validRequest(),
    retained: validRetained(),
    sphStep: 18
  });
  await waitFor(
    () => rig.presenter.getStatus().visibleGeneration !== null,
    'the initial isosurface frame to become visible'
  );
  const renderedBeforeRedraw = rig.terminals.filter((receipt) =>
    receipt.status === ULG_WORKER_OFFSCREEN_RESIDENT_ISOSURFACE_PRESENTATION_RENDERED_STATUS).length;

  const redrawFence = deferred();
  rig.setQueueCompletion(redrawFence.promise);
  const redrawPromise = rig.presenter.redraw({ reason: 'test-redraw-clear-race' });
  await waitFor(
    () => rig.submittedFrames.length >= 3,
    'the redraw queue submission'
  );
  rig.setFramebufferEpoch(2);
  assert.equal(rig.presenter.clear({ reason: 'test-clear-during-redraw' }), true);
  redrawFence.resolve();

  assert.equal(await redrawPromise, false);
  assert.equal(
    rig.terminals.filter((receipt) =>
      receipt.status === ULG_WORKER_OFFSCREEN_RESIDENT_ISOSURFACE_PRESENTATION_RENDERED_STATUS).length,
    renderedBeforeRedraw
  );
  assert.equal(rig.presenter.getStatus().visibleGeneration, null);
  await rig.presenter.dispose();
});

test('camera redraw bursts serialize and coalesce to the latest matrix', async () => {
  const rig = createPresenterRig();
  await rig.presenter.enqueue({
    request: validRequest(),
    retained: validRetained(),
    sphStep: 21
  });
  await waitFor(
    () => rig.presenter.getStatus().visibleGeneration !== null,
    'the initial frame before the redraw burst'
  );

  const firstFence = deferred();
  rig.setQueueCompletion(firstFence.promise);
  const firstMatrix = viewProjectionWithTranslation(1);
  const middleMatrix = viewProjectionWithTranslation(2);
  const latestMatrix = viewProjectionWithTranslation(3);
  const firstRedraw = rig.presenter.redraw({
    viewProjectionMatrix: firstMatrix,
    reason: 'test-first-redraw'
  });
  await waitFor(
    () => queueSubmissionCount(rig) === 2,
    'the first serialized redraw submission'
  );
  const middleRedraw = rig.presenter.redraw({
    viewProjectionMatrix: middleMatrix,
    reason: 'test-middle-redraw'
  });
  const latestRedraw = rig.presenter.redraw({
    viewProjectionMatrix: latestMatrix,
    reason: 'test-latest-redraw'
  });

  assert.equal(await middleRedraw, false);
  firstFence.resolve();
  assert.equal(await firstRedraw, true);
  assert.equal(await latestRedraw, true);
  assert.equal(queueSubmissionCount(rig), 3);
  assert.deepEqual(
    rig.drawnViewProjectionMatrices.at(-1),
    latestMatrix
  );
  assert.equal(
    rig.drawnViewProjectionMatrices.some((matrix) => matrix[12] === 2),
    false
  );
  await rig.presenter.dispose();
});

test('a camera update during a committed frame redraws only the replacement frame', async () => {
  const rig = createPresenterRig();
  await rig.presenter.enqueue({
    request: validRequest(),
    retained: validRetained(),
    sphStep: 24
  });
  await waitFor(
    () => rig.presenter.getStatus().visibleGeneration === 1,
    'the first committed isosurface frame'
  );

  const committedFence = deferred();
  rig.setQueueCompletion(committedFence.promise);
  await rig.presenter.enqueue({
    request: validRequest(),
    retained: validRetained(),
    sphStep: 25
  });
  await waitFor(
    () => queueSubmissionCount(rig) === 2,
    'the replacement committed isosurface submission'
  );
  const carriedMatrix = viewProjectionWithTranslation(7);
  const carriedRedraw = rig.presenter.redraw({
    viewProjectionMatrix: carriedMatrix,
    reason: 'test-carried-camera-redraw'
  });
  assert.equal(queueSubmissionCount(rig), 2);

  committedFence.resolve();
  await waitFor(
    () => rig.presenter.getStatus().visibleGeneration === 2,
    'the replacement isosurface frame to become visible'
  );
  assert.equal(await carriedRedraw, true);
  assert.equal(queueSubmissionCount(rig), 3);
  assert.deepEqual(rig.drawnViewProjectionMatrices.at(-1), carriedMatrix);
  assert.equal(
    rig.terminals.filter((receipt) =>
      receipt.status === ULG_WORKER_OFFSCREEN_RESIDENT_ISOSURFACE_PRESENTATION_RENDERED_STATUS).length,
    3
  );
  await rig.presenter.dispose();
});

test('resize during frame construction rebases and presents the completed replacement', async () => {
  const buildGate = deferred();
  let buildStarted = false;
  const rig = createPresenterRig({
    buildPresentationFrame: async (job) => {
      buildStarted = true;
      await buildGate.promise;
      return {
        generation: job.generation,
        invalidationEpoch: job.invalidationEpoch,
        sphStep: job.sphStep,
        receiptFields: job.receiptFields,
        viewProjectionMatrix: [...job.admission.viewProjectionMatrix],
        cameraPositionM: [...job.admission.cameraPositionM],
        boxDimsM: null,
        surfaces: []
      };
    }
  });
  await rig.presenter.enqueue({
    request: validRequest(),
    retained: validRetained(),
    sphStep: 28
  });
  await waitFor(() => buildStarted, 'the deferred isosurface frame construction');

  const resizedMatrix = viewProjectionWithTranslation(8);
  rig.setFramebufferEpoch(2);
  const resizeRedraw = rig.presenter.resize({
    viewProjectionMatrix: resizedMatrix,
    reason: 'test-resize-during-frame-construction'
  });
  buildGate.resolve();

  assert.equal(await resizeRedraw, true);
  assert.equal(rig.presenter.getStatus().visibleGeneration, 1);
  assert.equal(rig.presenter.getStatus().visibleSphStep, 28);
  assert.ok(queueSubmissionCount(rig) >= 1);
  assert.deepEqual(rig.drawnViewProjectionMatrices.at(-1), resizedMatrix);
  assert.equal(
    rig.terminals.findLast((receipt) =>
      receipt.status
        === ULG_WORKER_OFFSCREEN_RESIDENT_ISOSURFACE_PRESENTATION_RENDERED_STATUS)
      ?.workerFramebufferEpoch,
    2
  );
  await rig.presenter.dispose();
});

test('resize invalidates an active commit proof and redraws the replacement frame', async () => {
  const rig = createPresenterRig();
  await rig.presenter.enqueue({
    request: validRequest(),
    retained: validRetained(),
    sphStep: 30
  });
  await waitFor(
    () => rig.presenter.getStatus().visibleGeneration === 1,
    'the pre-resize isosurface frame'
  );

  const preResizeFence = deferred();
  rig.setQueueCompletion(preResizeFence.promise);
  await rig.presenter.enqueue({
    request: validRequest(),
    retained: validRetained(),
    sphStep: 31
  });
  await waitFor(
    () => queueSubmissionCount(rig) === 2,
    'the pre-resize replacement submission'
  );
  const resizedMatrix = viewProjectionWithTranslation(9);
  rig.setFramebufferEpoch(2);
  const resizeRedraw = rig.presenter.resize({
    viewProjectionMatrix: resizedMatrix,
    reason: 'test-resize-invalidation-barrier'
  });
  preResizeFence.resolve();

  assert.equal(await resizeRedraw, true);
  assert.equal(rig.presenter.getStatus().visibleGeneration, 2);
  assert.equal(rig.presenter.getStatus().visibleSphStep, 31);
  assert.equal(queueSubmissionCount(rig), 4);
  assert.deepEqual(rig.drawnViewProjectionMatrices.at(-1), resizedMatrix);
  assert.equal(
    rig.terminals.findLast((receipt) =>
      receipt.status
        === ULG_WORKER_OFFSCREEN_RESIDENT_ISOSURFACE_PRESENTATION_RENDERED_STATUS)
      ?.workerFramebufferEpoch,
    2
  );
  assert.equal(
    rig.terminals.filter((receipt) =>
      receipt.status === ULG_WORKER_OFFSCREEN_RESIDENT_ISOSURFACE_PRESENTATION_RENDERED_STATUS).length,
    3
  );
  await rig.presenter.dispose();
});

test('successive resizes during replacement fences reach the newest framebuffer epoch', async () => {
  const rig = createPresenterRig();
  await rig.presenter.enqueue({
    request: validRequest(),
    retained: validRetained(),
    sphStep: 40
  });
  await waitFor(
    () => rig.presenter.getStatus().visibleGeneration === 1,
    'the initial frame before successive resizes'
  );

  const firstFence = deferred();
  rig.setQueueCompletion(firstFence.promise);
  await rig.presenter.enqueue({
    request: validRequest(),
    retained: validRetained(),
    sphStep: 41
  });
  await waitFor(
    () => queueSubmissionCount(rig) === 2,
    'the replacement frame before the first resize'
  );

  rig.setFramebufferEpoch(2);
  const firstResize = rig.presenter.resize({
    viewProjectionMatrix: viewProjectionWithTranslation(10),
    reason: 'test-first-resize-during-replacement-fence'
  });
  const secondFence = deferred();
  rig.setQueueCompletion(secondFence.promise);
  firstFence.resolve();
  await waitFor(
    () => queueSubmissionCount(rig) === 3,
    'the first resize retry submission'
  );

  rig.setFramebufferEpoch(3);
  const newestMatrix = viewProjectionWithTranslation(11);
  const secondResize = rig.presenter.resize({
    viewProjectionMatrix: newestMatrix,
    reason: 'test-second-resize-during-replacement-fence'
  });
  rig.setQueueCompletion(Promise.resolve());
  secondFence.resolve();

  assert.equal(await firstResize, false);
  assert.equal(await secondResize, true);
  await waitFor(
    () => rig.presenter.getStatus().running === false,
    'the newest framebuffer replacement to settle'
  );
  assert.equal(rig.presenter.getStatus().visibleGeneration, 2);
  assert.equal(rig.presenter.getStatus().visibleSphStep, 41);
  assert.ok(queueSubmissionCount(rig) >= 4);
  assert.deepEqual(rig.drawnViewProjectionMatrices.at(-1), newestMatrix);
  assert.equal(
    rig.terminals.findLast((receipt) =>
      receipt.status
        === ULG_WORKER_OFFSCREEN_RESIDENT_ISOSURFACE_PRESENTATION_RENDERED_STATUS)
      ?.workerFramebufferEpoch,
    3
  );
  await rig.presenter.dispose();
});
