const GPU_SHADER_STAGE = {
  COMPUTE: globalThis.GPUShaderStage?.COMPUTE ?? 4
};

const DEVICE_COMPUTE_PIPELINE_CACHE = new WeakMap();
const DEVICE_SHADER_MODULE_CACHE = new WeakMap();
const DEVICE_EXPLICIT_COMPUTE_LAYOUT_CACHE = new WeakMap();
const DEVICE_PIPELINE_PREWARM_INFLIGHT = new WeakMap();

export function computeBufferBinding(
  binding,
  type = 'read-only-storage',
  options = {}
) {
  return {
    binding,
    visibility: GPU_SHADER_STAGE.COMPUTE,
    buffer: { type, ...options }
  };
}

export function createExplicitComputePipeline(device, {
  label,
  module,
  entryPoint = 'main',
  bindings = [],
  explicitLayout = null
} = {}) {
  let bindGroupLayout = explicitLayout?.bindGroupLayout ?? null;
  let pipelineLayout = explicitLayout?.pipelineLayout ?? null;
  if (device?.createBindGroupLayout && device?.createPipelineLayout && bindings.length > 0) {
    if (!bindGroupLayout || !pipelineLayout) {
      bindGroupLayout = device.createBindGroupLayout({
        label: `${label || entryPoint}-bind-group-layout`,
        entries: bindings
      });
      pipelineLayout = device.createPipelineLayout({
        label: `${label || entryPoint}-pipeline-layout`,
        bindGroupLayouts: [bindGroupLayout]
      });
    }
  }
  const pipeline = device.createComputePipeline({
    label,
    layout: pipelineLayout || 'auto',
    compute: { module, entryPoint }
  });
  return {
    pipeline,
    bindGroupLayout: bindGroupLayout || pipeline.getBindGroupLayout(0)
  };
}

function computePipelineCacheForDevice(device) {
  let cache = DEVICE_COMPUTE_PIPELINE_CACHE.get(device);
  if (!cache) {
    cache = new Map();
    DEVICE_COMPUTE_PIPELINE_CACHE.set(device, cache);
  }
  return cache;
}

function shaderModuleCacheForDevice(device) {
  let cache = DEVICE_SHADER_MODULE_CACHE.get(device);
  if (!cache) {
    cache = new Map();
    DEVICE_SHADER_MODULE_CACHE.set(device, cache);
  }
  return cache;
}

function explicitComputeLayoutCacheForDevice(device) {
  let cache = DEVICE_EXPLICIT_COMPUTE_LAYOUT_CACHE.get(device);
  if (!cache) {
    cache = new Map();
    DEVICE_EXPLICIT_COMPUTE_LAYOUT_CACHE.set(device, cache);
  }
  return cache;
}

function cachedShaderModule(device, { label, code }) {
  const cache = shaderModuleCacheForDevice(device);
  const cached = cache.get(code);
  if (cached) {
    return {
      module: cached,
      cacheStatus: 'shader-module-cache-hit'
    };
  }
  const module = device.createShaderModule({ label, code });
  cache.set(code, module);
  return {
    module,
    cacheStatus: 'shader-module-cache-miss'
  };
}

function bindingSignature(bindings = []) {
  return JSON.stringify(bindings.map((entry) => ({
    binding: entry.binding,
    visibility: entry.visibility,
    buffer: entry.buffer
      ? {
          type: entry.buffer.type || 'uniform',
          hasDynamicOffset: entry.buffer.hasDynamicOffset === true,
          minBindingSize: Number(entry.buffer.minBindingSize || 0)
        }
      : null,
    sampler: entry.sampler ?? null,
    texture: entry.texture ?? null,
    storageTexture: entry.storageTexture ?? null,
    externalTexture: entry.externalTexture ?? null
  })));
}

function cachedExplicitComputeLayout(device, { label, entryPoint, bindings }) {
  if (
    !device?.createBindGroupLayout
    || !device?.createPipelineLayout
    || bindings.length === 0
  ) return null;
  const signature = bindingSignature(bindings);
  const cache = explicitComputeLayoutCacheForDevice(device);
  const cached = cache.get(signature);
  if (cached) {
    return {
      ...cached,
      cacheStatus: 'explicit-layout-cache-hit'
    };
  }
  const bindGroupLayout = device.createBindGroupLayout({
    label: `${label || entryPoint}-bind-group-layout`,
    entries: bindings
  });
  const pipelineLayout = device.createPipelineLayout({
    label: `${label || entryPoint}-pipeline-layout`,
    bindGroupLayouts: [bindGroupLayout]
  });
  const created = { bindGroupLayout, pipelineLayout };
  cache.set(signature, created);
  return {
    ...created,
    cacheStatus: 'explicit-layout-cache-miss'
  };
}

