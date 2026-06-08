export const ULG_IR_VERSION = '0.5';
export const ULG_GPU_ABI_VERSION = '0.5';
export const ULG_SIMULATION_ARTIFACT_SCHEMA = 'peercompute.ulg.simulation-artifact.v0';
export const ULG_CLOSURE_TABLE_WGSL_DESCRIPTOR_SCHEMA = 'peercompute.ulg.closure-table-wgsl-descriptor.v0';
export const CLOSURE_TABLE_WGSL_SAMPLE_ROW_LAYOUT = Object.freeze([
  'axis:f32',
  'value:f32',
  'derivative:f32',
  'pad0:f32'
]);

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

function firstName(entries, fallback) {
  if (!Array.isArray(entries)) return fallback;
  const entry = entries.find((candidate) => candidate?.name);
  return entry?.name || fallback;
}

function firstSampleCount(entries) {
  if (!Array.isArray(entries)) return null;
  const entry = entries.find((candidate) => Number.isInteger(candidate?.samples));
  return entry?.samples ?? null;
}

function validationFalse(value, label) {
  if (value === true) {
    throw new Error(`${label} must remain false for closure-table WGSL descriptors`);
  }
  return false;
}

function finiteNumber(value, label) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    throw new TypeError(`${label} must be finite`);
  }
  return number;
}

function readSampleField(sample, keys, label) {
  for (const key of keys) {
    if (sample?.[key] != null) {
      return finiteNumber(sample[key], label);
    }
  }
  throw new TypeError(`${label} is required`);
}

function readSampleDerivative(sample, derivativeKey, index) {
  const candidate = sample?.[derivativeKey] ?? sample?.derivative ?? sample?.dEdr;
  return candidate == null ? null : finiteNumber(candidate, `samples[${index}].derivative`);
}

function derivativeAtSample(samples, index, axisKey, outputKey, derivativeKey) {
  const derivative = readSampleDerivative(samples[index], derivativeKey, index);
  if (derivative != null) return derivative;
  const leftIndex = Math.max(0, index - 1);
  const rightIndex = Math.min(samples.length - 1, index + 1);
  const leftAxis = readSampleField(samples[leftIndex], [axisKey, 'axis', 'r', 'x'], `samples[${leftIndex}].axis`);
  const rightAxis = readSampleField(samples[rightIndex], [axisKey, 'axis', 'r', 'x'], `samples[${rightIndex}].axis`);
  if (rightAxis === leftAxis) return 0;
  const leftValue = readSampleField(samples[leftIndex], [outputKey, 'value', 'energy'], `samples[${leftIndex}].value`);
  const rightValue = readSampleField(samples[rightIndex], [outputKey, 'value', 'energy'], `samples[${rightIndex}].value`);
  return (rightValue - leftValue) / (rightAxis - leftAxis);
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
  validity = {},
  derivativeName = 'dEdr',
  wgslTableDescriptor = true
}) {
  if (!closureId) {
    throw new Error('closureId is required');
  }
  const axisName = firstName(axes, 'r');
  const outputName = firstName(outputs, 'energy');
  const sampleCount = firstSampleCount(axes) ?? firstSampleCount(outputs);
  return {
    closureId,
    abiVersion: ULG_GPU_ABI_VERSION,
    axes,
    outputs,
    layout,
    interpolation,
    validity,
    wgslTableDescriptor: wgslTableDescriptor === false
      ? null
      : createClosureTableWgslDescriptor({
        closureId,
        axisName,
        outputName,
        derivativeName,
        sampleCount,
        interpolation,
        sourceLayout: layout
      })
  };
}

