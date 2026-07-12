import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  createNativeSurfaceResourceOwner,
  installNativeSurfaceResourceOwner,
  nativeSurfaceBridgeFailureReason,
  nativeSurfaceDrawStateUsesExecution,
  nativeSurfaceVisualIntervalExtractionEnabled,
  prepareNativeSurfaceBridgeForForcedDisposal,
  rendererCanvasResizeRequired,
  retireNativeRefractionTargetSet,
  resolveAdditionalNativeSurfaceGenerationAttempt,
  resolveNativeRefractionTargetSetAction,
  resolveNativeSurfaceResourceReleaseAction,
  shouldCommitAdditionalNativeSurfaceCandidate,
  shouldExtractNativeSurfaceForProbeBatch,
  takeNativeSurfaceResourceOwners
} from '../src/visualization/nativeSurfaceResourceLifecycle.js';

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
    inFlightSubmitCount: 2,
    submitFencePending: true
  });
  assert.equal(release.status, 'release-opaque-targets');
  assert.equal(release.retireActive, true);
  assert.equal(release.deferRetirement, true);
});

test('native refraction target-set policy reuses exact generations and fences resize replacement', () => {
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
    inFlightSubmitCount: 2,
    submitFencePending: true
  });
  assert.equal(reuse.status, 'reuse-targets');
  assert.equal(reuse.reuse, true);
  assert.equal(reuse.retireActive, false);

  for (const inFlightSubmitCount of [2, 1]) {
    const replace = resolveNativeRefractionTargetSetAction({
      required: true,
      activeTargetSet,
      device,
      width: 1280,
      height: 720,
      colorFormat: 'bgra8unorm',
      inFlightSubmitCount,
      submitFencePending: true
    });
    assert.equal(replace.status, 'replace-targets');
    assert.equal(replace.create, true);
    assert.equal(replace.retireActive, true);
    assert.equal(replace.deferRetirement, true);
  }

  const settledReplace = resolveNativeRefractionTargetSetAction({
    required: true,
    activeTargetSet,
    device,
    width: 1280,
    height: 720,
    colorFormat: 'bgra8unorm',
    inFlightSubmitCount: 0,
    submitFencePending: false
  });
  assert.equal(settledReplace.status, 'replace-targets');
  assert.equal(settledReplace.deferRetirement, false);
});

test('native refraction target retirement waits for both in-flight submissions and destroys once', () => {
  let inFlightSubmitCount = 2;
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
  assert.equal(deferredRequests[0].requiresSuccessfulSubmitFence, true);
  assert.equal(destroyCount, 0);

  const settleOneSubmit = () => {
    inFlightSubmitCount -= 1;
    if (inFlightSubmitCount === 0) deferredRequests.shift()?.release();
  };
  settleOneSubmit();
  assert.equal(inFlightSubmitCount, 1);
  assert.equal(destroyCount, 0);
  assert.equal(retirement.released, false);
  settleOneSubmit();
  assert.equal(inFlightSubmitCount, 0);
  assert.equal(destroyCount, 1);
  assert.equal(retirement.released, true);
  assert.equal(retirement.request.release(), false);
  assert.equal(destroyCount, 1);
});

test('native surface lifecycle defers replaced generations until submit and validation settle', () => {
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
      submitFencePending: true
    }).status,
    'defer-submit-fence'
  );
  assert.equal(
    resolveNativeSurfaceResourceReleaseAction({
      drawState,
      surfaceDrawExecution: retiredExecution,
      submitFenceTimedOut: true
    }).status,
    'defer-submit-fence-timeout'
  );
  assert.equal(
    resolveNativeSurfaceResourceReleaseAction({
      drawState,
      surfaceDrawExecution: retiredExecution,
      submitFenceFailed: true
    }).status,
    'defer-submit-fence-error'
  );
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

test('native surface owners preserve presentation resources with their generation', () => {
  const execution = { drawIndirectRowsBuffer: {} };
  const resource = { ownerGeneration: 7, release() {} };
  const owner = createNativeSurfaceResourceOwner({
    generation: 7,
    surfaceDraw: { surfaceDraw: execution },
    presentationResources: [resource, null]
  });

  assert.equal(owner.generation, 7);
  assert.deepEqual(owner.presentationResources, [resource]);
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

test('native bridge failures are sticky across refresh and require explicit disposal', () => {
  assert.equal(nativeSurfaceBridgeFailureReason({
    rendererBridge: 'native-webgpu-surface-consumer',
    nativeSurfaceConsumerSubmitFenceFailed: true,
    nativeSurfaceConsumerSubmitFenceReason: 'queue rejected'
  }), 'queue rejected');
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
