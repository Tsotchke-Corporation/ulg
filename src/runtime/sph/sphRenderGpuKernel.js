import {
  SPH_GPU_RENDER_ROW_LAYOUT,
  ULG_SPH_GPU_PARTICLE_BUFFER_SCHEMA,
  ULG_SPH_GPU_RENDER_ROWS_EXECUTION_SCHEMA,
  ULG_SPH_GPU_RENDER_ROWS_SCHEMA
} from '../../../ulg-gpu-abi/src/index.js';
import { sphRenderRowsWgsl } from '../../../ulg-gpu-abi/src/wgsl.js';
import { GPU_PHASE_IDS, requestOpticalGpuDevice, stableOpticalMaterialId } from '../material/opticalGpuBuffers.js';
import { opticalRenderParams } from '../material/opticalClosure.js';
import { incandescentColor } from '../material/radiationClosure.js';
import { computeBufferBinding, createExplicitComputePipeline } from '../webgpuComputeLayout.js';
import {
  SPH_GPU_PARTICLE_STATE_FLOATS,
  SPH_GPU_PARTICLE_THERMO_FLOATS
} from './sphGpuBuffers.js';

export {
  ULG_SPH_GPU_RENDER_ROWS_EXECUTION_SCHEMA,
  ULG_SPH_GPU_RENDER_ROWS_SCHEMA,
  sphRenderRowsWgsl
};

export const SPH_GPU_RENDER_ROW_FLOATS = SPH_GPU_RENDER_ROW_LAYOUT.length;

const RENDER_SCOPE = 'sph-resident-render-row-extraction';
const PHASE_NAMES_BY_ID = Object.freeze(Object.fromEntries(
  Object.entries(GPU_PHASE_IDS).map(([name, id]) => [id, name])
));

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

function assertPackedSphParticleState(sphParticleState) {
  if (sphParticleState?.schema !== ULG_SPH_GPU_PARTICLE_BUFFER_SCHEMA) {
    throw new TypeError('SPH render rows require a packed SPH GPU particle buffer');
  }
}

function finiteNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function phaseNameForId(phaseId) {
  return PHASE_NAMES_BY_ID[Math.round(finiteNumber(phaseId, 0))] || 'unknown';
}

function renderKeyFor(material, phase) {
  if (material === 'h2o' && phase === 'solid') return 'ice';
  if (material === 'h2o' && phase === 'gas') return 'steam';
  return material || 'unknown';
}

export function buildSphRenderMaterialMap(materialProperties = {}, reactionTable = null) {
  const entries = new Map();
  for (const material of Object.keys(materialProperties || {})) {
    entries.set(stableOpticalMaterialId(material), material);
  }
  for (const reaction of reactionTable?.metadata || []) {
    if (reaction.product) entries.set(reaction.productMaterialId, reaction.product);
    if (reaction.a) entries.set(reaction.aMaterialId, reaction.a);
    if (reaction.b) entries.set(reaction.bMaterialId, reaction.b);
  }
  return entries;
}

function colorFor({ material, phase, temperatureK, materialProperties }) {
  const incandescence = incandescentColor(temperatureK);
  if (incandescence.visible) return [...incandescence.srgb];
  const properties = materialProperties?.[material]
    ?? materialProperties?.[String(material).toLowerCase()]
    ?? materialProperties?.[String(material).toUpperCase()]
    ?? null;
  const optics = opticalRenderParams({ material, phase, properties });
  return optics.baseColorSrgb ?? optics.pbr?.baseColorSrgb ?? [1, 1, 1];
}

export function emissiveByMaterialFromSphRenderRows(rows = []) {
  const acc = {};
  for (const row of rows || []) {
    const incandescence = incandescentColor(row.temperatureK);
    if (!incandescence.visible) continue;
    const lum = 0.2126 * incandescence.srgb[0] + 0.7152 * incandescence.srgb[1] + 0.0722 * incandescence.srgb[2];
    const keys = [row.material, row.renderKey].filter(Boolean);
    for (const key of keys) {
      const entry = acc[key] || (acc[key] = { r: 0, g: 0, b: 0, w: 0 });
      entry.r += incandescence.srgb[0] * lum;
      entry.g += incandescence.srgb[1] * lum;
      entry.b += incandescence.srgb[2] * lum;
      entry.w += lum;
    }
  }
  const out = {};
  for (const [material, entry] of Object.entries(acc)) {
    out[material] = entry.w > 0
      ? [entry.r / entry.w, entry.g / entry.w, entry.b / entry.w]
      : null;
  }
  return out;
}

