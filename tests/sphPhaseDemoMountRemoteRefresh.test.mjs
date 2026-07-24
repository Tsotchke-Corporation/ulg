import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  ULG_MLS_MPM_GPU_PARTICLE_BUFFER_SCHEMA,
  ULG_MLS_MPM_GPU_PARTICLE_BUFFER_SET_SCHEMA,
  ULG_MLS_MPM_GPU_RESIDENT_STEPS_EXECUTION_SCHEMA,
  ULG_SPH_GPU_PARTICLE_BUFFER_SCHEMA,
  ULG_SPH_GPU_PARTICLE_BUFFER_SET_SCHEMA
} from '../ulg-gpu-abi/src/index.js';
import {
  SPH_PENDING_BODY_ENVELOPE_PREVIEW_SCHEMA,
  SPH_PHASE_REBUILD_WORKER_STATUS_SCHEMA,
  SPH_RESIDENT_STAGE_ORDER_TRACE_SCHEMA,
  SPH_REMOTE_RESIDENT_TASK_GRAPH_REFRESH_SCHEMA,
  SPH_NATIVE_SURFACE_CAMERA_PRESENTATION_SETTLE_ABSOLUTE_TOLERANCE,
  appendResidentStageOrderTrace,
  createSphPendingBodyEnvelopePreview,
  isSphNativeSurfaceCameraPresentationSnapshotStale,
  normalizeSphResidentPresentationProofWaitTimeout,
  resolveSphNativeSurfaceCameraRetryEligibility,
  resolveSphNativeSurfaceCameraPresentationRecoveryEligibility,
  resolveSphNativeSurfaceCandidateCompletionRequestSelection,
  resolveSphNativeSurfaceLatePresentationSuccessEligibility,
  resolveSphResidentParticleBridgeStartupPreflight,
  resolveSphNativeSurfaceCandidateCompletionHandoff,
  resolveSphResidentPresentationProof,
  resolveSphInitialPresentationSchedulePlan,
  resolveSphNativeSurfaceCadenceRefreshPolicy,
  resolveSphNativeSurfaceStartupRefreshCoalescing,
  resolveSphRendererSurfaceStartupSelection,
  resolveSphNativeWebGpuStartupPreflight,
  resolveSphSimulationRuntimePrerequisite,
  residentSurfaceDrawInitialVisualRefreshPlan,
  residentGpuContinuationEvidenceReady,
  runRemoteResidentTaskGraphRefreshPrelude,
  summarizeResidentStageOrderExecution,
  sphNativeSurfaceCameraPresentationFingerprintsMatch,
  workerRebuildResetGate
} from '../src/visualization/sphPhaseDemoMount.js';
import {
  SPH_NATIVE_SURFACE_CAMERA_SNAPSHOT_ABSOLUTE_TOLERANCE,
  sphNativeSurfaceCandidatePresentationNumberListsMatch,
  SPH_NATIVE_SURFACE_CAMERA_SNAPSHOT_STALE_ERROR_CODE
} from '../src/visualization/sphPhaseScene.js';
import { SPH_INITIAL_BODIES_SCHEMA } from '../src/runtime/sphInitialBodies.js';

function pendingPreviewInitialBodies(overrides = {}) {
  return {
    schema: SPH_INITIAL_BODIES_SCHEMA,
    bodies: [
      {
        id: 'base',
        domainId: 1,
        material: 'h2o',
        sizeM: [1, 1, 1],
        centerM: [2.5, 0.5, 2.5],
        temperatureK: 300,
        particlesPerEdge: [5, 5, 5],
        velocityMPerS: [0, 0, 0]
      },
      {
        id: 'drop',
        domainId: 2,
        material: 'Na',
        sizeM: [0.6, 0.6, 0.6],
        centerM: [2.5, 2.8, 2.5],
        temperatureK: 300,
        particlesPerEdge: [3, 3, 3],
        velocityMPerS: [0, 0, 0]
      }
    ].map((body) => body.id === overrides.id ? { ...body, ...overrides } : body)
  };
}

test('startup honors an explicit WebGL renderer without auto-selecting a native-only surface', () => {
  const result = resolveSphRendererSurfaceStartupSelection({
    requestedRendererBackend: 'webgl',
    requestedSurfaceDrawMode: null,
    mechanicsMode: 'mlsmpm',
    webGpuAvailable: true
  });
  assert.equal(result.status, 'renderer-surface-startup-reconciled-to-explicit-renderer');
  assert.equal(result.rendererBackend, 'webgl');
  assert.equal(result.surfaceDrawMode, null);
  assert.equal(result.nativeSurfaceDrawRequested, false);
});

test('startup reconciles an explicit surface mode to its compatible renderer', () => {
  const native = resolveSphRendererSurfaceStartupSelection({
    requestedRendererBackend: 'webgl',
    requestedSurfaceDrawMode: 'native-webgpu-surface-consumer',
    mechanicsMode: 'mlsmpm',
    webGpuAvailable: true
  });
  assert.equal(native.rendererBackend, 'native-webgpu');
  assert.equal(native.surfaceDrawMode, 'native-webgpu-surface-consumer');
  assert.equal(native.nativeSurfaceDrawRequested, true);

  const spheres = resolveSphRendererSurfaceStartupSelection({
    requestedRendererBackend: 'native-webgpu',
    requestedSurfaceDrawMode: 'three-render-row-spheres',
    mechanicsMode: 'mlsmpm',
    webGpuAvailable: true
  });
  assert.equal(spheres.rendererBackend, 'webgl');
  assert.equal(spheres.surfaceDrawMode, 'three-render-row-spheres');
  assert.equal(spheres.nativeSurfaceDrawRequested, false);
});

test('startup refuses a native surface for the CPU SPH carrier', () => {
  const result = resolveSphRendererSurfaceStartupSelection({
    requestedRendererBackend: 'native-webgpu',
    requestedSurfaceDrawMode: 'native-webgpu-surface-consumer',
    mechanicsMode: 'sph',
    webGpuAvailable: true
  });
  assert.equal(result.status, 'renderer-surface-startup-cpu-visible-fallback');
  assert.equal(result.rendererBackend, 'webgl');
  assert.equal(result.surfaceDrawMode, 'auto');
  assert.equal(result.nativeSurfaceDrawRequested, false);
});

test('interactive simulation admission requires enabled workers, a Worker constructor, and a WebGPU device', () => {
  const device = { limits: { maxStorageBuffersPerShaderStage: 12 } };
  const ready = resolveSphSimulationRuntimePrerequisite({
    workersEnabled: true,
    workerConstructorAvailable: true,
    deviceResult: { status: 'webgpu-device-ready', device }
  });
  assert.equal(ready.ready, true);
  assert.equal(ready.status, 'sph-simulation-runtime-prerequisite-ready');

  const disabled = resolveSphSimulationRuntimePrerequisite({
    workersEnabled: false,
    workerConstructorAvailable: true,
    deviceResult: { status: 'webgpu-device-ready', device }
  });
  assert.equal(disabled.ready, false);
  assert.equal(disabled.status, 'blocked-sph-simulation-workers-disabled');
  assert.match(disabled.reason, /residentWorkers=0/);

  const noWorkerConstructor = resolveSphSimulationRuntimePrerequisite({
    workersEnabled: true,
    workerConstructorAvailable: false,
    deviceResult: { status: 'webgpu-device-ready', device }
  });
  assert.equal(noWorkerConstructor.ready, false);
  assert.equal(noWorkerConstructor.status, 'blocked-sph-simulation-worker-constructor-unavailable');

  const noDevice = resolveSphSimulationRuntimePrerequisite({
    workersEnabled: true,
    workerConstructorAvailable: true,
    deviceResult: {
      status: 'blocked-webgpu-unavailable',
      reason: 'requestAdapter returned null',
      device: null
    }
  });
  assert.equal(noDevice.ready, false);
  assert.equal(noDevice.status, 'blocked-sph-simulation-webgpu-unavailable');
  assert.equal(noDevice.reason, 'requestAdapter returned null');
});