export function createCachedExplicitComputePipeline(device, {
  cacheKey,
  label,
  code,
  entryPoint = 'main',
  bindings = []
} = {}) {
  if (!cacheKey) {
    const module = device.createShaderModule({ label, code });
    return {
      ...createExplicitComputePipeline(device, {
        label,
        module,
        entryPoint,
        bindings
      }),
      cacheStatus: 'not-cached'
    };
  }
  const key = [
    cacheKey,
    label || '',
    entryPoint,
    bindingSignature(bindings)
  ].join('|');
  const cache = computePipelineCacheForDevice(device);
  const cached = cache.get(key);
  if (cached) {
    return {
      ...cached,
      cacheStatus: 'pipeline-cache-hit',
      shaderModuleCacheStatus: 'pipeline-cache-hit'
    };
  }
  const {
    module,
    cacheStatus: shaderModuleCacheStatus
  } = cachedShaderModule(device, { label, code });
  const explicitLayout = cachedExplicitComputeLayout(device, {
    label,
    entryPoint,
    bindings
  });
  const created = createExplicitComputePipeline(device, {
    label,
    module,
    entryPoint,
    bindings,
    explicitLayout
  });
  const entry = {
    ...created,
    pipelineLayout: explicitLayout?.pipelineLayout ?? null
  };
  cache.set(key, entry);
  return {
    ...entry,
    cacheStatus: 'pipeline-cache-miss',
    shaderModuleCacheStatus,
    explicitLayoutCacheStatus:
      explicitLayout?.cacheStatus ?? 'explicit-layout-not-cached'
  };
}

function pipelinePrewarmInflightForDevice(device) {
  let inflight = DEVICE_PIPELINE_PREWARM_INFLIGHT.get(device);
  if (!inflight) {
    inflight = new Map();
    DEVICE_PIPELINE_PREWARM_INFLIGHT.set(device, inflight);
  }
  return inflight;
}

/**
 * Compile one cached pipeline ahead of its first submission site, off the
 * interactive path, populating the same per-device cache with the same entry
 * shape as createCachedExplicitComputePipeline so every existing synchronous
 * call site becomes a guaranteed hit. Prewarm is deliberately fail-open: a
 * compilation failure leaves the cache untouched and is only reported here,
 * so the synchronous path still surfaces the real error at its own site with
 * unchanged fail-closed semantics. Concurrent prewarms of one key share a
 * single in-flight compilation; a synchronous create racing a prewarm wins
 * the cache and the prewarm result defers to it.
 */
export async function prewarmCachedExplicitComputePipeline(device, {
  cacheKey,
  label,
  code,
  entryPoint = 'main',
  bindings = []
} = {}) {
  if (!cacheKey) {
    throw new TypeError(
      'pipeline prewarm requires a cacheKey; an uncached prewarm can never be consumed'
    );
  }
  const key = [
    cacheKey,
    label || '',
    entryPoint,
    bindingSignature(bindings)
  ].join('|');
  const cache = computePipelineCacheForDevice(device);
  if (cache.has(key)) {
    return { ...cache.get(key), cacheStatus: 'pipeline-cache-hit', prewarmed: false };
  }
  const inflight = pipelinePrewarmInflightForDevice(device);
  const pending = inflight.get(key);
  if (pending) return pending;
  const run = (async () => {
    try {
      const { module } = cachedShaderModule(device, { label, code });
      const explicitLayout = cachedExplicitComputeLayout(device, {
        label,
        entryPoint,
        bindings
      });
      const descriptor = {
        label,
        layout: explicitLayout?.pipelineLayout || 'auto',
        compute: { module, entryPoint }
      };
      const pipeline = typeof device.createComputePipelineAsync === 'function'
        ? await device.createComputePipelineAsync(descriptor)
        : device.createComputePipeline(descriptor);
      const entry = {
        pipeline,
        bindGroupLayout:
          explicitLayout?.bindGroupLayout || pipeline.getBindGroupLayout(0),
        pipelineLayout: explicitLayout?.pipelineLayout ?? null
      };
      if (!cache.has(key)) cache.set(key, entry);
      return {
        ...cache.get(key),
        cacheStatus: 'pipeline-prewarmed',
        prewarmed: true
      };
    } catch (error) {
      return {
        pipeline: null,
        bindGroupLayout: null,
        pipelineLayout: null,
        cacheStatus: 'pipeline-prewarm-failed',
        prewarmed: false,
        error
      };
    } finally {
      inflight.delete(key);
    }
  })();
  inflight.set(key, run);
  return run;
}

// One fence per registered cleanup, measured at 161 per batch in a production
// frame, all waiting for the same device idle point. Two ways of coalescing
// them were built and both were reverted; do not try a third without reading
// this.
//
// Keeping one fence in flight and making newcomers wait for the *next* one got
// 162 fences per batch down to 4 -- and broke every `ss=1` run with "Thermal
// proposal arena 0 is still leased by generation 1". Arena leases are released
// through this helper, so delaying a release by one fence round trip lets the
// next substep reach `acquire` before the previous release has run. The fence
// count is not the thing to optimise; release latency is a correctness
// property here.
//
// Closing a batch on a microtask instead is safe -- each cleanup's fence is
// created in its own turn -- and measured **no reduction at all**, 162 per
// batch, because the 161 registrations are already spread across separate
// microtask turns by the awaits between stages. Nothing to coalesce.
//
// So this generic fallback stays one fence per cleanup.
//
// A producer that owns an exact, already-submitted same-queue success receipt
// may instead use `releaseSubmittedWorkCleanupQueueOrdered`. That separate API
// requires the caller to authenticate its owner authority before destruction;
// it must never be used to turn this fallback into an optimistic cleanup path.
export function deferSubmittedWorkCleanup(device, cleanup) {
  if (typeof cleanup !== 'function') return false;
  // While a submit burst is open on this device, some of the work this
  // cleanup covers may still be HELD (encoded but not yet on the queue), so
  // an immediate onSubmittedWorkDone fence would not cover it and the
  // cleanup could destroy buffers a held command buffer still references.
  // Park the cleanup on the burst; the flush schedules it on a real fence,
  // one fence per cleanup exactly as below (release latency stays a
  // correctness property; see the coalescing lesson above).
  const burst = workerQueueSubmitBurstRecords.get(device);
  if (burst?.open) {
    burst.deferredCleanups.push(cleanup);
    burst.stats.deferredCleanupTotal += 1;
    return true;
  }
  if (!device?.queue?.onSubmittedWorkDone) {
    cleanup();
    return false;
  }
  device.queue.onSubmittedWorkDone()
    .catch(() => null)
    .finally(() => {
      cleanup();
    });
  return true;
}