export function decodeSphRenderRows(renderRows, {
  materialProperties = {},
  reactionTable = null,
  materialMap = buildSphRenderMaterialMap(materialProperties, reactionTable)
} = {}) {
  if (!(renderRows instanceof Float32Array)) {
    throw new TypeError('decodeSphRenderRows requires Float32Array render rows');
  }
  if (renderRows.length % SPH_GPU_RENDER_ROW_FLOATS !== 0) {
    throw new RangeError('SPH render rows length must align to the render row stride');
  }
  const particleCount = renderRows.length / SPH_GPU_RENDER_ROW_FLOATS;
  const positionsM = new Float32Array(particleCount * 3);
  const colorsRgb = new Float32Array(particleCount * 3);
  const materials = new Array(particleCount);
  const rows = [];

  for (let index = 0; index < particleCount; index += 1) {
    const offset = index * SPH_GPU_RENDER_ROW_FLOATS;
    const materialId = renderRows[offset + 4];
    const phaseId = renderRows[offset + 5];
    const material = materialMap.get(materialId) || 'unknown';
    const phase = phaseNameForId(phaseId);
    const renderKey = renderKeyFor(material, phase);
    const temperatureK = renderRows[offset + 6];
    const rgb = colorFor({ material, phase, temperatureK, materialProperties });
    positionsM.set([renderRows[offset], renderRows[offset + 1], renderRows[offset + 2]], index * 3);
    colorsRgb.set(rgb, index * 3);
    materials[index] = { material, phase, renderKey };
    rows.push({
      index,
      positionM: [renderRows[offset], renderRows[offset + 1], renderRows[offset + 2]],
      massKg: renderRows[offset + 3],
      materialId,
      material,
      phaseId,
      phase,
      temperatureK,
      status: renderRows[offset + 7],
      restDensityKgPerM3: renderRows[offset + 8],
      phaseFractionGas: renderRows[offset + 9],
      representedEntityCount: renderRows[offset + 10],
      renderKey
    });
  }

  return {
    schema: ULG_SPH_GPU_RENDER_ROWS_SCHEMA,
    status: 'render-rows-decoded',
    particleCount,
    positionsM,
    colorsRgb,
    materials,
    rows,
    emissiveByMaterial: emissiveByMaterialFromSphRenderRows(rows),
    scientificValidation: false,
    sphValidation: false,
    phaseChangeValidation: false,
    fullPhysicsValidation: false
  };
}

export function extractSphRenderRowsCpu({ sphParticleState } = {}) {
  assertPackedSphParticleState(sphParticleState);
  const renderRows = new Float32Array(sphParticleState.particleCount * SPH_GPU_RENDER_ROW_FLOATS);
  for (let index = 0; index < sphParticleState.particleCount; index += 1) {
    const stateOffset = index * SPH_GPU_PARTICLE_STATE_FLOATS;
    const thermoOffset = index * SPH_GPU_PARTICLE_THERMO_FLOATS;
    const renderOffset = index * SPH_GPU_RENDER_ROW_FLOATS;
    renderRows.set([
      sphParticleState.state[stateOffset],
      sphParticleState.state[stateOffset + 1],
      sphParticleState.state[stateOffset + 2],
      sphParticleState.state[stateOffset + 3],
      sphParticleState.thermo[thermoOffset],
      sphParticleState.thermo[thermoOffset + 1],
      sphParticleState.thermo[thermoOffset + 2],
      sphParticleState.thermo[thermoOffset + 10],
      sphParticleState.thermo[thermoOffset + 3],
      sphParticleState.thermo[thermoOffset + 6],
      sphParticleState.thermo[thermoOffset + 9],
      0
    ], renderOffset);
  }
  return {
    schema: ULG_SPH_GPU_RENDER_ROWS_SCHEMA,
    backend: 'cpu-reference',
    status: 'render-rows-extracted',
    kernelScope: RENDER_SCOPE,
    particleCount: sphParticleState.particleCount,
    rowLayout: [...SPH_GPU_RENDER_ROW_LAYOUT],
    rowStrideFloats: SPH_GPU_RENDER_ROW_FLOATS,
    renderRows,
    renderRowByteLength: renderRows.byteLength,
    scientificValidation: false,
    sphValidation: false,
    phaseChangeValidation: false,
    fullPhysicsValidation: false
  };
}

