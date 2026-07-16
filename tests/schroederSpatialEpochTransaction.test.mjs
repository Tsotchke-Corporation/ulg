import test from 'node:test';
import assert from 'node:assert/strict';

import {
  SCHROEDER_SPATIAL_EPOCH_CONSUMER_ARTIFACT_FAMILY,
  SCHROEDER_SPATIAL_EPOCH_CONSUMER_RECEIPT_STATUS,
  SCHROEDER_SPATIAL_EPOCH_READER,
  SCHROEDER_SPATIAL_EPOCH_READER_PHASE,
  SCHROEDER_SPATIAL_EPOCH_SUPPORT_PROFILE_ID,
  ULG_SCHROEDER_SPATIAL_EPOCH_CONSUMER_RECEIPT_SCHEMA,
  admitSchroederSpatialEpochTransactionReader,
  abortSchroederSpatialEpochTransaction,
  commitSchroederSpatialEpochTransaction,
  createSchroederSpatialEpochTransaction,
  quarantineSchroederSpatialEpochTransactionLawInputs,
  recordSchroederSpatialEpochTransactionLegacyLookup,
  scheduleSchroederSpatialEpochTransactionRelease,
  sealSchroederSpatialEpochTransactionProposals,
  sealSchroederSpatialEpochTransactionReaders,
  summarizeSchroederSpatialEpochTransaction
} from '../src/runtime/sph/schroederSpatialEpochTransaction.js';
import {
  tagWebGpuBufferDevice,
  webGpuDeviceId
} from '../src/runtime/sph/sphGpuDeviceIdentity.js';
import {
  ULG_SCHROEDER_SPATIAL_EXACT_NEAR_GPU_EVIDENCE_SCHEMA
} from '../ulg-gpu-abi/src/schroederSpatialExactNear.js';
import {
  finalizeSchroederSpatialExactNearConsumerReceipt,
  resolveSchroederSpatialExactNearConsumerGeneration,
  runSchroederSpatialEpochGenerationWebGpu
} from '../src/runtime/sph/schroederSpatialEpochGpu.js';

function createFakeEncoder() {
  return {
    clearBuffer() {},
    beginComputePass() {
      return {
        setPipeline() {},
        setBindGroup() {},
        dispatchWorkgroups() {},
        dispatchWorkgroupsIndirect() {},
        end() {}
      };
    },
    finish() { return {}; }
  };
}

function createLiveFakeDevice() {
  return {
    limits: {
      maxBufferSize: 256 * 1024 * 1024,
      maxStorageBufferBindingSize: 128 * 1024 * 1024,
      maxUniformBufferBindingSize: 64 * 1024,
      maxStorageBuffersPerShaderStage: 8,
      maxComputeWorkgroupsPerDimension: 65535,
      minUniformBufferOffsetAlignment: 256
    },
    queue: {
      writeBuffer() {},
      submit() {},
      onSubmittedWorkDone() { return Promise.resolve(); }
    },
    createBuffer(descriptor) {
      return {
        ...descriptor,
        destroyed: false,
        destroy() { this.destroyed = true; }
      };
    },
    createShaderModule(descriptor) { return descriptor; },
    createComputePipeline(descriptor) {
      return {
        ...descriptor,
        getBindGroupLayout(index) { return { index }; }
      };
    },
    createBindGroup(descriptor) { return descriptor; },
    createCommandEncoder() { return createFakeEncoder(); }
  };
}

function createLiveActiveNodeList(device) {
  const activeNodeBuffer = tagWebGpuBufferDevice(device.createBuffer({
    label: 'transaction-live-source',
    size: 2 * 16 * Float32Array.BYTES_PER_ELEMENT,
    usage: 128
  }), device);
  return {
    schema: 'peercompute.ulg.schroeder-active-node-list-execution.v0',
    status: 'schroeder-active-node-list-submitted',
    spatialDirectorySourceSchema:
      'peercompute.ulg.schroeder-spatial-directory-active-node-source.v1',
    spatialDirectorySourceStatus: 'schroeder-spatial-directory-source-ready',
    spatialDirectorySourceReady: true,
    spatialEpochSourceSchema: 'peercompute.ulg.schroeder-spatial-active-node-source.v1',
    spatialEpochSourceStatus: 'schroeder-spatial-active-node-source-ready',
    spatialEpochSourceReady: true,
    spatialEpochLevelSpacingMode: 'base-grid-spacing-times-pow2-level',
    spatialEpochPositionAuthority: 'same-epoch-pre-integration-particle-state',
    spatialEpochMinLevel: -1,
    spatialEpochMaxLevel: 1,
    spatialEpochBaseGridSpacingM: 0.25,
    spatialEpochChartId: 0,
    activeCandidateCount: 2,
    activeNodeStrideFloats: 16,
    activeNodeBuffer,
    spatialEpochStorageGeneration: 11,
    spatialEpochPhysicsTick: 13,
    spatialEpochPhysicsSubstep: 0,
    spatialEpochPositionEpoch: 17,
    spatialEpochTopologyEpoch: 19,
    spatialEpochChartEpoch: 23,
    spatialEpochLevelEpoch: 29,
    spatialEpochSupportEpoch: 31,
    phaseVolumeAssignmentOverlayEnabled: false
  };
}

