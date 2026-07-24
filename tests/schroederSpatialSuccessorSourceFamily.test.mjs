import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  SCHROEDER_SPATIAL_TOPOLOGY_TRANSITION_FINAL_SEAL,
  SCHROEDER_SPATIAL_TOPOLOGY_TRANSITION_MAGIC,
  SCHROEDER_SPATIAL_TOPOLOGY_TRANSITION_STATUS,
  SCHROEDER_SPATIAL_TOPOLOGY_TRANSITION_VERSION
} from '../ulg-gpu-abi/src/schroederSpatialTopologyTransition.js';
import {
  acquireSchroederSpatialSuccessorSourceFamilyLease,
  allocateSchroederSpatialSuccessorBufferFamilyIdentity,
  createSchroederSpatialSuccessorSourceFamily,
  prepareSchroederSpatialSuccessorSourceFamilyPublication,
  publishPreparedSchroederSpatialSuccessorSourceFamily,
  releaseSchroederSpatialSuccessorSourceFamilyLease,
  releaseSchroederSpatialSuccessorSourceFamilyLeaseAfter,
  resolveSchroederSpatialSuccessorSourceFamily,
  retireSchroederSpatialSuccessorSourceFamily,
  retireSchroederSpatialSuccessorSourceFamilyAfterLeases,
  schroederSpatialSuccessorSourceFamilyLiveness,
  validateSchroederSpatialSuccessorPublicationReceipt
} from '../src/runtime/sph/schroederSpatialSuccessorSourceFamily.js';
import {
  applySchroederSpatialTopologyTransitionReceipt,
  runSchroederSpatialTopologyTransitionWebGpu
} from '../src/runtime/sph/schroederSpatialTopologyTransitionGpu.js';
import {
  tagWebGpuBufferDevice,
  webGpuDeviceId
} from '../src/runtime/sph/sphGpuDeviceIdentity.js';
import {
  SCHROEDER_SPATIAL_EPOCH_READER,
  SCHROEDER_SPATIAL_EPOCH_READER_PHASE,
  admitSchroederSpatialEpochTransactionReader,
  commitSchroederSpatialEpochTransaction,
  createSchroederSpatialEpochTransaction,
  sealSchroederSpatialEpochTransactionProposals,
  sealSchroederSpatialEpochTransactionReaders
} from '../src/runtime/sph/schroederSpatialEpochTransaction.js';

function activeMass(value) {
  return Number.isFinite(value) && value > 0;
}

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((onResolve, onReject) => {
    resolve = onResolve;
    reject = onReject;
  });
  return { promise, resolve, reject };
}

