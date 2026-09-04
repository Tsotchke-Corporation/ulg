import {
  SPH_GPU_RENDER_FIELD_CELL_ROW_LANES,
  SPH_GPU_RENDER_FIELD_CELL_ROW_LAYOUT,
  ULG_SPH_GPU_RENDER_FIELD_SCHEMA
} from '../../../ulg-gpu-abi/src/index.js';
import {
  ULG_SPH_WEBGPU_MARCHING_CUBES_BUFFER_VOLUME_DESCRIPTOR_SCHEMA,
  validateUlgRenderFieldBufferVolumeSuccessorLineage
} from './sphMarchingCubesSurfaceAdapter.js';
import { webGpuBufferMatchesDevice } from './sphGpuDeviceIdentity.js';
import {
  COLLECTIVE_DISPERSED_MEDIUM_OPTICAL_ROUTE_SCHEMA
} from './sphOpticalRouteIdentity.js';

export const ULG_SPH_PARTICIPATING_MEDIUM_DESCRIPTOR_SCHEMA =
  'peercompute.ulg.sph-participating-medium-descriptor.v0';
export const ULG_SPH_PARTICIPATING_MEDIUM_GPU_SCHEMA =
  'peercompute.ulg.sph-participating-medium-gpu.v0';
export const ULG_SPH_PARTICIPATING_MEDIUM_PACKED_FRAME_SCHEMA =
  'peercompute.ulg.sph-participating-medium-packed-frame.v0';

export const SPH_PARTICIPATING_MEDIUM_DESCRIPTOR_STATUS = Object.freeze({
  ready: 'participating-medium-ready',
  empty: 'participating-medium-empty',
  blocked: 'participating-medium-blocked'
});
export const SPH_PARTICIPATING_MEDIUM_PACKED_FRAME_STATUS =
  'participating-medium-packed-gpu-resident';
export const SPH_PARTICIPATING_MEDIUM_TEXTURE_FORMAT = 'rgba16float';
export const SPH_PARTICIPATING_MEDIUM_PACK_WORKGROUP_SIZE = 4;
export const SPH_PARTICIPATING_MEDIUM_HALF_FLOAT_MAX = 65504;

const GPU_BUFFER_USAGE = Object.freeze({
  COPY_DST: globalThis.GPUBufferUsage?.COPY_DST ?? 0x08,
  UNIFORM: globalThis.GPUBufferUsage?.UNIFORM ?? 0x40,
  STORAGE: globalThis.GPUBufferUsage?.STORAGE ?? 0x80,
  INDIRECT: globalThis.GPUBufferUsage?.INDIRECT ?? 0x100
});
const GPU_TEXTURE_USAGE = Object.freeze({
  TEXTURE_BINDING: globalThis.GPUTextureUsage?.TEXTURE_BINDING ?? 0x04,
  STORAGE_BINDING: globalThis.GPUTextureUsage?.STORAGE_BINDING ?? 0x08
});

const ROUTE_ROW_BYTES = 8 * Uint32Array.BYTES_PER_ELEMENT;
const PACK_PARAMS_BYTES = 8 * Uint32Array.BYTES_PER_ELEMENT;
const RENDER_UNIFORM_FLOATS = 40;
const RENDER_UNIFORM_BYTES = RENDER_UNIFORM_FLOATS * Float32Array.BYTES_PER_ELEMENT;
const DEFAULT_MAX_OPTICAL_DEPTH = 80;
const DEFAULT_ACTIVITY_EPSILON = 1e-6;
const DEFAULT_STEP_COUNT = 40;
const MIN_STEP_COUNT = 8;
const MAX_STEP_COUNT = 128;
const F32_FINITE_MAX = 3.4028234663852886e38;

const descriptorRecords = new WeakMap();
const runtimeRecords = new WeakMap();
const packedFrameRecords = new WeakMap();

export const sphParticipatingMediumPackWgsl = /* wgsl */`
struct PackParams {
  resolution: u32,
  route_count: u32,
  field_row_stride_vec4: u32,
  reserved0: u32,
  max_optical_depth: f32,
  activity_epsilon: f32,
  reserved1: vec2<f32>,
};

struct RouteRow {
  identity: vec4<u32>,
  scattering_color: vec4<f32>,
};

@group(0) @binding(0) var<storage, read> field_rows: array<vec4<f32>>;
@group(0) @binding(1) var<storage, read> route_rows: array<RouteRow>;
@group(0) @binding(2) var<uniform> params: PackParams;
@group(0) @binding(3) var optical_volume: texture_storage_3d<rgba16float, write>;
@group(0) @binding(4) var scattering_volume: texture_storage_3d<rgba16float, write>;
@group(0) @binding(5) var<storage, read_write> draw_indirect: array<atomic<u32>>;

const HALF_FLOAT_MAX: f32 = 65504.0;
const F32_FINITE_MAX: f32 = 3.402823e38;

fn finite_nonnegative(value: f32, ceiling: f32) -> f32 {
  let finite = value == value && abs(value) <= F32_FINITE_MAX;
  return select(0.0, min(value, ceiling), finite && value > 0.0);
}

fn finite_signed(value: f32, ceiling: f32) -> f32 {
  // Equality with itself is the portable WGSL NaN test. Apply it before the
  // signed clamp so a poisoned asymmetry moment cannot survive the clamp.
  let finite = value == value && abs(value) <= F32_FINITE_MAX;
  let sanitized = select(0.0, value, finite);
  return clamp(sanitized, -ceiling, ceiling);
}

@compute @workgroup_size(4, 4, 4)
fn pack_main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  if (any(global_id >= vec3<u32>(params.resolution))) {
    return;
  }
  if (all(global_id == vec3<u32>(0u))) {
    atomicStore(&draw_indirect[1], 1u);
  }

  let xy_count = params.resolution * params.resolution;
  let cell_index = global_id.x
    + global_id.y * params.resolution
    + global_id.z * xy_count;
  // First find one common physical scale. Clamping individual components
  // before summing changes albedo and asymmetry in optically thick cells.
  // Normalizing every component by the same maximum keeps all ratios intact
  // and avoids overflowing the aggregate before the presentation cap.
  var common_scale = 0.0;
  for (var route_index = 0u; route_index < params.route_count; route_index += 1u) {
    let route = route_rows[route_index];
    let row_index = (route.identity.x + cell_index) * params.field_row_stride_vec4;
    let moments = field_rows[row_index + 1u];
    let route_scattering = finite_nonnegative(moments.y, F32_FINITE_MAX);
    let route_absorption = finite_nonnegative(moments.z, F32_FINITE_MAX);
    common_scale = max(common_scale, max(route_scattering, route_absorption));
  }

  var normalized_scattering = 0.0;
  var normalized_absorption = 0.0;
  var normalized_asymmetry = 0.0;
  var normalized_weighted_temperature = 0.0;
  var normalized_scattering_color = vec3<f32>(0.0);
  if (common_scale > 0.0) {
    for (var route_index = 0u; route_index < params.route_count; route_index += 1u) {
      let route = route_rows[route_index];
      let row_index = (route.identity.x + cell_index) * params.field_row_stride_vec4;
      let moments = field_rows[row_index + 1u];
      let route_scattering = finite_nonnegative(moments.y, F32_FINITE_MAX);
      let route_absorption = finite_nonnegative(moments.z, F32_FINITE_MAX);
      let route_asymmetry = clamp(
        finite_signed(moments.w, F32_FINITE_MAX),
        -0.95 * route_scattering,
        0.95 * route_scattering
      );
      let route_temperature = finite_nonnegative(moments.x, HALF_FLOAT_MAX);
      // Divide directly: 1/common_scale can become a subnormal and flush to
      // zero when the source moment is near the f32 ceiling.
      let scattering_normalized = route_scattering / common_scale;
      let absorption_normalized = route_absorption / common_scale;
      let extinction_normalized = scattering_normalized + absorption_normalized;
      normalized_scattering += scattering_normalized;
      normalized_absorption += absorption_normalized;
      normalized_asymmetry += route_asymmetry / common_scale;
      normalized_weighted_temperature += route_temperature * extinction_normalized;
      normalized_scattering_color += route.scattering_color.rgb
        * scattering_normalized;
    }
  }

  let normalized_extinction = normalized_scattering + normalized_absorption;
  let storage_optical_cap = min(
    finite_nonnegative(params.max_optical_depth, HALF_FLOAT_MAX),
    HALF_FLOAT_MAX
  );
  var packed_extinction = 0.0;
  if (normalized_extinction > 0.0) {
    packed_extinction = storage_optical_cap;
    // Branch instead of eagerly evaluating common_scale * normalized_extinction
    // when the product would overflow f32.
    if (common_scale <= storage_optical_cap / normalized_extinction) {
      packed_extinction = common_scale * normalized_extinction;
    }
  }
  var output_scale = 0.0;
  if (normalized_extinction > 0.0) {
    output_scale = packed_extinction / normalized_extinction;
  }
  let scattering_depth = min(
    normalized_scattering * output_scale,
    HALF_FLOAT_MAX
  );
  let absorption_depth = min(
    normalized_absorption * output_scale,
    HALF_FLOAT_MAX
  );
  let scattering_asymmetry_depth = clamp(
    normalized_asymmetry * output_scale,
    -HALF_FLOAT_MAX,
    HALF_FLOAT_MAX
  );
  let scattering_color_depth = clamp(
    normalized_scattering_color * output_scale,
    vec3<f32>(0.0),
    vec3<f32>(HALF_FLOAT_MAX)
  );
  var temperature = 0.0;
  if (normalized_extinction > 0.0) {
    temperature = min(
      normalized_weighted_temperature / normalized_extinction,
      HALF_FLOAT_MAX
    );
  }
  if (packed_extinction > params.activity_epsilon) {
    atomicMax(&draw_indirect[0], 3u);
  }
  let coordinate = vec3<i32>(global_id);
  textureStore(
    optical_volume,
    coordinate,
    vec4<f32>(
      scattering_depth,
      absorption_depth,
      scattering_asymmetry_depth,
      temperature
    )
  );
  textureStore(
    scattering_volume,
    coordinate,
    vec4<f32>(scattering_color_depth, 0.0)
  );
}
`;

