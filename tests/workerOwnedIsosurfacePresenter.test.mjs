import assert from 'node:assert/strict';
import test from 'node:test';

import {
  ULG_WORKER_OFFSCREEN_RESIDENT_ISOSURFACE_PRESENTATION_GEOMETRY,
  ULG_WORKER_OFFSCREEN_RESIDENT_ISOSURFACE_PRESENTATION_ENQUEUED_STATUS,
  ULG_WORKER_OFFSCREEN_RESIDENT_ISOSURFACE_PRESENTATION_FAILED_STATUS,
  ULG_WORKER_OFFSCREEN_RESIDENT_ISOSURFACE_PRESENTATION_RENDERED_STATUS,
  ULG_WORKER_OFFSCREEN_RESIDENT_ISOSURFACE_PRESENTATION_SUPERSEDED_STATUS,
  ULG_WORKER_OFFSCREEN_RESIDENT_ISOSURFACE_REQUEST_SCHEMA,
  buildWorkerOwnedIsosurfaceSurfaceUniformValues,
  createWorkerOwnedIsosurfacePresenter,
  resolveWorkerOwnedIsosurfaceAdmission,
  resolveWorkerOwnedIsosurfaceProductEventSource,
  snapshotWorkerOwnedSurfaceMetadata,
  summarizeWorkerOwnedIsosurfaceOpticalPresentation
} from '../src/services/workerOwnedIsosurfacePresenter.js';
import {
  SPH_GPU_REACTION_PRODUCT_EVENT_FLOATS
} from '../src/runtime/sph/sphRenderGpuKernel.js';
import {
  productEventLiveCountCopyDescriptor,
  registerResidentProductEventCountAuthority,
  resolveResidentProductEventCountAuthority,
  retireResidentProductEventCountAuthority,
  revokeResidentProductEventCountAuthority,
  validateProductEventLiveCountCopyDescriptor
} from '../src/runtime/sph/sphResidentProductHistoryGpu.js';
import {
  buildSphDispersedMediumGpuBuffers,
  destroySphDispersedMediumGpuBuffers,
  uploadSphDispersedMediumGpuBuffers
} from '../src/runtime/sph/sphDispersedMediumGpuBuffers.js';
import {
  tagWebGpuBufferDevice
} from '../src/runtime/sph/sphGpuDeviceIdentity.js';

class GPUBuffer {
  constructor(size = 4096) {
    this.size = size;
    this.destroyCount = 0;
    this.destroyed = false;
    this.mappedRange = new ArrayBuffer(size);
  }

  getMappedRange() {
    return this.mappedRange;
  }

  unmap() {
    this.unmapped = true;
  }

  destroy() {
    this.destroyCount += 1;
    this.destroyed = true;
  }
}

const dispersedIdentityBufferBySidecar = new WeakMap();

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

async function waitFor(predicate, label) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (predicate()) return;
    await new Promise((resolve) => setImmediate(resolve));
  }
  throw new Error(`timed out waiting for ${label}`);
}

function createPresenterRig({
  queueCompletion = Promise.resolve(),
  captureRenderRows = async () => ({ destroyRenderRowsBuffer() {} }),
  buildRenderField = undefined,
  buildPresentationFrame = null,
  useBuiltInFrame = false
} = {}) {
  const terminals = [];
  const submittedFrames = [];
  const drawnViewProjectionMatrices = [];
  let presentationOpportunityCalls = 0;
  let queueCompletionPromise = queueCompletion;
  let framebufferEpoch = 1;
  const pass = {
    setPipeline() {},
    setBindGroup() {},
    setVertexBuffer() {},
    drawIndirect() {},
    end() {}
  };
  const device = {
    createBuffer({ size = 4096 } = {}) {
      return new GPUBuffer(size);
    },
    createShaderModule() {
      return {};
    },
    async createRenderPipelineAsync() {
      return {
        getBindGroupLayout() {
          return {};
        }
      };
    },
    createCommandEncoder() {
      return {
        beginRenderPass() {
          return pass;
        },
        finish() {
          return {};
        }
      };
    },
    queue: {
      submit(commandBuffers) {
        submittedFrames.push(commandBuffers);
      },
      writeBuffer() {},
      onSubmittedWorkDone() {
        return queueCompletionPromise;
      }
    }
  };
  const presenter = createWorkerOwnedIsosurfacePresenter({
    device,
    context: {
      getCurrentTexture() {
        return { createView: () => ({}) };
      }
    },
    format: 'rgba8unorm',
    getDepthView: () => ({}),
    drawOverlay: (_pass, viewProjectionMatrix) => {
      drawnViewProjectionMatrices.push([...viewProjectionMatrix]);
    },
    onTerminal: (receipt) => terminals.push(receipt),
    onFrameSubmitted: (receipt) => submittedFrames.push(receipt),
    waitForPresentationOpportunity: async () => {
      presentationOpportunityCalls += 1;
      return {
        available: true,
        method: 'test-presentation-opportunity',
        observedAtMs: 1
      };
    },
    getFramebufferEpoch: () => framebufferEpoch,
    captureRenderRows,
    buildRenderField,
    buildPresentationFrame: useBuiltInFrame
      ? null
      : (buildPresentationFrame ?? (
          async (job) => ({
            generation: job.generation,
            invalidationEpoch: job.invalidationEpoch,
            sphStep: job.sphStep,
            receiptFields: job.receiptFields,
            viewProjectionMatrix: [...job.admission.viewProjectionMatrix],
            cameraPositionM: [...job.admission.cameraPositionM],
            boxDimsM: null,
            surfaces: []
          })
        ))
  });
  return {
    device,
    presenter,
    terminals,
    submittedFrames,
    drawnViewProjectionMatrices,
    get presentationOpportunityCalls() {
      return presentationOpportunityCalls;
    },
    setQueueCompletion(promise) {
      queueCompletionPromise = promise;
    },
    setFramebufferEpoch(epoch) {
      framebufferEpoch = epoch;
    }
  };
}

function viewProjectionWithTranslation(x) {
  const matrix = [...validRequest().viewProjectionMatrix];
  matrix[12] = x;
  return matrix;
}

function queueSubmissionCount(rig) {
  return rig.submittedFrames.filter(Array.isArray).length;
}

function validRequest() {
  return {
    schema: ULG_WORKER_OFFSCREEN_RESIDENT_ISOSURFACE_REQUEST_SCHEMA,
    enabled: true,
    geometryMode: 'true-isosurface',
    presentationGeometry:
      ULG_WORKER_OFFSCREEN_RESIDENT_ISOSURFACE_PRESENTATION_GEOMETRY,
    surfaceTable: {
      schema: 'peercompute.ulg.sph-gpu-render-field.v1',
      status: 'render-field-surface-table-built',
      surfaceCount: 1,
      totalFieldCells: 64,
      maxFieldCellCount: 64,
      records: new Float32Array(16),
      metadata: [{
        index: 0,
        resolution: 4,
        fieldOffset: 0,
        fieldCellCount: 64,
        isolation: 80,
        colorLinear: [0.1, 0.4, 0.9]
      }]
    },
    viewProjectionMatrix: new Float32Array([
      1, 0, 0, 0,
      0, 1, 0, 0,
      0, 0, 1, 0,
      0, 0, 0, 1
    ]),
    cameraPositionM: [1, 2, 3],
    fieldPadding: 0.22,
    refEdgeM: 1
  };
}

function validRetained(overrides = {}) {
  return {
    status: 'worker-retained-particle-state-ready',
    sameWorkerPrivateReferences: true,
    postMessageTransportAllowed: false,
    particleCount: 32,
    sphParticleState: {},
    mlsMpmParticleState: {},
    sphParticleUpload: {},
    mlsMpmParticleUpload: {},
    successorSourceFamily: {},
    sourceStateBuffer: new GPUBuffer(),
    sourceThermoBuffer: new GPUBuffer(),
    sourceMechanicsBuffer: new GPUBuffer(),
    sourceIdentityBuffer: new GPUBuffer(),
    ...overrides
  };
}

