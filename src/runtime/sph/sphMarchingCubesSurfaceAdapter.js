import {
  SPH_GPU_RENDER_SURFACE_DRAW_INDIRECT_ROW_LAYOUT,
  SPH_GPU_RENDER_SURFACE_DRAW_ROW_LAYOUT,
  SPH_GPU_RENDER_SURFACE_VERTEX_ROW_LAYOUT,
  ULG_SPH_GPU_RENDER_SURFACE_DRAW_INDIRECT_SCHEMA,
  ULG_SPH_GPU_RENDER_SURFACE_DRAW_SCHEMA,
  ULG_SPH_GPU_RENDER_SURFACE_VERTICES_SCHEMA
} from '../../../ulg-gpu-abi/src/index.js';
import { computeBufferBinding, createExplicitComputePipeline, deferSubmittedWorkCleanup } from '../webgpuComputeLayout.js';
import {
  addResidentBufferLease,
  createResidentBufferLeaseLedger,
  destroyResidentBufferWithLease,
  registerResidentBufferResource,
  releaseResidentBufferLease,
  summarizeResidentBufferLeaseLedger
} from '../residentBufferLease.js';

export const ULG_SPH_WEBGPU_MARCHING_CUBES_EXTENSION_ADAPTER_SCHEMA =
  'peercompute.ulg.sph-webgpu-marching-cubes-extension-adapter.v0';
export const ULG_SPH_WEBGPU_MARCHING_CUBES_EXTENSION_EXECUTION_SCHEMA =
  'peercompute.ulg.sph-webgpu-marching-cubes-extension-execution.v0';
export const WEBGPU_MARCHING_CUBES_SURFACE_EXECUTION_SCHEMA =
  'peercompute.webgpu-marching-cubes.surface-execution.v0';
export const WEBGPU_MARCHING_CUBES_SURFACE_SCHEMA =
  'peercompute.webgpu-marching-cubes.surface.v0';
export const WEBGPU_MARCHING_CUBES_SURFACE_ROW_METADATA_SCHEMA =
  'peercompute.webgpu-marching-cubes.surface-row-metadata.v0';
export const WEBGPU_MARCHING_CUBES_COMPACT_POSITION_ROWS_SCHEMA =
  'peercompute.webgpu-marching-cubes.compact-position-rows.v0';
export const ULG_SPH_WEBGPU_MARCHING_CUBES_EXTENSION_TRANSLATION_SCHEMA =
  'peercompute.ulg.sph-webgpu-marching-cubes-extension-translation.v0';

export const ULG_MARCHING_CUBES_EXTENSION_POSITION_VERTEX_FORMAT = 'float32x4-position';
export const ULG_MARCHING_CUBES_REQUIRED_SURFACE_VERTEX_FORMAT =
  'peercompute.ulg.sph-gpu-render-surface-vertex-row.v0';

const FULL_READBACK_MODE = 'full-parity-readback';
const NO_FULL_READBACK_MODE = 'no-full-readback';
const GPU_BUFFER_USAGE = {
  MAP_READ: globalThis.GPUBufferUsage?.MAP_READ ?? 1,
  COPY_SRC: globalThis.GPUBufferUsage?.COPY_SRC ?? 4,
  COPY_DST: globalThis.GPUBufferUsage?.COPY_DST ?? 8,
  STORAGE: globalThis.GPUBufferUsage?.STORAGE ?? 128,
  UNIFORM: globalThis.GPUBufferUsage?.UNIFORM ?? 64,
  INDIRECT: globalThis.GPUBufferUsage?.INDIRECT ?? 256
};
const GPU_MAP_MODE = {
  READ: globalThis.GPUMapMode?.READ ?? 1
};

const EXTENSION_SURFACE_TRANSLATION_WORKGROUP_SIZE = 64;

export const webGpuMarchingCubesExtensionSurfaceRowsWgsl = /* wgsl */`
struct SurfaceTranslationParams {
  vertex_count: u32,
  source_stride_floats: u32,
  surface_index: u32,
  triangle_count: u32,
  material_id: f32,
  phase_id: f32,
  optical_state_id: f32,
  density: f32,
  isolation: f32,
  source_voxel_base: f32,
  transparency_class_id: f32,
  depth_write_flag: f32,
  render_order: f32,
  fallback_normal_x: f32,
  fallback_normal_y: f32,
  fallback_normal_z: f32,
};

@group(0) @binding(0) var<storage, read> compact_position_rows: array<f32>;
@group(0) @binding(1) var<storage, read_write> surface_vertex_rows: array<f32>;
@group(0) @binding(2) var<storage, read_write> surface_draw_rows: array<f32>;
@group(0) @binding(3) var<storage, read_write> surface_draw_indirect_rows: array<u32>;
@group(0) @binding(4) var<uniform> params: SurfaceTranslationParams;

fn compact_position(vertex_index: u32) -> vec3<f32> {
  let offset = vertex_index * params.source_stride_floats;
  return vec3<f32>(
    compact_position_rows[offset + 0u],
    compact_position_rows[offset + 1u],
    compact_position_rows[offset + 2u]
  );
}

fn normalize_or_fallback(v: vec3<f32>) -> vec3<f32> {
  let len = length(v);
  if (len <= 0.000000000001) {
    return normalize(vec3<f32>(
      params.fallback_normal_x,
      params.fallback_normal_y,
      params.fallback_normal_z
    ));
  }
  return v / len;
}

fn write_vertex(vertex_index: u32, triangle_index: u32, p: vec3<f32>, normal: vec3<f32>) {
  let offset = vertex_index * 16u;
  surface_vertex_rows[offset + 0u] = f32(params.surface_index);
  surface_vertex_rows[offset + 1u] = params.material_id;
  surface_vertex_rows[offset + 2u] = params.phase_id;
  surface_vertex_rows[offset + 3u] = f32(triangle_index);
  surface_vertex_rows[offset + 4u] = f32(vertex_index);
  surface_vertex_rows[offset + 5u] = p.x;
  surface_vertex_rows[offset + 6u] = p.y;
  surface_vertex_rows[offset + 7u] = p.z;
  surface_vertex_rows[offset + 8u] = normal.x;
  surface_vertex_rows[offset + 9u] = normal.y;
  surface_vertex_rows[offset + 10u] = normal.z;
  surface_vertex_rows[offset + 11u] = params.optical_state_id;
  surface_vertex_rows[offset + 12u] = params.density;
  surface_vertex_rows[offset + 13u] = params.isolation;
  surface_vertex_rows[offset + 14u] = params.source_voxel_base + f32(triangle_index);
  surface_vertex_rows[offset + 15u] = 1.0;
}

fn write_draw_metadata() {
  surface_draw_rows[0u] = f32(params.surface_index);
  surface_draw_rows[1u] = params.material_id;
  surface_draw_rows[2u] = params.phase_id;
  surface_draw_rows[3u] = params.optical_state_id;
  surface_draw_rows[4u] = 0.0;
  surface_draw_rows[5u] = f32(params.triangle_count * 3u);
  surface_draw_rows[6u] = 0.0;
  surface_draw_rows[7u] = f32(params.triangle_count);
  surface_draw_rows[8u] = params.render_order;
  surface_draw_rows[9u] = params.transparency_class_id;
  surface_draw_rows[10u] = params.depth_write_flag;
  surface_draw_rows[11u] = select(0.0, 1.0, params.triangle_count > 0u);
  surface_draw_rows[12u] = 0.0;
  surface_draw_rows[13u] = 0.0;
  surface_draw_rows[14u] = 0.0;
  surface_draw_rows[15u] = 0.0;
  surface_draw_indirect_rows[0u] = params.triangle_count * 3u;
  surface_draw_indirect_rows[1u] = select(0u, 1u, params.triangle_count > 0u);
  surface_draw_indirect_rows[2u] = 0u;
  surface_draw_indirect_rows[3u] = params.surface_index;
}

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) id: vec3<u32>) {
  let triangle_index = id.x;
  if (triangle_index >= params.triangle_count) {
    return;
  }
  let vertex_base = triangle_index * 3u;
  let p0 = compact_position(vertex_base + 0u);
  let p1 = compact_position(vertex_base + 1u);
  let p2 = compact_position(vertex_base + 2u);
  let normal = normalize_or_fallback(cross(p1 - p0, p2 - p0));
  write_vertex(vertex_base + 0u, triangle_index, p0, normal);
  write_vertex(vertex_base + 1u, triangle_index, p1, normal);
  write_vertex(vertex_base + 2u, triangle_index, p2, normal);
  if (triangle_index == 0u) {
    write_draw_metadata();
  }
}
`;

