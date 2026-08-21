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

export function resolveNativeSurfaceSubmitFailureAction({
  primaryFrameSubmitted = false
} = {}) {
  const committed = primaryFrameSubmitted === true;
  return {
    schema: 'peercompute.ulg.native-surface-submit-failure-action.v0',
    status: committed
      ? 'committed-with-post-submit-error'
      : 'pre-submit-failure-rollback-required',
    committed,
    rollbackAllowed: !committed,
    discardAllowed: !committed,
    clearDrawStateAllowed: !committed,
    renderResult: committed,
    reason: committed
      ? 'the primary queue submit succeeded, so later failures are diagnostic and cannot reverse presentation'
      : 'no primary frame was submitted, so the staged composite may be rolled back and discarded'
  };
}

function exactNativeSurfaceGeneration(value) {
  return Number.isSafeInteger(value) && value >= 0 ? value : null;
}

export function resolveNativeSurfaceSuccessorPromotion({
  candidateGeneration = null,
  latestCandidateGeneration = candidateGeneration,
  foregroundValidationStatus = 'not-run',
  foregroundValidationGeneration = null,
  foregroundValidationNonzeroPixelCount = 0,
  foregroundValidationProofKind = null,
  foregroundValidationGpuFenceSatisfied = null,
  foregroundValidationSameQueueSubmissionBoundary = null,
  foregroundValidationSubmittedDrawCount = 0
} = {}) {
  const candidate = exactNativeSurfaceGeneration(candidateGeneration);
  const latest = exactNativeSurfaceGeneration(latestCandidateGeneration);
  const validated = exactNativeSurfaceGeneration(
    foregroundValidationGeneration
  );
  const validationStatus = String(
    foregroundValidationStatus || 'not-run'
  ).trim().toLowerCase();
  const nonzeroPixelCount = Number.isSafeInteger(
    foregroundValidationNonzeroPixelCount
  ) && foregroundValidationNonzeroPixelCount > 0
    ? foregroundValidationNonzeroPixelCount
    : 0;
  const proofKind = typeof foregroundValidationProofKind === 'string'
    ? foregroundValidationProofKind.trim().toLowerCase() || null
    : null;
  const gpuFenceSatisfied =
    foregroundValidationGpuFenceSatisfied === true;
  const sameQueueSubmissionBoundary =
    foregroundValidationSameQueueSubmissionBoundary === true;
  const submittedDrawCount = Number.isSafeInteger(
    foregroundValidationSubmittedDrawCount
  ) && foregroundValidationSubmittedDrawCount > 0
    ? foregroundValidationSubmittedDrawCount
    : 0;
  const diagnosticPixelProof = Boolean(
    proofKind === 'base-composite-color-difference'
  );
  const sameQueueStagedCompositeProof = Boolean(
    proofKind === 'same-queue-private-staged-composite-submission'
  );
  const supportedProofKind = Boolean(
    diagnosticPixelProof
    || sameQueueStagedCompositeProof
  );
  const privateCompositePixelEvidenceSatisfied = Boolean(
    validationStatus === 'passed'
    && diagnosticPixelProof
    && nonzeroPixelCount > 0
  );
  const sameQueueStructuralSubmissionEvidenceSatisfied = Boolean(
    validationStatus === 'passed'
    && sameQueueStagedCompositeProof
    && sameQueueSubmissionBoundary
    && submittedDrawCount > 0
  );
  const validGenerations = Boolean(
    candidate != null
    && latest != null
    && validated != null
  );
  const candidateIsLatest = Boolean(
    validGenerations
    && candidate === latest
  );
  const validationMatchesCandidate = Boolean(
    validGenerations
    && validated === candidate
  );
  const exactCandidateLineage = Boolean(
    candidateIsLatest
    && validationMatchesCandidate
  );
  const privateCompositePixelValidated = Boolean(
    exactCandidateLineage
    && privateCompositePixelEvidenceSatisfied
  );
  const sameQueueStructuralSubmissionAdmitted = Boolean(
    exactCandidateLineage
    && sameQueueStructuralSubmissionEvidenceSatisfied
  );
  const foregroundValidated = privateCompositePixelValidated;
  const candidateAdmitted = Boolean(
    privateCompositePixelValidated
    || sameQueueStructuralSubmissionAdmitted
  );
  const promoteCandidate = candidateAdmitted;
  let status = 'native-surface-successor-retained-invalid-generation';
  let reason = 'candidate, latest, and validation generations must be exact non-negative integers';
  if (validGenerations && !candidateIsLatest) {
    status = 'native-surface-successor-retained-stale-candidate';
    reason = `candidate generation ${candidate} is not latest generation ${latest}`;
  } else if (validGenerations && !validationMatchesCandidate) {
    status = 'native-surface-successor-retained-stale-validation';
    reason = `foreground validation generation ${validated} does not match candidate generation ${candidate}`;
  } else if (validGenerations && validationStatus !== 'passed') {
    status = `native-surface-successor-retained-validation-${validationStatus || 'not-run'}`;
    reason = `foreground validation status is ${validationStatus || 'not-run'}`;
  } else if (validGenerations && !supportedProofKind) {
    status = 'native-surface-successor-retained-unsupported-proof-kind';
    reason = proofKind == null
      ? 'foreground validation did not provide an explicit supported proof kind'
      : `foreground proof kind ${proofKind} is not admitted for successor promotion`;
  } else if (
    validGenerations
    && diagnosticPixelProof
    && nonzeroPixelCount === 0
  ) {
    status = 'native-surface-successor-retained-empty-foreground';
    reason = 'diagnostic foreground pixel proof observed no nonzero pixels';
  } else if (
    validGenerations
    && sameQueueStagedCompositeProof
    && !sameQueueSubmissionBoundary
  ) {
    status = 'native-surface-successor-retained-missing-same-queue-boundary';
    reason = foregroundValidationSameQueueSubmissionBoundary == null
      ? 'same-queue staged composite proof did not provide its ordered submission boundary'
      : 'same-queue staged composite proof reports a mismatched submission boundary';
  } else if (
    validGenerations
    && sameQueueStagedCompositeProof
    && submittedDrawCount === 0
  ) {
    status = 'native-surface-successor-retained-no-submitted-draws';
    reason = 'same-queue staged composite proof did not submit any draw commands';
  } else if (promoteCandidate) {
    status = 'native-surface-successor-promoted';
    reason = null;
  }
  return {
    schema: 'peercompute.ulg.native-surface-successor-promotion.v0',
    status,
    reason,
    promoteCandidate,
    retainCurrentPresentation: !promoteCandidate,
    candidateGeneration: candidate,
    latestCandidateGeneration: latest,
    foregroundValidationStatus: validationStatus,
    foregroundValidationGeneration: validated,
    foregroundValidationNonzeroPixelCount: nonzeroPixelCount,
    foregroundValidationProofKind: proofKind,
    foregroundValidationGpuFenceSatisfied: gpuFenceSatisfied,
    foregroundValidationSameQueueSubmissionBoundary:
      sameQueueSubmissionBoundary,
    foregroundValidationSubmittedDrawCount: submittedDrawCount,
    candidateIsLatest,
    validationMatchesCandidate,
    foregroundValidated,
    privateCompositePixelValidated,
    sameQueueStructuralSubmissionAdmitted,
    candidateAdmitted
  };
}

