import test from 'node:test';
import assert from 'node:assert/strict';

import {
  SCHROEDER_SPATIAL_TOPOLOGY_TRANSITION_BYTES,
  SCHROEDER_SPATIAL_TOPOLOGY_TRANSITION_FINAL_SEAL,
  SCHROEDER_SPATIAL_TOPOLOGY_TRANSITION_MAGIC,
  SCHROEDER_SPATIAL_TOPOLOGY_TRANSITION_STATUS,
  SCHROEDER_SPATIAL_TOPOLOGY_TRANSITION_VERSION
} from '../ulg-gpu-abi/src/schroederSpatialTopologyTransition.js';
import {
  schroederSpatialTopologyTransitionWgsl
} from '../ulg-gpu-abi/src/schroederSpatialTopologyTransitionWgsl.js';
import {
  applySchroederSpatialTopologyTransitionReceipt,
  isFinalizedSchroederSpatialTopologyTransitionReceipt,
  runSchroederSpatialTopologyTransitionWebGpu,
  validateSchroederSpatialTopologyTransitionReceipt
} from '../src/runtime/sph/schroederSpatialTopologyTransitionGpu.js';
import {
  createSchroederSpatialSuccessorSourceFamily,
  isFinalizedSchroederSpatialSuccessorSourceFamily,
  resolveSchroederSpatialSuccessorSourceFamily
} from '../src/runtime/sph/schroederSpatialSuccessorSourceFamily.js';
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
  scheduleSchroederSpatialEpochTransactionRelease,
  sealSchroederSpatialEpochTransactionProposals,
  sealSchroederSpatialEpochTransactionReaders,
  validateSchroederSpatialEpochTransactionCommit
} from '../src/runtime/sph/schroederSpatialEpochTransaction.js';

function activeMass(value) {
  return Number.isFinite(value) && value > 0;
}

function createFakeDevice({ mutateReceipt = null } = {}) {
  const submissions = [];
  const dispatches = [];
  const buffers = [];
  const device = {
    submissions,
    dispatches,
    buffers,
    limits: { maxComputeWorkgroupsPerDimension: 65535 },
    createBuffer(descriptor) {
      const buffer = {
        ...descriptor,
        destroyed: false,
        destroy() { this.destroyed = true; },
        async mapAsync() {},
        getMappedRange() {
          return this._mappedData?.buffer
            ?? new ArrayBuffer(descriptor.size);
        },
        unmap() { this.unmapped = true; }
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
          let pipeline = null;
          return {
            setPipeline(value) { pipeline = value; },
            setBindGroup(index, value) { boundGroup = value; },
            dispatchWorkgroups(x, y = 1, z = 1) {
              dispatches.push({
                entryPoint: pipeline?.descriptor?.compute?.entryPoint,
                workgroups: [x, y, z]
              });
            },
            end() {}
          };
        },
        copyBufferToBuffer(source, sourceOffset, destination) {
          const entries = Object.fromEntries(
            boundGroup.entries.map((entry) => [entry.binding, entry.resource.buffer])
          );
          const params = entries[2]._writtenData;
          const [
            sourceCount,
            successorCount,
            generationId,
            nonce,
            sourceEpoch,
            forceAdvance
          ] = params;
          const sourceMasses = entries[0]._masses;
          const successorMasses = entries[1]._masses;
          const comparisonCount = Math.max(sourceCount, successorCount);
          let sourceActiveCount = 0;
          let successorActiveCount = 0;
          let activatedCount = 0;
          let deactivatedCount = 0;
          let invalidSourceMassCount = 0;
          let invalidSuccessorMassCount = 0;
          for (let index = 0; index < comparisonCount; index += 1) {
            const sourcePresent = index < sourceCount;
            const successorPresent = index < successorCount;
            const sourceMass = sourcePresent ? sourceMasses[index] : 0;
            const successorMass = successorPresent ? successorMasses[index] : 0;
            if (sourcePresent && (!Number.isFinite(sourceMass) || sourceMass < 0)) {
              invalidSourceMassCount += 1;
            }
            if (successorPresent && (!Number.isFinite(successorMass) || successorMass < 0)) {
              invalidSuccessorMassCount += 1;
            }
            const sourceActive = activeMass(sourceMass);
            const successorActive = activeMass(successorMass);
            if (sourceActive) sourceActiveCount += 1;
            if (successorActive) successorActiveCount += 1;
            if (sourceActive !== successorActive) {
              if (successorActive) activatedCount += 1;
              else deactivatedCount += 1;
            }
          }
          const xorCount = activatedCount + deactivatedCount;
          const changed = xorCount > 0 || forceAdvance === 1;
          let status = SCHROEDER_SPATIAL_TOPOLOGY_TRANSITION_STATUS.COMPLETE;
          if (invalidSourceMassCount > 0 || invalidSuccessorMassCount > 0) {
            status = SCHROEDER_SPATIAL_TOPOLOGY_TRANSITION_STATUS.INVALID_MASS;
          } else if (changed && sourceEpoch === 0xffff_ffff) {
            status = SCHROEDER_SPATIAL_TOPOLOGY_TRANSITION_STATUS.EPOCH_EXHAUSTED;
          }
          const nextEpoch = status
            === SCHROEDER_SPATIAL_TOPOLOGY_TRANSITION_STATUS.COMPLETE && changed
              ? sourceEpoch + 1
              : sourceEpoch;
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
            invalidSourceMassCount,
            invalidSuccessorMassCount,
            forceAdvance,
            1,
            changed ? 1 : 0,
            nextEpoch,
            status,
            0,
            status === SCHROEDER_SPATIAL_TOPOLOGY_TRANSITION_STATUS.COMPLETE
              ? SCHROEDER_SPATIAL_TOPOLOGY_TRANSITION_FINAL_SEAL
              : 0
          ]);
          mutateReceipt?.(words);
          source._observedWords = words;
          destination._mappedData = words;
        },
        finish() { return { label: 'fake-topology-transition-commands' }; }
      };
    },
    queue: {
      writeBuffer(buffer, offset, data) {
        buffer._writtenData = new data.constructor(data);
      },
      submit(commands) { submissions.push(commands); }
    }
  };
  return device;
}

