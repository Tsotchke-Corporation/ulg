// SPH phase demo renderer (three.js), following the webgpuphys MLS-MPM visual style:
// particles are treated as density samples and reconstructed as continuous metaball surfaces
// instead of visible point sprites. Colour still comes from the closure-backed demo state.

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { MarchingCubes } from 'three/examples/jsm/objects/MarchingCubes.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import {
  OPTICAL_GPU_RECORD_LAYOUT,
  buildOpticalGpuLookupQueries,
  buildOpticalGpuTable,
  decodeOpticalGpuLookupOutputRows,
  requestOpticalGpuDevice,
  runOpticalGpuLookupWithOptionalWebGpu,
  sampleOpticalGpuTableCpu,
  stableOpticalStateKey,
  uploadOpticalGpuTable
} from '../runtime/material/opticalGpuBuffers.js';
import {
  ULG_MLS_MPM_GPU_PARTICLE_BUFFER_SET_SCHEMA,
  ULG_SPH_GPU_PARTICLE_BUFFER_SET_SCHEMA,
  destroyMlsMpmGpuParticleBuffers,
  destroySphGpuParticleBuffers,
  uploadMlsMpmGpuParticleBuffers,
  uploadSphGpuParticleBuffers
} from '../runtime/sph/sphGpuBuffers.js';
import { runMlsMpmMechanicsPredictWithOptionalWebGpu } from '../runtime/sph/sphMechanicsGpuKernel.js';
import { runMlsMpmP2gGridProjectionWithOptionalWebGpu } from '../runtime/sph/sphGridGpuKernel.js';
import { runMlsMpmGridUpdateWithOptionalWebGpu } from '../runtime/sph/sphGridUpdateGpuKernel.js';
import { runMlsMpmG2pWithOptionalWebGpu } from '../runtime/sph/sphG2pGpuKernel.js';
import {
  destroyMlsMpmResidentStepsBuffers,
  runMlsMpmResidentStepWithOptionalWebGpu,
  runMlsMpmResidentStepsWithOptionalWebGpu
} from '../runtime/sph/sphMlsMpmGpuStep.js';
import {
  ULG_SPH_GPU_THERMAL_RESPONSE_GRAPH_BUFFER_SET_SCHEMA,
  buildSphThermalClosureGraphBuffers,
  buildSphThermalMaterialTable,
  buildSphThermalPhaseResponseTable,
  destroySphThermalResponseGraphBuffers,
  uploadSphThermalResponseGraphBuffers
} from '../runtime/sph/sphThermalGpuKernel.js';
import { buildSphReactionTable } from '../runtime/sph/sphReactionGpuKernel.js';
import {
  buildSphRenderFieldSurfaceTable,
  buildSphRenderFieldWebGpu,
  buildSphRenderSurfaceDrawMetadataWebGpu,
  buildSphRenderSurfaceVerticesWebGpu,
  deriveSphMaterialInterfaceField,
  decodeSphRenderRows,
  extractSphRenderRowsWebGpu,
  splitSphRenderFieldBySurface
} from '../runtime/sph/sphRenderGpuKernel.js';
import {
  gasPressureInterfaceCouplingSummary,
  gasPressureInterfaceForcePreview,
  gasPressureInterfaceForceSolver
} from '../runtime/sphPhaseDemo.js';
import { opticalRenderParams } from '../runtime/material/opticalClosure.js';

export const SPH_PHASE_RENDER_MODE = 'continuous-marching-cubes';
export const SPH_PHASE_RESIDENT_READBACK_MODE_DEFAULT = 'no-full-readback';
export const SPH_PHASE_RENDER_ORDER = Object.freeze({
  opaqueSurface: 100,
  transmissiveSurface: 200,
  vaporSurface: 300,
  alphaSurface: 320,
  containerWire: 500
});
export const SPH_RENDER_FIELD_VISIBILITY_HYSTERESIS = 0.92;
export const SPH_SURFACE_INACTIVE_GRACE_FRAMES = 2;
export const SPH_VAPOR_SURFACE_OPTICAL_DEPTH_SHOW = 1e-2;
export const SPH_VAPOR_SURFACE_OPTICAL_DEPTH_HIDE = 5e-3;
export const SPH_VAPOR_SURFACE_SCATTER_SHOW_PER_M = 1e-6;
export const SPH_RESIDENT_SURFACE_DRAW_DEPTH_FORMAT = 'depth24plus';
export const SPH_RESIDENT_SURFACE_DRAW_OIT_ACCUM_FORMAT = 'rgba16float';
export const SPH_RESIDENT_SURFACE_DRAW_OIT_REVEAL_FORMAT = 'rgba8unorm';
export const SPH_RESIDENT_SURFACE_DRAW_TEMPORAL_SWAP_POLICY = 'retain-last-overlay-until-replacement-ready';

function nowMs() {
  return typeof globalThis.performance?.now === 'function'
    ? globalThis.performance.now()
    : Date.now();
}

const RESIDENT_FULL_READBACK_MODE = 'full-parity-readback';
const RESIDENT_NO_FULL_READBACK_MODE = 'no-full-readback';
const SPH_RAW_WEBGPU_SURFACE_OVERLAY_ENABLED = false;
const SPH_THREE_VISIBLE_RENDER_FIELD_READBACK_MODE = SPH_RAW_WEBGPU_SURFACE_OVERLAY_ENABLED
  ? RESIDENT_NO_FULL_READBACK_MODE
  : RESIDENT_FULL_READBACK_MODE;
const SPH_THREE_WEBGPU_BINDING_REASON = 'raw WebGPU canvas overlay disabled; awaiting Three WebGPURenderer storage-buffer integration';
const GPU_TEXTURE_USAGE = {
  COPY_SRC: globalThis.GPUTextureUsage?.COPY_SRC ?? 1,
  TEXTURE_BINDING: globalThis.GPUTextureUsage?.TEXTURE_BINDING ?? 4,
  RENDER_ATTACHMENT: globalThis.GPUTextureUsage?.RENDER_ATTACHMENT ?? 16
};
const GPU_BUFFER_USAGE = {
  COPY_DST: globalThis.GPUBufferUsage?.COPY_DST ?? 8,
  UNIFORM: globalThis.GPUBufferUsage?.UNIFORM ?? 64,
  STORAGE: globalThis.GPUBufferUsage?.STORAGE ?? 128
};
const GPU_SHADER_STAGE = {
  VERTEX: globalThis.GPUShaderStage?.VERTEX ?? 1,
  FRAGMENT: globalThis.GPUShaderStage?.FRAGMENT ?? 2
};

const SURFACE_CONFIG = {
  h2o: {
    resolution: 18,
    subtract: 24,
    isolation: 80,
    maxPolyCount: 24000
  },
  fe: {
    resolution: 18,
    subtract: 26,
    isolation: 82,
    maxPolyCount: 24000
  },
  // Vaporized water: a faint, diffuse cloud rather than a tight blob. Lower isolation + larger
  // ball influence makes the metaballs bleed together into a whispy volume; high transparency and
  // no depth-write let it read as steam drifting in front of the scene.
  steam: {
    resolution: 16,
    subtract: 10,
    isolation: 24,
    maxPolyCount: 20000
  },
  default: {
    resolution: 18,
    subtract: 24,
    isolation: 80,
    maxPolyCount: 24000
  }
};

const CPU_SURFACE_ADAPTIVE_RESOLUTION = Object.freeze([
  { maxParticles: 8, resolution: 12, maxPolyCount: 9000 },
  { maxParticles: 27, resolution: 14, maxPolyCount: 14000 },
  { maxParticles: 64, resolution: 16, maxPolyCount: 19000 }
]);

export const SPH_RESIDENT_SURFACE_DRAW_OVERLAY_WGSL = `
struct CameraUniform {
  view_projection: mat4x4<f32>,
};

struct VertexOut {
  @builtin(position) position: vec4<f32>,
  @location(0) normal: vec3<f32>,
  @location(1) material_id: f32,
  @location(2) phase_id: f32,
  @location(3) optical_state_id: f32,
};

@group(0) @binding(0) var<storage, read> surface_vertices: array<vec4<f32>>;
@group(0) @binding(1) var<uniform> camera_data: CameraUniform;
@group(0) @binding(2) var<storage, read> optical_records: array<vec4<f32>>;
@group(0) @binding(3) var<storage, read> spectral_samples: array<vec4<f32>>;

struct OitFragmentOut {
  @location(0) accum: vec4<f32>,
  @location(1) revealage: vec4<f32>,
};

struct OpticalMaterial {
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
  optical_depth: f32,
  spectral_tint_linear: vec3<f32>,
  status: f32,
  blocked: f32,
  found: f32,
};

fn id_equal(a: f32, b: f32) -> bool {
  return abs(round(a) - round(b)) < 0.5;
}

fn optical_record_count() -> u32 {
  return arrayLength(&optical_records) / 6u;
}

fn optical_record_row(record_index: u32, row_index: u32) -> vec4<f32> {
  return optical_records[record_index * 6u + row_index];
}

fn spectral_sample_count() -> u32 {
  return arrayLength(&spectral_samples) / 2u;
}

fn spectral_sample_row(sample_index: u32, row_index: u32) -> vec4<f32> {
  return spectral_samples[sample_index * 2u + row_index];
}

fn spectral_wavelength_rgb(wavelength_nm: f32) -> vec3<f32> {
  let w = clamp(wavelength_nm, 380.0, 780.0);
  var rgb = vec3<f32>(0.0);
  if (w < 440.0) {
    rgb = vec3<f32>(-(w - 440.0) / 60.0, 0.0, 1.0);
  } else if (w < 490.0) {
    rgb = vec3<f32>(0.0, (w - 440.0) / 50.0, 1.0);
  } else if (w < 510.0) {
    rgb = vec3<f32>(0.0, 1.0, -(w - 510.0) / 20.0);
  } else if (w < 580.0) {
    rgb = vec3<f32>((w - 510.0) / 70.0, 1.0, 0.0);
  } else if (w < 645.0) {
    rgb = vec3<f32>(1.0, -(w - 645.0) / 65.0, 0.0);
  } else {
    rgb = vec3<f32>(1.0, 0.0, 0.0);
  }
  let edge = select(
    select(1.0, 0.3 + 0.7 * (w - 380.0) / 40.0, w < 420.0),
    0.3 + 0.7 * (780.0 - w) / 80.0,
    w > 700.0
  );
  return pow(clamp(rgb * edge, vec3<f32>(0.0), vec3<f32>(1.0)), vec3<f32>(2.2));
}

fn spectral_tint_from_samples(spectral_offset: f32, spectral_count_value: f32, transmission: f32) -> vec3<f32> {
  let total_samples = spectral_sample_count();
  let start = u32(max(0.0, round(spectral_offset)));
  let count = min(u32(max(0.0, round(spectral_count_value))), 32u);
  if (count == 0u || start >= total_samples) {
    return vec3<f32>(1.0);
  }
  var weighted = vec3<f32>(0.0);
  var weight_sum = 0.0;
  for (var local = 0u; local < 32u; local = local + 1u) {
    if (local >= count) {
      break;
    }
    let sample_index = start + local;
    if (sample_index >= total_samples) {
      break;
    }
    let row0 = spectral_sample_row(sample_index, 0u);
    let wavelength_rgb = spectral_wavelength_rgb(row0.x);
    let reflectance = clamp(row0.y, 0.0, 1.0);
    let transmittance = clamp(row0.z, 0.0, 1.0);
    let response = mix(reflectance, transmittance, clamp(transmission, 0.0, 1.0));
    weighted = weighted + wavelength_rgb * response;
    weight_sum = weight_sum + max(response, 0.0001);
  }
  if (!(weight_sum > 0.0)) {
    return vec3<f32>(1.0);
  }
  let tint = weighted / weight_sum;
  let max_channel = max(max(tint.r, tint.g), tint.b);
  return clamp(tint / max(max_channel, 0.0001), vec3<f32>(0.0), vec3<f32>(1.0));
}

fn fallback_optical_material(phase_id: f32) -> OpticalMaterial {
  var color = vec3<f32>(0.72, 0.9, 1.0);
  if (phase_id < 1.5) {
    color = vec3<f32>(0.88, 0.88, 0.82);
  } else if (phase_id < 2.5) {
    color = vec3<f32>(0.28, 0.7, 1.0);
  } else if (phase_id < 3.5) {
    color = vec3<f32>(0.86, 0.96, 1.0);
  }
  return OpticalMaterial(color, 0.0, 0.65, 0.0, 0.42, 1.0, vec3<f32>(1.0), 1.0e20, 0.0, 0.0, 0.0, vec3<f32>(1.0), 0.0, 1.0, 0.0);
}

fn find_optical_material(material_id: f32, phase_id: f32, optical_state_id: f32) -> OpticalMaterial {
  let count = optical_record_count();
  var fallback_index: i32 = -1;
  for (var record_index = 0u; record_index < count; record_index = record_index + 1u) {
    let row0 = optical_record_row(record_index, 0u);
    let row5 = optical_record_row(record_index, 5u);
    if (id_equal(row0.x, material_id) && id_equal(row0.y, phase_id)) {
      if (id_equal(row5.w, optical_state_id)) {
        let row1 = optical_record_row(record_index, 1u);
        let row2 = optical_record_row(record_index, 2u);
        let row3 = optical_record_row(record_index, 3u);
        let row4 = optical_record_row(record_index, 4u);
        let spectral_tint = spectral_tint_from_samples(row0.z, row0.w, row2.y);
        return OpticalMaterial(
          clamp(mix(row1.xyz, row1.xyz * spectral_tint, 0.35), vec3<f32>(0.0), vec3<f32>(1.0)),
          clamp(row1.w, 0.0, 1.0),
          clamp(row2.x, 0.04, 1.0),
          clamp(row2.y, 0.0, 1.0),
          clamp(row2.z, 0.0, 1.0),
          max(row2.w, 1.0),
          clamp(row3.xyz, vec3<f32>(0.0), vec3<f32>(1.0)),
          max(row3.w, 0.00001),
          max(row4.x, 0.0),
          max(row4.y, 0.0),
          max(row5.x, 0.0),
          spectral_tint,
          row5.z,
          row5.y,
          1.0
        );
      }
      if (id_equal(row5.w, 0.0) && fallback_index < 0) {
        fallback_index = i32(record_index);
      }
    }
  }
  if (fallback_index >= 0) {
    let index = u32(fallback_index);
    let row0 = optical_record_row(index, 0u);
    let row1 = optical_record_row(index, 1u);
    let row2 = optical_record_row(index, 2u);
    let row3 = optical_record_row(index, 3u);
    let row4 = optical_record_row(index, 4u);
    let row5 = optical_record_row(index, 5u);
    let spectral_tint = spectral_tint_from_samples(row0.z, row0.w, row2.y);
    return OpticalMaterial(
      clamp(mix(row1.xyz, row1.xyz * spectral_tint, 0.35), vec3<f32>(0.0), vec3<f32>(1.0)),
      clamp(row1.w, 0.0, 1.0),
      clamp(row2.x, 0.04, 1.0),
      clamp(row2.y, 0.0, 1.0),
      clamp(row2.z, 0.0, 1.0),
      max(row2.w, 1.0),
      clamp(row3.xyz, vec3<f32>(0.0), vec3<f32>(1.0)),
      max(row3.w, 0.00001),
      max(row4.x, 0.0),
      max(row4.y, 0.0),
      max(row5.x, 0.0),
      spectral_tint,
      row5.z,
      row5.y,
      1.0
    );
  }
  return fallback_optical_material(phase_id);
}

@vertex
fn vs_main(@builtin(vertex_index) vertex_index: u32) -> VertexOut {
  let base = vertex_index * 4u;
  let row0 = surface_vertices[base];
  let row1 = surface_vertices[base + 1u];
  let row2 = surface_vertices[base + 2u];
  let position_m = vec3<f32>(row1.y, row1.z, row1.w);
  var out: VertexOut;
  out.position = camera_data.view_projection * vec4<f32>(position_m, 1.0);
  out.normal = normalize(row2.xyz + vec3<f32>(0.0001, 0.0002, 0.0003));
  out.material_id = row0.y;
  out.phase_id = row0.z;
  out.optical_state_id = row2.w;
  return out;
}

fn resident_surface_color(in: VertexOut) -> vec4<f32> {
  let optical = find_optical_material(in.material_id, in.phase_id, in.optical_state_id);
  let blocked = optical.blocked > 0.5 || optical.status == 255.0;
  let optical_depth = clamp(optical.optical_depth, 0.0, 16.0);
  let absorption_depth = clamp(optical.absorption_coefficient_per_m * min(optical.attenuation_distance_m, 1.0), 0.0, 16.0);
  let attenuation_weight = clamp(1.0 - exp(-max(optical_depth, absorption_depth)), 0.0, 1.0);
  let attenuated_base = mix(
    optical.base_color_linear,
    optical.base_color_linear * optical.attenuation_linear,
    attenuation_weight
  );
  let base_color = select(attenuated_base, vec3<f32>(0.55, 0.05, 0.18), blocked);
  let normal = normalize(in.normal);
  let light_dir = normalize(vec3<f32>(0.35, 0.7, 0.55));
  let view_dir = normalize(vec3<f32>(0.15, 0.25, 1.0));
  let half_dir = normalize(light_dir + view_dir);
  let ndotl = clamp(dot(normal, light_dir), 0.0, 1.0);
  let ndoth = clamp(dot(normal, half_dir), 0.0, 1.0);
  let roughness = clamp(optical.roughness, 0.04, 1.0);
  let metalness = clamp(optical.metalness, 0.0, 1.0);
  let diffuse = base_color * (1.0 - metalness) * (0.24 + 0.76 * ndotl);
  let ior = max(optical.ior, 1.0);
  let dielectric_f0 = pow((ior - 1.0) / (ior + 1.0), 2.0);
  let fresnel = dielectric_f0 + (1.0 - dielectric_f0) * pow(1.0 - clamp(dot(normal, view_dir), 0.0, 1.0), 5.0);
  let f0 = mix(vec3<f32>(dielectric_f0), base_color, metalness);
  let specular_power = max(2.0, (1.0 - roughness) * (1.0 - roughness) * 128.0);
  let specular = (f0 + vec3<f32>(fresnel * (1.0 - metalness))) * pow(ndoth, specular_power) * (0.35 + 0.65 * ndotl);
  let scatter_haze = clamp(log2(1.0 + optical.scattering_coefficient_per_m) * 0.018, 0.0, 0.35);
  let rim = pow(1.0 - clamp(dot(normal, view_dir), 0.0, 1.0), 3.0) * (0.08 + scatter_haze) * (1.0 - roughness);
  let lit = diffuse + specular + base_color * rim;
  let is_vapor = round(in.phase_id) == 3.0;
  let transmissive_surface_alpha = optical.transmission > 0.01 && metalness < 0.1 && !is_vapor;
  let optical_alpha = clamp(1.0 - exp(-optical_depth), 0.0, 1.0);
  let vapor_alpha = max(clamp(optical.opacity, 0.0, 1.0), optical_alpha);
  let transmissive_alpha = clamp(max(0.08, 1.0 - optical.transmission * 0.72 + optical_alpha * 0.5), 0.08, 1.0);
  let base_alpha = select(clamp(optical.opacity, 0.0, 1.0), vapor_alpha, is_vapor);
  let alpha = select(base_alpha, transmissive_alpha, transmissive_surface_alpha);
  return vec4<f32>(lit * alpha, alpha);
}

@fragment
fn fs_main(in: VertexOut) -> @location(0) vec4<f32> {
  return resident_surface_color(in);
}

@fragment
fn fs_oit_main(in: VertexOut) -> OitFragmentOut {
  let color = resident_surface_color(in);
  let alpha = clamp(color.a, 0.0, 1.0);
  let weight = clamp(alpha * 8.0 + 0.01, 0.01, 8.0);
  var out: OitFragmentOut;
  out.accum = vec4<f32>(color.rgb * weight, alpha * weight);
  out.revealage = vec4<f32>(alpha, 0.0, 0.0, alpha);
  return out;
}
`;

export const SPH_RESIDENT_SURFACE_DRAW_OIT_COMPOSITE_WGSL = `
struct VertexOut {
  @builtin(position) position: vec4<f32>,
  @location(0) uv: vec2<f32>,
};

@group(0) @binding(0) var accum_texture: texture_2d<f32>;
@group(0) @binding(1) var reveal_texture: texture_2d<f32>;
@group(0) @binding(2) var linear_sampler: sampler;

@vertex
fn vs_main(@builtin(vertex_index) vertex_index: u32) -> VertexOut {
  var positions = array<vec2<f32>, 3>(
    vec2<f32>(-1.0, -1.0),
    vec2<f32>(3.0, -1.0),
    vec2<f32>(-1.0, 3.0)
  );
  let position = positions[vertex_index];
  var out: VertexOut;
  out.position = vec4<f32>(position, 0.0, 1.0);
  out.uv = position * 0.5 + vec2<f32>(0.5, 0.5);
  return out;
}

@fragment
fn fs_main(in: VertexOut) -> @location(0) vec4<f32> {
  let accum = textureSampleLevel(accum_texture, linear_sampler, in.uv, 0.0);
  let reveal = textureSampleLevel(reveal_texture, linear_sampler, in.uv, 0.0).r;
  let alpha = clamp(1.0 - reveal, 0.0, 1.0);
  let color = accum.rgb / max(accum.a, 0.00001);
  return vec4<f32>(color * alpha, alpha);
}
`;

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function normalizeResidentReadbackMode(value) {
  return value === RESIDENT_FULL_READBACK_MODE ? RESIDENT_FULL_READBACK_MODE : RESIDENT_NO_FULL_READBACK_MODE;
}

// Inset the simulation box inside the marching-cubes field cube so an isosurface that reaches a box
// face is NOT hard-clipped flat at the field boundary — the metaball is given room on the far side
// of the wall to close into a rounded surface, so a blob resting against the floor/wall renders as a
// complete dome instead of a sliced-off plane. The padding is mapped per-axis (below); the mesh
// scale is widened by 1/(1-2·pad) so the padded [0,1] field still aligns with the box wireframe.
// A metaball's surface extends ~radiusNorm·√((iso+sub)/iso) ≈ 1.15·radiusNorm from its centre, and
// radiusNorm is clamped to ≤0.14, so the surface reaches ~0.16 past a wall-hugging particle — the
// padding must exceed that to fully contain the dome. Resolutions are raised to keep box detail
// since the box now occupies only (1−2·pad) of each field axis.
const FIELD_PADDING = 0.22;
const RESIDENT_RENDER_FIELD_MAX_RESOLUTION = 32;

function materialKeyOf(value) {
  return typeof value === 'string' && value.length > 0 ? value : 'default';
}

function adaptiveCpuSurfaceConfig(baseConfig, particleCount = Infinity) {
  const count = Number.isFinite(particleCount) ? particleCount : Infinity;
  const adaptive = CPU_SURFACE_ADAPTIVE_RESOLUTION.find((entry) => count <= entry.maxParticles);
  if (!adaptive) return baseConfig;
  return {
    ...baseConfig,
    resolution: Math.min(baseConfig.resolution, adaptive.resolution),
    maxPolyCount: Math.min(baseConfig.maxPolyCount, adaptive.maxPolyCount)
  };
}

function surfaceKeyForDescriptor({ renderKey, material, phase, opticalState = null }) {
  const base = `${renderKey}|${material}|${phase ?? 'phase-unspecified'}`;
  const opticalStateKey = stableOpticalStateKey(opticalState);
  return opticalStateKey === 'default' ? base : `${base}|opt:${opticalStateKey}`;
}

function renderDescriptorOf(value) {
  if (value && typeof value === 'object') {
    const renderKey = materialKeyOf(value.renderKey ?? value.key ?? value.material);
    const material = materialKeyOf(value.material ?? ((renderKey === 'steam' || renderKey === 'ice') ? 'h2o' : renderKey));
    const phase = value.phase ?? (renderKey === 'steam' ? 'gas' : (renderKey === 'ice' ? 'solid' : null));
    const opticalState = value.opticalState || null;
    return {
      renderKey,
      material,
      phase,
      opticalState,
      opticalStateKey: stableOpticalStateKey(opticalState),
      surfaceKey: surfaceKeyForDescriptor({ renderKey, material, phase, opticalState })
    };
  }
  const renderKey = materialKeyOf(value);
  const material = (renderKey === 'steam' || renderKey === 'ice') ? 'h2o' : renderKey;
  const phase = renderKey === 'steam' ? 'gas' : (renderKey === 'ice' ? 'solid' : null);
  return {
    renderKey,
    material,
    phase,
    opticalState: null,
    opticalStateKey: 'default',
    surfaceKey: surfaceKeyForDescriptor({ renderKey, material, phase })
  };
}

function materialPropertiesForSurfaceDescriptor(descriptor, materialProperties) {
  if (!materialProperties) return null;
  const materialKey = descriptor.material;
  const renderKey = descriptor.renderKey;
  return materialProperties[materialKey]
    ?? materialProperties[materialKey?.toLowerCase?.()]
    ?? materialProperties[renderKey]
    ?? materialProperties[renderKey?.toLowerCase?.()]
    ?? null;
}

function opticalQueryForDescriptor(descriptor, properties = null) {
  return {
    material: descriptor.material,
    phase: descriptor.phase ?? (descriptor.renderKey === 'steam' ? 'gas' : (descriptor.renderKey === 'ice' ? 'solid' : 'liquid')),
    properties,
    opticalState: descriptor.opticalState || null
  };
}

function opticalCoverageKey({ material, phase, opticalStateKey = null, opticalState = null }) {
  const stateKey = opticalStateKey || stableOpticalStateKey(opticalState);
  return `${material}|${phase}|${stateKey}`;
}

function opticalRecordIndex(layout = OPTICAL_GPU_RECORD_LAYOUT, fieldName) {
  return layout.findIndex((entry) => String(entry).split(':')[0] === fieldName);
}

function opticalRecordValue(table, recordIndex, fieldName, fallback = 0) {
  const layout = table?.recordLayout || OPTICAL_GPU_RECORD_LAYOUT;
  const fieldIndex = opticalRecordIndex(layout, fieldName);
  const stride = table?.recordStrideFloats || layout.length;
  const offset = recordIndex * stride + fieldIndex;
  const value = fieldIndex >= 0 ? table?.records?.[offset] : undefined;
  return Number.isFinite(value) ? value : fallback;
}

function opticalParamsFromGpuTableRecord(table, descriptor) {
  if (!table?.schema || !(table.records instanceof Float32Array) || !Array.isArray(table.recordMetadata)) return null;
  const coverage = opticalCoverageKey(descriptor);
  const record = table.recordMetadata.find((candidate) => opticalCoverageKey(candidate) === coverage);
  if (!record || !Number.isFinite(record.recordIndex)) return null;
  return {
    source: 'optical-gpu-table-row',
    material: record.material,
    phase: record.phase,
    opticalState: record.opticalState || null,
    opticalStateKey: record.opticalStateKey || 'default',
    opticalStateId: record.opticalStateId || 0,
    baseColorLinear: [
      opticalRecordValue(table, record.recordIndex, 'baseColorLinearR', 1),
      opticalRecordValue(table, record.recordIndex, 'baseColorLinearG', 1),
      opticalRecordValue(table, record.recordIndex, 'baseColorLinearB', 1)
    ],
    metalness: opticalRecordValue(table, record.recordIndex, 'metalness', 0),
    roughness: opticalRecordValue(table, record.recordIndex, 'roughness', 0.5),
    transmission: opticalRecordValue(table, record.recordIndex, 'transmission', 0),
    opacity: opticalRecordValue(table, record.recordIndex, 'opacity', 1),
    ior: opticalRecordValue(table, record.recordIndex, 'ior', 1),
    attenuationLinear: [
      opticalRecordValue(table, record.recordIndex, 'attenuationLinearR', 1),
      opticalRecordValue(table, record.recordIndex, 'attenuationLinearG', 1),
      opticalRecordValue(table, record.recordIndex, 'attenuationLinearB', 1)
    ],
    attenuationDistanceM: opticalRecordValue(table, record.recordIndex, 'attenuationDistanceM', 1e20),
    absorptionCoefficientPerM: opticalRecordValue(table, record.recordIndex, 'absorptionCoefficientPerM', 0),
    scatteringCoefficientPerM: opticalRecordValue(table, record.recordIndex, 'scatteringCoefficientPerM', 0),
    renderModelId: opticalRecordValue(table, record.recordIndex, 'renderModelId', 0),
    vertexColorPolicyId: opticalRecordValue(table, record.recordIndex, 'vertexColorPolicyId', 1),
    opticalDepth: opticalRecordValue(table, record.recordIndex, 'opticalDepth', 0),
    blocked: opticalRecordValue(table, record.recordIndex, 'blocked', 0) > 0,
    status: opticalRecordValue(table, record.recordIndex, 'status', 1),
    provenance: record.provenance || null
  };
}

