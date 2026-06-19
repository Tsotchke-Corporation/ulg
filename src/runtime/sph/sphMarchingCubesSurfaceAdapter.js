import {
  SPH_GPU_RENDER_FIELD_CELL_ROW_LAYOUT,
  SPH_GPU_RENDER_SURFACE_DRAW_INDIRECT_ROW_LAYOUT,
  SPH_GPU_RENDER_SURFACE_DRAW_ROW_LAYOUT,
  SPH_GPU_RENDER_SURFACE_VERTEX_ROW_LAYOUT,
  ULG_SPH_GPU_RENDER_FIELD_SCHEMA,
  ULG_SPH_GPU_RENDER_SURFACE_DRAW_INDIRECT_SCHEMA,
  ULG_SPH_GPU_RENDER_SURFACE_DRAW_SCHEMA,
  ULG_SPH_GPU_RENDER_SURFACE_VERTICES_SCHEMA
} from '../../../ulg-gpu-abi/src/index.js';
import { computeBufferBinding, createCachedExplicitComputePipeline, deferSubmittedWorkCleanup } from '../webgpuComputeLayout.js';
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
export const ULG_SPH_WEBGPU_MARCHING_CUBES_EXTENSION_PREFLIGHT_SCHEMA =
  'peercompute.ulg.sph-webgpu-marching-cubes-extension-preflight.v0';
export const WEBGPU_MARCHING_CUBES_SURFACE_EXECUTION_SCHEMA =
  'peercompute.webgpu-marching-cubes.surface-execution.v0';
export const WEBGPU_MARCHING_CUBES_PREFLIGHT_SCHEMA =
  'peercompute.webgpu-marching-cubes.surface-preflight.v0';
export const WEBGPU_MARCHING_CUBES_SURFACE_SCHEMA =
  'peercompute.webgpu-marching-cubes.surface.v0';
export const WEBGPU_MARCHING_CUBES_SURFACE_ROW_METADATA_SCHEMA =
  'peercompute.webgpu-marching-cubes.surface-row-metadata.v0';
export const WEBGPU_MARCHING_CUBES_SURFACE_OUTPUT_DESCRIPTOR_SCHEMA =
  'peercompute.webgpu-marching-cubes.surface-output-descriptor.v0';
export const WEBGPU_MARCHING_CUBES_COMPACT_POSITION_ROWS_SCHEMA =
  'peercompute.webgpu-marching-cubes.compact-position-rows.v0';
export const WEBGPU_MARCHING_CUBES_SURFACE_DRAW_ROWS_SCHEMA =
  'peercompute.webgpu-marching-cubes.surface-draw-rows.v0';
export const WEBGPU_MARCHING_CUBES_INDIRECT_DRAW_ROWS_SCHEMA =
  'peercompute.webgpu-marching-cubes.indirect-draw-rows.v0';
export const ULG_SPH_WEBGPU_MARCHING_CUBES_EXTENSION_TRANSLATION_SCHEMA =
  'peercompute.ulg.sph-webgpu-marching-cubes-extension-translation.v0';
export const ULG_SPH_WEBGPU_MARCHING_CUBES_BUFFER_VOLUME_DESCRIPTOR_SCHEMA =
  'peercompute.ulg.sph-webgpu-marching-cubes-buffer-volume-descriptor.v0';

export const ULG_MARCHING_CUBES_EXTENSION_POSITION_VERTEX_FORMAT = 'float32x4-position';
export const ULG_MARCHING_CUBES_REQUIRED_SURFACE_VERTEX_FORMAT =
  'peercompute.ulg.sph-gpu-render-surface-vertex-row.v0';
export const WEBGPU_MARCHING_CUBES_SCALAR_BUFFER_VOLUME_SOURCE = 'scalar-buffer';
export const WEBGPU_MARCHING_CUBES_SCALAR_BUFFER_LAYOUT_NAME =
  'peercompute.webgpu-marching-cubes.layout.scalar-field-f32.v0';

const FULL_READBACK_MODE = 'full-parity-readback';
const NO_FULL_READBACK_MODE = 'no-full-readback';
const GPU_BUFFER_USAGE = {
  MAP_READ: globalThis.GPUBufferUsage?.MAP_READ ?? 1,
  COPY_SRC: globalThis.GPUBufferUsage?.COPY_SRC ?? 4,
  COPY_DST: globalThis.GPUBufferUsage?.COPY_DST ?? 8,
  VERTEX: globalThis.GPUBufferUsage?.VERTEX ?? 32,
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
  position_scale_m: f32,
  position_origin_x_m: f32,
  position_origin_y_m: f32,
  position_origin_z_m: f32,
  position_grid_bias: f32,
  position_transform_enabled: f32,
  position_transform_pad0: f32,
  position_transform_pad1: f32,
  position_clamp_min_x_m: f32,
  position_clamp_min_y_m: f32,
  position_clamp_min_z_m: f32,
  position_clamp_max_x_m: f32,
  position_clamp_max_y_m: f32,
  position_clamp_max_z_m: f32,
  position_clamp_enabled: f32,
  position_clamp_pad0: f32,
  bounds_center_x_m: f32,
  bounds_center_y_m: f32,
  bounds_center_z_m: f32,
  bounds_radius_m: f32,
};

@group(0) @binding(0) var<storage, read> compact_position_rows: array<f32>;
@group(0) @binding(1) var<storage, read_write> surface_vertex_rows: array<f32>;
@group(0) @binding(2) var<storage, read_write> surface_draw_rows: array<f32>;
@group(0) @binding(3) var<storage, read_write> surface_draw_indirect_rows: array<u32>;
@group(0) @binding(4) var<uniform> params: SurfaceTranslationParams;
@group(0) @binding(5) var<storage, read> source_vertex_count_rows: array<u32>;

fn compact_position(vertex_index: u32) -> vec3<f32> {
  let offset = vertex_index * params.source_stride_floats;
  return vec3<f32>(
    compact_position_rows[offset + 0u],
    compact_position_rows[offset + 1u],
    compact_position_rows[offset + 2u]
  );
}

