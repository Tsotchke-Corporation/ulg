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
  compositePageVisibleGpuReadbackTelemetryEvidence,
  createSphPendingBodyEnvelopePreview,
  isSphNativeSurfaceCameraPresentationSnapshotStale,
  normalizeSphResidentPresentationProofWaitTimeout,
  resolveSphNativeSurfaceCameraRetryEligibility,
  resolveSphNativeSurfaceCameraPresentationRecoveryEligibility,
  resolveSphNativeSurfaceCandidateCompletionRequestSelection,
  resolveSphNativeSurfaceLatePresentationSuccessEligibility,
  resolveSphNativeSurfacePostStepPresentationGateSettlement,
  resolveSphNativeSurfaceStartupPresentationGateSettlement,
  resolveSphResidentParticleBridgeStartupPreflight,
  resolveSphNativeSurfaceCandidateCompletionHandoff,
  resolveSphResidentPresentationProof,
  resolveSphInitialPresentationSchedulePlan,
  resolveSphNativeSurfaceCadenceRefreshPolicy,
  resolveSphNativeSurfaceStartupRefreshCoalescing,
  resolveSphRendererSurfaceStartupSelection,
  resolveSphNativeWebGpuStartupPreflight,
  resolveSphResidentScheduleAdmission,
  resolveSphResidentScheduleStepCount,
  resolveSphSimulationRuntimePrerequisite,
  isSphResidentTerminalAutoScheduleError,
  residentSurfaceDrawInitialVisualRefreshPlan,
  residentGpuContinuationEvidenceReady,
  residentGpuResidencyWarningMessage,
  resolveMountedWorkerPressureInterfaceGasCellImportDescriptor,
  runRemoteResidentTaskGraphRefreshPrelude,
  summarizeMountedPressureInterfaceGasCellImport,
  summarizeResidentStageOrderExecution,
  sphNativeSurfaceCameraPresentationFingerprintsMatch,
  workerRebuildResetGate
} from '../src/visualization/sphPhaseDemoMount.js';
import {
  SPH_NATIVE_SURFACE_CAMERA_SNAPSHOT_ABSOLUTE_TOLERANCE,
  sphNativeSurfaceCandidatePresentationNumberListsMatch,
  SPH_NATIVE_SURFACE_CAMERA_SNAPSHOT_STALE_ERROR_CODE
} from '../src/visualization/sphPhaseScene.js';
import {
  GPU_READBACK_TELEMETRY_SCHEMA,
  createGpuReadbackTelemetry
} from '../src/runtime/sph/sphGpuReadbackTelemetry.js';
import { SPH_INITIAL_BODIES_SCHEMA } from '../src/runtime/sphInitialBodies.js';

test('mounted canonical SS playback advances one immutable position epoch per schedule', () => {
  // Direct SS route: one sealed epoch per schedule, always.
  assert.equal(resolveSphResidentScheduleStepCount({
    requestedStepCount: 128,
    schroederSimulationEnabled: true
  }), 1);
  assert.equal(resolveSphResidentScheduleStepCount({
    requestedStepCount: 128,
    schroederSimulationEnabled: false
  }), 128);
  assert.equal(resolveSphResidentScheduleStepCount({
    requestedStepCount: 0,
    schroederSimulationEnabled: false
  }), 1);
});

test('mounted worker-owned resident lane lifts the SS one-epoch throttle to legal batches', () => {
  // W4b: each worker schedule step builds and seals its own epoch (the W2
  // driver fails closed with 'epoch-identity-regressed' otherwise), so the
  // normalized batch count passes through when the worker lane is active.
  assert.equal(resolveSphResidentScheduleStepCount({
    requestedStepCount: 16,
    schroederSimulationEnabled: true,
    workerLaneActive: true
  }), 16);
  // The resident-schedule cap still binds worker-lane batches.
  assert.equal(resolveSphResidentScheduleStepCount({
    requestedStepCount: 500,
    schroederSimulationEnabled: true,
    workerLaneActive: true
  }), 128);
  // The lane flag alone never affects the non-SS path.
  assert.equal(resolveSphResidentScheduleStepCount({
    requestedStepCount: 8,
    schroederSimulationEnabled: false,
    workerLaneActive: true
  }), 8);
  // And an inactive lane keeps the direct SS pin.
  assert.equal(resolveSphResidentScheduleStepCount({
    requestedStepCount: 16,
    schroederSimulationEnabled: true,
    workerLaneActive: false
  }), 1);
});

test('mounted worker pressure transport remains limited to explicit v1 and Schroeder descriptors', () => {
  const retainedV1 = {
    schema: 'peercompute.ulg.sph-retained-gas-cell-eos-source.v1',
    status: 'retained-gas-cell-eos-source-submitted',
    retainedGasPressureBufferRefs: ['resident-pressure-v1'],
    workerRetainedGasPressureBufferRefs: ['worker-pressure-v1'],
    pressureInterfaceGasPressureCellRowCount: 2,
    pressureInterfaceGasPressureCellRowStrideFloats: 12,
    pressureInterfaceGasPressureCellRowByteLength: 96,
    pressureInterfaceGasPressureCellRowsBufferRetained: true,
    pressureFieldMode: 'local-gas-cell-pressure-gradient'
  };
  const v1Admission = {
    schema: 'peercompute.ulg.pressure-interface-gas-cell-field-admission.v0',
    status: 'pressure-interface-gas-cell-field-consumption-approved',
    gasCellFieldConsumptionApproved: true,
    retainedGasCellFieldSource: retainedV1
  };
  const v1Import = {
    schema: 'peercompute.ulg.pressure-interface-gas-cell-field-import.v0',
    status: 'pressure-interface-gas-cell-field-import-ready',
    sourceTaskId: 'mounted-pressure-v1',
    retainedGasPressureBufferRefs: ['resident-pressure-v1'],
    workerRetainedGasPressureBufferRefs: ['worker-pressure-v1'],
    pressureInterfaceGasPressureCellRowCount: 2,
    pressureInterfaceGasPressureCellRowStrideFloats: 12,
    pressureInterfaceGasPressureCellRowByteLength: 96,
    retainedGasCellFieldSource: retainedV1,
    pressureInterfaceGasCellFieldAdmission: v1Admission
  };
  const v1Descriptor =
    resolveMountedWorkerPressureInterfaceGasCellImportDescriptor({
      source: v1Import
    });
  assert.equal(v1Descriptor.status, 'pressure-interface-gas-cell-field-import-ready');
  assert.notEqual(v1Descriptor.retainedGasCellFieldSource, retainedV1);
  assert.equal(v1Descriptor.pressureInterfaceGasPressureCellRowCount, 2);
  assert.deepEqual(
    v1Descriptor.workerRetainedGasPressureBufferRefs,
    ['worker-pressure-v1']
  );
  let schemaDescriptorCalls = 0;
  const changingV1Proxy = new Proxy(v1Import, {
    getOwnPropertyDescriptor(target, key) {
      if (key === 'schema') {
        schemaDescriptorCalls += 1;
        if (schemaDescriptorCalls > 1) {
          return {
            configurable: true,
            enumerable: true,
            writable: true,
            value: 'peercompute.ulg.sph-retained-gas-cell-eos-source.v4'
          };
        }
      }
      return Reflect.getOwnPropertyDescriptor(target, key);
    },
    get() {
      throw new Error('mounted legacy descriptor was read after capture');
    }
  });
  const capturedV1Descriptor =
    resolveMountedWorkerPressureInterfaceGasCellImportDescriptor({
      source: changingV1Proxy
    });
  assert.equal(
    capturedV1Descriptor.status,
    'pressure-interface-gas-cell-field-import-ready'
  );
  assert.equal(schemaDescriptorCalls, 1);

  const schroederImport = {
    schema: 'peercompute.ulg.schroeder-far-aggregate-gas-cell-import-execution.v0',
    status: 'schroeder-far-aggregate-gas-cell-import-submitted',
    pressureInterfaceImportReady: true,
    retainedGasPressureBufferRefs: ['resident-pressure-schroeder'],
    workerRetainedGasPressureBufferRefs: ['worker-pressure-schroeder'],
    pressureInterfaceGasPressureCellRowCount: 3,
    pressureInterfaceGasPressureCellRowStrideFloats: 12,
    pressureInterfaceGasPressureCellRowByteLength: 144,
    pressureInterfaceGasCellFieldAdmission: {
      schema: 'peercompute.ulg.pressure-interface-gas-cell-field-admission.v0',
      status: 'pressure-interface-gas-cell-field-consumption-approved',
      gasCellFieldConsumptionApproved: true
    }
  };
  const schroederDescriptor =
    resolveMountedWorkerPressureInterfaceGasCellImportDescriptor({
      source: schroederImport
    });
  assert.equal(
    schroederDescriptor.status,
    'pressure-interface-gas-cell-field-import-ready'
  );
  assert.equal(
    schroederDescriptor.pressureInterfaceGasPressureCellRowCount,
    3
  );
});

