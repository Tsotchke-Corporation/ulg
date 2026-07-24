import {
  SPH_GPU_REACTION_PRODUCT_EVENT_ROW_LAYOUT,
  SPH_GPU_RENDER_FIELD_CELL_ROW_LAYOUT,
  SPH_GPU_RENDER_ROW_LAYOUT,
  SPH_GPU_RENDER_SURFACE_ROW_LAYOUT,
  ULG_SPH_GPU_RENDER_FIELD_SCHEMA,
  ULG_SPH_MATERIAL_INTERFACE_SOURCE_FIELD_SCHEMA
} from '../../../ulg-gpu-abi/src/index.js';
import {
  computeBufferBinding,
  createCachedExplicitComputePipeline,
  deferSubmittedWorkCleanup
} from '../webgpuComputeLayout.js';
import {
  acquireSchroederSpatialSuccessorSourceFamilyLease,
  releaseSchroederSpatialSuccessorSourceFamilyLease,
  resolveSchroederSpatialSuccessorSourceFamily
} from './schroederSpatialSuccessorSourceFamily.js';
import {
  createSphRenderSurfaceTableLineageSnapshot,
  registerSphSuccessorDerivedFieldBufferPublication,
  releaseSphSuccessorDerivedFieldBufferPublication,
  reserveSphSuccessorDerivedFieldBufferPublication,
  validateSphRenderSurfaceTableLineageSnapshot,
  validateSphSuccessorDerivedFieldBufferPublication,
  validateSphRenderRowsSuccessorSourceLineage
} from './sphRenderGpuKernel.js';

export const SPH_MATERIAL_INTERFACE_SOURCE_LOCAL_SCHEMA =
  'peercompute.ulg.sph-material-interface-source-local-field.v0';

const SPH_GPU_RENDER_ROW_FLOATS = SPH_GPU_RENDER_ROW_LAYOUT.length;
const SPH_GPU_RENDER_SURFACE_ROW_FLOATS = SPH_GPU_RENDER_SURFACE_ROW_LAYOUT.length;
const SPH_GPU_RENDER_FIELD_CELL_FLOATS = SPH_GPU_RENDER_FIELD_CELL_ROW_LAYOUT.length;
const SPH_GPU_REACTION_PRODUCT_EVENT_FLOATS = SPH_GPU_REACTION_PRODUCT_EVENT_ROW_LAYOUT.length;
const FULL_READBACK_MODE = 'full-parity-readback';
const NO_FULL_READBACK_MODE = 'no-full-readback';
const SOURCE_LOCAL_KERNEL_SCOPE = 'sph-resident-material-interface-source-local-splat';
const SOURCE_LOCAL_DENSITY_SCALE = 1024;
const schroederSourceFieldLineageRecords = new WeakMap();

export function validateSphMaterialInterfaceSourceFieldSuccessorLineage(
  sourceField,
  {
    device,
    sourceFamily,
    particleCount,
    fieldRowsBuffer = null,
    fieldRows = null,
    surfaceBuffer = null,
    surfaceTable = null
  } = {}
) {
  const record = schroederSourceFieldLineageRecords.get(sourceField);
  return Boolean(
    record
    && record.active === true
    && record.device === device
    && record.sourceFamily === sourceFamily
    && record.particleCount === particleCount
    && sourceField?.schroederSpatialSourceFamily === record.sourceFamily
    && sourceField?.particleCount === record.particleCount
    && (sourceField?.fieldRowsBuffer ?? null) === record.fieldRowsBuffer
    && sourceField?.fieldRows === record.fieldRows
    && (sourceField?.surfaceBuffer ?? null) === record.surfaceBuffer
    && sourceField?.surfaceTable === record.surfaceTable
    && sourceField?.rowStrideFloats === record.rowStrideFloats
    && sourceField?.fieldRowByteLength === record.fieldRowByteLength
    && sourceField?.fieldRowsBufferByteLength
      === record.fieldRowsBufferByteLength
    && sourceField?.fieldPadding === record.fieldPadding
    && sourceField?.refEdgeM === record.refEdgeM
    && sourceField?.productEventCount === 0
    && sourceField?.productEventBufferBound === false
    && validateSphRenderSurfaceTableLineageSnapshot(
      sourceField?.surfaceTable,
      record.surfaceTableSnapshot
    )
    && (fieldRowsBuffer == null || record.fieldRowsBuffer === fieldRowsBuffer)
    && (fieldRows == null || record.fieldRows === fieldRows)
    && (surfaceBuffer == null || record.surfaceBuffer === surfaceBuffer)
    && (surfaceTable == null || record.surfaceTable === surfaceTable)
    && (
      record.fieldRowsBuffer == null
      || validateSphSuccessorDerivedFieldBufferPublication(
        record.fieldRowsBuffer,
        sourceField
      )
    )
  );
}

function invalidateSphMaterialInterfaceSourceFieldSuccessorLineage(sourceField) {
  const record = schroederSourceFieldLineageRecords.get(sourceField);
  if (!record || record.active !== true) return;
  record.active = false;
  if (
    record.fieldRowsBuffer
  ) {
    releaseSphSuccessorDerivedFieldBufferPublication(
      record.fieldRowsBuffer,
      sourceField
    );
  }
}

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

