import {
  webGpuBufferMatchesDevice,
  webGpuDeviceId
} from './sphGpuDeviceIdentity.js';
import {
  SCHROEDER_SPATIAL_SUPPORT_PROFILE_MATERIAL_INTERFACE_LOCAL_V1,
  SCHROEDER_SPATIAL_SUPPORT_PROFILE_PRESSURE_CONTACT_V1,
  SCHROEDER_SPATIAL_SUPPORT_PROFILE_RADIATION_WIDE_V1,
  SCHROEDER_SPATIAL_SUPPORT_PROFILE_REACTION_DISCOVERY_V1,
  SCHROEDER_SPATIAL_SUPPORT_PROFILE_SEPARATION_V1,
  SCHROEDER_SPATIAL_SUPPORT_PROFILE_THERMAL_CONDUCTION_V1,
  ULG_SCHROEDER_SPATIAL_EPOCH_CONSUMER_RECEIPT_SCHEMA
} from '../../../ulg-gpu-abi/src/schroederSpatialExactNear.js';
import {
  isFinalizedSchroederSpatialExactNearConsumerReceipt
} from './schroederSpatialEpochGpu.js';

export { ULG_SCHROEDER_SPATIAL_EPOCH_CONSUMER_RECEIPT_SCHEMA };

export const ULG_SCHROEDER_SPATIAL_EPOCH_TRANSACTION_SCHEMA =
  'peercompute.ulg.schroeder-spatial-epoch-transaction.v0';
export const ULG_SCHROEDER_SPATIAL_EPOCH_TRANSACTION_SUMMARY_SCHEMA =
  'peercompute.ulg.schroeder-spatial-epoch-transaction-summary.v0';

export const SCHROEDER_SPATIAL_EPOCH_CONSUMER_RECEIPT_STATUS =
  'schroeder-spatial-epoch-consumer-receipt-finalized';

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
  PRESSURE_CONTACT_INTERFACE: 'pressure-contact-interface',
  REACTION_DISCOVERY: 'reaction-discovery',
  SEPARATION: 'separation',
  THERMAL_CONDUCTION: 'thermal-conduction',
  THERMAL_RADIATION: 'thermal-radiation',
  LOCAL_MATERIAL_INTERFACE: 'local-material-interface',
  MECHANICS_P2G: 'mechanics-p2g',
  MECHANICS_G2P: 'mechanics-g2p'
});

export const SCHROEDER_SPATIAL_EPOCH_READER_PHASE = Object.freeze({
  PRESSURE_CONTACT_PROPOSAL: 'pressure-contact-proposal',
  REACTION_DISCOVERY_PROPOSAL: 'reaction-discovery-proposal',
  SEPARATION_PROPOSAL: 'separation-proposal',
  THERMAL_CONDUCTION_PROPOSAL: 'thermal-conduction-proposal',
  THERMAL_RADIATION_PROPOSAL: 'thermal-radiation-proposal',
  LOCAL_MATERIAL_INTERFACE_PROPOSAL: 'local-material-interface-proposal',
  PRE_INTEGRATION: 'pre-integration',
  INTEGRATION_COMMIT: 'integration-commit'
});

export const SCHROEDER_SPATIAL_EPOCH_CONSUMER_ARTIFACT_FAMILY = Object.freeze({
  PRESSURE_CONTACT_INTERFACE: 'spatial-exact-near-pressure-contact-interface',
  REACTION_DISCOVERY: 'spatial-exact-near-reaction-discovery',
  SEPARATION: 'spatial-exact-near-separation',
  THERMAL_CONDUCTION: 'spatial-exact-near-thermal-conduction',
  THERMAL_RADIATION: 'spatial-exact-near-thermal-radiation',
  LOCAL_MATERIAL_INTERFACE: 'spatial-exact-near-local-material-interface'
});

