import {
  SPH_GPU_PARTICLE_STATE_ROW_LAYOUT,
  SPH_GPU_PARTICLE_THERMO_ROW_LAYOUT,
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
  tagWebGpuBufferDevice,
  webGpuBufferMatchesDevice,
  webGpuDeviceId
} from './sphGpuDeviceIdentity.js';

export const SPH_MATERIAL_INTERFACE_SOURCE_LOCAL_SCHEMA =
  'peercompute.ulg.sph-material-interface-source-local-field.v0';
export const SPH_MATERIAL_INTERFACE_SOURCE_LOCAL_GPU_LANE_SCHEMA =
  'peercompute.ulg.sph-material-interface-source-local-gpu-lane.v0';
export const SPH_MATERIAL_INTERFACE_SOURCE_LOCAL_GPU_GENERATION_SCHEMA =
  'peercompute.ulg.sph-material-interface-source-local-gpu-generation.v0';
export const SPH_MATERIAL_INTERFACE_SOURCE_LOCAL_GPU_LANE_POOL_SCHEMA =
  'peercompute.ulg.sph-material-interface-source-local-gpu-lane-pool.v0';
export const SPH_MATERIAL_INTERFACE_SOURCE_LOCAL_GPU_LANE_ACQUISITION_SCHEMA =
  'peercompute.ulg.sph-material-interface-source-local-gpu-lane-acquisition.v0';

const SPH_GPU_PARTICLE_STATE_FLOATS = SPH_GPU_PARTICLE_STATE_ROW_LAYOUT.length;
const SPH_GPU_PARTICLE_THERMO_FLOATS = SPH_GPU_PARTICLE_THERMO_ROW_LAYOUT.length;
const SPH_GPU_RENDER_ROW_FLOATS = SPH_GPU_RENDER_ROW_LAYOUT.length;
const SPH_GPU_RENDER_SURFACE_ROW_FLOATS = SPH_GPU_RENDER_SURFACE_ROW_LAYOUT.length;
const SPH_GPU_RENDER_FIELD_CELL_FLOATS = SPH_GPU_RENDER_FIELD_CELL_ROW_LAYOUT.length;
const SPH_GPU_REACTION_PRODUCT_EVENT_FLOATS = SPH_GPU_REACTION_PRODUCT_EVENT_ROW_LAYOUT.length;
const FULL_READBACK_MODE = 'full-parity-readback';
const NO_FULL_READBACK_MODE = 'no-full-readback';
const SOURCE_LOCAL_KERNEL_SCOPE = 'sph-resident-material-interface-source-local-splat';
const SOURCE_LOCAL_DENSITY_SCALE = 1024;
const SOURCE_LOCAL_LANE_PARAMS_BYTES = 48;
const SOURCE_LOCAL_LANE_PARAMS_SLOT_COUNT_DEFAULT = 16;
const SOURCE_LOCAL_LANE_POOL_MAX_ENTRIES_DEFAULT = 6;
const SOURCE_LOCAL_LANE_POOL_MAX_ENTRIES_MIN = 4;
const SOURCE_LOCAL_LANE_POOL_MAX_ENTRIES_MAX = 8;
const SOURCE_LOCAL_LANE_POOLS = new WeakMap();
const STORAGE_U32_RUNTIME_ARRAY_STRIDE_BYTES = Uint32Array.BYTES_PER_ELEMENT;
const STORAGE_VEC4_RUNTIME_ARRAY_STRIDE_BYTES = 4 * Float32Array.BYTES_PER_ELEMENT;

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

