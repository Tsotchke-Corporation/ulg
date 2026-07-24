import {
  validateSchroederSpatialTopologyTransitionReceipt
} from './schroederSpatialTopologyTransitionGpu.js';
import {
  validateSchroederSpatialEpochTransactionCommit
} from './schroederSpatialEpochTransaction.js';
import {
  webGpuBufferDevice,
  webGpuBufferMatchesDevice,
  webGpuDeviceId
} from './sphGpuDeviceIdentity.js';

export const ULG_SCHROEDER_SPATIAL_SUCCESSOR_SOURCE_FAMILY_SCHEMA =
  'peercompute.ulg.schroeder-committed-successor-source-family.v1';
export const ULG_SCHROEDER_SPATIAL_SUCCESSOR_SOURCE_FAMILY_LEASE_SCHEMA =
  'peercompute.ulg.schroeder-committed-successor-source-family-lease.v1';
export const ULG_SCHROEDER_SPATIAL_SUCCESSOR_SOURCE_FAMILY_LIVENESS_SCHEMA =
  'peercompute.ulg.schroeder-committed-successor-source-family-liveness.v1';
export const ULG_SCHROEDER_SPATIAL_SUCCESSOR_SOURCE_FAMILY_LEASE_RELEASE_SCHEMA =
  'peercompute.ulg.schroeder-committed-successor-source-family-lease-release.v1';
export const ULG_SCHROEDER_SPATIAL_SUCCESSOR_BUFFER_FAMILY_ALLOCATION_SCHEMA =
  'peercompute.ulg.schroeder-successor-buffer-family-allocation.v1';
export const ULG_SCHROEDER_SPATIAL_SUCCESSOR_PUBLICATION_PLAN_SCHEMA =
  'peercompute.ulg.schroeder-successor-source-family-publication-plan.v1';
export const ULG_SCHROEDER_SPATIAL_SUCCESSOR_PUBLICATION_RECEIPT_SCHEMA =
  'peercompute.ulg.schroeder-successor-source-family-publication-receipt.v1';
export const ULG_SCHROEDER_SPATIAL_SUCCESSOR_RETIREMENT_RECEIPT_SCHEMA =
  'peercompute.ulg.schroeder-successor-source-family-retirement-receipt.v1';

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

const sourceFamilyRecords = new WeakMap();
const finalizedSourceFamilies = new WeakSet();
const sourceFamilyByCommitReceipt = new WeakMap();
const sourceFamilyLeaseRecords = new WeakMap();
const bufferFamilyAllocationStateByDevice = new WeakMap();
const bufferFamilyAllocationRecords = new WeakMap();
const successorPublicationPlanRecords = new WeakMap();
const preparedSuccessorPublicationPlans = new WeakSet();
const successorPublicationReceiptRecords = new WeakMap();

function sourceFamilyError(message, suffix = 'IDENTITY') {
  const error = new Error(message);
  error.code = `ERR_SCHROEDER_SPATIAL_SUCCESSOR_SOURCE_FAMILY_${suffix}`;
  return error;
}

function exactU32(value, label, { positive = false } = {}) {
  if (
    typeof value !== 'number'
    || !Number.isInteger(value)
    || value < (positive ? 1 : 0)
    || value > 0xffff_ffff
  ) {
    throw sourceFamilyError(
      `${label} must be an exact ${positive ? 'positive ' : ''}u32`
    );
  }
  return value;
}

function incrementExactU32(value, label, { positive = false } = {}) {
  const current = exactU32(value, label, { positive });
  if (current === 0xffff_ffff) {
    throw sourceFamilyError(
      `${label} exhausted the u32 identity space; wrapping would alias a live epoch`,
      'IDENTITY_EXHAUSTED'
    );
  }
  return current + 1;
}

function requireDevice(device) {
  if (!device || (typeof device !== 'object' && typeof device !== 'function')) {
    throw sourceFamilyError('successor identity allocation requires one device', 'DEVICE');
  }
  return device;
}

/**
 * Allocate a collision-free storage-family identity on one device. Identities
 * are monotonic for the lifetime of the device and deliberately never wrap.
 */
export function allocateSchroederSpatialSuccessorBufferFamilyIdentity({
  device,
  afterStorageGeneration = 0,
  purpose = 'schroeder-successor-buffer-family'
} = {}) {
  requireDevice(device);
  const after = exactU32(
    afterStorageGeneration,
    'afterStorageGeneration'
  );
  const normalizedPurpose = typeof purpose === 'string' ? purpose.trim() : '';
  if (!normalizedPurpose) {
    throw sourceFamilyError('buffer-family allocation purpose must be non-empty', 'CONTRACT');
  }
  let state = bufferFamilyAllocationStateByDevice.get(device);
  if (!state) {
    state = { lastStorageGeneration: 0, allocationOrdinal: 0 };
    bufferFamilyAllocationStateByDevice.set(device, state);
  }
  const base = Math.max(state.lastStorageGeneration, after);
  const storageGeneration = incrementExactU32(
    base,
    'successor storage generation'
  );
  state.lastStorageGeneration = storageGeneration;
  state.allocationOrdinal += 1;
  const allocation = Object.freeze({
    schema: ULG_SCHROEDER_SPATIAL_SUCCESSOR_BUFFER_FAMILY_ALLOCATION_SCHEMA,
    status: 'schroeder-successor-buffer-family-identity-allocated',
    allocated: true,
    storageGeneration,
    allocationOrdinal: state.allocationOrdinal,
    purpose: normalizedPurpose,
    deviceId: webGpuDeviceId(device)
  });
  bufferFamilyAllocationRecords.set(allocation, {
    device,
    storageGeneration,
    purpose: normalizedPurpose
  });
  return allocation;
}

function exactBufferFamilyAllocation(allocation, device) {
  const record = bufferFamilyAllocationRecords.get(allocation);
  if (
    !record
    || record.device !== device
    || allocation?.schema
      !== ULG_SCHROEDER_SPATIAL_SUCCESSOR_BUFFER_FAMILY_ALLOCATION_SCHEMA
    || !Object.isFrozen(allocation)
    || allocation.allocated !== true
    || allocation.storageGeneration !== record.storageGeneration
    || allocation.deviceId !== webGpuDeviceId(device)
  ) {
    throw sourceFamilyError(
      'storage generation was not allocated by the exact same-device successor allocator',
      'STORAGE_ALLOCATION'
    );
  }
  return record;
}

function exactBuffer(device, buffer, label) {
  if (
    !buffer
    || webGpuBufferDevice(buffer) !== device
    || !webGpuBufferMatchesDevice(buffer, device)
  ) {
    throw sourceFamilyError(`${label} is not an exact live same-device buffer`);
  }
  return buffer;
}

function requireCapacity(buffer, particleCount, strideBytes, label) {
  if (
    Number.isFinite(Number(buffer?.size))
    && Number(buffer.size) < particleCount * strideBytes
  ) {
    throw sourceFamilyError(`${label} capacity is smaller than its declared family`);
  }
}

