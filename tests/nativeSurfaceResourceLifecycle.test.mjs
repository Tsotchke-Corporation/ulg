import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  createNativeSurfaceCommittedFinisher,
  createNativeSurfaceLatestValidationScheduler,
  createNativeSurfaceProvisionalResourceReceipt,
  createNativeSurfaceResourceOwner,
  installNativeSurfaceResourceOwner,
  markNativeSurfaceDeviceLostForCurrentOwners,
  nativeSurfaceBridgeFailureReason,
  nativeSurfaceDrawStateUsesExecution,
  nativeSurfacePreviousOwnerLineageMatches,
  nativeSurfaceVisualIntervalExtractionEnabled,
  prepareNativeSurfaceBridgeForForcedDisposal,
  rendererCanvasResizeRequired,
  resolveNativeSurfaceBridgeDeviceAdmission,
  resolveNativeSurfaceConsumerDeviceTransition,
  resolveNativeSurfaceCompositeDescriptorAdmission,
  retireNativeRefractionTargetSet,
  resolveAdditionalNativeSurfaceGenerationAttempt,
  resolveNativeRefractionTargetSetAction,
  resolveNativeSurfaceAnimationFramePolicy,
  resolveNativeSurfaceResourceReleaseAction,
  resolveNativeSurfaceResidentStepSignature,
  resolveNativeSurfaceSuccessorPromotion,
  resolveNativeSurfaceSubmitFailureAction,
  resolveNativeSurfacePreSubmitDrawStateLiveness,
  resolveNativeSurfaceSubmitSynchronization,
  settleNativeSurfaceProvisionalResourceReceipt,
  shouldCommitAdditionalNativeSurfaceCandidate,
  shouldExtractNativeSurfaceForProbeBatch,
  takeNativeSurfaceResourceOwners
} from '../src/visualization/nativeSurfaceResourceLifecycle.js';

function deferredValue() {
  let resolve;
  let reject;
  const promise = new Promise((settle, fail) => {
    resolve = settle;
    reject = fail;
  });
  return { promise, resolve, reject };
}

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

test('native previous-owner lineage normalizes an absent cold-start owner and remains exact', () => {
  assert.equal(nativeSurfacePreviousOwnerLineageMatches(), true);
  assert.equal(nativeSurfacePreviousOwnerLineageMatches({
    previousBridge: null,
    expectedOwner: null
  }), true);

  const owner = {};
  const replacement = {};
  const previousBridge = { activeSurfaceResourceOwner: owner };
  assert.equal(nativeSurfacePreviousOwnerLineageMatches({
    previousBridge,
    expectedOwner: owner
  }), true);
  assert.equal(nativeSurfacePreviousOwnerLineageMatches({
    previousBridge,
    expectedOwner: replacement
  }), false);
  previousBridge.activeSurfaceResourceOwner = replacement;
  assert.equal(nativeSurfacePreviousOwnerLineageMatches({
    previousBridge,
    expectedOwner: owner
  }), false);
});

test('native validation resolves a batched final-step signature before standalone fallback', () => {
  const batchedSignature = {};
  const standaloneSignature = {};
  assert.equal(resolveNativeSurfaceResidentStepSignature({
    finalStep: { signature: batchedSignature },
    standaloneStepSignature: null
  }), batchedSignature);
  assert.equal(resolveNativeSurfaceResidentStepSignature({
    finalStep: {},
    standaloneStepSignature: standaloneSignature
  }), standaloneSignature);
  assert.equal(resolveNativeSurfaceResidentStepSignature(), null);
});

test('native surface submit failure policy makes the first submit irrevocable', () => {
  assert.deepEqual(
    resolveNativeSurfaceSubmitFailureAction({ primaryFrameSubmitted: false }),
    {
      schema: 'peercompute.ulg.native-surface-submit-failure-action.v0',
      status: 'pre-submit-failure-rollback-required',
      committed: false,
      rollbackAllowed: true,
      discardAllowed: true,
      clearDrawStateAllowed: true,
      renderResult: false,
      reason:
        'no primary frame was submitted, so the staged composite may be rolled back and discarded'
    }
  );
  assert.deepEqual(
    resolveNativeSurfaceSubmitFailureAction({ primaryFrameSubmitted: true }),
    {
      schema: 'peercompute.ulg.native-surface-submit-failure-action.v0',
      status: 'committed-with-post-submit-error',
      committed: true,
      rollbackAllowed: false,
      discardAllowed: false,
      clearDrawStateAllowed: false,
      renderResult: true,
      reason:
        'the primary queue submit succeeded, so later failures are diagnostic and cannot reverse presentation'
    }
  );
});