// --- Worker queue submit burst -------------------------------------------
//
// One queue.submit costs a fixed GPU-process CPU slice regardless of how
// little work the command buffers hold; the resident worker lane makes ~11
// submits per mechanics step, which IS the small-N step floor. The burst
// holds finished command buffers at the device's queue boundary and flushes
// them as one submit, preserving queue order BY CONSTRUCTION rather than by
// auditing call sites:
//
// - queue.submit while open appends to the held list (order kept).
// - queue.writeBuffer passes through only when the target buffer was created
//   after the last held submit (a held command buffer cannot reference a
//   buffer that did not exist when it was finished); otherwise the burst
//   flushes first, so the write keeps its queue-order position.
// - queue.onSubmittedWorkDone flushes first, so every fence a caller takes
//   covers the work it believes was submitted.
// - buffer.destroy on a buffer a held command buffer may reference is parked
//   until after the flush's real submit (WebGPU rejects submits that
//   reference destroyed buffers); destroys of provably-unreferenced buffers
//   run immediately.
//
// The burst must only be opened on a lane whose law families are quiescent:
// lease-style releases (thermal proposal arenas and kin) treat release
// latency as a correctness property, and parking their cleanups behind a
// flush would let the next substep's acquire outrun the release. The worker
// derives that eligibility from the schedule's law-activation receipt.

const workerQueueSubmitBurstRecords = new WeakMap();

function workerQueueSubmitBurstError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function workerQueueSubmitBurstWriteThroughBytes(data, dataOffset, size) {
  if (ArrayBuffer.isView(data)) {
    const elementBytes = data.BYTES_PER_ELEMENT || 1;
    const startElements = Number(dataOffset) || 0;
    const lengthElements = size == null
      ? data.length - startElements
      : Number(size);
    if (!(lengthElements >= 0)) return null;
    return new Uint8Array(
      data.buffer,
      data.byteOffset + startElements * elementBytes,
      lengthElements * elementBytes
    );
  }
  if (data instanceof ArrayBuffer) {
    const startBytes = Number(dataOffset) || 0;
    const lengthBytes = size == null ? data.byteLength - startBytes : Number(size);
    if (!(lengthBytes >= 0)) return null;
    return new Uint8Array(data, startBytes, lengthBytes);
  }
  return null;
}

function workerQueueSubmitBurstWriteThrough(
  device,
  record,
  buffer,
  bufferOffset,
  data,
  dataOffset,
  size
) {
  if (typeof device.createCommandEncoder !== 'function') return false;
  let bytes;
  try {
    bytes = workerQueueSubmitBurstWriteThroughBytes(data, dataOffset, size);
  } catch {
    bytes = null;
  }
  if (!bytes || bytes.byteLength === 0 || bytes.byteLength % 4 !== 0) {
    return false;
  }
  try {
    const staging = device.createBuffer({
      label: 'ulg-submit-burst-write-through-staging',
      size: bytes.byteLength,
      usage: (globalThis.GPUBufferUsage?.COPY_SRC ?? 0x0004),
      mappedAtCreation: true
    });
    new Uint8Array(staging.getMappedRange()).set(bytes);
    staging.unmap();
    const encoder = device.createCommandEncoder({
      label: 'ulg-submit-burst-write-through'
    });
    encoder.copyBufferToBuffer(
      staging,
      0,
      buffer,
      Number(bufferOffset) || 0,
      bytes.byteLength
    );
    record.heldCommandBuffers.push(encoder.finish());
    record.heldSubmitStamp = record.createStamp;
    if (record.heldCommandBuffers.length > record.stats.maxHeldCommandBuffers) {
      record.stats.maxHeldCommandBuffers = record.heldCommandBuffers.length;
    }
    record.deferredCleanups.push(() => {
      staging.destroy?.();
    });
    return true;
  } catch {
    return false;
  }
}

