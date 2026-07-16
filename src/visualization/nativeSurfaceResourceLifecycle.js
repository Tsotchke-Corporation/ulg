export const NATIVE_WEBGPU_SURFACE_CONSUMER_MODE = 'native-webgpu-surface-consumer';

export function resolveNativeSurfaceAnimationFramePolicy({
  nativeBridge = false,
  cameraDirty = false,
  stateDirty = false,
  controlsChanged = false,
  continuousRedraw = false
} = {}) {
  const drawRequired = Boolean(
    !nativeBridge
    || cameraDirty
    || stateDirty
    || controlsChanged
    || continuousRedraw
  );
  return {
    schema: 'peercompute.ulg.native-surface-animation-frame-policy.v0',
    drawRequired,
    mode: nativeBridge ? 'on-demand-camera-or-state-change' : 'continuous-engine-frame',
    reason: drawRequired
      ? (!nativeBridge
        ? 'non-native rendering follows the engine animation frame'
        : 'native surface presentation changed or continuous redraw was requested')
      : 'native surface presentation is unchanged'
  };
}

export function resolveNativeSurfaceSubmitSynchronization({
  rendererBridge = null
} = {}) {
  const nativeSameQueueConsumer =
    rendererBridge === NATIVE_WEBGPU_SURFACE_CONSUMER_MODE;
  return {
    schema: 'peercompute.ulg.native-surface-submit-synchronization.v0',
    nativeSameQueueConsumer,
    requiresCpuQueueFence: !nativeSameQueueConsumer,
    sameQueueSubmissionBoundary: nativeSameQueueConsumer,
    resourceRetirementSafeAfterSubmit: nativeSameQueueConsumer,
    reason: nativeSameQueueConsumer
      ? 'native render and compute share one ordered queue; submitted command buffers retain referenced allocations without a per-frame CPU fence'
      : 'non-native consumers retain the generic CPU queue-completion fence contract'
  };
}

export function nativeSurfaceBridgeFailureReason(renderBridge) {
  if (!renderBridge || renderBridge.rendererBridge !== NATIVE_WEBGPU_SURFACE_CONSUMER_MODE) {
    return null;
  }
  if (renderBridge.released) return 'native WebGPU surface bridge was released';
  if (renderBridge.deviceLost) {
    return renderBridge.deviceLostReason || 'native WebGPU surface device was lost';
  }
  return null;
}

export function resolveNativeSurfaceConsumerDeviceTransition({
  previous = null,
  device = null,
  presentationReconfigured = false,
  deviceKnownLost = false
} = {}) {
  const knownLost = Boolean(device && deviceKnownLost);
  const sameDevice = Boolean(previous?.device && device && previous.device === device);
  const resetValidation = !sameDevice || presentationReconfigured === true;
  return {
    status: knownLost
      ? 'native-surface-consumer-known-lost-device-quarantined'
      : !sameDevice
      ? (previous?.device
        ? 'native-surface-consumer-replacement-device'
        : 'native-surface-consumer-initial-device')
      : (resetValidation
        ? 'native-surface-consumer-same-device-reconfigured'
        : 'native-surface-consumer-same-device'),
    sameDevice,
    deviceKnownLost: knownLost,
    deviceLost: knownLost || (sameDevice ? Boolean(previous.deviceLost) : false),
    deviceLostReason: knownLost
      ? (sameDevice
        ? (previous.deviceLostReason || 'native WebGPU device is already known lost')
        : 'native WebGPU device is already known lost')
      : (sameDevice ? (previous.deviceLostReason || null) : null),
    deviceLostInfo: sameDevice ? (previous.deviceLostInfo || null) : null,
    pixelValidationStatus: resetValidation
      ? 'not-run'
      : (previous.pixelValidationStatus || 'not-run'),
    readbackSmokeValidationStatus: resetValidation
      ? 'not-run'
      : (previous.readbackSmokeValidationStatus || 'not-run'),
    readbackSmokeValidationReason: resetValidation
      ? null
      : (previous.readbackSmokeValidationReason || null),
    readbackSmokeValidationSample: !resetValidation
      && Array.isArray(previous.readbackSmokeValidationSample)
      ? [...previous.readbackSmokeValidationSample]
      : null,
    offscreenValidationStatus: resetValidation
      ? 'not-run'
      : (previous.offscreenValidationStatus || 'not-run'),
    offscreenValidationReason: resetValidation
      ? null
      : (previous.offscreenValidationReason || null),
    offscreenValidationSample: !resetValidation
      && Array.isArray(previous.offscreenValidationSample)
      ? [...previous.offscreenValidationSample]
      : null,
    offscreenValidationNonzeroPixelCount: resetValidation
      ? null
      : (previous.offscreenValidationNonzeroPixelCount ?? null),
    offscreenValidationPixelCount: resetValidation
      ? null
      : (previous.offscreenValidationPixelCount ?? null),
    offscreenValidationWidth: resetValidation
      ? null
      : (previous.offscreenValidationWidth ?? null),
    offscreenValidationHeight: resetValidation
      ? null
      : (previous.offscreenValidationHeight ?? null)
  };
}

