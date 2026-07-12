import test from 'node:test';
import assert from 'node:assert/strict';

import {
  SPH_RESIDENT_SEQUENCE_WORKSPACE_MAX_IN_FLIGHT_SUBMISSIONS,
  acquireSphResidentSequenceWorkspaceGpu,
  destroySphResidentSequenceWorkspaceGpuPool,
  isSphResidentSequenceWorkspaceBufferGpu,
  planSphResidentSequenceWorkspaceGpu,
  summarizeSphResidentSequenceWorkspaceGpuPool
} from '../src/runtime/sph/sphResidentSequenceWorkspaceGpu.js';
import { webGpuDeviceId } from '../src/runtime/sph/sphGpuDeviceIdentity.js';

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function fakeDevice() {
  const lost = deferred();
  const device = {
    createdBuffers: [],
    submissions: [],
    limits: {
      maxBufferSize: 1 << 30,
      maxStorageBufferBindingSize: 1 << 30,
      maxComputeWorkgroupsPerDimension: 65535
    },
    lost: lost.promise,
    queue: {
      submit(commands) {
        device.submissions.push(commands);
      },
      onSubmittedWorkDone() {
        return Promise.resolve();
      }
    },
    createBuffer(descriptor) {
      const buffer = {
        ...descriptor,
        destroyed: false,
        destroyCount: 0,
        destroy() {
          buffer.destroyed = true;
          buffer.destroyCount += 1;
        }
      };
      device.createdBuffers.push(buffer);
      return buffer;
    }
  };
  device.resolveLost = (info = { reason: 'destroyed' }) => lost.resolve(info);
  return device;
}

const ACQUISITION_ENCODERS = new WeakMap();

function encoderFor(acquisition) {
  let encoder = ACQUISITION_ENCODERS.get(acquisition);
  if (!encoder) {
    encoder = { label: `test-resident-sequence-encoder-${acquisition.acquisitionId}` };
    acquisition.bindCommandEncoder(encoder);
    ACQUISITION_ENCODERS.set(acquisition, encoder);
  }
  return encoder;
}

function identity(device, serial = 1, overrides = {}) {
  return {
    schema: 'peercompute.compute.gpu-resident-lane-lease-identity.v0',
    authoritative: true,
    leaseId: `workspace-lease-${serial}`,
    laneId: 'compute-manager-resident-mechanics-lane',
    stateKey: 'sph-particle-hot-state:0',
    sourceFamily: 'sph-particle-state',
    taskId: `resident-sequence-task-${serial}`,
    deviceId: webGpuDeviceId(device),
    ...overrides
  };
}

function requirements(overrides = {}) {
  return {
    particleCapacity: 300_000,
    gridNodeCapacity: 1_024,
    stateByteLength: 300_000 * 8 * 4,
    thermoByteLength: 300_000 * 12 * 4,
    mechanicsByteLength: 300_000 * 32 * 4,
    gridByteLength: 1_024 * 8 * 4,
    p2gAccumulatorByteLength: 1_024 * 8 * 4,
    updatedGridByteLength: 1_024 * 4 * 4,
    thermalParticleCapacity: 0,
    reactionProductEventCapacityRows: 0,
    reactionCoreParticleCapacity: 0,
    reactionParticleCapacity: 0,
    pressureCandidateCapacity: 0,
    layoutKey: 'sph8:thermo12:mechanics32:grid8:accum8:updated4:v0',
    ...overrides
  };
}

async function acquire(device, serial, overrides = {}) {
  const authorityEpoch = overrides.authorityEpoch ?? 0;
  const requirementOverrides = { ...overrides };
  delete requirementOverrides.authorityEpoch;
  return acquireSphResidentSequenceWorkspaceGpu({
    device,
    leaseIdentity: identity(device, serial),
    authorityEpoch,
    ...requirements(requirementOverrides)
  });
}

function finalBuffers(acquisition, source = {}) {
  encoderFor(acquisition);
  return {
    finalStateBuffer: acquisition.selectDestination('state', source.stateBuffer),
    finalThermoBuffer: acquisition.selectDestination('thermo', source.thermoBuffer),
    finalMechanicsBuffer: acquisition.selectDestination('mechanics', source.mechanicsBuffer)
  };
}


