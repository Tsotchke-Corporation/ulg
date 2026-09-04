import assert from 'node:assert/strict';
import test from 'node:test';

import {
  MLS_MPM_POST_MECHANICS_CLOSURE_STAGE_ORDER,
  ULG_MLS_MPM_POST_MECHANICS_CLOSURE_SCHEMA,
  claimMlsMpmPostMechanicsContinuation,
  reactionOutputComponentMutations,
  retireMlsMpmPostMechanicsClosureOutputsAfter,
  validateMlsMpmPostMechanicsContinuationClaim,
  runMlsMpmPostMechanicsClosureWebGpu
} from '../src/runtime/sph/sphMlsMpmPostMechanicsClosure.js';
import {
  tagResidentProductMassDevice,
  tagWebGpuBufferDevice
} from '../src/runtime/sph/sphGpuDeviceIdentity.js';
import {
  registerResidentProductEventCountAuthority
} from '../src/runtime/sph/sphResidentProductHistoryGpu.js';
import {
  issuePostSeparationThermalBinAuthority,
  postSeparationThermalBinAuthorityLiveness
} from '../src/runtime/sph/sphPostSeparationThermalBinAuthority.js';
import {
  createQueueOrderedCleanupClaimIssuer,
  registerQueueOrderedCleanupClaim,
  releaseSubmittedWorkCleanupQueueOrdered,
  sealQueueOrderedFinalConsumerCapability,
  submitQueueOrderedFinalConsumerWork,
  submitQueueOrderedWork
} from '../src/runtime/webgpuComputeLayout.js';

function buffer(label) {
  return { label, size: 4096, destroy() {} };
}

function trackedBuffer(label, { throws = false } = {}) {
  return {
    label,
    size: 4096,
    destroyCount: 0,
    destroy() {
      this.destroyCount += 1;
      if (throws) throw new Error(`destroy failed: ${label}`);
    }
  };
}

function productHistoryDevice() {
  return {
    createBuffer() {
      throw new Error('product-history test stub must not allocate');
    },
    queue: {
      submit() {},
      onSubmittedWorkDone() {
        return Promise.resolve(true);
      }
    }
  };
}

let nextProductHistoryAuthorityGeneration = 1;

function tagProductHistorySource(handle, device) {
  tagResidentProductMassDevice(handle, device);
  return handle;
}

function authenticateProductHistorySource(handle, device) {
  tagProductHistorySource(handle, device);
  const generation = nextProductHistoryAuthorityGeneration;
  nextProductHistoryAuthorityGeneration += 1;
  registerResidentProductEventCountAuthority(handle, {
    device,
    controlBuffer: trackedBuffer(
      `product-history-control-${generation}`
    ),
    controlOffsetBytes: 0,
    rowCapacity: 128,
    rowStrideFloats: 8,
    generation,
    seal: generation + 1000
  });
  return handle;
}

function minimalClosureInputs({
  stateBuffer = trackedBuffer('source-state'),
  thermoBuffer = trackedBuffer('source-thermo'),
  mechanicsBuffer = trackedBuffer('source-mechanics'),
  device = {}
} = {}) {
  return {
    device,
    sphParticleState: { particleCount: 2 },
    mlsMpmParticleState: { particleCount: 2 },
    sphParticleUpload: {
      status: 'webgpu-uploaded',
      stateBuffer,
      thermoBuffer
    },
    mlsMpmParticleUpload: {
      status: 'webgpu-uploaded',
      mechanicsBuffer
    },
    postMechanicsParticleBuffers: { stateBuffer, mechanicsBuffer },
    postMechanicsBackend: 'webgpu',
    boxDimsM: [3, 3, 3],
    dtSeconds: 0.001,
    readbackMode: 'no-full-readback'
  };
}