function createFakeDevice() {
  let resolveDeviceLoss;
  const lost = new Promise((resolve) => {
    resolveDeviceLoss = resolve;
  });
  const buffers = [];
  const device = {
    buffers,
    lost,
    lose(info = { reason: 'destroyed', message: 'test device lost' }) {
      resolveDeviceLoss(info);
    },
    limits: { maxComputeWorkgroupsPerDimension: 65_535 },
    createBuffer(descriptor) {
      const buffer = {
        ...descriptor,
        destroyed: false,
        destroyCount: 0,
        destroy() {
          this.destroyed = true;
          this.destroyCount += 1;
        },
        async mapAsync() {},
        getMappedRange() {
          return this._mappedData?.buffer ?? new ArrayBuffer(descriptor.size);
        },
        unmap() {}
      };
      buffers.push(buffer);
      return buffer;
    },
    createShaderModule(descriptor) { return descriptor; },
    createBindGroupLayout(descriptor) { return descriptor; },
    createPipelineLayout(descriptor) { return descriptor; },
    createComputePipeline(descriptor) {
      return {
        descriptor,
        getBindGroupLayout() { return { label: `${descriptor.label}-layout` }; }
      };
    },
    createBindGroup(descriptor) { return descriptor; },
    createCommandEncoder() {
      let boundGroup = null;
      return {
        beginComputePass() {
          return {
            setPipeline() {},
            setBindGroup(index, value) { boundGroup = value; },
            dispatchWorkgroups() {},
            end() {}
          };
        },
        copyBufferToBuffer(source, sourceOffset, destination) {
          const entries = Object.fromEntries(
            boundGroup.entries.map((entry) => [entry.binding, entry.resource.buffer])
          );
          const [
            sourceCount,
            successorCount,
            generationId,
            nonce,
            sourceEpoch,
            forceAdvance
          ] = entries[2]._writtenData;
          const sourceMasses = entries[0]._masses;
          const successorMasses = entries[1]._masses;
          const comparisonCount = Math.max(sourceCount, successorCount);
          let sourceActiveCount = 0;
          let successorActiveCount = 0;
          let activatedCount = 0;
          let deactivatedCount = 0;
          for (let index = 0; index < comparisonCount; index += 1) {
            const sourceActive = index < sourceCount
              && activeMass(sourceMasses[index]);
            const successorActive = index < successorCount
              && activeMass(successorMasses[index]);
            if (sourceActive) sourceActiveCount += 1;
            if (successorActive) successorActiveCount += 1;
            if (sourceActive !== successorActive) {
              if (successorActive) activatedCount += 1;
              else deactivatedCount += 1;
            }
          }
          const xorCount = activatedCount + deactivatedCount;
          const changed = xorCount > 0 || forceAdvance === 1;
          const words = new Uint32Array(24);
          words.set([
            SCHROEDER_SPATIAL_TOPOLOGY_TRANSITION_MAGIC,
            SCHROEDER_SPATIAL_TOPOLOGY_TRANSITION_VERSION,
            generationId,
            nonce,
            sourceEpoch,
            sourceCount,
            successorCount,
            comparisonCount,
            1,
            comparisonCount,
            sourceActiveCount,
            successorActiveCount,
            activatedCount,
            deactivatedCount,
            xorCount,
            0,
            0,
            forceAdvance,
            1,
            changed ? 1 : 0,
            changed ? sourceEpoch + 1 : sourceEpoch,
            SCHROEDER_SPATIAL_TOPOLOGY_TRANSITION_STATUS.COMPLETE,
            0,
            SCHROEDER_SPATIAL_TOPOLOGY_TRANSITION_FINAL_SEAL
          ]);
          source._observedWords = words;
          destination._mappedData = words;
        },
        finish() { return { label: 'fake-successor-liveness-commands' }; }
      };
    },
    queue: {
      writeBuffer(buffer, offset, data) {
        buffer._writtenData = new data.constructor(data);
      },
      submit() {}
    }
  };
  return device;
}

function taggedBuffer(device, label, size, masses = null) {
  const buffer = tagWebGpuBufferDevice(device.createBuffer({
    label,
    size,
    usage: 128
  }), device);
  if (masses) buffer._masses = [...masses];
  return buffer;
}