export function armWorkerQueueSubmitBurst(device) {
  if (!device?.queue?.submit || typeof device.createBuffer !== 'function') {
    throw workerQueueSubmitBurstError(
      'ERR_WORKER_QUEUE_SUBMIT_BURST_DEVICE',
      'worker queue submit burst requires a WebGPU device with a queue'
    );
  }
  let record = workerQueueSubmitBurstRecords.get(device);
  if (record) return record;
  const queue = device.queue;
  record = {
    open: false,
    label: null,
    writeThroughEnabled: false,
    // Monotonic creation counter; a buffer stamped after the last held
    // submit cannot be referenced by any held command buffer.
    createStamp: 0,
    heldSubmitStamp: 0,
    heldCommandBuffers: [],
    deferredCleanups: [],
    bufferStamps: new WeakMap(),
    realSubmit: queue.submit.bind(queue),
    realWriteBuffer: typeof queue.writeBuffer === 'function'
      ? queue.writeBuffer.bind(queue)
      : null,
    realWriteTexture: typeof queue.writeTexture === 'function'
      ? queue.writeTexture.bind(queue)
      : null,
    realOnSubmittedWorkDone: typeof queue.onSubmittedWorkDone === 'function'
      ? queue.onSubmittedWorkDone.bind(queue)
      : null,
    realCreateBuffer: device.createBuffer.bind(device),
    stats: {
      openCount: 0,
      flushCount: 0,
      flushSubmitCount: 0,
      heldSubmitTotal: 0,
      directSubmitTotal: 0,
      maxHeldCommandBuffers: 0,
      staleWriteFlushCount: 0,
      staleWriteFlushLabels: {},
      writeThroughCount: 0,
      writeThroughLabels: {},
      fenceFlushCount: 0,
      cadenceFlushCount: 0,
      closeFlushCount: 0,
      deferredCleanupTotal: 0,
      deferredDestroyTotal: 0,
      immediateDestroyTotal: 0
    }
  };
  workerQueueSubmitBurstRecords.set(device, record);
  queue.submit = (commandBuffers) => {
    if (record.open) {
      for (const commandBuffer of commandBuffers) {
        record.heldCommandBuffers.push(commandBuffer);
      }
      record.heldSubmitStamp = record.createStamp;
      record.stats.heldSubmitTotal += 1;
      if (record.heldCommandBuffers.length > record.stats.maxHeldCommandBuffers) {
        record.stats.maxHeldCommandBuffers = record.heldCommandBuffers.length;
      }
      return undefined;
    }
    record.stats.directSubmitTotal += 1;
    return record.realSubmit(commandBuffers);
  };
  if (record.realWriteBuffer) {
    queue.writeBuffer = (buffer, bufferOffset, data, dataOffset, size) => {
      if (record.open && record.heldCommandBuffers.length > 0) {
        const stamp = record.bufferStamps.get(buffer);
        if (!(typeof stamp === 'number' && stamp > record.heldSubmitStamp)) {
          // The target buffer may be referenced by a held command buffer, so
          // an immediate write would land BEFORE commands that were encoded
          // against the buffer's current contents. Two order-preserving
          // responses exist: flush first (default), or copy the data into a
          // fresh staging buffer and hold a copyBufferToBuffer at the
          // write's queue position (any writeBuffer target already carries
          // COPY_DST, and writeBuffer's 4-byte offset/size rules match the
          // copy's). Write-through is opt-in because it MEASURED WORSE on
          // the bulk lane: ~21 arena-params writes/step became 21 staging
          // buffers + encoders per step (11.4 ms/step vs 8.0 flushing, 1k
          // particles, 2026-08-28) — the flush it saves is cheaper than the
          // churn it adds while a per-step retirement fence bounds held
          // windows to one step anyway.
          const writeThrough = record.writeThroughEnabled
            && workerQueueSubmitBurstWriteThrough(
              device,
              record,
              buffer,
              bufferOffset,
              data,
              dataOffset,
              size
            );
          if (writeThrough) {
            const label = String(buffer?.label || 'unlabeled');
            record.stats.writeThroughCount += 1;
            record.stats.writeThroughLabels[label] =
              (record.stats.writeThroughLabels[label] || 0) + 1;
            return undefined;
          }
          record.stats.staleWriteFlushCount += 1;
          const label = String(buffer?.label || 'unlabeled');
          record.stats.staleWriteFlushLabels[label] =
            (record.stats.staleWriteFlushLabels[label] || 0) + 1;
          flushWorkerQueueSubmitBurst(device, 'stale-write-buffer');
        }
      }
      return record.realWriteBuffer(buffer, bufferOffset, data, dataOffset, size);
    };
  }
  if (record.realWriteTexture) {
    queue.writeTexture = (...writeArgs) => {
      if (record.open && record.heldCommandBuffers.length > 0) {
        record.stats.staleWriteFlushCount += 1;
        flushWorkerQueueSubmitBurst(device, 'write-texture');
      }
      return record.realWriteTexture(...writeArgs);
    };
  }
  if (record.realOnSubmittedWorkDone) {
    queue.onSubmittedWorkDone = () => {
      if (record.open && record.heldCommandBuffers.length > 0) {
        record.stats.fenceFlushCount += 1;
        flushWorkerQueueSubmitBurst(device, 'fence-request');
      }
      return record.realOnSubmittedWorkDone();
    };
  }
  device.createBuffer = (descriptor) => {
    const buffer = record.realCreateBuffer(descriptor);
    record.createStamp += 1;
    record.bufferStamps.set(buffer, record.createStamp);
    if (typeof buffer?.destroy === 'function') {
      const realDestroy = buffer.destroy.bind(buffer);
      let destroyed = false;
      buffer.destroy = () => {
        if (destroyed) return undefined;
        destroyed = true;
        const stamp = record.bufferStamps.get(buffer);
        if (
          record.open
          && record.heldCommandBuffers.length > 0
          && !(typeof stamp === 'number' && stamp > record.heldSubmitStamp)
        ) {
          record.deferredCleanups.push(realDestroy);
          record.stats.deferredDestroyTotal += 1;
          return undefined;
        }
        record.stats.immediateDestroyTotal += 1;
        return realDestroy();
      };
    }
    return buffer;
  };
  return record;
}