test('native successor promotion preserves diagnostic pixel-proof coverage', () => {
  const exactPixelProof = {
    candidateGeneration: 8,
    latestCandidateGeneration: 8,
    foregroundValidationStatus: 'passed',
    foregroundValidationGeneration: 8,
    foregroundValidationNonzeroPixelCount: 37,
    foregroundValidationProofKind: 'base-composite-color-difference'
  };
  const promoted = resolveNativeSurfaceSuccessorPromotion(exactPixelProof);
  assert.equal(promoted.status, 'native-surface-successor-promoted');
  assert.equal(promoted.promoteCandidate, true);
  assert.equal(promoted.retainCurrentPresentation, false);
  assert.equal(promoted.candidateIsLatest, true);
  assert.equal(promoted.validationMatchesCandidate, true);
  assert.equal(promoted.foregroundValidated, true);
  assert.equal(promoted.privateCompositePixelValidated, true);
  assert.equal(promoted.sameQueueStructuralSubmissionAdmitted, false);
  assert.equal(promoted.candidateAdmitted, true);

  for (const foregroundValidationStatus of [
    'not-run',
    'pending',
    'failed',
    'error'
  ]) {
    const retained = resolveNativeSurfaceSuccessorPromotion({
      ...exactPixelProof,
      foregroundValidationStatus
    });
    assert.equal(retained.promoteCandidate, false, foregroundValidationStatus);
    assert.equal(retained.retainCurrentPresentation, true, foregroundValidationStatus);
  }

  assert.equal(resolveNativeSurfaceSuccessorPromotion({
    ...exactPixelProof,
    foregroundValidationNonzeroPixelCount: 0
  }).status, 'native-surface-successor-retained-empty-foreground');
  const staleValidation = resolveNativeSurfaceSuccessorPromotion({
    ...exactPixelProof,
    foregroundValidationGeneration: 7
  });
  assert.equal(
    staleValidation.status,
    'native-surface-successor-retained-stale-validation'
  );
  assert.equal(staleValidation.foregroundValidated, false);
  assert.equal(staleValidation.privateCompositePixelValidated, false);
  assert.equal(staleValidation.candidateAdmitted, false);
  const staleCandidate = resolveNativeSurfaceSuccessorPromotion({
    ...exactPixelProof,
    candidateGeneration: 7,
    foregroundValidationGeneration: 7
  });
  assert.equal(
    staleCandidate.status,
    'native-surface-successor-retained-stale-candidate'
  );
  assert.equal(staleCandidate.foregroundValidated, false);
  assert.equal(staleCandidate.privateCompositePixelValidated, false);
  assert.equal(staleCandidate.candidateAdmitted, false);
});

