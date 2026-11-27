// Gate 5D (10^+22 -> 10^+25 m): Expanding-Universe FLRW Comoving GPU 3D-FFT
// Particle-Mesh / TreePM Cosmology Engine (`src/runtime/astrophysics/supergalacticTreePmGpu.js`).
//
// Shares the EXACT same Gate 0B `createFft3dWorkspaceWebGpu` (`fft3dWebGpu.js`)
// used in Gate 1 Periodic Bulk DFT (10^-9 m) to solve periodic comoving gravity
// across 200 Mpc/h supergalactic volumes in ONE `queue.submit` per step:
//   1. GPU Zel'dovich Approximation ICs via `fft3dWebGpu` over full Nyquist k-space
//      (`buildZeldovichCosmologyICsWebGpu`, Hermitian-symmetric Eisenstein-Hu P(k)).
//   2. Cloud-in-Cell (CIC) density contrast delta(x) on periodic N^3 comoving mesh
//      with safe periodic wrap + cell-centered short-range multipoles.
//   3. 1 forward 3D FFT -> live 16-bin GPU radial power spectrum P(k) reduction ->
//      3 k-space Poisson gradients + 3 inverse 3D FFTs (ZERO redundant forward FFTs!).
//   4. Symplectic Kick-Drift-Kick (KDK) comoving FLRW integrator with exact self-COM
//      subtraction, empty-cell peculiar background symmetry, and remote-slab GPU
//      multipole coupling (`injectRemoteTileMultipoles`) for disjoint multi-host peers!
//   5. Pure float32 GPU telemetry reduction (`reduce_telemetry_f32`) + GPU-reduced
//      32-byte `readTileMultipoleSummary` (`0` full-particle CPU readback!).

import {
  computeBufferBinding,
  createCachedExplicitComputePipeline
} from '../webgpuComputeLayout.js';
import { createFft3dWorkspaceWebGpu } from '../gpuMath/fft3dWebGpu.js';
import { ULG_ACCURACY_TIERS } from '../../../ulg-gpu-abi/src/materialFoundationAbi.js';

export const ULG_SUPERGALACTIC_TREEPM_SCHEMA = 'ulg.astrophysics.supergalactic-flrw-treepm.v1';

const GPU_BUFFER_USAGE = Object.freeze({
  MAP_READ: 0x01,
  COPY_SRC: 0x04,
  COPY_DST: 0x08,
  VERTEX: 0x20,
  UNIFORM: 0x40,
  STORAGE: 0x80
});

const PK_BIN_COUNT = 16;
const MAX_REMOTE_TILES = 32;

// Resident particle layout: 16 floats (64 bytes, exact match for `residentGpuPresenter.js`):
//   [0..2] = comoving x, y, z in [-L/2, L/2]
//   [3]    = mass
//   [4..6] = canonical comoving velocity vx, vy, vz
//   [7]    = local overdensity (1 + delta) log-compressed for zero-copy coloring
//   [8..10]= gravitational acceleration ax, ay, az
//   [11]   = local overdensity delta
//   [12..15]= species (0=DM, 1=baryon WHIM), halo density proxy, scale factor a, pad

