const DEFAULT_STORAGE_BUFFERS_PER_STAGE = 8;
// The canonical contact-energy solver binds twelve storage buffers in one
// shader stage; the live G6 thermal-potential derived prepass binds fifteen.
// Require twelve as the hard floor and request up to sixteen whenever the
// adapter exposes it so live closures activate without rejecting 12-slot
// fallback adapters.
export const RESIDENT_SPH_STORAGE_BUFFERS_PER_STAGE = 12;
export const RESIDENT_SPH_PREFERRED_STORAGE_BUFFERS_PER_STAGE = 16;
const DEFAULT_WEBGPU_MAX_BUFFER_SIZE = 256 * 1024 * 1024;
const DEFAULT_WEBGPU_MAX_STORAGE_BUFFER_BINDING_SIZE = 128 * 1024 * 1024;
const WEBGPU_MAX_BUFFER_SIZE_CEILING = (4 * 1024 * 1024 * 1024) - 4;
export const WEBGPU_TIMESTAMP_QUERY_FEATURE = 'timestamp-query';

function finitePositiveLimit(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : 0;
}

export function residentSphWebGpuLimitsForAdapter(adapterOrLimits = null) {
  const limits = adapterOrLimits?.limits || adapterOrLimits || {};
  const adapterStorageLimit = finitePositiveLimit(limits.maxStorageBuffersPerShaderStage);
  const adapterMaxBufferSize = finitePositiveLimit(limits.maxBufferSize);
  const adapterMaxStorageBufferBindingSize = finitePositiveLimit(limits.maxStorageBufferBindingSize);
  const requestedStorageBuffersPerStage = adapterStorageLimit > RESIDENT_SPH_STORAGE_BUFFERS_PER_STAGE
    ? Math.min(adapterStorageLimit, RESIDENT_SPH_PREFERRED_STORAGE_BUFFERS_PER_STAGE)
    : Math.max(
        DEFAULT_STORAGE_BUFFERS_PER_STAGE,
        RESIDENT_SPH_STORAGE_BUFFERS_PER_STAGE
      );
  const requiredLimits = {
    maxStorageBuffersPerShaderStage: requestedStorageBuffersPerStage
  };
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

function adapterFeatureNames(adapterOrFeatures = null) {
  const features = adapterOrFeatures?.features || adapterOrFeatures;
  if (!features) return [];
  try {
    return [...features].map((feature) => String(feature));
  } catch {
    return [];
  }
}

export function residentSphWebGpuFeaturesForAdapter(adapterOrFeatures = null, {
  timestampProfilingRequested = false
} = {}) {
  const adapterFeatures = adapterFeatureNames(adapterOrFeatures);
  const timestampQuerySupported = adapterFeatures.includes(
    WEBGPU_TIMESTAMP_QUERY_FEATURE
  );
  const requiredFeatures = timestampProfilingRequested && timestampQuerySupported
    ? [WEBGPU_TIMESTAMP_QUERY_FEATURE]
    : [];
  return {
    adapterFeatures,
    requiredFeatures,
    timestampProfilingRequested: timestampProfilingRequested === true,
    timestampQuerySupported,
    timestampQueryStatus: timestampProfilingRequested
      ? (timestampQuerySupported
        ? 'timestamp-query-supported-and-requested'
        : 'timestamp-query-unsupported-by-adapter')
      : (timestampQuerySupported
        ? 'timestamp-query-supported-not-requested'
        : 'timestamp-query-unsupported-not-requested')
  };
}

export function webGpuDeviceDescriptorForResidentSph(adapterOrLimits = null, {
  timestampProfilingRequested = false
} = {}) {
  const { requiredLimits } = residentSphWebGpuLimitsForAdapter(adapterOrLimits);
  const { requiredFeatures } = residentSphWebGpuFeaturesForAdapter(
    adapterOrLimits,
    { timestampProfilingRequested }
  );
  const descriptor = {};
  if (Object.keys(requiredLimits).length > 0) descriptor.requiredLimits = requiredLimits;
  if (requiredFeatures.length > 0) descriptor.requiredFeatures = requiredFeatures;
  return Object.keys(descriptor).length > 0 ? descriptor : undefined;
}