function requirePairwiseDistinctBuffers(buffers) {
  const entries = Object.entries(buffers);
  if (new Set(entries.map(([, buffer]) => buffer)).size !== entries.length) {
    const aliases = entries
      .filter(([, buffer], index) => (
        entries.findIndex(([, candidate]) => candidate === buffer) !== index
      ))
      .map(([name]) => name);
    throw sourceFamilyError(
      `successor state, thermo, identity, and mechanics buffers must be pairwise distinct${
        aliases.length ? ` (aliases: ${aliases.join(', ')})` : ''
      }`,
      'BUFFER_ALIAS'
    );
  }
}

function exactEpochPair(sphUpload, mlsUpload) {
  const epochIdentity = {};
  for (const field of EPOCH_FIELDS) {
    const sphValue = exactU32(
      sphUpload[field],
      `sphParticleUpload.${field}`,
      { positive: field === 'storageGeneration' }
    );
    const mlsValue = exactU32(
      mlsUpload[field],
      `mlsMpmParticleUpload.${field}`,
      { positive: field === 'storageGeneration' }
    );
    if (sphValue !== mlsValue) {
      throw sourceFamilyError(`successor ${field} values differ`);
    }
    epochIdentity[field] = sphValue;
  }
  return epochIdentity;
}

function validateSuccessorUploadFamily(nextParticleUploads) {
  const sphUpload = nextParticleUploads?.sphParticleUpload ?? null;
  const mlsUpload = nextParticleUploads?.mlsMpmParticleUpload ?? null;
  if (!sphUpload || !mlsUpload) {
    throw sourceFamilyError('successor publication requires SPH and MLS-MPM uploads');
  }
  const device = webGpuBufferDevice(sphUpload.stateBuffer);
  requireDevice(device);
  const particleCount = exactU32(
    sphUpload.particleCount,
    'sphParticleUpload.particleCount',
    { positive: true }
  );
  if (exactU32(mlsUpload.particleCount, 'mlsMpmParticleUpload.particleCount', {
    positive: true
  }) !== particleCount) {
    throw sourceFamilyError('successor upload counts differ');
  }
  const buffers = Object.freeze({
    stateBuffer: exactBuffer(device, sphUpload.stateBuffer, 'successor state'),
    thermoBuffer: exactBuffer(device, sphUpload.thermoBuffer, 'successor thermo'),
    identityBuffer: exactBuffer(device, sphUpload.identityBuffer, 'successor identity'),
    mechanicsBuffer: exactBuffer(device, mlsUpload.mechanicsBuffer, 'successor mechanics')
  });
  requirePairwiseDistinctBuffers(buffers);
  const strides = Object.freeze({
    stateStrideBytes: exactU32(
      sphUpload.stateStrideBytes,
      'sphParticleUpload.stateStrideBytes',
      { positive: true }
    ),
    thermoStrideBytes: exactU32(
      sphUpload.thermoStrideBytes,
      'sphParticleUpload.thermoStrideBytes',
      { positive: true }
    ),
    identityStrideBytes: exactU32(
      sphUpload.identityStrideBytes,
      'sphParticleUpload.identityStrideBytes',
      { positive: true }
    ),
    mechanicsStrideBytes: exactU32(
      mlsUpload.mechanicsStrideBytes,
      'mlsMpmParticleUpload.mechanicsStrideBytes',
      { positive: true }
    )
  });
  requireCapacity(buffers.stateBuffer, particleCount, strides.stateStrideBytes, 'state');
  requireCapacity(buffers.thermoBuffer, particleCount, strides.thermoStrideBytes, 'thermo');
  requireCapacity(buffers.identityBuffer, particleCount, strides.identityStrideBytes, 'identity');
  requireCapacity(
    buffers.mechanicsBuffer,
    particleCount,
    strides.mechanicsStrideBytes,
    'mechanics'
  );
  return { device, particleCount, sphUpload, mlsUpload, buffers, strides };
}

function exactSourceEpochIdentity(generation) {
  const execution = generation?.execution;
  return Object.freeze(Object.fromEntries(EPOCH_FIELDS.map((field) => [
    field,
    exactU32(execution?.[field], `generation.execution.${field}`, {
      positive: field === 'storageGeneration'
    })
  ])));
}

function exactQueryGeometry(generation) {
  const execution = generation?.execution ?? null;
  const profile = execution?.exactNearQueryProfile ?? null;
  if (
    profile?.ready !== true
    || execution?.queryChartId !== profile.chartId
    || execution?.queryMinLevel !== profile.minLevel
    || execution?.queryMaxLevel !== profile.maxLevel
    || !Object.is(execution?.queryBaseGridSpacingM, profile.baseGridSpacingM)
  ) {
    return Object.freeze({
      authenticated: false,
      status: 'schroeder-successor-query-geometry-unavailable'
    });
  }
  return Object.freeze({
    authenticated: true,
    status: 'schroeder-successor-query-geometry-authenticated',
    mode: execution.queryGeometryMode,
    chartId: execution.queryChartId,
    minLevel: execution.queryMinLevel,
    maxLevel: execution.queryMaxLevel,
    levelCount: execution.queryLevelCount,
    baseGridSpacingM: execution.queryBaseGridSpacingM
  });
}

function normalizeComponentOwnerStages(componentOwnerStages) {
  if (componentOwnerStages == null) return Object.freeze({});
  if (typeof componentOwnerStages !== 'object' || Array.isArray(componentOwnerStages)) {
    throw sourceFamilyError('componentOwnerStages must be an object', 'CONTRACT');
  }
  return Object.freeze(Object.fromEntries(
    Object.entries(componentOwnerStages).map(([component, owner]) => {
      const ownerStage = typeof owner === 'string' ? owner : owner?.ownerStage;
      if (typeof ownerStage !== 'string' || ownerStage.length === 0) {
        throw sourceFamilyError(
          `componentOwnerStages.${component} must be a non-empty string`,
          'CONTRACT'
        );
      }
      return [component, ownerStage];
    })
  ));
}

function normalizedReason(value, fallback) {
  const candidates = [
    typeof value === 'string' ? value : null,
    typeof value?.message === 'string' ? value.message : null,
    typeof value?.reason === 'string' ? value.reason : null
  ];
  for (const candidate of candidates) {
    const reason = candidate?.trim();
    if (reason) return reason;
  }
  return fallback;
}

function exactSourceFamilyRecord(
  sourceFamily,
  { device = null, requireDevice = false } = {}
) {
  const record = sourceFamilyRecords.get(sourceFamily);
  if (
    !record
    || !finalizedSourceFamilies.has(sourceFamily)
    || sourceFamily?.schema !== ULG_SCHROEDER_SPATIAL_SUCCESSOR_SOURCE_FAMILY_SCHEMA
    || !Object.isFrozen(sourceFamily)
    || sourceFamily.ready !== true
    || sourceFamily.authenticated !== true
    || sourceFamily.spatialQueryAuthority !== false
    || (requireDevice && record.device !== device)
    || (device != null && record.device !== device)
    || (device != null && sourceFamily.deviceId !== webGpuDeviceId(device))
  ) {
    throw sourceFamilyError(
      'source family does not identify the exact committed same-device continuation'
    );
  }
  return record;
}