function fixture({ generationId = 7, storageGeneration = 3 } = {}) {
  const device = { queue: {} };
  const buffer = (label) => tagWebGpuBufferDevice({ label, size: 4096 }, device);
  const sourceBuffers = {
    stateBuffer: buffer('state'),
    thermoBuffer: buffer('thermo'),
    identityBuffer: buffer('identity'),
    mechanicsBuffer: buffer('mechanics')
  };
  const activeNodeBuffer = buffer('active-node');
  const directoryBuffer = buffer('directory');
  const epochIdentity = {
    storageGeneration,
    physicsTick: 11,
    physicsSubstep: 2,
    positionEpoch: 13,
    topologyEpoch: 5,
    chartEpoch: 1,
    levelEpoch: 4,
    supportEpoch: 6
  };
  const generation = {
    ready: true,
    selected: true,
    directoryBuildCount: 1,
    privateLookupBuildCount: 0,
    source: {
      ready: true,
      activeNodeBuffer,
      ...epochIdentity
    },
    execution: {
      submitPerformed: true,
      deviceId: webGpuDeviceId(device),
      generationId,
      buildOrdinal: generationId,
      sortUniqueOrdinal: generationId,
      activeNodeBuffer,
      directoryBuffer,
      ...epochIdentity
    }
  };
  const sphParticleUpload = {
    stateBuffer: sourceBuffers.stateBuffer,
    thermoBuffer: sourceBuffers.thermoBuffer,
    identityBuffer: sourceBuffers.identityBuffer
  };
  const mlsMpmParticleUpload = {
    mechanicsBuffer: sourceBuffers.mechanicsBuffer
  };
  return {
    device,
    generation,
    sphParticleUpload,
    mlsMpmParticleUpload,
    sourceBuffers,
    buffer
  };
}

function liveConsumerFixture() {
  const device = createLiveFakeDevice();
  const activeNodeList = createLiveActiveNodeList(device);
  const generation = runSchroederSpatialEpochGenerationWebGpu({
    device,
    activeNodeList,
    particleCount: 2
  });
  const buffer = (label) => tagWebGpuBufferDevice(device.createBuffer({
    label,
    size: 4096,
    usage: 128
  }), device);
  const sourceBuffers = {
    stateBuffer: buffer('live-state'),
    thermoBuffer: buffer('live-thermo'),
    identityBuffer: buffer('live-identity'),
    mechanicsBuffer: buffer('live-mechanics')
  };
  return {
    device,
    generation,
    activeNodeList,
    sphParticleUpload: {
      stateBuffer: sourceBuffers.stateBuffer,
      thermoBuffer: sourceBuffers.thermoBuffer,
      identityBuffer: sourceBuffers.identityBuffer
    },
    mlsMpmParticleUpload: {
      mechanicsBuffer: sourceBuffers.mechanicsBuffer
    },
    sourceBuffers,
    buffer
  };
}

function admitMechanicsReaders(transaction, inputs) {
  assert.equal(admitSchroederSpatialEpochTransactionReader(transaction, {
    readerId: SCHROEDER_SPATIAL_EPOCH_READER.MECHANICS_P2G,
    phase: SCHROEDER_SPATIAL_EPOCH_READER_PHASE.PRE_INTEGRATION,
    ...inputs
  }), true);
  assert.equal(admitSchroederSpatialEpochTransactionReader(transaction, {
    readerId: SCHROEDER_SPATIAL_EPOCH_READER.MECHANICS_G2P,
    phase: SCHROEDER_SPATIAL_EPOCH_READER_PHASE.INTEGRATION_COMMIT,
    ...inputs
  }), true);
}

function nextParticleUploads(f, prefix = 'next') {
  return {
    sphParticleUpload: {
      stateBuffer: f.buffer(`${prefix}-state`),
      thermoBuffer: f.buffer(`${prefix}-thermo`),
      identityBuffer: f.buffer(`${prefix}-identity`)
    },
    mlsMpmParticleUpload: {
      mechanicsBuffer: f.buffer(`${prefix}-mechanics`)
    }
  };
}

const consumerContract = Object.freeze({
  [SCHROEDER_SPATIAL_EPOCH_READER.PRESSURE_CONTACT_INTERFACE]: Object.freeze({
    phase: SCHROEDER_SPATIAL_EPOCH_READER_PHASE.PRESSURE_CONTACT_PROPOSAL,
    supportProfileId:
      SCHROEDER_SPATIAL_EPOCH_SUPPORT_PROFILE_ID.PRESSURE_CONTACT_INTERFACE,
    artifactFamily:
      SCHROEDER_SPATIAL_EPOCH_CONSUMER_ARTIFACT_FAMILY.PRESSURE_CONTACT_INTERFACE
  }),
  [SCHROEDER_SPATIAL_EPOCH_READER.REACTION_DISCOVERY]: Object.freeze({
    phase: SCHROEDER_SPATIAL_EPOCH_READER_PHASE.REACTION_DISCOVERY_PROPOSAL,
    supportProfileId: SCHROEDER_SPATIAL_EPOCH_SUPPORT_PROFILE_ID.REACTION_DISCOVERY,
    artifactFamily: SCHROEDER_SPATIAL_EPOCH_CONSUMER_ARTIFACT_FAMILY.REACTION_DISCOVERY
  }),
  [SCHROEDER_SPATIAL_EPOCH_READER.SEPARATION]: Object.freeze({
    phase: SCHROEDER_SPATIAL_EPOCH_READER_PHASE.SEPARATION_PROPOSAL,
    supportProfileId: SCHROEDER_SPATIAL_EPOCH_SUPPORT_PROFILE_ID.SEPARATION,
    artifactFamily: SCHROEDER_SPATIAL_EPOCH_CONSUMER_ARTIFACT_FAMILY.SEPARATION
  }),
  [SCHROEDER_SPATIAL_EPOCH_READER.THERMAL_CONDUCTION]: Object.freeze({
    phase: SCHROEDER_SPATIAL_EPOCH_READER_PHASE.THERMAL_CONDUCTION_PROPOSAL,
    supportProfileId: SCHROEDER_SPATIAL_EPOCH_SUPPORT_PROFILE_ID.THERMAL_CONDUCTION,
    artifactFamily: SCHROEDER_SPATIAL_EPOCH_CONSUMER_ARTIFACT_FAMILY.THERMAL_CONDUCTION
  }),
  [SCHROEDER_SPATIAL_EPOCH_READER.THERMAL_RADIATION]: Object.freeze({
    phase: SCHROEDER_SPATIAL_EPOCH_READER_PHASE.THERMAL_RADIATION_PROPOSAL,
    supportProfileId: SCHROEDER_SPATIAL_EPOCH_SUPPORT_PROFILE_ID.THERMAL_RADIATION,
    artifactFamily: SCHROEDER_SPATIAL_EPOCH_CONSUMER_ARTIFACT_FAMILY.THERMAL_RADIATION
  }),
  [SCHROEDER_SPATIAL_EPOCH_READER.LOCAL_MATERIAL_INTERFACE]: Object.freeze({
    phase: SCHROEDER_SPATIAL_EPOCH_READER_PHASE.LOCAL_MATERIAL_INTERFACE_PROPOSAL,
    supportProfileId:
      SCHROEDER_SPATIAL_EPOCH_SUPPORT_PROFILE_ID.LOCAL_MATERIAL_INTERFACE,
    artifactFamily:
      SCHROEDER_SPATIAL_EPOCH_CONSUMER_ARTIFACT_FAMILY.LOCAL_MATERIAL_INTERFACE
  })
});

