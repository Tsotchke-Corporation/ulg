import assert from 'node:assert/strict';
import test from 'node:test';
import {
  OPTICAL_GPU_RECORD_FLOATS,
  OPTICAL_GPU_SPECTRAL_SAMPLE_FLOATS,
  ULG_OPTICAL_GPU_TABLE_SCHEMA
} from '../src/runtime/material/opticalGpuBuffers.js';

import {
  ULG_WORKER_OFFSCREEN_RESIDENT_ISOSURFACE_PRESENTATION_GEOMETRY,
  ULG_WORKER_OFFSCREEN_RESIDENT_ISOSURFACE_PRESENTATION_ENQUEUED_STATUS,
  ULG_WORKER_OFFSCREEN_RESIDENT_ISOSURFACE_PRESENTATION_FAILED_STATUS,
  ULG_WORKER_OFFSCREEN_RESIDENT_ISOSURFACE_PRESENTATION_RENDERED_STATUS,
  ULG_WORKER_OFFSCREEN_RESIDENT_ISOSURFACE_PRESENTATION_SUPERSEDED_STATUS,
  ULG_WORKER_OFFSCREEN_RESIDENT_ISOSURFACE_REQUEST_SCHEMA,
  buildWorkerOwnedIsosurfaceSurfaceUniformValues,
  createWorkerOwnedIsosurfacePresenter,
  dampedIsosurfaceShaderMotionAgeS,
  resolveWorkerOwnedIsosurfaceAdmission,
  resolveWorkerOwnedIsosurfaceProductEventSource,
  snapshotWorkerOwnedSurfaceMetadata,
  summarizeWorkerOwnedIsosurfaceOpticalPresentation,
  threeViewProjectionToWebGpuClipMatrix,
  RETAINED_GAP_STARVATION_MS
} from '../src/services/workerOwnedIsosurfacePresenter.js';
import {
  SPH_GPU_REACTION_PRODUCT_EVENT_FLOATS
} from '../src/runtime/sph/sphRenderGpuKernel.js';
import {
  productEventLiveCountCopyDescriptor,
  registerResidentProductEventCountAuthority,
  resolveResidentProductEventCountAuthority,
  retireResidentProductEventCountAuthority,
  revokeResidentProductEventCountAuthority,
  validateProductEventLiveCountCopyDescriptor
} from '../src/runtime/sph/sphResidentProductHistoryGpu.js';
import {
  buildSphDispersedMediumGpuBuffers,
  destroySphDispersedMediumGpuBuffers,
  uploadSphDispersedMediumGpuBuffers
} from '../src/runtime/sph/sphDispersedMediumGpuBuffers.js';
import {
  tagWebGpuBufferDevice
} from '../src/runtime/sph/sphGpuDeviceIdentity.js';
import {
  closeWorkerQueueSubmitBurst,
  openWorkerQueueSubmitBurst
} from '../src/runtime/webgpuComputeLayout.js';
import {
  waitForWorkerPresentationOpportunity
} from '../src/services/workerPresentationOpportunity.js';
import {
  createPresentationPauseClock
} from '../src/services/workerOwnedIsosurfaceMotion.js';

class GPUBuffer {
  constructor(size = 4096, usage = 0) {
    this.size = size;
    this.usage = usage;
    this.destroyCount = 0;
    this.destroyed = false;
    this.mappedRange = new ArrayBuffer(size);
  }

  getMappedRange() {
    return this.mappedRange;
  }

  unmap() {
    this.unmapped = true;
  }

  destroy() {
    this.destroyCount += 1;
    this.destroyed = true;
  }
}

const dispersedIdentityBufferBySidecar = new WeakMap();

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
  buildRenderField = undefined,
  buildPresentationFrame = null,
  temporalNowMs = undefined,
  presentationPauseClock = undefined,
  useBuiltInFrame = false,
  createParticipatingMediumDescriptor = undefined,
  createParticipatingMediumGpu = undefined,
  encodeParticipatingMediumPack = undefined,
  encodeParticipatingMediumRender = undefined,
  destroyParticipatingMediumPackedFrame = undefined,
  nativeMaterialOverrides = {}
} = {}) {
  const terminals = [];
  const submittedFrames = [];
  const drawnViewProjectionMatrices = [];
  const renderPasses = [];
  const materialCalls = [];
  const presentationOpportunityRegistrations = [];
  let presentationOpportunityCalls = 0;
  let presentationOpportunityRegistrationObserver = null;
  let appearanceReadyCallback = null;
  let presentationOpportunityObserver = () => ({
    available: true,
    method: 'test-presentation-opportunity',
    observedAtMs: 1
  });
  let queueCompletionPromise = queueCompletion;
  let framebufferEpoch = 1;
  let framebufferEpochObserver = null;
  let frameSubmissionObserver = null;
  const device = {
    createBuffer({ size = 4096, usage = 0 } = {}) {
      return new GPUBuffer(size, usage);
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
        beginRenderPass(descriptor) {
          const actions = [];
          const pass = {
            setPipeline(pipeline) {
              actions.push({ type: 'pipeline', pipeline });
            },
            setBindGroup(index, bindGroup) {
              actions.push({ type: 'bind-group', index, bindGroup });
            },
            setVertexBuffer(index, buffer) {
              actions.push({ type: 'vertex-buffer', index, buffer });
            },
            drawIndirect(buffer, offset) {
              actions.push({ type: 'draw-indirect', buffer, offset });
            },
            end() {
              actions.push({ type: 'end' });
            }
          };
          renderPasses.push({ descriptor, actions, pass });
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
        return { width: 640, height: 480, createView: () => ({}) };
      }
    },
    format: 'rgba8unorm',
    getDepthView: () => ({}),
    getViewportSize: () => [640, 480],
    drawOverlay: (pass, viewProjectionMatrix) => {
      drawnViewProjectionMatrices.push([...viewProjectionMatrix]);
      const renderPass = renderPasses.find((entry) => entry.pass === pass);
      renderPass?.actions.push({ type: 'overlay' });
    },
    onTerminal: (receipt) => terminals.push(receipt),
    onFrameSubmitted: (receipt) => {
      submittedFrames.push(receipt);
      frameSubmissionObserver?.(receipt);
    },
    waitForPresentationOpportunity: async (options = {}) => {
      presentationOpportunityRegistrations.push(options);
      if (presentationOpportunityRegistrationObserver) {
        return presentationOpportunityRegistrationObserver(options);
      }
      try {
        await options.afterGpuCompletion;
      } catch {
        return { available: false, method: 'worker-gpu-completion-failed' };
      }
      if (options.signal?.aborted) {
        return { available: false, method: 'worker-request-animation-frame-aborted' };
      }
      if (typeof options.isCurrent === 'function' && !options.isCurrent()) {
        return { available: false, method: 'worker-request-animation-frame-stale' };
      }
      presentationOpportunityCalls += 1;
      return presentationOpportunityObserver(options);
    },
    getFramebufferEpoch: () => framebufferEpochObserver
      ? framebufferEpochObserver(framebufferEpoch) : framebufferEpoch,
    temporalNowMs,
    presentationPauseClock,
    createNativeSurfaceMaterial: ({ onAppearanceReady }) => {
      appearanceReadyCallback = onAppearanceReady;
      return {
      ready: Promise.resolve(),
      async prepare(frame) {
        materialCalls.push({ type: 'prepare', appearance: frame.nativeSurfaceAppearance });
      },
      clearValue: () => ({ r: 0, g: 0, b: 0, a: 1 }),
      drawBackground() {},
      draw(pass, frame, surface, options) {
        materialCalls.push({ type: 'draw', frame, surface, options,
          camera: [...frame.cameraPositionM], age: frame.drawMotionAgeS });
        return true;
      },
      copySceneColor() { materialCalls.push({ type: 'scene-copy' }); },
      backDepthView: () => ({ backDepth: true }),
      releaseFrame() {},
      transferFrame() {},
      dispose() {},
      ...nativeMaterialOverrides
      };
    },
    captureRenderRows,
    buildRenderField,
    createParticipatingMediumDescriptor,
    createParticipatingMediumGpu,
    encodeParticipatingMediumPack,
    encodeParticipatingMediumRender,
    destroyParticipatingMediumPackedFrame,
    buildPresentationFrame: useBuiltInFrame
      ? null
      : (buildPresentationFrame ?? (
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
        ))
  });
  return {
    device,
    presenter,
    terminals,
    submittedFrames,
    drawnViewProjectionMatrices,
    renderPasses,
    materialCalls,
    presentationOpportunityRegistrations,
    notifyAppearanceReady() { appearanceReadyCallback?.(); },
    get presentationOpportunityCalls() {
      return presentationOpportunityCalls;
    },
    setPresentationOpportunity(observer) {
      presentationOpportunityObserver = observer;
    },
    setPresentationOpportunityRegistrationObserver(observer) {
      presentationOpportunityRegistrationObserver = observer;
    },
    setQueueCompletion(promise) {
      queueCompletionPromise = promise;
    },
    setFramebufferEpoch(epoch) {
      framebufferEpoch = epoch;
    },
    setFramebufferEpochObserver(observer) {
      framebufferEpochObserver = observer;
    },
    setFrameSubmissionObserver(observer) {
      frameSubmissionObserver = observer;
    }
  };
}

function viewProjectionWithTranslation(x) {
  const matrix = [...validRequest().viewProjectionMatrix];
  matrix[12] = x;
  return matrix;
}

function installControlledPresentationOpportunities(rig) {
  const frames = new Map();
  const timers = new Map();
  let serial = 0;
  let clockMs = 0;
  let registrationCount = 0;
  rig.setPresentationOpportunityRegistrationObserver(options => waitForWorkerPresentationOpportunity(options, {
    requestAnimationFrame(callback) {
      registrationCount += 1;
      const handle = ++serial;
      frames.set(handle, callback);
      return handle;
    },
    cancelAnimationFrame(handle) { frames.delete(handle); },
    setTimeout(callback, delay) {
      const handle = ++serial;
      timers.set(handle, { callback, delay });
      return handle;
    },
    clearTimeout(handle) { timers.delete(handle); },
    now: () => clockMs
  }));
  return {
    frames, timers,
    get registrationCount() { return registrationCount; },
    setClock(value) { clockMs = value; },
    fireFrame() {
      const entry = frames.entries().next().value;
      assert.ok(entry, 'an early-armed presentation callback is pending');
      frames.delete(entry[0]);
      entry[1](clockMs);
    }
  };
}

test('prearmed presenter registers against its exact pending fence and admits only the later delivered callback', async () => {
  const fence = deferred();
  const rig = createPresenterRig({ queueCompletion: fence.promise });
  const callbacks = installControlledPresentationOpportunities(rig);
  try {
    await rig.presenter.enqueue({ request: validRequest(), retained: validRetained(), sphStep: 1 });
    await waitFor(() => rig.presentationOpportunityRegistrations.length === 1, 'observer prearmed against GPU work');
    assert.equal(rig.presentationOpportunityRegistrations[0].afterGpuCompletion, fence.promise);
    assert.equal(typeof rig.presentationOpportunityRegistrations[0].isCurrent, 'function');
    assert.equal(callbacks.frames.size, 1);
    assert.equal(callbacks.timers.size, 0);
    assert.equal(frameProofs(rig).length, 0);
    assert.equal(rig.presenter.getStatus().visibleSphStep, null);
    fence.resolve();
    await waitFor(() => callbacks.timers.size === 1, 'GPU completion starts the opportunity budget');
    assert.equal(frameProofs(rig).length, 0);
    assert.equal(callbacks.registrationCount, 1,
      'GPU completion keeps the already-pending callback, not a second browser-frame registration');
    callbacks.setClock(10);
    callbacks.fireFrame();
    await waitFor(() => rig.presenter.getStatus().visibleSphStep === 1, 'callback-admitted committed source');
    assert.equal(frameProofs(rig).length, 1);
    assert.equal(frameProofs(rig)[0].presentationQueueCompletionSerial, 1);
    assert.equal(frameProofs(rig)[0].presentationFramePresentationOpportunityMethod,
      'worker-request-animation-frame-after-gpu-completion');
    assert.equal(callbacks.frames.size, 0);
    assert.equal(callbacks.timers.size, 0);
  } finally {
    fence.resolve();
    await rig.presenter.dispose();
  }
});

test('prearmed presenter cannot turn a prematurely fulfilled injected observer into post-GPU proof', async () => {
  const fence = deferred();
  const rig = createPresenterRig({ queueCompletion: fence.promise });
  rig.setPresentationOpportunityRegistrationObserver(() => Promise.resolve({
    available: true, method: 'worker-request-animation-frame-after-gpu-completion', observedAtMs: 10
  }));
  try {
    await rig.presenter.enqueue({ request: validRequest(), retained: validRetained(), sphStep: 1 });
    await waitFor(() => rig.presentationOpportunityRegistrations.length === 1, 'premature observer registration');
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(frameProofs(rig).length, 0);
    assert.equal(rig.presenter.getStatus().visibleSphStep, null);
    fence.resolve();
    await waitFor(() => rig.presenter.getStatus().running === false, 'GPU completes after the invalid observation');
    assert.equal(frameProofs(rig).length, 0,
      'awaiting the GPU afterward cannot authenticate a previously settled callback result');
    assert.equal(rig.presenter.getStatus().visibleSphStep, null);
    assert.equal(rig.presentationOpportunityRegistrations.length, 1,
      'a prematurely fulfilled observer is not the recoverable timeout type');
    assert.ok(rig.terminals.some(value => value.status
      === ULG_WORKER_OFFSCREEN_RESIDENT_ISOSURFACE_PRESENTATION_FAILED_STATUS));
  } finally {
    fence.resolve();
    await rig.presenter.dispose();
  }
});

test('prearmed presenter accepts an injected observation when the original fence was already fulfilled', async () => {
  const queueCompletion = Promise.resolve();
  const rig = createPresenterRig({ queueCompletion });
  rig.setPresentationOpportunityRegistrationObserver(() => Promise.resolve({
    available: true, method: 'worker-request-animation-frame-after-gpu-completion', observedAtMs: 10
  }));
  try {
    await rig.presenter.enqueue({ request: validRequest(), retained: validRetained(), sphStep: 1 });
    await waitFor(() => rig.presenter.getStatus().visibleSphStep === 1, 'already-completed fence admission');
    assert.equal(rig.presentationOpportunityRegistrations[0].afterGpuCompletion, queueCompletion);
    assert.equal(frameProofs(rig).length, 1);
    assert.equal(frameProofs(rig)[0].presentationQueueCompletionSerial, 1);
  } finally {
    await rig.presenter.dispose();
  }
});

test('prearmed presenter handles an injected observer rejection immediately while retaining the exact GPU await', async () => {
  const fence = deferred();
  const rig = createPresenterRig({ queueCompletion: fence.promise });
  const unhandled = [];
  const listener = error => unhandled.push(error);
  process.on('unhandledRejection', listener);
  rig.setPresentationOpportunityRegistrationObserver(() => Promise.reject(new Error('early observer rejection')));
  try {
    await rig.presenter.enqueue({ request: validRequest(), retained: validRetained(), sphStep: 1 });
    await waitFor(() => rig.presentationOpportunityRegistrations.length === 1, 'early rejecting observer');
    await new Promise(resolve => setImmediate(resolve));
    assert.deepEqual(unhandled, []);
    assert.equal(rig.terminals.length, 0, 'the original GPU fence still governs source lifetime');
    assert.equal(frameProofs(rig).length, 0);
    fence.resolve();
    await waitFor(() => rig.terminals.some(value => value.status
      === ULG_WORKER_OFFSCREEN_RESIDENT_ISOSURFACE_PRESENTATION_FAILED_STATUS), 'original observer error after GPU completion');
    assert.match(rig.terminals.at(-1).reason, /early observer rejection/);
    assert.equal(frameProofs(rig).length, 0);
    assert.equal(rig.presentationOpportunityRegistrations.length, 1);
  } finally {
    fence.resolve();
    await rig.presenter.dispose();
    process.off('unhandledRejection', listener);
  }
});

test('prearmed presenter keeps the one-retry budget and GPU serials when a real helper callback misses its deadline', async () => {
  const rig = createPresenterRig();
  const callbacks = installControlledPresentationOpportunities(rig);
  try {
    await rig.presenter.enqueue({ request: validRequest(), retained: validRetained(), sphStep: 1 });
    await waitFor(() => callbacks.frames.size === 1 && callbacks.timers.size === 1, 'first post-GPU callback');
    callbacks.setClock(75);
    callbacks.fireFrame();
    await waitFor(() => callbacks.registrationCount === 2 && callbacks.frames.size === 1
      && callbacks.timers.size === 1, 'single committed retry after a real helper timeout');
    assert.equal(frameProofs(rig).length, 0);
    assert.equal(rig.presenter.getStatus().visibleSphStep, null);
    assert.equal(queueSubmissionCount(rig), 2);
    callbacks.setClock(76);
    callbacks.fireFrame();
    await waitFor(() => rig.presenter.getStatus().visibleSphStep === 1, 'deadline retry admitted');
    assert.equal(frameProofs(rig).length, 1);
    assert.equal(frameProofs(rig)[0].presentationQueueCompletionSerial, 2);
    assert.equal(callbacks.frames.size, 0);
    assert.equal(callbacks.timers.size, 0);
  } finally {
    const disposal = rig.presenter.dispose();
    while (callbacks.frames.size) callbacks.fireFrame();
    await disposal;
  }
});

test('prearmed presenter preserves exact GPU failure and consumed serial without publishing its early callback', async () => {
  const fence = deferred();
  const rig = createPresenterRig({ queueCompletion: fence.promise });
  const callbacks = installControlledPresentationOpportunities(rig);
  try {
    await rig.presenter.enqueue({ request: validRequest(), retained: validRetained(), sphStep: 1 });
    await waitFor(() => callbacks.frames.size === 1, 'prearmed callback before failing GPU fence');
    fence.reject(new Error('exact submitted GPU fence rejected'));
    await waitFor(() => rig.terminals.some(value => value.status
      === ULG_WORKER_OFFSCREEN_RESIDENT_ISOSURFACE_PRESENTATION_FAILED_STATUS), 'GPU failure, not observer failure');
    assert.match(rig.terminals.at(-1).reason, /exact submitted GPU fence rejected/);
    assert.equal(frameProofs(rig).length, 0);
    assert.equal(rig.presenter.getStatus().visibleSphStep, null);
    assert.equal(callbacks.frames.size, 0);
    assert.equal(callbacks.timers.size, 0);
    rig.setQueueCompletion(Promise.resolve());
    await rig.presenter.enqueue({ request: validRequest(), retained: validRetained(), sphStep: 2 });
    await waitFor(() => callbacks.frames.size === 1 && callbacks.timers.size === 1, 'new source after GPU failure');
    callbacks.setClock(10);
    callbacks.fireFrame();
    await waitFor(() => rig.presenter.getStatus().visibleSphStep === 2, 'later source admitted');
    assert.equal(frameProofs(rig)[0].presentationQueueCompletionSerial, 2);
  } finally {
    fence.resolve();
    rig.setQueueCompletion(Promise.resolve());
    await rig.presenter.dispose();
  }
});

for (const action of ['clear', 'dispose', 'resize']) {
  test(`prearmed presenter ${action} after GPU but before callback preserves lifecycle handling without a false failure`, async () => {
    const fence = deferred();
    const rig = createPresenterRig({ queueCompletion: fence.promise });
    const callbacks = installControlledPresentationOpportunities(rig);
    let actionPending = null;
    try {
      await rig.presenter.enqueue({ request: validRequest(), retained: validRetained(), sphStep: 1 });
      await waitFor(() => callbacks.frames.size === 1, 'prearmed initial callback');
      fence.resolve();
      await waitFor(() => callbacks.timers.size === 1, 'post-GPU callback remains outstanding');
      assert.equal(frameProofs(rig).length, 0);
      if (action === 'clear') rig.presenter.clear();
      if (action === 'dispose') actionPending = rig.presenter.dispose();
      if (action === 'resize') {
        rig.setFramebufferEpoch(2);
        actionPending = rig.presenter.resize({ reason: 'post-gpu-pre-callback-resize' });
      }
      callbacks.setClock(10);
      callbacks.fireFrame();
      if (action === 'resize') {
        await waitFor(() => callbacks.registrationCount === 2 && callbacks.frames.size === 1,
          'stale observer returns false so the immutable source can rebase');
        assert.equal(frameProofs(rig).length, 0);
        callbacks.setClock(20);
        callbacks.fireFrame();
        await waitFor(() => rig.presenter.getStatus().visibleSphStep === 1, 'same source admitted after resize');
        await waitFor(() => callbacks.frames.size === 1, 'explicit resize redraw opportunity');
        callbacks.setClock(30);
        callbacks.fireFrame();
        await actionPending;
        assert.ok(frameProofs(rig).every(value => value.workerFramebufferEpoch === 2));
        assert.equal(frameProofs(rig)[0].presentationQueueCompletionSerial, 2);
      } else {
        await waitFor(() => rig.presenter.getStatus().running === false, 'invalidated committed source settles');
        await actionPending;
        assert.equal(frameProofs(rig).length, 0);
        assert.equal(rig.presenter.getStatus().visibleSphStep, null);
        assert.ok(rig.terminals.some(value => value.status
          === ULG_WORKER_OFFSCREEN_RESIDENT_ISOSURFACE_PRESENTATION_SUPERSEDED_STATUS));
      }
      assert.equal(rig.terminals.some(value => value.status
        === ULG_WORKER_OFFSCREEN_RESIDENT_ISOSURFACE_PRESENTATION_FAILED_STATUS), false,
      'a stale/aborted helper outcome is not a generic observer failure');
      assert.equal(callbacks.frames.size, 0);
      assert.equal(callbacks.timers.size, 0);
    } finally {
      fence.resolve();
      const disposal = rig.presenter.dispose();
      while (callbacks.frames.size) callbacks.fireFrame();
      await disposal;
      await actionPending;
    }
  });
}

test('warm submit fence registers before a later physics microtask enters the real held-submit wrapper', async () => {
  const rig = createPresenterRig();
  let pushes = 0;
  let pops = 0;
  rig.device.pushErrorScope = () => { pushes += 1; };
  rig.device.popErrorScope = async () => { pops += 1; return null; };
  const fence = deferred();
  const trace = [];
  const batches = [];
  let redraw = null;
  let burstOpen = false;
  try {
    await rig.presenter.enqueue({ request: validRequest(), retained: validRetained(), sphStep: 1 });
    await waitFor(() => rig.presenter.getStatus().visibleSphStep === 1
      && rig.presenter.getStatus().running === false, 'initial validated source');
    assert.equal(pushes, 1);
    assert.equal(pops, 1);
    const proofsBefore = frameProofs(rig).length;
    const opportunitiesBefore = rig.presentationOpportunityCalls;
    const createEncoder = rig.device.createCommandEncoder.bind(rig.device);
    rig.device.createCommandEncoder = descriptor => {
      const encoder = createEncoder(descriptor);
      const finish = encoder.finish.bind(encoder);
      encoder.finish = () => ({ ...finish(), label: descriptor.label });
      return encoder;
    };
    const submit = rig.device.queue.submit.bind(rig.device.queue);
    rig.device.queue.submit = commands => {
      batches.push(commands.map(command => command.label));
      trace.push('native-submit');
      submit(commands);
    };
    rig.device.queue.onSubmittedWorkDone = () => {
      trace.push('frame-fence-registered');
      return fence.promise;
    };
    openWorkerQueueSubmitBurst(rig.device, { label: 'warm-presentation-fence-order-test' });
    burstOpen = true;
    const heldSubmit = rig.device.queue.submit.bind(rig.device.queue);
    rig.device.queue.submit = commands => {
      heldSubmit(commands);
      if (commands.some(command => command.label === 'ulg-worker-owned-isosurface-presentation')) {
        queueMicrotask(() => {
          trace.push('later-physics-enqueued');
          heldSubmit([{ label: 'later-physics' }]);
        });
      }
    };
    redraw = rig.presenter.redraw({ reason: 'warm-submit-fence-order' });
    await waitFor(() => trace.includes('frame-fence-registered')
      && trace.includes('later-physics-enqueued'), 'warm frame fence and later physics enqueue');
    assert.ok(trace.indexOf('frame-fence-registered') < trace.indexOf('later-physics-enqueued'),
      `warm frame fence must precede later physics; actual order: ${trace.join(' -> ')}`);
    assert.deepEqual(batches, [['ulg-worker-owned-isosurface-presentation']],
      'the frame fence flushes only the already-held presentation, not later physics');
    assert.equal(pushes, 1, 'warm draw does not open another first-draw validation scope');
    assert.equal(pops, 1);
    assert.equal(frameProofs(rig).length, proofsBefore,
      'registering a fence is not completion or presentation admission');
    assert.equal(rig.presentationOpportunityCalls, opportunitiesBefore);
    fence.resolve();
    assert.equal(await redraw, true);
    assert.equal(frameProofs(rig).length, proofsBefore + 1);
    assert.equal(frameProofs(rig).at(-1).physicsQueuePrefixCoverage,
      'physics-queue-prefix-not-attributed');
    assert.equal(frameProofs(rig).at(-1).authoritativeStateMutation, false);
  } finally {
    fence.resolve();
    await redraw;
    if (burstOpen) closeWorkerQueueSubmitBurst(rig.device);
    await rig.presenter.dispose();
  }
});

for (const validationFails of [false, true]) {
  test(`warm submit fence optimization still awaits first validation${validationFails ? ' and rejects its error' : ' before admission'}`, async () => {
    const rig = createPresenterRig();
    const validation = deferred();
    let pushes = 0;
    let pops = 0;
    let fences = 0;
    rig.device.pushErrorScope = kind => {
      assert.equal(kind, 'validation');
      pushes += 1;
    };
    rig.device.popErrorScope = () => ++pops === 1 ? validation.promise : Promise.resolve(null);
    rig.device.queue.onSubmittedWorkDone = () => { fences += 1; return Promise.resolve(); };
    try {
      await rig.presenter.enqueue({ request: validRequest(), retained: validRetained(), sphStep: 1 });
      await waitFor(() => pops === 1, 'pending first validation scope');
      assert.equal(queueSubmissionCount(rig), 1);
      assert.equal(fences, 0, 'a real first validation scope must still finish before frame completion fencing');
      assert.equal(rig.presentationOpportunityCalls, 0);
      assert.equal(frameProofs(rig).length, 0);
      assert.equal(rig.terminals.length, 0);
      assert.equal(rig.presenter.getStatus().visibleGeneration, null);
      validation.resolve(validationFails ? { message: 'first-scope validation rejected the draw' } : null);
      if (validationFails) {
        await waitFor(() => rig.terminals.some(value => value.status
          === ULG_WORKER_OFFSCREEN_RESIDENT_ISOSURFACE_PRESENTATION_FAILED_STATUS), 'actual validation error');
        assert.match(rig.terminals.at(-1).reason, /first-scope validation rejected the draw/);
        assert.equal(frameProofs(rig).length, 0);
        assert.equal(rig.presentationOpportunityCalls, 0);
        assert.equal(rig.presenter.getStatus().visibleGeneration, null);
        await rig.presenter.enqueue({ request: validRequest(), retained: validRetained(), sphStep: 2 });
        await waitFor(() => rig.presenter.getStatus().visibleSphStep === 2, 'later source revalidates after error');
        assert.equal(pushes, 2, 'a rejected validation cannot mark firstDrawValidated');
        assert.equal(pops, 2);
        assert.equal(frameProofs(rig)[0].presentationQueueCompletionSerial, 1,
          'failed validation does not mint a completed frame serial');
      } else {
        await waitFor(() => rig.presenter.getStatus().visibleSphStep === 1, 'validated first source');
        assert.equal(pushes, 1);
        assert.equal(pops, 1);
        assert.equal(frameProofs(rig).length, 1);
        assert.equal(frameProofs(rig)[0].presentationQueueCompletionSerial, 1);
      }
    } finally {
      validation.resolve(null);
      await rig.presenter.dispose();
    }
  });
}

for (const failureKind of ['synchronous throw', 'asynchronous rejection']) {
  test(`warm submit fence ${failureKind} stays fatal without proof or serial rollback`, async () => {
    const rig = createPresenterRig();
    rig.device.pushErrorScope = () => {};
    rig.device.popErrorScope = async () => null;
    try {
      await rig.presenter.enqueue({ request: validRequest(), retained: validRetained(), sphStep: 1 });
      await waitFor(() => rig.presenter.getStatus().visibleSphStep === 1
        && rig.presenter.getStatus().running === false, 'validated source before fence failure');
      const proof = frameProofs(rig).at(-1);
      const opportunitiesBefore = rig.presentationOpportunityCalls;
      rig.device.queue.onSubmittedWorkDone = () => {
        const error = new Error('warm GPU completion failed');
        if (failureKind === 'synchronous throw') throw error;
        return Promise.reject(error);
      };
      await assert.rejects(rig.presenter.redraw({ reason: 'warm-fence-failure' }), /warm GPU completion failed/);
      assert.equal(queueSubmissionCount(rig), 2);
      assert.equal(frameProofs(rig).length, 1);
      assert.equal(rig.presentationOpportunityCalls, opportunitiesBefore);
      rig.device.queue.onSubmittedWorkDone = () => Promise.resolve();
      assert.equal(await rig.presenter.redraw({ reason: 'explicit-redraw-after-warm-fence-failure' }), true);
      assert.equal(frameProofs(rig).length, 2);
      assert.equal(frameProofs(rig).at(-1).presentationQueueCompletionSerial,
        proof.presentationQueueCompletionSerial + 2);
    } finally {
      rig.device.queue.onSubmittedWorkDone = () => Promise.resolve();
      await rig.presenter.dispose();
    }
  });
}

for (const action of ['clear', 'resize', 'dispose']) {
  test(`warm submit fence precedes queued ${action}, but the post-fence guard rejects its invalidated proof`, async () => {
    const rig = createPresenterRig();
    rig.device.pushErrorScope = () => {};
    rig.device.popErrorScope = async () => null;
    const fence = deferred();
    const trace = [];
    let actionPending = null;
    let redraw = null;
    try {
      await rig.presenter.enqueue({ request: validRequest(), retained: validRetained(), sphStep: 1 });
      await waitFor(() => rig.presenter.getStatus().visibleSphStep === 1
        && rig.presenter.getStatus().running === false, 'validated source before queued invalidation');
      const proof = frameProofs(rig).at(-1);
      const opportunitiesBefore = rig.presentationOpportunityCalls;
      const submit = rig.device.queue.submit.bind(rig.device.queue);
      let scheduled = false;
      rig.device.queue.submit = commands => {
        submit(commands);
        if (scheduled) return;
        scheduled = true;
        queueMicrotask(() => {
          trace.push(action);
          if (action === 'clear') rig.presenter.clear();
          if (action === 'dispose') actionPending = rig.presenter.dispose();
          if (action === 'resize') {
            rig.setFramebufferEpoch(2);
            actionPending = rig.presenter.resize({ reason: 'queued-after-warm-submit' });
          }
        });
      };
      rig.device.queue.onSubmittedWorkDone = () => {
        trace.push('fence');
        return fence.promise;
      };
      redraw = rig.presenter.redraw({ reason: 'warm-submit-with-queued-invalidation' });
      await waitFor(() => trace.includes(action), 'queued invalidation runs');
      assert.equal(trace[0], 'fence', 'warm frame registers its fence before the queued invalidation');
      assert.equal(frameProofs(rig).length, 1);
      assert.equal(rig.presentationOpportunityCalls, opportunitiesBefore);
      fence.resolve();
      await redraw;
      await actionPending;
      if (action === 'resize') {
        assert.ok(frameProofs(rig).slice(1).every(value => value.workerFramebufferEpoch === 2));
        assert.equal(frameProofs(rig).at(-1).presentationQueueCompletionSerial,
          proof.presentationQueueCompletionSerial + 2,
          'invalidated warm attempt consumed a serial; only resized proof is published');
      } else {
        assert.equal(frameProofs(rig).length, 1);
        assert.equal(rig.presenter.getStatus().visibleGeneration, null);
        assert.equal(rig.presentationOpportunityCalls, opportunitiesBefore);
      }
    } finally {
      fence.resolve();
      await redraw;
      await actionPending;
      await rig.presenter.dispose();
    }
  });
}