test('shared post-mechanics closure preserves the post-thermal discovery lineage', async () => {
  const sourceState = buffer('mechanics-state');
  const sourceThermo = buffer('source-thermo');
  const sourceMechanics = buffer('mechanics-constitutive');
  const farState = buffer('far-force-state');
  const thermalState = buffer('thermal-state');
  const thermalThermo = buffer('thermal-thermo');
  const reactionState = buffer('reaction-state');
  const reactionThermo = buffer('reaction-thermo');
  const reactionMechanics = buffer('reaction-mechanics');
  const refreshedMechanics = buffer('refreshed-mechanics');
  const phaseState = buffer('phase-v2-state');
  const phaseThermo = buffer('phase-v2-thermo');
  const phaseMechanics = buffer('phase-v2-mechanics');
  const device = productHistoryDevice();
  const inputResidentProductMass = tagProductHistorySource({
    status: 'input-products',
    productEventBuffer: buffer('input-products-buffer')
  }, device);
  const emittedResidentProductMass = tagProductHistorySource({
    status: 'emitted-products',
    productEventBuffer: buffer('emitted-products-buffer')
  }, device);
  const mergedResidentProductMass = authenticateProductHistorySource({
    status: 'resident-product-mass-merged-gpu-resident',
    productEventBuffer: buffer('merged-products-buffer')
  }, device);
  const gpuTimestampRecorder = { active: true };
  const thermalCleanupClaim = {};
  const reactionCleanupClaim = {};
  const phaseOutputCleanupClaim = {};
  const upstreamFinalConsumerCapability = {};
  const phaseOutputFinalConsumerCapability = {};
  const calls = [];
  const sphParticleState = {
    particleCount: 2,
    phaseCarrierPlan: { status: 'phase-lane-capacity-ready' }
  };
  const mlsMpmParticleState = { particleCount: 2 };
  const sphParticleUpload = {
    status: 'webgpu-uploaded',
    storageGeneration: 9,
    positionEpoch: 11,
    topologyEpoch: 2,
    chartEpoch: 3,
    levelEpoch: 4,
    supportEpoch: 5,
    stateBuffer: sourceState,
    thermoBuffer: sourceThermo,
    phaseCarrierPlan: { status: 'phase-lane-capacity-ready' }
  };
  const mlsMpmParticleUpload = {
    status: 'webgpu-uploaded',
    storageGeneration: 9,
    mechanicsBuffer: sourceMechanics
  };
  const result = await runMlsMpmPostMechanicsClosureWebGpu({
    device,
    sphParticleState,
    mlsMpmParticleState,
    sphParticleUpload,
    mlsMpmParticleUpload,
    postMechanicsParticleBuffers: {
      stateBuffer: sourceState,
      mechanicsBuffer: sourceMechanics
    },
    postMechanicsBackend: 'webgpu',
    schroederFarAggregateForceApplication: { status: 'admitted' },
    schroederFarForceDeltaFusionRunner: async (options) => {
      calls.push(['far', options]);
      return { stateBuffer: farState };
    },
    thermalMaterialTable: { materialCount: 1 },
    thermalStepRunner: async (options) => {
      calls.push(['thermal', options]);
      return {
        stateBuffer: thermalState,
        thermoBuffer: thermalThermo,
        queueOrderedCleanupClaim: thermalCleanupClaim
      };
    },
    reactionTable: { reactionCount: 1, gasProductCount: 1 },
    spatialReactionDiscoveryProposalRunner: async (options) => {
      calls.push(['reaction-discovery', options]);
      return { ready: true, receipt: { consumerId: 'reaction-discovery' } };
    },
    reactionStepRunner: async (options) => {
      calls.push(['reaction', options]);
      return {
        stateBuffer: reactionState,
        thermoBuffer: reactionThermo,
        mechanicsBuffer: reactionMechanics,
        residentProductMass: emittedResidentProductMass,
        queueOrderedCleanupClaim: reactionCleanupClaim
      };
    },
    mechanicsMaterialTable: { materialCount: 1 },
    mechanicsRefreshRunner: async (options) => {
      calls.push(['refresh', options]);
      return {
        mechanicsBuffer: refreshedMechanics,
        queueOrderedFinalConsumerCapability:
          phaseOutputFinalConsumerCapability,
        submittedWorkCleanupHostQueueFenceCount: 0
      };
    },
    phaseCarrierTransferRunner: async (options) => {
      calls.push(['phase-v2', options]);
      return {
        stateBuffer: phaseState,
        thermoBuffer: phaseThermo,
        mechanicsBuffer: phaseMechanics,
        queueOrderedFinalConsumerCapability:
          upstreamFinalConsumerCapability,
        queueOrderedCleanupClaim: phaseOutputCleanupClaim,
        submittedWorkCleanupHostQueueFenceCount: 0
      };
    },
    boxDimsM: [3, 3, 3],
    dtSeconds: 0.001,
    preferWebGpu: true,
    readbackMode: 'no-full-readback',
    gpuTimestampRecorder,
    schroederSpatialEpochGeneration: {
      execution: {
        generationId: 17,
        storageGeneration: 9,
        physicsTick: 8,
        physicsSubstep: 3,
        positionEpoch: 11,
        topologyEpoch: 2,
        chartEpoch: 3,
        levelEpoch: 4,
        supportEpoch: 5
      }
    },
    schroederLawQueue: { status: 'stale-law-queue' },
    schroederLawNeighborCandidates: { status: 'stale-candidates' },
    reactionLawInputsQuarantined: true,
    inputResidentProductMass,
    residentProductMassMergeRunner: async (options) => {
      calls.push(['product-merge', options]);
      return mergedResidentProductMass;
    }
  });

  assert.equal(result.schema, ULG_MLS_MPM_POST_MECHANICS_CLOSURE_SCHEMA);
  assert.equal(result.status, 'post-mechanics-closure-complete');
  assert.deepEqual(result.authoritativeStageOrder,
    MLS_MPM_POST_MECHANICS_CLOSURE_STAGE_ORDER);
  assert.deepEqual(result.executedStageOrder,
    MLS_MPM_POST_MECHANICS_CLOSURE_STAGE_ORDER);
  assert.deepEqual(calls.map(([stage]) => stage), [
    'far',
    'thermal',
    'reaction-discovery',
    'reaction',
    'phase-v2',
    'refresh',
    'product-merge'
  ]);
  assert.equal(calls[0][1].sourceStateBuffer, sourceState);
  assert.equal(calls[1][1].sourceStateBuffer, farState);
  assert.equal(calls[1][1].sourceThermoBuffer, sourceThermo);
  assert.equal(calls[1][1].proposalStateBuffer, farState);
  assert.equal(calls[1][1].proposalThermoBuffer, sourceThermo);
  assert.equal(calls[1][1].gpuTimestampRecorder, gpuTimestampRecorder);
  assert.equal(calls[2][1].sourceStateBuffer, thermalState);
  assert.equal(calls[2][1].sourceThermoBuffer, thermalThermo);
  assert.equal(calls[2][1].observeGpuEvidence, undefined);
  assert.equal(calls[3][1].sourceStateBuffer, thermalState);
  assert.equal(calls[3][1].sourceThermoBuffer, thermalThermo);
  assert.equal(calls[3][1].sourceMechanicsBuffer, sourceMechanics);
  assert.equal(calls[3][1].schroederLawQueue, null);
  assert.equal(calls[3][1].schroederLawNeighborCandidates, null);
  assert.equal(calls[3][1].readCompactReactionSummary, false);
  assert.equal(calls[3][1].readReactionGasSpeciesSummary, false);
  assert.equal(
    calls[3][1].schroederSpatialReactionDiscoveryProposal.ready,
    true
  );
  assert.equal(calls[4][1].sourceStateBuffer, reactionState);
  assert.equal(calls[4][1].sourceThermoBuffer, reactionThermo);
  assert.equal(calls[4][1].sourceMechanicsBuffer, reactionMechanics);
  assert.deepEqual(
    calls[4][1].queueOrderedProducerClaims,
    [thermalCleanupClaim, reactionCleanupClaim]
  );
  assert.equal(calls[5][1].sourceStateBuffer, phaseState);
  assert.equal(calls[5][1].sourceThermoBuffer, phaseThermo);
  assert.equal(calls[5][1].sourceMechanicsBuffer, phaseMechanics);
  assert.deepEqual(
    calls[5][1].queueOrderedProducerClaims,
    [phaseOutputCleanupClaim]
  );
  assert.equal(calls[6][1].inputResidentProductMass,
    inputResidentProductMass);
  assert.equal(calls[6][1].emittedResidentProductMass,
    emittedResidentProductMass);
  assert.equal(
    calls[6][1].allowHostCompactionObservation,
    false
  );
  assert.equal(result.continuation.stateBuffer, phaseState);
  assert.equal(result.continuation.thermoBuffer, phaseThermo);
  assert.equal(result.continuation.mechanicsBuffer, refreshedMechanics);
  assert.equal(result.continuation.phaseCarrierTransferApplied, true);
  assert.equal(result.continuation.productMassMergeRequired, false);
  assert.equal(result.continuation.residentProductMass,
    mergedResidentProductMass);
  assert.equal(result.generation.spatialGenerationId, 17);
  assert.equal(result.readbackMode, 'no-full-readback');
  assert.deepEqual(result.queueOrderedCleanupClaims, []);
  assert.equal(
    result.queueOrderedFinalConsumerCapabilities.upstream,
    upstreamFinalConsumerCapability
  );
  assert.equal(
    result.queueOrderedFinalConsumerCapabilities
      .phaseCarrierOutput,
    phaseOutputFinalConsumerCapability
  );
  assert.equal(
    result.thermalStep
      .queueOrderedRetainedOutputFinalConsumerCapability,
    upstreamFinalConsumerCapability
  );
  assert.equal(
    result.reactionStep
      .queueOrderedRetainedOutputFinalConsumerCapability,
    upstreamFinalConsumerCapability
  );
  assert.equal(
    result.phaseCarrierTransferStep
      .queueOrderedRetainedOutputFinalConsumerCapability,
    phaseOutputFinalConsumerCapability
  );
  assert.equal(
    result.phaseCarrierTransferStep
      .submittedWorkCleanupHostQueueFenceCount,
    0
  );
  assert.equal(
    result.phaseCarrierTransferFamilyReceipt.preReactionStateBuffer,
    thermalState
  );
  assert.equal(
    result.phaseCarrierTransferFamilyReceipt.preReactionThermoBuffer,
    thermalThermo
  );
  assert.equal(
    result.phaseCarrierTransferFamilyReceipt.postReactionStateBuffer,
    reactionState
  );
  assert.equal(
    result.phaseCarrierTransferFamilyReceipt.postReactionThermoBuffer,
    reactionThermo
  );
  assert.equal(
    result.phaseCarrierTransferFamilyReceipt.preTransferStateBuffer,
    reactionState
  );
  assert.equal(
    result.phaseCarrierTransferFamilyReceipt.preTransferThermoBuffer,
    reactionThermo
  );
  assert.equal(
    result.phaseCarrierTransferFamilyReceipt.reactionParticleMutationApplied,
    true
  );
  assert.equal(
    result.phaseCarrierTransferFamilyReceipt.reactionStateMutationApplied,
    true
  );
  assert.equal(
    result.phaseCarrierTransferFamilyReceipt.reactionThermoMutationApplied,
    true
  );
  assert.equal(
    result.mechanicsRefreshStep
      .submittedWorkCleanupHostQueueFenceCount,
    0
  );
});

test('no-full-readback closure promotes either one-sided resident product source before publication', async () => {
  for (const side of ['input', 'emitted']) {
    const device = productHistoryDevice();
    const source = tagProductHistorySource({
      status: `${side}-resident-product-mass`,
      productEventBuffer: trackedBuffer(`${side}-resident-product-events`)
    }, device);
    const promoted = authenticateProductHistorySource({
      status: 'resident-product-mass-merged-gpu-resident',
      productEventBuffer: trackedBuffer(`${side}-promoted-product-history`)
    }, device);
    const mergeCalls = [];
    const closure = await runMlsMpmPostMechanicsClosureWebGpu({
      ...minimalClosureInputs({ device }),
      ...(side === 'input'
        ? { inputResidentProductMass: source }
        : {
            thermalMaterialTable: { materialCount: 1 },
            thermalStepRunner: null,
            reactionTable: { reactionCount: 1 },
            reactionStepRunner: async () => ({
              residentProductMass: source
            })
          }),
      residentProductMassMergeRunner: async (options) => {
        mergeCalls.push(options);
        return promoted;
      }
    });

    assert.equal(mergeCalls.length, 1, side);
    assert.equal(
      mergeCalls[0].inputResidentProductMass,
      side === 'input' ? source : null,
      side
    );
    assert.equal(
      mergeCalls[0].emittedResidentProductMass,
      side === 'emitted' ? source : null,
      side
    );
    assert.equal(
      mergeCalls[0].allowHostCompactionObservation,
      false,
      side
    );
    assert.equal(
      typeof mergeCalls[0].readbackTelemetryAccumulator?.recordMapAsync,
      'function',
      side
    );
    assert.equal(closure.status, 'post-mechanics-closure-complete', side);
    assert.equal(closure.continuation.residentProductMass, promoted, side);
    assert.equal(closure.continuation.productMassMergeRequired, false, side);
    assert.equal(
      closure.continuation.productMassStatus,
      'resident-product-mass-merged-gpu-resident',
      side
    );
  }
});

test('full-readback closure preserves a one-sided resident product source without promotion', async () => {
  const source = {
    status: 'full-readback-resident-product-mass',
    productEventBuffer: trackedBuffer('full-readback-resident-product-events')
  };
  let mergeCallCount = 0;
  const closure = await runMlsMpmPostMechanicsClosureWebGpu({
    ...minimalClosureInputs(),
    readbackMode: 'full-parity-readback',
    inputResidentProductMass: source,
    residentProductMassMergeRunner: async () => {
      mergeCallCount += 1;
      return null;
    }
  });

  assert.equal(mergeCallCount, 0);
  assert.equal(closure.continuation.residentProductMass, source);
  assert.equal(closure.continuation.productMassMergeRequired, false);
  assert.equal(
    closure.continuation.productMassStatus,
    'resident-product-mass-ready-without-merge'
  );
});