const sphMaterialInterfaceSourceLocalSplatWgsl = `
struct SourceFieldParams {
  particle_count: u32,
  surface_count: u32,
  total_field_cells: u32,
  product_event_count: u32,
  field_padding: f32,
  ref_edge_m: f32,
  density_scale: f32,
  source_count: u32,
};

@group(0) @binding(0) var<storage, read> render_rows: array<vec4<f32>>;
@group(0) @binding(1) var<storage, read> render_surfaces: array<vec4<f32>>;
@group(0) @binding(2) var<storage, read_write> density_accum: array<atomic<u32>>;
@group(0) @binding(3) var<uniform> params: SourceFieldParams;
@group(0) @binding(4) var<storage, read> product_events: array<vec4<f32>>;
@group(0) @binding(5) var<storage, read_write> source_index_accum: array<atomic<u32>>;

const RENDER_ROW_VEC4_STRIDE: u32 = 5u;
const PRODUCT_EVENT_VEC4_STRIDE: u32 = 8u;

fn render_row0(particle_index: u32) -> vec4<f32> {
  return render_rows[particle_index * RENDER_ROW_VEC4_STRIDE];
}

fn render_row1(particle_index: u32) -> vec4<f32> {
  return render_rows[particle_index * RENDER_ROW_VEC4_STRIDE + 1u];
}

fn render_row2(particle_index: u32) -> vec4<f32> {
  return render_rows[particle_index * RENDER_ROW_VEC4_STRIDE + 2u];
}

fn surface_row0(surface_index: u32) -> vec4<f32> {
  return render_surfaces[surface_index * 4u];
}

fn surface_row1(surface_index: u32) -> vec4<f32> {
  return render_surfaces[surface_index * 4u + 1u];
}

fn product_event_row0(event_index: u32) -> vec4<f32> {
  return product_events[event_index * PRODUCT_EVENT_VEC4_STRIDE];
}

fn product_event_row1(event_index: u32) -> vec4<f32> {
  return product_events[event_index * PRODUCT_EVENT_VEC4_STRIDE + 1u];
}

fn product_event_row2(event_index: u32) -> vec4<f32> {
  return product_events[event_index * PRODUCT_EVENT_VEC4_STRIDE + 2u];
}

fn product_event_row3(event_index: u32) -> vec4<f32> {
  return product_events[event_index * PRODUCT_EVENT_VEC4_STRIDE + 3u];
}

fn product_event_row4(event_index: u32) -> vec4<f32> {
  return product_events[event_index * PRODUCT_EVENT_VEC4_STRIDE + 4u];
}

fn normalized_position(position_m: vec3<f32>) -> vec3<f32> {
  let span = 1.0 - 2.0 * params.field_padding;
  let ref_edge = max(params.ref_edge_m, 1.0e-12);
  return vec3<f32>(
    clamp(params.field_padding + (position_m.x / ref_edge) * span, 0.001, 0.999),
    clamp(params.field_padding + (position_m.y / ref_edge) * span, 0.001, 0.999),
    clamp(params.field_padding + (position_m.z / ref_edge) * span, 0.001, 0.999)
  );
}

fn source_matches_domain(source_domain_id: f32, surface_domain_id: f32) -> bool {
  let surface_domain = max(surface_domain_id, 0.0);
  return surface_domain <= 0.0 || source_domain_id == surface_domain;
}

fn quantized_density(value: f32) -> u32 {
  return u32(clamp(value * params.density_scale, 0.0, 4294967040.0));
}

fn field_index_3d(x: u32, y: u32, z: u32, resolution: u32) -> u32 {
  return z * resolution * resolution + y * resolution + x;
}

fn splat_source(
  position: vec3<f32>,
  surface_index: u32,
  surface0: vec4<f32>,
  surface1: vec4<f32>,
  source_key: u32
) {
  let field_offset = u32(surface0.z);
  let field_cell_count = u32(surface0.w);
  let resolution = max(u32(surface1.x), 1u);
  let subtract = max(surface1.z, 1.0e-12);
  let strength = surface1.w;
  let support_norm = sqrt(abs(strength) / subtract);
  let radius_cells = min(i32(resolution) - 1, i32(ceil(support_norm * f32(resolution))) + 1);
  let center = vec3<i32>(
    i32(clamp(floor(position.x * f32(resolution)), 0.0, f32(resolution - 1u))),
    i32(clamp(floor(position.y * f32(resolution)), 0.0, f32(resolution - 1u))),
    i32(clamp(floor(position.z * f32(resolution)), 0.0, f32(resolution - 1u)))
  );

  for (var dz = -radius_cells; dz <= radius_cells; dz = dz + 1) {
    let z_i = center.z + dz;
    if (z_i < 0 || z_i >= i32(resolution)) {
      continue;
    }
    for (var dy = -radius_cells; dy <= radius_cells; dy = dy + 1) {
      let y_i = center.y + dy;
      if (y_i < 0 || y_i >= i32(resolution)) {
        continue;
      }
      for (var dx = -radius_cells; dx <= radius_cells; dx = dx + 1) {
        let x_i = center.x + dx;
        if (x_i < 0 || x_i >= i32(resolution)) {
          continue;
        }
        let cell = vec3<f32>(
          f32(x_i) / f32(resolution),
          f32(y_i) / f32(resolution),
          f32(z_i) / f32(resolution)
        );
        let delta = cell - position;
        let dist2 = dot(delta, delta);
        let value = strength / (0.000001 + dist2) - subtract;
        if (value <= 0.0) {
          continue;
        }
        let local_cell = field_index_3d(u32(x_i), u32(y_i), u32(z_i), resolution);
        if (local_cell >= field_cell_count) {
          continue;
        }
        let out_index = field_offset + local_cell;
        if (out_index < params.total_field_cells) {
          atomicAdd(&density_accum[out_index], quantized_density(value));
          if (source_key > 0u) {
            let _source_claim = atomicCompareExchangeWeak(&source_index_accum[out_index], 0u, source_key);
          }
        }
      }
    }
  }
}

@compute @workgroup_size(64, 1, 1)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let source_index = global_id.x;
  let surface_index = global_id.y;
  if (source_index >= params.source_count || surface_index >= params.surface_count) {
    return;
  }

  let s0 = surface_row0(surface_index);
  let s1 = surface_row1(surface_index);
  let material_id = s0.x;
  let phase_id = s0.y;
  let render_domain_id = max(render_surfaces[surface_index * 4u + 3u].x, 0.0);

  if (source_index < params.particle_count) {
    let row0 = render_row0(source_index);
    let row1 = render_row1(source_index);
    let row2 = render_row2(source_index);
    if (row1.x != material_id || row1.y != phase_id || !source_matches_domain(row2.w, render_domain_id)) {
      return;
    }
    splat_source(normalized_position(row0.xyz), surface_index, s0, s1, source_index + 1u);
    return;
  }

  let event_index = source_index - params.particle_count;
  if (event_index >= params.product_event_count) {
    return;
  }
  let event0 = product_event_row0(event_index);
  let event1 = product_event_row1(event_index);
  let event2 = product_event_row2(event_index);
  let event3 = product_event_row3(event_index);
  let event4 = product_event_row4(event_index);
  let event_material_id = event1.x;
  let event_phase_id = event2.w;
  let event_unplaced_mass_kg = event3.y;
  let event_status = event4.z;
  if (
    event_status != 1.0
    || event_unplaced_mass_kg <= 0.0
    || event_material_id != material_id
    || (event_phase_id > 0.0 && event_phase_id != phase_id)
  ) {
    return;
  }
  splat_source(normalized_position(event0.xyz), surface_index, s0, s1, 0u);
}
`;

