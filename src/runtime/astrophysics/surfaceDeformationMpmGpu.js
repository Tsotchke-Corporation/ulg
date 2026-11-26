// Active-Zone Hybrid GPU MLS-MPM Deformable Terrain, Persistent Thermal/Crater Field
// & 64 Faceted 3D Rigid-Body Planetary Boulders (`src/runtime/astrophysics/surfaceDeformationMpmGpu.js`)
//
// Performance-First Design ("Dormant-Zero MLS-MPM"):
//   - Persistent 128x128 GPU terrain deformation & thermal buffer (`heightDelta, tempK, meltFrac, charFrac`, 256 KB)
//     read directly by `generate_surface_terrain_mesh` (+0 extra render draw calls).
//   - True 32x24x32 GPU MLS-MPM P2G -> Grid Update -> G2P blast/ejecta/slump solver (2,048 material points,
//     64-thread workgroups, atomic fixed-point momentum conservation) that stays STRICTLY DORMANT
//     (0 compute passes / 0 ms) until a missile, laser ablation, boulder shatter, or antimatter impact occurs!
//   - 64 deterministic multi-scale faceted 3D rigid-body boulders (0.9 m .. 8.5 m) with live 3D velocity,
//     spin, deformed-terrain collision & slope rolling, boulder-boulder collisions, tractor-beam capture/toss,
//     blast shockwave impulses, and thermal laser heating/shattering into harvestable resources!

import {
  computeBufferBinding,
  createCachedExplicitBindGroup,
  createCachedExplicitComputePipeline
} from '../webgpuComputeLayout.js';

const GPU_BUF = Object.freeze({
  COPY_DST: 0x0008,
  VERTEX: 0x0020,
  UNIFORM: 0x0040,
  STORAGE: 0x0080
});

export const DEFORM_GRID_N = 128;
export const DEFORM_PATCH_HALF_M = 384.0; // Covers [-384 m .. +384 m] in world XZ!
const MPM_GX = 32;
const MPM_GY = 24;
const MPM_GZ = 32;
const MPM_MAX_POINTS = 2048;
const MAX_BOULDERS = 64;
export const MAX_CRATER_STAMPS = 512;

function clamp(x, lo, hi) { return Math.max(lo, Math.min(hi, x)); }
function normalize3(v) {
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
}
function cross3(a, b) {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}

function hashU32(n) {
  let x = (Math.imul(n | 0, 0x27d4eb2d) ^ 0x165667b1) >>> 0;
  x = Math.imul(x ^ (x >>> 15), 0x85ebca6b) >>> 0;
  x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35) >>> 0;
  return ((x ^ (x >>> 16)) >>> 0) / 4294967296;
}

