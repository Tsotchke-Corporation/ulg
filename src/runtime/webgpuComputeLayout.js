const GPU_SHADER_STAGE = {
  COMPUTE: globalThis.GPUShaderStage?.COMPUTE ?? 4
};

const DEVICE_COMPUTE_PIPELINE_CACHE = new WeakMap();
const DEVICE_SHADER_MODULE_CACHE = new WeakMap();
const DEVICE_EXPLICIT_COMPUTE_LAYOUT_CACHE = new WeakMap();
const DEVICE_PIPELINE_PREWARM_INFLIGHT = new WeakMap();
const DEVICE_EXPLICIT_BIND_GROUP_CACHE = new WeakMap();
const GPU_RESOURCE_ID_MAP = new WeakMap();
let nextGpuResourceId = 1;
const MAX_CACHED_BIND_GROUPS_PER_LAYOUT = 128;

function gpuResourceId(resource) {
  let id = GPU_RESOURCE_ID_MAP.get(resource);
  if (id === undefined) {
    id = nextGpuResourceId;
    nextGpuResourceId += 1;
    GPU_RESOURCE_ID_MAP.set(resource, id);
  }
  return id;
}

export function createCachedExplicitBindGroup(device, descriptor) {
  const createBindGroupFn = device?.createBindGroup;
  const layout = descriptor?.layout;
  const entries = descriptor?.entries;
  if (
    !device
    || (typeof device !== 'object' && typeof device !== 'function')
    || typeof createBindGroupFn !== 'function'
    || !layout
    || (typeof layout !== 'object' && typeof layout !== 'function')
    || !Array.isArray(entries)
    || entries.length === 0
  ) {
    return device.createBindGroup(descriptor);
  }
  const cacheLabel = descriptor?.label
    ? String(descriptor.label).replace(/-\d+$/, '')
    : '';
  let key = cacheLabel ? `${cacheLabel}#` : '';
  for (let index = 0; index < entries.length; index += 1) {
    const entry = entries[index];
    const resource = entry?.resource;
    const buffer = resource?.buffer;
    if (!buffer || (typeof buffer !== 'object' && typeof buffer !== 'function')) {
      return device.createBindGroup(descriptor);
    }
    const offset = resource.offset === undefined ? -1 : Number(resource.offset);
    const size = resource.size === undefined ? -1 : Number(resource.size);
    if (index > 0) key += '|';
    key += `${entry.binding}:${gpuResourceId(buffer)}:${offset}:${size}`;
  }
  let byCreateFn = DEVICE_EXPLICIT_BIND_GROUP_CACHE.get(device);
  if (!byCreateFn) {
    byCreateFn = new WeakMap();
    DEVICE_EXPLICIT_BIND_GROUP_CACHE.set(device, byCreateFn);
  }
  let byLayout = byCreateFn.get(createBindGroupFn);
  if (!byLayout) {
    byLayout = new WeakMap();
    byCreateFn.set(createBindGroupFn, byLayout);
  }
  let cache = byLayout.get(layout);
  if (!cache) {
    cache = new Map();
    byLayout.set(layout, cache);
  }
  const cached = cache.get(key);
  if (cached) return cached;
  const bindGroup = device.createBindGroup(descriptor);
  if (cache.size >= MAX_CACHED_BIND_GROUPS_PER_LAYOUT) {
    const oldestKey = cache.keys().next().value;
    cache.delete(oldestKey);
  }
  cache.set(key, bindGroup);
  return bindGroup;
}

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

export const WEBGPU_RAW_DEVICE_SYMBOL = Symbol.for('ulg.webgpu.rawDevice');

export function unwrapWebGpuCacheDevice(device) {
  return device?.[WEBGPU_RAW_DEVICE_SYMBOL] ?? device;
}

function computePipelineCacheForDevice(device) {
  const keyDevice = unwrapWebGpuCacheDevice(device);
  let cache = DEVICE_COMPUTE_PIPELINE_CACHE.get(keyDevice);
  if (!cache) {
    cache = new Map();
    DEVICE_COMPUTE_PIPELINE_CACHE.set(keyDevice, cache);
  }
  return cache;
}

function shaderModuleCacheForDevice(device) {
  const keyDevice = unwrapWebGpuCacheDevice(device);
  let cache = DEVICE_SHADER_MODULE_CACHE.get(keyDevice);
  if (!cache) {
    cache = new Map();
    DEVICE_SHADER_MODULE_CACHE.set(keyDevice, cache);
  }
  return cache;
}

