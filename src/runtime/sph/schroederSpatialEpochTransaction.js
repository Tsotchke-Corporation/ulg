import {
  webGpuBufferMatchesDevice,
  webGpuDeviceId
} from './sphGpuDeviceIdentity.js';

export const ULG_SCHROEDER_SPATIAL_EPOCH_TRANSACTION_SCHEMA =
  'peercompute.ulg.schroeder-spatial-epoch-transaction.v0';
export const ULG_SCHROEDER_SPATIAL_EPOCH_TRANSACTION_SUMMARY_SCHEMA =
  'peercompute.ulg.schroeder-spatial-epoch-transaction-summary.v0';

export const SCHROEDER_SPATIAL_EPOCH_TRANSACTION_STATE = Object.freeze({
  CANONICAL_BUILT: 'canonical-built',
  READERS_ACTIVE: 'readers-active',
  READERS_COMPLETE: 'readers-complete',
  PROPOSALS_SEALED: 'proposals-sealed',
  COMMITTED: 'committed',
  RELEASE_SCHEDULED: 'release-scheduled',
  RELEASE_BLOCKED: 'release-blocked',
  RELEASED: 'released',
  ABORTED: 'aborted'
});

export const SCHROEDER_SPATIAL_EPOCH_READER = Object.freeze({
  PRESSURE_INTERFACE: 'pressure-interface',
  MECHANICS_P2G: 'mechanics-p2g',
  MECHANICS_G2P: 'mechanics-g2p'
});

export const SCHROEDER_SPATIAL_EPOCH_READER_PHASE = Object.freeze({
  PRE_INTEGRATION: 'pre-integration',
  INTEGRATION_COMMIT: 'integration-commit'
});

const EPOCH_FIELDS = Object.freeze([
  'storageGeneration',
  'physicsTick',
  'physicsSubstep',
  'positionEpoch',
  'topologyEpoch',
  'chartEpoch',
  'levelEpoch',
  'supportEpoch'
]);

const READER_PHASES = Object.freeze({
  [SCHROEDER_SPATIAL_EPOCH_READER.PRESSURE_INTERFACE]:
    SCHROEDER_SPATIAL_EPOCH_READER_PHASE.PRE_INTEGRATION,
  [SCHROEDER_SPATIAL_EPOCH_READER.MECHANICS_P2G]:
    SCHROEDER_SPATIAL_EPOCH_READER_PHASE.PRE_INTEGRATION,
  [SCHROEDER_SPATIAL_EPOCH_READER.MECHANICS_G2P]:
    SCHROEDER_SPATIAL_EPOCH_READER_PHASE.INTEGRATION_COMMIT
});

const DEFAULT_REQUIRED_READERS = Object.freeze([
  SCHROEDER_SPATIAL_EPOCH_READER.MECHANICS_P2G,
  SCHROEDER_SPATIAL_EPOCH_READER.MECHANICS_G2P
]);

const TRANSACTION_AUTHORITY = new WeakMap();

function transactionError(message, code) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function exactU32(value, label, { positive = false } = {}) {
  const number = value;
  if (
    typeof number !== 'number'
    || !Number.isInteger(number)
    || number < (positive ? 1 : 0)
    || number > 0xffff_ffff
  ) {
    throw transactionError(
      `${label} must be an exact ${positive ? 'positive ' : ''}u32`,
      'ERR_SCHROEDER_SPATIAL_EPOCH_IDENTITY'
    );
  }
  return number;
}

function requireBuffer(buffer, label, device, { optional = false } = {}) {
  if (buffer == null && optional) return null;
  if (!buffer || (typeof buffer !== 'object' && typeof buffer !== 'function')) {
    throw transactionError(
      `${label} is required`,
      'ERR_SCHROEDER_SPATIAL_EPOCH_SOURCE_BUFFER'
    );
  }
  if (!webGpuBufferMatchesDevice(buffer, device)) {
    throw transactionError(
      `${label} belongs to a different WebGPU device`,
      'ERR_SCHROEDER_SPATIAL_EPOCH_DEVICE_MISMATCH'
    );
  }
  return buffer;
}

