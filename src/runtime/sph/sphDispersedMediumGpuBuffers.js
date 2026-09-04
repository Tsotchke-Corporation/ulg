import {
  SPH_DISPERSED_MEDIUM_OPTICS_ROW_BYTES,
  SPH_DISPERSED_MEDIUM_OPTICS_ROW_FLOATS,
  SPH_DISPERSED_MEDIUM_OPTICS_ROW_LAYOUT,
  SPH_DISPERSED_MEDIUM_OPTICS_STATUS,
  ULG_SPH_DISPERSED_MEDIUM_OPTICS_AUTHORITY_SCHEMA,
  ULG_SPH_DISPERSED_MEDIUM_OPTICS_BUFFER_SET_SCHEMA,
  ULG_SPH_DISPERSED_MEDIUM_OPTICS_SCHEMA
} from '../../../ulg-gpu-abi/src/index.js';
import {
  tagWebGpuBufferDevice,
  webGpuBufferDevice,
  webGpuDeviceId
} from './sphGpuDeviceIdentity.js';

const GPU_BUFFER_USAGE = {
  STORAGE: globalThis.GPUBufferUsage?.STORAGE ?? 128
};
const EXACT_F32_INTEGER_MAX = 0x00ff_ffff;
const authorityRecords = new WeakMap();
const uploadRecords = new WeakMap();

function canonicalParticleLineage(lineage, particleCount) {
  if (lineage == null) return null;
  const lineageParticleCount = lineage.particleCount;
  const topologyEpoch = lineage.topologyEpoch;
  const identityRevision = typeof lineage.identityRevision === 'string'
    ? lineage.identityRevision
    : '';
  const identityBuffer = lineage.identityBuffer ?? null;
  if (
    !Number.isSafeInteger(lineageParticleCount)
    || lineageParticleCount <= 0
    || lineageParticleCount !== particleCount
    || !Number.isSafeInteger(topologyEpoch)
    || topologyEpoch < 0
    || topologyEpoch > 0xffff_ffff
    || identityRevision.length === 0
    || (
      (typeof identityBuffer !== 'object' && typeof identityBuffer !== 'function')
      || identityBuffer === null
    )
  ) {
    throw new TypeError(
      'dispersed-medium particle lineage requires exact count, topology epoch, identity revision, and identity buffer'
    );
  }
  return Object.freeze({
    particleCount: lineageParticleCount,
    topologyEpoch,
    identityRevision,
    identityBuffer
  });
}

function exactObjectReference(value) {
  return Boolean(
    value !== null
    && (typeof value === 'object' || typeof value === 'function')
  );
}

function canonicalParticleSourceFamily(
  sourceFamily,
  {
    particleCount,
    device,
    particleLineage
  }
) {
  if (sourceFamily == null) return null;
  const stateBuffer = sourceFamily.stateBuffer ?? null;
  const thermoBuffer = sourceFamily.thermoBuffer ?? null;
  const lineage = canonicalParticleLineage(sourceFamily, particleCount);
  if (
    !particleLineage
    || lineage.particleCount !== particleLineage.particleCount
    || lineage.topologyEpoch !== particleLineage.topologyEpoch
    || lineage.identityRevision !== particleLineage.identityRevision
    || lineage.identityBuffer !== particleLineage.identityBuffer
    || !exactObjectReference(stateBuffer)
    || !exactObjectReference(thermoBuffer)
    || webGpuBufferDevice(stateBuffer) !== device
    || webGpuBufferDevice(thermoBuffer) !== device
    || webGpuBufferDevice(lineage.identityBuffer) !== device
  ) {
    throw new TypeError(
      'dispersed-medium particle source family requires exact same-device state, thermo, identity, and lineage'
    );
  }
  return Object.freeze({
    particleCount: lineage.particleCount,
    topologyEpoch: lineage.topologyEpoch,
    identityRevision: lineage.identityRevision,
    stateBuffer,
    thermoBuffer,
    identityBuffer: lineage.identityBuffer,
    device
  });
}

function particleSourceFamilyEntry(record, sourceFamily) {
  const byThermo = record?.particleSourceFamilies?.get(
    sourceFamily?.stateBuffer
  );
  const byIdentity = byThermo?.get(sourceFamily?.thermoBuffer);
  return byIdentity?.get(sourceFamily?.identityBuffer) ?? null;
}

