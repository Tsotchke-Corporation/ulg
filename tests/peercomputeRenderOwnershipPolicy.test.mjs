import assert from 'node:assert/strict';
import test from 'node:test';

import {
  ULG_PEERCOMPUTE_RENDER_OWNERSHIP_MODES,
  ULG_PEERCOMPUTE_RENDER_OWNERSHIP_POLICY_SCHEMA,
  ULG_PEERCOMPUTE_RENDER_OWNERSHIP_TRANSPORTS,
  constrainPeerComputeRenderOwnershipToMainThreadPresenter,
  resolvePeerComputeRenderOwnershipPolicy
} from '../src/runtime/peercomputeRenderOwnershipPolicy.js';
import {
  ULG_SCHROEDER_PORTABLE_SUMMARY_ADMISSION_SCHEMA,
  ULG_SCHROEDER_PORTABLE_SUMMARY_ADMISSION_SCOPE,
  admitSchroederPortableSummary,
  createSchroederPortableSummaryReplayDescriptor,
  ULG_SCHROEDER_PORTABLE_SUMMARY_REPLAY_DESCRIPTOR_SCHEMA,
  ULG_SCHROEDER_PORTABLE_SUMMARY_REPLAY_SEED_SCHEMA,
  summarizePeerComputeResidentAuthorityHost
} from '../src/runtime/peercomputeBrowserResidentHost.js';
import {
  ULG_SCHROEDER_PORTABLE_SUMMARY_SCHEMA,
  ULG_SCHROEDER_RENDER_LOD_SUMMARY_SCHEMA
} from '../ulg-gpu-abi/src/index.js';

function schroederPortableSummaryFixture(overrides = {}) {
  return {
    schema: ULG_SCHROEDER_PORTABLE_SUMMARY_SCHEMA,
    status: 'schroeder-portable-summary-plan-ready',
    peerComputeUseCase: 'test-schroeder-render-lod',
    portableSummaryMode: 'portable-descriptors-not-raw-gpubuffers',
    transferMode: 'peercompute-portable-summary-descriptors',
    retainedRefCount: 2,
    retainedBufferRefCount: 2,
    activeNodeCount: 12,
    aggregateNodeCount: 3,
    lawQueueCount: 5,
    fullParticleReadbackRequired: false,
    portableMaterializationStatus: 'compact-summary-descriptor-ready-no-gpubuffer-transfer',
    presentationAuthority: 'presentation-consumes-render-lod-summary-not-physics-state',
    stateAuthorityStatus: 'state-manager-admission-required-before-authoritative-remote-replay',
    outputFamilies: [
      'schroeder-portable-summary',
      'schroeder-render-lod-summary',
      'schroeder-retained-buffer-descriptors'
    ],
    retainedRefs: [
      {
        family: 'schroeder-level-assignment',
        transferMode: 'descriptor-only-no-raw-gpubuffer-transfer',
        retained: true
      },
      {
        family: 'schroeder-active-node-list',
        transferMode: 'descriptor-only-no-raw-gpubuffer-transfer',
        retained: true
      }
    ],
    renderLod: {
      schema: ULG_SCHROEDER_RENDER_LOD_SUMMARY_SCHEMA,
      status: 'schroeder-render-lod-summary-planned',
      mode: 'active-node-leaf-and-aggregate-proxy-lod',
      selectedLevel: 1,
      nativeGridSpacingM: 0.5,
      activeLeafProxyCount: 12,
      aggregateProxyCount: 3,
      lawQueueProxyCount: 5,
      phaseVolumeDiagnosticRowsAvailable: false,
      opticalPolicy: 'consume-closure-derived-optics-and-pbr-through-render-pipeline',
      geometryPolicy: 'aggregate-nodes-for-coherent-bulk-active-nodes-for-leaves',
      fullParticleReadbackRequired: false
    },
    ...overrides
  };
}