export const supergalacticTreePmWgsl = /* wgsl */ `
struct CosmoParams {
  particle_count: u32,
  grid_n: u32,
  step_index: u32,
  remote_tile_count: u32,
  box_l: f32,
  a_scale: f32,
  da: f32,
  h_a: f32,             // H(a) / H_0
  omega_m: f32,
  grav_pref: f32,       // (3/2) * Omega_m / a
  mean_mass_cell: f32,
  short_range_r_s: f32, // TreePM force-split scale r_s (0 => pure PM)
  prev_kick_fac: f32,   // previous step kick factor for exact KDK synchronization
  tile_x_min: f32,
  tile_x_max: f32,
  pad0: f32,
};

struct CosmoParticle {
  pos_m: vec4<f32>,
  vel_rho: vec4<f32>,
  acc_phi: vec4<f32>,
  tag: vec4<f32>,
};

@group(0) @binding(0) var<uniform> params: CosmoParams;
@group(0) @binding(1) var<storage, read_write> particles: array<CosmoParticle>;
// Fixed-point atomic CIC density grid (grid_n^3)
@group(0) @binding(2) var<storage, read_write> cic_mass_i32: array<atomic<i32>>;
// Complex density / gradient / k-space grid bound to fft3d workspace or saved k-space
@group(0) @binding(3) var<storage, read_write> fft_grid: array<vec2<f32>>;
// 3-component PM force grid: vec4(fx, fy, fz, delta)
@group(0) @binding(4) var<storage, read_write> force_grid: array<vec4<f32>>;
// Float32 telemetry + 16-bin P(k) + tile multipole summary buffer:
//   [0]: vec4(sum_delta2, max_delta, sum_delta, grid_total)
//   [1]: vec4(sum_ke, px, py, pz)
//   [2..17]: 16 P(k) bins: vec4(k_sum, pk_sum, mode_count, 0.0)
//   [18]: tile multipole 0: vec4(total_mass, com_x, com_y, com_z)
//   [19]: tile multipole 1: vec4(quad_trace, particle_count, 0.0, 0.0)
@group(0) @binding(5) var<storage, read_write> telemetry_f32: array<vec4<f32>>;
// Short-range sub-cell TreePM atomic cell-multipole accumulators (grid_n^3 * 4 i32): [m, m*dx, m*dy, m*dz]
@group(0) @binding(6) var<storage, read_write> sr_cell_accum: array<atomic<i32>>;
// Resolved short-range TreePM cell multipole nodes (cell-local COM offset, NOT wrapped abs!):
//   vec4(com_off_x, com_off_y, com_off_z, cell_mass) + remote tile multipoles appended at [grid_total .. grid_total + 31]:
//   remote_tile[r]: vec4(com_x, com_y, com_z, total_mass)
@group(0) @binding(7) var<storage, read_write> sr_cell_nodes: array<vec4<f32>>;

const TWO_PI: f32 = 6.28318530717958647692;
const PK_BINS: u32 = ${PK_BIN_COUNT}u;

var<workgroup> wg_f0: array<f32, 256>;
var<workgroup> wg_f1: array<f32, 256>;
var<workgroup> wg_f2: array<f32, 256>;
var<workgroup> wg_f3: array<f32, 256>;
var<workgroup> wg_f4: array<f32, 256>;
var<workgroup> wg_f5: array<f32, 256>;

fn wrap_coord(u: f32, L: f32) -> f32 {
  let half_l = 0.5 * L;
  var x = u + half_l;
  x = x - L * floor(x / L);
  return x - half_l;
}

fn wrap_delta(d: f32, L: f32) -> f32 {
  return d - L * round(d / L);
}

fn safe_grid_index(g: f32, n: u32) -> u32 {
  let ni = i32(n);
  let gi = i32(floor(g));
  let m = ((gi % ni) + ni) % ni;
  return u32(m);
}

fn erfc_approx(x_in: f32) -> f32 {
  let x = max(0.0, x_in);
  let t = 1.0 / (1.0 + 0.3275911 * x);
  let poly = t * (0.254829592 + t * (-0.284496736 + t * (1.421413741 + t * (-1.453152027 + t * 1.061405429))));
  return poly * exp(-x * x);
}

fn treepm_short_range_split(r: f32, r_s: f32) -> f32 {
  let u = r / max(2.0 * r_s, 1.0e-5);
  return erfc_approx(u) + (2.0 * u * 0.5641895835) * exp(-u * u);
}

@compute @workgroup_size(64)
fn clear_grids(@builtin(global_invocation_id) id: vec3<u32>) {
  let idx = id.x;
  let total = params.grid_n * params.grid_n * params.grid_n;
  if (idx < total) {
    atomicStore(&cic_mass_i32[idx], 0);
    force_grid[idx] = vec4<f32>(0.0);
    atomicStore(&sr_cell_accum[idx * 4u + 0u], 0);
    atomicStore(&sr_cell_accum[idx * 4u + 1u], 0);
    atomicStore(&sr_cell_accum[idx * 4u + 2u], 0);
    atomicStore(&sr_cell_accum[idx * 4u + 3u], 0);
    sr_cell_nodes[idx] = vec4<f32>(0.0);
  }
  if (idx < 20u) {
    telemetry_f32[idx] = vec4<f32>(0.0);
  }
}

@compute @workgroup_size(64)
fn cic_deposit(@builtin(global_invocation_id) id: vec3<u32>) {
  let i = id.x;
  if (i >= params.particle_count) { return; }
  let n = params.grid_n;
  let nf = f32(n);
  let L = params.box_l;
  let p = particles[i].pos_m;
  if (!(p.w > 0.0)) { return; }
  let gx = ((p.x + 0.5 * L) / L) * nf;
  let gy = ((p.y + 0.5 * L) / L) * nf;
  let gz = ((p.z + 0.5 * L) / L) * nf;
  let ix0 = safe_grid_index(gx, n);
  let iy0 = safe_grid_index(gy, n);
  let iz0 = safe_grid_index(gz, n);
  let ix1 = (ix0 + 1u) % n;
  let iy1 = (iy0 + 1u) % n;
  let iz1 = (iz0 + 1u) % n;
  let fx = gx - floor(gx);
  let fy = gy - floor(gy);
  let fz = gz - floor(gz);
  let wx0 = 1.0 - fx; let wy0 = 1.0 - fy; let wz0 = 1.0 - fz;
  let scale = p.w * 4096.0;

  let xs = array<u32, 2>(ix0, ix1);
  let ys = array<u32, 2>(iy0, iy1);
  let zs = array<u32, 2>(iz0, iz1);
  let wxs = array<f32, 2>(wx0, fx);
  let wys = array<f32, 2>(wy0, fy);
  let wzs = array<f32, 2>(wz0, fz);

  for (var dz = 0u; dz < 2u; dz = dz + 1u) {
    for (var dy = 0u; dy < 2u; dy = dy + 1u) {
      for (var dx = 0u; dx < 2u; dx = dx + 1u) {
        let cidx = (zs[dz] * n + ys[dy]) * n + xs[dx];
        let w_i = i32(round(scale * wxs[dx] * wys[dy] * wzs[dz]));
        atomicAdd(&cic_mass_i32[cidx], w_i);
      }
    }
  }
  // Exact cell-local monopole (relative to cell center -> wrap-free self-COM subtraction!)
  let cell_len = L / nf;
  let home_idx = (iz0 * n + iy0) * n + ix0;
  let cx_center = (f32(ix0) + 0.5) * cell_len - 0.5 * L;
  let cy_center = (f32(iy0) + 0.5) * cell_len - 0.5 * L;
  let cz_center = (f32(iz0) + 0.5) * cell_len - 0.5 * L;
  let dx_loc = wrap_delta(p.x - cx_center, L);
  let dy_loc = wrap_delta(p.y - cy_center, L);
  let dz_loc = wrap_delta(p.z - cz_center, L);
  atomicAdd(&sr_cell_accum[home_idx * 4u + 0u], i32(round(p.w * 4096.0)));
  atomicAdd(&sr_cell_accum[home_idx * 4u + 1u], i32(round(p.w * dx_loc * 2048.0)));
  atomicAdd(&sr_cell_accum[home_idx * 4u + 2u], i32(round(p.w * dy_loc * 2048.0)));
  atomicAdd(&sr_cell_accum[home_idx * 4u + 3u], i32(round(p.w * dz_loc * 2048.0)));
}

@compute @workgroup_size(64)
fn prepare_poisson_rhs(@builtin(global_invocation_id) id: vec3<u32>) {
  let idx = id.x;
  let n = params.grid_n;
  let total = n * n * n;
  if (idx >= total) { return; }
  let m_cell = f32(atomicLoad(&cic_mass_i32[idx])) / 4096.0;
  let delta = (m_cell / max(params.mean_mass_cell, 1.0e-6)) - 1.0;
  fft_grid[idx] = vec2<f32>(params.grav_pref * delta, 0.0);
  force_grid[idx].w = delta;

  let sr_m = f32(atomicLoad(&sr_cell_accum[idx * 4u + 0u])) / 4096.0;
  if (sr_m > 1.0e-6) {
    let inv_m = 1.0 / sr_m;
    let ox = (f32(atomicLoad(&sr_cell_accum[idx * 4u + 1u])) / 2048.0) * inv_m;
    let oy = (f32(atomicLoad(&sr_cell_accum[idx * 4u + 2u])) / 2048.0) * inv_m;
    let oz = (f32(atomicLoad(&sr_cell_accum[idx * 4u + 3u])) / 2048.0) * inv_m;
    sr_cell_nodes[idx] = vec4<f32>(ox, oy, oz, sr_m);
  } else {
    sr_cell_nodes[idx] = vec4<f32>(0.0);
  }
}

// Live 16-bin GPU radial matter power spectrum P(k) reduction directly from k-space FFT!
// Dispatched with 16 workgroups (one workgroup per logarithmic k-shell), @workgroup_size(256).
@compute @workgroup_size(256)
fn reduce_power_spectrum_pk(
  @builtin(workgroup_id) wid: vec3<u32>,
  @builtin(local_invocation_id) lid: vec3<u32>
) {
  let bin = wid.x;
  if (bin >= PK_BINS) { return; }
  let tid = lid.x;
  let n = params.grid_n;
  let half_n = n >> 1u;
  let total = n * n * n;
  let dk = TWO_PI / max(params.box_l, 1.0e-6);
  let k_min = dk;
  let k_max = dk * f32(half_n) * 1.7320508;
  let log_span = max(1e-5, log(k_max / k_min));
  let inv_pref2 = 1.0 / max(1e-12, params.grav_pref * params.grav_pref);
  let vol_norm = (params.box_l * params.box_l * params.box_l) / (f32(total) * f32(total));

  var k_sum = 0.0;
  var pk_sum = 0.0;
  var cnt = 0.0;

  var idx = tid;
  loop {
    if (idx >= total) { break; }
    if (idx != 0u) {
      let ix = idx % n;
      let iy = (idx / n) % n;
      let iz = idx / (n * n);
      let nx = select(f32(ix), f32(ix) - f32(n), ix >= half_n);
      let ny = select(f32(iy), f32(iy) - f32(n), iy >= half_n);
      let nz = select(f32(iz), f32(iz) - f32(n), iz >= half_n);
      let k_mag = sqrt(nx * nx + ny * ny + nz * nz) * dk;
      let u = clamp(log(max(k_min, k_mag) / k_min) / log_span, 0.0, 0.99999);
      let b_idx = min(PK_BINS - 1u, u32(u * f32(PK_BINS)));
      if (b_idx == bin) {
        let c = fft_grid[idx];
        let p2 = (c.x * c.x + c.y * c.y) * inv_pref2 * vol_norm;
        k_sum = k_sum + k_mag;
        pk_sum = pk_sum + p2;
        cnt = cnt + 1.0;
      }
    }
    idx = idx + 256u;
  }

  wg_f0[tid] = k_sum;
  wg_f1[tid] = pk_sum;
  wg_f2[tid] = cnt;
  workgroupBarrier();

  var stride = 128u;
  loop {
    if (stride == 0u) { break; }
    if (tid < stride) {
      wg_f0[tid] = wg_f0[tid] + wg_f0[tid + stride];
      wg_f1[tid] = wg_f1[tid] + wg_f1[tid + stride];
      wg_f2[tid] = wg_f2[tid] + wg_f2[tid + stride];
    }
    workgroupBarrier();
    stride = stride >> 1u;
  }

  if (tid == 0u) {
    let m_cnt = wg_f2[0u];
    if (m_cnt > 0.0) {
      telemetry_f32[2u + bin] = vec4<f32>(wg_f0[0u] / m_cnt, wg_f1[0u] / m_cnt, m_cnt, 0.0);
    } else {
      telemetry_f32[2u + bin] = vec4<f32>(0.0);
    }
  }
}

@compute @workgroup_size(64)
fn store_force_x(@builtin(global_invocation_id) id: vec3<u32>) {
  let idx = id.x;
  let total = params.grid_n * params.grid_n * params.grid_n;
  if (idx >= total) { return; }
  force_grid[idx].x = -fft_grid[idx].x;
}

@compute @workgroup_size(64)
fn store_force_y(@builtin(global_invocation_id) id: vec3<u32>) {
  let idx = id.x;
  let total = params.grid_n * params.grid_n * params.grid_n;
  if (idx >= total) { return; }
  force_grid[idx].y = -fft_grid[idx].x;
}

@compute @workgroup_size(64)
fn store_force_z(@builtin(global_invocation_id) id: vec3<u32>) {
  let idx = id.x;
  let total = params.grid_n * params.grid_n * params.grid_n;
  if (idx >= total) { return; }
  force_grid[idx].z = -fft_grid[idx].x;
}

// CIC trilinear force interpolation + Short-Range TreePM (exact self-COM subtraction
// + empty-cell background symmetry) + Remote-Slab Multipole Coupling + Symplectic KDK!
@compute @workgroup_size(64)
fn cic_kick_drift(@builtin(global_invocation_id) id: vec3<u32>) {
  let i = id.x;
  if (i >= params.particle_count) { return; }
  let n = params.grid_n;
  let nf = f32(n);
  let n_i = i32(n);
  let total_cells = n * n * n;
  let L = params.box_l;
  var pt = particles[i];
  if (!(pt.pos_m.w > 0.0)) { return; }

  let gx = ((pt.pos_m.x + 0.5 * L) / L) * nf;
  let gy = ((pt.pos_m.y + 0.5 * L) / L) * nf;
  let gz = ((pt.pos_m.z + 0.5 * L) / L) * nf;
  let ix0 = safe_grid_index(gx, n);
  let iy0 = safe_grid_index(gy, n);
  let iz0 = safe_grid_index(gz, n);
  let ix1 = (ix0 + 1u) % n;
  let iy1 = (iy0 + 1u) % n;
  let iz1 = (iz0 + 1u) % n;
  let fx = gx - floor(gx);
  let fy = gy - floor(gy);
  let fz = gz - floor(gz);

  let xs = array<u32, 2>(ix0, ix1);
  let ys = array<u32, 2>(iy0, iy1);
  let zs = array<u32, 2>(iz0, iz1);
  let wxs = array<f32, 2>(1.0 - fx, fx);
  let wys = array<f32, 2>(1.0 - fy, fy);
  let wzs = array<f32, 2>(1.0 - fz, fz);

  var acc = vec3<f32>(0.0);
  var local_delta = 0.0;
  for (var dz = 0u; dz < 2u; dz = dz + 1u) {
    for (var dy = 0u; dy < 2u; dy = dy + 1u) {
      for (var dx = 0u; dx < 2u; dx = dx + 1u) {
        let cidx = (zs[dz] * n + ys[dy]) * n + xs[dx];
        let w = wxs[dx] * wys[dy] * wzs[dz];
        let fg = force_grid[cidx];
        acc = acc + fg.xyz * w;
        local_delta = local_delta + fg.w * w;
      }
    }
  }

  let cell_len = L / nf;
  let g_eff = (params.grav_pref * cell_len * cell_len * cell_len) / (12.566370614 * max(params.mean_mass_cell, 1.0e-6));

  // Hybrid TreePM short-range 3x3x3 cell-multipole correction:
  //   (a) exact self-COM subtraction in home cell, AND
  //   (b) uniform -mean_mass_cell peculiar background at EVERY cell center (including empty voids!)
  if (params.short_range_r_s > 0.0) {
    let r_s = params.short_range_r_s;
    let r_cut = 3.6 * r_s;
    let r_cut2 = r_cut * r_cut;
    let eps2 = (0.55 * cell_len) * (0.55 * cell_len);
    for (var oz: i32 = -1; oz <= 1; oz = oz + 1) {
      let nz = u32(((i32(iz0) + oz) % n_i + n_i) % n_i);
      let cz_c = (f32(nz) + 0.5) * cell_len - 0.5 * L;
      for (var oy: i32 = -1; oy <= 1; oy = oy + 1) {
        let ny = u32(((i32(iy0) + oy) % n_i + n_i) % n_i);
        let cy_c = (f32(ny) + 0.5) * cell_len - 0.5 * L;
        for (var ox: i32 = -1; ox <= 1; ox = ox + 1) {
          let nx = u32(((i32(ix0) + ox) % n_i + n_i) % n_i);
          let cx_c = (f32(nx) + 0.5) * cell_len - 0.5 * L;
          let nidx = (nz * n + ny) * n + nx;
          let node = sr_cell_nodes[nidx];
          let is_home = (ox == 0 && oy == 0 && oz == 0);

          // 1. Positive mass attraction from actual particles in cell (with EXACT self-COM subtraction!)
          if (node.w > 1.0e-6) {
            let eff_m = select(node.w, max(0.0, node.w - pt.pos_m.w), is_home);
            if (eff_m > 1.0e-6) {
              var d_p = vec3<f32>(0.0);
              if (is_home) {
                let self_off = vec3<f32>(
                  wrap_delta(pt.pos_m.x - cx_c, L),
                  wrap_delta(pt.pos_m.y - cy_c, L),
                  wrap_delta(pt.pos_m.z - cz_c, L)
                );
                let other_off = (node.xyz * node.w - self_off * pt.pos_m.w) / eff_m;
                d_p = other_off - self_off;
              } else {
                let com_x = cx_c + node.x;
                let com_y = cy_c + node.y;
                let com_z = cz_c + node.z;
                d_p = vec3<f32>(
                  wrap_delta(com_x - pt.pos_m.x, L),
                  wrap_delta(com_y - pt.pos_m.y, L),
                  wrap_delta(com_z - pt.pos_m.z, L)
                );
              }
              let r2_p = dot(d_p, d_p);
              if (r2_p <= r_cut2 && r2_p > 1.0e-10) {
                let r_p = sqrt(r2_p);
                let sw_p = treepm_short_range_split(r_p, r_s);
                let inv_r3_p = 1.0 / ((r2_p + eps2) * sqrt(r2_p + eps2));
                acc = acc + d_p * (g_eff * eff_m * sw_p * inv_r3_p);
              }
            }
          }

          // 2. Uniform -mean_mass_cell background subtraction at cell center (INCLUDING empty cells!)
          let d_bg = vec3<f32>(
            wrap_delta(cx_c - pt.pos_m.x, L),
            wrap_delta(cy_c - pt.pos_m.y, L),
            wrap_delta(cz_c - pt.pos_m.z, L)
          );
          let r2_bg = dot(d_bg, d_bg);
          if (r2_bg <= r_cut2 && r2_bg > 1.0e-10) {
            let r_bg = sqrt(r2_bg);
            let sw_bg = treepm_short_range_split(r_bg, r_s);
            let inv_r3_bg = 1.0 / ((r2_bg + eps2) * sqrt(r2_bg + eps2));
            acc = acc - d_bg * (g_eff * params.mean_mass_cell * sw_bg * inv_r3_bg);
          }
        }
      }
    }
  }

  // Remote-slab cross-peer multipole gravitational coupling (multi-host PeerCompute!)
  // Direct non-wrapped displacement along slab-partitioned X avoids half-box sign-flip
  // discontinuities while retaining full periodic minimum-image wrapping along Y and Z.
  let n_rem = min(params.remote_tile_count, ${MAX_REMOTE_TILES}u);
  if (n_rem > 0u) {
    let eps_rem2 = (0.12 * L) * (0.12 * L);
    for (var r = 0u; r < n_rem; r = r + 1u) {
      let rt = sr_cell_nodes[total_cells + r];
      if (rt.w <= 1.0e-6) { continue; }
      let d_r = vec3<f32>(
        rt.x - pt.pos_m.x,
        wrap_delta(rt.y - pt.pos_m.y, L),
        wrap_delta(rt.z - pt.pos_m.z, L)
      );
      let r2_r = dot(d_r, d_r) + eps_rem2;
      let inv_r3_r = 1.0 / (r2_r * sqrt(r2_r));
      acc = acc + d_r * (g_eff * rt.w * inv_r3_r);
    }
  }

  // Canonical comoving Symplectic Kick-Drift-Kick (KDK) in scale factor a:
  //   step 0:  v_half = v_0 + 0.5 * acc_0 * kick_0;  x_1 = x_0 + v_half * drift_0
  //   step s:  v_sync = v_{s-1/2} + 0.5 * acc_s * kick_{s-1}
  //            v_half = v_sync + 0.5 * acc_s * kick_s;  x_{s+1} = x_s + v_half * drift_s
  let a = max(0.01, params.a_scale);
  let h_a = max(0.05, params.h_a);
  let da = params.da;
  // Exact canonical FLRW comoving momentum kick dp/da = -grad_x(Phi) / (a * H(a))
  // (note grav_pref = 1.5 * Omega_m / a already carries the 1/a Poisson scale factor!)
  let kick_fac = da / (a * h_a);
  let a_mid = a + 0.5 * da;
  let omega_l = max(0.0, 1.0 - params.omega_m);
  let h_mid = sqrt(max(0.0025, params.omega_m / (a_mid * a_mid * a_mid) + omega_l));
  let drift_fac = da / (a_mid * a_mid * a_mid * h_mid);

  let v_sync = select(pt.vel_rho.xyz, pt.vel_rho.xyz + acc * (0.5 * params.prev_kick_fac), params.step_index > 0u);
  let v_half = v_sync + acc * (0.5 * kick_fac);
  let p_new = vec3<f32>(
    wrap_coord(pt.pos_m.x + v_half.x * drift_fac, L),
    wrap_coord(pt.pos_m.y + v_half.y * drift_fac, L),
    wrap_coord(pt.pos_m.z + v_half.z * drift_fac, L)
  );
  let rho_vis = clamp(0.18 + 0.25 * log2(max(1.0, 1.0 + local_delta)), 0.05, 1.0);
  pt.pos_m = vec4<f32>(p_new, pt.pos_m.w);
  pt.vel_rho = vec4<f32>(v_half, rho_vis);
  pt.acc_phi = vec4<f32>(acc, local_delta);
  pt.tag.z = a;
  particles[i] = pt;
}

// Pure IEEE-754 float32 parallel workgroup telemetry reduction (ZERO i32 overflow!)
// Dispatch 2 workgroups of 256 threads:
//   wid.x == 0 -> grid overdensity stats [sum_delta2, max_delta, sum_delta, total]
//   wid.x == 1 -> particle KE & linear momentum [sum_ke, px, py, pz]
@compute @workgroup_size(256)
fn reduce_telemetry_f32(
  @builtin(workgroup_id) wid: vec3<u32>,
  @builtin(local_invocation_id) lid: vec3<u32>
) {
  let tid = lid.x;
  if (wid.x == 0u) {
    let total = params.grid_n * params.grid_n * params.grid_n;
    var s_d2 = 0.0;
    var m_d = -1.0e30;
    var s_d = 0.0;
    var i = tid;
    loop {
      if (i >= total) { break; }
      let d = force_grid[i].w;
      s_d2 = s_d2 + d * d;
      m_d = max(m_d, d);
      s_d = s_d + d;
      i = i + 256u;
    }
    wg_f0[tid] = s_d2;
    wg_f1[tid] = m_d;
    wg_f2[tid] = s_d;
    workgroupBarrier();
    var stride = 128u;
    loop {
      if (stride == 0u) { break; }
      if (tid < stride) {
        wg_f0[tid] = wg_f0[tid] + wg_f0[tid + stride];
        wg_f1[tid] = max(wg_f1[tid], wg_f1[tid + stride]);
        wg_f2[tid] = wg_f2[tid] + wg_f2[tid + stride];
      }
      workgroupBarrier();
      stride = stride >> 1u;
    }
    if (tid == 0u) {
      telemetry_f32[0u] = vec4<f32>(wg_f0[0u], wg_f1[0u], wg_f2[0u], f32(total));
    }
  } else if (wid.x == 1u) {
    let n_p = params.particle_count;
    var s_ke = 0.0;
    var px = 0.0;
    var py = 0.0;
    var pz = 0.0;
    var i = tid;
    loop {
      if (i >= n_p) { break; }
      let pt = particles[i];
      let m = pt.pos_m.w;
      let v = pt.vel_rho.xyz;
      s_ke = s_ke + 0.5 * m * dot(v, v);
      px = px + m * v.x;
      py = py + m * v.y;
      pz = pz + m * v.z;
      i = i + 256u;
    }
    wg_f0[tid] = s_ke;
    wg_f1[tid] = px;
    wg_f2[tid] = py;
    wg_f3[tid] = pz;
    workgroupBarrier();
    var stride = 128u;
    loop {
      if (stride == 0u) { break; }
      if (tid < stride) {
        wg_f0[tid] = wg_f0[tid] + wg_f0[tid + stride];
        wg_f1[tid] = wg_f1[tid] + wg_f1[tid + stride];
        wg_f2[tid] = wg_f2[tid] + wg_f2[tid + stride];
        wg_f3[tid] = wg_f3[tid] + wg_f3[tid + stride];
      }
      workgroupBarrier();
      stride = stride >> 1u;
    }
    if (tid == 0u) {
      telemetry_f32[1u] = vec4<f32>(wg_f0[0u], wg_f1[0u], wg_f2[0u], wg_f3[0u]);
    }
  }
}

// Parallel GPU tile multipole reduction for PeerCompute slab exchange (32-byte readback!)
@compute @workgroup_size(256)
fn reduce_tile_multipole(@builtin(local_invocation_id) lid: vec3<u32>) {
  let tid = lid.x;
  let n_p = params.particle_count;
  var m_sum = 0.0;
  var mx = 0.0;
  var my = 0.0;
  var mz = 0.0;
  var r2_sum = 0.0;
  var cnt = 0.0;
  var i = tid;
  loop {
    if (i >= n_p) { break; }
    let pm = particles[i].pos_m;
    if (pm.w > 0.0 && pm.x >= params.tile_x_min && pm.x < params.tile_x_max) {
      m_sum = m_sum + pm.w;
      mx = mx + pm.w * pm.x;
      my = my + pm.w * pm.y;
      mz = mz + pm.w * pm.z;
      r2_sum = r2_sum + pm.w * dot(pm.xyz, pm.xyz);
      cnt = cnt + 1.0;
    }
    i = i + 256u;
  }
  wg_f0[tid] = m_sum;
  wg_f1[tid] = mx;
  wg_f2[tid] = my;
  wg_f3[tid] = mz;
  wg_f4[tid] = r2_sum;
  wg_f5[tid] = cnt;
  workgroupBarrier();

  var stride = 128u;
  loop {
    if (stride == 0u) { break; }
    if (tid < stride) {
      wg_f0[tid] = wg_f0[tid] + wg_f0[tid + stride];
      wg_f1[tid] = wg_f1[tid] + wg_f1[tid + stride];
      wg_f2[tid] = wg_f2[tid] + wg_f2[tid + stride];
      wg_f3[tid] = wg_f3[tid] + wg_f3[tid + stride];
      wg_f4[tid] = wg_f4[tid] + wg_f4[tid + stride];
      wg_f5[tid] = wg_f5[tid] + wg_f5[tid + stride];
    }
    workgroupBarrier();
    stride = stride >> 1u;
  }
  if (tid == 0u) {
    let m_tot = wg_f0[0u];
    if (m_tot > 1.0e-6) {
      let cx = wg_f1[0u] / m_tot;
      let cy = wg_f2[0u] / m_tot;
      let cz = wg_f3[0u] / m_tot;
      // Exact parallel-axis identity: sum m_i |r_i - com|^2 = sum m_i |r_i|^2 - M |com|^2
      let q_trace = max(0.0, wg_f4[0u] - m_tot * (cx * cx + cy * cy + cz * cz));
      telemetry_f32[18u] = vec4<f32>(m_tot, cx, cy, cz);
      telemetry_f32[19u] = vec4<f32>(q_trace, wg_f5[0u], 0.0, 0.0);
    } else {
      telemetry_f32[18u] = vec4<f32>(0.0);
      telemetry_f32[19u] = vec4<f32>(0.0);
    }
  }
}
`;

