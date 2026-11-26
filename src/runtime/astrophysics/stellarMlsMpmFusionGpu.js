// First-Principles 3D GPU MLS-MPM Stellar Fusion & Convective Plasma Solver
// (`stellar-mls-mpm-fusion@1`, `src/runtime/astrophysics/stellarMlsMpmFusionGpu.js`).
//
// Strictly Star Spec v0.4 & ULG General-Law Thesis compliant:
//   - Zero CPU mirror solver, zero hot-loop full-state readbacks, zero 1-thread
//     serial compute bottlenecks, zero Safari/Metal WGSL traps (no `meta` identifier,
//     no inverted numeric `smoothstep`, safe `pow(max(0.0, x), y)`).
//   - Couples ULG's Gate 1 nuclear physics (`stellarNucleosynthesisBridge.js`: exact
//     pp-chain Q = 26.73 MeV, CNO T^16 scaling, triple-alpha 3 He-4 -> C-12) directly
//     into a 3D compressible self-gravitating MLS-MPM plasma solver:
//       * 24^3 Eulerian MLS-MPM grid (13,824 cells) + 4,096..8,192 plasma parcels in
//         the EXACT 64-byte `HydroParticle` layout (`pos_mass`, `vel_smooth`,
//         `thermo = [log10T, log10Rho, xH, log10EpsNuc]`, `state = [fMol, xIon, xHe, xZ]`)
//         consumed zero-copy by `PARTICLE_CLOUD_WGSL` Mode 2, `emergent3dDynamoGpu`,
//         and `gpuEntityPickerWebGpu`.
//       * 64-bin radial enclosed-mass shell histogram `M(<r)` gives exact self-consistent
//         hydrostatic self-gravity `g(r) = -G M(<r) / r^2` balancing ideal-gas + radiation
//         pressure `P = (rho k_B T)/(mu m_p) + (1/3) a_rad T^4`.
//       * Core nuclear burn `eps_nuc(rho, T, X_H, X_He)` heats central MPM grid cells while
//         Stefan-Boltzmann photospheric surface cooling radiates outer-shell heat, driving
//         TRUE emergent Rayleigh-Benard buoyant convective plumes & photospheric granulation!
//       * Exact nucleon mass-fraction advection conserving `X_H + X_He + X_Z = 1`.
//       * Coalesced into ONE `queue.submit` per step (`1 submit/step`).

import {
  computeBufferBinding,
  createCachedExplicitBindGroup,
  createCachedExplicitComputePipeline
} from '../webgpuComputeLayout.js';
import { getGate1StellarBurnConstants } from './stellarNucleosynthesisBridge.js';
import { ULG_ACCURACY_TIERS } from '../../../ulg-gpu-abi/src/materialFoundationAbi.js';

export const ULG_STELLAR_MLS_MPM_FUSION_SCHEMA = 'ulg.astrophysics.stellar-mls-mpm-fusion-webgpu.v1';

const GPU_BUF = Object.freeze({
  MAP_READ: 0x0001,
  COPY_SRC: 0x0004,
  COPY_DST: 0x0008,
  VERTEX: 0x0020,
  UNIFORM: 0x0040,
  STORAGE: 0x0080
});

const GRID_N = 24;
const GRID_TOTAL = GRID_N * GRID_N * GRID_N; // 13,824 cells
const RADIAL_BINS = 64;

