const GPU_SHADER_STAGE = {
  COMPUTE: globalThis.GPUShaderStage?.COMPUTE ?? 4
};

const DEVICE_COMPUTE_PIPELINE_CACHE = new WeakMap();
const DEVICE_COMPUTE_PIPELINE_FAMILY_CACHE = new WeakMap();
const QUEUE_SUBMITTED_WORK_CLEANUP_BATCH = new WeakMap();

function closeSubmittedWorkCleanupBatch(queue, batch) {
  if (QUEUE_SUBMITTED_WORK_CLEANUP_BATCH.get(queue) === batch) {
    QUEUE_SUBMITTED_WORK_CLEANUP_BATCH.delete(queue);
  }
  batch.open = false;
}

function runSubmittedWorkCleanupBatch(batch) {
  const cleanups = batch.cleanups.splice(0);
  let firstError = null;
  for (const cleanup of cleanups) {
    try {
      cleanup();
    } catch (error) {
      firstError ??= error;
    }
  }
  if (firstError) throw firstError;
}

function flushSubmittedWorkCleanupBatch(queue, batch) {
  closeSubmittedWorkCleanupBatch(queue, batch);
  let fence;
  try {
    fence = queue.onSubmittedWorkDone();
  } catch {
    runSubmittedWorkCleanupBatch(batch);
    return;
  }
  Promise.resolve(fence).then(
    () => runSubmittedWorkCleanupBatch(batch),
    () => runSubmittedWorkCleanupBatch(batch)
  );
}

function scheduleSubmittedWorkCleanupBatchFlush(queue, batch) {
  const flush = () => flushSubmittedWorkCleanupBatch(queue, batch);
  // Capture same-turn submits, then close the batch before a later task can add cleanup.
  if (typeof queueMicrotask === 'function') {
    queueMicrotask(flush);
  } else {
    Promise.resolve().then(flush);
  }
}

export function computeBufferBinding(binding, type = 'read-only-storage', options = {}) {
  const resolvedBinding = Number(binding);
  if (!Number.isInteger(resolvedBinding) || resolvedBinding < 0) {
    throw new RangeError('compute buffer binding must be a non-negative integer');
  }
  const minBindingSize = options.minBindingSize == null
    ? 0
    : Number(options.minBindingSize);
  if (!Number.isSafeInteger(minBindingSize) || minBindingSize < 0) {
    throw new RangeError('compute buffer minBindingSize must be a non-negative safe integer');
  }
  return {
    binding: resolvedBinding,
    visibility: GPU_SHADER_STAGE.COMPUTE,
    buffer: {
      type,
      ...(options.hasDynamicOffset === true ? { hasDynamicOffset: true } : {}),
      ...(minBindingSize > 0
        ? { minBindingSize }
        : {})
    }
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

function computePipelineFamilyCacheForDevice(device) {
  let cache = DEVICE_COMPUTE_PIPELINE_FAMILY_CACHE.get(device);
  if (!cache) {
    cache = new Map();
    DEVICE_COMPUTE_PIPELINE_FAMILY_CACHE.set(device, cache);
  }
  return cache;
}

function bindingSignature(bindings = []) {
  return JSON.stringify(bindings.map((entry) => ({
    binding: entry.binding,
    visibility: entry.visibility,
    bufferType: entry.buffer?.type || 'uniform',
    hasDynamicOffset: entry.buffer?.hasDynamicOffset === true,
    minBindingSize: Number(entry.buffer?.minBindingSize ?? 0)
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

export function createCachedExplicitComputePipelineFamily(device, {
  cacheKey,
  label,
  code,
  entryPoints = [],
  bindings = []
} = {}) {
  const normalizedEntryPoints = [...new Set(entryPoints.map((entryPoint) => String(entryPoint)))]
    .filter(Boolean);
  if (normalizedEntryPoints.length === 0) {
    throw new TypeError('createCachedExplicitComputePipelineFamily requires at least one entry point');
  }
  const key = [
    cacheKey || '',
    label || '',
    normalizedEntryPoints.join(','),
    bindingSignature(bindings)
  ].join('|');
  const cache = cacheKey ? computePipelineFamilyCacheForDevice(device) : null;
  const cached = cache?.get(key);
  if (cached) {
    return {
      ...cached,
      cacheStatus: 'pipeline-family-cache-hit'
    };
  }

  const module = device.createShaderModule({ label, code });
  const bindGroupLayout = bindings.length > 0
    && device?.createBindGroupLayout
    && device?.createPipelineLayout
    ? device.createBindGroupLayout({
        label: `${label || normalizedEntryPoints[0]}-bind-group-layout`,
        entries: bindings
      })
    : null;
  const pipelineLayout = bindGroupLayout
    ? device.createPipelineLayout({
        label: `${label || normalizedEntryPoints[0]}-pipeline-layout`,
        bindGroupLayouts: [bindGroupLayout]
      })
    : null;
  const pipelines = Object.fromEntries(normalizedEntryPoints.map((entryPoint) => [
    entryPoint,
    device.createComputePipeline({
      label: `${label || 'compute'}-${entryPoint}`,
      layout: pipelineLayout || 'auto',
      compute: { module, entryPoint }
    })
  ]));
  const created = {
    pipelines,
    bindGroupLayout: bindGroupLayout || pipelines[normalizedEntryPoints[0]].getBindGroupLayout(0),
    pipelineLayout,
    module,
    entryPoints: Object.freeze(normalizedEntryPoints)
  };
  cache?.set(key, created);
  return {
    ...created,
    cacheStatus: cache ? 'pipeline-family-cache-miss' : 'not-cached'
  };
}

export function deferSubmittedWorkCleanup(device, cleanup) {
  if (typeof cleanup !== 'function') return false;
  const queue = device?.queue;
  if (!queue?.onSubmittedWorkDone) {
    cleanup();
    return false;
  }
  const currentBatch = QUEUE_SUBMITTED_WORK_CLEANUP_BATCH.get(queue);
  if (currentBatch?.open) {
    currentBatch.cleanups.push(cleanup);
    return true;
  }

  const batch = {
    open: true,
    cleanups: [cleanup]
  };
  QUEUE_SUBMITTED_WORK_CLEANUP_BATCH.set(queue, batch);
  scheduleSubmittedWorkCleanupBatchFlush(queue, batch);
  return true;
}