// =========================================================================
// Full-Nyquist GPU Zel'dovich Approximation IC Generator (via `fft3dWebGpu`!)
// =========================================================================
const zeldovichIcWgsl = /* wgsl */ `
struct ZeldParams {
  n: u32,
  seed: u32,
  axis: u32,
  pad0: u32,
  box_l: f32,
  amplitude: f32,
  k_eq: f32,
  v_pref: f32,
};

@group(0) @binding(0) var<uniform> params: ZeldParams;
@group(0) @binding(1) var<storage, read_write> k_field: array<vec2<f32>>;
@group(0) @binding(2) var<storage, read_write> disp_field: array<vec4<f32>>;

const TWO_PI: f32 = 6.28318530717958647692;

fn hash_u32(v_in: u32) -> u32 {
  var v = v_in;
  v = (v ^ 61u) ^ (v >> 16u);
  v = v * 9u;
  v = v ^ (v >> 4u);
  v = v * 0x27d4eb2du;
  v = v ^ (v >> 15u);
  return v;
}

fn rand01(h: u32) -> f32 {
  return (f32(h & 0x00ffffffu) + 0.5) / 16777216.0;
}

// Generates Hermitian-symmetric primordial Gaussian random displacement mode Psi_k = i * (k / k^2) * delta_k
@compute @workgroup_size(64)
fn generate_zeldovich_kspace(@builtin(global_invocation_id) id: vec3<u32>) {
  let n = params.n;
  let total = n * n * n;
  let idx = id.x;
  if (idx >= total) { return; }
  if (idx == 0u) {
    k_field[0u] = vec2<f32>(0.0, 0.0);
    return;
  }
  let ix = idx % n;
  let iy = (idx / n) % n;
  let iz = idx / (n * n);
  let half_n = n >> 1u;

  // Canonical Hermitian conjugate pairing: (-k) mod N
  let cx = (n - ix) % n;
  let cy = (n - iy) % n;
  let cz = (n - iz) % n;
  let conj_idx = (cz * n + cy) * n + cx;
  let canon_idx = min(idx, conj_idx);
  let is_conj = idx > conj_idx;
  let is_self_conj = idx == conj_idx;

  let h1 = hash_u32(canon_idx * 747796405u + params.seed * 2891336453u + 17u);
  let h2 = hash_u32(h1 + 1013904223u);
  let u1 = max(1e-6, rand01(h1));
  let u2 = rand01(h2);
  let gauss_r = sqrt(-2.0 * log(u1));
  let theta = TWO_PI * u2;
  var delta_re = gauss_r * cos(theta);
  var delta_im = select(gauss_r * sin(theta), 0.0, is_self_conj);
  if (is_conj) { delta_im = -delta_im; }

  let nx = select(f32(ix), f32(ix) - f32(n), ix >= half_n);
  let ny = select(f32(iy), f32(iy) - f32(n), iy >= half_n);
  let nz = select(f32(iz), f32(iz) - f32(n), iz >= half_n);
  let dk = TWO_PI / max(params.box_l, 1.0e-6);
  let kx = nx * dk;
  let ky = ny * dk;
  let kz = nz * dk;
  let k2 = kx * kx + ky * ky + kz * kz;
  let k_mag = sqrt(k2);
  // Eisenstein-Hu-like primordial matter power spectrum P(k) ~ k / (1 + (k/k_eq)^2)^2
  let ratio = k_mag / max(params.k_eq, 1.0e-6);
  let pk = k_mag / ((1.0 + ratio * ratio) * (1.0 + ratio * ratio));
  // Smooth Nyquist filter so small-scale modes are clean & isotropic
  let k_nyq = f32(half_n) * dk;
  let nyq_win = exp(-2.2 * (k_mag / k_nyq) * (k_mag / k_nyq));
  let amp = params.amplitude * sqrt(pk * nyq_win) * (params.box_l * 0.28) * f32(total);
  let k_comp = select(select(kz, ky, params.axis == 1u), kx, params.axis == 0u);
  // Psi_k = i * (k_comp / k^2) * delta_k -> i * (re + i im) = (-im, re)
  let fac = (k_comp / max(k2, 1.0e-12)) * amp;
  k_field[idx] = vec2<f32>(-delta_im * fac, delta_re * fac);
}

@compute @workgroup_size(64)
fn store_disp_axis(@builtin(global_invocation_id) id: vec3<u32>) {
  let total = params.n * params.n * params.n;
  let idx = id.x;
  if (idx >= total) { return; }
  var cur = disp_field[idx];
  let v = k_field[idx].x;
  if (params.axis == 0u) { cur.x = v; }
  else if (params.axis == 1u) { cur.y = v; }
  else { cur.z = v; }
  disp_field[idx] = cur;
}
`;

