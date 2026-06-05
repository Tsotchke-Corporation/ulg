export const ULG_IR_VERSION = '0.5';
export const ULG_GPU_ABI_VERSION = '0.5';

export const D_TYPES = Object.freeze({
  f32: { name: 'f32', byteSize: 4, lanes: 1 },
  u32: { name: 'u32', byteSize: 4, lanes: 1 },
  i32: { name: 'i32', byteSize: 4, lanes: 1 },
  complex64: { name: 'complex64', byteSize: 8, lanes: 2, scalar: 'f32' }
});

export function createComplex64Vector(pairs) {
  const buffer = new Float32Array(pairs.length * 2);
  pairs.forEach(([real, imag], index) => {
    buffer[index * 2] = real;
    buffer[index * 2 + 1] = imag;
  });
  return buffer;
}

export function complex64ToPairs(buffer) {
  if (!(buffer instanceof Float32Array)) {
    throw new TypeError('complex64 buffers must be Float32Array values');
  }
  if (buffer.length % 2 !== 0) {
    throw new RangeError('complex64 buffers must contain real/imag pairs');
  }
  const pairs = [];
  for (let index = 0; index < buffer.length; index += 2) {
    pairs.push([buffer[index], buffer[index + 1]]);
  }
  return pairs;
}

export function computeRowMajorStrides(shape) {
  let stride = 1;
  const strides = new Array(shape.length);
  for (let index = shape.length - 1; index >= 0; index -= 1) {
    strides[index] = stride;
    stride *= shape[index];
  }
  return strides;
}

export function createTensorDescriptor({
  id,
  dtype,
  shape,
  layout = 'row-major',
  strides = computeRowMajorStrides(shape),
  byteOffset = 0,
  source = 'hot'
}) {
  if (!D_TYPES[dtype]) {
    throw new RangeError(`Unsupported dtype: ${dtype}`);
  }
  if (!Array.isArray(shape) || shape.length === 0 || shape.some((value) => !Number.isInteger(value) || value <= 0)) {
    throw new RangeError('Tensor shape must be a non-empty array of positive integers');
  }
  return {
    id,
    abiVersion: ULG_GPU_ABI_VERSION,
    dtype,
    shape,
    layout,
    strides,
    byteOffset,
    byteLength: shape.reduce((total, value) => total * value, 1) * D_TYPES[dtype].byteSize,
    source
  };
}

export function createClosureTableDescriptor({
  closureId,
  axes,
  outputs,
  layout = 'soa',
  interpolation = 'linear',
  validity = {}
}) {
  if (!closureId) {
    throw new Error('closureId is required');
  }
  return {
    closureId,
    abiVersion: ULG_GPU_ABI_VERSION,
    axes,
    outputs,
    layout,
    interpolation,
    validity
  };
}

export function createProvenanceBlock({
  sourceService,
  methodHash,
  inputHash,
  codeVersion = 'ulg-demo',
  deterministicSeed = 'demo-seed',
  createdAt = new Date().toISOString(),
  notes = []
}) {
  return {
    sourceService,
    methodHash,
    inputHash,
    codeVersion,
    deterministicSeed,
    createdAt,
    notes
  };
}

export function createToleranceReport({
  status,
  toleranceProfile,
  metrics,
  provenance
}) {
  return {
    abiVersion: ULG_GPU_ABI_VERSION,
    status,
    toleranceProfile,
    metrics,
    provenance
  };
}

export function hashPayload(payload) {
  const encoded = stableStringify(payload);
  let hash = 2166136261;
  for (let index = 0; index < encoded.length; index += 1) {
    hash ^= encoded.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `ulg:${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

export function stableStringify(value) {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  }
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}