test('native preparation keeps latest appearance and camera across an asynchronous source frame', async () => {
  const gate = deferred();
  let preparing = false;
  const prepared = [];
  const rig = createPresenterRig({ nativeMaterialOverrides: {
    async prepare(frame) {
      prepared.push(frame.nativeSurfaceAppearance);
      if (!preparing) { preparing = true; await gate.promise; }
    }
  } });
  const request = validRequest();
  await rig.presenter.enqueue({ request, retained: validRetained(), sphStep: 3 });
  await waitFor(() => preparing, 'native material preparation');
  request.nativeSurfaceMaterial.opticalTable.records[0] = 123;
  const appearance = { backgroundImageUrl: '/new-background.jpg',
    lightingProfile: { nativeDirectSuppression: 0.5 } };
  const update = rig.presenter.redraw({ nativeSurfaceAppearance: appearance,
    viewProjectionMatrix: viewProjectionWithTranslation(9), cameraPositionM: [3, 4, 5] });
  appearance.lightingProfile.nativeDirectSuppression = 1;
  gate.resolve();
  await waitFor(() => rig.presenter.getStatus().visibleGeneration === 1, 'prepared native frame');
  await update;
  assert.equal(prepared[0].opticalTable.records[0], 0, 'cold table detached before waiting');
  assert.equal(prepared.at(-1).lightingProfile.nativeDirectSuppression, 0.5);
  assert.equal(rig.drawnViewProjectionMatrices.at(-1)[12], 9);
  await rig.presenter.redraw({ cameraPositionM: [5, 4, 3] });
  assert.equal(prepared.at(-1).backgroundImageUrl, '/new-background.jpg');
  await rig.presenter.redraw({ nativeSurfaceAppearance: { backgroundImageUrl: null } });
  assert.equal(prepared.at(-1).backgroundImageUrl, null);
  await rig.presenter.dispose();
});

test('native refraction draws scene copy and own back depth before each front, vapor last', async () => {
  const surfaces = [
    { metadata: { transparencyClassId: 1, boundsCenterM: [0, 0, 0] } },
    { metadata: { transparencyClassId: 2, boundsCenterM: [0, 0, 2] } },
    { metadata: { transparencyClassId: 0, boundsCenterM: [0, 0, 0] } },
    { metadata: { transparencyClassId: 2, boundsCenterM: [0, 0, -2] } }
  ];
  const rig = createPresenterRig({ buildPresentationFrame: async job => ({
    generation: job.generation, invalidationEpoch: job.invalidationEpoch,
    sphStep: job.sphStep, receiptFields: job.receiptFields,
    viewProjectionMatrix: [...job.admission.viewProjectionMatrix],
    cameraPositionM: [...job.admission.cameraPositionM], surfaces
  }) });
  await rig.presenter.enqueue({ request: validRequest(), retained: validRetained(), sphStep: 1 });
  await waitFor(() => rig.presenter.getStatus().visibleGeneration === 1, 'native multi-pass frame');
  const draws = rig.materialCalls.filter(call => call.type === 'draw');
  assert.deepEqual(draws.map(call => surfaces.indexOf(call.surface)), [2, 3, 3, 1, 1, 0]);
  assert.deepEqual(draws.slice(1, 5).map(call => [!!call.options.backface, !!call.options.refractive]),
    [[true, false], [false, true], [true, false], [false, true]]);
  assert.equal(rig.materialCalls.filter(call => call.type === 'scene-copy').length, 2);
  assert.equal(rig.renderPasses.length, 6);
  assert.equal(rig.renderPasses[1].descriptor.colorAttachments.length, 0);
  assert.equal(rig.renderPasses.at(-1).actions.at(-2).type, 'overlay');
  rig.materialCalls.length = 0;
  await rig.presenter.redraw({ cameraPositionM: [1, 2, -3] });
  assert.deepEqual(rig.materialCalls.filter(call => call.type === 'draw')
    .map(call => surfaces.indexOf(call.surface)), [2, 1, 1, 3, 3, 0]);
  await rig.presenter.dispose();
});

test('missing native draw buffers fail instead of admitting a background-only mesh', async () => {
  const rig = createPresenterRig({
    nativeMaterialOverrides: { draw: () => false },
    buildPresentationFrame: async job => ({
      generation: job.generation, invalidationEpoch: job.invalidationEpoch,
      viewProjectionMatrix: [...job.admission.viewProjectionMatrix],
      cameraPositionM: [...job.admission.cameraPositionM], surfaces: [{ metadata: {} }]
    })
  });
  await rig.presenter.enqueue({ request: validRequest(), retained: validRetained(), sphStep: 1 });
  await waitFor(() => rig.terminals.some(t => t.status === ULG_WORKER_OFFSCREEN_RESIDENT_ISOSURFACE_PRESENTATION_FAILED_STATUS), 'failed native draw');
  assert.equal(queueSubmissionCount(rig), 0);
  assert.equal(rig.presenter.getStatus().visibleGeneration, null);
  await rig.presenter.dispose();
});

function queueSubmissionCount(rig) {
  return rig.submittedFrames.filter(Array.isArray).length;
}

function controlledTemporalTimers(t) {
  const pending = new Map();
  let serial = 0;
  t.mock.method(globalThis, 'setTimeout', (callback, delay, ...args) => {
    const handle = ++serial;
    pending.set(handle, { callback: () => callback(...args), delay });
    return handle;
  });
  t.mock.method(globalThis, 'clearTimeout', handle => pending.delete(handle));
  return {
    get pendingCount() { return pending.size; },
    get nextDelayMs() { return pending.values().next().value?.delay ?? null; },
    fireNext() {
      const next = pending.entries().next().value;
      assert.ok(next, 'an ordinary temporal pacing timer is pending');
      pending.delete(next[0]);
      next[1].callback();
    },
    fireLatest() {
      const latest = [...pending.entries()].at(-1);
      assert.ok(latest, 'a controlled timer is pending');
      pending.delete(latest[0]);
      latest[1].callback();
    }
  };
}

async function createControlledMotionRig(t, { nativeMaterialOverrides } = {}) {
  const timers = controlledTemporalTimers(t);
  let wallMs = 0;
  const rig = createPresenterRig({
    nativeMaterialOverrides,
    temporalNowMs: () => wallMs,
    buildPresentationFrame: async job => ({
      generation: job.generation, invalidationEpoch: job.invalidationEpoch,
      sphStep: job.sphStep, receiptFields: job.receiptFields,
      viewProjectionMatrix: [...job.admission.viewProjectionMatrix],
      cameraPositionM: [...job.admission.cameraPositionM], surfaces: [],
      motionField: { buffer: new GPUBuffer(128, 128), rowCount: 8, destroy() {} }
    })
  });
  const enqueue = (sphStep, time) => {
    const retained = validRetained();
    retained.sphParticleUpload.time = time;
    return rig.presenter.enqueue({ request: validRequest(), retained, sphStep,
      receiptFields: { laneId: 'lane', stateKey: 'state', sphStep } });
  };
  await enqueue(63, 0.064);
  await waitFor(() => rig.presenter.getStatus().visibleSphStep === 63, 'first controlled source');
  wallMs = 1000;
  await enqueue(127, 0.128);
  await waitFor(() => rig.presenter.getStatus().visibleSphStep === 127, 'paced controlled source');
  assert.equal(timers.pendingCount, 1);
  return { rig, timers, enqueue, setWallMs(value) { wallMs = value; } };
}

function createControlledBootstrapRig(t, { captureRenderRows, nativeMaterialOverrides, presentationPauseClock } = {}) {
  const timers = controlledTemporalTimers(t);
  let wallMs = 1000;
  const builtFrames = [];
  const capturedJobs = [];
  const receiptFields = {
    laneId: 'lane', stateKey: 'state', scheduleId: 'first-schedule',
    presentationLaneEpoch: 2, residentExecutionGeneration: 7,
    sphStep: 63, stepOrdinal: 64,
    residentScheduleCandidatePresentation: true,
    stateManagerCommittedPresentation: true,
    committedPresentationSchema:
      'peercompute.ulg.presentation-worker-committed-resident-schedule-presentation.v0',
    committedPresentationStatus:
      'state-manager-committed-resident-schedule-presentation-admission',
    authorityStatus: 'state-manager-committed-worker-schedule',
    computeManagerCompletionSchema:
      'peercompute.ulg.schroeder-worker-lane-compute-manager-completion.v0',
    computeManagerLeaseId: 'lease:first-schedule',
    computeManagerLeaseStatus: 'completed', computeManagerFenceSatisfied: true,
    stateManagerCommitStatus: 'committed', stateManagerCommitAccepted: true,
    terminalScheduleFence: true, terminalFenceSatisfied: true,
    terminalFenceAuthorityAdmissionReady: true,
    terminalFenceScope: 'resident-schedule-terminal'
  };
  const sourceLineage = {
    storageGeneration: 7, physicsTick: 0, physicsSubstep: 0,
    positionEpoch: 0, topologyEpoch: 0, chartEpoch: 0, levelEpoch: 0,
    supportEpoch: 0
  };
  const bootstrap = {
    schema: 'peercompute.ulg.isosurface-source-timing-bootstrap.v0',
    scheduleId: receiptFields.scheduleId, laneId: receiptFields.laneId,
    stateKey: receiptFields.stateKey,
    presentationLaneEpoch: receiptFields.presentationLaneEpoch,
    candidateVersion: { residentExecutionGeneration: 7, nextStep: 63,
      scheduleId: receiptFields.scheduleId, stepOrdinal: 64 },
    sourceTimeS: 0, sourceObservedAtMs: 1000, terminalSourceTimeS: 0.064,
    sourceLineage,
    targetLineage: { ...sourceLineage, physicsTick: 64, positionEpoch: 64 }
  };
  const rig = createPresenterRig({
    temporalNowMs: () => wallMs,
    presentationPauseClock,
    captureRenderRows,
    nativeMaterialOverrides,
    buildPresentationFrame: async job => {
      capturedJobs.push(job);
      const frame = {
        generation: job.generation, invalidationEpoch: job.invalidationEpoch,
        sphStep: job.sphStep, sourceTimeS: job.sourceTimeS, receiptFields: job.receiptFields,
        viewProjectionMatrix: [...job.admission.viewProjectionMatrix],
        cameraPositionM: [...job.admission.cameraPositionM], surfaces: [],
        motionField: { buffer: new GPUBuffer(128, 128), rowCount: 8, destroy() {} }
      };
      builtFrames.push(frame);
      return frame;
    }
  });
  const enqueue = ({ sphStep = 63, time = 0.064,
    sourceTimingBootstrap = bootstrap, receipt = receiptFields } = {}) => {
    const retained = validRetained();
    retained.sphParticleUpload.time = time;
    return rig.presenter.enqueue({ request: validRequest(), retained, sphStep,
      sourceTimingBootstrap, receiptFields: receipt });
  };
  return { rig, timers, bootstrap, receiptFields, builtFrames, capturedJobs,
    enqueue, setWallMs(value) { wallMs = value; } };
}

function pendingSourceScope(overrides = {}) {
  return { scheduleId: 'next-schedule', laneId: 'lane', stateKey: 'state',
    presentationLaneEpoch: 2, sourceTimeS: 0.064, totalStepCount: 64, ...overrides };
}

function pendingSourceProgress(step, overrides = {}) {
  return { scheduleId: 'next-schedule', stepOrdinal: step,
    completedStepCount: step, ...overrides };
}

async function createPendingSourceMotionRig(t) {
  const state = createControlledBootstrapRig(t);
  state.setWallMs(3000);
  await state.enqueue();
  await waitFor(() => state.rig.presenter.getStatus().visibleSphStep === 63,
    'admitted source for pending progress');
  assert.equal(state.timers.pendingCount, 1);
  return state;
}

test('pending source progress preserves real motion beyond the old wall horizon without drawing or publishing progress', async t => {
  const { rig, timers, setWallMs, builtFrames } = await createPendingSourceMotionRig(t);
  try {
    const frame = builtFrames[0];
    const originalPacing = frame.motionPacing;
    const progress = rig.presenter.beginPendingSourceProgress(pendingSourceScope());
    assert.equal(typeof progress, 'function');
    const before = { submissions: queueSubmissionCount(rig), proofs: frameProofs(rig).length,
      terminals: rig.terminals.length, opportunities: rig.presentationOpportunityCalls };
    setWallMs(4000);
    assert.equal(progress(pendingSourceProgress(16)), true,
      'one second for 16 of 64 iterations forecasts three remaining wall seconds');
    assert.notEqual(frame.motionPacing, originalPacing);
    assert.equal(frame.motionPacing.segmentAnchorAtMs, 4000);
    assert.equal(frame.motionPacing.segmentAnchorAgeS, 0.032);
    assert.equal(frame.motionPacing.maxSimulationAgeS, 0.064);
    assert.equal(frame.motionPacing.maxWallAgeS, 2);
    assert.equal(frame.motionPacing.startedAtMs, 3000);
    assert.equal(frame.motionPacing.observedWallSecondsPerSimulationSecond,
      originalPacing.observedWallSecondsPerSimulationSecond);
    assert.deepEqual({ submissions: queueSubmissionCount(rig), proofs: frameProofs(rig).length,
      terminals: rig.terminals.length, opportunities: rig.presentationOpportunityCalls }, before,
    'iteration progress is not a GPU draw, observer opportunity or admission proof');
    assert.equal(rig.presenter.getStatus().temporalMotionAgeS, 0,
      'only an admitted frame changes displayed age');
    setWallMs(5000);
    timers.fireNext();
    await waitFor(() => rig.presenter.getStatus().temporalMotionAgeS > 0,
      'real draw beyond the original source deadline');
    const firstAge = rig.presenter.getStatus().temporalMotionAgeS;
    assert.ok(firstAge < 0.064);
    setWallMs(5312);
    timers.fireNext();
    await waitFor(() => rig.presenter.getStatus().temporalMotionAgeS > firstAge,
      'continued permitted movement during 312 ms source jitter');
    assert.ok(rig.presenter.getStatus().temporalMotionAgeS < 0.064);
    const proof = frameProofs(rig).at(-1);
    assert.equal(proof.sphStep, 63);
    assert.equal(proof.isosurfacePresentationSourceTimeS, 0.064);
    assert.equal(proof.authoritativeStateMutation, false);
    assert.equal(proof.physicsQueuePrefixCoverage, 'physics-queue-prefix-not-attributed');
    setWallMs(7000);
    timers.fireNext();
    await waitFor(() => rig.presenter.getStatus().temporalMotionAgeS === 0.064,
      'finite retimed horizon');
    assert.equal(timers.pendingCount, 0);
    assert.equal(progress(pendingSourceProgress(32)), false,
      'late pending work cannot restart a spent motion interval');
    assert.equal(timers.pendingCount, 0);
  } finally { await rig.presenter.dispose(); }
});

test('pending progress rejects malformed scope while valid unmatched scope waits without touching the current frame', async t => {
  const { rig, builtFrames, setWallMs } = await createPendingSourceMotionRig(t);
  try {
    for (const change of [
      { scheduleId: '' }, { scheduleId: 1 }, { laneId: '' }, { stateKey: null },
      ...[undefined, 0, -1, 1.5, '2', NaN, Infinity].map(presentationLaneEpoch => ({ presentationLaneEpoch })),
      ...[null, '0.064', -1, NaN, Infinity].map(sourceTimeS => ({ sourceTimeS })),
      ...[null, 0, 1, -1, 1.5, '64', Infinity].map(totalStepCount => ({ totalStepCount }))
    ]) {
      assert.equal(rig.presenter.beginPendingSourceProgress(pendingSourceScope(change)), null,
        JSON.stringify(change));
    }
    const frame = builtFrames[0];
    const originalPacing = frame.motionPacing;
    for (const change of [{ laneId: 'other' }, { stateKey: 'other' },
      { presentationLaneEpoch: 3 }, { sourceTimeS: 0.128 }]) {
      setWallMs(3500);
      const progress = rig.presenter.beginPendingSourceProgress(pendingSourceScope(change));
      assert.equal(typeof progress, 'function');
      setWallMs(4000);
      assert.equal(progress(pendingSourceProgress(16)), false);
      assert.equal(frame.motionPacing, originalPacing);
    }
  } finally { await rig.presenter.dispose(); }
});

test('pending progress consumes only advancing matching iteration observations and never accelerates or replays them', async t => {
  const { rig, builtFrames, setWallMs } = await createPendingSourceMotionRig(t);
  try {
    const frame = builtFrames[0];
    const scope = pendingSourceScope();
    const progress = rig.presenter.beginPendingSourceProgress(scope);
    scope.scheduleId = 'mutated'; scope.totalStepCount = 100000;
    setWallMs(4000);
    assert.equal(progress(pendingSourceProgress(16)), true, 'scope scalars were captured at begin');
    const slowed = frame.motionPacing;
    for (const value of [null, {}, pendingSourceProgress(16), pendingSourceProgress(15),
      pendingSourceProgress(17, { scheduleId: 'other' }),
      pendingSourceProgress(17, { completedStepCount: 16 }),
      ...[0, -1, 17.5, '17', NaN, Infinity, 65].map(step => pendingSourceProgress(step))]) {
      assert.equal(progress(value), false);
      assert.equal(frame.motionPacing, slowed);
    }
    for (const at of [3999, NaN, Infinity]) {
      setWallMs(at);
      assert.equal(progress(pendingSourceProgress(17)), false);
      assert.equal(frame.motionPacing, slowed);
    }
    setWallMs(4100);
    assert.equal(progress(pendingSourceProgress(32)), false,
      'a shorter remaining estimate cannot speed up current motion');
    setWallMs(4500);
    assert.equal(progress(pendingSourceProgress(32)), false,
      'an accepted no-op observation still consumes its ordinal');
    assert.equal(frame.motionPacing, slowed);
    assert.equal(progress(pendingSourceProgress(64)), false, 'terminal observation closes without retiming');
    assert.equal(progress(pendingSourceProgress(48)), false);
    assert.equal(frame.motionPacing, slowed);
  } finally { await rig.presenter.dispose(); }
});

test('pending progress can bind a matching mesh after capture without retiming an earlier source', async t => {
  const { rig, builtFrames, setWallMs, enqueue, receiptFields } = await createPendingSourceMotionRig(t);
  try {
    const oldFrame = builtFrames[0];
    const oldPacing = oldFrame.motionPacing;
    const progress = rig.presenter.beginPendingSourceProgress(pendingSourceScope({ sourceTimeS: 0.128 }));
    assert.equal(typeof progress, 'function');
    setWallMs(3500);
    assert.equal(progress(pendingSourceProgress(8)), false);
    assert.equal(oldFrame.motionPacing, oldPacing);
    setWallMs(4000);
    await enqueue({ sphStep: 127, time: 0.128, sourceTimingBootstrap: null,
      receipt: { ...receiptFields, sphStep: 127 } });
    await waitFor(() => rig.presenter.getStatus().visibleSphStep === 127, 'matching pending source mesh');
    const newFrame = builtFrames[1];
    const newPacing = newFrame.motionPacing;
    setWallMs(4500);
    assert.equal(progress(pendingSourceProgress(16)), true);
    assert.notEqual(newFrame.motionPacing, newPacing);
    assert.equal(oldFrame.motionPacing, oldPacing);
    assert.equal(newFrame.motionPacing.sourceTimeS, 0.128);
  } finally { await rig.presenter.dispose(); }
});

test('a valid pending tracker may begin before any mesh and does not manufacture first-source timing', async t => {
  const { rig, builtFrames, setWallMs, enqueue } = createControlledBootstrapRig(t);
  try {
    const progress = rig.presenter.beginPendingSourceProgress(pendingSourceScope());
    assert.equal(typeof progress, 'function');
    setWallMs(2000);
    assert.equal(progress(pendingSourceProgress(8)), false);
    assert.equal(queueSubmissionCount(rig), 0);
    assert.equal(frameProofs(rig).length, 0);
    setWallMs(3000);
    await enqueue();
    await waitFor(() => rig.presenter.getStatus().visibleSphStep === 63, 'first mesh for deferred tracker');
    const originalPacing = builtFrames[0].motionPacing;
    setWallMs(4000);
    assert.equal(progress(pendingSourceProgress(16)), true);
    assert.notEqual(builtFrames[0].motionPacing, originalPacing);
    assert.equal(builtFrames[0].motionPacing.pacingMethod, 'seeded-source-interval-bootstrap');
    assert.equal(builtFrames[0].motionPacing.sourceTimeS, 0.064);
    assert.equal(builtFrames[0].motionPacing.maxSimulationAgeS, 0.064);
  } finally { await rig.presenter.dispose(); }
});

for (const action of ['clear', 'resize', 'dispose', 'replacement', 'new-tracker']) {
  test(`a bound pending progress tracker cannot survive ${action}`, async t => {
    const { rig, builtFrames, setWallMs, enqueue, receiptFields } = await createPendingSourceMotionRig(t);
    try {
      const frame = builtFrames[0];
      const progress = rig.presenter.beginPendingSourceProgress(pendingSourceScope());
      setWallMs(4000);
      assert.equal(progress(pendingSourceProgress(16)), true);
      const boundPacing = frame.motionPacing;
      if (action === 'clear') rig.presenter.clear();
      if (action === 'dispose') await rig.presenter.dispose();
      if (action === 'resize') {
        rig.setFramebufferEpoch(2);
        await rig.presenter.resize();
      }
      if (action === 'replacement') {
        await enqueue({ sphStep: 127, time: 0.128, sourceTimingBootstrap: null,
          receipt: { ...receiptFields, sphStep: 127 } });
        await waitFor(() => rig.presenter.getStatus().visibleSphStep === 127, 'replacement invalidates tracker');
      }
      if (action === 'new-tracker') {
        assert.equal(typeof rig.presenter.beginPendingSourceProgress(
          pendingSourceScope({ scheduleId: 'newer-schedule' })), 'function');
      }
      const submissions = queueSubmissionCount(rig);
      const proofs = frameProofs(rig).length;
      setWallMs(4500);
      assert.equal(progress(pendingSourceProgress(17)), false);
      assert.equal(frame.motionPacing, boundPacing);
      assert.equal(queueSubmissionCount(rig), submissions);
      assert.equal(frameProofs(rig).length, proofs);
    } finally { await rig.presenter.dispose(); }
  });
}

for (const action of ['clear', 'resize']) {
  test(`pending source invalidation before deferred binding survives ${action} and later mesh arrival`, async t => {
    const { rig, builtFrames, setWallMs, enqueue } = createControlledBootstrapRig(t);
    try {
      const progress = rig.presenter.beginPendingSourceProgress(pendingSourceScope());
      assert.equal(typeof progress, 'function');
      if (action === 'clear') rig.presenter.clear();
      else { rig.setFramebufferEpoch(2); await rig.presenter.resize(); }
      setWallMs(3000);
      await enqueue();
      await waitFor(() => rig.presenter.getStatus().visibleSphStep === 63, 'post-invalidation first mesh');
      const pacing = builtFrames[0].motionPacing;
      setWallMs(4000);
      assert.equal(progress(pendingSourceProgress(16)), false);
      assert.equal(builtFrames[0].motionPacing, pacing);
    } finally { await rig.presenter.dispose(); }
  });
}

test('progress retiming during an in-flight ordinary frame neither admits it early nor rewinds its successor', async t => {
  const { rig, timers, setWallMs } = await createPendingSourceMotionRig(t);
  const fence = deferred();
  try {
    const progress = rig.presenter.beginPendingSourceProgress(pendingSourceScope());
    const proofsBefore = frameProofs(rig).length;
    const submitsBefore = queueSubmissionCount(rig);
    rig.setQueueCompletion(fence.promise);
    setWallMs(4000);
    timers.fireNext();
    await waitFor(() => queueSubmissionCount(rig) === submitsBefore + 1, 'ordinary frame awaiting exact GPU fence');
    setWallMs(4200);
    assert.equal(progress(pendingSourceProgress(16)), true);
    assert.equal(frameProofs(rig).length, proofsBefore);
    assert.equal(rig.presenter.getStatus().temporalMotionAgeS, 0);
    rig.setQueueCompletion(Promise.resolve());
    fence.resolve();
    await waitFor(() => frameProofs(rig).length >= proofsBefore + 1 && timers.pendingCount === 1,
      'pre-retime encoded frame admission and ordinary loop pacing');
    const firstAge = frameProofs(rig)[proofsBefore].isosurfacePresentationMotionAgeS;
    assert.equal(firstAge, 0.032);
    // The overdue ordinary loop may already have presented the new segment's
    // anchor before returning to its timer. That real extra frame is allowed.
    const proofsAfterFence = frameProofs(rig).length;
    setWallMs(4300);
    timers.fireNext();
    await waitFor(() => frameProofs(rig).length === proofsAfterFence + 1, 'retimed successor admission');
    assert.ok(rig.presenter.getStatus().temporalMotionAgeS > firstAge);
    assert.ok(rig.presenter.getStatus().temporalMotionAgeS < 0.064);
    const ages = frameProofs(rig).slice(proofsBefore).map(proof => proof.isosurfacePresentationMotionAgeS);
    assert.ok(ages.every((age, i) => i === 0 || age >= ages[i - 1]));
    assert.equal(frameProofs(rig).at(-1).presentationQueueCompletionSerial,
      frameProofs(rig).at(-2).presentationQueueCompletionSerial + 1);
  } finally { fence.resolve(); await rig.presenter.dispose(); }
});

test('bootstrap first-mesh motion starts at real presentation admission, stops at its cap, and keeps explicit camera redraws', async t => {
  const { rig, timers, enqueue, setWallMs, builtFrames } = createControlledBootstrapRig(t);
  const opportunity = deferred();
  rig.setPresentationOpportunity(() => opportunity.promise);
  try {
    await enqueue();
    await waitFor(() => rig.presentationOpportunityCalls === 1, 'first mesh observer wait');
    assert.equal(rig.presenter.getStatus().visibleSphStep, null);
    assert.equal(rig.presenter.getStatus().temporalMotionReady, false);
    assert.equal(timers.pendingCount, 0);
    assert.equal(frameProofs(rig).length, 0);
    assert.equal(rig.terminals.length, 0);
    setWallMs(3000);
    rig.setPresentationOpportunity(admittedPresentationOpportunity);
    opportunity.resolve(admittedPresentationOpportunity());
    await waitFor(() => rig.presenter.getStatus().visibleSphStep === 63, 'first admitted mesh');
    assert.equal(timers.pendingCount, 1);
    assert.equal(rig.presenter.getStatus().temporalMotionReady, true);
    assert.equal(rig.presenter.getStatus().temporalMotionAgeS, 0);
    assert.equal(builtFrames[0].motionPacing.startedAtMs, 3000);
    assert.equal(builtFrames[0].motionPacing.maxWallAgeS, 2);
    const firstProof = frameProofs(rig).at(-1);
    const sourceSubmissions = queueSubmissionCount(rig);
    setWallMs(3500);
    timers.fireNext();
    await waitFor(() => rig.presenter.getStatus().temporalMotionAgeS === 0.016,
      'first source autonomous motion');
    const movingProof = frameProofs(rig).at(-1);
    assert.equal(queueSubmissionCount(rig), sourceSubmissions + 1);
    assert.equal(movingProof.isosurfacePresentationSourceTimeS, 0.064);
    assert.equal(movingProof.sphStep, 63);
    assert.equal(movingProof.isosurfaceTemporalPresentation, true);
    assert.equal(movingProof.isosurfacePresentationMotionAgeS, 0.016);
    assert.equal(movingProof.authoritativeStateMutation, false);
    assert.equal(movingProof.physicsQueuePrefixCoverage, 'physics-queue-prefix-not-attributed');
    assert.equal(movingProof.presentationQueueCompletionSerial,
      firstProof.presentationQueueCompletionSerial + 1);
    setWallMs(5000);
    timers.fireNext();
    await waitFor(() => rig.presenter.getStatus().temporalMotionAgeS === 0.064,
      'bounded first-source horizon');
    assert.equal(timers.pendingCount, 0, 'a spent bootstrap horizon cannot spin');
    const camera = validRequest().viewProjectionMatrix.slice();
    camera[12] = 2;
    const atCap = queueSubmissionCount(rig);
    setWallMs(9000);
    await rig.presenter.redraw({ viewProjectionMatrix: camera, reason: 'camera-after-bootstrap-cap' });
    assert.equal(queueSubmissionCount(rig), atCap + 1);
    assert.equal(rig.presenter.getStatus().temporalMotionAgeS, 0.064);
    assert.deepEqual(rig.drawnViewProjectionMatrices.at(-1), [...camera]);
    assert.equal(timers.pendingCount, 0);
  } finally {
    opportunity.resolve(admittedPresentationOpportunity());
    await rig.presenter.dispose();
  }
});

for (const [label, change] of [
  ['missing', state => { state.evidence = null; }],
  ['malformed', state => { state.evidence.sourceObservedAtMs = '1000'; }],
  ['mixed scope', state => { state.evidence.laneId = 'other'; }],
  ['uncommitted', state => { state.receiptFields.stateManagerCommittedPresentation = false; }],
  ['nonadvancing lineage', state => { state.evidence.targetLineage.physicsTick = 0; }],
  ['future source clock', state => { state.evidence.sourceObservedAtMs = 4000; }]
]) {
  test(`bootstrap ${label} evidence leaves admitted geometry static instead of rejecting it`, async t => {
    const state = createControlledBootstrapRig(t);
    const { rig, timers, enqueue, setWallMs } = state;
    state.evidence = state.bootstrap;
    change(state);
    try {
      setWallMs(3000);
      await enqueue({ sourceTimingBootstrap: state.evidence });
      await waitFor(() => rig.presenter.getStatus().visibleSphStep === 63, 'static first mesh');
      assert.equal(frameProofs(rig).length, 1);
      assert.equal(frameProofs(rig)[0].presentationFrameAdmitted, true);
      assert.equal(rig.presenter.getStatus().temporalMotionReady, false);
      assert.equal(rig.presenter.getStatus().temporalMotionAgeS, 0);
      assert.equal(timers.pendingCount, 0);
      assert.equal(rig.terminals.some(value => value.status
        === ULG_WORKER_OFFSCREEN_RESIDENT_ISOSURFACE_PRESENTATION_FAILED_STATUS), false);
    } finally {
      await rig.presenter.dispose();
    }
  });
}

for (const validAtEnqueue of [true, false]) {
  test(`bootstrap evidence is snapshotted before capture (${validAtEnqueue ? 'valid stays valid' : 'invalid stays static'})`, async t => {
    const capture = deferred();
    let captureStarted = false;
    const { rig, timers, bootstrap, enqueue, setWallMs, capturedJobs } = createControlledBootstrapRig(t, {
      captureRenderRows: () => { captureStarted = true; return capture.promise; }
    });
    const original = structuredClone(bootstrap);
    if (!validAtEnqueue) bootstrap.schema = 'not-authorized';
    try {
      const enqueued = enqueue();
      await waitFor(() => captureStarted, 'held first-source capture');
      if (validAtEnqueue) {
        bootstrap.sourceObservedAtMs = 1e9;
        bootstrap.sourceTimeS = 1e9;
        bootstrap.candidateVersion.nextStep = 999;
        bootstrap.sourceLineage.physicsTick = 999;
        bootstrap.targetLineage.physicsTick = 0;
      } else {
        bootstrap.schema = original.schema;
      }
      setWallMs(3000);
      capture.resolve({ destroyRenderRowsBuffer() {} });
      await enqueued;
      await waitFor(() => rig.presenter.getStatus().visibleSphStep === 63, 'captured first source');
      assert.equal(rig.presenter.getStatus().temporalMotionReady, validAtEnqueue);
      assert.equal(timers.pendingCount, validAtEnqueue ? 1 : 0);
      if (validAtEnqueue) {
        const snapshot = capturedJobs[0].sourceTimingBootstrap;
        assert.deepEqual(snapshot, original);
        for (const value of [snapshot, snapshot.candidateVersion,
          snapshot.sourceLineage, snapshot.targetLineage]) assert.ok(Object.isFrozen(value));
        setWallMs(3500);
        timers.fireNext();
        await waitFor(() => rig.presenter.getStatus().temporalMotionAgeS === 0.016,
          'motion from the private original timing');
      }
    } finally {
      capture.resolve({ destroyRenderRowsBuffer() {} });
      await rig.presenter.dispose();
    }
  });
}