function createMemoryStateManager() {
  const hotBuffers = new Map();
  const warmDeltas = {};
  return {
    setHotBuffer(key, value) {
      hotBuffers.set(key, value);
    },
    getHotBuffer(key) {
      return hotBuffers.get(key);
    },
    commitDelta(delta) {
      warmDeltas[delta.scope] ||= {};
      warmDeltas[delta.scope][delta.taskId] = delta;
    },
    getWarmDeltas(scope) {
      return warmDeltas[scope] || {};
    }
  };
}

test('render ownership policy defaults to main-thread presentation', () => {
  const policy = resolvePeerComputeRenderOwnershipPolicy();

  assert.equal(policy.schema, ULG_PEERCOMPUTE_RENDER_OWNERSHIP_POLICY_SCHEMA);
  assert.equal(policy.status, 'render-ownership-main-thread-renderer');
  assert.equal(policy.requestedMode, ULG_PEERCOMPUTE_RENDER_OWNERSHIP_MODES.MAIN_THREAD_RENDERER);
  assert.equal(policy.workerOffscreenPresentationRequested, false);
  assert.equal(policy.retainedGpuBufferHandoffRequested, false);
  assert.equal(policy.retainedCompactSnapshotExportRequested, false);
  assert.equal(policy.displayTransport, ULG_PEERCOMPUTE_RENDER_OWNERSHIP_TRANSPORTS.MAIN_THREAD_DOM_CANVAS);
  assert.equal(policy.frameCopyBackRejected, true);
  assert.equal(policy.residentInterfaceRefreshMode, 'blocking');
  assert.equal(policy.residentInterfaceRefreshModeExplicit, false);
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
  assert.equal(policy.residentPlaybackUseCase, 'interactive-worker-presentation');
  assert.equal(policy.residentStepsPerScheduleMax, 1);
  assert.equal(policy.residentInterfaceRefreshMode, 'pipelined');
  assert.equal(policy.residentInterfaceRefreshModeExplicit, false);
  assert.equal(policy.residentInterfaceRefreshWarmupFrames, 8);
  assert.equal(policy.residentPlaybackCadencePolicy.interfaceRefreshWarmupFrames, 8);
  assert.equal(policy.residentComputeManagerMode, 'direct');
  assert.equal(policy.residentComputeManagerModeExplicit, false);
});

test('render ownership policy lets same-device use case prefer retained presentation', () => {
  const pendingPolicy = resolvePeerComputeRenderOwnershipPolicy({
    useCase: 'same-device-mobile'
  });
  const readyPolicy = resolvePeerComputeRenderOwnershipPolicy({
    useCase: 'same-device-mobile',
    workerOwnedResidentProducerReady: true
  });

  assert.equal(
    pendingPolicy.requestedMode,
    ULG_PEERCOMPUTE_RENDER_OWNERSHIP_MODES.PRESENTATION_WORKER_RETAINED_OUTPUT_PRESENTATION_ONLY
  );
  assert.equal(pendingPolicy.effectiveMode, ULG_PEERCOMPUTE_RENDER_OWNERSHIP_MODES.WORKER_OFFSCREEN_RENDER_ROWS);
  assert.equal(pendingPolicy.workerOffscreenPresentationRequested, true);
  assert.equal(pendingPolicy.workerOwnedResidentProducerPending, true);
  assert.equal(pendingPolicy.transitionalRenderRowsActive, true);
  assert.equal(pendingPolicy.presentationWorkerResidentStagesRequested, true);
  assert.equal(pendingPolicy.presentationWorkerRetainedOutputPresentationOnlyRequested, true);
  assert.equal(pendingPolicy.presentationWorkerRetainedOutputPresentationOnlyReady, false);
  assert.equal(pendingPolicy.residentPlaybackUseCase, 'interactive-presentation');
  assert.equal(pendingPolicy.residentStepsPerScheduleMax, 4);
  assert.equal(pendingPolicy.residentInterfaceRefreshMode, 'pipelined');
  assert.equal(pendingPolicy.residentComputeManagerMode, 'direct');
  assert.equal(readyPolicy.effectiveMode, ULG_PEERCOMPUTE_RENDER_OWNERSHIP_MODES.WORKER_OWNED_RESIDENT_RENDER_PRODUCER);
  assert.equal(readyPolicy.workerOwnedResidentProducerPending, false);
  assert.equal(readyPolicy.presentationWorkerRetainedOutputPresentationOnlyReady, true);
  assert.equal(readyPolicy.workerOwnedResidentProducerSourceTransferRequired, false);
  assert.equal(readyPolicy.requiresFreshPhysicsReadback, false);
  assert.equal(
    readyPolicy.status,
    'render-ownership-presentation-worker-retained-output-presentation-only-ready'
  );
  assert.equal(readyPolicy.residentInterfaceRefreshMode, 'pipelined');
});