async function successorFixture() {
  const particleCount = 3;
  const masses = [1, 1, 0];
  const device = createFakeDevice();
  const sourceStateBuffer = taggedBuffer(device, 'source-state', particleCount * 32, masses);
  const stateBuffer = taggedBuffer(device, 'successor-state', particleCount * 32, masses);
  const activeNodeBuffer = taggedBuffer(device, 'active-node', 4096);
  const directoryBuffer = taggedBuffer(device, 'directory', 4096);
  const sourceEpoch = {
    storageGeneration: 11,
    physicsTick: 17,
    physicsSubstep: 0,
    positionEpoch: 17,
    topologyEpoch: 7,
    chartEpoch: 2,
    levelEpoch: 17,
    supportEpoch: 17
  };
  const sourceParticleUploads = {
    sphParticleUpload: {
      stateBuffer: sourceStateBuffer,
      thermoBuffer: taggedBuffer(device, 'source-thermo', particleCount * 48),
      identityBuffer: taggedBuffer(device, 'source-identity', particleCount * 16)
    },
    mlsMpmParticleUpload: {
      mechanicsBuffer: taggedBuffer(device, 'source-mechanics', particleCount * 128)
    }
  };
  const generation = {
    selected: true,
    ready: true,
    releaseScheduled: false,
    directoryBuildCount: 1,
    privateLookupBuildCount: 0,
    source: {
      ready: true,
      sourceCount: particleCount,
      sourceStateBuffer,
      activeNodeBuffer,
      ...sourceEpoch
    },
    execution: {
      generationId: 19,
      buildOrdinal: 19,
      sortUniqueOrdinal: 19,
      submitPerformed: true,
      deviceId: webGpuDeviceId(device),
      sourceCount: particleCount,
      activeNodeBuffer,
      directoryBuffer,
      ...sourceEpoch,
      released: false
    }
  };
  const topologyTransitionReceipt =
    await runSchroederSpatialTopologyTransitionWebGpu({
      device,
      generation,
      sourceStateBuffer,
      successorStateBuffer: stateBuffer,
      successorParticleCount: particleCount
    });
  const successorEpoch = {
    storageGeneration: 12,
    physicsTick: 18,
    physicsSubstep: 0,
    positionEpoch: 18,
    topologyEpoch: 999,
    chartEpoch: 2,
    levelEpoch: 18,
    supportEpoch: 18
  };
  const buffers = {
    stateBuffer,
    thermoBuffer: taggedBuffer(device, 'successor-thermo', particleCount * 48),
    identityBuffer: taggedBuffer(device, 'successor-identity', particleCount * 16),
    mechanicsBuffer: taggedBuffer(device, 'successor-mechanics', particleCount * 128)
  };
  const nextParticleUploads = {
    sphParticleUpload: {
      status: 'webgpu-uploaded',
      stateBuffer: buffers.stateBuffer,
      thermoBuffer: buffers.thermoBuffer,
      identityBuffer: buffers.identityBuffer,
      particleCount,
      ...successorEpoch,
      stateStrideBytes: 32,
      thermoStrideBytes: 48,
      identityStrideBytes: 16
    },
    mlsMpmParticleUpload: {
      status: 'webgpu-uploaded',
      mechanicsBuffer: buffers.mechanicsBuffer,
      particleCount,
      ...successorEpoch,
      mechanicsStrideBytes: 128
    }
  };
  applySchroederSpatialTopologyTransitionReceipt(
    nextParticleUploads,
    topologyTransitionReceipt,
    { generation }
  );
  const transaction = createSchroederSpatialEpochTransaction({
    device,
    generation,
    ...sourceParticleUploads
  });
  const readerInputs = { generation, ...sourceParticleUploads };
  admitSchroederSpatialEpochTransactionReader(transaction, {
    readerId: SCHROEDER_SPATIAL_EPOCH_READER.MECHANICS_P2G,
    phase: SCHROEDER_SPATIAL_EPOCH_READER_PHASE.PRE_INTEGRATION,
    ...readerInputs
  });
  admitSchroederSpatialEpochTransactionReader(transaction, {
    readerId: SCHROEDER_SPATIAL_EPOCH_READER.MECHANICS_G2P,
    phase: SCHROEDER_SPATIAL_EPOCH_READER_PHASE.INTEGRATION_COMMIT,
    ...readerInputs
  });
  sealSchroederSpatialEpochTransactionReaders(transaction);
  sealSchroederSpatialEpochTransactionProposals(transaction);
  const commitReceipt = commitSchroederSpatialEpochTransaction(transaction, {
    nextParticleUploads
  });
  const sourceFamily = createSchroederSpatialSuccessorSourceFamily({
    transaction,
    commitReceipt,
    generation,
    nextParticleUploads,
    topologyTransitionReceipt,
    componentOwnerStages: {
      state: 'successor-liveness-test',
      thermo: 'successor-liveness-test',
      identity: 'successor-liveness-test',
      mechanics: 'successor-liveness-test'
    }
  });
  return {
    device,
    sourceFamily,
    buffers,
    particleCount,
    generation,
    topologyTransitionReceipt,
    sourceParticleUploads,
    nextParticleUploads
  };
}

function assertBorrowedBuffersSurvive(buffers) {
  for (const buffer of Object.values(buffers)) {
    assert.equal(buffer.destroyed, false);
    assert.equal(buffer.destroyCount, 0);
  }
}

function transactionForSuccessor(f, nextParticleUploads) {
  const transaction = createSchroederSpatialEpochTransaction({
    device: f.device,
    generation: f.generation,
    ...f.sourceParticleUploads
  });
  const readerInputs = { generation: f.generation, ...f.sourceParticleUploads };
  admitSchroederSpatialEpochTransactionReader(transaction, {
    readerId: SCHROEDER_SPATIAL_EPOCH_READER.MECHANICS_P2G,
    phase: SCHROEDER_SPATIAL_EPOCH_READER_PHASE.PRE_INTEGRATION,
    ...readerInputs
  });
  admitSchroederSpatialEpochTransactionReader(transaction, {
    readerId: SCHROEDER_SPATIAL_EPOCH_READER.MECHANICS_G2P,
    phase: SCHROEDER_SPATIAL_EPOCH_READER_PHASE.INTEGRATION_COMMIT,
    ...readerInputs
  });
  sealSchroederSpatialEpochTransactionReaders(transaction);
  sealSchroederSpatialEpochTransactionProposals(transaction);
  return {
    transaction,
    commit() {
      return commitSchroederSpatialEpochTransaction(transaction, {
        nextParticleUploads
      });
    }
  };
}