test('native successor promotion requires an exact same-queue staged composite proof', () => {
  const exactStructuralProof = {
    candidateGeneration: 8,
    latestCandidateGeneration: 8,
    foregroundValidationStatus: 'passed',
    foregroundValidationGeneration: 8,
    foregroundValidationNonzeroPixelCount: 0,
    foregroundValidationProofKind:
      'same-queue-private-staged-composite-submission',
    foregroundValidationGpuFenceSatisfied: false,
    foregroundValidationSameQueueSubmissionBoundary: true,
    foregroundValidationSubmittedDrawCount: 3
  };
  const promoted = resolveNativeSurfaceSuccessorPromotion(exactStructuralProof);
  assert.equal(promoted.status, 'native-surface-successor-promoted');
  assert.equal(promoted.promoteCandidate, true);
  assert.equal(promoted.retainCurrentPresentation, false);
  assert.equal(
    promoted.foregroundValidationProofKind,
    'same-queue-private-staged-composite-submission'
  );
  assert.equal(promoted.foregroundValidationGpuFenceSatisfied, false);
  assert.equal(
    promoted.foregroundValidationSameQueueSubmissionBoundary,
    true
  );
  assert.equal(promoted.foregroundValidationSubmittedDrawCount, 3);
  assert.equal(promoted.candidateIsLatest, true);
  assert.equal(promoted.validationMatchesCandidate, true);
  assert.equal(promoted.foregroundValidated, false);
  assert.equal(promoted.privateCompositePixelValidated, false);
  assert.equal(promoted.sameQueueStructuralSubmissionAdmitted, true);
  assert.equal(promoted.candidateAdmitted, true);

  const missingBoundary = resolveNativeSurfaceSuccessorPromotion({
    candidateGeneration: 8,
    latestCandidateGeneration: 8,
    foregroundValidationStatus: 'passed',
    foregroundValidationGeneration: 8,
    foregroundValidationNonzeroPixelCount: 0,
    foregroundValidationProofKind:
      'same-queue-private-staged-composite-submission',
    foregroundValidationSubmittedDrawCount: 3
  });
  assert.equal(
    missingBoundary.status,
    'native-surface-successor-retained-missing-same-queue-boundary'
  );
  assert.equal(missingBoundary.promoteCandidate, false);
  assert.equal(missingBoundary.retainCurrentPresentation, true);

  const falseBoundary = resolveNativeSurfaceSuccessorPromotion({
    ...exactStructuralProof,
    foregroundValidationSameQueueSubmissionBoundary: false
  });
  assert.equal(
    falseBoundary.status,
    'native-surface-successor-retained-missing-same-queue-boundary'
  );
  assert.equal(falseBoundary.promoteCandidate, false);
  assert.equal(falseBoundary.retainCurrentPresentation, true);

  const legacyFenceDoesNotSubstitute =
    resolveNativeSurfaceSuccessorPromotion({
      ...exactStructuralProof,
      foregroundValidationSameQueueSubmissionBoundary: false,
      foregroundValidationGpuFenceSatisfied: true
    });
  assert.equal(
    legacyFenceDoesNotSubstitute.status,
    'native-surface-successor-retained-missing-same-queue-boundary'
  );
  assert.equal(legacyFenceDoesNotSubstitute.promoteCandidate, false);

  const noSubmittedDraws = resolveNativeSurfaceSuccessorPromotion({
    ...exactStructuralProof,
    foregroundValidationSubmittedDrawCount: 0
  });
  assert.equal(
    noSubmittedDraws.status,
    'native-surface-successor-retained-no-submitted-draws'
  );
  assert.equal(noSubmittedDraws.promoteCandidate, false);
  assert.equal(noSubmittedDraws.retainCurrentPresentation, true);

  const wrongProofKind = resolveNativeSurfaceSuccessorPromotion({
    ...exactStructuralProof,
    foregroundValidationProofKind: 'untrusted-staged-composite'
  });
  assert.equal(wrongProofKind.promoteCandidate, false);
  assert.equal(wrongProofKind.retainCurrentPresentation, true);
  assert.notEqual(
    wrongProofKind.status,
    'native-surface-successor-promoted'
  );

  const staleValidation = resolveNativeSurfaceSuccessorPromotion({
    ...exactStructuralProof,
    foregroundValidationGeneration: 7
  });
  assert.equal(
    staleValidation.status,
    'native-surface-successor-retained-stale-validation'
  );
  assert.equal(staleValidation.sameQueueStructuralSubmissionAdmitted, false);
  assert.equal(staleValidation.candidateAdmitted, false);
  const staleCandidate = resolveNativeSurfaceSuccessorPromotion({
    ...exactStructuralProof,
    candidateGeneration: 7,
    foregroundValidationGeneration: 7
  });
  assert.equal(
    staleCandidate.status,
    'native-surface-successor-retained-stale-candidate'
  );
  assert.equal(staleCandidate.sameQueueStructuralSubmissionAdmitted, false);
  assert.equal(staleCandidate.candidateAdmitted, false);
});