function resolveSourceBuffers({
  device,
  sphParticleUpload,
  mlsMpmParticleUpload
}) {
  return Object.freeze({
    stateBuffer: requireBuffer(
      sphParticleUpload?.stateBuffer,
      'sphParticleUpload.stateBuffer',
      device
    ),
    thermoBuffer: requireBuffer(
      sphParticleUpload?.thermoBuffer,
      'sphParticleUpload.thermoBuffer',
      device
    ),
    identityBuffer: requireBuffer(
      sphParticleUpload?.identityBuffer,
      'sphParticleUpload.identityBuffer',
      device,
      { optional: true }
    ),
    mechanicsBuffer: requireBuffer(
      mlsMpmParticleUpload?.mechanicsBuffer,
      'mlsMpmParticleUpload.mechanicsBuffer',
      device
    )
  });
}

function authorityFor(transaction) {
  const authority = TRANSACTION_AUTHORITY.get(transaction);
  if (!authority) {
    throw transactionError(
      'Unknown Schroeder spatial epoch transaction',
      'ERR_SCHROEDER_SPATIAL_EPOCH_FOREIGN_TRANSACTION'
    );
  }
  return authority;
}

function sourceBuffersMatch(expected, actual) {
  return expected.stateBuffer === actual.stateBuffer
    && expected.thermoBuffer === actual.thermoBuffer
    && expected.identityBuffer === actual.identityBuffer
    && expected.mechanicsBuffer === actual.mechanicsBuffer;
}

function generationMatchesSnapshot(authority, generation) {
  const snapshot = authority.generationSnapshot;
  const source = generation?.source || null;
  const execution = generation?.execution || null;
  if (
    generation !== authority.generation
    || generation?.ready !== true
    || generation?.selected !== true
    || generation?.releaseScheduled === true
    || generation?.directoryBuildCount !== 1
    || generation?.privateLookupBuildCount !== 0
    || source !== snapshot.source
    || execution !== snapshot.execution
    || source?.ready !== true
    || execution?.submitPerformed !== true
    || generation?.runtime !== snapshot.runtime
    || execution?.ownerRuntime !== snapshot.executionOwnerRuntime
    || execution?.deviceId !== snapshot.deviceId
    || source?.activeNodeBuffer !== snapshot.activeNodeBuffer
    || execution?.activeNodeBuffer !== snapshot.activeNodeBuffer
    || execution?.directoryBuffer !== snapshot.directoryBuffer
    || !webGpuBufferMatchesDevice(snapshot.activeNodeBuffer, authority.device)
    || !webGpuBufferMatchesDevice(snapshot.directoryBuffer, authority.device)
    || execution?.generationId !== snapshot.generationId
    || execution?.buildOrdinal !== snapshot.buildOrdinal
    || execution?.sortUniqueOrdinal !== snapshot.sortUniqueOrdinal
  ) return false;
  return EPOCH_FIELDS.every((field) => (
    source?.[field] === snapshot.epochIdentity[field]
    && execution?.[field] === snapshot.epochIdentity[field]
  ));
}

function readerOrderSatisfied(authority, readerId) {
  const p2gAdmitted = authority.admittedReaders.has(
    SCHROEDER_SPATIAL_EPOCH_READER.MECHANICS_P2G
  );
  const g2pAdmitted = authority.admittedReaders.has(
    SCHROEDER_SPATIAL_EPOCH_READER.MECHANICS_G2P
  );
  if (readerId === SCHROEDER_SPATIAL_EPOCH_READER.PRESSURE_INTERFACE) {
    return !p2gAdmitted && !g2pAdmitted;
  }
  if (readerId === SCHROEDER_SPATIAL_EPOCH_READER.MECHANICS_P2G) {
    return !g2pAdmitted;
  }
  if (readerId === SCHROEDER_SPATIAL_EPOCH_READER.MECHANICS_G2P) {
    return p2gAdmitted && !g2pAdmitted;
  }
  return false;
}

function rejectReader(authority, message, code) {
  authority.counters.readerRejectCount += 1;
  if (code === 'ERR_SCHROEDER_SPATIAL_EPOCH_STALE_READER') {
    authority.counters.staleReaderRejectCount += 1;
  }
  if (code === 'ERR_SCHROEDER_SPATIAL_EPOCH_POST_COMMIT_READ') {
    authority.counters.postCommitReaderRejectCount += 1;
  }
  if (code === 'ERR_SCHROEDER_SPATIAL_EPOCH_READER_ORDER') {
    authority.counters.readerOrderRejectCount += 1;
  }
  throw transactionError(message, code);
}