test('exact successor leases block retirement and release exactly once', async () => {
  const f = await successorFixture();
  assert.equal(Object.isFrozen(f.sourceFamily), true);
  assert.equal(f.sourceFamily.spatialQueryAuthority, false);
  for (const key of Object.keys(f.buffers)) {
    assert.equal(key in f.sourceFamily, false);
  }
  assert.deepEqual(
    schroederSpatialSuccessorSourceFamilyLiveness(f.sourceFamily, {
      device: f.device
    }),
    {
      schema: 'peercompute.ulg.schroeder-committed-successor-source-family-liveness.v1',
      status: 'schroeder-successor-source-family-active',
      active: true,
      retired: false,
      quarantined: false,
      deviceLost: false,
      reason: null,
      leaseCount: 0,
      retirementRequested: false,
      retirementFenceSettled: false,
      retirementBlocked: false,
      ownsBuffers: false,
      sourceGenerationId: 19,
      deviceId: webGpuDeviceId(f.device)
    }
  );
  assert.equal(
    resolveSchroederSpatialSuccessorSourceFamily(f.sourceFamily, {
      device: f.device,
      particleCount: f.particleCount,
      ...f.buffers
    }).sourceFamily,
    f.sourceFamily
  );

  const lease = acquireSchroederSpatialSuccessorSourceFamilyLease(
    f.sourceFamily,
    { device: f.device, consumerStage: 'exact-render-consumer' }
  );
  assert.equal(Object.isFrozen(lease), true);
  assert.equal(
    schroederSpatialSuccessorSourceFamilyLiveness(f.sourceFamily).leaseCount,
    1
  );
  assert.throws(
    () => retireSchroederSpatialSuccessorSourceFamily(f.sourceFamily, {
      device: f.device
    }),
    {
      code: 'ERR_SCHROEDER_SPATIAL_SUCCESSOR_SOURCE_FAMILY_ACTIVE_LEASES'
    }
  );
  assertBorrowedBuffersSurvive(f.buffers);

  const released = releaseSchroederSpatialSuccessorSourceFamilyLease(
    f.sourceFamily,
    lease,
    { device: f.device }
  );
  assert.equal(released.released, true);
  assert.equal(released.remainingLeaseCount, 0);
  assert.throws(
    () => releaseSchroederSpatialSuccessorSourceFamilyLease(
      f.sourceFamily,
      lease,
      { device: f.device }
    ),
    {
      code: 'ERR_SCHROEDER_SPATIAL_SUCCESSOR_SOURCE_FAMILY_LEASE_RELEASED'
    }
  );

  const retirement = retireSchroederSpatialSuccessorSourceFamily(
    f.sourceFamily,
    { device: f.device, reason: 'successor superseded' }
  );
  assert.equal(retirement.status, 'schroeder-successor-source-family-retired');
  assert.equal(retirement.active, false);
  assert.equal(retirement.retired, true);
  assert.equal(retirement.reason, 'successor superseded');
  assert.throws(
    () => resolveSchroederSpatialSuccessorSourceFamily(f.sourceFamily, {
      device: f.device,
      ...f.buffers
    }),
    { code: 'ERR_SCHROEDER_SPATIAL_SUCCESSOR_SOURCE_FAMILY_RETIRED' }
  );
  assert.throws(
    () => acquireSchroederSpatialSuccessorSourceFamilyLease(f.sourceFamily, {
      device: f.device,
      consumerStage: 'late-consumer'
    }),
    { code: 'ERR_SCHROEDER_SPATIAL_SUCCESSOR_SOURCE_FAMILY_RETIRED' }
  );
  assertBorrowedBuffersSurvive(f.buffers);
});

