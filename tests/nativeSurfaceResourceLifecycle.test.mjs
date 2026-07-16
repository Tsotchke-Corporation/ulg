import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  createNativeSurfaceResourceOwner,
  installNativeSurfaceResourceOwner,
  markNativeSurfaceDeviceLostForCurrentOwners,
  nativeSurfaceBridgeFailureReason,
  nativeSurfaceDrawStateUsesExecution,
  nativeSurfaceVisualIntervalExtractionEnabled,
  prepareNativeSurfaceBridgeForForcedDisposal,
  rendererCanvasResizeRequired,
  resolveNativeSurfaceBridgeDeviceAdmission,
  resolveNativeSurfaceConsumerDeviceTransition,
  retireNativeRefractionTargetSet,
  resolveAdditionalNativeSurfaceGenerationAttempt,
  resolveNativeRefractionTargetSetAction,
  resolveNativeSurfaceAnimationFramePolicy,
  resolveNativeSurfaceResourceReleaseAction,
  resolveNativeSurfaceSubmitSynchronization,
  shouldCommitAdditionalNativeSurfaceCandidate,
  shouldExtractNativeSurfaceForProbeBatch,
  takeNativeSurfaceResourceOwners
} from '../src/visualization/nativeSurfaceResourceLifecycle.js';

test('native surface animation frames render only for observable presentation changes', () => {
  assert.equal(resolveNativeSurfaceAnimationFramePolicy().drawRequired, true);
  assert.equal(resolveNativeSurfaceAnimationFramePolicy({
    nativeBridge: true
  }).drawRequired, false);

  for (const changed of ['cameraDirty', 'stateDirty', 'controlsChanged', 'continuousRedraw']) {
    const policy = resolveNativeSurfaceAnimationFramePolicy({
      nativeBridge: true,
      [changed]: true
    });
    assert.equal(policy.drawRequired, true, `${changed} should request a native redraw`);
    assert.equal(policy.mode, 'on-demand-camera-or-state-change');
  }
});

test('native surface submission uses the ordered queue boundary without a per-frame CPU fence', () => {
  const native = resolveNativeSurfaceSubmitSynchronization({
    rendererBridge: 'native-webgpu-surface-consumer'
  });
  assert.equal(native.requiresCpuQueueFence, false);
  assert.equal(native.sameQueueSubmissionBoundary, true);
  assert.equal(native.resourceRetirementSafeAfterSubmit, true);

  const generic = resolveNativeSurfaceSubmitSynchronization({
    rendererBridge: 'three-webgpu-surface-buffers'
  });
  assert.equal(generic.requiresCpuQueueFence, true);
  assert.equal(generic.sameQueueSubmissionBoundary, false);
});

test('native surface lifecycle retains the execution still bound by the active draw state', () => {
  const execution = { drawIndirectRowsBuffer: {} };
  const drawState = {
    surfaceDrawExecution: execution,
    drawIndirectRowsBuffer: execution.drawIndirectRowsBuffer
  };

  assert.equal(nativeSurfaceDrawStateUsesExecution(drawState, execution), true);
  assert.deepEqual(
    resolveNativeSurfaceResourceReleaseAction({ drawState, surfaceDrawExecution: execution }),
    {
      status: 'retain-active-generation',
      releaseNow: false,
      defer: false,
      retainActive: true,
      reason: 'the native bridge draw state still owns this surface execution'
    }
  );
});

test('renderer canvas resize guard preserves an unchanged native canvas', () => {
  assert.equal(rendererCanvasResizeRequired({
    canvasWidth: 640,
    canvasHeight: 480,
    width: 320,
    height: 240,
    pixelRatio: 2,
    currentPixelRatio: 2
  }), false);
  assert.equal(rendererCanvasResizeRequired({
    canvasWidth: 640,
    canvasHeight: 480,
    width: 321,
    height: 240,
    pixelRatio: 2,
    currentPixelRatio: 2
  }), true);
  assert.equal(rendererCanvasResizeRequired({
    canvasWidth: 640,
    canvasHeight: 480,
    width: 320,
    height: 240,
    pixelRatio: 1,
    currentPixelRatio: 2
  }), true);
});