export function markNativeSurfaceDeviceLostForCurrentOwners({
  device = null,
  consumers = [],
  renderBridge = null,
  reason = 'native WebGPU device was lost',
  info = null,
  updatedAtMs = null
} = {}) {
  const currentConsumers = [...new Set(Array.isArray(consumers) ? consumers.filter(Boolean) : [])];
  let consumerUpdateCount = 0;
  const deviceLostInfo = info && typeof info === 'object' ? { ...info } : null;
  for (const consumer of currentConsumers) {
    if (!device || consumer?.device !== device) continue;
    consumer.deviceLost = true;
    consumer.deviceLostReason = reason;
    consumer.deviceLostInfo = deviceLostInfo;
    if (Number.isFinite(Number(updatedAtMs))) consumer.updatedAtMs = Number(updatedAtMs);
    consumerUpdateCount += 1;
  }
  const renderBridgeUpdated = Boolean(device && renderBridge?.device === device);
  if (renderBridgeUpdated) {
    renderBridge.deviceLost = true;
    renderBridge.deviceLostReason = reason;
    renderBridge.deviceLostInfo = deviceLostInfo;
  }
  return {
    status: consumerUpdateCount > 0 || renderBridgeUpdated
      ? 'native-surface-current-device-owners-quarantined'
      : 'native-surface-stale-device-loss-ignored',
    reason,
    consumerUpdateCount,
    renderBridgeUpdated
  };
}

export function resolveNativeSurfaceBridgeDeviceAdmission({
  renderBridge = null,
  device = null,
  deviceKnownLost = false
} = {}) {
  if (device && deviceKnownLost) {
    const failureReason = 'native WebGPU device is already known lost';
    return {
      status: 'native-surface-known-lost-device-quarantined',
      admitted: false,
      replacementDevice: false,
      failureReason,
      reason: failureReason
    };
  }
  const failureReason = nativeSurfaceBridgeFailureReason(renderBridge);
  if (!failureReason) {
    return {
      status: 'native-surface-bridge-healthy',
      admitted: true,
      replacementDevice: false,
      failureReason: null
    };
  }
  const failedDevice = renderBridge?.device || renderBridge?.nativeConsumer?.device || null;
  const replacementDevice = Boolean(device && (!failedDevice || device !== failedDevice));
  return {
    status: replacementDevice
      ? 'native-surface-failed-bridge-replacement-device-admitted'
      : 'native-surface-failed-bridge-device-quarantined',
    admitted: replacementDevice,
    replacementDevice,
    failureReason,
    reason: replacementDevice ? null : failureReason
  };
}

export function prepareNativeSurfaceBridgeForForcedDisposal(renderBridge) {
  if (!renderBridge || renderBridge.rendererBridge !== NATIVE_WEBGPU_SURFACE_CONSUMER_MODE) {
    return [];
  }
  const requests = Array.isArray(renderBridge.nativeSurfaceDeferredResourceReleases)
    ? [...renderBridge.nativeSurfaceDeferredResourceReleases]
    : [];
  renderBridge.nativeSurfaceDeferredResourceReleases = [];
  renderBridge.nativeSurfaceForceDisposing = true;
  renderBridge.pixelValidationAbandoned = Boolean(renderBridge.pixelValidationPending);
  renderBridge.offscreenValidationAbandoned = Boolean(renderBridge.offscreenValidationPending);
  renderBridge.pixelValidationPending = false;
  renderBridge.offscreenValidationPending = false;
  return requests;
}

export function resolveAdditionalNativeSurfaceGenerationAttempt({
  highestAttemptedGeneration = 0,
  generation = null
} = {}) {
  const highest = Math.max(0, Math.round(Number(highestAttemptedGeneration) || 0));
  if (!Number.isFinite(Number(generation))) {
    return { generation: null, highestAttemptedGeneration: highest, stale: false };
  }
  const normalizedGeneration = Math.max(0, Math.round(Number(generation)));
  return {
    generation: normalizedGeneration,
    highestAttemptedGeneration: Math.max(highest, normalizedGeneration),
    stale: normalizedGeneration < highest
  };
}

