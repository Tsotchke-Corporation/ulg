import assert from 'node:assert/strict';
import test from 'node:test';

import {
  ULG_PEERCOMPUTE_RENDER_OWNERSHIP_MODES,
  ULG_PEERCOMPUTE_RENDER_OWNERSHIP_POLICY_SCHEMA,
  ULG_PEERCOMPUTE_RENDER_OWNERSHIP_TRANSPORTS,
  resolvePeerComputeRenderOwnershipPolicy
} from '../src/runtime/peercomputeRenderOwnershipPolicy.js';
import {
  summarizePeerComputeResidentAuthorityHost
} from '../src/runtime/peercomputeBrowserResidentHost.js';

test('render ownership policy defaults to main-thread presentation', () => {
  const policy = resolvePeerComputeRenderOwnershipPolicy();

  assert.equal(policy.schema, ULG_PEERCOMPUTE_RENDER_OWNERSHIP_POLICY_SCHEMA);
  assert.equal(policy.status, 'render-ownership-main-thread-renderer');
  assert.equal(policy.requestedMode, ULG_PEERCOMPUTE_RENDER_OWNERSHIP_MODES.MAIN_THREAD_RENDERER);
  assert.equal(policy.workerOffscreenPresentationRequested, false);
  assert.equal(policy.retainedGpuBufferHandoffRequested, false);
  assert.equal(policy.displayTransport, ULG_PEERCOMPUTE_RENDER_OWNERSHIP_TRANSPORTS.MAIN_THREAD_DOM_CANVAS);
  assert.equal(policy.frameCopyBackRejected, true);
});

test('render ownership policy maps local worker canvas requests to transitional render rows', () => {
  const policy = resolvePeerComputeRenderOwnershipPolicy({
    workerOffscreenPresentationRequested: true,
    source: 'test-url'
  });

  assert.equal(policy.requestedMode, ULG_PEERCOMPUTE_RENDER_OWNERSHIP_MODES.WORKER_OFFSCREEN_RENDER_ROWS);
  assert.equal(policy.effectiveMode, ULG_PEERCOMPUTE_RENDER_OWNERSHIP_MODES.WORKER_OFFSCREEN_RENDER_ROWS);
  assert.equal(policy.inputTransport, ULG_PEERCOMPUTE_RENDER_OWNERSHIP_TRANSPORTS.MAIN_THREAD_COMPACT_RENDER_ROW_TRANSFER);
  assert.equal(policy.workerOffscreenPresentationRequested, true);
  assert.equal(policy.renderRowsTransferRequested, true);
  assert.equal(policy.retainedGpuBufferHandoffRequested, false);
  assert.equal(policy.configuredByPeerCompute, false);
});

test('render ownership policy lets PeerCompute select worker-owned resident producer per use case', () => {
  const policy = resolvePeerComputeRenderOwnershipPolicy({
    peercomputePolicy: {
      requestedMode: 'worker-owned-resident-render-producer',
      useCase: 'same-device-mobile',
      allowTransitionalRenderRows: true
    },
    workerCapability: {
      status: 'worker-capability-ready'
    }
  });

  assert.equal(policy.configuredByPeerCompute, true);
  assert.equal(
    policy.requestedMode,
    ULG_PEERCOMPUTE_RENDER_OWNERSHIP_MODES.WORKER_OWNED_RESIDENT_RENDER_PRODUCER
  );
  assert.equal(policy.effectiveMode, ULG_PEERCOMPUTE_RENDER_OWNERSHIP_MODES.WORKER_OFFSCREEN_RENDER_ROWS);
  assert.equal(policy.workerOwnedResidentProducerRequested, true);
  assert.equal(policy.workerOwnedResidentProducerPending, true);
  assert.equal(policy.transitionalRenderRowsActive, true);
  assert.equal(policy.retainedGpuBufferHandoffRequested, false);
  assert.equal(policy.workerCapabilityStatus, 'worker-capability-ready');
});

test('render ownership policy separates direct GPUBuffer handoff from worker-owned producer', () => {
  const policy = resolvePeerComputeRenderOwnershipPolicy({
    peercomputePolicy: {
      requestedMode: 'cross-worker-gpubuffer-structured-clone'
    }
  });

  assert.equal(policy.requestedMode, ULG_PEERCOMPUTE_RENDER_OWNERSHIP_MODES.CROSS_WORKER_GPU_BUFFER_HANDOFF);
  assert.equal(policy.inputTransport, ULG_PEERCOMPUTE_RENDER_OWNERSHIP_TRANSPORTS.CROSS_WORKER_GPU_BUFFER_STRUCTURED_CLONE);
  assert.equal(policy.workerOffscreenPresentationRequested, true);
  assert.equal(policy.retainedGpuBufferHandoffRequested, true);
  assert.equal(policy.workerOwnedResidentProducerRequested, false);
});