export const sphParticipatingMediumRenderWgsl = /* wgsl */`
struct VolumeUniforms {
  inverse_view_projection: mat4x4<f32>,
  camera_step_count: vec4<f32>,
  bounds_min_cell_edge: vec4<f32>,
  bounds_max_ambient: vec4<f32>,
  light_direction_intensity: vec4<f32>,
  viewport_depth_epsilon: vec4<f32>,
};

@group(0) @binding(0) var<uniform> uniforms: VolumeUniforms;
@group(0) @binding(1) var optical_volume: texture_3d<f32>;
@group(0) @binding(2) var scattering_volume: texture_3d<f32>;
@group(0) @binding(3) var volume_sampler: sampler;
@group(0) @binding(4) var opaque_depth: texture_depth_2d;

const HALF_FLOAT_MAX: f32 = 65504.0;

fn finite_nonnegative_sample(value: f32) -> f32 {
  let finite = value == value && abs(value) <= HALF_FLOAT_MAX;
  return select(0.0, max(value, 0.0), finite);
}

fn finite_signed_sample(value: f32) -> f32 {
  let finite = value == value && abs(value) <= HALF_FLOAT_MAX;
  return select(0.0, value, finite);
}

fn finite_nonnegative_sample3(value: vec3<f32>) -> vec3<f32> {
  let non_nan = select(vec3<f32>(0.0), value, value == value);
  let finite = abs(non_nan) <= vec3<f32>(HALF_FLOAT_MAX);
  return select(
    vec3<f32>(0.0),
    max(non_nan, vec3<f32>(0.0)),
    finite
  );
}

struct VertexOutput {
  @builtin(position) position: vec4<f32>,
};

@vertex
fn vertex_main(@builtin(vertex_index) vertex_index: u32) -> VertexOutput {
  var output: VertexOutput;
  let x = f32((vertex_index << 1u) & 2u);
  let y = f32(vertex_index & 2u);
  output.position = vec4<f32>(x * 2.0 - 1.0, 1.0 - y * 2.0, 0.0, 1.0);
  return output;
}

fn unproject(ndc: vec3<f32>) -> vec3<f32> {
  let homogeneous = uniforms.inverse_view_projection * vec4<f32>(ndc, 1.0);
  let safe_w = select(-1.0e-8, 1.0e-8, homogeneous.w >= 0.0);
  return homogeneous.xyz / select(safe_w, homogeneous.w, abs(homogeneous.w) > 1.0e-8);
}

fn safe_inverse(value: vec3<f32>) -> vec3<f32> {
  let signs = select(vec3<f32>(-1.0), vec3<f32>(1.0), value >= vec3<f32>(0.0));
  return 1.0 / select(signs * vec3<f32>(1.0e-8), value, abs(value) > vec3<f32>(1.0e-8));
}

fn box_interval(origin: vec3<f32>, direction: vec3<f32>) -> vec2<f32> {
  let inverse_direction = safe_inverse(direction);
  let t0 = (uniforms.bounds_min_cell_edge.xyz - origin) * inverse_direction;
  let t1 = (uniforms.bounds_max_ambient.xyz - origin) * inverse_direction;
  let near_axis = min(t0, t1);
  let far_axis = max(t0, t1);
  return vec2<f32>(
    max(max(near_axis.x, near_axis.y), near_axis.z),
    min(min(far_axis.x, far_axis.y), far_axis.z)
  );
}

fn relative_henyey_greenstein(asymmetry: f32, cosine_angle: f32) -> f32 {
  let g = clamp(asymmetry, -0.95, 0.95);
  let denominator = max(1.0 + g * g - 2.0 * g * cosine_angle, 1.0e-5);
  return (1.0 - g * g) / pow(denominator, 1.5);
}

@fragment
fn fragment_main(input: VertexOutput) -> @location(0) vec4<f32> {
  let viewport = max(uniforms.viewport_depth_epsilon.xy, vec2<f32>(1.0));
  let ndc_xy = vec2<f32>(
    input.position.x * 2.0 / viewport.x - 1.0,
    1.0 - input.position.y * 2.0 / viewport.y
  );
  // The scene view-projection matrix is OpenGL-style. Surface shaders remap
  // clip z into WebGPU's [0, 1] depth range, so reverse that remap before
  // applying the original inverse matrix here.
  let near_world = unproject(vec3<f32>(ndc_xy, -1.0));
  let far_world = unproject(vec3<f32>(ndc_xy, 1.0));
  let ray_direction = normalize(far_world - near_world);
  let interval = box_interval(near_world, ray_direction);
  var ray_start = max(interval.x, 0.0);
  var ray_end = interval.y;
  if (!(ray_end > ray_start)) {
    discard;
  }

  let pixel = vec2<i32>(clamp(
    vec2<f32>(input.position.xy),
    vec2<f32>(0.0),
    viewport - vec2<f32>(1.0)
  ));
  let scene_depth = textureLoad(opaque_depth, pixel, 0);
  if (scene_depth < 1.0 - uniforms.viewport_depth_epsilon.z) {
    let scene_world = unproject(vec3<f32>(ndc_xy, scene_depth * 2.0 - 1.0));
    let scene_distance = dot(scene_world - near_world, ray_direction);
    ray_end = min(ray_end, scene_distance);
  }
  if (!(ray_end > ray_start)) {
    discard;
  }

  let requested_steps = clamp(
    u32(max(uniforms.camera_step_count.w, 1.0)),
    1u,
    128u
  );
  let step_length = (ray_end - ray_start) / f32(requested_steps);
  let cell_edge = max(uniforms.bounds_min_cell_edge.w, 1.0e-8);
  let light_direction = normalize(uniforms.light_direction_intensity.xyz);
  let view_direction = -ray_direction;
  var transmittance = 1.0;
  var radiance = vec3<f32>(0.0);
  for (var step_index = 0u; step_index < 128u; step_index += 1u) {
    if (step_index >= requested_steps || transmittance < 0.00390625) {
      break;
    }
    let distance = ray_start + (f32(step_index) + 0.5) * step_length;
    let world_position = near_world + ray_direction * distance;
    let uvw = clamp(
      (world_position - uniforms.bounds_min_cell_edge.xyz)
        / (uniforms.bounds_max_ambient.xyz - uniforms.bounds_min_cell_edge.xyz),
      vec3<f32>(0.0),
      vec3<f32>(1.0)
    );
    let optical = textureSampleLevel(optical_volume, volume_sampler, uvw, 0.0);
    let scattering_color_depth = textureSampleLevel(
      scattering_volume,
      volume_sampler,
      uvw,
      0.0
    ).rgb;
    let distance_scale = step_length / cell_edge;
    let cell_scattering_depth = finite_nonnegative_sample(optical.x);
    let scattering_depth = cell_scattering_depth * distance_scale;
    let absorption_depth = finite_nonnegative_sample(optical.y) * distance_scale;
    let extinction_depth = scattering_depth + absorption_depth;
    if (extinction_depth <= 1.0e-7) {
      continue;
    }
    let segment_transmission = exp(-extinction_depth);
    let segment_opacity = 1.0 - segment_transmission;
    let albedo = scattering_depth / extinction_depth;
    let raw_asymmetry = finite_signed_sample(optical.z)
      / max(cell_scattering_depth, 1.0e-8);
    let defensive_asymmetry = select(
      0.0,
      raw_asymmetry,
      raw_asymmetry == raw_asymmetry && abs(raw_asymmetry) <= HALF_FLOAT_MAX
    );
    let asymmetry = clamp(
      defensive_asymmetry,
      -0.95,
      0.95
    );
    let phase = relative_henyey_greenstein(
      asymmetry,
      // light_direction points from the sample toward the light; photons
      // arrive along its negative, which is the propagation direction used
      // by the physical asymmetry convention.
      dot(-light_direction, view_direction)
    );
    let scattering_color = finite_nonnegative_sample3(scattering_color_depth)
      / max(cell_scattering_depth, 1.0e-8);
    let source = max(scattering_color, vec3<f32>(0.0))
      * albedo
      * (uniforms.bounds_max_ambient.w
        + uniforms.light_direction_intensity.w * phase);
    radiance += transmittance * segment_opacity * source;
    transmittance *= segment_transmission;
  }
  let alpha = clamp(1.0 - transmittance, 0.0, 1.0);
  if (alpha <= 1.0e-6) {
    discard;
  }
  return vec4<f32>(max(radiance, vec3<f32>(0.0)), alpha);
}
`;

