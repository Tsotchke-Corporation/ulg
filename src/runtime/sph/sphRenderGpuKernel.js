import {
  SPH_GPU_RENDER_FIELD_CELL_ROW_LAYOUT,
  SPH_GPU_RENDER_ROW_LAYOUT,
  SPH_GPU_RENDER_SURFACE_ROW_LAYOUT,
  ULG_SPH_GPU_PARTICLE_BUFFER_SCHEMA,
  ULG_SPH_GPU_RENDER_FIELD_EXECUTION_SCHEMA,
  ULG_SPH_GPU_RENDER_FIELD_SCHEMA,
  ULG_SPH_GPU_RENDER_ROWS_EXECUTION_SCHEMA,
  ULG_SPH_GPU_RENDER_ROWS_SCHEMA
} from '../../../ulg-gpu-abi/src/index.js';
import { sphRenderFieldWgsl, sphRenderRowsWgsl } from '../../../ulg-gpu-abi/src/wgsl.js';
import { GPU_PHASE_IDS, gpuPhaseId, requestOpticalGpuDevice, stableOpticalMaterialId } from '../material/opticalGpuBuffers.js';
import { opticalRenderParams } from '../material/opticalClosure.js';
import { incandescentColor } from '../material/radiationClosure.js';
import { computeBufferBinding, createExplicitComputePipeline } from '../webgpuComputeLayout.js';
import {
  SPH_GPU_PARTICLE_STATE_FLOATS,
  SPH_GPU_PARTICLE_THERMO_FLOATS
} from './sphGpuBuffers.js';

export {
  ULG_SPH_GPU_RENDER_FIELD_EXECUTION_SCHEMA,
  ULG_SPH_GPU_RENDER_FIELD_SCHEMA,
  ULG_SPH_GPU_RENDER_ROWS_EXECUTION_SCHEMA,
  ULG_SPH_GPU_RENDER_ROWS_SCHEMA,
  sphRenderFieldWgsl,
  sphRenderRowsWgsl
};

export const SPH_GPU_RENDER_ROW_FLOATS = SPH_GPU_RENDER_ROW_LAYOUT.length;
export const SPH_GPU_RENDER_SURFACE_ROW_FLOATS = SPH_GPU_RENDER_SURFACE_ROW_LAYOUT.length;
export const SPH_GPU_RENDER_FIELD_CELL_FLOATS = SPH_GPU_RENDER_FIELD_CELL_ROW_LAYOUT.length;

const RENDER_SCOPE = 'sph-resident-render-row-extraction';
const RENDER_FIELD_SCOPE = 'sph-resident-render-field-splat';
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

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
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

function createRenderFieldParamsArray({
  particleCount,
  surfaceCount,
  totalFieldCells,
  fieldPadding,
  refEdgeM
}) {
  const buffer = new ArrayBuffer(32);
  const view = new DataView(buffer);
  view.setUint32(0, particleCount, true);
  view.setUint32(4, surfaceCount, true);
  view.setUint32(8, totalFieldCells, true);
  view.setUint32(12, 0, true);
  view.setFloat32(16, fieldPadding, true);
  view.setFloat32(20, refEdgeM, true);
  view.setFloat32(24, 0, true);
  view.setFloat32(28, 0, true);
  return buffer;
}