test('main-thread presenter constraint removes competing worker presentation without changing physics authority', () => {
  const workerPolicy = resolvePeerComputeRenderOwnershipPolicy({
    useCase: 'same-device-interactive',
    workerOwnedResidentProducerReady: true
  });
  const constrained = constrainPeerComputeRenderOwnershipToMainThreadPresenter(workerPolicy, {
    reason: 'native surface owns the main canvas',
    source: 'test-native-surface'
  });

  assert.equal(
    workerPolicy.effectiveMode,
    ULG_PEERCOMPUTE_RENDER_OWNERSHIP_MODES.WORKER_OWNED_RESIDENT_RENDER_PRODUCER
  );
  assert.equal(
    constrained.effectiveMode,
    ULG_PEERCOMPUTE_RENDER_OWNERSHIP_MODES.MAIN_THREAD_RENDERER
  );
  assert.equal(constrained.workerOffscreenPresentationRequested, false);
  assert.equal(constrained.presentationWorkerResidentStagesRequested, false);
  assert.equal(constrained.presentationWorkerRetainedOutputPresentationOnlyRequested, false);
  assert.equal(
    constrained.displayTransport,
    ULG_PEERCOMPUTE_RENDER_OWNERSHIP_TRANSPORTS.MAIN_THREAD_DOM_CANVAS
  );
  assert.equal(constrained.residentComputeManagerMode, 'compute-manager');
  assert.equal(constrained.presenterConstraint, 'main-thread-dom-canvas-required');
  assert.equal(constrained.workerPresentationSuppressed, true);
  assert.equal(constrained.reason, 'native surface owns the main canvas');
});

test('render ownership policy upgrades implicit local worker presentation when the producer is ready', () => {
  const policy = resolvePeerComputeRenderOwnershipPolicy({
    peercomputePolicy: {
      schema: ULG_PEERCOMPUTE_RENDER_OWNERSHIP_POLICY_SCHEMA,
      source: 'sph-phase-demo',
      requestedMode: 'worker-offscreen-render-rows',
      workerOffscreenPresentationRequested: true
    },
    workerOwnedResidentProducerReady: true,
    upgradeWorkerOffscreenRenderRowsWhenReady: true
  });

  assert.equal(policy.requestedMode, ULG_PEERCOMPUTE_RENDER_OWNERSHIP_MODES.WORKER_OFFSCREEN_RENDER_ROWS);
  assert.equal(
    policy.effectiveMode,
    ULG_PEERCOMPUTE_RENDER_OWNERSHIP_MODES.WORKER_OWNED_RESIDENT_RENDER_PRODUCER
  );
  assert.equal(policy.workerOwnedResidentProducerRequested, true);
  assert.equal(policy.workerOwnedResidentProducerExplicitlyRequested, false);
  assert.equal(policy.workerOffscreenRenderRowsUpgradedToWorkerOwnedResidentProducer, true);
  assert.equal(policy.renderRowsTransferRequested, false);
  assert.equal(
    policy.inputTransport,
    ULG_PEERCOMPUTE_RENDER_OWNERSHIP_TRANSPORTS.WORKER_OWNED_RESIDENT_RENDER_PRODUCER
  );
  assert.equal(policy.status, 'render-ownership-worker-owned-resident-producer-ready');
  assert.equal(policy.residentInterfaceRefreshMode, 'pipelined');
  assert.equal(policy.residentPlaybackCadencePolicy.interfaceRefreshMode, 'pipelined');
  assert.equal(policy.residentInterfaceRefreshModeExplicit, false);
});