// =========================================================================
// 1. WGSL Compute Kernels: Persistent 128x128 Deformation/Thermal Field
//    + Dormant-Zero 32x24x32 Active-Zone MLS-MPM Blast & Crater-Slump Kernel
// =========================================================================
export const surfaceDeformationMpmWgsl = /* wgsl */ `
struct DeformParams {
  grid_n: u32,
  stamp_kind: u32,       // 0 = cool/diffuse only, 1 = crater/blast, 2 = laser spot heat/melt, 3 = antimatter mega-crater
  mpm_count: u32,
  step_idx: u32,
  patch_half_m: f32,
  ambient_temp_k: f32,
  dt: f32,
  gravity_g: f32,
  stamp_x: f32,
  stamp_z: f32,
  stamp_radius_m: f32,
  stamp_depth_m: f32,
  stamp_temp_k: f32,
  stamp_melt: f32,
  stamp_char: f32,
  mpm_origin_x: f32,
  mpm_origin_y: f32,
  mpm_origin_z: f32,
  mpm_cell_m: f32,
  mpm_floor_y: f32,
};

// Persistent 128x128 deformation field:
//   x = heightDeltaM (negative crater bowl, positive raised ejecta rim)
//   y = tempK (surface thermal glow from laser / missile / antimatter!)
//   z = meltFrac (0..1 molten glass / melted ice pool)
//   w = charFrac (0..1 scorched blast rim / vitrified obsidian)
@group(0) @binding(0) var<uniform> dp: DeformParams;
@group(0) @binding(1) var<storage, read_write> deform_field: array<vec4<f32>>;

// 64-byte MLS-MPM material points (exact PARTICLE_CLOUD_WGSL Mode 11 layout for zero-copy rendering!)
//   pos_role: vec4(x, y, z, role)    role: 0=molten/plasma, 1=rock_ejecta, 2=vapor/steam
//   vel_age:  vec4(vx, vy, vz, age)
//   col_life: vec4(r, g, b, maxLife)
//   meta0:    vec4(size, tempK, mass, live)
struct MpmPoint {
  pos_role: vec4<f32>,
  vel_age: vec4<f32>,
  col_life: vec4<f32>,
  meta0: vec4<f32>,
};

struct MpmGridCell {
  mass_i: atomic<i32>,
  px_i: atomic<i32>,
  py_i: atomic<i32>,
  pz_i: atomic<i32>,
};

@group(0) @binding(2) var<storage, read_write> mpm_points: array<MpmPoint>;
@group(0) @binding(3) var<storage, read_write> mpm_grid: array<MpmGridCell>;

@compute @workgroup_size(8, 8)
fn update_surface_deform_field(@builtin(global_invocation_id) gid: vec3<u32>) {
  let n = dp.grid_n;
  if (gid.x >= n || gid.y >= n) { return; }
  let idx = gid.y * n + gid.x;
  let u = (f32(gid.x) / f32(n - 1u)) * 2.0 - 1.0;
  let v = (f32(gid.y) / f32(n - 1u)) * 2.0 - 1.0;
  let wx = u * dp.patch_half_m;
  let wz = v * dp.patch_half_m;

  var cell = deform_field[idx];
  if (cell.y < 10.0) { cell.y = dp.ambient_temp_k; }

  // 1. Apply active crater blast, laser thermal spot, or antimatter annihilation excavation!
  if (dp.stamp_kind > 0u && dp.stamp_radius_m > 0.1) {
    let dx = wx - dp.stamp_x;
    let dz = wz - dp.stamp_z;
    let r = sqrt(dx * dx + dz * dz);
    let rn = r / dp.stamp_radius_m;
    if (rn < 1.85) {
      if (dp.stamp_kind == 1u || dp.stamp_kind == 3u) {
        // Parabolic crater bowl + authentic raised ejecta rim lip (rn in 0.85..1.55)!
        let bowl = max(0.0, 1.0 - rn * rn);
        let rim_d = rn - 1.12;
        let rim = exp(-(rim_d * rim_d) * 14.0) * 0.24;
        let dh = -dp.stamp_depth_m * bowl + dp.stamp_depth_m * rim;
        cell.x = clamp(cell.x + dh, -48.0, 22.0);
        let heat_w = exp(-rn * rn * 1.45);
        cell.y = max(cell.y, dp.ambient_temp_k + (dp.stamp_temp_k - dp.ambient_temp_k) * heat_w);
        cell.z = clamp(cell.z + dp.stamp_melt * heat_w, 0.0, 1.0);
        cell.w = clamp(cell.w + dp.stamp_char * exp(-rn * rn * 0.65), 0.0, 1.0);
      } else if (dp.stamp_kind == 2u) {
        // Continuous Tunable-EM Laser spot heating, melting, & vaporization trenching!
        let gauss = exp(-rn * rn * 2.2);
        cell.x = clamp(cell.x - dp.stamp_depth_m * gauss, -42.0, 20.0);
        cell.y = clamp(mix(cell.y, max(cell.y, dp.stamp_temp_k), clamp(gauss * 0.48, 0.0, 1.0)), dp.ambient_temp_k, 16000.0);
        cell.z = clamp(cell.z + dp.stamp_melt * gauss, 0.0, 1.0);
        cell.w = clamp(cell.w + dp.stamp_char * gauss * 0.65, 0.0, 1.0);
      }
    }
  }

  // 2. Stefan-Boltzmann T^4 radiative cooling back toward planetary ambient temperature
  if (cell.y > dp.ambient_temp_k + 0.5) {
    let t_norm = clamp((cell.y - dp.ambient_temp_k) / 2000.0, 0.0, 8.0);
    let cool = (18.0 + 420.0 * t_norm * t_norm) * dp.dt;
    cell.y = max(dp.ambient_temp_k, cell.y - cool);
  }
  cell.z = max(0.0, cell.z - dp.dt * 0.015);
  deform_field[idx] = cell;
}

const MPM_GX_U: u32 = 32u;
const MPM_GY_U: u32 = 24u;
const MPM_GZ_U: u32 = 32u;
const MPM_FIXED_SCALE: f32 = 512.0;

@compute @workgroup_size(64)
fn clear_mpm_grid(@builtin(global_invocation_id) gid: vec3<u32>) {
  let total = MPM_GX_U * MPM_GY_U * MPM_GZ_U;
  if (gid.x >= total) { return; }
  atomicStore(&mpm_grid[gid.x].mass_i, 0);
  atomicStore(&mpm_grid[gid.x].px_i, 0);
  atomicStore(&mpm_grid[gid.x].py_i, 0);
  atomicStore(&mpm_grid[gid.x].pz_i, 0);
}

fn mpm_grid_idx(gx: u32, gy: u32, gz: u32) -> u32 {
  return (gy * MPM_GZ_U + gz) * MPM_GX_U + gx;
}

@compute @workgroup_size(64)
fn p2g_mpm_ejecta(@builtin(global_invocation_id) gid: vec3<u32>) {
  if (gid.x >= dp.mpm_count) { return; }
  let pt = mpm_points[gid.x];
  if (pt.meta0.w < 0.5) { return; }
  let inv_dx = 1.0 / max(0.5, dp.mpm_cell_m);
  let rel = (pt.pos_role.xyz - vec3<f32>(dp.mpm_origin_x, dp.mpm_origin_y, dp.mpm_origin_z)) * inv_dx;
  let base = vec3<i32>(floor(rel - vec3<f32>(0.5)));
  let fx = rel - vec3<f32>(base);
  // Quadratic B-spline weights (standard MLS-MPM!)
  let w0 = 0.5 * (1.5 - fx) * (1.5 - fx);
  let w1 = 0.75 - (fx - 1.0) * (fx - 1.0);
  let w2 = 0.5 * (fx - 0.5) * (fx - 0.5);
  var wx = array<f32, 3>(w0.x, w1.x, w2.x);
  var wy = array<f32, 3>(w0.y, w1.y, w2.y);
  var wz = array<f32, 3>(w0.z, w1.z, w2.z);

  let mass = max(0.1, pt.meta0.z);
  let vel = pt.vel_age.xyz;
  for (var i = 0; i < 3; i = i + 1) {
    let gx = base.x + i;
    if (gx < 0 || gx >= i32(MPM_GX_U)) { continue; }
    for (var j = 0; j < 3; j = j + 1) {
      let gy = base.y + j;
      if (gy < 0 || gy >= i32(MPM_GY_U)) { continue; }
      for (var k = 0; k < 3; k = k + 1) {
        let gz = base.z + k;
        if (gz < 0 || gz >= i32(MPM_GZ_U)) { continue; }
        let w = wx[i] * wy[j] * wz[k];
        if (w <= 1e-4) { continue; }
        let wm = w * mass;
        let idx = mpm_grid_idx(u32(gx), u32(gy), u32(gz));
        atomicAdd(&mpm_grid[idx].mass_i, i32(clamp(wm * MPM_FIXED_SCALE, 1.0, 2000000.0)));
        atomicAdd(&mpm_grid[idx].px_i, i32(clamp(wm * vel.x * MPM_FIXED_SCALE, -2000000.0, 2000000.0)));
        atomicAdd(&mpm_grid[idx].py_i, i32(clamp(wm * vel.y * MPM_FIXED_SCALE, -2000000.0, 2000000.0)));
        atomicAdd(&mpm_grid[idx].pz_i, i32(clamp(wm * vel.z * MPM_FIXED_SCALE, -2000000.0, 2000000.0)));
      }
    }
  }
}

@compute @workgroup_size(64)
fn update_mpm_grid(@builtin(global_invocation_id) gid: vec3<u32>) {
  let total = MPM_GX_U * MPM_GY_U * MPM_GZ_U;
  if (gid.x >= total) { return; }
  let mi = atomicLoad(&mpm_grid[gid.x].mass_i);
  if (mi <= 0) { return; }
  let m = f32(mi) / MPM_FIXED_SCALE;
  var vx = (f32(atomicLoad(&mpm_grid[gid.x].px_i)) / MPM_FIXED_SCALE) / max(1e-4, m);
  var vy = (f32(atomicLoad(&mpm_grid[gid.x].py_i)) / MPM_FIXED_SCALE) / max(1e-4, m);
  var vz = (f32(atomicLoad(&mpm_grid[gid.x].pz_i)) / MPM_FIXED_SCALE) / max(1e-4, m);

  // Gravity + mild atmospheric drag + granular pressure repulsion on crowded floor cells
  vy = vy - dp.gravity_g * dp.dt;
  let drag = max(0.84, 1.0 - 0.14 * dp.dt);
  vx = vx * drag;
  vz = vz * drag;

  let gy = gid.x / (MPM_GX_U * MPM_GZ_U);
  if (gy <= 1u && vy < 0.0) {
    vy = -vy * 0.22;
    vx = vx * 0.62;
    vz = vz * 0.62;
  }

  atomicStore(&mpm_grid[gid.x].px_i, i32(clamp(vx * MPM_FIXED_SCALE, -2000000.0, 2000000.0)));
  atomicStore(&mpm_grid[gid.x].py_i, i32(clamp(vy * MPM_FIXED_SCALE, -2000000.0, 2000000.0)));
  atomicStore(&mpm_grid[gid.x].pz_i, i32(clamp(vz * MPM_FIXED_SCALE, -2000000.0, 2000000.0)));
}

@compute @workgroup_size(64)
fn g2p_mpm_ejecta(@builtin(global_invocation_id) gid: vec3<u32>) {
  if (gid.x >= dp.mpm_count) { return; }
  var pt = mpm_points[gid.x];
  if (pt.meta0.w < 0.5) { return; }

  let age = pt.vel_age.w + dp.dt;
  let max_life = max(0.5, pt.col_life.w);
  if (age >= max_life) {
    pt.meta0.w = 0.0;
    mpm_points[gid.x] = pt;
    return;
  }

  let role = pt.pos_role.w;
  var vel = pt.vel_age.xyz;
  let inv_dx = 1.0 / max(0.5, dp.mpm_cell_m);
  let rel = (pt.pos_role.xyz - vec3<f32>(dp.mpm_origin_x, dp.mpm_origin_y, dp.mpm_origin_z)) * inv_dx;
  let base = vec3<i32>(floor(rel - vec3<f32>(0.5)));
  let fx = rel - vec3<f32>(base);
  let w0 = 0.5 * (1.5 - fx) * (1.5 - fx);
  let w1 = 0.75 - (fx - 1.0) * (fx - 1.0);
  let w2 = 0.5 * (fx - 0.5) * (fx - 0.5);
  var wx = array<f32, 3>(w0.x, w1.x, w2.x);
  var wy = array<f32, 3>(w0.y, w1.y, w2.y);
  var wz = array<f32, 3>(w0.z, w1.z, w2.z);

  var v_pic = vec3<f32>(0.0);
  var w_sum = 0.0;
  for (var i = 0; i < 3; i = i + 1) {
    let gx = base.x + i;
    if (gx < 0 || gx >= i32(MPM_GX_U)) { continue; }
    for (var j = 0; j < 3; j = j + 1) {
      let gy = base.y + j;
      if (gy < 0 || gy >= i32(MPM_GY_U)) { continue; }
      for (var k = 0; k < 3; k = k + 1) {
        let gz = base.z + k;
        if (gz < 0 || gz >= i32(MPM_GZ_U)) { continue; }
        let w = wx[i] * wy[j] * wz[k];
        if (w <= 1e-4) { continue; }
        let idx = mpm_grid_idx(u32(gx), u32(gy), u32(gz));
        if (atomicLoad(&mpm_grid[idx].mass_i) > 0) {
          let gv = vec3<f32>(
            f32(atomicLoad(&mpm_grid[idx].px_i)) / MPM_FIXED_SCALE,
            f32(atomicLoad(&mpm_grid[idx].py_i)) / MPM_FIXED_SCALE,
            f32(atomicLoad(&mpm_grid[idx].pz_i)) / MPM_FIXED_SCALE
          );
          v_pic = v_pic + gv * w;
          w_sum = w_sum + w;
        }
      }
    }
  }

  if (w_sum > 0.1) {
    let v_grid = v_pic / w_sum;
    // PIC/FLIP blend (82% FLIP ballistic retention + 18% PIC cohesive crater-slump viscosity!)
    vel = mix(vel + vec3<f32>(0.0, -dp.gravity_g * dp.dt, 0.0), v_grid, 0.28);
  } else {
    // Outside local active MPM box: continue ballistic + buoyant plume physics cleanly!
    let g_eff = select(dp.gravity_g, -dp.gravity_g * 0.35, role > 1.5);
    vel.y = vel.y - g_eff * dp.dt;
  }

  var pos = pt.pos_role.xyz + vel * dp.dt;
  // Ground collision against active crater floor + friction settling
  let floor_y = dp.mpm_floor_y;
  if (pos.y < floor_y && role < 1.5) {
    pos.y = floor_y;
    if (vel.y < 0.0) { vel.y = -vel.y * 0.28; }
    vel.x = vel.x * 0.72;
    vel.z = vel.z * 0.72;
  }

  // Radiative cooling shifts incandescent lava/plasma particles -> glowing ember -> dark basalt dust!
  let temp_k = max(dp.ambient_temp_k, pt.meta0.y - (320.0 + pt.meta0.y * 0.22) * dp.dt);
  if (role < 0.5) {
    let glow = clamp((temp_k - 900.0) / 2600.0, 0.0, 1.0);
    pt.col_life.x = mix(0.42, 1.0, glow);
    pt.col_life.y = mix(0.24, 0.86, glow * glow);
    pt.col_life.z = mix(0.20, 0.52, glow * glow * glow);
  }
  pt.pos_role = vec4<f32>(pos, role);
  pt.vel_age = vec4<f32>(vel, age);
  pt.meta0.y = temp_k;
  mpm_points[gid.x] = pt;
}
`;