test('bootstrap gives way to actual inter-presentation pacing on the second source and normal jitter on the third', async t => {
  const { rig, timers, bootstrap, receiptFields, enqueue, setWallMs, builtFrames } = createControlledBootstrapRig(t);
  try {
    setWallMs(3000);
    await enqueue();
    await waitFor(() => rig.presenter.getStatus().visibleSphStep === 63, 'bootstrapped source');
    assert.equal(builtFrames[0].motionPacing.pacingMethod, 'seeded-source-interval-bootstrap');
    setWallMs(4000);
    await enqueue({ sphStep: 127, time: 0.128, sourceTimingBootstrap: bootstrap,
      receipt: { ...receiptFields, sphStep: 127, scheduleId: 'second-schedule' } });
    await waitFor(() => rig.presenter.getStatus().visibleSphStep === 127, 'second real source');
    assert.equal(builtFrames[1].motionPacing.pacingMethod, 'two-source-interval-jitter-budget');
    assert.ok(Math.abs(builtFrames[1].motionPacing.maxWallAgeS - 1) < 1e-12);
    assert.equal(timers.pendingCount, 1);
    setWallMs(4500);
    timers.fireNext();
    await waitFor(() => rig.presenter.getStatus().temporalMotionAgeS === 0.032,
      'motion using only the actual second presentation interval');
    assert.equal(frameProofs(rig).at(-1).isosurfacePresentationSourceTimeS, 0.128);
    setWallMs(5500);
    await enqueue({ sphStep: 191, time: 0.192, sourceTimingBootstrap: null,
      receipt: { ...receiptFields, sphStep: 191, scheduleId: 'third-schedule' } });
    await waitFor(() => rig.presenter.getStatus().visibleSphStep === 191, 'third real source');
    assert.ok(Math.abs(builtFrames[2].motionPacing.maxWallAgeS - 2) < 1e-12);
    assert.ok(Math.abs(builtFrames[2].motionPacing.maxSimulationAgeS - 0.064) < 1e-12);
    assert.equal(timers.pendingCount, 1);
  } finally {
    await rig.presenter.dispose();
  }
});

test('bootstrap source timing survives a framebuffer-only resize without resetting the motion horizon', async t => {
  const { rig, timers, enqueue, setWallMs, builtFrames } = createControlledBootstrapRig(t);
  try {
    setWallMs(3000);
    await enqueue();
    await waitFor(() => rig.presenter.getStatus().visibleSphStep === 63, 'first resize source');
    const pacing = builtFrames[0].motionPacing;
    rig.setFramebufferEpoch(2);
    setWallMs(3500);
    await rig.presenter.resize({ reason: 'bootstrap-framebuffer-only-resize' });
    await waitFor(() => rig.presenter.getStatus().temporalMotionAgeS === 0.016,
      'continued first-source motion after resize');
    assert.equal(rig.presenter.getStatus().visibleSphStep, 63);
    assert.equal(rig.presenter.getStatus().temporalMotionReady, true);
    assert.equal(pacing.startedAtMs, 3000);
    assert.equal(pacing.maxWallAgeS, 2);
    assert.equal(timers.pendingCount, 1);
    setWallMs(4000);
    timers.fireNext();
    await waitFor(() => rig.presenter.getStatus().temporalMotionAgeS === 0.032,
      'unchanged bootstrap clock after resize');
    assert.equal(frameProofs(rig).at(-1).isosurfacePresentationSourceTimeS, 0.064);
    assert.equal(frameProofs(rig).at(-1).workerFramebufferEpoch, 2);
  } finally {
    await rig.presenter.dispose();
  }
});

for (const action of ['clear', 'dispose']) {
  test(`bootstrap first-source observer cannot resurrect a frame after ${action}`, async t => {
    const { rig, timers, enqueue, setWallMs } = createControlledBootstrapRig(t);
    const opportunity = deferred();
    rig.setPresentationOpportunity(() => opportunity.promise);
    let disposing = null;
    try {
      await enqueue();
      await waitFor(() => rig.presentationOpportunityCalls === 1, 'first-source observer');
      if (action === 'clear') rig.presenter.clear();
      else disposing = rig.presenter.dispose();
      setWallMs(3000);
      opportunity.resolve(admittedPresentationOpportunity());
      await waitFor(() => rig.presenter.getStatus().running === false, 'retired first-source build');
      assert.equal(rig.presenter.getStatus().visibleSphStep, null);
      assert.equal(rig.presenter.getStatus().temporalMotionReady, false);
      assert.equal(frameProofs(rig).length, 0);
      assert.equal(timers.pendingCount, 0);
      await disposing;
    } finally {
      opportunity.resolve(admittedPresentationOpportunity());
      await rig.presenter.dispose();
    }
  });
}

function timedOutPresentationOpportunity() {
  return { available: false, method: 'worker-request-animation-frame-timeout' };
}

test('explicit isosurface pause freezes admitted age and camera redraws; resume spends only the remaining interval', async t => {
  const { rig, timers, enqueue, setWallMs, builtFrames } = createControlledBootstrapRig(t);
  try {
    setWallMs(3000);
    await enqueue();
    await waitFor(() => rig.presenter.getStatus().visibleSphStep === 63, 'source admitted');
    setWallMs(4000);
    timers.fireNext();
    await waitFor(() => rig.presenter.getStatus().temporalMotionAgeS === 0.032, 'admitted motion before pause');
    const frame = builtFrames[0];
    const generation = rig.presenter.getStatus().generation;
    assert.equal(rig.presenter.setPresentationPlaying(false), true);
    assert.equal(rig.presenter.setPresentationPlaying(false), false);
    assert.equal(timers.pendingCount, 0);
    assert.equal(rig.presenter.hasSubmissionBoundaryOpportunity(), false);
    setWallMs(10000);
    assert.equal(await rig.presenter.redraw({ viewProjectionMatrix: viewProjectionWithTranslation(4) }), true);
    assert.equal(frame.lastDisplayedMotionAgeS, 0.032);
    assert.equal(frame.sourcePresentedAtMs, 3000, 'admission remains an actual wall timestamp');
    assert.equal(rig.presenter.getStatus().generation, generation);
    assert.equal(rig.presenter.setPresentationPlaying(true), true);
    assert.equal(rig.presenter.setPresentationPlaying(true), false);
    setWallMs(10500);
    timers.fireNext();
    await waitFor(() => Math.abs(rig.presenter.getStatus().temporalMotionAgeS - 0.048) < 1e-12,
      'resume starts from admitted age, not elapsed paused wall time');
    setWallMs(11000);
    timers.fireNext();
    await waitFor(() => rig.presenter.getStatus().temporalMotionAgeS === 0.064, 'original source cap exhausted');
    rig.presenter.setPresentationPlaying(false);
    setWallMs(20000);
    const submissions = queueSubmissionCount(rig);
    rig.presenter.setPresentationPlaying(true);
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(queueSubmissionCount(rig), submissions);
    assert.equal(timers.pendingCount, 0, 'pause/resume cannot renew an exhausted cap');
  } finally { await rig.presenter.dispose(); }
});

test('ordinary source admission while explicitly paused stays at age zero and schedules no motion', async t => {
  const { rig, timers, enqueue, setWallMs } = createControlledBootstrapRig(t);
  try {
    assert.equal(rig.presenter.setPresentationPlaying(false), true);
    for (const malformed of [null, undefined, 0, 1, 'false']) {
      assert.throws(() => rig.presenter.setPresentationPlaying(malformed), TypeError);
    }
    setWallMs(3000);
    await enqueue();
    await waitFor(() => rig.presenter.getStatus().visibleSphStep === 63, 'paused committed source');
    assert.equal(rig.presenter.getStatus().temporalMotionAgeS, 0);
    assert.equal(rig.presenter.getStatus().presentationPlaying, false);
    assert.equal(timers.pendingCount, 0);
    setWallMs(13000);
    const proofs = frameProofs(rig).length;
    assert.equal(await rig.presenter.presentSubmissionBoundary({ submissionOrdinal: 1,
      completedSubstepCount: 16, totalSubstepCount: 64, chunkStepCount: 16 }), false);
    assert.equal(frameProofs(rig).length, proofs);
    assert.equal(await rig.presenter.redraw({ viewProjectionMatrix: viewProjectionWithTranslation(2) }), true);
    assert.equal(rig.presenter.getStatus().temporalMotionAgeS, 0);
    assert.equal(timers.pendingCount, 0);
  } finally { await rig.presenter.dispose(); }
});

function admittedPresentationOpportunity() {
  return { available: true,
    method: 'worker-request-animation-frame-after-gpu-completion', observedAtMs: 1 };
}

for (const mode of ['autonomous', 'boundary']) {
  for (const stage of ['prepare', 'GPU fence', 'opportunity']) {
    test(`pause cancels ${mode} motion during ${stage} and restores submitted pixels to the admitted age`, async t => {
      const pending = deferred();
      let prepareBlocked = false;
      let prepareEntered = false;
      const drawnAges = [];
      const { rig, timers, enqueue, setWallMs, builtFrames } = createControlledBootstrapRig(t, {
        nativeMaterialOverrides: {
          async prepare() { if (prepareBlocked) { prepareEntered = true; await pending.promise; } },
          drawBackground(_pass, frame) { drawnAges.push(frame.drawMotionAgeS); }
        }
      });
      let boundary = null;
      try {
        setWallMs(3000);
        await enqueue();
        await waitFor(() => rig.presenter.getStatus().visibleSphStep === 63, 'initial frame admitted');
        setWallMs(3500);
        if (stage === 'prepare') prepareBlocked = true;
        if (stage === 'GPU fence') rig.setQueueCompletion(pending.promise);
        if (stage === 'opportunity') rig.setPresentationOpportunity(() => pending.promise);
        if (mode === 'autonomous') timers.fireNext();
        else boundary = rig.presenter.presentSubmissionBoundary({ submissionOrdinal: 1,
          completedSubstepCount: 16, totalSubstepCount: 64, chunkStepCount: 16 });
        await waitFor(() => stage === 'prepare' ? prepareEntered
          : stage === 'GPU fence' ? queueSubmissionCount(rig) === 2
            : rig.presentationOpportunityCalls === 2, 'pending motion boundary');
        const generation = rig.presenter.getStatus().generation;
        rig.presenter.setPresentationPlaying(false);
        assert.equal(builtFrames[0].lastDisplayedMotionAgeS, 0);
        setWallMs(15000);
        prepareBlocked = false;
        rig.setQueueCompletion(Promise.resolve());
        rig.setPresentationOpportunity(admittedPresentationOpportunity);
        pending.resolve(admittedPresentationOpportunity());
        if (boundary) assert.equal(await boundary, false);
        if (stage !== 'prepare') {
          await waitFor(() => rig.terminals.some(receipt => receipt.reason === 'worker-isosurface-pause-frozen-redraw'),
            'post-drain frozen raster repair');
          assert.deepEqual(drawnAges, [0, 0.016, 0], 'a revoked proof alone is not a frozen framebuffer');
          assert.equal(queueSubmissionCount(rig), 3);
        } else {
          await new Promise(resolve => setImmediate(resolve));
          assert.deepEqual(drawnAges, [0], 'cancelled preparation never submits motion pixels');
          assert.equal(queueSubmissionCount(rig), 1);
        }
        assert.equal(frameProofs(rig).every(proof => proof.isosurfacePresentationMotionAgeS === 0), true);
        assert.equal(rig.presenter.getStatus().temporalMotionAgeS, 0);
        assert.equal(rig.presenter.getStatus().generation, generation);
        assert.equal(timers.pendingCount, 0);
        assert.equal(rig.presenter.hasSubmissionBoundaryOpportunity(), false);
      } finally {
        pending.resolve(admittedPresentationOpportunity());
        await boundary;
        await rig.presenter.dispose();
      }
    });
  }
}

test('rapid pause and resume cannot publish old motion or let its frozen redraw overwrite resumed pixels', async t => {
  const drawnAges = [];
  const { rig, timers, enqueue, setWallMs } = createControlledBootstrapRig(t, {
    nativeMaterialOverrides: { drawBackground(_pass, frame) { drawnAges.push(frame.drawMotionAgeS); } }
  });
  const fence = deferred();
  try {
    setWallMs(3000);
    await enqueue();
    await waitFor(() => rig.presenter.getStatus().visibleSphStep === 63, 'source admitted');
    setWallMs(3500);
    rig.setQueueCompletion(fence.promise);
    timers.fireNext();
    await waitFor(() => queueSubmissionCount(rig) === 2, 'old playback motion submitted');
    rig.presenter.setPresentationPlaying(false);
    setWallMs(9000);
    rig.presenter.setPresentationPlaying(true);
    setWallMs(9500);
    timers.fireNext();
    rig.setQueueCompletion(Promise.resolve());
    fence.resolve();
    await waitFor(() => frameProofs(rig).length === 2, 'new playback motion admitted');
    assert.equal(queueSubmissionCount(rig), 3);
    assert.deepEqual(drawnAges, [0, 0.016, 0.016]);
    assert.equal(rig.terminals.some(receipt => receipt.reason === 'worker-isosurface-pause-frozen-redraw'), false);
    assert.equal(rig.presenter.getStatus().temporalMotionAgeS, 0.016);
    assert.equal(frameProofs(rig).at(-1).presentationQueueCompletionSerial, 3);
  } finally { fence.resolve(); await rig.presenter.dispose(); }
});

test('paused timeout recovery preserves source admission while excluding parked pause time from its arrival forecast', async t => {
  const { rig, timers, enqueue, setWallMs, builtFrames, receiptFields } = createControlledBootstrapRig(t);
  try {
    setWallMs(3000);
    await enqueue();
    await waitFor(() => rig.presenter.getStatus().visibleSphStep === 63, 'prior source admitted');
    setWallMs(4000);
    rig.setPresentationOpportunity(timedOutPresentationOpportunity);
    await enqueue({ sphStep: 127, time: 0.128, sourceTimingBootstrap: null,
      receipt: { ...receiptFields, sphStep: 127, scheduleId: 'paused-recovery-source' } });
    await waitFor(() => rig.presenter.getStatus().running === false, 'replacement parked');
    rig.presenter.setPresentationPlaying(false);
    setWallMs(14000);
    rig.setPresentationOpportunity(admittedPresentationOpportunity);
    assert.equal(await rig.presenter.redraw({ viewProjectionMatrix: viewProjectionWithTranslation(3) }), true);
    assert.equal(rig.presenter.getStatus().visibleSphStep, 127);
    assert.equal(rig.presenter.getStatus().temporalMotionAgeS, 0);
    assert.equal(timers.pendingCount, 0);
    assert.equal(builtFrames[0].sourcePresentedAtMs, 3000);
    assert.equal(builtFrames[1].sourcePresentedAtMs, 14000);
    assert.equal(builtFrames[1].motionPacing.maxWallAgeS, 1);
    assert.equal(builtFrames[1].motionPacing.maxSimulationAgeS, 0.064);
    setWallMs(15000);
    rig.presenter.setPresentationPlaying(true);
    setWallMs(15500);
    timers.fireNext();
    await waitFor(() => rig.presenter.getStatus().temporalMotionAgeS === 0.032, 'remaining recovery interval after resume');
  } finally { await rig.presenter.dispose(); }
});

function frameProofs(rig) {
  return rig.submittedFrames.filter(value => !Array.isArray(value));
}

test('a lazily created presenter uses prior worker pause history for a bootstrap anchored inside that pause', async t => {
  const presentationPauseClock = createPresentationPauseClock();
  presentationPauseClock.setPlaying(false, 500);
  const { rig, timers, enqueue, setWallMs, builtFrames, bootstrap } = createControlledBootstrapRig(t, {
    presentationPauseClock
  });
  try {
    // The worker replays its current state at creation without moving the
    // original pause boundary or inventing a default-true prior history.
    rig.presenter.setPresentationPlaying(false);
    assert.equal(presentationPauseClock.pausedAt(1000), 500);
    setWallMs(2000);
    presentationPauseClock.setPlaying(true, 2000);
    assert.equal(rig.presenter.setPresentationPlaying(true), true);
    setWallMs(3000);
    await enqueue({ sourceTimingBootstrap: { ...bootstrap, sourceObservedAtMs: 750 } });
    await waitFor(() => rig.presenter.getStatus().visibleSphStep === 63, 'bootstrap after pre-creation pause');
    assert.equal(builtFrames[0].sourcePresentedAtMs, 3000);
    assert.equal(builtFrames[0].motionPacing.startedAtMs, 3000);
    assert.equal(builtFrames[0].motionPacing.maxWallAgeS, 1,
      'the first interval excludes the paused overlap before presenter creation too');
    assert.equal(builtFrames[0].motionPacing.maxSimulationAgeS, 0.064);
    assert.equal(timers.pendingCount, 1);
    setWallMs(3500);
    timers.fireNext();
    await waitFor(() => rig.presenter.getStatus().temporalMotionAgeS === 0.032, 'motion uses shared active history');
  } finally { await rig.presenter.dispose(); }
});

test('unreconstructible paused bootstrap disables only its first pacing, not committed admission or the next measured pair', async t => {
  const { rig, timers, enqueue, setWallMs, bootstrap, builtFrames, receiptFields } = createControlledBootstrapRig(t);
  try {
    for (const [atMs, playing] of [[1000, false], [1500, true], [2000, false],
      [2500, true], [3000, false], [3500, true]]) {
      setWallMs(atMs);
      rig.presenter.setPresentationPlaying(playing);
    }
    setWallMs(4000);
    await enqueue({ sourceTimingBootstrap: { ...bootstrap, sourceObservedAtMs: 1750 } });
    await waitFor(() => rig.presenter.getStatus().visibleSphStep === 63, 'bootstrap source still admitted');
    assert.equal(builtFrames[0].sourcePresentedAtMs, 4000);
    assert.equal(builtFrames[0].motionPacing, null);
    assert.equal(timers.pendingCount, 0);
    setWallMs(5000);
    await enqueue({ sphStep: 127, time: 0.128, sourceTimingBootstrap: null,
      receipt: { ...receiptFields, sphStep: 127, scheduleId: 'measured-pair-after-unknown-bootstrap' } });
    await waitFor(() => rig.presenter.getStatus().visibleSphStep === 127, 'next source has measured active timing');
    assert.equal(builtFrames[1].motionPacing.maxWallAgeS, 1);
    assert.equal(builtFrames[1].motionPacing.maxSimulationAgeS, 0.064);
    assert.equal(timers.pendingCount, 1);
  } finally { await rig.presenter.dispose(); }
});

test('pause and resume cannot spend another parked-source retry or redraw its lower submitted predecessor', async t => {
  const drawnGenerations = [];
  const { rig, timers, enqueue, setWallMs, receiptFields } = createControlledBootstrapRig(t, {
    nativeMaterialOverrides: { drawBackground(_pass, frame) { drawnGenerations.push(frame.generation); } }
  });
  try {
    setWallMs(3000);
    await enqueue();
    await waitFor(() => rig.presenter.getStatus().visibleSphStep === 63, 'predecessor admitted');
    setWallMs(4000);
    rig.setPresentationOpportunity(timedOutPresentationOpportunity);
    await enqueue({ sphStep: 127, time: 0.128, sourceTimingBootstrap: null,
      receipt: { ...receiptFields, sphStep: 127, scheduleId: 'pause-does-not-retry' } });
    await waitFor(() => rig.presenter.getStatus().running === false, 'replacement parked');
    rig.presenter.setPresentationPlaying(false);
    setWallMs(14000);
    rig.setPresentationOpportunity(admittedPresentationOpportunity);
    rig.presenter.setPresentationPlaying(true);
    setWallMs(14500);
    if (timers.pendingCount > 0) timers.fireNext();
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(queueSubmissionCount(rig), 3);
    assert.deepEqual(drawnGenerations, [1, 2, 2]);
    assert.equal(frameProofs(rig).length, 1);
    assert.equal(rig.presenter.getStatus().recoverableGeneration, 2);
    assert.equal(await rig.presenter.redraw({ viewProjectionMatrix: viewProjectionWithTranslation(7) }), true);
    assert.equal(rig.presenter.getStatus().visibleSphStep, 127);
  } finally { await rig.presenter.dispose(); }
});

test('paused manual-step sources and framebuffer resizes remain frozen without resetting playback state', async t => {
  const drawnAges = [];
  const { rig, timers, enqueue, setWallMs, receiptFields } = createControlledBootstrapRig(t, {
    nativeMaterialOverrides: { drawBackground(_pass, frame) { drawnAges.push(frame.drawMotionAgeS); } }
  });
  try {
    rig.presenter.setPresentationPlaying(false);
    setWallMs(3000);
    await enqueue();
    await waitFor(() => rig.presenter.getStatus().visibleSphStep === 63, 'paused first manual source');
    setWallMs(10000);
    await enqueue({ sphStep: 127, time: 0.128, sourceTimingBootstrap: null,
      receipt: { ...receiptFields, sphStep: 127, scheduleId: 'manual-source' } });
    await waitFor(() => rig.presenter.getStatus().visibleSphStep === 127, 'paused manual-step admission');
    rig.setFramebufferEpoch(2);
    assert.equal(await rig.presenter.resize({ viewProjectionMatrix: viewProjectionWithTranslation(2) }), true);
    assert.equal(rig.presenter.getStatus().presentationPlaying, false);
    assert.equal(rig.presenter.getStatus().temporalMotionAgeS, 0);
    assert.equal(timers.pendingCount, 0);
    assert.equal(drawnAges.every(age => age === 0), true);
    rig.presenter.clear();
    setWallMs(12000);
    await enqueue();
    await waitFor(() => rig.presenter.getStatus().visibleSphStep === 63, 'post-clear source admitted while paused');
    assert.equal(rig.presenter.getStatus().presentationPlaying, false);
    assert.equal(timers.pendingCount, 0);
  } finally { await rig.presenter.dispose(); }
});

test('pending source forecasting subtracts explicit pause duration and never retimes while paused', async t => {
  const { rig, timers, builtFrames, setWallMs } = await createPendingSourceMotionRig(t);
  try {
    const progress = rig.presenter.beginPendingSourceProgress(pendingSourceScope());
    const frame = builtFrames[0];
    rig.presenter.setPresentationPlaying(false);
    setWallMs(13000);
    assert.equal(progress(pendingSourceProgress(16)), false);
    assert.equal(frame.motionPacing.segmentAnchorAtMs, undefined);
    rig.presenter.setPresentationPlaying(true);
    setWallMs(13500);
    const resumed = frame.motionPacing;
    assert.equal(progress(pendingSourceProgress(32)), false,
      'half a second of active work does not become ten seconds of delayed arrival');
    assert.equal(frame.motionPacing, resumed);
    assert.equal(timers.pendingCount, 1);
  } finally { await rig.presenter.dispose(); }
});

test('committed retry admits a first mesh only after one exact timeout recovery, then starts its temporal loop', async t => {
  const { rig, timers, enqueue, setWallMs, builtFrames, capturedJobs } = createControlledBootstrapRig(t);
  const retryOpportunity = deferred();
  let observations = 0;
  rig.setPresentationOpportunity(() => ++observations === 1
    ? timedOutPresentationOpportunity() : retryOpportunity.promise);
  try {
    setWallMs(3000);
    await enqueue();
    await waitFor(() => observations === 2, 'the one first-mesh retry observer');
    assert.equal(queueSubmissionCount(rig), 2);
    assert.equal(frameProofs(rig).length, 0);
    assert.equal(rig.terminals.length, 0);
    assert.equal(rig.presenter.getStatus().visibleGeneration, null);
    assert.equal(timers.pendingCount, 0);
    assert.equal(builtFrames.length, 1, 'retry retains the extracted immutable source');
    assert.equal(capturedJobs.length, 1);
    assert.ok(builtFrames[0].motionField);
    setWallMs(4000);
    rig.setPresentationOpportunity(admittedPresentationOpportunity);
    retryOpportunity.resolve(admittedPresentationOpportunity());
    await waitFor(() => rig.presenter.getStatus().visibleSphStep === 63, 'recovered first mesh');
    assert.equal(frameProofs(rig).length, 1);
    assert.equal(frameProofs(rig)[0].presentationQueueCompletionSerial, 2,
      'failed GPU completion serial is retained, not rolled back');
    assert.equal(builtFrames[0].motionPacing.startedAtMs, 4000);
    assert.equal(builtFrames[0].motionPacing.maxWallAgeS, 3);
    assert.equal(timers.pendingCount, 1);
    setWallMs(4750);
    timers.fireNext();
    await waitFor(() => rig.presenter.getStatus().temporalMotionAgeS === 0.016,
      'ordinary temporal motion after first-mesh recovery');
    assert.equal(frameProofs(rig).at(-1).presentationQueueCompletionSerial, 3);
    assert.equal(frameProofs(rig).at(-1).authoritativeStateMutation, false);
    assert.equal(rig.presenter.getStatus().temporalPresentationError, null);
  } finally {
    retryOpportunity.resolve(admittedPresentationOpportunity());
    await rig.presenter.dispose();
  }
});

test('committed retry retains prior admission and resources until replacement proof succeeds', async t => {
  const releasedFrames = [];
  const { rig, enqueue, setWallMs, builtFrames, receiptFields } = createControlledBootstrapRig(t, {
    nativeMaterialOverrides: { releaseFrame: frame => releasedFrames.push(frame) }
  });
  const retryOpportunity = deferred();
  try {
    setWallMs(3000);
    await enqueue();
    await waitFor(() => rig.presenter.getStatus().visibleSphStep === 63, 'prior admitted source');
    const priorFrame = builtFrames[0];
    const priorProof = frameProofs(rig).at(-1);
    const terminalCount = rig.terminals.length;
    let observations = 0;
    rig.setPresentationOpportunity(() => ++observations === 1
      ? timedOutPresentationOpportunity() : retryOpportunity.promise);
    setWallMs(4000);
    await enqueue({ sphStep: 127, time: 0.128, sourceTimingBootstrap: null,
      receipt: { ...receiptFields, sphStep: 127, scheduleId: 'replacement' } });
    await waitFor(() => observations === 2, 'replacement retry observer');
    assert.equal(rig.presenter.getStatus().visibleSphStep, 63,
      'the durable admission stays old; this does not claim old framebuffer pixels');
    assert.equal(frameProofs(rig).length, 1);
    assert.equal(rig.terminals.length, terminalCount);
    assert.ok(priorFrame.motionField, 'old resources remain owned until real replacement admission');
    assert.equal(releasedFrames.includes(priorFrame), false);
    assert.equal(queueSubmissionCount(rig), 3);
    rig.setPresentationOpportunity(admittedPresentationOpportunity);
    retryOpportunity.resolve(admittedPresentationOpportunity());
    await waitFor(() => rig.presenter.getStatus().visibleSphStep === 127, 'replacement admitted');
    await waitFor(() => releasedFrames.includes(priorFrame), 'old source retirement');
    assert.equal(frameProofs(rig).length, 2);
    assert.equal(frameProofs(rig).at(-1).presentationQueueCompletionSerial,
      priorProof.presentationQueueCompletionSerial + 2);
    assert.equal(releasedFrames.filter(frame => frame === priorFrame).length, 1);
    assert.equal(rig.presenter.getStatus().temporalMotionReady, true);
    assert.equal(rig.terminals.some(value => value.status
      === ULG_WORKER_OFFSCREEN_RESIDENT_ISOSURFACE_PRESENTATION_FAILED_STATUS), false);
  } finally {
    retryOpportunity.resolve(admittedPresentationOpportunity());
    await rig.presenter.dispose();
  }
});

test('committed retry has one extra attempt per job and never rolls submitted high-water or GPU serials backward', async t => {
  const releasedFrames = [];
  const { rig, enqueue, setWallMs, builtFrames, receiptFields } = createControlledBootstrapRig(t, {
    nativeMaterialOverrides: { releaseFrame: frame => releasedFrames.push(frame) }
  });
  try {
    setWallMs(3000);
    await enqueue();
    await waitFor(() => rig.presenter.getStatus().visibleSphStep === 63, 'initial admission');
    const admittedFrame = builtFrames[0];
    const observationsBefore = rig.presentationOpportunityCalls;
    rig.setPresentationOpportunity(timedOutPresentationOpportunity);
    setWallMs(4000);
    await enqueue({ sphStep: 127, time: 0.128, sourceTimingBootstrap: null,
      receipt: { ...receiptFields, sphStep: 127, scheduleId: 'two-misses' } });
    await waitFor(() => rig.terminals.some(value => value.sphStep === 127
      && value.status === ULG_WORKER_OFFSCREEN_RESIDENT_ISOSURFACE_PRESENTATION_FAILED_STATUS),
    'two misses exhaust the committed job');
    await waitFor(() => rig.presenter.getStatus().running === false, 'failed job quiescence');
    assert.equal(rig.presentationOpportunityCalls - observationsBefore, 2);
    assert.equal(queueSubmissionCount(rig), 3);
    assert.equal(frameProofs(rig).length, 1);
    assert.equal(rig.presenter.getStatus().visibleSphStep, 63,
      'retained admission is not an assertion about pixels from the failed submission');
    assert.equal(releasedFrames.includes(admittedFrame), false);
    assert.ok(admittedFrame.motionField);
    assert.equal(releasedFrames.filter(frame => frame === builtFrames[1]).length, 0);
    assert.equal(rig.presenter.getStatus().recoverableSphStep, 127);
    await assert.rejects(rig.presenter.redraw({ reason: 'never-repaint-the-older-submitted-generation' }),
      /lacked a post-GPU presentation opportunity/);
    assert.equal(queueSubmissionCount(rig), 4,
      'a later explicit draw can retry only the newer source, never restore the predecessor');
    assert.equal(rig.presenter.getStatus().visibleSphStep, 63);
    assert.equal(frameProofs(rig).length, 1);
    let newJobObservations = 0;
    rig.setPresentationOpportunity(() => ++newJobObservations === 1
      ? timedOutPresentationOpportunity() : admittedPresentationOpportunity());
    setWallMs(5000);
    await enqueue({ sphStep: 191, time: 0.192, sourceTimingBootstrap: null,
      receipt: { ...receiptFields, sphStep: 191, scheduleId: 'fresh-job-budget' } });
    await waitFor(() => rig.presenter.getStatus().visibleSphStep === 191, 'new job owns one fresh retry');
    assert.equal(newJobObservations, 2);
    assert.equal(queueSubmissionCount(rig), 6);
    assert.equal(frameProofs(rig).length, 2);
    assert.equal(frameProofs(rig).at(-1).presentationQueueCompletionSerial, 6);
    await waitFor(() => releasedFrames.includes(builtFrames[1]), 'superseded parked frame retirement');
    assert.equal(releasedFrames.filter(frame => frame === builtFrames[1]).length, 1);
  } finally {
    await rig.presenter.dispose();
  }
});

for (const action of ['camera', 'resize']) {
  test(`parked committed timeout recovers on a later explicit ${action} without rebuilding physics`, async t => {
    const releasedFrames = [];
    const { rig, enqueue, setWallMs, builtFrames, capturedJobs, receiptFields } = createControlledBootstrapRig(t, {
      nativeMaterialOverrides: { releaseFrame: frame => releasedFrames.push(frame) }
    });
    try {
      setWallMs(3000);
      await enqueue();
      await waitFor(() => rig.presenter.getStatus().visibleSphStep === 63, 'prior admitted source');
      const predecessor = builtFrames[0];
      rig.setPresentationOpportunity(timedOutPresentationOpportunity);
      setWallMs(4000);
      await enqueue({ sphStep: 127, time: 0.128, sourceTimingBootstrap: null,
        receipt: { ...receiptFields, sphStep: 127, scheduleId: 'parked-source' } });
      await waitFor(() => rig.presenter.getStatus().running === false, 'parked source quiescence');
      assert.equal(queueSubmissionCount(rig), 3);
      assert.equal(frameProofs(rig).length, 1);
      assert.equal(rig.presenter.getStatus().visibleSphStep, 63);
      rig.setPresentationOpportunity(admittedPresentationOpportunity);
      const latestMatrix = viewProjectionWithTranslation(7);
      if (action === 'resize') rig.setFramebufferEpoch(2);
      const recovered = await rig.presenter[action === 'resize' ? 'resize' : 'redraw']({
        viewProjectionMatrix: latestMatrix, cameraPositionM: [3, 4, 5],
        reason: `later-explicit-${action}`
      });
      assert.equal(recovered, true);
      assert.equal(rig.presenter.getStatus().visibleSphStep, 127);
      assert.equal(rig.presenter.getStatus().visibleSourceTimeS, 0.128);
      assert.equal(builtFrames.length, 2);
      assert.equal(capturedJobs.length, 2);
      assert.deepEqual(rig.drawnViewProjectionMatrices.at(-1), latestMatrix);
      assert.equal(frameProofs(rig).at(-1).presentationQueueCompletionSerial, 4);
      assert.equal(frameProofs(rig).at(-1).workerFramebufferEpoch, action === 'resize' ? 2 : 1);
      assert.equal(rig.terminals.at(-1).scheduleId, 'parked-source');
      await waitFor(() => releasedFrames.includes(predecessor), 'predecessor retires only after proof');
      assert.equal(releasedFrames.filter(frame => frame === predecessor).length, 1);
    } finally {
      await rig.presenter.dispose();
    }
  });
}

