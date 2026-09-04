import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as THREE from 'three';
import {
  SPH_DISPERSED_MEDIUM_OPTICAL_CLOSURE_ROW_LANES,
  SPH_DISPERSED_MEDIUM_OPTICAL_CLOSURE_STATUS,
  SPH_DISPERSED_MEDIUM_OPTICAL_MORPHOLOGY_MODEL,
  ULG_SPH_DISPERSED_MEDIUM_OPTICAL_CLOSURE_TABLE_SCHEMA
} from '../ulg-gpu-abi/src/index.js';
import { blackbodyColorSrgb } from '../src/runtime/material/radiationClosure.js';
import {
  applySphPresentationCanvasOwnership,
  SPH_PHASE_RENDER_MODE,
  SPH_PHASE_RENDER_ORDER,
  SPH_SCENE_BACKGROUND_COLOR_DEFAULT,
  SPH_SCENE_LIGHTING_MODE_DEFAULT,
  SPH_SCENE_LIGHTING_MODE_DARK_LAB,
  SPH_SCENE_LIGHTING_PROFILES,
  SPH_NATIVE_WEBGPU_BACKGROUND_WGSL,
  SPH_SCENE_MAX_DEVICE_PIXEL_RATIO,
  SPH_RESIDENT_SURFACE_DRAW_DEPTH_FORMAT,
  SPH_RESIDENT_SURFACE_REFRACTION_BACKFACE_DEPTH_FORMAT,
  SPH_RESIDENT_SURFACE_DRAW_COMPACT_POSITION_CAMERA_UNIFORM_BYTE_LENGTH,
  SPH_RESIDENT_SURFACE_DRAW_COMPACT_POSITION_WGSL,
  SPH_RESIDENT_SURFACE_DRAW_OVERLAY_WGSL,
  SPH_RESIDENT_SURFACE_DRAW_OVERLAY_MODE_DEFAULT,
  SPH_RESIDENT_SURFACE_DRAW_TEMPORAL_SWAP_POLICY,
  SPH_RESIDENT_RENDER_ROW_OVERLAY_WGSL,
  ULG_SPH_SCENE_SCHROEDER_PHASE_VOLUME_DIAGNOSTIC_STATUS_SCHEMA,
  ULG_SPH_SCENE_SCHROEDER_RENDER_SOURCE_SCHEMA,
  ULG_SPH_SCENE_SCHROEDER_RENDER_PROXY_DESCRIPTOR_PLAN_SCHEMA,
  ULG_SPH_SCENE_SCHROEDER_RENDER_PROXY_DESCRIPTOR_SCHEMA,
  ULG_SPH_SCENE_SCHROEDER_RENDER_PROXY_VISIBLE_CONSUMER_SCHEMA,
  ULG_SPH_SCENE_SCHROEDER_RENDER_PROXY_DRAW_SOURCE_SCHEMA,
  ULG_SPH_SCENE_SCHROEDER_RENDER_PROXY_BACKEND_SELECTION_SCHEMA,
  ULG_SPH_SCENE_SCHROEDER_RENDER_PROXY_NATIVE_EXECUTOR_SCHEMA,
  ULG_SPH_SCENE_SCHROEDER_SOURCE_KEY_REPLAY_DIAGNOSTICS_SCHEMA,
  SPH_SCHROEDER_RENDER_PROXY_NATIVE_WGSL,
  SPH_SCHROEDER_RENDER_PROXY_ACTIVE_NODE_FLOATS,
  SPH_SCHROEDER_RENDER_PROXY_AGGREGATE_NODE_FLOATS,
  SPH_SCHROEDER_RENDER_PROXY_NATIVE_CAMERA_FLOATS,
  SPH_SCHROEDER_RENDER_PROXY_NATIVE_BATCH_FLOATS,
  SPH_CPU_MARCHING_CUBES_RADIUS_FLOOR_CELLS,
  SPH_CPU_MARCHING_CUBES_RESOLUTION_MIN,
  SPH_SPARSE_RENDER_FIELD_RESOLUTION_MIN,
  SPH_SPARSE_SURFACE_RADIUS_SCALE_MAX_PARTICLES,
  SPH_SPARSE_SURFACE_RADIUS_SCALE_MIN,
  SPH_SURFACE_RADIUS_SCALE_DEFAULT,
  SPH_H2O_LIQUID_CONTINUITY_RADIUS_SCALE_MAX,
  SPH_GAS_CONTINUITY_RADIUS_SCALE_MAX,
  SPH_REACTION_PRODUCT_LIQUID_CONTINUITY_RADIUS_SCALE_MAX,
  SPH_NATIVE_MARCHING_CUBES_VERTEX_ROWS_BYTE_BUDGET_DEFAULT,
  createContinuousSurfaceBatches,
  createNativeWebGpuCanvasRenderer,
  createResidentMaterialSeedSurfaceBatches,
  resolveSphScenePixelRatio,
  resolveSphSceneViewportSize,
  resolveSphSceneCameraPose,
  cpuMarchingCubesCellSizeM,
  cpuMarchingCubesRadiusFloorM,
  createOpticalGpuLookupForSurfaceBatches,
  createOpticalGpuTableForSurfaceBatches,
  opticalPathLengthMForSurfaceBatch,
  createProductEventSurfaceBatches,
  createSchroederRenderSourceMetadata,
  validateSchroederRenderProxyFinalCommittedFamilyRefs,
  createSchroederRenderProxyDescriptorPlan,
  resolveSchroederRenderProxyVisibleConsumer,
  createSchroederRenderProxyDrawSource,
  resolveSchroederRenderProxyBackendSelection,
  createSchroederRenderProxyLocalRetainedBufferResolver,
  createSchroederRenderProxyNativeCameraUniformPayload,
  createSchroederRenderProxyNativeWebGpuExecutor,
  createResidentRenderSourceMetadata,
  createResidentGpuArtifactRetirementBarrier,
  resolveSchroederSceneHierarchyQueueOrderedTransfer,
  submitSchroederSceneTerminalCleanupBoundary,
  schroederRenderContinuationRequiresSourceFamily,
  resolveThreeWebGpuSurfaceBufferDrawRecords,
  buildSphResidentPressureInterfaceStateSummary,
  buildSchroederSourceKeyReplayDiagnostics,
  canonicalizeResidentRenderSurfaceBatchMaterials,
  hideRenderFieldSurfaceAfterGrace,
  materialPropertiesForSurfaceDescriptor,
  mergeSameMaterialPhaseSurfaceBatchesForRenderField,
  normalizeResidentSurfaceDrawOverlayMode,
  normalizeSphSceneBackgroundColorHex,
  normalizeSphSceneLightingMode,
  resolveSphSceneLightingProfile,
  emissiveAuthorityValueForSurface,
  nativeSurfaceBackgroundCoverScale,
  nativeSurfaceTemperatureDestroyMethodIsAuthenticated,
  nativeSurfaceTemperatureAttachmentIsRequired,
  normalizeSphRendererBackend,
  resolveThreeWebGpuPresentationPolicy,
  createThreeWebGpuExternalInterleavedBufferAttribute,
  createThreeWebGpuExternalIndirectBufferAttribute,
  resolveExtensionSurfaceRenderBridgePlan,
  resolveSphSurfaceDrawDiagnosticPresentationMode,
  resolveSphSurfaceDrawRefreshContinuityMode,
  resolveSphNativeSurfaceExtractionDeferralPolicy,
  resolveThreeWebGpuRendererRequiredLimits,
  resolveThreeWebGpuRendererOwnedResidentDevicePolicy,
  rendererOwnedCpuRenderRowsFallbackAllowed,
  resolveRenderFieldCpuParityDispersedMediumAdmission,
  resolveResidentExtensionSurfaceRendererCapability,
  resolveResidentSurfaceBufferHandoff,
  resolveResidentSurfaceVisibleGpuConsumer,
  resolveNativeSurfaceTemperatureRetirement,
  resolveSphNativeWebGpuSurfaceValidationCadence,
  resolveSchroederNativeSurfaceAdmissionMode,
  resolveSphSchroederHierarchyContactAdmission,
  resolveSphWorkerLanePolicyAdmission,
  summarizeThreeWebGpuDeviceLimits,
  buildSchroederPressureInterfaceGasCellFieldImportPublicationFromResidentExecution,
  buildResidentCollectiveOpticalRouteDescriptorSet,
  selectSchroederPressureInterfaceGasCellFieldImportFromResidentExecution,
  inspectExactSphSpatialGasPressureAuthorityImport,
  pressureInterfaceGasCellFieldImportReadyForScene,
  publishScenePressureInterfaceGasCellFieldImportSource,
  submitSceneSpatialGasLedgerProducerStageForPressureInterface,
  submitSceneGasCellEosProducerStageForPressureInterface,
  residentSurfaceBatchIdentitySignature,
  residentSurfaceBatchOpticalSignature,
  opticalGpuTableBindingLayoutSignature,
  opticalGpuTableBufferContentsEqual,
  canReuseSphNativeSurfaceDrawRenderBridge,
  residentRenderGasPressureSummary,
  residentRenderFieldReadbackModeForSurfaceOverlay,
  selectPressureInterfaceGridForceAdmissionForExecutionMode,
  resolveResidentSurfaceDrawOverlayPolicy,
  renderAlphaFromOpticalResponse,
  renderDepthWriteFromOpticalResponse,
  hasAdmittedClosureRefraction,
  renderLayerFromOpticalResponse,
  renderOrderFromOpticalResponse,
  resolveSphSurfaceRendererMaterialPolicy,
  resolveResidentRenderRowBridgeReadbackPlan,
  resolveRenderRowSphereBridgeContract,
  applyResidentRenderSourceMetadata,
  normalizeSurfaceRadiusForRenderField,
  renderDescriptorForSurfaceRecord,
  residentSurfaceDrawOrder,
  residentSurfaceDrawPipelineKey,
  resolveRenderFieldSurfaceVisibility,
  resolveOpticalSurfaceVisibility,
  closureDerivedSurfaceOpticalPresentation,
  collectiveOpticalDepthIsosurfacePresentation,
  shouldRetainResidentSurfaceDrawOverlay,
  createSphPhaseScene,
  SPH_SURFACE_INACTIVE_GRACE_FRAMES,
  surfaceRadiusScaleForRenderBatch,
  resolveRenderFieldParticleRadiusPolicy,
  renderFieldBatchNeedsAliasSafeResolution,
  applyResidentWaterVaporOpticalStateToSurfaceBatches,
  surfaceRadiusMetersFromRenderFieldRadius,
  surfaceObjectRenderOrder,
  stableSurfaceRenderOrder,
  stabilizeRenderRowSphereBridgeMaterial,
  summarizeRenderRowSphereBridgeMaterial,
  createSchroederPhaseVolumeAssignmentOverlayFeedbackCacheEntry,
  summarizeSchroederPhaseVolumeAssignmentOverlayFeedback,
  summarizeSchroederPhaseVolumeDiagnosticStatus,
  stabilizeSurfaceMeshMaterialForRenderer,
  createThreeWebGpuResidentBridgeMaterialProxy,
  estimateNativeMarchingCubesVertexRowsByteLengthForResolution,
  nativeMarchingCubesRenderFieldResolutionForVertexRowsBudget,
  nativeMarchingCubesVertexRowsBudgetPerSurface,
  packedNormalRowsCoverCompactPositionPrefix,
  resolveSphSceneThermalStepOptions,
  workerResidentParticleStateProducerColorRows,
  workerResidentParticleStateProducerSourceCacheDescriptor
} from '../src/visualization/sphPhaseScene.js';
import {
  collectiveOpticalRouteDescriptor
} from '../src/runtime/sph/sphOpticalRouteIdentity.js';
import {
  buildSphRenderFieldSurfaceTable
} from '../src/runtime/sph/sphRenderGpuKernel.js';
import {
  createQueueOrderedCleanupClaimIssuer,
  registerQueueOrderedCleanupClaim,
  releaseSubmittedWorkCleanupQueueOrdered,
  sealQueueOrderedFinalConsumerCapability,
  submitQueueOrderedWork
} from '../src/runtime/webgpuComputeLayout.js';

test('renderer-owned CPU row fallback refuses to discard resident dispersed optics', () => {
  assert.equal(rendererOwnedCpuRenderRowsFallbackAllowed({
    rendererOwnedDevice: true,
    readbackMode: 'full-parity-readback',
    sphParticleUpload: {}
  }), true);
  assert.equal(rendererOwnedCpuRenderRowsFallbackAllowed({
    rendererOwnedDevice: true,
    readbackMode: 'full-parity-readback',
    sphParticleUpload: { dispersedMediumOptics: {} }
  }), false);
  assert.equal(rendererOwnedCpuRenderRowsFallbackAllowed({
    rendererOwnedDevice: true,
    readbackMode: 'no-full-readback',
    sphParticleUpload: {}
  }), false);
});

test('render-field CPU parity reports resident dispersed optics unavailable without an exact host snapshot', () => {
  const unavailable = resolveRenderFieldCpuParityDispersedMediumAdmission({
    dispersedMediumOptics: { status: 'resident' }
  });
  assert.equal(unavailable.ok, false);
  assert.equal(
    unavailable.status,
    'render-field-cpu-parity-unavailable-dispersed-medium'
  );

  const rows = new Float32Array(8);
  const unauthenticatedRows = resolveRenderFieldCpuParityDispersedMediumAdmission({
    dispersedMediumOptics: { status: 'resident' },
    dispersedMediumOpticsRows: rows
  });
  assert.equal(unauthenticatedRows.ok, false);

  const admitted = resolveRenderFieldCpuParityDispersedMediumAdmission({
    dispersedMediumOptics: { status: 'resident' },
    dispersedMediumOpticsRows: rows,
    dispersedMediumOpticsHostReadback: true
  });
  assert.equal(admitted.ok, true);
  assert.strictEqual(admitted.dispersedMediumOpticsRows, rows);
});

test('SS contact admission declares contact-off as the explicit contact-free bulk mode', () => {
  const contactFree = resolveSphSchroederHierarchyContactAdmission({
    schroederSimulation: true,
    contactSolver: false
  });
  assert.deepEqual(contactFree, {
    schema: 'peercompute.ulg.sph-schroeder-hierarchy-contact-admission.v0',
    status: 'schroeder-hierarchy-contact-free-admitted',
    hierarchyRequested: true,
    contactSolverRequested: false,
    admitted: true,
    mode: 'explicit-contact-free-bulk',
    reason: null
  });
  assert.equal(Object.isFrozen(contactFree), true);
  assert.equal(resolveSphSchroederHierarchyContactAdmission({
    schroederSimulation: true,
    contactSolver: true
  }).admitted, true);
});

test('explicit worker ownership fails closed when its producer is not ready', () => {
  const admission = resolveSphWorkerLanePolicyAdmission({
    workerOwnedResidentProducerRequested: true,
    workerOwnedResidentProducerReady: false
  });
  assert.deepEqual(admission, {
    requested: true,
    eligible: false,
    reason: 'worker-lane-not-ready',
    detail: 'mounted render-ownership policy does not declare workerOwnedResidentProducerReady'
  });
  assert.equal(Object.isFrozen(admission), true);
  assert.deepEqual(resolveSphWorkerLanePolicyAdmission({
    workerOwnedResidentProducerRequested: false,
    workerOwnedResidentProducerReady: false
  }), {
    requested: false,
    eligible: false,
    reason: 'worker-lane-not-requested',
    detail: 'render ownership request does not select the worker-owned resident producer'
  });
});

test('resident artifact queue-ordered retirement fences unauthorized cleanup', async () => {
  let resolveFence;
  const fence = new Promise((resolve) => {
    resolveFence = resolve;
  });
  let queueFenceCount = 0;
  let cleanupCount = 0;
  const device = {
    queue: {
      submit() {},
      onSubmittedWorkDone() {
        queueFenceCount += 1;
        return fence;
      }
    }
  };
  const unauthorized = new Error('stale retirement authority');
  unauthorized.code = 'ERR_QUEUE_ORDERED_CLEANUP_UNAUTHORIZED';
  const barrier = createResidentGpuArtifactRetirementBarrier({
    releaseQueueOrderedCleanup() {
      throw unauthorized;
    }
  });

  assert.equal(barrier.retire({
    device,
    submissionObserved: true,
    cleanup() {
      cleanupCount += 1;
    }
  }), true);
  assert.equal(queueFenceCount, 1);
  assert.equal(cleanupCount, 0);
  resolveFence();
  await fence;
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(cleanupCount, 1);

  queueFenceCount = 0;
  cleanupCount = 0;
  const defaultBarrier = createResidentGpuArtifactRetirementBarrier();
  assert.equal(defaultBarrier.retire({
    device,
    submissionObserved: true,
    cleanup() {
      cleanupCount += 1;
    }
  }), true);
  assert.equal(queueFenceCount, 1);
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(cleanupCount, 1);

  queueFenceCount = 0;
  cleanupCount = 0;
  const producerOutput = {};
  const exactCleanup = () => {
    cleanupCount += 1;
  };
  const issuer = createQueueOrderedCleanupClaimIssuer({
    producerFamily: 'test-scene-retirement'
  });
  const producerClaim = registerQueueOrderedCleanupClaim(
    issuer,
    device,
    { producerOutput, cleanup: exactCleanup }
  );
  const submissionReceipt = submitQueueOrderedWork(
    device,
    [{ label: 'test-scene-final-consumer' }]
  );
  const queueOrderedFinalConsumer =
    sealQueueOrderedFinalConsumerCapability(
      submissionReceipt,
      device,
      {
        finalConsumerOwner: producerOutput,
        producerClaims: [producerClaim]
      }
    );
  const authorized = createResidentGpuArtifactRetirementBarrier();
  assert.equal(authorized.retire({
    device,
    cleanup: exactCleanup,
    queueOrderedFinalConsumer,
    producerClaim,
    producerOutput,
    producerFamily: 'test-scene-retirement'
  }), true);
  assert.equal(queueFenceCount, 0);
  assert.equal(cleanupCount, 1);
});

test('scene hierarchy queue-order transfer authenticates paired and independent resident routes', () => {
  const priorClaim = { claim: 'paired-prior-step' };
  const priorStep = {
    schroederHierarchyArtifactTransferCleanupClaims: [priorClaim]
  };
  const currentCapability = { capability: 'paired-current-step' };
  const currentResult = {
    queueOrderedFinalConsumerCapability: currentCapability
  };
  const paired = resolveSchroederSceneHierarchyQueueOrderedTransfer({
    priorStep,
    currentResult,
    enableTwoLevelMechanics: true,
    enableMechanicsFieldPairV2: true,
    twoLevelMechanicsAuthority: 'authoritative',
    readbackMode: 'no-full-readback'
  });
  assert.equal(paired.exactResidentQueueOrderedRoute, true);
  assert.equal(paired.exactPairedCanonicalRoute, true);
  assert.deepEqual(
    paired.producerClaims,
    priorStep.schroederHierarchyArtifactTransferCleanupClaims
  );
  assert.equal(paired.finalConsumer, currentCapability);

  const independent = resolveSchroederSceneHierarchyQueueOrderedTransfer({
    priorStep,
    currentResult,
    enableTwoLevelMechanics: true,
    enableMechanicsFieldPairV2: false,
    twoLevelMechanicsAuthority: 'authoritative',
    readbackMode: 'no-full-readback'
  });
  assert.equal(independent.exactResidentQueueOrderedRoute, true);
  assert.equal(independent.exactPairedCanonicalRoute, false);
  assert.deepEqual(
    independent.producerClaims,
    priorStep.schroederHierarchyArtifactTransferCleanupClaims
  );
  assert.equal(independent.finalConsumer, currentCapability);
});

test('scene single-level queue-order transfer declines foreign diagnostic runners', () => {
  const production = resolveSchroederSceneHierarchyQueueOrderedTransfer({
    residentStepOptions: { summaryRunner: null },
    enableCanonicalSingleLevelQueueOrderedCleanup: true,
    readbackMode: 'no-full-readback'
  });
  assert.equal(production.exactCanonicalSingleLevelRoute, true);
  assert.equal(production.exactResidentQueueOrderedRoute, true);

  const capturedProduction = resolveSchroederSceneHierarchyQueueOrderedTransfer({
    residentStepOptions: {
      summaryRunner: null,
      spatialMechanicalProposalCapture: Object.freeze({})
    },
    enableCanonicalSingleLevelQueueOrderedCleanup: true,
    readbackMode: 'no-full-readback'
  });
  assert.equal(capturedProduction.exactCanonicalSingleLevelRoute, true);
  assert.equal(capturedProduction.exactResidentQueueOrderedRoute, true);

  const diagnostic = resolveSchroederSceneHierarchyQueueOrderedTransfer({
    residentStepOptions: {
      summaryRunner: null,
      spatialMechanicalProposalRunner() {}
    },
    enableCanonicalSingleLevelQueueOrderedCleanup: true,
    readbackMode: 'no-full-readback'
  });
  assert.equal(diagnostic.exactCanonicalSingleLevelRoute, false);
  assert.equal(diagnostic.exactResidentQueueOrderedRoute, false);
  assert.deepEqual(diagnostic.producerClaims, []);
});

test('scene prior cleanup capability survives a later-step failure and is not forwarded on retry', () => {
  const device = {
    queue: {
      submit() {},
      onSubmittedWorkDone() {
        throw new Error('exact retry fixture must not request a host fence');
      }
    }
  };
  const sceneOutput = {};
  const hierarchyOutput = {};
  const sceneCleanup = () => {};
  const hierarchyCleanup = () => {};
  const sceneIssuer = createQueueOrderedCleanupClaimIssuer({
    producerFamily: 'test-scene-failed-sequence'
  });
  const hierarchyIssuer = createQueueOrderedCleanupClaimIssuer({
    producerFamily: 'test-hierarchy-failed-sequence'
  });
  const sceneClaim = registerQueueOrderedCleanupClaim(
    sceneIssuer,
    device,
    { producerOutput: sceneOutput, cleanup: sceneCleanup }
  );
  const hierarchyClaim = registerQueueOrderedCleanupClaim(
    hierarchyIssuer,
    device,
    { producerOutput: hierarchyOutput, cleanup: hierarchyCleanup }
  );
  const priorStep = {
    schroederHierarchyArtifactTransferCleanupClaims: [hierarchyClaim]
  };
  const firstStepRoute =
    resolveSchroederSceneHierarchyQueueOrderedTransfer({
      priorStep,
      additionalProducerClaims: [sceneClaim],
      enableTwoLevelMechanics: true,
      enableMechanicsFieldPairV2: true,
      twoLevelMechanicsAuthority: 'authoritative',
      readbackMode: 'no-full-readback'
    });
  const cleanupRecord = {
    finalConsumer:
      submitSchroederSceneTerminalCleanupBoundary({
        device,
        commandBuffers: [{ label: 'first-current-hierarchy-submit' }],
        finalConsumerOwner: sceneOutput,
        producerClaims: firstStepRoute.producerClaims
      })
  };
  // A later sequence step fails. The next attempt observes the stored cap and
  // must not replay either already-sealed prior claim.
  const retryRoute =
    resolveSchroederSceneHierarchyQueueOrderedTransfer({
      priorStep: cleanupRecord.finalConsumer ? null : priorStep,
      additionalProducerClaims:
        cleanupRecord.finalConsumer ? [] : [sceneClaim],
      enableTwoLevelMechanics: true,
      enableMechanicsFieldPairV2: true,
      twoLevelMechanicsAuthority: 'authoritative',
      readbackMode: 'no-full-readback'
    });
  assert.deepEqual(retryRoute.producerClaims, []);
  assert.equal(retryRoute.finalConsumer, null);
  releaseSubmittedWorkCleanupQueueOrdered(
    device,
    sceneCleanup,
    {
      queueOrderedFinalConsumer: cleanupRecord.finalConsumer,
      producerClaim: sceneClaim,
      producerOutput: sceneOutput,
      producerFamily: 'test-scene-failed-sequence'
    }
  );
  releaseSubmittedWorkCleanupQueueOrdered(
    device,
    hierarchyCleanup,
    {
      queueOrderedFinalConsumer: cleanupRecord.finalConsumer,
      producerClaim: hierarchyClaim,
      producerOutput: hierarchyOutput,
      producerFamily: 'test-hierarchy-failed-sequence'
    }
  );
});

test('scene terminal cleanup seals two claim classes on one existing nonempty useful submit', () => {
  let submitCount = 0;
  let queueFenceCount = 0;
  const submitted = [];
  const device = {
    queue: {
      submit(commandBuffers) {
        submitCount += 1;
        submitted.push(commandBuffers);
      },
      onSubmittedWorkDone() {
        queueFenceCount += 1;
        return Promise.resolve();
      }
    }
  };
  const sceneOutput = {};
  const hierarchyOutput = {};
  let sceneCleanupCount = 0;
  let hierarchyCleanupCount = 0;
  const sceneCleanup = () => {
    sceneCleanupCount += 1;
  };
  const hierarchyCleanup = () => {
    hierarchyCleanupCount += 1;
  };
  const sceneIssuer = createQueueOrderedCleanupClaimIssuer({
    producerFamily: 'test-scene-resident-execution'
  });
  const hierarchyIssuer = createQueueOrderedCleanupClaimIssuer({
    producerFamily: 'test-scene-hierarchy-terminal'
  });
  const sceneClaim = registerQueueOrderedCleanupClaim(
    sceneIssuer,
    device,
    { producerOutput: sceneOutput, cleanup: sceneCleanup }
  );
  const hierarchyClaim = registerQueueOrderedCleanupClaim(
    hierarchyIssuer,
    device,
    {
      producerOutput: hierarchyOutput,
      cleanup: hierarchyCleanup
    }
  );
  const usefulCommandBuffer = {
    label: 'existing-scene-overlay-clear-command-buffer'
  };
  const capability = submitSchroederSceneTerminalCleanupBoundary({
    device,
    commandBuffers: [usefulCommandBuffer],
    finalConsumerOwner: sceneOutput,
    producerClaims: [sceneClaim, hierarchyClaim]
  });

  assert.equal(submitCount, 1);
  assert.equal(submitted[0].length, 1);
  assert.equal(submitted[0][0], usefulCommandBuffer);
  assert.equal(queueFenceCount, 0);
  releaseSubmittedWorkCleanupQueueOrdered(
    device,
    sceneCleanup,
    {
      queueOrderedFinalConsumer: capability,
      producerClaim: sceneClaim,
      producerOutput: sceneOutput,
      producerFamily: 'test-scene-resident-execution'
    }
  );
  releaseSubmittedWorkCleanupQueueOrdered(
    device,
    hierarchyCleanup,
    {
      queueOrderedFinalConsumer: capability,
      producerClaim: hierarchyClaim,
      producerOutput: hierarchyOutput,
      producerFamily: 'test-scene-hierarchy-terminal'
    }
  );
  assert.equal(sceneCleanupCount, 1);
  assert.equal(hierarchyCleanupCount, 1);
  assert.equal(queueFenceCount, 0);
  assert.throws(
    () => releaseSubmittedWorkCleanupQueueOrdered(
      device,
      hierarchyCleanup,
      {
        queueOrderedFinalConsumer: capability,
        producerClaim: hierarchyClaim,
        producerOutput: hierarchyOutput,
        producerFamily: 'test-scene-hierarchy-terminal'
      }
    ),
    { code: 'ERR_QUEUE_ORDERED_CLEANUP_UNAUTHORIZED' }
  );
  assert.equal(hierarchyCleanupCount, 1);
});

import {
  GPU_PHASE_IDS,
  OPTICAL_GPU_RECORD_LAYOUT,
  stableOpticalMaterialId
} from '../src/runtime/material/opticalGpuBuffers.js';
import {
  residentMotionDiagnostic,
  residentWorkerLaneNativeSurfacePresentationReady,
  resolveMountedWorkerPressureInterfaceGasCellImportDescriptor,
  summarizeMountedPressureInterfaceGasCellImport
} from '../src/visualization/sphPhaseDemoMount.js';
import { createMlsMpmGridSpec } from '../src/runtime/sph/sphGridGpuKernel.js';
import {
  ULG_PRESSURE_INTERFACE_GAS_CELL_FIELD_ADMISSION_SCHEMA,
  ULG_PRESSURE_INTERFACE_GAS_CELL_FIELD_IMPORT_SCHEMA,
  ULG_PRESSURE_INTERFACE_RETAINED_GAS_CELL_FIELD_SOURCE_SCHEMA
} from '../src/runtime/sph/sphMlsMpmGpuStep.js';
import {
  SCHROEDER_LEVEL_ASSIGNMENT_ROW_LAYOUT,
  ULG_SCHROEDER_FAR_AGGREGATE_GAS_CELL_IMPORT_EXECUTION_SCHEMA,
  ULG_SCHROEDER_PORTABLE_SUMMARY_SCHEMA,
  ULG_SCHROEDER_RENDER_LOD_SUMMARY_SCHEMA,
  ULG_SCHROEDER_PHASE_VOLUME_LEVEL_UPDATE_ASSIGNMENT_OVERLAY_SCHEMA,
  ULG_SCHROEDER_PHASE_VOLUME_DIAGNOSTIC_SUMMARY_EXECUTION_SCHEMA
} from '../ulg-gpu-abi/src/index.js';
import {
  abandonSphSpatialGasPressureAuthority,
  describeSphSpatialGasPressureAuthority,
  encodeSphSpatialGasPressureAuthority,
  markSphSpatialGasPressureAuthoritySubmitted,
  ULG_SPH_RETAINED_GAS_CELL_EOS_SOURCE_SCHEMA_V2,
  ULG_SPH_RETAINED_GAS_CELL_EOS_SOURCE_SCHEMA_V3,
  releaseSphSpatialGasLedgerEosAfterQueue,
  runSphSpatialGasLedgerEosRetainedWebGpu
} from '../src/runtime/sph/sphSpatialGasLedgerEosGpu.js';
import {
  releaseSchroederSpatialEpochGenerationAfterQueue,
  runSchroederSpatialEpochGenerationWebGpu
} from '../src/runtime/sph/schroederSpatialEpochGpu.js';
import {
  tagResidentProductMassDevice,
  tagWebGpuBufferDevice,
  webGpuDeviceId
} from '../src/runtime/sph/sphGpuDeviceIdentity.js';

function srgbToLinear(value) {
  const v = Math.max(0, Math.min(1, Number(value)));
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
}

test('SPH scene forwards ambient authority and rebrands explicit step overrides', () => {
  const scenarioAuthority = {
    schema: 'peercompute.ulg.sph-thermal-environment-authority.v0',
    status: 'thermal-environment-authority-ready',
    ambientTemperatureK: 241.25,
    source: 'scenario-gas-initial-temperature',
    sourceScenarioId: 'scene-test',
    defaultApplied: false,
    authoritative: true,
    scientificValidation: false,
    fullPhysicsValidation: false
  };
  const inherited = resolveSphSceneThermalStepOptions({
    ambientTemperatureK: 241.25,
    thermalEnvironmentAuthority: scenarioAuthority
  });
  assert.equal(inherited.ambientTemperatureK, 241.25);
  assert.equal(inherited.thermalEnvironmentAuthority.source, scenarioAuthority.source);
  assert.equal(inherited.thermalEnvironmentAuthority.inheritedAuthority, true);

  const overridden = resolveSphSceneThermalStepOptions({
    ambientTemperatureK: 241.25,
    thermalEnvironmentAuthority: scenarioAuthority,
    overrides: { ambientTemperatureK: 265.5 }
  });
  assert.equal(overridden.ambientTemperatureK, 265.5);
  assert.equal(
    overridden.thermalEnvironmentAuthority.source,
    'sph-phase-scene-step-override'
  );
  assert.equal(overridden.thermalEnvironmentAuthority.inheritedAuthority, false);
  assert.throws(
    () => resolveSphSceneThermalStepOptions({
      overrides: { ambientTemperatureK: Number.NaN }
    }),
    /ambientTemperatureK must be finite/
  );
});

test('SPH scene forwards fixed wall authority and makes adiabatic overrides first-class', () => {
  const fixedFaces = {
    xMin: 291,
    xMax: 292,
    yMin: 293,
    yMax: 294,
    zMin: 295,
    zMax: 296
  };
  const fixed = resolveSphSceneThermalStepOptions({
    wallTemperaturesK: fixedFaces
  });
  assert.deepEqual(fixed.wallTemperaturesK, fixedFaces);
  assert.equal(
    fixed.wallReservoirAuthority.model,
    'infinite-fixed-temperature-reservoir'
  );
  assert.equal(fixed.wallReservoirAuthority.exchangeEnabled, true);

  const adiabatic = resolveSphSceneThermalStepOptions({
    wallTemperaturesK: fixedFaces,
    wallReservoirAuthority: fixed.wallReservoirAuthority,
    overrides: { wallModel: 'adiabatic' }
  });
  assert.deepEqual(adiabatic.wallTemperaturesK, fixedFaces);
  assert.equal(adiabatic.wallReservoirAuthority.model, 'adiabatic');
  assert.equal(adiabatic.wallReservoirAuthority.exchangeEnabled, false);
  assert.equal(
    adiabatic.wallReservoirAuthority.source,
    'sph-phase-scene-step-override'
  );
  assert.throws(
    () => resolveSphSceneThermalStepOptions({
      overrides: {
        wallTemperaturesK: { xMin: Number.NaN }
      }
    }),
    /wallTemperaturesK.xMin must be finite/
  );
});

function opticalRecordField(table, record, fieldName) {
  const fieldIndex = (table.recordLayout || OPTICAL_GPU_RECORD_LAYOUT)
    .findIndex((entry) => String(entry).split(':')[0] === fieldName);
  assert.ok(fieldIndex >= 0, `missing optical record field ${fieldName}`);
  return table.records[(record.recordIndex * table.recordStrideFloats) + fieldIndex];
}

function schroederPortableSummaryFixture(overrides = {}) {
  const renderLod = {
    schema: ULG_SCHROEDER_RENDER_LOD_SUMMARY_SCHEMA,
    status: 'schroeder-render-lod-summary-planned',
    mode: 'active-node-leaf-and-aggregate-proxy-lod',
    selectedLevel: 2,
    nativeGridSpacingM: 0.25,
    activeLeafProxyCount: 12,
    aggregateProxyCount: 3,
    lawQueueProxyCount: 5,
    phaseVolumeDiagnosticRowsAvailable: true,
    geometryPolicy: 'active-leaf-spheres-and-coherent-aggregate-proxies',
    opticalPolicy: 'closure-derived-pbr-materials',
    fullParticleReadbackRequired: false,
    ...(overrides.renderLod || {})
  };
  return {
    schema: ULG_SCHROEDER_PORTABLE_SUMMARY_SCHEMA,
    status: 'schroeder-portable-summary-plan-ready',
    portableSummaryMode: 'portable-descriptors-not-raw-gpubuffers',
    transferMode: 'peercompute-portable-summary-descriptors',
    peerComputeUseCase: 'scene-render-source-test',
    retainedRefCount: 2,
    retainedBufferRefCount: 2,
    retainedRefs: [
      {
        role: 'activeNodes',
        family: 'schroeder-active-node-list',
        schema: 'peercompute.ulg.schroeder-active-node-list.v0',
        retainedBufferRef: 'active-node-list:test',
        retained: true,
        rowCount: 12,
        strideFloats: 16,
        byteLength: 12 * 16 * Float32Array.BYTES_PER_ELEMENT,
        transferMode: 'descriptor-only-no-raw-gpubuffer-transfer'
      },
      {
        role: 'aggregateNodes',
        family: 'schroeder-hierarchy-aggregate-node',
        schema: 'peercompute.ulg.schroeder-hierarchy-aggregate-node.v0',
        retainedBufferRef: 'aggregate-node:test',
        retained: true,
        rowCount: 3,
        strideFloats: 32,
        byteLength: 3 * 32 * Float32Array.BYTES_PER_ELEMENT,
        transferMode: 'descriptor-only-no-raw-gpubuffer-transfer'
      }
    ],
    renderLod,
    presentationAuthority: 'presentation-consumes-render-lod-summary-not-physics-state',
    stateAuthorityStatus: 'state-manager-admission-required-before-authoritative-remote-replay',
    fullParticleReadbackRequired: false,
    ...overrides
  };
}

function schroederFinalCommittedProxyRefFixture() {
  const successorEpochIdentity = Object.freeze({
    storageGeneration: 71,
    physicsTick: 41,
    physicsSubstep: 2,
    positionEpoch: 43,
    topologyEpoch: 11,
    chartEpoch: 7,
    levelEpoch: 19,
    supportEpoch: 23
  });
  const sourceFamily = Object.freeze({
    schema: 'peercompute.ulg.schroeder-spatial-successor-source-family.v0',
    status: 'schroeder-committed-successor-source-family-authenticated',
    ready: true,
    authenticated: true,
    sourceFamilyRole: 'committed-successor-x-n-plus-1',
    sourceGenerationId: 37,
    deviceId: 'renderer-test-device-a',
    successorEpochIdentity,
    positionAuthority: 'same-epoch-final-continuation-particle-state'
  });
  const retainedRefs = schroederPortableSummaryFixture().retainedRefs.map((ref) => ({
    ...ref,
    sourceFamily,
    sourceFamilyRole: sourceFamily.sourceFamilyRole,
    sourceFamilyStatus: sourceFamily.status,
    sourceDeviceId: sourceFamily.deviceId,
    sourceGenerationId: sourceFamily.sourceGenerationId,
    sourceEpochIdentity: sourceFamily.successorEpochIdentity,
    positionAuthority: sourceFamily.positionAuthority,
    finalContinuationAuthority: true
  }));
  return { sourceFamily, retainedRefs };
}

function createSchroederNativeProxyFixture() {
  const portableSummary = schroederPortableSummaryFixture();
  const admission = {
    schema: 'peercompute.ulg.schroeder-portable-summary-admission.v0',
    status: 'schroeder-portable-summary-admission-published',
    scope: 'ulg-schroeder-portable-summary-admissions',
    stateKey: 'schroeder-summary:test-state',
    cacheKey: 'schroeder-summary:test-cache',
    hotBufferKey: 'schroeder-summary:test-hot',
    portableSummary,
    renderLod: portableSummary.renderLod
  };
  const renderSource = createSchroederRenderSourceMetadata({
    residentExecution: {
      schema: 'peercompute.ulg.mls-mpm-gpu-resident-steps-execution.v0',
      status: 'resident-steps-executed',
      portableSummary
    },
    schroederPortableSummaryAdmission: admission,
    source: 'resident-step-publication'
  });
  const proxyPlan = createSchroederRenderProxyDescriptorPlan({
    schroederRenderSource: renderSource
  });
  const proxyConsumer = resolveSchroederRenderProxyVisibleConsumer({
    proxyDescriptorPlan: proxyPlan
  });
  const drawSource = createSchroederRenderProxyDrawSource({
    proxyDescriptorPlan: proxyPlan,
    visibleConsumer: proxyConsumer
  });
  const nativeBackend = resolveSchroederRenderProxyBackendSelection({
    drawSource,
    rendererCapability: {
      schema: 'peercompute.ulg.sph-extension-surface-renderer-capability.v0',
      status: 'native-webgpu-surface-consumer-supported',
      rendererBackend: 'native-webgpu',
      visibleNoReadbackSupported: true,
      nativeSurfaceConsumerPixelValidationStatus: 'passed',
      nativeSurfaceConsumerPixelValidationSource:
        'playwright-composited-frame',
      nativeSurfaceConsumerPixelValidationNonzeroPixelCount: 64,
      nativeSurfaceConsumerPixelValidationResourceGeneration: 7,
      nativeSurfaceConsumerActiveResourceGeneration: 7
    },
    renderBridgeMode: 'native-webgpu-surface-consumer',
    renderBridgeStatus: 'native-webgpu-surface-consumer-ready',
    pixelValidationStatus: 'passed'
  });
  return { drawSource, nativeBackend, portableSummary, proxyPlan, proxyConsumer };
}

function createFakeSchroederProxyRenderDevice() {
  const calls = {
    shaderModules: [],
    bindGroupLayouts: [],
    pipelineLayouts: [],
    pipelines: [],
    buffers: [],
    bindGroups: [],
    writes: []
  };
  const device = {
    queue: {
      writeBuffer(buffer, offset, data) {
        calls.writes.push({
          buffer,
          offset,
          data: Array.from(data || [])
        });
      }
    },
    createShaderModule(desc) {
      const result = { type: 'shaderModule', ...desc };
      calls.shaderModules.push(result);
      return result;
    },
    createBindGroupLayout(desc) {
      const result = { type: 'bindGroupLayout', ...desc };
      calls.bindGroupLayouts.push(result);
      return result;
    },
    createPipelineLayout(desc) {
      const result = { type: 'pipelineLayout', ...desc };
      calls.pipelineLayouts.push(result);
      return result;
    },
    createRenderPipeline(desc) {
      const result = { type: 'renderPipeline', ...desc };
      calls.pipelines.push(result);
      return result;
    },
    createBuffer(desc) {
      const result = {
        type: 'buffer',
        ...desc,
        destroyCount: 0,
        destroy() {
          this.destroyCount += 1;
        }
      };
      calls.buffers.push(result);
      return result;
    },
    createBindGroup(desc) {
      const result = { type: 'bindGroup', ...desc };
      calls.bindGroups.push(result);
      return result;
    }
  };
  return { device, calls };
}

test('SPH scene background color defaults to dark navy and normalizes URL hex values', () => {
  // Matches the native WebGPU surface consumer clear so the default look is
  // consistent across renderer backends (was sky blue in the CPU/webgl era).
  assert.equal(SPH_SCENE_BACKGROUND_COLOR_DEFAULT, '#18222b');
  assert.equal(normalizeSphSceneBackgroundColorHex(null), '#18222b');
  assert.equal(normalizeSphSceneBackgroundColorHex('87CEEB'), '#87ceeb');
  assert.equal(normalizeSphSceneBackgroundColorHex('#8ce'), '#88ccee');
  assert.equal(normalizeSphSceneBackgroundColorHex('not-a-color', '#123456'), '#123456');
});

test('SPH scene camera pose fits normalized compositions to the full box without changing legacy scenes', () => {
  const legacy = resolveSphSceneCameraPose({ boxDimsM: [3, 3, 3] });
  assert.equal(legacy.status, 'legacy-whole-box-camera');
  assert.deepEqual(legacy.positionM.map((entry) => Number(entry.toFixed(2))), [4.05, 3.15, 4.95]);
  assert.deepEqual(legacy.targetM, [1.5, 1.5, 1.5]);
  assert.equal(legacy.positionNormalized, null);
  assert.equal(legacy.targetNormalized, null);

  const contactBand = resolveSphSceneCameraPose({
    boxDimsM: [3, 3, 3],
    positionNormalized: '0.78,0.31,1.55',
    targetNormalized: '0.50,0.31,0.50',
    fovYDegrees: 46,
    aspect: 16 / 9
  });
  assert.match(contactBand.status, /^box-normalized-camera(?:-fitted)?$/);
  assert.deepEqual(contactBand.targetM.map((entry) => Number(entry.toFixed(2))), [1.5, 0.93, 1.5]);
  assert.deepEqual(contactBand.positionNormalized, [0.78, 0.31, 1.55]);
  assert.deepEqual(contactBand.targetNormalized, [0.5, 0.31, 0.5]);
  assert.equal(contactBand.fitPolicy, 'eight-corner-fov-aspect-domain-fit');
  assert.ok(contactBand.fittedDistanceM >= contactBand.desiredDistanceM);

  const assertBoxFits = ({ boxDimsM, aspect }) => {
    const pose = resolveSphSceneCameraPose({
      boxDimsM,
      positionNormalized: [0.8, 0.45, 1.6],
      targetNormalized: [0.5, 0.3, 0.5],
      fovYDegrees: 46,
      aspect,
      fitMargin: 1.08
    });
    const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
    const tanY = Math.tan((pose.fovYDegrees * Math.PI / 180) / 2);
    const tanX = tanY * pose.aspect;
    for (const x of [0, boxDimsM[0]]) {
      for (const y of [0, boxDimsM[1]]) {
        for (const z of [0, boxDimsM[2]]) {
          const relative = [
            x - pose.targetM[0],
            y - pose.targetM[1],
            z - pose.targetM[2]
          ];
          const depth = pose.fittedDistanceM + dot(relative, pose.viewForward);
          assert.ok(depth > 0);
          assert.ok(Math.abs(dot(relative, pose.viewRight)) / (depth * tanX) <= 1 / pose.fitMargin + 1e-12);
          assert.ok(Math.abs(dot(relative, pose.viewUp)) / (depth * tanY) <= 1 / pose.fitMargin + 1e-12);
        }
      }
    }
  };
  assertBoxFits({ boxDimsM: [12, 12, 12], aspect: 1536 / 900 });
  assertBoxFits({ boxDimsM: [3, 7, 11], aspect: 9 / 16 });
  assert.equal(resolveSphSceneCameraPose({
    boxDimsM: [3, 3, 3],
    positionNormalized: '0.5,0.5,0.5',
    targetNormalized: '0.5,0.5,0.5'
  }).status, 'legacy-whole-box-camera');
  assert.equal(resolveSphSceneCameraPose({
    boxDimsM: [3, 3, 3],
    positionNormalized: 'not,a,pose',
    targetNormalized: '0.5,0.5,0.5'
  }).status, 'legacy-whole-box-camera');
});

test('SPH presentation ownership removes stale native pixels only for a visible worker frame', () => {
  const attributes = new Map();
  const mainCanvas = {
    style: { opacity: '1', pointerEvents: 'auto' },
    setAttribute(name, value) {
      attributes.set(name, value);
    }
  };

  const worker = applySphPresentationCanvasOwnership({
    mainCanvas,
    workerCanvasVisible: true
  });
  assert.equal(worker.status, 'presentation-worker-canvas-exclusively-composited');
  assert.equal(worker.mainCanvasComposited, false);
  assert.equal(mainCanvas.style.opacity, '0');
  assert.equal(mainCanvas.style.pointerEvents, 'auto');
  assert.equal(attributes.get('data-ulg-presentation-compositor-owner'), 'worker');

  const native = applySphPresentationCanvasOwnership({
    mainCanvas,
    workerCanvasVisible: false
  });
  assert.equal(native.status, 'presentation-main-native-canvas-composited');
  assert.equal(native.mainCanvasComposited, true);
  assert.equal(mainCanvas.style.opacity, '1');
  assert.equal(attributes.get('data-ulg-presentation-compositor-owner'), 'main-native');
});

test('SPH scene dark-lab lighting suppresses incident light while preserving emission', () => {
  assert.equal(SPH_SCENE_LIGHTING_MODE_DEFAULT, 'normal');
  assert.equal(SPH_SCENE_LIGHTING_MODE_DARK_LAB, 'dark-lab');
  assert.equal(normalizeSphSceneLightingMode(null), 'normal');
  assert.equal(normalizeSphSceneLightingMode('dark'), 'dark-lab');
  assert.equal(normalizeSphSceneLightingMode('dark_lab'), 'dark-lab');
  assert.equal(normalizeSphSceneLightingMode('normal', 'dark-lab'), 'normal');
  assert.equal(normalizeSphSceneLightingMode('unknown'), 'normal');

  assert.deepEqual(resolveSphSceneLightingProfile('normal'), SPH_SCENE_LIGHTING_PROFILES.normal);
  assert.deepEqual(resolveSphSceneLightingProfile('dark-lab'), SPH_SCENE_LIGHTING_PROFILES['dark-lab']);
  assert.deepEqual(SPH_SCENE_LIGHTING_PROFILES.normal, {
    mode: 'normal',
    ambientIntensity: 1.4,
    hemisphereIntensity: 0.9,
    keyIntensity: 1.1,
    fillIntensity: 0.5,
    environmentIntensity: 1,
    nativeAmbientSuppression: 0,
    nativeDirectSuppression: 0,
    nativeEnvironmentSuppression: 0,
    containerWireOpacity: 0.6,
    containerGridOpacity: 1,
    nativeContainerWireOpacity: 0.42
  });
  assert.deepEqual(SPH_SCENE_LIGHTING_PROFILES['dark-lab'], {
    mode: 'dark-lab',
    ambientIntensity: 0.03,
    hemisphereIntensity: 0,
    keyIntensity: 0,
    fillIntensity: 0,
    environmentIntensity: 0,
    nativeAmbientSuppression: 1,
    nativeDirectSuppression: 1,
    nativeEnvironmentSuppression: 1,
    containerWireOpacity: 0.1,
    containerGridOpacity: 0.06,
    nativeContainerWireOpacity: 0.08
  });

  // The compact camera ABI remains 320 bytes; its retired padding slots now
  // carry zero-valued suppressions in the normal profile.
  assert.equal(SPH_RESIDENT_SURFACE_DRAW_COMPACT_POSITION_CAMERA_UNIFORM_BYTE_LENGTH, 320);
  assert.match(SPH_RESIDENT_SURFACE_DRAW_COMPACT_POSITION_WGSL, /ambient_light_suppression: f32/);
  assert.match(SPH_RESIDENT_SURFACE_DRAW_COMPACT_POSITION_WGSL, /direct_light_suppression: f32/);
  assert.match(SPH_RESIDENT_SURFACE_DRAW_COMPACT_POSITION_WGSL, /environment_light_suppression: f32/);
  assert.match(SPH_RESIDENT_SURFACE_DRAW_COMPACT_POSITION_WGSL, /return mix\(1\.4, 0\.03, suppression\)/);
  assert.match(SPH_RESIDENT_SURFACE_DRAW_COMPACT_POSITION_WGSL, /1\.0 - clamp\(camera_data\.direct_light_suppression/);
  assert.match(SPH_RESIDENT_SURFACE_DRAW_COMPACT_POSITION_WGSL, /1\.0 - clamp\(camera_data\.environment_light_suppression/);
  assert.match(SPH_RESIDENT_SURFACE_DRAW_OVERLAY_WGSL, /fn resident_ambient_irradiance\(\) -> f32 \{\s*return 1\.4;/);
  assert.match(SPH_RESIDENT_SURFACE_DRAW_OVERLAY_WGSL, /var lit = diffuse \+ specular \+ env_specular[\s\S]*\+ emissive;/);
  assert.doesNotMatch(SPH_RESIDENT_SURFACE_DRAW_OVERLAY_WGSL, /emissive\s*\*\s*(?:ambient|direct|environment)/);
});

test('native WebGPU background image uses opaque cover rendering and an exact staged MRT variant', () => {
  assert.deepEqual(nativeSurfaceBackgroundCoverScale({
    imageWidth: 200,
    imageHeight: 100,
    canvasWidth: 100,
    canvasHeight: 100
  }), [0.5, 1]);
  assert.deepEqual(nativeSurfaceBackgroundCoverScale({
    imageWidth: 100,
    imageHeight: 200,
    canvasWidth: 200,
    canvasHeight: 100
  }), [1, 0.25]);
  assert.match(SPH_NATIVE_WEBGPU_BACKGROUND_WGSL, /textureSample\(background_image/);
  assert.match(SPH_NATIVE_WEBGPU_BACKGROUND_WGSL, /vec4<f32>\([^;]*, 1\.0\)/);
  assert.match(
    SPH_NATIVE_WEBGPU_BACKGROUND_WGSL,
    /struct BackgroundMrtOutput[\s\S]*?@location\(0\) base:[\s\S]*?@location\(1\) composite:[\s\S]*?fn fs_staged_mrt_main[\s\S]*?output\.base = color;[\s\S]*?output\.composite = color;/,
    'the private proof path must initialize baseline and composite from one sampled background color'
  );
});

test('SPH scene summarizes Schroeder phase-volume diagnostics for visible water-to-steam status', () => {
  const row = new Array(32).fill(0);
  row[0] = 12; // migrationRowCount
  row[1] = 3; // activeUpdateCount
  row[2] = 2; // coarsenEligibleCount
  row[3] = 1; // refineRequiredCount
  row[4] = 3; // aggregateCoherentCount
  row[5] = 0; // conservationResidualIssueCount
  row[6] = 1; // minSourceLevelId
  row[7] = 2; // maxSourceLevelId
  row[8] = 4; // minTargetLevelId
  row[9] = 5; // maxTargetLevelId
  row[10] = 3; // maxPositiveLevelDelta
  row[11] = -1; // maxNegativeLevelDelta
  row[12] = 1; // totalRestVolumeM3
  row[13] = 700; // totalRepresentedVolumeM3
  row[14] = 0.1; // totalAggregateMassKg
  row[15] = 700; // totalAggregateRepresentedVolumeM3
  row[18] = 2; // steamExpansionCandidateCount
  row[19] = 3; // admittedUpdateCount
  row[21] = 2; // visibleMigrationCount
  row[23] = 2; // levelChangedCount
  row[24] = 1; // summaryModeId
  row[25] = 9; // migrationEpoch
  row[26] = 1; // status
  row[28] = 1; // stateFamilyId

  const status = summarizeSchroederPhaseVolumeDiagnosticStatus({
    schema: 'peercompute.ulg.mls-mpm-gpu-resident-steps-execution.v0',
    status: 'resident-steps-executed',
    finalStep: {
      schema: 'peercompute.ulg.schroeder-same-level-mechanics-execution.v0',
      status: 'schroeder-same-level-mechanics-submitted',
      selectedLevel: 2,
      particleCount: 12,
      phaseVolumeMigrationStatus: 'schroeder-phase-volume-migration-submitted',
      phaseVolumeLevelUpdateStatus: 'schroeder-phase-volume-level-update-submitted',
      phaseVolumeDiagnosticSummaryStatus: 'schroeder-phase-volume-diagnostic-summary-submitted',
      phaseVolumeMigration: {
        particleCount: 12
      },
      phaseVolumeLevelUpdate: {
        status: 'schroeder-phase-volume-level-update-submitted',
        retainedLevelUpdateBuffer: true
      },
      phaseVolumeDiagnosticSummary: {
        schema: ULG_SCHROEDER_PHASE_VOLUME_DIAGNOSTIC_SUMMARY_EXECUTION_SCHEMA,
        status: 'schroeder-phase-volume-diagnostic-summary-submitted',
        visibleStressCaseStatus: 'water-to-steam-level-migration-diagnostics-submitted',
        compactSummaryReadbackPerformed: true,
        fullReadbackPerformed: false,
        fullParticleReadbackPerformed: false,
        summaryRowCount: 1,
        summaryStrideFloats: 32,
        summaryRows: row
      }
    }
  });

  assert.equal(status.schema, ULG_SPH_SCENE_SCHROEDER_PHASE_VOLUME_DIAGNOSTIC_STATUS_SCHEMA);
  assert.equal(status.status, 'schroeder-phase-volume-visible-diagnostics-ready');
  assert.equal(status.phaseVolumeDiagnosticSummaryStatus, 'schroeder-phase-volume-diagnostic-summary-submitted');
  assert.equal(status.phaseVolumeMigrationStatus, 'schroeder-phase-volume-migration-submitted');
  assert.equal(status.phaseVolumeLevelUpdateStatus, 'schroeder-phase-volume-level-update-submitted');
  assert.equal(status.selectedLevel, 2);
  assert.equal(status.nativeLevelSource, 'state-manager-admitted-phase-volume-level-update');
  assert.equal(status.phaseVolumeLevelUpdateConsumed, true);
  assert.equal(status.phaseVolumeLevelUpdateRetainedBuffer, true);
  assert.equal(status.noFullParticleReadback, true);
  assert.equal(status.migrationRowCount, 12);
  assert.equal(status.sourceParticleCount, 12);
  assert.equal(status.particleCountGrowthFactor, 1);
  assert.equal(status.activeUpdateCount, 3);
  assert.equal(status.coarsenEligibleCount, 2);
  assert.equal(status.refineRequiredCount, 1);
  assert.equal(status.steamExpansionCandidateCount, 2);
  assert.equal(status.admittedUpdateCount, 3);
  assert.equal(status.visibleMigrationCount, 2);
  assert.equal(status.levelChangedCount, 2);
  assert.equal(status.minSourceLevelId, 1);
  assert.equal(status.maxTargetLevelId, 5);
  assert.equal(status.totalRepresentedVolumeM3, 700);
  assert.equal(status.representedToRestVolumeRatio, 700);
  assert.ok(Math.abs(status.representedRadiusScale - Math.cbrt(700)) < 1e-12);
  assert.ok(Math.abs(status.expectedLevelDeltaFromVolume - Math.log2(Math.cbrt(700))) < 1e-12);
  assert.equal(status.expectedPositiveLevelDelta, true);
  assert.equal(status.observedPositiveLevelDelta, 3);
  assert.equal(status.observedPositiveLevelUpdateDelta, true);
  assert.equal(status.phaseVolumeLevelUpdateChanged, true);
  assert.equal(status.phaseVolumeExpansionDetected, true);
  assert.equal(status.phaseVolumeUpdateEffectStatus, 'admitted-phase-volume-level-update-changed-level');
  assert.ok(status.expectedObservedLevelDeltaAgreement < 0.2);
  assert.equal(status.waterToSteamScaleMigrationObserved, true);
  assert.equal(status.waterToSteamStressCaseStatus, 'water-to-steam-level-migration-observable');
  assert.equal(
    status.particleExplosionAvoidanceStatus,
    'phase-volume-level-migration-represented-without-particle-count-growth'
  );
  assert.equal(status.particleCountGrowthStatus, 'particle-count-stable-or-reduced');
  assert.equal(status.fullPhysicsValidation, false);
});

test('SPH scene reads Schroeder phase-volume diagnostics from compact resident mechanics', () => {
  const row = new Float32Array(32);
  row[0] = 8; // migrationRowCount
  row[1] = 8; // activeUpdateCount
  row[10] = 3; // maxPositiveLevelDelta
  row[12] = 1; // totalRestVolumeM3
  row[13] = 700; // totalRepresentedVolumeM3
  row[18] = 8; // steamExpansionCandidateCount
  row[21] = 8; // visibleMigrationCount
  row[23] = 8; // levelChangedCount

  const status = summarizeSchroederPhaseVolumeDiagnosticStatus({
    schema: 'peercompute.ulg.mls-mpm-gpu-resident-steps-execution.v0',
    status: 'resident-steps-executed',
    schroederSimulation: true,
    finalStep: {
      schema: 'peercompute.ulg.mls-mpm-gpu-resident-step-execution.v0',
      status: 'resident-step-submitted',
      schroederSameLevelMechanics: {
        schema: 'peercompute.ulg.schroeder-same-level-mechanics-execution.v0',
        status: 'schroeder-same-level-mechanics-submitted',
        selectedLevel: 0,
        phaseVolumeMigrationStatus: 'schroeder-phase-volume-migration-submitted',
        phaseVolumeMigrationParticleCount: 8,
        phaseVolumeLevelUpdateStatus: 'schroeder-phase-volume-level-update-submitted',
        phaseVolumeLevelUpdateRetainedBuffer: true,
        phaseVolumeDiagnosticSummaryStatus:
          'schroeder-phase-volume-diagnostic-summary-submitted',
        phaseVolumeDiagnosticSummary: {
          schema: ULG_SCHROEDER_PHASE_VOLUME_DIAGNOSTIC_SUMMARY_EXECUTION_SCHEMA,
          status: 'schroeder-phase-volume-diagnostic-summary-submitted',
          visibleStressCaseStatus: 'water-to-steam-level-migration-diagnostics-submitted',
          compactSummaryReadbackPerformed: true,
          fullReadbackPerformed: false,
          fullParticleReadbackPerformed: false,
          summaryRowCount: 1,
          summaryRows: row
        }
      }
    }
  });

  assert.equal(status.status, 'schroeder-phase-volume-visible-diagnostics-ready');
  assert.equal(status.phaseVolumeMigrationStatus, 'schroeder-phase-volume-migration-submitted');
  assert.equal(status.phaseVolumeLevelUpdateStatus, 'schroeder-phase-volume-level-update-submitted');
  assert.equal(status.phaseVolumeLevelUpdateConsumed, true);
  assert.equal(status.phaseVolumeLevelUpdateRetainedBuffer, true);
  assert.equal(status.sourceParticleCount, 8);
  assert.equal(status.particleCountGrowthFactor, 1);
  assert.equal(status.noFullParticleReadback, true);
  assert.equal(status.waterToSteamScaleMigrationObserved, true);
  assert.equal(status.representedToRestVolumeRatio, 700);
  assert.equal(status.phaseVolumeExpansionDetected, true);
  assert.equal(status.phaseVolumeLevelUpdateChanged, true);
});

test('SPH scene phase-volume overlay feedback keeps GPU buffer local and publishes summary only', () => {
  const levelUpdateBuffer = { label: 'retained-phase-volume-overlay-buffer' };
  const queueOrderedFinalConsumer = {};
  const transferReleases = [];
  const overlay = {
    schema: ULG_SCHROEDER_PHASE_VOLUME_LEVEL_UPDATE_ASSIGNMENT_OVERLAY_SCHEMA,
    status: 'schroeder-phase-volume-level-update-assignment-overlay-ready',
    phaseVolumeAssignmentOverlayEnabled: true,
    levelUpdateRowCount: 2,
    phaseVolumeAssignmentOverlayRowCount: 2,
    levelUpdateBuffer,
    retainedLevelUpdateBuffer: true,
    levelUpdateBufferByteLength: 2 * 32 * Float32Array.BYTES_PER_ELEMENT,
    rowAlignedWithParticles: false,
    sparseOverlayIndexRequired: true,
    overlayIndexMode: 'sparse-source-particle-index-required',
    sparseOverlayIndexStatus: 'required-for-sparse-phase-volume-level-update-rows',
    transferMode: 'descriptor-only-same-device-retained-buffer-ref',
    rawGpuBufferTransferAllowed: false,
    fullParticleReadbackRequired: false
  };

  const feedback = createSchroederPhaseVolumeAssignmentOverlayFeedbackCacheEntry({
    residentExecution: {
      schema: 'peercompute.ulg.mls-mpm-gpu-resident-steps-execution.v0',
      status: 'resident-steps-executed',
      residentExecutionGeneration: 4,
      currentResidentExecutionGeneration: 4,
      schroederPhaseVolumeNextTickAssignmentOverlay: overlay,
      releaseSchroederHierarchyArtifactTransfers(options) {
        transferReleases.push(options);
      }
    },
    source: 'unit-test'
  });
  const summary = summarizeSchroederPhaseVolumeAssignmentOverlayFeedback(feedback);
  const diagnostic = summarizeSchroederPhaseVolumeDiagnosticStatus({
    schema: 'peercompute.ulg.mls-mpm-gpu-resident-steps-execution.v0',
    status: 'resident-steps-executed',
    schroederPhaseVolumeAssignmentOverlayFeedback: summary,
    phaseVolumeDiagnosticSummaryStatus: 'schroeder-phase-volume-diagnostic-summary-submitted',
    phaseVolumeDiagnosticSummary: {
      schema: ULG_SCHROEDER_PHASE_VOLUME_DIAGNOSTIC_SUMMARY_EXECUTION_SCHEMA,
      status: 'schroeder-phase-volume-diagnostic-summary-submitted',
      summaryRows: new Float32Array(32),
      fullParticleReadbackPerformed: false
    }
  });

  assert.equal(feedback.status, 'schroeder-phase-volume-assignment-overlay-feedback-ready');
  assert.equal(feedback.ready, true);
  assert.equal(feedback.phaseVolumeAssignmentOverlay.levelUpdateBuffer, levelUpdateBuffer);
  assert.equal(feedback.sameDeviceOnly, true);
  assert.equal(feedback.rawGpuBufferTransferAllowed, false);
  assert.equal(summary.status, feedback.status);
  assert.equal(summary.ready, true);
  assert.equal(summary.levelUpdateRowCount, 2);
  assert.equal(summary.sparseOverlayIndexRequired, true);
  assert.equal(summary.phaseVolumeAssignmentOverlay, undefined);
  assert.equal(summary.rawGpuBufferTransferAllowed, false);
  assert.equal(diagnostic.phaseVolumeAssignmentOverlayFeedbackStatus, feedback.status);
  assert.equal(diagnostic.phaseVolumeAssignmentOverlayFeedbackReady, true);
  assert.equal(diagnostic.phaseVolumeAssignmentOverlayFeedbackRowCount, 2);
  assert.equal(diagnostic.phaseVolumeAssignmentOverlayFeedbackIndexRequired, true);
  assert.equal(diagnostic.phaseVolumeAssignmentOverlayFeedbackRawGpuBufferTransferAllowed, false);
  assert.equal(feedback.releaseSchroederPhaseVolumeOverlayTransfer({
    queueOrderedFinalConsumer
  }), true);
  assert.equal(feedback.releaseSchroederPhaseVolumeOverlayTransfer(), false);
  assert.equal(transferReleases.length, 1);
  assert.deepEqual(transferReleases[0], {
    transferClass: 'next-tick',
    families: 'phase-volume-level-update',
    reason: 'phase-volume-overlay-cache-owner-released',
    submitted: true,
    queueOrderedFinalConsumer
  });
});

test('SPH scene phase-volume overlay release remains retryable after an authorization failure', () => {
  const queueOrderedFinalConsumer = {};
  let releaseAttemptCount = 0;
  const feedback = createSchroederPhaseVolumeAssignmentOverlayFeedbackCacheEntry({
    residentExecution: {
      schroederPhaseVolumeNextTickAssignmentOverlay: {
        schema: ULG_SCHROEDER_PHASE_VOLUME_LEVEL_UPDATE_ASSIGNMENT_OVERLAY_SCHEMA,
        phaseVolumeAssignmentOverlayEnabled: true,
        phaseVolumeAssignmentOverlayRowCount: 1,
        levelUpdateBuffer: {},
        rawGpuBufferTransferAllowed: false,
        fullParticleReadbackRequired: false
      },
      releaseSchroederHierarchyArtifactTransfers(options) {
        releaseAttemptCount += 1;
        if (options.queueOrderedFinalConsumer !== queueOrderedFinalConsumer) {
          throw new Error('exact queue-ordered final consumer required');
        }
      }
    }
  });

  assert.throws(
    () => feedback.releaseSchroederPhaseVolumeOverlayTransfer(),
    /exact queue-ordered final consumer required/
  );
  assert.equal(feedback.releaseSchroederPhaseVolumeOverlayTransfer({
    queueOrderedFinalConsumer
  }), true);
  assert.equal(feedback.releaseSchroederPhaseVolumeOverlayTransfer({
    queueOrderedFinalConsumer
  }), false);
  assert.equal(releaseAttemptCount, 2);
});

test('SPH scene publication forwards the prior resident final-consumer capability to both next-tick replacements', () => {
  const source = Function.prototype.toString.call(createSphPhaseScene);
  const promotionStart = source.indexOf(
    'function promoteSchroederPressureInterfaceGasCellFieldImportFromResidentExecution'
  );
  const promotionEnd = source.indexOf('\n  function ', promotionStart + 1);
  const publicationStart = source.indexOf(
    'function publishMlsMpmResidentStepArtifacts'
  );
  const publicationEnd = source.indexOf('\n  function ', publicationStart + 1);

  assert.ok(promotionStart >= 0);
  assert.ok(promotionEnd > promotionStart);
  assert.ok(publicationStart >= 0);
  assert.ok(publicationEnd > publicationStart);
  assert.match(
    source.slice(promotionStart, promotionEnd),
    /publishSphResidentPressureInterfaceState\(nextState,\s*\{\s*queueOrderedFinalConsumer:\s*execution\?\.queueOrderedPriorResidentExecutionFinalConsumer\s*\?\?\s*null\s*\}\)/
  );
  assert.match(
    source.slice(publicationStart, publicationEnd),
    /releaseSchroederPhaseVolumeOverlayTransfer\?\.\(\{[\s\S]*?queueOrderedFinalConsumer:\s*publishedExecution\s*\?\.queueOrderedPriorResidentExecutionFinalConsumer\s*\?\?\s*null/
  );
});

test('worker resident particle-state source cache keys avoid full hashes for versioned CPU-visible state', () => {
  const sphParticleState = {
    particleCount: 2,
    step: 7,
    time: 0.125,
    status: 'gpu-resident-readback-ready',
    cpuStateStale: false,
    stateStrideFloats: 8,
    thermoStrideFloats: 12,
    state: new Float32Array(16),
    thermo: new Float32Array(24)
  };
  const colorRows = new Float32Array([1, 2, 0, 0, 0.5, 0.6, 0.7, 1]);
  const descriptor = workerResidentParticleStateProducerSourceCacheDescriptor(
    sphParticleState,
    colorRows
  );

  assert.equal(descriptor.strategy, 'step-time');
  assert.equal(descriptor.cpuStateStale, false);
  assert.match(descriptor.key, /sourceKeyStrategy:step-time/);
  assert.match(descriptor.key, /step:7/);
  assert.match(descriptor.key, /time:0.125/);
  assert.doesNotMatch(descriptor.key, /\|state:\d+:/);

  const staleDescriptor = workerResidentParticleStateProducerSourceCacheDescriptor({
    ...sphParticleState,
    status: 'gpu-resident-unread-ready',
    cpuStateStale: true
  }, colorRows);
  assert.equal(staleDescriptor.strategy, 'content-hash');
  assert.equal(staleDescriptor.cpuStateStale, true);
  assert.match(staleDescriptor.key, /sourceKeyStrategy:content-hash/);
  assert.match(staleDescriptor.key, /\|state:\d+:/);
});

test('worker resident particle-state color rows cover admitted reaction products and every phase lane', () => {
  const materialProperties = {
    Na: {},
    h2o: {},
    h2: {},
    naoh: { intrinsicColorSrgb: [0.78, 0.8, 0.82] }
  };
  const sodiumMaterialId = stableOpticalMaterialId('Na');
  const waterMaterialId = stableOpticalMaterialId('h2o');
  const hydrogenMaterialId = stableOpticalMaterialId('h2');
  const sodiumHydroxideMaterialId = stableOpticalMaterialId('NaOH');
  const reactionTable = {
    productTermMetadata: [
      { material: 'NaOH', materialId: sodiumHydroxideMaterialId },
      { material: 'h2', materialId: hydrogenMaterialId }
    ]
  };
  const colorRows = workerResidentParticleStateProducerColorRows(null, {
    sphParticleState: {
      metadata: [
        { material: 'Na', materialId: sodiumMaterialId, phase: 'solid', phaseId: GPU_PHASE_IDS.solid },
        { material: 'h2o', materialId: waterMaterialId, phase: 'liquid', phaseId: GPU_PHASE_IDS.liquid }
      ]
    },
    materialProperties,
    reactionTable
  });
  const keys = new Set();
  const rowsByKey = new Map();
  for (let offset = 0; offset < colorRows.length; offset += 8) {
    const key = `${Math.round(colorRows[offset + 0])}:${Math.round(colorRows[offset + 1])}`;
    keys.add(key);
    rowsByKey.set(key, colorRows.slice(offset, offset + 8));
  }

  assert.ok(keys.has(`${sodiumMaterialId}:${GPU_PHASE_IDS.solid}`));
  assert.ok(keys.has(`${waterMaterialId}:${GPU_PHASE_IDS.liquid}`));
  for (const materialId of [hydrogenMaterialId, sodiumHydroxideMaterialId]) {
    for (const phaseId of [
      GPU_PHASE_IDS.solid,
      GPU_PHASE_IDS.liquid,
      GPU_PHASE_IDS.gas,
      GPU_PHASE_IDS.plasma
    ]) {
      assert.ok(keys.has(`${materialId}:${phaseId}`));
    }
  }
  const sodiumHydroxideGas = rowsByKey.get(
    `${sodiumHydroxideMaterialId}:${GPU_PHASE_IDS.gas}`
  );
  assert.ok(sodiumHydroxideGas);
  assert.ok(Math.abs(sodiumHydroxideGas[4] - 0.78) < 1e-6);
  assert.ok(Math.abs(sodiumHydroxideGas[5] - 0.8) < 1e-6);
  assert.ok(Math.abs(sodiumHydroxideGas[6] - 0.82) < 1e-6);
});

test('SPH phase renderer batches particles into continuous material surfaces', () => {
  const batches = createContinuousSurfaceBatches({
    boxEdgeM: 10,
    positionsM: new Float32Array([
      4.5, 1.1, 5.0,
      4.7, 1.1, 5.1,
      5.0, 0.3, 5.0
    ]),
    colorsRgb: new Float32Array([
      0.7, 0.9, 1.0,
      0.6, 0.8, 1.0,
      1.0, 0.32, 0.14
    ]),
    materials: ['h2o', 'h2o', 'fe'],
    particleRadiiM: [0.11, 0.11, 0.4]
  });

  assert.equal(SPH_PHASE_RENDER_MODE, 'continuous-marching-cubes');
  assert.equal(batches.length, 2);

  const h2o = batches.find((batch) => batch.material === 'h2o');
  const fe = batches.find((batch) => batch.material === 'fe');
  assert.equal(h2o.count, 2);
  assert.equal(fe.count, 1);
  assert.deepEqual(h2o.colorsRgb.slice(0, 3), [0.699999988079071, 0.8999999761581421, 1]);
  assert.ok(h2o.surfaceRadiusM > 0);
  assert.ok(fe.surfaceRadiusM > 0);
  assert.ok(Math.abs(h2o.surfaceRadiusM - 0.11) < 1e-12);
  assert.ok(Math.abs(fe.surfaceRadiusM - 0.4) < 1e-12);
  assert.ok(h2o.normalizedPositions.every((value) => value > 0 && value < 1));
  assert.ok(fe.normalizedPositions.every((value) => value > 0 && value < 1));
});

test('SPH scene viewport sizing clamps DPR and falls back from zero mobile layout boxes', () => {
  assert.equal(SPH_SCENE_MAX_DEVICE_PIXEL_RATIO, 2);
  assert.equal(resolveSphScenePixelRatio(3), 2);
  assert.equal(resolveSphScenePixelRatio(0), 1);
  assert.equal(resolveSphScenePixelRatio(Number.NaN), 1);

  const visibleContainer = {
    clientWidth: 390,
    clientHeight: 844,
    getBoundingClientRect() {
      return { width: 390, height: 844 };
    }
  };
  assert.deepEqual(
    resolveSphSceneViewportSize(visibleContainer, {
      visualViewport: { width: 360, height: 740 }
    }),
    {
      width: 390,
      height: 844,
      aspect: 390 / 844,
      clientWidth: 390,
      clientHeight: 844,
      rectWidth: 390,
      rectHeight: 844,
      visualViewportWidth: 360,
      visualViewportHeight: 740
    }
  );

  const zeroLayoutContainer = {
    clientWidth: 0,
    clientHeight: 0,
    getBoundingClientRect() {
      return { width: 0, height: 0 };
    }
  };
  const recovered = resolveSphSceneViewportSize(zeroLayoutContainer, {
    fallbackWidth: 800,
    fallbackHeight: 520,
    visualViewport: { width: 390, height: 844 }
  });
  assert.equal(recovered.width, 390);
  assert.equal(recovered.height, 844);
  assert.equal(recovered.aspect, 390 / 844);
});

test('native WebGPU canvas renderer exposes stable pixel-ratio and backing-size state', () => {
  const canvas = { width: 0, height: 0, style: {} };
  const renderer = createNativeWebGpuCanvasRenderer({
    documentRef: { createElement: () => canvas },
    width: 320,
    height: 240
  });

  assert.equal(renderer.getPixelRatio(), 1);
  assert.equal(canvas.width, 320);
  assert.equal(canvas.height, 240);
  renderer.setPixelRatio(2);
  assert.equal(renderer.getPixelRatio(), 2);
  assert.equal(canvas.width, 640);
  assert.equal(canvas.height, 480);
  renderer.setSize(320, 240, false);
  assert.equal(canvas.width, 640);
  assert.equal(canvas.height, 480);
});

test('SPH native marching-cubes surface resolution budgets conservative vertex rows', () => {
  assert.equal(
    estimateNativeMarchingCubesVertexRowsByteLengthForResolution(64),
    240_045_120
  );

  const defaultResolution = nativeMarchingCubesRenderFieldResolutionForVertexRowsBudget(1);
  const defaultByteLength =
    estimateNativeMarchingCubesVertexRowsByteLengthForResolution(defaultResolution);
  // 256MB default budget (raised from 128MB, 2026-07-09): multi-surface
  // scenes budgeted to resolution 29-33 which read as octahedral droplets
  // and let small volumes flicker below the isovalue. With the global cap at
  // 96 (extraction-enforced budgets, 2026-07-09) the legacy single-surface
  // worst-case math itself binds at 66; the extraction path no longer uses
  // this legacy math (vertexRowsBudgetEnforcedByExtraction).
  assert.equal(defaultResolution, 66);
  assert.ok(defaultByteLength <= SPH_NATIVE_MARCHING_CUBES_VERTEX_ROWS_BYTE_BUDGET_DEFAULT);

  const twoSurfaceResolution = nativeMarchingCubesRenderFieldResolutionForVertexRowsBudget(2);
  const twoSurfaceByteLength =
    estimateNativeMarchingCubesVertexRowsByteLengthForResolution(twoSurfaceResolution, 2);
  assert.ok(twoSurfaceResolution < defaultResolution);
  assert.ok(twoSurfaceByteLength <= SPH_NATIVE_MARCHING_CUBES_VERTEX_ROWS_BYTE_BUDGET_DEFAULT);
});

test('SPH renderer backend option normalizes WebGPU as opt-in', () => {
  assert.equal(normalizeSphRendererBackend('webgpu'), 'webgpu');
  assert.equal(normalizeSphRendererBackend('three-webgpu'), 'webgpu');
  assert.equal(normalizeSphRendererBackend('native-webgpu'), 'native-webgpu');
  assert.equal(normalizeSphRendererBackend('webgpu-native'), 'native-webgpu');
  assert.equal(normalizeSphRendererBackend('webgl'), 'webgl');
  assert.equal(normalizeSphRendererBackend('bad-value'), 'webgl');
});

test('SPH Three WebGPU renderer required limits are resident-mode opt-in', () => {
  assert.deepEqual(resolveThreeWebGpuRendererRequiredLimits(), {});
  assert.deepEqual(resolveThreeWebGpuRendererRequiredLimits({
    rendererWebGpuResidentDevice: false
  }), {});
  assert.deepEqual(resolveThreeWebGpuRendererRequiredLimits({
    rendererWebGpuResidentDevice: true
  }), {
    maxStorageBuffersPerShaderStage: 10,
    maxBufferSize: 512 * 1024 * 1024,
    maxStorageBufferBindingSize: 512 * 1024 * 1024
  });

  assert.deepEqual(summarizeThreeWebGpuDeviceLimits({
    limits: {
      maxStorageBuffersPerShaderStage: 12,
      maxBufferSize: 1024,
      maxStorageBufferBindingSize: 2048
    }
  }), {
    maxStorageBuffersPerShaderStage: 12,
    maxBufferSize: 1024,
    maxStorageBufferBindingSize: 2048
  });
});

test('SPH Three WebGPU presentation policy is fail-closed with unsafe diagnostic opt-in', () => {
  const defaultPolicy = resolveThreeWebGpuPresentationPolicy({
    webGpuRendererAvailable: true,
    requestedPresentation: true,
    rendererWebGpuResidentDevice: true
  });
  assert.equal(defaultPolicy.status, 'three-webgpu-presentation-blocked-runtime-validation');
  assert.equal(defaultPolicy.enabled, false);
  assert.equal(defaultPolicy.blockedByRuntime, true);

  const unsafePolicy = resolveThreeWebGpuPresentationPolicy({
    webGpuRendererAvailable: true,
    requestedPresentation: true,
    rendererWebGpuResidentDevice: true,
    unsafeDiagnosticOverride: true
  });
  assert.equal(unsafePolicy.status, 'three-webgpu-presentation-enabled-unsafe-diagnostic');
  assert.equal(unsafePolicy.enabled, true);
  assert.equal(unsafePolicy.unsafeDiagnosticOverride, true);
  assert.equal(unsafePolicy.unsafeRuntimeBypass, true);
  assert.equal(unsafePolicy.enabledUnsafeDiagnostic, true);
  assert.equal(unsafePolicy.blockedByRuntime, false);

  const unsafePresentationOnlyPolicy = resolveThreeWebGpuPresentationPolicy({
    webGpuRendererAvailable: true,
    requestedPresentation: true,
    rendererWebGpuResidentDevice: false,
    unsafeDiagnosticOverride: true
  });
  assert.equal(unsafePresentationOnlyPolicy.status, 'three-webgpu-presentation-enabled-unsafe-diagnostic');
  assert.equal(unsafePresentationOnlyPolicy.enabled, true);
  assert.equal(unsafePresentationOnlyPolicy.blockedByResidentDevice, false);
  assert.equal(unsafePresentationOnlyPolicy.rendererWebGpuResidentDevice, false);
  assert.match(unsafePresentationOnlyPolicy.reason, /presentation-only diagnostic/);

  const missingResidentDevicePolicy = resolveThreeWebGpuPresentationPolicy({
    webGpuRendererAvailable: true,
    requestedPresentation: true,
    rendererWebGpuResidentDevice: false,
    runtimeValidated: true,
    unsafeDiagnosticOverride: false
  });
  assert.equal(missingResidentDevicePolicy.status, 'three-webgpu-presentation-blocked-resident-device');
  assert.equal(missingResidentDevicePolicy.enabled, false);
  assert.equal(missingResidentDevicePolicy.blockedByResidentDevice, true);
});

test('SPH Three WebGPU renderer-owned resident device is explicit opt-in', () => {
  const readyDevice = { label: 'renderer-owned-ready-device' };
  const readyRenderer = {
    isWebGPURenderer: true,
    backend: {
      device: readyDevice,
      get() { return { buffer: null }; }
    },
    userData: { sphWebGpuPresentationEnabled: true }
  };

  const defaultPolicy = resolveThreeWebGpuRendererOwnedResidentDevicePolicy({
    renderer: readyRenderer
  });
  assert.equal(defaultPolicy.status, 'renderer-owned-resident-device-disabled');
  assert.equal(defaultPolicy.rendererOwnedDeviceAllowed, false);
  assert.equal(defaultPolicy.requested, false);

  const pendingPolicy = resolveThreeWebGpuRendererOwnedResidentDevicePolicy({
    renderer: {
      isWebGPURenderer: true,
      backend: { get() { return { buffer: null }; } },
      userData: { sphWebGpuPresentationEnabled: true }
    },
    requested: true
  });
  assert.equal(pendingPolicy.status, 'renderer-owned-resident-device-blocked-device-pending');
  assert.equal(pendingPolicy.rendererOwnedDeviceAllowed, false);

  const blockedRuntimePolicy = resolveThreeWebGpuRendererOwnedResidentDevicePolicy({
    renderer: readyRenderer,
    requested: true
  });
  assert.equal(blockedRuntimePolicy.status, 'renderer-owned-resident-device-blocked-runtime-validation');
  assert.equal(blockedRuntimePolicy.rendererOwnedDeviceAllowed, false);
  assert.equal(blockedRuntimePolicy.runtimeValidated, false);

  const unsafePolicy = resolveThreeWebGpuRendererOwnedResidentDevicePolicy({
    renderer: {
      ...readyRenderer,
      userData: {
        sphWebGpuPresentationEnabled: true,
        sphWebGpuPresentationUnsafeDiagnosticOverride: true
      }
    },
    requested: true,
    unsafeDiagnosticOverride: true
  });
  assert.equal(unsafePolicy.status, 'renderer-owned-resident-device-enabled-unsafe-diagnostic');
  assert.equal(unsafePolicy.rendererOwnedDeviceAllowed, true);
  assert.equal(unsafePolicy.unsafeRuntimeBypass, true);
  assert.equal(unsafePolicy.runtimeValidated, false);

  const enabledPolicy = resolveThreeWebGpuRendererOwnedResidentDevicePolicy({
    renderer: readyRenderer,
    requested: true,
    runtimeValidated: true
  });
  assert.equal(enabledPolicy.status, 'renderer-owned-resident-device-enabled');
  assert.equal(enabledPolicy.rendererOwnedDeviceAllowed, true);
  assert.equal(enabledPolicy.rendererBackendDeviceReady, true);
  assert.equal(enabledPolicy.runtimeValidated, true);
});

test('SPH extension surface renderer capability blocks no-readback GPU buffers on WebGL scenes', () => {
  const webgl = resolveResidentExtensionSurfaceRendererCapability({
    renderer: { isWebGLRenderer: true, domElement: {} },
    readbackMode: 'no-full-readback'
  });
  assert.equal(webgl.rendererBackend, 'three-webgl');
  assert.equal(webgl.status, 'same-device-gpu-buffer-geometry-blocked-webgl-renderer');
  assert.equal(webgl.visibleNoReadbackSupported, false);
  assert.match(webgl.reason, /WebGLRenderer/);

  const pendingWebGpuDevice = resolveResidentExtensionSurfaceRendererCapability({
    renderer: {
      isWebGPURenderer: true,
      backend: { get() { return { buffer: {} }; } },
      domElement: {}
    },
    readbackMode: 'no-full-readback'
  });
  assert.equal(pendingWebGpuDevice.rendererBackend, 'three-webgpu');
  assert.equal(
    pendingWebGpuDevice.status,
    'same-device-gpu-buffer-geometry-blocked-three-webgpu-device-pending'
  );
  assert.equal(pendingWebGpuDevice.rendererBackendDeviceReady, false);
  assert.equal(pendingWebGpuDevice.sameDeviceGpuBufferGeometrySupported, false);
  assert.equal(pendingWebGpuDevice.visibleNoReadbackSupported, false);

  const supportedDevice = { label: 'renderer-resident-device' };
  const webgpu = resolveResidentExtensionSurfaceRendererCapability({
    renderer: {
      isWebGPURenderer: true,
      backend: {
        device: supportedDevice,
        get() { return { buffer: {} }; }
      },
      domElement: {}
    },
    readbackMode: 'no-full-readback',
    device: supportedDevice
  });
  assert.equal(webgpu.rendererBackend, 'three-webgpu');
  assert.equal(
    webgpu.status,
    'same-device-gpu-buffer-geometry-blocked-three-webgpu-external-buffer-pipeline-unvalidated'
  );
  assert.equal(webgpu.rendererBackendDeviceReady, true);
  assert.equal(webgpu.sameDeviceGpuBufferGeometryAvailable, true);
  assert.equal(webgpu.sameDeviceGpuBufferGeometrySupported, false);
  assert.equal(webgpu.externalBufferPresentationEnabled, false);
  assert.equal(webgpu.visibleNoReadbackSupported, false);

  const webgpuOptIn = resolveResidentExtensionSurfaceRendererCapability({
    renderer: {
      isWebGPURenderer: true,
      backend: {
        device: supportedDevice,
        get() { return { buffer: {} }; }
      },
      userData: { sphThreeWebGpuSurfaceBufferPresentationEnabled: true },
      domElement: {}
    },
    readbackMode: 'no-full-readback',
    device: supportedDevice
  });
  assert.equal(
    webgpuOptIn.status,
    'same-device-gpu-buffer-geometry-blocked-three-webgpu-external-buffer-pipeline-unvalidated'
  );
  assert.equal(webgpuOptIn.sameDeviceGpuBufferGeometryAvailable, true);
  assert.equal(webgpuOptIn.sameDeviceGpuBufferGeometrySupported, false);
  assert.equal(webgpuOptIn.externalBufferPresentationEnabled, true);
  assert.equal(webgpuOptIn.externalBufferPipelineRuntimeValidated, false);
  assert.equal(webgpuOptIn.visibleNoReadbackSupported, false);

  const webgpuUnsafeDiagnostic = resolveResidentExtensionSurfaceRendererCapability({
    renderer: {
      isWebGPURenderer: true,
      backend: {
        device: supportedDevice,
        get() { return { buffer: {} }; }
      },
      userData: {
        sphThreeWebGpuSurfaceBufferPresentationEnabled: true,
        sphWebGpuPresentationUnsafeDiagnosticOverride: true
      },
      domElement: {}
    },
    readbackMode: 'no-full-readback',
    device: supportedDevice
  });
  assert.equal(webgpuUnsafeDiagnostic.status, 'same-device-gpu-buffer-geometry-supported');
  assert.equal(webgpuUnsafeDiagnostic.sameDeviceGpuBufferGeometrySupported, true);
  assert.equal(webgpuUnsafeDiagnostic.visibleNoReadbackSupported, true);
  assert.equal(webgpuUnsafeDiagnostic.externalBufferPipelineUnsafeDiagnosticOverride, true);
  assert.equal(
    webgpuUnsafeDiagnostic.externalBufferPipelineRuntimeValidationSource,
    'unsafe-diagnostic-override'
  );

  const presentationDisabled = resolveResidentExtensionSurfaceRendererCapability({
    renderer: {
      isWebGPURenderer: true,
      backend: {
        device: { label: 'renderer-device' },
        get() { return { buffer: {} }; }
      },
      userData: { sphWebGpuPresentationEnabled: false },
      domElement: {}
    },
    readbackMode: 'no-full-readback'
  });
  assert.equal(
    presentationDisabled.status,
    'same-device-gpu-buffer-geometry-blocked-three-webgpu-presentation-disabled'
  );
  assert.equal(presentationDisabled.rendererPresentationDisabled, true);
  assert.equal(presentationDisabled.visibleNoReadbackSupported, false);

  const readbackBridge = resolveResidentExtensionSurfaceRendererCapability({
    renderer: { isWebGLRenderer: true, domElement: {} },
    renderBridgeMode: 'three-compact-vertices',
    readbackMode: 'full-parity-readback'
  });
  assert.equal(readbackBridge.status, 'three-compact-readback-bridge-supported');
  assert.equal(readbackBridge.visibleNoReadbackSupported, false);

  const rendererDevice = { label: 'renderer-device' };
  const residentDevice = { label: 'resident-device' };
  const crossDevice = resolveResidentExtensionSurfaceRendererCapability({
    renderer: {
      isWebGPURenderer: true,
      backend: {
        device: rendererDevice,
        get() { return {}; }
      },
      domElement: {}
    },
    readbackMode: 'no-full-readback',
    device: residentDevice
  });
  assert.equal(crossDevice.status, 'same-device-gpu-buffer-geometry-blocked-cross-device');
  assert.equal(crossDevice.visibleNoReadbackSupported, false);
  assert.equal(crossDevice.sameDeviceAsResident, false);

  const nativeDevice = { label: 'native-main-canvas-device' };
  const nativeOverlay = resolveResidentExtensionSurfaceRendererCapability({
    renderBridgeMode: 'native-webgpu-surface-consumer',
    readbackMode: 'no-full-readback',
    device: nativeDevice,
    nativeWebGpuSurfaceConsumer: {
      requested: true,
      engineIntegration: 'separate-overlay-canvas',
      usesResidentDevice: true,
      textureViewReady: true,
      runtimeValidated: true
    }
  });
  assert.equal(nativeOverlay.status, 'native-webgpu-surface-consumer-blocked-engine-integration');
  assert.equal(nativeOverlay.nativeSurfaceConsumerOwnsMainCanvas, false);
  assert.equal(nativeOverlay.visibleNoReadbackSupported, false);

  const nativeUnvalidated = resolveResidentExtensionSurfaceRendererCapability({
    renderBridgeMode: 'native-webgpu-surface-consumer',
    readbackMode: 'no-full-readback',
    device: nativeDevice,
    nativeWebGpuSurfaceConsumer: {
      requested: true,
      engineIntegration: 'engine-owned-main-canvas',
      usesResidentDevice: true,
      textureViewReady: true,
      runtimeValidated: false
    }
  });
  assert.equal(nativeUnvalidated.status, 'native-webgpu-surface-consumer-blocked-runtime-validation');
  assert.equal(nativeUnvalidated.nativeSurfaceConsumerAvailable, true);
  assert.equal(nativeUnvalidated.nativeSurfaceConsumerSupported, false);
  assert.equal(nativeUnvalidated.visibleNoReadbackSupported, false);

  const nativeSupported = resolveResidentExtensionSurfaceRendererCapability({
    renderBridgeMode: 'native-webgpu-surface-consumer',
    readbackMode: 'no-full-readback',
    device: nativeDevice,
    nativeWebGpuSurfaceConsumer: {
      requested: true,
      engineIntegration: 'engine-owned-main-canvas',
      usesResidentDevice: true,
      textureViewReady: true,
      runtimeValidated: true,
      pixelValidationStatus: 'not-run'
    }
  });
  assert.equal(nativeSupported.status, 'native-webgpu-surface-consumer-supported');
  assert.equal(nativeSupported.nativeSurfaceConsumerOwnsMainCanvas, true);
  assert.equal(nativeSupported.nativeSurfaceConsumerAvailable, true);
  assert.equal(nativeSupported.nativeSurfaceConsumerSupported, true);
  assert.equal(nativeSupported.visibleNoReadbackSupported, true);
});

test('SPH surface draw presentation blocks compact tetrahedral geometry by default', () => {
  const compact = resolveSphSurfaceDrawDiagnosticPresentationMode({
    requestedMode: 'three-compact-vertices'
  });
  assert.equal(compact.requestedMode, 'three-compact-vertices');
  assert.equal(compact.effectiveMode, 'auto');
  assert.equal(compact.compactVertexPresentationBlocked, true);
  assert.match(compact.fallbackReason, /tetrahedralized render-field cubes/);

  const webgpuRows = resolveSphSurfaceDrawDiagnosticPresentationMode({
    requestedMode: 'webgpu-render-row-spheres',
    webGpuRenderRowOverlayRequestedButDisabled: true
  });
  assert.equal(webgpuRows.effectiveMode, 'three-render-row-spheres');
  assert.equal(webgpuRows.webGpuRenderRowOverlayBlocked, true);
  assert.equal(webgpuRows.compactVertexPresentationBlocked, false);
});

test('SPH auto surface refresh retains a committed visible native presenter', () => {
  const retained = resolveSphSurfaceDrawRefreshContinuityMode({
    requestedMode: 'auto',
    previousVisibleRendererBridge: 'native-webgpu-surface-consumer',
    previousBridgeVisible: true
  });
  assert.equal(retained.status, 'surface-draw-auto-retained-visible-native-consumer');
  assert.equal(retained.effectiveMode, 'native-webgpu-surface-consumer');
  assert.equal(retained.retainedPreviousNativeSurfaceConsumer, true);

  const uncommitted = resolveSphSurfaceDrawRefreshContinuityMode({
    requestedMode: 'auto',
    previousVisibleRendererBridge: 'native-webgpu-surface-consumer',
    previousBridgeVisible: false
  });
  assert.equal(uncommitted.effectiveMode, 'auto');
  assert.equal(uncommitted.retainedPreviousNativeSurfaceConsumer, false);

  const explicitReplacement = resolveSphSurfaceDrawRefreshContinuityMode({
    requestedMode: 'three-render-row-spheres',
    previousVisibleRendererBridge: 'native-webgpu-surface-consumer',
    previousBridgeVisible: true
  });
  assert.equal(explicitReplacement.effectiveMode, 'three-render-row-spheres');
  assert.equal(explicitReplacement.retainedPreviousNativeSurfaceConsumer, false);
});

test('native deferred extraction never replaces a visible presenter with a zero-geometry handoff', () => {
  const retained = resolveSphNativeSurfaceExtractionDeferralPolicy({
    nativeSurfaceConsumerRequested: true,
    nativeSurfaceExtractionAllowed: false,
    previousNativeSurfaceVisible: true,
    deferredRenderFieldHandoff: true
  });
  assert.equal(
    retained.status,
    'native-surface-extraction-deferred-retaining-previous-presentation'
  );
  assert.equal(retained.nativeSurfaceExtractionEffectiveAllowed, false);
  assert.equal(retained.retainPreviousNativeSurface, true);
  assert.equal(retained.releaseDeferredRenderFieldHandoff, true);
  assert.match(retained.reason, /zero-geometry render-field handoff/);
  assert.equal(Object.isFrozen(retained), true);

  const firstPresentation = resolveSphNativeSurfaceExtractionDeferralPolicy({
    nativeSurfaceConsumerRequested: true,
    nativeSurfaceExtractionAllowed: false,
    previousNativeSurfaceVisible: false,
    deferredRenderFieldHandoff: false
  });
  assert.equal(
    firstPresentation.status,
    'native-surface-extraction-forced-for-first-visible-presentation'
  );
  assert.equal(firstPresentation.nativeSurfaceExtractionEffectiveAllowed, true);
  assert.equal(firstPresentation.nativeSurfaceExtractionForcedForFirstVisiblePresentation, true);
  assert.equal(firstPresentation.retainPreviousNativeSurface, false);

  const nonNative = resolveSphNativeSurfaceExtractionDeferralPolicy({
    nativeSurfaceConsumerRequested: false,
    nativeSurfaceExtractionAllowed: false,
    previousNativeSurfaceVisible: true,
    deferredRenderFieldHandoff: true
  });
  assert.equal(nonNative.status, 'native-surface-extraction-deferral-not-applicable');
  assert.equal(nonNative.retainPreviousNativeSurface, false);
});

test('SPH extension surface bridge planner keeps no-full resident buffers by default', () => {
  const webglCapability = resolveResidentExtensionSurfaceRendererCapability({
    renderer: { isWebGLRenderer: true, domElement: {} },
    readbackMode: 'no-full-readback'
  });
  const webglPlan = resolveExtensionSurfaceRenderBridgePlan({
    rendererCapability: webglCapability,
    readbackMode: 'no-full-readback'
  });
  assert.equal(webglPlan.status, 'extension-surface-render-plan-resident-surface-buffer-handoff');
  assert.equal(webglPlan.useThreeCompactBridge, false);
  assert.equal(webglPlan.useThreeWebGpuSurfaceBufferBridge, false);
  assert.equal(webglPlan.translationReadbackMode, 'no-full-readback');
  assert.equal(webglPlan.fallbackThreeCompactBridge, false);
  assert.equal(webglPlan.retainResidentSurfaceBufferHandoff, true);
  assert.equal(webglPlan.effectiveRenderBridgeMode, 'resident-surface-buffers-no-overlay');
  assert.match(webglPlan.handoffReason, /WebGLRenderer/);

  const rendererDevice = { label: 'renderer-resident-device' };
  const webgpuCapability = resolveResidentExtensionSurfaceRendererCapability({
    renderer: {
      isWebGPURenderer: true,
      backend: {
        device: rendererDevice,
        get() { return { buffer: {} }; }
      },
      domElement: {}
    },
    readbackMode: 'no-full-readback',
    device: rendererDevice
  });
  const webgpuPlan = resolveExtensionSurfaceRenderBridgePlan({
    rendererCapability: webgpuCapability,
    readbackMode: 'no-full-readback'
  });
  assert.equal(webgpuPlan.status, 'extension-surface-render-plan-resident-surface-buffer-handoff');
  assert.equal(webgpuPlan.useThreeCompactBridge, false);
  assert.equal(webgpuPlan.useThreeWebGpuSurfaceBufferBridge, false);
  assert.equal(webgpuPlan.translationReadbackMode, 'no-full-readback');
  assert.equal(webgpuPlan.fallbackThreeCompactBridge, false);
  assert.equal(webgpuPlan.retainResidentSurfaceBufferHandoff, true);
  assert.match(webgpuPlan.handoffReason, /pipeline validation/);

  const requestedSurfaceBufferHandoffPlan = resolveExtensionSurfaceRenderBridgePlan({
    renderBridgeMode: 'three-webgpu-surface-buffers',
    rendererCapability: webgpuCapability,
    readbackMode: 'no-full-readback'
  });
  assert.equal(
    requestedSurfaceBufferHandoffPlan.status,
    'extension-surface-render-plan-resident-surface-buffer-handoff'
  );
  assert.equal(requestedSurfaceBufferHandoffPlan.useThreeCompactBridge, false);
  assert.equal(requestedSurfaceBufferHandoffPlan.useThreeWebGpuSurfaceBufferBridge, false);
  assert.equal(requestedSurfaceBufferHandoffPlan.retainResidentSurfaceBufferHandoff, true);
  assert.equal(requestedSurfaceBufferHandoffPlan.translationReadbackMode, 'no-full-readback');
  assert.equal(requestedSurfaceBufferHandoffPlan.effectiveRenderBridgeMode, 'resident-surface-buffers-no-overlay');
  assert.match(requestedSurfaceBufferHandoffPlan.handoffReason, /pipeline validation/);

  const nativeDevice = { label: 'native-main-canvas-device' };
  const nativeCapability = resolveResidentExtensionSurfaceRendererCapability({
    renderBridgeMode: 'native-webgpu-surface-consumer',
    readbackMode: 'no-full-readback',
    device: nativeDevice,
    nativeWebGpuSurfaceConsumer: {
      requested: true,
      engineIntegration: 'engine-owned-main-canvas',
      usesResidentDevice: true,
      textureViewReady: true,
      runtimeValidated: true
    }
  });
  const nativePlan = resolveExtensionSurfaceRenderBridgePlan({
    renderBridgeMode: 'native-webgpu-surface-consumer',
    rendererCapability: nativeCapability,
    readbackMode: 'no-full-readback'
  });
  assert.equal(nativePlan.status, 'extension-surface-render-plan-native-webgpu-surface-consumer');
  assert.equal(nativePlan.useNativeWebGpuSurfaceConsumerBridge, true);
  assert.equal(nativePlan.useThreeWebGpuSurfaceBufferBridge, false);
  assert.equal(nativePlan.effectiveRenderBridgeMode, 'native-webgpu-surface-consumer');
  assert.equal(nativePlan.translationReadbackMode, 'no-full-readback');
  assert.equal(nativePlan.nativeSurfaceConsumerSupported, true);

  const webgpuOptInCapability = resolveResidentExtensionSurfaceRendererCapability({
    renderer: {
      isWebGPURenderer: true,
      backend: {
        device: rendererDevice,
        get() { return { buffer: {} }; }
      },
      userData: { sphThreeWebGpuSurfaceBufferPresentationEnabled: true },
      domElement: {}
    },
    readbackMode: 'no-full-readback',
    device: rendererDevice
  });
  const webgpuOptInPlan = resolveExtensionSurfaceRenderBridgePlan({
    rendererCapability: webgpuOptInCapability,
    readbackMode: 'no-full-readback'
  });
  assert.equal(webgpuOptInPlan.status, 'extension-surface-render-plan-resident-surface-buffer-handoff');
  assert.equal(webgpuOptInPlan.useThreeCompactBridge, false);
  assert.equal(webgpuOptInPlan.useThreeWebGpuSurfaceBufferBridge, false);
  assert.equal(webgpuOptInPlan.retainResidentSurfaceBufferHandoff, true);
  assert.equal(webgpuOptInPlan.translationReadbackMode, 'no-full-readback');
  assert.equal(webgpuOptInPlan.fallbackThreeCompactBridge, false);
  assert.match(webgpuOptInPlan.handoffReason, /retained buffers/);

  const requestedCompactPlan = resolveExtensionSurfaceRenderBridgePlan({
    renderBridgeMode: 'three-compact-vertices',
    rendererCapability: webglCapability,
    readbackMode: 'no-full-readback'
  });
  assert.equal(requestedCompactPlan.status, 'extension-surface-render-plan-resident-surface-buffer-handoff');
  assert.equal(requestedCompactPlan.useThreeCompactBridge, false);
  assert.equal(requestedCompactPlan.translationReadbackMode, 'no-full-readback');
  assert.equal(requestedCompactPlan.fallbackThreeCompactBridge, false);
  assert.equal(requestedCompactPlan.compactBridgeBlocked, true);
  assert.match(requestedCompactPlan.handoffReason, /tetrahedralized render-field cubes/);
});

test('SPH Three WebGPU external interleaved attributes bind retained GPU buffers', () => {
  const gpuBuffer = { label: 'ulg-test-retained-surface-rows' };
  const records = new Map();
  const renderer = {
    isWebGPURenderer: true,
    backend: {
      get(target) {
        let record = records.get(target);
        if (!record) {
          record = {};
          records.set(target, record);
        }
        return record;
      }
    }
  };
  const binding = createThreeWebGpuExternalInterleavedBufferAttribute({
    renderer,
    buffer: gpuBuffer,
    count: 12,
    stride: 16,
    itemSize: 3,
    offset: 5,
    name: 'position'
  });

  assert.equal(binding.attribute.name, 'position');
  assert.equal(binding.attribute.itemSize, 3);
  assert.equal(binding.attribute.offset, 5);
  assert.equal(binding.attribute.count, 12);
  assert.equal(binding.interleavedBuffer.stride, 16);
  assert.equal(records.get(binding.interleavedBuffer).buffer, gpuBuffer);
});

test('SPH Three WebGPU external indirect attributes bind retained draw buffers', () => {
  const gpuBuffer = { label: 'ulg-test-retained-aggregate-indirect' };
  const records = new Map();
  class FakeIndirectStorageBufferAttribute {
    constructor(count, itemSize) {
      this.array = new Uint32Array(count * itemSize);
      this.itemSize = itemSize;
      this.count = count;
      this.isIndirectStorageBufferAttribute = true;
      this.version = 0;
    }
  }
  const renderer = {
    isWebGPURenderer: true,
    userData: {
      sphThreeNamespace: {
        IndirectStorageBufferAttribute: FakeIndirectStorageBufferAttribute
      }
    },
    backend: {
      get(target) {
        let record = records.get(target);
        if (!record) {
          record = {};
          records.set(target, record);
        }
        return record;
      }
    }
  };
  const binding = createThreeWebGpuExternalIndirectBufferAttribute({
    renderer,
    buffer: gpuBuffer,
    itemSize: 4,
    name: 'aggregate-indirect'
  });

  assert.equal(binding.attribute.name, 'aggregate-indirect');
  assert.equal(binding.attribute.itemSize, 4);
  assert.equal(binding.attribute.count, 1);
  assert.equal(binding.attribute.isIndirectStorageBufferAttribute, true);
  assert.equal(records.get(binding.attribute).buffer, gpuBuffer);
});

test('resident motion diagnostic treats batch-visible motion as a refresh trigger', () => {
  const residentStep = {
    schema: 'peercompute.ulg.mls-mpm-gpu-resident-step-execution.v0',
    dt: 0.0005,
    diagnostics: {
      compactGpuSummaryAvailable: true,
      maxDisplacementM: 0.0001,
      maxSpeedMPerS: 1.25,
      pressureInterfaceAppliedImpulseMagnitudeNSeconds: 0
    }
  };
  const residentSteps = {
    schema: 'peercompute.ulg.mls-mpm-gpu-resident-steps-execution.v0',
    completedStepCount: 256,
    finalStep: residentStep
  };

  const diagnostic = residentMotionDiagnostic({
    residentStep,
    residentSteps,
    gridSpacingM: 0.26666666666666666
  });

  assert.equal(diagnostic.status, 'batch-motion-estimate-visible');
  assert.equal(diagnostic.batchMotionEstimateVisible, true);
  assert.equal(diagnostic.completedStepCount, 256);
  assert.equal(diagnostic.stepDtS, 0.0005);
  assert.ok(diagnostic.maxDisplacementM < diagnostic.visibleThresholdM);
  assert.ok(diagnostic.estimatedBatchDisplacementUpperBoundM > diagnostic.visibleThresholdM);
  assert.equal(diagnostic.scientificValidation, false);
  assert.equal(diagnostic.fullPhysicsValidation, false);
});

test('worker terminal native surface presentation is exact and readback-scoped outside the physics hot loop', () => {
  const execution = {
    residentComputeManagerMode: 'worker-owned-resident-lane',
    workerLaneFallback: null,
    workerOwnedResidentLane: {
      laneId: 'lane:native-surface',
      stateKey: 'state:native-surface',
      scheduleId: 'schedule:native-surface:2',
      residentScheduleStatus: 'worker-resident-schedule-completed',
      cancelled: false,
      completedStepCount: 1,
      laneSimTimeS: 0.004,
      finalEpochIdentity: { storageGeneration: 12, physicsTick: 7 },
      retainedBufferRefs: ['worker:state'],
      committedPresentation: {
        status: 'worker-offscreen-resident-particle-state-producer-rendered',
        committedPresentationSchema:
          'peercompute.ulg.presentation-worker-committed-resident-schedule-presentation.v0',
        committedPresentationStatus:
          'state-manager-committed-resident-schedule-presentation-admission',
        residentScheduleCandidatePresentation: true,
        stateManagerCommittedPresentation: true,
        scheduleId: 'schedule:native-surface:2',
        laneId: 'lane:native-surface',
        stateKey: 'state:native-surface',
        residentExecutionGeneration: 12,
        sphStep: 7,
        stepOrdinal: 1,
        authorityStatus: 'state-manager-committed-worker-schedule',
        computeManagerCompletionSchema:
          'peercompute.ulg.schroeder-worker-lane-compute-manager-completion.v0',
        computeManagerLeaseId: 'lease:native-surface:2',
        computeManagerLeaseStatus: 'completed',
        computeManagerFenceSatisfied: true,
        stateManagerCommitStatus: 'committed',
        stateManagerCommitAccepted: true,
        terminalScheduleFence: true,
        terminalFenceScope: 'resident-schedule-terminal',
        terminalFenceSatisfied: true,
        terminalFenceAuthorityAdmissionReady: true,
        producerSourceKind: 'worker-retained-resident-stage-output',
        producerSourceTransport: 'worker-retained-resident-stage-output',
        sourceStageId: 'schroederSameLevelMechanics',
        retainedParticleStateStatus: 'worker-retained-particle-state-ready'
      }
    }
  };
  const presentation = {
    schema: 'peercompute.ulg.worker-lane-native-surface-presentation-source.v0',
    status: 'worker-lane-native-surface-presentation-source-ready',
    scheduleId: 'schedule:native-surface:2',
    laneId: 'lane:native-surface',
    stateKey: 'state:native-surface',
    requestId: 'request:native-surface:2',
    cacheKey: 'request:native-surface:2',
    sourceStep: 8,
    sourceTimeS: 0.004,
    readbackScope: 'resident-schedule-terminal-presentation',
    terminalPresentationFullParticleReadbackPerformed: true,
    physicsHotLoopParticipation: false
  };
  const renderState = {
    schema: 'peercompute.ulg.sph-resident-render-state.v0',
    status: 'resident-render-field-applied',
    sourceResidentRenderSourceStatus: 'resident-render-source-current',
    surfaceDrawVisibleRendererBridge: 'native-webgpu-surface-consumer',
    surfaceDrawVisibleGpuConsumerReady: true,
    surfaceDrawVisibleGpuConsumerNativeActiveResourceGeneration: 2,
    surfaceDrawVisibleGpuConsumerNativeCandidateForegroundResourceGeneration: 2,
    surfaceDrawVisibleGpuConsumerSameQueueStructuralSubmissionAdmitted: true,
    surfaceDrawVisibleGpuConsumerNativeCandidateForegroundValidationStatus:
      'passed',
    surfaceDrawVisibleGpuConsumerNativeCandidateForegroundProofKind:
      'same-queue-private-staged-composite-submission',
    surfaceDrawVisibleGpuConsumerNativeCandidateForegroundSameQueueSubmissionBoundary:
      true,
    surfaceDrawVisibleGpuConsumerNativeCandidateForegroundSubmittedDrawCount: 4,
    surfaceDrawVisibleGpuConsumerRuntimePresentationAdmitted: true,
    surfaceDrawRenderBridgeLastRenderStatus:
      'native-webgpu-surface-consumer-candidate-staged-composite-presented',
    surfaceDrawRenderBridgeFrameCount: 3,
    surfaceDrawRenderBridgeLastSubmittedDrawCount: 4,
    surfaceDrawRenderBridgeNativeSurfaceCandidateStagedPresentationStatus:
      'candidate-staged-presentation-canvas-copy-submitted',
    surfaceDrawRenderBridgeNativeSurfaceCandidatePresentationCopyCount: 2,
    surfaceDrawRenderBridgeNativeSurfaceCandidatePresentationPostAdmissionGeometrySubmitCount:
      0,
    surfaceDrawSourceResidentExecutionGenerationMatchesCurrent: true,
    surfaceDrawSourceResidentRetainedPrevious: false,
    residentRenderSourceStaleAfterPublish: false,
    surfaceDrawOverlayPolicyStatus: 'surface-draw-native-webgpu-main-canvas',
    workerOffscreenPresentationStatus:
      'worker-offscreen-display-hidden-main-native-owner',
    workerOffscreenRetainedCompactSnapshotStatus:
      'presentation-worker-retained-compact-snapshot-exported',
    workerOffscreenRetainedCompactSnapshotAvailable: true,
    workerOffscreenRetainedCompactSnapshot: {
      compactBufferSnapshotStep: 8
    },
    residentRenderSource: {
      residentExecutionGenerationMatchesCurrent: true,
      nextStep: 8,
      nextTimeS: 0.004,
      workerLaneNativeSurfaceSnapshotHandoff: {
        schema:
          'peercompute.ulg.worker-lane-native-surface-presentation-source.v0',
        status: 'worker-lane-native-surface-presentation-source-admitted',
        scheduleId: 'schedule:native-surface:2',
        laneId: 'lane:native-surface',
        stateKey: 'state:native-surface',
        requestId: 'request:native-surface:2',
        cacheKey: 'request:native-surface:2',
        sourceStep: 8,
        sourceTimeS: 0.004,
        sharedSlotIdentityVerified: true,
        workerLineageMetadataStatus:
          'worker-retained-compact-snapshot-lineage-metadata-ready',
        terminalCompactSnapshotReadback: true
      }
    }
  };

  assert.equal(residentWorkerLaneNativeSurfacePresentationReady({
    execution,
    presentation,
    renderState
  }), true);
  assert.equal(residentWorkerLaneNativeSurfacePresentationReady({
    execution,
    presentation: { ...presentation, physicsHotLoopParticipation: true },
    renderState
  }), false);
  assert.equal(residentWorkerLaneNativeSurfacePresentationReady({
    execution,
    presentation,
    renderState: {
      ...renderState,
      workerOffscreenRetainedCompactSnapshot: {
        compactBufferSnapshotStep: 7
      }
    }
  }), false);
  assert.equal(residentWorkerLaneNativeSurfacePresentationReady({
    execution,
    presentation,
    renderState: {
      ...renderState,
      residentRenderSource: {
        ...renderState.residentRenderSource,
        workerLaneNativeSurfaceSnapshotHandoff: {
          ...renderState.residentRenderSource
            .workerLaneNativeSurfaceSnapshotHandoff,
          scheduleId: 'schedule:stale'
        }
      }
    }
  }), false);
  assert.equal(residentWorkerLaneNativeSurfacePresentationReady({
    execution,
    presentation,
    renderState: {
      ...renderState,
      surfaceDrawSourceResidentExecutionGenerationMatchesCurrent: false
    }
  }), false);
});

test('SPH phase renderer preserves material and phase descriptors for optical closures', () => {
  const batches = createContinuousSurfaceBatches({
    boxEdgeM: 10,
    positionsM: new Float32Array([
      4.5, 1.1, 5.0,
      4.7, 1.1, 5.1,
      5.0, 0.3, 5.0
    ]),
    colorsRgb: new Float32Array([
      0.7, 0.9, 1.0,
      0.6, 0.8, 1.0,
      1.0, 0.32, 0.14
    ]),
    materials: [
      { material: 'h2o', phase: 'solid', renderKey: 'ice' },
      { material: 'h2o', phase: 'gas', renderKey: 'steam' },
      { material: 'fe', phase: 'liquid', renderKey: 'fe' }
    ]
  });

  assert.equal(batches.length, 3);
  const ice = batches.find((batch) => batch.renderKey === 'ice');
  const steam = batches.find((batch) => batch.renderKey === 'steam');
  const iron = batches.find((batch) => batch.material === 'fe');
  assert.equal(ice.material, 'h2o');
  assert.equal(ice.phase, 'solid');
  assert.equal(steam.material, 'h2o');
  assert.equal(steam.phase, 'gas');
  assert.equal(iron.renderKey, 'fe');
  assert.equal(iron.phase, 'liquid');
  assert.ok(new Set(batches.map((batch) => batch.surfaceKey)).size === 3);
});

test('SPH compact surface descriptor resolves numeric GPU material and phase ids', () => {
  const materialProperties = {
    h2o: {
      phases: [
        { name: 'solid' },
        { name: 'liquid' },
        { name: 'gas' }
      ]
    }
  };
  const h2oMaterialId = stableOpticalMaterialId('h2o');

  const liquid = renderDescriptorForSurfaceRecord({
    surfaceIndex: 0,
    materialId: h2oMaterialId,
    phaseId: GPU_PHASE_IDS.liquid
  }, 0, { materialProperties });
  const ice = renderDescriptorForSurfaceRecord({
    surfaceIndex: 1,
    materialId: h2oMaterialId,
    phaseId: GPU_PHASE_IDS.solid
  }, 1, { materialProperties });
  const steam = renderDescriptorForSurfaceRecord({
    surfaceIndex: 2,
    materialId: h2oMaterialId,
    phaseId: GPU_PHASE_IDS.gas
  }, 2, { materialProperties });

  assert.equal(liquid.material, 'h2o');
  assert.equal(liquid.phase, 'liquid');
  assert.equal(liquid.renderKey, 'h2o');
  assert.equal(liquid.surfaceKey, 'h2o|h2o|liquid');
  assert.equal(ice.material, 'h2o');
  assert.equal(ice.phase, 'solid');
  assert.equal(ice.renderKey, 'ice');
  assert.equal(ice.surfaceKey, 'ice|h2o|solid');
  assert.equal(steam.material, 'h2o');
  assert.equal(steam.phase, 'gas');
  assert.equal(steam.renderKey, 'steam');
  assert.equal(steam.surfaceKey, 'steam|h2o|gas');
});

test('SPH phase renderer does not collapse arbitrary selected elements to the last material', () => {
  const batches = createContinuousSurfaceBatches({
    boxEdgeM: 5,
    positionsM: new Float32Array([
      2.4, 0.4, 2.4,
      2.6, 0.4, 2.6,
      2.4, 2.8, 2.4,
      2.6, 2.8, 2.6
    ]),
    colorsRgb: new Float32Array([
      0.9, 0.9, 0.9,
      0.9, 0.9, 0.9,
      1.0, 0.8, 0.4,
      1.0, 0.8, 0.4
    ]),
    materials: [
      { material: 'Na', phase: 'solid', renderKey: 'Na' },
      { material: 'Na', phase: 'solid', renderKey: 'Na' },
      { material: 'Au', phase: 'liquid', renderKey: 'Au' },
      { material: 'Au', phase: 'liquid', renderKey: 'Au' }
    ]
  });

  const summary = Object.fromEntries(batches.map((batch) => [batch.material, batch.count]));
  assert.deepEqual(summary, { Na: 2, Au: 2 });
  assert.deepEqual(batches.map((batch) => batch.surfaceKey).sort(), ['Au|Au|liquid', 'Na|Na|solid']);
});

test('SPH phase renderer preserves same-material render domains as separate surfaces', () => {
  const batches = createContinuousSurfaceBatches({
    boxEdgeM: 5,
    positionsM: new Float32Array([
      2.4, 0.4, 2.4,
      2.6, 0.4, 2.6,
      2.4, 2.8, 2.4,
      2.6, 2.8, 2.6
    ]),
    colorsRgb: new Float32Array([
      0.2, 0.35, 1,
      0.2, 0.35, 1,
      0.2, 0.35, 1,
      0.2, 0.35, 1
    ]),
    materials: [
      { material: 'h2o', phase: 'liquid', renderKey: 'h2o', renderDomainId: 1, renderDomainKey: 'base' },
      { material: 'h2o', phase: 'liquid', renderKey: 'h2o', renderDomainId: 1, renderDomainKey: 'base' },
      { material: 'h2o', phase: 'liquid', renderKey: 'h2o', renderDomainId: 2, renderDomainKey: 'drop' },
      { material: 'h2o', phase: 'liquid', renderKey: 'h2o', renderDomainId: 2, renderDomainKey: 'drop' }
    ]
  });

  assert.equal(batches.length, 2);
  assert.deepEqual(
    batches.map((batch) => [batch.surfaceKey, batch.renderDomainId, batch.count]).sort(),
    [
      ['h2o|h2o|liquid|domain:base', 1, 2],
      ['h2o|h2o|liquid|domain:drop', 2, 2]
    ]
  );
});

test('SPH phase renderer preserves arbitrary same-material body ids as stable native surfaces', () => {
  const batches = createContinuousSurfaceBatches({
    boxEdgeM: 5,
    positionsM: new Float32Array([
      0.5, 0.5, 0.5,
      0.7, 0.5, 0.5,
      3.5, 0.5, 3.5,
      3.7, 0.5, 3.5
    ]),
    colorsRgb: new Float32Array([
      0.2, 0.35, 1,
      0.2, 0.35, 1,
      0.2, 0.35, 1,
      0.2, 0.35, 1
    ]),
    materials: [
      { material: 'h2o', phase: 'liquid', renderKey: 'h2o', renderDomainId: 7, renderDomainKey: 'left-water' },
      { material: 'h2o', phase: 'liquid', renderKey: 'h2o', renderDomainId: 7, renderDomainKey: 'left-water' },
      { material: 'h2o', phase: 'liquid', renderKey: 'h2o', renderDomainId: 19, renderDomainKey: 'right-water' },
      { material: 'h2o', phase: 'liquid', renderKey: 'h2o', renderDomainId: 19, renderDomainKey: 'right-water' }
    ]
  });

  assert.deepEqual(
    batches.map((batch) => [batch.surfaceKey, batch.renderDomainId, batch.renderDomainKey, batch.count]).sort(),
    [
      ['h2o|h2o|liquid|domain:left-water', 7, 'left-water', 2],
      ['h2o|h2o|liquid|domain:right-water', 19, 'right-water', 2]
    ]
  );
  const nativeDescriptor = renderDescriptorForSurfaceRecord({
    material: 'h2o',
    phase: 'liquid',
    renderKey: 'h2o',
    renderDomainId: 19,
    renderDomainKey: 'right-water'
  });
  assert.equal(nativeDescriptor.surfaceKey, 'h2o|h2o|liquid|domain:right-water');
  assert.equal(nativeDescriptor.renderDomainId, 19);
});

test('SPH phase renderer derives same-material render domains from domain counts', () => {
  const batches = createContinuousSurfaceBatches({
    boxEdgeM: 5,
    positionsM: new Float32Array([
      2.4, 0.4, 2.4,
      2.6, 0.4, 2.6,
      2.4, 2.8, 2.4,
      2.6, 2.8, 2.6
    ]),
    colorsRgb: new Float32Array([
      0.2, 0.35, 1,
      0.2, 0.35, 1,
      0.2, 0.35, 1,
      0.2, 0.35, 1
    ]),
    materials: [
      { material: 'h2o', phase: 'liquid', renderKey: 'h2o' },
      { material: 'h2o', phase: 'liquid', renderKey: 'h2o' },
      { material: 'h2o', phase: 'liquid', renderKey: 'h2o' },
      { material: 'h2o', phase: 'liquid', renderKey: 'h2o' }
    ],
    renderDomainCounts: { base: 2, drop: 2, total: 4 }
  });

  assert.equal(batches.length, 2);
  assert.deepEqual(
    batches.map((batch) => [batch.surfaceKey, batch.renderDomainId, batch.renderDomainKey, batch.count]).sort(),
    [
      ['h2o|h2o|liquid|domain:base', 1, 'base', 2],
      ['h2o|h2o|liquid|domain:drop', 2, 'drop', 2]
    ]
  );
});

test('continuous liquid surfaces use macro-spacing continuity radius for coarse particles', () => {
  const positions = [];
  const colors = [];
  const materials = [];
  const radii = [];
  for (const x of [2.25, 2.75]) {
    for (const y of [2.75, 3.25]) {
      for (const z of [2.25, 2.75]) {
        positions.push(x, y, z);
        colors.push(0.3, 0.55, 1);
        materials.push({
          material: 'h2o',
          phase: 'liquid',
          renderKey: 'h2o',
          renderDomainId: 2,
          renderDomainKey: 'drop',
          initialParticleSpacingM: 0.5,
          particleRadiusM: 0.1125
        });
        radii.push(0.1125);
      }
    }
  }

  const [batch] = createContinuousSurfaceBatches({
    boxEdgeM: 5,
    positionsM: new Float32Array(positions),
    colorsRgb: new Float32Array(colors),
    materials,
    particleRadiiM: new Float32Array(radii),
    smoothingLengthM: 0.45
  });

  assert.equal(batch.surfaceKey, 'h2o|h2o|liquid|domain:drop');
  assert.equal(batch.count, 8);
  assert.equal(Number(batch.surfaceRadiusM.toFixed(4)), 0.25);
  assert.equal(Number(batch.representativeParticleRadiusM.toFixed(4)), 0.1125);
  assert.equal(batch.smoothingLengthM, 0.45);
});

test('SPH resident material seed surfaces preserve domains without CPU geometry', () => {
  const batches = createResidentMaterialSeedSurfaceBatches({
    materials: [
      { material: 'h2o', phase: 'liquid', renderKey: 'h2o' },
      { material: 'h2o', phase: 'liquid', renderKey: 'h2o' },
      { material: 'h2o', phase: 'liquid', renderKey: 'h2o' },
      { material: 'h2o', phase: 'liquid', renderKey: 'h2o' }
    ],
    colorsRgb: new Float32Array([
      0.2, 0.4, 1.0,
      0.4, 0.6, 1.0,
      0.8, 0.3, 0.5,
      1.0, 0.5, 0.7
    ]),
    particleRadiiM: new Float32Array([0.1, 0.12, 0.2, 0.22]),
    renderDomainCounts: { base: 2, drop: 2, total: 4 },
    smoothingLengthM: 0.3
  });

  assert.deepEqual(
    batches.map((batch) => [
      batch.surfaceKey,
      batch.renderDomainId,
      batch.count,
      batch.positionsM.length,
      Number(batch.surfaceRadiusM.toFixed(3)),
      batch.averageColorRgb.map((value) => Number(value.toFixed(3)))
    ]).sort(),
    [
      // The SPH smoothing length (0.3 here) floors seed-surface radii:
      // physical particle radii run ~half the sample spacing and a union
      // of barely-touching metaballs ripples into boundary flakes.
      ['h2o|h2o|liquid|domain:base', 1, 2, 0, 0.3, [0.3, 0.5, 1]],
      ['h2o|h2o|liquid|domain:drop', 2, 2, 0, 0.3, [0.9, 0.4, 0.6]]
    ]
  );
  const base = batches.find((batch) => batch.renderDomainId === 1);
  const drop = batches.find((batch) => batch.renderDomainId === 2);
  assert.equal(Number(base.representativeParticleRadiusM.toFixed(3)), 0.11);
  assert.equal(Number(drop.representativeParticleRadiusM.toFixed(3)), 0.21);
  assert.equal(base.smoothingLengthM, 0.3);
  assert.equal(drop.smoothingLengthM, 0.3);
});

test('SPH resident optical paths use the body mean chord without material opacity floors', () => {
  const positionsM = [];
  const materials = [];
  for (const x of [0.1, 0.9]) {
    for (const y of [0.1, 0.9]) {
      for (const z of [0.1, 0.9]) {
        positionsM.push(x, y, z);
        materials.push({
          material: 'F',
          phase: 'gas',
          renderKey: 'F',
          renderDomainId: 1,
          renderDomainKey: 'base'
        });
      }
    }
  }
  const [batch] = createResidentMaterialSeedSurfaceBatches({
    materials,
    positionsM: Float32Array.from(positionsM),
    particleRadiiM: Float32Array.from({ length: 8 }, () => 0.1),
    smoothingLengthM: 0.2
  });

  assert.equal(batch.positionsM.length, 0, 'resident seed does not retain CPU geometry');
  assert.deepEqual(
    batch.bounds.min.map((value) => Number(value.toFixed(3))),
    [0.1, 0.1, 0.1]
  );
  assert.deepEqual(
    batch.bounds.max.map((value) => Number(value.toFixed(3))),
    [0.9, 0.9, 0.9]
  );
  const pathLengthM = opticalPathLengthMForSurfaceBatch(batch);
  assert.ok(Math.abs(pathLengthM - (2 / 3)) < 1e-6);

  const table = createOpticalGpuTableForSurfaceBatches([batch]);
  assert.ok(Math.abs(table.recordMetadata[0].pathLengthM - (2 / 3)) < 1e-6);
  assert.equal(
    table.recordMetadata[0].pathLengthSource,
    'surface-body-cauchy-mean-chord'
  );
});

test('SPH resident material seeds exclude zero-mass spare product rows', () => {
  const batches = createResidentMaterialSeedSurfaceBatches({
    materials: [
      {
        material: 'h2o',
        phase: 'liquid',
        renderKey: 'h2o',
        renderDomainId: 1,
        renderDomainKey: 'base',
        particleMassKg: 8
      },
      {
        material: 'Na',
        phase: 'solid',
        renderKey: 'Na',
        renderDomainId: 2,
        renderDomainKey: 'drop',
        particleMassKg: 2
      },
      {
        material: 'h2o',
        phase: 'liquid',
        renderKey: 'h2o',
        renderDomainId: 0,
        renderDomainKey: null,
        particleMassKg: 0,
        spareProductSlot: true
      }
    ],
    colorsRgb: new Float32Array([
      0.2, 0.4, 1,
      0.8, 0.8, 0.7,
      0.2, 0.4, 1
    ]),
    particleRadiiM: new Float32Array([0.1, 0.1, 0.1]),
    renderDomainCounts: { base: 1, drop: 1, total: 3 },
    smoothingLengthM: 0.3
  });

  assert.deepEqual(
    batches.map((batch) => batch.surfaceKey).sort(),
    ['Na|Na|solid|domain:drop', 'h2o|h2o|liquid|domain:base']
  );
  assert.equal(batches.some((batch) => batch.surfaceKey === 'h2o|h2o|liquid'), false);
});

test('SPH resident render fields merge same-material domains into one visible material field', () => {
  const batches = createContinuousSurfaceBatches({
    boxEdgeM: 5,
    positionsM: new Float32Array([
      2.4, 0.4, 2.4,
      2.6, 0.4, 2.6,
      2.4, 1.1, 2.4,
      2.6, 1.1, 2.6
    ]),
    colorsRgb: new Float32Array([
      0.2, 0.35, 1,
      0.2, 0.35, 1,
      0.2, 0.35, 1,
      0.2, 0.35, 1
    ]),
    materials: [
      { material: 'h2o', phase: 'liquid', renderKey: 'h2o', renderDomainId: 1, renderDomainKey: 'base' },
      { material: 'h2o', phase: 'liquid', renderKey: 'h2o', renderDomainId: 1, renderDomainKey: 'base' },
      { material: 'h2o', phase: 'liquid', renderKey: 'h2o', renderDomainId: 2, renderDomainKey: 'drop' },
      { material: 'h2o', phase: 'liquid', renderKey: 'h2o', renderDomainId: 2, renderDomainKey: 'drop' }
    ],
    particleRadiiM: new Float32Array([0.09, 0.11, 0.13, 0.15]),
    smoothingLengthM: 0.248
  });

  const expectedOpticalPathLengthM = batches.reduce(
    (sum, batch) => sum + opticalPathLengthMForSurfaceBatch(batch) * batch.count,
    0
  ) / batches.reduce((sum, batch) => sum + batch.count, 0);
  const [merged] = mergeSameMaterialPhaseSurfaceBatchesForRenderField(batches);

  assert.equal(merged.surfaceKey, 'h2o|h2o|liquid');
  assert.equal(merged.renderDomainId, 0);
  assert.equal(merged.renderDomainKey, null);
  assert.equal(merged.count, 4);
  assert.equal(merged.positionsM.length, 12);
  assert.equal(merged.normalizedPositions.length, 12);
  assert.equal(Number(merged.representativeParticleRadiusM.toFixed(3)), 0.13);
  assert.equal(merged.smoothingLengthM, 0.248);
  assert.ok(Math.abs(merged.opticalPathLengthM - expectedOpticalPathLengthM) < 1e-12);
  assert.equal(
    merged.opticalPathLengthSource,
    'component-count-weighted-cauchy-mean-chord'
  );
  assert.deepEqual(
    merged.mergedRenderDomains.map((domain) => [domain.renderDomainId, domain.renderDomainKey, domain.count]),
    [
      [1, 'base', 2],
      [2, 'drop', 2]
    ]
  );
});

test('SPH CPU render fields merge liquid domains but preserve solid domains', () => {
  const batches = createContinuousSurfaceBatches({
    boxEdgeM: 5,
    positionsM: new Float32Array([
      2.4, 0.4, 2.4,
      2.6, 0.4, 2.6,
      2.4, 1.1, 2.4,
      2.6, 1.1, 2.6,
      1.4, 0.4, 1.4,
      1.6, 0.4, 1.6,
      1.4, 1.1, 1.4,
      1.6, 1.1, 1.6
    ]),
    colorsRgb: new Float32Array([
      0.2, 0.35, 1,
      0.2, 0.35, 1,
      0.2, 0.35, 1,
      0.2, 0.35, 1,
      0.75, 0.9, 1,
      0.75, 0.9, 1,
      0.75, 0.9, 1,
      0.75, 0.9, 1
    ]),
    materials: [
      { material: 'h2o', phase: 'liquid', renderKey: 'h2o', renderDomainId: 1, renderDomainKey: 'base' },
      { material: 'h2o', phase: 'liquid', renderKey: 'h2o', renderDomainId: 1, renderDomainKey: 'base' },
      { material: 'h2o', phase: 'liquid', renderKey: 'h2o', renderDomainId: 2, renderDomainKey: 'drop' },
      { material: 'h2o', phase: 'liquid', renderKey: 'h2o', renderDomainId: 2, renderDomainKey: 'drop' },
      { material: 'h2o', phase: 'solid', renderKey: 'ice', renderDomainId: 1, renderDomainKey: 'base' },
      { material: 'h2o', phase: 'solid', renderKey: 'ice', renderDomainId: 1, renderDomainKey: 'base' },
      { material: 'h2o', phase: 'solid', renderKey: 'ice', renderDomainId: 2, renderDomainKey: 'drop' },
      { material: 'h2o', phase: 'solid', renderKey: 'ice', renderDomainId: 2, renderDomainKey: 'drop' }
    ]
  });

  const merged = mergeSameMaterialPhaseSurfaceBatchesForRenderField(batches, {
    phasePredicate: (phase) => phase === 'liquid'
  });

  assert.deepEqual(
    merged.map((batch) => [batch.surfaceKey, batch.phase, batch.renderDomainId, batch.count]).sort(),
    [
      ['h2o|h2o|liquid', 'liquid', 0, 4],
      ['ice|h2o|solid|domain:base', 'solid', 1, 2],
      ['ice|h2o|solid|domain:drop', 'solid', 2, 2]
    ]
  );
});

test('SPH phase renderer creates event-only product surfaces from reaction inventory', () => {
  const baseBatches = createContinuousSurfaceBatches({
    boxEdgeM: 5,
    positionsM: new Float32Array([
      2.4, 0.4, 2.4,
      2.6, 0.4, 2.6
    ]),
    colorsRgb: new Float32Array([
      0.2, 0.35, 1,
      0.2, 0.35, 1
    ]),
    materials: [
      { material: 'h2o', phase: 'liquid', renderKey: 'h2o' },
      { material: 'h2o', phase: 'liquid', renderKey: 'h2o' }
    ]
  });
  const eventBatches = createProductEventSurfaceBatches({
    baseBatches,
    reactionSummary: {
      productInventory: {
        records: [
          {
            material: 'h2',
            productTermIndex: 1,
            reactionIndex: 0,
            routing: 'gas',
            unplacedMassKg: 0.002,
            eventCount: 3,
            status: 'ready'
          },
          {
            material: 'h2o',
            productTermIndex: 2,
            reactionIndex: 0,
            routing: 'condensed',
            unplacedMassKg: 0.1,
            eventCount: 1,
            status: 'ready'
          }
        ]
      }
    },
    reactionTable: {
      productTermMetadata: [
        { productTermIndex: 1, material: 'h2', routing: 'gas', reactionIndex: 0 },
        { productTermIndex: 2, material: 'h2o', routing: 'condensed', reactionIndex: 0 }
      ]
    },
    materialProperties: {
      h2: {
        phases: [{ name: 'gas', densityKgPerM3: 0.09 }]
      },
      h2o: {
        phases: [{ name: 'liquid', densityKgPerM3: 997 }]
      }
    },
    smoothingLengthM: 0.2
  });

  assert.equal(eventBatches.length, 1);
  assert.equal(eventBatches[0].material, 'h2');
  assert.equal(eventBatches[0].phase, 'gas');
  assert.equal(eventBatches[0].source, 'reaction-product-event-buffer');
  assert.equal(eventBatches[0].count, 3);
  assert.equal(eventBatches[0].surfaceRadiusM, 0.2);
  assert.ok(eventBatches[0].colorsRgb.length === 9);
  assert.ok(!eventBatches.some((batch) => batch.material === 'h2o'));
});

test('SPH surface radius is independent of box size while the MLS-MPM grid grows', () => {
  const positionsM = new Float32Array([
    2.4, 0.4, 2.4,
    2.6, 0.4, 2.6,
    2.4, 0.6, 2.4,
    2.6, 0.6, 2.6
  ]);
  const colorsRgb = new Float32Array([
    0.9, 0.9, 0.9,
    0.9, 0.9, 0.9,
    0.9, 0.9, 0.9,
    0.9, 0.9, 0.9
  ]);
  const materials = Array.from({ length: 4 }, () => ({ material: 'h2o', phase: 'solid', renderKey: 'ice' }));
  const small = createContinuousSurfaceBatches({
    positionsM,
    colorsRgb,
    materials,
    boxDimsM: [5, 5, 5],
    smoothingLengthM: 0.32
  });
  const large = createContinuousSurfaceBatches({
    positionsM,
    colorsRgb,
    materials,
    boxDimsM: [10, 10, 10],
    smoothingLengthM: 0.32
  });

  assert.equal(small.length, 1);
  assert.equal(large.length, 1);
  assert.equal(large[0].surfaceRadiusM, small[0].surfaceRadiusM);

  const smallGrid = createMlsMpmGridSpec({ boxDimsM: [5, 5, 5], gridSpacingM: 0.32 });
  const largeGrid = createMlsMpmGridSpec({ boxDimsM: [10, 10, 10], gridSpacingM: 0.32 });
  assert.ok(largeGrid.gridDims.every((dim, index) => dim > smallGrid.gridDims[index]));
  assert.ok(largeGrid.gridNodeCount > smallGrid.gridNodeCount);
});

test('SPH renderer converts physical blob radius into padded render-field units', () => {
  const radiusM = 0.4266666667;
  const refEdgeM = 5;
  const fieldPadding = 0.22;
  const fieldSpan = 1 - 2 * fieldPadding;
  const radiusNorm = normalizeSurfaceRadiusForRenderField(radiusM, refEdgeM, fieldPadding);

  assert.ok(Math.abs(radiusNorm - ((radiusM / refEdgeM) * fieldSpan)) < 1e-12);
  assert.ok(Math.abs(surfaceRadiusMetersFromRenderFieldRadius(radiusNorm, refEdgeM, fieldPadding) - radiusM) < 1e-12);
  assert.ok(radiusNorm < radiusM / refEdgeM);
});

test('SPH renderer defaults to a bounded isosurface radius scale', () => {
  assert.equal(SPH_SURFACE_RADIUS_SCALE_DEFAULT, 0.15);
  assert.ok(SPH_SURFACE_RADIUS_SCALE_DEFAULT > 0);
  assert.ok(SPH_SURFACE_RADIUS_SCALE_DEFAULT <= 0.5);
  assert.equal(SPH_SPARSE_SURFACE_RADIUS_SCALE_MIN, 0.2);
  assert.equal(SPH_SPARSE_SURFACE_RADIUS_SCALE_MAX_PARTICLES, 27);
  assert.equal(SPH_SPARSE_RENDER_FIELD_RESOLUTION_MIN, 64);
  assert.equal(SPH_CPU_MARCHING_CUBES_RESOLUTION_MIN, 32);
  assert.equal(SPH_CPU_MARCHING_CUBES_RADIUS_FLOOR_CELLS, 0.5);
  assert.equal(surfaceRadiusScaleForRenderBatch({ count: 27 }, SPH_SURFACE_RADIUS_SCALE_DEFAULT), 0.2);
  assert.equal(surfaceRadiusScaleForRenderBatch({ count: 28 }, SPH_SURFACE_RADIUS_SCALE_DEFAULT), 0.15);
  assert.equal(surfaceRadiusScaleForRenderBatch({ count: 27 }, 0.3), 0.3);
  assert.equal(
    cpuMarchingCubesRadiusFloorM(5, SPH_CPU_MARCHING_CUBES_RESOLUTION_MIN),
    cpuMarchingCubesCellSizeM(5, SPH_CPU_MARCHING_CUBES_RESOLUTION_MIN) * SPH_CPU_MARCHING_CUBES_RADIUS_FLOOR_CELLS
  );
  assert.ok(cpuMarchingCubesRadiusFloorM(5, SPH_CPU_MARCHING_CUBES_RESOLUTION_MIN) < 0.15);
  assert.ok(cpuMarchingCubesRadiusFloorM(5, SPH_SPARSE_RENDER_FIELD_RESOLUTION_MIN) < cpuMarchingCubesRadiusFloorM(5, SPH_CPU_MARCHING_CUBES_RESOLUTION_MIN));
});

test('H2O liquid render fields derive a bounded J-aware continuity radius from SPH support and sampling', () => {
  const batch = {
    material: 'h2o',
    phase: 'liquid',
    source: 'resident-material-domain-seed',
    count: 125,
    representativeParticleRadiusM: 0.1,
    smoothingLengthM: 0.248
  };
  const policy = resolveRenderFieldParticleRadiusPolicy({
    batch,
    requestedScale: 1,
    isolation: 80,
    subtract: 24,
    resolution: 96,
    fieldPadding: 0.22,
    refEdgeM: 3
  });
  const supportMultiplier = Math.sqrt(104 / 24);
  const samplingCellSizeM = 3 / (0.56 * 96);
  const expectedScale = (0.248 / supportMultiplier + samplingCellSizeM * 0.5) / 0.1;
  assert.equal(policy.status, 'h2o-liquid-continuity-floor-applied');
  assert.equal(policy.mode, 'retained-particle-radius-with-h2o-liquid-continuity-floor');
  assert.equal(policy.eligible, true);
  assert.equal(policy.floorApplied, true);
  assert.ok(Math.abs(policy.supportMultiplier - supportMultiplier) < 1e-12);
  assert.ok(Math.abs(policy.samplingCellSizeM - samplingCellSizeM) < 1e-12);
  assert.ok(Math.abs(policy.resolvedScale - expectedScale) < 1e-12);
  assert.ok(policy.resolvedScale > 1.45 && policy.resolvedScale < 1.5);
  assert.ok(policy.resolvedScale <= SPH_H2O_LIQUID_CONTINUITY_RADIUS_SCALE_MAX);

  const alreadyLarge = resolveRenderFieldParticleRadiusPolicy({
    batch,
    requestedScale: 1.6,
    isolation: 80,
    subtract: 24,
    resolution: 96,
    fieldPadding: 0.22,
    refEdgeM: 3
  });
  assert.equal(alreadyLarge.status, 'h2o-liquid-continuity-floor-not-needed');
  assert.equal(alreadyLarge.floorApplied, false);
  assert.equal(alreadyLarge.resolvedScale, 1.6);

  for (const ineligibleBatch of [
    { ...batch, material: 'naoh' },
    { ...batch, source: 'reaction-product-event-buffer' },
    { ...batch, representativeParticleRadiusM: null }
  ]) {
    const ineligible = resolveRenderFieldParticleRadiusPolicy({
      batch: ineligibleBatch,
      requestedScale: 1,
      isolation: 80,
      subtract: 24,
      resolution: 96,
      fieldPadding: 0.22,
      refEdgeM: 3
    });
    assert.equal(ineligible.eligible, false);
    assert.equal(ineligible.floorApplied, false);
    assert.equal(ineligible.resolvedScale, 1);
    assert.equal(ineligible.mode, 'retained-particle-physical-radius');
  }

  const explicit = resolveRenderFieldParticleRadiusPolicy({
    batch,
    requestedScale: 1,
    explicitSurfaceRadius: true
  });
  assert.equal(explicit.mode, 'surface-wide-constant-strength');
  assert.equal(explicit.resolvedScale, 0);
});

test('placed liquid reaction products without a host radius use real SPH support for surface reconstruction', () => {
  const batch = {
    material: 'naoh',
    phase: 'liquid',
    source: 'resident-known-phase-surface',
    reactionProductMaterial: true,
    count: 1,
    representativeParticleRadiusM: null,
    smoothingLengthM: 0.248
  };
  const policy = resolveRenderFieldParticleRadiusPolicy({
    batch,
    requestedScale: SPH_SURFACE_RADIUS_SCALE_DEFAULT,
    isolation: 80,
    subtract: 24,
    resolution: 96,
    fieldPadding: 0.22,
    refEdgeM: 3
  });
  const supportMultiplier = Math.sqrt(104 / 24);
  const samplingCellSizeM = 3 / (0.56 * 96);
  const expectedRadiusM = 0.248 / supportMultiplier;

  assert.equal(SPH_REACTION_PRODUCT_LIQUID_CONTINUITY_RADIUS_SCALE_MAX, 12);
  assert.equal(policy.status, 'reaction-product-liquid-surface-support-floor-applied');
  assert.equal(policy.mode, 'surface-wide-reaction-product-smoothing-support-radius');
  assert.equal(policy.eligible, true);
  assert.equal(policy.floorApplied, true);
  assert.equal(policy.resolvedScale, 0);
  assert.equal(policy.representativeParticleRadiusM, null);
  assert.ok(Math.abs(policy.samplingCellSizeM - samplingCellSizeM) < 1e-12);
  assert.ok(Math.abs(policy.surfaceSupportRadiusM - expectedRadiusM) < 1e-12);
  assert.equal(policy.targetIsoradiusM, policy.surfaceSupportRadiusM);

  const eventOnly = resolveRenderFieldParticleRadiusPolicy({
    batch: { ...batch, source: 'reaction-product-event-buffer' },
    requestedScale: SPH_SURFACE_RADIUS_SCALE_DEFAULT,
    isolation: 80,
    subtract: 24,
    resolution: 96,
    fieldPadding: 0.22,
    refEdgeM: 3
  });
  assert.equal(eventOnly.eligible, false);
  assert.equal(eventOnly.mode, 'retained-particle-physical-radius');
});

test('gas render fields use alias-safe resolution and a bounded smoothing-support continuity radius', () => {
  const batch = {
    material: 'F',
    phase: 'gas',
    source: 'resident-known-phase-surface',
    count: 125,
    representativeParticleRadiusM: 0.1,
    smoothingLengthM: 0.248
  };
  const policy = resolveRenderFieldParticleRadiusPolicy({
    batch,
    requestedScale: 1,
    isolation: 24,
    subtract: 10,
    resolution: 64,
    fieldPadding: 0.22,
    refEdgeM: 4
  });
  const supportMultiplier = Math.sqrt(34 / 10);
  const samplingCellSizeM = 4 / (0.56 * 64);
  const expectedScale = (0.248 / supportMultiplier + samplingCellSizeM * 0.5) / 0.1;

  assert.equal(SPH_GAS_CONTINUITY_RADIUS_SCALE_MAX, 2);
  assert.equal(renderFieldBatchNeedsAliasSafeResolution(batch), true);
  assert.equal(renderFieldBatchNeedsAliasSafeResolution({ ...batch, phase: 'liquid' }), false);
  assert.equal(policy.status, 'gas-vapor-continuity-floor-applied');
  assert.equal(policy.mode, 'retained-particle-radius-with-gas-vapor-continuity-floor');
  assert.equal(policy.eligible, true);
  assert.equal(policy.floorApplied, true);
  assert.ok(Math.abs(policy.resolvedScale - expectedScale) < 1e-12);
  assert.ok(policy.resolvedScale > 1.8 && policy.resolvedScale < 2);
  assert.ok(policy.resolvedScale <= SPH_GAS_CONTINUITY_RADIUS_SCALE_MAX);
});

test('resident render surfaces canonicalize fluorine aliases by stable material identity', () => {
  const fluorineProperties = {
    phases: [{ name: 'gas', densityKgPerM3: 1.696 }],
    molarMassKgPerMol: 0.018998403163,
    gasElectronicExcitationEv: 4.34,
    gasElectronicBandFwhmEv: 0.72,
    gasElectronicOscillatorStrength: 1e-3
  };
  const materialProperties = { F: fluorineProperties };
  const reactionTable = {
    metadata: [{
      a: 'Cs',
      b: 'f',
      product: 'csf',
      reactantTerms: [{ material: 'f', materialId: stableOpticalMaterialId('f') }],
      productTerms: [{ material: 'csf', materialId: stableOpticalMaterialId('csf') }]
    }]
  };
  const raw = [
    {
      surfaceKey: 'F|F|gas|domain:base',
      renderKey: 'F',
      material: 'F',
      phase: 'gas',
      renderDomainId: 1,
      renderDomainKey: 'base',
      count: 1,
      positionsM: [0, 0, 0],
      normalizedPositions: [0, 0, 0],
      colorsRgb: [1, 1, 1],
      bounds: { min: [0, 0, 0], max: [0, 0, 0] }
    },
    {
      surfaceKey: 'f|f|gas|domain:reaction',
      renderKey: 'f',
      material: 'f',
      phase: 'gas',
      renderDomainId: 2,
      renderDomainKey: 'reaction',
      count: 1,
      positionsM: [0.1, 0, 0],
      normalizedPositions: [0.1, 0, 0],
      colorsRgb: [1, 1, 1],
      bounds: { min: [0.1, 0, 0], max: [0.1, 0, 0] }
    }
  ];
  const canonical = canonicalizeResidentRenderSurfaceBatchMaterials(raw, {
    materialProperties,
    reactionTable
  });
  assert.deepEqual(canonical.map((batch) => batch.material), ['F', 'F']);
  assert.deepEqual(canonical.map((batch) => batch.renderKey), ['F', 'F']);
  assert.equal(
    materialPropertiesForSurfaceDescriptor(
      { material: 'f', renderKey: 'f' },
      materialProperties
    ),
    fluorineProperties
  );

  const merged = mergeSameMaterialPhaseSurfaceBatchesForRenderField(canonical);
  assert.equal(merged.length, 1);
  assert.equal(merged[0].material, 'F');
  assert.equal(merged[0].phase, 'gas');
  assert.equal(merged[0].count, 2);
  const opticalTable = createOpticalGpuTableForSurfaceBatches(merged, {
    materialProperties
  });
  assert.equal(opticalTable.recordCount, 1);
  assert.equal(opticalTable.recordMetadata[0].materialId, stableOpticalMaterialId('F'));
  assert.equal(opticalTable.recordMetadata[0].blocked, false);
});

test('resident H2O gas summary remains diagnostic and cannot create condensed optical authority', () => {
  const baselineSummary = {
    schema: 'peercompute.ulg.sph-sealed-gas-pressure-summary.v0',
    status: 'closure-derived-gas-pressure-diagnostic',
    source: 'cpu-particle-state',
    gasVolumeM3: 124,
    condensedVolumeM3: 1,
    boxVolumeM3: 125,
    boxDimsM: [5, 5, 5],
    bySpecies: {
      air: {
        material: 'air',
        massKg: 150,
        moles: 5175,
        temperatureK: 293.15,
        partialPressurePa: 101325
      }
    }
  };
  const materialProperties = {
    h2o: {
      molarMassKgPerMol: 0.01801528,
      phases: [
        { name: 'liquid', densityKgPerM3: 997, temperatureK: 293.15 },
        { name: 'gas', densityKgPerM3: 0.6, temperatureK: 373.15 }
      ]
    }
  };
  const steam = {
    surfaceKey: 'steam|h2o|gas',
    renderKey: 'steam',
    material: 'h2o',
    phase: 'gas',
    descriptor: {
      surfaceKey: 'steam|h2o|gas',
      renderKey: 'steam',
      material: 'h2o',
      phase: 'gas',
      opticalState: null,
      opticalStateKey: 'default'
    }
  };
  const fluorine = {
    surfaceKey: 'F|F|gas',
    renderKey: 'F',
    material: 'F',
    phase: 'gas',
    descriptor: { renderKey: 'F', material: 'F', phase: 'gas' }
  };
  const residentStep = {
    diagnostics: {
      residentPhaseGasSpeciesSummary: {
        bySpecies: {
          h2o: {
            material: 'h2o',
            massKg: 100,
            temperatureK: 373.15,
            phaseWeight: 12.5,
            status: 'resident-phase-gas-species-ready'
          }
        }
      }
    }
  };
  const pressure = residentRenderGasPressureSummary({
    baselineSummary,
    residentStep,
    fieldBatches: [steam, fluorine],
    materialProperties
  });
  const updated = applyResidentWaterVaporOpticalStateToSurfaceBatches(
    [steam, fluorine],
    pressure
  );

  assert.equal(pressure.source, 'gpu-resident-compact-thermal-phase-single-species');
  assert.equal(pressure.residentThermalGasMassKg, 100);
  assert.equal(updated[0].descriptor.opticalState, null);
  assert.equal(updated[0].descriptor.opticalStateKey, 'default');
  assert.equal(updated[0].surfaceKey, steam.surfaceKey);
  assert.equal(
    residentSurfaceBatchIdentitySignature(updated),
    residentSurfaceBatchIdentitySignature([steam, fluorine])
  );
  assert.equal(
    residentSurfaceBatchOpticalSignature(updated),
    residentSurfaceBatchOpticalSignature([steam, fluorine])
  );
  assert.equal(
    updated[0].descriptor.opticalStateId ?? 0,
    renderDescriptorForSurfaceRecord(steam, 0).opticalStateId
  );
  assert.equal(updated[1], fluorine);
});

test('SPH phase renderer reserves positive optical IDs exclusively for canonical collective routes', () => {
  const waterRoute = collectiveOpticalRouteDescriptor({
    material: 'h2o',
    vaporPhase: 'gas',
    condensedPhase: 'liquid'
  });
  const carbonRoute = collectiveOpticalRouteDescriptor({
    material: 'C',
    vaporPhase: 'gas',
    condensedPhase: 'solid'
  });
  const descriptorSet = buildResidentCollectiveOpticalRouteDescriptorSet({
    ordinaryDescriptors: [
      { material: 'h2o', phase: 'liquid', renderKey: 'h2o' },
      { material: 'C', phase: 'solid', renderKey: 'carbon' }
    ],
    collectiveRoutes: [carbonRoute, waterRoute]
  });
  assert.deepEqual(
    descriptorSet.ordinaryDescriptors.map((entry) => entry.opticalStateId),
    [0, 0]
  );
  assert.deepEqual(
    new Set(descriptorSet.collective.map(({ route, descriptor }) => {
      assert.equal(descriptor.surfaceKey, route.routeKey);
      assert.equal(descriptor.collectiveOpticalRoute, true);
      assert.equal(descriptor.routeId, route.routeId);
      assert.equal(descriptor.materialId, route.materialId);
      assert.equal(descriptor.condensedPhase, route.condensedPhase);
      assert.equal(descriptor.condensedPhaseId, route.condensedPhaseId);
      assert.equal(descriptor.vaporPhase, route.vaporPhase);
      assert.equal(descriptor.vaporPhaseId, route.vaporPhaseId);
      assert.equal(descriptor.closureModel, route.closureModel);
      assert.equal(descriptor.closureModelId, route.closureModelId);
      return descriptor.opticalStateId;
    })),
    new Set([waterRoute.routeId, carbonRoute.routeId])
  );
  const waterDescriptor = descriptorSet.collective.find(
    ({ route }) => route.material === waterRoute.material
  );
  const surfaceTable = buildSphRenderFieldSurfaceTable([{
    ...waterDescriptor.descriptor,
    resolution: 4
  }]);
  const reconstructed = renderDescriptorForSurfaceRecord(
    surfaceTable.metadata[0],
    0
  );
  assert.equal(reconstructed.opticalStateId, waterRoute.opticalStateId);
  assert.equal(reconstructed.collectiveOpticalRoute, true);
  assert.equal(
    reconstructed.collectiveOpticalRouteSchema,
    waterRoute.schema
  );
  assert.equal(reconstructed.collectiveOpticalRouteKey, waterRoute.routeKey);
  assert.equal(reconstructed.surfaceKey, waterRoute.routeKey);
  assert.equal(reconstructed.routeId, waterRoute.routeId);
  assert.equal(reconstructed.materialId, waterRoute.materialId);
  assert.equal(reconstructed.condensedPhase, waterRoute.condensedPhase);
  assert.equal(reconstructed.condensedPhaseId, waterRoute.condensedPhaseId);
  assert.throws(
    () => buildResidentCollectiveOpticalRouteDescriptorSet({
      collectiveRoutes: [waterRoute, waterRoute]
    }),
    /unique canonical route descriptors/
  );
  assert.throws(
    () => buildResidentCollectiveOpticalRouteDescriptorSet({
      collectiveRoutes: [{
        ...waterRoute,
        routeKey: 'forged',
        surfaceIdentityKey: 'forged',
        routeId: 123,
        opticalStateId: 123
      }]
    }),
    /contradicts the canonical collective route identity/
  );
});

test('native surface bridge reuse is independent of optical material identities and capacities', () => {
  const device = {};
  const context = {};
  const legacyLayout = 'peercompute.ulg.sph-gpu-render-surface-vertex-row.v0';
  const bridge = {
    rendererBridge: 'native-webgpu-surface-consumer',
    released: false,
    deviceLost: false,
    device,
    context,
    format: 'rgba8unorm',
    bindGroupLayout: {},
    cameraBuffer: {},
    cameraBufferByteLength: 64,
    opaquePipeline: {},
    refractivePipeline: {},
    vaporPipeline: {},
    refractiveBackfacePipeline: null,
    envSampler: {},
    surfaceInputLayout: legacyLayout,
    opticalGpuBuffers: {
      recordsBuffer: {},
      recordsBufferByteLength: 16,
      spectralSamplesBuffer: {},
      spectralSamplesBufferByteLength: 16
    },
    opticalGpuTableReuseKey: 'one-record',
    opticalGpuTableBindingLayoutSignature: 'sodium:liquid:0',
    fieldGradientDummyBuffer: {},
    temperatureDummyBuffer: {},
    refractionBindGroupLayout: {},
    refractionSampler: {},
    refractionDummyTexture: {},
    refractionDummyBindGroup: {},
    refractionBackfaceDummyTexture: {},
    refractionBackfaceDummyView: {},
    envDummyTexture: {},
    envDummyView: {}
  };
  const request = {
    device,
    context,
    format: 'rgba8unorm',
    surfaceInputLayout: legacyLayout,
    cameraBufferByteLength: 64
  };

  assert.equal(canReuseSphNativeSurfaceDrawRenderBridge(bridge, request), true);
  assert.equal(
    canReuseSphNativeSurfaceDrawRenderBridge(bridge, {
      ...request,
      device: {}
    }),
    false
  );
  assert.equal(
    canReuseSphNativeSurfaceDrawRenderBridge(bridge, {
      ...request,
      cameraBufferByteLength: 65
    }),
    false
  );
  bridge.opticalGpuTableReuseKey = 'many-records';
  bridge.opticalGpuTableBindingLayoutSignature = 'cesium:gas:93|water:liquid:4';
  bridge.opticalGpuBuffers.recordsBufferByteLength = 4;
  bridge.opticalGpuBuffers.spectralSamplesBufferByteLength = 4;
  assert.equal(
    canReuseSphNativeSurfaceDrawRenderBridge(bridge, request),
    true,
    'material IDs and replacement-buffer capacity do not select a program'
  );

  const compactRequest = {
    ...request,
    surfaceInputLayout: 'webgpu-marching-cubes-compact-position-rows',
    cameraBufferByteLength: SPH_RESIDENT_SURFACE_DRAW_COMPACT_POSITION_CAMERA_UNIFORM_BYTE_LENGTH
  };
  bridge.surfaceInputLayout = compactRequest.surfaceInputLayout;
  bridge.cameraBufferByteLength = compactRequest.cameraBufferByteLength;
  assert.equal(
    canReuseSphNativeSurfaceDrawRenderBridge(bridge, compactRequest),
    false,
    'compact input requires its stable backface pipeline ABI'
  );
  bridge.refractiveBackfacePipeline = {};
  assert.equal(canReuseSphNativeSurfaceDrawRenderBridge(bridge, compactRequest), true);
  bridge.released = true;
  assert.equal(canReuseSphNativeSurfaceDrawRenderBridge(bridge, compactRequest), false);
});

test('SPH phase renderer derives a packed optical GPU table from surface batches', () => {
  const batches = createContinuousSurfaceBatches({
    boxEdgeM: 5,
    positionsM: new Float32Array([
      2.4, 0.4, 2.4,
      2.6, 0.4, 2.6,
      2.4, 2.8, 2.4,
      2.6, 2.8, 2.6
    ]),
    colorsRgb: new Float32Array([
      0.9, 0.9, 0.9,
      0.9, 0.9, 0.9,
      1.0, 0.8, 0.4,
      1.0, 0.8, 0.4
    ]),
    materials: [
      { material: 'h2o', phase: 'solid', renderKey: 'ice' },
      { material: 'h2o', phase: 'gas', renderKey: 'steam' },
      { material: 'Au', phase: 'solid', renderKey: 'Au' },
      { material: 'Au', phase: 'solid', renderKey: 'Au' }
    ]
  });
  const table = createOpticalGpuTableForSurfaceBatches(batches, {
    materialProperties: {
      Au: {
        conductionElectronDensityPerM3: 5.9e28,
        opticalInterbandOscillators: []
      }
    }
  });

  assert.equal(table.schema, 'peercompute.ulg.optical-gpu-table.v0');
  assert.equal(table.recordCount, 3);
  assert.ok(table.spectralSampleCount > 0);
  assert.deepEqual(
    table.recordMetadata.map((record) => `${record.material}|${record.phase}`).sort(),
    ['Au|solid', 'h2o|gas', 'h2o|solid']
  );
  assert.match(table.wgslStructs, /OpticalMaterialRecord/);
});

test('SPH phase renderer rejects pressure-derived optical cohorts on an ordinary carrier binding', () => {
  const clearVaporState = {
    temperatureK: 450,
    h2oPartialPressurePa: 100,
    pressurePa: 101325
  };
  const supersaturatedState = {
    temperatureK: 300,
    h2oPartialPressurePa: 1e6,
    pressurePa: 1e6
  };
  const batches = createContinuousSurfaceBatches({
    boxEdgeM: 5,
    positionsM: new Float32Array([
      2.4, 0.4, 2.4,
      2.6, 0.6, 2.6
    ]),
    colorsRgb: new Float32Array([
      1, 1, 1,
      0.7, 0.85, 1
    ]),
    materials: [
      { material: 'h2o', phase: 'gas', renderKey: 'steam', opticalState: clearVaporState },
      { material: 'h2o', phase: 'gas', renderKey: 'steam', opticalState: supersaturatedState }
    ]
  });
  assert.equal(batches.length, 2);
  assert.ok(new Set(batches.map((batch) => batch.surfaceKey)).size === 2);
  assert.deepEqual(
    batches.map((batch) => batch.descriptor.opticalStateId),
    [0, 0]
  );
  assert.throws(
    () => createOpticalGpuTableForSurfaceBatches(batches),
    /conflicting optical states share GPU binding/
  );
});

test('SPH phase renderer derives optical GPU lookup rows for active surface batches', () => {
  const batches = createContinuousSurfaceBatches({
    boxEdgeM: 5,
    positionsM: new Float32Array([
      2.4, 0.4, 2.4,
      2.6, 2.8, 2.6
    ]),
    colorsRgb: new Float32Array([
      0.9, 0.9, 0.9,
      1.0, 0.8, 0.4
    ]),
    materials: [
      { material: 'h2o', phase: 'liquid', renderKey: 'h2o' },
      { material: 'Au', phase: 'solid', renderKey: 'Au' }
    ]
  });
  const table = createOpticalGpuTableForSurfaceBatches(batches, {
    materialProperties: {
      Au: {
        conductionElectronDensityPerM3: 5.9e28,
        opticalInterbandOscillators: []
      }
    }
  });
  const lookup = createOpticalGpuLookupForSurfaceBatches(table, batches);

  assert.equal(lookup.lookup.schema, 'peercompute.ulg.optical-gpu-lookup.v0');
  assert.equal(lookup.lookup.queryCount, 2);
  assert.deepEqual(lookup.surfaceKeys, batches.map((batch) => batch.surfaceKey));
  assert.equal(lookup.cpuReference.outputs.length, lookup.lookup.queryCount * lookup.lookup.outputStrideFloats);
  assert.equal(lookup.cpuReference.outputs[11], 0);
  assert.equal(lookup.cpuReference.outputs[lookup.lookup.outputStrideFloats + 11], 1);
});

test('SPH phase renderer keeps surface optical rows closure-owned when bank metadata is attached', () => {
  const goldSrgb = [0.974261208026, 0.437181207287, 0.095032056649];
  const warmInputTable = {
    schema: 'peercompute.ulg.material-property-bank.gpu-warm-input-table.v0',
    status: 'material-bank-gpu-warm-input-table-ready',
    rowLayout: [
      'materialId:f32',
      'atomicNumber:f32',
      'temperatureK:f32',
      'pressurePa:f32',
      'targetNeighborCount:f32',
      'phaseCount:f32',
      'baseColorSrgbR:f32',
      'baseColorSrgbG:f32',
      'baseColorSrgbB:f32',
      'metalness:f32',
      'roughness:f32',
      'ior:f32',
      'strictSourceOfTruth:f32',
      'status:f32',
      'pad0:f32',
      'pad1:f32'
    ],
    rowStrideFloats: 16,
    rowCount: 1,
    rows: Float32Array.from([
      stableOpticalMaterialId('Au'),
      79,
      293.15,
      101325,
      64,
      2,
      ...goldSrgb,
      1,
      0.32,
      1,
      0,
      1,
      0,
      0
    ]),
    metadata: [{
      role: 'drop',
      material: 'Au',
      requestedMaterial: 'Au',
      materialId: stableOpticalMaterialId('Au'),
      atomicNumber: 79,
      status: 'ready'
    }]
  };
  const batches = createContinuousSurfaceBatches({
    boxEdgeM: 5,
    positionsM: new Float32Array([
      2.4, 0.4, 2.4,
      2.6, 2.8, 2.6
    ]),
    colorsRgb: new Float32Array([
      1.0, 0.8, 0.4,
      1.0, 0.8, 0.4
    ]),
    materials: [
      { material: 'Au', phase: 'solid', renderKey: 'Au' },
      { material: 'Au', phase: 'solid', renderKey: 'Au' }
    ]
  });
  const table = createOpticalGpuTableForSurfaceBatches(batches, {
    materialProperties: {
      Au: {
        conductionElectronDensityPerM3: 5.9e28,
        opticalInterbandOscillators: []
      }
    },
    materialPropertyBankGpuWarmInputTable: warmInputTable
  });
  const goldRecord = table.recordMetadata.find((record) => record.material === 'Au');

  assert.equal(table.recordCount, 1);
  assert.equal(table.materialPropertyBankPbrWarmInputMatchedRecordCount, 1);
  assert.equal(goldRecord.displayPbrSource, 'closure-derived-optical-pbr');
  assert.ok(goldRecord.closurePbr.baseColorSrgb.some((value, index) => Math.abs(value - goldSrgb[index]) > 0.1));
  assert.deepEqual(goldRecord.displayPbr.baseColorSrgb, goldRecord.closurePbr.baseColorSrgb);
  assert.ok(Math.abs(opticalRecordField(table, goldRecord, 'baseColorLinearR') - srgbToLinear(goldRecord.closurePbr.baseColorSrgb[0])) < 1e-6);
  assert.ok(Math.abs(opticalRecordField(table, goldRecord, 'baseColorLinearG') - srgbToLinear(goldRecord.closurePbr.baseColorSrgb[1])) < 1e-6);
  assert.ok(Math.abs(opticalRecordField(table, goldRecord, 'baseColorLinearB') - srgbToLinear(goldRecord.closurePbr.baseColorSrgb[2])) < 1e-6);
  assert.equal(opticalRecordField(table, goldRecord, 'metalness'), 1);
  assert.ok(Math.abs(opticalRecordField(table, goldRecord, 'roughness') - 0.32) < 1e-6);
});

test('SPH renderer keeps condensed transmission alpha-one while vapor remains non-depth-writing', () => {
  const waterOptics = {
    material: 'h2o',
    phase: 'liquid',
    opacity: 0.0028,
    transmission: 0.977,
    metalness: 0
  };
  const vaporOptics = {
    material: 'h2o',
    phase: 'gas',
    opacity: 0.0028,
    transmission: 0.999,
    metalness: 0
  };

  assert.equal(renderAlphaFromOpticalResponse(waterOptics, waterOptics), 1);
  assert.equal(renderDepthWriteFromOpticalResponse(waterOptics, waterOptics), true);
  assert.equal(renderAlphaFromOpticalResponse(vaporOptics, vaporOptics), 0.0028);
  assert.equal(renderDepthWriteFromOpticalResponse(vaporOptics, vaporOptics), false);
});

test('SPH renderer gates vapor geometry from derived optical depth and scattering', () => {
  const clearVapor = {
    material: 'h2o',
    phase: 'gas',
    opacity: 0.001,
    transmission: 0.999,
    opticalDepth: 0.001,
    scatteringCoefficientPerM: 0
  };
  const barelyRetainedVapor = {
    ...clearVapor,
    opacity: 0.003,
    opticalDepth: 0.003
  };
  const weakAbsorbingVapor = {
    ...clearVapor,
    opacity: 0.0053,
    opticalDepth: 0.0053
  };
  const condensedSteam = {
    ...clearVapor,
    opacity: 0.2,
    opticalDepth: 0.2,
    scatteringCoefficientPerM: 0.01
  };
  const water = {
    material: 'h2o',
    phase: 'liquid',
    opacity: 0.001,
    transmission: 0.98,
    opticalDepth: 0.001,
    scatteringCoefficientPerM: 0
  };

  const hidden = resolveOpticalSurfaceVisibility({ optics: clearVapor, descriptorOrRow: clearVapor });
  const retained = resolveOpticalSurfaceVisibility({
    optics: barelyRetainedVapor,
    descriptorOrRow: barelyRetainedVapor,
    wasVisible: true
  });
  const shownByDepth = resolveOpticalSurfaceVisibility({
    optics: weakAbsorbingVapor,
    descriptorOrRow: weakAbsorbingVapor
  });
  const shownByDroplets = resolveOpticalSurfaceVisibility({
    optics: condensedSteam,
    descriptorOrRow: condensedSteam
  });
  const liquid = resolveOpticalSurfaceVisibility({ optics: water, descriptorOrRow: water });

  assert.equal(hidden.visible, false);
  assert.equal(hidden.reason, 'derived-pure-vapor-optically-thin');
  assert.equal(hidden.retainPreviousSurface, false);
  assert.equal(hidden.showOpticalDepth, 0.004);
  assert.equal(hidden.hideOpticalDepth, 0.002);
  assert.equal(retained.visible, true);
  assert.equal(retained.reason, 'derived-vapor-optical-depth-visible');
  assert.equal(shownByDepth.visible, true);
  assert.equal(shownByDepth.reason, 'derived-vapor-optical-depth-visible');
  assert.equal(shownByDroplets.visible, true);
  assert.equal(shownByDroplets.reason, 'derived-droplet-scattering-visible');
  assert.equal(liquid.visible, true);
  assert.equal(liquid.reason, 'non-vapor-surface');
});

test('SPH renderer publishes one closure-derived gas opacity contract for every consumer', () => {
  const hydrogen = closureDerivedSurfaceOpticalPresentation({
    optics: {
      material: 'h2',
      phase: 'gas',
      opacity: 0,
      opticalDepth: 5.8e-79,
      scatteringCoefficientPerM: 0,
      transmission: 1,
      roughness: 0.4,
      blocked: false,
      provenance: { source: 'molecular-gas-electronic-band-absorption' }
    },
    descriptorOrRow: { material: 'h2', phase: 'gas', renderKey: 'h2' }
  });
  const condensedSteam = closureDerivedSurfaceOpticalPresentation({
    optics: {
      material: 'h2o',
      phase: 'gas',
      opacity: 0.62,
      opticalDepth: 0.97,
      scatteringCoefficientPerM: 3.2,
      transmission: 0.38,
      roughness: 1,
      blocked: false,
      provenance: { source: 'conserved-droplet-scattering' }
    },
    descriptorOrRow: { material: 'h2o', phase: 'gas', renderKey: 'steam' }
  });
  const unknownGas = closureDerivedSurfaceOpticalPresentation({
    optics: { material: 'unknown', phase: 'gas', blocked: true },
    descriptorOrRow: { material: 'unknown', phase: 'gas' }
  });

  assert.equal(hydrogen.opticalResponseAuthorityFlag, 1);
  assert.equal(hydrogen.opticalResponseReady, true);
  assert.equal(hydrogen.opticalVisibilityReason, 'derived-pure-vapor-optically-thin');
  assert.equal(hydrogen.opticalEffectiveOpacity, 0);
  assert.equal(condensedSteam.opticalVisibilityReason, 'derived-droplet-scattering-visible');
  assert.equal(condensedSteam.opticalEffectiveOpacity, 0.62);
  assert.equal(condensedSteam.opticalProvenanceSource, 'conserved-droplet-scattering');
  assert.equal(unknownGas.opticalResponseAuthority, 'closure-blocked-gas-hidden');
  assert.equal(unknownGas.opticalEffectiveOpacity, 0);
});

test('SPH collective optical-depth isosurface derives Beer-Lambert opacity only for a ready canonical closure', () => {
  const route = collectiveOpticalRouteDescriptor({
    material: 'h2o',
    vaporPhase: 'gas',
    condensedPhase: 'liquid'
  });
  const descriptor = {
    ...route,
    collectiveOpticalRoute: true,
    collectiveOpticalRouteSchema: route.schema,
    collectiveOpticalRouteKey: route.routeKey
  };
  const closureMetadata = {
    rowIndex: 0,
    opticalStateId: route.opticalStateId,
    routeId: route.routeId,
    routeSchema: route.schema,
    routeKey: route.routeKey,
    dispersedMaterialId: route.materialId,
    condensedPhaseId: route.condensedPhaseId,
    status: SPH_DISPERSED_MEDIUM_OPTICAL_CLOSURE_STATUS.ready,
    provenance: { source: 'reference-index-runtime-radius-sphere-optics' }
  };
  const closureRows = new Float32Array(12);
  closureRows[
    SPH_DISPERSED_MEDIUM_OPTICAL_CLOSURE_ROW_LANES.morphologyModelId
  ] = SPH_DISPERSED_MEDIUM_OPTICAL_MORPHOLOGY_MODEL
    .singleCompactSphereComplexIndex;
  closureRows[
    SPH_DISPERSED_MEDIUM_OPTICAL_CLOSURE_ROW_LANES.relativeRefractiveIndexN
  ] = 1.3326;
  closureRows[
    SPH_DISPERSED_MEDIUM_OPTICAL_CLOSURE_ROW_LANES.relativeExtinctionCoefficientK
  ] = 0;
  const readyClosureTable = {
    schema: ULG_SPH_DISPERSED_MEDIUM_OPTICAL_CLOSURE_TABLE_SCHEMA,
    rows: closureRows,
    rowStrideFloats: closureRows.length,
    readyOpticalStateIds: [route.opticalStateId],
    metadata: [closureMetadata]
  };
  const presentation = collectiveOpticalDepthIsosurfacePresentation({
    // Reproduce the production mismatch: the static condensed-material row
    // can be optically thin even when the dynamic extinction field reaches
    // the tau=1 extraction boundary.
    optics: { opacity: 0, transmission: 1, blocked: false },
    descriptorOrRow: descriptor,
    closureTable: readyClosureTable
  });
  const expectedTransmission = Math.exp(-1);
  const expectedOpacity = 1 - expectedTransmission;

  assert.equal(
    presentation.opticalResponseAuthority,
    'conserved-dispersed-extinction-optical-depth-isosurface'
  );
  assert.equal(presentation.opticalResponseReady, true);
  const compactSurfaceTable = buildSphRenderFieldSurfaceTable([{
    ...descriptor,
    resolution: 4
  }]);
  const reconstructedPresentation = collectiveOpticalDepthIsosurfacePresentation({
    descriptorOrRow: renderDescriptorForSurfaceRecord(
      compactSurfaceTable.metadata[0],
      0
    ),
    closureTable: readyClosureTable
  });
  assert.equal(reconstructedPresentation.opticalResponseReady, true);
  assert.equal(presentation.opticalDepth, 1);
  assert.ok(Math.abs(presentation.opticalTransmission - expectedTransmission) < 1e-15);
  assert.ok(Math.abs(presentation.opticalEffectiveOpacity - expectedOpacity) < 1e-15);
  assert.equal(presentation.opticalVisibilityFlag, 1);
  assert.equal(presentation.opticalRoughness, 1);
  assert.equal(presentation.opticalSingleScatteringAlbedo, 1);
  assert.equal(presentation.opticalAchromaticScattering, true);
  assert.deepEqual(presentation.opticalScatteringSourceLinear, [1, 1, 1]);
  assert.equal(
    presentation.opticalProvenanceSource,
    'reference-index-runtime-radius-sphere-optics'
  );

  const batch = {
    surfaceKey: route.routeKey,
    material: route.material,
    phase: route.phase,
    renderKey: route.renderKey,
    opticalState: route.opticalState,
    opticalStateKey: descriptor.opticalStateKey,
    opticalStateId: route.opticalStateId,
    collectiveOpticalRoute: true,
    collectiveOpticalRouteKey: route.routeKey,
    descriptor,
    surfaceRadiusM: 0.05,
    count: 1
  };
  const ordinaryBatch = {
    surfaceKey: 'h2o|liquid|ordinary',
    material: 'h2o',
    phase: 'liquid',
    renderKey: 'h2o',
    opticalState: null,
    opticalStateKey: 'default',
    opticalStateId: 0,
    descriptor: {
      material: 'h2o',
      phase: 'liquid',
      renderKey: 'h2o',
      opticalState: null,
      opticalStateKey: 'default',
      opticalStateId: 0
    },
    surfaceRadiusM: 0.05,
    count: 1
  };
  const nativeTable = createOpticalGpuTableForSurfaceBatches([ordinaryBatch, batch], {
    dispersedMediumOpticalClosureTable: readyClosureTable
  });
  const ordinaryOnlyTable = createOpticalGpuTableForSurfaceBatches([ordinaryBatch], {
    dispersedMediumOpticalClosureTable: readyClosureTable
  });
  const nativeRecord = nativeTable.recordMetadata.find(
    (record) => record.opticalStateId === route.opticalStateId
  );
  const nativeValue = (name) => {
    const fieldIndex = nativeTable.recordLayout.findIndex(
      (field) => field.split(':')[0] === name
    );
    return nativeTable.records[
      nativeRecord.recordIndex * nativeTable.recordStrideFloats + fieldIndex
    ];
  };
  assert.equal(nativeTable.collectiveOpticalPresentationReadyCount, 1);
  assert.equal(nativeTable.collectiveOpticalPresentationBlockedCount, 0);
  assert.ok(Math.abs(nativeValue('transmission') - expectedTransmission) < 1e-6);
  assert.ok(Math.abs(nativeValue('opacity') - expectedOpacity) < 1e-6);
  assert.equal(nativeValue('roughness'), 1);
  assert.equal(nativeValue('opticalDepth'), 1);
  assert.equal(nativeValue('blocked'), 0);
  assert.equal(nativeValue('status'), 1);
  assert.equal(nativeValue('baseColorLinearR'), 1);
  assert.equal(nativeValue('baseColorLinearG'), 1);
  assert.equal(nativeValue('baseColorLinearB'), 1);
  assert.equal(nativeValue('attenuationLinearR'), 1);
  assert.equal(nativeValue('attenuationLinearG'), 1);
  assert.equal(nativeValue('attenuationLinearB'), 1);
  assert.equal(nativeValue('absorptionCoefficientPerM'), 0);
  assert.equal(nativeValue('scatteringCoefficientPerM'), 0);
  assert.equal(nativeRecord.blocked, false);
  assert.equal(nativeRecord.status, 1);
  assert.equal(nativeRecord.underlyingMaterialClosureBlocked, false);
  assert.equal(nativeRecord.collectiveOpticalAchromaticScattering, true);
  assert.deepEqual(
    Array.from(nativeTable.records.slice(0, nativeTable.recordStrideFloats)),
    Array.from(ordinaryOnlyTable.records),
    'adding a collective route must not rewrite the ordinary state-zero material row'
  );
  assert.equal(
    Object.hasOwn(readyClosureTable.metadata[0], 'collectiveOpticalPresentation'),
    false,
    'the source closure table must remain immutable'
  );
  const nativeLookup = createOpticalGpuLookupForSurfaceBatches(
    nativeTable,
    [ordinaryBatch, batch]
  );
  assert.equal(
    nativeLookup.cpuReference.outputs[
      nativeLookup.cpuReference.outputStrideFloats + 11
    ],
    nativeRecord.recordIndex,
    'the positive collective binding must resolve its exact row beside a state-zero bulk row'
  );
  assert.equal(
    nativeRecord.collectiveOpticalPresentation.opticalResponseAuthority,
    'conserved-dispersed-extinction-optical-depth-isosurface'
  );

  const blockedClosureTable = {
    ...readyClosureTable,
    readyOpticalStateIds: [],
    metadata: [{
      ...closureMetadata,
      status: SPH_DISPERSED_MEDIUM_OPTICAL_CLOSURE_STATUS.blocked
    }]
  };
  const blocked = collectiveOpticalDepthIsosurfacePresentation({
    optics: { opacity: 1, transmission: 0 },
    descriptorOrRow: descriptor,
    closureTable: blockedClosureTable
  });
  assert.equal(blocked.opticalResponseReady, false);
  assert.equal(blocked.opticalVisibilityFlag, 0);
  assert.equal(blocked.opticalEffectiveOpacity, 0);
  assert.equal(blocked.opticalBlockedFlag, 1);

  const blockedNativeTable = createOpticalGpuTableForSurfaceBatches([ordinaryBatch, batch], {
    dispersedMediumOpticalClosureTable: blockedClosureTable
  });
  const blockedRecord = blockedNativeTable.recordMetadata.find(
    (record) => record.opticalStateId === route.opticalStateId
  );
  const blockedValue = (name) => {
    const fieldIndex = blockedNativeTable.recordLayout.findIndex(
      (field) => field.split(':')[0] === name
    );
    return blockedNativeTable.records[
      blockedRecord.recordIndex * blockedNativeTable.recordStrideFloats + fieldIndex
    ];
  };
  assert.equal(blockedNativeTable.collectiveOpticalPresentationReadyCount, 0);
  assert.equal(blockedNativeTable.collectiveOpticalPresentationBlockedCount, 1);
  assert.equal(blockedValue('transmission'), 0);
  assert.equal(blockedValue('opacity'), 0);
  assert.equal(blockedValue('opticalDepth'), 0);
  assert.equal(blockedValue('blocked'), 1);
  assert.equal(blockedValue('status'), 255);
  assert.equal(blockedRecord.blocked, true);
  assert.equal(blockedRecord.status, 255);
  assert.equal(blockedRecord.underlyingMaterialClosureBlocked, false);

  const mismatchedRoute = collectiveOpticalDepthIsosurfacePresentation({
    descriptorOrRow: {
      ...descriptor,
      collectiveOpticalRouteKey: `${route.routeKey}|forged`
    },
    closureTable: readyClosureTable
  });
  assert.equal(mismatchedRoute.opticalResponseReady, false);
  assert.equal(mismatchedRoute.opticalEffectiveOpacity, 0);

  const forgedMaterial = collectiveOpticalDepthIsosurfacePresentation({
    descriptorOrRow: {
      ...descriptor,
      material: 'naoh',
      materialId: route.materialId
    },
    closureTable: readyClosureTable
  });
  assert.equal(forgedMaterial.opticalResponseReady, false);
  assert.equal(forgedMaterial.opticalEffectiveOpacity, 0);

  const forgedPhase = collectiveOpticalDepthIsosurfacePresentation({
    descriptorOrRow: {
      ...descriptor,
      phase: 'solid',
      condensedPhase: 'solid',
      phaseId: route.condensedPhaseId,
      condensedPhaseId: route.condensedPhaseId
    },
    closureTable: readyClosureTable
  });
  assert.equal(forgedPhase.opticalResponseReady, false);
  assert.equal(forgedPhase.opticalEffectiveOpacity, 0);
});

test('SPH resident render fields use hysteresis around the isosurface threshold', () => {
  const coldStart = resolveRenderFieldSurfaceVisibility({
    maxDensity: 79,
    isolation: 80,
    wasVisible: false
  });
  const retained = resolveRenderFieldSurfaceVisibility({
    maxDensity: 75,
    isolation: 80,
    wasVisible: true
  });
  const hidden = resolveRenderFieldSurfaceVisibility({
    maxDensity: 73,
    isolation: 80,
    wasVisible: true
  });

  assert.equal(coldStart.visible, false);
  assert.equal(coldStart.retainPreviousSurface, false);
  assert.equal(coldStart.renderIsolation, 80);
  assert.equal(retained.visible, true);
  assert.equal(retained.retainPreviousSurface, false);
  assert.equal(retained.renderIsolation, retained.hideIsolation);
  assert.ok(retained.renderIsolation < 80);
  assert.equal(hidden.visible, false);
  assert.equal(hidden.retainPreviousSurface, true);
  assert.equal(hidden.renderIsolation, 80);
});

test('SPH resident render fields retain previous mesh during inactive grace frames', () => {
  const calls = { reset: 0, update: 0 };
  const surface = {
    inactiveFrameCount: 0,
    config: { isolation: 80 },
    mesh: {
      visible: true,
      isolation: 74,
      userData: {},
      reset() {
        calls.reset += 1;
      },
      update() {
        calls.update += 1;
      }
    }
  };

  for (let frame = 0; frame < SPH_SURFACE_INACTIVE_GRACE_FRAMES; frame += 1) {
    assert.equal(hideRenderFieldSurfaceAfterGrace(surface, 'resident-gpu-render-field'), false);
    assert.equal(surface.mesh.visible, true);
    assert.equal(calls.reset, 0);
    assert.equal(calls.update, 0);
    assert.equal(surface.mesh.userData.renderSource, 'resident-gpu-render-field');
    assert.equal(surface.mesh.userData.surfaceInactiveFrameCount, frame + 1);
  }
  assert.equal(hideRenderFieldSurfaceAfterGrace(surface, 'resident-gpu-render-field'), true);
  assert.equal(surface.mesh.visible, false);
  assert.equal(surface.mesh.isolation, 80);
  assert.equal(calls.reset, 1);
  assert.equal(calls.update, 1);
});

test('SPH resident render fields hide empty surfaces without stale grace retention', () => {
  const calls = { reset: 0, update: 0 };
  const surface = {
    inactiveFrameCount: 0,
    config: { isolation: 80 },
    mesh: {
      visible: true,
      isolation: 74,
      userData: {},
      reset() {
        calls.reset += 1;
      },
      update() {
        calls.update += 1;
      }
    }
  };

  assert.equal(
    hideRenderFieldSurfaceAfterGrace(surface, 'resident-gpu-render-field', { immediate: true }),
    true
  );
  assert.equal(surface.mesh.visible, false);
  assert.equal(surface.mesh.isolation, 80);
  assert.equal(surface.mesh.userData.surfaceInactiveFrameCount, 1);
  assert.equal(calls.reset, 1);
  assert.equal(calls.update, 1);
});

test('SPH renderer gives surfaces stable intra-layer render order', () => {
  const baseOrder = SPH_PHASE_RENDER_ORDER.transmissiveSurface;
  const waterOrder = stableSurfaceRenderOrder(baseOrder, 'h2o|h2o|liquid');
  const steamOrder = stableSurfaceRenderOrder(baseOrder, 'steam|h2o|gas');

  assert.equal(stableSurfaceRenderOrder(baseOrder, 'h2o|h2o|liquid'), waterOrder);
  assert.notEqual(waterOrder, steamOrder);
  assert.ok(waterOrder >= baseOrder);
  assert.ok(waterOrder < baseOrder + 0.01);
});

test('SPH renderer gives all depth-writing surfaces stable intra-layer order', () => {
  const baseOrder = SPH_PHASE_RENDER_ORDER.transmissiveSurface;

  assert.notEqual(
    surfaceObjectRenderOrder(baseOrder, 'front-water', {
      renderLayer: 'refractive-surface',
      depthWrite: true
    }),
    surfaceObjectRenderOrder(baseOrder, 'back-water', {
      renderLayer: 'refractive-surface',
      depthWrite: true
    })
  );
  assert.notEqual(
    surfaceObjectRenderOrder(baseOrder, 'depth-writing-water-a', {
      renderLayer: 'refractive-surface',
      depthWrite: true
    }),
    surfaceObjectRenderOrder(baseOrder, 'depth-writing-water-b', {
      renderLayer: 'refractive-surface',
      depthWrite: true
    })
  );
  assert.notEqual(
    surfaceObjectRenderOrder(SPH_PHASE_RENDER_ORDER.opaqueSurface, 'iron-a', {
      renderLayer: 'opaque-surface',
      depthWrite: true
    }),
    surfaceObjectRenderOrder(SPH_PHASE_RENDER_ORDER.opaqueSurface, 'iron-b', {
      renderLayer: 'opaque-surface',
      depthWrite: true
    })
  );
});

test('SPH resident overlay draw order follows render policy metadata', () => {
  const order = residentSurfaceDrawOrder([
    { surfaceIndex: 0, renderOrder: 300, transparencyClassId: 1, depthWriteFlag: 0 },
    { surfaceIndex: 1, renderOrder: 100, transparencyClassId: 0, depthWriteFlag: 1 },
    {
      surfaceIndex: 2,
      renderOrder: 200,
      renderLayer: 'refractive-surface',
      transparencyClassId: 2,
      depthWriteFlag: 0
    }
  ], { indirectStrideBytes: 16 });

  assert.deepEqual(order.map((row) => row.surfaceIndex), [1, 2, 0]);
  assert.deepEqual(order.map((row) => row.indirectOffsetBytes), [16, 32, 0]);
  assert.deepEqual(order.map((row) => row.renderOrder), [100, 200, 300]);
  assert.deepEqual(order.map((row) => row.depthWriteFlag), [1, 0, 0]);
  const extensionOrder = residentSurfaceDrawOrder([
    {
      surfaceIndex: 5,
      indirectRowIndex: 0,
      indirectOffsetBytes: 0,
      renderOrder: 100,
      transparencyClassId: 0,
      depthWriteFlag: 1
    }
  ], { indirectStrideBytes: 16 });
  assert.deepEqual(extensionOrder.map((row) => row.surfaceIndex), [5]);
  assert.deepEqual(extensionOrder.map((row) => row.indirectRowIndex), [0]);
  assert.deepEqual(extensionOrder.map((row) => row.indirectOffsetBytes), [0]);
  assert.equal(residentSurfaceDrawPipelineKey(order[0]), 'opaque-depth-write');
  assert.equal(residentSurfaceDrawPipelineKey(order[1]), 'refractive-depth-write');
  assert.equal(residentSurfaceDrawPipelineKey(order[2]), 'vapor-alpha-blend');
  assert.equal(residentSurfaceDrawPipelineKey({ transparencyClassId: 2 }), 'refractive-depth-write');
  assert.equal(residentSurfaceDrawPipelineKey({ transparencyClassId: 1 }), 'vapor-alpha-blend');
  assert.equal(SPH_RESIDENT_SURFACE_DRAW_DEPTH_FORMAT, 'depth24plus');
  assert.equal(SPH_RESIDENT_SURFACE_REFRACTION_BACKFACE_DEPTH_FORMAT, 'depth32float');
});

test('SPH render-row sphere bridge contract uses variable-size closure PBR', () => {
  const sphereContract = resolveRenderRowSphereBridgeContract({
    sphereBridgeUsed: true,
    materialRendererProxy: false
  });

  assert.equal(sphereContract.particleRenderMode, 'variable-size-spheres');
  assert.equal(sphereContract.sphereBridgeSizingMode, 'per-particle-radius');
  assert.equal(sphereContract.sphereBridgeVariableSize, true);
  assert.equal(sphereContract.sphereBridgePbrMaterialSource, 'closure-derived-pbr');
  assert.equal(sphereContract.sphereBridgeClosurePbr, true);
  assert.equal(sphereContract.pointsVertexColorOnly, false);

  const proxiedSphereContract = resolveRenderRowSphereBridgeContract({
    sphereBridgeUsed: true,
    materialRendererProxy: true
  });

  assert.equal(
    proxiedSphereContract.sphereBridgePbrMaterialSource,
    'closure-derived-pbr-proxied-for-renderer'
  );
  assert.equal(proxiedSphereContract.sphereBridgeClosurePbr, true);

  const pointContract = resolveRenderRowSphereBridgeContract({
    sphereBridgeUsed: false
  });

  assert.equal(pointContract.particleRenderMode, 'points');
  assert.equal(pointContract.sphereBridgeSizingMode, null);
  assert.equal(pointContract.sphereBridgePbrMaterialSource, null);
  assert.equal(pointContract.pointsVertexColorOnly, true);
});

test('SPH Three render-row particle modes force initial fresh physics readback', () => {
  const plan = resolveResidentRenderRowBridgeReadbackPlan({
    requestedRenderRowsReadbackMode: 'no-full-readback',
    useThreeRenderRowBridge: true,
    previousThreeRenderRowBridgeVisible: false
  });

  assert.equal(plan.requestedRenderRowsReadbackModeFromCaller, 'no-full-readback');
  assert.equal(plan.requestedRenderRowsReadbackMode, 'full-parity-readback');
  assert.equal(plan.retainPreviousThreeRenderRowBridgeNoFull, false);
  assert.equal(plan.freshPhysicsReadbackRequired, true);
  assert.equal(
    plan.renderRowsReadbackModeCoercionReason,
    'three-render-row-bridge-requires-fresh-physics-readback'
  );
});

test('SPH Three render-row particle modes keep fresh physics readback on repeated no-full refreshes', () => {
  const retained = resolveResidentRenderRowBridgeReadbackPlan({
    requestedRenderRowsReadbackMode: 'no-full-readback',
    useThreeRenderRowBridge: true,
    previousThreeRenderRowBridgeVisible: true
  });

  assert.equal(retained.requestedRenderRowsReadbackModeFromCaller, 'no-full-readback');
  assert.equal(retained.requestedRenderRowsReadbackMode, 'full-parity-readback');
  assert.equal(retained.retainPreviousThreeRenderRowBridgeNoFull, false);
  assert.equal(retained.freshPhysicsReadbackRequired, true);
  assert.equal(
    retained.renderRowsReadbackModeCoercionReason,
    'three-render-row-bridge-requires-fresh-physics-readback'
  );

  const webgpu = resolveResidentRenderRowBridgeReadbackPlan({
    requestedRenderRowsReadbackMode: 'no-full-readback',
    useWebGpuRenderRowOverlayBridge: true
  });

  assert.equal(webgpu.requestedRenderRowsReadbackMode, 'no-full-readback');
  assert.equal(webgpu.webGpuOverlayNoFullReadback, true);
  assert.equal(webgpu.retainPreviousThreeRenderRowBridgeNoFull, false);
});

test('SPH worker offscreen presentation forces transitional render-row readback', () => {
  const workerPlan = resolveResidentRenderRowBridgeReadbackPlan({
    requestedRenderRowsReadbackMode: 'no-full-readback',
    useWorkerOffscreenPresentation: true
  });

  assert.equal(workerPlan.requestedRenderRowsReadbackModeFromCaller, 'no-full-readback');
  assert.equal(workerPlan.requestedRenderRowsReadbackMode, 'full-parity-readback');
  assert.equal(workerPlan.workerOffscreenPresentationReadbackRequired, true);
  assert.equal(workerPlan.freshPhysicsReadbackRequired, true);
  assert.equal(
    workerPlan.renderRowsReadbackModeCoercionReason,
    'worker-offscreen-render-rows-transitional-bridge-requires-fresh-physics-readback'
  );

  const overlayPlan = resolveResidentRenderRowBridgeReadbackPlan({
    requestedRenderRowsReadbackMode: 'no-full-readback',
    useWorkerOffscreenPresentation: true,
    useWebGpuRenderRowOverlayBridge: true
  });

  assert.equal(overlayPlan.requestedRenderRowsReadbackMode, 'no-full-readback');
  assert.equal(overlayPlan.workerOffscreenPresentationReadbackRequired, false);
  assert.equal(overlayPlan.freshPhysicsReadbackRequired, false);
  assert.equal(overlayPlan.webGpuOverlayNoFullReadback, true);
});

test('SPH presentation-worker retained output preserves no-full readback when the worker frame is ready', () => {
  const plan = resolveResidentRenderRowBridgeReadbackPlan({
    requestedRenderRowsReadbackMode: 'no-full-readback',
    useThreeRenderRowBridge: true,
    useWorkerOffscreenPresentation: true,
    usePresentationWorkerRetainedOutputPresentationOnly: true,
    workerOffscreenRetainedStageOutputAvailable: true
  });

  assert.equal(plan.requestedRenderRowsReadbackModeFromCaller, 'no-full-readback');
  assert.equal(plan.requestedRenderRowsReadbackMode, 'no-full-readback');
  assert.equal(plan.workerOffscreenPresentationReadbackRequired, false);
  assert.equal(plan.presentationWorkerRetainedOutputPresentationOnlyReadbackFree, true);
  assert.equal(plan.freshPhysicsReadbackRequired, false);
  assert.equal(plan.renderRowsReadbackModeCoercionReason, null);
});

test('SPH worker-owned particle-state producer preserves no-full render-row readback', () => {
  const plan = resolveResidentRenderRowBridgeReadbackPlan({
    requestedRenderRowsReadbackMode: 'no-full-readback',
    useThreeRenderRowBridge: true,
    useWorkerOffscreenPresentation: true,
    useWorkerOwnedResidentRenderProducer: true,
    useWorkerOwnedResidentParticleStateProducer: true
  });

  assert.equal(plan.requestedRenderRowsReadbackModeFromCaller, 'no-full-readback');
  assert.equal(plan.requestedRenderRowsReadbackMode, 'no-full-readback');
  assert.equal(plan.renderRowsReadbackModeCoercionReason, null);
  assert.equal(plan.freshPhysicsReadbackRequired, false);
  assert.equal(plan.workerOffscreenPresentationReadbackRequired, false);
  assert.equal(plan.workerOwnedResidentRenderProducerReadbackRequired, false);
  assert.equal(plan.workerOwnedResidentParticleStateProducerReadbackFree, true);
  assert.equal(plan.workerOwnedResidentParticleStateProducerPresentationOnly, true);
});

test('SPH resident overlay policy chooses no-full-readback only when overlay is available', () => {
  assert.equal(SPH_RESIDENT_SURFACE_DRAW_OVERLAY_MODE_DEFAULT, 'disabled');
  assert.equal(normalizeResidentSurfaceDrawOverlayMode(), 'disabled');
  assert.equal(normalizeResidentSurfaceDrawOverlayMode('1'), 'enabled');
  assert.equal(normalizeResidentSurfaceDrawOverlayMode('three'), 'disabled');
  assert.equal(normalizeResidentSurfaceDrawOverlayMode('wat'), 'auto');

  const availableContainer = {
    ownerDocument: {
      createElement: () => ({
        getContext: (name) => (name === 'webgpu' ? {} : null)
      })
    }
  };
  const unavailableContainer = {
    ownerDocument: {
      createElement: () => ({
        getContext: () => null
      })
    }
  };
  const navigatorRef = { gpu: { getPreferredCanvasFormat: () => 'rgba8unorm' } };

  const autoReady = resolveResidentSurfaceDrawOverlayPolicy({
    mode: 'auto',
    container: availableContainer,
    navigatorRef
  });
  assert.equal(autoReady.enabled, true);
  assert.equal(autoReady.status, 'surface-draw-overlay-auto-ready');
  assert.equal(residentRenderFieldReadbackModeForSurfaceOverlay(autoReady.enabled), 'no-full-readback');

  const autoUnavailable = resolveResidentSurfaceDrawOverlayPolicy({
    mode: 'auto',
    container: unavailableContainer,
    navigatorRef
  });
  assert.equal(autoUnavailable.enabled, false);
  assert.equal(autoUnavailable.status, 'surface-draw-overlay-auto-unavailable');
  assert.equal(residentRenderFieldReadbackModeForSurfaceOverlay(autoUnavailable.enabled), 'full-parity-readback');

  const disabled = resolveResidentSurfaceDrawOverlayPolicy({
    mode: '0',
    container: availableContainer,
    navigatorRef
  });
  assert.equal(disabled.enabled, false);
  assert.equal(disabled.status, 'surface-draw-overlay-disabled-by-policy');
});

test('SPH resident overlay retains the last draw buffers across same-surface refreshes', () => {
  const previousBatches = createContinuousSurfaceBatches({
    boxEdgeM: 5,
    positionsM: new Float32Array([
      2.4, 0.4, 2.4,
      2.6, 0.4, 2.6,
      2.5, 2.8, 2.5
    ]),
    colorsRgb: new Float32Array([
      0.9, 0.9, 0.9,
      0.9, 0.9, 0.9,
      1.0, 0.7, 0.4
    ]),
    materials: [
      { material: 'h2o', phase: 'liquid', renderKey: 'h2o' },
      { material: 'h2o', phase: 'liquid', renderKey: 'h2o' },
      { material: 'fe', phase: 'liquid', renderKey: 'fe' }
    ]
  });
  const nextBatches = createContinuousSurfaceBatches({
    boxEdgeM: 5,
    positionsM: new Float32Array([
      2.42, 0.42, 2.4,
      2.62, 0.42, 2.6,
      2.5, 2.75, 2.5
    ]),
    colorsRgb: new Float32Array([
      0.9, 0.9, 0.9,
      0.9, 0.9, 0.9,
      1.0, 0.7, 0.4
    ]),
    materials: [
      { material: 'h2o', phase: 'liquid', renderKey: 'h2o' },
      { material: 'h2o', phase: 'liquid', renderKey: 'h2o' },
      { material: 'fe', phase: 'liquid', renderKey: 'fe' }
    ]
  });
  const changedMaterialBatches = createContinuousSurfaceBatches({
    boxEdgeM: 5,
    positionsM: new Float32Array([
      2.42, 0.42, 2.4,
      2.62, 0.42, 2.6,
      2.5, 2.75, 2.5
    ]),
    colorsRgb: new Float32Array([
      0.9, 0.9, 0.9,
      0.9, 0.9, 0.9,
      1.0, 0.8, 0.3
    ]),
    materials: [
      { material: 'h2o', phase: 'liquid', renderKey: 'h2o' },
      { material: 'h2o', phase: 'liquid', renderKey: 'h2o' },
      { material: 'Au', phase: 'solid', renderKey: 'Au' }
    ]
  });
  const previousSignature = residentSurfaceBatchIdentitySignature(previousBatches);
  const nextSignature = residentSurfaceBatchIdentitySignature(nextBatches);
  const changedSignature = residentSurfaceBatchIdentitySignature(changedMaterialBatches);

  assert.equal(SPH_RESIDENT_SURFACE_DRAW_TEMPORAL_SWAP_POLICY, 'retain-last-overlay-until-replacement-ready');
  assert.equal(previousSignature, nextSignature);
  assert.notEqual(previousSignature, changedSignature);
  assert.equal(shouldRetainResidentSurfaceDrawOverlay({
    previousSurfaceBatchSignature: previousSignature,
    nextSurfaceBatchSignature: nextSignature,
    hasResidentSurfaceDraw: true,
    hasResidentRenderBridge: true
  }), true);
  assert.equal(shouldRetainResidentSurfaceDrawOverlay({
    previousSurfaceBatchSignature: previousSignature,
    nextSurfaceBatchSignature: changedSignature,
    hasResidentSurfaceDraw: true,
    hasResidentRenderBridge: true
  }), false);
  assert.equal(shouldRetainResidentSurfaceDrawOverlay({
    previousSurfaceBatchSignature: previousSignature,
    nextSurfaceBatchSignature: nextSignature,
    hasResidentSurfaceDraw: false,
    hasResidentRenderBridge: true
  }), false);
  assert.equal(shouldRetainResidentSurfaceDrawOverlay({
    previousSurfaceBatchSignature: 'empty',
    nextSurfaceBatchSignature: 'empty',
    hasResidentSurfaceDraw: true,
    hasResidentRenderBridge: true
  }), false);
  assert.equal(shouldRetainResidentSurfaceDrawOverlay({
    previousSurfaceBatchSignature: 'empty',
    nextSurfaceBatchSignature: 'empty',
    hasResidentSurfaceDraw: true,
    hasResidentRenderBridge: true,
    allowEmptySurfaceSignature: true
  }), true);
});

test('SPH resident overlay shader samples closure-derived optical records', () => {
  assert.match(SPH_RESIDENT_SURFACE_DRAW_OVERLAY_WGSL, /@binding\(2\).*optical_records/);
  assert.match(SPH_RESIDENT_SURFACE_DRAW_OVERLAY_WGSL, /@binding\(3\).*spectral_samples/);
  assert.match(SPH_RESIDENT_SURFACE_DRAW_OVERLAY_WGSL, /fn find_optical_material/);
  assert.match(SPH_RESIDENT_SURFACE_DRAW_OVERLAY_WGSL, /id_equal\(optical_state_id, 0\.0\) && id_equal\(row5\.w, 0\.0\)/);
  assert.match(SPH_RESIDENT_SURFACE_DRAW_OVERLAY_WGSL, /fn spectral_wavelength_rgb/);
  assert.match(SPH_RESIDENT_SURFACE_DRAW_OVERLAY_WGSL, /fn spectral_tint_from_samples/);
  assert.match(SPH_RESIDENT_SURFACE_DRAW_OVERLAY_WGSL, /spectral_tint_weight = 0\.35 \* \(1\.0 - clamp\(row1\.w, 0\.0, 1\.0\)\)/);
  assert.doesNotMatch(SPH_RESIDENT_SURFACE_DRAW_OVERLAY_WGSL, /row1\.xyz \* spectral_tint, 0\.35\)/);
  assert.match(SPH_RESIDENT_SURFACE_DRAW_OVERLAY_WGSL, /base_color_linear/);
  assert.match(SPH_RESIDENT_SURFACE_DRAW_OVERLAY_WGSL, /transmissive_surface/);
  assert.match(SPH_RESIDENT_SURFACE_DRAW_OVERLAY_WGSL, /clip\.z = clip\.z \* 0\.5 \+ clip\.w \* 0\.5/);
  assert.doesNotMatch(SPH_RESIDENT_SURFACE_DRAW_OVERLAY_WGSL, /fn fs_oit_main/);
  assert.doesNotMatch(SPH_RESIDENT_SURFACE_DRAW_OVERLAY_WGSL, /struct OitFragmentOut/);
  assert.match(SPH_RESIDENT_SURFACE_DRAW_OVERLAY_WGSL, /attenuation_linear/);
  assert.match(SPH_RESIDENT_SURFACE_DRAW_OVERLAY_WGSL, /optical_depth/);
  assert.match(SPH_RESIDENT_SURFACE_DRAW_OVERLAY_WGSL, /optical\.status == 255\.0/);
  assert.match(SPH_RESIDENT_SURFACE_DRAW_OVERLAY_WGSL, /refractive_index = max\(optical\.ior, 1\.0\)/);
  assert.doesNotMatch(SPH_RESIDENT_SURFACE_DRAW_OVERLAY_WGSL, /optical\.status - 2\.0/);
  assert.match(SPH_RESIDENT_SURFACE_DRAW_OVERLAY_WGSL, /fn resident_refractive_backface/);
  assert.match(SPH_RESIDENT_SURFACE_DRAW_OVERLAY_WGSL, /fn refracted_path_to_back_plane/);
  assert.match(SPH_RESIDENT_SURFACE_DRAW_OVERLAY_WGSL, /fn refraction_beer_lambert_transmission_rgb/);
  assert.match(SPH_RESIDENT_SURFACE_DRAW_OVERLAY_WGSL, /path_m_rgb/);
  assert.match(SPH_RESIDENT_SURFACE_DRAW_OVERLAY_WGSL, /round\(in\.phase_id\) == 3\.0 \|\| in\.optical_state_id > 0\.5/);
  assert.match(SPH_RESIDENT_SURFACE_DRAW_OVERLAY_WGSL, /&& !is_vapor/);
  assert.match(SPH_RESIDENT_SURFACE_DRAW_OVERLAY_WGSL, /let isotropic_phase = 0\.07957747155/);
  assert.match(SPH_RESIDENT_SURFACE_DRAW_OVERLAY_WGSL, /let projected_chord_fraction = clamp\(ndotv, 0\.0, 1\.0\)/);
  assert.match(SPH_RESIDENT_SURFACE_DRAW_OVERLAY_WGSL, /let projected_optical_depth = optical_depth \* projected_chord_fraction/);
  assert.match(SPH_RESIDENT_SURFACE_DRAW_OVERLAY_WGSL, /var vapor_alpha = clamp\(1\.0 - exp\(-projected_optical_depth\)/);
  assert.match(SPH_RESIDENT_SURFACE_DRAW_OVERLAY_WGSL, /blocked && is_vapor && in\.optical_state_id < 0\.5/);
  assert.match(SPH_RESIDENT_SURFACE_DRAW_OVERLAY_WGSL, /return vec4<f32>\(display_lit \* output_alpha, output_alpha\)/);
  assert.match(SPH_RESIDENT_SURFACE_DRAW_OVERLAY_WGSL, /scattering_coefficient_per_m/);
});

test('SPH native compact normals may cover a triangle-aligned prefix with trailing atomic rows', () => {
  assert.equal(packedNormalRowsCoverCompactPositionPrefix({
    compactPositionVertexCount: 1_398_099,
    normalRowCount: 1_398_101,
    normalBufferByteLength: 1_398_101 * Uint32Array.BYTES_PER_ELEMENT
  }), true);
  assert.equal(packedNormalRowsCoverCompactPositionPrefix({
    compactPositionVertexCount: 12,
    normalRowCount: 12,
    normalBufferByteLength: 12 * Uint32Array.BYTES_PER_ELEMENT
  }), true);
  assert.equal(packedNormalRowsCoverCompactPositionPrefix({
    compactPositionVertexCount: 12,
    normalRowCount: 11,
    normalBufferByteLength: 12 * Uint32Array.BYTES_PER_ELEMENT
  }), false);
  assert.equal(packedNormalRowsCoverCompactPositionPrefix({
    compactPositionVertexCount: 12,
    normalRowCount: 12,
    normalBufferByteLength: 11 * Uint32Array.BYTES_PER_ELEMENT
  }), false);
});

test('SPH resident compact-position native shader keeps PBR optics and decodes generation normals', () => {
  // 208 -> 240: retained ABI slots from the retired draw-time field-gradient path.
  // 240 -> 256: camera world position (real view direction for fresnel and
  // specular) and the closure-derived emissive temperature (blackbody glow).
  // 256 -> 320: inverse view-projection for GPU backface-depth unprojection.
  assert.equal(SPH_RESIDENT_SURFACE_DRAW_COMPACT_POSITION_CAMERA_UNIFORM_BYTE_LENGTH, 320);
  assert.match(SPH_RESIDENT_SURFACE_DRAW_COMPACT_POSITION_WGSL, /compact_position_rows: array<f32>/);
  assert.match(SPH_RESIDENT_SURFACE_DRAW_COMPACT_POSITION_WGSL, /fn compact_world_position/);
  assert.match(SPH_RESIDENT_SURFACE_DRAW_COMPACT_POSITION_WGSL, /fn compact_normal/);
  assert.match(SPH_RESIDENT_SURFACE_DRAW_COMPACT_POSITION_WGSL, /cross\(p1 - p0, p2 - p0\)/);
  assert.match(SPH_RESIDENT_SURFACE_DRAW_COMPACT_POSITION_WGSL, /compact_packed_normals: array<u32>/);
  assert.match(
    SPH_RESIDENT_SURFACE_DRAW_COMPACT_POSITION_WGSL,
    /@group\(0\) @binding\(5\) var<storage, read> compact_vertex_temperatures_k: array<f32>/
  );
  assert.match(SPH_RESIDENT_SURFACE_DRAW_COMPACT_POSITION_WGSL, /fn compact_packed_normal/);
  assert.match(SPH_RESIDENT_SURFACE_DRAW_COMPACT_POSITION_WGSL, /unpack2x16snorm/);
  assert.match(SPH_RESIDENT_SURFACE_DRAW_COMPACT_POSITION_WGSL, /0x80008000u/);
  assert.match(SPH_RESIDENT_SURFACE_DRAW_COMPACT_POSITION_WGSL, /var normal = compact_normal\(vertex_index\)/);
  assert.match(SPH_RESIDENT_SURFACE_DRAW_COMPACT_POSITION_WGSL, /if \(dot\(smooth_normal, smooth_normal\) > 0\.25\)/);
  assert.doesNotMatch(SPH_RESIDENT_SURFACE_DRAW_COMPACT_POSITION_WGSL, /render_field_scalars: array<f32>/);
  assert.doesNotMatch(SPH_RESIDENT_SURFACE_DRAW_COMPACT_POSITION_WGSL, /fn field_gradient_normal/);
  assert.match(
    SPH_RESIDENT_SURFACE_DRAW_COMPACT_POSITION_WGSL,
    /if \(vertex_index < arrayLength\(&compact_vertex_temperatures_k\)\)/
  );
  assert.match(
    SPH_RESIDENT_SURFACE_DRAW_COMPACT_POSITION_WGSL,
    /out\.emissive_temperature_k = vertex_temperature_k/
  );
  assert.doesNotMatch(
    SPH_RESIDENT_SURFACE_DRAW_COMPACT_POSITION_WGSL,
    /out\.emissive_temperature_k = 0\.0/
  );
  assert.match(SPH_RESIDENT_SURFACE_DRAW_COMPACT_POSITION_WGSL, /out\.material_id = camera_data\.material_id/);
  assert.match(SPH_RESIDENT_SURFACE_DRAW_COMPACT_POSITION_WGSL, /@binding\(2\).*optical_records/);
  assert.match(SPH_RESIDENT_SURFACE_DRAW_COMPACT_POSITION_WGSL, /fn find_optical_material/);
  assert.match(SPH_RESIDENT_SURFACE_DRAW_COMPACT_POSITION_WGSL, /transparency_class_id - 2\.0/);
  assert.match(SPH_RESIDENT_SURFACE_DRAW_COMPACT_POSITION_WGSL, /inverse_view_projection/);
  assert.match(SPH_RESIDENT_SURFACE_DRAW_COMPACT_POSITION_WGSL, /refractive_back_depth: texture_depth_2d/);
  assert.match(SPH_RESIDENT_SURFACE_DRAW_COMPACT_POSITION_WGSL, /fn resident_refractive_backface/);
  assert.match(SPH_RESIDENT_SURFACE_DRAW_COMPACT_POSITION_WGSL, /fn refracted_path_to_back_plane/);
  assert.match(SPH_RESIDENT_SURFACE_DRAW_COMPACT_POSITION_WGSL, /fn refraction_beer_lambert_transmission_rgb/);
  assert.match(SPH_RESIDENT_SURFACE_DRAW_COMPACT_POSITION_WGSL, /path_m_rgb/);
  assert.doesNotMatch(SPH_RESIDENT_SURFACE_DRAW_COMPACT_POSITION_WGSL, /path_m \* 0\.35/);
  assert.doesNotMatch(SPH_RESIDENT_SURFACE_DRAW_COMPACT_POSITION_WGSL, /vec2<f32>\(-0\.15\)/);
  assert.doesNotMatch(SPH_RESIDENT_SURFACE_DRAW_COMPACT_POSITION_WGSL, /fn fs_oit_main/);
});

test('SPH resident render-row overlay shader draws directly from retained GPU rows', () => {
  assert.match(SPH_RESIDENT_RENDER_ROW_OVERLAY_WGSL, /@binding\(0\).*render_rows/);
  assert.match(SPH_RESIDENT_RENDER_ROW_OVERLAY_WGSL, /@binding\(1\).*camera_data/);
  assert.match(SPH_RESIDENT_RENDER_ROW_OVERLAY_WGSL, /@builtin\(instance_index\)/);
  assert.match(SPH_RESIDENT_RENDER_ROW_OVERLAY_WGSL, /RENDER_ROW_VEC4_STRIDE/);
  assert.match(SPH_RESIDENT_RENDER_ROW_OVERLAY_WGSL, /clip\.z = clip\.z \* 0\.5 \+ clip\.w \* 0\.5/);
  assert.match(SPH_RESIDENT_RENDER_ROW_OVERLAY_WGSL, /pass\.draw|fn fs_main/);
});

test('SPH render-row sphere bridge stabilizes transmissive PBR for mobile proxy geometry', () => {
  const material = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(0, 0, 0),
    vertexColors: true,
    transmission: 0.98,
    thickness: 0.6,
    transparent: true,
    opacity: 0.003
  });
  material.userData.optical = {
    blocked: true,
    transmission: 0.98,
    vertexColorPolicyId: 255
  };
  const previousVersion = material.version;

  stabilizeRenderRowSphereBridgeMaterial(material, {
    descriptor: { material: 'h2o', renderKey: 'h2o', phase: 'liquid' },
    fallbackColorSrgb: [0.44, 0.76, 0.91]
  });

  assert.equal(material.vertexColors, false);
  assert.equal(material.transmission, 0);
  assert.equal(material.thickness, 0);
  assert.ok(material.opacity >= 0.66);
  assert.ok(material.color.r + material.color.g + material.color.b > 0.1);
  assert.equal(material.userData.renderRowSphereTransmissionProxy, true);
  assert.deepEqual(material.userData.renderRowSphereFallbackColor, [0.44, 0.76, 0.91]);
  assert.ok(material.version > previousVersion);
});

test('SPH render-row sphere bridge preserves valid dark transmissive PBR materials', () => {
  const material = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(0.015, 0.018, 0.02),
    transmission: 0.92,
    thickness: 0.45,
    transparent: true,
    opacity: 0.12
  });
  material.userData.optical = {
    blocked: false,
    transmission: 0.92,
    vertexColorPolicyId: 0
  };

  stabilizeRenderRowSphereBridgeMaterial(material, {
    descriptor: { material: 'h2o', renderKey: 'h2o', phase: 'liquid' },
    fallbackColorSrgb: [0.44, 0.76, 0.91]
  });

  assert.equal(material.transmission, 0.92);
  assert.ok(material.thickness > 0);
  assert.equal(material.transparent, true);
  assert.ok(material.color.r + material.color.g + material.color.b > 0.04);
  assert.equal(material.userData.renderRowSphereTransmissionProxy, false);
  assert.equal(material.userData.renderRowSpherePreservedTransmission, true);
  assert.equal(material.userData.renderRowSphereFallbackReason, undefined);
});

test('SPH render-row sphere bridge preserves pale liquid transmissive PBR', () => {
  const material = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(0.94, 0.98, 1),
    metalness: 0,
    roughness: 0.08,
    transmission: 0.88,
    thickness: 0.4,
    transparent: true,
    opacity: 0.16
  });
  material.userData.optical = {
    material: 'h2o',
    phase: 'liquid',
    baseColorSrgb: [0.94, 0.98, 1],
    metalness: 0,
    roughness: 0.08,
    transmission: 0.88,
    opacity: 0.16,
    vertexColorPolicyId: 1,
    status: 1,
    renderModel: 'molecular-transparent-beer-lambert-pbr'
  };

  stabilizeRenderRowSphereBridgeMaterial(material, {
    descriptor: { material: 'h2o', renderKey: 'h2o', phase: 'liquid' },
    fallbackColorSrgb: [0.44, 0.76, 0.91]
  });

  assert.equal(material.transmission, 0.88);
  assert.ok(material.thickness > 0);
  assert.equal(material.transparent, true);
  assert.equal(material.userData.renderRowSphereTransmissionProxy, false);
  assert.equal(material.userData.renderRowSpherePreservedTransmission, true);
  assert.equal(material.userData.renderRowSphereFallbackReason, undefined);
  assert.ok(material.color.b >= material.color.r);
});

test('SPH render-row sphere bridge uses closure-derived visible proxy for metallic particles', () => {
  const material = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(0.02, 0.018, 0.016),
    metalness: 1,
    roughness: 0.06,
    ior: 0,
    transmission: 0,
    transparent: false,
    opacity: 1
  });
  material.userData.optical = {
    material: 'Na',
    phase: 'solid',
    baseColorSrgb: [1, 0.945, 0.923],
    metalness: 1,
    roughness: 0.32,
    ior: 0,
    transmission: 0,
    vertexColorPolicyId: 1,
    status: 1,
    renderModel: 'conductor-drude-free-electron'
  };

  stabilizeRenderRowSphereBridgeMaterial(material, {
    descriptor: { material: 'Na', renderKey: 'Na', phase: 'solid' },
    fallbackColorSrgb: [0.99, 0.94, 0.92]
  });

  assert.equal(material.userData.renderRowSphereMetallicVisibilityProxy, true);
  assert.equal(material.userData.renderRowSphereMetallicDisplayProxy, true);
  assert.equal(material.userData.renderRowSphereOriginalMetalness, 1);
  assert.equal(material.userData.renderRowSphereFallbackReason, 'metallic-sphere-low-luminance-pbr-color');
  assert.deepEqual(material.userData.renderRowSphereFallbackColor, [0.99, 0.94, 0.92]);
  assert.equal(material.metalness, 1);
  assert.ok(material.roughness >= 0.5);
  assert.ok(material.envMapIntensity >= 1.8);
  assert.ok(material.ior >= 1);
  assert.equal(material.userData.renderRowSphereOriginalIor, 0);
  assert.ok(material.emissive.r + material.emissive.g + material.emissive.b > 0);
  assert.equal(material.userData.renderRowSphereMetallicDisplayEmissiveFill, 0.04);
  assert.ok(material.color.r + material.color.g + material.color.b > 0.6);
});

test('SPH render-row sphere bridge material summary exposes live PBR proxy values', () => {
  const material = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(0.02, 0.018, 0.016),
    metalness: 1,
    roughness: 0.06,
    ior: 0,
    transmission: 0,
    transparent: false,
    opacity: 1
  });
  material.userData.optical = {
    material: 'Fe',
    phase: 'solid',
    baseColorSrgb: [0.66, 0.62, 0.56],
    metalness: 1,
    roughness: 0.32,
    ior: 0,
    transmission: 0,
    status: 1,
    renderModel: 'conductor-drude-free-electron'
  };
  const mesh = {
    count: 3,
    material,
    userData: {
      surfaceKey: 'fe|fe|solid|domain:drop',
      materialKey: 'Fe',
      renderKey: 'Fe',
      phase: 'solid',
      pointCount: 3,
      renderDomainId: 2,
      renderDomainKey: 'drop',
      renderRowSpherePbrMaterialSource: 'closure-derived-pbr',
      renderRowSphereClosurePbr: true
    }
  };

  stabilizeRenderRowSphereBridgeMaterial(material, {
    descriptor: { material: 'Fe', renderKey: 'Fe', phase: 'solid' },
    fallbackColorSrgb: [0.66, 0.62, 0.56]
  });
  const summary = summarizeRenderRowSphereBridgeMaterial(mesh, material);

  assert.equal(summary.materialKey, 'Fe');
  assert.equal(summary.pointCount, 3);
  assert.equal(summary.renderRowSphereClosurePbr, true);
  assert.equal(summary.renderRowSphereMetallicVisibilityProxy, true);
  assert.equal(summary.renderRowSphereMetallicDisplayProxy, true);
  assert.equal(summary.renderRowSphereFallbackReason, 'metallic-sphere-low-luminance-pbr-color');
  assert.ok(summary.colorLuminance > 0.04);
  assert.ok(summary.emissiveLuminance > 0);
  assert.ok(summary.ior >= 1);
  assert.equal(summary.renderRowSphereOriginalIor, 0);
  assert.equal(summary.opticalMetalness, 1);
  assert.equal(summary.metalness, 1);
  assert.ok(summary.roughness >= 0.5);
  assert.ok(summary.envMapIntensity >= 1.8);
});

test('SPH render-row sphere bridge preserves gold hue and original metalness for valid conductor PBR', () => {
  const goldColor = new THREE.Color();
  goldColor.setRGB(1, 0.862, 0.586, THREE.LinearSRGBColorSpace);
  const material = new THREE.MeshPhysicalMaterial({
    color: goldColor,
    metalness: 1,
    roughness: 0.32,
    ior: 0,
    transmission: 0,
    transparent: false,
    opacity: 1
  });
  material.userData.optical = {
    material: 'Au',
    phase: 'solid',
    baseColorSrgb: [1, 0.936, 0.789],
    metalness: 1,
    roughness: 0.32,
    ior: 0,
    transmission: 0,
    status: 1,
    renderModel: 'conductor-drude-lorentz-relativistic-interband'
  };

  stabilizeRenderRowSphereBridgeMaterial(material, {
    descriptor: { material: 'Au', renderKey: 'Au', phase: 'solid' },
    fallbackColorSrgb: [1, 0.936, 0.789]
  });
  stabilizeRenderRowSphereBridgeMaterial(material, {
    descriptor: { material: 'Au', renderKey: 'Au', phase: 'solid' },
    fallbackColorSrgb: [1, 0.936, 0.789]
  });

  assert.equal(material.userData.renderRowSphereMetallicVisibilityProxy, true);
  assert.equal(material.userData.renderRowSphereMetallicDisplayProxy, true);
  assert.equal(material.userData.renderRowSphereOriginalMetalness, 1);
  assert.equal(material.userData.renderRowSphereOriginalRoughness, 0.32);
  assert.equal(material.userData.renderRowSphereFallbackReason, 'metallic-sphere-renderer-safe-pbr');
  assert.equal(material.metalness, 1);
  assert.ok(material.roughness >= 0.5);
  assert.ok(material.envMapIntensity >= 1.8);
  assert.ok(material.ior >= 1);
  assert.ok(material.emissive.r + material.emissive.g + material.emissive.b > 0);
  assert.ok(material.color.g > material.color.b);
  assert.ok(material.color.b < 0.7);
});

test('SPH render-row sphere bridge leaves non-metal particle PBR out of metallic proxy', () => {
  const material = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(0.44, 0.76, 0.91),
    metalness: 0,
    roughness: 0.08,
    transmission: 0,
    transparent: false,
    opacity: 1
  });
  material.userData.optical = {
    material: 'h2o',
    phase: 'liquid',
    baseColorSrgb: [0.44, 0.76, 0.91],
    metalness: 0,
    roughness: 0.08,
    transmission: 0,
    vertexColorPolicyId: 1,
    status: 1,
    renderModel: 'molecular-transparent-beer-lambert-pbr'
  };

  stabilizeRenderRowSphereBridgeMaterial(material, {
    descriptor: { material: 'h2o', renderKey: 'h2o', phase: 'liquid' },
    fallbackColorSrgb: [0.44, 0.76, 0.91]
  });

  assert.equal(material.userData.renderRowSphereMetallicVisibilityProxy, undefined);
  assert.equal(material.userData.renderRowSphereFallbackReason, undefined);
  assert.equal(material.metalness, 0);
});

test('SPH render-row sphere bridge preserves transparent air particle PBR without metallic fallback', () => {
  const material = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(0.94, 0.97, 1),
    metalness: 0,
    roughness: 0.92,
    transmission: 0.9995,
    thickness: 0.05,
    transparent: true,
    opacity: 0.0006
  });
  material.userData.optical = {
    material: 'air',
    phase: 'gas',
    baseColorSrgb: [0.94, 0.97, 1],
    metalness: 0,
    roughness: 0.92,
    transmission: 0.9995,
    opacity: 0.0006,
    vertexColorPolicyId: 1,
    status: 1,
    renderModel: 'gas-rayleigh-transparent-pbr'
  };

  stabilizeRenderRowSphereBridgeMaterial(material, {
    descriptor: { material: 'air', renderKey: 'air', phase: 'gas' },
    fallbackColorSrgb: [0.72, 0.86, 1]
  });

  assert.equal(material.userData.renderRowSphereMetallicVisibilityProxy, undefined);
  // Gas parcels keep closure PBR but get the labeled sphere-bridge display
  // opacity floor so the explicit particle diagnostic view stays visible.
  assert.equal(material.userData.renderRowSphereFallbackReason, 'gas-display-opacity-floor');
  assert.equal(material.userData.renderRowSphereGasDisplayOpacityFloor, true);
  assert.equal(material.userData.renderRowSphereOriginalOpacity, 0.0006);
  assert.equal(material.userData.optical.renderModel, 'gas-rayleigh-transparent-pbr');
  assert.equal(material.metalness, 0);
  assert.equal(material.transmission, 0.9995);
  assert.ok(material.thickness > 0);
  assert.equal(material.transparent, true);
  assert.equal(material.opacity, 0.18);
  assert.equal(material.userData.renderRowSpherePreservedTransmission, true);
  assert.ok(material.color.r + material.color.g + material.color.b > 2.4);
});

test('SPH surface mesh material proxies transmissive PBR on mobile WebGL paths', () => {
  const policy = resolveSphSurfaceRendererMaterialPolicy({
    rendererBackend: 'three-webgl',
    navigatorRef: {
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)',
      maxTouchPoints: 5
    },
    visualViewport: { width: 390, height: 844 }
  });
  const material = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(0.01, 0.012, 0.014),
    transmission: 0.96,
    thickness: 0.6,
    transparent: true,
    opacity: 0.05
  });
  material.userData.optical = {
    transmission: 0.96,
    baseColorSrgb: [0.01, 0.012, 0.014]
  };

  stabilizeSurfaceMeshMaterialForRenderer(material, {
    descriptor: { material: 'h2o', renderKey: 'h2o', phase: 'liquid' },
    rendererMaterialPolicy: policy,
    bridgeMode: 'three-compact-vertices'
  });

  assert.equal(policy.transmissiveProxyRequired, true);
  assert.equal(material.transmission, 0);
  assert.equal(material.thickness, 0);
  assert.ok(material.opacity >= 0.78);
  assert.equal(material.userData.surfaceMaterialRendererProxy, true);
  assert.equal(material.userData.surfaceMaterialRendererProxyReason, 'mobile-webgl-transmissive-surface-proxy');
  assert.deepEqual(material.userData.surfaceMaterialFallbackColor, [0.44, 0.76, 0.91]);
  assert.ok(material.color.b > material.color.r);
});

test('SPH surface mesh material proxies transmissive PBR for Three WebGPU external buffers', () => {
  const policy = resolveSphSurfaceRendererMaterialPolicy({
    rendererBackend: 'three-webgpu',
    navigatorRef: {
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)',
      maxTouchPoints: 5
    },
    visualViewport: { width: 390, height: 844 }
  });
  const material = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(0.2, 0.4, 0.7),
    transmission: 0.82,
    thickness: 0.4,
    transparent: true,
    opacity: 0.2
  });
  material.userData.optical = { transmission: 0.82 };

  stabilizeSurfaceMeshMaterialForRenderer(material, {
    descriptor: { material: 'h2o', renderKey: 'h2o', phase: 'liquid' },
    rendererMaterialPolicy: policy,
    bridgeMode: 'three-webgpu-surface-buffers'
  });

  assert.equal(policy.transmissiveProxyRequired, true);
  assert.equal(material.transmission, 0);
  assert.equal(material.thickness, 0);
  assert.equal(material.userData.surfaceMaterialOriginalTransmission, 0.82);
  assert.equal(
    material.userData.surfaceMaterialRendererProxyReason,
    'three-webgpu-external-buffer-transmissive-surface-proxy'
  );
});

test('SPH surface mesh material proxies transmissive PBR for Three WebGPU presentation', () => {
  const policy = resolveSphSurfaceRendererMaterialPolicy({
    rendererBackend: 'three-webgpu',
    navigatorRef: {
      userAgent: 'Mozilla/5.0 (X11; Linux x86_64)',
      maxTouchPoints: 0
    },
    visualViewport: { width: 1280, height: 800 }
  });
  const material = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(0.08, 0.12, 0.18),
    transmission: 0.7,
    thickness: 0.4,
    transparent: true,
    opacity: 0.2
  });
  material.userData.optical = { transmission: 0.7 };

  stabilizeSurfaceMeshMaterialForRenderer(material, {
    descriptor: { material: 'h2o', renderKey: 'h2o', phase: 'liquid' },
    rendererMaterialPolicy: policy,
    bridgeMode: 'three-compact-vertices'
  });

  assert.equal(policy.status, 'surface-material-three-webgpu-transmission-proxy');
  assert.equal(policy.transmissiveProxyRequired, true);
  assert.equal(material.transmission, 0);
  assert.equal(material.thickness, 0);
  assert.equal(material.userData.surfaceMaterialRendererProxy, true);
  assert.equal(material.userData.surfaceMaterialRendererProxyReason, 'three-webgpu-transmissive-surface-proxy');
});

test('SPH Three WebGPU resident bridge material proxy uses a basic pipeline material', () => {
  const material = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(0.2, 0.4, 0.7),
    transmission: 0.82,
    thickness: 0.4,
    transparent: true,
    opacity: 0.72,
    depthWrite: false
  });
  material.userData.optical = { transmission: 0.82, alpha: 0.72 };
  material.userData.renderDescriptor = { material: 'h2o', renderKey: 'h2o', phase: 'liquid' };

  const proxy = createThreeWebGpuResidentBridgeMaterialProxy(material, {
    descriptor: { material: 'h2o', renderKey: 'h2o', phase: 'liquid' },
    fallbackColorSrgb: [0.44, 0.76, 0.91],
    bridgeMode: 'three-render-row-spheres',
    proxyReason: 'three-webgpu-render-row-spheres-basic-material-pipeline-proxy'
  });

  assert.equal(proxy.type, 'MeshBasicMaterial');
  assert.equal(proxy.transparent, true);
  assert.equal(proxy.opacity, 0.72);
  assert.equal(proxy.depthWrite, false);
  assert.equal(proxy.userData.surfaceMaterialRendererProxy, true);
  assert.equal(
    proxy.userData.surfaceMaterialRendererProxyReason,
    'three-webgpu-render-row-spheres-basic-material-pipeline-proxy'
  );
  assert.equal(proxy.userData.surfaceMaterialOriginalType, 'MeshPhysicalMaterial');
  assert.equal(proxy.userData.surfaceMaterialRendererBridgeMode, 'three-render-row-spheres');
  assert.deepEqual(proxy.userData.surfaceMaterialFallbackColor, [0.44, 0.76, 0.91]);
  assert.equal(proxy.userData.optical, material.userData.optical);
});

test('SPH Three WebGPU render-row sphere proxy keeps sodium closure PBR visible', () => {
  const material = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(0.02, 0.018, 0.016),
    metalness: 1,
    roughness: 0.06,
    transmission: 0,
    transparent: false,
    opacity: 1
  });
  material.userData.optical = {
    material: 'Na',
    phase: 'solid',
    baseColorSrgb: [1, 0.945, 0.923],
    metalness: 1,
    roughness: 0.32,
    transmission: 0,
    vertexColorPolicyId: 1,
    status: 1,
    renderModel: 'conductor-drude-free-electron'
  };
  material.userData.renderDescriptor = { material: 'Na', renderKey: 'Na', phase: 'solid' };

  stabilizeRenderRowSphereBridgeMaterial(material, {
    descriptor: { material: 'Na', renderKey: 'Na', phase: 'solid' },
    fallbackColorSrgb: [0.99, 0.94, 0.92]
  });
  const proxy = createThreeWebGpuResidentBridgeMaterialProxy(material, {
    descriptor: { material: 'Na', renderKey: 'Na', phase: 'solid' },
    fallbackColorSrgb: [0.99, 0.94, 0.92],
    bridgeMode: 'three-render-row-spheres',
    proxyReason: 'three-webgpu-render-row-spheres-basic-material-pipeline-proxy'
  });

  assert.equal(proxy.type, 'MeshBasicMaterial');
  assert.equal(proxy.userData.renderRowSphereMaterialRendererProxy, true);
  assert.equal(
    proxy.userData.renderRowSphereMaterialRendererProxyReason,
    'three-webgpu-render-row-spheres-basic-material-pipeline-proxy'
  );
  assert.equal(proxy.userData.renderRowSpherePbrMaterialSource, 'closure-derived-pbr-proxied-for-renderer');
  assert.equal(proxy.userData.renderRowSphereClosurePbr, true);
  assert.equal(proxy.userData.renderRowSphereMetallicVisibilityProxy, true);
  assert.equal(proxy.userData.renderRowSphereMetallicDisplayProxy, true);
  assert.equal(proxy.userData.renderRowSphereFallbackReason, 'metallic-sphere-low-luminance-pbr-color');
  assert.deepEqual(proxy.userData.surfaceMaterialFallbackColor, [0.99, 0.94, 0.92]);
  assert.ok(proxy.color.r + proxy.color.g + proxy.color.b > 0.6);
});

test('SPH Three WebGPU render-row sphere proxy preserves transparent air closure metadata', () => {
  const material = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(0.94, 0.97, 1),
    metalness: 0,
    roughness: 0.92,
    transmission: 0.9995,
    thickness: 0.05,
    transparent: true,
    opacity: 0.0006
  });
  material.userData.optical = {
    material: 'air',
    phase: 'gas',
    baseColorSrgb: [0.94, 0.97, 1],
    metalness: 0,
    roughness: 0.92,
    transmission: 0.9995,
    opacity: 0.0006,
    vertexColorPolicyId: 1,
    status: 1,
    renderModel: 'gas-rayleigh-transparent-pbr'
  };
  material.userData.renderDescriptor = { material: 'air', renderKey: 'air', phase: 'gas' };

  stabilizeRenderRowSphereBridgeMaterial(material, {
    descriptor: { material: 'air', renderKey: 'air', phase: 'gas' },
    fallbackColorSrgb: [0.72, 0.86, 1]
  });
  const proxy = createThreeWebGpuResidentBridgeMaterialProxy(material, {
    descriptor: { material: 'air', renderKey: 'air', phase: 'gas' },
    fallbackColorSrgb: [0.72, 0.86, 1],
    bridgeMode: 'three-render-row-spheres',
    proxyReason: 'three-webgpu-render-row-spheres-basic-material-pipeline-proxy'
  });

  assert.equal(proxy.type, 'MeshBasicMaterial');
  assert.equal(proxy.transparent, true);
  // The sphere-bridge gas display opacity floor is applied before the Three
  // WebGPU proxy clones the material, so the proxy inherits the floored
  // opacity and its labeled diagnostic instead of the physical near-zero.
  assert.equal(proxy.opacity, 0.18);
  assert.equal(proxy.userData.renderRowSphereMaterialRendererProxy, true);
  assert.equal(proxy.userData.renderRowSpherePbrMaterialSource, 'closure-derived-pbr-proxied-for-renderer');
  assert.equal(proxy.userData.optical.renderModel, 'gas-rayleigh-transparent-pbr');
  assert.equal(proxy.userData.renderRowSphereMetallicVisibilityProxy, undefined);
  assert.equal(proxy.userData.renderRowSphereFallbackReason, 'gas-display-opacity-floor');
  assert.equal(proxy.userData.renderRowSpherePreservedTransmission, true);
  assert.ok(proxy.color.r + proxy.color.g + proxy.color.b > 2.4);
});

test('SPH Three WebGPU render-row sphere proxy uses visible fallback for black source materials', () => {
  const material = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(0, 0, 0),
    transparent: false,
    opacity: 1
  });
  material.userData.optical = {
    material: 'Na',
    phase: 'solid',
    baseColorSrgb: [1, 0.945, 0.923],
    metalness: 1,
    roughness: 0.32,
    transmission: 0,
    vertexColorPolicyId: 1,
    status: 1,
    renderModel: 'conductor-drude-free-electron'
  };

  const proxy = createThreeWebGpuResidentBridgeMaterialProxy(material, {
    descriptor: { material: 'Na', renderKey: 'Na', phase: 'solid' },
    fallbackColorSrgb: [0.99, 0.94, 0.92],
    bridgeMode: 'three-render-row-spheres',
    proxyReason: 'three-webgpu-render-row-spheres-basic-material-pipeline-proxy'
  });

  assert.equal(proxy.userData.surfaceMaterialProxyColorSource, 'closure-derived-fallback-color');
  assert.equal(proxy.userData.renderRowSphereMaterialRendererProxyColorSource, 'closure-derived-fallback-color');
  assert.ok(proxy.color.r + proxy.color.g + proxy.color.b > 0.6);
});

test('SPH Three WebGPU surface buffers can use conservative aggregate draw records without summary readback', () => {
  const records = resolveThreeWebGpuSurfaceBufferDrawRecords({
    surfaceDrawExecution: {
      sourceVertexRowCount: 19,
      compactedVertexRowsBufferByteLength: 19 * 16 * Float32Array.BYTES_PER_ELEMENT,
      surfaces: [{
        surfaceKey: 'h2o-liquid',
        material: 'h2o',
        phase: 'liquid',
        renderKey: 'h2o-liquid',
        materialId: stableOpticalMaterialId('h2o'),
        phaseId: GPU_PHASE_IDS.liquid,
        vertexOffset: null,
        vertexCount: null,
        triangleCount: null
      }]
    }
  });

  assert.equal(records.status, 'conservative-no-readback-aggregate');
  assert.equal(records.conservativeNoReadbackDrawRange, true);
  assert.equal(records.aggregateVertexCount, 18);
  assert.equal(records.records.length, 1);
  assert.equal(records.records[0].vertexOffset, 0);
  assert.equal(records.records[0].vertexCount, 18);
  assert.equal(records.records[0].triangleCount, 6);
  assert.equal(records.records[0].material, 'h2o');
  assert.equal(records.records[0].phase, 'liquid');

  const summaryNotReadRecords = resolveThreeWebGpuSurfaceBufferDrawRecords({
    surfaceDrawExecution: {
      sourceVertexRowCount: 18,
      compactedVertexRowsBufferByteLength: 18 * 16 * Float32Array.BYTES_PER_ELEMENT,
      surfaces: [{
        surfaceKey: 'extension-surface-5',
        material: 'h2o',
        phase: 'liquid',
        renderKey: 'h2o-liquid',
        materialId: stableOpticalMaterialId('h2o'),
        phaseId: GPU_PHASE_IDS.liquid,
        surfaceIndex: 5,
        indirectRowIndex: 0,
        indirectOffsetBytes: 0,
        vertexOffset: 0,
        vertexCount: 18,
        triangleCount: 6,
        status: 'surface-draw-summary-not-read'
      }]
    }
  });
  assert.equal(summaryNotReadRecords.status, 'conservative-no-readback-aggregate');
  assert.equal(summaryNotReadRecords.conservativeNoReadbackDrawRange, true);
  assert.equal(summaryNotReadRecords.records[0].surfaceIndex, 5);
  assert.equal(summaryNotReadRecords.records[0].indirectRowIndex, 0);
  assert.equal(summaryNotReadRecords.records[0].indirectOffsetBytes, 0);
});

test('SPH resident surface buffer handoff accepts retained no-readback draw or render-field buffers', () => {
  const ready = resolveResidentSurfaceBufferHandoff({
    surfaceDraw: {
      readbackMode: 'no-full-readback',
      surfaceDrawReadback: false,
      surfaceDrawSummaryReadback: false,
      fullSurfaceDrawReadback: false,
      drawRowsBufferRetained: true,
      drawRowsBufferByteLength: 2 * 16 * Float32Array.BYTES_PER_ELEMENT,
      drawIndirectRowsBufferRetained: true,
      drawIndirectRowsBufferByteLength: 4 * Uint32Array.BYTES_PER_ELEMENT,
      drawAggregateIndirectRowsBufferRetained: true,
      drawAggregateIndirectRowsBufferByteLength: 4 * Uint32Array.BYTES_PER_ELEMENT,
      compactedVertexRowsBufferRetained: true,
      compactedVertexRowsBufferByteLength: 19 * 16 * Float32Array.BYTES_PER_ELEMENT,
      sourceVertexRowCount: 19,
      sourceVertexCounterMode: 'resident-vertex-counter',
      sourceVertexCounterBufferBound: true,
      sourceVertexCounterBufferByteLength: 16,
      surfaceDrawGpuOnlyHandoff: true,
      surfaceDrawGpuOnlyHandoffStatus: 'surface-draw-gpu-resident-draw-range-available',
      surfaceDrawGpuOnlyUpperBoundVertexCount: 18,
      surfaceDrawGpuOnlyUpperBoundTriangleCount: 6,
      surfaceDrawGpuOnlyDrawRangeConservative: true
    }
  });

  assert.equal(ready.status, 'resident-surface-buffer-direct-consumer-ready');
  assert.equal(ready.ready, true);
  assert.equal(ready.handoffKind, 'surface-draw-buffers');
  assert.equal(ready.requiresSurfaceExtraction, false);
  assert.equal(ready.surfaceExtractionInputKind, 'surface-draw-compact-vertex-buffer');
  assert.equal(ready.surfaceExtractionConsumerKind, 'direct-gpu-draw-consumer');
  assert.equal(ready.surfaceExtractionBridgeStatus, 'surface-extraction-not-required');
  assert.equal(ready.noFullReadback, true);
  assert.equal(ready.noSummaryReadback, true);
  assert.equal(ready.upperBoundVertexCount, 18);
  assert.equal(ready.upperBoundTriangleCount, 6);
  assert.equal(ready.conservativeDrawRange, true);
  assert.equal(ready.sourceVertexCounterMode, 'resident-vertex-counter');
  assert.equal(ready.sourceVertexCounterBufferBound, true);
  assert.equal(ready.sourceVertexCounterBufferByteLength, 16);
  assert.equal(ready.drawAggregateIndirectRowsBufferRetained, true);
  assert.equal(ready.drawAggregateIndirectRowsBufferByteLength, 4 * Uint32Array.BYTES_PER_ELEMENT);

  const compactPositionReady = resolveResidentSurfaceBufferHandoff({
    surfaceDraw: {
      readbackMode: 'no-full-readback',
      surfaceDrawReadback: false,
      surfaceDrawSummaryReadback: false,
      fullSurfaceDrawReadback: false,
      drawRowsBufferRetained: true,
      drawRowsBufferByteLength: 16 * Float32Array.BYTES_PER_ELEMENT,
      drawIndirectRowsBufferRetained: true,
      drawIndirectRowsBufferByteLength: 4 * Uint32Array.BYTES_PER_ELEMENT,
      compactedVertexRowsBufferRetained: false,
      compactedVertexRowsBufferByteLength: 0,
      compactPositionRowsBufferRetained: true,
      compactPositionRowsBufferByteLength: 21 * 4 * Float32Array.BYTES_PER_ELEMENT,
      compactPositionRowsStrideFloats: 4,
      sourceVertexRowCount: 21
    }
  });
  assert.equal(compactPositionReady.status, 'resident-surface-buffer-direct-consumer-ready');
  assert.equal(compactPositionReady.ready, true);
  assert.equal(compactPositionReady.handoffKind, 'surface-draw-buffers');
  assert.equal(compactPositionReady.surfaceExtractionInputKind, 'surface-draw-compact-position-buffer');
  assert.equal(
    compactPositionReady.surfaceExtractionInputLayout,
    'peercompute.webgpu-marching-cubes.compact-position-rows.v0'
  );
  assert.equal(compactPositionReady.surfaceExtractionConsumerKind, 'direct-gpu-draw-consumer');
  assert.equal(compactPositionReady.upperBoundVertexCount, 21);
  assert.equal(compactPositionReady.upperBoundTriangleCount, 7);
  assert.equal(compactPositionReady.compactPositionRowsBufferRetained, true);
  assert.equal(compactPositionReady.compactPositionRowsBufferByteLength, 21 * 4 * Float32Array.BYTES_PER_ELEMENT);

  const readback = resolveResidentSurfaceBufferHandoff({
    surfaceDraw: {
      ...ready,
      readbackMode: 'full-parity-readback',
      surfaceDrawReadback: true
    }
  });
  assert.equal(readback.ready, false);
  assert.equal(readback.status, 'resident-surface-buffer-direct-consumer-blocked-readback-mode');

  const renderFieldReady = resolveResidentSurfaceBufferHandoff({
    readbackMode: 'no-full-readback',
    surfaceDraw: {
      sourceRenderFieldSchema: 'peercompute.ulg.sph-gpu-render-field.v1',
      surfaceDrawReadback: false,
      surfaceDrawSummaryReadback: false,
      fullSurfaceDrawReadback: false,
      drawRowsBufferRetained: false,
      drawIndirectRowsBufferRetained: false,
      compactedVertexRowsBufferRetained: false,
      renderFieldRowsBufferRetained: true,
      renderFieldRowsBufferByteLength: 2048,
      renderFieldSurfaceBufferRetained: true,
      renderFieldSurfaceBufferByteLength: 512
    }
  });
  assert.equal(renderFieldReady.status, 'resident-render-field-buffer-direct-consumer-ready');
  assert.equal(renderFieldReady.ready, true);
  assert.equal(renderFieldReady.handoffKind, 'render-field-buffers');
  assert.equal(renderFieldReady.directConsumerInputSchema, 'peercompute.ulg.sph-gpu-render-field.v1');
  assert.equal(renderFieldReady.requiresSurfaceExtraction, true);
  assert.equal(renderFieldReady.surfaceExtractionInputKind, 'render-field-density-storage-buffer');
  assert.equal(
    renderFieldReady.surfaceExtractionInputLayout,
    'peercompute.ulg.sph-gpu-render-field-cell-row.density-x-f32.v0'
  );
  assert.equal(renderFieldReady.surfaceExtractionConsumerKind, 'native-webgpu-marching-cubes-buffer-volume');
  assert.equal(renderFieldReady.surfaceExtractionRequiredAdapter, 'webgpu-marching-cubes.buffer-volume.v0');
  assert.equal(renderFieldReady.surfaceExtractionBridgeStatus, 'requires-buffer-native-marching-cubes-adapter');
  assert.match(renderFieldReady.surfaceExtractionBridgeReason, /storage-buffer scalar fields/);
  assert.equal(renderFieldReady.renderFieldRowsBufferRetained, true);
  assert.equal(renderFieldReady.renderFieldRowsBufferByteLength, 2048);
  assert.equal(renderFieldReady.renderFieldSurfaceBufferRetained, true);
  assert.equal(renderFieldReady.renderFieldSurfaceBufferByteLength, 512);
  assert.equal(renderFieldReady.upperBoundVertexCount, 0);
  assert.equal(renderFieldReady.upperBoundTriangleCount, 0);

  for (const sourceRenderFieldSchema of [
    'peercompute.ulg.sph-gpu-render-field.v0',
    null
  ]) {
    const incompatibleRenderField = resolveResidentSurfaceBufferHandoff({
      readbackMode: 'no-full-readback',
      surfaceDraw: {
        sourceRenderFieldSchema,
        surfaceDrawReadback: false,
        surfaceDrawSummaryReadback: false,
        fullSurfaceDrawReadback: false,
        renderFieldRowsBufferRetained: true,
        renderFieldRowsBufferByteLength: 2048,
        renderFieldSurfaceBufferRetained: true,
        renderFieldSurfaceBufferByteLength: 512
      }
    });
    assert.equal(incompatibleRenderField.ready, false);
    assert.equal(
      incompatibleRenderField.status,
      'resident-render-field-buffer-direct-consumer-blocked-schema'
    );
    assert.equal(incompatibleRenderField.handoffKind, null);
    assert.equal(incompatibleRenderField.sourceRenderFieldSchema, sourceRenderFieldSchema);
    assert.equal(incompatibleRenderField.renderFieldSchemaCompatible, false);
    assert.match(incompatibleRenderField.reason, /render-field\.v1/);
  }
});

test('SPH resident render source metadata keeps stale retained surfaces visible', () => {
  const metadata = createResidentRenderSourceMetadata({
    residentSteps: {
      signature: 'steps-current',
      residentExecutionGeneration: 7,
      currentResidentExecutionGeneration: 7,
      completedStepCount: 2,
      residentSourceMode: 'previous-gpu-resident-output',
      nextSphParticleState: {
        step: 4,
        time: 0.02,
        particleCount: 128
      }
    },
    finalStep: {
      signature: 'step-current',
      sequenceIndex: 1,
      particlePingPong: {
        sourceStep: 3,
        nextStep: 4,
        sourceTime: 0.015,
        nextTime: 0.02
      }
    },
    source: 'resident-render-refresh'
  });

  assert.equal(metadata.status, 'resident-render-source-current');
  assert.equal(metadata.residentExecutionGenerationMatchesCurrent, true);
  assert.equal(metadata.nextStep, 4);
  assert.equal(metadata.nextTimeS, 0.02);
  assert.equal(metadata.particleCount, 128);

  const currentSurfaceDraw = {};
  applyResidentRenderSourceMetadata(currentSurfaceDraw, metadata);
  assert.equal(currentSurfaceDraw.sourceResidentExecutionGeneration, 7);
  assert.equal(currentSurfaceDraw.sourceResidentExecutionGenerationMatchesCurrent, true);
  assert.equal(currentSurfaceDraw.sourceResidentRetainedPrevious, false);
  assert.equal(currentSurfaceDraw.residentRenderSourceStaleAfterPublish, false);

  currentSurfaceDraw.residentRenderSourceStaleAfterPublish = true;
  currentSurfaceDraw.residentRenderSourceStaleReason = 'retained prior frame';
  currentSurfaceDraw.residentRenderSourceStaleAgainst = { generation: 8 };
  applyResidentRenderSourceMetadata(currentSurfaceDraw, metadata);
  assert.equal(currentSurfaceDraw.residentRenderSourceStaleAfterPublish, false);
  assert.equal(currentSurfaceDraw.residentRenderSourceStaleReason, null);
  assert.equal(currentSurfaceDraw.residentRenderSourceStaleAgainst, null);

  const staleMetadata = createResidentRenderSourceMetadata({
    residentSteps: {
      signature: 'steps-stale',
      residentExecutionGeneration: 6,
      currentResidentExecutionGeneration: 7,
      nextSphParticleState: { step: 3, time: 0.015 }
    },
    source: 'resident-render-refresh'
  });
  const retainedSurfaceDraw = {};
  applyResidentRenderSourceMetadata(retainedSurfaceDraw, staleMetadata, {
    markRetainedPrevious: true,
    retentionReason: 'previous native surface retained during current no-full refresh'
  });
  assert.equal(retainedSurfaceDraw.sourceResidentExecutionGeneration, 6);
  assert.equal(retainedSurfaceDraw.sourceResidentCurrentExecutionGeneration, 7);
  assert.equal(retainedSurfaceDraw.sourceResidentExecutionGenerationMatchesCurrent, false);
  assert.equal(retainedSurfaceDraw.sourceResidentRetainedPrevious, true);
  assert.equal(retainedSurfaceDraw.residentRenderSourceStaleAfterPublish, undefined);
  assert.notEqual(
    retainedSurfaceDraw.sourceResidentExecutionGeneration,
    retainedSurfaceDraw.sourceResidentCurrentExecutionGeneration
  );
  assert.match(retainedSurfaceDraw.sourceResidentRetentionReason, /previous native surface/);
});

test('SPH successor source-family enforcement is scoped to Schroeder continuations', () => {
  const genericUploads = {
    sphParticleUpload: {
      particleCount: 4,
      stateBuffer: { label: 'generic-final-state' },
      thermoBuffer: { label: 'generic-final-thermo' },
      identityBuffer: { label: 'generic-final-identity' }
    },
    mlsMpmParticleUpload: {
      particleCount: 4,
      mechanicsBuffer: { label: 'generic-final-mechanics' }
    }
  };
  assert.equal(
    schroederRenderContinuationRequiresSourceFamily({
      sourceStep: { nextParticleUploads: genericUploads },
      residentExecution: {
        residentExecutionPolicy: { schroederSimulation: false },
        nextParticleUploads: genericUploads
      },
      uploads: genericUploads
    }),
    false
  );
  assert.equal(
    schroederRenderContinuationRequiresSourceFamily({
      sourceStep: {
        schroederSimulation: true,
        nextParticleUploads: genericUploads
      },
      uploads: genericUploads
    }),
    true
  );
  assert.equal(
    schroederRenderContinuationRequiresSourceFamily({
      residentExecution: {
        residentExecutionPolicy: { schroederSimulation: true }
      },
      uploads: genericUploads
    }),
    true
  );
  assert.equal(
    schroederRenderContinuationRequiresSourceFamily({
      residentExecution: {
        schroederSimulation: true,
        residentExecutionPolicy: { schroederSimulation: true }
      },
      uploads: genericUploads,
      renderOnlyWorkerSnapshotAdmitted: true
    }),
    false,
    'an exact terminal worker snapshot is a render-only mirror, not a physics continuation'
  );
  assert.equal(
    schroederRenderContinuationRequiresSourceFamily({
      residentExecution: {
        schroederSimulation: true,
        residentExecutionPolicy: { schroederSimulation: true }
      },
      uploads: genericUploads,
      renderOnlyWorkerSnapshotAdmitted: false
    }),
    true,
    'ordinary Schroeder uploads still require the worker-private successor family'
  );
  assert.equal(
    schroederRenderContinuationRequiresSourceFamily({
      uploads: {
        ...genericUploads,
        schroederSpatialSuccessorSourceFamily: Object.freeze({})
      }
    }),
    true
  );
});

test('SPH scene blocks stale pre-integration proxies when a final continuation lacks successor lineage', () => {
  const portableSummary = schroederPortableSummaryFixture();
  portableSummary.retainedRefs = portableSummary.retainedRefs.map((ref) => ({
    ...ref,
    sourceFamilyRole: 'canonical-pre-integration-x-n',
    positionAuthority: 'same-epoch-pre-integration-particle-state',
    finalContinuationAuthority: false
  }));
  const nextParticleUploads = {
    sphParticleUpload: {
      particleCount: 4,
      stateBuffer: { label: 'final-state' },
      thermoBuffer: { label: 'final-thermo' },
      identityBuffer: { label: 'final-identity' }
    },
    mlsMpmParticleUpload: {
      particleCount: 4,
      mechanicsBuffer: { label: 'final-mechanics' }
    }
  };

  const source = createSchroederRenderSourceMetadata({
    finalStep: {
      portableSummary,
      nextParticleUploads
    }
  });

  assert.equal(source.status, 'blocked-schroeder-render-source');
  assert.equal(
    source.blocker,
    'schroeder-render-final-successor-lineage-missing'
  );
  assert.equal(source.renderLodPresentationReady, false);
  assert.equal(source.finalCommittedSuccessorExists, true);
  assert.equal(
    source.finalCommittedSuccessorEvidence,
    'source-step-next-particle-uploads'
  );
  assert.equal(source.finalCommittedSuccessorParticleCount, 4);
  assert.equal(source.finalParticleSourceLineage, null);
  assert.equal(source.finalParticleSourceLineageValid, false);
  assert.equal(source.finalParticleSourceLineageMissing, true);
  assert.equal(source.staleFinalContinuationProxyBlocked, true);
  assert.equal(source.finalCommittedProxySourceRefsRequired, true);
  assert.equal(source.finalCommittedProxySourceRefsValid, false);
  assert.equal(
    source.finalCommittedProxySourceRefValidationStatus,
    'blocked-schroeder-render-proxy-final-committed-family-refs'
  );

  const proxyPlan = createSchroederRenderProxyDescriptorPlan({
    schroederRenderSource: source
  });
  assert.equal(proxyPlan.status, 'blocked-schroeder-render-proxy-descriptors');
  assert.equal(proxyPlan.blocker, source.blocker);
  assert.equal(proxyPlan.renderSourcePresentationReady, false);
});

test('SPH scene authenticates exact final committed proxy refs and rejects torn lineage echoes', () => {
  const { sourceFamily, retainedRefs } =
    schroederFinalCommittedProxyRefFixture();
  const exact = validateSchroederRenderProxyFinalCommittedFamilyRefs({
    retainedRefs,
    finalSuccessorSourceFamily: sourceFamily,
    required: true
  });
  assert.equal(
    exact.status,
    'schroeder-render-proxy-final-committed-family-refs-ready'
  );
  assert.equal(exact.ready, true);
  assert.equal(exact.blocker, null);
  assert.equal(exact.refCount, 2);
  assert.equal(exact.invalidRefCount, 0);
  assert.deepEqual(exact.failures, []);

  const cases = [
    {
      name: 'stale source role',
      change: {
        sourceFamilyRole: 'canonical-pre-integration-x-n',
        finalContinuationAuthority: false
      },
      blocker: 'schroeder-render-proxy-source-not-final-committed-family'
    },
    {
      name: 'cross-device source',
      change: { sourceDeviceId: 'renderer-test-device-b' },
      blocker: 'schroeder-render-proxy-source-device-mismatch'
    },
    {
      name: 'mismatched finalized family identity',
      change: { sourceFamily: Object.freeze({ ...sourceFamily }) },
      blocker: 'schroeder-render-proxy-source-family-mismatch'
    },
    {
      name: 'stale source generation',
      change: { sourceGenerationId: sourceFamily.sourceGenerationId - 1 },
      blocker: 'schroeder-render-proxy-source-generation-mismatch'
    },
    {
      name: 'copied rather than exact successor epoch identity',
      change: {
        sourceEpochIdentity: Object.freeze({
          ...sourceFamily.successorEpochIdentity
        })
      },
      blocker: 'schroeder-render-proxy-source-epoch-mismatch'
    },
    {
      name: 'mismatched position authority',
      change: {
        positionAuthority: 'same-epoch-pre-integration-particle-state'
      },
      blocker: 'schroeder-render-proxy-source-position-authority-mismatch'
    }
  ];
  for (const { name, change, blocker } of cases) {
    const tornRefs = retainedRefs.map((ref, index) => (
      index === 0 ? { ...ref, ...change } : ref
    ));
    const validation = validateSchroederRenderProxyFinalCommittedFamilyRefs({
      retainedRefs: tornRefs,
      finalSuccessorSourceFamily: sourceFamily,
      required: true
    });
    assert.equal(validation.ready, false, name);
    assert.equal(validation.blocker, blocker, name);
    assert.equal(validation.refCount, 2, name);
    assert.equal(validation.invalidRefCount, 1, name);
    assert.equal(validation.failures[0].refIndex, 0, name);
    assert.equal(validation.failures[0].blocker, blocker, name);
  }
});

test('SPH current-state rendering remains noncanonical when successor lineage branding is invalid', () => {
  const portableSummary = schroederPortableSummaryFixture();
  portableSummary.retainedRefs = portableSummary.retainedRefs.map((ref) => ({
    ...ref,
    sourceFamilyRole: 'canonical-pre-integration-x-n',
    positionAuthority: 'same-epoch-pre-integration-particle-state',
    finalContinuationAuthority: false
  }));
  const invalidSourceFamily = Object.freeze({
    schema: 'peercompute.ulg.schroeder-committed-successor-source-family.v1',
    status: 'schroeder-committed-successor-source-family-authenticated',
    ready: true,
    authenticated: true,
    sourceFamilyRole: 'committed-successor-x-n-plus-1'
  });
  const nextParticleUploads = {
    sphParticleUpload: {
      particleCount: 3,
      stateBuffer: { label: 'invalid-lineage-final-state' },
      thermoBuffer: { label: 'invalid-lineage-final-thermo' },
      identityBuffer: { label: 'invalid-lineage-final-identity' }
    },
    mlsMpmParticleUpload: {
      particleCount: 3,
      mechanicsBuffer: { label: 'invalid-lineage-final-mechanics' }
    },
    schroederSpatialSuccessorSourceFamily: invalidSourceFamily
  };
  const finalStep = {
    portableSummary,
    nextParticleUploads,
    schroederSpatialSuccessorSourceFamily: invalidSourceFamily,
    particlePingPong: {
      sourceStep: 8,
      nextStep: 9,
      sourceTime: 0.04,
      nextTime: 0.045
    }
  };

  const metadata = createResidentRenderSourceMetadata({
    residentSteps: {
      residentExecutionGeneration: 12,
      currentResidentExecutionGeneration: 12,
      nextSphParticleState: {
        particleCount: 3,
        step: 9,
        time: 0.045
      }
    },
    finalStep
  });

  assert.equal(metadata.status, 'resident-render-source-current');
  assert.equal(metadata.residentExecutionGenerationMatchesCurrent, true);
  assert.equal(metadata.nextStep, 9);
  assert.equal(metadata.particleCount, 3);
  assert.equal(metadata.schroederRenderSource.status, 'blocked-schroeder-render-source');
  assert.equal(
    metadata.schroederRenderSource.blocker,
    'schroeder-render-final-successor-lineage-missing'
  );
  assert.equal(metadata.schroederRenderSource.finalCommittedSuccessorExists, true);
  assert.equal(metadata.schroederRenderSource.finalParticleSourceLineageValid, false);
  assert.equal(metadata.schroederRenderSource.finalParticleSourceLineageMissing, true);
  assert.equal(
    metadata.schroederRenderProxyDescriptorPlan.status,
    'blocked-schroeder-render-proxy-descriptors'
  );
  assert.equal(
    metadata.schroederRenderProxyDrawSource.status,
    'blocked-schroeder-render-proxy-draw-source'
  );
});

test('SPH scene materializes admitted Schroeder render LOD summaries as render source metadata', () => {
  const portableSummary = schroederPortableSummaryFixture();
  const admission = {
    schema: 'peercompute.ulg.schroeder-portable-summary-admission.v0',
    status: 'schroeder-portable-summary-admission-published',
    scope: 'ulg-schroeder-portable-summary-admissions',
    stateKey: 'schroeder-summary:test-state',
    cacheKey: 'schroeder-summary:test-cache',
    hotBufferKey: 'schroeder-summary:test-hot',
    portableSummary,
    renderLod: portableSummary.renderLod
  };
  const source = createSchroederRenderSourceMetadata({
    residentExecution: {
      schema: 'peercompute.ulg.mls-mpm-gpu-resident-steps-execution.v0',
      status: 'resident-steps-executed',
      portableSummary
    },
    schroederPortableSummaryAdmission: admission,
    source: 'resident-step-publication'
  });

  assert.equal(source.schema, ULG_SPH_SCENE_SCHROEDER_RENDER_SOURCE_SCHEMA);
  assert.equal(source.status, 'schroeder-render-source-admitted');
  assert.equal(source.renderLodPresentationReady, true);
  assert.equal(source.renderLodPresentationSourceMode, 'schroeder-portable-summary-render-lod');
  assert.equal(source.activeLeafProxyCount, 12);
  assert.equal(source.aggregateProxyCount, 3);
  assert.equal(source.lawQueueProxyCount, 5);
  assert.equal(source.totalProxyCount, 20);
  assert.equal(source.nativeGridSpacingM, 0.25);
  assert.equal(source.geometryPolicy, 'active-leaf-spheres-and-coherent-aggregate-proxies');
  assert.equal(source.opticalPolicy, 'closure-derived-pbr-materials');
  assert.equal(source.closureDerivedPbr, true);
  assert.equal(source.descriptorOnlyPeerComputeHandoff, true);
  assert.equal(source.fullParticleReadbackAvoided, true);
  assert.equal(source.rawGpuBufferTransferDetected, false);
  assert.equal(source.rawGpuBufferTransferAllowed, false);
  assert.equal(source.admissionPublished, true);
  assert.equal(source.admissionStateKey, 'schroeder-summary:test-state');
  assert.equal(source.retainedProxySourceRefCount, 2);
  assert.equal(source.descriptorProxySourceRefCount, 2);
  assert.equal(source.activeLeafSourceRef.retainedBufferRef, 'active-node-list:test');
  assert.equal(source.aggregateProxySourceRef.retainedBufferRef, 'aggregate-node:test');

  const proxyPlan = createSchroederRenderProxyDescriptorPlan({ schroederRenderSource: source });
  assert.equal(proxyPlan.schema, ULG_SPH_SCENE_SCHROEDER_RENDER_PROXY_DESCRIPTOR_PLAN_SCHEMA);
  assert.equal(proxyPlan.status, 'schroeder-render-proxy-descriptors-ready');
  assert.equal(proxyPlan.descriptorCount, 3);
  assert.equal(proxyPlan.totalProxyCount, 20);
  assert.equal(proxyPlan.drawableProxyCount, 15);
  assert.equal(proxyPlan.diagnosticProxyCount, 5);
  assert.equal(proxyPlan.closurePbrAvailable, true);
  assert.equal(
    proxyPlan.pbrMaterialSource,
    'closure-derived-pbr-deferred-by-ss-node-material-histogram'
  );
  assert.equal(proxyPlan.visibleRenderSource, 'schroeder-render-lod-proxy-descriptors');
  assert.equal(proxyPlan.rendererIntegration, 'scene-resident-schroeder-render-source-consumer');
  assert.equal(proxyPlan.presentationOwnsPhysicsCadence, false);
  assert.equal(proxyPlan.fullParticleReadbackAvoided, true);
  assert.equal(proxyPlan.retainedSourceRefCount, 2);
  assert.equal(proxyPlan.activeLeafSourceRefAvailable, true);
  assert.equal(proxyPlan.aggregateProxySourceRefAvailable, true);

  const activeLeaf = proxyPlan.descriptors.find((descriptor) => descriptor.proxyClass === 'active-leaf');
  const aggregate = proxyPlan.descriptors.find((descriptor) => descriptor.proxyClass === 'spatial-aggregate');
  const lawQueue = proxyPlan.descriptors.find((descriptor) => descriptor.proxyClass === 'law-queue');
  assert.equal(activeLeaf.schema, ULG_SPH_SCENE_SCHROEDER_RENDER_PROXY_DESCRIPTOR_SCHEMA);
  assert.equal(activeLeaf.drawableProxy, true);
  assert.equal(activeLeaf.proxyCount, 12);
  assert.equal(activeLeaf.sourceRefKind, 'schroeder-active-node-list-retained-ref');
  assert.equal(activeLeaf.sourceRef.retainedBufferRef, 'active-node-list:test');
  assert.equal(activeLeaf.sourceRefRetained, true);
  assert.equal(activeLeaf.geometryKind, 'active-leaf-sphere-or-splat-proxy');
  assert.equal(aggregate.drawableProxy, true);
  assert.equal(aggregate.proxyCount, 3);
  assert.equal(aggregate.sourceRefKind, 'schroeder-hierarchy-aggregate-node-retained-ref');
  assert.equal(aggregate.sourceRef.retainedBufferRef, 'aggregate-node:test');
  assert.equal(aggregate.sourceRefRetained, true);
  assert.equal(lawQueue.drawableProxy, false);
  assert.equal(lawQueue.renderParticipation, 'diagnostic-metadata-only');
  assert.equal(lawQueue.proxyCount, 5);

  const proxyConsumer = resolveSchroederRenderProxyVisibleConsumer({
    proxyDescriptorPlan: proxyPlan
  });
  assert.equal(proxyConsumer.schema, ULG_SPH_SCENE_SCHROEDER_RENDER_PROXY_VISIBLE_CONSUMER_SCHEMA);
  assert.equal(proxyConsumer.status, 'schroeder-render-proxy-visible-consumer-ready');
  assert.equal(proxyConsumer.ready, true);
  assert.equal(proxyConsumer.consumerKind, 'renderer-visible-descriptor-import');
  assert.equal(proxyConsumer.metadataDescriptorImportReady, true);
  assert.equal(proxyConsumer.rawGpuBufferDrawBindingReady, false);
  assert.equal(
    proxyConsumer.rawGpuBufferDrawBindingStatus,
    'deferred-raw-gpubuffer-draw-binding-not-admitted'
  );
  assert.equal(proxyConsumer.frameCopyReadbackRequired, false);
  assert.equal(proxyConsumer.overlayRequired, false);
  assert.equal(proxyConsumer.presentationOwnsPhysicsCadence, false);

  const drawSource = createSchroederRenderProxyDrawSource({
    proxyDescriptorPlan: proxyPlan,
    visibleConsumer: proxyConsumer
  });
  assert.equal(drawSource.schema, ULG_SPH_SCENE_SCHROEDER_RENDER_PROXY_DRAW_SOURCE_SCHEMA);
  assert.equal(drawSource.status, 'schroeder-render-proxy-draw-source-ready');
  assert.equal(drawSource.drawBatchCount, 2);
  assert.equal(drawSource.drawableProxyCount, 15);
  assert.equal(drawSource.sourceRefsReady, true);
  assert.equal(drawSource.rawGpuBufferBinding, false);
  assert.equal(drawSource.cpuGeometryMaterialized, false);
  assert.equal(drawSource.frameCopyReadbackRequired, false);
  assert.equal(drawSource.overlayRequired, false);
  assert.equal(drawSource.materializationMode, 'descriptor-batched-retained-ss-source');
  assert.equal(drawSource.drawBatches[0].sourceRef.retainedBufferRef, 'active-node-list:test');
  assert.equal(drawSource.drawBatches[1].sourceRef.retainedBufferRef, 'aggregate-node:test');

  const nativeBackend = resolveSchroederRenderProxyBackendSelection({
    drawSource,
    rendererCapability: {
      schema: 'peercompute.ulg.sph-extension-surface-renderer-capability.v0',
      status: 'native-webgpu-surface-consumer-supported',
      rendererBackend: 'native-webgpu',
      visibleNoReadbackSupported: true,
      nativeSurfaceConsumerPixelValidationStatus: 'passed',
      nativeSurfaceConsumerPixelValidationSource:
        'playwright-composited-frame',
      nativeSurfaceConsumerPixelValidationNonzeroPixelCount: 64,
      nativeSurfaceConsumerPixelValidationResourceGeneration: 7,
      nativeSurfaceConsumerActiveResourceGeneration: 7
    },
    renderBridgeMode: 'native-webgpu-surface-consumer',
    renderBridgeStatus: 'native-webgpu-surface-consumer-ready',
    pixelValidationStatus: 'passed'
  });
  assert.equal(nativeBackend.schema, ULG_SPH_SCENE_SCHROEDER_RENDER_PROXY_BACKEND_SELECTION_SCHEMA);
  assert.equal(nativeBackend.status, 'schroeder-render-proxy-backend-native-webgpu-visible-ready');
  assert.equal(nativeBackend.ready, true);
  assert.equal(nativeBackend.selectedBackend, 'native-webgpu-retained-proxy');
  assert.equal(nativeBackend.selectedBackendKind, 'same-device-retained-webgpu-draw');
  assert.equal(nativeBackend.nativeSubmitReady, true);
  assert.equal(nativeBackend.visibleValidationReady, true);
  assert.equal(nativeBackend.sameDeviceRetainedBufferBindingRequired, true);
  assert.equal(nativeBackend.sameDeviceRetainedBufferBindingReady, true);
  assert.equal(nativeBackend.rawGpuBufferTransferRequired, false);
  assert.equal(nativeBackend.frameCopyReadbackRequired, false);
  assert.equal(nativeBackend.overlayRequired, false);
  assert.equal(nativeBackend.peerComputeHotPath, true);

  const pendingNativeBackend = resolveSchroederRenderProxyBackendSelection({
    drawSource,
    rendererCapability: {
      status: 'native-webgpu-surface-consumer-supported',
      rendererBackend: 'native-webgpu',
      visibleNoReadbackSupported: true,
      nativeSurfaceConsumerPixelValidationStatus: 'not-run'
    },
    renderBridgeMode: 'native-webgpu-surface-consumer',
    renderBridgeStatus: 'native-webgpu-surface-consumer-ready',
    pixelValidationStatus: 'not-run'
  });
  assert.equal(pendingNativeBackend.status, 'schroeder-render-proxy-backend-native-webgpu-submit-ready');
  assert.equal(pendingNativeBackend.ready, true);
  assert.equal(pendingNativeBackend.nativeSubmitReady, true);
  assert.equal(pendingNativeBackend.visibleValidationReady, false);

  const sameQueueNativeBackend = resolveSchroederRenderProxyBackendSelection({
    drawSource,
    rendererCapability: {
      status: 'native-webgpu-surface-consumer-supported',
      rendererBackend: 'native-webgpu',
      visibleNoReadbackSupported: true,
      nativeSurfaceConsumerPixelValidationStatus: 'not-run',
      nativeSurfaceConsumerCandidateForegroundValidationStatus: 'passed',
      nativeSurfaceConsumerCandidateForegroundProofKind:
        'same-queue-private-staged-composite-submission',
      nativeSurfaceConsumerCandidateForegroundGpuFenceSatisfied: false,
      nativeSurfaceConsumerCandidateForegroundSameQueueSubmissionBoundary: true,
      nativeSurfaceConsumerCandidateForegroundSubmittedDrawCount: 4,
      nativeSurfaceConsumerCandidateSchroederProxySubmission: {
        valid: true,
        completeForCandidate: true
      }
    },
    renderBridgeMode: 'native-webgpu-surface-consumer',
    renderBridgeStatus: 'native-webgpu-surface-consumer-ready',
    pixelValidationStatus: 'not-run'
  });
  assert.equal(
    sameQueueNativeBackend.status,
    'schroeder-render-proxy-backend-native-webgpu-submit-ready'
  );
  assert.equal(sameQueueNativeBackend.visibleValidationReady, false);
  assert.equal(sameQueueNativeBackend.frameCopyReadbackRequired, false);

  const sameQueueWithoutExactProxySubmission =
    resolveSchroederRenderProxyBackendSelection({
      drawSource,
      rendererCapability: {
        status: 'native-webgpu-surface-consumer-supported',
        rendererBackend: 'native-webgpu',
        visibleNoReadbackSupported: true,
        nativeSurfaceConsumerPixelValidationStatus: 'not-run',
        nativeSurfaceConsumerCandidateForegroundValidationStatus: 'passed',
        nativeSurfaceConsumerCandidateForegroundProofKind:
          'same-queue-private-staged-composite-submission',
        nativeSurfaceConsumerCandidateForegroundGpuFenceSatisfied: false,
        nativeSurfaceConsumerCandidateForegroundSameQueueSubmissionBoundary:
          true,
        nativeSurfaceConsumerCandidateForegroundSubmittedDrawCount: 4,
        nativeSurfaceConsumerCandidateSchroederProxySubmission: {
          valid: false,
          completeForCandidate: false
        }
      },
      renderBridgeMode: 'native-webgpu-surface-consumer',
      renderBridgeStatus: 'native-webgpu-surface-consumer-ready',
      pixelValidationStatus: 'not-run'
    });
  assert.equal(
    sameQueueWithoutExactProxySubmission.status,
    'schroeder-render-proxy-backend-native-webgpu-submit-ready'
  );
  assert.equal(
    sameQueueWithoutExactProxySubmission.visibleValidationReady,
    false
  );

  const autoWithDiagnosticAdmitted = resolveSchroederRenderProxyBackendSelection({
    drawSource,
    backendPreference: 'auto',
    allowDiagnosticCpuProxy: true,
    diagnosticMaxProxyCount: 20
  });
  assert.equal(
    autoWithDiagnosticAdmitted.status,
    'blocked-schroeder-render-proxy-backend-renderer-capability'
  );
  assert.equal(autoWithDiagnosticAdmitted.ready, false);
  assert.equal(autoWithDiagnosticAdmitted.selectedBackend, 'native-webgpu-retained-proxy');
  assert.equal(autoWithDiagnosticAdmitted.diagnosticCpuProxyExplicitlyRequested, false);
  assert.equal(autoWithDiagnosticAdmitted.diagnosticCpuProxyAllowedByPolicy, true);
  assert.equal(autoWithDiagnosticAdmitted.diagnosticCpuProxyAdmitted, false);
  assert.equal(autoWithDiagnosticAdmitted.diagnosticCpuProxyReady, false);
  assert.equal(autoWithDiagnosticAdmitted.diagnosticCpuProxyHotPathAllowed, false);
  assert.equal(autoWithDiagnosticAdmitted.peerComputeHotPath, false);

  const diagnosticBackend = resolveSchroederRenderProxyBackendSelection({
    drawSource,
    backendPreference: 'diagnostic-cpu',
    allowDiagnosticCpuProxy: true,
    diagnosticMaxProxyCount: 20
  });
  assert.equal(diagnosticBackend.status, 'schroeder-render-proxy-backend-diagnostic-cpu-ready');
  assert.equal(diagnosticBackend.ready, true);
  assert.equal(diagnosticBackend.selectedBackend, 'diagnostic-cpu-descriptor-proxy');
  assert.equal(diagnosticBackend.diagnosticOnly, true);
  assert.equal(diagnosticBackend.peerComputeHotPath, false);
  assert.equal(diagnosticBackend.diagnosticCpuProxyExplicitlyRequested, true);
  assert.equal(diagnosticBackend.diagnosticCpuProxyAllowedByPolicy, true);
  assert.equal(diagnosticBackend.diagnosticCpuProxyAdmitted, true);
  assert.equal(diagnosticBackend.cpuGeometryMaterialized, false);
  assert.equal(diagnosticBackend.cpuGeometryMaterializationAdmitted, true);
  assert.equal(
    diagnosticBackend.cpuGeometryMaterializationPolicy,
    'explicit-diagnostic-capped-metadata-only'
  );
  assert.equal(
    diagnosticBackend.diagnosticCpuProxyMaterializationMode,
    'diagnostic-cpu-descriptor-proxy-metadata-only'
  );
  assert.equal(diagnosticBackend.diagnosticCpuProxyBudget, 20);
  assert.equal(diagnosticBackend.diagnosticCpuProxyWithinBudget, true);
  assert.equal(diagnosticBackend.diagnosticCpuProxyHotPathAllowed, false);
  assert.equal(diagnosticBackend.fullParticleReadbackRequired, false);

  const overBudgetDiagnosticBackend = resolveSchroederRenderProxyBackendSelection({
    drawSource,
    backendPreference: 'diagnostic-cpu',
    allowDiagnosticCpuProxy: true,
    diagnosticMaxProxyCount: 14
  });
  assert.equal(
    overBudgetDiagnosticBackend.status,
    'blocked-schroeder-render-proxy-backend-diagnostic-budget'
  );
  assert.equal(overBudgetDiagnosticBackend.ready, false);
  assert.equal(overBudgetDiagnosticBackend.selectedBackend, 'diagnostic-cpu-descriptor-proxy');
  assert.equal(overBudgetDiagnosticBackend.diagnosticCpuProxyExplicitlyRequested, true);
  assert.equal(overBudgetDiagnosticBackend.diagnosticCpuProxyAdmitted, true);
  assert.equal(overBudgetDiagnosticBackend.diagnosticCpuProxyReady, false);
  assert.equal(overBudgetDiagnosticBackend.diagnosticCpuProxyWithinBudget, false);
  assert.equal(overBudgetDiagnosticBackend.cpuGeometryMaterialized, false);
  assert.equal(overBudgetDiagnosticBackend.peerComputeHotPath, false);

  const rawBlocked = resolveSchroederRenderProxyVisibleConsumer({
    proxyDescriptorPlan: proxyPlan,
    requestRawGpuBufferDrawBinding: true,
    rendererCapability: {
      status: 'same-device-gpu-buffer-geometry-blocked-webgl-renderer',
      reason: 'same-device GPUBuffer geometry requires Three WebGPU renderer',
      rendererBackend: 'three-webgl',
      visibleNoReadbackSupported: false
    }
  });
  assert.equal(
    rawBlocked.status,
    'schroeder-render-proxy-visible-consumer-blocked-renderer-capability'
  );
  assert.equal(
    rawBlocked.rawGpuBufferDrawBindingStatus,
    'blocked-raw-gpubuffer-draw-binding-renderer-capability'
  );
  assert.equal(rawBlocked.ready, false);

  const metadata = createResidentRenderSourceMetadata({
    residentSteps: {
      signature: 'steps-with-schroeder-summary',
      residentExecutionGeneration: 11,
      currentResidentExecutionGeneration: 11,
      nextSphParticleState: { step: 7, time: 0.035, particleCount: 128 },
      portableSummary
    },
    schroederPortableSummaryAdmission: admission,
    source: 'resident-render-refresh'
  });
  assert.equal(metadata.schroederRenderSource.status, 'schroeder-render-source-admitted');
  assert.equal(metadata.schroederRenderSource.renderLodSummarySchema, ULG_SCHROEDER_RENDER_LOD_SUMMARY_SCHEMA);
  assert.equal(
    metadata.schroederRenderProxyDescriptorPlan.status,
    'schroeder-render-proxy-descriptors-ready'
  );
  assert.equal(
    metadata.schroederRenderProxyVisibleConsumer.status,
    'schroeder-render-proxy-visible-consumer-ready'
  );
  assert.equal(
    metadata.schroederRenderProxyDrawSource.status,
    'schroeder-render-proxy-draw-source-ready'
  );
  assert.equal(
    metadata.schroederRenderProxyBackendSelection.status,
    'blocked-schroeder-render-proxy-backend-renderer-capability'
  );
  assert.equal(metadata.schroederRenderProxyBackendSelection.ready, false);
  assert.equal(metadata.schroederRenderProxyBackendSelection.selectedBackend, 'native-webgpu-retained-proxy');

  const nativeMetadata = createResidentRenderSourceMetadata({
    residentSteps: {
      signature: 'steps-with-schroeder-summary',
      residentExecutionGeneration: 12,
      currentResidentExecutionGeneration: 12,
      nextSphParticleState: { step: 8, time: 0.04, particleCount: 128 },
      portableSummary
    },
    schroederPortableSummaryAdmission: admission,
    schroederRenderProxyRendererCapability: {
      status: 'native-webgpu-surface-consumer-supported',
      rendererBackend: 'native-webgpu',
      visibleNoReadbackSupported: true,
      nativeSurfaceConsumerPixelValidationStatus: 'passed'
    },
    schroederRenderProxyRenderBridgeMode: 'native-webgpu-surface-consumer',
    schroederRenderProxyRenderBridgeStatus: 'native-webgpu-surface-consumer-ready',
    schroederRenderProxyPixelValidationStatus: 'passed',
    source: 'resident-render-refresh'
  });
  assert.equal(
    nativeMetadata.schroederRenderProxyBackendSelection.status,
    'schroeder-render-proxy-backend-native-webgpu-submit-ready'
  );
  assert.equal(nativeMetadata.schroederRenderProxyBackendSelection.ready, true);
  assert.equal(
    nativeMetadata.schroederRenderProxyBackendSelection.visibleValidationReady,
    false
  );
  assert.equal(
    nativeMetadata.schroederRenderProxyBackendSelection.selectedBackend,
    'native-webgpu-retained-proxy'
  );

  const localObservationMetadata = createResidentRenderSourceMetadata({
    residentSteps: {
      signature: 'scene-local-steps-with-schroeder-summary',
      residentExecutionGeneration: 13,
      currentResidentExecutionGeneration: 13,
      nextSphParticleState: { step: 9, time: 0.045, particleCount: 128 },
      portableSummary
    },
    renderOwnershipPolicy: {
      schroederRenderLodPresentationReady: false,
      schroederRenderLodStatus: 'disabled-schroeder-render-lod-summary'
    },
    source: 'resident-render-refresh'
  });
  assert.equal(
    localObservationMetadata.schroederRenderSource.status,
    'schroeder-render-source-local-observation-ready'
  );
  assert.equal(localObservationMetadata.schroederRenderSource.renderLodPresentationReady, true);
  assert.equal(
    localObservationMetadata.schroederRenderProxyDrawSource.status,
    'schroeder-render-proxy-draw-source-ready'
  );

  const target = {};
  applyResidentRenderSourceMetadata(target, metadata);
  assert.equal(target.sourceSchroederRenderSourceSchema, ULG_SPH_SCENE_SCHROEDER_RENDER_SOURCE_SCHEMA);
  assert.equal(target.sourceSchroederRenderSourceStatus, 'schroeder-render-source-admitted');
  assert.equal(target.sourceSchroederRenderSourcePresentationReady, true);
  assert.equal(target.sourceSchroederRenderSourceActiveLeafProxyCount, 12);
  assert.equal(target.sourceSchroederRenderSourceAggregateProxyCount, 3);
  assert.equal(target.sourceSchroederRenderSourceLawQueueProxyCount, 5);
  assert.equal(target.sourceSchroederRenderSourceTotalProxyCount, 20);
  assert.equal(target.sourceSchroederRenderSourceClosureDerivedPbr, true);
  assert.equal(target.sourceSchroederRenderSourceDescriptorOnlyHandoff, true);
  assert.equal(target.sourceSchroederRenderSourceFullParticleReadbackAvoided, true);
  assert.equal(target.sourceSchroederRenderSourceRawGpuBufferTransferDetected, false);
  assert.equal(target.sourceSchroederRenderSourceAdmissionPublished, true);
  assert.equal(target.sourceSchroederRenderSourceAdmissionStateKey, 'schroeder-summary:test-state');
  assert.equal(
    target.sourceSchroederRenderProxyDescriptorPlanStatus,
    'schroeder-render-proxy-descriptors-ready'
  );
  assert.equal(target.sourceSchroederRenderProxyDescriptorCount, 3);
  assert.equal(target.sourceSchroederRenderProxyDrawableProxyCount, 15);
  assert.equal(target.sourceSchroederRenderProxyDiagnosticProxyCount, 5);
  assert.equal(target.sourceSchroederRenderProxyTotalProxyCount, 20);
  assert.equal(target.sourceSchroederRenderProxyClosurePbrAvailable, true);
  assert.equal(
    target.sourceSchroederRenderProxyVisibleRenderSource,
    'schroeder-render-lod-proxy-descriptors'
  );
  assert.equal(target.sourceSchroederRenderProxyPresentationOwnsPhysicsCadence, false);
  assert.equal(
    target.sourceSchroederRenderProxyVisibleConsumerStatus,
    'schroeder-render-proxy-visible-consumer-ready'
  );
  assert.equal(target.sourceSchroederRenderProxyVisibleConsumerReady, true);
  assert.equal(
    target.sourceSchroederRenderProxyVisibleConsumerKind,
    'renderer-visible-descriptor-import'
  );
  assert.equal(
    target.sourceSchroederRenderProxyVisibleConsumerMetadataDescriptorImportReady,
    true
  );
  assert.equal(
    target.sourceSchroederRenderProxyVisibleConsumerRawGpuBufferDrawBindingStatus,
    'deferred-raw-gpubuffer-draw-binding-not-admitted'
  );
  assert.equal(target.sourceSchroederRenderProxyVisibleConsumerFrameCopyReadbackRequired, false);
  assert.equal(target.sourceSchroederRenderProxyVisibleConsumerOverlayRequired, false);
  assert.equal(
    target.sourceSchroederRenderProxyVisibleConsumerPresentationOwnsPhysicsCadence,
    false
  );
  assert.equal(target.sourceSchroederRenderProxyDrawSourceStatus, 'schroeder-render-proxy-draw-source-ready');
  assert.equal(target.sourceSchroederRenderProxyDrawSourceReady, true);
  assert.equal(target.sourceSchroederRenderProxyDrawBatchCount, 2);
  assert.equal(target.sourceSchroederRenderProxyDrawSourceRefsReady, true);
  assert.equal(target.sourceSchroederRenderProxyDrawDrawableProxyCount, 15);
  assert.equal(
    target.sourceSchroederRenderProxyDrawMaterializationMode,
    'descriptor-batched-retained-ss-source'
  );
  assert.equal(target.sourceSchroederRenderProxyDrawRawGpuBufferBinding, false);
  assert.equal(target.sourceSchroederRenderProxyDrawCpuGeometryMaterialized, false);
  assert.equal(target.sourceSchroederRenderProxyDrawFrameCopyReadbackRequired, false);
  assert.equal(target.sourceSchroederRenderProxyDrawOverlayRequired, false);
  assert.equal(
    target.sourceSchroederRenderProxyBackendSelectionStatus,
    'blocked-schroeder-render-proxy-backend-renderer-capability'
  );
  assert.equal(target.sourceSchroederRenderProxyBackendSelectionReady, false);
  assert.equal(target.sourceSchroederRenderProxyBackendSelected, 'native-webgpu-retained-proxy');
  assert.equal(target.sourceSchroederRenderProxyBackendNativeSubmitReady, false);
  assert.equal(target.sourceSchroederRenderProxyBackendDiagnosticCpuProxyExplicitlyRequested, false);
  assert.equal(target.sourceSchroederRenderProxyBackendDiagnosticCpuProxyAllowedByPolicy, false);
  assert.equal(target.sourceSchroederRenderProxyBackendDiagnosticCpuProxyAdmitted, false);
  assert.equal(target.sourceSchroederRenderProxyBackendDiagnosticCpuProxyReady, false);
  assert.equal(target.sourceSchroederRenderProxyBackendDiagnosticCpuProxyBudget, 256);
  assert.equal(target.sourceSchroederRenderProxyBackendDiagnosticCpuProxyWithinBudget, true);
  assert.equal(target.sourceSchroederRenderProxyBackendDiagnosticCpuProxyHotPathAllowed, false);
  assert.equal(target.sourceSchroederRenderProxyBackendDiagnosticCpuProxyMaterializationMode, null);
  assert.equal(target.sourceSchroederRenderProxyBackendFrameCopyReadbackRequired, false);
  assert.equal(target.sourceSchroederRenderProxyBackendOverlayRequired, false);
  assert.equal(target.sourceSchroederRenderProxyBackendFullParticleReadbackRequired, false);
  assert.equal(target.sourceSchroederRenderProxyBackendCpuGeometryMaterialized, false);
  assert.equal(target.sourceSchroederRenderProxyBackendCpuGeometryMaterializationAdmitted, false);
  assert.equal(target.sourceSchroederRenderProxyBackendCpuGeometryMaterializationPolicy, 'disabled');
});

test('SPH scene builds Schroeder native proxy executor from same-device retained refs', () => {
  const { drawSource, nativeBackend } = createSchroederNativeProxyFixture();
  const { device, calls } = createFakeSchroederProxyRenderDevice();
  let retainedReleaseCount = 0;
  const retainedBufferOwner = { label: 'resident-render-buffer-owner' };
  const activeBuffer = { label: 'active-node-gpu-buffer' };
  const aggregateBuffer = { label: 'aggregate-node-gpu-buffer' };
  const retainedBufferResolver = new Map([
    [
      'active-node-list:test',
      {
        buffer: activeBuffer,
        rowCount: 12,
        strideFloats: SPH_SCHROEDER_RENDER_PROXY_ACTIVE_NODE_FLOATS,
        byteLength: 12 * SPH_SCHROEDER_RENDER_PROXY_ACTIVE_NODE_FLOATS * Float32Array.BYTES_PER_ELEMENT
      }
    ],
    [
      'aggregate-node:test',
      {
        buffer: aggregateBuffer,
        rowCount: 3,
        strideFloats: SPH_SCHROEDER_RENDER_PROXY_AGGREGATE_NODE_FLOATS,
        byteLength: 3 * SPH_SCHROEDER_RENDER_PROXY_AGGREGATE_NODE_FLOATS * Float32Array.BYTES_PER_ELEMENT
      }
    ]
  ]);

  const executor = createSchroederRenderProxyNativeWebGpuExecutor({
    drawSource,
    backendSelection: nativeBackend,
    device,
    format: 'rgba8unorm',
    depthFormat: SPH_RESIDENT_SURFACE_DRAW_DEPTH_FORMAT,
    retainedBufferResolver,
    retainedBufferOwner,
    releaseRetainedBuffers() {
      retainedReleaseCount += 1;
    },
    source: 'unit-test'
  });

  assert.equal(executor.schema, ULG_SPH_SCENE_SCHROEDER_RENDER_PROXY_NATIVE_EXECUTOR_SCHEMA);
  assert.equal(executor.status, 'schroeder-render-proxy-native-executor-ready');
  assert.equal(executor.ready, true);
  assert.equal(executor.selectedBackend, 'native-webgpu-retained-proxy');
  assert.equal(executor.depthFormat, SPH_RESIDENT_SURFACE_DRAW_DEPTH_FORMAT);
  assert.equal(executor.rawGpuBufferBinding, true);
  assert.equal(executor.rawGpuBufferTransferRequired, false);
  assert.equal(executor.frameCopyReadbackRequired, false);
  assert.equal(executor.overlayRequired, false);
  assert.equal(executor.fullParticleReadbackRequired, false);
  assert.equal(executor.descriptorOnlyPeerComputeHandoff, true);
  assert.equal(executor.inputDrawSource, drawSource);
  assert.equal(executor.inputRetainedBufferResolver, retainedBufferResolver);
  assert.equal(executor.retainedBufferOwner, retainedBufferOwner);
  assert.equal(executor.cameraUniformFloats, SPH_SCHROEDER_RENDER_PROXY_NATIVE_CAMERA_FLOATS);
  assert.equal(executor.batchUniformFloats, SPH_SCHROEDER_RENDER_PROXY_NATIVE_BATCH_FLOATS);
  assert.equal(executor.drawCommands.length, 2);
  assert.equal(executor.drawCommands[0].retainedBuffer, activeBuffer);
  assert.equal(executor.drawCommands[0].retainedBufferRef, 'active-node-list:test');
  assert.equal(executor.drawCommands[0].strideFloats, SPH_SCHROEDER_RENDER_PROXY_ACTIVE_NODE_FLOATS);
  assert.equal(executor.drawCommands[0].drawVertexCount, 6);
  assert.equal(executor.drawCommands[0].drawInstanceCount, 12);
  assert.equal(executor.drawCommands[1].retainedBuffer, aggregateBuffer);
  assert.equal(executor.drawCommands[1].retainedBufferRef, 'aggregate-node:test');
  assert.equal(executor.drawCommands[1].strideFloats, SPH_SCHROEDER_RENDER_PROXY_AGGREGATE_NODE_FLOATS);
  assert.equal(executor.drawCommands[1].drawInstanceCount, 3);
  assert.match(SPH_SCHROEDER_RENDER_PROXY_NATIVE_WGSL, /proxy_rows/);
  assert.match(SPH_SCHROEDER_RENDER_PROXY_NATIVE_WGSL, /row_vec4\(row_index, 3u\)/);
  assert.equal(calls.shaderModules.length, 1);
  assert.equal(calls.shaderModules[0].code, SPH_SCHROEDER_RENDER_PROXY_NATIVE_WGSL);
  assert.equal(calls.bindGroupLayouts.length, 1);
  assert.equal(calls.pipelineLayouts.length, 1);
  assert.equal(calls.pipelines.length, 1);
  assert.equal(calls.pipelines[0].depthStencil.format, SPH_RESIDENT_SURFACE_DRAW_DEPTH_FORMAT);
  assert.equal(calls.pipelines[0].depthStencil.depthWriteEnabled, false);
  assert.equal(calls.bindGroups.length, 2);
  assert.equal(calls.writes.length, 2);
  assert.equal(calls.writes[0].data[0], 12);
  assert.equal(calls.writes[0].data[1], SPH_SCHROEDER_RENDER_PROXY_ACTIVE_NODE_FLOATS);
  assert.equal(calls.writes[0].data[2], 0);
  assert.equal(calls.writes[1].data[0], 3);
  assert.equal(calls.writes[1].data[1], SPH_SCHROEDER_RENDER_PROXY_AGGREGATE_NODE_FLOATS);
  assert.equal(calls.writes[1].data[2], 1);

  const beforeCameraWrites = calls.writes.length;
  const cameraUpdate = executor.updateCamera({
    viewProjection: { elements: Array.from({ length: 16 }, (_, index) => index + 1) },
    viewportWidth: 800,
    viewportHeight: 600,
    nativeGridSpacingM: 0.25
  });
  assert.equal(cameraUpdate.status, 'schroeder-render-proxy-native-camera-uniform-updated');
  assert.equal(cameraUpdate.byteLength, SPH_SCHROEDER_RENDER_PROXY_NATIVE_CAMERA_FLOATS * Float32Array.BYTES_PER_ELEMENT);
  assert.equal(cameraUpdate.viewportWidth, 800);
  assert.equal(cameraUpdate.viewportHeight, 600);
  assert.equal(cameraUpdate.nativeGridSpacingM, 0.25);
  assert.equal(calls.writes.length, beforeCameraWrites + 1);
  assert.equal(calls.writes.at(-1).buffer, executor.cameraBuffer);
  assert.equal(calls.writes.at(-1).data[0], 1);
  assert.equal(calls.writes.at(-1).data[15], 16);
  assert.equal(calls.writes.at(-1).data[16], 800);
  assert.equal(calls.writes.at(-1).data[17], 600);
  assert.equal(calls.writes.at(-1).data[20], 0.25);

  const passCalls = [];
  const pass = {
    setPipeline(pipeline) {
      passCalls.push({ type: 'setPipeline', pipeline });
    },
    setBindGroup(index, bindGroup) {
      passCalls.push({ type: 'setBindGroup', index, bindGroup });
    },
    draw(vertexCount, instanceCount) {
      passCalls.push({ type: 'draw', vertexCount, instanceCount });
    }
  };
  const submitted = executor.execute(pass);
  assert.equal(submitted.status, 'schroeder-render-proxy-native-executor-submitted-to-pass');
  assert.equal(submitted.drawCommandCount, 2);
  assert.equal(submitted.drawInstanceCount, 15);
  assert.equal(passCalls[0].type, 'setPipeline');
  assert.equal(passCalls[0].pipeline, executor.pipeline);
  assert.equal(passCalls[1].type, 'setBindGroup');
  assert.equal(passCalls[1].bindGroup, executor.drawCommands[0].bindGroup);
  assert.deepEqual(
    passCalls.filter((call) => call.type === 'draw').map((call) => [call.vertexCount, call.instanceCount]),
    [[6, 12], [6, 3]]
  );
  assert.equal(executor.destroy(), true);
  assert.equal(executor.destroy(), false);
  assert.equal(retainedReleaseCount, 1);
  assert.equal(executor.cameraBuffer.destroyCount, 1);
  assert.deepEqual(
    executor.drawCommands.map((command) => command.batchParamsBuffer.destroyCount),
    [1, 1]
  );
});

test('Schroeder proxy programs are shared across simulation generations and data bindings', () => {
  const { drawSource, nativeBackend } = createSchroederNativeProxyFixture();
  const { device, calls } = createFakeSchroederProxyRenderDevice();
  const resolver = (suffix) => new Map([
    ['active-node-list:test', {
      buffer: { label: `active-${suffix}` },
      rowCount: suffix === 'generation-a' ? 12 : 8,
      strideFloats: SPH_SCHROEDER_RENDER_PROXY_ACTIVE_NODE_FLOATS,
      byteLength: 12 * SPH_SCHROEDER_RENDER_PROXY_ACTIVE_NODE_FLOATS
        * Float32Array.BYTES_PER_ELEMENT
    }],
    ['aggregate-node:test', {
      buffer: { label: `aggregate-${suffix}` },
      rowCount: suffix === 'generation-a' ? 3 : 2,
      strideFloats: SPH_SCHROEDER_RENDER_PROXY_AGGREGATE_NODE_FLOATS,
      byteLength: 3 * SPH_SCHROEDER_RENDER_PROXY_AGGREGATE_NODE_FLOATS
        * Float32Array.BYTES_PER_ELEMENT
    }]
  ]);
  const generationA = createSchroederRenderProxyNativeWebGpuExecutor({
    drawSource,
    backendSelection: nativeBackend,
    device,
    format: 'rgba8unorm',
    depthFormat: SPH_RESIDENT_SURFACE_DRAW_DEPTH_FORMAT,
    retainedBufferResolver: resolver('generation-a'),
    source: 'generation-a'
  });
  const generationB = createSchroederRenderProxyNativeWebGpuExecutor({
    drawSource: {
      ...drawSource,
      nativeGridSpacingM: 0.5,
      drawBatches: drawSource.drawBatches.map((batch) => ({ ...batch }))
    },
    backendSelection: nativeBackend,
    device,
    format: 'rgba8unorm',
    depthFormat: SPH_RESIDENT_SURFACE_DRAW_DEPTH_FORMAT,
    retainedBufferResolver: resolver('generation-b'),
    source: 'generation-b'
  });

  assert.equal(generationA.ready, true);
  assert.equal(generationB.ready, true);
  assert.equal(generationA.programIdentity, 'device-color-format-depth-format-shader-abi');
  assert.equal(generationA.programKey, generationB.programKey);
  assert.equal(generationA.module, generationB.module);
  assert.equal(generationA.bindGroupLayout, generationB.bindGroupLayout);
  assert.equal(generationA.pipelineLayout, generationB.pipelineLayout);
  assert.equal(generationA.pipeline, generationB.pipeline);
  assert.equal(calls.shaderModules.length, 1);
  assert.equal(calls.bindGroupLayouts.length, 1);
  assert.equal(calls.pipelineLayouts.length, 1);
  assert.equal(calls.pipelines.length, 1);
  assert.notEqual(generationA.cameraBuffer, generationB.cameraBuffer);
  assert.notEqual(
    generationA.drawCommands[0].batchParamsBuffer,
    generationB.drawCommands[0].batchParamsBuffer
  );
  assert.notEqual(
    generationA.drawCommands[0].bindGroup,
    generationB.drawCommands[0].bindGroup
  );

  assert.equal(generationA.destroy(), true);
  assert.equal(generationB.destroy(), true);

  const noDepth = createSchroederRenderProxyNativeWebGpuExecutor({
    drawSource,
    backendSelection: nativeBackend,
    device,
    format: 'rgba8unorm',
    depthFormat: null,
    retainedBufferResolver: resolver('no-depth'),
    source: 'different-render-state'
  });
  assert.equal(noDepth.ready, true);
  assert.notEqual(noDepth.programKey, generationA.programKey);
  assert.equal(calls.shaderModules.length, 2, 'render-state variant owns one separate program');
  assert.equal(calls.pipelines.length, 2);
  assert.equal(noDepth.destroy(), true);
});

test('SPH scene retries retained SS input release without re-destroying proxy uniforms', () => {
  const { drawSource, nativeBackend } = createSchroederNativeProxyFixture();
  const { device } = createFakeSchroederProxyRenderDevice();
  let retainedReleaseAttemptCount = 0;
  const retainedBufferResolver = new Map([
    ['active-node-list:test', {
      buffer: { label: 'candidate-active-node-gpu-buffer' },
      rowCount: 12,
      strideFloats: SPH_SCHROEDER_RENDER_PROXY_ACTIVE_NODE_FLOATS,
      byteLength: 12 * SPH_SCHROEDER_RENDER_PROXY_ACTIVE_NODE_FLOATS
        * Float32Array.BYTES_PER_ELEMENT
    }],
    ['aggregate-node:test', {
      buffer: { label: 'candidate-aggregate-node-gpu-buffer' },
      rowCount: 3,
      strideFloats: SPH_SCHROEDER_RENDER_PROXY_AGGREGATE_NODE_FLOATS,
      byteLength: 3 * SPH_SCHROEDER_RENDER_PROXY_AGGREGATE_NODE_FLOATS
        * Float32Array.BYTES_PER_ELEMENT
    }]
  ]);
  const executor = createSchroederRenderProxyNativeWebGpuExecutor({
    drawSource,
    backendSelection: nativeBackend,
    device,
    format: 'rgba8unorm',
    retainedBufferResolver,
    retainedBufferOwner: { label: 'candidate-retained-buffer-owner' },
    releaseRetainedBuffers() {
      retainedReleaseAttemptCount += 1;
      if (retainedReleaseAttemptCount === 1) {
        throw new Error('injected retained-buffer owner release failure');
      }
    }
  });

  assert.equal(executor.ready, true);
  assert.throws(
    () => executor.destroy(),
    /injected retained-buffer owner release failure/
  );
  assert.equal(retainedReleaseAttemptCount, 1);
  assert.equal(executor.cameraBuffer.destroyCount, 1);
  assert.deepEqual(
    executor.drawCommands.map(
      (command) => command.batchParamsBuffer.destroyCount
    ),
    [1, 1]
  );
  assert.equal(executor.destroy(), true);
  assert.equal(retainedReleaseAttemptCount, 2);
  assert.equal(executor.cameraBuffer.destroyCount, 1);
  assert.deepEqual(
    executor.drawCommands.map(
      (command) => command.batchParamsBuffer.destroyCount
    ),
    [1, 1]
  );
  assert.equal(executor.destroy(), false);
});

test('SPH scene transfers owned Schroeder proxy camera lifetime across executor replacement', () => {
  const { drawSource, nativeBackend } = createSchroederNativeProxyFixture();
  const { device } = createFakeSchroederProxyRenderDevice();
  const activeBuffer = { label: 'replacement-active-node-gpu-buffer' };
  const aggregateBuffer = { label: 'replacement-aggregate-node-gpu-buffer' };
  const retainedBufferResolver = new Map([
    ['active-node-list:test', {
      buffer: activeBuffer,
      rowCount: 12,
      strideFloats: SPH_SCHROEDER_RENDER_PROXY_ACTIVE_NODE_FLOATS,
      byteLength: 12 * SPH_SCHROEDER_RENDER_PROXY_ACTIVE_NODE_FLOATS * Float32Array.BYTES_PER_ELEMENT
    }],
    ['aggregate-node:test', {
      buffer: aggregateBuffer,
      rowCount: 3,
      strideFloats: SPH_SCHROEDER_RENDER_PROXY_AGGREGATE_NODE_FLOATS,
      byteLength: 3 * SPH_SCHROEDER_RENDER_PROXY_AGGREGATE_NODE_FLOATS * Float32Array.BYTES_PER_ELEMENT
    }]
  ]);
  const first = createSchroederRenderProxyNativeWebGpuExecutor({
    drawSource,
    backendSelection: nativeBackend,
    device,
    format: 'rgba8unorm',
    retainedBufferResolver
  });
  const second = createSchroederRenderProxyNativeWebGpuExecutor({
    drawSource,
    backendSelection: nativeBackend,
    device,
    format: 'rgba8unorm',
    retainedBufferResolver,
    cameraBuffer: first.cameraBuffer,
    adoptCameraBuffer: first.cameraBufferOwned
  });

  assert.equal(first.cameraBufferOwned, true);
  assert.equal(second.cameraBufferOwned, true);
  assert.equal(first.destroy({ preserveCameraBuffer: second.cameraBuffer }), true);
  assert.equal(first.cameraBuffer.destroyCount, 0);
  assert.equal(second.destroy(), true);
  assert.equal(first.cameraBuffer.destroyCount, 1);
});

test('SPH scene builds local retained resolver for Schroeder same-device render buffers', () => {
  const activeBuffer = { label: 'active-node-gpu-buffer' };
  const aggregateBuffer = { label: 'aggregate-node-gpu-buffer' };
  const retainedBufferOwner = {
    schema: 'peercompute.ulg.schroeder-local-retained-render-buffer-resolver.v0',
    status: 'schroeder-local-retained-render-buffer-resolver-ready',
    buffers: [
      {
        retainedBufferRef: 'active-node-list:test',
        buffer: activeBuffer,
        rowCount: 12,
        strideFloats: SPH_SCHROEDER_RENDER_PROXY_ACTIVE_NODE_FLOATS,
        byteLength: 12 * SPH_SCHROEDER_RENDER_PROXY_ACTIVE_NODE_FLOATS
          * Float32Array.BYTES_PER_ELEMENT,
        status: 'retained-buffer-ready'
      },
      {
        resourceKey: 'aggregate-node:test',
        gpuBuffer: aggregateBuffer,
        rowCount: 3,
        strideFloats: SPH_SCHROEDER_RENDER_PROXY_AGGREGATE_NODE_FLOATS,
        byteLength: 3 * SPH_SCHROEDER_RENDER_PROXY_AGGREGATE_NODE_FLOATS
          * Float32Array.BYTES_PER_ELEMENT,
        status: 'retained-buffer-ready'
      },
      {
        retainedBufferRef: 'ignored-keyless-buffer'
      }
    ]
  };
  const local = createSchroederRenderProxyLocalRetainedBufferResolver({
    residentExecution: {
      localRetainedRenderBuffers: retainedBufferOwner
    },
    source: 'unit-test'
  });

  assert.equal(local.schema, 'peercompute.ulg.sph-scene-schroeder-render-proxy-local-retained-buffer-resolver.v0');
  assert.equal(local.status, 'schroeder-render-proxy-local-retained-buffer-resolver-ready');
  assert.equal(local.ready, true);
  assert.equal(local.source, 'unit-test');
  assert.equal(local.sameDeviceOnly, true);
  assert.equal(local.peerComputePortable, false);
  assert.equal(local.descriptorOnlyPeerComputeHandoff, true);
  assert.equal(local.rawGpuBufferTransferAllowed, false);
  assert.equal(local.rawGpuBufferTransferRequired, false);
  assert.equal(local.frameCopyReadbackRequired, false);
  assert.equal(local.fullParticleReadbackRequired, false);
  assert.equal(local.retainedBufferOwner, retainedBufferOwner);
  assert.equal(local.retainedBufferRefCount, 2);
  assert.deepEqual(local.retainedBufferRefs, ['active-node-list:test', 'aggregate-node:test']);
  assert.equal(local.retainedBufferResolver.get('active-node-list:test').buffer, activeBuffer);
  assert.equal(local.retainedBufferResolver.get('aggregate-node:test').buffer, aggregateBuffer);
  assert.equal(
    local.retainedBufferResolver.get('aggregate-node:test').strideFloats,
    SPH_SCHROEDER_RENDER_PROXY_AGGREGATE_NODE_FLOATS
  );

  const empty = createSchroederRenderProxyLocalRetainedBufferResolver();
  assert.equal(empty.status, 'blocked-schroeder-render-proxy-local-retained-buffer-resolver-empty');
  assert.equal(empty.ready, false);
  assert.equal(empty.retainedBufferRefCount, 0);
});

test('SPH scene builds Schroeder native camera uniform payload', () => {
  const payload = createSchroederRenderProxyNativeCameraUniformPayload({
    viewProjection: { elements: Array.from({ length: 16 }, (_, index) => index + 1) },
    viewportWidth: 640.4,
    viewportHeight: 479.6,
    nativeGridSpacingM: 0.25,
    gridBiasM: 1.5,
    mode: 2
  });

  assert.equal(payload.length, SPH_SCHROEDER_RENDER_PROXY_NATIVE_CAMERA_FLOATS);
  assert.equal(payload[0], 1);
  assert.equal(payload[15], 16);
  assert.equal(payload[16], 640);
  assert.equal(payload[17], 480);
  assert.equal(payload[19], 2);
  assert.equal(payload[20], 0.25);
  assert.equal(payload[21], 1.5);

  const identity = createSchroederRenderProxyNativeCameraUniformPayload({
    viewportWidth: 0,
    viewportHeight: -4,
    nativeGridSpacingM: -1
  });
  assert.equal(identity[0], 1);
  assert.equal(identity[5], 1);
  assert.equal(identity[10], 1);
  assert.equal(identity[15], 1);
  assert.equal(identity[16], 1);
  assert.equal(identity[17], 1);
  assert.equal(identity[20], 1);
});

test('SPH scene blocks Schroeder native proxy executor without same-device retained buffers', () => {
  const { drawSource, nativeBackend } = createSchroederNativeProxyFixture();
  const { device } = createFakeSchroederProxyRenderDevice();

  const missingResolver = createSchroederRenderProxyNativeWebGpuExecutor({
    drawSource,
    backendSelection: nativeBackend,
    device,
    format: 'rgba8unorm'
  });
  assert.equal(
    missingResolver.status,
    'blocked-schroeder-render-proxy-native-executor-buffer-resolver'
  );
  assert.equal(missingResolver.ready, false);
  assert.equal(missingResolver.rawGpuBufferTransferRequired, false);
  assert.equal(missingResolver.overlayRequired, false);

  const missingRetainedSource = createSchroederRenderProxyNativeWebGpuExecutor({
    drawSource,
    backendSelection: nativeBackend,
    device,
    format: 'rgba8unorm',
    retainedBufferResolver: new Map()
  });
  assert.equal(
    missingRetainedSource.status,
    'blocked-schroeder-render-proxy-native-executor-retained-source'
  );
  assert.equal(missingRetainedSource.ready, false);
  assert.equal(missingRetainedSource.missingSourceRefCount, 2);
  assert.deepEqual(
    missingRetainedSource.missingSourceRefs,
    ['active-node-list:test', 'aggregate-node:test']
  );
  assert.equal(missingRetainedSource.frameCopyReadbackRequired, false);
  assert.equal(missingRetainedSource.fullParticleReadbackRequired, false);
});

test('SPH scene blocks Schroeder proxy draw source with keyless retained refs', () => {
  const keyedFixture = schroederPortableSummaryFixture();
  const portableSummary = schroederPortableSummaryFixture({
    retainedRefs: keyedFixture.retainedRefs.map(({ retainedBufferRef, ...entry }) => entry)
  });
  const source = createSchroederRenderSourceMetadata({
    schroederPortableSummary: portableSummary,
    source: 'unit-test-keyless-retained-refs'
  });
  assert.equal(source.status, 'schroeder-render-source-local-observation-ready');
  assert.equal(source.activeLeafSourceRef.retained, true);
  assert.equal(source.activeLeafSourceRef.retainedBufferRef, null);

  const proxyPlan = createSchroederRenderProxyDescriptorPlan({ schroederRenderSource: source });
  const proxyConsumer = resolveSchroederRenderProxyVisibleConsumer({
    proxyDescriptorPlan: proxyPlan
  });
  const drawSource = createSchroederRenderProxyDrawSource({
    proxyDescriptorPlan: proxyPlan,
    visibleConsumer: proxyConsumer
  });
  assert.equal(drawSource.status, 'blocked-schroeder-render-proxy-draw-source');
  assert.equal(drawSource.sourceRefsReady, false);
  assert.equal(drawSource.missingSourceRefCount, 2);
  assert.equal(drawSource.drawBatchCount, 0);
  assert.equal(drawSource.blocker, 'schroeder-render-proxy-draw-source-missing-retained-source-ref');

  const backendSelection = resolveSchroederRenderProxyBackendSelection({ drawSource });
  assert.equal(backendSelection.status, 'blocked-schroeder-render-proxy-backend-source');
  assert.equal(backendSelection.ready, false);
});

test('SPH scene blocks Schroeder render source metadata with raw GPUBuffer refs', () => {
  const portableSummary = schroederPortableSummaryFixture({
    retainedRefs: [
      {
        role: 'activeNodes',
        schema: 'peercompute.ulg.schroeder-active-node-list.v0',
        buffer: { fakeGpuBuffer: true },
        transferMode: 'structured-clone-gpubuffer'
      }
    ]
  });
  const source = createSchroederRenderSourceMetadata({ schroederPortableSummary: portableSummary });

  assert.equal(source.status, 'blocked-schroeder-render-source');
  assert.equal(source.blocker, 'schroeder-portable-summary-raw-gpubuffer-transfer-detected');
  assert.equal(source.renderLodPresentationReady, false);
  assert.equal(source.descriptorOnlyPeerComputeHandoff, false);
  assert.equal(source.rawGpuBufferTransferDetected, true);
  assert.equal(source.rawGpuBufferTransferAllowed, false);

  const proxyPlan = createSchroederRenderProxyDescriptorPlan({ schroederRenderSource: source });
  assert.equal(proxyPlan.status, 'blocked-schroeder-render-proxy-descriptors');
  assert.equal(proxyPlan.blocker, 'schroeder-portable-summary-raw-gpubuffer-transfer-detected');
  assert.equal(proxyPlan.rawGpuBufferTransferDetected, true);
  assert.equal(proxyPlan.fullParticleReadbackAvoided, false);

  const consumer = resolveSchroederRenderProxyVisibleConsumer({ proxyDescriptorPlan: proxyPlan });
  assert.equal(consumer.status, 'schroeder-render-proxy-visible-consumer-blocked-input');
  assert.equal(consumer.inputBlocked, true);
  assert.equal(consumer.ready, false);
  const drawSource = createSchroederRenderProxyDrawSource({
    proxyDescriptorPlan: proxyPlan,
    visibleConsumer: consumer
  });
  assert.equal(drawSource.status, 'blocked-schroeder-render-proxy-draw-source');
  assert.equal(drawSource.drawBatchCount, 0);

  const backendSelection = resolveSchroederRenderProxyBackendSelection({ drawSource });
  assert.equal(backendSelection.status, 'blocked-schroeder-render-proxy-backend-source');
  assert.equal(backendSelection.ready, false);
  assert.equal(backendSelection.inputReady, false);
});

test('SPH visible GPU surface consumer requires renderer and exact presentation admission', () => {
  const handoff = resolveResidentSurfaceBufferHandoff({
    surfaceDraw: {
      readbackMode: 'no-full-readback',
      surfaceDrawReadback: false,
      surfaceDrawSummaryReadback: false,
      fullSurfaceDrawReadback: false,
      drawRowsBufferRetained: true,
      drawRowsBufferByteLength: 2 * 16 * Float32Array.BYTES_PER_ELEMENT,
      drawIndirectRowsBufferRetained: true,
      drawIndirectRowsBufferByteLength: 4 * Uint32Array.BYTES_PER_ELEMENT,
      drawAggregateIndirectRowsBufferRetained: true,
      drawAggregateIndirectRowsBufferByteLength: 4 * Uint32Array.BYTES_PER_ELEMENT,
      compactedVertexRowsBufferRetained: true,
      compactedVertexRowsBufferByteLength: 18 * 16 * Float32Array.BYTES_PER_ELEMENT,
      sourceVertexRowCount: 18,
      surfaceDrawGpuOnlyHandoff: true,
      surfaceDrawGpuOnlyHandoffStatus: 'surface-draw-gpu-resident-draw-range-available',
      surfaceDrawGpuOnlyUpperBoundVertexCount: 18,
      surfaceDrawGpuOnlyUpperBoundTriangleCount: 6
    }
  });
  const blockedRenderer = resolveResidentSurfaceVisibleGpuConsumer({
    handoff,
    rendererCapability: {
      status: 'same-device-gpu-buffer-geometry-blocked-webgl-renderer',
      reason: 'same-device GPUBuffer geometry requires Three WebGPU renderer',
      rendererBackend: 'three-webgl',
      visibleNoReadbackSupported: false
    },
    renderBridgeMode: 'extension-resident-surface-buffers-no-overlay',
    renderBridgeStatus: 'extension-surface-buffers-retained-no-overlay'
  });

  assert.equal(blockedRenderer.ready, false);
  assert.equal(
    blockedRenderer.status,
    'resident-surface-visible-gpu-consumer-blocked-renderer-capability'
  );
  assert.equal(blockedRenderer.inputReady, true);
  assert.equal(blockedRenderer.inputKind, 'surface-draw-buffers');
  assert.equal(blockedRenderer.runtimeConsumerReady, false);
  assert.equal(blockedRenderer.pixelValidationStatus, 'not-run');

  const pixelBlocked = resolveResidentSurfaceVisibleGpuConsumer({
    handoff,
    rendererCapability: {
      status: 'same-device-gpu-buffer-geometry-supported',
      reason: null,
      rendererBackend: 'three-webgpu',
      visibleNoReadbackSupported: true
    },
    renderBridgeMode: 'three-webgpu-surface-buffers',
    renderBridgeStatus: 'three-webgpu-surface-buffers-ready',
    pixelValidationStatus: 'not-run'
  });
  assert.equal(pixelBlocked.ready, false);
  assert.equal(
    pixelBlocked.status,
    'resident-surface-visible-gpu-consumer-blocked-pixel-validation'
  );
  assert.equal(pixelBlocked.runtimeConsumerReady, true);
  assert.equal(pixelBlocked.renderBridgeBound, true);

  const nativeAdmissionBlocked = resolveResidentSurfaceVisibleGpuConsumer({
    handoff,
    rendererCapability: {
      status: 'native-webgpu-surface-consumer-supported',
      reason: null,
      rendererBackend: 'native-webgpu',
      visibleNoReadbackSupported: true,
      nativeSurfaceConsumerSupported: true
    },
    renderBridgeMode: 'native-webgpu-surface-consumer',
    renderBridgeStatus: 'native-webgpu-surface-consumer-ready',
    pixelValidationStatus: 'not-run'
  });
  assert.equal(nativeAdmissionBlocked.ready, false);
  assert.equal(
    nativeAdmissionBlocked.status,
    'resident-surface-visible-gpu-consumer-blocked-presentation-admission'
  );
  assert.equal(nativeAdmissionBlocked.runtimeConsumerReady, true);
  assert.equal(nativeAdmissionBlocked.renderBridgeBound, true);
  assert.equal(nativeAdmissionBlocked.sameDeviceMainThreadImportSelected, true);
  assert.equal(
    nativeAdmissionBlocked.sameDeviceMainThreadImportRoute,
    'native-webgpu-surface-consumer'
  );
  assert.equal(nativeAdmissionBlocked.sameDeviceMainThreadImportThread, 'main-thread');
  assert.equal(
    nativeAdmissionBlocked.sameDeviceMainThreadImportDeviceScope,
    'engine-owned-native-webgpu-canvas-device'
  );
  assert.equal(
    nativeAdmissionBlocked.sameDeviceMainThreadImportStatus,
    'same-device-main-thread-import-awaiting-presentation-admission'
  );

  const nativeBrowserFrameValidationRequired = resolveResidentSurfaceVisibleGpuConsumer({
    handoff,
    rendererCapability: {
      status: 'native-webgpu-surface-consumer-supported',
      reason: null,
      rendererBackend: 'native-webgpu',
      visibleNoReadbackSupported: true,
      nativeSurfaceConsumerSupported: true,
      nativeSurfaceConsumerPixelValidationReason:
        'native WebGPU runtime pixel readback is disabled; browser harness composited-frame analysis owns visible-output validation'
    },
    renderBridgeMode: 'native-webgpu-surface-consumer',
    renderBridgeStatus: 'native-webgpu-surface-consumer-ready',
    pixelValidationStatus: 'not-run'
  });
  assert.equal(nativeBrowserFrameValidationRequired.ready, false);
  assert.equal(
    nativeBrowserFrameValidationRequired.status,
    'resident-surface-visible-gpu-consumer-blocked-presentation-admission'
  );
  assert.equal(
    nativeBrowserFrameValidationRequired.nativeSurfaceConsumerValidationBlockerFamily,
    'browser-frame-validation-required'
  );
  assert.equal(nativeBrowserFrameValidationRequired.nativeSurfaceConsumerTextureReadbackUnavailable, false);

  const nativeBrowserFrameCaptureUnsupported = resolveResidentSurfaceVisibleGpuConsumer({
    handoff,
    rendererCapability: {
      status: 'native-webgpu-surface-consumer-supported',
      reason: null,
      rendererBackend: 'native-webgpu',
      visibleNoReadbackSupported: true,
      nativeSurfaceConsumerSupported: true,
      nativeSurfaceConsumerDeviceMapSmokeStatus: 'passed',
      nativeSurfaceConsumerRenderedFrameCount: 1,
      nativeSurfaceConsumerPixelValidationReason:
        'browser-frame playwright-canvas-center-crop returned transparent black for a rendered native WebGPU canvas'
    },
    renderBridgeMode: 'native-webgpu-surface-consumer',
    renderBridgeStatus: 'native-webgpu-surface-consumer-ready',
    pixelValidationStatus: 'unsupported'
  });
  assert.equal(nativeBrowserFrameCaptureUnsupported.ready, false);
  assert.equal(
    nativeBrowserFrameCaptureUnsupported.status,
    'resident-surface-visible-gpu-consumer-blocked-presentation-admission'
  );
  assert.equal(
    nativeBrowserFrameCaptureUnsupported.nativeSurfaceConsumerValidationBlockerFamily,
    'browser-frame-validation-capture-unsupported'
  );
  assert.equal(
    nativeBrowserFrameCaptureUnsupported.sameDeviceMainThreadImportStatus,
    'same-device-main-thread-import-awaiting-presentation-admission'
  );

  const nativePendingValidationWithFrame = resolveResidentSurfaceVisibleGpuConsumer({
    handoff,
    rendererCapability: {
      status: 'native-webgpu-surface-consumer-supported',
      reason: null,
      rendererBackend: 'native-webgpu',
      visibleNoReadbackSupported: true,
      nativeSurfaceConsumerSupported: true,
      nativeSurfaceConsumerDeviceMapSmokeStatus: 'passed',
      nativeSurfaceConsumerReadbackSmokeValidationStatus: 'pending',
      nativeSurfaceConsumerOffscreenValidationStatus: 'pending',
      nativeSurfaceConsumerRenderedFrameCount: 1
    },
    renderBridgeMode: 'native-webgpu-surface-consumer',
    renderBridgeStatus: 'native-webgpu-surface-consumer-ready',
    pixelValidationStatus: 'not-run'
  });
  assert.equal(nativePendingValidationWithFrame.ready, false);
  assert.equal(
    nativePendingValidationWithFrame.status,
    'resident-surface-visible-gpu-consumer-blocked-presentation-admission'
  );
  assert.equal(nativePendingValidationWithFrame.nativeValidationPendingWithRenderedFrame, true);
  assert.equal(nativePendingValidationWithFrame.consumerValidated, false);
  assert.equal(
    nativePendingValidationWithFrame.nativeSurfaceConsumerValidationBlockerFamily,
    'native-surface-validation-pending'
  );

  const nativeReadbackPassedFallback = resolveResidentSurfaceVisibleGpuConsumer({
    handoff,
    rendererCapability: {
      status: 'native-webgpu-surface-consumer-supported',
      reason: null,
      rendererBackend: 'native-webgpu',
      visibleNoReadbackSupported: true,
      nativeSurfaceConsumerSupported: true,
      nativeSurfaceConsumerDeviceMapSmokeStatus: 'passed',
      nativeSurfaceConsumerReadbackSmokeValidationStatus: 'passed'
    },
    renderBridgeMode: 'native-webgpu-surface-consumer',
    renderBridgeStatus: 'native-webgpu-surface-consumer-ready',
    pixelValidationStatus: 'not-run'
  });
  assert.equal(nativeReadbackPassedFallback.ready, false);
  assert.equal(
    nativeReadbackPassedFallback.status,
    'resident-surface-visible-gpu-consumer-blocked-presentation-admission'
  );
  assert.equal(nativeReadbackPassedFallback.pixelValidationRequired, true);
  assert.equal(
    nativeReadbackPassedFallback.pixelValidationRequiredForForegroundProof,
    true
  );
  assert.equal(nativeReadbackPassedFallback.nativeReadbackFallbackValidated, false);

  const nativeReadbackUnavailableBlocked = resolveResidentSurfaceVisibleGpuConsumer({
    handoff,
    rendererCapability: {
      status: 'native-webgpu-surface-consumer-supported',
      reason: null,
      rendererBackend: 'native-webgpu',
      visibleNoReadbackSupported: true,
      nativeSurfaceConsumerSupported: true,
      nativeSurfaceConsumerDeviceMapSmokeStatus: 'passed',
      nativeSurfaceConsumerReadbackSmokeValidationStatus: 'error',
      nativeSurfaceConsumerReadbackSmokeValidationReason:
        "Failed to execute 'mapAsync' on 'GPUBuffer': A valid external Instance reference no longer exists."
    },
    renderBridgeMode: 'native-webgpu-surface-consumer',
    renderBridgeStatus: 'native-webgpu-surface-consumer-ready',
    pixelValidationStatus: 'not-run'
  });
  assert.equal(nativeReadbackUnavailableBlocked.ready, false);
  assert.equal(
    nativeReadbackUnavailableBlocked.status,
    'resident-surface-visible-gpu-consumer-blocked-presentation-admission'
  );
  assert.equal(nativeReadbackUnavailableBlocked.pixelValidationRequired, true);
  assert.equal(nativeReadbackUnavailableBlocked.nativeReadbackFallbackValidated, false);
  assert.equal(nativeReadbackUnavailableBlocked.nativeSurfaceConsumerTextureReadbackUnavailable, true);
  assert.equal(
    nativeReadbackUnavailableBlocked.nativeSurfaceConsumerValidationBlockerFamily,
    'native-surface-validation-readback-lifetime'
  );

  const nativeDeviceTextureReadbackUnavailableBlocked = resolveResidentSurfaceVisibleGpuConsumer({
    handoff,
    rendererCapability: {
      status: 'native-webgpu-surface-consumer-supported',
      reason: null,
      rendererBackend: 'native-webgpu',
      visibleNoReadbackSupported: true,
      nativeSurfaceConsumerSupported: true,
      nativeSurfaceConsumerDeviceMapSmokeStatus: 'passed',
      nativeSurfaceConsumerDeviceTextureReadbackSmokeStatus: 'not-run',
      nativeSurfaceConsumerDeviceTextureReadbackSmokeReason:
        'texture readback unavailable: resident WebGPU device texture readback smoke timed out'
    },
    renderBridgeMode: 'native-webgpu-surface-consumer',
    renderBridgeStatus: 'native-webgpu-surface-consumer-ready',
    pixelValidationStatus: 'not-run'
  });
  assert.equal(nativeDeviceTextureReadbackUnavailableBlocked.ready, false);
  assert.equal(
    nativeDeviceTextureReadbackUnavailableBlocked.status,
    'resident-surface-visible-gpu-consumer-blocked-presentation-admission'
  );
  assert.equal(
    nativeDeviceTextureReadbackUnavailableBlocked.nativeSurfaceConsumerDeviceTextureReadbackSmokeStatus,
    'not-run'
  );
  assert.equal(nativeDeviceTextureReadbackUnavailableBlocked.nativeSurfaceConsumerTextureReadbackUnavailable, true);
  assert.equal(
    nativeDeviceTextureReadbackUnavailableBlocked.nativeSurfaceConsumerValidationBlockerFamily,
    'resident-device-texture-readback-unavailable'
  );

  const nativePixelReadbackUnavailableBlocked = resolveResidentSurfaceVisibleGpuConsumer({
    handoff,
    rendererCapability: {
      status: 'native-webgpu-surface-consumer-supported',
      reason: null,
      rendererBackend: 'native-webgpu',
      visibleNoReadbackSupported: true,
      nativeSurfaceConsumerSupported: true,
      nativeSurfaceConsumerDeviceMapSmokeStatus: 'passed',
      nativeSurfaceConsumerPixelValidationReason:
        "Failed to execute 'mapAsync' on 'GPUBuffer': A valid external Instance reference no longer exists."
    },
    renderBridgeMode: 'native-webgpu-surface-consumer',
    renderBridgeStatus: 'native-webgpu-surface-consumer-ready',
    pixelValidationStatus: 'not-run'
  });
  assert.equal(nativePixelReadbackUnavailableBlocked.ready, false);
  assert.equal(
    nativePixelReadbackUnavailableBlocked.status,
    'resident-surface-visible-gpu-consumer-blocked-presentation-admission'
  );
  assert.equal(nativePixelReadbackUnavailableBlocked.pixelValidationRequired, true);
  assert.equal(nativePixelReadbackUnavailableBlocked.nativeReadbackFallbackValidated, false);
  assert.equal(nativePixelReadbackUnavailableBlocked.nativeSurfaceConsumerTextureReadbackUnavailable, true);
  assert.equal(
    nativePixelReadbackUnavailableBlocked.nativeSurfaceConsumerValidationBlockerFamily,
    'browser-pixel-validation-readback-lifetime'
  );

  const validated = resolveResidentSurfaceVisibleGpuConsumer({
    handoff,
    rendererCapability: {
      status: 'same-device-gpu-buffer-geometry-supported',
      reason: null,
      rendererBackend: 'three-webgpu',
      visibleNoReadbackSupported: true
    },
    renderBridgeMode: 'three-webgpu-surface-buffers',
    renderBridgeStatus: 'three-webgpu-surface-buffers-ready',
    pixelValidationStatus: 'passed'
  });
  assert.equal(validated.ready, true);
  assert.equal(validated.status, 'resident-surface-visible-gpu-consumer-ready');
  assert.equal(validated.pixelValidated, true);
  assert.equal(validated.sameDeviceMainThreadImportSelected, false);
  assert.equal(validated.sameDeviceMainThreadImportRoute, null);
  assert.equal(validated.sameDeviceMainThreadImportStatus, null);

  const nativeValidated = resolveResidentSurfaceVisibleGpuConsumer({
    handoff,
    rendererCapability: {
      status: 'native-webgpu-surface-consumer-supported',
      reason: null,
      rendererBackend: 'native-webgpu',
      visibleNoReadbackSupported: true,
      nativeSurfaceConsumerSupported: true
    },
    renderBridgeMode: 'native-webgpu-surface-consumer',
    renderBridgeStatus: 'native-webgpu-surface-consumer-ready',
    pixelValidationStatus: 'passed'
  });
  assert.equal(nativeValidated.ready, false);
  assert.equal(
    nativeValidated.status,
    'resident-surface-visible-gpu-consumer-blocked-presentation-admission'
  );
  assert.equal(nativeValidated.pixelValidated, true);
  assert.equal(nativeValidated.sameDeviceMainThreadImportSelected, true);
  assert.equal(
    nativeValidated.sameDeviceMainThreadImportStatus,
    'same-device-main-thread-import-awaiting-presentation-admission'
  );

  const nativeSameQueueStructurallyAdmitted = resolveResidentSurfaceVisibleGpuConsumer({
    handoff,
    rendererCapability: {
      status: 'native-webgpu-surface-consumer-supported',
      reason: null,
      rendererBackend: 'native-webgpu',
      visibleNoReadbackSupported: true,
      nativeSurfaceConsumerSupported: true,
      nativeSurfaceConsumerActiveResourceGeneration: 7,
      nativeSurfaceConsumerCandidateForegroundValidationStatus: 'passed',
      nativeSurfaceConsumerCandidateForegroundProofKind:
        'same-queue-private-staged-composite-submission',
      nativeSurfaceConsumerCandidateForegroundGpuFenceSatisfied: false,
      nativeSurfaceConsumerCandidateForegroundSameQueueSubmissionBoundary: true,
      nativeSurfaceConsumerCandidateForegroundSubmittedDrawCount: 4,
      nativeSurfaceConsumerCandidateForegroundResourceGeneration: 7
    },
    renderBridgeMode: 'native-webgpu-surface-consumer',
    renderBridgeStatus: 'native-webgpu-surface-consumer-ready',
    pixelValidationStatus: 'not-run'
  });
  assert.equal(nativeSameQueueStructurallyAdmitted.ready, true);
  assert.equal(
    nativeSameQueueStructurallyAdmitted.status,
    'resident-surface-visible-gpu-consumer-ready'
  );
  assert.equal(
    nativeSameQueueStructurallyAdmitted.sameQueueForegroundSubmissionValidated,
    false
  );
  assert.equal(
    nativeSameQueueStructurallyAdmitted.sameQueueStructuralSubmissionAdmitted,
    true
  );
  assert.equal(nativeSameQueueStructurallyAdmitted.runtimePresentationAdmitted, true);
  assert.equal(nativeSameQueueStructurallyAdmitted.foregroundProofValidated, false);
  assert.equal(nativeSameQueueStructurallyAdmitted.pixelValidationRequired, true);
  assert.equal(
    nativeSameQueueStructurallyAdmitted.pixelValidationRequiredForForegroundProof,
    true
  );
  assert.equal(nativeSameQueueStructurallyAdmitted.offscreenForegroundValidated, false);
  assert.equal(nativeSameQueueStructurallyAdmitted.nativeReadbackFallbackValidated, false);
  assert.equal(
    nativeSameQueueStructurallyAdmitted.sameDeviceMainThreadImportStatus,
    'same-device-main-thread-import-ready'
  );

  for (const rendererCapability of [
    {
      nativeSurfaceConsumerCandidateForegroundSameQueueSubmissionBoundary:
        false
    },
    {
      nativeSurfaceConsumerCandidateForegroundSubmittedDrawCount: 0
    },
    {
      nativeSurfaceConsumerCandidateForegroundResourceGeneration: 6
    },
    {
      nativeSurfaceConsumerCandidateForegroundValidationStatus: 'failed'
    },
    {
      nativeSurfaceConsumerCandidateForegroundSubmittedDrawCount: '4'
    },
    {
      nativeSurfaceConsumerCandidateForegroundResourceGeneration: '7'
    },
    {
      nativeSurfaceConsumerActiveResourceGeneration: '7'
    }
  ]) {
    const blockedSameQueueAdmission = resolveResidentSurfaceVisibleGpuConsumer({
      handoff,
      rendererCapability: {
        status: 'native-webgpu-surface-consumer-supported',
        rendererBackend: 'native-webgpu',
        visibleNoReadbackSupported: true,
        nativeSurfaceConsumerSupported: true,
        nativeSurfaceConsumerActiveResourceGeneration: 7,
        nativeSurfaceConsumerCandidateForegroundValidationStatus: 'passed',
        nativeSurfaceConsumerCandidateForegroundProofKind:
          'same-queue-private-staged-composite-submission',
        nativeSurfaceConsumerCandidateForegroundGpuFenceSatisfied: false,
        nativeSurfaceConsumerCandidateForegroundSameQueueSubmissionBoundary:
          true,
        nativeSurfaceConsumerCandidateForegroundSubmittedDrawCount: 4,
        nativeSurfaceConsumerCandidateForegroundResourceGeneration: 7,
        ...rendererCapability
      },
      renderBridgeMode: 'native-webgpu-surface-consumer',
      renderBridgeStatus: 'native-webgpu-surface-consumer-ready',
      pixelValidationStatus: 'not-run'
    });
    assert.equal(blockedSameQueueAdmission.ready, false);
    assert.equal(
      blockedSameQueueAdmission.status,
      'resident-surface-visible-gpu-consumer-blocked-presentation-admission'
    );
    assert.equal(
      blockedSameQueueAdmission.sameQueueForegroundSubmissionValidated,
      false
    );
    assert.equal(blockedSameQueueAdmission.foregroundProofValidated, false);
    assert.equal(blockedSameQueueAdmission.offscreenForegroundValidated, false);
  }

  const nativeReadbackForegroundValidated = resolveResidentSurfaceVisibleGpuConsumer({
    handoff,
    rendererCapability: {
      status: 'native-webgpu-surface-consumer-supported',
      reason: null,
      rendererBackend: 'native-webgpu',
      visibleNoReadbackSupported: true,
      nativeSurfaceConsumerSupported: true,
      nativeSurfaceConsumerActiveResourceGeneration: 7,
      nativeSurfaceConsumerOffscreenValidationStatus: 'passed',
      nativeSurfaceConsumerOffscreenValidationNonzeroPixelCount: 96,
      nativeSurfaceConsumerOffscreenValidationResourceGeneration: 7
    },
    renderBridgeMode: 'native-webgpu-surface-consumer',
    renderBridgeStatus: 'native-webgpu-surface-consumer-ready',
    pixelValidationStatus: 'not-run'
  });
  assert.equal(nativeReadbackForegroundValidated.ready, true);
  assert.equal(
    nativeReadbackForegroundValidated.status,
    'resident-surface-visible-gpu-consumer-ready'
  );
  assert.equal(
    nativeReadbackForegroundValidated.sameQueueForegroundSubmissionValidated,
    false
  );
  assert.equal(nativeReadbackForegroundValidated.foregroundProofValidated, true);
  assert.equal(nativeReadbackForegroundValidated.offscreenForegroundValidated, true);
  assert.equal(nativeReadbackForegroundValidated.nativeReadbackFallbackValidated, true);
  assert.equal(
    nativeReadbackForegroundValidated.sameDeviceMainThreadImportStatus,
    'same-device-main-thread-import-ready'
  );

  for (const rendererCapability of [
    {
      nativeSurfaceConsumerActiveResourceGeneration: 7,
      nativeSurfaceConsumerOffscreenValidationStatus: 'passed',
      nativeSurfaceConsumerOffscreenValidationNonzeroPixelCount: 0,
      nativeSurfaceConsumerOffscreenValidationResourceGeneration: 7
    },
    {
      nativeSurfaceConsumerActiveResourceGeneration: 7,
      nativeSurfaceConsumerOffscreenValidationStatus: 'passed',
      nativeSurfaceConsumerOffscreenValidationNonzeroPixelCount: 96,
      nativeSurfaceConsumerOffscreenValidationResourceGeneration: 6
    }
  ]) {
    const blockedForeground = resolveResidentSurfaceVisibleGpuConsumer({
      handoff,
      rendererCapability: {
        status: 'native-webgpu-surface-consumer-supported',
        rendererBackend: 'native-webgpu',
        visibleNoReadbackSupported: true,
        nativeSurfaceConsumerSupported: true,
        ...rendererCapability
      },
      renderBridgeMode: 'native-webgpu-surface-consumer',
      renderBridgeStatus: 'native-webgpu-surface-consumer-ready',
      pixelValidationStatus: 'not-run'
    });
    assert.equal(blockedForeground.ready, false);
    assert.equal(blockedForeground.offscreenForegroundValidated, false);
  }

  const renderFieldBlocked = resolveResidentSurfaceVisibleGpuConsumer({
    handoff: resolveResidentSurfaceBufferHandoff({
      readbackMode: 'no-full-readback',
      surfaceDraw: {
        sourceRenderFieldSchema: 'peercompute.ulg.sph-gpu-render-field.v1',
        surfaceDrawReadback: false,
        surfaceDrawSummaryReadback: false,
        fullSurfaceDrawReadback: false,
        renderFieldRowsBufferRetained: true,
        renderFieldRowsBufferByteLength: 4096,
        renderFieldSurfaceBufferRetained: true,
        renderFieldSurfaceBufferByteLength: 256
      }
    }),
    rendererCapability: {
      status: 'same-device-gpu-buffer-geometry-supported',
      reason: null,
      rendererBackend: 'three-webgpu',
      visibleNoReadbackSupported: true
    }
  });
  assert.equal(
    renderFieldBlocked.status,
    'resident-surface-visible-gpu-consumer-blocked-surface-extraction-required'
  );
});

test('SPH native WebGPU surface validation cadence is opt-in and stops after completion', () => {
  const initial = resolveSphNativeWebGpuSurfaceValidationCadence({
    bridge: {
      rendererBridge: 'native-webgpu-surface-consumer',
      format: 'bgra8unorm',
      offscreenValidationTargetResourceGeneration: 1
    },
    submittedDrawCount: 4,
    bridgeFormat: 'bgra8unorm',
    readbackSmokeValidationStatus: 'not-run',
    readbackSmokeValidationAttemptCount: 0,
    offscreenValidationStatus: 'not-run',
    offscreenValidationAttemptCount: 0
  });
  assert.equal(initial.validationEncoderRequired, false);
  assert.equal(initial.sameDeviceReadbackValidationEnabled, false);
  assert.equal(initial.readbackSmokeValidationNeeded, false);
  assert.equal(initial.offscreenValidationNeeded, false);
  assert.equal(initial.validationScope, 'native-surface-draw');
  assert.equal(
    initial.status,
    'native-webgpu-surface-validation-browser-frame-required'
  );

  const browserFrameValidation = resolveSphNativeWebGpuSurfaceValidationCadence({
    bridge: {
      rendererBridge: 'native-webgpu-surface-consumer',
      format: 'bgra8unorm',
      enableRuntimePixelReadback: false,
      readbackSmokeValidationStatus: 'not-run',
      offscreenValidationStatus: 'not-run',
      offscreenValidationTargetResourceGeneration: 2
    },
    submittedDrawCount: 4
  });
  assert.equal(browserFrameValidation.validationEncoderRequired, false);
  assert.equal(browserFrameValidation.sameDeviceReadbackValidationEnabled, false);
  assert.equal(browserFrameValidation.readbackSmokeValidationNeeded, false);
  assert.equal(browserFrameValidation.offscreenValidationNeeded, false);
  assert.equal(
    browserFrameValidation.status,
    'native-webgpu-surface-validation-browser-frame-required'
  );
  assert.match(
    browserFrameValidation.reason,
    /current-texture readback is disabled/
  );

  const runtimeReadbackOptIn = resolveSphNativeWebGpuSurfaceValidationCadence({
    bridge: {
      rendererBridge: 'native-webgpu-surface-consumer',
      format: 'bgra8unorm',
      enableRuntimePixelReadback: true,
      offscreenValidationTargetResourceGeneration: 2
    },
    submittedDrawCount: 4,
    readbackSmokeValidationStatus: 'not-run',
    offscreenValidationStatus: 'not-run'
  });
  assert.equal(runtimeReadbackOptIn.validationEncoderRequired, true);
  assert.equal(runtimeReadbackOptIn.sameDeviceReadbackValidationEnabled, true);
  assert.equal(runtimeReadbackOptIn.readbackSmokeValidationNeeded, true);
  assert.equal(runtimeReadbackOptIn.offscreenValidationNeeded, true);
  assert.equal(runtimeReadbackOptIn.offscreenValidationEligible, true);
  assert.equal(runtimeReadbackOptIn.status, 'native-webgpu-surface-validation-needed');

  const debugClearOnly = resolveSphNativeWebGpuSurfaceValidationCadence({
    bridge: {
      rendererBridge: 'native-webgpu-surface-consumer',
      format: 'bgra8unorm',
      enableRuntimePixelReadback: true
    },
    submittedDrawCount: 0,
    debugClearOnly: true,
    readbackSmokeValidationStatus: 'not-run',
    readbackSmokeValidationAttemptCount: 0,
    offscreenValidationStatus: 'not-run',
    offscreenValidationAttemptCount: 0
  });
  assert.equal(debugClearOnly.validationEncoderRequired, true);
  assert.equal(debugClearOnly.readbackSmokeValidationNeeded, true);
  assert.equal(debugClearOnly.offscreenValidationNeeded, false);
  assert.equal(debugClearOnly.offscreenValidationEligible, false);
  assert.equal(debugClearOnly.debugClearOnly, true);
  assert.equal(debugClearOnly.validationScope, 'native-current-texture-debug-clear');
  assert.match(
    debugClearOnly.offscreenValidationSkippedReason,
    /debug clear-only validates the current texture/
  );
  assert.equal(debugClearOnly.status, 'native-webgpu-surface-validation-needed');

  const debugClearOnlyReadbackPassed = resolveSphNativeWebGpuSurfaceValidationCadence({
    bridge: {
      rendererBridge: 'native-webgpu-surface-consumer',
      format: 'bgra8unorm',
      enableRuntimePixelReadback: true
    },
    submittedDrawCount: 0,
    debugClearOnly: true,
    readbackSmokeValidationStatus: 'passed',
    readbackSmokeValidationFormat: 'rgba8unorm',
    offscreenValidationStatus: 'not-run',
    offscreenValidationAttemptCount: 0
  });
  assert.equal(debugClearOnlyReadbackPassed.validationEncoderRequired, false);
  assert.equal(debugClearOnlyReadbackPassed.readbackSmokeValidationNeeded, false);
  assert.equal(debugClearOnlyReadbackPassed.offscreenValidationNeeded, false);
  assert.equal(debugClearOnlyReadbackPassed.offscreenValidationEligible, false);
  assert.equal(debugClearOnlyReadbackPassed.validationScope, 'native-current-texture-debug-clear');
  assert.equal(
    debugClearOnlyReadbackPassed.status,
    'native-webgpu-surface-validation-debug-clear-only'
  );

  const noSurfaceDraws = resolveSphNativeWebGpuSurfaceValidationCadence({
    bridge: {
      rendererBridge: 'native-webgpu-surface-consumer',
      format: 'bgra8unorm',
      enableRuntimePixelReadback: true
    },
    submittedDrawCount: 0,
    readbackSmokeValidationStatus: 'passed',
    readbackSmokeValidationFormat: 'rgba8unorm',
    offscreenValidationStatus: 'not-run',
    offscreenValidationAttemptCount: 0
  });
  assert.equal(noSurfaceDraws.validationEncoderRequired, false);
  assert.equal(noSurfaceDraws.offscreenValidationNeeded, false);
  assert.equal(noSurfaceDraws.offscreenValidationEligible, false);
  assert.equal(noSurfaceDraws.validationScope, 'native-no-submitted-draws');
  assert.equal(noSurfaceDraws.status, 'native-webgpu-surface-validation-no-surface-draws');

  const passed = resolveSphNativeWebGpuSurfaceValidationCadence({
    bridge: {
      rendererBridge: 'native-webgpu-surface-consumer',
      format: 'bgra8unorm',
      enableRuntimePixelReadback: true,
      offscreenValidationTargetResourceGeneration: 3,
      offscreenValidationResourceGeneration: 3,
      offscreenValidationAttemptResourceGeneration: 3
    },
    submittedDrawCount: 4,
    bridgeFormat: 'bgra8unorm',
    readbackSmokeValidationStatus: 'passed',
    readbackSmokeValidationFormat: 'rgba8unorm',
    offscreenValidationStatus: 'passed',
    offscreenValidationTextureFormat: 'bgra8unorm'
  });
  assert.equal(passed.validationEncoderRequired, false);
  assert.equal(passed.readbackSmokeValidationNeeded, false);
  assert.equal(passed.offscreenValidationNeeded, false);
  assert.equal(passed.status, 'native-webgpu-surface-validation-passed');

  const stalePassed = resolveSphNativeWebGpuSurfaceValidationCadence({
    bridge: {
      rendererBridge: 'native-webgpu-surface-consumer',
      format: 'bgra8unorm',
      enableRuntimePixelReadback: true,
      offscreenValidationTargetResourceGeneration: 4,
      offscreenValidationResourceGeneration: 3,
      offscreenValidationAttemptResourceGeneration: 3,
      offscreenValidationStatus: 'passed',
      offscreenValidationTextureFormat: 'bgra8unorm',
      offscreenValidationAttemptCount: 3
    },
    submittedDrawCount: 4
  });
  assert.equal(stalePassed.validationEncoderRequired, true);
  assert.equal(stalePassed.offscreenValidationNeeded, true);
  assert.equal(stalePassed.offscreenValidationAttemptCount, 0);
  assert.equal(stalePassed.offscreenValidationPassedCurrentFormat, false);

  const exhausted = resolveSphNativeWebGpuSurfaceValidationCadence({
    bridge: {
      rendererBridge: 'native-webgpu-surface-consumer',
      format: 'bgra8unorm',
      enableRuntimePixelReadback: true,
      offscreenValidationTargetResourceGeneration: 5,
      offscreenValidationAttemptResourceGeneration: 5
    },
    submittedDrawCount: 4,
    bridgeFormat: 'bgra8unorm',
    readbackSmokeValidationStatus: 'not-run',
    readbackSmokeValidationAttemptCount: 3,
    offscreenValidationStatus: 'error',
    offscreenValidationAttemptCount: 3
  });
  assert.equal(exhausted.validationEncoderRequired, false);
  assert.equal(exhausted.readbackSmokeValidationNeeded, false);
  assert.equal(exhausted.offscreenValidationNeeded, false);
  assert.equal(exhausted.status, 'native-webgpu-surface-validation-attempts-exhausted');

  const pending = resolveSphNativeWebGpuSurfaceValidationCadence({
    bridge: {
      rendererBridge: 'native-webgpu-surface-consumer',
      format: 'bgra8unorm',
      enableRuntimePixelReadback: true,
      offscreenValidationTargetResourceGeneration: 6,
      offscreenValidationAttemptResourceGeneration: 6
    },
    submittedDrawCount: 4,
    bridgeFormat: 'bgra8unorm',
    readbackSmokeValidationStatus: 'pending',
    readbackSmokeValidationPending: true,
    offscreenValidationStatus: 'pending',
    offscreenValidationPending: true
  });
  assert.equal(pending.validationEncoderRequired, false);
  assert.equal(pending.status, 'native-webgpu-surface-validation-pending');
});

test('SPH renderer keeps closure-backed condensed refraction separate from vapor alpha coverage', () => {
  const closureRefraction = {
    ior: 1.333,
    status: 1,
    blocked: false
  };
  const opaqueMetal = {
    material: 'fe',
    phase: 'solid',
    opacity: 1,
    transmission: 0,
    metalness: 1
  };
  const condensedWater = {
    ...closureRefraction,
    material: 'h2o',
    phase: 'liquid',
    opacity: 0.0028,
    transmission: 0.977,
    metalness: 0
  };
  const vapor = {
    ...closureRefraction,
    material: 'h2o',
    phase: 'gas',
    opacity: 0.04,
    transmission: 0.9,
    metalness: 0
  };
  const transparentSolid = {
    material: 'sio2',
    phase: 'solid',
    opacity: 0.02,
    transmission: 0.95,
    metalness: 0
  };
  const blockedGlass = {
    material: 'sio2',
    phase: 'solid',
    opacity: 0.02,
    transmission: 0.95,
    metalness: 0,
    ior: 1.46,
    status: 255,
    blocked: true
  };
  const alphaSurface = {
    material: 'generic',
    phase: 'liquid',
    opacity: 0.5,
    transmission: 0,
    metalness: 0
  };

  assert.equal(renderDepthWriteFromOpticalResponse(opaqueMetal, opaqueMetal), true);
  assert.equal(renderAlphaFromOpticalResponse(opaqueMetal, opaqueMetal), 1);
  assert.equal(renderLayerFromOpticalResponse(opaqueMetal, opaqueMetal), 'opaque-surface');
  assert.equal(renderOrderFromOpticalResponse(opaqueMetal, opaqueMetal), SPH_PHASE_RENDER_ORDER.opaqueSurface);

  assert.equal(renderDepthWriteFromOpticalResponse(condensedWater, condensedWater), true);
  assert.equal(renderAlphaFromOpticalResponse(condensedWater, condensedWater), 1);
  assert.equal(hasAdmittedClosureRefraction(condensedWater, condensedWater), true);
  assert.equal(renderLayerFromOpticalResponse(condensedWater, condensedWater), 'refractive-surface');
  assert.equal(renderOrderFromOpticalResponse(condensedWater, condensedWater), SPH_PHASE_RENDER_ORDER.transmissiveSurface);

  assert.equal(renderDepthWriteFromOpticalResponse(vapor, vapor), false);
  assert.equal(renderAlphaFromOpticalResponse(vapor, vapor), 0.04);
  assert.equal(hasAdmittedClosureRefraction(vapor, vapor), false);
  assert.equal(renderLayerFromOpticalResponse(vapor, vapor), 'vapor-surface');
  assert.equal(renderOrderFromOpticalResponse(vapor, vapor), SPH_PHASE_RENDER_ORDER.vaporSurface);

  assert.equal(renderDepthWriteFromOpticalResponse(transparentSolid, transparentSolid), true);
  assert.equal(hasAdmittedClosureRefraction(transparentSolid, transparentSolid), false);
  assert.equal(renderLayerFromOpticalResponse(transparentSolid, transparentSolid), 'opaque-surface');
  assert.equal(renderOrderFromOpticalResponse(transparentSolid, transparentSolid), SPH_PHASE_RENDER_ORDER.opaqueSurface);

  assert.equal(hasAdmittedClosureRefraction(blockedGlass, blockedGlass), false);
  assert.equal(renderLayerFromOpticalResponse(blockedGlass, blockedGlass), 'opaque-surface');

  assert.equal(renderDepthWriteFromOpticalResponse(alphaSurface, alphaSurface), true);
  assert.equal(renderAlphaFromOpticalResponse(alphaSurface, alphaSurface), 1);
  assert.equal(renderLayerFromOpticalResponse(alphaSurface, alphaSurface), 'opaque-surface');
  assert.equal(renderOrderFromOpticalResponse(alphaSurface, alphaSurface), SPH_PHASE_RENDER_ORDER.opaqueSurface);
});

test('SPH resident pressure interface state owns retained force rows outside render cadence', () => {
  const materialInterfaceField = {
    schema: 'peercompute.ulg.sph-material-interface-field.v0',
    status: 'material-interface-field-ready',
    surfaceCount: 1,
    readySurfaceCount: 1,
    totalSurfaceAreaM2: 2,
    elementCount: 1,
    elements: [{
      status: 'interface-element-ready',
      surfaceIndex: 0,
      surfaceKey: 'h2o|h2o|liquid',
      material: 'h2o',
      phase: 'liquid',
      materialId: 1,
      phaseId: 2,
      axisId: 1,
      centroidM: [0.5, 0.5, 0.5],
      normalAreaVectorM2: [0, 2, 0],
      areaM2: 2
    }]
  };
  const gasPressureSummary = {
    schema: 'peercompute.ulg.sph-resident-gas-pressure-summary.v0',
    status: 'gpu-resident-gas-pressure-summary-ready',
    source: 'gpu-resident-product-mass',
    pressureFeedback: {
      schema: 'peercompute.ulg.sph-gas-pressure-feedback.v0',
      status: 'wall-pressure-ledger-ready',
      pressureGaugePa: 10,
      gasCellField: {
        schema: 'peercompute.ulg.sph-sealed-gas-pressure-cell-field.v0',
        status: 'gas-cell-pressure-field-ready',
        uniformPressurePa: 10
      }
    }
  };
  const forceRowsUpload = {
    status: 'webgpu-pressure-interface-force-rows-uploaded',
    bufferRetained: true,
    forceRowByteLength: 64,
    signature: 'solver-signature',
    pressureInterfaceGridForceAdmissionSchema: 'peercompute.ulg.pressure-interface-grid-force-consumption-admission.v0',
    pressureInterfaceGridForceAdmissionStatus: 'pressure-interface-grid-force-consumption-approved',
    pressureInterfaceGridForceAdmissionApproved: true,
    pressureInterfaceGridForceAdmissionDescriptorStatus: 'pressure-interface-worker-retained-hot-buffer-committed',
    pressureInterfaceGridForceAdmissionSourceHotBufferKey: 'ulg:test:pressure-interface-admitted-hot-buffer',
    pressureInterfaceForceRowsUploadQueueCompletionStatus: 'ordered-before-consumer-queue-completed',
    pressureInterfaceForceRowsUploadQueueCompletionMethod: 'queue.writeBuffer -> queue.onSubmittedWorkDone',
    pressureInterfaceForceRowsConsumerQueueCompletionStatus: 'queue-work-completed',
    pressureInterfaceForceRowsConsumerQueueCompletionMethod: 'queue.onSubmittedWorkDone',
    pressureInterfaceForceRowsUploadCleanupStatus: 'destroyed',
    pressureInterfaceForceRowsUploadDestroyStatus: 'destroyed',
    residentBufferLeaseLedgerStatus: 'active',
    residentBufferLeaseResourceCount: 1,
    residentBufferLeaseActiveLeaseCount: 1,
    residentBufferLeaseSummary: { status: 'active', activeLeaseCount: 1 }
  };

  const state = buildSphResidentPressureInterfaceStateSummary({
    materialInterfaceField,
    gasPressureSummary,
    pressureInterfaceForceRowsUpload: forceRowsUpload,
    source: 'resident-physics-loop-pressure-interface-refresh',
    sourceCadence: 'resident-step-completed'
  });

  assert.equal(state.schema, 'peercompute.ulg.sph-resident-pressure-interface-state.v0');
  assert.equal(state.status, 'resident-pressure-interface-force-rows-ready');
  assert.equal(state.pressureAuthority, 'resident-pressure-interface-state');
  assert.equal(state.source, 'resident-physics-loop-pressure-interface-refresh');
  assert.equal(state.sourceCadence, 'resident-step-completed');
  assert.equal(state.pressureInterfaceCouplingStatus, 'pressure-interface-coupling-ready-for-solver');
  assert.equal(state.pressureInterfaceForceSolverStatus, 'pressure-interface-force-solver-ready');
  assert.equal(state.pressureInterfaceSolverForceRowCount, 1);
  assert.equal(state.pressureInterfaceForceRowsBufferRetained, true);
  assert.equal(state.pressureInterfaceForceRowsBufferByteLength, 64);
  assert.equal(state.pressureInterfaceGridForceAdmissionSchema, 'peercompute.ulg.pressure-interface-grid-force-consumption-admission.v0');
  assert.equal(state.pressureInterfaceGridForceAdmissionStatus, 'pressure-interface-grid-force-consumption-approved');
  assert.equal(state.pressureInterfaceGridForceAdmissionApproved, true);
  assert.equal(state.pressureInterfaceGridForceAdmissionSourceHotBufferKey, 'ulg:test:pressure-interface-admitted-hot-buffer');
  assert.equal(state.pressureInterfaceForceRowsUploadQueueCompletionStatus, 'ordered-before-consumer-queue-completed');
  assert.equal(state.pressureInterfaceForceRowsUploadQueueCompletionMethod, 'queue.writeBuffer -> queue.onSubmittedWorkDone');
  assert.equal(state.pressureInterfaceForceRowsConsumerQueueCompletionStatus, 'queue-work-completed');
  assert.equal(state.pressureInterfaceForceRowsConsumerQueueCompletionMethod, 'queue.onSubmittedWorkDone');
  assert.equal(state.pressureInterfaceForceRowsUploadCleanupStatus, 'destroyed');
  assert.equal(state.pressureInterfaceForceRowsUploadDestroyStatus, 'destroyed');
  assert.equal(state.pressureInterfaceForceRowsLeaseStatus, 'active');
  assert.equal(state.pressureInterfaceForceRowsLeaseActiveCount, 1);
  assert.equal(state.gpuAuthoritativeState, true);
});

test('direct pressure admission selection never falls back to prior batch authority', () => {
  const priorAdmission = { status: 'prior-pressure-admission' };
  const directAdmission = { status: 'current-direct-pressure-admission' };
  assert.equal(selectPressureInterfaceGridForceAdmissionForExecutionMode({
    residentComputeManagerMode: 'direct',
    directAdmission,
    priorAdmission
  }), directAdmission);
  assert.equal(selectPressureInterfaceGridForceAdmissionForExecutionMode({
    residentComputeManagerMode: 'direct',
    directAdmission: null,
    priorAdmission
  }), null);
  assert.equal(selectPressureInterfaceGridForceAdmissionForExecutionMode({
    residentComputeManagerMode: 'compute-manager',
    directAdmission: null,
    priorAdmission
  }), priorAdmission);
});

test('SPH scene builds SS source-key replay diagnostics from production through pressure consumption', () => {
  const materialInterfaceField = {
    schema: 'peercompute.ulg.sph-material-interface-field.v0',
    status: 'material-interface-field-ready',
    readySurfaceCount: 1,
    totalSurfaceAreaM2: 1,
    interfaceSourceFieldSourceIndexStatus: 'interface-source-index-field-retained',
    interfaceSourceFieldSourceIndexBufferRetained: true,
    interfaceSourceKeySchema: 'peercompute.ulg.sph-interface-source-key.v0',
    interfaceSourceKeyStatus: 'interface-source-key-retained',
    interfaceSourceKeyRowCount: 2,
    interfaceSourceKeyReadyCount: 2,
    interfaceSourceKeyStrideFloats: 4,
    interfaceSourceKeyBufferRetained: true,
    interfaceSourceKeyBufferByteLength: 32,
    interfaceSourceKeySurfaceIndexFallbackEnabled: false
  };
  const pressureInterfaceForceSolver = {
    schema: 'peercompute.ulg.sph-pressure-interface-force-solver.v0',
    status: 'pressure-interface-force-solver-ready',
    forceApplicationStatus: 'solver-ready-not-applied',
    forceCouplingStatus: 'pressure-force-solver-ready-not-applied',
    forceRowCount: 2,
    forceRowStrideFloats: 16,
    conservationStatus: 'pairwise-equal-opposite-force-conservative',
    conservationResidualMagnitudeN: 0,
    interfaceSourceKeySchema: 'peercompute.ulg.sph-interface-source-key.v0',
    interfaceSourceKeyStatus: 'interface-source-key-ready',
    interfaceSourceKeyConsumerStatus: 'pressure-interface-source-key-buffer-consumed',
    interfaceSourceKeyRowCount: 2,
    interfaceSourceKeyReadyCount: 2,
    interfaceSourceKeyBufferObserved: true,
    interfaceSourceKeyBufferConsumed: true,
    interfaceSourceKeySurfaceIndexFallbackEnabled: false
  };
  const diagnostics = buildSchroederSourceKeyReplayDiagnostics({
    materialInterfaceField,
    pressureInterfaceForceSolver,
    pressureInterfaceWorkerCompactPublicationCandidate: {
      retainedSourceKeySourceReady: true,
      retainedSourceKeySourceStatus: 'pressure-interface-retained-source-key-source-ready',
      retainedSourceKeyBufferRefs: ['sph-interface-source-key-buffer']
    }
  });

  assert.equal(diagnostics.schema, ULG_SPH_SCENE_SCHROEDER_SOURCE_KEY_REPLAY_DIAGNOSTICS_SCHEMA);
  assert.equal(diagnostics.status, 'schroeder-source-key-replay-consumed');
  assert.equal(diagnostics.replayReady, true);
  assert.equal(diagnostics.productionRowCount, 2);
  assert.equal(diagnostics.retainedRefPublicationReady, true);
  assert.deepEqual(diagnostics.retainedBufferRefs, ['sph-interface-source-key-buffer']);
  assert.equal(diagnostics.pressureConsumerConsumed, true);
  assert.equal(diagnostics.productionConsumerRowCountMatch, true);
  assert.equal(diagnostics.rawGpuBufferSerialized, false);
  assert.equal(diagnostics.portablePayloadMode, 'descriptor-only-no-raw-gpubuffer');

  const state = buildSphResidentPressureInterfaceStateSummary({
    materialInterfaceField,
    pressureInterfaceForceSolver,
    pressureInterfaceForceRowsUpload: {
      status: 'webgpu-pressure-interface-force-rows-uploaded',
      bufferRetained: true,
      forceRowByteLength: 128,
      pressureInterfaceGridForceAdmissionApproved: true
    }
  });

  assert.equal(state.schroederSourceKeyReplayDiagnosticsSchema, ULG_SPH_SCENE_SCHROEDER_SOURCE_KEY_REPLAY_DIAGNOSTICS_SCHEMA);
  assert.equal(state.schroederSourceKeyReplayDiagnosticsStatus, 'schroeder-source-key-replay-consumed');
  assert.equal(state.schroederSourceKeyReplayReady, true);
  assert.equal(state.schroederSourceKeyReplayPressureConsumerConsumed, true);
  assert.equal(state.schroederSourceKeyReplayDiagnostics.rawGpuBufferSerialized, false);
});

function opaqueScenePressureTestDevice() {
  const buffers = [];
  const device = {
    lost: new Promise(() => {}),
    limits: {
      maxBufferSize: 512 * 1024 * 1024,
      maxStorageBufferBindingSize: 256 * 1024 * 1024,
      maxUniformBufferBindingSize: 64 * 1024,
      maxStorageBuffersPerShaderStage: 16,
      maxComputeWorkgroupsPerDimension: 65_535,
      minUniformBufferOffsetAlignment: 256
    },
    createBuffer(descriptor) {
      const buffer = {
        ...descriptor,
        _bytes: new Uint8Array(descriptor.size),
        destroyed: false,
        destroyCount: 0,
        async mapAsync() {},
        getMappedRange(offset = 0, size = this.size - offset) {
          return this._bytes.buffer.slice(offset, offset + size);
        },
        unmap() {},
        destroy() {
          this.destroyCount += 1;
          this.destroyed = true;
        }
      };
      buffers.push(buffer);
      return buffer;
    },
    createShaderModule(descriptor) {
      return descriptor;
    },
    createComputePipeline(descriptor) {
      return {
        ...descriptor,
        getBindGroupLayout(index) {
          return { index, label: descriptor.label || null };
        }
      };
    },
    createBindGroup(descriptor) {
      return descriptor;
    },
    createCommandEncoder() {
      return {
        clearBuffer(buffer, offset = 0, size = buffer.size - offset) {
          buffer._bytes.fill(0, offset, offset + size);
        },
        copyBufferToBuffer(source, sourceOffset, destination, destinationOffset, size) {
          destination._bytes.set(
            source._bytes.slice(sourceOffset, sourceOffset + size),
            destinationOffset
          );
        },
        beginComputePass() {
          return {
            setPipeline() {},
            setBindGroup() {},
            dispatchWorkgroups() {},
            dispatchWorkgroupsIndirect() {},
            end() {}
          };
        },
        finish() {
          return { label: 'opaque-scene-pressure-test-command-buffer' };
        }
      };
    }
  };
  device.queue = {
    writeBuffer(buffer, offset, data) {
      const bytes = ArrayBuffer.isView(data)
        ? new Uint8Array(data.buffer, data.byteOffset, data.byteLength)
        : new Uint8Array(data);
      buffer._bytes.set(bytes, offset);
    },
    submit() {},
    onSubmittedWorkDone() {
      return Promise.resolve();
    }
  };
  return { device, buffers };
}

async function opaqueScenePressureAuthorityFixture() {
  const { device } = opaqueScenePressureTestDevice();
  const particleCount = 2;
  const epochIdentity = Object.freeze({
    storageGeneration: 81,
    physicsTick: 82,
    physicsSubstep: 0,
    positionEpoch: 83,
    topologyEpoch: 84,
    chartEpoch: 85,
    levelEpoch: 86,
    supportEpoch: 87
  });
  const taggedBuffer = (label, size) => tagWebGpuBufferDevice(
    device.createBuffer({ label, size, usage: 128 | 4 | 8 }),
    device
  );
  const productEventBuffer = taggedBuffer(
    'opaque-scene-pressure-product-events',
    particleCount * 32 * Float32Array.BYTES_PER_ELEMENT
  );
  let activeBorrowCount = 0;
  const residentProductMass = {
    schema: 'peercompute.ulg.sph-resident-product-mass.v0',
    status: 'resident-product-mass-buffer-retained',
    productEventBuffer,
    productEventBufferRetained: true,
    productEventBufferByteLength: productEventBuffer.size,
    productEventRowCount: particleCount,
    productEventStrideFloats: 32,
    productEventDevice: device
  };
  Object.defineProperty(residentProductMass, '__ulgActiveBorrowCount', {
    configurable: false,
    enumerable: false,
    get() { return activeBorrowCount; },
    set(value) { activeBorrowCount = Math.max(0, Number(value) | 0); }
  });
  tagResidentProductMassDevice(residentProductMass, device);
  const assignmentBuffer = taggedBuffer(
    'opaque-scene-pressure-level-assignment',
    particleCount * SCHROEDER_LEVEL_ASSIGNMENT_ROW_LAYOUT.length
      * Float32Array.BYTES_PER_ELEMENT
  );
  const sourceStateBuffer = taggedBuffer(
    'opaque-scene-pressure-source-state',
    particleCount * 8 * Float32Array.BYTES_PER_ELEMENT
  );
  const sourceMechanicsBuffer = taggedBuffer(
    'opaque-scene-pressure-source-mechanics-v0j',
    particleCount * 32 * Float32Array.BYTES_PER_ELEMENT
  );
  const particleIdentityBuffer = taggedBuffer(
    'opaque-scene-pressure-source-identity',
    particleCount * Uint32Array.BYTES_PER_ELEMENT
  );
  const spatialGasGrid = Object.freeze({
    selectedLevel: 0,
    gridDims: Object.freeze([2, 2, 2]),
    gridNodeCount: 8,
    gridShift: 1,
    gridSpacingM: 1
  });
  const generation = runSchroederSpatialEpochGenerationWebGpu({
    device,
    levelAssignment: {
      schema: 'peercompute.ulg.schroeder-level-assignment-execution.v0',
      status: 'schroeder-level-assignment-submitted',
      bufferFamilyGenerationStatus:
        'schroeder-particle-buffer-family-generation-ready',
      particleCount,
      assignmentStrideFloats: SCHROEDER_LEVEL_ASSIGNMENT_ROW_LAYOUT.length,
      assignmentBuffer,
      assignmentBufferByteLength: assignmentBuffer.size,
      sourceStateBuffer,
      sourceStateBufferBorrowed: true,
      sourceMechanicsBuffer,
      sourceMechanicsBufferBorrowed: true,
      sourceMechanicsBufferByteLength: sourceMechanicsBuffer.size,
      ...epochIdentity,
      minLevel: 0,
      maxLevel: 0,
      chartId: 0,
      baseGridSpacingM: 1
    },
    particleCount,
    particleIdentityBuffer,
    particleIdentityStrideWords: 1,
    selectedLevel: 0,
    mechanicsGrid: spatialGasGrid,
    exactNearCellTreeEnabled: false
  });
  assert.equal(generation.ready, true, generation.reason);
  const execution = await runSphSpatialGasLedgerEosRetainedWebGpu({
    device,
    residentProductMass,
    epochIdentity,
    schroederSpatialEpochGeneration: generation,
    spatialGasGrid,
    boxMinM: [0, 0, 0],
    boxMaxM: [2, 2, 2],
    spatialGasCellSizeM: 1,
    spatialGasSupportVolumeFallbackM3: 0
  });
  assert.equal(execution.ready, true, execution.reason);
  let cleaned = false;
  return {
    device,
    epochIdentity,
    generation,
    execution,
    source: execution.retainedGasCellFieldSource,
    async cleanup() {
      if (cleaned) return;
      cleaned = true;
      if (execution.released !== true && execution.releaseScheduled !== true) {
        releaseSphSpatialGasLedgerEosAfterQueue(execution);
      }
      if (execution.releasePromise) await execution.releasePromise;
      if (generation.released !== true && generation.releaseScheduled !== true) {
        releaseSchroederSpatialEpochGenerationAfterQueue(generation, device);
      }
      if (generation.releasePromise) await generation.releasePromise;
    }
  };
}

test('SPH scene exact v4 readiness ignores legacy masks and hostile accessors while mount keeps identity local', async () => {
  const fixture = await opaqueScenePressureAuthorityFixture();
  try {
    const description = describeSphSpatialGasPressureAuthority(
      fixture.source,
      { device: fixture.device }
    );
    const admission = {
      schema: ULG_PRESSURE_INTERFACE_GAS_CELL_FIELD_ADMISSION_SCHEMA,
      status: 'pressure-interface-gas-cell-field-consumption-approved',
      gasCellFieldConsumptionApproved: true,
      retainedGasCellFieldSource: fixture.source
    };
    let hostileGetterCalls = 0;
    const importDescriptor = {
      schema: 'peercompute.ulg.sph-retained-gas-cell-eos-source.v1',
      status: 'retained-gas-cell-eos-source-submitted',
      stateKey: 'state:test-opaque-scene-gas',
      sourceTaskId: 'task:test-opaque-scene-gas:eos',
      deviceId: webGpuDeviceId(fixture.device),
      pressureInterfaceGasPressureCellRowCount: 999,
      pressureInterfaceGasPressureCellRowStrideFloats: 4,
      pressureInterfaceGasPressureCellRowsBufferRetained: false,
      retainedGasCellFieldSource: fixture.source,
      pressureInterfaceGasCellFieldAdmission: admission
    };
    admission.admission = importDescriptor;
    for (const key of [
      'releaseScheduled',
      'lifecycleStatus',
      'owner'
    ]) {
      Object.defineProperty(importDescriptor, key, {
        configurable: true,
        enumerable: true,
        get() {
          hostileGetterCalls += 1;
          throw new Error(`hostile exact wrapper getter: ${key}`);
        }
      });
    }
    const expected = {
      expectedDevice: fixture.device,
      expectedStateKey: importDescriptor.stateKey,
      expectedSourceTaskId: importDescriptor.sourceTaskId,
      expectedDeviceId: importDescriptor.deviceId,
      expectedSpatialGasLedgerGenerationId: description.spatialGenerationId,
      expectedEpochIdentity: fixture.epochIdentity
    };
    const inspection = inspectExactSphSpatialGasPressureAuthorityImport(
      importDescriptor,
      expected
    );
    assert.equal(inspection.exactAuthorityObserved, true);
    assert.equal(inspection.exactAuthorityReady, true);
    assert.equal(inspection.exactAuthoritySource, fixture.source);
    assert.equal(inspection.pressureInterfaceGasPressureCellRowCount, 0);
    assert.equal(
      inspection.pressureInterfaceGasPressureCellRowCapacity,
      description.pressureCellCapacity
    );
    assert.equal(
      pressureInterfaceGasCellFieldImportReadyForScene(
        importDescriptor,
        expected
      ),
      true
    );
    assert.equal(
      resolveMountedWorkerPressureInterfaceGasCellImportDescriptor({
        source: importDescriptor,
        device: fixture.device
      }),
      null
    );
    const mountedTelemetry = summarizeMountedPressureInterfaceGasCellImport({
      importDescriptor,
      device: fixture.device
    });
    assert.equal(mountedTelemetry.pressureInterfaceGasCellFieldImportAvailable, true);
    assert.equal(mountedTelemetry.pressureInterfaceGasPressureCellRowCount, 0);
    assert.equal(
      mountedTelemetry.pressureInterfaceGasPressureCellRowCapacity,
      description.pressureCellCapacity
    );
    assert.equal(
      mountedTelemetry.pressureInterfaceGasCellFieldImportRetainedGasPressureCellsBuffer,
      false
    );
    assert.equal(
      mountedTelemetry.mountedWorkerLanePressureInterfaceGasCellImportTransferStatus,
      'main-thread-exact-opaque-authority-kept-local-not-posted-to-worker-lane'
    );
    assert.equal(hostileGetterCalls, 0);

    const makeExactWrapper = ({
      source = fixture.source,
      admissionSource = source,
      extra = null
    } = {}) => {
      const wrapperAdmission = {
        schema: ULG_PRESSURE_INTERFACE_GAS_CELL_FIELD_ADMISSION_SCHEMA,
        status: 'pressure-interface-gas-cell-field-consumption-approved',
        gasCellFieldConsumptionApproved: true,
        retainedGasCellFieldSource: admissionSource
      };
      const wrapper = {
        schema: 'peercompute.ulg.sph-retained-gas-cell-eos-source.v1',
        status: 'retained-gas-cell-eos-source-submitted',
        stateKey: importDescriptor.stateKey,
        sourceTaskId: importDescriptor.sourceTaskId,
        deviceId: importDescriptor.deviceId,
        pressureInterfaceGasPressureCellRowCount: 999,
        pressureInterfaceGasPressureCellRowStrideFloats: 4,
        pressureInterfaceGasPressureCellRowsBufferRetained: false,
        retainedGasCellFieldSource: source,
        pressureInterfaceGasCellFieldAdmission: wrapperAdmission,
        ...(extra || {})
      };
      wrapperAdmission.admission = wrapper;
      return { wrapper, admission: wrapperAdmission };
    };

    for (const [aliasKey, aliasValue] of [
      ['gasPressureCellsBuffer', null],
      ['pressureInterfaceGasAuthorityControlBuffer', undefined]
    ]) {
      const aliasCase = makeExactWrapper();
      Object.defineProperty(aliasCase.wrapper, aliasKey, {
        configurable: true,
        enumerable: true,
        writable: true,
        value: aliasValue
      });
      const aliasInspection = inspectExactSphSpatialGasPressureAuthorityImport(
        aliasCase.wrapper,
        expected
      );
      assert.equal(aliasInspection.exactAuthorityObserved, true);
      assert.equal(aliasInspection.exactAuthorityReady, false);
      assert.equal(aliasInspection.rawOrControlAliasObserved, true);
      assert.equal(
        aliasInspection.status,
        'blocked-exact-v4-gas-pressure-raw-or-control-alias'
      );
    }
    let aliasGetterCalls = 0;
    const accessorAlias = makeExactWrapper();
    Object.defineProperty(accessorAlias.wrapper, 'gasAuthorityControlBuffer', {
      configurable: true,
      enumerable: true,
      get() {
        aliasGetterCalls += 1;
        throw new Error('exact wrapper raw/control alias getter invoked');
      }
    });
    const accessorAliasInspection =
      inspectExactSphSpatialGasPressureAuthorityImport(
        accessorAlias.wrapper,
        expected
      );
    assert.equal(accessorAliasInspection.exactAuthorityReady, false);
    assert.equal(accessorAliasInspection.rawOrControlAliasAccessorObserved, true);
    assert.equal(aliasGetterCalls, 0);
    const accessorAliasMount = summarizeMountedPressureInterfaceGasCellImport({
      importDescriptor: accessorAlias.wrapper,
      device: fixture.device
    });
    assert.equal(accessorAliasMount.pressureInterfaceGasCellFieldImportAvailable, false);
    assert.equal(
      accessorAliasMount.pressureInterfaceGasCellFieldImportBoundaryStatus,
      accessorAliasInspection.status
    );
    assert.equal(
      accessorAliasMount.mountedWorkerLanePressureInterfaceGasCellImportTransferStatus,
      'blocked-main-thread-exact-opaque-authority-import'
    );
    assert.equal(aliasGetterCalls, 0);

    const mismatchedAdmissionSource = {
      schema: 'peercompute.ulg.sph-retained-gas-cell-eos-source.v1'
    };
    const mismatchedAdmission = makeExactWrapper({
      admissionSource: mismatchedAdmissionSource
    });
    const mismatchedAdmissionInspection =
      inspectExactSphSpatialGasPressureAuthorityImport(
        mismatchedAdmission.wrapper,
        expected
      );
    assert.equal(mismatchedAdmissionInspection.exactAuthorityReady, false);
    assert.equal(mismatchedAdmissionInspection.admissionSourceMismatch, true);
    assert.equal(
      mismatchedAdmissionInspection.status,
      'blocked-mismatched-exact-v4-gas-pressure-admission-source'
    );

    const ambiguousAdmission = makeExactWrapper();
    ambiguousAdmission.wrapper.gasCellFieldAdmission = {
      schema: ULG_PRESSURE_INTERFACE_GAS_CELL_FIELD_ADMISSION_SCHEMA,
      status: 'pressure-interface-gas-cell-field-consumption-approved',
      gasCellFieldConsumptionApproved: true,
      retainedGasCellFieldSource: fixture.source
    };
    const ambiguousAdmissionInspection =
      inspectExactSphSpatialGasPressureAuthorityImport(
        ambiguousAdmission.wrapper,
        expected
      );
    assert.equal(ambiguousAdmissionInspection.exactAuthorityReady, false);
    assert.equal(ambiguousAdmissionInspection.admissionAmbiguous, true);
    assert.equal(
      ambiguousAdmissionInspection.status,
      'blocked-ambiguous-exact-v4-gas-pressure-admission'
    );

    for (const [retiredSchema, observedField] of [
      [ULG_SPH_RETAINED_GAS_CELL_EOS_SOURCE_SCHEMA_V2, 'retiredV2AuthorityObserved'],
      [ULG_SPH_RETAINED_GAS_CELL_EOS_SOURCE_SCHEMA_V3, 'retiredV3AuthorityObserved']
    ]) {
      const retired = makeExactWrapper({
        extra: {
          pressureInterfaceGasCellFieldImport: {
            retainedGasCellFieldSource: { schema: retiredSchema }
          }
        }
      });
      const retiredInspection = inspectExactSphSpatialGasPressureAuthorityImport(
        retired.wrapper,
        expected
      );
      assert.equal(retiredInspection.exactAuthorityObserved, true);
      assert.equal(retiredInspection.exactAuthorityReady, false);
      assert.equal(retiredInspection[observedField], true);
    }

    const inheritedRetiredSource = Object.create({
      schema: ULG_SPH_RETAINED_GAS_CELL_EOS_SOURCE_SCHEMA_V3
    });
    const inheritedRetired = makeExactWrapper({
      extra: {
        pressureInterfaceGasCellFieldImport: {
          retainedGasCellFieldSource: inheritedRetiredSource
        }
      }
    });
    const inheritedRetiredInspection =
      inspectExactSphSpatialGasPressureAuthorityImport(
        inheritedRetired.wrapper,
        expected
      );
    assert.equal(inheritedRetiredInspection.exactAuthorityReady, false);
    assert.equal(inheritedRetiredInspection.inheritedProtectedSchemaObserved, true);
    assert.equal(inheritedRetiredInspection.retiredV3AuthorityObserved, true);

    const forgedNested = makeExactWrapper({
      extra: {
        pressureInterfaceGasCellFieldImport: {
          retainedGasCellFieldSource: {
            schema: 'peercompute.ulg.sph-retained-gas-cell-eos-source.v4'
          }
        }
      }
    });
    const forgedNestedInspection =
      inspectExactSphSpatialGasPressureAuthorityImport(
        forgedNested.wrapper,
        expected
      );
    assert.equal(forgedNestedInspection.exactAuthorityReady, false);
    assert.equal(forgedNestedInspection.forgedV4AuthorityObserved, true);

    const secondFixture = await opaqueScenePressureAuthorityFixture();
    try {
      const secondExact = makeExactWrapper({
        extra: {
          pressureInterfaceGasCellFieldImport: {
            retainedGasCellFieldSource: secondFixture.source
          }
        }
      });
      const secondExactInspection =
        inspectExactSphSpatialGasPressureAuthorityImport(
          secondExact.wrapper,
          expected
        );
      assert.equal(secondExactInspection.exactAuthorityObserved, true);
      assert.equal(secondExactInspection.exactAuthorityReady, false);
      assert.equal(secondExactInspection.exactAuthorityAmbiguous, true);
      assert.equal(secondExactInspection.exactAuthoritySource, null);
      assert.equal(
        secondExactInspection.status,
        'blocked-ambiguous-exact-v4-gas-pressure-authority'
      );
    } finally {
      await secondFixture.cleanup();
    }

    const changingDescriptorTarget = makeExactWrapper();
    let retainedSourceDescriptorCalls = 0;
    const changingDescriptorProxy = new Proxy(changingDescriptorTarget.wrapper, {
      getOwnPropertyDescriptor(target, key) {
        if (key === 'retainedGasCellFieldSource') {
          retainedSourceDescriptorCalls += 1;
          if (retainedSourceDescriptorCalls > 1) {
            return {
              configurable: true,
              enumerable: true,
              writable: true,
              value: { schema: ULG_SPH_RETAINED_GAS_CELL_EOS_SOURCE_SCHEMA_V3 }
            };
          }
        }
        return Reflect.getOwnPropertyDescriptor(target, key);
      },
      get() {
        throw new Error('descriptor-captured exact wrapper was read directly');
      }
    });
    changingDescriptorTarget.admission.admission = changingDescriptorProxy;
    const changingDescriptorInspection =
      inspectExactSphSpatialGasPressureAuthorityImport(
        changingDescriptorProxy,
        expected
      );
    assert.equal(changingDescriptorInspection.exactAuthorityReady, true);
    assert.equal(retainedSourceDescriptorCalls, 1);

    const wrongDevice = opaqueScenePressureTestDevice().device;
    assert.equal(
      pressureInterfaceGasCellFieldImportReadyForScene(importDescriptor, {
        ...expected,
        expectedDevice: wrongDevice,
        expectedDeviceId: null
      }),
      false
    );
    const forgedV4 = {
      schema: 'peercompute.ulg.sph-retained-gas-cell-eos-source.v4',
      status: 'retained-gas-cell-eos-source-submitted',
      ready: true,
      pressureInterfaceGasPressureCellRowCapacity: description.pressureCellCapacity,
      pressureInterfaceGasPressureCellRowStrideFloats: 12,
      pressureInterfaceGasCellFieldAdmission: {
        schema: ULG_PRESSURE_INTERFACE_GAS_CELL_FIELD_ADMISSION_SCHEMA,
        status: 'pressure-interface-gas-cell-field-consumption-approved',
        gasCellFieldConsumptionApproved: true
      }
    };
    assert.equal(
      pressureInterfaceGasCellFieldImportReadyForScene(forgedV4, {
        expectedDevice: fixture.device
      }),
      false
    );
    const forgedInspection = inspectExactSphSpatialGasPressureAuthorityImport(
      forgedV4,
      { expectedDevice: fixture.device }
    );
    assert.equal(forgedInspection.forgedV4AuthorityObserved, true);
    assert.equal(forgedInspection.graphSafeForLegacyFallback, false);

    const cyclic = { schema: ULG_PRESSURE_INTERFACE_GAS_CELL_FIELD_IMPORT_SCHEMA };
    cyclic.admission = cyclic;
    assert.doesNotThrow(() => {
      assert.equal(
        pressureInterfaceGasCellFieldImportReadyForScene(cyclic),
        false
      );
    });
    let bounded = forgedV4;
    for (let index = 0; index < 65; index += 1) {
      bounded = { retainedGasCellFieldSource: bounded };
    }
    const boundedInspection = inspectExactSphSpatialGasPressureAuthorityImport(
      bounded,
      { expectedDevice: fixture.device }
    );
    assert.equal(boundedInspection.graphBoundExceeded, true);
    assert.equal(boundedInspection.exactAuthorityReady, false);
    const hostileProxy = new Proxy({}, {
      getOwnPropertyDescriptor() {
        throw new Error('hostile opaque scene descriptor trap');
      }
    });
    assert.doesNotThrow(() => {
      assert.equal(
        pressureInterfaceGasCellFieldImportReadyForScene(hostileProxy),
        false
      );
    });

    const publicBuffer = tagWebGpuBufferDevice(fixture.device.createBuffer({
      label: 'opaque-scene-pressure-public-consumer-buffer',
      size: 64,
      usage: 128
    }), fixture.device);
    const consumerOptions = {
      device: fixture.device,
      passEncoder: { setBindGroup() {} },
      bindGroupLayout: { label: 'opaque-scene-pressure-consumer-layout' },
      publicEntries: [{ binding: 0, resource: { buffer: publicBuffer } }]
    };
    const borrowed = encodeSphSpatialGasPressureAuthority(
      fixture.source,
      consumerOptions
    );
    assert.equal(
      pressureInterfaceGasCellFieldImportReadyForScene(importDescriptor, expected),
      false
    );
    assert.equal(abandonSphSpatialGasPressureAuthority(borrowed.receipt), true);
    assert.equal(
      pressureInterfaceGasCellFieldImportReadyForScene(importDescriptor, expected),
      true
    );
    const submitted = encodeSphSpatialGasPressureAuthority(
      fixture.source,
      consumerOptions
    );
    fixture.device.queue.submit([]);
    assert.equal(
      markSphSpatialGasPressureAuthoritySubmitted(submitted.receipt),
      true
    );
    assert.equal(
      pressureInterfaceGasCellFieldImportReadyForScene(importDescriptor, expected),
      false
    );
    assert.equal(releaseSphSpatialGasLedgerEosAfterQueue(fixture.execution), true);
    assert.equal(
      pressureInterfaceGasCellFieldImportReadyForScene(importDescriptor, expected),
      false
    );
    assert.equal(await fixture.execution.releasePromise, true);
    assert.equal(
      pressureInterfaceGasCellFieldImportReadyForScene(importDescriptor, expected),
      false
    );
  } finally {
    await fixture.cleanup();
  }
});

test('SPH scene admits only exact live same-device retained gas-cell generations', () => {
  const gasPressureCellsBuffer = { label: 'exact-scene-gas-pressure-cells-buffer' };
  const epochIdentity = {
    storageGeneration: 7,
    physicsTick: 11,
    physicsSubstep: 0,
    positionEpoch: 11,
    topologyEpoch: 3,
    chartEpoch: 2,
    levelEpoch: 11,
    supportEpoch: 11
  };
  const retainedSource = {
    schema: 'peercompute.ulg.sph-retained-gas-cell-eos-source.v1',
    status: 'retained-gas-cell-eos-source-submitted',
    ready: true,
    deviceId: 'device:test-exact-scene-gas',
    stateKey: 'state:test-exact-scene-gas',
    sourceTaskId: 'task:test-exact-scene-gas:eos',
    gasPressureCellsBuffer,
    retainedGasPressureCellsBuffer: gasPressureCellsBuffer,
    pressureInterfaceGasPressureCellsBuffer: gasPressureCellsBuffer,
    pressureInterfaceGasPressureCellRowCount: 2,
    pressureInterfaceGasPressureCellRowStrideFloats: 12,
    pressureInterfaceGasPressureCellRowByteLength: 96,
    pressureInterfaceGasPressureCellRowsBufferRetained: true,
    localPressureGradientReady: true,
    sourceSpatialGasLedgerGenerationId: 'gas-generation:test:11',
    sourceSpatialGasLedger: {
      spatialEpochGenerationId: 'gas-generation:test:11',
      epochIdentity
    }
  };
  const admission = {
    schema: ULG_PRESSURE_INTERFACE_GAS_CELL_FIELD_ADMISSION_SCHEMA,
    status: 'pressure-interface-gas-cell-field-consumption-approved',
    gasCellFieldConsumptionApproved: true,
    retainedGasCellFieldSource: retainedSource
  };
  const importDescriptor = {
    schema: ULG_PRESSURE_INTERFACE_GAS_CELL_FIELD_IMPORT_SCHEMA,
    status: 'pressure-interface-gas-cell-field-import-ready',
    stateKey: 'state:test-exact-scene-gas',
    sourceTaskId: 'task:test-exact-scene-gas:eos',
    deviceId: 'device:test-exact-scene-gas',
    sameDevice: true,
    gasPressureCellsBuffer,
    pressureInterfaceGasPressureCellRowCount: 2,
    pressureInterfaceGasPressureCellRowStrideFloats: 12,
    pressureInterfaceGasPressureCellRowsBufferRetained: true,
    retainedGasCellFieldSource: retainedSource,
    pressureInterfaceGasCellFieldAdmission: admission
  };
  const expected = {
    expectedStateKey: importDescriptor.stateKey,
    expectedSourceTaskId: importDescriptor.sourceTaskId,
    expectedDeviceId: importDescriptor.deviceId,
    expectedSpatialGasLedgerGenerationId: 'gas-generation:test:11',
    expectedEpochIdentity: epochIdentity
  };

  assert.equal(
    pressureInterfaceGasCellFieldImportReadyForScene(importDescriptor, expected),
    true
  );
  const benignLegacyExecution = {
    releaseStatus: 'spatial-gas-ledger-eos-retained-for-final-consumer',
    released: false,
    releaseScheduled: false,
    terminal: false
  };
  const detachableRetainedSource = {
    ...retainedSource,
    spatialGasLedgerEosExecution: benignLegacyExecution
  };
  const detachableAdmission = {
    ...admission,
    retainedGasCellFieldSource: detachableRetainedSource
  };
  const detachableImport = {
    ...importDescriptor,
    retainedGasCellFieldSource: detachableRetainedSource,
    pressureInterfaceGasCellFieldAdmission: detachableAdmission,
    spatialGasLedgerEosExecution: benignLegacyExecution
  };
  const detachableInspection =
    inspectExactSphSpatialGasPressureAuthorityImport(detachableImport);
  assert.equal(detachableInspection.graphSafeForLegacyFallback, true);
  assert.notEqual(
    detachableInspection.legacyImportDescriptor.retainedGasCellFieldSource,
    detachableRetainedSource
  );
  assert.notEqual(
    detachableInspection.legacyImportDescriptor.retainedGasCellFieldSource
      .sourceSpatialGasLedger,
    retainedSource.sourceSpatialGasLedger
  );
  assert.notEqual(
    detachableInspection.legacyImportDescriptor.retainedGasCellFieldSource
      .sourceSpatialGasLedger.epochIdentity,
    epochIdentity
  );
  assert.notEqual(
    detachableInspection.legacyImportDescriptor.spatialGasLedgerEosExecution,
    benignLegacyExecution
  );
  assert.notEqual(
    detachableInspection.legacyImportDescriptor.retainedGasCellFieldSource
      .spatialGasLedgerEosExecution,
    benignLegacyExecution
  );
  assert.equal(
    pressureInterfaceGasCellFieldImportReadyForScene(
      detachableImport,
      expected
    ),
    true
  );
  let hostileLegacyOwnerGetterCalls = 0;
  const hostileSpatialLedger = {
    spatialEpochGenerationId: 'gas-generation:test:11'
  };
  Object.defineProperty(hostileSpatialLedger, 'epochIdentity', {
    configurable: true,
    enumerable: true,
    get() {
      hostileLegacyOwnerGetterCalls += 1;
      throw new Error('legacy spatial owner epoch getter invoked');
    }
  });
  const hostileExecution = {};
  Object.defineProperty(hostileExecution, 'releaseScheduled', {
    configurable: true,
    enumerable: true,
    get() {
      hostileLegacyOwnerGetterCalls += 1;
      throw new Error('legacy execution lifecycle getter invoked');
    }
  });
  const hostileRetainedSource = {
    ...retainedSource,
    sourceSpatialGasLedger: hostileSpatialLedger,
    spatialGasLedgerEosExecution: hostileExecution
  };
  const hostileAdmission = {
    ...admission,
    retainedGasCellFieldSource: hostileRetainedSource
  };
  const hostileLegacyImport = {
    ...importDescriptor,
    retainedGasCellFieldSource: hostileRetainedSource,
    pressureInterfaceGasCellFieldAdmission: hostileAdmission,
    spatialGasLedgerEosExecution: hostileExecution
  };
  assert.equal(
    pressureInterfaceGasCellFieldImportReadyForScene(
      hostileLegacyImport,
      expected
    ),
    false
  );
  assert.equal(hostileLegacyOwnerGetterCalls, 0);
  assert.equal(
    pressureInterfaceGasCellFieldImportReadyForScene(importDescriptor, {
      ...expected,
      expectedStateKey: 'state:test-stale'
    }),
    false
  );
  assert.equal(
    pressureInterfaceGasCellFieldImportReadyForScene(importDescriptor, {
      ...expected,
      expectedSpatialGasLedgerGenerationId: 'gas-generation:test:10'
    }),
    false
  );
  assert.equal(
    pressureInterfaceGasCellFieldImportReadyForScene(importDescriptor, {
      ...expected,
      expectedEpochIdentity: { ...epochIdentity, positionEpoch: 10 }
    }),
    false
  );
  assert.equal(
    pressureInterfaceGasCellFieldImportReadyForScene({
      ...importDescriptor,
      gasPressureCellsBuffer: {
        schema: 'peercompute.ulg.worker-retained-buffer-ref.v0',
        ref: 'worker:gas-pressure-cells'
      },
      retainedGasCellFieldSource: {
        ...retainedSource,
        gasPressureCellsBuffer: null,
        retainedGasPressureCellsBuffer: null,
        pressureInterfaceGasPressureCellsBuffer: null
      }
    }, expected),
    false
  );
  assert.equal(
    pressureInterfaceGasCellFieldImportReadyForScene({
      ...importDescriptor,
      releaseScheduled: true
    }, expected),
    false
  );
});

test('SPH scene requests resident authority publication for admitted gas-cell field imports', () => {
  const gasCellField = {
    schema: 'peercompute.ulg.sph-sealed-gas-pressure-cell-field.v0',
    status: 'gas-cell-pressure-field-ready',
    localPressureGradientReady: true,
    retainedGasPressureBufferRefs: ['resident-gas-pressure-cells-buffer'],
    cellDims: [2, 1, 1],
    cells: [
      {
        status: 'local-gas-pressure-cell-ready',
        gridIndex: [0, 0, 0],
        centerM: [0.5, 1, 1],
        pressurePa: 120000,
        pressureGradientPaPerM: [0, 0, 0],
        volumeM3: 4
      },
      {
        status: 'local-gas-pressure-cell-ready',
        gridIndex: [1, 0, 0],
        centerM: [1.5, 1, 1],
        pressurePa: 180000,
        pressureGradientPaPerM: [0, 0, 0],
        volumeM3: 4
      }
    ]
  };
  const gasPressureSummary = {
    schema: 'peercompute.ulg.sph-resident-gas-pressure-summary.v0',
    status: 'gpu-resident-reaction-pressure-summary',
    source: 'gpu-resident-product-mass-gas-species-ledger',
    pressureFeedback: {
      schema: 'peercompute.ulg.sph-gas-pressure-feedback.v0',
      status: 'wall-pressure-ledger-ready',
      totalPressurePa: 150000,
      pressureGaugePa: 48675,
      gasCellField
    }
  };
  const pressureInterfaceGasCellFieldAdmission = {
    schema: ULG_PRESSURE_INTERFACE_GAS_CELL_FIELD_ADMISSION_SCHEMA,
    status: 'pressure-interface-gas-cell-field-consumption-approved',
    gasCellFieldConsumptionApproved: true,
    sourceHotBufferKey: 'ulg:test:gas-cell-source-hot-buffer',
    retainedGasPressureBufferRefs: ['resident-gas-pressure-cells-buffer']
  };
  const calls = [];
  const residentAuthorityHost = {
    publishPressureInterfaceGasCellFieldImportSource(options) {
      calls.push(options);
      return {
        schema: 'peercompute.ulg.pressure-interface-gas-cell-field-import-hot-buffer-publication.v0',
        status: 'pressure-interface-gas-cell-field-import-published',
        committed: true,
        hotBufferKey: 'ulg:test:scene-gas-cell-import-hot-buffer',
        commitDeltaTaskId: 'ulg:test:scene-gas-cell-import-task',
        commitDeltaScope: 'ulg-pressure-interface-gas-cell-field-imports',
        pressureInterfaceGasCellFieldImport: {
          schema: ULG_PRESSURE_INTERFACE_GAS_CELL_FIELD_IMPORT_SCHEMA,
          status: 'pressure-interface-gas-cell-field-import-ready',
          sourceHotBufferKey: 'ulg:test:scene-gas-cell-import-hot-buffer',
          retainedGasPressureBufferRefs: options.retainedGasPressureBufferRefs,
          workerRetainedGasPressureBufferRefs: options.workerRetainedGasPressureBufferRefs,
          pressureInterfaceGasPressureCellRowCount: options.gasCellFieldSnapshot.cells.length,
          pressureInterfaceGasCellFieldAdmission: options.pressureInterfaceGasCellFieldAdmission,
          gasCellFieldSnapshot: options.gasCellFieldSnapshot
        }
      };
    }
  };

  const publication = publishScenePressureInterfaceGasCellFieldImportSource({
    residentAuthorityHost,
    gasPressureSummary,
    pressureInterfaceGasCellFieldAdmission,
    cacheKey: 'ulg:test:scene-gas-cell-import-cache',
    stateKey: 'ulg:test:scene-gas-cell-import-state',
    sourceTaskId: 'ulg:test:resident-gas-pressure-source',
    source: 'resident-physics-loop-pressure-interface-refresh',
    sourceCadence: 'resident-step-completed'
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].stateKey, 'ulg:test:scene-gas-cell-import-state');
  assert.deepEqual(calls[0].retainedGasPressureBufferRefs, ['resident-gas-pressure-cells-buffer']);
  assert.equal(calls[0].gasCellFieldSnapshot, gasCellField);
  assert.equal(calls[0].pressureInterfaceGasCellFieldAdmission, pressureInterfaceGasCellFieldAdmission);
  assert.equal(publication.status, 'pressure-interface-gas-cell-field-import-published');
  assert.equal(publication.committed, true);
  assert.equal(publication.pressureInterfaceGasCellFieldImportReady, true);
  assert.equal(publication.pressureInterfaceGasCellFieldImportSchema, ULG_PRESSURE_INTERFACE_GAS_CELL_FIELD_IMPORT_SCHEMA);
  assert.equal(publication.pressureInterfaceGasCellFieldImportSourceHotBufferKey, 'ulg:test:scene-gas-cell-import-hot-buffer');
  assert.equal(publication.pressureInterfaceGasCellFieldAdmissionApproved, true);

  const blocked = publishScenePressureInterfaceGasCellFieldImportSource({
    residentAuthorityHost,
    gasPressureSummary,
    pressureInterfaceGasCellFieldAdmission: null
  });
  assert.equal(calls.length, 1);
  assert.equal(blocked.status, 'blocked-gas-cell-field-consumption-admission-required');
  assert.equal(blocked.pressureInterfaceGasCellFieldImportReady, false);

  const state = buildSphResidentPressureInterfaceStateSummary({
    materialInterfaceField: {
      schema: 'peercompute.ulg.sph-material-interface-field.v0',
      status: 'material-interface-field-ready',
      readySurfaceCount: 0,
      totalSurfaceAreaM2: 0,
      elementCount: 0,
      elements: []
    },
    gasPressureSummary,
    pressureInterfaceGasCellFieldImportPublication: publication
  });
  assert.equal(state.pressureInterfaceGasCellFieldImportReady, true);
  assert.equal(state.pressureInterfaceGasCellFieldImportSourceHotBufferKey, 'ulg:test:scene-gas-cell-import-hot-buffer');
  assert.deepEqual(state.pressureInterfaceGasCellFieldRetainedGasPressureBufferRefs, ['resident-gas-pressure-cells-buffer']);
});

test('SPH scene can block summary-snapshot gas-cell imports for mounted hot-loop requests', () => {
  const gasCellField = {
    schema: 'peercompute.ulg.sph-sealed-gas-pressure-cell-field.v0',
    status: 'gas-cell-pressure-field-ready',
    localPressureGradientReady: true,
    retainedGasPressureBufferRefs: ['resident-gas-pressure-cells-buffer'],
    cellDims: [1, 1, 1],
    cells: [
      {
        status: 'local-gas-pressure-cell-ready',
        gridIndex: [0, 0, 0],
        centerM: [0.5, 1, 1],
        pressurePa: 120000,
        pressureGradientPaPerM: [0, 0, 0],
        volumeM3: 4
      }
    ]
  };
  const pressureInterfaceGasCellFieldAdmission = {
    schema: ULG_PRESSURE_INTERFACE_GAS_CELL_FIELD_ADMISSION_SCHEMA,
    status: 'pressure-interface-gas-cell-field-consumption-approved',
    gasCellFieldConsumptionApproved: true,
    retainedGasPressureBufferRefs: ['resident-gas-pressure-cells-buffer']
  };
  const gasPressureSummary = {
    schema: 'peercompute.ulg.sph-resident-gas-pressure-summary.v0',
    status: 'gpu-resident-reaction-pressure-summary',
    retainedGasPressureBufferRefs: ['resident-gas-pressure-cells-buffer'],
    pressureFeedback: {
      schema: 'peercompute.ulg.sph-gas-pressure-feedback.v0',
      status: 'wall-pressure-ledger-ready',
      gasCellField
    }
  };
  const calls = [];
  const residentAuthorityHost = {
    publishPressureInterfaceGasCellFieldImportSource(options) {
      calls.push(options);
      return {
        schema: 'peercompute.ulg.pressure-interface-gas-cell-field-import-hot-buffer-publication.v0',
        status: 'pressure-interface-gas-cell-field-import-published',
        committed: true,
        hotBufferKey: 'ulg:test:blocked-snapshot-import-hot-buffer',
        pressureInterfaceGasCellFieldImport: {
          schema: ULG_PRESSURE_INTERFACE_GAS_CELL_FIELD_IMPORT_SCHEMA,
          status: 'pressure-interface-gas-cell-field-import-ready',
          sourceHotBufferKey: 'ulg:test:blocked-snapshot-import-hot-buffer',
          retainedGasPressureBufferRefs: options.retainedGasPressureBufferRefs,
          pressureInterfaceGasCellFieldAdmission: options.pressureInterfaceGasCellFieldAdmission,
          gasCellFieldSnapshot: options.gasCellFieldSnapshot
        }
      };
    }
  };

  const blocked = publishScenePressureInterfaceGasCellFieldImportSource({
    residentAuthorityHost,
    gasPressureSummary,
    pressureInterfaceGasCellFieldAdmission,
    allowSummaryGasCellFieldImport: false,
    source: 'resident-physics-loop-pressure-interface-refresh',
    sourceCadence: 'resident-step-completed'
  });

  assert.equal(calls.length, 0);
  assert.equal(blocked.status, 'blocked-snapshot-gas-cell-import-disabled');
  assert.equal(blocked.blocker, 'gas-cell-eos-producer-result-or-supplied-import-required');
  assert.equal(blocked.gasCellFieldSnapshotReady, true);
  assert.equal(blocked.pressureInterfaceGasCellFieldImportReady, false);
  assert.deepEqual(blocked.retainedGasPressureBufferRefs, ['resident-gas-pressure-cells-buffer']);

  const compatibilityPublication = publishScenePressureInterfaceGasCellFieldImportSource({
    residentAuthorityHost,
    gasPressureSummary,
    pressureInterfaceGasCellFieldAdmission
  });
  assert.equal(calls.length, 1);
  assert.equal(compatibilityPublication.status, 'pressure-interface-gas-cell-field-import-published');
  assert.equal(compatibilityPublication.pressureInterfaceGasCellFieldImportReady, true);
});

test('SPH scene asks resident authority host to admit gas-cell fields before import publication', () => {
  const gasCellField = {
    schema: 'peercompute.ulg.sph-sealed-gas-pressure-cell-field.v0',
    status: 'gas-cell-pressure-field-ready',
    localPressureGradientReady: true,
    retainedGasPressureBufferRefs: ['resident-gas-pressure-cells-buffer'],
    cellDims: [1, 1, 1],
    cells: [
      {
        status: 'local-gas-pressure-cell-ready',
        gridIndex: [0, 0, 0],
        centerM: [0.5, 1, 1],
        pressurePa: 120000,
        pressureGradientPaPerM: [0, 0, 0],
        volumeM3: 4
      }
    ]
  };
  const gasPressureSummary = {
    schema: 'peercompute.ulg.sph-resident-gas-pressure-summary.v0',
    status: 'gpu-resident-reaction-pressure-summary',
    retainedGasPressureBufferRefs: ['resident-gas-pressure-cells-buffer'],
    pressureFeedback: {
      schema: 'peercompute.ulg.sph-gas-pressure-feedback.v0',
      status: 'wall-pressure-ledger-ready',
      gasCellField
    }
  };
  const admissionCalls = [];
  const importCalls = [];
  const residentAuthorityHost = {
    publishPressureInterfaceGasCellFieldAdmission(options) {
      admissionCalls.push(options);
      return {
        schema: 'peercompute.ulg.pressure-interface-gas-cell-field-admission-hot-buffer-publication.v0',
        status: 'pressure-interface-gas-cell-field-admission-published',
        committed: true,
        hotBufferKey: 'ulg:test:scene-gas-cell-admission-hot-buffer',
        pressureInterfaceGasCellFieldAdmission: {
          schema: ULG_PRESSURE_INTERFACE_GAS_CELL_FIELD_ADMISSION_SCHEMA,
          status: 'pressure-interface-gas-cell-field-consumption-approved',
          gasCellFieldConsumptionApproved: true,
          sourceHotBufferKey: 'ulg:test:scene-gas-cell-admission-hot-buffer',
          retainedGasPressureBufferRefs: options.retainedGasPressureBufferRefs
        }
      };
    },
    publishPressureInterfaceGasCellFieldImportSource(options) {
      importCalls.push(options);
      return {
        schema: 'peercompute.ulg.pressure-interface-gas-cell-field-import-hot-buffer-publication.v0',
        status: 'pressure-interface-gas-cell-field-import-published',
        committed: true,
        hotBufferKey: 'ulg:test:scene-gas-cell-import-hot-buffer',
        pressureInterfaceGasCellFieldImport: {
          schema: ULG_PRESSURE_INTERFACE_GAS_CELL_FIELD_IMPORT_SCHEMA,
          status: 'pressure-interface-gas-cell-field-import-ready',
          sourceHotBufferKey: 'ulg:test:scene-gas-cell-import-hot-buffer',
          retainedGasPressureBufferRefs: options.retainedGasPressureBufferRefs,
          pressureInterfaceGasCellFieldAdmission: options.pressureInterfaceGasCellFieldAdmission,
          gasCellFieldSnapshot: options.gasCellFieldSnapshot
        }
      };
    }
  };

  const publication = publishScenePressureInterfaceGasCellFieldImportSource({
    residentAuthorityHost,
    gasPressureSummary,
    cacheKey: 'ulg:test:scene-gas-cell-import-cache',
    stateKey: 'ulg:test:scene-gas-cell-import-state',
    sourceTaskId: 'ulg:test:resident-gas-pressure-source'
  });

  assert.equal(admissionCalls.length, 1);
  assert.equal(importCalls.length, 1);
  assert.equal(admissionCalls[0].gasCellFieldSnapshot, gasCellField);
  assert.deepEqual(admissionCalls[0].retainedGasPressureBufferRefs, ['resident-gas-pressure-cells-buffer']);
  assert.equal(importCalls[0].pressureInterfaceGasCellFieldAdmission.schema, ULG_PRESSURE_INTERFACE_GAS_CELL_FIELD_ADMISSION_SCHEMA);
  assert.equal(importCalls[0].pressureInterfaceGasCellFieldAdmission.sourceHotBufferKey, 'ulg:test:scene-gas-cell-admission-hot-buffer');
  assert.equal(publication.pressureInterfaceGasCellFieldAdmissionApproved, true);
  assert.equal(publication.pressureInterfaceGasCellFieldAdmissionPublicationStatus, 'pressure-interface-gas-cell-field-admission-published');
  assert.equal(publication.pressureInterfaceGasCellFieldImportReady, true);

  const state = buildSphResidentPressureInterfaceStateSummary({
    materialInterfaceField: {
      schema: 'peercompute.ulg.sph-material-interface-field.v0',
      status: 'material-interface-field-ready',
      readySurfaceCount: 0,
      totalSurfaceAreaM2: 0,
      elementCount: 0,
      elements: []
    },
    gasPressureSummary,
    pressureInterfaceGasCellFieldImportPublication: publication
  });
  assert.equal(state.pressureInterfaceGasCellFieldAdmissionPublicationStatus, 'pressure-interface-gas-cell-field-admission-published');
  assert.equal(state.pressureInterfaceGasCellFieldAdmissionPublicationHotBufferKey, 'ulg:test:scene-gas-cell-admission-hot-buffer');
});

test('SPH scene promotes retained Schroeder gas-cell rows for pressure-interface scheduling', () => {
  const gasPressureCellsBuffer = { label: 'retained-ss-gas-pressure-cells-buffer' };
  const queueOrderedFinalConsumer = {};
  const transferReleases = [];
  const schroederGasCellImport = {
    schema: ULG_SCHROEDER_FAR_AGGREGATE_GAS_CELL_IMPORT_EXECUTION_SCHEMA,
    status: 'schroeder-far-aggregate-gas-cell-import-submitted',
    pressureInterfaceImportReady: true,
    gasPressureCellsBuffer,
    pressureInterfaceGasPressureCellsBuffer: gasPressureCellsBuffer,
    gasPressureCellRowsBufferRetained: true,
    pressureInterfaceGasPressureCellRowsBufferRetained: true,
    gasPressureCellRowCount: 2,
    pressureInterfaceGasPressureCellRowCount: 2,
    gasPressureCellRowStrideFloats: 12,
    pressureInterfaceGasPressureCellRowStrideFloats: 12,
    gasPressureCellRowByteLength: 96,
    pressureInterfaceGasPressureCellRowByteLength: 96,
    pressureFieldMode: 'local-gas-cell-pressure-gradient',
    pressureFieldResolution: 'structured-gas-cell-grid',
    retainedGasPressureBufferRefs: ['resident-gas-pressure-cells-buffer'],
    retainedGasCellFieldSource: {
      schema: ULG_PRESSURE_INTERFACE_RETAINED_GAS_CELL_FIELD_SOURCE_SCHEMA,
      status: 'pressure-interface-retained-gas-cell-field-source-ready',
      sourceHotBufferKey: 'ulg:test:ss-gas-cell-source',
      sourceStage: 'schroederFarAggregateGasCellImport',
      retainedGasPressureBufferRefs: ['resident-gas-pressure-cells-buffer'],
      workerRetainedGasPressureBufferRefs: ['worker:resident-gas-pressure-cells-buffer'],
      pressureInterfaceGasPressureCellRowCount: 2,
      pressureInterfaceGasPressureCellRowStrideFloats: 12,
      pressureInterfaceGasPressureCellRowByteLength: 96,
      pressureInterfaceGasPressureCellRowsBufferRetained: true
    }
  };
  const execution = {
    schema: 'peercompute.ulg.mls-mpm-gpu-resident-steps-execution.v0',
    status: 'resident-steps-executed',
    schroederSimulation: true,
    computeManagerTask: {
      acceptedTaskId: 'ulg:test:ss-resident-steps',
      stateKey: 'ulg:test:ss-resident-state'
    },
    finalStep: {
      schroederFarAggregateGasCellImport: schroederGasCellImport,
      releaseSchroederHierarchyArtifactTransfers(options) {
        transferReleases.push(options);
      }
    }
  };

  const selected = selectSchroederPressureInterfaceGasCellFieldImportFromResidentExecution(execution);
  const publication = buildSchroederPressureInterfaceGasCellFieldImportPublicationFromResidentExecution({
    execution,
    source: 'test-ss-pressure-interface-promotion',
    sourceCadence: 'schroeder-same-level-resident-step-completed'
  });

  assert.equal(selected, schroederGasCellImport);
  assert.equal(publication.status, 'schroeder-pressure-interface-gas-cell-field-import-promoted');
  assert.equal(publication.pressureInterfaceGasCellFieldImportReady, true);
  assert.equal(publication.pressureInterfaceGasCellFieldImportSchema, ULG_PRESSURE_INTERFACE_GAS_CELL_FIELD_IMPORT_SCHEMA);
  assert.equal(publication.schroederFarAggregateGasCellImportSchema, ULG_SCHROEDER_FAR_AGGREGATE_GAS_CELL_IMPORT_EXECUTION_SCHEMA);
  assert.equal(publication.pressureInterfaceGasCellFieldImport.gasPressureCellsBuffer, gasPressureCellsBuffer);
  assert.equal(publication.pressureInterfaceGasCellFieldImport.sourceSchema, ULG_SCHROEDER_FAR_AGGREGATE_GAS_CELL_IMPORT_EXECUTION_SCHEMA);
  assert.equal(publication.pressureInterfaceGasCellFieldImport.sourceTaskId, 'ulg:test:ss-resident-steps');
  assert.equal(publication.pressureInterfaceGasCellFieldImport.sourceHotBufferKey, 'ulg:test:ss-gas-cell-source');
  assert.deepEqual(publication.retainedGasPressureBufferRefs, ['resident-gas-pressure-cells-buffer']);
  assert.deepEqual(publication.workerRetainedGasPressureBufferRefs, ['worker:resident-gas-pressure-cells-buffer']);
  assert.equal(publication.pressureInterfaceGasPressureCellRowCount, 2);
  assert.equal(publication.pressureInterfaceGasCellFieldAdmissionApproved, true);

  const state = buildSphResidentPressureInterfaceStateSummary({
    materialInterfaceField: {
      schema: 'peercompute.ulg.sph-material-interface-field.v0',
      status: 'material-interface-field-ready',
      readySurfaceCount: 0,
      totalSurfaceAreaM2: 0,
      elementCount: 0,
      elements: []
    },
    pressureInterfaceGasCellFieldImportPublication: publication
  });
  assert.equal(state.pressureInterfaceGasCellFieldImportReady, true);
  assert.equal(state.pressureInterfaceGasCellFieldImport.gasPressureCellsBuffer, gasPressureCellsBuffer);
  assert.deepEqual(state.pressureInterfaceGasCellFieldRetainedGasPressureBufferRefs, ['resident-gas-pressure-cells-buffer']);
  assert.equal(publication.releaseSchroederGasCellTransfer({
    queueOrderedFinalConsumer
  }), true);
  assert.equal(publication.releaseSchroederGasCellTransfer(), false);
  assert.equal(transferReleases.length, 1);
  assert.deepEqual(transferReleases[0], {
    transferClass: 'next-tick',
    families: 'far-aggregate-gas-cell-import',
    reason: 'persistent-pressure-gas-cell-owner-released',
    submitted: true,
    queueOrderedFinalConsumer
  });
});

test('SPH scene publishes gas-cell import from gas-cell EOS producer result source', () => {
  const gasCellField = {
    schema: 'peercompute.ulg.sph-sealed-gas-pressure-cell-field.v0',
    status: 'gas-cell-pressure-field-ready',
    localPressureGradientReady: true,
    cellDims: [2, 1, 1],
    cells: [
      {
        status: 'local-gas-pressure-cell-ready',
        gridIndex: [0, 0, 0],
        centerM: [0.5, 1, 1],
        pressurePa: 120000,
        pressureGradientPaPerM: [60000, 0, 0],
        volumeM3: 4
      },
      {
        status: 'local-gas-pressure-cell-ready',
        gridIndex: [1, 0, 0],
        centerM: [1.5, 1, 1],
        pressurePa: 180000,
        pressureGradientPaPerM: [60000, 0, 0],
        volumeM3: 4
      }
    ]
  };
  const gasCellEosProducerStageResult = {
    schema: 'peercompute.ulg.sph-gas-cell-eos-producer-stage-compute-task-result.v0',
    status: 'gas-cell-eos-producer-stage-ready',
    computeTaskId: 'ulg:test:gas-cell-eos-producer-stage',
    gasCellFieldSnapshot: gasCellField,
    retainedGasCellFieldSource: {
      schema: ULG_PRESSURE_INTERFACE_RETAINED_GAS_CELL_FIELD_SOURCE_SCHEMA,
      status: 'pressure-interface-retained-gas-cell-field-source-ready',
      sourceTaskId: 'ulg:test:gas-cell-eos-producer-stage',
      sourceStage: 'gasCellEosProducer',
      retainedGasPressureBufferRefs: ['resident-gas-pressure-cells-buffer'],
      workerRetainedGasPressureBufferRefs: [],
      pressureInterfaceGasPressureCellRowCount: 2,
      pressureInterfaceGasPressureCellRowStrideFloats: 12,
      pressureInterfaceGasPressureCellRowByteLength: 96
    }
  };
  const admissionCalls = [];
  const importCalls = [];
  const residentAuthorityHost = {
    publishPressureInterfaceGasCellFieldAdmission(options) {
      admissionCalls.push(options);
      return {
        schema: 'peercompute.ulg.pressure-interface-gas-cell-field-admission-hot-buffer-publication.v0',
        status: 'pressure-interface-gas-cell-field-admission-published',
        committed: true,
        hotBufferKey: 'ulg:test:producer-gas-cell-admission-hot-buffer',
        pressureInterfaceGasCellFieldAdmission: {
          schema: ULG_PRESSURE_INTERFACE_GAS_CELL_FIELD_ADMISSION_SCHEMA,
          status: 'pressure-interface-gas-cell-field-consumption-approved',
          gasCellFieldConsumptionApproved: true,
          sourceHotBufferKey: 'ulg:test:producer-gas-cell-admission-hot-buffer',
          retainedGasCellFieldSource: options.source.retainedGasCellFieldSource,
          retainedGasPressureBufferRefs: options.retainedGasPressureBufferRefs
        }
      };
    },
    publishPressureInterfaceGasCellFieldImportSource(options) {
      importCalls.push(options);
      return {
        schema: 'peercompute.ulg.pressure-interface-gas-cell-field-import-hot-buffer-publication.v0',
        status: 'pressure-interface-gas-cell-field-import-published',
        committed: true,
        hotBufferKey: 'ulg:test:producer-gas-cell-import-hot-buffer',
        pressureInterfaceGasCellFieldImport: {
          schema: ULG_PRESSURE_INTERFACE_GAS_CELL_FIELD_IMPORT_SCHEMA,
          status: 'pressure-interface-gas-cell-field-import-ready',
          sourceHotBufferKey: 'ulg:test:producer-gas-cell-import-hot-buffer',
          retainedGasCellFieldSource: options.source.retainedGasCellFieldSource,
          retainedGasPressureBufferRefs: options.retainedGasPressureBufferRefs,
          pressureInterfaceGasPressureCellRowCount: options.source.retainedGasCellFieldSource.pressureInterfaceGasPressureCellRowCount,
          pressureInterfaceGasPressureCellRowByteLength: options.source.retainedGasCellFieldSource.pressureInterfaceGasPressureCellRowByteLength,
          pressureInterfaceGasCellFieldAdmission: options.pressureInterfaceGasCellFieldAdmission,
          gasCellFieldSnapshot: options.gasCellFieldSnapshot
        }
      };
    }
  };

  const publication = publishScenePressureInterfaceGasCellFieldImportSource({
    residentAuthorityHost,
    gasPressureSummary: null,
    gasCellEosProducerStageResult,
    cacheKey: 'ulg:test:producer-gas-cell-import-cache',
    stateKey: 'ulg:test:producer-gas-cell-import-state'
  });

  assert.equal(admissionCalls.length, 1);
  assert.equal(importCalls.length, 1);
  assert.equal(admissionCalls[0].source, gasCellEosProducerStageResult);
  assert.equal(admissionCalls[0].sourceStage, 'gasCellEosProducer');
  assert.equal(admissionCalls[0].sourceTaskId, 'ulg:test:gas-cell-eos-producer-stage');
  assert.equal(admissionCalls[0].gasCellFieldSnapshot, gasCellField);
  assert.deepEqual(admissionCalls[0].retainedGasPressureBufferRefs, ['resident-gas-pressure-cells-buffer']);
  assert.equal(importCalls[0].source, gasCellEosProducerStageResult);
  assert.equal(importCalls[0].pressureInterfaceGasCellFieldAdmission.retainedGasCellFieldSource.schema, ULG_PRESSURE_INTERFACE_RETAINED_GAS_CELL_FIELD_SOURCE_SCHEMA);
  assert.equal(publication.pressureInterfaceGasCellFieldImportReady, true);
  assert.equal(publication.pressureInterfaceGasCellFieldAdmissionApproved, true);
  assert.equal(publication.pressureInterfaceGasCellFieldImport.pressureInterfaceGasPressureCellRowByteLength, 96);
});

test('SPH scene blocks mounted gas-cell EOS producer requests without a spatial gas ledger', async () => {
  const calls = [];
  const residentAuthorityHost = {
    async submitGasCellEosProducerStageTask(options) {
      calls.push(options);
      return {
        status: 'unexpected-submission'
      };
    }
  };

  const request = await submitSceneGasCellEosProducerStageForPressureInterface({
    residentAuthorityHost,
    gasPressureSummary: {
      schema: 'peercompute.ulg.sph-resident-gas-pressure-summary.v0',
      status: 'gpu-resident-reaction-pressure-summary'
    },
    stateKey: 'ulg:test:mounted-pressure-interface-state',
    source: 'resident-physics-loop-pressure-interface-refresh',
    sourceCadence: 'resident-step-completed'
  });

  assert.equal(calls.length, 0);
  assert.equal(request.schema, 'peercompute.ulg.sph-scene-gas-cell-eos-producer-stage-request.v0');
  assert.equal(request.status, 'blocked-spatial-gas-species-ledger-required');
  assert.equal(request.blocker, 'ready-spatial-gas-species-ledger-required');
  assert.equal(request.gasCellEosProducerStageResultReady, false);
  assert.equal(request.spatialGasSpeciesLedgerCellCount, 0);
});

test('SPH scene requests spatial gas ledger producer from retained product events before gas-cell EOS', async () => {
  const spatialGasSpeciesLedger = {
    schema: 'peercompute.ulg.sph-spatial-gas-species-ledger.v0',
    status: 'spatial-gas-species-ledger-ready',
    cellCount: 1,
    cells: [
      {
        index: 0,
        gridIndex: [0, 0, 0],
        centerM: [0.5, 1, 1],
        volumeM3: 4,
        bySpecies: {
          h2: { material: 'h2', massKg: 0.04, moles: 100, temperatureK: 300 }
        }
      }
    ]
  };
  const residentProductMass = {
    schema: 'peercompute.ulg.sph-resident-product-mass.v0',
    status: 'resident-product-mass-buffer-retained',
    productEventBuffer: { label: 'resident-product-events' },
    productEventBufferRetained: true,
    productEventBufferByteLength: 2 * 32 * 4,
    productEventRowCount: 2,
    productEventStrideFloats: 32
  };
  const reactionSummary = {
    schema: 'peercompute.ulg.sph-gpu-reaction-summary.v0',
    productEventBuffer: residentProductMass.productEventBuffer,
    productEventBufferRetained: true,
    productEventRowCount: 2
  };
  const reactionTable = {
    schema: 'peercompute.ulg.sph-gpu-reaction-table.v1',
    productTermMetadata: [
      { productTermIndex: 0, material: 'h2', routing: 'gas' }
    ]
  };
  const gasPressureSummary = {
    schema: 'peercompute.ulg.sph-resident-gas-pressure-summary.v0',
    status: 'gpu-resident-reaction-pressure-summary',
    boxDimsM: [2, 2, 2]
  };
  const submitCalls = [];
  const residentAuthorityHost = {
    async submitSpatialGasLedgerProducerStageTask(options) {
      submitCalls.push(options);
      return {
        status: 'task-execution-completed',
        result: {
          schema: 'peercompute.ulg.sph-spatial-gas-ledger-producer-stage-compute-task-result.v0',
          status: 'spatial-gas-ledger-producer-stage-ready',
          computeTaskId: options.taskId,
          spatialGasSpeciesLedger,
          retainedSpatialGasLedgerSourceReady: true,
          compactSpatialGasRowCount: 2,
          compactSpatialGasReadbackByteLength: 96,
          fullProductEventReadbackPerformed: false
        }
      };
    }
  };

  const request = await submitSceneSpatialGasLedgerProducerStageForPressureInterface({
    residentAuthorityHost,
    gasPressureSummary,
    residentProductMass,
    reactionSummary,
    reactionTable,
    preferWebGpu: true,
    stateKey: 'ulg:test:mounted-pressure-interface-state',
    sourceTaskId: 'ulg:test:mounted-spatial-gas-source',
    source: 'resident-physics-loop-pressure-interface-refresh',
    sourceCadence: 'resident-step-completed'
  });

  assert.equal(submitCalls.length, 1);
  assert.equal(submitCalls[0].taskId, 'ulg:test:mounted-spatial-gas-source');
  assert.equal(submitCalls[0].residentProductMass, residentProductMass);
  assert.equal(submitCalls[0].reactionSummary, reactionSummary);
  assert.equal(submitCalls[0].reactionTable, reactionTable);
  assert.equal(submitCalls[0].productEventBuffer, residentProductMass.productEventBuffer);
  assert.equal(submitCalls[0].productEventRowCount, 2);
  assert.equal(submitCalls[0].productEventStrideFloats, 32);
  assert.equal(submitCalls[0].source, 'scene-mounted-pressure-interface-spatial-gas-ledger-producer');
  assert.equal(request.status, 'spatial-gas-ledger-producer-stage-result-ready');
  assert.equal(request.spatialGasLedgerProducerStageResultReady, true);
  assert.equal(request.spatialGasLedgerProducerRetainedSourceReady, true);
  assert.equal(request.spatialGasSpeciesLedger, spatialGasSpeciesLedger);
  assert.equal(request.spatialGasSpeciesLedgerCellCount, 1);
  assert.equal(request.fullProductEventReadbackPerformed, false);

  const state = buildSphResidentPressureInterfaceStateSummary({
    materialInterfaceField: {
      schema: 'peercompute.ulg.sph-material-interface-field.v0',
      status: 'material-interface-field-ready',
      readySurfaceCount: 0,
      totalSurfaceAreaM2: 0,
      elementCount: 0,
      elements: []
    },
    gasPressureSummary: {
      ...gasPressureSummary,
      spatialGasSpeciesLedger
    },
    spatialGasLedgerProducerStageRequest: request
  });
  assert.equal(state.spatialGasLedgerProducerStageRequestStatus, 'spatial-gas-ledger-producer-stage-result-ready');
  assert.equal(state.spatialGasLedgerProducerStageResultReady, true);
  assert.equal(state.spatialGasLedgerProducerRetainedSourceReady, true);
  assert.equal(state.spatialGasLedgerProducerStageSpatialLedgerCellCount, 1);
  assert.equal(state.spatialGasLedgerProducerCompactSpatialGasReadbackByteLength, 96);
  assert.equal(state.spatialGasLedgerProducerFullProductEventReadbackPerformed, false);
});

test('SPH scene requests mounted gas-cell EOS producer stage through resident authority host', async () => {
  const spatialGasSpeciesLedger = {
    schema: 'peercompute.ulg.sph-spatial-gas-species-ledger.v0',
    status: 'spatial-gas-species-ledger-ready',
    cells: [
      {
        status: 'spatial-gas-cell-ready',
        gridIndex: [0, 0, 0],
        centerM: [0.5, 1, 1],
        volumeM3: 4,
        species: [
          {
            formula: 'H2O',
            phase: 'gas',
            massKg: 0.001,
            temperatureK: 500,
            amountMol: 0.055
          }
        ]
      }
    ]
  };
  const gasPressureSummary = {
    schema: 'peercompute.ulg.sph-resident-gas-pressure-summary.v0',
    status: 'gpu-resident-reaction-pressure-summary',
    boxDimsM: [2, 2, 2],
    spatialGasSpeciesLedger
  };
  const gasCellField = {
    schema: 'peercompute.ulg.sph-sealed-gas-pressure-cell-field.v0',
    status: 'gas-cell-pressure-field-ready',
    localPressureGradientReady: true,
    cellDims: [1, 1, 1],
    cells: [
      {
        status: 'local-gas-pressure-cell-ready',
        gridIndex: [0, 0, 0],
        centerM: [0.5, 1, 1],
        pressurePa: 140000,
        pressureGradientPaPerM: [0, 0, 0],
        volumeM3: 4
      }
    ]
  };
  const submitCalls = [];
  const residentAuthorityHost = {
    async submitGasCellEosProducerStageTask(options) {
      submitCalls.push(options);
      return {
        status: 'task-execution-completed',
        result: {
          schema: 'peercompute.ulg.sph-gas-cell-eos-producer-stage-compute-task-result.v0',
          status: 'gas-cell-eos-producer-stage-ready',
          computeTaskId: options.taskId,
          gasCellFieldSnapshot: gasCellField,
          retainedGasPressureBufferRefs: ['resident-gas-pressure-cells-buffer'],
          retainedGasCellFieldSourceReady: true,
          retainedGasCellFieldSource: {
            schema: ULG_PRESSURE_INTERFACE_RETAINED_GAS_CELL_FIELD_SOURCE_SCHEMA,
            status: 'pressure-interface-retained-gas-cell-field-source-ready',
            sourceTaskId: options.taskId,
            sourceStage: 'gasCellEosProducer',
            retainedGasPressureBufferRefs: ['resident-gas-pressure-cells-buffer'],
            workerRetainedGasPressureBufferRefs: ['worker:resident-gas-pressure-cells-buffer'],
            pressureInterfaceGasPressureCellRowCount: 1,
            pressureInterfaceGasPressureCellRowStrideFloats: 12,
            pressureInterfaceGasPressureCellRowByteLength: 48
          }
        }
      };
    }
  };

  const request = await submitSceneGasCellEosProducerStageForPressureInterface({
    residentAuthorityHost,
    gasPressureSummary,
    preferWebGpu: true,
    stateKey: 'ulg:test:mounted-pressure-interface-state',
    sourceTaskId: 'ulg:test:mounted-pressure-interface-source',
    source: 'resident-physics-loop-pressure-interface-refresh',
    sourceCadence: 'resident-step-completed'
  });

  assert.equal(submitCalls.length, 1);
  assert.equal(submitCalls[0].taskId, 'ulg:test:mounted-pressure-interface-source');
  assert.equal(submitCalls[0].stateKey, 'ulg:test:mounted-pressure-interface-state');
  assert.equal(submitCalls[0].laneId, 'ulg:scene-gas-cell-eos-producer:ulg:test:mounted-pressure-interface-state');
  assert.equal(submitCalls[0].source, 'scene-mounted-pressure-interface-gas-cell-eos-producer');
  assert.equal(submitCalls[0].preferWebGpu, true);
  assert.equal(submitCalls[0].spatialGasSpeciesLedger, spatialGasSpeciesLedger);
  assert.equal(submitCalls[0].gasPressureSummary, gasPressureSummary);
  assert.equal(submitCalls[0].pressureSummary, gasPressureSummary);
  assert.deepEqual(submitCalls[0].boxDimsM, [2, 2, 2]);
  assert.equal(request.status, 'gas-cell-eos-producer-stage-result-ready');
  assert.equal(request.submissionStatus, 'task-execution-completed');
  assert.equal(request.gasCellEosProducerStageResultReady, true);
  assert.equal(request.gasCellEosProducerRetainedSourceReady, true);
  assert.equal(request.gasCellEosProducerStageResult.gasCellFieldSnapshot, gasCellField);
  assert.deepEqual(request.retainedGasPressureBufferRefs, ['resident-gas-pressure-cells-buffer']);
  assert.deepEqual(request.workerRetainedGasPressureBufferRefs, ['worker:resident-gas-pressure-cells-buffer']);
  assert.equal(request.spatialGasSpeciesLedgerCellCount, 1);

  const state = buildSphResidentPressureInterfaceStateSummary({
    materialInterfaceField: {
      schema: 'peercompute.ulg.sph-material-interface-field.v0',
      status: 'material-interface-field-ready',
      readySurfaceCount: 0,
      totalSurfaceAreaM2: 0,
      elementCount: 0,
      elements: []
    },
    gasPressureSummary,
    gasCellEosProducerStageRequest: request
  });
  assert.equal(state.gasCellEosProducerStageRequestStatus, 'gas-cell-eos-producer-stage-result-ready');
  assert.equal(state.gasCellEosProducerStageResultReady, true);
  assert.equal(state.gasCellEosProducerRetainedSourceReady, true);
  assert.equal(state.gasCellEosProducerStageSpatialLedgerCellCount, 1);
});

test('SPH resident pressure interface state blocks force-row upload without grid admission', () => {
  const materialInterfaceField = {
    schema: 'peercompute.ulg.sph-material-interface-field.v0',
    status: 'material-interface-field-ready',
    readySurfaceCount: 1,
    totalSurfaceAreaM2: 1,
    elementCount: 1,
    elements: [{
      status: 'interface-element-ready',
      surfaceIndex: 0,
      surfaceKey: 'h2o|h2o|liquid',
      material: 'h2o',
      phase: 'liquid',
      materialId: 1,
      phaseId: 2,
      axisId: 1,
      centroidM: [0.5, 0.5, 0.5],
      normalAreaVectorM2: [0, 1, 0],
      areaM2: 1
    }]
  };
  const pressureInterfaceForceSolver = {
    schema: 'peercompute.ulg.sph-pressure-interface-force-solver.v0',
    status: 'pressure-interface-force-solver-ready',
    forceCouplingStatus: 'pressure-force-solver-ready-not-applied',
    forceApplicationStatus: 'solver-ready-not-applied',
    forceRowCount: 1,
    forceRowStrideFloats: 16,
    conservationStatus: 'pairwise-equal-opposite-force-conservative',
    conservationResidualMagnitudeN: 0
  };
  const forceRowsUpload = {
    status: 'blocked-pressure-interface-grid-force-admission-required',
    blocker: 'pressure-interface-force-solver-grid-application-not-approved',
    bufferRetained: false,
    forceRowByteLength: 0,
    candidateForceRowByteLength: 64,
    pressureInterfaceGridForceAdmissionSchema: 'peercompute.ulg.pressure-interface-grid-force-consumption-admission.v0',
    pressureInterfaceGridForceAdmissionStatus: 'pressure-interface-grid-force-consumption-blocked',
    pressureInterfaceGridForceAdmissionApproved: false
  };

  const state = buildSphResidentPressureInterfaceStateSummary({
    materialInterfaceField,
    pressureInterfaceForceSolver,
    pressureInterfaceForceRowsUpload: forceRowsUpload
  });

  assert.equal(state.status, 'resident-pressure-interface-force-rows-admission-required');
  assert.equal(state.pressureInterfaceForceRowsUploadStatus, 'blocked-pressure-interface-grid-force-admission-required');
  assert.equal(state.pressureInterfaceForceRowsUploadBlocker, 'pressure-interface-force-solver-grid-application-not-approved');
  assert.equal(state.pressureInterfaceForceRowsBufferRetained, false);
  assert.equal(state.pressureInterfaceForceRowsBufferByteLength, 0);
  assert.equal(state.pressureInterfaceForceRowsCandidateByteLength, 64);
  assert.equal(state.pressureInterfaceGridForceAdmissionSchema, 'peercompute.ulg.pressure-interface-grid-force-consumption-admission.v0');
  assert.equal(state.pressureInterfaceGridForceAdmissionStatus, 'pressure-interface-grid-force-consumption-blocked');
  assert.equal(state.pressureInterfaceGridForceAdmissionApproved, false);
  assert.equal(state.gpuAuthoritativeState, false);
});

test('extraction-enforced vertex budget keeps a bounded total field working set', () => {
  // With the extension clamp active, four surfaces retain the full 96-cell
  // axis instead of falling back to the legacy vertex-allocation limit.
  const uncapped = nativeMarchingCubesRenderFieldResolutionForVertexRowsBudget(4, {
    vertexRowsBudgetEnforcedByExtraction: true
  });
  assert.equal(uncapped, 96);
  // More dynamic phase/material lanes share the same total field-cell budget
  // rather than multiplying clear/resolve work without bound.
  const eightSurfaceResolution =
    nativeMarchingCubesRenderFieldResolutionForVertexRowsBudget(8, {
      vertexRowsBudgetEnforcedByExtraction: true
    });
  assert.equal(eightSurfaceResolution, 76);
  assert.ok(8 * eightSurfaceResolution ** 3 <= 4 * 96 ** 3);
  // Legacy math unchanged when the flag is absent.
  const legacy = nativeMarchingCubesRenderFieldResolutionForVertexRowsBudget(4, {});
  assert.ok(legacy < 96, `legacy budget resolution should stay capped, got ${legacy}`);
  // Per-surface rows: 256MB / 4 surfaces / 64B rows (16-float surface vertex rows).
  const rows = nativeMarchingCubesVertexRowsBudgetPerSurface(4, {});
  assert.equal(rows, Math.floor(256 * 1024 * 1024 / 4 / 64));
});

test('sphere-lane emissive intensity follows the surface Stefan-Boltzmann law above the anchor', async () => {
  const { sphereEmissiveIntensityForTemperature } = await import('../src/visualization/sphPhaseScene.js');
  // Legacy behavior preserved: no temperature or below-anchor keeps the calibrated 1.8.
  assert.equal(sphereEmissiveIntensityForTemperature(undefined), 1.8);
  assert.equal(sphereEmissiveIntensityForTemperature(1200), 1.8);
  assert.equal(sphereEmissiveIntensityForTemperature(2200), 1.8);
  // Continuous at the anchor, then (T/2200)^4 growth matching the surface WGSL
  // (4a51364): 4400K = 2^4 = 16x the anchor intensity.
  assert.ok(Math.abs(sphereEmissiveIntensityForTemperature(4400) - 1.8 * 16) < 1e-9);
  // Same relative ceiling as the WGSL cap (60/2.1).
  assert.ok(Math.abs(sphereEmissiveIntensityForTemperature(1e6) - 1.8 * (60 / 2.1)) < 1e-9);
});

test('native surface blackbody chromaticity is sampled from the Planck-CIE radiation closure', () => {
  const srgbToLinear = (value) => value <= 0.04045
    ? value / 12.92
    : ((value + 0.055) / 1.055) ** 2.4;
  const anchorTemperatures = [800, 1300, 1850, 2200, 3000, 5500, 6000];

  assert.match(
    SPH_RESIDENT_SURFACE_DRAW_OVERLAY_WGSL,
    /fn blackbody_chromaticity_linear_rgb\(temperature_k: f32\) -> vec3<f32>/
  );
  assert.doesNotMatch(SPH_RESIDENT_SURFACE_DRAW_OVERLAY_WGSL, /let (?:ember|orange|white_hot) =/);
  assert.match(
    SPH_RESIDENT_SURFACE_DRAW_OVERLAY_WGSL,
    /let color = blackbody_chromaticity_linear_rgb\(temperature_k\);/
  );

  for (const temperatureK of anchorTemperatures) {
    const match = SPH_RESIDENT_SURFACE_DRAW_OVERLAY_WGSL.match(new RegExp(
      `let c${temperatureK} = vec3<f32>\\(([^)]+)\\);`
    ));
    assert.ok(match, `missing ${temperatureK}K blackbody LUT anchor`);
    const actual = match[1].split(',').map((value) => Number(value.trim()));
    const srgb = blackbodyColorSrgb(temperatureK);
    const expected = [srgb.r, srgb.g, srgb.b].map(srgbToLinear);
    assert.equal(actual.length, 3);
    for (let channel = 0; channel < 3; channel += 1) {
      assert.ok(
        Math.abs(actual[channel] - expected[channel]) <= 1e-8,
        `${temperatureK}K channel ${channel} must match the closure: ${actual[channel]} vs ${expected[channel]}`
      );
    }
  }

  assert.match(
    SPH_RESIDENT_SURFACE_DRAW_OVERLAY_WGSL,
    /return mix\(c5500, c6000, clamp\(\(temperature_k - 5500\.0\) \/ 500\.0, 0\.0, 1\.0\)\);/
  );
});

test('emissive temperature by material is the luminance-weighted incandescent mean', async () => {
  const { emissiveTemperatureByMaterialFromSphRenderRows } = await import('../src/runtime/sph/sphRenderGpuKernel.js');
  const rows = [
    { material: 'fe', renderKey: 'fe', temperatureK: 3000 },
    { material: 'fe', renderKey: 'fe', temperatureK: 3000 },
    { material: 'fe', renderKey: 'fe', temperatureK: 293 }, // below incandescence: excluded
    { material: 'h2o', renderKey: 'h2o', temperatureK: 293 }
  ];
  const out = emissiveTemperatureByMaterialFromSphRenderRows(rows);
  assert.ok(Math.abs(out.fe - 3000) < 1e-6);
  assert.equal(out.h2o, undefined);
});

test('surface emissive lookup never leaks a hot material aggregate into a cold exact body', () => {
  const hotKey = 'render-domain:12|material:fe|phase:solid';
  const values = {
    fe: 'material-wide-hot-value',
    [hotKey]: 'exact-hot-value'
  };

  assert.equal(emissiveAuthorityValueForSurface(values, {
    material: 'fe',
    phase: 'solid',
    renderKey: 'fe',
    renderDomainId: 12
  }), 'exact-hot-value');
  assert.equal(emissiveAuthorityValueForSurface(values, {
    material: 'fe',
    phase: 'solid',
    renderKey: 'fe',
    renderDomainId: 11
  }), null);
  assert.equal(emissiveAuthorityValueForSurface(values, {
    material: 'fe',
    phase: 'solid',
    renderKey: 'fe',
    renderDomainId: 0
  }), 'material-wide-hot-value');
});

test('GGX latlong prefilter: identity base, constant invariance, monotone lobe spread', async () => {
  const { buildGgxPrefilteredLatlongMips } = await import('../src/visualization/sphPhaseScene.js');
  const w = 64;
  const h = 32;
  const mips = 7;

  // Constant image: every mip stays that constant (within 8-bit rounding) —
  // the prefilter must not invent or lose energy on a uniform environment.
  const grey = new Uint8ClampedArray(w * h * 4).fill(128);
  for (let i = 3; i < grey.length; i += 4) grey[i] = 255;
  const greyLevels = buildGgxPrefilteredLatlongMips({ pixels: grey, width: w, height: h, mipLevelCount: mips, sampleCount: 32 });
  assert.equal(greyLevels.length, mips);
  for (const level of greyLevels) {
    for (let i = 0; i < level.pixels.length; i += 4) {
      assert.ok(Math.abs(level.pixels[i] - 128) <= 2, `constant image drifted: ${level.pixels[i]} at mip ${level.width}`);
    }
  }

  // Point-light latlong: mip 0 is the untouched base; increasing roughness
  // spreads the lobe (peak strictly decreases, lit-texel support grows).
  const point = new Uint8ClampedArray(w * h * 4);
  for (let i = 3; i < point.length; i += 4) point[i] = 255;
  const cx = Math.floor(w / 2);
  const cy = Math.floor(h / 2);
  const o = (cy * w + cx) * 4;
  point[o] = 255; point[o + 1] = 255; point[o + 2] = 255;
  const levels = buildGgxPrefilteredLatlongMips({ pixels: point, width: w, height: h, mipLevelCount: mips, sampleCount: 64 });
  assert.deepEqual(Array.from(levels[0].pixels), Array.from(point), 'mip 0 must be the base image unchanged');
  // 8-bit point-source dilution makes lit-texel counts unreliable; the robust
  // invariants are the peak: it must never grow with roughness and must fall
  // substantially once the lobe is broad (energy spread over many texels).
  const peaks = levels.map((level) => {
    let peak = 0;
    for (let i = 0; i < level.pixels.length; i += 4) {
      if (level.pixels[i] > peak) peak = level.pixels[i];
    }
    return peak;
  });
  for (let l = 2; l <= 4; l += 1) {
    assert.ok(peaks[l] <= peaks[l - 1] + 1, `peak must not grow with roughness (mip ${l}: ${peaks[l]} vs ${peaks[l - 1]})`);
  }
  assert.ok(peaks[4] < peaks[1] * 0.7, `broad lobe must dilute the point source (mip4 ${peaks[4]} vs mip1 ${peaks[1]})`);
});

test('mounted successor surface admission cannot downgrade through mutable public echoes', () => {
  const fullClaim = {
    schroederSpatialSourceFamily: { sourceGenerationId: 19 },
    schroederSpatialSourceFamilyStatus: 'finalized-successor-source-family',
    schroederSpatialSourceGenerationId: 19
  };
  assert.equal(
    resolveSchroederNativeSurfaceAdmissionMode({ artifact: {} }),
    'legacy'
  );
  assert.equal(
    resolveSchroederNativeSurfaceAdmissionMode({
      hasPrivateAdmission: true,
      artifact: fullClaim
    }),
    'successor'
  );
  assert.equal(
    resolveSchroederNativeSurfaceAdmissionMode({
      hasPrivateAdmission: true,
      artifact: {}
    }),
    'invalid-partial-or-downgraded-successor-lineage'
  );
  assert.equal(
    resolveSchroederNativeSurfaceAdmissionMode({
      artifact: { schroederSpatialSourceGenerationId: 19 }
    }),
    'invalid-partial-or-downgraded-successor-lineage'
  );
  assert.equal(
    resolveSchroederNativeSurfaceAdmissionMode({ artifact: fullClaim }),
    'invalid-partial-or-downgraded-successor-lineage'
  );
});

test('mounted successor temperature retirement authenticates the exact destroy hook', () => {
  const destroyMethod = () => {};
  const temperatureRows = { destroy: destroyMethod };
  assert.equal(
    nativeSurfaceTemperatureDestroyMethodIsAuthenticated(
      temperatureRows,
      destroyMethod
    ),
    true
  );
  temperatureRows.destroy = () => {};
  assert.equal(
    nativeSurfaceTemperatureDestroyMethodIsAuthenticated(
      temperatureRows,
      destroyMethod
    ),
    false
  );
  assert.equal(
    nativeSurfaceTemperatureDestroyMethodIsAuthenticated({}, destroyMethod),
    false
  );
  assert.equal(
    nativeSurfaceTemperatureDestroyMethodIsAuthenticated(
      { destroy: destroyMethod.bind(null) },
      destroyMethod
    ),
    false
  );
  assert.equal(
    nativeSurfaceTemperatureDestroyMethodIsAuthenticated(
      { destroy: destroyMethod },
      null
    ),
    false
  );
  assert.equal(
    nativeSurfaceTemperatureDestroyMethodIsAuthenticated(
      { destroy: destroyMethod },
      'not-a-function'
    ),
    false
  );
  assert.equal(
    nativeSurfaceTemperatureAttachmentIsRequired({}, false),
    false
  );
  assert.equal(
    nativeSurfaceTemperatureAttachmentIsRequired({}, true),
    true,
    'deleting the public buffer cannot hide a private attachment'
  );
  const exactTemperatureRows = { destroy() {} };
  const strayTemperatureRows = { destroy() {} };
  const exactDestroyMethod = () => {};
  const temperatureRecord = {
    temperatureRows: exactTemperatureRows,
    destroyMethod: exactDestroyMethod
  };
  assert.deepEqual(
    resolveNativeSurfaceTemperatureRetirement({
      translation: {},
      temperatureRecord
    }),
    {
      exactTemperatureRows,
      exactDestroyMethod,
      strayTemperatureRows: null
    },
    'deleting the public alias must retain the private retirement target'
  );
  assert.deepEqual(
    resolveNativeSurfaceTemperatureRetirement({
      translation: { nativeSurfaceTemperatureRows: strayTemperatureRows },
      temperatureRecord
    }),
    {
      exactTemperatureRows,
      exactDestroyMethod,
      strayTemperatureRows
    },
    'a substituted public alias must not replace the private retirement target'
  );
});

test('resident surface draw order blends back-to-front from the live camera', () => {
  // Blended surfaces were ordered by surfaceIndex alone, which is
  // view-independent. Rotating the camera then left a farther blended surface
  // drawing over a nearer one, which reads as intermittent z-clipping.
  const surfaces = [
    {
      surfaceIndex: 0,
      transparencyClassId: 1,
      depthWriteFlag: 0,
      boundsCenterM: [0, 0, -2]
    },
    {
      surfaceIndex: 1,
      transparencyClassId: 1,
      depthWriteFlag: 0,
      boundsCenterM: [0, 0, 2]
    }
  ];
  const orderFrom = (cameraPositionM) => residentSurfaceDrawOrder(surfaces, {
    cameraPositionM
  }).map((draw) => draw.surfaceIndex);

  // Camera on the +z side: the +z surface is nearer, so it must be drawn last.
  assert.deepEqual(orderFrom([0, 0, 10]), [0, 1]);
  // Rotate to the -z side: the ordering must follow the viewpoint.
  assert.deepEqual(orderFrom([0, 0, -10]), [1, 0]);

  // Opaque surfaces keep front-to-back so early-z still rejects.
  const opaque = surfaces.map((surface) => ({
    ...surface,
    transparencyClassId: 0,
    depthWriteFlag: 1
  }));
  assert.deepEqual(
    residentSurfaceDrawOrder(opaque, { cameraPositionM: [0, 0, 10] })
      .map((draw) => draw.surfaceIndex),
    [1, 0]
  );

  // With no camera the order degrades to the previous stable behaviour.
  assert.deepEqual(orderFrom(null), [0, 1]);
});
