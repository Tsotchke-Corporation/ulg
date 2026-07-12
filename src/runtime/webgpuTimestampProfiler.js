export const ULG_WEBGPU_TIMESTAMP_PROFILE_SCHEMA =
  'peercompute.ulg.webgpu-timestamp-profile.v0';
export const ULG_WEBGPU_ALLOCATION_EVIDENCE_SCHEMA =
  'peercompute.ulg.webgpu-allocation-evidence.v0';

const TIMESTAMP_QUERY_FEATURE = 'timestamp-query';
const TIMESTAMP_BYTES = BigUint64Array.BYTES_PER_ELEMENT;
export const WEBGPU_TIMESTAMP_QUERY_SET_MAX_QUERIES = 4096;
export const WEBGPU_TIMESTAMP_PROFILE_MAX_SPANS =
  WEBGPU_TIMESTAMP_QUERY_SET_MAX_QUERIES / 2;
const GPU_BUFFER_USAGE = {
  MAP_READ: globalThis.GPUBufferUsage?.MAP_READ ?? 1,
  COPY_SRC: globalThis.GPUBufferUsage?.COPY_SRC ?? 4,
  COPY_DST: globalThis.GPUBufferUsage?.COPY_DST ?? 8,
  QUERY_RESOLVE: globalThis.GPUBufferUsage?.QUERY_RESOLVE ?? 512
};
const GPU_MAP_MODE = {
  READ: globalThis.GPUMapMode?.READ ?? 1
};

function nowMs() {
  return typeof globalThis.performance?.now === 'function'
    ? globalThis.performance.now()
    : Date.now();
}

function featureSetHas(features, name) {
  if (!features) return false;
  if (typeof features.has === 'function') return features.has(name);
  try {
    return [...features].includes(name);
  } catch {
    return false;
  }
}

function unavailableProfile({ requested, label, status, reason }) {
  return {
    schema: ULG_WEBGPU_TIMESTAMP_PROFILE_SCHEMA,
    requested,
    label,
    status,
    reason,
    feature: TIMESTAMP_QUERY_FEATURE,
    timestampUnit: 'nanoseconds',
    queryCapacity: 0,
    queryCount: 0,
    spanCount: 0,
    skippedSpanCount: 0,
    validSpanCount: 0,
    invalidSpanCount: 0,
    spans: [],
    stageTotals: {},
    resolveBufferByteLength: 0,
    readbackBufferByteLength: 0,
    mappedByteLength: 0,
    mapAsyncWaitMs: null
  };
}

export function webGpuTimestampQueryCapability(device, { requested = false } = {}) {
  if (!requested) {
    return {
      requested: false,
      supported: featureSetHas(device?.features, TIMESTAMP_QUERY_FEATURE),
      status: 'not-requested',
      reason: 'GPU timestamp profiling is diagnostic and was not requested'
    };
  }
  if (!featureSetHas(device?.features, TIMESTAMP_QUERY_FEATURE)) {
    return {
      requested: true,
      supported: false,
      status: 'unsupported',
      reason: 'device feature timestamp-query is not enabled'
    };
  }
  const missingMethods = [
    typeof device?.createQuerySet === 'function' ? null : 'device.createQuerySet',
    typeof device?.createBuffer === 'function' ? null : 'device.createBuffer'
  ].filter(Boolean);
  if (missingMethods.length > 0) {
    return {
      requested: true,
      supported: false,
      status: 'unsupported-api',
      reason: `missing ${missingMethods.join(', ')}`
    };
  }
  return {
    requested: true,
    supported: true,
    status: 'available',
    reason: 'timestamp-query is enabled on the resident device'
  };
}