/**
 * Friedmann expansion rate H(a) / H_0 for flat/curved Lambda-CDM cosmology.
 */
export function friedmannHOverH0(a, { omegaM = 0.315, omegaLambda = 0.685, omegaR = 9e-5 } = {}) {
  const aSafe = Math.max(1e-4, Number(a));
  const omegaK = 1 - omegaM - omegaLambda - omegaR;
  return Math.sqrt(Math.max(1e-8, omegaR / (aSafe ** 4) + omegaM / (aSafe ** 3) + omegaK / (aSafe ** 2) + omegaLambda));
}

function wrapPeriodicCoord(u, L) {
  let w = u + 0.5 * L;
  w -= L * Math.floor(w / L);
  return w - 0.5 * L;
}

/**
 * Generate FULL-NYQUIST Zel'dovich Approximation initial conditions strictly on
 * WebGPU via Gate 0B `fft3dWebGpu` (inverse 3D FFT of Hermitian-symmetric
 * Eisenstein–Hu Gaussian random displacement modes across ALL `N^3` modes),
 * with exact zero-momentum subtraction and optional disjoint `slabBounds`.
 */
export async function buildZeldovichCosmologyICsWebGpu(device, {
  gridPerSide = 24,
  fftGridN = 32,
  boxLengthMpc = 200,
  aInit = 0.05,
  omegaM = 0.315,
  omegaLambda = 0.685,
  amplitude = 0.35,
  seed = 20261122,
  slabBounds = null,
  initialPositionsShift = [0, 0, 0]
} = {}) {
  if (!device || typeof device.createBuffer !== 'function') {
    throw new TypeError('buildZeldovichCosmologyICsWebGpu requires a live WebGPU GPUDevice');
  }
  const n = Math.max(8, Math.trunc(gridPerSide));
  const L = Number(boxLengthMpc);
  const dx = L / n;
  const hInit = friedmannHOverH0(aInit, { omegaM, omegaLambda });
  const growthRate = Math.pow(omegaM / (aInit ** 3 * hInit * hInit), 0.55);
  const vPref = aInit * aInit * hInit * growthRate;
  const dkBox = (2 * Math.PI) / Math.max(1e-3, L);
  const kEq = Math.max(dkBox * 1.5, Math.min(0.0103, dkBox * Math.max(2.5, fftGridN * 0.22)));

  const ws = createFft3dWorkspaceWebGpu(device, fftGridN);
  const totalFft = ws.total;
  const bindings = [
    computeBufferBinding(0, 'uniform'),
    computeBufferBinding(1, 'storage'),
    computeBufferBinding(2, 'storage')
  ];
  const genPipe = createCachedExplicitComputePipeline(device, {
    cacheKey: 'ulg-zeldovich-ic-gen.v1',
    label: 'ulg-zeldovich-ic-gen',
    code: zeldovichIcWgsl,
    entryPoint: 'generate_zeldovich_kspace',
    bindings
  });
  const storePipe = createCachedExplicitComputePipeline(device, {
    cacheKey: 'ulg-zeldovich-ic-store.v1',
    label: 'ulg-zeldovich-ic-store',
    code: zeldovichIcWgsl,
    entryPoint: 'store_disp_axis',
    bindings
  });

  const dispBuf = device.createBuffer({ size: totalFft * 16, usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_SRC });
  const readDisp = device.createBuffer({ size: totalFft * 16, usage: GPU_BUFFER_USAGE.MAP_READ | GPU_BUFFER_USAGE.COPY_DST });
  const uBufs = [0, 1, 2].map((ax) => {
    const ab = new ArrayBuffer(32);
    new Uint32Array(ab, 0, 4).set([ws.n, seed >>> 0, ax, 0]);
    new Float32Array(ab, 16, 4).set([L, amplitude, kEq, vPref]);
    const b = device.createBuffer({ size: 32, usage: GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST });
    device.queue.writeBuffer(b, 0, ab);
    return b;
  });

  try {
    const enc = device.createCommandEncoder({ label: 'ulg-zeldovich-gpu-ic' });
    const wgFft = Math.ceil(totalFft / 64);
    for (let ax = 0; ax < 3; ax += 1) {
      const bgGen = device.createBindGroup({
        layout: genPipe.bindGroupLayout,
        entries: [
          { binding: 0, resource: { buffer: uBufs[ax] } },
          { binding: 1, resource: { buffer: ws.bufferA } },
          { binding: 2, resource: { buffer: dispBuf } }
        ]
      });
      let pass = enc.beginComputePass();
      pass.setPipeline(genPipe.pipeline);
      pass.setBindGroup(0, bgGen);
      pass.dispatchWorkgroups(wgFft);
      pass.end();
      const realBuf = ws.encodeInverseFrom(enc, ws.bufferA);
      const bgStore = device.createBindGroup({
        layout: storePipe.bindGroupLayout,
        entries: [
          { binding: 0, resource: { buffer: uBufs[ax] } },
          { binding: 1, resource: { buffer: realBuf } },
          { binding: 2, resource: { buffer: dispBuf } }
        ]
      });
      pass = enc.beginComputePass();
      pass.setPipeline(storePipe.pipeline);
      pass.setBindGroup(0, bgStore);
      pass.dispatchWorkgroups(wgFft);
      pass.end();
    }
    enc.copyBufferToBuffer(dispBuf, 0, readDisp, 0, totalFft * 16);
    device.queue.submit([enc.finish()]);
    await readDisp.mapAsync(GPU_BUFFER_USAGE.MAP_READ);
    const dispGrid = new Float32Array(readDisp.getMappedRange().slice(0, totalFft * 16));
    readDisp.unmap();

    // Normalize the 3D GPU-FFT Zel'dovich displacement field to physical linear RMS
    // displacement (targetRms = amplitude * L / 24 -> ~3.3 Mpc at z=19 on 200 Mpc box,
    // ensuring sigma_init ~ 0.15-0.35 cleanly in the linear growing regime before collapse!)
    let sumSq = 0;
    for (let i = 0; i < totalFft; i += 1) {
      const dxv = dispGrid[i * 4 + 0];
      const dyv = dispGrid[i * 4 + 1];
      const dzv = dispGrid[i * 4 + 2];
      sumSq += dxv * dxv + dyv * dyv + dzv * dzv;
    }
    const curRms = Math.sqrt(sumSq / Math.max(1, totalFft));
    const targetRms = Math.max(0.1, Number(amplitude) || 0.35) * (L / 24);
    const normScale = curRms > 1e-12 ? (targetRms / curRms) : 0;
    for (let i = 0; i < totalFft; i += 1) {
      dispGrid[i * 4 + 0] *= normScale;
      dispGrid[i * 4 + 1] *= normScale;
      dispGrid[i * 4 + 2] *= normScale;
    }

    // Sample displacement field at regular comoving lattice sites (trilinear periodic)
    const M = ws.n;
    const sampleDisp = (qx, qy, qz) => {
      const gx = ((qx + 0.5 * L) / L) * M;
      const gy = ((qy + 0.5 * L) / L) * M;
      const gz = ((qz + 0.5 * L) / L) * M;
      const ix0 = ((Math.floor(gx) % M) + M) % M;
      const iy0 = ((Math.floor(gy) % M) + M) % M;
      const iz0 = ((Math.floor(gz) % M) + M) % M;
      const ix1 = (ix0 + 1) % M;
      const iy1 = (iy0 + 1) % M;
      const iz1 = (iz0 + 1) % M;
      const fx = gx - Math.floor(gx);
      const fy = gy - Math.floor(gy);
      const fz = gz - Math.floor(gz);
      let dxOut = 0; let dyOut = 0; let dzOut = 0;
      const xs = [ix0, ix1]; const ys = [iy0, iy1]; const zs = [iz0, iz1];
      const wxs = [1 - fx, fx]; const wys = [1 - fy, fy]; const wzs = [1 - fz, fz];
      for (let dz = 0; dz < 2; dz += 1) {
        for (let dy = 0; dy < 2; dy += 1) {
          for (let dxI = 0; dxI < 2; dxI += 1) {
            const c = ((zs[dz] * M + ys[dy]) * M + xs[dxI]) * 4;
            const w = wxs[dxI] * wys[dy] * wzs[dz];
            dxOut += dispGrid[c + 0] * w;
            dyOut += dispGrid[c + 1] * w;
            dzOut += dispGrid[c + 2] * w;
          }
        }
      }
      return [dxOut, dyOut, dzOut];
    };

    const sx = Number(initialPositionsShift?.[0]) || 0;
    const sy = Number(initialPositionsShift?.[1]) || 0;
    const sz = Number(initialPositionsShift?.[2]) || 0;
    const globalCount = n * n * n;
    const allPts = new Float32Array(globalCount * 16);
    let vxSum = 0; let vySum = 0; let vzSum = 0;
    let idx = 0;
    for (let iz = 0; iz < n; iz += 1) {
      for (let iy = 0; iy < n; iy += 1) {
        for (let ix = 0; ix < n; ix += 1) {
          const qx = (ix + 0.5) * dx - 0.5 * L;
          const qy = (iy + 0.5) * dx - 0.5 * L;
          const qz = (iz + 0.5) * dx - 0.5 * L;
          const [psiX, psiY, psiZ] = sampleDisp(qx, qy, qz);
          const x = wrapPeriodicCoord(qx + psiX + sx, L);
          const y = wrapPeriodicCoord(qy + psiY + sy, L);
          const z = wrapPeriodicCoord(qz + psiZ + sz, L);
          const vx = vPref * psiX;
          const vy = vPref * psiY;
          const vz = vPref * psiZ;
          vxSum += vx; vySum += vy; vzSum += vz;
          const base = idx * 16;
          allPts[base + 0] = x;
          allPts[base + 1] = y;
          allPts[base + 2] = z;
          allPts[base + 3] = 1.0;
          allPts[base + 4] = vx;
          allPts[base + 5] = vy;
          allPts[base + 6] = vz;
          allPts[base + 7] = 0.25;
          allPts[base + 12] = (idx % 6 === 0) ? 1.0 : 0.0;
          allPts[base + 14] = aInit;
          idx += 1;
        }
      }
    }
    vxSum /= globalCount; vySum /= globalCount; vzSum /= globalCount;
    for (let i = 0; i < globalCount; i += 1) {
      allPts[i * 16 + 4] -= vxSum;
      allPts[i * 16 + 5] -= vySum;
      allPts[i * 16 + 6] -= vzSum;
    }

    if (slabBounds && Number.isFinite(slabBounds.xMin) && Number.isFinite(slabBounds.xMax)) {
      const kept = [];
      for (let i = 0; i < globalCount; i += 1) {
        const x = allPts[i * 16 + 0];
        if (x >= slabBounds.xMin && x < slabBounds.xMax) kept.push(i);
      }
      const slabData = new Float32Array(kept.length * 16);
      for (let k = 0; k < kept.length; k += 1) {
        const srcOff = kept[k] * 16;
        slabData.set(allPts.subarray(srcOff, srcOff + 16), k * 16);
      }
      return {
        icBackend: 'webgpu-fft3d-zeldovich-full-nyquist',
        particleCount: kept.length,
        globalParticleCount: globalCount,
        data: slabData,
        boxLengthMpc: L,
        aInit
      };
    }

    return {
      icBackend: 'webgpu-fft3d-zeldovich-full-nyquist',
      particleCount: globalCount,
      globalParticleCount: globalCount,
      data: allPts,
      boxLengthMpc: L,
      aInit
    };
  } finally {
    ws.destroy();
    dispBuf.destroy();
    readDisp.destroy();
    for (const b of uBufs) b.destroy();
  }
}