function particleSourceFamilyMatches(record, sourceFamily) {
  const entry = particleSourceFamilyEntry(record, sourceFamily);
  return Boolean(
    entry
    && entry.device === sourceFamily.device
    && entry.particleCount === sourceFamily.particleCount
    && entry.topologyEpoch === sourceFamily.topologyEpoch
    && entry.identityRevision === sourceFamily.identityRevision
    && entry.stateBuffer === sourceFamily.stateBuffer
    && entry.thermoBuffer === sourceFamily.thermoBuffer
    && entry.identityBuffer === sourceFamily.identityBuffer
  );
}

function registerParticleSourceFamily(record, sourceFamily) {
  let byThermo = record.particleSourceFamilies.get(sourceFamily.stateBuffer);
  if (!byThermo) {
    byThermo = new WeakMap();
    record.particleSourceFamilies.set(sourceFamily.stateBuffer, byThermo);
  }
  let byIdentity = byThermo.get(sourceFamily.thermoBuffer);
  if (!byIdentity) {
    byIdentity = new WeakMap();
    byThermo.set(sourceFamily.thermoBuffer, byIdentity);
  }
  const prior = byIdentity.get(sourceFamily.identityBuffer) ?? null;
  if (prior) {
    if (!particleSourceFamilyMatches(record, sourceFamily)) {
      throw new TypeError(
        'dispersed-medium particle source family conflicts with an existing exact buffer family'
      );
    }
    return Object.freeze({ inserted: false, rollback() { return true; } });
  }
  byIdentity.set(sourceFamily.identityBuffer, sourceFamily);
  let active = true;
  return Object.freeze({
    inserted: true,
    rollback() {
      if (!active) return false;
      active = false;
      if (byIdentity.get(sourceFamily.identityBuffer) === sourceFamily) {
        byIdentity.delete(sourceFamily.identityBuffer);
      }
      return true;
    }
  });
}

function nonnegativeIdentifier(value, label, { positive = false } = {}) {
  const number = Number(value);
  if (
    !Number.isSafeInteger(number)
    || number < (positive ? 1 : 0)
    || number > EXACT_F32_INTEGER_MAX
    || Math.fround(number) !== number
  ) {
    throw new RangeError(
      `${label} must be a ${positive ? 'positive' : 'non-negative'} integer exactly representable as f32`
    );
  }
  return number;
}

function finiteNonnegativeF32(value, label) {
  const number = Math.fround(Number(value));
  if (!Number.isFinite(number) || number < 0) {
    throw new RangeError(`${label} must be a finite non-negative f32`);
  }
  return number;
}

function finiteF32(value, label) {
  const number = Math.fround(Number(value));
  if (!Number.isFinite(number)) {
    throw new RangeError(`${label} must be a finite f32`);
  }
  return number;
}

function canonicalStatus(value, label) {
  const status = value == null
    ? SPH_DISPERSED_MEDIUM_OPTICS_STATUS.ready
    : Number(value);
  if (
    status !== SPH_DISPERSED_MEDIUM_OPTICS_STATUS.ready
    && status !== SPH_DISPERSED_MEDIUM_OPTICS_STATUS.blocked
  ) {
    throw new RangeError(
      `${label} must be ready (${SPH_DISPERSED_MEDIUM_OPTICS_STATUS.ready}) `
      + `or blocked (${SPH_DISPERSED_MEDIUM_OPTICS_STATUS.blocked})`
    );
  }
  return status;
}

function writeBlockedRow(rows, offset) {
  rows.fill(0, offset, offset + SPH_DISPERSED_MEDIUM_OPTICS_ROW_FLOATS);
  rows[offset + 3] = SPH_DISPERSED_MEDIUM_OPTICS_STATUS.blocked;
}

