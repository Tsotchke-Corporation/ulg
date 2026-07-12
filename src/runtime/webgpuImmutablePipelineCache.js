export const ULG_WEBGPU_IMMUTABLE_PIPELINE_CACHE_SCHEMA =
  'peercompute.ulg.webgpu-immutable-pipeline-cache.v0';

const DEVICE_CACHES = new WeakMap();

function assertDevice(device) {
  if (
    !device
    || typeof device !== 'object'
    || typeof device.createShaderModule !== 'function'
    || typeof device.createBindGroupLayout !== 'function'
    || typeof device.createPipelineLayout !== 'function'
    || typeof device.createComputePipeline !== 'function'
  ) {
    throw new TypeError('immutable pipeline caching requires a WebGPU-like device');
  }
}

function canonical(value, objectId) {
  if (value == null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map((entry) => canonical(entry, objectId));
  if (ArrayBuffer.isView(value)) return Array.from(value);
  if (value instanceof ArrayBuffer) return Array.from(new Uint8Array(value));
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    return { __webGpuObjectId: objectId(value) };
  }
  return Object.fromEntries(
    Object.keys(value)
      .filter((key) => key !== 'label')
      .sort()
      .map((key) => [key, canonical(value[key], objectId)])
  );
}

function descriptorKey(descriptor, objectId) {
  return JSON.stringify(canonical(descriptor, objectId));
}

function cacheCompilationInfo(module, cache) {
  if (!module || typeof module.getCompilationInfo !== 'function') return;
  if (cache.compilationInfoModules.has(module)) return;
  const original = module.getCompilationInfo.bind(module);
  let resultPromise = null;
  try {
    module.getCompilationInfo = () => {
      cache.stats.compilationInfoRequests += 1;
      if (!resultPromise) {
        cache.stats.compilationInfoMisses += 1;
        resultPromise = Promise.resolve().then(() => original());
      } else {
        cache.stats.compilationInfoHits += 1;
      }
      return resultPromise;
    };
    cache.compilationInfoModules.add(module);
  } catch {
    cache.stats.compilationInfoWrapFailures += 1;
  }
}

function summarize(cache) {
  return {
    schema: ULG_WEBGPU_IMMUTABLE_PIPELINE_CACHE_SCHEMA,
    status: 'webgpu-immutable-pipeline-cache-ready',
    installed: true,
    shaderModuleEntryCount: cache.shaderModules.size,
    bindGroupLayoutEntryCount: cache.bindGroupLayouts.size,
    pipelineLayoutEntryCount: cache.pipelineLayouts.size,
    computePipelineEntryCount: cache.computePipelines.size,
    ...cache.stats
  };
}

export function installWebGpuImmutablePipelineCache(device) {
  assertDevice(device);
  const existing = DEVICE_CACHES.get(device);
  if (existing) return summarize(existing);

  const objectIds = new WeakMap();
  let nextObjectId = 1;
  const objectId = (value) => {
    let id = objectIds.get(value);
    if (id == null) {
      id = nextObjectId++;
      objectIds.set(value, id);
    }
    return id;
  };
  const originals = {
    createShaderModule: device.createShaderModule.bind(device),
    createBindGroupLayout: device.createBindGroupLayout.bind(device),
    createPipelineLayout: device.createPipelineLayout.bind(device),
    createComputePipeline: device.createComputePipeline.bind(device)
  };
  const cache = {
    originals,
    objectId,
    shaderModules: new Map(),
    bindGroupLayouts: new Map(),
    pipelineLayouts: new Map(),
    computePipelines: new Map(),
    compilationInfoModules: new WeakSet(),
    stats: {
      shaderModuleHits: 0,
      shaderModuleMisses: 0,
      bindGroupLayoutHits: 0,
      bindGroupLayoutMisses: 0,
      pipelineLayoutHits: 0,
      pipelineLayoutMisses: 0,
      computePipelineHits: 0,
      computePipelineMisses: 0,
      compilationInfoRequests: 0,
      compilationInfoHits: 0,
      compilationInfoMisses: 0,
      compilationInfoWrapFailures: 0
    }
  };

  device.createShaderModule = (descriptor) => {
    const key = descriptorKey(descriptor, objectId);
    const hit = cache.shaderModules.get(key);
    if (hit) {
      cache.stats.shaderModuleHits += 1;
      return hit;
    }
    cache.stats.shaderModuleMisses += 1;
    const module = originals.createShaderModule(descriptor);
    objectId(module);
    cacheCompilationInfo(module, cache);
    cache.shaderModules.set(key, module);
    return module;
  };

  device.createBindGroupLayout = (descriptor) => {
    const key = descriptorKey(descriptor, objectId);
    const hit = cache.bindGroupLayouts.get(key);
    if (hit) {
      cache.stats.bindGroupLayoutHits += 1;
      return hit;
    }
    cache.stats.bindGroupLayoutMisses += 1;
    const layout = originals.createBindGroupLayout(descriptor);
    objectId(layout);
    cache.bindGroupLayouts.set(key, layout);
    return layout;
  };

  device.createPipelineLayout = (descriptor) => {
    const key = descriptorKey(descriptor, objectId);
    const hit = cache.pipelineLayouts.get(key);
    if (hit) {
      cache.stats.pipelineLayoutHits += 1;
      return hit;
    }
    cache.stats.pipelineLayoutMisses += 1;
    const layout = originals.createPipelineLayout(descriptor);
    objectId(layout);
    cache.pipelineLayouts.set(key, layout);
    return layout;
  };

  device.createComputePipeline = (descriptor) => {
    const key = descriptorKey(descriptor, objectId);
    const hit = cache.computePipelines.get(key);
    if (hit) {
      cache.stats.computePipelineHits += 1;
      return hit;
    }
    cache.stats.computePipelineMisses += 1;
    const pipeline = originals.createComputePipeline(descriptor);
    objectId(pipeline);
    cache.computePipelines.set(key, pipeline);
    return pipeline;
  };

  DEVICE_CACHES.set(device, cache);
  return summarize(cache);
}

export function webGpuImmutablePipelineCacheSummary(device) {
  const cache = device && typeof device === 'object' ? DEVICE_CACHES.get(device) : null;
  return cache
    ? summarize(cache)
    : {
        schema: ULG_WEBGPU_IMMUTABLE_PIPELINE_CACHE_SCHEMA,
        status: 'webgpu-immutable-pipeline-cache-not-installed',
        installed: false
      };
}
