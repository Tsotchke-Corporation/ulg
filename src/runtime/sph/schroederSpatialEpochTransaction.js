import {
  webGpuBufferMatchesDevice,
  webGpuDeviceId
} from './sphGpuDeviceIdentity.js';
import {
  SCHROEDER_SPATIAL_SUPPORT_PROFILE_MATERIAL_INTERFACE_LOCAL_V1,
  SCHROEDER_SPATIAL_SUPPORT_PROFILE_PRESSURE_CONTACT_V1,
  SCHROEDER_SPATIAL_SUPPORT_PROFILE_RADIATION_WIDE_V1,
  SCHROEDER_SPATIAL_SUPPORT_PROFILE_REACTION_DISCOVERY_V1,
  SCHROEDER_SPATIAL_SUPPORT_PROFILE_REACTION_PRODUCT_PLACEMENT_V1,
  SCHROEDER_SPATIAL_SUPPORT_PROFILE_SEPARATION_V1,
  SCHROEDER_SPATIAL_SUPPORT_PROFILE_THERMAL_CONDUCTION_V1,
  ULG_SCHROEDER_SPATIAL_EPOCH_CONSUMER_RECEIPT_SCHEMA
} from '../../../ulg-gpu-abi/src/schroederSpatialExactNear.js';
import {
  validateSchroederSpatialMechanicsViewDescriptor
} from '../../../ulg-gpu-abi/src/schroederSpatialMechanicsView.js';
import {
  validateSchroederSpatialMechanicsFieldViewDescriptor
} from '../../../ulg-gpu-abi/src/schroederSpatialMechanicsFieldView.js';
import {
  validateSchroederSpatialPhaseVolumeMomentDescriptor
} from '../../../ulg-gpu-abi/src/schroederSpatialPhaseVolumeMoment.js';
import {
  validateSchroederSpatialPhaseVolumeReceiptDescriptor
} from '../../../ulg-gpu-abi/src/schroederSpatialPhaseVolumeReceipt.js';
import {
  SCHROEDER_SPATIAL_PHASE_VOLUME_INTERFACE_REFLUX_ROUTE_WORDS,
  validateSchroederSpatialPhaseVolumeInterfaceProposalDescriptor
} from '../../../ulg-gpu-abi/src/schroederSpatialPhaseVolumeInterfaceProposal.js';
import {
  SCHROEDER_SPATIAL_HIERARCHY_VIEW_DISPATCH_OFFSET_WORDS,
  SCHROEDER_SPATIAL_HIERARCHY_VIEW_FINE_DISPATCH_OFFSET_WORDS,
  validateSchroederSpatialHierarchyViewDescriptor
} from '../../../ulg-gpu-abi/src/schroederSpatialHierarchyView.js';
import {
  validateSchroederSpatialParentFieldViewDescriptor
} from '../../../ulg-gpu-abi/src/schroederSpatialParentFieldView.js';
import {
  SCHROEDER_SPATIAL_AGGREGATE_CONSUMER_ARTIFACT_FAMILY,
  SCHROEDER_SPATIAL_AGGREGATE_CONSUMER_ID,
  SCHROEDER_SPATIAL_AGGREGATE_CONSUMER_PHASE,
  SCHROEDER_SPATIAL_AGGREGATE_LEVEL_ASSIGNMENT_QUERY_FLOATS,
  SCHROEDER_SPATIAL_AGGREGATE_TRAVERSAL_QUERY_SOURCE_LAYOUT,
  SCHROEDER_SPATIAL_AGGREGATE_TRAVERSAL_SUMMARY_WORDS,
  ULG_SCHROEDER_SPATIAL_AGGREGATE_TRAVERSAL_SUBMISSION_RECEIPT_SCHEMA,
  validateSchroederSpatialAggregateViewDescriptor
} from '../../../ulg-gpu-abi/src/schroederSpatialAggregateView.js';
import {
  validateSchroederSpatialActiveRankViewDescriptor
} from '../../../ulg-gpu-abi/src/schroederSpatialActiveRankView.js';
import {
  validateSchroederSpatialActiveSourceViewDescriptor
} from '../../../ulg-gpu-abi/src/schroederSpatialActiveSourceView.js';
import {
  SCHROEDER_SPATIAL_EPOCH_V2_ACTIVE_COUNT_AUTHORITY_WORD,
  SCHROEDER_SPATIAL_EPOCH_V2_VERSION
} from '../../../ulg-gpu-abi/src/schroederSpatialEpoch.js';
import {
  isFinalizedSchroederSpatialExactNearConsumerReceipt,
  isSchroederSpatialExactNearResidentConsumerBinding
} from './schroederSpatialEpochGpu.js';
import {
  isFinalizedSchroederSpatialAggregateTraversalSubmissionReceipt
} from './schroederSpatialAggregateTraversalGpu.js';

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
  PRIVATE_ADVANCED: 'private-advanced',
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
  REACTION_PRODUCT_PLACEMENT: 'reaction-product-placement',
  SEPARATION: 'separation',
  THERMAL_CONDUCTION: 'thermal-conduction',
  THERMAL_RADIATION: 'thermal-radiation',
  LOCAL_MATERIAL_INTERFACE: 'local-material-interface',
  MECHANICS_P2G: 'mechanics-p2g',
  MECHANICS_G2P: 'mechanics-g2p',
  FAR_AGGREGATE: SCHROEDER_SPATIAL_AGGREGATE_CONSUMER_ID
});

export const SCHROEDER_SPATIAL_EPOCH_READER_PHASE = Object.freeze({
  PRESSURE_CONTACT_PROPOSAL: 'pressure-contact-proposal',
  REACTION_DISCOVERY_PROPOSAL: 'reaction-discovery-proposal',
  REACTION_PRODUCT_PLACEMENT_PROPOSAL:
    'reaction-product-placement-proposal',
  SEPARATION_PROPOSAL: 'separation-proposal',
  THERMAL_CONDUCTION_PROPOSAL: 'thermal-conduction-proposal',
  THERMAL_RADIATION_PROPOSAL: 'thermal-radiation-proposal',
  LOCAL_MATERIAL_INTERFACE_PROPOSAL: 'local-material-interface-proposal',
  PRE_INTEGRATION: 'pre-integration',
  INTEGRATION_COMMIT: 'integration-commit',
  POST_MECHANICS_FAR_AGGREGATE:
    SCHROEDER_SPATIAL_AGGREGATE_CONSUMER_PHASE
});

export const SCHROEDER_SPATIAL_EPOCH_CONSUMER_ARTIFACT_FAMILY = Object.freeze({
  PRESSURE_CONTACT_INTERFACE: 'spatial-exact-near-pressure-contact-interface',
  REACTION_DISCOVERY: 'spatial-exact-near-reaction-discovery',
  REACTION_PRODUCT_PLACEMENT:
    'spatial-exact-near-reaction-product-placement',
  SEPARATION: 'spatial-exact-near-separation',
  THERMAL_CONDUCTION: 'spatial-exact-near-thermal-conduction',
  THERMAL_RADIATION: 'spatial-exact-near-thermal-radiation',
  LOCAL_MATERIAL_INTERFACE: 'spatial-exact-near-local-material-interface',
  FAR_AGGREGATE: SCHROEDER_SPATIAL_AGGREGATE_CONSUMER_ARTIFACT_FAMILY
});

export const SCHROEDER_SPATIAL_EPOCH_SUPPORT_PROFILE_ID = Object.freeze({
  PRESSURE_CONTACT_INTERFACE: SCHROEDER_SPATIAL_SUPPORT_PROFILE_PRESSURE_CONTACT_V1,
  REACTION_DISCOVERY: SCHROEDER_SPATIAL_SUPPORT_PROFILE_REACTION_DISCOVERY_V1,
  REACTION_PRODUCT_PLACEMENT:
    SCHROEDER_SPATIAL_SUPPORT_PROFILE_REACTION_PRODUCT_PLACEMENT_V1,
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
  [SCHROEDER_SPATIAL_EPOCH_READER.REACTION_PRODUCT_PLACEMENT]:
    SCHROEDER_SPATIAL_EPOCH_READER_PHASE.REACTION_PRODUCT_PLACEMENT_PROPOSAL,
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
    SCHROEDER_SPATIAL_EPOCH_READER_PHASE.INTEGRATION_COMMIT,
  [SCHROEDER_SPATIAL_EPOCH_READER.FAR_AGGREGATE]:
    SCHROEDER_SPATIAL_EPOCH_READER_PHASE.POST_MECHANICS_FAR_AGGREGATE
});

const EXACT_NEAR_CONSUMER_READERS = Object.freeze([
  SCHROEDER_SPATIAL_EPOCH_READER.PRESSURE_CONTACT_INTERFACE,
  SCHROEDER_SPATIAL_EPOCH_READER.REACTION_DISCOVERY,
  SCHROEDER_SPATIAL_EPOCH_READER.REACTION_PRODUCT_PLACEMENT,
  SCHROEDER_SPATIAL_EPOCH_READER.SEPARATION,
  SCHROEDER_SPATIAL_EPOCH_READER.THERMAL_CONDUCTION,
  SCHROEDER_SPATIAL_EPOCH_READER.THERMAL_RADIATION,
  SCHROEDER_SPATIAL_EPOCH_READER.LOCAL_MATERIAL_INTERFACE
]);

const EXACT_NEAR_CONSUMER_READER_SET = new Set(EXACT_NEAR_CONSUMER_READERS);
const AUTHENTICATED_CONSUMER_READER_SET = new Set([
  ...EXACT_NEAR_CONSUMER_READERS,
  SCHROEDER_SPATIAL_EPOCH_READER.FAR_AGGREGATE
]);

const CONSUMER_ARTIFACT_FAMILY_BY_READER = Object.freeze({
  [SCHROEDER_SPATIAL_EPOCH_READER.PRESSURE_CONTACT_INTERFACE]:
    SCHROEDER_SPATIAL_EPOCH_CONSUMER_ARTIFACT_FAMILY.PRESSURE_CONTACT_INTERFACE,
  [SCHROEDER_SPATIAL_EPOCH_READER.REACTION_DISCOVERY]:
    SCHROEDER_SPATIAL_EPOCH_CONSUMER_ARTIFACT_FAMILY.REACTION_DISCOVERY,
  [SCHROEDER_SPATIAL_EPOCH_READER.REACTION_PRODUCT_PLACEMENT]:
    SCHROEDER_SPATIAL_EPOCH_CONSUMER_ARTIFACT_FAMILY.REACTION_PRODUCT_PLACEMENT,
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
  [SCHROEDER_SPATIAL_EPOCH_READER.SEPARATION]: 2,
  [SCHROEDER_SPATIAL_EPOCH_READER.THERMAL_CONDUCTION]: 3,
  [SCHROEDER_SPATIAL_EPOCH_READER.THERMAL_RADIATION]: 4,
  [SCHROEDER_SPATIAL_EPOCH_READER.LOCAL_MATERIAL_INTERFACE]: 5,
  [SCHROEDER_SPATIAL_EPOCH_READER.MECHANICS_P2G]: 6,
  [SCHROEDER_SPATIAL_EPOCH_READER.MECHANICS_G2P]: 7,
  [SCHROEDER_SPATIAL_EPOCH_READER.FAR_AGGREGATE]: 8,
  // Reaction discovery must observe the exact post-thermal state while still
  // querying the immutable E* directory. Product placement follows discovery
  // and reaction application, so both are explicit post-reader-seal consumers.
  [SCHROEDER_SPATIAL_EPOCH_READER.REACTION_DISCOVERY]: 9,
  [SCHROEDER_SPATIAL_EPOCH_READER.REACTION_PRODUCT_PLACEMENT]: 10
});

const LATE_CONSUMER_READER_SET = new Set([
  SCHROEDER_SPATIAL_EPOCH_READER.REACTION_DISCOVERY,
  SCHROEDER_SPATIAL_EPOCH_READER.REACTION_PRODUCT_PLACEMENT
]);

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

function runtimeOwnsSubmittedExecution(runtime, execution) {
  try {
    return runtime?.ownsExecution?.(execution) === true
      && runtime?.isExecutionSubmitted?.(execution) === true;
  } catch {
    return false;
  }
}

function activeSourceDescriptorExpectation({
  activeSourceView,
  execution,
  sourceBuffer
}) {
  return Object.freeze({
    sourceBuffer,
    activeSourceViewBuffer: activeSourceView.activeSourceViewBuffer,
    physicalSourceCount: execution.physicalSourceCount,
    physicalSourceCapacity: execution.physicalSourceCapacity,
    activeSourceCapacity: execution.activeSourceCapacity,
    sourceRowLayoutId: execution.sourceRowLayoutId,
    sourceRowStrideFloats: execution.sourceRowStrideFloats,
    generationId: execution.generationId,
    deviceOrdinal: execution.deviceOrdinal,
    laneOrdinal: execution.laneOrdinal,
    leaseToken: execution.leaseToken,
    sourceFamilyId: execution.sourceFamilyId,
    storageGeneration: execution.storageGeneration,
    physicsTick: execution.physicsTick,
    physicsSubstep: execution.physicsSubstep,
    positionEpoch: execution.positionEpoch,
    topologyEpoch: execution.topologyEpoch,
    chartEpoch: execution.chartEpoch,
    levelEpoch: execution.levelEpoch,
    supportEpoch: execution.supportEpoch,
    buildOrdinal: execution.buildOrdinal,
    sourceFingerprint: activeSourceView.sourceFingerprint,
    ownerRuntime: activeSourceView.ownerRuntime,
    executionSourceCount: execution.sourceCount,
    executionSourceFamily: execution.sourceFamily,
    executionAbiVersion: execution.abiVersion,
    sourceWorkIdentity: execution.sourceWorkIdentity,
    logicalSourceCountGpuAuthored: execution.logicalSourceCountGpuAuthored,
    queryGeometryMode: execution.queryGeometryMode,
    queryChartId: execution.queryChartId,
    queryMinLevel: execution.queryMinLevel,
    queryMaxLevel: execution.queryMaxLevel,
    queryBaseGridSpacingM: execution.queryBaseGridSpacingM,
    capacityTierOrdinal: activeSourceView.capacityTierOrdinal,
    activeDispatchOffsetBytes: activeSourceView.activeDispatchOffsetBytes,
    candidateDispatchOffsetBytes: activeSourceView.candidateDispatchOffsetBytes,
    physicalDispatchOffsetBytes: activeSourceView.physicalDispatchOffsetBytes
  });
}

