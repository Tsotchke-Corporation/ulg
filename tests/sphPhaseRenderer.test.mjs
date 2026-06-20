import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as THREE from 'three';
import {
  SPH_PHASE_RENDER_MODE,
  SPH_PHASE_RENDER_ORDER,
  SPH_SCENE_MAX_DEVICE_PIXEL_RATIO,
  SPH_RESIDENT_SURFACE_DRAW_DEPTH_FORMAT,
  SPH_RESIDENT_SURFACE_DRAW_OIT_ACCUM_FORMAT,
  SPH_RESIDENT_SURFACE_DRAW_OIT_COMPOSITE_WGSL,
  SPH_RESIDENT_SURFACE_DRAW_OIT_REVEAL_FORMAT,
  SPH_RESIDENT_SURFACE_DRAW_OVERLAY_WGSL,
  SPH_RESIDENT_SURFACE_DRAW_OVERLAY_MODE_DEFAULT,
  SPH_RESIDENT_SURFACE_DRAW_TEMPORAL_SWAP_POLICY,
  SPH_RESIDENT_RENDER_ROW_OVERLAY_WGSL,
  SPH_CPU_MARCHING_CUBES_RADIUS_FLOOR_CELLS,
  SPH_CPU_MARCHING_CUBES_RESOLUTION_MIN,
  SPH_SPARSE_RENDER_FIELD_RESOLUTION_MIN,
  SPH_SPARSE_SURFACE_RADIUS_SCALE_MAX_PARTICLES,
  SPH_SPARSE_SURFACE_RADIUS_SCALE_MIN,
  SPH_SURFACE_RADIUS_SCALE_DEFAULT,
  SPH_NATIVE_MARCHING_CUBES_VERTEX_ROWS_BYTE_BUDGET_DEFAULT,
  createContinuousSurfaceBatches,
  createResidentMaterialSeedSurfaceBatches,
  resolveSphScenePixelRatio,
  resolveSphSceneViewportSize,
  cpuMarchingCubesCellSizeM,
  cpuMarchingCubesRadiusFloorM,
  createOpticalGpuLookupForSurfaceBatches,
  createOpticalGpuTableForSurfaceBatches,
  createProductEventSurfaceBatches,
  createResidentRenderSourceMetadata,
  resolveThreeWebGpuSurfaceBufferDrawRecords,
  buildSphResidentPressureInterfaceStateSummary,
  hideRenderFieldSurfaceAfterGrace,
  mergeSameMaterialPhaseSurfaceBatchesForRenderField,
  normalizeResidentSurfaceDrawOverlayMode,
  normalizeSphRendererBackend,
  resolveThreeWebGpuPresentationPolicy,
  createThreeWebGpuExternalInterleavedBufferAttribute,
  createThreeWebGpuExternalIndirectBufferAttribute,
  resolveExtensionSurfaceRenderBridgePlan,
  resolveSphSurfaceDrawDiagnosticPresentationMode,
  resolveThreeWebGpuRendererRequiredLimits,
  resolveThreeWebGpuRendererOwnedResidentDevicePolicy,
  resolveResidentExtensionSurfaceRendererCapability,
  resolveResidentSurfaceBufferHandoff,
  resolveResidentSurfaceVisibleGpuConsumer,
  resolveSphNativeWebGpuSurfaceValidationCadence,
  summarizeThreeWebGpuDeviceLimits,
  publishScenePressureInterfaceGasCellFieldImportSource,
  submitSceneSpatialGasLedgerProducerStageForPressureInterface,
  submitSceneGasCellEosProducerStageForPressureInterface,
  residentSurfaceBatchIdentitySignature,
  residentRenderFieldReadbackModeForSurfaceOverlay,
  resolveResidentSurfaceDrawOverlayPolicy,
  renderAlphaFromOpticalResponse,
  renderDepthWriteFromOpticalResponse,
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
  shouldRetainResidentSurfaceDrawOverlay,
  SPH_SURFACE_INACTIVE_GRACE_FRAMES,
  surfaceRadiusScaleForRenderBatch,
  surfaceRadiusMetersFromRenderFieldRadius,
  surfaceObjectRenderOrder,
  stableSurfaceRenderOrder,
  stabilizeRenderRowSphereBridgeMaterial,
  stabilizeSurfaceMeshMaterialForRenderer,
  createThreeWebGpuResidentBridgeMaterialProxy,
  estimateNativeMarchingCubesVertexRowsByteLengthForResolution,
  nativeMarchingCubesRenderFieldResolutionForVertexRowsBudget
} from '../src/visualization/sphPhaseScene.js';
import {
  GPU_PHASE_IDS,
  stableOpticalMaterialId
} from '../src/runtime/material/opticalGpuBuffers.js';
import { residentMotionDiagnostic } from '../src/visualization/sphPhaseDemoMount.js';
import { createMlsMpmGridSpec } from '../src/runtime/sph/sphGridGpuKernel.js';
import {
  ULG_PRESSURE_INTERFACE_GAS_CELL_FIELD_ADMISSION_SCHEMA,
  ULG_PRESSURE_INTERFACE_GAS_CELL_FIELD_IMPORT_SCHEMA,
  ULG_PRESSURE_INTERFACE_RETAINED_GAS_CELL_FIELD_SOURCE_SCHEMA
} from '../src/runtime/sph/sphMlsMpmGpuStep.js';

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