function transition(authority, expectedStates, nextState) {
  if (!expectedStates.includes(authority.state)) {
    throw transactionError(
      `Spatial epoch transaction cannot transition from ${authority.state} to ${nextState}`,
      'ERR_SCHROEDER_SPATIAL_EPOCH_TRANSACTION_STATE'
    );
  }
  authority.state = nextState;
}

/**
 * Freeze one selected same-device x_n generation and its complete particle
 * source family. The transaction is deliberately host-side: it authenticates
 * scheduling and buffer identity while the generation remains the GPU lookup
 * authority.
 */
export function createSchroederSpatialEpochTransaction({
  device,
  generation,
  sphParticleUpload,
  mlsMpmParticleUpload,
  twoLevelAuthoritative = false,
  requiredReaderIds = DEFAULT_REQUIRED_READERS
} = {}) {
  if (twoLevelAuthoritative === true) {
    throw transactionError(
      'Authoritative two-level mechanics is not admitted by the first spatial epoch transaction slice',
      'ERR_SCHROEDER_SPATIAL_EPOCH_TWO_LEVEL_UNSUPPORTED'
    );
  }
  if (!device || !device.queue) {
    throw new TypeError('createSchroederSpatialEpochTransaction requires a GPUDevice-like object');
  }
  if (
    generation?.selected !== true
    || generation?.ready !== true
    || generation?.execution?.submitPerformed !== true
    || generation?.releaseScheduled === true
  ) {
    throw transactionError(
      'Spatial epoch transaction requires one selected, submitted generation',
      'ERR_SCHROEDER_SPATIAL_EPOCH_GENERATION_NOT_READY'
    );
  }
  if (generation.directoryBuildCount !== 1 || generation.privateLookupBuildCount !== 0) {
    throw transactionError(
      'Spatial epoch transaction requires exactly one canonical directory build and no private lookup build',
      'ERR_SCHROEDER_SPATIAL_EPOCH_BUILD_CARDINALITY'
    );
  }
  const source = generation.source || null;
  const execution = generation.execution || null;
  if (source?.ready !== true || !execution) {
    throw transactionError(
      'Spatial epoch generation lacks an admitted immutable source/execution pair',
      'ERR_SCHROEDER_SPATIAL_EPOCH_IDENTITY'
    );
  }
  const deviceId = webGpuDeviceId(device);
  if (execution.deviceId !== deviceId) {
    throw transactionError(
      'Spatial epoch generation belongs to a different WebGPU device',
      'ERR_SCHROEDER_SPATIAL_EPOCH_DEVICE_MISMATCH'
    );
  }
  if (
    source.activeNodeBuffer !== execution.activeNodeBuffer
    || !webGpuBufferMatchesDevice(source.activeNodeBuffer, device)
    || !webGpuBufferMatchesDevice(execution.directoryBuffer, device)
  ) {
    throw transactionError(
      'Spatial epoch source and execution do not share exact same-device buffers',
      'ERR_SCHROEDER_SPATIAL_EPOCH_DEVICE_MISMATCH'
    );
  }
  const epochIdentity = {};
  for (const field of EPOCH_FIELDS) {
    const sourceValue = exactU32(source[field], `generation.source.${field}`, {
      positive: field === 'storageGeneration'
    });
    const executionValue = exactU32(execution[field], `generation.execution.${field}`, {
      positive: field === 'storageGeneration'
    });
    if (sourceValue !== executionValue) {
      throw transactionError(
        `Spatial epoch source/execution ${field} mismatch`,
        'ERR_SCHROEDER_SPATIAL_EPOCH_IDENTITY'
      );
    }
    epochIdentity[field] = sourceValue;
  }
  const generationId = exactU32(execution.generationId, 'generation.execution.generationId', {
    positive: true
  });
  const buildOrdinal = exactU32(execution.buildOrdinal, 'generation.execution.buildOrdinal', {
    positive: true
  });
  const sortUniqueOrdinal = exactU32(
    execution.sortUniqueOrdinal,
    'generation.execution.sortUniqueOrdinal',
    { positive: true }
  );
  if (buildOrdinal !== generationId || sortUniqueOrdinal !== generationId) {
    throw transactionError(
      'Spatial epoch build/sort ordinals do not identify the selected generation',
      'ERR_SCHROEDER_SPATIAL_EPOCH_BUILD_CARDINALITY'
    );
  }
  const sourceBuffers = resolveSourceBuffers({
    device,
    sphParticleUpload,
    mlsMpmParticleUpload
  });
  const requiredReaders = new Set(requiredReaderIds);
  for (const readerId of requiredReaders) {
    if (!READER_PHASES[readerId]) {
      throw transactionError(
        `Unknown required spatial epoch reader ${readerId}`,
        'ERR_SCHROEDER_SPATIAL_EPOCH_READER_CONTRACT'
      );
    }
  }
  const authority = {
    state: SCHROEDER_SPATIAL_EPOCH_TRANSACTION_STATE.CANONICAL_BUILT,
    device,
    deviceId,
    generation,
    generationId,
    epochIdentity: Object.freeze(epochIdentity),
    generationSnapshot: Object.freeze({
      source,
      execution,
      runtime: generation.runtime,
      executionOwnerRuntime: execution.ownerRuntime,
      deviceId,
      activeNodeBuffer: source.activeNodeBuffer,
      directoryBuffer: execution.directoryBuffer,
      generationId,
      buildOrdinal,
      sortUniqueOrdinal,
      epochIdentity: Object.freeze({ ...epochIdentity })
    }),
    sourceBuffers,
    requiredReaders,
    admittedReaders: new Map(),
    proposalSeal: null,
    commit: null,
    releasePromise: null,
    releaseFailureReason: null,
    abortReason: null,
    legacyLookupRecords: [],
    counters: {
      epochCount: 1,
      directoryBuildCount: 1,
      sortUniqueCount: 1,
      privateCanonicalLookupBuildCount: 0,
      readerAdmissionCount: 0,
      readerRejectCount: 0,
      staleReaderRejectCount: 0,
      postCommitReaderRejectCount: 0,
      duplicateReaderRejectCount: 0,
      readerOrderRejectCount: 0,
      proposalSealCount: 0,
      commitCount: 0,
      releaseScheduleCount: 0,
      releaseRetryCount: 0,
      releaseCount: 0,
      quarantinedLawQueueCount: 0,
      quarantinedCandidateViewCount: 0,
      staleLawInputForwardCount: 0,
      legacyPrivateLookupBuildCount: 0,
      legacyExhaustiveTraversalCount: 0
    }
  };
  const transaction = Object.freeze({
    schema: ULG_SCHROEDER_SPATIAL_EPOCH_TRANSACTION_SCHEMA,
    generation,
    generationId,
    epochIdentity: authority.epochIdentity,
    sourceBuffers,
    get state() {
      return authority.state;
    }
  });
  TRANSACTION_AUTHORITY.set(transaction, authority);
  return transaction;
}

