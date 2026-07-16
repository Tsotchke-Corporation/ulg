import test from 'node:test';
import assert from 'node:assert/strict';

import {
  SCHROEDER_SPATIAL_EPOCH_READER,
  SCHROEDER_SPATIAL_EPOCH_READER_PHASE,
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
