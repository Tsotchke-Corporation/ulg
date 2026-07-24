import {
  MLS_MPM_GPU_PARTICLE_MECHANICS_FLOATS,
  SPH_GPU_PARTICLE_IDENTITY_UINTS,
  SPH_GPU_PARTICLE_STATE_FLOATS,
  SPH_GPU_PARTICLE_THERMO_FLOATS
} from './sphGpuBuffers.js';
import {
  schroederSpatialEpochGenerationRetirementCapability
} from './schroederSpatialEpochGpu.js';
import {
  tagWebGpuBufferDevice,
  webGpuBufferDevice,
  webGpuBufferMatchesDevice,
  webGpuDeviceId
} from './sphGpuDeviceIdentity.js';
import {
  resolveSchroederSpatialReactionDiscoveryProposalForConsumer
} from './schroederSpatialReactionDiscoveryProposalGpu.js';

export const ULG_SCHROEDER_SPATIAL_REACTION_PLACEMENT_SOURCE_FAMILY_SCHEMA =
  'peercompute.ulg.schroeder-spatial-reaction-placement-source-family.v2';
export const ULG_SPH_REACTION_RESOLVE_POSITION_INVARIANT_CERTIFICATE_SCHEMA =
  'peercompute.ulg.sph-reaction-resolve-position-invariant-certificate.v1';
export const SCHROEDER_SPATIAL_REACTION_PLACEMENT_STAGE_ID =
  'post-reaction-pre-placement';
export const SCHROEDER_SPATIAL_REACTION_PLACEMENT_SOURCE_FAMILY_ID =
  'schroeder-shared-canonical-displaced-post-reaction-pre-placement-x-r';
export const ULG_SCHROEDER_SPATIAL_REACTION_PLACEMENT_POSITION_EPOCH_FLOOR_RECEIPT_SCHEMA =
  'peercompute.ulg.schroeder-spatial-reaction-placement-position-epoch-floor-receipt.v1';
export const ULG_SCHROEDER_SPATIAL_REACTION_PLACEMENT_LIVENESS_SCHEMA =
  'peercompute.ulg.schroeder-spatial-reaction-placement-liveness.v1';
export const ULG_SPH_REACTION_WARM_ARENA_SCHEMA =
  'peercompute.ulg.sph-reaction-warm-arena.v1';
export const ULG_SPH_REACTION_WARM_ARENA_LEASE_SCHEMA =
  'peercompute.ulg.sph-reaction-warm-arena-lease.v1';

const GPU_BUFFER_USAGE = {
  COPY_SRC: globalThis.GPUBufferUsage?.COPY_SRC ?? 4,
  COPY_DST: globalThis.GPUBufferUsage?.COPY_DST ?? 8,
  STORAGE: globalThis.GPUBufferUsage?.STORAGE ?? 128,
  UNIFORM: globalThis.GPUBufferUsage?.UNIFORM ?? 64
};

const positionInvariantCertificates = new WeakSet();
const positionInvariantCertificateRecords = new WeakMap();
const placementSourceFamilies = new WeakSet();
const placementSourceFamilyRecords = new WeakMap();
const placementPositionEpochFloorReceipts = new WeakSet();
const placementPositionEpochFloorReceiptRecords = new WeakMap();
const reactionWarmArenaCaches = new WeakMap();
const reactionWarmArenaRecords = new WeakMap();
const reactionWarmArenaLeaseRecords = new WeakMap();
const REACTION_WARM_ARENA_MAX_SLOTS_PER_CAPACITY = 3;

function placementEpochError(message, suffix = 'CONTRACT') {
  const error = new Error(message);
  error.code = `ERR_SCHROEDER_SPATIAL_REACTION_PLACEMENT_EPOCH_${suffix}`;
  return error;
}

function exactU32(value, label, { positive = false } = {}) {
  if (
    typeof value !== 'number'
    || !Number.isInteger(value)
    || value < (positive ? 1 : 0)
    || value > 0xffff_ffff
  ) {
    throw placementEpochError(
      `${label} must be an exact ${positive ? 'positive ' : ''}u32`,
      'IDENTITY'
    );
  }
  return value;
}

function incrementIdentityU32(value, label) {
  const current = exactU32(value, label);
  if (current === 0xffff_ffff) {
    throw placementEpochError(
      `${label} exhausted the u32 identity space; wrapping would alias a live epoch`,
      'IDENTITY_EXHAUSTED'
    );
  }
  return current + 1;
}

function isExactIdentityU32Successor(source, next) {
  return Number.isInteger(source)
    && source >= 0
    && source < 0xffff_ffff
    && Number.isInteger(next)
    && next === source + 1;
}

function requireDeviceBuffer(device, buffer, label, minimumBytes = 0) {
  if (
    !buffer
    || webGpuBufferDevice(buffer) !== device
    || !webGpuBufferMatchesDevice(buffer, device)
  ) {
    throw placementEpochError(
      `${label} must be a tagged live buffer on the placement device`,
      'DEVICE_MISMATCH'
    );
  }
  if (
    minimumBytes > 0
    && Number.isFinite(Number(buffer.size))
    && Number(buffer.size) < minimumBytes
  ) {
    throw placementEpochError(
      `${label} has ${buffer.size} bytes; ${minimumBytes} required`,
      'CAPACITY'
    );
  }
  return buffer;
}

function requirePublicGeneration(device, generation, particleCount) {
  if (
    generation?.selected !== true
    || generation?.ready !== true
    || generation?.execution?.released === true
    || generation?.releaseScheduled === true
  ) {
    throw placementEpochError(
      'placement epoch requires one live selected ancestor public generation',
      'ANCESTOR_GENERATION'
    );
  }
  if (
    generation.source?.sourceCount !== particleCount
    || generation.execution?.sourceCount !== particleCount
  ) {
    throw placementEpochError(
      'placement particle count does not match the ancestor public generation',
      'ANCESTOR_GENERATION'
    );
  }
  exactU32(generation.execution?.generationId, 'ancestor generationId', {
    positive: true
  });
  exactU32(generation.execution?.storageGeneration, 'ancestor storageGeneration', {
    positive: true
  });
  for (const field of [
    'physicsTick',
    'physicsSubstep',
    'positionEpoch',
    'topologyEpoch',
    'chartEpoch',
    'levelEpoch',
    'supportEpoch'
  ]) {
    exactU32(generation.execution?.[field], `ancestor ${field}`);
  }
  requireDeviceBuffer(
    device,
    generation.execution?.directoryBuffer,
    'ancestor public directory'
  );
  // This capability is only issued for module-owned generations and is a
  // read-only brand check here; it does not schedule retirement.
  schroederSpatialEpochGenerationRetirementCapability(generation, device);
  const queryProfile = generation.execution?.exactNearQueryProfile;
  if (
    queryProfile?.ready !== true
    || generation.source?.exactNearQueryProfile?.ready !== true
    || generation.execution?.queryChartId !== queryProfile.chartId
    || generation.execution?.queryMinLevel !== queryProfile.minLevel
    || generation.execution?.queryMaxLevel !== queryProfile.maxLevel
    || !Object.is(
      generation.execution?.queryBaseGridSpacingM,
      queryProfile.baseGridSpacingM
    )
  ) {
    throw placementEpochError(
      'ancestor generation lacks exact authenticated query geometry',
      'ANCESTOR_QUERY_GEOMETRY'
    );
  }
  return generation;
}

function exactEpochIdentity(execution) {
  return Object.freeze({
    storageGeneration: exactU32(
      execution?.storageGeneration,
      'placement storageGeneration',
      { positive: true }
    ),
    physicsTick: exactU32(execution?.physicsTick, 'placement physicsTick'),
    physicsSubstep: exactU32(
      execution?.physicsSubstep,
      'placement physicsSubstep'
    ),
    positionEpoch: exactU32(execution?.positionEpoch, 'placement positionEpoch'),
    topologyEpoch: exactU32(execution?.topologyEpoch, 'placement topologyEpoch'),
    chartEpoch: exactU32(execution?.chartEpoch, 'placement chartEpoch'),
    levelEpoch: exactU32(execution?.levelEpoch, 'placement levelEpoch'),
    supportEpoch: exactU32(execution?.supportEpoch, 'placement supportEpoch')
  });
}

function createPlacedDestinationBuffer(device, label, byteLength) {
  return tagWebGpuBufferDevice(device.createBuffer({
    label,
    size: Math.max(4, byteLength),
    usage:
      GPU_BUFFER_USAGE.STORAGE
      | GPU_BUFFER_USAGE.COPY_SRC
      | GPU_BUFFER_USAGE.COPY_DST
  }), device);
}

function reactionWarmArenaCapacityBytes(count, stride, label) {
  const byteLength = count * stride * Float32Array.BYTES_PER_ELEMENT;
  if (!Number.isSafeInteger(byteLength) || byteLength < 4) {
    throw placementEpochError(
      `${label} capacity is not safely addressable`,
      'WARM_ARENA_CAPACITY'
    );
  }
  return byteLength;
}

function requireReactionWarmArenaStorageCapacity(device, byteLength, label) {
  const limits = [
    Number(device?.limits?.maxBufferSize),
    Number(device?.limits?.maxStorageBufferBindingSize)
  ].filter((value) => Number.isFinite(value) && value > 0);
  const limit = limits.length > 0 ? Math.min(...limits) : Number.MAX_SAFE_INTEGER;
  if (byteLength > limit) {
    throw placementEpochError(
      `${label} requires ${byteLength} bytes; device limit is ${limit}`,
      'WARM_ARENA_CAPACITY'
    );
  }
  return byteLength;
}

function reactionWarmArenaCacheForDevice(device) {
  let cache = reactionWarmArenaCaches.get(device);
  if (!cache) {
    cache = new Map();
    reactionWarmArenaCaches.set(device, cache);
  }
  return cache;
}

function reactionWarmArenaCapacityKey({
  particleCapacity,
  productEventCapacity,
  productTermCapacity,
  packedParticleStrideFloats,
  productEventStrideFloats,
  productPlacementSummaryStrideFloats
}) {
  return [
    particleCapacity,
    productEventCapacity,
    productTermCapacity,
    packedParticleStrideFloats,
    productEventStrideFloats,
    productPlacementSummaryStrideFloats
  ].join(':');
}