export function admitSchroederSpatialEpochTransactionReader(transaction, {
  readerId,
  phase,
  generation,
  sphParticleUpload,
  mlsMpmParticleUpload
} = {}) {
  const authority = authorityFor(transaction);
  if (
    authority.state === SCHROEDER_SPATIAL_EPOCH_TRANSACTION_STATE.COMMITTED
    || authority.state === SCHROEDER_SPATIAL_EPOCH_TRANSACTION_STATE.RELEASE_SCHEDULED
    || authority.state === SCHROEDER_SPATIAL_EPOCH_TRANSACTION_STATE.RELEASE_BLOCKED
    || authority.state === SCHROEDER_SPATIAL_EPOCH_TRANSACTION_STATE.RELEASED
  ) {
    rejectReader(
      authority,
      `Spatial epoch reader ${readerId ?? 'unknown'} attempted a post-commit read`,
      'ERR_SCHROEDER_SPATIAL_EPOCH_POST_COMMIT_READ'
    );
  }
  if (
    authority.state !== SCHROEDER_SPATIAL_EPOCH_TRANSACTION_STATE.CANONICAL_BUILT
    && authority.state !== SCHROEDER_SPATIAL_EPOCH_TRANSACTION_STATE.READERS_ACTIVE
  ) {
    rejectReader(
      authority,
      `Spatial epoch reader ${readerId ?? 'unknown'} attempted admission after readers were sealed`,
      'ERR_SCHROEDER_SPATIAL_EPOCH_STALE_READER'
    );
  }
  const expectedPhase = READER_PHASES[readerId];
  if (!expectedPhase || phase !== expectedPhase) {
    rejectReader(
      authority,
      `Spatial epoch reader ${readerId ?? 'unknown'} has phase ${phase ?? 'missing'}; expected ${expectedPhase ?? 'a declared reader'}`,
      'ERR_SCHROEDER_SPATIAL_EPOCH_READER_CONTRACT'
    );
  }
  if (authority.admittedReaders.has(readerId)) {
    authority.counters.duplicateReaderRejectCount += 1;
    rejectReader(
      authority,
      `Spatial epoch reader ${readerId} was admitted more than once`,
      'ERR_SCHROEDER_SPATIAL_EPOCH_DUPLICATE_READER'
    );
  }
  if (!generationMatchesSnapshot(authority, generation)) {
    rejectReader(
      authority,
      `Spatial epoch reader ${readerId} supplied a stale, mutated, released, or foreign generation`,
      'ERR_SCHROEDER_SPATIAL_EPOCH_STALE_READER'
    );
  }
  if (!readerOrderSatisfied(authority, readerId)) {
    rejectReader(
      authority,
      `Spatial epoch reader ${readerId} violated pressure? -> P2G -> G2P submission order`,
      'ERR_SCHROEDER_SPATIAL_EPOCH_READER_ORDER'
    );
  }
  let readerBuffers;
  try {
    readerBuffers = resolveSourceBuffers({
      device: authority.device,
      sphParticleUpload,
      mlsMpmParticleUpload
    });
  } catch (error) {
    rejectReader(
      authority,
      `Spatial epoch reader ${readerId} supplied an invalid source family: ${error.message}`,
      error.code === 'ERR_SCHROEDER_SPATIAL_EPOCH_DEVICE_MISMATCH'
        ? error.code
        : 'ERR_SCHROEDER_SPATIAL_EPOCH_STALE_READER'
    );
  }
  if (!sourceBuffersMatch(authority.sourceBuffers, readerBuffers)) {
    rejectReader(
      authority,
      `Spatial epoch reader ${readerId} did not bind the frozen x_n source family`,
      'ERR_SCHROEDER_SPATIAL_EPOCH_STALE_READER'
    );
  }
  authority.admittedReaders.set(readerId, Object.freeze({ readerId, phase }));
  authority.counters.readerAdmissionCount += 1;
  authority.state = SCHROEDER_SPATIAL_EPOCH_TRANSACTION_STATE.READERS_ACTIVE;
  return true;
}

