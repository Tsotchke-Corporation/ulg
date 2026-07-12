export const COHERENT_SOLID_PRESENTATION_CONSUMER_LEASE_SCHEMA =
  'peercompute.ulg.coherent-solid-presentation-consumer-lease.v0';
export const COHERENT_SOLID_PRESENTATION_CONSUMER_LEASE_VALIDATION_SCHEMA =
  'peercompute.ulg.coherent-solid-presentation-consumer-lease-validation.v0';

let presentationLeaseSequence = 0;

function positiveU32(value) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 && number <= 0xffffffff
    ? number
    : null;
}

function nonEmpty(value, label) {
  const text = String(value ?? '').trim();
  if (!text) throw new TypeError(`${label} must be non-empty`);
  return text;
}

export function createCoherentSolidPresentationLeaseRegistry({
  validatePublication = null
} = {}) {
  const recordByPublication = new WeakMap();
  const recordByLease = new WeakMap();
  const records = new Set();

  const externalPublicationLive = (publication) => {
    if (typeof validatePublication !== 'function') return true;
    try {
      const validation = validatePublication(publication);
      return validation === true || validation === publication;
    } catch {
      return false;
    }
  };

  const validationResult = (valid, reason, record = null, leaseRecord = null) => Object.freeze({
    schema: COHERENT_SOLID_PRESENTATION_CONSUMER_LEASE_VALIDATION_SCHEMA,
    status: valid
      ? 'coherent-solid-presentation-consumer-lease-live'
      : 'blocked-coherent-solid-presentation-consumer-lease',
    valid,
    reason: valid ? null : reason,
    publicationGeneration:
      leaseRecord?.publicationGeneration ?? record?.publicationGeneration ?? null,
    admissionId: leaseRecord?.admissionId ?? record?.admissionId ?? null,
    leaseSerial: leaseRecord?.leaseSerial ?? null,
    consumerId: leaseRecord?.consumerId ?? null,
    publicationStatus: record?.status ?? 'unregistered'
  });

  function register(publication, { localRetainedRefs } = {}) {
    if (!publication || typeof publication !== 'object') {
      throw new TypeError('coherent-solid presentation lease registration requires a publication');
    }
    if (
      typeof localRetainedRefs?.acquirePresentationConsumer !== 'function'
      || typeof localRetainedRefs?.destroy !== 'function'
    ) {
      throw new TypeError(
        'coherent-solid publication retained refs require presentation acquisition and destroy hooks'
      );
    }
    const publicationGeneration = positiveU32(publication.publicationGeneration);
    const admissionId = positiveU32(publication.admissionId);
    if (publicationGeneration === null || admissionId === null) {
      throw new TypeError('coherent-solid publication requires positive generation and admission ids');
    }
    const existing = recordByPublication.get(publication);
    if (existing) {
      if (existing.localRetainedRefs !== localRetainedRefs) {
        throw new Error('coherent-solid publication identity was registered with different retained refs');
      }
      return snapshot(publication);
    }
    const record = {
      publication,
      localRetainedRefs,
      publicationGeneration,
      admissionId,
      device: publication.device ?? null,
      status: 'live',
      retirementReason: null,
      replacedByGeneration: null,
      producerReleaseRequested: false,
      leases: new Set(),
      acquiredLeaseCount: 0,
      releasedLeaseCount: 0
    };
    recordByPublication.set(publication, record);
    records.add(record);
    return snapshot(publication);
  }

  function validate(publication, lease) {
    const record = recordByPublication.get(publication);
    const leaseRecord = recordByLease.get(lease);
    if (!record) return validationResult(false, 'publication-not-registered');
    if (!leaseRecord || leaseRecord.record !== record || !record.leases.has(lease)) {
      return validationResult(false, 'lease-not-owned-by-publication', record, leaseRecord);
    }
    if (record.status !== 'live') {
      return validationResult(false, 'publication-retired', record, leaseRecord);
    }
    if (leaseRecord.released) {
      return validationResult(false, 'presentation-consumer-lease-released', record, leaseRecord);
    }
    if (
      leaseRecord.publicationGeneration !== record.publicationGeneration
      || leaseRecord.admissionId !== record.admissionId
      || leaseRecord.device !== record.device
    ) {
      return validationResult(false, 'presentation-consumer-lease-authority-mismatch', record, leaseRecord);
    }
    if (!externalPublicationLive(publication)) {
      return validationResult(false, 'publication-authority-no-longer-live', record, leaseRecord);
    }
    if (leaseRecord.residentToken?.validate?.() !== true) {
      return validationResult(false, 'resident-generation-consumer-token-invalid', record, leaseRecord);
    }
    return validationResult(true, null, record, leaseRecord);
  }

  function acquire(publication, {
    consumerId = 'native-webgpu-coherent-solid-presentation',
    device = publication?.device ?? null,
    publicationGeneration = publication?.publicationGeneration,
    admissionId = publication?.admissionId
  } = {}) {
    const record = recordByPublication.get(publication);
    if (
      !record
      || record.status !== 'live'
      || !externalPublicationLive(publication)
    ) {
      return null;
    }
    const expectedGeneration = positiveU32(publicationGeneration);
    const expectedAdmissionId = positiveU32(admissionId);
    if (
      expectedGeneration !== record.publicationGeneration
      || expectedAdmissionId !== record.admissionId
      || device !== record.device
    ) {
      return null;
    }
    const resolvedConsumerId = nonEmpty(consumerId, 'consumerId');
    const residentToken = record.localRetainedRefs.acquirePresentationConsumer({
      consumerId: resolvedConsumerId,
      publicationGeneration: record.publicationGeneration,
      admissionId: record.admissionId
    });
    if (!residentToken?.ready || residentToken.validate?.() !== true) {
      residentToken?.release?.();
      return null;
    }
    const leaseSerial = ++presentationLeaseSequence;
    let lease = null;
    const leaseRecord = {
      record,
      residentToken,
      leaseSerial,
      consumerId: resolvedConsumerId,
      publicationGeneration: record.publicationGeneration,
      admissionId: record.admissionId,
      device: record.device,
      released: false
    };
    lease = Object.freeze({
      schema: COHERENT_SOLID_PRESENTATION_CONSUMER_LEASE_SCHEMA,
      status: 'coherent-solid-presentation-consumer-lease-acquired',
      ready: true,
      leaseSerial,
      consumerId: resolvedConsumerId,
      publicationGeneration: record.publicationGeneration,
      admissionId: record.admissionId,
      device: record.device,
      residentCacheEntryId: residentToken.cacheEntryId ?? null,
      residentSlotIndex: residentToken.slotIndex ?? null,
      validate() {
        return validate(publication, lease);
      },
      release() {
        if (leaseRecord.released) return false;
        leaseRecord.released = true;
        record.leases.delete(lease);
        record.releasedLeaseCount += 1;
        residentToken.release();
        return true;
      }
    });
    record.leases.add(lease);
    recordByLease.set(lease, leaseRecord);
    record.acquiredLeaseCount += 1;
    return lease;
  }

  function retire(publication, {
    reason = 'coherent-solid-publication-retired',
    replacedByGeneration = null,
    releaseConsumers = false
  } = {}) {
    const record = recordByPublication.get(publication);
    if (!record || record.status !== 'live') return false;
    record.status = 'retired';
    record.retirementReason = String(reason || 'coherent-solid-publication-retired');
    record.replacedByGeneration = positiveU32(replacedByGeneration);
    record.producerReleaseRequested = true;
    record.localRetainedRefs.destroy();
    if (releaseConsumers) {
      for (const lease of [...record.leases]) lease.release();
    }
    return true;
  }

  function snapshot(publication) {
    const record = recordByPublication.get(publication);
    if (!record) return null;
    return Object.freeze({
      schema: 'peercompute.ulg.coherent-solid-presentation-lease-registry-evidence.v0',
      status: record.status === 'live'
        ? 'coherent-solid-publication-presentation-live'
        : 'coherent-solid-publication-presentation-retired',
      publicationGeneration: record.publicationGeneration,
      admissionId: record.admissionId,
      activeConsumerCount: record.leases.size,
      acquiredLeaseCount: record.acquiredLeaseCount,
      releasedLeaseCount: record.releasedLeaseCount,
      producerReleaseRequested: record.producerReleaseRequested,
      retirementReason: record.retirementReason,
      replacedByGeneration: record.replacedByGeneration
    });
  }

  return Object.freeze({
    schema: 'peercompute.ulg.coherent-solid-presentation-lease-registry.v0',
    status: 'coherent-solid-presentation-lease-registry-ready',
    register,
    acquire,
    validate,
    retire,
    snapshot,
    terminateDevice(device, {
      reason = 'coherent-solid-presentation-device-lost'
    } = {}) {
      let terminatedPublicationCount = 0;
      for (const record of records) {
        if (record.device !== device) continue;
        if (record.status === 'live' && retire(record.publication, {
          reason,
          releaseConsumers: true
        })) {
          terminatedPublicationCount += 1;
          continue;
        }
        const activeLeases = [...record.leases];
        for (const lease of activeLeases) lease.release();
        if (activeLeases.length > 0) terminatedPublicationCount += 1;
      }
      return terminatedPublicationCount;
    },
    isLive(publication) {
      const record = recordByPublication.get(publication);
      return Boolean(record?.status === 'live' && externalPublicationLive(publication));
    }
  });
}