test('native successor promotion fails closed on inexact generations', () => {
  for (const invalidGeneration of [
    null,
    '8',
    8.5,
    -1,
    Number.NaN,
    Number.POSITIVE_INFINITY
  ]) {
    const retained = resolveNativeSurfaceSuccessorPromotion({
      candidateGeneration: invalidGeneration,
      latestCandidateGeneration: 8,
      foregroundValidationStatus: 'passed',
      foregroundValidationGeneration: 8,
      foregroundValidationNonzeroPixelCount: 1,
      foregroundValidationProofKind: 'base-composite-color-difference'
    });
    assert.equal(retained.promoteCandidate, false, String(invalidGeneration));
    assert.equal(
      retained.status,
      'native-surface-successor-retained-invalid-generation',
      String(invalidGeneration)
    );
    assert.equal(retained.foregroundValidated, false, String(invalidGeneration));
    assert.equal(
      retained.privateCompositePixelValidated,
      false,
      String(invalidGeneration)
    );
    assert.equal(
      retained.sameQueueStructuralSubmissionAdmitted,
      false,
      String(invalidGeneration)
    );
    assert.equal(retained.candidateAdmitted, false, String(invalidGeneration));
  }
});

test('native validation scheduler keeps one active and one replaceable latest request', async () => {
  const deferredById = new Map();
  const validationOrder = [];
  const publicationOrder = [];
  const discardCounts = new Map();
  let validationConcurrency = 0;
  let maxValidationConcurrency = 0;
  const scheduler = createNativeSurfaceLatestValidationScheduler({
    async validate(item) {
      validationOrder.push(item.id);
      validationConcurrency += 1;
      maxValidationConcurrency = Math.max(
        maxValidationConcurrency,
        validationConcurrency
      );
      try {
        return await deferredById.get(item.id).promise;
      } finally {
        validationConcurrency -= 1;
      }
    },
    publish(item, proof) {
      publicationOrder.push(item.id);
      return { item: item.id, proof };
    },
    discard(item) {
      discardCounts.set(item.id, (discardCounts.get(item.id) || 0) + 1);
    }
  });

  for (const id of ['A', 'B', 'C']) deferredById.set(id, deferredValue());
  const a = scheduler.enqueue({ id: 'A' });
  const b = scheduler.enqueue({ id: 'B' });
  const c = scheduler.enqueue({ id: 'C' });

  assert.equal(scheduler.snapshot().activeCount, 1);
  assert.equal(scheduler.snapshot().queuedCount, 1);
  assert.equal((await b.completion).status, 'replaced');
  assert.equal(discardCounts.get('B'), 1);

  deferredById.get('A').resolve({ status: 'passed', generation: 1 });
  const aResult = await a.completion;
  assert.equal(aResult.status, 'superseded');
  assert.equal(aResult.published, false);
  assert.equal(discardCounts.get('A'), 1);

  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.deepEqual(validationOrder, ['A', 'C']);
  deferredById.get('C').resolve({ status: 'passed', generation: 3 });
  const cResult = await c.completion;
  assert.equal(cResult.status, 'published');
  assert.equal(cResult.published, true);
  assert.deepEqual(publicationOrder, ['C']);
  assert.equal(maxValidationConcurrency, 1);
  assert.equal(scheduler.snapshot().queuedCount, 0);
});

test('native validation scheduler never revokes an already-committed publication', async () => {
  const firstPublicationStarted = deferredValue();
  const finishFirstPublication = deferredValue();
  const committed = [];
  const discarded = [];
  const scheduler = createNativeSurfaceLatestValidationScheduler({
    validate: async (item) => ({ status: 'passed', id: item.id }),
    async publish(item) {
      // A production publisher checks latest authority immediately before
      // crossing queue.submit. Once this callback records the commit, a newer
      // request may queue but cannot retroactively discard the submitted frame.
      committed.push(item.id);
      if (item.id === 'A') {
        firstPublicationStarted.resolve();
        await finishFirstPublication.promise;
      }
      return { id: item.id };
    },
    discard(item, context) {
      discarded.push([item.id, context.status]);
    }
  });

  const a = scheduler.enqueue({ id: 'A' });
  await firstPublicationStarted.promise;
  const b = scheduler.enqueue({ id: 'B' });
  finishFirstPublication.resolve();

  assert.equal((await a.completion).status, 'published');
  assert.equal((await b.completion).status, 'published');
  assert.deepEqual(committed, ['A', 'B']);
  assert.deepEqual(discarded, []);
});

