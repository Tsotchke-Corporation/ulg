import {
  OPTICAL_GPU_RECORD_ROW_LAYOUT,
  OPTICAL_GPU_LOOKUP_OUTPUT_ROW_LAYOUT,
  OPTICAL_GPU_LOOKUP_QUERY_ROW_LAYOUT,
  OPTICAL_GPU_SPECTRAL_SAMPLE_ROW_LAYOUT,
  ULG_OPTICAL_GPU_BUFFER_SET_SCHEMA,
  ULG_OPTICAL_GPU_LOOKUP_EXECUTION_SCHEMA,
  ULG_OPTICAL_GPU_LOOKUP_PARITY_SCHEMA,
  ULG_OPTICAL_GPU_LOOKUP_SCHEMA,
  ULG_OPTICAL_GPU_TABLE_SCHEMA
} from '../../../ulg-gpu-abi/src/index.js';
import { opticalLookupWgsl } from '../../../ulg-gpu-abi/src/wgsl.js';
import { zForSymbol } from '../electronicStructure/periodicTable.js';
import { computeBufferBinding, createExplicitComputePipeline } from '../webgpuComputeLayout.js';
import { opticalRenderParams } from './opticalClosure.js';

export {
  ULG_OPTICAL_GPU_BUFFER_SET_SCHEMA,
  ULG_OPTICAL_GPU_LOOKUP_EXECUTION_SCHEMA,
  ULG_OPTICAL_GPU_LOOKUP_PARITY_SCHEMA,
  ULG_OPTICAL_GPU_LOOKUP_SCHEMA,
  ULG_OPTICAL_GPU_TABLE_SCHEMA
};
export const OPTICAL_GPU_RECORD_FLOATS = OPTICAL_GPU_RECORD_ROW_LAYOUT.length;
export const OPTICAL_GPU_SPECTRAL_SAMPLE_FLOATS = OPTICAL_GPU_SPECTRAL_SAMPLE_ROW_LAYOUT.length;
export const OPTICAL_GPU_LOOKUP_QUERY_FLOATS = OPTICAL_GPU_LOOKUP_QUERY_ROW_LAYOUT.length;
export const OPTICAL_GPU_LOOKUP_OUTPUT_FLOATS = OPTICAL_GPU_LOOKUP_OUTPUT_ROW_LAYOUT.length;
export const OPTICAL_GPU_RECORD_LAYOUT = OPTICAL_GPU_RECORD_ROW_LAYOUT;
export const OPTICAL_GPU_SPECTRAL_SAMPLE_LAYOUT = OPTICAL_GPU_SPECTRAL_SAMPLE_ROW_LAYOUT;
export const OPTICAL_GPU_LOOKUP_QUERY_LAYOUT = OPTICAL_GPU_LOOKUP_QUERY_ROW_LAYOUT;
export const OPTICAL_GPU_LOOKUP_OUTPUT_LAYOUT = OPTICAL_GPU_LOOKUP_OUTPUT_ROW_LAYOUT;
export { opticalLookupWgsl };
const EMPTY_OPTICAL_SPECTRAL_SAMPLE_ROWS = new Float32Array(OPTICAL_GPU_SPECTRAL_SAMPLE_FLOATS);

export const OPTICAL_GPU_WGSL_STRUCTS = `
struct OpticalMaterialRecord {
  material_id: f32,
  phase_id: f32,
  spectral_offset: f32,
  spectral_count: f32,
  base_color_linear: vec3<f32>,
  metalness: f32,
  roughness: f32,
  transmission: f32,
  opacity: f32,
  ior: f32,
  attenuation_linear: vec3<f32>,
  attenuation_distance_m: f32,
  absorption_coefficient_per_m: f32,
  scattering_coefficient_per_m: f32,
  render_model_id: f32,
  vertex_color_policy_id: f32,
  optical_depth: f32,
  blocked: f32,
  status: f32,
  optical_state_id: f32,
};

struct OpticalSpectralSample {
  wavelength_nm: f32,
  reflectance: f32,
  transmittance: f32,
  absorption_coefficient_per_m: f32,
  scattering_coefficient_per_m: f32,
  n: f32,
  k: f32,
  pad0: f32,
};
`;