function isObject(value) {
  return (typeof value === 'object' && value !== null) || typeof value === 'function';
}

function finiteNumber(value, fallback = null) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function finiteVector(value, length) {
  if (!(Array.isArray(value) || ArrayBuffer.isView(value)) || value.length !== length) {
    return null;
  }
  const vector = Array.from(value, Number);
  return vector.every(Number.isFinite) ? vector : null;
}

function sameVector(left, right, length) {
  const a = finiteVector(left, length);
  const b = finiteVector(right, length);
  return Boolean(a && b && a.every((value, index) => value === b[index]));
}

function exactRowLayout(value) {
  return Array.isArray(value)
    && value.length === SPH_GPU_RENDER_FIELD_CELL_ROW_LAYOUT.length
    && value.every((lane, index) => lane === SPH_GPU_RENDER_FIELD_CELL_ROW_LAYOUT[index]);
}

function surfaceIndexFromEntry(entry) {
  const descriptorIndex = Number(entry?.descriptor?.surfaceIndex);
  if (Number.isSafeInteger(descriptorIndex) && descriptorIndex >= 0) return descriptorIndex;
  const metadataIndex = Number(entry?.metadata?.index);
  return Number.isSafeInteger(metadataIndex) && metadataIndex >= 0 ? metadataIndex : null;
}

function consumedSurfaceIndices(surfaceDescriptors) {
  if (!Array.isArray(surfaceDescriptors)) return Object.freeze([]);
  return Object.freeze(surfaceDescriptors
    .map(surfaceIndexFromEntry)
    .filter((index) => index != null));
}

function exactOrdinarySurfaceEntry(entry) {
  const metadata = entry?.metadata;
  return Boolean(
    isObject(metadata)
    && Number.isSafeInteger(Number(metadata.opticalStateId))
    && Number(metadata.opticalStateId) === 0
  );
}

function blockedDescriptor(reason, surfaceDescriptors = [], extra = {}) {
  return Object.freeze({
    schema: ULG_SPH_PARTICIPATING_MEDIUM_DESCRIPTOR_SCHEMA,
    ok: false,
    status: SPH_PARTICIPATING_MEDIUM_DESCRIPTOR_STATUS.blocked,
    reason,
    routeCount: 0,
    collectiveSurfaceCount: surfaceDescriptors.length,
    consumedSurfaceIndices: consumedSurfaceIndices(surfaceDescriptors),
    readback: false,
    fullReadback: false,
    ...extra
  });
}

function emptyDescriptor() {
  return Object.freeze({
    schema: ULG_SPH_PARTICIPATING_MEDIUM_DESCRIPTOR_SCHEMA,
    ok: true,
    status: SPH_PARTICIPATING_MEDIUM_DESCRIPTOR_STATUS.empty,
    reason: null,
    routeCount: 0,
    collectiveSurfaceCount: 0,
    consumedSurfaceIndices: Object.freeze([]),
    readback: false,
    fullReadback: false
  });
}

function exactMetadataSnapshot(metadata, source) {
  const scalarKeys = [
    'index',
    'resolution',
    'fieldOffset',
    'fieldCellCount',
    'opticalStateId',
    'collectiveOpticalRoute',
    'collectiveOpticalRouteSchema',
    'collectiveOpticalRouteKey',
    'collectiveOpticalRouteId',
    'opticalResponseAuthorityFlag',
    'opticalResponseReady',
    'opticalVisibilityFlag',
    'opticalBlockedFlag'
  ];
  return Boolean(
    isObject(metadata)
    && isObject(source)
    && scalarKeys.every((key) => metadata[key] === source[key])
    && sameVector(metadata.colorLinear, source.colorLinear, 3)
    && (
      metadata.opticalScatteringSourceLinear == null
        ? source.opticalScatteringSourceLinear == null
        : sameVector(
            metadata.opticalScatteringSourceLinear,
            source.opticalScatteringSourceLinear,
            3
          )
    )
  );
}

function routeScatteringColor(metadata) {
  const preferred = finiteVector(metadata?.opticalScatteringSourceLinear, 3);
  const fallback = finiteVector(metadata?.colorLinear, 3);
  const color = preferred || fallback;
  if (!color || color.some((value) => value < 0)) return null;
  // A unit-bounded tint guarantees tau_s * tint remains representable when
  // the aggregate optical depth itself is capped to binary16 range.
  return color.map((value) => Math.min(value, 1));
}

function validateRenderFieldBase(device, renderField) {
  if (!isObject(device)) return 'participating medium requires a GPUDevice';
  if (!isObject(renderField) || renderField.schema !== ULG_SPH_GPU_RENDER_FIELD_SCHEMA) {
    return 'participating medium requires the exact ULG render-field schema';
  }
  if (renderField.backend !== 'webgpu') {
    return 'participating medium requires a WebGPU render field';
  }
  if (renderField.fieldRowsBufferRetained !== true || !isObject(renderField.fieldRowsBuffer)) {
    return 'participating medium requires a retained render-field GPU buffer';
  }
  if (!webGpuBufferMatchesDevice(renderField.fieldRowsBuffer, device)) {
    return 'participating medium rejects a cross-device render-field buffer';
  }
  if (renderField.rowStrideFloats !== SPH_GPU_RENDER_FIELD_CELL_ROW_LAYOUT.length) {
    return 'participating medium requires the exact render-field cell stride';
  }
  if (!exactRowLayout(renderField.rowLayout)) {
    return 'participating medium requires the exact render-field row layout';
  }
  const authoredBytes = Number(renderField.fieldRowsBufferByteLength);
  const bufferBytes = Number(renderField.fieldRowsBuffer.size);
  const requiredBytes = Number(renderField.totalFieldCells)
    * SPH_GPU_RENDER_FIELD_CELL_ROW_LAYOUT.length
    * Float32Array.BYTES_PER_ELEMENT;
  if (
    !Number.isSafeInteger(Number(renderField.totalFieldCells))
    || Number(renderField.totalFieldCells) <= 0
    || !Number.isSafeInteger(authoredBytes)
    || authoredBytes !== requiredBytes
    || !Number.isSafeInteger(bufferBytes)
    || bufferBytes < authoredBytes
  ) {
    return 'participating medium rejects inconsistent render-field buffer bounds';
  }
  if (
    renderField.surfaceTable?.schema !== ULG_SPH_GPU_RENDER_FIELD_SCHEMA
    || !Array.isArray(renderField.surfaceTable.metadata)
    || renderField.surfaceTable.metadata.length !== renderField.surfaceTable.surfaceCount
  ) {
    return 'participating medium requires the exact render-field surface table';
  }
  return null;
}