function consumerReceipt(f, readerId, overrides = {}) {
  const contract = consumerContract[readerId];
  return Object.freeze({
    schema: ULG_SCHROEDER_SPATIAL_EPOCH_CONSUMER_RECEIPT_SCHEMA,
    status: SCHROEDER_SPATIAL_EPOCH_CONSUMER_RECEIPT_STATUS,
    authenticated: true,
    gpuAuthenticated: true,
    submitPerformed: true,
    generationBound: true,
    consumerId: readerId,
    phase: contract.phase,
    supportProfileId: contract.supportProfileId,
    artifactFamily: contract.artifactFamily,
    deviceId: webGpuDeviceId(f.device),
    generationId: f.generation.execution.generationId,
    traversalCount: 1,
    candidateVisitCount: 0,
    consumerMaskHitCount: 0,
    migratedProposalCount: 0,
    candidateBytesRequired: 0,
    candidateBytesAdmitted: 0,
    candidateBytesCapacity: 0,
    candidateOverflowBytes: 0,
    privateLookupBuildCount: 0,
    fixedCandidateBuildCount: 0,
    exhaustiveTraversalCount: 0,
    overflowed: false,
    partialPublication: false,
    fallbackObserved: false,
    fullReadbackPerformed: false,
    ...overrides,
    epochIdentity: Object.freeze({
      storageGeneration: f.generation.execution.storageGeneration,
      physicsTick: f.generation.execution.physicsTick,
      physicsSubstep: f.generation.execution.physicsSubstep,
      positionEpoch: f.generation.execution.positionEpoch,
      topologyEpoch: f.generation.execution.topologyEpoch,
      chartEpoch: f.generation.execution.chartEpoch,
      levelEpoch: f.generation.execution.levelEpoch,
      supportEpoch: f.generation.execution.supportEpoch,
      ...(overrides.epochIdentity || {})
    })
  });
}

function finalizedConsumerReceipt(f, readerId, overrides = {}) {
  const contract = consumerContract[readerId];
  const authentication = resolveSchroederSpatialExactNearConsumerGeneration(
    f.generation,
    {
      device: f.device,
      consumerId: readerId,
      supportProfileId: contract.supportProfileId,
      sourceBuffer: f.activeNodeList.activeNodeBuffer
    }
  );
  assert.equal(authentication.authenticated, true);
  return finalizeSchroederSpatialExactNearConsumerReceipt(authentication, {
    schema: ULG_SCHROEDER_SPATIAL_EXACT_NEAR_GPU_EVIDENCE_SCHEMA,
    status: 'schroeder-spatial-exact-near-gpu-authenticated',
    gpuAuthenticated: true,
    consumerId: readerId,
    supportProfileId: contract.supportProfileId,
    generationId: f.generation.execution.generationId,
    epochIdentity: authentication.epochIdentity,
    traversalCount: 1,
    candidateVisitCount: 0,
    consumerMaskHitCount: 0,
    migratedProposalCount: 0,
    candidateBytesRequired: 0,
    candidateBytesAdmitted: 0,
    candidateBytesCapacity: 0,
    candidateOverflowBytes: 0,
    privateLookupBuildCount: 0,
    fixedCandidateBuildCount: 0,
    exhaustiveTraversalCount: 0,
    overflowed: false,
    partialPublication: false,
    fallbackObserved: false,
    fullReadbackPerformed: false,
    ...overrides,
    epochIdentity: authentication.epochIdentity
  });
}

function supportProfiles(readerIds) {
  return Object.fromEntries(readerIds.map((readerId) => [
    readerId,
    consumerContract[readerId].supportProfileId
  ]));
}