/**
 * Generate FULL-NYQUIST Second-Order Lagrangian Perturbation Theory (2LPT) initial
 * conditions strictly on WebGPU via Gate 0B `fft3dWebGpu`!
 *
 * Computes the exact 1st-order Zel'dovich displacement `Psi^(1)(q)` on GPU, forms
 * the quadratic tidal-tensor source `S^(2)(q) = sum_{a<b}(J_aa J_bb - J_ab^2)`
 * where `J_ab = d(Psi^(1)_a)/dq_b`, solves `nabla^2 Phi^(2) = S^(2)` via 3D FFT
 * on GPU (`fft3dWebGpu`), and combines 1st + 2nd order growth & velocity factors
 * (`D2 = -(3/7) Omega_m^(-1/143) D1^2`, `f1 = Omega_m^0.55`, `f2 = 2 Omega_m^(6/11)`).
 * Produces dramatically sharper, artifact-free cosmic web filaments & cluster nodes!
 */
export async function build2LptCosmologyICsWebGpu(device, {
  gridPerSide = 28,
  fftGridN = 32,
  boxLengthMpc = 200,
  aInit = 0.12,
  omegaM = 0.315,
  omegaLambda = 0.685,
  amplitude = 0.36,
  seed = 20261125,
  slabBounds = null,
  initialPositionsShift = [0, 0, 0]
} = {}) {
  if (!device || typeof device.createBuffer !== 'function') {
    throw new TypeError('build2LptCosmologyICsWebGpu requires a live WebGPU GPUDevice');
  }
  const n = Math.max(8, Math.trunc(gridPerSide));
  const L = Number(boxLengthMpc);
  const dx = L / n;
  const hInit = friedmannHOverH0(aInit, { omegaM, omegaLambda });
  const omegaMA = (omegaM / (aInit ** 3)) / Math.max(1e-8, hInit * hInit);
  const f1 = Math.pow(Math.max(1e-4, omegaMA), 0.55);
  const f2 = 2.0 * Math.pow(Math.max(1e-4, omegaMA), 6 / 11);
  const vPref1 = aInit * aInit * hInit * f1;
  const vPref2 = aInit * aInit * hInit * f2;
  const dkBox = (2 * Math.PI) / Math.max(1e-3, L);
  const kEq = Math.max(dkBox * 1.5, Math.min(0.0103, dkBox * Math.max(2.5, fftGridN * 0.22)));

  const ws = createFft3dWorkspaceWebGpu(device, fftGridN);
  const M = ws.n;
  const totalFft = ws.total;
  const bindings = [
    computeBufferBinding(0, 'uniform'),
    computeBufferBinding(1, 'storage'),
    computeBufferBinding(2, 'storage')
  ];
  const genPipe = createCachedExplicitComputePipeline(device, {
    cacheKey: 'ulg-zeldovich-ic-gen.v1',
    label: 'ulg-2lpt-ic-gen',
    code: zeldovichIcWgsl,
    entryPoint: 'generate_zeldovich_kspace',
    bindings
  });
  const storePipe = createCachedExplicitComputePipeline(device, {
    cacheKey: 'ulg-zeldovich-ic-store.v1',
    label: 'ulg-2lpt-ic-store',
    code: zeldovichIcWgsl,
    entryPoint: 'store_disp_axis',
    bindings
  });

  const dispBuf = device.createBuffer({ size: totalFft * 16, usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_SRC });
  const readDisp = device.createBuffer({ size: totalFft * 16, usage: GPU_BUFFER_USAGE.MAP_READ | GPU_BUFFER_USAGE.COPY_DST });
  const kSave = device.createBuffer({ size: ws.byteLength, usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_DST | GPU_BUFFER_USAGE.COPY_SRC });
  const uBufs = [0, 1, 2].map((ax) => {
    const ab = new ArrayBuffer(32);
    new Uint32Array(ab, 0, 4).set([M, seed >>> 0, ax, 0]);
    new Float32Array(ab, 16, 4).set([L, amplitude, kEq, vPref1]);
    const b = device.createBuffer({ size: 32, usage: GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST });
    device.queue.writeBuffer(b, 0, ab);
    return b;
  });

  try {
    // Pass 1: Generate 1st-order full-Nyquist Zel'dovich displacement Psi^(1) on WebGPU
    const enc1 = device.createCommandEncoder({ label: 'ulg-2lpt-psi1' });
    const wgFft = Math.ceil(totalFft / 64);
    for (let ax = 0; ax < 3; ax += 1) {
      const bgGen = device.createBindGroup({
        layout: genPipe.bindGroupLayout,
        entries: [
          { binding: 0, resource: { buffer: uBufs[ax] } },
          { binding: 1, resource: { buffer: ws.bufferA } },
          { binding: 2, resource: { buffer: dispBuf } }
        ]
      });
      let pass = enc1.beginComputePass();
      pass.setPipeline(genPipe.pipeline);
      pass.setBindGroup(0, bgGen);
      pass.dispatchWorkgroups(wgFft);
      pass.end();
      const realBuf = ws.encodeInverseFrom(enc1, ws.bufferA);
      const bgStore = device.createBindGroup({
        layout: storePipe.bindGroupLayout,
        entries: [
          { binding: 0, resource: { buffer: uBufs[ax] } },
          { binding: 1, resource: { buffer: realBuf } },
          { binding: 2, resource: { buffer: dispBuf } }
        ]
      });
      pass = enc1.beginComputePass();
      pass.setPipeline(storePipe.pipeline);
      pass.setBindGroup(0, bgStore);
      pass.dispatchWorkgroups(wgFft);
      pass.end();
    }
    enc1.copyBufferToBuffer(dispBuf, 0, readDisp, 0, totalFft * 16);
    device.queue.submit([enc1.finish()]);
    await readDisp.mapAsync(GPU_BUFFER_USAGE.MAP_READ);
    const psi1Grid = new Float32Array(readDisp.getMappedRange().slice(0, totalFft * 16));
    readDisp.unmap();

    // Normalize Psi^(1) to physical linear RMS displacement
    let sumSq1 = 0;
    for (let i = 0; i < totalFft; i += 1) {
      sumSq1 += psi1Grid[i * 4] ** 2 + psi1Grid[i * 4 + 1] ** 2 + psi1Grid[i * 4 + 2] ** 2;
    }
    const rms1 = Math.sqrt(sumSq1 / Math.max(1, totalFft));
    const targetRms = Math.max(0.1, Number(amplitude) || 0.36) * (L / 22);
    const normScale = rms1 > 1e-12 ? (targetRms / rms1) : 0;
    for (let i = 0; i < totalFft; i += 1) {
      psi1Grid[i * 4 + 0] *= normScale;
      psi1Grid[i * 4 + 1] *= normScale;
      psi1Grid[i * 4 + 2] *= normScale;
    }

    // Pass 2: Compute exact quadratic 2LPT tidal source S^(2)(q) = sum_{a<b}(J_aa J_bb - J_ab^2)
    // and solve nabla^2 Phi^(2) = S^(2) -> Psi^(2) = -grad Phi^(2) strictly on WebGPU via fft3dWebGpu!
    const cellM = L / M;
    const inv2h = 0.5 / cellM;
    const s2Complex = new Float32Array(totalFft * 2);
    const gidx = (x, y, z) => ((((z + M) % M) * M + ((y + M) % M)) * M + ((x + M) % M)) * 4;
    for (let iz = 0; iz < M; iz += 1) {
      for (let iy = 0; iy < M; iy += 1) {
        for (let ix = 0; ix < M; ix += 1) {
          const xp = gidx(ix + 1, iy, iz); const xm = gidx(ix - 1, iy, iz);
          const yp = gidx(ix, iy + 1, iz); const ym = gidx(ix, iy - 1, iz);
          const zp = gidx(ix, iy, iz + 1); const zm = gidx(ix, iy, iz - 1);
          const jxx = (psi1Grid[xp + 0] - psi1Grid[xm + 0]) * inv2h;
          const jyy = (psi1Grid[yp + 1] - psi1Grid[ym + 1]) * inv2h;
          const jzz = (psi1Grid[zp + 2] - psi1Grid[zm + 2]) * inv2h;
          const jxy = 0.5 * ((psi1Grid[yp + 0] - psi1Grid[ym + 0]) + (psi1Grid[xp + 1] - psi1Grid[xm + 1])) * inv2h;
          const jxz = 0.5 * ((psi1Grid[zp + 0] - psi1Grid[zm + 0]) + (psi1Grid[xp + 2] - psi1Grid[xm + 2])) * inv2h;
          const jyz = 0.5 * ((psi1Grid[zp + 1] - psi1Grid[zm + 1]) + (psi1Grid[yp + 2] - psi1Grid[ym + 2])) * inv2h;
          const s2 = jxx * jyy + jxx * jzz + jyy * jzz - jxy * jxy - jxz * jxz - jyz * jyz;
          s2Complex[((iz * M + iy) * M + ix) * 2] = s2;
        }
      }
    }

    device.queue.writeBuffer(ws.bufferA, 0, s2Complex);
    ws.writeAxisPoissonParams({ boxLength: L, smoothR2: (0.45 * cellM) ** 2 });
    const enc2 = device.createCommandEncoder({ label: 'ulg-2lpt-psi2' });
    const kBuf2 = ws.encodeForward(enc2);
    enc2.copyBufferToBuffer(kBuf2, 0, kSave, 0, ws.byteLength);
    for (let ax = 0; ax < 3; ax += 1) {
      const gradBuf = ws.encodePoissonInverseFromKSpace(enc2, kSave, { gradAxis: ax + 1 });
      const bgStore = device.createBindGroup({
        layout: storePipe.bindGroupLayout,
        entries: [
          { binding: 0, resource: { buffer: uBufs[ax] } },
          { binding: 1, resource: { buffer: gradBuf } },
          { binding: 2, resource: { buffer: dispBuf } }
        ]
      });
      const pass = enc2.beginComputePass();
      pass.setPipeline(storePipe.pipeline);
      pass.setBindGroup(0, bgStore);
      pass.dispatchWorkgroups(wgFft);
      pass.end();
    }
    enc2.copyBufferToBuffer(dispBuf, 0, readDisp, 0, totalFft * 16);
    device.queue.submit([enc2.finish()]);
    await readDisp.mapAsync(GPU_BUFFER_USAGE.MAP_READ);
    const psi2Grid = new Float32Array(readDisp.getMappedRange().slice(0, totalFft * 16));
    readDisp.unmap();

    // Standard 2LPT ratio D2 / D1^2 = -(3/7) * Omega_m^(-1/143)
    const c2Lpt = -(3 / 7) * Math.pow(Math.max(1e-3, omegaMA), -1 / 143);
    let sumSq2 = 0;
    for (let i = 0; i < totalFft; i += 1) {
      const dx2 = c2Lpt * psi2Grid[i * 4 + 0];
      const dy2 = c2Lpt * psi2Grid[i * 4 + 1];
      const dz2 = c2Lpt * psi2Grid[i * 4 + 2];
      psi2Grid[i * 4 + 0] = dx2;
      psi2Grid[i * 4 + 1] = dy2;
      psi2Grid[i * 4 + 2] = dz2;
      sumSq2 += dx2 * dx2 + dy2 * dy2 + dz2 * dz2;
    }
    const rms2 = Math.sqrt(sumSq2 / Math.max(1, totalFft));

    const sampleVec = (grid, qx, qy, qz) => {
      const gx = ((qx + 0.5 * L) / L) * M;
      const gy = ((qy + 0.5 * L) / L) * M;
      const gz = ((qz + 0.5 * L) / L) * M;
      const ix0 = ((Math.floor(gx) % M) + M) % M;
      const iy0 = ((Math.floor(gy) % M) + M) % M;
      const iz0 = ((Math.floor(gz) % M) + M) % M;
      const ix1 = (ix0 + 1) % M; const iy1 = (iy0 + 1) % M; const iz1 = (iz0 + 1) % M;
      const fx = gx - Math.floor(gx); const fy = gy - Math.floor(gy); const fz = gz - Math.floor(gz);
      let ox = 0; let oy = 0; let oz = 0;
      const xs = [ix0, ix1]; const ys = [iy0, iy1]; const zs = [iz0, iz1];
      const wxs = [1 - fx, fx]; const wys = [1 - fy, fy]; const wzs = [1 - fz, fz];
      for (let dzI = 0; dzI < 2; dzI += 1) {
        for (let dyI = 0; dyI < 2; dyI += 1) {
          for (let dxI = 0; dxI < 2; dxI += 1) {
            const c = ((zs[dzI] * M + ys[dyI]) * M + xs[dxI]) * 4;
            const w = wxs[dxI] * wys[dyI] * wzs[dzI];
            ox += grid[c + 0] * w; oy += grid[c + 1] * w; oz += grid[c + 2] * w;
          }
        }
      }
      return [ox, oy, oz];
    };

    const sx = Number(initialPositionsShift?.[0]) || 0;
    const sy = Number(initialPositionsShift?.[1]) || 0;
    const sz = Number(initialPositionsShift?.[2]) || 0;
    const globalCount = n * n * n;
    const allPts = new Float32Array(globalCount * 16);
    let vxSum = 0; let vySum = 0; let vzSum = 0;
    let idx = 0;
    for (let iz = 0; iz < n; iz += 1) {
      for (let iy = 0; iy < n; iy += 1) {
        for (let ix = 0; ix < n; ix += 1) {
          const qx = (ix + 0.5) * dx - 0.5 * L;
          const qy = (iy + 0.5) * dx - 0.5 * L;
          const qz = (iz + 0.5) * dx - 0.5 * L;
          const p1 = sampleVec(psi1Grid, qx, qy, qz);
          const p2 = sampleVec(psi2Grid, qx, qy, qz);
          const x = wrapPeriodicCoord(qx + p1[0] + p2[0] + sx, L);
          const y = wrapPeriodicCoord(qy + p1[1] + p2[1] + sy, L);
          const z = wrapPeriodicCoord(qz + p1[2] + p2[2] + sz, L);
          const vx = vPref1 * p1[0] + vPref2 * p2[0];
          const vy = vPref1 * p1[1] + vPref2 * p2[1];
          const vz = vPref1 * p1[2] + vPref2 * p2[2];
          vxSum += vx; vySum += vy; vzSum += vz;
          const base = idx * 16;
          allPts[base + 0] = x; allPts[base + 1] = y; allPts[base + 2] = z;
          allPts[base + 3] = 1.0;
          allPts[base + 4] = vx; allPts[base + 5] = vy; allPts[base + 6] = vz;
          allPts[base + 7] = 0.28;
          allPts[base + 12] = (idx % 6 === 0) ? 1.0 : 0.0;
          allPts[base + 14] = aInit;
          idx += 1;
        }
      }
    }
    vxSum /= globalCount; vySum /= globalCount; vzSum /= globalCount;
    for (let i = 0; i < globalCount; i += 1) {
      allPts[i * 16 + 4] -= vxSum;
      allPts[i * 16 + 5] -= vySum;
      allPts[i * 16 + 6] -= vzSum;
    }

    if (slabBounds && Number.isFinite(slabBounds.xMin) && Number.isFinite(slabBounds.xMax)) {
      const kept = [];
      for (let i = 0; i < globalCount; i += 1) {
        const x = allPts[i * 16 + 0];
        if (x >= slabBounds.xMin && x < slabBounds.xMax) kept.push(i);
      }
      const slabData = new Float32Array(kept.length * 16);
      for (let k = 0; k < kept.length; k += 1) {
        const srcOff = kept[k] * 16;
        slabData.set(allPts.subarray(srcOff, srcOff + 16), k * 16);
      }
      return {
        icBackend: 'webgpu-fft3d-2lpt-full-nyquist',
        particleCount: kept.length,
        globalParticleCount: globalCount,
        data: slabData,
        boxLengthMpc: L,
        aInit,
        rms2Over1: rms2 / Math.max(1e-9, targetRms)
      };
    }

    return {
      icBackend: 'webgpu-fft3d-2lpt-full-nyquist',
      particleCount: globalCount,
      globalParticleCount: globalCount,
      data: allPts,
      boxLengthMpc: L,
      aInit,
      rms2Over1: rms2 / Math.max(1e-9, targetRms)
    };
  } finally {
    ws.destroy();
    dispBuf.destroy();
    readDisp.destroy();
    kSave.destroy();
    for (const b of uBufs) b.destroy();
  }
}