test('native startup falls back visibly when navigator.gpu cannot acquire an adapter', () => {
  const result = resolveSphNativeWebGpuStartupPreflight({
    requestedRendererBackend: 'native-webgpu',
    requestedSurfaceDrawMode: 'native-webgpu-surface-consumer',
    deviceResult: {
      status: 'blocked-webgpu-unavailable',
      reason: 'requestAdapter returned null',
      device: null
    }
  });
  assert.equal(result.status, 'native-webgpu-startup-preflight-visible-fallback');
  assert.equal(result.reason, 'requestAdapter returned null');
  assert.equal(result.fallbackApplied, true);
  assert.equal(result.rendererBackend, 'webgl');
  assert.equal(result.surfaceDrawMode, 'auto');
});

test('native startup keeps invalid fallback input on the CPU/WebGL-visible path', () => {
  const result = resolveSphNativeWebGpuStartupPreflight({
    requestedRendererBackend: 'native-webgpu',
    requestedSurfaceDrawMode: 'native-webgpu-surface-consumer',
    fallbackSurfaceDrawMode: 'not-a-real-mode',
    deviceResult: {
      status: 'blocked-webgpu-unavailable',
      reason: 'requestAdapter returned null',
      device: null
    }
  });
  assert.equal(result.fallbackApplied, true);
  assert.equal(result.rendererBackend, 'webgl');
  assert.equal(result.surfaceDrawMode, 'auto');
});

test('native startup rejects a device below the canonical SS storage-binding limit', () => {
  const result = resolveSphNativeWebGpuStartupPreflight({
    requestedRendererBackend: 'native-webgpu',
    requestedSurfaceDrawMode: 'native-webgpu-surface-consumer',
    deviceResult: {
      status: 'webgpu-device-ready',
      device: { limits: { maxStorageBuffersPerShaderStage: 8 } },
      adapterLimits: { maxStorageBuffersPerShaderStage: 8 }
    }
  });
  assert.equal(result.fallbackApplied, true);
  assert.equal(result.rendererBackend, 'webgl');
  assert.match(result.reason, /requires 12 storage buffers/);
});

test('native startup keeps the native surface consumer with an admitted resident device', () => {
  const device = { limits: { maxStorageBuffersPerShaderStage: 12 } };
  const result = resolveSphNativeWebGpuStartupPreflight({
    requestedRendererBackend: 'native-webgpu',
    requestedSurfaceDrawMode: 'native-webgpu-surface-consumer',
    deviceResult: {
      status: 'webgpu-device-ready',
      reason: 'device acquired',
      device,
      adapterLimits: { maxStorageBuffersPerShaderStage: 12 }
    }
  });
  assert.equal(result.status, 'native-webgpu-startup-preflight-ready');
  assert.equal(result.ready, true);
  assert.equal(result.fallbackApplied, false);
  assert.equal(result.rendererBackend, 'native-webgpu');
  assert.equal(result.surfaceDrawMode, 'native-webgpu-surface-consumer');
});

test('native surface mode schedules an initial visible refresh before physics advances', () => {
  assert.deepEqual(
    residentSurfaceDrawInitialVisualRefreshPlan('native-webgpu-surface-consumer'),
    {
      required: true,
      particleRenderMode: null,
      nativeSurfaceConsumerRefresh: true
    }
  );
  assert.deepEqual(
    residentSurfaceDrawInitialVisualRefreshPlan('three-render-row-spheres'),
    {
      required: true,
      particleRenderMode: 'variable-size-spheres',
      nativeSurfaceConsumerRefresh: false
    }
  );
  assert.equal(residentSurfaceDrawInitialVisualRefreshPlan('auto').required, false);
});

test('initial presentation scheduling orders bridge physics after the t=0 visual refresh', () => {
  const nativeAuto = resolveSphInitialPresentationSchedulePlan({
    surfaceDrawMode: 'native-webgpu-surface-consumer',
    residentAutoEnabled: true
  });
  assert.equal(nativeAuto.required, true);
  assert.equal(nativeAuto.nativeSurfaceConsumerRefresh, true);
  assert.equal(nativeAuto.scheduleResidentPhysics, true);
  assert.equal(nativeAuto.residentPhysicsOrder, 'after-initial-visual-presentation');

  const spheresAuto = resolveSphInitialPresentationSchedulePlan({
    surfaceDrawMode: 'three-render-row-spheres',
    residentAutoEnabled: true
  });
  assert.equal(spheresAuto.required, true);
  assert.equal(spheresAuto.particleRenderMode, 'variable-size-spheres');
  assert.equal(spheresAuto.residentPhysicsOrder, 'after-initial-visual-presentation');

  const cpuAuto = resolveSphInitialPresentationSchedulePlan({
    surfaceDrawMode: 'auto',
    residentAutoEnabled: true
  });
  assert.equal(cpuAuto.required, false);
  assert.equal(cpuAuto.scheduleResidentPhysics, true);
  assert.equal(cpuAuto.residentPhysicsOrder, 'after-upload-prerequisites');

  const nativePaused = resolveSphInitialPresentationSchedulePlan({
    surfaceDrawMode: 'native-webgpu-surface-consumer',
    residentAutoEnabled: false
  });
  assert.equal(nativePaused.required, true);
  assert.equal(nativePaused.scheduleResidentPhysics, false);
  assert.equal(nativePaused.residentPhysicsOrder, 'disabled');
  assert.equal(Object.isFrozen(nativePaused), true);
});

test('native startup coalesces playback refreshes until its first surface publication', () => {
  const pending = resolveSphNativeSurfaceStartupRefreshCoalescing({
    nativeSurfaceConsumerRefresh: true,
    surfaceDraw: {
      visibleRendererBridge: 'pending-three-webgpu-binding',
      surfaceDrawVisibleGpuConsumerReady: false
    },
    validationScheduler: {
      activeCount: 1,
      queuedCount: 1,
      published: 0
    }
  });
  assert.equal(pending.deferRefresh, true);
  assert.equal(pending.status, 'native-surface-first-publication-coalesced');
  assert.equal(pending.validationInFlight, true);
  assert.equal(pending.nativePresentationCommitted, false);

  const committed = resolveSphNativeSurfaceStartupRefreshCoalescing({
    nativeSurfaceConsumerRefresh: true,
    surfaceDraw: {
      visibleRendererBridge: 'native-webgpu-surface-consumer',
      surfaceDrawVisibleGpuConsumerReady: true
    },
    validationScheduler: {
      activeCount: 1,
      queuedCount: 1,
      published: 1
    }
  });
  assert.equal(committed.deferRefresh, false);
  assert.equal(committed.nativePresentationCommitted, true);

  const nonNative = resolveSphNativeSurfaceStartupRefreshCoalescing({
    nativeSurfaceConsumerRefresh: false,
    validationScheduler: { activeCount: 1, published: 0 }
  });
  assert.equal(nonNative.deferRefresh, false);
  assert.equal(nonNative.status, 'native-surface-startup-refresh-not-requested');
});