function createReactionWarmArenaBuffer(
  device,
  createdBuffers,
  label,
  size,
  usage
) {
  const buffer = tagWebGpuBufferDevice(device.createBuffer({
    label,
    size: Math.max(4, size),
    usage
  }), device);
  createdBuffers.push(buffer);
  return buffer;
}

function destroyReactionWarmArenaRecord(record, { force = false } = {}) {
  if (!record || record.destroyed) return false;
  if (record.inFlight && !record.deviceLost && !force) {
    throw placementEpochError(
      'cannot destroy an in-flight reaction warm arena',
      'WARM_ARENA_LEASE'
    );
  }
  record.destroyed = true;
  record.terminal = true;
  record.inFlight = false;
  record.phase = 'destroyed';
  for (const buffer of record.ownedBuffers) {
    try {
      buffer?.destroy?.();
    } catch {
      // Destruction is exact-once best effort after a terminal GPU condition.
    }
  }
  record.ownedBuffers.clear();
  return true;
}

function armReactionWarmArenaDeviceLoss(record) {
  const lost = record.device?.lost;
  if (!lost || typeof lost.then !== 'function') {
    record.deviceLossStatus = 'device-loss-promise-unavailable';
    return;
  }
  record.deviceLossStatus = 'device-loss-quarantine-armed';
  Promise.resolve(lost).then((info) => {
    record.deviceLost = true;
    record.terminal = true;
    record.deviceLossStatus = 'device-loss-quarantined';
    record.deviceLossReason = info?.message ?? String(info || 'device lost');
    destroyReactionWarmArenaRecord(record, { force: true });
  }, (error) => {
    record.deviceLost = true;
    record.terminal = true;
    record.deviceLossStatus = 'device-loss-quarantined-after-rejection';
    record.deviceLossReason = error instanceof Error
      ? error.message
      : String(error);
    destroyReactionWarmArenaRecord(record, { force: true });
  });
}

function createReactionWarmArena(device, descriptor, slotIndex) {
  const {
    particleCapacity,
    productEventCapacity,
    productTermCapacity,
    packedParticleStrideFloats,
    productEventStrideFloats,
    productPlacementSummaryStrideFloats,
    capacityKey
  } = descriptor;
  const packedBytes = requireReactionWarmArenaStorageCapacity(
    device,
    reactionWarmArenaCapacityBytes(
      particleCapacity,
      packedParticleStrideFloats,
      'packed reaction particle rows'
    ),
    'packed reaction particle rows'
  );
  const stateBytes = requireReactionWarmArenaStorageCapacity(
    device,
    reactionWarmArenaCapacityBytes(
      particleCapacity,
      SPH_GPU_PARTICLE_STATE_FLOATS,
      'reaction state rows'
    ),
    'reaction state rows'
  );
  const thermoBytes = requireReactionWarmArenaStorageCapacity(
    device,
    reactionWarmArenaCapacityBytes(
      particleCapacity,
      SPH_GPU_PARTICLE_THERMO_FLOATS,
      'reaction thermo rows'
    ),
    'reaction thermo rows'
  );
  const mechanicsBytes = requireReactionWarmArenaStorageCapacity(
    device,
    reactionWarmArenaCapacityBytes(
      particleCapacity,
      MLS_MPM_GPU_PARTICLE_MECHANICS_FLOATS,
      'reaction mechanics rows'
    ),
    'reaction mechanics rows'
  );
  const productEventBytes = requireReactionWarmArenaStorageCapacity(
    device,
    reactionWarmArenaCapacityBytes(
      productEventCapacity,
      productEventStrideFloats,
      'reaction product-event rows'
    ),
    'reaction product-event rows'
  );
  const productPlacementSummaryBytes = requireReactionWarmArenaStorageCapacity(
    device,
    reactionWarmArenaCapacityBytes(
      productTermCapacity,
      productPlacementSummaryStrideFloats,
      'reaction product-placement summary rows'
    ),
    'reaction product-placement summary rows'
  );
  const createdBuffers = [];
  const prefix = `ulg-sph-reaction-warm-${capacityKey}-slot-${slotIndex}`;
  const storageUsage = GPU_BUFFER_USAGE.STORAGE
    | GPU_BUFFER_USAGE.COPY_SRC
    | GPU_BUFFER_USAGE.COPY_DST;
  try {
    const buffers = Object.freeze({
      packedSource: createReactionWarmArenaBuffer(
        device, createdBuffers, `${prefix}-packed-source`, packedBytes, storageUsage
      ),
      packedOutput: createReactionWarmArenaBuffer(
        device, createdBuffers, `${prefix}-packed-output`, packedBytes, storageUsage
      ),
      fallbackState: createReactionWarmArenaBuffer(
        device, createdBuffers, `${prefix}-fallback-state`, stateBytes, storageUsage
      ),
      fallbackThermo: createReactionWarmArenaBuffer(
        device, createdBuffers, `${prefix}-fallback-thermo`, thermoBytes, storageUsage
      ),
      fallbackMechanics: createReactionWarmArenaBuffer(
        device, createdBuffers, `${prefix}-fallback-mechanics`, mechanicsBytes, storageUsage
      ),
      resolvedState: createReactionWarmArenaBuffer(
        device, createdBuffers, `${prefix}-resolved-state`, stateBytes, storageUsage
      ),
      resolvedThermo: createReactionWarmArenaBuffer(
        device, createdBuffers, `${prefix}-resolved-thermo`, thermoBytes, storageUsage
      ),
      resolvedMechanics: createReactionWarmArenaBuffer(
        device, createdBuffers, `${prefix}-resolved-mechanics`, mechanicsBytes, storageUsage
      ),
      placedState: createReactionWarmArenaBuffer(
        device, createdBuffers, `${prefix}-placed-state`, stateBytes, storageUsage
      ),
      placedThermo: createReactionWarmArenaBuffer(
        device, createdBuffers, `${prefix}-placed-thermo`, thermoBytes, storageUsage
      ),
      placedMechanics: createReactionWarmArenaBuffer(
        device, createdBuffers, `${prefix}-placed-mechanics`, mechanicsBytes, storageUsage
      ),
      productEvent: createReactionWarmArenaBuffer(
        device,
        createdBuffers,
        `${prefix}-product-event`,
        productEventBytes,
        storageUsage
      ),
      productPlacementSummary: createReactionWarmArenaBuffer(
        device,
        createdBuffers,
        `${prefix}-product-placement-summary`,
        productPlacementSummaryBytes,
        storageUsage
      ),
      reactionParams: createReactionWarmArenaBuffer(
        device,
        createdBuffers,
        `${prefix}-reaction-params`,
        48,
        GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST
      ),
      summaryParams: createReactionWarmArenaBuffer(
        device,
        createdBuffers,
        `${prefix}-summary-params`,
        48,
        GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST
      )
    });
    const arena = Object.freeze({
      schema: ULG_SPH_REACTION_WARM_ARENA_SCHEMA,
      status: 'sph-reaction-warm-arena-ready',
      capacityKey,
      slotIndex,
      particleCapacity,
      productEventCapacity,
      productTermCapacity,
      packedParticleStrideFloats,
      productEventStrideFloats,
      productPlacementSummaryStrideFloats,
      buffers
    });
    const record = {
      device,
      arena,
      buffers,
      ownedBuffers: new Set(createdBuffers),
      bufferCreationCount: createdBuffers.length,
      acquisitionCount: 0,
      warmReuseCount: 0,
      leaseOrdinal: 0,
      inFlight: false,
      phase: 'idle',
      terminal: false,
      deviceLost: false,
      destroyed: false,
      deviceLossStatus: 'device-loss-quarantine-not-armed',
      deviceLossReason: null,
      releaseFence: null,
      boundSourceFamily: null,
      destinationOwnershipTransferred: false
    };
    reactionWarmArenaRecords.set(arena, record);
    armReactionWarmArenaDeviceLoss(record);
    return arena;
  } catch (error) {
    for (const buffer of createdBuffers.reverse()) {
      try {
        buffer?.destroy?.();
      } catch {}
    }
    throw error;
  }
}