export function openWorkerQueueSubmitBurst(device, {
  label = null,
  writeThrough = false
} = {}) {
  const record = armWorkerQueueSubmitBurst(device);
  if (record.open) {
    throw workerQueueSubmitBurstError(
      'ERR_WORKER_QUEUE_SUBMIT_BURST_ALREADY_OPEN',
      'worker queue submit burst is already open on this device'
    );
  }
  record.open = true;
  record.label = label;
  record.writeThroughEnabled = writeThrough === true;
  record.stats.openCount += 1;
  return record;
}

export function flushWorkerQueueSubmitBurst(device, reason = 'explicit') {
  const record = workerQueueSubmitBurstRecords.get(device);
  if (!record) return null;
  const held = record.heldCommandBuffers;
  const cleanups = record.deferredCleanups;
  record.heldCommandBuffers = [];
  record.deferredCleanups = [];
  record.heldSubmitStamp = record.createStamp;
  let submitError = null;
  if (held.length > 0) {
    record.stats.flushCount += 1;
    record.stats.flushSubmitCount += held.length;
    if (reason === 'step-cadence') record.stats.cadenceFlushCount += 1;
    if (reason === 'burst-close') record.stats.closeFlushCount += 1;
    try {
      record.realSubmit(held);
    } catch (error) {
      submitError = error;
    }
  }
  // One real fence per cleanup, matching deferSubmittedWorkCleanup's
  // documented no-coalescing contract. If the submit failed or the fence API
  // is unavailable the cleanups still run so buffers are not leaked on a
  // poisoned lane.
  for (const cleanup of cleanups) {
    if (record.realOnSubmittedWorkDone && submitError == null) {
      record.realOnSubmittedWorkDone()
        .catch(() => null)
        .finally(() => {
          cleanup();
        });
    } else {
      try {
        cleanup();
      } catch {
        // Cleanup failures must not mask the submit error.
      }
    }
  }
  if (submitError) throw submitError;
  return { flushed: held.length, reason };
}

export function closeWorkerQueueSubmitBurst(device, reason = 'burst-close') {
  const record = workerQueueSubmitBurstRecords.get(device);
  if (!record || !record.open) return null;
  let flushError = null;
  try {
    flushWorkerQueueSubmitBurst(device, reason);
  } catch (error) {
    flushError = error;
  }
  record.open = false;
  record.label = null;
  const stats = { ...record.stats };
  if (flushError) throw flushError;
  return stats;
}

export function workerQueueSubmitBurstStats(device) {
  const record = workerQueueSubmitBurstRecords.get(device);
  return record ? { ...record.stats, open: record.open } : null;
}

export const QUEUE_ORDERED_SUBMITTED_WORK_CLEANUP_RECEIPT_SCHEMA =
  'peercompute.ulg.queue-ordered-submitted-work-cleanup-receipt.v0';
export const QUEUE_ORDERED_FINAL_CONSUMER_CAPABILITY_SCHEMA =
  'peercompute.ulg.queue-ordered-final-consumer-capability.v0';
export const QUEUE_ORDERED_SUBMISSION_RECEIPT_SCHEMA =
  'peercompute.ulg.queue-ordered-submission-receipt.v0';
export const QUEUE_ORDERED_CLEANUP_CLAIM_SCHEMA =
  'peercompute.ulg.queue-ordered-cleanup-claim.v0';
export const QUEUE_ORDERED_CLEANUP_CLAIM_ISSUER_SCHEMA =
  'peercompute.ulg.queue-ordered-cleanup-claim-issuer.v0';

const queueOrderedFinalConsumerCapabilityRecords = new WeakMap();
const queueOrderedSubmissionReceiptRecords = new WeakMap();
const queueOrderedCleanupClaimIssuerRecords = new WeakMap();
const queueOrderedCleanupClaimRecords = new WeakMap();

function queueOrderedAuthorityReference(value) {
  return Boolean(
    value != null
    && (typeof value === 'object' || typeof value === 'function')
  );
}

function queueOrderedCleanupUnauthorized(message) {
  const error = new Error(message);
  error.code = 'ERR_QUEUE_ORDERED_CLEANUP_UNAUTHORIZED';
  return error;
}

/**
 * Create one producer-private claim domain. Producers retain the issuer in
 * module scope and only hand opaque claims to an exact final consumer.
 *
 * A claim binds the cleanup function itself, not merely public output
 * metadata. Creating another issuer therefore cannot authorize replacement
 * cleanup code for a producer's private allocation ledger.
 */
export function createQueueOrderedCleanupClaimIssuer({
  producerFamily = ''
} = {}) {
  const normalizedFamily = typeof producerFamily === 'string'
    ? producerFamily.trim()
    : '';
  if (!normalizedFamily) {
    throw queueOrderedCleanupUnauthorized(
      'queue-ordered cleanup claim issuer requires one fixed producer family'
    );
  }
  const issuer = Object.freeze({
    schema: QUEUE_ORDERED_CLEANUP_CLAIM_ISSUER_SCHEMA,
    status: 'queue-ordered-cleanup-claim-issuer'
  });
  queueOrderedCleanupClaimIssuerRecords.set(issuer, {
    producerFamily: normalizedFamily,
    registrations: new WeakMap()
  });
  return issuer;
}