function submitAcquisition(device, acquisition, {
  completedWork = Promise.resolve(),
  ...submissionPlan
} = {}) {
  const commandEncoder = encoderFor(acquisition);
  const seal = acquisition.sealForSubmission({
    commandEncoder,
    ...submissionPlan
  });
  device.queue.submit([{ commandEncoder }]);
  const commit = acquisition.commitSubmitted({ commandEncoder, completedWork });
  assert.equal(commit.accepted, true);
  return { seal, commit, settlement: commit.settlement };
}

test('300k resident particle-family ring has an exact 124.8 MB byte total', () => {
  const plan = planSphResidentSequenceWorkspaceGpu(requirements());
  assert.equal(plan.stateByteLength, 9_600_000);
  assert.equal(plan.thermoByteLength, 14_400_000);
  assert.equal(plan.mechanicsByteLength, 38_400_000);
  assert.equal(plan.particleFamilyByteLength, 124_800_000);
  assert.equal(plan.stateBufferCount, 2);
  assert.equal(plan.thermoBufferCount, 2);
  assert.equal(plan.mechanicsBufferCount, 2);
  assert.equal(plan.immutableSnapshotBuffers, false);
});

test('workspace requires exact authoritative device, lane, state, and source identity', async () => {
  const device = fakeDevice();
  await assert.rejects(
    acquireSphResidentSequenceWorkspaceGpu({
      device,
      leaseIdentity: identity(device, 1, { laneId: 'wrong-lane' }),
      laneId: 'compute-manager-resident-mechanics-lane',
      stateKey: 'sph-particle-hot-state:0',
      sourceFamily: 'sph-particle-state',
      ...requirements()
    }),
    /laneId does not match/
  );
  await assert.rejects(
    acquireSphResidentSequenceWorkspaceGpu({
      device,
      leaseIdentity: identity(device, 1, { deviceId: 'other-device' }),
      ...requirements()
    }),
    /deviceId does not match/
  );
  assert.equal(device.createdBuffers.length, 0);
  destroySphResidentSequenceWorkspaceGpuPool(device);
});

test('resident sequence owns and reuses one reaction core workspace per lane generation', async () => {
  const device = fakeDevice();
  const first = await acquire(device, 1, {
    reactionCoreParticleCapacity: 300_000,
    sequenceStepCapacity: 7
  });
  const reactionCoreWorkspace = first.reactionCoreWorkspace;

  assert.equal(reactionCoreWorkspace?.status, 'reaction-core-workspace-ready');
  assert.equal(reactionCoreWorkspace?.particleCapacity, 300_000);
  assert.equal(reactionCoreWorkspace?.sequenceStepCapacity, 7);
  assert.equal(reactionCoreWorkspace?.allocationEntries.length, 4);
  assert.equal(reactionCoreWorkspace?.paramsBufferByteLength, 7 * 1024);
  assert.equal(reactionCoreWorkspace?.totalByteLength, 4_808_448);
  assert.equal(
    first.allocationEntries.filter(({ role }) => role.includes('reaction-core')).length,
    4
  );
  const allocationCount = device.createdBuffers.length;
  first.cancelBeforeSubmit('test-reuse');

  const second = await acquire(device, 2, {
    reactionCoreParticleCapacity: 300_000,
    sequenceStepCapacity: 7
  });
  assert.equal(second.reused, true);
  assert.equal(second.reactionCoreWorkspace, reactionCoreWorkspace);
  assert.equal(device.createdBuffers.length, allocationCount);
  second.cancelBeforeSubmit('test-complete');

  destroySphResidentSequenceWorkspaceGpuPool(device);
  assert.equal(reactionCoreWorkspace.destroyed, true);
  assert.equal(
    reactionCoreWorkspace.allocationEntries.every(({ buffer }) => buffer.destroyed),
    true
  );
});

