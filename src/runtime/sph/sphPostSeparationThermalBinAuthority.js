import {
  tagWebGpuBufferDevice,
  webGpuBufferMatchesDevice,
  webGpuDeviceId
} from './sphGpuDeviceIdentity.js';

export const ULG_POST_SEPARATION_THERMAL_BIN_AUTHORITY_SCHEMA =
  'peercompute.ulg.post-separation-thermal-bin-authority.v1';

const GPU_BUFFER_USAGE_STORAGE = globalThis.GPUBufferUsage?.STORAGE ?? 128;
const authorityRecords = new WeakMap();

function exactPositiveU32(value, label) {
  if (
    !Number.isInteger(value)
    || value < 1
    || value > 0xffff_ffff
  ) {
    throw new TypeError(`${label} must be an exact positive u32`);
  }
  return value;
}

function requireBuffer(device, buffer, label, minimumByteLength = 0) {
  if (!buffer || !webGpuBufferMatchesDevice(buffer, device)) {
    throw new TypeError(`${label} must be a live buffer on the authority device`);
  }
  if (
    Number.isFinite(Number(buffer.size))
    && Number(buffer.size) < minimumByteLength
  ) {
    throw new RangeError(`${label} is smaller than its declared authority extent`);
  }
  if (
    Number.isFinite(Number(buffer.usage))
    && (Number(buffer.usage) & GPU_BUFFER_USAGE_STORAGE) === 0
  ) {
    throw new TypeError(`${label} must carry STORAGE usage`);
  }
  return tagWebGpuBufferDevice(buffer, device);
}

function destroyRecord(record) {
  if (record.destroyed) return false;
  record.destroyed = true;
  record.active = false;
  try {
    record.binsBuffer.destroy?.();
  } finally {
    record.destroyCount += 1;
  }
  return true;
}

/**
 * Mint the sole runtime brand for a bin refill encoded after separation apply
 * and submitted by G2P. Consumers resolve the private record; copied metadata
 * and hand-labelled buffers cannot satisfy that lookup.
 */
export function issuePostSeparationThermalBinAuthority({
  device,
  stateBuffer,
  binsBuffer,
  particleCount,
  capacity,
  nx,
  ny,
  nz,
  cellSizeM,
  producerSubmission
} = {}) {
  if (!device?.queue || !producerSubmission?.commandBuffer) {
    throw new TypeError(
      'Post-separation thermal bins require an observed G2P command submission'
    );
  }
  const exactParticleCount = exactPositiveU32(particleCount, 'particleCount');
  const exactCapacity = exactPositiveU32(capacity, 'capacity');
  const exactNx = exactPositiveU32(nx, 'nx');
  const exactNy = exactPositiveU32(ny, 'ny');
  const exactNz = exactPositiveU32(nz, 'nz');
  const cellCount = exactNx * exactNy * exactNz;
  if (!Number.isSafeInteger(cellCount) || cellCount > 0xffff_ffff) {
    throw new RangeError('Post-separation thermal bin cell count overflowed u32');
  }
  const exactCellSizeM = Number(cellSizeM);
  if (!Number.isFinite(exactCellSizeM) || exactCellSizeM <= 0) {
    throw new TypeError('cellSizeM must be finite and positive');
  }
  const requiredBinBytes = cellCount * (1 + exactCapacity)
    * Uint32Array.BYTES_PER_ELEMENT;
  requireBuffer(
    device,
    stateBuffer,
    'stateBuffer',
    exactParticleCount * 8 * Float32Array.BYTES_PER_ELEMENT
  );
  requireBuffer(device, binsBuffer, 'binsBuffer', requiredBinBytes);
  if (stateBuffer === binsBuffer) {
    throw new TypeError('Post-separation state and bins must not alias');
  }
  const receipt = Object.freeze({
    schema: ULG_POST_SEPARATION_THERMAL_BIN_AUTHORITY_SCHEMA,
    status: 'post-separation-thermal-bin-authority-live',
    authenticated: true,
    producerSubmissionObserved: true,
    positionAuthority: 'post-separation-g2p-output-state',
    deviceId: webGpuDeviceId(device),
    particleCount: exactParticleCount,
    capacity: exactCapacity,
    nx: exactNx,
    ny: exactNy,
    nz: exactNz,
    cellCount,
    cellSizeM: exactCellSizeM
  });
  const record = {
    receipt,
    device,
    stateBuffer,
    binsBuffer,
    particleCount: exactParticleCount,
    capacity: exactCapacity,
    nx: exactNx,
    ny: exactNy,
    nz: exactNz,
    cellCount,
    cellSizeM: exactCellSizeM,
    producerSubmission,
    active: true,
    releaseScheduled: false,
    releasePromise: null,
    destroyed: false,
    destroyCount: 0,
    deviceLost: false
  };
  authorityRecords.set(receipt, record);
  if (device.lost?.then) {
    Promise.resolve(device.lost).then(() => {
      record.deviceLost = true;
      destroyRecord(record);
    }).catch(() => {
      record.deviceLost = true;
      destroyRecord(record);
    });
  }
  return receipt;
}