test('native validation scheduler invalidation and disposal terminalize without late publication', async () => {
  const activeDeferred = deferredValue();
  const published = [];
  const discarded = [];
  const scheduler = createNativeSurfaceLatestValidationScheduler({
    validate: (item) => item.id === 'active'
      ? activeDeferred.promise
      : Promise.resolve({ status: 'passed' }),
    publish(item) {
      published.push(item.id);
      return item.id;
    },
    discard(item, context) {
      discarded.push([item.id, context.status]);
    }
  });

  const active = scheduler.enqueue({ id: 'active' });
  const queued = scheduler.enqueue({ id: 'queued' });
  scheduler.deviceLost('injected device loss');
  assert.equal((await queued.completion).status, 'invalidated');
  activeDeferred.resolve({ status: 'passed' });
  assert.equal((await active.completion).status, 'superseded');
  assert.deepEqual(published, []);
  assert.deepEqual(discarded, [
    ['queued', 'invalidated'],
    ['active', 'superseded']
  ]);

  const disposedState = scheduler.dispose('scene disposed');
  assert.equal(disposedState.disposed, true);
  assert.throws(
    () => scheduler.enqueue({ id: 'late' }),
    /scheduler is disposed/
  );
});

test('native pre-submit errors retain a committed draw state but clear provisional state', () => {
  assert.deepEqual(
    resolveNativeSurfacePreSubmitDrawStateLiveness({
      provisionalTransactionActive: false,
      committedDrawStateAvailable: true
    }),
    {
      schema: 'peercompute.ulg.native-surface-pre-submit-draw-state-liveness.v0',
      status: 'retain-committed-draw-state-for-retry',
      provisionalTransactionActive: false,
      committedDrawStateAvailable: true,
      retainCommittedDrawState: true,
      clearDrawState: false,
      retryRequired: true,
      reason:
        'a transient pre-submit presentation error cannot revoke the last committed geometry bundle'
    }
  );
  const provisional = resolveNativeSurfacePreSubmitDrawStateLiveness({
    provisionalTransactionActive: true,
    committedDrawStateAvailable: true
  });
  assert.equal(provisional.status, 'clear-provisional-draw-state-for-rollback');
  assert.equal(provisional.retainCommittedDrawState, false);
  assert.equal(provisional.clearDrawState, true);
  assert.equal(provisional.retryRequired, false);
});

test('native committed finisher isolates every post-submit stage failure', () => {
  const stages = [
    'finalize',
    'owner-install',
    'additional-publication',
    'visible-consumer-publication',
    'previous-retirement'
  ];
  for (const failingStage of stages) {
    const finisher = createNativeSurfaceCommittedFinisher();
    const completed = [];
    for (const stage of stages) {
      finisher.run(stage, () => {
        if (stage === failingStage) throw new Error(`${stage} failed`);
        completed.push(stage);
        return stage;
      });
    }
    assert.deepEqual(
      completed,
      stages.filter((stage) => stage !== failingStage),
      `${failingStage}: later committed stages must still run`
    );
    assert.deepEqual(finisher.errors, [{
      stage: failingStage,
      reason: `${failingStage} failed`
    }]);
  }
});