function authenticatedResidentProductMass(
  device,
  rowCapacity = 4,
  { borrowTransitions = null } = {}
) {
  const productEventBuffer = tagWebGpuBufferDevice(device.createBuffer({
    size: rowCapacity
      * SPH_GPU_REACTION_PRODUCT_EVENT_FLOATS
      * Float32Array.BYTES_PER_ELEMENT
  }), device);
  const controlBuffer = tagWebGpuBufferDevice(device.createBuffer({
    size: 512
  }), device);
  const source = {
    status: 'resident-product-mass-merged-gpu-resident',
    productEventBuffer,
    productEventBufferRetained: true,
    productEventBufferByteLength: productEventBuffer.size,
    productEventRowCount: rowCapacity,
    productEventStrideFloats: SPH_GPU_REACTION_PRODUCT_EVENT_FLOATS,
    productEventStrideBytes:
      SPH_GPU_REACTION_PRODUCT_EVENT_FLOATS * Float32Array.BYTES_PER_ELEMENT
  };
  let activeBorrowCount = 0;
  let released = false;
  Object.defineProperty(source, '__ulgActiveBorrowCount', {
    configurable: true,
    enumerable: false,
    get() {
      return activeBorrowCount;
    },
    set(value) {
      const nextCount = Math.max(0, Math.floor(Number(value) || 0));
      if (released && nextCount > activeBorrowCount) return;
      activeBorrowCount = nextCount;
      borrowTransitions?.push(activeBorrowCount);
      if (released && activeBorrowCount === 0) {
        revokeResidentProductEventCountAuthority(source);
      }
    }
  });
  registerResidentProductEventCountAuthority(source, {
    device,
    controlBuffer,
    controlOffsetBytes: 256,
    rowCapacity,
    rowStrideFloats: SPH_GPU_REACTION_PRODUCT_EVENT_FLOATS,
    generation: 7,
    seal: 11,
    zeroTailSealed: true
  });
  source.destroyResidentProductMassBuffers = () => {
    if (released) return false;
    released = true;
    if (activeBorrowCount > 0) {
      retireResidentProductEventCountAuthority(source);
    } else {
      revokeResidentProductEventCountAuthority(source);
    }
    return true;
  };
  return source;
}

function authenticatedDispersedMediumOptics(device, particleCount = 32) {
  const particles = Array.from({ length: particleCount }, (_value, index) => (
    index === 0
      ? {
          dispersedMediumOptics: {
            dispersedMaterialId: 17,
            dispersedPhaseId: 2,
            opticalStateId: 41,
            dispersedMassKg: 0.125,
            scatteringCrossSectionM2: 0.75,
            absorptionCrossSectionM2: 0.25,
            scatteringAsymmetryCrossSectionM2: 0.5
          }
        }
      : {}
  ));
  const packed = buildSphDispersedMediumGpuBuffers(particles);
  const identityBuffer = device.createBuffer({
    size: particleCount * Uint32Array.BYTES_PER_ELEMENT
  });
  const sidecar = uploadSphDispersedMediumGpuBuffers(device, packed, {
    particleLineage: {
      particleCount,
      topologyEpoch: 3,
      identityRevision: 'worker-owned-isosurface-sidecar-lineage-v1',
      identityBuffer
    }
  });
  dispersedIdentityBufferBySidecar.set(sidecar, identityBuffer);
  return sidecar;
}

function particleUploadWithDispersedMediumOptics(sidecar, overrides = {}) {
  return {
    particleCount: sidecar.particleCount,
    topologyEpoch: 3,
    identityRevision: 'worker-owned-isosurface-sidecar-lineage-v1',
    stateBuffer: new GPUBuffer(),
    thermoBuffer: new GPUBuffer(),
    identityBuffer: dispersedIdentityBufferBySidecar.get(sidecar),
    dispersedMediumOptics: sidecar,
    dispersedMediumOpticsAuthority: sidecar.authority,
    dispersedMediumOpticsBuffer: sidecar.buffer,
    dispersedMediumOpticsRowCount: sidecar.rowCount,
    dispersedMediumOpticsRowStrideFloats: sidecar.rowStrideFloats,
    dispersedMediumOpticsBufferByteLength: sidecar.bufferByteLength,
    ownsDispersedMediumOpticsBuffer: true,
    ...overrides
  };
}

test('worker-owned isosurface snapshots optical surface metadata before asynchronous extraction', () => {
  const metadata = {
    surfaceKey: 'steam-route',
    materialId: 17,
    phaseId: 2,
    opticalStateId: 41,
    opticalEffectiveOpacity: 0.375,
    opticalRoughness: 0.125,
    colorLinear: [0.2, 0.4, 0.8],
    opticalState: { regime: 'condensed-droplet' }
  };
  const snapshot = snapshotWorkerOwnedSurfaceMetadata(metadata);
  metadata.materialId = 99;
  metadata.opticalEffectiveOpacity = 1;
  metadata.colorLinear[0] = 1;
  metadata.opticalState.regime = 'mutated';

  assert.equal(snapshot.materialId, 17);
  assert.equal(snapshot.opticalEffectiveOpacity, 0.375);
  assert.deepEqual(snapshot.colorLinear, [0.2, 0.4, 0.8]);
  assert.equal(snapshot.opticalState.regime, 'condensed-droplet');
  assert.equal(Object.isFrozen(snapshot), true);
  assert.equal(Object.isFrozen(snapshot.colorLinear), true);
  assert.equal(Object.isFrozen(snapshot.opticalState), true);
});

test('worker-owned isosurface uniforms use closure opacity and preserve the legacy fallback', () => {
  const frame = {
    viewProjectionMatrix: validRequest().viewProjectionMatrix,
    cameraPositionM: [1, 2, 3]
  };
  const physicalHydrogen = buildWorkerOwnedIsosurfaceSurfaceUniformValues(frame, {
    metadata: {
      colorLinear: [1, 0.98, 0.96],
      transparencyClassId: 1,
      phaseId: 3,
      opticalResponseAuthorityFlag: 1,
      opticalEffectiveOpacity: 0,
      opticalRoughness: 0.9,
      depthWriteFlag: 0
    }
  });
  const physicalSteam = buildWorkerOwnedIsosurfaceSurfaceUniformValues(frame, {
    metadata: {
      colorLinear: [0.88, 0.92, 0.96],
      transparencyClassId: 1,
      phaseId: 3,
      opticalResponseAuthorityFlag: 1,
      opticalEffectiveOpacity: 0.62,
      opticalRoughness: 1,
      depthWriteFlag: 0
    }
  });
  const legacyGas = buildWorkerOwnedIsosurfaceSurfaceUniformValues(frame, {
    metadata: {
      colorLinear: [0.4, 0.8, 1],
      transparencyClassId: 1,
      phaseId: 3,
      depthWriteFlag: 0
    }
  });

  assert.equal(physicalHydrogen[23], 0);
  assert.ok(Math.abs(physicalHydrogen[27] - 0.9) < 1e-6);
  assert.equal(physicalHydrogen[35], 1);
  assert.ok(Math.abs(physicalSteam[23] - 0.62) < 1e-6);
  assert.equal(physicalSteam[35], 1);
  assert.equal(legacyGas[23], 1);
  assert.ok(Math.abs(legacyGas[27] - 0.12) < 1e-6);
  assert.equal(legacyGas[35], 0);

  const summary = summarizeWorkerOwnedIsosurfaceOpticalPresentation([
    {
      phaseId: 3,
      transparencyClassId: 1,
      opticalResponseAuthorityFlag: 1,
      opticalEffectiveOpacity: 0,
      opticalProvenanceSource: 'hydrogen-electronic-band'
    },
    {
      phaseId: 3,
      transparencyClassId: 1,
      opticalResponseAuthorityFlag: 1,
      opticalEffectiveOpacity: 0.62,
      opticalProvenanceSource: 'water-droplet-scattering'
    }
  ]);
  assert.equal(summary.status, 'all-gas-surfaces-closure-governed');
  assert.equal(summary.gasSurfaceCount, 2);
  assert.equal(summary.visibleClosureGasSurfaceCount, 1);
  assert.equal(summary.opticallyThinHiddenGasSurfaceCount, 1);
  assert.equal(summary.heuristicGasOpacityUsed, false);
});