test('spatial epoch transaction enforces one immutable source family through commit and release', async () => {
  const f = fixture();
  const transaction = createSchroederSpatialEpochTransaction(f);
  const readerInputs = {
    generation: f.generation,
    sphParticleUpload: f.sphParticleUpload,
    mlsMpmParticleUpload: f.mlsMpmParticleUpload
  };

  assert.equal(admitSchroederSpatialEpochTransactionReader(transaction, {
    readerId: SCHROEDER_SPATIAL_EPOCH_READER.PRESSURE_INTERFACE,
    phase: SCHROEDER_SPATIAL_EPOCH_READER_PHASE.PRE_INTEGRATION,
    ...readerInputs
  }), true);
  admitMechanicsReaders(transaction, readerInputs);
  assert.equal(sealSchroederSpatialEpochTransactionReaders(transaction), true);

  const quarantined = quarantineSchroederSpatialEpochTransactionLawInputs(transaction, {
    consumerId: 'reaction-post-g2p',
    schroederLawQueue: { buffer: {} },
    schroederLawNeighborCandidates: { buffer: {} }
  });
  assert.equal(quarantined.schroederLawQueue, null);
  assert.equal(quarantined.schroederLawNeighborCandidates, null);
  recordSchroederSpatialEpochTransactionLegacyLookup(transaction, {
    consumerId: 'thermal-post-g2p',
    mode: 'exhaustive-particle-scan',
    exhaustiveTraversalCount: 1
  });
  recordSchroederSpatialEpochTransactionLegacyLookup(transaction, {
    consumerId: 'reaction-post-g2p',
    mode: 'fixed-capacity-particle-bin-grid',
    privateBuildCount: 1
  });
  sealSchroederSpatialEpochTransactionProposals(transaction, {
    migratedProposalCount: 0,
    legacyConsumerCount: 2
  });
  commitSchroederSpatialEpochTransaction(transaction, {
    nextParticleUploads: nextParticleUploads(f)
  });

  let release;
  const releaseFence = new Promise((resolve) => { release = resolve; });
  const releasePromise = scheduleSchroederSpatialEpochTransactionRelease(transaction, {
    after: releaseFence
  });
  let summary = summarizeSchroederSpatialEpochTransaction(transaction);
  assert.equal(summary.state, 'release-scheduled');
  assert.deepEqual(summary.counters, {
    epochCount: 1,
    directoryBuildCount: 1,
    sortUniqueCount: 1,
    privateCanonicalLookupBuildCount: 0,
    readerAdmissionCount: 3,
    readerRejectCount: 0,
    staleReaderRejectCount: 0,
    postCommitReaderRejectCount: 0,
    duplicateReaderRejectCount: 0,
    readerOrderRejectCount: 0,
    consumerDisabledRejectCount: 0,
    consumerReceiptAdmissionCount: 0,
    consumerReceiptRejectCount: 0,
    consumerReceiptIdentityRejectCount: 0,
    consumerReceiptOverflowRejectCount: 0,
    consumerReceiptFallbackRejectCount: 0,
    authenticatedConsumerTraversalCount: 0,
    authenticatedCandidateVisitCount: 0,
    authenticatedConsumerMaskHitCount: 0,
    authenticatedMigratedProposalCount: 0,
    authenticatedCandidateBytesRequired: 0,
    authenticatedCandidateBytesAdmitted: 0,
    authenticatedCandidateBytesCapacity: 0,
    proposalSealCount: 1,
    commitCount: 1,
    releaseScheduleCount: 1,
    releaseRetryCount: 0,
    releaseCount: 0,
    quarantinedLawQueueCount: 1,
    quarantinedCandidateViewCount: 1,
    staleLawInputForwardCount: 0,
    legacyPrivateLookupBuildCount: 1,
    legacyExhaustiveTraversalCount: 1
  });
  release(true);
  await releasePromise;
  summary = summarizeSchroederSpatialEpochTransaction(transaction);
  assert.equal(summary.state, 'released');
  assert.equal(summary.counters.releaseCount, 1);
});

test('spatial epoch transaction rejects stale, duplicate, and post-commit readers', () => {
  const f = fixture();
  const transaction = createSchroederSpatialEpochTransaction(f);
  const readerInputs = {
    generation: f.generation,
    sphParticleUpload: f.sphParticleUpload,
    mlsMpmParticleUpload: f.mlsMpmParticleUpload
  };
  assert.throws(() => admitSchroederSpatialEpochTransactionReader(transaction, {
    readerId: SCHROEDER_SPATIAL_EPOCH_READER.MECHANICS_P2G,
    phase: SCHROEDER_SPATIAL_EPOCH_READER_PHASE.PRE_INTEGRATION,
    ...readerInputs,
    sphParticleUpload: {
      ...f.sphParticleUpload,
      stateBuffer: f.buffer('stale-state')
    }
  }), { code: 'ERR_SCHROEDER_SPATIAL_EPOCH_STALE_READER' });

  admitMechanicsReaders(transaction, readerInputs);
  assert.throws(() => admitSchroederSpatialEpochTransactionReader(transaction, {
    readerId: SCHROEDER_SPATIAL_EPOCH_READER.MECHANICS_P2G,
    phase: SCHROEDER_SPATIAL_EPOCH_READER_PHASE.PRE_INTEGRATION,
    ...readerInputs
  }), { code: 'ERR_SCHROEDER_SPATIAL_EPOCH_DUPLICATE_READER' });
  sealSchroederSpatialEpochTransactionReaders(transaction);
  sealSchroederSpatialEpochTransactionProposals(transaction);
  commitSchroederSpatialEpochTransaction(transaction, {
    nextParticleUploads: nextParticleUploads(f)
  });
  assert.throws(() => admitSchroederSpatialEpochTransactionReader(transaction, {
    readerId: SCHROEDER_SPATIAL_EPOCH_READER.PRESSURE_INTERFACE,
    phase: SCHROEDER_SPATIAL_EPOCH_READER_PHASE.PRE_INTEGRATION,
    ...readerInputs
  }), { code: 'ERR_SCHROEDER_SPATIAL_EPOCH_POST_COMMIT_READ' });

  const summary = summarizeSchroederSpatialEpochTransaction(transaction);
  assert.equal(summary.counters.staleReaderRejectCount, 1);
  assert.equal(summary.counters.duplicateReaderRejectCount, 1);
  assert.equal(summary.counters.postCommitReaderRejectCount, 1);
});