function validateVolumeDescriptor({
  device,
  renderField,
  volumeDescriptor,
  metadata,
  sourceMetadata
}) {
  if (
    !isObject(volumeDescriptor)
    || volumeDescriptor.schema
      !== ULG_SPH_WEBGPU_MARCHING_CUBES_BUFFER_VOLUME_DESCRIPTOR_SCHEMA
    || volumeDescriptor.ok !== true
    || volumeDescriptor.status !== 'ulg-render-field-buffer-volume-descriptor-ready'
    || volumeDescriptor.device !== device
    || volumeDescriptor.scalarBuffer !== renderField.fieldRowsBuffer
    || volumeDescriptor.storageBuffer !== renderField.fieldRowsBuffer
    || volumeDescriptor.buffer !== renderField.fieldRowsBuffer
    || volumeDescriptor.sameDeviceStatus === 'cross-device-resource'
  ) {
    return 'participating medium rejected an unauthenticated field-volume descriptor';
  }
  const surfaceIndex = Number(volumeDescriptor.surfaceIndex);
  const resolution = Number(sourceMetadata?.resolution);
  const fieldOffset = Number(sourceMetadata?.fieldOffset);
  const fieldCellCount = Number(sourceMetadata?.fieldCellCount);
  if (
    !Number.isSafeInteger(surfaceIndex)
    || surfaceIndex < 0
    || sourceMetadata !== renderField.surfaceTable.metadata[surfaceIndex]
    || !exactMetadataSnapshot(metadata, sourceMetadata)
    || !Number.isSafeInteger(resolution)
    || resolution < 2
    || !Number.isSafeInteger(fieldOffset)
    || fieldOffset < 0
    || fieldCellCount !== resolution ** 3
    || volumeDescriptor.fieldOffset !== fieldOffset
    || volumeDescriptor.fieldCellCount !== fieldCellCount
    || volumeDescriptor.scalarOffset
      !== fieldOffset * SPH_GPU_RENDER_FIELD_CELL_ROW_LAYOUT.length
    || volumeDescriptor.scalarOffsetBytes
      !== volumeDescriptor.scalarOffset * Float32Array.BYTES_PER_ELEMENT
    || volumeDescriptor.cellRowStrideFloats
      !== SPH_GPU_RENDER_FIELD_CELL_ROW_LAYOUT.length
    || !sameVector(volumeDescriptor.dims, [resolution, resolution, resolution], 3)
  ) {
    return 'participating medium rejected inconsistent field-volume bounds';
  }
  if (
    volumeDescriptor.positionTransform?.enabled !== true
    || volumeDescriptor.positionTransformStatus
      !== 'ulg-render-field-grid-to-world-transform-ready'
    || !sameVector(
      volumeDescriptor.positionTransformOriginM,
      volumeDescriptor.positionTransform.originM,
      3
    )
    || !(Number(volumeDescriptor.positionTransformScaleM) > 0)
    || volumeDescriptor.positionTransformScaleM
      !== volumeDescriptor.positionTransform.scaleM
  ) {
    return 'participating medium requires an authenticated grid-to-world transform';
  }
  if (
    renderField.schroederSpatialSourceFamily
    && !validateUlgRenderFieldBufferVolumeSuccessorLineage(volumeDescriptor, {
      device,
      sourceFamily: renderField.schroederSpatialSourceFamily
    })
  ) {
    return 'participating medium rejected stale successor field lineage';
  }
  return null;
}

function validateCollectiveMetadata(metadata) {
  const opticalStateId = Number(metadata?.opticalStateId);
  return Boolean(
    Object.isFrozen(metadata)
    && metadata.collectiveOpticalRoute === true
    && metadata.collectiveOpticalRouteSchema
      === COLLECTIVE_DISPERSED_MEDIUM_OPTICAL_ROUTE_SCHEMA
    && typeof metadata.collectiveOpticalRouteKey === 'string'
    && metadata.collectiveOpticalRouteKey.length > 0
    && Number.isSafeInteger(opticalStateId)
    && opticalStateId > 0
    && Number(metadata.collectiveOpticalRouteId) === opticalStateId
    && metadata.opticalResponseAuthorityFlag === 1
    && metadata.opticalResponseReady === true
    && metadata.opticalVisibilityFlag === 1
    && metadata.opticalBlockedFlag === 0
    && routeScatteringColor(metadata)
  );
}

function snapshotVolumeDescriptor(volumeDescriptor) {
  return Object.freeze({
    surfaceIndex: volumeDescriptor.surfaceIndex,
    scalarBuffer: volumeDescriptor.scalarBuffer,
    fieldOffset: volumeDescriptor.fieldOffset,
    fieldCellCount: volumeDescriptor.fieldCellCount,
    scalarOffset: volumeDescriptor.scalarOffset,
    scalarOffsetBytes: volumeDescriptor.scalarOffsetBytes,
    cellRowStrideFloats: volumeDescriptor.cellRowStrideFloats,
    positionTransform: volumeDescriptor.positionTransform,
    positionTransformStatus: volumeDescriptor.positionTransformStatus,
    positionTransformScaleM: volumeDescriptor.positionTransformScaleM,
    positionTransformGridBias: volumeDescriptor.positionTransformGridBias,
    positionTransformOriginM: Object.freeze([
      ...volumeDescriptor.positionTransformOriginM
    ]),
    dims: Object.freeze([...volumeDescriptor.dims])
  });
}

function volumeDescriptorMatchesSnapshot(volumeDescriptor, snapshot) {
  return Boolean(
    volumeDescriptor.surfaceIndex === snapshot.surfaceIndex
    && volumeDescriptor.scalarBuffer === snapshot.scalarBuffer
    && volumeDescriptor.fieldOffset === snapshot.fieldOffset
    && volumeDescriptor.fieldCellCount === snapshot.fieldCellCount
    && volumeDescriptor.scalarOffset === snapshot.scalarOffset
    && volumeDescriptor.scalarOffsetBytes === snapshot.scalarOffsetBytes
    && volumeDescriptor.cellRowStrideFloats === snapshot.cellRowStrideFloats
    && volumeDescriptor.positionTransform === snapshot.positionTransform
    && volumeDescriptor.positionTransformStatus === snapshot.positionTransformStatus
    && volumeDescriptor.positionTransformScaleM === snapshot.positionTransformScaleM
    && volumeDescriptor.positionTransformGridBias === snapshot.positionTransformGridBias
    && sameVector(
      volumeDescriptor.positionTransformOriginM,
      snapshot.positionTransformOriginM,
      3
    )
    && sameVector(volumeDescriptor.dims, snapshot.dims, 3)
  );
}

