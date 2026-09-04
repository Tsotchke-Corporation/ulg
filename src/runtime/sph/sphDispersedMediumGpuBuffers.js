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
import {
  consumeSphDispersedMediumOpticsProducerAdoptionClaim
} from './sphDispersedMediumOpticsProducerGpu.js';

const GPU_BUFFER_USAGE = {
  STORAGE: globalThis.GPUBufferUsage?.STORAGE ?? 128
};
const EXACT_F32_INTEGER_MAX = 0x00ff_ffff;
const STATIC_ROW_DECLARATION_MODE = 'static-row-prefixes-v0';
const DYNAMIC_ROUTE_CATALOG_DECLARATION_MODE =
  'gpu-dynamic-route-catalog-v0';
const GPU_RESIDENT_ACTIVE_ROUTE_COUNT_AUTHORITY =
  'gpu-resident-unobserved-no-host-readback';
const authorityRecords = new WeakMap();
const uploadRecords = new WeakMap();
const bufferRecords = new WeakMap();
const particleTopologyEpochTransitionWitnessRecords = new WeakMap();
const particleTopologyEpochTransitionsInProgress = new WeakSet();

export const ULG_SPH_DISPERSED_MEDIUM_OPTICS_TOPOLOGY_EPOCH_TRANSITION_SCHEMA =
  'peercompute.ulg.sph-dispersed-medium-optics-topology-epoch-transition.v0';

function nextParticleTopologyEpochTransitionGeneration() {
  return Object.freeze({});
}

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