function writeReadyRow(rows, offset, optics, particleIndex) {
  const prefix = `particles[${particleIndex}].dispersedMediumOptics`;
  const status = canonicalStatus(optics.status, `${prefix}.status`);
  if (status === SPH_DISPERSED_MEDIUM_OPTICS_STATUS.blocked) {
    writeBlockedRow(rows, offset);
    return status;
  }
  const scatteringCrossSectionM2 = finiteNonnegativeF32(
    optics.scatteringCrossSectionM2,
    `${prefix}.scatteringCrossSectionM2`
  );
  const scatteringAsymmetryCrossSectionM2 = finiteF32(
    optics.scatteringAsymmetryCrossSectionM2,
    `${prefix}.scatteringAsymmetryCrossSectionM2`
  );
  if (
    Math.abs(scatteringAsymmetryCrossSectionM2)
    > scatteringCrossSectionM2
  ) {
    throw new RangeError(
      `${prefix}.scatteringAsymmetryCrossSectionM2 magnitude must not exceed `
      + `${prefix}.scatteringCrossSectionM2`
    );
  }
  rows.set([
    nonnegativeIdentifier(optics.dispersedMaterialId, `${prefix}.dispersedMaterialId`),
    nonnegativeIdentifier(optics.dispersedPhaseId, `${prefix}.dispersedPhaseId`),
    nonnegativeIdentifier(
      optics.opticalStateId,
      `${prefix}.opticalStateId`,
      { positive: true }
    ),
    status,
    finiteNonnegativeF32(optics.dispersedMassKg, `${prefix}.dispersedMassKg`),
    scatteringCrossSectionM2,
    finiteNonnegativeF32(
      optics.absorptionCrossSectionM2,
      `${prefix}.absorptionCrossSectionM2`
    ),
    scatteringAsymmetryCrossSectionM2
  ], offset);
  return status;
}

function validatePackedRows(packed) {
  if (packed?.schema !== ULG_SPH_DISPERSED_MEDIUM_OPTICS_SCHEMA) {
    throw new TypeError(
      'dispersed-medium upload requires a packed dispersed-medium optics sidecar'
    );
  }
  if (!(packed.rows instanceof Float32Array)) {
    throw new TypeError('dispersed-medium optics rows must be a Float32Array');
  }
  if (!Number.isSafeInteger(packed.rowCount) || packed.rowCount < 1) {
    throw new RangeError('dispersed-medium optics rowCount must be positive');
  }
  if (
    packed.particleCount !== packed.rowCount
    || packed.rowCapacity !== packed.rowCount
    || packed.rowStrideFloats !== SPH_DISPERSED_MEDIUM_OPTICS_ROW_FLOATS
    || packed.rowStrideBytes !== SPH_DISPERSED_MEDIUM_OPTICS_ROW_BYTES
    || packed.rows.length
      !== packed.rowCount * SPH_DISPERSED_MEDIUM_OPTICS_ROW_FLOATS
    || packed.bufferByteLength !== packed.rows.byteLength
  ) {
    throw new RangeError(
      'dispersed-medium optics rows must exactly fill the canonical particle-aligned layout'
    );
  }
  let readyRowCount = 0;
  let blockedRowCount = 0;
  const readyOpticalStateIds = new Set();
  for (let rowIndex = 0; rowIndex < packed.rowCount; rowIndex += 1) {
    const offset = rowIndex * SPH_DISPERSED_MEDIUM_OPTICS_ROW_FLOATS;
    const status = packed.rows[offset + 3];
    if (status === SPH_DISPERSED_MEDIUM_OPTICS_STATUS.blocked) {
      for (let lane = 0; lane < SPH_DISPERSED_MEDIUM_OPTICS_ROW_FLOATS; lane += 1) {
        if (lane !== 3 && packed.rows[offset + lane] !== 0) {
          throw new RangeError(
            `dispersed-medium blocked row ${rowIndex} must have zero data lanes`
          );
        }
      }
      blockedRowCount += 1;
      continue;
    }
    if (status !== SPH_DISPERSED_MEDIUM_OPTICS_STATUS.ready) {
      throw new RangeError(`dispersed-medium row ${rowIndex} has an invalid status`);
    }
    for (const lane of [0, 1, 2]) {
      nonnegativeIdentifier(
        packed.rows[offset + lane],
        `dispersed-medium row ${rowIndex} identifier lane ${lane}`,
        { positive: lane === 2 }
      );
    }
    readyOpticalStateIds.add(packed.rows[offset + 2]);
    const mass = packed.rows[offset + 4];
    const scattering = packed.rows[offset + 5];
    const absorption = packed.rows[offset + 6];
    const asymmetry = packed.rows[offset + 7];
    finiteNonnegativeF32(mass, `dispersed-medium row ${rowIndex} dispersed mass`);
    finiteNonnegativeF32(scattering, `dispersed-medium row ${rowIndex} scattering`);
    finiteNonnegativeF32(absorption, `dispersed-medium row ${rowIndex} absorption`);
    finiteF32(asymmetry, `dispersed-medium row ${rowIndex} scattering asymmetry`);
    if (Math.abs(asymmetry) > scattering) {
      throw new RangeError(
        `dispersed-medium row ${rowIndex} scattering asymmetry exceeds scattering`
      );
    }
    readyRowCount += 1;
  }
  if (
    packed.readyRowCount !== readyRowCount
    || packed.blockedRowCount !== blockedRowCount
    || readyRowCount + blockedRowCount !== packed.rowCount
  ) {
    throw new RangeError('dispersed-medium optics row status counts are inconsistent');
  }
  const canonicalReadyOpticalStateIds = [...readyOpticalStateIds]
    .sort((left, right) => left - right);
  if (
    !Array.isArray(packed.readyOpticalStateIds)
    || packed.readyOpticalStateIds.length
      !== canonicalReadyOpticalStateIds.length
    || packed.readyOpticalStateIds.some(
      (value, index) => value !== canonicalReadyOpticalStateIds[index]
    )
  ) {
    throw new RangeError(
      'dispersed-medium optics ready route identifiers are inconsistent'
    );
  }
}

