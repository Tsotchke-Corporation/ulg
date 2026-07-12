export const NATIVE_SURFACE_GRADIENT_SNAPSHOT_POOL_SCHEMA =
  'peercompute.ulg.native-surface-gradient-snapshot-pool.v0';
export const NATIVE_SURFACE_GRADIENT_SNAPSHOT_RESERVATION_SCHEMA =
  'peercompute.ulg.native-surface-gradient-snapshot-reservation.v0';
export const NATIVE_SURFACE_GRADIENT_SNAPSHOT_RESOURCE_SCHEMA =
  'peercompute.ulg.native-surface-gradient-snapshot-resource.v0';

const DEFAULT_MAX_SLOTS_PER_KEY = 3;
const DEFAULT_MAX_SLOT_KEYS = 64;
const MAX_CONFIGURED_SLOTS_PER_KEY = 32;
const MAX_CONFIGURED_SLOT_KEYS = 4096;
const DEFAULT_MAX_BUFFER_BYTE_LENGTH = 1024 * 1024 * 1024;

const GPU_BUFFER_USAGE = {
  COPY_DST: globalThis.GPUBufferUsage?.COPY_DST ?? 8,
  STORAGE: globalThis.GPUBufferUsage?.STORAGE ?? 128
};

const DEFAULT_BUFFER_USAGE = GPU_BUFFER_USAGE.COPY_DST | GPU_BUFFER_USAGE.STORAGE;

function boundedInteger(value, fallback, minimum, maximum, name) {
  const resolved = Number(value ?? fallback);
  if (!Number.isFinite(resolved)) {
    throw new RangeError(`${name} must be finite`);
  }
  const rounded = Math.round(resolved);
  if (rounded < minimum || rounded > maximum) {
    throw new RangeError(`${name} must be in [${minimum}, ${maximum}]`);
  }
  return rounded;
}

function normalizeSlotKey(value) {
  const key = String(value ?? 'primary').trim();
  if (!key) throw new TypeError('slotKey must be a non-empty string');
  return key;
}

function normalizeByteLength(value, maximum, name = 'byteLength') {
  const bytes = Number(value);
  if (!Number.isFinite(bytes) || bytes <= 0) {
    throw new RangeError(`${name} must be positive and finite`);
  }
  const aligned = Math.ceil(bytes / 4) * 4;
  if (!Number.isSafeInteger(aligned) || aligned > maximum) {
    throw new RangeError(`${name} exceeds the configured buffer limit`);
  }
  return aligned;
}

function normalizeUsage(value) {
  const usage = Number(value ?? DEFAULT_BUFFER_USAGE);
  if (!Number.isSafeInteger(usage) || usage <= 0) {
    throw new RangeError('usage must be a positive integer bit mask');
  }
  return usage;
}

function normalizeOwnerGeneration(value) {
  const generation = Number(value);
  if (!Number.isFinite(generation) || generation < 0) {
    throw new RangeError('ownerGeneration must be finite and non-negative');
  }
  return Math.round(generation);
}

function snapshotPoolError(message, code) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function safeLabelSegment(value) {
  return String(value)
    .replace(/[^a-zA-Z0-9_.:-]+/g, '-')
    .slice(0, 96);
}

function reservationRejection({ code, reason, slotKey, byteLength, usage }) {
  return Object.freeze({
    schema: NATIVE_SURFACE_GRADIENT_SNAPSHOT_RESERVATION_SCHEMA,
    accepted: false,
    status: 'native-surface-gradient-snapshot-reservation-rejected',
    code,
    reason,
    slotKey,
    byteLength,
    usage,
    buffer: null
  });
}

/**
 * Owns the presentation copies used for native surface gradient sampling.
 * Buffer copies remain caller encoded and caller submitted; this pool never
 * touches a queue or introduces a CPU-visible completion boundary.
 */