export function nativeSurfacePreviousOwnerLineageMatches({
  previousBridge = null,
  expectedOwner = null
} = {}) {
  return (previousBridge?.activeSurfaceResourceOwner ?? null)
    === (expectedOwner ?? null);
}

export function resolveNativeSurfaceResidentStepSignature({
  finalStep = null,
  standaloneStepSignature = null
} = {}) {
  return finalStep?.signature ?? standaloneStepSignature ?? null;
}

function nativeSurfaceSchedulerReason(error, fallback) {
  if (error instanceof Error && error.message) return error.message;
  if (error != null) return String(error);
  return fallback;
}

/**
 * Keep native-surface validation bounded to one active request and one
 * replaceable latest request. A newer enqueue invalidates publication authority
 * immediately, but never destroys an active request while its GPU completion is
 * still settling. The active request therefore owns cleanup until settlement;
 * a queued request can be discarded synchronously because it has not started.
 */
export function createNativeSurfaceLatestValidationScheduler({
  validate,
  publish,
  discard,
  onStateChange = null
} = {}) {
  if (typeof validate !== 'function') {
    throw new TypeError('native surface validation scheduler requires validate');
  }
  if (typeof publish !== 'function') {
    throw new TypeError('native surface validation scheduler requires publish');
  }
  if (typeof discard !== 'function') {
    throw new TypeError('native surface validation scheduler requires discard');
  }

  let latestToken = 0;
  let active = null;
  let queuedLatest = null;
  let disposed = false;
  let lifecycleGeneration = 1;
  const counters = {
    enqueued: 0,
    started: 0,
    published: 0,
    discarded: 0,
    replaced: 0,
    invalidated: 0,
    failed: 0
  };

  const snapshot = (status = null, reason = null) => ({
    schema: 'peercompute.ulg.native-surface-latest-validation-scheduler.v0',
    status: status || (disposed
      ? 'disposed'
      : (active
        ? (queuedLatest ? 'active-with-latest-queued' : 'active')
        : 'idle')),
    reason,
    disposed,
    lifecycleGeneration,
    latestToken,
    activeToken: active?.token ?? null,
    queuedLatestToken: queuedLatest?.token ?? null,
    activeCount: active ? 1 : 0,
    queuedCount: queuedLatest ? 1 : 0,
    ...counters
  });

  const notify = (status = null, reason = null) => {
    const state = snapshot(status, reason);
    try { onStateChange?.(state); } catch { /* diagnostics are best effort */ }
    return state;
  };

  const settleRequest = (request, result) => {
    if (request.settled) return request.result;
    request.settled = true;
    request.result = result;
    request.resolve(result);
    return result;
  };

  const discardRequest = (request, reason, status = 'discarded') => {
    if (!request || request.discarded || request.published) return null;
    request.discarded = true;
    counters.discarded += 1;
    let discardError = null;
    try {
      const value = discard(request.item, {
        token: request.token,
        reason,
        status,
        lifecycleGeneration: request.lifecycleGeneration
      });
      if (value && typeof value.then === 'function') {
        Promise.resolve(value).catch(() => {});
        throw new TypeError('native surface queued discard must be synchronous');
      }
    } catch (error) {
      discardError = nativeSurfaceSchedulerReason(
        error,
        'native surface candidate discard failed'
      );
      counters.failed += 1;
    }
    return settleRequest(request, {
      schema: 'peercompute.ulg.native-surface-validation-request-result.v0',
      status,
      reason: discardError || reason,
      token: request.token,
      published: false,
      discarded: true,
      discardError
    });
  };

  const requestIsLatest = (request) => Boolean(
    request
    && !disposed
    && !request.cancelled
    && request.lifecycleGeneration === lifecycleGeneration
    && request.token === latestToken
  );

  const startRequest = (request) => {
    active = request;
    request.started = true;
    counters.started += 1;
    notify('active', 'native surface candidate validation started');
    void Promise.resolve().then(async () => {
      let proof = null;
      try {
        proof = await validate(request.item, {
          token: request.token,
          lifecycleGeneration: request.lifecycleGeneration,
          isLatest: () => requestIsLatest(request)
        });
        if (!requestIsLatest(request)) {
          discardRequest(
            request,
            request.cancelReason || 'native surface candidate was superseded before publication',
            'superseded'
          );
          return;
        }
        const publication = await publish(request.item, proof, {
          token: request.token,
          lifecycleGeneration: request.lifecycleGeneration,
          isLatest: () => requestIsLatest(request)
        });
        // Publication is the commit boundary. The publisher must recheck
        // latest-token and lifecycle authority immediately before its
        // irreversible submit; after it resolves, a newer enqueue cannot
        // retroactively turn an already-submitted frame into a discard.
        request.published = true;
        counters.published += 1;
        settleRequest(request, {
          schema: 'peercompute.ulg.native-surface-validation-request-result.v0',
          status: 'published',
          reason: null,
          token: request.token,
          published: true,
          discarded: false,
          proof,
          publication
        });
      } catch (error) {
        counters.failed += 1;
        discardRequest(
          request,
          nativeSurfaceSchedulerReason(
            error,
            'native surface candidate validation or publication failed'
          ),
          'failed'
        );
      } finally {
        if (active === request) active = null;
        if (!disposed && queuedLatest) {
          const next = queuedLatest;
          queuedLatest = null;
          startRequest(next);
        } else {
          notify();
        }
      }
    });
  };

  const invalidate = (
    reason = 'native surface validation scheduler invalidated',
    { terminal = false } = {}
  ) => {
    latestToken += 1;
    lifecycleGeneration += 1;
    counters.invalidated += 1;
    if (terminal) disposed = true;
    if (active) {
      active.cancelled = true;
      active.cancelReason = reason;
    }
    if (queuedLatest) {
      const queued = queuedLatest;
      queuedLatest = null;
      queued.cancelled = true;
      queued.cancelReason = reason;
      discardRequest(queued, reason, terminal ? 'disposed' : 'invalidated');
    }
    return notify(terminal ? 'disposed' : 'invalidated', reason);
  };

  return {
    schema: 'peercompute.ulg.native-surface-latest-validation-scheduler.v0',
    enqueue(item) {
      if (disposed) {
        throw new TypeError('native surface validation scheduler is disposed');
      }
      latestToken += 1;
      counters.enqueued += 1;
      let resolve = null;
      const completion = new Promise((settle) => { resolve = settle; });
      const request = {
        item,
        token: latestToken,
        lifecycleGeneration,
        completion,
        resolve,
        started: false,
        settled: false,
        discarded: false,
        published: false,
        cancelled: false,
        cancelReason: null,
        result: null
      };
      if (active) {
        active.cancelled = true;
        active.cancelReason =
          'native surface candidate superseded by a newer validation request';
        if (queuedLatest) {
          const replaced = queuedLatest;
          queuedLatest = null;
          replaced.cancelled = true;
          replaced.cancelReason =
            'queued native surface candidate replaced by the latest request';
          counters.replaced += 1;
          discardRequest(replaced, replaced.cancelReason, 'replaced');
        }
        queuedLatest = request;
        notify(
          'active-with-latest-queued',
          'latest native surface candidate queued behind active validation'
        );
      } else {
        startRequest(request);
      }
      return {
        schema: 'peercompute.ulg.native-surface-validation-request.v0',
        status: request.started ? 'active' : 'queued-latest',
        token: request.token,
        lifecycleGeneration: request.lifecycleGeneration,
        completion
      };
    },
    invalidate(reason) {
      return invalidate(reason, { terminal: false });
    },
    deviceLost(reason = 'native surface validation device lost') {
      return invalidate(reason, { terminal: false });
    },
    dispose(reason = 'native surface validation scheduler disposed') {
      return invalidate(reason, { terminal: true });
    },
    isLatest(token, generation = lifecycleGeneration) {
      return Boolean(
        !disposed
        && token === latestToken
        && generation === lifecycleGeneration
      );
    },
    snapshot
  };
}