const sphMaterialInterfaceSourceLocalResolveWgsl = `
struct SourceFieldParams {
  particle_count: u32,
  surface_count: u32,
  total_field_cells: u32,
  product_event_count: u32,
  field_padding: f32,
  ref_edge_m: f32,
  density_scale: f32,
  source_count: u32,
};

@group(0) @binding(0) var<storage, read> render_surfaces: array<vec4<f32>>;
@group(0) @binding(1) var<storage, read_write> density_accum: array<atomic<u32>>;
@group(0) @binding(2) var<storage, read_write> render_field_cells: array<vec4<f32>>;
@group(0) @binding(3) var<uniform> params: SourceFieldParams;

fn surface_row0(surface_index: u32) -> vec4<f32> {
  return render_surfaces[surface_index * 4u];
}

fn surface_row1(surface_index: u32) -> vec4<f32> {
  return render_surfaces[surface_index * 4u + 1u];
}

fn surface_row2(surface_index: u32) -> vec4<f32> {
  return render_surfaces[surface_index * 4u + 2u];
}

@compute @workgroup_size(64, 1, 1)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let cell_index = global_id.x;
  let surface_index = global_id.y;
  if (surface_index >= params.surface_count) {
    return;
  }
  let s0 = surface_row0(surface_index);
  let s1 = surface_row1(surface_index);
  let s2 = surface_row2(surface_index);
  let field_offset = u32(s0.z);
  let field_cell_count = u32(s0.w);
  if (cell_index >= field_cell_count) {
    return;
  }
  let out_index = field_offset + cell_index;
  if (out_index >= params.total_field_cells) {
    return;
  }
  let density = f32(atomicLoad(&density_accum[out_index])) / max(params.density_scale, 1.0);
  let color = select(vec3<f32>(0.0, 0.0, 0.0), vec3<f32>(s2.y, s2.z, s2.w), density > 0.0);
  // Two vec4 lanes per cell (see SPH_GPU_RENDER_FIELD_CELL_ROW_LAYOUT); the
  // physics material-interface source field carries no temperature.
  render_field_cells[out_index * 2u] = vec4<f32>(density, color);
  render_field_cells[out_index * 2u + 1u] = vec4<f32>(0.0, 0.0, 0.0, 0.0);
}
`;

function finiteNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function assertRenderFieldSurfaceTable(surfaceTable) {
  if (surfaceTable?.schema !== ULG_SPH_GPU_RENDER_FIELD_SCHEMA || !(surfaceTable.records instanceof Float32Array)) {
    throw new TypeError('source-local material-interface field requires a render-field surface table');
  }
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

function createSourceFieldParamsArray({
  particleCount,
  productEventCount,
  surfaceCount,
  totalFieldCells,
  fieldPadding,
  refEdgeM,
  densityScale,
  sourceCount
}) {
  const buffer = new ArrayBuffer(32);
  const view = new DataView(buffer);
  view.setUint32(0, particleCount, true);
  view.setUint32(4, surfaceCount, true);
  view.setUint32(8, totalFieldCells, true);
  view.setUint32(12, productEventCount, true);
  view.setFloat32(16, fieldPadding, true);
  view.setFloat32(20, refEdgeM, true);
  view.setFloat32(24, densityScale, true);
  view.setUint32(28, sourceCount, true);
  return buffer;
}

async function readBuffer(device, sourceBuffer, byteLength, label = 'ulg-sph-material-interface-source-local-readback') {
  const readBuffer = device.createBuffer({
    label,
    size: Math.max(4, byteLength),
    usage: GPU_BUFFER_USAGE.COPY_DST | GPU_BUFFER_USAGE.MAP_READ
  });
  const encoder = device.createCommandEncoder();
  encoder.copyBufferToBuffer(sourceBuffer, 0, readBuffer, 0, Math.max(4, byteLength));
  device.queue.submit([encoder.finish()]);
  await readBuffer.mapAsync(GPU_MAP_MODE.READ);
  const bytes = readBuffer.getMappedRange().slice(0, byteLength);
  readBuffer.unmap();
  readBuffer.destroy?.();
  return bytes;
}

function estimateSourceLocalFieldVisits(surfaceTable, sourceCount) {
  const resolvedSourceCount = Math.max(0, Math.round(finiteNumber(sourceCount, 0)));
  let estimatedCellVisits = 0;
  for (const surface of surfaceTable.metadata || []) {
    const resolution = Math.max(1, Math.round(finiteNumber(surface.resolution, 1)));
    const fieldCellCount = Math.max(0, Math.round(finiteNumber(surface.fieldCellCount, resolution ** 3)));
    const subtract = Math.max(1e-12, finiteNumber(surface.subtract, 1e-12));
    const supportNorm = Math.sqrt(Math.abs(finiteNumber(surface.strength, 0)) / subtract);
    const radiusCells = Math.min(resolution - 1, Math.ceil(supportNorm * resolution) + 1);
    estimatedCellVisits += Math.min(fieldCellCount, (radiusCells * 2 + 1) ** 3) * resolvedSourceCount;
  }
  const denseCellParticlePairs = Math.max(0, Math.round(finiteNumber(surfaceTable.totalFieldCells, 0))) * resolvedSourceCount;
  return {
    sourceCount: resolvedSourceCount,
    estimatedCellVisits,
    denseCellParticlePairs,
    estimatedVisitRatio: denseCellParticlePairs > 0 ? estimatedCellVisits / denseCellParticlePairs : 0
  };
}

export async function buildSphMaterialInterfaceSourceFieldLocalWebGpu({
  device,
  renderRows,
  renderRowsBuffer = null,
  renderRowsSource = null,
  schroederSpatialSourceFamily =
    renderRowsSource?.schroederSpatialSourceFamily ?? null,
  productEventRows = null,
  productEventBuffer = null,
  surfaceTable,
  particleCount = null,
  productEventCount = null,
  fieldPadding = 0.22,
  refEdgeM = 10,
  readbackMode = NO_FULL_READBACK_MODE,
  retainFieldRowsBuffer = true,
  retainSurfaceBuffer = true,
  retainSourceIndexFieldBuffer = true,
  waitForQueueCompletion = false,
  deferCleanup = true,
  useQueueFenceForCleanup = true,
  targetFieldRowsBuffer = null,
  targetFieldRowsBufferByteLength = null,
  source = 'resident-physics-material-interface-source-field',
  sourceCadence = 'resident-physics-stage'
} = {}) {
  if (!device?.createBuffer || !device.queue?.writeBuffer) {
    throw new TypeError('buildSphMaterialInterfaceSourceFieldLocalWebGpu requires a WebGPU-like device');
  }
  if (!renderRowsBuffer && !(renderRows instanceof Float32Array)) {
    throw new TypeError('buildSphMaterialInterfaceSourceFieldLocalWebGpu requires renderRows or renderRowsBuffer');
  }
  if (renderRows && renderRows.length % SPH_GPU_RENDER_ROW_FLOATS !== 0) {
    throw new RangeError('SPH render rows length must align to the render row stride');
  }
  if (productEventRows && (!(productEventRows instanceof Float32Array) || productEventRows.length % SPH_GPU_REACTION_PRODUCT_EVENT_FLOATS !== 0)) {
    throw new RangeError('SPH product-event rows length must align to the product-event row stride');
  }
  assertRenderFieldSurfaceTable(surfaceTable);

  const resolvedParticleCount = Math.max(
    0,
    Math.round(finiteNumber(particleCount ?? (renderRows?.length ? renderRows.length / SPH_GPU_RENDER_ROW_FLOATS : 0), 0))
  );
  const resolvedProductEventCount = Math.max(
    0,
    Math.round(finiteNumber(productEventCount ?? (
      productEventRows?.length ? productEventRows.length / SPH_GPU_REACTION_PRODUCT_EVENT_FLOATS : 0
    ), 0))
  );
  if (schroederSpatialSourceFamily) {
    if (
      renderRowsSource?.schroederSpatialSourceFamily
        !== schroederSpatialSourceFamily
      || renderRowsSource?.particleCount !== resolvedParticleCount
      || renderRowsBuffer == null
      || (
        renderRowsBuffer
        && renderRowsSource?.renderRowsBuffer !== renderRowsBuffer
      )
      || resolvedProductEventCount !== 0
      || productEventBuffer != null
      || productEventRows != null
    ) {
      throw new TypeError(
        'source-local field requires the exact render-row artifact derived from its successor source family'
      );
    }
    resolveSchroederSpatialSuccessorSourceFamily(
      schroederSpatialSourceFamily,
      { device, particleCount: resolvedParticleCount }
    );
    if (!validateSphRenderRowsSuccessorSourceLineage(
      renderRowsSource,
      {
        device,
        sourceFamily: schroederSpatialSourceFamily,
        particleCount: resolvedParticleCount,
        renderRowsBuffer,
        renderRows: renderRowsBuffer ? null : renderRows
      }
    )) {
      throw new TypeError(
        'source-local field requires module-authenticated successor render rows'
      );
    }
  }
  const sourceCount = resolvedParticleCount + (productEventBuffer || productEventRows ? resolvedProductEventCount : 0);
  const noFullReadback = readbackMode === NO_FULL_READBACK_MODE;
  const fieldRowByteLength = surfaceTable.totalFieldCells
    * SPH_GPU_RENDER_FIELD_CELL_FLOATS
    * Float32Array.BYTES_PER_ELEMENT;
  const sourceIndexFieldByteLength = surfaceTable.totalFieldCells * Uint32Array.BYTES_PER_ELEMENT;
  const targetFieldRowsByteLength = targetFieldRowsBuffer
    ? Math.max(0, Math.round(finiteNumber(
      targetFieldRowsBufferByteLength
        ?? targetFieldRowsBuffer.size
        ?? targetFieldRowsBuffer.byteLength
        ?? 0,
      0
    )))
    : 0;
  const targetFieldRowsRawByteLength = targetFieldRowsBuffer
    ? Math.max(0, Math.round(finiteNumber(
      targetFieldRowsBuffer.size
        ?? targetFieldRowsBuffer.byteLength
        ?? targetFieldRowsBuffer.byteLengthBytes
        ?? 0,
      0
    )))
    : 0;
  if (targetFieldRowsBuffer && targetFieldRowsRawByteLength <= 0) {
    throw new RangeError(
      'targetFieldRowsBuffer must expose its actual GPU buffer capacity'
    );
  }
  if (
    targetFieldRowsBuffer
    && targetFieldRowsRawByteLength > 0
    && targetFieldRowsByteLength > targetFieldRowsRawByteLength
  ) {
    throw new RangeError(
      `targetFieldRowsBufferByteLength (${targetFieldRowsByteLength}) exceeds the actual GPU buffer capacity (${targetFieldRowsRawByteLength})`
    );
  }
  const targetFieldRowsUsableByteLength = targetFieldRowsRawByteLength > 0
    ? Math.min(targetFieldRowsByteLength, targetFieldRowsRawByteLength)
    : targetFieldRowsByteLength;
  if (targetFieldRowsBuffer && targetFieldRowsUsableByteLength < fieldRowByteLength) {
    throw new RangeError(
      `targetFieldRowsBuffer is too small (${targetFieldRowsUsableByteLength}) for source-local material-interface field (${fieldRowByteLength})`
    );
  }
  const borrowedRenderRowsBuffer = renderRowsBuffer || null;
  const borrowedProductEventBuffer = productEventBuffer || null;
  const fieldRowsBufferBorrowed = Boolean(targetFieldRowsBuffer);
  const sourceRowsBuffer = borrowedRenderRowsBuffer || writeStorageBuffer(
    device,
    'ulg-sph-material-interface-source-local-render-rows',
    renderRows,
    GPU_BUFFER_USAGE.COPY_SRC
  );
  const sourceProductEventBuffer = borrowedProductEventBuffer || writeStorageBuffer(
    device,
    'ulg-sph-material-interface-source-local-product-events',
    productEventRows || new Float32Array(SPH_GPU_REACTION_PRODUCT_EVENT_FLOATS),
    GPU_BUFFER_USAGE.COPY_SRC
  );
  const surfaceBuffer = writeStorageBuffer(
    device,
    'ulg-sph-material-interface-source-local-surfaces',
    surfaceTable.records,
    GPU_BUFFER_USAGE.COPY_SRC
  );
  const densityAccumBuffer = writeStorageBuffer(
    device,
    'ulg-sph-material-interface-source-local-density-atomic',
    new Uint32Array(surfaceTable.totalFieldCells),
    GPU_BUFFER_USAGE.COPY_SRC
  );
  const sourceIndexAccumBuffer = writeStorageBuffer(
    device,
    'ulg-sph-material-interface-source-local-source-index-atomic',
    new Uint32Array(surfaceTable.totalFieldCells),
    GPU_BUFFER_USAGE.COPY_SRC
  );
  const fieldRowsBuffer = targetFieldRowsBuffer || writeStorageBuffer(
    device,
    'ulg-sph-material-interface-source-local-field-cells',
    new Float32Array(surfaceTable.totalFieldCells * SPH_GPU_RENDER_FIELD_CELL_FLOATS),
    GPU_BUFFER_USAGE.COPY_SRC
  );
  const paramsBuffer = device.createBuffer({
    label: 'ulg-sph-material-interface-source-local-params',
    size: 32,
    usage: GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST
  });
  device.queue.writeBuffer(paramsBuffer, 0, createSourceFieldParamsArray({
    particleCount: resolvedParticleCount,
    productEventCount: borrowedProductEventBuffer || productEventRows ? resolvedProductEventCount : 0,
    surfaceCount: surfaceTable.surfaceCount,
    totalFieldCells: surfaceTable.totalFieldCells,
    fieldPadding,
    refEdgeM,
    densityScale: SOURCE_LOCAL_DENSITY_SCALE,
    sourceCount
  }));

  const sourceLocalBindings = [
    computeBufferBinding(0, 'read-only-storage'),
    computeBufferBinding(1, 'read-only-storage'),
    computeBufferBinding(2, 'storage'),
    computeBufferBinding(3, 'uniform'),
    computeBufferBinding(4, 'read-only-storage'),
    computeBufferBinding(5, 'storage')
  ];
  const splatPipelineState = createCachedExplicitComputePipeline(device, {
    cacheKey: 'ulg-sph-material-interface-source-local-splat-v1',
    label: 'ulg-sph-material-interface-source-local-splat',
    code: sphMaterialInterfaceSourceLocalSplatWgsl,
    entryPoint: 'main',
    bindings: sourceLocalBindings
  });
  const splatBindGroup = device.createBindGroup({
    layout: splatPipelineState.bindGroupLayout,
    entries: [
      { binding: 0, resource: { buffer: sourceRowsBuffer } },
      { binding: 1, resource: { buffer: surfaceBuffer } },
      { binding: 2, resource: { buffer: densityAccumBuffer } },
      { binding: 3, resource: { buffer: paramsBuffer } },
      { binding: 4, resource: { buffer: sourceProductEventBuffer } },
      { binding: 5, resource: { buffer: sourceIndexAccumBuffer } }
    ]
  });

  const resolvePipelineState = createCachedExplicitComputePipeline(device, {
    cacheKey: 'ulg-sph-material-interface-source-local-resolve-v1',
    label: 'ulg-sph-material-interface-source-local-resolve',
    code: sphMaterialInterfaceSourceLocalResolveWgsl,
    entryPoint: 'main',
    bindings: [
      computeBufferBinding(0, 'read-only-storage'),
      computeBufferBinding(1, 'storage'),
      computeBufferBinding(2, 'storage'),
      computeBufferBinding(3, 'uniform')
    ]
  });
  const resolveBindGroup = device.createBindGroup({
    layout: resolvePipelineState.bindGroupLayout,
    entries: [
      { binding: 0, resource: { buffer: surfaceBuffer } },
      { binding: 1, resource: { buffer: densityAccumBuffer } },
      { binding: 2, resource: { buffer: fieldRowsBuffer } },
      { binding: 3, resource: { buffer: paramsBuffer } }
    ]
  });

  const encoder = device.createCommandEncoder();
  const splatPass = encoder.beginComputePass();
  splatPass.setPipeline(splatPipelineState.pipeline);
  splatPass.setBindGroup(0, splatBindGroup);
  splatPass.dispatchWorkgroups(Math.max(1, Math.ceil(Math.max(1, sourceCount) / 64)), Math.max(1, surfaceTable.surfaceCount));
  splatPass.end();
  const resolvePass = encoder.beginComputePass();
  resolvePass.setPipeline(resolvePipelineState.pipeline);
  resolvePass.setBindGroup(0, resolveBindGroup);
  resolvePass.dispatchWorkgroups(Math.max(1, Math.ceil(Math.max(1, surfaceTable.maxFieldCellCount) / 64)), Math.max(1, surfaceTable.surfaceCount));
  resolvePass.end();

  let queueCompletionStatus = 'not-submitted';
  let queueCompletionMethod = null;
  let fieldRows = new Float32Array();
  let deferNoFullCleanup = false;
  let successorSourceFamilyLease = null;
  if (schroederSpatialSourceFamily) {
    successorSourceFamilyLease =
      acquireSchroederSpatialSuccessorSourceFamilyLease(
        schroederSpatialSourceFamily,
        {
          device,
          consumerStage: 'sph-material-interface-source-field-gpu-submission'
        }
      );
  }
  try {
    device.queue.submit([encoder.finish()]);
  } catch (error) {
    if (successorSourceFamilyLease) {
      releaseSchroederSpatialSuccessorSourceFamilyLease(
        schroederSpatialSourceFamily,
        successorSourceFamilyLease,
        { device }
      );
      successorSourceFamilyLease = null;
    }
    throw error;
  }
  if (targetFieldRowsBuffer) {
    // queue.submit is the point of no return for a pooled target. Preserve the
    // prior publication through every fallible setup step and a rejected
    // submit, then retire it only once replacement writes are actually queued.
    reserveSphSuccessorDerivedFieldBufferPublication(targetFieldRowsBuffer);
  }
  if (successorSourceFamilyLease) {
    const submittedLease = successorSourceFamilyLease;
    successorSourceFamilyLease = null;
    deferSubmittedWorkCleanup(device, () => {
      releaseSchroederSpatialSuccessorSourceFamilyLease(
        schroederSpatialSourceFamily,
        submittedLease,
        { device }
      );
    });
  }
  if (!noFullReadback) {
    queueCompletionStatus = 'queue-submitted';
    queueCompletionMethod = 'queue.submit';
    const fieldBytes = await readBuffer(
      device,
      fieldRowsBuffer,
      fieldRowByteLength,
      'ulg-sph-material-interface-source-local-field-readback'
    );
    fieldRows = new Float32Array(fieldBytes);
    queueCompletionStatus = 'readback-map-completed';
    queueCompletionMethod = 'mapAsync(readback-buffer)';
  } else if (waitForQueueCompletion && device.queue?.onSubmittedWorkDone) {
    queueCompletionStatus = 'queue-submitted';
    queueCompletionMethod = 'queue.submit';
    await device.queue.onSubmittedWorkDone();
    queueCompletionStatus = 'queue-work-completed';
    queueCompletionMethod = 'queue.onSubmittedWorkDone';
  } else {
    queueCompletionStatus = device.queue?.onSubmittedWorkDone
      ? 'queue-submitted-gpu-handoff-no-cpu-fence'
      : 'queue-submitted-no-explicit-completion';
    queueCompletionMethod = device.queue?.onSubmittedWorkDone
      ? 'queue.submit(in-order-gpu-source-local-field-handoff)'
      : 'queue.submit';
    deferNoFullCleanup = Boolean(device.queue?.onSubmittedWorkDone && deferCleanup);
  }

  let cleanupDone = false;
  const cleanup = () => {
    if (cleanupDone) return;
    cleanupDone = true;
    if (!borrowedRenderRowsBuffer) sourceRowsBuffer.destroy?.();
    if (!borrowedProductEventBuffer) sourceProductEventBuffer.destroy?.();
    densityAccumBuffer.destroy?.();
    paramsBuffer.destroy?.();
    if (!retainSurfaceBuffer) surfaceBuffer.destroy?.();
    if (!retainFieldRowsBuffer && !fieldRowsBufferBorrowed) fieldRowsBuffer.destroy?.();
    if (!retainSourceIndexFieldBuffer) sourceIndexAccumBuffer.destroy?.();
  };
  let renderFieldDeferredCleanup = false;
  if (deferNoFullCleanup && useQueueFenceForCleanup) {
    renderFieldDeferredCleanup = deferSubmittedWorkCleanup(device, cleanup);
  } else if (deferNoFullCleanup) {
    renderFieldDeferredCleanup = true;
  } else {
    cleanup();
  }

  const visitEstimate = estimateSourceLocalFieldVisits(surfaceTable, sourceCount);
  const sourceRenderField = {
    schema: ULG_SPH_GPU_RENDER_FIELD_SCHEMA,
    backend: 'webgpu-source-local',
    status: 'render-field-built',
    kernelScope: SOURCE_LOCAL_KERNEL_SCOPE,
    sourceLocalSourceField: true,
    schroederSpatialSourceFamily,
    schroederSpatialSourceFamilyStatus:
      schroederSpatialSourceFamily?.status ?? null,
    schroederSpatialSourceFamilyRole:
      schroederSpatialSourceFamily?.sourceFamilyRole ?? null,
    schroederSpatialSourceGenerationId:
      schroederSpatialSourceFamily?.sourceGenerationId ?? null,
    schroederSpatialSuccessorEpochIdentity:
      schroederSpatialSourceFamily?.successorEpochIdentity ?? null,
    schroederSpatialSourceFamilyAncestorGenerationId:
      schroederSpatialSourceFamily?.ancestorSpatialGenerationId ?? null,
    schroederSpatialSourceFamilyPositionAuthority:
      schroederSpatialSourceFamily?.positionAuthority ?? null,
    schroederSpatialSourceFamilySpatialQueryAuthority:
      schroederSpatialSourceFamily?.spatialQueryAuthority ?? null,
    schroederSpatialSourceFamilyPositionEpoch:
      schroederSpatialSourceFamily?.positionEpoch ?? null,
    schroederSpatialSourceFamilyTopologyEpoch:
      schroederSpatialSourceFamily?.topologyEpoch ?? null,
    particleCount: resolvedParticleCount,
    productEventCount: borrowedProductEventBuffer || productEventRows ? resolvedProductEventCount : 0,
    productEventBufferBound: Boolean(borrowedProductEventBuffer || productEventRows),
    productEventBufferByteLength: (borrowedProductEventBuffer || productEventRows)
      ? resolvedProductEventCount * SPH_GPU_REACTION_PRODUCT_EVENT_FLOATS * Float32Array.BYTES_PER_ELEMENT
      : 0,
    surfaceCount: surfaceTable.surfaceCount,
    totalFieldCells: surfaceTable.totalFieldCells,
    maxFieldCellCount: surfaceTable.maxFieldCellCount,
    surfaceTable,
    rowLayout: [...SPH_GPU_RENDER_FIELD_CELL_ROW_LAYOUT],
    rowStrideFloats: SPH_GPU_RENDER_FIELD_CELL_FLOATS,
    fieldRows,
    fieldRowByteLength,
    fieldPadding,
    refEdgeM,
    renderFieldInputSource: borrowedRenderRowsBuffer
      ? 'resident-render-rows-buffer-source-local'
      : 'uploaded-render-rows-source-local',
    readbackMode: noFullReadback ? NO_FULL_READBACK_MODE : FULL_READBACK_MODE,
    queueCompletionStatus,
    queueCompletionMethod,
    pipelineCacheStatus: splatPipelineState.cacheStatus === 'pipeline-cache-hit'
      && resolvePipelineState.cacheStatus === 'pipeline-cache-hit'
      ? 'pipeline-cache-hit'
      : 'pipeline-cache-miss',
    sourceLocalSplatPipelineCacheStatus: splatPipelineState.cacheStatus,
    sourceLocalResolvePipelineCacheStatus: resolvePipelineState.cacheStatus,
    renderFieldDeferredCleanup,
    renderFieldReadback: !noFullReadback,
    fullReadbackPerformed: !noFullReadback,
    normalHotLoopReadbackFree: noFullReadback,
    fieldRowsBufferRetained: Boolean(retainFieldRowsBuffer),
    fieldRowsBufferByteLength: retainFieldRowsBuffer ? fieldRowByteLength : 0,
    fieldRowsBufferBorrowed,
    fieldRowsBufferReused: fieldRowsBufferBorrowed,
    fieldRowsBufferOwnedByResult: !fieldRowsBufferBorrowed,
    surfaceBufferRetained: Boolean(retainSurfaceBuffer),
    surfaceBufferByteLength: retainSurfaceBuffer ? surfaceTable.records.byteLength : 0,
    sourceIndexFieldSchema: 'peercompute.ulg.sph-material-interface-source-index-field.v0',
    sourceIndexFieldStatus: retainSourceIndexFieldBuffer
      ? 'source-local-source-index-field-retained'
      : 'source-local-source-index-field-transient',
    sourceIndexFieldBufferRetained: Boolean(retainSourceIndexFieldBuffer),
    sourceIndexFieldBufferByteLength: retainSourceIndexFieldBuffer ? sourceIndexFieldByteLength : 0,
    sourceIndexFieldStrideUints: 1,
    sourceLocalDensityScale: SOURCE_LOCAL_DENSITY_SCALE,
    sourceLocalSourceCount: sourceCount,
    sourceLocalEstimatedCellVisits: visitEstimate.estimatedCellVisits,
    sourceLocalDenseCellParticlePairs: visitEstimate.denseCellParticlePairs,
    sourceLocalEstimatedVisitRatio: visitEstimate.estimatedVisitRatio,
    sourceLocalDispatchWorkgroups: {
      splatX: Math.max(1, Math.ceil(Math.max(1, sourceCount) / 64)),
      splatY: Math.max(1, surfaceTable.surfaceCount),
      resolveX: Math.max(1, Math.ceil(Math.max(1, surfaceTable.maxFieldCellCount) / 64)),
      resolveY: Math.max(1, surfaceTable.surfaceCount)
    },
    scientificValidation: false,
    sphValidation: false,
    phaseChangeValidation: false,
    fullPhysicsValidation: false
  };
  if (retainFieldRowsBuffer) sourceRenderField.fieldRowsBuffer = fieldRowsBuffer;
  if (retainSurfaceBuffer) sourceRenderField.surfaceBuffer = surfaceBuffer;
  if (retainSourceIndexFieldBuffer) sourceRenderField.sourceIndexFieldBuffer = sourceIndexAccumBuffer;
  if (schroederSpatialSourceFamily) {
    schroederSourceFieldLineageRecords.set(sourceRenderField, {
      active: true,
      device,
      sourceFamily: schroederSpatialSourceFamily,
      particleCount: resolvedParticleCount,
      fieldRowsBuffer: sourceRenderField.fieldRowsBuffer ?? null,
      fieldRows: sourceRenderField.fieldRows,
      surfaceBuffer: sourceRenderField.surfaceBuffer ?? null,
      surfaceTable,
      surfaceRecords: surfaceTable.records,
      surfaceTableSnapshot:
        createSphRenderSurfaceTableLineageSnapshot(surfaceTable),
      renderRowsSource,
      renderRowsBuffer: borrowedRenderRowsBuffer,
      renderRows: borrowedRenderRowsBuffer ? null : renderRows,
      productEventBuffer: null,
      productEventRows: null,
      productEventCount: 0,
      fieldPadding,
      refEdgeM,
      rowStrideFloats: SPH_GPU_RENDER_FIELD_CELL_FLOATS,
      fieldRowByteLength,
      fieldRowsBufferByteLength:
        sourceRenderField.fieldRowsBufferByteLength
    });
    if (sourceRenderField.fieldRowsBuffer) {
      registerSphSuccessorDerivedFieldBufferPublication({
        buffer: sourceRenderField.fieldRowsBuffer,
        artifact: sourceRenderField,
        invalidate: () => invalidateSphMaterialInterfaceSourceFieldSuccessorLineage(
          sourceRenderField
        )
      });
    }
  }

  let retainedBuffersDestroyed = false;
  const destroyRetainedBuffers = () => {
    if (retainedBuffersDestroyed) return;
    retainedBuffersDestroyed = true;
    invalidateSphMaterialInterfaceSourceFieldSuccessorLineage(sourceRenderField);
    if (!fieldRowsBufferBorrowed) fieldRowsBuffer.destroy?.();
    surfaceBuffer.destroy?.();
    sourceIndexAccumBuffer.destroy?.();
  };
  return {
    schema: ULG_SPH_MATERIAL_INTERFACE_SOURCE_FIELD_SCHEMA,
    backend: 'webgpu-source-local',
    status: 'material-interface-source-field-ready',
    source,
    sourceCadence,
    sourceRenderField,
    sourceRenderFieldSchema: sourceRenderField.schema,
    sourceRenderFieldBackend: sourceRenderField.backend,
    sourceRenderFieldStatus: sourceRenderField.status,
    sourceRenderFieldReadback: Boolean(sourceRenderField.renderFieldReadback),
    sourceRenderFieldReadbackMode: sourceRenderField.readbackMode ?? null,
    sourceRenderFieldQueueCompletionStatus: sourceRenderField.queueCompletionStatus ?? null,
    sourceRenderFieldQueueCompletionMethod: sourceRenderField.queueCompletionMethod ?? null,
    sourceRenderFieldPipelineCacheStatus: sourceRenderField.pipelineCacheStatus ?? null,
    kernelScope: SOURCE_LOCAL_KERNEL_SCOPE,
    sourceLocalSourceField: true,
    schroederSpatialSourceFamily,
    schroederSpatialSourceFamilyStatus:
      schroederSpatialSourceFamily?.status ?? null,
    schroederSpatialSourceFamilyRole:
      schroederSpatialSourceFamily?.sourceFamilyRole ?? null,
    schroederSpatialSourceGenerationId:
      schroederSpatialSourceFamily?.sourceGenerationId ?? null,
    schroederSpatialSuccessorEpochIdentity:
      schroederSpatialSourceFamily?.successorEpochIdentity ?? null,
    schroederSpatialSourceFamilyAncestorGenerationId:
      schroederSpatialSourceFamily?.ancestorSpatialGenerationId ?? null,
    schroederSpatialSourceFamilyPositionAuthority:
      schroederSpatialSourceFamily?.positionAuthority ?? null,
    schroederSpatialSourceFamilySpatialQueryAuthority:
      schroederSpatialSourceFamily?.spatialQueryAuthority ?? null,
    schroederSpatialSourceFamilyPositionEpoch:
      schroederSpatialSourceFamily?.positionEpoch ?? null,
    schroederSpatialSourceFamilyTopologyEpoch:
      schroederSpatialSourceFamily?.topologyEpoch ?? null,
    sourceLocalDensityScale: SOURCE_LOCAL_DENSITY_SCALE,
    sourceLocalSourceCount: sourceCount,
    sourceLocalEstimatedCellVisits: visitEstimate.estimatedCellVisits,
    sourceLocalDenseCellParticlePairs: visitEstimate.denseCellParticlePairs,
    sourceLocalEstimatedVisitRatio: visitEstimate.estimatedVisitRatio,
    sourceLocalSplatPipelineCacheStatus: splatPipelineState.cacheStatus,
    sourceLocalResolvePipelineCacheStatus: resolvePipelineState.cacheStatus,
    particleCount: sourceRenderField.particleCount,
    productEventCount: sourceRenderField.productEventCount,
    surfaceCount: sourceRenderField.surfaceCount,
    totalFieldCells: sourceRenderField.totalFieldCells,
    maxFieldCellCount: sourceRenderField.maxFieldCellCount,
    surfaceTable: sourceRenderField.surfaceTable,
    rowLayout: sourceRenderField.rowLayout,
    rowStrideFloats: sourceRenderField.rowStrideFloats,
    fieldRows: sourceRenderField.fieldRows,
    fieldRowByteLength: sourceRenderField.fieldRowByteLength,
    fieldPadding: sourceRenderField.fieldPadding,
    refEdgeM: sourceRenderField.refEdgeM,
    fieldRowsBuffer: sourceRenderField.fieldRowsBuffer || null,
    surfaceBuffer: sourceRenderField.surfaceBuffer || null,
    fieldRowsBufferRetained: Boolean(sourceRenderField.fieldRowsBufferRetained),
    fieldRowsBufferByteLength: sourceRenderField.fieldRowsBufferByteLength ?? 0,
    fieldRowsBufferBorrowed: Boolean(sourceRenderField.fieldRowsBufferBorrowed),
    fieldRowsBufferReused: Boolean(sourceRenderField.fieldRowsBufferReused),
    fieldRowsBufferOwnedByResult: sourceRenderField.fieldRowsBufferOwnedByResult ?? null,
    surfaceBufferRetained: Boolean(sourceRenderField.surfaceBufferRetained),
    surfaceBufferByteLength: sourceRenderField.surfaceBufferByteLength ?? 0,
    sourceIndexFieldSchema: sourceRenderField.sourceIndexFieldSchema,
    sourceIndexFieldStatus: sourceRenderField.sourceIndexFieldStatus,
    sourceIndexFieldBuffer: sourceRenderField.sourceIndexFieldBuffer || null,
    sourceIndexFieldBufferRetained: Boolean(sourceRenderField.sourceIndexFieldBufferRetained),
    sourceIndexFieldBufferByteLength: sourceRenderField.sourceIndexFieldBufferByteLength ?? 0,
    sourceIndexFieldStrideUints: sourceRenderField.sourceIndexFieldStrideUints ?? 1,
    readbackMode: sourceRenderField.readbackMode ?? null,
    queueCompletionStatus: sourceRenderField.queueCompletionStatus ?? null,
    queueCompletionMethod: sourceRenderField.queueCompletionMethod ?? null,
    normalHotLoopReadbackFree: Boolean(sourceRenderField.normalHotLoopReadbackFree),
    releaseMaterialInterfaceSourceFieldLeases() {
      return null;
    },
    destroyMaterialInterfaceSourceFieldBuffers() {
      cleanup();
      destroyRetainedBuffers();
      return null;
    },
    scientificValidation: false,
    sphValidation: false,
    forceCouplingValidation: false,
    fullPhysicsValidation: false
  };
}