test('native refraction target-set policy keeps opaque frames allocation-free', () => {
  const device = {};
  assert.deepEqual(resolveNativeRefractionTargetSetAction({
    required: false,
    device,
    width: 1280,
    height: 720,
    colorFormat: 'bgra8unorm'
  }), {
    status: 'opaque-no-targets',
    width: 1280,
    height: 720,
    colorFormat: 'bgra8unorm',
    depthFormat: 'depth32float',
    retireActive: false,
    deferRetirement: false,
    create: false,
    reuse: false
  });

  const activeTargetSet = {
    device,
    width: 1280,
    height: 720,
    colorFormat: 'bgra8unorm',
    depthFormat: 'depth32float',
    copyTexture: {},
    backfaceTexture: {}
  };
  const release = resolveNativeRefractionTargetSetAction({
    required: false,
    activeTargetSet,
    device,
    width: 1280,
    height: 720,
    colorFormat: 'bgra8unorm',
    resourceReleaseBlocked: true
  });
  assert.equal(release.status, 'release-opaque-targets');
  assert.equal(release.retireActive, true);
  assert.equal(release.deferRetirement, true);
});

test('native refraction target-set policy reuses exact generations and defers blocked replacement', () => {
  const device = {};
  const activeTargetSet = {
    device,
    width: 640,
    height: 360,
    colorFormat: 'bgra8unorm',
    depthFormat: 'depth32float',
    copyTexture: {},
    backfaceTexture: {}
  };
  const reuse = resolveNativeRefractionTargetSetAction({
    required: true,
    activeTargetSet,
    device,
    width: 640,
    height: 360,
    colorFormat: 'bgra8unorm',
    resourceReleaseBlocked: true
  });
  assert.equal(reuse.status, 'reuse-targets');
  assert.equal(reuse.reuse, true);
  assert.equal(reuse.retireActive, false);

  const replace = resolveNativeRefractionTargetSetAction({
    required: true,
    activeTargetSet,
    device,
    width: 1280,
    height: 720,
    colorFormat: 'bgra8unorm',
    resourceReleaseBlocked: true
  });
  assert.equal(replace.status, 'replace-targets');
  assert.equal(replace.create, true);
  assert.equal(replace.retireActive, true);
  assert.equal(replace.deferRetirement, true);

  const settledReplace = resolveNativeRefractionTargetSetAction({
    required: true,
    activeTargetSet,
    device,
    width: 1280,
    height: 720,
    colorFormat: 'bgra8unorm',
    resourceReleaseBlocked: false
  });
  assert.equal(settledReplace.status, 'replace-targets');
  assert.equal(settledReplace.deferRetirement, false);
});

test('native refraction resize activates the replacement while validation keeps the old target alive', () => {
  const device = {};
  const oldTarget = {
    generation: 1,
    device,
    width: 640,
    height: 360,
    colorFormat: 'bgra8unorm',
    depthFormat: 'depth32float',
    copyTexture: {},
    backfaceTexture: {}
  };
  const action = resolveNativeRefractionTargetSetAction({
    required: true,
    activeTargetSet: oldTarget,
    device,
    width: 1280,
    height: 720,
    colorFormat: 'bgra8unorm',
    resourceReleaseBlocked: true
  });
  assert.equal(action.status, 'replace-targets');
  assert.equal(action.retireActive, true);
  assert.equal(action.create, true);

  const deferred = [];
  let destroyCount = 0;
  const retirement = retireNativeRefractionTargetSet({
    targetSet: oldTarget,
    deferRelease(request) {
      deferred.push(request);
      return true;
    },
    destroyTargetSet(target) {
      assert.equal(target, oldTarget);
      destroyCount += 1;
      return true;
    }
  });
  const activeTarget = {
    generation: 2,
    device,
    width: action.width,
    height: action.height,
    colorFormat: action.colorFormat,
    depthFormat: action.depthFormat
  };

  assert.equal(activeTarget.generation, 2);
  assert.equal(retirement.status, 'retirement-liveness-pending');
  assert.equal(destroyCount, 0, 'pending validation must retain the old target');
  deferred[0].release();
  assert.equal(destroyCount, 1, 'validation settlement destroys the old target once');
  assert.equal(deferred[0].release(), false);
  assert.equal(destroyCount, 1);
  assert.equal(activeTarget.generation, 2, 'the replacement remains active');
});

