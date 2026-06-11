export * from './sphPhaseContracts.js';

export const ULG_IR_VERSION = '0.5';
export const ULG_GPU_ABI_VERSION = '0.5';
export const ULG_SIMULATION_ARTIFACT_SCHEMA = 'peercompute.ulg.simulation-artifact.v0';
export const ULG_CLOSURE_INVALIDATION_ARTIFACT_SCHEMA = 'peercompute.ulg.closure-invalidation-artifact.v0';
export const ULG_CLOSURE_REDERIVATION_ARTIFACT_SCHEMA = 'peercompute.ulg.closure-rederivation-artifact.v0';
export const ULG_THERMODYNAMIC_PREFLIGHT_ARTIFACT_SCHEMA = 'peercompute.ulg.thermodynamic-preflight.v0';
export const ULG_CLOSURE_TABLE_WGSL_DESCRIPTOR_SCHEMA = 'peercompute.ulg.closure-table-wgsl-descriptor.v0';
export const ULG_OPTICAL_GPU_TABLE_SCHEMA = 'peercompute.ulg.optical-gpu-table.v0';
export const ULG_OPTICAL_GPU_BUFFER_SET_SCHEMA = 'peercompute.ulg.optical-gpu-buffer-set.v0';
export const ULG_OPTICAL_GPU_LOOKUP_SCHEMA = 'peercompute.ulg.optical-gpu-lookup.v0';
export const ULG_OPTICAL_GPU_LOOKUP_EXECUTION_SCHEMA = 'peercompute.ulg.optical-gpu-lookup-execution.v0';
export const ULG_OPTICAL_GPU_LOOKUP_PARITY_SCHEMA = 'peercompute.ulg.optical-gpu-lookup-parity.v0';
export const ULG_SPH_GPU_PARTICLE_BUFFER_SCHEMA = 'peercompute.ulg.sph-gpu-particle-buffer.v0';
export const ULG_SPH_GPU_PARTICLE_BUFFER_SET_SCHEMA = 'peercompute.ulg.sph-gpu-particle-buffer-set.v0';
export const CLOSURE_TABLE_WGSL_SAMPLE_ROW_LAYOUT = Object.freeze([
  'axis:f32',
  'value:f32',
  'derivative:f32',
  'pad0:f32'
]);
export const OPTICAL_GPU_RECORD_ROW_LAYOUT = Object.freeze([
  'materialId:f32',
  'phaseId:f32',
  'spectralOffset:f32',
  'spectralCount:f32',
  'baseColorLinearR:f32',
  'baseColorLinearG:f32',
  'baseColorLinearB:f32',
  'metalness:f32',
  'roughness:f32',
  'transmission:f32',
  'opacity:f32',
  'ior:f32',
  'attenuationLinearR:f32',
  'attenuationLinearG:f32',
  'attenuationLinearB:f32',
  'attenuationDistanceM:f32',
  'absorptionCoefficientPerM:f32',
  'scatteringCoefficientPerM:f32',
  'renderModelId:f32',
  'vertexColorPolicyId:f32',
  'opticalDepth:f32',
  'blocked:f32',
  'status:f32',
  'pad0:f32'
]);
export const OPTICAL_GPU_SPECTRAL_SAMPLE_ROW_LAYOUT = Object.freeze([
  'wavelengthNm:f32',
  'reflectance:f32',
  'transmittance:f32',
  'absorptionCoefficientPerM:f32',
  'scatteringCoefficientPerM:f32',
  'n:f32',
  'k:f32',
  'pad0:f32'
]);
export const OPTICAL_GPU_LOOKUP_QUERY_ROW_LAYOUT = Object.freeze([
  'materialId:f32',
  'phaseId:f32',
  'pad0:f32',
  'pad1:f32'
]);
export const OPTICAL_GPU_LOOKUP_OUTPUT_ROW_LAYOUT = Object.freeze([
  'baseColorLinearR:f32',
  'baseColorLinearG:f32',
  'baseColorLinearB:f32',
  'opacity:f32',
  'metalness:f32',
  'roughness:f32',
  'transmission:f32',
  'ior:f32',
  'renderModelId:f32',
  'vertexColorPolicyId:f32',
  'status:f32',
  'recordIndex:f32'
]);
export const SPH_GPU_PARTICLE_STATE_ROW_LAYOUT = Object.freeze([
  'positionXM:f32',
  'positionYM:f32',
  'positionZM:f32',
  'massKg:f32',
  'velocityXMPerS:f32',
  'velocityYMPerS:f32',
  'velocityZMPerS:f32',
  'specificInternalEnergyJPerKg:f32'
]);
export const SPH_GPU_PARTICLE_THERMO_ROW_LAYOUT = Object.freeze([
  'materialId:f32',
  'phaseId:f32',
  'temperatureK:f32',
  'restDensityKgPerM3:f32',
  'phaseFractionSolid:f32',
  'phaseFractionLiquid:f32',
  'phaseFractionGas:f32',
  'phaseFractionPlasma:f32',
  'smoothingLengthM:f32',
  'representedEntityCount:f32',
  'status:f32',
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

/**
 * Explicit evidence that a cached closure was invalidated because a supervised carrier
 * run left its sampled validity domain. This is closure/provenance evidence only — it
 * records that a refresh/re-derivation is recommended, and never asserts that any
 * material/EOS/SPH/phase behaviour was validated.
 */
export function createClosureInvalidationArtifact({
  artifactId,
  closureRef,
  closureId = null,
  closureKind = null,
  refreshRequest,
  invalidation,
  simulationArtifactRef = null,
  provenance = {}
}) {
  if (!artifactId) {
    throw new Error('artifactId is required for ULG closure-invalidation artifacts');
  }
  if (!closureRef) {
    throw new Error('closureRef is required for ULG closure-invalidation artifacts');
  }
  if (!refreshRequest) {
    throw new Error('refreshRequest is required for ULG closure-invalidation artifacts');
  }
  return {
    schema: ULG_CLOSURE_INVALIDATION_ARTIFACT_SCHEMA,
    artifactId,
    sourceService: 'ulg-runtime',
    closureRef,
    closureId,
    closureKind,
    invalidatedClosureRef: invalidation?.ref || closureRef,
    status: invalidation?.status || 'invalidated',
    reason: invalidation?.reason || refreshRequest?.reason || 'closure-refresh-requested',
    registryAction: refreshRequest?.registryAction || 'invalidate-and-rerun-closure-derive',
    refreshRequest,
    simulationArtifactRef,
    scientificValidation: false,
    fullPhysicsValidation: false,
    materialValidation: false,
    eosValidation: false,
    sphValidation: false,
    phaseChangeValidation: false,
    provenance: {
      sourceService: 'ulg-runtime',
      parents: [closureRef, simulationArtifactRef].filter(Boolean),
      ...provenance,
      notes: [
        ...(provenance.notes || []),
        'Closure invalidated after a supervised carrier run left its sampled validity domain.',
        'Recommends closure refresh / re-derivation; closure-provenance evidence only.',
        'No material/EOS/SPH/phase validation is claimed.'
      ]
    }
  };
}

/**
 * Explicit evidence that an invalidated closure was re-derived with an expanded validity
 * domain so a supervised carrier run can continue. Records the old→new closure lineage and
 * the domain that was expanded. Closure/provenance evidence only — the re-derived closure is
 * a toy reference and never asserts material/EOS/SPH/phase validation.
 */
export function createClosureRederivationArtifact({
  artifactId,
  previousClosureRef,
  newClosureRef,
  previousClosureId = null,
  newClosureId = null,
  closureKind = null,
  refreshRequest,
  previousDomain = null,
  expandedDomain = null,
  axisName = 'r',
  invalidationArtifactRef = null,
  provenance = {}
}) {
  if (!artifactId) {
    throw new Error('artifactId is required for ULG closure-rederivation artifacts');
  }
  if (!previousClosureRef || !newClosureRef) {
    throw new Error('previousClosureRef and newClosureRef are required for ULG closure-rederivation artifacts');
  }
  return {
    schema: ULG_CLOSURE_REDERIVATION_ARTIFACT_SCHEMA,
    artifactId,
    sourceService: 'ulg-runtime',
    closureKind,
    previousClosureRef,
    newClosureRef,
    previousClosureId,
    newClosureId,
    axisName,
    previousDomain,
    expandedDomain,
    refreshRequest: refreshRequest || null,
    registryAction: 'rederived-and-reregistered-closure',
    status: 'rederived',
    scientificValidation: false,
    fullPhysicsValidation: false,
    materialValidation: false,
    eosValidation: false,
    sphValidation: false,
    phaseChangeValidation: false,
    provenance: {
      sourceService: 'ulg-runtime',
      parents: [previousClosureRef, newClosureRef, invalidationArtifactRef].filter(Boolean),
      ...provenance,
      notes: [
        ...(provenance.notes || []),
        'Re-derived an invalidated closure with an expanded validity domain after a carrier domain exit.',
        'Re-derived closure is a toy reference; closure/provenance evidence only.',
        'No material/EOS/SPH/phase validation is claimed.'
      ]
    }
  };
}

/**
 * Wrap a thermodynamic energy-feasibility preflight result as a content-addressable artifact.
 * This is the SPH phase demo's first physics artifact: a deterministic energy budget + per-wall
 * ledger + feasibility verdict. It is energy-budget/provenance evidence only — the material
 * numbers come from tagged reference fixtures (not validated closures), so the artifact always
 * carries `closureBacked: false` and no material/EOS/SPH/phase/scientific validation.
 */
export function createThermodynamicPreflightArtifact({
  artifactId,
  preflight,
  materialReferences = [],
  provenance = {}
}) {
  if (!artifactId) {
    throw new Error('artifactId is required for ULG thermodynamic preflight artifacts');
  }
  if (!preflight || typeof preflight !== 'object') {
    throw new Error('preflight result is required for ULG thermodynamic preflight artifacts');
  }
  return {
    schema: ULG_THERMODYNAMIC_PREFLIGHT_ARTIFACT_SCHEMA,
    artifactId,
    sourceService: 'ulg-runtime',
    scenarioId: preflight.scenarioId || null,
    status: preflight.status || null,
    geometry: preflight.geometry || null,
    masses: preflight.masses || null,
    initialState: preflight.initialState || null,
    boundary: preflight.boundary || null,
    energyBudget: preflight.energyBudget || null,
    transient: preflight.transient || null,
    feasibility: preflight.feasibility || null,
    particleResolution: preflight.particleResolution || null,
    materialReferences,
    closureBacked: false,
    scientificValidation: false,
    fullPhysicsValidation: false,
    materialValidation: false,
    eosValidation: false,
    sphValidation: false,
    phaseChangeValidation: false,
    blockers: Array.isArray(preflight.blockers) ? preflight.blockers : [],
    provenance: {
      sourceService: 'ulg-runtime',
      ...provenance,
      notes: [
        ...(provenance.notes || []),
        'Energy-feasibility preflight from tagged reference material fixtures; not closure-backed.',
        'No material/EOS/SPH/phase/scientific validation is claimed (demo plan P2+ provides closures and validation).'
      ]
    }
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