export function createSphParticipatingMediumDescriptor({
  device = null,
  renderField = null,
  surfaceDescriptors = []
} = {}) {
  if (!Array.isArray(surfaceDescriptors)) {
    return blockedDescriptor(
      'participating medium surfaceDescriptors must be an array'
    );
  }
  if (surfaceDescriptors.length === 0) return emptyDescriptor();
  // The presenter may pass the complete surface set. Exact optical-state zero
  // is the ordinary marching-cubes route; every other entry is consumed here
  // before collective authority is validated so malformed/blocked media can
  // never fall back to a visible boundary shell.
  const collectiveEntries = surfaceDescriptors.filter(
    (entry) => !exactOrdinarySurfaceEntry(entry)
  );
  if (collectiveEntries.length === 0) return emptyDescriptor();
  const baseReason = validateRenderFieldBase(device, renderField);
  if (baseReason) return blockedDescriptor(baseReason, collectiveEntries);

  const sortedEntries = [...collectiveEntries].sort(
    (left, right) => surfaceIndexFromEntry(left) - surfaceIndexFromEntry(right)
  );
  const routeIds = new Set();
  const surfaceIndices = new Set();
  const routeRowsBuffer = new ArrayBuffer(sortedEntries.length * ROUTE_ROW_BYTES);
  const routeRowsU32 = new Uint32Array(routeRowsBuffer);
  const routeRowsF32 = new Float32Array(routeRowsBuffer);
  const routeRecords = [];
  let commonResolution = null;
  let commonScaleM = null;
  let commonGridBias = null;
  let commonOriginM = null;

  for (let routeIndex = 0; routeIndex < sortedEntries.length; routeIndex += 1) {
    const entry = sortedEntries[routeIndex];
    const volumeDescriptor = entry?.descriptor ?? null;
    const metadata = entry?.metadata ?? null;
    const surfaceIndex = surfaceIndexFromEntry(entry);
    const sourceMetadata = Number.isSafeInteger(surfaceIndex)
      ? renderField.surfaceTable.metadata[surfaceIndex]
      : null;
    if (!validateCollectiveMetadata(metadata)) {
      return blockedDescriptor(
        'participating medium rejected a blocked or noncanonical collective route',
        collectiveEntries,
        { blockedSurfaceIndex: surfaceIndex }
      );
    }
    const descriptorReason = validateVolumeDescriptor({
      device,
      renderField,
      volumeDescriptor,
      metadata,
      sourceMetadata
    });
    if (descriptorReason) {
      return blockedDescriptor(descriptorReason, collectiveEntries, {
        blockedSurfaceIndex: surfaceIndex
      });
    }
    const opticalStateId = Number(metadata.opticalStateId);
    if (routeIds.has(opticalStateId) || surfaceIndices.has(surfaceIndex)) {
      return blockedDescriptor(
        'participating medium rejects duplicate route or surface identity',
        collectiveEntries,
        { blockedSurfaceIndex: surfaceIndex }
      );
    }
    routeIds.add(opticalStateId);
    surfaceIndices.add(surfaceIndex);

    const resolution = Number(sourceMetadata.resolution);
    const scaleM = Number(volumeDescriptor.positionTransformScaleM);
    const gridBias = Number(volumeDescriptor.positionTransformGridBias);
    const originM = finiteVector(volumeDescriptor.positionTransformOriginM, 3);
    if (routeIndex === 0) {
      commonResolution = resolution;
      commonScaleM = scaleM;
      commonGridBias = gridBias;
      commonOriginM = originM;
    } else if (
      resolution !== commonResolution
      || scaleM !== commonScaleM
      || gridBias !== commonGridBias
      || !sameVector(originM, commonOriginM, 3)
    ) {
      return blockedDescriptor(
        'participating medium requires one exact shared grid transform',
        collectiveEntries,
        { blockedSurfaceIndex: surfaceIndex }
      );
    }

    const color = routeScatteringColor(metadata);
    const wordOffset = routeIndex * 8;
    routeRowsU32[wordOffset] = Number(sourceMetadata.fieldOffset);
    routeRowsU32[wordOffset + 1] = resolution;
    routeRowsU32[wordOffset + 2] = opticalStateId;
    routeRowsU32[wordOffset + 3] = surfaceIndex;
    routeRowsF32[wordOffset + 4] = color[0];
    routeRowsF32[wordOffset + 5] = color[1];
    routeRowsF32[wordOffset + 6] = color[2];
    routeRowsF32[wordOffset + 7] = 1;
    routeRecords.push(Object.freeze({
      surfaceIndex,
      opticalStateId,
      fieldOffset: Number(sourceMetadata.fieldOffset),
      resolution,
      scatteringColorLinear: Object.freeze([...color]),
      volumeDescriptor,
      volumeDescriptorSnapshot: snapshotVolumeDescriptor(volumeDescriptor),
      metadata,
      sourceMetadata
    }));
  }

  const maxTextureDimension3D = Number(device.limits?.maxTextureDimension3D);
  if (
    Number.isFinite(maxTextureDimension3D)
    && commonResolution > maxTextureDimension3D
  ) {
    return blockedDescriptor(
      'participating medium grid exceeds maxTextureDimension3D',
      collectiveEntries
    );
  }
  const fieldMinM = commonOriginM.map((value) => value - 0.5 * commonScaleM);
  const fieldMaxM = commonOriginM.map(
    (value) => value + (commonResolution - 0.5) * commonScaleM
  );
  const descriptor = {
    schema: ULG_SPH_PARTICIPATING_MEDIUM_DESCRIPTOR_SCHEMA,
    ok: true,
    status: SPH_PARTICIPATING_MEDIUM_DESCRIPTOR_STATUS.ready,
    reason: null,
    sourceRenderFieldSchema: renderField.schema,
    sourceRenderFieldBackend: renderField.backend,
    routeCount: routeRecords.length,
    collectiveSurfaceCount: routeRecords.length,
    consumedSurfaceIndices: Object.freeze(routeRecords.map((route) => route.surfaceIndex)),
    opticalStateIds: Object.freeze(routeRecords.map((route) => route.opticalStateId)),
    resolution: commonResolution,
    dims: Object.freeze([commonResolution, commonResolution, commonResolution]),
    cellEdgeM: commonScaleM,
    fieldMinM: Object.freeze(fieldMinM),
    fieldMaxM: Object.freeze(fieldMaxM),
    fieldRowsBuffer: renderField.fieldRowsBuffer,
    fieldRowsBufferByteLength: renderField.fieldRowsBufferByteLength,
    fieldCellRowStrideFloats: SPH_GPU_RENDER_FIELD_CELL_ROW_LAYOUT.length,
    temperatureLaneIndex: SPH_GPU_RENDER_FIELD_CELL_ROW_LANES.temperatureK,
    scatteringOpticalDepthLaneIndex:
      SPH_GPU_RENDER_FIELD_CELL_ROW_LANES.scatteringOpticalDepth,
    absorptionOpticalDepthLaneIndex:
      SPH_GPU_RENDER_FIELD_CELL_ROW_LANES.absorptionOpticalDepth,
    scatteringAsymmetryOpticalDepthLaneIndex:
      SPH_GPU_RENDER_FIELD_CELL_ROW_LANES.scatteringAsymmetryOpticalDepth,
    aggregateTextureCount: 2,
    textureFormat: SPH_PARTICIPATING_MEDIUM_TEXTURE_FORMAT,
    storageComponentMax: SPH_PARTICIPATING_MEDIUM_HALF_FLOAT_MAX,
    readback: false,
    fullReadback: false,
    activityMode: 'gpu-indirect-not-read-back',
    sourceReleaseBoundary: 'after-containing-command-buffer-submit'
  };
  descriptorRecords.set(descriptor, {
    active: true,
    device,
    renderField,
    surfaceTable: renderField.surfaceTable,
    surfaceMetadataArray: renderField.surfaceTable.metadata,
    fieldRowsBuffer: renderField.fieldRowsBuffer,
    routeRowsBytes: new Uint8Array(routeRowsBuffer),
    routes: routeRecords,
    resolution: commonResolution,
    cellEdgeM: commonScaleM,
    fieldMinM,
    fieldMaxM
  });
  return Object.freeze(descriptor);
}

function requireDeviceFunction(device, name) {
  if (typeof device?.[name] !== 'function') {
    throw new TypeError(`participating medium requires device.${name}()`);
  }
}

function createPipeline(device, asyncName, syncName, descriptor) {
  if (typeof device[asyncName] === 'function') {
    return Promise.resolve(device[asyncName](descriptor));
  }
  requireDeviceFunction(device, syncName);
  return Promise.resolve(device[syncName](descriptor));
}