function isObject(value) {
  return (typeof value === 'object' || typeof value === 'function') && value !== null;
}

function finiteNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function normalizeStatusReason(value) {
  if (typeof value === 'string' && value.length > 0) return value;
  return null;
}

function vector3(value, fallback = [0, 1, 0]) {
  const source = Array.isArray(value) || ArrayBuffer.isView(value) ? value : fallback;
  return [
    finiteNumber(source[0], fallback[0]),
    finiteNumber(source[1], fallback[1]),
    finiteNumber(source[2], fallback[2])
  ];
}

function normalizeVector3(value, fallback = [0, 1, 0]) {
  const v = vector3(value, fallback);
  const length = Math.hypot(v[0], v[1], v[2]);
  if (!(length > 1e-12)) return [...fallback];
  return [v[0] / length, v[1] / length, v[2] / length];
}

function triangleNormal(a, b, c, fallbackNormal) {
  const ab = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const ac = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
  return normalizeVector3([
    ab[1] * ac[2] - ab[2] * ac[1],
    ab[2] * ac[0] - ab[0] * ac[2],
    ab[0] * ac[1] - ab[1] * ac[0]
  ], fallbackNormal);
}

function writeSurfaceDrawRow(drawRows, offset, {
  surfaceIndex,
  materialId,
  phaseId,
  opticalStateId,
  vertexOffset,
  vertexCount,
  triangleOffset,
  triangleCount,
  renderOrder,
  transparencyClassId,
  depthWriteFlag,
  status,
  boundsCenterM,
  boundsRadiusM
}) {
  drawRows.set([
    surfaceIndex,
    materialId,
    phaseId,
    opticalStateId,
    vertexOffset,
    vertexCount,
    triangleOffset,
    triangleCount,
    renderOrder,
    transparencyClassId,
    depthWriteFlag,
    status,
    boundsCenterM[0],
    boundsCenterM[1],
    boundsCenterM[2],
    boundsRadiusM
  ], offset);
}

function writeSurfaceDrawIndirectRow(indirectRows, offset, {
  vertexCount,
  instanceCount,
  firstVertex,
  firstInstance
}) {
  indirectRows.set([
    Math.max(0, Math.round(finiteNumber(vertexCount, 0))),
    Math.max(0, Math.round(finiteNumber(instanceCount, 0))),
    Math.max(0, Math.round(finiteNumber(firstVertex, 0))),
    Math.max(0, Math.round(finiteNumber(firstInstance, 0)))
  ], offset);
}

function createExtensionSurfaceTranslationParamsArray({
  vertexCount,
  sourceStrideFloats,
  surfaceIndex,
  triangleCount,
  materialId,
  phaseId,
  opticalStateId,
  density,
  isolation,
  sourceVoxelLinearIndex,
  transparencyClassId,
  depthWriteFlag,
  renderOrder,
  fallbackNormal
}) {
  const buffer = new ArrayBuffer(64);
  const view = new DataView(buffer);
  view.setUint32(0, Math.max(0, Math.round(finiteNumber(vertexCount, 0))), true);
  view.setUint32(4, Math.max(1, Math.round(finiteNumber(sourceStrideFloats, 4))), true);
  view.setUint32(8, Math.max(0, Math.round(finiteNumber(surfaceIndex, 0))), true);
  view.setUint32(12, Math.max(0, Math.round(finiteNumber(triangleCount, 0))), true);
  view.setFloat32(16, finiteNumber(materialId, 0), true);
  view.setFloat32(20, finiteNumber(phaseId, 0), true);
  view.setFloat32(24, finiteNumber(opticalStateId, 0), true);
  view.setFloat32(28, finiteNumber(density, 0), true);
  view.setFloat32(32, finiteNumber(isolation, 0), true);
  view.setFloat32(36, finiteNumber(sourceVoxelLinearIndex, 0), true);
  view.setFloat32(40, finiteNumber(transparencyClassId, 0), true);
  view.setFloat32(44, finiteNumber(depthWriteFlag, 1), true);
  view.setFloat32(48, finiteNumber(renderOrder, surfaceIndex), true);
  view.setFloat32(52, fallbackNormal[0], true);
  view.setFloat32(56, fallbackNormal[1], true);
  view.setFloat32(60, fallbackNormal[2], true);
  return buffer;
}