function sourceFamilyLivenessSummary(sourceFamily, record) {
  const status = record.deviceLost
    ? 'schroeder-successor-source-family-device-lost-quarantined'
    : (record.active
      ? (record.leaseCount > 0
        ? 'schroeder-successor-source-family-active-leased'
        : 'schroeder-successor-source-family-active')
      : (record.retired
        ? 'schroeder-successor-source-family-retired'
        : 'schroeder-successor-source-family-retirement-requested'));
  return Object.freeze({
    schema: ULG_SCHROEDER_SPATIAL_SUCCESSOR_SOURCE_FAMILY_LIVENESS_SCHEMA,
    status,
    active: record.active,
    retired: record.retired,
    quarantined: record.deviceLost,
    deviceLost: record.deviceLost,
    reason: record.reason,
    leaseCount: record.leaseCount,
    retirementRequested: record.retirementRequested === true,
    retirementFenceSettled: record.retirementFenceSettled === true,
    retirementBlocked: (
      record.leaseCount > 0
      || (record.retirementRequested === true
        && record.retirementFenceSettled !== true)
    ),
    ownsBuffers: false,
    sourceGenerationId: sourceFamily.sourceGenerationId,
    deviceId: sourceFamily.deviceId
  });
}

function requireActiveSourceFamily(record) {
  if (record.deviceLost) {
    throw sourceFamilyError(
      `successor source family is quarantined after device loss: ${record.reason}`,
      'DEVICE_LOST'
    );
  }
  if (record.retired) {
    throw sourceFamilyError(
      `successor source family is retired: ${record.reason}`,
      'RETIRED'
    );
  }
  if (record.retirementRequested) {
    throw sourceFamilyError(
      `successor source family retirement was requested: ${record.reason}`,
      'RETIREMENT_REQUESTED'
    );
  }
  if (!record.active) {
    throw sourceFamilyError(
      `successor source family is retired: ${record.reason}`,
      'RETIRED'
    );
  }
}

function retirementReceipt(sourceFamily, record, status) {
  return Object.freeze({
    schema: ULG_SCHROEDER_SPATIAL_SUCCESSOR_RETIREMENT_RECEIPT_SCHEMA,
    status,
    settled: record.retired === true || record.deviceLost === true,
    retired: record.retired,
    quarantined: record.deviceLost,
    deviceLost: record.deviceLost,
    reason: record.reason,
    remainingLeaseCount: record.leaseCount,
    sourceGenerationId: sourceFamily.sourceGenerationId,
    deviceId: sourceFamily.deviceId
  });
}

function settleRequestedRetirement(sourceFamily, record) {
  if (!record.retirementRequested || record.retirementSettled) return false;
  if (record.deviceLost) {
    record.retirementSettled = true;
    record.resolveRetirement?.(retirementReceipt(
      sourceFamily,
      record,
      'schroeder-successor-source-family-device-lost-quarantined'
    ));
    return true;
  }
  if (!record.retirementFenceSettled || record.leaseCount > 0) return false;
  record.active = false;
  record.retired = true;
  record.retirementSettled = true;
  record.resolveRetirement?.(retirementReceipt(
    sourceFamily,
    record,
    'schroeder-successor-source-family-retired-after-leases'
  ));
  return true;
}

function quarantineSourceFamilyAfterDeviceLoss(sourceFamily, record, info) {
  record.active = false;
  record.deviceLost = true;
  record.reason = normalizedReason(info, 'WebGPU device lost');
  settleRequestedRetirement(sourceFamily, record);
}

function watchSourceFamilyDeviceLoss(sourceFamily, device) {
  let deviceLoss;
  try {
    deviceLoss = device?.lost;
  } catch {
    return;
  }
  if (!deviceLoss || typeof deviceLoss.then !== 'function') return;
  let quarantineAfterLoss;
  if (typeof WeakRef === 'function') {
    const sourceFamilyRef = new WeakRef(sourceFamily);
    quarantineAfterLoss = (info) => {
      const liveSourceFamily = sourceFamilyRef.deref();
      const liveRecord = liveSourceFamily
        ? sourceFamilyRecords.get(liveSourceFamily)
        : null;
      if (liveRecord) {
        quarantineSourceFamilyAfterDeviceLoss(liveSourceFamily, liveRecord, info);
      }
    };
  } else {
    quarantineAfterLoss = (info) => {
      const liveRecord = sourceFamilyRecords.get(sourceFamily);
      if (liveRecord) quarantineSourceFamilyAfterDeviceLoss(sourceFamily, liveRecord, info);
    };
  }
  Promise.resolve(deviceLoss).then(
    quarantineAfterLoss,
    quarantineAfterLoss
  );
}

function reserveSuccessorPublicationSlot(nextParticleUploads) {
  if (!nextParticleUploads || typeof nextParticleUploads !== 'object') {
    throw sourceFamilyError('successor publication requires a mutable upload envelope');
  }
  const key = 'schroederSpatialSuccessorSourceFamily';
  const existing = Object.getOwnPropertyDescriptor(nextParticleUploads, key);
  if (existing) {
    if (
      !('value' in existing)
      || existing.value != null
      || existing.writable !== true
    ) {
      throw sourceFamilyError(
        'successor publication slot is already occupied or not writable',
        'PUBLICATION_SLOT'
      );
    }
    return;
  }
  Object.defineProperty(nextParticleUploads, key, {
    value: null,
    writable: true,
    configurable: true,
    enumerable: true
  });
}

function stampSuccessorEpochIdentity(sphUpload, mlsUpload, identity) {
  for (const [field, value] of Object.entries(identity)) {
    sphUpload[field] = value;
    mlsUpload[field] = value;
  }
  sphUpload.bufferFamilyGeneration = identity.storageGeneration;
  mlsUpload.bufferFamilyGeneration = identity.storageGeneration;
  sphUpload.bufferFamilyGenerationStatus = 'schroeder-buffer-family-generation-ready';
  mlsUpload.bufferFamilyGenerationStatus = 'schroeder-buffer-family-generation-ready';
}

function preparedUploadFamilyPreserved(
  nextParticleUploads,
  sourceFamily,
  buffers
) {
  const sphUpload = nextParticleUploads?.sphParticleUpload;
  const mlsUpload = nextParticleUploads?.mlsMpmParticleUpload;
  return Boolean(
    sphUpload
    && mlsUpload
    && sphUpload.stateBuffer === buffers.stateBuffer
    && sphUpload.thermoBuffer === buffers.thermoBuffer
    && sphUpload.identityBuffer === buffers.identityBuffer
    && mlsUpload.mechanicsBuffer === buffers.mechanicsBuffer
    && sphUpload.particleCount === sourceFamily.particleCount
    && mlsUpload.particleCount === sourceFamily.particleCount
    && EPOCH_FIELDS.every((field) => (
      sphUpload[field] === sourceFamily.successorEpochIdentity[field]
      && mlsUpload[field] === sourceFamily.successorEpochIdentity[field]
    ))
    && sphUpload.bufferFamilyGeneration === sourceFamily.storageGeneration
    && mlsUpload.bufferFamilyGeneration === sourceFamily.storageGeneration
  );
}