function stateBuffer(device, masses, label) {
  const buffer = tagWebGpuBufferDevice(device.createBuffer({
    label,
    size: masses.length * 8 * Float32Array.BYTES_PER_ELEMENT,
    usage: 128
  }), device);
  buffer._masses = [...masses];
  return buffer;
}

function fixture({
  sourceMasses = [1, 1, 0],
  successorMasses = sourceMasses,
  topologyEpoch = 7,
  mutateReceipt = null
} = {}) {
  const device = createFakeDevice({ mutateReceipt });
  const sourceStateBuffer = stateBuffer(device, sourceMasses, 'source-state');
  const successorStateBuffer = stateBuffer(
    device,
    successorMasses,
    'successor-state'
  );
  const taggedBuffer = (label, size = 4096) => tagWebGpuBufferDevice(
    device.createBuffer({ label, size, usage: 128 }),
    device
  );
  const activeNodeBuffer = taggedBuffer('canonical-active-node');
  const directoryBuffer = taggedBuffer('canonical-directory');
  const sourceParticleUploads = {
    sphParticleUpload: {
      stateBuffer: sourceStateBuffer,
      thermoBuffer: taggedBuffer('source-thermo'),
      identityBuffer: taggedBuffer('source-identity')
    },
    mlsMpmParticleUpload: {
      mechanicsBuffer: taggedBuffer('source-mechanics')
    }
  };
  const epochIdentity = {
    storageGeneration: 11,
    physicsTick: 17,
    physicsSubstep: 0,
    positionEpoch: 17,
    topologyEpoch,
    chartEpoch: 2,
    levelEpoch: 17,
    supportEpoch: 17
  };
  const generation = {
    selected: true,
    ready: true,
    releaseScheduled: false,
    directoryBuildCount: 1,
    privateLookupBuildCount: 0,
    source: {
      ready: true,
      sourceCount: sourceMasses.length,
      sourceStateBuffer,
      activeNodeBuffer,
      ...epochIdentity
    },
    execution: {
      generationId: 19,
      buildOrdinal: 19,
      sortUniqueOrdinal: 19,
      submitPerformed: true,
      deviceId: webGpuDeviceId(device),
      sourceCount: sourceMasses.length,
      activeNodeBuffer,
      directoryBuffer,
      ...epochIdentity,
      released: false
    }
  };
  return {
    device,
    generation,
    sourceParticleUploads,
    sourceStateBuffer,
    successorStateBuffer
  };
}

