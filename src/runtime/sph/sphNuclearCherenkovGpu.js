/**
 * GPU-Native Phase 8 Nuclear Decay Thermal Deposition & 3D World-Space
 * Dielectric Volumetric Frank-Tamm Cherenkov Radiation Runtime.
 *
 * Strictly Star Spec aligned:
 *  - ZERO overhead when dormant (`sources.length === 0`: 0 buffers, 0 compute passes, 0 draws).
 *  - ZERO material-name hardcoding: dielectric refractive index n is read directly
 *    from ULG's GPU `optical_records` table for ANY transparent dielectric surface
 *    (`metalness < 0.1`, `transmission > 0.01`, `ior > 1.000001`).
 *  - ZERO screen-space overlays: Cherenkov volumetric emission is ray-integrated in
 *    true 3D world space along the refracted ray chord inside the surrounding
 *    transparent dielectric around LIVE GPU-reduced radioactive particle centroids.
 *  - Opaque conductors (like solid Co-60 metal) never glow blue; only the
 *    irradiated transparent dielectric volume where beta > 1 / n emits light.
 *  - Decay heat is deposited directly on GPU into `state_rows[i].specificInternalEnergyJPerKg`
 *    (and updates ULG's exact `2^-149` energy ledger when bound).
 */

import {
  computeBufferBinding,
  createCachedExplicitBindGroup,
  createCachedExplicitComputePipeline,
  unwrapWebGpuCacheDevice
} from '../webgpuComputeLayout.js';
import { createSphExactMassWgsl } from './sphExactMassWgsl.js';
import { createSphExactLedgerWgsl } from './sphExactLedgerWgsl.js';
import {
  SPH_EXACT_THERMAL_ENERGY_FORMAT,
  SPH_EXACT_THERMAL_ENERGY_WORDS
} from './sphExactThermalEnergyWgsl.js';
import {
  ULG_NATIVE_REFRACTION_TRANSPORT_WGSL
} from '../../visualization/nativeRefractionTransportWgsl.js';
import {
  ISOSURFACE_MOTION_WGSL
} from '../../visualization/isosurfaceMotionWgsl.js';
import {
  WORKER_NATIVE_SURFACE_UNIFORM_BYTES
} from '../../services/workerOwnedNativeSurfaceMaterial.js';
import {
  WORKER_NATIVE_SURFACE_MOTION_UNIFORM_BYTES
} from '../../visualization/workerNativeSurfaceMotionWgsl.js';
import {
  evaluateCherenkovClosure
} from '../material/nuclearCherenkovClosure.js';

export const SPH_NUCLEAR_CHERENKOV_GPU_SCHEMA =
  'peercompute.ulg.sph-nuclear-cherenkov-gpu.v1';

export const SPH_NUCLEAR_CHERENKOV_MAX_SOURCES = 16;
const MEV_TO_JOULE = 1.602176634e-13;
const GPU_BUFFER_USAGE = Object.freeze({
  COPY_SRC: globalThis.GPUBufferUsage?.COPY_SRC ?? 0x04,
  COPY_DST: globalThis.GPUBufferUsage?.COPY_DST ?? 0x08,
  UNIFORM: globalThis.GPUBufferUsage?.UNIFORM ?? 0x40,
  STORAGE: globalThis.GPUBufferUsage?.STORAGE ?? 0x80
});
const SHADER_STAGE = Object.freeze({
  VERTEX: globalThis.GPUShaderStage?.VERTEX ?? 0x01,
  FRAGMENT: globalThis.GPUShaderStage?.FRAGMENT ?? 0x02,
  COMPUTE: globalThis.GPUShaderStage?.COMPUTE ?? 0x04
});

// Layout of `cherenkov_sources` GPU storage buffer:
//   vec4[0]: [source_count_f32, 0, 0, 0]
//   for s in 0..15:
//     vec4[1 + s * 2]: [center_x_m, center_y_m, center_z_m, radius_m]
//     vec4[2 + s * 2]: [beta, attenuation_range_m, radiance_scale, active_flag]
const CHERENKOV_SOURCES_VEC4_COUNT = 1 + SPH_NUCLEAR_CHERENKOV_MAX_SOURCES * 2;
const CHERENKOV_SOURCES_BYTES = CHERENKOV_SOURCES_VEC4_COUNT * 16;

// Layout of `source_specs` input storage buffer (per source: 2 vec4s):
//   vec4[s * 2 + 0]: [domain_id_f32, delta_specific_energy_j_per_kg, fallback_radius_m, beta]
//   vec4[s * 2 + 1]: [attenuation_range_m, radiance_scale, active_flag, exact_energy_quantum_lo_u32_as_f32]
const SOURCE_SPECS_BYTES = SPH_NUCLEAR_CHERENKOV_MAX_SOURCES * 32;

// Layout of `centroid_accum` atomic<i32> buffer (per source: 6 atomic<i32>):
//   [mass_q, mx_q, my_q, mz_q, r2_q, particle_count]
const CENTROID_ACCUM_BYTES = SPH_NUCLEAR_CHERENKOV_MAX_SOURCES * 6 * 4;

// Exact 2^-149 signed energy ledger format for bit-exact U/S synchronization
const EXACT_ENERGY_FORMAT = SPH_EXACT_THERMAL_ENERGY_FORMAT;
const EXACT_ENERGY_WORDS = SPH_EXACT_THERMAL_ENERGY_WORDS;