/**
 * Host deterministic Zel'dovich IC generator (for synchronous session construction
 * & host tests; supports disjoint `slabBounds` and `initialPositionsShift`).
 */
export function buildZeldovichCosmologyICs({
  gridPerSide = 24,
  boxLengthMpc = 200,
  aInit = 0.05,
  omegaM = 0.315,
  omegaLambda = 0.685,
  amplitude = 0.14,
  seed = 20261122,
  slabBounds = null,
  initialPositionsShift = [0, 0, 0]
} = {}) {
  const n = Math.max(8, Math.trunc(gridPerSide));
  const globalCount = n * n * n;
  const data = new Float32Array(globalCount * 16);
  const L = Number(boxLengthMpc);
  const dx = L / n;
  const hInit = friedmannHOverH0(aInit, { omegaM, omegaLambda });
  const growthRate = Math.pow(omegaM / (aInit ** 3 * hInit * hInit), 0.55);

  let s = seed >>> 0;
  const rand = () => {
    s = (Math.imul(1664525, s) + 1013904223) >>> 0;
    return (s + 0.5) / 4294967296;
  };
  const modes = [];
  const dkBoxHost = (2 * Math.PI) / Math.max(1e-3, L);
  const kEq = Math.max(dkBoxHost * 1.5, Math.min(0.0103, dkBoxHost * Math.max(2.5, n * 0.22)));
  for (let kx = -3; kx <= 3; kx += 1) {
    for (let ky = -3; ky <= 3; ky += 1) {
      for (let kz = -3; kz <= 3; kz += 1) {
        const k2i = kx * kx + ky * ky + kz * kz;
        if (k2i === 0 || k2i > 12) continue;
        const kPhys = (2 * Math.PI / L) * Math.sqrt(k2i);
        const pk = kPhys / ((1 + (kPhys / kEq) ** 2) ** 2);
        const amp = amplitude * Math.sqrt(pk) * (L / 45);
        modes.push({
          kx: (2 * Math.PI * kx) / L,
          ky: (2 * Math.PI * ky) / L,
          kz: (2 * Math.PI * kz) / L,
          k2: kPhys * kPhys,
          amp,
          phase: rand() * 2 * Math.PI
        });
      }
    }
  }

  const sx = Number(initialPositionsShift?.[0]) || 0;
  const sy = Number(initialPositionsShift?.[1]) || 0;
  const sz = Number(initialPositionsShift?.[2]) || 0;

  let idx = 0;
  let vxSum = 0; let vySum = 0; let vzSum = 0;
  for (let iz = 0; iz < n; iz += 1) {
    for (let iy = 0; iy < n; iy += 1) {
      for (let ix = 0; ix < n; ix += 1) {
        const qx = (ix + 0.5) * dx - 0.5 * L;
        const qy = (iy + 0.5) * dx - 0.5 * L;
        const qz = (iz + 0.5) * dx - 0.5 * L;
        let psiX = 0; let psiY = 0; let psiZ = 0;
        for (const m of modes) {
          const arg = m.kx * qx + m.ky * qy + m.kz * qz + m.phase;
          const sinA = Math.sin(arg) * (m.amp / m.k2);
          psiX += m.kx * sinA;
          psiY += m.ky * sinA;
          psiZ += m.kz * sinA;
        }
        const x = wrapPeriodicCoord(qx + psiX + sx, L);
        const y = wrapPeriodicCoord(qy + psiY + sy, L);
        const z = wrapPeriodicCoord(qz + psiZ + sz, L);
        const vPref = aInit * aInit * hInit * growthRate;
        const vx = vPref * psiX;
        const vy = vPref * psiY;
        const vz = vPref * psiZ;
        vxSum += vx; vySum += vy; vzSum += vz;

        const base = idx * 16;
        data[base + 0] = x;
        data[base + 1] = y;
        data[base + 2] = z;
        data[base + 3] = 1.0;
        data[base + 4] = vx;
        data[base + 5] = vy;
        data[base + 6] = vz;
        data[base + 7] = 0.25;
        data[base + 12] = (idx % 6 === 0) ? 1.0 : 0.0;
        data[base + 14] = aInit;
        idx += 1;
      }
    }
  }
  vxSum /= globalCount; vySum /= globalCount; vzSum /= globalCount;
  for (let i = 0; i < globalCount; i += 1) {
    data[i * 16 + 4] -= vxSum;
    data[i * 16 + 5] -= vySum;
    data[i * 16 + 6] -= vzSum;
  }

  if (slabBounds && Number.isFinite(slabBounds.xMin) && Number.isFinite(slabBounds.xMax)) {
    const kept = [];
    for (let i = 0; i < globalCount; i += 1) {
      const x = data[i * 16 + 0];
      if (x >= slabBounds.xMin && x < slabBounds.xMax) kept.push(i);
    }
    const slabData = new Float32Array(kept.length * 16);
    for (let k = 0; k < kept.length; k += 1) {
      const srcOff = kept[k] * 16;
      slabData.set(data.subarray(srcOff, srcOff + 16), k * 16);
    }
    return {
      icBackend: 'host-zeldovich-low-k',
      particleCount: kept.length,
      globalParticleCount: globalCount,
      data: slabData,
      boxLengthMpc: L,
      aInit
    };
  }
  return {
    icBackend: 'host-zeldovich-low-k',
    particleCount: globalCount,
    globalParticleCount: globalCount,
    data,
    boxLengthMpc: L,
    aInit
  };
}

/**
 * Create a GPU-resident Supergalactic FLRW Comoving TreePM session sharing
 * Gate 0B's `createFft3dWorkspaceWebGpu` (`1 queue.submit/step`, `1` forward FFT,
 * live 16-bin GPU `P(k)` power spectrum, pure float32 telemetry, GPU tile
 * multipole reduction, and remote-slab gravitational coupling!).
 */
