import {
  tagWebGpuBufferDevice,
  webGpuBufferMatchesDevice,
  webGpuDeviceId
} from './sphGpuDeviceIdentity.js';

export const ULG_SPH_RESIDENT_PRODUCT_EVENT_COUNT_AUTHORITY_SCHEMA =
  'peercompute.ulg.sph-resident-product-event-count-authority.v1';

export const SPH_RESIDENT_PRODUCT_EVENT_COUNT_CONTROL_MAGIC = 0x50484731;
export const SPH_RESIDENT_PRODUCT_EVENT_COUNT_CONTROL_VERSION = 1;
export const SPH_RESIDENT_PRODUCT_EVENT_COUNT_CONTROL_STATUS_READY = 1;
export const SPH_RESIDENT_PRODUCT_EVENT_COUNT_CONTROL_STATUS_FAILED =
  0x80000000;
export const SPH_RESIDENT_PRODUCT_EVENT_COUNT_CONTROL_PREFIX_WORDS = 8;
export const SPH_RESIDENT_PRODUCT_EVENT_COUNT_CONTROL_PREFIX_BYTES =
  SPH_RESIDENT_PRODUCT_EVENT_COUNT_CONTROL_PREFIX_WORDS
  * Uint32Array.BYTES_PER_ELEMENT;
export const SPH_RESIDENT_PRODUCT_EVENT_COUNT_CONTROL_RECORD_BYTES = 256;
export const SPH_RESIDENT_PRODUCT_EVENT_COUNT_CONTROL_WORDS =
  SPH_RESIDENT_PRODUCT_EVENT_COUNT_CONTROL_RECORD_BYTES
  / Uint32Array.BYTES_PER_ELEMENT;
export const SPH_RESIDENT_PRODUCT_EVENT_COUNT_CONTROL_OFFSETS = Object.freeze({
  MAGIC: 0,
  VERSION: 1,
  STATUS: 2,
  LIVE_ROW_COUNT: 3,
  ROW_CAPACITY: 4,
  ROW_STRIDE_VEC4: 5,
  GENERATION: 6,
  SEAL: 7,
  INDIRECT_X: 8,
  INDIRECT_Y: 9,
  INDIRECT_Z: 10,
  ERROR: 11
});

const residentProductEventCountAuthorities = new WeakMap();
const residentProductEventCountCopyDescriptors = new WeakMap();

function exactU32(value, label, { positive = false } = {}) {
  if (
    !Number.isSafeInteger(value)
    || value < (positive ? 1 : 0)
    || value > 0xffffffff
  ) {
    throw new RangeError(
      `${label} must be an exact ${positive ? 'positive ' : ''}u32`
    );
  }
  return value;
}

export function createResidentProductEventCountControlWords({
  status = SPH_RESIDENT_PRODUCT_EVENT_COUNT_CONTROL_STATUS_READY,
  liveRowCount = 0,
  rowCapacity,
  rowStrideVec4,
  generation,
  seal,
  error = 0
} = {}) {
  const words = new Uint32Array(
    SPH_RESIDENT_PRODUCT_EVENT_COUNT_CONTROL_WORDS
  );
  words[SPH_RESIDENT_PRODUCT_EVENT_COUNT_CONTROL_OFFSETS.MAGIC] =
    SPH_RESIDENT_PRODUCT_EVENT_COUNT_CONTROL_MAGIC;
  words[SPH_RESIDENT_PRODUCT_EVENT_COUNT_CONTROL_OFFSETS.VERSION] =
    SPH_RESIDENT_PRODUCT_EVENT_COUNT_CONTROL_VERSION;
  words[SPH_RESIDENT_PRODUCT_EVENT_COUNT_CONTROL_OFFSETS.STATUS] =
    exactU32(status, 'product-event count-control status');
  words[SPH_RESIDENT_PRODUCT_EVENT_COUNT_CONTROL_OFFSETS.LIVE_ROW_COUNT] =
    exactU32(liveRowCount, 'product-event live row count');
  words[SPH_RESIDENT_PRODUCT_EVENT_COUNT_CONTROL_OFFSETS.ROW_CAPACITY] =
    exactU32(rowCapacity, 'product-event row capacity', { positive: true });
  words[SPH_RESIDENT_PRODUCT_EVENT_COUNT_CONTROL_OFFSETS.ROW_STRIDE_VEC4] =
    exactU32(rowStrideVec4, 'product-event row vec4 stride', {
      positive: true
    });
  words[SPH_RESIDENT_PRODUCT_EVENT_COUNT_CONTROL_OFFSETS.GENERATION] =
    exactU32(generation, 'product-event count-control generation', {
      positive: true
    });
  words[SPH_RESIDENT_PRODUCT_EVENT_COUNT_CONTROL_OFFSETS.SEAL] =
    exactU32(seal, 'product-event count-control seal', { positive: true });
  words[SPH_RESIDENT_PRODUCT_EVENT_COUNT_CONTROL_OFFSETS.INDIRECT_X] =
    Math.ceil(liveRowCount / 64);
  words[SPH_RESIDENT_PRODUCT_EVENT_COUNT_CONTROL_OFFSETS.INDIRECT_Y] = 1;
  words[SPH_RESIDENT_PRODUCT_EVENT_COUNT_CONTROL_OFFSETS.INDIRECT_Z] = 1;
  words[SPH_RESIDENT_PRODUCT_EVENT_COUNT_CONTROL_OFFSETS.ERROR] =
    exactU32(error, 'product-event count-control error');
  return words;
}