export function createSphParticipatingMediumGpu(device, {
  colorFormat = 'rgba8unorm',
  depthFormat = 'depth24plus',
  maxOpticalDepth = DEFAULT_MAX_OPTICAL_DEPTH,
  activityEpsilon = DEFAULT_ACTIVITY_EPSILON
} = {}) {
  for (const name of [
    'createBuffer',
    'createTexture',
    'createShaderModule',
    'createBindGroup',
    'createSampler'
  ]) {
    requireDeviceFunction(device, name);
  }
  requireDeviceFunction(device?.queue, 'writeBuffer');
  if (typeof colorFormat !== 'string' || colorFormat.length === 0) {
    throw new TypeError('participating medium requires a color format');
  }
  if (typeof depthFormat !== 'string' || depthFormat.length === 0) {
    throw new TypeError('participating medium requires a depth format');
  }
  const requestedMaxOpticalDepth = finiteNumber(maxOpticalDepth);
  const resolvedActivityEpsilon = finiteNumber(activityEpsilon);
  if (!(requestedMaxOpticalDepth > 0) || !(resolvedActivityEpsilon >= 0)) {
    throw new RangeError('participating medium optical limits must be finite and nonnegative');
  }
  const resolvedMaxOpticalDepth = Math.min(
    requestedMaxOpticalDepth,
    SPH_PARTICIPATING_MEDIUM_HALF_FLOAT_MAX
  );

  const packModule = device.createShaderModule({
    label: 'ulg-sph-participating-medium-pack-wgsl',
    code: sphParticipatingMediumPackWgsl
  });
  const renderModule = device.createShaderModule({
    label: 'ulg-sph-participating-medium-render-wgsl',
    code: sphParticipatingMediumRenderWgsl
  });
  const packPipelinePromise = createPipeline(
    device,
    'createComputePipelineAsync',
    'createComputePipeline',
    {
      label: 'ulg-sph-participating-medium-pack',
      layout: 'auto',
      compute: { module: packModule, entryPoint: 'pack_main' }
    }
  );
  const renderPipelinePromise = createPipeline(
    device,
    'createRenderPipelineAsync',
    'createRenderPipeline',
    {
      label: 'ulg-sph-participating-medium-render',
      layout: 'auto',
      vertex: { module: renderModule, entryPoint: 'vertex_main' },
      fragment: {
        module: renderModule,
        entryPoint: 'fragment_main',
        targets: [{
          format: colorFormat,
          blend: {
            color: {
              operation: 'add',
              srcFactor: 'one',
              dstFactor: 'one-minus-src-alpha'
            },
            alpha: {
              operation: 'add',
              srcFactor: 'one',
              dstFactor: 'one-minus-src-alpha'
            }
          },
          writeMask: 0xF
        }]
      },
      primitive: { topology: 'triangle-list', cullMode: 'none' }
    }
  );
  const sampler = device.createSampler({
    label: 'ulg-sph-participating-medium-linear-sampler',
    addressModeU: 'clamp-to-edge',
    addressModeV: 'clamp-to-edge',
    addressModeW: 'clamp-to-edge',
    magFilter: 'linear',
    minFilter: 'linear',
    mipmapFilter: 'nearest'
  });
  const record = {
    active: true,
    device,
    colorFormat,
    depthFormat,
    maxOpticalDepth: resolvedMaxOpticalDepth,
    activityEpsilon: resolvedActivityEpsilon,
    packPipelinePromise,
    renderPipelinePromise,
    sampler,
    frames: new Set()
  };
  const runtime = {
    schema: ULG_SPH_PARTICIPATING_MEDIUM_GPU_SCHEMA,
    status: 'participating-medium-gpu-ready-pending-pipelines',
    colorFormat,
    depthFormat,
    textureFormat: SPH_PARTICIPATING_MEDIUM_TEXTURE_FORMAT,
    maxOpticalDepth: resolvedMaxOpticalDepth,
    storageComponentMax: SPH_PARTICIPATING_MEDIUM_HALF_FLOAT_MAX,
    readback: false,
    get destroyed() {
      return !record.active;
    },
    ready: Promise.all([packPipelinePromise, renderPipelinePromise]).then(() => true),
    destroy() {
      if (!record.active) return false;
      record.active = false;
      for (const frame of [...record.frames]) {
        destroySphParticipatingMediumPackedFrame(frame);
      }
      record.frames.clear();
      return true;
    }
  };
  runtimeRecords.set(runtime, record);
  return Object.freeze(runtime);
}

function assertRuntime(runtime) {
  const record = runtimeRecords.get(runtime);
  if (!record || !record.active) {
    throw new TypeError('participating medium GPU runtime is missing or destroyed');
  }
  return record;
}

function validateDescriptorRecord(descriptor, runtimeRecord) {
  const record = descriptorRecords.get(descriptor);
  if (!record || !record.active || descriptor.status !== SPH_PARTICIPATING_MEDIUM_DESCRIPTOR_STATUS.ready) {
    throw new TypeError('participating medium descriptor is missing, consumed, or blocked');
  }
  if (record.device !== runtimeRecord.device || descriptor.fieldRowsBuffer !== record.fieldRowsBuffer) {
    throw new TypeError('participating medium descriptor belongs to a different GPU runtime');
  }
  const currentBaseReason = validateRenderFieldBase(
    runtimeRecord.device,
    record.renderField
  );
  if (currentBaseReason) {
    throw new TypeError(
      `participating medium render-field source failed revalidation: ${currentBaseReason}`
    );
  }
  if (
    record.renderField.fieldRowsBuffer !== record.fieldRowsBuffer
    || record.renderField.fieldRowsBufferRetained !== true
    || record.renderField.surfaceTable !== record.surfaceTable
    || record.surfaceTable.metadata !== record.surfaceMetadataArray
    || !webGpuBufferMatchesDevice(record.fieldRowsBuffer, runtimeRecord.device)
  ) {
    throw new TypeError(
      'participating medium render-field/table identity is stale or cross-device'
    );
  }
  for (const route of record.routes) {
    if (
      record.surfaceMetadataArray[route.surfaceIndex] !== route.sourceMetadata
      || !exactMetadataSnapshot(route.metadata, route.sourceMetadata)
      || !validateCollectiveMetadata(route.metadata)
      || !volumeDescriptorMatchesSnapshot(
        route.volumeDescriptor,
        route.volumeDescriptorSnapshot
      )
    ) {
      throw new TypeError('participating medium route authority changed after descriptor creation');
    }
    if (
      record.renderField.schroederSpatialSourceFamily
      && !validateUlgRenderFieldBufferVolumeSuccessorLineage(
        route.volumeDescriptor,
        {
          device: runtimeRecord.device,
          sourceFamily: record.renderField.schroederSpatialSourceFamily
        }
      )
    ) {
      throw new TypeError('participating medium successor lineage expired before packing');
    }
  }
  return record;
}

function destroyGpuResource(resource) {
  try {
    resource?.destroy?.();
  } catch {
    // Cleanup is best effort and remains idempotent through the frame record.
  }
}

function createPackedFrame(runtime, runtimeRecord, descriptor, descriptorRecord, resources) {
  const record = {
    active: true,
    runtime,
    runtimeRecord,
    descriptor,
    descriptorRecord,
    ...resources
  };
  const frame = {
    schema: ULG_SPH_PARTICIPATING_MEDIUM_PACKED_FRAME_SCHEMA,
    ok: true,
    status: SPH_PARTICIPATING_MEDIUM_PACKED_FRAME_STATUS,
    resolution: descriptor.resolution,
    dims: descriptor.dims,
    routeCount: descriptor.routeCount,
    collectiveSurfaceCount: descriptor.collectiveSurfaceCount,
    consumedSurfaceIndices: descriptor.consumedSurfaceIndices,
    opticalStateIds: descriptor.opticalStateIds,
    opticalTexture: resources.opticalTexture,
    scatteringTexture: resources.scatteringTexture,
    drawIndirectBuffer: resources.drawIndirectBuffer,
    drawIndirectOffsetBytes: 0,
    drawCountMode: 'gpu-indirect-not-read-back',
    sourceBufferConsumptionEncoded: true,
    sourceReleaseBoundary: descriptor.sourceReleaseBoundary,
    readback: false,
    fullReadback: false,
    get destroyed() {
      return !record.active;
    },
    destroy() {
      return destroySphParticipatingMediumPackedFrame(frame);
    }
  };
  record.frame = frame;
  packedFrameRecords.set(frame, record);
  runtimeRecord.frames.add(frame);
  return Object.freeze(frame);
}