function writeStorageBuffer(device, label, data, extraUsage = 0) {
  const byteLength = Math.max(4, data.byteLength);
  const buffer = device.createBuffer({
    label,
    size: byteLength,
    usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_DST | extraUsage
  });
  if (data.byteLength > 0) device.queue.writeBuffer(buffer, 0, data);
  return buffer;
}

function createParamsArray(particleCount) {
  const buffer = new ArrayBuffer(16);
  const view = new DataView(buffer);
  view.setUint32(0, particleCount, true);
  view.setUint32(4, 0, true);
  view.setUint32(8, 0, true);
  view.setUint32(12, 0, true);
  return buffer;
}

async function readBuffer(device, sourceBuffer, byteLength) {
  const readback = device.createBuffer({
    label: 'ulg-sph-render-rows-readback',
    size: Math.max(4, byteLength),
    usage: GPU_BUFFER_USAGE.MAP_READ | GPU_BUFFER_USAGE.COPY_DST
  });
  const encoder = device.createCommandEncoder();
  encoder.copyBufferToBuffer(sourceBuffer, 0, readback, 0, byteLength);
  device.queue.submit([encoder.finish()]);
  await readback.mapAsync(GPU_MAP_MODE.READ);
  const copy = readback.getMappedRange().slice(0);
  readback.unmap();
  readback.destroy?.();
  return copy;
}

export async function extractSphRenderRowsWebGpu({
  device,
  sphParticleState,
  sphParticleUpload = null,
  sourceStateBuffer = null,
  sourceThermoBuffer = null
} = {}) {
  assertPackedSphParticleState(sphParticleState);
  if (!device?.createBuffer || !device.queue?.writeBuffer) {
    throw new TypeError('extractSphRenderRowsWebGpu requires a WebGPU-like device');
  }
  const borrowedStateBuffer = sourceStateBuffer || sphParticleUpload?.stateBuffer || null;
  const borrowedThermoBuffer = sourceThermoBuffer || sphParticleUpload?.thermoBuffer || null;
  const stateBuffer = borrowedStateBuffer || writeStorageBuffer(device, 'ulg-sph-render-source-state', sphParticleState.state);
  const thermoBuffer = borrowedThermoBuffer || writeStorageBuffer(device, 'ulg-sph-render-source-thermo', sphParticleState.thermo);
  const renderRowsBuffer = writeStorageBuffer(
    device,
    'ulg-sph-render-rows',
    new Float32Array(sphParticleState.particleCount * SPH_GPU_RENDER_ROW_FLOATS),
    GPU_BUFFER_USAGE.COPY_SRC
  );
  const paramsBuffer = device.createBuffer({
    label: 'ulg-sph-render-rows-params',
    size: 16,
    usage: GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST
  });
  device.queue.writeBuffer(paramsBuffer, 0, createParamsArray(sphParticleState.particleCount));

  const module = device.createShaderModule({ label: 'ulg-sph-render-rows', code: sphRenderRowsWgsl });
  const { pipeline, bindGroupLayout } = createExplicitComputePipeline(device, {
    label: 'ulg-sph-render-rows',
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
      { binding: 0, resource: { buffer: stateBuffer } },
      { binding: 1, resource: { buffer: thermoBuffer } },
      { binding: 2, resource: { buffer: renderRowsBuffer } },
      { binding: 3, resource: { buffer: paramsBuffer } }
    ]
  });
  const encoder = device.createCommandEncoder();
  const pass = encoder.beginComputePass();
  pass.setPipeline(pipeline);
  pass.setBindGroup(0, bindGroup);
  pass.dispatchWorkgroups(Math.ceil(sphParticleState.particleCount / 64));
  pass.end();
  device.queue.submit([encoder.finish()]);
  const bytes = await readBuffer(device, renderRowsBuffer, sphParticleState.particleCount * SPH_GPU_RENDER_ROW_FLOATS * Float32Array.BYTES_PER_ELEMENT);
  const renderRows = new Float32Array(bytes);

  if (!borrowedStateBuffer) stateBuffer.destroy?.();
  if (!borrowedThermoBuffer) thermoBuffer.destroy?.();
  renderRowsBuffer.destroy?.();
  paramsBuffer.destroy?.();

  return {
    schema: ULG_SPH_GPU_RENDER_ROWS_SCHEMA,
    backend: 'webgpu',
    status: 'render-rows-extracted',
    kernelScope: RENDER_SCOPE,
    particleCount: sphParticleState.particleCount,
    rowLayout: [...SPH_GPU_RENDER_ROW_LAYOUT],
    rowStrideFloats: SPH_GPU_RENDER_ROW_FLOATS,
    renderRows,
    renderRowByteLength: renderRows.byteLength,
    compactRenderReadback: true,
    scientificValidation: false,
    sphValidation: false,
    phaseChangeValidation: false,
    fullPhysicsValidation: false
  };
}