test('native provisional resource rollback restores prior depth and refraction exactly', () => {
  const oldDepth = { name: 'old-depth', destroyCount: 0 };
  const oldRefraction = { name: 'old-refraction', destroyCount: 0 };
  const bridge = {
    depthTexture: oldDepth,
    depthTextureWidth: 640,
    refractionTargetSet: oldRefraction,
    refractionCopyTexture: oldRefraction,
    lastRenderStatus: 'prior-frame-rendered'
  };
  const receipt = createNativeSurfaceProvisionalResourceReceipt(bridge);
  const newDepth = { name: 'new-depth', destroyCount: 0 };
  const newRefraction = { name: 'new-refraction', destroyCount: 0 };
  receipt.newDepthTextures.add(newDepth);
  receipt.deferredDepthTextures.add(oldDepth);
  receipt.newRefractionTargetSets.add(newRefraction);
  receipt.deferredRefractionTargetSets.add(oldRefraction);
  bridge.depthTexture = newDepth;
  bridge.depthTextureWidth = 1280;
  bridge.refractionTargetSet = newRefraction;
  bridge.refractionCopyTexture = newRefraction;
  bridge.provisionalOnly = true;

  const retired = [];
  const result = settleNativeSurfaceProvisionalResourceReceipt(receipt, {
    committed: false,
    destroyDepthTexture(texture) {
      texture.destroyCount += 1;
    },
    retireDepthTexture(texture) {
      retired.push(texture);
    },
    destroyRefractionTargetSet(targetSet) {
      targetSet.destroyCount += 1;
    },
    retireRefractionTargetSet(targetSet) {
      retired.push(targetSet);
    }
  });

  assert.equal(result.settled, true);
  assert.equal(result.committed, false);
  assert.equal(newDepth.destroyCount, 1);
  assert.equal(newRefraction.destroyCount, 1);
  assert.equal(oldDepth.destroyCount, 0);
  assert.equal(oldRefraction.destroyCount, 0);
  assert.deepEqual(retired, []);
  assert.equal(bridge.depthTexture, oldDepth);
  assert.equal(bridge.depthTextureWidth, 640);
  assert.equal(bridge.refractionTargetSet, oldRefraction);
  assert.equal(bridge.refractionCopyTexture, oldRefraction);
  assert.equal(bridge.lastRenderStatus, 'prior-frame-rendered');
  assert.equal('provisionalOnly' in bridge, false);
  assert.equal(
    settleNativeSurfaceProvisionalResourceReceipt(receipt).settled,
    false,
    'settlement must be idempotent'
  );
});

test('native provisional resource commit retires only superseded resources', () => {
  const bridge = { depthTexture: null, refractionTargetSet: null };
  const receipt = createNativeSurfaceProvisionalResourceReceipt(bridge);
  const oldDepth = { name: 'old-depth' };
  const newDepth = { name: 'new-depth' };
  const oldRefraction = { name: 'old-refraction' };
  const newRefraction = { name: 'new-refraction' };
  receipt.deferredDepthTextures.add(oldDepth);
  receipt.newDepthTextures.add(newDepth);
  receipt.deferredRefractionTargetSets.add(oldRefraction);
  receipt.newRefractionTargetSets.add(newRefraction);
  const retired = [];
  const destroyed = [];

  const result = settleNativeSurfaceProvisionalResourceReceipt(receipt, {
    committed: true,
    destroyDepthTexture(resource) {
      destroyed.push(resource);
    },
    retireDepthTexture(resource) {
      retired.push(resource);
    },
    destroyRefractionTargetSet(resource) {
      destroyed.push(resource);
    },
    retireRefractionTargetSet(resource) {
      retired.push(resource);
    }
  });

  assert.equal(result.settled, true);
  assert.equal(result.committed, true);
  assert.deepEqual(retired, [oldDepth, oldRefraction]);
  assert.deepEqual(destroyed, []);
});

test('native provisional reuse commit retires inherited depth, refraction, and box uniform only after admission', () => {
  const bridge = { generation: 'candidate' };
  const receipt = createNativeSurfaceProvisionalResourceReceipt(bridge);
  const oldDepth = { name: 'old-depth' };
  const oldRefraction = { name: 'old-refraction' };
  const oldBoxUniform = { name: 'old-box-uniform' };
  const candidateDepth = { name: 'candidate-depth' };
  const candidateRefraction = { name: 'candidate-refraction' };
  const candidateBoxUniform = { name: 'candidate-box-uniform' };
  receipt.deferredDepthTextures.add(oldDepth);
  receipt.deferredRefractionTargetSets.add(oldRefraction);
  receipt.deferredDestroyableResources.set(oldBoxUniform, {
    kind: 'superseded-box-wireframe-uniform-buffer'
  });
  receipt.newDepthTextures.add(candidateDepth);
  receipt.newRefractionTargetSets.add(candidateRefraction);
  receipt.newDestroyableResources.set(candidateBoxUniform, {
    kind: 'candidate-box-wireframe-uniform-buffer'
  });
  const retired = [];
  const destroyed = [];

  const result = settleNativeSurfaceProvisionalResourceReceipt(receipt, {
    committed: true,
    destroyDepthTexture(resource) {
      destroyed.push(resource);
    },
    retireDepthTexture(resource) {
      retired.push(resource);
    },
    destroyRefractionTargetSet(resource) {
      destroyed.push(resource);
    },
    retireRefractionTargetSet(resource) {
      retired.push(resource);
    },
    destroyResource(resource) {
      destroyed.push(resource);
    },
    retireResource(resource) {
      retired.push(resource);
    }
  });

  assert.equal(result.settled, true);
  assert.deepEqual(retired, [oldDepth, oldRefraction, oldBoxUniform]);
  assert.deepEqual(destroyed, []);
});