test('worker-owned true-isosurface admission requires exact same-worker GPU authority', () => {
  const admission = resolveWorkerOwnedIsosurfaceAdmission({
    request: validRequest(),
    retained: validRetained()
  });
  assert.equal(admission.ok, true);
  assert.equal(admission.status, 'worker-owned-isosurface-admission-ready');
  assert.equal(admission.surfaceCount, 1);
  assert.equal(admission.totalFieldCells, 64);
  assert.equal(admission.particleCount, 32);
  assert.equal(Object.isFrozen(admission), true);
  assert.equal(Object.isFrozen(admission.blockers), true);

  for (const [field, value, blocker] of [
    ['sameWorkerPrivateReferences', false, 'same-worker-retained-authority'],
    ['postMessageTransportAllowed', true, 'same-worker-retained-authority'],
    ['successorSourceFamily', null, 'retained-private-references'],
    ['sourceIdentityBuffer', null, 'retained-gpu-buffers']
  ]) {
    const blocked = resolveWorkerOwnedIsosurfaceAdmission({
      request: validRequest(),
      retained: { ...validRetained(), [field]: value }
    });
    assert.equal(blocked.ok, false, `${field} must fail closed`);
    assert.ok(blocked.blockers.includes(blocker));
  }
});

test('worker-owned true-isosurface hands an authenticated retained product source to the branded field build', async () => {
  const fieldBuild = deferred();
  let fieldBuildOptions = null;
  let capturedReleased = false;
  const sourceFamily = { id: 'test-successor-family' };
  const captured = {
    particleCount: 32,
    renderRowsBuffer: new GPUBuffer(),
    schroederSpatialSourceFamily: sourceFamily,
    destroyRenderRowsBuffer() {
      capturedReleased = true;
    }
  };
  const rig = createPresenterRig({
    useBuiltInFrame: true,
    captureRenderRows: async () => captured,
    buildRenderField: async (options) => {
      fieldBuildOptions = options;
      await fieldBuild.promise;
      assert.equal(
        validateProductEventLiveCountCopyDescriptor(
          options.productEventLiveCountDescriptor,
          {
            handle: options.productEventSource,
            device: rig.device
          }
        ),
        true,
        'the queued build must retain its pre-issued descriptor through retirement'
      );
      return {
        surfaceTable: { ...options.surfaceTable, metadata: [] },
        schroederSpatialSourceFamily: options.schroederSpatialSourceFamily,
        fieldPadding: options.fieldPadding,
        refEdgeM: options.refEdgeM,
        destroyRenderFieldBuffers() {}
      };
    }
  });
  const residentProductMass = authenticatedResidentProductMass(rig.device, 4);
  const enqueueReceipt = await rig.presenter.enqueue({
    request: validRequest(),
    retained: validRetained({ residentProductMass }),
    sphStep: 12
  });

  assert.equal(
    enqueueReceipt.status,
    ULG_WORKER_OFFSCREEN_RESIDENT_ISOSURFACE_PRESENTATION_ENQUEUED_STATUS
  );
  await waitFor(() => fieldBuildOptions != null, 'the product-aware render-field build');
  assert.equal(residentProductMass.__ulgActiveBorrowCount, 1);
  assert.equal(fieldBuildOptions.renderRowsSource, captured);
  assert.equal(fieldBuildOptions.schroederSpatialSourceFamily, sourceFamily);
  assert.equal(
    fieldBuildOptions.productEventBuffer,
    residentProductMass.productEventBuffer
  );
  assert.equal(fieldBuildOptions.productEventSource, residentProductMass);
  assert.equal(fieldBuildOptions.productEventCount, 4);
  const preissuedDescriptor =
    fieldBuildOptions.productEventLiveCountDescriptor;
  assert.ok(preissuedDescriptor);
  assert.equal(
    validateProductEventLiveCountCopyDescriptor(preissuedDescriptor, {
      handle: residentProductMass,
      device: rig.device
    }),
    true
  );

  assert.equal(residentProductMass.destroyResidentProductMassBuffers(), true);
  assert.equal(
    residentProductMass.productEventRowCountAuthority,
    'gpu-authored-filtered-live-prefix-retiring'
  );
  assert.equal(
    resolveResidentProductEventCountAuthority(residentProductMass, rig.device),
    null
  );
  assert.equal(
    productEventLiveCountCopyDescriptor(residentProductMass, rig.device),
    null,
    'retirement must close issuance before the queued consumer submits'
  );
  assert.equal(
    validateProductEventLiveCountCopyDescriptor(preissuedDescriptor, {
      handle: residentProductMass,
      device: rig.device
    }),
    true,
    'the already-issued descriptor remains valid under the active borrow'
  );

  fieldBuild.resolve();
  await waitFor(
    () => rig.terminals.some((receipt) => (
      receipt.status
        === ULG_WORKER_OFFSCREEN_RESIDENT_ISOSURFACE_PRESENTATION_RENDERED_STATUS
    )),
    'the product-aware isosurface presentation'
  );
  assert.equal(residentProductMass.__ulgActiveBorrowCount, 0);
  assert.equal(
    validateProductEventLiveCountCopyDescriptor(preissuedDescriptor, {
      handle: residentProductMass,
      device: rig.device
    }),
    false,
    'the descriptor is revoked when the final presenter borrow drains'
  );
  assert.equal(
    residentProductMass.productEventRowCountAuthority,
    'gpu-authored-filtered-live-prefix-revoked'
  );
  assert.ok(queueSubmissionCount(rig) > 0);
  await waitFor(() => capturedReleased, 'the product-aware capture cleanup');
  await rig.presenter.dispose();
});

test('worker-owned product source and capture release exactly once when field construction rejects', async () => {
  const borrowTransitions = [];
  let captureReleaseCount = 0;
  const rig = createPresenterRig({
    useBuiltInFrame: true,
    captureRenderRows: async () => ({
      particleCount: 32,
      renderRowsBuffer: new GPUBuffer(),
      schroederSpatialSourceFamily: { id: 'rejected-field-family' },
      destroyRenderRowsBuffer() {
        captureReleaseCount += 1;
      }
    }),
    buildRenderField: async () => {
      throw new Error('injected authenticated product field rejection');
    }
  });
  const residentProductMass = authenticatedResidentProductMass(
    rig.device,
    4,
    { borrowTransitions }
  );
  const receipt = await rig.presenter.enqueue({
    request: validRequest(),
    retained: validRetained({ residentProductMass }),
    sphStep: 14,
    receiptFields: { lifecycleCase: 'product-field-rejection' }
  });

  assert.equal(
    receipt.status,
    ULG_WORKER_OFFSCREEN_RESIDENT_ISOSURFACE_PRESENTATION_ENQUEUED_STATUS
  );
  await waitFor(
    () => rig.terminals.some(
      (terminal) => terminal.lifecycleCase === 'product-field-rejection'
    ),
    'the rejected authenticated product field terminal'
  );
  await waitFor(
    () => captureReleaseCount === 1,
    'the rejected authenticated product capture cleanup'
  );

  const caseTerminals = rig.terminals.filter(
    (terminal) => terminal.lifecycleCase === 'product-field-rejection'
  );
  assert.equal(caseTerminals.length, 1);
  assert.equal(
    caseTerminals[0].status,
    ULG_WORKER_OFFSCREEN_RESIDENT_ISOSURFACE_PRESENTATION_FAILED_STATUS
  );
  assert.match(caseTerminals[0].reason, /injected authenticated product field rejection/);
  assert.equal(residentProductMass.__ulgActiveBorrowCount, 0);
  assert.deepEqual(borrowTransitions, [1, 0]);

  await rig.presenter.dispose();
  assert.equal(captureReleaseCount, 1);
  assert.deepEqual(borrowTransitions, [1, 0]);
  assert.equal(caseTerminals.length, 1);
});