test('native cadence retains a foreground-proved prior surface but recovers an unproved display', () => {
  const renderState = {
    schema: 'peercompute.ulg.sph-resident-render-state.v0',
    surfaceDrawVisibleRendererBridge: 'native-webgpu-surface-consumer'
  };
  const foregroundProvedSurface = {
    visibleRendererBridge: 'native-webgpu-surface-consumer',
    surfaceDrawVisibleGpuConsumerReady: true,
    surfaceDrawVisibleGpuConsumerOffscreenForegroundValidated: true,
    surfaceDrawVisibleGpuConsumerNativeActiveResourceGeneration: 9,
    surfaceDrawVisibleGpuConsumerNativeOffscreenValidationResourceGeneration: 9,
    renderBridgeLastRenderStatus: 'native-webgpu-surface-consumer-rendered',
    renderBridgeFrameCount: 2,
    renderBridgeLastSubmittedDrawCount: 1,
    renderBridgeNativeSurfaceDebugMode: 'none'
  };

  const retained = resolveSphNativeSurfaceCadenceRefreshPolicy({
    nativeSurfaceConsumerRefresh: true,
    renderState,
    surfaceDraw: {
      ...foregroundProvedSurface,
      sourceResidentExecutionGenerationMatchesCurrent: false,
      sourceResidentRetainedPrevious: true,
      residentRenderSourceStaleAfterPublish: true
    }
  });
  assert.equal(retained.status, 'native-surface-visible-presentation-cadence-deferred');
  assert.equal(retained.presentationVisible, true);
  assert.equal(retained.currentSourceForAdmission, false);
  assert.equal(retained.forceDue, false);
  assert.equal(retained.deferToCadence, true);
  assert.equal(retained.displayProof?.visible, true);
  assert.equal(retained.displayProof?.sourceCurrent, false);
  assert.equal(Object.isFrozen(retained), true);
  assert.equal(Object.isFrozen(retained.displayProof), true);

  const current = resolveSphNativeSurfaceCadenceRefreshPolicy({
    nativeSurfaceConsumerRefresh: true,
    renderState,
    surfaceDraw: {
      ...foregroundProvedSurface,
      sourceResidentExecutionGenerationMatchesCurrent: true,
      sourceResidentRetainedPrevious: false,
      residentRenderSourceStaleAfterPublish: false
    }
  });
  assert.equal(current.presentationVisible, true);
  assert.equal(current.currentSourceForAdmission, true);
  assert.equal(current.forceDue, false);

  for (const [label, surfaceDraw] of [
    ['missing surface', null],
    ['generation mismatch', {
      ...foregroundProvedSurface,
      surfaceDrawVisibleGpuConsumerNativeOffscreenValidationResourceGeneration: 8
    }],
    ['clear-only diagnostic', {
      ...foregroundProvedSurface,
      renderBridgeNativeSurfaceDebugMode: 'clear-only'
    }],
    ['zero submitted draw count', {
      ...foregroundProvedSurface,
      renderBridgeLastSubmittedDrawCount: 0
    }]
  ]) {
    const recovery = resolveSphNativeSurfaceCadenceRefreshPolicy({
      nativeSurfaceConsumerRefresh: true,
      renderState,
      surfaceDraw
    });
    assert.equal(recovery.status, 'native-surface-visible-presentation-recovery-required', label);
    assert.equal(recovery.presentationVisible, false, label);
    assert.equal(recovery.forceDue, true, label);
    assert.equal(recovery.deferToCadence, false, label);
  }

  const nonNative = resolveSphNativeSurfaceCadenceRefreshPolicy({
    nativeSurfaceConsumerRefresh: false,
    renderState,
    surfaceDraw: foregroundProvedSurface
  });
  assert.equal(nonNative.status, 'native-surface-cadence-policy-not-requested');
  assert.equal(nonNative.forceDue, false);
  assert.equal(nonNative.deferToCadence, false);
});

test('pending startup preview exposes only validated control-body envelopes', () => {
  const preview = createSphPendingBodyEnvelopePreview({
    initialBodies: pendingPreviewInitialBodies(),
    boxDimsM: [5, 5, 5],
    reason: 'test-closure-pending',
    generation: 7,
    previewSerial: 3
  });
  assert.equal(preview.schema, SPH_PENDING_BODY_ENVELOPE_PREVIEW_SCHEMA);
  assert.equal(preview.status, 'physics-pending-control-envelope-preview');
  assert.equal(preview.source, 'validated-initial-body-controls');
  assert.equal(preview.label, 'physics pending');
  assert.match(preview.description, /not simulation output/);
  assert.equal(preview.presentationOnly, true);
  assert.equal(preview.authoritativePhysicsState, false);
  assert.equal(preview.physicsStateCurrent, false);
  assert.equal(preview.scientificValidation, false);
  assert.equal(preview.sphValidation, false);
  assert.equal(preview.phaseChangeValidation, false);
  assert.equal(preview.fullPhysicsValidation, false);
  assert.equal(preview.bodyCount, 2);
  assert.deepEqual(preview.bodies[0].minM, [2, 0, 2]);
  assert.deepEqual(preview.bodies[0].maxM, [3, 1, 3]);
  assert.deepEqual(preview.bodies[1].minM, [2.2, 2.5, 2.2]);
  assert.ok(Math.abs(preview.bodies[1].maxM[0] - 2.8) < 1e-12);
  assert.ok(Math.abs(preview.bodies[1].maxM[1] - 3.1) < 1e-12);
  assert.ok(Math.abs(preview.bodies[1].maxM[2] - 2.8) < 1e-12);
  assert.equal('phase' in preview.bodies[0], false);
  assert.equal('materialProperties' in preview.bodies[0], false);
  assert.equal('opticalProperties' in preview.bodies[0], false);
  assert.equal(Object.isFrozen(preview), true);
  assert.equal(Object.isFrozen(preview.bodies), true);
  assert.equal(Object.isFrozen(preview.bodies[0]), true);
  assert.equal(Object.isFrozen(preview.bodies[0].minM), true);
});

test('pending startup preview rejects a control-body envelope outside the container', () => {
  assert.throws(
    () => createSphPendingBodyEnvelopePreview({
      initialBodies: pendingPreviewInitialBodies({ id: 'base', centerM: [0.1, 0.5, 2.5] }),
      boxDimsM: [5, 5, 5]
    }),
    /outside container axis 0/
  );
});