test('SPH native marching-cubes surface resolution budgets conservative vertex rows', () => {
  assert.equal(
    estimateNativeMarchingCubesVertexRowsByteLengthForResolution(64),
    240_045_120
  );

  const defaultResolution = nativeMarchingCubesRenderFieldResolutionForVertexRowsBudget(1);
  const defaultByteLength =
    estimateNativeMarchingCubesVertexRowsByteLengthForResolution(defaultResolution);
  assert.equal(defaultResolution, 33);
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
      ['h2o|h2o|liquid|domain:base', 1, 2, 0, 0.11, [0.3, 0.5, 1]],
      ['h2o|h2o|liquid|domain:drop', 2, 2, 0, 0.21, [0.9, 0.4, 0.6]]
    ]
  );
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
    ]
  });

  const [merged] = mergeSameMaterialPhaseSurfaceBatchesForRenderField(batches);

  assert.equal(merged.surfaceKey, 'h2o|h2o|liquid');
  assert.equal(merged.renderDomainId, 0);
  assert.equal(merged.renderDomainKey, null);
  assert.equal(merged.count, 4);
  assert.equal(merged.positionsM.length, 12);
  assert.equal(merged.normalizedPositions.length, 12);
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

test('SPH phase renderer keeps clear vapor and droplet steam optical states separate', () => {
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
  const table = createOpticalGpuTableForSurfaceBatches(batches);
  const lookup = createOpticalGpuLookupForSurfaceBatches(table, batches);

  assert.equal(batches.length, 2);
  assert.ok(new Set(batches.map((batch) => batch.surfaceKey)).size === 2);
  assert.equal(table.recordCount, 2);
  assert.deepEqual(
    table.recordMetadata.map((record) => record.renderModel).sort(),
    ['molecular-condensed-droplet-scattering-pbr', 'molecular-vapor-transparent-spectrum']
  );
  const clearRecord = table.recordMetadata.find((record) => record.renderModel === 'molecular-vapor-transparent-spectrum');
  const dropletRecord = table.recordMetadata.find((record) => record.renderModel === 'molecular-condensed-droplet-scattering-pbr');
  const clearOffset = clearRecord.recordIndex * table.recordStrideFloats;
  const dropletOffset = dropletRecord.recordIndex * table.recordStrideFloats;
  assert.equal(table.records[clearOffset + 17], 0);
  assert.ok(table.records[clearOffset + 20] < 1e-3);
  assert.ok(table.records[dropletOffset + 17] > 0);
  assert.ok(table.records[dropletOffset + 20] > 0);
  assert.deepEqual(
    lookup.cpuReference.outputs.filter((_, index) => index % lookup.lookup.outputStrideFloats === 11),
    new Float32Array([0, 1])
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

test('SPH renderer keeps condensed transmissive H2O geometrically visible', () => {
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
  assert.equal(renderAlphaFromOpticalResponse(vaporOptics, vaporOptics), vaporOptics.opacity);
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
    opacity: 0.006,
    opticalDepth: 0.006
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
    optics: { ...clearVapor, opacity: 0.02, opticalDepth: 0.02 },
    descriptorOrRow: clearVapor
  });
  const shownByDroplets = resolveOpticalSurfaceVisibility({
    optics: condensedSteam,
    descriptorOrRow: condensedSteam
  });
  const liquid = resolveOpticalSurfaceVisibility({ optics: water, descriptorOrRow: water });

  assert.equal(hidden.visible, false);
  assert.equal(hidden.reason, 'derived-pure-vapor-optically-thin');
  assert.equal(hidden.retainPreviousSurface, false);
  assert.equal(retained.visible, true);
  assert.equal(retained.reason, 'derived-vapor-optical-depth-visible');
  assert.equal(shownByDepth.visible, true);
  assert.equal(shownByDepth.reason, 'derived-vapor-optical-depth-visible');
  assert.equal(shownByDroplets.visible, true);
  assert.equal(shownByDroplets.reason, 'derived-droplet-scattering-visible');
  assert.equal(liquid.visible, true);
  assert.equal(liquid.reason, 'non-vapor-surface');
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

test('SPH renderer leaves transparent same-layer meshes depth-sortable', () => {
  const baseOrder = SPH_PHASE_RENDER_ORDER.transmissiveSurface;

  assert.equal(
    surfaceObjectRenderOrder(baseOrder, 'front-water', {
      renderLayer: 'transmissive-surface',
      depthWrite: false
    }),
    baseOrder
  );
  assert.equal(
    surfaceObjectRenderOrder(baseOrder, 'back-water', {
      renderLayer: 'transmissive-surface',
      depthWrite: false
    }),
    baseOrder
  );
  assert.notEqual(
    surfaceObjectRenderOrder(baseOrder, 'depth-writing-water-a', {
      renderLayer: 'transmissive-surface',
      depthWrite: true
    }),
    surfaceObjectRenderOrder(baseOrder, 'depth-writing-water-b', {
      renderLayer: 'transmissive-surface',
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
    { surfaceIndex: 0, renderOrder: 300, transparencyClassId: 3, depthWriteFlag: 0 },
    { surfaceIndex: 1, renderOrder: 100, transparencyClassId: 0, depthWriteFlag: 1 },
    { surfaceIndex: 2, renderOrder: 200, transparencyClassId: 2, depthWriteFlag: 0 }
  ], { indirectStrideBytes: 16 });

  assert.deepEqual(order.map((row) => row.surfaceIndex), [1, 2, 0]);
  assert.deepEqual(order.map((row) => row.indirectOffsetBytes), [16, 32, 0]);
  assert.deepEqual(order.map((row) => row.renderOrder), [100, 200, 300]);
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
  assert.equal(residentSurfaceDrawPipelineKey(order[1]), 'transparent-depth-test');
  assert.equal(SPH_RESIDENT_SURFACE_DRAW_DEPTH_FORMAT, 'depth24plus');
  assert.equal(SPH_RESIDENT_SURFACE_DRAW_OIT_ACCUM_FORMAT, 'rgba16float');
  assert.equal(SPH_RESIDENT_SURFACE_DRAW_OIT_REVEAL_FORMAT, 'rgba8unorm');
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

test('SPH Three render-row particle modes retain previous bridge on no-full refresh', () => {
  const retained = resolveResidentRenderRowBridgeReadbackPlan({
    requestedRenderRowsReadbackMode: 'no-full-readback',
    useThreeRenderRowBridge: true,
    previousThreeRenderRowBridgeVisible: true
  });

  assert.equal(retained.requestedRenderRowsReadbackModeFromCaller, 'no-full-readback');
  assert.equal(retained.requestedRenderRowsReadbackMode, 'no-full-readback');
  assert.equal(retained.retainPreviousThreeRenderRowBridgeNoFull, true);
  assert.equal(retained.freshPhysicsReadbackRequired, false);
  assert.equal(
    retained.renderRowsReadbackModeCoercionReason,
    'three-render-row-bridge-retains-previous-no-full-readback'
  );

  const webgpu = resolveResidentRenderRowBridgeReadbackPlan({
    requestedRenderRowsReadbackMode: 'no-full-readback',
    useWebGpuRenderRowOverlayBridge: true
  });

  assert.equal(webgpu.requestedRenderRowsReadbackMode, 'no-full-readback');
  assert.equal(webgpu.webGpuOverlayNoFullReadback, true);
  assert.equal(webgpu.retainPreviousThreeRenderRowBridgeNoFull, false);
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
  assert.match(SPH_RESIDENT_SURFACE_DRAW_OVERLAY_WGSL, /fn spectral_wavelength_rgb/);
  assert.match(SPH_RESIDENT_SURFACE_DRAW_OVERLAY_WGSL, /fn spectral_tint_from_samples/);
  assert.match(SPH_RESIDENT_SURFACE_DRAW_OVERLAY_WGSL, /base_color_linear/);
  assert.match(SPH_RESIDENT_SURFACE_DRAW_OVERLAY_WGSL, /transmissive_surface_alpha/);
  assert.match(SPH_RESIDENT_SURFACE_DRAW_OVERLAY_WGSL, /clip\.z = clip\.z \* 0\.5 \+ clip\.w \* 0\.5/);
  assert.match(SPH_RESIDENT_SURFACE_DRAW_OVERLAY_WGSL, /fn fs_oit_main/);
  assert.match(SPH_RESIDENT_SURFACE_DRAW_OVERLAY_WGSL, /struct OitFragmentOut/);
  assert.match(SPH_RESIDENT_SURFACE_DRAW_OVERLAY_WGSL, /attenuation_linear/);
  assert.match(SPH_RESIDENT_SURFACE_DRAW_OVERLAY_WGSL, /optical_depth/);
  assert.match(SPH_RESIDENT_SURFACE_DRAW_OVERLAY_WGSL, /dielectric_f0/);
  assert.match(SPH_RESIDENT_SURFACE_DRAW_OVERLAY_WGSL, /scattering_coefficient_per_m/);
  assert.match(SPH_RESIDENT_SURFACE_DRAW_OIT_COMPOSITE_WGSL, /accum_texture/);
  assert.match(SPH_RESIDENT_SURFACE_DRAW_OIT_COMPOSITE_WGSL, /reveal_texture/);
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

test('SPH render-row sphere bridge brightens dark transmissive proxy materials on mobile', () => {
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

  assert.equal(material.transmission, 0);
  assert.ok(material.opacity >= 0.72);
  assert.ok(material.color.r + material.color.g + material.color.b > 0.4);
  assert.equal(material.userData.renderRowSphereFallbackReason, 'transmissive-proxy-low-luminance');
});

test('SPH render-row sphere bridge uses closure-derived visible proxy for metallic particles', () => {
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

  stabilizeRenderRowSphereBridgeMaterial(material, {
    descriptor: { material: 'Na', renderKey: 'Na', phase: 'solid' },
    fallbackColorSrgb: [0.99, 0.94, 0.92]
  });

  assert.equal(material.userData.renderRowSphereMetallicVisibilityProxy, true);
  assert.equal(material.userData.renderRowSphereOriginalMetalness, 1);
  assert.equal(material.userData.renderRowSphereFallbackReason, 'metallic-sphere-visibility-proxy');
  assert.deepEqual(material.userData.renderRowSphereFallbackColor, [0.99, 0.94, 0.92]);
  assert.ok(material.metalness <= 0.58);
  assert.ok(material.roughness >= 0.34);
  assert.ok(material.envMapIntensity >= 1.45);
  assert.ok(material.color.r + material.color.g + material.color.b > 0.6);
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

test('SPH render-row sphere bridge keeps air particle PBR visible without metallic fallback', () => {
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
  assert.equal(material.userData.renderRowSphereFallbackReason, undefined);
  assert.equal(material.userData.optical.renderModel, 'gas-rayleigh-transparent-pbr');
  assert.equal(material.metalness, 0);
  assert.equal(material.transmission, 0);
  assert.equal(material.thickness, 0);
  assert.ok(material.opacity >= 0.66);
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
  assert.equal(proxy.userData.renderRowSphereFallbackReason, 'metallic-sphere-visibility-proxy');
  assert.deepEqual(proxy.userData.surfaceMaterialFallbackColor, [0.99, 0.94, 0.92]);
  assert.ok(proxy.color.r + proxy.color.g + proxy.color.b > 0.6);
});

test('SPH Three WebGPU render-row sphere proxy keeps air closure PBR visible', () => {
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
  assert.ok(proxy.opacity >= 0.66);
  assert.equal(proxy.userData.renderRowSphereMaterialRendererProxy, true);
  assert.equal(proxy.userData.renderRowSpherePbrMaterialSource, 'closure-derived-pbr-proxied-for-renderer');
  assert.equal(proxy.userData.optical.renderModel, 'gas-rayleigh-transparent-pbr');
  assert.equal(proxy.userData.renderRowSphereMetallicVisibilityProxy, undefined);
  assert.equal(proxy.userData.renderRowSphereFallbackReason, undefined);
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
      sourceRenderFieldSchema: 'peercompute.ulg.sph-gpu-render-field.v0',
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
  assert.equal(renderFieldReady.directConsumerInputSchema, 'peercompute.ulg.sph-gpu-render-field.v0');
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
  assert.match(retainedSurfaceDraw.sourceResidentRetentionReason, /previous native surface/);
});

test('SPH visible GPU surface consumer requires renderer and pixel validation', () => {
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

  const nativePixelBlocked = resolveResidentSurfaceVisibleGpuConsumer({
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
  assert.equal(nativePixelBlocked.ready, false);
  assert.equal(
    nativePixelBlocked.status,
    'resident-surface-visible-gpu-consumer-blocked-pixel-validation'
  );
  assert.equal(nativePixelBlocked.runtimeConsumerReady, true);
  assert.equal(nativePixelBlocked.renderBridgeBound, true);

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
    'resident-surface-visible-gpu-consumer-blocked-pixel-validation'
  );
  assert.equal(
    nativeBrowserFrameValidationRequired.nativeSurfaceConsumerValidationBlockerFamily,
    'browser-frame-validation-required'
  );
  assert.equal(nativeBrowserFrameValidationRequired.nativeSurfaceConsumerTextureReadbackUnavailable, false);

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
    'resident-surface-visible-gpu-consumer-blocked-pixel-validation'
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
  assert.equal(nativeReadbackPassedFallback.ready, true);
  assert.equal(nativeReadbackPassedFallback.status, 'resident-surface-visible-gpu-consumer-ready');
  assert.equal(nativeReadbackPassedFallback.pixelValidationRequired, false);
  assert.equal(nativeReadbackPassedFallback.nativeReadbackFallbackValidated, true);

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
    'resident-surface-visible-gpu-consumer-blocked-pixel-validation'
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
    'resident-surface-visible-gpu-consumer-blocked-pixel-validation'
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
    'resident-surface-visible-gpu-consumer-blocked-pixel-validation'
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
  assert.equal(nativeValidated.ready, true);
  assert.equal(nativeValidated.status, 'resident-surface-visible-gpu-consumer-ready');
  assert.equal(nativeValidated.pixelValidated, true);

  const renderFieldBlocked = resolveResidentSurfaceVisibleGpuConsumer({
    handoff: resolveResidentSurfaceBufferHandoff({
      readbackMode: 'no-full-readback',
      surfaceDraw: {
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

test('SPH native WebGPU surface validation cadence stops after pass or retry exhaustion', () => {
  const initial = resolveSphNativeWebGpuSurfaceValidationCadence({
    rendererBridge: 'native-webgpu-surface-consumer',
    submittedDrawCount: 4,
    bridgeFormat: 'bgra8unorm',
    readbackSmokeValidationStatus: 'not-run',
    readbackSmokeValidationAttemptCount: 0,
    offscreenValidationStatus: 'not-run',
    offscreenValidationAttemptCount: 0
  });
  assert.equal(initial.validationEncoderRequired, true);
  assert.equal(initial.readbackSmokeValidationNeeded, true);
  assert.equal(initial.offscreenValidationNeeded, true);
  assert.equal(initial.offscreenValidationEligible, true);
  assert.equal(initial.validationScope, 'native-surface-draw');
  assert.equal(initial.status, 'native-webgpu-surface-validation-needed');

  const browserFrameValidation = resolveSphNativeWebGpuSurfaceValidationCadence({
    bridge: {
      rendererBridge: 'native-webgpu-surface-consumer',
      format: 'bgra8unorm',
      enableRuntimePixelReadback: false,
      readbackSmokeValidationStatus: 'not-run',
      offscreenValidationStatus: 'not-run'
    },
    submittedDrawCount: 4
  });
  assert.equal(browserFrameValidation.validationEncoderRequired, false);
  assert.equal(browserFrameValidation.sameDeviceReadbackValidationEnabled, false);
  assert.equal(browserFrameValidation.readbackSmokeValidationNeeded, false);
  assert.equal(browserFrameValidation.offscreenValidationNeeded, false);
  assert.equal(browserFrameValidation.offscreenValidationEligible, true);
  assert.equal(
    browserFrameValidation.status,
    'native-webgpu-surface-validation-browser-frame-required'
  );
  assert.match(
    browserFrameValidation.reason,
    /browser harness composited-frame analysis owns visible-output validation/
  );
  assert.match(
    browserFrameValidation.offscreenValidationSkippedReason,
    /same-device validation readback is disabled/
  );

  const debugClearOnly = resolveSphNativeWebGpuSurfaceValidationCadence({
    rendererBridge: 'native-webgpu-surface-consumer',
    submittedDrawCount: 0,
    debugClearOnly: true,
    bridgeFormat: 'bgra8unorm',
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
    rendererBridge: 'native-webgpu-surface-consumer',
    submittedDrawCount: 0,
    debugClearOnly: true,
    bridgeFormat: 'bgra8unorm',
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
    rendererBridge: 'native-webgpu-surface-consumer',
    submittedDrawCount: 0,
    bridgeFormat: 'bgra8unorm',
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
    rendererBridge: 'native-webgpu-surface-consumer',
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

  const exhausted = resolveSphNativeWebGpuSurfaceValidationCadence({
    rendererBridge: 'native-webgpu-surface-consumer',
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
    rendererBridge: 'native-webgpu-surface-consumer',
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

test('SPH renderer depth policy separates transmissive glass from alpha transparency', () => {
  const opaqueMetal = {
    material: 'fe',
    phase: 'solid',
    opacity: 1,
    transmission: 0,
    metalness: 1
  };
  const condensedWater = {
    material: 'h2o',
    phase: 'liquid',
    opacity: 0.0028,
    transmission: 0.977,
    metalness: 0
  };
  const vapor = {
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
  const alphaSurface = {
    material: 'generic',
    phase: 'liquid',
    opacity: 0.5,
    transmission: 0,
    metalness: 0
  };

  assert.equal(renderDepthWriteFromOpticalResponse(opaqueMetal, opaqueMetal), true);
  assert.equal(renderLayerFromOpticalResponse(opaqueMetal, opaqueMetal), 'opaque-surface');
  assert.equal(renderOrderFromOpticalResponse(opaqueMetal, opaqueMetal), SPH_PHASE_RENDER_ORDER.opaqueSurface);

  assert.equal(renderDepthWriteFromOpticalResponse(condensedWater, condensedWater), true);
  assert.equal(renderLayerFromOpticalResponse(condensedWater, condensedWater), 'transmissive-surface');
  assert.equal(renderOrderFromOpticalResponse(condensedWater, condensedWater), SPH_PHASE_RENDER_ORDER.transmissiveSurface);

  assert.equal(renderDepthWriteFromOpticalResponse(vapor, vapor), false);
  assert.equal(renderLayerFromOpticalResponse(vapor, vapor), 'vapor-surface');
  assert.equal(renderOrderFromOpticalResponse(vapor, vapor), SPH_PHASE_RENDER_ORDER.vaporSurface);

  assert.equal(renderDepthWriteFromOpticalResponse(transparentSolid, transparentSolid), true);
  assert.equal(renderLayerFromOpticalResponse(transparentSolid, transparentSolid), 'transmissive-surface');
  assert.equal(renderOrderFromOpticalResponse(transparentSolid, transparentSolid), SPH_PHASE_RENDER_ORDER.transmissiveSurface);

  assert.equal(renderDepthWriteFromOpticalResponse(alphaSurface, alphaSurface), false);
  assert.equal(renderLayerFromOpticalResponse(alphaSurface, alphaSurface), 'alpha-surface');
  assert.equal(renderOrderFromOpticalResponse(alphaSurface, alphaSurface), SPH_PHASE_RENDER_ORDER.alphaSurface);
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
    schema: 'peercompute.ulg.sph-gpu-reaction-table.v0',
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