export async function encodeSphParticipatingMediumPack(
  runtime,
  encoder,
  descriptor
) {
  const runtimeRecord = assertRuntime(runtime);
  if (
    !isObject(encoder)
    || typeof encoder.clearBuffer !== 'function'
    || typeof encoder.beginComputePass !== 'function'
  ) {
    throw new TypeError('participating medium pack requires a GPUCommandEncoder');
  }
  const descriptorRecord = validateDescriptorRecord(descriptor, runtimeRecord);
  const packPipeline = await runtimeRecord.packPipelinePromise;
  assertRuntime(runtime);
  validateDescriptorRecord(descriptor, runtimeRecord);

  const resolution = descriptorRecord.resolution;
  const textureDescriptor = {
    size: {
      width: resolution,
      height: resolution,
      depthOrArrayLayers: resolution
    },
    dimension: '3d',
    format: SPH_PARTICIPATING_MEDIUM_TEXTURE_FORMAT,
    mipLevelCount: 1,
    sampleCount: 1,
    usage:
      GPU_TEXTURE_USAGE.STORAGE_BINDING
      | GPU_TEXTURE_USAGE.TEXTURE_BINDING
  };
  const resources = [];
  try {
    const opticalTexture = runtimeRecord.device.createTexture({
      ...textureDescriptor,
      label: 'ulg-sph-participating-medium-optical-volume'
    });
    resources.push(opticalTexture);
    const scatteringTexture = runtimeRecord.device.createTexture({
      ...textureDescriptor,
      label: 'ulg-sph-participating-medium-scattering-volume'
    });
    resources.push(scatteringTexture);
    const opticalTextureView = opticalTexture.createView({ dimension: '3d' });
    const scatteringTextureView = scatteringTexture.createView({ dimension: '3d' });
    const routeRowsBuffer = runtimeRecord.device.createBuffer({
      label: 'ulg-sph-participating-medium-route-rows',
      size: descriptorRecord.routeRowsBytes.byteLength,
      usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_DST
    });
    resources.push(routeRowsBuffer);
    const packParamsBuffer = runtimeRecord.device.createBuffer({
      label: 'ulg-sph-participating-medium-pack-params',
      size: PACK_PARAMS_BYTES,
      usage: GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST
    });
    resources.push(packParamsBuffer);
    const drawIndirectBuffer = runtimeRecord.device.createBuffer({
      label: 'ulg-sph-participating-medium-draw-indirect',
      size: 4 * Uint32Array.BYTES_PER_ELEMENT,
      usage:
        GPU_BUFFER_USAGE.STORAGE
        | GPU_BUFFER_USAGE.INDIRECT
        | GPU_BUFFER_USAGE.COPY_DST
    });
    resources.push(drawIndirectBuffer);
    const renderUniformBuffer = runtimeRecord.device.createBuffer({
      label: 'ulg-sph-participating-medium-render-uniforms',
      size: RENDER_UNIFORM_BYTES,
      usage: GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST
    });
    resources.push(renderUniformBuffer);

    const packParamsBytes = new ArrayBuffer(PACK_PARAMS_BYTES);
    const packParamsU32 = new Uint32Array(packParamsBytes);
    const packParamsF32 = new Float32Array(packParamsBytes);
    packParamsU32[0] = resolution;
    packParamsU32[1] = descriptor.routeCount;
    packParamsU32[2] = SPH_GPU_RENDER_FIELD_CELL_ROW_LAYOUT.length / 4;
    packParamsF32[4] = runtimeRecord.maxOpticalDepth;
    packParamsF32[5] = runtimeRecord.activityEpsilon;
    runtimeRecord.device.queue.writeBuffer(
      routeRowsBuffer,
      0,
      descriptorRecord.routeRowsBytes
    );
    runtimeRecord.device.queue.writeBuffer(
      packParamsBuffer,
      0,
      new Uint8Array(packParamsBytes)
    );
    const packBindGroup = runtimeRecord.device.createBindGroup({
      label: 'ulg-sph-participating-medium-pack-bind-group',
      layout: packPipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: descriptorRecord.fieldRowsBuffer } },
        { binding: 1, resource: { buffer: routeRowsBuffer } },
        { binding: 2, resource: { buffer: packParamsBuffer } },
        { binding: 3, resource: opticalTextureView },
        { binding: 4, resource: scatteringTextureView },
        { binding: 5, resource: { buffer: drawIndirectBuffer } }
      ]
    });
    encoder.clearBuffer(drawIndirectBuffer, 0, 4 * Uint32Array.BYTES_PER_ELEMENT);
    const pass = encoder.beginComputePass({
      label: 'ulg-sph-participating-medium-pack-pass'
    });
    pass.setPipeline(packPipeline);
    pass.setBindGroup(0, packBindGroup);
    const dispatchCount = Math.ceil(
      resolution / SPH_PARTICIPATING_MEDIUM_PACK_WORKGROUP_SIZE
    );
    pass.dispatchWorkgroups(dispatchCount, dispatchCount, dispatchCount);
    pass.end();

    descriptorRecord.active = false;
    return createPackedFrame(
      runtime,
      runtimeRecord,
      descriptor,
      descriptorRecord,
      {
        opticalTexture,
        scatteringTexture,
        opticalTextureView,
        scatteringTextureView,
        routeRowsBuffer,
        packParamsBuffer,
        drawIndirectBuffer,
        renderUniformBuffer,
        packDispatch: Object.freeze([
          dispatchCount,
          dispatchCount,
          dispatchCount
        ])
      }
    );
  } catch (error) {
    descriptorRecord.active = false;
    for (const resource of resources) destroyGpuResource(resource);
    throw error;
  }
}

function writeRenderUniforms(record, {
  inverseViewProjectionMatrix,
  cameraPositionM,
  viewportSize,
  lightDirection = [0.38, 0.82, 0.42],
  lightIntensity = 1,
  ambientIntensity = 0.18,
  stepCount = DEFAULT_STEP_COUNT,
  depthEpsilon = 1e-6
}) {
  const inverse = finiteVector(inverseViewProjectionMatrix, 16);
  const camera = finiteVector(cameraPositionM, 3);
  const viewport = finiteVector(viewportSize, 2);
  const light = finiteVector(lightDirection, 3);
  const resolvedLightIntensity = finiteNumber(lightIntensity);
  const resolvedAmbientIntensity = finiteNumber(ambientIntensity);
  const resolvedDepthEpsilon = finiteNumber(depthEpsilon);
  if (
    !inverse
    || !camera
    || !viewport
    || viewport.some((value) => !(value > 0))
    || !light
    || Math.hypot(...light) <= 1e-12
    || !(resolvedLightIntensity >= 0)
    || !(resolvedAmbientIntensity >= 0)
    || !(resolvedDepthEpsilon >= 0)
  ) {
    throw new TypeError('participating medium render uniforms are incomplete or non-finite');
  }
  const resolvedStepCount = Math.max(
    MIN_STEP_COUNT,
    Math.min(MAX_STEP_COUNT, Math.round(finiteNumber(stepCount, DEFAULT_STEP_COUNT)))
  );
  const values = new Float32Array(RENDER_UNIFORM_FLOATS);
  values.set(inverse, 0);
  values.set(camera, 16);
  values[19] = resolvedStepCount;
  values.set(record.descriptorRecord.fieldMinM, 20);
  values[23] = record.descriptorRecord.cellEdgeM;
  values.set(record.descriptorRecord.fieldMaxM, 24);
  values[27] = resolvedAmbientIntensity;
  const lightLength = Math.hypot(...light);
  values[28] = light[0] / lightLength;
  values[29] = light[1] / lightLength;
  values[30] = light[2] / lightLength;
  values[31] = resolvedLightIntensity;
  values[32] = viewport[0];
  values[33] = viewport[1];
  values[34] = resolvedDepthEpsilon;
  record.runtimeRecord.device.queue.writeBuffer(
    record.renderUniformBuffer,
    0,
    values
  );
  return Object.freeze({
    stepCount: resolvedStepCount,
    viewportSize: Object.freeze([...viewport]),
    readback: false
  });
}

export async function encodeSphParticipatingMediumRender(
  runtime,
  pass,
  {
    packedFrame = null,
    inverseViewProjectionMatrix = null,
    cameraPositionM = null,
    viewportSize = null,
    depthTextureView = null,
    lightDirection = [0.38, 0.82, 0.42],
    lightIntensity = 1,
    ambientIntensity = 0.18,
    stepCount = DEFAULT_STEP_COUNT,
    depthEpsilon = 1e-6
  } = {}
) {
  const runtimeRecord = assertRuntime(runtime);
  const frameRecord = packedFrameRecords.get(packedFrame);
  if (
    !frameRecord
    || !frameRecord.active
    || frameRecord.runtime !== runtime
    || !isObject(pass)
    || typeof pass.setPipeline !== 'function'
    || typeof pass.setBindGroup !== 'function'
    || typeof pass.drawIndirect !== 'function'
    || !isObject(depthTextureView)
  ) {
    throw new TypeError('participating medium render requires a live packed frame, pass, and depth view');
  }
  const renderPipeline = await runtimeRecord.renderPipelinePromise;
  assertRuntime(runtime);
  if (!frameRecord.active) {
    throw new TypeError('participating medium packed frame was destroyed before rendering');
  }
  const uniformReceipt = writeRenderUniforms(frameRecord, {
    inverseViewProjectionMatrix,
    cameraPositionM,
    viewportSize,
    lightDirection,
    lightIntensity,
    ambientIntensity,
    stepCount,
    depthEpsilon
  });
  const bindGroup = runtimeRecord.device.createBindGroup({
    label: 'ulg-sph-participating-medium-render-bind-group',
    layout: renderPipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: { buffer: frameRecord.renderUniformBuffer } },
      { binding: 1, resource: frameRecord.opticalTextureView },
      { binding: 2, resource: frameRecord.scatteringTextureView },
      { binding: 3, resource: runtimeRecord.sampler },
      { binding: 4, resource: depthTextureView }
    ]
  });
  pass.setPipeline(renderPipeline);
  pass.setBindGroup(0, bindGroup);
  pass.drawIndirect(frameRecord.drawIndirectBuffer, 0);
  return Object.freeze({
    status: 'participating-medium-render-encoded',
    routeCount: packedFrame.routeCount,
    consumedSurfaceIndices: packedFrame.consumedSurfaceIndices,
    drawCountMode: packedFrame.drawCountMode,
    readback: false,
    ...uniformReceipt
  });
}