export function sealSchroederSpatialEpochTransactionReaders(transaction) {
  const authority = authorityFor(transaction);
  transition(
    authority,
    [
      SCHROEDER_SPATIAL_EPOCH_TRANSACTION_STATE.CANONICAL_BUILT,
      SCHROEDER_SPATIAL_EPOCH_TRANSACTION_STATE.READERS_ACTIVE
    ],
    SCHROEDER_SPATIAL_EPOCH_TRANSACTION_STATE.READERS_COMPLETE
  );
  const missingReaders = [...authority.requiredReaders]
    .filter((readerId) => !authority.admittedReaders.has(readerId));
  if (missingReaders.length > 0) {
    authority.state = SCHROEDER_SPATIAL_EPOCH_TRANSACTION_STATE.READERS_ACTIVE;
    throw transactionError(
      `Spatial epoch transaction is missing required readers: ${missingReaders.join(', ')}`,
      'ERR_SCHROEDER_SPATIAL_EPOCH_MISSING_READER'
    );
  }
  return true;
}

/** Quarantine x_n law views from post-integration consumers until migrated. */
export function quarantineSchroederSpatialEpochTransactionLawInputs(transaction, {
  consumerId,
  schroederLawQueue = null,
  schroederLawNeighborCandidates = null
} = {}) {
  const authority = authorityFor(transaction);
  if (
    authority.state !== SCHROEDER_SPATIAL_EPOCH_TRANSACTION_STATE.READERS_COMPLETE
  ) {
    throw transactionError(
      `Post-integration consumer ${consumerId ?? 'unknown'} was reached before canonical readers completed`,
      'ERR_SCHROEDER_SPATIAL_EPOCH_TRANSACTION_STATE'
    );
  }
  if (schroederLawQueue) authority.counters.quarantinedLawQueueCount += 1;
  if (schroederLawNeighborCandidates) {
    authority.counters.quarantinedCandidateViewCount += 1;
  }
  return Object.freeze({
    consumerId: consumerId ?? null,
    schroederLawQueue: null,
    schroederLawNeighborCandidates: null,
    staleLawInputForwardCount: 0
  });
}