test('parked first mesh needs a fresh fence and opportunity before source admission or motion starts', async t => {
  const { rig, timers, enqueue, setWallMs, builtFrames, capturedJobs, receiptFields } = createControlledBootstrapRig(t);
  const fence = deferred();
  const opportunity = deferred();
  let recovery = null;
  try {
    rig.setPresentationOpportunity(timedOutPresentationOpportunity);
    await enqueue();
    await waitFor(() => rig.presenter.getStatus().running === false, 'two first-source misses');
    const frame = builtFrames[0];
    assert.equal(rig.presentationOpportunityCalls, 2);
    assert.equal(rig.presenter.getStatus().visibleGeneration, null);
    assert.equal(rig.presenter.getStatus().recoverableGeneration, 1);
    assert.ok(frame.motionField);
    assert.equal(timers.pendingCount, 0);
    assert.equal(frame.motionPacing, undefined);
    rig.setQueueCompletion(fence.promise);
    rig.setPresentationOpportunity(() => opportunity.promise);
    recovery = rig.presenter.redraw({ viewProjectionMatrix: viewProjectionWithTranslation(3) });
    await waitFor(() => queueSubmissionCount(rig) === 3, 'explicit recovery submit');
    assert.equal(frameProofs(rig).length, 0);
    assert.equal(rig.presentationOpportunityCalls, 2, 'the new GPU fence has not completed');
    fence.resolve();
    await waitFor(() => rig.presentationOpportunityCalls === 3, 'new post-GPU observer');
    assert.equal(frameProofs(rig).length, 0);
    assert.equal(timers.pendingCount, 0);
    setWallMs(9000);
    opportunity.resolve(admittedPresentationOpportunity());
    assert.equal(await recovery, true);
    assert.equal(rig.presenter.getStatus().recoverableGeneration, null);
    assert.equal(frame.motionPacing.startedAtMs, 9000);
    assert.equal(frame.lastDisplayedMotionAgeS, 0);
    assert.equal(frameProofs(rig).at(-1).isosurfacePresentationSourceTimeS, 0.064);
    assert.equal(builtFrames.length, 1);
    assert.equal(capturedJobs.length, 1);
    assert.equal(rig.terminals.at(-1).scheduleId, receiptFields.scheduleId);
    assert.equal(timers.pendingCount, 1);
    const pacing = frame.motionPacing;
    rig.setFramebufferEpoch(2);
    await rig.presenter.resize();
    assert.equal(pacing.startedAtMs, 9000, 'ordinary resize never renews an admitted motion clock');
  } finally {
    fence.resolve(); opportunity.resolve(admittedPresentationOpportunity());
    await recovery;
    await rig.presenter.dispose();
  }
});

test('parked recovery spends one draw per later explicit request and never uses appearance readiness as a retry', async t => {
  const { rig, timers, enqueue } = createControlledBootstrapRig(t);
  try {
    rig.setPresentationOpportunity(timedOutPresentationOpportunity);
    await enqueue();
    await waitFor(() => rig.presenter.getStatus().running === false, 'parked source');
    rig.notifyAppearanceReady();
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(queueSubmissionCount(rig), 2);
    await assert.rejects(rig.presenter.redraw({ viewProjectionMatrix: viewProjectionWithTranslation(2) }),
      /lacked a post-GPU presentation opportunity/);
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(queueSubmissionCount(rig), 3, 'one input is one attempt, not a renewed automatic budget');
    assert.equal(frameProofs(rig).length, 0);
    assert.equal(timers.pendingCount, 0);
    assert.equal(rig.presenter.getStatus().recoverableGeneration, 1);
    rig.setPresentationOpportunity(admittedPresentationOpportunity);
    rig.notifyAppearanceReady();
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(queueSubmissionCount(rig), 3);
    assert.equal(await rig.presenter.redraw({ viewProjectionMatrix: viewProjectionWithTranslation(4) }), true);
    assert.equal(frameProofs(rig).length, 1);
  } finally { await rig.presenter.dispose(); }
});

test('camera input queued during the last automatic timeout cannot awaken the newly parked source', async t => {
  const { rig, timers, enqueue } = createControlledBootstrapRig(t);
  const finalOpportunity = deferred();
  let observations = 0;
  let redraw = null;
  try {
    rig.setPresentationOpportunity(() => ++observations === 1
      ? timedOutPresentationOpportunity() : finalOpportunity.promise);
    await enqueue();
    await waitFor(() => observations === 2, 'second automatic attempt');
    redraw = rig.presenter.redraw({ viewProjectionMatrix: viewProjectionWithTranslation(5) });
    finalOpportunity.resolve(timedOutPresentationOpportunity());
    assert.equal(await redraw, false);
    assert.equal(queueSubmissionCount(rig), 2);
    assert.equal(rig.presenter.getStatus().recoverableGeneration, 1);
    assert.equal(timers.pendingCount, 0);
    rig.setPresentationOpportunity(admittedPresentationOpportunity);
    assert.equal(await rig.presenter.redraw({ viewProjectionMatrix: viewProjectionWithTranslation(6) }), true);
    assert.equal(queueSubmissionCount(rig), 3);
  } finally {
    finalOpportunity.resolve(timedOutPresentationOpportunity());
    await redraw;
    await rig.presenter.dispose();
  }
});

function createOwnedRecoveryRig({ onPrepare = null, onTransfer = null, onRelease = null } = {}) {
  const records = [];
  let prepareBlock = null;
  let prepareCalls = 0;
  let captureReleases = 0;
  const rig = createPresenterRig({
    captureRenderRows: async () => ({ destroyRenderRowsBuffer() { captureReleases += 1; } }),
    nativeMaterialOverrides: {
      async prepare(frame) {
        prepareCalls += 1;
        if (prepareBlock) await prepareBlock;
        await onPrepare?.(frame);
      },
      transferFrame(source, target) { onTransfer?.(source, target); },
      releaseFrame(frame) { frame.ownedResources.nativeReleases += 1; onRelease?.(frame); }
    },
    createParticipatingMediumGpu: () => ({ ready: Promise.resolve(), destroy() {} }),
    encodeParticipatingMediumRender: async () => {},
    destroyParticipatingMediumPackedFrame(packed) {
      packed.resources.mediumReleases += 1;
      packed.buffer.destroy();
    },
    buildPresentationFrame: async job => {
      const resources = {
        meshReleases: 0, temperatureReleases: 0, motionReleases: 0,
        mediumReleases: 0, nativeReleases: 0,
        position: new GPUBuffer(), normal: new GPUBuffer(), uniform: new GPUBuffer(),
        temperature: new GPUBuffer(), motion: new GPUBuffer(), medium: new GPUBuffer()
      };
      records.push(resources);
      return {
        generation: job.generation, invalidationEpoch: job.invalidationEpoch,
        sphStep: job.sphStep, receiptFields: job.receiptFields, ownedResources: resources,
        viewProjectionMatrix: [...job.admission.viewProjectionMatrix],
        cameraPositionM: [...job.admission.cameraPositionM],
        motionField: { buffer: resources.motion, rowCount: 8,
          destroy() { resources.motionReleases += 1; resources.motion.destroy(); } },
        participatingMedium: { status: 'participating-medium-ready',
          collectiveSurfaceCount: 1, consumedSurfaceCount: 1, released: false,
          packedFrame: { resources, buffer: resources.medium } },
        surfaces: [{ metadata: { transparencyClassId: 0, opacity: 1 },
          uniformBuffer: resources.uniform,
          translation: { destroyExtensionSurfaceBuffers() {
            resources.position.destroy(); resources.normal.destroy();
          } },
          rawExecution: { result: { release() { resources.meshReleases += 1; } } },
          releaseTemperatureRows() { resources.temperatureReleases += 1; resources.temperature.destroy(); }
        }]
      };
    }
  });
  return {
    rig, records,
    get prepareCalls() { return prepareCalls; },
    get captureReleases() { return captureReleases; },
    setPrepareBlock(value) { prepareBlock = value; },
    enqueue(sphStep = 63) {
      const retained = validRetained();
      retained.sphParticleUpload.time = (sphStep + 1) / 1000;
      return rig.presenter.enqueue({ request: validRequest(), retained, sphStep,
        receiptFields: { sphStep, scheduleId: `owned-source-${sphStep}` } });
    }
  };
}

function assertRecoveryResourcesReleasedOnce(resources) {
  for (const key of ['meshReleases', 'temperatureReleases', 'motionReleases', 'mediumReleases', 'nativeReleases']) {
    assert.equal(resources[key], 1, `${key} is retired exactly once`);
  }
  for (const key of ['position', 'normal', 'uniform', 'temperature', 'motion', 'medium']) {
    assert.equal(resources[key].destroyCount, 1, `${key} buffer is destroyed exactly once`);
  }
}

for (const stage of ['prepare', 'GPU fence', 'opportunity']) {
  for (const action of ['clear', 'dispose', 'newer source']) {
    test(`parked recovery cannot survive ${action} during ${stage}, and releases all owned resources once`, async () => {
      const state = createOwnedRecoveryRig();
      const { rig } = state;
      const pending = deferred();
      let recovery = null;
      let disposing = null;
      let resize = null;
      try {
        rig.setPresentationOpportunity(timedOutPresentationOpportunity);
        await state.enqueue();
        await waitFor(() => rig.presenter.getStatus().running === false, 'owned frame parked');
        assert.equal(state.captureReleases, 1, 'parking retains no captured physics rows');
        assert.equal(state.records[0].meshReleases, 0);
        assert.equal(state.records[0].mediumReleases, 0);
        rig.setPresentationOpportunity(admittedPresentationOpportunity);
        if (stage === 'prepare') state.setPrepareBlock(pending.promise);
        if (stage === 'GPU fence') rig.setQueueCompletion(pending.promise);
        if (stage === 'opportunity') rig.setPresentationOpportunity(() => pending.promise);
        recovery = rig.presenter.redraw({ viewProjectionMatrix: viewProjectionWithTranslation(2) });
        await waitFor(() => stage === 'prepare' ? state.prepareCalls === 3
          : stage === 'GPU fence' ? queueSubmissionCount(rig) === 3
            : rig.presentationOpportunityCalls === 3, 'controlled recovery boundary');
        if (action === 'clear') {
          rig.presenter.clear();
          rig.setFramebufferEpoch(2);
          resize = rig.presenter.resize();
        }
        if (action === 'dispose') disposing = rig.presenter.dispose();
        if (action === 'newer source') await state.enqueue(127);
        state.setPrepareBlock(null);
        rig.setQueueCompletion(Promise.resolve());
        rig.setPresentationOpportunity(admittedPresentationOpportunity);
        pending.resolve(admittedPresentationOpportunity());
        assert.equal(await recovery, action === 'newer source',
          'a camera request may carry forward to the new source, never publish the retired one');
        if (resize) assert.equal(await resize, false, 'post-clear resize cannot resurrect the parked source');
        await disposing;
        if (action === 'newer source') {
          await waitFor(() => rig.presenter.getStatus().visibleSphStep === 127, 'new source wins');
        } else {
          assert.equal(rig.presenter.getStatus().visibleGeneration, null);
        }
        assert.equal(frameProofs(rig).some(proof => proof.sphStep === 63), false);
        assert.equal(rig.presenter.getStatus().recoverableGeneration, null);
        await waitFor(() => state.records[0].motionReleases === 1, 'owned resource retirement');
        assertRecoveryResourcesReleasedOnce(state.records[0]);
      } finally {
        pending.resolve(admittedPresentationOpportunity());
        await recovery;
        await rig.presenter.dispose();
        await disposing;
        await resize;
      }
    });
  }
}

for (const failure of ['generic observer', 'GPU rejection', 'validation error']) {
  test(`parked recovery retires its candidate after ${failure} instead of retrying it`, async () => {
    const state = createOwnedRecoveryRig();
    const { rig } = state;
    try {
      rig.setPresentationOpportunity(timedOutPresentationOpportunity);
      await state.enqueue();
      await waitFor(() => rig.presenter.getStatus().running === false, 'frame parked');
      rig.setPresentationOpportunity(() => ({ available: false, method: 'observer-unavailable' }));
      if (failure === 'GPU rejection') {
        const rejected = Promise.reject(new Error('GPU failed'));
        rejected.catch(() => {});
        rig.setQueueCompletion(rejected);
      }
      if (failure === 'validation error') {
        rig.device.pushErrorScope = () => {};
        rig.device.popErrorScope = async () => ({ message: 'validation failed' });
      }
      await assert.rejects(rig.presenter.redraw({ viewProjectionMatrix: viewProjectionWithTranslation(2) }));
      assert.equal(rig.presenter.getStatus().recoverableGeneration, null);
      assert.equal(frameProofs(rig).length, 0);
      rig.setQueueCompletion(Promise.resolve());
      rig.setPresentationOpportunity(admittedPresentationOpportunity);
      assert.equal(await rig.presenter.redraw({ viewProjectionMatrix: viewProjectionWithTranslation(3) }), false);
      assert.equal(queueSubmissionCount(rig), 3);
      await waitFor(() => state.records[0].motionReleases === 1, 'fatal recovery cleanup');
      assertRecoveryResourcesReleasedOnce(state.records[0]);
    } finally { await rig.presenter.dispose(); }
  });
}

for (const stage of ['GPU fence', 'opportunity']) {
  test(`parked recovery resize during ${stage} transfers ownership and admits only its new epoch`, async () => {
    const state = createOwnedRecoveryRig();
    const { rig } = state;
    const pending = deferred();
    let recovery = null;
    let resize = null;
    try {
      rig.setPresentationOpportunity(timedOutPresentationOpportunity);
      await state.enqueue();
      await waitFor(() => rig.presenter.getStatus().running === false, 'frame parked');
      rig.setPresentationOpportunity(admittedPresentationOpportunity);
      if (stage === 'GPU fence') rig.setQueueCompletion(pending.promise);
      else rig.setPresentationOpportunity(() => pending.promise);
      recovery = rig.presenter.redraw({ viewProjectionMatrix: viewProjectionWithTranslation(2) });
      await waitFor(() => stage === 'GPU fence' ? queueSubmissionCount(rig) === 3
        : rig.presentationOpportunityCalls === 3, 'recovery awaiting old epoch');
      rig.setFramebufferEpoch(2);
      const latestMatrix = viewProjectionWithTranslation(8);
      resize = rig.presenter.resize({ viewProjectionMatrix: latestMatrix });
      rig.setQueueCompletion(Promise.resolve());
      rig.setPresentationOpportunity(admittedPresentationOpportunity);
      pending.resolve(admittedPresentationOpportunity());
      assert.equal(await recovery, false);
      assert.equal(await resize, true);
      assert.equal(state.records.length, 1, 'resize never rebuilds or recaptures the source');
      assert.equal(state.captureReleases, 1);
      assert.equal(frameProofs(rig).length, 1);
      assert.equal(frameProofs(rig)[0].workerFramebufferEpoch, 2);
      assert.equal(frameProofs(rig)[0].presentationQueueCompletionSerial, 4);
      assert.deepEqual(rig.drawnViewProjectionMatrices.at(-1), latestMatrix);
      assert.equal(state.records[0].meshReleases, 0);
      await rig.presenter.dispose();
      await waitFor(() => state.records[0].motionReleases === 1, 'rebased owner retirement');
      assertRecoveryResourcesReleasedOnce(state.records[0]);
    } finally {
      pending.resolve(admittedPresentationOpportunity());
      await recovery; await resize;
      await rig.presenter.dispose();
    }
  });
}

for (const stage of ['prepare', 'GPU fence', 'opportunity']) {
  test(`fatal parked recovery ${stage} rejection survives a concurrent resize without resurrecting that source`, async () => {
    const state = createOwnedRecoveryRig();
    const { rig } = state;
    const pending = deferred();
    let expectedFailure = null;
    let resize = null;
    try {
      rig.setPresentationOpportunity(timedOutPresentationOpportunity);
      await state.enqueue();
      await waitFor(() => rig.presenter.getStatus().running === false, 'owned source parked');
      rig.setPresentationOpportunity(admittedPresentationOpportunity);
      if (stage === 'prepare') state.setPrepareBlock(pending.promise);
      if (stage === 'GPU fence') rig.setQueueCompletion(pending.promise);
      if (stage === 'opportunity') rig.setPresentationOpportunity(() => pending.promise);
      expectedFailure = assert.rejects(rig.presenter.redraw({ viewProjectionMatrix: viewProjectionWithTranslation(1) }),
        /fatal recovery boundary/);
      await waitFor(() => stage === 'prepare' ? state.prepareCalls === 3
        : stage === 'GPU fence' ? queueSubmissionCount(rig) === 3
          : rig.presentationOpportunityCalls === 3, 'pending fatal recovery boundary');
      rig.setFramebufferEpoch(2);
      resize = rig.presenter.resize({ viewProjectionMatrix: viewProjectionWithTranslation(5) });
      state.setPrepareBlock(null);
      rig.setQueueCompletion(Promise.resolve());
      rig.setPresentationOpportunity(admittedPresentationOpportunity);
      pending.reject(new Error('fatal recovery boundary'));
      await expectedFailure;
      assert.equal(await resize, false);
      assert.equal(rig.presenter.getStatus().recoverableGeneration, null);
      assert.equal(rig.presenter.getStatus().visibleGeneration, null);
      assert.equal(frameProofs(rig).length, 0);
      assert.equal(queueSubmissionCount(rig), stage === 'prepare' ? 2 : 3,
        'a transferred wrapper cannot disguise fatal failure as a fresh eligible source');
      await waitFor(() => state.records[0].motionReleases === 1, 'transferred fatal source retirement');
      assertRecoveryResourcesReleasedOnce(state.records[0]);
    } finally {
      pending.resolve(admittedPresentationOpportunity());
      await expectedFailure; await resize;
      await rig.presenter.dispose();
    }
  });
}

test('parked recovery resize transfers native frame caches after delayed preparation and preserves the latest resize', async () => {
  const entries = new Map();
  const allocated = [];
  let transfers = 0;
  const state = createOwnedRecoveryRig({
    onPrepare(frame) {
      if (!entries.has(frame)) {
        const buffer = new GPUBuffer();
        allocated.push(buffer);
        entries.set(frame, buffer);
      }
    },
    onTransfer(source, target) {
      transfers += 1;
      assert.equal(entries.has(target), false);
      entries.set(target, entries.get(source));
      entries.delete(source);
    },
    onRelease(frame) { entries.get(frame)?.destroy(); entries.delete(frame); }
  });
  const { rig } = state;
  const prepare = deferred();
  let recovery = null;
  let firstResize = null;
  let lastResize = null;
  try {
    rig.setPresentationOpportunity(timedOutPresentationOpportunity);
    await state.enqueue();
    await waitFor(() => rig.presenter.getStatus().running === false, 'cached source parked');
    assert.equal(entries.size, 1);
    state.setPrepareBlock(prepare.promise);
    rig.setPresentationOpportunity(admittedPresentationOpportunity);
    recovery = rig.presenter.redraw({ viewProjectionMatrix: viewProjectionWithTranslation(1) });
    await waitFor(() => state.prepareCalls === 3, 'old wrapper preparation awaiting readiness');
    rig.setFramebufferEpoch(2);
    firstResize = rig.presenter.resize({ viewProjectionMatrix: viewProjectionWithTranslation(2) });
    rig.setFramebufferEpoch(3);
    const latestMatrix = viewProjectionWithTranslation(3);
    lastResize = rig.presenter.resize({ viewProjectionMatrix: latestMatrix });
    assert.equal(transfers, 0, 'native ownership cannot move out from underneath preparation');
    assert.equal(await firstResize, false, 'resize coalescing preserves the latest request');
    state.setPrepareBlock(null);
    prepare.resolve();
    assert.equal(await recovery, false);
    assert.equal(await lastResize, true);
    assert.equal(transfers, 2);
    assert.equal(entries.size, 1);
    assert.equal(allocated.length, 1, 'no late cache is recreated on a retired wrapper');
    assert.equal(frameProofs(rig).length, 1);
    assert.equal(frameProofs(rig)[0].workerFramebufferEpoch, 3);
    assert.deepEqual(rig.drawnViewProjectionMatrices.at(-1), latestMatrix);
    await rig.presenter.dispose();
    await waitFor(() => state.records[0].motionReleases === 1, 'final transferred cache retirement');
    assertRecoveryResourcesReleasedOnce(state.records[0]);
    assert.equal(entries.size, 0);
    assert.equal(allocated[0].destroyCount, 1);
  } finally {
    prepare.resolve();
    await recovery; await firstResize; await lastResize;
    await rig.presenter.dispose();
  }
});

test('parked camera bursts serialize and coalesce to the newest matrix without recapturing source state', async () => {
  const state = createOwnedRecoveryRig();
  const { rig } = state;
  const fence = deferred();
  let first = null;
  let last = null;
  try {
    rig.setPresentationOpportunity(timedOutPresentationOpportunity);
    await state.enqueue();
    await waitFor(() => rig.presenter.getStatus().running === false, 'source parked');
    rig.setPresentationOpportunity(admittedPresentationOpportunity);
    rig.setQueueCompletion(fence.promise);
    first = rig.presenter.redraw({ viewProjectionMatrix: viewProjectionWithTranslation(1) });
    await waitFor(() => queueSubmissionCount(rig) === 3, 'first camera fence');
    const middle = rig.presenter.redraw({ viewProjectionMatrix: viewProjectionWithTranslation(2) });
    const latestMatrix = viewProjectionWithTranslation(3);
    last = rig.presenter.redraw({ viewProjectionMatrix: latestMatrix });
    assert.equal(await middle, false);
    rig.setQueueCompletion(Promise.resolve());
    fence.resolve();
    assert.equal(await first, true);
    assert.equal(await last, true);
    assert.equal(queueSubmissionCount(rig), 4);
    assert.equal(state.records.length, 1);
    assert.equal(state.captureReleases, 1);
    assert.deepEqual(rig.drawnViewProjectionMatrices.at(-1), latestMatrix);
    assert.equal(frameProofs(rig).every(proof => proof.sphStep === 63), true);
  } finally {
    fence.resolve(); await first; await last;
    await rig.presenter.dispose();
  }
});

for (const sourceTimeS of [undefined, 999]) {
  test(`parked recovery canonicalizes captured source time when a builder returns ${sourceTimeS}`, async () => {
    let builtFrame = null;
    const rig = createPresenterRig({
      buildPresentationFrame: async job => (builtFrame = {
        generation: job.generation, invalidationEpoch: job.invalidationEpoch,
        sphStep: job.sphStep, sourceTimeS, receiptFields: job.receiptFields,
        viewProjectionMatrix: [...job.admission.viewProjectionMatrix],
        cameraPositionM: [...job.admission.cameraPositionM], surfaces: []
      })
    });
    try {
      rig.setPresentationOpportunity(timedOutPresentationOpportunity);
      const retained = validRetained();
      retained.sphParticleUpload.time = 0.064;
      await rig.presenter.enqueue({ request: validRequest(), retained, sphStep: 63 });
      await waitFor(() => rig.presenter.getStatus().running === false, 'canonical source parked');
      assert.equal(builtFrame.sourceTimeS, 0.064);
      rig.setPresentationOpportunity(admittedPresentationOpportunity);
      assert.equal(await rig.presenter.redraw({ viewProjectionMatrix: viewProjectionWithTranslation(1) }), true);
      assert.equal(rig.presenter.getStatus().visibleSourceTimeS, 0.064);
      assert.equal(frameProofs(rig)[0].isosurfacePresentationSourceTimeS, 0.064);
    } finally { await rig.presenter.dispose(); }
  });
}

for (const [label, observer, gpuReject] of [
  ['generic unavailable', () => ({ available: false, method: 'observer-unavailable' })],
  ['unknown method', () => ({ available: false, method: 'other-timeout' })],
  ['missing availability', () => ({ method: 'worker-request-animation-frame-timeout' })],
  ['string availability', () => ({ available: 'false', method: 'worker-request-animation-frame-timeout' })],
  ['numeric availability', () => ({ available: 0, method: 'worker-request-animation-frame-timeout' })],
  ['null receipt', () => null],
  ['thrown timeout-named Error', () => { throw Object.assign(new Error('observer failed'),
    { name: 'PresentationOpportunityTimeoutError' }); }],
  ['thrown timeout-shaped object', () => { throw timedOutPresentationOpportunity(); }],
  ['GPU completion rejection', admittedPresentationOpportunity, true]
]) {
  test(`committed retry does not recover ${label}`, async t => {
    const { rig, timers, enqueue, setWallMs } = createControlledBootstrapRig(t);
    try {
      rig.setPresentationOpportunity(observer);
      if (gpuReject) {
        const rejection = Promise.reject(new Error('GPU queue failed'));
        rejection.catch(() => {});
        rig.setQueueCompletion(rejection);
      }
      setWallMs(3000);
      await enqueue();
      await waitFor(() => rig.terminals.some(value => value.status
        === ULG_WORKER_OFFSCREEN_RESIDENT_ISOSURFACE_PRESENTATION_FAILED_STATUS), 'fatal committed draw');
      await waitFor(() => rig.presenter.getStatus().running === false, 'fatal draw quiescence');
      assert.equal(queueSubmissionCount(rig), 1);
      assert.equal(rig.presentationOpportunityCalls, gpuReject ? 0 : 1);
      assert.equal(frameProofs(rig).length, 0);
      assert.equal(rig.presenter.getStatus().visibleGeneration, null);
      assert.equal(rig.presenter.getStatus().recoverableGeneration, null);
      assert.equal(timers.pendingCount, 0);
    } finally {
      await rig.presenter.dispose();
    }
  });
}

for (const pendingAttempt of [1, 2]) {
  for (const action of ['clear', 'dispose', 'newer request']) {
    test(`committed retry is superseded after ${action} during timeout attempt ${pendingAttempt}`, async t => {
      const { rig, timers, enqueue, setWallMs, receiptFields, builtFrames } = createControlledBootstrapRig(t);
      const opportunity = deferred();
      let observations = 0;
      let disposing = null;
      rig.setPresentationOpportunity(() => {
        observations += 1;
        if (observations < pendingAttempt) return timedOutPresentationOpportunity();
        if (observations === pendingAttempt) return opportunity.promise;
        return admittedPresentationOpportunity();
      });
      try {
        setWallMs(3000);
        await enqueue();
        await waitFor(() => observations === pendingAttempt, 'pending committed observation');
        if (action === 'clear') rig.presenter.clear();
        if (action === 'dispose') disposing = rig.presenter.dispose();
        if (action === 'newer request') {
          await enqueue({ sphStep: 127, time: 0.128, sourceTimingBootstrap: null,
            receipt: { ...receiptFields, sphStep: 127, scheduleId: 'newer-during-timeout' } });
        }
        setWallMs(4000);
        opportunity.resolve(timedOutPresentationOpportunity());
        await waitFor(() => rig.terminals.some(value => value.sphStep === 63
          && value.status === ULG_WORKER_OFFSCREEN_RESIDENT_ISOSURFACE_PRESENTATION_SUPERSEDED_STATUS),
        'cancelled timeout reports supersession, even with its retry budget spent');
        if (action === 'newer request') {
          await waitFor(() => rig.presenter.getStatus().visibleSphStep === 127, 'newer admitted source');
          assert.equal(frameProofs(rig).at(-1).presentationQueueCompletionSerial, pendingAttempt + 1);
        } else {
          await waitFor(() => rig.presenter.getStatus().running === false, 'cancelled source quiescence');
          assert.equal(rig.presenter.getStatus().visibleGeneration, null);
        }
        assert.equal(frameProofs(rig).some(value => value.sphStep === 63), false);
        assert.equal(rig.terminals.some(value => value.sphStep === 63
          && value.status === ULG_WORKER_OFFSCREEN_RESIDENT_ISOSURFACE_PRESENTATION_FAILED_STATUS), false);
        assert.equal(queueSubmissionCount(rig), pendingAttempt + (action === 'newer request' ? 1 : 0));
        assert.equal(builtFrames[0].motionField, null);
        assert.equal(timers.pendingCount, 0);
        await disposing;
      } finally {
        opportunity.resolve(timedOutPresentationOpportunity());
        await rig.presenter.dispose();
      }
    });
  }
}

test('committed retry cannot submit a lagged generation when a newer job arrives during native preparation', async t => {
  const prepare = deferred();
  let preparations = 0;
  const { rig, enqueue, setWallMs, receiptFields } = createControlledBootstrapRig(t, {
    nativeMaterialOverrides: { prepare: () => ++preparations === 2 ? prepare.promise : undefined }
  });
  let observations = 0;
  rig.setPresentationOpportunity(() => ++observations === 1
    ? timedOutPresentationOpportunity() : admittedPresentationOpportunity());
  try {
    setWallMs(3000);
    await enqueue();
    await waitFor(() => preparations === 2, 'retry held in native preparation');
    assert.equal(queueSubmissionCount(rig), 1);
    await enqueue({ sphStep: 127, time: 0.128, sourceTimingBootstrap: null,
      receipt: { ...receiptFields, sphStep: 127, scheduleId: 'newer-during-retry-prepare' } });
    prepare.resolve();
    await waitFor(() => rig.presenter.getStatus().visibleSphStep === 127, 'new source instead of stale retry');
    assert.equal(queueSubmissionCount(rig), 2, 'the stale retry never acquired a submitted generation');
    assert.equal(observations, 2);
    assert.equal(frameProofs(rig).length, 1);
    assert.equal(frameProofs(rig)[0].sphStep, 127);
    assert.equal(frameProofs(rig)[0].presentationQueueCompletionSerial, 2);
    assert.ok(rig.terminals.some(value => value.sphStep === 63
      && value.status === ULG_WORKER_OFFSCREEN_RESIDENT_ISOSURFACE_PRESENTATION_SUPERSEDED_STATUS));
  } finally {
    prepare.resolve();
    await rig.presenter.dispose();
  }
});

test('committed retry rebases a framebuffer resize after its first timeout without rebuilding its source', async t => {
  const { rig, timers, enqueue, setWallMs, builtFrames } = createControlledBootstrapRig(t);
  const opportunity = deferred();
  let observations = 0;
  rig.setPresentationOpportunity(() => ++observations === 1
    ? opportunity.promise : admittedPresentationOpportunity());
  let resize = null;
  try {
    setWallMs(3000);
    await enqueue();
    await waitFor(() => observations === 1, 'first committed observer before resize');
    rig.setFramebufferEpoch(2);
    resize = rig.presenter.resize({ reason: 'first-timeout-framebuffer-rebase' });
    setWallMs(4000);
    opportunity.resolve(timedOutPresentationOpportunity());
    await waitFor(() => rig.presenter.getStatus().visibleSphStep === 63, 'resized committed retry admitted');
    await resize;
    assert.equal(builtFrames.length, 1);
    assert.equal(frameProofs(rig)[0].presentationQueueCompletionSerial, 2);
    assert.equal(frameProofs(rig)[0].workerFramebufferEpoch, 2);
    assert.ok(frameProofs(rig).every(value => value.workerFramebufferEpoch === 2));
    assert.equal(rig.presenter.getStatus().temporalMotionReady, true);
    assert.equal(timers.pendingCount, 1);
    assert.equal(rig.terminals.some(value => value.status
      === ULG_WORKER_OFFSCREEN_RESIDENT_ISOSURFACE_PRESENTATION_FAILED_STATUS), false);
  } finally {
    opportunity.resolve(timedOutPresentationOpportunity());
    await rig.presenter.dispose();
    await resize;
  }
});