export function resolvePostSeparationThermalBinAuthority(
  receipt,
  { device, stateBuffer, particleCount } = {}
) {
  const record = authorityRecords.get(receipt);
  if (
    !record
    || !Object.isFrozen(receipt)
    || receipt.schema !== ULG_POST_SEPARATION_THERMAL_BIN_AUTHORITY_SCHEMA
    || record.receipt !== receipt
    || record.device !== device
    || record.stateBuffer !== stateBuffer
    || record.particleCount !== particleCount
    || !record.active
    || record.releaseScheduled
    || record.destroyed
    || record.deviceLost
    || !webGpuBufferMatchesDevice(record.stateBuffer, device)
    || !webGpuBufferMatchesDevice(record.binsBuffer, device)
  ) {
    return null;
  }
  return Object.freeze({
    receipt,
    stateBuffer: record.stateBuffer,
    binsBuffer: record.binsBuffer,
    particleCount: record.particleCount,
    capacity: record.capacity,
    nx: record.nx,
    ny: record.ny,
    nz: record.nz,
    cellCount: record.cellCount,
    cellSizeM: record.cellSizeM,
    positionAuthority: receipt.positionAuthority
  });
}

export function isLivePostSeparationThermalBinAuthority(receipt) {
  const record = authorityRecords.get(receipt);
  return Boolean(
    record
    && record.receipt === receipt
    && record.active
    && !record.releaseScheduled
    && !record.destroyed
    && !record.deviceLost
  );
}

export function releasePostSeparationThermalBinAuthorityAfterQueue(
  receipt,
  { device, completionFence = null } = {}
) {
  const record = authorityRecords.get(receipt);
  if (!record || record.device !== device) {
    throw new TypeError(
      'Post-separation thermal bin release requires its exact authority device'
    );
  }
  if (record.releaseScheduled || record.destroyed) return false;
  const fence = completionFence
    ?? (typeof device.queue?.onSubmittedWorkDone === 'function'
      ? device.queue.onSubmittedWorkDone()
      : null);
  if (!fence?.then) {
    throw new TypeError(
      'Post-separation thermal bin release requires a queue completion fence'
    );
  }
  record.releaseScheduled = true;
  record.active = false;
  record.releasePromise = Promise.resolve(fence).then(
    () => destroyRecord(record),
    () => destroyRecord(record)
  );
  return true;
}

export function abandonPostSeparationThermalBinAuthority(receipt, { device } = {}) {
  const record = authorityRecords.get(receipt);
  if (!record || record.device !== device) return false;
  record.releaseScheduled = true;
  return destroyRecord(record);
}

export function postSeparationThermalBinAuthorityLiveness(receipt) {
  const record = authorityRecords.get(receipt);
  if (!record) return null;
  return Object.freeze({
    active: record.active,
    releaseScheduled: record.releaseScheduled,
    destroyed: record.destroyed,
    destroyCount: record.destroyCount,
    deviceLost: record.deviceLost,
    releasePromise: record.releasePromise
  });
}