export function registerQueueOrderedCleanupClaim(
  issuer,
  device,
  {
    producerOutput = null,
    cleanup = null
  } = {}
) {
  const issuerRecord = queueOrderedCleanupClaimIssuerRecords.get(issuer);
  if (
    !issuerRecord
    || !device?.queue?.submit
    || !queueOrderedAuthorityReference(producerOutput)
    || typeof cleanup !== 'function'
  ) {
    throw queueOrderedCleanupUnauthorized(
      'queue-ordered cleanup claim requires an exact producer issuer, device, output, and cleanup'
    );
  }
  if (issuerRecord.registrations.has(producerOutput)) {
    throw queueOrderedCleanupUnauthorized(
      'queue-ordered cleanup claim output is already registered in this producer domain'
    );
  }
  const claim = Object.freeze({
    schema: QUEUE_ORDERED_CLEANUP_CLAIM_SCHEMA,
    status: 'queue-ordered-cleanup-claim-registered'
  });
  issuerRecord.registrations.set(producerOutput, claim);
  queueOrderedCleanupClaimRecords.set(claim, {
    issuer,
    device,
    producerOutput,
    producerFamily: issuerRecord.producerFamily,
    cleanup,
    state: 'registered',
    capability: null
  });
  return claim;
}

/**
 * Cancel a claim that never reached a final-consumer submission. Cancellation
 * requires the original device/output/cleanup tuple and is only valid before
 * sealing. The allocation owner must then use its normal failure cleanup.
 */
export function cancelQueueOrderedCleanupClaim(
  producerClaim,
  device,
  {
    producerOutput = null,
    cleanup = null
  } = {}
) {
  const claimRecord = queueOrderedCleanupClaimRecords.get(producerClaim);
  if (
    !claimRecord
    || claimRecord.state !== 'registered'
    || claimRecord.device !== device
    || claimRecord.producerOutput !== producerOutput
    || claimRecord.cleanup !== cleanup
  ) {
    throw queueOrderedCleanupUnauthorized(
      'only the exact unsealed producer cleanup claim can be cancelled'
    );
  }
  claimRecord.state = 'cancelled';
  return true;
}

/**
 * Submit one exact, nonempty command-buffer family and return an opaque,
 * single-seal receipt. Keeping queue.submit inside this helper prevents a
 * caller from claiming that a final-consumer submission happened when it did
 * not. Empty boundary submits are deliberately rejected: this API must wrap an
 * existing useful submission rather than add hot-loop work.
 */
function createQueueOrderedSubmissionReceipt(device, commandBufferCount, {
  batchMemberOrdinal = null
} = {}) {
  const receipt = Object.freeze({
    schema: QUEUE_ORDERED_SUBMISSION_RECEIPT_SCHEMA,
    status: 'queue-ordered-work-submitted',
    commandBufferCount,
    ...(batchMemberOrdinal == null ? {} : { batchMemberOrdinal })
  });
  queueOrderedSubmissionReceiptRecords.set(receipt, {
    device,
    bound: false
  });
  return receipt;
}

export function submitQueueOrderedWork(device, commandBuffers) {
  if (!device?.queue?.submit) {
    throw new TypeError(
      'queue-ordered submission receipt requires a WebGPU queue'
    );
  }
  if (
    !Array.isArray(commandBuffers)
    || commandBuffers.length === 0
    || commandBuffers.some(
      (commandBuffer) => !queueOrderedAuthorityReference(commandBuffer)
    )
  ) {
    throw new TypeError(
      'queue-ordered submission receipt requires nonempty exact command buffers'
    );
  }
  device.queue.submit(commandBuffers);
  return createQueueOrderedSubmissionReceipt(device, commandBuffers.length);
}

const queueOrderedSubmissionBatchRecords = new WeakMap();

export function createQueueOrderedSubmissionBatch(device, {
  expectedCommandBufferCount
} = {}) {
  if (!device?.queue?.submit) {
    throw new TypeError('queue-ordered batch requires a WebGPU queue');
  }
  const expected = Number(expectedCommandBufferCount);
  if (!Number.isInteger(expected) || expected < 2 || expected > 64) {
    throw new RangeError('expectedCommandBufferCount must be in [2, 64]');
  }
  const batch = Object.freeze({
    schema: 'peercompute.ulg.queue-ordered-submission-batch.v0',
    status: 'queue-ordered-submission-batch-open'
  });
  queueOrderedSubmissionBatchRecords.set(batch, {
    device,
    expected,
    commandBuffers: [],
    waiters: [],
    state: 'open'
  });
  return batch;
}

export function appendQueueOrderedSubmissionBatch(
  batch,
  device,
  commandBuffer
) {
  const record = queueOrderedSubmissionBatchRecords.get(batch);
  if (
    !record
    || record.device !== device
    || record.state !== 'open'
    || !queueOrderedAuthorityReference(commandBuffer)
    || record.commandBuffers.includes(commandBuffer)
    || record.commandBuffers.length >= record.expected
  ) {
    throw new TypeError('queue-ordered batch member is stale, foreign, or invalid');
  }
  const promise = new Promise((resolve, reject) => {
    record.waiters.push({ resolve, reject });
  });
  record.commandBuffers.push(commandBuffer);
  if (record.commandBuffers.length === record.expected) {
    try {
      device.queue.submit(record.commandBuffers);
      record.state = 'submitted';
      for (let index = 0; index < record.waiters.length; index += 1) {
        record.waiters[index].resolve(createQueueOrderedSubmissionReceipt(
          device,
          record.commandBuffers.length,
          { batchMemberOrdinal: index }
        ));
      }
    } catch (error) {
      record.state = 'failed';
      for (const waiter of record.waiters) waiter.reject(error);
    }
  }
  return promise;
}