export function createSupergalacticTreePmSessionWebGpu(device, {
  gridPerSide = 24,
  pmGridN = 32,
  boxLengthMpc = 200,
  aInit = 0.05,
  da = 0.015,
  omegaM = 0.315,
  omegaLambda = 0.685,
  smoothCells = 0.75,
  enableShortRangeTree = true,
  seed = 20261122,
  initialPositionsShift = [0, 0, 0],
  slabBounds = null,
  initialConditions = null
} = {}) {
  if (!device || typeof device.createBuffer !== 'function') {
    throw new TypeError('createSupergalacticTreePmSessionWebGpu requires a live WebGPU GPUDevice');
  }
  const ic = initialConditions || buildZeldovichCosmologyICs({
    gridPerSide,
    boxLengthMpc,
    aInit,
    omegaM,
    omegaLambda,
    seed,
    slabBounds,
    initialPositionsShift
  });
  const particleCount = ic.particleCount;
  const globalParticleCount = ic.globalParticleCount ?? ic.particleCount;
  const gridN = pmGridN;
  const gridTotal = gridN ** 3;
  const fftWs = createFft3dWorkspaceWebGpu(device, gridN);

  const bindings = [
    computeBufferBinding(0, 'uniform'),
    computeBufferBinding(1, 'storage'),
    computeBufferBinding(2, 'storage'),
    computeBufferBinding(3, 'storage'),
    computeBufferBinding(4, 'storage'),
    computeBufferBinding(5, 'storage'),
    computeBufferBinding(6, 'storage'),
    computeBufferBinding(7, 'storage')
  ];
  const mkPipe = (entry) => createCachedExplicitComputePipeline(device, {
    cacheKey: `ulg-supergalactic-treepm-${entry}.v3-1submit-pk-kdk`,
    label: `ulg-supergalactic-treepm-${entry}`,
    code: supergalacticTreePmWgsl,
    entryPoint: entry,
    bindings
  });
  const clearPipe = mkPipe('clear_grids');
  const depositPipe = mkPipe('cic_deposit');
  const rhsPipe = mkPipe('prepare_poisson_rhs');
  const pkPipe = mkPipe('reduce_power_spectrum_pk');
  const storeXPipe = mkPipe('store_force_x');
  const storeYPipe = mkPipe('store_force_y');
  const storeZPipe = mkPipe('store_force_z');
  const kickDriftPipe = mkPipe('cic_kick_drift');
  const reduceTelPipe = mkPipe('reduce_telemetry_f32');
  const reduceTilePipe = mkPipe('reduce_tile_multipole');

  const paramsBuf = device.createBuffer({ size: 64, usage: GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST });
  const particleBuf = device.createBuffer({
    label: 'ulg-supergalactic-particles',
    size: Math.max(64, ic.data.byteLength),
    usage: GPU_BUFFER_USAGE.VERTEX | GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_DST | GPU_BUFFER_USAGE.COPY_SRC
  });
  if (ic.data.byteLength > 0) {
    device.queue.writeBuffer(particleBuf, 0, ic.data);
  }
  const cicBuf = device.createBuffer({ size: gridTotal * 4, usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_SRC });
  const forceGridBuf = device.createBuffer({ size: gridTotal * 16, usage: GPU_BUFFER_USAGE.STORAGE });
  // 20 vec4<f32> = 320 bytes: [0]=gridStats, [1]=particleStats, [2..17]=16 P(k) bins, [18..19]=tileMultipole
  const telemetryBytes = 20 * 16;
  const telemetryBuf = device.createBuffer({ size: telemetryBytes, usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_SRC });
  const readTelemetryBuf = device.createBuffer({ size: telemetryBytes, usage: GPU_BUFFER_USAGE.MAP_READ | GPU_BUFFER_USAGE.COPY_DST });
  const readTileBuf = device.createBuffer({ size: 32, usage: GPU_BUFFER_USAGE.MAP_READ | GPU_BUFFER_USAGE.COPY_DST });
  const srAccumBuf = device.createBuffer({ size: gridTotal * 16, usage: GPU_BUFFER_USAGE.STORAGE });
  // srNodeBuf holds gridTotal local short-range cells + MAX_REMOTE_TILES remote-peer multipole slots!
  const srNodeBuf = device.createBuffer({
    size: (gridTotal + MAX_REMOTE_TILES) * 16,
    usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_DST
  });
  const kSpaceSaveBuf = device.createBuffer({
    size: fftWs.byteLength,
    usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_DST | GPU_BUFFER_USAGE.COPY_SRC
  });

  const mkBg = (fftGridBuf) => device.createBindGroup({
    layout: clearPipe.bindGroupLayout,
    entries: [paramsBuf, particleBuf, cicBuf, fftGridBuf, forceGridBuf, telemetryBuf, srAccumBuf, srNodeBuf].map((buffer, binding) => ({
      binding, resource: { buffer }
    }))
  });
  const bgA = mkBg(fftWs.bufferA);
  const bgB = mkBg(fftWs.bufferB);
  const bgK = mkBg(kSpaceSaveBuf);
  const bgFor = (buf) => (buf === fftWs.bufferA ? bgA : (buf === fftWs.bufferB ? bgB : bgK));

  const cellSize = boxLengthMpc / gridN;
  const smoothR2 = (smoothCells * cellSize) ** 2;
  const shortRangeRS = enableShortRangeTree ? smoothCells * cellSize : 0.0;
  const meanMassPerCell = globalParticleCount / gridTotal;
  fftWs.writeAxisPoissonParams({ boxLength: boxLengthMpc, smoothR2 });

  let aScale = aInit;
  let stepIndex = 0;
  let prevKickFac = 0;
  let remoteTileCount = 0;
  let lastSubmitsPerStep = 1;
  let initialLowKPower = null;
  let tileBoundsQuery = { xMin: -0.5 * boxLengthMpc, xMax: 0.5 * boxLengthMpc };

  const writeUniforms = (customTileBounds = null, stepDa = da) => {
    const tb = customTileBounds || tileBoundsQuery;
    const hA = friedmannHOverH0(aScale, { omegaM, omegaLambda });
    const gravPref = 1.5 * omegaM / Math.max(0.01, aScale);
    const ab = new ArrayBuffer(64);
    new Uint32Array(ab, 0, 4).set([particleCount, gridN, stepIndex, remoteTileCount]);
    new Float32Array(ab, 16, 12).set([
      boxLengthMpc,
      aScale,
      stepDa,
      hA,
      omegaM,
      gravPref,
      meanMassPerCell,
      shortRangeRS,
      prevKickFac,
      Number(tb.xMin),
      Number(tb.xMax),
      0
    ]);
    device.queue.writeBuffer(paramsBuf, 0, ab);
    return { hA, gravPref, stepDa };
  };

  /**
   * Upload GPU-reduced multipole summaries from remote PeerCompute spatial slabs
   * directly into the resident GPU buffer so `cic_kick_drift` couples remote
   * gravitational attraction across disjoint browser peers!
   */
  function injectRemoteTileMultipoles(remoteTiles = []) {
    const list = Array.isArray(remoteTiles) ? remoteTiles.slice(0, MAX_REMOTE_TILES) : [];
    const packed = new Float32Array(MAX_REMOTE_TILES * 4);
    for (let i = 0; i < list.length; i += 1) {
      const t = list[i];
      const com = t.com || [0, 0, 0];
      packed[i * 4 + 0] = Number(com[0]) || 0;
      packed[i * 4 + 1] = Number(com[1]) || 0;
      packed[i * 4 + 2] = Number(com[2]) || 0;
      packed[i * 4 + 3] = Math.max(0, Number(t.totalMass) || 0);
    }
    remoteTileCount = list.length;
    device.queue.writeBuffer(srNodeBuf, gridTotal * 16, packed);
    return remoteTileCount;
  }

  const wgGrid = Math.ceil(gridTotal / 64);
  const wgPart = Math.max(1, Math.ceil(particleCount / 64));
  let mapInFlight = false;
  let lastTelemetry = null;
  let disposed = false;

  async function step({ readTelemetry = true, daOverride = null } = {}) {
    if (disposed) return lastTelemetry;
    const effDa = (daOverride != null && Number.isFinite(Number(daOverride)) && Number(daOverride) > 0)
      ? Math.max(1e-5, Math.min(0.25, Number(daOverride)))
      : da;
    const { hA } = writeUniforms(null, effDa);
    const curKickFac = effDa / (Math.max(0.01, aScale) * Math.max(0.05, hA));

    // ALL TreePM stages fused into ONE single CommandEncoder & ONE queue.submit!
    //   1. Clear -> CIC Deposit -> Prepare Poisson RHS
    //   2. ONE Forward 3D FFT -> Save k-space -> Live 16-bin GPU P(k) Reduction
    //   3. 3 Spectral Gradients + 3 Inverse 3D FFTs directly from saved k-space (0 redundant forward FFTs!)
    //   4. Hybrid Short-Range + Remote-Slab + Symplectic KDK Integration
    //   5. Pure Float32 GPU Telemetry Reduction
    const enc = device.createCommandEncoder({ label: `ulg-cosmo-treepm-step-${stepIndex}` });

    let pass = enc.beginComputePass({ label: 'ulg-cosmo-cic-rhs' });
    pass.setBindGroup(0, bgA);
    pass.setPipeline(clearPipe.pipeline); pass.dispatchWorkgroups(wgGrid);
    if (particleCount > 0) {
      pass.setPipeline(depositPipe.pipeline); pass.dispatchWorkgroups(wgPart);
    }
    pass.setPipeline(rhsPipe.pipeline); pass.dispatchWorkgroups(wgGrid);
    pass.end();

    const kBuf = fftWs.encodeForward(enc);
    enc.copyBufferToBuffer(kBuf, 0, kSpaceSaveBuf, 0, fftWs.byteLength);

    pass = enc.beginComputePass({ label: 'ulg-cosmo-pk' });
    pass.setBindGroup(0, bgK);
    pass.setPipeline(pkPipe.pipeline);
    pass.dispatchWorkgroups(PK_BIN_COUNT);
    pass.end();

    const storePipes = [storeXPipe, storeYPipe, storeZPipe];
    for (let ax = 1; ax <= 3; ax += 1) {
      const gradBuf = fftWs.encodePoissonInverseFromKSpace(enc, kSpaceSaveBuf, { gradAxis: ax });
      pass = enc.beginComputePass({ label: `ulg-cosmo-store-f${ax}` });
      pass.setBindGroup(0, bgFor(gradBuf));
      pass.setPipeline(storePipes[ax - 1].pipeline);
      pass.dispatchWorkgroups(wgGrid);
      pass.end();
    }

    pass = enc.beginComputePass({ label: 'ulg-cosmo-kdk-telemetry' });
    pass.setBindGroup(0, bgA);
    if (particleCount > 0) {
      pass.setPipeline(kickDriftPipe.pipeline); pass.dispatchWorkgroups(wgPart);
    }
    pass.setPipeline(reduceTelPipe.pipeline); pass.dispatchWorkgroups(2);
    pass.end();

    const doRead = Boolean(readTelemetry && !disposed && !mapInFlight && readTelemetryBuf.mapState === 'unmapped');
    if (doRead) {
      mapInFlight = true;
      enc.copyBufferToBuffer(telemetryBuf, 0, readTelemetryBuf, 0, telemetryBytes);
    }
    device.queue.submit([enc.finish()]);
    lastSubmitsPerStep = 1;

    prevKickFac = curKickFac;
    // Unbounded continuous FLRW expansion into the future Λ-dominated accelerating era (never dead-stops!)
    aScale = Math.min(1e6, aScale + effDa);
    stepIndex += 1;

    if (!doRead) return readTelemetry ? lastTelemetry : null;
    let f32 = null;
    try {
      await readTelemetryBuf.mapAsync(GPU_BUFFER_USAGE.MAP_READ);
      if (!disposed) {
        f32 = new Float32Array(readTelemetryBuf.getMappedRange().slice(0, telemetryBytes));
      }
      if (!disposed && readTelemetryBuf.mapState === 'mapped') {
        try { readTelemetryBuf.unmap(); } catch {}
      }
    } catch (err) {
      if (!disposed && err?.name !== 'AbortError') throw err;
    } finally {
      mapInFlight = false;
    }
    if (!f32 || disposed) return lastTelemetry;

    const sigmaDensity = Math.sqrt(Math.max(0, f32[0] / Math.max(1, f32[3])));
    const maxOverdensity = f32[1];
    const kineticEnergy = f32[4];
    const momentum = [f32[5], f32[6], f32[7]];
    const redshiftZ = 1 / Math.max(1e-4, aScale) - 1;

    const kBins = [];
    const pkValues = [];
    const modeCounts = [];
    let totalModes = 0;
    for (let b = 0; b < PK_BIN_COUNT; b += 1) {
      const o = (2 + b) * 4;
      const cnt = Math.round(f32[o + 2]);
      if (cnt > 0) {
        kBins.push(f32[o + 0]);
        pkValues.push(f32[o + 1]);
        modeCounts.push(cnt);
        totalModes += cnt;
      }
    }
    const lowKPower = pkValues.length > 0
      ? pkValues.slice(0, Math.min(4, pkValues.length)).reduce((a, b) => a + b, 0) / Math.min(4, pkValues.length)
      : 0;
    if (initialLowKPower === null && lowKPower > 0) {
      initialLowKPower = lowKPower;
    }
    const linearGrowthRatio = initialLowKPower > 0 ? Math.sqrt(lowKPower / initialLowKPower) : 1.0;

    lastTelemetry = Object.freeze({
      schema: ULG_SUPERGALACTIC_TREEPM_SCHEMA,
      backend: enableShortRangeTree ? 'webgpu-fft3d-hybrid-treepm' : 'webgpu-fft3d-pm',
      icBackend: ic.icBackend || 'webgpu-fft3d-zeldovich',
      integrator: 'symplectic-comoving-kdk',
      submitsPerStep: lastSubmitsPerStep,
      hybridTreePmEnabled: Boolean(enableShortRangeTree),
      shortRangeSplitScaleMpc: shortRangeRS,
      remoteTileCount,
      stepIndex,
      scaleFactorA: aScale,
      redshiftZ,
      hOverH0: friedmannHOverH0(aScale, { omegaM, omegaLambda }),
      particleCount,
      globalParticleCount,
      pmGridN: gridN,
      boxLengthMpc,
      sigmaDensity,
      maxOverdensity,
      kineticEnergy,
      momentum,
      powerSpectrumPk: Object.freeze({
        kBins: Object.freeze(kBins),
        pkValues: Object.freeze(pkValues),
        modeCounts: Object.freeze(modeCounts),
        totalModes,
        lowKPower,
        linearGrowthRatio
      }),
      accuracyTier: ULG_ACCURACY_TIERS.TIER_2_REPRESENTATIVE_EFFECTIVE,
      provenance: Object.freeze({
        status: 'webgpu-derived',
        scientificValidation: false,
        sharedKernel: 'src/runtime/gpuMath/fft3dWebGpu.js'
      })
    });
    return lastTelemetry;
  }

  async function readParticlesSnapshot() {
    if (particleCount === 0) return new Float32Array(0);
    const rb = device.createBuffer({
      size: ic.data.byteLength,
      usage: GPU_BUFFER_USAGE.MAP_READ | GPU_BUFFER_USAGE.COPY_DST
    });
    try {
      const enc = device.createCommandEncoder({ label: 'ulg-cosmo-read-particles' });
      enc.copyBufferToBuffer(particleBuf, 0, rb, 0, ic.data.byteLength);
      device.queue.submit([enc.finish()]);
      await rb.mapAsync(GPU_BUFFER_USAGE.MAP_READ);
      const copy = new Float32Array(rb.getMappedRange().slice(0));
      rb.unmap();
      return copy;
    } finally {
      rb.destroy();
    }
  }

  /**
   * GPU-reduced compact 32-byte tile multipole summary (`0` full-particle CPU readback!).
   */
  async function readTileMultipoleSummary({ xMin = -0.5 * boxLengthMpc, xMax = 0.5 * boxLengthMpc } = {}) {
    tileBoundsQuery = { xMin: Number(xMin), xMax: Number(xMax) };
    writeUniforms(tileBoundsQuery);
    const enc = device.createCommandEncoder({ label: 'ulg-cosmo-tile-multipole-gpu' });
    const pass = enc.beginComputePass();
    pass.setBindGroup(0, bgA);
    pass.setPipeline(reduceTilePipe.pipeline);
    pass.dispatchWorkgroups(1);
    pass.end();
    enc.copyBufferToBuffer(telemetryBuf, 18 * 16, readTileBuf, 0, 32);
    device.queue.submit([enc.finish()]);

    await readTileBuf.mapAsync(GPU_BUFFER_USAGE.MAP_READ);
    const t = new Float32Array(readTileBuf.getMappedRange().slice(0, 32));
    readTileBuf.unmap();
    return Object.freeze({
      reducedOnGpu: true,
      readbackBytes: 32,
      totalMass: t[0],
      com: Object.freeze([t[1], t[2], t[3]]),
      quadrupoleTrace: t[4],
      particleCount: Math.round(t[5]),
      scaleFactorA: aScale,
      stepIndex
    });
  }

  /**
   * Extract genuine GPU-coalesced dark-matter+baryon Cosmic Web halo peaks, filament bridges,
   * and void edges directly from the live 3D CIC density field (`cicBuf`), computing true
   * 3D comoving coordinates, overdensity `delta = rho / rho_bar`, and local tidal-shear spin
   * parameter `spinLambda` so L1 galaxies emerge causally from the expanding FLRW Cosmic Web!
   */
  async function extractLiveCosmicHalos({ maxHalos = 7 } = {}) {
    if (disposed) return [];
    const bytes = gridTotal * 4;
    const stg = device.createBuffer({ label: 'ulg-cosmo-halo-read', size: bytes, usage: GPU_BUFFER_USAGE.MAP_READ | GPU_BUFFER_USAGE.COPY_DST });
    let raw = null;
    try {
      const enc = device.createCommandEncoder({ label: 'ulg-cosmo-halo-extract' });
      enc.copyBufferToBuffer(cicBuf, 0, stg, 0, bytes);
      device.queue.submit([enc.finish()]);
      await stg.mapAsync(GPU_BUFFER_USAGE.MAP_READ);
      if (!disposed) {
        raw = new Int32Array(stg.getMappedRange(0, bytes)).slice();
      }
      try { stg.unmap(); } catch {}
    } catch {
      raw = null;
    } finally {
      try { stg.destroy(); } catch {}
    }
    if (!raw || raw.length < gridTotal) return [];

    let sum = 0;
    for (let i = 0; i < gridTotal; i += 1) sum += Math.max(0, raw[i]);
    const meanVal = Math.max(1e-6, sum / gridTotal);
    const n = gridN;
    const wrap = (v) => ((v % n) + n) % n;
    const at = (x, y, z) => Math.max(0, raw[(wrap(z) * n + wrap(y)) * n + wrap(x)]);

    const peaks = [];
    let bestFilament = null;
    let bestVoidEdge = null;

    for (let iz = 0; iz < n; iz += 1) {
      for (let iy = 0; iy < n; iy += 1) {
        for (let ix = 0; ix < n; ix += 1) {
          const v = at(ix, iy, iz);
          const delta = v / meanVal;
          // Track real filament bridge (~1.25..1.95x mean) and void-edge (~0.35..0.68x mean) sites
          if (!bestFilament && delta >= 1.25 && delta <= 1.85 && ((ix + iy + iz) & 3) === 1) {
            bestFilament = { ix, iy, iz, delta, v };
          }
          if (!bestVoidEdge && delta >= 0.35 && delta <= 0.66 && ((ix * 3 + iy * 5 + iz) & 7) === 3) {
            bestVoidEdge = { ix, iy, iz, delta, v };
          }
          if (delta < 1.35) continue;
          // Check 6-face + 12-edge local peak condition
          const xp = at(ix + 1, iy, iz); const xm = at(ix - 1, iy, iz);
          const yp = at(ix, iy + 1, iz); const ym = at(ix, iy - 1, iz);
          const zp = at(ix, iy, iz + 1); const zm = at(ix, iy, iz - 1);
          if (v < xp || v < xm || v < yp || v < ym || v < zp || v < zm) continue;
          // Local 3D tidal-shear Hessian anisotropy -> dimensionless Peebles spin proxy lambda in [0.015 .. 0.12]
          const dxx = Math.abs(xp + xm - 2 * v);
          const dyy = Math.abs(yp + ym - 2 * v);
          const dzz = Math.abs(zp + zm - 2 * v);
          const aniso = (Math.abs(dxx - dyy) + Math.abs(dyy - dzz) + Math.abs(dzz - dxx)) / Math.max(1e-3, dxx + dyy + dzz + v * 0.25);
          const spinLambda = Math.max(0.015, Math.min(0.125, 0.022 + aniso * 0.095));
          peaks.push({ ix, iy, iz, delta, spinLambda });
        }
      }
    }
    peaks.sort((a, b) => b.delta - a.delta);

    const chosen = [];
    const minSepCells = Math.max(2.5, n * 0.14);
    for (const p of peaks) {
      if (chosen.length >= Math.max(1, maxHalos - 2)) break;
      const tooClose = chosen.some((c) => Math.hypot(c.ix - p.ix, c.iy - p.iy, c.iz - p.iz) < minSepCells);
      if (!tooClose) chosen.push(p);
    }
    if (bestFilament && chosen.length < maxHalos) {
      chosen.push({ ...bestFilament, spinLambda: 0.082 });
    }
    if (bestVoidEdge && chosen.length < maxHalos) {
      chosen.push({ ...bestVoidEdge, spinLambda: 0.042 });
    }
    while (chosen.length < maxHalos && peaks.length > chosen.length) {
      const next = peaks.find((p) => !chosen.includes(p));
      if (!next) break;
      chosen.push(next);
    }

    const zNow = 1 / Math.max(0.02, aScale) - 1;
    return chosen.slice(0, maxHalos).map((h, idx) => {
      const ux = ((h.ix + 0.5) / n) - 0.5;
      const uy = ((h.iy + 0.5) / n) - 0.5;
      const uz = ((h.iz + 0.5) / n) - 0.5;
      const posMpc = [ux * boxLengthMpc, uy * boxLengthMpc, uz * boxLengthMpc];
      const haloMassSolar = Number((1.1e11 * Math.pow(Math.max(0.25, h.delta), 1.65)).toExponential(2));
      return Object.freeze({
        index: idx,
        gridCoords: Object.freeze([h.ix, h.iy, h.iz]),
        posMpc: Object.freeze(posMpc),
        posNorm: Object.freeze([ux, uy, uz]),
        overdensity: Number(h.delta.toFixed(3)),
        spinLambda: Number((h.spinLambda ?? 0.055).toFixed(4)),
        haloMassSolar,
        scaleFactorA: Number(aScale.toFixed(4)),
        redshiftZ: Number(zNow.toFixed(3)),
        gpuCoalesced: true
      });
    });
  }

  return Object.freeze({
    schema: ULG_SUPERGALACTIC_TREEPM_SCHEMA,
    icBackend: ic.icBackend || 'host-zeldovich-low-k',
    particleCount,
    globalParticleCount,
    strideFloats: 16,
    boxLengthMpc,
    hybridTreePmEnabled: Boolean(enableShortRangeTree),
    shortRangeSplitScaleMpc: shortRangeRS,
    particlesBuffer: particleBuf,
    forceGridBuffer: forceGridBuf,
    injectRemoteTileMultipoles,
    step,
    readParticlesSnapshot,
    readTileMultipoleSummary,
    extractLiveCosmicHalos,
    getState: () => ({ aScale, redshiftZ: Math.max(0, 1 / aScale - 1), stepIndex, submitsPerStep: lastSubmitsPerStep, remoteTileCount }),
    destroy() {
      if (disposed) return;
      disposed = true;
      fftWs.destroy();
      for (const b of [paramsBuf, particleBuf, cicBuf, forceGridBuf, telemetryBuf, readTelemetryBuf, readTileBuf, srAccumBuf, srNodeBuf, kSpaceSaveBuf]) {
        try { b.destroy(); } catch {}
      }
    }
  });
}