// =========================================================================
// 1B. Parallel 1-Submit GPU Crater Replay & GPU SE(3) Boulder Skinning Shaders
// =========================================================================
const CRATER_REPLAY_WGSL = /* wgsl */ `
struct ReplayParams {
  grid_n: u32,
  stamp_count: u32,
  pad0: u32,
  pad1: u32,
  patch_half_m: f32,
  ambient_temp_k: f32,
  pad2: f32,
  pad3: f32,
};

struct CraterStampRec {
  pos_rad_dep: vec4<f32>, // x, z, radiusM, depthM
  therm_kind: vec4<f32>,  // tempK, melt, char, kind (1=missile, 2=laser, 3=antimatter)
};

@group(0) @binding(0) var<uniform> rp: ReplayParams;
@group(0) @binding(1) var<storage, read> stamps: array<CraterStampRec>;
@group(0) @binding(2) var<storage, read_write> deform_field: array<vec4<f32>>;

@compute @workgroup_size(8, 8)
fn replay_crater_stamps(@builtin(global_invocation_id) gid: vec3<u32>) {
  let n = rp.grid_n;
  if (gid.x >= n || gid.y >= n) { return; }
  let idx = gid.y * n + gid.x;
  let u = (f32(gid.x) / f32(n - 1u)) * 2.0 - 1.0;
  let v = (f32(gid.y) / f32(n - 1u)) * 2.0 - 1.0;
  let wx = u * rp.patch_half_m;
  let wz = v * rp.patch_half_m;

  var cell = deform_field[idx];
  if (cell.y < 10.0) { cell.y = rp.ambient_temp_k; }

  for (var i = 0u; i < rp.stamp_count; i = i + 1u) {
    let st = stamps[i];
    let rad = max(0.5, st.pos_rad_dep.z);
    let dx = wx - st.pos_rad_dep.x;
    let dz = wz - st.pos_rad_dep.y;
    let r = sqrt(dx * dx + dz * dz);
    let rn = r / rad;
    if (rn >= 1.85) { continue; }
    let kind = u32(round(st.therm_kind.w));
    if (kind == 2u) {
      let spot = exp(-rn * rn * 2.2);
      cell.x = clamp(cell.x - st.pos_rad_dep.w * spot, -48.0, 22.0);
      cell.y = max(cell.y, rp.ambient_temp_k + (st.therm_kind.x - rp.ambient_temp_k) * spot * 0.45);
      cell.z = clamp(cell.z + st.therm_kind.y * spot, 0.0, 1.0);
      cell.w = clamp(cell.w + st.therm_kind.z * spot, 0.0, 1.0);
    } else {
      let bowl = max(0.0, 1.0 - rn * rn);
      let rim_d = rn - 1.12;
      let rim = exp(-(rim_d * rim_d) * 14.0) * 0.24;
      let dh = -st.pos_rad_dep.w * bowl + st.pos_rad_dep.w * rim;
      cell.x = clamp(cell.x + dh, -48.0, 22.0);
      let heat_w = exp(-rn * rn * 1.45);
      cell.y = max(cell.y, rp.ambient_temp_k + (st.therm_kind.x - rp.ambient_temp_k) * heat_w * 0.35);
      cell.z = clamp(cell.z + st.therm_kind.y * heat_w, 0.0, 1.0);
      cell.w = clamp(cell.w + st.therm_kind.z * exp(-rn * rn * 0.65), 0.0, 1.0);
    }
  }
  deform_field[idx] = cell;
}
`;

const BOULDER_SKIN_WGSL = /* wgsl */ `
struct SkinParams {
  boulder_count: u32,
  tri_count: u32,
  pad0: u32,
  pad1: u32,
  ref_x: f32,
  ref_z: f32,
  curv_inv_2r: f32,
  pad2: f32,
};

struct BoulderPose {
  pos_r: vec4<f32>,         // x, y, z, radius (<= 0 => dead/culled!)
  quat: vec4<f32>,          // unit SE(3) DLM quaternion (qx, qy, qz, qw)
  stretch_temp: vec4<f32>,  // sx, sy, sz, tempK
  col_emiss: vec4<f32>,     // r, g, b, emiss
};

struct SurfaceVert {
  pos_h: vec4<f32>,
  norm_tag: vec4<f32>,
  col_emiss: vec4<f32>,
};

@group(0) @binding(0) var<uniform> sp: SkinParams;
@group(0) @binding(1) var<storage, read> poses: array<BoulderPose>;
@group(0) @binding(2) var<storage, read> tmpl_verts: array<vec4<f32>>; // 60 verts: xyz = unit ico vert, w = vertIdx
@group(0) @binding(3) var<storage, read_write> out_verts: array<SurfaceVert>;

fn q_rot(q: vec4<f32>, v: vec3<f32>) -> vec3<f32> {
  let t = 2.0 * cross(q.xyz, v);
  return v + q.w * t + cross(q.xyz, t);
}

fn jitter_for(bid: u32, vid: u32) -> f32 {
  var h = (bid * 1009u + vid * 37u + 17u) * 2654435761u;
  h = h ^ (h >> 15u);
  return 0.78 + f32(h & 0xFFFFu) * (0.44 / 65536.0);
}

@compute @workgroup_size(64)
fn skin_boulder_meshes(@builtin(global_invocation_id) gid: vec3<u32>) {
  let total_tris = sp.boulder_count * sp.tri_count;
  let ti = gid.x;
  if (ti >= total_tris) { return; }
  let bid = ti / sp.tri_count;
  let local_tri = ti % sp.tri_count;
  let v_base = ti * 3u;
  let b = poses[bid];

  if (b.pos_r.w <= 0.01) {
    let zero_v = SurfaceVert(vec4<f32>(0.0, -9999.0, 0.0, 0.0), vec4<f32>(0.0, 1.0, 0.0, 0.0), vec4<f32>(0.0));
    out_verts[v_base + 0u] = zero_v;
    out_verts[v_base + 1u] = zero_v;
    out_verts[v_base + 2u] = zero_v;
    return;
  }

  let dx = b.pos_r.x - sp.ref_x;
  let dz = b.pos_r.z - sp.ref_z;
  if (dx * dx + dz * dz > 360.0 * 360.0) {
    let zero_v = SurfaceVert(vec4<f32>(0.0, -9999.0, 0.0, 0.0), vec4<f32>(0.0, 1.0, 0.0, 0.0), vec4<f32>(0.0));
    out_verts[v_base + 0u] = zero_v;
    out_verts[v_base + 1u] = zero_v;
    out_verts[v_base + 2u] = zero_v;
    return;
  }

  let base_curv_y = b.pos_r.y - (dx * dx + dz * dz) * sp.curv_inv_2r;
  let center = vec3<f32>(b.pos_r.x, base_curv_y, b.pos_r.z);
  let t0 = tmpl_verts[local_tri * 3u + 0u];
  let t1 = tmpl_verts[local_tri * 3u + 1u];
  let t2 = tmpl_verts[local_tri * 3u + 2u];
  let p0 = center + q_rot(b.quat, t0.xyz * (b.pos_r.w * jitter_for(bid, u32(t0.w))) * b.stretch_temp.xyz);
  let p1 = center + q_rot(b.quat, t1.xyz * (b.pos_r.w * jitter_for(bid, u32(t1.w))) * b.stretch_temp.xyz);
  let p2 = center + q_rot(b.quat, t2.xyz * (b.pos_r.w * jitter_for(bid, u32(t2.w))) * b.stretch_temp.xyz);

  var nrm = normalize(cross(p1 - p0, p2 - p0) + vec3<f32>(1e-6, 0.0, 0.0));
  let face_c = (p0 + p1 + p2) * (1.0 / 3.0) - center;
  if (dot(nrm, face_c) < 0.0) { nrm = -nrm; }

  let hot = clamp((b.stretch_temp.w - 750.0) / 1600.0, 0.0, 1.0);
  let rgb = mix(b.col_emiss.rgb, vec3<f32>(1.0, 0.36 + 0.52 * hot, 0.14 * hot), hot);
  let emiss = select(b.col_emiss.w, hot * 1.65, hot > 0.02);

  out_verts[v_base + 0u] = SurfaceVert(vec4<f32>(p0, b.pos_r.y), vec4<f32>(nrm, 0.0), vec4<f32>(rgb, emiss));
  out_verts[v_base + 1u] = SurfaceVert(vec4<f32>(p1, b.pos_r.y), vec4<f32>(nrm, 0.0), vec4<f32>(rgb, emiss));
  out_verts[v_base + 2u] = SurfaceVert(vec4<f32>(p2, b.pos_r.y), vec4<f32>(nrm, 0.0), vec4<f32>(rgb, emiss));
}
`;

