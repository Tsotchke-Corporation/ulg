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
import { ULG_ALGORITHM_SURFACE_EXTRACTION_ROWS_SCHEMA } from '../material/algorithmMaterialRows.js';
import {
  resolveSchroederSpatialSuccessorSourceFamily
} from './schroederSpatialSuccessorSourceFamily.js';
import {
  validateSphRenderFieldSuccessorSourceLineage
} from './sphRenderGpuKernel.js';
import {
  validateSphMaterialInterfaceSourceFieldSuccessorLineage
} from './sphMaterialInterfaceSourceFieldLocalGpu.js';

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
export const WEBGPU_MARCHING_CUBES_PACKED_NORMAL_ROWS_SCHEMA =
  'peercompute.webgpu-marching-cubes.packed-normal-rows.v0';
export const WEBGPU_MARCHING_CUBES_PACKED_NORMAL_LAYOUT_NAME =
  'peercompute.webgpu-marching-cubes.layout.normal-octahedral-snorm16x2.v0';
export const WEBGPU_MARCHING_CUBES_NORMAL_BUFFER_DESCRIPTOR_SCHEMA =
  'peercompute.webgpu-marching-cubes.normal-buffer-descriptor.v0';
export const WEBGPU_MARCHING_CUBES_PACKED_NORMAL_ENCODING = 'octahedral-snorm16x2';
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
const schroederVolumeDescriptorLineageRecords = new WeakMap();
const schroederExtensionVolumeLineageRecords = new WeakMap();
const schroederExtensionExecutionLineageRecords = new WeakMap();
const schroederExtensionOutputResourcePublications = new WeakMap();
const schroederSurfaceTranslationLineageRecords = new WeakMap();
const ulgExtensionAdapterRecords = new WeakMap();

function copyArrayBufferViewBytes(value) {
  if (!ArrayBuffer.isView(value)) return null;
  return new Uint8Array(
    value.buffer,
    value.byteOffset,
    value.byteLength
  ).slice();
}

function arrayBufferViewMatchesBytes(value, expectedBytes) {
  if (expectedBytes == null) return value == null;
  if (!ArrayBuffer.isView(value) || value.byteLength !== expectedBytes.byteLength) {
    return false;
  }
  const actualBytes = new Uint8Array(
    value.buffer,
    value.byteOffset,
    value.byteLength
  );
  for (let index = 0; index < actualBytes.length; index += 1) {
    if (actualBytes[index] !== expectedBytes[index]) return false;
  }
  return true;
}

function invalidatePriorSchroederExtensionExecutionPublication(
  publicationMap,
  resource,
  nextRecord
) {
  if (!resource || typeof resource !== 'object') return;
  const priorRecord = publicationMap.get(resource);
  if (priorRecord && priorRecord !== nextRecord) priorRecord.active = false;
  publicationMap.set(resource, nextRecord);
}

function quarantinePriorSchroederExtensionExecutionPublication(
  publicationMap,
  resource
) {
  if (!resource || typeof resource !== 'object') return;
  const priorRecord = publicationMap.get(resource);
  if (priorRecord) priorRecord.active = false;
  publicationMap.delete(resource);
}

export function hasSchroederSpatialLineageClaim(value) {
  return Boolean(
    value?.schroederSpatialSourceFamily
    || value?.schroederSpatialSourceFamilyStatus
    || value?.schroederSpatialSourceFamilyRole
    || value?.schroederSpatialSourceGenerationId != null
    || value?.schroederSpatialSuccessorEpochIdentity
    || value?.schroederSpatialSourceFamilyAncestorGenerationId != null
    || value?.schroederSpatialSourceFamilyPositionAuthority
    || value?.schroederSpatialSourceFamilySpatialQueryAuthority != null
    || value?.schroederSpatialSourcePositionAuthority
    || value?.schroederSpatialSourceQueryAuthority != null
  );
}

function schroederSpatialSourceLineage(sourceFamily) {
  return {
    schroederSpatialSourceFamily: sourceFamily ?? null,
    schroederSpatialSourceFamilyStatus: sourceFamily?.status ?? null,
    schroederSpatialSourceFamilyRole: sourceFamily?.sourceFamilyRole ?? null,
    schroederSpatialSourceGenerationId: sourceFamily?.sourceGenerationId ?? null,
    schroederSpatialSuccessorEpochIdentity:
      sourceFamily?.successorEpochIdentity ?? null,
    schroederSpatialSourcePositionAuthority:
      sourceFamily?.positionAuthority ?? null,
    schroederSpatialSourceQueryAuthority:
      sourceFamily?.spatialQueryAuthority ?? null
  };
}

function schroederSpatialSourceLineageEchoMatches(artifact, sourceFamily) {
  return Boolean(
    artifact?.schroederSpatialSourceFamily === sourceFamily
    && artifact?.schroederSpatialSourceFamilyStatus === sourceFamily?.status
    && artifact?.schroederSpatialSourceFamilyRole
      === sourceFamily?.sourceFamilyRole
    && artifact?.schroederSpatialSourceGenerationId
      === sourceFamily?.sourceGenerationId
    && artifact?.schroederSpatialSuccessorEpochIdentity
      === sourceFamily?.successorEpochIdentity
    && artifact?.schroederSpatialSourcePositionAuthority
      === sourceFamily?.positionAuthority
    && artifact?.schroederSpatialSourceQueryAuthority
      === sourceFamily?.spatialQueryAuthority
  );
}

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
  field_resolution: f32,
  field_scalar_offset: f32,
  position_clamp_min_x_m: f32,
  position_clamp_min_y_m: f32,
  position_clamp_min_z_m: f32,
  position_clamp_max_x_m: f32,
  position_clamp_max_y_m: f32,
  position_clamp_max_z_m: f32,
  position_clamp_enabled: f32,
  gradient_normals_enabled: f32,
  bounds_center_x_m: f32,
  bounds_center_y_m: f32,
  bounds_center_z_m: f32,
  bounds_radius_m: f32,
  field_row_stride: f32,
  field_gradient_pad0: f32,
  field_gradient_pad1: f32,
  field_gradient_pad2: f32,
};

@group(0) @binding(0) var<storage, read> compact_position_rows: array<f32>;
@group(0) @binding(1) var<storage, read_write> surface_vertex_rows: array<f32>;
@group(0) @binding(2) var<storage, read_write> surface_draw_rows: array<f32>;
@group(0) @binding(3) var<storage, read_write> surface_draw_indirect_rows: array<u32>;
@group(0) @binding(4) var<uniform> params: SurfaceTranslationParams;
@group(0) @binding(5) var<storage, read> source_vertex_count_rows: array<u32>;
@group(0) @binding(6) var<storage, read> field_rows: array<f32>;

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

fn field_sample(v: vec3<i32>) -> f32 {
  let r = i32(params.field_resolution);
  let c = clamp(v, vec3<i32>(0), vec3<i32>(r - 1));
  // Cell rows carry [density, paletteR, paletteG, paletteB]; density is lane 0.
  let idx = u32((c.z * r * r + c.y * r + c.x) * i32(params.field_row_stride) + i32(params.field_scalar_offset));
  return field_rows[idx];
}

fn field_trilinear(p: vec3<f32>) -> f32 {
  let base = floor(p);
  let f = p - base;
  let b = vec3<i32>(base);
  let c00 = mix(field_sample(b), field_sample(b + vec3<i32>(1, 0, 0)), f.x);
  let c10 = mix(field_sample(b + vec3<i32>(0, 1, 0)), field_sample(b + vec3<i32>(1, 1, 0)), f.x);
  let c01 = mix(field_sample(b + vec3<i32>(0, 0, 1)), field_sample(b + vec3<i32>(1, 0, 1)), f.x);
  let c11 = mix(field_sample(b + vec3<i32>(0, 1, 1)), field_sample(b + vec3<i32>(1, 1, 1)), f.x);
  return mix(mix(c00, c10, f.y), mix(c01, c11, f.y), f.z);
}

// Isosurface normal from the density-field gradient (the physical surface
// normal), oriented coherently with the triangle winding. Falls back to the
// face normal when the gradient degenerates or the field is not bound.
fn field_gradient_normal(p: vec3<f32>, face_normal: vec3<f32>) -> vec3<f32> {
  if (params.gradient_normals_enabled <= 0.5) {
    return face_normal;
  }
  let h = 0.75;
  let g = vec3<f32>(
    field_trilinear(p + vec3<f32>(h, 0.0, 0.0)) - field_trilinear(p - vec3<f32>(h, 0.0, 0.0)),
    field_trilinear(p + vec3<f32>(0.0, h, 0.0)) - field_trilinear(p - vec3<f32>(0.0, h, 0.0)),
    field_trilinear(p + vec3<f32>(0.0, 0.0, h)) - field_trilinear(p - vec3<f32>(0.0, 0.0, h))
  );
  let len = length(g);
  if (len <= 0.000000001) {
    return face_normal;
  }
  var n = g / len;
  if (dot(n, face_normal) < 0.0) {
    n = -n;
  }
  return n;
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
  surface_draw_indirect_rows[3u] = 0u;
}

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) id: vec3<u32>) {
  let triangle_index = id.x;
  let triangle_count = actual_triangle_count();
  if (triangle_index >= triangle_count) {
    return;
  }
  let vertex_base = triangle_index * 3u;
  let g0 = compact_position(vertex_base + 0u);
  let g1 = compact_position(vertex_base + 1u);
  let g2 = compact_position(vertex_base + 2u);
  // Degenerate slivers (grid-space area below any visible scale) contribute
  // only shading noise at the fluid boundary; collapse them so the
  // rasterizer culls the zero-area result.
  let grid_area2 = length(cross(g1 - g0, g2 - g0));
  let degenerate = grid_area2 < 0.02;
  let p0 = clamp_world_position(ulg_world_position(g0));
  let p1r = clamp_world_position(ulg_world_position(g1));
  let p2r = clamp_world_position(ulg_world_position(g2));
  let p1 = select(p1r, p0, degenerate);
  let p2 = select(p2r, p0, degenerate);
  let face_normal = normalize_or_fallback(cross(p1 - p0, p2 - p0));
  write_vertex(vertex_base + 0u, triangle_index, p0, field_gradient_normal(g0, face_normal));
  write_vertex(vertex_base + 1u, triangle_index, p1, field_gradient_normal(g1, face_normal));
  write_vertex(vertex_base + 2u, triangle_index, p2, field_gradient_normal(g2, face_normal));
  if (triangle_index == 0u) {
    write_draw_metadata(triangle_count);
  }
}
`;

export const webGpuMarchingCubesExtensionCompactSurfaceDrawWgsl = /* wgsl */`
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
  field_resolution: f32,
  field_scalar_offset: f32,
  position_clamp_min_x_m: f32,
  position_clamp_min_y_m: f32,
  position_clamp_min_z_m: f32,
  position_clamp_max_x_m: f32,
  position_clamp_max_y_m: f32,
  position_clamp_max_z_m: f32,
  position_clamp_enabled: f32,
  gradient_normals_enabled: f32,
  bounds_center_x_m: f32,
  bounds_center_y_m: f32,
  bounds_center_z_m: f32,
  bounds_radius_m: f32,
  field_row_stride: f32,
  field_gradient_pad0: f32,
  field_gradient_pad1: f32,
  field_gradient_pad2: f32,
};

@group(0) @binding(0) var<storage, read_write> surface_draw_rows: array<f32>;
@group(0) @binding(1) var<storage, read_write> surface_draw_indirect_rows: array<u32>;
@group(0) @binding(2) var<uniform> params: SurfaceTranslationParams;
@group(0) @binding(3) var<storage, read> source_vertex_count_rows: array<u32>;

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
  surface_draw_indirect_rows[3u] = 0u;
}

@compute @workgroup_size(1)
fn main(@builtin(global_invocation_id) id: vec3<u32>) {
  if (id.x > 0u) {
    return;
  }
  write_draw_metadata(actual_triangle_count());
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
    return Object.freeze({
      enabled: false,
      status: 'position-transform-disabled',
      resolution: resolvedResolution || null,
      fieldPadding: Number.isFinite(resolvedFieldPadding) ? resolvedFieldPadding : null,
      refEdgeM: Number.isFinite(resolvedRefEdgeM) ? resolvedRefEdgeM : null,
      scaleM: 1,
      originM: Object.freeze([0, 0, 0]),
      gridBias: 0
    });
  }
  const scaleM = resolvedRefEdgeM / (span * resolvedResolution);
  const origin = -resolvedFieldPadding * resolvedRefEdgeM / span;
  return Object.freeze({
    enabled: true,
    status: 'ulg-render-field-grid-to-world-transform-ready',
    resolution: resolvedResolution,
    fieldPadding: resolvedFieldPadding,
    refEdgeM: resolvedRefEdgeM,
    scaleM,
    originM: Object.freeze([origin, origin, origin]),
    gridBias: finiteNumber(positionGridBias, -0.5)
  });
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

function surfacePolicyRole(surfaceRecord = null) {
  const role = surfaceRecord?.role ?? surfaceRecord?.renderDomainRole ?? null;
  if (role === 'drop' || role === 'base') return role;
  const key = String(surfaceRecord?.renderDomainKey ?? surfaceRecord?.surfaceKey ?? '').toLowerCase();
  if (key.includes('drop')) return 'drop';
  if (key.includes('base')) return 'base';
  const id = Math.round(finiteNumber(surfaceRecord?.renderDomainId, 0));
  if (id === 1) return 'base';
  if (id === 2) return 'drop';
  return null;
}