export function acquireSphReactionWarmArenaWebGpu({
  device,
  particleCapacity,
  productEventCapacity,
  productTermCapacity,
  packedParticleStrideFloats = 52,
  productEventStrideFloats = 32,
  productPlacementSummaryStrideFloats = 32
} = {}) {
  if (!device?.createBuffer || !device?.queue?.writeBuffer) {
    throw new TypeError(
      'reaction warm arena acquisition requires a WebGPU-like device'
    );
  }
  const descriptor = {
    particleCapacity: exactU32(
      particleCapacity,
      'reaction warm particleCapacity',
      { positive: true }
    ),
    productEventCapacity: exactU32(
      productEventCapacity,
      'reaction warm productEventCapacity',
      { positive: true }
    ),
    productTermCapacity: exactU32(
      productTermCapacity,
      'reaction warm productTermCapacity',
      { positive: true }
    ),
    packedParticleStrideFloats: exactU32(
      packedParticleStrideFloats,
      'reaction warm packedParticleStrideFloats',
      { positive: true }
    ),
    productEventStrideFloats: exactU32(
      productEventStrideFloats,
      'reaction warm productEventStrideFloats',
      { positive: true }
    ),
    productPlacementSummaryStrideFloats: exactU32(
      productPlacementSummaryStrideFloats,
      'reaction warm productPlacementSummaryStrideFloats',
      { positive: true }
    )
  };
  descriptor.capacityKey = reactionWarmArenaCapacityKey(descriptor);
  const cache = reactionWarmArenaCacheForDevice(device);
  let bucket = cache.get(descriptor.capacityKey);
  if (!bucket) {
    bucket = { records: [] };
    cache.set(descriptor.capacityKey, bucket);
  }
  bucket.records = bucket.records.filter((record) => !record.destroyed);
  let record = bucket.records.find((candidate) => (
    !candidate.inFlight
    && !candidate.terminal
    && !candidate.deviceLost
    && !candidate.destroyed
  )) ?? null;
  let bufferCreationCount = 0;
  if (!record) {
    if (bucket.records.length >= REACTION_WARM_ARENA_MAX_SLOTS_PER_CAPACITY) {
      const error = placementEpochError(
        `reaction warm arena ${descriptor.capacityKey} is under bounded backpressure`,
        'WARM_ARENA_BACKPRESSURE'
      );
      const scheduledReleases = bucket.records
        .map((candidate) => candidate.releaseFence)
        .filter((fence) => fence?.then);
      error.retryAfterFence = scheduledReleases.length > 0
        ? Promise.any(scheduledReleases.map((fence) => (
            Promise.resolve(fence).then((released) => {
              if (released === true) return true;
              throw placementEpochError(
                'reaction warm arena release did not confirm reusable ownership',
                'WARM_ARENA_BACKPRESSURE_RELEASE'
              );
            })
          ))).then(() => true, () => false)
        : null;
      throw error;
    }
    const usedSlotIndexes = new Set(
      bucket.records.map((candidate) => candidate.arena.slotIndex)
    );
    let slotIndex = 0;
    while (usedSlotIndexes.has(slotIndex)) slotIndex += 1;
    const arena = createReactionWarmArena(
      device,
      descriptor,
      slotIndex
    );
    record = reactionWarmArenaRecords.get(arena);
    bucket.records.push(record);
    bufferCreationCount = record.bufferCreationCount;
  } else {
    record.warmReuseCount += 1;
  }
  record.inFlight = true;
  record.phase = 'leased';
  record.acquisitionCount += 1;
  record.leaseOrdinal += 1;
  record.releaseFence = null;
  record.boundSourceFamily = null;
  record.destinationOwnershipTransferred = false;
  const lease = Object.freeze({
    schema: ULG_SPH_REACTION_WARM_ARENA_LEASE_SCHEMA,
    status: 'sph-reaction-warm-arena-leased',
    arena: record.arena,
    leaseOrdinal: record.leaseOrdinal,
    bufferCreationCount,
    warmReuse: bufferCreationCount === 0
  });
  reactionWarmArenaLeaseRecords.set(lease, {
    record,
    leaseOrdinal: record.leaseOrdinal,
    releaseScheduled: false,
    released: false
  });
  return lease;
}

/**
 * Acquire one exact warm-arena lease while respecting the bounded resident
 * window. A sequential resident batch is allowed to enqueue more substeps
 * than there are arena slots: once the window is full, wait only on an
 * already-scheduled exact-owner queue fence and retry. An exhausted window
 * with no scheduled release remains an ownership error instead of silently
 * allocating an unbounded fourth slot.
 */
export async function acquireSphReactionWarmArenaWithBackpressureWebGpu(
  options = {}
) {
  for (;;) {
    try {
      return acquireSphReactionWarmArenaWebGpu(options);
    } catch (error) {
      if (
        error?.code
          !== 'ERR_SCHROEDER_SPATIAL_REACTION_PLACEMENT_EPOCH_WARM_ARENA_BACKPRESSURE'
      ) {
        throw error;
      }
      if (!error.retryAfterFence?.then) {
        const ownershipError = placementEpochError(
          'reaction warm arena is exhausted without a scheduled exact-owner release',
          'WARM_ARENA_BACKPRESSURE_UNRELEASABLE'
        );
        ownershipError.cause = error;
        throw ownershipError;
      }
      let released = false;
      try {
        released = await error.retryAfterFence;
      } catch {
        released = false;
      }
      if (released !== true) {
        const releaseError = placementEpochError(
          'reaction warm arena queue fences completed without a reusable slot',
          'WARM_ARENA_BACKPRESSURE_RELEASE_FAILED'
        );
        releaseError.cause = error;
        throw releaseError;
      }
    }
  }
}

function requireReactionWarmArenaLease(lease, { device = null } = {}) {
  const leaseRecord = reactionWarmArenaLeaseRecords.get(lease);
  const record = leaseRecord?.record;
  if (
    !leaseRecord
    || !record
    || record.destroyed
    || record.terminal
    || !record.inFlight
    || record.phase !== 'leased'
    || leaseRecord.releaseScheduled
    || leaseRecord.released
    || leaseRecord.leaseOrdinal !== record.leaseOrdinal
    || lease?.arena !== record.arena
    || (device && record.device !== device)
  ) {
    throw placementEpochError(
      'reaction warm arena lease is stale, terminal, or foreign',
      'WARM_ARENA_LEASE'
    );
  }
  return { leaseRecord, record };
}

export function resolveSphReactionWarmArenaLease(
  lease,
  {
    device,
    particleCapacity = null,
    productEventCapacity = null,
    productTermCapacity = null
  } = {}
) {
  const { record } = requireReactionWarmArenaLease(lease, { device });
  const arena = record.arena;
  for (const [label, expected, actual] of [
    ['particleCapacity', particleCapacity, arena.particleCapacity],
    ['productEventCapacity', productEventCapacity, arena.productEventCapacity],
    ['productTermCapacity', productTermCapacity, arena.productTermCapacity]
  ]) {
    if (expected != null && expected !== actual) {
      throw placementEpochError(
        `reaction warm arena ${label} does not match this execution`,
        'WARM_ARENA_IDENTITY'
      );
    }
  }
  return arena;
}

function bindReactionWarmArenaSourceFamily(lease, sourceFamily, device) {
  const { record } = requireReactionWarmArenaLease(lease, { device });
  if (record.boundSourceFamily && record.boundSourceFamily !== sourceFamily) {
    throw placementEpochError(
      'reaction warm arena is already bound to another placement source family',
      'WARM_ARENA_IDENTITY'
    );
  }
  record.boundSourceFamily = sourceFamily;
  return true;
}

function transferReactionWarmArenaDestinationOwnership(
  lease,
  sourceFamily,
  device
) {
  const { record } = requireReactionWarmArenaLease(lease, { device });
  if (record.boundSourceFamily !== sourceFamily) {
    throw placementEpochError(
      'reaction warm destination transfer requires its exact source family',
      'WARM_ARENA_OWNERSHIP'
    );
  }
  if (record.destinationOwnershipTransferred) return false;
  record.destinationOwnershipTransferred = true;
  return true;
}

export function releaseSchroederSpatialReactionPlacementTransferredDestinationOwnershipAfterQueue(
  sourceFamily,
  { completionFence = null } = {}
) {
  if (!isSchroederSpatialReactionPlacementSourceFamily(sourceFamily)) {
    throw placementEpochError(
      'placement source family was not minted by the shared-directory epoch builder',
      'SOURCE_FAMILY_BRAND'
    );
  }
  const record = placementSourceFamilyRecords.get(sourceFamily);
  if (
    !record
    || !record.destinationOwnershipTransferred
    || record.lifecycle.releaseScheduled !== true
    || !record.finalizedPlacementArtifact
    || !record.positionEpochFloorReceipt
  ) {
    throw placementEpochError(
      'transferred placement destinations require their exact finalized owner handoff',
      'OWNERSHIP_TRANSFER'
    );
  }
  if (record.destinationReturnScheduled) return false;
  const queueFence = completionFence
    ?? (typeof record.device.queue?.onSubmittedWorkDone === 'function'
      ? record.device.queue.onSubmittedWorkDone()
      : null);
  if (!queueFence?.then) {
    throw placementEpochError(
      'transferred placement destination release requires a queue fence',
      'OWNERSHIP_TRANSFER_FENCE'
    );
  }
  const sourceReleaseFence = record.lifecycle.releasePromise?.then
    ? record.lifecycle.releasePromise
    : Promise.resolve(true);
  const combinedFence = Promise.all([sourceReleaseFence, queueFence]).then(
    ([sourceReleased]) => {
      if (sourceReleased !== true) {
        throw placementEpochError(
          'placement source retirement was not confirmed before destination return',
          'OWNERSHIP_TRANSFER_FENCE'
        );
      }
      return true;
    }
  );
  record.destinationReturnScheduled = true;
  if (record.reactionWarmArenaLease) {
    record.destinationReturnPromise = releaseSphReactionWarmArenaAfterQueue(
      record.reactionWarmArenaLease,
      {
        device: record.device,
        completionFence: combinedFence,
        destinationOwner: sourceFamily
      }
    );
    return record.destinationReturnPromise;
  }
  record.destinationReturnPromise = combinedFence.then(() => {
    destroyOnce(
      record,
      'placed-state',
      record.family.placedDestinationStateBuffer
    );
    destroyOnce(
      record,
      'placed-thermo',
      record.family.placedDestinationThermoBuffer
    );
    destroyOnce(
      record,
      'placed-mechanics',
      record.family.placedDestinationMechanicsBuffer
    );
    return true;
  });
  return record.destinationReturnPromise;
}

export function releaseSphReactionWarmArenaAfterQueue(
  lease,
  {
    device,
    completionFence = null,
    destinationOwner = null,
    abandon = false,
    destroy = false
  } = {}
) {
  const { leaseRecord, record } = requireReactionWarmArenaLease(lease, {
    device
  });
  if (
    record.destinationOwnershipTransferred
    && abandon !== true
    && destinationOwner !== record.boundSourceFamily
  ) {
    throw placementEpochError(
      'reaction warm arena release requires the exact transferred destination owner',
      'WARM_ARENA_OWNERSHIP'
    );
  }
  const fence = completionFence
    ?? (typeof device?.queue?.onSubmittedWorkDone === 'function'
      ? device.queue.onSubmittedWorkDone()
      : null);
  if (!fence || typeof fence.then !== 'function') {
    throw placementEpochError(
      'reaction warm arena release requires a genuine queue completion fence',
      'WARM_ARENA_FENCE'
    );
  }
  leaseRecord.releaseScheduled = true;
  record.phase = 'retiring';
  record.releaseFence = Promise.resolve(fence).then(() => {
    leaseRecord.released = true;
    record.inFlight = false;
    record.boundSourceFamily = null;
    record.destinationOwnershipTransferred = false;
    if (destroy || record.terminal || record.deviceLost) {
      destroyReactionWarmArenaRecord(record, { force: true });
      return false;
    }
    record.phase = 'idle';
    return true;
  }, (error) => {
    leaseRecord.released = true;
    record.inFlight = false;
    record.terminal = true;
    record.deviceLossStatus = 'queue-fence-rejected-arena-quarantined';
    record.deviceLossReason = error instanceof Error
      ? error.message
      : String(error);
    destroyReactionWarmArenaRecord(record, { force: true });
    return false;
  });
  return record.releaseFence;
}