const GPU_BUFFER_USAGE = {
  MAP_READ: globalThis.GPUBufferUsage?.MAP_READ ?? 1,
  COPY_SRC: globalThis.GPUBufferUsage?.COPY_SRC ?? 4,
  COPY_DST: globalThis.GPUBufferUsage?.COPY_DST ?? 8,
  STORAGE: globalThis.GPUBufferUsage?.STORAGE ?? 128,
  UNIFORM: globalThis.GPUBufferUsage?.UNIFORM ?? 64
};

const GPU_MAP_MODE = {
  READ: globalThis.GPUMapMode?.READ ?? 1
};

export const GPU_PHASE_IDS = Object.freeze({
  unknown: 0,
  solid: 1,
  liquid: 2,
  gas: 3,
  plasma: 4
});

const VERTEX_COLOR_POLICY_IDS = Object.freeze({
  'material-pbr': 1,
  'particle-diagnostic': 2,
  blocked: 255
});

const RENDER_MODEL_IDS = Object.freeze({
  'conductor-drude-lorentz-relativistic-interband': 1,
  'molecular-transparent-beer-lambert-pbr': 2,
  'molecular-vapor-transparent-spectrum': 3,
  'molecular-gap-pbr': 4,
  'rayleigh-gas-transparent-spectrum': 5,
  'conductor-drude-free-electron': 6,
  'molecular-condensed-droplet-scattering-pbr': 7,
  'blocked-missing-optical-closure': 255
});

function finiteNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function finiteGpuNumber(value, fallback = 0) {
  const number = Number(value);
  if (Number.isFinite(number)) return number;
  return fallback;
}

function srgbToLinear(value) {
  const v = Math.max(0, Math.min(1, finiteNumber(value)));
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
}

function linearRgb(values, fallback = [0, 0, 0]) {
  const source = Array.isArray(values) ? values : fallback;
  return [srgbToLinear(source[0]), srgbToLinear(source[1]), srgbToLinear(source[2])];
}

export function gpuPhaseId(phase) {
  return GPU_PHASE_IDS[phase] ?? GPU_PHASE_IDS.unknown;
}

function stableEnumId(map, value) {
  return map[value] ?? 0;
}

function materialKey(descriptor) {
  if (typeof descriptor === 'string') return descriptor;
  return descriptor?.material || descriptor?.renderKey || null;
}

function normalizeElementSymbol(candidate) {
  if (typeof candidate !== 'string' || candidate.length === 0) return null;
  return `${candidate[0].toUpperCase()}${candidate.slice(1).toLowerCase()}`;
}