/**
 * Build the optional dense particle-aligned optics sidecar. A simulation with
 * no advertised dispersedMediumOptics descriptors returns null and allocates
 * no row storage. Once present, omitted particle rows are canonical blocked
 * rows so GPU consumers never need a host-side index remap.
 */
export function buildSphDispersedMediumGpuBuffers(particles) {
  if (!Array.isArray(particles)) {
    throw new TypeError('buildSphDispersedMediumGpuBuffers requires a particles array');
  }
  if (
    particles.length === 0
    || !particles.some((particle) => particle?.dispersedMediumOptics != null)
  ) {
    return null;
  }
  const rows = new Float32Array(
    particles.length * SPH_DISPERSED_MEDIUM_OPTICS_ROW_FLOATS
  );
  let readyRowCount = 0;
  let blockedRowCount = 0;
  const readyOpticalStateIds = new Set();
  for (let particleIndex = 0; particleIndex < particles.length; particleIndex += 1) {
    const optics = particles[particleIndex]?.dispersedMediumOptics;
    const offset = particleIndex * SPH_DISPERSED_MEDIUM_OPTICS_ROW_FLOATS;
    if (optics == null) {
      writeBlockedRow(rows, offset);
      blockedRowCount += 1;
      continue;
    }
    if (typeof optics !== 'object' || Array.isArray(optics)) {
      throw new TypeError(
        `particles[${particleIndex}].dispersedMediumOptics must be an object`
      );
    }
    const status = writeReadyRow(rows, offset, optics, particleIndex);
    if (status === SPH_DISPERSED_MEDIUM_OPTICS_STATUS.ready) {
      readyRowCount += 1;
      readyOpticalStateIds.add(rows[offset + 2]);
    }
    else blockedRowCount += 1;
  }
  const canonicalReadyOpticalStateIds = Object.freeze(
    [...readyOpticalStateIds].sort((left, right) => left - right)
  );
  return Object.freeze({
    schema: ULG_SPH_DISPERSED_MEDIUM_OPTICS_SCHEMA,
    status: 'cpu-derived-dispersed-medium-optics-ready',
    particleCount: particles.length,
    rowCount: particles.length,
    rowCapacity: particles.length,
    readyRowCount,
    blockedRowCount,
    readyOpticalStateIds: canonicalReadyOpticalStateIds,
    readyOpticalStateRouteCount: canonicalReadyOpticalStateIds.length,
    rowLayout: SPH_DISPERSED_MEDIUM_OPTICS_ROW_LAYOUT,
    rowStrideFloats: SPH_DISPERSED_MEDIUM_OPTICS_ROW_FLOATS,
    rowStrideBytes: SPH_DISPERSED_MEDIUM_OPTICS_ROW_BYTES,
    bufferByteLength: rows.byteLength,
    rows,
    hostHotLoopReadback: false
  });
}