test('spatial epoch transaction blocks two-level authority and invalid build cardinality', () => {
  const f = fixture();
  assert.throws(() => createSchroederSpatialEpochTransaction({
    ...f,
    twoLevelAuthoritative: true
  }), { code: 'ERR_SCHROEDER_SPATIAL_EPOCH_TWO_LEVEL_UNSUPPORTED' });
  assert.throws(() => createSchroederSpatialEpochTransaction({
    ...f,
    generation: { ...f.generation, directoryBuildCount: 2 }
  }), { code: 'ERR_SCHROEDER_SPATIAL_EPOCH_BUILD_CARDINALITY' });
});

test('spatial epoch transaction rejects non-numeric epoch and build identities', () => {
  const epochFixture = fixture();
  epochFixture.generation.source.positionEpoch = '13';
  epochFixture.generation.execution.positionEpoch = '13';
  assert.throws(
    () => createSchroederSpatialEpochTransaction(epochFixture),
    { code: 'ERR_SCHROEDER_SPATIAL_EPOCH_IDENTITY' }
  );

  const ordinalFixture = fixture();
  ordinalFixture.generation.execution.generationId = '7';
  ordinalFixture.generation.execution.buildOrdinal = '7';
  ordinalFixture.generation.execution.sortUniqueOrdinal = '7';
  assert.throws(
    () => createSchroederSpatialEpochTransaction(ordinalFixture),
    { code: 'ERR_SCHROEDER_SPATIAL_EPOCH_IDENTITY' }
  );
});

test('spatial epoch transaction enforces pressure-before-P2G-before-G2P order', () => {
  const beforeP2g = fixture();
  const beforeP2gTransaction = createSchroederSpatialEpochTransaction(beforeP2g);
  const beforeP2gInputs = {
    generation: beforeP2g.generation,
    sphParticleUpload: beforeP2g.sphParticleUpload,
    mlsMpmParticleUpload: beforeP2g.mlsMpmParticleUpload
  };
  assert.throws(() => admitSchroederSpatialEpochTransactionReader(
    beforeP2gTransaction,
    {
      readerId: SCHROEDER_SPATIAL_EPOCH_READER.MECHANICS_G2P,
      phase: SCHROEDER_SPATIAL_EPOCH_READER_PHASE.INTEGRATION_COMMIT,
      ...beforeP2gInputs
    }
  ), { code: 'ERR_SCHROEDER_SPATIAL_EPOCH_READER_ORDER' });
  assert.equal(
    summarizeSchroederSpatialEpochTransaction(beforeP2gTransaction)
      .counters.readerOrderRejectCount,
    1
  );

  const afterG2p = fixture();
  const afterG2pTransaction = createSchroederSpatialEpochTransaction(afterG2p);
  const afterG2pInputs = {
    generation: afterG2p.generation,
    sphParticleUpload: afterG2p.sphParticleUpload,
    mlsMpmParticleUpload: afterG2p.mlsMpmParticleUpload
  };
  admitMechanicsReaders(afterG2pTransaction, afterG2pInputs);
  assert.throws(() => admitSchroederSpatialEpochTransactionReader(
    afterG2pTransaction,
    {
      readerId: SCHROEDER_SPATIAL_EPOCH_READER.PRESSURE_INTERFACE,
      phase: SCHROEDER_SPATIAL_EPOCH_READER_PHASE.PRE_INTEGRATION,
      ...afterG2pInputs
    }
  ), { code: 'ERR_SCHROEDER_SPATIAL_EPOCH_READER_ORDER' });
});

test('spatial epoch transaction admits every enabled exact-near consumer once in declared order', () => {
  const f = liveConsumerFixture();
  const consumerReaderIds = [
    SCHROEDER_SPATIAL_EPOCH_READER.PRESSURE_CONTACT_INTERFACE,
    SCHROEDER_SPATIAL_EPOCH_READER.REACTION_DISCOVERY,
    SCHROEDER_SPATIAL_EPOCH_READER.SEPARATION,
    SCHROEDER_SPATIAL_EPOCH_READER.THERMAL_CONDUCTION,
    SCHROEDER_SPATIAL_EPOCH_READER.THERMAL_RADIATION,
    SCHROEDER_SPATIAL_EPOCH_READER.LOCAL_MATERIAL_INTERFACE
  ];
  const transaction = createSchroederSpatialEpochTransaction({
    ...f,
    enabledConsumerReaderIds: consumerReaderIds,
    consumerSupportProfileIds: supportProfiles(consumerReaderIds)
  });
  const readerInputs = {
    generation: f.generation,
    sphParticleUpload: f.sphParticleUpload,
    mlsMpmParticleUpload: f.mlsMpmParticleUpload
  };

  let expectedCandidateVisits = 0;
  let expectedMaskHits = 0;
  let expectedProposals = 0;
  consumerReaderIds.forEach((readerId, index) => {
    const candidateVisitCount = 20 + index;
    const consumerMaskHitCount = 10 + index;
    const migratedProposalCount = index;
    expectedCandidateVisits += candidateVisitCount;
    expectedMaskHits += consumerMaskHitCount;
    expectedProposals += migratedProposalCount;
    assert.equal(admitSchroederSpatialEpochTransactionReader(transaction, {
      readerId,
      phase: consumerContract[readerId].phase,
      consumerReceipt: finalizedConsumerReceipt(f, readerId, {
        candidateVisitCount,
        consumerMaskHitCount,
        migratedProposalCount,
        candidateBytesRequired: 64,
        candidateBytesAdmitted: 64,
        candidateBytesCapacity: 128
      }),
      ...readerInputs
    }), true);
  });
  admitMechanicsReaders(transaction, readerInputs);
  assert.equal(sealSchroederSpatialEpochTransactionReaders(transaction), true);
  const proposalSeal = sealSchroederSpatialEpochTransactionProposals(transaction);
  assert.equal(proposalSeal.status, 'authenticated-spatial-consumer-proposals-sealed');
  assert.equal(proposalSeal.authenticatedConsumerCount, consumerReaderIds.length);
  assert.equal(proposalSeal.authenticatedTraversalCount, consumerReaderIds.length);
  assert.equal(proposalSeal.candidateVisitCount, expectedCandidateVisits);
  assert.equal(proposalSeal.consumerMaskHitCount, expectedMaskHits);
  assert.equal(proposalSeal.migratedProposalCount, expectedProposals);

  const summary = summarizeSchroederSpatialEpochTransaction(transaction);
  assert.deepEqual(summary.enabledConsumerReaderIds, consumerReaderIds);
  assert.equal(summary.consumerReceipts.length, consumerReaderIds.length);
  assert.ok(summary.consumerReceipts.every((receipt) => (
    Object.isFrozen(receipt)
    && Object.isFrozen(receipt.epochIdentity)
    && receipt.generationId === transaction.generationId
    && receipt.traversalCount === 1
  )));
  assert.equal(summary.counters.consumerReceiptAdmissionCount, consumerReaderIds.length);
  assert.equal(
    summary.counters.authenticatedConsumerTraversalCount,
    consumerReaderIds.length
  );
  assert.equal(summary.counters.authenticatedCandidateVisitCount, expectedCandidateVisits);
  assert.equal(summary.counters.authenticatedMigratedProposalCount, expectedProposals);
  assert.equal(summary.counters.authenticatedCandidateBytesRequired, 64 * 6);
  assert.equal(summary.counters.authenticatedCandidateBytesAdmitted, 64 * 6);
  assert.equal(summary.counters.authenticatedCandidateBytesCapacity, 128 * 6);
});