function activeSourceViewMatchesSnapshot(snapshot, generation, device) {
  const execution = generation?.execution ?? null;
  const source = generation?.source ?? null;
  const activeSourceView = snapshot.activeSourceView;
  if (!snapshot.directoryV2) {
    return (generation?.activeSourceView ?? null) === null
      && (generation?.activeSourceViewRuntime ?? null) === null
      && (execution?.activeSourceView ?? null) === null
      && (execution?.activeSourceViewBuffer ?? null) === null
      && (execution?.activeSourceCountAuthority ?? null) === null;
  }
  const expected = snapshot.activeSourceDescriptorExpectation;
  const countAuthority = snapshot.activeSourceCountAuthority;
  if (
    !activeSourceView
    || !expected
    || !countAuthority
    || generation?.activeSourceView !== activeSourceView
    || generation?.activeSourceViewRuntime !== snapshot.activeSourceViewRuntime
    || execution?.activeSourceView !== activeSourceView
    || execution?.activeSourceViewBuffer !== snapshot.activeSourceViewBuffer
    || execution?.activeSourceCountAuthority !== countAuthority
    || execution?.logicalSourceCountAuthority !== countAuthority
    || execution?.activeSourceCountAuthorityOffsetWords
      !== SCHROEDER_SPATIAL_EPOCH_V2_ACTIVE_COUNT_AUTHORITY_WORD
    || activeSourceView.activeSourceViewBuffer !== snapshot.activeSourceViewBuffer
    || activeSourceView.layout !== snapshot.activeSourceViewLayout
    || !Object.isFrozen(activeSourceView.layout)
    || activeSourceView.submitPerformed !== true
    || activeSourceView.released === true
    || activeSourceView.ownerRuntime !== snapshot.activeSourceViewRuntime
    || !runtimeOwnsSubmittedExecution(
      activeSourceView.ownerRuntime,
      activeSourceView
    )
    || !runtimeOwnsSubmittedExecution(execution?.ownerRuntime, execution)
    || source?.sourceCount !== expected.physicalSourceCount
    || countAuthority.activeSourceView !== activeSourceView
    || countAuthority.buffer !== snapshot.activeSourceViewBuffer
    || countAuthority.offsetWords
      !== SCHROEDER_SPATIAL_EPOCH_V2_ACTIVE_COUNT_AUTHORITY_WORD
    || countAuthority.offsetBytes
      !== SCHROEDER_SPATIAL_EPOCH_V2_ACTIVE_COUNT_AUTHORITY_WORD
        * Uint32Array.BYTES_PER_ELEMENT
    || countAuthority.capacity !== expected.activeSourceCapacity
    || countAuthority.residency !== 'gpu-only'
    || !Object.isFrozen(countAuthority)
    || !webGpuBufferMatchesDevice(snapshot.activeSourceViewBuffer, device)
  ) return false;
  for (const field of [
    'physicalSourceCount',
    'physicalSourceCapacity',
    'activeSourceCapacity',
    'sourceRowLayoutId',
    'sourceRowStrideFloats',
    'generationId',
    'deviceOrdinal',
    'laneOrdinal',
    'leaseToken',
    'sourceFamilyId',
    'storageGeneration',
    'physicsTick',
    'physicsSubstep',
    'positionEpoch',
    'topologyEpoch',
    'chartEpoch',
    'levelEpoch',
    'supportEpoch',
    'buildOrdinal',
    'queryGeometryMode',
    'queryChartId',
    'queryMinLevel',
    'queryMaxLevel',
    'queryBaseGridSpacingM'
  ]) {
    if (!Object.is(execution[field], expected[field])) return false;
  }
  if (
    execution.sourceCount !== expected.executionSourceCount
    || execution.sourceFamily !== expected.executionSourceFamily
    || execution.abiVersion !== expected.executionAbiVersion
    || execution.sourceWorkIdentity !== expected.sourceWorkIdentity
    || execution.logicalSourceCountGpuAuthored
      !== expected.logicalSourceCountGpuAuthored
  ) return false;
  for (const field of [
    'queryGeometryMode',
    'queryChartId',
    'queryMinLevel',
    'queryMaxLevel',
    'queryBaseGridSpacingM',
    'capacityTierOrdinal',
    'activeDispatchOffsetBytes',
    'candidateDispatchOffsetBytes',
    'physicalDispatchOffsetBytes'
  ]) {
    if (!Object.is(activeSourceView[field], expected[field])) return false;
  }
  return validateSchroederSpatialActiveSourceViewDescriptor(
    activeSourceView,
    expected
  ).admitted === true;
}

/**
 * Authenticate the exact immutable source family captured by a transaction.
 * This is intentionally a boolean predicate so a downstream closure can
 * reject stale public-epoch/terminal-state pairings before submitting any
 * sidecar work.
 */
export function validateSchroederSpatialEpochTransactionSourceFamily(
  transaction,
  {
    generation = null,
    sphParticleUpload = null,
    mlsMpmParticleUpload = null
  } = {}
) {
  try {
    const authority = authorityFor(transaction);
    if (
      generation !== authority.generation
      || !generationMatchesSnapshot(authority, generation)
    ) return false;
    const sourceBuffers = resolveSourceBuffers({
      device: authority.device,
      sphParticleUpload,
      mlsMpmParticleUpload
    });
    return sourceBuffersMatch(authority.sourceBuffers, sourceBuffers);
  } catch {
    return false;
  }
}

/**
 * Resolve the exact submitted S9-A/S9-B/S9-C authority for one mechanics
 * level.  Downstream transport code receives no bare-buffer escape hatch:
 * every returned buffer remains tied to the immutable transaction snapshot.
 */
export function resolveSchroederSpatialPhaseVolumeTransportAuthority(
  transaction,
  {
    generation = transaction?.generation ?? null,
    selectedLevel,
    mechanicsFieldView
  } = {}
) {
  const authority = authorityFor(transaction);
  if (
    authority.state !== SCHROEDER_SPATIAL_EPOCH_TRANSACTION_STATE.READERS_ACTIVE
    || !authority.admittedReaders.has(
      SCHROEDER_SPATIAL_EPOCH_READER.MECHANICS_P2G
    )
    || authority.admittedReaders.has(
      SCHROEDER_SPATIAL_EPOCH_READER.MECHANICS_G2P
    )
  ) {
    throw transactionError(
      'Phase-volume transport requires the active epoch after exact P2G admission and before G2P admission',
      'ERR_SCHROEDER_PHASE_VOLUME_TRANSPORT_LIFECYCLE'
    );
  }
  if (
    authority.phaseVolumeInterfaceProposalAuthoritative !== true
    || authority.twoLevelAuthoritative !== true
    || !authority.twoLevel
  ) {
    throw transactionError(
      'Phase-volume transport requires an authoritative two-level S9-C transaction',
      'ERR_SCHROEDER_PHASE_VOLUME_TRANSPORT_AUTHORITY'
    );
  }
  if (
    generation !== authority.generation
    || !generationMatchesSnapshot(authority, generation)
    || !phaseVolumeInterfaceProposalMatchesSnapshot(authority, generation)
  ) {
    throw transactionError(
      'Phase-volume transport generation no longer matches the transaction snapshot',
      'ERR_SCHROEDER_PHASE_VOLUME_TRANSPORT_IDENTITY'
    );
  }
  const twoLevel = authority.twoLevel;
  const levelIndex = selectedLevel === twoLevel.fineLevel
    ? 0
    : selectedLevel === twoLevel.coarseLevel
      ? 1
      : -1;
  if (levelIndex < 0) {
    throw transactionError(
      'Phase-volume transport selectedLevel is not one of the authoritative mechanics levels',
      'ERR_SCHROEDER_PHASE_VOLUME_TRANSPORT_LEVEL'
    );
  }
  const mechanicsLevelView = twoLevel.mechanicsLevelViews[levelIndex];
  const fieldView = twoLevel.mechanicsFieldViews[levelIndex];
  const moment = twoLevel.phaseVolumeMoments[levelIndex];
  const receipt = twoLevel.phaseVolumeReceipts[levelIndex];
  const proposal = authority.generationSnapshot.phaseVolumeInterfaceProposal;
  if (
    mechanicsFieldView !== fieldView
    || mechanicsLevelView?.selectedLevel !== selectedLevel
    || mechanicsLevelView?.mechanicsFieldView !== fieldView
    || mechanicsLevelView?.phaseVolumeMoment !== moment
    || mechanicsLevelView?.phaseVolumeReceipt !== receipt
    || proposal?.finePhaseVolumeMoment !== twoLevel.phaseVolumeMoments[0]
    || proposal?.coarsePhaseVolumeMoment !== twoLevel.phaseVolumeMoments[1]
    || proposal?.fineReceipt !== twoLevel.phaseVolumeReceipts[0]
    || proposal?.coarseReceipt !== twoLevel.phaseVolumeReceipts[1]
    || proposal?.fineMechanicsFieldView !== twoLevel.mechanicsFieldViews[0]
    || proposal?.coarseMechanicsFieldView !== twoLevel.mechanicsFieldViews[1]
    || proposal?.layout?.refluxRouteRowWords
      !== SCHROEDER_SPATIAL_PHASE_VOLUME_INTERFACE_REFLUX_ROUTE_WORDS
    || proposal?.layout?.refluxRouteCapacity
      !== proposal?.fineFieldCapacity
    || proposal?.parentFieldView !== twoLevel.parentFieldView
    || proposal?.parentFieldViewBuffer
      !== twoLevel.parentFieldView.parentFieldViewBuffer
    || moment?.mechanicsFieldView !== fieldView
    || receipt?.phaseVolumeMoment !== moment
    || receipt?.parentPhaseVolumeMoment !== moment
    || receipt?.mechanicsFieldView !== fieldView
  ) {
    throw transactionError(
      'Phase-volume transport lost exact level, moment, receipt, or field lineage',
      'ERR_SCHROEDER_PHASE_VOLUME_TRANSPORT_IDENTITY'
    );
  }
  const localHeadOffsetWords = levelIndex === 0
    ? proposal.layout.fineLocalHeadOffsetWords
    : proposal.layout.coarseLocalHeadOffsetWords;
  const fieldCapacity = levelIndex === 0
    ? proposal.fineFieldCapacity
    : proposal.coarseFieldCapacity;
  return Object.freeze({
    schema: 'peercompute.ulg.schroeder-spatial-phase-volume-transport-authority.v1',
    status: 'schroeder-spatial-phase-volume-transport-authority-ready',
    generation,
    generationId: authority.generationId,
    epochIdentity: authority.epochIdentity,
    selectedLevel,
    levelIndex,
    levelRole: levelIndex === 0 ? 'fine' : 'coarse',
    fieldCapacity,
    mechanicsLevelView,
    mechanicsFieldView: fieldView,
    mechanicsFieldViewBuffer: fieldView.fieldViewBuffer,
    phaseVolumeMoment: moment,
    phaseVolumeMomentControlBuffer: moment.controlBuffer,
    phaseVolumeMomentBuffer: moment.momentBuffer,
    finePhaseVolumeMoment: twoLevel.phaseVolumeMoments[0],
    finePhaseVolumeMomentControlBuffer:
      twoLevel.phaseVolumeMoments[0].controlBuffer,
    finePhaseVolumeMomentBuffer:
      twoLevel.phaseVolumeMoments[0].momentBuffer,
    coarsePhaseVolumeMoment: twoLevel.phaseVolumeMoments[1],
    coarsePhaseVolumeMomentControlBuffer:
      twoLevel.phaseVolumeMoments[1].controlBuffer,
    coarsePhaseVolumeMomentBuffer:
      twoLevel.phaseVolumeMoments[1].momentBuffer,
    phaseVolumeReceipt: receipt,
    phaseVolumeReceiptControlBuffer: receipt.controlBuffer,
    finePhaseVolumeReceipt: twoLevel.phaseVolumeReceipts[0],
    finePhaseVolumeReceiptControlBuffer:
      twoLevel.phaseVolumeReceipts[0].controlBuffer,
    coarsePhaseVolumeReceipt: twoLevel.phaseVolumeReceipts[1],
    coarsePhaseVolumeReceiptControlBuffer:
      twoLevel.phaseVolumeReceipts[1].controlBuffer,
    fineMechanicsFieldView: twoLevel.mechanicsFieldViews[0],
    fineMechanicsFieldViewBuffer:
      twoLevel.mechanicsFieldViews[0].fieldViewBuffer,
    coarseMechanicsFieldView: twoLevel.mechanicsFieldViews[1],
    coarseMechanicsFieldViewBuffer:
      twoLevel.mechanicsFieldViews[1].fieldViewBuffer,
    phaseVolumeInterfaceProposal: proposal,
    phaseVolumeInterfaceProposalControlBuffer: proposal.controlBuffer,
    phaseVolumeInterfaceLocalHeadBuffer: proposal.localHeadBuffer,
    phaseVolumeInterfaceRefluxRouteBuffer: proposal.refluxRouteBuffer,
    phaseVolumeInterfaceRefluxRouteCapacity:
      proposal.layout.refluxRouteCapacity,
    phaseVolumeInterfaceRefluxRouteRowWords:
      proposal.layout.refluxRouteRowWords,
    localHeadOffsetWords,
    phaseVolumeInterfaceLocalHeadOffsetWords: localHeadOffsetWords,
    parentFieldView: twoLevel.parentFieldView,
    parentFieldViewBuffer: twoLevel.parentFieldView.parentFieldViewBuffer,
    fineLevel: twoLevel.fineLevel,
    coarseLevel: twoLevel.coarseLevel,
    twoLevel: true
  });
}

function gridDescriptorMatches(view, grid) {
  const viewDims = Array.from(view?.gridDims || []);
  const gridDims = Array.from(grid?.gridDims || []);
  return viewDims.length === 3
    && gridDims.length === 3
    && viewDims.every((value, axis) => Object.is(value, gridDims[axis]))
    && Object.is(view?.gridNodeCount, grid?.gridNodeCount)
    && Object.is(view?.gridShift, grid?.gridShift)
    && Object.is(
      Math.fround(Number(view?.gridSpacingM)),
      Math.fround(Number(grid?.gridSpacingM))
    );
}