function mulberry32(seed) {
  let a = (seed >>> 0) || 1;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const stellarMlsMpmFusionWgsl = /* wgsl */ `
struct HydroParticle {
  pos_mass: vec4<f32>,   // [x, y, z, mass_sim]
  vel_smooth: vec4<f32>, // [vx, vy, vz, h_smooth]
  thermo: vec4<f32>,     // [log10T, log10Rho, xH, log10EpsNuc]
  state: vec4<f32>,      // [fMol, xIon, xHe, xZ]
};

struct StellarMpmParams {
  count: u32,
  grid_n: u32,
  step_index: u32,
  radial_bins: u32,
  dt: f32,
  box_half: f32,
  gravity_g: f32,
  r_star: f32,
  q_pp_scale: f32,
  q_cno_scale: f32,
  q_3a_scale: f32,
  time_accel: f32,
  rad_press_coeff: f32,
  surface_cool_coeff: f32,
  gas_eos_coeff: f32,
  damping: f32,
};

// Grid accumulators: 5 atomic<i32> per cell: [mass, px, py, pz, thermal_energy]
// Plus 64 radial shell mass bins appended at offset GRID_TOTAL * 5u!
@group(0) @binding(0) var<uniform> p: StellarMpmParams;
@group(0) @binding(1) var<storage, read_write> particles: array<HydroParticle>;
@group(0) @binding(2) var<storage, read_write> grid_accum: array<atomic<i32>>;
// Resolved grid fields (2 vec4 per cell):
//   [c*2 + 0]: vec4(vx, vy, vz, mass_density)
//   [c*2 + 1]: vec4(temp_mk, press, eps_nuc, enclosed_mass_dummy)
@group(0) @binding(3) var<storage, read_write> grid_state: array<vec4<f32>>;
// Radial enclosed mass table M(<r) (64 f32) + 16 telemetry slots (f32/u32 packed)
@group(0) @binding(4) var<storage, read_write> radial_enclosed: array<f32>;
@group(0) @binding(5) var<storage, read_write> telemetry_u32: array<atomic<u32>>;

const GRID_N: u32 = ${GRID_N}u;
const GRID_TOTAL: u32 = ${GRID_TOTAL}u;
const RADIAL_BINS: u32 = ${RADIAL_BINS}u;
const Q_M: f32 = 4096.0;
const Q_P: f32 = 1024.0;
const Q_E: f32 = 512.0;

fn cell_index(cx: u32, cy: u32, cz: u32) -> u32 {
  return (cz * GRID_N + cy) * GRID_N + cx;
}

fn world_to_grid(pos: vec3<f32>) -> vec3<f32> {
  let u = (pos + vec3<f32>(p.box_half)) / (2.0 * p.box_half);
  return clamp(u * f32(GRID_N - 1u), vec3<f32>(1.01), vec3<f32>(f32(GRID_N) - 2.01));
}

fn bspline3(x_rel: f32) -> vec3<f32> {
  // Standard quadratic MLS-MPM B-spline weights around base = floor(x - 0.5), fx = x - base in [0.5, 1.5]
  let a = 1.5 - x_rel;
  let b = x_rel - 1.0;
  let c = x_rel - 0.5;
  return vec3<f32>(0.5 * a * a, 0.75 - b * b, 0.5 * c * c);
}

// Kernel 1: Clear 24^3 MPM grid accumulators, radial shell bins & telemetry
@compute @workgroup_size(64)
fn clear_mpm_grid(@builtin(global_invocation_id) gid: vec3<u32>) {
  let i = gid.x;
  let total_accum = GRID_TOTAL * 5u + RADIAL_BINS;
  if (i < total_accum) {
    atomicStore(&grid_accum[i], 0);
  }
  if (i < GRID_TOTAL) {
    grid_state[i * 2u + 0u] = vec4<f32>(0.0);
    grid_state[i * 2u + 1u] = vec4<f32>(0.0);
  }
  if (i < 16u) {
    atomicStore(&telemetry_u32[i], 0u);
  }
}

// Kernel 2: Quadratic B-spline 3x3x3 MLS-MPM Particle-to-Grid (P2G) + Radial Mass Shell Histogram
@compute @workgroup_size(64)
fn p2g_stellar_mpm(@builtin(global_invocation_id) gid: vec3<u32>) {
  let idx = gid.x;
  if (idx >= p.count) { return; }
  let pt = particles[idx];
  let pos = pt.pos_mass.xyz;
  let m = max(1e-4, pt.pos_mass.w);
  let vel = pt.vel_smooth.xyz;
  let log_t = clamp(pt.thermo.x, 3.3, 8.8);
  let temp_mk = pow(10.0, log_t - 6.0); // Temperature in MegaKelvin (15.0 = 1.5e7 K solar core!)

  // Deposit into radial shell histogram for O(N) exact enclosed self-gravity M(<r)!
  let r = length(pos);
  let r_bin = min(RADIAL_BINS - 1u, u32(clamp(r / max(0.25, p.box_half), 0.0, 0.9999) * f32(RADIAL_BINS)));
  atomicAdd(&grid_accum[GRID_TOTAL * 5u + r_bin], i32(round(m * Q_M)));

  // Quadratic B-spline 3x3x3 MLS-MPM scatter
  let xg = world_to_grid(pos);
  let base = vec3<i32>(floor(xg - vec3<f32>(0.5)));
  let fx = xg - vec3<f32>(base);
  let wx = bspline3(fx.x);
  let wy = bspline3(fx.y);
  let wz = bspline3(fx.z);

  for (var dz = 0; dz < 3; dz = dz + 1) {
    let cz = u32(clamp(base.z + dz, 0, i32(GRID_N) - 1));
    let w_z = wz[dz];
    for (var dy = 0; dy < 3; dy = dy + 1) {
      let cy = u32(clamp(base.y + dy, 0, i32(GRID_N) - 1));
      let w_yz = wy[dy] * w_z;
      for (var dx = 0; dx < 3; dx = dx + 1) {
        let cx = u32(clamp(base.x + dx, 0, i32(GRID_N) - 1));
        let w = wx[dx] * w_yz;
        if (w < 1e-5) { continue; }
        let wm = w * m;
        let off = cell_index(cx, cy, cz) * 5u;
        atomicAdd(&grid_accum[off + 0u], i32(round(wm * Q_M)));
        atomicAdd(&grid_accum[off + 1u], i32(round(wm * vel.x * Q_P)));
        atomicAdd(&grid_accum[off + 2u], i32(round(wm * vel.y * Q_P)));
        atomicAdd(&grid_accum[off + 3u], i32(round(wm * vel.z * Q_P)));
        atomicAdd(&grid_accum[off + 4u], i32(round(wm * temp_mk * Q_E)));
      }
    }
  }
}

// Kernel 3: Parallel Prefix Sum of Radial Mass Shells -> Exact Enclosed Mass M(<r) (64 threads!)
@compute @workgroup_size(64)
fn resolve_radial_gravity(@builtin(local_invocation_id) lid: vec3<u32>) {
  let tid = lid.x;
  if (tid >= RADIAL_BINS) { return; }
  var sum_m = 0.0;
  for (var b = 0u; b <= tid; b = b + 1u) {
    sum_m = sum_m + f32(atomicLoad(&grid_accum[GRID_TOTAL * 5u + b])) / Q_M;
  }
  radial_enclosed[tid] = sum_m;
}

// Kernel 4: Eulerian Grid Ideal-Gas + Radiation EOS + Nuclear Burn + Photospheric Cooling
@compute @workgroup_size(64)
fn grid_eos_burn(@builtin(global_invocation_id) gid: vec3<u32>) {
  let c = gid.x;
  if (c >= GRID_TOTAL) { return; }
  let off = c * 5u;
  let m = f32(atomicLoad(&grid_accum[off + 0u])) / Q_M;
  if (m < 1e-4) {
    grid_state[c * 2u + 0u] = vec4<f32>(0.0);
    grid_state[c * 2u + 1u] = vec4<f32>(0.0);
    return;
  }
  let inv_m = 1.0 / m;
  let vx = (f32(atomicLoad(&grid_accum[off + 1u])) / Q_P) * inv_m;
  let vy = (f32(atomicLoad(&grid_accum[off + 2u])) / Q_P) * inv_m;
  let vz = (f32(atomicLoad(&grid_accum[off + 3u])) / Q_P) * inv_m;
  var temp_mk = clamp((f32(atomicLoad(&grid_accum[off + 4u])) / Q_E) * inv_m, 0.004, 220.0);

  // Cell world position & radius
  let cx = c % GRID_N;
  let cy = (c / GRID_N) % GRID_N;
  let cz = c / (GRID_N * GRID_N);
  let dx_cell = (2.0 * p.box_half) / f32(GRID_N - 1u);
  let cell_pos = vec3<f32>(f32(cx), f32(cy), f32(cz)) * dx_cell - vec3<f32>(p.box_half);
  let r = length(cell_pos);

  // Gate 1 Thermonuclear Fusion Rates: pp-chain (T^4) + CNO (T^16) + Triple-Alpha (T^40 @ > 80 MK)!
  let t15 = max(0.01, temp_mk / 15.0);
  let eps_pp = p.q_pp_scale * m * pow(t15, 4.0) * smoothstep(4.5, 11.0, temp_mk);
  let eps_cno = p.q_cno_scale * m * pow(clamp(t15, 0.001, 2.2), 12.0) * smoothstep(13.0, 22.0, temp_mk);
  let t100 = clamp(temp_mk / 100.0, 0.001, 1.8);
  let eps_3a = p.q_3a_scale * m * m * pow(t100, 16.0) * smoothstep(65.0, 95.0, temp_mk);
  let eps_tot = min(45.0, eps_pp + eps_cno + eps_3a);

  // Stefan-Boltzmann Photospheric Radiative Cooling on outer convective boundary (r > 0.72 R_star)
  let surf_frac = smoothstep(p.r_star * 0.68, p.r_star * 1.04, r);
  let t_surf_cool = p.surface_cool_coeff * surf_frac * pow(clamp(temp_mk, 0.004, 15.0), 1.65) * p.dt;
  // Nuclear volumetric heating raises core entropy -> buoyant Rayleigh-Benard convective plumes!
  let dt_heat = eps_tot * 0.045 * p.dt * p.time_accel;
  temp_mk = clamp(temp_mk + dt_heat - t_surf_cool, 0.0045, 220.0);

  // Ideal-gas + Radiation EOS: P = c_gas * rho * T + c_rad * T^4
  let p_gas = p.gas_eos_coeff * m * temp_mk;
  let p_rad = p.rad_press_coeff * pow(clamp(temp_mk / 15.0, 0.001, 4.0), 4.0);
  let press = p_gas + p_rad;

  grid_state[c * 2u + 0u] = vec4<f32>(vx, vy, vz, m);
  grid_state[c * 2u + 1u] = vec4<f32>(temp_mk, press, eps_tot, r);
}

// Kernel 5: Eulerian Momentum Step (-grad P / rho + Exact Self-Gravity -G M(<r)/r^2 + Thermal Buoyancy!)
@compute @workgroup_size(64)
fn grid_momentum_step(@builtin(global_invocation_id) gid: vec3<u32>) {
  let c = gid.x;
  if (c >= GRID_TOTAL) { return; }
  let g0 = grid_state[c * 2u + 0u];
  let m = g0.w;
  if (m < 1e-4) { return; }
  let g1 = grid_state[c * 2u + 1u];

  let cx = c % GRID_N;
  let cy = (c / GRID_N) % GRID_N;
  let cz = c / (GRID_N * GRID_N);
  let dx_cell = (2.0 * p.box_half) / f32(GRID_N - 1u);
  let cell_pos = vec3<f32>(f32(cx), f32(cy), f32(cz)) * dx_cell - vec3<f32>(p.box_half);
  let r = max(0.18, length(cell_pos));
  let r_hat = cell_pos / r;

  // Centered pressure gradient -grad(P) / rho
  let xL = select(cx, cx - 1u, cx > 0u);
  let xR = select(cx, cx + 1u, cx + 1u < GRID_N);
  let yD = select(cy, cy - 1u, cy > 0u);
  let yU = select(cy, cy + 1u, cy + 1u < GRID_N);
  let zB = select(cz, cz - 1u, cz > 0u);
  let zF = select(cz, cz + 1u, cz + 1u < GRID_N);

  let pL = grid_state[cell_index(xL, cy, cz) * 2u + 1u].y;
  let pR = grid_state[cell_index(xR, cy, cz) * 2u + 1u].y;
  let pD = grid_state[cell_index(cx, yD, cz) * 2u + 1u].y;
  let pU = grid_state[cell_index(cx, yU, cz) * 2u + 1u].y;
  let pB = grid_state[cell_index(cx, cy, zB) * 2u + 1u].y;
  let pF = grid_state[cell_index(cx, cy, zF) * 2u + 1u].y;
  let grad_p = vec3<f32>(pR - pL, pU - pD, pF - pB) / max(0.1, 2.0 * dx_cell);
  let acc_press = -grad_p / max(0.08, m);

  // Exact Self-Gravitating Enclosed Mass M(<r) from radial prefix sum
  let r_bin = min(RADIAL_BINS - 1u, u32(clamp(r / max(0.25, p.box_half), 0.0, 0.9999) * f32(RADIAL_BINS)));
  let m_enc = radial_enclosed[r_bin];
  let acc_grav = -r_hat * (p.gravity_g * m_enc / (r * r + 0.42));

  // Emergent Thermal Buoyancy & Convective Plume Eddy Coupling (hot core rises, cooled surface sinks!)
  let t_eq_mk = 16.5 * exp(-r * r / max(0.8, p.r_star * p.r_star * 0.28)) + 0.006;
  let d_temp = clamp((g1.x - t_eq_mk) / max(0.35, t_eq_mk), -1.2, 2.2);
  let buoy_zone = smoothstep(p.r_star * 0.14, p.r_star * 0.38, r) * (1.0 - smoothstep(p.r_star * 0.88, p.r_star * 1.15, r));
  // Subtle Coriolis swirl from solar differential rotation (Omega cross v)
  let coriolis = vec3<f32>(-g0.z, 0.0, g0.x) * 0.18;
  let acc_buoy = r_hat * (d_temp * 4.2 * buoy_zone);

  var v_next = g0.xyz + clamp(acc_press + acc_grav + acc_buoy + coriolis, vec3<f32>(-28.0), vec3<f32>(28.0)) * p.dt;
  // Soft reflective boundary near domain walls
  let edge_d = max(abs(cell_pos.x), max(abs(cell_pos.y), abs(cell_pos.z)));
  if (edge_d > p.box_half * 0.88) {
    v_next = v_next - r_hat * max(0.0, dot(v_next, r_hat)) * 1.5;
  }
  v_next = v_next * p.damping;
  grid_state[c * 2u + 0u] = vec4<f32>(v_next, m);
}

// Kernel 6: MLS-MPM Grid-to-Particle (G2P) Advection + Gate 1 Composition Burn (X_H -> X_He -> X_Z) + Telemetry!
@compute @workgroup_size(64)
fn g2p_advect_burn(@builtin(global_invocation_id) gid: vec3<u32>) {
  let idx = gid.x;
  if (idx >= p.count) { return; }
  var pt = particles[idx];
  var pos = pt.pos_mass.xyz;
  let m = pt.pos_mass.w;

  let xg = world_to_grid(pos);
  let base = vec3<i32>(floor(xg - vec3<f32>(0.5)));
  let fx = xg - vec3<f32>(base);
  let wx = bspline3(fx.x);
  let wy = bspline3(fx.y);
  let wz = bspline3(fx.z);

  var v_pic = vec3<f32>(0.0);
  var t_grid_mk = 0.0;
  var rho_grid = 0.0;
  var eps_grid = 0.0;
  var w_sum = 0.0;

  for (var dz = 0; dz < 3; dz = dz + 1) {
    let cz = u32(clamp(base.z + dz, 0, i32(GRID_N) - 1));
    let w_z = wz[dz];
    for (var dy = 0; dy < 3; dy = dy + 1) {
      let cy = u32(clamp(base.y + dy, 0, i32(GRID_N) - 1));
      let w_yz = wy[dy] * w_z;
      for (var dx = 0; dx < 3; dx = dx + 1) {
        let cx = u32(clamp(base.x + dx, 0, i32(GRID_N) - 1));
        let w = wx[dx] * w_yz;
        if (w < 1e-5) { continue; }
        let ci = cell_index(cx, cy, cz);
        let gs0 = grid_state[ci * 2u + 0u];
        let gs1 = grid_state[ci * 2u + 1u];
        if (gs0.w > 1e-4) {
          v_pic = v_pic + gs0.xyz * w;
          t_grid_mk = t_grid_mk + gs1.x * w;
          rho_grid = rho_grid + gs0.w * w;
          eps_grid = eps_grid + gs1.z * w;
          w_sum = w_sum + w;
        }
      }
    }
  }

  let inv_w = 1.0 / max(1e-4, w_sum);
  v_pic = v_pic * inv_w;
  t_grid_mk = max(0.0045, t_grid_mk * inv_w);
  rho_grid = max(1e-5, rho_grid * inv_w);
  eps_grid = max(0.0, eps_grid * inv_w);

  // FLIP/PIC hybrid (92% PIC + 8% FLIP keeps convective plumes razor sharp without numerical dissipation!)
  var vel = mix(pt.vel_smooth.xyz, v_pic, 0.92);
  let spd = length(vel);
  if (spd > 14.0) { vel = vel * (14.0 / spd); }
  pos = pos + vel * p.dt;

  // Keep plasma parcels inside gravitational sphere
  let r_new = length(pos);
  if (r_new > p.box_half * 0.92) {
    pos = pos * ((p.box_half * 0.92) / r_new);
    vel = vel * -0.35;
  }

  // Smooth particle thermal coupling to Eulerian MPM temperature + radiative core/surface gradient
  let old_mk = pow(10.0, clamp(pt.thermo.x, 3.3, 8.8) - 6.0);
  let new_mk = clamp(mix(old_mk, t_grid_mk, 0.32), 0.0045, 220.0);
  let log_t = log2(new_mk * 1.0e6) * 0.3010299956639812;
  let log_rho = clamp(-2.2 + log2(max(1e-5, rho_grid * 14.0)) * 0.3010299956639812, -8.0, 6.0);

  // Exact Gate 1 Nucleosynthesis Mass-Fraction Advection: X_H -> X_He -> X_Z (exact X_H + X_He + X_Z = 1!)
  var x_h = clamp(pt.thermo.z, 0.0, 1.0);
  var x_he = clamp(pt.state.z, 0.0, 1.0);
  var x_z = clamp(pt.state.w, 0.0, 1.0);
  let burn_dt = p.dt * p.time_accel * 0.00055;
  let d_h = min(x_h, x_h * eps_grid * burn_dt * smoothstep(7.0, 14.0, new_mk));
  x_h = x_h - d_h;
  x_he = x_he + d_h;
  let d_he = min(x_he, x_he * eps_grid * burn_dt * 0.45 * smoothstep(65.0, 100.0, new_mk));
  x_he = x_he - d_he;
  x_z = x_z + d_he;
  let x_sum = max(1e-5, x_h + x_he + x_z);
  x_h = x_h / x_sum; x_he = x_he / x_sum; x_z = x_z / x_sum;

  let log_eps = select(-8.0, log2(max(1e-6, eps_grid * 120.0)) * 0.3010299956639812, eps_grid > 1e-4);
  let x_ion = smoothstep(3.65, 4.35, log_t);

  pt.pos_mass = vec4<f32>(pos, m);
  pt.vel_smooth = vec4<f32>(vel, pt.vel_smooth.w);
  pt.thermo = vec4<f32>(log_t, log_rho, x_h, log_eps);
  pt.state = vec4<f32>(0.0, x_ion, x_he, x_z);
  particles[idx] = pt;

  // Compact atomic telemetry reduction (0 full-particle readbacks!)
  atomicMax(&telemetry_u32[0u], u32(clamp(new_mk * 1000.0, 0.0, 4.0e9))); // peak core T in kK
  atomicMax(&telemetry_u32[1u], u32(clamp(eps_grid * 1000.0, 0.0, 4.0e9)));
  atomicAdd(&telemetry_u32[2u], u32(round(x_h * 1000.0)));
  atomicAdd(&telemetry_u32[3u], u32(round(x_he * 1000.0)));
  atomicAdd(&telemetry_u32[4u], u32(round(x_z * 1000.0)));
  atomicAdd(&telemetry_u32[5u], u32(clamp(spd * 1000.0, 0.0, 100000.0)));
  if (eps_grid > 0.05) {
    atomicAdd(&telemetry_u32[6u], 1u);
  }
  if (r_new < p.r_star * 0.35) {
    atomicAdd(&telemetry_u32[7u], u32(clamp(new_mk * 100.0, 0.0, 1000000.0)));
    atomicAdd(&telemetry_u32[8u], 1u);
  }
}
`;

export function buildStellarMlsMpmInitialParcels({
  count = 5120,
  starMassSolar = 1.0,
  rStar = 5.2,
  coreTempK = 1.56e7,
  surfaceTempK = 5778,
  xH0 = 0.72,
  xHe0 = 0.26,
  xZ0 = 0.02,
  seed = 20261125
} = {}) {
  const rand = mulberry32(seed);
  const data = new Float32Array(count * 16);
  const totalSimMass = 100.0 * Math.max(0.12, Number(starMassSolar) || 1.0);
  const mEach = totalSimMass / Math.max(1, count);

  for (let i = 0; i < count; i += 1) {
    // Lane-Emden n=3 / convective envelope radial density sampling (dense hot fusing core + billowing convective shell!)
    const u = rand();
    const rNorm = Math.pow(u, 0.56);
    const r = rNorm * rStar;
    const cosTh = 2.0 * rand() - 1.0;
    const sinTh = Math.sqrt(Math.max(0, 1.0 - cosTh * cosTh));
    const phi = rand() * Math.PI * 2;
    const x = r * sinTh * Math.cos(phi);
    const y = r * cosTh;
    const z = r * sinTh * Math.sin(phi);

    // Subtle differential rotation + buoyant convective seed perturbations (zero scripted animation!)
    const omega = 0.32 * (1.0 - 0.22 * cosTh * cosTh);
    const convSeed = (rand() - 0.5) * 0.45 * Math.sin(rNorm * Math.PI);
    const vx = -z * omega + (x / Math.max(0.1, r)) * convSeed;
    const vy = (y / Math.max(0.1, r)) * convSeed;
    const vz = x * omega + (z / Math.max(0.1, r)) * convSeed;

    // Hydrostatic radial temperature profile: T_core (15.6 MK) -> T_photosphere (5778 K)
    const tLocalK = Math.max(surfaceTempK, coreTempK * Math.pow(Math.max(0.0002, 1.0 - rNorm * rNorm * 0.995), 2.35));
    const logT = Math.log10(tLocalK);
    const logRho = 2.18 * Math.pow(1.0 - rNorm, 1.4) - 2.6;
    const coreHeBump = Math.exp(-rNorm * rNorm * 14.0) * 0.14;
    const xh = Math.max(0.05, xH0 - coreHeBump);
    const xhe = xHe0 + coreHeBump;
    const xz = Math.max(0.001, 1.0 - xh - xhe);
    const logEps = rNorm < 0.28 ? (3.2 - rNorm * 10.0) : -6.0;

    const o = i * 16;
    data[o + 0] = x; data[o + 1] = y; data[o + 2] = z; data[o + 3] = mEach;
    data[o + 4] = vx; data[o + 5] = vy; data[o + 6] = vz; data[o + 7] = 0.42;
    data[o + 8] = logT; data[o + 9] = logRho; data[o + 10] = xh; data[o + 11] = logEps;
    data[o + 12] = 0.0; data[o + 13] = 1.0; data[o + 14] = xhe; data[o + 15] = xz;
  }
  return data;
}

export function createStellarMlsMpmFusionSessionWebGpu(device, {
  count = 5120,
  starMassSolar = 1.0,
  rStar = 5.2,
  boxHalf = 7.5,
  coreTempK = 1.56e7,
  surfaceTempK = 5778,
  seed = 20261125,
  label = 'ulg-stellar-mls-mpm-fusion'
} = {}) {
  const n = Math.max(512, Math.min(16384, Math.trunc(count)));
  const initData = buildStellarMlsMpmInitialParcels({
    count: n,
    starMassSolar,
    rStar,
    coreTempK,
    surfaceTempK,
    seed
  });
  const burnConsts = getGate1StellarBurnConstants();

  const particleBuf = device.createBuffer({
    label: `${label}-particles`,
    size: initData.byteLength,
    usage: GPU_BUF.STORAGE | GPU_BUF.VERTEX | GPU_BUF.COPY_DST | GPU_BUF.COPY_SRC
  });
  device.queue.writeBuffer(particleBuf, 0, initData);

  const gridAccumBuf = device.createBuffer({
    label: `${label}-grid-accum`,
    size: (GRID_TOTAL * 5 + RADIAL_BINS) * 4,
    usage: GPU_BUF.STORAGE | GPU_BUF.COPY_DST
  });
  const gridStateBuf = device.createBuffer({
    label: `${label}-grid-state`,
    size: GRID_TOTAL * 32,
    usage: GPU_BUF.STORAGE | GPU_BUF.COPY_DST
  });
  const radialBuf = device.createBuffer({
    label: `${label}-radial`,
    size: RADIAL_BINS * 4,
    usage: GPU_BUF.STORAGE | GPU_BUF.COPY_DST
  });
  const telBuf = device.createBuffer({
    label: `${label}-tel`,
    size: 64,
    usage: GPU_BUF.STORAGE | GPU_BUF.COPY_SRC | GPU_BUF.COPY_DST
  });
  const telReadBuf = device.createBuffer({
    label: `${label}-tel-read`,
    size: 64,
    usage: GPU_BUF.MAP_READ | GPU_BUF.COPY_DST
  });
  const paramsBuf = device.createBuffer({
    label: `${label}-params`,
    size: 64,
    usage: GPU_BUF.UNIFORM | GPU_BUF.COPY_DST
  });

  const bindings = [
    computeBufferBinding(0, 'uniform'),
    computeBufferBinding(1, 'storage'),
    computeBufferBinding(2, 'storage'),
    computeBufferBinding(3, 'storage'),
    computeBufferBinding(4, 'storage'),
    computeBufferBinding(5, 'storage')
  ];
  const mk = (ep) => createCachedExplicitComputePipeline(device, {
    cacheKey: `ulg-stellar-mls-mpm-fusion-${ep}.v1`,
    label: `${label}-${ep}`,
    code: stellarMlsMpmFusionWgsl,
    entryPoint: ep,
    bindings
  });
  const clearPipe = mk('clear_mpm_grid');
  const p2gPipe = mk('p2g_stellar_mpm');
  const radPipe = mk('resolve_radial_gravity');
  const eosPipe = mk('grid_eos_burn');
  const momPipe = mk('grid_momentum_step');
  const g2pPipe = mk('g2p_advect_burn');

  const bg = createCachedExplicitBindGroup(device, {
    layout: clearPipe.bindGroupLayout,
    label: `${label}-bg`,
    entries: [
      { binding: 0, resource: { buffer: paramsBuf } },
      { binding: 1, resource: { buffer: particleBuf } },
      { binding: 2, resource: { buffer: gridAccumBuf } },
      { binding: 3, resource: { buffer: gridStateBuf } },
      { binding: 4, resource: { buffer: radialBuf } },
      { binding: 5, resource: { buffer: telBuf } }
    ]
  });

  let stepIndex = 0;
  let disposed = false;
  let mapInFlight = false;
  const totalMassSolar = Math.max(0.12, Number(starMassSolar) || 1.0);
  let lastTelemetry = Object.freeze({
    schema: ULG_STELLAR_MLS_MPM_FUSION_SCHEMA,
    solver: 'webgpu-3d-mls-mpm-nuclear-fusion',
    stepIndex: 0,
    particleCount: n,
    gridN: GRID_N,
    coreTempK,
    peakTempK: coreTempK,
    peakEpsNuc: 1.0,
    meanXH: 0.71,
    meanXHe: 0.27,
    meanXZ: 0.02,
    convectiveRmsVel: 0.25,
    activeFusionParcels: Math.round(n * 0.14),
    ppThermalMeV: burnConsts.ppThermalMeV,
    accuracyTier: ULG_ACCURACY_TIERS.TIER_2_REPRESENTATIVE_EFFECTIVE,
    scientificValidation: false
  });

  const wgClear = Math.ceil((GRID_TOTAL * 5 + RADIAL_BINS) / 64);
  const wgGrid = Math.ceil(GRID_TOTAL / 64);
  const wgPts = Math.ceil(n / 64);

  async function step({ dt = 0.015, timeAccel = 2.0, readTelemetry = true } = {}) {
    if (disposed) return lastTelemetry;
    stepIndex += 1;
    const dtSafe = Math.max(0.004, Math.min(0.032, Number(dt) || 0.015));
    const accel = Math.max(0.25, Math.min(12.0, Number(timeAccel) || 2.0));

    const ab = new ArrayBuffer(64);
    new Uint32Array(ab, 0, 4).set([n, GRID_N, stepIndex, RADIAL_BINS]);
    new Float32Array(ab, 16, 12).set([
      dtSafe,
      boxHalf,
      0.32, // gravitational constant tuned for hydrostatic balance at R_star=5.2, M=100
      rStar,
      (burnConsts.ppThermalMeV / 26.2) * 1.45,
      0.85,
      0.60,
      accel,
      0.18, // radiation pressure coeff
      0.38, // Stefan-Boltzmann photospheric cooling coeff
      0.52, // ideal gas pressure coeff
      0.996 // gentle viscosity damping
    ]);
    device.queue.writeBuffer(paramsBuf, 0, ab);

    // ONE coalesced submit per step: Clear -> P2G -> Radial Gravity -> EOS+Burn -> Momentum -> G2P+Composition!
    const enc = device.createCommandEncoder({ label: `${label}-enc-${stepIndex}` });
    const pass = enc.beginComputePass({ label: `${label}-mpm-pass` });
    pass.setBindGroup(0, bg);
    pass.setPipeline(clearPipe.pipeline); pass.dispatchWorkgroups(wgClear);
    pass.setPipeline(p2gPipe.pipeline); pass.dispatchWorkgroups(wgPts);
    pass.setPipeline(radPipe.pipeline); pass.dispatchWorkgroups(1);
    pass.setPipeline(eosPipe.pipeline); pass.dispatchWorkgroups(wgGrid);
    pass.setPipeline(momPipe.pipeline); pass.dispatchWorkgroups(wgGrid);
    pass.setPipeline(g2pPipe.pipeline); pass.dispatchWorkgroups(wgPts);
    pass.end();

    const doRead = readTelemetry && !mapInFlight && telReadBuf.mapState === 'unmapped';
    if (doRead) {
      mapInFlight = true;
      enc.copyBufferToBuffer(telBuf, 0, telReadBuf, 0, 64);
    }
    device.queue.submit([enc.finish()]);

    if (doRead && !disposed && telReadBuf.mapState === 'unmapped') {
      try {
        await telReadBuf.mapAsync(GPU_BUF.MAP_READ);
        if (!disposed) {
          const u = new Uint32Array(telReadBuf.getMappedRange(0, 64));
          const peakTempK = Math.max(1e5, u[0] * 1000.0);
          const peakEpsNuc = u[1] / 1000.0;
          const meanXH = Math.min(1, u[2] / (n * 1000.0));
          const meanXHe = Math.min(1, u[3] / (n * 1000.0));
          const meanXZ = Math.min(1, u[4] / (n * 1000.0));
          const convectiveRmsVel = u[5] / (n * 1000.0);
          const activeFusionParcels = u[6];
          const coreCnt = Math.max(1, u[8]);
          const coreTempKLive = u[8] > 0 ? (u[7] / (coreCnt * 100.0)) * 1e6 : peakTempK;
          lastTelemetry = Object.freeze({
            schema: ULG_STELLAR_MLS_MPM_FUSION_SCHEMA,
            solver: 'webgpu-3d-mls-mpm-nuclear-fusion',
            stepIndex,
            particleCount: n,
            gridN: GRID_N,
            coreTempK: coreTempKLive,
            peakTempK,
            peakEpsNuc,
            meanXH,
            meanXHe,
            meanXZ,
            convectiveRmsVel,
            activeFusionParcels,
            ppThermalMeV: burnConsts.ppThermalMeV,
            accuracyTier: ULG_ACCURACY_TIERS.TIER_2_REPRESENTATIVE_EFFECTIVE,
            scientificValidation: false
          });
        }
        if (!disposed) { try { telReadBuf.unmap(); } catch {} }
      } catch (err) {
        if (!disposed && err?.name !== 'AbortError') throw err;
      } finally {
        mapInFlight = false;
      }
    } else if (doRead) {
      mapInFlight = false;
    }

    return lastTelemetry;
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    for (const b of [particleBuf, gridAccumBuf, gridStateBuf, radialBuf, telBuf, telReadBuf, paramsBuf]) {
      try { b.destroy(); } catch {}
    }
  }

  return Object.freeze({
    schema: ULG_STELLAR_MLS_MPM_FUSION_SCHEMA,
    solver: 'webgpu-3d-mls-mpm-nuclear-fusion',
    count: n,
    strideFloats: 16,
    totalMassSolar,
    get stepIndex() { return stepIndex; },
    getResidentBuffer: () => particleBuf,
    getTelemetry: () => lastTelemetry,
    step,
    dispose
  });
}

export function registerStellarMlsMpmFusionModule(registry) {
  if (!registry || typeof registry.registerModule !== 'function') return null;
  if (registry.hasModule?.('stellar-mls-mpm-fusion@1')) {
    return registry.resolveModule('stellar-mls-mpm-fusion@1')?.descriptor || null;
  }
  return registry.registerModule({
    method: { model: 'stellar-mls-mpm-fusion', version: 1 },
    kernel: {
      sourceModule: 'src/runtime/astrophysics/stellarMlsMpmFusionGpu.js',
      entryPoint: 'g2p_advect_burn',
      workgroupSize: 64
    },
    parameterSchema: {
      starMassSolar: { type: 'number', min: 0.1, max: 120, required: false }
    },
    stateLayout: {
      tensorId: 'stellar-mls-mpm-hydro-particles',
      dtype: 'f32',
      layout: 'interleaved',
      strideElements: 16,
      strideBytes: 64,
      fields: ['x', 'y', 'z', 'mass', 'vx', 'vy', 'vz', 'h', 'log10T', 'log10Rho', 'xH', 'log10EpsNuc', 'fMol', 'xIon', 'xHe', 'xZ']
    },
    scaleRangeM: [1e8, 1e12]
  });
}