export function summarizeWebGpuBufferAllocations(entries = [], {
  scope = 'webgpu-submission',
  includeBufferRows = true
} = {}) {
  const seen = new Set();
  const rows = [];
  let ownedBufferCount = 0;
  let borrowedBufferCount = 0;
  let createdThisSubmissionBufferCount = 0;
  let persistentWorkspaceBufferCount = 0;
  let transientSubmissionBufferCount = 0;
  let knownByteLengthBufferCount = 0;
  let allocatedByteLength = 0;
  let createdThisSubmissionByteLength = 0;
  let persistentWorkspaceByteLength = 0;
  let transientSubmissionByteLength = 0;
  let borrowedByteLength = 0;
  for (const entry of entries || []) {
    const buffer = entry?.buffer || entry;
    if (!buffer || seen.has(buffer)) continue;
    seen.add(buffer);
    const size = Number(buffer.size ?? buffer.byteLength ?? entry?.byteLength);
    const owned = entry?.owned !== false;
    const requestedLifetime = String(entry?.lifetime || '').trim();
    const lifetime = !owned
      ? 'borrowed'
      : (['persistent-workspace', 'transient-submission'].includes(requestedLifetime)
          ? requestedLifetime
          : 'transient-submission');
    const byteLength = Number.isFinite(size) && size >= 0 ? Math.round(size) : null;
    const createdThisSubmission = owned && (
      entry?.createdThisSubmission ?? lifetime !== 'persistent-workspace'
    );
    if (owned) ownedBufferCount += 1;
    else borrowedBufferCount += 1;
    if (createdThisSubmission) createdThisSubmissionBufferCount += 1;
    if (lifetime === 'persistent-workspace') persistentWorkspaceBufferCount += 1;
    if (lifetime === 'transient-submission') transientSubmissionBufferCount += 1;
    if (byteLength !== null) {
      knownByteLengthBufferCount += 1;
      if (owned) allocatedByteLength += byteLength;
      else borrowedByteLength += byteLength;
      if (createdThisSubmission) createdThisSubmissionByteLength += byteLength;
      if (lifetime === 'persistent-workspace') persistentWorkspaceByteLength += byteLength;
      if (lifetime === 'transient-submission') transientSubmissionByteLength += byteLength;
    }
    if (includeBufferRows) {
      rows.push({
        role: String(entry?.role || buffer.label || 'unnamed-buffer'),
        label: buffer.label ?? null,
        byteLength,
        owned,
        lifetime,
        createdThisSubmission
      });
    }
  }
  const bufferCount = seen.size;
  return {
    schema: ULG_WEBGPU_ALLOCATION_EVIDENCE_SCHEMA,
    scope,
    bufferCount,
    ownedBufferCount,
    borrowedBufferCount,
    createdThisSubmissionBufferCount,
    persistentWorkspaceBufferCount,
    transientSubmissionBufferCount,
    knownByteLengthBufferCount,
    unknownByteLengthBufferCount: bufferCount - knownByteLengthBufferCount,
    allocatedByteLength,
    createdThisSubmissionByteLength,
    persistentWorkspaceByteLength,
    transientSubmissionByteLength,
    borrowedByteLength,
    bufferRowsIncluded: includeBufferRows,
    bufferRowsOmittedCount: includeBufferRows ? 0 : bufferCount,
    buffers: rows
  };
}

