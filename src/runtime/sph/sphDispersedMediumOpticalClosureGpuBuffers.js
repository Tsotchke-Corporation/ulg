import {
  SPH_DISPERSED_MEDIUM_OPTICAL_CLOSURE_ROW_BYTES,
  SPH_DISPERSED_MEDIUM_OPTICAL_CLOSURE_ROW_FLOATS,
  SPH_DISPERSED_MEDIUM_OPTICAL_CLOSURE_ROW_LAYOUT,
  ULG_SPH_DISPERSED_MEDIUM_OPTICAL_CLOSURE_PROPERTY_SCHEMA,
  ULG_SPH_DISPERSED_MEDIUM_OPTICAL_CLOSURE_TABLE_SCHEMA
} from '../../../ulg-gpu-abi/src/index.js';
import {
  validateSphDispersedMediumOpticalClosureTable
} from './sphDispersedMediumOpticalClosure.js';
import {
  tagWebGpuBufferDevice,
  typedArrayContentFingerprint,
  webGpuBufferDevice,
  webGpuDeviceId
} from './sphGpuDeviceIdentity.js';

export const ULG_SPH_DISPERSED_MEDIUM_OPTICAL_CLOSURE_GPU_TABLE_SCHEMA =
  'peercompute.ulg.sph-dispersed-medium-optical-closure-gpu-table.v0';
export const ULG_SPH_DISPERSED_MEDIUM_OPTICAL_CLOSURE_GPU_AUTHORITY_SCHEMA =
  'peercompute.ulg.sph-dispersed-medium-optical-closure-gpu-authority.v0';

const GPU_BUFFER_USAGE = Object.freeze({
  STORAGE: globalThis.GPUBufferUsage?.STORAGE ?? 128
});

const descriptorRecords = new WeakMap();
const authorityRecords = new WeakMap();
const bufferRecords = new WeakMap();

function exactObjectReference(value) {
  return Boolean(
    value !== null
    && (typeof value === 'object' || typeof value === 'function')
  );
}

function immutableValueSnapshot(value, seen = new WeakSet()) {
  if (
    value == null
    || typeof value === 'string'
    || typeof value === 'number'
    || typeof value === 'boolean'
  ) return value;
  if (typeof value !== 'object') {
    throw new TypeError(
      'dispersed-medium closure metadata must contain immutable data values'
    );
  }
  if (seen.has(value)) {
    throw new TypeError(
      'dispersed-medium closure metadata must not contain cycles'
    );
  }
  seen.add(value);
  const snapshot = Array.isArray(value)
    ? value.map((entry) => immutableValueSnapshot(entry, seen))
    : Object.fromEntries(Object.keys(value).sort().map((key) => [
        key,
        immutableValueSnapshot(value[key], seen)
      ]));
  seen.delete(value);
  return Object.freeze(snapshot);
}

function immutableMetadataSnapshot(metadata) {
  return Object.freeze(metadata.map((entry) => Object.freeze({
    rowIndex: entry.rowIndex,
    sourceIndex: entry.sourceIndex,
    lookupKey: entry.lookupKey,
    routeKey: entry.routeKey,
    routeId: entry.routeId,
    routeIdentityKind: entry.routeIdentityKind,
    routeSchema: entry.routeSchema,
    material: immutableValueSnapshot(entry.material),
    vaporPhase: immutableValueSnapshot(entry.vaporPhase),
    condensedPhase: immutableValueSnapshot(entry.condensedPhase),
    closureIdentityKey: entry.closureIdentityKey,
    dispersedMaterialId: entry.dispersedMaterialId,
    vaporPhaseId: entry.vaporPhaseId,
    condensedPhaseId: entry.condensedPhaseId,
    opticalStateId: entry.opticalStateId,
    morphologyModelId: entry.morphologyModelId,
    morphologyModel: entry.morphologyModel,
    status: entry.status,
    statusReason: entry.statusReason,
    provenance: immutableValueSnapshot(entry.provenance),
    scientificValidation: false
  })));
}

/**
 * Take a defensive, canonical host snapshot of one validated closure table.
 * The source Float32Array is deliberately not retained because Object.freeze
 * cannot make typed-array elements immutable.
 */