test('render ownership policy selects worker-owned producer when the local capability is ready', () => {
  const policy = resolvePeerComputeRenderOwnershipPolicy({
    peercomputePolicy: {
      requestedMode: 'worker-owned-resident-render-producer'
    },
    workerOwnedResidentProducerReady: true
  });

  assert.equal(
    policy.effectiveMode,
    ULG_PEERCOMPUTE_RENDER_OWNERSHIP_MODES.WORKER_OWNED_RESIDENT_RENDER_PRODUCER
  );
  assert.equal(policy.workerOwnedResidentProducerReady, true);
  assert.equal(policy.workerOwnedResidentProducerPending, false);
  assert.equal(policy.transitionalRenderRowsActive, false);
  assert.equal(policy.workerOwnedResidentProducerSourceTransferRequired, true);
  assert.equal(policy.requiresFreshPhysicsReadback, true);
  assert.equal(policy.retainedGpuBufferHandoffRequested, false);
});

test('render ownership policy can request presentation-worker resident stages per use case', () => {
  const policy = resolvePeerComputeRenderOwnershipPolicy({
    peercomputePolicy: {
      requestedMode: 'worker-owned-resident-render-producer',
      useCase: 'same-device-mobile',
      presentationWorkerResidentStagesRequested: true
    },
    workerOwnedResidentProducerReady: true
  });

  assert.equal(policy.workerOffscreenPresentationRequested, true);
  assert.equal(policy.presentationWorkerResidentStagesRequested, true);
  assert.equal(policy.presentationWorkerResidentStagesReady, true);
  assert.equal(policy.presentationWorkerResidentStagesPending, false);
  assert.equal(
    policy.presentationWorkerResidentStageTransport,
    ULG_PEERCOMPUTE_RENDER_OWNERSHIP_TRANSPORTS.PRESENTATION_WORKER_RESIDENT_STAGE_CHAIN
  );
});

test('render ownership policy exposes presentation-worker retained output as presentation-only', () => {
  const policy = resolvePeerComputeRenderOwnershipPolicy({
    requestedMode: 'presentation-worker-retained-output-presentation-only',
    presentationWorkerResidentStagesRequested: false,
    workerOwnedResidentProducerReady: true
  });

  assert.equal(
    policy.requestedMode,
    ULG_PEERCOMPUTE_RENDER_OWNERSHIP_MODES.PRESENTATION_WORKER_RETAINED_OUTPUT_PRESENTATION_ONLY
  );
  assert.equal(
    policy.effectiveMode,
    ULG_PEERCOMPUTE_RENDER_OWNERSHIP_MODES.WORKER_OWNED_RESIDENT_RENDER_PRODUCER
  );
  assert.equal(
    policy.status,
    'render-ownership-presentation-worker-retained-output-presentation-only-ready'
  );
  assert.equal(policy.workerOffscreenPresentationRequested, true);
  assert.equal(policy.workerOwnedResidentProducerRequested, true);
  assert.equal(policy.presentationWorkerResidentStagesRequested, true);
  assert.equal(policy.presentationWorkerResidentStagesReady, true);
  assert.equal(policy.presentationWorkerRetainedOutputPresentationOnlyRequested, true);
  assert.equal(policy.presentationWorkerRetainedOutputPresentationOnlyReady, true);
  assert.equal(policy.statePromotionMode, 'presentation-only');
  assert.equal(policy.authoritativeStateMutationExpected, false);
});

test('resident authority host summary exposes render ownership policy fields', () => {
  const renderOwnershipPolicy = resolvePeerComputeRenderOwnershipPolicy({
    peercomputePolicy: {
      requestedMode: 'presentation-worker-retained-output-presentation-only'
    },
    workerOwnedResidentProducerReady: true
  });
  const summary = summarizePeerComputeResidentAuthorityHost({
    status: 'ready',
    hostId: 'ulg:test:render-ownership',
    renderOwnershipPolicy,
    workerCapability: {
      schema: 'peercompute.ulg.browser-worker-capability.v0',
      status: 'worker-capability-ready'
    },
    solverRegistration: { descriptors: [] },
    lawGraphManifest: null,
    computeManager: {},
    stateManager: {}
  });

  assert.equal(summary.renderOwnershipPolicySchema, ULG_PEERCOMPUTE_RENDER_OWNERSHIP_POLICY_SCHEMA);
  assert.equal(
    summary.renderOwnershipPolicyRequestedMode,
    ULG_PEERCOMPUTE_RENDER_OWNERSHIP_MODES.PRESENTATION_WORKER_RETAINED_OUTPUT_PRESENTATION_ONLY
  );
  assert.equal(
    summary.renderOwnershipPolicyEffectiveMode,
    ULG_PEERCOMPUTE_RENDER_OWNERSHIP_MODES.WORKER_OWNED_RESIDENT_RENDER_PRODUCER
  );
  assert.equal(summary.renderOwnershipWorkerOffscreenPresentationRequested, true);
  assert.equal(summary.renderOwnershipWorkerOwnedResidentProducerPending, false);
  assert.equal(summary.renderOwnershipTransitionalRenderRowsActive, false);
  assert.equal(summary.renderOwnershipPresentationWorkerResidentStagesRequested, true);
  assert.equal(summary.renderOwnershipPresentationWorkerResidentStagesReady, true);
  assert.equal(summary.renderOwnershipPresentationWorkerRetainedOutputPresentationOnlyRequested, true);
  assert.equal(summary.renderOwnershipPresentationWorkerRetainedOutputPresentationOnlyReady, true);
  assert.equal(summary.renderOwnershipStatePromotionMode, 'presentation-only');
  assert.equal(summary.renderOwnershipAuthoritativeStateMutationExpected, false);
});