// The resident pressure lane reads the authoritative particle buffers directly.
// It intentionally avoids materializing the larger presentation render-row ABI.
const sphMaterialInterfaceSourceLocalResidentSplatWgsl = `
struct SourceFieldLaneParams {
  particle_count: u32,
  surface_count: u32,
  total_field_cells: u32,
  product_event_count: u32,
  field_padding: f32,
  ref_edge_m: f32,
  density_scale: f32,
  source_count: u32,
  render_domain_base_count: u32,
  render_domain_drop_count: u32,
  state_stride_vec4s: u32,
  thermo_stride_vec4s: u32,
};

@group(0) @binding(0) var<storage, read> sph_state: array<vec4<f32>>;
@group(0) @binding(1) var<storage, read> sph_thermo: array<vec4<f32>>;
@group(0) @binding(2) var<storage, read> render_surfaces: array<vec4<f32>>;
@group(0) @binding(3) var<storage, read_write> density_accum: array<atomic<u32>>;
@group(0) @binding(4) var<uniform> params: SourceFieldLaneParams;
@group(0) @binding(5) var<storage, read> product_events: array<vec4<f32>>;
@group(0) @binding(6) var<storage, read_write> source_index_accum: array<atomic<u32>>;
@group(0) @binding(7) var<storage, read> product_event_arena_metadata: array<u32>;

const PRODUCT_EVENT_VEC4_STRIDE: u32 = 8u;

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

fn particle_render_domain_id(particle_index: u32) -> f32 {
  if (params.render_domain_base_count > 0u && particle_index < params.render_domain_base_count) {
    return 1.0;
  }
  if (
    params.render_domain_drop_count > 0u
    && particle_index >= params.render_domain_base_count
    && particle_index < params.render_domain_base_count + params.render_domain_drop_count
  ) {
    return 2.0;
  }
  return 0.0;
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
            let _source_claim = atomicCompareExchangeWeak(
              &source_index_accum[out_index],
              0u,
              source_key
            );
          }
        }
      }
    }
  }
}

fn splat_particle(particle_index: u32, surface_index: u32) {
  let s0 = surface_row0(surface_index);
  let s1 = surface_row1(surface_index);
  let material_id = s0.x;
  let phase_id = s0.y;
  let render_domain_id = max(render_surfaces[surface_index * 4u + 3u].x, 0.0);
  let state0 = sph_state[particle_index * params.state_stride_vec4s];
  let thermo0 = sph_thermo[particle_index * params.thermo_stride_vec4s];
  let source_domain_id = particle_render_domain_id(particle_index);
  if (
    thermo0.x != material_id
    || thermo0.y != phase_id
    || !source_matches_domain(source_domain_id, render_domain_id)
  ) {
    return;
  }
  splat_source(normalized_position(state0.xyz), surface_index, s0, s1, particle_index + 1u);
}

fn splat_product_event(event_index: u32) {
  let event0 = product_event_row0(event_index);
  let event1 = product_event_row1(event_index);
  let event2 = product_event_row2(event_index);
  let event3 = product_event_row3(event_index);
  let event4 = product_event_row4(event_index);
  let event_material_id = event1.x;
  let event_phase_id = event2.w;
  let event_unplaced_mass_kg = event3.y;
  let event_status = event4.z;
  if (event_status != 1.0 || event_unplaced_mass_kg <= 0.0) {
    return;
  }
  for (var surface_index = 0u; surface_index < params.surface_count; surface_index += 1u) {
    let s0 = surface_row0(surface_index);
    let s1 = surface_row1(surface_index);
    if (
      event_material_id != s0.x
      || (event_phase_id > 0.0 && event_phase_id != s0.y)
    ) {
      continue;
    }
    splat_source(normalized_position(event0.xyz), surface_index, s0, s1, 0u);
  }
}

fn exact_product_event_prefix_count() -> u32 {
  if (arrayLength(&product_event_arena_metadata) < 16u) {
    return 0u;
  }
  let occupied_count = product_event_arena_metadata[2];
  let active_count = product_event_arena_metadata[3];
  let capacity = product_event_arena_metadata[4];
  if (
    product_event_arena_metadata[0] != 0x554c4750u
    || product_event_arena_metadata[1] != 1u
    || product_event_arena_metadata[6] != 0u
    || product_event_arena_metadata[8] != ${SPH_GPU_REACTION_PRODUCT_EVENT_FLOATS}u
    || product_event_arena_metadata[15] != 1u
    || occupied_count != active_count
    || active_count > capacity
    || active_count > params.product_event_count
  ) {
    return 0u;
  }
  return active_count;
}

@compute @workgroup_size(64, 1, 1)
fn splat_particles(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let particle_index = global_id.x;
  let surface_index = global_id.y;
  if (particle_index >= params.particle_count || surface_index >= params.surface_count) {
    return;
  }
  splat_particle(particle_index, surface_index);
}

@compute @workgroup_size(64, 1, 1)
fn splat_product_events_exact(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let event_index = global_id.x;
  if (event_index >= exact_product_event_prefix_count()) {
    return;
  }
  splat_product_event(event_index);
}

@compute @workgroup_size(64, 1, 1)
fn splat_product_events_bounded(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let event_index = global_id.x;
  if (event_index >= params.product_event_count) {
    return;
  }
  splat_product_event(event_index);
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

function runtimeArrayStorageBindingByteLength(
  payloadByteLength,
  elementStrideBytes = STORAGE_U32_RUNTIME_ARRAY_STRIDE_BYTES
) {
  const payload = nonNegativeInteger(payloadByteLength, 'payloadByteLength');
  const stride = positiveInteger(elementStrideBytes, 'elementStrideBytes');
  if (stride % STORAGE_U32_RUNTIME_ARRAY_STRIDE_BYTES !== 0) {
    throw new RangeError('elementStrideBytes must be aligned to four bytes');
  }
  return Math.max(stride, alignTo(payload, STORAGE_U32_RUNTIME_ARRAY_STRIDE_BYTES));
}

function writeStorageBuffer(
  device,
  label,
  data,
  extraUsage = 0,
  elementStrideBytes = STORAGE_U32_RUNTIME_ARRAY_STRIDE_BYTES
) {
  const byteLength = runtimeArrayStorageBindingByteLength(
    data.byteLength,
    elementStrideBytes
  );
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

function nonNegativeInteger(value, name) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 0 || number > 0xffffffff) {
    throw new RangeError(`${name} must be a uint32`);
  }
  return number;
}

function positiveInteger(value, name) {
  const number = nonNegativeInteger(value, name);
  if (number < 1) throw new RangeError(`${name} must be positive`);
  return number;
}

function nonEmptyStringOrNull(value) {
  if (value == null) return null;
  const text = String(value).trim();
  return text || null;
}

function alignTo(value, alignment) {
  return Math.ceil(value / alignment) * alignment;
}

function sourceFieldSurfaceTopologyKey(surfaceTable) {
  assertRenderFieldSurfaceTable(surfaceTable);
  const bytes = new Uint8Array(
    surfaceTable.records.buffer,
    surfaceTable.records.byteOffset,
    surfaceTable.records.byteLength
  );
  let hash = 2166136261;
  for (const byte of bytes) {
    hash ^= byte;
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return [
    surfaceTable.schema,
    surfaceTable.surfaceCount,
    surfaceTable.totalFieldCells,
    surfaceTable.maxFieldCellCount,
    surfaceTable.records.byteLength,
    hash.toString(16)
  ].join('|');
}

function createSourceFieldLaneParamsArray({
  particleCount,
  productEventCount,
  surfaceCount,
  totalFieldCells,
  fieldPadding,
  refEdgeM,
  densityScale,
  sourceCount,
  renderDomainBaseCount,
  renderDomainDropCount
}) {
  const buffer = new ArrayBuffer(SOURCE_LOCAL_LANE_PARAMS_BYTES);
  const view = new DataView(buffer);
  view.setUint32(0, particleCount, true);
  view.setUint32(4, surfaceCount, true);
  view.setUint32(8, totalFieldCells, true);
  view.setUint32(12, productEventCount, true);
  view.setFloat32(16, fieldPadding, true);
  view.setFloat32(20, refEdgeM, true);
  view.setFloat32(24, densityScale, true);
  view.setUint32(28, sourceCount, true);
  view.setUint32(32, renderDomainBaseCount, true);
  view.setUint32(36, renderDomainDropCount, true);
  view.setUint32(40, SPH_GPU_PARTICLE_STATE_FLOATS / 4, true);
  view.setUint32(44, SPH_GPU_PARTICLE_THERMO_FLOATS / 4, true);
  return buffer;
}

function assertLaneBuffer(device, buffer, requiredByteLength, name) {
  if (!buffer) throw new TypeError(`${name} is required`);
  if (!webGpuBufferMatchesDevice(buffer, device)) {
    throw new Error(`${name} belongs to a different GPUDevice`);
  }
  const byteLength = Number(buffer.size ?? buffer.byteLength);
  if (Number.isFinite(byteLength) && byteLength < requiredByteLength) {
    throw new RangeError(`${name} is too small (${byteLength} < ${requiredByteLength})`);
  }
  return buffer;
}

function residentNeighborhoodGenerationIdentity(value = null, laneExecutionIdentity = null) {
  const descriptor = value?.descriptor || value || {};
  const lease = descriptor.lease || value?.lease || {};
  const productionLane = value?.productionLane || {};
  const generation = nonNegativeInteger(
    value?.generation ?? productionLane.generation ?? descriptor.generation,
    'residentNeighborhoodIdentity.generation'
  );
  const positionEpoch = nonNegativeInteger(
    value?.positionEpoch
      ?? productionLane.positionEpoch
      ?? descriptor.positionValidity?.positionEpoch,
    'residentNeighborhoodIdentity.positionEpoch'
  );
  const fields = {
    laneId: nonEmptyStringOrNull(value?.laneId ?? productionLane.laneId ?? lease.laneId),
    stateKey: nonEmptyStringOrNull(value?.stateKey ?? productionLane.stateKey ?? lease.stateKey),
    sourceFamily: nonEmptyStringOrNull(
      value?.sourceFamily ?? productionLane.sourceFamily ?? lease.sourceFamily
    ),
    leaseId: nonEmptyStringOrNull(value?.leaseId ?? productionLane.leaseId ?? lease.leaseId),
    taskId: nonEmptyStringOrNull(value?.taskId ?? laneExecutionIdentity?.taskId),
    deviceId: nonEmptyStringOrNull(value?.deviceId ?? lease.deviceId),
    authoritative: Boolean(
      value?.authoritative ?? productionLane.authoritative ?? lease.authoritative
    ),
    sourceCount: value?.sourceCount ?? descriptor.sourceCount ?? null
  };
  for (const key of ['laneId', 'stateKey', 'sourceFamily', 'leaseId']) {
    const laneValue = nonEmptyStringOrNull(laneExecutionIdentity?.[key]);
    if (fields[key] && laneValue && fields[key] !== laneValue) {
      throw new Error(`resident neighborhood ${key} does not match lane execution identity`);
    }
    fields[key] ??= laneValue;
  }
  fields.taskId ??= nonEmptyStringOrNull(laneExecutionIdentity?.taskId);
  return { generation, positionEpoch, ...fields };
}

/**
 * Owns reusable source-field scratch for a ComputeManager/GPUHub lane. Each
 * generation is encoded into a caller-owned command encoder and is only valid
 * until the next generation clears the same scratch buffers.
 */
export function createSphMaterialInterfaceSourceFieldLocalGpuLane(device, {
  surfaceTable,
  particleCapacity,
  productEventCapacity = 0,
  fieldPadding = 0.22,
  refEdgeM = 10,
  renderDomainBaseCount = 0,
  renderDomainDropCount = 0,
  paramsSlotCount = SOURCE_LOCAL_LANE_PARAMS_SLOT_COUNT_DEFAULT,
  generationBase = 1,
  label = 'ulg-sph-material-interface-source-local-resident-lane'
} = {}) {
  if (!device?.createBuffer || !device?.createBindGroup || !device?.queue?.writeBuffer) {
    throw new TypeError('material-interface source-field lane requires a WebGPU-like device');
  }
  assertRenderFieldSurfaceTable(surfaceTable);
  const particles = positiveInteger(particleCapacity, 'particleCapacity');
  const products = nonNegativeInteger(productEventCapacity, 'productEventCapacity');
  const slots = positiveInteger(paramsSlotCount, 'paramsSlotCount');
  const firstGeneration = nonNegativeInteger(generationBase, 'generationBase');
  const padding = Number(fieldPadding);
  const edge = Number(refEdgeM);
  if (!Number.isFinite(padding) || padding < 0 || padding >= 0.5) {
    throw new RangeError('fieldPadding must be finite in [0, 0.5)');
  }
  if (!Number.isFinite(edge) || edge <= 0) throw new RangeError('refEdgeM must be positive');
  const baseDomainCount = nonNegativeInteger(renderDomainBaseCount, 'renderDomainBaseCount');
  const dropDomainCount = nonNegativeInteger(renderDomainDropCount, 'renderDomainDropCount');
  const topologyKey = sourceFieldSurfaceTopologyKey(surfaceTable);
  const fieldRowByteLength = surfaceTable.totalFieldCells
    * SPH_GPU_RENDER_FIELD_CELL_FLOATS
    * Float32Array.BYTES_PER_ELEMENT;
  const atomicByteLength = surfaceTable.totalFieldCells * Uint32Array.BYTES_PER_ELEMENT;
  const fieldRowsBufferByteLength = runtimeArrayStorageBindingByteLength(
    fieldRowByteLength,
    STORAGE_VEC4_RUNTIME_ARRAY_STRIDE_BYTES
  );
  const surfaceBufferPayloadByteLength = surfaceTable.records.byteLength;
  const surfaceBufferByteLength = runtimeArrayStorageBindingByteLength(
    surfaceBufferPayloadByteLength,
    STORAGE_VEC4_RUNTIME_ARRAY_STRIDE_BYTES
  );
  const atomicBufferByteLength = runtimeArrayStorageBindingByteLength(
    atomicByteLength,
    STORAGE_U32_RUNTIME_ARRAY_STRIDE_BYTES
  );
  const paramsAlignment = Math.max(
    256,
    positiveInteger(
      device.limits?.minUniformBufferOffsetAlignment ?? 256,
      'minUniformBufferOffsetAlignment'
    )
  );
  const paramsSlotByteLength = alignTo(SOURCE_LOCAL_LANE_PARAMS_BYTES, paramsAlignment);
  const ownedBuffers = [];
  const createOwnedBuffer = (descriptor) => {
    const buffer = tagWebGpuBufferDevice(device.createBuffer(descriptor), device);
    ownedBuffers.push(buffer);
    return buffer;
  };
  const surfaceBuffer = createOwnedBuffer({
    label: `${label}-surfaces`,
    size: surfaceBufferByteLength,
    usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_SRC | GPU_BUFFER_USAGE.COPY_DST
  });
  const densityAccumBuffer = createOwnedBuffer({
    label: `${label}-density-atomic`,
    size: atomicBufferByteLength,
    usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_SRC | GPU_BUFFER_USAGE.COPY_DST
  });
  const sourceIndexFieldBuffer = createOwnedBuffer({
    label: `${label}-source-index-atomic`,
    size: atomicBufferByteLength,
    usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_SRC | GPU_BUFFER_USAGE.COPY_DST
  });
  const fieldRowsBuffer = createOwnedBuffer({
    label: `${label}-field-cells`,
    size: fieldRowsBufferByteLength,
    usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_SRC | GPU_BUFFER_USAGE.COPY_DST
  });
  const paramsBuffer = createOwnedBuffer({
    label: `${label}-params-arena`,
    size: paramsSlotByteLength * slots,
    usage: GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST
  });
  const emptyProductEventBuffer = createOwnedBuffer({
    label: `${label}-empty-product-events`,
    size: SPH_GPU_REACTION_PRODUCT_EVENT_FLOATS * Float32Array.BYTES_PER_ELEMENT,
    usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_DST
  });
  if (surfaceTable.records.byteLength > 0) {
    device.queue.writeBuffer(surfaceBuffer, 0, surfaceTable.records);
  }

  const residentSplatBindings = [
    computeBufferBinding(0, 'read-only-storage'),
    computeBufferBinding(1, 'read-only-storage'),
    computeBufferBinding(2, 'read-only-storage'),
    computeBufferBinding(3, 'storage'),
    computeBufferBinding(4, 'uniform'),
    computeBufferBinding(5, 'read-only-storage'),
    computeBufferBinding(6, 'storage'),
    computeBufferBinding(7, 'read-only-storage')
  ];
  const particleSplatPipelineState = createCachedExplicitComputePipeline(device, {
    cacheKey: 'ulg-sph-material-interface-source-local-resident-particle-splat-v1',
    label: `${label}-particle-splat`,
    code: sphMaterialInterfaceSourceLocalResidentSplatWgsl,
    entryPoint: 'splat_particles',
    bindings: residentSplatBindings
  });
  const exactProductSplatPipelineState = createCachedExplicitComputePipeline(device, {
    cacheKey: 'ulg-sph-material-interface-source-local-resident-product-splat-exact-v1',
    label: `${label}-product-splat-exact`,
    code: sphMaterialInterfaceSourceLocalResidentSplatWgsl,
    entryPoint: 'splat_product_events_exact',
    bindings: residentSplatBindings
  });
  const boundedProductSplatPipelineState = createCachedExplicitComputePipeline(device, {
    cacheKey: 'ulg-sph-material-interface-source-local-resident-product-splat-bounded-v1',
    label: `${label}-product-splat-bounded`,
    code: sphMaterialInterfaceSourceLocalResidentSplatWgsl,
    entryPoint: 'splat_product_events_bounded',
    bindings: residentSplatBindings
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
  const resolveBindGroups = Array.from({ length: slots }, (_, slotIndex) => (
    device.createBindGroup({
      label: `${label}-resolve-group-${slotIndex}`,
      layout: resolvePipelineState.bindGroupLayout,
      entries: [
        { binding: 0, resource: { buffer: surfaceBuffer } },
        { binding: 1, resource: { buffer: densityAccumBuffer } },
        { binding: 2, resource: { buffer: fieldRowsBuffer } },
        {
          binding: 3,
          resource: {
            buffer: paramsBuffer,
            offset: slotIndex * paramsSlotByteLength,
            size: SOURCE_LOCAL_LANE_PARAMS_BYTES
          }
        }
      ]
    })
  ));
  const splatBindGroupCache = [];
  const unsubmittedGenerations = [];
  let nextParamsSlot = 0;
  let nextGeneration = firstGeneration;
  let maxBorrowedProductEventCount = products;
  let submissionCount = 0;
  let encodeCount = 0;
  let destroyed = false;

  function capacityAdmission({
    device: requestedDevice = device,
    surfaceTable: requestedSurfaceTable = surfaceTable,
    particleCount = particles,
    productEventCount = products
  } = {}) {
    const requiredParticleCapacity = Math.max(0, Math.round(Number(particleCount) || 0));
    const requiredProductEventCapacity = Math.max(0, Math.round(Number(productEventCount) || 0));
    let candidateTopologyKey = null;
    try {
      candidateTopologyKey = sourceFieldSurfaceTopologyKey(requestedSurfaceTable);
    } catch {
      candidateTopologyKey = null;
    }
    const reasons = [
      requestedDevice !== device ? 'device-mismatch' : null,
      candidateTopologyKey !== topologyKey ? 'surface-topology-mismatch' : null,
      requiredParticleCapacity > particles ? 'particle-capacity-exceeded' : null
    ].filter(Boolean);
    return {
      schema: 'peercompute.ulg.sph-material-interface-source-local-gpu-lane-admission.v0',
      status: reasons.length === 0
        ? 'material-interface-source-field-lane-capacity-admitted'
        : 'material-interface-source-field-lane-replacement-required',
      admitted: reasons.length === 0,
      replacementRequired: reasons.length > 0,
      reasons,
      topologyKey,
      candidateTopologyKey,
      particleCapacity: particles,
      requiredParticleCapacity,
      productEventCapacity: maxBorrowedProductEventCount,
      requiredProductEventCapacity,
      productEventCapacityOwnedByLane: false,
      productEventCapacityAdmission: 'borrowed-buffer-validated-at-encode',
      growOnly: true
    };
  }

  function splatBindGroupFor({
    particleStateBuffer,
    particleThermoBuffer,
    productEventBuffer,
    productEventMetadataBuffer,
    paramsSlot,
    pipelineKind,
    pipelineState
  }) {
    const cached = splatBindGroupCache.find((entry) => (
      entry.particleStateBuffer === particleStateBuffer
      && entry.particleThermoBuffer === particleThermoBuffer
      && entry.productEventBuffer === productEventBuffer
      && entry.productEventMetadataBuffer === productEventMetadataBuffer
      && entry.paramsSlot === paramsSlot
      && entry.pipelineKind === pipelineKind
    ));
    if (cached) return cached.bindGroup;
    const bindGroup = device.createBindGroup({
      label: `${label}-${pipelineKind}-group-${paramsSlot}`,
      layout: pipelineState.bindGroupLayout,
      entries: [
        { binding: 0, resource: { buffer: particleStateBuffer } },
        { binding: 1, resource: { buffer: particleThermoBuffer } },
        { binding: 2, resource: { buffer: surfaceBuffer } },
        { binding: 3, resource: { buffer: densityAccumBuffer } },
        {
          binding: 4,
          resource: {
            buffer: paramsBuffer,
            offset: paramsSlot * paramsSlotByteLength,
            size: SOURCE_LOCAL_LANE_PARAMS_BYTES
          }
        },
        { binding: 5, resource: { buffer: productEventBuffer } },
        { binding: 6, resource: { buffer: sourceIndexFieldBuffer } },
        { binding: 7, resource: { buffer: productEventMetadataBuffer } }
      ]
    });
    splatBindGroupCache.push({
      particleStateBuffer,
      particleThermoBuffer,
      productEventBuffer,
      productEventMetadataBuffer,
      paramsSlot,
      pipelineKind,
      bindGroup
    });
    return bindGroup;
  }

  function encodeGeneration(commandEncoder, {
    particleStateBuffer,
    particleThermoBuffer,
    productEventBuffer = null,
    productEventMetadataBuffer = null,
    productEventDispatchIndirectBuffer = null,
    particleCount = particles,
    productEventCount = 0,
    sourceStep,
    sourceTime = null,
    sourceSlot = 0,
    substepIndex = 0,
    sourceFieldGeneration = null,
    residentNeighborhoodIdentity,
    laneExecutionIdentity = null,
    productEventGeneration = null,
    productEventCountAuthority = 'host-declared-exact-count',
    renderDomainBaseCount: generationBaseDomainCount = baseDomainCount,
    renderDomainDropCount: generationDropDomainCount = dropDomainCount,
    timestampProfiler = null,
    timestampMetadata = {}
  } = {}) {
    if (destroyed) throw new Error(`${label} is destroyed`);
    if (!commandEncoder?.beginComputePass || !commandEncoder?.clearBuffer) {
      throw new TypeError('source-field lane generation requires a caller-owned command encoder');
    }
    const count = nonNegativeInteger(particleCount, 'particleCount');
    const eventCount = nonNegativeInteger(productEventCount, 'productEventCount');
    const exactProductPrefixDispatch = eventCount > 0
      && productEventMetadataBuffer != null
      && productEventDispatchIndirectBuffer != null;
    if (
      eventCount > 0
      && Boolean(productEventMetadataBuffer) !== Boolean(productEventDispatchIndirectBuffer)
    ) {
      throw new TypeError(
        'exact product-event source-field dispatch requires both metadata and indirect buffers'
      );
    }
    const admission = capacityAdmission({ particleCount: count, productEventCount: eventCount });
    if (!admission.admitted) {
      const error = new RangeError(`source-field lane replacement required: ${admission.reasons.join(', ')}`);
      error.code = 'ULG_MATERIAL_INTERFACE_SOURCE_FIELD_LANE_REPLACEMENT_REQUIRED';
      error.admission = admission;
      throw error;
    }
    if (nextParamsSlot >= slots) {
      const error = new Error(
        `source-field lane params arena exhausted after ${slots} unsubmitted generations`
      );
      error.code = 'ULG_MATERIAL_INTERFACE_SOURCE_FIELD_LANE_PARAMS_EXHAUSTED';
      throw error;
    }
    const stateBuffer = assertLaneBuffer(
      device,
      particleStateBuffer,
      count * SPH_GPU_PARTICLE_STATE_FLOATS * Float32Array.BYTES_PER_ELEMENT,
      'particleStateBuffer'
    );
    const thermoBuffer = assertLaneBuffer(
      device,
      particleThermoBuffer,
      count * SPH_GPU_PARTICLE_THERMO_FLOATS * Float32Array.BYTES_PER_ELEMENT,
      'particleThermoBuffer'
    );
    const eventsBuffer = eventCount > 0
      ? assertLaneBuffer(
          device,
          productEventBuffer,
          eventCount * SPH_GPU_REACTION_PRODUCT_EVENT_FLOATS * Float32Array.BYTES_PER_ELEMENT,
          'productEventBuffer'
        )
      : emptyProductEventBuffer;
    const eventMetadataBuffer = exactProductPrefixDispatch
      ? assertLaneBuffer(
          device,
          productEventMetadataBuffer,
          16 * Uint32Array.BYTES_PER_ELEMENT,
          'productEventMetadataBuffer'
        )
      : emptyProductEventBuffer;
    const eventDispatchIndirectBuffer = exactProductPrefixDispatch
      ? assertLaneBuffer(
          device,
          productEventDispatchIndirectBuffer,
          3 * Uint32Array.BYTES_PER_ELEMENT,
          'productEventDispatchIndirectBuffer'
        )
      : null;
    maxBorrowedProductEventCount = Math.max(maxBorrowedProductEventCount, eventCount);
    const identity = residentNeighborhoodGenerationIdentity(
      residentNeighborhoodIdentity,
      laneExecutionIdentity
    );
    if (identity.deviceId && identity.deviceId !== webGpuDeviceId(device)) {
      throw new Error('resident neighborhood generation belongs to a different GPUDevice');
    }
    if (identity.sourceCount != null && Number(identity.sourceCount) !== count) {
      throw new RangeError('resident neighborhood sourceCount does not match particleCount');
    }
    const step = nonNegativeInteger(sourceStep, 'sourceStep');
    const slot = nonNegativeInteger(sourceSlot, 'sourceSlot');
    const sequenceIndex = nonNegativeInteger(substepIndex, 'substepIndex');
    const generation = sourceFieldGeneration == null
      ? nextGeneration
      : nonNegativeInteger(sourceFieldGeneration, 'sourceFieldGeneration');
    if (generation < nextGeneration) {
      throw new RangeError('sourceFieldGeneration must be monotonic for the lane');
    }
    nextGeneration = generation + 1;
    const domainBaseCount = nonNegativeInteger(
      generationBaseDomainCount,
      'renderDomainBaseCount'
    );
    const domainDropCount = nonNegativeInteger(
      generationDropDomainCount,
      'renderDomainDropCount'
    );
    const paramsSlot = nextParamsSlot;
    nextParamsSlot += 1;
    const paramsOffset = paramsSlot * paramsSlotByteLength;
    const sourceCount = count + eventCount;
    device.queue.writeBuffer(paramsBuffer, paramsOffset, createSourceFieldLaneParamsArray({
      particleCount: count,
      productEventCount: eventCount,
      surfaceCount: surfaceTable.surfaceCount,
      totalFieldCells: surfaceTable.totalFieldCells,
      fieldPadding: padding,
      refEdgeM: edge,
      densityScale: SOURCE_LOCAL_DENSITY_SCALE,
      sourceCount,
      renderDomainBaseCount: domainBaseCount,
      renderDomainDropCount: domainDropCount
    }));
    commandEncoder.clearBuffer(densityAccumBuffer, 0, atomicBufferByteLength);
    commandEncoder.clearBuffer(sourceIndexFieldBuffer, 0, atomicBufferByteLength);
    const generationMetadata = {
      ...timestampMetadata,
      sourceFieldGeneration: generation,
      sourceStep: step,
      sourcePositionEpoch: identity.positionEpoch,
      sourceNeighborhoodGeneration: identity.generation,
      substepIndex: sequenceIndex
    };
    const particleSplatPass = commandEncoder.beginComputePass(
      timestampProfiler?.beginComputePassDescriptor
        ? timestampProfiler.beginComputePassDescriptor(
            `${label}ParticleSplat`,
            { ...generationMetadata, sourceFieldStage: 'source-local-particle-splat' }
          )
        : { label: `${label}-particle-splat-generation-${generation}` }
    );
    particleSplatPass.setPipeline(particleSplatPipelineState.pipeline);
    particleSplatPass.setBindGroup(0, splatBindGroupFor({
      particleStateBuffer: stateBuffer,
      particleThermoBuffer: thermoBuffer,
      productEventBuffer: eventsBuffer,
      productEventMetadataBuffer: eventMetadataBuffer,
      paramsSlot,
      pipelineKind: 'particle-splat',
      pipelineState: particleSplatPipelineState
    }));
    particleSplatPass.dispatchWorkgroups(
      Math.max(1, Math.ceil(Math.max(1, count) / 64)),
      Math.max(1, surfaceTable.surfaceCount)
    );
    particleSplatPass.end();
    if (eventCount > 0) {
      const productPipelineState = exactProductPrefixDispatch
        ? exactProductSplatPipelineState
        : boundedProductSplatPipelineState;
      const productPipelineKind = exactProductPrefixDispatch
        ? 'product-splat-exact'
        : 'product-splat-bounded';
      const productSplatPass = commandEncoder.beginComputePass(
        timestampProfiler?.beginComputePassDescriptor
          ? timestampProfiler.beginComputePassDescriptor(
              `${label}ProductSplat`,
              {
                ...generationMetadata,
                sourceFieldStage: exactProductPrefixDispatch
                  ? 'source-local-product-splat-exact-prefix'
                  : 'source-local-product-splat-bounded'
              }
            )
          : { label: `${label}-${productPipelineKind}-generation-${generation}` }
      );
      productSplatPass.setPipeline(productPipelineState.pipeline);
      productSplatPass.setBindGroup(0, splatBindGroupFor({
        particleStateBuffer: stateBuffer,
        particleThermoBuffer: thermoBuffer,
        productEventBuffer: eventsBuffer,
        productEventMetadataBuffer: eventMetadataBuffer,
        paramsSlot,
        pipelineKind: productPipelineKind,
        pipelineState: productPipelineState
      }));
      if (exactProductPrefixDispatch) {
        if (typeof productSplatPass.dispatchWorkgroupsIndirect !== 'function') {
          throw new TypeError(
            'exact product-event source-field dispatch requires dispatchWorkgroupsIndirect'
          );
        }
        productSplatPass.dispatchWorkgroupsIndirect(eventDispatchIndirectBuffer, 0);
      } else {
        productSplatPass.dispatchWorkgroups(Math.max(1, Math.ceil(eventCount / 64)));
      }
      productSplatPass.end();
    }
    const resolvePass = commandEncoder.beginComputePass(
      timestampProfiler?.beginComputePassDescriptor
        ? timestampProfiler.beginComputePassDescriptor(
            `${label}Resolve`,
            { ...generationMetadata, sourceFieldStage: 'source-local-resolve' }
          )
        : { label: `${label}-resolve-generation-${generation}` }
    );
    resolvePass.setPipeline(resolvePipelineState.pipeline);
    resolvePass.setBindGroup(0, resolveBindGroups[paramsSlot]);
    resolvePass.dispatchWorkgroups(
      Math.max(1, Math.ceil(Math.max(1, surfaceTable.maxFieldCellCount) / 64)),
      Math.max(1, surfaceTable.surfaceCount)
    );
    resolvePass.end();

    const generationToken = {
      schema: SPH_MATERIAL_INTERFACE_SOURCE_LOCAL_GPU_GENERATION_SCHEMA,
      status: 'material-interface-source-field-lane-generation-encoded',
      sourceFieldGeneration: generation,
      sourceStep: step,
      sourceTime: Number.isFinite(Number(sourceTime)) ? Number(sourceTime) : null,
      sourceSlot: slot,
      substepIndex: sequenceIndex,
      sourcePositionEpoch: identity.positionEpoch,
      sourceNeighborhoodGeneration: identity.generation,
      sourceNeighborhoodLaneId: identity.laneId,
      sourceNeighborhoodStateKey: identity.stateKey,
      sourceNeighborhoodLeaseId: identity.leaseId,
      sourceNeighborhoodTaskId: identity.taskId,
      sourceNeighborhoodSourceFamily: identity.sourceFamily,
      sourceNeighborhoodAuthoritative: identity.authoritative,
      sourceDeviceId: webGpuDeviceId(device),
      surfaceTopologyKey: topologyKey,
      particleCount: count,
      productEventCount: eventCount,
      productEventGeneration: productEventGeneration == null
        ? null
        : nonNegativeInteger(productEventGeneration, 'productEventGeneration'),
      productEventCountAuthority: String(productEventCountAuthority),
      productEventDispatchMode: eventCount === 0
        ? 'product-event-dispatch-skipped-empty-upper-bound'
        : exactProductPrefixDispatch
        ? 'gpu-authored-exact-active-prefix-indirect'
        : 'legacy-host-bounded-direct',
      productEventExactPrefixDispatch: exactProductPrefixDispatch,
      productEventMetadataValidation: exactProductPrefixDispatch
        ? 'shader-fail-closed-arena-metadata-v1'
        : null,
      productEventSurfaceTraversal: 'event-row-parallel-surface-loop',
      paramsSlot,
      commandEncoderOwnership: 'caller',
      submissionOwnership: 'caller',
      queueSubmitPerformed: false,
      mapPerformed: false,
      readbackPerformed: false,
      queueFenceAwaited: false,
      ephemeralScratch: true,
      lifetime: 'same-encoder-until-next-source-field-generation'
    };
    unsubmittedGenerations.push(generationToken);
    encodeCount += 1;
    const visitEstimate = estimateSourceLocalFieldVisits(surfaceTable, sourceCount);
    const sourceRenderField = {
      schema: ULG_SPH_GPU_RENDER_FIELD_SCHEMA,
      backend: 'webgpu-source-local-resident-lane',
      status: 'render-field-built-in-caller-encoder',
      kernelScope: SOURCE_LOCAL_KERNEL_SCOPE,
      sourceLocalSourceField: true,
      particleCount: count,
      productEventCount: eventCount,
      productEventBufferBound: eventCount > 0,
      productEventDispatchMode: generationToken.productEventDispatchMode,
      productEventExactPrefixDispatch: exactProductPrefixDispatch,
      productEventMetadataValidation: generationToken.productEventMetadataValidation,
      productEventSurfaceTraversal: generationToken.productEventSurfaceTraversal,
      surfaceCount: surfaceTable.surfaceCount,
      totalFieldCells: surfaceTable.totalFieldCells,
      maxFieldCellCount: surfaceTable.maxFieldCellCount,
      surfaceTable,
      rowLayout: [...SPH_GPU_RENDER_FIELD_CELL_ROW_LAYOUT],
      rowStrideFloats: SPH_GPU_RENDER_FIELD_CELL_FLOATS,
      fieldRows: new Float32Array(),
      fieldRowByteLength,
      fieldPadding: padding,
      refEdgeM: edge,
      renderFieldInputSource: 'resident-particle-state-thermo-direct',
      readbackMode: NO_FULL_READBACK_MODE,
      queueCompletionStatus: 'caller-encoder-not-submitted',
      queueCompletionMethod: 'caller-owned-command-encoder',
      renderFieldReadback: false,
      fullReadbackPerformed: false,
      normalHotLoopReadbackFree: true,
      fieldRowsBuffer,
      fieldRowsBufferRetained: true,
      fieldRowsBufferByteLength,
      fieldRowsBufferPayloadByteLength: fieldRowByteLength,
      fieldRowsBufferBorrowed: true,
      fieldRowsBufferReused: encodeCount > 1,
      fieldRowsBufferOwnedByResult: false,
      surfaceBuffer,
      surfaceBufferRetained: true,
      surfaceBufferByteLength,
      surfaceBufferPayloadByteLength,
      sourceIndexFieldSchema: 'peercompute.ulg.sph-material-interface-source-index-field.v0',
      sourceIndexFieldStatus: 'resident-lane-ephemeral-source-index-field',
      sourceIndexFieldBuffer,
      sourceIndexFieldBufferRetained: true,
      sourceIndexFieldBufferByteLength: atomicBufferByteLength,
      sourceIndexFieldBufferPayloadByteLength: atomicByteLength,
      sourceIndexFieldStrideUints: 1,
      sourceLocalDensityScale: SOURCE_LOCAL_DENSITY_SCALE,
      sourceLocalSourceCount: sourceCount,
      sourceLocalParticleDispatchWorkgroups: {
        x: Math.max(1, Math.ceil(Math.max(1, count) / 64)),
        y: Math.max(1, surfaceTable.surfaceCount),
        z: 1
      },
      sourceLocalProductEventDispatchWorkgroupsUpperBound:
        eventCount > 0 ? Math.max(1, Math.ceil(eventCount / 64)) : 0,
      sourceLocalEstimatedCellVisits: visitEstimate.estimatedCellVisits,
      sourceLocalDenseCellParticlePairs: visitEstimate.denseCellParticlePairs,
      sourceLocalEstimatedVisitRatio: visitEstimate.estimatedVisitRatio,
      generationToken,
      ephemeralScratch: true
    };
    return {
      schema: ULG_SPH_MATERIAL_INTERFACE_SOURCE_FIELD_SCHEMA,
      backend: 'webgpu-source-local-resident-lane',
      status: 'material-interface-source-field-lane-generation-encoded',
      source: 'compute-manager-gpu-resident-lane',
      sourceCadence: 'current-position-epoch-per-substep',
      sourceRenderField,
      sourceRenderFieldSchema: sourceRenderField.schema,
      sourceRenderFieldBackend: sourceRenderField.backend,
      sourceRenderFieldStatus: sourceRenderField.status,
      kernelScope: SOURCE_LOCAL_KERNEL_SCOPE,
      sourceLocalSourceField: true,
      sourceFieldGeneration: generation,
      generationToken,
      sourceStep: step,
      sourceTime: generationToken.sourceTime,
      sourcePositionEpoch: identity.positionEpoch,
      sourceNeighborhoodGeneration: identity.generation,
      sourceNeighborhoodLaneId: identity.laneId,
      sourceNeighborhoodStateKey: identity.stateKey,
      sourceDeviceId: generationToken.sourceDeviceId,
      particleCount: count,
      productEventCount: eventCount,
      productEventDispatchMode: generationToken.productEventDispatchMode,
      productEventExactPrefixDispatch: exactProductPrefixDispatch,
      productEventMetadataValidation: generationToken.productEventMetadataValidation,
      productEventSurfaceTraversal: generationToken.productEventSurfaceTraversal,
      surfaceCount: surfaceTable.surfaceCount,
      totalFieldCells: surfaceTable.totalFieldCells,
      maxFieldCellCount: surfaceTable.maxFieldCellCount,
      surfaceTable,
      rowLayout: sourceRenderField.rowLayout,
      rowStrideFloats: sourceRenderField.rowStrideFloats,
      fieldRows: sourceRenderField.fieldRows,
      fieldRowByteLength,
      fieldPadding: padding,
      refEdgeM: edge,
      fieldRowsBuffer,
      surfaceBuffer,
      sourceIndexFieldBuffer,
      fieldRowsBufferRetained: true,
      fieldRowsBufferByteLength,
      fieldRowsBufferPayloadByteLength: fieldRowByteLength,
      fieldRowsBufferBorrowed: true,
      fieldRowsBufferReused: encodeCount > 1,
      fieldRowsBufferOwnedByResult: false,
      surfaceBufferRetained: true,
      surfaceBufferByteLength,
      surfaceBufferPayloadByteLength,
      sourceIndexFieldBufferRetained: true,
      sourceIndexFieldBufferByteLength: atomicBufferByteLength,
      sourceIndexFieldBufferPayloadByteLength: atomicByteLength,
      sourceIndexFieldStrideUints: 1,
      readbackMode: NO_FULL_READBACK_MODE,
      queueCompletionStatus: 'caller-encoder-not-submitted',
      queueCompletionMethod: 'caller-owned-command-encoder',
      normalHotLoopReadbackFree: true,
      commandEncoderOwnership: 'caller',
      submissionOwnership: 'caller',
      queueSubmitPerformed: false,
      mapPerformed: false,
      readbackPerformed: false,
      queueFenceAwaited: false,
      ephemeralScratch: true,
      scientificValidation: false,
      sphValidation: false,
      forceCouplingValidation: false,
      fullPhysicsValidation: false
    };
  }

  function markSubmitted({
    submissionSerial = submissionCount + 1,
    queueCompletionStatus = 'queue-submitted',
    queueCompletionMethod = 'caller-queue-submit'
  } = {}) {
    const submitted = unsubmittedGenerations.splice(0);
    for (const token of submitted) {
      token.status = 'material-interface-source-field-lane-generation-submitted';
      token.queueSubmitPerformed = true;
      token.submissionSerial = submissionSerial;
      token.queueCompletionStatus = queueCompletionStatus;
      token.queueCompletionMethod = queueCompletionMethod;
    }
    if (submitted.length > 0) submissionCount += 1;
    nextParamsSlot = 0;
    return {
      schema: SPH_MATERIAL_INTERFACE_SOURCE_LOCAL_GPU_LANE_SCHEMA,
      status: submitted.length > 0
        ? 'material-interface-source-field-lane-generations-submitted'
        : 'material-interface-source-field-lane-submit-mark-skipped',
      submissionSerial,
      generationCount: submitted.length,
      sourceFieldGenerations: submitted.map((token) => token.sourceFieldGeneration),
      queueInteractionPerformed: false
    };
  }

  function cancelBeforeSubmit(reason = 'caller-encoder-aborted') {
    const cancelled = unsubmittedGenerations.splice(0);
    for (const token of cancelled) {
      token.status = 'material-interface-source-field-lane-generation-cancelled-before-submit';
      token.cancelReason = reason;
    }
    nextParamsSlot = 0;
    return {
      schema: SPH_MATERIAL_INTERFACE_SOURCE_LOCAL_GPU_LANE_SCHEMA,
      status: 'material-interface-source-field-lane-generations-cancelled-before-submit',
      generationCount: cancelled.length,
      sourceFieldGenerations: cancelled.map((token) => token.sourceFieldGeneration),
      reason,
      queueInteractionPerformed: false
    };
  }

  function destroy({ allowUnsubmitted = false } = {}) {
    if (destroyed) return false;
    if (unsubmittedGenerations.length > 0 && !allowUnsubmitted) {
      const error = new Error('source-field lane has unsubmitted encoded generations');
      error.code = 'ULG_MATERIAL_INTERFACE_SOURCE_FIELD_LANE_UNSUBMITTED_GENERATIONS';
      throw error;
    }
    if (allowUnsubmitted) cancelBeforeSubmit('lane-destroyed-before-submit');
    destroyed = true;
    for (const buffer of ownedBuffers) buffer.destroy?.();
    splatBindGroupCache.length = 0;
    return true;
  }

  return {
    schema: SPH_MATERIAL_INTERFACE_SOURCE_LOCAL_GPU_LANE_SCHEMA,
    status: 'material-interface-source-field-resident-gpu-lane-ready',
    device,
    deviceId: webGpuDeviceId(device),
    topologyKey,
    surfaceTable,
    particleCapacity: particles,
    get productEventCapacity() {
      return maxBorrowedProductEventCount;
    },
    productEventCapacityOwnedByLane: false,
    productEventCapacityAdmission: 'borrowed-buffer-validated-at-encode',
    fieldPadding: padding,
    refEdgeM: edge,
    renderDomainBaseCount: baseDomainCount,
    renderDomainDropCount: dropDomainCount,
    paramsSlotCount: slots,
    paramsSlotByteLength,
    fieldRowsBuffer,
    surfaceBuffer,
    sourceIndexFieldBuffer,
    densityAccumBuffer,
    paramsBuffer,
    fieldRowByteLength,
    fieldRowsBufferByteLength,
    surfaceBufferByteLength,
    surfaceBufferPayloadByteLength,
    sourceIndexFieldByteLength: atomicBufferByteLength,
    sourceIndexFieldPayloadByteLength: atomicByteLength,
    retainedByteLength: ownedBuffers.reduce(
      (sum, buffer) => sum + Math.max(0, Number(buffer.size) || 0),
      0
    ),
    allocationPolicy:
      'grow-only-replace-on-device-topology-particle-or-params-capacity-change',
    scratchLifetime: 'lane-owned-ephemeral-per-generation',
    commandEncoderOwnership: 'caller',
    submissionOwnership: 'caller',
    mapPerformed: false,
    readbackPerformed: false,
    queueFenceAwaited: false,
    capacityAdmission,
    encodeGeneration,
    markSubmitted,
    cancelBeforeSubmit,
    destroy,
    allocationEntries() {
      return ownedBuffers.map((buffer) => ({
        buffer,
        owned: true,
        lifetime: 'persistent-workspace'
      }));
    },
    getState() {
      return {
        schema: SPH_MATERIAL_INTERFACE_SOURCE_LOCAL_GPU_LANE_SCHEMA,
        status: destroyed
          ? 'material-interface-source-field-resident-gpu-lane-destroyed'
          : 'material-interface-source-field-resident-gpu-lane-ready',
        destroyed,
        encodeCount,
        submissionCount,
        unsubmittedGenerationCount: unsubmittedGenerations.length,
        nextParamsSlot,
        nextGeneration,
        maxBorrowedProductEventCount,
        splatBindGroupCacheSize: splatBindGroupCache.length
      };
    }
  };
}

function normalizeSourceLocalLanePoolMaxEntries(value) {
  const requested = Number(value ?? SOURCE_LOCAL_LANE_POOL_MAX_ENTRIES_DEFAULT);
  if (!Number.isFinite(requested)) {
    throw new RangeError('poolMaxEntries must be finite');
  }
  return Math.min(
    SOURCE_LOCAL_LANE_POOL_MAX_ENTRIES_MAX,
    Math.max(SOURCE_LOCAL_LANE_POOL_MAX_ENTRIES_MIN, Math.round(requested))
  );
}

function sourceLocalLanePoolIdentity(value, fallback, name) {
  const resolved = nonEmptyStringOrNull(value ?? fallback);
  if (!resolved) throw new TypeError(`${name} must be a non-empty string`);
  return resolved;
}

function normalizeSourceLocalLanePoolOptions(options = {}) {
  const padding = Number(options.fieldPadding ?? 0.22);
  const edge = Number(options.refEdgeM ?? 10);
  if (!Number.isFinite(padding) || padding < 0 || padding >= 0.5) {
    throw new RangeError('fieldPadding must be finite in [0, 0.5)');
  }
  if (!Number.isFinite(edge) || edge <= 0) {
    throw new RangeError('refEdgeM must be positive');
  }
  assertRenderFieldSurfaceTable(options.surfaceTable);
  const laneId = sourceLocalLanePoolIdentity(
    options.laneId,
    'compute-manager-resident-mechanics-lane',
    'laneId'
  );
  const stateKey = sourceLocalLanePoolIdentity(
    options.stateKey,
    'sph-particle-hot-state',
    'stateKey'
  );
  const sourceFamily = sourceLocalLanePoolIdentity(
    options.sourceFamily,
    'sph-particle-state',
    'sourceFamily'
  );
  const normalized = {
    surfaceTable: options.surfaceTable,
    topologyKey: sourceFieldSurfaceTopologyKey(options.surfaceTable),
    particleCapacity: positiveInteger(options.particleCapacity, 'particleCapacity'),
    productEventCapacity: nonNegativeInteger(
      options.productEventCapacity ?? 0,
      'productEventCapacity'
    ),
    fieldPadding: padding,
    refEdgeM: edge,
    renderDomainBaseCount: nonNegativeInteger(
      options.renderDomainBaseCount ?? 0,
      'renderDomainBaseCount'
    ),
    renderDomainDropCount: nonNegativeInteger(
      options.renderDomainDropCount ?? 0,
      'renderDomainDropCount'
    ),
    paramsSlotCount: positiveInteger(
      options.paramsSlotCount ?? SOURCE_LOCAL_LANE_PARAMS_SLOT_COUNT_DEFAULT,
      'paramsSlotCount'
    ),
    generationBase: nonNegativeInteger(options.generationBase ?? 1, 'generationBase'),
    laneId,
    stateKey,
    sourceFamily,
    poolMaxEntries: normalizeSourceLocalLanePoolMaxEntries(options.poolMaxEntries),
    label: nonEmptyStringOrNull(options.label),
    requestedLeaseId: nonEmptyStringOrNull(options.leaseId)
  };
  normalized.structuralKey = JSON.stringify({
    topologyKey: normalized.topologyKey,
    laneId,
    stateKey,
    sourceFamily,
    renderDomainBaseCount: normalized.renderDomainBaseCount,
    renderDomainDropCount: normalized.renderDomainDropCount,
    fieldPadding: normalized.fieldPadding,
    refEdgeM: normalized.refEdgeM
  });
  return normalized;
}

function createSourceLocalLanePool(device, maxEntries) {
  return {
    schema: SPH_MATERIAL_INTERFACE_SOURCE_LOCAL_GPU_LANE_POOL_SCHEMA,
    device,
    deviceId: webGpuDeviceId(device),
    maxEntries,
    entries: new Map(),
    nextLaneOrdinal: 1,
    nextAcquisitionOrdinal: 1,
    nextUseOrdinal: 1,
    createCount: 0,
    reuseCount: 0,
    growCount: 0,
    evictionCount: 0,
    retirementScheduledCount: 0,
    retirementCompletedCount: 0,
    pendingRetirementCount: 0
  };
}

function retireSourceLocalLanePoolEntry(pool, entry, reason, { force = false } = {}) {
  if (entry.retired) return 'already-retired';
  const state = entry.lane.getState();
  if (state.unsubmittedGenerationCount > 0) {
    if (!force) {
      const error = new Error('cannot retire a source-field lane with unsubmitted generations');
      error.code = 'ULG_MATERIAL_INTERFACE_SOURCE_FIELD_LANE_POOL_UNSUBMITTED_RETIREMENT';
      throw error;
    }
    entry.lane.cancelBeforeSubmit(`${reason}-cancel-unsubmitted`);
  }
  entry.retired = true;
  entry.acquired = false;
  entry.activeAcquisitionId = null;
  entry.retirementReason = reason;
  const destroyLane = () => {
    entry.lane.destroy({ allowUnsubmitted: true });
    entry.retirementStatus = 'retirement-completed';
    pool.pendingRetirementCount = Math.max(0, pool.pendingRetirementCount - 1);
    pool.retirementCompletedCount += 1;
  };
  if (state.submissionCount > 0 && pool.device?.queue?.onSubmittedWorkDone) {
    entry.retirementStatus = 'retirement-deferred-until-device-queue-fence';
    pool.pendingRetirementCount += 1;
    pool.retirementScheduledCount += 1;
    deferSubmittedWorkCleanup(pool.device, destroyLane);
    return 'retirement-deferred-until-device-queue-fence';
  }
  pool.retirementScheduledCount += 1;
  destroyLane();
  return 'retirement-completed';
}

function leastRecentlyUsedIdleSourceLocalLaneEntry(pool, excludedKey = null) {
  let candidate = null;
  for (const entry of pool.entries.values()) {
    if (entry.structuralKey === excludedKey || entry.acquired || entry.retired) continue;
    if (entry.lane.getState().unsubmittedGenerationCount > 0) continue;
    if (!candidate || entry.lastUseOrdinal < candidate.lastUseOrdinal) candidate = entry;
  }
  return candidate;
}

function evictSourceLocalLanePoolEntry(pool, entry, reason) {
  pool.entries.delete(entry.structuralKey);
  pool.evictionCount += 1;
  return retireSourceLocalLanePoolEntry(pool, entry, reason);
}

function createSourceLocalLanePoolEntry(pool, normalized, {
  particleCapacity = normalized.particleCapacity,
  productEventCapacity = normalized.productEventCapacity,
  paramsSlotCount = normalized.paramsSlotCount,
  generationBase = normalized.generationBase
} = {}) {
  const laneOrdinal = pool.nextLaneOrdinal;
  pool.nextLaneOrdinal += 1;
  const lane = createSphMaterialInterfaceSourceFieldLocalGpuLane(pool.device, {
    surfaceTable: normalized.surfaceTable,
    particleCapacity,
    productEventCapacity,
    fieldPadding: normalized.fieldPadding,
    refEdgeM: normalized.refEdgeM,
    renderDomainBaseCount: normalized.renderDomainBaseCount,
    renderDomainDropCount: normalized.renderDomainDropCount,
    paramsSlotCount,
    generationBase,
    label: normalized.label
      ? `${normalized.label}-${laneOrdinal}`
      : `ulg-sph-material-interface-source-local-pool-lane-${laneOrdinal}`
  });
  const entry = {
    structuralKey: normalized.structuralKey,
    topologyKey: normalized.topologyKey,
    laneId: normalized.laneId,
    stateKey: normalized.stateKey,
    sourceFamily: normalized.sourceFamily,
    lane,
    acquired: false,
    activeAcquisitionId: null,
    acquisitionCount: 0,
    lastUseOrdinal: pool.nextUseOrdinal,
    retired: false,
    retirementStatus: null,
    retirementReason: null
  };
  pool.nextUseOrdinal += 1;
  pool.entries.set(normalized.structuralKey, entry);
  pool.createCount += 1;
  return entry;
}

/**
 * Acquires bounded per-device scratch for the direct state/thermo source-field
 * lane. Release is allowed immediately after the caller records queue submit;
 * WebGPU queue ordering protects the next reuse without a CPU fence.
 */
export function acquireSphMaterialInterfaceSourceFieldLocalGpuLane(device, options = {}) {
  if (!device || (typeof device !== 'object' && typeof device !== 'function')) {
    throw new TypeError('material-interface source-field lane pool requires a device object');
  }
  const normalized = normalizeSourceLocalLanePoolOptions(options);
  let pool = SOURCE_LOCAL_LANE_POOLS.get(device);
  if (!pool) {
    pool = createSourceLocalLanePool(device, normalized.poolMaxEntries);
    SOURCE_LOCAL_LANE_POOLS.set(device, pool);
  } else {
    pool.maxEntries = normalized.poolMaxEntries;
  }

  let entry = pool.entries.get(normalized.structuralKey) || null;
  if (entry?.acquired) {
    const state = entry.lane.getState();
    const error = new Error(state.unsubmittedGenerationCount > 0
      ? 'source-field lane has an overlapping unsubmitted acquisition'
      : 'source-field lane already has an active acquisition');
    error.code = state.unsubmittedGenerationCount > 0
      ? 'ULG_MATERIAL_INTERFACE_SOURCE_FIELD_LANE_POOL_OVERLAPPING_UNSUBMITTED_ACQUISITION'
      : 'ULG_MATERIAL_INTERFACE_SOURCE_FIELD_LANE_POOL_ACTIVE_ACQUISITION';
    error.activeAcquisitionId = entry.activeAcquisitionId;
    throw error;
  }

  let reused = Boolean(entry);
  let grown = false;
  let created = false;
  let retiredLane = null;
  let retirementStatus = null;
  if (entry) {
    const needsGrowth = normalized.particleCapacity > entry.lane.particleCapacity
      || normalized.paramsSlotCount > entry.lane.paramsSlotCount;
    if (needsGrowth) {
      const previous = entry;
      const previousState = previous.lane.getState();
      pool.entries.delete(normalized.structuralKey);
      entry = createSourceLocalLanePoolEntry(pool, normalized, {
        particleCapacity: Math.max(
          normalized.particleCapacity,
          previous.lane.particleCapacity
        ),
        productEventCapacity: Math.max(
          normalized.productEventCapacity,
          previous.lane.productEventCapacity
        ),
        paramsSlotCount: Math.max(
          normalized.paramsSlotCount,
          previous.lane.paramsSlotCount
        ),
        generationBase: Math.max(normalized.generationBase, previousState.nextGeneration)
      });
      retiredLane = previous.lane;
      retirementStatus = retireSourceLocalLanePoolEntry(
        pool,
        previous,
        'grow-only-capacity-replacement'
      );
      pool.growCount += 1;
      reused = false;
      grown = true;
      created = true;
    } else {
      pool.reuseCount += 1;
    }
  } else {
    while (pool.entries.size >= pool.maxEntries) {
      const evictionCandidate = leastRecentlyUsedIdleSourceLocalLaneEntry(pool);
      if (!evictionCandidate) {
        const error = new Error(
          `source-field lane pool is exhausted at ${pool.maxEntries} structural entries`
        );
        error.code = 'ULG_MATERIAL_INTERFACE_SOURCE_FIELD_LANE_POOL_EXHAUSTED';
        error.maxEntries = pool.maxEntries;
        throw error;
      }
      evictSourceLocalLanePoolEntry(pool, evictionCandidate, 'bounded-pool-lru-eviction');
    }
    entry = createSourceLocalLanePoolEntry(pool, normalized);
    created = true;
  }

  const acquisitionOrdinal = pool.nextAcquisitionOrdinal;
  pool.nextAcquisitionOrdinal += 1;
  const acquisitionId = [
    'source-local-field-lane-acquisition',
    pool.deviceId,
    acquisitionOrdinal
  ].join(':');
  const leaseId = normalized.requestedLeaseId || acquisitionId;
  entry.acquired = true;
  entry.activeAcquisitionId = acquisitionId;
  entry.acquisitionCount += 1;
  let released = false;

  const assertActive = () => {
    if (released || entry.retired || entry.activeAcquisitionId !== acquisitionId) {
      const error = new Error('source-field lane acquisition is no longer active');
      error.code = 'ULG_MATERIAL_INTERFACE_SOURCE_FIELD_LANE_POOL_ACQUISITION_RELEASED';
      throw error;
    }
  };
  const release = ({ reason = 'caller-release-after-submit' } = {}) => {
    if (released) return false;
    assertActive();
    const state = entry.lane.getState();
    if (state.unsubmittedGenerationCount > 0) {
      const error = new Error(
        'source-field lane acquisition cannot release unsubmitted encoded generations'
      );
      error.code = 'ULG_MATERIAL_INTERFACE_SOURCE_FIELD_LANE_POOL_RELEASE_BEFORE_SUBMIT';
      error.unsubmittedGenerationCount = state.unsubmittedGenerationCount;
      throw error;
    }
    entry.acquired = false;
    entry.activeAcquisitionId = null;
    entry.lastReleaseReason = reason;
    entry.lastUseOrdinal = pool.nextUseOrdinal;
    pool.nextUseOrdinal += 1;
    released = true;
    return true;
  };

  return {
    schema: SPH_MATERIAL_INTERFACE_SOURCE_LOCAL_GPU_LANE_ACQUISITION_SCHEMA,
    status: grown
      ? 'material-interface-source-field-lane-pool-capacity-grown'
      : reused
        ? 'material-interface-source-field-lane-pool-entry-reused'
        : 'material-interface-source-field-lane-pool-entry-created',
    deviceId: pool.deviceId,
    structuralKey: normalized.structuralKey,
    topologyKey: normalized.topologyKey,
    laneId: normalized.laneId,
    stateKey: normalized.stateKey,
    sourceFamily: normalized.sourceFamily,
    leaseId,
    acquisitionId,
    acquisitionOrdinal,
    lane: entry.lane,
    reused,
    grown,
    created,
    retiredLane,
    retirementStatus,
    poolMaxEntries: pool.maxEntries,
    singleAcquisitionPerStructuralEntry: true,
    sameQueueReuseAfterCallerSubmit: true,
    queueFenceRequiredForReuse: false,
    encodeGeneration(commandEncoder, args = {}) {
      assertActive();
      return entry.lane.encodeGeneration(commandEncoder, args);
    },
    markSubmitted(args = {}) {
      assertActive();
      return entry.lane.markSubmitted(args);
    },
    cancelBeforeSubmit(reason = 'caller-encoder-aborted') {
      assertActive();
      return entry.lane.cancelBeforeSubmit(reason);
    },
    release,
    getState() {
      return {
        schema: SPH_MATERIAL_INTERFACE_SOURCE_LOCAL_GPU_LANE_ACQUISITION_SCHEMA,
        status: released
          ? 'material-interface-source-field-lane-pool-acquisition-released'
          : 'material-interface-source-field-lane-pool-acquisition-active',
        released,
        laneState: entry.lane.getState()
      };
    }
  };
}

export function summarizeSphMaterialInterfaceSourceFieldLocalGpuLanePool(device) {
  const pool = SOURCE_LOCAL_LANE_POOLS.get(device);
  if (!pool) {
    return {
      schema: SPH_MATERIAL_INTERFACE_SOURCE_LOCAL_GPU_LANE_POOL_SCHEMA,
      status: 'material-interface-source-field-lane-pool-absent',
      deviceId: device ? webGpuDeviceId(device) : null,
      maxEntries: 0,
      entryCount: 0,
      activeAcquisitionCount: 0,
      retainedByteLength: 0,
      entries: []
    };
  }
  const entries = [...pool.entries.values()].map((entry) => ({
    structuralKey: entry.structuralKey,
    topologyKey: entry.topologyKey,
    laneId: entry.laneId,
    stateKey: entry.stateKey,
    sourceFamily: entry.sourceFamily,
    acquired: entry.acquired,
    activeAcquisitionId: entry.activeAcquisitionId,
    acquisitionCount: entry.acquisitionCount,
    particleCapacity: entry.lane.particleCapacity,
    productEventCapacity: entry.lane.productEventCapacity,
    paramsSlotCount: entry.lane.paramsSlotCount,
    retainedByteLength: entry.lane.retainedByteLength,
    productEventCapacityOwnedByLane: entry.lane.productEventCapacityOwnedByLane,
    productEventCapacityAdmission: entry.lane.productEventCapacityAdmission,
    laneState: entry.lane.getState()
  }));
  return {
    schema: SPH_MATERIAL_INTERFACE_SOURCE_LOCAL_GPU_LANE_POOL_SCHEMA,
    status: 'material-interface-source-field-lane-pool-ready',
    deviceId: pool.deviceId,
    maxEntries: pool.maxEntries,
    entryCount: entries.length,
    activeAcquisitionCount: entries.filter((entry) => entry.acquired).length,
    retainedByteLength: entries.reduce(
      (sum, entry) => sum + entry.retainedByteLength,
      0
    ),
    createCount: pool.createCount,
    reuseCount: pool.reuseCount,
    growCount: pool.growCount,
    evictionCount: pool.evictionCount,
    retirementScheduledCount: pool.retirementScheduledCount,
    retirementCompletedCount: pool.retirementCompletedCount,
    pendingRetirementCount: pool.pendingRetirementCount,
    entries
  };
}

/**
 * Releases a device pool for scene/GPUHub teardown. Submitted lanes are retired
 * behind the shared submitted-work cleanup fence; no independent scheduler or
 * hot-loop fence is introduced.
 */
export function destroySphMaterialInterfaceSourceFieldLocalGpuLanePool(device, {
  force = false,
  reason = 'source-field-lane-pool-device-teardown'
} = {}) {
  const pool = SOURCE_LOCAL_LANE_POOLS.get(device);
  if (!pool) {
    return {
      schema: SPH_MATERIAL_INTERFACE_SOURCE_LOCAL_GPU_LANE_POOL_SCHEMA,
      status: 'material-interface-source-field-lane-pool-already-absent',
      destroyedEntryCount: 0,
      deferredEntryCount: 0,
      blockedActiveAcquisitionCount: 0
    };
  }
  const activeEntries = [...pool.entries.values()].filter((entry) => entry.acquired);
  if (activeEntries.length > 0 && !force) {
    return {
      schema: SPH_MATERIAL_INTERFACE_SOURCE_LOCAL_GPU_LANE_POOL_SCHEMA,
      status: 'material-interface-source-field-lane-pool-destroy-blocked-active-acquisitions',
      destroyedEntryCount: 0,
      deferredEntryCount: 0,
      blockedActiveAcquisitionCount: activeEntries.length,
      activeAcquisitionIds: activeEntries.map((entry) => entry.activeAcquisitionId)
    };
  }
  SOURCE_LOCAL_LANE_POOLS.delete(device);
  let destroyedEntryCount = 0;
  let deferredEntryCount = 0;
  for (const entry of pool.entries.values()) {
    const retirement = retireSourceLocalLanePoolEntry(
      pool,
      entry,
      reason,
      { force }
    );
    if (retirement === 'retirement-deferred-until-device-queue-fence') {
      deferredEntryCount += 1;
    } else {
      destroyedEntryCount += 1;
    }
  }
  pool.entries.clear();
  return {
    schema: SPH_MATERIAL_INTERFACE_SOURCE_LOCAL_GPU_LANE_POOL_SCHEMA,
    status: 'material-interface-source-field-lane-pool-destroyed',
    destroyedEntryCount,
    deferredEntryCount,
    blockedActiveAcquisitionCount: 0,
    force: Boolean(force),
    reason
  };
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
  const sourceCount = resolvedParticleCount + (productEventBuffer || productEventRows ? resolvedProductEventCount : 0);
  const noFullReadback = readbackMode === NO_FULL_READBACK_MODE;
  const fieldRowByteLength = surfaceTable.totalFieldCells
    * SPH_GPU_RENDER_FIELD_CELL_FLOATS
    * Float32Array.BYTES_PER_ELEMENT;
  const sourceIndexFieldByteLength = surfaceTable.totalFieldCells * Uint32Array.BYTES_PER_ELEMENT;
  const fieldRowsBufferBindingByteLength = runtimeArrayStorageBindingByteLength(
    fieldRowByteLength,
    STORAGE_VEC4_RUNTIME_ARRAY_STRIDE_BYTES
  );
  const sourceIndexFieldBufferBindingByteLength = runtimeArrayStorageBindingByteLength(
    sourceIndexFieldByteLength,
    STORAGE_U32_RUNTIME_ARRAY_STRIDE_BYTES
  );
  const surfaceBufferPayloadByteLength = surfaceTable.records.byteLength;
  const surfaceBufferBindingByteLength = runtimeArrayStorageBindingByteLength(
    surfaceBufferPayloadByteLength,
    STORAGE_VEC4_RUNTIME_ARRAY_STRIDE_BYTES
  );
  const targetFieldRowsByteLength = targetFieldRowsBuffer
    ? Math.max(0, Math.round(finiteNumber(
      targetFieldRowsBufferByteLength
        ?? targetFieldRowsBuffer.size
        ?? targetFieldRowsBuffer.byteLength
        ?? 0,
      0
    )))
    : 0;
  if (
    targetFieldRowsBuffer
    && targetFieldRowsByteLength < fieldRowsBufferBindingByteLength
  ) {
    throw new RangeError(
      `targetFieldRowsBuffer is too small (${targetFieldRowsByteLength}) for source-local material-interface field binding (${fieldRowsBufferBindingByteLength})`
    );
  }

  const borrowedRenderRowsBuffer = renderRowsBuffer || null;
  const borrowedProductEventBuffer = productEventBuffer || null;
  const fieldRowsBufferBorrowed = Boolean(targetFieldRowsBuffer);
  const sourceRowsBuffer = borrowedRenderRowsBuffer || writeStorageBuffer(
    device,
    'ulg-sph-material-interface-source-local-render-rows',
    renderRows,
    GPU_BUFFER_USAGE.COPY_SRC,
    STORAGE_VEC4_RUNTIME_ARRAY_STRIDE_BYTES
  );
  const sourceProductEventBuffer = borrowedProductEventBuffer || writeStorageBuffer(
    device,
    'ulg-sph-material-interface-source-local-product-events',
    productEventRows || new Float32Array(SPH_GPU_REACTION_PRODUCT_EVENT_FLOATS),
    GPU_BUFFER_USAGE.COPY_SRC,
    STORAGE_VEC4_RUNTIME_ARRAY_STRIDE_BYTES
  );
  const surfaceBuffer = writeStorageBuffer(
    device,
    'ulg-sph-material-interface-source-local-surfaces',
    surfaceTable.records,
    GPU_BUFFER_USAGE.COPY_SRC,
    STORAGE_VEC4_RUNTIME_ARRAY_STRIDE_BYTES
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
    GPU_BUFFER_USAGE.COPY_SRC,
    STORAGE_VEC4_RUNTIME_ARRAY_STRIDE_BYTES
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
  if (!noFullReadback) {
    device.queue.submit([encoder.finish()]);
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
    device.queue.submit([encoder.finish()]);
    queueCompletionStatus = 'queue-submitted';
    queueCompletionMethod = 'queue.submit';
    await device.queue.onSubmittedWorkDone();
    queueCompletionStatus = 'queue-work-completed';
    queueCompletionMethod = 'queue.onSubmittedWorkDone';
  } else {
    device.queue.submit([encoder.finish()]);
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
    fieldRowsBufferByteLength: retainFieldRowsBuffer
      ? Math.max(fieldRowsBufferBindingByteLength, Number(fieldRowsBuffer.size) || 0)
      : 0,
    fieldRowsBufferPayloadByteLength: retainFieldRowsBuffer ? fieldRowByteLength : 0,
    fieldRowsBufferBorrowed,
    fieldRowsBufferReused: fieldRowsBufferBorrowed,
    fieldRowsBufferOwnedByResult: !fieldRowsBufferBorrowed,
    surfaceBufferRetained: Boolean(retainSurfaceBuffer),
    surfaceBufferByteLength: retainSurfaceBuffer
      ? Math.max(surfaceBufferBindingByteLength, Number(surfaceBuffer.size) || 0)
      : 0,
    surfaceBufferPayloadByteLength: retainSurfaceBuffer
      ? surfaceBufferPayloadByteLength
      : 0,
    sourceIndexFieldSchema: 'peercompute.ulg.sph-material-interface-source-index-field.v0',
    sourceIndexFieldStatus: retainSourceIndexFieldBuffer
      ? 'source-local-source-index-field-retained'
      : 'source-local-source-index-field-transient',
    sourceIndexFieldBufferRetained: Boolean(retainSourceIndexFieldBuffer),
    sourceIndexFieldBufferByteLength: retainSourceIndexFieldBuffer
      ? Math.max(
          sourceIndexFieldBufferBindingByteLength,
          Number(sourceIndexAccumBuffer.size) || 0
        )
      : 0,
    sourceIndexFieldBufferPayloadByteLength: retainSourceIndexFieldBuffer
      ? sourceIndexFieldByteLength
      : 0,
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

  let retainedBuffersDestroyed = false;
  const destroyRetainedBuffers = () => {
    if (retainedBuffersDestroyed) return;
    retainedBuffersDestroyed = true;
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
    fieldRowsBufferPayloadByteLength:
      sourceRenderField.fieldRowsBufferPayloadByteLength ?? 0,
    fieldRowsBufferBorrowed: Boolean(sourceRenderField.fieldRowsBufferBorrowed),
    fieldRowsBufferReused: Boolean(sourceRenderField.fieldRowsBufferReused),
    fieldRowsBufferOwnedByResult: sourceRenderField.fieldRowsBufferOwnedByResult ?? null,
    surfaceBufferRetained: Boolean(sourceRenderField.surfaceBufferRetained),
    surfaceBufferByteLength: sourceRenderField.surfaceBufferByteLength ?? 0,
    surfaceBufferPayloadByteLength: sourceRenderField.surfaceBufferPayloadByteLength ?? 0,
    sourceIndexFieldSchema: sourceRenderField.sourceIndexFieldSchema,
    sourceIndexFieldStatus: sourceRenderField.sourceIndexFieldStatus,
    sourceIndexFieldBuffer: sourceRenderField.sourceIndexFieldBuffer || null,
    sourceIndexFieldBufferRetained: Boolean(sourceRenderField.sourceIndexFieldBufferRetained),
    sourceIndexFieldBufferByteLength: sourceRenderField.sourceIndexFieldBufferByteLength ?? 0,
    sourceIndexFieldBufferPayloadByteLength:
      sourceRenderField.sourceIndexFieldBufferPayloadByteLength ?? 0,
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