test('spatial epoch exact-near consumers fail closed on disabled, stale, fallback, overflow, and out-of-order receipts', () => {
  const readerId = SCHROEDER_SPATIAL_EPOCH_READER.REACTION_DISCOVERY;
  const phase = consumerContract[readerId].phase;
  const readerInputs = (f) => ({
    generation: f.generation,
    sphParticleUpload: f.sphParticleUpload,
    mlsMpmParticleUpload: f.mlsMpmParticleUpload
  });
  const createEnabled = () => {
    const f = liveConsumerFixture();
    return {
      f,
      transaction: createSchroederSpatialEpochTransaction({
        ...f,
        enabledConsumerReaderIds: [readerId],
        consumerSupportProfileIds: supportProfiles([readerId])
      })
    };
  };

  const disabled = liveConsumerFixture();
  const disabledTransaction = createSchroederSpatialEpochTransaction(disabled);
  assert.throws(() => admitSchroederSpatialEpochTransactionReader(
    disabledTransaction,
    {
      readerId,
      phase,
      consumerReceipt: finalizedConsumerReceipt(disabled, readerId),
      ...readerInputs(disabled)
    }
  ), { code: 'ERR_SCHROEDER_SPATIAL_EPOCH_CONSUMER_DISABLED' });
  assert.equal(
    summarizeSchroederSpatialEpochTransaction(disabledTransaction)
      .counters.consumerDisabledRejectCount,
    1
  );

  assert.throws(() => createSchroederSpatialEpochTransaction({
    ...fixture(),
    enabledConsumerReaderIds: [readerId]
  }), { code: 'ERR_SCHROEDER_SPATIAL_EPOCH_READER_CONTRACT' });

  const stale = createEnabled();
  assert.throws(() => admitSchroederSpatialEpochTransactionReader(
    stale.transaction,
    {
      readerId,
      phase,
      consumerReceipt: consumerReceipt(stale.f, readerId, { generationId: 999 }),
      ...readerInputs(stale.f)
    }
  ), { code: 'ERR_SCHROEDER_SPATIAL_EPOCH_CONSUMER_RECEIPT_IDENTITY' });
  assert.equal(
    summarizeSchroederSpatialEpochTransaction(stale.transaction)
      .counters.consumerReceiptIdentityRejectCount,
    1
  );

  const fallback = createEnabled();
  assert.throws(() => admitSchroederSpatialEpochTransactionReader(
    fallback.transaction,
    {
      readerId,
      phase,
      consumerReceipt: consumerReceipt(fallback.f, readerId, {
        privateLookupBuildCount: 1
      }),
      ...readerInputs(fallback.f)
    }
  ), { code: 'ERR_SCHROEDER_SPATIAL_EPOCH_CONSUMER_FALLBACK' });
  assert.equal(
    summarizeSchroederSpatialEpochTransaction(fallback.transaction)
      .counters.consumerReceiptFallbackRejectCount,
    1
  );

  const overflow = createEnabled();
  assert.throws(() => admitSchroederSpatialEpochTransactionReader(
    overflow.transaction,
    {
      readerId,
      phase,
      consumerReceipt: consumerReceipt(overflow.f, readerId, {
        candidateBytesRequired: 128,
        candidateBytesAdmitted: 64,
        candidateBytesCapacity: 64,
        candidateOverflowBytes: 64,
        overflowed: true,
        partialPublication: true
      }),
      ...readerInputs(overflow.f)
    }
  ), { code: 'ERR_SCHROEDER_SPATIAL_EPOCH_CONSUMER_OVERFLOW' });
  assert.equal(
    summarizeSchroederSpatialEpochTransaction(overflow.transaction)
      .counters.consumerReceiptOverflowRejectCount,
    1
  );

  const outOfOrder = liveConsumerFixture();
  const pressureId = SCHROEDER_SPATIAL_EPOCH_READER.PRESSURE_CONTACT_INTERFACE;
  const outOfOrderTransaction = createSchroederSpatialEpochTransaction({
    ...outOfOrder,
    enabledConsumerReaderIds: [pressureId, readerId],
    consumerSupportProfileIds: supportProfiles([pressureId, readerId])
  });
  assert.equal(admitSchroederSpatialEpochTransactionReader(outOfOrderTransaction, {
    readerId,
    phase,
    consumerReceipt: finalizedConsumerReceipt(outOfOrder, readerId),
    ...readerInputs(outOfOrder)
  }), true);
  assert.throws(() => admitSchroederSpatialEpochTransactionReader(
    outOfOrderTransaction,
    {
      readerId: pressureId,
      phase: consumerContract[pressureId].phase,
      consumerReceipt: finalizedConsumerReceipt(outOfOrder, pressureId),
      ...readerInputs(outOfOrder)
    }
  ), { code: 'ERR_SCHROEDER_SPATIAL_EPOCH_READER_ORDER' });
});