test('device loss quarantines the family without destroying borrowed buffers', async () => {
  const f = await successorFixture();
  const lease = acquireSchroederSpatialSuccessorSourceFamilyLease(
    f.sourceFamily,
    { device: f.device, consumerStage: 'in-flight-consumer' }
  );
  f.device.lose({ reason: 'destroyed', message: 'adapter removed during test' });
  await Promise.resolve();
  await Promise.resolve();

  const liveness = schroederSpatialSuccessorSourceFamilyLiveness(f.sourceFamily);
  assert.equal(
    liveness.status,
    'schroeder-successor-source-family-device-lost-quarantined'
  );
  assert.equal(liveness.active, false);
  assert.equal(liveness.retired, false);
  assert.equal(liveness.deviceLost, true);
  assert.equal(liveness.quarantined, true);
  assert.equal(liveness.reason, 'adapter removed during test');
  assert.equal(liveness.leaseCount, 1);
  assert.throws(
    () => resolveSchroederSpatialSuccessorSourceFamily(f.sourceFamily, {
      device: f.device,
      ...f.buffers
    }),
    { code: 'ERR_SCHROEDER_SPATIAL_SUCCESSOR_SOURCE_FAMILY_DEVICE_LOST' }
  );
  assert.throws(
    () => acquireSchroederSpatialSuccessorSourceFamilyLease(f.sourceFamily, {
      device: f.device,
      consumerStage: 'post-loss-consumer'
    }),
    { code: 'ERR_SCHROEDER_SPATIAL_SUCCESSOR_SOURCE_FAMILY_DEVICE_LOST' }
  );
  assertBorrowedBuffersSurvive(f.buffers);

  const released = releaseSchroederSpatialSuccessorSourceFamilyLease(
    f.sourceFamily,
    lease,
    { device: f.device }
  );
  assert.equal(released.remainingLeaseCount, 0);
  assert.equal(
    retireSchroederSpatialSuccessorSourceFamily(f.sourceFamily, {
      device: f.device
    }).status,
    'schroeder-successor-source-family-device-lost-quarantined'
  );
  assertBorrowedBuffersSurvive(f.buffers);
});

test('async retirement revokes immediately and settles only after owner and exact lease fences', async () => {
  const f = await successorFixture();
  const ownerFence = deferred();
  const consumerFence = deferred();
  const lease = acquireSchroederSpatialSuccessorSourceFamilyLease(
    f.sourceFamily,
    { device: f.device, consumerStage: 'resident-step-input' }
  );
  const retirement = retireSchroederSpatialSuccessorSourceFamilyAfterLeases(
    f.sourceFamily,
    {
      device: f.device,
      reason: 'ping-pong buffer family superseded',
      after: ownerFence.promise
    }
  );
  const requested = schroederSpatialSuccessorSourceFamilyLiveness(
    f.sourceFamily
  );
  assert.equal(requested.active, false);
  assert.equal(requested.retirementRequested, true);
  assert.equal(requested.retirementBlocked, true);
  assert.throws(
    () => acquireSchroederSpatialSuccessorSourceFamilyLease(f.sourceFamily, {
      device: f.device,
      consumerStage: 'late-resident-step'
    }),
    {
      code:
        'ERR_SCHROEDER_SPATIAL_SUCCESSOR_SOURCE_FAMILY_RETIREMENT_REQUESTED'
    }
  );
  assert.throws(
    () => resolveSchroederSpatialSuccessorSourceFamily(f.sourceFamily, {
      device: f.device,
      ...f.buffers
    }),
    {
      code:
        'ERR_SCHROEDER_SPATIAL_SUCCESSOR_SOURCE_FAMILY_RETIREMENT_REQUESTED'
    }
  );
  const leaseRelease = releaseSchroederSpatialSuccessorSourceFamilyLeaseAfter(
    f.sourceFamily,
    lease,
    { device: f.device, after: consumerFence.promise }
  );
  let retirementSettled = false;
  retirement.then(() => { retirementSettled = true; });
  ownerFence.resolve();
  await Promise.resolve();
  assert.equal(retirementSettled, false);
  assert.equal(
    schroederSpatialSuccessorSourceFamilyLiveness(f.sourceFamily)
      .retirementFenceSettled,
    true
  );
  consumerFence.resolve();
  const [releaseReceipt, retirementReceipt] = await Promise.all([
    leaseRelease,
    retirement
  ]);
  assert.equal(releaseReceipt.queueFenceSettled, true);
  assert.equal(releaseReceipt.remainingLeaseCount, 0);
  assert.equal(retirementReceipt.settled, true);
  assert.equal(retirementReceipt.retired, true);
  assert.equal(retirementReceipt.quarantined, false);
  assert.equal(
    schroederSpatialSuccessorSourceFamilyLiveness(f.sourceFamily).status,
    'schroeder-successor-source-family-retired'
  );
  assertBorrowedBuffersSurvive(f.buffers);
});