test('native startup presentation proof rejects bridge labels and stale foreground generations', () => {
  const renderState = {
    schema: 'peercompute.ulg.sph-resident-render-state.v0',
    surfaceDrawVisibleRendererBridge: 'native-webgpu-surface-consumer'
  };
  const labelOnly = resolveSphResidentPresentationProof({
    renderState,
    surfaceDraw: {
      visibleRendererBridge: 'native-webgpu-surface-consumer'
    }
  });
  assert.equal(labelOnly.visible, false);
  assert.equal(labelOnly.status, 'native-resident-presentation-foreground-unproved');

  const currentSurface = {
    visibleRendererBridge: 'native-webgpu-surface-consumer',
    surfaceDrawVisibleGpuConsumerReady: true,
    surfaceDrawVisibleGpuConsumerOffscreenForegroundValidated: true,
    surfaceDrawVisibleGpuConsumerNativeActiveResourceGeneration: 9,
    surfaceDrawVisibleGpuConsumerNativeOffscreenValidationResourceGeneration: 8,
    renderBridgeLastRenderStatus: 'native-webgpu-surface-consumer-rendered',
    renderBridgeFrameCount: 2,
    renderBridgeLastSubmittedDrawCount: 1,
    renderBridgeNativeSurfaceDebugMode: 'none'
  };
  const stale = resolveSphResidentPresentationProof({
    renderState,
    surfaceDraw: currentSurface
  });
  assert.equal(stale.visible, false);
  assert.equal(stale.generationMatched, false);

  const exact = resolveSphResidentPresentationProof({
    renderState,
    surfaceDraw: {
      ...currentSurface,
      surfaceDrawVisibleGpuConsumerNativeOffscreenValidationResourceGeneration: 9
    }
  });
  assert.equal(exact.visible, true);
  assert.equal(exact.generationMatched, true);
  assert.equal(exact.status, 'native-resident-presentation-foreground-proved');

  const exactStagedCopy = resolveSphResidentPresentationProof({
    renderState,
    surfaceDraw: {
      ...currentSurface,
      surfaceDrawVisibleGpuConsumerNativeOffscreenValidationResourceGeneration: 9,
      renderBridgeLastRenderStatus:
        'native-webgpu-surface-consumer-candidate-staged-composite-presented',
      renderBridgeNativeSurfaceCandidateStagedPresentationStatus:
        'candidate-staged-presentation-visible-copy-submitted',
      renderBridgeNativeSurfaceCandidatePresentationCopyCount: 1,
      renderBridgeNativeSurfaceCandidatePresentationPostAdmissionGeometrySubmitCount: 0,
      sourceResidentExecutionGenerationMatchesCurrent: true,
      sourceResidentRetainedPrevious: false,
      residentRenderSourceStaleAfterPublish: false
    },
    requireCurrentSource: true
  });
  assert.equal(exactStagedCopy.visible, true);
  assert.equal(exactStagedCopy.stagedCopyOnlyPresentation, true);
  assert.equal(exactStagedCopy.status, 'native-resident-presentation-foreground-proved');

  for (const [label, receipt] of [
    ['missing copy receipt', {}],
    ['post-admission geometry submit', {
      renderBridgeNativeSurfaceCandidateStagedPresentationStatus:
        'candidate-staged-presentation-visible-copy-submitted',
      renderBridgeNativeSurfaceCandidatePresentationCopyCount: 1,
      renderBridgeNativeSurfaceCandidatePresentationPostAdmissionGeometrySubmitCount: 1
    }],
    ['wrong staged presentation status', {
      renderBridgeNativeSurfaceCandidateStagedPresentationStatus:
        'candidate-staged-presentation-ready-for-exact-publication',
      renderBridgeNativeSurfaceCandidatePresentationCopyCount: 1,
      renderBridgeNativeSurfaceCandidatePresentationPostAdmissionGeometrySubmitCount: 0
    }]
  ]) {
    const proof = resolveSphResidentPresentationProof({
      renderState,
      surfaceDraw: {
        ...currentSurface,
        surfaceDrawVisibleGpuConsumerNativeOffscreenValidationResourceGeneration: 9,
        renderBridgeLastRenderStatus:
          'native-webgpu-surface-consumer-candidate-staged-composite-presented',
        ...receipt
      },
      requireCurrentSource: true
    });
    assert.equal(proof.visible, false, label);
    assert.equal(proof.stagedCopyOnlyPresentation, false, label);
  }

  const staleSource = resolveSphResidentPresentationProof({
    renderState,
    surfaceDraw: {
      ...currentSurface,
      surfaceDrawVisibleGpuConsumerNativeOffscreenValidationResourceGeneration: 9,
      sourceResidentExecutionGenerationMatchesCurrent: false,
      sourceResidentRetainedPrevious: true,
      residentRenderSourceStaleAfterPublish: true
    },
    requireCurrentSource: true
  });
  assert.equal(staleSource.visible, false);
  assert.equal(staleSource.status, 'native-resident-presentation-stale-source');
  assert.equal(staleSource.sourceCurrent, false);

  const retainedVisible = resolveSphResidentPresentationProof({
    renderState,
    surfaceDraw: {
      ...currentSurface,
      surfaceDrawVisibleGpuConsumerNativeOffscreenValidationResourceGeneration: 9,
      sourceResidentExecutionGenerationMatchesCurrent: false,
      sourceResidentRetainedPrevious: true,
      residentRenderSourceStaleAfterPublish: true
    }
  });
  assert.equal(retainedVisible.visible, true);
  assert.equal(retainedVisible.sourceCurrent, false);

  for (const [label, source] of [
    ['missing exact-generation match', {
      sourceResidentExecutionGenerationMatchesCurrent: null,
      sourceResidentRetainedPrevious: false,
      residentRenderSourceStaleAfterPublish: false
    }],
    ['retained previous source', {
      sourceResidentExecutionGenerationMatchesCurrent: true,
      sourceResidentRetainedPrevious: true,
      residentRenderSourceStaleAfterPublish: false
    }],
    ['explicit stale marker', {
      sourceResidentExecutionGenerationMatchesCurrent: true,
      sourceResidentRetainedPrevious: false,
      residentRenderSourceStaleAfterPublish: true
    }]
  ]) {
    const proof = resolveSphResidentPresentationProof({
      renderState,
      surfaceDraw: {
        ...currentSurface,
        surfaceDrawVisibleGpuConsumerNativeOffscreenValidationResourceGeneration: 9,
        ...source
      },
      requireCurrentSource: true
    });
    assert.equal(proof.visible, false, label);
    assert.equal(proof.status, 'native-resident-presentation-stale-source', label);
    assert.equal(proof.sourceCurrent, false, label);
  }

  const exactCurrentSource = resolveSphResidentPresentationProof({
    renderState,
    surfaceDraw: {
      ...currentSurface,
      surfaceDrawVisibleGpuConsumerNativeOffscreenValidationResourceGeneration: 9,
      sourceResidentExecutionGenerationMatchesCurrent: true,
      sourceResidentRetainedPrevious: false,
      residentRenderSourceStaleAfterPublish: false
    },
    requireCurrentSource: true
  });
  assert.equal(exactCurrentSource.visible, true);
  assert.equal(exactCurrentSource.sourceCurrent, true);

  const retainedWhileBusy = resolveSphResidentPresentationProof({
    renderState,
    surfaceDraw: {
      ...currentSurface,
      surfaceDrawVisibleGpuConsumerNativeOffscreenValidationResourceGeneration: 9,
      renderBridgeLastRenderStatus: 'resident-surface-draw-skipped-resident-gpu-work-in-flight'
    }
  });
  assert.equal(retainedWhileBusy.visible, true);
  assert.equal(retainedWhileBusy.retainedVisibleWhileResidentGpuWorkInFlight, true);

  const zeroDraw = resolveSphResidentPresentationProof({
    renderState,
    surfaceDraw: {
      ...currentSurface,
      surfaceDrawVisibleGpuConsumerNativeOffscreenValidationResourceGeneration: 9,
      renderBridgeLastSubmittedDrawCount: 0
    }
  });
  assert.equal(zeroDraw.visible, false);
});

test('only the typed pre-copy camera snapshot failure is eligible for a native render retry', () => {
  assert.equal(
    isSphNativeSurfaceCameraPresentationSnapshotStale(
      `${SPH_NATIVE_SURFACE_CAMERA_SNAPSHOT_STALE_ERROR_CODE}: candidate staged presentation snapshot changed at cameraWorld`
    ),
    true
  );
  assert.equal(
    isSphNativeSurfaceCameraPresentationSnapshotStale(
      'candidate staged presentation snapshot changed at cameraWorld'
    ),
    false
  );
  assert.equal(
    isSphNativeSurfaceCameraPresentationSnapshotStale(
      'candidate staged presentation snapshot changed at sourceInputBuffer'
    ),
    false
  );
  assert.equal(
    isSphNativeSurfaceCameraPresentationSnapshotStale(
      'native surface candidate lost exact publication lineage'
    ),
    false
  );
});

test('inline camera retry requires an exact structured handoff and current scheduler terminal', () => {
  const stepsSignature = {};
  const stepSignature = {};
  const handoff = {
    schema: 'peercompute.ulg.sph-native-surface-candidate-completion-handoff.v0',
    status: 'failed',
    reason: 'diagnostic text is not retry authority',
    requestToken: 19,
    lifecycleGeneration: 4,
    candidateGeneration: 34,
    sourceResidentExecutionGeneration: 81,
    sourceResidentStepsSignature: stepsSignature,
    sourceResidentStepSignature: stepSignature,
    sourceResidentExecutionGenerationMatchesCurrent: true,
    terminalStatus: 'failed',
    terminalFailureCode: SPH_NATIVE_SURFACE_CAMERA_SNAPSHOT_STALE_ERROR_CODE,
    terminalFailureChangedKey: 'cameraWorld',
    terminalFailureCameraOnly: true,
    terminalReceiptMatchesRequest: true,
    terminalRequestToken: 19,
    terminalLifecycleGeneration: 4,
    terminalCandidateGeneration: 34
  };
  const scheduler = {
    latestToken: 19,
    latestCandidateRequestToken: 19,
    latestCandidateGeneration: 34,
    lifecycleGeneration: 4,
    latestCandidateLifecycleGeneration: 4,
    latestCandidateSourceResidentExecutionGeneration: 81,
    latestCandidateSourceResidentStepsSignature: stepsSignature,
    latestCandidateSourceResidentStepSignature: stepSignature,
    latestCandidateSourceResidentExecutionGenerationMatchesCurrent: true,
    terminalStatus: 'failed',
    terminalFailureCode: SPH_NATIVE_SURFACE_CAMERA_SNAPSHOT_STALE_ERROR_CODE,
    terminalFailureCameraOnly: true,
    terminalReceiptMatchesRequest: true,
    terminalIsCurrentLatest: true,
    terminalRequestToken: 19,
    terminalCandidateGeneration: 34,
    terminalLifecycleGeneration: 4,
    terminalSourceResidentExecutionGeneration: 81,
    terminalSourceResidentStepsSignature: stepsSignature,
    terminalSourceResidentStepSignature: stepSignature,
    terminalSourceResidentExecutionGenerationMatchesCurrent: true
  };
  const expected = {
    handoff,
    scheduler,
    expectedRequestToken: 19,
    expectedLifecycleGeneration: 4,
    expectedCandidateGeneration: 34,
    expectedResidentExecutionGeneration: 81,
    expectedResidentStepsSignature: stepsSignature,
    expectedResidentStepSignature: stepSignature,
    sourceStillCurrent: true
  };
  const admitted = resolveSphNativeSurfaceCameraRetryEligibility(expected);
  assert.equal(admitted.eligible, true);
  assert.equal(admitted.failureCode, SPH_NATIVE_SURFACE_CAMERA_SNAPSHOT_STALE_ERROR_CODE);

  const reasonOnly = resolveSphNativeSurfaceCameraRetryEligibility({
    ...expected,
    handoff: {
      ...handoff,
      terminalFailureCode: null,
      terminalFailureCameraOnly: false,
      reason: `${SPH_NATIVE_SURFACE_CAMERA_SNAPSHOT_STALE_ERROR_CODE}: cameraWorld`
    }
  });
  assert.equal(reasonOnly.eligible, false);
  assert.equal(reasonOnly.structuredCameraFailure, false);

  const staleScheduler = resolveSphNativeSurfaceCameraRetryEligibility({
    ...expected,
    scheduler: {
      ...scheduler,
      latestToken: 20,
      latestCandidateRequestToken: 20,
      terminalIsCurrentLatest: false
    }
  });
  assert.equal(staleScheduler.eligible, false);
  assert.equal(staleScheduler.schedulerLatestMatches, false);
});