function sharedMechanicsViewExpectations(execution, epochIdentity, {
  selectedLevel,
  mechanicsGrid
}) {
  return {
    generationId: execution.generationId,
    deviceOrdinal: execution.deviceOrdinal,
    laneOrdinal: execution.laneOrdinal,
    leaseToken: execution.leaseToken,
    sourceFamilyId: execution.sourceFamilyId,
    ...epochIdentity,
    completionOrdinal: execution.buildOrdinal,
    sourceCount: execution.sourceCount,
    sourceRowLayoutId: execution.sourceRowLayoutId,
    selectedLevel,
    gridNodeCount: mechanicsGrid.gridNodeCount,
    gridDims: mechanicsGrid.gridDims,
    gridShift: mechanicsGrid.gridShift,
    gridSpacingM: Math.fround(Number(mechanicsGrid.gridSpacingM))
  };
}

/**
 * S9-B intentionally publishes eligibility evidence only.  Keeping this
 * check beside the transaction's other retained-view checks makes a later
 * law prove that it received the exact submitted local receipt, rather than
 * a CPU summary, a stale sidecar, or an inferred volume fallback.
 */
function resolveReadOnlyPhaseVolumeReceipt({
  device,
  execution,
  epochIdentity,
  sourceBuffers,
  spatialSourceBuffer,
  mechanicsFieldView,
  selectedLevel,
  phaseVolumeMoment = null,
  phaseVolumeMomentRuntime = null,
  phaseVolumeReceipt = null,
  phaseVolumeReceiptRuntime = null
}) {
  const hasMoment = phaseVolumeMoment != null;
  const hasReceipt = phaseVolumeReceipt != null;
  if (!hasMoment && !hasReceipt) {
    if (
      phaseVolumeMomentRuntime != null
      || phaseVolumeReceiptRuntime != null
    ) {
      throw transactionError(
        'Phase-volume receipt runtime aliases require their exact local descriptors',
        'ERR_SCHROEDER_SPATIAL_EPOCH_PHASE_VOLUME_RECEIPT_IDENTITY'
      );
    }
    return Object.freeze({
      phaseVolumeMoment: null,
      phaseVolumeMomentRuntime: null,
      phaseVolumeReceipt: null,
      phaseVolumeReceiptRuntime: null
    });
  }
  if (
    !hasMoment
    || !hasReceipt
    || !mechanicsFieldView
    || !Number.isInteger(selectedLevel)
  ) {
    throw transactionError(
      'Phase-volume receipt publication requires one exact local S9-A moment and mechanics-field view',
      'ERR_SCHROEDER_SPATIAL_EPOCH_PHASE_VOLUME_RECEIPT_IDENTITY'
    );
  }
  const expectations = {
    generationId: execution.generationId,
    deviceOrdinal: execution.deviceOrdinal,
    laneOrdinal: execution.laneOrdinal,
    leaseToken: execution.leaseToken,
    sourceFamilyId: execution.sourceFamilyId,
    ...epochIdentity,
    completionOrdinal: execution.buildOrdinal,
    sourceCount: execution.sourceCount,
    selectedLevel
  };
  const momentAdmission = validateSchroederSpatialPhaseVolumeMomentDescriptor(
    phaseVolumeMoment,
    expectations
  );
  const receiptAdmission = validateSchroederSpatialPhaseVolumeReceiptDescriptor(
    phaseVolumeReceipt,
    expectations
  );
  let momentOwned = false;
  let receiptOwned = false;
  try {
    momentOwned = phaseVolumeMomentRuntime?.ownsExecution?.(phaseVolumeMoment) === true;
    receiptOwned = phaseVolumeReceiptRuntime?.ownsExecution?.(phaseVolumeReceipt) === true;
  } catch {
    momentOwned = false;
    receiptOwned = false;
  }
  if (
    momentAdmission.admitted !== true
    || receiptAdmission.admitted !== true
    || phaseVolumeMomentRuntime !== phaseVolumeMoment.ownerRuntime
    || phaseVolumeReceiptRuntime !== phaseVolumeReceipt.ownerRuntime
    || !momentOwned
    || !receiptOwned
    || phaseVolumeMoment.submitPerformed !== true
    || phaseVolumeReceipt.submitPerformed !== true
    || phaseVolumeMoment.released === true
    || phaseVolumeReceipt.released === true
    || phaseVolumeMoment.releaseScheduled === true
    || phaseVolumeReceipt.releaseScheduled === true
    || phaseVolumeMoment.sourceBuffer !== spatialSourceBuffer
    || phaseVolumeMoment.sourceMechanicsBuffer !== sourceBuffers.mechanicsBuffer
    || phaseVolumeMoment.mechanicsFieldView !== mechanicsFieldView
    || phaseVolumeMoment.parentMechanicsFieldView !== mechanicsFieldView
    || phaseVolumeReceipt.phaseVolumeMoment !== phaseVolumeMoment
    || phaseVolumeReceipt.parentPhaseVolumeMoment !== phaseVolumeMoment
    || phaseVolumeReceipt.sourceMechanicsBuffer !== sourceBuffers.mechanicsBuffer
    || phaseVolumeReceipt.sourceBuffer !== spatialSourceBuffer
    || phaseVolumeReceipt.sourceBuffer !== phaseVolumeMoment.sourceBuffer
    || phaseVolumeReceipt.sourceBufferBorrowed !== true
    || phaseVolumeReceipt.mechanicsFieldView !== mechanicsFieldView
    || phaseVolumeReceipt.diagnosticOnly !== true
    || phaseVolumeReceipt.stateMutationAllowed !== false
    || phaseVolumeReceipt.readbackPerformed !== false
    || phaseVolumeReceipt.fullParticleReadbackPerformed !== false
    || !webGpuBufferMatchesDevice(phaseVolumeMoment.controlBuffer, device)
    || !webGpuBufferMatchesDevice(phaseVolumeMoment.momentBuffer, device)
    || !webGpuBufferMatchesDevice(phaseVolumeMoment.sourceMechanicsBuffer, device)
    || !webGpuBufferMatchesDevice(mechanicsFieldView.fieldViewBuffer, device)
    || !webGpuBufferMatchesDevice(phaseVolumeReceipt.controlBuffer, device)
    || !webGpuBufferMatchesDevice(phaseVolumeReceipt.sourceBuffer, device)
    || !webGpuBufferMatchesDevice(phaseVolumeReceipt.partialBuffer, device)
    || !webGpuBufferMatchesDevice(phaseVolumeReceipt.paramsBuffer, device)
  ) {
    throw transactionError(
      'Phase-volume receipt is not the exact submitted, same-device, read-only S9-A conservation artifact',
      'ERR_SCHROEDER_SPATIAL_EPOCH_PHASE_VOLUME_RECEIPT_IDENTITY'
    );
  }
  return Object.freeze({
    phaseVolumeMoment,
    phaseVolumeMomentRuntime,
    phaseVolumeReceipt,
    phaseVolumeReceiptRuntime
  });
}

/**
 * S9-C is a retained topology-only artifact.  Its GPU terminal seal remains
 * authoritative; this host-side admission only freezes exact same-device
 * identity and forbids treating it as a force, state, or readback result.
 */
function resolveReadOnlyPhaseVolumeInterfaceProposal({
  device,
  execution,
  epochIdentity,
  twoLevel,
  phaseVolumeInterfaceProposal = null,
  phaseVolumeInterfaceProposalRuntime = null,
  phaseVolumeInterfaceProposalEnabled = false
}) {
  if (phaseVolumeInterfaceProposalEnabled !== true) {
    if (
      phaseVolumeInterfaceProposal != null
      || phaseVolumeInterfaceProposalRuntime != null
    ) {
      throw transactionError(
        'Disabled phase-volume interface proposal authority cannot retain descriptor aliases',
        'ERR_SCHROEDER_PHASE_VOLUME_INTERFACE_PROPOSAL_IDENTITY'
      );
    }
    return Object.freeze({
      phaseVolumeInterfaceProposal: null,
      phaseVolumeInterfaceProposalRuntime: null
    });
  }
  const fineReceipt = twoLevel?.phaseVolumeReceipts?.[0] ?? null;
  const coarseReceipt = twoLevel?.phaseVolumeReceipts?.[1] ?? null;
  const parentFieldView = twoLevel?.parentFieldView ?? null;
  if (
    !fineReceipt
    || !coarseReceipt
    || !parentFieldView
    || !phaseVolumeInterfaceProposal
    || !phaseVolumeInterfaceProposalRuntime
  ) {
    throw transactionError(
      'Read-only phase-volume interface authority requires exact fine/coarse S9-B receipts, parent CSR, and one submitted proposal',
      'ERR_SCHROEDER_PHASE_VOLUME_INTERFACE_PROPOSAL_IDENTITY'
    );
  }
  const expectations = {
    generationId: execution.generationId,
    deviceOrdinal: execution.deviceOrdinal,
    laneOrdinal: execution.laneOrdinal,
    leaseToken: execution.leaseToken,
    sourceFamilyId: execution.sourceFamilyId,
    ...epochIdentity,
    fineFieldCapacity: fineReceipt.fieldCapacity,
    coarseFieldCapacity: coarseReceipt.fieldCapacity,
    fineLevel: fineReceipt.selectedLevel,
    coarseLevel: coarseReceipt.selectedLevel,
    fineReceiptCompletionOrdinal: fineReceipt.completionOrdinal,
    coarseReceiptCompletionOrdinal: coarseReceipt.completionOrdinal,
    parentFieldCompletionOrdinal: parentFieldView.completionOrdinal
  };
  const admission = validateSchroederSpatialPhaseVolumeInterfaceProposalDescriptor(
    phaseVolumeInterfaceProposal,
    expectations
  );
  let owned = false;
  let submitted = false;
  try {
    owned = phaseVolumeInterfaceProposalRuntime.ownsExecution?.(
      phaseVolumeInterfaceProposal
    ) === true;
    submitted = phaseVolumeInterfaceProposalRuntime.isExecutionSubmitted?.(
      phaseVolumeInterfaceProposal
    ) === true;
  } catch {
    owned = false;
    submitted = false;
  }
  if (
    admission.admitted !== true
    || phaseVolumeInterfaceProposalRuntime
      !== phaseVolumeInterfaceProposal.ownerRuntime
    || !owned
    || !submitted
    || phaseVolumeInterfaceProposal.submitPerformed !== true
    || phaseVolumeInterfaceProposal.released === true
    || phaseVolumeInterfaceProposal.releaseScheduled === true
    || phaseVolumeInterfaceProposal.twoLevel !== true
    || phaseVolumeInterfaceProposal.hasParentFieldView !== true
    || phaseVolumeInterfaceProposal.fineReceipt !== fineReceipt
    || phaseVolumeInterfaceProposal.coarseReceipt !== coarseReceipt
    || phaseVolumeInterfaceProposal.parentFieldView !== parentFieldView
    || phaseVolumeInterfaceProposal.fineMechanicsFieldView
      !== fineReceipt.mechanicsFieldView
    || phaseVolumeInterfaceProposal.coarseMechanicsFieldView
      !== coarseReceipt.mechanicsFieldView
    || phaseVolumeInterfaceProposal.parentFieldViewBuffer
      !== parentFieldView.parentFieldViewBuffer
    || phaseVolumeInterfaceProposal.encodedDispatchCount !== 3
    || phaseVolumeInterfaceProposal.encodedComputePassCount !== 3
    || phaseVolumeInterfaceProposal.diagnosticOnly !== true
    || phaseVolumeInterfaceProposal.stateMutationAllowed !== false
    || phaseVolumeInterfaceProposal.readbackPerformed !== false
    || phaseVolumeInterfaceProposal.fullParticleReadbackRequired !== false
    || phaseVolumeInterfaceProposal.fullParticleReadbackPerformed !== false
    || !webGpuBufferMatchesDevice(
      phaseVolumeInterfaceProposal.controlBuffer,
      device
    )
    || !webGpuBufferMatchesDevice(
      phaseVolumeInterfaceProposal.localHeadBuffer,
      device
    )
    || !webGpuBufferMatchesDevice(
      phaseVolumeInterfaceProposal.refluxRouteBuffer,
      device
    )
    || !webGpuBufferMatchesDevice(
      phaseVolumeInterfaceProposal.paramsBuffer,
      device
    )
  ) {
    throw transactionError(
      'Phase-volume interface proposal is not the exact submitted, same-device, read-only S9-C topology artifact',
      'ERR_SCHROEDER_PHASE_VOLUME_INTERFACE_PROPOSAL_IDENTITY'
    );
  }
  return Object.freeze({
    phaseVolumeInterfaceProposal,
    phaseVolumeInterfaceProposalRuntime
  });
}