export function abortQueueOrderedSubmissionBatch(batch, device, reason) {
  const record = queueOrderedSubmissionBatchRecords.get(batch);
  if (!record || record.device !== device || record.state !== 'open') {
    return false;
  }
  const error = reason instanceof Error
    ? reason
    : new Error(String(reason || 'queue-ordered submission batch aborted'));
  record.state = 'aborted';
  for (const waiter of record.waiters) waiter.reject(error);
  return true;
}

function validateQueueOrderedFinalConsumerClaims(
  device,
  {
    finalConsumerOwner = null,
    producerClaims = []
  } = {}
) {
  if (!queueOrderedAuthorityReference(finalConsumerOwner)) {
    throw queueOrderedCleanupUnauthorized(
      'queue-ordered final-consumer capability requires one exact owner'
    );
  }
  if (!Array.isArray(producerClaims) || producerClaims.length === 0) {
    throw queueOrderedCleanupUnauthorized(
      'queue-ordered final-consumer capability requires producer-issued opaque claims'
    );
  }
  const uniqueClaims = new Set();
  const claimRecords = [];
  for (const producerClaim of producerClaims) {
    const claimRecord = queueOrderedCleanupClaimRecords.get(producerClaim);
    if (
      !claimRecord
      || claimRecord.state !== 'registered'
      || claimRecord.device !== device
      || uniqueClaims.has(producerClaim)
    ) {
      throw queueOrderedCleanupUnauthorized(
        'queue-ordered final-consumer capability rejected an invalid, transferred, or duplicate producer claim'
      );
    }
    uniqueClaims.add(producerClaim);
    claimRecords.push({ producerClaim, claimRecord });
  }
  return {
    finalConsumerOwner,
    uniqueClaims,
    claimRecords
  };
}

/**
 * Read-only producer-claim preflight for consumers that must create their own
 * output object after queue.submit returns. This does not mint authority; it
 * only proves that the exact opaque batch is presently registered for one
 * device so a useful submission is not issued for an already-invalid batch.
 */
export function assertQueueOrderedCleanupClaimsRegistered(
  device,
  producerClaims
) {
  if (!Array.isArray(producerClaims)) {
    throw queueOrderedCleanupUnauthorized(
      'queue-ordered producer claim preflight requires an array'
    );
  }
  const uniqueClaims = new Set();
  for (const producerClaim of producerClaims) {
    const claimRecord = queueOrderedCleanupClaimRecords.get(producerClaim);
    if (
      !claimRecord
      || claimRecord.state !== 'registered'
      || claimRecord.device !== device
      || uniqueClaims.has(producerClaim)
    ) {
      throw queueOrderedCleanupUnauthorized(
        'queue-ordered producer claim preflight rejected an invalid, transferred, or duplicate claim'
      );
    }
    uniqueClaims.add(producerClaim);
  }
  return true;
}

function commitQueueOrderedFinalConsumerCapability(
  submissionRecord,
  device,
  validated
) {
  const capability = Object.freeze({
    schema: QUEUE_ORDERED_FINAL_CONSUMER_CAPABILITY_SCHEMA,
    status: 'queue-ordered-final-consumer-capability-issued',
    claimCount: validated.claimRecords.length
  });
  submissionRecord.bound = true;
  for (const { claimRecord } of validated.claimRecords) {
    claimRecord.state = 'sealed';
    claimRecord.capability = capability;
  }
  queueOrderedFinalConsumerCapabilityRecords.set(capability, {
    device,
    finalConsumerOwner: validated.finalConsumerOwner,
    claims: new Set(validated.uniqueClaims),
    remainingClaimCount: validated.claimRecords.length
  });
  return capability;
}

/**
 * Seal producer-issued opaque claims into one helper-observed final-consumer
 * submission. Validation is atomic: a bad or duplicate batch changes neither
 * the receipt nor any claim, so the producer can fall back safely.
 */
export function sealQueueOrderedFinalConsumerCapability(
  submissionReceipt,
  device,
  {
    finalConsumerOwner = null,
    producerClaims = []
  } = {}
) {
  const submissionRecord =
    queueOrderedSubmissionReceiptRecords.get(submissionReceipt);
  if (
    !submissionRecord
    || submissionRecord.bound === true
    || submissionRecord.device !== device
  ) {
    throw queueOrderedCleanupUnauthorized(
      'queue-ordered final-consumer capability requires one unbound exact submission receipt and owner'
    );
  }
  const validated = validateQueueOrderedFinalConsumerClaims(device, {
    finalConsumerOwner,
    producerClaims
  });
  return commitQueueOrderedFinalConsumerCapability(
    submissionRecord,
    device,
    validated
  );
}