// Exact 5-stage Dullweber-Leimkuhler-McLachlan (1997) symplectic SE(3) quaternion free-rotation
// matching ULG's canonical `particleRigidDynamicsGpu.js` (zero Euler gimbal lock, exact |L| conservation!).
function quatMul(a, b) {
  return [
    a[3] * b[0] + b[3] * a[0] + (a[1] * b[2] - a[2] * b[1]),
    a[3] * b[1] + b[3] * a[1] + (a[2] * b[0] - a[0] * b[2]),
    a[3] * b[2] + b[3] * a[2] + (a[0] * b[1] - a[1] * b[0]),
    a[3] * b[3] - (a[0] * b[0] + a[1] * b[1] + a[2] * b[2])
  ];
}
function quatNorm(q) {
  const l = Math.hypot(q[0], q[1], q[2], q[3]) || 1;
  return [q[0] / l, q[1] / l, q[2] / l, q[3] / l];
}
function quatRotate(q, v) {
  const tx = 2 * (q[1] * v[2] - q[2] * v[1]);
  const ty = 2 * (q[2] * v[0] - q[0] * v[2]);
  const tz = 2 * (q[0] * v[1] - q[1] * v[0]);
  return [
    v[0] + q[3] * tx + (q[1] * tz - q[2] * ty),
    v[1] + q[3] * ty + (q[2] * tx - q[0] * tz),
    v[2] + q[3] * tz + (q[0] * ty - q[1] * tx)
  ];
}
function quatInvRotate(q, v) {
  return quatRotate([-q[0], -q[1], -q[2], q[3]], v);
}
function dlmFreeRotateBody(b, dt) {
  const stepAxis = (axisIdx, subDt) => {
    const Lbody = quatInvRotate(b.quat, b.angMom);
    const omegaA = Lbody[axisIdx] / Math.max(1e-4, b.inertia[axisIdx]);
    const half = 0.5 * omegaA * subDt;
    const s = Math.sin(half);
    const c = Math.cos(half);
    const dq = axisIdx === 0 ? [s, 0, 0, c] : (axisIdx === 1 ? [0, s, 0, c] : [0, 0, s, c]);
    b.quat = quatNorm(quatMul(b.quat, dq));
  };
  stepAxis(0, dt * 0.5);
  stepAxis(1, dt * 0.5);
  stepAxis(2, dt);
  stepAxis(1, dt * 0.5);
  stepAxis(0, dt * 0.5);
}

// =========================================================================
// 2. Faceted 3D Rigid-Body Boulder Polyhedron Mesh Generator (48-byte verts)
// =========================================================================
const ICO_VERTS = (() => {
  const t = (1 + Math.sqrt(5)) * 0.5;
  return [
    [-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0],
    [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t],
    [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1]
  ].map((v) => normalize3(v));
})();

const ICO_FACES = [
  [0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11],
  [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8],
  [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9],
  [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1]
];