test('committed retry budget remains spent through resize when both real attempts miss their opportunity', async t => {
  const { rig, timers, enqueue, setWallMs, builtFrames } = createControlledBootstrapRig(t);
  const retryOpportunity = deferred();
  let observations = 0;
  rig.setPresentationOpportunity(() => ++observations === 1
    ? timedOutPresentationOpportunity() : retryOpportunity.promise);
  let resize = null;
  try {
    setWallMs(3000);
    await enqueue();
    await waitFor(() => observations === 2, 'second committed observer before resize');
    rig.setFramebufferEpoch(2);
    resize = rig.presenter.resize({ reason: 'do-not-renew-timeout-budget-on-resize' });
    retryOpportunity.resolve(timedOutPresentationOpportunity());
    await waitFor(() => rig.terminals.some(value => value.status
      === ULG_WORKER_OFFSCREEN_RESIDENT_ISOSURFACE_PRESENTATION_FAILED_STATUS), 'spent resize retry budget');
    assert.equal(await resize, false);
    assert.equal(queueSubmissionCount(rig), 2, 'outer resize retry must not create a third timeout attempt');
    assert.equal(observations, 2);
    assert.equal(frameProofs(rig).length, 0);
    assert.equal(rig.presenter.getStatus().visibleGeneration, null);
    assert.equal(builtFrames[0].motionField, null);
    assert.equal(timers.pendingCount, 0);
  } finally {
    retryOpportunity.resolve(timedOutPresentationOpportunity());
    await rig.presenter.dispose();
    await resize;
  }
});

test('opportunity recovery retries a typed timeout without pretending the failed frame was displayed', async t => {
  const { rig, timers, setWallMs } = await createControlledMotionRig(t);
  try {
    const submissionsBefore = queueSubmissionCount(rig);
    const proofsBefore = frameProofs(rig).length;
    const terminalsBefore = rig.terminals.length;
    const serialBefore = frameProofs(rig).at(-1).presentationQueueCompletionSerial;
    rig.setPresentationOpportunity(timedOutPresentationOpportunity);
    setWallMs(1200);
    timers.fireNext();
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(queueSubmissionCount(rig), submissionsBefore + 1,
      'the timed-out observation followed real GPU submission');
    assert.equal(frameProofs(rig).length, proofsBefore, 'no failed-wait frame proof');
    assert.equal(rig.terminals.length, terminalsBefore, 'no failed-wait rendered publication');
    assert.equal(rig.presenter.getStatus().temporalMotionAgeS, 0, 'displayed age does not advance');
    assert.ok(rig.presenter.getStatus().temporalPresentationError);
    assert.equal(timers.pendingCount, 1, 'typed timeout keeps exactly one paced retry alive');
    assert.ok(Math.abs(timers.nextDelayMs - 1000 / 60) < 1e-9,
      'retry uses the existing pacing interval');
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(queueSubmissionCount(rig), submissionsBefore + 1,
      'no immediate retry spin without the pacing timer');

    rig.setPresentationOpportunity(admittedPresentationOpportunity);
    setWallMs(1240);
    timers.fireNext();
    await waitFor(() => rig.terminals.length === terminalsBefore + 1, 'recovered ordinary presentation');
    const proof = frameProofs(rig).at(-1);
    const receipt = rig.terminals.at(-1);
    assert.equal(queueSubmissionCount(rig), submissionsBefore + 2);
    assert.equal(frameProofs(rig).length, proofsBefore + 1);
    assert.equal(proof.presentationQueueCompletionSerial, serialBefore + 2,
      'real GPU completion serial includes the earlier unobserved submission');
    assert.equal(rig.presenter.getStatus().temporalPresentationError, null);
    assert.ok(Math.abs(receipt.isosurfacePresentationMotionAgeS - 0.01536) < 1e-12);
    assert.equal(receipt.physicsQueuePrefixCoverage, 'physics-queue-prefix-not-attributed');
    assert.equal(receipt.physicsHostQueueFenceParticipation, null);
    assert.equal(receipt.motionPresentationQosBoundary, undefined);
    assert.equal(receipt.authoritativeStateMutation, false);
  } finally {
    await rig.presenter.dispose();
  }
});

test('opportunity recovery remains bounded and truthful across repeated timeouts before success', async t => {
  const { rig, timers, setWallMs } = await createControlledMotionRig(t);
  try {
    const submissionsBefore = queueSubmissionCount(rig);
    const proofsBefore = frameProofs(rig).length;
    const terminalsBefore = rig.terminals.length;
    const serialBefore = frameProofs(rig).at(-1).presentationQueueCompletionSerial;
    rig.setPresentationOpportunity(timedOutPresentationOpportunity);
    for (let attempt = 1; attempt <= 8; attempt += 1) {
      setWallMs(1100 + attempt * 80);
      timers.fireNext();
      await new Promise(resolve => setImmediate(resolve));
      assert.equal(queueSubmissionCount(rig), submissionsBefore + attempt);
      assert.equal(frameProofs(rig).length, proofsBefore);
      assert.equal(rig.terminals.length, terminalsBefore);
      assert.equal(rig.presenter.getStatus().temporalMotionAgeS, 0);
      assert.ok(rig.presenter.getStatus().temporalPresentationError);
      assert.equal(timers.pendingCount, 1, 'each miss retains one retry, not an accumulating queue');
      assert.ok(Math.abs(timers.nextDelayMs - 1000 / 60) < 1e-9);
    }
    rig.setPresentationOpportunity(admittedPresentationOpportunity);
    setWallMs(1900);
    timers.fireNext();
    await waitFor(() => rig.terminals.length === terminalsBefore + 1, 'success after eight observer misses');
    assert.equal(queueSubmissionCount(rig), submissionsBefore + 9);
    assert.equal(frameProofs(rig).length, proofsBefore + 1);
    assert.equal(frameProofs(rig).at(-1).presentationQueueCompletionSerial, serialBefore + 9);
    assert.equal(rig.presenter.getStatus().temporalPresentationError, null);
    assert.ok(Math.abs(rig.presenter.getStatus().temporalMotionAgeS - 0.0576) < 1e-12);
  } finally {
    await rig.presenter.dispose();
  }
});

test('opportunity recovery does not turn a later generic failure into a retry', async t => {
  const { rig, timers, setWallMs } = await createControlledMotionRig(t);
  try {
    const submissionsBefore = queueSubmissionCount(rig);
    const proofsBefore = frameProofs(rig).length;
    rig.setPresentationOpportunity(timedOutPresentationOpportunity);
    setWallMs(1200);
    timers.fireNext();
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(timers.pendingCount, 1);
    rig.setPresentationOpportunity(() => ({ available: false,
      method: 'worker-request-animation-frame-unavailable' }));
    setWallMs(1300);
    timers.fireNext();
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(queueSubmissionCount(rig), submissionsBefore + 2);
    assert.equal(frameProofs(rig).length, proofsBefore);
    assert.equal(rig.presenter.getStatus().temporalMotionAgeS, 0);
    assert.ok(rig.presenter.getStatus().temporalPresentationError);
    assert.equal(timers.pendingCount, 0, 'retry state cannot broaden recoverable error types');
  } finally {
    await rig.presenter.dispose();
  }
});

for (const expiry of ['before retry timer', 'while retry waits for lane', 'during failed observer wait']) {
  test(`opportunity recovery stops at wall horizon ${expiry} even when displayed age is zero`, async t => {
    const { rig, timers, setWallMs } = await createControlledMotionRig(t);
    const cameraFence = deferred();
    try {
      const submissionsBefore = queueSubmissionCount(rig);
      const proofsBefore = frameProofs(rig).length;
      rig.setPresentationOpportunity(timedOutPresentationOpportunity);
      setWallMs(1200);
      timers.fireNext();
      await new Promise(resolve => setImmediate(resolve));
      assert.equal(timers.pendingCount, 1, 'first timeout schedules its bounded retry');
      let expectedSubmissions = submissionsBefore + 1;
      let expectedProofs = proofsBefore;
      if (expiry === 'before retry timer') {
        setWallMs(2100);
        timers.fireNext();
      } else if (expiry === 'while retry waits for lane') {
        rig.setPresentationOpportunity(admittedPresentationOpportunity);
        rig.setQueueCompletion(cameraFence.promise);
        setWallMs(1300);
        const camera = rig.presenter.redraw({ reason: 'observer-retry-lane-delay' });
        await waitFor(() => queueSubmissionCount(rig) === submissionsBefore + 2, 'camera blocks retry lane');
        setWallMs(1400);
        timers.fireNext();
        await new Promise(resolve => setImmediate(resolve));
        setWallMs(2100);
        rig.setQueueCompletion(Promise.resolve());
        cameraFence.resolve();
        assert.equal(await camera, true);
        expectedSubmissions += 1;
        expectedProofs += 1;
      } else {
        rig.setPresentationOpportunity(() => {
          setWallMs(2100);
          return timedOutPresentationOpportunity();
        });
        setWallMs(1600);
        timers.fireNext();
        expectedSubmissions += 1;
      }
      await new Promise(resolve => setImmediate(resolve));
      assert.equal(queueSubmissionCount(rig), expectedSubmissions,
        'no new retry submission after actual wall-time expiry');
      assert.equal(frameProofs(rig).length, expectedProofs);
      assert.equal(rig.presenter.getStatus().temporalMotionAgeS, 0);
      assert.equal(timers.pendingCount, 0, 'unobserved horizon cannot retry forever');
    } finally {
      cameraFence.resolve();
      rig.setQueueCompletion(Promise.resolve());
      await rig.presenter.dispose();
    }
  });
}

for (const [failure, observer] of [
  ['unavailable observer', () => ({ available: false, method: 'worker-request-animation-frame-unavailable' })],
  ['unknown failure method', () => ({ available: false, method: 'unrecognized-timeout' })],
  ['null receipt', () => null],
  ['missing availability', () => ({ method: 'worker-request-animation-frame-timeout' })],
  ['string availability', () => ({ available: 'false', method: 'worker-request-animation-frame-timeout' })],
  ['numeric availability', () => ({ available: 0, method: 'worker-request-animation-frame-timeout' })],
  ['thrown observer error', () => { throw new Error('worker-request-animation-frame-timeout'); }],
  ['thrown timeout-shaped value', () => { throw timedOutPresentationOpportunity(); }],
  ['GPU rejection', admittedPresentationOpportunity]
]) {
  test(`opportunity recovery does not retry ${failure}`, async t => {
    const { rig, timers, setWallMs } = await createControlledMotionRig(t);
    try {
      const submissionsBefore = queueSubmissionCount(rig);
      const proofsBefore = frameProofs(rig).length;
      const terminalsBefore = rig.terminals.length;
      rig.setPresentationOpportunity(observer);
      setWallMs(1200);
      if (failure === 'GPU rejection') {
        rig.setQueueCompletion(Promise.reject(new Error('worker-request-animation-frame-timeout')));
      }
      timers.fireNext();
      await new Promise(resolve => setImmediate(resolve));
      assert.equal(queueSubmissionCount(rig), submissionsBefore + 1);
      assert.equal(frameProofs(rig).length, proofsBefore);
      assert.equal(rig.terminals.length, terminalsBefore);
      assert.equal(rig.presenter.getStatus().temporalMotionAgeS, 0);
      assert.ok(rig.presenter.getStatus().temporalPresentationError);
      assert.equal(timers.pendingCount, 0, 'only typed post-GPU observer timeout is recoverable');
      setWallMs(1300);
      await new Promise(resolve => setImmediate(resolve));
      assert.equal(queueSubmissionCount(rig), submissionsBefore + 1);
    } finally {
      rig.setQueueCompletion(Promise.resolve());
      await rig.presenter.dispose();
    }
  });
}

for (const invalidation of ['clear', 'replacement', 'dispose']) {
  test(`opportunity recovery cannot resurrect a timed-out source after ${invalidation}`, async t => {
    const { rig, timers, enqueue, setWallMs } = await createControlledMotionRig(t);
    try {
      rig.setPresentationOpportunity(timedOutPresentationOpportunity);
      setWallMs(1200);
      timers.fireNext();
      await new Promise(resolve => setImmediate(resolve));
      assert.equal(timers.pendingCount, 1);
      const submissionsBefore = queueSubmissionCount(rig);
      const terminalsBefore = rig.terminals.length;
      if (invalidation === 'clear') rig.presenter.clear();
      else if (invalidation === 'dispose') await rig.presenter.dispose();
      else {
        rig.setPresentationOpportunity(admittedPresentationOpportunity);
        await enqueue(191, 0.192);
        await waitFor(() => rig.presenter.getStatus().visibleSphStep === 191, 'replacement after timeout');
        assert.equal(timers.pendingCount, 1, 'only the new source owns a pacing timer');
        setWallMs(1400);
        timers.fireNext();
      }
      await new Promise(resolve => setImmediate(resolve));
      if (invalidation !== 'replacement') {
        assert.equal(timers.pendingCount, 0);
        assert.equal(queueSubmissionCount(rig), submissionsBefore);
        assert.equal(rig.terminals.length, terminalsBefore);
      } else {
        assert.ok(rig.terminals.length > terminalsBefore);
        assert.equal(rig.terminals.slice(terminalsBefore).some(receipt => receipt.sphStep === 127), false);
        assert.equal(rig.terminals.at(-1).sphStep, 191);
        assert.equal(rig.presenter.getStatus().temporalPresentationError, null);
      }
    } finally {
      await rig.presenter.dispose();
    }
  });
}

for (const invalidation of ['clear', 'replacement', 'dispose']) {
  test(`opportunity recovery cannot publish or retry a pending observer after ${invalidation}`, async t => {
    const { rig, timers, enqueue, setWallMs } = await createControlledMotionRig(t);
    const observer = deferred();
    let disposal = null;
    try {
      const submissionsBefore = queueSubmissionCount(rig);
      const proofsBefore = frameProofs(rig).length;
      const terminalsBefore = rig.terminals.length;
      const opportunitiesBefore = rig.presentationOpportunityCalls;
      rig.setPresentationOpportunity(() => observer.promise);
      setWallMs(1200);
      timers.fireNext();
      await waitFor(() => rig.presentationOpportunityCalls === opportunitiesBefore + 1,
        'ordinary observer is pending after GPU completion');
      assert.equal(queueSubmissionCount(rig), submissionsBefore + 1);
      assert.equal(frameProofs(rig).length, proofsBefore);
      assert.equal(timers.pendingCount, 0, 'no overlapping retry while observer is still pending');
      if (invalidation === 'clear') rig.presenter.clear();
      else if (invalidation === 'dispose') disposal = rig.presenter.dispose();
      else {
        rig.setPresentationOpportunity(admittedPresentationOpportunity);
        await enqueue(191, 0.192);
        await new Promise(resolve => setImmediate(resolve));
      }
      observer.resolve(timedOutPresentationOpportunity());
      await disposal;
      await new Promise(resolve => setImmediate(resolve));
      if (invalidation === 'replacement') {
        assert.equal(rig.presenter.getStatus().visibleSphStep, 191);
        assert.equal(rig.presenter.getStatus().temporalPresentationError, null);
        assert.equal(queueSubmissionCount(rig), submissionsBefore + 2);
        assert.equal(frameProofs(rig).length, proofsBefore + 1);
        assert.equal(rig.terminals.slice(terminalsBefore).some(receipt => receipt.sphStep === 127), false);
        assert.equal(timers.pendingCount, 1, 'only replacement owns the next timer');
        setWallMs(1400);
        timers.fireNext();
        await new Promise(resolve => setImmediate(resolve));
        assert.equal(rig.terminals.at(-1).sphStep, 191);
      } else {
        assert.equal(queueSubmissionCount(rig), submissionsBefore + 1);
        assert.equal(frameProofs(rig).length, proofsBefore);
        assert.equal(rig.terminals.length, terminalsBefore);
        assert.equal(timers.pendingCount, 0);
      }
    } finally {
      observer.resolve(timedOutPresentationOpportunity());
      await disposal;
      await rig.presenter.dispose();
    }
  });
}

test('opportunity recovery never converts an explicit canonical timeout into successful proof', async t => {
  const { rig, setWallMs } = await createControlledMotionRig(t);
  try {
    const submissionsBefore = queueSubmissionCount(rig);
    const proofsBefore = frameProofs(rig).length;
    const terminalsBefore = rig.terminals.length;
    rig.setPresentationOpportunity(timedOutPresentationOpportunity);
    setWallMs(1200);
    await assert.rejects(rig.presenter.presentSubmissionBoundary({ submissionOrdinal: 1,
      completedSubstepCount: 2, totalSubstepCount: 64, chunkStepCount: 2 }));
    assert.equal(queueSubmissionCount(rig), submissionsBefore + 1);
    assert.equal(frameProofs(rig).length, proofsBefore);
    assert.equal(rig.terminals.length, terminalsBefore);
    assert.equal(rig.presenter.getStatus().temporalMotionAgeS, 0);
  } finally {
    await rig.presenter.dispose();
  }
});

test('queued autonomous motion coalesces a canonical duplicate without losing future motion or explicit redraws', async t => {
  const { rig, timers, setWallMs } = await createControlledMotionRig(t);
  const cameraFence = deferred();
  const boundary = { submissionOrdinal: 1, completedSubstepCount: 2,
    totalSubstepCount: 64, chunkStepCount: 2 };
  try {
    const submissionsBefore = queueSubmissionCount(rig);
    const proofsBefore = rig.submittedFrames.filter(value => !Array.isArray(value)).length;
    const terminalsBefore = rig.terminals.length;
    const opportunitiesBefore = rig.presentationOpportunityCalls;
    rig.setQueueCompletion(cameraFence.promise);
    setWallMs(1500);
    const camera = rig.presenter.redraw({ reason: 'controlled-lane-blocking-camera' });
    await waitFor(() => queueSubmissionCount(rig) === submissionsBefore + 1, 'camera occupies render lane');
    const canonical = rig.presenter.presentSubmissionBoundary(boundary);
    timers.fireNext();
    // Flush the resumed ordinary loop into the lane behind the canonical
    // callback, without advancing a real timer or releasing the camera fence.
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(queueSubmissionCount(rig), submissionsBefore + 1);
    assert.equal(rig.terminals.length, terminalsBefore);
    setWallMs(1600);
    rig.setQueueCompletion(Promise.resolve());
    cameraFence.resolve();
    assert.equal(await camera, true);
    const canonicalProof = await canonical;
    assert.ok(Math.abs(canonicalProof.isosurfacePresentationMotionAgeS - 0.0384) < 1e-12);
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(queueSubmissionCount(rig), submissionsBefore + 2,
      'queued ordinary age already covered by canonical must not submit a duplicate');
    assert.equal(rig.submittedFrames.filter(value => !Array.isArray(value)).length, proofsBefore + 2,
      'coalescing cannot mint a frame proof');
    assert.equal(rig.presentationOpportunityCalls, opportunitiesBefore + 2,
      'coalescing cannot request a presentation opportunity');
    assert.equal(rig.terminals.length, terminalsBefore + 2,
      'coalescing cannot publish a rendered terminal receipt');
    assert.equal(timers.pendingCount, 1, 'ordinary pacing remains scheduled after coalescing');

    setWallMs(1700);
    timers.fireNext();
    await waitFor(() => rig.terminals.length === terminalsBefore + 3, 'ordinary motion resumes');
    const ordinary = rig.terminals.at(-1);
    assert.equal(queueSubmissionCount(rig), submissionsBefore + 3);
    assert.equal(ordinary.sphStep, 127);
    assert.ok(Math.abs(ordinary.isosurfacePresentationMotionAgeS - 0.0448) < 1e-12);
    assert.equal(ordinary.physicsQueuePrefixCoverage, 'physics-queue-prefix-not-attributed');
    assert.equal(ordinary.physicsHostQueueFenceParticipation, null);
    assert.equal(ordinary.motionPresentationQosBoundary, undefined);
    assert.notEqual(ordinary.physicsContinuationBlocked, true);
    assert.equal(ordinary.presentationOnly, true);
    assert.equal(ordinary.authoritativeStateMutation, false);

    const sameAge = rig.presenter.getStatus().temporalMotionAgeS;
    assert.equal(await rig.presenter.redraw({ cameraPositionM: [2, 4, 6] }), true);
    assert.equal(queueSubmissionCount(rig), submissionsBefore + 4,
      'same-age explicit camera redraw still submits');
    const appearance = { backgroundClearValue: { r: 0.2, g: 0.3, b: 0.4, a: 1 } };
    assert.equal(await rig.presenter.redraw({ nativeSurfaceAppearance: appearance }), true);
    assert.equal(queueSubmissionCount(rig), submissionsBefore + 5,
      'same-age explicit appearance redraw still submits');
    assert.equal(rig.presenter.getStatus().temporalMotionAgeS, sameAge);
    assert.deepEqual(rig.materialCalls.findLast(call => call.type === 'prepare').appearance,
      appearance);
  } finally {
    cameraFence.resolve();
    await rig.presenter.dispose();
  }
});

test('queued autonomous motion stops after canonical horizon saturation and restarts for a new source', async t => {
  const { rig, timers, enqueue, setWallMs } = await createControlledMotionRig(t);
  const cameraFence = deferred();
  try {
    const submissionsBefore = queueSubmissionCount(rig);
    const terminalsBefore = rig.terminals.length;
    rig.setQueueCompletion(cameraFence.promise);
    setWallMs(1500);
    const camera = rig.presenter.redraw({ reason: 'controlled-horizon-camera' });
    await waitFor(() => queueSubmissionCount(rig) === submissionsBefore + 1, 'camera holds horizon ordering');
    const canonical = rig.presenter.presentSubmissionBoundary({ submissionOrdinal: 1,
      completedSubstepCount: 2, totalSubstepCount: 64, chunkStepCount: 2 });
    timers.fireNext();
    await new Promise(resolve => setImmediate(resolve));
    setWallMs(3000);
    rig.setQueueCompletion(Promise.resolve());
    cameraFence.resolve();
    assert.equal(await camera, true);
    assert.equal((await canonical).isosurfacePresentationMotionAgeS, 0.064);
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(queueSubmissionCount(rig), submissionsBefore + 2,
      'coalesced horizon frame adds no GPU submission');
    assert.equal(rig.terminals.length, terminalsBefore + 2);
    assert.equal(timers.pendingCount, 0, 'saturated ordinary loop stops instead of spinning');
    setWallMs(4000);
    assert.equal(await rig.presenter.redraw({ cameraPositionM: [3, 4, 5] }), true,
      'saturation does not suppress explicit camera redraw');
    assert.equal(rig.presenter.getStatus().temporalMotionAgeS, 0.064);
    assert.equal(timers.pendingCount, 0);

    await enqueue(191, 0.192);
    await waitFor(() => rig.presenter.getStatus().visibleSphStep === 191, 'replacement after saturated source');
    assert.equal(rig.presenter.getStatus().temporalMotionAgeS, 0);
    assert.equal(timers.pendingCount, 1, 'new progressing source starts its own ordinary loop');
    const replacementTerminals = rig.terminals.length;
    setWallMs(4500);
    timers.fireNext();
    await waitFor(() => rig.terminals.length > replacementTerminals, 'new source ordinary motion');
    assert.equal(rig.terminals.at(-1).sphStep, 191);
    assert.ok(rig.terminals.at(-1).isosurfacePresentationMotionAgeS > 0);
    assert.equal(rig.terminals.at(-1).physicsQueuePrefixCoverage,
      'physics-queue-prefix-not-attributed');
  } finally {
    cameraFence.resolve();
    await rig.presenter.dispose();
  }
});

for (const invalidation of ['clear', 'replacement']) {
  test(`queued autonomous motion cannot resurrect a source after ${invalidation}`, async t => {
    const { rig, timers, enqueue, setWallMs } = await createControlledMotionRig(t);
    const cameraFence = deferred();
    try {
      const submissionsBefore = queueSubmissionCount(rig);
      const terminalsBefore = rig.terminals.length;
      rig.setQueueCompletion(cameraFence.promise);
      setWallMs(1500);
      const camera = rig.presenter.redraw({ reason: 'controlled-invalidation-camera' });
      await waitFor(() => queueSubmissionCount(rig) === submissionsBefore + 1, 'blocked camera before invalidation');
      const canonical = rig.presenter.presentSubmissionBoundary({ submissionOrdinal: 1,
        completedSubstepCount: 2, totalSubstepCount: 64, chunkStepCount: 2 });
      if (invalidation === 'replacement') {
        await enqueue(191, 0.192);
        // The fake builder is immediate; drain its microtasks so replacement
        // rendering enters the lane before the old ordinary callback.
        await new Promise(resolve => setImmediate(resolve));
      }
      timers.fireNext();
      await new Promise(resolve => setImmediate(resolve));
      if (invalidation === 'clear') rig.presenter.clear();
      setWallMs(1600);
      rig.setQueueCompletion(Promise.resolve());
      cameraFence.resolve();
      await camera;
      await canonical;
      await new Promise(resolve => setImmediate(resolve));
      if (invalidation === 'clear') {
        assert.equal(queueSubmissionCount(rig), submissionsBefore + 1);
        assert.equal(rig.terminals.length, terminalsBefore);
        assert.equal(rig.presenter.getStatus().visibleSphStep, null);
        assert.equal(timers.pendingCount, 0);
      } else {
        assert.equal(rig.presenter.getStatus().visibleSphStep, 191);
        assert.equal(queueSubmissionCount(rig), submissionsBefore + 3,
          'only camera, canonical and replacement submit; old ordinary callback is stale');
        const replacementIndex = rig.terminals.findIndex(receipt => receipt.sphStep === 191
          && receipt.status === ULG_WORKER_OFFSCREEN_RESIDENT_ISOSURFACE_PRESENTATION_RENDERED_STATUS);
        assert.ok(replacementIndex >= 0);
        setWallMs(1700);
        timers.fireNext();
        await new Promise(resolve => setImmediate(resolve));
        assert.equal(rig.terminals.slice(replacementIndex + 1).some(receipt => receipt.sphStep === 127), false);
      }
    } finally {
      cameraFence.resolve();
      await rig.presenter.dispose();
    }
  });
}

test('retained isosurface motion redraws while replacement builds and preserves the source step', async () => {
  let wallMs = 0;
  let blockReplacement = false;
  const buildGate = deferred();
  const motionFields = [];
  const rig = createPresenterRig({
    temporalNowMs: () => wallMs,
    buildPresentationFrame: async job => {
      if (blockReplacement) await buildGate.promise;
      const motionField = { buffer: new GPUBuffer(128, 128), rowCount: 8, destroyed: false,
        destroy() { assert.equal(this.destroyed, false); this.destroyed = true; } };
      motionFields.push(motionField);
      return { generation: job.generation, invalidationEpoch: job.invalidationEpoch,
        sphStep: job.sphStep, receiptFields: job.receiptFields,
        viewProjectionMatrix: [...job.admission.viewProjectionMatrix],
        cameraPositionM: [...job.admission.cameraPositionM], surfaces: [], motionField };
    }
  });
  const enqueue = async (step, time) => {
    const retained = validRetained();
    retained.sphParticleUpload.time = time;
    return rig.presenter.enqueue({ request: validRequest(), retained, sphStep: step,
      receiptFields: { laneId: 'test-lane', stateKey: 'test-state', sphStep: step } });
  };
  try {
    await enqueue(63, 0.064);
    await waitFor(() => rig.presenter.getStatus().visibleSphStep === 63, 'first source');
    assert.equal(rig.presenter.getStatus().temporalMotionReady, false);
    wallMs = 1000;
    await enqueue(127, 0.128);
    await waitFor(() => rig.presenter.getStatus().visibleSphStep === 127, 'second source');
    assert.equal(rig.presenter.getStatus().temporalMotionReady, true);
    blockReplacement = true;
    await enqueue(191, 0.192);
    await waitFor(() => rig.presenter.getStatus().activeGeneration === 3, 'replacement building');
    wallMs = 1500;
    await new Promise(resolve => setTimeout(resolve, 25));
    await waitFor(() => rig.terminals.some(r => r.isosurfaceTemporalPresentation), 'temporal draw during build');
    const proof = rig.terminals.findLast(r => r.isosurfaceTemporalPresentation);
    assert.equal(proof.sphStep, 127);
    assert.equal(proof.isosurfacePresentationMotionAgeS, 0.032);
    assert.equal(proof.authoritativeStateMutation, false);
    assert.equal(motionFields[1].destroyed, false);
    buildGate.resolve();
    await waitFor(() => rig.presenter.getStatus().visibleSphStep === 191, 'replacement visible');
    const replacementReceiptIndex = rig.terminals.findIndex(r => r.sphStep === 191
      && r.status === ULG_WORKER_OFFSCREEN_RESIDENT_ISOSURFACE_PRESENTATION_RENDERED_STATUS);
    wallMs = 1600;
    await new Promise(resolve => setTimeout(resolve, 25));
    assert.equal(rig.terminals.slice(replacementReceiptIndex + 1).some(r =>
      r.sphStep === 127 && r.status === ULG_WORKER_OFFSCREEN_RESIDENT_ISOSURFACE_PRESENTATION_RENDERED_STATUS), false);
    rig.presenter.clear();
    const afterClear = rig.terminals.length;
    wallMs = 2000;
    await new Promise(resolve => setTimeout(resolve, 25));
    assert.equal(rig.terminals.length, afterClear);
  } finally {
    buildGate.resolve();
    await rig.presenter.dispose();
  }
  assert.ok(motionFields.every(field => field.destroyed));
});

test('retained submission gap acknowledges queueing but keeps full proof on the render lane', async t => {
  const { rig, setWallMs } = await createControlledMotionRig(t);
  const fence = deferred();
  const opportunity = deferred();
  try {
    const before = queueSubmissionCount(rig);
    const proofsBefore = frameProofs(rig).length;
    const registrationsBefore = rig.presentationOpportunityRegistrations.length;
    rig.setQueueCompletion(fence.promise);
    rig.setPresentationOpportunity(() => opportunity.promise);
    setWallMs(1500);
    assert.equal(rig.presenter.hasRetainedSubmissionGapOpportunity(), true);
    assert.equal(await rig.presenter.presentRetainedSubmissionGap(), true);
    assert.equal(rig.presenter.hasRetainedSubmissionGapOpportunity(), false);
    assert.equal(queueSubmissionCount(rig), before + 1);
    assert.equal(rig.presentationOpportunityRegistrations.length, registrationsBefore + 1);
    assert.equal(frameProofs(rig).length, proofsBefore);
    assert.equal(rig.presenter.getStatus().temporalMotionAgeS, 0);
    assert.equal(await rig.presenter.presentRetainedSubmissionGap(), false,
      'the slot remains occupied after the early submission acknowledgement');
    const camera = rig.presenter.redraw({ viewProjectionMatrix: viewProjectionWithTranslation(3) });
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(queueSubmissionCount(rig), before + 1, 'camera cannot overtake pending proof');
    fence.resolve();
    await waitFor(() => rig.presentationOpportunityCalls === registrationsBefore + 1, 'post-GPU observer');
    assert.equal(frameProofs(rig).length, proofsBefore, 'GPU alone is not a presentation');
    assert.equal(queueSubmissionCount(rig), before + 1);
    opportunity.resolve(admittedPresentationOpportunity());
    assert.equal(await camera, true);
    const proof = frameProofs(rig).find(p => p.reason === 'worker-owned-isosurface-retained-submission-gap');
    assert.equal(proof.isosurfacePresentationSourceTimeS, 0.128);
    assert.equal(proof.isosurfacePresentationMotionAgeS, 0.032);
    assert.equal(proof.authoritativeStateMutation, false);
    assert.equal(proof.motionPresentationQosBoundary, undefined);
    assert.equal(proof.physicsContinuationBlocked, undefined);
    assert.equal(proof.physicsHostQueueFenceParticipation, null);
    assert.notEqual(proof.physicsQueuePrefixCoverage, 'physics-queue-prefix-included');
    assert.equal(proof.presentationFrameAdmitted, true);
    assert.equal(rig.terminals.filter(p => p.presentationQueueCompletionSerial
      === proof.presentationQueueCompletionSerial).length, 1);
    setWallMs(1750);
    assert.equal(await rig.presenter.presentRetainedSubmissionGap(), true,
      'a new advancing request is allowed after the whole previous draw drains');
  } finally {
    fence.resolve(); opportunity.resolve(admittedPresentationOpportunity());
    await rig.presenter.dispose();
  }
});

