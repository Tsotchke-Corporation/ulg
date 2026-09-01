/**
 * GPU timestamp profiling for the resident SPH compute sequence.
 *
 * Why this exists. The resident path reports stageMs values that are host
 * enqueue durations, and for the fused sequence most of them are not even that:
 * p2gGridProjection, gridUpdate, g2pReconstruction, thermalStep, reactionStep,
 * mechanicsRefresh and phaseCarrierTransfer are assigned a literal 0 because
 * their work is encoded inside fusedMechanicsSequence. The frame therefore
 * reports one lump number and a row of zeros, which cannot attribute cost to a
 * stage and cannot tell encode time from execution time.
 *
 * `plan/todo/sol-critic.md` makes this a gate: no kernel optimisation should
 * begin before real GPU timing exists, because otherwise every measurement is
 * of the host timeline rather than the device.
 *
 * This module is deliberately inert unless the device was created with the
 * 'timestamp-query' feature. It never throws on an unprofilable device, and it
 * never silently reports host time as if it were GPU time -- callers get a
 * status string saying which case they are in.
 */

const TIMESTAMP_QUERY_FEATURE = 'timestamp-query';
const NS_PER_MS = 1e6;
const TIMESTAMP_QUERY_RESOLVE_ALIGNMENT = 256;

// Same pattern as the other GPU kernels here: the WebGPU globals do not exist
// under node, so the numeric fallbacks keep this module importable in tests.
const GPU_BUFFER_USAGE = {
  MAP_READ: globalThis.GPUBufferUsage?.MAP_READ ?? 1,
  COPY_SRC: globalThis.GPUBufferUsage?.COPY_SRC ?? 4,
  COPY_DST: globalThis.GPUBufferUsage?.COPY_DST ?? 8,
  QUERY_RESOLVE: globalThis.GPUBufferUsage?.QUERY_RESOLVE ?? 512
};

const GPU_MAP_MODE = {
  READ: globalThis.GPUMapMode?.READ ?? 1
};

function deviceSupportsTimestampQuery(device) {
  const features = device?.features;
  if (!features) return false;
  if (typeof features.has === 'function') return features.has(TIMESTAMP_QUERY_FEATURE);
  return Array.from(features).includes(TIMESTAMP_QUERY_FEATURE);
}

/**
 * Encode one portable timestamp-query boundary marker.
 *
 * WebGPU does not expose `GPUCommandEncoder.writeTimestamp`. An empty compute
 * pass is the portable way to place a timestamp around an arbitrary sequence
 * without changing any of the production pass descriptors:
 *
 * - a start marker writes at the end of the empty marker pass;
 * - an end marker writes at the beginning of the empty marker pass.
 *
 * Production commands encoded between those two marker passes are therefore
 * bracketed on the same command encoder. The same markers can also be submitted
 * as separate command buffers to measure an ordered queue interval.
 */
export function encodeSphGpuTimestampMarkerPass(encoder, {
  querySet,
  queryIndex,
  boundary,
  label = 'ulg-sph-gpu-timestamp-marker'
} = {}) {
  if (typeof encoder?.beginComputePass !== 'function') {
    throw new TypeError(
      'GPU timestamp marker requires GPUCommandEncoder.beginComputePass'
    );
  }
  if (!querySet) {
    throw new TypeError('GPU timestamp marker requires a timestamp query set');
  }
  if (!Number.isInteger(queryIndex) || queryIndex < 0) {
    throw new RangeError(
      'GPU timestamp marker queryIndex must be a non-negative integer'
    );
  }
  if (boundary !== 'start' && boundary !== 'end') {
    throw new TypeError(
      'GPU timestamp marker boundary must be "start" or "end"'
    );
  }
  const timestampWrites = boundary === 'start'
    ? { querySet, endOfPassWriteIndex: queryIndex }
    : { querySet, beginningOfPassWriteIndex: queryIndex };
  const descriptor = {
    label: String(label || 'ulg-sph-gpu-timestamp-marker'),
    timestampWrites
  };
  const pass = encoder.beginComputePass(descriptor);
  if (typeof pass?.end !== 'function') {
    throw new TypeError(
      'GPU timestamp marker compute pass does not expose end()'
    );
  }
  pass.end();
  return descriptor;
}