function newSourceFamilyRecord({
  device,
  transaction,
  commitReceipt = null,
  generation,
  nextParticleUploads,
  topologyTransitionReceipt,
  positionEpochFloorReceipt = null,
  sphUpload,
  mlsUpload,
  buffers,
  storageAllocation = null
}) {
  return {
    device,
    transaction,
    commitReceipt,
    generation,
    nextParticleUploads,
    topologyTransitionReceipt,
    positionEpochFloorReceipt,
    storageAllocation,
    sphUpload,
    mlsUpload,
    buffers,
    active: true,
    retired: false,
    deviceLost: false,
    reason: null,
    leaseCount: 0,
    nextLeaseOrdinal: 0,
    retirementRequested: false,
    retirementFenceSettled: false,
    retirementSettled: false,
    retirementPromise: null,
    resolveRetirement: null
  };
}

function publicationReceipt({
  status,
  published,
  sourceFamily = null,
  reason = null,
  publicationRecord = null
}) {
  const receipt = Object.freeze({
    schema: ULG_SCHROEDER_SPATIAL_SUCCESSOR_PUBLICATION_RECEIPT_SCHEMA,
    status,
    published,
    sourceFamily,
    reason
  });
  if (publicationRecord) {
    successorPublicationReceiptRecords.set(receipt, publicationRecord);
  }
  return receipt;
}

/**
 * Complete all fallible successor identity checks and reserve the upload
 * attachment before the physics transaction commits. No public family is
 * branded by this step.
 */
export async function prepareSchroederSpatialSuccessorSourceFamilyPublication({
  transaction,
  generation,
  nextParticleUploads,
  topologyTransitionReceipt = null,
  conservativeTopologyAdvance = false,
  placementPositionEpochFloorReceipt =
    nextParticleUploads?.schroederSpatialReactionPlacementPositionEpochFloorReceipt
      ?? null,
  forcePositionAdvance = false,
  componentOwnerStages = null
} = {}) {
  const uploadFamily = validateSuccessorUploadFamily(nextParticleUploads);
  const {
    device,
    particleCount,
    sphUpload,
    mlsUpload,
    buffers,
    strides
  } = uploadFamily;
  if (!transaction || !generation) {
    throw sourceFamilyError(
      'successor preflight requires exact transaction and source generation'
    );
  }
  const sourceEpochIdentity = exactSourceEpochIdentity(generation);
  const observedTopologyTransition = topologyTransitionReceipt != null;
  if (
    observedTopologyTransition
    && !validateSchroederSpatialTopologyTransitionReceipt(
      topologyTransitionReceipt,
      { generation, nextParticleUploads }
    )
  ) {
    throw sourceFamilyError(
      'successor preflight rejected the supplied topology authority',
      'TOPOLOGY_TRANSITION'
    );
  }
  if (!observedTopologyTransition && conservativeTopologyAdvance !== true) {
    throw sourceFamilyError(
      'successor preflight requires observed topology authority or conservative advance',
      'TOPOLOGY_TRANSITION'
    );
  }
  const topologyAuthority = observedTopologyTransition
    ? Object.freeze({
        mode: 'observed-compact-topology-receipt',
        sourceTopologyEpoch: topologyTransitionReceipt.sourceTopologyEpoch,
        nextTopologyEpoch: topologyTransitionReceipt.nextTopologyEpoch,
        topologyChanged: topologyTransitionReceipt.topologyChanged === true,
        status: topologyTransitionReceipt.status,
        generationId: topologyTransitionReceipt.generationId,
        activatedCount: topologyTransitionReceipt.activatedCount,
        deactivatedCount: topologyTransitionReceipt.deactivatedCount
      })
    : Object.freeze({
        mode: 'gpu-resident-conservative-topology-advance',
        sourceTopologyEpoch: sourceEpochIdentity.topologyEpoch,
        nextTopologyEpoch: incrementExactU32(
          sourceEpochIdentity.topologyEpoch,
          'successor topology epoch'
        ),
        topologyChanged: true,
        status: 'schroeder-successor-topology-conservatively-advanced',
        generationId: exactU32(
          generation.execution?.generationId,
          'generation.execution.generationId',
          { positive: true }
        ),
        activatedCount: null,
        deactivatedCount: null
      });
  const observedUploadIdentity = exactEpochPair(sphUpload, mlsUpload);
  const positionTransitionAuthenticated = false;
  let positionEpochFloorAuthenticated = false;
  let positionEpochFloor = sourceEpochIdentity.positionEpoch;
  if (placementPositionEpochFloorReceipt) {
    const {
      validateSchroederSpatialReactionPlacementPositionEpochFloor
    } = await import('./schroederSpatialReactionPlacementEpochGpu.js');
    if (!validateSchroederSpatialReactionPlacementPositionEpochFloor(
      placementPositionEpochFloorReceipt,
      {
        device,
        ancestorPublicGeneration: generation
      }
    )) {
      throw sourceFamilyError(
        'placement position epoch floor is not branded and bound to this ancestor',
        'POSITION_TRANSITION_FLOOR'
      );
    }
    positionEpochFloor = exactU32(
      placementPositionEpochFloorReceipt.positionEpochFloor,
      'placement position epoch floor'
    );
    if (positionEpochFloor <= sourceEpochIdentity.positionEpoch) {
      throw sourceFamilyError(
        'placement position epoch floor did not advance the public ancestor',
        'POSITION_TRANSITION_FLOOR'
      );
    }
    positionEpochFloorAuthenticated = true;
  }
  const positionChanged = Boolean(
    forcePositionAdvance
    || topologyAuthority.topologyChanged === true
    || positionEpochFloorAuthenticated
  );
  const conservativelyAdvancedPositionEpoch = positionChanged
    ? incrementExactU32(
        sourceEpochIdentity.positionEpoch,
        'successor position epoch'
      )
    : sourceEpochIdentity.positionEpoch;
  const nextPositionEpoch = positionEpochFloorAuthenticated
    ? Math.max(conservativelyAdvancedPositionEpoch, positionEpochFloor)
    : conservativelyAdvancedPositionEpoch;
  const allocation = allocateSchroederSpatialSuccessorBufferFamilyIdentity({
    device,
    afterStorageGeneration: Math.max(
      sourceEpochIdentity.storageGeneration,
      observedUploadIdentity.storageGeneration
    ),
    purpose: 'committed-successor-final-buffer-family'
  });
  exactBufferFamilyAllocation(allocation, device);
  const successorEpochIdentity = Object.freeze({
    storageGeneration: allocation.storageGeneration,
    physicsTick: observedUploadIdentity.physicsTick,
    physicsSubstep: observedUploadIdentity.physicsSubstep,
    positionEpoch: nextPositionEpoch,
    topologyEpoch: exactU32(
      topologyAuthority.nextTopologyEpoch,
      'successor topology epoch'
    ),
    chartEpoch: observedUploadIdentity.chartEpoch,
    levelEpoch: observedUploadIdentity.levelEpoch,
    supportEpoch: observedUploadIdentity.supportEpoch
  });
  const ownerStages = normalizeComponentOwnerStages(componentOwnerStages);
  const queryGeometry = exactQueryGeometry(generation);
  reserveSuccessorPublicationSlot(nextParticleUploads);
  stampSuccessorEpochIdentity(sphUpload, mlsUpload, successorEpochIdentity);
  if (
    observedTopologyTransition
    && !validateSchroederSpatialTopologyTransitionReceipt(
      topologyTransitionReceipt,
      { generation, nextParticleUploads }
    )
  ) {
    throw sourceFamilyError(
      'topology authority was invalidated while stamping final successor identity',
      'TOPOLOGY_TRANSITION'
    );
  }
  const sourceFamily = Object.freeze({
    schema: ULG_SCHROEDER_SPATIAL_SUCCESSOR_SOURCE_FAMILY_SCHEMA,
    status: 'schroeder-committed-successor-source-family-authenticated',
    ready: true,
    admitted: true,
    authenticated: true,
    ownsBuffers: false,
    sourceFamily: 'hot-particle-successor',
    sourceFamilyRole: 'committed-successor-x-n-plus-1',
    coordinateAuthority: 'final-successor-particle-state',
    positionAuthority: positionEpochFloorAuthenticated
        ? 'authenticated-transactional-placement-epoch-floor-with-conservative-final-family'
        : (forcePositionAdvance
        ? 'authenticated-mechanics-integration-transition'
        : 'authenticated-topology-or-invariant-transition'),
    publicationAuthority: 'spatial-epoch-transaction-preflight-and-commit',
    exactBufferFamilyAuthenticated: true,
    storageAllocationAuthenticated: true,
    topologyTransitionAuthenticated: true,
    positionTransitionAuthenticated,
    positionEpochFloorAuthenticated,
    positionEpochFloor: positionEpochFloorAuthenticated
      ? positionEpochFloor
      : null,
    positionChanged,
    spatialQueryAuthority: false,
    spatialDirectoryReady: false,
    canonicalSpatialGenerationAvailable: false,
    canonicalSpatialGenerationStatus: 'not-built',
    spatialDirectoryGenerationId: null,
    sourceGenerationId: topologyAuthority.generationId,
    ancestorSpatialGenerationId: topologyAuthority.generationId,
    deviceId: webGpuDeviceId(device),
    particleCount,
    sourceEpochIdentity,
    successorEpochIdentity,
    ...successorEpochIdentity,
    ...strides,
    sourceTopologyEpoch: topologyAuthority.sourceTopologyEpoch,
    nextTopologyEpoch: topologyAuthority.nextTopologyEpoch,
    topologyChanged: topologyAuthority.topologyChanged,
    topologyTransitionStatus: topologyAuthority.status,
    topologyTransitionMode: topologyAuthority.mode,
    activatedCount: topologyAuthority.activatedCount,
    deactivatedCount: topologyAuthority.deactivatedCount,
    componentOwnerStages: ownerStages,
    queryGeometry,
    fullParticleReadbackRequired: false,
    fullParticleReadbackPerformed: false
  });
  const plan = Object.freeze({
    schema: ULG_SCHROEDER_SPATIAL_SUCCESSOR_PUBLICATION_PLAN_SCHEMA,
    status: 'schroeder-successor-source-family-publication-prepared',
    prepared: true,
    deviceId: webGpuDeviceId(device),
    particleCount,
    sourceGenerationId: sourceFamily.sourceGenerationId,
    storageGeneration: successorEpochIdentity.storageGeneration,
    positionEpoch: successorEpochIdentity.positionEpoch,
    topologyEpoch: successorEpochIdentity.topologyEpoch
  });
  const sourceFamilyRecord = newSourceFamilyRecord({
    device,
    transaction,
    generation,
    nextParticleUploads,
    topologyTransitionReceipt,
    topologyAuthority,
    positionEpochFloorReceipt: placementPositionEpochFloorReceipt,
    sphUpload,
    mlsUpload,
    buffers,
    storageAllocation: allocation
  });
  successorPublicationPlanRecords.set(plan, {
    transaction,
    generation,
    nextParticleUploads,
    topologyTransitionReceipt,
    topologyAuthority,
    sourceFamily,
    sourceFamilyRecord,
    attempted: false
  });
  preparedSuccessorPublicationPlans.add(plan);
  return plan;
}