test('final retained gap wait is opt-in, pure, and bounded to one prospective request', async t => {
  const { rig, setWallMs } = await createControlledMotionRig(t);
  const oldFence = deferred();
  const controller = new AbortController();
  try {
    rig.setQueueCompletion(oldFence.promise);
    setWallMs(1500);
    assert.equal(await rig.presenter.presentRetainedSubmissionGap(), true);
    const submissionsBefore = queueSubmissionCount(rig);
    const proofsBefore = frameProofs(rig).length;
    assert.equal(rig.presenter.hasRetainedSubmissionGapOpportunity(), false);
    for (const waitForPendingSlot of [false, 1, 'true', {}, null]) {
      assert.equal(rig.presenter.hasRetainedSubmissionGapOpportunity({ waitForPendingSlot }), false);
      assert.equal(await rig.presenter.presentRetainedSubmissionGap({ waitForPendingSlot }), false);
    }
    assert.equal(rig.presenter.hasRetainedSubmissionGapOpportunity({ waitForPendingSlot: true }), true);
    assert.equal(queueSubmissionCount(rig), submissionsBefore, 'readiness has no GPU side effects');
    assert.equal(frameProofs(rig).length, proofsBefore);
    assert.equal(rig.presenter.getStatus().temporalMotionAgeS, 0);
    let settled = false;
    const waiting = rig.presenter.presentRetainedSubmissionGap({
      waitForPendingSlot: true, signal: controller.signal
    }).then(value => { settled = true; return value; });
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(settled, false, 'the single prospective request waits outside the occupied render lane');
    assert.equal(rig.presenter.hasRetainedSubmissionGapOpportunity({ waitForPendingSlot: true }), false);
    assert.equal(await rig.presenter.presentRetainedSubmissionGap({ waitForPendingSlot: true }), false);
    assert.equal(queueSubmissionCount(rig), submissionsBefore);
    controller.abort();
    assert.equal(await waiting, false);
    assert.equal(rig.presentationOpportunityRegistrations.at(-1).signal.aborted, false,
      'cancelling the prospective request does not cancel its predecessor proof');
  } finally { controller.abort(); oldFence.resolve(); await rig.presenter.dispose(); }
});

test('final retained gap wait claims one slot only after the older full proof succeeds', async t => {
  const { rig, timers, setWallMs } = await createControlledMotionRig(t);
  const oldFence = deferred();
  const oldOpportunity = deferred();
  const newFence = deferred();
  const newOpportunity = deferred();
  try {
    const submissionsBefore = queueSubmissionCount(rig);
    const proofsBefore = frameProofs(rig).length;
    rig.setQueueCompletion(oldFence.promise);
    rig.setPresentationOpportunity(() => oldOpportunity.promise);
    setWallMs(1500);
    assert.equal(await rig.presenter.presentRetainedSubmissionGap(), true);
    let settled = false;
    setWallMs(1505);
    const waiting = rig.presenter.presentRetainedSubmissionGap({ waitForPendingSlot: true })
      .then(value => { settled = true; return value; });
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(settled, false);
    assert.equal(queueSubmissionCount(rig), submissionsBefore + 1);
    oldFence.resolve();
    await waitFor(() => rig.presentationOpportunityCalls === 3, 'older post-GPU opportunity observer');
    assert.equal(settled, false, 'GPU completion alone does not release the old proof slot');
    assert.equal(frameProofs(rig).length, proofsBefore);
    rig.setQueueCompletion(newFence.promise);
    rig.setPresentationOpportunity(() => newOpportunity.promise);
    oldOpportunity.resolve(admittedPresentationOpportunity());
    assert.equal(await waiting, true, 'fresh draw acknowledges submission without awaiting its own proof');
    assert.equal(queueSubmissionCount(rig), submissionsBefore + 2);
    assert.equal(frameProofs(rig).length, proofsBefore + 1);
    assert.equal(rig.presenter.getStatus().temporalMotionAgeS, 0.032);
    assert.equal(rig.presenter.hasRetainedSubmissionGapOpportunity(), false);
    assert.equal(await rig.presenter.presentRetainedSubmissionGap(), false);
    assert.equal(timers.pendingCount, 1, 'the new submission timer is cancelled, not its full proof');
    setWallMs(1700); // The submission deadline must not become a post-submit proof deadline.
    newFence.resolve();
    await waitFor(() => rig.presentationOpportunityCalls === 4, 'new post-GPU opportunity observer');
    assert.equal(frameProofs(rig).length, proofsBefore + 1);
    newOpportunity.resolve(admittedPresentationOpportunity());
    await waitFor(() => frameProofs(rig).length === proofsBefore + 2, 'new exact full proof');
    const proof = frameProofs(rig).at(-1);
    assert.equal(proof.isosurfacePresentationSourceTimeS, 0.128);
    assert.equal(proof.isosurfacePresentationMotionAgeS, 0.03232);
    assert.equal(proof.authoritativeStateMutation, false);
    assert.equal(proof.presentationFrameAdmitted, true);
    assert.equal(rig.presenter.getStatus().visibleSphStep, 127);
  } finally {
    oldFence.resolve(); newFence.resolve();
    oldOpportunity.resolve(admittedPresentationOpportunity());
    newOpportunity.resolve(admittedPresentationOpportunity());
    await rig.presenter.dispose();
  }
});

for (const claimAt of ['direct', 'after-old-proof']) {
  test(`final retained gap wait contains a synchronous ${claimAt} claim failure and frees its slot`, async t => {
    const { rig, timers, setWallMs } = await createControlledMotionRig(t);
    const oldFence = deferred();
    const injectedError = new Error('injected claim framebuffer recheck failure');
    let injected = false;
    let settled = false;
    let result = null;
    try {
      setWallMs(1500);
      if (claimAt === 'after-old-proof') {
        rig.setQueueCompletion(oldFence.promise);
        assert.equal(await rig.presenter.presentRetainedSubmissionGap(), true);
        rig.setFrameSubmissionObserver(receipt => {
          if (receipt.reason === 'worker-owned-isosurface-retained-submission-gap') {
            // Arm only after the old exact proof, never during its own checks.
            rig.setFramebufferEpochObserver(epoch => {
              if (!injected) { injected = true; throw injectedError; }
              return epoch;
            });
          }
        });
      } else {
        let reads = 0;
        rig.setFramebufferEpochObserver(epoch => {
          // Entry epoch capture succeeds; the synchronous claim recheck fails.
          if (++reads === 2) { injected = true; throw injectedError; }
          return epoch;
        });
      }
      const submissionsBefore = queueSubmissionCount(rig);
      setWallMs(1505);
      let queued;
      assert.doesNotThrow(() => {
        queued = rig.presenter.presentRetainedSubmissionGap({ waitForPendingSlot: true });
      }, 'optional presentation scheduling does not throw into the physics caller');
      assert.equal(typeof queued?.then, 'function');
      void queued.then(value => { settled = true; result = value; });
      rig.setQueueCompletion(Promise.resolve());
      oldFence.resolve();
      await waitFor(() => settled, 'failed claim settles without awaiting its timer');
      assert.equal(injected, true, 'the intended post-entry claim gate actually threw');
      assert.equal(result, false);
      await new Promise(resolve => setImmediate(resolve)); // Unhandled rejections fail node:test.
      assert.equal(queueSubmissionCount(rig), submissionsBefore);
      assert.equal(timers.pendingCount, 1, 'failed claim removes its submission timer');
      rig.setFrameSubmissionObserver(null);
      rig.setFramebufferEpochObserver(null);
      setWallMs(1510);
      assert.equal(rig.presenter.hasRetainedSubmissionGapOpportunity(), true,
        'failure leaves neither active nor prospective slot stranded');
      const proofsBefore = frameProofs(rig).length;
      assert.equal(await rig.presenter.presentRetainedSubmissionGap(), true);
      await waitFor(() => frameProofs(rig).length === proofsBefore + 1, 'fresh explicit request has exact proof');
      assert.equal(queueSubmissionCount(rig), submissionsBefore + 1);
      assert.equal(rig.presenter.getStatus().visibleSphStep, 127);
    } finally {
      rig.setFrameSubmissionObserver(null);
      rig.setFramebufferEpochObserver(null);
      oldFence.resolve();
      await rig.presenter.dispose();
    }
  });
}

test('final retained gap wait declines when its predecessor consumes the available motion age', async t => {
  const { rig, setWallMs } = await createControlledMotionRig(t);
  const fence = deferred();
  try {
    rig.setQueueCompletion(fence.promise);
    setWallMs(1500);
    assert.equal(await rig.presenter.presentRetainedSubmissionGap(), true);
    const before = queueSubmissionCount(rig);
    const waiting = rig.presenter.presentRetainedSubmissionGap({ waitForPendingSlot: true });
    rig.setQueueCompletion(Promise.resolve());
    fence.resolve();
    assert.equal(await waiting, false, 'one full proof consumed this exact age; no forced advancement');
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(queueSubmissionCount(rig), before);
    assert.equal(rig.presenter.getStatus().temporalMotionAgeS, 0.032);
    assert.equal(rig.presenter.getStatus().visibleSphStep, 127);
  } finally { fence.resolve(); await rig.presenter.dispose(); }
});

test('final retained gap wait timeout leaves the older proof live and cannot submit after late completion', async t => {
  const { rig, timers, setWallMs } = await createControlledMotionRig(t);
  const fence = deferred();
  try {
    rig.setQueueCompletion(fence.promise);
    setWallMs(1500);
    assert.equal(await rig.presenter.presentRetainedSubmissionGap(), true);
    const oldSignal = rig.presentationOpportunityRegistrations.at(-1).signal;
    const before = queueSubmissionCount(rig);
    setWallMs(1505);
    const waiting = rig.presenter.presentRetainedSubmissionGap({ waitForPendingSlot: true });
    assert.equal(timers.pendingCount, 2, 'one existing temporal timer and the sole new submission deadline');
    timers.fireLatest();
    assert.equal(await waiting, false);
    assert.equal(oldSignal.aborted, false);
    assert.equal(queueSubmissionCount(rig), before);
    setWallMs(1550);
    rig.setQueueCompletion(Promise.resolve());
    fence.resolve();
    await waitFor(() => rig.presenter.getStatus().temporalMotionAgeS === 0.032, 'older proof remains admissible');
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(queueSubmissionCount(rig), before, 'late predecessor completion cannot revive the timed-out waiter');
    assert.equal(rig.presenter.getStatus().visibleSphStep, 127);
  } finally { fence.resolve(); await rig.presenter.dispose(); }
});

for (const overrunAt of ['slot', 'lane', 'prepare', 'finish']) {
  test(`final retained gap wait keeps one absolute deadline through ${overrunAt}`, async t => {
    const fence = deferred();
    const preparation = deferred();
    let blockPreparation = false;
    let enteredPreparation = false;
    let finishCount = 0;
    let camera = null;
    const { rig, setWallMs } = await createControlledMotionRig(t, {
      nativeMaterialOverrides: { async prepare() {
        if (blockPreparation) { enteredPreparation = true; await preparation.promise; }
      } }
    });
    try {
      rig.setQueueCompletion(fence.promise);
      setWallMs(1500);
      assert.equal(await rig.presenter.presentRetainedSubmissionGap(), true);
      const before = queueSubmissionCount(rig);
      if (overrunAt === 'lane') {
        blockPreparation = true;
        camera = rig.presenter.redraw({ viewProjectionMatrix: viewProjectionWithTranslation(4) });
      }
      setWallMs(1505);
      const waiting = rig.presenter.presentRetainedSubmissionGap({ waitForPendingSlot: true });
      if (overrunAt === 'prepare') blockPreparation = true;
      if (overrunAt === 'finish') {
        const createEncoder = rig.device.createCommandEncoder.bind(rig.device);
        rig.device.createCommandEncoder = () => {
          const encoder = createEncoder();
          const finish = encoder.finish.bind(encoder);
          encoder.finish = () => { finishCount += 1; setWallMs(1522); return finish(); };
          return encoder;
        };
      }
      setWallMs(overrunAt === 'slot' ? 1522 : 1520);
      rig.setQueueCompletion(Promise.resolve());
      fence.resolve();
      if (overrunAt === 'prepare' || overrunAt === 'lane') {
        await waitFor(() => enteredPreparation, 'new gap preparation after old slot release');
        setWallMs(1522);
        blockPreparation = false;
        preparation.resolve();
      }
      assert.equal(await waiting, false, 'no fresh 16.667ms budget after waiting');
      if (camera) assert.equal(await camera, true);
      await new Promise(resolve => setImmediate(resolve));
      assert.equal(queueSubmissionCount(rig), before + (camera ? 1 : 0));
      if (overrunAt === 'finish') assert.equal(finishCount, 1, 'encoding reached its late finish gate');
      assert.equal(rig.presenter.getStatus().temporalMotionAgeS, 0.032);
    } finally { blockPreparation = false; preparation.resolve(); fence.resolve(); await rig.presenter.dispose(); }
  });
}

test('final retained gap wait cannot overtake an autonomous render that consumes its age', async t => {
  const { rig, timers, setWallMs } = await createControlledMotionRig(t);
  const fence = deferred();
  try {
    rig.setQueueCompletion(fence.promise);
    setWallMs(1500);
    assert.equal(await rig.presenter.presentRetainedSubmissionGap(), true);
    const before = queueSubmissionCount(rig);
    const proofsBefore = frameProofs(rig).length;
    setWallMs(1505);
    timers.fireNext(); // The existing autonomous request enters the lane behind the old proof.
    await new Promise(resolve => setImmediate(resolve));
    const waiting = rig.presenter.presentRetainedSubmissionGap({ waitForPendingSlot: true });
    assert.equal(queueSubmissionCount(rig), before, 'neither autonomous nor prospective work overtakes the proof');
    rig.setQueueCompletion(Promise.resolve());
    fence.resolve();
    assert.equal(await waiting, false, 'the autonomous successor already consumed this age');
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(queueSubmissionCount(rig), before + 1, 'only the ordinary autonomous draw is newly submitted');
    const proofs = frameProofs(rig).slice(proofsBefore);
    assert.equal(proofs.length, 2);
    assert.equal(proofs.filter(p => p.reason === 'worker-owned-isosurface-retained-submission-gap').length, 1);
    assert.equal(rig.presenter.getStatus().temporalMotionAgeS, 0.03232);
  } finally { fence.resolve(); await rig.presenter.dispose(); }
});

for (const failure of ['fence', 'opportunity', 'unavailable', 'old-abort']) {
  test(`final retained gap wait never retries after older ${failure} failure`, async t => {
    const { rig, setWallMs } = await createControlledMotionRig(t);
    const fence = deferred();
    const oldController = new AbortController();
    try {
      rig.setQueueCompletion(fence.promise);
      if (failure === 'opportunity') rig.setPresentationOpportunity(() => {
        throw new Error('injected older opportunity failure');
      });
      if (failure === 'unavailable') rig.setPresentationOpportunity(() => ({
        available: false, method: 'test-opportunity-unavailable'
      }));
      setWallMs(1500);
      assert.equal(await rig.presenter.presentRetainedSubmissionGap({ signal: oldController.signal }), true);
      const before = queueSubmissionCount(rig);
      const proofsBefore = frameProofs(rig).length;
      setWallMs(1505);
      const waiting = rig.presenter.presentRetainedSubmissionGap({ waitForPendingSlot: true });
      if (failure === 'old-abort') oldController.abort();
      if (failure === 'fence') fence.reject(new Error('injected older queue failure'));
      else fence.resolve();
      assert.equal(await waiting, false);
      await new Promise(resolve => setImmediate(resolve));
      assert.equal(queueSubmissionCount(rig), before);
      assert.equal(frameProofs(rig).length, proofsBefore);
      assert.equal(rig.presenter.getStatus().temporalMotionAgeS, 0);
      assert.equal(rig.presenter.getStatus().visibleSphStep, 127);
    } finally { fence.resolve(); await rig.presenter.dispose(); }
  });
}

for (const invalidation of ['abort', 'pause', 'pause-resume', 'resize', 'epoch-only', 'clear', 'source', 'dispose']) {
  test(`final retained gap wait remains pinned across ${invalidation}`, async t => {
    const { rig, enqueue, setWallMs } = await createControlledMotionRig(t);
    const fence = deferred();
    const controller = new AbortController();
    let retirement = null;
    try {
      rig.setQueueCompletion(fence.promise);
      setWallMs(1500);
      assert.equal(await rig.presenter.presentRetainedSubmissionGap(), true);
      const submissionsBefore = queueSubmissionCount(rig);
      setWallMs(1505);
      const waiting = rig.presenter.presentRetainedSubmissionGap({
        waitForPendingSlot: true, signal: controller.signal
      });
      if (invalidation === 'abort') controller.abort();
      if (invalidation.startsWith('pause')) rig.presenter.setPresentationPlaying(false);
      if (invalidation === 'pause-resume') rig.presenter.setPresentationPlaying(true);
      if (invalidation === 'resize' || invalidation === 'epoch-only') rig.setFramebufferEpoch(2);
      if (invalidation === 'resize') retirement = rig.presenter.resize();
      if (invalidation === 'clear') rig.presenter.clear();
      if (invalidation === 'source') await enqueue(191, 0.192);
      if (invalidation === 'dispose') retirement = rig.presenter.dispose();
      assert.equal(queueSubmissionCount(rig), submissionsBefore, 'the waiter never overtakes the older proof');
      rig.setQueueCompletion(Promise.resolve());
      fence.resolve();
      assert.equal(await waiting, false);
      await retirement;
      await new Promise(resolve => setImmediate(resolve));
      const gapProofs = frameProofs(rig).filter(p => p.reason
        === 'worker-owned-isosurface-retained-submission-gap');
      assert.ok(gapProofs.length <= 1, 'there is at most the older gap, never a retargeted waiter');
      assert.ok(gapProofs.every(p => p.isosurfacePresentationMotionAgeS === 0.032));
      if (invalidation === 'source') {
        await waitFor(() => rig.presenter.getStatus().visibleSphStep === 191, 'replacement source admission');
        assert.equal(queueSubmissionCount(rig), submissionsBefore + 1,
          'only the independently requested source can draw after the old slot');
      }
    } finally { controller.abort(); fence.resolve(); await rig.presenter.dispose(); }
  });
}

test('final retained gap wait cannot bypass missing, paused, nonadvancing, or exhausted motion', async t => {
  const empty = createPresenterRig();
  assert.equal(empty.presenter.hasRetainedSubmissionGapOpportunity({ waitForPendingSlot: true }), false);
  assert.equal(await empty.presenter.presentRetainedSubmissionGap({ waitForPendingSlot: true }), false);
  await empty.presenter.dispose();
  const { rig, setWallMs } = await createControlledMotionRig(t);
  try {
    const before = queueSubmissionCount(rig);
    assert.equal(rig.presenter.hasRetainedSubmissionGapOpportunity({ waitForPendingSlot: true }), false);
    assert.equal(await rig.presenter.presentRetainedSubmissionGap({ waitForPendingSlot: true }), false);
    setWallMs(1500);
    assert.equal(rig.presenter.hasRetainedSubmissionGapOpportunity(), true);
    for (const waitForPendingSlot of [1, 'true', {}, null]) {
      assert.equal(rig.presenter.hasRetainedSubmissionGapOpportunity({ waitForPendingSlot }), false);
      assert.equal(await rig.presenter.presentRetainedSubmissionGap({ waitForPendingSlot }), false,
        'malformed options cannot silently become an ordinary draw either');
    }
    rig.presenter.setPresentationPlaying(false);
    setWallMs(1500);
    assert.equal(rig.presenter.hasRetainedSubmissionGapOpportunity({ waitForPendingSlot: true }), false);
    assert.equal(await rig.presenter.presentRetainedSubmissionGap({ waitForPendingSlot: true }), false);
    rig.presenter.setPresentationPlaying(true);
    setWallMs(3500);
    assert.equal(rig.presenter.hasRetainedSubmissionGapOpportunity({ waitForPendingSlot: true }), false);
    assert.equal(await rig.presenter.presentRetainedSubmissionGap({ waitForPendingSlot: true }), false);
    assert.equal(queueSubmissionCount(rig), before);
  } finally { await rig.presenter.dispose(); }
});

for (const invalidation of ['abort', 'pause', 'pause-resume', 'resize', 'clear', 'dispose']) {
  test(`retained submission gap revokes late proof after ${invalidation}`, async t => {
    const { rig, setWallMs } = await createControlledMotionRig(t);
    const fence = deferred();
    const controller = new AbortController();
    let pending = null;
    try {
      rig.setQueueCompletion(fence.promise);
      setWallMs(1500);
      const acknowledged = await rig.presenter.presentRetainedSubmissionGap({ signal: controller.signal });
      assert.equal(acknowledged, true);
      if (invalidation === 'abort') controller.abort();
      if (invalidation.startsWith('pause')) rig.presenter.setPresentationPlaying(false);
      if (invalidation === 'pause-resume') rig.presenter.setPresentationPlaying(true);
      if (invalidation === 'resize') {
        rig.setFramebufferEpoch(2);
        pending = rig.presenter.resize();
      }
      if (invalidation === 'clear') rig.presenter.clear();
      if (invalidation === 'dispose') pending = rig.presenter.dispose();
      rig.setQueueCompletion(Promise.resolve());
      fence.resolve();
      await pending;
      await new Promise(resolve => setImmediate(resolve));
      assert.equal(frameProofs(rig).some(p => p.reason
        === 'worker-owned-isosurface-retained-submission-gap'), false);
      assert.equal(acknowledged, true, 'a submit ack never promised successful display');
    } finally { fence.resolve(); await rig.presenter.dispose(); }
  });
}

test('retained submission gap is bounded while queued and never submits after its deadline', async t => {
  const { rig, timers, setWallMs } = await createControlledMotionRig(t);
  const fence = deferred();
  try {
    rig.setQueueCompletion(fence.promise);
    const camera = rig.presenter.redraw({ viewProjectionMatrix: viewProjectionWithTranslation(2) });
    await waitFor(() => queueSubmissionCount(rig) === 3, 'camera holding the render lane');
    setWallMs(1500);
    const queued = rig.presenter.presentRetainedSubmissionGap();
    assert.equal(await rig.presenter.presentRetainedSubmissionGap(), false);
    timers.fireNext(); // Existing temporal timer; its draw also waits on the lane.
    timers.fireNext(); // This request's 16.67ms submission deadline.
    assert.equal(await queued, false);
    assert.equal(queueSubmissionCount(rig), 3);
    rig.setQueueCompletion(Promise.resolve());
    fence.resolve();
    await camera;
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(frameProofs(rig).some(p => p.reason
      === 'worker-owned-isosurface-retained-submission-gap'), false);
  } finally { fence.resolve(); await rig.presenter.dispose(); }
});

test('A1: physics is offered a gap behind a busy render lane only when presentation is starving', async t => {
  // The rig's last frame completed at wall 1000 ms. Below the starvation bound
  // a busy lane (a frame held through GPU completion) offers no gap, so the
  // solver never waits behind display frames; above it the bounded wait returns.
  const { rig, setWallMs } = await createControlledMotionRig(t);
  const fence = deferred();
  try {
    rig.setQueueCompletion(fence.promise);
    const camera = rig.presenter.redraw({ viewProjectionMatrix: viewProjectionWithTranslation(2) });
    await waitFor(() => queueSubmissionCount(rig) === 3, 'camera holding the render lane');
    setWallMs(1000 + RETAINED_GAP_STARVATION_MS / 2);
    assert.equal(rig.presenter.hasRetainedSubmissionGapOpportunity(), false, 'busy lane, not starving');
    assert.equal(rig.presenter.hasRetainedSubmissionGapOpportunity({ waitForPendingSlot: true }), false,
      'the final-batch wait cannot hold physics behind a busy lane either');
    const before = queueSubmissionCount(rig);
    assert.equal(await rig.presenter.presentRetainedSubmissionGap(), false);
    assert.equal(queueSubmissionCount(rig), before, 'no gap was queued');
    setWallMs(1000 + RETAINED_GAP_STARVATION_MS * 3);
    assert.equal(rig.presenter.hasRetainedSubmissionGapOpportunity(), true, 'starving: bounded wait allowed');
    rig.setQueueCompletion(Promise.resolve());
    fence.resolve();
    await camera;
    await new Promise(resolve => setImmediate(resolve));
    // The camera frame just completed on an idle lane: a gap is free to take.
    const completedAt = 1000 + RETAINED_GAP_STARVATION_MS * 3;
    setWallMs(completedAt + RETAINED_GAP_STARVATION_MS / 4);
    assert.equal(rig.presenter.hasRetainedSubmissionGapOpportunity(), true, 'idle lane, not starving');
  } finally { fence.resolve(); await rig.presenter.dispose(); }
});

test('retained submission gap cannot create motion from paused, missing or exhausted sources', async t => {
  const empty = createPresenterRig();
  assert.equal(await empty.presenter.presentRetainedSubmissionGap(), false);
  await empty.presenter.dispose();
  const { rig, setWallMs } = await createControlledMotionRig(t);
  try {
    assert.equal(await rig.presenter.presentRetainedSubmissionGap(), false, 'no age advancement');
    assert.equal(rig.presenter.hasRetainedSubmissionGapOpportunity(), false);
    rig.presenter.setPresentationPlaying(false);
    setWallMs(1500);
    assert.equal(await rig.presenter.presentRetainedSubmissionGap(), false, 'paused');
    assert.equal(rig.presenter.hasRetainedSubmissionGapOpportunity(), false);
    rig.presenter.setPresentationPlaying(true);
    setWallMs(3500);
    const before = queueSubmissionCount(rig);
    assert.equal(await rig.presenter.presentRetainedSubmissionGap(), false, 'spent physical horizon');
    assert.equal(rig.presenter.hasRetainedSubmissionGapOpportunity(), false);
    assert.equal(queueSubmissionCount(rig), before);
    const cancelled = new AbortController(); cancelled.abort();
    assert.equal(await rig.presenter.presentRetainedSubmissionGap({ signal: cancelled.signal }), false);
  } finally { await rig.presenter.dispose(); }
});

for (const delayAt of ['lane', 'prepare', 'finish']) {
  test(`retained submission gap rejects an overdue ${delayAt} even before its timer task runs`, async t => {
    const preparation = deferred();
    const fence = deferred();
    let block = false;
    let entered = false;
    const { rig, setWallMs } = await createControlledMotionRig(t, {
      nativeMaterialOverrides: { async prepare() {
        if (block) { entered = true; await preparation.promise; }
      } }
    });
    let camera = null;
    try {
      if (delayAt === 'lane') {
        rig.setQueueCompletion(fence.promise);
        camera = rig.presenter.redraw({ viewProjectionMatrix: viewProjectionWithTranslation(2) });
        await waitFor(() => queueSubmissionCount(rig) === 3, 'lane predecessor submitted');
      }
      if (delayAt === 'prepare') block = true;
      if (delayAt === 'finish') {
        const createEncoder = rig.device.createCommandEncoder.bind(rig.device);
        rig.device.createCommandEncoder = () => {
          const encoder = createEncoder();
          const finish = encoder.finish.bind(encoder);
          encoder.finish = () => { setWallMs(1600); return finish(); };
          return encoder;
        };
      }
      setWallMs(1500);
      const before = queueSubmissionCount(rig);
      const queued = rig.presenter.presentRetainedSubmissionGap();
      if (delayAt === 'prepare') await waitFor(() => entered, 'blocked preparation');
      if (delayAt !== 'finish') setWallMs(1600);
      // Do not fire any timer: promise continuations observe the late clock.
      rig.setQueueCompletion(Promise.resolve());
      block = false; preparation.resolve(); fence.resolve();
      assert.equal(await queued, false);
      await camera;
      assert.equal(queueSubmissionCount(rig), before);
      assert.equal(frameProofs(rig).some(p => p.reason
        === 'worker-owned-isosurface-retained-submission-gap'), false);
    } finally { preparation.resolve(); fence.resolve(); await rig.presenter.dispose(); }
  });
}

for (const invalidation of ['abort', 'pause', 'resize', 'clear', 'dispose']) {
  test(`retained submission gap settles while preparation is blocked on ${invalidation}`, async t => {
    const preparation = deferred();
    let block = false;
    let entered = false;
    const { rig, setWallMs } = await createControlledMotionRig(t, {
      nativeMaterialOverrides: { async prepare() {
        if (block) { entered = true; await preparation.promise; }
      } }
    });
    const controller = new AbortController();
    let retirement = null;
    try {
      block = true;
      setWallMs(1500);
      const before = queueSubmissionCount(rig);
      const queued = rig.presenter.presentRetainedSubmissionGap({ signal: controller.signal });
      await waitFor(() => entered, 'gap preparation blocked');
      if (invalidation === 'abort') controller.abort();
      if (invalidation === 'pause') rig.presenter.setPresentationPlaying(false);
      if (invalidation === 'resize') {
        rig.setFramebufferEpoch(2);
        retirement = rig.presenter.resize();
      }
      if (invalidation === 'clear') rig.presenter.clear();
      if (invalidation === 'dispose') retirement = rig.presenter.dispose();
      assert.equal(await queued, false, 'ack settles before the blocking resource is available');
      assert.equal(queueSubmissionCount(rig), before);
      block = false; preparation.resolve();
      await retirement;
      await new Promise(resolve => setImmediate(resolve));
      assert.equal(frameProofs(rig).some(p => p.reason
        === 'worker-owned-isosurface-retained-submission-gap'), false);
    } finally { preparation.resolve(); await rig.presenter.dispose(); }
  });
}

for (const failure of ['prepare', 'submit', 'fence', 'opportunity']) {
  test(`retained submission gap contains ${failure} errors without fabricating proof or retrying`, async t => {
    let rejectPrepare = false;
    const { rig, setWallMs } = await createControlledMotionRig(t, {
      nativeMaterialOverrides: { async prepare() {
        if (rejectPrepare) throw new Error('injected prepare failure');
      } }
    });
    try {
      const before = frameProofs(rig).length;
      const oldSubmit = rig.device.queue.submit;
      const oldFence = rig.device.queue.onSubmittedWorkDone;
      setWallMs(1500);
      if (failure === 'prepare') rejectPrepare = true;
      if (failure === 'submit') rig.device.queue.submit = () => { throw new Error('injected submit failure'); };
      if (failure === 'fence') rig.device.queue.onSubmittedWorkDone = () => Promise.reject(new Error('injected fence failure'));
      if (failure === 'opportunity') rig.setPresentationOpportunity(() => { throw new Error('injected opportunity failure'); });
      const queued = await rig.presenter.presentRetainedSubmissionGap();
      assert.equal(queued, failure === 'fence' || failure === 'opportunity');
      await new Promise(resolve => setImmediate(resolve));
      assert.equal(frameProofs(rig).length, before);
      assert.equal(rig.presenter.getStatus().temporalMotionAgeS, 0);
      rejectPrepare = false;
      rig.device.queue.submit = oldSubmit;
      rig.device.queue.onSubmittedWorkDone = oldFence;
      rig.setPresentationOpportunity(admittedPresentationOpportunity);
      assert.equal(await rig.presenter.presentRetainedSubmissionGap(), true,
        'a new caller may request another bounded draw after failed work fully drains');
      await waitFor(() => frameProofs(rig).length === before + 1, 'explicit fresh gap');
    } finally { await rig.presenter.dispose(); }
  });
}