export const sphNuclearDecayAndCentroidWgsl = /* wgsl */ `
${createSphExactMassWgsl(EXACT_ENERGY_FORMAT)}
${createSphExactLedgerWgsl(EXACT_ENERGY_FORMAT)}

struct NuclearTickParams {
  particle_count: u32,
  source_count: u32,
  apply_thermal_heat: u32,
  exact_energy_enabled: u32,
  rigid_body_count: u32,
  pad0: u32,
  pad1: u32,
  pad2: u32,
};

struct SourceSpec {
  meta0: vec4<f32>, // [domain_id, delta_u_j_per_kg, fallback_radius_m, beta]
  meta1: vec4<f32>, // [attenuation_range_m, radiance_scale, active_flag, rigid_body_index_or_neg1]
};

@group(0) @binding(0) var<uniform> params: NuclearTickParams;
@group(0) @binding(1) var<storage, read> source_specs: array<SourceSpec>;
@group(0) @binding(2) var<storage, read_write> state_rows: array<vec4<f32>>;
@group(0) @binding(3) var<storage, read> identity_rows: array<u32>;
@group(0) @binding(4) var<storage, read_write> centroid_accum: array<atomic<i32>>;
@group(0) @binding(5) var<storage, read_write> cherenkov_sources: array<vec4<f32>>;
@group(0) @binding(6) var<storage, read_write> exact_energy_rows: array<atomic<u32>>;
@group(0) @binding(7) var<storage, read> rigid_frames: array<vec4<f32>>;

const Q_MASS: f32 = 1024.0;
const Q_POS: f32 = 1024.0;

@compute @workgroup_size(16)
fn snc_clear(@builtin(global_invocation_id) gid: vec3<u32>) {
  let s = gid.x;
  if (s >= ${SPH_NUCLEAR_CHERENKOV_MAX_SOURCES}u) { return; }
  let base = s * 6u;
  atomicStore(&centroid_accum[base + 0u], 0);
  atomicStore(&centroid_accum[base + 1u], 0);
  atomicStore(&centroid_accum[base + 2u], 0);
  atomicStore(&centroid_accum[base + 3u], 0);
  atomicStore(&centroid_accum[base + 4u], 0);
  atomicStore(&centroid_accum[base + 5u], 0);
  if (s == 0u) {
    cherenkov_sources[0u] = vec4<f32>(f32(params.source_count), 0.0, 0.0, 0.0);
  }
}

fn snc_energy_load(word: u32) -> ExactMass {
  var value: ExactMass;
  for (var w = 0u; w < EM_WORDS; w = w + 1u) {
    value.words[w] = atomicLoad(&exact_energy_rows[word + w]);
  }
  return value;
}

fn snc_energy_store(word: u32, value: ExactMass) {
  for (var w = 0u; w < EM_WORDS; w = w + 1u) {
    atomicStore(&exact_energy_rows[word + w], value.words[w]);
  }
}

@compute @workgroup_size(64)
fn snc_deposit_and_reduce(@builtin(global_invocation_id) gid: vec3<u32>) {
  let idx = gid.x;
  if (idx >= params.particle_count) { return; }
  let pos_mass = state_rows[idx * 2u];
  let m = pos_mass.w;
  if (!(m > 0.0)) { return; }
  let domain_id = identity_rows[idx];
  if (domain_id == 0u) { return; }

  let scount = min(params.source_count, ${SPH_NUCLEAR_CHERENKOV_MAX_SOURCES}u);
  for (var s = 0u; s < scount; s = s + 1u) {
    let spec = source_specs[s];
    let src_domain = u32(max(0.0, round(spec.meta0.x)));
    if (domain_id != src_domain) { continue; }

    // 1. Deposit exact nuclear decay specific internal energy directly into GPU particle state
    let delta_u = spec.meta0.y;
    if (params.apply_thermal_heat != 0u && delta_u > 0.0) {
      var vel_u = state_rows[idx * 2u + 1u];
      var next_u = vel_u.w + delta_u;

      // Keep exact 2^-149 energy ledger (both U and S source limbs) bit-invariant:
      // sum(U - S) never changes because identical nuclear heat is booked to U and S.
      let required_words = 2u * params.particle_count * EM_WORDS;
      if (params.exact_energy_enabled != 0u && arrayLength(&exact_energy_rows) >= required_words) {
        let exact_du = el_from_f32_bits(bitcast<u32>(m * delta_u));
        let u_word = idx * EM_WORDS;
        let s_word = params.particle_count * EM_WORDS + u_word;
        let sum_u = el_add(snc_energy_load(u_word), exact_du.value);
        let sum_s = el_add(snc_energy_load(s_word), exact_du.value);
        let proj = el_project_f32_bits(sum_u.value);
        if ((exact_du.error | sum_u.error | sum_s.error | proj.error) == 0u) {
          snc_energy_store(u_word, sum_u.value);
          snc_energy_store(s_word, sum_s.value);
          next_u = bitcast<f32>(proj.bits) / m;
        }
      }
      vel_u.w = next_u;
      state_rows[idx * 2u + 1u] = vel_u;
    }

    // 2. Atomically accumulate live 3D mass-weighted centroid directly from GPU particle positions
    let base = s * 6u;
    let mq = i32(clamp(m * Q_MASS, -1e8, 1e8));
    let mxq = i32(clamp(m * pos_mass.x * Q_POS, -1e8, 1e8));
    let myq = i32(clamp(m * pos_mass.y * Q_POS, -1e8, 1e8));
    let mzq = i32(clamp(m * pos_mass.z * Q_POS, -1e8, 1e8));
    atomicAdd(&centroid_accum[base + 0u], mq);
    atomicAdd(&centroid_accum[base + 1u], mxq);
    atomicAdd(&centroid_accum[base + 2u], myq);
    atomicAdd(&centroid_accum[base + 3u], mzq);
    atomicAdd(&centroid_accum[base + 5u], 1);
    break;
  }
}

@compute @workgroup_size(16)
fn snc_finalize(@builtin(global_invocation_id) gid: vec3<u32>) {
  let s = gid.x;
  let scount = min(params.source_count, ${SPH_NUCLEAR_CHERENKOV_MAX_SOURCES}u);
  if (s >= ${SPH_NUCLEAR_CHERENKOV_MAX_SOURCES}u) { return; }
  let out_pos_idx = 1u + s * 2u;
  let out_phys_idx = 2u + s * 2u;
  if (s >= scount) {
    cherenkov_sources[out_pos_idx] = vec4<f32>(0.0);
    cherenkov_sources[out_phys_idx] = vec4<f32>(0.0);
    return;
  }
  let spec = source_specs[s];
  let base = s * 6u;
  var total_m = f32(atomicLoad(&centroid_accum[base + 0u])) / Q_MASS;
  var total_mom = vec3<f32>(
    f32(atomicLoad(&centroid_accum[base + 1u])) / Q_POS,
    f32(atomicLoad(&centroid_accum[base + 2u])) / Q_POS,
    f32(atomicLoad(&centroid_accum[base + 3u])) / Q_POS
  );
  let p_cnt = atomicLoad(&centroid_accum[base + 5u]);
  if (!(total_m > 1e-6 && p_cnt > 0)) {
    total_m = 0.0;
    total_mom = vec3<f32>(0.0);
  }

  // Combine with live GPU A5 rigid-body center-of-mass when this radioactive source
  // is carried by ULG's coherent rigid-solid lane (zero CPU readback!).
  let rigid_idx_f = spec.meta1.w;
  if (rigid_idx_f >= 0.0 && params.rigid_body_count > 0u) {
    let ridx = u32(round(rigid_idx_f));
    if (ridx < params.rigid_body_count && (ridx * 8u) < arrayLength(&rigid_frames)) {
      let frame0 = rigid_frames[ridx * 8u];
      if (frame0.w > 1e-6) {
        total_m = total_m + frame0.w;
        total_mom = total_mom + frame0.xyz * frame0.w;
      }
    }
  }

  if (total_m > 1e-6) {
    let inv_m = 1.0 / total_m;
    let cpos = total_mom * inv_m;
    cherenkov_sources[out_pos_idx] = vec4<f32>(cpos, max(0.02, spec.meta0.z));
    cherenkov_sources[out_phys_idx] = vec4<f32>(
      spec.meta0.w, // beta
      max(0.02, spec.meta1.x), // attenuation_range_m
      max(0.0, spec.meta1.y), // radiance_scale
      spec.meta1.z // active_flag
    );
  } else {
    // Keep prior fallback position if no live particles matched yet, or fail closed if inactive
    let prev_pos = cherenkov_sources[out_pos_idx];
    cherenkov_sources[out_pos_idx] = vec4<f32>(prev_pos.xyz, max(0.02, spec.meta0.z));
    cherenkov_sources[out_phys_idx] = vec4<f32>(
      spec.meta0.w,
      max(0.02, spec.meta1.x),
      max(0.0, spec.meta1.y),
      0.0
    );
  }
}
`;