test('no-full-readback closure rejects raw or ambiguous two-source aliases before merge', async () => {
  for (const aliasKind of ['exact-handle', 'distinct-shared-buffer']) {
    const device = productHistoryDevice();
    const sharedBuffer = trackedBuffer(`${aliasKind}-product-events`);
    const inputSource = tagProductHistorySource({
      status: `${aliasKind}-input-product-history`,
      productEventBuffer: sharedBuffer
    }, device);
    const emittedSource = aliasKind === 'exact-handle'
      ? inputSource
      : tagProductHistorySource({
          status: `${aliasKind}-emitted-product-history`,
          productEventBuffer: sharedBuffer
        }, device);
    let mergeCallCount = 0;
    const failure = await runMlsMpmPostMechanicsClosureWebGpu({
      ...minimalClosureInputs({ device }),
      inputResidentProductMass: inputSource,
      thermalMaterialTable: { materialCount: 1 },
      thermalStepRunner: null,
      reactionTable: { reactionCount: 1 },
      reactionStepRunner: async () => ({
        residentProductMass: emittedSource
      }),
      residentProductMassMergeRunner: async () => {
        mergeCallCount += 1;
        return inputSource;
      }
    }).then(
      () => null,
      (error) => error
    );

    assert.equal(
      failure?.code,
      aliasKind === 'exact-handle'
        ? 'ERR_MLS_MPM_POST_MECHANICS_PRODUCT_HISTORY_UNAUTHENTICATED_ALIAS'
        : 'ERR_MLS_MPM_POST_MECHANICS_PRODUCT_HISTORY_AMBIGUOUS_ALIAS',
      aliasKind
    );
    assert.equal(mergeCallCount, 0, aliasKind);
    await failure.postMechanicsCleanupCompletion;
    assert.equal(sharedBuffer.destroyCount, 0, aliasKind);
  }
});

test('no-full-readback closure accepts one exact two-lane alias only with an authenticated GPU count', async () => {
  const device = productHistoryDevice();
  const source = authenticateProductHistorySource({
    status: 'authenticated-exact-alias-product-history',
    productEventBuffer: trackedBuffer(
      'authenticated-exact-alias-product-events'
    )
  }, device);
  let mergeCallCount = 0;
  const closure = await runMlsMpmPostMechanicsClosureWebGpu({
    ...minimalClosureInputs({ device }),
    inputResidentProductMass: source,
    thermalMaterialTable: { materialCount: 1 },
    thermalStepRunner: null,
    reactionTable: { reactionCount: 1 },
    reactionStepRunner: async () => ({ residentProductMass: source }),
    residentProductMassMergeRunner: async () => {
      mergeCallCount += 1;
      return source;
    }
  });

  assert.equal(mergeCallCount, 0);
  assert.equal(closure.continuation.residentProductMass, source);
  assert.equal(closure.continuation.productMassMergeRequired, false);
});

test('no-full-readback one-sided promotion rejects unavailable, unchanged, and foreign-device results', async () => {
  {
    const device = {};
    const source = tagProductHistorySource({
      status: 'missing-device-capability-product-history',
      productEventBuffer: trackedBuffer(
        'missing-device-capability-product-events'
      )
    }, device);
    let mergeCallCount = 0;
    const failure = await runMlsMpmPostMechanicsClosureWebGpu({
      ...minimalClosureInputs({ device }),
      inputResidentProductMass: source,
      residentProductMassMergeRunner: async () => {
        mergeCallCount += 1;
        return source;
      }
    }).then(
      () => null,
      (error) => error
    );
    assert.equal(
      failure?.code,
      'ERR_MLS_MPM_POST_MECHANICS_PRODUCT_HISTORY_DEVICE_REQUIRED'
    );
    assert.equal(mergeCallCount, 0);
    await failure.postMechanicsCleanupCompletion;
  }

  {
    const device = productHistoryDevice();
    const source = tagProductHistorySource({
      status: 'unchanged-promotion-product-history',
      productEventBuffer: trackedBuffer('unchanged-promotion-product-events')
    }, device);
    const failure = await runMlsMpmPostMechanicsClosureWebGpu({
      ...minimalClosureInputs({ device }),
      inputResidentProductMass: source,
      residentProductMassMergeRunner: async () => source
    }).then(
      () => null,
      (error) => error
    );
    assert.equal(
      failure?.code,
      'ERR_MLS_MPM_POST_MECHANICS_PRODUCT_HISTORY_PROMOTION_INVALID'
    );
    await failure.postMechanicsCleanupCompletion;
  }

  {
    const device = productHistoryDevice();
    const foreignDevice = productHistoryDevice();
    const source = tagProductHistorySource({
      status: 'foreign-promotion-input-product-history',
      productEventBuffer: trackedBuffer(
        'foreign-promotion-input-product-events'
      )
    }, device);
    let foreignReleaseCount = 0;
    const foreignResult = authenticateProductHistorySource({
      status: 'foreign-promotion-result-product-history',
      productEventBuffer: trackedBuffer(
        'foreign-promotion-result-product-events'
      ),
      destroyResidentProductMassBuffers() {
        foreignReleaseCount += 1;
        return true;
      }
    }, foreignDevice);
    const failure = await runMlsMpmPostMechanicsClosureWebGpu({
      ...minimalClosureInputs({ device }),
      inputResidentProductMass: source,
      residentProductMassMergeRunner: async () => foreignResult
    }).then(
      () => null,
      (error) => error
    );
    assert.equal(
      failure?.code,
      'ERR_MLS_MPM_POST_MECHANICS_PRODUCT_HISTORY_PROMOTION_INVALID'
    );
    const cleanup = await failure.postMechanicsCleanupCompletion;
    assert.equal(foreignReleaseCount, 1);
    assert.equal(cleanup.releasedResidentProductMassCount, 1);
  }
});

test('post-promotion closure failure retires the unpublished replacement exactly once', async () => {
  const device = productHistoryDevice();
  let inputReleaseCount = 0;
  const source = tagProductHistorySource({
    status: 'post-promotion-failure-input-product-history',
    productEventBuffer: trackedBuffer(
      'post-promotion-failure-input-product-events'
    ),
    destroyResidentProductMassBuffers() {
      inputReleaseCount += 1;
      return true;
    }
  }, device);
  let replacementReleaseCount = 0;
  const promoted = authenticateProductHistorySource({
    status: 'post-promotion-failure-authenticated-product-history',
    productEventBuffer: trackedBuffer(
      'post-promotion-failure-authenticated-product-events'
    ),
    destroyResidentProductMassBuffers() {
      replacementReleaseCount += 1;
      return true;
    }
  }, device);
  const failure = await runMlsMpmPostMechanicsClosureWebGpu({
    ...minimalClosureInputs({ device }),
    inputResidentProductMass: source,
    residentProductMassMergeRunner: async () => promoted,
    stageMechanicsTracer: {
      result() {
        throw new Error('injected-post-promotion-closure-assembly-failure');
      }
    }
  }).then(
    () => null,
    (error) => error
  );

  assert.match(
    failure?.message || '',
    /injected-post-promotion-closure-assembly-failure/
  );
  const cleanup = await failure.postMechanicsCleanupCompletion;
  assert.equal(replacementReleaseCount, 1);
  assert.equal(inputReleaseCount, 0);
  assert.equal(cleanup.releasedResidentProductMassCount, 1);
  assert.equal(cleanup.status, 'post-mechanics-failure-cleanup-complete');
});

test('post-mechanics thermal consumes and retires the exact G2P bin authority once', async () => {
  let queueFenceCount = 0;
  const device = {
    queue: {
      onSubmittedWorkDone() {
        queueFenceCount += 1;
        return Promise.resolve();
      }
    }
  };
  const stateBuffer = tagWebGpuBufferDevice(
    trackedBuffer('authority-post-separation-state'),
    device
  );
  const thermoBuffer = trackedBuffer('authority-source-thermo');
  const mechanicsBuffer = trackedBuffer('authority-source-mechanics');
  const binsBuffer = tagWebGpuBufferDevice(
    trackedBuffer('authority-post-separation-bins'),
    device
  );
  const authority = issuePostSeparationThermalBinAuthority({
    device,
    stateBuffer,
    binsBuffer,
    particleCount: 2,
    capacity: 2,
    nx: 1,
    ny: 1,
    nz: 1,
    cellSizeM: 1,
    producerSubmission: { commandBuffer: {} }
  });
  const inputs = minimalClosureInputs({
    stateBuffer,
    thermoBuffer,
    mechanicsBuffer,
    device
  });
  inputs.postMechanicsParticleBuffers.postSeparationThermalBinAuthority =
    authority;
  let selectedNeighborBins = null;

  await runMlsMpmPostMechanicsClosureWebGpu({
    ...inputs,
    thermalMaterialTable: { materialCount: 1 },
    thermalStepRunner: async ({ neighborBins }) => {
      selectedNeighborBins = neighborBins;
      return null;
    }
  });

  assert.equal(selectedNeighborBins, authority);
  const liveness = postSeparationThermalBinAuthorityLiveness(authority);
  assert.equal(liveness.releaseScheduled, true);
  await liveness.releasePromise;
  assert.equal(queueFenceCount, 1);
  assert.equal(
    postSeparationThermalBinAuthorityLiveness(authority).destroyCount,
    1
  );
  assert.equal(binsBuffer.destroyCount, 1);
  assert.equal(stateBuffer.destroyCount, 0);
});