test('resident sequence thermal workspace inherits the aligned sequence-step capacity', async () => {
  const device = fakeDevice();
  const acquisition = await acquire(device, 1, {
    thermalParticleCapacity: 4,
    sequenceStepCapacity: 7
  });
  const workspace = acquisition.thermalWorkspace;

  assert.equal(workspace?.status, 'thermal-workspace-ready');
  assert.equal(workspace?.particleCapacity, 4);
  assert.equal(workspace?.sequenceStepCapacity, 7);
  assert.equal(workspace?.paramsSlotStrideBytes, 256);
  assert.equal(workspace?.paramsBufferByteLength, 7 * 256);
  assert.equal(workspace?.allocationEntries.length, 2);
  assert.equal(
    acquisition.allocationEntries.filter(({ role }) => role.includes('thermal-')).length,
    2
  );

  acquisition.cancelBeforeSubmit('test-complete');
  destroySphResidentSequenceWorkspaceGpuPool(device);
  assert.ok(workspace.allocationEntries.every(({ buffer }) => buffer.destroyed));
});

test('resident sequence pressure workspace inherits the aligned sequence-step capacity', async () => {
  const device = fakeDevice();
  const acquisition = await acquire(device, 1, {
    pressureCandidateCapacity: 32,
    sequenceStepCapacity: 7
  });
  const workspace = acquisition.pressureInterfaceWorkspace;

  assert.equal(workspace?.status, 'pressure-interface-workspace-ready');
  assert.equal(workspace?.candidateCapacity, 32);
  assert.equal(workspace?.sequenceStepCapacity, 7);
  assert.equal(workspace?.controlSlotStrideBytes % 256, 0);
  assert.equal(workspace?.allocationEntries.length, 11);
  assert.equal(
    acquisition.allocationEntries.filter(({ role }) => role.includes('pressure-interface')).length,
    11
  );

  acquisition.cancelBeforeSubmit('test-complete');
  destroySphResidentSequenceWorkspaceGpuPool(device);
  assert.ok(workspace.allocationEntries.every(({ buffer }) => buffer.destroyed));
});

test('shared mutable scratch rejects a second acquisition before the prior command submit', async () => {
  const device = fakeDevice();
  const first = await acquire(device, 1);
  await assert.rejects(
    acquire(device, 2),
    (error) => error?.code === 'ULG_SPH_RESIDENT_SEQUENCE_PRIOR_ACQUISITION_NOT_SUBMITTED'
  );
  first.cancelBeforeSubmit('test-complete');
  destroySphResidentSequenceWorkspaceGpuPool(device);
});