export const SCHROEDER_SPATIAL_EPOCH_SUPPORT_PROFILE_ID = Object.freeze({
  PRESSURE_CONTACT_INTERFACE: SCHROEDER_SPATIAL_SUPPORT_PROFILE_PRESSURE_CONTACT_V1,
  REACTION_DISCOVERY: SCHROEDER_SPATIAL_SUPPORT_PROFILE_REACTION_DISCOVERY_V1,
  SEPARATION: SCHROEDER_SPATIAL_SUPPORT_PROFILE_SEPARATION_V1,
  THERMAL_CONDUCTION: SCHROEDER_SPATIAL_SUPPORT_PROFILE_THERMAL_CONDUCTION_V1,
  THERMAL_RADIATION: SCHROEDER_SPATIAL_SUPPORT_PROFILE_RADIATION_WIDE_V1,
  LOCAL_MATERIAL_INTERFACE:
    SCHROEDER_SPATIAL_SUPPORT_PROFILE_MATERIAL_INTERFACE_LOCAL_V1
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
  [SCHROEDER_SPATIAL_EPOCH_READER.PRESSURE_CONTACT_INTERFACE]:
    SCHROEDER_SPATIAL_EPOCH_READER_PHASE.PRESSURE_CONTACT_PROPOSAL,
  [SCHROEDER_SPATIAL_EPOCH_READER.REACTION_DISCOVERY]:
    SCHROEDER_SPATIAL_EPOCH_READER_PHASE.REACTION_DISCOVERY_PROPOSAL,
  [SCHROEDER_SPATIAL_EPOCH_READER.SEPARATION]:
    SCHROEDER_SPATIAL_EPOCH_READER_PHASE.SEPARATION_PROPOSAL,
  [SCHROEDER_SPATIAL_EPOCH_READER.THERMAL_CONDUCTION]:
    SCHROEDER_SPATIAL_EPOCH_READER_PHASE.THERMAL_CONDUCTION_PROPOSAL,
  [SCHROEDER_SPATIAL_EPOCH_READER.THERMAL_RADIATION]:
    SCHROEDER_SPATIAL_EPOCH_READER_PHASE.THERMAL_RADIATION_PROPOSAL,
  [SCHROEDER_SPATIAL_EPOCH_READER.LOCAL_MATERIAL_INTERFACE]:
    SCHROEDER_SPATIAL_EPOCH_READER_PHASE.LOCAL_MATERIAL_INTERFACE_PROPOSAL,
  [SCHROEDER_SPATIAL_EPOCH_READER.MECHANICS_P2G]:
    SCHROEDER_SPATIAL_EPOCH_READER_PHASE.PRE_INTEGRATION,
  [SCHROEDER_SPATIAL_EPOCH_READER.MECHANICS_G2P]:
    SCHROEDER_SPATIAL_EPOCH_READER_PHASE.INTEGRATION_COMMIT
});

const EXACT_NEAR_CONSUMER_READERS = Object.freeze([
  SCHROEDER_SPATIAL_EPOCH_READER.PRESSURE_CONTACT_INTERFACE,
  SCHROEDER_SPATIAL_EPOCH_READER.REACTION_DISCOVERY,
  SCHROEDER_SPATIAL_EPOCH_READER.SEPARATION,
  SCHROEDER_SPATIAL_EPOCH_READER.THERMAL_CONDUCTION,
  SCHROEDER_SPATIAL_EPOCH_READER.THERMAL_RADIATION,
  SCHROEDER_SPATIAL_EPOCH_READER.LOCAL_MATERIAL_INTERFACE
]);

const EXACT_NEAR_CONSUMER_READER_SET = new Set(EXACT_NEAR_CONSUMER_READERS);