test('render ownership policy does not preserve local default interface mode as an explicit override', () => {
  const initialPolicy = resolvePeerComputeRenderOwnershipPolicy({
    workerOffscreenPresentationRequested: true,
    source: 'sph-phase-demo'
  });
  const sceneReadyPolicy = resolvePeerComputeRenderOwnershipPolicy({
    peercomputePolicy: initialPolicy,
    workerOffscreenPresentationRequested: true,
    workerOwnedResidentProducerReady: true,
    upgradeWorkerOffscreenRenderRowsWhenReady: true,
    source: 'sph-phase-scene'
  });

  assert.equal(initialPolicy.residentInterfaceRefreshMode, 'pipelined');
  assert.equal(initialPolicy.residentInterfaceRefreshModeExplicit, false);
  assert.equal(initialPolicy.residentComputeManagerMode, 'direct');
  assert.equal(initialPolicy.residentComputeManagerModeExplicit, false);
  assert.equal(
    sceneReadyPolicy.effectiveMode,
    ULG_PEERCOMPUTE_RENDER_OWNERSHIP_MODES.WORKER_OWNED_RESIDENT_RENDER_PRODUCER
  );
  assert.equal(sceneReadyPolicy.residentInterfaceRefreshMode, 'pipelined');
  assert.equal(sceneReadyPolicy.residentInterfaceRefreshModeExplicit, false);
  assert.equal(sceneReadyPolicy.residentComputeManagerMode, 'direct');
  assert.equal(sceneReadyPolicy.residentComputeManagerModeExplicit, false);
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
  assert.equal(policy.residentInterfaceRefreshMode, 'pipelined');
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
  assert.equal(policy.workerOwnedResidentProducerSourceTransferRequired, false);
  assert.equal(policy.requiresFreshPhysicsReadback, false);
  assert.equal(policy.statePromotionMode, 'presentation-only');
  assert.equal(policy.authoritativeStateMutationExpected, false);
  assert.equal(policy.residentPlaybackUseCase, 'interactive-presentation');
  assert.equal(policy.residentStepsPerScheduleMax, 4);
  assert.equal(policy.residentInterfaceRefreshMode, 'pipelined');
  assert.equal(policy.residentComputeManagerMode, 'direct');
  assert.equal(policy.residentPlaybackCadencePolicy.stepsPerScheduleMax, 4);
  assert.equal(policy.residentPlaybackCadencePolicy.computeManagerMode, 'direct');
  assert.equal(policy.residentPlaybackCadencePolicy.peercomputeConfigurable, true);
});

test('render ownership policy keeps retained presentation batch cadence configurable by use case', () => {
  const throughputPolicy = resolvePeerComputeRenderOwnershipPolicy({
    requestedMode: 'presentation-worker-retained-output-presentation-only',
    useCase: 'throughput',
    workerOwnedResidentProducerReady: true
  });
  const overridePolicy = resolvePeerComputeRenderOwnershipPolicy({
    peercomputePolicy: {
      requestedMode: 'presentation-worker-retained-output-presentation-only',
      residentStepsPerSchedule: 9,
      residentParticleBridgeTargetBatchTimeS: 0.2,
      residentInterfaceRefreshMode: 'blocking',
      residentComputeManagerMode: 'direct'
    },
    residentStepsPerScheduleMax: 6,
    workerOwnedResidentProducerReady: true
  });

  assert.equal(throughputPolicy.residentPlaybackUseCase, 'throughput');
  assert.equal(throughputPolicy.residentStepsPerScheduleMax, null);
  assert.equal(throughputPolicy.residentComputeManagerMode, 'compute-manager');
  assert.equal(overridePolicy.residentPlaybackUseCase, 'interactive-presentation');
  assert.equal(overridePolicy.residentStepsPerScheduleOverride, 9);
  assert.equal(overridePolicy.residentStepsPerScheduleMax, 6);
  assert.equal(overridePolicy.residentParticleBridgeTargetBatchTimeS, 0.2);
  assert.equal(overridePolicy.residentInterfaceRefreshMode, 'blocking');
  assert.equal(overridePolicy.residentInterfaceRefreshModeExplicit, true);
  assert.equal(overridePolicy.residentInterfaceRefreshWarmupFrames, 0);
  assert.equal(overridePolicy.residentComputeManagerMode, 'direct');
  assert.equal(overridePolicy.residentComputeManagerModeExplicit, true);
});