export function discardSphReactionWarmArenaLease(
  lease,
  { device } = {}
) {
  const { leaseRecord, record } = requireReactionWarmArenaLease(lease, {
    device
  });
  if (record.boundSourceFamily) {
    throw placementEpochError(
      'a placement-bound reaction warm arena must retire through a queue fence',
      'WARM_ARENA_LEASE'
    );
  }
  leaseRecord.releaseScheduled = true;
  leaseRecord.released = true;
  record.inFlight = false;
  record.phase = 'idle';
  return true;
}

export function sphReactionWarmArenaStats(arena) {
  const record = reactionWarmArenaRecords.get(arena);
  if (!record) return null;
  return Object.freeze({
    status: record.destroyed
      ? 'destroyed'
      : record.deviceLost
        ? 'device-lost-terminal'
        : record.phase,
    capacityKey: arena.capacityKey,
    slotIndex: arena.slotIndex,
    particleCapacity: arena.particleCapacity,
    productEventCapacity: arena.productEventCapacity,
    productTermCapacity: arena.productTermCapacity,
    bufferCreationCount: record.bufferCreationCount,
    acquisitionCount: record.acquisitionCount,
    warmReuseCount: record.warmReuseCount,
    inFlight: record.inFlight,
    terminal: record.terminal,
    deviceLost: record.deviceLost,
    deviceLossStatus: record.deviceLossStatus,
    destinationOwnershipTransferred:
      record.destinationOwnershipTransferred
  });
}

export function destroySphReactionWarmArenaWebGpu(arena) {
  const record = reactionWarmArenaRecords.get(arena);
  if (!record) return false;
  return destroyReactionWarmArenaRecord(record);
}

function assertDistinctPlacementBuffers({
  frozenSourceStateBuffer,
  frozenSourceThermoBuffer,
  frozenSourceMechanicsBuffer,
  placedDestinationStateBuffer,
  placedDestinationThermoBuffer,
  placedDestinationMechanicsBuffer
}) {
  const sources = [
    frozenSourceStateBuffer,
    frozenSourceThermoBuffer,
    frozenSourceMechanicsBuffer
  ];
  const destinations = [
    placedDestinationStateBuffer,
    placedDestinationThermoBuffer,
    placedDestinationMechanicsBuffer
  ];
  if (new Set(sources).size !== sources.length) {
    throw placementEpochError(
      'frozen placement state, thermo, and mechanics sources must be distinct buffers',
      'SOURCE_ALIAS'
    );
  }
  for (const destination of destinations) {
    if (sources.includes(destination)) {
      throw placementEpochError(
        'frozen placement sources and mutable placed destinations must never alias',
        'SOURCE_DESTINATION_ALIAS'
      );
    }
  }
  if (new Set(destinations).size !== destinations.length) {
    throw placementEpochError(
      'placed state, thermo, and mechanics destinations must be distinct buffers',
      'DESTINATION_ALIAS'
    );
  }
}

function submitFrozenFamilyCopy(device, family) {
  const encoder = device.createCommandEncoder({
    label: 'ulg-schroeder-reaction-placement-destination-initialize'
  });
  if (typeof encoder?.copyBufferToBuffer !== 'function') {
    throw placementEpochError(
      'placement destination initialization requires copyBufferToBuffer',
      'COPY_UNAVAILABLE'
    );
  }
  encoder.copyBufferToBuffer(
    family.frozenSourceStateBuffer,
    0,
    family.placedDestinationStateBuffer,
    0,
    family.stateBufferByteLength
  );
  encoder.copyBufferToBuffer(
    family.frozenSourceThermoBuffer,
    0,
    family.placedDestinationThermoBuffer,
    0,
    family.thermoBufferByteLength
  );
  encoder.copyBufferToBuffer(
    family.frozenSourceMechanicsBuffer,
    0,
    family.placedDestinationMechanicsBuffer,
    0,
    family.mechanicsBufferByteLength
  );
  device.queue.submit([encoder.finish()]);
  const completionFence = device.queue?.onSubmittedWorkDone?.();
  if (!completionFence?.then) {
    throw placementEpochError(
      'placement destination initialization requires an exact queue fence',
      'QUEUE_FENCE'
    );
  }
  return completionFence;
}

function destroyOnce(record, key, value) {
  if (record.destroyed.has(key)) return;
  record.destroyed.add(key);
  value?.destroy?.();
}

function destroyPlacementAuxiliaryResources(record) {
  if (record.auxiliaryDestroyed) return;
  record.auxiliaryDestroyed = true;
  if (typeof record.levelAssignment?.destroyAssignmentBuffer === 'function') {
    record.levelAssignment.destroyAssignmentBuffer();
  } else {
    destroyOnce(
      record,
      'level-assignment',
      record.levelAssignment?.assignmentBuffer
    );
  }
  if (!record.reactionWarmArenaLease) {
    destroyOnce(record, 'frozen-state', record.family.frozenSourceStateBuffer);
    destroyOnce(record, 'frozen-thermo', record.family.frozenSourceThermoBuffer);
    destroyOnce(
      record,
      'frozen-mechanics',
      record.family.frozenSourceMechanicsBuffer
    );
  }
}

function destroyPlacedDestinations(record) {
  if (record.destinationOwnershipTransferred || record.reactionWarmArenaLease) return;
  if (!record.callerOwnedDestinations.state) {
    destroyOnce(
      record,
      'placed-state',
      record.family.placedDestinationStateBuffer
    );
  }
  if (!record.callerOwnedDestinations.thermo) {
    destroyOnce(
      record,
      'placed-thermo',
      record.family.placedDestinationThermoBuffer
    );
  }
  if (!record.callerOwnedDestinations.mechanics) {
    destroyOnce(
      record,
      'placed-mechanics',
      record.family.placedDestinationMechanicsBuffer
    );
  }
}

function armDeviceLoss(record) {
  const lost = record.device?.lost;
  if (!lost || typeof lost.then !== 'function') {
    record.lifecycle.deviceLossStatus = 'device-loss-promise-unavailable';
    return;
  }
  record.lifecycle.deviceLossStatus = 'device-loss-quarantine-armed';
  Promise.resolve(lost).then((info) => {
    if (record.lifecycle.releaseStatus === 'released-after-final-consumer') {
      return;
    }
    record.lifecycle.deviceLossStatus = 'device-loss-cleanup-running';
    record.deviceLost = true;
    record.lifecycle.deviceLossReason = info?.message ?? String(info || 'device lost');
    try {
      // The canonical generation is borrowed and remains owned by the spatial
      // transaction. Device loss only retires this family's own frozen and
      // destination resources; it must never quarantine the ancestor owner.
      destroyPlacementAuxiliaryResources(record);
      destroyPlacedDestinations(record);
      record.lifecycle.deviceLossStatus = 'device-loss-cleanup-completed';
    } catch (error) {
      record.lifecycle.deviceLossStatus = 'device-loss-cleanup-error';
      record.lifecycle.deviceLossReason = error instanceof Error
        ? error.message
        : String(error);
    }
  }).catch((error) => {
    record.lifecycle.deviceLossStatus = 'device-loss-observer-error';
    record.lifecycle.deviceLossReason = error instanceof Error
      ? error.message
      : String(error);
  });
}

/**
 * Mint the only certificate that permits the displaced shared-directory placement stage to
 * derive its numeric position epoch. Reaction resolve may change mass,
 * energy, material, phase, and constitutive rows, but its unpack contract
 * copies xyz from its exact input. A distinct, displacement-certified
 * post-G2P discovery input is therefore one position transition after the
 * public ancestor; an exact ancestor-buffer input remains position-invariant.
 */