test('topology transition preserves an unchanged active mask and stamps both uploads', async () => {
  const f = fixture();
  const receipt = await runSchroederSpatialTopologyTransitionWebGpu({
    ...f,
    successorParticleCount: 3
  });
  assert.equal(receipt.topologyChanged, false);
  assert.equal(receipt.nextTopologyEpoch, 7);
  assert.equal(receipt.sourceActiveCount, 2);
  assert.equal(receipt.successorActiveCount, 2);
  assert.equal(receipt.activeMaskXorCount, 0);
  assert.equal(receipt.compactReadbackByteLength, 96);
  assert.equal(receipt.fullParticleReadbackPerformed, false);
  assert.equal(isFinalizedSchroederSpatialTopologyTransitionReceipt(receipt), true);
  const uploads = {
    sphParticleUpload: {
      stateBuffer: f.successorStateBuffer,
      particleCount: 3,
      topologyEpoch: 999
    },
    mlsMpmParticleUpload: { particleCount: 3, topologyEpoch: 999 }
  };
  assert.equal(
    applySchroederSpatialTopologyTransitionReceipt(
      uploads,
      receipt,
      { generation: f.generation }
    ),
    uploads
  );
  assert.equal(uploads.sphParticleUpload.topologyEpoch, 7);
  assert.equal(uploads.mlsMpmParticleUpload.topologyEpoch, 7);
  assert.equal(uploads.schroederSpatialTopologyTransitionReceipt, receipt);
});

test('equal active counts with different slots advance topology exactly once', async () => {
  const f = fixture({
    sourceMasses: [1, 0, 1],
    successorMasses: [0, 1, 1]
  });
  const receipt = await runSchroederSpatialTopologyTransitionWebGpu({
    ...f,
    successorParticleCount: 3
  });
  assert.equal(receipt.sourceActiveCount, 2);
  assert.equal(receipt.successorActiveCount, 2);
  assert.equal(receipt.activatedCount, 1);
  assert.equal(receipt.deactivatedCount, 1);
  assert.equal(receipt.activeMaskXorCount, 2);
  assert.equal(receipt.nextTopologyEpoch, 8);
});