export function snapshotSphDispersedMediumOpticalClosureTable(table) {
  validateSphDispersedMediumOpticalClosureTable(table);
  const snapshot = Object.freeze({
    schema: ULG_SPH_DISPERSED_MEDIUM_OPTICAL_CLOSURE_TABLE_SCHEMA,
    propertySchema:
      ULG_SPH_DISPERSED_MEDIUM_OPTICAL_CLOSURE_PROPERTY_SCHEMA,
    version: table.version,
    status: table.status,
    rowCount: table.rowCount,
    routeCount: table.routeCount,
    readyRowCount: table.readyRowCount,
    blockedRowCount: table.blockedRowCount,
    readyOpticalStateIds: Object.freeze([
      ...table.readyOpticalStateIds
    ]),
    rowStrideFloats:
      SPH_DISPERSED_MEDIUM_OPTICAL_CLOSURE_ROW_FLOATS,
    rowStrideBytes:
      SPH_DISPERSED_MEDIUM_OPTICAL_CLOSURE_ROW_BYTES,
    rowLayout: SPH_DISPERSED_MEDIUM_OPTICAL_CLOSURE_ROW_LAYOUT,
    bufferByteLength: table.bufferByteLength,
    rows: table.rows.slice(),
    metadata: immutableMetadataSnapshot(table.metadata),
    routeLookup:
      'exact-dispersed-material-vapor-phase-condensed-phase-linear-scan',
    massAuthority: 'already-conserved-dispersed-condensed-mass',
    saturationMassInference: false,
    scientificValidation: false
  });
  // Validate the copy, not merely the mutable source that preceded it.
  validateSphDispersedMediumOpticalClosureTable(snapshot);
  return snapshot;
}

function exactRowsMatch(left, right) {
  if (
    !(left instanceof Float32Array)
    || !(right instanceof Float32Array)
    || left.length !== right.length
  ) return false;
  const leftBits = new Uint32Array(
    left.buffer,
    left.byteOffset,
    left.length
  );
  const rightBits = new Uint32Array(
    right.buffer,
    right.byteOffset,
    right.length
  );
  for (let index = 0; index < leftBits.length; index += 1) {
    if (leftBits[index] !== rightBits[index]) return false;
  }
  return true;
}

function exactTableContentMatches(snapshot, table) {
  try {
    const candidate = snapshotSphDispersedMediumOpticalClosureTable(table);
    return Boolean(
      candidate.version === snapshot.version
      && candidate.status === snapshot.status
      && candidate.rowCount === snapshot.rowCount
      && candidate.routeCount === snapshot.routeCount
      && candidate.readyRowCount === snapshot.readyRowCount
      && candidate.blockedRowCount === snapshot.blockedRowCount
      && candidate.rowStrideFloats === snapshot.rowStrideFloats
      && candidate.rowStrideBytes === snapshot.rowStrideBytes
      && candidate.bufferByteLength === snapshot.bufferByteLength
      && candidate.readyOpticalStateIds.length
        === snapshot.readyOpticalStateIds.length
      && candidate.readyOpticalStateIds.every(
        (value, index) => value === snapshot.readyOpticalStateIds[index]
      )
      && exactRowsMatch(candidate.rows, snapshot.rows)
    );
  } catch {
    return false;
  }
}

function exactDescriptorMatchesRecord(record, descriptor) {
  return Boolean(
    record
    && descriptor === record.descriptor
    && descriptor.schema
      === ULG_SPH_DISPERSED_MEDIUM_OPTICAL_CLOSURE_GPU_TABLE_SCHEMA
    && descriptor.status === 'webgpu-uploaded'
    && descriptor.sourceSchema
      === ULG_SPH_DISPERSED_MEDIUM_OPTICAL_CLOSURE_TABLE_SCHEMA
    && descriptor.buffer === record.buffer
    && descriptor.authority === record.authority
    && descriptor.rowCount === record.table.rowCount
    && descriptor.routeCount === record.table.routeCount
    && descriptor.readyRowCount === record.table.readyRowCount
    && descriptor.blockedRowCount === record.table.blockedRowCount
    && descriptor.rowStrideFloats === record.table.rowStrideFloats
    && descriptor.rowStrideBytes === record.table.rowStrideBytes
    && descriptor.bufferByteLength === record.table.bufferByteLength
    && descriptor.contentFingerprint === record.contentFingerprint
    && descriptor.ownsBuffer === true
    && descriptor.destroyed !== true
  );
}

function destroyRecordNow(record) {
  if (!record || record.destroyed) return false;
  record.active = false;
  record.destroyed = true;
  record.destroyRequested = false;
  if (record.ownsBuffer) record.buffer.destroy?.();
  try { record.descriptor.destroyPending = false; } catch {}
  try { record.descriptor.destroyed = true; } catch {}
  return true;
}

