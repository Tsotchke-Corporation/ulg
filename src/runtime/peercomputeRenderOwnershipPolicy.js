import {
  ULG_SCHROEDER_PORTABLE_SUMMARY_SCHEMA,
  ULG_SCHROEDER_RENDER_LOD_SUMMARY_SCHEMA
} from '../../ulg-gpu-abi/src/index.js';

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

function normalizePositiveInteger(value, fallback = null) {
  if (value == null || value === '') return fallback;
  const number = Math.round(Number(value));
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

function normalizeNonNegativeInteger(value, fallback = 0) {
  if (value == null || value === '') return fallback;
  const number = Math.round(Number(value));
  return Number.isFinite(number) && number >= 0 ? number : fallback;
}

function normalizePositiveNumber(value, fallback = null) {
  if (value == null || value === '') return fallback;
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

function normalizeResidentInterfaceRefreshMode(value, fallback = 'blocking') {
  const normalized = normalizeString(value, fallback)?.toLowerCase();
  if (normalized === 'pipeline' || normalized === 'pipelined' || normalized === 'async') return 'pipelined';
  if (normalized === 'blocking' || normalized === 'sync' || normalized === 'synchronous') return 'blocking';
  if (normalized === 'disabled' || normalized === 'off' || normalized === 'none') return 'disabled';
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

function rawGpuBufferTransferDetected(retainedRefs = []) {
  if (!Array.isArray(retainedRefs)) return false;
  return retainedRefs.some((entry) => {
    if (!entry || typeof entry !== 'object') return false;
    return Object.hasOwn(entry, 'buffer')
      || Object.hasOwn(entry, 'gpuBuffer')
      || (
        entry.transferMode
        && entry.transferMode !== 'descriptor-only-no-raw-gpubuffer-transfer'
      );
  });
}

function resolveSchroederRenderLodContract({
  policy = {},
  schroederPortableSummary = null,
  schroederRenderLodSummary = null
} = {}) {
  const portable = policy.schroederPortableSummary
    || policy.portableSummary
    || schroederPortableSummary
    || null;
  const renderLod = schroederRenderLodSummary
    || policy.schroederRenderLodSummary
    || policy.renderLod
    || portable?.renderLod
    || null;
  const retainedRefs = Array.isArray(portable?.retainedRefs) ? portable.retainedRefs : [];
  const portablePresent = Boolean(portable);
  const renderLodPresent = Boolean(renderLod);
  const portableSchemaAccepted = !portablePresent || portable.schema === ULG_SCHROEDER_PORTABLE_SUMMARY_SCHEMA;
  const renderLodSchemaAccepted = !renderLodPresent || renderLod.schema === ULG_SCHROEDER_RENDER_LOD_SUMMARY_SCHEMA;
  const transferMode = portable?.transferMode || null;
  const portableSummaryMode = portable?.portableSummaryMode || null;
  const descriptorOnlyTransfer = !portablePresent
    || transferMode === 'peercompute-portable-summary-descriptors'
    || portableSummaryMode === 'portable-descriptors-not-raw-gpubuffers';
  const rawGpuBufferTransfer = rawGpuBufferTransferDetected(retainedRefs);
  const fullParticleReadbackRequired =
    portable?.fullParticleReadbackRequired === true
    || renderLod?.fullParticleReadbackRequired === true;
  const presentationReady = Boolean(
    renderLodPresent
    && portableSchemaAccepted
    && renderLodSchemaAccepted
    && descriptorOnlyTransfer
    && !rawGpuBufferTransfer
    && !fullParticleReadbackRequired
  );
  let blocker = null;
  if (renderLodPresent && !presentationReady) {
    blocker = !portableSchemaAccepted
      ? 'schroeder-portable-summary-schema-mismatch'
      : (!renderLodSchemaAccepted
        ? 'schroeder-render-lod-summary-schema-mismatch'
        : (!descriptorOnlyTransfer
          ? 'schroeder-portable-summary-not-descriptor-only'
          : (rawGpuBufferTransfer
            ? 'schroeder-portable-summary-raw-gpubuffer-transfer-detected'
            : (fullParticleReadbackRequired
              ? 'schroeder-render-lod-summary-requires-full-particle-readback'
              : 'schroeder-render-lod-summary-not-ready'))));
  }
  const status = !renderLodPresent
    ? 'disabled-schroeder-render-lod-summary'
    : (presentationReady
      ? 'schroeder-render-lod-summary-presentation-ready'
      : 'blocked-schroeder-render-lod-summary');
  return {
    status,
    blocker,
    portablePresent,
    portableSchema: portable?.schema || null,
    portableStatus: portable?.status || null,
    portableSummaryMode,
    transferMode,
    descriptorOnlyTransfer,
    retainedRefCount: normalizeNonNegativeInteger(portable?.retainedRefCount, retainedRefs.length),
    retainedBufferRefCount: normalizeNonNegativeInteger(portable?.retainedBufferRefCount, 0),
    rawGpuBufferTransfer,
    rawGpuBufferTransferAllowed: false,
    renderLodPresent,
    renderLodSchema: renderLod?.schema || null,
    renderLodStatus: renderLod?.status || null,
    renderLodMode: renderLod?.mode || null,
    presentationReady,
    presentationSourceMode: presentationReady ? 'schroeder-portable-summary-render-lod' : null,
    activeLeafProxyCount: normalizeNonNegativeInteger(renderLod?.activeLeafProxyCount, 0),
    aggregateProxyCount: normalizeNonNegativeInteger(renderLod?.aggregateProxyCount, 0),
    lawQueueProxyCount: normalizeNonNegativeInteger(renderLod?.lawQueueProxyCount, 0),
    nativeGridSpacingM: normalizePositiveNumber(renderLod?.nativeGridSpacingM, null),
    geometryPolicy: renderLod?.geometryPolicy || null,
    opticalPolicy: renderLod?.opticalPolicy || null,
    presentationAuthority: portable?.presentationAuthority || (
      presentationReady ? 'presentation-consumes-render-lod-summary-not-physics-state' : null
    ),
    stateAuthorityStatus: portable?.stateAuthorityStatus || (
      renderLodPresent ? 'state-manager-admission-required-before-authoritative-remote-replay' : null
    ),
    fullParticleReadbackRequired,
    fullParticleReadbackAvoided: presentationReady && !fullParticleReadbackRequired
  };
}

function firstPolicyString(policy, keys = []) {
  for (const key of keys) {
    const value = normalizeString(policy?.[key], null);
    if (value) return value;
  }
  return null;
}

function normalizeResidentComputeManagerMode(value, fallback = null) {
  const normalized = normalizeString(value, null)?.toLowerCase() || null;
  if (!normalized) return fallback;
  if (
    normalized === 'direct'
    || normalized === 'inline'
    || normalized === 'local'
    || normalized === 'same-device'
    || normalized === 'same-thread'
    || normalized === 'resident-direct'
  ) {
    return 'direct';
  }
  if (
    normalized === 'worker-owned-resident-lane'
    || normalized === 'worker-resident-lane'
    || normalized === 'resident-worker-lane'
  ) {
    return 'worker-owned-resident-lane';
  }
  if (
    normalized === 'compute-manager'
    || normalized === 'computemanager'
    || normalized === 'peercompute'
    || normalized === 'peer-compute'
    || normalized === 'task'
    || normalized === 'task-submit'
    || normalized === 'task-submission'
    || normalized === 'state-manager'
  ) {
    return 'compute-manager';
  }
  return fallback;
}

export function resolvePeerComputeRenderOwnershipPolicy({
  peercomputePolicy = null,
  requestedMode = null,
  workerOffscreenPresentationRequested = false,
  workerOffscreenPresentationExplicitlyDisabled = false,
  retainedGpuBufferHandoffRequested = null,
  retainedCompactSnapshotExportRequested = null,
  residentStepsPerScheduleOverride = null,
  residentStepsPerScheduleMax = null,
  residentParticleBridgeTargetBatchTimeS = null,
  residentInterfaceRefreshMode = null,
  residentInterfaceRefreshWarmupFrames = null,
  residentComputeManagerMode = null,
  upgradeWorkerOffscreenRenderRowsWhenReady = false,
  allowTransitionalRenderRows = true,
  workerOwnedResidentProducerReady = false,
  workerOwnedResidentProducerSourceTransferRequiredOverride = null,
  presentationWorkerResidentStagesRequested = null,
  schroederPortableSummary = null,
  schroederRenderLodSummary = null,
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
  const normalizedUseCase = normalizeString(policy.useCase, useCase);
  const normalizedUseCaseKey = normalizedUseCase?.toLowerCase() || null;
  const sameDeviceInteractiveUseCase = [
    'same-device',
    'same-device-mobile',
    'same-device-interactive',
    'interactive-same-device',
    'mobile'
  ].includes(normalizedUseCaseKey);
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
  const urlWorkerOffscreenExplicitlyDisabled = normalizeBoolean(
    workerOffscreenPresentationExplicitlyDisabled,
    false
  );
  if (!requested || requested === ULG_PEERCOMPUTE_RENDER_OWNERSHIP_MODES.AUTO) {
    // An explicit offscreenPresentation=0 request wins over the interactive
    // use-case default of worker-owned presentation.
    requested = urlWorkerOffscreenExplicitlyDisabled
      ? ULG_PEERCOMPUTE_RENDER_OWNERSHIP_MODES.MAIN_THREAD_RENDERER
      : sameDeviceInteractiveUseCase
      ? ULG_PEERCOMPUTE_RENDER_OWNERSHIP_MODES.PRESENTATION_WORKER_RETAINED_OUTPUT_PRESENTATION_ONLY
      : ((urlRequestedWorkerOffscreen || policyRequestedWorkerOffscreen)
        ? ULG_PEERCOMPUTE_RENDER_OWNERSHIP_MODES.WORKER_OFFSCREEN_RENDER_ROWS
        : ULG_PEERCOMPUTE_RENDER_OWNERSHIP_MODES.MAIN_THREAD_RENDERER);
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
  const upgradeImplicitWorkerOffscreenRenderRows = Boolean(
    upgradeWorkerOffscreenRenderRowsWhenReady
    && targetImplementationReady
    && requested === ULG_PEERCOMPUTE_RENDER_OWNERSHIP_MODES.WORKER_OFFSCREEN_RENDER_ROWS
    && !configuredByPeerCompute
    && policy.source !== 'sph-phase-demo-url'
  );
  const workerOwnedResidentProducerSelected = Boolean(
    workerOwnedResidentProducerRequested || upgradeImplicitWorkerOffscreenRenderRows
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
      : (upgradeImplicitWorkerOffscreenRenderRows
        ? ULG_PEERCOMPUTE_RENDER_OWNERSHIP_MODES.WORKER_OWNED_RESIDENT_RENDER_PRODUCER
        : requested));
  const retainedHandoffRequested = retainedGpuBufferHandoffRequested == null
    ? normalizeBoolean(
      policy.retainedGpuBufferHandoffRequested
        ?? policy.directGpuBufferHandoffRequested
        ?? policy.gpuBufferHandoffRequested,
      crossWorkerGpuBufferHandoffRequested
    )
    : normalizeBoolean(retainedGpuBufferHandoffRequested, false);
  const compactSnapshotExportRequested = retainedCompactSnapshotExportRequested == null
    ? normalizeBoolean(
      policy.retainedCompactSnapshotExportRequested
        ?? policy.presentationWorkerRetainedCompactSnapshotExportRequested
        ?? policy.compactSnapshotExportRequested
        ?? policy.portableSnapshotExportRequested
        ?? policy.crossPeerSnapshotExportRequested,
      false
    )
    : normalizeBoolean(retainedCompactSnapshotExportRequested, false);
  const renderRowsTransferRequested =
    effectiveMode === ULG_PEERCOMPUTE_RENDER_OWNERSHIP_MODES.WORKER_OFFSCREEN_RENDER_ROWS;
  const workerOwnedResidentProducerSourceTransferRequested = Boolean(
    workerOwnedResidentProducerSelected
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
  const presentationWorkerRetainedOutputPresentationOnlyReady = Boolean(
    presentationWorkerRetainedOutputPresentationOnlyRequested
    && targetImplementationReady
    && presentationWorkerResidentStageChainReady
  );
  const workerOwnedResidentProducerSourceTransferRequired = Boolean(
    workerOwnedResidentProducerSourceTransferRequested
    && !presentationWorkerRetainedOutputPresentationOnlyReady
  );
  const throughputPlaybackRequested = [
    'throughput',
    'benchmark',
    'batch',
    'offline',
    'bulk'
  ].includes(normalizedUseCaseKey);
  const interactivePresentationPlayback = Boolean(
    presentationWorkerRetainedOutputPresentationOnlyRequested
    && !throughputPlaybackRequested
  );
  const interactiveWorkerPresentationPlayback = Boolean(
    workerPresentationRequested
    && !throughputPlaybackRequested
  );
  const residentPlaybackUseCase = throughputPlaybackRequested
    ? 'throughput'
    : (interactivePresentationPlayback
      ? 'interactive-presentation'
      : (interactiveWorkerPresentationPlayback ? 'interactive-worker-presentation' : (normalizedUseCaseKey || null)));
  const sameDeviceInteractivePlayback = [
    'interactive',
    'interactive-worker-presentation',
    'interactive-presentation'
  ].includes(normalizedUseCaseKey) || sameDeviceInteractiveUseCase;
  const residentStepOverride = normalizePositiveInteger(
    residentStepsPerScheduleOverride
      ?? policy.residentStepsPerScheduleOverride
      ?? policy.residentStepsPerSchedule
      ?? policy.residentVisualStepsPerSchedule
      ?? policy.presentationStepsPerSchedule,
    null
  );
  // The interactive presentation caps below are DEFAULTS for playback with no
  // stated batch size. An explicit residentStepsPerSchedule request (preset or
  // URL) is a deliberate amortization choice: the worker lane batches legally
  // (each step seals its own epoch) and publishes per-step progress render
  // candidates, so clamping an explicit request to one step per schedule only
  // reintroduces the per-step schedule-lifecycle overhead the worker-lane
  // refactor removed. An explicit residentStepsPerScheduleMax still binds.
  const residentStepMaxDefault = residentStepOverride != null
    ? null
    : (interactivePresentationPlayback
      ? 4
      : (interactiveWorkerPresentationPlayback ? 1 : null));
  const residentStepMax = normalizePositiveInteger(
    residentStepsPerScheduleMax
      ?? policy.residentStepsPerScheduleMax
      ?? policy.residentMaxStepsPerSchedule
      ?? policy.residentVisualStepsPerScheduleMax
      ?? policy.presentationStepsPerScheduleMax,
    residentStepMaxDefault
  );
  const residentTargetBatchTimeS = normalizePositiveNumber(
    residentParticleBridgeTargetBatchTimeS
      ?? policy.residentParticleBridgeTargetBatchTimeS
      ?? policy.residentVisualTargetBatchTimeS
      ?? policy.presentationTargetBatchTimeS,
    null
  );
  const policyResidentInterfaceRefreshModeExplicit = Boolean(
    policy.residentInterfaceRefreshModeExplicit
    || policy.residentPlaybackCadencePolicy?.interfaceRefreshModeExplicit
    || (
      configuredByPeerCompute
      && (
        policy.residentInterfaceRefreshMode != null
        || policy.residentPostStepInterfaceRefreshMode != null
        || policy.interfaceRefreshMode != null
      )
    )
  );
  const residentInterfaceRefreshModeExplicit = Boolean(
    residentInterfaceRefreshMode != null
    || policyResidentInterfaceRefreshModeExplicit
  );
  const defaultResidentInterfaceRefreshMode = (
    (
      workerOwnedResidentProducerSelected
      && targetImplementationReady
    )
    || interactiveWorkerPresentationPlayback
    || interactivePresentationPlayback
    || sameDeviceInteractivePlayback
  )
    ? 'pipelined'
    : 'blocking';
  const residentInterfaceRefreshModeResolved = normalizeResidentInterfaceRefreshMode(
    residentInterfaceRefreshMode
      ?? (policyResidentInterfaceRefreshModeExplicit
        ? (
          policy.residentInterfaceRefreshMode
          ?? policy.residentPostStepInterfaceRefreshMode
          ?? policy.interfaceRefreshMode
        )
      : null),
    defaultResidentInterfaceRefreshMode
  );
  const defaultResidentInterfaceRefreshWarmupFrames = (
    residentInterfaceRefreshModeResolved === 'pipelined'
    && (
      interactiveWorkerPresentationPlayback
      || interactivePresentationPlayback
      || sameDeviceInteractivePlayback
    )
  )
    ? 8
    : 0;
  const residentInterfaceRefreshWarmupFramesResolved = normalizeNonNegativeInteger(
    residentInterfaceRefreshWarmupFrames
      ?? policy.residentInterfaceRefreshWarmupFrames
      ?? policy.residentInterfaceWarmupFrames
      ?? policy.residentPlaybackCadencePolicy?.interfaceRefreshWarmupFrames
      ?? policy.residentPlaybackCadencePolicy?.residentInterfaceRefreshWarmupFrames,
    defaultResidentInterfaceRefreshWarmupFrames
  );
  const policyResidentComputeManagerModeExplicit = Boolean(
    policy.residentComputeManagerModeExplicit
    || policy.residentPlaybackCadencePolicy?.computeManagerModeExplicit
    || policy.residentPlaybackCadencePolicy?.residentComputeManagerModeExplicit
    || (
      configuredByPeerCompute
      && (
        policy.residentComputeManagerMode != null
        || policy.residentPlaybackComputeManagerMode != null
        || policy.residentPlaybackComputeMode != null
        || policy.residentTaskMode != null
        || policy.computeManagerMode != null
        || policy.residentPlaybackCadencePolicy?.computeManagerMode != null
        || policy.residentPlaybackCadencePolicy?.residentComputeManagerMode != null
      )
    )
  );
  const rawResidentComputeManagerMode =
    residentComputeManagerMode
    ?? (policyResidentComputeManagerModeExplicit
      ? (
        policy.residentComputeManagerMode
        ?? policy.residentPlaybackComputeManagerMode
        ?? policy.residentPlaybackComputeMode
        ?? policy.residentTaskMode
        ?? policy.computeManagerMode
        ?? policy.residentPlaybackCadencePolicy?.computeManagerMode
        ?? policy.residentPlaybackCadencePolicy?.residentComputeManagerMode
      )
      : null);
  const residentComputeManagerModeExplicit = Boolean(
    residentComputeManagerMode != null
    || policyResidentComputeManagerModeExplicit
  );
  const defaultResidentComputeManagerMode = interactiveWorkerPresentationPlayback
    ? 'direct'
    : 'compute-manager';
  const residentComputeManagerModeResolved = normalizeResidentComputeManagerMode(
    rawResidentComputeManagerMode,
    defaultResidentComputeManagerMode
  );
  const schroederRenderLod = resolveSchroederRenderLodContract({
    policy,
    schroederPortableSummary,
    schroederRenderLodSummary
  });
  const inputTransport = workerOwnedResidentProducerSelected && targetImplementationReady
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
  } else if (workerOwnedResidentProducerSelected && targetImplementationReady) {
    status = 'render-ownership-worker-owned-resident-producer-ready';
    reason = upgradeImplicitWorkerOffscreenRenderRows
      ? 'implicit worker offscreen presentation upgraded to the ready worker-owned resident render producer'
      : 'PeerCompute selected a worker-owned resident render producer';
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
    useCase: normalizedUseCase,
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
    retainedCompactSnapshotExportRequested: compactSnapshotExportRequested,
    presentationWorkerRetainedCompactSnapshotExportRequested: compactSnapshotExportRequested,
    portableSnapshotExportRequested: compactSnapshotExportRequested,
    schroederPortableSummaryPresent: schroederRenderLod.portablePresent,
    schroederPortableSummarySchema: schroederRenderLod.portableSchema,
    schroederPortableSummaryStatus: schroederRenderLod.portableStatus,
    schroederPortableSummaryMode: schroederRenderLod.portableSummaryMode,
    schroederPortableSummaryTransferMode: schroederRenderLod.transferMode,
    schroederPortableSummaryDescriptorOnlyTransfer: schroederRenderLod.descriptorOnlyTransfer,
    schroederPortableSummaryRetainedRefCount: schroederRenderLod.retainedRefCount,
    schroederPortableSummaryRetainedBufferRefCount: schroederRenderLod.retainedBufferRefCount,
    schroederPortableSummaryRawGpuBufferTransferDetected: schroederRenderLod.rawGpuBufferTransfer,
    schroederPortableSummaryRawGpuBufferTransferAllowed: schroederRenderLod.rawGpuBufferTransferAllowed,
    schroederRenderLodSummaryPresent: schroederRenderLod.renderLodPresent,
    schroederRenderLodSummarySchema: schroederRenderLod.renderLodSchema,
    schroederRenderLodSummaryStatus: schroederRenderLod.renderLodStatus,
    schroederRenderLodStatus: schroederRenderLod.status,
    schroederRenderLodBlocker: schroederRenderLod.blocker,
    schroederRenderLodPresentationReady: schroederRenderLod.presentationReady,
    schroederRenderLodPresentationSourceMode: schroederRenderLod.presentationSourceMode,
    schroederRenderLodMode: schroederRenderLod.renderLodMode,
    schroederRenderLodActiveLeafProxyCount: schroederRenderLod.activeLeafProxyCount,
    schroederRenderLodAggregateProxyCount: schroederRenderLod.aggregateProxyCount,
    schroederRenderLodLawQueueProxyCount: schroederRenderLod.lawQueueProxyCount,
    schroederRenderLodNativeGridSpacingM: schroederRenderLod.nativeGridSpacingM,
    schroederRenderLodGeometryPolicy: schroederRenderLod.geometryPolicy,
    schroederRenderLodOpticalPolicy: schroederRenderLod.opticalPolicy,
    schroederRenderLodPresentationAuthority: schroederRenderLod.presentationAuthority,
    schroederRenderLodStateAuthorityStatus: schroederRenderLod.stateAuthorityStatus,
    schroederRenderLodFullParticleReadbackRequired: schroederRenderLod.fullParticleReadbackRequired,
    schroederRenderLodFullParticleReadbackAvoided: schroederRenderLod.fullParticleReadbackAvoided,
    workerOwnedResidentProducerRequested: workerOwnedResidentProducerSelected,
    workerOwnedResidentProducerExplicitlyRequested: workerOwnedResidentProducerRequested,
    workerOwnedResidentProducerReady: targetImplementationReady,
    workerOffscreenRenderRowsUpgradedToWorkerOwnedResidentProducer:
      upgradeImplicitWorkerOffscreenRenderRows,
    workerOwnedResidentProducerPending:
      workerOwnedResidentProducerRequested && !targetImplementationReady,
    workerOwnedResidentProducerSourceTransferRequired,
    presentationWorkerRetainedOutputPresentationOnlyRequested,
    presentationWorkerRetainedOutputPresentationOnlyReady,
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
    residentPlaybackUseCase,
    residentStepsPerScheduleOverride: residentStepOverride,
    residentStepsPerScheduleMax: residentStepMax,
    residentParticleBridgeTargetBatchTimeS: residentTargetBatchTimeS,
    residentInterfaceRefreshMode: residentInterfaceRefreshModeResolved,
    residentInterfaceRefreshModeExplicit,
    residentInterfaceRefreshWarmupFrames: residentInterfaceRefreshWarmupFramesResolved,
    residentComputeManagerMode: residentComputeManagerModeResolved,
    residentComputeManagerModeExplicit,
    residentPlaybackCadencePolicy: {
      schema: 'peercompute.ulg.resident-playback-cadence-policy.v0',
      useCase: residentPlaybackUseCase,
      stepsPerScheduleOverride: residentStepOverride,
      stepsPerScheduleMax: residentStepMax,
      particleBridgeTargetBatchTimeS: residentTargetBatchTimeS,
      interfaceRefreshMode: residentInterfaceRefreshModeResolved,
      interfaceRefreshModeExplicit: residentInterfaceRefreshModeExplicit,
      interfaceRefreshWarmupFrames: residentInterfaceRefreshWarmupFramesResolved,
      computeManagerMode: residentComputeManagerModeResolved,
      computeManagerModeExplicit: residentComputeManagerModeExplicit,
      peercomputeConfigurable: true,
      scientificValidation: false,
      sphValidation: false,
      fullPhysicsValidation: false
    },
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