test('phase output claim remains forwarded only when mechanics consumer is absent', async () => {
  const inputs = minimalClosureInputs();
  const phaseClaim = {};
  const upstreamCapability = {};
  const phaseState = trackedBuffer('phase-forward-state');
  const phaseThermo = trackedBuffer('phase-forward-thermo');
  const phaseMechanics = trackedBuffer('phase-forward-mechanics');
  inputs.sphParticleState.phaseCarrierPlan = {
    status: 'phase-lane-capacity-ready'
  };
  inputs.sphParticleUpload.phaseCarrierPlan =
    inputs.sphParticleState.phaseCarrierPlan;

  const closure = await runMlsMpmPostMechanicsClosureWebGpu({
    ...inputs,
    thermalMaterialTable: { materialCount: 1 },
    mechanicsMaterialTable: { materialCount: 1 },
    thermalStepRunner: async () => ({
      stateBuffer: trackedBuffer('phase-forward-thermal-state'),
      thermoBuffer: trackedBuffer('phase-forward-thermal-thermo')
    }),
    phaseCarrierTransferRunner: async () => ({
      stateBuffer: phaseState,
      thermoBuffer: phaseThermo,
      mechanicsBuffer: phaseMechanics,
      queueOrderedCleanupClaim: phaseClaim,
      queueOrderedFinalConsumerCapability: upstreamCapability,
      submittedWorkCleanupHostQueueFenceCount: 0
    }),
    mechanicsRefreshRunner: null
  });

  assert.deepEqual(
    closure.queueOrderedCleanupClaims,
    [phaseClaim]
  );
  assert.equal(
    closure.queueOrderedFinalConsumerCapabilities.upstream,
    upstreamCapability
  );
  assert.equal(
    closure.queueOrderedFinalConsumerCapabilities
      .phaseCarrierOutput,
    null
  );
});

test('post-phase consumer submits before mechanics seals the phase-output family', async () => {
  const inputs = minimalClosureInputs();
  const order = [];
  const thermalState = trackedBuffer('post-phase-thermal-state');
  const thermalThermo = trackedBuffer('post-phase-thermal-thermo');
  const phaseState = trackedBuffer('post-phase-state');
  const phaseThermo = trackedBuffer('post-phase-thermo');
  const phaseMechanics = trackedBuffer('post-phase-mechanics');
  const refreshedMechanics = trackedBuffer('post-phase-refreshed-mechanics');
  inputs.sphParticleState.phaseCarrierPlan = {
    status: 'phase-lane-capacity-ready'
  };
  inputs.sphParticleUpload.phaseCarrierPlan =
    inputs.sphParticleState.phaseCarrierPlan;
  let observedReceipt = null;

  const closure = await runMlsMpmPostMechanicsClosureWebGpu({
    ...inputs,
    thermalMaterialTable: { materialCount: 1 },
    mechanicsMaterialTable: { materialCount: 1 },
    thermalStepRunner: async () => {
      order.push('thermal');
      return {
        stateBuffer: thermalState,
        thermoBuffer: thermalThermo
      };
    },
    phaseCarrierTransferRunner: async (options) => {
      order.push('phase');
      assert.equal(options.sourceStateBuffer, thermalState);
      assert.equal(options.sourceThermoBuffer, thermalThermo);
      return {
        stateBuffer: phaseState,
        thermoBuffer: phaseThermo,
        mechanicsBuffer: phaseMechanics,
        submittedWorkCleanupHostQueueFenceCount: 0
      };
    },
    async afterPhaseCarrierTransfer({
      phaseCarrierTransferFamilyReceipt
    }) {
      order.push('optics');
      observedReceipt = phaseCarrierTransferFamilyReceipt;
      assert.equal(
        phaseCarrierTransferFamilyReceipt.preTransferStateBuffer,
        thermalState
      );
      assert.equal(
        phaseCarrierTransferFamilyReceipt.preReactionStateBuffer,
        thermalState
      );
      assert.equal(
        phaseCarrierTransferFamilyReceipt.postReactionStateBuffer,
        thermalState
      );
      assert.equal(
        phaseCarrierTransferFamilyReceipt.preTransferThermoBuffer,
        thermalThermo
      );
      assert.equal(
        phaseCarrierTransferFamilyReceipt.preReactionThermoBuffer,
        thermalThermo
      );
      assert.equal(
        phaseCarrierTransferFamilyReceipt.postReactionThermoBuffer,
        thermalThermo
      );
      assert.equal(
        phaseCarrierTransferFamilyReceipt.postTransferStateBuffer,
        phaseState
      );
      assert.equal(
        phaseCarrierTransferFamilyReceipt.postTransferThermoBuffer,
        phaseThermo
      );
    },
    mechanicsRefreshRunner: async (options) => {
      order.push('mechanics');
      assert.equal(options.sourceStateBuffer, phaseState);
      assert.equal(options.sourceThermoBuffer, phaseThermo);
      assert.equal(options.sourceMechanicsBuffer, phaseMechanics);
      return { mechanicsBuffer: refreshedMechanics };
    }
  });

  assert.deepEqual(order, ['thermal', 'phase', 'optics', 'mechanics']);
  assert.equal(closure.phaseCarrierTransferFamilyReceipt, observedReceipt);
  assert.equal(
    Object.keys(closure).includes('phaseCarrierTransferFamilyReceipt'),
    false
  );
});

test('closure forwards upstream claims when no sidecar consumer submits', async () => {
  const upstreamClaims = [{}, {}];
  const closure = await runMlsMpmPostMechanicsClosureWebGpu({
    ...minimalClosureInputs(),
    queueOrderedProducerClaims: upstreamClaims
  });

  assert.deepEqual(
    closure.queueOrderedCleanupClaims,
    upstreamClaims
  );
  assert.equal(
    closure.queueOrderedFinalConsumerCapability,
    undefined
  );
  assert.equal(
    closure.queueOrderedFinalConsumerCapabilities.upstream,
    null
  );
});

test('gas-producing closure keeps product state resident and observes species only when explicitly requested', async () => {
  const run = async (reactionStepOptions = {}) => {
    const device = productHistoryDevice();
    const inputs = minimalClosureInputs({ device });
    let captured = null;
    const productEventBuffer = trackedBuffer('resident-gas-product-events');
    const residentProductMass = tagProductHistorySource({
      status: 'resident-product-mass-buffer-retained',
      productEventBuffer
    }, device);
    const promotedResidentProductMass = authenticateProductHistorySource({
      status: 'resident-product-mass-merged-gpu-resident',
      productEventBuffer: trackedBuffer(
        'resident-gas-authenticated-product-history'
      )
    }, device);
    const closure = await runMlsMpmPostMechanicsClosureWebGpu({
      ...inputs,
      thermalMaterialTable: { materialCount: 1 },
      thermalStepRunner: null,
      reactionTable: { reactionCount: 1, gasProductCount: 3 },
      reactionStepOptions,
      reactionStepRunner: async (options) => {
        captured = options;
        return {
          residentProductMass
        };
      },
      residentProductMassMergeRunner: async () =>
        promotedResidentProductMass
    });
    return { captured, closure, promotedResidentProductMass };
  };

  const hotPath = await run();
  assert.equal(hotPath.captured.readCompactReactionSummary, false);
  assert.equal(hotPath.captured.readReactionGasSpeciesSummary, false);
  assert.equal(hotPath.captured.readReactionProductInventory, false);
  assert.equal(hotPath.captured.readReactionAtomResidual, false);
  assert.equal(
    hotPath.closure.residentProductMass.productEventBuffer,
    hotPath.promotedResidentProductMass.productEventBuffer
  );

  const diagnostic = await run({ readReactionGasSpeciesSummary: true });
  assert.equal(diagnostic.captured.readCompactReactionSummary, false);
  assert.equal(diagnostic.captured.readReactionGasSpeciesSummary, true);
  assert.equal(
    diagnostic.closure.residentProductMass.productEventBuffer,
    diagnostic.promotedResidentProductMass.productEventBuffer
  );
});

