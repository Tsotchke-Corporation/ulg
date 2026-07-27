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
// So this stays one fence per cleanup. `onSubmittedWorkDone` does not stall the
// host here (the cleanup is scheduled on the fence, not awaited), so the cost
// is browser bookkeeping, not a bubble.
export function deferSubmittedWorkCleanup(device, cleanup) {
  if (typeof cleanup !== 'function') return false;
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