async function readBuffer(device, sourceBuffer, byteLength, label = 'ulg-sph-marching-cubes-extension-readback') {
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

function extensionSurfaceMetadata({
  surfaceIndex,
  materialId,
  phaseId,
  opticalStateId,
  material,
  phase,
  renderKey,
  surfaceKey,
  vertexCount,
  triangleCount,
  renderOrder,
  transparencyClassId,
  depthWriteFlag,
  status = 'surface-draw-summary-not-read'
}) {
  return {
    surfaceKey: surfaceKey || `extension-surface-${surfaceIndex}`,
    material,
    phase,
    renderKey,
    surfaceIndex,
    materialId,
    phaseId,
    opticalStateId,
    vertexOffset: status === 'surface-draw-ready' ? 0 : null,
    vertexCount,
    triangleOffset: status === 'surface-draw-ready' ? 0 : null,
    triangleCount,
    renderOrder,
    transparencyClassId,
    depthWriteFlag,
    boundsCenterM: [0, 0, 0],
    boundsRadiusM: status === 'surface-draw-ready' ? 0 : null,
    status
  };
}

function assertSameDeviceExtensionSurfaceBuffer(extensionExecution) {
  const result = extensionExecution?.result || null;
  const ownership = result?.rowMetadata?.position?.resourceOwnership || result?.resourceOwnership || null;
  if (ownership?.ok === false || ownership?.status === 'cross-device-resource') {
    throw new TypeError(`extension surface buffer is not owned by this GPUDevice (${ownership.status})`);
  }
}

function compactPositionRowsSource(result = null) {
  const position = result?.rowMetadata?.position || null;
  const rowStrideFloats = Math.max(0, Math.round(finiteNumber(
    position?.rowStrideFloats ?? result?.rowStrideFloats ?? result?.vertexStrideFloats,
    0
  )));
  const rowStrideBytes = Math.max(0, Math.round(finiteNumber(
    position?.rowStrideBytes ?? result?.rowStrideBytes ?? result?.vertexStrideBytes,
    0
  )));
  const rowSchema = position?.schema ?? result?.rowSchema ?? null;
  const rowLayout = Array.isArray(position?.rowLayout)
    ? [...position.rowLayout]
    : Array.isArray(result?.rowLayout)
    ? [...result.rowLayout]
    : null;
  const buffer = position?.buffer || result?.buffer || null;
  const bufferRetained = Boolean(
    (position?.bufferRetained && position?.buffer)
      || (result?.bufferRetained && result?.buffer)
  );
  const bufferByteLength = Math.max(0, Math.round(finiteNumber(
    position?.bufferByteLength ?? result?.bufferByteLength,
    0
  )));
  return {
    rowMetadataSchema: result?.rowMetadata?.schema ?? null,
    rowMetadataStatus: result?.rowMetadata?.status ?? null,
    rowSchema,
    rowLayout,
    rowStrideFloats,
    rowStrideBytes,
    rowCount: Math.max(0, Math.round(finiteNumber(position?.rowCount ?? result?.rowCount ?? result?.vertexCount, 0))),
    status: position?.status ?? null,
    available: Boolean(position?.available ?? bufferRetained),
    buffer,
    bufferRetained,
    bufferByteLength,
    ownerDeviceId: position?.ownerDeviceId ?? result?.ownerDeviceId ?? null,
    resourceOwnership: position?.resourceOwnership ?? result?.resourceOwnership ?? null,
    readback: position?.readback ?? result?.rowMetadata?.readback ?? result?.readback ?? null,
    normalRowsStatus: result?.rowMetadata?.normal?.status ?? null,
    materialRowsStatus: result?.rowMetadata?.material?.status ?? null
  };
}

function createMissingExecutionSummary(reason) {
  return {
    schema: ULG_SPH_WEBGPU_MARCHING_CUBES_EXTENSION_EXECUTION_SCHEMA,
    status: 'extension-surface-execution-invalid',
    reason,
    extensionExecutionSchema: null,
    extensionSurfaceSchema: null,
    extensionStatus: null,
    extensionOk: false,
    extensionBackend: null,
    extensionAdapterId: null,
    extensionOwnsDevice: null,
    extensionOwnerDeviceId: null,
    extensionResourceOwnershipStatus: null,
    extensionVertexFormat: null,
    extensionVertexStrideFloats: null,
    extensionVertexStrideBytes: null,
    extensionVertexCount: 0,
    extensionTriangleCount: 0,
    extensionBufferRetained: false,
    extensionReadback: null,
    extensionSurfaceVertexReadback: null,
    readyForUlgSurfaceVertexRows: false,
    requiresUlgVertexRowTranslation: true,
    requiresUlgDrawMetadata: true,
    surfaceVertexSchema: ULG_SPH_GPU_RENDER_SURFACE_VERTICES_SCHEMA,
    surfaceVertexFormat: ULG_MARCHING_CUBES_REQUIRED_SURFACE_VERTEX_FORMAT,
    surfaceVertexRowLayout: [...SPH_GPU_RENDER_SURFACE_VERTEX_ROW_LAYOUT],
    surfaceVertexRowStrideFloats: SPH_GPU_RENDER_SURFACE_VERTEX_ROW_LAYOUT.length,
    surfaceDrawSchema: ULG_SPH_GPU_RENDER_SURFACE_DRAW_SCHEMA,
    surfaceDrawRowLayout: [...SPH_GPU_RENDER_SURFACE_DRAW_ROW_LAYOUT],
    surfaceDrawRowStrideFloats: SPH_GPU_RENDER_SURFACE_DRAW_ROW_LAYOUT.length,
    surfaceDrawIndirectSchema: ULG_SPH_GPU_RENDER_SURFACE_DRAW_INDIRECT_SCHEMA,
    surfaceDrawIndirectRowLayout: [...SPH_GPU_RENDER_SURFACE_DRAW_INDIRECT_ROW_LAYOUT],
    surfaceDrawIndirectRowStrideUints: SPH_GPU_RENDER_SURFACE_DRAW_INDIRECT_ROW_LAYOUT.length,
    hotLoopSafe: false,
    rendererIntegration: 'not-integrated'
  };
}

export function summarizeWebGpuMarchingCubesExtensionExecution(execution) {
  if (!isObject(execution)) {
    return createMissingExecutionSummary('missing extension surface execution');
  }
  const result = execution.result || null;
  const positionRows = compactPositionRowsSource(result);
  const extensionSurfaceSchema = result?.schema ?? null;
  const extensionOk = execution.ok === true;
  const extensionVertexCount = Math.max(0, Math.round(finiteNumber(result?.vertexCount, 0)));
  const extensionTriangleCount = Math.max(0, finiteNumber(result?.triangleCount, 0));
  const extensionVertexStrideFloats = positionRows.rowStrideFloats > 0
    ? positionRows.rowStrideFloats
    : result?.vertexStrideFloats == null
    ? null
    : Math.max(0, Math.round(finiteNumber(result.vertexStrideFloats, 0)));
  const extensionVertexStrideBytes = positionRows.rowStrideBytes > 0
    ? positionRows.rowStrideBytes
    : result?.vertexStrideBytes == null
    ? null
    : Math.max(0, Math.round(finiteNumber(result.vertexStrideBytes, 0)));
  const extensionVertexFormat = result?.vertexFormat ?? null;
  const extensionBufferRetained = positionRows.bufferRetained;
  const extensionResourceOwnershipStatus = positionRows.resourceOwnership?.status ?? null;
  const blockedReason = normalizeStatusReason(execution.webgpuStatus?.reason)
    || normalizeStatusReason(result?.reason)
    || normalizeStatusReason(execution.status);
  const readyCompactPositionBuffer = Boolean(
    extensionOk
    && extensionSurfaceSchema === WEBGPU_MARCHING_CUBES_SURFACE_SCHEMA
    && extensionBufferRetained
    && extensionVertexCount > 0
  );
  const readyForUlgSurfaceVertexRows = Boolean(
    readyCompactPositionBuffer
    && extensionVertexStrideFloats === SPH_GPU_RENDER_SURFACE_VERTEX_ROW_LAYOUT.length
    && extensionVertexFormat === ULG_MARCHING_CUBES_REQUIRED_SURFACE_VERTEX_FORMAT
  );
  const requiresUlgVertexRowTranslation = !readyForUlgSurfaceVertexRows;
  let status = 'extension-surface-execution-blocked';
  if (!extensionOk) {
    status = execution.status === 'same-device-check-failed'
      ? 'extension-surface-same-device-check-failed'
      : 'extension-surface-execution-blocked';
  } else if (!readyCompactPositionBuffer) {
    status = extensionVertexCount > 0
      ? 'extension-surface-buffer-unavailable'
      : 'extension-surface-empty';
  } else if (requiresUlgVertexRowTranslation) {
    status = 'extension-surface-ready-needs-ulg-row-translation';
  } else {
    status = 'extension-surface-ready-ulg-row-compatible';
  }

  return {
    schema: ULG_SPH_WEBGPU_MARCHING_CUBES_EXTENSION_EXECUTION_SCHEMA,
    status,
    reason: status.endsWith('failed') || status.endsWith('blocked') ? blockedReason : null,
    extensionExecutionSchema: execution.schema ?? null,
    extensionSurfaceSchema,
    extensionStatus: execution.status ?? null,
    extensionOk,
    extensionBackend: execution.backend ?? null,
    extensionAdapterId: execution.adapterId ?? null,
    extensionOwnsDevice: execution.ownsDevice ?? null,
    extensionOwnerDeviceId: execution.ownerDeviceId ?? result?.ownerDeviceId ?? null,
    extensionResourceOwnershipStatus,
    extensionVertexFormat,
    extensionVertexStrideFloats,
    extensionVertexStrideBytes,
    extensionVertexCount,
    extensionTriangleCount,
    extensionBufferRetained,
    extensionBufferByteLength: positionRows.bufferByteLength,
    extensionRowMetadataSchema: positionRows.rowMetadataSchema,
    extensionRowMetadataStatus: positionRows.rowMetadataStatus,
    extensionPositionRowsSchema: positionRows.rowSchema,
    extensionPositionRowsStatus: positionRows.status,
    extensionPositionRowsAvailable: positionRows.available,
    extensionPositionRowsReadback: positionRows.readback,
    extensionPositionRowsRowLayout: positionRows.rowLayout,
    extensionPositionRowsRowCount: positionRows.rowCount,
    extensionNormalRowsStatus: positionRows.normalRowsStatus,
    extensionMaterialRowsStatus: positionRows.materialRowsStatus,
    extensionReadback: execution.readback ?? null,
    extensionSurfaceVertexReadback: execution.surfaceVertexReadback ?? null,
    readyForUlgSurfaceVertexRows,
    requiresUlgVertexRowTranslation,
    requiresUlgDrawMetadata: true,
    surfaceVertexSchema: ULG_SPH_GPU_RENDER_SURFACE_VERTICES_SCHEMA,
    surfaceVertexFormat: ULG_MARCHING_CUBES_REQUIRED_SURFACE_VERTEX_FORMAT,
    surfaceVertexRowLayout: [...SPH_GPU_RENDER_SURFACE_VERTEX_ROW_LAYOUT],
    surfaceVertexRowStrideFloats: SPH_GPU_RENDER_SURFACE_VERTEX_ROW_LAYOUT.length,
    surfaceDrawSchema: ULG_SPH_GPU_RENDER_SURFACE_DRAW_SCHEMA,
    surfaceDrawRowLayout: [...SPH_GPU_RENDER_SURFACE_DRAW_ROW_LAYOUT],
    surfaceDrawRowStrideFloats: SPH_GPU_RENDER_SURFACE_DRAW_ROW_LAYOUT.length,
    surfaceDrawIndirectSchema: ULG_SPH_GPU_RENDER_SURFACE_DRAW_INDIRECT_SCHEMA,
    surfaceDrawIndirectRowLayout: [...SPH_GPU_RENDER_SURFACE_DRAW_INDIRECT_ROW_LAYOUT],
    surfaceDrawIndirectRowStrideUints: SPH_GPU_RENDER_SURFACE_DRAW_INDIRECT_ROW_LAYOUT.length,
    hotLoopSafe: Boolean(
      readyCompactPositionBuffer
      && execution.readback === false
      && execution.surfaceVertexReadback === false
      && positionRows.readback !== true
    ),
    rendererIntegration: 'pending-ulg-row-translation-and-engine-bridge'
  };
}

export function createUlgWebGpuMarchingCubesExtensionAdapter({
  device,
  volume = null,
  adapterFactory,
  adapter = null,
  adapterId = 'webgpu-marching-cubes',
  backend = 'webgpu-marching-cubes-extension'
} = {}) {
  if (!isObject(device)) {
    throw new TypeError('createUlgWebGpuMarchingCubesExtensionAdapter requires a caller-owned GPUDevice');
  }
  if (!adapter && typeof adapterFactory !== 'function') {
    throw new TypeError('createUlgWebGpuMarchingCubesExtensionAdapter requires an adapter or adapterFactory');
  }
  let extensionAdapter = adapter;
  const wrapper = {
    schema: ULG_SPH_WEBGPU_MARCHING_CUBES_EXTENSION_ADAPTER_SCHEMA,
    adapterId,
    backend,
    device,
    ownsDevice: false,
    volume,
    get adapter() {
      return extensionAdapter;
    },
    async extractSurface(input = {}) {
      if (!extensionAdapter) {
        extensionAdapter = await adapterFactory({
          device,
          volume,
          adapterId
        });
      }
      const extensionExecution = await extensionAdapter.extractSurface({
        ...input,
        volume: input.volume || volume
      });
      const summary = summarizeWebGpuMarchingCubesExtensionExecution(extensionExecution);
      return {
        schema: ULG_SPH_WEBGPU_MARCHING_CUBES_EXTENSION_EXECUTION_SCHEMA,
        status: summary.status,
        backend,
        adapterSchema: wrapper.schema,
        extensionAdapterSchema: extensionAdapter?.schema ?? null,
        adapterId,
        ownsDevice: false,
        summary,
        extensionExecution,
        surfaceVertexSchema: summary.surfaceVertexSchema,
        surfaceDrawSchema: summary.surfaceDrawSchema,
        surfaceDrawIndirectSchema: summary.surfaceDrawIndirectSchema,
        readyForUlgSurfaceVertexRows: summary.readyForUlgSurfaceVertexRows,
        requiresUlgVertexRowTranslation: summary.requiresUlgVertexRowTranslation,
        requiresUlgDrawMetadata: summary.requiresUlgDrawMetadata,
        hotLoopSafe: summary.hotLoopSafe,
        rendererIntegration: summary.rendererIntegration
      };
    }
  };
  return wrapper;
}

export function translateWebGpuMarchingCubesSurfaceToUlgRows({
  extensionExecution,
  positionRows = null,
  surfaceIndex = 0,
  materialId = 0,
  phaseId = 0,
  opticalStateId = 0,
  material = null,
  phase = null,
  renderKey = null,
  surfaceKey = null,
  density = 0,
  isolation = null,
  sourceVoxelLinearIndex = 0,
  fallbackNormal = [0, 1, 0],
  transparencyClassId = 0,
  depthWriteFlag = 1,
  renderOrder = null
} = {}) {
  const summary = summarizeWebGpuMarchingCubesExtensionExecution(extensionExecution);
  if (summary.extensionOk !== true) {
    return {
      schema: ULG_SPH_WEBGPU_MARCHING_CUBES_EXTENSION_TRANSLATION_SCHEMA,
      status: 'extension-surface-translation-blocked',
      reason: summary.reason || summary.extensionStatus || 'extension surface execution was not successful',
      summary,
      surfaceVertices: null,
      surfaceDraw: null
    };
  }
  if (summary.extensionVertexCount === 0) {
    return {
      schema: ULG_SPH_WEBGPU_MARCHING_CUBES_EXTENSION_TRANSLATION_SCHEMA,
      status: 'extension-surface-translation-empty',
      reason: null,
      summary,
      surfaceVertices: {
        schema: ULG_SPH_GPU_RENDER_SURFACE_VERTICES_SCHEMA,
        backend: 'cpu-reference',
        status: 'surface-vertices-empty',
        vertexRows: new Float32Array(),
        vertexCount: 0,
        triangleCount: 0,
        surfaces: [],
        rowLayout: [...SPH_GPU_RENDER_SURFACE_VERTEX_ROW_LAYOUT],
        rowStrideFloats: SPH_GPU_RENDER_SURFACE_VERTEX_ROW_LAYOUT.length
      },
      surfaceDraw: {
        schema: ULG_SPH_GPU_RENDER_SURFACE_DRAW_SCHEMA,
        backend: 'cpu-reference',
        status: 'surface-draw-metadata-empty',
        drawRows: new Float32Array(),
        drawIndirectSchema: ULG_SPH_GPU_RENDER_SURFACE_DRAW_INDIRECT_SCHEMA,
        drawIndirectRows: new Uint32Array(),
        surfaces: []
      }
    };
  }
  const sourceRows = positionRows
    || extensionExecution?.result?.positionRows
    || extensionExecution?.result?.compactPositionRows
    || null;
  if (!(sourceRows instanceof Float32Array)) {
    return {
      schema: ULG_SPH_WEBGPU_MARCHING_CUBES_EXTENSION_TRANSLATION_SCHEMA,
      status: 'extension-surface-translation-needs-position-readback-or-gpu-kernel',
      reason: 'extension output retained a compact position GPUBuffer without CPU position rows',
      summary,
      surfaceVertices: null,
      surfaceDraw: null,
      sourceBufferRetained: summary.extensionBufferRetained,
      hotLoopGpuTranslationRequired: true
    };
  }
  const sourceStride = Math.max(1, Math.round(finiteNumber(summary.extensionVertexStrideFloats, 4)));
  const vertexCount = summary.extensionVertexCount;
  if (sourceRows.length < vertexCount * sourceStride) {
    throw new RangeError('extension compact position rows are shorter than declared vertexCount');
  }
  const resolvedSurfaceIndex = Math.max(0, Math.round(finiteNumber(surfaceIndex, 0)));
  const resolvedMaterialId = finiteNumber(materialId, 0);
  const resolvedPhaseId = finiteNumber(phaseId, 0);
  const resolvedOpticalStateId = finiteNumber(opticalStateId, 0);
  const resolvedDensity = finiteNumber(density, 0);
  const resolvedIsolation = isolation == null
    ? finiteNumber(extensionExecution?.result?.isovalue ?? extensionExecution?.isovalue, 0)
    : finiteNumber(isolation, 0);
  const resolvedFallbackNormal = normalizeVector3(fallbackNormal);
  const triangleCount = Math.floor(vertexCount / 3);
  const alignedVertexCount = triangleCount * 3;
  const vertexRows = new Float32Array(alignedVertexCount * SPH_GPU_RENDER_SURFACE_VERTEX_ROW_LAYOUT.length);
  const positions = [];
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (let index = 0; index < alignedVertexCount; index += 1) {
    const sourceOffset = index * sourceStride;
    const p = [
      finiteNumber(sourceRows[sourceOffset], 0),
      finiteNumber(sourceRows[sourceOffset + 1], 0),
      finiteNumber(sourceRows[sourceOffset + 2], 0)
    ];
    positions.push(p);
    for (let axis = 0; axis < 3; axis += 1) {
      min[axis] = Math.min(min[axis], p[axis]);
      max[axis] = Math.max(max[axis], p[axis]);
    }
  }
  for (let triangleIndex = 0; triangleIndex < triangleCount; triangleIndex += 1) {
    const vertexBase = triangleIndex * 3;
    const normal = triangleNormal(
      positions[vertexBase],
      positions[vertexBase + 1],
      positions[vertexBase + 2],
      resolvedFallbackNormal
    );
    for (let localVertex = 0; localVertex < 3; localVertex += 1) {
      const vertexIndex = vertexBase + localVertex;
      const p = positions[vertexIndex];
      const rowOffset = vertexIndex * SPH_GPU_RENDER_SURFACE_VERTEX_ROW_LAYOUT.length;
      vertexRows.set([
        resolvedSurfaceIndex,
        resolvedMaterialId,
        resolvedPhaseId,
        triangleIndex,
        vertexIndex,
        p[0],
        p[1],
        p[2],
        normal[0],
        normal[1],
        normal[2],
        resolvedOpticalStateId,
        resolvedDensity,
        resolvedIsolation,
        finiteNumber(sourceVoxelLinearIndex, 0) + triangleIndex,
        1
      ], rowOffset);
    }
  }
  const boundsCenterM = alignedVertexCount > 0
    ? [(min[0] + max[0]) * 0.5, (min[1] + max[1]) * 0.5, (min[2] + max[2]) * 0.5]
    : [0, 0, 0];
  const boundsRadiusM = alignedVertexCount > 0
    ? Math.hypot(max[0] - boundsCenterM[0], max[1] - boundsCenterM[1], max[2] - boundsCenterM[2])
    : 0;
  const surface = {
    surfaceKey: surfaceKey || `extension-surface-${resolvedSurfaceIndex}`,
    material,
    phase,
    renderKey,
    surfaceIndex: resolvedSurfaceIndex,
    materialId: resolvedMaterialId,
    phaseId: resolvedPhaseId,
    opticalStateId: resolvedOpticalStateId,
    vertexOffset: 0,
    vertexCount: alignedVertexCount,
    triangleOffset: 0,
    triangleCount,
    renderOrder: renderOrder == null ? resolvedSurfaceIndex : finiteNumber(renderOrder, resolvedSurfaceIndex),
    transparencyClassId: finiteNumber(transparencyClassId, 0),
    depthWriteFlag: finiteNumber(depthWriteFlag, 1),
    boundsCenterM,
    boundsRadiusM,
    status: alignedVertexCount > 0 ? 'surface-draw-ready' : 'surface-draw-empty'
  };
  const drawRows = new Float32Array(SPH_GPU_RENDER_SURFACE_DRAW_ROW_LAYOUT.length);
  const drawIndirectRows = new Uint32Array(SPH_GPU_RENDER_SURFACE_DRAW_INDIRECT_ROW_LAYOUT.length);
  writeSurfaceDrawRow(drawRows, 0, {
    ...surface,
    status: alignedVertexCount > 0 ? 1 : 0
  });
  writeSurfaceDrawIndirectRow(drawIndirectRows, 0, {
    vertexCount: alignedVertexCount,
    instanceCount: alignedVertexCount > 0 ? 1 : 0,
    firstVertex: 0,
    firstInstance: resolvedSurfaceIndex
  });
  const surfaceVertices = {
    schema: ULG_SPH_GPU_RENDER_SURFACE_VERTICES_SCHEMA,
    backend: 'cpu-reference',
    status: alignedVertexCount > 0 ? 'surface-vertices-ready' : 'surface-vertices-empty',
    sourceSurfaceExecutionSchema: summary.extensionExecutionSchema,
    sourceSurfaceSchema: summary.extensionSurfaceSchema,
    surfaceExtractionMethod: 'webgpu-marching-cubes-extension-compact-position-translation',
    compactionMode: 'extension-compact-position-to-ulg-rows',
    rowLayout: [...SPH_GPU_RENDER_SURFACE_VERTEX_ROW_LAYOUT],
    rowStrideFloats: SPH_GPU_RENDER_SURFACE_VERTEX_ROW_LAYOUT.length,
    vertexRows,
    vertexCount: alignedVertexCount,
    triangleCount,
    surfaces: [surface],
    surfaceVertexReadback: true,
    scientificValidation: false,
    sphValidation: false,
    surfaceExtractionValidation: false,
    fullPhysicsValidation: false
  };
  const surfaceDraw = {
    schema: ULG_SPH_GPU_RENDER_SURFACE_DRAW_SCHEMA,
    backend: 'cpu-reference',
    status: alignedVertexCount > 0 ? 'surface-draw-metadata-ready' : 'surface-draw-metadata-empty',
    sourceSurfaceVertexSchema: surfaceVertices.schema,
    sourceSurfaceVertexBackend: surfaceVertices.backend,
    surfaceCount: 1,
    activeSurfaceCount: alignedVertexCount > 0 ? 1 : 0,
    vertexCount: alignedVertexCount,
    triangleCount,
    rowLayout: [...SPH_GPU_RENDER_SURFACE_DRAW_ROW_LAYOUT],
    rowStrideFloats: SPH_GPU_RENDER_SURFACE_DRAW_ROW_LAYOUT.length,
    drawRows,
    drawRowsByteLength: drawRows.byteLength,
    drawIndirectSchema: ULG_SPH_GPU_RENDER_SURFACE_DRAW_INDIRECT_SCHEMA,
    drawIndirectRowLayout: [...SPH_GPU_RENDER_SURFACE_DRAW_INDIRECT_ROW_LAYOUT],
    drawIndirectRowStrideUints: SPH_GPU_RENDER_SURFACE_DRAW_INDIRECT_ROW_LAYOUT.length,
    drawIndirectRows,
    drawIndirectRowsByteLength: drawIndirectRows.byteLength,
    compactionMode: 'extension-compact-position-to-ulg-draw-metadata',
    surfaces: [surface],
    scientificValidation: false,
    sphValidation: false,
    surfaceExtractionValidation: false,
    fullPhysicsValidation: false
  };
  return {
    schema: ULG_SPH_WEBGPU_MARCHING_CUBES_EXTENSION_TRANSLATION_SCHEMA,
    status: alignedVertexCount > 0
      ? 'extension-surface-translated-to-ulg-rows'
      : 'extension-surface-translation-empty',
    reason: vertexCount !== alignedVertexCount
      ? 'extension vertexCount was not divisible by 3; trailing vertices were ignored'
      : null,
    summary,
    sourceVertexCount: vertexCount,
    translatedVertexCount: alignedVertexCount,
    ignoredTrailingVertexCount: vertexCount - alignedVertexCount,
    surfaceVertices,
    surfaceDraw,
    hotLoopGpuTranslationRequired: false
  };
}

export async function buildWebGpuMarchingCubesExtensionSurfaceRowsWebGpu({
  device,
  extensionExecution,
  surfaceIndex = 0,
  materialId = 0,
  phaseId = 0,
  opticalStateId = 0,
  material = null,
  phase = null,
  renderKey = null,
  surfaceKey = null,
  density = 0,
  isolation = null,
  sourceVoxelLinearIndex = 0,
  fallbackNormal = [0, 1, 0],
  transparencyClassId = 0,
  depthWriteFlag = 1,
  renderOrder = null,
  readbackMode = NO_FULL_READBACK_MODE,
  compactSummaryReadback = false,
  retainVertexRowsBuffer = true,
  retainDrawRowsBuffer = true,
  retainDrawIndirectRowsBuffer = true,
  waitForQueueCompletion = true,
  onProgress = null
} = {}) {
  if (!device?.createBuffer || !device.queue?.writeBuffer) {
    throw new TypeError('buildWebGpuMarchingCubesExtensionSurfaceRowsWebGpu requires a WebGPU-like device');
  }
  const summary = summarizeWebGpuMarchingCubesExtensionExecution(extensionExecution);
  if (summary.extensionOk !== true) {
    throw new TypeError(summary.reason || 'extension surface execution was not successful');
  }
  const sourceBuffer = compactPositionRowsSource(extensionExecution?.result || null).buffer;
  if (!sourceBuffer || summary.extensionBufferRetained !== true) {
    throw new TypeError('buildWebGpuMarchingCubesExtensionSurfaceRowsWebGpu requires a retained extension surface buffer');
  }
  assertSameDeviceExtensionSurfaceBuffer(extensionExecution);

  const noFullReadback = readbackMode === NO_FULL_READBACK_MODE;
  const sourceStrideFloats = Math.max(3, Math.round(finiteNumber(summary.extensionVertexStrideFloats, 4)));
  const sourceVertexCount = Math.max(0, Math.round(finiteNumber(summary.extensionVertexCount, 0)));
  const triangleCount = Math.floor(sourceVertexCount / 3);
  const translatedVertexCount = triangleCount * 3;
  const resolvedSurfaceIndex = Math.max(0, Math.round(finiteNumber(surfaceIndex, 0)));
  const resolvedMaterialId = finiteNumber(materialId, 0);
  const resolvedPhaseId = finiteNumber(phaseId, 0);
  const resolvedOpticalStateId = finiteNumber(opticalStateId, 0);
  const resolvedDensity = finiteNumber(density, 0);
  const resolvedIsolation = isolation == null
    ? finiteNumber(extensionExecution?.result?.isovalue ?? extensionExecution?.isovalue, 0)
    : finiteNumber(isolation, 0);
  const resolvedFallbackNormal = normalizeVector3(fallbackNormal);
  const resolvedRenderOrder = renderOrder == null
    ? resolvedSurfaceIndex
    : finiteNumber(renderOrder, resolvedSurfaceIndex);
  const resolvedTransparencyClassId = finiteNumber(transparencyClassId, 0);
  const resolvedDepthWriteFlag = finiteNumber(depthWriteFlag, 1);
  const vertexRowsByteLength = translatedVertexCount
    * SPH_GPU_RENDER_SURFACE_VERTEX_ROW_LAYOUT.length
    * Float32Array.BYTES_PER_ELEMENT;
  const drawRowsByteLength = SPH_GPU_RENDER_SURFACE_DRAW_ROW_LAYOUT.length * Float32Array.BYTES_PER_ELEMENT;
  const drawIndirectRowsByteLength = SPH_GPU_RENDER_SURFACE_DRAW_INDIRECT_ROW_LAYOUT.length * Uint32Array.BYTES_PER_ELEMENT;
  const markProgress = typeof onProgress === 'function'
    ? (status, extra = {}) => {
      try {
        onProgress({
          status,
          stage: 'webgpu-marching-cubes-extension-surface-translation',
          sourceVertexCount,
          translatedVertexCount,
          triangleCount,
          vertexRowsByteLength,
          drawRowsByteLength,
          drawIndirectRowsByteLength,
          readbackMode: noFullReadback ? NO_FULL_READBACK_MODE : FULL_READBACK_MODE,
          compactSummaryReadback: Boolean(compactSummaryReadback),
          ...extra
        });
      } catch {
        // Progress hooks are diagnostic-only and must not affect GPU execution.
      }
    }
    : () => {};
  markProgress('extension-surface-translation-kernel-started');

  const vertexRowsBuffer = device.createBuffer({
    label: 'ulg-sph-extension-surface-vertices',
    size: Math.max(4, vertexRowsByteLength),
    usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_SRC | GPU_BUFFER_USAGE.COPY_DST
  });
  if (vertexRowsByteLength > 0) {
    device.queue.writeBuffer(
      vertexRowsBuffer,
      0,
      new Float32Array(translatedVertexCount * SPH_GPU_RENDER_SURFACE_VERTEX_ROW_LAYOUT.length)
    );
  }
  const drawRowsBuffer = device.createBuffer({
    label: 'ulg-sph-extension-surface-draw',
    size: Math.max(4, drawRowsByteLength),
    usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_SRC | GPU_BUFFER_USAGE.COPY_DST
  });
  device.queue.writeBuffer(drawRowsBuffer, 0, new Float32Array(SPH_GPU_RENDER_SURFACE_DRAW_ROW_LAYOUT.length));
  const drawIndirectRowsBuffer = device.createBuffer({
    label: 'ulg-sph-extension-surface-draw-indirect',
    size: Math.max(4, drawIndirectRowsByteLength),
    usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.INDIRECT | GPU_BUFFER_USAGE.COPY_SRC | GPU_BUFFER_USAGE.COPY_DST
  });
  device.queue.writeBuffer(drawIndirectRowsBuffer, 0, new Uint32Array(SPH_GPU_RENDER_SURFACE_DRAW_INDIRECT_ROW_LAYOUT.length));
  const paramsBuffer = device.createBuffer({
    label: 'ulg-sph-extension-surface-translation-params',
    size: 64,
    usage: GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST
  });
  device.queue.writeBuffer(paramsBuffer, 0, createExtensionSurfaceTranslationParamsArray({
    vertexCount: sourceVertexCount,
    sourceStrideFloats,
    surfaceIndex: resolvedSurfaceIndex,
    triangleCount,
    materialId: resolvedMaterialId,
    phaseId: resolvedPhaseId,
    opticalStateId: resolvedOpticalStateId,
    density: resolvedDensity,
    isolation: resolvedIsolation,
    sourceVoxelLinearIndex,
    transparencyClassId: resolvedTransparencyClassId,
    depthWriteFlag: resolvedDepthWriteFlag,
    renderOrder: resolvedRenderOrder,
    fallbackNormal: resolvedFallbackNormal
  }));
  markProgress('extension-surface-translation-buffers-ready');

  const module = device.createShaderModule({
    label: 'ulg-sph-webgpu-marching-cubes-extension-surface-translation',
    code: webGpuMarchingCubesExtensionSurfaceRowsWgsl
  });
  const { pipeline, bindGroupLayout } = createExplicitComputePipeline(device, {
    label: 'ulg-sph-webgpu-marching-cubes-extension-surface-translation',
    module,
    entryPoint: 'main',
    bindings: [
      computeBufferBinding(0, 'read-only-storage'),
      computeBufferBinding(1, 'storage'),
      computeBufferBinding(2, 'storage'),
      computeBufferBinding(3, 'storage'),
      computeBufferBinding(4, 'uniform')
    ]
  });
  const bindGroup = device.createBindGroup({
    layout: bindGroupLayout,
    entries: [
      { binding: 0, resource: { buffer: sourceBuffer } },
      { binding: 1, resource: { buffer: vertexRowsBuffer } },
      { binding: 2, resource: { buffer: drawRowsBuffer } },
      { binding: 3, resource: { buffer: drawIndirectRowsBuffer } },
      { binding: 4, resource: { buffer: paramsBuffer } }
    ]
  });
  const encoder = device.createCommandEncoder();
  const pass = encoder.beginComputePass();
  pass.setPipeline(pipeline);
  pass.setBindGroup(0, bindGroup);
  const workgroupCountX = Math.max(1, Math.ceil(Math.max(1, triangleCount) / EXTENSION_SURFACE_TRANSLATION_WORKGROUP_SIZE));
  pass.dispatchWorkgroups(workgroupCountX);
  pass.end();
  markProgress('extension-surface-translation-command-encoded', { workgroupCountX });

  let vertexRows = new Float32Array();
  let drawRows = new Float32Array();
  let drawIndirectRows = new Uint32Array();
  let summaryReadback = false;
  let summaryReadbackByteLength = 0;
  let queueCompletionStatus = 'not-submitted';
  let queueCompletionMethod = null;
  let deferNoFullCleanup = false;
  if (!noFullReadback) {
    device.queue.submit([encoder.finish()]);
    queueCompletionStatus = 'queue-submitted';
    queueCompletionMethod = 'queue.submit';
    if (vertexRowsByteLength > 0) {
      vertexRows = new Float32Array(await readBuffer(
        device,
        vertexRowsBuffer,
        vertexRowsByteLength,
        'ulg-sph-extension-surface-vertex-readback'
      ));
    }
    drawRows = new Float32Array(await readBuffer(
      device,
      drawRowsBuffer,
      drawRowsByteLength,
      'ulg-sph-extension-surface-draw-readback'
    ));
    drawIndirectRows = new Uint32Array(await readBuffer(
      device,
      drawIndirectRowsBuffer,
      drawIndirectRowsByteLength,
      'ulg-sph-extension-surface-draw-indirect-readback'
    ));
    queueCompletionStatus = 'readback-map-completed';
    queueCompletionMethod = 'mapAsync(readback-buffer)';
    markProgress('extension-surface-translation-full-readback-complete');
  } else {
    if (waitForQueueCompletion && device.queue?.onSubmittedWorkDone) {
      device.queue.submit([encoder.finish()]);
      queueCompletionStatus = 'queue-submitted';
      queueCompletionMethod = 'queue.submit';
      await device.queue.onSubmittedWorkDone();
      queueCompletionStatus = 'queue-work-completed';
      queueCompletionMethod = 'queue.onSubmittedWorkDone';
    } else {
      device.queue.submit([encoder.finish()]);
      queueCompletionStatus = device.queue?.onSubmittedWorkDone && !compactSummaryReadback
        ? 'queue-submitted-cleanup-deferred'
        : 'queue-submitted-no-explicit-completion';
      queueCompletionMethod = device.queue?.onSubmittedWorkDone && !compactSummaryReadback
        ? 'deferred queue.onSubmittedWorkDone cleanup'
        : 'queue.submit';
      deferNoFullCleanup = Boolean(device.queue?.onSubmittedWorkDone && !compactSummaryReadback);
    }
    if (compactSummaryReadback) {
      drawRows = new Float32Array(await readBuffer(
        device,
        drawRowsBuffer,
        drawRowsByteLength,
        'ulg-sph-extension-surface-draw-summary-readback'
      ));
      summaryReadback = true;
      summaryReadbackByteLength = drawRowsByteLength;
      queueCompletionStatus = 'compact-summary-readback-map-completed';
      queueCompletionMethod = 'mapAsync(compact-summary-readback-buffer)';
    }
  }

  const cleanup = () => {
    paramsBuffer.destroy?.();
  };
  const keepVertexRowsBuffer = retainVertexRowsBuffer || noFullReadback;
  const keepDrawRowsBuffer = retainDrawRowsBuffer || noFullReadback;
  const keepDrawIndirectRowsBuffer = retainDrawIndirectRowsBuffer || noFullReadback;
  if (!keepVertexRowsBuffer) vertexRowsBuffer.destroy?.();
  if (!keepDrawRowsBuffer) drawRowsBuffer.destroy?.();
  if (!keepDrawIndirectRowsBuffer) drawIndirectRowsBuffer.destroy?.();
  if (deferNoFullCleanup) {
    deferSubmittedWorkCleanup(device, cleanup);
  } else {
    cleanup();
  }

  const surfaceStatus = (!noFullReadback || compactSummaryReadback)
    ? (triangleCount > 0 ? 'surface-draw-ready' : 'surface-draw-empty')
    : 'surface-draw-summary-not-read';
  const surface = extensionSurfaceMetadata({
    surfaceIndex: resolvedSurfaceIndex,
    materialId: resolvedMaterialId,
    phaseId: resolvedPhaseId,
    opticalStateId: resolvedOpticalStateId,
    material,
    phase,
    renderKey,
    surfaceKey,
    vertexCount: noFullReadback && !compactSummaryReadback ? null : translatedVertexCount,
    triangleCount: noFullReadback && !compactSummaryReadback ? null : triangleCount,
    renderOrder: resolvedRenderOrder,
    transparencyClassId: resolvedTransparencyClassId,
    depthWriteFlag: resolvedDepthWriteFlag,
    status: surfaceStatus
  });
  const surfaceVertices = {
    schema: ULG_SPH_GPU_RENDER_SURFACE_VERTICES_SCHEMA,
    backend: 'webgpu',
    status: noFullReadback ? 'surface-vertices-resident-extension-compact-translation' : (translatedVertexCount > 0 ? 'surface-vertices-ready' : 'surface-vertices-empty'),
    sourceSurfaceExecutionSchema: summary.extensionExecutionSchema,
    sourceSurfaceSchema: summary.extensionSurfaceSchema,
    surfaceExtractionMethod: 'webgpu-marching-cubes-extension-compact-position-gpu-translation',
    compactionMode: 'webgpu-extension-compact-position-to-ulg-rows',
    surfaceCount: 1,
    rowLayout: [...SPH_GPU_RENDER_SURFACE_VERTEX_ROW_LAYOUT],
    rowStrideFloats: SPH_GPU_RENDER_SURFACE_VERTEX_ROW_LAYOUT.length,
    vertexRows,
    vertexRowsByteLength: vertexRows.byteLength,
    vertexCount: noFullReadback ? null : translatedVertexCount,
    triangleCount: noFullReadback ? null : triangleCount,
    maxVertexRows: translatedVertexCount,
    vertexRowsBufferByteLength: keepVertexRowsBuffer ? vertexRowsByteLength : 0,
    vertexRowsBufferRowCount: keepVertexRowsBuffer ? translatedVertexCount : 0,
    vertexRowsBufferRetained: keepVertexRowsBuffer,
    sourceVertexCount,
    translatedVertexCount,
    ignoredTrailingVertexCount: sourceVertexCount - translatedVertexCount,
    sourceVertexRowsBufferBound: true,
    sourceVertexFormat: summary.extensionVertexFormat,
    sourceVertexStrideFloats: sourceStrideFloats,
    readbackMode: noFullReadback ? NO_FULL_READBACK_MODE : FULL_READBACK_MODE,
    queueCompletionStatus,
    queueCompletionMethod,
    surfaceVertexReadback: !noFullReadback,
    surfaces: [surface],
    scientificValidation: false,
    sphValidation: false,
    surfaceExtractionValidation: false,
    fullPhysicsValidation: false
  };
  if (keepVertexRowsBuffer) surfaceVertices.vertexRowsBuffer = vertexRowsBuffer;

  const surfaceDraw = {
    schema: ULG_SPH_GPU_RENDER_SURFACE_DRAW_SCHEMA,
    backend: 'webgpu',
    status: noFullReadback ? 'surface-draw-resident-extension-compact-translation' : (triangleCount > 0 ? 'surface-draw-metadata-ready' : 'surface-draw-metadata-empty'),
    sourceSurfaceVertexSchema: surfaceVertices.schema,
    sourceSurfaceVertexBackend: surfaceVertices.backend,
    surfaceCount: 1,
    activeSurfaceCount: noFullReadback && !compactSummaryReadback ? null : (triangleCount > 0 ? 1 : 0),
    vertexCount: noFullReadback && !compactSummaryReadback ? null : translatedVertexCount,
    triangleCount: noFullReadback && !compactSummaryReadback ? null : triangleCount,
    rowLayout: [...SPH_GPU_RENDER_SURFACE_DRAW_ROW_LAYOUT],
    rowStrideFloats: SPH_GPU_RENDER_SURFACE_DRAW_ROW_LAYOUT.length,
    drawRows,
    drawRowsByteLength,
    drawRowsBufferByteLength: keepDrawRowsBuffer ? drawRowsByteLength : 0,
    drawRowsBufferRetained: keepDrawRowsBuffer,
    drawIndirectSchema: ULG_SPH_GPU_RENDER_SURFACE_DRAW_INDIRECT_SCHEMA,
    drawIndirectRowLayout: [...SPH_GPU_RENDER_SURFACE_DRAW_INDIRECT_ROW_LAYOUT],
    drawIndirectRowStrideUints: SPH_GPU_RENDER_SURFACE_DRAW_INDIRECT_ROW_LAYOUT.length,
    drawIndirectRows,
    drawIndirectRowsByteLength,
    drawIndirectRowsBufferByteLength: keepDrawIndirectRowsBuffer ? drawIndirectRowsByteLength : 0,
    drawIndirectRowsBufferRetained: keepDrawIndirectRowsBuffer,
    compactedVertexRows: noFullReadback ? new Float32Array() : vertexRows,
    compactedVertexRowsByteLength: noFullReadback ? 0 : vertexRows.byteLength,
    compactedVertexRowsBufferByteLength: keepVertexRowsBuffer ? vertexRowsByteLength : 0,
    compactedVertexRowsBufferRetained: keepVertexRowsBuffer,
    sourceVertexRowCount: translatedVertexCount,
    sourceVertexRowsBufferBound: true,
    readbackMode: noFullReadback ? NO_FULL_READBACK_MODE : FULL_READBACK_MODE,
    queueCompletionStatus,
    queueCompletionMethod,
    surfaceDrawReadback: !noFullReadback,
    surfaceDrawSummaryReadback: summaryReadback,
    surfaceDrawSummaryReadbackByteLength: summaryReadbackByteLength,
    fullSurfaceDrawReadback: !noFullReadback,
    compactionMode: 'webgpu-extension-compact-position-to-ulg-draw-metadata',
    surfaces: [surface],
    scientificValidation: false,
    sphValidation: false,
    surfaceExtractionValidation: false,
    fullPhysicsValidation: false
  };
  if (keepDrawRowsBuffer) surfaceDraw.drawRowsBuffer = drawRowsBuffer;
  if (keepDrawIndirectRowsBuffer) surfaceDraw.drawIndirectRowsBuffer = drawIndirectRowsBuffer;
  if (keepVertexRowsBuffer) surfaceDraw.compactedVertexRowsBuffer = vertexRowsBuffer;

  const leaseLedger = createResidentBufferLeaseLedger({
    ledgerId: `sph-extension-surface:${resolvedSurfaceIndex}:${translatedVertexCount}:buffer-leases`,
    stateKey: 'sph-extension-surface',
    scope: 'sph-extension-surface-buffer-leases'
  });
  const leaseIds = [];
  const registerRetainedBuffer = ({ resourceKey, resourceKind, buffer, byteLength, rowCount, expectedConsumers }) => {
    registerResidentBufferResource(leaseLedger, {
      resourceKey,
      resourceKind,
      stateFamily: 'render-surface',
      ownerStage: 'webgpu-marching-cubes-extension-surface-translation',
      producerStage: 'webgpu-marching-cubes-extension-surface-translation',
      source: 'buildWebGpuMarchingCubesExtensionSurfaceRowsWebGpu',
      status: 'resident-extension-surface-buffer-retained',
      retained: true,
      byteLength,
      rowCount,
      bufferLabel: buffer?.label,
      expectedConsumers
    });
    const lease = addResidentBufferLease(leaseLedger, {
      resourceKey,
      consumerStage: expectedConsumers?.[0] || 'surface-renderer',
      reason: 'retained-extension-surface-buffer'
    });
    leaseIds.push(lease.leaseId);
  };
  const vertexRowsResourceKey = `extension-surface:vertex-rows:${translatedVertexCount}:${vertexRowsByteLength}`;
  const drawRowsResourceKey = `extension-surface:draw-rows:1:${drawRowsByteLength}`;
  const drawIndirectRowsResourceKey = `extension-surface:draw-indirect:1:${drawIndirectRowsByteLength}`;
  if (keepVertexRowsBuffer) {
    registerRetainedBuffer({
      resourceKey: vertexRowsResourceKey,
      resourceKind: 'extension-surface-vertex-rows-buffer',
      buffer: vertexRowsBuffer,
      byteLength: vertexRowsByteLength,
      rowCount: translatedVertexCount,
      expectedConsumers: ['surface-draw-renderer', 'diagnostics']
    });
  }
  if (keepDrawRowsBuffer) {
    registerRetainedBuffer({
      resourceKey: drawRowsResourceKey,
      resourceKind: 'extension-surface-draw-rows-buffer',
      buffer: drawRowsBuffer,
      byteLength: drawRowsByteLength,
      rowCount: 1,
      expectedConsumers: ['surface-draw-renderer', 'diagnostics']
    });
  }
  if (keepDrawIndirectRowsBuffer) {
    registerRetainedBuffer({
      resourceKey: drawIndirectRowsResourceKey,
      resourceKind: 'extension-surface-draw-indirect-buffer',
      buffer: drawIndirectRowsBuffer,
      byteLength: drawIndirectRowsByteLength,
      rowCount: 1,
      expectedConsumers: ['surface-draw-renderer', 'diagnostics']
    });
  }

  const result = {
    schema: ULG_SPH_WEBGPU_MARCHING_CUBES_EXTENSION_TRANSLATION_SCHEMA,
    status: noFullReadback
      ? 'extension-surface-translated-resident-webgpu'
      : 'extension-surface-translated-to-ulg-rows',
    reason: sourceVertexCount !== translatedVertexCount
      ? 'extension vertexCount was not divisible by 3; trailing vertices were ignored'
      : null,
    backend: 'webgpu',
    summary,
    sourceBufferBound: true,
    sourceBufferRetained: summary.extensionBufferRetained,
    sourceVertexCount,
    translatedVertexCount,
    triangleCount,
    ignoredTrailingVertexCount: sourceVertexCount - translatedVertexCount,
    sourceVertexFormat: summary.extensionVertexFormat,
    sourceVertexStrideFloats: sourceStrideFloats,
    surfaceVertices,
    surfaceDraw,
    readbackMode: noFullReadback ? NO_FULL_READBACK_MODE : FULL_READBACK_MODE,
    queueCompletionStatus,
    queueCompletionMethod,
    hotLoopGpuTranslationRequired: false,
    residentBufferLeaseLedger: leaseLedger,
    residentBufferLeaseSummary: summarizeResidentBufferLeaseLedger(leaseLedger),
    residentBufferLeaseLedgerStatus: leaseLedger.status,
    residentBufferLeaseResourceCount: leaseLedger.resourceCount,
    residentBufferLeaseActiveLeaseCount: leaseLedger.activeLeaseCount
  };
  const refreshLeaseSummary = () => {
    result.residentBufferLeaseSummary = summarizeResidentBufferLeaseLedger(leaseLedger);
    result.residentBufferLeaseLedgerStatus = result.residentBufferLeaseSummary.status;
    result.residentBufferLeaseResourceCount = result.residentBufferLeaseSummary.resourceCount;
    result.residentBufferLeaseActiveLeaseCount = result.residentBufferLeaseSummary.activeLeaseCount;
    surfaceVertices.residentBufferLeaseSummary = result.residentBufferLeaseSummary;
    surfaceVertices.residentBufferLeaseLedgerStatus = result.residentBufferLeaseLedgerStatus;
    surfaceVertices.residentBufferLeaseResourceCount = result.residentBufferLeaseResourceCount;
    surfaceVertices.residentBufferLeaseActiveLeaseCount = result.residentBufferLeaseActiveLeaseCount;
    surfaceDraw.residentBufferLeaseSummary = result.residentBufferLeaseSummary;
    surfaceDraw.residentBufferLeaseLedgerStatus = result.residentBufferLeaseLedgerStatus;
    surfaceDraw.residentBufferLeaseResourceCount = result.residentBufferLeaseResourceCount;
    surfaceDraw.residentBufferLeaseActiveLeaseCount = result.residentBufferLeaseActiveLeaseCount;
    return result.residentBufferLeaseSummary;
  };
  const destroyedResourceKeys = new Set();
  const destroyBufferOnce = (resourceKey, buffer) => {
    if (destroyedResourceKeys.has(resourceKey)) return;
    destroyedResourceKeys.add(resourceKey);
    buffer?.destroy?.();
  };
  result.releaseExtensionSurfaceBufferLeases = ({ status = 'released' } = {}) => {
    for (const leaseId of leaseIds) {
      releaseResidentBufferLease(leaseLedger, leaseId, { status });
    }
    return refreshLeaseSummary();
  };
  result.destroyExtensionSurfaceBuffers = ({
    force = false,
    releaseLeases = false,
    reason = 'extension-surface-buffer-cleanup'
  } = {}) => {
    if (releaseLeases) result.releaseExtensionSurfaceBufferLeases();
    if (keepVertexRowsBuffer) {
      destroyResidentBufferWithLease(leaseLedger, vertexRowsResourceKey, () => {
        destroyBufferOnce(vertexRowsResourceKey, vertexRowsBuffer);
      }, { force, reason });
    }
    if (keepDrawRowsBuffer) {
      destroyResidentBufferWithLease(leaseLedger, drawRowsResourceKey, () => {
        destroyBufferOnce(drawRowsResourceKey, drawRowsBuffer);
      }, { force, reason });
    }
    if (keepDrawIndirectRowsBuffer) {
      destroyResidentBufferWithLease(leaseLedger, drawIndirectRowsResourceKey, () => {
        destroyBufferOnce(drawIndirectRowsResourceKey, drawIndirectRowsBuffer);
      }, { force, reason });
    }
    return refreshLeaseSummary();
  };
  surfaceVertices.residentBufferLeaseLedger = leaseLedger;
  surfaceVertices.residentBufferLeaseSummary = result.residentBufferLeaseSummary;
  surfaceVertices.residentBufferLeaseLedgerStatus = result.residentBufferLeaseLedgerStatus;
  surfaceVertices.residentBufferLeaseResourceCount = result.residentBufferLeaseResourceCount;
  surfaceVertices.residentBufferLeaseActiveLeaseCount = result.residentBufferLeaseActiveLeaseCount;
  surfaceVertices.releaseExtensionSurfaceBufferLeases = result.releaseExtensionSurfaceBufferLeases;
  surfaceVertices.destroyExtensionSurfaceBuffers = result.destroyExtensionSurfaceBuffers;
  surfaceVertices.releaseSurfaceVertexBufferLeases = result.releaseExtensionSurfaceBufferLeases;
  surfaceVertices.destroySurfaceVertexBuffers = result.destroyExtensionSurfaceBuffers;
  surfaceDraw.residentBufferLeaseLedger = leaseLedger;
  surfaceDraw.residentBufferLeaseSummary = result.residentBufferLeaseSummary;
  surfaceDraw.residentBufferLeaseLedgerStatus = result.residentBufferLeaseLedgerStatus;
  surfaceDraw.residentBufferLeaseResourceCount = result.residentBufferLeaseResourceCount;
  surfaceDraw.residentBufferLeaseActiveLeaseCount = result.residentBufferLeaseActiveLeaseCount;
  surfaceDraw.releaseExtensionSurfaceBufferLeases = result.releaseExtensionSurfaceBufferLeases;
  surfaceDraw.destroyExtensionSurfaceBuffers = result.destroyExtensionSurfaceBuffers;
  surfaceDraw.releaseSurfaceDrawBufferLeases = result.releaseExtensionSurfaceBufferLeases;
  surfaceDraw.destroySurfaceDrawBuffers = result.destroyExtensionSurfaceBuffers;
  return result;
}
