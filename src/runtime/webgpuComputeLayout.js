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