test('native refraction target retirement waits for a liveness boundary and destroys once', () => {
  let destroyCount = 0;
  const deferredRequests = [];
  const targetSet = { generation: 7 };
  const retirement = retireNativeRefractionTargetSet({
    targetSet,
    status: 'resize-target-set',
    deferRelease(request) {
      deferredRequests.push(request);
      return true;
    },
    destroyTargetSet(retired) {
      assert.equal(retired, targetSet);
      destroyCount += 1;
      return true;
    }
  });
  assert.equal(retirement.deferred, true);
  assert.equal(retirement.released, false);
  assert.equal(deferredRequests.length, 1);
  assert.equal(deferredRequests[0].requiresLivenessBoundary, true);
  assert.equal(destroyCount, 0);

  deferredRequests.shift()?.release();
  assert.equal(destroyCount, 1);
  assert.equal(retirement.released, true);
  assert.equal(retirement.request.release(), false);
  assert.equal(destroyCount, 1);
});

test('native surface lifecycle defers replaced generations until validation settles', () => {
  const activeExecution = { drawIndirectRowsBuffer: {} };
  const retiredExecution = { drawIndirectRowsBuffer: {} };
  const drawState = {
    surfaceDrawExecution: activeExecution,
    drawIndirectRowsBuffer: activeExecution.drawIndirectRowsBuffer
  };

  assert.equal(
    resolveNativeSurfaceResourceReleaseAction({
      drawState,
      surfaceDrawExecution: retiredExecution,
      validationPending: true
    }).status,
    'defer-validation'
  );
  assert.equal(
    resolveNativeSurfaceResourceReleaseAction({
      drawState,
      surfaceDrawExecution: retiredExecution
    }).status,
    'release-now'
  );
});

test('native surface lifecycle atomically swaps owners and drains each retired generation once', () => {
  const firstExecution = { drawIndirectRowsBuffer: {} };
  const secondExecution = { drawIndirectRowsBuffer: {} };
  const bridge = {
    drawState: { surfaceDrawExecution: firstExecution },
    activeSurfaceResourceOwner: null,
    retiredSurfaceResourceOwners: []
  };
  const firstOwner = createNativeSurfaceResourceOwner({
    generation: 1,
    surfaceDraw: { surfaceDraw: firstExecution }
  });
  const secondOwner = createNativeSurfaceResourceOwner({
    generation: 2,
    surfaceDraw: { surfaceDraw: secondExecution }
  });

  assert.equal(installNativeSurfaceResourceOwner(bridge, firstOwner).retiredOwner, null);
  assert.equal(bridge.drawState.nativeSurfaceResourceGeneration, 1);
  assert.equal(installNativeSurfaceResourceOwner(bridge, secondOwner).retiredOwner, firstOwner);
  assert.equal(bridge.drawState.surfaceDrawExecution, secondExecution);
  assert.deepEqual(takeNativeSurfaceResourceOwners(bridge), [firstOwner]);
  assert.deepEqual(takeNativeSurfaceResourceOwners(bridge), []);
  assert.deepEqual(takeNativeSurfaceResourceOwners(bridge, { includeActive: true }), [secondOwner]);
  assert.equal(bridge.activeSurfaceResourceOwner, null);
});

test('native surface lifecycle retains distinct owners even when they share an execution', () => {
  const execution = { drawIndirectRowsBuffer: {} };
  const bridge = { drawState: {}, retiredSurfaceResourceOwners: [] };
  const firstOwner = createNativeSurfaceResourceOwner({
    generation: 1,
    surfaceDraw: { surfaceDraw: execution },
    extensionSurfaceResult: { release() {} }
  });
  const secondOwner = createNativeSurfaceResourceOwner({
    generation: 2,
    surfaceDraw: { surfaceDraw: execution },
    extensionSurfaceResult: { release() {} }
  });

  installNativeSurfaceResourceOwner(bridge, firstOwner);
  installNativeSurfaceResourceOwner(bridge, secondOwner);
  assert.deepEqual(takeNativeSurfaceResourceOwners(bridge), [firstOwner]);
  assert.equal(bridge.activeSurfaceResourceOwner, secondOwner);
});

test('native visual probes extract every captured interval while performance probes stay final-only', () => {
  assert.equal(nativeSurfaceVisualIntervalExtractionEnabled({
    surfaceDrawMode: 'native-webgpu-surface-consumer',
    captureFrames: true
  }), true);
  assert.equal(shouldExtractNativeSurfaceForProbeBatch({
    surfaceDrawMode: 'native-webgpu-surface-consumer',
    captureFrames: true,
    batchIndex: 1,
    batchCount: 4
  }), true);
  assert.equal(shouldExtractNativeSurfaceForProbeBatch({
    surfaceDrawMode: 'native-webgpu-surface-consumer',
    captureFrames: false,
    batchIndex: 1,
    batchCount: 4
  }), false);
  assert.equal(shouldExtractNativeSurfaceForProbeBatch({
    surfaceDrawMode: 'native-webgpu-surface-consumer',
    captureFrames: false,
    batchIndex: 4,
    batchCount: 4
  }), true);
  assert.equal(shouldExtractNativeSurfaceForProbeBatch({
    surfaceDrawMode: 'three-render-row-spheres',
    captureFrames: true,
    batchIndex: 1,
    batchCount: 4
  }), false);
});