for (const invalidateAtFence of ['none', 'clear', 'abort']) {
  test(`isosurface submission boundary awaits exact frame completion (${invalidateAtFence})`, async () => {
    let wallMs = 0;
    const fence = deferred();
    const rig = createPresenterRig({
      temporalNowMs: () => wallMs,
      buildPresentationFrame: async job => ({
        generation: job.generation, invalidationEpoch: job.invalidationEpoch,
        sphStep: job.sphStep, receiptFields: job.receiptFields,
        viewProjectionMatrix: [...job.admission.viewProjectionMatrix],
        cameraPositionM: [...job.admission.cameraPositionM], surfaces: [],
        motionField: { buffer: new GPUBuffer(128, 128), rowCount: 8, destroy() {} }
      })
    });
    const boundary = { submissionOrdinal: 1, completedSubstepCount: 2,
      totalSubstepCount: 64, chunkStepCount: 2 };
    const enqueue = (sphStep, time) => {
      const retained = validRetained();
      retained.sphParticleUpload.time = time;
      return rig.presenter.enqueue({ request: validRequest(), retained, sphStep,
        receiptFields: { laneId: 'lane', stateKey: 'state', sphStep } });
    };
    try {
      assert.equal(rig.presenter.hasSubmissionBoundaryOpportunity(), false);
      assert.equal(await rig.presenter.presentSubmissionBoundary(boundary), false);
      await enqueue(63, 0.064);
      await waitFor(() => rig.presenter.getStatus().visibleSphStep === 63, 'bootstrap mesh');
      assert.equal(await rig.presenter.presentSubmissionBoundary(boundary), false);
      wallMs = 1000;
      await enqueue(127, 0.128);
      await waitFor(() => rig.presenter.getStatus().visibleSphStep === 127, 'paced mesh');
      assert.equal(await rig.presenter.presentSubmissionBoundary({ ...boundary, completedSubstepCount: 64 }), false);
      assert.equal(await rig.presenter.presentSubmissionBoundary(boundary), false);
      const cancelled = new AbortController();
      cancelled.abort();
      assert.equal(await rig.presenter.presentSubmissionBoundary(boundary, { signal: cancelled.signal }), false);
      const submissionsBefore = queueSubmissionCount(rig);
      const opportunitiesBefore = rig.presentationOpportunityCalls;
      rig.setQueueCompletion(fence.promise);
      wallMs = 1500;
      assert.equal(rig.presenter.hasSubmissionBoundaryOpportunity(), true);
      let resolved = false;
      const controller = new AbortController();
      const pending = rig.presenter.presentSubmissionBoundary(boundary, { signal: controller.signal })
        .then(proof => { resolved = true; return proof; });
      await waitFor(() => queueSubmissionCount(rig) === submissionsBefore + 1, 'boundary draw submitted');
      assert.equal(resolved, false);
      assert.equal(rig.presentationOpportunityCalls, opportunitiesBefore);
      assert.equal(rig.presenter.getStatus().visibleSphStep, 127);
      if (invalidateAtFence === 'clear') rig.presenter.clear();
      if (invalidateAtFence === 'abort') controller.abort();
      fence.resolve();
      const proof = await pending;
      if (invalidateAtFence !== 'none') {
        assert.equal(proof, false);
        assert.equal(rig.terminals.some(r => r.motionPresentationQosBoundary), false);
      } else {
        assert.equal(proof.presentationFrameAdmitted, true);
        assert.equal(proof.isosurfacePresentationMotionAgeS, 0.032);
        assert.equal(proof.isosurfacePresentationSourceTimeS, 0.128);
        assert.equal(proof.physicsQueuePrefixCoverage, 'physics-queue-prefix-included');
        assert.equal(proof.physicsContinuationBlocked, true);
        assert.equal(proof.presentationQosHostQueueFenceCount, 1);
        assert.deepEqual(proof.motionPresentationQosBoundary, boundary);
        assert.equal(proof.authoritativeStateMutation, false);
        assert.equal(rig.presenter.getStatus().visibleSphStep, 127);
        assert.equal(await rig.presenter.presentSubmissionBoundary(boundary), false,
          'unchanged age cannot mint another boundary completion');
        wallMs = 3000;
        assert.equal((await rig.presenter.presentSubmissionBoundary(boundary)).isosurfacePresentationMotionAgeS, 0.064);
        wallMs = 4000;
        assert.equal(rig.presenter.hasSubmissionBoundaryOpportunity(), false);
        assert.equal(await rig.presenter.presentSubmissionBoundary(boundary), false,
          'horizon saturation cannot mint another boundary completion');
      }
    } finally {
      fence.resolve();
      await rig.presenter.dispose();
    }
  });
}