test('shared closure preserves a downstream error and retires wrapper outputs behind the queue fence', async () => {
  let resolveFence;
  const fence = new Promise((resolve) => { resolveFence = resolve; });
  const destroyed = new Map();
  const trackedBuffer = (label) => ({
    label,
    size: 4096,
    destroy() {
      destroyed.set(label, (destroyed.get(label) ?? 0) + 1);
    }
  });
  const sourceState = trackedBuffer('source-state');
  const sourceThermo = trackedBuffer('source-thermo');
  const sourceMechanics = trackedBuffer('source-mechanics');
  const thermalState = trackedBuffer('thermal-state');
  const thermalThermo = trackedBuffer('thermal-thermo');

  await assert.rejects(
    runMlsMpmPostMechanicsClosureWebGpu({
      device: {
        queue: {
          onSubmittedWorkDone() { return fence; }
        }
      },
      sphParticleState: { particleCount: 2 },
      mlsMpmParticleState: { particleCount: 2 },
      sphParticleUpload: {
        status: 'webgpu-uploaded',
        stateBuffer: sourceState,
        thermoBuffer: sourceThermo
      },
      mlsMpmParticleUpload: {
        status: 'webgpu-uploaded',
        mechanicsBuffer: sourceMechanics
      },
      postMechanicsParticleBuffers: {
        stateBuffer: sourceState,
        mechanicsBuffer: sourceMechanics
      },
      postMechanicsBackend: 'webgpu',
      thermalMaterialTable: { materialCount: 1 },
      thermalStepRunner: async () => ({
        result: {
          stateBuffer: thermalState,
          thermoBuffer: thermalThermo
        }
      }),
      reactionTable: { reactionCount: 1 },
      reactionStepRunner: async () => {
        throw new Error('reaction-failure');
      },
      boxDimsM: [3, 3, 3],
      dtSeconds: 0.001,
      readbackMode: 'no-full-readback'
    }),
    /reaction-failure/
  );

  assert.equal(destroyed.size, 0);
  resolveFence();
  await fence;
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(destroyed.get('thermal-state'), 1);
  assert.equal(destroyed.get('thermal-thermo'), 1);
  assert.equal(destroyed.get('source-state') ?? 0, 0);
  assert.equal(destroyed.get('source-thermo') ?? 0, 0);
  assert.equal(destroyed.get('source-mechanics') ?? 0, 0);
});

test('zero-sidecar closure publishes one exact borrowed continuation and replay-safe retirement', async () => {
  const inputs = minimalClosureInputs();
  const closure = await runMlsMpmPostMechanicsClosureWebGpu(inputs);

  assert.equal(closure.status, 'post-mechanics-closure-complete');
  assert.deepEqual(closure.executedStageOrder, []);
  assert.equal(closure.fullParticleReadbackPerformed, false);
  assert.equal(closure.fullParticleReadbackFree, true);
  assert.equal(closure.residentContinuationReady, true);
  assert.equal(closure.readbackTelemetryComplete, true);
  assert.deepEqual(closure.readbackTelemetryUnknownSources, []);
  assert.equal(closure.mapAsyncCount, 0);
  assert.equal(closure.readbackBytes, 0);
  assert.equal(closure.hostQueueFenceCount, 0);
  assert.equal(closure.normalHotLoopReadbackFree, true);
  assert.deepEqual(closure.continuation.componentSources, {
    state: 'post-mechanics-input',
    thermo: 'source-thermo-input',
    mechanics: 'post-mechanics-input'
  });
  assert.deepEqual(closure.continuation.componentOwnership, {
    state: 'borrowed-input',
    thermo: 'borrowed-input',
    mechanics: 'borrowed-input'
  });
  const nextParticleUploads = {
    sphParticleUpload: {
      stateBuffer: inputs.sphParticleUpload.stateBuffer,
      thermoBuffer: inputs.sphParticleUpload.thermoBuffer
    },
    mlsMpmParticleUpload: {
      mechanicsBuffer: inputs.mlsMpmParticleUpload.mechanicsBuffer
    }
  };
  const claim = claimMlsMpmPostMechanicsContinuation(closure, {
    nextParticleUploads
  });
  assert.equal(
    claimMlsMpmPostMechanicsContinuation(closure, { nextParticleUploads }),
    claim
  );
  assert.equal(validateMlsMpmPostMechanicsContinuationClaim(
    closure,
    claim,
    { nextParticleUploads }
  ), true);
  assert.equal(validateMlsMpmPostMechanicsContinuationClaim(
    closure,
    { ...claim },
    { nextParticleUploads }
  ), false);

  const retirement = await retireMlsMpmPostMechanicsClosureOutputsAfter(
    closure,
    { after: Promise.resolve(true) }
  );
  assert.equal(retirement.destroyedBufferCount, 0);
  assert.equal(
    await retireMlsMpmPostMechanicsClosureOutputsAfter(closure, {
      after: Promise.resolve(true)
    }),
    retirement
  );
  assert.equal(inputs.sphParticleUpload.stateBuffer.destroyCount, 0);
  assert.equal(inputs.sphParticleUpload.thermoBuffer.destroyCount, 0);
  assert.equal(inputs.mlsMpmParticleUpload.mechanicsBuffer.destroyCount, 0);
});

test('thermal-only closure transfers state and thermo while retaining borrowed mechanics', async () => {
  const inputs = minimalClosureInputs();
  const thermalState = trackedBuffer('thermal-state');
  const thermalThermo = trackedBuffer('thermal-thermo');
  const closure = await runMlsMpmPostMechanicsClosureWebGpu({
    ...inputs,
    thermalMaterialTable: { materialCount: 1 },
    thermalStepRunner: async () => ({
      stateBuffer: thermalState,
      thermoBuffer: thermalThermo,
      ownsStateBuffer: true,
      ownsThermoBuffer: true
    })
  });

  assert.deepEqual(closure.executedStageOrder, ['thermal-phase']);
  assert.equal(closure.continuation.stateBuffer, thermalState);
  assert.equal(closure.continuation.thermoBuffer, thermalThermo);
  assert.equal(
    closure.continuation.mechanicsBuffer,
    inputs.mlsMpmParticleUpload.mechanicsBuffer
  );
  const claim = claimMlsMpmPostMechanicsContinuation(closure, {
    stateBuffer: thermalState,
    thermoBuffer: thermalThermo,
    mechanicsBuffer: inputs.mlsMpmParticleUpload.mechanicsBuffer
  });
  assert.equal(claim.components.state.closureOwned, true);
  assert.equal(claim.components.thermo.closureOwned, true);
  assert.equal(claim.components.mechanics.closureOwned, false);
  const retirement = await retireMlsMpmPostMechanicsClosureOutputsAfter(
    closure,
    { after: Promise.resolve(true) }
  );
  assert.equal(retirement.destroyedBufferCount, 0);
  assert.equal(thermalState.destroyCount, 0);
  assert.equal(thermalThermo.destroyCount, 0);
});

test('reaction components are adopted independently without a torn-family fallback', async () => {
  for (const component of ['state', 'thermo', 'mechanics']) {
    const inputs = minimalClosureInputs();
    const reactionBuffer = trackedBuffer(`reaction-${component}`);
    const reactionResult = {
      [`${component}Buffer`]: reactionBuffer,
      [`owns${component[0].toUpperCase()}${component.slice(1)}Buffer`]: true
    };
    const mutations = reactionOutputComponentMutations(reactionResult);
    assert.equal(mutations[component], true, component);
    assert.equal(mutations.any, true, component);
    assert.equal(mutations.complete, false, component);
    const closure = await runMlsMpmPostMechanicsClosureWebGpu({
      ...inputs,
      thermalMaterialTable: { materialCount: 1 },
      thermalStepRunner: null,
      reactionTable: { reactionCount: 1 },
      reactionStepRunner: async () => reactionResult
    });
    const expected = {
      state: component === 'state'
        ? reactionBuffer
        : inputs.sphParticleUpload.stateBuffer,
      thermo: component === 'thermo'
        ? reactionBuffer
        : inputs.sphParticleUpload.thermoBuffer,
      mechanics: component === 'mechanics'
        ? reactionBuffer
        : inputs.mlsMpmParticleUpload.mechanicsBuffer
    };
    assert.equal(closure.continuation.stateBuffer, expected.state, component);
    assert.equal(closure.continuation.thermoBuffer, expected.thermo, component);
    assert.equal(
      closure.continuation.mechanicsBuffer,
      expected.mechanics,
      component
    );
    const claim = claimMlsMpmPostMechanicsContinuation(closure, {
      stateBuffer: expected.state,
      thermoBuffer: expected.thermo,
      mechanicsBuffer: expected.mechanics
    });
    assert.equal(claim.components[component].closureOwned, true, component);
    await retireMlsMpmPostMechanicsClosureOutputsAfter(closure, {
      after: Promise.resolve(true)
    });
    assert.equal(reactionBuffer.destroyCount, 0, component);
  }
});