test('spatial epoch proposal accounting rejects mismatches and migrated legacy lookup work', () => {
  const f = liveConsumerFixture();
  const readerId = SCHROEDER_SPATIAL_EPOCH_READER.THERMAL_CONDUCTION;
  const transaction = createSchroederSpatialEpochTransaction({
    ...f,
    enabledConsumerReaderIds: [readerId],
    consumerSupportProfileIds: supportProfiles([readerId])
  });
  const readerInputs = {
    generation: f.generation,
    sphParticleUpload: f.sphParticleUpload,
    mlsMpmParticleUpload: f.mlsMpmParticleUpload
  };
  assert.equal(admitSchroederSpatialEpochTransactionReader(transaction, {
    readerId,
    phase: consumerContract[readerId].phase,
    consumerReceipt: finalizedConsumerReceipt(f, readerId, {
      migratedProposalCount: 3
    }),
    ...readerInputs
  }), true);
  admitMechanicsReaders(transaction, readerInputs);
  sealSchroederSpatialEpochTransactionReaders(transaction);
  assert.throws(() => recordSchroederSpatialEpochTransactionLegacyLookup(transaction, {
    consumerId: readerId,
    mode: 'exhaustive-particle-scan',
    exhaustiveTraversalCount: 1
  }), { code: 'ERR_SCHROEDER_SPATIAL_EPOCH_CONSUMER_FALLBACK' });
  assert.throws(() => sealSchroederSpatialEpochTransactionProposals(transaction, {
    migratedProposalCount: 2
  }), { code: 'ERR_SCHROEDER_SPATIAL_EPOCH_PROPOSAL_RECEIPT_MISMATCH' });
  assert.equal(
    summarizeSchroederSpatialEpochTransaction(transaction).state,
    'readers-complete'
  );
  assert.equal(
    sealSchroederSpatialEpochTransactionProposals(transaction).migratedProposalCount,
    3
  );
});

test('spatial epoch transaction rejects generation mutation after creation', () => {
  const f = fixture();
  const transaction = createSchroederSpatialEpochTransaction(f);
  f.generation.execution.positionEpoch = 999;
  assert.throws(() => admitSchroederSpatialEpochTransactionReader(transaction, {
    readerId: SCHROEDER_SPATIAL_EPOCH_READER.MECHANICS_P2G,
    phase: SCHROEDER_SPATIAL_EPOCH_READER_PHASE.PRE_INTEGRATION,
    generation: f.generation,
    sphParticleUpload: f.sphParticleUpload,
    mlsMpmParticleUpload: f.mlsMpmParticleUpload
  }), { code: 'ERR_SCHROEDER_SPATIAL_EPOCH_STALE_READER' });
  const summary = summarizeSchroederSpatialEpochTransaction(transaction);
  assert.equal(summary.epochIdentity.positionEpoch, 13);
  assert.equal(summary.counters.staleReaderRejectCount, 1);
});

test('spatial epoch transaction commit and release scheduling are one-shot', async () => {
  const f = fixture();
  const transaction = createSchroederSpatialEpochTransaction(f);
  const readerInputs = {
    generation: f.generation,
    sphParticleUpload: f.sphParticleUpload,
    mlsMpmParticleUpload: f.mlsMpmParticleUpload
  };
  admitMechanicsReaders(transaction, readerInputs);
  sealSchroederSpatialEpochTransactionReaders(transaction);
  sealSchroederSpatialEpochTransactionProposals(transaction);
  commitSchroederSpatialEpochTransaction(transaction, {
    nextParticleUploads: nextParticleUploads(f)
  });
  assert.throws(
    () => commitSchroederSpatialEpochTransaction(transaction, {
      nextParticleUploads: nextParticleUploads(f, 'duplicate-next')
    }),
    { code: 'ERR_SCHROEDER_SPATIAL_EPOCH_TRANSACTION_STATE' }
  );
  let release;
  const releaseFence = new Promise((resolve) => { release = resolve; });
  const releasePromise = scheduleSchroederSpatialEpochTransactionRelease(
    transaction,
    { after: releaseFence }
  );
  assert.throws(
    () => scheduleSchroederSpatialEpochTransactionRelease(transaction),
    { code: 'ERR_SCHROEDER_SPATIAL_EPOCH_TRANSACTION_STATE' }
  );
  let summary = summarizeSchroederSpatialEpochTransaction(transaction);
  assert.equal(summary.counters.commitCount, 1);
  assert.equal(summary.counters.releaseScheduleCount, 1);
  release(true);
  await releasePromise;
  summary = summarizeSchroederSpatialEpochTransaction(transaction);
  assert.equal(summary.counters.releaseCount, 1);
});