export function createSphReactionResolvePositionInvariantCertificate({
  device,
  ancestorGeneration,
  reactionInputStateBuffer,
  reactionInputThermoBuffer = null,
  frozenResolvedStateBuffer,
  particleCount,
  reactionDiscoveryProposal = null,
  reactionTable = null
} = {}) {
  const resolvedParticleCount = exactU32(
    particleCount,
    'particleCount',
    { positive: true }
  );
  const ancestor = requirePublicGeneration(
    device,
    ancestorGeneration,
    resolvedParticleCount
  );
  const exactReactionInputState = requireDeviceBuffer(
    device,
    reactionInputStateBuffer,
    'reaction input state'
  );
  const exactFrozenResolvedState = requireDeviceBuffer(
    device,
    frozenResolvedStateBuffer,
    'frozen resolved state'
  );
  let sourceAuthority = 'exact-ancestor-position-authority-state';
  const ancestorPositionEpoch = exactU32(
    ancestor.execution.positionEpoch,
    'ancestor position epoch'
  );
  let prePlacementPositionChanged = false;
  let resolvedPositionEpoch = ancestorPositionEpoch;
  let exactReactionInputThermo = null;
  let authenticatedReactionDiscovery = null;
  if (
    reactionDiscoveryProposal == null
    && (reactionInputThermoBuffer != null || reactionTable != null)
  ) {
    throw placementEpochError(
      'reaction discovery thermo/table authority cannot be supplied without the exact branded proposal',
      'RESOLVE_DISCOVERY_AUTHORITY'
    );
  }
  if (reactionDiscoveryProposal != null) {
    exactReactionInputThermo = requireDeviceBuffer(
      device,
      reactionInputThermoBuffer,
      'reaction input thermo'
    );
    authenticatedReactionDiscovery =
      resolveSchroederSpatialReactionDiscoveryProposalForConsumer(
        reactionDiscoveryProposal,
        {
          device,
          generation: ancestor,
          particleCount: resolvedParticleCount,
          reactionCount: reactionTable?.reactionCount,
          reactionTable,
          sourceStateBuffer: exactReactionInputState,
          sourceThermoBuffer: exactReactionInputThermo
        }
      );
    if (
      authenticatedReactionDiscovery?.ready !== true
      || authenticatedReactionDiscovery.authenticated === false
      || authenticatedReactionDiscovery.admitted !== true
      || authenticatedReactionDiscovery.generation !== ancestor
      || authenticatedReactionDiscovery.positionAuthorityStateBuffer
        !== ancestor.source?.sourceStateBuffer
      || authenticatedReactionDiscovery.sourceCurrentStateBuffer
        !== exactReactionInputState
      || authenticatedReactionDiscovery.sourceThermoBuffer
        !== exactReactionInputThermo
    ) {
      throw placementEpochError(
        authenticatedReactionDiscovery?.reason
          || 'resolve-position certificate requires the exact authenticated reaction discovery source family',
        'RESOLVE_DISCOVERY_AUTHORITY'
      );
    }
    prePlacementPositionChanged =
      exactReactionInputState !== ancestor.source?.sourceStateBuffer;
    resolvedPositionEpoch = prePlacementPositionChanged
      ? incrementIdentityU32(
          ancestorPositionEpoch,
          'post-G2P reaction discovery position epoch'
        )
      : ancestorPositionEpoch;
    sourceAuthority = prePlacementPositionChanged
      ? 'authenticated-displacement-certified-post-g2p-reaction-discovery-current-state'
      : 'authenticated-reaction-discovery-over-exact-ancestor-position-state';
  } else if (exactReactionInputState !== ancestor.source?.sourceStateBuffer) {
    throw placementEpochError(
      'resolve-position certificate requires the exact ancestor source state',
      'RESOLVE_SOURCE_IDENTITY'
    );
  }
  if (reactionInputStateBuffer === frozenResolvedStateBuffer) {
    throw placementEpochError(
      'reaction input and frozen resolved state must be distinct buffers',
      'RESOLVE_ALIAS'
    );
  }
  const certificate = Object.freeze({
    schema: ULG_SPH_REACTION_RESOLVE_POSITION_INVARIANT_CERTIFICATE_SCHEMA,
    status: 'reaction-resolve-position-invariance-certified',
    certified: true,
    stageIdentity: 'reaction-resolve',
    mutationPolicy:
      'xyz-copied-exactly-mass-velocity-energy-material-phase-mechanics-may-change',
    sourceAuthority,
    prePlacementPositionChanged,
    ancestorPositionEpoch,
    resolvedPositionEpoch,
    ancestorGenerationId: ancestor.execution.generationId,
    ancestorPositionEpoch: ancestor.execution.positionEpoch,
    particleCount: resolvedParticleCount,
    deviceId: webGpuDeviceId(device)
  });
  positionInvariantCertificates.add(certificate);
  positionInvariantCertificateRecords.set(certificate, {
    device,
    ancestorGeneration: ancestor,
    reactionInputStateBuffer: exactReactionInputState,
    reactionInputThermoBuffer: exactReactionInputThermo,
    reactionDiscoveryProposal,
    reactionTable,
    sourceAuthority,
    prePlacementPositionChanged,
    ancestorPositionEpoch,
    resolvedPositionEpoch,
    frozenResolvedStateBuffer: exactFrozenResolvedState,
    particleCount: resolvedParticleCount
  });
  return certificate;
}

function positionInvariantCertificateSourceAuthorityIsCurrent(
  certificateRecord,
  { device, ancestorGeneration, particleCount }
) {
  if (
    certificateRecord.sourceAuthority
      === 'exact-ancestor-position-authority-state'
  ) {
    return certificateRecord.reactionDiscoveryProposal == null
      && certificateRecord.reactionTable == null
      && certificateRecord.reactionInputThermoBuffer == null
      && certificateRecord.reactionInputStateBuffer
        === ancestorGeneration.source?.sourceStateBuffer
      && certificateRecord.prePlacementPositionChanged === false
      && certificateRecord.ancestorPositionEpoch
        === ancestorGeneration.execution.positionEpoch
      && certificateRecord.resolvedPositionEpoch
        === ancestorGeneration.execution.positionEpoch;
  }
  if (
    ![
      'authenticated-displacement-certified-post-g2p-reaction-discovery-current-state',
      'authenticated-reaction-discovery-over-exact-ancestor-position-state'
    ].includes(certificateRecord.sourceAuthority)
    || certificateRecord.reactionDiscoveryProposal == null
    || certificateRecord.reactionTable == null
    || certificateRecord.reactionInputThermoBuffer == null
  ) {
    return false;
  }
  try {
    const authenticated =
      resolveSchroederSpatialReactionDiscoveryProposalForConsumer(
        certificateRecord.reactionDiscoveryProposal,
        {
          device,
          generation: ancestorGeneration,
          particleCount,
          reactionCount: certificateRecord.reactionTable.reactionCount,
          reactionTable: certificateRecord.reactionTable,
          sourceStateBuffer: certificateRecord.reactionInputStateBuffer,
          sourceThermoBuffer: certificateRecord.reactionInputThermoBuffer
        }
      );
    const currentStateIsDistinct =
      certificateRecord.reactionInputStateBuffer
        !== ancestorGeneration.source?.sourceStateBuffer;
    const expectedResolvedPositionEpoch = currentStateIsDistinct
      ? incrementIdentityU32(
          ancestorGeneration.execution.positionEpoch,
          'post-G2P reaction discovery position epoch'
        )
      : ancestorGeneration.execution.positionEpoch;
    return authenticated?.ready === true
      && authenticated.admitted === true
      && authenticated.generation === ancestorGeneration
      && authenticated.positionAuthorityStateBuffer
        === ancestorGeneration.source?.sourceStateBuffer
      && authenticated.sourceCurrentStateBuffer
        === certificateRecord.reactionInputStateBuffer
      && authenticated.sourceThermoBuffer
        === certificateRecord.reactionInputThermoBuffer
      && certificateRecord.prePlacementPositionChanged
        === currentStateIsDistinct
      && certificateRecord.ancestorPositionEpoch
        === ancestorGeneration.execution.positionEpoch
      && certificateRecord.resolvedPositionEpoch
        === expectedResolvedPositionEpoch;
  } catch {
    return false;
  }
}

export function isSchroederSpatialReactionPlacementSourceFamily(value) {
  return Boolean(
    value
    && placementSourceFamilies.has(value)
    && value.schema
      === ULG_SCHROEDER_SPATIAL_REACTION_PLACEMENT_SOURCE_FAMILY_SCHEMA
    && value.ready === true
    && value.authenticated === true
  );
}

export const isSchroederSpatialReactionPlacementEpochArtifact =
  isSchroederSpatialReactionPlacementSourceFamily;

export function resolveSchroederSpatialReactionPlacementSourceFamily(
  sourceFamily,
  { device = null } = {}
) {
  if (!isSchroederSpatialReactionPlacementSourceFamily(sourceFamily)) {
    throw placementEpochError(
      'placement source family was not minted by the shared-directory epoch builder',
      'SOURCE_FAMILY_BRAND'
    );
  }
  const record = placementSourceFamilyRecords.get(sourceFamily);
  if (!record || (device && record.device !== device)) {
    throw placementEpochError(
      'placement source family belongs to another device',
      'DEVICE_MISMATCH'
    );
  }
  if (record.deviceLost) {
    throw placementEpochError(
      `placement source family is quarantined after device loss: ${record.lifecycle.deviceLossReason}`,
      'DEVICE_LOST'
    );
  }
  if (
    record.lifecycle.releaseScheduled === true
    || record.lifecycle.releaseStatus === 'released-after-final-consumer'
  ) {
    throw placementEpochError(
      'placement source family is terminal or retiring',
      'RETIRED'
    );
  }
  assertDistinctPlacementBuffers(sourceFamily);
  if (
    sourceFamily.generation !== record.generation
    || sourceFamily.ancestorPublicGeneration !== record.generation
    || sourceFamily.sharedSpatialAuthorityBorrowed !== true
    || sourceFamily.private !== false
    || record.ownsGeneration !== false
    || sourceFamily.directoryBuffer !== record.generation.execution.directoryBuffer
    || sourceFamily.directorySourceBuffer
      !== record.generation.source.sourceBuffer
    || sourceFamily.directoryPositionAuthorityStateBuffer
      !== record.generation.source.sourceStateBuffer
  ) {
    throw placementEpochError(
      'placement source family no longer identifies its exact borrowed canonical generation',
      'SOURCE_FAMILY_IDENTITY'
    );
  }
  return sourceFamily;
}

export function schroederSpatialReactionPlacementSourceFamilyLiveness(
  sourceFamily,
  { device = null } = {}
) {
  if (!isSchroederSpatialReactionPlacementSourceFamily(sourceFamily)) {
    throw placementEpochError(
      'placement source family was not minted by the shared-directory epoch builder',
      'SOURCE_FAMILY_BRAND'
    );
  }
  const record = placementSourceFamilyRecords.get(sourceFamily);
  if (!record || (device && record.device !== device)) {
    throw placementEpochError('placement source family belongs to another device', 'DEVICE_MISMATCH');
  }
  return Object.freeze({
    schema: ULG_SCHROEDER_SPATIAL_REACTION_PLACEMENT_LIVENESS_SCHEMA,
    status: record.deviceLost
      ? 'schroeder-reaction-placement-source-family-device-lost-quarantined'
      : (record.lifecycle.releaseScheduled
        ? 'schroeder-reaction-placement-source-family-retiring'
        : 'schroeder-reaction-placement-source-family-active'),
    active: !record.deviceLost && record.lifecycle.releaseScheduled !== true,
    releaseScheduled: record.lifecycle.releaseScheduled === true,
    releaseStatus: record.lifecycle.releaseStatus,
    deviceLost: record.deviceLost === true,
    deviceLossStatus: record.lifecycle.deviceLossStatus,
    destinationOwnershipTransferred: record.destinationOwnershipTransferred,
    destinationStorageGeneration: sourceFamily.placedDestinationStorageGeneration,
    deviceId: sourceFamily.deviceId,
    generationId: sourceFamily.generationId
  });
}