test('warm acquisitions reuse mutable grid scratch and opposite particle destinations without allocation', async () => {
  const device = fakeDevice();
  const completionA = deferred();
  const first = await acquire(device, 1);
  const sourceA = {
    stateBuffer: { label: 'initial-state' },
    thermoBuffer: { label: 'initial-thermo' },
    mechanicsBuffer: { label: 'initial-mechanics' }
  };
  first.assertAuthoritativeSourceBuffers(sourceA);
  const finalA = finalBuffers(first, sourceA);
  assert.notEqual(finalA.finalStateBuffer, sourceA.stateBuffer);
  assert.notEqual(finalA.finalThermoBuffer, sourceA.thermoBuffer);
  assert.notEqual(finalA.finalMechanicsBuffer, sourceA.mechanicsBuffer);
  const warmAllocationCount = device.createdBuffers.length;
  const settledA = submitAcquisition(device, first, {
    ...finalA,
    completedWork: completionA.promise
  }).settlement;

  const completionB = deferred();
  const second = await acquire(device, 2);
  assert.equal(second.reused, true);
  assert.equal(second.createdThisAcquisition, false);
  assert.equal(device.createdBuffers.length, warmAllocationCount);
  assert.equal(second.gridBuffer, first.gridBuffer);
  assert.equal(second.p2gAccumulatorBuffer, first.p2gAccumulatorBuffer);
  assert.equal(second.updatedGridBuffer, first.updatedGridBuffer);
  assert.equal(second.p2gParamsBuffer, first.p2gParamsBuffer);
  assert.equal(second.gridUpdateParamsBuffer, first.gridUpdateParamsBuffer);
  assert.equal(second.g2pParamsBuffer, first.g2pParamsBuffer);
  assert.equal(second.emptyPressureForceRowsBuffer, first.emptyPressureForceRowsBuffer);
  assert.equal(second.separationScratch, first.separationScratch);
  assert.equal(
    second.allocationEntries.filter(({ createdThisSubmission }) => createdThisSubmission).length,
    0
  );
  second.assertAuthoritativeSourceBuffers({
    stateBuffer: finalA.finalStateBuffer,
    thermoBuffer: finalA.finalThermoBuffer,
    mechanicsBuffer: finalA.finalMechanicsBuffer,
    predecessorPublicationToken: first.publicationToken
  });
  const finalB = finalBuffers(second, {
    stateBuffer: finalA.finalStateBuffer,
    thermoBuffer: finalA.finalThermoBuffer,
    mechanicsBuffer: finalA.finalMechanicsBuffer
  });
  assert.notEqual(finalB.finalStateBuffer, finalA.finalStateBuffer);
  assert.notEqual(finalB.finalThermoBuffer, finalA.finalThermoBuffer);
  assert.notEqual(finalB.finalMechanicsBuffer, finalA.finalMechanicsBuffer);
  assert.equal(isSphResidentSequenceWorkspaceBufferGpu(finalB.finalStateBuffer), true);
  const settledB = submitAcquisition(device, second, {
    ...finalB,
    completedWork: completionB.promise
  }).settlement;

  completionA.resolve();
  completionB.resolve();
  assert.equal((await settledA).status, 'queue-work-completed');
  assert.equal((await settledB).status, 'queue-work-completed');
  const lane = summarizeSphResidentSequenceWorkspaceGpuPool(device).lanes[0];
  assert.equal(lane.totalWorkspaceCreationCount, 1);
  assert.equal(lane.totalWorkspaceReuseCount, 1);
  assert.equal(lane.pendingSubmissionCount, 0);
  assert.equal(lane.priorConsumersMustBeCommandSubmittedBeforeReuse, true);
  destroySphResidentSequenceWorkspaceGpuPool(device);
});

test('an unresolved even ping chain republishes identical buffers under a newer token', async () => {
  const device = fakeDevice();
  const completionA = deferred();
  const completionB = deferred();
  const first = await acquire(device, 1);
  const initial = {
    stateBuffer: { label: 'initial-state' },
    thermoBuffer: { label: 'initial-thermo' },
    mechanicsBuffer: { label: 'initial-mechanics' }
  };
  first.assertAuthoritativeSourceBuffers(initial);
  const firstFinal = finalBuffers(first, initial);
  const firstSubmission = submitAcquisition(device, first, {
    ...firstFinal,
    completedWork: completionA.promise
  });

  const second = await acquire(device, 2);
  const source = {
    stateBuffer: firstFinal.finalStateBuffer,
    thermoBuffer: firstFinal.finalThermoBuffer,
    mechanicsBuffer: firstFinal.finalMechanicsBuffer
  };
  second.assertAuthoritativeSourceBuffers({
    ...source,
    predecessorPublicationToken: first.publicationToken
  });
  encoderFor(second);
  const stateMiddle = second.selectDestination('state', source.stateBuffer);
  const thermoMiddle = second.selectDestination('thermo', source.thermoBuffer);
  const mechanicsMiddle = second.selectDestination('mechanics', source.mechanicsBuffer);
  const final = {
    finalStateBuffer: second.selectDestination('state', stateMiddle),
    finalThermoBuffer: second.selectDestination('thermo', thermoMiddle),
    finalMechanicsBuffer: second.selectDestination('mechanics', mechanicsMiddle)
  };
  assert.equal(final.finalStateBuffer, source.stateBuffer);
  assert.equal(final.finalThermoBuffer, source.thermoBuffer);
  assert.equal(final.finalMechanicsBuffer, source.mechanicsBuffer);
  const secondSubmission = submitAcquisition(device, second, {
    ...final,
    completedWork: completionB.promise
  });
  assert.equal(
    second.commitSubmitted({ commandEncoder: encoderFor(second) }),
    secondSubmission.commit
  );
  assert.notEqual(second.publicationToken.submissionVersion,
    first.publicationToken.submissionVersion);
  assert.deepEqual(second.snapshot().particleFamilyTransitionCounts, {
    state: 2,
    thermo: 2,
    mechanics: 2
  });

  completionA.resolve();
  await firstSubmission.settlement;
  const replay = await acquire(device, 3);
  assert.throws(
    () => replay.assertAuthoritativeSourceBuffers({
      ...source,
      predecessorPublicationToken: first.publicationToken
    }),
    (error) => (
      error?.code === 'ULG_SPH_RESIDENT_SEQUENCE_PREDECESSOR_TOKEN_REJECTED'
      && error?.reason === 'predecessor-publication-token-stale'
    )
  );
  assert.equal(replay.assertAuthoritativeSourceBuffers({
    ...source,
    predecessorPublicationToken: second.publicationToken
  }), true);
  replay.cancelBeforeSubmit('test-complete');
  completionB.resolve();
  await secondSubmission.settlement;

  destroySphResidentSequenceWorkspaceGpuPool(device);
});