/**
 * Publish a prepared family after commit. This function is deliberately
 * total: a rejected/tampered plan returns a failure receipt and never throws
 * into already-committed physics.
 */
export function publishPreparedSchroederSpatialSuccessorSourceFamily(
  plan,
  { commitReceipt } = {}
) {
  try {
    const prepared = successorPublicationPlanRecords.get(plan);
    if (
      !prepared
      || !preparedSuccessorPublicationPlans.has(plan)
      || plan?.schema !== ULG_SCHROEDER_SPATIAL_SUCCESSOR_PUBLICATION_PLAN_SCHEMA
      || !Object.isFrozen(plan)
      || prepared.attempted
    ) {
      return publicationReceipt({
        status: 'schroeder-successor-source-family-publication-rejected',
        published: false,
        reason: 'publication plan is foreign, invalid, or already consumed'
      });
    }
    prepared.attempted = true;
    const {
      transaction,
      generation,
      nextParticleUploads,
      topologyTransitionReceipt,
      topologyAuthority,
      sourceFamily,
      sourceFamilyRecord
    } = prepared;
    if (
      sourceFamilyByCommitReceipt.has(commitReceipt)
      || !validateSchroederSpatialEpochTransactionCommit(
        transaction,
        commitReceipt,
        { nextParticleUploads, expectedGeneration: generation }
      )
      || (
        topologyTransitionReceipt != null
        && !validateSchroederSpatialTopologyTransitionReceipt(
          topologyTransitionReceipt,
          { generation, nextParticleUploads }
        )
      )
      || topologyAuthority?.generationId !== sourceFamily.sourceGenerationId
      || !preparedUploadFamilyPreserved(
        nextParticleUploads,
        sourceFamily,
        sourceFamilyRecord.buffers
      )
      || nextParticleUploads.schroederSpatialSuccessorSourceFamily !== null
      || !Reflect.set(
        nextParticleUploads,
        'schroederSpatialSuccessorSourceFamily',
        sourceFamily
      )
      || nextParticleUploads.schroederSpatialSuccessorSourceFamily !== sourceFamily
    ) {
      return publicationReceipt({
        status: 'schroeder-successor-source-family-publication-rejected',
        published: false,
        reason: 'commit or reserved publication slot did not preserve exact identity'
      });
    }
    sourceFamilyRecord.commitReceipt = commitReceipt;
    sourceFamilyRecords.set(sourceFamily, sourceFamilyRecord);
    finalizedSourceFamilies.add(sourceFamily);
    sourceFamilyByCommitReceipt.set(commitReceipt, sourceFamily);
    watchSourceFamilyDeviceLoss(sourceFamily, sourceFamilyRecord.device);
    return publicationReceipt({
      status: 'schroeder-successor-source-family-published',
      published: true,
      sourceFamily,
      publicationRecord: {
        plan,
        commitReceipt,
        transaction,
        generation,
        nextParticleUploads,
        sourceFamily
      }
    });
  } catch (error) {
    return publicationReceipt({
      status: 'schroeder-successor-source-family-publication-rejected',
      published: false,
      reason: error instanceof Error ? error.message : String(error)
    });
  }
}