function resolveAuthoritativeTwoLevelGeneration({
  device,
  generation,
  sourceBuffers,
  spatialSourceBuffer,
  execution,
  epochIdentity
}) {
  const levelViews = generation?.mechanicsLevelViews;
  const levels = generation?.mechanicsLevels;
  if (
    generation?.mechanicsLevelCount !== 2
    || !Array.isArray(levelViews)
    || levelViews.length !== 2
    || !Object.isFrozen(levelViews)
    || levelViews.some((levelView) => !levelView || !Object.isFrozen(levelView))
    || !Array.isArray(levels)
    || levels.length !== 2
    || !Object.isFrozen(levels)
  ) {
    throw transactionError(
      'Authoritative two-level mechanics requires exactly two immutable mechanics-level descriptors',
      'ERR_SCHROEDER_SPATIAL_EPOCH_TWO_LEVEL_CONTRACT'
    );
  }
  const [fineLevelView, coarseLevelView] = levelViews;
  const fineLevel = fineLevelView.selectedLevel;
  const coarseLevel = coarseLevelView.selectedLevel;
  const fineGrid = fineLevelView.mechanicsGrid;
  const coarseGrid = coarseLevelView.mechanicsGrid;
  if (
    !Number.isInteger(fineLevel)
    || !Number.isInteger(coarseLevel)
    || coarseLevel !== fineLevel + 1
    || levels[0] !== fineLevel
    || levels[1] !== coarseLevel
    || !gridDescriptorMatches(fineLevelView.mechanicsView, fineGrid)
    || !gridDescriptorMatches(coarseLevelView.mechanicsView, coarseGrid)
    || !Number.isFinite(fineGrid?.gridSpacingM)
    || !(fineGrid.gridSpacingM > 0)
    || Math.fround(coarseGrid?.gridSpacingM)
      !== Math.fround(fineGrid.gridSpacingM * 2)
  ) {
    throw transactionError(
      'Authoritative two-level mechanics requires adjacent levels with exact 2:1 f32 grid spacing',
      'ERR_SCHROEDER_SPATIAL_EPOCH_TWO_LEVEL_CONTRACT'
    );
  }
  const mechanicsViews = levelViews.map((levelView) => levelView.mechanicsView);
  for (const [index, levelView] of levelViews.entries()) {
    const mechanicsView = mechanicsViews[index];
    const expectations = sharedMechanicsViewExpectations(
      execution,
      epochIdentity,
      levelView
    );
    const admission = validateSchroederSpatialMechanicsViewDescriptor(
      mechanicsView,
      expectations
    );
    if (
      admission.admitted !== true
      || levelView.mechanicsViewRuntime !== mechanicsView?.ownerRuntime
      || mechanicsView?.sourceBuffer !== spatialSourceBuffer
      || mechanicsView?.directoryBuffer !== execution.directoryBuffer
      || !webGpuBufferMatchesDevice(mechanicsView?.mechanicsViewBuffer, device)
    ) {
      throw transactionError(
        `Authoritative mechanics level ${levelView.selectedLevel} is not a live view of the selected generation`,
        'ERR_SCHROEDER_SPATIAL_EPOCH_TWO_LEVEL_IDENTITY'
      );
    }
  }
  if (
    generation.mechanicsView !== mechanicsViews[0]
    || generation.mechanicsViewRuntime !== fineLevelView.mechanicsViewRuntime
  ) {
    throw transactionError(
      'Authoritative two-level mechanics fine-level aliases do not identify the selected generation',
      'ERR_SCHROEDER_SPATIAL_EPOCH_TWO_LEVEL_IDENTITY'
    );
  }

  const mechanicsFieldViews = levelViews.map(
    (levelView) => levelView.mechanicsFieldView ?? null
  );
  const identityBound = sourceBuffers.identityBuffer != null;
  if (
    mechanicsFieldViews.some(Boolean) !== identityBound
    || mechanicsFieldViews.some((view) => Boolean(view) !== identityBound)
  ) {
    throw transactionError(
      'Authoritative two-level mechanics field views must exactly match the bound particle identity family',
      'ERR_SCHROEDER_SPATIAL_EPOCH_TWO_LEVEL_IDENTITY'
    );
  }
  if (identityBound) {
    for (const [index, levelView] of levelViews.entries()) {
      const mechanicsFieldView = mechanicsFieldViews[index];
      const expectations = sharedMechanicsViewExpectations(
        execution,
        epochIdentity,
        levelView
      );
      const admission = validateSchroederSpatialMechanicsFieldViewDescriptor(
        mechanicsFieldView,
        expectations
      );
      if (
        admission.admitted !== true
        || levelView.mechanicsFieldViewRuntime !== mechanicsFieldView?.ownerRuntime
        || mechanicsFieldView?.sourceBuffer !== spatialSourceBuffer
        || mechanicsFieldView?.identityBuffer !== sourceBuffers.identityBuffer
        || mechanicsFieldView?.parentMechanicsView !== mechanicsViews[index]
        || !webGpuBufferMatchesDevice(mechanicsFieldView?.fieldViewBuffer, device)
      ) {
        throw transactionError(
          `Authoritative mechanics field level ${levelView.selectedLevel} is not a live view of the selected source family`,
          'ERR_SCHROEDER_SPATIAL_EPOCH_TWO_LEVEL_IDENTITY'
        );
      }
    }
    if (
      generation.mechanicsFieldView !== mechanicsFieldViews[0]
      || generation.mechanicsFieldViewRuntime
        !== fineLevelView.mechanicsFieldViewRuntime
    ) {
      throw transactionError(
        'Authoritative two-level mechanics fine field aliases do not identify the selected generation',
        'ERR_SCHROEDER_SPATIAL_EPOCH_TWO_LEVEL_IDENTITY'
      );
    }
  } else if (
    (generation.mechanicsFieldView ?? null) !== null
    || (generation.mechanicsFieldViewRuntime ?? null) !== null
  ) {
    throw transactionError(
      'Authoritative two-level mechanics cannot publish a field alias without a bound particle identity family',
      'ERR_SCHROEDER_SPATIAL_EPOCH_TWO_LEVEL_IDENTITY'
    );
  }

  const phaseVolumeArtifacts = levelViews.map((levelView, index) => (
    resolveReadOnlyPhaseVolumeReceipt({
      device,
      execution,
      epochIdentity,
      sourceBuffers,
      spatialSourceBuffer,
      mechanicsFieldView: mechanicsFieldViews[index],
      selectedLevel: levelView.selectedLevel,
      phaseVolumeMoment: levelView.phaseVolumeMoment ?? null,
      phaseVolumeMomentRuntime: levelView.phaseVolumeMomentRuntime ?? null,
      phaseVolumeReceipt: levelView.phaseVolumeReceipt ?? null,
      phaseVolumeReceiptRuntime: levelView.phaseVolumeReceiptRuntime ?? null
    })
  ));
  const phaseVolumeMoments = Object.freeze(phaseVolumeArtifacts.map(
    ({ phaseVolumeMoment }) => phaseVolumeMoment
  ));
  const phaseVolumeMomentRuntimes = Object.freeze(phaseVolumeArtifacts.map(
    ({ phaseVolumeMomentRuntime }) => phaseVolumeMomentRuntime
  ));
  const phaseVolumeReceipts = Object.freeze(phaseVolumeArtifacts.map(
    ({ phaseVolumeReceipt }) => phaseVolumeReceipt
  ));
  const phaseVolumeReceiptRuntimes = Object.freeze(phaseVolumeArtifacts.map(
    ({ phaseVolumeReceiptRuntime }) => phaseVolumeReceiptRuntime
  ));
  if (
    (generation.phaseVolumeMoment ?? null) !== phaseVolumeMoments[0]
    || (generation.phaseVolumeMomentRuntime ?? null)
      !== phaseVolumeMomentRuntimes[0]
    || (generation.phaseVolumeReceipt ?? null) !== phaseVolumeReceipts[0]
    || (generation.phaseVolumeReceiptRuntime ?? null)
      !== phaseVolumeReceiptRuntimes[0]
  ) {
    throw transactionError(
      'Authoritative two-level mechanics fine aliases do not identify the submitted phase-volume receipt',
      'ERR_SCHROEDER_SPATIAL_EPOCH_PHASE_VOLUME_RECEIPT_IDENTITY'
    );
  }

  const hierarchyView = generation.hierarchyView;
  const hierarchyAdmission = validateSchroederSpatialHierarchyViewDescriptor(
    hierarchyView,
    {
      generationId: execution.generationId,
      deviceOrdinal: execution.deviceOrdinal,
      laneOrdinal: execution.laneOrdinal,
      leaseToken: execution.leaseToken,
      sourceFamilyId: execution.sourceFamilyId,
      ...epochIdentity,
      completionOrdinal: execution.buildOrdinal,
      fineLevel,
      coarseLevel
    }
  );
  if (
    hierarchyAdmission.admitted !== true
    || generation.hierarchyViewRuntime !== hierarchyView?.ownerRuntime
    || hierarchyView?.spatialExecution !== execution
    || hierarchyView?.fineMechanicsView !== mechanicsViews[0]
    || hierarchyView?.coarseMechanicsView !== mechanicsViews[1]
    || !gridDescriptorMatches(hierarchyView?.fineGrid, fineGrid)
    || !gridDescriptorMatches(hierarchyView?.coarseGrid, coarseGrid)
    || hierarchyView?.coarseIndirectDispatchBuffer
      !== hierarchyView?.hierarchyViewBuffer
    || hierarchyView?.coarseIndirectDispatchOffsetBytes
      !== SCHROEDER_SPATIAL_HIERARCHY_VIEW_DISPATCH_OFFSET_WORDS
        * Uint32Array.BYTES_PER_ELEMENT
    || hierarchyView?.fineIndirectDispatchBuffer
      !== hierarchyView?.hierarchyViewBuffer
    || hierarchyView?.fineIndirectDispatchOffsetBytes
      !== SCHROEDER_SPATIAL_HIERARCHY_VIEW_FINE_DISPATCH_OFFSET_WORDS
        * Uint32Array.BYTES_PER_ELEMENT
    || hierarchyView?.topology !== 'two-level-compact-parent-child-csr'
    || hierarchyView?.transferStencil
      !== 'normalized-trilinear-up-to-eight-edges'
    || !webGpuBufferMatchesDevice(hierarchyView?.hierarchyViewBuffer, device)
  ) {
    throw transactionError(
      'Authoritative two-level mechanics requires the live hierarchy view derived from the same immutable generation',
      'ERR_SCHROEDER_SPATIAL_EPOCH_TWO_LEVEL_IDENTITY'
    );
  }
  const parentFieldView = generation.parentFieldView;
  const parentFieldAdmission = validateSchroederSpatialParentFieldViewDescriptor(
    parentFieldView,
    {
      generationId: execution.generationId,
      deviceOrdinal: execution.deviceOrdinal,
      laneOrdinal: execution.laneOrdinal,
      leaseToken: execution.leaseToken,
      sourceFamilyId: execution.sourceFamilyId,
      ...epochIdentity,
      completionOrdinal: execution.buildOrdinal,
      fineLevel,
      coarseLevel,
      exactLevelCount: 2
    }
  );
  if (
    !identityBound
    || parentFieldAdmission.admitted !== true
    || generation.parentFieldViewRuntime !== parentFieldView?.ownerRuntime
    || parentFieldView?.mechanicsFieldViews?.[0] !== mechanicsFieldViews[0]
    || parentFieldView?.mechanicsFieldViews?.[1] !== mechanicsFieldViews[1]
    || parentFieldView?.hierarchyView !== hierarchyView
    || !webGpuBufferMatchesDevice(parentFieldView?.parentFieldViewBuffer, device)
  ) {
    throw transactionError(
      'Authoritative two-level mechanics requires the live field-aware parent topology from the same immutable generation',
      'ERR_SCHROEDER_SPATIAL_EPOCH_TWO_LEVEL_PARENT_FIELD_IDENTITY'
    );
  }
  const aggregateView = generation.aggregateView;
  const aggregateAdmission = validateSchroederSpatialAggregateViewDescriptor(
    aggregateView,
    {
      generationId: execution.generationId,
      deviceOrdinal: execution.deviceOrdinal,
      laneOrdinal: execution.laneOrdinal,
      leaseToken: execution.leaseToken,
      sourceFamilyId: execution.sourceFamilyId,
      ...epochIdentity,
      completionOrdinal: execution.buildOrdinal,
      sourceCount: execution.sourceCount,
      sourceCapacity: execution.sourceCapacity,
      cellCapacity: execution.layout?.cellCapacity,
      sourceRowLayoutId: execution.sourceRowLayoutId
    }
  );
  if (
    aggregateAdmission.admitted !== true
    || generation.aggregateViewRuntime !== aggregateView?.ownerRuntime
    || aggregateView?.spatialExecution !== execution
    || aggregateView?.spatialSource !== generation.source
    || aggregateView?.sourceStateBuffer !== sourceBuffers.stateBuffer
    || aggregateView?.sourceThermoBuffer !== sourceBuffers.thermoBuffer
    || aggregateView?.sourceIdentityBuffer !== sourceBuffers.identityBuffer
    || !webGpuBufferMatchesDevice(aggregateView?.aggregateViewBuffer, device)
  ) {
    throw transactionError(
      `Authoritative two-level mechanics requires the live aggregate reduction from the same immutable generation (${aggregateAdmission.status})`,
      'ERR_SCHROEDER_SPATIAL_EPOCH_TWO_LEVEL_AGGREGATE_IDENTITY'
    );
  }
  return Object.freeze({
    mechanicsLevelViews: levelViews,
    mechanicsLevels: levels,
    fineLevelView,
    coarseLevelView,
    mechanicsViews: Object.freeze(mechanicsViews),
    mechanicsFieldViews: Object.freeze(mechanicsFieldViews),
    phaseVolumeMoments,
    phaseVolumeMomentRuntimes,
    phaseVolumeReceipts,
    phaseVolumeReceiptRuntimes,
    hierarchyView,
    hierarchyViewRuntime: generation.hierarchyViewRuntime,
    parentFieldView,
    parentFieldViewRuntime: generation.parentFieldViewRuntime,
    aggregateView,
    aggregateViewRuntime: generation.aggregateViewRuntime,
    fineLevel,
    coarseLevel
  });
}

function authoritativeTwoLevelGenerationMatchesSnapshot(authority, generation) {
  const snapshot = authority.generationSnapshot.twoLevel;
  if (!snapshot) return true;
  let current;
  try {
    current = resolveAuthoritativeTwoLevelGeneration({
      device: authority.device,
      generation,
      sourceBuffers: authority.sourceBuffers,
      spatialSourceBuffer: authority.generationSnapshot.sourceBuffer,
      execution: authority.generationSnapshot.execution,
      epochIdentity: authority.epochIdentity
    });
  } catch {
    return false;
  }
  return current.mechanicsLevelViews === snapshot.mechanicsLevelViews
    && current.mechanicsLevels === snapshot.mechanicsLevels
    && current.fineLevelView === snapshot.fineLevelView
    && current.coarseLevelView === snapshot.coarseLevelView
    && current.mechanicsViews[0] === snapshot.mechanicsViews[0]
    && current.mechanicsViews[1] === snapshot.mechanicsViews[1]
    && current.mechanicsFieldViews[0] === snapshot.mechanicsFieldViews[0]
    && current.mechanicsFieldViews[1] === snapshot.mechanicsFieldViews[1]
    && current.phaseVolumeMoments[0] === snapshot.phaseVolumeMoments[0]
    && current.phaseVolumeMoments[1] === snapshot.phaseVolumeMoments[1]
    && current.phaseVolumeMomentRuntimes[0]
      === snapshot.phaseVolumeMomentRuntimes[0]
    && current.phaseVolumeMomentRuntimes[1]
      === snapshot.phaseVolumeMomentRuntimes[1]
    && current.phaseVolumeReceipts[0] === snapshot.phaseVolumeReceipts[0]
    && current.phaseVolumeReceipts[1] === snapshot.phaseVolumeReceipts[1]
    && current.phaseVolumeReceiptRuntimes[0]
      === snapshot.phaseVolumeReceiptRuntimes[0]
    && current.phaseVolumeReceiptRuntimes[1]
      === snapshot.phaseVolumeReceiptRuntimes[1]
    && current.hierarchyView === snapshot.hierarchyView
    && current.hierarchyViewRuntime === snapshot.hierarchyViewRuntime
    && current.parentFieldView === snapshot.parentFieldView
    && current.parentFieldViewRuntime === snapshot.parentFieldViewRuntime
    && current.aggregateView === snapshot.aggregateView
    && current.aggregateViewRuntime === snapshot.aggregateViewRuntime;
}