test('late current publication may monotonically supersede a timed-out exact gate', () => {
  const stepsSignature = {};
  const stepSignature = {};
  const context = {
    generation: 7,
    scheduleToken: 12,
    sourceResidentExecutionGeneration: 81,
    sourceResidentStepsSignature: stepsSignature,
    sourceResidentStepSignature: stepSignature
  };
  const gate = {
    active: true,
    status: 'native-surface-post-step-presentation-unproved',
    generation: 7,
    scheduleToken: 12,
    requestToken: 3,
    candidateGeneration: 3,
    lifecycleGeneration: 4,
    sourceResidentExecutionGeneration: 81,
    sourceResidentStepsSignature: stepsSignature,
    sourceResidentStepSignature: stepSignature
  };
  const scheduler = {
    latestToken: 5,
    latestCandidateRequestToken: 5,
    latestCandidateGeneration: 5,
    lifecycleGeneration: 4,
    latestCandidateLifecycleGeneration: 4,
    latestCandidateSourceResidentExecutionGeneration: 81,
    latestCandidateSourceResidentStepsSignature: stepsSignature,
    latestCandidateSourceResidentStepSignature: stepSignature,
    latestCandidateSourceResidentExecutionGenerationMatchesCurrent: true,
    terminalStatus: 'published',
    terminalReceiptMatchesRequest: true,
    terminalIsCurrentLatest: true,
    terminalRequestToken: 5,
    terminalCandidateGeneration: 5,
    terminalLifecycleGeneration: 4,
    terminalSourceResidentExecutionGeneration: 81,
    terminalSourceResidentStepsSignature: stepsSignature,
    terminalSourceResidentStepSignature: stepSignature,
    terminalSourceResidentExecutionGenerationMatchesCurrent: true
  };
  const admitted = resolveSphNativeSurfaceLatePresentationSuccessEligibility({
    context,
    gate,
    scheduler,
    sourceStillCurrent: true
  });
  assert.equal(admitted.eligible, true);
  assert.equal(admitted.requestToken, 5);
  assert.equal(admitted.candidateGeneration, 5);
  assert.equal(admitted.lifecycleGeneration, 4);
  assert.equal(admitted.supersedesGate, true);

  for (const [label, overrides] of [
    ['regressing candidate identity', {
      latestToken: 2,
      latestCandidateRequestToken: 2,
      latestCandidateGeneration: 2,
      terminalRequestToken: 2,
      terminalCandidateGeneration: 2
    }],
    ['crossing lifecycle', {
      lifecycleGeneration: 5,
      latestCandidateLifecycleGeneration: 5,
      terminalLifecycleGeneration: 5
    }],
    ['crossing exact source', {
      terminalSourceResidentStepSignature: {}
    }]
  ]) {
    const rejected = resolveSphNativeSurfaceLatePresentationSuccessEligibility({
      context,
      gate,
      scheduler: { ...scheduler, ...overrides },
      sourceStillCurrent: true
    });
    assert.equal(rejected.eligible, false, label);
  }
});

test('camera damping admission has exact non-camera and bounded camera-only tolerances', () => {
  const snapshot = [1, -2, 3, 4];
  const withinCameraTolerance = [
    1 + SPH_NATIVE_SURFACE_CAMERA_SNAPSHOT_ABSOLUTE_TOLERANCE,
    -2,
    3,
    4
  ];
  const outsideCameraTolerance = [
    1 + SPH_NATIVE_SURFACE_CAMERA_SNAPSHOT_ABSOLUTE_TOLERANCE * 1.01,
    -2,
    3,
    4
  ];
  assert.equal(
    sphNativeSurfaceCandidatePresentationNumberListsMatch(
      snapshot,
      withinCameraTolerance,
      { absoluteTolerance: SPH_NATIVE_SURFACE_CAMERA_SNAPSHOT_ABSOLUTE_TOLERANCE }
    ),
    true
  );
  assert.equal(
    sphNativeSurfaceCandidatePresentationNumberListsMatch(
      snapshot,
      outsideCameraTolerance,
      { absoluteTolerance: SPH_NATIVE_SURFACE_CAMERA_SNAPSHOT_ABSOLUTE_TOLERANCE }
    ),
    false
  );
  // Lighting/domain callers retain exact comparison by supplying zero.
  assert.equal(
    sphNativeSurfaceCandidatePresentationNumberListsMatch(
      snapshot,
      [1 + Number.EPSILON, -2, 3, 4],
      { absoluteTolerance: 0 }
    ),
    false
  );
  assert.equal(
    sphNativeSurfaceCameraPresentationFingerprintsMatch(
      snapshot,
      [
        1 + SPH_NATIVE_SURFACE_CAMERA_PRESENTATION_SETTLE_ABSOLUTE_TOLERANCE * 0.99,
        -2,
        3,
        4
      ]
    ),
    true
  );
  assert.equal(
    sphNativeSurfaceCameraPresentationFingerprintsMatch(
      snapshot,
      [1 + SPH_NATIVE_SURFACE_CAMERA_PRESENTATION_SETTLE_ABSOLUTE_TOLERANCE * 1.01, -2, 3, 4]
    ),
    false
  );
});

test('camera recovery admits only a current terminal receipt newer than the prior admitted exact gate', () => {
  const stepsSignature = {};
  const stepSignature = {};
  const context = {
    generation: 7,
    scheduleToken: 12,
    gateRequestToken: 18,
    gateCandidateGeneration: 33,
    gateLifecycleGeneration: 4,
    sourceResidentExecutionGeneration: 81,
    sourceResidentStepsSignature: stepsSignature,
    sourceResidentStepSignature: stepSignature
  };
  // This is the gate created from the already-admitted request N. A late
  // camera-only terminal failure for N + 1 must be allowed to revalidate the
  // same source, rather than deadlocking playback behind the retained frame.
  const gate = {
    active: true,
    status: 'native-surface-post-step-presentation-unproved',
    generation: 7,
    scheduleToken: 12,
    requestToken: 18,
    candidateGeneration: 33,
    lifecycleGeneration: 4
  };
  const terminal = {
    latestToken: 19,
    lifecycleGeneration: 4,
    terminalStatus: 'failed',
    terminalFailureCode: SPH_NATIVE_SURFACE_CAMERA_SNAPSHOT_STALE_ERROR_CODE,
    terminalFailureCameraOnly: true,
    terminalReceiptMatchesRequest: true,
    terminalIsCurrentLatest: true,
    terminalRequestToken: 19,
    terminalCandidateGeneration: 34,
    terminalLifecycleGeneration: 4,
    terminalSourceResidentExecutionGeneration: 81,
    terminalSourceResidentStepsSignature: stepsSignature,
    terminalSourceResidentStepSignature: stepSignature,
    terminalSourceResidentExecutionGenerationMatchesCurrent: true
  };
  const admitted = resolveSphNativeSurfaceCameraPresentationRecoveryEligibility({
    context,
    gate,
    scheduler: terminal,
    sourceStillCurrent: true
  });
  assert.equal(admitted.eligible, true);
  assert.equal(admitted.terminalIsAtOrAfterCurrentGate, true);
  assert.equal(admitted.terminalReceiptMatchesScheduler, true);

  for (const [label, scheduler] of [
    [
      'terminal N is not the scheduler latest N + 1',
      {
        ...terminal,
        latestToken: 20,
        terminalIsCurrentLatest: false
      }
    ],
    [
      'terminal receipt source signature differs from the active exact execution',
      {
        ...terminal,
        terminalSourceResidentStepSignature: {}
      }
    ],
    [
      'untyped reason text cannot authorize recovery',
      {
        ...terminal,
        terminalFailureCode: null
      }
    ]
  ]) {
    const rejected = resolveSphNativeSurfaceCameraPresentationRecoveryEligibility({
      context,
      gate,
      scheduler,
      sourceStillCurrent: true
    });
    assert.equal(rejected.eligible, false, label);
  }
});