export function resolveNativeSurfacePreSubmitDrawStateLiveness({
  provisionalTransactionActive = false,
  committedDrawStateAvailable = false
} = {}) {
  const retainCommittedDrawState = Boolean(
    !provisionalTransactionActive
    && committedDrawStateAvailable
  );
  return {
    schema: 'peercompute.ulg.native-surface-pre-submit-draw-state-liveness.v0',
    status: retainCommittedDrawState
      ? 'retain-committed-draw-state-for-retry'
      : (provisionalTransactionActive
        ? 'clear-provisional-draw-state-for-rollback'
        : 'clear-uncommitted-draw-state'),
    provisionalTransactionActive: Boolean(provisionalTransactionActive),
    committedDrawStateAvailable: Boolean(committedDrawStateAvailable),
    retainCommittedDrawState,
    clearDrawState: !retainCommittedDrawState,
    retryRequired: retainCommittedDrawState,
    reason: retainCommittedDrawState
      ? 'a transient pre-submit presentation error cannot revoke the last committed geometry bundle'
      : (provisionalTransactionActive
        ? 'the provisional composite must clear and return to its transaction rollback snapshot'
        : 'no committed geometry bundle is available to retain')
  };
}

export function createNativeSurfaceCommittedFinisher() {
  const errors = [];
  const record = (stage, error) => {
    errors.push({
      stage: String(stage || 'committed-post-submit-step'),
      reason: error instanceof Error ? error.message : String(error)
    });
    return null;
  };
  return {
    schema: 'peercompute.ulg.native-surface-committed-finisher.v0',
    errors,
    record,
    run(stage, callback) {
      try {
        return callback();
      } catch (error) {
        return record(stage, error);
      }
    }
  };
}