/**
 * @param {object} options
 * @param {GPUDevice} options.device
 * @param {boolean} [options.enabled] caller intent; false yields an inert profiler
 * @param {number} [options.capacity] maximum number of profiled passes per frame
 * @param {string} [options.label]
 */
export function createSphGpuTimestampProfiler({
  device = null,
  enabled = true,
  capacity = 64,
  label = 'ulg-sph-gpu-timestamps'
} = {}) {
  const requested = enabled === true;
  const supported = deviceSupportsTimestampQuery(device);
  const usable = Boolean(
    requested
    && supported
    && device
    && typeof device.createQuerySet === 'function'
  );
  const status = !requested
    ? 'gpu-timestamp-profiling-not-requested'
    : !supported
    ? 'gpu-timestamp-profiling-unsupported-by-device'
    : usable
    ? 'gpu-timestamp-profiling-active'
    : 'gpu-timestamp-profiling-unavailable';

  // Two timestamps per profiled pass: beginning and end.
  const slotCapacity = Math.max(1, Math.floor(capacity));
  const queryCapacity = slotCapacity * 2;

  let querySet = null;
  let resolveBuffer = null;
  let readBuffer = null;
  if (usable) {
    querySet = device.createQuerySet({
      label: `${label}-query-set`,
      type: 'timestamp',
      count: queryCapacity
    });
    resolveBuffer = device.createBuffer({
      label: `${label}-resolve`,
      size: queryCapacity * 8,
      usage: GPU_BUFFER_USAGE.QUERY_RESOLVE | GPU_BUFFER_USAGE.COPY_SRC
    });
    readBuffer = device.createBuffer({
      label: `${label}-read`,
      size: queryCapacity * 8,
      usage: GPU_BUFFER_USAGE.COPY_DST | GPU_BUFFER_USAGE.MAP_READ
    });
  }

  /** @type {{stage: string, beginIndex: number, endIndex: number}[]} */
  let slots = [];
  let overflowCount = 0;
  let readInFlight = false;

  /**
   * Timestamp writes for one compute pass descriptor. Returns null when
   * profiling is inert or capacity is exhausted, so callers can spread it
   * unconditionally:
   *
   *   encoder.beginComputePass({ label, ...profiler.passTimestamps('gridUpdate') })
   */
  const passTimestamps = (stage) => {
    if (!usable) return null;
    if (slots.length >= slotCapacity) {
      overflowCount += 1;
      return null;
    }
    const beginIndex = slots.length * 2;
    const endIndex = beginIndex + 1;
    slots.push({ stage: String(stage || `pass-${slots.length}`), beginIndex, endIndex });
    return {
      timestampWrites: {
        querySet,
        beginningOfPassWriteIndex: beginIndex,
        endOfPassWriteIndex: endIndex
      }
    };
  };

  /**
   * Spreadable form: always an object, empty when inert. Keeps call sites free
   * of conditionals.
   */
  const passDescriptorExtras = (stage) => passTimestamps(stage) ?? {};

  /**
   * Encode the resolve + copy. Must be called on the same encoder, after the
   * profiled passes and before submit.
   */
  const resolve = (encoder) => {
    if (!usable || slots.length === 0) return false;
    if (typeof encoder?.resolveQuerySet !== 'function') return false;
    // Buffers can only be resolved into while unmapped; a still-pending read
    // means the previous frame has not been consumed, so skip rather than
    // corrupt it.
    if (readInFlight) return false;
    const queryCount = slots.length * 2;
    encoder.resolveQuerySet(querySet, 0, queryCount, resolveBuffer, 0);
    encoder.copyBufferToBuffer(resolveBuffer, 0, readBuffer, 0, queryCount * 8);
    return true;
  };

  /**
   * Map and convert to per-stage milliseconds. Resolves to a record with a
   * status and, when active, a stage -> ms map. Never throws.
   */
  const read = async () => {
    if (!usable) return { status, stageGpuMs: null, overflowCount };
    if (slots.length === 0) {
      return { status: 'gpu-timestamp-profiling-no-passes', stageGpuMs: null, overflowCount };
    }
    if (readInFlight) {
      return { status: 'gpu-timestamp-profiling-read-in-flight', stageGpuMs: null, overflowCount };
    }
    readInFlight = true;
    try {
      await readBuffer.mapAsync(GPU_MAP_MODE.READ);
      const raw = new BigUint64Array(readBuffer.getMappedRange().slice(0));
      readBuffer.unmap();
      const stageGpuMs = {};
      let totalGpuMs = 0;
      for (const slot of slots) {
        const begin = raw[slot.beginIndex];
        const end = raw[slot.endIndex];
        // A zeroed or non-monotonic pair means the device did not write the
        // query (it is permitted to skip). Report null rather than a fake 0.
        if (begin == null || end == null || end <= begin) {
          if (!(slot.stage in stageGpuMs)) stageGpuMs[slot.stage] = null;
          continue;
        }
        const ms = Number(end - begin) / NS_PER_MS;
        stageGpuMs[slot.stage] = (stageGpuMs[slot.stage] ?? 0) + ms;
        totalGpuMs += ms;
      }
      return {
        status: 'gpu-timestamp-profiling-active',
        stageGpuMs,
        totalGpuMs,
        profiledPassCount: slots.length,
        overflowCount
      };
    } catch (error) {
      return {
        status: 'gpu-timestamp-profiling-read-failed',
        reason: String(error?.message || error),
        stageGpuMs: null,
        overflowCount
      };
    } finally {
      readInFlight = false;
    }
  };

  /** Clear per-frame slot assignments. Call at frame start. */
  const reset = () => {
    slots = [];
    overflowCount = 0;
  };

  const destroy = () => {
    querySet?.destroy?.();
    resolveBuffer?.destroy?.();
    readBuffer?.destroy?.();
    querySet = null;
    resolveBuffer = null;
    readBuffer = null;
    slots = [];
  };

  return {
    schema: 'peercompute.ulg.sph-gpu-timestamp-profiler.v0',
    status,
    enabled: usable,
    timestampQuerySupported: supported,
    timestampProfilingRequested: requested,
    slotCapacity,
    passTimestamps,
    passDescriptorExtras,
    resolve,
    read,
    reset,
    destroy,
    get profiledPassCount() { return slots.length; },
    get overflowCount() { return overflowCount; }
  };
}