test('phase transfer preserves an adopted reaction owner family while its product handle remains live', async () => {
  const device = productHistoryDevice();
  const inputs = minimalClosureInputs({ device });
  inputs.sphParticleUpload.phaseCarrierPlan = {
    status: 'phase-lane-capacity-ready'
  };
  const thermalState = trackedBuffer('family-thermal-state');
  const thermalThermo = trackedBuffer('family-thermal-thermo');
  const reactionState = trackedBuffer('family-reaction-state');
  const reactionThermo = trackedBuffer('family-reaction-thermo');
  const reactionMechanics = trackedBuffer('family-reaction-mechanics');
  const phaseState = trackedBuffer('family-phase-state');
  const phaseThermo = trackedBuffer('family-phase-thermo');
  const phaseMechanics = trackedBuffer('family-phase-mechanics');
  const residentProductMass = authenticateProductHistorySource({
    status: 'resident-product-mass-merged-gpu-resident',
    productEventBuffer: trackedBuffer('family-product-events')
  }, device);
  let reactionFamilyReleaseCount = 0;
  const closure = await runMlsMpmPostMechanicsClosureWebGpu({
    ...inputs,
    thermalMaterialTable: { materialCount: 1 },
    thermalStepRunner: async () => ({
      stateBuffer: thermalState,
      thermoBuffer: thermalThermo
    }),
    reactionTable: { reactionCount: 1 },
    reactionStepRunner: async () => ({
      stateBuffer: reactionState,
      thermoBuffer: reactionThermo,
      mechanicsBuffer: reactionMechanics,
      residentProductMass,
      destroyOutputParticleBuffers() {
        reactionFamilyReleaseCount += 1;
        return true;
      }
    }),
    mechanicsMaterialTable: { materialCount: 1 },
    mechanicsRefreshRunner: null,
    phaseCarrierTransferRunner: async () => ({
      stateBuffer: phaseState,
      thermoBuffer: phaseThermo,
      mechanicsBuffer: phaseMechanics
    })
  });

  assert.equal(closure.continuation.stateBuffer, phaseState);
  assert.equal(closure.continuation.thermoBuffer, phaseThermo);
  assert.equal(closure.continuation.mechanicsBuffer, phaseMechanics);
  assert.equal(closure.continuation.residentProductMass, residentProductMass);
  claimMlsMpmPostMechanicsContinuation(closure, {
    stateBuffer: phaseState,
    thermoBuffer: phaseThermo,
    mechanicsBuffer: phaseMechanics
  });
  const retirement = await retireMlsMpmPostMechanicsClosureOutputsAfter(
    closure,
    { after: Promise.resolve(true) }
  );

  assert.equal(reactionFamilyReleaseCount, 0);
  assert.equal(retirement.preservedOwnerFamilyBufferCount, 3);
  assert.equal(reactionState.destroyCount, 0);
  assert.equal(reactionThermo.destroyCount, 0);
  assert.equal(reactionMechanics.destroyCount, 0);
});

test('promoted lone product retires the superseded raw reaction owner exactly once', async () => {
  const device = productHistoryDevice();
  const inputs = minimalClosureInputs({ device });
  inputs.sphParticleUpload.phaseCarrierPlan = {
    status: 'phase-lane-capacity-ready'
  };
  const thermalState = trackedBuffer('promoted-family-thermal-state');
  const thermalThermo = trackedBuffer('promoted-family-thermal-thermo');
  const reactionState = trackedBuffer('promoted-family-reaction-state');
  const reactionThermo = trackedBuffer('promoted-family-reaction-thermo');
  const reactionMechanics = trackedBuffer('promoted-family-reaction-mechanics');
  const phaseState = trackedBuffer('promoted-family-phase-state');
  const phaseThermo = trackedBuffer('promoted-family-phase-thermo');
  const phaseMechanics = trackedBuffer('promoted-family-phase-mechanics');
  const rawProductBuffer = trackedBuffer('promoted-family-raw-product-events');
  const promotedProductBuffer = trackedBuffer(
    'promoted-family-authenticated-product-history'
  );
  const rawResidentProductMass = tagProductHistorySource({
    status: 'resident-product-mass-buffer-retained',
    productEventBuffer: rawProductBuffer
  }, device);
  const promotedResidentProductMass = authenticateProductHistorySource({
    status: 'resident-product-mass-merged-gpu-resident',
    productEventBuffer: promotedProductBuffer
  }, device);
  let reactionFamilyReleaseCount = 0;
  const closure = await runMlsMpmPostMechanicsClosureWebGpu({
    ...inputs,
    thermalMaterialTable: { materialCount: 1 },
    thermalStepRunner: async () => ({
      stateBuffer: thermalState,
      thermoBuffer: thermalThermo
    }),
    reactionTable: { reactionCount: 1 },
    reactionStepRunner: async () => ({
      stateBuffer: reactionState,
      thermoBuffer: reactionThermo,
      mechanicsBuffer: reactionMechanics,
      residentProductMass: rawResidentProductMass,
      destroyOutputParticleBuffers() {
        reactionFamilyReleaseCount += 1;
        rawProductBuffer.destroy();
        return true;
      }
    }),
    mechanicsMaterialTable: { materialCount: 1 },
    mechanicsRefreshRunner: null,
    phaseCarrierTransferRunner: async () => ({
      stateBuffer: phaseState,
      thermoBuffer: phaseThermo,
      mechanicsBuffer: phaseMechanics
    }),
    residentProductMassMergeRunner: async () =>
      promotedResidentProductMass
  });

  assert.equal(
    closure.continuation.residentProductMass,
    promotedResidentProductMass
  );
  claimMlsMpmPostMechanicsContinuation(closure, {
    stateBuffer: phaseState,
    thermoBuffer: phaseThermo,
    mechanicsBuffer: phaseMechanics
  });
  const retirement = await retireMlsMpmPostMechanicsClosureOutputsAfter(
    closure,
    { after: Promise.resolve(true) }
  );

  assert.equal(reactionFamilyReleaseCount, 1);
  assert.equal(retirement.ownerFamilyCount, 1);
  assert.equal(rawProductBuffer.destroyCount, 1);
  assert.equal(promotedProductBuffer.destroyCount, 0);
  assert.equal(phaseState.destroyCount, 0);
  assert.equal(phaseThermo.destroyCount, 0);
  assert.equal(phaseMechanics.destroyCount, 0);
});

test('failed closure releases owner-managed stage outputs exactly once without raw member destruction', async () => {
  const inputs = minimalClosureInputs({
    device: {
      queue: { onSubmittedWorkDone: () => Promise.resolve() }
    }
  });
  const thermalState = trackedBuffer('failed-family-thermal-state');
  const thermalThermo = trackedBuffer('failed-family-thermal-thermo');
  const thermalFinalConsumer = Object.freeze({
    schema: 'test.failed-closure-thermal-final-consumer.v0'
  });
  let familyReleaseCount = 0;
  const familyReleaseOptions = [];

  await assert.rejects(runMlsMpmPostMechanicsClosureWebGpu({
    ...inputs,
    thermalMaterialTable: { materialCount: 1 },
    thermalStepRunner: async () => ({
      stateBuffer: thermalState,
      thermoBuffer: thermalThermo,
      queueOrderedRetainedOutputFinalConsumerCapability:
        thermalFinalConsumer,
      destroyOutputParticleBuffers(options) {
        familyReleaseCount += 1;
        familyReleaseOptions.push(options);
      }
    }),
    reactionTable: { reactionCount: 1 },
    reactionStepRunner: async () => {
      throw new Error('failed-owner-family-sidecar');
    }
  }), /failed-owner-family-sidecar/);
  await new Promise((resolve) => setImmediate(resolve));

  assert.equal(familyReleaseCount, 1);
  assert.deepEqual(familyReleaseOptions, [{
    preserveResidentProductMass: false,
    queueOrderedFinalConsumer: thermalFinalConsumer
  }]);
  assert.equal(thermalState.destroyCount, 0);
  assert.equal(thermalThermo.destroyCount, 0);
});