fn ulg_world_position(p: vec3<f32>) -> vec3<f32> {
  if (params.position_transform_enabled <= 0.5) {
    return p;
  }
  return vec3<f32>(
    params.position_origin_x_m,
    params.position_origin_y_m,
    params.position_origin_z_m
  ) + (p + vec3<f32>(params.position_grid_bias)) * params.position_scale_m;
}

fn clamp_world_position(p: vec3<f32>) -> vec3<f32> {
  if (params.position_clamp_enabled <= 0.5) {
    return p;
  }
  return clamp(
    p,
    vec3<f32>(
      params.position_clamp_min_x_m,
      params.position_clamp_min_y_m,
      params.position_clamp_min_z_m
    ),
    vec3<f32>(
      params.position_clamp_max_x_m,
      params.position_clamp_max_y_m,
      params.position_clamp_max_z_m
    )
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

fn actual_vertex_count() -> u32 {
  return min(params.vertex_count, source_vertex_count_rows[0u]);
}

fn actual_triangle_count() -> u32 {
  return actual_vertex_count() / 3u;
}

fn write_draw_metadata(triangle_count: u32) {
  surface_draw_rows[0u] = f32(params.surface_index);
  surface_draw_rows[1u] = params.material_id;
  surface_draw_rows[2u] = params.phase_id;
  surface_draw_rows[3u] = params.optical_state_id;
  surface_draw_rows[4u] = 0.0;
  surface_draw_rows[5u] = f32(triangle_count * 3u);
  surface_draw_rows[6u] = 0.0;
  surface_draw_rows[7u] = f32(triangle_count);
  surface_draw_rows[8u] = params.render_order;
  surface_draw_rows[9u] = params.transparency_class_id;
  surface_draw_rows[10u] = params.depth_write_flag;
  surface_draw_rows[11u] = select(0.0, 1.0, triangle_count > 0u);
  surface_draw_rows[12u] = params.bounds_center_x_m;
  surface_draw_rows[13u] = params.bounds_center_y_m;
  surface_draw_rows[14u] = params.bounds_center_z_m;
  surface_draw_rows[15u] = params.bounds_radius_m;
  surface_draw_indirect_rows[0u] = triangle_count * 3u;
  surface_draw_indirect_rows[1u] = select(0u, 1u, triangle_count > 0u);
  surface_draw_indirect_rows[2u] = 0u;
  surface_draw_indirect_rows[3u] = params.surface_index;
}

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) id: vec3<u32>) {
  let triangle_index = id.x;
  let triangle_count = actual_triangle_count();
  if (triangle_index >= triangle_count) {
    return;
  }
  let vertex_base = triangle_index * 3u;
  let p0 = clamp_world_position(ulg_world_position(compact_position(vertex_base + 0u)));
  let p1 = clamp_world_position(ulg_world_position(compact_position(vertex_base + 1u)));
  let p2 = clamp_world_position(ulg_world_position(compact_position(vertex_base + 2u)));
  let normal = normalize_or_fallback(cross(p1 - p0, p2 - p0));
  write_vertex(vertex_base + 0u, triangle_index, p0, normal);
  write_vertex(vertex_base + 1u, triangle_index, p1, normal);
  write_vertex(vertex_base + 2u, triangle_index, p2, normal);
  if (triangle_index == 0u) {
    write_draw_metadata(triangle_count);
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

function validBoundsPair(min, max) {
  return min.every(Number.isFinite)
    && max.every(Number.isFinite)
    && min.every((value, axis) => value <= max[axis]);
}

function resolvePositionClamp({ min = null, max = null } = {}) {
  const clampMin = vector3(min, [NaN, NaN, NaN]);
  const clampMax = vector3(max, [NaN, NaN, NaN]);
  const enabled = validBoundsPair(clampMin, clampMax);
  return {
    enabled,
    status: enabled ? 'position-clamp-ready' : 'position-clamp-disabled',
    minM: enabled ? clampMin : [0, 0, 0],
    maxM: enabled ? clampMax : [0, 0, 0]
  };
}

function clampPositionToBounds(position, clampBounds) {
  if (!clampBounds?.enabled) return position;
  return [
    Math.min(clampBounds.maxM[0], Math.max(clampBounds.minM[0], position[0])),
    Math.min(clampBounds.maxM[1], Math.max(clampBounds.minM[1], position[1])),
    Math.min(clampBounds.maxM[2], Math.max(clampBounds.minM[2], position[2]))
  ];
}

function normalizeVector3(value, fallback = [0, 1, 0]) {
  const v = vector3(value, fallback);
  const length = Math.hypot(v[0], v[1], v[2]);
  if (!(length > 1e-12)) return [...fallback];
  return [v[0] / length, v[1] / length, v[2] / length];
}

function createUlgRenderFieldPositionTransform({
  resolution = null,
  fieldPadding = null,
  refEdgeM = null,
  positionGridBias = -0.5
} = {}) {
  const resolvedResolution = Math.max(0, Math.round(finiteNumber(resolution, 0)));
  const resolvedFieldPadding = finiteNumber(fieldPadding, NaN);
  const resolvedRefEdgeM = finiteNumber(refEdgeM, NaN);
  const span = 1 - 2 * resolvedFieldPadding;
  const enabled = Boolean(
    resolvedResolution > 0
    && Number.isFinite(resolvedFieldPadding)
    && Number.isFinite(resolvedRefEdgeM)
    && resolvedRefEdgeM > 0
    && span > 1e-12
  );
  if (!enabled) {
    return {
      enabled: false,
      status: 'position-transform-disabled',
      resolution: resolvedResolution || null,
      fieldPadding: Number.isFinite(resolvedFieldPadding) ? resolvedFieldPadding : null,
      refEdgeM: Number.isFinite(resolvedRefEdgeM) ? resolvedRefEdgeM : null,
      scaleM: 1,
      originM: [0, 0, 0],
      gridBias: 0
    };
  }
  const scaleM = resolvedRefEdgeM / (span * resolvedResolution);
  const origin = -resolvedFieldPadding * resolvedRefEdgeM / span;
  return {
    enabled: true,
    status: 'ulg-render-field-grid-to-world-transform-ready',
    resolution: resolvedResolution,
    fieldPadding: resolvedFieldPadding,
    refEdgeM: resolvedRefEdgeM,
    scaleM,
    originM: [origin, origin, origin],
    gridBias: finiteNumber(positionGridBias, -0.5)
  };
}

function transformCompactPositionToUlgWorld(position, transform) {
  if (!transform?.enabled) return [...position];
  const scaleM = finiteNumber(transform.scaleM, 1);
  const gridBias = finiteNumber(transform.gridBias, 0);
  const originM = vector3(transform.originM, [0, 0, 0]);
  return [
    originM[0] + (position[0] + gridBias) * scaleM,
    originM[1] + (position[1] + gridBias) * scaleM,
    originM[2] + (position[2] + gridBias) * scaleM
  ];
}

function boundsFromMinMax(minM, maxM) {
  if (!validBoundsPair(minM, maxM)) return null;
  const center = [
    (minM[0] + maxM[0]) * 0.5,
    (minM[1] + maxM[1]) * 0.5,
    (minM[2] + maxM[2]) * 0.5
  ];
  return {
    minM: [...minM],
    maxM: [...maxM],
    centerM: center,
    radiusM: Math.hypot(maxM[0] - center[0], maxM[1] - center[1], maxM[2] - center[2])
  };
}

function conservativeSurfaceBounds({ positionTransform = null, positionClamp = null } = {}) {
  if (positionClamp?.enabled) {
    return boundsFromMinMax(positionClamp.minM, positionClamp.maxM);
  }
  if (positionTransform?.enabled) {
    const scaleM = finiteNumber(positionTransform.scaleM, 1);
    const originM = vector3(positionTransform.originM, [0, 0, 0]);
    const resolution = Math.max(1, Math.round(finiteNumber(positionTransform.resolution, 1)));
    const maxOffset = Math.max(0, resolution - 1) * scaleM;
    return boundsFromMinMax(originM, [
      originM[0] + maxOffset,
      originM[1] + maxOffset,
      originM[2] + maxOffset
    ]);
  }
  return null;
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

function renderFieldBufferVolumeBlocked(status, reason, extra = {}) {
  return {
    schema: ULG_SPH_WEBGPU_MARCHING_CUBES_BUFFER_VOLUME_DESCRIPTOR_SCHEMA,
    ok: false,
    status,
    reason,
    sourceType: WEBGPU_MARCHING_CUBES_SCALAR_BUFFER_VOLUME_SOURCE,
    scalarLayoutName: WEBGPU_MARCHING_CUBES_SCALAR_BUFFER_LAYOUT_NAME,
    scalarType: 'f32',
    extensionDescriptorFactory: 'createBufferVolumeDescriptor',
    ...extra
  };
}

export function createUlgRenderFieldBufferVolumeDescriptor({
  device = null,
  renderField = null,
  renderFieldExecution = null,
  surface = null,
  surfaceIndex = 0,
  label = 'ulg-sph-render-field-density-volume',
  source = 'ulg-render-field-density-storage-buffer'
} = {}) {
  const field = renderField || renderFieldExecution?.result || renderFieldExecution?.renderField || null;
  if (!field) {
    return renderFieldBufferVolumeBlocked(
      'ulg-render-field-buffer-volume-blocked-missing-render-field',
      'retained ULG render-field metadata is required before native marching-cubes buffer-volume extraction'
    );
  }
  if (field.schema !== ULG_SPH_GPU_RENDER_FIELD_SCHEMA) {
    return renderFieldBufferVolumeBlocked(
      'ulg-render-field-buffer-volume-blocked-schema',
      'ULG buffer-volume extraction requires peercompute.ulg.sph-gpu-render-field.v0 input',
      { renderFieldSchema: field.schema ?? null }
    );
  }
  const scalarBuffer = field.fieldRowsBuffer || renderFieldExecution?.fieldRowsBuffer || null;
  if (!isObject(scalarBuffer)) {
    return renderFieldBufferVolumeBlocked(
      'ulg-render-field-buffer-volume-blocked-missing-buffer',
      'retained fieldRowsBuffer is required for native webgpu-marching-cubes scalar-buffer input',
      {
        renderFieldSchema: field.schema,
        fieldRowsBufferRetained: Boolean(field.fieldRowsBufferRetained),
        fieldRowsBufferByteLength: field.fieldRowsBufferByteLength ?? 0
      }
    );
  }
  const surfaceTable = field.surfaceTable || renderFieldExecution?.surfaceTable || null;
  const index = Math.max(0, Math.round(finiteNumber(surfaceIndex, 0)));
  const surfaceRecord = surface || surfaceTable?.metadata?.[index] || null;
  if (!surfaceRecord) {
    return renderFieldBufferVolumeBlocked(
      'ulg-render-field-buffer-volume-blocked-missing-surface',
      'render-field surface metadata is required to locate the scalar sub-volume inside fieldRowsBuffer',
      {
        renderFieldSchema: field.schema,
        surfaceIndex: index,
        surfaceCount: surfaceTable?.surfaceCount ?? field.surfaceCount ?? 0
      }
    );
  }
  const resolution = Math.max(1, Math.round(finiteNumber(surfaceRecord.resolution, 0)));
  const rowStrideFloats = Math.max(
    1,
    Math.round(finiteNumber(field.rowStrideFloats, SPH_GPU_RENDER_FIELD_CELL_ROW_LAYOUT.length))
  );
  const fieldOffset = Math.max(0, Math.round(finiteNumber(surfaceRecord.fieldOffset, 0)));
  const scalarOffset = fieldOffset * rowStrideFloats;
  const scalarStrides = [
    rowStrideFloats,
    rowStrideFloats * resolution,
    rowStrideFloats * resolution * resolution
  ];
  const scalarRequiredFloats = scalarOffset
    + Math.max(0, resolution - 1) * scalarStrides[0]
    + Math.max(0, resolution - 1) * scalarStrides[1]
    + Math.max(0, resolution - 1) * scalarStrides[2]
    + 1;
  const scalarOffsetBytes = scalarOffset * Float32Array.BYTES_PER_ELEMENT;
  const scalarRequiredByteLength = scalarRequiredFloats * Float32Array.BYTES_PER_ELEMENT;
  const fieldRowsBufferByteLength = Math.round(finiteNumber(field.fieldRowsBufferByteLength, 0));
  const rawBufferByteLength = Math.round(finiteNumber(
    scalarBuffer.size ?? scalarBuffer.byteLength ?? scalarBuffer.byteLengthBytes,
    0
  ));
  const scalarBufferByteLength = Math.max(0, fieldRowsBufferByteLength > 0
    ? fieldRowsBufferByteLength
    : rawBufferByteLength);
  const bufferDevice = scalarBuffer.device
    || scalarBuffer.ownerDevice
    || scalarBuffer.__webgpuDevice
    || scalarBuffer.__webgpuMarchingCubesDevice
    || null;
  const sameDeviceStatus = device && bufferDevice
    ? (device === bufferDevice ? 'same-device' : 'cross-device-resource')
    : 'same-device-validation-deferred-to-extension';
  const byteLengthValid = scalarBufferByteLength >= scalarRequiredByteLength;
  if (sameDeviceStatus === 'cross-device-resource') {
    return renderFieldBufferVolumeBlocked(
      'ulg-render-field-buffer-volume-blocked-cross-device',
      'fieldRowsBuffer is associated with a different GPUDevice than the native marching-cubes adapter',
      {
        renderFieldSchema: field.schema,
        surfaceIndex: index,
        sameDeviceStatus,
        scalarBuffer,
        scalarBufferByteLength
      }
    );
  }
  if (!byteLengthValid) {
    return renderFieldBufferVolumeBlocked(
      'ulg-render-field-buffer-volume-blocked-undersized-buffer',
      'fieldRowsBuffer is smaller than the selected render-field surface sub-volume',
      {
        renderFieldSchema: field.schema,
        surfaceIndex: index,
        scalarBuffer,
        scalarBufferByteLength,
        scalarRequiredByteLength
      }
    );
  }
  const dims = [resolution, resolution, resolution];
  const positionTransform = createUlgRenderFieldPositionTransform({
    resolution,
    fieldPadding: field.fieldPadding,
    refEdgeM: field.refEdgeM
  });
  return {
    schema: ULG_SPH_WEBGPU_MARCHING_CUBES_BUFFER_VOLUME_DESCRIPTOR_SCHEMA,
    ok: true,
    status: 'ulg-render-field-buffer-volume-descriptor-ready',
    reason: null,
    extensionDescriptorFactory: 'createBufferVolumeDescriptor',
    renderFieldSchema: field.schema,
    renderFieldBackend: field.backend ?? renderFieldExecution?.backend ?? null,
    source,
    sourceType: WEBGPU_MARCHING_CUBES_SCALAR_BUFFER_VOLUME_SOURCE,
    scalarLayoutName: WEBGPU_MARCHING_CUBES_SCALAR_BUFFER_LAYOUT_NAME,
    scalarType: 'f32',
    scalarLane: 'density',
    scalarLaneIndex: 0,
    scalarBuffer,
    storageBuffer: scalarBuffer,
    buffer: scalarBuffer,
    scalarBufferByteLength,
    bufferByteLength: scalarBufferByteLength,
    scalarRequiredByteLength,
    scalarOffset,
    scalarOffsetBytes,
    scalarStrides,
    rowStrideFloats: scalarStrides[1],
    sliceStrideFloats: scalarStrides[2],
    cellRowStrideFloats: rowStrideFloats,
    dims,
    surfaceIndex: index,
    surfaceKey: surfaceRecord.surfaceKey ?? null,
    material: surfaceRecord.material ?? null,
    phase: surfaceRecord.phase ?? null,
    renderKey: surfaceRecord.renderKey ?? null,
    renderDomainId: surfaceRecord.renderDomainId ?? null,
    renderDomainKey: surfaceRecord.renderDomainKey ?? null,
    fieldOffset,
    fieldCellCount: surfaceRecord.fieldCellCount ?? resolution ** 3,
    isolation: surfaceRecord.isolation ?? null,
    isovalue: surfaceRecord.isolation ?? null,
    fieldPadding: field.fieldPadding ?? null,
    refEdgeM: field.refEdgeM ?? null,
    positionTransform,
    positionTransformStatus: positionTransform.status,
    positionTransformGridBias: positionTransform.gridBias,
    positionTransformScaleM: positionTransform.scaleM,
    positionTransformOriginM: [...positionTransform.originM],
    device,
    sameDeviceRequired: true,
    sameDeviceStatus,
    label,
    nativeConsumerKind: 'native-webgpu-marching-cubes-buffer-volume',
    nativeRequiredAdapter: 'webgpu-marching-cubes.buffer-volume.v0',
    scientificValidation: false,
    sphValidation: false,
    surfaceExtractionValidation: false,
    fullPhysicsValidation: false
  };
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
  fallbackNormal,
  positionTransform = null,
  positionClamp = null,
  surfaceBounds = null
}) {
  const buffer = new ArrayBuffer(144);
  const view = new DataView(buffer);
  const resolvedTransform = positionTransform?.enabled
    ? positionTransform
    : null;
  const resolvedClamp = positionClamp?.enabled
    ? positionClamp
    : null;
  const resolvedBounds = surfaceBounds || conservativeSurfaceBounds({
    positionTransform: resolvedTransform,
    positionClamp: resolvedClamp
  });
  const originM = vector3(resolvedTransform?.originM, [0, 0, 0]);
  const clampMinM = vector3(resolvedClamp?.minM, [0, 0, 0]);
  const clampMaxM = vector3(resolvedClamp?.maxM, [0, 0, 0]);
  const boundsCenterM = vector3(resolvedBounds?.centerM, [0, 0, 0]);
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
  view.setFloat32(64, finiteNumber(resolvedTransform?.scaleM, 1), true);
  view.setFloat32(68, originM[0], true);
  view.setFloat32(72, originM[1], true);
  view.setFloat32(76, originM[2], true);
  view.setFloat32(80, finiteNumber(resolvedTransform?.gridBias, 0), true);
  view.setFloat32(84, resolvedTransform ? 1 : 0, true);
  view.setFloat32(88, 0, true);
  view.setFloat32(92, 0, true);
  view.setFloat32(96, clampMinM[0], true);
  view.setFloat32(100, clampMinM[1], true);
  view.setFloat32(104, clampMinM[2], true);
  view.setFloat32(108, clampMaxM[0], true);
  view.setFloat32(112, clampMaxM[1], true);
  view.setFloat32(116, clampMaxM[2], true);
  view.setFloat32(120, resolvedClamp ? 1 : 0, true);
  view.setFloat32(124, 0, true);
  view.setFloat32(128, boundsCenterM[0], true);
  view.setFloat32(132, boundsCenterM[1], true);
  view.setFloat32(136, boundsCenterM[2], true);
  view.setFloat32(140, finiteNumber(resolvedBounds?.radiusM, 0), true);
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
  status = 'surface-draw-summary-not-read',
  boundsCenterM = null,
  boundsRadiusM = null
}) {
  const resolvedBoundsCenterM = vector3(boundsCenterM, [0, 0, 0]);
  const resolvedBoundsRadiusM = finiteNumber(boundsRadiusM, 0);
  const resolvedVertexCount = Number.isFinite(Number(vertexCount))
    ? Math.max(0, Math.round(Number(vertexCount)))
    : null;
  const resolvedTriangleCount = Number.isFinite(Number(triangleCount))
    ? Math.max(0, Math.round(Number(triangleCount)))
    : null;
  const hasDrawableRange = (resolvedVertexCount ?? 0) >= 3;
  return {
    surfaceKey: surfaceKey || `extension-surface-${surfaceIndex}`,
    material,
    phase,
    renderKey,
    surfaceIndex,
    materialId,
    phaseId,
    opticalStateId,
    vertexOffset: hasDrawableRange ? 0 : null,
    vertexCount: resolvedVertexCount,
    triangleOffset: hasDrawableRange ? 0 : null,
    triangleCount: resolvedTriangleCount,
    renderOrder,
    transparencyClassId,
    depthWriteFlag,
    boundsCenterM: resolvedBoundsCenterM,
    boundsRadiusM: resolvedBoundsRadiusM > 0 ? resolvedBoundsRadiusM : null,
    status
  };
}

function assertSameDeviceExtensionSurfaceBuffer(extensionExecution) {
  const result = extensionExecution?.result || null;
  const position = result?.outputDescriptors?.rows?.position
    || result?.rowMetadata?.position
    || null;
  const ownership = position?.resourceOwnership || result?.resourceOwnership || null;
  if (ownership?.ok === false || ownership?.status === 'cross-device-resource') {
    throw new TypeError(`extension surface buffer is not owned by this GPUDevice (${ownership.status})`);
  }
}

function compactPositionRowsSource(result = null) {
  const outputDescriptors = result?.outputDescriptors || null;
  const outputPosition = outputDescriptors?.rows?.position || null;
  const rowMetadataPosition = result?.rowMetadata?.position || null;
  const position = outputPosition || rowMetadataPosition || null;
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
  const buffer = position?.buffer || outputDescriptors?.retainedBuffers?.position || result?.buffer || null;
  const bufferRetained = Boolean(
    (position?.bufferRetained && position?.buffer)
      || (outputDescriptors?.retainedBuffers?.position && buffer)
      || (result?.bufferRetained && result?.buffer)
  );
  const bufferByteLength = Math.max(0, Math.round(finiteNumber(
    position?.bufferByteLength ?? result?.bufferByteLength,
    0
  )));
  return {
    outputDescriptorSchema: outputDescriptors?.schema ?? null,
    outputDescriptorStatus: outputDescriptors?.status ?? null,
    outputDescriptorTopology: outputDescriptors?.topology ?? null,
    outputDescriptorReadback: outputDescriptors?.readback ?? null,
    outputDescriptorFullReadback: outputDescriptors?.fullReadback ?? null,
    rowMetadataSchema: result?.rowMetadata?.schema ?? null,
    rowMetadataStatus: result?.rowMetadata?.status ?? null,
    rowSchema,
    rowLayout,
    rowLayoutName: position?.layoutName ?? outputDescriptors?.layoutName ?? result?.layoutName ?? null,
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
    readback: position?.readback ?? outputDescriptors?.readback ?? result?.rowMetadata?.readback ?? result?.readback ?? null,
    normalRowsStatus: outputDescriptors?.rows?.normal?.status ?? result?.rowMetadata?.normal?.status ?? null,
    materialRowsStatus: outputDescriptors?.rows?.material?.status ?? result?.rowMetadata?.material?.status ?? null,
    drawRowsStatus: outputDescriptors?.rows?.draw?.status ?? null,
    drawRowsAvailable: outputDescriptors?.rows?.draw?.available ?? null,
    indirectDrawRowsStatus: outputDescriptors?.rows?.indirect?.status ?? null,
    indirectDrawRowsAvailable: outputDescriptors?.rows?.indirect?.available ?? null,
    materialMetadataAvailable: outputDescriptors?.materialPayload?.available
      ?? result?.rowMetadata?.material?.metadataAvailable
      ?? null,
    pbrMetadataAvailable: outputDescriptors?.pbrPayload?.available ?? null
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
  const extensionVertexCountMode = result?.vertexCountMode ?? null;
  const extensionActualVertexCounterBuffer = result?.actualVertexCounterBuffer
    || result?.vertexCounterBuffer
    || null;
  const extensionActualVertexCounterBufferByteLength = Math.max(
    0,
    Math.round(finiteNumber(
      result?.actualVertexCounterBufferByteLength
        ?? result?.vertexCounterBufferByteLength
        ?? extensionActualVertexCounterBuffer?.size,
      0
    ))
  );
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
  const extensionError = execution.errors?.[0]
    || execution.webgpuStatus?.error
    || result?.error
    || null;
  const blockedReason = normalizeStatusReason(execution.webgpuStatus?.reason)
    || normalizeStatusReason(extensionError?.message)
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
    extensionErrorName: extensionError?.name ?? null,
    extensionErrorStatus: extensionError?.status ?? null,
    extensionErrorStage: extensionError?.stage ?? null,
    extensionErrorStack: extensionError?.stack ?? null,
    extensionBackend: execution.backend ?? null,
    extensionAdapterId: execution.adapterId ?? null,
    extensionOwnsDevice: execution.ownsDevice ?? null,
    extensionOwnerDeviceId: execution.ownerDeviceId ?? result?.ownerDeviceId ?? null,
    extensionResourceOwnershipStatus,
    extensionVertexFormat,
    extensionVertexStrideFloats,
    extensionVertexStrideBytes,
    extensionVertexCount,
    extensionVertexCountMode,
    extensionActualVertexCounterBufferRetained: Boolean(extensionActualVertexCounterBuffer),
    extensionActualVertexCounterBufferByteLength,
    extensionTriangleCount,
    extensionBufferRetained,
    extensionBufferByteLength: positionRows.bufferByteLength,
    extensionOutputDescriptorSchema: positionRows.outputDescriptorSchema,
    extensionOutputDescriptorStatus: positionRows.outputDescriptorStatus,
    extensionOutputDescriptorTopology: positionRows.outputDescriptorTopology,
    extensionOutputDescriptorReadback: positionRows.outputDescriptorReadback,
    extensionOutputDescriptorFullReadback: positionRows.outputDescriptorFullReadback,
    extensionRowMetadataSchema: positionRows.rowMetadataSchema,
    extensionRowMetadataStatus: positionRows.rowMetadataStatus,
    extensionPositionRowsSchema: positionRows.rowSchema,
    extensionPositionRowsStatus: positionRows.status,
    extensionPositionRowsAvailable: positionRows.available,
    extensionPositionRowsReadback: positionRows.readback,
    extensionPositionRowsRowLayout: positionRows.rowLayout,
    extensionPositionRowsLayoutName: positionRows.rowLayoutName,
    extensionPositionRowsRowCount: positionRows.rowCount,
    extensionNormalRowsStatus: positionRows.normalRowsStatus,
    extensionMaterialRowsStatus: positionRows.materialRowsStatus,
    extensionDrawRowsStatus: positionRows.drawRowsStatus,
    extensionDrawRowsAvailable: positionRows.drawRowsAvailable,
    extensionIndirectDrawRowsStatus: positionRows.indirectDrawRowsStatus,
    extensionIndirectDrawRowsAvailable: positionRows.indirectDrawRowsAvailable,
    extensionMaterialMetadataAvailable: positionRows.materialMetadataAvailable,
    extensionPbrMetadataAvailable: positionRows.pbrMetadataAvailable,
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
  const ensureExtensionAdapter = async () => {
    if (!extensionAdapter) {
      extensionAdapter = await adapterFactory({
        device,
        volume,
        adapterId
      });
    }
    return extensionAdapter;
  };
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
    getStatus() {
      return {
        schema: ULG_SPH_WEBGPU_MARCHING_CUBES_EXTENSION_ADAPTER_SCHEMA,
        status: extensionAdapter ? 'extension-adapter-ready' : 'extension-adapter-pending',
        adapterSchema: extensionAdapter?.schema ?? null,
        adapterStatus: extensionAdapter?.getStatus?.() ?? null,
        adapterId,
        backend,
        ownsDevice: false
      };
    },
    getCapabilities() {
      return extensionAdapter?.getCapabilities?.() ?? {
        schema: ULG_SPH_WEBGPU_MARCHING_CUBES_EXTENSION_ADAPTER_SCHEMA,
        status: extensionAdapter ? 'extension-capabilities-unavailable' : 'extension-adapter-pending',
        adapterSchema: extensionAdapter?.schema ?? null,
        adapterId,
        backend,
        ownsDevice: false
      };
    },
    async preflight(input = {}) {
      const resolvedAdapter = await ensureExtensionAdapter();
      if (typeof resolvedAdapter.preflight !== 'function') {
        return {
          schema: ULG_SPH_WEBGPU_MARCHING_CUBES_EXTENSION_PREFLIGHT_SCHEMA,
          ok: true,
          status: 'extension-preflight-unavailable',
          reason: 'extension adapter does not expose preflight; extraction will rely on adapter extractSurface checks',
          backend,
          adapterSchema: resolvedAdapter?.schema ?? null,
          adapterId,
          ownsDevice: false,
          extensionPreflight: null
        };
      }
      const extensionPreflight = await resolvedAdapter.preflight({
        ...input,
        volume: input.volume || volume
      });
      const ok = extensionPreflight?.ok !== false;
      return {
        schema: ULG_SPH_WEBGPU_MARCHING_CUBES_EXTENSION_PREFLIGHT_SCHEMA,
        ok,
        status: ok ? 'extension-preflight-ready' : 'extension-preflight-blocked',
        reason: ok ? null : (extensionPreflight?.status || 'extension preflight blocked surface extraction'),
        backend,
        adapterSchema: resolvedAdapter?.schema ?? null,
        adapterId,
        ownsDevice: false,
        extensionPreflightSchema: extensionPreflight?.schema ?? null,
        extensionPreflightStatus: extensionPreflight?.status ?? null,
        deviceChecks: extensionPreflight?.deviceChecks || [],
        extensionPreflight
      };
    },
    async extractSurface(input = {}) {
      const resolvedAdapter = await ensureExtensionAdapter();
      const preflight = await wrapper.preflight(input);
      if (preflight.ok === false) {
        const summary = {
          schema: ULG_SPH_WEBGPU_MARCHING_CUBES_EXTENSION_EXECUTION_SCHEMA,
          status: 'extension-surface-preflight-blocked',
          reason: preflight.reason,
          extensionOk: false,
          extensionStatus: preflight.extensionPreflightStatus,
          extensionExecutionSchema: null,
          extensionSurfaceSchema: null,
          readyForUlgSurfaceVertexRows: false,
          requiresUlgVertexRowTranslation: true,
          requiresUlgDrawMetadata: true,
          hotLoopSafe: false,
          rendererIntegration: 'blocked-before-extension-extraction'
        };
        return {
          schema: ULG_SPH_WEBGPU_MARCHING_CUBES_EXTENSION_EXECUTION_SCHEMA,
          status: summary.status,
          reason: summary.reason,
          backend,
          adapterSchema: wrapper.schema,
          extensionAdapterSchema: resolvedAdapter?.schema ?? null,
          adapterId,
          ownsDevice: false,
          preflight,
          summary,
          extensionExecution: null,
          surfaceVertexSchema: null,
          surfaceDrawSchema: null,
          surfaceDrawIndirectSchema: null,
          readyForUlgSurfaceVertexRows: false,
          requiresUlgVertexRowTranslation: true,
          requiresUlgDrawMetadata: true,
          hotLoopSafe: false,
          rendererIntegration: summary.rendererIntegration
        };
      }
      const extensionExecution = await resolvedAdapter.extractSurface({
        ...input,
        volume: input.volume || volume
      });
      const summary = summarizeWebGpuMarchingCubesExtensionExecution(extensionExecution);
      return {
        schema: ULG_SPH_WEBGPU_MARCHING_CUBES_EXTENSION_EXECUTION_SCHEMA,
        status: summary.status,
        reason: summary.reason,
        backend,
        adapterSchema: wrapper.schema,
        extensionAdapterSchema: resolvedAdapter?.schema ?? null,
        adapterId,
        ownsDevice: false,
        preflight,
        summary,
        extensionExecution,
        webgpuStatus: extensionExecution?.webgpuStatus ?? null,
        errors: extensionExecution?.errors || [],
        errorName: summary.extensionErrorName,
        errorStatus: summary.extensionErrorStatus,
        errorStage: summary.extensionErrorStage,
        errorStack: summary.extensionErrorStack,
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
  renderOrder = null,
  positionTransform = null,
  positionTransformResolution = null,
  fieldPadding = null,
  refEdgeM = null,
  positionGridBias = -0.5,
  positionClampMinM = null,
  positionClampMaxM = null
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
  const resolvedPositionTransform = positionTransform || createUlgRenderFieldPositionTransform({
    resolution: positionTransformResolution,
    fieldPadding,
    refEdgeM,
    positionGridBias
  });
  const resolvedPositionClamp = resolvePositionClamp({
    min: positionClampMinM,
    max: positionClampMaxM
  });
  const triangleCount = Math.floor(vertexCount / 3);
  const alignedVertexCount = triangleCount * 3;
  const vertexRows = new Float32Array(alignedVertexCount * SPH_GPU_RENDER_SURFACE_VERTEX_ROW_LAYOUT.length);
  const positions = [];
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (let index = 0; index < alignedVertexCount; index += 1) {
    const sourceOffset = index * sourceStride;
    const sourcePosition = [
      finiteNumber(sourceRows[sourceOffset], 0),
      finiteNumber(sourceRows[sourceOffset + 1], 0),
      finiteNumber(sourceRows[sourceOffset + 2], 0)
    ];
    const p = clampPositionToBounds(
      transformCompactPositionToUlgWorld(sourcePosition, resolvedPositionTransform),
      resolvedPositionClamp
    );
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
    positionTransform: resolvedPositionTransform,
    positionTransformStatus: resolvedPositionTransform.status,
    positionClamp: resolvedPositionClamp,
    positionClampStatus: resolvedPositionClamp.status,
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
    positionTransform: resolvedPositionTransform,
    positionTransformStatus: resolvedPositionTransform.status,
    positionClamp: resolvedPositionClamp,
    positionClampStatus: resolvedPositionClamp.status,
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
    positionTransform: resolvedPositionTransform,
    positionTransformStatus: resolvedPositionTransform.status,
    positionClamp: resolvedPositionClamp,
    positionClampStatus: resolvedPositionClamp.status,
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
  positionTransform = null,
  positionTransformResolution = null,
  fieldPadding = null,
  refEdgeM = null,
  positionGridBias = -0.5,
  positionClampMinM = null,
  positionClampMaxM = null,
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
  const sourceVertexCountMode = summary.extensionVertexCountMode ?? null;
  const extensionResult = extensionExecution?.result || null;
  const extensionActualVertexCounterBuffer = extensionResult?.actualVertexCounterBuffer
    || extensionResult?.vertexCounterBuffer
    || null;
  const extensionActualVertexCounterBufferByteLength = Math.max(
    0,
    Math.round(finiteNumber(
      extensionResult?.actualVertexCounterBufferByteLength
        ?? extensionResult?.vertexCounterBufferByteLength
        ?? extensionActualVertexCounterBuffer?.size,
      0
    ))
  );
  let sourceVertexCounterBuffer = extensionActualVertexCounterBuffer;
  let ownsSourceVertexCounterBuffer = false;
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
  const resolvedPositionTransform = positionTransform || createUlgRenderFieldPositionTransform({
    resolution: positionTransformResolution,
    fieldPadding,
    refEdgeM,
    positionGridBias
  });
  const resolvedPositionClamp = resolvePositionClamp({
    min: positionClampMinM,
    max: positionClampMaxM
  });
  const resolvedSurfaceBounds = conservativeSurfaceBounds({
    positionTransform: resolvedPositionTransform,
    positionClamp: resolvedPositionClamp
  });
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
          sourceVertexCountMode,
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
    usage: GPU_BUFFER_USAGE.STORAGE
      | GPU_BUFFER_USAGE.VERTEX
      | GPU_BUFFER_USAGE.COPY_SRC
      | GPU_BUFFER_USAGE.COPY_DST
  });
  const vertexRowsBufferClearStatus = noFullReadback
    ? 'skipped-no-full-readback-indirect-draw'
    : 'cleared-for-readback';
  if (!noFullReadback && vertexRowsByteLength > 0) {
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
    size: 144,
    usage: GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST
  });
  if (!sourceVertexCounterBuffer) {
    sourceVertexCounterBuffer = device.createBuffer({
      label: 'ulg-sph-extension-surface-source-vertex-count',
      size: 4,
      usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_DST
    });
    device.queue.writeBuffer(sourceVertexCounterBuffer, 0, new Uint32Array([sourceVertexCount]));
    ownsSourceVertexCounterBuffer = true;
  }
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
    fallbackNormal: resolvedFallbackNormal,
    positionTransform: resolvedPositionTransform,
    positionClamp: resolvedPositionClamp,
    surfaceBounds: resolvedSurfaceBounds
  }));
  markProgress('extension-surface-translation-buffers-ready');

  const translationPipeline = createCachedExplicitComputePipeline(device, {
    cacheKey: 'ulg-sph-webgpu-marching-cubes-extension-surface-translation:v1',
    label: 'ulg-sph-webgpu-marching-cubes-extension-surface-translation',
    code: webGpuMarchingCubesExtensionSurfaceRowsWgsl,
    entryPoint: 'main',
    bindings: [
      computeBufferBinding(0, 'read-only-storage'),
      computeBufferBinding(1, 'storage'),
      computeBufferBinding(2, 'storage'),
      computeBufferBinding(3, 'storage'),
      computeBufferBinding(4, 'uniform'),
      computeBufferBinding(5, 'read-only-storage')
    ]
  });
  const { pipeline, bindGroupLayout } = translationPipeline;
  const bindGroup = device.createBindGroup({
    layout: bindGroupLayout,
    entries: [
      { binding: 0, resource: { buffer: sourceBuffer } },
      { binding: 1, resource: { buffer: vertexRowsBuffer } },
      { binding: 2, resource: { buffer: drawRowsBuffer } },
      { binding: 3, resource: { buffer: drawIndirectRowsBuffer } },
      { binding: 4, resource: { buffer: paramsBuffer } },
      { binding: 5, resource: { buffer: sourceVertexCounterBuffer } }
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
    if (ownsSourceVertexCounterBuffer) {
      sourceVertexCounterBuffer?.destroy?.();
    }
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
    vertexCount: translatedVertexCount,
    triangleCount,
    renderOrder: resolvedRenderOrder,
    transparencyClassId: resolvedTransparencyClassId,
    depthWriteFlag: resolvedDepthWriteFlag,
    status: surfaceStatus,
    boundsCenterM: resolvedSurfaceBounds?.centerM ?? null,
    boundsRadiusM: resolvedSurfaceBounds?.radiusM ?? null
  });
  const sourceVertexCounterMode = extensionActualVertexCounterBuffer
    ? 'extension-gpu-vertex-counter'
    : 'host-constant-vertex-count';
  const sourceVertexCounterBufferRetained = Boolean(extensionActualVertexCounterBuffer);
  const sourceVertexCounterBufferByteLength = extensionActualVertexCounterBuffer
    ? extensionActualVertexCounterBufferByteLength
    : 4;
  const surfaceVertices = {
    schema: ULG_SPH_GPU_RENDER_SURFACE_VERTICES_SCHEMA,
    backend: 'webgpu',
    status: noFullReadback ? 'surface-vertices-resident-extension-compact-translation' : (translatedVertexCount > 0 ? 'surface-vertices-ready' : 'surface-vertices-empty'),
    sourceSurfaceExecutionSchema: summary.extensionExecutionSchema,
    sourceSurfaceSchema: summary.extensionSurfaceSchema,
    surfaceExtractionMethod: 'webgpu-marching-cubes-extension-compact-position-gpu-translation',
    compactionMode: 'webgpu-extension-compact-position-to-ulg-rows',
    positionTransform: resolvedPositionTransform,
    positionTransformStatus: resolvedPositionTransform.status,
    positionClamp: resolvedPositionClamp,
    positionClampStatus: resolvedPositionClamp.status,
    surfaceCount: 1,
    rowLayout: [...SPH_GPU_RENDER_SURFACE_VERTEX_ROW_LAYOUT],
    rowStrideFloats: SPH_GPU_RENDER_SURFACE_VERTEX_ROW_LAYOUT.length,
    vertexRows,
    vertexRowsByteLength: vertexRows.byteLength,
    vertexCount: translatedVertexCount,
    vertexCountMode: sourceVertexCountMode,
    triangleCount,
    maxVertexRows: translatedVertexCount,
    vertexRowsBufferByteLength: keepVertexRowsBuffer ? vertexRowsByteLength : 0,
    vertexRowsBufferRowCount: keepVertexRowsBuffer ? translatedVertexCount : 0,
    vertexRowsBufferRetained: keepVertexRowsBuffer,
    sourceVertexCount,
    sourceVertexCountMode,
    sourceVertexCounterMode,
    sourceVertexCounterBufferBound: Boolean(sourceVertexCounterBuffer),
    sourceVertexCounterBufferRetained,
    sourceVertexCounterBufferByteLength,
    translatedVertexCount,
    ignoredTrailingVertexCount: sourceVertexCount - translatedVertexCount,
    sourceVertexRowsBufferBound: true,
    sourceVertexFormat: summary.extensionVertexFormat,
    sourceVertexStrideFloats: sourceStrideFloats,
    vertexRowsBufferClearStatus,
    translationPipelineCacheStatus: translationPipeline.cacheStatus ?? null,
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
    activeSurfaceCount: triangleCount > 0 ? 1 : 0,
    vertexCount: translatedVertexCount,
    vertexCountMode: sourceVertexCountMode,
    sourceVertexCount,
    sourceVertexCountMode,
    sourceVertexCounterMode,
    sourceVertexCounterBufferBound: Boolean(sourceVertexCounterBuffer),
    sourceVertexCounterBufferRetained,
    sourceVertexCounterBufferByteLength,
    vertexRowsBufferClearStatus,
    translationPipelineCacheStatus: translationPipeline.cacheStatus ?? null,
    triangleCount,
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
    positionTransform: resolvedPositionTransform,
    positionTransformStatus: resolvedPositionTransform.status,
    positionClamp: resolvedPositionClamp,
    positionClampStatus: resolvedPositionClamp.status,
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
    vertexRowsBufferClearStatus,
    translationPipelineCacheStatus: translationPipeline.cacheStatus ?? null,
    positionTransform: resolvedPositionTransform,
    positionTransformStatus: resolvedPositionTransform.status,
    positionClamp: resolvedPositionClamp,
    positionClampStatus: resolvedPositionClamp.status,
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