function retireUploadRecord(record) {
  if (!record || record.destroyed || record.destroyRequested) return false;
  if (record.activeBorrowCount > 0) {
    record.destroyRequested = true;
    record.upload.destroyPending = true;
    return true;
  }
  return destroyUploadRecordNow(record);
}

function destroyUploadRecordNow(record) {
  if (!record || record.destroyed) return false;
  record.active = false;
  record.destroyed = true;
  record.destroyRequested = false;
  // Ownership is construction-time authority. `upload` is intentionally a
  // plain descriptor because worker continuation code must be able to attach
  // it to successive particle families, but its public ownsBuffer diagnostic
  // must never be able to suppress retirement of the allocation represented
  // by this module-private record.
  if (record.ownsBuffer) record.buffer.destroy?.();
  record.upload.destroyPending = false;
  record.upload.destroyed = true;
  return true;
}

function exactUploadDescriptorMatchesRecord(
  record,
  upload,
  { requireParticleLineage = false } = {}
) {
  return Boolean(
    record
    && upload === record.upload
    && upload.schema === ULG_SPH_DISPERSED_MEDIUM_OPTICS_BUFFER_SET_SCHEMA
    && upload.status === 'webgpu-uploaded'
    && upload.sourceSchema === ULG_SPH_DISPERSED_MEDIUM_OPTICS_SCHEMA
    && upload.particleCount === record.particleCount
    && upload.rowCount === record.rowCount
    && upload.rowCapacity === record.rowCapacity
    && upload.readyRowCount === record.readyRowCount
    && upload.blockedRowCount === record.blockedRowCount
    && upload.readyOpticalStateIds === record.readyOpticalStateIds
    && upload.readyOpticalStateRouteCount === record.readyOpticalStateRouteCount
    && upload.rowStrideFloats === record.rowStrideFloats
    && upload.rowStrideBytes === record.rowStrideBytes
    && upload.bufferByteLength === record.bufferByteLength
    && upload.buffer === record.buffer
    && upload.authority === record.authority
    && upload.ownsBuffer === true
    && upload.destroyed !== true
    && (!requireParticleLineage || record.particleLineage != null)
  );
}

function exactParticleLineageMatches(record, expectedLineage) {
  if (!record?.particleLineage || expectedLineage == null) return false;
  let expected;
  try {
    expected = canonicalParticleLineage(expectedLineage, record.particleCount);
  } catch {
    return false;
  }
  return Boolean(
    record.particleLineage.particleCount === expected.particleCount
    && record.particleLineage.topologyEpoch === expected.topologyEpoch
    && record.particleLineage.identityRevision === expected.identityRevision
    && record.particleLineage.identityBuffer === expected.identityBuffer
  );
}