function stableHashId(text) {
  let hash = 0x811c9dc5;
  for (const ch of String(text)) {
    hash ^= ch.charCodeAt(0);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  // Keep the id exactly representable in f32 and well away from atomic numbers.
  return 1000 + (hash % 8_000_000);
}

function stableNumberKey(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number.toPrecision(10) : String(value ?? 'null');
}

export function stableOpticalStateKey(value) {
  if (!value || typeof value !== 'object') return 'default';
  const entries = Object.keys(value)
    .filter((key) => value[key] != null)
    .sort()
    .map((key) => {
      const item = value[key];
      if (item && typeof item === 'object') return `${key}:{${stableOpticalStateKey(item)}}`;
      return `${key}:${stableNumberKey(item)}`;
    });
  return entries.length > 0 ? entries.join('|') : 'default';
}

export function stableOpticalStateId(value) {
  const key = stableOpticalStateKey(value);
  return key === 'default' ? 0 : stableHashId(`optical-state:${key}`);
}

export function stableOpticalMaterialId(material) {
  const symbol = normalizeElementSymbol(material);
  const Z = symbol ? zForSymbol(symbol) : null;
  if (Z != null) return Z;
  return stableHashId(String(material || 'unknown').toLowerCase());
}

function descriptorPhase(descriptor) {
  if (typeof descriptor === 'string') return 'unknown';
  return descriptor?.phase || 'unknown';
}

function descriptorOpticalState(descriptor) {
  return typeof descriptor === 'object' && descriptor ? descriptor.opticalState || null : null;
}

function spectralSampleFloats(sample) {
  return [
    finiteNumber(sample?.wavelengthNm),
    finiteNumber(sample?.reflectance),
    finiteNumber(sample?.transmittance),
    finiteNumber(sample?.absorptionCoefficientPerM),
    finiteNumber(sample?.scatteringCoefficientPerM),
    finiteNumber(sample?.n),
    finiteNumber(sample?.k),
    0
  ];
}

function appendRecord(values, record) {
  if (record.length !== OPTICAL_GPU_RECORD_FLOATS) {
    throw new Error(`Optical GPU record must be ${OPTICAL_GPU_RECORD_FLOATS} floats`);
  }
  values.push(...record);
}

export function buildOpticalGpuTable(descriptors, {
  materialProperties = {},
  pathLengthM = 0.25
} = {}) {
  if (!Array.isArray(descriptors)) {
    throw new TypeError('buildOpticalGpuTable requires an array of material/phase descriptors');
  }
  const recordValues = [];
  const sampleValues = [];
  const records = [];
  const materialIds = new Map();
  const seen = new Set();

  const materialIdFor = (material) => {
    if (!materialIds.has(material)) materialIds.set(material, stableOpticalMaterialId(material));
    return materialIds.get(material);
  };

  for (const descriptor of descriptors) {
    const material = materialKey(descriptor);
    if (!material) continue;
    const phase = descriptorPhase(descriptor);
    const opticalState = descriptorOpticalState(descriptor);
    const opticalStateKey = stableOpticalStateKey(opticalState);
    const opticalStateId = stableOpticalStateId(opticalState);
    const key = `${material}|${phase}|${opticalStateKey}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const properties = typeof descriptor === 'object' && descriptor?.properties
      ? descriptor.properties
      : materialProperties[material];
    const params = opticalRenderParams({ material, phase, properties, pathLengthM, opticalState });
    const materialId = materialIdFor(material);
    const spectralOffset = sampleValues.length / OPTICAL_GPU_SPECTRAL_SAMPLE_FLOATS;
    for (const sample of params.spectralSamples || []) {
      sampleValues.push(...spectralSampleFloats(sample));
    }
    const spectralCount = (sampleValues.length / OPTICAL_GPU_SPECTRAL_SAMPLE_FLOATS) - spectralOffset;
    const base = linearRgb(params.baseColorSrgb);
    const attenuation = linearRgb(params.attenuationColor, [1, 1, 1]);
    const scatter = Math.max(
      finiteNumber(params.scatteringCoefficientPerM),
      finiteNumber(params.condensationScatter),
      finiteNumber(params.internalScatter)
    );
    appendRecord(recordValues, [
      materialId,
      gpuPhaseId(phase),
      spectralOffset,
      spectralCount,
      base[0],
      base[1],
      base[2],
      finiteNumber(params.metalness),
      finiteNumber(params.roughness),
      finiteNumber(params.transmission),
      finiteNumber(params.opacity),
      finiteNumber(params.ior, 1),
      attenuation[0],
      attenuation[1],
      attenuation[2],
      finiteGpuNumber(params.attenuationDistanceM, 1e20),
      finiteNumber(params.absorptionCoefficientPerM),
      scatter,
      stableEnumId(RENDER_MODEL_IDS, params.renderModel),
      stableEnumId(VERTEX_COLOR_POLICY_IDS, params.vertexColorPolicy),
      finiteNumber(params.opticalDepth),
      params.blocked ? 1 : 0,
      params.provenance?.status === 'blocked' ? 255 : 1,
      opticalStateId
    ]);
    records.push({
      material,
      phase,
      opticalState: opticalState ? { ...opticalState } : null,
      opticalStateKey,
      opticalStateId,
      materialId,
      phaseId: gpuPhaseId(phase),
      recordIndex: records.length,
      spectralOffset,
      spectralCount,
      renderModel: params.renderModel,
      renderModelId: stableEnumId(RENDER_MODEL_IDS, params.renderModel),
      vertexColorPolicy: params.vertexColorPolicy,
      vertexColorPolicyId: stableEnumId(VERTEX_COLOR_POLICY_IDS, params.vertexColorPolicy),
      blocked: params.blocked === true,
      provenance: params.provenance || null
    });
  }

  return {
    schema: ULG_OPTICAL_GPU_TABLE_SCHEMA,
    status: 'cpu-derived-gpu-buffer-ready',
    recordLayout: [...OPTICAL_GPU_RECORD_LAYOUT],
    spectralSampleLayout: [...OPTICAL_GPU_SPECTRAL_SAMPLE_LAYOUT],
    recordStrideFloats: OPTICAL_GPU_RECORD_FLOATS,
    spectralSampleStrideFloats: OPTICAL_GPU_SPECTRAL_SAMPLE_FLOATS,
    recordStrideBytes: OPTICAL_GPU_RECORD_FLOATS * Float32Array.BYTES_PER_ELEMENT,
    spectralSampleStrideBytes: OPTICAL_GPU_SPECTRAL_SAMPLE_FLOATS * Float32Array.BYTES_PER_ELEMENT,
    wgslStructs: OPTICAL_GPU_WGSL_STRUCTS,
    records: Float32Array.from(recordValues),
    spectralSamples: Float32Array.from(sampleValues),
    recordCount: records.length,
    spectralSampleCount: sampleValues.length / OPTICAL_GPU_SPECTRAL_SAMPLE_FLOATS,
    materialMap: [...materialIds.entries()].map(([material, materialId]) => ({ material, materialId })),
    recordMetadata: records,
    colorSpace: 'linear-rgb-from-srgb-closure-output',
    scientificValidation: false,
    fullPhysicsValidation: false
  };
}

function recordFloats(table, recordIndex) {
  const start = recordIndex * OPTICAL_GPU_RECORD_FLOATS;
  return table.records.slice(start, start + OPTICAL_GPU_RECORD_FLOATS);
}

function queryDescriptorKey(descriptor) {
  const opticalState = descriptorOpticalState(descriptor);
  return {
    material: materialKey(descriptor),
    phase: descriptorPhase(descriptor),
    opticalState,
    opticalStateKey: stableOpticalStateKey(opticalState),
    opticalStateId: stableOpticalStateId(opticalState)
  };
}

export function buildOpticalGpuLookupQueries(table, descriptors) {
  if (table?.schema !== ULG_OPTICAL_GPU_TABLE_SCHEMA) {
    throw new TypeError('buildOpticalGpuLookupQueries requires an optical GPU table');
  }
  if (!Array.isArray(descriptors)) {
    throw new TypeError('buildOpticalGpuLookupQueries requires an array of descriptors');
  }
  const materialIds = new Map(table.materialMap.map((entry) => [entry.material, entry.materialId]));
  const values = [];
  const metadata = [];
  for (const descriptor of descriptors) {
    const { material, phase, opticalState, opticalStateKey, opticalStateId } = queryDescriptorKey(descriptor);
    const materialId = materialIds.get(material) ?? 0;
    const id = gpuPhaseId(phase);
    values.push(materialId, id, opticalStateId, 0);
    metadata.push({ material, phase, opticalState, opticalStateKey, opticalStateId, materialId, phaseId: id });
  }
  return {
    schema: ULG_OPTICAL_GPU_LOOKUP_SCHEMA,
    queryLayout: [...OPTICAL_GPU_LOOKUP_QUERY_LAYOUT],
    outputLayout: [...OPTICAL_GPU_LOOKUP_OUTPUT_LAYOUT],
    queryStrideFloats: OPTICAL_GPU_LOOKUP_QUERY_FLOATS,
    outputStrideFloats: OPTICAL_GPU_LOOKUP_OUTPUT_FLOATS,
    queries: Float32Array.from(values),
    queryCount: descriptors.length,
    metadata,
    scientificValidation: false,
    fullPhysicsValidation: false
  };
}

export function sampleOpticalGpuTableCpu(table, lookup) {
  if (table?.schema !== ULG_OPTICAL_GPU_TABLE_SCHEMA) {
    throw new TypeError('sampleOpticalGpuTableCpu requires an optical GPU table');
  }
  if (lookup?.schema !== ULG_OPTICAL_GPU_LOOKUP_SCHEMA) {
    throw new TypeError('sampleOpticalGpuTableCpu requires lookup queries');
  }
  const outputs = new Float32Array(lookup.queryCount * OPTICAL_GPU_LOOKUP_OUTPUT_FLOATS);
  for (let queryIndex = 0; queryIndex < lookup.queryCount; queryIndex += 1) {
    const queryOffset = queryIndex * OPTICAL_GPU_LOOKUP_QUERY_FLOATS;
    const materialId = lookup.queries[queryOffset];
    const id = lookup.queries[queryOffset + 1];
    const opticalStateId = lookup.queries[queryOffset + 2];
    let matched = -1;
    for (let recordIndex = 0; recordIndex < table.recordCount; recordIndex += 1) {
      const record = recordFloats(table, recordIndex);
      if (record[0] === materialId && record[1] === id && record[23] === opticalStateId) {
        matched = recordIndex;
        const outputOffset = queryIndex * OPTICAL_GPU_LOOKUP_OUTPUT_FLOATS;
        outputs.set([
          record[4],
          record[5],
          record[6],
          record[10],
          record[7],
          record[8],
          record[9],
          record[11],
          record[18],
          record[19],
          record[22],
          recordIndex,
          record[20],
          record[17],
          record[16],
          record[23]
        ], outputOffset);
        break;
      }
    }
    if (matched < 0) {
      outputs.set([0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 255, -1, 0, 0, 0, opticalStateId], queryIndex * OPTICAL_GPU_LOOKUP_OUTPUT_FLOATS);
    }
  }
  return {
    schema: ULG_OPTICAL_GPU_LOOKUP_SCHEMA,
    backend: 'cpu-reference',
    outputLayout: [...OPTICAL_GPU_LOOKUP_OUTPUT_LAYOUT],
    outputStrideFloats: OPTICAL_GPU_LOOKUP_OUTPUT_FLOATS,
    queryCount: lookup.queryCount,
    outputs,
    scientificValidation: false,
    fullPhysicsValidation: false
  };
}

export function createOpticalGpuLookupParityReport({ cpuReference, gpuResult, tolerance = 1e-6 } = {}) {
  const cpuOutputs = cpuReference?.outputs;
  const gpuOutputs = gpuResult?.outputs;
  if (!(cpuOutputs instanceof Float32Array) || !(gpuOutputs instanceof Float32Array)) {
    return {
      schema: ULG_OPTICAL_GPU_LOOKUP_PARITY_SCHEMA,
      status: 'fail',
      tolerance,
      maxOutputAbs: Number.POSITIVE_INFINITY,
      lengthMismatch: true,
      cpuBackend: cpuReference?.backend || null,
      gpuBackend: gpuResult?.backend || null,
      reason: 'missing lookup output buffers',
      scientificValidation: false,
      fullPhysicsValidation: false
    };
  }
  const comparisonCount = Math.min(cpuOutputs.length, gpuOutputs.length);
  let maxOutputAbs = 0;
  for (let index = 0; index < comparisonCount; index += 1) {
    maxOutputAbs = Math.max(maxOutputAbs, Math.abs(cpuOutputs[index] - gpuOutputs[index]));
  }
  const lengthMismatch = cpuOutputs.length !== gpuOutputs.length;
  const passed = !lengthMismatch && maxOutputAbs <= tolerance;
  return {
    schema: ULG_OPTICAL_GPU_LOOKUP_PARITY_SCHEMA,
    status: passed ? 'pass' : 'fail',
    tolerance,
    maxOutputAbs,
    lengthMismatch,
    outputCount: cpuOutputs.length,
    cpuBackend: cpuReference.backend,
    gpuBackend: gpuResult.backend,
    scientificValidation: false,
    fullPhysicsValidation: false
  };
}

export function decodeOpticalGpuLookupOutputRows(result, lookup = null) {
  const outputs = result?.outputs;
  if (!(outputs instanceof Float32Array)) {
    throw new TypeError('decodeOpticalGpuLookupOutputRows requires Float32Array lookup outputs');
  }
  const queryCount = result.queryCount ?? lookup?.queryCount ?? (outputs.length / OPTICAL_GPU_LOOKUP_OUTPUT_FLOATS);
  const rows = [];
  for (let queryIndex = 0; queryIndex < queryCount; queryIndex += 1) {
    const offset = queryIndex * OPTICAL_GPU_LOOKUP_OUTPUT_FLOATS;
    rows.push({
      queryIndex,
      material: lookup?.metadata?.[queryIndex]?.material ?? null,
      phase: lookup?.metadata?.[queryIndex]?.phase ?? null,
      opticalState: lookup?.metadata?.[queryIndex]?.opticalState ?? null,
      opticalStateKey: lookup?.metadata?.[queryIndex]?.opticalStateKey ?? null,
      opticalStateId: lookup?.metadata?.[queryIndex]?.opticalStateId ?? null,
      materialId: lookup?.metadata?.[queryIndex]?.materialId ?? null,
      phaseId: lookup?.metadata?.[queryIndex]?.phaseId ?? null,
      baseColorLinear: [outputs[offset], outputs[offset + 1], outputs[offset + 2]],
      opacity: outputs[offset + 3],
      metalness: outputs[offset + 4],
      roughness: outputs[offset + 5],
      transmission: outputs[offset + 6],
      ior: outputs[offset + 7],
      renderModelId: outputs[offset + 8],
      vertexColorPolicyId: outputs[offset + 9],
      status: outputs[offset + 10],
      recordIndex: outputs[offset + 11],
      opticalDepth: outputs[offset + 12],
      scatteringCoefficientPerM: outputs[offset + 13],
      absorptionCoefficientPerM: outputs[offset + 14],
      outputOpticalStateId: outputs[offset + 15]
    });
  }
  return rows;
}

function lookupExecutionFromResult(result, {
  cpuReference = null,
  gpuResult = null,
  webgpuStatus,
  webgpuParity = null
} = {}) {
  return {
    schema: ULG_OPTICAL_GPU_LOOKUP_EXECUTION_SCHEMA,
    lookupResultSchema: result?.schema || ULG_OPTICAL_GPU_LOOKUP_SCHEMA,
    backend: result?.backend || 'cpu-reference',
    outputLayout: [...OPTICAL_GPU_LOOKUP_OUTPUT_LAYOUT],
    outputStrideFloats: OPTICAL_GPU_LOOKUP_OUTPUT_FLOATS,
    queryCount: result?.queryCount ?? 0,
    outputs: result?.outputs ?? new Float32Array(),
    cpuReference,
    gpuResult,
    webgpuStatus,
    webgpuParity,
    scientificValidation: false,
    fullPhysicsValidation: false
  };
}

function describeDeviceLost(info) {
  return info?.reason || info?.message || 'device lost';
}

function watchDeviceLost(device, onDeviceLost) {
  if (!device?.lost?.then) return;
  device.lost.then((info) => {
    onDeviceLost(info);
  }).catch((error) => {
    onDeviceLost(error);
  });
}

const DEFAULT_STORAGE_BUFFERS_PER_STAGE = 8;
const RESIDENT_SPH_STORAGE_BUFFERS_PER_STAGE = 10;

export async function requestOpticalGpuDevice(navigatorRef = globalThis.navigator, { onDeviceLost = null } = {}) {
  if (!navigatorRef?.gpu) {
    return { status: 'blocked-webgpu-unavailable', reason: 'navigator.gpu unavailable', device: null };
  }
  const adapter = await navigatorRef.gpu.requestAdapter();
  if (!adapter) {
    return { status: 'blocked-webgpu-unavailable', reason: 'requestAdapter returned null', device: null };
  }
  const adapterStorageLimit = Number(adapter.limits?.maxStorageBuffersPerShaderStage || 0);
  const requiredLimits = {};
  if (adapterStorageLimit >= RESIDENT_SPH_STORAGE_BUFFERS_PER_STAGE) {
    requiredLimits.maxStorageBuffersPerShaderStage = Math.max(
      DEFAULT_STORAGE_BUFFERS_PER_STAGE,
      RESIDENT_SPH_STORAGE_BUFFERS_PER_STAGE
    );
  }
  const deviceDescriptor = Object.keys(requiredLimits).length > 0
    ? { requiredLimits }
    : undefined;
  const device = await adapter.requestDevice(deviceDescriptor);
  if (typeof onDeviceLost === 'function') {
    watchDeviceLost(device, onDeviceLost);
  }
  return {
    status: 'webgpu-device-ready',
    reason: 'device acquired',
    device,
    requiredLimits,
    adapterLimits: {
      maxStorageBuffersPerShaderStage: adapterStorageLimit || null
    }
  };
}

function writeStorageBuffer(device, label, data) {
  const byteLength = Math.max(4, data.byteLength);
  const buffer = device.createBuffer({
    label,
    size: byteLength,
    usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_DST
  });
  if (data.byteLength > 0) device.queue.writeBuffer(buffer, 0, data);
  return buffer;
}

export function uploadOpticalGpuTable(device, table) {
  if (!device?.createBuffer || !device.queue?.writeBuffer) {
    throw new TypeError('uploadOpticalGpuTable requires a WebGPU-like device with queue.writeBuffer');
  }
  if (table?.schema !== ULG_OPTICAL_GPU_TABLE_SCHEMA) {
    throw new TypeError('uploadOpticalGpuTable requires a table from buildOpticalGpuTable');
  }
  return {
    schema: ULG_OPTICAL_GPU_BUFFER_SET_SCHEMA,
    tableSchema: table.schema,
    recordCount: table.recordCount,
    spectralSampleCount: table.spectralSampleCount,
    recordStrideBytes: table.recordStrideBytes,
    spectralSampleStrideBytes: table.spectralSampleStrideBytes,
    recordsBuffer: writeStorageBuffer(device, 'ulg-optical-material-records', table.records),
    spectralSamplesBuffer: writeStorageBuffer(
      device,
      'ulg-optical-spectral-samples',
      table.spectralSamples.length >= OPTICAL_GPU_SPECTRAL_SAMPLE_FLOATS
        ? table.spectralSamples
        : EMPTY_OPTICAL_SPECTRAL_SAMPLE_ROWS
    ),
    scientificValidation: false,
    fullPhysicsValidation: false
  };
}

function createLookupParamsArray({ recordCount, queryCount }) {
  const buffer = new ArrayBuffer(16);
  const view = new DataView(buffer);
  view.setUint32(0, recordCount, true);
  view.setUint32(4, queryCount, true);
  view.setUint32(8, 0, true);
  view.setUint32(12, 0, true);
  return buffer;
}

export async function runOpticalGpuLookup({ device, table, lookup }) {
  if (!device?.createBuffer || !device.queue?.writeBuffer) {
    throw new TypeError('runOpticalGpuLookup requires a WebGPU-like device with queue.writeBuffer');
  }
  if (table?.schema !== ULG_OPTICAL_GPU_TABLE_SCHEMA) {
    throw new TypeError('runOpticalGpuLookup requires an optical GPU table');
  }
  if (lookup?.schema !== ULG_OPTICAL_GPU_LOOKUP_SCHEMA) {
    throw new TypeError('runOpticalGpuLookup requires lookup queries');
  }
  const outputByteLength = lookup.queryCount * OPTICAL_GPU_LOOKUP_OUTPUT_FLOATS * Float32Array.BYTES_PER_ELEMENT;
  const recordBuffer = writeStorageBuffer(device, 'ulg-optical-lookup-records', table.records);
  const queryBuffer = writeStorageBuffer(device, 'ulg-optical-lookup-queries', lookup.queries);
  const outputBuffer = device.createBuffer({
    label: 'ulg-optical-lookup-outputs',
    size: Math.max(4, outputByteLength),
    usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_SRC
  });
  const paramsBuffer = device.createBuffer({
    label: 'ulg-optical-lookup-params',
    size: 16,
    usage: GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST
  });
  const readBuffer = device.createBuffer({
    label: 'ulg-optical-lookup-readback',
    size: Math.max(4, outputByteLength),
    usage: GPU_BUFFER_USAGE.MAP_READ | GPU_BUFFER_USAGE.COPY_DST
  });
  try {
    device.queue.writeBuffer(paramsBuffer, 0, createLookupParamsArray({
      recordCount: table.recordCount,
      queryCount: lookup.queryCount
    }));
    const module = device.createShaderModule({ code: opticalLookupWgsl });
    const { pipeline, bindGroupLayout } = createExplicitComputePipeline(device, {
      label: 'ulg-optical-lookup',
      module,
      entryPoint: 'main',
      bindings: [
        computeBufferBinding(0, 'read-only-storage'),
        computeBufferBinding(1, 'read-only-storage'),
        computeBufferBinding(2, 'storage'),
        computeBufferBinding(3, 'uniform')
      ]
    });
    const bindGroup = device.createBindGroup({
      layout: bindGroupLayout,
      entries: [
        { binding: 0, resource: { buffer: recordBuffer } },
        { binding: 1, resource: { buffer: queryBuffer } },
        { binding: 2, resource: { buffer: outputBuffer } },
        { binding: 3, resource: { buffer: paramsBuffer } }
      ]
    });
    const encoder = device.createCommandEncoder();
    const pass = encoder.beginComputePass();
    pass.setPipeline(pipeline);
    pass.setBindGroup(0, bindGroup);
    pass.dispatchWorkgroups(Math.max(1, Math.ceil(lookup.queryCount / 64)));
    pass.end();
    encoder.copyBufferToBuffer(outputBuffer, 0, readBuffer, 0, Math.max(4, outputByteLength));
    device.queue.submit([encoder.finish()]);
    await readBuffer.mapAsync(GPU_MAP_MODE.READ);
    const outputs = new Float32Array(readBuffer.getMappedRange()).slice(0, lookup.queryCount * OPTICAL_GPU_LOOKUP_OUTPUT_FLOATS);
    readBuffer.unmap();
    return {
      schema: ULG_OPTICAL_GPU_LOOKUP_SCHEMA,
      backend: 'webgpu',
      outputLayout: [...OPTICAL_GPU_LOOKUP_OUTPUT_LAYOUT],
      outputStrideFloats: OPTICAL_GPU_LOOKUP_OUTPUT_FLOATS,
      queryCount: lookup.queryCount,
      outputs,
      scientificValidation: false,
      fullPhysicsValidation: false
    };
  } finally {
    recordBuffer.destroy?.();
    queryBuffer.destroy?.();
    outputBuffer.destroy?.();
    paramsBuffer.destroy?.();
    readBuffer.destroy?.();
  }
}

export async function runOpticalGpuLookupWithOptionalWebGpu({
  table,
  lookup,
  cpuReference = null,
  preferWebGpu = false,
  navigatorRef = globalThis.navigator,
  device = null,
  deviceResult = null,
  parityTolerance = 1e-6,
  onDeviceLost = null,
  webGpuRunner = runOpticalGpuLookup
} = {}) {
  const cpuResult = cpuReference || sampleOpticalGpuTableCpu(table, lookup);
  if (!preferWebGpu) {
    return lookupExecutionFromResult(cpuResult, {
      cpuReference: cpuResult,
      webgpuStatus: {
        status: 'not-requested',
        reason: 'WebGPU optical lookup path not requested'
      }
    });
  }
  try {
    let lostInfo = null;
    const resolvedDeviceResult = device
      ? { status: 'webgpu-device-ready', reason: 'provided device', device }
      : (deviceResult || await requestOpticalGpuDevice(navigatorRef));
    if (resolvedDeviceResult.device) {
      watchDeviceLost(resolvedDeviceResult.device, (info) => {
        lostInfo = info;
        if (typeof onDeviceLost === 'function') onDeviceLost(info);
      });
    }
    if (!resolvedDeviceResult.device) {
      return lookupExecutionFromResult(cpuResult, {
        cpuReference: cpuResult,
        webgpuStatus: {
          status: resolvedDeviceResult.status,
          reason: resolvedDeviceResult.reason,
          fallback: 'cpu-reference'
        }
      });
    }
    await Promise.resolve();
    if (lostInfo) {
      return lookupExecutionFromResult(cpuResult, {
        cpuReference: cpuResult,
        webgpuStatus: {
          status: 'webgpu-device-lost-fallback',
          reason: describeDeviceLost(lostInfo),
          fallback: 'cpu-reference'
        }
      });
    }
    const gpuResult = await webGpuRunner({ device: resolvedDeviceResult.device, table, lookup });
    await Promise.resolve();
    if (lostInfo) {
      return lookupExecutionFromResult(cpuResult, {
        cpuReference: cpuResult,
        gpuResult,
        webgpuStatus: {
          status: 'webgpu-device-lost-fallback',
          reason: describeDeviceLost(lostInfo),
          fallback: 'cpu-reference'
        }
      });
    }
    const webgpuParity = createOpticalGpuLookupParityReport({
      cpuReference: cpuResult,
      gpuResult,
      tolerance: parityTolerance
    });
    if (webgpuParity.status !== 'pass') {
      return lookupExecutionFromResult(cpuResult, {
        cpuReference: cpuResult,
        gpuResult,
        webgpuStatus: {
          status: 'webgpu-parity-failed',
          reason: 'CPU/WebGPU optical lookup parity exceeded tolerance',
          fallback: 'cpu-reference'
        },
        webgpuParity
      });
    }
    return lookupExecutionFromResult(gpuResult, {
      cpuReference: cpuResult,
      gpuResult,
      webgpuStatus: {
        status: 'webgpu-executed',
        reason: 'CPU/WebGPU optical lookup parity passed'
      },
      webgpuParity
    });
  } catch (error) {
    return lookupExecutionFromResult(cpuResult, {
      cpuReference: cpuResult,
      webgpuStatus: {
        status: 'webgpu-error-fallback',
        reason: error instanceof Error ? error.message : String(error),
        fallback: 'cpu-reference'
      }
    });
  }
}