test('clear releases an authenticated queued product source and capture exactly once before build', async () => {
  const activeBuild = deferred();
  const borrowTransitions = [];
  const captureReleaseCounts = [0, 0];
  let captureIndex = 0;
  const buildSteps = [];
  const rig = createPresenterRig({
    captureRenderRows: async () => {
      const index = captureIndex;
      captureIndex += 1;
      return {
        destroyRenderRowsBuffer() {
          captureReleaseCounts[index] += 1;
        }
      };
    },
    buildPresentationFrame: async (job) => {
      buildSteps.push(job.sphStep);
      if (job.sphStep === 15) await activeBuild.promise;
      return {
        generation: job.generation,
        invalidationEpoch: job.invalidationEpoch,
        sphStep: job.sphStep,
        receiptFields: job.receiptFields,
        viewProjectionMatrix: [...job.admission.viewProjectionMatrix],
        cameraPositionM: [...job.admission.cameraPositionM],
        boxDimsM: null,
        surfaces: []
      };
    }
  });
  await rig.presenter.enqueue({
    request: validRequest(),
    retained: validRetained(),
    sphStep: 15
  });
  await waitFor(() => buildSteps.length === 1, 'the active predecessor frame build');

  const residentProductMass = authenticatedResidentProductMass(
    rig.device,
    4,
    { borrowTransitions }
  );
  const queuedReceipt = await rig.presenter.enqueue({
    request: validRequest(),
    retained: validRetained({ residentProductMass }),
    sphStep: 16,
    receiptFields: { lifecycleCase: 'queued-product-clear' }
  });
  assert.equal(
    queuedReceipt.status,
    ULG_WORKER_OFFSCREEN_RESIDENT_ISOSURFACE_PRESENTATION_ENQUEUED_STATUS
  );
  assert.deepEqual(buildSteps, [15]);
  assert.equal(residentProductMass.__ulgActiveBorrowCount, 1);

  assert.equal(rig.presenter.clear({ reason: 'test-clear-queued-product' }), true);
  await waitFor(
    () => captureReleaseCounts[1] === 1,
    'the cleared queued product capture cleanup'
  );

  const queuedTerminals = rig.terminals.filter(
    (terminal) => terminal.lifecycleCase === 'queued-product-clear'
  );
  assert.equal(queuedTerminals.length, 1);
  assert.equal(
    queuedTerminals[0].status,
    ULG_WORKER_OFFSCREEN_RESIDENT_ISOSURFACE_PRESENTATION_SUPERSEDED_STATUS
  );
  assert.deepEqual(buildSteps, [15]);
  assert.equal(residentProductMass.__ulgActiveBorrowCount, 0);
  assert.deepEqual(borrowTransitions, [1, 0]);

  activeBuild.resolve();
  await waitFor(
    () => rig.presenter.getStatus().running === false,
    'the cleared predecessor build cleanup'
  );
  await rig.presenter.dispose();
  assert.equal(captureReleaseCounts[1], 1);
  assert.deepEqual(borrowTransitions, [1, 0]);
  assert.equal(
    rig.terminals.filter(
      (terminal) => terminal.lifecycleCase === 'queued-product-clear'
    ).length,
    1
  );
});

test('worker-owned true-isosurface preserves the branded zero-product field call', async () => {
  let fieldBuildOptions = null;
  const sourceFamily = { id: 'test-zero-product-successor-family' };
  const captured = {
    particleCount: 32,
    renderRowsBuffer: new GPUBuffer(),
    schroederSpatialSourceFamily: sourceFamily,
    destroyRenderRowsBuffer() {}
  };
  const rig = createPresenterRig({
    useBuiltInFrame: true,
    captureRenderRows: async () => captured,
    buildRenderField: async (options) => {
      fieldBuildOptions = options;
      return {
        surfaceTable: { ...options.surfaceTable, metadata: [] },
        schroederSpatialSourceFamily: options.schroederSpatialSourceFamily,
        fieldPadding: options.fieldPadding,
        refEdgeM: options.refEdgeM,
        destroyRenderFieldBuffers() {}
      };
    }
  });
  await rig.presenter.enqueue({
    request: validRequest(),
    retained: validRetained(),
    sphStep: 13
  });
  await waitFor(() => fieldBuildOptions != null, 'the zero-product render-field build');

  assert.equal(fieldBuildOptions.renderRowsSource, captured);
  assert.equal(fieldBuildOptions.schroederSpatialSourceFamily, sourceFamily);
  assert.equal(fieldBuildOptions.productEventBuffer, null);
  assert.equal(fieldBuildOptions.productEventSource, null);
  assert.equal(fieldBuildOptions.productEventCount, 0);
  await rig.presenter.dispose();
});

test('worker-owned true-isosurface rejects every torn dispersed-medium alias singleton', async () => {
  let captureCount = 0;
  const rig = createPresenterRig({
    captureRenderRows: async () => {
      captureCount += 1;
      return { destroyRenderRowsBuffer() {} };
    }
  });
  const sidecar = authenticatedDispersedMediumOptics(rig.device);
  const singletonCases = [
    ['dispersedMediumOptics', sidecar],
    ['dispersedMediumOptics', false],
    ['dispersedMediumOpticsAuthority', sidecar.authority],
    ['dispersedMediumOpticsAuthority', 0],
    ['dispersedMediumOpticsBuffer', sidecar.buffer],
    ['dispersedMediumOpticsBuffer', ''],
    ['dispersedMediumOpticsRowCount', sidecar.rowCount],
    ['dispersedMediumOpticsRowCount', false],
    ['dispersedMediumOpticsRowStrideFloats', sidecar.rowStrideFloats],
    ['dispersedMediumOpticsRowStrideFloats', ''],
    ['dispersedMediumOpticsBufferByteLength', sidecar.bufferByteLength],
    ['dispersedMediumOpticsBufferByteLength', Number.NaN],
    ['ownsDispersedMediumOpticsBuffer', true]
  ];

  for (const [field, value] of singletonCases) {
    const receipt = await rig.presenter.enqueue({
      request: validRequest(),
      retained: validRetained({
        sphParticleUpload: {
          particleCount: sidecar.particleCount,
          [field]: value
        }
      }),
      receiptFields: { tornField: field }
    });
    assert.equal(
      receipt.status,
      ULG_WORKER_OFFSCREEN_RESIDENT_ISOSURFACE_PRESENTATION_FAILED_STATUS,
      `${field} must not be mistaken for an absent sidecar`
    );
    assert.match(receipt.reason, /torn dispersed-medium particle-upload aliases/);
  }

  assert.equal(captureCount, 0);
  assert.equal(destroySphDispersedMediumGpuBuffers(sidecar), true);
  assert.equal(sidecar.buffer.destroyCount, 1);
  await rig.presenter.dispose();
});

test('worker-owned true-isosurface pre-borrows and forwards the exact dispersed-medium sidecar', async () => {
  const fieldBuild = deferred();
  let fieldBuildOptions = null;
  let captureReleaseCount = 0;
  const rig = createPresenterRig({
    useBuiltInFrame: true,
    captureRenderRows: async ({ sphParticleUpload }) => ({
      particleCount: sphParticleUpload.particleCount,
      renderRowsBuffer: new GPUBuffer(),
      dispersedMediumOptics: sphParticleUpload.dispersedMediumOptics,
      schroederSpatialSourceFamily: { id: 'dispersed-success-family' },
      destroyRenderRowsBuffer() {
        captureReleaseCount += 1;
      }
    }),
    buildRenderField: async (options) => {
      fieldBuildOptions = options;
      await fieldBuild.promise;
      return {
        surfaceTable: { ...options.surfaceTable, metadata: [] },
        schroederSpatialSourceFamily: options.schroederSpatialSourceFamily,
        fieldPadding: options.fieldPadding,
        refEdgeM: options.refEdgeM,
        destroyRenderFieldBuffers() {}
      };
    }
  });
  const sidecar = authenticatedDispersedMediumOptics(rig.device);
  const sphParticleUpload = particleUploadWithDispersedMediumOptics(sidecar);

  const receipt = await rig.presenter.enqueue({
    request: validRequest(),
    retained: validRetained({ sphParticleUpload }),
    sphStep: 17,
    receiptFields: { lifecycleCase: 'dispersed-success' }
  });
  assert.equal(
    receipt.status,
    ULG_WORKER_OFFSCREEN_RESIDENT_ISOSURFACE_PRESENTATION_ENQUEUED_STATUS
  );
  await waitFor(() => fieldBuildOptions != null, 'the dispersed render-field build');
  assert.strictEqual(fieldBuildOptions.dispersedMediumOptics, sidecar);

  assert.equal(destroySphDispersedMediumGpuBuffers(sidecar), true);
  assert.equal(sidecar.destroyPending, true);
  assert.equal(sidecar.buffer.destroyCount, 0);
  fieldBuild.resolve();

  await waitFor(
    () => rig.terminals.some((terminal) => (
      terminal.lifecycleCase === 'dispersed-success'
      && terminal.status
        === ULG_WORKER_OFFSCREEN_RESIDENT_ISOSURFACE_PRESENTATION_RENDERED_STATUS
    )),
    'the dispersed render-field presentation'
  );
  await waitFor(() => sidecar.buffer.destroyCount === 1, 'the dispersed source release');
  await waitFor(() => captureReleaseCount === 1, 'the dispersed capture release');
  assert.equal(sidecar.destroyed, true);

  await rig.presenter.dispose();
  assert.equal(sidecar.buffer.destroyCount, 1);
  assert.equal(captureReleaseCount, 1);
});