/**
 * Validate a successful publication receipt against the exact prepared plan,
 * transaction commit, and reserved continuation envelope.  Public fields are
 * intentionally insufficient: only a module-issued receipt is accepted.
 */
export function validateSchroederSpatialSuccessorPublicationReceipt(
  receipt,
  {
    plan = null,
    commitReceipt = null,
    nextParticleUploads = null,
    sourceFamily = null
  } = {}
) {
  const record = successorPublicationReceiptRecords.get(receipt);
  const family = receipt?.sourceFamily ?? null;
  const familyRecord = sourceFamilyRecords.get(family);
  return Boolean(
    record
    && receipt?.schema
      === ULG_SCHROEDER_SPATIAL_SUCCESSOR_PUBLICATION_RECEIPT_SCHEMA
    && Object.isFrozen(receipt)
    && receipt.status === 'schroeder-successor-source-family-published'
    && receipt.published === true
    && receipt.reason == null
    && family
    && family === record.sourceFamily
    && finalizedSourceFamilies.has(family)
    && familyRecord
    && familyRecord.commitReceipt === record.commitReceipt
    && familyRecord.transaction === record.transaction
    && familyRecord.generation === record.generation
    && familyRecord.nextParticleUploads === record.nextParticleUploads
    && record.nextParticleUploads?.schroederSpatialSuccessorSourceFamily
      === family
    && (plan == null || record.plan === plan)
    && (commitReceipt == null || record.commitReceipt === commitReceipt)
    && (
      nextParticleUploads == null
      || record.nextParticleUploads === nextParticleUploads
    )
    && (sourceFamily == null || family === sourceFamily)
  );
}

/**
 * Attest the exact committed x_(n+1) family without claiming that it already
 * has a canonical spatial directory. Exact receipts and buffers remain in the
 * module-owned record; the public frozen descriptor contains summaries only.
 */
export function createSchroederSpatialSuccessorSourceFamily({
  transaction,
  commitReceipt,
  generation,
  nextParticleUploads,
  topologyTransitionReceipt,
  componentOwnerStages = null
} = {}) {
  const sphUpload = nextParticleUploads?.sphParticleUpload ?? null;
  const mlsUpload = nextParticleUploads?.mlsMpmParticleUpload ?? null;
  if (
    !validateSchroederSpatialEpochTransactionCommit(
      transaction,
      commitReceipt,
      { nextParticleUploads, expectedGeneration: generation }
    )
    || !validateSchroederSpatialTopologyTransitionReceipt(
      topologyTransitionReceipt,
      { generation, nextParticleUploads }
    )
    || !sphUpload
    || !mlsUpload
  ) {
    throw sourceFamilyError(
      'committed successor requires exact transaction and applied topology authority'
    );
  }
  if (sourceFamilyByCommitReceipt.has(commitReceipt)) {
    throw sourceFamilyError(
      'one transaction commit can publish exactly one successor source family',
      'DUPLICATE_PUBLICATION'
    );
  }

  const device = webGpuBufferDevice(sphUpload.stateBuffer);
  const particleCount = exactU32(
    sphUpload.particleCount,
    'sphParticleUpload.particleCount',
    { positive: true }
  );
  if (exactU32(mlsUpload.particleCount, 'mlsMpmParticleUpload.particleCount', {
    positive: true
  }) !== particleCount) {
    throw sourceFamilyError('successor upload counts differ');
  }
  const buffers = Object.freeze({
    stateBuffer: exactBuffer(device, sphUpload.stateBuffer, 'successor state'),
    thermoBuffer: exactBuffer(device, sphUpload.thermoBuffer, 'successor thermo'),
    identityBuffer: exactBuffer(device, sphUpload.identityBuffer, 'successor identity'),
    mechanicsBuffer: exactBuffer(device, mlsUpload.mechanicsBuffer, 'successor mechanics')
  });
  requirePairwiseDistinctBuffers(buffers);
  const epochIdentity = {};
  for (const field of EPOCH_FIELDS) {
    const sphValue = exactU32(
      sphUpload[field],
      `sphParticleUpload.${field}`,
      { positive: field === 'storageGeneration' }
    );
    const mlsValue = exactU32(
      mlsUpload[field],
      `mlsMpmParticleUpload.${field}`,
      { positive: field === 'storageGeneration' }
    );
    if (sphValue !== mlsValue) {
      throw sourceFamilyError(`successor ${field} values differ`);
    }
    epochIdentity[field] = sphValue;
  }
  const strides = Object.freeze({
    stateStrideBytes: exactU32(
      sphUpload.stateStrideBytes,
      'sphParticleUpload.stateStrideBytes',
      { positive: true }
    ),
    thermoStrideBytes: exactU32(
      sphUpload.thermoStrideBytes,
      'sphParticleUpload.thermoStrideBytes',
      { positive: true }
    ),
    identityStrideBytes: exactU32(
      sphUpload.identityStrideBytes,
      'sphParticleUpload.identityStrideBytes',
      { positive: true }
    ),
    mechanicsStrideBytes: exactU32(
      mlsUpload.mechanicsStrideBytes,
      'mlsMpmParticleUpload.mechanicsStrideBytes',
      { positive: true }
    )
  });
  requireCapacity(buffers.stateBuffer, particleCount, strides.stateStrideBytes, 'state');
  requireCapacity(buffers.thermoBuffer, particleCount, strides.thermoStrideBytes, 'thermo');
  requireCapacity(buffers.identityBuffer, particleCount, strides.identityStrideBytes, 'identity');
  requireCapacity(
    buffers.mechanicsBuffer,
    particleCount,
    strides.mechanicsStrideBytes,
    'mechanics'
  );

  const sourceEpochIdentity = Object.freeze(Object.fromEntries(
    EPOCH_FIELDS.map((field) => [field, generation.execution[field]])
  ));
  const successorEpochIdentity = Object.freeze({ ...epochIdentity });
  const queryGeometry = exactQueryGeometry(generation);
  const ownerStages = normalizeComponentOwnerStages(componentOwnerStages);
  const sourceFamily = Object.freeze({
    schema: ULG_SCHROEDER_SPATIAL_SUCCESSOR_SOURCE_FAMILY_SCHEMA,
    status: 'schroeder-committed-successor-source-family-authenticated',
    ready: true,
    admitted: true,
    authenticated: true,
    ownsBuffers: false,
    sourceFamily: 'hot-particle-successor',
    sourceFamilyRole: 'committed-successor-x-n-plus-1',
    coordinateAuthority: 'final-successor-particle-state',
    positionAuthority: 'same-epoch-final-continuation-particle-state',
    publicationAuthority: 'spatial-epoch-transaction-commit',
    exactBufferFamilyAuthenticated: true,
    topologyTransitionAuthenticated: true,
    positionTransitionAuthenticated: false,
    spatialQueryAuthority: false,
    spatialDirectoryReady: false,
    canonicalSpatialGenerationAvailable: false,
    canonicalSpatialGenerationStatus: 'not-built',
    spatialDirectoryGenerationId: null,
    sourceGenerationId: topologyTransitionReceipt.generationId,
    ancestorSpatialGenerationId: topologyTransitionReceipt.generationId,
    deviceId: webGpuDeviceId(device),
    particleCount,
    sourceEpochIdentity,
    successorEpochIdentity,
    ...successorEpochIdentity,
    ...strides,
    sourceTopologyEpoch: topologyTransitionReceipt.sourceTopologyEpoch,
    nextTopologyEpoch: topologyTransitionReceipt.nextTopologyEpoch,
    topologyChanged: topologyTransitionReceipt.topologyChanged,
    topologyTransitionStatus: topologyTransitionReceipt.status,
    activatedCount: topologyTransitionReceipt.activatedCount,
    deactivatedCount: topologyTransitionReceipt.deactivatedCount,
    componentOwnerStages: ownerStages,
    queryGeometry,
    fullParticleReadbackRequired: false,
    fullParticleReadbackPerformed: false
  });
  const sourceFamilyRecord = {
    device,
    transaction,
    commitReceipt,
    generation,
    nextParticleUploads,
    topologyTransitionReceipt,
    sphUpload,
    mlsUpload,
    buffers,
    active: true,
    retired: false,
    deviceLost: false,
    reason: null,
    leaseCount: 0,
    nextLeaseOrdinal: 0,
    retirementRequested: false,
    retirementFenceSettled: false,
    retirementSettled: false,
    retirementPromise: null,
    resolveRetirement: null
  };
  sourceFamilyRecords.set(sourceFamily, sourceFamilyRecord);
  finalizedSourceFamilies.add(sourceFamily);
  sourceFamilyByCommitReceipt.set(commitReceipt, sourceFamily);
  nextParticleUploads.schroederSpatialSuccessorSourceFamily = sourceFamily;
  watchSourceFamilyDeviceLoss(sourceFamily, device);
  return sourceFamily;
}