export async function extractSphRenderRowsWithOptionalWebGpu({
  preferWebGpu = false,
  navigatorRef = globalThis.navigator,
  device = null,
  deviceResult = null,
  webGpuRunner = extractSphRenderRowsWebGpu,
  ...args
} = {}) {
  const cpuReference = extractSphRenderRowsCpu(args);
  if (!preferWebGpu) {
    return {
      schema: ULG_SPH_GPU_RENDER_ROWS_EXECUTION_SCHEMA,
      backend: 'cpu-reference',
      status: 'cpu-reference',
      cpuReference,
      result: cpuReference,
      webgpuStatus: { status: 'not-requested' },
      compactRenderReadback: false,
      scientificValidation: false,
      sphValidation: false,
      phaseChangeValidation: false,
      fullPhysicsValidation: false
    };
  }
  const resolvedDeviceResult = device
    ? { status: 'webgpu-device-ready', device, reason: 'provided device' }
    : (deviceResult || await requestOpticalGpuDevice(navigatorRef));
  if (!resolvedDeviceResult?.device) {
    return {
      schema: ULG_SPH_GPU_RENDER_ROWS_EXECUTION_SCHEMA,
      backend: 'cpu-reference',
      status: 'webgpu-unavailable-cpu-reference',
      cpuReference,
      result: cpuReference,
      webgpuStatus: { status: 'fallback-cpu', reason: resolvedDeviceResult?.reason || 'webgpu device unavailable' },
      compactRenderReadback: false,
      scientificValidation: false,
      sphValidation: false,
      phaseChangeValidation: false,
      fullPhysicsValidation: false
    };
  }
  try {
    const webgpu = await webGpuRunner({ ...args, device: resolvedDeviceResult.device });
    return {
      schema: ULG_SPH_GPU_RENDER_ROWS_EXECUTION_SCHEMA,
      backend: 'webgpu',
      status: 'webgpu-accepted',
      cpuReference,
      webgpu,
      result: webgpu,
      webgpuStatus: { status: 'webgpu-executed' },
      compactRenderReadback: true,
      scientificValidation: false,
      sphValidation: false,
      phaseChangeValidation: false,
      fullPhysicsValidation: false
    };
  } catch (error) {
    return {
      schema: ULG_SPH_GPU_RENDER_ROWS_EXECUTION_SCHEMA,
      backend: 'cpu-reference',
      status: 'webgpu-error-cpu-reference',
      cpuReference,
      result: cpuReference,
      webgpuStatus: { status: 'fallback-cpu', reason: error instanceof Error ? error.message : String(error) },
      compactRenderReadback: false,
      scientificValidation: false,
      sphValidation: false,
      phaseChangeValidation: false,
      fullPhysicsValidation: false
    };
  }
}