export function registerResidentProductEventCountAuthority(handle, {
  device,
  controlBuffer,
  controlOffsetBytes,
  rowCapacity,
  rowStrideFloats,
  generation,
  seal,
  zeroTailSealed = true
} = {}) {
  if (!handle || typeof handle !== 'object') {
    throw new TypeError(
      'resident product-event count authority requires one handle'
    );
  }
  if (!device || !controlBuffer) {
    throw new TypeError(
      'resident product-event count authority requires a device and control buffer'
    );
  }
  const offsetBytes = exactU32(
    controlOffsetBytes,
    'product-event count-control byte offset'
  );
  if (
    offsetBytes % SPH_RESIDENT_PRODUCT_EVENT_COUNT_CONTROL_RECORD_BYTES !== 0
  ) {
    throw new RangeError(
      'product-event count-control offset must select one aligned record'
    );
  }
  const capacity = exactU32(
    rowCapacity,
    'product-event count-control row capacity',
    { positive: true }
  );
  const strideFloats = exactU32(
    rowStrideFloats,
    'product-event count-control row float stride',
    { positive: true }
  );
  if (strideFloats % 4 !== 0) {
    throw new RangeError(
      'product-event count-control row stride must be vec4 aligned'
    );
  }
  const resolvedGeneration = exactU32(
    generation,
    'product-event count-control generation',
    { positive: true }
  );
  const resolvedSeal = exactU32(
    seal,
    'product-event count-control seal',
    { positive: true }
  );
  if (
    Number(controlBuffer.size) <
    offsetBytes + SPH_RESIDENT_PRODUCT_EVENT_COUNT_CONTROL_RECORD_BYTES
  ) {
    throw new RangeError(
      'product-event count-control buffer does not cover its selected record'
    );
  }
  tagWebGpuBufferDevice(controlBuffer, device);
  const authority = Object.freeze({
    schema: ULG_SPH_RESIDENT_PRODUCT_EVENT_COUNT_AUTHORITY_SCHEMA,
    status: 'gpu-conditioned-publication-commit-pending',
    deviceId: webGpuDeviceId(device),
    controlBuffer,
    controlOffsetBytes: offsetBytes,
    controlPrefixByteLength:
      SPH_RESIDENT_PRODUCT_EVENT_COUNT_CONTROL_PREFIX_BYTES,
    expectedMagic: SPH_RESIDENT_PRODUCT_EVENT_COUNT_CONTROL_MAGIC,
    expectedVersion: SPH_RESIDENT_PRODUCT_EVENT_COUNT_CONTROL_VERSION,
    expectedReadyStatus:
      SPH_RESIDENT_PRODUCT_EVENT_COUNT_CONTROL_STATUS_READY,
    expectedFailedStatus:
      SPH_RESIDENT_PRODUCT_EVENT_COUNT_CONTROL_STATUS_FAILED,
    expectedGeneration: resolvedGeneration,
    expectedSeal: resolvedSeal,
    expectedRowCapacity: capacity,
    expectedRowStrideVec4: strideFloats / 4,
    hostObserved: false,
    liveRowCountOffsetBytes:
      offsetBytes
      + SPH_RESIDENT_PRODUCT_EVENT_COUNT_CONTROL_OFFSETS.LIVE_ROW_COUNT
        * Uint32Array.BYTES_PER_ELEMENT,
    indirectOffsetBytes:
      offsetBytes
      + SPH_RESIDENT_PRODUCT_EVENT_COUNT_CONTROL_OFFSETS.INDIRECT_X
        * Uint32Array.BYTES_PER_ELEMENT,
    rowCapacity: capacity,
    rowStrideFloats: strideFloats,
    rowStrideVec4: strideFloats / 4,
    generation: resolvedGeneration,
    seal: resolvedSeal,
    zeroTailSealed: zeroTailSealed === true,
    liveRowCountHostKnown: false,
    liveRowCountHostObserved: false
  });
  const record = Object.freeze({
    handle,
    device,
    productEventBuffer: handle.productEventBuffer,
    authority,
    state: { revoked: false }
  });
  residentProductEventCountAuthorities.set(handle, record);
  handle.productEventLiveCountAuthority = authority;
  handle.productEventRowCountAuthority =
    'gpu-authored-filtered-live-prefix';
  handle.productEventRowCountHostKnown = false;
  handle.productEventRowCapacity = capacity;
  return authority;
}