test('failed mechanics refresh consumes phase-sealed thermal and reaction claims exactly', async () => {
  let hostFenceCount = 0;
  const device = {
    queue: {
      submit() {},
      onSubmittedWorkDone() {
        hostFenceCount += 1;
        return Promise.resolve();
      }
    }
  };
  const inputs = minimalClosureInputs({ device });
  inputs.sphParticleState.phaseCarrierPlan = {
    status: 'phase-lane-capacity-ready'
  };
  inputs.sphParticleUpload.phaseCarrierPlan =
    inputs.sphParticleState.phaseCarrierPlan;

  const thermalOutput = {
    stateBuffer: trackedBuffer('sealed-failure-thermal-state'),
    thermoBuffer: trackedBuffer('sealed-failure-thermal-thermo')
  };
  const reactionOutput = {
    stateBuffer: trackedBuffer('sealed-failure-reaction-state'),
    thermoBuffer: trackedBuffer('sealed-failure-reaction-thermo'),
    mechanicsBuffer: trackedBuffer('sealed-failure-reaction-mechanics')
  };
  let thermalCleanupCount = 0;
  let reactionCleanupCount = 0;
  const thermalCleanup = () => {
    thermalCleanupCount += 1;
  };
  const reactionCleanup = () => {
    reactionCleanupCount += 1;
  };
  const thermalIssuer = createQueueOrderedCleanupClaimIssuer({
    producerFamily: 'test-failed-closure-thermal-output'
  });
  const reactionIssuer = createQueueOrderedCleanupClaimIssuer({
    producerFamily: 'test-failed-closure-reaction-output'
  });
  const thermalClaim = registerQueueOrderedCleanupClaim(
    thermalIssuer,
    device,
    {
      producerOutput: thermalOutput,
      cleanup: thermalCleanup
    }
  );
  const reactionClaim = registerQueueOrderedCleanupClaim(
    reactionIssuer,
    device,
    {
      producerOutput: reactionOutput,
      cleanup: reactionCleanup
    }
  );
  Object.defineProperty(thermalOutput, 'queueOrderedCleanupClaims', {
    value: Object.freeze([thermalClaim]),
    enumerable: false
  });
  Object.defineProperty(reactionOutput, 'queueOrderedCleanupClaims', {
    value: Object.freeze([reactionClaim]),
    enumerable: false
  });
  thermalOutput.destroyOutputParticleBuffers = ({
    queueOrderedFinalConsumer
  } = {}) => {
    releaseSubmittedWorkCleanupQueueOrdered(
      device,
      thermalCleanup,
      {
        queueOrderedFinalConsumer,
        producerClaim: thermalClaim,
        producerOutput: thermalOutput,
        producerFamily: 'test-failed-closure-thermal-output'
      }
    );
    return true;
  };
  reactionOutput.destroyOutputParticleBuffers = ({
    queueOrderedFinalConsumer
  } = {}) => {
    releaseSubmittedWorkCleanupQueueOrdered(
      device,
      reactionCleanup,
      {
        queueOrderedFinalConsumer,
        producerClaim: reactionClaim,
        producerOutput: reactionOutput,
        producerFamily: 'test-failed-closure-reaction-output'
      }
    );
    return true;
  };

  const failure = await runMlsMpmPostMechanicsClosureWebGpu({
    ...inputs,
    thermalMaterialTable: { materialCount: 1 },
    thermalStepRunner: async () => thermalOutput,
    reactionTable: { reactionCount: 1 },
    reactionStepRunner: async () => reactionOutput,
    mechanicsMaterialTable: { materialCount: 1 },
    phaseCarrierTransferRunner: async ({
      queueOrderedProducerClaims
    }) => {
      const phaseOutput = {
        stateBuffer: trackedBuffer('sealed-failure-phase-state'),
        thermoBuffer: trackedBuffer('sealed-failure-phase-thermo'),
        mechanicsBuffer: trackedBuffer('sealed-failure-phase-mechanics')
      };
      Object.defineProperty(
        phaseOutput,
        'queueOrderedFinalConsumerCapability',
        {
          value: submitQueueOrderedFinalConsumerWork(
            device,
            [Object.freeze({
              label: 'sealed-failure-phase-consumer-command'
            })],
            {
              finalConsumerOwner: phaseOutput,
              producerClaims: queueOrderedProducerClaims
            }
          ),
          enumerable: false
        }
      );
      return phaseOutput;
    },
    mechanicsRefreshRunner: async () => {
      throw new Error('sealed-failure-mechanics-refresh');
    }
  }).then(
    () => null,
    (error) => error
  );

  assert.match(failure?.message || '', /sealed-failure-mechanics-refresh/);
  await failure.postMechanicsCleanupCompletion;
  assert.equal(thermalCleanupCount, 1);
  assert.equal(reactionCleanupCount, 1);
  assert.equal(hostFenceCount, 1);
  const replaySubmission = submitQueueOrderedWork(
    device,
    [Object.freeze({ label: 'sealed-failure-replay-command' })]
  );
  assert.throws(
    () => sealQueueOrderedFinalConsumerCapability(
      replaySubmission,
      device,
      {
        finalConsumerOwner: {},
        producerClaims: [thermalClaim, reactionClaim]
      }
    ),
    { code: 'ERR_QUEUE_ORDERED_CLEANUP_UNAUTHORIZED' }
  );
});

test('owner-family retirement retries only the family that did not confirm release', async () => {
  const inputs = minimalClosureInputs();
  inputs.sphParticleUpload.phaseCarrierPlan = {
    status: 'phase-lane-capacity-ready'
  };
  const thermalState = trackedBuffer('retry-family-thermal-state');
  const thermalThermo = trackedBuffer('retry-family-thermal-thermo');
  const reactionState = trackedBuffer('retry-family-reaction-state');
  const reactionThermo = trackedBuffer('retry-family-reaction-thermo');
  const reactionMechanics = trackedBuffer('retry-family-reaction-mechanics');
  const phaseState = trackedBuffer('retry-family-phase-state');
  const phaseThermo = trackedBuffer('retry-family-phase-thermo');
  const phaseMechanics = trackedBuffer('retry-family-phase-mechanics');
  let thermalReleaseCount = 0;
  let reactionReleaseCount = 0;
  let reactionReleaseAllowed = false;
  const closure = await runMlsMpmPostMechanicsClosureWebGpu({
    ...inputs,
    thermalMaterialTable: { materialCount: 1 },
    thermalStepRunner: async () => ({
      stateBuffer: thermalState,
      thermoBuffer: thermalThermo,
      destroyOutputParticleBuffers() {
        thermalReleaseCount += 1;
        return true;
      }
    }),
    reactionTable: { reactionCount: 1 },
    reactionStepRunner: async () => ({
      stateBuffer: reactionState,
      thermoBuffer: reactionThermo,
      mechanicsBuffer: reactionMechanics,
      destroyOutputParticleBuffers() {
        reactionReleaseCount += 1;
        return reactionReleaseAllowed;
      }
    }),
    mechanicsMaterialTable: { materialCount: 1 },
    mechanicsRefreshRunner: null,
    phaseCarrierTransferRunner: async () => ({
      stateBuffer: phaseState,
      thermoBuffer: phaseThermo,
      mechanicsBuffer: phaseMechanics
    })
  });
  claimMlsMpmPostMechanicsContinuation(closure, {
    stateBuffer: phaseState,
    thermoBuffer: phaseThermo,
    mechanicsBuffer: phaseMechanics
  });

  await assert.rejects(
    retireMlsMpmPostMechanicsClosureOutputsAfter(closure, {
      after: Promise.resolve(true)
    }),
    { code: 'ERR_MLS_MPM_POST_MECHANICS_FAMILY_RETIREMENT' }
  );
  assert.equal(thermalReleaseCount, 1);
  assert.equal(reactionReleaseCount, 1);

  assert.throws(
    () => retireMlsMpmPostMechanicsClosureOutputsAfter(closure, {
      after: Promise.resolve(true),
      abandon: true
    }),
    { code: 'ERR_MLS_MPM_POST_MECHANICS_RETIREMENT_MODE' }
  );
  assert.equal(phaseState.destroyCount, 0);
  assert.equal(phaseThermo.destroyCount, 0);
  assert.equal(phaseMechanics.destroyCount, 0);

  reactionReleaseAllowed = true;
  const receipt = await retireMlsMpmPostMechanicsClosureOutputsAfter(closure, {
    after: Promise.resolve(true)
  });
  assert.equal(receipt.status, 'post-mechanics-superseded-components-retired');
  assert.equal(thermalReleaseCount, 1);
  assert.equal(reactionReleaseCount, 2);
});

test('failed closure captures a rejected resident product owner without an unhandled rejection', async () => {
  const inputs = minimalClosureInputs({
    device: {
      queue: { onSubmittedWorkDone: () => Promise.resolve() }
    }
  });
  const reactionState = trackedBuffer('product-reject-reaction-state');
  const reactionThermo = trackedBuffer('product-reject-reaction-thermo');
  const reactionMechanics = trackedBuffer('product-reject-reaction-mechanics');
  let productReleaseCount = 0;
  const residentProductMass = {
    productEventBuffer: trackedBuffer('product-reject-events'),
    productEventBufferRetained: true,
    productEventBufferByteLength: 128,
    productEventRowCount: 1,
    destroyResidentProductMassBuffers() {
      productReleaseCount += 1;
      return Promise.reject(new Error('injected-product-owner-rejection'));
    }
  };
  let failure = null;
  try {
    await runMlsMpmPostMechanicsClosureWebGpu({
      ...inputs,
      thermalMaterialTable: { materialCount: 1 },
      thermalStepRunner: null,
      reactionTable: { reactionCount: 1 },
      reactionStepRunner: async () => ({
        stateBuffer: reactionState,
        thermoBuffer: reactionThermo,
        mechanicsBuffer: reactionMechanics,
        residentProductMass
      }),
      mechanicsMaterialTable: { materialCount: 1 },
      mechanicsRefreshRunner: async () => {
        throw new Error('failure-after-product-publication');
      }
    });
  } catch (error) {
    failure = error;
  }
  assert.match(failure?.message || '', /failure-after-product-publication/);
  const cleanup = await failure.postMechanicsCleanupCompletion;
  assert.equal(productReleaseCount, 1);
  assert.equal(cleanup.status, 'post-mechanics-failure-cleanup-blocked');
  assert.deepEqual(cleanup.blockers, [
    'resident-product-mass-release-failed:injected-product-owner-rejection'
  ]);
  assert.equal(reactionState.destroyCount, 1);
  assert.equal(reactionThermo.destroyCount, 1);
  assert.equal(reactionMechanics.destroyCount, 1);
});