export function uploadSphDispersedMediumGpuBuffers(
  device,
  packed,
  {
    label = 'ulg-sph-dispersed-medium-optics',
    particleLineage = null,
    particleSourceFamily = null,
    particleSourceFamilyRegistrar = null
  } = {}
) {
  if (packed == null) return null;
  if (!device?.createBuffer) {
    throw new TypeError(
      'uploadSphDispersedMediumGpuBuffers requires a WebGPU-like device'
    );
  }
  validatePackedRows(packed);
  const boundParticleLineage = canonicalParticleLineage(
    particleLineage,
    packed.particleCount
  );
  const boundParticleSourceFamily = canonicalParticleSourceFamily(
    particleSourceFamily,
    {
      particleCount: packed.particleCount,
      device,
      particleLineage: boundParticleLineage
    }
  );
  if (
    boundParticleSourceFamily
    && !exactObjectReference(particleSourceFamilyRegistrar)
  ) {
    throw new TypeError(
      'dispersed-medium particle source family requires an opaque continuation registrar'
    );
  }
  let rawBuffer = null;
  try {
    rawBuffer = device.createBuffer({
      label,
      size: packed.bufferByteLength,
      usage: GPU_BUFFER_USAGE.STORAGE,
      mappedAtCreation: true
    });
    if (
      typeof rawBuffer?.getMappedRange !== 'function'
      || typeof rawBuffer?.unmap !== 'function'
    ) {
      throw new TypeError(
        'dispersed-medium upload requires mapped-at-creation buffer initialization'
      );
    }
    const mappedRange = rawBuffer.getMappedRange(0, packed.bufferByteLength);
    if (
      !(mappedRange instanceof ArrayBuffer)
      || mappedRange.byteLength < packed.bufferByteLength
    ) {
      throw new TypeError(
        'dispersed-medium mapped-at-creation range must cover the exact packed rows'
      );
    }
    new Uint8Array(mappedRange, 0, packed.bufferByteLength).set(
      new Uint8Array(
        packed.rows.buffer,
        packed.rows.byteOffset,
        packed.rows.byteLength
      )
    );
    rawBuffer.unmap();
    const buffer = tagWebGpuBufferDevice(rawBuffer, device);
    // The published buffer deliberately has no COPY_DST usage, so host code
    // cannot rewrite authenticated rows after publication with queue.writeBuffer.
    // STORAGE remains required for future same-device compute producers. Their
    // serialized dispatch/receipt chain is the trusted content boundary: this
    // allocation authority authenticates identity, layout, lineage, and
    // lifetime, not the semantic result of an arbitrary storage-writing kernel.
    const authority = Object.freeze({
      schema: ULG_SPH_DISPERSED_MEDIUM_OPTICS_AUTHORITY_SCHEMA,
      status: 'sph-dispersed-medium-optics-authority-ready',
      deviceId: webGpuDeviceId(device),
      particleCount: packed.particleCount,
      rowCount: packed.rowCount,
      rowCapacity: packed.rowCapacity,
      readyRowCount: packed.readyRowCount,
      blockedRowCount: packed.blockedRowCount,
      readyOpticalStateIds: Object.freeze([
        ...packed.readyOpticalStateIds
      ]),
      readyOpticalStateRouteCount: packed.readyOpticalStateIds.length,
      rowStrideFloats: packed.rowStrideFloats,
      rowStrideBytes: packed.rowStrideBytes,
      bufferByteLength: packed.bufferByteLength
    });
    const upload = {
      schema: ULG_SPH_DISPERSED_MEDIUM_OPTICS_BUFFER_SET_SCHEMA,
      status: 'webgpu-uploaded',
      sourceSchema: packed.schema,
      particleCount: packed.particleCount,
      rowCount: packed.rowCount,
      rowCapacity: packed.rowCapacity,
      readyRowCount: packed.readyRowCount,
      blockedRowCount: packed.blockedRowCount,
      readyOpticalStateIds: authority.readyOpticalStateIds,
      readyOpticalStateRouteCount: authority.readyOpticalStateRouteCount,
      rowStrideFloats: packed.rowStrideFloats,
      rowStrideBytes: packed.rowStrideBytes,
      bufferByteLength: packed.bufferByteLength,
      buffer,
      authority,
      ownsBuffer: true,
      hostHotLoopReadback: false
    };
    const record = {
      authority,
      upload,
      device,
      buffer,
      packed,
      ownsBuffer: true,
      particleCount: packed.particleCount,
      rowCount: packed.rowCount,
      rowCapacity: packed.rowCapacity,
      readyRowCount: packed.readyRowCount,
      blockedRowCount: packed.blockedRowCount,
      readyOpticalStateIds: authority.readyOpticalStateIds,
      readyOpticalStateRouteCount: authority.readyOpticalStateRouteCount,
      rowStrideFloats: packed.rowStrideFloats,
      rowStrideBytes: packed.rowStrideBytes,
      bufferByteLength: packed.bufferByteLength,
      active: true,
      destroyed: false,
      destroyRequested: false,
      activeBorrowCount: 0,
      particleLineage: boundParticleLineage,
      particleSourceFamilies: new WeakMap(),
      particleSourceFamilyRegistrar:
        boundParticleSourceFamily ? particleSourceFamilyRegistrar : null,
      deviceLost: false
    };
    if (boundParticleSourceFamily) {
      registerParticleSourceFamily(record, boundParticleSourceFamily);
    }
    authorityRecords.set(authority, record);
    uploadRecords.set(upload, record);
    if (device.lost?.then) {
      Promise.resolve(device.lost).then(() => {
        record.deviceLost = true;
        destroyUploadRecordNow(record);
      }).catch(() => {
        record.deviceLost = true;
        destroyUploadRecordNow(record);
      });
    }
    return upload;
  } catch (error) {
    try {
      rawBuffer?.destroy?.();
    } catch {
      // Preserve the construction error after one best-effort rollback.
    }
    throw error;
  }
}