export function destroySphParticipatingMediumPackedFrame(frame) {
  const record = packedFrameRecords.get(frame);
  if (!record || !record.active) return false;
  record.active = false;
  record.runtimeRecord.frames.delete(frame);
  for (const resource of [
    record.opticalTexture,
    record.scatteringTexture,
    record.routeRowsBuffer,
    record.packParamsBuffer,
    record.drawIndirectBuffer,
    record.renderUniformBuffer
  ]) {
    destroyGpuResource(resource);
  }
  return true;
}

function finiteNonnegativeMoment(value, ceiling = F32_FINITE_MAX) {
  const number = Number(value);
  if (!Number.isFinite(number) || !(number > 0)) return 0;
  return Math.min(number, ceiling);
}

function finiteSignedMoment(value, ceiling = F32_FINITE_MAX) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.max(-ceiling, Math.min(ceiling, number));
}

export function aggregateSphParticipatingMediumMoments(
  routes = [],
  { maxOpticalDepth = DEFAULT_MAX_OPTICAL_DEPTH } = {}
) {
  if (!Array.isArray(routes)) {
    throw new TypeError('participating medium moment routes must be an array');
  }
  const requestedCap = finiteNumber(maxOpticalDepth);
  if (!(requestedCap > 0)) {
    throw new RangeError('participating medium aggregate requires a positive optical cap');
  }
  const opticalCap = Math.min(
    requestedCap,
    SPH_PARTICIPATING_MEDIUM_HALF_FLOAT_MAX
  );
  const prepared = routes.map((route) => {
    const scatteringOpticalDepth = finiteNonnegativeMoment(
      route?.scatteringOpticalDepth
    );
    const absorptionOpticalDepth = finiteNonnegativeMoment(
      route?.absorptionOpticalDepth
    );
    const scatteringAsymmetryOpticalDepth = Math.max(
      -0.95 * scatteringOpticalDepth,
      Math.min(
        0.95 * scatteringOpticalDepth,
        finiteSignedMoment(route?.scatteringAsymmetryOpticalDepth)
      )
    );
    const temperatureK = finiteNonnegativeMoment(
      route?.temperatureK,
      SPH_PARTICIPATING_MEDIUM_HALF_FLOAT_MAX
    );
    const scatteringColorLinear = finiteVector(
      route?.scatteringColorLinear,
      3
    )?.map((value) => Math.max(0, Math.min(1, value))) ?? [0, 0, 0];
    return {
      scatteringOpticalDepth,
      absorptionOpticalDepth,
      scatteringAsymmetryOpticalDepth,
      temperatureK,
      scatteringColorLinear
    };
  });
  const commonScale = prepared.reduce((maximum, route) => Math.max(
    maximum,
    route.scatteringOpticalDepth,
    route.absorptionOpticalDepth
  ), 0);
  if (!(commonScale > 0)) {
    return Object.freeze({
      scatteringOpticalDepth: 0,
      absorptionOpticalDepth: 0,
      scatteringAsymmetryOpticalDepth: 0,
      extinctionOpticalDepth: 0,
      temperatureK: 0,
      scatteringColorOpticalDepth: Object.freeze([0, 0, 0]),
      scatteringColorLinear: Object.freeze([0, 0, 0]),
      transmission: 1,
      commonNormalizationScale: 0,
      storageComponentMax: SPH_PARTICIPATING_MEDIUM_HALF_FLOAT_MAX
    });
  }
  let normalizedScattering = 0;
  let normalizedAbsorption = 0;
  let normalizedAsymmetry = 0;
  let normalizedWeightedTemperature = 0;
  const normalizedScatteringColor = [0, 0, 0];
  for (const route of prepared) {
    const scattering = route.scatteringOpticalDepth / commonScale;
    const absorption = route.absorptionOpticalDepth / commonScale;
    const extinction = scattering + absorption;
    normalizedScattering += scattering;
    normalizedAbsorption += absorption;
    normalizedAsymmetry += route.scatteringAsymmetryOpticalDepth / commonScale;
    normalizedWeightedTemperature += route.temperatureK * extinction;
    for (let lane = 0; lane < 3; lane += 1) {
      normalizedScatteringColor[lane] += route.scatteringColorLinear[lane]
        * scattering;
    }
  }
  const normalizedExtinction = normalizedScattering + normalizedAbsorption;
  const uncappedFits = commonScale <= opticalCap / normalizedExtinction;
  const extinctionOpticalDepth = uncappedFits
    ? commonScale * normalizedExtinction
    : opticalCap;
  const outputScale = extinctionOpticalDepth / normalizedExtinction;
  const scatteringOpticalDepth = Math.min(
    SPH_PARTICIPATING_MEDIUM_HALF_FLOAT_MAX,
    normalizedScattering * outputScale
  );
  const absorptionOpticalDepth = Math.min(
    SPH_PARTICIPATING_MEDIUM_HALF_FLOAT_MAX,
    normalizedAbsorption * outputScale
  );
  const scatteringAsymmetryOpticalDepth = Math.max(
    -SPH_PARTICIPATING_MEDIUM_HALF_FLOAT_MAX,
    Math.min(
      SPH_PARTICIPATING_MEDIUM_HALF_FLOAT_MAX,
      normalizedAsymmetry * outputScale
    )
  );
  const scatteringColorOpticalDepth = normalizedScatteringColor.map(
    (value) => Math.min(
      SPH_PARTICIPATING_MEDIUM_HALF_FLOAT_MAX,
      Math.max(0, value * outputScale)
    )
  );
  const scatteringColorLinear = scatteringColorOpticalDepth.map(
    (value) => scatteringOpticalDepth > 0
      ? value / scatteringOpticalDepth
      : 0
  );
  const temperatureK = Math.min(
    SPH_PARTICIPATING_MEDIUM_HALF_FLOAT_MAX,
    normalizedWeightedTemperature / normalizedExtinction
  );
  return Object.freeze({
    scatteringOpticalDepth,
    absorptionOpticalDepth,
    scatteringAsymmetryOpticalDepth,
    extinctionOpticalDepth,
    temperatureK,
    scatteringColorOpticalDepth: Object.freeze(scatteringColorOpticalDepth),
    scatteringColorLinear: Object.freeze(scatteringColorLinear),
    transmission: Math.exp(-extinctionOpticalDepth),
    commonNormalizationScale: commonScale,
    storageComponentMax: SPH_PARTICIPATING_MEDIUM_HALF_FLOAT_MAX
  });
}

export function evaluateSphParticipatingMediumBeerLambert({
  scatteringOpticalDepth = 0,
  absorptionOpticalDepth = 0,
  distanceScale = 1
} = {}) {
  const scattering = Math.max(0, finiteNumber(scatteringOpticalDepth, 0));
  const absorption = Math.max(0, finiteNumber(absorptionOpticalDepth, 0));
  const scale = Math.max(0, finiteNumber(distanceScale, 0));
  const extinctionOpticalDepth = (scattering + absorption) * scale;
  const transmission = Math.exp(-extinctionOpticalDepth);
  return Object.freeze({
    scatteringOpticalDepth: scattering * scale,
    absorptionOpticalDepth: absorption * scale,
    extinctionOpticalDepth,
    transmission,
    opacity: -Math.expm1(-extinctionOpticalDepth),
    singleScatteringAlbedo: extinctionOpticalDepth > 0
      ? scattering / (scattering + absorption)
      : 0
  });
}

export function evaluateSphHenyeyGreensteinPhase({
  asymmetry = 0,
  cosineAngle = 0,
  relativeToIsotropic = false
} = {}) {
  const g = Math.max(-0.95, Math.min(0.95, finiteNumber(asymmetry, 0)));
  const cosine = Math.max(-1, Math.min(1, finiteNumber(cosineAngle, 0)));
  const denominator = Math.max(1 + g * g - 2 * g * cosine, 1e-12);
  const relative = (1 - g * g) / Math.pow(denominator, 1.5);
  return relativeToIsotropic ? relative : relative / (4 * Math.PI);
}