export function resolveResidentProductEventCountAuthority(
  handle,
  device = null
) {
  const record = residentProductEventCountAuthorities.get(handle);
  const authority = record?.authority;
  if (
    !record
    || record.state.revoked
    || record.handle !== handle
    || handle?.productEventLiveCountAuthority !== authority
    || handle?.productEventBuffer !== record.productEventBuffer
    || authority?.schema
      !== ULG_SPH_RESIDENT_PRODUCT_EVENT_COUNT_AUTHORITY_SCHEMA
    || authority.zeroTailSealed !== true
    || (device != null && record.device !== device)
    || !webGpuBufferMatchesDevice(authority.controlBuffer, record.device)
  ) {
    return null;
  }
  return authority;
}

export function revokeResidentProductEventCountAuthority(handle) {
  const record = residentProductEventCountAuthorities.get(handle);
  if (!record || record.handle !== handle || record.state.revoked) {
    return false;
  }
  record.state.revoked = true;
  if (handle?.productEventLiveCountAuthority === record.authority) {
    handle.productEventRowCountAuthority =
      'gpu-authored-filtered-live-prefix-revoked';
    handle.productEventRowCountHostKnown = false;
  }
  return true;
}

export function residentProductEventCountAuthorityRegistered(handle) {
  return Boolean(
    handle
    && typeof handle === 'object'
    && residentProductEventCountAuthorities.has(handle)
  );
}

export function productEventLiveCountCopyDescriptor(
  handle,
  device,
  {
    requireProductEventBuffer = true
  } = {}
) {
  const authority = resolveResidentProductEventCountAuthority(handle, device);
  if (
    !authority
    || (
      requireProductEventBuffer
      && !webGpuBufferMatchesDevice(handle?.productEventBuffer, device)
    )
  ) {
    return null;
  }
  const descriptor = Object.freeze({
    authority,
    controlBuffer: authority.controlBuffer,
    buffer: authority.controlBuffer,
    liveRowCountOffsetBytes: authority.liveRowCountOffsetBytes,
    indirectOffsetBytes: authority.indirectOffsetBytes,
    controlOffsetBytes: authority.controlOffsetBytes,
    controlPrefixByteLength: authority.controlPrefixByteLength,
    expectedMagic: authority.expectedMagic,
    expectedVersion: authority.expectedVersion,
    expectedReadyStatus: authority.expectedReadyStatus,
    expectedFailedStatus: authority.expectedFailedStatus,
    expectedGeneration: authority.expectedGeneration,
    expectedSeal: authority.expectedSeal,
    expectedRowCapacity: authority.expectedRowCapacity,
    expectedRowStrideVec4: authority.expectedRowStrideVec4,
    hostObserved: false,
    generation: authority.generation,
    seal: authority.seal,
    rowCapacity: authority.rowCapacity,
    rowStrideFloats: authority.rowStrideFloats
  });
  residentProductEventCountCopyDescriptors.set(descriptor, Object.freeze({
    handle,
    device,
    authority,
    productEventBuffer: handle.productEventBuffer
  }));
  return descriptor;
}

export function validateProductEventLiveCountCopyDescriptor(
  descriptor,
  {
    handle = null,
    device = null
  } = {}
) {
  const record = residentProductEventCountCopyDescriptors.get(descriptor);
  if (
    !record
    || !Object.isFrozen(descriptor)
    || (handle != null && record.handle !== handle)
    || (device != null && record.device !== device)
    || record.handle?.productEventBuffer !== record.productEventBuffer
    || resolveResidentProductEventCountAuthority(
      record.handle,
      record.device
    ) !== record.authority
  ) {
    return false;
  }
  const authority = record.authority;
  return Boolean(
    descriptor.authority === authority
    && descriptor.controlBuffer === authority.controlBuffer
    && descriptor.buffer === authority.controlBuffer
    && descriptor.controlOffsetBytes === authority.controlOffsetBytes
    && descriptor.controlPrefixByteLength
      === SPH_RESIDENT_PRODUCT_EVENT_COUNT_CONTROL_PREFIX_BYTES
    && descriptor.expectedMagic
      === SPH_RESIDENT_PRODUCT_EVENT_COUNT_CONTROL_MAGIC
    && descriptor.expectedVersion
      === SPH_RESIDENT_PRODUCT_EVENT_COUNT_CONTROL_VERSION
    && descriptor.expectedReadyStatus
      === SPH_RESIDENT_PRODUCT_EVENT_COUNT_CONTROL_STATUS_READY
    && descriptor.expectedFailedStatus
      === SPH_RESIDENT_PRODUCT_EVENT_COUNT_CONTROL_STATUS_FAILED
    && descriptor.expectedGeneration === authority.generation
    && descriptor.expectedSeal === authority.seal
    && descriptor.expectedRowCapacity === authority.rowCapacity
    && descriptor.expectedRowStrideVec4 === authority.rowStrideVec4
    && descriptor.hostObserved === false
    && descriptor.generation === authority.generation
    && descriptor.seal === authority.seal
    && descriptor.rowCapacity === authority.rowCapacity
    && descriptor.rowStrideFloats === authority.rowStrideFloats
  );
}