export function registerSphDispersedMediumGpuBufferParticleLineage(
  upload,
  particleLineage
) {
  const record = uploadRecords.get(upload);
  if (
    !record
    || record.upload !== upload
    || record.destroyed
    || record.deviceLost
    || record.destroyRequested
    || !exactUploadDescriptorMatchesRecord(record, upload)
  ) {
    throw new TypeError(
      'dispersed-medium particle lineage requires one live exact sidecar'
    );
  }
  const next = canonicalParticleLineage(
    particleLineage,
    record.particleCount
  );
  if (record.particleLineage) {
    const prior = record.particleLineage;
    if (
      prior.particleCount !== next.particleCount
      || prior.topologyEpoch !== next.topologyEpoch
      || prior.identityRevision !== next.identityRevision
      || prior.identityBuffer !== next.identityBuffer
    ) {
      throw new TypeError(
        'dispersed-medium sidecar is already bound to another particle lineage'
      );
    }
    return true;
  }
  record.particleLineage = next;
  return true;
}

export function sphDispersedMediumGpuBufferParticleLineageMatches(
  upload,
  expectedLineage
) {
  const record = uploadRecords.get(upload);
  return Boolean(
    record
    && exactUploadDescriptorMatchesRecord(
      record,
      upload,
      { requireParticleLineage: true }
    )
    && record.active
    && !record.destroyed
    && !record.deviceLost
    && exactParticleLineageMatches(record, expectedLineage)
  );
}

/**
 * Prove that this sidecar was privately attached to the exact particle source
 * family being consumed. Identity hashes are diagnostic only; the three
 * GPUBuffer identities and their device are the authority-bearing keys.
 */
export function sphDispersedMediumGpuBufferParticleSourceFamilyMatches(
  upload,
  expectedSourceFamily
) {
  const record = uploadRecords.get(upload);
  if (
    !record
    || !exactUploadDescriptorMatchesRecord(
      record,
      upload,
      { requireParticleLineage: true }
    )
    || !record.active
    || record.destroyed
    || record.deviceLost
  ) return false;
  let sourceFamily;
  try {
    sourceFamily = canonicalParticleSourceFamily(expectedSourceFamily, {
      particleCount: record.particleCount,
      device: record.device,
      particleLineage: record.particleLineage
    });
  } catch {
    return false;
  }
  return particleSourceFamilyMatches(record, sourceFamily);
}

/**
 * Extend a live sidecar from one privately registered particle family to one
 * topology-stable successor. This is intentionally a transition operation,
 * not a first-seen registration API: callers must prove an existing exact
 * source family. The returned rollback is used by the parent ownership
 * transaction if descriptor seeding or ownership publication later fails.
 */
export function registerSphDispersedMediumGpuBufferParticleSourceFamilyContinuation(
  upload,
  {
    registrar,
    sourceFamily,
    targetFamily
  } = {}
) {
  const record = uploadRecords.get(upload);
  if (
    !record
    || !exactUploadDescriptorMatchesRecord(
      record,
      upload,
      { requireParticleLineage: true }
    )
    || !record.active
    || record.destroyed
    || record.destroyRequested
    || record.deviceLost
    || !record.particleSourceFamilyRegistrar
    || registrar !== record.particleSourceFamilyRegistrar
  ) {
    throw new TypeError(
      'dispersed-medium source-family continuation requires one live child eligible for a new owner'
    );
  }
  const source = canonicalParticleSourceFamily(sourceFamily, {
    particleCount: record.particleCount,
    device: record.device,
    particleLineage: record.particleLineage
  });
  const target = canonicalParticleSourceFamily(targetFamily, {
    particleCount: record.particleCount,
    device: record.device,
    particleLineage: record.particleLineage
  });
  if (!particleSourceFamilyMatches(record, source)) {
    throw new TypeError(
      'dispersed-medium source-family continuation requires an authenticated predecessor family'
    );
  }
  return registerParticleSourceFamily(record, target);
}