test('mounted pressure boundaries contain hostile getters, forged v4 masks, cycles, and graph bounds', () => {
  let getterCalls = 0;
  const forgedV4 = {
    schema: 'peercompute.ulg.sph-retained-gas-cell-eos-source.v4',
    status: 'retained-gas-cell-eos-source-submitted',
    ready: true
  };
  for (const key of [
    'gasPressureCellsBuffer',
    'retainedGasPressureCellsBuffer',
    'gasAuthorityControlBuffer',
    'releaseScheduled'
  ]) {
    Object.defineProperty(forgedV4, key, {
      enumerable: true,
      get() {
        getterCalls += 1;
        throw new Error(`mounted hostile v4 getter: ${key}`);
      }
    });
  }
  assert.equal(
    resolveMountedWorkerPressureInterfaceGasCellImportDescriptor({
      source: forgedV4
    }),
    null
  );
  const forgedTelemetry = summarizeMountedPressureInterfaceGasCellImport({
    importDescriptor: forgedV4
  });
  assert.equal(forgedTelemetry.pressureInterfaceGasCellFieldImportAvailable, false);
  assert.equal(
    forgedTelemetry.pressureInterfaceGasCellFieldImportStatus,
    'blocked-forged-v4-gas-pressure-authority'
  );
  assert.equal(getterCalls, 0);

  const hostileSchema = {};
  Object.defineProperty(hostileSchema, 'schema', {
    enumerable: true,
    get() {
      getterCalls += 1;
      throw new Error('mounted hostile schema getter');
    }
  });
  assert.doesNotThrow(() => {
    assert.equal(
      resolveMountedWorkerPressureInterfaceGasCellImportDescriptor({
        source: hostileSchema
      }),
      null
    );
  });
  assert.equal(getterCalls, 0);

  const cyclic = { schema: 'peercompute.ulg.pressure-interface-gas-cell-field-import.v0' };
  cyclic.admission = cyclic;
  assert.doesNotThrow(() => {
    assert.equal(
      resolveMountedWorkerPressureInterfaceGasCellImportDescriptor({
        source: cyclic
      }),
      null
    );
  });
  let bounded = forgedV4;
  for (let index = 0; index < 65; index += 1) {
    bounded = { retainedGasCellFieldSource: bounded };
  }
  assert.doesNotThrow(() => {
    assert.equal(
      resolveMountedWorkerPressureInterfaceGasCellImportDescriptor({
        source: bounded
      }),
      null
    );
    assert.equal(
      summarizeMountedPressureInterfaceGasCellImport({
        importDescriptor: bounded
      }).pressureInterfaceGasCellFieldImportAvailable,
      false
    );
  });
  assert.equal(getterCalls, 0);
});

test('mounted resident scheduling coalesces identical work and preserves forced latest-wins', () => {
  assert.deepEqual(resolveSphResidentScheduleAdmission({
    signature: 'same',
    pendingSignature: 'same',
    force: false
  }), {
    admit: false,
    status: 'resident-schedule-coalesced-identical-pending'
  });
  assert.deepEqual(resolveSphResidentScheduleAdmission({
    signature: 'same',
    pendingSignature: 'same',
    force: true
  }), {
    admit: false,
    status: 'resident-schedule-coalesced-identical-pending'
  });
  assert.deepEqual(resolveSphResidentScheduleAdmission({
    signature: 'new',
    pendingSignature: 'old',
    force: false
  }), {
    admit: false,
    status: 'resident-schedule-held-behind-different-pending'
  });
  assert.deepEqual(resolveSphResidentScheduleAdmission({
    signature: 'new',
    pendingSignature: 'old',
    force: true
  }), {
    admit: true,
    status: 'resident-schedule-admitted-forced-latest-wins'
  });
});

test('mounted resident autoplay stops only for this invocation current-generation terminal error', () => {
  const invocationProgress = {
    status: 'resident-steps-submitted',
    signature: 'resident-step:4',
    residentExecutionGeneration: 4,
    currentResidentExecutionGeneration: 4
  };
  const currentProgress = {
    status: 'resident-steps-error',
    signature: 'resident-step:4',
    residentExecutionGeneration: 4,
    currentResidentExecutionGeneration: 4
  };

  assert.equal(isSphResidentTerminalAutoScheduleError({
    scheduleIsCurrent: true,
    invocationProgress,
    currentProgress
  }), true);
  assert.equal(isSphResidentTerminalAutoScheduleError({
    scheduleIsCurrent: false,
    invocationProgress,
    currentProgress
  }), false);
  assert.equal(isSphResidentTerminalAutoScheduleError({
    scheduleIsCurrent: true,
    invocationProgress,
    currentProgress: {
      ...currentProgress,
      currentResidentExecutionGeneration: 5
    }
  }), false);
  assert.equal(isSphResidentTerminalAutoScheduleError({
    scheduleIsCurrent: true,
    invocationProgress,
    currentProgress: invocationProgress
  }), false);
  assert.equal(isSphResidentTerminalAutoScheduleError({
    scheduleIsCurrent: true,
    invocationProgress,
    currentProgress: {
      ...currentProgress,
      signature: 'resident-step:other'
    }
  }), false);
});

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

test('native startup presentation gate releases physics after bounded proof failure', () => {
  const gate = Object.freeze({
    schema: 'peercompute.ulg.sph-native-surface-startup-presentation-gate.v0',
    status: 'native-surface-startup-initial-presentation-pending',
    active: true,
    generation: 7
  });
  const timeout = resolveSphNativeSurfaceStartupPresentationGateSettlement({
    gate,
    generation: 7,
    currentGeneration: 7,
    presentationVisible: false,
    presentationProof: {
      admitted: false,
      foregroundProved: false,
      status: 'native-resident-presentation-unadmitted',
      sourceCurrent: false
    },
    presentationProofWait: {
      status: 'resident-presentation-proof-wait-timeout'
    },
    updatedAtMs: 1234
  });
  assert.equal(timeout.active, false);
  assert.equal(
    timeout.status,
    'native-surface-startup-initial-presentation-timeout-fail-open'
  );
  assert.equal(timeout.livenessFailOpen, true);
  assert.equal(timeout.residentPlaybackReleased, true);
  assert.equal(timeout.startupPresentationAdmitted, false);
  assert.equal(timeout.startupPresentationProved, false);
  assert.equal(timeout.presentationSourceCurrent, false);
  assert.equal(
    timeout.presentationProofStatus,
    'native-resident-presentation-unadmitted'
  );
  assert.equal(
    timeout.presentationProofWaitStatus,
    'resident-presentation-proof-wait-timeout'
  );
  assert.equal(timeout.releasedAtMs, 1234);
  assert.equal(Object.isFrozen(timeout), true);

  const error = resolveSphNativeSurfaceStartupPresentationGateSettlement({
    gate,
    generation: 7,
    currentGeneration: 7,
    refreshError: 'device queue rejected the startup presentation',
    updatedAtMs: 1235
  });
  assert.equal(
    error.status,
    'native-surface-startup-initial-presentation-error-fail-open'
  );
  assert.equal(error.active, false);
  assert.equal(error.livenessFailOpen, true);
  assert.match(error.reason, /released to preserve simulation liveness/);
  assert.equal(
    error.refreshError,
    'device queue rejected the startup presentation'
  );

  const unproved = resolveSphNativeSurfaceStartupPresentationGateSettlement({
    gate,
    generation: 7,
    currentGeneration: 7,
    presentationVisible: false,
    presentationProof: {
      admitted: false,
      foregroundProved: false,
      status: 'native-resident-presentation-unadmitted',
      sourceCurrent: false
    },
    presentationProofWait: {
      status: 'resident-presentation-proof-wait-stale-or-complete'
    },
    updatedAtMs: 1236
  });
  assert.equal(
    unproved.status,
    'native-surface-startup-initial-presentation-unadmitted-fail-open'
  );
  assert.equal(unproved.active, false);
  assert.equal(unproved.livenessFailOpen, true);
  assert.equal(unproved.residentPlaybackReleased, true);

  const pending = resolveSphNativeSurfaceStartupPresentationGateSettlement({
    gate,
    generation: 7,
    currentGeneration: 7,
    presentationVisible: false,
    presentationProof: {
      admitted: false,
      foregroundProved: false,
      status: 'native-resident-presentation-unadmitted'
    }
  });
  assert.equal(pending, gate);
});