test('additional native generations reject stale and invalid transactional candidates', () => {
  assert.deepEqual(resolveAdditionalNativeSurfaceGenerationAttempt({
    highestAttemptedGeneration: 5,
    generation: 4
  }), {
    generation: 4,
    highestAttemptedGeneration: 5,
    stale: true
  });
  assert.deepEqual(resolveAdditionalNativeSurfaceGenerationAttempt({
    highestAttemptedGeneration: 5,
    generation: 6
  }), {
    generation: 6,
    highestAttemptedGeneration: 6,
    stale: false
  });
  assert.equal(shouldCommitAdditionalNativeSurfaceCandidate({
    inputCount: 2,
    acceptedCount: 0
  }), false);
  assert.equal(shouldCommitAdditionalNativeSurfaceCandidate({
    inputCount: 0,
    acceptedCount: 0
  }), true);
  assert.equal(shouldCommitAdditionalNativeSurfaceCandidate({
    inputCount: 2,
    acceptedCount: 1
  }), true);
});

test('native bridge device loss and release are sticky across refresh and require explicit disposal', () => {
  assert.equal(nativeSurfaceBridgeFailureReason({
    rendererBridge: 'native-webgpu-surface-consumer',
    deviceLost: true,
    deviceLostReason: 'device removed'
  }), 'device removed');
  assert.equal(nativeSurfaceBridgeFailureReason({
    rendererBridge: 'native-webgpu-surface-consumer',
    released: true
  }), 'native WebGPU surface bridge was released');
  assert.equal(nativeSurfaceBridgeFailureReason({
    rendererBridge: 'native-webgpu-surface-consumer'
  }), null);

  const firstRelease = { release() {} };
  const secondRelease = { surfaceDraw: {} };
  const bridge = {
    rendererBridge: 'native-webgpu-surface-consumer',
    nativeSurfaceDeferredResourceReleases: [firstRelease, secondRelease],
    pixelValidationPending: true,
    offscreenValidationPending: true
  };
  assert.deepEqual(
    prepareNativeSurfaceBridgeForForcedDisposal(bridge),
    [firstRelease, secondRelease]
  );
  assert.deepEqual(bridge.nativeSurfaceDeferredResourceReleases, []);
  assert.equal(bridge.nativeSurfaceForceDisposing, true);
  assert.equal(bridge.pixelValidationAbandoned, true);
  assert.equal(bridge.offscreenValidationAbandoned, true);
  assert.equal(bridge.pixelValidationPending, false);
  assert.equal(bridge.offscreenValidationPending, false);
  assert.deepEqual(prepareNativeSurfaceBridgeForForcedDisposal(bridge), []);
});

