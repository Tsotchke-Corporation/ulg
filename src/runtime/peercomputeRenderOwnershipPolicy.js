export const ULG_PEERCOMPUTE_RENDER_OWNERSHIP_POLICY_SCHEMA =
  'peercompute.ulg.render-ownership-policy.v0';

export const ULG_PEERCOMPUTE_RENDER_OWNERSHIP_MODES = Object.freeze({
  AUTO: 'auto',
  MAIN_THREAD_RENDERER: 'main-thread-renderer',
  WORKER_OFFSCREEN_RENDER_ROWS: 'worker-offscreen-render-rows',
  WORKER_OWNED_RESIDENT_RENDER_PRODUCER: 'worker-owned-resident-render-producer',
  PRESENTATION_WORKER_RETAINED_OUTPUT_PRESENTATION_ONLY:
    'presentation-worker-retained-output-presentation-only',
  CROSS_WORKER_GPU_BUFFER_HANDOFF: 'cross-worker-gpubuffer-structured-clone'
});

export const ULG_PEERCOMPUTE_RENDER_OWNERSHIP_TRANSPORTS = Object.freeze({
  MAIN_THREAD_DOM_CANVAS: 'main-thread-dom-canvas',
  WORKER_OWNED_PRESENTED_CANVAS: 'worker-owned-presented-canvas',
  MAIN_THREAD_COMPACT_RENDER_ROW_TRANSFER: 'main-thread-compact-render-row-transfer',
  WORKER_OWNED_RESIDENT_RENDER_PRODUCER: 'worker-owned-resident-render-producer',
  PRESENTATION_WORKER_RESIDENT_STAGE_CHAIN: 'offscreen-presentation-worker-device',
  CROSS_WORKER_GPU_BUFFER_STRUCTURED_CLONE: 'cross-worker-gpubuffer-structured-clone',
  FRAME_COPY_BACK: 'frame-copy-back'
});

function nowMs() {
  return typeof globalThis.performance?.now === 'function'
    ? globalThis.performance.now()
    : Date.now();
}

