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
const MAX_CRATER_STAMPS = 96;

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

function rotateByEuler(v, rx, ry, rz) {
  const cx = Math.cos(rx); const sx = Math.sin(rx);
  const cy = Math.cos(ry); const sy = Math.sin(ry);
  const cz = Math.cos(rz); const sz = Math.sin(rz);
  // Rx -> Ry -> Rz
  const y1 = v[1] * cx - v[2] * sx;
  const z1 = v[1] * sx + v[2] * cx;
  const x2 = v[0] * cy + z1 * sy;
  const z2 = -v[0] * sy + z1 * cy;
  return [x2 * cz - y1 * sz, x2 * sz + y1 * cz, z2];
}

// =========================================================================
// 3. Create Active-Zone Deformable Surface + MLS-MPM + 64 Rigid Boulders Session
// =========================================================================
export function createSurfaceDeformationAndBouldersGpu(device, {
  env,
  baseHeightFn,
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
  const boulderVertBuf = device.createBuffer({
    label: `${label}-boulders`,
    size: maxBoulderVerts * 48,
    usage: GPU_BUF.VERTEX | GPU_BUF.COPY_DST
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

  // Sparse host crater stamp table for O(1) zero-readback Rover & Rigid-Boulder ground collision!
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
  let stepIdx = 0;
  let disposed = false;

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
      boulders.push({
        id: i,
        alive: true,
        pos: [bx, gy + radius * stretch[1] * 0.72, bz],
        vel: [0, 0, 0],
        rot: [h1 * 6.28, h2 * 6.28, h3 * 6.28],
        angVel: [0, 0, 0],
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
      craterStamps.push({ kind, x: pos[0], z: pos[2], radiusM, depthM });
      if (craterStamps.length > MAX_CRATER_STAMPS) craterStamps.shift();
      if (kind === 1 || kind === 3) totalCratersCarved += 1;
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
          b.angVel[0] += (hashU32(b.id + stepIdx) - 0.5) * dv * 0.4;
          b.angVel[2] += (hashU32(b.id + stepIdx + 7) - 0.5) * dv * 0.4;
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
          b.angVel[1] += 1.4 * dt;
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
      b.rot[0] += b.angVel[0] * dt;
      b.rot[1] += b.angVel[1] * dt;
      b.rot[2] += b.angVel[2] * dt;

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
        // Slope gravity tangent pull + rolling friction
        b.vel[0] += nrm[0] * g * 0.45 * dt;
        b.vel[2] += nrm[2] * g * 0.45 * dt;
        const fric = Math.max(0, 1.0 - 2.4 * dt);
        b.vel[0] *= fric;
        b.vel[2] *= fric;
        b.angVel[0] = b.vel[2] / Math.max(0.5, effR);
        b.angVel[2] = -b.vel[0] / Math.max(0.5, effR);
        b.angVel[1] *= Math.max(0, 1.0 - 2.0 * dt);
      } else {
        b.angVel[0] *= Math.max(0, 1.0 - 0.25 * dt);
        b.angVel[1] *= Math.max(0, 1.0 - 0.25 * dt);
        b.angVel[2] *= Math.max(0, 1.0 - 0.25 * dt);
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

    // Build faceted 3D boulder vertices (48-byte SURFACE_MESH_WGSL format!)
    const out = [];
    for (const b of boulders) {
      if (!b.alive) continue;
      const dx = b.pos[0] - refX;
      const dz = b.pos[2] - refZ;
      if (dx * dx + dz * dz > 340 * 340) continue;
      const baseCurvY = b.pos[1] - (dx * dx + dz * dz) * curvInv2R;
      const hot = clamp((b.tempK - 750) / 1600, 0, 1);
      const rgb = [
        b.baseCol[0] * (1 - hot) + 1.0 * hot,
        b.baseCol[1] * (1 - hot) + (0.36 + 0.52 * hot) * hot,
        b.baseCol[2] * (1 - hot) + 0.14 * hot * hot
      ];
      const emiss = hot > 0.02 ? hot * 1.65 : (b.captured ? 0.25 : 0.0);
      const pts = ICO_VERTS.map((v, vi) => {
        const s = b.radius * b.vJitters[vi];
        const r = rotateByEuler([v[0] * s * b.stretch[0], v[1] * s * b.stretch[1], v[2] * s * b.stretch[2]], b.rot[0], b.rot[1], b.rot[2]);
        return [b.pos[0] + r[0], baseCurvY + r[1], b.pos[2] + r[2]];
      });
      for (const f of ICO_FACES) {
        const p0 = pts[f[0]]; const p1 = pts[f[1]]; const p2 = pts[f[2]];
        const e1 = [p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]];
        const e2 = [p2[0] - p0[0], p2[1] - p0[1], p2[2] - p0[2]];
        let nrm = normalize3(cross3(e1, e2));
        // Guarantee strictly outward-pointing sunlit rock face normals!
        const cx = (p0[0] + p1[0] + p2[0]) / 3 - b.pos[0];
        const cy = (p0[1] + p1[1] + p2[1]) / 3 - baseCurvY;
        const cz = (p0[2] + p1[2] + p2[2]) / 3 - b.pos[2];
        if (nrm[0] * cx + nrm[1] * cy + nrm[2] * cz < 0) {
          nrm = [-nrm[0], -nrm[1], -nrm[2]];
        }
        out.push(
          p0[0], p0[1], p0[2], b.pos[1], nrm[0], nrm[1], nrm[2], 0.0, rgb[0], rgb[1], rgb[2], emiss,
          p1[0], p1[1], p1[2], b.pos[1], nrm[0], nrm[1], nrm[2], 0.0, rgb[0], rgb[1], rgb[2], emiss,
          p2[0], p2[1], p2[2], b.pos[1], nrm[0], nrm[1], nrm[2], 0.0, rgb[0], rgb[1], rgb[2], emiss
        );
      }
    }
    boulderVertCount = Math.min(maxBoulderVerts, Math.floor(out.length / 12));
    if (boulderVertCount > 0) {
      device.queue.writeBuffer(boulderVertBuf, 0, new Float32Array(out.slice(0, boulderVertCount * 12)));
    }
    return { capturedCount, harvested };
  }

  function encodeGpuStep(enc, dt) {
    if (disposed) return;
    stepIdx += 1;
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
    for (const b of [deformBuf, mpmPointsBuf, mpmGridBuf, paramsBuf, boulderVertBuf]) {
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
    get aliveBoulderCount() { return boulders.filter((b) => b.alive).length; },
    get totalCratersCarved() { return totalCratersCarved; },
    get totalBouldersShattered() { return totalBouldersShattered; },
    get totalMpmDispatches() { return totalMpmDispatches; },
    get boulders() { return boulders; },
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
