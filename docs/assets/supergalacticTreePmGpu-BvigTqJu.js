import{o as e}from"./materialFoundationAbi-FyZ8ey5s.js";import{computeBufferBinding as t,createCachedExplicitComputePipeline as n}from"../runtime/webgpuComputeLayout.js";import{t as r}from"./fft3dWebGpu-U-dm_fNS.js";var i=`ulg.astrophysics.supergalactic-flrw-treepm.v1`,a=Object.freeze({MAP_READ:1,COPY_SRC:4,COPY_DST:8,VERTEX:32,UNIFORM:64,STORAGE:128}),o=16,s=32,c=`
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
const PK_BINS: u32 = ${o}u;

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
    let r_cut = 2.0 * r_s;
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
  let n_rem = min(params.remote_tile_count, ${s}u);
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
  let kick_fac = da / (a * a * h_a);
  let a_mid = a + 0.5 * da;
  let drift_fac = da / (a_mid * a_mid * a_mid * h_a);

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
`,l=`
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
`;function u(e,{omegaM:t=.315,omegaLambda:n=.685,omegaR:r=9e-5}={}){let i=Math.max(1e-4,Number(e)),a=1-t-n-r;return Math.sqrt(Math.max(1e-8,r/i**4+t/i**3+a/i**2+n))}function d(e,t){let n=e+.5*t;return n-=t*Math.floor(n/t),n-.5*t}async function f(e,{gridPerSide:i=24,fftGridN:o=32,boxLengthMpc:s=200,aInit:c=.05,omegaM:f=.315,omegaLambda:p=.685,amplitude:m=.35,seed:h=20261122,slabBounds:g=null,initialPositionsShift:_=[0,0,0]}={}){if(!e||typeof e.createBuffer!=`function`)throw TypeError(`buildZeldovichCosmologyICsWebGpu requires a live WebGPU GPUDevice`);let v=Math.max(8,Math.trunc(i)),y=Number(s),b=y/v,x=u(c,{omegaM:f,omegaLambda:p}),S=(f/(c**3*x*x))**.55,C=c*c*x*S,w=2*Math.PI/y*2.5,T=r(e,o),E=T.total,D=[t(0,`uniform`),t(1,`storage`),t(2,`storage`)],O=n(e,{cacheKey:`ulg-zeldovich-ic-gen.v1`,label:`ulg-zeldovich-ic-gen`,code:l,entryPoint:`generate_zeldovich_kspace`,bindings:D}),k=n(e,{cacheKey:`ulg-zeldovich-ic-store.v1`,label:`ulg-zeldovich-ic-store`,code:l,entryPoint:`store_disp_axis`,bindings:D}),A=e.createBuffer({size:E*16,usage:a.STORAGE|a.COPY_SRC}),j=e.createBuffer({size:E*16,usage:a.MAP_READ|a.COPY_DST}),M=[0,1,2].map(t=>{let n=new ArrayBuffer(32);new Uint32Array(n,0,4).set([T.n,h>>>0,t,0]),new Float32Array(n,16,4).set([y,m,w,C]);let r=e.createBuffer({size:32,usage:a.UNIFORM|a.COPY_DST});return e.queue.writeBuffer(r,0,n),r});try{let t=e.createCommandEncoder({label:`ulg-zeldovich-gpu-ic`}),n=Math.ceil(E/64);for(let r=0;r<3;r+=1){let i=e.createBindGroup({layout:O.bindGroupLayout,entries:[{binding:0,resource:{buffer:M[r]}},{binding:1,resource:{buffer:T.bufferA}},{binding:2,resource:{buffer:A}}]}),a=t.beginComputePass();a.setPipeline(O.pipeline),a.setBindGroup(0,i),a.dispatchWorkgroups(n),a.end();let o=T.encodeInverseFrom(t,T.bufferA),s=e.createBindGroup({layout:k.bindGroupLayout,entries:[{binding:0,resource:{buffer:M[r]}},{binding:1,resource:{buffer:o}},{binding:2,resource:{buffer:A}}]});a=t.beginComputePass(),a.setPipeline(k.pipeline),a.setBindGroup(0,s),a.dispatchWorkgroups(n),a.end()}t.copyBufferToBuffer(A,0,j,0,E*16),e.queue.submit([t.finish()]),await j.mapAsync(a.MAP_READ);let r=new Float32Array(j.getMappedRange().slice(0,E*16));j.unmap();let i=0;for(let e=0;e<E;e+=1){let t=r[e*4+0],n=r[e*4+1],a=r[e*4+2];i+=t*t+n*n+a*a}let o=Math.sqrt(i/Math.max(1,E)),s=Math.max(.1,Number(m)||.35)*(y/24),l=o>1e-12?s/o:0;for(let e=0;e<E;e+=1)r[e*4+0]*=l,r[e*4+1]*=l,r[e*4+2]*=l;let u=T.n,f=(e,t,n)=>{let i=(e+.5*y)/y*u,a=(t+.5*y)/y*u,o=(n+.5*y)/y*u,s=(Math.floor(i)%u+u)%u,c=(Math.floor(a)%u+u)%u,l=(Math.floor(o)%u+u)%u,d=(s+1)%u,f=(c+1)%u,p=(l+1)%u,m=i-Math.floor(i),h=a-Math.floor(a),g=o-Math.floor(o),_=0,v=0,b=0,x=[s,d],S=[c,f],C=[l,p],w=[1-m,m],T=[1-h,h],E=[1-g,g];for(let e=0;e<2;e+=1)for(let t=0;t<2;t+=1)for(let n=0;n<2;n+=1){let i=((C[e]*u+S[t])*u+x[n])*4,a=w[n]*T[t]*E[e];_+=r[i+0]*a,v+=r[i+1]*a,b+=r[i+2]*a}return[_,v,b]},p=Number(_?.[0])||0,h=Number(_?.[1])||0,x=Number(_?.[2])||0,S=v*v*v,w=new Float32Array(S*16),D=0,N=0,P=0,F=0;for(let e=0;e<v;e+=1)for(let t=0;t<v;t+=1)for(let n=0;n<v;n+=1){let r=(n+.5)*b-.5*y,i=(t+.5)*b-.5*y,a=(e+.5)*b-.5*y,[o,s,l]=f(r,i,a),u=d(r+o+p,y),m=d(i+s+h,y),g=d(a+l+x,y),_=C*o,v=C*s,S=C*l;D+=_,N+=v,P+=S;let T=F*16;w[T+0]=u,w[T+1]=m,w[T+2]=g,w[T+3]=1,w[T+4]=_,w[T+5]=v,w[T+6]=S,w[T+7]=.25,w[T+12]=+(F%6==0),w[T+14]=c,F+=1}D/=S,N/=S,P/=S;for(let e=0;e<S;e+=1)w[e*16+4]-=D,w[e*16+5]-=N,w[e*16+6]-=P;if(g&&Number.isFinite(g.xMin)&&Number.isFinite(g.xMax)){let e=[];for(let t=0;t<S;t+=1){let n=w[t*16+0];n>=g.xMin&&n<g.xMax&&e.push(t)}let t=new Float32Array(e.length*16);for(let n=0;n<e.length;n+=1){let r=e[n]*16;t.set(w.subarray(r,r+16),n*16)}return{icBackend:`webgpu-fft3d-zeldovich-full-nyquist`,particleCount:e.length,globalParticleCount:S,data:t,boxLengthMpc:y,aInit:c}}return{icBackend:`webgpu-fft3d-zeldovich-full-nyquist`,particleCount:S,globalParticleCount:S,data:w,boxLengthMpc:y,aInit:c}}finally{T.destroy(),A.destroy(),j.destroy();for(let e of M)e.destroy()}}function p({gridPerSide:e=24,boxLengthMpc:t=200,aInit:n=.05,omegaM:r=.315,omegaLambda:i=.685,amplitude:a=.14,seed:o=20261122,slabBounds:s=null,initialPositionsShift:c=[0,0,0]}={}){let l=Math.max(8,Math.trunc(e)),f=l*l*l,p=new Float32Array(f*16),m=Number(t),h=m/l,g=u(n,{omegaM:r,omegaLambda:i}),_=(r/(n**3*g*g))**.55,v=o>>>0,y=()=>(v=Math.imul(1664525,v)+1013904223>>>0,(v+.5)/4294967296),b=[],x=2*Math.PI/m*2.5;for(let e=-3;e<=3;e+=1)for(let t=-3;t<=3;t+=1)for(let n=-3;n<=3;n+=1){let r=e*e+t*t+n*n;if(r===0||r>12)continue;let i=2*Math.PI/m*Math.sqrt(r),o=i/(1+(i/x)**2)**2,s=a*Math.sqrt(o)*(m/45);b.push({kx:2*Math.PI*e/m,ky:2*Math.PI*t/m,kz:2*Math.PI*n/m,k2:i*i,amp:s,phase:y()*2*Math.PI})}let S=Number(c?.[0])||0,C=Number(c?.[1])||0,w=Number(c?.[2])||0,T=0,E=0,D=0,O=0;for(let e=0;e<l;e+=1)for(let t=0;t<l;t+=1)for(let r=0;r<l;r+=1){let i=(r+.5)*h-.5*m,a=(t+.5)*h-.5*m,o=(e+.5)*h-.5*m,s=0,c=0,l=0;for(let e of b){let t=e.kx*i+e.ky*a+e.kz*o+e.phase,n=Math.sin(t)*(e.amp/e.k2);s+=e.kx*n,c+=e.ky*n,l+=e.kz*n}let u=d(i+s+S,m),f=d(a+c+C,m),v=d(o+l+w,m),y=n*n*g*_,x=y*s,k=y*c,A=y*l;E+=x,D+=k,O+=A;let j=T*16;p[j+0]=u,p[j+1]=f,p[j+2]=v,p[j+3]=1,p[j+4]=x,p[j+5]=k,p[j+6]=A,p[j+7]=.25,p[j+12]=+(T%6==0),p[j+14]=n,T+=1}E/=f,D/=f,O/=f;for(let e=0;e<f;e+=1)p[e*16+4]-=E,p[e*16+5]-=D,p[e*16+6]-=O;if(s&&Number.isFinite(s.xMin)&&Number.isFinite(s.xMax)){let e=[];for(let t=0;t<f;t+=1){let n=p[t*16+0];n>=s.xMin&&n<s.xMax&&e.push(t)}let t=new Float32Array(e.length*16);for(let n=0;n<e.length;n+=1){let r=e[n]*16;t.set(p.subarray(r,r+16),n*16)}return{icBackend:`host-zeldovich-low-k`,particleCount:e.length,globalParticleCount:f,data:t,boxLengthMpc:m,aInit:n}}return{icBackend:`host-zeldovich-low-k`,particleCount:f,globalParticleCount:f,data:p,boxLengthMpc:m,aInit:n}}function m(l,{gridPerSide:d=24,pmGridN:f=32,boxLengthMpc:m=200,aInit:h=.05,da:g=.015,omegaM:_=.315,omegaLambda:v=.685,smoothCells:y=.75,enableShortRangeTree:b=!0,seed:x=20261122,initialPositionsShift:S=[0,0,0],slabBounds:C=null,initialConditions:w=null}={}){if(!l||typeof l.createBuffer!=`function`)throw TypeError(`createSupergalacticTreePmSessionWebGpu requires a live WebGPU GPUDevice`);let T=w||p({gridPerSide:d,boxLengthMpc:m,aInit:h,omegaM:_,omegaLambda:v,seed:x,slabBounds:C,initialPositionsShift:S}),E=T.particleCount,D=T.globalParticleCount??T.particleCount,O=f,k=O**3,A=r(l,O),j=[t(0,`uniform`),t(1,`storage`),t(2,`storage`),t(3,`storage`),t(4,`storage`),t(5,`storage`),t(6,`storage`),t(7,`storage`)],M=e=>n(l,{cacheKey:`ulg-supergalactic-treepm-${e}.v3-1submit-pk-kdk`,label:`ulg-supergalactic-treepm-${e}`,code:c,entryPoint:e,bindings:j}),N=M(`clear_grids`),P=M(`cic_deposit`),F=M(`prepare_poisson_rhs`),ee=M(`reduce_power_spectrum_pk`),te=M(`store_force_x`),ne=M(`store_force_y`),re=M(`store_force_z`),ie=M(`cic_kick_drift`),ae=M(`reduce_telemetry_f32`),I=M(`reduce_tile_multipole`),L=l.createBuffer({size:64,usage:a.UNIFORM|a.COPY_DST}),R=l.createBuffer({label:`ulg-supergalactic-particles`,size:Math.max(64,T.data.byteLength),usage:a.VERTEX|a.STORAGE|a.COPY_DST|a.COPY_SRC});T.data.byteLength>0&&l.queue.writeBuffer(R,0,T.data);let oe=l.createBuffer({size:k*4,usage:a.STORAGE}),z=l.createBuffer({size:k*16,usage:a.STORAGE}),B=l.createBuffer({size:320,usage:a.STORAGE|a.COPY_SRC}),V=l.createBuffer({size:320,usage:a.MAP_READ|a.COPY_DST}),H=l.createBuffer({size:32,usage:a.MAP_READ|a.COPY_DST}),se=l.createBuffer({size:k*16,usage:a.STORAGE}),U=l.createBuffer({size:(k+s)*16,usage:a.STORAGE|a.COPY_DST}),W=l.createBuffer({size:A.byteLength,usage:a.STORAGE|a.COPY_DST|a.COPY_SRC}),G=e=>l.createBindGroup({layout:N.bindGroupLayout,entries:[L,R,oe,e,z,B,se,U].map((e,t)=>({binding:t,resource:{buffer:e}}))}),K=G(A.bufferA),ce=G(A.bufferB),le=G(W),ue=e=>e===A.bufferA?K:e===A.bufferB?ce:le,de=m/O,fe=(y*de)**2,q=b?y*de:0,pe=D/k;A.writeAxisPoissonParams({boxLength:m,smoothR2:fe});let J=h,Y=0,me=0,X=0,Z=1,Q=null,$={xMin:-.5*m,xMax:.5*m},he=(e=null)=>{let t=e||$,n=u(J,{omegaM:_,omegaLambda:v}),r=1.5*_/Math.max(.01,J),i=new ArrayBuffer(64);return new Uint32Array(i,0,4).set([E,O,Y,X]),new Float32Array(i,16,12).set([m,J,g,n,_,r,pe,q,me,Number(t.xMin),Number(t.xMax),0]),l.queue.writeBuffer(L,0,i),{hA:n,gravPref:r}};function ge(e=[]){let t=Array.isArray(e)?e.slice(0,s):[],n=new Float32Array(s*4);for(let e=0;e<t.length;e+=1){let r=t[e],i=r.com||[0,0,0];n[e*4+0]=Number(i[0])||0,n[e*4+1]=Number(i[1])||0,n[e*4+2]=Number(i[2])||0,n[e*4+3]=Math.max(0,Number(r.totalMass)||0)}return X=t.length,l.queue.writeBuffer(U,k*16,n),X}let _e=Math.ceil(k/64),ve=Math.max(1,Math.ceil(E/64));async function ye({readTelemetry:t=!0}={}){let{hA:n}=he(),r=g/(Math.max(.01,J)**2*Math.max(.05,n)),s=l.createCommandEncoder({label:`ulg-cosmo-treepm-step-${Y}`}),c=s.beginComputePass({label:`ulg-cosmo-cic-rhs`});c.setBindGroup(0,K),c.setPipeline(N.pipeline),c.dispatchWorkgroups(_e),E>0&&(c.setPipeline(P.pipeline),c.dispatchWorkgroups(ve)),c.setPipeline(F.pipeline),c.dispatchWorkgroups(_e),c.end();let d=A.encodeForward(s);s.copyBufferToBuffer(d,0,W,0,A.byteLength),c=s.beginComputePass({label:`ulg-cosmo-pk`}),c.setBindGroup(0,le),c.setPipeline(ee.pipeline),c.dispatchWorkgroups(o),c.end();let f=[te,ne,re];for(let e=1;e<=3;e+=1){let t=A.encodePoissonInverseFromKSpace(s,W,{gradAxis:e});c=s.beginComputePass({label:`ulg-cosmo-store-f${e}`}),c.setBindGroup(0,ue(t)),c.setPipeline(f[e-1].pipeline),c.dispatchWorkgroups(_e),c.end()}if(c=s.beginComputePass({label:`ulg-cosmo-kdk-telemetry`}),c.setBindGroup(0,K),E>0&&(c.setPipeline(ie.pipeline),c.dispatchWorkgroups(ve)),c.setPipeline(ae.pipeline),c.dispatchWorkgroups(2),c.end(),t&&s.copyBufferToBuffer(B,0,V,0,320),l.queue.submit([s.finish()]),Z=1,me=r,J=Math.min(1.5,J+g),Y+=1,!t)return null;await V.mapAsync(a.MAP_READ);let p=new Float32Array(V.getMappedRange().slice(0,320));V.unmap();let h=Math.sqrt(Math.max(0,p[0]/Math.max(1,p[3]))),y=p[1],x=p[4],S=[p[5],p[6],p[7]],C=Math.max(0,1/J-1),w=[],k=[],j=[],M=0;for(let e=0;e<o;e+=1){let t=(2+e)*4,n=Math.round(p[t+2]);n>0&&(w.push(p[t+0]),k.push(p[t+1]),j.push(n),M+=n)}let I=k.length>0?k.slice(0,Math.min(4,k.length)).reduce((e,t)=>e+t,0)/Math.min(4,k.length):0;Q===null&&I>0&&(Q=I);let L=Q>0?Math.sqrt(I/Q):1;return Object.freeze({schema:i,backend:b?`webgpu-fft3d-hybrid-treepm`:`webgpu-fft3d-pm`,icBackend:T.icBackend||`webgpu-fft3d-zeldovich`,integrator:`symplectic-comoving-kdk`,submitsPerStep:Z,hybridTreePmEnabled:!!b,shortRangeSplitScaleMpc:q,remoteTileCount:X,stepIndex:Y,scaleFactorA:J,redshiftZ:C,hOverH0:u(J,{omegaM:_,omegaLambda:v}),particleCount:E,globalParticleCount:D,pmGridN:O,boxLengthMpc:m,sigmaDensity:h,maxOverdensity:y,kineticEnergy:x,momentum:S,powerSpectrumPk:Object.freeze({kBins:Object.freeze(w),pkValues:Object.freeze(k),modeCounts:Object.freeze(j),totalModes:M,lowKPower:I,linearGrowthRatio:L}),accuracyTier:e.TIER_2_REPRESENTATIVE_EFFECTIVE,provenance:Object.freeze({status:`webgpu-derived`,scientificValidation:!1,sharedKernel:`src/runtime/gpuMath/fft3dWebGpu.js`})})}async function be(){if(E===0)return new Float32Array;let e=l.createBuffer({size:T.data.byteLength,usage:a.MAP_READ|a.COPY_DST});try{let t=l.createCommandEncoder({label:`ulg-cosmo-read-particles`});t.copyBufferToBuffer(R,0,e,0,T.data.byteLength),l.queue.submit([t.finish()]),await e.mapAsync(a.MAP_READ);let n=new Float32Array(e.getMappedRange().slice(0));return e.unmap(),n}finally{e.destroy()}}async function xe({xMin:e=-.5*m,xMax:t=.5*m}={}){$={xMin:Number(e),xMax:Number(t)},he($);let n=l.createCommandEncoder({label:`ulg-cosmo-tile-multipole-gpu`}),r=n.beginComputePass();r.setBindGroup(0,K),r.setPipeline(I.pipeline),r.dispatchWorkgroups(1),r.end(),n.copyBufferToBuffer(B,288,H,0,32),l.queue.submit([n.finish()]),await H.mapAsync(a.MAP_READ);let i=new Float32Array(H.getMappedRange().slice(0,32));return H.unmap(),Object.freeze({reducedOnGpu:!0,readbackBytes:32,totalMass:i[0],com:Object.freeze([i[1],i[2],i[3]]),quadrupoleTrace:i[4],particleCount:Math.round(i[5]),scaleFactorA:J,stepIndex:Y})}return Object.freeze({schema:i,icBackend:T.icBackend||`host-zeldovich-low-k`,particleCount:E,globalParticleCount:D,strideFloats:16,boxLengthMpc:m,hybridTreePmEnabled:!!b,shortRangeSplitScaleMpc:q,particlesBuffer:R,forceGridBuffer:z,injectRemoteTileMultipoles:ge,step:ye,readParticlesSnapshot:be,readTileMultipoleSummary:xe,getState:()=>({aScale:J,redshiftZ:Math.max(0,1/J-1),stepIndex:Y,submitsPerStep:Z,remoteTileCount:X}),destroy(){A.destroy();for(let e of[L,R,oe,z,B,V,H,se,U,W])e.destroy()}})}function h({device:e,particleCount:t=4096,gridN:n=32,boxLengthMpc:r=18,aInit:a=.25,da:o=.008,seed:s=1370}={}){let c=m(e,{gridPerSide:Math.max(8,Math.round(Math.cbrt(t))),pmGridN:n,boxLengthMpc:r,aInit:a,da:o,seed:s}),l=null,u=new Float32Array;return{schema:i,backend:`webgpu`,gravityMode:`webgpu-flrw-fft3d-treepm`,count:c.particleCount,activeCount:c.particleCount,strideFloats:c.strideFloats,get stepIndex(){return c.getState().stepIndex},get scaleFactorA(){return c.getState().aScale},get redshiftZ(){return c.getState().redshiftZ},get lastTelemetry(){return l},getResidentBuffer(){return c.particlesBuffer},getBodies(){return u},async readbackBodies(){return u=await c.readParticlesSnapshot(),u},async step({readback:e=!1}={}){return l=await c.step({readTelemetry:!!e}),e?(u=await c.readParticlesSnapshot(),u):l},dispose(){c.destroy()}}}export{h as n,m as r,f as t};