/** Upload and privately authenticate one immutable closure-table generation. */
export function uploadSphDispersedMediumOpticalClosureGpuTable(
  device,
  table,
  { label = 'ulg-sph-dispersed-medium-optical-closure' } = {}
) {
  if (!device?.createBuffer) {
    throw new TypeError(
      'dispersed-medium closure upload requires a WebGPU-like device'
    );
  }
  const privateTable = snapshotSphDispersedMediumOpticalClosureTable(table);
  if (privateTable.rowCount <= 0 || privateTable.bufferByteLength <= 0) {
    throw new RangeError(
      'dispersed-medium closure upload requires at least one closure row'
    );
  }
  let rawBuffer = null;
  let record = null;
  try {
    rawBuffer = device.createBuffer({
      label,
      size: privateTable.bufferByteLength,
      usage: GPU_BUFFER_USAGE.STORAGE,
      mappedAtCreation: true
    });
    if (
      typeof rawBuffer?.getMappedRange !== 'function'
      || typeof rawBuffer?.unmap !== 'function'
    ) {
      throw new TypeError(
        'dispersed-medium closure upload requires mapped-at-creation initialization'
      );
    }
    const mapped = rawBuffer.getMappedRange(
      0,
      privateTable.bufferByteLength
    );
    if (
      !(mapped instanceof ArrayBuffer)
      || mapped.byteLength !== privateTable.bufferByteLength
    ) {
      throw new TypeError(
        'dispersed-medium closure mapped range must cover the exact table'
      );
    }
    new Uint8Array(mapped, 0, privateTable.bufferByteLength).set(
      new Uint8Array(
        privateTable.rows.buffer,
        privateTable.rows.byteOffset,
        privateTable.rows.byteLength
      )
    );
    rawBuffer.unmap();
    const buffer = tagWebGpuBufferDevice(rawBuffer, device);
    if (
      webGpuBufferDevice(buffer) !== device
      || Number(buffer.size) !== privateTable.bufferByteLength
      || !Number.isInteger(Number(buffer.usage))
      || (Number(buffer.usage) & GPU_BUFFER_USAGE.STORAGE) === 0
      || bufferRecords.has(buffer)
    ) {
      throw new TypeError(
        'dispersed-medium closure upload requires one fresh exact same-device storage allocation'
      );
    }
    const contentFingerprint = typedArrayContentFingerprint(privateTable.rows);
    const authority = Object.freeze({
      schema:
        ULG_SPH_DISPERSED_MEDIUM_OPTICAL_CLOSURE_GPU_AUTHORITY_SCHEMA,
      status: 'sph-dispersed-medium-optical-closure-gpu-authority-ready',
      deviceId: webGpuDeviceId(device),
      rowCount: privateTable.rowCount,
      routeCount: privateTable.routeCount,
      readyRowCount: privateTable.readyRowCount,
      blockedRowCount: privateTable.blockedRowCount,
      rowStrideFloats: privateTable.rowStrideFloats,
      rowStrideBytes: privateTable.rowStrideBytes,
      bufferByteLength: privateTable.bufferByteLength,
      contentFingerprint
    });
    const descriptor = {
      schema: ULG_SPH_DISPERSED_MEDIUM_OPTICAL_CLOSURE_GPU_TABLE_SCHEMA,
      status: 'webgpu-uploaded',
      sourceSchema: privateTable.schema,
      rowCount: privateTable.rowCount,
      routeCount: privateTable.routeCount,
      readyRowCount: privateTable.readyRowCount,
      blockedRowCount: privateTable.blockedRowCount,
      rowStrideFloats: privateTable.rowStrideFloats,
      rowStrideBytes: privateTable.rowStrideBytes,
      bufferByteLength: privateTable.bufferByteLength,
      contentFingerprint,
      buffer,
      authority,
      ownsBuffer: true,
      destroyPending: false,
      destroyed: false
    };
    record = {
      descriptor,
      authority,
      device,
      buffer,
      table: privateTable,
      contentFingerprint,
      ownsBuffer: true,
      active: true,
      destroyed: false,
      destroyRequested: false,
      activeBorrowCount: 0,
      deviceLost: false
    };
    descriptorRecords.set(descriptor, record);
    authorityRecords.set(authority, record);
    bufferRecords.set(buffer, record);
    if (device.lost?.then) {
      Promise.resolve(device.lost).then(() => {
        record.deviceLost = true;
        destroyRecordNow(record);
      }).catch(() => {
        record.deviceLost = true;
        destroyRecordNow(record);
      });
    }
    return descriptor;
  } catch (error) {
    if (record) {
      descriptorRecords.delete(record.descriptor);
      authorityRecords.delete(record.authority);
      bufferRecords.delete(record.buffer);
      record.active = false;
      record.destroyed = true;
      record.destroyRequested = false;
      record.ownsBuffer = false;
    }
    try { rawBuffer?.destroy?.(); } catch {}
    throw error;
  }
}