test('failed closure uses component ownership to retire a sibling beside a preserved input alias', async () => {
  const inputs = minimalClosureInputs({
    device: {
      queue: { onSubmittedWorkDone: () => Promise.resolve() }
    }
  });
  const ownedThermoSibling = trackedBuffer('preserved-alias-owned-sibling');
  let familyReleaseCount = 0;
  const componentSelections = [];

  let failure = null;
  try {
    await runMlsMpmPostMechanicsClosureWebGpu({
      ...inputs,
      thermalMaterialTable: { materialCount: 1 },
      thermalStepRunner: async () => ({
        stateBuffer: inputs.sphParticleUpload.stateBuffer,
        thermoBuffer: ownedThermoSibling,
        ownsStateBuffer: true,
        ownsThermoBuffer: true,
        destroyOutputParticleBuffers() {
          familyReleaseCount += 1;
          inputs.sphParticleUpload.stateBuffer.destroy();
          ownedThermoSibling.destroy();
          return true;
        },
        destroyOutputParticleBufferComponents(selection) {
          componentSelections.push(selection);
          if (selection.thermo === true) ownedThermoSibling.destroy();
          return true;
        }
      }),
      reactionTable: { reactionCount: 1 },
      reactionStepRunner: async () => {
        throw new Error('failure-after-preserved-family-alias');
      }
    });
  } catch (error) {
    failure = error;
  }
  assert.match(failure?.message || '', /failure-after-preserved-family-alias/);
  const cleanup = await failure.postMechanicsCleanupCompletion;

  assert.equal(familyReleaseCount, 0);
  assert.deepEqual(componentSelections, [{ thermo: true }]);
  assert.equal(inputs.sphParticleUpload.stateBuffer.destroyCount, 0);
  assert.equal(ownedThermoSibling.destroyCount, 1);
  assert.equal(cleanup.status, 'post-mechanics-failure-cleanup-complete');
  assert.deepEqual(cleanup.blockers, []);
});

test('failed closure publishes a durable blocker when a preserved-alias owner has no component surface', async () => {
  const inputs = minimalClosureInputs({
    device: {
      queue: { onSubmittedWorkDone: () => Promise.resolve() }
    }
  });
  const ownedThermoSibling = trackedBuffer('blocked-preserved-alias-sibling');
  let failure = null;
  try {
    await runMlsMpmPostMechanicsClosureWebGpu({
      ...inputs,
      thermalMaterialTable: { materialCount: 1 },
      thermalStepRunner: async () => ({
        stateBuffer: inputs.sphParticleUpload.stateBuffer,
        thermoBuffer: ownedThermoSibling,
        ownsStateBuffer: true,
        ownsThermoBuffer: true,
        destroyOutputParticleBuffers() {
          throw new Error('whole family must not run');
        }
      }),
      reactionTable: { reactionCount: 1 },
      reactionStepRunner: async () => {
        throw new Error('failure-before-component-retirement');
      }
    });
  } catch (error) {
    failure = error;
  }
  const cleanup = await failure.postMechanicsCleanupCompletion;
  assert.equal(cleanup.status, 'post-mechanics-failure-cleanup-blocked');
  assert.deepEqual(cleanup.blockers, [
    'preserved-alias-owner-lacks-component-retirement:thermal-phase'
  ]);
  assert.equal(inputs.sphParticleUpload.stateBuffer.destroyCount, 0);
  assert.equal(ownedThermoSibling.destroyCount, 0);
});

test('failed sidecar cleanup destroys owned outputs only and leaves borrowed aliases live', async () => {
  const inputs = minimalClosureInputs({
    device: {
      queue: { onSubmittedWorkDone: () => Promise.resolve() }
    }
  });
  const ownedState = trackedBuffer('owned-thermal-state');
  const borrowedThermo = trackedBuffer('borrowed-thermal-thermo');

  await assert.rejects(runMlsMpmPostMechanicsClosureWebGpu({
    ...inputs,
    thermalMaterialTable: { materialCount: 1 },
    thermalStepRunner: async () => ({
      stateBuffer: ownedState,
      thermoBuffer: borrowedThermo,
      ownsStateBuffer: true,
      ownsThermoBuffer: false
    }),
    reactionTable: { reactionCount: 1 },
    reactionStepRunner: async () => {
      throw new Error('injected-sidecar-failure');
    }
  }), /injected-sidecar-failure/);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(ownedState.destroyCount, 1);
  assert.equal(borrowedThermo.destroyCount, 0);
  assert.equal(inputs.sphParticleUpload.stateBuffer.destroyCount, 0);
  assert.equal(inputs.sphParticleUpload.thermoBuffer.destroyCount, 0);
  assert.equal(inputs.mlsMpmParticleUpload.mechanicsBuffer.destroyCount, 0);
});

test('closure rejects a terminal state/public epoch mismatch before any sidecar dispatch', async () => {
  const inputs = minimalClosureInputs();
  const expectedEpochIdentity = {
    storageGeneration: 7,
    physicsTick: 12,
    physicsSubstep: 0,
    positionEpoch: 13,
    topologyEpoch: 2,
    chartEpoch: 3,
    levelEpoch: 4,
    supportEpoch: 5
  };
  Object.assign(inputs.sphParticleUpload, {
    ...expectedEpochIdentity,
    physicsSubstep: 1
  });
  Object.assign(inputs.mlsMpmParticleUpload, { storageGeneration: 7 });
  let sidecarCalls = 0;
  await assert.rejects(runMlsMpmPostMechanicsClosureWebGpu({
    ...inputs,
    expectedEpochIdentity,
    schroederSpatialEpochGeneration: {
      execution: { ...expectedEpochIdentity },
      source: { sourceStateBuffer: inputs.sphParticleUpload.stateBuffer }
    },
    thermalMaterialTable: { materialCount: 1 },
    thermalStepRunner: async () => {
      sidecarCalls += 1;
      return null;
    }
  }), { code: 'ERR_MLS_MPM_POST_MECHANICS_EPOCH_MISMATCH' });
  assert.equal(sidecarCalls, 0);
});

test('unadopted reaction outputs retire once while exact claim replay stays authoritative', async () => {
  const inputs = minimalClosureInputs();
  const reactionState = trackedBuffer('suppressed-reaction-state');
  const reactionThermo = trackedBuffer('suppressed-reaction-thermo');
  const reactionMechanics = trackedBuffer('suppressed-reaction-mechanics');
  const closure = await runMlsMpmPostMechanicsClosureWebGpu({
    ...inputs,
    thermalMaterialTable: { materialCount: 1 },
    thermalStepRunner: null,
    reactionTable: { reactionCount: 1 },
    reactionStepRunner: async () => ({
      stateBuffer: reactionState,
      thermoBuffer: reactionThermo,
      mechanicsBuffer: reactionMechanics,
      reactionSummary: {
        reactionSummaryAvailable: true,
        canonicalReactionEventCount: 0
      }
    })
  });
  const claimOptions = {
    stateBuffer: inputs.sphParticleUpload.stateBuffer,
    thermoBuffer: inputs.sphParticleUpload.thermoBuffer,
    mechanicsBuffer: inputs.mlsMpmParticleUpload.mechanicsBuffer
  };
  const claim = claimMlsMpmPostMechanicsContinuation(
    closure,
    claimOptions
  );
  assert.equal(
    claimMlsMpmPostMechanicsContinuation(closure, claimOptions),
    claim
  );
  assert.throws(
    () => claimMlsMpmPostMechanicsContinuation(closure, {
      ...claimOptions,
      stateBuffer: reactionState
    }),
    { code: 'ERR_MLS_MPM_POST_MECHANICS_CLAIM_MISMATCH' }
  );
  const retirement = await retireMlsMpmPostMechanicsClosureOutputsAfter(
    closure,
    { after: Promise.resolve(true) }
  );
  assert.equal(retirement.destroyedBufferCount, 3);
  assert.equal(reactionState.destroyCount, 1);
  assert.equal(reactionThermo.destroyCount, 1);
  assert.equal(reactionMechanics.destroyCount, 1);
  await retireMlsMpmPostMechanicsClosureOutputsAfter(closure, {
    after: Promise.resolve(true)
  });
  assert.equal(reactionState.destroyCount, 1);
  assert.equal(reactionThermo.destroyCount, 1);
  assert.equal(reactionMechanics.destroyCount, 1);
});

test('post-mechanics closure never carries mechanics-field pressure rows as continuation state', async () => {
  // Slice 9 appends immutable pressure rows to the mechanics-field view. Those
  // rows belong to the field runtime for exactly one mutation generation and
  // must never be reclassified as retained particle continuation state, or a
  // later step could consume pressure that no longer describes its own P2G.
  // The closure only ever classifies particle-side buffers, and this pins that:
  // it must not name the mechanics-field view, its buffer, or its pressure rows.
  const source = await import('node:fs').then(({ readFileSync }) => readFileSync(
    new URL(
      '../src/runtime/sph/sphMlsMpmPostMechanicsClosure.js',
      import.meta.url
    ),
    'utf8'
  ));
  for (const forbidden of [
    'mechanicsFieldView',
    'fieldViewBuffer',
    'pressureOffsetWords',
    'pressureRow'
  ]) {
    assert.equal(
      source.includes(forbidden),
      false,
      `post-mechanics closure must not classify ${forbidden}`
    );
  }
});