export function createNativeSurfaceProvisionalResourceReceipt(bridge) {
  if (!bridge || typeof bridge !== 'object') return null;
  const snapshot = new Map();
  for (const key of Reflect.ownKeys(bridge)) {
    snapshot.set(key, bridge[key]);
  }
  return {
    bridge,
    snapshot,
    newDepthTextures: new Set(),
    deferredDepthTextures: new Set(),
    newRefractionTargetSets: new Set(),
    deferredRefractionTargetSets: new Set(),
    // Resources which do not need a type-specific teardown live here. The
    // metadata is deliberately opaque to this module; the scene uses it to
    // preserve a useful retirement reason while this helper owns retry and
    // exact-once bookkeeping.
    newDestroyableResources: new Map(),
    deferredDestroyableResources: new Map(),
    settlementStarted: false,
    settlementAttempts: 0,
    snapshotRestored: false,
    settled: false,
    committed: false,
    settlementErrors: [],
    settlementErrorHistory: []
  };
}

function nativeSurfaceProvisionalPendingCleanupCount(receipt) {
  if (!receipt) return 0;
  if (receipt.committed) {
    return receipt.deferredDepthTextures.size
      + receipt.deferredRefractionTargetSets.size
      + receipt.deferredDestroyableResources.size;
  }
  return receipt.newDepthTextures.size
    + receipt.newRefractionTargetSets.size
    + receipt.newDestroyableResources.size;
}