test('final continuation publishes an authenticated non-query source family', async () => {
  const f = fixture();
  const receipt = await runSchroederSpatialTopologyTransitionWebGpu({
    ...f,
    successorParticleCount: 3
  });
  const taggedBuffer = (label, size) => tagWebGpuBufferDevice(
    f.device.createBuffer({ label, size, usage: 128 }),
    f.device
  );
  const thermoBuffer = taggedBuffer('successor-thermo', 3 * 48);
  const identityBuffer = taggedBuffer('successor-identity', 3 * 16);
  const mechanicsBuffer = taggedBuffer('successor-mechanics', 3 * 128);
  const uploads = {
    sphParticleUpload: {
      status: 'webgpu-uploaded',
      stateBuffer: f.successorStateBuffer,
      thermoBuffer,
      identityBuffer,
      particleCount: 3,
      storageGeneration: 12,
      physicsTick: 18,
      physicsSubstep: 0,
      positionEpoch: 18,
      topologyEpoch: 999,
      chartEpoch: 2,
      levelEpoch: 18,
      supportEpoch: 18,
      stateStrideBytes: 32,
      thermoStrideBytes: 48,
      identityStrideBytes: 16
    },
    mlsMpmParticleUpload: {
      status: 'webgpu-uploaded',
      mechanicsBuffer,
      particleCount: 3,
      storageGeneration: 12,
      physicsTick: 18,
      physicsSubstep: 0,
      positionEpoch: 18,
      topologyEpoch: 999,
      chartEpoch: 2,
      levelEpoch: 18,
      supportEpoch: 18,
      mechanicsStrideBytes: 128
    }
  };
  applySchroederSpatialTopologyTransitionReceipt(
    uploads,
    receipt,
    { generation: f.generation }
  );
  const transaction = createSchroederSpatialEpochTransaction({
    device: f.device,
    generation: f.generation,
    ...f.sourceParticleUploads
  });
  const readerInputs = {
    generation: f.generation,
    ...f.sourceParticleUploads
  };
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
    nextParticleUploads: uploads
  });
  const sourceFamily = createSchroederSpatialSuccessorSourceFamily({
    transaction,
    commitReceipt,
    generation: f.generation,
    nextParticleUploads: uploads,
    topologyTransitionReceipt: receipt,
    componentOwnerStages: {
      state: 'test-final-continuation',
      thermo: 'test-final-continuation',
      identity: 'test-final-continuation',
      mechanics: 'test-final-continuation'
    }
  });
  assert.equal(sourceFamily.positionAuthority, 'same-epoch-final-continuation-particle-state');
  assert.equal(sourceFamily.spatialQueryAuthority, false);
  assert.equal(sourceFamily.spatialDirectoryReady, false);
  assert.equal(sourceFamily.ancestorSpatialGenerationId, 19);
  assert.equal(sourceFamily.topologyEpoch, 7);
  assert.equal(sourceFamily.ownsBuffers, false);
  assert.equal(Object.isFrozen(sourceFamily), true);
  assert.equal(Object.isFrozen(sourceFamily.sourceEpochIdentity), true);
  assert.equal(Object.isFrozen(sourceFamily.successorEpochIdentity), true);
  assert.equal(Object.isFrozen(sourceFamily.componentOwnerStages), true);
  for (const bufferField of [
    'stateBuffer',
    'thermoBuffer',
    'identityBuffer',
    'mechanicsBuffer'
  ]) {
    assert.equal(bufferField in sourceFamily, false);
  }
  const forbiddenPublicAuthorities = new Map([
    [f.device, 'device'],
    [transaction, 'transaction'],
    [commitReceipt, 'commit receipt'],
    [f.generation, 'generation'],
    [receipt, 'topology receipt'],
    [uploads, 'next uploads'],
    [uploads.sphParticleUpload, 'next SPH upload'],
    [uploads.mlsMpmParticleUpload, 'next MLS-MPM upload'],
    [f.sourceParticleUploads, 'source uploads'],
    [f.sourceParticleUploads.sphParticleUpload, 'source SPH upload'],
    [f.sourceParticleUploads.mlsMpmParticleUpload, 'source MLS-MPM upload'],
    [f.sourceStateBuffer, 'source state buffer'],
    [f.sourceParticleUploads.sphParticleUpload.thermoBuffer, 'source thermo buffer'],
    [f.sourceParticleUploads.sphParticleUpload.identityBuffer, 'source identity buffer'],
    [f.sourceParticleUploads.mlsMpmParticleUpload.mechanicsBuffer, 'source mechanics buffer'],
    [f.successorStateBuffer, 'successor state buffer'],
    [thermoBuffer, 'successor thermo buffer'],
    [identityBuffer, 'successor identity buffer'],
    [mechanicsBuffer, 'successor mechanics buffer'],
    [f.generation.source.activeNodeBuffer, 'active-node buffer'],
    [f.generation.execution.directoryBuffer, 'directory buffer']
  ]);
  const visitedPublicValues = new Set();
  const visitPublicValue = (value, path = 'sourceFamily') => {
    if (value == null || (typeof value !== 'object' && typeof value !== 'function')) {
      return;
    }
    assert.equal(
      forbiddenPublicAuthorities.has(value),
      false,
      `${path} leaked ${forbiddenPublicAuthorities.get(value)}`
    );
    if (visitedPublicValues.has(value)) return;
    visitedPublicValues.add(value);
    for (const key of Reflect.ownKeys(value)) {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (descriptor && 'value' in descriptor) {
        visitPublicValue(descriptor.value, `${path}.${String(key)}`);
      }
    }
  };
  visitPublicValue(sourceFamily);
  assert.equal(uploads.schroederSpatialSuccessorSourceFamily, sourceFamily);
  assert.equal(isFinalizedSchroederSpatialSuccessorSourceFamily(sourceFamily), true);
  const resolved = resolveSchroederSpatialSuccessorSourceFamily(sourceFamily, {
    device: f.device,
    particleCount: 3,
    stateBuffer: f.successorStateBuffer,
    thermoBuffer,
    identityBuffer,
    mechanicsBuffer
  });
  assert.equal(resolved.admitted, true);
  assert.equal(resolved.sourceFamilyRole, 'committed-successor-x-n-plus-1');
  assert.equal(resolved.epochIdentity, sourceFamily.successorEpochIdentity);
  const exactBuffers = {
    stateBuffer: f.successorStateBuffer,
    thermoBuffer,
    identityBuffer,
    mechanicsBuffer
  };
  for (const bufferField of Object.keys(exactBuffers)) {
    const swappedBuffers = {
      ...exactBuffers,
      [bufferField]: taggedBuffer(`wrong-${bufferField}`, exactBuffers[bufferField].size)
    };
    assert.throws(
      () => resolveSchroederSpatialSuccessorSourceFamily(sourceFamily, {
        device: f.device,
        particleCount: 3,
        ...swappedBuffers
      }),
      { code: 'ERR_SCHROEDER_SPATIAL_SUCCESSOR_SOURCE_FAMILY_IDENTITY' },
      `${bufferField} swap must fail closed`
    );
  }
  const frozenSourceFamilyCopy = Object.freeze({ ...sourceFamily });
  assert.equal(
    isFinalizedSchroederSpatialSuccessorSourceFamily(frozenSourceFamilyCopy),
    false
  );
  assert.throws(
    () => resolveSchroederSpatialSuccessorSourceFamily(
      frozenSourceFamilyCopy,
      {
        device: f.device,
        particleCount: 3,
        ...exactBuffers
      }
    ),
    { code: 'ERR_SCHROEDER_SPATIAL_SUCCESSOR_SOURCE_FAMILY_IDENTITY' }
  );
  const clonedSourceFamily = structuredClone(sourceFamily);
  assert.deepEqual(clonedSourceFamily, sourceFamily);
  assert.equal(
    isFinalizedSchroederSpatialSuccessorSourceFamily(clonedSourceFamily),
    false
  );
  assert.throws(
    () => resolveSchroederSpatialSuccessorSourceFamily(
      clonedSourceFamily,
      {
        device: f.device,
        particleCount: 3,
        ...exactBuffers
      }
    ),
    { code: 'ERR_SCHROEDER_SPATIAL_SUCCESSOR_SOURCE_FAMILY_IDENTITY' }
  );
  assert.equal(await scheduleSchroederSpatialEpochTransactionRelease(transaction, {
    after: Promise.resolve(true)
  }), true);
  assert.equal(
    validateSchroederSpatialEpochTransactionCommit(
      transaction,
      commitReceipt,
      {
        nextParticleUploads: uploads,
        expectedGeneration: f.generation
      }
    ),
    true
  );
  assert.equal(
    resolveSchroederSpatialSuccessorSourceFamily(sourceFamily, {
      device: f.device,
      particleCount: 3,
      ...exactBuffers
    }).sourceFamily,
    sourceFamily
  );
  assert.throws(
    () => createSchroederSpatialSuccessorSourceFamily({
      transaction,
      commitReceipt: { ...commitReceipt },
      generation: f.generation,
      nextParticleUploads: uploads,
      topologyTransitionReceipt: receipt
    }),
    { code: 'ERR_SCHROEDER_SPATIAL_SUCCESSOR_SOURCE_FAMILY_IDENTITY' }
  );
  const copiedTopologyReceipt = Object.freeze({ ...receipt });
  uploads.schroederSpatialTopologyTransitionReceipt = copiedTopologyReceipt;
  assert.equal(
    validateSchroederSpatialTopologyTransitionReceipt(
      copiedTopologyReceipt,
      {
        generation: f.generation,
        nextParticleUploads: uploads
      }
    ),
    false
  );
  assert.throws(
    () => createSchroederSpatialSuccessorSourceFamily({
      transaction,
      commitReceipt,
      generation: f.generation,
      nextParticleUploads: uploads,
      topologyTransitionReceipt: copiedTopologyReceipt
    }),
    { code: 'ERR_SCHROEDER_SPATIAL_SUCCESSOR_SOURCE_FAMILY_IDENTITY' }
  );
  uploads.schroederSpatialTopologyTransitionReceipt = receipt;
  assert.equal(
    validateSchroederSpatialTopologyTransitionReceipt(
      receipt,
      {
        generation: f.generation,
        nextParticleUploads: uploads
      }
    ),
    true
  );
  assert.throws(
    () => createSchroederSpatialSuccessorSourceFamily({
      transaction,
      commitReceipt,
      generation: f.generation,
      nextParticleUploads: uploads,
      topologyTransitionReceipt: receipt
    }),
    {
      code:
        'ERR_SCHROEDER_SPATIAL_SUCCESSOR_SOURCE_FAMILY_DUPLICATE_PUBLICATION'
    }
  );
});