function explicitComputeLayoutCacheForDevice(device) {
  const keyDevice = unwrapWebGpuCacheDevice(device);
  let cache = DEVICE_EXPLICIT_COMPUTE_LAYOUT_CACHE.get(keyDevice);
  if (!cache) {
    cache = new Map();
    DEVICE_EXPLICIT_COMPUTE_LAYOUT_CACHE.set(keyDevice, cache);
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
  let out = '';
  for (let index = 0; index < bindings.length; index += 1) {
    const entry = bindings[index];
    if (index > 0) out += ';';
    out += `${entry.binding},${entry.visibility},`;
    if (entry.buffer) {
      out += `b:${entry.buffer.type || 'uniform'}:${entry.buffer.hasDynamicOffset === true ? 1 : 0}:${Number(entry.buffer.minBindingSize || 0)}`;
    } else {
      out += 'b:-';
    }
    if (entry.sampler != null) out += `,s:${JSON.stringify(entry.sampler)}`;
    if (entry.texture != null) out += `,t:${JSON.stringify(entry.texture)}`;
    if (entry.storageTexture != null) out += `,st:${JSON.stringify(entry.storageTexture)}`;
    if (entry.externalTexture != null) out += `,et:${JSON.stringify(entry.externalTexture)}`;
  }
  return out;
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
  const keyDevice = unwrapWebGpuCacheDevice(device);
  let inflight = DEVICE_PIPELINE_PREWARM_INFLIGHT.get(keyDevice);
  if (!inflight) {
    inflight = new Map();
    DEVICE_PIPELINE_PREWARM_INFLIGHT.set(keyDevice, inflight);
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
  // Park the cleanup on the burst; the flush schedules it on a real fence.
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
  let submittedWorkDone;
  try {
    submittedWorkDone = burst
      ? (requestCoalescedRealWorkDone(device, burst) ?? device.queue.onSubmittedWorkDone())
      : device.queue.onSubmittedWorkDone();
  } catch {
    // Some device-loss/mocked implementations fail synchronously while
    // creating the fence. There is no completion primitive to retain, but we
    // must still retire caller-owned resources exactly once instead of
    // replacing the original failure and leaking them.
    cleanup();
    return false;
  }
  Promise.resolve(submittedWorkDone)
    .catch(() => null)
    .finally(() => {
      cleanup();
    });
  return true;
}

const confirmedCleanupDeviceStates = new WeakMap();
const confirmedCleanupTickets = new WeakSet();

function confirmedCleanupDeviceState(device) {
  let state = confirmedCleanupDeviceStates.get(device);
  if (state) return state;
  state = { lost: false, cleanupDepth: 0, waiters: new Set() };
  confirmedCleanupDeviceStates.set(device, state);
  try {
    const loss = device.lost;
    if (loss && typeof loss.then === 'function') {
      Promise.resolve(loss).then(() => {
        state.lost = true;
        for (const ticket of [...state.waiters]) ticket.finish(false);
      }, () => {
        // An observer failure is not confirmation that the device stopped.
      });
    }
  } catch {
    // Without a usable loss observer, only a successful queue fence can retire.
  }
  return state;
}

function fenceConfirmedCleanup(ticket, requestFence, queue = null) {
  const observer = ticket.onQueueFenceRequested;
  ticket.onQueueFenceRequested = null;
  if (ticket.finished || typeof requestFence !== 'function') return;
  try {
    const observed = observer?.();
    if (observed && typeof observed.then === 'function') {
      Promise.resolve(observed).catch(() => {});
    }
  } catch {
    // Telemetry must never prevent the real fence or authorize retirement.
  }
  try {
    const fence = requestFence.call(queue);
    if (fence && typeof fence.then === 'function') {
      Promise.resolve(fence).then(() => ticket.finish(true), () => {
        try { ticket.onQueueFenceRejected?.(); } catch {}
        // Keep the cleanup quarantined until fulfilled device loss.
      });
    } else {
      try { ticket.onQueueFenceRejected?.(); } catch {}
    }
  } catch {
    try { ticket.onQueueFenceRejected?.(); } catch {}
    // A missing, throwing or rejected fence never authorizes cleanup.
  }
}

/**
 * Retire owned resources only after a successful queue fence or fulfilled
 * device loss. The result distinguishes queue completion (true) from terminal
 * loss (false); both execute cleanup once. Cleanup failures reject the promise.
 * One loss observer per device holds only pending cleanup tickets.
 * Optional onQueueFenceRequested observes actual fence attempts, including
 * throwing requests; held bursts notify only when the real fence is requested.
 */
export function deferConfirmedSubmittedWorkCleanup(device, cleanup, options = null) {
  if ((typeof device !== 'object' && typeof device !== 'function') || device === null
      || typeof cleanup !== 'function') {
    throw new TypeError('Confirmed cleanup requires a device and cleanup function');
  }
  const state = confirmedCleanupDeviceState(device);
  const ticket = { cleanup, onQueueFenceRequested: null, onQueueFenceRejected: null, finished: false, finish: null };
  try {
    const observer = options?.onQueueFenceRequested;
    if (typeof observer === 'function') ticket.onQueueFenceRequested = observer;
    const rejectObserver = options?.onQueueFenceRejected;
    if (typeof rejectObserver === 'function') ticket.onQueueFenceRejected = rejectObserver;
  } catch {
    // A telemetry accessor failure must not change cleanup behavior.
  }
  cleanup = null;
  options = null;
  confirmedCleanupTickets.add(ticket);
  const completion = new Promise((resolve, reject) => {
    ticket.finish = (queueCompleted) => {
      if (ticket.finished) return;
      ticket.finished = true;
      state.waiters.delete(ticket);
      const callback = ticket.cleanup;
      ticket.cleanup = null;
      ticket.onQueueFenceRequested = null;
      // These owned resources already have retirement proof. A newer burst
      // must not re-park their synchronous destroy calls behind another fence.
      state.cleanupDepth += 1;
      try {
        Promise.resolve(callback()).then(() => resolve(queueCompleted), reject);
      } catch (error) {
        reject(error);
      } finally {
        state.cleanupDepth -= 1;
      }
    };
  });
  if (state.lost) {
    ticket.finish(false);
    return completion;
  }
  state.waiters.add(ticket);
  const burst = workerQueueSubmitBurstRecords.get(device);
  if (burst?.open) {
    // A fence taken now would flush held work early. Preserve registration
    // order with ordinary cleanups; the flush starts this ticket's real fence.
    burst.deferredCleanups.push(ticket);
    burst.stats.deferredCleanupTotal += 1;
  } else {
    try {
      if (
        burst
        && typeof globalThis.GPUDevice === 'function'
        && device instanceof globalThis.GPUDevice
        && typeof burst.realOnSubmittedWorkDone === 'function'
      ) {
        fenceConfirmedCleanup(ticket, () => requestCoalescedRealWorkDone(device, burst));
      } else {
        const queue = device.queue;
        fenceConfirmedCleanup(ticket, queue?.onSubmittedWorkDone, queue);
      }
    } catch {
      ticket.onQueueFenceRequested = null;
      // A throwing queue accessor did not request a fence or prove retirement.
    }
  }
  return completion;
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
const WORKER_SUBMIT_BURST_POOLED_STAGING_INITIAL_BYTES = 512 * 1024;
const WORKER_SUBMIT_BURST_POOLED_STAGING_MAX_BYTES = 8 * 1024 * 1024;

function bumpWorkerQueueSubmitEpoch(record) {
  if (!record) return;
  record.submitEpoch += 1;
  record.epochFence = null;
}

// Share one queue.onSubmittedWorkDone() fence on a real GPUDevice when no
// real queue.submit / writeBuffer / writeTexture has occurred since the last
// fence request. Same-epoch fences await the exact same GPU queue timeline
// point, adding zero release latency while eliminating redundant Dawn IPC.
function requestCoalescedRealWorkDone(device, record) {
  if (
    !record
    || typeof record.realOnSubmittedWorkDone !== 'function'
    || typeof globalThis.GPUDevice !== 'function'
    || !(device instanceof globalThis.GPUDevice)
  ) {
    return null;
  }
  const epoch = record.submitEpoch;
  if (record.epochFence && record.epochFence.epoch === epoch) {
    return record.epochFence.promise;
  }
  const raw = record.realOnSubmittedWorkDone();
  if (!raw || typeof raw.then !== 'function') {
    return raw;
  }
  const entry = { epoch, promise: null };
  const promise = Promise.resolve(raw).then(
    (value) => value,
    (error) => {
      if (record.epochFence === entry) record.epochFence = null;
      throw error;
    }
  );
  // Keep shared rejection observable by callers without unhandled-rejection noise.
  promise.catch(() => {});
  entry.promise = promise;
  record.epochFence = entry;
  return promise;
}

function workerQueueSubmitBurstError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function createCoalescingComputeCommandEncoder(
  rawEncoder,
  { onRenderPass = null, bindGroupBuffers = null } = {}
) {
  let pendingOps = [];
  let pendingLabel = null;
  let touchedBuffers = new Set();
  let unknownBuffersTouched = false;
  let hasRenderPass = false;

  const noteBuffer = (buffer) => {
    if (buffer) touchedBuffers.add(buffer);
    else unknownBuffersTouched = true;
  };

  const noteBindGroup = (bindGroup) => {
    if (!bindGroup) return;
    const buffers = bindGroupBuffers?.get(bindGroup);
    if (!buffers) {
      unknownBuffersTouched = true;
      return;
    }
    for (let i = 0; i < buffers.length; i += 1) {
      touchedBuffers.add(buffers[i]);
    }
  };

  const flushPendingCompute = () => {
    if (pendingOps.length === 0) return;
    const ops = pendingOps;
    const label = pendingLabel;
    pendingOps = [];
    pendingLabel = null;
    touchedBuffers = new Set();
    unknownBuffersTouched = false;
    const pass = label !== null && label !== undefined
      ? rawEncoder.beginComputePass({ label })
      : rawEncoder.beginComputePass();
    let activePipeline = null;
    for (let i = 0; i < ops.length; i += 1) {
      const op = ops[i];
      if (op.kind === 'pipeline') {
        if (op.pipeline !== activePipeline) {
          activePipeline = op.pipeline;
          pass.setPipeline(op.pipeline);
        }
      } else if (op.kind === 'bindGroup') {
        if (op.extra) pass.setBindGroup(op.index, op.bindGroup, ...op.extra);
        else pass.setBindGroup(op.index, op.bindGroup);
      } else if (op.kind === 'dispatch') {
        if (op.z !== undefined) pass.dispatchWorkgroups(op.x, op.y, op.z);
        else if (op.y !== undefined) pass.dispatchWorkgroups(op.x, op.y);
        else pass.dispatchWorkgroups(op.x);
      } else if (op.kind === 'dispatchIndirect') {
        pass.dispatchWorkgroupsIndirect(op.buffer, op.offset);
      } else if (op.kind === 'pushDebugGroup') {
        pass.pushDebugGroup?.(op.label);
      } else if (op.kind === 'popDebugGroup') {
        pass.popDebugGroup?.();
      } else if (op.kind === 'insertDebugMarker') {
        pass.insertDebugMarker?.(op.label);
      }
    }
    pass.end();
  };

  const sharedPassProxy = {
    setPipeline(pipeline) {
      pendingOps.push({ kind: 'pipeline', pipeline });
    },
    setBindGroup(index, bindGroup, ...rest) {
      noteBindGroup(bindGroup);
      const extra = rest.length > 0
        ? rest.map((arg) => (Array.isArray(arg) ? arg.slice() : ArrayBuffer.isView(arg) ? new Uint32Array(arg) : arg))
        : null;
      pendingOps.push({ kind: 'bindGroup', index, bindGroup, extra });
    },
    dispatchWorkgroups(x, y, z) {
      pendingOps.push({ kind: 'dispatch', x, y, z });
    },
    dispatchWorkgroupsIndirect(indirectBuffer, indirectOffset) {
      noteBuffer(indirectBuffer);
      pendingOps.push({
        kind: 'dispatchIndirect',
        buffer: indirectBuffer,
        offset: indirectOffset
      });
    },
    pushDebugGroup(label) {
      pendingOps.push({ kind: 'pushDebugGroup', label });
    },
    popDebugGroup() {
      pendingOps.push({ kind: 'popDebugGroup' });
    },
    insertDebugMarker(label) {
      pendingOps.push({ kind: 'insertDebugMarker', label });
    },
    end() {
      // Kept buffered so consecutive compute passes (and disjoint-buffer
      // clearBuffer/copyBufferToBuffer setup calls) coalesce into one
      // hardware GPUComputePassEncoder.
    }
  };
  const wrapper = {
    get label() {
      return rawEncoder.label;
    },
    beginComputePass(descriptor) {
      if (descriptor?.timestampWrites) {
        flushPendingCompute();
        return rawEncoder.beginComputePass(descriptor);
      }
      if (pendingOps.length === 0 && pendingLabel === null) {
        pendingLabel = descriptor?.label ?? null;
      }
      return sharedPassProxy;
    },
    beginRenderPass(descriptor) {
      flushPendingCompute();
      hasRenderPass = true;
      return rawEncoder.beginRenderPass(descriptor);
    },
    clearBuffer(buffer, ...rest) {
      if (
        pendingOps.length > 0
        && (unknownBuffersTouched || !buffer || touchedBuffers.has(buffer))
      ) {
        flushPendingCompute();
      }
      return rawEncoder.clearBuffer(buffer, ...rest);
    },
    copyBufferToBuffer(source, sourceOffset, destination, destinationOffset, size) {
      if (
        pendingOps.length > 0
        && (
          unknownBuffersTouched
          || !source
          || !destination
          || touchedBuffers.has(source)
          || touchedBuffers.has(destination)
        )
      ) {
        flushPendingCompute();
      }
      return rawEncoder.copyBufferToBuffer(
        source,
        sourceOffset,
        destination,
        destinationOffset,
        size
      );
    },
    copyBufferToTexture(...args) {
      flushPendingCompute();
      return rawEncoder.copyBufferToTexture(...args);
    },
    copyTextureToBuffer(...args) {
      flushPendingCompute();
      return rawEncoder.copyTextureToBuffer(...args);
    },
    copyTextureToTexture(...args) {
      flushPendingCompute();
      return rawEncoder.copyTextureToTexture(...args);
    },
    resolveQuerySet(...args) {
      flushPendingCompute();
      return rawEncoder.resolveQuerySet(...args);
    },
    writeTimestamp(...args) {
      flushPendingCompute();
      return rawEncoder.writeTimestamp(...args);
    },
    pushDebugGroup(...args) {
      flushPendingCompute();
      return rawEncoder.pushDebugGroup?.(...args);
    },
    popDebugGroup(...args) {
      flushPendingCompute();
      return rawEncoder.popDebugGroup?.(...args);
    },
    insertDebugMarker(...args) {
      flushPendingCompute();
      return rawEncoder.insertDebugMarker?.(...args);
    },
    finish(descriptor) {
      flushPendingCompute();
      const commandBuffer = descriptor !== undefined
        ? rawEncoder.finish(descriptor)
        : rawEncoder.finish();
      if (hasRenderPass && typeof onRenderPass === 'function') {
        onRenderPass(commandBuffer);
      }
      return commandBuffer;
    }
  };
  return wrapper;
}

const VIRTUAL_BURST_COMPUTE_OPS = Symbol('ulg.virtualBurstComputeOps');

function hasHeldBurstWork(record) {
  return Boolean(record && (record.heldCommandBuffers.length > 0 || record.sharedBurstEncoderHasOps));
}

function ensureSharedBurstEncoder(device, record) {
  if (record.sharedBurstEncoder) return record.sharedBurstEncoder;
  const raw = record.realCreateCommandEncoder({ label: 'ulg-submit-burst-shared' });
  record.sharedBurstEncoder = createCoalescingComputeCommandEncoder(raw, {
    bindGroupBuffers: record.bindGroupBuffers
  });
  return record.sharedBurstEncoder;
}

function sealSharedBurstEncoder(record) {
  if (!record.sharedBurstEncoder) return;
  const enc = record.sharedBurstEncoder;
  record.sharedBurstEncoder = null;
  record.sharedBurstEncoderHasOps = false;
  record.heldCommandBuffers.push(enc.finish());
  record.heldSubmitStamp = record.createStamp;
  if (record.heldCommandBuffers.length > record.stats.maxHeldCommandBuffers) {
    record.stats.maxHeldCommandBuffers = record.heldCommandBuffers.length;
  }
}

function replayVirtualBurstComputeOps(targetEncoder, ops) {
  for (let i = 0; i < ops.length; i += 1) {
    const op = ops[i];
    if (op.kind === 'computePass') {
      const pass = op.descriptor !== undefined
        ? targetEncoder.beginComputePass(op.descriptor)
        : targetEncoder.beginComputePass();
      const passOps = op.ops;
      for (let j = 0; j < passOps.length; j += 1) {
        const p = passOps[j];
        if (p.kind === 'pipeline') pass.setPipeline(p.pipeline);
        else if (p.kind === 'bindGroup') {
          if (p.extra) pass.setBindGroup(p.index, p.bindGroup, ...p.extra);
          else pass.setBindGroup(p.index, p.bindGroup);
        } else if (p.kind === 'dispatch') {
          if (p.z !== undefined) pass.dispatchWorkgroups(p.x, p.y, p.z);
          else if (p.y !== undefined) pass.dispatchWorkgroups(p.x, p.y);
          else pass.dispatchWorkgroups(p.x);
        } else if (p.kind === 'dispatchIndirect') {
          pass.dispatchWorkgroupsIndirect(p.buffer, p.offset);
        } else if (p.kind === 'pushDebugGroup') {
          pass.pushDebugGroup?.(p.label);
        } else if (p.kind === 'popDebugGroup') {
          pass.popDebugGroup?.();
        } else if (p.kind === 'insertDebugMarker') {
          pass.insertDebugMarker?.(p.label);
        }
      }
      pass.end();
    } else if (op.kind === 'clearBuffer') {
      targetEncoder.clearBuffer(op.buffer, ...op.rest);
    } else if (op.kind === 'copyBufferToBuffer') {
      targetEncoder.copyBufferToBuffer(
        op.source,
        op.sourceOffset,
        op.destination,
        op.destinationOffset,
        op.size
      );
    } else if (op.kind === 'pushDebugGroup') {
      targetEncoder.pushDebugGroup?.(...op.args);
    } else if (op.kind === 'popDebugGroup') {
      targetEncoder.popDebugGroup?.(...op.args);
    } else if (op.kind === 'insertDebugMarker') {
      targetEncoder.insertDebugMarker?.(...op.args);
    }
  }
}

function createVirtualBurstComputeEncoder(device, record, descriptor, markRenderPass) {
  let ops = [];
  let materialized = null;

  const materialize = () => {
    if (materialized) return materialized;
    const raw = descriptor !== undefined
      ? record.realCreateCommandEncoder(descriptor)
      : record.realCreateCommandEncoder();
    materialized = typeof raw?.beginComputePass === 'function'
      ? createCoalescingComputeCommandEncoder(raw, {
          onRenderPass: markRenderPass,
          bindGroupBuffers: record.bindGroupBuffers
        })
      : raw;
    if (ops.length > 0 && materialized) {
      replayVirtualBurstComputeOps(materialized, ops);
      ops = [];
    }
    return materialized;
  };

  return {
    get label() {
      return materialized ? materialized.label : (descriptor?.label ?? '');
    },
    beginComputePass(passDescriptor) {
      if (materialized) return materialized.beginComputePass(passDescriptor);
      if (passDescriptor?.timestampWrites) {
        return materialize().beginComputePass(passDescriptor);
      }
      const passOps = [];
      ops.push({ kind: 'computePass', descriptor: passDescriptor, ops: passOps });
      return {
        setPipeline(pipeline) {
          passOps.push({ kind: 'pipeline', pipeline });
        },
        setBindGroup(index, bindGroup, ...rest) {
          const extra = rest.length > 0
            ? rest.map((arg) => (Array.isArray(arg) ? arg.slice() : ArrayBuffer.isView(arg) ? new Uint32Array(arg) : arg))
            : null;
          passOps.push({ kind: 'bindGroup', index, bindGroup, extra });
        },
        dispatchWorkgroups(x, y, z) {
          passOps.push({ kind: 'dispatch', x, y, z });
        },
        dispatchWorkgroupsIndirect(buffer, offset) {
          passOps.push({ kind: 'dispatchIndirect', buffer, offset });
        },
        pushDebugGroup(label) {
          passOps.push({ kind: 'pushDebugGroup', label });
        },
        popDebugGroup() {
          passOps.push({ kind: 'popDebugGroup' });
        },
        insertDebugMarker(label) {
          passOps.push({ kind: 'insertDebugMarker', label });
        },
        end() {}
      };
    },
    beginRenderPass(passDescriptor) {
      return materialize().beginRenderPass(passDescriptor);
    },
    clearBuffer(buffer, ...rest) {
      if (materialized) return materialized.clearBuffer(buffer, ...rest);
      ops.push({ kind: 'clearBuffer', buffer, rest });
    },
    copyBufferToBuffer(source, sourceOffset, destination, destinationOffset, size) {
      if (materialized) {
        return materialized.copyBufferToBuffer(source, sourceOffset, destination, destinationOffset, size);
      }
      ops.push({ kind: 'copyBufferToBuffer', source, sourceOffset, destination, destinationOffset, size });
    },
    copyBufferToTexture(...args) {
      return materialize().copyBufferToTexture(...args);
    },
    copyTextureToBuffer(...args) {
      return materialize().copyTextureToBuffer(...args);
    },
    copyTextureToTexture(...args) {
      return materialize().copyTextureToTexture(...args);
    },
    resolveQuerySet(...args) {
      return materialize().resolveQuerySet(...args);
    },
    writeTimestamp(...args) {
      return materialize().writeTimestamp(...args);
    },
    pushDebugGroup(...args) {
      if (materialized) return materialized.pushDebugGroup?.(...args);
      ops.push({ kind: 'pushDebugGroup', args });
    },
    popDebugGroup(...args) {
      if (materialized) return materialized.popDebugGroup?.(...args);
      ops.push({ kind: 'popDebugGroup', args });
    },
    insertDebugMarker(...args) {
      if (materialized) return materialized.insertDebugMarker?.(...args);
      ops.push({ kind: 'insertDebugMarker', args });
    },
    finish(finishDescriptor) {
      if (materialized) {
        return finishDescriptor !== undefined
          ? materialized.finish(finishDescriptor)
          : materialized.finish();
      }
      const frozenOps = ops;
      ops = [];
      return Object.freeze({
        [VIRTUAL_BURST_COMPUTE_OPS]: frozenOps,
        label: finishDescriptor?.label ?? descriptor?.label ?? ''
      });
    }
  };
}

function workerQueueSubmitBurstSealPooledCopies(device, record) {
  const pending = record.pooledPendingCopies;
  if (!pending || pending.length === 0) return;
  record.pooledPendingCopies = [];
  if (!record.pooledStagingBuffer || typeof device.createCommandEncoder !== 'function') {
    return;
  }
  if (
    record.open
    && record.coalesceComputePassesEnabled
    && record.pooledWriteThroughEnabled
    && typeof record.realCreateCommandEncoder === 'function'
  ) {
    const shared = ensureSharedBurstEncoder(device, record);
    for (let i = 0; i < pending.length; i += 1) {
      const copy = pending[i];
      shared.copyBufferToBuffer(
        record.pooledStagingBuffer,
        copy.sourceOffset,
        copy.target,
        copy.targetOffset,
        copy.byteLength
      );
    }
    record.sharedBurstEncoderHasOps = true;
    record.heldSubmitStamp = record.createStamp;
    return;
  }
  const encoder = (record.realCreateCommandEncoder || device.createCommandEncoder).call(
    device,
    { label: 'ulg-submit-burst-pooled-write-through' }
  );
  for (let i = 0; i < pending.length; i += 1) {
    const copy = pending[i];
    encoder.copyBufferToBuffer(
      record.pooledStagingBuffer,
      copy.sourceOffset,
      copy.target,
      copy.targetOffset,
      copy.byteLength
    );
  }
  record.heldCommandBuffers.push(encoder.finish());
  record.heldSubmitStamp = record.createStamp;
  if (record.heldCommandBuffers.length > record.stats.maxHeldCommandBuffers) {
    record.stats.maxHeldCommandBuffers = record.heldCommandBuffers.length;
  }
}

function workerQueueSubmitBurstPooledWriteThrough(
  device,
  record,
  buffer,
  bufferOffset,
  data,
  dataOffset,
  size
) {
  if (
    typeof device.createCommandEncoder !== 'function'
    || typeof record.realWriteBuffer !== 'function'
  ) {
    return false;
  }
  const targetOffset = Number(bufferOffset) || 0;
  if (targetOffset < 0 || targetOffset % 4 !== 0) return false;
  let bytes;
  try {
    bytes = workerQueueSubmitBurstWriteThroughBytes(data, dataOffset, size);
  } catch {
    bytes = null;
  }
  if (!bytes || bytes.byteLength === 0 || bytes.byteLength % 4 !== 0) {
    return false;
  }
  if (bytes.byteLength > WORKER_SUBMIT_BURST_POOLED_STAGING_MAX_BYTES) {
    return false;
  }
  const copySrcUsage = globalThis.GPUBufferUsage?.COPY_SRC ?? 0x0004;
  const copyDstUsage = globalThis.GPUBufferUsage?.COPY_DST ?? 0x0008;
  if (!record.pooledStagingBuffer) {
    let targetCap = Math.max(
      record.pooledStagingTargetCapacity || WORKER_SUBMIT_BURST_POOLED_STAGING_INITIAL_BYTES,
      bytes.byteLength
    );
    targetCap = Math.min(
      WORKER_SUBMIT_BURST_POOLED_STAGING_MAX_BYTES,
      Math.ceil(targetCap / 4) * 4
    );
    try {
      record.pooledStagingBuffer = record.realCreateBuffer({
        label: 'ulg-submit-burst-pooled-staging',
        size: targetCap,
        usage: copySrcUsage | copyDstUsage
      });
      record.pooledStagingCapacity = targetCap;
      record.pooledStagingBytes = new Uint8Array(targetCap);
      record.pooledStagingCursor = 0;
    } catch {
      record.pooledStagingBuffer = null;
      record.pooledStagingCapacity = 0;
      record.pooledStagingBytes = null;
      return false;
    }
  }
  if (record.pooledStagingCursor + bytes.byteLength > record.pooledStagingCapacity) {
    // Request a larger slab after the caller flushes the current burst so
    // earlier held copies never lose their referenced staging buffer.
    const desired = Math.min(
      WORKER_SUBMIT_BURST_POOLED_STAGING_MAX_BYTES,
      Math.max(record.pooledStagingCapacity * 2, bytes.byteLength)
    );
    if (desired > record.pooledStagingCapacity) {
      record.pooledStagingGrowRequested = desired;
    }
    return false;
  }
  const sourceOffset = record.pooledStagingCursor;
  record.pooledStagingBytes.set(bytes, sourceOffset);
  record.pooledStagingCursor = sourceOffset + bytes.byteLength;
  record.pooledPendingCopies.push({
    target: buffer,
    targetOffset,
    sourceOffset,
    byteLength: bytes.byteLength
  });
  return true;
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
  let staging = null;
  try {
    bytes = workerQueueSubmitBurstWriteThroughBytes(data, dataOffset, size);
  } catch {
    bytes = null;
  }
  if (!bytes || bytes.byteLength === 0 || bytes.byteLength % 4 !== 0) {
    return false;
  }
  try {
    staging = device.createBuffer({
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
    // queue.submit takes ownership of the command-buffer resource references.
    // Once the real submit returns, destroy may retire this one-use staging
    // allocation without a host fence; WebGPU keeps previously submitted uses
    // alive until the queue is finished with them. Generic arena cleanups stay
    // on deferredCleanups because their release latency also gates reuse.
    record.postSubmitCleanups.push(() => {
      staging.destroy?.();
    });
    record.stats.postSubmitCleanupTotal += 1;
    return true;
  } catch {
    try {
      staging?.destroy?.();
    } catch {
      // A failed write-through falls back to the order-preserving flush path.
    }
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
    pooledWriteThroughEnabled: false,
    coalesceComputePassesEnabled: false,
    pooledStagingBuffer: null,
    pooledStagingCapacity: 0,
    pooledStagingTargetCapacity: WORKER_SUBMIT_BURST_POOLED_STAGING_INITIAL_BYTES,
    pooledStagingGrowRequested: 0,
    pooledStagingBytes: null,
    pooledStagingCursor: 0,
    pooledPendingCopies: [],
    // Monotonic creation counter; a buffer stamped after the last held
    // submit cannot be referenced by any held command buffer.
    createStamp: 0,
    heldSubmitStamp: 0,
    submitEpoch: 0,
    epochFence: null,
    heldCommandBuffers: [],
    sharedBurstEncoder: null,
    sharedBurstEncoderHasOps: false,
    postSubmitCleanups: [],
    deferredCleanups: [],
    bufferStamps: new WeakMap(),
    bindGroupBuffers: new WeakMap(),
    renderPassCommandBuffers: new WeakSet(),
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
    realCreateTexture: typeof device.createTexture === 'function'
      ? device.createTexture.bind(device)
      : null,
    realCreateBindGroup: typeof device.createBindGroup === 'function'
      ? device.createBindGroup.bind(device)
      : null,
    realCreateCommandEncoder: typeof device.createCommandEncoder === 'function'
      ? device.createCommandEncoder.bind(device)
      : null,
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
      pooledWriteThroughCount: 0,
      writeThroughLabels: {},
      fenceFlushCount: 0,
      cadenceFlushCount: 0,
      closeFlushCount: 0,
      postSubmitCleanupTotal: 0,
      deferredCleanupTotal: 0,
      deferredDestroyTotal: 0,
      immediateDestroyTotal: 0
    }
  };
  workerQueueSubmitBurstRecords.set(device, record);
  queue.submit = (commandBuffers) => {
    if (record.open) {
      if (record.pooledPendingCopies.length > 0) {
        workerQueueSubmitBurstSealPooledCopies(device, record);
      }
      let containsRenderPass = false;
      for (const commandBuffer of commandBuffers) {
        const virtualOps = commandBuffer && typeof commandBuffer === 'object'
          ? commandBuffer[VIRTUAL_BURST_COMPUTE_OPS]
          : null;
        if (Array.isArray(virtualOps)) {
          if (virtualOps.length > 0) {
            replayVirtualBurstComputeOps(ensureSharedBurstEncoder(device, record), virtualOps);
            record.sharedBurstEncoderHasOps = true;
          }
          continue;
        }
        sealSharedBurstEncoder(record);
        if (commandBuffer && typeof commandBuffer === 'object'
            && record.renderPassCommandBuffers.has(commandBuffer)) {
          containsRenderPass = true;
        }
        record.heldCommandBuffers.push(commandBuffer);
      }
      record.heldSubmitStamp = record.createStamp;
      record.stats.heldSubmitTotal += 1;
      if (record.heldCommandBuffers.length > record.stats.maxHeldCommandBuffers) {
        record.stats.maxHeldCommandBuffers = record.heldCommandBuffers.length;
      }
      if (containsRenderPass) {
        // Render passes may reference ephemeral swapchain textures from
        // context.getCurrentTexture() that expire at the end of the frame, so
        // flush immediately on render-pass submission to keep them valid.
        flushWorkerQueueSubmitBurst(device, 'render-pass-submit');
      }
      return undefined;
    }
    const materialized = [];
    for (const commandBuffer of commandBuffers) {
      const virtualOps = commandBuffer && typeof commandBuffer === 'object'
        ? commandBuffer[VIRTUAL_BURST_COMPUTE_OPS]
        : null;
      if (Array.isArray(virtualOps)) {
        if (virtualOps.length > 0 && record.realCreateCommandEncoder) {
          const raw = record.realCreateCommandEncoder({ label: commandBuffer.label || 'ulg-virtual-fallback' });
          const enc = createCoalescingComputeCommandEncoder(raw, { bindGroupBuffers: record.bindGroupBuffers });
          replayVirtualBurstComputeOps(enc, virtualOps);
          materialized.push(enc.finish());
        }
      } else {
        materialized.push(commandBuffer);
      }
    }
    record.stats.directSubmitTotal += 1;
    bumpWorkerQueueSubmitEpoch(record);
    return record.realSubmit(materialized);
  };
  if (record.realWriteBuffer) {
    queue.writeBuffer = (buffer, bufferOffset, data, dataOffset, size) => {
      if (record.open && hasHeldBurstWork(record)) {
        const stamp = record.bufferStamps.get(buffer);
        if (!(typeof stamp === 'number' && stamp > record.heldSubmitStamp)) {
          // The target buffer may be referenced by a held command buffer, so
          // an immediate write would land BEFORE commands that were encoded
          // against the buffer's current contents. Three order-preserving
          // responses exist: flush first (default), pooled reusable-slab copy
          // (zero createBuffer per write; one realWriteBuffer before realSubmit),
          // or per-write staging copy (legacy writeThrough).
          const pooledWriteThrough = record.pooledWriteThroughEnabled
            && workerQueueSubmitBurstPooledWriteThrough(
              device,
              record,
              buffer,
              bufferOffset,
              data,
              dataOffset,
              size
            );
          if (pooledWriteThrough) {
            const label = String(buffer?.label || 'unlabeled');
            record.stats.writeThroughCount += 1;
            record.stats.pooledWriteThroughCount += 1;
            record.stats.writeThroughLabels[label] =
              (record.stats.writeThroughLabels[label] || 0) + 1;
            return undefined;
          }
          const writeThrough = !record.pooledWriteThroughEnabled
            && record.writeThroughEnabled
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
      bumpWorkerQueueSubmitEpoch(record);
      return record.realWriteBuffer(buffer, bufferOffset, data, dataOffset, size);
    };
  }
  if (record.realWriteTexture) {
    queue.writeTexture = (...writeArgs) => {
      if (record.open && hasHeldBurstWork(record)) {
        record.stats.staleWriteFlushCount += 1;
        flushWorkerQueueSubmitBurst(device, 'write-texture');
      }
      bumpWorkerQueueSubmitEpoch(record);
      return record.realWriteTexture(...writeArgs);
    };
  }
  if (record.realOnSubmittedWorkDone) {
    queue.onSubmittedWorkDone = () => {
      if (record.open && hasHeldBurstWork(record)) {
        record.stats.fenceFlushCount += 1;
        flushWorkerQueueSubmitBurst(device, 'fence-request');
      }
      const coalesced = requestCoalescedRealWorkDone(device, record);
      if (coalesced !== null) return coalesced;
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
        queueOrderedDestroyedBuffers.add(buffer);
        const stamp = record.bufferStamps.get(buffer);
        const confirmedCleanup = confirmedCleanupDeviceStates.get(device);
        if (
          record.open
          && hasHeldBurstWork(record)
          && confirmedCleanup?.lost !== true
          && !(confirmedCleanup?.cleanupDepth > 0)
          && !(typeof stamp === 'number' && stamp > record.heldSubmitStamp)
        ) {
          if (record.pooledWriteThroughEnabled) {
            // Once realSubmit(held) accepts the command buffers, WebGPU keeps
            // referenced buffers alive until GPU completion, so synchronous
            // post-submit destroy needs zero onSubmittedWorkDone fences.
            record.postSubmitCleanups.push(realDestroy);
            record.stats.postSubmitCleanupTotal += 1;
          } else {
            record.deferredCleanups.push(realDestroy);
          }
          record.stats.deferredDestroyTotal += 1;
          return undefined;
        }
        record.stats.immediateDestroyTotal += 1;
        return realDestroy();
      };
    }
    if (typeof buffer?.mapAsync === 'function') {
      const realMapAsync = buffer.mapAsync.bind(buffer);
      buffer.mapAsync = (...mapArgs) => {
        if (record.open && hasHeldBurstWork(record)) {
          flushWorkerQueueSubmitBurst(device, 'map-async');
        }
        return realMapAsync(...mapArgs);
      };
    }
    return buffer;
  };
  if (record.realCreateTexture) {
    device.createTexture = (descriptor) => {
      const texture = record.realCreateTexture(descriptor);
      record.createStamp += 1;
      record.bufferStamps.set(texture, record.createStamp);
      if (typeof texture?.destroy === 'function') {
        const realDestroy = texture.destroy.bind(texture);
        let destroyed = false;
        texture.destroy = () => {
          if (destroyed) return undefined;
          destroyed = true;
          const stamp = record.bufferStamps.get(texture);
          const confirmedCleanup = confirmedCleanupDeviceStates.get(device);
          if (
            record.open
            && hasHeldBurstWork(record)
            && confirmedCleanup?.lost !== true
            && !(confirmedCleanup?.cleanupDepth > 0)
            && !(typeof stamp === 'number' && stamp > record.heldSubmitStamp)
          ) {
            if (record.pooledWriteThroughEnabled) {
              record.postSubmitCleanups.push(realDestroy);
              record.stats.postSubmitCleanupTotal += 1;
            } else {
              record.deferredCleanups.push(realDestroy);
            }
            record.stats.deferredDestroyTotal += 1;
            return undefined;
          }
          record.stats.immediateDestroyTotal += 1;
          return realDestroy();
        };
      }
      return texture;
    };
  }
  if (record.realCreateBindGroup) {
    device.createBindGroup = (descriptor) => {
      const group = record.realCreateBindGroup(descriptor);
      if (group && typeof group === 'object' && Array.isArray(descriptor?.entries)) {
        const buffers = [];
        for (let i = 0; i < descriptor.entries.length; i += 1) {
          const buf = descriptor.entries[i]?.resource?.buffer;
          if (buf) buffers.push(buf);
        }
        record.bindGroupBuffers.set(group, buffers);
      }
      return group;
    };
  }
  if (record.realCreateCommandEncoder) {
    device.createCommandEncoder = (descriptor) => {
      const markRenderPass = (commandBuffer) => {
        if (commandBuffer && typeof commandBuffer === 'object') {
          record.renderPassCommandBuffers.add(commandBuffer);
        }
      };
      if (
        record.open
        && record.coalesceComputePassesEnabled
        && record.pooledWriteThroughEnabled
      ) {
        return createVirtualBurstComputeEncoder(device, record, descriptor, markRenderPass);
      }
      const raw = descriptor !== undefined
        ? record.realCreateCommandEncoder(descriptor)
        : record.realCreateCommandEncoder();
      if (!record.open || !raw) return raw;
      if (
        record.coalesceComputePassesEnabled
        && typeof raw.beginComputePass === 'function'
      ) {
        return createCoalescingComputeCommandEncoder(raw, {
          onRenderPass: markRenderPass,
          bindGroupBuffers: record.bindGroupBuffers
        });
      }
      if (typeof raw.beginRenderPass === 'function' && typeof raw.finish === 'function') {
        let sawRenderPass = false;
        const origBeginRender = raw.beginRenderPass.bind(raw);
        const origFinish = raw.finish.bind(raw);
        raw.beginRenderPass = (desc) => {
          sawRenderPass = true;
          return origBeginRender(desc);
        };
        raw.finish = (desc) => {
          const cb = desc !== undefined ? origFinish(desc) : origFinish();
          if (sawRenderPass) markRenderPass(cb);
          return cb;
        };
      }
      return raw;
    };
  }
  return record;
}

/**
 * Diagnostic hook below the submit burst: wrap the burst's real
 * createCommandEncoder so pass-timestamp instrumentation sees the actual
 * coalesced hardware compute passes.
 */
export function wrapWorkerQueueRealCreateCommandEncoder(device, wrap) {
  const record = workerQueueSubmitBurstRecords.get(device);
  if (!record || !record.realCreateCommandEncoder) return false;
  record.realCreateCommandEncoder = wrap(record.realCreateCommandEncoder);
  return true;
}

/**
 * Diagnostic hook below the submit burst: wrap the burst's real submit (the
 * point where held command buffers truly reach the queue). Anything that maps
 * a buffer written by a command buffer must hook here, or it maps before a
 * held buffer's real submit and that submit fails validation ("used in submit
 * while mapped"), silently dropping the batch. Returns false when the device
 * has no burst record (then queue.submit is the real submit).
 */
export function wrapWorkerQueueRealSubmit(device, wrap) {
  const record = workerQueueSubmitBurstRecords.get(device);
  if (!record) return false;
  record.realSubmit = wrap(record.realSubmit);
  return true;
}

export function openWorkerQueueSubmitBurst(device, {
  label = null,
  writeThrough = false,
  pooledWriteThrough = false,
  coalesceComputePasses = false
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
  record.pooledWriteThroughEnabled = pooledWriteThrough === true;
  record.coalesceComputePassesEnabled = coalesceComputePasses === true;
  record.stats.openCount += 1;
  return record;
}

export function flushWorkerQueueSubmitBurst(device, reason = 'explicit') {
  const record = workerQueueSubmitBurstRecords.get(device);
  if (!record) return null;
  if (record.pooledPendingCopies.length > 0) {
    workerQueueSubmitBurstSealPooledCopies(device, record);
  }
  sealSharedBurstEncoder(record);
  const pooledUploadBytes = record.pooledStagingCursor;
  const pooledStagingBuffer = record.pooledStagingBuffer;
  const pooledStagingBytes = record.pooledStagingBytes;
  record.pooledStagingCursor = 0;
  const held = record.heldCommandBuffers;
  const postSubmitCleanups = record.postSubmitCleanups;
  const cleanups = record.deferredCleanups;
  record.heldCommandBuffers = [];
  record.postSubmitCleanups = [];
  record.deferredCleanups = [];
  record.heldSubmitStamp = record.createStamp;
  let submitError = null;
  if (held.length > 0) {
    record.stats.flushCount += 1;
    record.stats.flushSubmitCount += held.length;
    if (reason === 'step-cadence') record.stats.cadenceFlushCount += 1;
    if (reason === 'burst-close') record.stats.closeFlushCount += 1;
    try {
      if (pooledUploadBytes > 0 && pooledStagingBuffer && pooledStagingBytes) {
        // Queue-timeline ordered BEFORE realSubmit(held) and AFTER any prior
        // flush's realSubmit, so one reusable slab serves all bursts safely.
        bumpWorkerQueueSubmitEpoch(record);
        record.realWriteBuffer(
          pooledStagingBuffer,
          0,
          pooledStagingBytes,
          0,
          pooledUploadBytes
        );
      }
      bumpWorkerQueueSubmitEpoch(record);
      record.realSubmit(held);
    } catch (error) {
      submitError = error;
    }
  }
  if (record.pooledStagingGrowRequested > record.pooledStagingCapacity) {
    const oldSlab = record.pooledStagingBuffer;
    record.pooledStagingTargetCapacity = record.pooledStagingGrowRequested;
    record.pooledStagingGrowRequested = 0;
    record.pooledStagingBuffer = null;
    record.pooledStagingCapacity = 0;
    record.pooledStagingBytes = null;
    if (oldSlab) {
      postSubmitCleanups.push(() => {
        oldSlab.destroy?.();
      });
    }
  }
  // These cleanups own disposable staging resources only. The real submit has
  // either accepted their command buffers or failed, so they can be destroyed
  // synchronously without manufacturing an onSubmittedWorkDone fence.
  for (const cleanup of postSubmitCleanups) {
    try {
      cleanup();
    } catch {
      // Cleanup failures must not mask the submit error.
    }
  }
  // On a real GPUDevice, all deferred cleanups flushed here were submitted in
  // the exact same submitEpoch above, so sharing one epoch-coalesced
  // realOnSubmittedWorkDone() fence preserves zero-delay release latency while
  // avoiding redundant Dawn/Vulkan queue-fence callbacks per flush.
  const canShareFlushFence = cleanups.length > 0
    && typeof globalThis.GPUDevice === 'function'
    && device instanceof globalThis.GPUDevice
    && typeof record.realOnSubmittedWorkDone === 'function';
  let sharedFencePromise = null;
  let sharedFenceFailed = false;
  if (canShareFlushFence) {
    try {
      const candidate = requestCoalescedRealWorkDone(device, record);
      if (candidate && typeof candidate.then === 'function') {
        sharedFencePromise = Promise.resolve(candidate);
      } else {
        sharedFenceFailed = true;
      }
    } catch {
      sharedFenceFailed = true;
    }
  }
  const sharedRequestFence = canShareFlushFence
    ? () => (sharedFenceFailed ? undefined : sharedFencePromise)
    : record.realOnSubmittedWorkDone;
  // One real fence per cleanup on mock/non-GPUDevice paths, matching
  // deferSubmittedWorkCleanup's documented contract; shared single flush fence
  // on real GPUDevice. Legacy cleanups still run if submit failed or the fence
  // API is unavailable; confirmed tickets require proof.
  for (const cleanup of cleanups) {
    if (confirmedCleanupTickets.has(cleanup)) {
      // Even a submit that throws may have delegated commands. Only this
      // ticket's real fence or confirmed device loss can retire its resources.
      fenceConfirmedCleanup(cleanup, sharedRequestFence);
      continue;
    }
    if (record.realOnSubmittedWorkDone && submitError == null) {
      if (canShareFlushFence) {
        if (sharedFencePromise && !sharedFenceFailed) {
          sharedFencePromise.then(() => cleanup(), () => cleanup());
        } else {
          try {
            cleanup();
          } catch {
            // Cleanup failures must not mask the submit error.
          }
        }
      } else {
        record.realOnSubmittedWorkDone()
          .catch(() => null)
          .finally(() => {
            cleanup();
          });
      }
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

function snapshotWorkerQueueSubmitBurstStats(stats, extra = null) {
  return {
    ...stats,
    // These are the only mutable nested values in the counter record. Every
    // published observation is historical telemetry, so it must own both
    // maps rather than changing underneath a retained schedule result.
    staleWriteFlushLabels: { ...stats.staleWriteFlushLabels },
    writeThroughLabels: { ...stats.writeThroughLabels },
    ...(extra || {})
  };
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
  record.writeThroughEnabled = false;
  record.pooledWriteThroughEnabled = false;
  record.coalesceComputePassesEnabled = false;
  const stats = snapshotWorkerQueueSubmitBurstStats(record.stats);
  if (flushError) throw flushError;
  return stats;
}

export function workerQueueSubmitBurstStats(device) {
  const record = workerQueueSubmitBurstRecords.get(device);
  return record
    ? snapshotWorkerQueueSubmitBurstStats(record.stats, { open: record.open })
    : null;
}

/**
 * Run one narrow queue-order-sensitive sequence with stale writeBuffer calls
 * represented as held staging copies. If a schedule already owns the burst,
 * borrow it and flush before the result escapes; otherwise own a short burst.
 * The caller decides whether the device was armed early enough to use this
 * scope safely.
 */
export async function withWorkerQueueSubmitBurstWriteThrough(
  device,
  runner,
  {
    label = 'ulg-worker-write-through-scope',
    flushReason = 'write-through-scope'
  } = {}
) {
  if (typeof runner !== 'function') {
    throw new TypeError('worker queue write-through scope requires a runner');
  }
  const record = armWorkerQueueSubmitBurst(device);
  const borrowed = record.open === true;
  const previousWriteThroughEnabled = record.writeThroughEnabled;
  const previousPooledWriteThroughEnabled = record.pooledWriteThroughEnabled;
  const previousLabel = record.label;
  if (borrowed) {
    record.writeThroughEnabled = true;
    record.pooledWriteThroughEnabled = false;
  } else {
    openWorkerQueueSubmitBurst(device, { label, writeThrough: true });
  }

  let value;
  let runnerError = null;
  try {
    value = await runner();
  } catch (error) {
    runnerError = error;
  }

  let boundaryError = null;
  try {
    if (borrowed) {
      flushWorkerQueueSubmitBurst(device, flushReason);
    } else {
      closeWorkerQueueSubmitBurst(device, flushReason);
    }
  } catch (error) {
    boundaryError = error;
  } finally {
    record.writeThroughEnabled = previousWriteThroughEnabled;
    record.pooledWriteThroughEnabled = previousPooledWriteThroughEnabled;
    record.label = borrowed ? previousLabel : null;
  }

  if (runnerError && boundaryError) {
    try {
      Object.defineProperty(runnerError, 'submitBurstBoundaryError', {
        value: boundaryError,
        enumerable: false
      });
    } catch {
      // Preserve the primary typed error even when it cannot carry detail.
    }
    throw runnerError;
  }
  if (runnerError) throw runnerError;
  if (boundaryError) throw boundaryError;
  return value;
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

// A consumed or cancelled claim keeps only its terminal state (replays fail on
// it). Its producer output, cleanup closure and capability are dropped: every
// later check rejects on state first, and holding them let one step's cleanup
// closure keep the next step's claims, and so every step's artifacts and GPU
// buffers, reachable (about 15 MB/s on Iron Ice).
function releaseSettledQueueOrderedCleanupClaimRecord(claimRecord) {
  claimRecord.producerOutput = null;
  claimRecord.cleanup = null;
  claimRecord.capability = null;
}

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
  releaseSettledQueueOrderedCleanupClaimRecord(claimRecord);
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
  releaseSettledQueueOrderedCleanupClaimRecord(claimRecord);
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

// Per-device FIFO buffer pool for same-queue transient output / uniform
// buffers retired at authenticated submission boundaries (no MAP_READ/MAP_WRITE).
// Because buffers are only returned after all submitted consumers have been
// queued on the same GPUQueue, WebGPU's queue-timeline ordering guarantees
// prior reads finish before the reused buffer is written in a later submit,
// while rotating identical GPUBuffer handles so downstream bind-group caches hit.
const queueOrderedBufferPoolByDevice = new WeakMap();
const queueOrderedPooledBuffersInPool = new WeakSet();
const queueOrderedDestroyedBuffers = new WeakSet();
const QUEUE_ORDERED_POOL_BUCKET_LIMIT = 16;
const MAP_READ_BIT = 0x0001;
const MAP_WRITE_BIT = 0x0002;

function queueOrderedBufferPoolForDevice(device) {
  let pool = queueOrderedBufferPoolByDevice.get(device);
  if (pool) return pool;
  pool = {
    buckets: new Map(),
    lost: false
  };
  queueOrderedBufferPoolByDevice.set(device, pool);
  if (device?.lost && typeof device.lost.then === 'function') {
    device.lost.then(() => {
      pool.lost = true;
      pool.buckets.clear();
    }).catch(() => {
      pool.lost = true;
      pool.buckets.clear();
    });
  }
  return pool;
}

export function queueOrderedPooledDeviceAllocationOwnership(device) {
  const buffers = new Set();
  if (!device || typeof device !== 'object') {
    return Object.freeze({ buffers: Object.freeze([]) });
  }
  const pool = queueOrderedBufferPoolByDevice.get(device);
  if (pool && !pool.lost) {
    for (const bucket of pool.buckets.values()) {
      for (const buffer of bucket) {
        if (buffer && !queueOrderedDestroyedBuffers.has(buffer)) {
          buffers.add(buffer);
        }
      }
    }
  }
  const burst = workerQueueSubmitBurstRecords.get(device);
  if (burst?.pooledStagingBuffer && !queueOrderedDestroyedBuffers.has(burst.pooledStagingBuffer)) {
    buffers.add(burst.pooledStagingBuffer);
  }
  return Object.freeze({ buffers: Object.freeze([...buffers]) });
}

export function acquireQueueOrderedPooledBuffer(
  device,
  { bucketKey, label, size, usage } = {}
) {
  const normalizedSize = Math.max(4, Math.ceil(Number(size) || 4));
  const normalizedUsage = Number(usage) || 0;
  const poolable = Boolean(
    device
    && bucketKey
    && (normalizedUsage & (MAP_READ_BIT | MAP_WRITE_BIT)) === 0
  );
  if (poolable) {
    const pool = queueOrderedBufferPoolForDevice(device);
    if (!pool.lost) {
      const fullKey = `${bucketKey}:${normalizedSize}:${normalizedUsage}`;
      const bucket = pool.buckets.get(fullKey);
      while (bucket && bucket.length > 0) {
        const reused = bucket.shift();
        if (!reused) continue;
        queueOrderedPooledBuffersInPool.delete(reused);
        if (queueOrderedDestroyedBuffers.has(reused) || reused.destroyed === true) {
          continue;
        }
        return reused;
      }
    }
  }
  return device.createBuffer({
    label,
    size: normalizedSize,
    usage: normalizedUsage
  });
}

export function releaseQueueOrderedPooledBuffer(
  device,
  buffer,
  { bucketKey, size, usage } = {}
) {
  if (!buffer) return false;
  if (queueOrderedDestroyedBuffers.has(buffer) || buffer.destroyed === true) {
    queueOrderedPooledBuffersInPool.delete(buffer);
    return false;
  }
  const normalizedSize = Math.max(4, Math.ceil(Number(size ?? buffer.size) || 4));
  const normalizedUsage = Number(usage ?? buffer.usage) || 0;
  if (
    !device
    || !bucketKey
    || (normalizedUsage & (MAP_READ_BIT | MAP_WRITE_BIT)) !== 0
  ) {
    buffer.destroy?.();
    return false;
  }
  const pool = queueOrderedBufferPoolForDevice(device);
  if (pool.lost) {
    buffer.destroy?.();
    return false;
  }
  const fullKey = `${bucketKey}:${normalizedSize}:${normalizedUsage}`;
  let bucket = pool.buckets.get(fullKey);
  if (!bucket) {
    bucket = [];
    pool.buckets.set(fullKey, bucket);
  }
  if (bucket.includes(buffer)) {
    queueOrderedPooledBuffersInPool.add(buffer);
    return true;
  }
  if (bucket.length >= QUEUE_ORDERED_POOL_BUCKET_LIMIT) {
    buffer.destroy?.();
    return false;
  }
  bucket.push(buffer);
  queueOrderedPooledBuffersInPool.add(buffer);
  return true;
}

const queueOrderedPooledBufferReturnByBuffer = new WeakMap();

export function registerQueueOrderedPooledBufferReturn(
  buffer,
  device,
  { bucketKey, size, usage } = {}
) {
  if (!buffer || !device || !bucketKey) return buffer;
  const normalizedSize = Math.max(4, Math.ceil(Number(size ?? buffer.size) || 4));
  const normalizedUsage = Number(usage ?? buffer.usage) || 0;
  if ((normalizedUsage & (MAP_READ_BIT | MAP_WRITE_BIT)) !== 0) {
    return buffer;
  }
  queueOrderedPooledBuffersInPool.delete(buffer);
  queueOrderedPooledBufferReturnByBuffer.set(buffer, {
    device,
    bucketKey,
    size: normalizedSize,
    usage: normalizedUsage
  });
  return buffer;
}

export function releaseOrDestroyQueueOrderedPooledBuffer(
  buffer,
  { allowPool = true } = {}
) {
  if (!buffer) return false;
  if (queueOrderedPooledBuffersInPool.has(buffer)) return true;
  const spec = queueOrderedPooledBufferReturnByBuffer.get(buffer);
  if (spec) {
    queueOrderedPooledBufferReturnByBuffer.delete(buffer);
    if (allowPool) {
      return releaseQueueOrderedPooledBuffer(spec.device, buffer, spec);
    }
  }
  buffer.destroy?.();
  return false;
}