test('resident sequence submission rejects a discontinuous ping transition chain', async () => {
  const device = fakeDevice();
  const acquisition = await acquire(device, 1);
  const source = {
    stateBuffer: { label: 'initial-state' },
    thermoBuffer: { label: 'initial-thermo' },
    mechanicsBuffer: { label: 'initial-mechanics' }
  };
  acquisition.assertAuthoritativeSourceBuffers(source);
  const final = finalBuffers(acquisition, source);
  acquisition.selectDestination('state', source.stateBuffer);
  assert.throws(() => acquisition.sealForSubmission({
    commandEncoder: encoderFor(acquisition),
    ...final
  }), /state transition chain is discontinuous/);
  assert.equal(device.submissions.length, 0);
  assert.equal(
    summarizeSphResidentSequenceWorkspaceGpuPool(device).lanes[0].pendingSubmissionCount,
    0
  );
  const replacement = await acquire(device, 2);
  replacement.cancelBeforeSubmit('preflight-rejection-did-not-wedge-lane');
  destroySphResidentSequenceWorkspaceGpuPool(device);
});

test('two unresolved submissions are admitted and a third waits for the oldest completion', async () => {
  const device = fakeDevice();
  const completionA = deferred();
  const completionB = deferred();
  const first = await acquire(device, 1);
  const source = {
    stateBuffer: { label: 'initial-state' },
    thermoBuffer: { label: 'initial-thermo' },
    mechanicsBuffer: { label: 'initial-mechanics' }
  };
  first.assertAuthoritativeSourceBuffers(source);
  const finalA = finalBuffers(first, source);
  submitAcquisition(device, first, { ...finalA, completedWork: completionA.promise });
  const second = await acquire(device, 2);
  second.assertAuthoritativeSourceBuffers({
    stateBuffer: finalA.finalStateBuffer,
    thermoBuffer: finalA.finalThermoBuffer,
    mechanicsBuffer: finalA.finalMechanicsBuffer,
    predecessorPublicationToken: first.publicationToken
  });
  const finalB = finalBuffers(second, {
    stateBuffer: finalA.finalStateBuffer,
    thermoBuffer: finalA.finalThermoBuffer,
    mechanicsBuffer: finalA.finalMechanicsBuffer
  });
  submitAcquisition(device, second, { ...finalB, completedWork: completionB.promise });
  assert.equal(
    summarizeSphResidentSequenceWorkspaceGpuPool(device).lanes[0].pendingSubmissionCount,
    SPH_RESIDENT_SEQUENCE_WORKSPACE_MAX_IN_FLIGHT_SUBMISSIONS
  );

  let thirdResolved = false;
  const thirdPromise = acquire(device, 3).then((value) => {
    thirdResolved = true;
    return value;
  });
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(thirdResolved, false);
  completionA.resolve();
  const third = await thirdPromise;
  assert.equal(third.waitedForCapacity, true);
  assert.equal(third.reused, true);
  third.cancelBeforeSubmit('test-complete');
  completionB.resolve();
  await second.settlement;
  const lane = summarizeSphResidentSequenceWorkspaceGpuPool(device).lanes[0];
  assert.equal(lane.peakPendingSubmissionCount, 2);
  assert.equal(lane.totalBackpressureWaitCount, 1);
  destroySphResidentSequenceWorkspaceGpuPool(device);
});