test('queue-fenced lease release and retirement fail closed without an exact fence', async () => {
  const f = await successorFixture();
  const lease = acquireSchroederSpatialSuccessorSourceFamilyLease(
    f.sourceFamily,
    { device: f.device, consumerStage: 'missing-fence-consumer' }
  );
  assert.throws(
    () => releaseSchroederSpatialSuccessorSourceFamilyLeaseAfter(
      f.sourceFamily,
      lease,
      { device: f.device }
    ),
    {
      code: 'ERR_SCHROEDER_SPATIAL_SUCCESSOR_SOURCE_FAMILY_LEASE_FENCE'
    }
  );
  assert.equal(
    releaseSchroederSpatialSuccessorSourceFamilyLease(
      f.sourceFamily,
      lease,
      { device: f.device }
    ).released,
    true
  );
  assert.throws(
    () => retireSchroederSpatialSuccessorSourceFamilyAfterLeases(
      f.sourceFamily,
      { device: f.device }
    ),
    {
      code: 'ERR_SCHROEDER_SPATIAL_SUCCESSOR_SOURCE_FAMILY_RETIREMENT_FENCE'
    }
  );
  assert.equal(
    schroederSpatialSuccessorSourceFamilyLiveness(f.sourceFamily).active,
    true
  );
  assertBorrowedBuffersSurvive(f.buffers);
});

test('precommit successor preparation allocates final identity and postcommit publication is total', async () => {
  const f = await successorFixture();
  const nextParticleUploads = {
    sphParticleUpload: { ...f.nextParticleUploads.sphParticleUpload },
    mlsMpmParticleUpload: { ...f.nextParticleUploads.mlsMpmParticleUpload }
  };
  applySchroederSpatialTopologyTransitionReceipt(
    nextParticleUploads,
    f.topologyTransitionReceipt,
    { generation: f.generation }
  );
  const tx = transactionForSuccessor(f, nextParticleUploads);
  const plan =
    await prepareSchroederSpatialSuccessorSourceFamilyPublication({
      transaction: tx.transaction,
      generation: f.generation,
      nextParticleUploads,
      topologyTransitionReceipt: f.topologyTransitionReceipt,
      forcePositionAdvance: true
    });
  assert.ok(
    nextParticleUploads.sphParticleUpload.storageGeneration
      > f.nextParticleUploads.sphParticleUpload.storageGeneration
  );
  assert.equal(
    nextParticleUploads.sphParticleUpload.bufferFamilyGeneration,
    nextParticleUploads.sphParticleUpload.storageGeneration
  );
  assert.equal(
    nextParticleUploads.sphParticleUpload.positionEpoch,
    f.generation.execution.positionEpoch + 1
  );
  assert.equal(
    nextParticleUploads.schroederSpatialSuccessorSourceFamily,
    null
  );
  const commitReceipt = tx.commit();
  const receipt = publishPreparedSchroederSpatialSuccessorSourceFamily(
    plan,
    { commitReceipt }
  );
  assert.equal(receipt.published, true);
  assert.equal(
    validateSchroederSpatialSuccessorPublicationReceipt(receipt, {
      plan,
      commitReceipt,
      nextParticleUploads
    }),
    true
  );
  assert.equal(
    validateSchroederSpatialSuccessorPublicationReceipt(
      Object.freeze({ ...receipt }),
      { plan, commitReceipt, nextParticleUploads }
    ),
    false,
    'a field-identical but foreign receipt must not authenticate publication'
  );
  assert.equal(
    validateSchroederSpatialSuccessorPublicationReceipt(receipt, {
      plan: Object.freeze({ ...plan }),
      commitReceipt,
      nextParticleUploads
    }),
    false,
    'the receipt must remain bound to the exact prepared plan'
  );
  assert.equal(
    validateSchroederSpatialSuccessorPublicationReceipt(receipt, {
      plan,
      commitReceipt: Object.freeze({ ...commitReceipt }),
      nextParticleUploads
    }),
    false,
    'the receipt must remain bound to the exact commit receipt'
  );
  assert.equal(
    validateSchroederSpatialSuccessorPublicationReceipt(receipt, {
      plan,
      commitReceipt,
      nextParticleUploads: { ...nextParticleUploads }
    }),
    false,
    'the receipt must remain bound to the exact reserved upload envelope'
  );
  assert.equal(
    nextParticleUploads.schroederSpatialSuccessorSourceFamily,
    receipt.sourceFamily
  );
  assert.equal(
    receipt.sourceFamily.storageGeneration,
    nextParticleUploads.sphParticleUpload.storageGeneration
  );
  const replay = publishPreparedSchroederSpatialSuccessorSourceFamily(
    plan,
    { commitReceipt: Object.freeze({ forged: true }) }
  );
  assert.equal(replay.published, false);
  assert.match(replay.reason, /already consumed|invalid|foreign/);

  const first = allocateSchroederSpatialSuccessorBufferFamilyIdentity({
    device: f.device,
    afterStorageGeneration: receipt.sourceFamily.storageGeneration,
    purpose: 'test-monotonic-identity-a'
  });
  const second = allocateSchroederSpatialSuccessorBufferFamilyIdentity({
    device: f.device,
    afterStorageGeneration: 1,
    purpose: 'test-monotonic-identity-b'
  });
  assert.equal(second.storageGeneration, first.storageGeneration + 1);
  assert.throws(
    () => allocateSchroederSpatialSuccessorBufferFamilyIdentity({
      device: f.device,
      afterStorageGeneration: 0xffff_ffff,
      purpose: 'must-never-wrap'
    }),
    {
      code:
        'ERR_SCHROEDER_SPATIAL_SUCCESSOR_SOURCE_FAMILY_IDENTITY_EXHAUSTED'
    }
  );
});