function normalizeString(value, fallback = null) {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function normalizeBoolean(value, fallback = false) {
  if (value == null || value === '') return fallback;
  if (typeof value === 'boolean') return value;
  const normalized = String(value).trim().toLowerCase();
  if (['1', 'true', 'yes', 'on', 'enabled'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off', 'disabled', 'manual'].includes(normalized)) return false;
  return fallback;
}

export function normalizePeerComputeRenderOwnershipMode(value, fallback = ULG_PEERCOMPUTE_RENDER_OWNERSHIP_MODES.AUTO) {
  const normalized = normalizeString(value, fallback)?.toLowerCase();
  if (!normalized) return fallback;
  if (normalized === ULG_PEERCOMPUTE_RENDER_OWNERSHIP_MODES.AUTO) return normalized;
  if (
    normalized === 'main'
    || normalized === 'main-thread'
    || normalized === 'main-thread-render'
    || normalized === 'main-thread-renderer'
    || normalized === 'three'
    || normalized === 'three-renderer'
    || normalized === 'dom-canvas'
    || normalized === 'off'
  ) {
    return ULG_PEERCOMPUTE_RENDER_OWNERSHIP_MODES.MAIN_THREAD_RENDERER;
  }
  if (
    normalized === 'worker'
    || normalized === 'worker-offscreen'
    || normalized === 'offscreen'
    || normalized === 'offscreen-render-rows'
    || normalized === 'worker-render-rows'
    || normalized === 'worker-offscreen-render-rows'
    || normalized === 'render-rows'
  ) {
    return ULG_PEERCOMPUTE_RENDER_OWNERSHIP_MODES.WORKER_OFFSCREEN_RENDER_ROWS;
  }
  if (
    normalized === 'worker-owned'
    || normalized === 'worker-owned-resident'
    || normalized === 'worker-resident'
    || normalized === 'resident-producer'
    || normalized === 'worker-resident-producer'
    || normalized === 'worker-owned-resident-render-producer'
  ) {
    return ULG_PEERCOMPUTE_RENDER_OWNERSHIP_MODES.WORKER_OWNED_RESIDENT_RENDER_PRODUCER;
  }
  if (
    normalized === 'presentation-worker-retained'
    || normalized === 'presentation-worker-retained-output'
    || normalized === 'presentation-worker-retained-output-presentation-only'
    || normalized === 'presentation-worker-presentation-only'
    || normalized === 'worker-retained-presentation-only'
    || normalized === 'retained-output-presentation-only'
    || normalized === 'presentation-only'
  ) {
    return ULG_PEERCOMPUTE_RENDER_OWNERSHIP_MODES.PRESENTATION_WORKER_RETAINED_OUTPUT_PRESENTATION_ONLY;
  }
  if (
    normalized === 'gpubuffer'
    || normalized === 'gpu-buffer'
    || normalized === 'structured-clone'
    || normalized === 'cross-worker-gpubuffer'
    || normalized === 'cross-worker-gpubuffer-structured-clone'
    || normalized === 'retained-gpubuffer'
  ) {
    return ULG_PEERCOMPUTE_RENDER_OWNERSHIP_MODES.CROSS_WORKER_GPU_BUFFER_HANDOFF;
  }
  return fallback;
}

function policyObject(value) {
  return value && typeof value === 'object' ? value : {};
}

function firstPolicyString(policy, keys = []) {
  for (const key of keys) {
    const value = normalizeString(policy?.[key], null);
    if (value) return value;
  }
  return null;
}

export function resolvePeerComputeRenderOwnershipPolicy({
  peercomputePolicy = null,
  requestedMode = null,
  workerOffscreenPresentationRequested = false,
  retainedGpuBufferHandoffRequested = null,
  allowTransitionalRenderRows = true,
  workerOwnedResidentProducerReady = false,
  workerOwnedResidentProducerSourceTransferRequiredOverride = null,
  presentationWorkerResidentStagesRequested = null,
  useCase = null,
  source = 'local-demo',
  workerCapability = null
} = {}) {
  const policy = policyObject(peercomputePolicy);
  const configuredByPeerCompute = policy.configuredByPeerCompute === true
    || Boolean(peercomputePolicy && policy.schema !== ULG_PEERCOMPUTE_RENDER_OWNERSHIP_POLICY_SCHEMA);
  const rawRequestedMode = firstPolicyString(policy, [
    'requestedMode',
    'mode',
    'renderOwnershipMode',
    'presentationOwnershipMode',
    'inputTransport'
  ]) || requestedMode;
  let requested = normalizePeerComputeRenderOwnershipMode(rawRequestedMode, null);
  const policyPresentationWorkerPresentationOnlyRequested = normalizeBoolean(
    policy.presentationWorkerRetainedOutputPresentationOnly
      ?? policy.presentationWorkerRetainedOutputPresentationOnlyRequested
      ?? policy.presentationWorkerPresentationOnly
      ?? policy.presentationOnly,
    false
  );
  if (
    policyPresentationWorkerPresentationOnlyRequested
    && (!requested || requested === ULG_PEERCOMPUTE_RENDER_OWNERSHIP_MODES.AUTO)
  ) {
    requested =
      ULG_PEERCOMPUTE_RENDER_OWNERSHIP_MODES.PRESENTATION_WORKER_RETAINED_OUTPUT_PRESENTATION_ONLY;
  }
  const urlRequestedWorkerOffscreen = normalizeBoolean(workerOffscreenPresentationRequested, false);
  const policyRequestedWorkerOffscreen = normalizeBoolean(
    policy.workerOffscreenPresentationRequested ?? policy.workerOffscreenPresentation,
    false
  );
  if (!requested || requested === ULG_PEERCOMPUTE_RENDER_OWNERSHIP_MODES.AUTO) {
    requested = (urlRequestedWorkerOffscreen || policyRequestedWorkerOffscreen)
      ? ULG_PEERCOMPUTE_RENDER_OWNERSHIP_MODES.WORKER_OFFSCREEN_RENDER_ROWS
      : ULG_PEERCOMPUTE_RENDER_OWNERSHIP_MODES.MAIN_THREAD_RENDERER;
  }

  const presentationWorkerRetainedOutputPresentationOnlyRequested = Boolean(
    requested
      === ULG_PEERCOMPUTE_RENDER_OWNERSHIP_MODES.PRESENTATION_WORKER_RETAINED_OUTPUT_PRESENTATION_ONLY
    || policyPresentationWorkerPresentationOnlyRequested
  );
  const workerOwnedResidentProducerRequested =
    requested === ULG_PEERCOMPUTE_RENDER_OWNERSHIP_MODES.WORKER_OWNED_RESIDENT_RENDER_PRODUCER
    || presentationWorkerRetainedOutputPresentationOnlyRequested;
  const crossWorkerGpuBufferHandoffRequested =
    requested === ULG_PEERCOMPUTE_RENDER_OWNERSHIP_MODES.CROSS_WORKER_GPU_BUFFER_HANDOFF;
  const rawPresentationWorkerResidentStageChainRequested =
    presentationWorkerResidentStagesRequested
    ?? policy.presentationWorkerResidentStagesRequested
    ?? policy.workerOffscreenResidentStagesRequested
    ?? policy.workerOwnedResidentStageChainRequested
    ?? policy.residentStageChainOnPresentationWorker;
  const presentationWorkerResidentStageChainRequested = Boolean(
    presentationWorkerRetainedOutputPresentationOnlyRequested
    || normalizeBoolean(rawPresentationWorkerResidentStageChainRequested, false)
  );
  const workerPresentationRequested = Boolean(
    urlRequestedWorkerOffscreen
    || policyRequestedWorkerOffscreen
    || requested === ULG_PEERCOMPUTE_RENDER_OWNERSHIP_MODES.WORKER_OFFSCREEN_RENDER_ROWS
    || workerOwnedResidentProducerRequested
    || crossWorkerGpuBufferHandoffRequested
    || presentationWorkerResidentStageChainRequested
  );
  const targetImplementationReady = Boolean(workerOwnedResidentProducerReady) || normalizeBoolean(
    policy.workerOwnedResidentProducerReady ?? policy.targetImplementationReady,
    false
  );
  const transitionalRenderRowsAllowed = normalizeBoolean(
    policy.allowTransitionalRenderRows,
    allowTransitionalRenderRows
  );
  const transitionalRenderRowsActive = Boolean(
    workerOwnedResidentProducerRequested
    && !targetImplementationReady
    && transitionalRenderRowsAllowed
  );
  const effectiveMode = transitionalRenderRowsActive
    ? ULG_PEERCOMPUTE_RENDER_OWNERSHIP_MODES.WORKER_OFFSCREEN_RENDER_ROWS
    : (presentationWorkerRetainedOutputPresentationOnlyRequested
      ? ULG_PEERCOMPUTE_RENDER_OWNERSHIP_MODES.WORKER_OWNED_RESIDENT_RENDER_PRODUCER
      : requested);
  const retainedHandoffRequested = retainedGpuBufferHandoffRequested == null
    ? normalizeBoolean(
      policy.retainedGpuBufferHandoffRequested
        ?? policy.directGpuBufferHandoffRequested
        ?? policy.gpuBufferHandoffRequested,
      crossWorkerGpuBufferHandoffRequested
    )
    : normalizeBoolean(retainedGpuBufferHandoffRequested, false);
  const renderRowsTransferRequested =
    effectiveMode === ULG_PEERCOMPUTE_RENDER_OWNERSHIP_MODES.WORKER_OFFSCREEN_RENDER_ROWS;
  const workerOwnedResidentProducerSourceTransferRequired = Boolean(
    workerOwnedResidentProducerRequested
    && targetImplementationReady
    && normalizeBoolean(
      workerOwnedResidentProducerSourceTransferRequiredOverride
        ?? policy.workerOwnedResidentProducerSourceTransferRequired,
      true
    )
  );
  const presentationWorkerResidentStageChainReady = Boolean(
    presentationWorkerResidentStageChainRequested
    && workerPresentationRequested
    && targetImplementationReady
  );
  const inputTransport = workerOwnedResidentProducerRequested && targetImplementationReady
    ? ULG_PEERCOMPUTE_RENDER_OWNERSHIP_TRANSPORTS.WORKER_OWNED_RESIDENT_RENDER_PRODUCER
    : (crossWorkerGpuBufferHandoffRequested
      ? ULG_PEERCOMPUTE_RENDER_OWNERSHIP_TRANSPORTS.CROSS_WORKER_GPU_BUFFER_STRUCTURED_CLONE
      : (renderRowsTransferRequested
        ? ULG_PEERCOMPUTE_RENDER_OWNERSHIP_TRANSPORTS.MAIN_THREAD_COMPACT_RENDER_ROW_TRANSFER
        : null));
  let status = 'render-ownership-main-thread-renderer';
  let reason = 'main thread renderer owns presentation';
  if (crossWorkerGpuBufferHandoffRequested) {
    status = 'render-ownership-cross-worker-gpubuffer-handoff-requested';
    reason = 'PeerCompute requested direct retained GPUBuffer transport to the presentation worker';
  } else if (
    presentationWorkerRetainedOutputPresentationOnlyRequested
    && targetImplementationReady
    && presentationWorkerResidentStageChainReady
  ) {
    status = 'render-ownership-presentation-worker-retained-output-presentation-only-ready';
    reason = 'PeerCompute selected presentation-worker retained output as a presentation-only mode';
  } else if (presentationWorkerRetainedOutputPresentationOnlyRequested && transitionalRenderRowsActive) {
    status = 'render-ownership-presentation-worker-retained-output-presentation-only-pending-transitional-render-rows';
    reason = 'presentation-worker retained output mode is selected but the worker-owned producer is not ready; transitional render-row transfer remains active';
  } else if (presentationWorkerRetainedOutputPresentationOnlyRequested) {
    status = 'render-ownership-presentation-worker-retained-output-presentation-only-pending';
    reason = 'presentation-worker retained output mode is selected but presentation-worker resident stages are not ready';
  } else if (workerOwnedResidentProducerRequested && targetImplementationReady) {
    status = 'render-ownership-worker-owned-resident-producer-ready';
    reason = 'PeerCompute selected a worker-owned resident render producer';
  } else if (workerOwnedResidentProducerRequested) {
    status = transitionalRenderRowsActive
      ? 'render-ownership-worker-owned-resident-producer-pending-transitional-render-rows'
      : 'render-ownership-worker-owned-resident-producer-pending';
    reason = transitionalRenderRowsActive
      ? 'worker-owned resident render producer is selected but not implemented; transitional render-row transfer remains active'
      : 'worker-owned resident render producer is selected but not implemented';
  } else if (renderRowsTransferRequested) {
    status = 'render-ownership-worker-offscreen-render-rows';
    reason = 'worker owns presentation canvas; main thread transfers compact render rows';
  }

  return {
    schema: ULG_PEERCOMPUTE_RENDER_OWNERSHIP_POLICY_SCHEMA,
    status,
    reason,
    source: policy.source || source,
    useCase: normalizeString(policy.useCase, useCase),
    configuredByPeerCompute,
    requestedMode: requested,
    effectiveMode,
    inputTransport,
    displayTransport: workerPresentationRequested
      ? ULG_PEERCOMPUTE_RENDER_OWNERSHIP_TRANSPORTS.WORKER_OWNED_PRESENTED_CANVAS
      : ULG_PEERCOMPUTE_RENDER_OWNERSHIP_TRANSPORTS.MAIN_THREAD_DOM_CANVAS,
    displayHandoff: workerPresentationRequested ? 'transferControlToOffscreen' : 'main-thread-dom-canvas',
    rejectedTransport: ULG_PEERCOMPUTE_RENDER_OWNERSHIP_TRANSPORTS.FRAME_COPY_BACK,
    frameCopyBackRejected: true,
    copiedBytesPerFrame: 0,
    copiedBytesPerSecond: 0,
    workerOffscreenPresentationRequested: workerPresentationRequested,
    renderRowsTransferRequested,
    retainedGpuBufferHandoffRequested: retainedHandoffRequested,
    directGpuBufferHandoffRequested: retainedHandoffRequested,
    crossWorkerGpuBufferHandoffRequested,
    workerOwnedResidentProducerRequested,
    workerOwnedResidentProducerReady: targetImplementationReady,
    workerOwnedResidentProducerPending:
      workerOwnedResidentProducerRequested && !targetImplementationReady,
    workerOwnedResidentProducerSourceTransferRequired,
    presentationWorkerRetainedOutputPresentationOnlyRequested,
    presentationWorkerRetainedOutputPresentationOnlyReady: Boolean(
      presentationWorkerRetainedOutputPresentationOnlyRequested
      && targetImplementationReady
      && presentationWorkerResidentStageChainReady
    ),
    statePromotionMode: presentationWorkerRetainedOutputPresentationOnlyRequested
      ? 'presentation-only'
      : (presentationWorkerResidentStageChainRequested
        ? 'state-manager-admission-required'
        : null),
    authoritativeStateMutationExpected: presentationWorkerRetainedOutputPresentationOnlyRequested
      ? false
      : null,
    presentationWorkerResidentStagesRequested: presentationWorkerResidentStageChainRequested,
    presentationWorkerResidentStagesReady: presentationWorkerResidentStageChainReady,
    presentationWorkerResidentStagesPending:
      presentationWorkerResidentStageChainRequested && !presentationWorkerResidentStageChainReady,
    presentationWorkerResidentStageTransport: presentationWorkerResidentStageChainReady
      ? ULG_PEERCOMPUTE_RENDER_OWNERSHIP_TRANSPORTS.PRESENTATION_WORKER_RESIDENT_STAGE_CHAIN
      : null,
    transitionalRenderRowsAllowed,
    transitionalRenderRowsActive,
    requiresFreshPhysicsReadback:
      renderRowsTransferRequested || workerOwnedResidentProducerSourceTransferRequired,
    workerCapabilityStatus: workerCapability?.status || policy.workerCapabilityStatus || null,
    workerCapabilityBlocker: workerCapability?.blocker || policy.workerCapabilityBlocker || null,
    peercomputeConfigurable: true,
    updatedAtMs: nowMs(),
    scientificValidation: false,
    sphValidation: false,
    fullPhysicsValidation: false
  };
}