test('render ownership policy lets PeerCompute configure pipelined interface warmup frames', () => {
  const defaultPolicy = resolvePeerComputeRenderOwnershipPolicy({
    workerOffscreenPresentationRequested: true
  });
  const disabledWarmup = resolvePeerComputeRenderOwnershipPolicy({
    workerOffscreenPresentationRequested: true,
    residentInterfaceRefreshWarmupFrames: 0
  });
  const explicitPeerPolicy = resolvePeerComputeRenderOwnershipPolicy({
    peercomputePolicy: {
      requestedMode: 'worker-owned-resident-render-producer',
      residentInterfaceRefreshMode: 'pipelined',
      residentInterfaceRefreshWarmupFrames: 12
    },
    workerOwnedResidentProducerReady: true
  });

  assert.equal(defaultPolicy.residentInterfaceRefreshWarmupFrames, 8);
  assert.equal(disabledWarmup.residentInterfaceRefreshWarmupFrames, 0);
  assert.equal(explicitPeerPolicy.residentInterfaceRefreshWarmupFrames, 12);
  assert.equal(explicitPeerPolicy.residentPlaybackCadencePolicy.interfaceRefreshWarmupFrames, 12);
});

test('render ownership policy makes retained compact snapshot export opt-in', () => {
  const defaultPolicy = resolvePeerComputeRenderOwnershipPolicy({
    requestedMode: 'presentation-worker-retained-output-presentation-only',
    workerOwnedResidentProducerReady: true
  });
  const requestedPolicy = resolvePeerComputeRenderOwnershipPolicy({
    peercomputePolicy: {
      requestedMode: 'presentation-worker-retained-output-presentation-only',
      retainedCompactSnapshotExportRequested: true
    },
    workerOwnedResidentProducerReady: true
  });

  assert.equal(defaultPolicy.presentationWorkerRetainedOutputPresentationOnlyRequested, true);
  assert.equal(defaultPolicy.retainedCompactSnapshotExportRequested, false);
  assert.equal(defaultPolicy.portableSnapshotExportRequested, false);
  assert.equal(requestedPolicy.retainedCompactSnapshotExportRequested, true);
  assert.equal(requestedPolicy.presentationWorkerRetainedCompactSnapshotExportRequested, true);
  assert.equal(requestedPolicy.portableSnapshotExportRequested, true);
});