test('late camera recovery selects the scheduler latest exact source over a retained surface request', () => {
  const stepsSignature = {};
  const stepSignature = {};
  const execution = {
    residentExecutionGeneration: 2,
    signature: stepsSignature,
    finalStep: {
      residentExecutionGeneration: 2,
      signature: stepSignature
    }
  };
  const surfaceRequest = {
    token: 3,
    lifecycleGeneration: 1,
    candidateGeneration: 3
  };
  const scheduler = {
    schema: 'peercompute.ulg.sph-native-surface-candidate-validation-scheduler.v0',
    status: 'published',
    latestToken: 5,
    latestCandidateRequestToken: 5,
    latestCandidateGeneration: 5,
    lifecycleGeneration: 1,
    latestCandidateLifecycleGeneration: 1,
    latestCandidateSourceResidentExecutionGeneration: 2,
    latestCandidateSourceResidentStepsSignature: stepsSignature,
    latestCandidateSourceResidentStepSignature: stepSignature,
    latestCandidateSourceResidentExecutionGenerationMatchesCurrent: true
  };
  const selected = resolveSphNativeSurfaceCandidateCompletionRequestSelection({
    surfaceRequest,
    scheduler,
    execution,
    allowSurfaceDrawRequestFallback: false
  });
  assert.equal(selected.selectedSchedulerLatest, true);
  assert.equal(selected.usedSurfaceDrawRequestFallback, false);
  assert.equal(selected.request?.token, 5);
  assert.equal(selected.request?.candidateGeneration, 5);
  assert.equal(selected.request?.lifecycleGeneration, 1);

  const mismatchedSource =
    resolveSphNativeSurfaceCandidateCompletionRequestSelection({
      surfaceRequest,
      scheduler: {
        ...scheduler,
        latestCandidateSourceResidentStepSignature: {}
      },
      execution,
      allowSurfaceDrawRequestFallback: true
    });
  assert.equal(mismatchedSource.selectedSchedulerLatest, false);
  assert.equal(mismatchedSource.usedSurfaceDrawRequestFallback, true);
  assert.equal(mismatchedSource.request?.token, 3);

  const failClosed = resolveSphNativeSurfaceCandidateCompletionRequestSelection({
    surfaceRequest,
    scheduler: {
      ...scheduler,
      latestCandidateSourceResidentStepSignature: {}
    },
    execution,
    allowSurfaceDrawRequestFallback: false
  });
  assert.equal(failClosed.selectedSchedulerLatest, false);
  assert.equal(failClosed.request, null);
});

test('native candidate completion handoff admits only the exact published current source receipt', () => {
  const stepsSignature = {};
  const stepSignature = {};
  const receipt = {
    schema: 'peercompute.ulg.sph-native-surface-candidate-completion-handoff.v0',
    status: 'published',
    published: true,
    requestToken: 17,
    lifecycleGeneration: 4,
    candidateGeneration: 23,
    sourceResidentExecutionGeneration: 81,
    sourceResidentStepsSignature: stepsSignature,
    sourceResidentStepSignature: stepSignature,
    sourceResidentExecutionGenerationMatchesCurrent: true
  };
  const expected = {
    expectedRequestToken: 17,
    expectedLifecycleGeneration: 4,
    expectedCandidateGeneration: 23,
    expectedResidentExecutionGeneration: 81,
    expectedResidentStepsSignature: stepsSignature,
    expectedResidentStepSignature: stepSignature
  };
  const admitted = resolveSphNativeSurfaceCandidateCompletionHandoff({
    handoff: receipt,
    ...expected
  });
  assert.equal(admitted.admitted, true);
  assert.equal(
    admitted.status,
    'native-surface-candidate-completion-handoff-admitted'
  );

  for (const [label, handoff, overrides, expectedStatus] of [
    [
      'superseded candidate',
      { ...receipt, status: 'superseded', published: false },
      {},
      'native-surface-candidate-completion-handoff-not-published'
    ],
    [
      'different candidate generation',
      receipt,
      { expectedCandidateGeneration: 24 },
      'native-surface-candidate-completion-handoff-request-mismatch'
    ],
    [
      'retained previous source',
      { ...receipt, sourceResidentExecutionGenerationMatchesCurrent: false },
      {},
      'native-surface-candidate-completion-handoff-source-not-current'
    ],
    [
      'different source execution generation',
      { ...receipt, sourceResidentExecutionGeneration: 82 },
      {},
      'native-surface-candidate-completion-handoff-source-mismatch'
    ]
  ]) {
    const rejected = resolveSphNativeSurfaceCandidateCompletionHandoff({
      handoff,
      ...expected,
      ...overrides
    });
    assert.equal(rejected.admitted, false, label);
    assert.equal(rejected.status, expectedStatus, label);
  }

  for (const [label, value] of [
    ['null request token', null],
    ['empty request token', ''],
    ['boolean request token', false]
  ]) {
    const rejected = resolveSphNativeSurfaceCandidateCompletionHandoff({
      handoff: { ...receipt, requestToken: value },
      ...expected
    });
    assert.equal(rejected.admitted, false, label);
    assert.equal(
      rejected.status,
      'native-surface-candidate-completion-handoff-invalid-receipt',
      label
    );
  }
});

test('resident presentation waits preserve an omitted timeout while allowing an explicit zero bound', () => {
  assert.equal(normalizeSphResidentPresentationProofWaitTimeout(), null);
  assert.equal(normalizeSphResidentPresentationProofWaitTimeout(null), null);
  assert.equal(normalizeSphResidentPresentationProofWaitTimeout(undefined), null);
  assert.equal(normalizeSphResidentPresentationProofWaitTimeout(0), 0);
  assert.equal(normalizeSphResidentPresentationProofWaitTimeout('1250'), 1250);
  assert.equal(normalizeSphResidentPresentationProofWaitTimeout(-50), 0);
  assert.equal(normalizeSphResidentPresentationProofWaitTimeout('invalid'), null);
});

test('resident particle bridge falls back to visible CPU/WebGL surfaces when its device is unavailable', () => {
  const blocked = resolveSphResidentParticleBridgeStartupPreflight({
    requestedSurfaceDrawMode: 'three-render-row-spheres',
    deviceResult: {
      status: 'blocked-webgpu-unavailable',
      reason: 'requestAdapter returned null',
      device: null
    }
  });
  assert.equal(
    blocked.status,
    'resident-particle-bridge-startup-preflight-visible-fallback'
  );
  assert.equal(blocked.reason, 'requestAdapter returned null');
  assert.equal(blocked.fallbackApplied, true);
  assert.equal(blocked.surfaceDrawMode, 'auto');

  const ready = resolveSphResidentParticleBridgeStartupPreflight({
    requestedSurfaceDrawMode: 'three-render-row-points',
    deviceResult: {
      status: 'webgpu-device-ready',
      device: { limits: { maxStorageBuffersPerShaderStage: 12 } },
      adapterLimits: { maxStorageBuffersPerShaderStage: 12 }
    }
  });
  assert.equal(ready.status, 'resident-particle-bridge-startup-preflight-ready');
  assert.equal(ready.ready, true);
  assert.equal(ready.fallbackApplied, false);
  assert.equal(ready.surfaceDrawMode, 'three-render-row-points');
});