/**
 * Stage names that the resident fused sequence currently reports as a literal
 * 0 because their work is encoded inside fusedMechanicsSequence. Exported so a
 * consumer can assert that a profiled frame actually attributed them, rather
 * than accepting the zeros as a measurement.
 */
export const SPH_FUSED_SEQUENCE_UNATTRIBUTED_STAGES = Object.freeze([
  'p2gGridProjection',
  'gridUpdate',
  'g2pReconstruction',
  'thermalStep',
  'reactionStep',
  'mechanicsRefresh',
  'phaseCarrierTransfer',
  'schroederFarForceDeltaFusion'
]);

/**
 * Adapter presenting the profiler as the `gpuTimestampRecorder` the runtime
 * already expects.
 *
 * That contract has 17 consumer modules and 51 call sites -- sphMlsMpmGpuStep,
 * webgpuRadixScanUnique, schroederSpatialEpochGpu and others -- and no
 * implementation anywhere. Every consumer guards on `active === true` and then
 * takes its inert branch, permanently, because nothing ever constructs a
 * recorder. This is the missing producer.
 *
 * `measureQueueStage` is the method that matters here. It wraps a stage and
 * measures GPU *completion* with a queue fence, which is the honest answer to
 * "how long did the device take", as opposed to the host enqueue time that
 * `stageMs` records and that made a 1.1 ms dense field build look plausible.
 *
 * Encoder spans stay inert by default. An explicit diagnostic request can
 * enable portable timestamp marker passes around the existing commands, then
 * resolve each pair on that same production encoder. This changes pass
 * topology and is therefore labeled instrumented/non-representative; it is
 * useful for relative dispatch attribution, never as a frame-rate result.
 *
 * Fences serialise the queue, so this is a diagnostic mode and must stay off by
 * default.
 */