test('native startup presentation gate preserves admission and pixel proof separately', () => {
  const gate = Object.freeze({
    schema: 'peercompute.ulg.sph-native-surface-startup-presentation-gate.v0',
    status: 'native-surface-startup-initial-presentation-pending',
    active: true,
    generation: 7
  });
  const proved = resolveSphNativeSurfaceStartupPresentationGateSettlement({
    gate,
    generation: 7,
    currentGeneration: 7,
    presentationAdmitted: true,
    presentationVisible: true,
    presentationProof: {
      admitted: true,
      visible: true,
      foregroundProved: true,
      status: 'native-resident-presentation-foreground-proved',
      sourceCurrent: true
    },
    updatedAtMs: 1234
  });
  assert.equal(proved.active, false);
  assert.equal(
    proved.status,
    'native-surface-startup-initial-presentation-admitted'
  );
  assert.equal(proved.startupPresentationAdmitted, true);
  assert.equal(proved.startupPresentationProved, true);
  assert.equal(proved.livenessFailOpen, false);
  assert.equal(proved.presentationSourceCurrent, true);

  const structurallyAdmitted = resolveSphNativeSurfaceStartupPresentationGateSettlement({
    gate,
    generation: 7,
    currentGeneration: 7,
    presentationAdmitted: true,
    presentationVisible: false,
    presentationProof: {
      admitted: true,
      visible: false,
      foregroundProved: false,
      status: 'native-resident-presentation-submission-admitted',
      sourceCurrent: true
    },
    updatedAtMs: 1235
  });
  assert.equal(
    structurallyAdmitted.status,
    'native-surface-startup-initial-presentation-admitted'
  );
  assert.equal(structurallyAdmitted.startupPresentationAdmitted, true);
  assert.equal(structurallyAdmitted.startupPresentationProved, false);
  assert.equal(structurallyAdmitted.livenessFailOpen, false);

  const contradictoryStructuralProof =
    resolveSphNativeSurfaceStartupPresentationGateSettlement({
      gate,
      generation: 7,
      currentGeneration: 7,
      presentationAdmitted: true,
      presentationVisible: true,
      presentationProof: {
        admitted: true,
        visible: true,
        foregroundProved: true,
        status: 'native-resident-presentation-submission-admitted',
        sourceCurrent: true
      },
      updatedAtMs: 1236
    });
  assert.equal(contradictoryStructuralProof.startupPresentationAdmitted, true);
  assert.equal(contradictoryStructuralProof.startupPresentationProved, false);

  const stale = resolveSphNativeSurfaceStartupPresentationGateSettlement({
    gate,
    generation: 7,
    currentGeneration: 8,
    presentationVisible: false,
    presentationProof: {
      status: 'resident-presentation-proof-wait-timeout'
    }
  });
  assert.equal(stale, gate);
  assert.equal(stale.active, true);

  const falseGeneration = resolveSphNativeSurfaceStartupPresentationGateSettlement({
    gate: { ...gate, generation: false },
    generation: false,
    currentGeneration: false,
    presentationVisible: false
  });
  assert.equal(falseGeneration.active, true);

  const coercibleGeneration =
    resolveSphNativeSurfaceStartupPresentationGateSettlement({
      gate: { ...gate, generation: '7' },
      generation: '7',
      currentGeneration: '7',
      presentationProofWait: {
        status: 'resident-presentation-proof-wait-timeout'
      }
    });
  assert.equal(coercibleGeneration.active, true);
});

test('native post-step presentation gate releases playback after one bounded exact-proof attempt', () => {
  const gate = Object.freeze({
    schema: 'peercompute.ulg.sph-native-surface-post-step-presentation-gate.v0',
    status: 'native-surface-post-step-presentation-proof-pending',
    active: true,
    generation: 9,
    scheduleToken: 41,
    requestToken: 17,
    candidateGeneration: 22,
    lifecycleGeneration: 8,
    sourceResidentExecutionGeneration: 91,
    sourceResidentStepsSignature: 'steps-signature',
    sourceResidentStepSignature: 'step-signature',
    retryAttempt: 2,
    failureCode: 'camera-snapshot-stale',
    startedAtMs: 1000,
    updatedAtMs: 1001
  });
  const timeout = resolveSphNativeSurfacePostStepPresentationGateSettlement({
    gate,
    generation: 9,
    currentGeneration: 9,
    scheduleToken: 41,
    currentScheduleToken: 41,
    presentationProof: {
      admitted: false,
      foregroundProved: false,
      status: 'native-resident-presentation-unadmitted',
      sourceCurrent: false
    },
    presentationProofWait: {
      status: 'resident-presentation-proof-wait-timeout',
      timedOut: true
    },
    presentationHandoffAdmission: {
      status: 'candidate-completion-handoff-admitted',
      admitted: true
    },
    presentationHandoffWait: {
      handoffWaitStatus: 'candidate-completion-handoff-wait-timeout',
      timedOut: true
    },
    boundedAttemptComplete: true,
    updatedAtMs: 1234
  });
  assert.equal(timeout.active, false);
  assert.equal(
    timeout.status,
    'native-surface-post-step-presentation-timeout-fail-open'
  );
  assert.equal(timeout.postStepPresentationAdmitted, false);
  assert.equal(timeout.postStepPresentationProved, false);
  assert.equal(timeout.livenessFailOpen, true);
  assert.equal(timeout.residentPlaybackReleased, true);
  assert.equal(timeout.presentationSourceCurrent, false);
  assert.equal(timeout.requestToken, 17);
  assert.equal(timeout.candidateGeneration, 22);
  assert.equal(timeout.lifecycleGeneration, 8);
  assert.equal(timeout.sourceResidentExecutionGeneration, 91);
  assert.equal(timeout.sourceResidentStepsSignature, 'steps-signature');
  assert.equal(timeout.sourceResidentStepSignature, 'step-signature');
  assert.equal(timeout.retryAttempt, 2);
  assert.equal(timeout.failureCode, 'camera-snapshot-stale');
  assert.equal(timeout.startedAtMs, 1000);
  assert.equal(timeout.handoffStatus, 'candidate-completion-handoff-admitted');
  assert.equal(timeout.handoffAdmitted, true);
  assert.equal(
    timeout.proofWaitStatus,
    'resident-presentation-proof-wait-timeout'
  );
  assert.equal(timeout.releasedAtMs, 1234);
  assert.equal(Object.isFrozen(timeout), true);
  assert.equal(
    resolveSphNativeSurfacePostStepPresentationGateSettlement({
      gate: timeout,
      generation: 9,
      currentGeneration: 9,
      scheduleToken: 41,
      currentScheduleToken: 41,
      boundedAttemptComplete: true,
      updatedAtMs: 1300
    }),
    timeout
  );

  const error = resolveSphNativeSurfacePostStepPresentationGateSettlement({
    gate,
    generation: 9,
    currentGeneration: 9,
    scheduleToken: 41,
    currentScheduleToken: 41,
    boundedAttemptComplete: true,
    refreshError: 'native presentation refresh rejected',
    updatedAtMs: 1235
  });
  assert.equal(
    error.status,
    'native-surface-post-step-presentation-error-fail-open'
  );
  assert.equal(error.active, false);
  assert.equal(error.refreshError, 'native presentation refresh rejected');

  const visibleWithoutExactProof =
    resolveSphNativeSurfacePostStepPresentationGateSettlement({
      gate,
      generation: 9,
      currentGeneration: 9,
      scheduleToken: 41,
      currentScheduleToken: 41,
      presentationAdmitted: true,
      presentationVisible: true,
      presentationProof: {
        admitted: false,
        visible: true,
        foregroundProved: false,
        status: 'native-resident-presentation-unadmitted',
        sourceCurrent: true
      },
      boundedAttemptComplete: true,
      updatedAtMs: 1236
    });
  assert.equal(
    visibleWithoutExactProof.status,
    'native-surface-post-step-presentation-unadmitted-fail-open'
  );
  assert.equal(visibleWithoutExactProof.postStepPresentationProved, false);
});