function retainedGpuContinuationExecution(overrides = {}) {
  return {
    schema: ULG_MLS_MPM_GPU_RESIDENT_STEPS_EXECUTION_SCHEMA,
    backend: 'webgpu',
    readbackMode: 'no-full-readback',
    continuationAvailable: true,
    nextSphParticleState: {
      schema: ULG_SPH_GPU_PARTICLE_BUFFER_SCHEMA,
      particleCount: 8
    },
    nextMlsMpmParticleState: {
      schema: ULG_MLS_MPM_GPU_PARTICLE_BUFFER_SCHEMA,
      particleCount: 8
    },
    nextParticleUploads: {
      sphParticleUpload: {
        schema: ULG_SPH_GPU_PARTICLE_BUFFER_SET_SCHEMA,
        sourceSchema: ULG_SPH_GPU_PARTICLE_BUFFER_SCHEMA,
        status: 'webgpu-uploaded',
        particleCount: 8,
        stateBuffer: {},
        thermoBuffer: {}
      },
      mlsMpmParticleUpload: {
        schema: ULG_MLS_MPM_GPU_PARTICLE_BUFFER_SET_SCHEMA,
        sourceSchema: ULG_MLS_MPM_GPU_PARTICLE_BUFFER_SCHEMA,
        status: 'webgpu-uploaded',
        particleCount: 8,
        mechanicsBuffer: {}
      }
    },
    ...overrides
  };
}

test('resident GPU continuation accepts retained no-full-readback uploads', () => {
  assert.equal(
    residentGpuContinuationEvidenceReady(retainedGpuContinuationExecution()),
    true
  );
});

test('resident GPU continuation accepts compact conservation telemetry without a full particle readback', () => {
  assert.equal(
    residentGpuContinuationEvidenceReady(retainedGpuContinuationExecution({
      readbackMode: 'compact-grid-conservation-summary-readback',
      fullParticleReadbackPerformed: false,
      normalHotLoopReadbackFree: true
    })),
    true
  );
});

test('resident GPU continuation fails closed for full readback or incomplete retained uploads', () => {
  assert.equal(
    residentGpuContinuationEvidenceReady(retainedGpuContinuationExecution({
      readbackMode: 'compact-grid-conservation-summary-readback',
      fullParticleReadbackPerformed: true,
      normalHotLoopReadbackFree: false
    })),
    false
  );
  assert.equal(
    residentGpuContinuationEvidenceReady(retainedGpuContinuationExecution({
      nextParticleUploads: {
        sphParticleUpload: {
          schema: ULG_SPH_GPU_PARTICLE_BUFFER_SET_SCHEMA,
          sourceSchema: ULG_SPH_GPU_PARTICLE_BUFFER_SCHEMA,
          status: 'webgpu-uploaded',
          particleCount: 8,
          stateBuffer: {},
          thermoBuffer: {}
        },
        mlsMpmParticleUpload: {
          schema: ULG_MLS_MPM_GPU_PARTICLE_BUFFER_SET_SCHEMA,
          sourceSchema: ULG_MLS_MPM_GPU_PARTICLE_BUFFER_SCHEMA,
          status: 'webgpu-uploaded',
          particleCount: 8
        }
      }
    })),
    false
  );
});

test('resident GPU continuation rejects full readback claims while allowing compact telemetry', () => {
  assert.equal(
    residentGpuContinuationEvidenceReady(retainedGpuContinuationExecution({
      readbackMode: 'no-full-readback',
      fullParticleReadbackPerformed: true,
      normalHotLoopReadbackFree: false
    })),
    false
  );
  assert.equal(
    residentGpuContinuationEvidenceReady(retainedGpuContinuationExecution({
      readbackMode: 'no-full-readback',
      fullParticleReadbackPerformed: false,
      normalHotLoopReadbackFree: false
    })),
    true
  );
  assert.equal(
    residentGpuContinuationEvidenceReady(retainedGpuContinuationExecution({
      readbackMode: 'no-full-readback',
      finalStep: {
        readbackMode: 'full-parity-readback'
      }
    })),
    false
  );
});

test('resident GPU continuation rejects non-canonical execution and particle schemas', () => {
  assert.equal(
    residentGpuContinuationEvidenceReady(retainedGpuContinuationExecution({
      schema: 'peercompute.ulg.mls-mpm-gpu-resident-steps-execution.future'
    })),
    false
  );
  assert.equal(
    residentGpuContinuationEvidenceReady(retainedGpuContinuationExecution({
      nextSphParticleState: {
        schema: 'peercompute.ulg.sph-gpu-particle-state.v0'
      }
    })),
    false
  );
  assert.equal(
    residentGpuContinuationEvidenceReady(retainedGpuContinuationExecution({
      nextMlsMpmParticleState: {
        schema: 'peercompute.ulg.mls-mpm-gpu-particle-state.v0'
      }
    })),
    false
  );
});

test('resident GPU continuation rejects destroyed or count-mismatched uploads', () => {
  const destroyed = retainedGpuContinuationExecution();
  destroyed.nextParticleUploads.sphParticleUpload.destroyed = true;
  assert.equal(residentGpuContinuationEvidenceReady(destroyed), false);

  const destroyedBuffer = retainedGpuContinuationExecution();
  destroyedBuffer.nextParticleUploads.mlsMpmParticleUpload.mechanicsBuffer.destroyed = true;
  assert.equal(residentGpuContinuationEvidenceReady(destroyedBuffer), false);

  const mismatchedUpload = retainedGpuContinuationExecution();
  mismatchedUpload.nextParticleUploads.mlsMpmParticleUpload.particleCount = 7;
  assert.equal(residentGpuContinuationEvidenceReady(mismatchedUpload), false);

  const mismatchedState = retainedGpuContinuationExecution();
  mismatchedState.nextMlsMpmParticleState.particleCount = 9;
  assert.equal(residentGpuContinuationEvidenceReady(mismatchedState), false);
});

test('remote resident task-graph refresh prelude is disabled by default', async () => {
  let factoryCalled = false;
  const report = await runRemoteResidentTaskGraphRefreshPrelude({
    graphFactory: () => {
      factoryCalled = true;
      return { id: 'should-not-run' };
    },
    host: {
      async submitTaskGraphWithRemoteSeedHotBufferRefresh() {
        throw new Error('disabled path submitted unexpectedly');
      }
    }
  });

  assert.equal(report.schema, SPH_REMOTE_RESIDENT_TASK_GRAPH_REFRESH_SCHEMA);
  assert.equal(report.status, 'disabled');
  assert.equal(report.enabled, false);
  assert.equal(report.submitted, false);
  assert.equal(report.refreshed, false);
  assert.equal(factoryCalled, false);
});

test('remote resident task-graph refresh prelude submits through the authority host when enabled', async () => {
  const calls = [];
  const context = {
    signature: 'resident-signature',
    stepCount: 2,
    readbackMode: 'no-full-readback'
  };
  const host = {
    async submitTaskGraphWithRemoteSeedHotBufferRefresh(graph, options) {
      calls.push({ graph, options });
      return {
        schema: 'peercompute.ulg.remote-task-graph-submit-refresh-report.v0',
        status: 'task-graph-submitted-remote-seed-hot-buffer-refreshed',
        remoteTaskGraphCacheArtifactPreflight: {
          status: 'admitted'
        },
        hotBufferRefresh: {
          status: 'refreshed-local-hot-buffers',
          hotBufferKey: 'ulg:sph-demo:test-hot-buffer',
          localRefs: [
            { refId: 'ulg-sph-particle-state', byteLength: 128 },
            { refId: 'ulg-sph-particle-thermo', byteLength: 64 }
          ]
        },
        seedPolicy: {
          status: 'local-refresh-required',
          disallowedStateFamilies: []
        }
      };
    }
  };

  const report = await runRemoteResidentTaskGraphRefreshPrelude({
    enabled: true,
    host,
    context,
    graphFactory: (input) => ({
      schema: 'peercompute.compute.task-graph.v0',
      id: `graph:${input.signature}`,
      taskCount: input.stepCount
    }),
    refreshOptions: ({ graph }) => ({
      cacheKey: `cache:${graph.id}`,
      device: { label: 'fake-webgpu-device' }
    })
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].graph.id, 'graph:resident-signature');
  assert.equal(calls[0].options.cacheKey, 'cache:graph:resident-signature');
  assert.equal(report.schema, SPH_REMOTE_RESIDENT_TASK_GRAPH_REFRESH_SCHEMA);
  assert.equal(report.status, 'task-graph-submitted-remote-seed-hot-buffer-refreshed');
  assert.equal(report.enabled, true);
  assert.equal(report.submitted, true);
  assert.equal(report.refreshed, true);
  assert.equal(report.graphId, 'graph:resident-signature');
  assert.equal(report.remoteCacheArtifactStatus, 'admitted');
  assert.equal(report.hotBufferRefreshStatus, 'refreshed-local-hot-buffers');
  assert.equal(report.hotBufferKey, 'ulg:sph-demo:test-hot-buffer');
  assert.equal(report.localRefCount, 2);
  assert.deepEqual(report.blockedStateFamilies, []);
});