export function submitQueueOrderedFinalConsumerWork(
  device,
  commandBuffers,
  options = {}
) {
  // Validate every claim before the useful queue submission. A submit failure
  // leaves the validated claims registered and retryable; a successful submit
  // has no fallible validation step between receipt creation and commit.
  const validated = validateQueueOrderedFinalConsumerClaims(device, options);
  const submissionReceipt = submitQueueOrderedWork(device, commandBuffers);
  const submissionRecord =
    queueOrderedSubmissionReceiptRecords.get(submissionReceipt);
  return commitQueueOrderedFinalConsumerCapability(
    submissionRecord,
    device,
    validated
  );
}

/**
 * Mechanical same-module path for submitted scratch allocations. The module
 * keeps `issuer` private; this helper registers the exact cleanup, wraps the
 * existing nonempty submit, seals the claim, and consumes it immediately.
 */
export function submitQueueOrderedProducerWorkAndCleanup(
  issuer,
  device,
  commandBuffers,
  {
    producerOutput = null,
    finalConsumerOwner = producerOutput,
    cleanup = null
  } = {}
) {
  const issuerRecord = queueOrderedCleanupClaimIssuerRecords.get(issuer);
  const producerClaim = registerQueueOrderedCleanupClaim(
    issuer,
    device,
    {
      producerOutput,
      cleanup
    }
  );
  let capability;
  try {
    capability = submitQueueOrderedFinalConsumerWork(
      device,
      commandBuffers,
      {
        finalConsumerOwner,
        producerClaims: [producerClaim]
      }
    );
  } catch (error) {
    cancelQueueOrderedCleanupClaim(
      producerClaim,
      device,
      {
        producerOutput,
        cleanup
      }
    );
    throw error;
  }
  const cleanupReceipt = releaseSubmittedWorkCleanupQueueOrdered(
    device,
    cleanup,
    {
      queueOrderedFinalConsumer: capability,
      producerClaim,
      producerOutput,
      producerFamily: issuerRecord.producerFamily
    }
  );
  return Object.freeze({
    submissionReceiptStatus: 'queue-ordered-work-submitted',
    capability,
    producerClaim,
    cleanupReceipt
  });
}

function consumeQueueOrderedFinalConsumerCapability(
  capability,
  {
    device,
    producerClaim,
    producerOutput,
    producerFamily,
    cleanup
  }
) {
  const record =
    queueOrderedFinalConsumerCapabilityRecords.get(capability);
  const claimRecord = queueOrderedCleanupClaimRecords.get(producerClaim);
  if (
    !record
    || record.device !== device
    || !claimRecord
    || claimRecord.state !== 'sealed'
    || claimRecord.capability !== capability
    || claimRecord.device !== device
    || !record.claims.has(producerClaim)
    || !queueOrderedAuthorityReference(producerOutput)
    || typeof producerFamily !== 'string'
    || !producerFamily.trim()
    || claimRecord.producerOutput !== producerOutput
    || claimRecord.producerFamily !== producerFamily.trim()
    || claimRecord.cleanup !== cleanup
  ) {
    throw queueOrderedCleanupUnauthorized(
      'queue-ordered submitted-work cleanup requires a registered exact final-consumer capability'
    );
  }
  // Consume before invoking user cleanup. A throwing destructor must not make
  // the authority replayable with replacement cleanup code.
  claimRecord.state = 'consumed';
  record.claims.delete(producerClaim);
  record.remainingClaimCount -= 1;
  if (record.remainingClaimCount === 0) {
    queueOrderedFinalConsumerCapabilityRecords.delete(capability);
  }
  return record.remainingClaimCount;
}

/**
 * Destroy one-shot producer temporaries at an authenticated same-queue
 * submission boundary.
 *
 * WebGPU keeps resources referenced by prior submissions alive internally
 * after destroy(), so no host-observed device-idle fence is needed when the
 * exact owner has already submitted every consumer. Arena reuse remains the
 * owner's responsibility and must itself be ordered on the same queue.
 */
export function releaseSubmittedWorkCleanupQueueOrdered(
  device,
  cleanup,
  {
    queueOrderedFinalConsumer = null,
    producerClaim = null,
    producerOutput = null,
    producerFamily = null
  } = {}
) {
  if (typeof cleanup !== 'function') return false;
  if (!device?.queue?.submit) {
    throw new TypeError(
      'queue-ordered submitted-work cleanup requires a WebGPU queue'
    );
  }
  if (queueOrderedFinalConsumer == null) {
    throw queueOrderedCleanupUnauthorized(
      'queue-ordered submitted-work cleanup requires an opaque final-consumer capability'
    );
  }
  const remainingCapabilityClaimCount =
    consumeQueueOrderedFinalConsumerCapability(
      queueOrderedFinalConsumer,
      {
        device,
        producerClaim,
        producerOutput,
        producerFamily,
        cleanup
      }
    );
  cleanup();
  return Object.freeze({
    schema: QUEUE_ORDERED_SUBMITTED_WORK_CLEANUP_RECEIPT_SCHEMA,
    status: 'queue-ordered-submitted-work-cleanup-completed',
    completed: true,
    hostQueueFenceCount: 0,
    queueOrderedFinalConsumerCapabilityClaimConsumed:
      queueOrderedFinalConsumer != null,
    remainingCapabilityClaimCount,
    queueCompletionStatus: 'queue-ordered-owner-submission-authenticated',
    queueCompletionMethod: 'same-gpu-queue-submission-order'
  });
}