/**
 * Convert the exact one-shot resident placement-submission artifact into an
 * ancestor-bound position-epoch floor. Compact readback observations remain
 * diagnostics and cannot upgrade this floor into an observed transition.
 */
export async function finalizeSchroederSpatialReactionPlacementPositionEpochFloor(
  sourceFamily,
  { placementArtifact } = {}
) {
  const resolvedFamily = resolveSchroederSpatialReactionPlacementSourceFamily(
    sourceFamily
  );
  const record = placementSourceFamilyRecords.get(resolvedFamily);
  if (record.positionEpochFloorReceipt) {
    if (record.finalizedPlacementArtifact !== placementArtifact) {
      throw placementEpochError(
        'placement source family was already finalized by another artifact',
        'DUPLICATE_FINALIZATION'
      );
    }
    return record.positionEpochFloorReceipt;
  }
  const productPlacementModule = await import(
    './schroederSpatialReactionProductPlacementGpu.js'
  );
  // Dynamic import is the only suspension point. Recheck after it so two
  // concurrent callers cannot mint distinct receipts for one one-shot seal,
  // and loss/retirement during module resolution cannot authenticate stale
  // resident work.
  const revalidatedFamily =
    resolveSchroederSpatialReactionPlacementSourceFamily(sourceFamily, {
      device: record.device
    });
  if (
    revalidatedFamily !== resolvedFamily
    || placementSourceFamilyRecords.get(revalidatedFamily) !== record
    || record.generation?.execution?.released === true
    || record.generation?.releaseScheduled === true
  ) {
    throw placementEpochError(
      'placement source family retired while finalizing its position epoch floor',
      'RETIRED'
    );
  }
  if (record.positionEpochFloorReceipt) {
    if (record.finalizedPlacementArtifact !== placementArtifact) {
      throw placementEpochError(
        'placement source family was already finalized by another artifact',
        'DUPLICATE_FINALIZATION'
      );
    }
    return record.positionEpochFloorReceipt;
  }
  const residentSubmissionArtifact = Boolean(
    productPlacementModule
      .isSubmittedSchroederSpatialReactionProductPlacementArtifact
      ?.(placementArtifact)
  );
  if (
    !residentSubmissionArtifact
    || placementArtifact.submitPerformed !== true
    || placementArtifact.gpuResident !== true
    || placementArtifact.authenticated !== false
    || placementArtifact.gpuAuthenticated !== false
    || placementArtifact.submissionAuthenticated !== true
    || placementArtifact.destinationSafetyAuthenticated !== true
    || placementArtifact.placementOutcomeObserved !== false
    || placementArtifact.transactionalPublicationGateEncoded !== true
    || placementArtifact.transactionalTerminalSealEncoded !== true
    || placementArtifact.transactionalFailClosedRecoveryEncoded !== true
    || placementArtifact.transactionalAuxiliaryMaterializationEncoded !== true
    || placementArtifact.destinationPublicationMode
      !== 'gpu-terminal-safe-placed-or-exact-frozen-fallback'
    || placementArtifact.positionMayChange !== true
    || placementArtifact.topologyMayChange !== true
    || placementArtifact.placementSourceFamily !== sourceFamily
    || placementArtifact.generation !== record.generation
    || placementArtifact.placedDestinationStateBuffer
      !== sourceFamily.placedDestinationStateBuffer
    || placementArtifact.placedDestinationThermoBuffer
      !== sourceFamily.placedDestinationThermoBuffer
    || placementArtifact.placedDestinationMechanicsBuffer
      !== sourceFamily.placedDestinationMechanicsBuffer
    || placementArtifact.frozenSourceStateBuffer
      !== sourceFamily.frozenSourceStateBuffer
    || placementArtifact.frozenSourceThermoBuffer
      !== sourceFamily.frozenSourceThermoBuffer
    || placementArtifact.frozenSourceMechanicsBuffer
      !== sourceFamily.frozenSourceMechanicsBuffer
  ) {
    throw placementEpochError(
      'position epoch floor requires the exact one-shot resident placement-submission artifact',
      'FINALIZATION'
    );
  }
  // A GPU-resident submission deliberately avoids a mandatory counter map.
  // The same-queue publication gate makes the destination either the complete
  // placement result or the exact frozen family. Product placement may write
  // xyz, so conservatively invalidate position identity without claiming that
  // the placement outcome itself was observed or authenticated.
  const sourcePositionEpoch = sourceFamily.epochIdentity.positionEpoch;
  const positionEpochFloor = incrementIdentityU32(
    sourcePositionEpoch,
    'placement position epoch floor'
  );
  const receipt = Object.freeze({
    schema:
      ULG_SCHROEDER_SPATIAL_REACTION_PLACEMENT_POSITION_EPOCH_FLOOR_RECEIPT_SCHEMA,
    status:
      'schroeder-reaction-placement-position-epoch-floor-authenticated-after-resident-submission',
    finalized: true,
    authenticated: true,
    positionEpochFloorAuthenticated: true,
    destinationSafetyAuthenticated: true,
    placementOutcomeAuthenticated: false,
    submitPerformed: true,
    gpuCompletionObserved: false,
    placementOutcomeObserved: false,
    transactionalPublicationGateEncoded: true,
    transactionalTerminalSealEncoded: true,
    transactionalFailClosedRecoveryEncoded: true,
    transactionalAuxiliaryMaterializationEncoded: true,
    destinationPublicationMode:
      'gpu-terminal-safe-placed-or-exact-frozen-fallback',
    completionMode:
      'gpu-resident-terminal-safe-placed-or-frozen-fallback',
    positionMutationObserved: false,
    positionMayHaveChanged: true,
    positionEpochAdvanceRequired: true,
    topologyMayChange: true,
    conservativeTopologyAdvanceRequired: true,
    sparePlacementEventCount: null,
    observedPositionMutationEventCount: null,
    sourcePositionEpoch,
    positionEpochFloor,
    destinationStorageGeneration:
      sourceFamily.placedDestinationStorageGeneration,
    ancestorPublicGenerationId: sourceFamily.ancestorPublicGenerationId,
    placementGenerationId: sourceFamily.generationId,
    deviceId: sourceFamily.deviceId
  });
  placementPositionEpochFloorReceipts.add(receipt);
  placementPositionEpochFloorReceiptRecords.set(receipt, {
    device: record.device,
    sourceFamily,
    ancestorPublicGeneration: sourceFamily.ancestorPublicGeneration,
    placementArtifact,
    stateBuffer: sourceFamily.placedDestinationStateBuffer,
    thermoBuffer: sourceFamily.placedDestinationThermoBuffer,
    mechanicsBuffer: sourceFamily.placedDestinationMechanicsBuffer,
    sourcePositionEpoch,
    positionEpochFloor,
    destinationStorageGeneration:
      sourceFamily.placedDestinationStorageGeneration
  });
  record.finalizedPlacementArtifact = placementArtifact;
  record.positionEpochFloorReceipt = receipt;
  return receipt;
}

export function validateSchroederSpatialReactionPlacementPositionEpochFloor(
  receipt,
  { device, ancestorPublicGeneration } = {}
) {
  const record = placementPositionEpochFloorReceiptRecords.get(receipt);
  return Boolean(
    record
    && placementPositionEpochFloorReceipts.has(receipt)
    && Object.isFrozen(receipt)
    && receipt.schema
      === ULG_SCHROEDER_SPATIAL_REACTION_PLACEMENT_POSITION_EPOCH_FLOOR_RECEIPT_SCHEMA
    && receipt.finalized === true
    && receipt.authenticated === true
    && receipt.positionEpochFloorAuthenticated === true
    && receipt.destinationSafetyAuthenticated === true
    && receipt.placementOutcomeAuthenticated === false
    && receipt.placementOutcomeObserved === false
    && receipt.transactionalPublicationGateEncoded === true
    && receipt.transactionalTerminalSealEncoded === true
    && receipt.transactionalFailClosedRecoveryEncoded === true
    && receipt.transactionalAuxiliaryMaterializationEncoded === true
    && receipt.destinationPublicationMode
      === 'gpu-terminal-safe-placed-or-exact-frozen-fallback'
    && receipt.positionMutationObserved === false
    && receipt.positionMayHaveChanged === true
    && receipt.positionEpochAdvanceRequired === true
    && record.device === device
    && receipt.deviceId === webGpuDeviceId(device)
    && record.ancestorPublicGeneration === ancestorPublicGeneration
    && record.sourceFamily.ancestorPublicGeneration
      === ancestorPublicGeneration
    && record.sourcePositionEpoch
      === record.sourceFamily.epochIdentity.positionEpoch
    && receipt.sourcePositionEpoch === record.sourcePositionEpoch
    && receipt.positionEpochFloor === record.positionEpochFloor
    && isExactIdentityU32Successor(
      receipt.sourcePositionEpoch,
      receipt.positionEpochFloor
    )
    && receipt.sourcePositionEpoch
      >= ancestorPublicGeneration?.execution?.positionEpoch
    && receipt.positionEpochFloor
      > ancestorPublicGeneration?.execution?.positionEpoch
  );
}

export function transferSchroederSpatialReactionPlacementDestinationOwnership(
  sourceFamily
) {
  if (!isSchroederSpatialReactionPlacementSourceFamily(sourceFamily)) {
    throw placementEpochError(
      'placement source family was not minted by the shared-directory epoch builder',
      'SOURCE_FAMILY_BRAND'
    );
  }
  const record = placementSourceFamilyRecords.get(sourceFamily);
  if (
    !record
    || record.deviceLost
    || record.lifecycle.releaseStatus === 'released-after-final-consumer'
    || record.lifecycle.releaseScheduled !== true
    || !record.finalizedPlacementArtifact
    || !record.positionEpochFloorReceipt
  ) {
    throw placementEpochError(
      'placement destination ownership can only transfer during the exact retirement handoff',
      'OWNERSHIP_TRANSFER'
    );
  }
  if (record.destinationOwnershipTransferred) return false;
  if (record.reactionWarmArenaLease) {
    transferReactionWarmArenaDestinationOwnership(
      record.reactionWarmArenaLease,
      sourceFamily,
      record.device
    );
  }
  record.destinationOwnershipTransferred = true;
  record.lifecycle.destinationOwnership = 'transferred-to-reaction-continuation';
  return true;
}

