function closureIndexKey({ closureKind, inputHash, methodHash } = {}) {
  return [closureKind, inputHash, methodHash].map((value) => String(value || '')).join('|');
}

function isObject(value) {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}

function normalizeRange(value) {
  if (Array.isArray(value) && value.length >= 2) {
    const min = Number(value[0]);
    const max = Number(value[1]);
    return Number.isFinite(min) && Number.isFinite(max) ? [Math.min(min, max), Math.max(min, max)] : null;
  }
  if (isObject(value)) {
    const min = Number(value.min ?? value.minimum ?? value.range?.[0]);
    const max = Number(value.max ?? value.maximum ?? value.range?.[1]);
    return Number.isFinite(min) && Number.isFinite(max) ? [Math.min(min, max), Math.max(min, max)] : null;
  }
  return null;
}

function collectValidityRanges(validity = {}) {
  const ranges = new Map();
  for (const [axis, range] of Object.entries(validity || {})) {
    const normalized = normalizeRange(range);
    if (normalized) ranges.set(axis, normalized);
  }
  const axisEntries = Array.isArray(validity.axes)
    ? validity.axes
    : (Array.isArray(validity.axisRanges) ? validity.axisRanges : []);
  for (const axis of axisEntries) {
    if (!isObject(axis)) continue;
    const name = axis.name || axis.axis || axis.id;
    const normalized = normalizeRange(axis);
    if (name && normalized) ranges.set(name, normalized);
  }
  return ranges;
}

export class ClosureRegistry {
  constructor({ artifactCache } = {}) {
    if (!artifactCache) {
      throw new Error('ClosureRegistry requires an artifactCache');
    }
    this.artifactCache = artifactCache;
    this.records = new Map();
    this.index = new Map();
    this.listeners = new Set();
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  async store(closureArtifact) {
    this.#validateClosureArtifact(closureArtifact);
    const ref = await this.artifactCache.put(closureArtifact);
    const key = closureIndexKey(this.#identityFor(closureArtifact));
    const record = {
      ref,
      key,
      closure: closureArtifact,
      status: 'valid',
      storedAt: Date.now()
    };
    this.records.set(ref.uri, record);
    const bucket = this.index.get(key) || [];
    bucket.push(record);
    this.index.set(key, bucket);
    this.#emit({ type: 'closure-stored', ref, key, closureKind: closureArtifact.closureKind });
    return ref;
  }

  async resolve({ closureKind, inputHash, methodHash, point = null } = {}) {
    const key = closureIndexKey({ closureKind, inputHash, methodHash });
    const candidates = [...(this.index.get(key) || [])].reverse()
      .filter((record) => record.status !== 'invalidated');
    if (candidates.length === 0) {
      const miss = { ref: null, closure: null, validity: 'miss', reason: 'closure-cache-miss' };
      this.#emit({ type: 'closure-miss', key, query: { closureKind, inputHash, methodHash, point } });
      return miss;
    }
    for (const record of candidates) {
      const inRange = this.isWithinValidity(record.closure, point);
      const result = {
        ref: record.ref,
        closure: record.closure,
        validity: inRange ? 'in-range' : 'out-of-range',
        reason: inRange ? null : 'closure-validity-out-of-range'
      };
      this.#emit({
        type: inRange ? 'closure-hit' : 'closure-out-of-range',
        ref: record.ref,
        key,
        point,
        validity: result.validity
      });
      return result;
    }
    return { ref: null, closure: null, validity: 'miss', reason: 'closure-cache-miss' };
  }

  isWithinValidity(closure, point = null) {
    if (!point) return true;
    const ranges = collectValidityRanges(closure?.validity || {});
    if (ranges.size === 0) return true;
    for (const [axis, range] of ranges.entries()) {
      const value = Number(point[axis]);
      if (!Number.isFinite(value)) return false;
      if (value < range[0] || value > range[1]) return false;
    }
    return true;
  }

  async invalidate({ ref, reason = 'manual-invalidated' } = {}) {
    const uri = typeof ref === 'string' ? ref : ref?.uri;
    const record = this.records.get(uri);
    if (!record) {
      return null;
    }
    record.status = 'invalidated';
    record.invalidatedAt = Date.now();
    record.invalidatedReason = reason;
    this.#emit({ type: 'closure-invalidated', ref: record.ref, reason });
    return {
      ref: record.ref,
      status: record.status,
      reason
    };
  }

  list() {
    return [...this.records.values()].map((record) => ({
      ref: record.ref,
      closureKind: record.closure.closureKind,
      inputHash: record.closure.inputHash || record.closure.provenance?.inputHash || null,
      methodHash: record.closure.methodHash || record.closure.provenance?.methodHash || null,
      status: record.status,
      invalidatedReason: record.invalidatedReason || null
    }));
  }

  #identityFor(closureArtifact) {
    return {
      closureKind: closureArtifact.closureKind,
      inputHash: closureArtifact.inputHash || closureArtifact.provenance?.inputHash,
      methodHash: closureArtifact.methodHash || closureArtifact.provenance?.methodHash
    };
  }

  #validateClosureArtifact(closureArtifact) {
    if (!isObject(closureArtifact)) {
      throw new TypeError('Closure artifact must be an object');
    }
    for (const field of ['closureId', 'closureKind', 'execution', 'validity', 'provenance']) {
      if (closureArtifact[field] == null) {
        throw new Error(`Closure artifact missing required field: ${field}`);
      }
    }
    const identity = this.#identityFor(closureArtifact);
    if (!identity.inputHash || !identity.methodHash) {
      throw new Error('Closure artifact must carry inputHash and methodHash directly or in provenance');
    }
  }

  #emit(event) {
    for (const listener of this.listeners) {
      listener(event);
    }
  }
}