export function recordSchroederSpatialEpochTransactionLegacyLookup(transaction, {
  consumerId,
  mode,
  privateBuildCount = 0,
  exhaustiveTraversalCount = 0
} = {}) {
  const authority = authorityFor(transaction);
  if (
    authority.state !== SCHROEDER_SPATIAL_EPOCH_TRANSACTION_STATE.READERS_COMPLETE
  ) {
    throw transactionError(
      `Legacy lookup for ${consumerId ?? 'unknown'} was recorded outside the post-integration quarantine phase`,
      'ERR_SCHROEDER_SPATIAL_EPOCH_TRANSACTION_STATE'
    );
  }
  const resolvedPrivateBuildCount = exactU32(privateBuildCount, 'privateBuildCount');
  const resolvedExhaustiveTraversalCount = exactU32(
    exhaustiveTraversalCount,
    'exhaustiveTraversalCount'
  );
  authority.counters.legacyPrivateLookupBuildCount += resolvedPrivateBuildCount;
  authority.counters.legacyExhaustiveTraversalCount += resolvedExhaustiveTraversalCount;
  authority.legacyLookupRecords.push(Object.freeze({
    consumerId: consumerId ?? null,
    mode: mode ?? null,
    privateBuildCount: resolvedPrivateBuildCount,
    exhaustiveTraversalCount: resolvedExhaustiveTraversalCount
  }));
  return true;
}

export function sealSchroederSpatialEpochTransactionProposals(transaction, {
  migratedProposalCount = 0,
  legacyConsumerCount = 0,
  status = 'unmigrated-laws-quarantined'
} = {}) {
  const authority = authorityFor(transaction);
  transition(
    authority,
    [SCHROEDER_SPATIAL_EPOCH_TRANSACTION_STATE.READERS_COMPLETE],
    SCHROEDER_SPATIAL_EPOCH_TRANSACTION_STATE.PROPOSALS_SEALED
  );
  authority.proposalSeal = Object.freeze({
    status,
    migratedProposalCount: exactU32(migratedProposalCount, 'migratedProposalCount'),
    legacyConsumerCount: exactU32(legacyConsumerCount, 'legacyConsumerCount')
  });
  authority.counters.proposalSealCount += 1;
  return authority.proposalSeal;
}

export function commitSchroederSpatialEpochTransaction(transaction, {
  nextParticleUploads = null,
  status = 'next-state-committed'
} = {}) {
  const authority = authorityFor(transaction);
  const nextSphParticleUpload = nextParticleUploads?.sphParticleUpload || null;
  const nextMlsMpmParticleUpload =
    nextParticleUploads?.mlsMpmParticleUpload || null;
  if (!nextSphParticleUpload || !nextMlsMpmParticleUpload) {
    throw transactionError(
      'Spatial epoch commit requires a complete next SPH/MLS particle upload family',
      'ERR_SCHROEDER_SPATIAL_EPOCH_COMMIT_BUFFER_FAMILY'
    );
  }
  const nextSourceBuffers = resolveSourceBuffers({
    device: authority.device,
    sphParticleUpload: nextSphParticleUpload,
    mlsMpmParticleUpload: nextMlsMpmParticleUpload
  });
  if (
    authority.sourceBuffers.identityBuffer != null
    && nextSourceBuffers.identityBuffer == null
  ) {
    throw transactionError(
      'Spatial epoch commit cannot drop the explicit particle identity buffer',
      'ERR_SCHROEDER_SPATIAL_EPOCH_COMMIT_BUFFER_FAMILY'
    );
  }
  transition(
    authority,
    [SCHROEDER_SPATIAL_EPOCH_TRANSACTION_STATE.PROPOSALS_SEALED],
    SCHROEDER_SPATIAL_EPOCH_TRANSACTION_STATE.COMMITTED
  );
  authority.commit = Object.freeze({
    status,
    nextStateBuffer: nextSourceBuffers.stateBuffer,
    nextThermoBuffer: nextSourceBuffers.thermoBuffer,
    nextIdentityBuffer: nextSourceBuffers.identityBuffer,
    nextMechanicsBuffer: nextSourceBuffers.mechanicsBuffer
  });
  authority.counters.commitCount += 1;
  return authority.commit;
}