export function releaseSchroederSpatialReactionPlacementSourceFamilyAfterQueue(
  sourceFamily,
  { placementArtifact = null, abandon = false } = {}
) {
  if (!isSchroederSpatialReactionPlacementSourceFamily(sourceFamily)) {
    throw placementEpochError(
      'placement source family was not minted by the shared-directory epoch builder',
      'SOURCE_FAMILY_BRAND'
    );
  }
  const record = placementSourceFamilyRecords.get(sourceFamily);
  if (!record) {
    throw placementEpochError(
      'placement source family has no exact runtime owner record',
      'SOURCE_FAMILY_IDENTITY'
    );
  }
  if (record.lifecycle.releaseScheduled === true) return false;
  resolveSchroederSpatialReactionPlacementSourceFamily(sourceFamily);
  if (
    abandon !== true
    && (
      !placementArtifact
      || record.finalizedPlacementArtifact !== placementArtifact
      || !record.positionEpochFloorReceipt
    )
  ) {
    throw placementEpochError(
      'normal placement retirement requires the exact finalized placement artifact and position-epoch-floor receipt',
      'FINALIZATION'
    );
  }
  record.completion.status = placementArtifact
    ? 'placement-consumer-submitted'
    : 'placement-consumer-submission-observed-without-artifact';
  record.completion.placementArtifact = placementArtifact;
  const completionFence = placementArtifact?.queueFence
    ?? record.initializationFence
    ?? null;
  if (
    !completionFence?.then
    || (
      placementArtifact
      && (
        placementArtifact.queueFenceStatus !== 'exact-queue-submission-fence'
        || placementArtifact.arenaReuseAllowed !== true
      )
    )
  ) {
    record.lifecycle.releaseStatus = 'retained-without-exact-queue-fence';
    record.lifecycle.releaseReason =
      'placement-family cleanup requires the exact submission queue fence';
    return false;
  }
  record.lifecycle.releaseScheduled = true;
  record.lifecycle.releaseStatus =
    'borrowed-directory-family-cleanup-scheduled-after-placement-consumer';
  record.lifecycle.releasePromise = Promise.resolve(completionFence)
    .then(() => {
      destroyPlacementAuxiliaryResources(record);
      destroyPlacedDestinations(record);
      if (
        record.reactionWarmArenaLease
        && !record.destinationOwnershipTransferred
      ) {
        record.warmArenaReleasePromise =
          releaseSphReactionWarmArenaAfterQueue(
            record.reactionWarmArenaLease,
            {
              device: record.device,
              completionFence: Promise.resolve(true),
              abandon: true
            }
          );
      }
      record.lifecycle.releaseStatus = 'released-after-final-consumer';
      record.lifecycle.releaseReason = null;
      record.completion.status = 'placement-consumer-completed';
      return true;
    })
    .catch((error) => {
      record.lifecycle.releaseScheduled = false;
      record.lifecycle.releaseStatus = 'retained-cleanup-fence-error';
      record.lifecycle.releaseReason = error instanceof Error
        ? error.message
        : String(error);
      if (record.reactionWarmArenaLease) {
        try {
          const rejectedFence = Promise.reject(error);
          record.warmArenaReleasePromise =
            releaseSphReactionWarmArenaAfterQueue(
              record.reactionWarmArenaLease,
              {
                device: record.device,
                completionFence: rejectedFence,
                abandon: true
              }
            );
        } catch {
          // Preserve the exact queue-fence failure. Device loss is
          // still armed as the terminal arena fallback.
        }
      }
      return false;
    });
  return true;
}

/**
 * Freeze the reaction-resolve outputs and initialize a distinct mutable placed
 * family while borrowing the ancestor's authenticated canonical directory.
 * The placement classifier widens its directory query by the certified maximum
 * displacement and exact-filters candidates against this frozen current state,
 * so no law-private level assignment or SS rebuild is required.
 */