test('device loss terminally settles an async retirement request with outstanding leases', async () => {
  const f = await successorFixture();
  const never = deferred();
  acquireSchroederSpatialSuccessorSourceFamilyLease(
    f.sourceFamily,
    { device: f.device, consumerStage: 'lost-device-consumer' }
  );
  const retirement = retireSchroederSpatialSuccessorSourceFamilyAfterLeases(
    f.sourceFamily,
    { device: f.device, after: never.promise }
  );
  f.device.lose({ message: 'device removed before consumer fence' });
  const receipt = await retirement;
  assert.equal(receipt.settled, true);
  assert.equal(receipt.retired, false);
  assert.equal(receipt.quarantined, true);
  assert.equal(receipt.remainingLeaseCount, 1);
  assertBorrowedBuffersSurvive(f.buffers);
});

test('resident successor preflight conservatively advances topology and position without host observation', async () => {
  const f = await successorFixture();
  const nextParticleUploads = {
    sphParticleUpload: { ...f.nextParticleUploads.sphParticleUpload },
    mlsMpmParticleUpload: { ...f.nextParticleUploads.mlsMpmParticleUpload }
  };
  const tx = transactionForSuccessor(f, nextParticleUploads);
  const plan =
    await prepareSchroederSpatialSuccessorSourceFamilyPublication({
      transaction: tx.transaction,
      generation: f.generation,
      nextParticleUploads,
      conservativeTopologyAdvance: true
    });
  assert.equal(
    nextParticleUploads.sphParticleUpload.topologyEpoch,
    f.generation.execution.topologyEpoch + 1
  );
  assert.equal(
    nextParticleUploads.sphParticleUpload.positionEpoch,
    f.generation.execution.positionEpoch + 1
  );
  const published = publishPreparedSchroederSpatialSuccessorSourceFamily(
    plan,
    { commitReceipt: tx.commit() }
  );
  assert.equal(published.published, true);
  assert.equal(
    published.sourceFamily.topologyTransitionMode,
    'gpu-resident-conservative-topology-advance'
  );
  assert.equal(published.sourceFamily.fullParticleReadbackPerformed, false);
});

