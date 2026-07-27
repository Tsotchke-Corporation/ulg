const GPU_SHADER_STAGE = {
  COMPUTE: globalThis.GPUShaderStage?.COMPUTE ?? 4
};

const DEVICE_COMPUTE_PIPELINE_CACHE = new WeakMap();

export function computeBufferBinding(binding, type = 'read-only-storage') {
  return {
    binding,
    visibility: GPU_SHADER_STAGE.COMPUTE,
    buffer: { type }
  };
}

export function createExplicitComputePipeline(device, {
  label,
  module,
  entryPoint = 'main',
  bindings = []
} = {}) {
  let bindGroupLayout = null;
  let pipelineLayout = null;
  if (device?.createBindGroupLayout && device?.createPipelineLayout && bindings.length > 0) {
    bindGroupLayout = device.createBindGroupLayout({
      label: `${label || entryPoint}-bind-group-layout`,
      entries: bindings
    });
    pipelineLayout = device.createPipelineLayout({
      label: `${label || entryPoint}-pipeline-layout`,
      bindGroupLayouts: [bindGroupLayout]
    });
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

function bindingSignature(bindings = []) {
  return JSON.stringify(bindings.map((entry) => ({
    binding: entry.binding,
    visibility: entry.visibility,
    bufferType: entry.buffer?.type || 'uniform'
  })));
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
      cacheStatus: 'pipeline-cache-hit'
    };
  }
  const module = device.createShaderModule({ label, code });
  const created = createExplicitComputePipeline(device, {
    label,
    module,
    entryPoint,
    bindings
  });
  cache.set(key, created);
  return {
    ...created,
    cacheStatus: 'pipeline-cache-miss'
  };
}

// One fence per registered cleanup meant 161 fences per batch in a measured
// production frame, every one of them waiting for the same device idle point.
// Cleanups are coalesced onto a shared fence instead, at most one in flight per
// device.
//
// The correctness rule this respects: a cleanup registered at time T must wait
// on a fence created at or after T, or it can free a buffer the device is still
// reading. So a cleanup is never attached to a fence that already exists --
// while one is in flight the newcomers accumulate, and a fresh fence is created
// for them only once the previous one resolves. That fence is necessarily
// created after all of them were registered.
const submittedWorkCleanupQueues = new WeakMap();

function runSubmittedWorkCleanupBatch(batch) {
  for (const cleanup of batch) {
    try {
      cleanup();
    } catch (error) {
      // A throwing cleanup must not strand the rest of the batch -- these are
      // buffer releases, and one bad one would leak everything queued behind
      // it. Still reported: when each cleanup had its own fence this surfaced
      // as an unhandled rejection in the console, so it stays console-visible
      // rather than becoming silent.
      globalThis.console?.error?.(
        '[ulg-webgpu] deferred submitted-work cleanup threw',
        error
      );
    }
  }
}

function drainSubmittedWorkCleanup(device, state, { rethrowFenceFailure = false } = {}) {
  if (state.inFlight || state.pending.length === 0) return;
  state.inFlight = true;
  const batch = state.pending;
  state.pending = [];
  let fence = null;
  try {
    fence = device.queue.onSubmittedWorkDone();
  } catch (error) {
    // A queue that cannot schedule a fence at all is the same situation as a
    // device with no fence support: release now rather than never. Leaving
    // inFlight set here would strand every later cleanup on this device, since
    // nothing would ever arrive to clear it.
    state.inFlight = false;
    runSubmittedWorkCleanupBatch(batch);
    drainSubmittedWorkCleanup(device, state);
    // A caller registering a cleanup gets the failure, as it did when each
    // registration made its own fence -- a queue that cannot schedule work is
    // the caller's problem, not a diagnostic. From the resolve callback there
    // is no caller left to tell, so it is logged instead of becoming an
    // unhandled rejection.
    if (rethrowFenceFailure) throw error;
    globalThis.console?.error?.(
      '[ulg-webgpu] could not schedule a submitted-work fence',
      error
    );
    return;
  }
  Promise.resolve(fence)
    .catch(() => null)
    .finally(() => {
      state.inFlight = false;
      runSubmittedWorkCleanupBatch(batch);
      drainSubmittedWorkCleanup(device, state);
    });
}

export function deferSubmittedWorkCleanup(device, cleanup) {
  if (typeof cleanup !== 'function') return false;
  if (!device?.queue?.onSubmittedWorkDone) {
    cleanup();
    return false;
  }
  let state = submittedWorkCleanupQueues.get(device);
  if (!state) {
    state = { pending: [], inFlight: false };
    submittedWorkCleanupQueues.set(device, state);
  }
  state.pending.push(cleanup);
  drainSubmittedWorkCleanup(device, state, { rethrowFenceFailure: true });
  return true;
}