/**
 * 3D World-Space Dielectric Volumetric Frank-Tamm Cherenkov Shader (WGSL).
 *
 * Renders inside the refractive dielectric front pass (0 extra render passes!):
 *  - Evaluates the exact relativistic threshold `beta > 1 / optical.ior` using
 *    THIS surface's closure-derived refractive index from `optical_records`
 *    (zero material-name hardcoding!).
 *  - Fails closed (`discard`) for opaque conductors (`metalness >= 0.1`),
 *    non-transmissive bodies, vacuum (`ior <= 1.000001`), or sub-threshold
 *    isotopes (`beta <= 1 / ior`).
 *  - Integrates volumetric Frank-Tamm CIE-1931 Cherenkov emission along the
 *    true 3D world-space ray chord `[entry_world, exit_world]` inside the
 *    dielectric volume around LIVE GPU radioactive particle centroids.
 */
export const SPH_CHERENKOV_DIELECTRIC_VOLUME_WGSL = /* wgsl */ `
struct WorkerSurfaceMotionUniform {
  grid: vec4<u32>,
  motion: vec4<f32>,
};

struct CameraUniform {
  view_projection: mat4x4<f32>,
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
  ambient_light_suppression: f32,
  direct_light_suppression: f32,
  position_clamp_min_x_m: f32,
  position_clamp_min_y_m: f32,
  position_clamp_min_z_m: f32,
  position_clamp_max_x_m: f32,
  position_clamp_max_y_m: f32,
  position_clamp_max_z_m: f32,
  position_clamp_enabled: f32,
  environment_light_suppression: f32,
  bounds_center_x_m: f32,
  bounds_center_y_m: f32,
  bounds_center_z_m: f32,
  bounds_radius_m: f32,
  field_dim_x: u32,
  field_dim_y: u32,
  field_dim_z: u32,
  field_stride_x: u32,
  field_stride_y: u32,
  field_stride_z: u32,
  field_offset: u32,
  field_gradient_enabled: f32,
  camera_position_x_m: f32,
  camera_position_y_m: f32,
  camera_position_z_m: f32,
  emissive_temperature_k: f32,
  inverse_view_projection: mat4x4<f32>,
};

@group(0) @binding(0) var<storage, read> compact_position_rows: array<f32>;
@group(0) @binding(1) var<uniform> camera_data: CameraUniform;
@group(0) @binding(2) var<storage, read> optical_records: array<vec4<f32>>;
@group(0) @binding(3) var<storage, read> compact_packed_normals: array<u32>;
@group(0) @binding(4) var<storage, read> isosurface_motion_rows: array<vec4<f32>>;
@group(0) @binding(5) var<uniform> surface_motion: WorkerSurfaceMotionUniform;

@group(1) @binding(0) var refractive_back_depth: texture_depth_2d;
@group(1) @binding(1) var<storage, read> cherenkov_sources: array<vec4<f32>>;

${ISOSURFACE_MOTION_WGSL}
${ULG_NATIVE_REFRACTION_TRANSPORT_WGSL}

struct VertexOut {
  @builtin(position) position: vec4<f32>,
  @location(0) normal: vec3<f32>,
  @location(1) world_position: vec3<f32>,
  @location(2) @interpolate(flat) material_id: f32,
  @location(3) @interpolate(flat) phase_id: f32,
  @location(4) @interpolate(flat) optical_state_id: f32,
};

fn compact_position(vertex_index: u32) -> vec3<f32> {
  let offset = vertex_index * camera_data.source_stride_floats;
  return vec3<f32>(
    compact_position_rows[offset + 0u],
    compact_position_rows[offset + 1u],
    compact_position_rows[offset + 2u]
  );
}

fn compact_world_position(vertex_index: u32) -> vec3<f32> {
  var p = compact_position(vertex_index);
  if (camera_data.position_transform_enabled > 0.5) {
    p = vec3<f32>(
      camera_data.position_origin_x_m,
      camera_data.position_origin_y_m,
      camera_data.position_origin_z_m
    ) + (p + vec3<f32>(camera_data.position_grid_bias)) * camera_data.position_scale_m;
  }
  if (camera_data.position_clamp_enabled > 0.5) {
    p = clamp(
      p,
      vec3<f32>(
        camera_data.position_clamp_min_x_m,
        camera_data.position_clamp_min_y_m,
        camera_data.position_clamp_min_z_m
      ),
      vec3<f32>(
        camera_data.position_clamp_max_x_m,
        camera_data.position_clamp_max_y_m,
        camera_data.position_clamp_max_z_m
      )
    );
  }
  return p;
}

fn compact_normal(vertex_index: u32) -> vec3<f32> {
  let triangle_base = vertex_index - (vertex_index % 3u);
  let p0 = compact_world_position(triangle_base + 0u);
  let p1 = compact_world_position(triangle_base + 1u);
  let p2 = compact_world_position(triangle_base + 2u);
  let n = cross(p1 - p0, p2 - p0);
  if (length(n) <= 1.0e-12) {
    return normalize(vec3<f32>(0.0, 1.0, 0.0));
  }
  return normalize(n);
}

fn octahedral_sign_not_zero(v: vec2<f32>) -> vec2<f32> {
  return select(vec2<f32>(-1.0), vec2<f32>(1.0), v >= vec2<f32>(0.0));
}

fn compact_packed_normal(vertex_index: u32) -> vec3<f32> {
  if (vertex_index >= arrayLength(&compact_packed_normals)) {
    return vec3<f32>(0.0);
  }
  let packed = compact_packed_normals[vertex_index];
  if (packed == 0x80008000u) {
    return vec3<f32>(0.0);
  }
  let oct = unpack2x16snorm(packed);
  var normal = vec3<f32>(oct, 1.0 - abs(oct.x) - abs(oct.y));
  if (normal.z < 0.0) {
    normal = vec3<f32>(
      (vec2<f32>(1.0) - abs(normal.yx)) * octahedral_sign_not_zero(normal.xy),
      normal.z
    );
  }
  let l2 = dot(normal, normal);
  if (l2 <= 1.0e-12) { return vec3<f32>(0.0); }
  return normal / sqrt(l2);
}

@vertex
fn vs_main(@builtin(vertex_index) vertex_index: u32) -> VertexOut {
  var normal = compact_normal(vertex_index);
  let smooth_normal = compact_packed_normal(vertex_index);
  if (dot(smooth_normal, smooth_normal) > 0.25) {
    normal = smooth_normal;
  }
  let motion = sample_isosurface_motion(
    compact_position(vertex_index) + vec3<f32>(camera_data.position_grid_bias),
    camera_data.position_scale_m, normal, surface_motion.motion.x, surface_motion.motion.y,
    surface_motion.grid.x, surface_motion.grid.y, surface_motion.grid.z
  );
  let position_m = compact_world_position(vertex_index) + motion.displacement;
  var out: VertexOut;
  var clip = camera_data.view_projection * vec4<f32>(position_m, 1.0);
  clip.z = clip.z * 0.5 + clip.w * 0.5;
  if (clip.w <= 0.0) {
    clip = vec4<f32>(2.0, 2.0, 1.0, 1.0);
  }
  out.position = clip;
  out.world_position = position_m;
  out.normal = motion.normal;
  out.material_id = camera_data.material_id;
  out.phase_id = camera_data.phase_id;
  out.optical_state_id = camera_data.optical_state_id;
  return out;
}

fn id_equal(a: f32, b: f32) -> bool {
  return abs(round(a) - round(b)) < 0.5;
}

struct DielectricOptical {
  ior: f32,
  transmission: f32,
  metalness: f32,
  attenuation_linear: vec3<f32>,
  attenuation_distance_m: f32,
  valid: f32,
};

fn lookup_dielectric_optical(material_id: f32, phase_id: f32, optical_state_id: f32) -> DielectricOptical {
  let count = arrayLength(&optical_records) / 6u;
  for (var i = 0u; i < count; i = i + 1u) {
    let row0 = optical_records[i * 6u + 0u];
    let row5 = optical_records[i * 6u + 5u];
    if (id_equal(row0.x, material_id) && id_equal(row0.y, phase_id) && id_equal(row5.w, optical_state_id)) {
      let row1 = optical_records[i * 6u + 1u];
      let row2 = optical_records[i * 6u + 2u];
      let row3 = optical_records[i * 6u + 3u];
      let blocked = row5.y > 0.5 || abs(row5.z - 255.0) < 0.5;
      return DielectricOptical(
        max(row2.w, 1.0),
        clamp(row2.y, 0.0, 1.0),
        clamp(row1.w, 0.0, 1.0),
        clamp(row3.xyz, vec3<f32>(1.0e-5), vec3<f32>(1.0)),
        max(row3.w, 1.0e-5),
        select(1.0, 0.0, blocked)
      );
    }
  }
  return DielectricOptical(1.0, 0.0, 1.0, vec3<f32>(1.0), 1.0, 0.0);
}

fn wyman_gauss(x: f32, mu: f32, s1: f32, s2: f32) -> f32 {
  let inv = select(1.0 / s2, 1.0 / s1, x < mu);
  let t = (x - mu) * inv;
  return exp(-0.5 * t * t);
}

// First-principles Frank-Tamm d^2N / (dx dlambda) ~ lambda^-2 * (1 - 1 / (beta^2 * n^2))
// integrated against Wyman 2013 CIE 1931 color matching functions -> linear sRGB!
fn frank_tamm_linear_rgb(beta: f32, ior: f32) -> vec3<f32> {
  let sin2 = 1.0 - 1.0 / max(1.0e-6, beta * beta * ior * ior);
  if (!(sin2 > 0.0)) {
    return vec3<f32>(0.0);
  }
  var cx = 0.0;
  var cy = 0.0;
  var cz = 0.0;
  var norm = 0.0;
  let peak_inv_l2 = 1.0 / (380.0 * 380.0);
  // 10 nm CIE 1931 spectral quadrature of Frank-Tamm d^2N / (dx dlambda) ~ lambda^-2
  for (var k = 0u; k < 41u; k = k + 1u) {
    let nm = 380.0 + f32(k) * 10.0;
    let spec = (1.0 / (nm * nm)) / peak_inv_l2;
    let wx = 1.056 * wyman_gauss(nm, 599.8, 37.9, 31.0)
      + 0.362 * wyman_gauss(nm, 442.0, 16.0, 26.7)
      - 0.065 * wyman_gauss(nm, 501.1, 20.4, 26.2);
    let wy = 0.821 * wyman_gauss(nm, 568.8, 46.9, 40.5)
      + 0.286 * wyman_gauss(nm, 530.9, 16.3, 31.1);
    let wz = 1.217 * wyman_gauss(nm, 437.0, 11.8, 36.0)
      + 0.681 * wyman_gauss(nm, 459.0, 26.0, 13.8);
    cx += spec * wx;
    cy += spec * wy;
    cz += spec * wz;
    norm += wy;
  }
  if (!(norm > 0.0)) { return vec3<f32>(0.0); }
  cx /= norm; cy /= norm; cz /= norm;
  // Exact XYZ -> linear sRGB matrix (IEC 61966-2-1), preserving true Frank-Tamm chromaticity
  let lin = vec3<f32>(
    max(0.0, 3.2406 * cx - 1.5372 * cy - 0.4986 * cz),
    max(0.0, -0.9689 * cx + 1.8758 * cy + 0.0415 * cz),
    max(0.0, 0.0557 * cx - 0.2040 * cy + 1.0570 * cz)
  );
  let max_c = max(max(lin.r, lin.g), max(lin.b, 1.0e-5));
  return lin / max_c;
}

@fragment
fn fs_main(in: VertexOut) -> @location(0) vec4<f32> {
  if (arrayLength(&cherenkov_sources) < 3u) {
    discard;
  }
  let source_count = min(u32(max(0.0, round(cherenkov_sources[0u].x))), ${SPH_NUCLEAR_CHERENKOV_MAX_SOURCES}u);
  if (source_count == 0u) {
    discard;
  }
  let opt = lookup_dielectric_optical(in.material_id, in.phase_id, in.optical_state_id);
  // Strictly fail closed for opaque conductors, vacuum, or non-transmissive media!
  if (!(opt.valid > 0.5) || opt.metalness >= 0.1 || opt.transmission <= 0.01 || opt.ior <= 1.000001) {
    discard;
  }

  let dimensions = textureDimensions(refractive_back_depth);
  let surface_pixel = refraction_surface_pixel(in.position.xy, dimensions);
  if (!(surface_pixel.valid > 0.5)) {
    discard;
  }
  let back_depth = textureLoad(refractive_back_depth, surface_pixel.pixel, 0);
  if (!(back_depth >= 0.0 && back_depth < 0.999999 && back_depth > in.position.z + 1.0e-5)) {
    discard;
  }
  let back_point = refraction_unproject_uv_depth(
    surface_pixel.uv,
    back_depth,
    camera_data.inverse_view_projection
  );
  if (!(back_point.valid > 0.5)) {
    discard;
  }
  let entry_world = in.world_position;
  let cam_pos = vec3<f32>(
    camera_data.camera_position_x_m,
    camera_data.camera_position_y_m,
    camera_data.camera_position_z_m
  );
  let view_dir = normalize(cam_pos - entry_world);
  let normal = normalize(in.normal);
  let max_chord = max(0.01, select(2.0 * camera_data.bounds_radius_m, 2.5, !(camera_data.bounds_radius_m > 1.0e-5)));
  let rear_valid = refraction_rear_surface_admitted(
    in.position.z,
    back_depth,
    entry_world,
    back_point.world_position,
    normal,
    view_dir,
    max_chord
  );
  let refracted_dir = refract(-view_dir, normal, 1.0 / opt.ior);
  let snell_path = refracted_path_to_back_plane(
    entry_world,
    back_point.world_position,
    rear_valid,
    refracted_dir,
    camera_data.view_projection,
    max_chord
  );
  var exit_world = back_point.world_position;
  var raw_chord = length(exit_world - entry_world);
  if (snell_path.valid > 0.5 && snell_path.path_m > 1.0e-4) {
    exit_world = snell_path.exit_world;
    raw_chord = snell_path.path_m;
  }
  if (!(raw_chord > 1.0e-4)) {
    discard;
  }
  let path_m = min(raw_chord, max_chord);
  let ray_dir = (exit_world - entry_world) / raw_chord;
  let clamped_exit = entry_world + ray_dir * path_m;
  let ndotv = clamp(dot(normal, view_dir), 0.0, 1.0);
  let f0_r = (opt.ior - 1.0) / (opt.ior + 1.0);
  let f0 = f0_r * f0_r;
  let fresnel = clamp(f0 + (1.0 - f0) * pow(max(0.0, 1.0 - ndotv), 5.0), 0.0, 1.0);

  let sigma_abs = -log(opt.attenuation_linear) / opt.attenuation_distance_m;
  var volume_radiance = vec3<f32>(0.0);

  for (var s = 0u; s < source_count; s = s + 1u) {
    let pos_rad = cherenkov_sources[1u + s * 2u];
    let phys = cherenkov_sources[2u + s * 2u];
    let beta = phys.x;
    let range_m = max(0.02, phys.y);
    let scale = max(0.0, phys.z);
    let active_flag = phys.w;
    if (!(active_flag > 0.5) || !(scale > 0.0)) {
      continue;
    }
    let sin2_theta = 1.0 - 1.0 / max(1.0e-6, beta * beta * opt.ior * opt.ior);
    if (!(sin2_theta > 0.0)) {
      continue;
    }
    let spec_rgb = frank_tamm_linear_rgb(beta, opt.ior);
    let src_center = pos_rad.xyz;
    let src_radius = max(0.02, pos_rad.w);
    let falloff_r = max(0.07, src_radius * 0.85 + 0.04);

    // 12-point midpoint volumetric integral along the true 3D ray chord inside the dielectric
    var integral = vec3<f32>(0.0);
    let steps = 12u;
    let ds = path_m / f32(steps);
    for (var k = 0u; k < steps; k = k + 1u) {
      let t = (f32(k) + 0.5) / f32(steps);
      let sample_pos = mix(entry_world, clamped_exit, t);
      let d_surface = max(0.0, length(sample_pos - src_center) - src_radius);
      let geom = exp(-d_surface / range_m) / (1.0 + (d_surface / falloff_r) * (d_surface / falloff_r));
      let beer_lambert = exp(-sigma_abs * (t * path_m));
      integral += spec_rgb * beer_lambert * (geom * ds);
    }
    volume_radiance += integral * (sin2_theta * scale);
  }

  let transmitted_radiance = volume_radiance * (1.0 - fresnel) * opt.transmission;
  let peak_rad = max(transmitted_radiance.r, max(transmitted_radiance.g, transmitted_radiance.b));
  if (!(peak_rad > 1.0e-4)) {
    discard;
  }
  // Luminance-preserving Reinhard rolloff keeps true Frank-Tamm CIE chromaticity without desaturating to white
  let lum = max(1.0e-5, dot(transmitted_radiance, vec3<f32>(0.2126, 0.7152, 0.0722)));
  let mapped = transmitted_radiance * (0.68 / (1.0 + lum * 0.85));
  let clamped = clamp(mapped, vec3<f32>(0.0), vec3<f32>(1.0));
  let display = pow(clamped, vec3<f32>(1.0 / 2.2));
  return vec4<f32>(display, 1.0);
}
`;