test('successor preflight rejects every cross-component buffer alias before commit', async () => {
  const f = await successorFixture();
  const nextParticleUploads = {
    sphParticleUpload: {
      ...f.nextParticleUploads.sphParticleUpload,
      identityBuffer: f.nextParticleUploads.sphParticleUpload.stateBuffer
    },
    mlsMpmParticleUpload: { ...f.nextParticleUploads.mlsMpmParticleUpload }
  };
  const tx = transactionForSuccessor(f, nextParticleUploads);
  await assert.rejects(
    prepareSchroederSpatialSuccessorSourceFamilyPublication({
      transaction: tx.transaction,
      generation: f.generation,
      nextParticleUploads,
      conservativeTopologyAdvance: true
    }),
    {
      code: 'ERR_SCHROEDER_SPATIAL_SUCCESSOR_SOURCE_FAMILY_BUFFER_ALIAS'
    }
  );
  assert.equal(tx.transaction.state, 'proposals-sealed');
});

test('rejected owner retirement fence keeps authority revoked and accepts a replacement fence', async () => {
  const f = await successorFixture();
  const rejectedFence = deferred();
  const firstAttempt = retireSchroederSpatialSuccessorSourceFamilyAfterLeases(
    f.sourceFamily,
    { device: f.device, after: rejectedFence.promise }
  );
  rejectedFence.reject(new Error('transient queue acknowledgement failure'));
  const rejected = await firstAttempt;
  assert.equal(rejected.settled, false);
  assert.equal(rejected.retired, false);
  assert.match(rejected.reason, /transient queue acknowledgement failure/);
  assert.equal(
    schroederSpatialSuccessorSourceFamilyLiveness(f.sourceFamily).active,
    false
  );
  assert.throws(
    () => acquireSchroederSpatialSuccessorSourceFamilyLease(f.sourceFamily, {
      device: f.device,
      consumerStage: 'must-remain-revoked-between-retries'
    }),
    {
      code:
        'ERR_SCHROEDER_SPATIAL_SUCCESSOR_SOURCE_FAMILY_RETIREMENT_REQUESTED'
    }
  );
  const replacementFence = deferred();
  const retry = retireSchroederSpatialSuccessorSourceFamilyAfterLeases(
    f.sourceFamily,
    { device: f.device, after: replacementFence.promise }
  );
  assert.notEqual(retry, firstAttempt);
  replacementFence.resolve();
  const retired = await retry;
  assert.equal(retired.settled, true);
  assert.equal(retired.retired, true);
  assertBorrowedBuffersSurvive(f.buffers);
});

test('lease and liveness operations reject foreign devices and forged tokens', async () => {
  const f = await successorFixture();
  const foreignDevice = createFakeDevice();
  assert.throws(
    () => schroederSpatialSuccessorSourceFamilyLiveness(f.sourceFamily, {
      device: foreignDevice
    }),
    { code: 'ERR_SCHROEDER_SPATIAL_SUCCESSOR_SOURCE_FAMILY_IDENTITY' }
  );
  assert.throws(
    () => acquireSchroederSpatialSuccessorSourceFamilyLease(f.sourceFamily, {
      device: foreignDevice,
      consumerStage: 'foreign-consumer'
    }),
    { code: 'ERR_SCHROEDER_SPATIAL_SUCCESSOR_SOURCE_FAMILY_IDENTITY' }
  );

  const lease = acquireSchroederSpatialSuccessorSourceFamilyLease(
    f.sourceFamily,
    { device: f.device, consumerStage: 'exact-consumer' }
  );
  assert.throws(
    () => releaseSchroederSpatialSuccessorSourceFamilyLease(
      f.sourceFamily,
      lease,
      { device: foreignDevice }
    ),
    { code: 'ERR_SCHROEDER_SPATIAL_SUCCESSOR_SOURCE_FAMILY_IDENTITY' }
  );
  assert.throws(
    () => releaseSchroederSpatialSuccessorSourceFamilyLease(
      f.sourceFamily,
      Object.freeze({ ...lease }),
      { device: f.device }
    ),
    { code: 'ERR_SCHROEDER_SPATIAL_SUCCESSOR_SOURCE_FAMILY_LEASE_IDENTITY' }
  );
  assert.equal(
    schroederSpatialSuccessorSourceFamilyLiveness(f.sourceFamily).leaseCount,
    1
  );
  releaseSchroederSpatialSuccessorSourceFamilyLease(
    f.sourceFamily,
    lease,
    { device: f.device }
  );
  assert.equal(
    schroederSpatialSuccessorSourceFamilyLiveness(f.sourceFamily).leaseCount,
    0
  );
});