async function readBuffer(device, sourceBuffer, byteLength, label = 'ulg-sph-render-readback') {
  const readback = device.createBuffer({
    label,
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

export function buildSphRenderFieldSurfaceTable(surfaceDescriptors = [], {
  defaultResolution = 32,
  defaultIsolation = 80,
  defaultSubtract = 24
} = {}) {
  if (!Array.isArray(surfaceDescriptors)) {
    throw new TypeError('surfaceDescriptors must be an array');
  }
  const records = new Float32Array(surfaceDescriptors.length * SPH_GPU_RENDER_SURFACE_ROW_FLOATS);
  const metadata = [];
  let fieldOffset = 0;
  let maxFieldCellCount = 0;
  surfaceDescriptors.forEach((descriptor, index) => {
    const resolution = Math.max(4, Math.round(finiteNumber(descriptor.resolution, defaultResolution)));
    const fieldCellCount = resolution ** 3;
    const isolation = finiteNumber(descriptor.isolation, defaultIsolation);
    const subtract = Math.max(1e-12, finiteNumber(descriptor.subtract, defaultSubtract));
    const radiusNorm = clamp(finiteNumber(descriptor.radiusNorm, 0.05), 0.001, 0.5);
    const strength = Number.isFinite(descriptor.strength)
      ? descriptor.strength
      : (isolation + subtract) * radiusNorm * radiusNorm;
    const color = Array.isArray(descriptor.colorLinear) || ArrayBuffer.isView(descriptor.colorLinear)
      ? descriptor.colorLinear
      : [1, 1, 1];
    const materialId = finiteNumber(
      descriptor.materialId ?? (descriptor.material ? stableOpticalMaterialId(descriptor.material) : 0),
      0
    );
    const phaseId = finiteNumber(
      descriptor.phaseId ?? (descriptor.phase ? gpuPhaseId(descriptor.phase) : GPU_PHASE_IDS.unknown),
      GPU_PHASE_IDS.unknown
    );
    const offset = index * SPH_GPU_RENDER_SURFACE_ROW_FLOATS;
    records.set([
      materialId,
      phaseId,
      fieldOffset,
      fieldCellCount,
      resolution,
      isolation,
      subtract,
      strength,
      radiusNorm,
      clamp(finiteNumber(color[0], 1), 0, 1),
      clamp(finiteNumber(color[1], 1), 0, 1),
      clamp(finiteNumber(color[2], 1), 0, 1),
      finiteNumber(descriptor.status, 1),
      0,
      0,
      0
    ], offset);
    const row = {
      index,
      surfaceKey: descriptor.surfaceKey ?? `${materialId}|${phaseId}`,
      material: descriptor.material ?? null,
      phase: descriptor.phase ?? null,
      renderKey: descriptor.renderKey ?? descriptor.material ?? null,
      materialId,
      phaseId,
      fieldOffset,
      fieldCellCount,
      resolution,
      isolation,
      subtract,
      strength,
      radiusNorm,
      colorLinear: [
        clamp(finiteNumber(color[0], 1), 0, 1),
        clamp(finiteNumber(color[1], 1), 0, 1),
        clamp(finiteNumber(color[2], 1), 0, 1)
      ],
      status: finiteNumber(descriptor.status, 1)
    };
    metadata.push(row);
    fieldOffset += fieldCellCount;
    maxFieldCellCount = Math.max(maxFieldCellCount, fieldCellCount);
  });
  return {
    schema: ULG_SPH_GPU_RENDER_FIELD_SCHEMA,
    status: 'render-field-surface-table-built',
    surfaceCount: surfaceDescriptors.length,
    rowLayout: [...SPH_GPU_RENDER_SURFACE_ROW_LAYOUT],
    rowStrideFloats: SPH_GPU_RENDER_SURFACE_ROW_FLOATS,
    records,
    metadata,
    totalFieldCells: fieldOffset,
    maxFieldCellCount,
    scientificValidation: false,
    sphValidation: false,
    phaseChangeValidation: false,
    fullPhysicsValidation: false
  };
}

function assertRenderFieldSurfaceTable(surfaceTable) {
  if (surfaceTable?.schema !== ULG_SPH_GPU_RENDER_FIELD_SCHEMA || !(surfaceTable.records instanceof Float32Array)) {
    throw new TypeError('SPH render field requires a render-field surface table');
  }
}

function normalizedPositionFromRenderRow(renderRows, offset, fieldPadding, refEdgeM) {
  const span = 1 - 2 * fieldPadding;
  const refEdge = Math.max(refEdgeM, 1e-12);
  return [
    clamp(fieldPadding + (renderRows[offset] / refEdge) * span, 0.001, 0.999),
    clamp(fieldPadding + (renderRows[offset + 1] / refEdge) * span, 0.001, 0.999),
    clamp(fieldPadding + (renderRows[offset + 2] / refEdge) * span, 0.001, 0.999)
  ];
}

export function buildSphRenderFieldCpu({
  renderRows,
  surfaceTable,
  particleCount = null,
  fieldPadding = 0.22,
  refEdgeM = 10
} = {}) {
  if (!(renderRows instanceof Float32Array)) {
    throw new TypeError('buildSphRenderFieldCpu requires Float32Array render rows');
  }
  if (renderRows.length % SPH_GPU_RENDER_ROW_FLOATS !== 0) {
    throw new RangeError('SPH render rows length must align to the render row stride');
  }
  assertRenderFieldSurfaceTable(surfaceTable);
  const resolvedParticleCount = particleCount ?? (renderRows.length / SPH_GPU_RENDER_ROW_FLOATS);
  const fieldRows = new Float32Array(surfaceTable.totalFieldCells * SPH_GPU_RENDER_FIELD_CELL_FLOATS);
  for (const surface of surfaceTable.metadata) {
    const resolution = surface.resolution;
    const supportNorm = Math.sqrt(Math.abs(surface.strength) / Math.max(surface.subtract, 1e-12));
    for (let cellIndex = 0; cellIndex < surface.fieldCellCount; cellIndex += 1) {
      const xy = resolution * resolution;
      const z = Math.floor(cellIndex / xy);
      const rem = cellIndex - z * xy;
      const y = Math.floor(rem / resolution);
      const x = rem - y * resolution;
      const cell = [x / resolution, y / resolution, z / resolution];
      let density = 0;
      let r = 0;
      let g = 0;
      let b = 0;
      for (let particleIndex = 0; particleIndex < resolvedParticleCount; particleIndex += 1) {
        const renderOffset = particleIndex * SPH_GPU_RENDER_ROW_FLOATS;
        const materialId = renderRows[renderOffset + 4];
        const phaseId = renderRows[renderOffset + 5];
        if (materialId !== surface.materialId || phaseId !== surface.phaseId) continue;
        const particle = normalizedPositionFromRenderRow(renderRows, renderOffset, fieldPadding, refEdgeM);
        const dx = cell[0] - particle[0];
        const dy = cell[1] - particle[1];
        const dz = cell[2] - particle[2];
        const dist2 = dx * dx + dy * dy + dz * dz;
        const value = surface.strength / (0.000001 + dist2) - surface.subtract;
        if (value <= 0) continue;
        density += value;
        const ratio = Math.sqrt(dist2) / Math.max(supportNorm, 1e-6);
        const t = clamp(ratio, 0, 1);
        const weight = 1 - t ** 3 * (t * (t * 6 - 15) + 10);
        r += surface.colorLinear[0] * weight;
        g += surface.colorLinear[1] * weight;
        b += surface.colorLinear[2] * weight;
      }
      const fieldOffset = (surface.fieldOffset + cellIndex) * SPH_GPU_RENDER_FIELD_CELL_FLOATS;
      fieldRows[fieldOffset] = density;
      fieldRows[fieldOffset + 1] = r;
      fieldRows[fieldOffset + 2] = g;
      fieldRows[fieldOffset + 3] = b;
    }
  }
  return {
    schema: ULG_SPH_GPU_RENDER_FIELD_SCHEMA,
    backend: 'cpu-reference',
    status: 'render-field-built',
    kernelScope: RENDER_FIELD_SCOPE,
    particleCount: resolvedParticleCount,
    surfaceCount: surfaceTable.surfaceCount,
    totalFieldCells: surfaceTable.totalFieldCells,
    maxFieldCellCount: surfaceTable.maxFieldCellCount,
    surfaceTable,
    rowLayout: [...SPH_GPU_RENDER_FIELD_CELL_ROW_LAYOUT],
    rowStrideFloats: SPH_GPU_RENDER_FIELD_CELL_FLOATS,
    fieldRows,
    fieldRowByteLength: fieldRows.byteLength,
    fieldPadding,
    refEdgeM,
    scientificValidation: false,
    sphValidation: false,
    phaseChangeValidation: false,
    fullPhysicsValidation: false
  };
}

export function splitSphRenderFieldBySurface(renderField) {
  if (renderField?.schema !== ULG_SPH_GPU_RENDER_FIELD_SCHEMA || !(renderField.fieldRows instanceof Float32Array)) {
    throw new TypeError('splitSphRenderFieldBySurface requires an SPH render field');
  }
  return renderField.surfaceTable.metadata.map((surface) => {
    const field = new Float32Array(surface.fieldCellCount);
    const palette = new Float32Array(surface.fieldCellCount * 3);
    for (let cellIndex = 0; cellIndex < surface.fieldCellCount; cellIndex += 1) {
      const fieldOffset = (surface.fieldOffset + cellIndex) * SPH_GPU_RENDER_FIELD_CELL_FLOATS;
      field[cellIndex] = renderField.fieldRows[fieldOffset];
      palette[cellIndex * 3] = renderField.fieldRows[fieldOffset + 1];
      palette[cellIndex * 3 + 1] = renderField.fieldRows[fieldOffset + 2];
      palette[cellIndex * 3 + 2] = renderField.fieldRows[fieldOffset + 3];
    }
    return {
      ...surface,
      field,
      palette
    };
  });
}

export async function buildSphRenderFieldWebGpu({
  device,
  renderRows,
  renderRowsBuffer = null,
  surfaceTable,
  particleCount = null,
  fieldPadding = 0.22,
  refEdgeM = 10
} = {}) {
  if (!device?.createBuffer || !device.queue?.writeBuffer) {
    throw new TypeError('buildSphRenderFieldWebGpu requires a WebGPU-like device');
  }
  if (!renderRowsBuffer && !(renderRows instanceof Float32Array)) {
    throw new TypeError('buildSphRenderFieldWebGpu requires renderRows or renderRowsBuffer');
  }
  if (renderRows && renderRows.length % SPH_GPU_RENDER_ROW_FLOATS !== 0) {
    throw new RangeError('SPH render rows length must align to the render row stride');
  }
  assertRenderFieldSurfaceTable(surfaceTable);
  const resolvedParticleCount = particleCount ?? (renderRows?.length ? renderRows.length / SPH_GPU_RENDER_ROW_FLOATS : 0);
  const borrowedRenderRowsBuffer = renderRowsBuffer || null;
  const sourceRowsBuffer = borrowedRenderRowsBuffer || writeStorageBuffer(
    device,
    'ulg-sph-render-field-source-rows',
    renderRows,
    GPU_BUFFER_USAGE.COPY_SRC
  );
  const surfaceBuffer = writeStorageBuffer(
    device,
    'ulg-sph-render-field-surfaces',
    surfaceTable.records
  );
  const fieldRowsBuffer = writeStorageBuffer(
    device,
    'ulg-sph-render-field-cells',
    new Float32Array(surfaceTable.totalFieldCells * SPH_GPU_RENDER_FIELD_CELL_FLOATS),
    GPU_BUFFER_USAGE.COPY_SRC
  );
  const paramsBuffer = device.createBuffer({
    label: 'ulg-sph-render-field-params',
    size: 32,
    usage: GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST
  });
  device.queue.writeBuffer(paramsBuffer, 0, createRenderFieldParamsArray({
    particleCount: resolvedParticleCount,
    surfaceCount: surfaceTable.surfaceCount,
    totalFieldCells: surfaceTable.totalFieldCells,
    fieldPadding,
    refEdgeM
  }));

  const module = device.createShaderModule({ label: 'ulg-sph-render-field', code: sphRenderFieldWgsl });
  const { pipeline, bindGroupLayout } = createExplicitComputePipeline(device, {
    label: 'ulg-sph-render-field',
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
      { binding: 0, resource: { buffer: sourceRowsBuffer } },
      { binding: 1, resource: { buffer: surfaceBuffer } },
      { binding: 2, resource: { buffer: fieldRowsBuffer } },
      { binding: 3, resource: { buffer: paramsBuffer } }
    ]
  });
  const encoder = device.createCommandEncoder();
  const pass = encoder.beginComputePass();
  pass.setPipeline(pipeline);
  pass.setBindGroup(0, bindGroup);
  pass.dispatchWorkgroups(Math.ceil(Math.max(1, surfaceTable.maxFieldCellCount) / 64), Math.max(1, surfaceTable.surfaceCount));
  pass.end();
  device.queue.submit([encoder.finish()]);
  const fieldBytes = await readBuffer(
    device,
    fieldRowsBuffer,
    surfaceTable.totalFieldCells * SPH_GPU_RENDER_FIELD_CELL_FLOATS * Float32Array.BYTES_PER_ELEMENT,
    'ulg-sph-render-field-readback'
  );
  const fieldRows = new Float32Array(fieldBytes);

  if (!borrowedRenderRowsBuffer) sourceRowsBuffer.destroy?.();
  surfaceBuffer.destroy?.();
  fieldRowsBuffer.destroy?.();
  paramsBuffer.destroy?.();

  return {
    schema: ULG_SPH_GPU_RENDER_FIELD_SCHEMA,
    backend: 'webgpu',
    status: 'render-field-built',
    kernelScope: RENDER_FIELD_SCOPE,
    particleCount: resolvedParticleCount,
    surfaceCount: surfaceTable.surfaceCount,
    totalFieldCells: surfaceTable.totalFieldCells,
    maxFieldCellCount: surfaceTable.maxFieldCellCount,
    surfaceTable,
    rowLayout: [...SPH_GPU_RENDER_FIELD_CELL_ROW_LAYOUT],
    rowStrideFloats: SPH_GPU_RENDER_FIELD_CELL_FLOATS,
    fieldRows,
    fieldRowByteLength: fieldRows.byteLength,
    fieldPadding,
    refEdgeM,
    renderFieldReadback: true,
    scientificValidation: false,
    sphValidation: false,
    phaseChangeValidation: false,
    fullPhysicsValidation: false
  };
}

export async function buildSphRenderFieldWithOptionalWebGpu({
  preferWebGpu = false,
  navigatorRef = globalThis.navigator,
  device = null,
  deviceResult = null,
  webGpuRunner = buildSphRenderFieldWebGpu,
  ...args
} = {}) {
  const cpuReference = buildSphRenderFieldCpu(args);
  if (!preferWebGpu) {
    return {
      schema: ULG_SPH_GPU_RENDER_FIELD_EXECUTION_SCHEMA,
      backend: 'cpu-reference',
      status: 'cpu-reference',
      cpuReference,
      result: cpuReference,
      webgpuStatus: { status: 'not-requested' },
      renderFieldReadback: false,
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
      schema: ULG_SPH_GPU_RENDER_FIELD_EXECUTION_SCHEMA,
      backend: 'cpu-reference',
      status: 'webgpu-unavailable-cpu-reference',
      cpuReference,
      result: cpuReference,
      webgpuStatus: { status: 'fallback-cpu', reason: resolvedDeviceResult?.reason || 'webgpu device unavailable' },
      renderFieldReadback: false,
      scientificValidation: false,
      sphValidation: false,
      phaseChangeValidation: false,
      fullPhysicsValidation: false
    };
  }
  try {
    const webgpu = await webGpuRunner({ ...args, device: resolvedDeviceResult.device });
    return {
      schema: ULG_SPH_GPU_RENDER_FIELD_EXECUTION_SCHEMA,
      backend: 'webgpu',
      status: 'webgpu-accepted',
      cpuReference,
      webgpu,
      result: webgpu,
      webgpuStatus: { status: 'webgpu-executed' },
      renderFieldReadback: true,
      scientificValidation: false,
      sphValidation: false,
      phaseChangeValidation: false,
      fullPhysicsValidation: false
    };
  } catch (error) {
    return {
      schema: ULG_SPH_GPU_RENDER_FIELD_EXECUTION_SCHEMA,
      backend: 'cpu-reference',
      status: 'webgpu-error-cpu-reference',
      cpuReference,
      result: cpuReference,
      webgpuStatus: { status: 'fallback-cpu', reason: error instanceof Error ? error.message : String(error) },
      renderFieldReadback: false,
      scientificValidation: false,
      sphValidation: false,
      phaseChangeValidation: false,
      fullPhysicsValidation: false
    };
  }
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