test('native provisional reuse rollback preserves inherited depth, refraction, and box uniform', () => {
  const oldDepth = { name: 'old-depth', destroys: 0 };
  const oldRefraction = { name: 'old-refraction', destroys: 0 };
  const oldBoxUniform = { name: 'old-box-uniform', destroys: 0 };
  const candidateDepth = { name: 'candidate-depth', destroys: 0 };
  const candidateRefraction = { name: 'candidate-refraction', destroys: 0 };
  const candidateBoxUniform = { name: 'candidate-box-uniform', destroys: 0 };
  const bridge = {
    depthTexture: oldDepth,
    refractionTargetSet: oldRefraction,
    boxWireframe: { uniformBuffer: oldBoxUniform }
  };
  const receipt = createNativeSurfaceProvisionalResourceReceipt(bridge);
  receipt.deferredDepthTextures.add(oldDepth);
  receipt.deferredRefractionTargetSets.add(oldRefraction);
  receipt.deferredDestroyableResources.set(oldBoxUniform, {
    kind: 'superseded-box-wireframe-uniform-buffer'
  });
  receipt.newDepthTextures.add(candidateDepth);
  receipt.newRefractionTargetSets.add(candidateRefraction);
  receipt.newDestroyableResources.set(candidateBoxUniform, {
    kind: 'candidate-box-wireframe-uniform-buffer'
  });
  bridge.depthTexture = candidateDepth;
  bridge.refractionTargetSet = candidateRefraction;
  bridge.boxWireframe = { uniformBuffer: candidateBoxUniform };

  const result = settleNativeSurfaceProvisionalResourceReceipt(receipt, {
    committed: false,
    destroyDepthTexture(resource) {
      resource.destroys += 1;
    },
    destroyRefractionTargetSet(resource) {
      resource.destroys += 1;
    },
    destroyResource(resource) {
      resource.destroys += 1;
    }
  });

  assert.equal(result.settled, true);
  assert.equal(candidateDepth.destroys, 1);
  assert.equal(candidateRefraction.destroys, 1);
  assert.equal(candidateBoxUniform.destroys, 1);
  assert.equal(oldDepth.destroys, 0);
  assert.equal(oldRefraction.destroys, 0);
  assert.equal(oldBoxUniform.destroys, 0);
  assert.equal(bridge.depthTexture, oldDepth);
  assert.equal(bridge.refractionTargetSet, oldRefraction);
  assert.equal(bridge.boxWireframe.uniformBuffer, oldBoxUniform);
});

test('native provisional rollback destroys private generic resources and keeps superseded resources alive', () => {
  const priorBuffer = { label: 'prior-optical-buffer', destroyCount: 0 };
  const candidateBuffer = { label: 'candidate-optical-buffer', destroyCount: 0 };
  const bridge = { opticalBuffer: priorBuffer };
  const receipt = createNativeSurfaceProvisionalResourceReceipt(bridge);
  receipt.newDestroyableResources.set(candidateBuffer, {
    kind: 'candidate-optical-buffer'
  });
  receipt.deferredDestroyableResources.set(priorBuffer, {
    kind: 'superseded-optical-buffer'
  });
  bridge.opticalBuffer = candidateBuffer;

  const result = settleNativeSurfaceProvisionalResourceReceipt(receipt, {
    committed: false,
    destroyResource(resource) {
      resource.destroyCount += 1;
    },
    retireResource(resource) {
      resource.destroyCount += 1;
    }
  });

  assert.equal(result.settled, true);
  assert.equal(result.pendingCleanupCount, 0);
  assert.equal(candidateBuffer.destroyCount, 1);
  assert.equal(priorBuffer.destroyCount, 0);
  assert.equal(bridge.opticalBuffer, priorBuffer);
});