const CONSUMER_ARTIFACT_FAMILY_BY_READER = Object.freeze({
  [SCHROEDER_SPATIAL_EPOCH_READER.PRESSURE_CONTACT_INTERFACE]:
    SCHROEDER_SPATIAL_EPOCH_CONSUMER_ARTIFACT_FAMILY.PRESSURE_CONTACT_INTERFACE,
  [SCHROEDER_SPATIAL_EPOCH_READER.REACTION_DISCOVERY]:
    SCHROEDER_SPATIAL_EPOCH_CONSUMER_ARTIFACT_FAMILY.REACTION_DISCOVERY,
  [SCHROEDER_SPATIAL_EPOCH_READER.SEPARATION]:
    SCHROEDER_SPATIAL_EPOCH_CONSUMER_ARTIFACT_FAMILY.SEPARATION,
  [SCHROEDER_SPATIAL_EPOCH_READER.THERMAL_CONDUCTION]:
    SCHROEDER_SPATIAL_EPOCH_CONSUMER_ARTIFACT_FAMILY.THERMAL_CONDUCTION,
  [SCHROEDER_SPATIAL_EPOCH_READER.THERMAL_RADIATION]:
    SCHROEDER_SPATIAL_EPOCH_CONSUMER_ARTIFACT_FAMILY.THERMAL_RADIATION,
  [SCHROEDER_SPATIAL_EPOCH_READER.LOCAL_MATERIAL_INTERFACE]:
    SCHROEDER_SPATIAL_EPOCH_CONSUMER_ARTIFACT_FAMILY.LOCAL_MATERIAL_INTERFACE
});