test('storage forcing and an unequal-count mask change coalesce into one epoch', async () => {
  const f = fixture({
    sourceMasses: [1, 0],
    successorMasses: [1, 0, 1]
  });
  const receipt = await runSchroederSpatialTopologyTransitionWebGpu({
    ...f,
    successorParticleCount: 3,
    forceTopologyAdvance: true
  });
  assert.equal(receipt.forceTopologyAdvance, true);
  assert.equal(receipt.activatedCount, 1);
  assert.equal(receipt.nextTopologyEpoch, 8);
  assert.equal(receipt.topologyChanged, true);
});

test('odd workgroup boundaries visit every compared particle exactly once', async () => {
  const f = fixture({
    sourceMasses: Array.from({ length: 65 }, () => 1),
    successorMasses: Array.from({ length: 65 }, () => 1)
  });
  const receipt = await runSchroederSpatialTopologyTransitionWebGpu({
    ...f,
    successorParticleCount: 65
  });
  assert.equal(receipt.visitedCount, 65);
  assert.deepEqual(
    f.device.dispatches.map(({ workgroups }) => workgroups),
    [[2, 1, 1], [1, 1, 1]]
  );
});

test('invalid masses and exhausted changed epochs fail closed', async () => {
  const invalid = fixture({ successorMasses: [1, -1, 0] });
  await assert.rejects(
    runSchroederSpatialTopologyTransitionWebGpu({
      ...invalid,
      successorParticleCount: 3
    }),
    { code: 'ERR_SCHROEDER_SPATIAL_TOPOLOGY_TRANSITION_OBSERVATION' }
  );

  const exhausted = fixture({
    sourceMasses: [1, 0],
    successorMasses: [0, 1],
    topologyEpoch: 0xffff_ffff
  });
  await assert.rejects(
    runSchroederSpatialTopologyTransitionWebGpu({
      ...exhausted,
      successorParticleCount: 2
    }),
    { code: 'ERR_SCHROEDER_SPATIAL_TOPOLOGY_TRANSITION_EPOCH_EXHAUSTED' }
  );
});