export async function runSchroederSpatialReactionPlacementEpochWebGpu({
  device,
  ancestorPublicGeneration,
  sphParticleState,
  mlsMpmParticleState,
  sphParticleUpload = null,
  frozenSourceStateBuffer,
  frozenSourceThermoBuffer,
  frozenSourceMechanicsBuffer,
  stableIdentityBuffer = sphParticleUpload?.identityBuffer ?? null,
  positionInvariantCertificate,
  placedDestinationStateBuffer = null,
  placedDestinationThermoBuffer = null,
  placedDestinationMechanicsBuffer = null,
  reactionWarmArenaLease = null
} = {}) {
  if (
    !device?.createBuffer
    || !device?.createCommandEncoder
    || !device?.queue?.submit
  ) {
    throw new TypeError(
      'reaction placement epoch requires a WebGPU-like device and queue'
    );
  }
  const particleCount = exactU32(
    sphParticleState?.particleCount,
    'sphParticleState.particleCount',
    { positive: true }
  );
  if (mlsMpmParticleState?.particleCount !== particleCount) {
    throw placementEpochError(
      'SPH and MLS-MPM particle counts must match',
      'PARTICLE_COUNT'
    );
  }
  const ancestor = requirePublicGeneration(
    device,
    ancestorPublicGeneration,
    particleCount
  );
  const stateBytes = particleCount
    * SPH_GPU_PARTICLE_STATE_FLOATS
    * Float32Array.BYTES_PER_ELEMENT;
  const thermoBytes = particleCount
    * SPH_GPU_PARTICLE_THERMO_FLOATS
    * Float32Array.BYTES_PER_ELEMENT;
  const mechanicsBytes = particleCount
    * MLS_MPM_GPU_PARTICLE_MECHANICS_FLOATS
    * Float32Array.BYTES_PER_ELEMENT;
  const reactionWarmArena = reactionWarmArenaLease
    ? resolveSphReactionWarmArenaLease(reactionWarmArenaLease, {
        device,
        particleCapacity: particleCount
      })
    : null;
  const reactionWarmBuffers = reactionWarmArena?.buffers ?? null;
  const frozenState = requireDeviceBuffer(
    device,
    frozenSourceStateBuffer,
    'frozen resolved state',
    stateBytes
  );
  const frozenThermo = requireDeviceBuffer(
    device,
    frozenSourceThermoBuffer,
    'frozen resolved thermo',
    thermoBytes
  );
  const frozenMechanics = requireDeviceBuffer(
    device,
    frozenSourceMechanicsBuffer,
    'frozen resolved mechanics',
    mechanicsBytes
  );
  if (
    reactionWarmBuffers
    && (
      frozenState !== reactionWarmBuffers.resolvedState
      || frozenThermo !== reactionWarmBuffers.resolvedThermo
      || frozenMechanics !== reactionWarmBuffers.resolvedMechanics
    )
  ) {
    throw placementEpochError(
      'reaction warm arena must carry the exact frozen resolve output family',
      'WARM_ARENA_IDENTITY'
    );
  }
  const certificateRecord = positionInvariantCertificateRecords.get(
    positionInvariantCertificate
  );
  if (
    !positionInvariantCertificates.has(positionInvariantCertificate)
    || !certificateRecord
    || certificateRecord.device !== device
    || certificateRecord.ancestorGeneration !== ancestor
    || !positionInvariantCertificateSourceAuthorityIsCurrent(
      certificateRecord,
      {
        device,
        ancestorGeneration: ancestor,
        particleCount
      }
    )
    || positionInvariantCertificate.sourceAuthority
      !== certificateRecord.sourceAuthority
    || positionInvariantCertificate.prePlacementPositionChanged
      !== certificateRecord.prePlacementPositionChanged
    || positionInvariantCertificate.ancestorPositionEpoch
      !== certificateRecord.ancestorPositionEpoch
    || positionInvariantCertificate.resolvedPositionEpoch
      !== certificateRecord.resolvedPositionEpoch
    || certificateRecord.frozenResolvedStateBuffer !== frozenState
    || certificateRecord.particleCount !== particleCount
  ) {
    throw placementEpochError(
      'numeric position-epoch inheritance requires the exact resolve certificate',
      'POSITION_INVARIANCE'
    );
  }
  const identityRequired = sphParticleUpload?.identityRequired === true;
  const identityBytes = particleCount
    * SPH_GPU_PARTICLE_IDENTITY_UINTS
    * Uint32Array.BYTES_PER_ELEMENT;
  if (identityRequired || stableIdentityBuffer) {
    requireDeviceBuffer(
      device,
      stableIdentityBuffer,
      'stable particle identity',
      identityBytes
    );
  }
  const {
    allocateSchroederSpatialSuccessorBufferFamilyIdentity
  } = await import('./schroederSpatialSuccessorSourceFamily.js');
  const ancestorEpochIdentity = exactEpochIdentity(ancestor.execution);
  const stageStorageAllocation =
    allocateSchroederSpatialSuccessorBufferFamilyIdentity({
      device,
      afterStorageGeneration: ancestorEpochIdentity.storageGeneration,
      purpose: 'reaction-placement-frozen-resolved-source-family'
    });
  const destinationStorageAllocation =
    allocateSchroederSpatialSuccessorBufferFamilyIdentity({
      device,
      afterStorageGeneration: stageStorageAllocation.storageGeneration,
      purpose: 'reaction-placement-final-destination-family'
    });

  const frozenSources = [frozenState, frozenThermo, frozenMechanics];
  const immutableSourceFamily = stableIdentityBuffer
    ? [...frozenSources, stableIdentityBuffer]
    : frozenSources;
  if (new Set(immutableSourceFamily).size !== immutableSourceFamily.length) {
    throw placementEpochError(
      'frozen placement state, thermo, mechanics, and identity sources must be pairwise distinct',
      'SOURCE_ALIAS'
    );
  }
  const requestedDestinationState = placedDestinationStateBuffer
    ?? reactionWarmBuffers?.placedState
    ?? null;
  const requestedDestinationThermo = placedDestinationThermoBuffer
    ?? reactionWarmBuffers?.placedThermo
    ?? null;
  const requestedDestinationMechanics = placedDestinationMechanicsBuffer
    ?? reactionWarmBuffers?.placedMechanics
    ?? null;
  if (
    reactionWarmBuffers
    && (
      requestedDestinationState !== reactionWarmBuffers.placedState
      || requestedDestinationThermo !== reactionWarmBuffers.placedThermo
      || requestedDestinationMechanics !== reactionWarmBuffers.placedMechanics
    )
  ) {
    throw placementEpochError(
      'reaction warm arena placement destinations cannot be replaced or aliased',
      'WARM_ARENA_IDENTITY'
    );
  }
  const providedDestinations = [
    requestedDestinationState,
    requestedDestinationThermo,
    requestedDestinationMechanics
  ].filter(Boolean);
  if (
    providedDestinations.some((buffer) => frozenSources.includes(buffer))
    || new Set(providedDestinations).size !== providedDestinations.length
  ) {
    throw placementEpochError(
      'provided placement destinations must be distinct from every frozen source and each other',
      'SOURCE_DESTINATION_ALIAS'
    );
  }
  const validatedProvidedState = requestedDestinationState
    ? requireDeviceBuffer(
        device,
        requestedDestinationState,
        'placed destination state',
        stateBytes
      )
    : null;
  const validatedProvidedThermo = requestedDestinationThermo
    ? requireDeviceBuffer(
        device,
        requestedDestinationThermo,
        'placed destination thermo',
        thermoBytes
      )
    : null;
  const validatedProvidedMechanics = requestedDestinationMechanics
    ? requireDeviceBuffer(
        device,
        requestedDestinationMechanics,
        'placed destination mechanics',
        mechanicsBytes
      )
    : null;
  let destinationState = validatedProvidedState;
  let destinationThermo = validatedProvidedThermo;
  let destinationMechanics = validatedProvidedMechanics;
  try {
    destinationState ||= createPlacedDestinationBuffer(
      device,
      'ulg-schroeder-reaction-placement-state-destination',
      stateBytes
    );
    destinationThermo ||= createPlacedDestinationBuffer(
      device,
      'ulg-schroeder-reaction-placement-thermo-destination',
      thermoBytes
    );
    destinationMechanics ||= createPlacedDestinationBuffer(
      device,
      'ulg-schroeder-reaction-placement-mechanics-destination',
      mechanicsBytes
    );
  } catch (error) {
    if (!validatedProvidedState) destinationState?.destroy?.();
    if (!validatedProvidedThermo) destinationThermo?.destroy?.();
    if (!validatedProvidedMechanics) destinationMechanics?.destroy?.();
    throw error;
  }
  const callerOwnedDestinations = Object.freeze({
    state: Boolean(placedDestinationStateBuffer),
    thermo: Boolean(placedDestinationThermoBuffer),
    mechanics: Boolean(placedDestinationMechanicsBuffer)
  });
  const arenaOwnedDestinations = Object.freeze({
    state: Boolean(reactionWarmBuffers),
    thermo: Boolean(reactionWarmBuffers),
    mechanics: Boolean(reactionWarmBuffers)
  });
  const bufferFamily = {
    frozenSourceStateBuffer: frozenState,
    frozenSourceThermoBuffer: frozenThermo,
    frozenSourceMechanicsBuffer: frozenMechanics,
    placedDestinationStateBuffer: destinationState,
    placedDestinationThermoBuffer: destinationThermo,
    placedDestinationMechanicsBuffer: destinationMechanics,
    stateBufferByteLength: stateBytes,
    thermoBufferByteLength: thermoBytes,
    mechanicsBufferByteLength: mechanicsBytes
  };
  assertDistinctPlacementBuffers(bufferFamily);

  const stageEpochIdentity = Object.freeze({
    storageGeneration: stageStorageAllocation.storageGeneration,
    physicsTick: ancestorEpochIdentity.physicsTick,
    physicsSubstep: incrementIdentityU32(
      ancestorEpochIdentity.physicsSubstep,
      'placement physics substep'
    ),
    positionEpoch: certificateRecord.resolvedPositionEpoch,
    topologyEpoch: ancestorEpochIdentity.topologyEpoch,
    chartEpoch: ancestorEpochIdentity.chartEpoch,
    levelEpoch: ancestorEpochIdentity.levelEpoch,
    supportEpoch: ancestorEpochIdentity.supportEpoch
  });

  let initializationFence = null;
  try {
    initializationFence = submitFrozenFamilyCopy(device, bufferFamily);
    const stageEpochTuple = Object.freeze({
      stageIdentity: SCHROEDER_SPATIAL_REACTION_PLACEMENT_STAGE_ID,
      sourceFamilyId: SCHROEDER_SPATIAL_REACTION_PLACEMENT_SOURCE_FAMILY_ID,
      generationId: ancestor.execution.generationId,
      ...stageEpochIdentity
    });
    const completion = {
      status: 'placement-consumer-not-yet-submitted',
      placementArtifact: null
    };
    const lifecycle = {
      status: 'shared-directory-placement-family-retained',
      destinationOwnership: 'placement-family-owned-destination',
      releaseScheduled: false,
      releaseStatus: 'retained-for-placement-consumer',
      releaseReason: null,
      releasePromise: null,
      deviceLossStatus: 'device-loss-quarantine-not-armed',
      deviceLossReason: null
    };
    const family = Object.freeze({
      schema:
        ULG_SCHROEDER_SPATIAL_REACTION_PLACEMENT_SOURCE_FAMILY_SCHEMA,
      status: 'schroeder-spatial-reaction-placement-source-family-ready',
      ready: true,
      authenticated: true,
      private: false,
      sharedSpatialAuthorityBorrowed: true,
      stageIdentity: SCHROEDER_SPATIAL_REACTION_PLACEMENT_STAGE_ID,
      sourceFamilyId: SCHROEDER_SPATIAL_REACTION_PLACEMENT_SOURCE_FAMILY_ID,
      deviceId: webGpuDeviceId(device),
      particleCount,
      generation: ancestor,
      generationId: ancestor.execution.generationId,
      epochIdentity: stageEpochIdentity,
      stageEpochTuple,
      ancestorPublicGeneration: ancestor,
      ancestorPublicGenerationId: ancestor.execution.generationId,
      ancestorPublicEpochIdentity: ancestorEpochIdentity,
      directoryEpochIdentity: ancestorEpochIdentity,
      queryStateEpochIdentity: stageEpochIdentity,
      ancestorLineageStatus: 'exact-public-generation-ancestor-bound',
      positionInvariantCertificate,
      positionEpochInheritance:
        'certified-reaction-resolve-does-not-integrate-positions',
      levelAssignment: null,
      directoryBuffer: ancestor.execution.directoryBuffer,
      directorySourceBuffer: ancestor.source.sourceBuffer,
      directoryPositionAuthorityStateBuffer:
        ancestor.source.sourceStateBuffer,
      sourceBuffer: ancestor.source.sourceBuffer,
      identityBuffer: stableIdentityBuffer,
      identityMode: stableIdentityBuffer
        ? 'stable-explicit-particle-identity-buffer'
        : 'stable-implicit-source-row-index',
      ...bufferFamily,
      placedDestinationPublicationStatus:
        'transactional-mutable-destination-initialized-awaiting-placement',
      placedDestinationStorageGeneration:
        destinationStorageAllocation.storageGeneration,
      exactNearQueryGeometry: Object.freeze({
        authenticated: true,
        chartId: ancestor.execution.queryChartId,
        minLevel: ancestor.execution.queryMinLevel,
        maxLevel: ancestor.execution.queryMaxLevel,
        levelCount: ancestor.execution.queryLevelCount,
        baseGridSpacingM: ancestor.execution.queryBaseGridSpacingM,
        mode: ancestor.execution.queryGeometryMode
      }),
      displacementAuthority:
        'gpu-envelope-max-displacement-from-canonical-directory-position-state',
      directoryBuildCount: 0,
      privateLookupBuildCount: 0,
      privateLawSpatialBuildCount: 0,
      levelAssignmentBuildCount: 0,
      fullParticleReadbackPerformed: false
    });
    const record = {
      device,
      family,
      generation: ancestor,
      ownsGeneration: false,
      levelAssignment: null,
      completion,
      lifecycle,
      deviceLost: false,
      callerOwnedDestinations,
      arenaOwnedDestinations,
      reactionWarmArenaLease,
      destinationOwnershipTransferred: false,
      destinationReturnScheduled: false,
      destinationReturnPromise: null,
      warmArenaReleasePromise: null,
      auxiliaryDestroyed: false,
      destroyed: new Set(),
      initializationFence,
      stageStorageAllocation,
      destinationStorageAllocation,
      finalizedPlacementArtifact: null,
      positionEpochFloorReceipt: null
    };
    if (reactionWarmArenaLease) {
      bindReactionWarmArenaSourceFamily(
        reactionWarmArenaLease,
        family,
        device
      );
    }
    placementSourceFamilies.add(family);
    placementSourceFamilyRecords.set(family, record);
    armDeviceLoss(record);
    return family;
  } catch (error) {
    const cleanup = () => {
      if (!callerOwnedDestinations.state && !arenaOwnedDestinations.state) {
        destinationState.destroy?.();
      }
      if (!callerOwnedDestinations.thermo && !arenaOwnedDestinations.thermo) {
        destinationThermo.destroy?.();
      }
      if (!callerOwnedDestinations.mechanics && !arenaOwnedDestinations.mechanics) {
        destinationMechanics.destroy?.();
      }
    };
    const cleanupFence = initializationFence
      ?? device.queue?.onSubmittedWorkDone?.();
    // The frozen-family initialization may already be submitted. Without a
    // genuine completion fence, leaking destination storage is safer than
    // destroying buffers that submitted GPU work may still reference.
    if (cleanupFence?.then) {
      Promise.resolve(cleanupFence).then(cleanup, () => {});
      if (reactionWarmArenaLease) {
        try {
          releaseSphReactionWarmArenaAfterQueue(reactionWarmArenaLease, {
            device,
            completionFence: cleanupFence,
            abandon: true
          });
        } catch {
          // A previously bound family owns the only legal release path. Its
          // device-loss observer remains armed if that path cannot schedule.
        }
      }
    }
    throw error;
  }
}