export function createClosureTableWgslDescriptor({
  closureId,
  axisName = 'r',
  outputName = 'energy',
  derivativeName = 'dEdr',
  sampleCount = null,
  interpolation = 'linear',
  sourceLayout = 'soa',
  sampleStruct = 'ClosureTableSample',
  scientificValidation = false,
  fullPhysicsValidation = false,
  materialValidation = false,
  eosValidation = false,
  sphValidation = false,
  phaseChangeValidation = false
} = {}) {
  if (!closureId) {
    throw new Error('closureId is required');
  }
  if (sampleCount != null && (!Number.isInteger(sampleCount) || sampleCount < 0)) {
    throw new RangeError('sampleCount must be a non-negative integer when provided');
  }
  return {
    schema: ULG_CLOSURE_TABLE_WGSL_DESCRIPTOR_SCHEMA,
    abiVersion: ULG_GPU_ABI_VERSION,
    status: 'declared-table-wgsl-layout',
    strategy: 'wgsl-storage-buffer-table-interpolation',
    closureId,
    axisName,
    outputName,
    derivativeName,
    interpolation,
    sourceLayout,
    bufferLayout: 'aos-f32x4',
    sampleStruct,
    sampleStrideFloats: CLOSURE_TABLE_WGSL_SAMPLE_ROW_LAYOUT.length,
    sampleStrideBytes: CLOSURE_TABLE_WGSL_SAMPLE_ROW_LAYOUT.length * D_TYPES.f32.byteSize,
    rowLayout: [...CLOSURE_TABLE_WGSL_SAMPLE_ROW_LAYOUT],
    sampleCount,
    storageAddressSpace: 'storage',
    storageAccess: 'read',
    scientificValidation: validationFalse(scientificValidation, 'scientificValidation'),
    fullPhysicsValidation: validationFalse(fullPhysicsValidation, 'fullPhysicsValidation'),
    materialValidation: validationFalse(materialValidation, 'materialValidation'),
    eosValidation: validationFalse(eosValidation, 'eosValidation'),
    sphValidation: validationFalse(sphValidation, 'sphValidation'),
    phaseChangeValidation: validationFalse(phaseChangeValidation, 'phaseChangeValidation')
  };
}

export function createClosureTableSampleBuffer(samples, {
  axisKey = 'axis',
  outputKey = 'value',
  derivativeKey = 'derivative'
} = {}) {
  if (!Array.isArray(samples) || samples.length === 0) {
    throw new TypeError('samples must be a non-empty array');
  }
  const buffer = new Float32Array(samples.length * CLOSURE_TABLE_WGSL_SAMPLE_ROW_LAYOUT.length);
  samples.forEach((sample, index) => {
    const offset = index * CLOSURE_TABLE_WGSL_SAMPLE_ROW_LAYOUT.length;
    buffer[offset] = readSampleField(sample, [axisKey, 'axis', 'r', 'x'], `samples[${index}].axis`);
    buffer[offset + 1] = readSampleField(sample, [outputKey, 'value', 'energy'], `samples[${index}].value`);
    buffer[offset + 2] = derivativeAtSample(samples, index, axisKey, outputKey, derivativeKey);
    buffer[offset + 3] = 0;
  });
  return buffer;
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

export function createSimulationArtifact({
  artifactId,
  sourceService = 'ulg-runtime',
  taskKind = 'simulation.step',
  closureRef,
  representation = 'carrier-toy',
  outputs,
  execution,
  validity,
  uncertainty = {},
  validation = {},
  provenance
}) {
  if (!artifactId) {
    throw new Error('artifactId is required for ULG simulation artifacts');
  }
  if (!closureRef) {
    throw new Error('closureRef is required for ULG simulation artifacts');
  }
  return {
    schema: ULG_SIMULATION_ARTIFACT_SCHEMA,
    artifactId,
    sourceService,
    taskKind,
    closureRef,
    representation,
    outputs,
    execution,
    validity,
    uncertainty,
    validation: {
      status: 'pass',
      validationMode: 'cpu-reference-toy-carrier',
      scientificValidation: false,
      fullPhysics: false,
      fullPhysicsValidation: false,
      ...validation
    },
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