test('worker-owned true-isosurface rejects a capture that substitutes its dispersed-medium sidecar', async () => {
  let captureReleaseCount = 0;
  let fieldBuildCount = 0;
  const rig = createPresenterRig({
    useBuiltInFrame: true,
    captureRenderRows: async () => ({
      particleCount: 32,
      renderRowsBuffer: new GPUBuffer(),
      dispersedMediumOptics: {},
      destroyRenderRowsBuffer() {
        captureReleaseCount += 1;
      }
    }),
    buildRenderField: async () => {
      fieldBuildCount += 1;
      throw new Error('substituted sidecar reached the field builder');
    }
  });
  const sidecar = authenticatedDispersedMediumOptics(rig.device);
  const receipt = await rig.presenter.enqueue({
    request: validRequest(),
    retained: validRetained({
      sphParticleUpload: particleUploadWithDispersedMediumOptics(sidecar)
    })
  });

  assert.equal(
    receipt.status,
    ULG_WORKER_OFFSCREEN_RESIDENT_ISOSURFACE_PRESENTATION_FAILED_STATUS
  );
  assert.match(receipt.reason, /did not retain its exact dispersed-medium sidecar/);
  assert.equal(fieldBuildCount, 0);
  await waitFor(() => captureReleaseCount === 1, 'the substituted capture release');
  assert.equal(destroySphDispersedMediumGpuBuffers(sidecar), true);
  assert.equal(sidecar.buffer.destroyCount, 1);
  await rig.presenter.dispose();
  assert.equal(sidecar.buffer.destroyCount, 1);
  assert.equal(captureReleaseCount, 1);
});

test('worker-owned true-isosurface releases a pre-borrowed sidecar when source capture rejects', async () => {
  const capture = deferred();
  let captureStarted = false;
  const rig = createPresenterRig({
    captureRenderRows: async () => {
      captureStarted = true;
      return capture.promise;
    }
  });
  const sidecar = authenticatedDispersedMediumOptics(rig.device);
  const enqueuePromise = rig.presenter.enqueue({
    request: validRequest(),
    retained: validRetained({
      sphParticleUpload: particleUploadWithDispersedMediumOptics(sidecar)
    }),
    receiptFields: { lifecycleCase: 'dispersed-capture-rejection' }
  });

  await waitFor(() => captureStarted, 'the dispersed source capture');
  assert.equal(destroySphDispersedMediumGpuBuffers(sidecar), true);
  assert.equal(sidecar.destroyPending, true);
  assert.equal(sidecar.buffer.destroyCount, 0);
  capture.reject(new Error('injected dispersed capture rejection'));

  const receipt = await enqueuePromise;
  assert.equal(
    receipt.status,
    ULG_WORKER_OFFSCREEN_RESIDENT_ISOSURFACE_PRESENTATION_FAILED_STATUS
  );
  assert.match(receipt.reason, /injected dispersed capture rejection/);
  assert.equal(sidecar.destroyed, true);
  assert.equal(sidecar.buffer.destroyCount, 1);
  await rig.presenter.dispose();
  assert.equal(sidecar.buffer.destroyCount, 1);
});

test('worker-owned true-isosurface releases a pre-borrowed sidecar when field construction rejects', async () => {
  const fieldBuild = deferred();
  let fieldBuildStarted = false;
  const rig = createPresenterRig({
    useBuiltInFrame: true,
    captureRenderRows: async ({ sphParticleUpload }) => ({
      particleCount: sphParticleUpload.particleCount,
      renderRowsBuffer: new GPUBuffer(),
      dispersedMediumOptics: sphParticleUpload.dispersedMediumOptics,
      schroederSpatialSourceFamily: { id: 'dispersed-rejection-family' },
      destroyRenderRowsBuffer() {}
    }),
    buildRenderField: async () => {
      fieldBuildStarted = true;
      return fieldBuild.promise;
    }
  });
  const sidecar = authenticatedDispersedMediumOptics(rig.device);
  const receipt = await rig.presenter.enqueue({
    request: validRequest(),
    retained: validRetained({
      sphParticleUpload: particleUploadWithDispersedMediumOptics(sidecar)
    }),
    receiptFields: { lifecycleCase: 'dispersed-field-rejection' }
  });
  assert.equal(
    receipt.status,
    ULG_WORKER_OFFSCREEN_RESIDENT_ISOSURFACE_PRESENTATION_ENQUEUED_STATUS
  );
  await waitFor(() => fieldBuildStarted, 'the rejecting dispersed field build');
  assert.equal(destroySphDispersedMediumGpuBuffers(sidecar), true);
  assert.equal(sidecar.destroyPending, true);
  fieldBuild.reject(new Error('injected dispersed field rejection'));

  await waitFor(
    () => rig.terminals.some((terminal) => (
      terminal.lifecycleCase === 'dispersed-field-rejection'
    )),
    'the dispersed field rejection terminal'
  );
  assert.equal(sidecar.destroyed, true);
  assert.equal(sidecar.buffer.destroyCount, 1);
  await rig.presenter.dispose();
  assert.equal(sidecar.buffer.destroyCount, 1);
});

test('a synchronous cleanup-fence failure cannot suppress later source retirement', async () => {
  const fieldBuild = deferred();
  let fieldBuildStarted = false;
  let captureReleaseCount = 0;
  const rig = createPresenterRig({
    useBuiltInFrame: true,
    captureRenderRows: async ({ sphParticleUpload }) => ({
      particleCount: sphParticleUpload.particleCount,
      renderRowsBuffer: new GPUBuffer(),
      dispersedMediumOptics: sphParticleUpload.dispersedMediumOptics,
      schroederSpatialSourceFamily: { id: 'sync-fence-failure-family' },
      destroyRenderRowsBuffer() {
        captureReleaseCount += 1;
      }
    }),
    buildRenderField: async () => {
      fieldBuildStarted = true;
      return fieldBuild.promise;
    }
  });
  rig.device.queue.onSubmittedWorkDone = () => {
    throw new Error('injected synchronous fence scheduling failure');
  };
  const sidecar = authenticatedDispersedMediumOptics(rig.device);
  await rig.presenter.enqueue({
    request: validRequest(),
    retained: validRetained({
      sphParticleUpload: particleUploadWithDispersedMediumOptics(sidecar)
    }),
    receiptFields: { lifecycleCase: 'sync-cleanup-fence-failure' }
  });
  await waitFor(() => fieldBuildStarted, 'the synchronous-fence field build');
  assert.equal(destroySphDispersedMediumGpuBuffers(sidecar), true);
  assert.equal(sidecar.destroyPending, true);
  fieldBuild.reject(new Error('injected field failure before cleanup'));

  await waitFor(
    () => rig.terminals.some((terminal) => (
      terminal.lifecycleCase === 'sync-cleanup-fence-failure'
    )),
    'the synchronous cleanup-fence terminal'
  );
  await waitFor(() => rig.presenter.getStatus().running === false, 'the failed job unwind');
  assert.equal(captureReleaseCount, 1);
  assert.equal(sidecar.destroyed, true);
  assert.equal(sidecar.buffer.destroyCount, 1);
  await rig.presenter.dispose();
});