test('render ownership policy consumes Schroeder render LOD summaries as descriptor-only presentation input', () => {
  const portableSummary = schroederPortableSummaryFixture();
  const policy = resolvePeerComputeRenderOwnershipPolicy({
    requestedMode: 'presentation-worker-retained-output-presentation-only',
    workerOwnedResidentProducerReady: true,
    schroederPortableSummary: portableSummary
  });

  assert.equal(policy.schroederPortableSummaryPresent, true);
  assert.equal(policy.schroederPortableSummarySchema, ULG_SCHROEDER_PORTABLE_SUMMARY_SCHEMA);
  assert.equal(policy.schroederPortableSummaryStatus, 'schroeder-portable-summary-plan-ready');
  assert.equal(policy.schroederPortableSummaryTransferMode, 'peercompute-portable-summary-descriptors');
  assert.equal(policy.schroederPortableSummaryDescriptorOnlyTransfer, true);
  assert.equal(policy.schroederPortableSummaryRawGpuBufferTransferDetected, false);
  assert.equal(policy.schroederPortableSummaryRawGpuBufferTransferAllowed, false);
  assert.equal(policy.schroederRenderLodStatus, 'schroeder-render-lod-summary-presentation-ready');
  assert.equal(policy.schroederRenderLodPresentationReady, true);
  assert.equal(policy.schroederRenderLodPresentationSourceMode, 'schroeder-portable-summary-render-lod');
  assert.equal(policy.schroederRenderLodActiveLeafProxyCount, 12);
  assert.equal(policy.schroederRenderLodAggregateProxyCount, 3);
  assert.equal(policy.schroederRenderLodLawQueueProxyCount, 5);
  assert.equal(policy.schroederRenderLodFullParticleReadbackRequired, false);
  assert.equal(policy.schroederRenderLodFullParticleReadbackAvoided, true);
  assert.equal(policy.requiresFreshPhysicsReadback, false);

  const blocked = resolvePeerComputeRenderOwnershipPolicy({
    schroederPortableSummary: schroederPortableSummaryFixture({
      retainedRefs: [
        {
          family: 'schroeder-active-node-list',
          transferMode: 'descriptor-only-no-raw-gpubuffer-transfer',
          retained: true,
          buffer: { label: 'raw-gpubuffer-must-not-transfer' }
        }
      ]
    })
  });
  assert.equal(blocked.schroederRenderLodPresentationReady, false);
  assert.equal(
    blocked.schroederRenderLodBlocker,
    'schroeder-portable-summary-raw-gpubuffer-transfer-detected'
  );
});