function exactParticleSourceFamilyFieldsMatch(left, right) {
  return Boolean(
    left
    && right
    && left.device === right.device
    && left.particleCount === right.particleCount
    && left.topologyEpoch === right.topologyEpoch
    && left.identityRevision === right.identityRevision
    && left.stateBuffer === right.stateBuffer
    && left.thermoBuffer === right.thermoBuffer
    && left.identityBuffer === right.identityBuffer
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
  const canonicalReadyOpticalStateIds = [...readyOpticalStateIds]
    .sort((left, right) => left - right);
  const dynamicRouteCatalog = packed.declarationMode
    === DYNAMIC_ROUTE_CATALOG_DECLARATION_MODE;
  if (dynamicRouteCatalog) {
    if (
      packed.readyRowCount !== null
      || packed.blockedRowCount !== null
      || packed.initialReadyRowCount !== readyRowCount
      || packed.initialBlockedRowCount !== blockedRowCount
      || readyRowCount + blockedRowCount !== packed.rowCount
      || !Array.isArray(packed.initialReadyOpticalStateIds)
      || packed.initialReadyOpticalStateIds.length
        !== canonicalReadyOpticalStateIds.length
      || packed.initialReadyOpticalStateIds.some(
        (value, index) => value !== canonicalReadyOpticalStateIds[index]
      )
    ) {
      throw new RangeError(
        'dispersed-medium dynamic route catalog initial row metadata is inconsistent'
      );
    }
    const eligibleOpticalStateIds = packed.eligibleOpticalStateIds;
    if (
      !Array.isArray(eligibleOpticalStateIds)
      || eligibleOpticalStateIds.some((value, index) => (
        nonnegativeIdentifier(
          value,
          `eligibleOpticalStateIds[${index}]`,
          { positive: true }
        ) !== value
        || (index > 0 && eligibleOpticalStateIds[index - 1] >= value)
      ))
      || canonicalReadyOpticalStateIds.some(
        (value) => !eligibleOpticalStateIds.includes(value)
      )
      || !Array.isArray(packed.readyOpticalStateIds)
      || packed.readyOpticalStateIds.length !== eligibleOpticalStateIds.length
      || packed.readyOpticalStateIds.some(
        (value, index) => value !== eligibleOpticalStateIds[index]
      )
      || packed.readyOpticalStateRouteCount
        !== eligibleOpticalStateIds.length
      || packed.eligibleOpticalStateRouteCount
        !== eligibleOpticalStateIds.length
      || !Number.isSafeInteger(packed.routeCatalogRowCount)
      || packed.routeCatalogRowCount < eligibleOpticalStateIds.length
      || typeof packed.routeCatalogSignature !== 'string'
      || !packed.routeCatalogSignature.startsWith('f32-bits-v0:')
      || packed.activeRouteCountAuthority
        !== GPU_RESIDENT_ACTIVE_ROUTE_COUNT_AUTHORITY
    ) {
      throw new RangeError(
        'dispersed-medium dynamic route catalog authority is inconsistent'
      );
    }
  } else {
    if (
      packed.declarationMode != null
      && packed.declarationMode !== STATIC_ROW_DECLARATION_MODE
    ) {
      throw new RangeError(
        'dispersed-medium optics declaration mode is unsupported'
      );
    }
    if (
      packed.readyRowCount !== readyRowCount
      || packed.blockedRowCount !== blockedRowCount
      || readyRowCount + blockedRowCount !== packed.rowCount
    ) {
      throw new RangeError(
        'dispersed-medium optics row status counts are inconsistent'
      );
    }
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
}

function privatePackedRowsSnapshot(packed, { allowDynamic = false } = {}) {
  validatePackedRows(packed);
  if (
    packed.declarationMode === DYNAMIC_ROUTE_CATALOG_DECLARATION_MODE
    && !allowDynamic
  ) {
    throw new TypeError(
      'dispersed-medium dynamic route catalogs require an authenticated producer adoption'
    );
  }
  const snapshot = Object.freeze({
    ...packed,
    readyOpticalStateIds: Object.freeze([
      ...packed.readyOpticalStateIds
    ]),
    ...(Array.isArray(packed.initialReadyOpticalStateIds) ? {
      initialReadyOpticalStateIds: Object.freeze([
        ...packed.initialReadyOpticalStateIds
      ])
    } : {}),
    ...(Array.isArray(packed.eligibleOpticalStateIds) ? {
      eligibleOpticalStateIds: Object.freeze([
        ...packed.eligibleOpticalStateIds
      ])
    } : {}),
    rowLayout: Object.freeze([
      ...SPH_DISPERSED_MEDIUM_OPTICS_ROW_LAYOUT
    ]),
    rows: packed.rows.slice()
  });
  validatePackedRows(snapshot);
  return snapshot;
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
  if (!record || record.destroyed) return false;
  if (record.activeBorrowCount > 0) {
    if (record.destroyRequested) return false;
    record.destroyRequested = true;
    record.upload.destroyPending = true;
    return true;
  }
  return destroyUploadRecordNow(record);
}

function destroyUploadRecordNow(record) {
  if (!record || record.destroyed) return false;
  // Ownership is construction-time authority. `upload` is intentionally a
  // plain descriptor because worker continuation code must be able to attach
  // it to successive particle families, but its public ownsBuffer diagnostic
  // must never be able to suppress retirement of the allocation represented
  // by this module-private record.
  // Do not publish retirement before the fallible raw destruction call has
  // completed.  In particular, a deferred destruction that throws during its
  // final borrow release must retain `destroyRequested` so its exact owner can
  // retry the same allocation rather than losing retirement authority.
  if (record.ownsBuffer) record.buffer.destroy?.();
  record.active = false;
  record.destroyed = true;
  record.destroyRequested = false;
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
    && upload.declarationMode === record.declarationMode
    && upload.initialReadyRowCount === record.initialReadyRowCount
    && upload.initialBlockedRowCount === record.initialBlockedRowCount
    && upload.initialReadyOpticalStateIds
      === record.initialReadyOpticalStateIds
    && upload.eligibleOpticalStateIds === record.eligibleOpticalStateIds
    && upload.eligibleOpticalStateRouteCount
      === record.eligibleOpticalStateRouteCount
    && upload.routeCatalogRowCount === record.routeCatalogRowCount
    && upload.routeCatalogSignature === record.routeCatalogSignature
    && upload.activeRouteCountAuthority === record.activeRouteCountAuthority
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

function exactLiveUploadRecordStateMatches(record, device = record?.device) {
  return Boolean(
    record
    && record.active === true
    && record.destroyed !== true
    && record.destroyRequested !== true
    && record.deviceLost !== true
    && record.ownsBuffer === true
    && record.device === device
    && uploadRecords.get(record.upload) === record
    && authorityRecords.get(record.authority) === record
    && bufferRecords.get(record.buffer) === record
    && webGpuBufferDevice(record.buffer) === device
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
  // Capture the declaration exactly once before allocating or copying.  The
  // same private rows must describe both the resident bytes and the registry
  // record even if a WebGPU-like unmap hook mutates the caller's source.
  const packedSnapshot = privatePackedRowsSnapshot(packed);
  let rawBuffer = null;
  try {
    rawBuffer = device.createBuffer({
      label,
      size: packedSnapshot.bufferByteLength,
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
    const mappedRange = rawBuffer.getMappedRange(
      0,
      packedSnapshot.bufferByteLength
    );
    if (
      !(mappedRange instanceof ArrayBuffer)
      || mappedRange.byteLength < packedSnapshot.bufferByteLength
    ) {
      throw new TypeError(
        'dispersed-medium mapped-at-creation range must cover the exact packed rows'
      );
    }
    new Uint8Array(mappedRange, 0, packedSnapshot.bufferByteLength).set(
      new Uint8Array(
        packedSnapshot.rows.buffer,
        packedSnapshot.rows.byteOffset,
        packedSnapshot.rows.byteLength
      )
    );
    rawBuffer.unmap();
    return registerSphDispersedMediumGpuBuffer(
      device,
      packedSnapshot,
      rawBuffer,
      {
        particleLineage,
        particleSourceFamily,
        particleSourceFamilyRegistrar
      }
    );
  } catch (error) {
    try {
      rawBuffer?.destroy?.();
    } catch {
      // Preserve the construction error after one best-effort rollback.
    }
    throw error;
  }
}

function registerSphDispersedMediumGpuBuffer(
  device,
  packed,
  rawBuffer,
  {
    particleLineage = null,
    particleSourceFamily = null,
    particleSourceFamilyRegistrar = null,
    producerAdoptionDeclaration = null
  } = {}
) {
  // `packed` is an internal private snapshot captured by the caller before
  // the associated allocation was initialized.  Revalidate it here, but do
  // not resnapshot after bytes have already been copied or encoded.
  validatePackedRows(packed);
  const declarationMode = packed.declarationMode
    ?? STATIC_ROW_DECLARATION_MODE;
  const dynamicRouteCatalog = declarationMode
    === DYNAMIC_ROUTE_CATALOG_DECLARATION_MODE;
  if (
    dynamicRouteCatalog
    && (
      producerAdoptionDeclaration?.schema
        !== ULG_SPH_DISPERSED_MEDIUM_OPTICS_SCHEMA
      || producerAdoptionDeclaration.declarationMode
        !== DYNAMIC_ROUTE_CATALOG_DECLARATION_MODE
      || producerAdoptionDeclaration.routeCatalogSignature
        !== packed.routeCatalogSignature
      || producerAdoptionDeclaration.routeCatalogRowCount
        !== packed.routeCatalogRowCount
      || producerAdoptionDeclaration.eligibleOpticalStateRouteCount
        !== packed.eligibleOpticalStateRouteCount
      || !Array.isArray(producerAdoptionDeclaration.eligibleOpticalStateIds)
      || producerAdoptionDeclaration.eligibleOpticalStateIds.length
        !== packed.eligibleOpticalStateIds.length
      || producerAdoptionDeclaration.eligibleOpticalStateIds.some(
        (value, index) => value !== packed.eligibleOpticalStateIds[index]
      )
    )
  ) {
    throw new TypeError(
      'dispersed-medium dynamic route catalogs require the exact authenticated producer declaration'
    );
  }
  if (!exactObjectReference(rawBuffer)) {
    throw new TypeError(
      'dispersed-medium buffer registration requires one exact GPU buffer'
    );
  }
  if (bufferRecords.has(rawBuffer)) {
    throw new TypeError(
      'dispersed-medium buffer registration refuses an already registered allocation'
    );
  }
  if (
    Number(rawBuffer.size) !== packed.bufferByteLength
    || !Number.isInteger(Number(rawBuffer.usage))
    || (Number(rawBuffer.usage) & GPU_BUFFER_USAGE.STORAGE) === 0
  ) {
    throw new RangeError(
      'dispersed-medium buffer registration requires exact byte length and STORAGE usage'
    );
  }
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
  const buffer = tagWebGpuBufferDevice(rawBuffer, device);
  if (webGpuBufferDevice(buffer) !== device) {
    throw new TypeError(
      'dispersed-medium buffer registration requires an exact same-device allocation'
    );
  }
  let authority = null;
  let upload = null;
  let record = null;
  try {
    const initialReadyOpticalStateIds = Object.freeze([
      ...(packed.initialReadyOpticalStateIds ?? packed.readyOpticalStateIds)
    ]);
    const eligibleOpticalStateIds = Object.freeze([
      ...(packed.eligibleOpticalStateIds ?? packed.readyOpticalStateIds)
    ]);
    const initialReadyRowCount = packed.initialReadyRowCount
      ?? packed.readyRowCount;
    const initialBlockedRowCount = packed.initialBlockedRowCount
      ?? packed.blockedRowCount;
    const eligibleOpticalStateRouteCount =
      packed.eligibleOpticalStateRouteCount
      ?? eligibleOpticalStateIds.length;
    const routeCatalogRowCount = packed.routeCatalogRowCount ?? null;
    const routeCatalogSignature = packed.routeCatalogSignature ?? null;
    const activeRouteCountAuthority = packed.activeRouteCountAuthority
      ?? 'exact-static-row-prefix-counts';
    // The child descriptor never exposes a host mutation method. Same-device
    // compute producers may initialize moment lanes before this registration;
    // their serialized dispatch/receipt chain is the semantic content boundary.
    // This allocation authority authenticates identity, layout, lineage, and
    // lifetime rather than blessing an arbitrary storage-writing kernel.
    authority = Object.freeze({
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
      readyOpticalStateRouteCount: packed.readyOpticalStateRouteCount,
      declarationMode,
      initialReadyRowCount,
      initialBlockedRowCount,
      initialReadyOpticalStateIds,
      eligibleOpticalStateIds,
      eligibleOpticalStateRouteCount,
      routeCatalogRowCount,
      routeCatalogSignature,
      activeRouteCountAuthority,
      rowStrideFloats: packed.rowStrideFloats,
      rowStrideBytes: packed.rowStrideBytes,
      bufferByteLength: packed.bufferByteLength
    });
    upload = {
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
      declarationMode: authority.declarationMode,
      initialReadyRowCount: authority.initialReadyRowCount,
      initialBlockedRowCount: authority.initialBlockedRowCount,
      initialReadyOpticalStateIds: authority.initialReadyOpticalStateIds,
      eligibleOpticalStateIds: authority.eligibleOpticalStateIds,
      eligibleOpticalStateRouteCount:
        authority.eligibleOpticalStateRouteCount,
      routeCatalogRowCount: authority.routeCatalogRowCount,
      routeCatalogSignature: authority.routeCatalogSignature,
      activeRouteCountAuthority: authority.activeRouteCountAuthority,
      rowStrideFloats: packed.rowStrideFloats,
      rowStrideBytes: packed.rowStrideBytes,
      bufferByteLength: packed.bufferByteLength,
      buffer,
      authority,
      ownsBuffer: true,
      hostHotLoopReadback: false
    };
    record = {
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
      declarationMode: authority.declarationMode,
      initialReadyRowCount: authority.initialReadyRowCount,
      initialBlockedRowCount: authority.initialBlockedRowCount,
      initialReadyOpticalStateIds: authority.initialReadyOpticalStateIds,
      eligibleOpticalStateIds: authority.eligibleOpticalStateIds,
      eligibleOpticalStateRouteCount:
        authority.eligibleOpticalStateRouteCount,
      routeCatalogRowCount: authority.routeCatalogRowCount,
      routeCatalogSignature: authority.routeCatalogSignature,
      activeRouteCountAuthority: authority.activeRouteCountAuthority,
      rowStrideFloats: packed.rowStrideFloats,
      rowStrideBytes: packed.rowStrideBytes,
      bufferByteLength: packed.bufferByteLength,
      active: true,
      destroyed: false,
      destroyRequested: false,
      activeBorrowCount: 0,
      particleLineage: boundParticleLineage,
      particleTopologyEpochTransitionGeneration:
        nextParticleTopologyEpochTransitionGeneration(),
      particleSourceFamilies: new WeakMap(),
      particleSourceFamilyRegistrar:
        boundParticleSourceFamily ? particleSourceFamilyRegistrar : null,
      producerAdoptionDeclaration,
      deviceLost: false
    };
    if (boundParticleSourceFamily) {
      registerParticleSourceFamily(record, boundParticleSourceFamily);
    }
    authorityRecords.set(authority, record);
    uploadRecords.set(upload, record);
    bufferRecords.set(buffer, record);
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
    if (authority) authorityRecords.delete(authority);
    if (upload) uploadRecords.delete(upload);
    bufferRecords.delete(buffer);
    throw error;
  }
}

function rollbackSphDispersedMediumGpuBufferRegistration(
  upload,
  expectedBuffer
) {
  const record = uploadRecords.get(upload);
  if (
    !record
    || record.upload !== upload
    || record.buffer !== expectedBuffer
    || record.activeBorrowCount !== 0
    || record.destroyRequested
    || record.destroyed
    || record.deviceLost
    || record.ownsBuffer !== true
    || !exactUploadDescriptorMatchesRecord(
      record,
      upload,
      { requireParticleLineage: true }
    )
    || !exactLiveUploadRecordStateMatches(record)
  ) return false;
  authorityRecords.delete(record.authority);
  uploadRecords.delete(upload);
  bufferRecords.delete(record.buffer);
  record.active = false;
  record.destroyed = true;
  record.destroyRequested = false;
  record.ownsBuffer = false;
  upload.ownsBuffer = false;
  upload.destroyPending = false;
  upload.destroyed = true;
  return true;
}

/**
 * Consume one producer-issued claim and register its exact output as a new
 * dispersed-medium child. There is deliberately no public raw-buffer adoption
 * path: semantic authority comes from the producer's private one-shot claim,
 * not from caller-supplied metadata that merely has the right shape.
 *
 * `publish` may attach the registered child to a parent lifecycle. It must
 * register every parent revoker before performing the corresponding mutation;
 * producer-side failure then runs those revokers before unregistering the
 * child, without destroying the buffer that the producer still owns.
 */
export function consumeSphDispersedMediumOpticsProducerClaimAsGpuBuffer(
  claim,
  options = null
) {
  // Do not read caller-owned option fields before the producer has locked its
  // one-shot claim. An eager destructure here lets a Proxy getter re-enter and
  // consume the claim while the outer invocation still believes it owns
  // preflight.
  const producerOptions = Object.create(null);
  Object.defineProperties(producerOptions, {
    device: {
      enumerable: true,
      get: () => options?.device
    },
    outputBuffer: {
      enumerable: true,
      get: () => options?.outputBuffer
    },
    particleSourceFamily: {
      enumerable: true,
      get: () => options?.particleSourceFamily ?? null
    },
    adopt: {
      enumerable: true,
      value(context) {
        // Producer adoption is already in progress before this callback runs,
        // so a hostile lower-option getter can no longer win a nested consume.
        // Bind registration to the producer's private post-transfer family,
        // not to a second read of a mutable caller getter after preflight.
        const particleSourceFamily = context.particleSourceFamily;
        const requestedParticleLineage = canonicalParticleLineage(
          options?.particleLineage,
          particleSourceFamily?.particleCount
        );
        if (
          !requestedParticleLineage
          || requestedParticleLineage.particleCount
            !== particleSourceFamily.particleCount
          || requestedParticleLineage.topologyEpoch
            !== particleSourceFamily.topologyEpoch
          || requestedParticleLineage.identityRevision
            !== particleSourceFamily.identityRevision
          || requestedParticleLineage.identityBuffer
            !== particleSourceFamily.identityBuffer
        ) {
          throw new TypeError(
            'dispersed-medium producer adoption requires the exact post-transfer particle lineage'
          );
        }
        const particleLineage = particleSourceFamily;
        const particleSourceFamilyRegistrar =
          options?.particleSourceFamilyRegistrar ?? null;
        const publish = options?.publish ?? null;
        if (publish != null && typeof publish !== 'function') {
          throw new TypeError(
            'dispersed-medium producer adoption publish hook must be a function'
          );
        }
        const adoptionDeclaration = privatePackedRowsSnapshot(
          context.adoptionDeclaration,
          { allowDynamic: true }
        );
        const upload = registerSphDispersedMediumGpuBuffer(
          context.device,
          adoptionDeclaration,
          context.outputBuffer,
          {
            particleLineage,
            particleSourceFamily,
            particleSourceFamilyRegistrar,
            producerAdoptionDeclaration: context.adoptionDeclaration
          }
        );
        const publicationRollbacks = [];
        let rollbackComplete = false;
        let publicationOpen = true;
        const rollback = () => {
          if (rollbackComplete) return true;
          let complete = true;
          for (
            let index = publicationRollbacks.length - 1;
            index >= 0;
            index -= 1
          ) {
            try {
              if (publicationRollbacks[index]() !== true) complete = false;
            } catch {
              complete = false;
            }
          }
          if (!rollbackSphDispersedMediumGpuBufferRegistration(
            upload,
            context.outputBuffer
          )) complete = false;
          rollbackComplete = complete;
          return complete;
        };
        context.registerRollback(rollback);
        const registerPublicationRollback = (revoker) => {
          if (!publicationOpen || typeof revoker !== 'function') {
            throw new TypeError(
              'dispersed-medium parent publication rollback must be registered while publication is open'
            );
          }
          publicationRollbacks.push(revoker);
          return true;
        };
        const published = publish
          ? publish(Object.freeze({
            upload,
            registerPublicationRollback
          }))
          : upload;
        publicationOpen = false;
        if (published !== upload) {
          throw new TypeError(
            'dispersed-medium producer adoption must publish the exact registered child'
          );
        }
        return { adoptedOutput: upload, rollback };
      }
    }
  });
  return consumeSphDispersedMediumOpticsProducerAdoptionClaim(
    claim,
    producerOptions
  );
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
  if (!exactLiveUploadRecordStateMatches(record)) {
    throw new TypeError(
      'dispersed-medium particle lineage requires one live exact sidecar'
    );
  }
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

/**
 * Advance one live child's particle lineage across an exact conservative
 * topology-epoch stamp. State, thermo, identity, revision, and particle count
 * remain byte-for-byte the same; only the epoch may advance, and only by one.
 * The opaque witness lets downstream producer authority rebase against this
 * exact private transition without gaining its rollback capability.
 */
export function advanceSphDispersedMediumGpuBufferParticleTopologyEpoch(
  upload,
  options = null
) {
  const record = uploadRecords.get(upload) ?? null;
  if (
    !record
    || record.upload !== upload
    || record.destroyed
    || record.destroyRequested
    || record.deviceLost
    || record.activeBorrowCount !== 0
    || !record.particleLineage
    || !record.particleSourceFamilyRegistrar
    || particleTopologyEpochTransitionsInProgress.has(upload)
    || !exactUploadDescriptorMatchesRecord(
      record,
      upload,
      { requireParticleLineage: true }
    )
    || !exactLiveUploadRecordStateMatches(record)
  ) {
    throw new TypeError(
      'dispersed-medium topology-epoch transition requires one unborrowed live exact child'
    );
  }

  particleTopologyEpochTransitionsInProgress.add(upload);
  try {
    const registrar = options?.registrar ?? null;
    if (registrar !== record.particleSourceFamilyRegistrar) {
      throw new TypeError(
        'dispersed-medium topology-epoch transition requires the private child registrar'
      );
    }
    const sourceLineage = record.particleLineage;
    const requestedSourceFamily = canonicalParticleSourceFamily(
      options?.sourceFamily ?? null,
      {
        particleCount: record.particleCount,
        device: record.device,
        particleLineage: sourceLineage
      }
    );
    if (!particleSourceFamilyMatches(record, requestedSourceFamily)) {
      throw new TypeError(
        'dispersed-medium topology-epoch transition requires the exact registered source family'
      );
    }
    const sourceFamily = particleSourceFamilyEntry(
      record,
      requestedSourceFamily
    );
    if (!exactParticleSourceFamilyFieldsMatch(
      sourceFamily,
      requestedSourceFamily
    )) {
      throw new TypeError(
        'dispersed-medium topology-epoch transition source registry changed during preflight'
      );
    }
    const targetTopologyEpoch = options?.targetTopologyEpoch;
    if (
      !Number.isSafeInteger(targetTopologyEpoch)
      || targetTopologyEpoch < 1
      || targetTopologyEpoch > 0xffff_ffff
      || sourceLineage.topologyEpoch >= 0xffff_ffff
      || targetTopologyEpoch !== sourceLineage.topologyEpoch + 1
    ) {
      throw new RangeError(
        'dispersed-medium topology epoch must advance by exactly one'
      );
    }
    const targetLineage = canonicalParticleLineage({
      ...sourceLineage,
      topologyEpoch: targetTopologyEpoch
    }, record.particleCount);
    const targetFamily = canonicalParticleSourceFamily({
      ...sourceFamily,
      topologyEpoch: targetTopologyEpoch
    }, {
      particleCount: record.particleCount,
      device: record.device,
      particleLineage: targetLineage
    });
    const byThermo = record.particleSourceFamilies.get(
      sourceFamily.stateBuffer
    );
    const byIdentity = byThermo?.get(sourceFamily.thermoBuffer) ?? null;
    if (
      !byIdentity
      || byIdentity.get(sourceFamily.identityBuffer) !== sourceFamily
      || sourceFamily.device !== targetFamily.device
      || sourceFamily.particleCount !== targetFamily.particleCount
      || sourceFamily.identityRevision !== targetFamily.identityRevision
      || sourceFamily.stateBuffer !== targetFamily.stateBuffer
      || sourceFamily.thermoBuffer !== targetFamily.thermoBuffer
      || sourceFamily.identityBuffer !== targetFamily.identityBuffer
    ) {
      throw new TypeError(
        'dispersed-medium topology-epoch transition source registry changed during preflight'
      );
    }

    const targetGeneration = nextParticleTopologyEpochTransitionGeneration();
    const witness = Object.freeze({
      schema:
        ULG_SPH_DISPERSED_MEDIUM_OPTICS_TOPOLOGY_EPOCH_TRANSITION_SCHEMA,
      status: 'sph-dispersed-medium-optics-topology-epoch-advanced',
      particleCount: record.particleCount,
      identityRevision: sourceLineage.identityRevision,
      sourceTopologyEpoch: sourceLineage.topologyEpoch,
      targetTopologyEpoch
    });
    const transitionRecord = {
      active: true,
      witness,
      upload,
      record,
      registrar,
      sourceLineage,
      targetLineage,
      sourceFamily,
      targetFamily,
      byIdentity,
      targetGeneration
    };
    const exactTargetStateStillLive = () => Boolean(
      transitionRecord.active
      && uploadRecords.get(upload) === record
      && record.upload === upload
      && record.destroyed !== true
      && record.destroyRequested !== true
      && record.deviceLost !== true
      && record.activeBorrowCount === 0
      && record.particleSourceFamilyRegistrar === registrar
      && record.particleLineage === targetLineage
      && record.particleTopologyEpochTransitionGeneration === targetGeneration
      && byIdentity.get(targetFamily.identityBuffer) === targetFamily
      && exactUploadDescriptorMatchesRecord(
        record,
        upload,
        { requireParticleLineage: true }
      )
      && exactLiveUploadRecordStateMatches(record)
    );
    transitionRecord.exactTargetStateStillLive = exactTargetStateStillLive;

    byIdentity.set(targetFamily.identityBuffer, targetFamily);
    record.particleLineage = targetLineage;
    record.particleTopologyEpochTransitionGeneration = targetGeneration;
    particleTopologyEpochTransitionWitnessRecords.set(
      witness,
      transitionRecord
    );

    let rolledBack = false;
    const rollback = () => {
      if (rolledBack) return true;
      if (!exactTargetStateStillLive()) return false;
      byIdentity.set(sourceFamily.identityBuffer, sourceFamily);
      record.particleLineage = sourceLineage;
      // Rollback itself is a new private generation. An older transition must
      // never become reusable merely because a later transition was undone.
      record.particleTopologyEpochTransitionGeneration =
        nextParticleTopologyEpochTransitionGeneration();
      transitionRecord.active = false;
      rolledBack = true;
      return true;
    };
    return Object.freeze({ witness, rollback });
  } finally {
    particleTopologyEpochTransitionsInProgress.delete(upload);
  }
}

export function sphDispersedMediumGpuBufferParticleTopologyEpochTransitionMatches(
  witness,
  {
    upload = null,
    sourceFamily = null,
    targetFamily = null
  } = {}
) {
  const transition =
    particleTopologyEpochTransitionWitnessRecords.get(witness) ?? null;
  if (
    !transition
    || transition.witness !== witness
    || transition.upload !== upload
    || !Object.isFrozen(witness)
    || witness.schema
      !== ULG_SPH_DISPERSED_MEDIUM_OPTICS_TOPOLOGY_EPOCH_TRANSITION_SCHEMA
    || witness.status
      !== 'sph-dispersed-medium-optics-topology-epoch-advanced'
    || witness.particleCount !== transition.record.particleCount
    || witness.identityRevision
      !== transition.sourceLineage.identityRevision
    || witness.sourceTopologyEpoch
      !== transition.sourceLineage.topologyEpoch
    || witness.targetTopologyEpoch
      !== transition.targetLineage.topologyEpoch
    || !transition.exactTargetStateStillLive?.()
  ) return false;
  try {
    const canonicalSource = canonicalParticleSourceFamily(sourceFamily, {
      particleCount: transition.record.particleCount,
      device: transition.record.device,
      particleLineage: transition.sourceLineage
    });
    const canonicalTarget = canonicalParticleSourceFamily(targetFamily, {
      particleCount: transition.record.particleCount,
      device: transition.record.device,
      particleLineage: transition.targetLineage
    });
    return Boolean(
      exactParticleSourceFamilyFieldsMatch(
        canonicalSource,
        transition.sourceFamily
      )
      && exactParticleSourceFamilyFieldsMatch(
        canonicalTarget,
        transition.targetFamily
      )
    );
  } catch {
    return false;
  }
}

export function sphDispersedMediumGpuBufferParticleLineageMatches(
  upload,
  expectedLineage
) {
  const record = uploadRecords.get(upload);
  if (
    !record
    || !exactUploadDescriptorMatchesRecord(
      record,
      upload,
      { requireParticleLineage: true }
    )
    || !exactLiveUploadRecordStateMatches(record)
  ) return false;
  return Boolean(
    exactParticleLineageMatches(record, expectedLineage)
    && exactUploadDescriptorMatchesRecord(
      record,
      upload,
      { requireParticleLineage: true }
    )
    && exactLiveUploadRecordStateMatches(record)
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
  return Boolean(
    particleSourceFamilyMatches(record, sourceFamily)
    && exactUploadDescriptorMatchesRecord(
      record,
      upload,
      { requireParticleLineage: true }
    )
    && exactLiveUploadRecordStateMatches(record)
  );
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
  if (
    !exactUploadDescriptorMatchesRecord(
      record,
      upload,
      { requireParticleLineage: true }
    )
    || !exactLiveUploadRecordStateMatches(record)
  ) {
    throw new TypeError(
      'dispersed-medium source-family continuation requires one live child eligible for a new owner'
    );
  }
  const transition = registerParticleSourceFamily(record, target);
  if (transition.inserted === true) {
    record.particleTopologyEpochTransitionGeneration =
      nextParticleTopologyEpochTransitionGeneration();
  }
  return transition;
}

/**
 * A pending destroy may only finish work through an already-issued private
 * borrow. It is no longer generally valid and must never acquire another
 * borrow, parent, snapshot, or owner.
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
    && exactLiveUploadRecordStateMatches(record)
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
    || !exactUploadDescriptorMatchesRecord(
      record,
      upload,
      { requireParticleLineage: true }
    )
    || !exactLiveUploadRecordStateMatches(record, device)
  ) {
    throw new TypeError(
      'dispersed-medium borrow requires one live exact same-device sidecar'
    );
  }
  // A consumer may observe the current topology epoch. Permanently stale any
  // older rollback witness before the borrow becomes externally visible.
  record.particleTopologyEpochTransitionGeneration =
    nextParticleTopologyEpochTransitionGeneration();
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
  try {
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
    && authority.declarationMode === record.declarationMode
    && authority.initialReadyRowCount === record.initialReadyRowCount
    && authority.initialBlockedRowCount === record.initialBlockedRowCount
    && authority.initialReadyOpticalStateIds
      === record.initialReadyOpticalStateIds
    && Array.isArray(authority.initialReadyOpticalStateIds)
    && Object.isFrozen(authority.initialReadyOpticalStateIds)
    && authority.eligibleOpticalStateIds === record.eligibleOpticalStateIds
    && Array.isArray(authority.eligibleOpticalStateIds)
    && Object.isFrozen(authority.eligibleOpticalStateIds)
    && authority.eligibleOpticalStateRouteCount
      === record.eligibleOpticalStateRouteCount
    && authority.routeCatalogRowCount === record.routeCatalogRowCount
    && authority.routeCatalogSignature === record.routeCatalogSignature
    && authority.activeRouteCountAuthority
      === record.activeRouteCountAuthority
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
      && (
        !has('producerAdoptionDeclaration')
        || expectations.producerAdoptionDeclaration
          === record.producerAdoptionDeclaration
      )
      // Caller-controlled expectation getters and mutable public descriptor
      // fields have all been observed now. Reprove both the descriptor and
      // the module-private allocation state as the terminal checks.
      && exactUploadDescriptorMatchesRecord(record, record.upload, {
        requireParticleLineage: expectations.requireParticleLineage === true
      })
      && exactLiveUploadRecordStateMatches(record, device)
    );
  } catch {
    return false;
  }
}

/**
 * Return a defensive host declaration for one exact privately authenticated
 * resident sidecar. Moment lanes may be stale by design; the GPU allocation is
 * their authority, while this snapshot carries the exact private allocation
 * plus the immutable per-row route declaration needed by the next producer
 * dispatch. Reading the public descriptor's mutable `buffer` field here would
 * reopen a getter/TOCTOU substitution path after authority validation.
 */
export function snapshotSphDispersedMediumGpuBufferDeclaration(
  upload,
  {
    device,
    particleSourceFamily
  } = {}
) {
  const record = uploadRecords.get(upload);
  if (
    !record
    || record.upload !== upload
    || !device
    || !particleSourceFamily
    || !validateSphDispersedMediumGpuBufferAuthority(
      device,
      record.authority,
      {
        upload,
        buffer: record.buffer,
        particleCount: record.particleCount,
        rowCount: record.rowCount,
        rowStrideFloats: record.rowStrideFloats,
        bufferByteLength: record.bufferByteLength,
        particleLineage: particleSourceFamily,
        requireParticleLineage: true
      }
    )
    || !sphDispersedMediumGpuBufferParticleSourceFamilyMatches(
      upload,
      particleSourceFamily
    )
    || !exactUploadDescriptorMatchesRecord(
      record,
      upload,
      { requireParticleLineage: true }
    )
    || !exactLiveUploadRecordStateMatches(record, device)
  ) {
    throw new TypeError(
      'dispersed-medium declaration snapshot requires one exact live sidecar and source family'
    );
  }
  return Object.freeze({
    ...privatePackedRowsSnapshot(record.packed, { allowDynamic: true }),
    buffer: record.buffer
  });
}

export function destroySphDispersedMediumGpuBuffers(upload) {
  const record = uploadRecords.get(upload);
  if (!record || record.upload !== upload) return false;
  return retireUploadRecord(record);
}