const deviceStateCache = new WeakMap();

function ensureNuclearGpuState(device) {
  const keyDevice = unwrapWebGpuCacheDevice(device);
  let state = deviceStateCache.get(keyDevice);
  if (!state) {
    const bindings = [
      computeBufferBinding(0, 'uniform'),
      computeBufferBinding(1, 'read-only-storage'),
      computeBufferBinding(2, 'storage'),
      computeBufferBinding(3, 'read-only-storage'),
      computeBufferBinding(4, 'storage'),
      computeBufferBinding(5, 'storage'),
      computeBufferBinding(6, 'storage'),
      computeBufferBinding(7, 'read-only-storage')
    ];
    const mk = (entryPoint) => createCachedExplicitComputePipeline(keyDevice, {
      cacheKey: `ulg-sph-nuclear-cherenkov-${entryPoint}.v2`,
      label: `ulg-sph-nuclear-cherenkov-${entryPoint}`,
      code: sphNuclearDecayAndCentroidWgsl,
      entryPoint,
      bindings
    });
    const paramsBuffer = keyDevice.createBuffer({
      label: 'ulg-sph-nuclear-params',
      size: 32,
      usage: GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST
    });
    const sourceSpecsBuffer = keyDevice.createBuffer({
      label: 'ulg-sph-nuclear-source-specs',
      size: SOURCE_SPECS_BYTES,
      usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_DST
    });
    const centroidAccumBuffer = keyDevice.createBuffer({
      label: 'ulg-sph-nuclear-centroid-accum',
      size: CENTROID_ACCUM_BYTES,
      usage: GPU_BUFFER_USAGE.STORAGE
    });
    const cherenkovSourcesBuffer = keyDevice.createBuffer({
      label: 'ulg-sph-nuclear-cherenkov-sources',
      size: CHERENKOV_SOURCES_BYTES,
      usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_DST | GPU_BUFFER_USAGE.COPY_SRC
    });
    const dummyExactEnergyBuffer = keyDevice.createBuffer({
      label: 'ulg-sph-nuclear-dummy-exact-energy',
      size: Math.max(64, (2 * EXACT_ENERGY_WORDS + 4) * 4),
      usage: GPU_BUFFER_USAGE.STORAGE
    });
    const dummyRigidFramesBuffer = keyDevice.createBuffer({
      label: 'ulg-sph-nuclear-dummy-rigid-frames',
      size: 128,
      usage: GPU_BUFFER_USAGE.STORAGE
    });
    state = {
      device: keyDevice,
      pipes: {
        clear: mk('snc_clear'),
        deposit: mk('snc_deposit_and_reduce'),
        finalize: mk('snc_finalize')
      },
      paramsBuffer,
      sourceSpecsBuffer,
      centroidAccumBuffer,
      cherenkovSourcesBuffer,
      dummyExactEnergyBuffer,
      dummyRigidFramesBuffer,
      activeSourceCount: 0,
      sources: [],
      elapsedS: 0,
      totalDecays: 0,
      totalDepositedThermalEnergyJ: 0,
      thermalPowerW: 0,
      maxNucleonRelError: 0,
      medium: 'vacuum',
      refractiveIndex: 1.0,
      remainingAtomsByKey: new Map(),
      lastSnapshot: null
    };
    deviceStateCache.set(keyDevice, state);
  }
  return state;
}

