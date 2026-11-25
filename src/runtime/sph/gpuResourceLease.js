// Explicit GPU Resource Lease Tracker (plan/ss-law-architecture-assessment.md).
//
// Replaces informal "delete from my own ledger and assume someone else frees it"
// ownership conventions with explicit, single-owner resource leases. Any resource
// that is neither consumed nor released by frame/step boundary triggers a loud
// ERR_GPU_RESOURCE_LEASE_LEAK assertion on step one.

export const ULG_GPU_RESOURCE_LEASE_SCOPE_SCHEMA =
  'peercompute.ulg.gpu-resource-lease-scope.v1';

const LEASE_BRAND = Symbol('ulg.gpuResourceLease');

function requireNonEmptyString(value, name) {
  const s = String(value ?? '').trim();
  if (!s) throw new TypeError(`${name} must be a non-empty string`);
  return s;
}

export function createGpuResourceLeaseScope({
  scopeId,
  epoch = 0
} = {}) {
  const id = requireNonEmptyString(scopeId, 'scopeId');
  let nextLeaseOrdinal = 1;
  const records = new Map();

  function getRecord(lease, action) {
    if (!lease || lease[LEASE_BRAND] !== true || !records.has(lease.leaseId)) {
      const err = new TypeError(`${id}: ${action} received an unknown or foreign GPU resource lease`);
      err.code = 'ERR_GPU_LEASE_UNKNOWN';
      throw err;
    }
    return records.get(lease.leaseId);
  }

  return Object.freeze({
    schema: ULG_GPU_RESOURCE_LEASE_SCOPE_SCHEMA,
    scopeId: id,
    epoch,

    issue(resource, {
      label,
      producer,
      expectedConsumers = [],
      onRelease = null
    } = {}) {
      if (resource == null) {
        throw new TypeError(`${id}: cannot issue GPU resource lease for null/undefined resource`);
      }
      const resolvedLabel = requireNonEmptyString(label, 'lease.label');
      const resolvedProducer = requireNonEmptyString(producer, 'lease.producer');
      const consumers = Array.isArray(expectedConsumers)
        ? Object.freeze([...new Set(expectedConsumers.map((c) => String(c ?? '').trim()).filter(Boolean))])
        : Object.freeze([]);
      if (onRelease != null && typeof onRelease !== 'function') {
        throw new TypeError(`${id}: lease.onRelease must be a function when provided`);
      }
      const leaseId = `${id}#${nextLeaseOrdinal}`;
      nextLeaseOrdinal += 1;
      const token = Object.freeze({
        [LEASE_BRAND]: true,
        leaseId,
        scopeId: id,
        label: resolvedLabel,
        producer: resolvedProducer
      });
      records.set(leaseId, {
        token,
        resource,
        label: resolvedLabel,
        producer: resolvedProducer,
        owner: resolvedProducer,
        expectedConsumers: consumers,
        onRelease,
        state: 'live',
        consumedBy: null,
        releasedBy: null,
        transfers: []
      });
      return token;
    },

    transfer(lease, { from, to } = {}) {
      const rec = getRecord(lease, 'transfer');
      if (rec.state !== 'live') {
        const err = new Error(`${id}: cannot transfer lease "${rec.label}" in state "${rec.state}"`);
        err.code = 'ERR_GPU_LEASE_NOT_LIVE';
        throw err;
      }
      const fromOwner = requireNonEmptyString(from, 'transfer.from');
      const toOwner = requireNonEmptyString(to, 'transfer.to');
      if (rec.owner !== fromOwner) {
        const err = new Error(
          `${id}: transfer owner mismatch on "${rec.label}" (expected "${rec.owner}", got "${fromOwner}")`
        );
        err.code = 'ERR_GPU_LEASE_OWNER_MISMATCH';
        throw err;
      }
      rec.owner = toOwner;
      rec.transfers.push(Object.freeze({ from: fromOwner, to: toOwner }));
      return lease;
    },

    consume(lease, consumer) {
      const rec = getRecord(lease, 'consume');
      const consumerName = requireNonEmptyString(consumer, 'consumer');
      if (rec.state === 'consumed') {
        const err = new Error(
          `${id}: double-consume of GPU lease "${rec.label}" (already consumed by "${rec.consumedBy}", retried by "${consumerName}")`
        );
        err.code = 'ERR_GPU_LEASE_DOUBLE_CONSUME';
        throw err;
      }
      if (rec.state !== 'live') {
        const err = new Error(`${id}: cannot consume lease "${rec.label}" in state "${rec.state}"`);
        err.code = 'ERR_GPU_LEASE_NOT_LIVE';
        throw err;
      }
      if (rec.expectedConsumers.length > 0 && !rec.expectedConsumers.includes(consumerName)) {
        const err = new Error(
          `${id}: unauthorized consumer "${consumerName}" for lease "${rec.label}" (expected: ${rec.expectedConsumers.join(', ')})`
        );
        err.code = 'ERR_GPU_LEASE_UNAUTHORIZED_CONSUMER';
        throw err;
      }
      rec.state = 'consumed';
      rec.consumedBy = consumerName;
      rec.owner = consumerName;
      return rec.resource;
    },

    release(lease, { by = null, allowAlreadyReleased = false } = {}) {
      const rec = getRecord(lease, 'release');
      if (rec.state === 'released') {
        if (allowAlreadyReleased) return false;
        const err = new Error(`${id}: double-release of GPU lease "${rec.label}"`);
        err.code = 'ERR_GPU_LEASE_DOUBLE_RELEASE';
        throw err;
      }
      rec.state = 'released';
      rec.releasedBy = by ? String(by) : rec.owner;
      if (rec.onRelease) {
        rec.onRelease(rec.resource);
      }
      return true;
    },

    liveLeases() {
      const live = [];
      for (const rec of records.values()) {
        if (rec.state === 'live') {
          live.push(Object.freeze({
            leaseId: rec.token.leaseId,
            label: rec.label,
            producer: rec.producer,
            owner: rec.owner,
            expectedConsumers: rec.expectedConsumers,
            transfers: Object.freeze([...rec.transfers])
          }));
        }
      }
      return Object.freeze(live);
    },

    snapshot() {
      let live = 0;
      let consumed = 0;
      let released = 0;
      for (const rec of records.values()) {
        if (rec.state === 'live') live += 1;
        else if (rec.state === 'consumed') consumed += 1;
        else if (rec.state === 'released') released += 1;
      }
      return Object.freeze({
        schema: ULG_GPU_RESOURCE_LEASE_SCOPE_SCHEMA,
        scopeId: id,
        epoch,
        totalIssued: records.size,
        live,
        consumed,
        released
      });
    },

    assertDrained({ requireAllReleased = false } = {}) {
      const leaks = [];
      for (const rec of records.values()) {
        if (rec.state === 'live' || (requireAllReleased && rec.state !== 'released')) {
          leaks.push(Object.freeze({
            leaseId: rec.token.leaseId,
            label: rec.label,
            state: rec.state,
            producer: rec.producer,
            owner: rec.owner,
            expectedConsumers: rec.expectedConsumers
          }));
        }
      }
      if (leaks.length > 0) {
        const detail = leaks.map((l) => `${l.label}(state=${l.state}, owner=${l.owner})`).join(', ');
        const err = new Error(`${id}: unreleased GPU resource lease leak detected: ${detail}`);
        err.code = 'ERR_GPU_RESOURCE_LEASE_LEAK';
        err.leaks = Object.freeze(leaks);
        throw err;
      }
      return this.snapshot();
    }
  });
}