export function isFinalizedSchroederSpatialSuccessorSourceFamily(sourceFamily) {
  return finalizedSourceFamilies.has(sourceFamily)
    && sourceFamilyRecords.has(sourceFamily);
}

/** Read the current private liveness state without exposing devices or buffers. */
export function schroederSpatialSuccessorSourceFamilyLiveness(
  sourceFamily,
  { device = null } = {}
) {
  const record = exactSourceFamilyRecord(sourceFamily, { device });
  return sourceFamilyLivenessSummary(sourceFamily, record);
}

/**
 * Acquire an exact read-only consumer lease. The frozen lease is only an
 * identity token; mutable release state remains module-private.
 */
export function acquireSchroederSpatialSuccessorSourceFamilyLease(
  sourceFamily,
  {
    device,
    consumerStage = 'unspecified-successor-source-family-consumer'
  } = {}
) {
  const record = exactSourceFamilyRecord(sourceFamily, {
    device,
    requireDevice: true
  });
  requireActiveSourceFamily(record);
  const normalizedConsumerStage = typeof consumerStage === 'string'
    ? consumerStage.trim()
    : null;
  if (!normalizedConsumerStage) {
    throw sourceFamilyError(
      'successor source family lease requires a non-empty consumerStage',
      'CONTRACT'
    );
  }
  const leaseOrdinal = incrementExactU32(
    record.nextLeaseOrdinal,
    'successor source-family lease ordinal'
  );
  record.nextLeaseOrdinal = leaseOrdinal;
  const lease = Object.freeze({
    schema: ULG_SCHROEDER_SPATIAL_SUCCESSOR_SOURCE_FAMILY_LEASE_SCHEMA,
    sourceGenerationId: sourceFamily.sourceGenerationId,
    deviceId: sourceFamily.deviceId,
    leaseOrdinal,
    consumerStage: normalizedConsumerStage,
    readOnly: true
  });
  sourceFamilyLeaseRecords.set(lease, {
    sourceFamily,
    sourceFamilyRecord: record,
    released: false,
    releasePending: false,
    releasePromise: null
  });
  record.leaseCount += 1;
  return lease;
}

/** Release one exact lease exactly once, including after device loss. */
export function releaseSchroederSpatialSuccessorSourceFamilyLease(
  sourceFamily,
  lease,
  { device } = {}
) {
  const record = exactSourceFamilyRecord(sourceFamily, {
    device,
    requireDevice: true
  });
  const leaseRecord = sourceFamilyLeaseRecords.get(lease);
  if (
    !leaseRecord
    || lease?.schema !== ULG_SCHROEDER_SPATIAL_SUCCESSOR_SOURCE_FAMILY_LEASE_SCHEMA
    || !Object.isFrozen(lease)
    || leaseRecord.sourceFamily !== sourceFamily
    || leaseRecord.sourceFamilyRecord !== record
  ) {
    throw sourceFamilyError(
      'lease does not identify this exact successor source family',
      'LEASE_IDENTITY'
    );
  }
  if (leaseRecord.released) {
    throw sourceFamilyError(
      'successor source family lease was already released',
      'LEASE_RELEASED'
    );
  }
  if (leaseRecord.releasePending) {
    throw sourceFamilyError(
      'successor source family lease already has a queue-fenced release pending',
      'LEASE_RELEASE_PENDING'
    );
  }
  if (record.leaseCount < 1) {
    throw sourceFamilyError(
      'successor source family lease accounting underflow',
      'LEASE_ACCOUNTING'
    );
  }
  leaseRecord.released = true;
  record.leaseCount -= 1;
  settleRequestedRetirement(sourceFamily, record);
  return Object.freeze({
    schema: ULG_SCHROEDER_SPATIAL_SUCCESSOR_SOURCE_FAMILY_LEASE_RELEASE_SCHEMA,
    status: 'schroeder-successor-source-family-lease-released',
    released: true,
    leaseOrdinal: lease.leaseOrdinal,
    consumerStage: lease.consumerStage,
    sourceGenerationId: sourceFamily.sourceGenerationId,
    remainingLeaseCount: record.leaseCount,
    sourceFamilyStatus: sourceFamilyLivenessSummary(sourceFamily, record).status
  });
}

/**
 * Release one lease only after its exact consumer queue fence settles. A
 * rejected fence leaves the lease active and permits an explicit retry.
 */
