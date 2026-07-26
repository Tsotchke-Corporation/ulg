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
      const raw = new BigInt64Array(readBuffer.getMappedRange().slice(0));
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
 * Encoder spans are deliberately inert. Current WebGPU has no
 * `encoder.writeTimestamp`; timestamps can only be written by `timestampWrites`
 * on a pass descriptor. `beginEncoderSpan` therefore returns null rather than
 * pretending, and every consumer already handles a null span. Pass-level timing
 * comes from `createSphGpuTimestampProfiler` itself.
 *
 * Fences serialise the queue, so this is a diagnostic mode and must stay off by
 * default.
 */
export function createSphGpuQueueStageRecorder({
  device = null,
  enabled = true,
  label = 'ulg-sph-gpu-queue-stage-recorder'
} = {}) {
  const usable = Boolean(enabled === true && device?.queue?.onSubmittedWorkDone);
  /** @type {{stage: string, gpuMs: number, producerId: string|null}[]} */
  const spans = [];

  return {
    schema: 'peercompute.ulg.sph-gpu-queue-stage-recorder.v0',
    label,
    active: usable,
    encoderSpansSupported: false,
    async measureQueueStage(descriptor, runStage) {
      if (!usable) return runStage();
      // Fence first so the measurement excludes work already in flight.
      await device.queue.onSubmittedWorkDone();
      const startedMs = (globalThis.performance ?? Date).now();
      const result = await runStage();
      await device.queue.onSubmittedWorkDone();
      const gpuMs = Math.max(0, ((globalThis.performance ?? Date).now()) - startedMs);
      spans.push({
        stage: String(descriptor?.stage ?? 'unknown'),
        producerId: descriptor?.producerId ?? null,
        gpuMs
      });
      return result;
    },
    // Inert by necessity, not by choice; see the note above.
    beginEncoderSpan() { return null; },
    endEncoderSpan() {},
    discardEncoderSpans() {},
    stageGpuMs() {
      const totals = {};
      for (const span of spans) {
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
      for (const span of spans) {
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
    spanCount() { return spans.length; },
    reset() { spans.length = 0; }
  };
}