export function latestSphNuclearCherenkovState(device) {
  if (!device) return null;
  return deviceStateCache.get(unwrapWebGpuCacheDevice(device)) || null;
}

export function clearSphNuclearCherenkovState(device) {
  if (!device) return false;
  const keyDevice = unwrapWebGpuCacheDevice(device);
  const state = deviceStateCache.get(keyDevice);
  if (!state) return false;
  state.activeSourceCount = 0;
  state.sources = [];
  state.elapsedS = 0;
  state.totalDecays = 0;
  state.totalDepositedThermalEnergyJ = 0;
  state.thermalPowerW = 0;
  state.maxNucleonRelError = 0;
  state.remainingAtomsByKey.clear();
  state.lastSnapshot = null;
  const zeros = new Float32Array(CHERENKOV_SOURCES_VEC4_COUNT * 4);
  keyDevice.queue.writeBuffer(state.cherenkovSourcesBuffer, 0, zeros);
  return true;
}

export function destroySphNuclearCherenkovGpuResources(device) {
  if (!device) return false;
  const keyDevice = unwrapWebGpuCacheDevice(device);
  const state = deviceStateCache.get(keyDevice);
  if (!state) return false;
  state.paramsBuffer?.destroy?.();
  state.sourceSpecsBuffer?.destroy?.();
  state.centroidAccumBuffer?.destroy?.();
  state.cherenkovSourcesBuffer?.destroy?.();
  state.dummyExactEnergyBuffer?.destroy?.();
  state.dummyRigidFramesBuffer?.destroy?.();
  deviceStateCache.delete(keyDevice);
  return true;
}