const READER_ORDER_RANK = Object.freeze({
  // The legacy pressure reader and its physical replacement are mutually
  // exclusive alternatives at the first ordered reader slot.
  [SCHROEDER_SPATIAL_EPOCH_READER.PRESSURE_INTERFACE]: 0,
  [SCHROEDER_SPATIAL_EPOCH_READER.PRESSURE_CONTACT_INTERFACE]: 0,
  [SCHROEDER_SPATIAL_EPOCH_READER.REACTION_DISCOVERY]: 1,
  [SCHROEDER_SPATIAL_EPOCH_READER.SEPARATION]: 2,
  [SCHROEDER_SPATIAL_EPOCH_READER.THERMAL_CONDUCTION]: 3,
  [SCHROEDER_SPATIAL_EPOCH_READER.THERMAL_RADIATION]: 4,
  [SCHROEDER_SPATIAL_EPOCH_READER.LOCAL_MATERIAL_INTERFACE]: 5,
  [SCHROEDER_SPATIAL_EPOCH_READER.MECHANICS_P2G]: 6,
  [SCHROEDER_SPATIAL_EPOCH_READER.MECHANICS_G2P]: 7
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
    || (source?.sourceBuffer ?? source?.activeNodeBuffer) !== snapshot.sourceBuffer
    || (execution?.sourceBuffer ?? execution?.activeNodeBuffer) !== snapshot.sourceBuffer
    || execution?.directoryBuffer !== snapshot.directoryBuffer
    || !webGpuBufferMatchesDevice(snapshot.sourceBuffer, authority.device)
    || !webGpuBufferMatchesDevice(snapshot.directoryBuffer, authority.device)
    || (snapshot.mechanicsView && (
      generation?.mechanicsView !== snapshot.mechanicsView
      || generation?.mechanicsViewRuntime !== snapshot.mechanicsViewRuntime
      || generation.mechanicsView?.mechanicsViewBuffer
        !== snapshot.mechanicsViewBuffer
      || generation.mechanicsView?.submitPerformed !== true
      || !webGpuBufferMatchesDevice(snapshot.mechanicsViewBuffer, authority.device)
    ))
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
  const rank = READER_ORDER_RANK[readerId];
  if (!Number.isInteger(rank)) return false;
  if (
    readerId === SCHROEDER_SPATIAL_EPOCH_READER.MECHANICS_G2P
    && !authority.admittedReaders.has(
      SCHROEDER_SPATIAL_EPOCH_READER.MECHANICS_P2G
    )
  ) return false;
  for (const admittedReaderId of authority.admittedReaders.keys()) {
    const admittedRank = READER_ORDER_RANK[admittedReaderId];
    if (!Number.isInteger(admittedRank) || admittedRank >= rank) return false;
  }
  return true;
}

function exactPositiveSupportProfileId(value, label) {
  return exactU32(value, label, { positive: true });
}

function consumerSupportProfileEntries(value) {
  if (value == null) return [];
  if (value instanceof Map) return [...value.entries()];
  if (typeof value === 'object' && !Array.isArray(value)) {
    return Object.entries(value);
  }
  throw transactionError(
    'consumerSupportProfileIds must be an object or Map keyed by consumer reader id',
    'ERR_SCHROEDER_SPATIAL_EPOCH_READER_CONTRACT'
  );
}

function exactReceiptU32(receipt, field) {
  try {
    return exactU32(receipt?.[field], `consumerReceipt.${field}`);
  } catch {
    throw transactionError(
      `Spatial epoch consumer receipt ${field} must be an exact u32`,
      'ERR_SCHROEDER_SPATIAL_EPOCH_CONSUMER_RECEIPT'
    );
  }
}

function validateConsumerReceipt(authority, readerId, phase, receipt) {
  const supportProfileId = authority.consumerSupportProfileIds.get(readerId);
  const artifactFamily = CONSUMER_ARTIFACT_FAMILY_BY_READER[readerId];
  if (
    !receipt
    || typeof receipt !== 'object'
    || !Object.isFrozen(receipt)
    || receipt.schema !== ULG_SCHROEDER_SPATIAL_EPOCH_CONSUMER_RECEIPT_SCHEMA
    || receipt.status !== SCHROEDER_SPATIAL_EPOCH_CONSUMER_RECEIPT_STATUS
    || receipt.authenticated !== true
    || receipt.gpuAuthenticated !== true
    || receipt.submitPerformed !== true
    || receipt.generationBound !== true
    || receipt.consumerId !== readerId
    || receipt.phase !== phase
    || receipt.artifactFamily !== artifactFamily
  ) {
    throw transactionError(
      `Spatial epoch consumer ${readerId} lacks a finalized authenticated GPU receipt`,
      'ERR_SCHROEDER_SPATIAL_EPOCH_CONSUMER_RECEIPT'
    );
  }
  let receiptSupportProfileId;
  try {
    receiptSupportProfileId = exactPositiveSupportProfileId(
      receipt.supportProfileId,
      'consumerReceipt.supportProfileId'
    );
  } catch {
    throw transactionError(
      `Spatial epoch consumer ${readerId} supplied an invalid support profile id`,
      'ERR_SCHROEDER_SPATIAL_EPOCH_CONSUMER_RECEIPT_IDENTITY'
    );
  }
  if (
    receiptSupportProfileId !== supportProfileId
    || receipt.deviceId !== authority.deviceId
    || receipt.generationId !== authority.generationId
  ) {
    throw transactionError(
      `Spatial epoch consumer ${readerId} receipt does not identify its declared support profile, device, and generation`,
      'ERR_SCHROEDER_SPATIAL_EPOCH_CONSUMER_RECEIPT_IDENTITY'
    );
  }
  if (
    !receipt.epochIdentity
    || typeof receipt.epochIdentity !== 'object'
    || !Object.isFrozen(receipt.epochIdentity)
  ) {
    throw transactionError(
      `Spatial epoch consumer ${readerId} receipt lacks the complete epoch identity`,
      'ERR_SCHROEDER_SPATIAL_EPOCH_CONSUMER_RECEIPT_IDENTITY'
    );
  }
  for (const field of EPOCH_FIELDS) {
    let actual;
    try {
      actual = exactU32(
        receipt.epochIdentity[field],
        `consumerReceipt.epochIdentity.${field}`,
        { positive: field === 'storageGeneration' }
      );
    } catch {
      throw transactionError(
        `Spatial epoch consumer ${readerId} receipt has an invalid ${field}`,
        'ERR_SCHROEDER_SPATIAL_EPOCH_CONSUMER_RECEIPT_IDENTITY'
      );
    }
    if (actual !== authority.epochIdentity[field]) {
      throw transactionError(
        `Spatial epoch consumer ${readerId} receipt has a stale ${field}`,
        'ERR_SCHROEDER_SPATIAL_EPOCH_CONSUMER_RECEIPT_IDENTITY'
      );
    }
  }
  const counts = Object.freeze({
    traversalCount: exactReceiptU32(receipt, 'traversalCount'),
    candidateVisitCount: exactReceiptU32(receipt, 'candidateVisitCount'),
    consumerMaskHitCount: exactReceiptU32(receipt, 'consumerMaskHitCount'),
    migratedProposalCount: exactReceiptU32(receipt, 'migratedProposalCount'),
    candidateBytesRequired: exactReceiptU32(receipt, 'candidateBytesRequired'),
    candidateBytesAdmitted: exactReceiptU32(receipt, 'candidateBytesAdmitted'),
    candidateBytesCapacity: exactReceiptU32(receipt, 'candidateBytesCapacity'),
    candidateOverflowBytes: exactReceiptU32(receipt, 'candidateOverflowBytes'),
    privateLookupBuildCount: exactReceiptU32(receipt, 'privateLookupBuildCount'),
    fixedCandidateBuildCount: exactReceiptU32(receipt, 'fixedCandidateBuildCount'),
    exhaustiveTraversalCount: exactReceiptU32(receipt, 'exhaustiveTraversalCount')
  });
  if (counts.traversalCount !== 1) {
    throw transactionError(
      `Spatial epoch consumer ${readerId} must authenticate exactly one traversal`,
      'ERR_SCHROEDER_SPATIAL_EPOCH_CONSUMER_RECEIPT'
    );
  }
  if (
    counts.privateLookupBuildCount !== 0
    || counts.fixedCandidateBuildCount !== 0
    || counts.exhaustiveTraversalCount !== 0
    || receipt.fallbackObserved !== false
    || receipt.fullReadbackPerformed !== false
  ) {
    throw transactionError(
      `Spatial epoch consumer ${readerId} attempted a private, fixed-budget, exhaustive, fallback, or readback path`,
      'ERR_SCHROEDER_SPATIAL_EPOCH_CONSUMER_FALLBACK'
    );
  }
  if (
    counts.candidateOverflowBytes !== 0
    || counts.candidateBytesRequired > counts.candidateBytesCapacity
    || counts.candidateBytesAdmitted !== counts.candidateBytesRequired
    || counts.candidateBytesAdmitted > counts.candidateBytesCapacity
    || receipt.overflowed !== false
    || receipt.partialPublication !== false
  ) {
    throw transactionError(
      `Spatial epoch consumer ${readerId} reported overflow or partial publication`,
      'ERR_SCHROEDER_SPATIAL_EPOCH_CONSUMER_OVERFLOW'
    );
  }
  if (!isFinalizedSchroederSpatialExactNearConsumerReceipt(receipt)) {
    throw transactionError(
      `Spatial epoch consumer ${readerId} receipt was not issued by the live generation runtime`,
      'ERR_SCHROEDER_SPATIAL_EPOCH_CONSUMER_RECEIPT'
    );
  }
  return Object.freeze({
    schema: ULG_SCHROEDER_SPATIAL_EPOCH_CONSUMER_RECEIPT_SCHEMA,
    status: SCHROEDER_SPATIAL_EPOCH_CONSUMER_RECEIPT_STATUS,
    authenticated: true,
    gpuAuthenticated: true,
    submitPerformed: true,
    generationBound: true,
    consumerId: readerId,
    phase,
    supportProfileId,
    artifactFamily,
    deviceId: authority.deviceId,
    generationId: authority.generationId,
    epochIdentity: Object.freeze({ ...authority.epochIdentity }),
    ...counts,
    overflowed: false,
    partialPublication: false,
    fallbackObserved: false,
    fullReadbackPerformed: false
  });
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

function rejectConsumerReceipt(authority, readerId, error) {
  authority.counters.consumerReceiptRejectCount += 1;
  if (error?.code === 'ERR_SCHROEDER_SPATIAL_EPOCH_CONSUMER_RECEIPT_IDENTITY') {
    authority.counters.consumerReceiptIdentityRejectCount += 1;
  }
  if (error?.code === 'ERR_SCHROEDER_SPATIAL_EPOCH_CONSUMER_OVERFLOW') {
    authority.counters.consumerReceiptOverflowRejectCount += 1;
  }
  if (error?.code === 'ERR_SCHROEDER_SPATIAL_EPOCH_CONSUMER_FALLBACK') {
    authority.counters.consumerReceiptFallbackRejectCount += 1;
  }
  rejectReader(
    authority,
    error instanceof Error
      ? error.message
      : `Spatial epoch consumer ${readerId} receipt was rejected`,
    error?.code || 'ERR_SCHROEDER_SPATIAL_EPOCH_CONSUMER_RECEIPT'
  );
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
  requiredReaderIds = DEFAULT_REQUIRED_READERS,
  enabledConsumerReaderIds = [],
  consumerSupportProfileIds = {}
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
  const spatialSourceBuffer = source.sourceBuffer ?? source.activeNodeBuffer ?? null;
  const executionSourceBuffer = execution.sourceBuffer ?? execution.activeNodeBuffer ?? null;
  if (
    spatialSourceBuffer !== executionSourceBuffer
    || !webGpuBufferMatchesDevice(spatialSourceBuffer, device)
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
  if (!Array.isArray(requiredReaderIds) || !Array.isArray(enabledConsumerReaderIds)) {
    throw transactionError(
      'requiredReaderIds and enabledConsumerReaderIds must be arrays',
      'ERR_SCHROEDER_SPATIAL_EPOCH_READER_CONTRACT'
    );
  }
  const requiredReaders = new Set([
    ...requiredReaderIds,
    ...enabledConsumerReaderIds
  ]);
  for (const readerId of requiredReaders) {
    if (!READER_PHASES[readerId]) {
      throw transactionError(
        `Unknown required spatial epoch reader ${readerId}`,
        'ERR_SCHROEDER_SPATIAL_EPOCH_READER_CONTRACT'
      );
    }
  }
  const enabledConsumerReaders = new Set(
    [...requiredReaders].filter((readerId) => EXACT_NEAR_CONSUMER_READER_SET.has(readerId))
  );
  for (const readerId of enabledConsumerReaderIds) {
    if (!EXACT_NEAR_CONSUMER_READER_SET.has(readerId)) {
      throw transactionError(
        `Enabled spatial epoch consumer ${readerId} is not an exact-near consumer reader`,
        'ERR_SCHROEDER_SPATIAL_EPOCH_READER_CONTRACT'
      );
    }
  }
  const resolvedSupportProfileIds = new Map();
  for (const [readerId, supportProfileId] of consumerSupportProfileEntries(
    consumerSupportProfileIds
  )) {
    if (!EXACT_NEAR_CONSUMER_READER_SET.has(readerId)) {
      throw transactionError(
        `Unknown spatial epoch consumer support profile ${readerId}`,
        'ERR_SCHROEDER_SPATIAL_EPOCH_READER_CONTRACT'
      );
    }
    if (!enabledConsumerReaders.has(readerId)) {
      throw transactionError(
        `Disabled spatial epoch consumer ${readerId} cannot declare a support profile`,
        'ERR_SCHROEDER_SPATIAL_EPOCH_CONSUMER_DISABLED'
      );
    }
    resolvedSupportProfileIds.set(
      readerId,
      exactPositiveSupportProfileId(
        supportProfileId,
        `consumerSupportProfileIds.${readerId}`
      )
    );
  }
  const missingSupportProfiles = [...enabledConsumerReaders].filter(
    (readerId) => !resolvedSupportProfileIds.has(readerId)
  );
  if (missingSupportProfiles.length > 0) {
    throw transactionError(
      `Enabled spatial epoch consumers lack support profiles: ${missingSupportProfiles.join(', ')}`,
      'ERR_SCHROEDER_SPATIAL_EPOCH_READER_CONTRACT'
    );
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
      sourceBuffer: spatialSourceBuffer,
      directoryBuffer: execution.directoryBuffer,
      mechanicsView: generation.mechanicsView ?? null,
      mechanicsViewRuntime: generation.mechanicsViewRuntime ?? null,
      mechanicsViewBuffer: generation.mechanicsView?.mechanicsViewBuffer ?? null,
      generationId,
      buildOrdinal,
      sortUniqueOrdinal,
      epochIdentity: Object.freeze({ ...epochIdentity })
    }),
    sourceBuffers,
    requiredReaders,
    enabledConsumerReaders,
    consumerSupportProfileIds: resolvedSupportProfileIds,
    admittedReaders: new Map(),
    consumerReceipts: new Map(),
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
  mlsMpmParticleUpload,
  consumerReceipt = null
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
  const isExactNearConsumer = EXACT_NEAR_CONSUMER_READER_SET.has(readerId);
  if (isExactNearConsumer && !authority.enabledConsumerReaders.has(readerId)) {
    authority.counters.consumerDisabledRejectCount += 1;
    rejectReader(
      authority,
      `Spatial epoch consumer ${readerId} is disabled for this transaction`,
      'ERR_SCHROEDER_SPATIAL_EPOCH_CONSUMER_DISABLED'
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
      `Spatial epoch reader ${readerId} violated the declared consumer -> P2G -> G2P submission order`,
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
  let authenticatedReceipt = null;
  if (isExactNearConsumer) {
    try {
      authenticatedReceipt = validateConsumerReceipt(
        authority,
        readerId,
        phase,
        consumerReceipt
      );
    } catch (error) {
      rejectConsumerReceipt(authority, readerId, error);
    }
  }
  authority.admittedReaders.set(readerId, Object.freeze({
    readerId,
    phase,
    supportProfileId: authenticatedReceipt?.supportProfileId ?? null,
    artifactFamily: authenticatedReceipt?.artifactFamily ?? null,
    authenticatedReceipt: Boolean(authenticatedReceipt)
  }));
  if (authenticatedReceipt) {
    authority.consumerReceipts.set(readerId, authenticatedReceipt);
    authority.counters.consumerReceiptAdmissionCount += 1;
    authority.counters.authenticatedConsumerTraversalCount +=
      authenticatedReceipt.traversalCount;
    authority.counters.authenticatedCandidateVisitCount +=
      authenticatedReceipt.candidateVisitCount;
    authority.counters.authenticatedConsumerMaskHitCount +=
      authenticatedReceipt.consumerMaskHitCount;
    authority.counters.authenticatedMigratedProposalCount +=
      authenticatedReceipt.migratedProposalCount;
    authority.counters.authenticatedCandidateBytesRequired +=
      authenticatedReceipt.candidateBytesRequired;
    authority.counters.authenticatedCandidateBytesAdmitted +=
      authenticatedReceipt.candidateBytesAdmitted;
    authority.counters.authenticatedCandidateBytesCapacity +=
      authenticatedReceipt.candidateBytesCapacity;
  }
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
  if (
    authority.enabledConsumerReaders.has(consumerId)
    && (schroederLawQueue || schroederLawNeighborCandidates)
  ) {
    authority.counters.consumerReceiptFallbackRejectCount += 1;
    throw transactionError(
      `Migrated spatial epoch consumer ${consumerId} cannot receive quarantined legacy law inputs`,
      'ERR_SCHROEDER_SPATIAL_EPOCH_CONSUMER_FALLBACK'
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
  if (
    authority.enabledConsumerReaders.has(consumerId)
    && (resolvedPrivateBuildCount > 0 || resolvedExhaustiveTraversalCount > 0)
  ) {
    authority.counters.consumerReceiptFallbackRejectCount += 1;
    throw transactionError(
      `Migrated spatial epoch consumer ${consumerId} cannot record private or exhaustive lookup work`,
      'ERR_SCHROEDER_SPATIAL_EPOCH_CONSUMER_FALLBACK'
    );
  }
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
  migratedProposalCount = null,
  legacyConsumerCount = 0,
  status = null
} = {}) {
  const authority = authorityFor(transaction);
  if (authority.state !== SCHROEDER_SPATIAL_EPOCH_TRANSACTION_STATE.READERS_COMPLETE) {
    throw transactionError(
      `Spatial epoch transaction cannot transition from ${authority.state} to ${SCHROEDER_SPATIAL_EPOCH_TRANSACTION_STATE.PROPOSALS_SEALED}`,
      'ERR_SCHROEDER_SPATIAL_EPOCH_TRANSACTION_STATE'
    );
  }
  const authenticatedMigratedProposalCount =
    authority.counters.authenticatedMigratedProposalCount;
  const resolvedMigratedProposalCount = migratedProposalCount == null
    ? authenticatedMigratedProposalCount
    : exactU32(migratedProposalCount, 'migratedProposalCount');
  const resolvedLegacyConsumerCount = exactU32(
    legacyConsumerCount,
    'legacyConsumerCount'
  );
  if (resolvedMigratedProposalCount !== authenticatedMigratedProposalCount) {
    throw transactionError(
      'Spatial epoch proposal seal does not match authenticated consumer proposal receipts',
      'ERR_SCHROEDER_SPATIAL_EPOCH_PROPOSAL_RECEIPT_MISMATCH'
    );
  }
  transition(
    authority,
    [SCHROEDER_SPATIAL_EPOCH_TRANSACTION_STATE.READERS_COMPLETE],
    SCHROEDER_SPATIAL_EPOCH_TRANSACTION_STATE.PROPOSALS_SEALED
  );
  authority.proposalSeal = Object.freeze({
    status: status ?? (authority.consumerReceipts.size > 0
      ? 'authenticated-spatial-consumer-proposals-sealed'
      : 'unmigrated-laws-quarantined'),
    migratedProposalCount: resolvedMigratedProposalCount,
    legacyConsumerCount: resolvedLegacyConsumerCount,
    authenticatedConsumerCount: authority.consumerReceipts.size,
    authenticatedTraversalCount:
      authority.counters.authenticatedConsumerTraversalCount,
    candidateVisitCount: authority.counters.authenticatedCandidateVisitCount,
    consumerMaskHitCount: authority.counters.authenticatedConsumerMaskHitCount
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
    enabledConsumerReaderIds: Object.freeze([...authority.enabledConsumerReaders]),
    consumerSupportProfileIds: Object.freeze(Object.fromEntries(
      authority.consumerSupportProfileIds
    )),
    admittedReaders: Object.freeze([...authority.admittedReaders.values()]),
    consumerReceipts: Object.freeze([...authority.consumerReceipts.values()]),
    proposalSeal: authority.proposalSeal,
    commitStatus: authority.commit?.status ?? null,
    nextStateBufferRetained: Boolean(authority.commit?.nextStateBuffer),
    abortReason: authority.abortReason,
    releaseFailureReason: authority.releaseFailureReason,
    legacyLookupRecords: Object.freeze([...authority.legacyLookupRecords]),
    counters: Object.freeze({ ...authority.counters })
  });
}