test('native post-step presentation gate admits only exact current identity and tracks pixel proof separately', () => {
  const gate = Object.freeze({
    schema: 'peercompute.ulg.sph-native-surface-post-step-presentation-gate.v0',
    status: 'native-surface-post-step-presentation-proof-pending',
    active: true,
    generation: 9,
    scheduleToken: 41
  });
  const proved = resolveSphNativeSurfacePostStepPresentationGateSettlement({
    gate,
    generation: 9,
    currentGeneration: 9,
    scheduleToken: 41,
    currentScheduleToken: 41,
    presentationAdmitted: true,
    presentationVisible: true,
    presentationProof: {
      admitted: true,
      visible: true,
      foregroundProved: true,
      status: 'native-resident-presentation-foreground-proved',
      sourceCurrent: true
    },
    presentationHandoffAdmission: {
      status: 'candidate-completion-handoff-admitted',
      admitted: true
    },
    updatedAtMs: 1234
  });
  assert.equal(proved.active, false);
  assert.equal(proved.status, 'native-surface-post-step-presentation-admitted');
  assert.equal(proved.postStepPresentationAdmitted, true);
  assert.equal(proved.postStepPresentationProved, true);
  assert.equal(proved.livenessFailOpen, false);
  assert.equal(proved.residentPlaybackReleased, true);
  assert.equal(proved.presentationSourceCurrent, true);

  const structurallyAdmitted = resolveSphNativeSurfacePostStepPresentationGateSettlement({
    gate,
    generation: 9,
    currentGeneration: 9,
    scheduleToken: 41,
    currentScheduleToken: 41,
    presentationAdmitted: true,
    presentationVisible: false,
    presentationProof: {
      admitted: true,
      visible: false,
      foregroundProved: false,
      status: 'native-resident-presentation-submission-admitted',
      sourceCurrent: true
    },
    presentationHandoffAdmission: {
      status: 'candidate-completion-handoff-admitted',
      admitted: true
    },
    updatedAtMs: 1235
  });
  assert.equal(
    structurallyAdmitted.status,
    'native-surface-post-step-presentation-admitted'
  );
  assert.equal(structurallyAdmitted.postStepPresentationAdmitted, true);
  assert.equal(structurallyAdmitted.postStepPresentationProved, false);
  assert.equal(structurallyAdmitted.livenessFailOpen, false);

  const rejectedHandoff = resolveSphNativeSurfacePostStepPresentationGateSettlement({
    gate,
    generation: 9,
    currentGeneration: 9,
    scheduleToken: 41,
    currentScheduleToken: 41,
    presentationAdmitted: true,
    presentationVisible: true,
    presentationProof: {
      admitted: true,
      visible: true,
      foregroundProved: true,
      status: 'native-resident-presentation-foreground-proved',
      sourceCurrent: true
    },
    presentationHandoffAdmission: {
      status: 'candidate-completion-handoff-rejected',
      admitted: false
    },
    boundedAttemptComplete: true,
    updatedAtMs: 1236
  });
  assert.equal(
    rejectedHandoff.status,
    'native-surface-post-step-presentation-unadmitted-fail-open'
  );
  assert.equal(rejectedHandoff.postStepPresentationAdmitted, false);
  assert.equal(rejectedHandoff.postStepPresentationProved, false);
  assert.equal(rejectedHandoff.livenessFailOpen, true);

  const pending = resolveSphNativeSurfacePostStepPresentationGateSettlement({
    gate,
    generation: 9,
    currentGeneration: 9,
    scheduleToken: 41,
    currentScheduleToken: 41,
    presentationProof: {
      admitted: false,
      foregroundProved: false,
      status: 'native-resident-presentation-unadmitted',
      sourceCurrent: false
    }
  });
  assert.equal(pending, gate);

  const staleGeneration =
    resolveSphNativeSurfacePostStepPresentationGateSettlement({
      gate,
      generation: 9,
      currentGeneration: 10,
      scheduleToken: 41,
      currentScheduleToken: 41,
      boundedAttemptComplete: true
    });
  assert.equal(staleGeneration, gate);

  const staleSchedule =
    resolveSphNativeSurfacePostStepPresentationGateSettlement({
      gate,
      generation: 9,
      currentGeneration: 9,
      scheduleToken: 41,
      currentScheduleToken: 42,
      boundedAttemptComplete: true
    });
  assert.equal(staleSchedule, gate);

  const coercibleIdentity =
    resolveSphNativeSurfacePostStepPresentationGateSettlement({
      gate: { ...gate, generation: '9', scheduleToken: '41' },
      generation: '9',
      currentGeneration: '9',
      scheduleToken: '41',
      currentScheduleToken: '41',
      boundedAttemptComplete: true
    });
  assert.equal(coercibleIdentity.active, true);
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
      surfaceDrawVisibleGpuConsumerReady: true,
      surfaceDrawVisibleGpuConsumerRuntimePresentationAdmitted: true
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

test('native cadence retains an admitted prior surface and recovers an unadmitted display', () => {
  const renderState = {
    schema: 'peercompute.ulg.sph-resident-render-state.v0',
    surfaceDrawVisibleRendererBridge: 'native-webgpu-surface-consumer'
  };
  const foregroundProvedSurface = {
    visibleRendererBridge: 'native-webgpu-surface-consumer',
    surfaceDrawVisibleGpuConsumerReady: true,
    surfaceDrawVisibleGpuConsumerRuntimePresentationAdmitted: true,
    surfaceDrawVisibleGpuConsumerForegroundProofValidated: true,
    surfaceDrawVisibleGpuConsumerOffscreenForegroundValidated: true,
    surfaceDrawVisibleGpuConsumerNativeOffscreenValidationStatus: 'passed',
    surfaceDrawVisibleGpuConsumerNativeOffscreenValidationNonzeroPixelCount: 12,
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
  assert.equal(retained.status, 'native-surface-admitted-presentation-cadence-deferred');
  assert.equal(retained.presentationVisible, true);
  assert.equal(retained.presentationAdmitted, true);
  assert.equal(retained.presentationForegroundProved, true);
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
  assert.equal(current.presentationAdmitted, true);
  assert.equal(current.currentSourceForAdmission, true);
  assert.equal(current.forceDue, false);

  const structurallyAdmitted = resolveSphNativeSurfaceCadenceRefreshPolicy({
    nativeSurfaceConsumerRefresh: true,
    renderState,
    surfaceDraw: {
      ...foregroundProvedSurface,
      surfaceDrawVisibleGpuConsumerOffscreenForegroundValidated: false,
      surfaceDrawVisibleGpuConsumerForegroundProofValidated: false,
      surfaceDrawVisibleGpuConsumerRuntimePresentationAdmitted: true,
      surfaceDrawVisibleGpuConsumerSameQueueStructuralSubmissionAdmitted: true,
      surfaceDrawVisibleGpuConsumerNativeCandidateForegroundValidationStatus:
        'passed',
      surfaceDrawVisibleGpuConsumerNativeCandidateForegroundProofKind:
        'same-queue-private-staged-composite-submission',
      surfaceDrawVisibleGpuConsumerNativeCandidateForegroundSameQueueSubmissionBoundary:
        true,
      surfaceDrawVisibleGpuConsumerNativeCandidateForegroundSubmittedDrawCount:
        1,
      surfaceDrawVisibleGpuConsumerNativeCandidateForegroundResourceGeneration: 9,
      renderBridgeLastRenderStatus:
        'native-webgpu-surface-consumer-candidate-staged-composite-presented',
      renderBridgeNativeSurfaceCandidateStagedPresentationStatus:
        'candidate-staged-presentation-canvas-copy-submitted',
      renderBridgeNativeSurfaceCandidatePresentationCopyCount: 1,
      renderBridgeNativeSurfaceCandidatePresentationPostAdmissionGeometrySubmitCount: 0,
      sourceResidentExecutionGenerationMatchesCurrent: false,
      sourceResidentRetainedPrevious: true,
      residentRenderSourceStaleAfterPublish: true
    }
  });
  assert.equal(
    structurallyAdmitted.status,
    'native-surface-admitted-presentation-cadence-deferred'
  );
  assert.equal(structurallyAdmitted.presentationVisible, false);
  assert.equal(structurallyAdmitted.presentationForegroundProved, false);
  assert.equal(structurallyAdmitted.presentationAdmitted, true);
  assert.equal(structurallyAdmitted.forceDue, false);
  assert.equal(structurallyAdmitted.deferToCadence, true);
  assert.equal(structurallyAdmitted.displayProof?.visible, false);
  assert.equal(structurallyAdmitted.displayProof?.admitted, true);
  assert.equal(structurallyAdmitted.displayProof?.sourceCurrent, false);

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
    assert.equal(recovery.status, 'native-surface-presentation-admission-recovery-required', label);
    assert.equal(recovery.presentationVisible, false, label);
    assert.equal(recovery.presentationAdmitted, false, label);
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
  assert.equal(nonNative.presentationAdmitted, false);
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
  assert.equal(labelOnly.admitted, false);
  assert.equal(labelOnly.foregroundProved, false);
  assert.equal(labelOnly.status, 'native-resident-presentation-unadmitted');

  const currentSurface = {
    visibleRendererBridge: 'native-webgpu-surface-consumer',
    surfaceDrawVisibleGpuConsumerReady: true,
    surfaceDrawVisibleGpuConsumerRuntimePresentationAdmitted: true,
    surfaceDrawVisibleGpuConsumerForegroundProofValidated: true,
    surfaceDrawVisibleGpuConsumerOffscreenForegroundValidated: true,
    surfaceDrawVisibleGpuConsumerNativeOffscreenValidationStatus: 'passed',
    surfaceDrawVisibleGpuConsumerNativeOffscreenValidationNonzeroPixelCount: 12,
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
        'candidate-staged-presentation-canvas-copy-submitted',
      renderBridgeNativeSurfaceCandidatePresentationCopyCount: 1,
      renderBridgeNativeSurfaceCandidatePresentationPostAdmissionGeometrySubmitCount: 0,
      sourceResidentExecutionGenerationMatchesCurrent: true,
      sourceResidentRetainedPrevious: false,
      residentRenderSourceStaleAfterPublish: false
    },
    requireCurrentSource: true
  });
  assert.equal(exactStagedCopy.visible, true);
  assert.equal(exactStagedCopy.admitted, true);
  assert.equal(exactStagedCopy.foregroundProved, true);
  assert.equal(exactStagedCopy.stagedCopyOnlyPresentation, true);
  assert.equal(exactStagedCopy.status, 'native-resident-presentation-foreground-proved');

  const structurallyAdmittedSurface = {
    ...currentSurface,
    surfaceDrawVisibleGpuConsumerOffscreenForegroundValidated: false,
    surfaceDrawVisibleGpuConsumerForegroundProofValidated: false,
    surfaceDrawVisibleGpuConsumerRuntimePresentationAdmitted: true,
    surfaceDrawVisibleGpuConsumerSameQueueStructuralSubmissionAdmitted: true,
    surfaceDrawVisibleGpuConsumerNativeCandidateForegroundValidationStatus:
      'passed',
    surfaceDrawVisibleGpuConsumerNativeCandidateForegroundProofKind:
      'same-queue-private-staged-composite-submission',
    surfaceDrawVisibleGpuConsumerNativeCandidateForegroundSameQueueSubmissionBoundary:
      true,
    surfaceDrawVisibleGpuConsumerNativeCandidateForegroundSubmittedDrawCount: 1,
    surfaceDrawVisibleGpuConsumerNativeCandidateForegroundResourceGeneration: 9,
    renderBridgeLastRenderStatus:
      'native-webgpu-surface-consumer-candidate-staged-composite-presented',
    renderBridgeNativeSurfaceCandidateStagedPresentationStatus:
      'candidate-staged-presentation-canvas-copy-submitted',
    renderBridgeNativeSurfaceCandidatePresentationCopyCount: 1,
    renderBridgeNativeSurfaceCandidatePresentationPostAdmissionGeometrySubmitCount: 0,
    sourceResidentExecutionGenerationMatchesCurrent: true,
    sourceResidentRetainedPrevious: false,
    residentRenderSourceStaleAfterPublish: false
  };
  const exactStructuralAdmission = resolveSphResidentPresentationProof({
    renderState,
    surfaceDraw: structurallyAdmittedSurface,
    requireCurrentSource: true
  });
  assert.equal(exactStructuralAdmission.visible, false);
  assert.equal(exactStructuralAdmission.foregroundProved, false);
  assert.equal(exactStructuralAdmission.admitted, true);
  assert.equal(
    exactStructuralAdmission.status,
    'native-resident-presentation-submission-admitted'
  );

  const stalePixelWithCurrentCandidate = resolveSphResidentPresentationProof({
    renderState,
    surfaceDraw: {
      ...currentSurface,
      surfaceDrawVisibleGpuConsumerNativeCandidateForegroundResourceGeneration:
        9
    }
  });
  assert.equal(stalePixelWithCurrentCandidate.admitted, false);
  assert.equal(stalePixelWithCurrentCandidate.foregroundProved, false);
  assert.equal(stalePixelWithCurrentCandidate.validatedGeneration, null);

  for (const [label, surfaceDraw] of [
    ['coercible ready flag', {
      ...structurallyAdmittedSurface,
      surfaceDrawVisibleGpuConsumerReady: 'true'
    }],
    ['coercible runtime-admission flag', {
      ...structurallyAdmittedSurface,
      surfaceDrawVisibleGpuConsumerRuntimePresentationAdmitted: 'true'
    }],
    ['coercible structural-admission flag', {
      ...structurallyAdmittedSurface,
      surfaceDrawVisibleGpuConsumerRuntimePresentationAdmitted: undefined,
      surfaceDrawVisibleGpuConsumerSameQueueStructuralSubmissionAdmitted: 'true'
    }],
    ['missing structural boundary', {
      ...structurallyAdmittedSurface,
      surfaceDrawVisibleGpuConsumerNativeCandidateForegroundSameQueueSubmissionBoundary:
        undefined
    }],
    ['failed structural validation', {
      ...structurallyAdmittedSurface,
      surfaceDrawVisibleGpuConsumerNativeCandidateForegroundValidationStatus:
        'failed'
    }],
    ['stale structural generation', {
      ...structurallyAdmittedSurface,
      surfaceDrawVisibleGpuConsumerNativeCandidateForegroundResourceGeneration:
        8
    }]
  ]) {
    const proof = resolveSphResidentPresentationProof({
      renderState,
      surfaceDraw,
      requireCurrentSource: true
    });
    assert.equal(proof.admitted, false, label);
    assert.equal(proof.foregroundProved, false, label);
  }

  const legacyForegroundClaim = resolveSphResidentPresentationProof({
    renderState,
    surfaceDraw: {
      ...structurallyAdmittedSurface,
      surfaceDrawVisibleGpuConsumerRuntimePresentationAdmitted: undefined,
      surfaceDrawVisibleGpuConsumerSameQueueStructuralSubmissionAdmitted:
        undefined,
      surfaceDrawVisibleGpuConsumerSameQueueForegroundSubmissionValidated:
        true,
      surfaceDrawVisibleGpuConsumerValidated: true
    },
    requireCurrentSource: true
  });
  assert.equal(legacyForegroundClaim.admitted, false);
  assert.equal(legacyForegroundClaim.foregroundProved, false);

  const renderStateOnlyBrowserProof = resolveSphResidentPresentationProof({
    renderState: {
      schema: 'peercompute.ulg.sph-resident-render-state.v0',
      surfaceDrawVisibleRendererBridge: 'native-webgpu-surface-consumer',
      surfaceDrawVisibleGpuConsumerReady: true,
      surfaceDrawVisibleGpuConsumerRuntimePresentationAdmitted: true,
      surfaceDrawVisibleGpuConsumerForegroundProofValidated: true,
      surfaceDrawVisibleGpuConsumerBrowserFrameForegroundValidated: true,
      surfaceDrawVisibleGpuConsumerPixelValidationStatus: 'passed',
      surfaceDrawVisibleGpuConsumerNativePixelValidationSource:
        'playwright-composited-frame',
      surfaceDrawVisibleGpuConsumerNativePixelValidationNonzeroPixelCount: 12,
      surfaceDrawVisibleGpuConsumerNativePixelValidationResourceGeneration: 9,
      surfaceDrawVisibleGpuConsumerNativeActiveResourceGeneration: 9,
      surfaceDrawRenderBridgeLastRenderStatus:
        'native-webgpu-surface-consumer-rendered',
      surfaceDrawRenderBridgeFrameCount: 2,
      surfaceDrawRenderBridgeLastSubmittedDrawCount: 1,
      surfaceDrawRenderBridgeNativeSurfaceDebugMode: 'none',
      surfaceDrawSourceResidentExecutionGenerationMatchesCurrent: true,
      surfaceDrawSourceResidentRetainedPrevious: false,
      residentRenderSourceStaleAfterPublish: false
    },
    requireCurrentSource: true
  });
  assert.equal(renderStateOnlyBrowserProof.visible, true);
  assert.equal(renderStateOnlyBrowserProof.admitted, true);
  assert.equal(renderStateOnlyBrowserProof.foregroundProved, true);
  assert.equal(renderStateOnlyBrowserProof.browserFrameForegroundValidated, true);

  for (const [label, receipt] of [
    ['missing copy receipt', {}],
    ['post-admission geometry submit', {
      renderBridgeNativeSurfaceCandidateStagedPresentationStatus:
        'candidate-staged-presentation-canvas-copy-submitted',
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
  assert.equal(
    retainedWhileBusy.retainedPresentationWhileResidentGpuWorkInFlight,
    true
  );

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
    status: 'native-surface-post-step-presentation-unadmitted',
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
    status: 'native-surface-post-step-presentation-unadmitted',
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
    fullParticleReadbackPerformed: false,
    fullParticleReadbackFree: true,
    continuationAvailable: true,
    ...createGpuReadbackTelemetry({
      scope: 'remote-refresh-retained-continuation'
    }),
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

function certifiedContinuationParticipant(scope) {
  return {
    backend: 'webgpu',
    readbackMode: 'no-full-readback',
    fullParticleReadbackPerformed: false,
    fullParticleReadbackFree: true,
    residentContinuationReady: true,
    ...createGpuReadbackTelemetry({ scope })
  };
}

function withoutCanonicalReadbackTelemetry(source) {
  const result = { ...source };
  for (const field of Object.keys(createGpuReadbackTelemetry({
    scope: 'remote-refresh-telemetry-field-list'
  }))) {
    delete result[field];
  }
  return result;
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
      ...createGpuReadbackTelemetry({
        scope: 'remote-refresh-classified-continuation',
        mapAsyncCount: 1,
        readbackBytes: 64,
        hostQueueFenceCount: 1,
        finalDiagnosticMapAsyncCount: 1,
        finalDiagnosticReadbackBytes: 64,
        deferredCleanupHostQueueFenceCount: 1
      }),
      readbackMode: 'compact-grid-conservation-summary-readback',
      fullParticleReadbackPerformed: false,
      fullParticleReadbackFree: true,
      residentContinuationReady: true
    })),
    true
  );
});

test('resident GPU continuation requires certified v1 or exact legacy-zero readback evidence', () => {
  const canonicalTelemetry = createGpuReadbackTelemetry({
    scope: 'remote-refresh-uncertified-continuation'
  });
  const withoutCertifiedTelemetry = retainedGpuContinuationExecution({
    readbackMode: 'compact-grid-conservation-summary-readback',
    fullParticleReadbackPerformed: false,
    normalHotLoopReadbackFree: true
  });
  for (const field of Object.keys(canonicalTelemetry)) {
    delete withoutCertifiedTelemetry[field];
  }
  withoutCertifiedTelemetry.normalHotLoopReadbackFree = true;
  assert.equal(
    residentGpuContinuationEvidenceReady(withoutCertifiedTelemetry),
    false,
    'a compact/no-schema raw strict claim is not continuation certification'
  );

  const explicitNoFullWithoutCertification = {
    ...withoutCertifiedTelemetry,
    readbackMode: 'no-full-readback',
    fullParticleReadbackFree: true,
    residentContinuationReady: true
  };
  assert.equal(
    residentGpuContinuationEvidenceReady(explicitNoFullWithoutCertification),
    false,
    'an explicit no-full-readback flag cannot replace certified telemetry'
  );

  const exactLegacyZero = {
    ...withoutCertifiedTelemetry,
    readbackTelemetrySchema: GPU_READBACK_TELEMETRY_SCHEMA,
    readbackTelemetryComplete: true,
    readbackTelemetryUnknownSources: [],
    observedMapAsyncCount: 0,
    observedReadbackBytes: 0,
    observedHostQueueFenceCount: 0,
    normalHotLoopReadbackFree: true
  };
  assert.equal(
    residentGpuContinuationEvidenceReady(exactLegacyZero),
    true,
    'the bounded legacy compatibility path still requires exact zero evidence'
  );
});

test('resident GPU continuation requires every parent and final-step participant to certify', () => {
  const exactFinalStep = certifiedContinuationParticipant(
    'remote-refresh-exact-final-participant'
  );
  assert.equal(
    residentGpuContinuationEvidenceReady(retainedGpuContinuationExecution({
      finalStep: exactFinalStep
    })),
    true,
    'an exact parent and exact final step remain continuation-ready'
  );

  const rawFinalStep = withoutCanonicalReadbackTelemetry(exactFinalStep);
  rawFinalStep.normalHotLoopReadbackFree = true;
  const participantVariants = [
    ['wrong schema', {
      ...exactFinalStep,
      readbackTelemetrySchema: 'peercompute.ulg.gpu-readback-telemetry.wrong'
    }],
    ['explicit incomplete', {
      ...exactFinalStep,
      readbackTelemetryComplete: false
    }],
    ['malformed count', {
      ...exactFinalStep,
      observedMapAsyncCount: -1
    }],
    ['raw no-schema', rawFinalStep]
  ];

  for (const [name, malformedParticipant] of participantVariants) {
    assert.equal(
      residentGpuContinuationEvidenceReady(retainedGpuContinuationExecution({
        finalStep: malformedParticipant
      })),
      false,
      `${name}: exact parent cannot certify a malformed final step`
    );

    const malformedParent = retainedGpuContinuationExecution({
      finalStep: exactFinalStep
    });
    for (const field of Object.keys(createGpuReadbackTelemetry({
      scope: 'remote-refresh-parent-telemetry-field-list'
    }))) {
      delete malformedParent[field];
    }
    Object.assign(malformedParent, malformedParticipant);
    assert.equal(
      residentGpuContinuationEvidenceReady(malformedParent),
      false,
      `${name}: exact final step cannot certify a malformed parent`
    );
  }

  const exactLegacyFinalStep = {
    ...withoutCanonicalReadbackTelemetry(exactFinalStep),
    readbackTelemetrySchema: GPU_READBACK_TELEMETRY_SCHEMA,
    readbackTelemetryComplete: true,
    readbackTelemetryUnknownSources: [],
    observedMapAsyncCount: 0,
    observedReadbackBytes: 0,
    observedHostQueueFenceCount: 0,
    normalHotLoopReadbackFree: true
  };
  assert.equal(
    residentGpuContinuationEvidenceReady(retainedGpuContinuationExecution({
      finalStep: exactLegacyFinalStep
    })),
    true,
    'each participant may independently use the exact legacy-zero proof'
  );
});

test('resident GPU continuation rejects malformed participant evidence types in both directions', () => {
  const exactFinalStep = certifiedContinuationParticipant(
    'remote-refresh-exact-type-final-participant'
  );
  for (const [field, malformedValue] of [
    ['readbackMode', 7],
    ['readbackMode', '   '],
    ['fullParticleReadbackPerformed', 'false'],
    ['fullParticleReadbackFree', 1],
    ['residentContinuationReady', 'true']
  ]) {
    assert.equal(
      residentGpuContinuationEvidenceReady(retainedGpuContinuationExecution({
        finalStep: {
          ...exactFinalStep,
          [field]: malformedValue
        }
      })),
      false,
      `${field}: malformed final-step type`
    );
    assert.equal(
      residentGpuContinuationEvidenceReady(retainedGpuContinuationExecution({
        finalStep: exactFinalStep,
        [field]: malformedValue
      })),
      false,
      `${field}: malformed parent type`
    );
  }
  assert.equal(
    residentGpuContinuationEvidenceReady(retainedGpuContinuationExecution({
      finalStep: 'malformed-final-step'
    })),
    false,
    'a present non-object final step is not silently filtered away'
  );
});

test('resident GPU continuation requires each participant to carry an exact WebGPU no-full-state certificate', () => {
  const exactFinalStep = certifiedContinuationParticipant(
    'remote-refresh-exact-independent-final-participant'
  );
  for (const [field, invalidValue] of [
    ['backend', 7],
    ['backend', 'cpu-reference-mounted-scene'],
    ['readbackMode', 'cpu-reference-full-state'],
    ['readbackMode', 'unknown-readback-mode']
  ]) {
    assert.equal(
      residentGpuContinuationEvidenceReady(retainedGpuContinuationExecution({
        finalStep: {
          ...exactFinalStep,
          [field]: invalidValue
        }
      })),
      false,
      `${field}=${String(invalidValue)}: parent proof cannot certify the final step`
    );
    assert.equal(
      residentGpuContinuationEvidenceReady(retainedGpuContinuationExecution({
        finalStep: exactFinalStep,
        [field]: invalidValue
      })),
      false,
      `${field}=${String(invalidValue)}: final-step proof cannot certify the parent`
    );
  }

  for (const [field, contradictoryValue] of [
    ['fullParticleReadbackPerformed', true],
    ['fullParticleReadbackFree', false],
    ['residentContinuationReady', false]
  ]) {
    assert.equal(
      residentGpuContinuationEvidenceReady(retainedGpuContinuationExecution({
        finalStep: {
          ...exactFinalStep,
          [field]: contradictoryValue
        }
      })),
      false,
      `${field}: parent proof cannot overrule contradictory final-step evidence`
    );
    assert.equal(
      residentGpuContinuationEvidenceReady(retainedGpuContinuationExecution({
        finalStep: exactFinalStep,
        [field]: contradictoryValue
      })),
      false,
      `${field}: final-step proof cannot overrule contradictory parent evidence`
    );
  }
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
      ...createGpuReadbackTelemetry({
        scope: 'remote-refresh-no-full-classified-continuation',
        mapAsyncCount: 1,
        readbackBytes: 64,
        hostQueueFenceCount: 1,
        finalDiagnosticMapAsyncCount: 1,
        finalDiagnosticReadbackBytes: 64,
        deferredCleanupHostQueueFenceCount: 1
      }),
      readbackMode: 'no-full-readback',
      fullParticleReadbackPerformed: false
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
  assert.equal(
    residentGpuContinuationEvidenceReady(retainedGpuContinuationExecution({
      fullParticleReadbackFree: false,
      residentContinuationReady: true
    })),
    false
  );
  assert.equal(
    residentGpuContinuationEvidenceReady(retainedGpuContinuationExecution({
      fullParticleReadbackFree: true,
      residentContinuationReady: false,
      continuationAvailable: true
    })),
    false
  );
  assert.equal(
    residentGpuContinuationEvidenceReady(retainedGpuContinuationExecution({
      fullParticleReadbackFree: true,
      residentContinuationReady: true,
      finalStep: {
        fullParticleReadbackFree: false
      }
    })),
    false
  );
  assert.equal(
    residentGpuContinuationEvidenceReady(retainedGpuContinuationExecution({
      readbackMode: 'full-parity-readback',
      fullParticleReadbackPerformed: true,
      fullParticleReadbackFree: true,
      residentContinuationReady: true
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
    fullParticleReadbackPerformed: false,
    fullParticleReadbackFree: true,
    stepCount: 2,
    completedStepCount: 2,
    continuationAvailable: true,
    ...createGpuReadbackTelemetry({
      scope: 'remote-refresh-resident-stage-order-fixture'
    }),
    finalStep: {
      status: 'resident-step-webgpu-executed',
      backend: 'webgpu',
      readbackMode: 'no-full-readback',
      fullParticleReadbackPerformed: false,
      fullParticleReadbackFree: true,
      ...createGpuReadbackTelemetry({
        scope: 'remote-refresh-resident-stage-order-final-step-fixture'
      }),
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
  assert.equal(summary.normalHotLoopReadbackFree, true);
  assert.equal(summary.productionHotLoopHostDependencyFree, true);
  assert.deepEqual(summary.stageOrder, ['p2g', 'gridUpdate', 'g2p']);
  assert.equal(summary.activeGridDispatch.activeGridNodeCount, 42);
  assert.equal(summary.activeGridDispatch.activeNodeCount, 42);
  assert.equal(summary.activeGridDispatch.dispatchNodeCount, 42);
  assert.equal(summary.diagnostics.maxDisplacementM, 0.0125);
  assert.equal(summary.residentAuthorityFamilyOwners['particle-kinematics'].ownerStage, 'g2p');
  assert.equal(summary.residentBufferLeaseLedgerStatus, 'resident-buffer-leases-valid');
  assert.equal(summary.nextParticleBufferMode, 'retained-g2p-output-buffers');
  assert.equal(
    summarizeResidentStageOrderExecution({
      ...execution,
      normalHotLoopReadbackFree: true,
      finalStep: {
        ...execution.finalStep,
        normalHotLoopReadbackFree: false
      }
    }).normalHotLoopReadbackFree,
    false
  );
  assert.equal(
    summarizeResidentStageOrderExecution({
      schema: execution.schema,
      finalStep: {}
    }).normalHotLoopReadbackFree,
    null
  );
  assert.equal(
    summarizeResidentStageOrderExecution({
      ...execution,
      productionHotLoopHostDependencyFree: true,
      finalStep: {
        ...execution.finalStep,
        productionHotLoopHostDependencyFree: false
      }
    }).productionHotLoopHostDependencyFree,
    false
  );
  assert.equal(
    summarizeResidentStageOrderExecution({
      schema: execution.schema,
      finalStep: {}
    }).productionHotLoopHostDependencyFree,
    null
  );

  const malformedFinalStep = summarizeResidentStageOrderExecution({
    ...execution,
    finalStep: {
      ...execution.finalStep,
      observedMapAsyncCount: '0'
    }
  });
  assert.equal(malformedFinalStep.readbackTelemetryComplete, false);
  assert.equal(malformedFinalStep.normalHotLoopReadbackFree, null);
  assert.equal(
    malformedFinalStep.productionHotLoopHostDependencyFree,
    null
  );

  const explicitIncompleteFinalStep = summarizeResidentStageOrderExecution({
    ...execution,
    finalStep: {
      ...execution.finalStep,
      readbackTelemetryComplete: false,
      normalHotLoopReadbackFree: true,
      productionHotLoopHostDependencyFree: true
    }
  });
  assert.equal(explicitIncompleteFinalStep.readbackTelemetryComplete, false);
  assert.equal(explicitIncompleteFinalStep.normalHotLoopReadbackFree, null);
  assert.equal(
    explicitIncompleteFinalStep.productionHotLoopHostDependencyFree,
    null
  );
});

test('composite page telemetry couples positive claims to every participant', () => {
  const complete = {
    backend: 'webgpu',
    readbackMode: 'no-full-readback',
    fullParticleReadbackPerformed: false,
    fullParticleReadbackFree: true,
    ...createGpuReadbackTelemetry({
      scope: 'remote-refresh-composite-complete'
    })
  };
  assert.deepEqual(
    compositePageVisibleGpuReadbackTelemetryEvidence([complete, complete]),
    {
      readbackTelemetryComplete: true,
      normalHotLoopReadbackFree: true,
      productionHotLoopHostDependencyFree: true
    }
  );

  const malformed = {
    ...complete,
    observedMapAsyncCount: '0'
  };
  assert.deepEqual(
    compositePageVisibleGpuReadbackTelemetryEvidence([complete, malformed]),
    {
      readbackTelemetryComplete: false,
      normalHotLoopReadbackFree: null,
      productionHotLoopHostDependencyFree: null
    }
  );
  assert.deepEqual(
    compositePageVisibleGpuReadbackTelemetryEvidence([complete, {}]),
    {
      readbackTelemetryComplete: false,
      normalHotLoopReadbackFree: null,
      productionHotLoopHostDependencyFree: null
    },
    'an explicit unproven participant cannot borrow a positive claim'
  );

  for (const malformedParticipant of ['malformed-participant', 0, false]) {
    const expected = {
      readbackTelemetryComplete: false,
      normalHotLoopReadbackFree: null,
      productionHotLoopHostDependencyFree: null
    };
    assert.deepEqual(
      compositePageVisibleGpuReadbackTelemetryEvidence([
        complete,
        malformedParticipant
      ]),
      expected,
      `${String(malformedParticipant)}: a trailing scalar participant remains visible`
    );
    assert.deepEqual(
      compositePageVisibleGpuReadbackTelemetryEvidence([
        malformedParticipant,
        complete
      ]),
      expected,
      `${String(malformedParticipant)}: a leading scalar participant remains visible`
    );
    const summary = summarizeResidentStageOrderExecution({
      schema: ULG_MLS_MPM_GPU_RESIDENT_STEPS_EXECUTION_SCHEMA,
      ...complete,
      finalStep: malformedParticipant
    });
    assert.equal(summary.readbackTelemetryComplete, false);
    assert.equal(summary.normalHotLoopReadbackFree, null);
    assert.equal(summary.productionHotLoopHostDependencyFree, null);
  }

  const explicitFailure = {
    backend: 'webgpu',
    readbackMode: 'no-full-readback',
    fullParticleReadbackPerformed: false,
    fullParticleReadbackFree: true,
    readbackTelemetryComplete: false,
    normalHotLoopReadbackFree: false,
    productionHotLoopHostDependencyFree: false
  };
  assert.deepEqual(
    compositePageVisibleGpuReadbackTelemetryEvidence([
      complete,
      malformed,
      explicitFailure
    ]),
    {
      readbackTelemetryComplete: false,
      normalHotLoopReadbackFree: false,
      productionHotLoopHostDependencyFree: false
    },
    'an explicit false remains authoritative even beside malformed evidence'
  );
});

test('resident telemetry rejects sparse and proxied-hole participant arrays without vacuous success', () => {
  const complete = certifiedContinuationParticipant(
    'remote-refresh-sparse-array-complete'
  );
  const leadingHole = new Array(2);
  leadingHole[1] = complete;
  const middleHole = [complete, , complete];
  const trailingHole = [complete];
  trailingHole.length = 2;
  const holeOnly = new Array(1);
  const proxiedHole = new Proxy(new Array(1), {
    get(target, field, receiver) {
      if (field === '0') return complete;
      return Reflect.get(target, field, receiver);
    }
  });
  const failClosed = {
    readbackTelemetryComplete: false,
    normalHotLoopReadbackFree: null,
    productionHotLoopHostDependencyFree: null
  };

  for (const [name, sources] of [
    ['leading hole', leadingHole],
    ['middle hole', middleHole],
    ['trailing hole', trailingHole],
    ['hole only', holeOnly],
    ['proxied hole', proxiedHole]
  ]) {
    assert.deepEqual(
      compositePageVisibleGpuReadbackTelemetryEvidence(sources),
      failClosed,
      `${name}: every logical participant index must carry own evidence`
    );
    assert.match(
      residentGpuResidencyWarningMessage({
        completedExecutionAvailable: true,
        telemetrySources: sources
      }),
      /incomplete or unproven/,
      `${name}: a sparse collection cannot silence the residency warning`
    );
  }
});

test('resident summaries, warnings, and continuation require exact controls for every nested participant', () => {
  const exactParticipant = certifiedContinuationParticipant(
    'remote-refresh-exact-control-participant'
  );
  const invalidControlVariants = [
    ['missing backend', (source) => { delete source.backend; }],
    ['numeric backend', (source) => { source.backend = 7; }],
    ['case-drift backend', (source) => { source.backend = 'WebGPU'; }],
    ['CPU backend', (source) => { source.backend = 'cpu-reference-mounted-scene'; }],
    ['missing readback mode', (source) => { delete source.readbackMode; }],
    ['numeric readback mode', (source) => { source.readbackMode = 0; }],
    ['case-drift readback mode', (source) => { source.readbackMode = 'NO-FULL-READBACK'; }],
    ['full readback mode', (source) => { source.readbackMode = 'full-parity-readback'; }],
    ['unknown readback mode', (source) => { source.readbackMode = 'unknown-readback-mode'; }],
    ['missing performed flag', (source) => { delete source.fullParticleReadbackPerformed; }],
    ['numeric performed flag', (source) => { source.fullParticleReadbackPerformed = 0; }],
    ['performed full readback', (source) => { source.fullParticleReadbackPerformed = true; }],
    ['missing free flag', (source) => { delete source.fullParticleReadbackFree; }],
    ['numeric free flag', (source) => { source.fullParticleReadbackFree = 1; }],
    ['contradictory not-free flag', (source) => { source.fullParticleReadbackFree = false; }],
    ['contradictory performed-and-free flags', (source) => {
      source.fullParticleReadbackPerformed = true;
      source.fullParticleReadbackFree = true;
    }]
  ];

  assert.equal(
    residentGpuResidencyWarningMessage({
      completedExecutionAvailable: true,
      telemetrySources: [exactParticipant]
    }),
    null,
    'an exact participant can silence the warning'
  );
  assert.match(
    residentGpuResidencyWarningMessage({
      completedExecutionAvailable: true,
      readbackTelemetryComplete: true,
      normalHotLoopReadbackFree: true,
      productionHotLoopHostDependencyFree: true
    }),
    /incomplete or unproven/,
    'detached aggregate booleans cannot silence the participant-bound warning'
  );

  for (const [name, mutate] of invalidControlVariants) {
    const invalidParticipant = { ...exactParticipant };
    mutate(invalidParticipant);
    for (const [order, sources] of [
      ['leading', [invalidParticipant, exactParticipant]],
      ['trailing', [exactParticipant, invalidParticipant]]
    ]) {
      const composite = compositePageVisibleGpuReadbackTelemetryEvidence(sources);
      assert.equal(composite.readbackTelemetryComplete, false, `${name}/${order}: complete`);
      assert.equal(composite.normalHotLoopReadbackFree, null, `${name}/${order}: strict`);
      assert.equal(
        composite.productionHotLoopHostDependencyFree,
        null,
        `${name}/${order}: production`
      );
      assert.match(
        residentGpuResidencyWarningMessage({
          completedExecutionAvailable: true,
          telemetrySources: sources
        }),
        /incomplete or unproven/,
        `${name}/${order}: warning remains fail closed`
      );
    }

    for (const nesting of ['parent', 'finalStep']) {
      const parent = nesting === 'parent'
        ? invalidParticipant
        : exactParticipant;
      const finalStep = nesting === 'finalStep'
        ? invalidParticipant
        : exactParticipant;
      const summary = summarizeResidentStageOrderExecution({
        schema: ULG_MLS_MPM_GPU_RESIDENT_STEPS_EXECUTION_SCHEMA,
        status: 'resident-steps-executed',
        ...parent,
        finalStep
      });
      assert.equal(
        summary.readbackTelemetryComplete,
        false,
        `${name}/${nesting}: summary complete`
      );
      assert.equal(
        summary.normalHotLoopReadbackFree,
        null,
        `${name}/${nesting}: summary strict`
      );
      assert.equal(
        summary.productionHotLoopHostDependencyFree,
        null,
        `${name}/${nesting}: summary production`
      );

      if (nesting === 'finalStep') {
        assert.equal(
          residentGpuContinuationEvidenceReady(
            retainedGpuContinuationExecution({ finalStep: invalidParticipant })
          ),
          false,
          `${name}/${nesting}: continuation`
        );
      } else {
        const execution = retainedGpuContinuationExecution({
          finalStep: exactParticipant
        });
        mutate(execution);
        assert.equal(
          residentGpuContinuationEvidenceReady(execution),
          false,
          `${name}/${nesting}: continuation`
        );
      }
    }
  }
});

test('present nullish final steps and contradictory continuation flags fail closed', () => {
  const exactParticipant = certifiedContinuationParticipant(
    'remote-refresh-nullish-final-participant'
  );
  for (const finalStep of [null, undefined]) {
    const continuation = retainedGpuContinuationExecution({ finalStep });
    assert.equal(
      Object.prototype.hasOwnProperty.call(continuation, 'finalStep'),
      true
    );
    assert.equal(
      residentGpuContinuationEvidenceReady(continuation),
      false,
      `${String(finalStep)}: a present nullish final step remains a participant`
    );
    const summary = summarizeResidentStageOrderExecution({
      schema: ULG_MLS_MPM_GPU_RESIDENT_STEPS_EXECUTION_SCHEMA,
      ...exactParticipant,
      finalStep
    });
    assert.equal(summary.readbackTelemetryComplete, false);
    assert.equal(summary.normalHotLoopReadbackFree, null);
    assert.equal(summary.productionHotLoopHostDependencyFree, null);
  }

  for (const nesting of ['parent', 'finalStep']) {
    const contradictory = {
      ...exactParticipant,
      continuationAvailable: false,
      residentContinuationReady: true
    };
    const execution = nesting === 'parent'
      ? retainedGpuContinuationExecution({
          finalStep: exactParticipant,
          continuationAvailable: false,
          residentContinuationReady: true
        })
      : retainedGpuContinuationExecution({ finalStep: contradictory });
    assert.equal(
      residentGpuContinuationEvidenceReady(execution),
      false,
      `${nesting}: explicit continuationAvailable=false cannot be overridden`
    );
  }
});

test('resident continuation snapshots finalStep ownership exactly once', () => {
  for (const [name, firstDescriptor] of [
    ['null data descriptor', {
      configurable: true,
      enumerable: true,
      writable: true,
      value: null
    }],
    ['accessor descriptor', {
      configurable: true,
      enumerable: true,
      get() {
        return certifiedContinuationParticipant(
          'remote-refresh-hostile-final-step-getter'
        );
      }
    }]
  ]) {
    let finalStepDescriptorReads = 0;
    const execution = new Proxy(retainedGpuContinuationExecution(), {
      getOwnPropertyDescriptor(target, field) {
        if (field === 'finalStep') {
          finalStepDescriptorReads += 1;
          return finalStepDescriptorReads === 1
            ? firstDescriptor
            : undefined;
        }
        return Reflect.getOwnPropertyDescriptor(target, field);
      }
    });
    assert.equal(
      residentGpuContinuationEvidenceReady(execution),
      false,
      `${name}: a hostile second descriptor answer cannot erase the participant`
    );
    assert.equal(
      finalStepDescriptorReads,
      1,
      `${name}: finalStep presence and value share one descriptor snapshot`
    );
  }
});

test('resident summaries reject accessor-backed finalStep participants', () => {
  const execution = retainedGpuContinuationExecution();
  let getterCalls = 0;
  Object.defineProperty(execution, 'finalStep', {
    configurable: true,
    enumerable: true,
    get() {
      getterCalls += 1;
      return certifiedContinuationParticipant(
        'remote-refresh-accessor-final-step'
      );
    }
  });
  const summary = summarizeResidentStageOrderExecution(execution);
  assert.equal(summary.readbackTelemetryComplete, false);
  assert.equal(summary.normalHotLoopReadbackFree, null);
  assert.equal(summary.productionHotLoopHostDependencyFree, null);
  assert.equal(residentGpuContinuationEvidenceReady(execution), false);
  assert.equal(getterCalls, 0);
});

test('throwing telemetry proxies fail closed without aborting summary, warning, or continuation', () => {
  const exactParticipant = certifiedContinuationParticipant(
    'remote-refresh-throwing-proxy-participant'
  );
  const throwingParticipant = new Proxy(exactParticipant, {
    getOwnPropertyDescriptor() {
      throw new Error('hostile participant descriptor trap');
    },
    get() {
      throw new Error('hostile participant get trap');
    }
  });
  const throwingTelemetryGetter = new Proxy(exactParticipant, {
    get(target, field, receiver) {
      if (field === 'observedMapAsyncCount') {
        throw new Error('hostile telemetry getter');
      }
      return Reflect.get(target, field, receiver);
    }
  });
  const throwingSourceArray = new Proxy([exactParticipant], {
    getOwnPropertyDescriptor() {
      throw new Error('hostile source-array descriptor trap');
    }
  });
  const revoked = Proxy.revocable([exactParticipant], {});
  revoked.revoke();

  for (const [name, sources] of [
    ['participant descriptor/get', [throwingParticipant]],
    ['telemetry getter', [throwingTelemetryGetter]],
    ['source-array descriptor', throwingSourceArray],
    ['revoked source array', revoked.proxy]
  ]) {
    assert.doesNotThrow(() => {
      const composite = compositePageVisibleGpuReadbackTelemetryEvidence(sources);
      assert.notEqual(composite.readbackTelemetryComplete, true, `${name}: complete`);
      assert.notEqual(composite.normalHotLoopReadbackFree, true, `${name}: strict`);
      assert.notEqual(
        composite.productionHotLoopHostDependencyFree,
        true,
        `${name}: production`
      );
      assert.match(
        residentGpuResidencyWarningMessage({
          completedExecutionAvailable: true,
          telemetrySources: sources
        }),
        /incomplete or unproven/
      );
    }, `${name}: composite/warning traps are contained`);
  }

  for (const participant of [throwingParticipant, throwingTelemetryGetter]) {
    assert.doesNotThrow(() => {
      const summary = summarizeResidentStageOrderExecution({
        schema: ULG_MLS_MPM_GPU_RESIDENT_STEPS_EXECUTION_SCHEMA,
        ...exactParticipant,
        finalStep: participant
      });
      assert.notEqual(summary.readbackTelemetryComplete, true);
      assert.notEqual(summary.normalHotLoopReadbackFree, true);
      assert.notEqual(summary.productionHotLoopHostDependencyFree, true);
    });
    assert.doesNotThrow(() => {
      assert.equal(
        residentGpuContinuationEvidenceReady(
          retainedGpuContinuationExecution({ finalStep: participant })
        ),
        false
      );
    });
  }

  const throwingExecution = new Proxy(retainedGpuContinuationExecution(), {
    getOwnPropertyDescriptor() {
      throw new Error('hostile execution descriptor trap');
    },
    get() {
      throw new Error('hostile execution get trap');
    }
  });
  assert.doesNotThrow(() => {
    assert.equal(residentGpuContinuationEvidenceReady(throwingExecution), false);
    const summary = summarizeResidentStageOrderExecution(throwingExecution);
    assert.notEqual(summary.readbackTelemetryComplete, true);
    assert.notEqual(summary.normalHotLoopReadbackFree, true);
    assert.notEqual(summary.productionHotLoopHostDependencyFree, true);
  });
  assert.doesNotThrow(() => {
    const warning = residentGpuResidencyWarningMessage(new Proxy({}, {
      get() {
        throw new Error('hostile warning option get trap');
      }
    }));
    assert.match(warning, /incomplete or unproven/);
  });

  const warningOptionsTarget = {
    pending: false,
    completedExecutionAvailable: true,
    telemetrySources: [throwingParticipant]
  };
  const mismatchedPending = new Proxy(warningOptionsTarget, {
    get(target, field, receiver) {
      if (field === 'pending') return true;
      return Reflect.get(target, field, receiver);
    }
  });
  assert.match(
    residentGpuResidencyWarningMessage(mismatchedPending),
    /incomplete or unproven/
  );
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
