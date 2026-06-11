import {
  OPTICAL_GPU_RECORD_ROW_LAYOUT,
  OPTICAL_GPU_LOOKUP_OUTPUT_ROW_LAYOUT,
  OPTICAL_GPU_LOOKUP_QUERY_ROW_LAYOUT,
  OPTICAL_GPU_SPECTRAL_SAMPLE_ROW_LAYOUT,
  ULG_OPTICAL_GPU_BUFFER_SET_SCHEMA,
  ULG_OPTICAL_GPU_LOOKUP_SCHEMA,
  ULG_OPTICAL_GPU_TABLE_SCHEMA
} from '../../../ulg-gpu-abi/src/index.js';
import { opticalLookupWgsl } from '../../../ulg-gpu-abi/src/wgsl.js';
import { opticalRenderParams } from './opticalClosure.js';

export { ULG_OPTICAL_GPU_BUFFER_SET_SCHEMA, ULG_OPTICAL_GPU_LOOKUP_SCHEMA, ULG_OPTICAL_GPU_TABLE_SCHEMA };
export const OPTICAL_GPU_RECORD_FLOATS = OPTICAL_GPU_RECORD_ROW_LAYOUT.length;
export const OPTICAL_GPU_SPECTRAL_SAMPLE_FLOATS = OPTICAL_GPU_SPECTRAL_SAMPLE_ROW_LAYOUT.length;
export const OPTICAL_GPU_LOOKUP_QUERY_FLOATS = OPTICAL_GPU_LOOKUP_QUERY_ROW_LAYOUT.length;
export const OPTICAL_GPU_LOOKUP_OUTPUT_FLOATS = OPTICAL_GPU_LOOKUP_OUTPUT_ROW_LAYOUT.length;
export const OPTICAL_GPU_RECORD_LAYOUT = OPTICAL_GPU_RECORD_ROW_LAYOUT;
export const OPTICAL_GPU_SPECTRAL_SAMPLE_LAYOUT = OPTICAL_GPU_SPECTRAL_SAMPLE_ROW_LAYOUT;
export const OPTICAL_GPU_LOOKUP_QUERY_LAYOUT = OPTICAL_GPU_LOOKUP_QUERY_ROW_LAYOUT;
export const OPTICAL_GPU_LOOKUP_OUTPUT_LAYOUT = OPTICAL_GPU_LOOKUP_OUTPUT_ROW_LAYOUT;
export { opticalLookupWgsl };

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
  pad0: f32,
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

const PHASE_IDS = Object.freeze({
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

function phaseId(phase) {
  return PHASE_IDS[phase] ?? PHASE_IDS.unknown;
}

function stableEnumId(map, value) {
  return map[value] ?? 0;
}

function materialKey(descriptor) {
  if (typeof descriptor === 'string') return descriptor;
  return descriptor?.material || descriptor?.renderKey || null;
}

function descriptorPhase(descriptor) {
  if (typeof descriptor === 'string') return 'unknown';
  return descriptor?.phase || 'unknown';
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
    if (!materialIds.has(material)) materialIds.set(material, materialIds.size + 1);
    return materialIds.get(material);
  };

  for (const descriptor of descriptors) {
    const material = materialKey(descriptor);
    if (!material) continue;
    const phase = descriptorPhase(descriptor);
    const key = `${material}|${phase}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const properties = typeof descriptor === 'object' && descriptor?.properties
      ? descriptor.properties
      : materialProperties[material];
    const params = opticalRenderParams({ material, phase, properties, pathLengthM });
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
      phaseId(phase),
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
      0
    ]);
    records.push({
      material,
      phase,
      materialId,
      phaseId: phaseId(phase),
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
  return {
    material: materialKey(descriptor),
    phase: descriptorPhase(descriptor)
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
    const { material, phase } = queryDescriptorKey(descriptor);
    const materialId = materialIds.get(material) ?? 0;
    const id = phaseId(phase);
    values.push(materialId, id, 0, 0);
    metadata.push({ material, phase, materialId, phaseId: id });
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
    let matched = -1;
    for (let recordIndex = 0; recordIndex < table.recordCount; recordIndex += 1) {
      const record = recordFloats(table, recordIndex);
      if (record[0] === materialId && record[1] === id) {
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
          recordIndex
        ], outputOffset);
        break;
      }
    }
    if (matched < 0) {
      outputs.set([0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 255, -1], queryIndex * OPTICAL_GPU_LOOKUP_OUTPUT_FLOATS);
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
    spectralSamplesBuffer: writeStorageBuffer(device, 'ulg-optical-spectral-samples', table.spectralSamples),
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
    const pipeline = device.createComputePipeline({
      layout: 'auto',
      compute: { module, entryPoint: 'main' }
    });
    const bindGroup = device.createBindGroup({
      layout: pipeline.getBindGroupLayout(0),
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