/**
 * Ordinary validation remains available while a pinned child drains, but a
 * pending destroy must never acquire another parent or owner.
 */
export function sphDispersedMediumGpuBufferNewOwnerEligible(upload) {
  const record = uploadRecords.get(upload);
  return Boolean(
    record
    && exactUploadDescriptorMatchesRecord(
      record,
      upload,
      { requireParticleLineage: true }
    )
    && record.active
    && !record.destroyed
    && !record.destroyRequested
    && !record.deviceLost
  );
}

/**
 * Pin one exact sidecar across an asynchronous same-device consumer. A
 * concurrent owner teardown becomes a deferred destroy and completes only
 * after the last pin releases, even when parent particle-upload ownership has
 * moved to a topology-stable successor descriptor.
 */
export function beginSphDispersedMediumGpuBufferBorrow(device, upload) {
  const record = uploadRecords.get(upload);
  if (
    !record
    || record.upload !== upload
    || record.device !== device
    || record.destroyed
    || record.deviceLost
    || record.destroyRequested
    || !validateSphDispersedMediumGpuBufferAuthority(
      device,
      upload?.authority,
      {
        upload,
        buffer: upload?.buffer,
        particleCount: upload?.particleCount,
        rowCount: upload?.rowCount,
        rowStrideFloats: upload?.rowStrideFloats,
        bufferByteLength: upload?.bufferByteLength,
        requireParticleLineage: true
      }
    )
  ) {
    throw new TypeError(
      'dispersed-medium borrow requires one live exact same-device sidecar'
    );
  }
  record.activeBorrowCount += 1;
  let released = false;
  return () => {
    if (released) return false;
    released = true;
    record.activeBorrowCount = Math.max(0, record.activeBorrowCount - 1);
    if (record.activeBorrowCount === 0 && record.destroyRequested) {
      destroyUploadRecordNow(record);
    }
    return true;
  };
}

export function validateSphDispersedMediumGpuBufferAuthority(
  device,
  authority,
  expectations = {}
) {
  const record = authorityRecords.get(authority);
  const has = (key) => Object.prototype.hasOwnProperty.call(expectations, key);
  return Boolean(
    record
    && record.authority === authority
    && Object.isFrozen(authority)
    && authority.schema === ULG_SPH_DISPERSED_MEDIUM_OPTICS_AUTHORITY_SCHEMA
    && authority.status === 'sph-dispersed-medium-optics-authority-ready'
    && Array.isArray(authority.readyOpticalStateIds)
    && Object.isFrozen(authority.readyOpticalStateIds)
    && authority.readyOpticalStateRouteCount
      === authority.readyOpticalStateIds.length
    && authority.readyOpticalStateIds.length
      === record.packed.readyOpticalStateIds.length
    && authority.readyOpticalStateIds.every(
      (value, index) => value === record.packed.readyOpticalStateIds[index]
    )
    && record.active
    && !record.destroyed
    && !record.deviceLost
    && record.upload.destroyed !== true
    && record.device === device
    && webGpuBufferDevice(record.buffer) === device
    && exactUploadDescriptorMatchesRecord(record, record.upload, {
      requireParticleLineage: expectations.requireParticleLineage === true
    })
    && (!has('upload') || expectations.upload === record.upload)
    && (!has('buffer') || expectations.buffer === record.buffer)
    && (
      !has('particleCount')
      || expectations.particleCount === authority.particleCount
    )
    && (!has('rowCount') || expectations.rowCount === authority.rowCount)
    && (
      !has('rowStrideFloats')
      || expectations.rowStrideFloats === authority.rowStrideFloats
    )
    && (
      !has('bufferByteLength')
      || expectations.bufferByteLength === authority.bufferByteLength
    )
    && (
      !has('particleLineage')
      || exactParticleLineageMatches(record, expectations.particleLineage)
    )
  );
}

export function destroySphDispersedMediumGpuBuffers(upload) {
  const record = uploadRecords.get(upload);
  if (!record || record.upload !== upload) return false;
  return retireUploadRecord(record);
}