export function createWebGpuTimestampProfiler(device, {
  requested = false,
  label = 'webgpu-submission',
  maxSpans = 64
} = {}) {
  const capability = webGpuTimestampQueryCapability(device, { requested });
  const normalizedMaxSpans = Math.max(
    1,
    Math.min(WEBGPU_TIMESTAMP_PROFILE_MAX_SPANS, Math.round(Number(maxSpans) || 1))
  );
  if (!capability.supported) {
    const profile = unavailableProfile({
      requested: capability.requested,
      label,
      status: capability.status,
      reason: capability.reason
    });
    return {
      active: false,
      capability,
      profile,
      beginComputePassDescriptor(spanLabel) {
        return { label: String(spanLabel || 'compute-pass') };
      },
      encodeResolve() {
        return false;
      },
      async read() {
        return profile;
      },
      allocationEntries() {
        return [];
      },
      destroy() {}
    };
  }

  const queryCapacity = normalizedMaxSpans * 2;
  const bufferByteLength = queryCapacity * TIMESTAMP_BYTES;
  let querySet;
  let resolveBuffer;
  let readbackBuffer;
  try {
    querySet = device.createQuerySet({
      label: `${label}-timestamp-queries`,
      type: 'timestamp',
      count: queryCapacity
    });
    resolveBuffer = device.createBuffer({
      label: `${label}-timestamp-resolve`,
      size: bufferByteLength,
      usage: GPU_BUFFER_USAGE.QUERY_RESOLVE | GPU_BUFFER_USAGE.COPY_SRC
    });
    readbackBuffer = device.createBuffer({
      label: `${label}-timestamp-readback`,
      size: bufferByteLength,
      usage: GPU_BUFFER_USAGE.COPY_DST | GPU_BUFFER_USAGE.MAP_READ
    });
  } catch (error) {
    querySet?.destroy?.();
    resolveBuffer?.destroy?.();
    readbackBuffer?.destroy?.();
    const profile = unavailableProfile({
      requested: true,
      label,
      status: 'allocation-failed',
      reason: error instanceof Error ? error.message : String(error)
    });
    return {
      active: false,
      capability: { ...capability, supported: false, status: 'allocation-failed' },
      profile,
      beginComputePassDescriptor(spanLabel) {
        return { label: String(spanLabel || 'compute-pass') };
      },
      encodeResolve() {
        return false;
      },
      async read() {
        return profile;
      },
      allocationEntries() {
        return [];
      },
      destroy() {}
    };
  }

  const spans = [];
  let skippedSpanCount = 0;
  let resolvedQueryCount = 0;
  let destroyed = false;
  let finalProfile = null;

  const destroy = () => {
    if (destroyed) return;
    destroyed = true;
    querySet.destroy?.();
    resolveBuffer.destroy?.();
    readbackBuffer.destroy?.();
  };

  return {
    active: true,
    capability,
    beginComputePassDescriptor(spanLabel, metadata = {}) {
      const normalizedLabel = String(spanLabel || 'compute-pass');
      if (spans.length >= normalizedMaxSpans) {
        skippedSpanCount += 1;
        return { label: normalizedLabel };
      }
      const beginningOfPassWriteIndex = spans.length * 2;
      const endOfPassWriteIndex = beginningOfPassWriteIndex + 1;
      spans.push({
        label: normalizedLabel,
        beginningOfPassWriteIndex,
        endOfPassWriteIndex,
        metadata: { ...metadata }
      });
      return {
        label: normalizedLabel,
        timestampWrites: {
          querySet,
          beginningOfPassWriteIndex,
          endOfPassWriteIndex
        }
      };
    },
    encodeResolve(encoder) {
      const queryCount = spans.length * 2;
      if (queryCount === 0) return false;
      if (typeof encoder?.resolveQuerySet !== 'function'
        || typeof encoder?.copyBufferToBuffer !== 'function') {
        throw new TypeError('timestamp profiling requires resolveQuerySet and copyBufferToBuffer');
      }
      encoder.resolveQuerySet(querySet, 0, queryCount, resolveBuffer, 0);
      encoder.copyBufferToBuffer(resolveBuffer, 0, readbackBuffer, 0, queryCount * TIMESTAMP_BYTES);
      resolvedQueryCount = queryCount;
      return true;
    },
    async read() {
      if (finalProfile) return finalProfile;
      if (resolvedQueryCount === 0) {
        finalProfile = {
          ...unavailableProfile({
            requested: true,
            label,
            status: 'no-profiled-passes',
            reason: 'no timestamp spans were encoded'
          }),
          queryCapacity,
          skippedSpanCount
        };
        destroy();
        return finalProfile;
      }
      const mappedByteLength = resolvedQueryCount * TIMESTAMP_BYTES;
      const mapStartedMs = nowMs();
      try {
        await readbackBuffer.mapAsync(GPU_MAP_MODE.READ, 0, mappedByteLength);
        const mapAsyncWaitMs = Math.max(0, nowMs() - mapStartedMs);
        const mapped = readbackBuffer.getMappedRange(0, mappedByteLength);
        const copy = new Uint8Array(mappedByteLength);
        copy.set(new Uint8Array(mapped, 0, mappedByteLength));
        const timestamps = new BigUint64Array(copy.buffer);
        const measuredSpans = spans.map((span) => {
          const beginNs = timestamps[span.beginningOfPassWriteIndex];
          const endNs = timestamps[span.endOfPassWriteIndex];
          const valid = endNs >= beginNs && (beginNs !== 0n || endNs !== 0n);
          const durationNs = valid ? Number(endNs - beginNs) : null;
          return {
            label: span.label,
            metadata: span.metadata,
            beginningOfPassWriteIndex: span.beginningOfPassWriteIndex,
            endOfPassWriteIndex: span.endOfPassWriteIndex,
            valid,
            durationNs,
            durationMs: durationNs === null ? null : durationNs / 1e6
          };
        });
        const stageTotals = {};
        for (const span of measuredSpans) {
          if (!stageTotals[span.label]) {
            stageTotals[span.label] = {
              spanCount: 0,
              validSpanCount: 0,
              totalNs: 0,
              totalMs: 0,
              meanMs: null,
              minMs: null,
              maxMs: null
            };
          }
          const aggregate = stageTotals[span.label];
          aggregate.spanCount += 1;
          if (!span.valid) continue;
          aggregate.validSpanCount += 1;
          aggregate.totalNs += span.durationNs;
          aggregate.totalMs = aggregate.totalNs / 1e6;
          aggregate.meanMs = aggregate.totalMs / aggregate.validSpanCount;
          aggregate.minMs = aggregate.minMs === null
            ? span.durationMs
            : Math.min(aggregate.minMs, span.durationMs);
          aggregate.maxMs = aggregate.maxMs === null
            ? span.durationMs
            : Math.max(aggregate.maxMs, span.durationMs);
        }
        const validSpanCount = measuredSpans.filter((span) => span.valid).length;
        const complete = validSpanCount === measuredSpans.length && skippedSpanCount === 0;
        finalProfile = {
          schema: ULG_WEBGPU_TIMESTAMP_PROFILE_SCHEMA,
          requested: true,
          label,
          status: complete
            ? 'timestamp-profile-complete'
            : 'timestamp-profile-partial',
          reason: complete
            ? 'all encoded timestamp spans resolved'
            : (skippedSpanCount > 0
              ? 'timestamp query capacity was exceeded'
              : 'one or more timestamp spans were reset or non-monotonic'),
          feature: TIMESTAMP_QUERY_FEATURE,
          timestampUnit: 'nanoseconds',
          queryCapacity,
          queryCount: resolvedQueryCount,
          spanCount: measuredSpans.length,
          skippedSpanCount,
          validSpanCount,
          invalidSpanCount: measuredSpans.length - validSpanCount,
          spans: measuredSpans,
          stageTotals,
          resolveBufferByteLength: bufferByteLength,
          readbackBufferByteLength: bufferByteLength,
          mappedByteLength,
          mapAsyncWaitMs
        };
        readbackBuffer.unmap?.();
      } catch (error) {
        finalProfile = {
          ...unavailableProfile({
            requested: true,
            label,
            status: 'timestamp-readback-failed',
            reason: error instanceof Error ? error.message : String(error)
          }),
          queryCapacity,
          queryCount: resolvedQueryCount,
          spanCount: spans.length,
          skippedSpanCount,
          resolveBufferByteLength: bufferByteLength,
          readbackBufferByteLength: bufferByteLength,
          mappedByteLength,
          mapAsyncWaitMs: Math.max(0, nowMs() - mapStartedMs)
        };
      } finally {
        destroy();
      }
      return finalProfile;
    },
    allocationEntries() {
      return [
        { role: 'timestamp-resolve', buffer: resolveBuffer, owned: true },
        { role: 'timestamp-readback', buffer: readbackBuffer, owned: true }
      ];
    },
    destroy
  };
}