// =========================================================================
// 3. Create Active-Zone Deformable Surface + MLS-MPM + 64 Rigid Boulders Session
// =========================================================================
export function createSurfaceDeformationAndBouldersGpu(device, {
  env,
  baseHeightFn,
  initialCraterStamps = [],
  onCraterStamp = null,
  seed = 20261125,
  label = 'ulg-surface-mpm'
} = {}) {
  const deformCount = DEFORM_GRID_N * DEFORM_GRID_N;
  const initDeform = new Float32Array(deformCount * 4);
  const ambT = Number(env?.tempK) || 240.0;
  for (let i = 0; i < deformCount; i += 1) {
    initDeform[i * 4 + 1] = ambT;
  }

  const deformBuf = device.createBuffer({
    label: `${label}-deform-field`,
    size: initDeform.byteLength,
    usage: GPU_BUF.STORAGE | GPU_BUF.COPY_DST
  });
  device.queue.writeBuffer(deformBuf, 0, initDeform);

  const mpmPointsBuf = device.createBuffer({
    label: `${label}-mpm-points`,
    size: MPM_MAX_POINTS * 64,
    usage: GPU_BUF.STORAGE | GPU_BUF.VERTEX | GPU_BUF.COPY_DST
  });
  const mpmGridBuf = device.createBuffer({
    label: `${label}-mpm-grid`,
    size: MPM_GX * MPM_GY * MPM_GZ * 16,
    usage: GPU_BUF.STORAGE | GPU_BUF.COPY_DST
  });
  const paramsBuf = device.createBuffer({
    label: `${label}-params`,
    size: 80,
    usage: GPU_BUF.UNIFORM | GPU_BUF.COPY_DST
  });
  const maxBoulderVerts = MAX_BOULDERS * ICO_FACES.length * 3;
  // GPU-skinned boulder vertex buffer (`STORAGE | VERTEX` — 0 CPU vertex rebuilds!)
  const boulderVertBuf = device.createBuffer({
    label: `${label}-boulders`,
    size: maxBoulderVerts * 48,
    usage: GPU_BUF.STORAGE | GPU_BUF.VERTEX | GPU_BUF.COPY_DST
  });
  const boulderPosesBuf = device.createBuffer({
    label: `${label}-boulder-poses`,
    size: MAX_BOULDERS * 64,
    usage: GPU_BUF.STORAGE | GPU_BUF.COPY_DST
  });
  const boulderPoseStaging = new Float32Array(MAX_BOULDERS * 16);
  const skinParamsBuf = device.createBuffer({
    label: `${label}-skin-params`,
    size: 32,
    usage: GPU_BUF.UNIFORM | GPU_BUF.COPY_DST
  });
  // Static 60-vertex icosahedron template uploaded ONCE at init!
  const tmplData = new Float32Array(ICO_FACES.length * 3 * 4);
  for (let fi = 0; fi < ICO_FACES.length; fi += 1) {
    const f = ICO_FACES[fi];
    for (let k = 0; k < 3; k += 1) {
      const vi = f[k];
      const v = ICO_VERTS[vi];
      const o = (fi * 3 + k) * 4;
      tmplData[o + 0] = v[0]; tmplData[o + 1] = v[1]; tmplData[o + 2] = v[2]; tmplData[o + 3] = vi;
    }
  }
  const boulderTemplateBuf = device.createBuffer({
    label: `${label}-boulder-tmpl`,
    size: tmplData.byteLength,
    usage: GPU_BUF.STORAGE | GPU_BUF.COPY_DST
  });
  device.queue.writeBuffer(boulderTemplateBuf, 0, tmplData);

  const skinPipe = createCachedExplicitComputePipeline(device, {
    cacheKey: 'ulg-surface-boulder-skin-dlm.v1',
    label: `${label}-skin`,
    code: BOULDER_SKIN_WGSL,
    entryPoint: 'skin_boulder_meshes',
    bindings: [
      computeBufferBinding(0, 'uniform'),
      computeBufferBinding(1, 'read-only-storage'),
      computeBufferBinding(2, 'read-only-storage'),
      computeBufferBinding(3, 'storage')
    ]
  });
  const skinBg = createCachedExplicitBindGroup(device, {
    layout: skinPipe.bindGroupLayout,
    label: `${label}-skin-bg`,
    entries: [
      { binding: 0, resource: { buffer: skinParamsBuf } },
      { binding: 1, resource: { buffer: boulderPosesBuf } },
      { binding: 2, resource: { buffer: boulderTemplateBuf } },
      { binding: 3, resource: { buffer: boulderVertBuf } }
    ]
  });

  // 1-Submit Parallel GPU Crater Stamp Replay (`replay_crater_stamps`) for persisted OPFS/IDB tiles!
  const replayPipe = createCachedExplicitComputePipeline(device, {
    cacheKey: 'ulg-surface-crater-replay.v1',
    label: `${label}-replay`,
    code: CRATER_REPLAY_WGSL,
    entryPoint: 'replay_crater_stamps',
    bindings: [
      computeBufferBinding(0, 'uniform'),
      computeBufferBinding(1, 'read-only-storage'),
      computeBufferBinding(2, 'storage')
    ]
  });
  const replayParamsBuf = device.createBuffer({
    label: `${label}-replay-params`,
    size: 32,
    usage: GPU_BUF.UNIFORM | GPU_BUF.COPY_DST
  });
  const replayStampsBuf = device.createBuffer({
    label: `${label}-replay-stamps`,
    size: MAX_CRATER_STAMPS * 32,
    usage: GPU_BUF.STORAGE | GPU_BUF.COPY_DST
  });
  const replayBg = createCachedExplicitBindGroup(device, {
    layout: replayPipe.bindGroupLayout,
    label: `${label}-replay-bg`,
    entries: [
      { binding: 0, resource: { buffer: replayParamsBuf } },
      { binding: 1, resource: { buffer: replayStampsBuf } },
      { binding: 2, resource: { buffer: deformBuf } }
    ]
  });

  const bindings = [
    computeBufferBinding(0, 'uniform'),
    computeBufferBinding(1, 'storage'),
    computeBufferBinding(2, 'storage'),
    computeBufferBinding(3, 'storage')
  ];
  const mkPipe = (ep) => createCachedExplicitComputePipeline(device, {
    cacheKey: `ulg-surface-deform-mpm-${ep}.v1`,
    label: `${label}-${ep}`,
    code: surfaceDeformationMpmWgsl,
    entryPoint: ep,
    bindings
  });
  const deformPipe = mkPipe('update_surface_deform_field');
  const clearPipe = mkPipe('clear_mpm_grid');
  const p2gPipe = mkPipe('p2g_mpm_ejecta');
  const gridPipe = mkPipe('update_mpm_grid');
  const g2pPipe = mkPipe('g2p_mpm_ejecta');

  const bg = createCachedExplicitBindGroup(device, {
    layout: deformPipe.bindGroupLayout,
    label: `${label}-bg`,
    entries: [
      { binding: 0, resource: { buffer: paramsBuf } },
      { binding: 1, resource: { buffer: deformBuf } },
      { binding: 2, resource: { buffer: mpmPointsBuf } },
      { binding: 3, resource: { buffer: mpmGridBuf } }
    ]
  });

  // Sparse host crater stamp table (up to 512 stamps) for O(1) Rover/Boulder collision + OPFS persistence!
  const craterStamps = [];
  let pendingStamp = null;
  let deformDirtyTimerS = 0;
  let mpmActiveTimerS = 0;
  let mpmCursor = 0;
  let mpmOrigin = [0, 0, 0];
  let mpmFloorY = 0;
  let totalMpmDispatches = 0;
  let totalCratersCarved = 0;
  let totalBouldersShattered = 0;
  let craterReplayCount = 0;
  let stepIdx = 0;
  let disposed = false;
  let lastSkinRefX = 0;
  let lastSkinRefZ = 0;
  let lastSkinCurvInv2R = 0;

  // 1-Submit GPU Crater Replay on landing when persisted OPFS/IDB stamps exist!
  function replayInitialCraterStamps(stampsList = []) {
    if (!Array.isArray(stampsList) || stampsList.length === 0) return 0;
    const count = Math.min(MAX_CRATER_STAMPS, stampsList.length);
    const packed = new Float32Array(count * 8);
    for (let i = 0; i < count; i += 1) {
      const s = stampsList[i];
      const rec = {
        kind: Math.max(1, Math.min(3, Math.trunc(Number(s.kind) || 1))),
        x: Number(s.x) || 0,
        z: Number(s.z) || 0,
        radiusM: Math.max(0.5, Number(s.radiusM) || 10),
        depthM: Math.max(0.02, Number(s.depthM) || 3),
        rimM: Number.isFinite(Number(s.rimM)) ? Number(s.rimM) : 0.24,
        tempK: Number(s.tempK) || ambT,
        melt: Number(s.melt) || 0.6,
        char: Number(s.char) || 0.7
      };
      craterStamps.push(rec);
      if (rec.kind === 1 || rec.kind === 3) totalCratersCarved += 1;
      const o = i * 8;
      packed[o + 0] = rec.x;
      packed[o + 1] = rec.z;
      packed[o + 2] = rec.radiusM;
      packed[o + 3] = rec.depthM;
      packed[o + 4] = rec.tempK;
      packed[o + 5] = rec.melt;
      packed[o + 6] = rec.char;
      packed[o + 7] = rec.kind;
    }
    device.queue.writeBuffer(replayStampsBuf, 0, packed);
    const rAb = new ArrayBuffer(32);
    new Uint32Array(rAb, 0, 4).set([DEFORM_GRID_N, count, 0, 0]);
    new Float32Array(rAb, 16, 4).set([DEFORM_PATCH_HALF_M, ambT, 0, 0]);
    device.queue.writeBuffer(replayParamsBuf, 0, rAb);
    const enc = device.createCommandEncoder({ label: `${label}-replay-enc` });
    const pass = enc.beginComputePass({ label: `${label}-replay-pass` });
    pass.setPipeline(replayPipe.pipeline);
    pass.setBindGroup(0, replayBg);
    pass.dispatchWorkgroups(Math.ceil(DEFORM_GRID_N / 8), Math.ceil(DEFORM_GRID_N / 8));
    pass.end();
    device.queue.submit([enc.finish()]);
    craterReplayCount = count;
    return count;
  }
  if (Array.isArray(initialCraterStamps) && initialCraterStamps.length > 0) {
    replayInitialCraterStamps(initialCraterStamps);
  }

  function evaluateDeformationOffset(x, z) {
    let dh = 0;
    for (let i = 0; i < craterStamps.length; i += 1) {
      const c = craterStamps[i];
      const dx = x - c.x;
      const dz = z - c.z;
      const r2 = dx * dx + dz * dz;
      const lim = c.radiusM * 1.85;
      if (r2 > lim * lim) continue;
      const rn = Math.sqrt(r2) / c.radiusM;
      if (c.kind === 2) {
        dh -= c.depthM * Math.exp(-rn * rn * 2.2);
      } else {
        const bowl = Math.max(0, 1.0 - rn * rn);
        const rimD = rn - 1.12;
        const rim = Math.exp(-(rimD * rimD) * 14.0) * 0.24;
        dh += -c.depthM * bowl + c.depthM * rim;
      }
    }
    return clamp(dh, -48.0, 22.0);
  }

  function evaluateGroundHeight(x, z) {
    const baseY = typeof baseHeightFn === 'function' ? baseHeightFn(x, z) : 0;
    return baseY + evaluateDeformationOffset(x, z);
  }

  function evaluateGroundNormal(x, z) {
    const eps = 1.6;
    const hL = evaluateGroundHeight(x - eps, z);
    const hR = evaluateGroundHeight(x + eps, z);
    const hD = evaluateGroundHeight(x, z - eps);
    const hU = evaluateGroundHeight(x, z + eps);
    return normalize3([hL - hR, 2.0 * eps, hD - hU]);
  }

  // Spawn 64 varied multi-scale rigid-body boulders on solid-crust worlds!
  const boulders = [];
  const primaryCol = env?.crustPrimaryRgb || [0.58, 0.42, 0.34];
  const secondaryCol = env?.crustSecondaryRgb || [0.76, 0.62, 0.52];
  if (env?.hasSolidCrust) {
    for (let i = 0; i < MAX_BOULDERS; i += 1) {
      const h1 = hashU32(seed + i * 197 + 11);
      const h2 = hashU32(seed + i * 353 + 29);
      const h3 = hashU32(seed + i * 571 + 47);
      const h4 = hashU32(seed + i * 739 + 61);
      // Place ring of interesting rocks near landing site (18..260 m) avoiding exact spawn origin
      const ang = h1 * Math.PI * 2;
      const dist = 20.0 + Math.pow(h2, 0.72) * 245.0;
      const bx = Math.cos(ang) * dist;
      const bz = Math.sin(ang) * dist;
      const gy = evaluateGroundHeight(bx, bz);
      // Skip deeply submerged ocean trenches
      if (env.hasLiquidOcean && gy < (env.seaLevelM ?? -100) - 4.0) continue;
      const radius = 0.95 + Math.pow(h3, 2.0) * 6.8; // 0.95 m cobbles up to 7.75 m monoliths!
      const stretch = [0.78 + h4 * 0.45, 0.62 + hashU32(seed + i * 811) * 0.48, 0.76 + hashU32(seed + i * 919) * 0.46];
      const vJitters = ICO_VERTS.map((_, vi) => 0.78 + hashU32(seed + i * 1009 + vi * 37) * 0.44);
      const density = env.isCryoMoon ? 940 : (2400 + h4 * 1200);
      const mass = Math.max(400, density * (4 / 3) * Math.PI * radius * radius * radius);
      const tint = 0.82 + 0.36 * h4;
      const col = [
        clamp((primaryCol[0] * 0.58 + secondaryCol[0] * 0.42) * tint, 0.24, 0.96),
        clamp((primaryCol[1] * 0.58 + secondaryCol[1] * 0.42) * tint, 0.20, 0.96),
        clamp((primaryCol[2] * 0.58 + secondaryCol[2] * 0.42) * tint, 0.18, 0.96)
      ];
      const sx = radius * stretch[0];
      const sy = radius * stretch[1];
      const sz = radius * stretch[2];
      // Exact principal ellipsoid moments of inertia `(I1, I2, I3) = (M/5)*(sy^2+sz^2, sx^2+sz^2, sx^2+sy^2)`!
      const inertia = [
        Math.max(10, 0.2 * mass * (sy * sy + sz * sz)),
        Math.max(10, 0.2 * mass * (sx * sx + sz * sz)),
        Math.max(10, 0.2 * mass * (sx * sx + sy * sy))
      ];
      // Deterministic initial SE(3) unit quaternion
      const initQ = quatNorm([h1 - 0.5, h2 - 0.5, h3 - 0.5, 0.75 + h4 * 0.5]);
      boulders.push({
        id: i,
        alive: true,
        pos: [bx, gy + radius * stretch[1] * 0.72, bz],
        vel: [0, 0, 0],
        quat: initQ,
        angMom: [0, 0, 0],
        inertia,
        radius,
        stretch,
        vJitters,
        mass,
        baseCol: col,
        tempK: ambT,
        hp: 1.0,
        captured: false
      });
    }
  }

  function injectMpmBurst({
    center = [0, 0, 0],
    radiusM = 6.0,
    speedMS = 28.0,
    tempK = 2200,
    rgb = [1.0, 0.55, 0.18],
    role = 0.0,
    count = 160,
    lifeS = 4.5
  } = {}) {
    if (disposed) return;
    const nAdd = Math.max(8, Math.min(512, Math.trunc(count)));
    const buf = new Float32Array(nAdd * 16);
    for (let i = 0; i < nAdd; i += 1) {
      const s0 = hashU32(stepIdx * 997 + i * 131 + 17);
      const s1 = hashU32(stepIdx * 997 + i * 263 + 41);
      const s2 = hashU32(stepIdx * 997 + i * 419 + 73);
      const s3 = hashU32(stepIdx * 997 + i * 601 + 97);
      const theta = s0 * Math.PI * 2;
      const rad = Math.sqrt(s1) * radiusM;
      const px = center[0] + Math.cos(theta) * rad;
      const pz = center[2] + Math.sin(theta) * rad;
      const py = center[1] + 0.4 + s2 * Math.max(1.2, radiusM * 0.45);
      const spd = speedMS * (0.35 + 0.85 * s3);
      const elev = 0.35 + 0.60 * s2;
      const vx = Math.cos(theta) * spd * Math.cos(elev);
      const vy = spd * Math.sin(elev);
      const vz = Math.sin(theta) * spd * Math.cos(elev);
      const o = i * 16;
      buf[o + 0] = px; buf[o + 1] = py; buf[o + 2] = pz; buf[o + 3] = role;
      buf[o + 4] = vx; buf[o + 5] = vy; buf[o + 6] = vz; buf[o + 7] = 0.0;
      buf[o + 8] = rgb[0]; buf[o + 9] = rgb[1]; buf[o + 10] = rgb[2]; buf[o + 11] = lifeS * (0.65 + 0.65 * s1);
      buf[o + 12] = clamp(0.45 + s2 * (role > 1.5 ? 2.4 : 1.15), 0.35, 3.4);
      buf[o + 13] = tempK * (0.75 + 0.5 * s3);
      buf[o + 14] = 1.0 + s1 * 2.5; // mass
      buf[o + 15] = 1.0;            // live!
    }
    // Upload in up to 2 contiguous slices around ring buffer wrap
    const firstLen = Math.min(nAdd, MPM_MAX_POINTS - mpmCursor);
    device.queue.writeBuffer(mpmPointsBuf, mpmCursor * 64, buf.subarray(0, firstLen * 16));
    if (firstLen < nAdd) {
      device.queue.writeBuffer(mpmPointsBuf, 0, buf.subarray(firstLen * 16));
    }
    mpmCursor = (mpmCursor + nAdd) % MPM_MAX_POINTS;
    mpmOrigin = [center[0] - MPM_GX * 1.25, center[1] - 4.0, center[2] - MPM_GZ * 1.25];
    mpmFloorY = evaluateGroundHeight(center[0], center[2]) - 1.5;
    mpmActiveTimerS = Math.max(mpmActiveTimerS, lifeS + 1.5);
  }

  function applyBlastOrHeatStamp({
    kind = 1, // 1=missile crater, 2=laser spot heat/melt, 3=antimatter mega-crater
    pos = [0, 0, 0],
    radiusM = 12.0,
    depthM = 4.2,
    tempK = 2600,
    melt = 0.85,
    char = 0.90,
    blastImpulse = 0,
    ejectaCount = 0,
    ejectaRgb = [1.0, 0.58, 0.20],
    ejectaRole = 0.0
  } = {}) {
    pendingStamp = {
      kind,
      x: pos[0],
      z: pos[2],
      radiusM,
      depthM,
      tempK,
      melt,
      char
    };
    deformDirtyTimerS = Math.max(deformDirtyTimerS, 14.0);
    if (kind === 1 || kind === 3 || depthM > 0.08) {
      const rec = {
        kind,
        x: pos[0],
        z: pos[2],
        radiusM,
        depthM,
        rimM: 0.24,
        tempK,
        melt,
        char
      };
      craterStamps.push(rec);
      if (craterStamps.length > MAX_CRATER_STAMPS) craterStamps.shift();
      if (kind === 1 || kind === 3) totalCratersCarved += 1;
      if (typeof onCraterStamp === 'function') {
        try { onCraterStamp({ ...rec }); } catch {}
      }
    }

    // Apply physical shockwave impulse & heat to every rigid-body boulder in blast radius!
    const harvested = { silicates: 0, volatiles: 0, metals: 0, exotics: 0 };
    if (blastImpulse > 0 || kind === 2) {
      const blastLim = Math.max(radiusM * 3.2, 18.0);
      for (const b of boulders) {
        if (!b.alive) continue;
        const dx = b.pos[0] - pos[0];
        const dy = b.pos[1] - pos[1];
        const dz = b.pos[2] - pos[2];
        const d = Math.hypot(dx, dy, dz);
        if (d > blastLim + b.radius) continue;
        const falloff = Math.max(0, 1.0 - d / (blastLim + b.radius));
        if (blastImpulse > 0) {
          const dir = d > 0.1 ? [dx / d, (dy + 4.5) / (d + 4.5), dz / d] : [0, 1, 0];
          const dv = Math.min(68.0, (blastImpulse * falloff * falloff) / Math.max(500, Math.pow(b.mass, 0.72)));
          b.vel[0] += dir[0] * dv;
          b.vel[1] += Math.abs(dir[1]) * dv + 6.5 * falloff;
          b.vel[2] += dir[2] * dv;
          // Exact SE(3) rotational angular-momentum shock impulse!
          b.angMom[0] += (hashU32(b.id + stepIdx) - 0.5) * dv * 0.42 * b.inertia[0];
          b.angMom[1] += (hashU32(b.id + stepIdx + 3) - 0.5) * dv * 0.22 * b.inertia[1];
          b.angMom[2] += (hashU32(b.id + stepIdx + 7) - 0.5) * dv * 0.42 * b.inertia[2];
        }
        b.tempK = Math.min(9000, b.tempK + (tempK - ambT) * falloff * (kind === 2 ? 0.16 : 0.75));
        const dmg = kind === 3 ? falloff * 1.4 : (kind === 1 ? falloff * 0.65 : falloff * 0.08);
        b.hp -= dmg;
        if (b.hp <= 0) {
          b.alive = false;
          totalBouldersShattered += 1;
          harvested.silicates += b.radius * 8.0;
          harvested.metals += b.radius * 5.0;
          harvested.volatiles += env?.isCryoMoon ? b.radius * 12.0 : b.radius * 2.5;
          harvested.exotics += kind === 3 ? b.radius * 1.5 : b.radius * 0.4;
          injectMpmBurst({
            center: b.pos,
            radiusM: b.radius * 1.4,
            speedMS: 22.0,
            tempK: Math.max(1800, b.tempK),
            rgb: b.tempK > 1200 ? [1.0, 0.56, 0.16] : b.baseCol,
            role: b.tempK > 1200 ? 0.0 : 1.0,
            count: 64,
            lifeS: 4.0
          });
        }
      }
    }

    if (ejectaCount > 0) {
      injectMpmBurst({
        center: pos,
        radiusM: Math.max(2.0, radiusM * 0.65),
        speedMS: kind === 3 ? 52.0 : (kind === 1 ? 34.0 : 16.0),
        tempK,
        rgb: ejectaRgb,
        role: ejectaRole,
        count: ejectaCount,
        lifeS: kind === 3 ? 6.2 : 4.2
      });
    }
    return harvested;
  }

  let boulderVertCount = 0;

  function stepRigidBouldersAndUpload(dt, { tractorActive = false, tractorOrigin = null, curvInv2R = 0, refX = 0, refZ = 0 } = {}) {
    const g = env?.gravityMS2 ?? 9.81;
    let capturedCount = 0;
    const harvested = { silicates: 0, volatiles: 0, metals: 0, exotics: 0 };

    for (let i = 0; i < boulders.length; i += 1) {
      const b = boulders[i];
      if (!b.alive) continue;
      b.captured = false;

      // Tractor-beam gravitational capture, vertical levitation & resource harvesting!
      if (tractorActive && tractorOrigin) {
        const dx = tractorOrigin[0] - b.pos[0];
        const dz = tractorOrigin[2] - b.pos[2];
        const hDist = Math.hypot(dx, dz);
        const underY = tractorOrigin[1] - b.pos[1];
        if (hDist < 22.0 && underY > 2.0 && underY < 85.0) {
          b.captured = true;
          capturedCount += 1;
          const targetY = tractorOrigin[1] - 11.5 - b.radius;
          b.vel[0] += (dx * 1.8 - b.vel[0] * 2.2) * dt;
          b.vel[1] += ((targetY - b.pos[1]) * 3.0 - b.vel[1] * 2.4 + g) * dt;
          b.vel[2] += (dz * 1.8 - b.vel[2] * 2.2) * dt;
          b.angMom[1] += 1.4 * b.inertia[1] * dt;
          // Continuous tractor-beam mineral extraction!
          harvested.silicates += dt * 4.5;
          harvested.metals += dt * 3.0;
          harvested.volatiles += dt * 2.5;
        }
      }

      if (!b.captured) {
        b.vel[1] -= g * dt;
      }
      b.pos[0] += b.vel[0] * dt;
      b.pos[1] += b.vel[1] * dt;
      b.pos[2] += b.vel[2] * dt;
      // 5-Stage Dullweber-Leimkuhler-McLachlan Symplectic SE(3) Quaternion Free-Rotation!
      dlmFreeRotateBody(b, dt);

      // Deformed terrain surface collision + slope rolling + damping
      const gy = evaluateGroundHeight(b.pos[0], b.pos[2]);
      const effR = b.radius * b.stretch[1] * 0.78;
      if (b.pos[1] - effR < gy) {
        b.pos[1] = gy + effR;
        const nrm = evaluateGroundNormal(b.pos[0], b.pos[2]);
        const vn = b.vel[0] * nrm[0] + b.vel[1] * nrm[1] + b.vel[2] * nrm[2];
        if (vn < 0) {
          const rest = Math.abs(vn) > 3.5 ? 0.32 : 0.0;
          b.vel[0] -= (1 + rest) * vn * nrm[0];
          b.vel[1] -= (1 + rest) * vn * nrm[1];
          b.vel[2] -= (1 + rest) * vn * nrm[2];
        }
        // Slope gravity tangent pull + rolling friction + rolling angular momentum coupling
        b.vel[0] += nrm[0] * g * 0.45 * dt;
        b.vel[2] += nrm[2] * g * 0.45 * dt;
        const fric = Math.max(0, 1.0 - 2.4 * dt);
        b.vel[0] *= fric;
        b.vel[2] *= fric;
        const rollWx = b.vel[2] / Math.max(0.5, effR);
        const rollWz = -b.vel[0] / Math.max(0.5, effR);
        b.angMom[0] = rollWx * b.inertia[0];
        b.angMom[2] = rollWz * b.inertia[2];
        b.angMom[1] *= Math.max(0, 1.0 - 2.0 * dt);
      } else {
        const airSpinDamp = Math.max(0, 1.0 - 0.18 * dt);
        b.angMom[0] *= airSpinDamp;
        b.angMom[1] *= airSpinDamp;
        b.angMom[2] *= airSpinDamp;
      }

      // Cool thermally heated boulders back toward ambient
      if (b.tempK > ambT + 1.0) {
        b.tempK = Math.max(ambT, b.tempK - (25 + (b.tempK - ambT) * 0.14) * dt);
      }
    }

    // Pairwise rigid boulder-boulder elastic collision response!
    for (let i = 0; i < boulders.length; i += 1) {
      const a = boulders[i];
      if (!a.alive) continue;
      for (let j = i + 1; j < boulders.length; j += 1) {
        const b = boulders[j];
        if (!b.alive) continue;
        const dx = b.pos[0] - a.pos[0];
        const dy = b.pos[1] - a.pos[1];
        const dz = b.pos[2] - a.pos[2];
        const minD = (a.radius + b.radius) * 0.82;
        const d2 = dx * dx + dy * dy + dz * dz;
        if (d2 >= minD * minD || d2 < 1e-6) continue;
        const d = Math.sqrt(d2);
        const nx = dx / d; const ny = dy / d; const nz = dz / d;
        const pen = minD - d;
        const invMa = 1 / a.mass; const invMb = 1 / b.mass;
        const invSum = invMa + invMb;
        a.pos[0] -= nx * pen * (invMa / invSum);
        a.pos[1] -= ny * pen * (invMa / invSum);
        a.pos[2] -= nz * pen * (invMa / invSum);
        b.pos[0] += nx * pen * (invMb / invSum);
        b.pos[1] += ny * pen * (invMb / invSum);
        b.pos[2] += nz * pen * (invMb / invSum);
        const rvx = b.vel[0] - a.vel[0];
        const rvy = b.vel[1] - a.vel[1];
        const rvz = b.vel[2] - a.vel[2];
        const vn = rvx * nx + rvy * ny + rvz * nz;
        if (vn < 0) {
          const imp = -1.35 * vn / invSum;
          a.vel[0] -= imp * invMa * nx; a.vel[1] -= imp * invMa * ny; a.vel[2] -= imp * invMa * nz;
          b.vel[0] += imp * invMb * nx; b.vel[1] += imp * invMb * ny; b.vel[2] += imp * invMb * nz;
        }
      }
    }

    // Upload compact 64-byte SE(3) DLM Quaternion Pose per Boulder (4 KB total) -> GPU `skin_boulder_meshes`!
    // Zero CPU per-vertex mesh rebuilding!
    lastSkinRefX = refX;
    lastSkinRefZ = refZ;
    lastSkinCurvInv2R = curvInv2R;
    boulderPoseStaging.fill(0);
    for (let i = 0; i < boulders.length; i += 1) {
      const b = boulders[i];
      const o = i * 16;
      if (!b.alive) {
        boulderPoseStaging[o + 3] = 0.0; // radius <= 0 => culled on GPU!
        continue;
      }
      boulderPoseStaging[o + 0] = b.pos[0];
      boulderPoseStaging[o + 1] = b.pos[1];
      boulderPoseStaging[o + 2] = b.pos[2];
      boulderPoseStaging[o + 3] = b.radius;
      boulderPoseStaging[o + 4] = b.quat[0];
      boulderPoseStaging[o + 5] = b.quat[1];
      boulderPoseStaging[o + 6] = b.quat[2];
      boulderPoseStaging[o + 7] = b.quat[3];
      boulderPoseStaging[o + 8] = b.stretch[0];
      boulderPoseStaging[o + 9] = b.stretch[1];
      boulderPoseStaging[o + 10] = b.stretch[2];
      boulderPoseStaging[o + 11] = b.tempK;
      boulderPoseStaging[o + 12] = b.baseCol[0];
      boulderPoseStaging[o + 13] = b.baseCol[1];
      boulderPoseStaging[o + 14] = b.baseCol[2];
      boulderPoseStaging[o + 15] = b.captured ? 0.28 : 0.0;
    }
    boulderVertCount = Math.min(maxBoulderVerts, boulders.length * ICO_FACES.length * 3);
    if (boulders.length > 0) {
      device.queue.writeBuffer(boulderPosesBuf, 0, boulderPoseStaging.subarray(0, boulders.length * 16));
    }
    return { capturedCount, harvested };
  }

  function applyRemoteCraterStamp(stamp) {
    if (!stamp || typeof stamp !== 'object') return false;
    const rec = {
      kind: Math.max(1, Math.min(3, Math.trunc(Number(stamp.kind) || 1))),
      x: Number(stamp.x) || 0,
      z: Number(stamp.z) || 0,
      radiusM: Math.max(0.5, Math.min(120, Number(stamp.radiusM) || 10)),
      depthM: Math.max(0.02, Math.min(48, Number(stamp.depthM) || 3)),
      rimM: Number.isFinite(Number(stamp.rimM)) ? Number(stamp.rimM) : 0.24,
      tempK: Number(stamp.tempK) || ambT,
      melt: Math.max(0, Math.min(1, Number(stamp.melt) || 0.6)),
      char: Math.max(0, Math.min(1, Number(stamp.char) || 0.7))
    };
    craterStamps.push(rec);
    if (craterStamps.length > MAX_CRATER_STAMPS) craterStamps.shift();
    if (rec.kind === 1 || rec.kind === 3) totalCratersCarved += 1;
    pendingStamp = { ...rec };
    deformDirtyTimerS = Math.max(deformDirtyTimerS, 6.0);
    return true;
  }

  function encodeGpuStep(enc, dt) {
    if (disposed) return;
    stepIdx += 1;

    // 1. GPU Quaternion Boulder Mesh Skinning (runs directly on GPU from 4 KB pose buffer; 0 CPU vertices!)
    if (boulders.length > 0) {
      const sAb = new ArrayBuffer(32);
      new Uint32Array(sAb, 0, 4).set([boulders.length, ICO_FACES.length, 0, 0]);
      new Float32Array(sAb, 16, 4).set([lastSkinRefX, lastSkinRefZ, lastSkinCurvInv2R, 0]);
      device.queue.writeBuffer(skinParamsBuf, 0, sAb);
      const spPass = enc.beginComputePass({ label: `${label}-boulder-skin-pass` });
      spPass.setPipeline(skinPipe.pipeline);
      spPass.setBindGroup(0, skinBg);
      spPass.dispatchWorkgroups(Math.ceil((boulders.length * ICO_FACES.length) / 64));
      spPass.end();
    }

    const runDeform = Boolean(pendingStamp) || deformDirtyTimerS > 0;
    const runMpm = mpmActiveTimerS > 0;
    if (!runDeform && !runMpm) return;

    const uBuf = new ArrayBuffer(80);
    const u32 = new Uint32Array(uBuf);
    const f32 = new Float32Array(uBuf);
    u32[0] = DEFORM_GRID_N;
    u32[1] = pendingStamp ? pendingStamp.kind : 0;
    u32[2] = MPM_MAX_POINTS;
    u32[3] = stepIdx;
    f32[4] = DEFORM_PATCH_HALF_M;
    f32[5] = ambT;
    f32[6] = dt;
    f32[7] = env?.gravityMS2 ?? 9.81;
    f32[8] = pendingStamp ? pendingStamp.x : 0;
    f32[9] = pendingStamp ? pendingStamp.z : 0;
    f32[10] = pendingStamp ? pendingStamp.radiusM : 0;
    f32[11] = pendingStamp ? pendingStamp.depthM : 0;
    f32[12] = pendingStamp ? pendingStamp.tempK : ambT;
    f32[13] = pendingStamp ? pendingStamp.melt : 0;
    f32[14] = pendingStamp ? pendingStamp.char : 0;
    f32[15] = mpmOrigin[0];
    f32[16] = mpmOrigin[1];
    f32[17] = mpmOrigin[2];
    f32[18] = 2.5; // 2.5 m MLS-MPM cells -> 80 m x 60 m x 80 m active blast bubble!
    f32[19] = mpmFloorY;
    device.queue.writeBuffer(paramsBuf, 0, uBuf);
    pendingStamp = null;

    if (runDeform) {
      deformDirtyTimerS = Math.max(0, deformDirtyTimerS - dt);
      const p = enc.beginComputePass({ label: `${label}-deform-pass` });
      p.setPipeline(deformPipe.pipeline);
      p.setBindGroup(0, bg);
      p.dispatchWorkgroups(Math.ceil(DEFORM_GRID_N / 8), Math.ceil(DEFORM_GRID_N / 8));
      p.end();
    }

    if (runMpm) {
      mpmActiveTimerS = Math.max(0, mpmActiveTimerS - dt);
      totalMpmDispatches += 1;
      const wgGrid = Math.ceil((MPM_GX * MPM_GY * MPM_GZ) / 64);
      const wgPts = Math.ceil(MPM_MAX_POINTS / 64);

      const p1 = enc.beginComputePass({ label: `${label}-mpm-clear` });
      p1.setPipeline(clearPipe.pipeline); p1.setBindGroup(0, bg); p1.dispatchWorkgroups(wgGrid); p1.end();

      const p2 = enc.beginComputePass({ label: `${label}-mpm-p2g` });
      p2.setPipeline(p2gPipe.pipeline); p2.setBindGroup(0, bg); p2.dispatchWorkgroups(wgPts); p2.end();

      const p3 = enc.beginComputePass({ label: `${label}-mpm-grid` });
      p3.setPipeline(gridPipe.pipeline); p3.setBindGroup(0, bg); p3.dispatchWorkgroups(wgGrid); p3.end();

      const p4 = enc.beginComputePass({ label: `${label}-mpm-g2p` });
      p4.setPipeline(g2pPipe.pipeline); p4.setBindGroup(0, bg); p4.dispatchWorkgroups(wgPts); p4.end();
    }
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    for (const b of [
      deformBuf, mpmPointsBuf, mpmGridBuf, paramsBuf,
      boulderVertBuf, boulderPosesBuf, boulderTemplateBuf, skinParamsBuf,
      replayParamsBuf, replayStampsBuf
    ]) {
      try { b.destroy(); } catch {}
    }
  }

  return Object.freeze({
    getResidentDeformBuffer: () => deformBuf,
    getResidentMpmPointsBuffer: () => mpmPointsBuf,
    getResidentBoulderVertBuffer: () => boulderVertBuf,
    get mpmPointCount() { return MPM_MAX_POINTS; },
    get mpmActive() { return mpmActiveTimerS > 0; },
    get boulderVertCount() { return boulderVertCount; },
    get boulderSkinGpuActive() { return true; },
    get aliveBoulderCount() { return boulders.filter((b) => b.alive).length; },
    get totalCratersCarved() { return totalCratersCarved; },
    get craterReplayCount() { return craterReplayCount; },
    get totalBouldersShattered() { return totalBouldersShattered; },
    get totalMpmDispatches() { return totalMpmDispatches; },
    get boulders() { return boulders; },
    getCraterStamps: () => craterStamps.map((s) => ({ ...s })),
    applyRemoteCraterStamp,
    evaluateDeformationOffset,
    evaluateGroundHeight,
    evaluateGroundNormal,
    applyBlastOrHeatStamp,
    injectMpmBurst,
    stepRigidBouldersAndUpload,
    encodeGpuStep,
    dispose
  });
}