test('remote resident task-graph refresh prelude reports missing authority wrapper without submitting', async () => {
  const report = await runRemoteResidentTaskGraphRefreshPrelude({
    enabled: true,
    host: {},
    graph: {
      schema: 'peercompute.compute.task-graph.v0',
      id: 'graph:missing-host'
    }
  });

  assert.equal(report.schema, SPH_REMOTE_RESIDENT_TASK_GRAPH_REFRESH_SCHEMA);
  assert.equal(report.status, 'unavailable-host-method-missing');
  assert.equal(report.enabled, true);
  assert.equal(report.submitted, false);
  assert.equal(report.refreshed, false);
});

test('remote resident task-graph refresh prelude keeps local resident execution available after errors', async () => {
  const report = await runRemoteResidentTaskGraphRefreshPrelude({
    enabled: true,
    host: {
      async submitTaskGraphWithRemoteSeedHotBufferRefresh() {
        throw new Error('remote refresh unavailable');
      }
    },
    graph: {
      schema: 'peercompute.compute.task-graph.v0',
      id: 'graph:error'
    }
  });

  assert.equal(report.schema, SPH_REMOTE_RESIDENT_TASK_GRAPH_REFRESH_SCHEMA);
  assert.equal(report.status, 'error-local-resident-continued');
  assert.equal(report.enabled, true);
  assert.equal(report.submitted, false);
  assert.equal(report.refreshed, false);
  assert.match(report.error, /remote refresh unavailable/);
});

test('worker rebuild reset gate invalidates stale in-flight rebuild generations', () => {
  const gate = workerRebuildResetGate({
    currentGeneration: 7,
    activeTask: {
      generation: 7,
      status: 'submitted',
      rootTaskId: 'old-worker-task'
    },
    reason: 'reset-button',
    nowMs: 123.5
  });

  assert.equal(gate.generation, 8);
  assert.equal(gate.activeWorkerRebuildTask, null);
  assert.equal(gate.workerStatus.schema, SPH_PHASE_REBUILD_WORKER_STATUS_SCHEMA);
  assert.equal(gate.workerStatus.status, 'cancelled-by-reset');
  assert.equal(gate.workerStatus.cancelledGeneration, 7);
  assert.equal(gate.workerStatus.generation, 8);
  assert.equal(gate.workerStatus.reason, 'reset-button');
  assert.equal(gate.workerStatus.previousStatus, 'submitted');
  assert.equal(gate.workerStatus.updatedAtMs, 123.5);
  assert.notEqual(7, gate.generation);
});

test('resident stage-order execution summary preserves authority and active-grid evidence', () => {
  const execution = {
    schema: 'peercompute.ulg.mls-mpm-gpu-resident-steps-execution.v0',
    status: 'resident-steps-executed',
    backend: 'webgpu',
    readbackMode: 'no-full-readback',
    stepCount: 2,
    completedStepCount: 2,
    continuationAvailable: true,
    normalHotLoopReadbackFree: true,
    finalStep: {
      status: 'resident-step-webgpu-executed',
      backend: 'webgpu',
      readbackMode: 'no-full-readback',
      sequenceIndex: 1,
      stageStatus: {
        p2g: 'p2g-complete',
        gridUpdate: 'grid-update-complete',
        g2p: 'g2p-complete'
      },
      stageBackends: {
        p2g: 'webgpu',
        gridUpdate: 'webgpu',
        g2p: 'webgpu'
      },
      stageTiming: {
        schema: 'peercompute.ulg.mls-mpm-stage-timing.v0',
        totalMs: 4.5,
        stageMs: { p2g: 1.2, gridUpdate: 0.8, g2p: 1.5 },
        compactSummaryScope: 'particle-visual',
        activeGridDispatch: {
          useActiveGrid: true,
          activeNodeCount: 42,
          gridNodeScanCount: 256,
          dispatchWorkgroups: 1,
          maxSpeedMPerS: 0.25,
          safetyCells: 2
        }
      },
      diagnostics: {
        particleCount: 64,
        gridNodeCount: 256,
        activeGridNodeCount: 42,
        activeGridNodeCountAvailable: true,
        maxDisplacementM: 0.0125,
        maxSpeedMPerS: 0.25,
        pressureInterfaceForceRowCount: 3
      },
      residentAuthorityFamilyOwners: {
        'particle-kinematics': {
          ownerStage: 'g2p',
          status: 'authoritative',
          mutationMode: 'retained-gpu-buffer',
          backend: 'webgpu',
          reads: ['grid-velocity'],
          writes: ['particle-state'],
          nextConsumers: ['render-field']
        }
      },
      residentBufferLeaseLedgerStatus: 'resident-buffer-leases-valid',
      residentBufferLeaseResourceCount: 4,
      residentBufferLeaseActiveLeaseCount: 3,
      nextParticleBufferMode: 'retained-g2p-output-buffers',
      nextParticleStateBufferByteLength: 2048,
      nextParticleMechanicsBufferByteLength: 8192
    }
  };

  const summary = summarizeResidentStageOrderExecution(execution);

  assert.equal(summary.available, true);
  assert.deepEqual(summary.stageOrder, ['p2g', 'gridUpdate', 'g2p']);
  assert.equal(summary.activeGridDispatch.activeGridNodeCount, 42);
  assert.equal(summary.activeGridDispatch.activeNodeCount, 42);
  assert.equal(summary.activeGridDispatch.dispatchNodeCount, 42);
  assert.equal(summary.diagnostics.maxDisplacementM, 0.0125);
  assert.equal(summary.residentAuthorityFamilyOwners['particle-kinematics'].ownerStage, 'g2p');
  assert.equal(summary.residentBufferLeaseLedgerStatus, 'resident-buffer-leases-valid');
  assert.equal(summary.nextParticleBufferMode, 'retained-g2p-output-buffers');
});

test('resident stage-order trace is capped and stores compact execution summaries', () => {
  let trace = appendResidentStageOrderTrace(null, {
    status: 'resident-reset-invalidated',
    reason: 'reset-button',
    generation: 3,
    updatedAtMs: 10
  }, { maxEvents: 2 });
  trace = appendResidentStageOrderTrace(trace, {
    status: 'resident-reset-particle-state-resynced',
    generation: 4,
    stepCount: 125,
    updatedAtMs: 20
  }, { maxEvents: 2 });
  trace = appendResidentStageOrderTrace(trace, {
    status: 'resident-execution-complete',
    generation: 4,
    scheduleToken: 7,
    stepCount: 2,
    readbackMode: 'no-full-readback',
    execution: {
      schema: 'peercompute.ulg.mls-mpm-gpu-resident-steps-execution.v0',
      status: 'resident-steps-executed',
      backend: 'webgpu',
      readbackMode: 'no-full-readback',
      completedStepCount: 2,
      finalStep: {
        stageStatus: { p2g: 'ok', gridUpdate: 'ok', g2p: 'ok' },
        diagnostics: { activeGridNodeCount: 12, maxDisplacementM: 0.01 }
      }
    },
    updatedAtMs: 30
  }, { maxEvents: 2 });

  assert.equal(trace.schema, SPH_RESIDENT_STAGE_ORDER_TRACE_SCHEMA);
  assert.equal(trace.eventCount, 3);
  assert.equal(trace.retainedEventCount, 2);
  assert.equal(trace.events[0].status, 'resident-reset-particle-state-resynced');
  assert.equal(trace.lastEvent.status, 'resident-execution-complete');
  assert.equal(trace.lastEvent.executionSummary.backend, 'webgpu');
  assert.equal(trace.lastEvent.executionSummary.diagnostics.activeGridNodeCount, 12);
});