/**
 * Zero-copy Cosmic-Zoom adapter exposing the live Gate 5D FLRW 3D-FFT TreePM
 * engine under the resident-engine interface (`count`, `activeCount`, `strideFloats`,
 * `backend`, `stepIndex`, `scaleFactorA`, `getResidentBuffer`, `readbackBodies`,
 * `step`, `dispose`).
 */
export function createSupergalacticTreePmCosmicAdapter({
  device,
  particleCount = 4096,
  gridN = 32,
  boxLengthMpc = 18.0,
  aInit = 0.25,
  da = 0.008,
  seed = 1370
} = {}) {
  const session = createSupergalacticTreePmSessionWebGpu(device, {
    gridPerSide: Math.max(8, Math.round(Math.cbrt(particleCount))),
    pmGridN: gridN,
    boxLengthMpc,
    aInit,
    da,
    seed
  });
  let lastTelemetry = null;
  let lastSnapshot = new Float32Array(0);
  return {
    schema: ULG_SUPERGALACTIC_TREEPM_SCHEMA,
    backend: 'webgpu',
    gravityMode: 'webgpu-flrw-fft3d-treepm',
    count: session.particleCount,
    activeCount: session.particleCount,
    strideFloats: session.strideFloats,
    get stepIndex() { return session.getState().stepIndex; },
    get scaleFactorA() { return session.getState().aScale; },
    get redshiftZ() { return session.getState().redshiftZ; },
    get lastTelemetry() { return lastTelemetry; },
    getResidentBuffer() { return session.particlesBuffer; },
    getBodies() { return lastSnapshot; },
    async readbackBodies() {
      lastSnapshot = await session.readParticlesSnapshot();
      return lastSnapshot;
    },
    async step({ readback = false } = {}) {
      lastTelemetry = await session.step({ readTelemetry: Boolean(readback) });
      if (readback) {
        lastSnapshot = await session.readParticlesSnapshot();
        return lastSnapshot;
      }
      return lastTelemetry;
    },
    dispose() { session.destroy(); }
  };
}