test('a newer queued frame releases a superseded dispersed-medium source exactly once', async () => {
  const activeBuild = deferred();
  const buildSteps = [];
  const rig = createPresenterRig({
    captureRenderRows: async ({ sphParticleUpload }) => ({
      dispersedMediumOptics: sphParticleUpload.dispersedMediumOptics ?? null,
      destroyRenderRowsBuffer() {}
    }),
    buildPresentationFrame: async (job) => {
      buildSteps.push(job.sphStep);
      if (job.sphStep === 51) await activeBuild.promise;
      return {
        generation: job.generation,
        invalidationEpoch: job.invalidationEpoch,
        sphStep: job.sphStep,
        receiptFields: job.receiptFields,
        viewProjectionMatrix: [...job.admission.viewProjectionMatrix],
        cameraPositionM: [...job.admission.cameraPositionM],
        boxDimsM: null,
        surfaces: []
      };
    }
  });
  await rig.presenter.enqueue({
    request: validRequest(),
    retained: validRetained(),
    sphStep: 51
  });
  await waitFor(() => buildSteps.length === 1, 'the active predecessor build');

  const sidecar = authenticatedDispersedMediumOptics(rig.device);
  await rig.presenter.enqueue({
    request: validRequest(),
    retained: validRetained({
      sphParticleUpload: particleUploadWithDispersedMediumOptics(sidecar)
    }),
    sphStep: 52,
    receiptFields: { lifecycleCase: 'queued-dispersed-superseded' }
  });
  assert.equal(destroySphDispersedMediumGpuBuffers(sidecar), true);
  assert.equal(sidecar.destroyPending, true);

  await rig.presenter.enqueue({
    request: validRequest(),
    retained: validRetained(),
    sphStep: 53
  });
  await waitFor(() => sidecar.buffer.destroyCount === 1, 'the superseded sidecar release');
  const terminals = rig.terminals.filter((terminal) => (
    terminal.lifecycleCase === 'queued-dispersed-superseded'
  ));
  assert.equal(terminals.length, 1);
  assert.equal(
    terminals[0].status,
    ULG_WORKER_OFFSCREEN_RESIDENT_ISOSURFACE_PRESENTATION_SUPERSEDED_STATUS
  );

  activeBuild.resolve();
  await waitFor(() => rig.presenter.getStatus().running === false, 'the queue drain');
  await rig.presenter.dispose();
  assert.equal(sidecar.buffer.destroyCount, 1);
});

test('worker-owned true-isosurface rolls back a sidecar borrow after synchronous product-source rejection', async () => {
  let captureCount = 0;
  const rig = createPresenterRig({
    captureRenderRows: async () => {
      captureCount += 1;
      return { destroyRenderRowsBuffer() {} };
    }
  });
  const sidecar = authenticatedDispersedMediumOptics(rig.device);
  const receipt = await rig.presenter.enqueue({
    request: validRequest(),
    retained: validRetained({
      sphParticleUpload: particleUploadWithDispersedMediumOptics(sidecar),
      residentProductMass: {
        productEventBuffer: new GPUBuffer(),
        productEventRowCount: 1,
        productEventRowCapacity: 1
      }
    }),
    receiptFields: { lifecycleCase: 'dispersed-sync-rollback' }
  });
  assert.equal(
    receipt.status,
    ULG_WORKER_OFFSCREEN_RESIDENT_ISOSURFACE_PRESENTATION_FAILED_STATUS
  );
  assert.match(receipt.reason, /authenticated GPU live-count capacity/);
  assert.equal(captureCount, 0);
  assert.equal(destroySphDispersedMediumGpuBuffers(sidecar), true);
  assert.equal(sidecar.buffer.destroyCount, 1);
  await rig.presenter.dispose();
  assert.equal(sidecar.buffer.destroyCount, 1);
});

test('worker-owned true-isosurface releases a sidecar after an asynchronous presentation fence rejection', async () => {
  const fence = deferred();
  const rig = createPresenterRig({
    queueCompletion: fence.promise,
    captureRenderRows: async ({ sphParticleUpload }) => ({
      dispersedMediumOptics: sphParticleUpload.dispersedMediumOptics,
      destroyRenderRowsBuffer() {}
    })
  });
  const sidecar = authenticatedDispersedMediumOptics(rig.device);
  const receipt = await rig.presenter.enqueue({
    request: validRequest(),
    retained: validRetained({
      sphParticleUpload: particleUploadWithDispersedMediumOptics(sidecar)
    }),
    sphStep: 54,
    receiptFields: { lifecycleCase: 'dispersed-fence-rejection' }
  });
  assert.equal(
    receipt.status,
    ULG_WORKER_OFFSCREEN_RESIDENT_ISOSURFACE_PRESENTATION_ENQUEUED_STATUS
  );
  await waitFor(() => queueSubmissionCount(rig) === 1, 'the dispersed frame submission');
  assert.equal(destroySphDispersedMediumGpuBuffers(sidecar), true);
  assert.equal(sidecar.destroyPending, true);
  fence.reject(new Error('injected dispersed presentation fence rejection'));

  await waitFor(
    () => rig.terminals.some((terminal) => (
      terminal.lifecycleCase === 'dispersed-fence-rejection'
    )),
    'the dispersed presentation fence rejection terminal'
  );
  assert.equal(sidecar.destroyed, true);
  assert.equal(sidecar.buffer.destroyCount, 1);
  await rig.presenter.dispose();
  assert.equal(sidecar.buffer.destroyCount, 1);
});

test('dispose waits for an in-flight source capture to release its dispersed sidecar', async () => {
  const capture = deferred();
  let captureStarted = false;
  let capturedRowsReleased = 0;
  const rig = createPresenterRig({
    captureRenderRows: async () => {
      captureStarted = true;
      return capture.promise;
    }
  });
  const sidecar = authenticatedDispersedMediumOptics(rig.device);
  const enqueuePromise = rig.presenter.enqueue({
    request: validRequest(),
    retained: validRetained({
      sphParticleUpload: particleUploadWithDispersedMediumOptics(sidecar)
    }),
    sphStep: 55,
    receiptFields: { lifecycleCase: 'dispose-during-dispersed-capture' }
  });
  await waitFor(() => captureStarted, 'the deferred dispersed source capture');

  let disposeSettled = false;
  const disposePromise = rig.presenter.dispose().then(() => {
    disposeSettled = true;
  });
  assert.equal(destroySphDispersedMediumGpuBuffers(sidecar), true);
  assert.equal(sidecar.destroyPending, true);
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(
    disposeSettled,
    false,
    'dispose must retain presenter resources until the source capture unwinds'
  );
  assert.notEqual(sidecar.destroyed, true);

  capture.resolve({
    dispersedMediumOptics: sidecar,
    destroyRenderRowsBuffer() {
      capturedRowsReleased += 1;
    }
  });
  const receipt = await enqueuePromise;
  await disposePromise;

  assert.equal(
    receipt.status,
    ULG_WORKER_OFFSCREEN_RESIDENT_ISOSURFACE_PRESENTATION_SUPERSEDED_STATUS
  );
  assert.equal(capturedRowsReleased, 1);
  assert.equal(sidecar.destroyed, true);
  assert.equal(sidecar.buffer.destroyCount, 1);
  assert.equal(disposeSettled, true);
});

test('worker-owned true-isosurface rejects a copied product-count authority', async () => {
  const rig = createPresenterRig();
  const residentProductMass = authenticatedResidentProductMass(rig.device, 2);
  const copiedSource = {
    ...residentProductMass,
    __ulgActiveBorrowCount: 0
  };
  assert.throws(
    () => resolveWorkerOwnedIsosurfaceProductEventSource({
      device: rig.device,
      retained: validRetained({ residentProductMass: copiedSource })
    }),
    /authenticated GPU live-count capacity/
  );
  await rig.presenter.dispose();
});