export function validateSphDispersedMediumOpticalClosureGpuTableAuthority(
  device,
  descriptor,
  { table = null } = {}
) {
  const record = descriptorRecords.get(descriptor);
  return Boolean(
    record
    && record.descriptor === descriptor
    && record.authority === descriptor.authority
    && authorityRecords.get(descriptor.authority) === record
    && bufferRecords.get(descriptor.buffer) === record
    && Object.isFrozen(descriptor.authority)
    && descriptor.authority.schema
      === ULG_SPH_DISPERSED_MEDIUM_OPTICAL_CLOSURE_GPU_AUTHORITY_SCHEMA
    && descriptor.authority.status
      === 'sph-dispersed-medium-optical-closure-gpu-authority-ready'
    && record.device === device
    && webGpuBufferDevice(record.buffer) === device
    && exactDescriptorMatchesRecord(record, descriptor)
    && (table == null || exactTableContentMatches(record.table, table))
    // Caller-controlled descriptor/table getters have all run. Recheck only
    // private state last so reentrant teardown cannot validate a dead buffer.
    && record.active
    && !record.destroyed
    && !record.destroyRequested
    && !record.deviceLost
  );
}

/**
 * Resolve an authenticated table and allocation from their private record.
 * Consumers must bind this buffer, never a later public descriptor read.
 */
export function resolveSphDispersedMediumOpticalClosureGpuTable(
  descriptor,
  { device, table = null } = {}
) {
  const record = descriptorRecords.get(descriptor);
  if (
    !record
    || !validateSphDispersedMediumOpticalClosureGpuTableAuthority(
      device,
      descriptor,
      { table }
    )
    || !record.active
    || record.destroyed
    || record.destroyRequested
    || record.deviceLost
    || webGpuBufferDevice(record.buffer) !== device
  ) {
    throw new TypeError(
      'dispersed-medium closure resolution requires one exact live GPU table authority'
    );
  }
  return Object.freeze({
    buffer: record.buffer,
    table: snapshotSphDispersedMediumOpticalClosureTable(record.table)
  });
}

/** Resolve a defensive host snapshot only through exact private GPU authority. */
export function snapshotSphDispersedMediumOpticalClosureGpuTable(
  descriptor,
  { device, table = null } = {}
) {
  return resolveSphDispersedMediumOpticalClosureGpuTable(
    descriptor,
    { device, table }
  ).table;
}

/** Pin an authenticated static table until the encoded submission has drained. */
export function beginSphDispersedMediumOpticalClosureGpuTableBorrow(
  device,
  descriptor,
  { table = null } = {}
) {
  const record = descriptorRecords.get(descriptor);
  if (
    !record
    || record.destroyRequested
    || !validateSphDispersedMediumOpticalClosureGpuTableAuthority(
      device,
      descriptor,
      { table }
    )
    || !record.active
    || record.destroyed
    || record.destroyRequested
    || record.deviceLost
  ) {
    throw new TypeError(
      'dispersed-medium closure borrow requires one live exact GPU table'
    );
  }
  record.activeBorrowCount += 1;
  let released = false;
  return () => {
    if (released) return false;
    released = true;
    record.activeBorrowCount = Math.max(0, record.activeBorrowCount - 1);
    if (record.activeBorrowCount === 0 && record.destroyRequested) {
      destroyRecordNow(record);
    }
    return true;
  };
}

export function destroySphDispersedMediumOpticalClosureGpuTable(descriptor) {
  const record = descriptorRecords.get(descriptor);
  if (!record || record.descriptor !== descriptor || record.destroyed) {
    return false;
  }
  if (record.destroyRequested) return false;
  if (record.activeBorrowCount > 0) {
    record.destroyRequested = true;
    try { descriptor.destroyPending = true; } catch {}
    return true;
  }
  return destroyRecordNow(record);
}