test('native provisional cleanup failures remain retryable without replaying successful cleanup', () => {
  const bridge = { status: 'prior' };
  const receipt = createNativeSurfaceProvisionalResourceReceipt(bridge);
  const first = { label: 'first', attempts: 0 };
  const flaky = { label: 'flaky', attempts: 0 };
  receipt.newDestroyableResources.set(first, { kind: 'first-buffer' });
  receipt.newDestroyableResources.set(flaky, { kind: 'flaky-buffer' });
  bridge.status = 'candidate';

  const destroyResource = (resource) => {
    resource.attempts += 1;
    if (resource === flaky && resource.attempts === 1) {
      throw new Error('transient destroy failure');
    }
  };
  const failed = settleNativeSurfaceProvisionalResourceReceipt(receipt, {
    committed: false,
    destroyResource
  });
  assert.equal(failed.settled, false);
  assert.equal(failed.pendingCleanupCount, 1);
  assert.equal(failed.errors.length, 1);
  assert.equal(first.attempts, 1);
  assert.equal(flaky.attempts, 1);
  assert.equal(bridge.status, 'prior', 'snapshot restoration is not delayed by cleanup failure');

  const retried = settleNativeSurfaceProvisionalResourceReceipt(receipt, {
    committed: false,
    destroyResource
  });
  assert.equal(retried.settled, true);
  assert.equal(retried.pendingCleanupCount, 0);
  assert.equal(first.attempts, 1, 'successful cleanup is not replayed');
  assert.equal(flaky.attempts, 2, 'only failed cleanup is retried');
  assert.equal(receipt.settlementErrorHistory.length, 1);
});

test('native committed retirement failures remain retryable while new ownership stays committed', () => {
  const bridge = { generation: 'candidate' };
  const receipt = createNativeSurfaceProvisionalResourceReceipt(bridge);
  const candidate = { label: 'candidate', retired: 0 };
  const superseded = { label: 'superseded', attempts: 0 };
  receipt.newDestroyableResources.set(candidate, {
    kind: 'candidate-optical-buffer'
  });
  receipt.deferredDestroyableResources.set(superseded, {
    kind: 'superseded-optical-buffer'
  });
  const retireResource = (resource) => {
    resource.attempts += 1;
    if (resource.attempts === 1) throw new Error('queue retirement failed');
  };

  const failed = settleNativeSurfaceProvisionalResourceReceipt(receipt, {
    committed: true,
    retireResource
  });
  assert.equal(failed.settled, false);
  assert.equal(failed.pendingCleanupCount, 1);
  assert.equal(candidate.retired, 0);
  assert.equal(bridge.generation, 'candidate');

  const retried = settleNativeSurfaceProvisionalResourceReceipt(receipt, {
    committed: true,
    retireResource
  });
  assert.equal(retried.settled, true);
  assert.equal(superseded.attempts, 2);
  assert.equal(candidate.retired, 0);
  assert.equal(bridge.generation, 'candidate');
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
  assert.equal(shouldCommitAdditionalNativeSurfaceCandidate({
    inputCount: 2,
    acceptedCount: 1,
    requireComplete: true
  }), false);
  assert.equal(shouldCommitAdditionalNativeSurfaceCandidate({
    inputCount: 2,
    acceptedCount: 2,
    requireComplete: true
  }), true);
  assert.equal(resolveNativeSurfaceCompositeDescriptorAdmission({
    descriptorCount: 2,
    readyCount: 1,
    blockedCount: 1,
    surfaceRecordCount: 2
  }).complete, false);
  assert.equal(resolveNativeSurfaceCompositeDescriptorAdmission({
    descriptorCount: 1,
    readyCount: 1,
    blockedCount: 0,
    surfaceRecordCount: 2
  }).complete, false);
  assert.deepEqual(resolveNativeSurfaceCompositeDescriptorAdmission({
    descriptorCount: 2,
    readyCount: 2,
    blockedCount: 0,
    surfaceRecordCount: 2
  }), {
    status: 'native-surface-composite-descriptors-complete',
    complete: true,
    descriptorCount: 2,
    readyCount: 2,
    blockedCount: 0,
    surfaceRecordCount: 2,
    reason: null
  });
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