export function scheduleSchroederSpatialEpochTransactionRelease(transaction, {
  after = null
} = {}) {
  const authority = authorityFor(transaction);
  const releaseEligibleStates = [
    SCHROEDER_SPATIAL_EPOCH_TRANSACTION_STATE.COMMITTED,
    SCHROEDER_SPATIAL_EPOCH_TRANSACTION_STATE.RELEASE_BLOCKED
  ];
  if (!releaseEligibleStates.includes(authority.state)) {
    transition(
      authority,
      releaseEligibleStates,
      SCHROEDER_SPATIAL_EPOCH_TRANSACTION_STATE.RELEASE_SCHEDULED
    );
  }
  if (!after || typeof after.then !== 'function') {
    throw transactionError(
      'Spatial epoch transaction release requires a generation-owner completion promise',
      'ERR_SCHROEDER_SPATIAL_EPOCH_RELEASE_FENCE'
    );
  }
  const retrying = authority.state
    === SCHROEDER_SPATIAL_EPOCH_TRANSACTION_STATE.RELEASE_BLOCKED;
  transition(
    authority,
    releaseEligibleStates,
    SCHROEDER_SPATIAL_EPOCH_TRANSACTION_STATE.RELEASE_SCHEDULED
  );
  authority.counters.releaseScheduleCount += 1;
  if (retrying) authority.counters.releaseRetryCount += 1;
  authority.releaseFailureReason = null;
  authority.releasePromise = Promise.resolve(after).then(
    (released) => {
      if (released !== true) {
        authority.releaseFailureReason =
          'generation owner did not confirm spatial epoch release';
        if (
          authority.state
          !== SCHROEDER_SPATIAL_EPOCH_TRANSACTION_STATE.ABORTED
        ) {
          authority.state =
            SCHROEDER_SPATIAL_EPOCH_TRANSACTION_STATE.RELEASE_BLOCKED;
        }
        return false;
      }
      authority.counters.releaseCount += 1;
      if (
        authority.state
        !== SCHROEDER_SPATIAL_EPOCH_TRANSACTION_STATE.ABORTED
      ) {
        authority.state = SCHROEDER_SPATIAL_EPOCH_TRANSACTION_STATE.RELEASED;
      }
      return true;
    },
    (error) => {
      authority.releaseFailureReason = error instanceof Error
        ? error.message
        : String(error);
      if (
        authority.state
        !== SCHROEDER_SPATIAL_EPOCH_TRANSACTION_STATE.ABORTED
      ) {
        authority.state =
          SCHROEDER_SPATIAL_EPOCH_TRANSACTION_STATE.RELEASE_BLOCKED;
      }
      throw error;
    }
  );
  return authority.releasePromise;
}

export function abortSchroederSpatialEpochTransaction(transaction, reason = null) {
  const authority = authorityFor(transaction);
  if (
    authority.state === SCHROEDER_SPATIAL_EPOCH_TRANSACTION_STATE.RELEASED
    || authority.state === SCHROEDER_SPATIAL_EPOCH_TRANSACTION_STATE.ABORTED
  ) return false;
  authority.state = SCHROEDER_SPATIAL_EPOCH_TRANSACTION_STATE.ABORTED;
  authority.abortReason = reason instanceof Error ? reason.message : (reason == null ? null : String(reason));
  return true;
}

export function summarizeSchroederSpatialEpochTransaction(transaction) {
  const authority = authorityFor(transaction);
  return Object.freeze({
    schema: ULG_SCHROEDER_SPATIAL_EPOCH_TRANSACTION_SUMMARY_SCHEMA,
    status: `schroeder-spatial-epoch-transaction-${authority.state}`,
    state: authority.state,
    generationId: authority.generationId,
    deviceId: authority.deviceId,
    epochIdentity: authority.epochIdentity,
    requiredReaderIds: Object.freeze([...authority.requiredReaders]),
    admittedReaders: Object.freeze([...authority.admittedReaders.values()]),
    proposalSeal: authority.proposalSeal,
    commitStatus: authority.commit?.status ?? null,
    nextStateBufferRetained: Boolean(authority.commit?.nextStateBuffer),
    abortReason: authority.abortReason,
    releaseFailureReason: authority.releaseFailureReason,
    legacyLookupRecords: Object.freeze([...authority.legacyLookupRecords]),
    counters: Object.freeze({ ...authority.counters })
  });
}