test('grow-and-retire keeps the old authoritative arena alive through the new queue fence', async () => {
  const device = fakeDevice();
  const completionA = deferred();
  const completionB = deferred();
  const first = await acquire(device, 1, { particleCapacity: 4 });
  const source = {
    stateBuffer: { label: 'initial-state' },
    thermoBuffer: { label: 'initial-thermo' },
    mechanicsBuffer: { label: 'initial-mechanics' }
  };
  first.assertAuthoritativeSourceBuffers(source);
  const finalA = finalBuffers(first, source);
  submitAcquisition(device, first, { ...finalA, completedWork: completionA.promise });
  const oldStateBuffer = first.statePingBuffers[0];

  const second = await acquire(device, 2, {
    particleCapacity: 600_000,
    stateByteLength: 600_000 * 8 * 4,
    thermoByteLength: 600_000 * 12 * 4,
    mechanicsByteLength: 600_000 * 32 * 4
  });
  assert.equal(second.grew, true);
  assert.equal(oldStateBuffer.destroyed, false);
  second.assertAuthoritativeSourceBuffers({
    stateBuffer: finalA.finalStateBuffer,
    thermoBuffer: finalA.finalThermoBuffer,
    mechanicsBuffer: finalA.finalMechanicsBuffer,
    predecessorPublicationToken: first.publicationToken
  });
  const finalB = finalBuffers(second, {
    stateBuffer: finalA.finalStateBuffer,
    thermoBuffer: finalA.finalThermoBuffer,
    mechanicsBuffer: finalA.finalMechanicsBuffer
  });
  submitAcquisition(device, second, { ...finalB, completedWork: completionB.promise });
  completionA.resolve();
  await first.settlement;
  assert.equal(oldStateBuffer.destroyed, false);
  completionB.resolve();
  await second.settlement;
  assert.equal(oldStateBuffer.destroyed, true);
  const lane = summarizeSphResidentSequenceWorkspaceGpuPool(device).lanes[0];
  assert.equal(lane.totalWorkspaceGrowthCount, 1);
  assert.equal(lane.retiredWorkspaceCount, 0);
  assert.equal(lane.retiredWorkspaceDestroyCount, 1);
  destroySphResidentSequenceWorkspaceGpuPool(device);
});

test('device loss poisons the pool and releases bounded waiters without CPU readback', async () => {
  const device = fakeDevice();
  const acquisition = await acquire(device, 1);
  const firstBuffer = acquisition.statePingBuffers[0];
  device.resolveLost({ reason: 'unknown', message: 'test device loss' });
  await Promise.resolve();
  await Promise.resolve();
  assert.equal((await acquisition.settlement).status,
    'sph-resident-sequence-workspace-device-lost');
  assert.equal(firstBuffer.destroyed, true);
  assert.equal(summarizeSphResidentSequenceWorkspaceGpuPool(device).poisoned, true);
  await assert.rejects(acquire(device, 2), /poisoned/);
  destroySphResidentSequenceWorkspaceGpuPool(device);
});

test('an unchanged nonthermal thermo family remains authoritative without a GPU copy', async () => {
  const device = fakeDevice();
  const acquisition = await acquire(device, 1);
  const source = {
    stateBuffer: { label: 'initial-state' },
    thermoBuffer: { label: 'unchanged-thermo' },
    mechanicsBuffer: { label: 'initial-mechanics' }
  };
  acquisition.assertAuthoritativeSourceBuffers(source);
  encoderFor(acquisition);
  const finalStateBuffer = acquisition.selectDestination('state', source.stateBuffer);
  const finalMechanicsBuffer = acquisition.selectDestination(
    'mechanics',
    source.mechanicsBuffer
  );
  const result = await submitAcquisition(device, acquisition, {
    finalStateBuffer,
    finalThermoBuffer: source.thermoBuffer,
    finalMechanicsBuffer,
    mutatedFamilies: ['state', 'mechanics'],
    completedWork: Promise.resolve()
  }).settlement;
  assert.equal(result.status, 'queue-work-completed');
  assert.equal(
    summarizeSphResidentSequenceWorkspaceGpuPool(device).lanes[0]
      .authoritativeBuffersPublished,
    true
  );
  destroySphResidentSequenceWorkspaceGpuPool(device);
});