test('spatial epoch transaction commit rejects missing, partial, and foreign next buffer families before transition', () => {
  const prepare = () => {
    const f = fixture();
    const transaction = createSchroederSpatialEpochTransaction(f);
    admitMechanicsReaders(transaction, {
      generation: f.generation,
      sphParticleUpload: f.sphParticleUpload,
      mlsMpmParticleUpload: f.mlsMpmParticleUpload
    });
    sealSchroederSpatialEpochTransactionReaders(transaction);
    sealSchroederSpatialEpochTransactionProposals(transaction);
    return { f, transaction };
  };

  const missing = prepare();
  assert.throws(
    () => commitSchroederSpatialEpochTransaction(missing.transaction),
    { code: 'ERR_SCHROEDER_SPATIAL_EPOCH_COMMIT_BUFFER_FAMILY' }
  );
  assert.equal(
    summarizeSchroederSpatialEpochTransaction(missing.transaction).state,
    'proposals-sealed'
  );

  const partial = prepare();
  const partialUploads = nextParticleUploads(partial.f);
  partialUploads.sphParticleUpload.identityBuffer = null;
  assert.throws(
    () => commitSchroederSpatialEpochTransaction(partial.transaction, {
      nextParticleUploads: partialUploads
    }),
    { code: 'ERR_SCHROEDER_SPATIAL_EPOCH_COMMIT_BUFFER_FAMILY' }
  );
  assert.equal(
    summarizeSchroederSpatialEpochTransaction(partial.transaction).state,
    'proposals-sealed'
  );

  const foreign = prepare();
  const foreignUploads = nextParticleUploads(foreign.f);
  foreignUploads.sphParticleUpload.stateBuffer = tagWebGpuBufferDevice(
    { label: 'foreign-next-state', size: 4096 },
    { queue: {} }
  );
  assert.throws(
    () => commitSchroederSpatialEpochTransaction(foreign.transaction, {
      nextParticleUploads: foreignUploads
    }),
    { code: 'ERR_SCHROEDER_SPATIAL_EPOCH_DEVICE_MISMATCH' }
  );
  assert.equal(
    summarizeSchroederSpatialEpochTransaction(foreign.transaction).state,
    'proposals-sealed'
  );
});

test('spatial epoch transaction does not claim release from a false fence or overwrite abort', async () => {
  const prepare = () => {
    const f = fixture();
    const transaction = createSchroederSpatialEpochTransaction(f);
    admitMechanicsReaders(transaction, {
      generation: f.generation,
      sphParticleUpload: f.sphParticleUpload,
      mlsMpmParticleUpload: f.mlsMpmParticleUpload
    });
    sealSchroederSpatialEpochTransactionReaders(transaction);
    sealSchroederSpatialEpochTransactionProposals(transaction);
    commitSchroederSpatialEpochTransaction(transaction, {
      nextParticleUploads: nextParticleUploads(f)
    });
    return transaction;
  };

  const missingFence = prepare();
  assert.throws(
    () => scheduleSchroederSpatialEpochTransactionRelease(missingFence),
    { code: 'ERR_SCHROEDER_SPATIAL_EPOCH_RELEASE_FENCE' }
  );
  assert.equal(
    summarizeSchroederSpatialEpochTransaction(missingFence).state,
    'committed'
  );

  const unconfirmed = prepare();
  assert.equal(await scheduleSchroederSpatialEpochTransactionRelease(unconfirmed, {
    after: Promise.resolve()
  }), false);
  let summary = summarizeSchroederSpatialEpochTransaction(unconfirmed);
  assert.equal(summary.state, 'release-blocked');
  assert.equal(summary.counters.releaseCount, 0);

  const blocked = prepare();
  assert.equal(await scheduleSchroederSpatialEpochTransactionRelease(blocked, {
    after: Promise.resolve(false)
  }), false);
  summary = summarizeSchroederSpatialEpochTransaction(blocked);
  assert.equal(summary.state, 'release-blocked');
  assert.equal(summary.counters.releaseCount, 0);
  assert.match(summary.releaseFailureReason, /did not confirm/);
  assert.equal(await scheduleSchroederSpatialEpochTransactionRelease(blocked, {
    after: Promise.resolve(true)
  }), true);
  summary = summarizeSchroederSpatialEpochTransaction(blocked);
  assert.equal(summary.state, 'released');
  assert.equal(summary.counters.releaseScheduleCount, 2);
  assert.equal(summary.counters.releaseRetryCount, 1);
  assert.equal(summary.counters.releaseCount, 1);
  assert.equal(summary.releaseFailureReason, null);

  const aborted = prepare();
  let release;
  const releaseFence = new Promise((resolve) => { release = resolve; });
  const releasePromise = scheduleSchroederSpatialEpochTransactionRelease(aborted, {
    after: releaseFence
  });
  assert.equal(abortSchroederSpatialEpochTransaction(aborted, 'test abort'), true);
  release(true);
  assert.equal(await releasePromise, true);
  summary = summarizeSchroederSpatialEpochTransaction(aborted);
  assert.equal(summary.state, 'aborted');
  assert.equal(summary.abortReason, 'test abort');
  assert.equal(summary.counters.releaseCount, 1);
});

test('two chained transactions preserve distinct generations and exactly one build each', () => {
  const first = fixture({ generationId: 19, storageGeneration: 8 });
  const second = fixture({ generationId: 20, storageGeneration: 9 });
  const transactions = [
    createSchroederSpatialEpochTransaction(first),
    createSchroederSpatialEpochTransaction(second)
  ];
  const summaries = transactions.map(summarizeSchroederSpatialEpochTransaction);
  assert.deepEqual(summaries.map((summary) => summary.generationId), [19, 20]);
  assert.deepEqual(summaries.map((summary) => summary.epochIdentity.storageGeneration), [8, 9]);
  assert.equal(
    summaries.reduce((sum, summary) => sum + summary.counters.directoryBuildCount, 0),
    2
  );
  assert.equal(
    summaries.reduce((sum, summary) => sum + summary.counters.privateCanonicalLookupBuildCount, 0),
    0
  );
});