test('worker-owned true-isosurface admission rejects torn tables and camera state', () => {
  const request = validRequest();
  const cases = [
    { surfaceTable: { ...request.surfaceTable, records: [] }, blocker: 'surface-table' },
    { surfaceTable: { ...request.surfaceTable, metadata: [] }, blocker: 'surface-table' },
    { viewProjectionMatrix: [1, 2, 3], blocker: 'view-projection' },
    { cameraPositionM: [1, 2], blocker: 'camera-position' },
    { refEdgeM: 0, blocker: 'reference-edge' }
  ];
  for (const { blocker, ...override } of cases) {
    const admission = resolveWorkerOwnedIsosurfaceAdmission({
      request: { ...request, ...override },
      retained: validRetained()
    });
    assert.equal(admission.ok, false);
    assert.ok(admission.blockers.includes(blocker));
  }
});

test('clear during source capture retires the pre-clear isosurface before submit', async () => {
  const capture = deferred();
  let captureStarted = false;
  let captureReleased = false;
  const rig = createPresenterRig({
    captureRenderRows: async () => {
      captureStarted = true;
      return capture.promise;
    }
  });
  const enqueuePromise = rig.presenter.enqueue({
    request: validRequest(),
    retained: validRetained(),
    sphStep: 10
  });
  await waitFor(() => captureStarted, 'the deferred isosurface source capture');

  rig.setFramebufferEpoch(2);
  assert.equal(rig.presenter.clear({ reason: 'test-clear-during-capture' }), true);
  rig.setFramebufferEpoch(3);
  const resizeAfterClear = rig.presenter.resize({
    reason: 'test-resize-after-clear-during-capture'
  });
  capture.resolve({
    destroyRenderRowsBuffer() {
      captureReleased = true;
    }
  });
  const receipt = await enqueuePromise;

  assert.equal(
    receipt.status,
    ULG_WORKER_OFFSCREEN_RESIDENT_ISOSURFACE_PRESENTATION_SUPERSEDED_STATUS
  );
  assert.equal(queueSubmissionCount(rig), 0);
  assert.equal(await resizeAfterClear, false);
  assert.equal(
    rig.terminals.some((terminal) =>
      terminal.status
        === ULG_WORKER_OFFSCREEN_RESIDENT_ISOSURFACE_PRESENTATION_RENDERED_STATUS),
    false
  );
  await waitFor(() => captureReleased, 'the invalidated capture cleanup');
  await rig.presenter.dispose();
});

test('clear during a committed-frame GPU fence supersedes the stale isosurface', async () => {
  const fence = deferred();
  const rig = createPresenterRig({ queueCompletion: fence.promise });
  await rig.presenter.enqueue({
    request: validRequest(),
    retained: validRetained(),
    sphStep: 12
  });
  await waitFor(
    () => rig.submittedFrames.length === 1,
    'the committed isosurface queue submission'
  );

  rig.setFramebufferEpoch(2);
  assert.equal(rig.presenter.clear({ reason: 'test-clear-during-fence' }), true);
  fence.resolve();
  await waitFor(
    () => rig.presenter.getStatus().running === false,
    'the invalidated isosurface job to retire'
  );

  assert.equal(
    rig.terminals.some((receipt) =>
      receipt.status === ULG_WORKER_OFFSCREEN_RESIDENT_ISOSURFACE_PRESENTATION_RENDERED_STATUS),
    false
  );
  assert.equal(
    rig.terminals.some((receipt) =>
      receipt.status === ULG_WORKER_OFFSCREEN_RESIDENT_ISOSURFACE_PRESENTATION_SUPERSEDED_STATUS),
    true
  );
  assert.equal(rig.presentationOpportunityCalls, 0);
  assert.equal(rig.presenter.getStatus().visibleGeneration, null);
  await rig.presenter.dispose();
});

test('a resize after clear cannot rebase a pre-clear frame waiting on its GPU fence', async () => {
  const fence = deferred();
  const rig = createPresenterRig({ queueCompletion: fence.promise });
  await rig.presenter.enqueue({
    request: validRequest(),
    retained: validRetained(),
    sphStep: 14
  });
  await waitFor(
    () => queueSubmissionCount(rig) === 1,
    'the pre-clear isosurface queue submission'
  );

  rig.setFramebufferEpoch(2);
  assert.equal(rig.presenter.clear({ reason: 'test-clear-before-resize' }), true);
  rig.setFramebufferEpoch(3);
  const resizeAfterClear = rig.presenter.resize({
    reason: 'test-resize-after-clear-during-fence'
  });
  fence.resolve();

  assert.equal(await resizeAfterClear, false);
  await waitFor(
    () => rig.presenter.getStatus().running === false,
    'the pre-clear isosurface frame to retire'
  );
  assert.equal(
    queueSubmissionCount(rig),
    1,
    'the pre-clear frame must not be resubmitted at the post-resize epoch'
  );
  assert.equal(
    rig.terminals.some((receipt) =>
      receipt.status
        === ULG_WORKER_OFFSCREEN_RESIDENT_ISOSURFACE_PRESENTATION_RENDERED_STATUS),
    false
  );
  assert.equal(rig.presenter.getStatus().visibleGeneration, null);
  await rig.presenter.dispose();
});

test('clear during a redraw fence cannot republish the retired visible frame', async () => {
  const rig = createPresenterRig();
  await rig.presenter.enqueue({
    request: validRequest(),
    retained: validRetained(),
    sphStep: 18
  });
  await waitFor(
    () => rig.presenter.getStatus().visibleGeneration !== null,
    'the initial isosurface frame to become visible'
  );
  const renderedBeforeRedraw = rig.terminals.filter((receipt) =>
    receipt.status === ULG_WORKER_OFFSCREEN_RESIDENT_ISOSURFACE_PRESENTATION_RENDERED_STATUS).length;

  const redrawFence = deferred();
  rig.setQueueCompletion(redrawFence.promise);
  const redrawPromise = rig.presenter.redraw({ reason: 'test-redraw-clear-race' });
  await waitFor(
    () => rig.submittedFrames.length >= 3,
    'the redraw queue submission'
  );
  rig.setFramebufferEpoch(2);
  assert.equal(rig.presenter.clear({ reason: 'test-clear-during-redraw' }), true);
  redrawFence.resolve();

  assert.equal(await redrawPromise, false);
  assert.equal(
    rig.terminals.filter((receipt) =>
      receipt.status === ULG_WORKER_OFFSCREEN_RESIDENT_ISOSURFACE_PRESENTATION_RENDERED_STATUS).length,
    renderedBeforeRedraw
  );
  assert.equal(rig.presenter.getStatus().visibleGeneration, null);
  await rig.presenter.dispose();
});

test('camera redraw bursts serialize and coalesce to the latest matrix', async () => {
  const rig = createPresenterRig();
  await rig.presenter.enqueue({
    request: validRequest(),
    retained: validRetained(),
    sphStep: 21
  });
  await waitFor(
    () => rig.presenter.getStatus().visibleGeneration !== null,
    'the initial frame before the redraw burst'
  );

  const firstFence = deferred();
  rig.setQueueCompletion(firstFence.promise);
  const firstMatrix = viewProjectionWithTranslation(1);
  const middleMatrix = viewProjectionWithTranslation(2);
  const latestMatrix = viewProjectionWithTranslation(3);
  const firstRedraw = rig.presenter.redraw({
    viewProjectionMatrix: firstMatrix,
    reason: 'test-first-redraw'
  });
  await waitFor(
    () => queueSubmissionCount(rig) === 2,
    'the first serialized redraw submission'
  );
  const middleRedraw = rig.presenter.redraw({
    viewProjectionMatrix: middleMatrix,
    reason: 'test-middle-redraw'
  });
  const latestRedraw = rig.presenter.redraw({
    viewProjectionMatrix: latestMatrix,
    reason: 'test-latest-redraw'
  });

  assert.equal(await middleRedraw, false);
  firstFence.resolve();
  assert.equal(await firstRedraw, true);
  assert.equal(await latestRedraw, true);
  assert.equal(queueSubmissionCount(rig), 3);
  assert.deepEqual(
    rig.drawnViewProjectionMatrices.at(-1),
    latestMatrix
  );
  assert.equal(
    rig.drawnViewProjectionMatrices.some((matrix) => matrix[12] === 2),
    false
  );
  await rig.presenter.dispose();
});