test('Schroeder portable summary admission commits descriptor-only render LOD state', () => {
  const stateManager = createMemoryStateManager();
  const portableSummary = schroederPortableSummaryFixture();
  const admission = admitSchroederPortableSummary({
    stateManager,
    portableSummary,
    cacheKey: 'ulg:test:schroeder-portable-summary',
    stateKey: 'ulg:test:schroeder-state',
    sourceTaskId: 'ulg:test:same-level-mechanics',
    taskId: 'ulg:test:schroeder-portable-admission'
  });

  assert.equal(admission.schema, ULG_SCHROEDER_PORTABLE_SUMMARY_ADMISSION_SCHEMA);
  assert.equal(admission.status, 'schroeder-portable-summary-admission-published');
  assert.equal(admission.accepted, true);
  assert.equal(admission.committed, true);
  assert.equal(admission.hotBufferStored, true);
  assert.equal(admission.portableState, true);
  assert.equal(admission.authoritativeStateMutation, false);
  assert.equal(admission.rawGpuBufferTransferAllowed, false);
  assert.equal(admission.rawGpuBufferTransferDetected, false);
  assert.equal(admission.crossPeerReplayReady, true);
  assert.equal(admission.crossPeerReplayStatus, 'schroeder-portable-summary-descriptor-admitted-for-replay');
  assert.equal(admission.renderLod.schema, ULG_SCHROEDER_RENDER_LOD_SUMMARY_SCHEMA);
  assert.equal(admission.activeLeafProxyCount, 12);
  assert.equal(admission.aggregateProxyCount, 3);
  assert.equal(admission.lawQueueProxyCount, 5);
  assert.equal(admission.commitDeltaScope, ULG_SCHROEDER_PORTABLE_SUMMARY_ADMISSION_SCOPE);
  assert.equal(
    admission.schroederPortableSummaryReplayDescriptor.schema,
    ULG_SCHROEDER_PORTABLE_SUMMARY_REPLAY_DESCRIPTOR_SCHEMA
  );
  assert.equal(
    admission.schroederPortableSummaryReplayDescriptor.status,
    'schroeder-portable-summary-replay-descriptor-ready'
  );
  assert.equal(admission.schroederPortableSummaryReplayDescriptor.ready, true);
  assert.equal(admission.schroederPortableSummaryReplayDescriptor.replayMode, 'descriptor-seed-no-raw-gpubuffer-transfer');
  assert.equal(admission.schroederPortableSummaryReplayDescriptor.crossPeerReplayReady, true);
  assert.equal(admission.schroederPortableSummaryReplayDescriptor.rawGpuBufferTransferAllowed, false);
  assert.equal(admission.schroederPortableSummaryReplayDescriptor.rawGpuBufferTransferDetected, false);
  assert.equal(admission.schroederPortableSummaryReplayDescriptor.fullParticleReadbackRequired, false);
  assert.equal(admission.schroederPortableSummaryReplayDescriptor.authoritativeStateMutation, false);
  assert.equal(
    admission.schroederPortableSummaryReplayDescriptor.replaySeed.schema,
    ULG_SCHROEDER_PORTABLE_SUMMARY_REPLAY_SEED_SCHEMA
  );
  assert.equal(
    admission.schroederPortableSummaryReplayDescriptor.replaySeed.status,
    'schroeder-portable-summary-replay-seed-ready'
  );
  assert.notEqual(
    admission.schroederPortableSummaryReplayDescriptor.replaySeed.portableSummary,
    portableSummary
  );
  assert.equal(
    admission.schroederPortableSummaryReplayDescriptor.replaySeed.retainedRefs.some((ref) => (
      Object.hasOwn(ref, 'buffer') || Object.hasOwn(ref, 'gpuBuffer')
    )),
    false
  );

  const hotRecord = stateManager.getHotBuffer(admission.hotBufferKey);
  assert.equal(hotRecord.status, 'schroeder-portable-summary-hot-buffer-source-stored');
  assert.equal(hotRecord.copyMode, 'descriptor-only-no-raw-gpubuffer-transfer');
  assert.equal(hotRecord.renderLod.schema, ULG_SCHROEDER_RENDER_LOD_SUMMARY_SCHEMA);
  assert.equal(
    hotRecord.schroederPortableSummaryReplayDescriptor.schema,
    ULG_SCHROEDER_PORTABLE_SUMMARY_REPLAY_DESCRIPTOR_SCHEMA
  );
  const warmDelta = stateManager.getWarmDeltas(ULG_SCHROEDER_PORTABLE_SUMMARY_ADMISSION_SCOPE)[
    admission.commitDeltaTaskId
  ];
  assert.equal(warmDelta.payload.status, 'schroeder-portable-summary-admitted');
  assert.equal(warmDelta.payload.hotBufferKey, admission.hotBufferKey);
  assert.equal(warmDelta.payload.renderLod.activeLeafProxyCount, 12);
  assert.equal(
    warmDelta.payload.schroederPortableSummaryReplayDescriptor.replaySeed.renderLod.activeLeafProxyCount,
    12
  );

  const replayDescriptor = createSchroederPortableSummaryReplayDescriptor({
    stateManager,
    hotBufferKey: admission.hotBufferKey
  });
  assert.equal(replayDescriptor.schema, ULG_SCHROEDER_PORTABLE_SUMMARY_REPLAY_DESCRIPTOR_SCHEMA);
  assert.equal(replayDescriptor.status, 'schroeder-portable-summary-replay-descriptor-ready');
  assert.equal(replayDescriptor.hotBufferKey, admission.hotBufferKey);
  assert.equal(replayDescriptor.cacheKey, 'ulg:test:schroeder-portable-summary');
  assert.equal(replayDescriptor.stateKey, 'ulg:test:schroeder-state');
  assert.equal(replayDescriptor.replaySeed.renderLod.schema, ULG_SCHROEDER_RENDER_LOD_SUMMARY_SCHEMA);
  assert.equal(replayDescriptor.acceptedReplayPayloadModes.includes('descriptor-seed-no-raw-gpubuffer-transfer'), true);
  assert.equal(replayDescriptor.acceptedReplayPayloadModes.includes('portable-summary-snapshot-no-raw-gpubuffer-transfer'), true);

  const missingReplayDescriptor = createSchroederPortableSummaryReplayDescriptor({
    stateManager,
    hotBufferKey: 'missing-schroeder-summary'
  });
  assert.equal(
    missingReplayDescriptor.status,
    'blocked-schroeder-portable-summary-replay-descriptor'
  );
  assert.equal(missingReplayDescriptor.ready, false);
  assert.equal(missingReplayDescriptor.reason, 'schroeder-portable-summary-hot-buffer-not-found');

  const rejected = admitSchroederPortableSummary({
    stateManager,
    portableSummary: schroederPortableSummaryFixture({
      retainedRefs: [
        {
          family: 'schroeder-active-node-list',
          transferMode: 'descriptor-only-no-raw-gpubuffer-transfer',
          buffer: { label: 'raw-gpubuffer-must-not-transfer' }
        }
      ]
    })
  });
  assert.equal(rejected.status, 'schroeder-portable-summary-admission-rejected');
  assert.equal(rejected.accepted, false);
  assert.equal(rejected.committed, false);
  assert.deepEqual(rejected.issues, ['portable-summary-raw-gpubuffer-transfer-detected']);
});