function normalizeSurfacePolicyMaterial(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function resolveAlgorithmSurfaceExtractionPolicy(rows, surfaceRecord) {
  if (!rows || rows.schema !== ULG_ALGORITHM_SURFACE_EXTRACTION_ROWS_SCHEMA) {
    return {
      status: 'algorithm-surface-policy-rows-not-supplied',
      row: null
    };
  }
  const policyRows = Array.isArray(rows.rows) ? rows.rows : [];
  const role = surfacePolicyRole(surfaceRecord);
  const material = normalizeSurfacePolicyMaterial(surfaceRecord?.material);
  const phase = normalizeSurfacePolicyMaterial(surfaceRecord?.phase);
  const matchesMaterialPhase = (candidate) => (
    Boolean(material)
    && normalizeSurfacePolicyMaterial(candidate.material) === material
    && (!phase || normalizeSurfacePolicyMaterial(candidate.phase) === phase)
  );
  const row = role
    ? policyRows.find((candidate) => candidate.role === role && matchesMaterialPhase(candidate)) || null
    : policyRows.find(matchesMaterialPhase) || null;
  return {
    status: row ? 'algorithm-surface-policy-row-selected' : 'algorithm-surface-policy-row-not-found',
    row
  };
}

export function createUlgRenderFieldBufferVolumeDescriptor({
  device = null,
  renderField = null,
  renderFieldExecution = null,
  surface = null,
  surfaceIndex = 0,
  algorithmMaterialSurfaceExtractionRows = null,
  label = 'ulg-sph-render-field-density-volume',
  source = 'ulg-render-field-density-storage-buffer'
} = {}) {
  let field = renderField || renderFieldExecution?.result || renderFieldExecution?.renderField || null;
  if (!field) {
    return renderFieldBufferVolumeBlocked(
      'ulg-render-field-buffer-volume-blocked-missing-render-field',
      'retained ULG render-field metadata is required before native marching-cubes buffer-volume extraction'
    );
  }
  const schroederSpatialSourceFamily =
    field.schroederSpatialSourceFamily
    ?? renderFieldExecution?.schroederSpatialSourceFamily
    ?? null;
  if (!schroederSpatialSourceFamily && (
    hasSchroederSpatialLineageClaim(field)
    || hasSchroederSpatialLineageClaim(renderFieldExecution)
  )) {
    return renderFieldBufferVolumeBlocked(
      'ulg-render-field-buffer-volume-blocked-partial-successor-lineage',
      'native extraction rejects partial Schroeder lineage without the exact branded source family'
    );
  }
  if (schroederSpatialSourceFamily) {
    resolveSchroederSpatialSuccessorSourceFamily(
      schroederSpatialSourceFamily,
      {
        device,
        particleCount:
          field.particleCount ?? schroederSpatialSourceFamily.particleCount
      }
    );
    const sourceFieldAuthority =
      field.schroederSpatialSourceFieldAuthority ?? field;
    const fieldRowsBuffer = sourceFieldAuthority.fieldRowsBuffer ?? null;
    const exactLineageOptions = {
      device,
      sourceFamily: schroederSpatialSourceFamily,
      particleCount:
        sourceFieldAuthority.particleCount
        ?? schroederSpatialSourceFamily.particleCount,
      fieldRowsBuffer,
      fieldRows: fieldRowsBuffer ? null : sourceFieldAuthority.fieldRows,
      surfaceBuffer: sourceFieldAuthority.surfaceBuffer ?? null,
      surfaceTable: sourceFieldAuthority.surfaceTable ?? null
    };
    const sourceLocalLineage =
      validateSphMaterialInterfaceSourceFieldSuccessorLineage(
        sourceFieldAuthority,
        exactLineageOptions
      );
    const denseRenderLineage = validateSphRenderFieldSuccessorSourceLineage(
      sourceFieldAuthority,
      exactLineageOptions
    );
    if (!sourceLocalLineage && !denseRenderLineage) {
      return renderFieldBufferVolumeBlocked(
        'ulg-render-field-buffer-volume-blocked-successor-lineage',
        'native extraction requires the exact module-authenticated successor source field'
      );
    }
    // All scalar/layout/surface metadata must come from the branded authority,
    // never from a wrapper that can substitute offsets or surface records.
    field = sourceFieldAuthority;
  }
  if (field.schema !== ULG_SPH_GPU_RENDER_FIELD_SCHEMA) {
    return renderFieldBufferVolumeBlocked(
      'ulg-render-field-buffer-volume-blocked-schema',
      'ULG buffer-volume extraction requires peercompute.ulg.sph-gpu-render-field.v1 input',
      { renderFieldSchema: field.schema ?? null }
    );
  }
  const scalarBuffer = schroederSpatialSourceFamily
    ? field.fieldRowsBuffer ?? null
    : field.fieldRowsBuffer || renderFieldExecution?.fieldRowsBuffer || null;
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
  const surfaceTable = schroederSpatialSourceFamily
    ? field.surfaceTable ?? null
    : field.surfaceTable || renderFieldExecution?.surfaceTable || null;
  const index = Math.max(0, Math.round(finiteNumber(surfaceIndex, 0)));
  const authoritativeSurfaceRecord = surfaceTable?.metadata?.[index] || null;
  if (
    schroederSpatialSourceFamily
    && surface != null
    && surface !== authoritativeSurfaceRecord
  ) {
    return renderFieldBufferVolumeBlocked(
      'ulg-render-field-buffer-volume-blocked-substituted-successor-surface',
      'successor extraction requires the exact surface metadata record owned by the authenticated source field',
      {
        renderFieldSchema: field.schema,
        surfaceIndex: index
      }
    );
  }
  const surfaceRecord = schroederSpatialSourceFamily
    ? authoritativeSurfaceRecord
    : surface || authoritativeSurfaceRecord;
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
  const authoredScalarByteLength = Math.max(0, fieldRowsBufferByteLength);
  const scalarBufferByteLength = Math.max(0,
    authoredScalarByteLength > 0 && rawBufferByteLength > 0
      ? Math.min(authoredScalarByteLength, rawBufferByteLength)
      : (authoredScalarByteLength || rawBufferByteLength));
  const bufferDevice = scalarBuffer.device
    || scalarBuffer.ownerDevice
    || scalarBuffer.__webgpuDevice
    || scalarBuffer.__webgpuMarchingCubesDevice
    || null;
  const sameDeviceStatus = device && bufferDevice
    ? (device === bufferDevice ? 'same-device' : 'cross-device-resource')
    : 'same-device-validation-deferred-to-extension';
  const authoredScalarByteLengthExceedsBuffer = Boolean(
    authoredScalarByteLength > 0
    && rawBufferByteLength > 0
    && authoredScalarByteLength > rawBufferByteLength
  );
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
  if (authoredScalarByteLengthExceedsBuffer || !byteLengthValid) {
    return renderFieldBufferVolumeBlocked(
      'ulg-render-field-buffer-volume-blocked-undersized-buffer',
      authoredScalarByteLengthExceedsBuffer
        ? 'render-field metadata claims more scalar bytes than the retained GPU buffer owns'
        : 'fieldRowsBuffer is smaller than the selected render-field surface sub-volume',
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
  const surfacePolicy = resolveAlgorithmSurfaceExtractionPolicy(
    algorithmMaterialSurfaceExtractionRows,
    surfaceRecord
  );
  const surfacePolicyRow = surfacePolicy.row;
  const renderFieldIsolation = surfaceRecord.isolation == null
    ? null
    : Number(surfaceRecord.isolation);
  const requestedPolicyIsovalue = surfacePolicyRow?.isovalue == null
    ? null
    : Number(surfacePolicyRow.isovalue);
  const hasRenderFieldIsolation = Number.isFinite(renderFieldIsolation);
  const hasRequestedPolicyIsovalue = Number.isFinite(requestedPolicyIsovalue);
  const surfaceExtractionPolicyApplied = false;
  const resolvedIsovalue = hasRenderFieldIsolation ? renderFieldIsolation : null;
  const surfaceExtractionIsovalueSource = hasRenderFieldIsolation
    ? 'render-field-surface-isolation'
    : 'isovalue-unavailable';
  const surfaceExtractionPolicyApplicationStatus = hasRenderFieldIsolation
    ? 'algorithm-surface-policy-not-applied-render-field-isolation-authoritative'
    : 'algorithm-surface-policy-not-applied-render-field-isolation-required';
  const surfaceExtractionPolicyApplicationReason = hasRenderFieldIsolation
    ? 'the retained scalar field and its authored isolation share the renderer scalar convention'
    : 'native extraction requires the retained render-field isolation; policy rows are not renderer-authoritative for this scalar convention';
  const surfaceExtractionPolicyMetadata = {
    surfaceExtractionIsovalueSource,
    surfaceExtractionPolicyStatus: surfacePolicy.status,
    surfaceExtractionPolicyApplied,
    surfaceExtractionPolicyApplicationStatus,
    surfaceExtractionPolicyApplicationReason,
    surfaceExtractionPolicyRequestedIsovalue: hasRequestedPolicyIsovalue
      ? requestedPolicyIsovalue
      : null,
    surfaceExtractionPolicyRendererAuthority: surfacePolicyRow?.rendererAuthority ?? null,
    surfaceExtractionPolicyStrictSourceOfTruth: surfacePolicyRow?.strictSourceOfTruth ?? null,
    surfaceExtractionPolicyRowsSchema: algorithmMaterialSurfaceExtractionRows?.schema ?? null,
    surfaceExtractionPolicyRowSchema: surfacePolicyRow?.schema ?? null,
    surfaceExtractionPolicyRole: surfacePolicyRow?.role ?? null,
    surfaceExtractionPolicyMaterial: surfacePolicyRow?.material ?? null,
    surfaceExtractionPolicyPhase: surfacePolicyRow?.phase ?? null,
    surfaceExtractionPolicyIsovaluePolicy: surfacePolicyRow?.isovaluePolicy ?? null,
    surfaceExtractionPolicySmoothingRadiusM: surfacePolicyRow?.smoothingRadiusM ?? null,
    surfaceExtractionPolicyVoxelSizeM: surfacePolicyRow?.voxelSizeM ?? null,
    surfaceExtractionPolicyNormalScaleM: surfacePolicyRow?.normalScaleM ?? null
  };
  if (!hasRenderFieldIsolation) {
    return renderFieldBufferVolumeBlocked(
      'ulg-render-field-buffer-volume-blocked-missing-isolation',
      'retained render-field surface metadata must author a finite isolation for native extraction',
      {
        renderFieldSchema: field.schema,
        surfaceIndex: index,
        surfaceKey: surfaceRecord.surfaceKey ?? null,
        ...surfaceExtractionPolicyMetadata
      }
    );
  }
  const descriptor = {
    schema: ULG_SPH_WEBGPU_MARCHING_CUBES_BUFFER_VOLUME_DESCRIPTOR_SCHEMA,
    ok: true,
    status: 'ulg-render-field-buffer-volume-descriptor-ready',
    reason: null,
    extensionDescriptorFactory: 'createBufferVolumeDescriptor',
    renderFieldSchema: field.schema,
    renderFieldBackend: field.backend ?? renderFieldExecution?.backend ?? null,
    ...schroederSpatialSourceLineage(schroederSpatialSourceFamily),
    schroederSpatialSourceFieldAuthority:
      field.schroederSpatialSourceFieldAuthority
      ?? (schroederSpatialSourceFamily ? field : null),
    source,
    sourceType: WEBGPU_MARCHING_CUBES_SCALAR_BUFFER_VOLUME_SOURCE,
    scalarLayoutName: WEBGPU_MARCHING_CUBES_SCALAR_BUFFER_LAYOUT_NAME,
    scalarType: 'f32',
    scalarLane: 'density',
    scalarLaneIndex: 0,
    normalSign: -1,
    normalSemantic: 'outward-density-gradient',
    normalSourceSemantic: 'scalar-gradient',
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
    isolation: resolvedIsovalue,
    isovalue: resolvedIsovalue,
    ...surfaceExtractionPolicyMetadata,
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
  if (schroederSpatialSourceFamily) {
    Object.freeze(descriptor.scalarStrides);
    Object.freeze(descriptor.dims);
    Object.freeze(descriptor.positionTransformOriginM);
    schroederVolumeDescriptorLineageRecords.set(descriptor, Object.freeze({
      device,
      sourceFamily: schroederSpatialSourceFamily,
      sourceField: field,
      scalarBuffer,
      surfaceBuffer: field.surfaceBuffer ?? null,
      surfaceTable: field.surfaceTable,
      surfaceRecord,
      surfaceIndex: index,
      surfaceKey: descriptor.surfaceKey,
      material: descriptor.material,
      phase: descriptor.phase,
      renderKey: descriptor.renderKey,
      renderDomainId: descriptor.renderDomainId,
      renderDomainKey: descriptor.renderDomainKey,
      scalarOffset,
      scalarOffsetBytes,
      scalarStrides: [...scalarStrides],
      dims: [...dims],
      scalarBufferByteLength,
      scalarRequiredByteLength,
      scalarType: descriptor.scalarType,
      normalSign: descriptor.normalSign,
      fieldOffset,
      fieldCellCount: descriptor.fieldCellCount,
      isovalue: resolvedIsovalue,
      cellRowStrideFloats: rowStrideFloats,
      rowStrideFloats: descriptor.rowStrideFloats,
      sliceStrideFloats: descriptor.sliceStrideFloats,
      fieldPadding: field.fieldPadding,
      refEdgeM: field.refEdgeM,
      positionTransform: descriptor.positionTransform,
      positionTransformStatus: descriptor.positionTransformStatus,
      positionTransformGridBias: descriptor.positionTransformGridBias,
      positionTransformScaleM: descriptor.positionTransformScaleM,
      positionTransformOriginM: [...descriptor.positionTransformOriginM]
    }));
    Object.freeze(descriptor);
  }
  return descriptor;
}

function validateUlgRenderFieldBufferVolumeSuccessorDescriptorSnapshot(
  descriptor,
  record,
  { device, sourceFamily }
) {
  return Boolean(
    record
    && record.device === device
    && record.sourceFamily === sourceFamily
    && descriptor.schema
      === ULG_SPH_WEBGPU_MARCHING_CUBES_BUFFER_VOLUME_DESCRIPTOR_SCHEMA
    && descriptor.ok === true
    && descriptor.status === 'ulg-render-field-buffer-volume-descriptor-ready'
    && descriptor.device === device
    && descriptor.scalarBuffer === record.scalarBuffer
    && descriptor.storageBuffer === record.scalarBuffer
    && descriptor.buffer === record.scalarBuffer
    && descriptor.schroederSpatialSourceFamily === sourceFamily
    && descriptor.schroederSpatialSourceFieldAuthority === record.sourceField
    && descriptor.scalarBufferByteLength === record.scalarBufferByteLength
    && descriptor.bufferByteLength === record.scalarBufferByteLength
    && descriptor.scalarRequiredByteLength === record.scalarRequiredByteLength
    && descriptor.scalarType === record.scalarType
    && descriptor.normalSign === record.normalSign
    && descriptor.surfaceIndex === record.surfaceIndex
    && descriptor.surfaceKey === record.surfaceKey
    && descriptor.material === record.material
    && descriptor.phase === record.phase
    && descriptor.renderKey === record.renderKey
    && descriptor.renderDomainId === record.renderDomainId
    && descriptor.renderDomainKey === record.renderDomainKey
    && descriptor.scalarOffset === record.scalarOffset
    && descriptor.scalarOffsetBytes === record.scalarOffsetBytes
    && descriptor.fieldOffset === record.fieldOffset
    && descriptor.fieldCellCount === record.fieldCellCount
    && descriptor.isolation === record.isovalue
    && descriptor.isovalue === record.isovalue
    && descriptor.cellRowStrideFloats === record.cellRowStrideFloats
    && descriptor.rowStrideFloats === record.rowStrideFloats
    && descriptor.sliceStrideFloats === record.sliceStrideFloats
    && descriptor.fieldPadding === record.fieldPadding
    && descriptor.refEdgeM === record.refEdgeM
    && descriptor.positionTransform === record.positionTransform
    && descriptor.positionTransformStatus === record.positionTransformStatus
    && descriptor.positionTransformGridBias
      === record.positionTransformGridBias
    && descriptor.positionTransformScaleM === record.positionTransformScaleM
    && Array.isArray(descriptor.positionTransformOriginM)
    && descriptor.positionTransformOriginM.length
      === record.positionTransformOriginM.length
    && descriptor.positionTransformOriginM.every(
      (value, index) => value === record.positionTransformOriginM[index]
    )
    && Array.isArray(descriptor.dims)
    && descriptor.dims.length === record.dims.length
    && descriptor.dims.every((value, index) => value === record.dims[index])
    && Array.isArray(descriptor.scalarStrides)
    && descriptor.scalarStrides.length === record.scalarStrides.length
    && descriptor.scalarStrides.every(
      (value, index) => value === record.scalarStrides[index]
    )
  );
}

export function validateUlgRenderFieldBufferVolumeSuccessorLineage(
  descriptor,
  { device, sourceFamily = descriptor?.schroederSpatialSourceFamily } = {}
) {
  const record = schroederVolumeDescriptorLineageRecords.get(descriptor);
  if (!validateUlgRenderFieldBufferVolumeSuccessorDescriptorSnapshot(
    descriptor,
    record,
    { device, sourceFamily }
  )) {
    return false;
  }
  const fieldRowsBuffer = record.sourceField.fieldRowsBuffer ?? null;
  const exactFieldOptions = {
    device,
    sourceFamily,
    particleCount: record.sourceField.particleCount,
    fieldRowsBuffer,
    fieldRows: fieldRowsBuffer ? null : record.sourceField.fieldRows,
    surfaceBuffer: record.surfaceBuffer,
    surfaceTable: record.surfaceTable
  };
  return Boolean(
    validateSphMaterialInterfaceSourceFieldSuccessorLineage(
      record.sourceField,
      exactFieldOptions
    )
    || validateSphRenderFieldSuccessorSourceLineage(
      record.sourceField,
      exactFieldOptions
    )
  );
}

function schroederExtensionVolumeState(volume) {
  return {
    volume,
    device: volume?.device ?? null,
    scalarBuffer: volume?.scalarBuffer ?? null,
    storageBuffer: volume?.storageBuffer ?? null,
    sourceType: volume?.sourceType ?? null,
    scalarOffset: volume?.scalarOffset ?? null,
    scalarOffsetBytes: volume?.scalarOffsetBytes ?? null,
    scalarType: volume?.scalarType ?? null,
    normalSign: volume?.normalSign ?? null,
    scalarBufferByteLength: volume?.scalarBufferByteLength ?? null,
    scalarRequiredByteLength: volume?.scalarRequiredByteLength ?? null,
    rowStrideFloats: volume?.rowStrideFloats ?? null,
    sliceStrideFloats: volume?.sliceStrideFloats ?? null,
    numVoxels: volume?.numVoxels ?? null,
    dualGridNumVoxels: volume?.dualGridNumVoxels ?? null,
    diagonalLength: volume?.diagonalLength ?? null,
    dims: Array.from(volume?.dims ?? []),
    dualGridDims: Array.from(volume?.dualGridDims ?? []),
    scalarStrides: Array.from(volume?.scalarStrides ?? [])
  };
}

function validateSchroederExtensionVolumeRecord(record) {
  if (!record) return false;
  const state = schroederExtensionVolumeState(record.volume);
  return Boolean(
    validateUlgRenderFieldBufferVolumeSuccessorLineage(
      record.descriptor,
      { device: record.device, sourceFamily: record.sourceFamily }
    )
    && state.volume === record.volumeState.volume
    && state.device === record.volumeState.device
    && state.scalarBuffer === record.volumeState.scalarBuffer
    && state.storageBuffer === record.volumeState.storageBuffer
    && state.sourceType === record.volumeState.sourceType
    && state.scalarOffset === record.volumeState.scalarOffset
    && state.scalarOffsetBytes === record.volumeState.scalarOffsetBytes
    && state.scalarType === record.volumeState.scalarType
    && state.normalSign === record.volumeState.normalSign
    && state.scalarBufferByteLength
      === record.volumeState.scalarBufferByteLength
    && state.scalarRequiredByteLength
      === record.volumeState.scalarRequiredByteLength
    && state.rowStrideFloats === record.volumeState.rowStrideFloats
    && state.sliceStrideFloats === record.volumeState.sliceStrideFloats
    && state.numVoxels === record.volumeState.numVoxels
    && state.dualGridNumVoxels === record.volumeState.dualGridNumVoxels
    && state.diagonalLength === record.volumeState.diagonalLength
    && state.dims.length === record.volumeState.dims.length
    && state.dims.every(
      (value, index) => value === record.volumeState.dims[index]
    )
    && state.dualGridDims.length === record.volumeState.dualGridDims.length
    && state.dualGridDims.every(
      (value, index) => value === record.volumeState.dualGridDims[index]
    )
    && state.scalarStrides.length === record.volumeState.scalarStrides.length
    && state.scalarStrides.every(
      (value, index) => value === record.volumeState.scalarStrides[index]
    )
  );
}

export function bindUlgWebGpuMarchingCubesVolumeSuccessorLineage({
  device,
  descriptor,
  volume
} = {}) {
  const sourceFamily = descriptor?.schroederSpatialSourceFamily ?? null;
  if (!sourceFamily) return null;
  if (!validateUlgRenderFieldBufferVolumeSuccessorLineage(
    descriptor,
    { device, sourceFamily }
  )) {
    throw new TypeError(
      'marching-cubes volume requires an active authenticated successor descriptor'
    );
  }
  const expectedDualGridDims = descriptor.dims.map(
    (dimension) => Math.max(0, dimension - 1)
  );
  const expectedNumVoxels = descriptor.dims.reduce(
    (product, dimension) => product * dimension,
    1
  );
  const expectedDualGridNumVoxels = expectedDualGridDims.reduce(
    (product, dimension) => product * dimension,
    1
  );
  if (
    !volume
    || volume.device !== device
    || volume.scalarBuffer !== descriptor.scalarBuffer
    || volume.storageBuffer !== descriptor.scalarBuffer
    || volume.sourceType !== descriptor.sourceType
    || volume.scalarType !== descriptor.scalarType
    || volume.scalarBufferByteLength !== descriptor.scalarBufferByteLength
    || volume.scalarRequiredByteLength !== descriptor.scalarRequiredByteLength
    || volume.scalarOffset !== descriptor.scalarOffset
    || volume.scalarOffsetBytes !== descriptor.scalarOffsetBytes
    || volume.rowStrideFloats !== descriptor.rowStrideFloats
    || volume.sliceStrideFloats !== descriptor.sliceStrideFloats
    || volume.normalSign !== descriptor.normalSign
    || volume.numVoxels !== expectedNumVoxels
    || volume.dualGridNumVoxels !== expectedDualGridNumVoxels
    || !Array.isArray(volume.dims)
    || volume.dims.length !== descriptor.dims.length
    || !volume.dims.every((value, index) => value === descriptor.dims[index])
    || !Array.isArray(volume.dualGridDims)
    || volume.dualGridDims.length !== expectedDualGridDims.length
    || !volume.dualGridDims.every(
      (value, index) => value === expectedDualGridDims[index]
    )
    || !Array.isArray(volume.scalarStrides)
    || volume.scalarStrides.length !== descriptor.scalarStrides.length
    || !volume.scalarStrides.every(
      (value, index) => value === descriptor.scalarStrides[index]
    )
  ) {
    throw new TypeError(
      'marching-cubes volume does not exactly match its authenticated successor descriptor'
    );
  }
  const record = Object.freeze({
    device,
    descriptor,
    volume,
    volumeState: Object.freeze(schroederExtensionVolumeState(volume)),
    sourceFamily,
    scalarBuffer: descriptor.scalarBuffer,
    surfaceIndex: descriptor.surfaceIndex,
    isovalue: descriptor.isovalue
  });
  schroederExtensionVolumeLineageRecords.set(volume, record);
  return Object.freeze({
    status: 'ulg-marching-cubes-successor-volume-lineage-bound',
    sourceFamilyRole: sourceFamily.sourceFamilyRole,
    sourceGenerationId: sourceFamily.sourceGenerationId,
    surfaceIndex: descriptor.surfaceIndex
  });
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
  surfaceBounds = null,
  fieldGradient = null
}) {
  const buffer = new ArrayBuffer(160);
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
  view.setFloat32(88, finiteNumber(fieldGradient?.resolution, 0), true);
  view.setFloat32(92, finiteNumber(fieldGradient?.scalarOffsetFloats, 0), true);
  view.setFloat32(124, fieldGradient?.buffer ? 1 : 0, true);
  view.setFloat32(144, finiteNumber(fieldGradient?.rowStrideFloats, 1), true);
  view.setFloat32(84, resolvedTransform ? 1 : 0, true);
  view.setFloat32(96, clampMinM[0], true);
  view.setFloat32(100, clampMinM[1], true);
  view.setFloat32(104, clampMinM[2], true);
  view.setFloat32(108, clampMaxM[0], true);
  view.setFloat32(112, clampMaxM[1], true);
  view.setFloat32(116, clampMaxM[2], true);
  view.setFloat32(120, resolvedClamp ? 1 : 0, true);
  view.setFloat32(128, boundsCenterM[0], true);
  view.setFloat32(132, boundsCenterM[1], true);
  view.setFloat32(136, boundsCenterM[2], true);
  view.setFloat32(140, finiteNumber(resolvedBounds?.radiusM, 0), true);
  return buffer;
}

async function readBuffer(device, sourceBuffer, byteLength, label = 'ulg-sph-marching-cubes-extension-readback') {
  let readback = null;
  let mapped = false;
  try {
    readback = device.createBuffer({
      label,
      size: Math.max(4, byteLength),
      usage: GPU_BUFFER_USAGE.MAP_READ | GPU_BUFFER_USAGE.COPY_DST
    });
    const encoder = device.createCommandEncoder();
    encoder.copyBufferToBuffer(sourceBuffer, 0, readback, 0, byteLength);
    device.queue.submit([encoder.finish()]);
    await readback.mapAsync(GPU_MAP_MODE.READ);
    mapped = true;
    return readback.getMappedRange().slice(0);
  } finally {
    if (mapped) {
      try { readback?.unmap?.(); } catch {}
    }
    try { readback?.destroy?.(); } catch {}
  }
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
  boundsRadiusM = null,
  indirectRowIndex = 0,
  indirectOffsetBytes = null
}) {
  const resolvedBoundsCenterM = vector3(boundsCenterM, [0, 0, 0]);
  const resolvedBoundsRadiusM = finiteNumber(boundsRadiusM, 0);
  const resolvedVertexCount = Number.isFinite(Number(vertexCount))
    ? Math.max(0, Math.round(Number(vertexCount)))
    : null;
  const resolvedTriangleCount = Number.isFinite(Number(triangleCount))
    ? Math.max(0, Math.round(Number(triangleCount)))
    : null;
  const resolvedIndirectRowIndex = Math.max(0, Math.round(finiteNumber(indirectRowIndex, 0)));
  const indirectStrideBytes = SPH_GPU_RENDER_SURFACE_DRAW_INDIRECT_ROW_LAYOUT.length
    * Uint32Array.BYTES_PER_ELEMENT;
  const resolvedIndirectOffsetBytes = Number.isFinite(Number(indirectOffsetBytes))
    ? Math.max(0, Math.round(Number(indirectOffsetBytes)))
    : resolvedIndirectRowIndex * indirectStrideBytes;
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
    indirectRowIndex: resolvedIndirectRowIndex,
    indirectOffsetBytes: resolvedIndirectOffsetBytes,
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
  const normal = packedNormalRowsSource(result);
  if (
    normal.resourceOwnership?.ok === false
    || normal.resourceOwnership?.status === 'cross-device-resource'
  ) {
    throw new TypeError(
      `extension packed normal buffer is not owned by this GPUDevice (${normal.resourceOwnership.status})`
    );
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

function packedNormalRowsSource(result = null) {
  const outputDescriptors = result?.outputDescriptors || null;
  const outputNormal = outputDescriptors?.rows?.normal || null;
  const rowMetadataNormal = result?.rowMetadata?.normal || null;
  const normal = outputNormal || rowMetadataNormal || null;
  const descriptor = normal?.normalBufferDescriptor
    || outputDescriptors?.normalBufferDescriptor
    || null;
  const generation = isObject(descriptor?.generation) ? descriptor.generation : null;
  const generationDescriptorAuthored = generation != null;
  const surfaceGenerationIdAuthored = Boolean(
    generationDescriptorAuthored
    && Object.prototype.hasOwnProperty.call(generation, 'surfaceGenerationId')
  );
  const pairedPositionSurfaceGenerationIdAuthored = Boolean(
    generationDescriptorAuthored
    && Object.prototype.hasOwnProperty.call(generation, 'pairedPositionSurfaceGenerationId')
  );
  const volumeGenerationIdAuthored = Boolean(
    generationDescriptorAuthored
    && Object.prototype.hasOwnProperty.call(generation, 'volumeGenerationId')
  );
  const buffer = normal?.buffer
    || outputDescriptors?.retainedBuffers?.normal
    || result?.normalBuffer
    || null;
  const bufferByteLength = Math.max(0, Math.round(finiteNumber(
    normal?.bufferByteLength
      ?? descriptor?.bufferByteLength
      ?? result?.normalBufferByteLength,
    0
  )));
  const rowCount = Math.max(0, Math.round(finiteNumber(
    normal?.rowCount ?? descriptor?.rowCount,
    0
  )));
  const surfaceGenerationId = surfaceGenerationIdAuthored
    ? generation.surfaceGenerationId
    : null;
  const pairedPositionSurfaceGenerationId = pairedPositionSurfaceGenerationIdAuthored
    ? generation.pairedPositionSurfaceGenerationId
    : null;
  const volumeGenerationId = volumeGenerationIdAuthored
    ? generation.volumeGenerationId
    : null;
  return {
    descriptorSchema: descriptor?.schema ?? null,
    rowSchema: normal?.schema ?? descriptor?.rowSchema ?? null,
    layoutName: normal?.layoutName ?? descriptor?.layoutName ?? null,
    encoding: normal?.encoding ?? descriptor?.encoding ?? result?.normalEncoding ?? null,
    semantic: normal?.semantic ?? descriptor?.semantic ?? result?.normalSemantic ?? null,
    sourceSemantic: normal?.sourceSemantic
      ?? descriptor?.sourceSemantic
      ?? result?.normalSourceSemantic
      ?? null,
    normalSign: Number(normal?.normalSign ?? descriptor?.normalSign ?? result?.normalSign),
    status: normal?.status ?? descriptor?.status ?? null,
    available: Boolean(normal?.available ?? descriptor?.available),
    buffer,
    bufferRetained: Boolean(
      (normal?.bufferRetained && normal?.buffer)
      || (descriptor?.bufferRetained && descriptor?.buffer)
      || (outputDescriptors?.retainedBuffers?.normal && buffer)
    ),
    bufferByteLength,
    rowStrideBytes: Math.max(0, Math.round(finiteNumber(
      normal?.rowStrideBytes ?? descriptor?.rowStrideBytes,
      0
    ))),
    rowCount,
    ownerDeviceId: normal?.ownerDeviceId ?? descriptor?.ownerDeviceId ?? null,
    resourceOwnership: normal?.resourceOwnership ?? descriptor?.resourceOwnership ?? null,
    generationDescriptorAuthored,
    surfaceGenerationIdAuthored,
    pairedPositionSurfaceGenerationIdAuthored,
    volumeGenerationIdAuthored,
    surfaceGenerationId,
    pairedPositionSurfaceGenerationId,
    volumeGenerationId,
    sameSubmitAsPosition: descriptor?.generation?.sameSubmitAsPosition === true,
    lifetimeOwner: descriptor?.lifetime?.owner ?? null,
    pairedWithPositionBuffer: descriptor?.lifetime?.pairedWithPositionBuffer === true,
    producerStage: descriptor?.producer?.stage ?? result?.normalProducerStage ?? null,
    timestampSpanLabel:
      descriptor?.producer?.timestampSpanLabel ?? result?.normalTimestampSpanLabel ?? null,
    additionalSubmitCount: Math.max(0, Math.round(finiteNumber(
      descriptor?.producer?.additionalSubmitCount ?? result?.normalAdditionalSubmitCount,
      0
    )))
  };
}

function schroederExtensionExecutionLineageState(
  extensionExecution,
  resolvedSummary = null
) {
  const result = extensionExecution?.result ?? null;
  const summary = resolvedSummary
    ?? summarizeWebGpuMarchingCubesExtensionExecution(extensionExecution);
  const positionSource = compactPositionRowsSource(result);
  const normalSource = packedNormalRowsSource(result);
  return {
    result,
    summaryFingerprint: JSON.stringify(summary),
    positionBuffer: positionSource.buffer ?? null,
    normalBuffer: normalSource.buffer ?? null,
    positionRows:
      result?.positionRows ?? result?.compactPositionRows ?? null,
    actualVertexCounterBuffer:
      result?.actualVertexCounterBuffer
      ?? result?.vertexCounterBuffer
      ?? null,
    drawIndirectBuffer: result?.drawIndirectBuffer ?? null,
    surfaceGenerationId: result?.surfaceGenerationId ?? null,
    volumeGenerationId: result?.volumeGenerationId ?? null,
    resultIsovalue: result?.isovalue ?? null
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
  const normalRows = packedNormalRowsSource(result);
  const extensionSurfaceSchema = result?.schema ?? null;
  const extensionOk = execution.ok === true;
  const extensionVertexCount = Math.max(0, Math.round(finiteNumber(result?.vertexCount, 0)));
  const extensionVertexCountMode = result?.vertexCountMode ?? null;
  const extensionVertexRowsBudget = result?.vertexRowsBudget == null
    ? null
    : Math.max(0, Math.round(finiteNumber(result.vertexRowsBudget, 0)));
  const extensionVertexRowsBudgetClamped = result?.vertexRowsBudgetClamped === true
    ? true
    : result?.vertexRowsBudgetClamped === false
      ? false
      : null;
  const extensionConservativeWorstCaseVertexCount = result?.conservativeWorstCaseVertexCount == null
    ? null
    : Math.max(0, Math.round(finiteNumber(result.conservativeWorstCaseVertexCount, 0)));
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
  const extensionDrawIndirectBuffer = result?.drawIndirectBuffer || null;
  const extensionDrawIndirectBufferByteLength = Math.max(
    0,
    Math.round(finiteNumber(
      result?.drawIndirectBufferByteLength
        ?? extensionDrawIndirectBuffer?.size,
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
  const normalVolumeGenerationMatches = Boolean(
    normalRows.volumeGenerationId == null && result?.volumeGenerationId == null
      ? true
      : Number.isInteger(normalRows.volumeGenerationId)
        && Number.isInteger(result?.volumeGenerationId)
        && normalRows.volumeGenerationId === result.volumeGenerationId
  );
  const normalGenerationMatches = Boolean(
    normalRows.generationDescriptorAuthored
    && normalRows.surfaceGenerationIdAuthored
    && normalRows.pairedPositionSurfaceGenerationIdAuthored
    && normalRows.volumeGenerationIdAuthored
    && Number.isInteger(normalRows.surfaceGenerationId)
    && Number.isInteger(normalRows.pairedPositionSurfaceGenerationId)
    && Number.isInteger(result?.surfaceGenerationId)
    && normalRows.surfaceGenerationId === normalRows.pairedPositionSurfaceGenerationId
    && normalRows.surfaceGenerationId === result.surfaceGenerationId
    && normalVolumeGenerationMatches
  );
  const extensionPackedNormalReady = Boolean(
    normalRows.descriptorSchema === WEBGPU_MARCHING_CUBES_NORMAL_BUFFER_DESCRIPTOR_SCHEMA
    && normalRows.rowSchema === WEBGPU_MARCHING_CUBES_PACKED_NORMAL_ROWS_SCHEMA
    && normalRows.layoutName === WEBGPU_MARCHING_CUBES_PACKED_NORMAL_LAYOUT_NAME
    && normalRows.encoding === WEBGPU_MARCHING_CUBES_PACKED_NORMAL_ENCODING
    && normalRows.semantic === 'oriented-scalar-gradient'
    && normalRows.sourceSemantic === 'scalar-gradient'
    && (normalRows.normalSign === -1 || normalRows.normalSign === 1)
    && normalRows.available
    && normalRows.bufferRetained
    && normalRows.buffer
    && normalRows.rowStrideBytes === Uint32Array.BYTES_PER_ELEMENT
    && normalRows.rowCount === extensionVertexCount
    && normalRows.bufferByteLength >= extensionVertexCount * Uint32Array.BYTES_PER_ELEMENT
    && normalRows.resourceOwnership?.ok !== false
    && normalRows.resourceOwnership?.status !== 'cross-device-resource'
    && normalGenerationMatches
    && normalRows.sameSubmitAsPosition
    && normalRows.pairedWithPositionBuffer
    && normalRows.lifetimeOwner === 'surface-result'
    && normalRows.additionalSubmitCount === 0
  );
  let extensionPackedNormalStatus = 'packed-normal-ready';
  if (!normalRows.buffer || !normalRows.bufferRetained) {
    extensionPackedNormalStatus = 'packed-normal-buffer-unavailable';
  } else if (!normalGenerationMatches) {
    extensionPackedNormalStatus = 'packed-normal-generation-mismatch';
  } else if (!extensionPackedNormalReady) {
    extensionPackedNormalStatus = 'packed-normal-contract-invalid';
  }
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
    extensionVertexRowsBudget,
    extensionVertexRowsBudgetClamped,
    extensionConservativeWorstCaseVertexCount,
    extensionActualVertexCounterBufferRetained: Boolean(extensionActualVertexCounterBuffer),
    extensionActualVertexCounterBufferByteLength,
    extensionDrawIndirectBufferRetained: Boolean(extensionDrawIndirectBuffer),
    extensionDrawIndirectBufferByteLength,
    extensionTriangleCount,
    extensionBufferRetained,
    extensionBufferByteLength: positionRows.bufferByteLength,
    extensionPackedNormalReady,
    extensionPackedNormalStatus,
    extensionNormalDescriptorSchema: normalRows.descriptorSchema,
    extensionNormalRowsSchema: normalRows.rowSchema,
    extensionNormalLayoutName: normalRows.layoutName,
    extensionNormalEncoding: normalRows.encoding,
    extensionNormalSemantic: normalRows.semantic,
    extensionNormalSourceSemantic: normalRows.sourceSemantic,
    extensionNormalSign: Number.isFinite(normalRows.normalSign) ? normalRows.normalSign : null,
    extensionNormalBufferRetained: normalRows.bufferRetained,
    extensionNormalBufferByteLength: normalRows.bufferByteLength,
    extensionNormalRowStrideBytes: normalRows.rowStrideBytes,
    extensionNormalRowCount: normalRows.rowCount,
    extensionNormalOwnerDeviceId: normalRows.ownerDeviceId,
    extensionNormalResourceOwnershipStatus: normalRows.resourceOwnership?.status ?? null,
    extensionNormalGenerationDescriptorAuthored: normalRows.generationDescriptorAuthored,
    extensionNormalSurfaceGenerationIdAuthored: normalRows.surfaceGenerationIdAuthored,
    extensionNormalPairedPositionSurfaceGenerationIdAuthored:
      normalRows.pairedPositionSurfaceGenerationIdAuthored,
    extensionNormalVolumeGenerationIdAuthored: normalRows.volumeGenerationIdAuthored,
    extensionNormalSurfaceGenerationId: normalRows.surfaceGenerationId,
    extensionNormalPairedPositionSurfaceGenerationId:
      normalRows.pairedPositionSurfaceGenerationId,
    extensionNormalVolumeGenerationId: normalRows.volumeGenerationId,
    extensionNormalSameSubmitAsPosition: normalRows.sameSubmitAsPosition,
    extensionNormalLifetimeOwner: normalRows.lifetimeOwner,
    extensionNormalPairedWithPositionBuffer: normalRows.pairedWithPositionBuffer,
    extensionNormalProducerStage: normalRows.producerStage,
    extensionNormalTimestampSpanLabel: normalRows.timestampSpanLabel,
    extensionNormalAdditionalSubmitCount: normalRows.additionalSubmitCount,
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
      const selectedVolume = input.volume || volume;
      const wrapperRecord = ulgExtensionAdapterRecords.get(wrapper);
      if (
        !wrapperRecord
        || wrapperRecord.device !== device
        || wrapperRecord.volume !== volume
      ) {
        throw new TypeError('marching-cubes extension wrapper authority is unavailable');
      }
      const volumeLineage = schroederExtensionVolumeLineageRecords.get(
        selectedVolume
      );
      if (volumeLineage) {
        const requestedIsovalue = input.isovalue
          ?? volumeLineage.descriptor.isovalue;
        if (
          selectedVolume !== volume
          || requestedIsovalue !== volumeLineage.descriptor.isovalue
          || !validateSchroederExtensionVolumeRecord(volumeLineage)
          || schroederExtensionVolumeLineageRecords.get(selectedVolume)
            !== volumeLineage
        ) {
          throw new TypeError(
            'marching-cubes extraction requires the active exact successor volume binding'
          );
        }
      }
      const resolvedAdapter = await ensureExtensionAdapter();
      if (volumeLineage && !validateSchroederExtensionVolumeRecord(volumeLineage)) {
        throw new TypeError(
          'marching-cubes successor volume changed while the extension adapter was resolving'
        );
      }
      const preflight = await wrapper.preflight(input);
      if (volumeLineage && !validateSchroederExtensionVolumeRecord(volumeLineage)) {
        throw new TypeError(
          'marching-cubes successor volume changed during extension preflight'
        );
      }
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
      const extractedSurfaceResult = extensionExecution?.result ?? null;
      const exactExtractedSurfaceRelease = extractedSurfaceResult?.release;
      let extractedSurfaceAccepted = false;
      try {
      const summary = summarizeWebGpuMarchingCubesExtensionExecution(extensionExecution);
      const executionLineageState = volumeLineage
        ? schroederExtensionExecutionLineageState(extensionExecution, summary)
        : null;
      if (executionLineageState) {
        for (const outputResource of [
          executionLineageState.positionBuffer,
          executionLineageState.normalBuffer,
          executionLineageState.positionRows,
          executionLineageState.actualVertexCounterBuffer,
          executionLineageState.drawIndirectBuffer
        ]) {
          quarantinePriorSchroederExtensionExecutionPublication(
            schroederExtensionOutputResourcePublications,
            outputResource
          );
        }
      }
      if (volumeLineage && !validateSchroederExtensionVolumeRecord(volumeLineage)) {
        throw new TypeError(
          'marching-cubes successor volume changed during extension extraction'
        );
      }
      const wrappedExecution = {
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
      if (volumeLineage) {
        if (
          executionLineageState.resultIsovalue
            !== volumeLineage.descriptor.isovalue
        ) {
          throw new TypeError(
            'marching-cubes successor output isovalue does not match its authenticated descriptor'
          );
        }
        const retainedOutputResources = [
          executionLineageState.positionBuffer,
          executionLineageState.normalBuffer,
          executionLineageState.actualVertexCounterBuffer,
          executionLineageState.drawIndirectBuffer
        ].filter(Boolean);
        if (
          retainedOutputResources.includes(volumeLineage.scalarBuffer)
          || new Set(retainedOutputResources).size
            !== retainedOutputResources.length
        ) {
          throw new TypeError(
            'marching-cubes successor output resources must be distinct from the source volume and from one another'
          );
        }
        const lineageRecord = {
          active: true,
          device,
          wrapper,
          volume: selectedVolume,
          descriptor: volumeLineage.descriptor,
          sourceFamily: volumeLineage.sourceFamily,
          scalarBuffer: volumeLineage.scalarBuffer,
          wrappedExecution,
          extensionExecution,
          extensionResult: executionLineageState.result,
          executionSummaryFingerprint:
            executionLineageState.summaryFingerprint,
          positionBuffer: executionLineageState.positionBuffer,
          normalBuffer: executionLineageState.normalBuffer,
          positionRows: executionLineageState.positionRows,
          positionRowsBytes: copyArrayBufferViewBytes(
            executionLineageState.positionRows
          ),
          actualVertexCounterBuffer:
            executionLineageState.actualVertexCounterBuffer,
          drawIndirectBuffer: executionLineageState.drawIndirectBuffer,
          surfaceGenerationId: executionLineageState.surfaceGenerationId,
          volumeGenerationId: executionLineageState.volumeGenerationId,
          resultIsovalue: executionLineageState.resultIsovalue,
          releaseMethod: null,
          isovalue: input.isovalue
            ?? volumeLineage.descriptor.isovalue
        };
        const originalRelease = executionLineageState.result?.release;
        if (typeof originalRelease !== 'function') {
          throw new TypeError(
            'marching-cubes successor output requires an authenticated release lifecycle'
          );
        } else {
          const lineageRelease = function (...args) {
            lineageRecord.active = false;
            return originalRelease.apply(this, args);
          };
          try {
            executionLineageState.result.release = lineageRelease;
          } catch {
            throw new TypeError(
              'marching-cubes successor output lifecycle cannot be authenticated'
            );
          }
          if (executionLineageState.result.release !== lineageRelease) {
            throw new TypeError(
              'marching-cubes successor output lifecycle cannot be authenticated'
            );
          }
          lineageRecord.releaseMethod = lineageRelease;
        }
        invalidatePriorSchroederExtensionExecutionPublication(
          schroederExtensionOutputResourcePublications,
          lineageRecord.positionBuffer,
          lineageRecord
        );
        invalidatePriorSchroederExtensionExecutionPublication(
          schroederExtensionOutputResourcePublications,
          lineageRecord.normalBuffer,
          lineageRecord
        );
        invalidatePriorSchroederExtensionExecutionPublication(
          schroederExtensionOutputResourcePublications,
          lineageRecord.positionRows,
          lineageRecord
        );
        invalidatePriorSchroederExtensionExecutionPublication(
          schroederExtensionOutputResourcePublications,
          lineageRecord.actualVertexCounterBuffer,
          lineageRecord
        );
        invalidatePriorSchroederExtensionExecutionPublication(
          schroederExtensionOutputResourcePublications,
          lineageRecord.drawIndirectBuffer,
          lineageRecord
        );
        schroederExtensionExecutionLineageRecords.set(
          wrappedExecution,
          lineageRecord
        );
        if (extensionExecution && typeof extensionExecution === 'object') {
          schroederExtensionExecutionLineageRecords.set(
            extensionExecution,
            lineageRecord
          );
        }
      }
        extractedSurfaceAccepted = true;
        return wrappedExecution;
      } catch (error) {
        if (!extractedSurfaceAccepted) {
          let rejectedState = null;
          try {
            rejectedState = schroederExtensionExecutionLineageState(
              extensionExecution
            );
          } catch {
            // The public result may be malformed; the direct aliases below
            // still cover the extension's known retained output family.
          }
          const sourceScalarBuffer = volumeLineage?.scalarBuffer ?? null;
          const knownRejectedOutputBuffers = [
            rejectedState?.positionBuffer,
            rejectedState?.normalBuffer,
            rejectedState?.actualVertexCounterBuffer,
            rejectedState?.drawIndirectBuffer,
            extractedSurfaceResult?.positionBuffer,
            extractedSurfaceResult?.vertexBuffer,
            extractedSurfaceResult?.buffer,
            extractedSurfaceResult?.normalBuffer,
            extractedSurfaceResult?.packedNormalBuffer,
            extractedSurfaceResult?.actualVertexCounterBuffer,
            extractedSurfaceResult?.vertexCounterBuffer,
            extractedSurfaceResult?.drawIndirectBuffer
          ].filter((resource) => resource && typeof resource === 'object');
          const outputAliasesBorrowedSource = Boolean(
            sourceScalarBuffer
            && knownRejectedOutputBuffers.includes(sourceScalarBuffer)
          );
          if (
            !outputAliasesBorrowedSource
            && typeof exactExtractedSurfaceRelease === 'function'
          ) {
            try {
              await exactExtractedSurfaceRelease.call(extractedSurfaceResult);
            } catch {
              // Preserve the exact admission error. Extension output resources
              // remain extension-owned, so a missing or failing lifecycle is
              // never authority for ULG to destroy possibly pooled buffers.
            }
          }
        }
        throw error;
      }
    }
  };
  ulgExtensionAdapterRecords.set(wrapper, Object.freeze({ device, volume }));
  return wrapper;
}

function resolveAuthenticatedSchroederExtensionExecutionLineage(
  extensionExecution,
  requestedSourceFamily = null
) {
  const record = schroederExtensionExecutionLineageRecords.get(
    extensionExecution
  );
  if (!record) {
    if (
      requestedSourceFamily
      || hasSchroederSpatialLineageClaim(extensionExecution)
      || hasSchroederSpatialLineageClaim(extensionExecution?.result)
    ) {
      throw new TypeError(
        'marching-cubes translation rejects unbranded or partial successor lineage'
      );
    }
    return null;
  }
  const rawExtensionExecution = extensionExecution === record.wrappedExecution
    ? record.extensionExecution
    : extensionExecution;
  const state = schroederExtensionExecutionLineageState(
    rawExtensionExecution
  );
  const result = state.result;
  if (
    record.active !== true
    || (requestedSourceFamily && requestedSourceFamily !== record.sourceFamily)
    || !Object.isFrozen(record.descriptor)
    || !validateUlgRenderFieldBufferVolumeSuccessorLineage(
      record.descriptor,
      { device: record.device, sourceFamily: record.sourceFamily }
    )
    || !validateSchroederExtensionVolumeRecord(
      schroederExtensionVolumeLineageRecords.get(record.volume)
    )
    || rawExtensionExecution !== record.extensionExecution
    || result !== record.extensionResult
    || state.summaryFingerprint !== record.executionSummaryFingerprint
    || state.positionBuffer !== record.positionBuffer
    || state.normalBuffer !== record.normalBuffer
    || state.positionRows !== record.positionRows
    || !arrayBufferViewMatchesBytes(
      state.positionRows,
      record.positionRowsBytes
    )
    || state.actualVertexCounterBuffer !== record.actualVertexCounterBuffer
    || state.drawIndirectBuffer !== record.drawIndirectBuffer
    || state.surfaceGenerationId !== record.surfaceGenerationId
    || state.volumeGenerationId !== record.volumeGenerationId
    || state.resultIsovalue !== record.resultIsovalue
    || (record.releaseMethod != null
      && result?.release !== record.releaseMethod)
  ) {
    throw new TypeError(
      'marching-cubes output does not match its authenticated successor extraction'
    );
  }
  return record;
}

function resolveSealedSchroederExtensionExecutionLineage(
  extensionExecution,
  requestedSourceFamily = null
) {
  const record = schroederExtensionExecutionLineageRecords.get(
    extensionExecution
  );
  if (!record) return null;
  const rawExtensionExecution = extensionExecution === record.wrappedExecution
    ? record.extensionExecution
    : extensionExecution;
  const state = schroederExtensionExecutionLineageState(
    rawExtensionExecution
  );
  const descriptorRecord = schroederVolumeDescriptorLineageRecords.get(
    record.descriptor
  );
  if (
    record.active !== true
    || (requestedSourceFamily && requestedSourceFamily !== record.sourceFamily)
    || !Object.isFrozen(record.descriptor)
    || !validateUlgRenderFieldBufferVolumeSuccessorDescriptorSnapshot(
      record.descriptor,
      descriptorRecord,
      { device: record.device, sourceFamily: record.sourceFamily }
    )
    || rawExtensionExecution !== record.extensionExecution
    || state.result !== record.extensionResult
    || state.summaryFingerprint !== record.executionSummaryFingerprint
    || state.positionBuffer !== record.positionBuffer
    || state.normalBuffer !== record.normalBuffer
    || state.positionRows !== record.positionRows
    || !arrayBufferViewMatchesBytes(
      state.positionRows,
      record.positionRowsBytes
    )
    || state.actualVertexCounterBuffer !== record.actualVertexCounterBuffer
    || state.drawIndirectBuffer !== record.drawIndirectBuffer
    || state.surfaceGenerationId !== record.surfaceGenerationId
    || state.volumeGenerationId !== record.volumeGenerationId
    || state.resultIsovalue !== record.resultIsovalue
    || (record.releaseMethod != null
      && state.result?.release !== record.releaseMethod)
  ) {
    throw new TypeError(
      'sealed marching-cubes output no longer matches its authenticated successor extraction'
    );
  }
  return record;
}

export function validateUlgWebGpuMarchingCubesExtensionExecutionSuccessorLineage(
  artifact,
  {
    device,
    sourceFamily = null,
    descriptor = null
  } = {}
) {
  try {
    const record = resolveAuthenticatedSchroederExtensionExecutionLineage(
      artifact,
      sourceFamily
    );
    return Boolean(
      record
      && record.device === device
      && record.sourceFamily === sourceFamily
      && (!descriptor || record.descriptor === descriptor)
    );
  } catch {
    return false;
  }
}

function resolveAuthenticatedSchroederSurfaceTranslationInputs(
  record,
  {
    device,
    surfaceIndex,
    isolation,
    sourceVoxelLinearIndex,
    positionTransform,
    positionTransformResolution,
    fieldPadding,
    refEdgeM,
    fieldGradient = null,
    positionRows = null,
    positionClampMinM = null,
    positionClampMaxM = null
  } = {}
) {
  if (!record) return null;
  const descriptor = record.descriptor;
  const expectedResolution = descriptor.dims?.[0] ?? null;
  if (
    device !== record.device
    || surfaceIndex !== descriptor.surfaceIndex
    || sourceVoxelLinearIndex !== descriptor.fieldOffset
    || (isolation != null && isolation !== descriptor.isovalue)
    || (positionTransform != null
      && positionTransform !== descriptor.positionTransform)
    || (positionTransformResolution != null
      && positionTransformResolution !== expectedResolution)
    || (fieldPadding != null && fieldPadding !== descriptor.fieldPadding)
    || (refEdgeM != null && refEdgeM !== descriptor.refEdgeM)
    || (positionRows != null && positionRows !== record.positionRows)
    || positionClampMinM != null
    || positionClampMaxM != null
    || (fieldGradient != null && (
      fieldGradient.buffer !== descriptor.scalarBuffer
      || fieldGradient.scalarOffsetFloats !== descriptor.scalarOffset
      || fieldGradient.rowStrideFloats !== descriptor.cellRowStrideFloats
      || fieldGradient.resolution !== expectedResolution
    ))
  ) {
    throw new TypeError(
      'successor surface translation inputs do not match the authenticated extraction descriptor'
    );
  }
  return {
    descriptor,
    surfaceIndex: descriptor.surfaceIndex,
    isolation: descriptor.isovalue,
    sourceVoxelLinearIndex: descriptor.fieldOffset,
    positionTransform: descriptor.positionTransform,
    positionTransformResolution: expectedResolution,
    fieldPadding: descriptor.fieldPadding,
    refEdgeM: descriptor.refEdgeM,
    fieldGradient: Object.freeze({
      buffer: descriptor.scalarBuffer,
      scalarOffsetFloats: descriptor.scalarOffset,
      rowStrideFloats: descriptor.cellRowStrideFloats,
      resolution: expectedResolution
    }),
    positionRows: record.positionRows
  };
}

function schroederSurfaceTranslationCoreState(translation) {
  const surfaceVertices = translation?.surfaceVertices ?? null;
  const surfaceDraw = translation?.surfaceDraw ?? null;
  const surfaceVerticesSurfaces = surfaceVertices?.surfaces ?? null;
  const surfaceDrawSurfaces = surfaceDraw?.surfaces ?? null;
  const surfaceVerticesSurface = surfaceVerticesSurfaces?.[0] ?? null;
  const surfaceDrawSurface = surfaceDrawSurfaces?.[0] ?? null;
  const surface = surfaceDrawSurface;
  return {
    surfaceVertices,
    surfaceDraw,
    surfaceVerticesSurfaces,
    surfaceDrawSurfaces,
    surfaceVerticesSurface,
    surfaceDrawSurface,
    vertexRows: surfaceVertices?.vertexRows ?? null,
    drawRows: surfaceDraw?.drawRows ?? null,
    drawIndirectRows: surfaceDraw?.drawIndirectRows ?? null,
    compactedVertexRows: surfaceDraw?.compactedVertexRows ?? null,
    vertexRowsBuffer: surfaceVertices?.vertexRowsBuffer ?? null,
    drawRowsBuffer: surfaceDraw?.drawRowsBuffer ?? null,
    drawIndirectRowsBuffer: surfaceDraw?.drawIndirectRowsBuffer ?? null,
    compactedVertexRowsBuffer:
      surfaceDraw?.compactedVertexRowsBuffer ?? null,
    surfaceVerticesCompactPositionRowsBuffer:
      surfaceVertices?.compactPositionRowsBuffer ?? null,
    surfaceDrawCompactPositionRowsBuffer:
      surfaceDraw?.compactPositionRowsBuffer ?? null,
    surfaceVerticesCompactNormalRowsBuffer:
      surfaceVertices?.compactNormalRowsBuffer ?? null,
    surfaceDrawCompactNormalRowsBuffer:
      surfaceDraw?.compactNormalRowsBuffer ?? null,
    surfaceDrawRenderFieldGradientVolume:
      surfaceDraw?.renderFieldGradientVolume ?? null,
    surfaceDrawRenderFieldGradientBuffer:
      surfaceDraw?.renderFieldGradientVolume?.buffer ?? null,
    translationCompactNormalRowsBuffer:
      translation?.compactNormalRowsBuffer ?? null,
    translationPositionTransform: translation?.positionTransform ?? null,
    surfaceVerticesPositionTransform:
      surfaceVertices?.positionTransform ?? null,
    surfaceDrawPositionTransform: surfaceDraw?.positionTransform ?? null,
    surfaceVertexRowLayout: surfaceVertices?.rowLayout ?? null,
    surfaceDrawRowLayout: surfaceDraw?.rowLayout ?? null,
    surfaceDrawIndirectRowLayout: surfaceDraw?.drawIndirectRowLayout ?? null,
    structuralFingerprint: JSON.stringify({
      surfaceVertexRowLayout: surfaceVertices?.rowLayout ?? null,
      surfaceVertexRowStrideFloats:
        surfaceVertices?.rowStrideFloats ?? null,
      surfaceDrawRowLayout: surfaceDraw?.rowLayout ?? null,
      surfaceDrawRowStrideFloats: surfaceDraw?.rowStrideFloats ?? null,
      surfaceDrawIndirectRowLayout:
        surfaceDraw?.drawIndirectRowLayout ?? null,
      surfaceDrawIndirectRowStrideUints:
        surfaceDraw?.drawIndirectRowStrideUints ?? null,
      positionClamp: translation?.positionClamp ?? null,
      surfaceVertexPositionClamp: surfaceVertices?.positionClamp ?? null,
      surfaceDrawPositionClamp: surfaceDraw?.positionClamp ?? null,
      surfaceVerticesSurfaces,
      surfaceDrawSurfaces
    }),
    renderConsumptionFingerprint: JSON.stringify({
      directCompactPositionDraw:
        surfaceDraw?.directCompactPositionDraw === true,
      sourceVertexRowCount: surfaceDraw?.sourceVertexRowCount ?? null,
      sourceVertexCount: surfaceDraw?.sourceVertexCount ?? null,
      sourceVertexCountMode: surfaceDraw?.sourceVertexCountMode ?? null,
      vertexCount: surfaceDraw?.vertexCount ?? null,
      triangleCount: surfaceDraw?.triangleCount ?? null,
      compactPositionRowsBufferRetained:
        surfaceDraw?.compactPositionRowsBufferRetained ?? null,
      compactPositionRowsBufferByteLength:
        surfaceDraw?.compactPositionRowsBufferByteLength ?? null,
      compactPositionRowsBufferRowCount:
        surfaceDraw?.compactPositionRowsBufferRowCount ?? null,
      compactPositionRowsVertexCount:
        surfaceDraw?.compactPositionRowsVertexCount ?? null,
      compactPositionRowsStrideFloats:
        surfaceDraw?.compactPositionRowsStrideFloats ?? null,
      compactPositionRowsStrideBytes:
        surfaceDraw?.compactPositionRowsStrideBytes ?? null,
      compactPositionRowsFormat:
        surfaceDraw?.compactPositionRowsFormat ?? null,
      compactPositionRowsSchema:
        surfaceDraw?.compactPositionRowsSchema ?? null,
      compactPositionRowsOwnership:
        surfaceDraw?.compactPositionRowsOwnership ?? null,
      compactPositionRowsSurfaceGenerationId:
        surfaceDraw?.compactPositionRowsSurfaceGenerationId ?? null,
      compactPositionRowsVolumeGenerationId:
        surfaceDraw?.compactPositionRowsVolumeGenerationId ?? null,
      compactNormalRowsBufferRetained:
        surfaceDraw?.compactNormalRowsBufferRetained ?? null,
      compactNormalRowsBufferByteLength:
        surfaceDraw?.compactNormalRowsBufferByteLength ?? null,
      compactNormalRowsBufferRowCount:
        surfaceDraw?.compactNormalRowsBufferRowCount ?? null,
      compactNormalRowsSchema:
        surfaceDraw?.compactNormalRowsSchema ?? null,
      compactNormalRowsDescriptorSchema:
        surfaceDraw?.compactNormalRowsDescriptorSchema ?? null,
      compactNormalRowsLayoutName:
        surfaceDraw?.compactNormalRowsLayoutName ?? null,
      compactNormalRowsEncoding:
        surfaceDraw?.compactNormalRowsEncoding ?? null,
      compactNormalRowsSemantic:
        surfaceDraw?.compactNormalRowsSemantic ?? null,
      compactNormalRowsSourceSemantic:
        surfaceDraw?.compactNormalRowsSourceSemantic ?? null,
      compactNormalRowsNormalSign:
        surfaceDraw?.compactNormalRowsNormalSign ?? null,
      compactNormalRowsSurfaceGenerationId:
        surfaceDraw?.compactNormalRowsSurfaceGenerationId ?? null,
      compactNormalRowsPairedPositionSurfaceGenerationId:
        surfaceDraw?.compactNormalRowsPairedPositionSurfaceGenerationId ?? null,
      compactNormalRowsVolumeGenerationId:
        surfaceDraw?.compactNormalRowsVolumeGenerationId ?? null,
      compactNormalRowsSameSubmitAsPosition:
        surfaceDraw?.compactNormalRowsSameSubmitAsPosition ?? null,
      compactNormalRowsLifetimeOwner:
        surfaceDraw?.compactNormalRowsLifetimeOwner ?? null,
      compactNormalRowsPairedWithPositionBuffer:
        surfaceDraw?.compactNormalRowsPairedWithPositionBuffer ?? null,
      compactNormalRowsProducerStage:
        surfaceDraw?.compactNormalRowsProducerStage ?? null,
      compactNormalRowsTimestampSpanLabel:
        surfaceDraw?.compactNormalRowsTimestampSpanLabel ?? null,
      compactNormalRowsAdditionalSubmitCount:
        surfaceDraw?.compactNormalRowsAdditionalSubmitCount ?? null,
      compactNormalRowsOwnership:
        surfaceDraw?.compactNormalRowsOwnership ?? null,
      surfaceCount: surfaceDraw?.surfaceCount ?? null,
      activeSurfaceCount: surfaceDraw?.activeSurfaceCount ?? null,
      compactedVertexRowsBufferRetained:
        surfaceDraw?.compactedVertexRowsBufferRetained ?? null,
      compactedVertexRowsBufferByteLength:
        surfaceDraw?.compactedVertexRowsBufferByteLength ?? null,
      renderFieldGradientVolumePresent:
        surfaceDraw?.renderFieldGradientVolume != null,
      renderFieldGradientDims:
        surfaceDraw?.renderFieldGradientVolume?.dims ?? null,
      renderFieldGradientScalarStrides:
        surfaceDraw?.renderFieldGradientVolume?.scalarStrides ?? null,
      renderFieldGradientScalarOffset:
        surfaceDraw?.renderFieldGradientVolume?.scalarOffset ?? null,
      drawIndirectRowsBufferRetained:
        surfaceDraw?.drawIndirectRowsBufferRetained ?? null,
      drawIndirectRowsBufferByteLength:
        surfaceDraw?.drawIndirectRowsBufferByteLength ?? null,
      drawIndirectRowsOwnership:
        surfaceDraw?.drawIndirectRowsOwnership ?? null,
      directCompactPositionDrawIndirectSource:
        surfaceDraw?.directCompactPositionDrawIndirectSource ?? null,
      readbackMode: surfaceDraw?.readbackMode ?? null,
      positionTransformStatus:
        surfaceDraw?.positionTransformStatus ?? null,
      positionClampStatus: surfaceDraw?.positionClampStatus ?? null,
      density: surfaceDraw?.density ?? null,
      isolation: surfaceDraw?.isolation ?? null,
      sourceVoxelLinearIndex:
        surfaceDraw?.sourceVoxelLinearIndex ?? null,
      fallbackNormal: surfaceDraw?.fallbackNormal ?? null
    }),
    primitiveFingerprint: JSON.stringify({
      status: translation?.status ?? null,
      backend: translation?.backend ?? null,
      sourceVertexCount: translation?.sourceVertexCount ?? null,
      translatedVertexCount: translation?.translatedVertexCount ?? null,
      triangleCount: translation?.triangleCount ?? null,
      directCompactPositionDraw:
        translation?.directCompactPositionDraw === true,
      compactPositionRowsSurfaceGenerationId:
        translation?.compactPositionRowsSurfaceGenerationId ?? null,
      compactPositionRowsVolumeGenerationId:
        translation?.compactPositionRowsVolumeGenerationId ?? null,
      compactNormalRowsSurfaceGenerationId:
        translation?.compactNormalRowsSurfaceGenerationId ?? null,
      compactNormalRowsPairedPositionSurfaceGenerationId:
        translation?.compactNormalRowsPairedPositionSurfaceGenerationId ?? null,
      compactNormalRowsVolumeGenerationId:
        translation?.compactNormalRowsVolumeGenerationId ?? null,
      positionTransformStatus: translation?.positionTransformStatus ?? null,
      surfaceVertexStatus: surfaceVertices?.status ?? null,
      surfaceVertexCount: surfaceVertices?.vertexCount ?? null,
      surfaceVertexTriangleCount: surfaceVertices?.triangleCount ?? null,
      surfaceDrawStatus: surfaceDraw?.status ?? null,
      surfaceDrawVertexCount: surfaceDraw?.vertexCount ?? null,
      surfaceDrawTriangleCount: surfaceDraw?.triangleCount ?? null,
      surfaceIndex: surface?.surfaceIndex ?? null,
      indirectOffsetBytes: surface?.indirectOffsetBytes ?? null
    })
  };
}

function publishSchroederSurfaceTranslationLineage({
  translation,
  extractionLineage
} = {}) {
  if (!translation || !extractionLineage) return null;
  const activeExtractionLineage =
    resolveAuthenticatedSchroederExtensionExecutionLineage(
      extractionLineage.extensionExecution,
      extractionLineage.sourceFamily
    );
  if (activeExtractionLineage !== extractionLineage) {
    throw new TypeError(
      'successor surface publication requires the still-active exact extraction lineage'
    );
  }
  const state = schroederSurfaceTranslationCoreState(translation);
  const record = {
    active: true,
    device: extractionLineage.device,
    sourceFamily: extractionLineage.sourceFamily,
    descriptor: extractionLineage.descriptor,
    extensionExecution: extractionLineage.extensionExecution,
    extractionLineage,
    translation,
    ...state,
    vertexRowsBytes: copyArrayBufferViewBytes(state.vertexRows),
    drawRowsBytes: copyArrayBufferViewBytes(state.drawRows),
    drawIndirectRowsBytes: copyArrayBufferViewBytes(state.drawIndirectRows),
    compactedVertexRowsBytes: copyArrayBufferViewBytes(
      state.compactedVertexRows
    )
  };
  schroederSurfaceTranslationLineageRecords.set(translation, record);
  if (state.surfaceVertices) {
    schroederSurfaceTranslationLineageRecords.set(state.surfaceVertices, record);
  }
  if (state.surfaceDraw) {
    schroederSurfaceTranslationLineageRecords.set(state.surfaceDraw, record);
  }
  return record;
}

function invalidateSchroederSurfaceTranslationLineage(translation) {
  const record = schroederSurfaceTranslationLineageRecords.get(translation);
  if (record) record.active = false;
}

export function validateUlgWebGpuMarchingCubesSurfaceSuccessorLineage(
  artifact,
  {
    device,
    sourceFamily = artifact?.schroederSpatialSourceFamily ?? null,
    descriptor = null,
    extensionExecution = null
  } = {}
) {
  const record = schroederSurfaceTranslationLineageRecords.get(artifact);
  if (
    !record
    || record.active !== true
    || record.device !== device
    || record.sourceFamily !== sourceFamily
    || (descriptor && record.descriptor !== descriptor)
    || (extensionExecution
      && record.extensionExecution !== extensionExecution)
  ) {
    return false;
  }
  let activeExtractionLineage = null;
  try {
    activeExtractionLineage =
      resolveSealedSchroederExtensionExecutionLineage(
        record.extensionExecution,
        record.sourceFamily
      );
  } catch {
    return false;
  }
  const state = schroederSurfaceTranslationCoreState(record.translation);
  return Boolean(
    activeExtractionLineage === record.extractionLineage
    && schroederSpatialSourceLineageEchoMatches(
      record.translation,
      record.sourceFamily
    )
    && schroederSpatialSourceLineageEchoMatches(
      record.surfaceVertices,
      record.sourceFamily
    )
    && schroederSpatialSourceLineageEchoMatches(
      record.surfaceDraw,
      record.sourceFamily
    )
    && record.translation?.surfaceVertices === record.surfaceVertices
    && record.translation?.surfaceDraw === record.surfaceDraw
    && state.surfaceVertices === record.surfaceVertices
    && state.surfaceDraw === record.surfaceDraw
    && state.surfaceVerticesSurfaces === record.surfaceVerticesSurfaces
    && state.surfaceDrawSurfaces === record.surfaceDrawSurfaces
    && state.surfaceVerticesSurface === record.surfaceVerticesSurface
    && state.surfaceDrawSurface === record.surfaceDrawSurface
    && state.vertexRows === record.vertexRows
    && state.drawRows === record.drawRows
    && state.drawIndirectRows === record.drawIndirectRows
    && state.compactedVertexRows === record.compactedVertexRows
    && arrayBufferViewMatchesBytes(
      state.vertexRows,
      record.vertexRowsBytes
    )
    && arrayBufferViewMatchesBytes(
      state.drawRows,
      record.drawRowsBytes
    )
    && arrayBufferViewMatchesBytes(
      state.drawIndirectRows,
      record.drawIndirectRowsBytes
    )
    && arrayBufferViewMatchesBytes(
      state.compactedVertexRows,
      record.compactedVertexRowsBytes
    )
    && state.vertexRowsBuffer === record.vertexRowsBuffer
    && state.drawRowsBuffer === record.drawRowsBuffer
    && state.drawIndirectRowsBuffer === record.drawIndirectRowsBuffer
    && state.compactedVertexRowsBuffer === record.compactedVertexRowsBuffer
    && state.surfaceVerticesCompactPositionRowsBuffer
      === record.surfaceVerticesCompactPositionRowsBuffer
    && state.surfaceDrawCompactPositionRowsBuffer
      === record.surfaceDrawCompactPositionRowsBuffer
    && state.surfaceVerticesCompactNormalRowsBuffer
      === record.surfaceVerticesCompactNormalRowsBuffer
    && state.surfaceDrawCompactNormalRowsBuffer
      === record.surfaceDrawCompactNormalRowsBuffer
    && state.surfaceDrawRenderFieldGradientVolume
      === record.surfaceDrawRenderFieldGradientVolume
    && state.surfaceDrawRenderFieldGradientBuffer
      === record.surfaceDrawRenderFieldGradientBuffer
    && state.translationCompactNormalRowsBuffer
      === record.translationCompactNormalRowsBuffer
    && state.translationPositionTransform
      === record.translationPositionTransform
    && state.surfaceVerticesPositionTransform
      === record.surfaceVerticesPositionTransform
    && state.surfaceDrawPositionTransform
      === record.surfaceDrawPositionTransform
    && state.translationPositionTransform === record.descriptor.positionTransform
    && state.surfaceVerticesPositionTransform
      === record.descriptor.positionTransform
    && state.surfaceDrawPositionTransform === record.descriptor.positionTransform
    && state.surfaceVertexRowLayout === record.surfaceVertexRowLayout
    && state.surfaceDrawRowLayout === record.surfaceDrawRowLayout
    && state.surfaceDrawIndirectRowLayout
      === record.surfaceDrawIndirectRowLayout
    && state.structuralFingerprint === record.structuralFingerprint
    && state.renderConsumptionFingerprint
      === record.renderConsumptionFingerprint
    && state.primitiveFingerprint === record.primitiveFingerprint
  );
}

export function translateWebGpuMarchingCubesSurfaceToUlgRows({
  device = null,
  extensionExecution,
  schroederSpatialSourceFamily = null,
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
  const schroederExtractionLineage =
    resolveAuthenticatedSchroederExtensionExecutionLineage(
      extensionExecution,
      schroederSpatialSourceFamily
    );
  const resolvedSchroederSpatialSourceFamily =
    schroederExtractionLineage?.sourceFamily ?? null;
  if (resolvedSchroederSpatialSourceFamily) {
    const authenticatedInputs =
      resolveAuthenticatedSchroederSurfaceTranslationInputs(
        schroederExtractionLineage,
        {
          device,
          surfaceIndex,
          isolation,
          sourceVoxelLinearIndex,
          positionTransform,
          positionTransformResolution,
          fieldPadding,
          refEdgeM,
          positionRows,
          positionClampMinM,
          positionClampMaxM
        }
      );
    surfaceIndex = authenticatedInputs.surfaceIndex;
    isolation = authenticatedInputs.isolation;
    sourceVoxelLinearIndex = authenticatedInputs.sourceVoxelLinearIndex;
    positionTransform = authenticatedInputs.positionTransform;
    positionTransformResolution =
      authenticatedInputs.positionTransformResolution;
    fieldPadding = authenticatedInputs.fieldPadding;
    refEdgeM = authenticatedInputs.refEdgeM;
    positionRows = authenticatedInputs.positionRows;
    positionClampMinM = null;
    positionClampMaxM = null;
    resolveSchroederSpatialSuccessorSourceFamily(
      resolvedSchroederSpatialSourceFamily,
      {
        device,
        particleCount: resolvedSchroederSpatialSourceFamily.particleCount
      }
    );
  }
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
    indirectRowIndex: 0,
    indirectOffsetBytes: 0,
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
    firstInstance: 0
  });
  const surfaceVertices = {
    schema: ULG_SPH_GPU_RENDER_SURFACE_VERTICES_SCHEMA,
    backend: 'cpu-reference',
    status: alignedVertexCount > 0 ? 'surface-vertices-ready' : 'surface-vertices-empty',
    ...schroederSpatialSourceLineage(resolvedSchroederSpatialSourceFamily),
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
    ...schroederSpatialSourceLineage(resolvedSchroederSpatialSourceFamily),
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
  const translation = {
    schema: ULG_SPH_WEBGPU_MARCHING_CUBES_EXTENSION_TRANSLATION_SCHEMA,
    status: alignedVertexCount > 0
      ? 'extension-surface-translated-to-ulg-rows'
      : 'extension-surface-translation-empty',
    reason: vertexCount !== alignedVertexCount
      ? 'extension vertexCount was not divisible by 3; trailing vertices were ignored'
      : null,
    summary,
    ...schroederSpatialSourceLineage(resolvedSchroederSpatialSourceFamily),
    positionTransform: resolvedPositionTransform,
    positionTransformStatus: resolvedPositionTransform.status,
    positionClamp: resolvedPositionClamp,
    positionClampStatus: resolvedPositionClamp.status,
    sourceVertexCount: vertexCount,
    translatedVertexCount: alignedVertexCount,
    triangleCount,
    ignoredTrailingVertexCount: vertexCount - alignedVertexCount,
    surfaceVertices,
    surfaceDraw,
    hotLoopGpuTranslationRequired: false
  };
  if (schroederExtractionLineage) {
    publishSchroederSurfaceTranslationLineage({
      translation,
      extractionLineage: schroederExtractionLineage
    });
  }
  return translation;
}

export async function buildWebGpuMarchingCubesExtensionSurfaceRowsWebGpu({
  device,
  extensionExecution,
  schroederSpatialSourceFamily = null,
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
  fieldGradient = null,
  readbackMode = NO_FULL_READBACK_MODE,
  compactSummaryReadback = false,
  translateVertexRows = true,
  allowExtensionDrawIndirectBuffer = false,
  retainVertexRowsBuffer = true,
  retainDrawRowsBuffer = true,
  retainDrawIndirectRowsBuffer = true,
  waitForQueueCompletion = true,
  onProgress = null
} = {}) {
  if (!device?.createBuffer || !device.queue?.writeBuffer) {
    throw new TypeError('buildWebGpuMarchingCubesExtensionSurfaceRowsWebGpu requires a WebGPU-like device');
  }
  const schroederExtractionLineage =
    resolveAuthenticatedSchroederExtensionExecutionLineage(
      extensionExecution,
      schroederSpatialSourceFamily
    );
  const resolvedSchroederSpatialSourceFamily =
    schroederExtractionLineage?.sourceFamily ?? null;
  if (resolvedSchroederSpatialSourceFamily) {
    const authenticatedInputs =
      resolveAuthenticatedSchroederSurfaceTranslationInputs(
        schroederExtractionLineage,
        {
          device,
          surfaceIndex,
          isolation,
          sourceVoxelLinearIndex,
          positionTransform,
          positionTransformResolution,
          fieldPadding,
          refEdgeM,
          fieldGradient,
          positionClampMinM,
          positionClampMaxM
        }
      );
    surfaceIndex = authenticatedInputs.surfaceIndex;
    isolation = authenticatedInputs.isolation;
    sourceVoxelLinearIndex = authenticatedInputs.sourceVoxelLinearIndex;
    positionTransform = authenticatedInputs.positionTransform;
    positionTransformResolution =
      authenticatedInputs.positionTransformResolution;
    fieldPadding = authenticatedInputs.fieldPadding;
    refEdgeM = authenticatedInputs.refEdgeM;
    fieldGradient = authenticatedInputs.fieldGradient;
    positionClampMinM = null;
    positionClampMaxM = null;
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
  if (resolvedSchroederSpatialSourceFamily) {
    resolveSchroederSpatialSuccessorSourceFamily(
      resolvedSchroederSpatialSourceFamily,
      {
        device,
        particleCount: resolvedSchroederSpatialSourceFamily.particleCount
      }
    );
  }

  const noFullReadback = readbackMode === NO_FULL_READBACK_MODE;
  const directCompactPositionDraw = Boolean(noFullReadback && translateVertexRows === false);
  if (!noFullReadback && translateVertexRows === false) {
    throw new TypeError('direct compact-position surface draw metadata requires no-full-readback mode');
  }
  const sourceStrideFloats = Math.max(3, Math.round(finiteNumber(summary.extensionVertexStrideFloats, 4)));
  const sourceVertexCount = Math.max(0, Math.round(finiteNumber(summary.extensionVertexCount, 0)));
  const sourceVertexCountMode = summary.extensionVertexCountMode ?? null;
  const extensionResult = extensionExecution?.result || null;
  const packedNormalSource = packedNormalRowsSource(extensionResult);
  if (directCompactPositionDraw && summary.extensionPackedNormalReady !== true) {
    throw new TypeError(
      `direct compact-position surface draw requires generation-matched packed normals (${summary.extensionPackedNormalStatus})`
    );
  }
  if (directCompactPositionDraw && packedNormalSource.normalSign !== -1) {
    throw new TypeError('ULG SPH density surfaces require packed normalSign=-1');
  }
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
  const extensionDrawIndirectBuffer = extensionResult?.drawIndirectBuffer || null;
  const extensionDrawIndirectBufferByteLength = Math.max(
    0,
    Math.round(finiteNumber(
      extensionResult?.drawIndirectBufferByteLength
        ?? extensionDrawIndirectBuffer?.size,
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
  const translatedVertexRowsByteLength = translatedVertexCount
    * SPH_GPU_RENDER_SURFACE_VERTEX_ROW_LAYOUT.length
    * Float32Array.BYTES_PER_ELEMENT;
  const vertexRowsByteLength = directCompactPositionDraw ? 0 : translatedVertexRowsByteLength;
  const drawRowsByteLength = SPH_GPU_RENDER_SURFACE_DRAW_ROW_LAYOUT.length * Float32Array.BYTES_PER_ELEMENT;
  const drawIndirectRowsByteLength = SPH_GPU_RENDER_SURFACE_DRAW_INDIRECT_ROW_LAYOUT.length * Uint32Array.BYTES_PER_ELEMENT;
  const useExtensionDrawIndirectBuffer = Boolean(
    directCompactPositionDraw
      && allowExtensionDrawIndirectBuffer
      && !compactSummaryReadback
      && extensionDrawIndirectBuffer
      && extensionDrawIndirectBufferByteLength >= drawIndirectRowsByteLength
  );
  const directCompactPositionDrawIndirectSource = useExtensionDrawIndirectBuffer
    ? 'webgpu-marching-cubes-extension-draw-indirect-buffer'
    : 'ulg-compact-position-draw-metadata-kernel';
  const drawIndirectRowsOwnership = useExtensionDrawIndirectBuffer
    ? 'extension-owned-retained-buffer'
    : 'ulg-owned-retained-buffer';
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
          translatedVertexRowsByteLength,
          drawRowsByteLength,
          drawIndirectRowsByteLength,
          directCompactPositionDraw,
          directCompactPositionDrawIndirectSource,
          drawIndirectRowsOwnership,
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

  const ownedTranslationBuffers = new Set();
  let translationSubmissionObserved = false;
  const createOwnedTranslationBuffer = (descriptor) => {
    const buffer = device.createBuffer(descriptor);
    ownedTranslationBuffers.add(buffer);
    return buffer;
  };
  const destroyOwnedTranslationBuffer = (buffer) => {
    if (!buffer || !ownedTranslationBuffers.delete(buffer)) return false;
    try {
      buffer.destroy?.();
    } catch {
      // The originating error remains authoritative. Removing the buffer from
      // the ledger first guarantees that competing cleanup paths cannot issue
      // a second destruction attempt.
    }
    return true;
  };
  const transferOwnedTranslationBuffer = (buffer) => {
    if (buffer) ownedTranslationBuffers.delete(buffer);
    return buffer;
  };
  try {
  let vertexRowsBuffer = null;
  if (!directCompactPositionDraw) {
    vertexRowsBuffer = createOwnedTranslationBuffer({
      label: 'ulg-sph-extension-surface-vertices',
      size: Math.max(4, vertexRowsByteLength),
      usage: GPU_BUFFER_USAGE.STORAGE
        | GPU_BUFFER_USAGE.VERTEX
        | GPU_BUFFER_USAGE.COPY_SRC
        | GPU_BUFFER_USAGE.COPY_DST
    });
  }
  const vertexRowsBufferClearStatus = directCompactPositionDraw
    ? 'skipped-direct-compact-position-draw'
    : (noFullReadback ? 'skipped-no-full-readback-indirect-draw' : 'cleared-for-readback');
  if (!directCompactPositionDraw && !noFullReadback && vertexRowsByteLength > 0) {
    device.queue.writeBuffer(
      vertexRowsBuffer,
      0,
      new Float32Array(translatedVertexCount * SPH_GPU_RENDER_SURFACE_VERTEX_ROW_LAYOUT.length)
    );
  }
  const initialDrawRows = new Float32Array(SPH_GPU_RENDER_SURFACE_DRAW_ROW_LAYOUT.length);
  if (useExtensionDrawIndirectBuffer) {
    writeSurfaceDrawRow(initialDrawRows, 0, {
      surfaceIndex: resolvedSurfaceIndex,
      materialId: resolvedMaterialId,
      phaseId: resolvedPhaseId,
      opticalStateId: resolvedOpticalStateId,
      vertexOffset: 0,
      vertexCount: translatedVertexCount,
      triangleOffset: 0,
      triangleCount,
      renderOrder: resolvedRenderOrder,
      transparencyClassId: resolvedTransparencyClassId,
      depthWriteFlag: resolvedDepthWriteFlag,
      status: triangleCount > 0 ? 1 : 0,
      boundsCenterM: resolvedSurfaceBounds?.centerM ?? [0, 0, 0],
      boundsRadiusM: resolvedSurfaceBounds?.radiusM ?? 0
    });
  }
  const drawRowsBuffer = createOwnedTranslationBuffer({
    label: 'ulg-sph-extension-surface-draw',
    size: Math.max(4, drawRowsByteLength),
    usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_SRC | GPU_BUFFER_USAGE.COPY_DST
  });
  device.queue.writeBuffer(drawRowsBuffer, 0, initialDrawRows);
  const drawIndirectRowsBuffer = useExtensionDrawIndirectBuffer
    ? extensionDrawIndirectBuffer
    : createOwnedTranslationBuffer({
        label: 'ulg-sph-extension-surface-draw-indirect',
        size: Math.max(4, drawIndirectRowsByteLength),
        usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.INDIRECT | GPU_BUFFER_USAGE.COPY_SRC | GPU_BUFFER_USAGE.COPY_DST
      });
  if (!useExtensionDrawIndirectBuffer) {
    device.queue.writeBuffer(drawIndirectRowsBuffer, 0, new Uint32Array(SPH_GPU_RENDER_SURFACE_DRAW_INDIRECT_ROW_LAYOUT.length));
  }
  const paramsBuffer = useExtensionDrawIndirectBuffer
    ? null
    : createOwnedTranslationBuffer({
        label: 'ulg-sph-extension-surface-translation-params',
        size: 160,
        usage: GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST
      });
  if (!sourceVertexCounterBuffer && !useExtensionDrawIndirectBuffer) {
    sourceVertexCounterBuffer = createOwnedTranslationBuffer({
      label: 'ulg-sph-extension-surface-source-vertex-count',
      size: 4,
      usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_DST
    });
    device.queue.writeBuffer(sourceVertexCounterBuffer, 0, new Uint32Array([sourceVertexCount]));
    ownsSourceVertexCounterBuffer = true;
  }
  const resolvedFieldGradient = fieldGradient?.buffer
    && Number.isFinite(fieldGradient.resolution)
    && fieldGradient.resolution > 0
    ? {
        buffer: fieldGradient.buffer,
        resolution: Math.round(fieldGradient.resolution),
        scalarOffsetFloats: Math.max(0, Math.round(Number(fieldGradient.scalarOffsetFloats) || 0)),
        rowStrideFloats: Math.max(1, Math.round(Number(fieldGradient.rowStrideFloats) || 1))
      }
    : null;
  if (!useExtensionDrawIndirectBuffer) {
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
      surfaceBounds: resolvedSurfaceBounds,
      fieldGradient: resolvedFieldGradient
    }));
  }
  markProgress('extension-surface-translation-buffers-ready');

  const translationPipeline = useExtensionDrawIndirectBuffer
    ? null
    : (directCompactPositionDraw
      ? createCachedExplicitComputePipeline(device, {
          cacheKey: 'ulg-sph-webgpu-marching-cubes-extension-compact-surface-draw:v1',
          label: 'ulg-sph-webgpu-marching-cubes-extension-compact-surface-draw',
          code: webGpuMarchingCubesExtensionCompactSurfaceDrawWgsl,
          entryPoint: 'main',
          bindings: [
            computeBufferBinding(0, 'storage'),
            computeBufferBinding(1, 'storage'),
            computeBufferBinding(2, 'uniform'),
            computeBufferBinding(3, 'read-only-storage')
          ]
        })
      : createCachedExplicitComputePipeline(device, {
          cacheKey: 'ulg-sph-webgpu-marching-cubes-extension-surface-translation:v3-degenerate-cull',
          label: 'ulg-sph-webgpu-marching-cubes-extension-surface-translation',
          code: webGpuMarchingCubesExtensionSurfaceRowsWgsl,
          entryPoint: 'main',
          bindings: [
            computeBufferBinding(0, 'read-only-storage'),
            computeBufferBinding(1, 'storage'),
            computeBufferBinding(2, 'storage'),
            computeBufferBinding(3, 'storage'),
            computeBufferBinding(4, 'uniform'),
            computeBufferBinding(5, 'read-only-storage'),
            computeBufferBinding(6, 'read-only-storage')
          ]
        }));
  const translationPipelineCacheStatus = useExtensionDrawIndirectBuffer
    ? 'skipped-extension-draw-indirect-buffer'
    : (translationPipeline.cacheStatus ?? null);
  let bindGroup = null;
  let encoder = null;
  let workgroupCountX = 0;
  let fieldGradientDummyBuffer = null;
  if (useExtensionDrawIndirectBuffer) {
    markProgress('extension-surface-translation-command-skipped', {
      reason: 'using extension-owned drawIndirectBuffer for direct compact-position draw',
      workgroupCountX
    });
  } else {
    const { pipeline, bindGroupLayout } = translationPipeline;
    bindGroup = device.createBindGroup({
      layout: bindGroupLayout,
      entries: directCompactPositionDraw
        ? [
            { binding: 0, resource: { buffer: drawRowsBuffer } },
            { binding: 1, resource: { buffer: drawIndirectRowsBuffer } },
            { binding: 2, resource: { buffer: paramsBuffer } },
            { binding: 3, resource: { buffer: sourceVertexCounterBuffer } }
          ]
        : [
            { binding: 0, resource: { buffer: sourceBuffer } },
            { binding: 1, resource: { buffer: vertexRowsBuffer } },
            { binding: 2, resource: { buffer: drawRowsBuffer } },
            { binding: 3, resource: { buffer: drawIndirectRowsBuffer } },
            { binding: 4, resource: { buffer: paramsBuffer } },
            { binding: 5, resource: { buffer: sourceVertexCounterBuffer } },
            {
              binding: 6,
              resource: {
                buffer: resolvedFieldGradient?.buffer || (fieldGradientDummyBuffer = createOwnedTranslationBuffer({
                  label: 'ulg-sph-extension-surface-field-gradient-dummy',
                  size: 4,
                  usage: GPU_BUFFER_USAGE.STORAGE
                }))
              }
            }
          ]
    });
    encoder = device.createCommandEncoder();
    const pass = encoder.beginComputePass();
    pass.setPipeline(pipeline);
    pass.setBindGroup(0, bindGroup);
    workgroupCountX = directCompactPositionDraw
      ? 1
      : Math.max(1, Math.ceil(Math.max(1, triangleCount) / EXTENSION_SURFACE_TRANSLATION_WORKGROUP_SIZE));
    pass.dispatchWorkgroups(workgroupCountX);
    pass.end();
    markProgress('extension-surface-translation-command-encoded', { workgroupCountX });
  }

  let vertexRows = new Float32Array();
  let drawRows = useExtensionDrawIndirectBuffer ? initialDrawRows : new Float32Array();
  let drawIndirectRows = new Uint32Array();
  let summaryReadback = false;
  let summaryReadbackByteLength = 0;
  let queueCompletionStatus = 'not-submitted';
  let queueCompletionMethod = null;
  let deferNoFullCleanup = false;
  if (!noFullReadback) {
    device.queue.submit([encoder.finish()]);
    translationSubmissionObserved = true;
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
    if (useExtensionDrawIndirectBuffer) {
      queueCompletionStatus = 'queue-work-not-required';
      queueCompletionMethod = 'extension-owned-draw-indirect-buffer';
    } else if (waitForQueueCompletion && device.queue?.onSubmittedWorkDone) {
      device.queue.submit([encoder.finish()]);
      translationSubmissionObserved = true;
      queueCompletionStatus = 'queue-submitted';
      queueCompletionMethod = 'queue.submit';
      await device.queue.onSubmittedWorkDone();
      queueCompletionStatus = 'queue-work-completed';
      queueCompletionMethod = 'queue.onSubmittedWorkDone';
    } else {
      device.queue.submit([encoder.finish()]);
      translationSubmissionObserved = true;
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
    destroyOwnedTranslationBuffer(paramsBuffer);
    destroyOwnedTranslationBuffer(fieldGradientDummyBuffer);
    if (ownsSourceVertexCounterBuffer) {
      destroyOwnedTranslationBuffer(sourceVertexCounterBuffer);
    }
  };
  const keepVertexRowsBuffer = !directCompactPositionDraw && (retainVertexRowsBuffer || noFullReadback);
  const keepDrawRowsBuffer = retainDrawRowsBuffer || noFullReadback;
  const keepDrawIndirectRowsBuffer = retainDrawIndirectRowsBuffer || noFullReadback;
  if (!keepVertexRowsBuffer) destroyOwnedTranslationBuffer(vertexRowsBuffer);
  if (!keepDrawRowsBuffer) destroyOwnedTranslationBuffer(drawRowsBuffer);
  if (!keepDrawIndirectRowsBuffer && !useExtensionDrawIndirectBuffer) {
    destroyOwnedTranslationBuffer(drawIndirectRowsBuffer);
  }
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
    boundsRadiusM: resolvedSurfaceBounds?.radiusM ?? null,
    indirectRowIndex: 0,
    indirectOffsetBytes: 0
  });
  const sourceVertexCounterMode = extensionActualVertexCounterBuffer
    ? 'extension-gpu-vertex-counter'
    : 'host-constant-vertex-count';
  const sourceVertexCounterBufferRetained = Boolean(extensionActualVertexCounterBuffer);
  const sourceVertexCounterBufferByteLength = extensionActualVertexCounterBuffer
    ? extensionActualVertexCounterBufferByteLength
    : 4;
  const compactPositionRowsBufferRetained = Boolean(sourceBuffer && summary.extensionBufferRetained);
  const compactPositionRowsBufferByteLength = Math.max(
    0,
    Math.round(finiteNumber(summary.extensionVertexStrideBytes, sourceStrideFloats * Float32Array.BYTES_PER_ELEMENT))
  ) * sourceVertexCount;
  const compactPositionRowsSurfaceGenerationId = extensionResult?.surfaceGenerationId ?? null;
  const compactPositionRowsVolumeGenerationId = extensionResult?.volumeGenerationId ?? null;
  const compactNormalRowsBufferRetained = Boolean(
    directCompactPositionDraw
    && packedNormalSource.buffer
    && packedNormalSource.bufferRetained
    && summary.extensionPackedNormalReady
  );
  const compactNormalRowsBufferByteLength = compactNormalRowsBufferRetained
    ? packedNormalSource.bufferByteLength
    : 0;
  const compactNormalRowsBufferRowCount = compactNormalRowsBufferRetained
    ? packedNormalSource.rowCount
    : 0;
  const compactNormalMetadata = {
    compactNormalRowsBufferRetained,
    compactNormalRowsBufferByteLength,
    compactNormalRowsBufferRowCount,
    compactNormalRowsSchema: packedNormalSource.rowSchema,
    compactNormalRowsDescriptorSchema: packedNormalSource.descriptorSchema,
    compactNormalRowsLayoutName: packedNormalSource.layoutName,
    compactNormalRowsEncoding: packedNormalSource.encoding,
    compactNormalRowsSemantic: packedNormalSource.semantic,
    compactNormalRowsSourceSemantic: packedNormalSource.sourceSemantic,
    compactNormalRowsNormalSign: Number.isFinite(packedNormalSource.normalSign)
      ? packedNormalSource.normalSign
      : null,
    compactNormalRowsSurfaceGenerationId: packedNormalSource.surfaceGenerationId,
    compactNormalRowsPairedPositionSurfaceGenerationId:
      packedNormalSource.pairedPositionSurfaceGenerationId,
    compactNormalRowsVolumeGenerationId: packedNormalSource.volumeGenerationId,
    compactNormalRowsSameSubmitAsPosition: packedNormalSource.sameSubmitAsPosition,
    compactNormalRowsLifetimeOwner: packedNormalSource.lifetimeOwner,
    compactNormalRowsPairedWithPositionBuffer: packedNormalSource.pairedWithPositionBuffer,
    compactNormalRowsProducerStage: packedNormalSource.producerStage,
    compactNormalRowsTimestampSpanLabel: packedNormalSource.timestampSpanLabel,
    compactNormalRowsAdditionalSubmitCount: packedNormalSource.additionalSubmitCount,
    compactNormalRowsOwnership: 'extension-owned-retained-buffer'
  };
  const surfaceVertices = {
    schema: ULG_SPH_GPU_RENDER_SURFACE_VERTICES_SCHEMA,
    backend: 'webgpu',
    ...schroederSpatialSourceLineage(resolvedSchroederSpatialSourceFamily),
    status: directCompactPositionDraw
      ? 'surface-vertices-resident-extension-compact-position-direct'
      : (noFullReadback
        ? 'surface-vertices-resident-extension-compact-translation'
        : (translatedVertexCount > 0 ? 'surface-vertices-ready' : 'surface-vertices-empty')),
    sourceSurfaceExecutionSchema: summary.extensionExecutionSchema,
    sourceSurfaceSchema: summary.extensionSurfaceSchema,
    surfaceExtractionMethod: directCompactPositionDraw
      ? 'webgpu-marching-cubes-extension-compact-position-direct'
      : 'webgpu-marching-cubes-extension-compact-position-gpu-translation',
    compactionMode: directCompactPositionDraw
      ? 'webgpu-extension-compact-position-direct'
      : 'webgpu-extension-compact-position-to-ulg-rows',
    directCompactPositionDraw,
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
    compactPositionRowsBufferRetained,
    compactPositionRowsBufferByteLength,
    compactPositionRowsBufferRowCount: sourceVertexCount,
    compactPositionRowsVertexCount: sourceVertexCount,
    compactPositionRowsStrideFloats: sourceStrideFloats,
    compactPositionRowsStrideBytes: Math.max(
      0,
      Math.round(finiteNumber(summary.extensionVertexStrideBytes, sourceStrideFloats * Float32Array.BYTES_PER_ELEMENT))
    ),
    compactPositionRowsFormat: summary.extensionVertexFormat,
    compactPositionRowsSchema: WEBGPU_MARCHING_CUBES_COMPACT_POSITION_ROWS_SCHEMA,
    compactPositionRowsOwnership: 'extension-owned-retained-buffer',
    compactPositionRowsSurfaceGenerationId,
    compactPositionRowsVolumeGenerationId,
    ...compactNormalMetadata,
    vertexRowsBufferClearStatus,
    translationPipelineCacheStatus,
    directCompactPositionDrawIndirectSource,
    drawIndirectRowsOwnership,
    extensionDrawIndirectBufferRetained: Boolean(extensionDrawIndirectBuffer),
    extensionDrawIndirectBufferByteLength,
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
  if (compactPositionRowsBufferRetained) surfaceVertices.compactPositionRowsBuffer = sourceBuffer;
  if (compactNormalRowsBufferRetained) {
    surfaceVertices.compactNormalRowsBuffer = packedNormalSource.buffer;
  }

  const surfaceDraw = {
    schema: ULG_SPH_GPU_RENDER_SURFACE_DRAW_SCHEMA,
    backend: 'webgpu',
    ...schroederSpatialSourceLineage(resolvedSchroederSpatialSourceFamily),
    status: directCompactPositionDraw
      ? 'surface-draw-resident-extension-compact-position-direct'
      : (noFullReadback
        ? 'surface-draw-resident-extension-compact-translation'
        : (triangleCount > 0 ? 'surface-draw-metadata-ready' : 'surface-draw-metadata-empty')),
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
    translationPipelineCacheStatus,
    directCompactPositionDrawIndirectSource,
    drawIndirectRowsOwnership,
    extensionDrawIndirectBufferRetained: Boolean(extensionDrawIndirectBuffer),
    extensionDrawIndirectBufferByteLength,
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
    drawIndirectRowsOwnership,
    directCompactPositionDrawIndirectSource,
    extensionDrawIndirectBufferRetained: Boolean(extensionDrawIndirectBuffer),
    extensionDrawIndirectBufferByteLength,
    compactedVertexRows: noFullReadback ? new Float32Array() : vertexRows,
    compactedVertexRowsByteLength: noFullReadback ? 0 : vertexRows.byteLength,
    compactedVertexRowsBufferByteLength: keepVertexRowsBuffer ? vertexRowsByteLength : 0,
    compactedVertexRowsBufferRetained: keepVertexRowsBuffer,
    compactPositionRowsBufferRetained,
    compactPositionRowsBufferByteLength,
    compactPositionRowsBufferRowCount: sourceVertexCount,
    compactPositionRowsVertexCount: sourceVertexCount,
    compactPositionRowsStrideFloats: sourceStrideFloats,
    compactPositionRowsStrideBytes: Math.max(
      0,
      Math.round(finiteNumber(summary.extensionVertexStrideBytes, sourceStrideFloats * Float32Array.BYTES_PER_ELEMENT))
    ),
    compactPositionRowsFormat: summary.extensionVertexFormat,
    compactPositionRowsSchema: WEBGPU_MARCHING_CUBES_COMPACT_POSITION_ROWS_SCHEMA,
    compactPositionRowsOwnership: 'extension-owned-retained-buffer',
    compactPositionRowsSurfaceGenerationId,
    compactPositionRowsVolumeGenerationId,
    ...compactNormalMetadata,
    directCompactPositionDraw,
    sourceVertexRowCount: translatedVertexCount,
    sourceVertexRowsBufferBound: true,
    readbackMode: noFullReadback ? NO_FULL_READBACK_MODE : FULL_READBACK_MODE,
    queueCompletionStatus,
    queueCompletionMethod,
    surfaceDrawReadback: !noFullReadback,
    surfaceDrawSummaryReadback: summaryReadback,
    surfaceDrawSummaryReadbackByteLength: summaryReadbackByteLength,
    fullSurfaceDrawReadback: !noFullReadback,
    compactionMode: directCompactPositionDraw
      ? 'webgpu-extension-compact-position-direct-draw-metadata'
      : 'webgpu-extension-compact-position-to-ulg-draw-metadata',
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
  if (compactPositionRowsBufferRetained) surfaceDraw.compactPositionRowsBuffer = sourceBuffer;
  if (compactNormalRowsBufferRetained) {
    surfaceDraw.compactNormalRowsBuffer = packedNormalSource.buffer;
  }

  const leaseLedger = createResidentBufferLeaseLedger({
    ledgerId: `sph-extension-surface:${resolvedSurfaceIndex}:${translatedVertexCount}:buffer-leases`,
    stateKey: 'sph-extension-surface',
    scope: 'sph-extension-surface-buffer-leases'
  });
  const leaseIds = [];
  const registerRetainedBuffer = ({
    resourceKey,
    resourceKind,
    buffer,
    byteLength,
    rowCount,
    expectedConsumers,
    status = 'resident-extension-surface-buffer-retained'
  }) => {
    registerResidentBufferResource(leaseLedger, {
      resourceKey,
      resourceKind,
      stateFamily: 'render-surface',
      ownerStage: 'webgpu-marching-cubes-extension-surface-translation',
      producerStage: 'webgpu-marching-cubes-extension-surface-translation',
      source: 'buildWebGpuMarchingCubesExtensionSurfaceRowsWebGpu',
      status,
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
  const compactPositionRowsResourceKey =
    `extension-surface:compact-position:g${packedNormalSource.surfaceGenerationId ?? 'unknown'}:${compactPositionRowsBufferByteLength}`;
  const compactNormalRowsResourceKey =
    `extension-surface:packed-normal:g${packedNormalSource.surfaceGenerationId ?? 'unknown'}:${compactNormalRowsBufferByteLength}`;
  if (directCompactPositionDraw && compactPositionRowsBufferRetained) {
    registerRetainedBuffer({
      resourceKey: compactPositionRowsResourceKey,
      resourceKind: 'extension-owned-compact-position-buffer',
      buffer: sourceBuffer,
      byteLength: compactPositionRowsBufferByteLength,
      rowCount: sourceVertexCount,
      expectedConsumers: ['surface-draw-renderer', 'diagnostics'],
      status: 'resident-extension-surface-buffer-borrowed-generation-owned'
    });
  }
  if (compactNormalRowsBufferRetained) {
    registerRetainedBuffer({
      resourceKey: compactNormalRowsResourceKey,
      resourceKind: 'extension-owned-packed-normal-buffer',
      buffer: packedNormalSource.buffer,
      byteLength: compactNormalRowsBufferByteLength,
      rowCount: packedNormalSource.rowCount,
      expectedConsumers: ['surface-draw-renderer', 'diagnostics'],
      status: 'resident-extension-surface-buffer-borrowed-generation-owned'
    });
  }
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
      resourceKind: useExtensionDrawIndirectBuffer
        ? 'extension-owned-draw-indirect-buffer'
        : 'extension-surface-draw-indirect-buffer',
      buffer: drawIndirectRowsBuffer,
      byteLength: drawIndirectRowsByteLength,
      rowCount: 1,
      expectedConsumers: ['surface-draw-renderer', 'diagnostics'],
      status: useExtensionDrawIndirectBuffer
        ? 'resident-extension-surface-buffer-borrowed'
        : 'resident-extension-surface-buffer-retained'
    });
  }

  const result = {
    schema: ULG_SPH_WEBGPU_MARCHING_CUBES_EXTENSION_TRANSLATION_SCHEMA,
    status: directCompactPositionDraw
      ? 'extension-surface-compact-position-direct-resident-webgpu'
      : (noFullReadback
        ? 'extension-surface-translated-resident-webgpu'
        : 'extension-surface-translated-to-ulg-rows'),
    reason: sourceVertexCount !== translatedVertexCount
      ? 'extension vertexCount was not divisible by 3; trailing vertices were ignored'
      : null,
    backend: 'webgpu',
    ...schroederSpatialSourceLineage(resolvedSchroederSpatialSourceFamily),
    summary,
    sourceBufferBound: true,
    sourceBufferRetained: summary.extensionBufferRetained,
    compactPositionRowsBufferRetained,
    compactPositionRowsBufferByteLength,
    compactPositionRowsVertexCount: sourceVertexCount,
    compactPositionRowsStrideFloats: sourceStrideFloats,
    compactPositionRowsFormat: summary.extensionVertexFormat,
    compactPositionRowsOwnership: 'extension-owned-retained-buffer',
    compactPositionRowsSurfaceGenerationId,
    compactPositionRowsVolumeGenerationId,
    ...compactNormalMetadata,
    directCompactPositionDraw,
    sourceVertexCount,
    translatedVertexCount,
    triangleCount,
    ignoredTrailingVertexCount: sourceVertexCount - translatedVertexCount,
    sourceVertexFormat: summary.extensionVertexFormat,
    sourceVertexStrideFloats: sourceStrideFloats,
    surfaceVertices,
    surfaceDraw,
    vertexRowsBufferClearStatus,
    translationPipelineCacheStatus,
    directCompactPositionDrawIndirectSource,
    drawIndirectRowsOwnership,
    extensionDrawIndirectBufferRetained: Boolean(extensionDrawIndirectBuffer),
    extensionDrawIndirectBufferByteLength,
    positionTransform: resolvedPositionTransform,
    positionTransformStatus: resolvedPositionTransform.status,
    positionClamp: resolvedPositionClamp,
    positionClampStatus: resolvedPositionClamp.status,
    readbackMode: noFullReadback ? NO_FULL_READBACK_MODE : FULL_READBACK_MODE,
    queueCompletionStatus,
    queueCompletionMethod,
    hotLoopGpuTranslationRequired: false,
    hotLoopUlgVertexRowExpansionSkipped: directCompactPositionDraw,
    residentBufferLeaseLedger: leaseLedger,
    residentBufferLeaseSummary: summarizeResidentBufferLeaseLedger(leaseLedger),
    residentBufferLeaseLedgerStatus: leaseLedger.status,
    residentBufferLeaseResourceCount: leaseLedger.resourceCount,
    residentBufferLeaseActiveLeaseCount: leaseLedger.activeLeaseCount
  };
  if (compactNormalRowsBufferRetained) {
    result.compactNormalRowsBuffer = packedNormalSource.buffer;
  }
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
  let destroyReasonForTrace = null;
  const destroyBufferOnce = (resourceKey, buffer) => {
    if (destroyedResourceKeys.has(resourceKey)) return;
    destroyedResourceKeys.add(resourceKey);
    console.debug?.(
      `[ext-surface-destroy] surface=${resolvedSurfaceIndex} key=${resourceKey} reason=${destroyReasonForTrace}`
    );
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
    destroyReasonForTrace = reason;
    invalidateSchroederSurfaceTranslationLineage(result);
    if (releaseLeases) result.releaseExtensionSurfaceBufferLeases();
    if (keepVertexRowsBuffer) {
      destroyResidentBufferWithLease(leaseLedger, vertexRowsResourceKey, () => {
        destroyBufferOnce(vertexRowsResourceKey, vertexRowsBuffer);
      }, { force, reason });
    }
    if (directCompactPositionDraw && compactPositionRowsBufferRetained) {
      destroyResidentBufferWithLease(
        leaseLedger,
        compactPositionRowsResourceKey,
        null,
        { force, reason }
      );
    }
    if (compactNormalRowsBufferRetained) {
      destroyResidentBufferWithLease(
        leaseLedger,
        compactNormalRowsResourceKey,
        null,
        { force, reason }
      );
    }
    if (keepDrawRowsBuffer) {
      destroyResidentBufferWithLease(leaseLedger, drawRowsResourceKey, () => {
        destroyBufferOnce(drawRowsResourceKey, drawRowsBuffer);
      }, { force, reason });
    }
    if (keepDrawIndirectRowsBuffer) {
      destroyResidentBufferWithLease(
        leaseLedger,
        drawIndirectRowsResourceKey,
        useExtensionDrawIndirectBuffer
          ? null
          : () => {
              destroyBufferOnce(drawIndirectRowsResourceKey, drawIndirectRowsBuffer);
            },
        { force, reason }
      );
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
  if (schroederExtractionLineage) {
    publishSchroederSurfaceTranslationLineage({
      translation: result,
      extractionLineage: schroederExtractionLineage
    });
  }
  if (keepVertexRowsBuffer) {
    transferOwnedTranslationBuffer(vertexRowsBuffer);
  }
  if (keepDrawRowsBuffer) {
    transferOwnedTranslationBuffer(drawRowsBuffer);
  }
  if (keepDrawIndirectRowsBuffer && !useExtensionDrawIndirectBuffer) {
    transferOwnedTranslationBuffer(drawIndirectRowsBuffer);
  }
  return result;
  } catch (error) {
    const destroyUncommittedTranslationBuffers = () => {
      for (const buffer of [...ownedTranslationBuffers]) {
        destroyOwnedTranslationBuffer(buffer);
      }
    };
    if (translationSubmissionObserved) {
      try {
        deferSubmittedWorkCleanup(
          device,
          destroyUncommittedTranslationBuffers
        );
      } catch {
        destroyUncommittedTranslationBuffers();
      }
    } else {
      destroyUncommittedTranslationBuffers();
    }
    throw error;
  }
}