test('a camera update during a committed frame redraws only the replacement frame', async () => {
  const rig = createPresenterRig();
  await rig.presenter.enqueue({
    request: validRequest(),
    retained: validRetained(),
    sphStep: 24
  });
  await waitFor(
    () => rig.presenter.getStatus().visibleGeneration === 1,
    'the first committed isosurface frame'
  );

  const committedFence = deferred();
  rig.setQueueCompletion(committedFence.promise);
  await rig.presenter.enqueue({
    request: validRequest(),
    retained: validRetained(),
    sphStep: 25
  });
  await waitFor(
    () => queueSubmissionCount(rig) === 2,
    'the replacement committed isosurface submission'
  );
  const carriedMatrix = viewProjectionWithTranslation(7);
  const carriedRedraw = rig.presenter.redraw({
    viewProjectionMatrix: carriedMatrix,
    reason: 'test-carried-camera-redraw'
  });
  assert.equal(queueSubmissionCount(rig), 2);

  committedFence.resolve();
  await waitFor(
    () => rig.presenter.getStatus().visibleGeneration === 2,
    'the replacement isosurface frame to become visible'
  );
  assert.equal(await carriedRedraw, true);
  assert.equal(queueSubmissionCount(rig), 3);
  assert.deepEqual(rig.drawnViewProjectionMatrices.at(-1), carriedMatrix);
  assert.equal(
    rig.terminals.filter((receipt) =>
      receipt.status === ULG_WORKER_OFFSCREEN_RESIDENT_ISOSURFACE_PRESENTATION_RENDERED_STATUS).length,
    3
  );
  await rig.presenter.dispose();
});

test('resize during frame construction rebases and presents the completed replacement', async () => {
  const buildGate = deferred();
  let buildStarted = false;
  const rig = createPresenterRig({
    buildPresentationFrame: async (job) => {
      buildStarted = true;
      await buildGate.promise;
      return {
        generation: job.generation,
        invalidationEpoch: job.invalidationEpoch,
        sphStep: job.sphStep,
        receiptFields: job.receiptFields,
        viewProjectionMatrix: [...job.admission.viewProjectionMatrix],
        cameraPositionM: [...job.admission.cameraPositionM],
        boxDimsM: null,
        surfaces: []
      };
    }
  });
  await rig.presenter.enqueue({
    request: validRequest(),
    retained: validRetained(),
    sphStep: 28
  });
  await waitFor(() => buildStarted, 'the deferred isosurface frame construction');

  const resizedMatrix = viewProjectionWithTranslation(8);
  rig.setFramebufferEpoch(2);
  const resizeRedraw = rig.presenter.resize({
    viewProjectionMatrix: resizedMatrix,
    reason: 'test-resize-during-frame-construction'
  });
  buildGate.resolve();

  assert.equal(await resizeRedraw, true);
  assert.equal(rig.presenter.getStatus().visibleGeneration, 1);
  assert.equal(rig.presenter.getStatus().visibleSphStep, 28);
  assert.ok(queueSubmissionCount(rig) >= 1);
  assert.deepEqual(rig.drawnViewProjectionMatrices.at(-1), resizedMatrix);
  assert.equal(
    rig.terminals.findLast((receipt) =>
      receipt.status
        === ULG_WORKER_OFFSCREEN_RESIDENT_ISOSURFACE_PRESENTATION_RENDERED_STATUS)
      ?.workerFramebufferEpoch,
    2
  );
  await rig.presenter.dispose();
});

test('resize invalidates an active commit proof and redraws the replacement frame', async () => {
  const rig = createPresenterRig();
  await rig.presenter.enqueue({
    request: validRequest(),
    retained: validRetained(),
    sphStep: 30
  });
  await waitFor(
    () => rig.presenter.getStatus().visibleGeneration === 1,
    'the pre-resize isosurface frame'
  );

  const preResizeFence = deferred();
  rig.setQueueCompletion(preResizeFence.promise);
  await rig.presenter.enqueue({
    request: validRequest(),
    retained: validRetained(),
    sphStep: 31
  });
  await waitFor(
    () => queueSubmissionCount(rig) === 2,
    'the pre-resize replacement submission'
  );
  const resizedMatrix = viewProjectionWithTranslation(9);
  rig.setFramebufferEpoch(2);
  const resizeRedraw = rig.presenter.resize({
    viewProjectionMatrix: resizedMatrix,
    reason: 'test-resize-invalidation-barrier'
  });
  preResizeFence.resolve();

  assert.equal(await resizeRedraw, true);
  assert.equal(rig.presenter.getStatus().visibleGeneration, 2);
  assert.equal(rig.presenter.getStatus().visibleSphStep, 31);
  assert.equal(queueSubmissionCount(rig), 4);
  assert.deepEqual(rig.drawnViewProjectionMatrices.at(-1), resizedMatrix);
  assert.equal(
    rig.terminals.findLast((receipt) =>
      receipt.status
        === ULG_WORKER_OFFSCREEN_RESIDENT_ISOSURFACE_PRESENTATION_RENDERED_STATUS)
      ?.workerFramebufferEpoch,
    2
  );
  assert.equal(
    rig.terminals.filter((receipt) =>
      receipt.status === ULG_WORKER_OFFSCREEN_RESIDENT_ISOSURFACE_PRESENTATION_RENDERED_STATUS).length,
    3
  );
  await rig.presenter.dispose();
});

test('successive resizes during replacement fences reach the newest framebuffer epoch', async () => {
  const rig = createPresenterRig();
  await rig.presenter.enqueue({
    request: validRequest(),
    retained: validRetained(),
    sphStep: 40
  });
  await waitFor(
    () => rig.presenter.getStatus().visibleGeneration === 1,
    'the initial frame before successive resizes'
  );

  const firstFence = deferred();
  rig.setQueueCompletion(firstFence.promise);
  await rig.presenter.enqueue({
    request: validRequest(),
    retained: validRetained(),
    sphStep: 41
  });
  await waitFor(
    () => queueSubmissionCount(rig) === 2,
    'the replacement frame before the first resize'
  );

  rig.setFramebufferEpoch(2);
  const firstResize = rig.presenter.resize({
    viewProjectionMatrix: viewProjectionWithTranslation(10),
    reason: 'test-first-resize-during-replacement-fence'
  });
  const secondFence = deferred();
  rig.setQueueCompletion(secondFence.promise);
  firstFence.resolve();
  await waitFor(
    () => queueSubmissionCount(rig) === 3,
    'the first resize retry submission'
  );

  rig.setFramebufferEpoch(3);
  const newestMatrix = viewProjectionWithTranslation(11);
  const secondResize = rig.presenter.resize({
    viewProjectionMatrix: newestMatrix,
    reason: 'test-second-resize-during-replacement-fence'
  });
  rig.setQueueCompletion(Promise.resolve());
  secondFence.resolve();

  assert.equal(await firstResize, false);
  assert.equal(await secondResize, true);
  await waitFor(
    () => rig.presenter.getStatus().running === false,
    'the newest framebuffer replacement to settle'
  );
  assert.equal(rig.presenter.getStatus().visibleGeneration, 2);
  assert.equal(rig.presenter.getStatus().visibleSphStep, 41);
  assert.ok(queueSubmissionCount(rig) >= 4);
  assert.deepEqual(rig.drawnViewProjectionMatrices.at(-1), newestMatrix);
  assert.equal(
    rig.terminals.findLast((receipt) =>
      receipt.status
        === ULG_WORKER_OFFSCREEN_RESIDENT_ISOSURFACE_PRESENTATION_RENDERED_STATUS)
      ?.workerFramebufferEpoch,
    3
  );
  await rig.presenter.dispose();
});
