const DEFAULT_STORAGE_BUFFERS_PER_STAGE = 8;
const RESIDENT_SPH_STORAGE_BUFFERS_PER_STAGE = 10;
const DEFAULT_WEBGPU_MAX_BUFFER_SIZE = 256 * 1024 * 1024;
const DEFAULT_WEBGPU_MAX_STORAGE_BUFFER_BINDING_SIZE = 128 * 1024 * 1024;
const WEBGPU_MAX_BUFFER_SIZE_CEILING = (4 * 1024 * 1024 * 1024) - 4;

function finitePositiveLimit(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : 0;
}

export function residentSphWebGpuLimitsForAdapter(adapterOrLimits = null) {
  const limits = adapterOrLimits?.limits || adapterOrLimits || {};
  const adapterStorageLimit = finitePositiveLimit(limits.maxStorageBuffersPerShaderStage);
  const adapterMaxBufferSize = finitePositiveLimit(limits.maxBufferSize);
  const adapterMaxStorageBufferBindingSize = finitePositiveLimit(limits.maxStorageBufferBindingSize);
  const requiredLimits = {};
  if (adapterStorageLimit >= RESIDENT_SPH_STORAGE_BUFFERS_PER_STAGE) {
    requiredLimits.maxStorageBuffersPerShaderStage = Math.max(
      DEFAULT_STORAGE_BUFFERS_PER_STAGE,
      RESIDENT_SPH_STORAGE_BUFFERS_PER_STAGE
    );
  }
  if (adapterMaxBufferSize > DEFAULT_WEBGPU_MAX_BUFFER_SIZE) {
    requiredLimits.maxBufferSize = Math.min(adapterMaxBufferSize, WEBGPU_MAX_BUFFER_SIZE_CEILING);
  }
  if (adapterMaxStorageBufferBindingSize > DEFAULT_WEBGPU_MAX_STORAGE_BUFFER_BINDING_SIZE) {
    requiredLimits.maxStorageBufferBindingSize = Math.min(
      adapterMaxStorageBufferBindingSize,
      WEBGPU_MAX_BUFFER_SIZE_CEILING
    );
  }
  return {
    requiredLimits,
    adapterLimits: {
      maxStorageBuffersPerShaderStage: adapterStorageLimit || null,
      maxBufferSize: adapterMaxBufferSize || null,
      maxStorageBufferBindingSize: adapterMaxStorageBufferBindingSize || null
    }
  };
}

export function webGpuDeviceDescriptorForResidentSph(adapterOrLimits = null) {
  const { requiredLimits } = residentSphWebGpuLimitsForAdapter(adapterOrLimits);
  return Object.keys(requiredLimits).length > 0 ? { requiredLimits } : undefined;
}