function buildLiveRuntimeSnapshot(state) {
  let anyActive = false;
  let peakPhotons = 0;
  let dominant = null;
  const perSource = [];
  for (const src of state.sources) {
    const ch = evaluateCherenkovClosure({
      beta: src.beta,
      refractiveIndex: state.refractiveIndex,
      chargeZ: 1
    });
    const rec = {
      bodyId: src.bodyId,
      domainId: src.domainId,
      material: src.material,
      materialId: src.materialId,
      isotope: src.isotope,
      daughterIsotope: src.daughterIsotope,
      mode: src.mode,
      centerM: [...src.centerM],
      radiusM: src.radiusM,
      attenuationRangeM: src.attenuationRangeM,
      secondaryElectronMeV: src.secondaryElectronMeV,
      beta: src.beta,
      thresholdBeta: ch.thresholdBeta,
      refractiveIndex: state.refractiveIndex,
      active: ch.active,
      cherenkovAngleDeg: ch.cherenkovAngleDeg,
      photonsPerMeter: ch.photonsPerMeter,
      srgb: [...ch.srgb]
    };
    perSource.push(rec);
    if (ch.active) {
      anyActive = true;
      if (ch.photonsPerMeter >= peakPhotons) {
        peakPhotons = ch.photonsPerMeter;
        dominant = rec;
      }
    }
  }
  return Object.freeze({
    schema: SPH_NUCLEAR_CHERENKOV_GPU_SCHEMA,
    enabled: state.activeSourceCount > 0,
    backend: 'webgpu',
    medium: state.medium,
    refractiveIndex: state.refractiveIndex,
    elapsedS: state.elapsedS,
    sourceCount: state.activeSourceCount,
    isotopes: Object.freeze(state.sources.map((s) => s.isotope)),
    totalDecays: state.totalDecays,
    totalDepositedThermalEnergyJ: state.totalDepositedThermalEnergyJ,
    thermalPowerW: state.thermalPowerW,
    nucleonConservationRelError: state.maxNucleonRelError,
    cherenkovActive: anyActive,
    cherenkovBeta: dominant?.beta ?? (perSource[0]?.beta ?? 0),
    cherenkovThresholdBeta: dominant?.thresholdBeta ?? (1 / Math.max(1, state.refractiveIndex)),
    cherenkovAngleDeg: dominant?.cherenkovAngleDeg ?? 0,
    cherenkovPhotonsPerMeter: dominant?.photonsPerMeter ?? 0,
    cherenkovSrgb: Object.freeze(dominant ? [...dominant.srgb] : [0, 0, 0]),
    sources: Object.freeze(perSource),
    closureBacked: true,
    validation: Object.freeze({
      scientificValidation: false,
      nuclearBenchmarkValidated: false,
      opticalValidation: false
    })
  });
}

/**
 * Seed initial radioactive source positions into GPU buffers (so even paused frame 0
 * renders true 3D volumetric Cherenkov light around live particle positions).
 * Dormant (`sources.length === 0`): performs zero allocations and clears any prior state.
 */
export function seedSphNuclearCherenkovSources(device, {
  nuclearDescriptor = null,
  stateBuffer = null,
  identityBuffer = null,
  rigidFamily = null,
  particleCount = 0
} = {}) {
  const sources = Array.isArray(nuclearDescriptor?.sources) ? nuclearDescriptor.sources : [];
  if (!device || sources.length === 0) {
    clearSphNuclearCherenkovState(device);
    return null;
  }
  const state = ensureNuclearGpuState(device);
  const clamped = sources.slice(0, SPH_NUCLEAR_CHERENKOV_MAX_SOURCES);
  state.activeSourceCount = clamped.length;
  state.sources = clamped.map((s) => ({ ...s, centerM: [...(s.centerM || [0, 0, 0])] }));
  state.medium = nuclearDescriptor.medium || 'vacuum';
  state.refractiveIndex = Number(nuclearDescriptor.refractiveIndex) || 1.0;
  state.elapsedS = 0;
  state.totalDecays = 0;
  state.totalDepositedThermalEnergyJ = 0;
  state.thermalPowerW = 0;
  state.maxNucleonRelError = 0;
  state.remainingAtomsByKey.clear();

  const initBuf = new Float32Array(CHERENKOV_SOURCES_VEC4_COUNT * 4);
  initBuf[0] = clamped.length;
  for (let i = 0; i < clamped.length; i += 1) {
    const s = clamped[i];
    const key = `${s.bodyId}:${s.domainId}:${s.isotope}`;
    state.remainingAtomsByKey.set(key, Number(s.initialAtomCount) || 0);
    const base = (1 + i * 2) * 4;
    initBuf[base + 0] = Number(s.centerM?.[0]) || 0;
    initBuf[base + 1] = Number(s.centerM?.[1]) || 0;
    initBuf[base + 2] = Number(s.centerM?.[2]) || 0;
    initBuf[base + 3] = Math.max(0.02, Number(s.radiusM) || 0.12);
    // Volumetric radiance scale derived monotonically from relativistic activity
    const activityBq = (Number(s.initialAtomCount) || 0) * (Number(s.lambdaPerS) || 0);
    const radianceScale = activityBq > 0
      ? Math.min(24.0, Math.max(1.5, Math.log10(Math.max(10, activityBq)) * 1.15))
      : 0;
    initBuf[base + 4] = Number(s.beta) || 0;
    initBuf[base + 5] = Math.max(0.02, Number(s.attenuationRangeM) || 0.18);
    initBuf[base + 6] = radianceScale;
    initBuf[base + 7] = s.beta > 0 && activityBq > 0 ? 1.0 : 0.0;
  }
  state.device.queue.writeBuffer(state.cherenkovSourcesBuffer, 0, initBuf);

  // Immediately reduce live centroids from the GPU particle / rigid-body buffers if available (0 thermal heat applied at t=0)
  if (stateBuffer && identityBuffer && particleCount > 0) {
    const enc = state.device.createCommandEncoder({ label: 'ulg-sph-nuclear-seed-centroids' });
    encodeSphNuclearDecayAndCherenkovTick(state.device, enc, {
      stateBuffer,
      identityBuffer,
      rigidFamily,
      particleCount,
      dtS: 0,
      nuclearDescriptor
    });
    state.device.queue.submit([enc.finish()]);
  }
  state.lastSnapshot = buildLiveRuntimeSnapshot(state);
  return state.lastSnapshot;
}