export function createSphGpuQueueStageRecorder({
  device = null,
  enabled = true,
  encoderTimestampSpans = false,
  encoderSpanCapacity = 256,
  encoderSpanProducerPrefix = null,
  label = 'ulg-sph-gpu-queue-stage-recorder'
} = {}) {
  const usable = Boolean(enabled === true && device?.queue?.onSubmittedWorkDone);
  const timestampRequested = Boolean(
    enabled === true
    && encoderTimestampSpans === true
  );
  const timestampSupported = deviceSupportsTimestampQuery(device);
  const resolvedEncoderSpanCapacity = Math.max(
    1,
    Math.floor(Number(encoderSpanCapacity) || 256)
  );
  const resolvedEncoderSpanProducerPrefix =
    encoderSpanProducerPrefix == null
      ? null
      : String(encoderSpanProducerPrefix);
  const queryCapacity = resolvedEncoderSpanCapacity * 2;
  const timestampResolveBufferByteLength =
    resolvedEncoderSpanCapacity * TIMESTAMP_QUERY_RESOLVE_ALIGNMENT;
  const timestampReadBufferByteLength =
    queryCapacity * BigUint64Array.BYTES_PER_ELEMENT;
  let timestampQuerySet = null;
  let timestampResolveBuffer = null;
  let timestampReadBuffer = null;
  let encoderSpansUsable = Boolean(
    usable
    && timestampRequested
    && timestampSupported
    && typeof device?.createQuerySet === 'function'
    && typeof device?.createBuffer === 'function'
  );
  let encoderSpanFailureReason = null;
  if (encoderSpansUsable) {
    try {
      timestampQuerySet = device.createQuerySet({
        label: `${label}-encoder-span-query-set`,
        type: 'timestamp',
        count: queryCapacity
      });
      timestampResolveBuffer = device.createBuffer({
        label: `${label}-encoder-span-resolve`,
        size: timestampResolveBufferByteLength,
        usage: GPU_BUFFER_USAGE.QUERY_RESOLVE | GPU_BUFFER_USAGE.COPY_SRC
      });
      timestampReadBuffer = device.createBuffer({
        label: `${label}-encoder-span-read`,
        size: timestampReadBufferByteLength,
        usage: GPU_BUFFER_USAGE.COPY_DST | GPU_BUFFER_USAGE.MAP_READ
      });
    } catch (error) {
      encoderSpansUsable = false;
      encoderSpanFailureReason = String(error?.message || error);
      timestampQuerySet?.destroy?.();
      timestampResolveBuffer?.destroy?.();
      timestampReadBuffer?.destroy?.();
      timestampQuerySet = null;
      timestampResolveBuffer = null;
      timestampReadBuffer = null;
    }
  }

  /** @type {{stage: string, gpuMs: number, producerId: string|null}[]} */
  const queueSpans = [];
  /** @type {{stage: string, gpuMs: number|null, producerId: string|null, spanClass: string|null}[]} */
  const encoderSpans = [];
  const pendingEncoderSpans = [];
  let nextEncoderSpanSlot = 0;
  let encoderSpanOverflowCount = 0;
  let encoderSpanDiscardedCount = 0;
  let encoderSpanReadFailureCount = 0;
  let encoderSpanReadInFlight = null;
  let destroyed = false;

  const settlePendingEncoderSpans = () => {
    while (
      pendingEncoderSpans.length > 0
      && (pendingEncoderSpans[0].harvested || pendingEncoderSpans[0].discarded)
    ) {
      pendingEncoderSpans.shift();
    }
    if (pendingEncoderSpans.length === 0) nextEncoderSpanSlot = 0;
  };

  const harvestEncoderSpans = async () => {
    if (!encoderSpansUsable || destroyed) return false;
    if (encoderSpanReadInFlight) {
      await encoderSpanReadInFlight;
      return harvestEncoderSpans();
    }
    const batch = pendingEncoderSpans.filter((span) => (
      span.closed === true
      && span.discarded !== true
      && span.harvested !== true
    ));
    if (batch.length === 0) {
      settlePendingEncoderSpans();
      return false;
    }
    encoderSpanReadInFlight = (async () => {
      let mapped = false;
      try {
        await timestampReadBuffer.mapAsync(GPU_MAP_MODE.READ);
        mapped = true;
        const raw = new BigUint64Array(
          timestampReadBuffer.getMappedRange().slice(0)
        );
        timestampReadBuffer.unmap();
        mapped = false;
        for (const span of batch) {
          const begin = raw[span.beginIndex];
          const end = raw[span.endIndex];
          const gpuMs = begin != null && end != null && end > begin
            ? Number(end - begin) / NS_PER_MS
            : null;
          encoderSpans.push({
            stage: span.stage,
            producerId: span.producerId,
            spanClass: span.spanClass,
            gpuMs
          });
          span.harvested = true;
        }
      } catch (error) {
        if (mapped) {
          try {
            timestampReadBuffer.unmap();
          } catch {
            // Preserve the diagnostic read failure below.
          }
        }
        encoderSpanReadFailureCount += 1;
        encoderSpanFailureReason = String(error?.message || error);
        for (const span of batch) {
          encoderSpans.push({
            stage: span.stage,
            producerId: span.producerId,
            spanClass: span.spanClass,
            gpuMs: null
          });
          span.harvested = true;
        }
      } finally {
        settlePendingEncoderSpans();
      }
    })();
    try {
      await encoderSpanReadInFlight;
      return true;
    } finally {
      encoderSpanReadInFlight = null;
    }
  };

  const encoderStageSummary = () => {
    if (encoderSpans.length === 0) {
      return { stageGpuMs: null, stageGpuStats: null };
    }
    const stageGpuMs = {};
    const stageGpuStats = {};
    for (const span of encoderSpans) {
      const entry = stageGpuStats[span.stage] ?? (stageGpuStats[span.stage] = {
        totalMs: 0,
        count: 0,
        invalidCount: 0,
        maxMs: 0,
        meanMs: null
      });
      if (!Number.isFinite(span.gpuMs)) {
        entry.invalidCount += 1;
        if (!(span.stage in stageGpuMs)) stageGpuMs[span.stage] = null;
        continue;
      }
      entry.totalMs += span.gpuMs;
      entry.count += 1;
      entry.maxMs = Math.max(entry.maxMs, span.gpuMs);
      entry.meanMs = entry.totalMs / entry.count;
      stageGpuMs[span.stage] = entry.totalMs;
    }
    return { stageGpuMs, stageGpuStats };
  };

  const encoderTimestampProfile = () => {
    const { stageGpuMs, stageGpuStats } = encoderStageSummary();
    const validPassCount = encoderSpans.reduce(
      (count, span) => count + (Number.isFinite(span.gpuMs) ? 1 : 0),
      0
    );
    const pendingSpanCount = pendingEncoderSpans.reduce(
      (count, span) => count + (
        span.harvested !== true && span.discarded !== true ? 1 : 0
      ),
      0
    );
    const status = destroyed
      ? 'gpu-timestamp-encoder-stage-recorder-destroyed'
      : !timestampRequested
        ? 'gpu-timestamp-encoder-stage-profiling-not-requested'
        : !timestampSupported
          ? 'gpu-timestamp-encoder-stage-profiling-unsupported-by-device'
          : !encoderSpansUsable
            ? 'gpu-timestamp-encoder-stage-profiling-unavailable'
            : encoderSpanReadFailureCount > 0
              ? 'gpu-timestamp-encoder-stage-summary-read-failed'
              : encoderSpanDiscardedCount > 0
                ? 'gpu-timestamp-encoder-stage-summary-discarded'
                : encoderSpanOverflowCount > 0
                  ? 'gpu-timestamp-encoder-stage-summary-overflow'
                  : pendingSpanCount > 0
                    ? 'gpu-timestamp-encoder-stage-summary-pending'
                    : encoderSpans.length === 0
                      ? 'gpu-timestamp-encoder-stage-summary-no-spans'
                      : validPassCount !== encoderSpans.length
                        ? 'gpu-timestamp-encoder-stage-summary-invalid'
                        : 'gpu-timestamp-encoder-stage-summary-ready';
    return {
      schema: 'peercompute.ulg.sph-gpu-encoder-stage-profile.v0',
      status,
      measurementMode: 'instrumented-dispatch-granular-nonrepresentative',
      timestampUnit: 'milliseconds',
      timestampQueryRequested: timestampRequested,
      timestampQuerySupported: timestampSupported,
      encoderSpansSupported: encoderSpansUsable && !destroyed,
      encoderSpanCapacity: resolvedEncoderSpanCapacity,
      encoderSpanProducerPrefix: resolvedEncoderSpanProducerPrefix,
      profiledPassCount: encoderSpans.length,
      validPassCount,
      invalidPassCount: encoderSpans.length - validPassCount,
      pendingSpanCount,
      discardedSpanCount: encoderSpanDiscardedCount,
      overflowCount: encoderSpanOverflowCount,
      readFailureCount: encoderSpanReadFailureCount,
      reason: encoderSpanFailureReason,
      stageGpuMs,
      stageGpuStats
    };
  };

  const recorderCapabilities = {};
  Object.defineProperties(recorderCapabilities, {
    queueStageMeasurement: {
      enumerable: true,
      value: true
    },
    queueStageSummary: {
      enumerable: true,
      value: true
    },
    encoderSpans: {
      enumerable: true,
      get() { return encoderSpansUsable && !destroyed; }
    },
    encoderStageSummary: {
      enumerable: true,
      get() { return encoderSpansUsable && !destroyed; }
    }
  });
  Object.freeze(recorderCapabilities);

  const recorder = {
    schema: 'peercompute.ulg.sph-gpu-queue-stage-recorder.v0',
    label,
    get recorderKind() {
      return encoderSpansUsable && !destroyed
        ? 'queue-fence-and-timestamp-query-stage-summary'
        : 'queue-fence-stage-summary';
    },
    get active() { return usable && !destroyed; },
    capabilities: recorderCapabilities,
    async measureQueueStage(descriptor, runStage) {
      if (!usable || destroyed) return runStage();
      // Fence first so the measurement excludes work already in flight.
      await device.queue.onSubmittedWorkDone();
      const startedMs = (globalThis.performance ?? Date).now();
      const result = await runStage();
      await device.queue.onSubmittedWorkDone();
      const gpuMs = Math.max(
        0,
        ((globalThis.performance ?? Date).now()) - startedMs
      );
      await harvestEncoderSpans();
      queueSpans.push({
        stage: String(descriptor?.stage ?? 'unknown'),
        producerId: descriptor?.producerId ?? null,
        gpuMs
      });
      return result;
    },
    beginEncoderSpan(encoder, descriptor = {}) {
      if (!encoderSpansUsable || destroyed) return null;
      if (
        resolvedEncoderSpanProducerPrefix != null
        && !String(descriptor?.producerId ?? '').startsWith(
          resolvedEncoderSpanProducerPrefix
        )
      ) return null;
      if (nextEncoderSpanSlot >= resolvedEncoderSpanCapacity) {
        encoderSpanOverflowCount += 1;
        return null;
      }
      const beginIndex = nextEncoderSpanSlot * 2;
      const endIndex = beginIndex + 1;
      try {
        encodeSphGpuTimestampMarkerPass(encoder, {
          querySet: timestampQuerySet,
          queryIndex: beginIndex,
          boundary: 'start',
          label: `${label}-${String(descriptor?.stage ?? 'unknown')}-start`
        });
      } catch (error) {
        encoderSpansUsable = false;
        encoderSpanFailureReason = String(error?.message || error);
        return null;
      }
      nextEncoderSpanSlot += 1;
      const token = {
        encoder,
        beginIndex,
        endIndex,
        stage: String(descriptor?.stage ?? 'unknown'),
        producerId: descriptor?.producerId ?? null,
        spanClass: descriptor?.spanClass ?? null,
        closed: false,
        discarded: false,
        harvested: false
      };
      pendingEncoderSpans.push(token);
      return token;
    },
    endEncoderSpan(encoder, token) {
      if (token == null) return false;
      if (
        !encoderSpansUsable
        || destroyed
        || token.encoder !== encoder
        || token.closed === true
        || token.discarded === true
      ) return false;
      try {
        encodeSphGpuTimestampMarkerPass(encoder, {
          querySet: timestampQuerySet,
          queryIndex: token.endIndex,
          boundary: 'end',
          label: `${label}-${token.stage}-end`
        });
        const slot = token.beginIndex / 2;
        const resolveByteOffset = slot * TIMESTAMP_QUERY_RESOLVE_ALIGNMENT;
        const readByteOffset =
          token.beginIndex * BigUint64Array.BYTES_PER_ELEMENT;
        encoder.resolveQuerySet(
          timestampQuerySet,
          token.beginIndex,
          2,
          timestampResolveBuffer,
          resolveByteOffset
        );
        encoder.copyBufferToBuffer(
          timestampResolveBuffer,
          resolveByteOffset,
          timestampReadBuffer,
          readByteOffset,
          2 * BigUint64Array.BYTES_PER_ELEMENT
        );
        token.closed = true;
        return true;
      } catch (error) {
        token.discarded = true;
        encoderSpanDiscardedCount += 1;
        encoderSpansUsable = false;
        encoderSpanFailureReason = String(error?.message || error);
        return false;
      }
    },
    discardEncoderSpans(encoder) {
      let discardedCount = 0;
      for (const span of pendingEncoderSpans) {
        if (
          span.encoder === encoder
          && span.harvested !== true
          && span.discarded !== true
        ) {
          span.discarded = true;
          encoderSpanDiscardedCount += 1;
          discardedCount += 1;
        }
      }
      // Do not settle or reuse these slots here. The caller may be reporting
      // an encoder whose queue submission is ambiguous, so reusing its query
      // indices before a later successful post-fence harvest could alias live
      // device writes. Harvest (or destroy) is the only safe release point.
      return discardedCount;
    },
    encoderTimestampProfile,
    stageGpuMs() {
      const totals = {};
      for (const span of queueSpans) {
        totals[span.stage] = (totals[span.stage] ?? 0) + span.gpuMs;
      }
      return totals;
    },
    // Totals alone are not comparable across stages that run a different
    // number of times per frame -- the render field builds once while the
    // mechanics stages run per substep. Counts travel with the totals so a
    // reader can take the mean instead of mistaking cadence for cost.
    stageGpuStats() {
      const stats = {};
      for (const span of queueSpans) {
        const entry = stats[span.stage] ?? (stats[span.stage] = {
          totalMs: 0,
          count: 0,
          maxMs: 0,
          meanMs: 0
        });
        entry.totalMs += span.gpuMs;
        entry.count += 1;
        entry.maxMs = Math.max(entry.maxMs, span.gpuMs);
        entry.meanMs = entry.totalMs / entry.count;
      }
      return stats;
    },
    spanCount() { return queueSpans.length; },
    encoderSpanCount() { return encoderSpans.length; },
    reset() {
      if (pendingEncoderSpans.length > 0 || encoderSpanReadInFlight) {
        return false;
      }
      queueSpans.length = 0;
      encoderSpans.length = 0;
      encoderSpanOverflowCount = 0;
      encoderSpanDiscardedCount = 0;
      encoderSpanReadFailureCount = 0;
      if (encoderSpansUsable) {
        encoderSpanFailureReason = null;
      }
      return true;
    },
    destroy() {
      if (destroyed) return false;
      destroyed = true;
      timestampQuerySet?.destroy?.();
      timestampResolveBuffer?.destroy?.();
      timestampReadBuffer?.destroy?.();
      timestampQuerySet = null;
      timestampResolveBuffer = null;
      timestampReadBuffer = null;
      pendingEncoderSpans.length = 0;
      nextEncoderSpanSlot = 0;
      return true;
    }
  };
  Object.defineProperty(recorder, 'encoderSpansSupported', {
    enumerable: true,
    get() { return encoderSpansUsable && !destroyed; }
  });
  return recorder;
}