function validRequest() {
  return {
    schema: ULG_WORKER_OFFSCREEN_RESIDENT_ISOSURFACE_REQUEST_SCHEMA,
    enabled: true,
    nativeSurfaceMaterial: {
      schema: 'peercompute.ulg.worker-native-surface-material.v0',
      lightingProfile: {},
      backgroundImageUrl: null,
      backgroundClearValue: { r: 0, g: 0, b: 0, a: 1 },
      opticalTable: {
        schema: ULG_OPTICAL_GPU_TABLE_SCHEMA,
        recordCount: 1,
        recordStrideFloats: OPTICAL_GPU_RECORD_FLOATS,
        recordStrideBytes: OPTICAL_GPU_RECORD_FLOATS * 4,
        spectralSampleCount: 0,
        spectralSampleStrideFloats: OPTICAL_GPU_SPECTRAL_SAMPLE_FLOATS,
        spectralSampleStrideBytes: OPTICAL_GPU_SPECTRAL_SAMPLE_FLOATS * 4,
        records: new Float32Array(OPTICAL_GPU_RECORD_FLOATS),
        spectralSamples: new Float32Array(0)
      }
    },
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

function collectiveOpticalRequest() {
  const request = validRequest();
  const metadata = {
    ...request.surfaceTable.metadata[0],
    surfaceKey: 'collective-water-vapor',
    opticalStateId: 41,
    collectiveOpticalRoute: true,
    collectiveOpticalRouteSchema:
      'peercompute.ulg.sph-collective-dispersed-medium-optical-route.v0',
    collectiveOpticalRouteKey: 'collective-water-vapor',
    collectiveOpticalRouteId: 41,
    opticalResponseAuthorityFlag: 1,
    opticalResponseReady: true,
    opticalBlockedFlag: 0,
    opticalVisibilityFlag: 1,
    transparencyClassId: 1,
    depthWriteFlag: 0,
    opticalEffectiveOpacity: 0.4
  };
  return {
    ...request,
    surfaceTable: {
      ...request.surfaceTable,
      metadata: [metadata]
    }
  };
}

function retainedRenderFieldForPresenter(options) {
  return {
    schema: 'peercompute.ulg.sph-gpu-render-field.v1',
    backend: 'webgpu',
    surfaceTable: options.surfaceTable,
    particleCount: options.particleCount,
    fieldRowsBuffer: options.targetFieldRowsBuffer,
    fieldRowsBufferRetained: true,
    fieldRowsBufferByteLength: options.targetFieldRowsBufferByteLength,
    fieldPadding: options.fieldPadding,
    refEdgeM: options.refEdgeM,
    destroyRenderFieldBuffers() {}
  };
}

function validRetained(overrides = {}) {
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
    sourceIdentityBuffer: new GPUBuffer(),
    ...overrides
  };
}

function authenticatedResidentProductMass(
  device,
  rowCapacity = 4,
  { borrowTransitions = null } = {}
) {
  const productEventBuffer = tagWebGpuBufferDevice(device.createBuffer({
    size: rowCapacity
      * SPH_GPU_REACTION_PRODUCT_EVENT_FLOATS
      * Float32Array.BYTES_PER_ELEMENT
  }), device);
  const controlBuffer = tagWebGpuBufferDevice(device.createBuffer({
    size: 512
  }), device);
  const source = {
    status: 'resident-product-mass-merged-gpu-resident',
    productEventBuffer,
    productEventBufferRetained: true,
    productEventBufferByteLength: productEventBuffer.size,
    productEventRowCount: rowCapacity,
    productEventStrideFloats: SPH_GPU_REACTION_PRODUCT_EVENT_FLOATS,
    productEventStrideBytes:
      SPH_GPU_REACTION_PRODUCT_EVENT_FLOATS * Float32Array.BYTES_PER_ELEMENT
  };
  let activeBorrowCount = 0;
  let released = false;
  Object.defineProperty(source, '__ulgActiveBorrowCount', {
    configurable: true,
    enumerable: false,
    get() {
      return activeBorrowCount;
    },
    set(value) {
      const nextCount = Math.max(0, Math.floor(Number(value) || 0));
      if (released && nextCount > activeBorrowCount) return;
      activeBorrowCount = nextCount;
      borrowTransitions?.push(activeBorrowCount);
      if (released && activeBorrowCount === 0) {
        revokeResidentProductEventCountAuthority(source);
      }
    }
  });
  registerResidentProductEventCountAuthority(source, {
    device,
    controlBuffer,
    controlOffsetBytes: 256,
    rowCapacity,
    rowStrideFloats: SPH_GPU_REACTION_PRODUCT_EVENT_FLOATS,
    generation: 7,
    seal: 11,
    zeroTailSealed: true
  });
  source.destroyResidentProductMassBuffers = () => {
    if (released) return false;
    released = true;
    if (activeBorrowCount > 0) {
      retireResidentProductEventCountAuthority(source);
    } else {
      revokeResidentProductEventCountAuthority(source);
    }
    return true;
  };
  return source;
}

function authenticatedDispersedMediumOptics(device, particleCount = 32) {
  const particles = Array.from({ length: particleCount }, (_value, index) => (
    index === 0
      ? {
          dispersedMediumOptics: {
            dispersedMaterialId: 17,
            dispersedPhaseId: 2,
            opticalStateId: 41,
            dispersedMassKg: 0.125,
            scatteringCrossSectionM2: 0.75,
            absorptionCrossSectionM2: 0.25,
            scatteringAsymmetryCrossSectionM2: 0.5
          }
        }
      : {}
  ));
  const packed = buildSphDispersedMediumGpuBuffers(particles);
  const identityBuffer = device.createBuffer({
    size: particleCount * Uint32Array.BYTES_PER_ELEMENT
  });
  const sidecar = uploadSphDispersedMediumGpuBuffers(device, packed, {
    particleLineage: {
      particleCount,
      topologyEpoch: 3,
      identityRevision: 'worker-owned-isosurface-sidecar-lineage-v1',
      identityBuffer
    }
  });
  dispersedIdentityBufferBySidecar.set(sidecar, identityBuffer);
  return sidecar;
}

function particleUploadWithDispersedMediumOptics(sidecar, overrides = {}) {
  return {
    particleCount: sidecar.particleCount,
    topologyEpoch: 3,
    identityRevision: 'worker-owned-isosurface-sidecar-lineage-v1',
    stateBuffer: new GPUBuffer(),
    thermoBuffer: new GPUBuffer(),
    identityBuffer: dispersedIdentityBufferBySidecar.get(sidecar),
    dispersedMediumOptics: sidecar,
    dispersedMediumOpticsAuthority: sidecar.authority,
    dispersedMediumOpticsBuffer: sidecar.buffer,
    dispersedMediumOpticsRowCount: sidecar.rowCount,
    dispersedMediumOpticsRowStrideFloats: sidecar.rowStrideFloats,
    dispersedMediumOpticsBufferByteLength: sidecar.bufferByteLength,
    ownsDispersedMediumOpticsBuffer: true,
    ...overrides
  };
}

test('worker-owned isosurface snapshots optical surface metadata before asynchronous extraction', () => {
  const metadata = {
    surfaceKey: 'steam-route',
    materialId: 17,
    phaseId: 2,
    opticalStateId: 41,
    opticalEffectiveOpacity: 0.375,
    opticalRoughness: 0.125,
    colorLinear: [0.2, 0.4, 0.8],
    opticalScatteringSourceLinear: [0.7, 0.8, 0.9],
    opticalState: { regime: 'condensed-droplet' }
  };
  const snapshot = snapshotWorkerOwnedSurfaceMetadata(metadata);
  metadata.materialId = 99;
  metadata.opticalEffectiveOpacity = 1;
  metadata.colorLinear[0] = 1;
  metadata.opticalScatteringSourceLinear[0] = 0;
  metadata.opticalState.regime = 'mutated';

  assert.equal(snapshot.materialId, 17);
  assert.equal(snapshot.opticalEffectiveOpacity, 0.375);
  assert.deepEqual(snapshot.colorLinear, [0.2, 0.4, 0.8]);
  assert.deepEqual(snapshot.opticalScatteringSourceLinear, [0.7, 0.8, 0.9]);
  assert.equal(snapshot.opticalState.regime, 'condensed-droplet');
  assert.equal(Object.isFrozen(snapshot), true);
  assert.equal(Object.isFrozen(snapshot.colorLinear), true);
  assert.equal(Object.isFrozen(snapshot.opticalScatteringSourceLinear), true);
  assert.equal(Object.isFrozen(snapshot.opticalState), true);
});

test('worker-owned isosurface uniforms use closure opacity and preserve the legacy fallback', () => {
  const frame = {
    viewProjectionMatrix: validRequest().viewProjectionMatrix,
    cameraPositionM: [1, 2, 3]
  };
  const physicalHydrogen = buildWorkerOwnedIsosurfaceSurfaceUniformValues(frame, {
    metadata: {
      colorLinear: [1, 0.98, 0.96],
      transparencyClassId: 1,
      phaseId: 3,
      opticalResponseAuthorityFlag: 1,
      opticalEffectiveOpacity: 0,
      opticalRoughness: 0.9,
      depthWriteFlag: 0
    }
  });
  const physicalSteam = buildWorkerOwnedIsosurfaceSurfaceUniformValues(frame, {
    metadata: {
      colorLinear: [0.88, 0.92, 0.96],
      transparencyClassId: 1,
      phaseId: 3,
      opticalResponseAuthorityFlag: 1,
      opticalEffectiveOpacity: 0.62,
      opticalRoughness: 1,
      depthWriteFlag: 0
    }
  });
  const legacyGas = buildWorkerOwnedIsosurfaceSurfaceUniformValues(frame, {
    metadata: {
      colorLinear: [0.4, 0.8, 1],
      transparencyClassId: 1,
      phaseId: 3,
      depthWriteFlag: 0
    }
  });

  assert.equal(physicalHydrogen[23], 0);
  assert.ok(Math.abs(physicalHydrogen[27] - 0.9) < 1e-6);
  assert.equal(physicalHydrogen[35], 1);
  assert.ok(Math.abs(physicalSteam[23] - 0.62) < 1e-6);
  assert.equal(physicalSteam[35], 1);
  assert.equal(legacyGas[23], 1);
  assert.ok(Math.abs(legacyGas[27] - 0.12) < 1e-6);
  assert.equal(legacyGas[35], 0);

  const summary = summarizeWorkerOwnedIsosurfaceOpticalPresentation([
    {
      phaseId: 3,
      transparencyClassId: 1,
      opticalResponseAuthorityFlag: 1,
      opticalEffectiveOpacity: 0,
      opticalProvenanceSource: 'hydrogen-electronic-band'
    },
    {
      phaseId: 3,
      transparencyClassId: 1,
      opticalResponseAuthorityFlag: 1,
      opticalEffectiveOpacity: 0.62,
      opticalProvenanceSource: 'water-droplet-scattering'
    }
  ]);
  assert.equal(summary.status, 'all-gas-surfaces-closure-governed');
  assert.equal(summary.gasSurfaceCount, 2);
  assert.equal(summary.visibleClosureGasSurfaceCount, 1);
  assert.equal(summary.opticallyThinHiddenGasSurfaceCount, 1);
  assert.equal(summary.heuristicGasOpacityUsed, false);
});

test('worker-owned presenter packs collective optics once and composites the aggregate between opaque and transparent passes', async () => {
  const descriptorCalls = [];
  const packCalls = [];
  const renderCalls = [];
  let packedDestroyCount = 0;
  let runtimeDestroyCount = 0;
  const packedFrame = {
    status: 'participating-medium-packed-gpu-resident',
    readback: false,
    drawIndirectBuffer: new GPUBuffer(16)
  };
  const runtime = {
    destroy() {
      runtimeDestroyCount += 1;
    }
  };
  const rig = createPresenterRig({
    useBuiltInFrame: true,
    captureRenderRows: async () => ({
      particleCount: 32,
      renderRowsBuffer: new GPUBuffer(),
      destroyRenderRowsBuffer() {}
    }),
    buildRenderField: async (options) =>
      retainedRenderFieldForPresenter(options),
    createParticipatingMediumDescriptor(options) {
      descriptorCalls.push(options);
      return Object.freeze({
        status: 'participating-medium-ready',
        reason: null,
        consumedSurfaceIndices: Object.freeze([0])
      });
    },
    createParticipatingMediumGpu(device, options) {
      assert.strictEqual(device, rig.device);
      assert.deepEqual(options, {
        colorFormat: 'rgba8unorm',
        depthFormat: 'depth24plus'
      });
      return runtime;
    },
    encodeParticipatingMediumPack(
      passedRuntime,
      commandEncoder,
      descriptor
    ) {
      packCalls.push({ passedRuntime, commandEncoder, descriptor });
      return packedFrame;
    },
    encodeParticipatingMediumRender(passedRuntime, pass, options) {
      renderCalls.push({ passedRuntime, pass, options });
      pass.drawIndirect(options.packedFrame.drawIndirectBuffer, 0);
    },
    destroyParticipatingMediumPackedFrame(frame) {
      assert.strictEqual(frame, packedFrame);
      packedDestroyCount += 1;
    }
  });

  const receipt = await rig.presenter.enqueue({
    request: collectiveOpticalRequest(),
    retained: validRetained(),
    sphStep: 70,
    receiptFields: { lifecycleCase: 'participating-medium-ready' }
  });
  assert.equal(
    receipt.status,
    ULG_WORKER_OFFSCREEN_RESIDENT_ISOSURFACE_PRESENTATION_ENQUEUED_STATUS
  );
  await waitFor(
    () => rig.terminals.some((terminal) => (
      terminal.lifecycleCase === 'participating-medium-ready'
      && terminal.status
        === ULG_WORKER_OFFSCREEN_RESIDENT_ISOSURFACE_PRESENTATION_RENDERED_STATUS
    )),
    'the participating-medium aggregate presentation'
  );

  assert.equal(descriptorCalls.length, 1);
  assert.equal(descriptorCalls[0].surfaceDescriptors.length, 1);
  assert.equal(
    descriptorCalls[0].surfaceDescriptors[0].metadata.opticalStateId,
    41
  );
  assert.equal(
    Object.isFrozen(descriptorCalls[0].surfaceDescriptors[0].metadata),
    true
  );
  assert.equal(packCalls.length, 1);
  assert.strictEqual(packCalls[0].passedRuntime, runtime);
  assert.equal(renderCalls.length, 1);
  assert.strictEqual(renderCalls[0].passedRuntime, runtime);
  assert.strictEqual(renderCalls[0].options.packedFrame, packedFrame);
  assert.deepEqual(renderCalls[0].options.viewportSize, [640, 480]);
  assert.deepEqual(
    Array.from(renderCalls[0].options.inverseViewProjectionMatrix),
    Array.from(validRequest().viewProjectionMatrix)
  );
  assert.equal(rig.renderPasses.length, 3);
  assert.equal(
    rig.renderPasses[0].descriptor.depthStencilAttachment.depthStoreOp,
    'store'
  );
  assert.equal(
    Object.hasOwn(rig.renderPasses[1].descriptor, 'depthStencilAttachment'),
    false,
    'the volume pass samples depth and therefore cannot attach the same view'
  );
  assert.equal(rig.renderPasses[1].descriptor.colorAttachments[0].loadOp, 'load');
  assert.equal(
    rig.renderPasses[2].descriptor.depthStencilAttachment.depthLoadOp,
    'load'
  );
  assert.equal(rig.renderPasses[2].actions.at(-2)?.type, 'overlay');
  const rendered = rig.terminals.find((terminal) => (
    terminal.lifecycleCase === 'participating-medium-ready'
    && terminal.status
      === ULG_WORKER_OFFSCREEN_RESIDENT_ISOSURFACE_PRESENTATION_RENDERED_STATUS
  ));
  assert.equal(rendered.presentationGeometry, 'worker-owned-true-isosurface');
  assert.equal(
    rendered.presentationComposition,
    'marching-cubes-isosurfaces-plus-participating-medium'
  );
  assert.equal(rendered.surfaceCount, 1);
  assert.equal(rendered.marchingCubesSurfaceCount, 0);
  assert.equal(rendered.collectiveOpticalSurfaceCount, 1);
  assert.equal(rendered.participatingMediumStatus, 'participating-medium-ready');
  assert.equal(rendered.participatingMediumAggregateDrawCount, 1);
  assert.equal(rendered.collectiveOpticalShellFallbackCount, 0);
  assert.equal(rendered.participatingMediumDepthClipped, true);
  assert.equal(rendered.participatingMediumPremultipliedAlpha, true);
  assert.deepEqual(rendered.presentationPassOrder, [
    'opaque-isosurface',
    'depth-clipped-participating-medium',
    'transparent-isosurface-and-overlay'
  ]);
  assert.equal(
    rendered.workerOwnedParticipatingMediumPresentation.schema,
    'peercompute.ulg.worker-participating-medium-presentation.v0'
  );
  assert.equal(packedDestroyCount, 0);

  rig.setFramebufferEpoch(2);
  assert.equal(
    await rig.presenter.resize({
      viewProjectionMatrix: viewProjectionWithTranslation(2),
      reason: 'participating-medium-resize'
    }),
    true
  );
  assert.equal(renderCalls.length, 2);
  assert.equal(renderCalls[1].options.inverseViewProjectionMatrix[12], -2);
  assert.equal(packedDestroyCount, 0);
  assert.equal(
    rig.presenter.clear({ reason: 'participating-medium-clear' }),
    true
  );
  await waitFor(
    () => packedDestroyCount === 1,
    'the participating-medium packed-frame clear cleanup'
  );
  await rig.presenter.dispose();
  assert.equal(packedDestroyCount, 1);
  assert.equal(runtimeDestroyCount, 1);
});

test('blocked and empty collective optical routes render no marching-cubes shell or aggregate fallback', async () => {
  for (const status of [
    'participating-medium-blocked',
    'participating-medium-empty'
  ]) {
    let packCount = 0;
    let runtimeCreateCount = 0;
    const rig = createPresenterRig({
      useBuiltInFrame: true,
      captureRenderRows: async () => ({
        particleCount: 32,
        renderRowsBuffer: new GPUBuffer(),
        destroyRenderRowsBuffer() {}
      }),
      buildRenderField: async (options) =>
        retainedRenderFieldForPresenter(options),
      createParticipatingMediumDescriptor() {
        return Object.freeze({
          status,
          reason: `${status}-for-test`,
          consumedSurfaceIndices: Object.freeze([0])
        });
      },
      createParticipatingMediumGpu() {
        runtimeCreateCount += 1;
        return { destroy() {} };
      },
      encodeParticipatingMediumPack() {
        packCount += 1;
        throw new Error('blocked/empty routes must not be packed');
      }
    });
    await rig.presenter.enqueue({
      request: collectiveOpticalRequest(),
      retained: validRetained(),
      receiptFields: { lifecycleCase: status }
    });
    await waitFor(
      () => rig.terminals.some((terminal) => (
        terminal.lifecycleCase === status
        && terminal.status
          === ULG_WORKER_OFFSCREEN_RESIDENT_ISOSURFACE_PRESENTATION_RENDERED_STATUS
      )),
      `${status} no-shell presentation`
    );

    const rendered = rig.terminals.find((terminal) => (
      terminal.lifecycleCase === status
      && terminal.status
        === ULG_WORKER_OFFSCREEN_RESIDENT_ISOSURFACE_PRESENTATION_RENDERED_STATUS
    ));
    assert.equal(packCount, 0);
    assert.equal(runtimeCreateCount, 0);
    assert.equal(rig.renderPasses.length, 2);
    assert.equal(rendered.surfaceCount, 1);
    assert.equal(rendered.submittedSurfaceCount, 0);
    assert.equal(rendered.indirectDrawCount, 0);
    assert.equal(rendered.marchingCubesSurfaceCount, 0);
    assert.equal(rendered.collectiveOpticalSurfaceCount, 1);
    assert.equal(rendered.participatingMediumStatus, status);
    assert.equal(rendered.participatingMediumAggregateDrawCount, 0);
    assert.equal(rendered.collectiveOpticalShellFallbackCount, 0);
    assert.equal(rendered.participatingMediumDepthClipped, false);
    assert.equal(rendered.participatingMediumPremultipliedAlpha, false);
    assert.deepEqual(rendered.presentationPassOrder, [
      'opaque-isosurface', 'transparent-isosurface-and-overlay'
    ]);
    assert.equal(rig.presenter.getStatus().visibleSurfaceCount, 1);
    assert.equal(
      rig.presenter.getStatus().visibleMarchingCubesSurfaceCount,
      0
    );
    await rig.presenter.dispose();
  }
});

test('participating-medium pipeline readiness precedes framebuffer acquisition and honors clear', async () => {
  const runtimeReady = deferred();
  let runtimeCreated = false;
  let packedDestroyCount = 0;
  const packedFrame = {
    status: 'participating-medium-packed-gpu-resident',
    readback: false
  };
  const rig = createPresenterRig({
    useBuiltInFrame: true,
    captureRenderRows: async () => ({
      particleCount: 32,
      renderRowsBuffer: new GPUBuffer(),
      destroyRenderRowsBuffer() {}
    }),
    buildRenderField: async (options) =>
      retainedRenderFieldForPresenter(options),
    createParticipatingMediumDescriptor() {
      return Object.freeze({
        status: 'participating-medium-ready',
        reason: null,
        consumedSurfaceIndices: Object.freeze([0])
      });
    },
    createParticipatingMediumGpu() {
      runtimeCreated = true;
      return {
        ready: runtimeReady.promise,
        destroy() {}
      };
    },
    encodeParticipatingMediumPack() {
      return packedFrame;
    },
    encodeParticipatingMediumRender() {
      throw new Error('a cleared frame must never encode a volume render');
    },
    destroyParticipatingMediumPackedFrame(frame) {
      assert.strictEqual(frame, packedFrame);
      packedDestroyCount += 1;
    }
  });

  await rig.presenter.enqueue({
    request: collectiveOpticalRequest(),
    retained: validRetained(),
    receiptFields: { lifecycleCase: 'clear-before-volume-pipelines-ready' }
  });
  await waitFor(() => runtimeCreated, 'the deferred participating-medium runtime');
  assert.equal(rig.renderPasses.length, 0);
  assert.equal(
    rig.presenter.clear({ reason: 'clear-before-volume-pipelines-ready' }),
    true
  );
  runtimeReady.resolve(true);
  await waitFor(
    () => rig.presenter.getStatus().running === false,
    'the cleared pre-framebuffer participating-medium job cleanup'
  );

  assert.equal(rig.renderPasses.length, 0);
  assert.equal(packedDestroyCount, 1);
  assert.equal(
    rig.terminals.some((terminal) => (
      terminal.lifecycleCase === 'clear-before-volume-pipelines-ready'
      && terminal.status
        === ULG_WORKER_OFFSCREEN_RESIDENT_ISOSURFACE_PRESENTATION_RENDERED_STATUS
    )),
    false
  );
  await rig.presenter.dispose();
  assert.equal(packedDestroyCount, 1);
});

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

test('worker-owned true-isosurface hands an authenticated retained product source to the branded field build', async () => {
  const fieldBuild = deferred();
  let fieldBuildOptions = null;
  let capturedReleased = false;
  const sourceFamily = { id: 'test-successor-family' };
  const captured = {
    particleCount: 32,
    renderRowsBuffer: new GPUBuffer(),
    schroederSpatialSourceFamily: sourceFamily,
    destroyRenderRowsBuffer() {
      capturedReleased = true;
    }
  };
  const rig = createPresenterRig({
    useBuiltInFrame: true,
    captureRenderRows: async () => captured,
    buildRenderField: async (options) => {
      fieldBuildOptions = options;
      await fieldBuild.promise;
      assert.equal(
        validateProductEventLiveCountCopyDescriptor(
          options.productEventLiveCountDescriptor,
          {
            handle: options.productEventSource,
            device: rig.device
          }
        ),
        true,
        'the queued build must retain its pre-issued descriptor through retirement'
      );
      return {
        surfaceTable: { ...options.surfaceTable, metadata: [] },
        schroederSpatialSourceFamily: options.schroederSpatialSourceFamily,
        fieldPadding: options.fieldPadding,
        refEdgeM: options.refEdgeM,
        destroyRenderFieldBuffers() {}
      };
    }
  });
  const residentProductMass = authenticatedResidentProductMass(rig.device, 4);
  const enqueueReceipt = await rig.presenter.enqueue({
    request: validRequest(),
    retained: validRetained({ residentProductMass }),
    sphStep: 12
  });

  assert.equal(
    enqueueReceipt.status,
    ULG_WORKER_OFFSCREEN_RESIDENT_ISOSURFACE_PRESENTATION_ENQUEUED_STATUS
  );
  await waitFor(() => fieldBuildOptions != null, 'the product-aware render-field build');
  assert.equal(residentProductMass.__ulgActiveBorrowCount, 1);
  assert.equal(fieldBuildOptions.renderRowsSource, captured);
  assert.equal(fieldBuildOptions.schroederSpatialSourceFamily, sourceFamily);
  assert.equal(
    fieldBuildOptions.productEventBuffer,
    residentProductMass.productEventBuffer
  );
  assert.equal(fieldBuildOptions.productEventSource, residentProductMass);
  assert.equal(fieldBuildOptions.productEventCount, 4);
  const preissuedDescriptor =
    fieldBuildOptions.productEventLiveCountDescriptor;
  assert.ok(preissuedDescriptor);
  assert.equal(
    validateProductEventLiveCountCopyDescriptor(preissuedDescriptor, {
      handle: residentProductMass,
      device: rig.device
    }),
    true
  );

  assert.equal(residentProductMass.destroyResidentProductMassBuffers(), true);
  assert.equal(
    residentProductMass.productEventRowCountAuthority,
    'gpu-authored-filtered-live-prefix-retiring'
  );
  assert.equal(
    resolveResidentProductEventCountAuthority(residentProductMass, rig.device),
    null
  );
  assert.equal(
    productEventLiveCountCopyDescriptor(residentProductMass, rig.device),
    null,
    'retirement must close issuance before the queued consumer submits'
  );
  assert.equal(
    validateProductEventLiveCountCopyDescriptor(preissuedDescriptor, {
      handle: residentProductMass,
      device: rig.device
    }),
    true,
    'the already-issued descriptor remains valid under the active borrow'
  );

  fieldBuild.resolve();
  await waitFor(
    () => rig.terminals.some((receipt) => (
      receipt.status
        === ULG_WORKER_OFFSCREEN_RESIDENT_ISOSURFACE_PRESENTATION_RENDERED_STATUS
    )),
    'the product-aware isosurface presentation'
  );
  assert.equal(residentProductMass.__ulgActiveBorrowCount, 0);
  assert.equal(
    validateProductEventLiveCountCopyDescriptor(preissuedDescriptor, {
      handle: residentProductMass,
      device: rig.device
    }),
    false,
    'the descriptor is revoked when the final presenter borrow drains'
  );
  assert.equal(
    residentProductMass.productEventRowCountAuthority,
    'gpu-authored-filtered-live-prefix-revoked'
  );
  assert.ok(queueSubmissionCount(rig) > 0);
  await waitFor(() => capturedReleased, 'the product-aware capture cleanup');
  await rig.presenter.dispose();
});

test('worker-owned product source and capture release exactly once when field construction rejects', async () => {
  const borrowTransitions = [];
  let captureReleaseCount = 0;
  const rig = createPresenterRig({
    useBuiltInFrame: true,
    captureRenderRows: async () => ({
      particleCount: 32,
      renderRowsBuffer: new GPUBuffer(),
      schroederSpatialSourceFamily: { id: 'rejected-field-family' },
      destroyRenderRowsBuffer() {
        captureReleaseCount += 1;
      }
    }),
    buildRenderField: async () => {
      throw new Error('injected authenticated product field rejection');
    }
  });
  const residentProductMass = authenticatedResidentProductMass(
    rig.device,
    4,
    { borrowTransitions }
  );
  const receipt = await rig.presenter.enqueue({
    request: validRequest(),
    retained: validRetained({ residentProductMass }),
    sphStep: 14,
    receiptFields: { lifecycleCase: 'product-field-rejection' }
  });

  assert.equal(
    receipt.status,
    ULG_WORKER_OFFSCREEN_RESIDENT_ISOSURFACE_PRESENTATION_ENQUEUED_STATUS
  );
  await waitFor(
    () => rig.terminals.some(
      (terminal) => terminal.lifecycleCase === 'product-field-rejection'
    ),
    'the rejected authenticated product field terminal'
  );
  await waitFor(
    () => captureReleaseCount === 1,
    'the rejected authenticated product capture cleanup'
  );

  const caseTerminals = rig.terminals.filter(
    (terminal) => terminal.lifecycleCase === 'product-field-rejection'
  );
  assert.equal(caseTerminals.length, 1);
  assert.equal(
    caseTerminals[0].status,
    ULG_WORKER_OFFSCREEN_RESIDENT_ISOSURFACE_PRESENTATION_FAILED_STATUS
  );
  assert.match(caseTerminals[0].reason, /injected authenticated product field rejection/);
  assert.equal(residentProductMass.__ulgActiveBorrowCount, 0);
  assert.deepEqual(borrowTransitions, [1, 0]);

  await rig.presenter.dispose();
  assert.equal(captureReleaseCount, 1);
  assert.deepEqual(borrowTransitions, [1, 0]);
  assert.equal(caseTerminals.length, 1);
});

test('clear releases an authenticated queued product source and capture exactly once before build', async () => {
  const activeBuild = deferred();
  const borrowTransitions = [];
  const captureReleaseCounts = [0, 0];
  let captureIndex = 0;
  const buildSteps = [];
  const rig = createPresenterRig({
    captureRenderRows: async () => {
      const index = captureIndex;
      captureIndex += 1;
      return {
        destroyRenderRowsBuffer() {
          captureReleaseCounts[index] += 1;
        }
      };
    },
    buildPresentationFrame: async (job) => {
      buildSteps.push(job.sphStep);
      if (job.sphStep === 15) await activeBuild.promise;
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
    sphStep: 15
  });
  await waitFor(() => buildSteps.length === 1, 'the active predecessor frame build');

  const residentProductMass = authenticatedResidentProductMass(
    rig.device,
    4,
    { borrowTransitions }
  );
  const queuedReceipt = await rig.presenter.enqueue({
    request: validRequest(),
    retained: validRetained({ residentProductMass }),
    sphStep: 16,
    receiptFields: { lifecycleCase: 'queued-product-clear' }
  });
  assert.equal(
    queuedReceipt.status,
    ULG_WORKER_OFFSCREEN_RESIDENT_ISOSURFACE_PRESENTATION_ENQUEUED_STATUS
  );
  assert.deepEqual(buildSteps, [15]);
  assert.equal(residentProductMass.__ulgActiveBorrowCount, 1);

  assert.equal(rig.presenter.clear({ reason: 'test-clear-queued-product' }), true);
  await waitFor(
    () => captureReleaseCounts[1] === 1,
    'the cleared queued product capture cleanup'
  );

  const queuedTerminals = rig.terminals.filter(
    (terminal) => terminal.lifecycleCase === 'queued-product-clear'
  );
  assert.equal(queuedTerminals.length, 1);
  assert.equal(
    queuedTerminals[0].status,
    ULG_WORKER_OFFSCREEN_RESIDENT_ISOSURFACE_PRESENTATION_SUPERSEDED_STATUS
  );
  assert.deepEqual(buildSteps, [15]);
  assert.equal(residentProductMass.__ulgActiveBorrowCount, 0);
  assert.deepEqual(borrowTransitions, [1, 0]);

  activeBuild.resolve();
  await waitFor(
    () => rig.presenter.getStatus().running === false,
    'the cleared predecessor build cleanup'
  );
  await rig.presenter.dispose();
  assert.equal(captureReleaseCounts[1], 1);
  assert.deepEqual(borrowTransitions, [1, 0]);
  assert.equal(
    rig.terminals.filter(
      (terminal) => terminal.lifecycleCase === 'queued-product-clear'
    ).length,
    1
  );
});

test('worker-owned true-isosurface preserves the branded zero-product field call', async () => {
  let fieldBuildOptions = null;
  const sourceFamily = { id: 'test-zero-product-successor-family' };
  const captured = {
    particleCount: 32,
    renderRowsBuffer: new GPUBuffer(),
    schroederSpatialSourceFamily: sourceFamily,
    destroyRenderRowsBuffer() {}
  };
  const rig = createPresenterRig({
    useBuiltInFrame: true,
    captureRenderRows: async () => captured,
    buildRenderField: async (options) => {
      fieldBuildOptions = options;
      return {
        surfaceTable: { ...options.surfaceTable, metadata: [] },
        schroederSpatialSourceFamily: options.schroederSpatialSourceFamily,
        fieldPadding: options.fieldPadding,
        refEdgeM: options.refEdgeM,
        destroyRenderFieldBuffers() {}
      };
    }
  });
  await rig.presenter.enqueue({
    request: validRequest(),
    retained: validRetained(),
    sphStep: 13
  });
  await waitFor(() => fieldBuildOptions != null, 'the zero-product render-field build');

  assert.equal(fieldBuildOptions.renderRowsSource, captured);
  assert.equal(fieldBuildOptions.schroederSpatialSourceFamily, sourceFamily);
  assert.equal(fieldBuildOptions.productEventBuffer, null);
  assert.equal(fieldBuildOptions.productEventSource, null);
  assert.equal(fieldBuildOptions.productEventCount, 0);
  await rig.presenter.dispose();
});

test('worker-owned true-isosurface rejects every torn dispersed-medium alias singleton', async () => {
  let captureCount = 0;
  const rig = createPresenterRig({
    captureRenderRows: async () => {
      captureCount += 1;
      return { destroyRenderRowsBuffer() {} };
    }
  });
  const sidecar = authenticatedDispersedMediumOptics(rig.device);
  const singletonCases = [
    ['dispersedMediumOptics', sidecar],
    ['dispersedMediumOptics', false],
    ['dispersedMediumOpticsAuthority', sidecar.authority],
    ['dispersedMediumOpticsAuthority', 0],
    ['dispersedMediumOpticsBuffer', sidecar.buffer],
    ['dispersedMediumOpticsBuffer', ''],
    ['dispersedMediumOpticsRowCount', sidecar.rowCount],
    ['dispersedMediumOpticsRowCount', false],
    ['dispersedMediumOpticsRowStrideFloats', sidecar.rowStrideFloats],
    ['dispersedMediumOpticsRowStrideFloats', ''],
    ['dispersedMediumOpticsBufferByteLength', sidecar.bufferByteLength],
    ['dispersedMediumOpticsBufferByteLength', Number.NaN],
    ['ownsDispersedMediumOpticsBuffer', true]
  ];

  for (const [field, value] of singletonCases) {
    const receipt = await rig.presenter.enqueue({
      request: validRequest(),
      retained: validRetained({
        sphParticleUpload: {
          particleCount: sidecar.particleCount,
          [field]: value
        }
      }),
      receiptFields: { tornField: field }
    });
    assert.equal(
      receipt.status,
      ULG_WORKER_OFFSCREEN_RESIDENT_ISOSURFACE_PRESENTATION_FAILED_STATUS,
      `${field} must not be mistaken for an absent sidecar`
    );
    assert.match(receipt.reason, /torn dispersed-medium particle-upload aliases/);
  }

  assert.equal(captureCount, 0);
  assert.equal(destroySphDispersedMediumGpuBuffers(sidecar), true);
  assert.equal(sidecar.buffer.destroyCount, 1);
  await rig.presenter.dispose();
});

test('worker-owned true-isosurface pre-borrows and forwards the exact dispersed-medium sidecar', async () => {
  const fieldBuild = deferred();
  let fieldBuildOptions = null;
  let captureReleaseCount = 0;
  const rig = createPresenterRig({
    useBuiltInFrame: true,
    captureRenderRows: async ({ sphParticleUpload }) => ({
      particleCount: sphParticleUpload.particleCount,
      renderRowsBuffer: new GPUBuffer(),
      dispersedMediumOptics: sphParticleUpload.dispersedMediumOptics,
      schroederSpatialSourceFamily: { id: 'dispersed-success-family' },
      destroyRenderRowsBuffer() {
        captureReleaseCount += 1;
      }
    }),
    buildRenderField: async (options) => {
      fieldBuildOptions = options;
      await fieldBuild.promise;
      return {
        surfaceTable: { ...options.surfaceTable, metadata: [] },
        schroederSpatialSourceFamily: options.schroederSpatialSourceFamily,
        fieldPadding: options.fieldPadding,
        refEdgeM: options.refEdgeM,
        destroyRenderFieldBuffers() {}
      };
    }
  });
  const sidecar = authenticatedDispersedMediumOptics(rig.device);
  const sphParticleUpload = particleUploadWithDispersedMediumOptics(sidecar);

  const receipt = await rig.presenter.enqueue({
    request: validRequest(),
    retained: validRetained({ sphParticleUpload }),
    sphStep: 17,
    receiptFields: { lifecycleCase: 'dispersed-success' }
  });
  assert.equal(
    receipt.status,
    ULG_WORKER_OFFSCREEN_RESIDENT_ISOSURFACE_PRESENTATION_ENQUEUED_STATUS
  );
  await waitFor(() => fieldBuildOptions != null, 'the dispersed render-field build');
  assert.strictEqual(fieldBuildOptions.dispersedMediumOptics, sidecar);

  assert.equal(destroySphDispersedMediumGpuBuffers(sidecar), true);
  assert.equal(sidecar.destroyPending, true);
  assert.equal(sidecar.buffer.destroyCount, 0);
  fieldBuild.resolve();

  await waitFor(
    () => rig.terminals.some((terminal) => (
      terminal.lifecycleCase === 'dispersed-success'
      && terminal.status
        === ULG_WORKER_OFFSCREEN_RESIDENT_ISOSURFACE_PRESENTATION_RENDERED_STATUS
    )),
    'the dispersed render-field presentation'
  );
  await waitFor(() => sidecar.buffer.destroyCount === 1, 'the dispersed source release');
  await waitFor(() => captureReleaseCount === 1, 'the dispersed capture release');
  assert.equal(sidecar.destroyed, true);

  await rig.presenter.dispose();
  assert.equal(sidecar.buffer.destroyCount, 1);
  assert.equal(captureReleaseCount, 1);
});

test('worker-owned true-isosurface rejects a capture that substitutes its dispersed-medium sidecar', async () => {
  let captureReleaseCount = 0;
  let fieldBuildCount = 0;
  const rig = createPresenterRig({
    useBuiltInFrame: true,
    captureRenderRows: async () => ({
      particleCount: 32,
      renderRowsBuffer: new GPUBuffer(),
      dispersedMediumOptics: {},
      destroyRenderRowsBuffer() {
        captureReleaseCount += 1;
      }
    }),
    buildRenderField: async () => {
      fieldBuildCount += 1;
      throw new Error('substituted sidecar reached the field builder');
    }
  });
  const sidecar = authenticatedDispersedMediumOptics(rig.device);
  const receipt = await rig.presenter.enqueue({
    request: validRequest(),
    retained: validRetained({
      sphParticleUpload: particleUploadWithDispersedMediumOptics(sidecar)
    })
  });

  assert.equal(
    receipt.status,
    ULG_WORKER_OFFSCREEN_RESIDENT_ISOSURFACE_PRESENTATION_FAILED_STATUS
  );
  assert.match(receipt.reason, /did not retain its exact dispersed-medium sidecar/);
  assert.equal(fieldBuildCount, 0);
  await waitFor(() => captureReleaseCount === 1, 'the substituted capture release');
  assert.equal(destroySphDispersedMediumGpuBuffers(sidecar), true);
  assert.equal(sidecar.buffer.destroyCount, 1);
  await rig.presenter.dispose();
  assert.equal(sidecar.buffer.destroyCount, 1);
  assert.equal(captureReleaseCount, 1);
});

test('worker-owned true-isosurface releases a pre-borrowed sidecar when source capture rejects', async () => {
  const capture = deferred();
  let captureStarted = false;
  const rig = createPresenterRig({
    captureRenderRows: async () => {
      captureStarted = true;
      return capture.promise;
    }
  });
  const sidecar = authenticatedDispersedMediumOptics(rig.device);
  const enqueuePromise = rig.presenter.enqueue({
    request: validRequest(),
    retained: validRetained({
      sphParticleUpload: particleUploadWithDispersedMediumOptics(sidecar)
    }),
    receiptFields: { lifecycleCase: 'dispersed-capture-rejection' }
  });

  await waitFor(() => captureStarted, 'the dispersed source capture');
  assert.equal(destroySphDispersedMediumGpuBuffers(sidecar), true);
  assert.equal(sidecar.destroyPending, true);
  assert.equal(sidecar.buffer.destroyCount, 0);
  capture.reject(new Error('injected dispersed capture rejection'));

  const receipt = await enqueuePromise;
  assert.equal(
    receipt.status,
    ULG_WORKER_OFFSCREEN_RESIDENT_ISOSURFACE_PRESENTATION_FAILED_STATUS
  );
  assert.match(receipt.reason, /injected dispersed capture rejection/);
  assert.equal(sidecar.destroyed, true);
  assert.equal(sidecar.buffer.destroyCount, 1);
  await rig.presenter.dispose();
  assert.equal(sidecar.buffer.destroyCount, 1);
});

test('worker-owned true-isosurface releases a pre-borrowed sidecar when field construction rejects', async () => {
  const fieldBuild = deferred();
  let fieldBuildStarted = false;
  const rig = createPresenterRig({
    useBuiltInFrame: true,
    captureRenderRows: async ({ sphParticleUpload }) => ({
      particleCount: sphParticleUpload.particleCount,
      renderRowsBuffer: new GPUBuffer(),
      dispersedMediumOptics: sphParticleUpload.dispersedMediumOptics,
      schroederSpatialSourceFamily: { id: 'dispersed-rejection-family' },
      destroyRenderRowsBuffer() {}
    }),
    buildRenderField: async () => {
      fieldBuildStarted = true;
      return fieldBuild.promise;
    }
  });
  const sidecar = authenticatedDispersedMediumOptics(rig.device);
  const receipt = await rig.presenter.enqueue({
    request: validRequest(),
    retained: validRetained({
      sphParticleUpload: particleUploadWithDispersedMediumOptics(sidecar)
    }),
    receiptFields: { lifecycleCase: 'dispersed-field-rejection' }
  });
  assert.equal(
    receipt.status,
    ULG_WORKER_OFFSCREEN_RESIDENT_ISOSURFACE_PRESENTATION_ENQUEUED_STATUS
  );
  await waitFor(() => fieldBuildStarted, 'the rejecting dispersed field build');
  assert.equal(destroySphDispersedMediumGpuBuffers(sidecar), true);
  assert.equal(sidecar.destroyPending, true);
  fieldBuild.reject(new Error('injected dispersed field rejection'));

  await waitFor(
    () => rig.terminals.some((terminal) => (
      terminal.lifecycleCase === 'dispersed-field-rejection'
    )),
    'the dispersed field rejection terminal'
  );
  assert.equal(sidecar.destroyed, true);
  assert.equal(sidecar.buffer.destroyCount, 1);
  await rig.presenter.dispose();
  assert.equal(sidecar.buffer.destroyCount, 1);
});

test('a synchronous cleanup-fence failure cannot suppress later source retirement', async () => {
  const fieldBuild = deferred();
  let fieldBuildStarted = false;
  let captureReleaseCount = 0;
  const rig = createPresenterRig({
    useBuiltInFrame: true,
    captureRenderRows: async ({ sphParticleUpload }) => ({
      particleCount: sphParticleUpload.particleCount,
      renderRowsBuffer: new GPUBuffer(),
      dispersedMediumOptics: sphParticleUpload.dispersedMediumOptics,
      schroederSpatialSourceFamily: { id: 'sync-fence-failure-family' },
      destroyRenderRowsBuffer() {
        captureReleaseCount += 1;
      }
    }),
    buildRenderField: async () => {
      fieldBuildStarted = true;
      return fieldBuild.promise;
    }
  });
  rig.device.queue.onSubmittedWorkDone = () => {
    throw new Error('injected synchronous fence scheduling failure');
  };
  const sidecar = authenticatedDispersedMediumOptics(rig.device);
  await rig.presenter.enqueue({
    request: validRequest(),
    retained: validRetained({
      sphParticleUpload: particleUploadWithDispersedMediumOptics(sidecar)
    }),
    receiptFields: { lifecycleCase: 'sync-cleanup-fence-failure' }
  });
  await waitFor(() => fieldBuildStarted, 'the synchronous-fence field build');
  assert.equal(destroySphDispersedMediumGpuBuffers(sidecar), true);
  assert.equal(sidecar.destroyPending, true);
  fieldBuild.reject(new Error('injected field failure before cleanup'));

  await waitFor(
    () => rig.terminals.some((terminal) => (
      terminal.lifecycleCase === 'sync-cleanup-fence-failure'
    )),
    'the synchronous cleanup-fence terminal'
  );
  await waitFor(() => rig.presenter.getStatus().running === false, 'the failed job unwind');
  assert.equal(captureReleaseCount, 1);
  assert.equal(sidecar.destroyed, true);
  assert.equal(sidecar.buffer.destroyCount, 1);
  await rig.presenter.dispose();
});

test('a newer queued frame releases a superseded dispersed-medium source exactly once', async () => {
  const activeBuild = deferred();
  const buildSteps = [];
  const rig = createPresenterRig({
    captureRenderRows: async ({ sphParticleUpload }) => ({
      dispersedMediumOptics: sphParticleUpload.dispersedMediumOptics ?? null,
      destroyRenderRowsBuffer() {}
    }),
    buildPresentationFrame: async (job) => {
      buildSteps.push(job.sphStep);
      if (job.sphStep === 51) await activeBuild.promise;
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
    sphStep: 51
  });
  await waitFor(() => buildSteps.length === 1, 'the active predecessor build');

  const sidecar = authenticatedDispersedMediumOptics(rig.device);
  await rig.presenter.enqueue({
    request: validRequest(),
    retained: validRetained({
      sphParticleUpload: particleUploadWithDispersedMediumOptics(sidecar)
    }),
    sphStep: 52,
    receiptFields: { lifecycleCase: 'queued-dispersed-superseded' }
  });
  assert.equal(destroySphDispersedMediumGpuBuffers(sidecar), true);
  assert.equal(sidecar.destroyPending, true);

  await rig.presenter.enqueue({
    request: validRequest(),
    retained: validRetained(),
    sphStep: 53
  });
  await waitFor(() => sidecar.buffer.destroyCount === 1, 'the superseded sidecar release');
  const terminals = rig.terminals.filter((terminal) => (
    terminal.lifecycleCase === 'queued-dispersed-superseded'
  ));
  assert.equal(terminals.length, 1);
  assert.equal(
    terminals[0].status,
    ULG_WORKER_OFFSCREEN_RESIDENT_ISOSURFACE_PRESENTATION_SUPERSEDED_STATUS
  );

  activeBuild.resolve();
  await waitFor(() => rig.presenter.getStatus().running === false, 'the queue drain');
  await rig.presenter.dispose();
  assert.equal(sidecar.buffer.destroyCount, 1);
});

test('worker-owned true-isosurface rolls back a sidecar borrow after synchronous product-source rejection', async () => {
  let captureCount = 0;
  const rig = createPresenterRig({
    captureRenderRows: async () => {
      captureCount += 1;
      return { destroyRenderRowsBuffer() {} };
    }
  });
  const sidecar = authenticatedDispersedMediumOptics(rig.device);
  const receipt = await rig.presenter.enqueue({
    request: validRequest(),
    retained: validRetained({
      sphParticleUpload: particleUploadWithDispersedMediumOptics(sidecar),
      residentProductMass: {
        productEventBuffer: new GPUBuffer(),
        productEventRowCount: 1,
        productEventRowCapacity: 1
      }
    }),
    receiptFields: { lifecycleCase: 'dispersed-sync-rollback' }
  });
  assert.equal(
    receipt.status,
    ULG_WORKER_OFFSCREEN_RESIDENT_ISOSURFACE_PRESENTATION_FAILED_STATUS
  );
  assert.match(receipt.reason, /authenticated GPU live-count capacity/);
  assert.equal(captureCount, 0);
  assert.equal(destroySphDispersedMediumGpuBuffers(sidecar), true);
  assert.equal(sidecar.buffer.destroyCount, 1);
  await rig.presenter.dispose();
  assert.equal(sidecar.buffer.destroyCount, 1);
});

test('worker-owned true-isosurface releases a sidecar after an asynchronous presentation fence rejection', async () => {
  const fence = deferred();
  const rig = createPresenterRig({
    queueCompletion: fence.promise,
    captureRenderRows: async ({ sphParticleUpload }) => ({
      dispersedMediumOptics: sphParticleUpload.dispersedMediumOptics,
      destroyRenderRowsBuffer() {}
    })
  });
  const sidecar = authenticatedDispersedMediumOptics(rig.device);
  const receipt = await rig.presenter.enqueue({
    request: validRequest(),
    retained: validRetained({
      sphParticleUpload: particleUploadWithDispersedMediumOptics(sidecar)
    }),
    sphStep: 54,
    receiptFields: { lifecycleCase: 'dispersed-fence-rejection' }
  });
  assert.equal(
    receipt.status,
    ULG_WORKER_OFFSCREEN_RESIDENT_ISOSURFACE_PRESENTATION_ENQUEUED_STATUS
  );
  await waitFor(() => queueSubmissionCount(rig) === 1, 'the dispersed frame submission');
  assert.equal(destroySphDispersedMediumGpuBuffers(sidecar), true);
  assert.equal(sidecar.destroyPending, true);
  fence.reject(new Error('injected dispersed presentation fence rejection'));

  await waitFor(
    () => rig.terminals.some((terminal) => (
      terminal.lifecycleCase === 'dispersed-fence-rejection'
    )),
    'the dispersed presentation fence rejection terminal'
  );
  assert.equal(sidecar.destroyed, true);
  assert.equal(sidecar.buffer.destroyCount, 1);
  await rig.presenter.dispose();
  assert.equal(sidecar.buffer.destroyCount, 1);
});

test('dispose waits for an in-flight source capture to release its dispersed sidecar', async () => {
  const capture = deferred();
  let captureStarted = false;
  let capturedRowsReleased = 0;
  const rig = createPresenterRig({
    captureRenderRows: async () => {
      captureStarted = true;
      return capture.promise;
    }
  });
  const sidecar = authenticatedDispersedMediumOptics(rig.device);
  const enqueuePromise = rig.presenter.enqueue({
    request: validRequest(),
    retained: validRetained({
      sphParticleUpload: particleUploadWithDispersedMediumOptics(sidecar)
    }),
    sphStep: 55,
    receiptFields: { lifecycleCase: 'dispose-during-dispersed-capture' }
  });
  await waitFor(() => captureStarted, 'the deferred dispersed source capture');

  let disposeSettled = false;
  const disposePromise = rig.presenter.dispose().then(() => {
    disposeSettled = true;
  });
  assert.equal(destroySphDispersedMediumGpuBuffers(sidecar), true);
  assert.equal(sidecar.destroyPending, true);
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(
    disposeSettled,
    false,
    'dispose must retain presenter resources until the source capture unwinds'
  );
  assert.notEqual(sidecar.destroyed, true);

  capture.resolve({
    dispersedMediumOptics: sidecar,
    destroyRenderRowsBuffer() {
      capturedRowsReleased += 1;
    }
  });
  const receipt = await enqueuePromise;
  await disposePromise;

  assert.equal(
    receipt.status,
    ULG_WORKER_OFFSCREEN_RESIDENT_ISOSURFACE_PRESENTATION_SUPERSEDED_STATUS
  );
  assert.equal(capturedRowsReleased, 1);
  assert.equal(sidecar.destroyed, true);
  assert.equal(sidecar.buffer.destroyCount, 1);
  assert.equal(disposeSettled, true);
});

test('worker-owned true-isosurface rejects a copied product-count authority', async () => {
  const rig = createPresenterRig();
  const residentProductMass = authenticatedResidentProductMass(rig.device, 2);
  const copiedSource = {
    ...residentProductMass,
    __ulgActiveBorrowCount: 0
  };
  assert.throws(
    () => resolveWorkerOwnedIsosurfaceProductEventSource({
      device: rig.device,
      retained: validRetained({ residentProductMass: copiedSource })
    }),
    /authenticated GPU live-count capacity/
  );
  await rig.presenter.dispose();
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

for (const blockedStage of ['capture', 'build']) {
  test(`camera updates the admitted mesh during ${blockedStage} and survives replacement`, async () => {
    const gate = deferred();
    let blockReplacement = false;
    let blocked = false;
    const frames = [];
    const rig = createPresenterRig({
      captureRenderRows: async () => {
        if (blockReplacement && blockedStage === 'capture') {
          blocked = true;
          await gate.promise;
        }
        return { destroyRenderRowsBuffer() {} };
      },
      buildPresentationFrame: async job => {
        if (blockReplacement && blockedStage === 'build') {
          blocked = true;
          await gate.promise;
        }
        const frame = {
          generation: job.generation, invalidationEpoch: job.invalidationEpoch,
          sphStep: job.sphStep, receiptFields: job.receiptFields,
          viewProjectionMatrix: [...job.admission.viewProjectionMatrix],
          cameraPositionM: [...job.admission.cameraPositionM], surfaces: []
        };
        frames.push(frame);
        return frame;
      }
    });
    let pendingEnqueue;
    try {
      await rig.presenter.enqueue({ request: validRequest(), retained: validRetained(), sphStep: 31 });
      await waitFor(() => rig.presenter.getStatus().visibleSphStep === 31, 'first mesh');
      blockReplacement = true;
      pendingEnqueue = rig.presenter.enqueue({ request: validRequest(), retained: validRetained(), sphStep: 32 });
      await waitFor(() => blocked, `replacement ${blockedStage}`);
      const matrix = viewProjectionWithTranslation(9);
      const camera = [7, 8, 9];
      const redraw = rig.presenter.redraw({ viewProjectionMatrix: matrix,
        cameraPositionM: camera, reason: 'camera-before-replacement' });
      matrix[12] = 999;
      camera[0] = 999;
      await waitFor(() => rig.terminals.some(r => r.reason === 'camera-before-replacement'),
        'camera response before releasing the source build');
      assert.equal(await redraw, true);
      assert.equal(rig.presenter.getStatus().visibleSphStep, 31);
      assert.deepEqual(rig.drawnViewProjectionMatrices.at(-1), viewProjectionWithTranslation(9));
      assert.deepEqual(frames[0].cameraPositionM, [7, 8, 9]);
      gate.resolve();
      await pendingEnqueue;
      await waitFor(() => rig.presenter.getStatus().visibleSphStep === 32, 'replacement mesh');
      assert.deepEqual(rig.drawnViewProjectionMatrices.at(-1), viewProjectionWithTranslation(9));
      assert.deepEqual(frames[1].cameraPositionM, [7, 8, 9]);
      await rig.presenter.redraw({ viewProjectionMatrix: [NaN], cameraPositionM: [Infinity] });
      assert.deepEqual(rig.drawnViewProjectionMatrices.at(-1), viewProjectionWithTranslation(9));
      assert.deepEqual(frames[1].cameraPositionM, [7, 8, 9]);
    } finally {
      gate.resolve();
      await pendingEnqueue;
      await rig.presenter.dispose();
    }
  });
}

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

test('Slice 1.1: threeViewProjectionToWebGpuClipMatrix matches isosurface OpenGL->WebGPU clip-z depth remap', () => {
  // Typical Three.js perspective view-projection matrix (column-major, OpenGL NDC z in [-1, 1]).
  const near = 0.05;
  const far = 20;
  const f = 1 / Math.tan(Math.PI / 6);
  const vp = [
    f, 0, 0, 0,
    0, f, 0, 0,
    0, 0, -(far + near) / (far - near), -1,
    0, 0, (-2 * far * near) / (far - near), 0
  ];
  const remapped = threeViewProjectionToWebGpuClipMatrix(vp);
  const mul = (m, p) => [
    m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12] * p[3],
    m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13] * p[3],
    m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14] * p[3],
    m[3] * p[0] + m[7] * p[1] + m[11] * p[2] + m[15] * p[3]
  ];
  for (const pt of [[0, 0, -near, 1], [0.1, -0.2, -1.5, 1], [-0.3, 0.4, -far, 1]]) {
    const glClip = mul(vp, pt);
    const expectedZ = glClip[2] * 0.5 + glClip[3] * 0.5;
    const gpuClip = mul(remapped, pt);
    assert.ok(Math.abs(gpuClip[0] - glClip[0]) < 1e-5);
    assert.ok(Math.abs(gpuClip[1] - glClip[1]) < 1e-5);
    assert.ok(Math.abs(gpuClip[2] - expectedZ) < 1e-5);
    assert.ok(Math.abs(gpuClip[3] - glClip[3]) < 1e-5);
  }
  // Near plane maps to NDC z = 0; far plane maps to NDC z = 1 (matching WebGPU depthCompare: 'less').
  const nearClip = mul(remapped, [0, 0, -near, 1]);
  const farClip = mul(remapped, [0, 0, -far, 1]);
  assert.ok(Math.abs(nearClip[2] / nearClip[3] - 0) < 1e-5);
  assert.ok(Math.abs(farClip[2] / farClip[3] - 1) < 1e-5);
});

test('Gate 4 finite-horizon honesty: halted physics terminates strictly at maxSimulationAgeS with zero Zeno extension and distinct f32 shader ages', async (t) => {
  const { rig, builtFrames, timers, setWallMs } = await createPendingSourceMotionRig(t);
  try {
    const frame = builtFrames[0];
    const originalPacing = frame.motionPacing;
    const maxAgeS = originalPacing.maxSimulationAgeS;
    const maxWallMs = originalPacing.maxWallAgeS * 1000;
    const startMs = originalPacing.startedAtMs;
    const seenShaderF32 = [];
    // Step wall clock cleanly in 16 ms ticks past the finite horizon with NO successor job.
    let nowMs = startMs;
    const maxTicks = Math.ceil(maxWallMs / 16) + 10;
    for (let tick = 0; tick < maxTicks; tick += 1) {
      const prevAge = rig.presenter.getStatus().temporalMotionAgeS;
      if (prevAge >= maxAgeS) break;
      await waitFor(() => timers.pendingCount > 0, `temporal timer armed before tick ${tick}`);
      nowMs += 16;
      setWallMs(nowMs);
      timers.fireNext();
      await waitFor(
        () => rig.presenter.getStatus().temporalMotionAgeS > prevAge,
        `temporal motion tick ${tick} to advance`
      );
      const latest = frameProofs(rig).at(-1);
      if (latest?.isosurfaceTemporalPresentation) {
        const dampedF32 = Math.fround(
          dampedIsosurfaceShaderMotionAgeS({
            motionPacing: frame.motionPacing,
            drawMotionAgeS: latest.isosurfacePresentationMotionAgeS
          })
        );
        if (seenShaderF32.length === 0 || seenShaderF32.at(-1) !== dampedF32) {
          seenShaderF32.push(dampedF32);
        }
      }
      if (rig.presenter.getStatus().temporalMotionAgeS >= maxAgeS) break;
    }
    await waitFor(() => timers.pendingCount === 0, 'pending timers to settle at finite deadline');
    assert.equal(
      rig.presenter.getStatus().temporalMotionAgeS,
      maxAgeS,
      'halted physics must reach exact finite maxSimulationAgeS'
    );
    assert.equal(
      timers.pendingCount,
      0,
      'temporal presentation loop must terminate completely with zero pending timers'
    );
    assert.equal(
      frame.motionPacing,
      originalPacing,
      'without an active successor build, pacing must never be slowed or stretched'
    );
    assert.ok(
      nowMs - startMs <= maxWallMs + 32,
      `finite deadline must not stretch beyond original maxWallAgeS (${nowMs - startMs} ms vs ${maxWallMs} ms)`
    );
    const temporalProofs = frameProofs(rig).filter((p) => p.isosurfaceTemporalPresentation);
    assert.equal(
      seenShaderF32.length,
      temporalProofs.length,
      'every emitted temporal frame must carry a strictly distinct f32 shader motion age'
    );
  } finally {
    await rig.presenter.dispose();
  }
});