test('same-epoch source replacement is rejected after prior queue completion', async () => {
  const device = fakeDevice();
  const first = await acquire(device, 1, { authorityEpoch: 4 });
  const source = {
    stateBuffer: { label: 'epoch-4-state' },
    thermoBuffer: { label: 'epoch-4-thermo' },
    mechanicsBuffer: { label: 'epoch-4-mechanics' }
  };
  first.assertAuthoritativeSourceBuffers(source);
  await submitAcquisition(device, first, {
    ...finalBuffers(first, source),
    completedWork: Promise.resolve()
  }).settlement;
  const replacement = await acquire(device, 2, { authorityEpoch: 4 });
  assert.throws(
    () => replacement.assertAuthoritativeSourceBuffers({
      stateBuffer: { label: 'replacement-state' },
      thermoBuffer: { label: 'replacement-thermo' },
      mechanicsBuffer: { label: 'replacement-mechanics' },
      predecessorPublicationToken: first.publicationToken
    }),
    (error) => error?.code === 'ULG_SPH_RESIDENT_SEQUENCE_SOURCE_CONTINUITY_REJECTED'
  );
  replacement.cancelBeforeSubmit('test-complete');
  destroySphResidentSequenceWorkspaceGpuPool(device);
});

test('newer authority epoch waits old queue work then admits a fresh source without reallocating', async () => {
  const device = fakeDevice();
  const completion = deferred();
  const first = await acquire(device, 1, { authorityEpoch: 7 });
  const source = {
    stateBuffer: { label: 'epoch-7-state' },
    thermoBuffer: { label: 'epoch-7-thermo' },
    mechanicsBuffer: { label: 'epoch-7-mechanics' }
  };
  first.assertAuthoritativeSourceBuffers(source);
  submitAcquisition(device, first, {
    ...finalBuffers(first, source),
    completedWork: completion.promise
  });
  const warmAllocationCount = device.createdBuffers.length;
  let rebasedResolved = false;
  const rebasedPromise = acquire(device, 2, { authorityEpoch: 8 }).then((value) => {
    rebasedResolved = true;
    return value;
  });
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(rebasedResolved, false);
  completion.resolve();
  const rebased = await rebasedPromise;
  assert.equal(rebased.authorityRebased, true);
  assert.equal(rebased.waitedForAuthorityRebase, true);
  assert.equal(rebased.reused, true);
  assert.equal(device.createdBuffers.length, warmAllocationCount);
  const freshSource = {
    stateBuffer: { label: 'epoch-8-state' },
    thermoBuffer: { label: 'epoch-8-thermo' },
    mechanicsBuffer: { label: 'epoch-8-mechanics' }
  };
  assert.equal(rebased.assertAuthoritativeSourceBuffers(freshSource), true);
  const snapshot = rebased.snapshot();
  assert.equal(snapshot.authorityEpoch, 8);
  assert.equal(snapshot.authorityRebaseCount, 1);
  assert.equal(snapshot.authorityRebased, true);
  rebased.cancelBeforeSubmit('test-complete');
  destroySphResidentSequenceWorkspaceGpuPool(device);
});

test('older authority epoch is rejected after an explicit rebase', async () => {
  const device = fakeDevice();
  const first = await acquire(device, 1, { authorityEpoch: 2 });
  first.cancelBeforeSubmit('test-complete');
  const current = await acquire(device, 2, { authorityEpoch: 3 });
  current.cancelBeforeSubmit('test-complete');
  await assert.rejects(
    acquire(device, 3, { authorityEpoch: 2 }),
    (error) => error?.code === 'ULG_SPH_RESIDENT_SEQUENCE_STALE_AUTHORITY_EPOCH'
  );
  destroySphResidentSequenceWorkspaceGpuPool(device);
});