test('native consumer keeps same-device quarantine and resets replacement-device state', () => {
  const lostDevice = {};
  const replacementDevice = {};
  const previous = {
    device: lostDevice,
    deviceLost: true,
    deviceLostReason: 'device removed',
    deviceLostInfo: { reason: 'destroyed', message: 'device removed' },
    pixelValidationStatus: 'passed',
    readbackSmokeValidationStatus: 'passed',
    readbackSmokeValidationReason: 'old device validated',
    readbackSmokeValidationSample: [1, 2, 3, 4],
    offscreenValidationStatus: 'passed',
    offscreenValidationReason: 'old device validated',
    offscreenValidationSample: [5, 6, 7, 8],
    offscreenValidationNonzeroPixelCount: 4,
    offscreenValidationPixelCount: 4,
    offscreenValidationWidth: 2,
    offscreenValidationHeight: 2
  };

  const retained = resolveNativeSurfaceConsumerDeviceTransition({
    previous,
    device: lostDevice
  });
  assert.equal(retained.status, 'native-surface-consumer-same-device');
  assert.equal(retained.deviceLost, true);
  assert.equal(retained.pixelValidationStatus, 'passed');
  assert.deepEqual(retained.readbackSmokeValidationSample, [1, 2, 3, 4]);
  assert.notEqual(retained.readbackSmokeValidationSample, previous.readbackSmokeValidationSample);

  const reconfigured = resolveNativeSurfaceConsumerDeviceTransition({
    previous,
    device: lostDevice,
    presentationReconfigured: true
  });
  assert.equal(reconfigured.status, 'native-surface-consumer-same-device-reconfigured');
  assert.equal(reconfigured.deviceLost, true);
  assert.equal(reconfigured.pixelValidationStatus, 'not-run');
  assert.equal(reconfigured.offscreenValidationSample, null);

  const replacement = resolveNativeSurfaceConsumerDeviceTransition({
    previous,
    device: replacementDevice
  });
  assert.equal(replacement.status, 'native-surface-consumer-replacement-device');
  assert.equal(replacement.sameDevice, false);
  assert.equal(replacement.deviceLost, false);
  assert.equal(replacement.deviceLostReason, null);
  assert.equal(replacement.pixelValidationStatus, 'not-run');
  assert.equal(replacement.readbackSmokeValidationSample, null);
  assert.equal(replacement.offscreenValidationSample, null);

  const resurrectedLostDevice = resolveNativeSurfaceConsumerDeviceTransition({
    previous: { device: replacementDevice },
    device: lostDevice,
    deviceKnownLost: true
  });
  assert.equal(
    resurrectedLostDevice.status,
    'native-surface-consumer-known-lost-device-quarantined'
  );
  assert.equal(resurrectedLostDevice.deviceKnownLost, true);
  assert.equal(resurrectedLostDevice.deviceLost, true);
  assert.equal(
    resurrectedLostDevice.deviceLostReason,
    'native WebGPU device is already known lost'
  );
});

test('device-loss notification quarantines current owners without poisoning a replacement', () => {
  const lostDevice = {};
  const replacementDevice = {};
  const rendererConsumer = { device: lostDevice };
  const sceneConsumer = { device: lostDevice };
  const replacementConsumer = { device: replacementDevice, deviceLost: false };
  const bridge = {
    rendererBridge: 'native-webgpu-surface-consumer',
    device: lostDevice
  };
  const loss = markNativeSurfaceDeviceLostForCurrentOwners({
    device: lostDevice,
    consumers: [rendererConsumer, sceneConsumer, replacementConsumer],
    renderBridge: bridge,
    reason: 'device removed',
    info: { reason: 'destroyed', message: 'device removed' },
    updatedAtMs: 42
  });
  assert.equal(loss.status, 'native-surface-current-device-owners-quarantined');
  assert.equal(loss.consumerUpdateCount, 2);
  assert.equal(loss.renderBridgeUpdated, true);
  assert.equal(rendererConsumer.deviceLost, true);
  assert.equal(sceneConsumer.deviceLostReason, 'device removed');
  assert.equal(sceneConsumer.updatedAtMs, 42);
  assert.equal(bridge.deviceLost, true);
  assert.equal(replacementConsumer.deviceLost, false);
});

test('failed native bridge admits only a distinct replacement device', () => {
  const lostDevice = {};
  const replacementDevice = {};
  const bridge = {
    rendererBridge: 'native-webgpu-surface-consumer',
    device: lostDevice,
    deviceLost: true,
    deviceLostReason: 'device removed'
  };
  const quarantined = resolveNativeSurfaceBridgeDeviceAdmission({
    renderBridge: bridge,
    device: lostDevice
  });
  assert.equal(quarantined.admitted, false);
  assert.equal(quarantined.replacementDevice, false);
  assert.equal(quarantined.failureReason, 'device removed');

  const admitted = resolveNativeSurfaceBridgeDeviceAdmission({
    renderBridge: bridge,
    device: replacementDevice
  });
  assert.equal(admitted.admitted, true);
  assert.equal(admitted.replacementDevice, true);
  assert.equal(admitted.failureReason, 'device removed');

  const resurrectedLostDevice = resolveNativeSurfaceBridgeDeviceAdmission({
    renderBridge: bridge,
    device: replacementDevice,
    deviceKnownLost: true
  });
  assert.equal(resurrectedLostDevice.admitted, false);
  assert.equal(resurrectedLostDevice.replacementDevice, false);
  assert.equal(
    resurrectedLostDevice.status,
    'native-surface-known-lost-device-quarantined'
  );
});