test('receipt corruption, copied receipts, swapped buffers, and untagged sources are rejected', async () => {
  const corrupt = fixture({ mutateReceipt(words) { words[14] += 1; } });
  await assert.rejects(
    runSchroederSpatialTopologyTransitionWebGpu({
      ...corrupt,
      successorParticleCount: 3
    }),
    { code: 'ERR_SCHROEDER_SPATIAL_TOPOLOGY_TRANSITION_OBSERVATION' }
  );

  const f = fixture();
  const receipt = await runSchroederSpatialTopologyTransitionWebGpu({
    ...f,
    successorParticleCount: 3
  });
  assert.equal(
    isFinalizedSchroederSpatialTopologyTransitionReceipt({ ...receipt }),
    false
  );
  assert.throws(
    () => applySchroederSpatialTopologyTransitionReceipt({
      sphParticleUpload: {
        stateBuffer: f.sourceStateBuffer,
        particleCount: 3
      },
      mlsMpmParticleUpload: { particleCount: 3 }
    }, receipt, { generation: f.generation }),
    { code: 'ERR_SCHROEDER_SPATIAL_TOPOLOGY_TRANSITION_SUCCESSOR_IDENTITY' }
  );

  const untagged = { ...f.generation, source: { ...f.generation.source } };
  untagged.source.sourceStateBuffer = {
    size: 3 * 8 * Float32Array.BYTES_PER_ELEMENT
  };
  await assert.rejects(
    runSchroederSpatialTopologyTransitionWebGpu({
      device: f.device,
      generation: untagged,
      sourceStateBuffer: untagged.source.sourceStateBuffer,
      sourceParticleCount: 3,
      successorStateBuffer: f.successorStateBuffer,
      successorParticleCount: 3,
      sourceTopologyEpoch: 7
    }),
    { code: 'ERR_SCHROEDER_SPATIAL_TOPOLOGY_TRANSITION_DEVICE_MISMATCH' }
  );
});

test('topology ABI and WGSL expose the parallel compare plus final seal contract', () => {
  assert.equal(SCHROEDER_SPATIAL_TOPOLOGY_TRANSITION_BYTES, 96);
  assert.match(schroederSpatialTopologyTransitionWgsl, /@compute @workgroup_size\(64\)/);
  assert.match(schroederSpatialTopologyTransitionWgsl, /fn compare_topology/);
  assert.match(schroederSpatialTopologyTransitionWgsl, /fn seal_topology/);
  assert.match(schroederSpatialTopologyTransitionWgsl, /source_active != successor_active/);
  assert.match(schroederSpatialTopologyTransitionWgsl, /params\.force_topology_advance/);
  assert.match(schroederSpatialTopologyTransitionWgsl, /atomicStore\(\s*&receipt\[23\]/);
});