function opticalSignatureForMaterial(optics = null) {
  if (!optics) return 'cpu-optical-render-params';
  return [
    optics.source || 'optics',
    optics.material || '',
    optics.phase || '',
    optics.opticalStateKey || 'default',
    optics.metalness,
    optics.roughness,
    optics.transmission,
    optics.opacity,
    optics.ior,
    optics.attenuationDistanceM,
    optics.absorptionCoefficientPerM,
    optics.scatteringCoefficientPerM,
    optics.opticalDepth,
    optics.renderModelId,
    optics.vertexColorPolicyId,
    ...(optics.baseColorLinear || optics.baseColorSrgb || [])
  ].map((value) => String(value)).join('|');
}

function surfaceRenderOrderKey(descriptorOrRow = {}) {
  if (descriptorOrRow.surfaceKey) return descriptorOrRow.surfaceKey;
  return [
    descriptorOrRow.renderKey ?? descriptorOrRow.renderMaterialKey ?? '',
    descriptorOrRow.material ?? '',
    descriptorOrRow.phase ?? '',
    descriptorOrRow.opticalStateKey ?? stableOpticalStateKey(descriptorOrRow.opticalState || null)
  ].join('|');
}

export function stableSurfaceRenderOrder(baseOrder, surfaceKey = '') {
  const base = Number.isFinite(baseOrder) ? baseOrder : 0;
  const key = String(surfaceKey || '');
  let hash = 2166136261;
  for (let i = 0; i < key.length; i += 1) {
    hash ^= key.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return base + ((hash >>> 0) % 1000) / 100000;
}

export function resolveRenderFieldSurfaceVisibility({
  maxDensity = 0,
  isolation = 0,
  wasVisible = false
} = {}) {
  const density = Number.isFinite(maxDensity) ? Math.max(0, maxDensity) : 0;
  const showIsolation = Number.isFinite(isolation) ? Math.max(0, isolation) : 0;
  const hideIsolation = showIsolation * SPH_RENDER_FIELD_VISIBILITY_HYSTERESIS;
  const visible = density >= showIsolation || (wasVisible && density >= hideIsolation);
  return {
    visible,
    retainPreviousSurface: !visible && wasVisible,
    showIsolation,
    hideIsolation,
    renderIsolation: visible && density < showIsolation ? hideIsolation : showIsolation
  };
}

export function hideRenderFieldSurfaceAfterGrace(surface, renderSource) {
  surface.inactiveFrameCount = Math.max(0, surface.inactiveFrameCount || 0) + 1;
  surface.mesh.userData.surfaceInactiveFrameCount = surface.inactiveFrameCount;
  surface.mesh.userData.renderSource = renderSource;
  if (surface.inactiveFrameCount <= SPH_SURFACE_INACTIVE_GRACE_FRAMES) {
    return false;
  }
  surface.mesh.isolation = surface.config.isolation;
  surface.mesh.reset();
  surface.mesh.update();
  surface.mesh.visible = false;
  return true;
}

function opticalPhaseOf(optics = {}, descriptorOrRow = {}) {
  return descriptorOrRow.phase
    ?? optics.phase
    ?? (descriptorOrRow.renderKey === 'steam' ? 'gas' : null);
}

function isVaporOpticalSurface(optics = {}, descriptorOrRow = {}) {
  const phase = opticalPhaseOf(optics, descriptorOrRow);
  const material = descriptorOrRow.material ?? optics.material ?? null;
  const renderKey = descriptorOrRow.renderKey ?? descriptorOrRow.renderMaterialKey ?? null;
  return phase === 'gas' || material === 'steam' || renderKey === 'steam';
}

function opticalDepthFromOpacity(opacity) {
  const alpha = clamp(Number.isFinite(opacity) ? opacity : 0, 0, 1);
  if (!(alpha > 0)) return 0;
  if (alpha >= 1) return Number.POSITIVE_INFINITY;
  return -Math.log(1 - alpha);
}

export function resolveOpticalSurfaceVisibility({
  optics = {},
  descriptorOrRow = {},
  wasVisible = false
} = {}) {
  if (!isVaporOpticalSurface(optics, descriptorOrRow)) {
    return {
      visible: true,
      reason: 'non-vapor-surface',
      opticalDepth: Number.isFinite(optics.opticalDepth) ? Math.max(0, optics.opticalDepth) : null,
      scatteringCoefficientPerM: Number.isFinite(optics.scatteringCoefficientPerM)
        ? Math.max(0, optics.scatteringCoefficientPerM)
        : null,
      showOpticalDepth: null,
      hideOpticalDepth: null,
      retainPreviousSurface: false
    };
  }
  const scatteringCoefficientPerM = Math.max(
    0,
    Number.isFinite(optics.scatteringCoefficientPerM) ? optics.scatteringCoefficientPerM : 0,
    Number.isFinite(optics.condensationScatter) ? optics.condensationScatter : 0,
    Number.isFinite(optics.internalScatter) ? optics.internalScatter : 0
  );
  const opticalDepth = Math.max(
    0,
    Number.isFinite(optics.opticalDepth) ? optics.opticalDepth : 0,
    opticalDepthFromOpacity(optics.opacity)
  );
  const hasScattering = scatteringCoefficientPerM >= SPH_VAPOR_SURFACE_SCATTER_SHOW_PER_M;
  const depthThreshold = wasVisible ? SPH_VAPOR_SURFACE_OPTICAL_DEPTH_HIDE : SPH_VAPOR_SURFACE_OPTICAL_DEPTH_SHOW;
  const visible = hasScattering || opticalDepth >= depthThreshold;
  return {
    visible,
    reason: visible
      ? (hasScattering ? 'derived-droplet-scattering-visible' : 'derived-vapor-optical-depth-visible')
      : 'derived-pure-vapor-optically-thin',
    opticalDepth,
    scatteringCoefficientPerM,
    showOpticalDepth: SPH_VAPOR_SURFACE_OPTICAL_DEPTH_SHOW,
    hideOpticalDepth: SPH_VAPOR_SURFACE_OPTICAL_DEPTH_HIDE,
    scatteringThresholdPerM: SPH_VAPOR_SURFACE_SCATTER_SHOW_PER_M,
    retainPreviousSurface: !visible && wasVisible
  };
}

export function renderAlphaFromOpticalResponse(optics = {}, descriptorOrRow = {}) {
  const opacity = clamp(Number.isFinite(optics.opacity) ? optics.opacity : 1, 0, 1);
  const transmission = clamp(Number.isFinite(optics.transmission) ? optics.transmission : 0, 0, 1);
  const metalness = clamp(Number.isFinite(optics.metalness) ? optics.metalness : 0, 0, 1);
  const isVapor = isVaporOpticalSurface(optics, descriptorOrRow);
  if (transmission > 0.01 && metalness < 0.1 && !isVapor) {
    return 1;
  }
  return opacity;
}

export function renderDepthWriteFromOpticalResponse(optics = {}, descriptorOrRow = {}) {
  const transmission = clamp(Number.isFinite(optics.transmission) ? optics.transmission : 0, 0, 1);
  const alpha = renderAlphaFromOpticalResponse(optics, descriptorOrRow);
  const transparent = transmission > 0.01 || alpha < 0.999;
  return !transparent;
}

export function renderLayerFromOpticalResponse(optics = {}, descriptorOrRow = {}) {
  const transmission = clamp(Number.isFinite(optics.transmission) ? optics.transmission : 0, 0, 1);
  const alpha = renderAlphaFromOpticalResponse(optics, descriptorOrRow);
  const isVapor = isVaporOpticalSurface(optics, descriptorOrRow);
  if (isVapor) return 'vapor-surface';
  if (transmission > 0.01) return 'transmissive-surface';
  if (alpha < 0.999) return 'alpha-surface';
  return 'opaque-surface';
}

export function renderOrderFromOpticalResponse(optics = {}, descriptorOrRow = {}) {
  const layer = renderLayerFromOpticalResponse(optics, descriptorOrRow);
  if (layer === 'vapor-surface') return SPH_PHASE_RENDER_ORDER.vaporSurface;
  if (layer === 'transmissive-surface') return SPH_PHASE_RENDER_ORDER.transmissiveSurface;
  if (layer === 'alpha-surface') return SPH_PHASE_RENDER_ORDER.alphaSurface;
  return SPH_PHASE_RENDER_ORDER.opaqueSurface;
}

export function residentSurfaceDrawOrder(surfaces = [], {
  indirectStrideBytes = 4 * Uint32Array.BYTES_PER_ELEMENT
} = {}) {
  if (!Array.isArray(surfaces)) return [];
  return surfaces
    .map((surface, index) => {
      const surfaceIndex = Math.max(0, Math.round(Number(surface?.surfaceIndex ?? index) || 0));
      const transparencyClassId = Number.isFinite(Number(surface?.transparencyClassId))
        ? Number(surface.transparencyClassId)
        : 0;
      const depthWriteFlag = Number.isFinite(Number(surface?.depthWriteFlag))
        ? Number(surface.depthWriteFlag)
        : (transparencyClassId > 0 ? 0 : 1);
      const renderOrder = Number.isFinite(Number(surface?.renderOrder))
        ? Number(surface.renderOrder)
        : (transparencyClassId * 1000 + surfaceIndex);
      return {
        surfaceIndex,
        renderOrder,
        transparencyClassId,
        depthWriteFlag,
        renderLayer: surface?.renderLayer ?? null,
        indirectOffsetBytes: surfaceIndex * indirectStrideBytes
      };
    })
    .sort((a, b) => (
      a.renderOrder - b.renderOrder
      || b.depthWriteFlag - a.depthWriteFlag
      || a.transparencyClassId - b.transparencyClassId
      || a.surfaceIndex - b.surfaceIndex
    ));
}

export function residentSurfaceDrawPipelineKey(draw = {}) {
  return Number(draw?.depthWriteFlag) > 0 ? 'opaque-depth-write' : 'transparent-depth-test';
}

function makeSurfaceMaterial(descriptorOrKey, properties = null, opticsOverride = null) {
  const descriptor = renderDescriptorOf(descriptorOrKey);
  // Transmission / IOR / attenuation come from the optical closure (refractive index + Beer–Lambert
  // extinction): clear media transmit according to optical depth; conductors become opaque from
  // Drude skin depth; missing optical closures block rather than falling back to fake opacity.
  const optics = opticsOverride || opticalRenderParams(opticalQueryForDescriptor(descriptor, properties));
  const usesTransmission = optics.transmission > 0.01;
  const renderAlpha = renderAlphaFromOpticalResponse(optics, descriptor);
  const transparent = usesTransmission || renderAlpha < 0.999;
  const baseColor = optics.baseColorSrgb ?? optics.pbr?.baseColorSrgb ?? [1, 1, 1];
  const baseColorLinear = optics.baseColorLinear || null;
  const materialColor = new THREE.Color();
  if (baseColorLinear) {
    materialColor.setRGB(baseColorLinear[0], baseColorLinear[1], baseColorLinear[2], THREE.LinearSRGBColorSpace);
  } else {
    materialColor.setRGB(baseColor[0], baseColor[1], baseColor[2], THREE.SRGBColorSpace);
  }
  const material = new THREE.MeshPhysicalMaterial({
    color: materialColor,
    vertexColors: optics.vertexColorPolicy === 'particle-diagnostic' || Math.round(optics.vertexColorPolicyId || 0) === 2,
    side: THREE.DoubleSide,
    clearcoat: optics.metalness > 0.5 ? 0.18 : 0.05,
    metalness: optics.metalness,
    roughness: optics.roughness,
    ior: optics.ior ?? 1.5,
    transmission: optics.transmission,
    thickness: usesTransmission ? 0.6 : 0,
    envMapIntensity: optics.metalness > 0.5 ? 1.3 : 0.85,
    transparent,
    depthWrite: renderDepthWriteFromOpticalResponse(optics, descriptor),
    opacity: renderAlpha
  });
  material.userData.renderLayer = renderLayerFromOpticalResponse(optics, descriptor);
  material.userData.renderOrder = renderOrderFromOpticalResponse(optics, descriptor);
  const attenuationColor = optics.attenuationLinear || optics.attenuationColor || null;
  if (attenuationColor) {
    material.attenuationColor = new THREE.Color();
    if (optics.attenuationLinear) {
      material.attenuationColor.setRGB(
        attenuationColor[0],
        attenuationColor[1],
        attenuationColor[2],
        THREE.LinearSRGBColorSpace
      );
    } else {
      material.attenuationColor.setRGB(
        attenuationColor[0],
        attenuationColor[1],
        attenuationColor[2],
        THREE.SRGBColorSpace
      );
    }
    material.attenuationDistance = Math.max(0.05, optics.attenuationDistanceM);
  }
  material.userData.optical = optics;
  material.userData.opticalRenderAlpha = renderAlpha;
  material.userData.renderDescriptor = descriptor;
  return material;
}

function applySurfaceRenderOrdering(mesh, optics = {}, descriptorOrRow = {}) {
  const layer = renderLayerFromOpticalResponse(optics, descriptorOrRow);
  const order = renderOrderFromOpticalResponse(optics, descriptorOrRow);
  const stableOrder = stableSurfaceRenderOrder(order, surfaceRenderOrderKey(descriptorOrRow));
  mesh.renderOrder = stableOrder;
  mesh.userData.renderLayer = layer;
  mesh.userData.renderOrderBase = order;
  if (mesh.material) {
    mesh.material.depthWrite = renderDepthWriteFromOpticalResponse(optics, descriptorOrRow);
    mesh.material.userData.renderLayer = layer;
    mesh.material.userData.renderOrder = stableOrder;
    mesh.material.userData.renderOrderBase = order;
  }
  return { layer, order: stableOrder, baseOrder: order };
}

function emptyBounds() {
  return {
    min: [Infinity, Infinity, Infinity],
    max: [-Infinity, -Infinity, -Infinity]
  };
}

function expandBounds(bounds, x, y, z) {
  bounds.min[0] = Math.min(bounds.min[0], x);
  bounds.min[1] = Math.min(bounds.min[1], y);
  bounds.min[2] = Math.min(bounds.min[2], z);
  bounds.max[0] = Math.max(bounds.max[0], x);
  bounds.max[1] = Math.max(bounds.max[1], y);
  bounds.max[2] = Math.max(bounds.max[2], z);
}

function estimateSurfaceRadiusM(bounds, count, spacingHintM = 0.25) {
  const hint = Number.isFinite(spacingHintM) && spacingHintM > 0 ? spacingHintM : 0.25;
  if (count <= 1) return hint * 0.8;
  const spans = bounds.max.map((max, index) => Math.max(max - bounds.min[index], hint));
  const occupiedVolumeM3 = spans[0] * spans[1] * spans[2];
  const spacingM = Math.cbrt(occupiedVolumeM3 / Math.max(1, count));
  return clamp(spacingM * 1.65, hint * 0.35, hint * 1.6);
}

function estimateGlobalParticleSpacingM(positionsM, particleCount) {
  if (particleCount <= 1) return null;
  const bounds = emptyBounds();
  for (let i = 0; i < particleCount; i += 1) {
    expandBounds(bounds, positionsM[i * 3], positionsM[i * 3 + 1], positionsM[i * 3 + 2]);
  }
  const spans = bounds.max.map((max, index) => max - bounds.min[index]).filter((span) => span > 1e-9);
  if (!spans.length) return null;
  const occupiedVolumeM3 = spans.reduce((product, span) => product * span, 1);
  const dimensionalCount = Math.max(1, spans.length);
  const densityLength = dimensionalCount === 3
    ? Math.cbrt(occupiedVolumeM3 / particleCount)
    : Math.max(...spans) / Math.max(1, Math.cbrt(particleCount) - 1);
  return Number.isFinite(densityLength) && densityLength > 0 ? densityLength : null;
}

export function createContinuousSurfaceBatches({
  positionsM,
  colorsRgb,
  materials = null,
  boxEdgeM = 10,
  boxDimsM = null,
  smoothingLengthM = null,
  particleSpacingM = null
} = {}) {
  if (!positionsM || !colorsRgb) {
    throw new Error('positionsM and colorsRgb are required for SPH continuous surfaces');
  }
  if (positionsM.length !== colorsRgb.length || positionsM.length % 3 !== 0) {
    throw new Error('positionsM and colorsRgb must be matching vec3 arrays');
  }
  const dims = boxDimsM ?? [boxEdgeM, boxEdgeM, boxEdgeM];
  const refEdgeM = Math.max(dims[0], dims[1], dims[2]);
  const batches = new Map();
  const particleCount = positionsM.length / 3;
  const spacingHintM = (Number.isFinite(particleSpacingM) && particleSpacingM > 0)
    ? particleSpacingM
    : ((Number.isFinite(smoothingLengthM) && smoothingLengthM > 0)
      ? smoothingLengthM
      : (estimateGlobalParticleSpacingM(positionsM, particleCount) ?? 0.25));
  for (let i = 0; i < particleCount; i += 1) {
    const descriptor = renderDescriptorOf(materials?.[i]);
    let batch = batches.get(descriptor.surfaceKey);
    if (!batch) {
      batch = {
        surfaceKey: descriptor.surfaceKey,
        renderKey: descriptor.renderKey,
        material: descriptor.material,
        phase: descriptor.phase,
        opticalState: descriptor.opticalState,
        opticalStateKey: descriptor.opticalStateKey,
        descriptor,
        positionsM: [],
        normalizedPositions: [],
        colorsRgb: [],
        bounds: emptyBounds(),
        count: 0
      };
      batches.set(descriptor.surfaceKey, batch);
    }
    const x = positionsM[i * 3];
    const y = positionsM[i * 3 + 1];
    const z = positionsM[i * 3 + 2];
    batch.positionsM.push(x, y, z);
    // Isotropic mapping: every axis is normalized by the SAME factor (the largest box edge), so a
    // metaball stays spherical in the field. A non-cubic box therefore occupies a sub-region of the
    // [0,1] field cube (the short axes don't fill it) rather than being stretched to fill it — which
    // would deform round blobs into ellipsoids. The mesh scale (below) is the matching scalar.
    const span = 1 - 2 * FIELD_PADDING;
    batch.normalizedPositions.push(
      clamp(FIELD_PADDING + (x / refEdgeM) * span, 0.001, 0.999),
      clamp(FIELD_PADDING + (y / refEdgeM) * span, 0.001, 0.999),
      clamp(FIELD_PADDING + (z / refEdgeM) * span, 0.001, 0.999)
    );
    batch.colorsRgb.push(
      clamp(colorsRgb[i * 3], 0, 1),
      clamp(colorsRgb[i * 3 + 1], 0, 1),
      clamp(colorsRgb[i * 3 + 2], 0, 1)
    );
    expandBounds(batch.bounds, x, y, z);
    batch.count += 1;
  }
  return [...batches.values()].map((batch) => ({
    ...batch,
    surfaceRadiusM: estimateSurfaceRadiusM(batch.bounds, batch.count, spacingHintM)
  }));
}

function materialPropertiesLookup(material, materialProperties) {
  if (!materialProperties || !material) return null;
  return materialProperties[material]
    ?? materialProperties[String(material).toLowerCase()]
    ?? materialProperties[String(material).toUpperCase()]
    ?? null;
}

function phaseFromGpuPhaseId(phaseId) {
  const rounded = Math.round(Number(phaseId) || 0);
  if (rounded === 1) return 'solid';
  if (rounded === 2) return 'liquid';
  if (rounded === 3) return 'gas';
  if (rounded === 4) return 'plasma';
  return null;
}

function phaseForProductInventoryRecord(record, term = null, materialProperties = null) {
  if (record?.routing === 'gas' || term?.routing === 'gas' || record?.routingId === 1) return 'gas';
  const phaseFromId = phaseFromGpuPhaseId(record?.phaseId ?? term?.phaseId ?? term?.targetPhaseId);
  if (phaseFromId) return phaseFromId;
  const properties = materialPropertiesLookup(record?.material ?? term?.material, materialProperties);
  const phases = Array.isArray(properties?.phases) ? properties.phases : [];
  const nonGas = phases.find((phase) => phase?.name && phase.name !== 'gas');
  return nonGas?.name ?? phases[0]?.name ?? 'liquid';
}

function renderKeyForMaterialPhase(material, phase) {
  if (material === 'h2o' && phase === 'solid') return 'ice';
  if (material === 'h2o' && phase === 'gas') return 'steam';
  return material || 'unknown';
}

export function createProductEventSurfaceBatches({
  baseBatches = [],
  reactionSummary = null,
  reactionTable = null,
  materialProperties = null,
  smoothingLengthM = null
} = {}) {
  const records = Array.isArray(reactionSummary?.productInventory?.records)
    ? reactionSummary.productInventory.records
    : [];
  const terms = Array.isArray(reactionTable?.productTermMetadata)
    ? reactionTable.productTermMetadata
    : [];
  const existingKeys = new Set((baseBatches || []).map((batch) => batch.surfaceKey));
  const createdKeys = new Set();
  const batches = [];
  for (const record of records) {
    if (record?.status && record.status !== 'ready') continue;
    if (!(Number(record?.unplacedMassKg) > 0)) continue;
    const term = terms.find((candidate) => candidate.productTermIndex === record.productTermIndex)
      || terms[record.productTermIndex]
      || null;
    const material = record.material || term?.material || null;
    if (!material) continue;
    const phase = phaseForProductInventoryRecord(record, term, materialProperties);
    const renderKey = renderKeyForMaterialPhase(material, phase);
    const descriptor = renderDescriptorOf({ material, phase, renderKey });
    if (existingKeys.has(descriptor.surfaceKey) || createdKeys.has(descriptor.surfaceKey)) continue;
    const properties = materialPropertiesLookup(material, materialProperties);
    const optics = opticalRenderParams(opticalQueryForDescriptor(descriptor, properties));
    const color = optics.baseColorSrgb ?? optics.pbr?.baseColorSrgb ?? [1, 1, 1];
    const count = Math.max(1, Math.round(Number(record.eventCount) || 1));
    const colorsRgb = [];
    for (let i = 0; i < count; i += 1) {
      colorsRgb.push(
        clamp(color[0] ?? 1, 0, 1),
        clamp(color[1] ?? 1, 0, 1),
        clamp(color[2] ?? 1, 0, 1)
      );
    }
    batches.push({
      surfaceKey: descriptor.surfaceKey,
      renderKey,
      material,
      phase,
      opticalState: descriptor.opticalState,
      opticalStateKey: descriptor.opticalStateKey,
      descriptor,
      positionsM: [],
      normalizedPositions: [],
      colorsRgb,
      bounds: emptyBounds(),
      count,
      surfaceRadiusM: (Number.isFinite(smoothingLengthM) && smoothingLengthM > 0)
        ? smoothingLengthM
        : 0.25,
      source: 'reaction-product-event-buffer',
      productTermIndex: record.productTermIndex,
      reactionIndex: record.reactionIndex,
      unplacedMassKg: record.unplacedMassKg,
      eventCount: record.eventCount
    });
    createdKeys.add(descriptor.surfaceKey);
  }
  return batches;
}

export function createOpticalGpuTableForSurfaceBatches(batches, { materialProperties = null } = {}) {
  return buildOpticalGpuTable(batches.map((batch) => ({
    material: batch.material,
    phase: batch.phase ?? opticalQueryForDescriptor(batch.descriptor).phase,
    renderKey: batch.renderKey,
    opticalState: batch.descriptor?.opticalState || null,
    properties: materialPropertiesForSurfaceDescriptor(batch.descriptor, materialProperties)
  })), { materialProperties: materialProperties || {} });
}

export function createOpticalGpuLookupForSurfaceBatches(table, batches) {
  const lookup = buildOpticalGpuLookupQueries(table, batches.map((batch) => ({
    material: batch.material,
    phase: batch.phase ?? opticalQueryForDescriptor(batch.descriptor).phase,
    opticalState: batch.descriptor?.opticalState || null
  })));
  return {
    lookup,
    cpuReference: sampleOpticalGpuTableCpu(table, lookup),
    surfaceKeys: batches.map((batch) => batch.surfaceKey),
    signature: opticalGpuLookupSignature(table, lookup)
  };
}

export function residentSurfaceBatchIdentitySignature(batches = []) {
  if (!Array.isArray(batches) || batches.length === 0) return 'empty';
  return batches
    .map((batch) => {
      const descriptor = batch?.descriptor || batch || {};
      const surfaceKey = batch?.surfaceKey
        || surfaceKeyForDescriptor({
          renderKey: descriptor.renderKey ?? batch?.renderKey,
          material: descriptor.material ?? batch?.material,
          phase: descriptor.phase ?? batch?.phase,
          opticalState: descriptor.opticalState ?? batch?.opticalState ?? null
        });
      return [
        surfaceKey,
        descriptor.renderKey ?? batch?.renderKey ?? 'render-unspecified',
        descriptor.material ?? batch?.material ?? 'material-unspecified',
        descriptor.phase ?? batch?.phase ?? 'phase-unspecified'
      ].join(':');
    })
    .sort()
    .join('|');
}

export function shouldRetainResidentSurfaceDrawOverlay({
  previousSurfaceBatchSignature = null,
  nextSurfaceBatchSignature = null,
  hasResidentSurfaceDraw = false,
  hasResidentRenderBridge = false
} = {}) {
  return Boolean(
    hasResidentSurfaceDraw
    && hasResidentRenderBridge
    && previousSurfaceBatchSignature
    && nextSurfaceBatchSignature
    && previousSurfaceBatchSignature !== 'empty'
    && nextSurfaceBatchSignature !== 'empty'
    && previousSurfaceBatchSignature === nextSurfaceBatchSignature
  );
}

function opticalGpuLookupSignature(table, lookup) {
  return [
    table.recordCount,
    lookup.queryCount,
    Array.from(lookup.queries).join(','),
    Array.from(table.records).join(',')
  ].join('|');
}

export function createSphPhaseScene(container, {
  boxEdgeM = 10,
  boxDimsM = null,
  surfaceRadiusM = null,
  surfaceRadiusScale = 1,
  preferWebGpuOpticalLookup = true,
  navigatorRef = globalThis.navigator
} = {}) {
  const dims = boxDimsM ?? [boxEdgeM, boxEdgeM, boxEdgeM];
  const refEdgeM = Math.max(dims[0], dims[1], dims[2]);
  let radiusScale = surfaceRadiusScale; // mutable so the blob-size control is live (no rebuild)
  const scene = new THREE.Scene();
  // A dark slate background rather than near-black: the ice/water surfaces are physically
  // transmissive (clear), so they take their look from what is behind them — a pure-black void made
  // them read dark. Transmission samples the background render, so lifting it brightens the glassy
  // surfaces without faking opacity.
  scene.background = new THREE.Color(0x18222b);

  const width = container.clientWidth || 800;
  const height = container.clientHeight || 520;
  const camera = new THREE.PerspectiveCamera(46, width / height, 0.05, 500);
  // Aim at the box centre and pull back proportionally to the largest box edge so the whole sealed
  // box (and everything contained in it) is framed, instead of looking at the floor and cropping.
  const center = new THREE.Vector3(dims[0] / 2, dims[1] / 2, dims[2] / 2);
  camera.position.set(center.x + refEdgeM * 0.85, center.y + refEdgeM * 0.55, center.z + refEdgeM * 1.15);

  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(width, height);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;
  container.appendChild(renderer.domElement);

  let pmrem = null;
  let environment = null;
  let environmentRequested = false;
  function scheduleEnvironmentMap() {
    if (environmentRequested || !running) return;
    environmentRequested = true;
    const run = () => {
      if (!running || environment) return;
      pmrem = new THREE.PMREMGenerator(renderer);
      environment = pmrem.fromScene(new RoomEnvironment(), 0.04);
      scene.environment = environment.texture;
    };
    if (typeof window.requestIdleCallback === 'function') {
      window.requestIdleCallback(run, { timeout: 5000 });
    } else {
      window.setTimeout(run, 1500);
    }
  }

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.target.copy(center);

  // Bright, fairly even illumination so the non-emissive surfaces (ice/water) read clearly; a
  // hemisphere light gives a soft sky/ground fill on top of the flat ambient, and two directional
  // lights (key + fill) shape the surfaces without leaving any face in the dark.
  scene.add(new THREE.AmbientLight(0xffffff, 1.4));
  scene.add(new THREE.HemisphereLight(0xddffff, 0x202a30, 0.9));
  const key = new THREE.DirectionalLight(0xffffff, 1.1);
  key.position.set(4, 8, 6);
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xbfe9ff, 0.5);
  fill.position.set(-6, 3, -4);
  scene.add(fill);

  // Sealed-box domain wireframe (the full Lx×Ly×Lz box) + a floor grid sized to the footprint.
  const boxGeom = new THREE.BoxGeometry(dims[0], dims[1], dims[2]);
  const box = new THREE.LineSegments(
    new THREE.EdgesGeometry(boxGeom),
    new THREE.LineBasicMaterial({
      color: 0x36d6a4,
      transparent: true,
      opacity: 0.6,
      depthWrite: false
    })
  );
  box.position.set(dims[0] / 2, dims[1] / 2, dims[2] / 2);
  box.renderOrder = SPH_PHASE_RENDER_ORDER.containerWire;
  box.userData.renderLayer = 'container-wire';
  scene.add(box);
  const gridFootprint = Math.max(dims[0], dims[2]);
  const grid = new THREE.GridHelper(gridFootprint, 20, 0x1d8b6d, 0x0d332b);
  grid.position.set(dims[0] / 2, 0, dims[2] / 2);
  scene.add(grid);

  const surfaces = new Map();
  let opticalGpuTable = buildOpticalGpuTable([]);
  let opticalGpuLookup = createOpticalGpuLookupForSurfaceBatches(opticalGpuTable, []);
  let opticalGpuLookupGeneration = 0;
  let pendingOpticalGpuLookup = null;
  let opticalGpuDeviceResultPromise = null;
  let sphGpuParticleState = null;
  let sphGpuParticleUpload = null;
  let sphGpuParticleUploadSignature = null;
  let pendingSphGpuParticleUpload = null;
  let mlsMpmGpuParticleState = null;
  let mlsMpmGpuParticleUpload = null;
  let mlsMpmGpuParticleUploadSignature = null;
  let pendingMlsMpmGpuParticleUpload = null;
  let mlsMpmMechanicsPrediction = null;
  let mlsMpmMechanicsPredictionSignature = null;
  let pendingMlsMpmMechanicsPrediction = null;
  let mlsMpmP2gGridProjection = null;
  let mlsMpmP2gGridProjectionSignature = null;
  let pendingMlsMpmP2gGridProjection = null;
  let mlsMpmGridUpdate = null;
  let mlsMpmGridUpdateSignature = null;
  let pendingMlsMpmGridUpdate = null;
  let mlsMpmG2pReconstruction = null;
  let mlsMpmG2pReconstructionSignature = null;
  let pendingMlsMpmG2pReconstruction = null;
  let mlsMpmResidentStep = null;
  let mlsMpmResidentStepSignature = null;
  let pendingMlsMpmResidentStep = null;
  let mlsMpmResidentSteps = null;
  let mlsMpmResidentStepsSignature = null;
  let pendingMlsMpmResidentSteps = null;
  let sphThermalMaterialTable = null;
  let sphThermalClosureGraphBuffers = null;
  let sphThermalPhaseResponseTable = null;
  let sphThermalResponseGraphUpload = null;
  let sphThermalResponseGraphUploadSignature = null;
  let pendingSphThermalResponseGraphUpload = null;
  let sphReactionTable = null;
  let currentMaterialProperties = null;
  let sphResidentRenderState = null;
  let sphResidentSurfaceDraw = null;
  let sphResidentSurfaceDrawRenderBridge = null;
  let sphResidentRenderSurfaceState = null;
  let pressureInterfaceForceRowsUpload = null;
  let pressureInterfaceForceRowsUploadSignature = null;
  let currentSurfaceBatchIdentitySignature = 'empty';
  scene.userData.opticalGpuTable = opticalGpuTable;
  scene.userData.opticalGpuLookup = opticalGpuLookup;
  scene.userData.opticalGpuLookupExecution = null;
  scene.userData.opticalGpuLookupDrawState = null;
  scene.userData.sphGpuParticleState = null;
  scene.userData.sphGpuParticleUpload = null;
  scene.userData.mlsMpmGpuParticleState = null;
  scene.userData.mlsMpmGpuParticleUpload = null;
  scene.userData.mlsMpmMechanicsPrediction = null;
  scene.userData.mlsMpmP2gGridProjection = null;
  scene.userData.mlsMpmGridUpdate = null;
  scene.userData.mlsMpmG2pReconstruction = null;
  scene.userData.mlsMpmResidentStep = null;
  scene.userData.mlsMpmResidentSteps = null;
  scene.userData.mlsMpmResidentRequestedReadbackMode = SPH_PHASE_RESIDENT_READBACK_MODE_DEFAULT;
  scene.userData.sphThermalMaterialTable = null;
  scene.userData.sphThermalClosureGraphBuffers = null;
  scene.userData.sphThermalPhaseResponseTable = null;
  scene.userData.sphThermalResponseGraphUpload = null;
  scene.userData.sphReactionTable = null;
  scene.userData.sphResidentRenderState = null;
  scene.userData.sphResidentSurfaceDraw = null;
  scene.userData.sphResidentSurfaceDrawRenderBridge = null;
  scene.userData.sphResidentRenderSurfaceState = null;
  scene.userData.sphPressureInterfaceForceRowsUpload = null;

  function markSurfaceActive(surface) {
    surface.inactiveFrameCount = 0;
    surface.mesh.userData.surfaceInactiveFrameCount = 0;
  }

  function hideSurfaceAfterGrace(surface, renderSource) {
    return hideRenderFieldSurfaceAfterGrace(surface, renderSource);
  }

  function applyOpticalGpuLookupExecution(execution, lookupState = opticalGpuLookup) {
    if (!execution?.outputs) return [];
    const rows = decodeOpticalGpuLookupOutputRows(execution, lookupState.lookup);
    const applied = [];
    for (const row of rows) {
      const surfaceKey = lookupState.surfaceKeys?.[row.queryIndex];
      const surface = surfaceKey ? surfaces.get(surfaceKey) : null;
      if (!surface || row.status === 255 || row.recordIndex < 0) continue;
      const { mesh } = surface;
      const material = mesh.material;
      const descriptor = surface.descriptor || row;
      material.color.setRGB(
        clamp(row.baseColorLinear[0], 0, 1),
        clamp(row.baseColorLinear[1], 0, 1),
        clamp(row.baseColorLinear[2], 0, 1),
        THREE.LinearSRGBColorSpace
      );
      const renderAlpha = renderAlphaFromOpticalResponse(row, descriptor);
      material.opacity = renderAlpha;
      material.transparent = row.transmission > 0.01 || renderAlpha < 0.999;
      material.depthWrite = renderDepthWriteFromOpticalResponse(row, descriptor);
      material.metalness = clamp(row.metalness, 0, 1);
      material.roughness = clamp(row.roughness, 0, 1);
      material.transmission = clamp(row.transmission, 0, 1);
      material.ior = Math.max(1, row.ior || 1);
      material.vertexColors = row.vertexColorPolicyId === 2;
      const ordering = applySurfaceRenderOrdering(mesh, row, descriptor);
      material.needsUpdate = true;
      mesh.userData.opticalGpuLookupOutput = { ...row, renderAlpha };
      mesh.userData.opticalGpuExecutionBackend = execution.backend;
      applied.push({ surfaceKey, row, ordering });
    }
    scene.userData.opticalGpuLookupDrawState = {
      schema: 'peercompute.ulg.optical-gpu-draw-state.v0',
      sourceExecutionSchema: execution.schema,
      backend: execution.backend,
      appliedCount: applied.length,
      rows,
      scientificValidation: false,
      fullPhysicsValidation: false
    };
    return applied;
  }

  function requestCachedOpticalGpuDevice(ref = navigatorRef) {
    if (!opticalGpuDeviceResultPromise) {
      opticalGpuDeviceResultPromise = requestOpticalGpuDevice(ref).then((result) => {
        if (result.device?.lost?.then) {
          result.device.lost.finally(() => {
            if (opticalGpuDeviceResultPromise) opticalGpuDeviceResultPromise = null;
          }).catch(() => {});
        }
        return result;
      }).catch((error) => {
        opticalGpuDeviceResultPromise = null;
        return {
          status: 'webgpu-error-fallback',
          reason: error instanceof Error ? error.message : String(error),
          device: null
        };
      });
    }
    return opticalGpuDeviceResultPromise;
  }

  async function refreshOpticalGpuLookup({
    preferWebGpu = preferWebGpuOpticalLookup,
    force = false,
    navigatorRef: overrideNavigatorRef = navigatorRef,
    device = null,
    deviceResult = null,
    parityTolerance = 1e-6,
    webGpuRunner = undefined
  } = {}) {
    const generation = opticalGpuLookupGeneration;
    const currentTable = opticalGpuTable;
    const currentLookup = opticalGpuLookup;
    const signature = currentLookup.signature;
    if (
      !force
      && currentLookup.execution?.signature === signature
    ) {
      return currentLookup;
    }
    if (!force && pendingOpticalGpuLookup?.signature === signature) {
      return pendingOpticalGpuLookup.promise;
    }
    const promise = (async () => {
      const resolvedDeviceResult = preferWebGpu && !device && !deviceResult
        ? await requestCachedOpticalGpuDevice(overrideNavigatorRef)
        : deviceResult;
      const execution = await runOpticalGpuLookupWithOptionalWebGpu({
        table: currentTable,
        lookup: currentLookup.lookup,
        cpuReference: currentLookup.cpuReference,
        preferWebGpu,
        navigatorRef: overrideNavigatorRef,
        device,
        deviceResult: resolvedDeviceResult,
        parityTolerance,
        webGpuRunner,
        onDeviceLost() {
          opticalGpuDeviceResultPromise = null;
        }
      });
      execution.signature = signature;
      if (!running || generation !== opticalGpuLookupGeneration || opticalGpuLookup.signature !== signature) {
        return {
          ...currentLookup,
          execution: {
            ...execution,
            stale: true
          }
        };
      }
      opticalGpuLookup = {
        ...currentLookup,
        execution
      };
      scene.userData.opticalGpuLookup = opticalGpuLookup;
      scene.userData.opticalGpuLookupExecution = execution;
      applyOpticalGpuLookupExecution(execution, opticalGpuLookup);
      return opticalGpuLookup;
    })();
    pendingOpticalGpuLookup = { signature, promise };
    try {
      return await promise;
    } finally {
      if (pendingOpticalGpuLookup?.promise === promise) pendingOpticalGpuLookup = null;
    }
  }

  function sphGpuParticleSignature(packed) {
    if (!packed) return null;
    return [
      packed.particleCount,
      packed.step,
      packed.time,
      packed.state?.byteLength ?? 0,
      packed.thermo?.byteLength ?? 0
    ].join('|');
  }

  function mlsMpmGpuParticleSignature(packed) {
    if (!packed) return null;
    return [
      packed.particleCount,
      packed.step,
      packed.time,
      packed.mechanics?.byteLength ?? 0,
      packed.mechanicsDtS ?? 0,
      packed.mechanicalSubsteps ?? 1,
      packed.soundSpeedScale ?? 0,
      packed.minGasSoundSpeedMPerS ?? 0
    ].join('|');
  }

  function sphReactionTableSignature(table = sphReactionTable) {
    if (!table) return 'no-reaction-table';
    return [
      table.reactionCount ?? 0,
      table.reactionHeaderCount ?? 0,
      table.reactantTermCount ?? 0,
      table.productTermCount ?? 0,
      table.gasProductCount ?? 0,
      table.atomTermCount ?? 0,
      table.productPhaseCount ?? 0,
      Array.from(table.records || []).join(','),
      Array.from(table.productPhaseRecords || []).join(','),
      Array.from(table.reactionHeaders || []).join(','),
      Array.from(table.reactantTermRecords || []).join(','),
      Array.from(table.productTermRecords || []).join(','),
      Array.from(table.gasProductRecords || []).join(','),
      Array.from(table.atomTermRecords || []).join(',')
    ].join('|');
  }

  function pressureInterfaceForceSolverSignature(solver = sphResidentRenderState?.pressureInterfaceForceSolver) {
    if (!solver?.schema) return 'no-pressure-interface-force-solver';
    const rows = solver.forceRowValues instanceof Float32Array
      ? solver.forceRowValues
      : (solver.forceRows instanceof Float32Array ? solver.forceRows : null);
    return [
      solver.schema,
      solver.status ?? null,
      solver.forceCouplingStatus ?? null,
      solver.forceApplicationStatus ?? null,
      solver.forceRowCount ?? 0,
      solver.conservationStatus ?? null,
      solver.conservationResidualMagnitudeN ?? 0,
      rows ? Array.from(rows).join(',') : 'no-force-rows'
    ].join('|');
  }

  function pressureInterfaceForceRowsFromSolver(solver = null) {
    if (solver?.forceRowValues instanceof Float32Array) return solver.forceRowValues;
    if (solver?.forceRows instanceof Float32Array) return solver.forceRows;
    return null;
  }

  function destroyPressureInterfaceForceRowsUpload() {
    pressureInterfaceForceRowsUpload?.buffer?.destroy?.();
    pressureInterfaceForceRowsUpload = null;
    pressureInterfaceForceRowsUploadSignature = null;
    scene.userData.sphPressureInterfaceForceRowsUpload = null;
    if (sphResidentRenderState) {
      sphResidentRenderState.pressureInterfaceForceRowsUploadStatus = null;
      sphResidentRenderState.pressureInterfaceForceRowsBufferRetained = false;
      sphResidentRenderState.pressureInterfaceForceRowsBufferByteLength = 0;
      sphResidentRenderState.pressureInterfaceForceRowsUploadSignature = null;
    }
  }

  function publishPressureInterfaceForceRowsUpload(upload = pressureInterfaceForceRowsUpload) {
    scene.userData.sphPressureInterfaceForceRowsUpload = upload;
    if (!sphResidentRenderState) return;
    sphResidentRenderState.pressureInterfaceForceRowsUploadStatus = upload?.status ?? null;
    sphResidentRenderState.pressureInterfaceForceRowsBufferRetained = Boolean(upload?.bufferRetained);
    sphResidentRenderState.pressureInterfaceForceRowsBufferByteLength = upload?.forceRowByteLength ?? 0;
    sphResidentRenderState.pressureInterfaceForceRowsUploadSignature = upload?.signature ?? null;
  }

  function uploadPressureInterfaceForceRowsBuffer({
    pressureInterfaceForceSolver = sphResidentRenderState?.pressureInterfaceForceSolver ?? null,
    device = null,
    retainInScene = true
  } = {}) {
    const rows = pressureInterfaceForceRowsFromSolver(pressureInterfaceForceSolver);
    const forceRowCount = Math.max(0, Math.round(Number(pressureInterfaceForceSolver?.forceRowCount) || 0));
    if (
      !device?.createBuffer
      || !device.queue?.writeBuffer
      || !(rows instanceof Float32Array)
      || forceRowCount <= 0
      || rows.byteLength <= 0
    ) {
      if (retainInScene) destroyPressureInterfaceForceRowsUpload();
      return null;
    }
    const signature = pressureInterfaceForceSolverSignature(pressureInterfaceForceSolver);
    if (
      retainInScene
      &&
      pressureInterfaceForceRowsUpload
      && pressureInterfaceForceRowsUploadSignature === signature
      && pressureInterfaceForceRowsUpload.buffer
    ) {
      publishPressureInterfaceForceRowsUpload(pressureInterfaceForceRowsUpload);
      return pressureInterfaceForceRowsUpload;
    }
    if (retainInScene) destroyPressureInterfaceForceRowsUpload();
    const buffer = device.createBuffer({
      label: 'ulg-sph-pressure-interface-force-rows',
      size: Math.max(4, rows.byteLength),
      usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_DST
    });
    device.queue.writeBuffer(buffer, 0, rows);
    const upload = {
      schema: 'peercompute.ulg.sph-pressure-interface-force-rows-upload.v0',
      status: 'webgpu-pressure-interface-force-rows-uploaded',
      sourceSchema: pressureInterfaceForceSolver.schema,
      forceSolverStatus: pressureInterfaceForceSolver.status ?? null,
      forceRowCount,
      forceRowStrideFloats: pressureInterfaceForceSolver.forceRowStrideFloats ?? null,
      forceRowByteLength: rows.byteLength,
      buffer,
      bufferRetained: true,
      signature,
      scientificValidation: false,
      gasValidation: false,
      sphValidation: false,
      fullPhysicsValidation: false,
      destroy() {
        buffer.destroy?.();
      }
    };
    if (!retainInScene) return upload;
    pressureInterfaceForceRowsUpload = upload;
    pressureInterfaceForceRowsUploadSignature = signature;
    publishPressureInterfaceForceRowsUpload(pressureInterfaceForceRowsUpload);
    return pressureInterfaceForceRowsUpload;
  }

  function sphThermalResponseGraphSignature({
    thermalMaterialTable = sphThermalMaterialTable,
    thermalClosureGraphBuffers = sphThermalClosureGraphBuffers,
    thermalPhaseResponseTable = sphThermalPhaseResponseTable
  } = {}) {
    const graphBank = thermalClosureGraphBuffers?.graphBank;
    if (!thermalMaterialTable || !graphBank || !thermalPhaseResponseTable) return null;
    return [
      thermalMaterialTable.materialCount ?? 0,
      thermalMaterialTable.segmentCount ?? 0,
      thermalPhaseResponseTable.materialCount ?? 0,
      thermalPhaseResponseTable.responseCount ?? 0,
      graphBank.graphCount ?? 0,
      graphBank.nodeCount ?? 0,
      graphBank.sampleCount ?? 0,
      Array.from(thermalPhaseResponseTable.records || []).join(','),
      Array.from(thermalPhaseResponseTable.responses || []).join(','),
      Array.from(graphBank.nodeRows || []).join(','),
      Array.from(graphBank.sampleRows || []).join(',')
    ].join('|');
  }

  function mlsMpmMechanicsPredictionSignatureFor({
    sphParticleState = sphGpuParticleState,
    mlsMpmParticleState = mlsMpmGpuParticleState,
    dt = 4e-4,
    gravityMPerS2 = [0, -9.80665, 0]
  } = {}) {
    const sphSignature = sphGpuParticleSignature(sphParticleState);
    const mlsSignature = mlsMpmGpuParticleSignature(mlsMpmParticleState);
    if (!sphSignature || !mlsSignature) return null;
    return [
      sphSignature,
      mlsSignature,
      dt,
      gravityMPerS2.join(','),
      dims.join(',')
    ].join('|');
  }

  function mlsMpmP2gGridProjectionSignatureFor({
    sphParticleState = sphGpuParticleState,
    mlsMpmParticleState = mlsMpmGpuParticleState,
    gridSpacingM = sphGpuParticleState?.smoothingLengthM ?? 0
  } = {}) {
    const sphSignature = sphGpuParticleSignature(sphParticleState);
    const mlsSignature = mlsMpmGpuParticleSignature(mlsMpmParticleState);
    if (!sphSignature || !mlsSignature) return null;
    return [
      sphSignature,
      mlsSignature,
      gridSpacingM,
      dims.join(',')
    ].join('|');
  }

  function mlsMpmGridUpdateSignatureFor({
    p2gGridProjection = mlsMpmP2gGridProjection,
    dt = mlsMpmGpuParticleState?.mechanicsDtS ?? p2gGridProjection?.dt ?? 0,
    gravityMPerS2 = mlsMpmGpuParticleState?.gravityMPerS2 ?? [0, -9.80665, 0],
    cflFactor = mlsMpmGpuParticleState?.gridCflFactor || 0.6,
    pressureInterfaceForceSolver = null
  } = {}) {
    if (!p2gGridProjection?.schema) return null;
    return [
      p2gGridProjection.signature ?? [
        p2gGridProjection.schema,
        p2gGridProjection.backend,
        p2gGridProjection.gridNodeCount,
        p2gGridProjection.gridSpacingM,
        p2gGridProjection.dt ?? 0
      ].join(':'),
      dt,
      gravityMPerS2.join(','),
      cflFactor,
      pressureInterfaceForceSolverSignature(pressureInterfaceForceSolver),
      dims.join(',')
    ].join('|');
  }

  function mlsMpmG2pReconstructionSignatureFor({
    sphParticleState = sphGpuParticleState,
    mlsMpmParticleState = mlsMpmGpuParticleState,
    gridUpdate = mlsMpmGridUpdate,
    dt = gridUpdate?.dt ?? mlsMpmParticleState?.mechanicsDtS ?? 0
  } = {}) {
    const sphSignature = sphGpuParticleSignature(sphParticleState);
    const mlsSignature = mlsMpmGpuParticleSignature(mlsMpmParticleState);
    if (!sphSignature || !mlsSignature || !gridUpdate?.schema) return null;
    return [
      sphSignature,
      mlsSignature,
      gridUpdate.signature ?? `${gridUpdate.schema}|${gridUpdate.backend}|${gridUpdate.gridNodeCount}|${gridUpdate.dt ?? 0}`,
      dt,
      dims.join(',')
    ].join('|');
  }

  function mlsMpmResidentStepSignatureFor({
    sphParticleState = sphGpuParticleState,
    mlsMpmParticleState = mlsMpmGpuParticleState,
    gridSpacingM = sphParticleState?.smoothingLengthM ?? 0,
    dt = mlsMpmParticleState?.mechanicsDtS ?? 0,
    gravityMPerS2 = mlsMpmParticleState?.gravityMPerS2 ?? [0, -9.80665, 0],
    cflFactor = mlsMpmParticleState?.gridCflFactor || 0.6,
    readbackMode = SPH_PHASE_RESIDENT_READBACK_MODE_DEFAULT,
    pressureInterfaceForceSolver = null
  } = {}) {
    const sphSignature = sphGpuParticleSignature(sphParticleState);
    const mlsSignature = mlsMpmGpuParticleSignature(mlsMpmParticleState);
    if (!sphSignature || !mlsSignature) return null;
    const normalizedReadbackMode = normalizeResidentReadbackMode(readbackMode);
    return [
      sphSignature,
      mlsSignature,
      gridSpacingM,
      dt,
      gravityMPerS2.join(','),
      cflFactor,
      normalizedReadbackMode,
      sphReactionTableSignature(),
      pressureInterfaceForceSolverSignature(pressureInterfaceForceSolver),
      dims.join(',')
    ].join('|');
  }

  function normalizeResidentStepCount(value) {
    const count = Number(value);
    return Number.isFinite(count) ? Math.max(1, Math.round(count)) : 1;
  }

  function mlsMpmResidentStepsSignatureFor({
    stepCount = 1,
    retainIntermediateSteps = false,
    residentSourceMode = 'cpu-packed-state',
    ...args
  } = {}) {
    const stepSignature = mlsMpmResidentStepSignatureFor(args);
    if (!stepSignature) return null;
    return [
      stepSignature,
      normalizeResidentStepCount(stepCount),
      Boolean(retainIntermediateSteps),
      residentSourceMode
    ].join('|');
  }

  function clearMlsMpmResidentExecutionArtifacts() {
    if (mlsMpmResidentSteps) {
      destroyMlsMpmResidentStepsBuffers(mlsMpmResidentSteps);
    } else {
      mlsMpmP2gGridProjection?.gpuResult?.destroyGridBuffer?.();
      mlsMpmP2gGridProjection?.destroyGridBuffer?.();
      mlsMpmGridUpdate?.gpuResult?.destroyUpdatedGridBuffer?.();
      mlsMpmGridUpdate?.destroyUpdatedGridBuffer?.();
      if (mlsMpmG2pReconstruction?.destroyOutputParticleBuffers) {
        mlsMpmG2pReconstruction.destroyOutputParticleBuffers();
      } else {
        mlsMpmG2pReconstruction?.gpuResult?.destroyOutputParticleBuffers?.();
      }
    }
    mlsMpmP2gGridProjection = null;
    mlsMpmP2gGridProjectionSignature = null;
    scene.userData.mlsMpmP2gGridProjection = null;
    mlsMpmGridUpdate = null;
    mlsMpmGridUpdateSignature = null;
    scene.userData.mlsMpmGridUpdate = null;
    mlsMpmG2pReconstruction = null;
    mlsMpmG2pReconstructionSignature = null;
    scene.userData.mlsMpmG2pReconstruction = null;
    mlsMpmResidentStep = null;
    mlsMpmResidentStepSignature = null;
    scene.userData.mlsMpmResidentStep = null;
    mlsMpmResidentSteps = null;
    mlsMpmResidentStepsSignature = null;
    scene.userData.mlsMpmResidentSteps = null;
  }

  function releaseSphResidentSurfaceDrawResources({
    surfaceDraw = null,
    renderBridge = null,
    clearOverlay = false,
    removeCanvas = false,
    status = 'surface-draw-overlay-resources-released'
  } = {}) {
    if (renderBridge) {
      if (clearOverlay) clearSphResidentSurfaceDrawOverlayCanvas(renderBridge);
      renderBridge.cameraBuffer?.destroy?.();
      renderBridge.opticalGpuBuffers?.recordsBuffer?.destroy?.();
      renderBridge.opticalGpuBuffers?.spectralSamplesBuffer?.destroy?.();
      renderBridge.depthTexture?.destroy?.();
      renderBridge.oitAccumTexture?.destroy?.();
      renderBridge.oitRevealTexture?.destroy?.();
      renderBridge.drawState = null;
      renderBridge.cameraBuffer = null;
      renderBridge.opticalGpuBuffers = null;
      renderBridge.depthTexture = null;
      renderBridge.oitAccumTexture = null;
      renderBridge.oitRevealTexture = null;
      renderBridge.status = status;
      renderBridge.lastRenderStatus = status;
      if (removeCanvas && renderBridge.canvas?.parentNode) {
        renderBridge.canvas.parentNode.removeChild(renderBridge.canvas);
      }
      if (renderBridge === sphResidentSurfaceDrawRenderBridge) {
        scene.userData.sphResidentSurfaceDrawRenderBridge = renderBridge;
      }
    }
    surfaceDraw?.surfaceDraw?.destroySurfaceDrawBuffers?.();
  }

  function releasePreviousSphResidentSurfaceDrawResources(previousSurfaceDraw, previousRenderBridge) {
    if (!previousSurfaceDraw && !previousRenderBridge) return;
    if (
      previousSurfaceDraw === sphResidentSurfaceDraw
      && previousRenderBridge === sphResidentSurfaceDrawRenderBridge
    ) {
      return;
    }
    releaseSphResidentSurfaceDrawResources({
      surfaceDraw: previousSurfaceDraw,
      renderBridge: previousRenderBridge,
      clearOverlay: false,
      status: 'surface-draw-overlay-swapped-out'
    });
  }

  function retainedPreviousSurfaceDrawOverlay(surfaceDraw, renderBridge, reason) {
    if (!surfaceDraw || !renderBridge?.drawState) return surfaceDraw;
    return {
      ...surfaceDraw,
      visibleRendererBridge: renderBridge.rendererBridge || 'webgpu-storage-indirect-overlay',
      visibleRenderSource: 'retained-previous-resident-surface-draw-buffers',
      renderBridgeSchema: renderBridge.schema ?? surfaceDraw.renderBridgeSchema ?? null,
      renderBridgeStatus: 'retained-previous-webgpu-storage-indirect-overlay',
      renderBridgeReason: reason || surfaceDraw.reason || renderBridge.reason || null,
      renderBridgeFrameCount: renderBridge.frameCount ?? 0,
      renderBridgeLastRenderStatus: renderBridge.lastRenderStatus ?? null,
      renderBridgeDrawOrderingPolicy: renderBridge.drawOrderingPolicy ?? null,
      renderBridgeDrawOrderCount: renderBridge.drawOrderCount ?? 0,
      renderBridgeDrawOrderSurfaceIndices: [...(renderBridge.drawOrderSurfaceIndices || [])],
      renderBridgeDrawOrderIndirectOffsets: [...(renderBridge.drawOrderIndirectOffsets || [])],
      renderBridgeDepthPolicy: renderBridge.depthPolicy ?? null,
      renderBridgeDepthAttachmentFormat: renderBridge.depthAttachmentFormat ?? null,
      renderBridgeDepthAttachmentReady: Boolean(renderBridge.depthAttachmentReady),
      renderBridgeTransparencyCompositeMode: renderBridge.lastTransparentCompositeMode
        || renderBridge.transparencyCompositeMode
        || null,
      renderBridgeOitAccumFormat: renderBridge.oitAccumFormat ?? null,
      renderBridgeOitRevealFormat: renderBridge.oitRevealFormat ?? null,
      renderBridgeOitTargetsReady: Boolean(renderBridge.oitTargetsReady),
      renderBridgeLastOpaqueDrawCount: renderBridge.lastOpaqueDrawCount ?? 0,
      renderBridgeLastTransparentDrawCount: renderBridge.lastTransparentDrawCount ?? 0,
      renderBridgeOpticalRenderSource: renderBridge.opticalRenderSource ?? null,
      renderBridgeOpticalRecordCount: renderBridge.opticalRecordCount ?? 0,
      renderBridgeOpticalRecordStrideFloats: renderBridge.opticalRecordStrideFloats ?? 0,
      renderBridgeOpticalSpectralSampleCount: renderBridge.opticalSpectralSampleCount ?? 0,
      renderBridgeOpticalSpectralSampleStrideFloats: renderBridge.opticalSpectralSampleStrideFloats ?? 0,
      renderBridgeTemporalSwapPolicy: SPH_RESIDENT_SURFACE_DRAW_TEMPORAL_SWAP_POLICY,
      renderBridgeRetainedPreviousOverlay: true
    };
  }

  function markSphResidentSurfaceDrawOverlayRetained(reason) {
    if (sphResidentSurfaceDrawRenderBridge?.drawState) {
      sphResidentSurfaceDrawRenderBridge.temporalSwapPolicy = SPH_RESIDENT_SURFACE_DRAW_TEMPORAL_SWAP_POLICY;
      sphResidentSurfaceDrawRenderBridge.retainedPreviousOverlay = true;
      sphResidentSurfaceDrawRenderBridge.retentionReason = reason;
      scene.userData.sphResidentSurfaceDrawRenderBridge = sphResidentSurfaceDrawRenderBridge;
    }
    if (sphResidentSurfaceDraw) {
      sphResidentSurfaceDraw = retainedPreviousSurfaceDrawOverlay(
        sphResidentSurfaceDraw,
        sphResidentSurfaceDrawRenderBridge,
        reason
      );
      scene.userData.sphResidentSurfaceDraw = sphResidentSurfaceDraw;
    }
  }

  function clearSphResidentSurfaceDrawArtifacts({ clearOverlay = true, removeCanvas = false } = {}) {
    releaseSphResidentSurfaceDrawResources({
      surfaceDraw: sphResidentSurfaceDraw,
      renderBridge: sphResidentSurfaceDrawRenderBridge,
      clearOverlay,
      removeCanvas,
      status: clearOverlay ? 'surface-draw-overlay-cleared' : 'surface-draw-overlay-resources-released'
    });
    sphResidentSurfaceDraw = null;
    scene.userData.sphResidentSurfaceDraw = null;
    if (removeCanvas) {
      sphResidentSurfaceDrawRenderBridge = null;
      scene.userData.sphResidentSurfaceDrawRenderBridge = null;
    }
  }

  function clearSphResidentSurfaceDrawOverlayCanvas(bridge = sphResidentSurfaceDrawRenderBridge) {
    try {
      if (!bridge?.device || !bridge?.context) return;
      resizeSphResidentSurfaceDrawOverlayCanvas(bridge);
      const encoder = bridge.device.createCommandEncoder({ label: 'ulg-sph-resident-surface-draw-overlay-clear' });
      const pass = encoder.beginRenderPass({
        colorAttachments: [{
          view: bridge.context.getCurrentTexture().createView(),
          clearValue: { r: 0, g: 0, b: 0, a: 0 },
          loadOp: 'clear',
          storeOp: 'store'
        }]
      });
      pass.end();
      bridge.device.queue.submit([encoder.finish()]);
    } catch {
      // Clearing the optional overlay is best-effort; the WebGL fallback remains authoritative.
    }
  }

  function ensureSphResidentSurfaceDrawOverlayCanvas() {
    const existing = sphResidentSurfaceDrawRenderBridge?.canvas;
    if (existing) return existing;
    if (typeof container.ownerDocument?.createElement !== 'function') return null;
    const canvas = container.ownerDocument.createElement('canvas');
    canvas.setAttribute('aria-hidden', 'true');
    canvas.style.position = 'absolute';
    canvas.style.inset = '0';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.pointerEvents = 'none';
    canvas.style.zIndex = '2';
    container.appendChild(canvas);
    return canvas;
  }

  function resizeSphResidentSurfaceDrawOverlayCanvas(bridge = sphResidentSurfaceDrawRenderBridge) {
    if (!bridge?.canvas) return;
    const w = container.clientWidth || width;
    const h = container.clientHeight || height;
    const pixelRatio = Math.min(globalThis.devicePixelRatio || 1, 2);
    const pixelWidth = Math.max(1, Math.floor(w * pixelRatio));
    const pixelHeight = Math.max(1, Math.floor(h * pixelRatio));
    if (bridge.canvas.width !== pixelWidth) bridge.canvas.width = pixelWidth;
    if (bridge.canvas.height !== pixelHeight) bridge.canvas.height = pixelHeight;
  }

  function ensureSphResidentSurfaceDrawDepthView(bridge = sphResidentSurfaceDrawRenderBridge) {
    if (!bridge?.device || !bridge?.canvas) return null;
    const widthPx = bridge.canvas.width || 1;
    const heightPx = bridge.canvas.height || 1;
    if (
      bridge.depthTexture
      && bridge.depthTextureWidth === widthPx
      && bridge.depthTextureHeight === heightPx
    ) {
      return bridge.depthTexture.createView();
    }
    bridge.depthTexture?.destroy?.();
    bridge.depthTexture = bridge.device.createTexture({
      label: 'ulg-sph-resident-surface-draw-depth',
      size: [widthPx, heightPx],
      format: SPH_RESIDENT_SURFACE_DRAW_DEPTH_FORMAT,
      usage: GPU_TEXTURE_USAGE.RENDER_ATTACHMENT
    });
    bridge.depthTextureWidth = widthPx;
    bridge.depthTextureHeight = heightPx;
    bridge.depthAttachmentReady = true;
    return bridge.depthTexture.createView();
  }

  function ensureSphResidentSurfaceDrawOitTargets(bridge = sphResidentSurfaceDrawRenderBridge) {
    if (!bridge?.device || !bridge?.canvas) return null;
    const widthPx = bridge.canvas.width || 1;
    const heightPx = bridge.canvas.height || 1;
    if (
      bridge.oitAccumTexture
      && bridge.oitRevealTexture
      && bridge.oitWidth === widthPx
      && bridge.oitHeight === heightPx
    ) {
      return {
        accumView: bridge.oitAccumTexture.createView(),
        revealView: bridge.oitRevealTexture.createView()
      };
    }
    bridge.oitAccumTexture?.destroy?.();
    bridge.oitRevealTexture?.destroy?.();
    bridge.oitAccumTexture = bridge.device.createTexture({
      label: 'ulg-sph-resident-surface-draw-oit-accum',
      size: [widthPx, heightPx],
      format: SPH_RESIDENT_SURFACE_DRAW_OIT_ACCUM_FORMAT,
      usage: GPU_TEXTURE_USAGE.RENDER_ATTACHMENT | GPU_TEXTURE_USAGE.TEXTURE_BINDING
    });
    bridge.oitRevealTexture = bridge.device.createTexture({
      label: 'ulg-sph-resident-surface-draw-oit-reveal',
      size: [widthPx, heightPx],
      format: SPH_RESIDENT_SURFACE_DRAW_OIT_REVEAL_FORMAT,
      usage: GPU_TEXTURE_USAGE.RENDER_ATTACHMENT | GPU_TEXTURE_USAGE.TEXTURE_BINDING
    });
    bridge.oitWidth = widthPx;
    bridge.oitHeight = heightPx;
    bridge.oitTargetsReady = true;
    return {
      accumView: bridge.oitAccumTexture.createView(),
      revealView: bridge.oitRevealTexture.createView()
    };
  }

  function createSphResidentSurfaceDrawRenderBridge({
    device,
    surfaceDrawExecution
  } = {}) {
    if (!SPH_RAW_WEBGPU_SURFACE_OVERLAY_ENABLED) {
      return {
        schema: 'peercompute.ulg.sph-resident-surface-draw-render-bridge.v0',
        status: 'surface-draw-overlay-disabled',
        reason: SPH_THREE_WEBGPU_BINDING_REASON,
        rendererBridge: 'pending-three-webgpu-binding',
        visibleRenderSource: 'three-marching-cubes-fallback',
        scientificValidation: false,
        sphValidation: false,
        surfaceExtractionValidation: false,
        fullPhysicsValidation: false
      };
    }
    try {
      const gpu = navigatorRef?.gpu || globalThis.navigator?.gpu;
      if (!device?.createRenderPipeline || !surfaceDrawExecution?.compactedVertexRowsBuffer || !surfaceDrawExecution?.drawIndirectRowsBuffer) {
        return { status: 'surface-draw-overlay-unavailable', reason: 'retained compact vertex and indirect buffers are required' };
      }
      const canvas = ensureSphResidentSurfaceDrawOverlayCanvas();
      const context = canvas?.getContext?.('webgpu');
      if (!canvas || !context || !gpu?.getPreferredCanvasFormat) {
        return { status: 'surface-draw-overlay-unavailable', reason: 'WebGPU canvas context unavailable' };
      }
      const format = gpu.getPreferredCanvasFormat();
      resizeSphResidentSurfaceDrawOverlayCanvas({ canvas });
      context.configure({
        device,
        format,
        usage: GPU_TEXTURE_USAGE.RENDER_ATTACHMENT,
        alphaMode: 'premultiplied'
      });
      const module = device.createShaderModule({
        label: 'ulg-sph-resident-surface-draw-overlay',
        code: SPH_RESIDENT_SURFACE_DRAW_OVERLAY_WGSL
      });
      const oitCompositeModule = device.createShaderModule({
        label: 'ulg-sph-resident-surface-draw-oit-composite',
        code: SPH_RESIDENT_SURFACE_DRAW_OIT_COMPOSITE_WGSL
      });
      const bridgeOpticalGpuTable = opticalGpuTable?.recordCount > 0
        ? opticalGpuTable
        : buildOpticalGpuTable([{ material: 'unknown', phase: 'unknown' }], {
            materialProperties: currentMaterialProperties || {}
          });
      const opticalGpuBuffers = uploadOpticalGpuTable(device, bridgeOpticalGpuTable);
      const bindGroupLayout = device.createBindGroupLayout({
        label: 'ulg-sph-resident-surface-draw-overlay-bind-group-layout',
        entries: [
          {
            binding: 0,
            visibility: GPU_SHADER_STAGE.VERTEX,
            buffer: { type: 'read-only-storage' }
          },
          {
            binding: 1,
            visibility: GPU_SHADER_STAGE.VERTEX,
            buffer: { type: 'uniform' }
          },
          {
            binding: 2,
            visibility: GPU_SHADER_STAGE.FRAGMENT,
            buffer: { type: 'read-only-storage' }
          },
          {
            binding: 3,
            visibility: GPU_SHADER_STAGE.FRAGMENT,
            buffer: { type: 'read-only-storage' }
          }
        ]
      });
      const pipelineLayout = device.createPipelineLayout({
        label: 'ulg-sph-resident-surface-draw-overlay-pipeline-layout',
        bindGroupLayouts: [bindGroupLayout]
      });
      const createOverlayPipeline = ({
        label,
        depthWriteEnabled,
        fragmentEntryPoint = 'fs_main',
        targets = [{
          format,
          blend: {
            color: {
              srcFactor: 'one',
              dstFactor: 'one-minus-src-alpha',
              operation: 'add'
            },
            alpha: {
              srcFactor: 'one',
              dstFactor: 'one-minus-src-alpha',
              operation: 'add'
            }
          }
        }]
      }) => device.createRenderPipeline({
        label,
        layout: pipelineLayout,
        vertex: {
          module,
          entryPoint: 'vs_main'
        },
        fragment: {
          module,
          entryPoint: fragmentEntryPoint,
          targets
        },
        primitive: {
          topology: 'triangle-list',
          cullMode: 'none'
        },
        depthStencil: {
          format: SPH_RESIDENT_SURFACE_DRAW_DEPTH_FORMAT,
          depthWriteEnabled,
          depthCompare: 'less-equal'
        }
      });
      const opaquePipeline = createOverlayPipeline({
        label: 'ulg-sph-resident-surface-draw-overlay-opaque-depth',
        depthWriteEnabled: true
      });
      const transparentPipeline = createOverlayPipeline({
        label: 'ulg-sph-resident-surface-draw-overlay-transparent-depth-test',
        depthWriteEnabled: false
      });
      const transparentOitPipeline = createOverlayPipeline({
        label: 'ulg-sph-resident-surface-draw-overlay-transparent-oit',
        depthWriteEnabled: false,
        fragmentEntryPoint: 'fs_oit_main',
        targets: [
          {
            format: SPH_RESIDENT_SURFACE_DRAW_OIT_ACCUM_FORMAT,
            blend: {
              color: { srcFactor: 'one', dstFactor: 'one', operation: 'add' },
              alpha: { srcFactor: 'one', dstFactor: 'one', operation: 'add' }
            }
          },
          {
            format: SPH_RESIDENT_SURFACE_DRAW_OIT_REVEAL_FORMAT,
            blend: {
              color: { srcFactor: 'zero', dstFactor: 'one-minus-src-alpha', operation: 'add' },
              alpha: { srcFactor: 'zero', dstFactor: 'one-minus-src-alpha', operation: 'add' }
            }
          }
        ]
      });
      const oitCompositeBindGroupLayout = device.createBindGroupLayout({
        label: 'ulg-sph-resident-surface-draw-oit-composite-bind-group-layout',
        entries: [
          {
            binding: 0,
            visibility: GPU_SHADER_STAGE.FRAGMENT,
            texture: { sampleType: 'float' }
          },
          {
            binding: 1,
            visibility: GPU_SHADER_STAGE.FRAGMENT,
            texture: { sampleType: 'float' }
          },
          {
            binding: 2,
            visibility: GPU_SHADER_STAGE.FRAGMENT,
            sampler: { type: 'filtering' }
          }
        ]
      });
      const oitCompositePipelineLayout = device.createPipelineLayout({
        label: 'ulg-sph-resident-surface-draw-oit-composite-pipeline-layout',
        bindGroupLayouts: [oitCompositeBindGroupLayout]
      });
      const oitCompositePipeline = device.createRenderPipeline({
        label: 'ulg-sph-resident-surface-draw-oit-composite-pipeline',
        layout: oitCompositePipelineLayout,
        vertex: {
          module: oitCompositeModule,
          entryPoint: 'vs_main'
        },
        fragment: {
          module: oitCompositeModule,
          entryPoint: 'fs_main',
          targets: [{
            format,
            blend: {
              color: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha', operation: 'add' },
              alpha: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha', operation: 'add' }
            }
          }]
        },
        primitive: {
          topology: 'triangle-list',
          cullMode: 'none'
        }
      });
      const oitSampler = device.createSampler({
        label: 'ulg-sph-resident-surface-draw-oit-sampler',
        magFilter: 'linear',
        minFilter: 'linear'
      });
      const cameraBuffer = device.createBuffer({
        label: 'ulg-sph-resident-surface-draw-camera',
        size: 16 * Float32Array.BYTES_PER_ELEMENT,
        usage: GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST
      });
      const bindGroup = device.createBindGroup({
        label: 'ulg-sph-resident-surface-draw-overlay-bind-group',
        layout: bindGroupLayout,
        entries: [
          { binding: 0, resource: { buffer: surfaceDrawExecution.compactedVertexRowsBuffer } },
          { binding: 1, resource: { buffer: cameraBuffer } },
          { binding: 2, resource: { buffer: opticalGpuBuffers.recordsBuffer } },
          { binding: 3, resource: { buffer: opticalGpuBuffers.spectralSamplesBuffer } }
        ]
      });
      const indirectStrideBytes = 4 * Uint32Array.BYTES_PER_ELEMENT;
      const drawOrder = residentSurfaceDrawOrder(surfaceDrawExecution.surfaces || [], {
        indirectStrideBytes
      });
      const bridge = {
        schema: 'peercompute.ulg.sph-resident-surface-draw-render-bridge.v0',
        status: 'webgpu-storage-indirect-overlay-ready',
        rendererBridge: 'webgpu-storage-indirect-overlay',
        visibleRenderSource: 'resident-surface-draw-buffers',
        canvas,
        context,
        device,
        format,
        pipeline: transparentPipeline,
        opaquePipeline,
        transparentPipeline,
        transparentOitPipeline,
        oitCompositePipeline,
        oitCompositeBindGroupLayout,
        oitSampler,
        cameraBuffer,
        drawState: {
          bindGroup,
          drawIndirectRowsBuffer: surfaceDrawExecution.drawIndirectRowsBuffer,
          surfaceCount: surfaceDrawExecution.surfaceCount,
          sourceSurfaceCount: surfaceDrawExecution.surfaceCount,
          drawOrder,
          drawOrderSurfaceIndices: drawOrder.map((row) => row.surfaceIndex),
          drawOrderIndirectOffsets: drawOrder.map((row) => row.indirectOffsetBytes),
          drawOrderingPolicy: 'resident-surface-render-order-depth-policy',
          depthPolicy: 'opaque-depth-write-transparent-depth-test',
          depthAttachmentFormat: SPH_RESIDENT_SURFACE_DRAW_DEPTH_FORMAT,
          transparencyCompositeMode: 'weighted-blended-oit',
          oitAccumFormat: SPH_RESIDENT_SURFACE_DRAW_OIT_ACCUM_FORMAT,
          oitRevealFormat: SPH_RESIDENT_SURFACE_DRAW_OIT_REVEAL_FORMAT,
          opticalRenderSource: 'closure-derived-optical-gpu-table',
          opticalRecordCount: bridgeOpticalGpuTable.recordCount,
          opticalRecordStrideFloats: bridgeOpticalGpuTable.recordStrideFloats,
          opticalSpectralSampleCount: bridgeOpticalGpuTable.spectralSampleCount,
          opticalSpectralSampleStrideFloats: bridgeOpticalGpuTable.spectralSampleStrideFloats,
          temporalSwapPolicy: SPH_RESIDENT_SURFACE_DRAW_TEMPORAL_SWAP_POLICY,
          indirectStrideBytes
        },
        drawOrderingPolicy: 'resident-surface-render-order-depth-policy',
        drawOrderSurfaceIndices: drawOrder.map((row) => row.surfaceIndex),
        drawOrderIndirectOffsets: drawOrder.map((row) => row.indirectOffsetBytes),
        drawOrderCount: drawOrder.length,
        depthPolicy: 'opaque-depth-write-transparent-depth-test',
        depthAttachmentFormat: SPH_RESIDENT_SURFACE_DRAW_DEPTH_FORMAT,
        depthAttachmentReady: false,
        transparencyCompositeMode: 'weighted-blended-oit',
        oitAccumFormat: SPH_RESIDENT_SURFACE_DRAW_OIT_ACCUM_FORMAT,
        oitRevealFormat: SPH_RESIDENT_SURFACE_DRAW_OIT_REVEAL_FORMAT,
        oitTargetsReady: false,
        opticalGpuBuffers,
        opticalRenderSource: 'closure-derived-optical-gpu-table',
        opticalRecordCount: bridgeOpticalGpuTable.recordCount,
        opticalRecordStrideFloats: bridgeOpticalGpuTable.recordStrideFloats,
        opticalSpectralSampleCount: bridgeOpticalGpuTable.spectralSampleCount,
        opticalSpectralSampleStrideFloats: bridgeOpticalGpuTable.spectralSampleStrideFloats,
        temporalSwapPolicy: SPH_RESIDENT_SURFACE_DRAW_TEMPORAL_SWAP_POLICY,
        retainedPreviousOverlay: false,
        frameCount: 0,
        lastRenderStatus: 'pending',
        scientificValidation: false,
        sphValidation: false,
        surfaceExtractionValidation: false,
        fullPhysicsValidation: false
      };
      sphResidentSurfaceDrawRenderBridge = bridge;
      scene.userData.sphResidentSurfaceDrawRenderBridge = bridge;
      return bridge;
    } catch (error) {
      return {
        schema: 'peercompute.ulg.sph-resident-surface-draw-render-bridge.v0',
        status: 'surface-draw-overlay-error',
        reason: error instanceof Error ? error.message : String(error),
        rendererBridge: 'pending-three-webgpu-binding',
        visibleRenderSource: 'three-marching-cubes-fallback',
        scientificValidation: false,
        sphValidation: false,
        surfaceExtractionValidation: false,
        fullPhysicsValidation: false
      };
    }
  }

  function renderSphResidentSurfaceDrawOverlay() {
    const bridge = sphResidentSurfaceDrawRenderBridge;
    const drawState = bridge?.drawState;
    if (!bridge?.device || !bridge?.context || !drawState?.bindGroup || !drawState?.drawIndirectRowsBuffer) return;
    try {
      resizeSphResidentSurfaceDrawOverlayCanvas(bridge);
      const depthView = ensureSphResidentSurfaceDrawDepthView(bridge);
      const viewProjection = new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
      bridge.device.queue.writeBuffer(bridge.cameraBuffer, 0, new Float32Array(viewProjection.elements));
      const encoder = bridge.device.createCommandEncoder({ label: 'ulg-sph-resident-surface-draw-overlay' });
      const canvasView = bridge.context.getCurrentTexture().createView();
      const drawOrder = Array.isArray(drawState.drawOrder) && drawState.drawOrder.length
        ? drawState.drawOrder
        : residentSurfaceDrawOrder(
          Array.from({ length: drawState.surfaceCount }, (_, surfaceIndex) => ({ surfaceIndex })),
          { indirectStrideBytes: drawState.indirectStrideBytes }
        );
      const opaqueDraws = drawOrder.filter((draw) => residentSurfaceDrawPipelineKey(draw) === 'opaque-depth-write');
      const transparentDraws = drawOrder.filter((draw) => residentSurfaceDrawPipelineKey(draw) !== 'opaque-depth-write');
      const opaquePass = encoder.beginRenderPass({
        colorAttachments: [{
          view: canvasView,
          clearValue: { r: 0, g: 0, b: 0, a: 0 },
          loadOp: 'clear',
          storeOp: 'store'
        }],
        depthStencilAttachment: depthView
          ? {
              view: depthView,
              depthClearValue: 1,
              depthLoadOp: 'clear',
              depthStoreOp: 'store'
            }
          : undefined
      });
      opaquePass.setPipeline(bridge.opaquePipeline || bridge.pipeline);
      opaquePass.setBindGroup(0, drawState.bindGroup);
      for (const draw of opaqueDraws) {
        opaquePass.drawIndirect(drawState.drawIndirectRowsBuffer, draw.indirectOffsetBytes);
      }
      opaquePass.end();
      let transparentCompositeSubmitted = false;
      if (
        transparentDraws.length > 0
        && depthView
        && bridge.transparentOitPipeline
        && bridge.oitCompositePipeline
        && bridge.oitCompositeBindGroupLayout
      ) {
        const oitTargets = ensureSphResidentSurfaceDrawOitTargets(bridge);
        if (oitTargets?.accumView && oitTargets?.revealView) {
          const transparentPass = encoder.beginRenderPass({
            colorAttachments: [
              {
                view: oitTargets.accumView,
                clearValue: { r: 0, g: 0, b: 0, a: 0 },
                loadOp: 'clear',
                storeOp: 'store'
              },
              {
                view: oitTargets.revealView,
                clearValue: { r: 1, g: 1, b: 1, a: 1 },
                loadOp: 'clear',
                storeOp: 'store'
              }
            ],
            depthStencilAttachment: {
              view: depthView,
              depthLoadOp: 'load',
              depthStoreOp: 'store'
            }
          });
          transparentPass.setPipeline(bridge.transparentOitPipeline);
          transparentPass.setBindGroup(0, drawState.bindGroup);
          for (const draw of transparentDraws) {
            transparentPass.drawIndirect(drawState.drawIndirectRowsBuffer, draw.indirectOffsetBytes);
          }
          transparentPass.end();
          const compositeBindGroup = bridge.device.createBindGroup({
            label: 'ulg-sph-resident-surface-draw-oit-composite-bind-group',
            layout: bridge.oitCompositeBindGroupLayout,
            entries: [
              { binding: 0, resource: bridge.oitAccumTexture.createView() },
              { binding: 1, resource: bridge.oitRevealTexture.createView() },
              { binding: 2, resource: bridge.oitSampler }
            ]
          });
          const compositePass = encoder.beginRenderPass({
            colorAttachments: [{
              view: canvasView,
              loadOp: 'load',
              storeOp: 'store'
            }]
          });
          compositePass.setPipeline(bridge.oitCompositePipeline);
          compositePass.setBindGroup(0, compositeBindGroup);
          compositePass.draw(3);
          compositePass.end();
          transparentCompositeSubmitted = true;
        }
      } else if (transparentDraws.length > 0) {
        const transparentPass = encoder.beginRenderPass({
          colorAttachments: [{
            view: canvasView,
            loadOp: 'load',
            storeOp: 'store'
          }],
          depthStencilAttachment: depthView
            ? {
                view: depthView,
                depthLoadOp: 'load',
                depthStoreOp: 'store'
              }
            : undefined
        });
        transparentPass.setPipeline(bridge.transparentPipeline || bridge.pipeline);
        transparentPass.setBindGroup(0, drawState.bindGroup);
        for (const draw of transparentDraws) {
          transparentPass.drawIndirect(drawState.drawIndirectRowsBuffer, draw.indirectOffsetBytes);
        }
        transparentPass.end();
      }
      bridge.device.queue.submit([encoder.finish()]);
      bridge.frameCount += 1;
      bridge.lastRenderStatus = 'webgpu-overlay-rendered';
      bridge.lastOpaqueDrawCount = opaqueDraws.length;
      bridge.lastTransparentDrawCount = transparentDraws.length;
      bridge.lastTransparentCompositeMode = transparentCompositeSubmitted ? 'weighted-blended-oit' : 'direct-alpha-depth-test';
      if (sphResidentSurfaceDraw) {
        sphResidentSurfaceDraw.renderBridgeFrameCount = bridge.frameCount;
        sphResidentSurfaceDraw.renderBridgeLastRenderStatus = bridge.lastRenderStatus;
        sphResidentSurfaceDraw.renderBridgeDepthAttachmentReady = Boolean(bridge.depthAttachmentReady);
        sphResidentSurfaceDraw.renderBridgeDepthPolicy = bridge.depthPolicy ?? null;
        sphResidentSurfaceDraw.renderBridgeDepthAttachmentFormat = bridge.depthAttachmentFormat ?? null;
        sphResidentSurfaceDraw.renderBridgeOitTargetsReady = Boolean(bridge.oitTargetsReady);
        sphResidentSurfaceDraw.renderBridgeTransparencyCompositeMode = bridge.lastTransparentCompositeMode;
        sphResidentSurfaceDraw.renderBridgeOitAccumFormat = bridge.oitAccumFormat ?? null;
        sphResidentSurfaceDraw.renderBridgeOitRevealFormat = bridge.oitRevealFormat ?? null;
        sphResidentSurfaceDraw.renderBridgeLastOpaqueDrawCount = bridge.lastOpaqueDrawCount;
        sphResidentSurfaceDraw.renderBridgeLastTransparentDrawCount = bridge.lastTransparentDrawCount;
        sphResidentSurfaceDraw.renderBridgeTemporalSwapPolicy = bridge.temporalSwapPolicy ?? null;
        sphResidentSurfaceDraw.renderBridgeRetainedPreviousOverlay = Boolean(bridge.retainedPreviousOverlay);
      }
      if (sphResidentRenderState) {
        sphResidentRenderState.surfaceDrawRenderBridgeFrameCount = bridge.frameCount;
        sphResidentRenderState.surfaceDrawRenderBridgeLastRenderStatus = bridge.lastRenderStatus;
        sphResidentRenderState.surfaceDrawRenderBridgeDepthAttachmentReady = Boolean(bridge.depthAttachmentReady);
        sphResidentRenderState.surfaceDrawRenderBridgeDepthPolicy = bridge.depthPolicy ?? null;
        sphResidentRenderState.surfaceDrawRenderBridgeDepthAttachmentFormat = bridge.depthAttachmentFormat ?? null;
        sphResidentRenderState.surfaceDrawRenderBridgeOitTargetsReady = Boolean(bridge.oitTargetsReady);
        sphResidentRenderState.surfaceDrawRenderBridgeTransparencyCompositeMode = bridge.lastTransparentCompositeMode;
        sphResidentRenderState.surfaceDrawRenderBridgeOitAccumFormat = bridge.oitAccumFormat ?? null;
        sphResidentRenderState.surfaceDrawRenderBridgeOitRevealFormat = bridge.oitRevealFormat ?? null;
        sphResidentRenderState.surfaceDrawRenderBridgeLastOpaqueDrawCount = bridge.lastOpaqueDrawCount;
        sphResidentRenderState.surfaceDrawRenderBridgeLastTransparentDrawCount = bridge.lastTransparentDrawCount;
        sphResidentRenderState.surfaceDrawRenderBridgeTemporalSwapPolicy = bridge.temporalSwapPolicy ?? null;
        sphResidentRenderState.surfaceDrawRenderBridgeRetainedPreviousOverlay = Boolean(bridge.retainedPreviousOverlay);
      }
    } catch (error) {
      bridge.lastRenderStatus = 'webgpu-overlay-render-error';
      bridge.reason = error instanceof Error ? error.message : String(error);
      bridge.drawState = null;
      if (sphResidentSurfaceDraw) {
        sphResidentSurfaceDraw.renderBridgeLastRenderStatus = bridge.lastRenderStatus;
        sphResidentSurfaceDraw.renderBridgeReason = bridge.reason;
      }
      if (sphResidentRenderState) {
        sphResidentRenderState.surfaceDrawRenderBridgeLastRenderStatus = bridge.lastRenderStatus;
        sphResidentRenderState.surfaceDrawRenderBridgeReason = bridge.reason;
      }
    }
  }

  function publishMlsMpmResidentStepArtifacts(step, signature, {
    stepsExecution = null,
    stepsSignature = null
  } = {}) {
    mlsMpmResidentSteps = stepsExecution;
    mlsMpmResidentStepsSignature = stepsSignature;
    scene.userData.mlsMpmResidentSteps = stepsExecution;
    mlsMpmResidentStep = step;
    mlsMpmResidentStepSignature = stepsExecution ? null : signature;
    mlsMpmP2gGridProjection = step?.p2gGridProjection ?? null;
    mlsMpmP2gGridProjectionSignature = signature;
    mlsMpmGridUpdate = step?.gridUpdate ?? null;
    mlsMpmGridUpdateSignature = signature;
    mlsMpmG2pReconstruction = step?.g2pReconstruction ?? null;
    mlsMpmG2pReconstructionSignature = signature;
    scene.userData.mlsMpmResidentStep = step;
    scene.userData.mlsMpmP2gGridProjection = mlsMpmP2gGridProjection;
    scene.userData.mlsMpmGridUpdate = mlsMpmGridUpdate;
    scene.userData.mlsMpmG2pReconstruction = mlsMpmG2pReconstruction;
  }

  async function refreshSphGpuParticleBuffers({
    preferWebGpu = true,
    force = false,
    navigatorRef: overrideNavigatorRef = navigatorRef,
    device = null,
    deviceResult = null
  } = {}) {
    if (!sphGpuParticleState) {
      sphGpuParticleUpload = null;
      scene.userData.sphGpuParticleUpload = null;
      return null;
    }
    const signature = sphGpuParticleSignature(sphGpuParticleState);
    if (!force && sphGpuParticleUploadSignature === signature && sphGpuParticleUpload) {
      return sphGpuParticleUpload;
    }
    if (!force && pendingSphGpuParticleUpload?.signature === signature) {
      return pendingSphGpuParticleUpload.promise;
    }
    const promise = (async () => {
      if (!preferWebGpu) {
        const upload = {
          schema: ULG_SPH_GPU_PARTICLE_BUFFER_SET_SCHEMA,
          status: 'not-requested',
          sourceSchema: sphGpuParticleState.schema,
          particleCount: sphGpuParticleState.particleCount,
          reason: 'WebGPU SPH particle upload not requested',
          scientificValidation: false,
          sphValidation: false,
          phaseChangeValidation: false,
          fullPhysicsValidation: false
        };
        sphGpuParticleUpload = upload;
        sphGpuParticleUploadSignature = signature;
        scene.userData.sphGpuParticleUpload = upload;
        return upload;
      }
      const resolvedDeviceResult = device
        ? { status: 'webgpu-device-ready', reason: 'provided device', device }
        : (deviceResult || await requestCachedOpticalGpuDevice(overrideNavigatorRef));
      if (!resolvedDeviceResult.device) {
        const upload = {
          schema: ULG_SPH_GPU_PARTICLE_BUFFER_SET_SCHEMA,
          status: resolvedDeviceResult.status,
          sourceSchema: sphGpuParticleState.schema,
          particleCount: sphGpuParticleState.particleCount,
          reason: resolvedDeviceResult.reason,
          fallback: 'cpu-packed-buffer',
          scientificValidation: false,
          sphValidation: false,
          phaseChangeValidation: false,
          fullPhysicsValidation: false
        };
        sphGpuParticleUpload = upload;
        sphGpuParticleUploadSignature = signature;
        scene.userData.sphGpuParticleUpload = upload;
        return upload;
      }
      const upload = uploadSphGpuParticleBuffers(resolvedDeviceResult.device, sphGpuParticleState);
      upload.signature = signature;
      upload.step = sphGpuParticleState.step;
      upload.time = sphGpuParticleState.time;
      if (!running || sphGpuParticleSignature(sphGpuParticleState) !== signature) {
        destroySphGpuParticleBuffers(upload);
        return { ...upload, status: 'stale-upload-discarded' };
      }
      if (sphGpuParticleUpload?.status === 'webgpu-uploaded') {
        destroySphGpuParticleBuffers(sphGpuParticleUpload);
      }
      sphGpuParticleUpload = upload;
      sphGpuParticleUploadSignature = signature;
      scene.userData.sphGpuParticleUpload = upload;
      return upload;
    })();
    pendingSphGpuParticleUpload = { signature, promise };
    try {
      return await promise;
    } finally {
      if (pendingSphGpuParticleUpload?.promise === promise) pendingSphGpuParticleUpload = null;
    }
  }

  async function refreshMlsMpmGpuParticleBuffers({
    preferWebGpu = true,
    force = false,
    navigatorRef: overrideNavigatorRef = navigatorRef,
    device = null,
    deviceResult = null
  } = {}) {
    if (!mlsMpmGpuParticleState) {
      mlsMpmGpuParticleUpload = null;
      scene.userData.mlsMpmGpuParticleUpload = null;
      return null;
    }
    const signature = mlsMpmGpuParticleSignature(mlsMpmGpuParticleState);
    if (!force && mlsMpmGpuParticleUploadSignature === signature && mlsMpmGpuParticleUpload) {
      return mlsMpmGpuParticleUpload;
    }
    if (!force && pendingMlsMpmGpuParticleUpload?.signature === signature) {
      return pendingMlsMpmGpuParticleUpload.promise;
    }
    const promise = (async () => {
      if (!preferWebGpu) {
        const upload = {
          schema: ULG_MLS_MPM_GPU_PARTICLE_BUFFER_SET_SCHEMA,
          status: 'not-requested',
          sourceSchema: mlsMpmGpuParticleState.schema,
          particleCount: mlsMpmGpuParticleState.particleCount,
          reason: 'WebGPU MLS-MPM particle upload not requested',
          scientificValidation: false,
          sphValidation: false,
          phaseChangeValidation: false,
          fullPhysicsValidation: false
        };
        mlsMpmGpuParticleUpload = upload;
        mlsMpmGpuParticleUploadSignature = signature;
        scene.userData.mlsMpmGpuParticleUpload = upload;
        return upload;
      }
      const resolvedDeviceResult = device
        ? { status: 'webgpu-device-ready', reason: 'provided device', device }
        : (deviceResult || await requestCachedOpticalGpuDevice(overrideNavigatorRef));
      if (!resolvedDeviceResult.device) {
        const upload = {
          schema: ULG_MLS_MPM_GPU_PARTICLE_BUFFER_SET_SCHEMA,
          status: resolvedDeviceResult.status,
          sourceSchema: mlsMpmGpuParticleState.schema,
          particleCount: mlsMpmGpuParticleState.particleCount,
          reason: resolvedDeviceResult.reason,
          fallback: 'cpu-packed-buffer',
          scientificValidation: false,
          sphValidation: false,
          phaseChangeValidation: false,
          fullPhysicsValidation: false
        };
        mlsMpmGpuParticleUpload = upload;
        mlsMpmGpuParticleUploadSignature = signature;
        scene.userData.mlsMpmGpuParticleUpload = upload;
        return upload;
      }
      const upload = uploadMlsMpmGpuParticleBuffers(resolvedDeviceResult.device, mlsMpmGpuParticleState);
      upload.signature = signature;
      upload.step = mlsMpmGpuParticleState.step;
      upload.time = mlsMpmGpuParticleState.time;
      if (!running || mlsMpmGpuParticleSignature(mlsMpmGpuParticleState) !== signature) {
        destroyMlsMpmGpuParticleBuffers(upload);
        return { ...upload, status: 'stale-upload-discarded' };
      }
      if (mlsMpmGpuParticleUpload?.status === 'webgpu-uploaded') {
        destroyMlsMpmGpuParticleBuffers(mlsMpmGpuParticleUpload);
      }
      mlsMpmGpuParticleUpload = upload;
      mlsMpmGpuParticleUploadSignature = signature;
      scene.userData.mlsMpmGpuParticleUpload = upload;
      return upload;
    })();
    pendingMlsMpmGpuParticleUpload = { signature, promise };
    try {
      return await promise;
    } finally {
      if (pendingMlsMpmGpuParticleUpload?.promise === promise) pendingMlsMpmGpuParticleUpload = null;
    }
  }

  async function refreshSphThermalResponseGraphBuffers({
    preferWebGpu = true,
    force = false,
    navigatorRef: overrideNavigatorRef = navigatorRef,
    device = null,
    deviceResult = null
  } = {}) {
    const signature = sphThermalResponseGraphSignature();
    if (!signature) {
      if (sphThermalResponseGraphUpload?.status === 'webgpu-uploaded') {
        destroySphThermalResponseGraphBuffers(sphThermalResponseGraphUpload);
      }
      sphThermalResponseGraphUpload = null;
      sphThermalResponseGraphUploadSignature = null;
      scene.userData.sphThermalResponseGraphUpload = null;
      return null;
    }
    if (!force && sphThermalResponseGraphUploadSignature === signature && sphThermalResponseGraphUpload) {
      return sphThermalResponseGraphUpload;
    }
    if (!force && pendingSphThermalResponseGraphUpload?.signature === signature) {
      return pendingSphThermalResponseGraphUpload.promise;
    }
    const promise = (async () => {
      if (!preferWebGpu) {
        const upload = {
          schema: ULG_SPH_GPU_THERMAL_RESPONSE_GRAPH_BUFFER_SET_SCHEMA,
          status: 'not-requested',
          sourceMaterialTableSchema: sphThermalMaterialTable?.schema ?? null,
          materialCount: sphThermalPhaseResponseTable?.materialCount ?? 0,
          responseCount: sphThermalPhaseResponseTable?.responseCount ?? 0,
          graphCount: sphThermalClosureGraphBuffers?.graphBank?.graphCount ?? 0,
          reason: 'WebGPU SPH thermal response/graph upload not requested',
          scientificValidation: false,
          materialValidation: false,
          sphValidation: false,
          phaseChangeValidation: false,
          fullPhysicsValidation: false
        };
        sphThermalResponseGraphUpload = upload;
        sphThermalResponseGraphUploadSignature = signature;
        scene.userData.sphThermalResponseGraphUpload = upload;
        return upload;
      }
      const resolvedDeviceResult = device
        ? { status: 'webgpu-device-ready', reason: 'provided device', device }
        : (deviceResult || await requestCachedOpticalGpuDevice(overrideNavigatorRef));
      if (!resolvedDeviceResult.device) {
        const upload = {
          schema: ULG_SPH_GPU_THERMAL_RESPONSE_GRAPH_BUFFER_SET_SCHEMA,
          status: resolvedDeviceResult.status,
          sourceMaterialTableSchema: sphThermalMaterialTable?.schema ?? null,
          materialCount: sphThermalPhaseResponseTable?.materialCount ?? 0,
          responseCount: sphThermalPhaseResponseTable?.responseCount ?? 0,
          graphCount: sphThermalClosureGraphBuffers?.graphBank?.graphCount ?? 0,
          reason: resolvedDeviceResult.reason,
          fallback: 'cpu-packed-response-graph',
          scientificValidation: false,
          materialValidation: false,
          sphValidation: false,
          phaseChangeValidation: false,
          fullPhysicsValidation: false
        };
        sphThermalResponseGraphUpload = upload;
        sphThermalResponseGraphUploadSignature = signature;
        scene.userData.sphThermalResponseGraphUpload = upload;
        return upload;
      }
      const upload = uploadSphThermalResponseGraphBuffers(resolvedDeviceResult.device, {
        thermalMaterialTable: sphThermalMaterialTable,
        thermalClosureGraphSet: sphThermalClosureGraphBuffers,
        thermalClosureGraphBank: sphThermalClosureGraphBuffers?.graphBank ?? null,
        thermalPhaseResponseTable: sphThermalPhaseResponseTable
      });
      upload.signature = signature;
      if (!running || sphThermalResponseGraphSignature() !== signature) {
        destroySphThermalResponseGraphBuffers(upload);
        return { ...upload, status: 'stale-upload-discarded' };
      }
      if (sphThermalResponseGraphUpload?.status === 'webgpu-uploaded') {
        destroySphThermalResponseGraphBuffers(sphThermalResponseGraphUpload);
      }
      sphThermalResponseGraphUpload = upload;
      sphThermalResponseGraphUploadSignature = signature;
      scene.userData.sphThermalResponseGraphUpload = upload;
      return upload;
    })();
    pendingSphThermalResponseGraphUpload = { signature, promise };
    try {
      return await promise;
    } finally {
      if (pendingSphThermalResponseGraphUpload?.promise === promise) pendingSphThermalResponseGraphUpload = null;
    }
  }

  async function refreshMlsMpmMechanicsPrediction({
    preferWebGpu = true,
    force = false,
    navigatorRef: overrideNavigatorRef = navigatorRef,
    device = null,
    deviceResult = null,
    dt = 4e-4,
    gravityMPerS2 = [0, -9.80665, 0],
    parityTolerance = 2e-5,
    webGpuRunner = undefined
  } = {}) {
    if (!sphGpuParticleState || !mlsMpmGpuParticleState) {
      mlsMpmMechanicsPrediction = null;
      scene.userData.mlsMpmMechanicsPrediction = null;
      return null;
    }
    const signature = mlsMpmMechanicsPredictionSignatureFor({ dt, gravityMPerS2 });
    if (!force && mlsMpmMechanicsPredictionSignature === signature && mlsMpmMechanicsPrediction) {
      return mlsMpmMechanicsPrediction;
    }
    if (!force && pendingMlsMpmMechanicsPrediction?.signature === signature) {
      return pendingMlsMpmMechanicsPrediction.promise;
    }
    const promise = (async () => {
      const resolvedDeviceResult = preferWebGpu && !device && !deviceResult
        ? await requestCachedOpticalGpuDevice(overrideNavigatorRef)
        : deviceResult;
      const resolvedSphUpload = preferWebGpu
        ? await refreshSphGpuParticleBuffers({
          preferWebGpu,
          navigatorRef: overrideNavigatorRef,
          device,
          deviceResult: resolvedDeviceResult
        })
        : sphGpuParticleUpload;
      const resolvedMlsUpload = preferWebGpu
        ? await refreshMlsMpmGpuParticleBuffers({
          preferWebGpu,
          navigatorRef: overrideNavigatorRef,
          device,
          deviceResult: resolvedDeviceResult
        })
        : mlsMpmGpuParticleUpload;
      const execution = await runMlsMpmMechanicsPredictWithOptionalWebGpu({
        sphParticleState: sphGpuParticleState,
        mlsMpmParticleState: mlsMpmGpuParticleState,
        sphParticleUpload: resolvedSphUpload,
        mlsMpmParticleUpload: resolvedMlsUpload,
        dt,
        gravityMPerS2,
        boxDimsM: dims,
        preferWebGpu,
        navigatorRef: overrideNavigatorRef,
        device,
        deviceResult: resolvedDeviceResult,
        parityTolerance,
        webGpuRunner,
        onDeviceLost() {
          opticalGpuDeviceResultPromise = null;
        }
      });
      execution.signature = signature;
      if (
        !running
        || mlsMpmMechanicsPredictionSignatureFor({ dt, gravityMPerS2 }) !== signature
      ) {
        return {
          ...execution,
          stale: true
        };
      }
      mlsMpmMechanicsPrediction = execution;
      mlsMpmMechanicsPredictionSignature = signature;
      scene.userData.mlsMpmMechanicsPrediction = execution;
      return execution;
    })();
    pendingMlsMpmMechanicsPrediction = { signature, promise };
    try {
      return await promise;
    } finally {
      if (pendingMlsMpmMechanicsPrediction?.promise === promise) pendingMlsMpmMechanicsPrediction = null;
    }
  }

  async function refreshMlsMpmP2gGridProjection({
    preferWebGpu = true,
    force = false,
    navigatorRef: overrideNavigatorRef = navigatorRef,
    device = null,
    deviceResult = null,
    gridSpacingM = sphGpuParticleState?.smoothingLengthM,
    parityTolerance = 5e-2,
    webGpuRunner = undefined
  } = {}) {
    if (!sphGpuParticleState || !mlsMpmGpuParticleState) {
      mlsMpmP2gGridProjection = null;
      scene.userData.mlsMpmP2gGridProjection = null;
      return null;
    }
    const signature = mlsMpmP2gGridProjectionSignatureFor({ gridSpacingM });
    if (!force && mlsMpmP2gGridProjectionSignature === signature && mlsMpmP2gGridProjection) {
      return mlsMpmP2gGridProjection;
    }
    if (!force && pendingMlsMpmP2gGridProjection?.signature === signature) {
      return pendingMlsMpmP2gGridProjection.promise;
    }
    const promise = (async () => {
      const resolvedDeviceResult = preferWebGpu && !device && !deviceResult
        ? await requestCachedOpticalGpuDevice(overrideNavigatorRef)
        : deviceResult;
      const resolvedSphUpload = preferWebGpu
        ? await refreshSphGpuParticleBuffers({
          preferWebGpu,
          navigatorRef: overrideNavigatorRef,
          device,
          deviceResult: resolvedDeviceResult
        })
        : sphGpuParticleUpload;
      const resolvedMlsUpload = preferWebGpu
        ? await refreshMlsMpmGpuParticleBuffers({
          preferWebGpu,
          navigatorRef: overrideNavigatorRef,
          device,
          deviceResult: resolvedDeviceResult
        })
        : mlsMpmGpuParticleUpload;
      const execution = await runMlsMpmP2gGridProjectionWithOptionalWebGpu({
        sphParticleState: sphGpuParticleState,
        mlsMpmParticleState: mlsMpmGpuParticleState,
        sphParticleUpload: resolvedSphUpload,
        mlsMpmParticleUpload: resolvedMlsUpload,
        gridSpacingM,
        boxDimsM: dims,
        preferWebGpu,
        navigatorRef: overrideNavigatorRef,
        device,
        deviceResult: resolvedDeviceResult,
        parityTolerance,
        retainGridBuffer: true,
        webGpuRunner,
        onDeviceLost() {
          opticalGpuDeviceResultPromise = null;
        }
      });
      execution.signature = signature;
      if (
        !running
        || mlsMpmP2gGridProjectionSignatureFor({ gridSpacingM }) !== signature
      ) {
        return {
          ...execution,
          stale: true
        };
      }
      mlsMpmP2gGridProjection = execution;
      mlsMpmP2gGridProjectionSignature = signature;
      scene.userData.mlsMpmP2gGridProjection = execution;
      return execution;
    })();
    pendingMlsMpmP2gGridProjection = { signature, promise };
    try {
      return await promise;
    } finally {
      if (pendingMlsMpmP2gGridProjection?.promise === promise) pendingMlsMpmP2gGridProjection = null;
    }
  }

  async function refreshMlsMpmGridUpdate({
    preferWebGpu = true,
    force = false,
    navigatorRef: overrideNavigatorRef = navigatorRef,
    device = null,
    deviceResult = null,
    p2gGridProjection = mlsMpmP2gGridProjection,
    dt = mlsMpmGpuParticleState?.mechanicsDtS ?? p2gGridProjection?.dt ?? 0,
    gravityMPerS2 = mlsMpmGpuParticleState?.gravityMPerS2 ?? [0, -9.80665, 0],
    cflFactor = mlsMpmGpuParticleState?.gridCflFactor || 0.6,
    parityTolerance = 1e-5,
    pressureInterfaceForceSolver = sphResidentRenderState?.pressureInterfaceForceSolver ?? null,
    pressureInterfaceForceRowsBuffer = null,
    webGpuRunner = undefined
  } = {}) {
    if (!p2gGridProjection?.schema) {
      mlsMpmGridUpdate = null;
      scene.userData.mlsMpmGridUpdate = null;
      return null;
    }
    const signature = mlsMpmGridUpdateSignatureFor({
      p2gGridProjection,
      dt,
      gravityMPerS2,
      cflFactor,
      pressureInterfaceForceSolver
    });
    if (!force && mlsMpmGridUpdateSignature === signature && mlsMpmGridUpdate) {
      return mlsMpmGridUpdate;
    }
    if (!force && pendingMlsMpmGridUpdate?.signature === signature) {
      return pendingMlsMpmGridUpdate.promise;
    }
    const promise = (async () => {
      const resolvedDeviceResult = preferWebGpu && !device && !deviceResult
        ? await requestCachedOpticalGpuDevice(overrideNavigatorRef)
        : deviceResult;
      let resolvedPressureForceRowsUpload = null;
      try {
        resolvedPressureForceRowsUpload = pressureInterfaceForceRowsBuffer
          ? null
          : uploadPressureInterfaceForceRowsBuffer({
            pressureInterfaceForceSolver,
            device: device || resolvedDeviceResult?.device || null,
            retainInScene: false
          });
        const execution = await runMlsMpmGridUpdateWithOptionalWebGpu({
          p2gGridProjection,
          p2gGridBuffer: p2gGridProjection?.gpuResult?.gridBuffer ?? p2gGridProjection?.gridBuffer ?? null,
          pressureInterfaceForceRowsBuffer: pressureInterfaceForceRowsBuffer
            ?? resolvedPressureForceRowsUpload?.buffer
            ?? null,
          pressureInterfaceForceSolver,
          dt,
          gravityMPerS2,
          boxDimsM: dims,
          cflFactor,
          preferWebGpu,
          navigatorRef: overrideNavigatorRef,
          device,
          deviceResult: resolvedDeviceResult,
          parityTolerance,
          retainUpdatedGridBuffer: true,
          webGpuRunner,
          onDeviceLost() {
            opticalGpuDeviceResultPromise = null;
          }
        });
        execution.signature = signature;
        if (
          !running
          || mlsMpmGridUpdateSignatureFor({
            p2gGridProjection,
            dt,
            gravityMPerS2,
            cflFactor,
            pressureInterfaceForceSolver
          }) !== signature
        ) {
          return {
            ...execution,
            stale: true
          };
        }
        mlsMpmGridUpdate = execution;
        mlsMpmGridUpdateSignature = signature;
        scene.userData.mlsMpmGridUpdate = execution;
        return execution;
      } finally {
        resolvedPressureForceRowsUpload?.destroy?.();
      }
    })();
    pendingMlsMpmGridUpdate = { signature, promise };
    try {
      return await promise;
    } finally {
      if (pendingMlsMpmGridUpdate?.promise === promise) pendingMlsMpmGridUpdate = null;
    }
  }

  async function refreshMlsMpmG2pReconstruction({
    preferWebGpu = true,
    force = false,
    navigatorRef: overrideNavigatorRef = navigatorRef,
    device = null,
    deviceResult = null,
    gridUpdate = mlsMpmGridUpdate,
    dt = gridUpdate?.dt ?? mlsMpmGpuParticleState?.mechanicsDtS ?? 0,
    parityTolerance = 5e-2,
    webGpuRunner = undefined
  } = {}) {
    if (!sphGpuParticleState || !mlsMpmGpuParticleState || !gridUpdate?.schema) {
      mlsMpmG2pReconstruction = null;
      scene.userData.mlsMpmG2pReconstruction = null;
      return null;
    }
    const signature = mlsMpmG2pReconstructionSignatureFor({ gridUpdate, dt });
    if (!force && mlsMpmG2pReconstructionSignature === signature && mlsMpmG2pReconstruction) {
      return mlsMpmG2pReconstruction;
    }
    if (!force && pendingMlsMpmG2pReconstruction?.signature === signature) {
      return pendingMlsMpmG2pReconstruction.promise;
    }
    const promise = (async () => {
      const resolvedDeviceResult = preferWebGpu && !device && !deviceResult
        ? await requestCachedOpticalGpuDevice(overrideNavigatorRef)
        : deviceResult;
      const resolvedSphUpload = preferWebGpu
        ? await refreshSphGpuParticleBuffers({
          preferWebGpu,
          navigatorRef: overrideNavigatorRef,
          device,
          deviceResult: resolvedDeviceResult
        })
        : sphGpuParticleUpload;
      const resolvedMlsUpload = preferWebGpu
        ? await refreshMlsMpmGpuParticleBuffers({
          preferWebGpu,
          navigatorRef: overrideNavigatorRef,
          device,
          deviceResult: resolvedDeviceResult
        })
        : mlsMpmGpuParticleUpload;
      const execution = await runMlsMpmG2pWithOptionalWebGpu({
        sphParticleState: sphGpuParticleState,
        mlsMpmParticleState: mlsMpmGpuParticleState,
        gridUpdate,
        sphParticleUpload: resolvedSphUpload,
        mlsMpmParticleUpload: resolvedMlsUpload,
        updatedGridBuffer: gridUpdate?.gpuResult?.updatedGridBuffer ?? gridUpdate?.updatedGridBuffer ?? null,
        dt,
        boxDimsM: dims,
        preferWebGpu,
        navigatorRef: overrideNavigatorRef,
        device,
        deviceResult: resolvedDeviceResult,
        parityTolerance,
        webGpuRunner,
        onDeviceLost() {
          opticalGpuDeviceResultPromise = null;
        }
      });
      execution.signature = signature;
      if (!running || mlsMpmG2pReconstructionSignatureFor({ gridUpdate, dt }) !== signature) {
        return {
          ...execution,
          stale: true
        };
      }
      mlsMpmG2pReconstruction = execution;
      mlsMpmG2pReconstructionSignature = signature;
      scene.userData.mlsMpmG2pReconstruction = execution;
      return execution;
    })();
    pendingMlsMpmG2pReconstruction = { signature, promise };
    try {
      return await promise;
    } finally {
      if (pendingMlsMpmG2pReconstruction?.promise === promise) pendingMlsMpmG2pReconstruction = null;
    }
  }

  async function refreshMlsMpmResidentStep({
    preferWebGpu = true,
    force = false,
    navigatorRef: overrideNavigatorRef = navigatorRef,
    device = null,
    deviceResult = null,
    gridSpacingM = sphGpuParticleState?.smoothingLengthM,
    dt = mlsMpmGpuParticleState?.mechanicsDtS ?? 0,
    gravityMPerS2 = mlsMpmGpuParticleState?.gravityMPerS2 ?? [0, -9.80665, 0],
    cflFactor = mlsMpmGpuParticleState?.gridCflFactor || 0.6,
    readbackMode = SPH_PHASE_RESIDENT_READBACK_MODE_DEFAULT,
    parityTolerances = undefined,
    pressureInterfaceForceSolver = sphResidentRenderState?.pressureInterfaceForceSolver ?? null,
    pressureInterfaceForceRowsBuffer = null,
    p2gRunner = undefined,
    gridUpdateRunner = undefined,
    g2pRunner = undefined
  } = {}) {
    if (!sphGpuParticleState || !mlsMpmGpuParticleState) {
      clearMlsMpmResidentExecutionArtifacts();
      return null;
    }
    const requestedReadbackMode = normalizeResidentReadbackMode(readbackMode);
    scene.userData.mlsMpmResidentRequestedReadbackMode = requestedReadbackMode;
    const signature = mlsMpmResidentStepSignatureFor({
      gridSpacingM,
      dt,
      gravityMPerS2,
      cflFactor,
      readbackMode: requestedReadbackMode,
      pressureInterfaceForceSolver
    });
    if (!force && mlsMpmResidentStepSignature === signature && mlsMpmResidentStep) {
      return mlsMpmResidentStep;
    }
    if (!force && pendingMlsMpmResidentStep?.signature === signature) {
      return pendingMlsMpmResidentStep.promise;
    }
    const promise = (async () => {
      const resolvedDeviceResult = preferWebGpu && !device && !deviceResult
        ? await requestCachedOpticalGpuDevice(overrideNavigatorRef)
        : deviceResult;
      const resolvedSphUpload = preferWebGpu
        ? await refreshSphGpuParticleBuffers({
          preferWebGpu,
          navigatorRef: overrideNavigatorRef,
          device,
          deviceResult: resolvedDeviceResult
        })
        : sphGpuParticleUpload;
      const resolvedMlsUpload = preferWebGpu
        ? await refreshMlsMpmGpuParticleBuffers({
          preferWebGpu,
          navigatorRef: overrideNavigatorRef,
          device,
          deviceResult: resolvedDeviceResult
        })
        : mlsMpmGpuParticleUpload;
      const resolvedThermalResponseGraphUpload = preferWebGpu
        ? await refreshSphThermalResponseGraphBuffers({
          preferWebGpu,
          navigatorRef: overrideNavigatorRef,
          device,
          deviceResult: resolvedDeviceResult
        })
        : sphThermalResponseGraphUpload;
      let resolvedPressureForceRowsUpload = null;
      try {
        resolvedPressureForceRowsUpload = pressureInterfaceForceRowsBuffer
          ? null
          : uploadPressureInterfaceForceRowsBuffer({
            pressureInterfaceForceSolver,
            device: device || resolvedDeviceResult?.device || null,
            retainInScene: false
          });
        const execution = await runMlsMpmResidentStepWithOptionalWebGpu({
          sphParticleState: sphGpuParticleState,
          mlsMpmParticleState: mlsMpmGpuParticleState,
          sphParticleUpload: resolvedSphUpload,
          mlsMpmParticleUpload: resolvedMlsUpload,
          gridSpacingM,
          boxDimsM: dims,
          dt,
          gravityMPerS2,
          cflFactor,
          preferWebGpu,
          pressureInterfaceForceRowsBuffer: pressureInterfaceForceRowsBuffer
            ?? resolvedPressureForceRowsUpload?.buffer
            ?? null,
          pressureInterfaceForceSolver,
          navigatorRef: overrideNavigatorRef,
          device,
          deviceResult: resolvedDeviceResult,
          readbackMode: requestedReadbackMode,
          thermalMaterialTable: sphThermalMaterialTable,
          thermalStepOptions: {
            thermalClosureGraphSet: sphThermalClosureGraphBuffers,
            thermalClosureGraphBank: sphThermalClosureGraphBuffers?.graphBank ?? null,
            thermalPhaseResponseTable: sphThermalPhaseResponseTable,
            thermalResponseGraphUpload: resolvedThermalResponseGraphUpload
          },
          reactionTable: sphReactionTable,
          reactionStepOptions: {
            thermalClosureGraphSet: sphThermalClosureGraphBuffers,
            thermalClosureGraphBank: sphThermalClosureGraphBuffers?.graphBank ?? null,
            thermalPhaseResponseTable: sphThermalPhaseResponseTable,
            thermalResponseGraphUpload: resolvedThermalResponseGraphUpload
          },
          parityTolerances,
          p2gRunner,
          gridUpdateRunner,
          g2pRunner,
          onDeviceLost() {
            opticalGpuDeviceResultPromise = null;
          }
        });
        execution.requestedReadbackMode = requestedReadbackMode;
        execution.signature = signature;
        if (
          !running
          || mlsMpmResidentStepSignatureFor({
            gridSpacingM,
            dt,
            gravityMPerS2,
            cflFactor,
            readbackMode: requestedReadbackMode,
            pressureInterfaceForceSolver
          }) !== signature
        ) {
          return {
            ...execution,
            stale: true
          };
        }
        clearMlsMpmResidentExecutionArtifacts();
        publishMlsMpmResidentStepArtifacts(execution, signature);
        return execution;
      } finally {
        resolvedPressureForceRowsUpload?.destroy?.();
      }
    })();
    pendingMlsMpmResidentStep = { signature, promise };
    try {
      return await promise;
    } finally {
      if (pendingMlsMpmResidentStep?.promise === promise) pendingMlsMpmResidentStep = null;
    }
  }

  async function refreshMlsMpmResidentSteps({
    preferWebGpu = true,
    force = false,
    navigatorRef: overrideNavigatorRef = navigatorRef,
    device = null,
    deviceResult = null,
    gridSpacingM = sphGpuParticleState?.smoothingLengthM,
    dt = mlsMpmGpuParticleState?.mechanicsDtS ?? 0,
    gravityMPerS2 = mlsMpmGpuParticleState?.gravityMPerS2 ?? [0, -9.80665, 0],
    cflFactor = mlsMpmGpuParticleState?.gridCflFactor || 0.6,
    readbackMode = SPH_PHASE_RESIDENT_READBACK_MODE_DEFAULT,
    parityTolerances = undefined,
    p2gRunner = undefined,
    gridUpdateRunner = undefined,
    g2pRunner = undefined,
    stepCount = 1,
    retainIntermediateSteps = false,
    continueFromResidentState = false,
    pressureInterfaceForceSolver = sphResidentRenderState?.pressureInterfaceForceSolver ?? null,
    pressureInterfaceForceRowsBuffer = null
  } = {}) {
    if (!sphGpuParticleState || !mlsMpmGpuParticleState) {
      clearMlsMpmResidentExecutionArtifacts();
      return null;
    }
    const normalizedStepCount = normalizeResidentStepCount(stepCount);
    const requestedReadbackMode = normalizeResidentReadbackMode(readbackMode);
    scene.userData.mlsMpmResidentRequestedReadbackMode = requestedReadbackMode;
    const continuationUploads = mlsMpmResidentSteps?.nextParticleUploads ?? null;
    const continuationAvailable = Boolean(
      continueFromResidentState
      && requestedReadbackMode === RESIDENT_NO_FULL_READBACK_MODE
      && mlsMpmResidentSteps?.nextSphParticleState
      && mlsMpmResidentSteps?.nextMlsMpmParticleState
      && continuationUploads?.sphParticleUpload?.status === 'webgpu-uploaded'
      && continuationUploads?.mlsMpmParticleUpload?.status === 'webgpu-uploaded'
    );
    const sourceSphParticleState = continuationAvailable
      ? mlsMpmResidentSteps.nextSphParticleState
      : sphGpuParticleState;
    const sourceMlsMpmParticleState = continuationAvailable
      ? mlsMpmResidentSteps.nextMlsMpmParticleState
      : mlsMpmGpuParticleState;
    const residentSourceMode = continuationAvailable
      ? 'previous-gpu-resident-output'
      : 'cpu-packed-state';
    const signature = mlsMpmResidentStepsSignatureFor({
      sphParticleState: sourceSphParticleState,
      mlsMpmParticleState: sourceMlsMpmParticleState,
      gridSpacingM,
      dt,
      gravityMPerS2,
      cflFactor,
      readbackMode: requestedReadbackMode,
      stepCount: normalizedStepCount,
      retainIntermediateSteps,
      residentSourceMode,
      pressureInterfaceForceSolver
    });
    if (!force && mlsMpmResidentStepsSignature === signature && mlsMpmResidentSteps) {
      return mlsMpmResidentSteps;
    }
    if (!force && pendingMlsMpmResidentSteps) {
      return pendingMlsMpmResidentSteps.promise;
    }
    const promise = (async () => {
      const resolvedDeviceResult = preferWebGpu && !device && !deviceResult
        ? await requestCachedOpticalGpuDevice(overrideNavigatorRef)
        : deviceResult;
      const resolvedSphUpload = continuationAvailable
        ? continuationUploads.sphParticleUpload
        : preferWebGpu
        ? await refreshSphGpuParticleBuffers({
          preferWebGpu,
          navigatorRef: overrideNavigatorRef,
          device,
          deviceResult: resolvedDeviceResult
        })
        : sphGpuParticleUpload;
      const resolvedMlsUpload = continuationAvailable
        ? continuationUploads.mlsMpmParticleUpload
        : preferWebGpu
        ? await refreshMlsMpmGpuParticleBuffers({
          preferWebGpu,
          navigatorRef: overrideNavigatorRef,
          device,
          deviceResult: resolvedDeviceResult
        })
        : mlsMpmGpuParticleUpload;
      const resolvedThermalResponseGraphUpload = preferWebGpu
        ? await refreshSphThermalResponseGraphBuffers({
          preferWebGpu,
          navigatorRef: overrideNavigatorRef,
          device,
          deviceResult: resolvedDeviceResult
        })
        : sphThermalResponseGraphUpload;
      let resolvedPressureForceRowsUpload = null;
      try {
        resolvedPressureForceRowsUpload = pressureInterfaceForceRowsBuffer
          ? null
          : uploadPressureInterfaceForceRowsBuffer({
            pressureInterfaceForceSolver,
            device: device || resolvedDeviceResult?.device || null,
            retainInScene: false
          });
        const execution = await runMlsMpmResidentStepsWithOptionalWebGpu({
          sphParticleState: sourceSphParticleState,
          mlsMpmParticleState: sourceMlsMpmParticleState,
          sphParticleUpload: resolvedSphUpload,
          mlsMpmParticleUpload: resolvedMlsUpload,
          gridSpacingM,
          boxDimsM: dims,
          dt,
          gravityMPerS2,
          cflFactor,
          preferWebGpu,
          pressureInterfaceForceRowsBuffer: pressureInterfaceForceRowsBuffer
            ?? resolvedPressureForceRowsUpload?.buffer
            ?? null,
          pressureInterfaceForceSolver,
          navigatorRef: overrideNavigatorRef,
          device,
          deviceResult: resolvedDeviceResult,
          readbackMode: requestedReadbackMode,
          thermalMaterialTable: sphThermalMaterialTable,
          thermalStepOptions: {
            thermalClosureGraphSet: sphThermalClosureGraphBuffers,
            thermalClosureGraphBank: sphThermalClosureGraphBuffers?.graphBank ?? null,
            thermalPhaseResponseTable: sphThermalPhaseResponseTable,
            thermalResponseGraphUpload: resolvedThermalResponseGraphUpload
          },
          reactionTable: sphReactionTable,
          reactionStepOptions: {
            thermalClosureGraphSet: sphThermalClosureGraphBuffers,
            thermalClosureGraphBank: sphThermalClosureGraphBuffers?.graphBank ?? null,
            thermalPhaseResponseTable: sphThermalPhaseResponseTable,
            thermalResponseGraphUpload: resolvedThermalResponseGraphUpload
          },
          parityTolerances,
          p2gRunner,
          gridUpdateRunner,
          g2pRunner,
          stepCount: normalizedStepCount,
          retainIntermediateSteps,
          onDeviceLost() {
            opticalGpuDeviceResultPromise = null;
          }
        });
        execution.requestedReadbackMode = requestedReadbackMode;
        execution.residentSourceMode = residentSourceMode;
        execution.continuedFromResidentState = continuationAvailable;
        execution.continuationAvailable = Boolean(execution.nextParticleUploads);
        if (execution.finalStep) execution.finalStep.requestedReadbackMode = requestedReadbackMode;
        for (const summary of execution.stepSummaries ?? []) {
          summary.requestedReadbackMode = requestedReadbackMode;
        }
        execution.signature = signature;
        if (
          !running
          || mlsMpmResidentStepsSignatureFor({
            sphParticleState: sourceSphParticleState,
            mlsMpmParticleState: sourceMlsMpmParticleState,
            gridSpacingM,
            dt,
            gravityMPerS2,
            cflFactor,
            readbackMode: requestedReadbackMode,
            stepCount: normalizedStepCount,
            retainIntermediateSteps,
            residentSourceMode,
            pressureInterfaceForceSolver
          }) !== signature
        ) {
          return {
            ...execution,
            stale: true
          };
        }
        clearMlsMpmResidentExecutionArtifacts();
        publishMlsMpmResidentStepArtifacts(execution.finalStep, signature, {
          stepsExecution: execution,
          stepsSignature: signature
        });
        return execution;
      } finally {
        resolvedPressureForceRowsUpload?.destroy?.();
      }
    })();
    pendingMlsMpmResidentSteps = { signature, promise };
    try {
      return await promise;
    } finally {
      if (pendingMlsMpmResidentSteps?.promise === promise) pendingMlsMpmResidentSteps = null;
    }
  }

  function ensureSurface(descriptorOrKey, properties = null, configOverride = null, opticsOverride = null) {
    const descriptor = renderDescriptorOf(descriptorOrKey);
    const key = descriptor.surfaceKey;
    const config = configOverride || SURFACE_CONFIG[descriptor.renderKey] || SURFACE_CONFIG.default;
    const optics = opticsOverride || opticalRenderParams(opticalQueryForDescriptor(descriptor, properties));
    const opticalSignature = opticalSignatureForMaterial(optics);
    let surface = surfaces.get(key);
    if (surface) {
      if (
        surface.opticalSignature !== opticalSignature
        || surface.config.resolution !== config.resolution
        || surface.config.isolation !== config.isolation
        || surface.config.subtract !== config.subtract
        || surface.config.maxPolyCount !== config.maxPolyCount
      ) {
        scene.remove(surface.mesh);
        surface.mesh.geometry?.dispose?.();
        surface.mesh.material.dispose();
        surfaces.delete(key);
      } else {
        return surface;
      }
    }
    const mesh = new MarchingCubes(
      config.resolution,
      makeSurfaceMaterial(descriptor, properties, optics),
      false,
      true,
      config.maxPolyCount
    );
    mesh.isolation = config.isolation;
    // Isotropic scale (a single scalar) so metaballs render as spheres, not ellipsoids. With the
    // refEdge-normalized positions above, this maps field-axis [pad, 1-pad] onto world [0, refEdge];
    // a particle at box-axis coordinate L lands at world L because L/refEdge ≤ 1. Position is
    // refEdge/2 on every axis (the field origin maps to world 0 on each axis).
    mesh.scale.setScalar(refEdgeM / (2 * (1 - 2 * FIELD_PADDING)));
    mesh.position.set(refEdgeM / 2, refEdgeM / 2, refEdgeM / 2);
    mesh.frustumCulled = false;
    mesh.visible = false;
    mesh.userData.renderMode = SPH_PHASE_RENDER_MODE;
    mesh.userData.materialKey = descriptor.material;
    mesh.userData.renderKey = descriptor.renderKey;
    mesh.userData.phase = descriptor.phase;
    mesh.userData.optical = mesh.material.userData.optical;
    applySurfaceRenderOrdering(mesh, mesh.material.userData.optical, descriptor);
    scene.add(mesh);
    surface = { mesh, config, properties, descriptor, opticalSignature, inactiveFrameCount: 0 };
    surfaces.set(key, surface);
    return surface;
  }

  function rebuildOpticalStateForSurfaceBatches(batches, { materialProperties = null } = {}) {
    opticalGpuTable = createOpticalGpuTableForSurfaceBatches(batches, { materialProperties });
    opticalGpuLookup = createOpticalGpuLookupForSurfaceBatches(opticalGpuTable, batches);
    opticalGpuLookupGeneration += 1;
    scene.userData.opticalGpuTable = opticalGpuTable;
    scene.userData.opticalGpuLookup = opticalGpuLookup;
    scene.userData.opticalGpuLookupExecution = null;
    scene.userData.opticalGpuLookupDrawState = null;
  }

  function opticalTableCoversSurfaceBatches(table, batches = []) {
    if (!table?.schema || !Array.isArray(table.recordMetadata)) return false;
    const available = new Set(table.recordMetadata.map((record) => opticalCoverageKey(record)));
    return batches.every((batch) => available.has(opticalCoverageKey({
      material: batch.material,
      phase: batch.phase,
      opticalStateKey: batch.descriptor?.opticalStateKey,
      opticalState: batch.descriptor?.opticalState
    })));
  }

  function rebuildOpticalStateForSurfaceBatchesWithCache(batches, {
    materialProperties = null,
    cachedOpticalGpuTable = null
  } = {}) {
    if (opticalTableCoversSurfaceBatches(cachedOpticalGpuTable, batches)) {
      opticalGpuTable = {
        ...cachedOpticalGpuTable,
        status: 'static-table-cache-hit'
      };
    } else {
      opticalGpuTable = createOpticalGpuTableForSurfaceBatches(batches, { materialProperties });
    }
    opticalGpuLookup = createOpticalGpuLookupForSurfaceBatches(opticalGpuTable, batches);
    opticalGpuLookupGeneration += 1;
    scene.userData.opticalGpuTable = opticalGpuTable;
    scene.userData.opticalGpuLookup = opticalGpuLookup;
    scene.userData.opticalGpuLookupExecution = null;
    scene.userData.opticalGpuLookupDrawState = null;
  }

  function applySurfaceBatches(batches, {
    emissiveByMaterial = null,
    materialProperties = null,
    renderSource = 'cpu-particles',
    renderRowsExecution = null
  } = {}) {
    const applyStartMs = nowMs();
    const details = [];
    const totals = {
      ensureSurfaceMs: 0,
      materialMs: 0,
      resetMs: 0,
      addBallMs: 0,
      updateMs: 0,
      hideInactiveMs: 0
    };
    const addTiming = (field, startMs) => {
      const elapsed = Math.max(0, nowMs() - startMs);
      totals[field] += elapsed;
      return elapsed;
    };
    const activeKeys = new Set();
    const gpuRecordsBySurface = new Map(opticalGpuTable.recordMetadata.map((record) => [
      opticalCoverageKey(record),
      record
    ]));
    for (const batch of batches) {
      scheduleEnvironmentMap();
      const properties = materialPropertiesForSurfaceDescriptor(batch.descriptor, materialProperties);
      const cachedOptics = opticalParamsFromGpuTableRecord(opticalGpuTable, batch.descriptor);
      const surfaceConfig = adaptiveCpuSurfaceConfig(
        SURFACE_CONFIG[batch.renderKey] || SURFACE_CONFIG.default,
        batch.count
      );
      const ensureStartMs = nowMs();
      const surface = ensureSurface(batch.descriptor, properties, surfaceConfig, cachedOptics);
      const ensureSurfaceMs = addTiming('ensureSurfaceMs', ensureStartMs);
      const { mesh, config } = surface;
      const materialStartMs = nowMs();
      mesh.userData.optical = mesh.material.userData.optical;
      mesh.userData.materialKey = batch.material;
      mesh.userData.renderKey = batch.renderKey;
      mesh.userData.phase = batch.phase;
      mesh.userData.renderSource = renderSource;
      mesh.userData.renderRowsExecutionSchema = renderRowsExecution?.schema || null;
      mesh.userData.renderRowsBackend = renderRowsExecution?.backend || null;
      mesh.userData.opticalState = batch.descriptor?.opticalState || null;
      mesh.userData.opticalStateKey = batch.descriptor?.opticalStateKey || 'default';
      mesh.userData.opticalGpuRecord = gpuRecordsBySurface.get(opticalCoverageKey({
        material: batch.material,
        phase: batch.phase,
        opticalStateKey: batch.descriptor?.opticalStateKey,
        opticalState: batch.descriptor?.opticalState
      })) || null;
      const opticalVisibility = resolveOpticalSurfaceVisibility({
        optics: mesh.material.userData.optical,
        descriptorOrRow: batch.descriptor,
        wasVisible: Boolean(mesh.visible)
      });
      mesh.userData.opticalSurfaceVisibility = opticalVisibility;
      const emissive = emissiveByMaterial?.[batch.material] ?? emissiveByMaterial?.[batch.renderKey] ?? null;
      if (emissive) {
        mesh.material.emissive.setRGB(emissive[0], emissive[1], emissive[2], THREE.SRGBColorSpace);
        mesh.material.emissiveIntensity = 1.8;
      } else {
        mesh.material.emissive.setRGB(0, 0, 0);
        mesh.material.emissiveIntensity = 0;
      }
      const materialMs = addTiming('materialMs', materialStartMs);
      if (!opticalVisibility.visible) {
        const hideStartMs = nowMs();
        const hidden = hideSurfaceAfterGrace(surface, renderSource);
        addTiming('hideInactiveMs', hideStartMs);
        mesh.userData.opticalSurfaceHiddenReason = opticalVisibility.reason;
        mesh.userData.opticalSurfaceRetainedByGrace = !hidden && opticalVisibility.retainPreviousSurface;
        mesh.userData.particleCount = batch.count;
        mesh.userData.surfaceRadiusM = 0;
        mesh.userData.surfaceResolution = mesh.resolution || config.resolution;
        mesh.userData.surfaceMaxPolyCount = config.maxPolyCount;
        activeKeys.add(batch.surfaceKey);
        details.push({
          surfaceKey: batch.surfaceKey,
          material: batch.material,
          renderKey: batch.renderKey,
          phase: batch.phase,
          particleCount: batch.count,
          resolution: mesh.resolution || config.resolution,
          maxPolyCount: config.maxPolyCount,
          opticalSource: cachedOptics?.source || 'cpu-optical-render-params',
          opticalSurfaceVisibility: opticalVisibility.reason,
          ensureSurfaceMs,
          materialMs,
          resetMs: 0,
          addBallMs: 0,
          updateMs: 0
        });
        continue;
      }
      mesh.userData.opticalSurfaceHiddenReason = null;
      mesh.userData.opticalSurfaceRetainedByGrace = false;
      const resetStartMs = nowMs();
      mesh.isolation = config.isolation;
      mesh.reset();
      const resetMs = addTiming('resetMs', resetStartMs);
      // Isosurface (blob) size is decoupled from the container: the auto estimate (from particle
      // spacing) or an explicit override is multiplied by a user-set scale, independent of box size.
      const radiusM = (Number.isFinite(surfaceRadiusM) ? surfaceRadiusM : batch.surfaceRadiusM) * radiusScale;
      const radiusNorm = clamp(radiusM / refEdgeM, 0.001, 0.14);
      const strength = (mesh.isolation + config.subtract) * radiusNorm * radiusNorm;
      const addBallStartMs = nowMs();
      for (let i = 0; i < batch.count; i += 1) {
        mesh.addBall(
          batch.normalizedPositions[i * 3],
          batch.normalizedPositions[i * 3 + 1],
          batch.normalizedPositions[i * 3 + 2],
          strength,
          config.subtract,
          [
            batch.colorsRgb[i * 3],
            batch.colorsRgb[i * 3 + 1],
            batch.colorsRgb[i * 3 + 2]
          ]
        );
      }
      const addBallMs = addTiming('addBallMs', addBallStartMs);
      const updateStartMs = nowMs();
      mesh.update();
      const updateMs = addTiming('updateMs', updateStartMs);
      mesh.visible = batch.count > 0;
      mesh.userData.particleCount = batch.count;
      mesh.userData.surfaceRadiusM = radiusM;
      mesh.userData.surfaceResolution = mesh.resolution || config.resolution;
      mesh.userData.surfaceMaxPolyCount = config.maxPolyCount;
      markSurfaceActive(surface);
      activeKeys.add(batch.surfaceKey);
      details.push({
        surfaceKey: batch.surfaceKey,
        material: batch.material,
        renderKey: batch.renderKey,
        phase: batch.phase,
        particleCount: batch.count,
        resolution: mesh.resolution || config.resolution,
        maxPolyCount: config.maxPolyCount,
        opticalSource: cachedOptics?.source || 'cpu-optical-render-params',
        opticalSurfaceVisibility: opticalVisibility.reason,
        ensureSurfaceMs,
        materialMs,
        resetMs,
        addBallMs,
        updateMs
      });
    }
    for (const [key, surface] of surfaces) {
      if (!activeKeys.has(key)) {
        const hideStartMs = nowMs();
        hideSurfaceAfterGrace(surface, renderSource);
        addTiming('hideInactiveMs', hideStartMs);
      }
    }
    scene.userData.sphSurfaceApplyTiming = {
      schema: 'peercompute.ulg.sph-surface-apply-timing.v0',
      totalMs: Math.max(0, nowMs() - applyStartMs),
      totals,
      details,
      surfaceCount: details.length,
      renderSource,
      scientificValidation: false,
      sphValidation: false,
      fullPhysicsValidation: false
    };
  }

  function averageBatchColor(batch) {
    if (!batch?.colorsRgb?.length || !batch.count) return [1, 1, 1];
    let r = 0;
    let g = 0;
    let b = 0;
    for (let i = 0; i < batch.count; i += 1) {
      r += batch.colorsRgb[i * 3];
      g += batch.colorsRgb[i * 3 + 1];
      b += batch.colorsRgb[i * 3 + 2];
    }
    return [r / batch.count, g / batch.count, b / batch.count].map((value) => clamp(value, 0, 1));
  }

  function createRenderFieldSurfaceTableForBatches(batches) {
    const descriptors = batches.map((batch) => {
      const config = adaptiveCpuSurfaceConfig(
        SURFACE_CONFIG[batch.renderKey] || SURFACE_CONFIG.default,
        batch.count
      );
      const radiusM = (Number.isFinite(surfaceRadiusM) ? surfaceRadiusM : batch.surfaceRadiusM) * radiusScale;
      const radiusNorm = clamp(radiusM / refEdgeM, 0.001, 0.14);
      const properties = materialPropertiesForSurfaceDescriptor(batch.descriptor, currentMaterialProperties);
      const optics = opticalParamsFromGpuTableRecord(opticalGpuTable, batch.descriptor)
        || opticalRenderParams(opticalQueryForDescriptor(batch.descriptor, properties));
      const renderLayer = renderLayerFromOpticalResponse(optics, batch.descriptor);
      const renderOrder = renderOrderFromOpticalResponse(optics, batch.descriptor);
      const depthWriteFlag = renderDepthWriteFromOpticalResponse(optics, batch.descriptor) ? 1 : 0;
      const transparencyClassId = renderLayer === 'vapor-surface'
        ? 3
        : (renderLayer === 'transmissive-surface'
          ? 2
          : (renderLayer === 'alpha-surface' ? 1 : 0));
      return {
        surfaceKey: batch.surfaceKey,
        material: batch.material,
        phase: batch.phase,
        opticalState: batch.descriptor?.opticalState || null,
        opticalStateKey: batch.descriptor?.opticalStateKey || 'default',
        renderLayer,
        renderOrder,
        depthWriteFlag,
        transparencyClassId,
        renderKey: batch.renderKey,
        resolution: Math.min(config.resolution, RESIDENT_RENDER_FIELD_MAX_RESOLUTION),
        isolation: config.isolation,
        subtract: config.subtract,
        radiusNorm,
        strength: (config.isolation + config.subtract) * radiusNorm * radiusNorm,
        colorLinear: averageBatchColor(batch),
        status: 1
      };
    });
    return buildSphRenderFieldSurfaceTable(descriptors);
  }

  function materialKeysFromReactionTable(reactionTable = null) {
    const keys = new Set();
    for (const record of reactionTable?.metadata || []) {
      for (const key of [record.a, record.b, record.product]) {
        if (key) keys.add(key);
      }
      for (const term of record.productTerms || []) {
        if (term.material) keys.add(term.material);
      }
      for (const term of record.reactantTerms || []) {
        if (term.material) keys.add(term.material);
      }
    }
    for (const term of reactionTable?.productTermMetadata || []) {
      if (term.material) keys.add(term.material);
    }
    for (const term of reactionTable?.reactantTermMetadata || []) {
      if (term.material) keys.add(term.material);
    }
    return keys;
  }

  function colorForResidentSurfaceDescriptor(descriptor, materialProperties) {
    const properties = materialPropertiesForSurfaceDescriptor(descriptor, materialProperties);
    const optics = opticalRenderParams(opticalQueryForDescriptor(descriptor, properties));
    return optics.baseColorSrgb ?? optics.pbr?.baseColorSrgb ?? [1, 1, 1];
  }

  function createResidentRenderSurfaceBatches({
    particleBatches = [],
    productEventSurfaceBatches = [],
    materialProperties = null,
    reactionTable = null,
    smoothingLengthM = null
  } = {}) {
    const batchesByKey = new Map();
    const countByMaterial = new Map();
    const radiusByMaterial = new Map();
    const materials = materialKeysFromReactionTable(reactionTable);
    for (const batch of [...particleBatches, ...productEventSurfaceBatches]) {
      if (!batch?.surfaceKey) continue;
      batchesByKey.set(batch.surfaceKey, batch);
      if (batch.material) {
        materials.add(batch.material);
        countByMaterial.set(batch.material, Math.max(
          countByMaterial.get(batch.material) || 0,
          Math.max(0, Math.round(Number(batch.count) || 0))
        ));
        if (Number.isFinite(batch.surfaceRadiusM) && batch.surfaceRadiusM > 0) {
          radiusByMaterial.set(batch.material, batch.surfaceRadiusM);
        }
      }
    }
    for (const material of materials) {
      const properties = materialPropertiesLookup(material, materialProperties);
      const phases = Array.isArray(properties?.phases) ? properties.phases : [];
      for (const phaseRecord of phases) {
        const phase = phaseRecord?.name;
        if (!phase) continue;
        const renderKey = renderKeyForMaterialPhase(material, phase);
        const descriptor = renderDescriptorOf({ material, phase, renderKey });
        if (batchesByKey.has(descriptor.surfaceKey)) continue;
        const count = Math.max(1, countByMaterial.get(material) || 0);
        const color = colorForResidentSurfaceDescriptor(descriptor, materialProperties);
        const colorsRgb = [];
        for (let i = 0; i < count; i += 1) {
          colorsRgb.push(
            clamp(color[0] ?? 1, 0, 1),
            clamp(color[1] ?? 1, 0, 1),
            clamp(color[2] ?? 1, 0, 1)
          );
        }
        batchesByKey.set(descriptor.surfaceKey, {
          surfaceKey: descriptor.surfaceKey,
          renderKey,
          material,
          phase,
          opticalState: descriptor.opticalState,
          opticalStateKey: descriptor.opticalStateKey,
          descriptor,
          positionsM: [],
          normalizedPositions: [],
          colorsRgb,
          bounds: emptyBounds(),
          count,
          surfaceRadiusM: radiusByMaterial.get(material)
            ?? ((Number.isFinite(smoothingLengthM) && smoothingLengthM > 0) ? smoothingLengthM : 0.25),
          source: 'resident-known-phase-surface'
        });
      }
    }
    return [...batchesByKey.values()];
  }

  function captureResidentRenderSurfaceState({
    particleBatches = [],
    fieldBatches = [],
    emissiveByMaterial = null,
    materialProperties = null
  } = {}) {
    const surfaceTable = createRenderFieldSurfaceTableForBatches(fieldBatches);
    sphResidentRenderSurfaceState = {
      schema: 'peercompute.ulg.sph-resident-render-surface-state.v0',
      status: 'resident-render-surface-table-ready',
      particleBatches,
      fieldBatches,
      surfaceTable,
      emissiveByMaterial,
      materialCount: materialProperties ? Object.keys(materialProperties).length : 0,
      surfaceCount: fieldBatches.length,
      surfaceTableSurfaceCount: surfaceTable.surfaceCount,
      surfaceTableTotalFieldCells: surfaceTable.totalFieldCells,
      materialKeys: [...new Set(fieldBatches.map((batch) => batch.material))],
      phaseKeys: [...new Set(fieldBatches.map((batch) => batch.phase))],
      signature: residentSurfaceBatchIdentitySignature(fieldBatches),
      readbackMode: SPH_PHASE_RESIDENT_READBACK_MODE_DEFAULT,
      scientificValidation: false,
      sphValidation: false,
      phaseChangeValidation: false,
      fullPhysicsValidation: false
    };
    scene.userData.sphResidentRenderSurfaceState = sphResidentRenderSurfaceState;
    return sphResidentRenderSurfaceState;
  }

  function applySurfaceFields(surfaceFields, {
    emissiveByMaterial = null,
    materialProperties = null,
    renderSource = 'resident-gpu-render-field',
    renderRowsExecution = null,
    renderFieldExecution = null
  } = {}) {
    const activeKeys = new Set();
    const gpuRecordsBySurface = new Map(opticalGpuTable.recordMetadata.map((record) => [
      opticalCoverageKey(record),
      record
    ]));
    for (const fieldSurface of surfaceFields) {
      scheduleEnvironmentMap();
      const descriptor = renderDescriptorOf({
        material: fieldSurface.material,
        phase: fieldSurface.phase,
        renderKey: fieldSurface.renderKey,
        opticalState: fieldSurface.opticalState || null
      });
      const properties = materialPropertiesForSurfaceDescriptor(descriptor, materialProperties);
      const baseConfig = SURFACE_CONFIG[descriptor.renderKey] || SURFACE_CONFIG.default;
      const cachedOptics = opticalParamsFromGpuTableRecord(opticalGpuTable, descriptor);
      const surface = ensureSurface(descriptor, properties, {
        ...baseConfig,
        resolution: fieldSurface.resolution
      }, cachedOptics);
      const { mesh } = surface;
      if (mesh.field.length !== fieldSurface.field.length || mesh.palette.length !== fieldSurface.palette.length) {
        throw new Error(`Render field size mismatch for ${descriptor.surfaceKey}`);
      }
      let maxDensity = 0;
      for (let i = 0; i < fieldSurface.field.length; i += 1) {
        if (fieldSurface.field[i] > maxDensity) maxDensity = fieldSurface.field[i];
      }
      const visibility = resolveRenderFieldSurfaceVisibility({
        maxDensity,
        isolation: fieldSurface.isolation,
        wasVisible: Boolean(mesh.visible)
      });
      const opticalVisibility = resolveOpticalSurfaceVisibility({
        optics: mesh.material.userData.optical,
        descriptorOrRow: descriptor,
        wasVisible: Boolean(mesh.visible)
      });
      mesh.userData.optical = mesh.material.userData.optical;
      mesh.userData.materialKey = descriptor.material;
      mesh.userData.renderKey = descriptor.renderKey;
      mesh.userData.phase = descriptor.phase;
      mesh.userData.renderSource = renderSource;
      mesh.userData.renderRowsExecutionSchema = renderRowsExecution?.schema || null;
      mesh.userData.renderRowsBackend = renderRowsExecution?.backend || null;
      mesh.userData.renderFieldExecutionSchema = renderFieldExecution?.schema || null;
      mesh.userData.renderFieldBackend = renderFieldExecution?.backend || null;
      mesh.userData.renderFieldInputSource = renderFieldExecution?.renderFieldInputSource || null;
      mesh.userData.opticalState = descriptor.opticalState || null;
      mesh.userData.opticalStateKey = descriptor.opticalStateKey || 'default';
      mesh.userData.opticalGpuRecord = gpuRecordsBySurface.get(opticalCoverageKey(descriptor)) || null;
      const emissive = emissiveByMaterial?.[descriptor.material] ?? emissiveByMaterial?.[descriptor.renderKey] ?? null;
      if (emissive) {
        mesh.material.emissive.setRGB(emissive[0], emissive[1], emissive[2], THREE.SRGBColorSpace);
        mesh.material.emissiveIntensity = 1.8;
      } else {
        mesh.material.emissive.setRGB(0, 0, 0);
        mesh.material.emissiveIntensity = 0;
      }
      mesh.userData.particleCount = null;
      mesh.userData.surfaceRadiusM = fieldSurface.radiusNorm * refEdgeM;
      mesh.userData.renderFieldResolution = fieldSurface.resolution;
      mesh.userData.renderFieldCells = fieldSurface.fieldCellCount;
      mesh.userData.renderFieldMaxDensity = maxDensity;
      mesh.userData.renderFieldIsolation = fieldSurface.isolation;
      mesh.userData.renderFieldShowIsolation = visibility.showIsolation;
      mesh.userData.renderFieldHideIsolation = visibility.hideIsolation;
      mesh.userData.renderFieldAppliedIsolation = visibility.renderIsolation;
      mesh.userData.renderFieldRetainPreviousSurface = visibility.retainPreviousSurface;
      mesh.userData.opticalSurfaceVisibility = opticalVisibility;
      if (!opticalVisibility.visible) {
        const hidden = hideSurfaceAfterGrace(surface, renderSource);
        mesh.userData.opticalSurfaceHiddenReason = opticalVisibility.reason;
        mesh.userData.opticalSurfaceRetainedByGrace = !hidden && opticalVisibility.retainPreviousSurface;
        mesh.userData.renderFieldRetainedByGrace = !hidden && opticalVisibility.retainPreviousSurface;
        activeKeys.add(descriptor.surfaceKey);
        continue;
      }
      mesh.userData.opticalSurfaceHiddenReason = null;
      mesh.userData.opticalSurfaceRetainedByGrace = false;
      if (!visibility.visible) {
        const hidden = hideSurfaceAfterGrace(surface, renderSource);
        mesh.userData.renderFieldRetainedByGrace = !hidden && visibility.retainPreviousSurface;
        activeKeys.add(descriptor.surfaceKey);
        continue;
      }
      mesh.reset();
      mesh.field.set(fieldSurface.field);
      mesh.palette.set(fieldSurface.palette);
      mesh.isolation = visibility.renderIsolation;
      mesh.update();
      mesh.visible = true;
      mesh.userData.renderFieldRetainedByGrace = false;
      markSurfaceActive(surface);
      activeKeys.add(descriptor.surfaceKey);
    }
    for (const [key, surface] of surfaces) {
      if (!activeKeys.has(key)) {
        hideSurfaceAfterGrace(surface, renderSource);
      }
    }
  }

  // Colours are precomputed by the demo (closure-backed incandescence from the radiation closure
  // for hot matter and intrinsic colour from the optical closure). The renderer reconstructs a
  // continuous density surface from particles, but it does not invent material colour.
  function setParticles({
    positionsM,
    colorsRgb,
    materials = null,
    emissiveByMaterial = null,
    materialProperties = null,
    reactions = null,
    reactionContactRadiusM = null,
    sphGpuParticleState: nextSphGpuParticleState = null,
    mlsMpmGpuParticleState: nextMlsMpmGpuParticleState = null,
    staticTableCache = null
  }) {
    const timingStartMs = nowMs();
    const stageMs = {};
    const measure = (name, fn) => {
      const startMs = nowMs();
      try {
        return fn();
      } finally {
        stageMs[name] = Math.max(0, nowMs() - startMs);
      }
    };
    const batches = measure('surfaceBatching', () => createContinuousSurfaceBatches({
      positionsM,
      colorsRgb,
      materials,
      boxEdgeM,
      boxDimsM: dims,
      smoothingLengthM: nextSphGpuParticleState?.smoothingLengthM ?? null
    }));
    currentMaterialProperties = materialProperties || null;
    sphThermalMaterialTable = measure('thermalMaterialTable', () => (
      staticTableCache?.thermalMaterialTable?.schema
        ? staticTableCache.thermalMaterialTable
        : materialProperties
        ? buildSphThermalMaterialTable(materialProperties)
        : null
    ));
    sphThermalClosureGraphBuffers = measure('thermalClosureGraphs', () => (
      staticTableCache?.thermalClosureGraphSet?.schema
        ? staticTableCache.thermalClosureGraphSet
        : sphThermalMaterialTable
        ? buildSphThermalClosureGraphBuffers(sphThermalMaterialTable)
        : null
    ));
    sphThermalPhaseResponseTable = measure('thermalPhaseResponse', () => (
      staticTableCache?.thermalPhaseResponseTable?.schema
        ? staticTableCache.thermalPhaseResponseTable
        : sphThermalMaterialTable && sphThermalClosureGraphBuffers
        ? buildSphThermalPhaseResponseTable(sphThermalMaterialTable, sphThermalClosureGraphBuffers)
        : null
    ));
    const nextThermalResponseGraphSignature = sphThermalResponseGraphSignature();
    if (
      sphThermalResponseGraphUpload
      && sphThermalResponseGraphUploadSignature !== nextThermalResponseGraphSignature
    ) {
      if (sphThermalResponseGraphUpload.status === 'webgpu-uploaded') {
        destroySphThermalResponseGraphBuffers(sphThermalResponseGraphUpload);
      }
      sphThermalResponseGraphUpload = null;
      sphThermalResponseGraphUploadSignature = null;
      scene.userData.sphThermalResponseGraphUpload = null;
    }
    sphReactionTable = measure('reactionTable', () => (
      staticTableCache?.reactionTable?.schema
        ? staticTableCache.reactionTable
        : materialProperties
        ? buildSphReactionTable(reactions || [], {
        materialProperties,
        contactRadiusM: reactionContactRadiusM ?? nextSphGpuParticleState?.smoothingLengthM ?? 0
      })
        : null
    ));
    const residentFieldBatches = measure('residentSurfaceBatches', () => createResidentRenderSurfaceBatches({
      particleBatches: batches,
      materialProperties,
      reactionTable: sphReactionTable,
      smoothingLengthM: nextSphGpuParticleState?.smoothingLengthM ?? null
    }));
    const nextSurfaceBatchIdentitySignature = residentSurfaceBatchIdentitySignature(residentFieldBatches);
    measure('opticalState', () => rebuildOpticalStateForSurfaceBatchesWithCache(residentFieldBatches, {
      materialProperties,
      cachedOpticalGpuTable: staticTableCache?.opticalGpuTable || null
    }));
    const residentSurfaceState = measure('residentSurfaceTable', () => captureResidentRenderSurfaceState({
      particleBatches: batches,
      fieldBatches: residentFieldBatches,
      emissiveByMaterial,
      materialProperties
    }));
    scene.userData.sphThermalMaterialTable = sphThermalMaterialTable;
    scene.userData.sphThermalClosureGraphBuffers = sphThermalClosureGraphBuffers;
    scene.userData.sphThermalPhaseResponseTable = sphThermalPhaseResponseTable;
    scene.userData.sphThermalResponseGraphUpload = sphThermalResponseGraphUpload;
    scene.userData.sphReactionTable = sphReactionTable;
    if (shouldRetainResidentSurfaceDrawOverlay({
      previousSurfaceBatchSignature: currentSurfaceBatchIdentitySignature,
      nextSurfaceBatchSignature: nextSurfaceBatchIdentitySignature,
      hasResidentSurfaceDraw: Boolean(sphResidentSurfaceDraw?.surfaceDraw),
      hasResidentRenderBridge: Boolean(sphResidentSurfaceDrawRenderBridge?.drawState)
    })) {
      markSphResidentSurfaceDrawOverlayRetained('cpu-particle-sync-pending-resident-overlay-refresh');
    } else {
      clearSphResidentSurfaceDrawArtifacts();
    }
    currentSurfaceBatchIdentitySignature = nextSurfaceBatchIdentitySignature;
    sphResidentRenderState = null;
    scene.userData.sphResidentRenderState = null;
    destroyPressureInterfaceForceRowsUpload();
    if (
      sphGpuParticleUpload?.status === 'webgpu-uploaded'
      && sphGpuParticleUploadSignature !== sphGpuParticleSignature(nextSphGpuParticleState)
    ) {
      destroySphGpuParticleBuffers(sphGpuParticleUpload);
    }
    sphGpuParticleState = nextSphGpuParticleState;
    scene.userData.sphGpuParticleState = sphGpuParticleState;
    sphGpuParticleUpload = null;
    sphGpuParticleUploadSignature = null;
    scene.userData.sphGpuParticleUpload = null;
    if (
      mlsMpmGpuParticleUpload?.status === 'webgpu-uploaded'
      && mlsMpmGpuParticleUploadSignature !== mlsMpmGpuParticleSignature(nextMlsMpmGpuParticleState)
    ) {
      destroyMlsMpmGpuParticleBuffers(mlsMpmGpuParticleUpload);
    }
    mlsMpmGpuParticleState = nextMlsMpmGpuParticleState;
    scene.userData.mlsMpmGpuParticleState = mlsMpmGpuParticleState;
    mlsMpmGpuParticleUpload = null;
    mlsMpmGpuParticleUploadSignature = null;
    scene.userData.mlsMpmGpuParticleUpload = null;
    mlsMpmMechanicsPrediction = null;
    mlsMpmMechanicsPredictionSignature = null;
    scene.userData.mlsMpmMechanicsPrediction = null;
    clearMlsMpmResidentExecutionArtifacts();
    measure('surfaceApply', () => applySurfaceBatches(batches, {
      emissiveByMaterial,
      materialProperties,
      renderSource: 'cpu-particles'
    }));
    scene.userData.sphSetParticlesTiming = {
      schema: 'peercompute.ulg.sph-scene-set-particles-timing.v0',
      totalMs: Math.max(0, nowMs() - timingStartMs),
      stageMs,
      particleCount: positionsM?.length ? positionsM.length / 3 : 0,
      surfaceBatchCount: batches.length,
      residentSurfaceBatchCount: residentFieldBatches.length,
      residentSurfaceTableCellCount: residentSurfaceState.surfaceTableTotalFieldCells,
      materialCount: materialProperties ? Object.keys(materialProperties).length : 0,
      reactionCount: sphReactionTable?.reactionCount ?? 0,
      thermalMaterialCount: sphThermalMaterialTable?.materialCount ?? 0,
      opticalRecordCount: opticalGpuTable?.recordCount ?? 0,
      staticTableCacheStatus: staticTableCache?.status || null,
      staticTableCacheFamilies: staticTableCache?.restoredFamilies || [],
      surfaceApplyTiming: scene.userData.sphSurfaceApplyTiming || null,
      scientificValidation: false,
      sphValidation: false,
      phaseChangeValidation: false,
      fullPhysicsValidation: false
    };
  }

  function residentSurfaceDrawUnavailable(reason, {
    renderFieldExecution = null,
    surfaceVerticesExecution = null
  } = {}) {
    return {
      schema: 'peercompute.ulg.sph-resident-surface-draw.v0',
      status: 'resident-surface-draw-unavailable',
      reason,
      sourceRenderFieldSchema: renderFieldExecution?.schema ?? null,
      sourceSurfaceVertexSchema: surfaceVerticesExecution?.schema ?? null,
      surfaceDrawSchema: null,
      surfaceCount: renderFieldExecution?.surfaceCount ?? surfaceVerticesExecution?.surfaceCount ?? 0,
      sourceVertexRowCount: 0,
      drawRowsBufferRetained: false,
      drawRowsBufferByteLength: 0,
      drawIndirectRowsBufferRetained: false,
      drawIndirectRowsBufferByteLength: 0,
      compactedVertexRowsBufferRetained: false,
      compactedVertexRowsBufferByteLength: 0,
      readbackMode: SPH_PHASE_RESIDENT_READBACK_MODE_DEFAULT,
      surfaceDrawReadback: false,
      compactionMode: null,
      renderFieldBufferMode: 'not-retained',
      surfaceDrawInputBuffersReleased: false,
      visibleRendererBridge: 'pending-three-webgpu-binding',
      visibleRenderSource: 'three-marching-cubes-fallback',
      renderBridgeSchema: null,
      renderBridgeStatus: null,
      renderBridgeReason: null,
      renderBridgeFrameCount: 0,
      renderBridgeLastRenderStatus: null,
      renderBridgeDrawOrderingPolicy: null,
      renderBridgeDrawOrderCount: 0,
      renderBridgeDrawOrderSurfaceIndices: [],
      renderBridgeDrawOrderIndirectOffsets: [],
      renderBridgeDepthPolicy: null,
      renderBridgeDepthAttachmentFormat: null,
      renderBridgeDepthAttachmentReady: false,
      renderBridgeTransparencyCompositeMode: null,
      renderBridgeOitAccumFormat: null,
      renderBridgeOitRevealFormat: null,
      renderBridgeOitTargetsReady: false,
      renderBridgeLastOpaqueDrawCount: 0,
      renderBridgeLastTransparentDrawCount: 0,
      renderBridgeOpticalRenderSource: null,
      renderBridgeOpticalRecordCount: 0,
      renderBridgeOpticalRecordStrideFloats: 0,
      renderBridgeOpticalSpectralSampleCount: 0,
      renderBridgeOpticalSpectralSampleStrideFloats: 0,
      renderBridgeTemporalSwapPolicy: null,
      renderBridgeRetainedPreviousOverlay: false,
      scientificValidation: false,
      sphValidation: false,
      surfaceExtractionValidation: false,
      fullPhysicsValidation: false
    };
  }

  async function buildSphResidentSurfaceDrawBridge({
    device,
    renderFieldExecution
  } = {}) {
    let surfaceVerticesExecution = null;
    let surfaceDrawExecution = null;
    try {
      if (
        renderFieldExecution?.schema !== 'peercompute.ulg.sph-gpu-render-field.v0'
        || renderFieldExecution.backend !== 'webgpu'
        || !renderFieldExecution.fieldRowsBuffer
        || !renderFieldExecution.surfaceBuffer
      ) {
        return residentSurfaceDrawUnavailable('retained WebGPU render-field buffers are not available', {
          renderFieldExecution
        });
      }
      surfaceVerticesExecution = await buildSphRenderSurfaceVerticesWebGpu({
        device,
        renderField: renderFieldExecution,
        fieldRowsBuffer: renderFieldExecution.fieldRowsBuffer,
        surfaceBuffer: renderFieldExecution.surfaceBuffer,
        readbackMode: SPH_PHASE_RESIDENT_READBACK_MODE_DEFAULT,
        retainVertexRowsBuffer: true
      });
      surfaceDrawExecution = await buildSphRenderSurfaceDrawMetadataWebGpu({
        device,
        surfaceVertices: surfaceVerticesExecution,
        surfaceBuffer: renderFieldExecution.surfaceBuffer,
        readbackMode: SPH_PHASE_RESIDENT_READBACK_MODE_DEFAULT,
        retainDrawRowsBuffer: true,
        retainDrawIndirectRowsBuffer: true,
        retainCompactedVertexRowsBuffer: true
      });
      const renderBridge = createSphResidentSurfaceDrawRenderBridge({
        device,
        surfaceDrawExecution
      });
      const renderBridgeReady = renderBridge?.status === 'webgpu-storage-indirect-overlay-ready';
      return {
        schema: 'peercompute.ulg.sph-resident-surface-draw.v0',
        status: surfaceDrawExecution.status === 'surface-draw-resident'
          ? 'resident-surface-draw-buffers-retained'
          : 'resident-surface-draw-built',
        sourceRenderFieldSchema: renderFieldExecution.schema,
        sourceSurfaceVertexSchema: surfaceVerticesExecution.schema,
        surfaceDrawSchema: surfaceDrawExecution.schema,
        sourceRenderFieldBackend: renderFieldExecution.backend,
        sourceSurfaceVertexBackend: surfaceVerticesExecution.backend,
        surfaceDrawBackend: surfaceDrawExecution.backend,
        surfaceCount: surfaceDrawExecution.surfaceCount,
        sourceVertexRowCount: surfaceDrawExecution.sourceVertexRowCount,
        drawRowsBufferRetained: Boolean(surfaceDrawExecution.drawRowsBufferRetained),
        drawRowsBufferByteLength: surfaceDrawExecution.drawRowsBufferByteLength ?? 0,
        drawIndirectSchema: surfaceDrawExecution.drawIndirectSchema ?? null,
        drawIndirectRowStrideUints: surfaceDrawExecution.drawIndirectRowStrideUints ?? 0,
        drawIndirectRowsBufferRetained: Boolean(surfaceDrawExecution.drawIndirectRowsBufferRetained),
        drawIndirectRowsBufferByteLength: surfaceDrawExecution.drawIndirectRowsBufferByteLength ?? 0,
        compactedVertexRowsBufferRetained: Boolean(surfaceDrawExecution.compactedVertexRowsBufferRetained),
        compactedVertexRowsBufferByteLength: surfaceDrawExecution.compactedVertexRowsBufferByteLength ?? 0,
        readbackMode: surfaceDrawExecution.readbackMode,
        surfaceDrawReadback: Boolean(surfaceDrawExecution.surfaceDrawReadback),
        compactionMode: surfaceDrawExecution.compactionMode,
        renderFieldBufferMode: 'released-after-surface-draw',
        surfaceVertexBufferMode: 'released-after-surface-draw',
        surfaceDrawBufferMode: 'retained-compact-draw-buffers',
        surfaceDrawInputBuffersReleased: true,
        visibleRendererBridge: renderBridgeReady
          ? 'webgpu-storage-indirect-overlay'
          : (renderBridge?.rendererBridge || 'pending-three-webgpu-binding'),
        visibleRenderSource: renderBridgeReady
          ? 'resident-surface-draw-buffers'
          : 'three-marching-cubes-fallback',
        renderBridgeSchema: renderBridge?.schema ?? null,
        renderBridgeStatus: renderBridge?.status ?? null,
        renderBridgeReason: renderBridge?.reason ?? null,
        renderBridgeFrameCount: renderBridge?.frameCount ?? 0,
        renderBridgeLastRenderStatus: renderBridge?.lastRenderStatus ?? null,
        renderBridgeDrawOrderingPolicy: renderBridge?.drawOrderingPolicy ?? null,
        renderBridgeDrawOrderCount: renderBridge?.drawOrderCount ?? 0,
        renderBridgeDrawOrderSurfaceIndices: [...(renderBridge?.drawOrderSurfaceIndices || [])],
        renderBridgeDrawOrderIndirectOffsets: [...(renderBridge?.drawOrderIndirectOffsets || [])],
        renderBridgeDepthPolicy: renderBridge?.depthPolicy ?? null,
        renderBridgeDepthAttachmentFormat: renderBridge?.depthAttachmentFormat ?? null,
        renderBridgeDepthAttachmentReady: Boolean(renderBridge?.depthAttachmentReady),
        renderBridgeTransparencyCompositeMode: renderBridge?.transparencyCompositeMode ?? null,
        renderBridgeOitAccumFormat: renderBridge?.oitAccumFormat ?? null,
        renderBridgeOitRevealFormat: renderBridge?.oitRevealFormat ?? null,
        renderBridgeOitTargetsReady: Boolean(renderBridge?.oitTargetsReady),
        renderBridgeLastOpaqueDrawCount: renderBridge?.lastOpaqueDrawCount ?? 0,
        renderBridgeLastTransparentDrawCount: renderBridge?.lastTransparentDrawCount ?? 0,
        renderBridgeOpticalRenderSource: renderBridge?.opticalRenderSource ?? null,
        renderBridgeOpticalRecordCount: renderBridge?.opticalRecordCount ?? 0,
        renderBridgeOpticalRecordStrideFloats: renderBridge?.opticalRecordStrideFloats ?? 0,
        renderBridgeOpticalSpectralSampleCount: renderBridge?.opticalSpectralSampleCount ?? 0,
        renderBridgeOpticalSpectralSampleStrideFloats: renderBridge?.opticalSpectralSampleStrideFloats ?? 0,
        renderBridgeTemporalSwapPolicy: renderBridge?.temporalSwapPolicy ?? null,
        renderBridgeRetainedPreviousOverlay: Boolean(renderBridge?.retainedPreviousOverlay),
        surfaceDraw: surfaceDrawExecution,
        scientificValidation: false,
        sphValidation: false,
        surfaceExtractionValidation: false,
        fullPhysicsValidation: false
      };
    } catch (error) {
      surfaceDrawExecution?.destroySurfaceDrawBuffers?.();
      return residentSurfaceDrawUnavailable(error instanceof Error ? error.message : String(error), {
        renderFieldExecution,
        surfaceVerticesExecution
      });
    } finally {
      surfaceVerticesExecution?.destroySurfaceVertexBuffers?.();
      renderFieldExecution?.destroyRenderFieldBuffers?.();
    }
  }

  async function refreshSphResidentRenderState({
    preferWebGpu = true,
    navigatorRef: overrideNavigatorRef = navigatorRef,
    device = null,
    deviceResult = null,
    residentSteps = mlsMpmResidentSteps,
    materialProperties = null,
    gasPressureSummary = null
  } = {}) {
    const previousResidentSurfaceDraw = sphResidentSurfaceDraw;
    const previousResidentRenderBridge = sphResidentSurfaceDrawRenderBridge;
    const finalStep = residentSteps?.finalStep || mlsMpmResidentStep || null;
    const nextSphParticleState = residentSteps?.nextSphParticleState || sphGpuParticleState;
    const nextSphUpload = residentSteps?.nextParticleUploads?.sphParticleUpload
      || finalStep?.nextParticleUploads?.sphParticleUpload
      || null;
    if (!nextSphParticleState?.schema || nextSphUpload?.status !== 'webgpu-uploaded') {
      sphResidentRenderState = {
        schema: 'peercompute.ulg.sph-resident-render-state.v0',
        status: 'resident-render-rows-unavailable',
        source: 'cpu-particles',
        reason: 'retained resident SPH buffers are not available',
        particleCount: nextSphParticleState?.particleCount ?? 0,
        surfaceDrawVisibleRenderSource: sphResidentSurfaceDraw?.visibleRenderSource ?? null,
        surfaceDrawVisibleRendererBridge: sphResidentSurfaceDraw?.visibleRendererBridge ?? null,
        surfaceDrawRenderBridgeStatus: sphResidentSurfaceDrawRenderBridge?.status ?? null,
        surfaceDrawRenderBridgeTemporalSwapPolicy: sphResidentSurfaceDrawRenderBridge?.temporalSwapPolicy ?? null,
        surfaceDrawRenderBridgeRetainedPreviousOverlay: Boolean(sphResidentSurfaceDrawRenderBridge?.retainedPreviousOverlay),
        gpuAuthoritativeState: false,
        compactRenderReadback: false,
        scientificValidation: false,
        sphValidation: false,
        phaseChangeValidation: false,
        fullPhysicsValidation: false
      };
      scene.userData.sphResidentRenderState = sphResidentRenderState;
      return sphResidentRenderState;
    }
    const resolvedDeviceResult = device
      ? { status: 'webgpu-device-ready', reason: 'provided device', device }
      : (deviceResult || (preferWebGpu ? await requestCachedOpticalGpuDevice(overrideNavigatorRef) : null));
    if (!resolvedDeviceResult?.device) {
      sphResidentRenderState = {
        schema: 'peercompute.ulg.sph-resident-render-state.v0',
        status: 'resident-render-webgpu-unavailable',
        source: 'cpu-particles',
        reason: resolvedDeviceResult?.reason || 'WebGPU render-row extraction not available',
        particleCount: nextSphParticleState.particleCount,
        surfaceDrawVisibleRenderSource: sphResidentSurfaceDraw?.visibleRenderSource ?? null,
        surfaceDrawVisibleRendererBridge: sphResidentSurfaceDraw?.visibleRendererBridge ?? null,
        surfaceDrawRenderBridgeStatus: sphResidentSurfaceDrawRenderBridge?.status ?? null,
        surfaceDrawRenderBridgeTemporalSwapPolicy: sphResidentSurfaceDrawRenderBridge?.temporalSwapPolicy ?? null,
        surfaceDrawRenderBridgeRetainedPreviousOverlay: Boolean(sphResidentSurfaceDrawRenderBridge?.retainedPreviousOverlay),
        gpuAuthoritativeState: false,
        compactRenderReadback: false,
        scientificValidation: false,
        sphValidation: false,
        phaseChangeValidation: false,
        fullPhysicsValidation: false
      };
      scene.userData.sphResidentRenderState = sphResidentRenderState;
      return sphResidentRenderState;
    }
    let renderRowsExecution = null;
    try {
      const reactionResult = finalStep?.reactionStep?.result || finalStep?.reactionStep || null;
      const reactionSummary = reactionResult?.reactionSummary || null;
      const residentProductMass = finalStep?.residentProductMass || reactionResult?.residentProductMass || null;
      const productEventBuffer = residentProductMass?.productEventBuffer || reactionSummary?.productEventBuffer || null;
      const productEventCount = Math.max(0, Math.round(Number(
        residentProductMass?.productEventRowCount ?? reactionSummary?.productEventRowCount
      ) || 0));
      renderRowsExecution = await extractSphRenderRowsWebGpu({
        device: resolvedDeviceResult.device,
        sphParticleState: nextSphParticleState,
        sphParticleUpload: nextSphUpload,
        sourceStateBuffer: nextSphUpload.stateBuffer,
        sourceThermoBuffer: nextSphUpload.thermoBuffer,
        retainRenderRowsBuffer: true,
        readbackMode: SPH_PHASE_RESIDENT_READBACK_MODE_DEFAULT
      });
      const hasRenderRowsReadback = renderRowsExecution.renderRows instanceof Float32Array
        && renderRowsExecution.renderRows.length > 0;
      let decoded = null;
      let particleBatches = [];
      if (hasRenderRowsReadback) {
        decoded = decodeSphRenderRows(renderRowsExecution.renderRows, {
          materialProperties: materialProperties || {},
          reactionTable: sphReactionTable,
          gasPressureSummary
        });
        particleBatches = createContinuousSurfaceBatches({
          positionsM: decoded.positionsM,
          colorsRgb: decoded.colorsRgb,
          materials: decoded.materials,
          boxEdgeM,
          boxDimsM: dims,
          smoothingLengthM: nextSphParticleState?.smoothingLengthM ?? null
        });
      } else {
        particleBatches = sphResidentRenderSurfaceState?.particleBatches || [];
      }
      const productEventSurfaceBatches = createProductEventSurfaceBatches({
        baseBatches: particleBatches,
        reactionSummary,
        reactionTable: sphReactionTable,
        materialProperties,
        smoothingLengthM: nextSphParticleState?.smoothingLengthM ?? null
      });
      const canReuseResidentSurfaceTable = !hasRenderRowsReadback
        && productEventSurfaceBatches.length === 0
        && sphResidentRenderSurfaceState?.surfaceTable?.schema;
      const fieldBatches = canReuseResidentSurfaceTable
        ? sphResidentRenderSurfaceState.fieldBatches
        : createResidentRenderSurfaceBatches({
          particleBatches,
          productEventSurfaceBatches,
          materialProperties,
          reactionTable: sphReactionTable,
          smoothingLengthM: nextSphParticleState?.smoothingLengthM ?? null
        });
      if (!decoded) {
        decoded = {
          schema: 'peercompute.ulg.sph-gpu-render-rows-decoded.v0',
          status: 'render-rows-decode-skipped-resident-no-full-readback',
          particleCount: nextSphParticleState.particleCount,
          positionsM: new Float32Array(),
          colorsRgb: new Float32Array(),
          materials: fieldBatches.map((batch) => batch.descriptor),
          rows: [],
          emissiveByMaterial: sphResidentRenderSurfaceState?.emissiveByMaterial || {}
        };
      }
      if (!canReuseResidentSurfaceTable) {
        rebuildOpticalStateForSurfaceBatches(fieldBatches, { materialProperties });
        captureResidentRenderSurfaceState({
          particleBatches,
          fieldBatches,
          emissiveByMaterial: decoded.emissiveByMaterial,
          materialProperties
        });
      }
      const surfaceTable = canReuseResidentSurfaceTable
        ? sphResidentRenderSurfaceState.surfaceTable
        : sphResidentRenderSurfaceState.surfaceTable;
      let renderFieldExecution = null;
      let materialInterfaceField = null;
      let renderFieldSource = 'resident-gpu-render-field';
      let nextResidentSurfaceDraw = null;
      try {
        renderFieldExecution = await buildSphRenderFieldWebGpu({
          device: resolvedDeviceResult.device,
          renderRows: renderRowsExecution.renderRows,
          renderRowsBuffer: renderRowsExecution.renderRowsBuffer || null,
          productEventBuffer,
          productEventCount,
          surfaceTable,
          particleCount: renderRowsExecution.particleCount,
          fieldPadding: FIELD_PADDING,
          refEdgeM,
          readbackMode: SPH_THREE_VISIBLE_RENDER_FIELD_READBACK_MODE,
          retainFieldRowsBuffer: true,
          retainSurfaceBuffer: true
        });
        if (renderFieldExecution.fieldRows instanceof Float32Array && renderFieldExecution.fieldRows.length > 0) {
          materialInterfaceField = deriveSphMaterialInterfaceField(renderFieldExecution);
          const surfaceFields = splitSphRenderFieldBySurface(renderFieldExecution);
          applySurfaceFields(surfaceFields, {
            emissiveByMaterial: decoded.emissiveByMaterial,
            materialProperties,
            renderSource: renderFieldSource,
            renderRowsExecution,
            renderFieldExecution
          });
        } else {
          materialInterfaceField = {
            schema: 'peercompute.ulg.sph-material-interface-field.v0',
            status: 'material-interface-field-gpu-resident-summary-pending',
            sourceRenderFieldSchema: renderFieldExecution.schema,
            sourceRenderFieldStatus: renderFieldExecution.status,
            sourceRenderFieldReadback: Boolean(renderFieldExecution.renderFieldReadback),
            surfaceCount: surfaceTable.surfaceCount,
            readySurfaceCount: 0,
            totalSurfaceAreaM2: 0,
            elementCount: 0,
            elements: [],
            scientificValidation: false,
            sphValidation: false,
            surfaceExtractionValidation: false,
            fullPhysicsValidation: false
          };
        }
      } catch (fieldError) {
        renderFieldSource = 'resident-gpu-render-rows';
        applySurfaceBatches(particleBatches, {
          emissiveByMaterial: decoded.emissiveByMaterial,
          materialProperties,
          renderSource: renderFieldSource,
          renderRowsExecution
        });
        renderFieldExecution = {
          schema: 'peercompute.ulg.sph-gpu-render-field.v0',
          backend: 'cpu-fallback',
          status: 'render-field-fallback-to-render-rows',
          reason: fieldError instanceof Error ? fieldError.message : String(fieldError),
          surfaceCount: surfaceTable.surfaceCount,
          totalFieldCells: surfaceTable.totalFieldCells,
          productEventCount: 0,
          productEventBufferBound: false,
          productEventBufferByteLength: 0,
          renderFieldInputSource: null,
          renderFieldReadback: false,
          scientificValidation: false,
          sphValidation: false,
          phaseChangeValidation: false,
          fullPhysicsValidation: false
        };
      }
      if (renderFieldSource === 'resident-gpu-render-field') {
        if (SPH_RAW_WEBGPU_SURFACE_OVERLAY_ENABLED) {
          nextResidentSurfaceDraw = await buildSphResidentSurfaceDrawBridge({
            device: resolvedDeviceResult.device,
            renderFieldExecution
          });
        } else {
          renderFieldExecution?.destroyRenderFieldBuffers?.();
          nextResidentSurfaceDraw = residentSurfaceDrawUnavailable(
            SPH_THREE_WEBGPU_BINDING_REASON,
            { renderFieldExecution }
          );
          nextResidentSurfaceDraw.visibleRendererBridge = 'three-marching-cubes';
          nextResidentSurfaceDraw.visibleRenderSource = 'three-managed-render-field-readback';
          nextResidentSurfaceDraw.renderFieldBufferMode = 'released-after-three-marching-cubes-readback';
          nextResidentSurfaceDraw.renderBridgeSchema = 'peercompute.ulg.sph-resident-surface-draw-render-bridge.v0';
          nextResidentSurfaceDraw.renderBridgeStatus = 'surface-draw-overlay-disabled';
          nextResidentSurfaceDraw.renderBridgeReason = SPH_THREE_WEBGPU_BINDING_REASON;
        }
      } else {
        nextResidentSurfaceDraw = residentSurfaceDrawUnavailable(
          renderFieldExecution?.reason || 'render field fell back to render rows',
          { renderFieldExecution }
        );
      }
      sphResidentSurfaceDraw = nextResidentSurfaceDraw;
      scene.userData.sphResidentSurfaceDraw = sphResidentSurfaceDraw;
      if (nextResidentSurfaceDraw?.visibleRendererBridge === 'webgpu-storage-indirect-overlay') {
        releasePreviousSphResidentSurfaceDrawResources(previousResidentSurfaceDraw, previousResidentRenderBridge);
      } else {
        clearSphResidentSurfaceDrawArtifacts();
        sphResidentSurfaceDraw = nextResidentSurfaceDraw;
        scene.userData.sphResidentSurfaceDraw = sphResidentSurfaceDraw;
      }
      await refreshOpticalGpuLookup({
        preferWebGpu,
        navigatorRef: overrideNavigatorRef,
        device,
        deviceResult: resolvedDeviceResult
      });
      const pressureInterfaceCoupling = gasPressureInterfaceCouplingSummary({
        pressureFeedback: gasPressureSummary?.pressureFeedback || null,
        materialInterfaceField
      });
      const pressureInterfaceForcePreview = gasPressureInterfaceForcePreview({
        pressureFeedback: gasPressureSummary?.pressureFeedback || null,
        materialInterfaceField,
        pressureInterfaceCoupling
      });
      const pressureInterfaceForceSolver = gasPressureInterfaceForceSolver({
        pressureFeedback: gasPressureSummary?.pressureFeedback || null,
        materialInterfaceField,
        pressureInterfaceCoupling
      });
      const pressureInterfaceForceRowsUploadForState = uploadPressureInterfaceForceRowsBuffer({
        pressureInterfaceForceSolver,
        device: device || resolvedDeviceResult?.device || null
      });
      sphResidentRenderState = {
        schema: 'peercompute.ulg.sph-resident-render-state.v0',
        status: renderFieldSource === 'resident-gpu-render-field'
          ? 'resident-render-field-applied'
          : 'resident-render-rows-applied',
        source: renderFieldSource,
        sourceExecutionSchema: renderFieldSource === 'resident-gpu-render-field'
          ? renderFieldExecution.schema
          : renderRowsExecution.schema,
        backend: renderFieldSource === 'resident-gpu-render-field'
          ? renderFieldExecution.backend
          : renderRowsExecution.backend,
        particleCount: decoded.particleCount,
        surfaceCount: fieldBatches.length,
        rowStrideFloats: renderRowsExecution.rowStrideFloats,
        renderRowByteLength: renderRowsExecution.renderRowByteLength,
        renderRowsReadbackByteLength: renderRowsExecution.renderRowsReadbackByteLength ?? renderRowsExecution.renderRows?.byteLength ?? 0,
        renderRowsReadback: Boolean(renderRowsExecution.renderRowsReadback),
        renderRowsReadbackMode: renderRowsExecution.readbackMode ?? null,
        renderFieldCellStrideFloats: renderFieldExecution?.rowStrideFloats ?? null,
        renderFieldByteLength: renderFieldExecution?.fieldRowByteLength ?? 0,
        renderFieldReadback: Boolean(renderFieldExecution?.renderFieldReadback),
        renderFieldStatus: renderFieldExecution?.status ?? null,
        renderFieldBackend: renderFieldExecution?.backend ?? null,
        renderFieldInputSource: renderFieldExecution?.renderFieldInputSource ?? null,
        renderFieldSurfaceCount: renderFieldExecution?.surfaceCount ?? surfaceTable.surfaceCount,
        renderFieldTotalCells: renderFieldExecution?.totalFieldCells ?? surfaceTable.totalFieldCells,
        renderFieldBufferMode: sphResidentSurfaceDraw?.renderFieldBufferMode ?? null,
        surfaceDrawSchema: sphResidentSurfaceDraw?.schema ?? null,
        surfaceDrawStatus: sphResidentSurfaceDraw?.status ?? null,
        surfaceDrawReason: sphResidentSurfaceDraw?.reason ?? null,
        surfaceDrawSourceRenderFieldSchema: sphResidentSurfaceDraw?.sourceRenderFieldSchema ?? null,
        surfaceDrawSourceSurfaceVertexSchema: sphResidentSurfaceDraw?.sourceSurfaceVertexSchema ?? null,
        surfaceDrawSurfaceDrawSchema: sphResidentSurfaceDraw?.surfaceDrawSchema ?? null,
        surfaceDrawSurfaceCount: sphResidentSurfaceDraw?.surfaceCount ?? 0,
        surfaceDrawSourceVertexRowCount: sphResidentSurfaceDraw?.sourceVertexRowCount ?? 0,
        surfaceDrawRowsBufferRetained: Boolean(sphResidentSurfaceDraw?.drawRowsBufferRetained),
        surfaceDrawRowsBufferByteLength: sphResidentSurfaceDraw?.drawRowsBufferByteLength ?? 0,
        surfaceDrawIndirectSchema: sphResidentSurfaceDraw?.drawIndirectSchema ?? null,
        surfaceDrawIndirectRowStrideUints: sphResidentSurfaceDraw?.drawIndirectRowStrideUints ?? 0,
        surfaceDrawIndirectRowsBufferRetained: Boolean(sphResidentSurfaceDraw?.drawIndirectRowsBufferRetained),
        surfaceDrawIndirectRowsBufferByteLength: sphResidentSurfaceDraw?.drawIndirectRowsBufferByteLength ?? 0,
        surfaceDrawCompactedVertexRowsBufferRetained: Boolean(sphResidentSurfaceDraw?.compactedVertexRowsBufferRetained),
        surfaceDrawCompactedVertexRowsBufferByteLength: sphResidentSurfaceDraw?.compactedVertexRowsBufferByteLength ?? 0,
        surfaceDrawReadback: Boolean(sphResidentSurfaceDraw?.surfaceDrawReadback),
        surfaceDrawReadbackMode: sphResidentSurfaceDraw?.readbackMode ?? null,
        surfaceDrawCompactionMode: sphResidentSurfaceDraw?.compactionMode ?? null,
        surfaceDrawInputBuffersReleased: Boolean(sphResidentSurfaceDraw?.surfaceDrawInputBuffersReleased),
        surfaceDrawVisibleRenderSource: sphResidentSurfaceDraw?.visibleRenderSource ?? null,
        surfaceDrawVisibleRendererBridge: sphResidentSurfaceDraw?.visibleRendererBridge ?? null,
        surfaceDrawRenderBridgeSchema: sphResidentSurfaceDraw?.renderBridgeSchema ?? null,
        surfaceDrawRenderBridgeStatus: sphResidentSurfaceDraw?.renderBridgeStatus ?? null,
        surfaceDrawRenderBridgeReason: sphResidentSurfaceDraw?.renderBridgeReason ?? null,
        surfaceDrawRenderBridgeFrameCount: sphResidentSurfaceDraw?.renderBridgeFrameCount ?? 0,
        surfaceDrawRenderBridgeLastRenderStatus: sphResidentSurfaceDraw?.renderBridgeLastRenderStatus ?? null,
        surfaceDrawRenderBridgeDrawOrderingPolicy: sphResidentSurfaceDraw?.renderBridgeDrawOrderingPolicy ?? null,
        surfaceDrawRenderBridgeDrawOrderCount: sphResidentSurfaceDraw?.renderBridgeDrawOrderCount ?? 0,
        surfaceDrawRenderBridgeDrawOrderSurfaceIndices: [...(sphResidentSurfaceDraw?.renderBridgeDrawOrderSurfaceIndices || [])],
        surfaceDrawRenderBridgeDrawOrderIndirectOffsets: [...(sphResidentSurfaceDraw?.renderBridgeDrawOrderIndirectOffsets || [])],
        surfaceDrawRenderBridgeDepthPolicy: sphResidentSurfaceDraw?.renderBridgeDepthPolicy ?? null,
        surfaceDrawRenderBridgeDepthAttachmentFormat: sphResidentSurfaceDraw?.renderBridgeDepthAttachmentFormat ?? null,
        surfaceDrawRenderBridgeDepthAttachmentReady: Boolean(sphResidentSurfaceDraw?.renderBridgeDepthAttachmentReady),
        surfaceDrawRenderBridgeTransparencyCompositeMode: sphResidentSurfaceDraw?.renderBridgeTransparencyCompositeMode ?? null,
        surfaceDrawRenderBridgeOitAccumFormat: sphResidentSurfaceDraw?.renderBridgeOitAccumFormat ?? null,
        surfaceDrawRenderBridgeOitRevealFormat: sphResidentSurfaceDraw?.renderBridgeOitRevealFormat ?? null,
        surfaceDrawRenderBridgeOitTargetsReady: Boolean(sphResidentSurfaceDraw?.renderBridgeOitTargetsReady),
        surfaceDrawRenderBridgeLastOpaqueDrawCount: sphResidentSurfaceDraw?.renderBridgeLastOpaqueDrawCount ?? 0,
        surfaceDrawRenderBridgeLastTransparentDrawCount: sphResidentSurfaceDraw?.renderBridgeLastTransparentDrawCount ?? 0,
        surfaceDrawRenderBridgeOpticalRenderSource: sphResidentSurfaceDraw?.renderBridgeOpticalRenderSource ?? null,
        surfaceDrawRenderBridgeOpticalRecordCount: sphResidentSurfaceDraw?.renderBridgeOpticalRecordCount ?? 0,
        surfaceDrawRenderBridgeOpticalRecordStrideFloats: sphResidentSurfaceDraw?.renderBridgeOpticalRecordStrideFloats ?? 0,
        surfaceDrawRenderBridgeOpticalSpectralSampleCount: sphResidentSurfaceDraw?.renderBridgeOpticalSpectralSampleCount ?? 0,
        surfaceDrawRenderBridgeOpticalSpectralSampleStrideFloats: sphResidentSurfaceDraw?.renderBridgeOpticalSpectralSampleStrideFloats ?? 0,
        surfaceDrawRenderBridgeTemporalSwapPolicy: sphResidentSurfaceDraw?.renderBridgeTemporalSwapPolicy
          ?? sphResidentSurfaceDrawRenderBridge?.temporalSwapPolicy
          ?? null,
        surfaceDrawRenderBridgeRetainedPreviousOverlay: Boolean(
          sphResidentSurfaceDraw?.renderBridgeRetainedPreviousOverlay
          || sphResidentSurfaceDrawRenderBridge?.retainedPreviousOverlay
        ),
        renderRowsBufferRetained: Boolean(renderRowsExecution.renderRowsBufferRetained),
        renderRowsBufferByteLength: renderRowsExecution.renderRowsBufferByteLength ?? 0,
        productEventCount,
        productEventBufferBound: Boolean(renderFieldExecution?.productEventBufferBound),
        productEventBufferByteLength: renderFieldExecution?.productEventBufferByteLength ?? 0,
        residentProductMassStatus: residentProductMass?.status ?? null,
        residentProductMassEosCouplingStatus: residentProductMass?.eosCouplingStatus ?? null,
        productEventSurfaceCount: productEventSurfaceBatches.length,
        productEventSurfaceKeys: productEventSurfaceBatches.map((batch) => batch.surfaceKey),
        compactRenderReadback: Boolean(renderRowsExecution.compactRenderReadback),
        normalHotLoopReadbackFree: Boolean(
          renderRowsExecution.normalHotLoopReadbackFree
          && renderFieldExecution?.normalHotLoopReadbackFree
          && sphResidentSurfaceDraw?.surfaceDrawReadback === false
        ),
        residentSurfaceTableStatus: sphResidentRenderSurfaceState?.status ?? null,
        residentSurfaceTableSurfaceCount: sphResidentRenderSurfaceState?.surfaceTableSurfaceCount ?? 0,
        residentSurfaceTableTotalFieldCells: sphResidentRenderSurfaceState?.surfaceTableTotalFieldCells ?? 0,
        materialKeys: [...new Set(fieldBatches.map((batch) => batch.material))],
        phaseKeys: [...new Set(fieldBatches.map((batch) => batch.phase))],
        gasPressureSummaryStatus: gasPressureSummary?.status ?? null,
        gasPressureSummarySource: gasPressureSummary?.source ?? null,
        residentPressureOpticalStateApplied: decoded.materials.some((descriptor) => Boolean(descriptor.opticalState)),
        materialInterfaceField,
        materialInterfaceFieldSchema: materialInterfaceField?.schema ?? null,
        materialInterfaceFieldStatus: materialInterfaceField?.status ?? null,
        materialInterfaceReadySurfaceCount: materialInterfaceField?.readySurfaceCount ?? 0,
        materialInterfaceTotalSurfaceAreaM2: materialInterfaceField?.totalSurfaceAreaM2 ?? 0,
        materialInterfaceForceCouplingStatus: pressureInterfaceForceSolver.forceCouplingStatus
          ?? materialInterfaceField?.forceCouplingStatus
          ?? null,
        pressureInterfaceCoupling,
        pressureInterfaceCouplingSchema: pressureInterfaceCoupling.schema,
        pressureInterfaceCouplingStatus: pressureInterfaceCoupling.status,
        pressureInterfaceCouplingPreSolverStatus: pressureInterfaceCoupling.forceCouplingStatus,
        pressureInterfaceForceCouplingStatus: pressureInterfaceForceSolver.forceCouplingStatus
          ?? pressureInterfaceCoupling.forceCouplingStatus,
        pressureInterfaceForcePreview,
        pressureInterfaceForcePreviewSchema: pressureInterfaceForcePreview.schema,
        pressureInterfaceForcePreviewStatus: pressureInterfaceForcePreview.status,
        pressureInterfaceForceApplicationStatus: pressureInterfaceForcePreview.forceApplicationStatus,
        pressureInterfacePreviewedElementCount: pressureInterfaceForcePreview.previewedElementCount,
        pressureInterfaceTotalAbsForceN: pressureInterfaceForcePreview.totalAbsInterfaceForceN,
        pressureInterfaceForceSolver,
        pressureInterfaceForceSolverSchema: pressureInterfaceForceSolver.schema,
        pressureInterfaceForceSolverStatus: pressureInterfaceForceSolver.status,
        pressureInterfaceSolverApplicationStatus: pressureInterfaceForceSolver.forceApplicationStatus,
        pressureInterfaceSolverForceRowCount: pressureInterfaceForceSolver.forceRowCount,
        pressureInterfaceSolverConservationStatus: pressureInterfaceForceSolver.conservationStatus,
        pressureInterfaceSolverConservationResidualMagnitudeN: pressureInterfaceForceSolver.conservationResidualMagnitudeN,
        pressureInterfaceForceRowsUploadStatus: pressureInterfaceForceRowsUploadForState?.status ?? null,
        pressureInterfaceForceRowsBufferRetained: Boolean(pressureInterfaceForceRowsUploadForState?.bufferRetained),
        pressureInterfaceForceRowsBufferByteLength: pressureInterfaceForceRowsUploadForState?.forceRowByteLength ?? 0,
        pressureInterfaceForceRowsUploadSignature: pressureInterfaceForceRowsUploadForState?.signature ?? null,
        gpuAuthoritativeState: true,
        scientificValidation: false,
        sphValidation: false,
        phaseChangeValidation: false,
        fullPhysicsValidation: false
      };
      scene.userData.sphResidentRenderState = sphResidentRenderState;
      return sphResidentRenderState;
    } catch (error) {
      sphResidentRenderState = {
        schema: 'peercompute.ulg.sph-resident-render-state.v0',
        status: 'resident-render-rows-error',
        source: 'cpu-particles',
        reason: error instanceof Error ? error.message : String(error),
        particleCount: nextSphParticleState.particleCount,
        surfaceDrawVisibleRenderSource: sphResidentSurfaceDraw?.visibleRenderSource ?? null,
        surfaceDrawVisibleRendererBridge: sphResidentSurfaceDraw?.visibleRendererBridge ?? null,
        surfaceDrawRenderBridgeStatus: sphResidentSurfaceDrawRenderBridge?.status ?? null,
        surfaceDrawRenderBridgeTemporalSwapPolicy: sphResidentSurfaceDrawRenderBridge?.temporalSwapPolicy ?? null,
        surfaceDrawRenderBridgeRetainedPreviousOverlay: Boolean(sphResidentSurfaceDrawRenderBridge?.retainedPreviousOverlay),
        gpuAuthoritativeState: false,
        compactRenderReadback: false,
        scientificValidation: false,
        sphValidation: false,
        phaseChangeValidation: false,
        fullPhysicsValidation: false
      };
      scene.userData.sphResidentRenderState = sphResidentRenderState;
      return sphResidentRenderState;
    } finally {
      renderRowsExecution?.destroyRenderRowsBuffer?.();
    }
  }

  let running = true;
  function animate() {
    if (!running) return;
    controls.update();
    renderer.render(scene, camera);
    renderSphResidentSurfaceDrawOverlay();
    requestAnimationFrame(animate);
  }
  animate();

  function resize() {
    const w = container.clientWidth || width;
    const h = container.clientHeight || height;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
    resizeSphResidentSurfaceDrawOverlayCanvas();
  }
  window.addEventListener('resize', resize);

  function dispose() {
    running = false;
    window.removeEventListener('resize', resize);
    controls.dispose();
    for (const { mesh } of surfaces.values()) {
      mesh.geometry.dispose();
      mesh.material.dispose();
    }
    environment?.dispose?.();
    pmrem?.dispose?.();
    if (sphGpuParticleUpload?.status === 'webgpu-uploaded') destroySphGpuParticleBuffers(sphGpuParticleUpload);
    if (mlsMpmGpuParticleUpload?.status === 'webgpu-uploaded') destroyMlsMpmGpuParticleBuffers(mlsMpmGpuParticleUpload);
    if (sphThermalResponseGraphUpload?.status === 'webgpu-uploaded') {
      destroySphThermalResponseGraphBuffers(sphThermalResponseGraphUpload);
    }
    clearMlsMpmResidentExecutionArtifacts();
    clearSphResidentSurfaceDrawArtifacts();
    destroyPressureInterfaceForceRowsUpload();
    if (sphResidentSurfaceDrawRenderBridge?.canvas?.parentNode) {
      sphResidentSurfaceDrawRenderBridge.canvas.parentNode.removeChild(sphResidentSurfaceDrawRenderBridge.canvas);
    }
    sphResidentSurfaceDrawRenderBridge = null;
    scene.userData.sphResidentSurfaceDrawRenderBridge = null;
    renderer.dispose();
    if (renderer.domElement.parentNode) renderer.domElement.parentNode.removeChild(renderer.domElement);
  }

  function setSurfaceRadiusScale(scale) {
    if (Number.isFinite(scale) && scale > 0) radiusScale = scale;
  }

  return {
    setParticles,
    setSurfaceRadiusScale,
    dispose,
    scene,
    camera,
    getBoxDimensionsM() {
      return [...dims];
    },
    getOpticalGpuTable() {
      return opticalGpuTable;
    },
    getOpticalGpuLookup() {
      return opticalGpuLookup;
    },
    getSphThermalMaterialTable() {
      return sphThermalMaterialTable;
    },
    getSphThermalClosureGraphBuffers() {
      return sphThermalClosureGraphBuffers;
    },
    getSphThermalPhaseResponseTable() {
      return sphThermalPhaseResponseTable;
    },
    getSphThermalResponseGraphUpload() {
      return sphThermalResponseGraphUpload;
    },
    getSphReactionTable() {
      return sphReactionTable;
    },
    getOpticalGpuDrawState() {
      return scene.userData.opticalGpuLookupDrawState;
    },
    getSphGpuParticleState() {
      return sphGpuParticleState;
    },
    getSphGpuParticleUpload() {
      return sphGpuParticleUpload;
    },
    getMlsMpmGpuParticleState() {
      return mlsMpmGpuParticleState;
    },
    getMlsMpmGpuParticleUpload() {
      return mlsMpmGpuParticleUpload;
    },
    getMlsMpmMechanicsPrediction() {
      return mlsMpmMechanicsPrediction;
    },
    getMlsMpmP2gGridProjection() {
      return mlsMpmP2gGridProjection;
    },
    getMlsMpmGridUpdate() {
      return mlsMpmGridUpdate;
    },
    getMlsMpmG2pReconstruction() {
      return mlsMpmG2pReconstruction;
    },
    getMlsMpmResidentStep() {
      return mlsMpmResidentStep;
    },
    getMlsMpmResidentSteps() {
      return mlsMpmResidentSteps;
    },
    getMlsMpmResidentRequestedReadbackMode() {
      return scene.userData.mlsMpmResidentRequestedReadbackMode;
    },
    getSphResidentRenderState() {
      return sphResidentRenderState;
    },
    getSphResidentSurfaceDraw() {
      return sphResidentSurfaceDraw;
    },
    getSphResidentSurfaceDrawRenderBridge() {
      return sphResidentSurfaceDrawRenderBridge;
    },
    refreshOpticalGpuLookup,
    refreshSphGpuParticleBuffers,
    refreshMlsMpmGpuParticleBuffers,
    refreshMlsMpmMechanicsPrediction,
    refreshMlsMpmP2gGridProjection,
    refreshMlsMpmGridUpdate,
    refreshMlsMpmG2pReconstruction,
    refreshMlsMpmResidentStep,
    refreshMlsMpmResidentSteps,
    refreshSphResidentRenderState,
    requestOpticalGpuDevice: requestCachedOpticalGpuDevice
  };
}