function resolveRigidBodyIndexForSource(src, rigidFamily, usedRigidIndices) {
  if (!rigidFamily || rigidFamily.destroyed || !(rigidFamily.bodyCount > 0)) return -1;
  const sourceIds = Array.isArray(rigidFamily.sourceBodyIds) ? rigidFamily.sourceBodyIds : [];
  const mats = Array.isArray(rigidFamily.materials) ? rigidFamily.materials : [];
  const wantId = String(src?.bodyId || '').trim();
  if (wantId) {
    for (let r = 0; r < rigidFamily.bodyCount; r += 1) {
      if (usedRigidIndices.has(r)) continue;
      if (String(sourceIds[r] || '').trim() === wantId) {
        usedRigidIndices.add(r);
        return r;
      }
    }
  }
  const wantMat = String(src?.material || '').trim().toLowerCase();
  if (wantMat) {
    for (let r = 0; r < rigidFamily.bodyCount; r += 1) {
      if (usedRigidIndices.has(r)) continue;
      if (String(mats[r] || '').trim().toLowerCase() === wantMat) {
        usedRigidIndices.add(r);
        return r;
      }
    }
  }
  return -1;
}

/**
 * Encode ONE single coalesced GPU compute pass for nuclear decay thermal energy
 * deposition into live resident particle states (and exact 2^-149 energy ledger
 * when present) plus live 3D centroid reduction (across BOTH fluid particles AND
 * A5 coherent rigid bodies) for volumetric Cherenkov rendering.
 *
 * Returns `null` with ZERO GPU work when no radioactive sources exist.
 */
export function encodeSphNuclearDecayAndCherenkovTick(device, encoder, {
  stateBuffer,
  identityBuffer,
  exactEnergyBuffer = null,
  rigidFamily = null,
  particleCount = 0,
  dtS = 0,
  nuclearDescriptor = null
} = {}) {
  const sources = Array.isArray(nuclearDescriptor?.sources) ? nuclearDescriptor.sources : [];
  if (!device || !encoder || !stateBuffer || !identityBuffer || !(particleCount > 0) || sources.length === 0) {
    return null;
  }
  const state = ensureNuclearGpuState(device);
  const clamped = sources.slice(0, SPH_NUCLEAR_CHERENKOV_MAX_SOURCES);
  const dt = Math.max(0, Number(dtS) || 0);
  state.activeSourceCount = clamped.length;
  state.medium = nuclearDescriptor.medium || state.medium;
  state.refractiveIndex = Number(nuclearDescriptor.refractiveIndex) || state.refractiveIndex;
  if (state.sources.length !== clamped.length) {
    state.sources = clamped.map((s) => ({ ...s, centerM: [...(s.centerM || [0, 0, 0])] }));
  }

  const validRigid = rigidFamily && !rigidFamily.destroyed && rigidFamily.frameBuffer && rigidFamily.bodyCount > 0
    ? rigidFamily
    : null;
  const usedRigidIndices = new Set();

  const specs = new Float32Array(SPH_NUCLEAR_CHERENKOV_MAX_SOURCES * 8);
  let stepDecays = 0;
  let stepDepositedJ = 0;
  let stepPowerW = 0;

  for (let i = 0; i < clamped.length; i += 1) {
    const src = clamped[i];
    const key = `${src.bodyId}:${src.domainId}:${src.isotope}`;
    const prevAtoms = state.remainingAtomsByKey.has(key)
      ? state.remainingAtomsByKey.get(key)
      : (Number(src.initialAtomCount) || 0);
    const lambda = Math.max(0, Number(src.lambdaPerS) || 0);
    const decayed = dt > 0 && lambda > 0 && prevAtoms > 0
      ? prevAtoms * (-Math.expm1(-lambda * dt))
      : 0;
    const remaining = Math.max(0, prevAtoms - decayed);
    const nucleonErr = prevAtoms > 0
      ? Math.abs((remaining + decayed) - prevAtoms) / prevAtoms
      : 0;
    if (nucleonErr > state.maxNucleonRelError) state.maxNucleonRelError = nucleonErr;
    state.remainingAtomsByKey.set(key, remaining);

    const energyReleasedJ = decayed * (Number(src.qValueMeV) || 0) * MEV_TO_JOULE;
    const depositedJ = energyReleasedJ * (Number(src.localDepositionFraction) || 0.5);
    const massKg = Math.max(1e-9, Number(src.massKg) || 1);
    const deltaSpecificEnergyJPerKg = depositedJ / massKg;
    stepDecays += decayed;
    stepDepositedJ += depositedJ;
    if (dt > 0) stepPowerW += depositedJ / dt;

    const activityBq = remaining * lambda;
    const radianceScale = activityBq > 0
      ? Math.min(24.0, Math.max(1.5, Math.log10(Math.max(10, activityBq)) * 1.15))
      : 0;
    const rigidIdx = resolveRigidBodyIndexForSource(src, validRigid, usedRigidIndices);

    const b = i * 8;
    specs[b + 0] = Number(src.domainId) || 0;
    specs[b + 1] = deltaSpecificEnergyJPerKg;
    specs[b + 2] = Math.max(0.02, Number(src.radiusM) || 0.12);
    specs[b + 3] = Number(src.beta) || 0;
    specs[b + 4] = Math.max(0.02, Number(src.attenuationRangeM) || 0.18);
    specs[b + 5] = radianceScale;
    specs[b + 6] = src.beta > 0 && activityBq > 0 ? 1.0 : 0.0;
    specs[b + 7] = rigidIdx;
  }

  state.elapsedS += dt;
  state.totalDecays += stepDecays;
  state.totalDepositedThermalEnergyJ += stepDepositedJ;
  if (dt > 0) state.thermalPowerW = stepPowerW;

  const pData = new Uint32Array([
    particleCount >>> 0,
    clamped.length >>> 0,
    dt > 0 ? 1 : 0,
    exactEnergyBuffer ? 1 : 0,
    validRigid ? (validRigid.bodyCount >>> 0) : 0,
    0,
    0,
    0
  ]);
  state.device.queue.writeBuffer(state.paramsBuffer, 0, pData);
  state.device.queue.writeBuffer(state.sourceSpecsBuffer, 0, specs);

  const exactBuf = exactEnergyBuffer || state.dummyExactEnergyBuffer;
  const rigidBuf = validRigid ? validRigid.frameBuffer : state.dummyRigidFramesBuffer;
  const bg = createCachedExplicitBindGroup(state.device, {
    label: 'ulg-sph-nuclear-cherenkov-bg',
    layout: state.pipes.deposit.bindGroupLayout,
    entries: [
      { binding: 0, resource: { buffer: state.paramsBuffer } },
      { binding: 1, resource: { buffer: state.sourceSpecsBuffer } },
      { binding: 2, resource: { buffer: stateBuffer } },
      { binding: 3, resource: { buffer: identityBuffer } },
      { binding: 4, resource: { buffer: state.centroidAccumBuffer } },
      { binding: 5, resource: { buffer: state.cherenkovSourcesBuffer } },
      { binding: 6, resource: { buffer: exactBuf } },
      { binding: 7, resource: { buffer: rigidBuf } }
    ]
  });

  const pass = encoder.beginComputePass({ label: 'ulg-sph-nuclear-decay-and-cherenkov-pass' });
  pass.setPipeline(state.pipes.clear.pipeline);
  pass.setBindGroup(0, bg);
  pass.dispatchWorkgroups(1);

  pass.setPipeline(state.pipes.deposit.pipeline);
  pass.setBindGroup(0, bg);
  pass.dispatchWorkgroups(Math.max(1, Math.ceil(particleCount / 64)));

  pass.setPipeline(state.pipes.finalize.pipeline);
  pass.setBindGroup(0, bg);
  pass.dispatchWorkgroups(1);
  pass.end();

  state.lastSnapshot = buildLiveRuntimeSnapshot(state);
  return state.lastSnapshot;
}