export function settleNativeSurfaceProvisionalResourceReceipt(
  receipt,
  {
    committed = false,
    destroyDepthTexture = (texture) => texture?.destroy?.(),
    retireDepthTexture = destroyDepthTexture,
    destroyRefractionTargetSet = () => {},
    retireRefractionTargetSet = destroyRefractionTargetSet,
    destroyResource = (resource) => resource?.destroy?.(),
    retireResource = destroyResource
  } = {}
) {
  if (!receipt || receipt.settled) {
    return {
      settled: false,
      committed: Boolean(receipt?.committed),
      alreadySettled: Boolean(receipt?.settled),
      pendingCleanupCount:
        nativeSurfaceProvisionalPendingCleanupCount(receipt),
      errors: receipt?.settlementErrors || []
    };
  }
  const requestedCommitted = Boolean(committed);
  if (
    receipt.settlementStarted
    && receipt.committed !== requestedCommitted
  ) {
    throw new TypeError(
      'native provisional resource settlement cannot change commit outcome'
    );
  }
  receipt.settlementStarted = true;
  receipt.committed = requestedCommitted;
  receipt.settlementAttempts += 1;
  const errors = [];
  const attemptSet = (kind, resources, callback) => {
    for (const resource of [...resources]) {
      try {
        callback(resource);
        resources.delete(resource);
      } catch (error) {
        errors.push({
          kind,
          reason: error instanceof Error ? error.message : String(error)
        });
      }
    }
  };
  const attemptMap = (resources, callback) => {
    for (const [resource, metadata] of [...resources]) {
      const kind = metadata?.kind || 'provisional-destroyable-resource';
      try {
        callback(resource, metadata);
        resources.delete(resource);
      } catch (error) {
        errors.push({
          kind,
          reason: error instanceof Error ? error.message : String(error)
        });
      }
    }
  };
  if (receipt.committed) {
    // Newly-created resources are now owned by the committed bridge. Only the
    // superseded resources remain as settlement work.
    receipt.newDepthTextures.clear();
    receipt.newRefractionTargetSets.clear();
    receipt.newDestroyableResources.clear();
    attemptSet(
      'retire-depth-texture',
      receipt.deferredDepthTextures,
      retireDepthTexture
    );
    attemptSet(
      'retire-refraction-target-set',
      receipt.deferredRefractionTargetSets,
      retireRefractionTargetSet
    );
    attemptMap(receipt.deferredDestroyableResources, retireResource);
  } else {
    // Superseded resources remain owned by the restored bridge. Only private
    // candidate allocations may be destroyed.
    receipt.deferredDepthTextures.clear();
    receipt.deferredRefractionTargetSets.clear();
    receipt.deferredDestroyableResources.clear();
    attemptSet(
      'destroy-depth-texture',
      receipt.newDepthTextures,
      destroyDepthTexture
    );
    attemptSet(
      'destroy-refraction-target-set',
      receipt.newRefractionTargetSets,
      destroyRefractionTargetSet
    );
    attemptMap(receipt.newDestroyableResources, destroyResource);
    if (!receipt.snapshotRestored) {
      const bridge = receipt.bridge;
      if (bridge && receipt.snapshot instanceof Map) {
        for (const key of Reflect.ownKeys(bridge)) {
          if (!receipt.snapshot.has(key)) delete bridge[key];
        }
        for (const [key, value] of receipt.snapshot) {
          bridge[key] = value;
        }
      }
      receipt.snapshotRestored = true;
    }
  }
  const pendingCleanupCount =
    nativeSurfaceProvisionalPendingCleanupCount(receipt);
  receipt.settled = pendingCleanupCount === 0;
  receipt.settlementErrors = errors;
  if (errors.length > 0) {
    receipt.settlementErrorHistory.push({
      attempt: receipt.settlementAttempts,
      committed: receipt.committed,
      errors
    });
  }
  return {
    settled: receipt.settled,
    committed: receipt.committed,
    alreadySettled: false,
    pendingCleanupCount,
    errors
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
  acceptedCount = 0,
  requireComplete = false
} = {}) {
  const inputs = Math.max(0, Math.round(Number(inputCount) || 0));
  const accepted = Math.max(0, Math.round(Number(acceptedCount) || 0));
  if (requireComplete) return accepted === inputs;
  return inputs === 0 || accepted > 0;
}

export function resolveNativeSurfaceCompositeDescriptorAdmission({
  descriptorCount = 0,
  readyCount = 0,
  blockedCount = 0,
  surfaceRecordCount = descriptorCount
} = {}) {
  const descriptors = Math.max(0, Math.round(Number(descriptorCount) || 0));
  const ready = Math.max(0, Math.round(Number(readyCount) || 0));
  const blocked = Math.max(0, Math.round(Number(blockedCount) || 0));
  const surfaces = Math.max(0, Math.round(Number(surfaceRecordCount) || 0));
  const complete = Boolean(
    descriptors > 0
    && descriptors === surfaces
    && ready === descriptors
    && blocked === 0
  );
  return {
    status: complete
      ? 'native-surface-composite-descriptors-complete'
      : 'native-surface-composite-descriptors-incomplete',
    complete,
    descriptorCount: descriptors,
    readyCount: ready,
    blockedCount: blocked,
    surfaceRecordCount: surfaces,
    reason: complete
      ? null
      : `complete native surface publication requires ${surfaces} ready descriptors; ${ready} of ${descriptors} are ready and ${blocked} are blocked`
  };
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