export function shouldCommitAdditionalNativeSurfaceCandidate({
  inputCount = 0,
  acceptedCount = 0
} = {}) {
  const inputs = Math.max(0, Math.round(Number(inputCount) || 0));
  const accepted = Math.max(0, Math.round(Number(acceptedCount) || 0));
  return inputs === 0 || accepted > 0;
}

export function createNativeSurfaceResourceOwner({
  generation = 0,
  surfaceDraw = null,
  surfaceDrawExecution = surfaceDraw?.surfaceDraw ?? null,
  surfaceVerticesExecution = surfaceDraw?.surfaceVertices ?? null,
  translation = surfaceDraw?.extensionSurfaceTranslation ?? null,
  extensionSurfaceResult = surfaceDraw?.extensionSurfaceResult ?? null
} = {}) {
  if (!surfaceDrawExecution) return null;
  return {
    generation: Math.max(0, Math.round(Number(generation) || 0)),
    surfaceDraw,
    surfaceDrawExecution,
    surfaceVerticesExecution,
    translation,
    extensionSurfaceResult
  };
}

export function installNativeSurfaceResourceOwner(renderBridge, owner) {
  if (!renderBridge || !owner) {
    return { installed: false, retiredOwner: null, activeOwner: null };
  }
  const previousOwner = renderBridge.activeSurfaceResourceOwner ?? null;
  const ownerChanged = Boolean(
    previousOwner
    && previousOwner !== owner
  );
  if (ownerChanged) {
    const retired = Array.isArray(renderBridge.retiredSurfaceResourceOwners)
      ? renderBridge.retiredSurfaceResourceOwners
      : [];
    retired.push(previousOwner);
    renderBridge.retiredSurfaceResourceOwners = retired;
  }
  renderBridge.activeSurfaceResourceOwner = owner;
  renderBridge.nativeSurfaceResourceGeneration = owner.generation;
  if (renderBridge.drawState) {
    renderBridge.drawState.surfaceDrawExecution = owner.surfaceDrawExecution;
    renderBridge.drawState.nativeSurfaceResourceGeneration = owner.generation;
  }
  return {
    installed: true,
    retiredOwner: ownerChanged ? previousOwner : null,
    activeOwner: owner
  };
}

export function takeNativeSurfaceResourceOwners(renderBridge, { includeActive = false } = {}) {
  if (!renderBridge) return [];
  const owners = Array.isArray(renderBridge.retiredSurfaceResourceOwners)
    ? [...renderBridge.retiredSurfaceResourceOwners]
    : [];
  renderBridge.retiredSurfaceResourceOwners = [];
  if (includeActive && renderBridge.activeSurfaceResourceOwner) {
    owners.push(renderBridge.activeSurfaceResourceOwner);
    renderBridge.activeSurfaceResourceOwner = null;
  }
  const seenOwners = new Set();
  return owners.filter((owner) => {
    if (!owner || seenOwners.has(owner)) return false;
    seenOwners.add(owner);
    return true;
  });
}

export function rendererCanvasResizeRequired({
  canvasWidth = 0,
  canvasHeight = 0,
  width = 0,
  height = 0,
  pixelRatio = 1,
  currentPixelRatio = null
} = {}) {
  const ratio = Math.max(0.1, Number(pixelRatio) || 1);
  const expectedWidth = Math.max(1, Math.floor((Number(width) || 0) * ratio));
  const expectedHeight = Math.max(1, Math.floor((Number(height) || 0) * ratio));
  const ratioChanged = !Number.isFinite(Number(currentPixelRatio))
    || Math.abs(Number(currentPixelRatio) - ratio) > 1e-6;
  return Boolean(
    ratioChanged
    || Math.round(Number(canvasWidth) || 0) !== expectedWidth
    || Math.round(Number(canvasHeight) || 0) !== expectedHeight
  );
}