test('resident authority host summary exposes render ownership policy fields', () => {
  const renderOwnershipPolicy = resolvePeerComputeRenderOwnershipPolicy({
    peercomputePolicy: {
      requestedMode: 'presentation-worker-retained-output-presentation-only',
      retainedCompactSnapshotExportRequested: true
    },
    workerOwnedResidentProducerReady: true,
    schroederPortableSummary: schroederPortableSummaryFixture()
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
  assert.equal(summary.renderOwnershipRetainedCompactSnapshotExportRequested, true);
  assert.equal(summary.renderOwnershipStatePromotionMode, 'presentation-only');
  assert.equal(summary.renderOwnershipAuthoritativeStateMutationExpected, false);
  assert.equal(summary.renderOwnershipResidentPlaybackUseCase, 'interactive-presentation');
  assert.equal(summary.renderOwnershipResidentStepsPerScheduleMax, 4);
  assert.equal(summary.renderOwnershipResidentInterfaceRefreshMode, 'pipelined');
  assert.equal(summary.renderOwnershipResidentComputeManagerMode, 'direct');
  assert.equal(summary.renderOwnershipResidentComputeManagerModeExplicit, false);
  assert.equal(summary.renderOwnershipSchroederPortableSummaryPresent, true);
  assert.equal(summary.renderOwnershipSchroederPortableSummaryStatus, 'schroeder-portable-summary-plan-ready');
  assert.equal(summary.renderOwnershipSchroederPortableSummaryTransferMode, 'peercompute-portable-summary-descriptors');
  assert.equal(summary.renderOwnershipSchroederPortableSummaryDescriptorOnlyTransfer, true);
  assert.equal(summary.renderOwnershipSchroederPortableSummaryRawGpuBufferTransferDetected, false);
  assert.equal(summary.renderOwnershipSchroederRenderLodStatus, 'schroeder-render-lod-summary-presentation-ready');
  assert.equal(summary.renderOwnershipSchroederRenderLodPresentationReady, true);
  assert.equal(summary.renderOwnershipSchroederRenderLodPresentationSourceMode, 'schroeder-portable-summary-render-lod');
  assert.equal(summary.renderOwnershipSchroederRenderLodActiveLeafProxyCount, 12);
  assert.equal(summary.renderOwnershipSchroederRenderLodAggregateProxyCount, 3);
  assert.equal(summary.renderOwnershipSchroederRenderLodFullParticleReadbackAvoided, true);
  assert.equal(summary.residentSchroederPortableSummaryAdmissionReady, false);
  assert.equal(summary.residentSchroederPortableSummaryReplayDescriptorReady, false);
});