export function createNativeSurfaceGradientSnapshotPool({
  maxSlotsPerKey = DEFAULT_MAX_SLOTS_PER_KEY,
  maxSlotKeys = DEFAULT_MAX_SLOT_KEYS,
  maxBufferByteLength = DEFAULT_MAX_BUFFER_BYTE_LENGTH,
  labelPrefix = 'ulg-native-surface-gradient-snapshot'
} = {}) {
  const slotsPerKey = boundedInteger(
    maxSlotsPerKey,
    DEFAULT_MAX_SLOTS_PER_KEY,
    1,
    MAX_CONFIGURED_SLOTS_PER_KEY,
    'maxSlotsPerKey'
  );
  const slotKeyLimit = boundedInteger(
    maxSlotKeys,
    DEFAULT_MAX_SLOT_KEYS,
    1,
    MAX_CONFIGURED_SLOT_KEYS,
    'maxSlotKeys'
  );
  const bufferByteLimit = normalizeByteLength(
    maxBufferByteLength,
    Number.MAX_SAFE_INTEGER,
    'maxBufferByteLength'
  );
  const resolvedLabelPrefix = String(labelPrefix || '').trim();
  if (!resolvedLabelPrefix) throw new TypeError('labelPrefix must be a non-empty string');

  const buckets = new Map();
  const reservationRecords = new WeakMap();
  const resourceRecords = new WeakMap();
  const activeReservations = new Set();
  const activeResources = new Set();
  let destroyed = false;
  let nextSlotId = 1;
  let nextReservationId = 1;
  let allocationCount = 0;
  let bufferDestroyCount = 0;
  let reservationCount = 0;
  let commitCount = 0;
  let abortCount = 0;
  let releaseCount = 0;
  let rejectionCount = 0;

  function reject(args) {
    rejectionCount += 1;
    return reservationRejection(args);
  }

  function createBuffer(device, { slotKey, slotId, byteLength, usage }) {
    return device.createBuffer({
      label: `${resolvedLabelPrefix}-${safeLabelSegment(slotKey)}-${slotId}`,
      size: byteLength,
      usage
    });
  }

  function destroySlotBuffer(slot, errors = []) {
    if (!slot?.buffer || slot.bufferDestroyed) return;
    const buffer = slot.buffer;
    try {
      buffer.destroy?.();
      slot.bufferDestroyed = true;
      bufferDestroyCount += 1;
    } catch (error) {
      errors.push({
        slotKey: slot.slotKey,
        slotId: slot.slotId,
        reason: error instanceof Error ? error.message : String(error)
      });
    }
  }

  function replaceIdleSlotBuffer(slot, device, byteLength, usage) {
    if (slot.state !== 'idle') {
      throw snapshotPoolError(
        'native surface gradient snapshot pool attempted to replace a busy slot',
        'ULG_NATIVE_SURFACE_GRADIENT_SNAPSHOT_SLOT_BUSY'
      );
    }
    const replacement = createBuffer(device, {
      slotKey: slot.slotKey,
      slotId: slot.slotId,
      byteLength,
      usage
    });
    const errors = [];
    destroySlotBuffer(slot, errors);
    if (errors.length > 0) {
      replacement.destroy?.();
      throw snapshotPoolError(
        `native surface gradient snapshot buffer replacement failed: ${errors[0].reason}`,
        'ULG_NATIVE_SURFACE_GRADIENT_SNAPSHOT_BUFFER_REPLACEMENT_FAILED'
      );
    }
    slot.device = device;
    slot.buffer = replacement;
    slot.bufferDestroyed = false;
    slot.capacityByteLength = byteLength;
    slot.usage = usage;
    slot.allocationGeneration += 1;
    allocationCount += 1;
    return slot;
  }

  function allocateSlot(bucket, device, byteLength, usage) {
    const slotId = nextSlotId;
    nextSlotId += 1;
    const buffer = createBuffer(device, {
      slotKey: bucket.slotKey,
      slotId,
      byteLength,
      usage
    });
    const slot = {
      slotKey: bucket.slotKey,
      slotId,
      device,
      buffer,
      bufferDestroyed: false,
      capacityByteLength: byteLength,
      usage,
      state: 'idle',
      activeRecord: null,
      allocationGeneration: 1
    };
    bucket.slots.push(slot);
    allocationCount += 1;
    return slot;
  }

  function selectSlot(bucket, device, byteLength, usage) {
    const compatible = bucket.slots
      .filter((slot) => (
        slot.state === 'idle'
        && !slot.bufferDestroyed
        && slot.device === device
        && slot.usage === usage
        && slot.capacityByteLength >= byteLength
      ))
      .sort((a, b) => a.capacityByteLength - b.capacityByteLength)[0];
    if (compatible) return compatible;

    const idleSlots = bucket.slots.filter((slot) => slot.state === 'idle');
    if (idleSlots.length > 0) {
      const sameDevice = idleSlots.find((slot) => slot.device === device) ?? null;
      return replaceIdleSlotBuffer(
        sameDevice ?? idleSlots[0],
        device,
        byteLength,
        usage
      );
    }
    if (bucket.slots.length < slotsPerKey) {
      return allocateSlot(bucket, device, byteLength, usage);
    }
    return null;
  }

  function reserve({
    device,
    slotKey = 'primary',
    byteLength,
    usage = DEFAULT_BUFFER_USAGE
  } = {}) {
    const key = normalizeSlotKey(slotKey);
    const bytes = normalizeByteLength(byteLength, bufferByteLimit);
    const normalizedUsage = normalizeUsage(usage);
    if (!device || typeof device.createBuffer !== 'function') {
      throw new TypeError('device must provide createBuffer()');
    }
    if (destroyed) {
      return reject({
        code: 'ULG_NATIVE_SURFACE_GRADIENT_SNAPSHOT_POOL_DESTROYED',
        reason: 'native surface gradient snapshot pool is destroyed',
        slotKey: key,
        byteLength: bytes,
        usage: normalizedUsage
      });
    }

    let bucket = buckets.get(key) ?? null;
    if (!bucket) {
      if (buckets.size >= slotKeyLimit) {
        return reject({
          code: 'ULG_NATIVE_SURFACE_GRADIENT_SNAPSHOT_SLOT_KEY_LIMIT',
          reason: `native surface gradient snapshot pool is bounded at ${slotKeyLimit} slot keys`,
          slotKey: key,
          byteLength: bytes,
          usage: normalizedUsage
        });
      }
      bucket = { slotKey: key, slots: [] };
      buckets.set(key, bucket);
    }

    let slot = null;
    try {
      slot = selectSlot(bucket, device, bytes, normalizedUsage);
    } catch (error) {
      if (bucket.slots.length === 0) buckets.delete(key);
      return reject({
        code: error?.code || 'ULG_NATIVE_SURFACE_GRADIENT_SNAPSHOT_ALLOCATION_FAILED',
        reason: error instanceof Error ? error.message : String(error),
        slotKey: key,
        byteLength: bytes,
        usage: normalizedUsage
      });
    }
    if (!slot) {
      return reject({
        code: 'ULG_NATIVE_SURFACE_GRADIENT_SNAPSHOT_POOL_EXHAUSTED',
        reason: `all ${slotsPerKey} native surface gradient snapshot slots are reserved or committed`,
        slotKey: key,
        byteLength: bytes,
        usage: normalizedUsage
      });
    }

    const reservationId = nextReservationId;
    nextReservationId += 1;
    const record = {
      status: 'reserved',
      slot,
      buffer: slot.buffer,
      byteLength: bytes,
      reservationId,
      resourceHandle: null
    };
    slot.state = 'reserved';
    slot.activeRecord = record;
    activeReservations.add(record);
    reservationCount += 1;

    let handle = null;
    handle = Object.freeze({
      schema: NATIVE_SURFACE_GRADIENT_SNAPSHOT_RESERVATION_SCHEMA,
      accepted: true,
      slotKey: key,
      slotId: slot.slotId,
      reservationId,
      byteLength: bytes,
      capacityByteLength: slot.capacityByteLength,
      usage: normalizedUsage,
      buffer: record.buffer,
      allocationGeneration: slot.allocationGeneration,
      get status() {
        return record.status;
      },
      commit(options = {}) {
        return commit(handle, options);
      },
      abort() {
        return abort(handle);
      }
    });
    reservationRecords.set(handle, record);
    return handle;
  }

  function commit(reservation, { ownerGeneration } = {}) {
    const record = reservationRecords.get(reservation);
    if (!record || record.status !== 'reserved') {
      throw snapshotPoolError(
        'native surface gradient snapshot reservation is no longer active',
        'ULG_NATIVE_SURFACE_GRADIENT_SNAPSHOT_RESERVATION_INACTIVE'
      );
    }
    if (destroyed) {
      throw snapshotPoolError(
        'native surface gradient snapshot pool is destroyed',
        'ULG_NATIVE_SURFACE_GRADIENT_SNAPSHOT_POOL_DESTROYED'
      );
    }
    const generation = normalizeOwnerGeneration(ownerGeneration);
    const { slot } = record;
    if (slot.state !== 'reserved' || slot.activeRecord !== record || slot.buffer !== record.buffer) {
      throw snapshotPoolError(
        'native surface gradient snapshot reservation lost its slot identity',
        'ULG_NATIVE_SURFACE_GRADIENT_SNAPSHOT_RESERVATION_IDENTITY_MISMATCH'
      );
    }

    record.status = 'committed';
    record.ownerGeneration = generation;
    activeReservations.delete(record);
    activeResources.add(record);
    slot.state = 'committed';
    commitCount += 1;

    let resource = null;
    resource = Object.freeze({
      schema: NATIVE_SURFACE_GRADIENT_SNAPSHOT_RESOURCE_SCHEMA,
      slotKey: slot.slotKey,
      slotId: slot.slotId,
      reservationId: record.reservationId,
      ownerGeneration: generation,
      byteLength: record.byteLength,
      capacityByteLength: slot.capacityByteLength,
      usage: slot.usage,
      buffer: record.buffer,
      allocationGeneration: slot.allocationGeneration,
      get status() {
        return record.status;
      },
      get released() {
        return record.status !== 'committed';
      },
      release() {
        return release(resource);
      }
    });
    record.resourceHandle = resource;
    resourceRecords.set(resource, record);
    return resource;
  }

  function abort(reservation) {
    const record = reservationRecords.get(reservation);
    if (!record || record.status !== 'reserved') return false;
    const { slot } = record;
    record.status = 'aborted';
    activeReservations.delete(record);
    if (slot.activeRecord === record) {
      slot.activeRecord = null;
      slot.state = 'idle';
    }
    abortCount += 1;
    return true;
  }

  function release(resource) {
    const record = resourceRecords.get(resource);
    if (!record || record.status !== 'committed') return false;
    const { slot } = record;
    record.status = 'released';
    activeResources.delete(record);
    if (slot.activeRecord === record) {
      slot.activeRecord = null;
      slot.state = 'idle';
    }
    releaseCount += 1;
    return true;
  }

  function summarize() {
    const bucketSummaries = [...buckets.values()].map((bucket) => ({
      slotKey: bucket.slotKey,
      slotCount: bucket.slots.length,
      idleSlotCount: bucket.slots.filter((slot) => slot.state === 'idle').length,
      reservedSlotCount: bucket.slots.filter((slot) => slot.state === 'reserved').length,
      committedSlotCount: bucket.slots.filter((slot) => slot.state === 'committed').length,
      retainedByteLength: bucket.slots.reduce(
        (sum, slot) => sum + (slot.bufferDestroyed ? 0 : slot.capacityByteLength),
        0
      ),
      slots: bucket.slots.map((slot) => ({
        slotId: slot.slotId,
        state: slot.state,
        capacityByteLength: slot.capacityByteLength,
        usage: slot.usage,
        allocationGeneration: slot.allocationGeneration,
        bufferDestroyed: slot.bufferDestroyed,
        ownerGeneration: slot.state === 'committed'
          ? slot.activeRecord?.ownerGeneration ?? null
          : null
      }))
    }));
    return {
      schema: NATIVE_SURFACE_GRADIENT_SNAPSHOT_POOL_SCHEMA,
      status: destroyed
        ? 'native-surface-gradient-snapshot-pool-destroyed'
        : 'native-surface-gradient-snapshot-pool-ready',
      destroyed,
      maxSlotsPerKey: slotsPerKey,
      maxSlotKeys: slotKeyLimit,
      maxBufferByteLength: bufferByteLimit,
      slotKeyCount: bucketSummaries.length,
      slotCount: bucketSummaries.reduce((sum, bucket) => sum + bucket.slotCount, 0),
      idleSlotCount: bucketSummaries.reduce((sum, bucket) => sum + bucket.idleSlotCount, 0),
      reservedSlotCount: activeReservations.size,
      committedSlotCount: activeResources.size,
      retainedByteLength: bucketSummaries.reduce(
        (sum, bucket) => sum + bucket.retainedByteLength,
        0
      ),
      allocationCount,
      bufferDestroyCount,
      reservationCount,
      commitCount,
      abortCount,
      releaseCount,
      rejectionCount,
      buckets: bucketSummaries
    };
  }

  function destroy({ force = false } = {}) {
    if (destroyed) {
      return {
        schema: NATIVE_SURFACE_GRADIENT_SNAPSHOT_POOL_SCHEMA,
        status: 'native-surface-gradient-snapshot-pool-already-destroyed',
        destroyed: false,
        forced: Boolean(force),
        destroyedBufferCount: 0,
        invalidatedReservationCount: 0,
        invalidatedResourceCount: 0,
        errors: []
      };
    }
    const reservedCount = activeReservations.size;
    const committedCount = activeResources.size;
    if (!force && (reservedCount > 0 || committedCount > 0)) {
      return {
        schema: NATIVE_SURFACE_GRADIENT_SNAPSHOT_POOL_SCHEMA,
        status: 'native-surface-gradient-snapshot-pool-destroy-blocked-busy-slots',
        destroyed: false,
        forced: false,
        destroyedBufferCount: 0,
        blockedReservationCount: reservedCount,
        blockedResourceCount: committedCount,
        invalidatedReservationCount: 0,
        invalidatedResourceCount: 0,
        errors: []
      };
    }

    for (const record of activeReservations) record.status = 'invalidated-by-force-destroy';
    for (const record of activeResources) record.status = 'invalidated-by-force-destroy';
    activeReservations.clear();
    activeResources.clear();
    const errors = [];
    const beforeDestroyCount = bufferDestroyCount;
    for (const bucket of buckets.values()) {
      for (const slot of bucket.slots) {
        slot.activeRecord = null;
        slot.state = 'destroyed';
        destroySlotBuffer(slot, errors);
      }
    }
    buckets.clear();
    destroyed = true;
    return {
      schema: NATIVE_SURFACE_GRADIENT_SNAPSHOT_POOL_SCHEMA,
      status: errors.length > 0
        ? 'native-surface-gradient-snapshot-pool-destroyed-with-errors'
        : 'native-surface-gradient-snapshot-pool-destroyed',
      destroyed: true,
      forced: Boolean(force),
      destroyedBufferCount: bufferDestroyCount - beforeDestroyCount,
      invalidatedReservationCount: force ? reservedCount : 0,
      invalidatedResourceCount: force ? committedCount : 0,
      errors
    };
  }

  return Object.freeze({
    schema: NATIVE_SURFACE_GRADIENT_SNAPSHOT_POOL_SCHEMA,
    maxSlotsPerKey: slotsPerKey,
    maxSlotKeys: slotKeyLimit,
    maxBufferByteLength: bufferByteLimit,
    reserve,
    commit,
    abort,
    release,
    summarize,
    destroy
  });
}