export function resolveNativeRefractionTargetSetAction({
  required = false,
  activeTargetSet = null,
  device = null,
  width = 0,
  height = 0,
  colorFormat = null,
  depthFormat = 'depth32float',
  resourceReleaseBlocked = false
} = {}) {
  const normalizedWidth = Math.max(0, Math.round(Number(width) || 0));
  const normalizedHeight = Math.max(0, Math.round(Number(height) || 0));
  const active = Boolean(activeTargetSet);
  const retirementBlocked = Boolean(resourceReleaseBlocked);
  const base = {
    width: normalizedWidth,
    height: normalizedHeight,
    colorFormat: colorFormat || null,
    depthFormat: depthFormat || null,
    retireActive: false,
    deferRetirement: false,
    create: false,
    reuse: false
  };
  if (!required) {
    return active
      ? {
          ...base,
          status: 'release-opaque-targets',
          retireActive: true,
          deferRetirement: retirementBlocked
        }
      : { ...base, status: 'opaque-no-targets' };
  }
  if (
    !device
    || normalizedWidth <= 1
    || normalizedHeight <= 1
    || !colorFormat
    || !depthFormat
  ) {
    return {
      ...base,
      status: 'required-targets-unavailable',
      retireActive: active,
      deferRetirement: active && retirementBlocked
    };
  }
  const exactMatch = Boolean(
    activeTargetSet?.device === device
    && activeTargetSet.width === normalizedWidth
    && activeTargetSet.height === normalizedHeight
    && activeTargetSet.colorFormat === colorFormat
    && activeTargetSet.depthFormat === depthFormat
    && activeTargetSet.copyTexture
    && activeTargetSet.backfaceTexture
  );
  if (exactMatch) {
    return { ...base, status: 'reuse-targets', reuse: true };
  }
  return {
    ...base,
    status: active ? 'replace-targets' : 'create-targets',
    retireActive: active,
    deferRetirement: active && retirementBlocked,
    create: true
  };
}

export function retireNativeRefractionTargetSet({
  targetSet = null,
  status = 'native-refraction-target-set-retired',
  deferRelease = null,
  destroyTargetSet = null,
  onRelease = null
} = {}) {
  if (!targetSet || typeof destroyTargetSet !== 'function') {
    return {
      status: 'retirement-unavailable',
      deferred: false,
      released: false,
      request: null
    };
  }
  let released = false;
  const release = () => {
    if (released) return false;
    released = Boolean(destroyTargetSet(targetSet));
    onRelease?.({ targetSet, released });
    return released;
  };
  const request = {
    status,
    requiresLivenessBoundary: true,
    release
  };
  const deferred = Boolean(
    typeof deferRelease === 'function'
    && deferRelease(request) === true
  );
  if (!deferred) release();
  return {
    status: deferred ? 'retirement-liveness-pending' : 'retired-without-liveness-blocker',
    deferred,
    get released() { return released; },
    request
  };
}

export function nativeSurfaceDrawStateUsesExecution(drawState, surfaceDrawExecution) {
  if (!drawState || !surfaceDrawExecution) return false;
  if (drawState.surfaceDrawExecution) {
    return drawState.surfaceDrawExecution === surfaceDrawExecution;
  }
  return Boolean(
    surfaceDrawExecution.drawIndirectRowsBuffer
    && drawState.drawIndirectRowsBuffer === surfaceDrawExecution.drawIndirectRowsBuffer
  );
}

export function resolveNativeSurfaceResourceReleaseAction({
  drawState = null,
  surfaceDrawExecution = null,
  validationPending = false
} = {}) {
  if (nativeSurfaceDrawStateUsesExecution(drawState, surfaceDrawExecution)) {
    return {
      status: 'retain-active-generation',
      releaseNow: false,
      defer: false,
      retainActive: true,
      reason: 'the native bridge draw state still owns this surface execution'
    };
  }
  if (validationPending) {
    return {
      status: 'defer-validation',
      releaseNow: false,
      defer: true,
      retainActive: false,
      reason: 'native surface validation still references the surface generation'
    };
  }
  return {
    status: 'release-now',
    releaseNow: true,
    defer: false,
    retainActive: false,
    reason: 'the surface generation is inactive and has no outstanding liveness references'
  };
}

export function nativeSurfaceVisualIntervalExtractionEnabled({
  surfaceDrawMode = 'auto',
  captureFrames = false
} = {}) {
  return Boolean(
    captureFrames
    && String(surfaceDrawMode || '').trim().toLowerCase()
      === NATIVE_WEBGPU_SURFACE_CONSUMER_MODE
  );
}

export function shouldExtractNativeSurfaceForProbeBatch({
  surfaceDrawMode = 'auto',
  captureFrames = false,
  batchIndex = 0,
  batchCount = 0
} = {}) {
  const finalBatch = Math.max(0, Math.round(Number(batchIndex) || 0))
    >= Math.max(0, Math.round(Number(batchCount) || 0));
  return Boolean(
    finalBatch
    || nativeSurfaceVisualIntervalExtractionEnabled({ surfaceDrawMode, captureFrames })
  );
}