/**
 * Create the GPU 3D world-space volumetric Cherenkov renderer that draws inside
 * ULG's existing refractive dielectric front pass (0 extra render passes!).
 */
export function createSphCherenkovVolumetricRenderer(device, {
  colorFormat,
  depthFormat = 'depth24plus'
} = {}) {
  const keyDevice = unwrapWebGpuCacheDevice(device);
  const shader = keyDevice.createShaderModule({
    label: 'ulg-sph-cherenkov-dielectric-volume',
    code: SPH_CHERENKOV_DIELECTRIC_VOLUME_WGSL
  });
  const dataLayout = keyDevice.createBindGroupLayout({
    label: 'ulg-sph-cherenkov-vol-data-layout',
    entries: [
      { binding: 0, visibility: SHADER_STAGE.VERTEX, buffer: { type: 'read-only-storage' } },
      { binding: 1, visibility: SHADER_STAGE.VERTEX | SHADER_STAGE.FRAGMENT, buffer: { type: 'uniform', minBindingSize: WORKER_NATIVE_SURFACE_UNIFORM_BYTES } },
      { binding: 2, visibility: SHADER_STAGE.FRAGMENT, buffer: { type: 'read-only-storage' } },
      { binding: 3, visibility: SHADER_STAGE.VERTEX, buffer: { type: 'read-only-storage' } },
      { binding: 4, visibility: SHADER_STAGE.VERTEX, buffer: { type: 'read-only-storage' } },
      { binding: 5, visibility: SHADER_STAGE.VERTEX, buffer: { type: 'uniform', minBindingSize: WORKER_NATIVE_SURFACE_MOTION_UNIFORM_BYTES } }
    ]
  });
  const volLayout = keyDevice.createBindGroupLayout({
    label: 'ulg-sph-cherenkov-vol-sources-layout',
    entries: [
      { binding: 0, visibility: SHADER_STAGE.FRAGMENT, texture: { sampleType: 'depth' } },
      { binding: 1, visibility: SHADER_STAGE.FRAGMENT, buffer: { type: 'read-only-storage' } }
    ]
  });
  const pipeline = keyDevice.createRenderPipeline({
    label: 'ulg-sph-cherenkov-dielectric-volume-pipeline',
    layout: keyDevice.createPipelineLayout({ bindGroupLayouts: [dataLayout, volLayout] }),
    vertex: { module: shader, entryPoint: 'vs_main' },
    fragment: {
      module: shader,
      entryPoint: 'fs_main',
      targets: [{
        format: colorFormat,
        // Energy-bounded screen-like additive blend inside 3D dielectric pixels only
        blend: {
          color: { srcFactor: 'one', dstFactor: 'one-minus-src', operation: 'add' },
          alpha: { srcFactor: 'zero', dstFactor: 'one', operation: 'add' }
        }
      }]
    },
    primitive: { topology: 'triangle-list', cullMode: 'back' },
    depthStencil: {
      format: depthFormat,
      depthWriteEnabled: false,
      depthCompare: 'less-equal'
    }
  });

  const emptyMotion = keyDevice.createBuffer({
    label: 'ulg-sph-cherenkov-empty-motion',
    size: 16,
    usage: GPU_BUFFER_USAGE.STORAGE
  });
  const zeroMotionUniform = keyDevice.createBuffer({
    label: 'ulg-sph-cherenkov-zero-motion-uniform',
    size: WORKER_NATIVE_SURFACE_MOTION_UNIFORM_BYTES,
    usage: GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST
  });
  let disposed = false;

  function draw(pass, {
    compactPositionRowsBuffer,
    compactNormalRowsBuffer,
    drawIndirectRowsBuffer,
    cameraUniformBuffer,
    opticalRecordsBuffer,
    motionFieldBuffer = null,
    motionUniformBuffer = null,
    backDepthView,
    cherenkovSourcesBuffer
  }) {
    if (
      disposed
      || !compactPositionRowsBuffer
      || !compactNormalRowsBuffer
      || !drawIndirectRowsBuffer
      || !cameraUniformBuffer
      || !opticalRecordsBuffer
      || !backDepthView
      || !cherenkovSourcesBuffer
    ) {
      return false;
    }
    const bg0 = createCachedExplicitBindGroup(keyDevice, {
      label: 'ulg-sph-cherenkov-vol-bg0',
      layout: dataLayout,
      entries: [
        { binding: 0, resource: { buffer: compactPositionRowsBuffer } },
        { binding: 1, resource: { buffer: cameraUniformBuffer } },
        { binding: 2, resource: { buffer: opticalRecordsBuffer } },
        { binding: 3, resource: { buffer: compactNormalRowsBuffer } },
        { binding: 4, resource: { buffer: motionFieldBuffer || emptyMotion } },
        { binding: 5, resource: { buffer: motionUniformBuffer || zeroMotionUniform } }
      ]
    });
    const bg1 = keyDevice.createBindGroup({
      label: 'ulg-sph-cherenkov-vol-bg1',
      layout: volLayout,
      entries: [
        { binding: 0, resource: backDepthView },
        { binding: 1, resource: { buffer: cherenkovSourcesBuffer } }
      ]
    });
    pass.setPipeline(pipeline);
    pass.setBindGroup(0, bg0);
    pass.setBindGroup(1, bg1);
    pass.drawIndirect(drawIndirectRowsBuffer, 0);
    return true;
  }

  return {
    draw,
    dispose() {
      if (disposed) return;
      disposed = true;
      emptyMotion.destroy();
      zeroMotionUniform.destroy();
    }
  };
}
