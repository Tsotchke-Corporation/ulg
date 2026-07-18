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

test('shared post-mechanics closure preserves the five-stage resident lineage', async () => {
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
  const inputResidentProductMass = {
    status: 'input-products',
    productEventBuffer: buffer('input-products-buffer')
  };
  const emittedResidentProductMass = {
    status: 'emitted-products',
    productEventBuffer: buffer('emitted-products-buffer')
  };
  const mergedResidentProductMass = {
    status: 'resident-product-mass-merged-gpu-resident',
    productEventBuffer: buffer('merged-products-buffer')
  };
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
    device: {},
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
      return { stateBuffer: thermalState, thermoBuffer: thermalThermo };
    },
    reactionTable: { reactionCount: 1, gasProductCount: 1 },
    reactionStepRunner: async (options) => {
      calls.push(['reaction', options]);
      return {
        stateBuffer: reactionState,
        thermoBuffer: reactionThermo,
        mechanicsBuffer: reactionMechanics,
        residentProductMass: emittedResidentProductMass
      };
    },
    mechanicsMaterialTable: { materialCount: 1 },
    mechanicsRefreshRunner: async (options) => {
      calls.push(['refresh', options]);
      return { mechanicsBuffer: refreshedMechanics };
    },
    phaseCarrierTransferRunner: async (options) => {
      calls.push(['phase-v2', options]);
      return {
        stateBuffer: phaseState,
        thermoBuffer: phaseThermo,
        mechanicsBuffer: phaseMechanics
      };
    },
    boxDimsM: [3, 3, 3],
    dtSeconds: 0.001,
    preferWebGpu: true,
    readbackMode: 'no-full-readback',
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
    'reaction',
    'refresh',
    'phase-v2',
    'product-merge'
  ]);
  assert.equal(calls[0][1].sourceStateBuffer, sourceState);
  assert.equal(calls[1][1].sourceStateBuffer, farState);
  assert.equal(calls[1][1].sourceThermoBuffer, sourceThermo);
  assert.equal(calls[2][1].sourceStateBuffer, thermalState);
  assert.equal(calls[2][1].sourceThermoBuffer, thermalThermo);
  assert.equal(calls[2][1].sourceMechanicsBuffer, sourceMechanics);
  assert.equal(calls[2][1].schroederLawQueue, null);
  assert.equal(calls[2][1].schroederLawNeighborCandidates, null);
  assert.equal(calls[2][1].readCompactReactionSummary, false);
  assert.equal(calls[3][1].sourceStateBuffer, reactionState);
  assert.equal(calls[3][1].sourceThermoBuffer, reactionThermo);
  assert.equal(calls[3][1].sourceMechanicsBuffer, reactionMechanics);
  assert.equal(calls[4][1].sourceStateBuffer, reactionState);
  assert.equal(calls[4][1].sourceThermoBuffer, reactionThermo);
  assert.equal(calls[4][1].sourceMechanicsBuffer, refreshedMechanics);
  assert.equal(calls[5][1].inputResidentProductMass,
    inputResidentProductMass);
  assert.equal(calls[5][1].emittedResidentProductMass,
    emittedResidentProductMass);
  assert.equal(result.continuation.stateBuffer, phaseState);
  assert.equal(result.continuation.thermoBuffer, phaseThermo);
  assert.equal(result.continuation.mechanicsBuffer, phaseMechanics);
  assert.equal(result.continuation.phaseCarrierTransferApplied, true);
  assert.equal(result.continuation.productMassMergeRequired, false);
  assert.equal(result.continuation.residentProductMass,
    mergedResidentProductMass);
  assert.equal(result.generation.spatialGenerationId, 17);
  assert.equal(result.readbackMode, 'no-full-readback');
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