function phaseVolumeInterfaceProposalMatchesSnapshot(authority, generation) {
  if (authority.phaseVolumeInterfaceProposalAuthoritative !== true) return true;
  const snapshot = authority.generationSnapshot;
  const proposal = snapshot.phaseVolumeInterfaceProposal;
  const runtime = snapshot.phaseVolumeInterfaceProposalRuntime;
  const twoLevel = snapshot.twoLevel;
  const fineReceipt = twoLevel?.phaseVolumeReceipts?.[0] ?? null;
  const coarseReceipt = twoLevel?.phaseVolumeReceipts?.[1] ?? null;
  const parentFieldView = twoLevel?.parentFieldView ?? null;
  if (!proposal || !runtime || !fineReceipt || !coarseReceipt || !parentFieldView) {
    return false;
  }
  let admission;
  let owned = false;
  let submitted = false;
  try {
    admission = validateSchroederSpatialPhaseVolumeInterfaceProposalDescriptor(
      proposal,
      {
        generationId: snapshot.generationId,
        deviceOrdinal: snapshot.execution.deviceOrdinal,
        laneOrdinal: snapshot.execution.laneOrdinal,
        leaseToken: snapshot.execution.leaseToken,
        sourceFamilyId: snapshot.execution.sourceFamilyId,
        ...snapshot.epochIdentity,
        fineFieldCapacity: fineReceipt.fieldCapacity,
        coarseFieldCapacity: coarseReceipt.fieldCapacity,
        fineLevel: fineReceipt.selectedLevel,
        coarseLevel: coarseReceipt.selectedLevel,
        fineReceiptCompletionOrdinal: fineReceipt.completionOrdinal,
        coarseReceiptCompletionOrdinal: coarseReceipt.completionOrdinal,
        parentFieldCompletionOrdinal: parentFieldView.completionOrdinal
      }
    );
    owned = runtime.ownsExecution?.(proposal) === true;
    submitted = runtime.isExecutionSubmitted?.(proposal) === true;
  } catch {
    return false;
  }
  return admission?.admitted === true
    && generation?.phaseVolumeInterfaceProposal === proposal
    && generation?.phaseVolumeInterfaceProposalRuntime === runtime
    && generation?.phaseVolumeInterfaceProposalEnabled === true
    && runtime === proposal.ownerRuntime
    && owned
    && submitted
    && proposal.submitPerformed === true
    && proposal.released !== true
    && proposal.releaseScheduled !== true
    && proposal.twoLevel === true
    && proposal.fineReceipt === fineReceipt
    && proposal.coarseReceipt === coarseReceipt
    && proposal.parentFieldView === parentFieldView
    && proposal.controlBuffer === snapshot.phaseVolumeInterfaceProposalControlBuffer
    && proposal.localHeadBuffer === snapshot.phaseVolumeInterfaceProposalLocalHeadBuffer
    && proposal.refluxRouteBuffer
      === snapshot.phaseVolumeInterfaceProposalRefluxRouteBuffer
    && proposal.paramsBuffer === snapshot.phaseVolumeInterfaceProposalParamsBuffer
    && proposal.diagnosticOnly === true
    && proposal.stateMutationAllowed === false
    && proposal.readbackPerformed === false
    && proposal.fullParticleReadbackRequired === false
    && proposal.fullParticleReadbackPerformed === false
    && proposal.encodedDispatchCount === 3
    && proposal.encodedComputePassCount === 3
    && webGpuBufferMatchesDevice(proposal.controlBuffer, authority.device)
    && webGpuBufferMatchesDevice(proposal.localHeadBuffer, authority.device)
    && webGpuBufferMatchesDevice(proposal.refluxRouteBuffer, authority.device)
    && webGpuBufferMatchesDevice(proposal.paramsBuffer, authority.device);
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
    || !activeSourceViewMatchesSnapshot(snapshot, generation, authority.device)
    || (generation?.activeRankView ?? null) !== snapshot.activeRankView
    || (execution?.activeRankView ?? null) !== snapshot.activeRankView
    || (execution?.activeRankViewBuffer ?? null)
      !== snapshot.activeRankViewBuffer
    || (execution?.activeRankViewLayout ?? null)
      !== snapshot.activeRankViewLayout
    || (generation?.mechanicsFieldView ?? null) !== snapshot.mechanicsFieldView
    || (generation?.mechanicsFieldViewRuntime ?? null)
      !== snapshot.mechanicsFieldViewRuntime
    || (generation?.phaseVolumeMoment ?? null) !== snapshot.phaseVolumeMoment
    || (generation?.phaseVolumeMomentRuntime ?? null)
      !== snapshot.phaseVolumeMomentRuntime
    || (generation?.phaseVolumeReceipt ?? null) !== snapshot.phaseVolumeReceipt
    || (generation?.phaseVolumeReceiptRuntime ?? null)
      !== snapshot.phaseVolumeReceiptRuntime
    || Boolean(generation?.phaseVolumeInterfaceProposalEnabled)
      !== snapshot.phaseVolumeInterfaceProposalEnabled
    || (generation?.phaseVolumeInterfaceProposal ?? null)
      !== snapshot.phaseVolumeInterfaceProposal
    || (generation?.phaseVolumeInterfaceProposalRuntime ?? null)
      !== snapshot.phaseVolumeInterfaceProposalRuntime
    || !webGpuBufferMatchesDevice(snapshot.sourceBuffer, authority.device)
    || !webGpuBufferMatchesDevice(snapshot.directoryBuffer, authority.device)
    || (snapshot.activeRankView && (
      execution?.activeRankViewBuildEncoded
        !== snapshot.activeRankViewBuildEncoded
      || source?.sourceCount !== snapshot.activeRankViewSourceCount
      || execution?.sourceCount !== snapshot.activeRankViewSourceCount
      || generation.activeRankView?.activeRankViewBuffer
        !== snapshot.activeRankViewBuffer
      || generation.activeRankView?.layout !== snapshot.activeRankViewLayout
      || generation.activeRankView?.spatialExecution !== snapshot.execution
      || generation.activeRankView?.sourceBuffer !== snapshot.sourceBuffer
      || generation.activeRankView?.directoryBuffer !== snapshot.directoryBuffer
      || !webGpuBufferMatchesDevice(
        snapshot.activeRankViewBuffer,
        authority.device
      )
    ))
    || (snapshot.mechanicsView && (
      generation?.mechanicsView !== snapshot.mechanicsView
      || generation?.mechanicsViewRuntime !== snapshot.mechanicsViewRuntime
      || generation.mechanicsView?.mechanicsViewBuffer
        !== snapshot.mechanicsViewBuffer
      || generation.mechanicsView?.submitPerformed !== true
      || !webGpuBufferMatchesDevice(snapshot.mechanicsViewBuffer, authority.device)
    ))
    || (snapshot.mechanicsFieldView && (
      generation?.mechanicsFieldView !== snapshot.mechanicsFieldView
      || generation?.mechanicsFieldViewRuntime
        !== snapshot.mechanicsFieldViewRuntime
      || generation.mechanicsFieldView?.fieldViewBuffer
        !== snapshot.mechanicsFieldViewBuffer
      || generation.mechanicsFieldView?.identityBuffer
        !== snapshot.mechanicsFieldIdentityBuffer
      || generation.mechanicsFieldView?.parentMechanicsView
        !== snapshot.mechanicsView
      || generation.mechanicsFieldView?.submitPerformed !== true
      || generation.mechanicsFieldView?.released === true
      || !webGpuBufferMatchesDevice(
        snapshot.mechanicsFieldViewBuffer,
        authority.device
      )
      || !webGpuBufferMatchesDevice(
        snapshot.mechanicsFieldIdentityBuffer,
        authority.device
      )
    ))
    || (snapshot.phaseVolumeMoment && (
      generation.phaseVolumeMoment?.controlBuffer
        !== snapshot.phaseVolumeMomentControlBuffer
      || generation.phaseVolumeMoment?.momentBuffer
        !== snapshot.phaseVolumeMomentBuffer
      || generation.phaseVolumeMoment?.mechanicsFieldView
        !== snapshot.mechanicsFieldView
      || generation.phaseVolumeMoment?.submitPerformed !== true
      || generation.phaseVolumeMoment?.released === true
      || generation.phaseVolumeMoment?.releaseScheduled === true
      || !webGpuBufferMatchesDevice(
        snapshot.phaseVolumeMomentControlBuffer,
        authority.device
      )
      || !webGpuBufferMatchesDevice(
        snapshot.phaseVolumeMomentBuffer,
        authority.device
      )
    ))
    || (snapshot.phaseVolumeReceipt && (
      generation.phaseVolumeReceipt?.controlBuffer
        !== snapshot.phaseVolumeReceiptControlBuffer
      || generation.phaseVolumeReceipt?.partialBuffer
        !== snapshot.phaseVolumeReceiptPartialBuffer
      || generation.phaseVolumeReceipt?.paramsBuffer
        !== snapshot.phaseVolumeReceiptParamsBuffer
      || generation.phaseVolumeReceipt?.sourceBuffer
        !== snapshot.phaseVolumeReceiptSourceBuffer
      || generation.phaseVolumeReceipt?.sourceBufferBorrowed !== true
      || generation.phaseVolumeReceipt?.phaseVolumeMoment
        !== snapshot.phaseVolumeMoment
      || generation.phaseVolumeReceipt?.parentPhaseVolumeMoment
        !== snapshot.phaseVolumeMoment
      || generation.phaseVolumeReceipt?.mechanicsFieldView
        !== snapshot.mechanicsFieldView
      || generation.phaseVolumeReceipt?.submitPerformed !== true
      || generation.phaseVolumeReceipt?.released === true
      || generation.phaseVolumeReceipt?.releaseScheduled === true
      || generation.phaseVolumeReceipt?.diagnosticOnly !== true
      || generation.phaseVolumeReceipt?.stateMutationAllowed !== false
      || !webGpuBufferMatchesDevice(
        snapshot.phaseVolumeReceiptControlBuffer,
        authority.device
      )
      || !webGpuBufferMatchesDevice(
        snapshot.phaseVolumeReceiptPartialBuffer,
        authority.device
      )
      || !webGpuBufferMatchesDevice(
        snapshot.phaseVolumeReceiptParamsBuffer,
        authority.device
      )
    ))
    || execution?.generationId !== snapshot.generationId
    || execution?.buildOrdinal !== snapshot.buildOrdinal
    || execution?.sortUniqueOrdinal !== snapshot.sortUniqueOrdinal
  ) return false;
  return EPOCH_FIELDS.every((field) => (
    source?.[field] === snapshot.epochIdentity[field]
    && execution?.[field] === snapshot.epochIdentity[field]
  )) && authoritativeTwoLevelGenerationMatchesSnapshot(authority, generation)
    && phaseVolumeInterfaceProposalMatchesSnapshot(authority, generation);
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
  for (const enabledReaderId of authority.enabledConsumerReaders) {
    const enabledRank = READER_ORDER_RANK[enabledReaderId];
    if (
      LATE_CONSUMER_READER_SET.has(enabledReaderId)
      && Number.isInteger(enabledRank)
      && enabledRank < rank
      && !authority.admittedReaders.has(enabledReaderId)
    ) return false;
  }
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
  const residentBinding =
    isSchroederSpatialExactNearResidentConsumerBinding(receipt);
  const finalizedResult =
    isFinalizedSchroederSpatialExactNearConsumerReceipt(receipt);
  if (
    !receipt
    || typeof receipt !== 'object'
    || !Object.isFrozen(receipt)
    || receipt.schema !== ULG_SCHROEDER_SPATIAL_EPOCH_CONSUMER_RECEIPT_SCHEMA
    || receipt.authenticated !== true
    || receipt.generationBound !== true
    || receipt.consumerId !== readerId
    || receipt.phase !== phase
    || receipt.artifactFamily !== artifactFamily
  ) {
    throw transactionError(
      `Spatial epoch consumer ${readerId} lacks a runtime-issued result receipt or resident evidence binding`,
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
  if (
    residentBinding
      ? (
          receipt.bindingAuthenticated !== true
          || receipt.gpuAuthenticated !== false
          || receipt.resultAuthenticated !== false
          || receipt.submitPerformed !== false
          || receipt.countersObserved !== false
        )
      : (
          receipt.status !== SCHROEDER_SPATIAL_EPOCH_CONSUMER_RECEIPT_STATUS
          || receipt.gpuAuthenticated !== true
          || receipt.submitPerformed !== true
        )
  ) {
    throw transactionError(
      `Spatial epoch consumer ${readerId} receipt was not issued by the live generation runtime`,
      'ERR_SCHROEDER_SPATIAL_EPOCH_CONSUMER_RECEIPT'
    );
  }
  const expectedTraversalCount = exactReceiptU32(
    receipt,
    'expectedTraversalCount'
  );
  if (residentBinding) {
    const resultFields = [
      'traversalCount',
      'candidateVisitCount',
      'consumerMaskHitCount',
      'migratedProposalCount',
      'candidateBytesRequired',
      'candidateBytesAdmitted',
      'candidateBytesCapacity',
      'candidateOverflowBytes'
    ];
    if (
      expectedTraversalCount === 0
      || resultFields.some((field) => receipt[field] !== null)
      || receipt.privateLookupBuildCount !== 0
      || receipt.fixedCandidateBuildCount !== 0
      || receipt.exhaustiveTraversalCount !== 0
      || receipt.fallbackObserved !== false
      || receipt.fullReadbackPerformed !== false
      || receipt.overflowed !== null
      || receipt.partialPublication !== null
      || receipt.residentEvidence?.resultCountersObserved !== false
      || receipt.residentEvidence?.failClosedOnOverflow !== true
      || receipt.residentEvidence?.partialPublicationAllowed !== false
    ) {
      throw transactionError(
        `Spatial epoch consumer ${readerId} resident binding fabricated results or permits a fallback/partial path`,
        'ERR_SCHROEDER_SPATIAL_EPOCH_CONSUMER_RECEIPT'
      );
    }
    return Object.freeze({
      ...receipt,
      epochIdentity: Object.freeze({ ...authority.epochIdentity }),
      expectedTraversalCount,
      bindingAuthenticated: true,
      submissionAuthenticated: false,
      resultAuthenticated: false,
      residentDeferred: true
    });
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
  if (
    expectedTraversalCount === 0
    || counts.traversalCount !== expectedTraversalCount
  ) {
    throw transactionError(
      `Spatial epoch consumer ${readerId} must authenticate its positive expected traversal count`,
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
  if (!finalizedResult) {
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
    expectedTraversalCount,
    ...counts,
    overflowed: false,
    partialPublication: false,
    fallbackObserved: false,
    fullReadbackPerformed: false
  });
}

function validateAggregateConsumerReceipt(authority, readerId, phase, receipt) {
  const aggregateView = authority.twoLevel?.aggregateView ?? null;
  if (
    !aggregateView
    || authority.twoLevelAuthoritative !== true
  ) {
    throw transactionError(
      'Far-aggregate traversal requires the transaction-owned two-level aggregate view',
      'ERR_SCHROEDER_SPATIAL_EPOCH_CONSUMER_RECEIPT_IDENTITY'
    );
  }
  if (
    !isFinalizedSchroederSpatialAggregateTraversalSubmissionReceipt(receipt)
    || receipt?.schema
      !== ULG_SCHROEDER_SPATIAL_AGGREGATE_TRAVERSAL_SUBMISSION_RECEIPT_SCHEMA
    || receipt.consumerId !== readerId
    || receipt.phase !== phase
    || receipt.artifactFamily
      !== SCHROEDER_SPATIAL_AGGREGATE_CONSUMER_ARTIFACT_FAMILY
  ) {
    throw transactionError(
      'Far-aggregate traversal lacks an exact finalized module-issued submission receipt',
      'ERR_SCHROEDER_SPATIAL_EPOCH_CONSUMER_RECEIPT'
    );
  }
  if (
    receipt.deviceId !== authority.deviceId
    || receipt.generationId !== authority.generationId
    || receipt.completionOrdinal !== aggregateView.completionOrdinal
    || receipt.aggregateView !== aggregateView
    || receipt.traversalExecution?.aggregateView !== aggregateView
    || receipt.traversalExecution?.publicEpochIdentity !== authority.epochIdentity
    || receipt.traversalExecution?.deviceId !== authority.deviceId
    || receipt.traversalExecution?.generationId !== authority.generationId
    || receipt.traversalExecution?.completionOrdinal
      !== aggregateView.completionOrdinal
    || receipt.traversalExecution?.queryBuffer
      !== authority.generationSnapshot.sourceBuffer
    || !webGpuBufferMatchesDevice(receipt.traversalSummaryBuffer, authority.device)
  ) {
    throw transactionError(
      'Far-aggregate traversal receipt does not identify the transaction-owned public epoch and aggregate view',
      'ERR_SCHROEDER_SPATIAL_EPOCH_CONSUMER_RECEIPT_IDENTITY'
    );
  }
  if (
    !receipt.epochIdentity
    || typeof receipt.epochIdentity !== 'object'
    || !Object.isFrozen(receipt.epochIdentity)
  ) {
    throw transactionError(
      'Far-aggregate traversal receipt lacks the complete public epoch identity',
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
        `Far-aggregate traversal receipt has an invalid ${field}`,
        'ERR_SCHROEDER_SPATIAL_EPOCH_CONSUMER_RECEIPT_IDENTITY'
      );
    }
    if (actual !== authority.epochIdentity[field]) {
      throw transactionError(
        `Far-aggregate traversal receipt has a stale ${field}`,
        'ERR_SCHROEDER_SPATIAL_EPOCH_CONSUMER_RECEIPT_IDENTITY'
      );
    }
  }
  const traversalCount = exactReceiptU32(receipt, 'traversalCount');
  const queryCount = exactReceiptU32(receipt, 'queryCount');
  const querySourceLayoutId = exactReceiptU32(
    receipt,
    'querySourceLayoutId'
  );
  const queryStrideFloats = exactReceiptU32(
    receipt,
    'queryStrideFloats'
  );
  const privateLookupBuildCount = exactReceiptU32(
    receipt,
    'privateLookupBuildCount'
  );
  const fixedCandidateBuildCount = exactReceiptU32(
    receipt,
    'fixedCandidateBuildCount'
  );
  const explicitExhaustiveFallbackDispatchCount = exactReceiptU32(
    receipt,
    'explicitExhaustiveFallbackDispatchCount'
  );
  if (
    traversalCount !== 1
    || queryCount !== authority.generationSnapshot.execution.sourceCount
    || querySourceLayoutId
      !== SCHROEDER_SPATIAL_AGGREGATE_TRAVERSAL_QUERY_SOURCE_LAYOUT
        .LEVEL_ASSIGNMENT_V0
    || queryStrideFloats
      !== SCHROEDER_SPATIAL_AGGREGATE_LEVEL_ASSIGNMENT_QUERY_FLOATS
    || receipt.querySourceLayout !== 'schroeder-level-assignment-v0'
    || receipt.querySourceLayoutAuthenticated !== true
    || receipt.canonicalQueryProvenanceAuthenticated !== true
    || !Number.isFinite(receipt.nearFieldSupportScale)
    || receipt.nearFieldSupportScale < 0
    || !Number.isFinite(receipt.openingTheta)
    || receipt.openingTheta < 0
    || receipt.authenticated !== true
    || receipt.receiptKind !== 'gpu-fail-closed-summary-dispatch'
    || receipt.submissionAuthenticated !== true
    || receipt.authenticationScope !== 'submission-and-provenance-only'
    || receipt.queueCompletionObserved !== false
    || receipt.gpuAuthenticated !== false
    || receipt.gpuResultObserved !== false
    || receipt.resultAuthenticated !== false
    || receipt.failClosedSummaryProtocolEncoded !== true
    || receipt.exactNearFarPartitionCheckEncoded !== true
    || receipt.topologyFingerprintCheckEncoded !== true
    || receipt.visitedNodeSummaryEncoded !== true
    || receipt.summaryPublicationContract
      !== 'per-row-status-gated-fail-closed'
    || receipt.summaryCapacityHostValidated !== true
    || receipt.gpuSummaryOutcomeObserved !== false
    || receipt.mixedSummaryStatusPossible !== true
    || receipt.authoritativeStateMutationCount !== 0
    || receipt.authoritativeStatePublicationPerformed !== false
    || receipt.traversalSummaryBuffer
      !== receipt.traversalExecution?.traversalSummaryBuffer
    || receipt.traversalSummaryStrideWords
      !== SCHROEDER_SPATIAL_AGGREGATE_TRAVERSAL_SUMMARY_WORDS
    || receipt.visitedNodeCountObserved !== null
    || receipt.exactNearFarPartitionObserved !== null
    || receipt.topologyFingerprintObserved !== null
  ) {
    throw transactionError(
      'Far-aggregate traversal receipt lacks one exact fail-closed GPU submission protocol',
      'ERR_SCHROEDER_SPATIAL_EPOCH_CONSUMER_RECEIPT'
    );
  }
  if (
    privateLookupBuildCount !== 0
    || fixedCandidateBuildCount !== 0
    || explicitExhaustiveFallbackDispatchCount !== 0
    || receipt.materializedCandidateRowCount !== 0
    || receipt.perSourceCandidateBudget !== null
    || receipt.explicitFallbackPathEncoded !== false
    || receipt.fullReadbackPerformed !== false
  ) {
    throw transactionError(
      'Far-aggregate traversal attempted a private, candidate-row, fixed-budget, exhaustive, fallback, or readback path',
      'ERR_SCHROEDER_SPATIAL_EPOCH_CONSUMER_FALLBACK'
    );
  }
  return receipt;
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
  phaseVolumeInterfaceProposalAuthoritative = false,
  requiredReaderIds = DEFAULT_REQUIRED_READERS,
  enabledConsumerReaderIds = [],
  consumerSupportProfileIds = {}
} = {}) {
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
  const mechanicsFieldView = generation.mechanicsFieldView ?? null;
  if (mechanicsFieldView && (
    mechanicsFieldView.submitPerformed !== true
    || mechanicsFieldView.released === true
    || mechanicsFieldView.sourceBuffer !== spatialSourceBuffer
    || mechanicsFieldView.identityBuffer !== sourceBuffers.identityBuffer
    || mechanicsFieldView.parentMechanicsView !== (generation.mechanicsView ?? null)
    || !webGpuBufferMatchesDevice(mechanicsFieldView.fieldViewBuffer, device)
  )) {
    throw transactionError(
      'Spatial epoch mechanics field view does not match the frozen source family',
      'ERR_SCHROEDER_SPATIAL_EPOCH_IDENTITY'
    );
  }
  const directoryV2 =
    execution.abiVersion === SCHROEDER_SPATIAL_EPOCH_V2_VERSION;
  const activeSourceView = generation.activeSourceView
    ?? execution.activeSourceView
    ?? null;
  const activeSourceSnapshot = Object.freeze({
    directoryV2,
    activeSourceView,
    activeSourceViewRuntime: generation.activeSourceViewRuntime ?? null,
    activeSourceViewBuffer:
      activeSourceView?.activeSourceViewBuffer ?? null,
    activeSourceViewLayout: activeSourceView?.layout ?? null,
    activeSourceCountAuthority:
      execution.activeSourceCountAuthority ?? null,
    activeSourceDescriptorExpectation:
      directoryV2 && activeSourceView
        ? activeSourceDescriptorExpectation({
            activeSourceView,
            execution,
            sourceBuffer: spatialSourceBuffer
          })
        : null
  });
  if (!activeSourceViewMatchesSnapshot(
    activeSourceSnapshot,
    generation,
    device
  )) {
    throw transactionError(
      directoryV2
        ? 'Spatial epoch ActiveSource view is not an exact submitted directory-v2 authority'
        : 'Legacy spatial epoch retained directory-v2 ActiveSource resources',
      'ERR_SCHROEDER_SPATIAL_EPOCH_ACTIVE_SOURCE_IDENTITY'
    );
  }
  const activeRankView = generation.activeRankView
    ?? execution.activeRankView
    ?? null;
  if (
    (generation.activeRankView ?? null) !== activeRankView
    || (execution.activeRankView ?? null) !== activeRankView
  ) {
    throw transactionError(
      'Spatial epoch generation and execution disagree about the active-rank view identity',
      'ERR_SCHROEDER_SPATIAL_EPOCH_ACTIVE_RANK_IDENTITY'
    );
  }
  if (activeRankView) {
    const activeRankAdmission = validateSchroederSpatialActiveRankViewDescriptor(
      activeRankView,
      {
        spatialExecution: execution,
        sourceBuffer: spatialSourceBuffer,
        directoryBuffer: execution.directoryBuffer,
        sourceCount: source.sourceCount,
        sourceCapacity: execution.sourceCapacity,
        sourceRowLayoutId: source.sourceRowLayoutId,
        generationId,
        storageGeneration: epochIdentity.storageGeneration,
        physicsTick: epochIdentity.physicsTick,
        physicsSubstep: epochIdentity.physicsSubstep,
        positionEpoch: epochIdentity.positionEpoch,
        topologyEpoch: epochIdentity.topologyEpoch,
        chartEpoch: epochIdentity.chartEpoch,
        levelEpoch: epochIdentity.levelEpoch,
        supportEpoch: epochIdentity.supportEpoch,
        buildOrdinal
      }
    );
    if (
      activeRankAdmission.admitted !== true
      || !Object.isFrozen(activeRankView)
      || !Object.isFrozen(activeRankView.layout)
      || execution.activeRankViewBuffer !== activeRankView.activeRankViewBuffer
      || execution.activeRankViewLayout !== activeRankView.layout
      || execution.activeRankViewBuildEncoded !== true
      || execution.sourceCount !== source.sourceCount
      || activeRankView.spatialExecution !== execution
      || activeRankView.sourceBuffer !== spatialSourceBuffer
      || activeRankView.directoryBuffer !== execution.directoryBuffer
      || !webGpuBufferMatchesDevice(activeRankView.activeRankViewBuffer, device)
    ) {
      throw transactionError(
        `Spatial epoch active-rank view is not an exact live view of the frozen generation (${activeRankAdmission.status})`,
        'ERR_SCHROEDER_SPATIAL_EPOCH_ACTIVE_RANK_IDENTITY'
      );
    }
  } else if (
    execution.activeRankView != null
    || execution.activeRankViewBuffer != null
    || execution.activeRankViewLayout != null
  ) {
    throw transactionError(
      'Spatial epoch execution retained active-rank resources without a matching view descriptor',
      'ERR_SCHROEDER_SPATIAL_EPOCH_ACTIVE_RANK_IDENTITY'
    );
  }
  const twoLevel = twoLevelAuthoritative === true
    ? resolveAuthoritativeTwoLevelGeneration({
        device,
        generation,
        sourceBuffers,
        spatialSourceBuffer,
        execution,
        epochIdentity
      })
    : null;
  if (typeof phaseVolumeInterfaceProposalAuthoritative !== 'boolean') {
    throw transactionError(
      'phaseVolumeInterfaceProposalAuthoritative must be a boolean',
      'ERR_SCHROEDER_PHASE_VOLUME_INTERFACE_PROPOSAL_IDENTITY'
    );
  }
  if (phaseVolumeInterfaceProposalAuthoritative === true && !twoLevel) {
    throw transactionError(
      'Read-only phase-volume interface proposal authority requires authoritative two-level mechanics',
      'ERR_SCHROEDER_PHASE_VOLUME_INTERFACE_PROPOSAL_IDENTITY'
    );
  }
  if (
    phaseVolumeInterfaceProposalAuthoritative === true
    && generation.phaseVolumeInterfaceProposalEnabled !== true
  ) {
    throw transactionError(
      'Read-only phase-volume interface proposal authority requires an explicitly enabled S9-C generation artifact',
      'ERR_SCHROEDER_PHASE_VOLUME_INTERFACE_PROPOSAL_IDENTITY'
    );
  }
  const directPhaseVolumeArtifacts = twoLevel
    ? Object.freeze({
        phaseVolumeMoment: twoLevel.phaseVolumeMoments[0],
        phaseVolumeMomentRuntime: twoLevel.phaseVolumeMomentRuntimes[0],
        phaseVolumeReceipt: twoLevel.phaseVolumeReceipts[0],
        phaseVolumeReceiptRuntime: twoLevel.phaseVolumeReceiptRuntimes[0]
      })
    : resolveReadOnlyPhaseVolumeReceipt({
        device,
        execution,
        epochIdentity,
        sourceBuffers,
        spatialSourceBuffer,
        mechanicsFieldView,
        selectedLevel: mechanicsFieldView?.selectedLevel ?? null,
        phaseVolumeMoment: generation.phaseVolumeMoment ?? null,
        phaseVolumeMomentRuntime: generation.phaseVolumeMomentRuntime ?? null,
        phaseVolumeReceipt: generation.phaseVolumeReceipt ?? null,
        phaseVolumeReceiptRuntime: generation.phaseVolumeReceiptRuntime ?? null
      });
  const phaseVolumeMoment = directPhaseVolumeArtifacts.phaseVolumeMoment;
  const phaseVolumeMomentRuntime =
    directPhaseVolumeArtifacts.phaseVolumeMomentRuntime;
  const phaseVolumeReceipt = directPhaseVolumeArtifacts.phaseVolumeReceipt;
  const phaseVolumeReceiptRuntime =
    directPhaseVolumeArtifacts.phaseVolumeReceiptRuntime;
  const phaseVolumeInterfaceProposalArtifacts =
    phaseVolumeInterfaceProposalAuthoritative === true
      ? resolveReadOnlyPhaseVolumeInterfaceProposal({
          device,
          execution,
          epochIdentity,
          twoLevel,
          phaseVolumeInterfaceProposal:
            generation.phaseVolumeInterfaceProposal ?? null,
          phaseVolumeInterfaceProposalRuntime:
            generation.phaseVolumeInterfaceProposalRuntime ?? null,
          phaseVolumeInterfaceProposalEnabled: true
        })
      : Object.freeze({
          phaseVolumeInterfaceProposal: null,
          phaseVolumeInterfaceProposalRuntime: null
        });
  const phaseVolumeInterfaceProposal =
    phaseVolumeInterfaceProposalArtifacts.phaseVolumeInterfaceProposal;
  const phaseVolumeInterfaceProposalRuntime =
    phaseVolumeInterfaceProposalArtifacts.phaseVolumeInterfaceProposalRuntime;
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
    [...requiredReaders].filter(
      (readerId) => AUTHENTICATED_CONSUMER_READER_SET.has(readerId)
    )
  );
  for (const readerId of enabledConsumerReaderIds) {
    if (!AUTHENTICATED_CONSUMER_READER_SET.has(readerId)) {
      throw transactionError(
        `Enabled spatial epoch consumer ${readerId} is not an authenticated consumer reader`,
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
  const missingSupportProfiles = [...enabledConsumerReaders].filter((readerId) => (
    EXACT_NEAR_CONSUMER_READER_SET.has(readerId)
    && !resolvedSupportProfileIds.has(readerId)
  ));
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
    twoLevelAuthoritative: twoLevel != null,
    phaseVolumeInterfaceProposalAuthoritative,
    twoLevel,
    epochIdentity: Object.freeze(epochIdentity),
    generationSnapshot: Object.freeze({
      source,
      execution,
      runtime: generation.runtime,
      executionOwnerRuntime: execution.ownerRuntime,
      deviceId,
      sourceBuffer: spatialSourceBuffer,
      directoryBuffer: execution.directoryBuffer,
      ...activeSourceSnapshot,
      activeRankView,
      activeRankViewBuffer: activeRankView?.activeRankViewBuffer ?? null,
      activeRankViewLayout: activeRankView?.layout ?? null,
      activeRankViewBuildEncoded: activeRankView
        ? execution.activeRankViewBuildEncoded === true
        : null,
      activeRankViewSourceCount: activeRankView?.sourceCount ?? null,
      mechanicsView: generation.mechanicsView ?? null,
      mechanicsViewRuntime: generation.mechanicsViewRuntime ?? null,
      mechanicsViewBuffer: generation.mechanicsView?.mechanicsViewBuffer ?? null,
      mechanicsFieldView,
      mechanicsFieldViewRuntime: generation.mechanicsFieldViewRuntime ?? null,
      mechanicsFieldViewBuffer: mechanicsFieldView?.fieldViewBuffer ?? null,
      mechanicsFieldIdentityBuffer: mechanicsFieldView?.identityBuffer ?? null,
      phaseVolumeMoment,
      phaseVolumeMomentRuntime,
      phaseVolumeMomentControlBuffer: phaseVolumeMoment?.controlBuffer ?? null,
      phaseVolumeMomentBuffer: phaseVolumeMoment?.momentBuffer ?? null,
      phaseVolumeReceipt,
      phaseVolumeReceiptRuntime,
      phaseVolumeReceiptControlBuffer: phaseVolumeReceipt?.controlBuffer ?? null,
      phaseVolumeReceiptPartialBuffer: phaseVolumeReceipt?.partialBuffer ?? null,
      phaseVolumeReceiptParamsBuffer: phaseVolumeReceipt?.paramsBuffer ?? null,
      phaseVolumeReceiptSourceBuffer: phaseVolumeReceipt?.sourceBuffer ?? null,
      phaseVolumeInterfaceProposal:
        generation.phaseVolumeInterfaceProposal ?? null,
      phaseVolumeInterfaceProposalRuntime:
        generation.phaseVolumeInterfaceProposalRuntime ?? null,
      phaseVolumeInterfaceProposalEnabled:
        generation.phaseVolumeInterfaceProposalEnabled === true,
      phaseVolumeInterfaceProposalControlBuffer:
        generation.phaseVolumeInterfaceProposal?.controlBuffer ?? null,
      phaseVolumeInterfaceProposalLocalHeadBuffer:
        generation.phaseVolumeInterfaceProposal?.localHeadBuffer ?? null,
      phaseVolumeInterfaceProposalRefluxRouteBuffer:
        generation.phaseVolumeInterfaceProposal?.refluxRouteBuffer ?? null,
      phaseVolumeInterfaceProposalParamsBuffer:
        generation.phaseVolumeInterfaceProposal?.paramsBuffer ?? null,
      twoLevel,
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
    residentEvidenceAuthorities: new Set(),
    proposalSeal: null,
    commit: null,
    privateAdvance: null,
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
      submittedAggregateConsumerCount: 0,
      submittedAggregateTraversalCount: 0,
      resultAuthenticatedAggregateTraversalCount: 0,
      residentDeferredConsumerCount: 0,
      residentDeferredSharedExecutionCount: 0,
      authenticatedConsumerTraversalCount: 0,
      authenticatedCandidateVisitCount: 0,
      authenticatedConsumerMaskHitCount: 0,
      authenticatedMigratedProposalCount: 0,
      authenticatedCandidateBytesRequired: 0,
      authenticatedCandidateBytesAdmitted: 0,
      authenticatedCandidateBytesCapacity: 0,
      proposalSealCount: 0,
      privateAdvanceCount: 0,
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
    twoLevelAuthoritative: twoLevel != null,
    phaseVolumeInterfaceProposalAuthoritative,
    mechanicsLevelCount: twoLevel?.mechanicsLevelViews.length
      ?? (generation.mechanicsView ? 1 : 0),
    mechanicsLevels: twoLevel?.mechanicsLevels ?? null,
    hierarchyView: twoLevel?.hierarchyView ?? null,
    activeSourceView,
    activeRankView,
    phaseVolumeReceipt,
    phaseVolumeReceiptRuntime,
    phaseVolumeReceiptPolicy: 'read-only-law-and-transport-eligibility',
    phaseVolumeInterfaceProposal,
    phaseVolumeInterfaceProposalRuntime,
    phaseVolumeInterfaceProposalPolicy:
      'read-only-interface-topology-transport-authority',
    epochIdentity: authority.epochIdentity,
    sourceBuffers,
    get state() {
      return authority.state;
    }
  });
  TRANSACTION_AUTHORITY.set(transaction, authority);
  return transaction;
}

function admitSchroederSpatialEpochTransactionReaderInternal(transaction, {
  readerId,
  phase,
  generation,
  sphParticleUpload,
  mlsMpmParticleUpload,
  consumerReceipt = null
} = {}, { lateConsumer = false } = {}) {
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
  const isLateConsumer = LATE_CONSUMER_READER_SET.has(readerId);
  if (isLateConsumer !== lateConsumer) {
    rejectReader(
      authority,
      isLateConsumer
        ? `Spatial epoch consumer ${readerId} requires explicit late-consumer admission`
        : `Spatial epoch reader ${readerId ?? 'unknown'} is not a declared late consumer`,
      'ERR_SCHROEDER_SPATIAL_EPOCH_READER_CONTRACT'
    );
  }
  const readerStateAdmitted = lateConsumer
    ? authority.state === SCHROEDER_SPATIAL_EPOCH_TRANSACTION_STATE.READERS_COMPLETE
    : (
        authority.state
          === SCHROEDER_SPATIAL_EPOCH_TRANSACTION_STATE.CANONICAL_BUILT
        || authority.state
          === SCHROEDER_SPATIAL_EPOCH_TRANSACTION_STATE.READERS_ACTIVE
      );
  if (!readerStateAdmitted) {
    rejectReader(
      authority,
      lateConsumer
        ? `Late spatial epoch consumer ${readerId ?? 'unknown'} was reached before early readers completed or after proposal seal`
        : `Spatial epoch reader ${readerId ?? 'unknown'} attempted admission after readers were sealed`,
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
  const isAggregateConsumer =
    readerId === SCHROEDER_SPATIAL_EPOCH_READER.FAR_AGGREGATE;
  const isAuthenticatedConsumer = isExactNearConsumer || isAggregateConsumer;
  if (
    isAuthenticatedConsumer
    && !authority.enabledConsumerReaders.has(readerId)
  ) {
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
  if (isAuthenticatedConsumer) {
    try {
      authenticatedReceipt = isAggregateConsumer
        ? validateAggregateConsumerReceipt(
            authority,
            readerId,
            phase,
            consumerReceipt
          )
        : validateConsumerReceipt(
            authority,
            readerId,
            phase,
            consumerReceipt
          );
    } catch (error) {
      rejectConsumerReceipt(authority, readerId, error);
    }
  }
  // Keep a compact, buffer-free receipt synopsis with the transaction record.
  // Long-horizon/browser telemetry deliberately retains admitted readers but
  // not the live receipt objects. This makes real same-device WebGPU receipt
  // admission externally auditable without exposing mutable GPU resources or
  // changing the receipt contract.
  const receiptTelemetry = authenticatedReceipt
    ? Object.freeze({
        schema: 'peercompute.ulg.schroeder-spatial-consumer-receipt-telemetry.v1',
        status: authenticatedReceipt.status ?? null,
        backend: 'webgpu',
        backendSelection: 'same-device-submitted-webgpu-generation',
        fallbackIntent: 'forbidden',
        consumerId: authenticatedReceipt.consumerId ?? readerId,
        deviceId: authenticatedReceipt.deviceId ?? authority.deviceId,
        generationId: authenticatedReceipt.generationId ?? authority.generationId,
        epochIdentity: authenticatedReceipt.epochIdentity
          ? Object.freeze({ ...authenticatedReceipt.epochIdentity })
          : null,
        authenticated: authenticatedReceipt.authenticated === true,
        gpuAuthenticated: authenticatedReceipt.gpuAuthenticated === true,
        bindingAuthenticated: authenticatedReceipt.bindingAuthenticated === true,
        submissionAuthenticated:
          authenticatedReceipt.submissionAuthenticated === true,
        resultAuthenticated: authenticatedReceipt.resultAuthenticated !== false,
        submitPerformed: authenticatedReceipt.submitPerformed === true,
        generationBound: authenticatedReceipt.generationBound === true,
        expectedTraversalCount:
          authenticatedReceipt.expectedTraversalCount ?? null,
        traversalCount: authenticatedReceipt.traversalCount ?? null,
        overflowed: authenticatedReceipt.overflowed === true,
        partialPublication: authenticatedReceipt.partialPublication === true,
        fallbackObserved: authenticatedReceipt.fallbackObserved === true,
        fullReadbackPerformed:
          authenticatedReceipt.fullReadbackPerformed === true,
        privateLookupBuildCount:
          authenticatedReceipt.privateLookupBuildCount ?? null,
        fixedCandidateBuildCount:
          authenticatedReceipt.fixedCandidateBuildCount ?? null,
        exhaustiveTraversalCount:
          authenticatedReceipt.exhaustiveTraversalCount ?? null
      })
    : null;
  authority.admittedReaders.set(readerId, Object.freeze({
    readerId,
    phase,
    supportProfileId: authenticatedReceipt?.supportProfileId ?? null,
    artifactFamily: authenticatedReceipt?.artifactFamily ?? null,
    authenticatedReceipt: Boolean(authenticatedReceipt),
    bindingAuthenticated:
      authenticatedReceipt?.bindingAuthenticated === true,
    submissionAuthenticated:
      authenticatedReceipt?.submissionAuthenticated === true,
    resultAuthenticated: Boolean(
      authenticatedReceipt
      && authenticatedReceipt.resultAuthenticated !== false
    ),
    receiptTelemetry
  }));
  if (authenticatedReceipt) {
    authority.consumerReceipts.set(readerId, authenticatedReceipt);
    authority.counters.consumerReceiptAdmissionCount += 1;
    if (isAggregateConsumer) {
      authority.counters.submittedAggregateConsumerCount += 1;
      authority.counters.submittedAggregateTraversalCount +=
        authenticatedReceipt.traversalCount ?? 0;
    } else if (authenticatedReceipt.residentDeferred === true) {
      authority.counters.residentDeferredConsumerCount += 1;
      const evidenceAuthority = authenticatedReceipt.residentEvidence?.evidenceBuffer;
      if (!authority.residentEvidenceAuthorities.has(evidenceAuthority)) {
        authority.residentEvidenceAuthorities.add(evidenceAuthority);
        authority.counters.residentDeferredSharedExecutionCount += 1;
      }
    } else {
      authority.counters.authenticatedConsumerTraversalCount +=
        authenticatedReceipt.traversalCount ?? 0;
      authority.counters.authenticatedCandidateVisitCount +=
        authenticatedReceipt.candidateVisitCount ?? 0;
      authority.counters.authenticatedConsumerMaskHitCount +=
        authenticatedReceipt.consumerMaskHitCount ?? 0;
      authority.counters.authenticatedMigratedProposalCount +=
        authenticatedReceipt.migratedProposalCount ?? 0;
      authority.counters.authenticatedCandidateBytesRequired +=
        authenticatedReceipt.candidateBytesRequired ?? 0;
      authority.counters.authenticatedCandidateBytesAdmitted +=
        authenticatedReceipt.candidateBytesAdmitted ?? 0;
      authority.counters.authenticatedCandidateBytesCapacity +=
        authenticatedReceipt.candidateBytesCapacity ?? 0;
    }
  }
  authority.counters.readerAdmissionCount += 1;
  authority.state = lateConsumer
    ? SCHROEDER_SPATIAL_EPOCH_TRANSACTION_STATE.READERS_COMPLETE
    : SCHROEDER_SPATIAL_EPOCH_TRANSACTION_STATE.READERS_ACTIVE;
  return true;
}

export function admitSchroederSpatialEpochTransactionReader(
  transaction,
  options = {}
) {
  return admitSchroederSpatialEpochTransactionReaderInternal(
    transaction,
    options,
    { lateConsumer: false }
  );
}

/**
 * Admit an ordered post-integration exact-near family after G2P/FAR while
 * keeping the ordinary reader set irreversibly sealed.
 */
export function admitSchroederSpatialEpochTransactionLateConsumer(
  transaction,
  options = {}
) {
  return admitSchroederSpatialEpochTransactionReaderInternal(
    transaction,
    options,
    { lateConsumer: true }
  );
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
    .filter((readerId) => (
      !LATE_CONSUMER_READER_SET.has(readerId)
      && !authority.admittedReaders.has(readerId)
    ));
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
  const missingReaders = [...authority.requiredReaders]
    .filter((readerId) => !authority.admittedReaders.has(readerId));
  if (missingReaders.length > 0) {
    throw transactionError(
      `Spatial epoch transaction is missing required readers: ${missingReaders.join(', ')}`,
      'ERR_SCHROEDER_SPATIAL_EPOCH_MISSING_READER'
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
    status: status ?? (
      authority.counters.authenticatedConsumerTraversalCount > 0
        ? 'authenticated-spatial-consumer-proposals-sealed'
        : authority.counters.residentDeferredConsumerCount > 0
          ? 'resident-fail-closed-spatial-consumer-bindings-sealed'
        : authority.counters.submittedAggregateTraversalCount > 0
          ? 'spatial-consumer-submissions-sealed'
          : 'unmigrated-laws-quarantined'
    ),
    migratedProposalCount: resolvedMigratedProposalCount,
    legacyConsumerCount: resolvedLegacyConsumerCount,
    authenticatedConsumerCount:
      authority.consumerReceipts.size
      - authority.counters.submittedAggregateConsumerCount
      - authority.counters.residentDeferredConsumerCount,
    residentDeferredConsumerCount:
      authority.counters.residentDeferredConsumerCount,
    residentDeferredSharedExecutionCount:
      authority.counters.residentDeferredSharedExecutionCount,
    submittedAggregateConsumerCount:
      authority.counters.submittedAggregateConsumerCount,
    authenticatedTraversalCount:
      authority.counters.authenticatedConsumerTraversalCount,
    submittedAggregateTraversalCount:
      authority.counters.submittedAggregateTraversalCount,
    resultAuthenticatedAggregateTraversalCount:
      authority.counters.resultAuthenticatedAggregateTraversalCount,
    candidateVisitCount:
      authority.counters.residentDeferredConsumerCount > 0
        ? null
        : authority.counters.authenticatedCandidateVisitCount,
    consumerMaskHitCount:
      authority.counters.residentDeferredConsumerCount > 0
        ? null
        : authority.counters.authenticatedConsumerMaskHitCount,
    resultCountersObserved:
      authority.counters.residentDeferredConsumerCount === 0
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
    published: true,
    publicationOrdinal: 1,
    sourceGeneration: authority.generation,
    generationId: authority.generationId,
    epochIdentity: authority.epochIdentity,
    nextStateBuffer: nextSourceBuffers.stateBuffer,
    nextThermoBuffer: nextSourceBuffers.thermoBuffer,
    nextIdentityBuffer: nextSourceBuffers.identityBuffer,
    nextMechanicsBuffer: nextSourceBuffers.mechanicsBuffer
  });
  authority.counters.commitCount += 1;
  return authority.commit;
}

/**
 * Validate the exact module-owned positive publication receipt returned by
 * commitSchroederSpatialEpochTransaction. Object identity is deliberate: a
 * structurally copied receipt is not publication authority.
 */
export function validateSchroederSpatialEpochTransactionCommit(
  transaction,
  commitReceipt,
  {
    nextParticleUploads = null,
    expectedGeneration = null,
    sourceParticleUploads = null
  } = {}
) {
  try {
    const authority = authorityFor(transaction);
    const nextSphParticleUpload = nextParticleUploads?.sphParticleUpload ?? null;
    const nextMlsMpmParticleUpload =
      nextParticleUploads?.mlsMpmParticleUpload ?? null;
    if (
      authority.commit !== commitReceipt
      || commitReceipt?.published !== true
      || commitReceipt?.publicationOrdinal !== 1
      || commitReceipt?.sourceGeneration !== authority.generation
      || commitReceipt?.generationId !== authority.generationId
      || commitReceipt?.epochIdentity !== authority.epochIdentity
      || !nextSphParticleUpload
      || !nextMlsMpmParticleUpload
      || (expectedGeneration != null
        && authority.generation !== expectedGeneration)
    ) return false;
    const nextSourceBuffers = resolveSourceBuffers({
      device: authority.device,
      sphParticleUpload: nextSphParticleUpload,
      mlsMpmParticleUpload: nextMlsMpmParticleUpload
    });
    const expectedSourceBuffers = sourceParticleUploads == null
      ? authority.sourceBuffers
      : resolveSourceBuffers({
          device: authority.device,
          sphParticleUpload: sourceParticleUploads.sphParticleUpload,
          mlsMpmParticleUpload: sourceParticleUploads.mlsMpmParticleUpload
        });
    return Boolean(
      commitReceipt.nextStateBuffer === nextSourceBuffers.stateBuffer
      && commitReceipt.nextThermoBuffer === nextSourceBuffers.thermoBuffer
      && commitReceipt.nextIdentityBuffer === nextSourceBuffers.identityBuffer
      && commitReceipt.nextMechanicsBuffer === nextSourceBuffers.mechanicsBuffer
      && authority.counters.commitCount === 1
      && authority.counters.privateAdvanceCount === 0
      && sourceBuffersMatch(authority.sourceBuffers, expectedSourceBuffers)
    );
  } catch {
    return false;
  }
}

export function advanceSchroederSpatialEpochTransactionPrivate(transaction, {
  nextParticleUploads = null,
  status = 'private-next-state-advanced'
} = {}) {
  const authority = authorityFor(transaction);
  if (
    authority.twoLevelAuthoritative !== true
    || authority.enabledConsumerReaders.size !== 0
    || authority.requiredReaders.size !== 2
    || !authority.requiredReaders.has(
      SCHROEDER_SPATIAL_EPOCH_READER.MECHANICS_P2G
    )
    || !authority.requiredReaders.has(
      SCHROEDER_SPATIAL_EPOCH_READER.MECHANICS_G2P
    )
    || authority.admittedReaders.size !== 2
    || !authority.admittedReaders.has(
      SCHROEDER_SPATIAL_EPOCH_READER.MECHANICS_P2G
    )
    || !authority.admittedReaders.has(
      SCHROEDER_SPATIAL_EPOCH_READER.MECHANICS_G2P
    )
  ) {
    throw transactionError(
      'Private spatial epoch advance is reserved for zero-consumer authoritative two-level mechanics',
      'ERR_SCHROEDER_SPATIAL_EPOCH_PRIVATE_ADVANCE_AUTHORITY'
    );
  }
  const nextSphParticleUpload = nextParticleUploads?.sphParticleUpload || null;
  const nextMlsMpmParticleUpload =
    nextParticleUploads?.mlsMpmParticleUpload || null;
  if (!nextSphParticleUpload || !nextMlsMpmParticleUpload) {
    throw transactionError(
      'Private spatial epoch advance requires a complete successor upload family',
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
      'Private spatial epoch advance cannot drop explicit particle identity',
      'ERR_SCHROEDER_SPATIAL_EPOCH_COMMIT_BUFFER_FAMILY'
    );
  }
  transition(
    authority,
    [SCHROEDER_SPATIAL_EPOCH_TRANSACTION_STATE.PROPOSALS_SEALED],
    SCHROEDER_SPATIAL_EPOCH_TRANSACTION_STATE.PRIVATE_ADVANCED
  );
  authority.privateAdvance = Object.freeze({
    status,
    successorStateBuffer: nextSourceBuffers.stateBuffer,
    successorThermoBuffer: nextSourceBuffers.thermoBuffer,
    successorIdentityBuffer: nextSourceBuffers.identityBuffer,
    successorMechanicsBuffer: nextSourceBuffers.mechanicsBuffer
  });
  authority.counters.privateAdvanceCount += 1;
  return authority.privateAdvance;
}

export function validateSchroederSpatialEpochTransactionPrivateAdvance(
  transaction,
  privateAdvanceReceipt,
  {
    nextParticleUploads = null,
    expectedGeneration = null,
    sourceParticleUploads = null
  } = {}
) {
  try {
    const authority = authorityFor(transaction);
    const nextSphParticleUpload = nextParticleUploads?.sphParticleUpload ?? null;
    const nextMlsMpmParticleUpload =
      nextParticleUploads?.mlsMpmParticleUpload ?? null;
    if (
      authority.state
        !== SCHROEDER_SPATIAL_EPOCH_TRANSACTION_STATE.PRIVATE_ADVANCED
      || authority.twoLevelAuthoritative !== true
      || authority.privateAdvance !== privateAdvanceReceipt
      || !nextSphParticleUpload
      || !nextMlsMpmParticleUpload
      || (expectedGeneration != null
        && authority.generation !== expectedGeneration)
    ) return false;
    const nextSourceBuffers = resolveSourceBuffers({
      device: authority.device,
      sphParticleUpload: nextSphParticleUpload,
      mlsMpmParticleUpload: nextMlsMpmParticleUpload
    });
    const expectedSourceBuffers = sourceParticleUploads == null
      ? authority.sourceBuffers
      : resolveSourceBuffers({
          device: authority.device,
          sphParticleUpload: sourceParticleUploads.sphParticleUpload,
          mlsMpmParticleUpload: sourceParticleUploads.mlsMpmParticleUpload
        });
    return Boolean(
      privateAdvanceReceipt?.successorStateBuffer
        === nextSourceBuffers.stateBuffer
      && privateAdvanceReceipt?.successorThermoBuffer
        === nextSourceBuffers.thermoBuffer
      && privateAdvanceReceipt?.successorIdentityBuffer
        === nextSourceBuffers.identityBuffer
      && privateAdvanceReceipt?.successorMechanicsBuffer
        === nextSourceBuffers.mechanicsBuffer
      && authority.counters.privateAdvanceCount === 1
      && authority.counters.commitCount === 0
      && authority.sourceBuffers.stateBuffer === expectedSourceBuffers.stateBuffer
      && authority.sourceBuffers.thermoBuffer === expectedSourceBuffers.thermoBuffer
      && authority.sourceBuffers.identityBuffer
        === expectedSourceBuffers.identityBuffer
      && authority.sourceBuffers.mechanicsBuffer
        === expectedSourceBuffers.mechanicsBuffer
    );
  } catch {
    return false;
  }
}

export function scheduleSchroederSpatialEpochTransactionRelease(transaction, {
  after = null
} = {}) {
  const authority = authorityFor(transaction);
  const releaseEligibleStates = [
    SCHROEDER_SPATIAL_EPOCH_TRANSACTION_STATE.COMMITTED,
    SCHROEDER_SPATIAL_EPOCH_TRANSACTION_STATE.PRIVATE_ADVANCED,
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
    twoLevelAuthoritative: authority.twoLevelAuthoritative,
    phaseVolumeInterfaceProposalAuthoritative:
      authority.phaseVolumeInterfaceProposalAuthoritative,
    mechanicsLevelCount: authority.twoLevel?.mechanicsLevelViews.length
      ?? (authority.generation.mechanicsView ? 1 : 0),
    mechanicsLevels: authority.twoLevel?.mechanicsLevels ?? null,
    hierarchyViewStatus: authority.twoLevel?.hierarchyView.status ?? null,
    hierarchyTopology: authority.twoLevel?.hierarchyView.topology ?? null,
    phaseVolumeReceiptStatus:
      authority.generationSnapshot.phaseVolumeReceipt?.status ?? null,
    phaseVolumeReceiptReadOnly:
      authority.generationSnapshot.phaseVolumeReceipt?.diagnosticOnly === true
      && authority.generationSnapshot.phaseVolumeReceipt?.stateMutationAllowed === false,
    phaseVolumeInterfaceProposalStatus:
      authority.generationSnapshot.phaseVolumeInterfaceProposal?.status ?? null,
    phaseVolumeInterfaceProposalReadOnly:
      authority.generationSnapshot.phaseVolumeInterfaceProposal?.diagnosticOnly === true
      && authority.generationSnapshot.phaseVolumeInterfaceProposal?.stateMutationAllowed === false,
    phaseVolumeInterfaceProposalTwoLevel:
      authority.generationSnapshot.phaseVolumeInterfaceProposal?.twoLevel === true,
    phaseVolumeInterfaceProposalDispatchCount:
      authority.generationSnapshot.phaseVolumeInterfaceProposal?.encodedDispatchCount
        ?? null,
    phaseVolumeInterfaceProposalRetainedGpuBufferBytes:
      authority.generationSnapshot.phaseVolumeInterfaceProposal?.retainedGpuBufferBytes
        ?? null,
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
    commitPublished: authority.commit?.published === true,
    commitPublicationOrdinal:
      authority.commit?.publicationOrdinal ?? null,
    privateAdvanceStatus: authority.privateAdvance?.status ?? null,
    nextStateBufferRetained: Boolean(authority.commit?.nextStateBuffer),
    abortReason: authority.abortReason,
    releaseFailureReason: authority.releaseFailureReason,
    legacyLookupRecords: Object.freeze([...authority.legacyLookupRecords]),
    counters: Object.freeze({ ...authority.counters })
  });
}