export function releaseSchroederSpatialSuccessorSourceFamilyLeaseAfter(
  sourceFamily,
  lease,
  { device, after = null } = {}
) {
  const record = exactSourceFamilyRecord(sourceFamily, {
    device,
    requireDevice: true
  });
  const leaseRecord = sourceFamilyLeaseRecords.get(lease);
  if (
    !leaseRecord
    || leaseRecord.sourceFamily !== sourceFamily
    || leaseRecord.sourceFamilyRecord !== record
    || lease?.schema !== ULG_SCHROEDER_SPATIAL_SUCCESSOR_SOURCE_FAMILY_LEASE_SCHEMA
    || !Object.isFrozen(lease)
  ) {
    throw sourceFamilyError(
      'lease does not identify this exact successor source family',
      'LEASE_IDENTITY'
    );
  }
  if (leaseRecord.released) {
    throw sourceFamilyError(
      'successor source family lease was already released',
      'LEASE_RELEASED'
    );
  }
  if (leaseRecord.releasePending) return leaseRecord.releasePromise;
  let fence = after;
  if (fence == null) {
    fence = device?.queue?.onSubmittedWorkDone?.();
  }
  if (!fence || typeof fence.then !== 'function') {
    throw sourceFamilyError(
      'queue-fenced lease release requires an exact completion promise',
      'LEASE_FENCE'
    );
  }
  leaseRecord.releasePending = true;
  const releasePromise = Promise.resolve(fence).then(
    () => {
      if (leaseRecord.released) {
        throw sourceFamilyError(
          'successor source family lease was already released',
          'LEASE_RELEASED'
        );
      }
      if (record.leaseCount < 1) {
        throw sourceFamilyError(
          'successor source family lease accounting underflow',
          'LEASE_ACCOUNTING'
        );
      }
      leaseRecord.releasePending = false;
      leaseRecord.released = true;
      record.leaseCount -= 1;
      settleRequestedRetirement(sourceFamily, record);
      return Object.freeze({
        schema: ULG_SCHROEDER_SPATIAL_SUCCESSOR_SOURCE_FAMILY_LEASE_RELEASE_SCHEMA,
        status: 'schroeder-successor-source-family-lease-released-after-fence',
        released: true,
        queueFenceSettled: true,
        leaseOrdinal: lease.leaseOrdinal,
        consumerStage: lease.consumerStage,
        sourceGenerationId: sourceFamily.sourceGenerationId,
        remainingLeaseCount: record.leaseCount,
        sourceFamilyStatus: sourceFamilyLivenessSummary(sourceFamily, record).status
      });
    },
    (error) => {
      leaseRecord.releasePending = false;
      leaseRecord.releasePromise = null;
      throw error;
    }
  );
  leaseRecord.releasePromise = releasePromise;
  releasePromise.catch(() => {});
  return releasePromise;
}

/**
 * Retire publication authority without destroying the borrowed successor
 * buffers. Active consumer leases make normal retirement fail closed.
 */
export function retireSchroederSpatialSuccessorSourceFamily(
  sourceFamily,
  {
    device,
    reason = 'successor source family retired'
  } = {}
) {
  const record = exactSourceFamilyRecord(sourceFamily, {
    device,
    requireDevice: true
  });
  if (record.deviceLost || !record.active) {
    return sourceFamilyLivenessSummary(sourceFamily, record);
  }
  if (record.leaseCount > 0) {
    throw sourceFamilyError(
      `successor source family retirement is blocked by ${record.leaseCount} active lease(s)`,
      'ACTIVE_LEASES'
    );
  }
  record.active = false;
  record.retired = true;
  record.retirementRequested = true;
  record.retirementFenceSettled = true;
  record.retirementSettled = true;
  record.reason = normalizedReason(reason, 'successor source family retired');
  return sourceFamilyLivenessSummary(sourceFamily, record);
}

/**
 * Immediately revoke new consumers, then settle retirement only after the
 * owner fence and every already-issued lease fence have completed. Device
 * loss is a terminal quarantine and settles the request without pretending
 * that normal queue completion occurred.
 */
export function retireSchroederSpatialSuccessorSourceFamilyAfterLeases(
  sourceFamily,
  {
    device,
    reason = 'successor source family superseded',
    after = null
  } = {}
) {
  const record = exactSourceFamilyRecord(sourceFamily, {
    device,
    requireDevice: true
  });
  if (record.retirementPromise) return record.retirementPromise;
  if (record.deviceLost) {
    return Promise.resolve(retirementReceipt(
      sourceFamily,
      record,
      'schroeder-successor-source-family-device-lost-quarantined'
    ));
  }
  if (record.retired) {
    return Promise.resolve(retirementReceipt(
      sourceFamily,
      record,
      'schroeder-successor-source-family-retired'
    ));
  }
  let fence = after;
  if (fence == null) {
    fence = device?.queue?.onSubmittedWorkDone?.();
  }
  if (!fence || typeof fence.then !== 'function') {
    throw sourceFamilyError(
      'successor retirement requires an exact owner completion promise',
      'RETIREMENT_FENCE'
    );
  }
  record.active = false;
  record.retirementRequested = true;
  record.reason = normalizedReason(reason, 'successor source family superseded');
  record.retirementFenceSettled = false;
  record.retirementSettled = false;
  record.retirementPromise = new Promise((resolve) => {
    record.resolveRetirement = resolve;
  });
  Promise.resolve(fence).then(
    () => {
      record.retirementFenceSettled = true;
      settleRequestedRetirement(sourceFamily, record);
    },
    (error) => {
      if (record.deviceLost) {
        settleRequestedRetirement(sourceFamily, record);
        return;
      }
      record.reason = normalizedReason(
        error,
        'successor retirement owner fence rejected'
      );
      const resolveRetirement = record.resolveRetirement;
      const rejectedReceipt = retirementReceipt(
        sourceFamily,
        record,
        'schroeder-successor-source-family-retirement-fence-rejected'
      );
      // Keep the family revoked/quarantined, but clear only the failed owner
      // attempt so the caller can install a replacement fence explicitly.
      record.retirementSettled = false;
      record.retirementFenceSettled = false;
      record.retirementPromise = null;
      record.resolveRetirement = null;
      resolveRetirement?.(rejectedReceipt);
    }
  );
  settleRequestedRetirement(sourceFamily, record);
  record.retirementPromise.catch(() => {});
  return record.retirementPromise;
}

/** Validate optional exact consumer inputs against the private attestation. */
export function resolveSchroederSpatialSuccessorSourceFamily(
  sourceFamily,
  {
    device,
    particleCount = sourceFamily?.particleCount,
    stateBuffer = null,
    thermoBuffer = null,
    identityBuffer = null,
    mechanicsBuffer = null
  } = {}
) {
  const record = exactSourceFamilyRecord(sourceFamily, {
    device,
    requireDevice: true
  });
  requireActiveSourceFamily(record);
  const suppliedBuffers = { stateBuffer, thermoBuffer, identityBuffer, mechanicsBuffer };
  const suppliedMismatch = Object.entries(suppliedBuffers).some(
    ([name, buffer]) => buffer != null && buffer !== record?.buffers?.[name]
  );
  if (
    sourceFamily.particleCount !== particleCount
    || suppliedMismatch
    || Object.values(record.buffers).some((buffer) => (
      webGpuBufferDevice(buffer) !== device
      || !webGpuBufferMatchesDevice(buffer, device)
    ))
  ) {
    throw sourceFamilyError(
      'source family does not identify the exact committed same-device continuation'
    );
  }
  return Object.freeze({
    admitted: true,
    sourceFamily,
    sourceFamilyRole: sourceFamily.sourceFamilyRole,
    sourceGenerationId: sourceFamily.sourceGenerationId,
    epochIdentity: sourceFamily.successorEpochIdentity
  });
}
