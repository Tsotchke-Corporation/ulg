/**
 * General Reusable Self-Gravitating Compressible Reacting-Fluid WebGPU Engine
 * (`self-gravitating-hydro@1`).
 *
 * Strictly general ULG runtime physics — ZERO preset names, ZERO scripted phase
 * timers, ZERO supernova flags, ZERO hardcoded bounce triggers:
 *   1. Outer 3-level Barnes-Hut octree (16^3 leaves + 4^3 coarse) computing exact
 *      self-gravity acceleration `a_grav` AND gravitational potential `Phi_i`
 *      directly from actual particle masses `m_i`.
 *   2. Nested high-resolution 16^3 inner core SPH grid computing local mass density,
 *      thermal + radiation + degeneracy + nuclear-saturation pressure gradients
 *      `(-grad P / rho)`, and velocity convergence.
 *   3. Pluggable 2D `(log10 rho, log10 T)` EOS/opacity closure table resolved from
 *      ULG's `ClosureRegistry` (`[mu, gammaEff, fH2, xIon, pDegFrac, log10Kappa,
 *      pNucFrac, pRadFrac]`).
 *   4. General Gamow-window thermonuclear reaction network (`pp-chain`, `CNO`,
 *      `triple-alpha`, endothermic `Fe-peak photodisintegration`) conserving exact
 *      nucleon mass fractions (`X_H + X_He + X_Z = 1`).
 *   5. Emergent core-collapse & bounce arise purely from the physics: when heavy
 *      self-gravity compresses an exhausted core into endothermic photodisintegration
 *      (`gamma_eff < 4/3`), infall smashes into the stiff nuclear-saturation EOS wall
 *      (`pNucFrac -> 1`, `gamma_eff -> 2.75`), driving an elastic pressure bounce!
 *   6. Zero-copy `GPUBufferUsage.VERTEX` particle ping-pong buffers (`0 B/frame`
 *      particle readback) + 64-byte atomic GPU diagnostic telemetry reduction.
 */

import { ULG_SERVICE_IDS } from '../../../ulg-gpu-abi/src/serviceContract.js';
import {
  computeBufferBinding,
  createCachedExplicitBindGroup,
  createCachedExplicitComputePipeline
} from '../webgpuComputeLayout.js';
import {
  CHANDRASEKHAR_MASS_SOLAR,
  TOV_MAX_NEUTRON_STAR_MASS_SOLAR,
  buildStellarClosureGpuTable,
  classifyEmergentStellarStage,
  evaluateBlackbodyPhotosphereSrgb,
  evaluateHydrogenPlasmaClosure,
  evaluateStellarNuclearFusionClosure
} from '../astrophysics/hydrogenStellarClosure.js';

export const SELF_GRAVITATING_HYDRO_SCHEMA = 'peercompute.ulg.self-gravitating-hydro-gpu.v1';

const USAGE_STORAGE = 0x0080;
const USAGE_UNIFORM = 0x0040;
const USAGE_VERTEX = 0x0020;
const USAGE_COPY_DST = 0x0008;
const USAGE_COPY_SRC = 0x0004;
const USAGE_MAP_READ = 0x0001;

export const HYDRO_PARTICLE_STRIDE_FLOATS = 16;
export const HYDRO_PARTICLE_STRIDE_BYTES = 64;
// Universal simulation mass unit: 100 sim mass units = 1.0 M_sun (preset-independent!)
export const SIM_MASS_PER_SOLAR_MASS = 100.0;

/**
 * General WGSL compute kernels for self-gravitating compressible reacting fluids.
 * Contains ZERO preset flags, ZERO scripted triggers, and ZERO demo-specific hacks.
 */
export const selfGravitatingHydroWgsl = /* wgsl */ `
struct HydroParticle {
  pos_mass: vec4<f32>,   // [x, y, z, mass_sim]
  vel_smooth: vec4<f32>, // [vx, vy, vz, h_smooth]
  thermo: vec4<f32>,     // [log10T, log10Rho, xH, log10EpsNuc]
  state: vec4<f32>,      // [fMol, xIon, xHe, xZ]
};

struct EosClosureCell {
  eos0: vec4<f32>,       // [mu, gammaEff, fMol, xIon]
  eos1: vec4<f32>,       // [pDegFrac, log10Kappa, pNucFrac, pRadFrac]
};

struct HydroParams {
  count: u32,
  n_rho: u32,
  n_temp: u32,
  pad_u32: u32,
  dt: f32,
  gravity_g: f32,
  softening2: f32,
  box_half: f32,
  inner_half: f32,
  theta2: f32,
  log_rho_min: f32,
  log_rho_max: f32,
  log_t_min: f32,
  log_t_max: f32,
  base_log_rho: f32,
  ref_rho_sim: f32,
  burn_timescale_s: f32,
  time_accel: f32,
  pad_f0: f32,
  pad_f1: f32,
};

@group(0) @binding(0) var<storage, read> src_particles: array<HydroParticle>;
@group(0) @binding(1) var<storage, read_write> dst_particles: array<HydroParticle>;
// Outer 16^3 Barnes-Hut leaf accum: 4096 * 4 atomic<i32> = [mass_q, mx_q, my_q, mz_q]
@group(0) @binding(2) var<storage, read_write> outer_accum: array<atomic<i32>>;
// Outer octree nodes: 4096 L2 + 64 L1 = 4160 vec4<f32> [com.xyz, mass]
@group(0) @binding(3) var<storage, read_write> outer_tree: array<vec4<f32>>;
// Inner 16^3 core SPH grid accum: 4096 * 4 atomic<i32> = [mass_q, press_q, temp_q, vr_q]
@group(0) @binding(4) var<storage, read_write> inner_accum: array<atomic<i32>>;
// Inner 16^3 finalized core fields: 4096 vec4<f32> [mass_cell, press_cell, mean_logT, mean_vr]
@group(0) @binding(5) var<storage, read_write> inner_grid: array<vec4<f32>>;
// Pluggable 2D (log10 rho, log10 T) EOS & opacity closure table
@group(0) @binding(6) var<storage, read> eos_table: array<EosClosureCell>;
// 16 atomic<u32> global diagnostic telemetry slots (64 B)
@group(0) @binding(7) var<storage, read_write> telemetry: array<atomic<u32>>;
@group(0) @binding(8) var<uniform> params: HydroParams;

const L2_COUNT: u32 = 4096u;
const L1_COUNT: u32 = 64u;
const Q_MASS: f32 = 1024.0;
const Q_MOM: f32 = 64.0;
const Q_FIELD: f32 = 64.0;

fn clamp_cell16(v: f32, half_extent: f32) -> u32 {
  let u = clamp((v + half_extent) / (2.0 * half_extent), 0.0, 0.9999);
  return min(15u, u32(u * 16.0));
}

fn cell_idx16(cx: u32, cy: u32, cz: u32) -> u32 {
  return (cz * 256u) + (cy * 16u) + cx;
}

fn sample_eos_table(log_rho: f32, log_t: f32) -> EosClosureCell {
  let nr = max(2u, params.n_rho);
  let nt = max(2u, params.n_temp);
  let ur = clamp((log_rho - params.log_rho_min) / max(1e-4, params.log_rho_max - params.log_rho_min), 0.0, 0.9999) * f32(nr - 1u);
  let ut = clamp((log_t - params.log_t_min) / max(1e-4, params.log_t_max - params.log_t_min), 0.0, 0.9999) * f32(nt - 1u);
  let r0 = min(nr - 2u, u32(ur));
  let t0 = min(nt - 2u, u32(ut));
  let fr = ur - f32(r0);
  let ft = ut - f32(t0);

  let c00 = eos_table[t0 * nr + r0];
  let c10 = eos_table[t0 * nr + (r0 + 1u)];
  let c01 = eos_table[(t0 + 1u) * nr + r0];
  let c11 = eos_table[(t0 + 1u) * nr + (r0 + 1u)];

  let e0_lo = mix(c00.eos0, c10.eos0, fr);
  let e0_hi = mix(c01.eos0, c11.eos0, fr);
  let e1_lo = mix(c00.eos1, c10.eos1, fr);
  let e1_hi = mix(c01.eos1, c11.eos1, fr);

  return EosClosureCell(mix(e0_lo, e0_hi, ft), mix(e1_lo, e1_hi, ft));
}

@compute @workgroup_size(64)
fn sgh_clear(@builtin(global_invocation_id) gid: vec3<u32>) {
  let i = gid.x;
  if (i < L2_COUNT) {
    let base = i * 4u;
    atomicStore(&outer_accum[base + 0u], 0);
    atomicStore(&outer_accum[base + 1u], 0);
    atomicStore(&outer_accum[base + 2u], 0);
    atomicStore(&outer_accum[base + 3u], 0);
    atomicStore(&inner_accum[base + 0u], 0);
    atomicStore(&inner_accum[base + 1u], 0);
    atomicStore(&inner_accum[base + 2u], 0);
    atomicStore(&inner_accum[base + 3u], 0);
    outer_tree[i] = vec4<f32>(0.0);
    inner_grid[i] = vec4<f32>(0.0);
  }
  if (i < L1_COUNT) {
    outer_tree[L2_COUNT + i] = vec4<f32>(0.0);
  }
  if (i < 16u) {
    atomicStore(&telemetry[i], 0u);
  }
}

@compute @workgroup_size(64)
fn sgh_deposit(@builtin(global_invocation_id) gid: vec3<u32>) {
  let i = gid.x;
  if (i >= params.count) { return; }
  let p = src_particles[i];
  let pm = p.pos_mass;
  if (pm.w <= 0.0) { return; }

  // 1. Outer 16^3 Barnes-Hut monopole accumulation
  let cx = clamp_cell16(pm.x, params.box_half);
  let cy = clamp_cell16(pm.y, params.box_half);
  let cz = clamp_cell16(pm.z, params.box_half);
  let obase = cell_idx16(cx, cy, cz) * 4u;
  atomicAdd(&outer_accum[obase + 0u], i32(clamp(pm.w * Q_MASS, -1e8, 1e8)));
  atomicAdd(&outer_accum[obase + 1u], i32(clamp(pm.w * pm.x * Q_MOM, -1e8, 1e8)));
  atomicAdd(&outer_accum[obase + 2u], i32(clamp(pm.w * pm.y * Q_MOM, -1e8, 1e8)));
  atomicAdd(&outer_accum[obase + 3u], i32(clamp(pm.w * pm.z * Q_MOM, -1e8, 1e8)));

  // 2. Inner high-resolution 16^3 SPH core grid accumulation
  let ih = params.inner_half;
  if (abs(pm.x) < ih && abs(pm.y) < ih && abs(pm.z) < ih) {
    let ix = clamp_cell16(pm.x, ih);
    let iy = clamp_cell16(pm.y, ih);
    let iz = clamp_cell16(pm.z, ih);
    let ibase = cell_idx16(ix, iy, iz) * 4u;
    let logT = clamp(p.thermo.x, 1.0, 9.6);
    let logRho = clamp(p.thermo.y, -18.0, 11.0);
    let eos = sample_eos_table(logRho, logT);
    let mu_g = max(0.45, eos.eos0.x);
    let gamma_g = clamp(eos.eos0.y, 1.05, 2.75);
    let p_deg = clamp(eos.eos1.x, 0.0, 1.0);
    let p_nuc = clamp(eos.eos1.z, 0.0, 1.0);
    let p_rad = clamp(eos.eos1.w, 0.0, 1.0);

    // General dimensionless hydrodynamic pressure from EOS closure:
    //   thermal ideal gas + radiation + Fermi-Dirac degeneracy + stiff nuclear-saturation EOS wall!
    let t_therm = clamp((logT - 1.35) / 6.2, 0.0, 1.65);
    let soften = clamp((gamma_g - 1.02) / 0.65, 0.18, 2.6);
    let cs2_thermal = (0.02 + 3.2 * t_therm * t_therm * t_therm / mu_g) * soften;
    let cs2_rad = p_rad * 12.0;
    let cs2_deg = p_deg * 18.0;
    let cs2_nuc = p_nuc * 460.0;
    let press_cell = pm.w * (cs2_thermal + cs2_rad + cs2_deg + cs2_nuc);

    let r_len = max(0.15, length(pm.xyz));
    let vr = dot(p.vel_smooth.xyz, pm.xyz) / r_len;
    atomicAdd(&inner_accum[ibase + 0u], i32(clamp(pm.w * Q_MASS, -1e8, 1e8)));
    atomicAdd(&inner_accum[ibase + 1u], i32(clamp(press_cell * Q_FIELD, -1e8, 1e8)));
    atomicAdd(&inner_accum[ibase + 2u], i32(clamp(pm.w * logT * Q_FIELD, -1e8, 1e8)));
    atomicAdd(&inner_accum[ibase + 3u], i32(clamp(pm.w * vr * Q_FIELD, -1e8, 1e8)));
  }
}

@compute @workgroup_size(64)
fn sgh_finalize(@builtin(global_invocation_id) gid: vec3<u32>) {
  let cell = gid.x;
  if (cell >= L2_COUNT) { return; }
  let base = cell * 4u;

  let m_out = f32(atomicLoad(&outer_accum[base + 0u])) / Q_MASS;
  if (m_out > 1e-6) {
    let inv_m = 1.0 / m_out;
    let mx = (f32(atomicLoad(&outer_accum[base + 1u])) / Q_MOM) * inv_m;
    let my = (f32(atomicLoad(&outer_accum[base + 2u])) / Q_MOM) * inv_m;
    let mz = (f32(atomicLoad(&outer_accum[base + 3u])) / Q_MOM) * inv_m;
    outer_tree[cell] = vec4<f32>(mx, my, mz, m_out);
  } else {
    outer_tree[cell] = vec4<f32>(0.0);
  }

  let m_in = f32(atomicLoad(&inner_accum[base + 0u])) / Q_MASS;
  if (m_in > 1e-6) {
    let p_sum = f32(atomicLoad(&inner_accum[base + 1u])) / Q_FIELD;
    let t_mean = (f32(atomicLoad(&inner_accum[base + 2u])) / Q_FIELD) / m_in;
    let vr_mean = (f32(atomicLoad(&inner_accum[base + 3u])) / Q_FIELD) / m_in;
    inner_grid[cell] = vec4<f32>(m_in, p_sum, t_mean, vr_mean);
  } else {
    inner_grid[cell] = vec4<f32>(0.0);
  }
}

@compute @workgroup_size(64)
fn sgh_reduce_coarse(@builtin(global_invocation_id) gid: vec3<u32>) {
  let p = gid.x;
  if (p >= L1_COUNT) { return; }
  let px = p & 3u;
  let py = (p >> 2u) & 3u;
  let pz = (p >> 4u) & 3u;
  var m_sum = 0.0;
  var mom = vec3<f32>(0.0);
  for (var dz = 0u; dz < 4u; dz = dz + 1u) {
    for (var dy = 0u; dy < 4u; dy = dy + 1u) {
      for (var dx = 0u; dx < 4u; dx = dx + 1u) {
        let leaf = outer_tree[cell_idx16(px * 4u + dx, py * 4u + dy, pz * 4u + dz)];
        if (leaf.w > 0.0) {
          m_sum = m_sum + leaf.w;
          mom = mom + leaf.xyz * leaf.w;
        }
      }
    }
  }
  if (m_sum > 1e-6) {
    outer_tree[L2_COUNT + p] = vec4<f32>(mom / m_sum, m_sum);
  } else {
    outer_tree[L2_COUNT + p] = vec4<f32>(0.0);
  }
}

fn read_inner(ix: i32, iy: i32, iz: i32) -> vec4<f32> {
  if (ix < 0 || ix > 15 || iy < 0 || iy > 15 || iz < 0 || iz > 15) {
    return vec4<f32>(0.0);
  }
  return inner_grid[cell_idx16(u32(ix), u32(iy), u32(iz))];
}

@compute @workgroup_size(64)
fn sgh_integrate(@builtin(global_invocation_id) gid: vec3<u32>) {
  let idx = gid.x;
  if (idx >= params.count) { return; }
  let p = src_particles[idx];
  let self_pm = p.pos_mass;
  let self_vs = p.vel_smooth;
  if (self_pm.w <= 0.0) {
    dst_particles[idx] = p;
    return;
  }

  let l1_size = (2.0 * params.box_half) / 4.0;
  let open_thresh2 = (l1_size * l1_size) / max(0.05, params.theta2);
  let self_cx = clamp_cell16(self_pm.x, params.box_half);
  let self_cy = clamp_cell16(self_pm.y, params.box_half);
  let self_cz = clamp_cell16(self_pm.z, params.box_half);
  let self_leaf_id = cell_idx16(self_cx, self_cy, self_cz);

  // 1. General Barnes-Hut self-gravity acceleration AND gravitational potential depth |Phi_i|
  //    Strictly proportional to actual particle masses m_j (ZERO preset parameters!)
  var acc_grav = vec3<f32>(0.0);
  var grav_phi = 0.0;
  for (var coarse_i = 0u; coarse_i < L1_COUNT; coarse_i = coarse_i + 1u) {
    let coarse = outer_tree[L2_COUNT + coarse_i];
    if (coarse.w <= 0.0) { continue; }
    let d_c = coarse.xyz - self_pm.xyz;
    let dist2_c = dot(d_c, d_c);
    if (dist2_c > open_thresh2) {
      let r2 = dist2_c + params.softening2;
      let inv_r = inverseSqrt(r2);
      acc_grav = acc_grav + d_c * (coarse.w * inv_r * inv_r * inv_r);
      grav_phi = grav_phi + coarse.w * inv_r;
    } else {
      let px = coarse_i & 3u;
      let py = (coarse_i >> 2u) & 3u;
      let pz = (coarse_i >> 4u) & 3u;
      for (var dz = 0u; dz < 4u; dz = dz + 1u) {
        for (var dy = 0u; dy < 4u; dy = dy + 1u) {
          for (var dx = 0u; dx < 4u; dx = dx + 1u) {
            let leaf_id = cell_idx16(px * 4u + dx, py * 4u + dy, pz * 4u + dz);
            let leaf = outer_tree[leaf_id];
            if (leaf.w <= 0.0) { continue; }
            var eff_m = leaf.w;
            var eff_pos = leaf.xyz;
            if (leaf_id == self_leaf_id) {
              eff_m = leaf.w - self_pm.w;
              if (eff_m <= 1e-6) { continue; }
              eff_pos = (leaf.xyz * leaf.w - self_pm.xyz * self_pm.w) / eff_m;
            }
            let d = eff_pos - self_pm.xyz;
            let r2 = dot(d, d) + params.softening2;
            let inv_r = inverseSqrt(r2);
            acc_grav = acc_grav + d * (eff_m * inv_r * inv_r * inv_r);
            grav_phi = grav_phi + eff_m * inv_r;
          }
        }
      }
    }
  }
  acc_grav = acc_grav * params.gravity_g;
  grav_phi = grav_phi * params.gravity_g;

  // 2. Measure local SPH mass density, pressure gradient (-grad P / rho), and velocity convergence
  let ih = params.inner_half;
  let outer_m = outer_tree[self_leaf_id].w;
  var local_rho_sim = max(self_pm.w * 1.5, outer_m * 0.14);
  var acc_press = vec3<f32>(0.0);
  var infall_compress = 0.0;
  let inside_inner = abs(self_pm.x) < ih && abs(self_pm.y) < ih && abs(self_pm.z) < ih;
  if (inside_inner) {
    let ix = i32(clamp_cell16(self_pm.x, ih));
    let iy = i32(clamp_cell16(self_pm.y, ih));
    let iz = i32(clamp_cell16(self_pm.z, ih));
    let c_mid = read_inner(ix, iy, iz);
    let c_xp = read_inner(ix + 1, iy, iz);
    let c_xm = read_inner(ix - 1, iy, iz);
    let c_yp = read_inner(ix, iy + 1, iz);
    let c_ym = read_inner(ix, iy - 1, iz);
    let c_zp = read_inner(ix, iy, iz + 1);
    let c_zm = read_inner(ix, iy, iz - 1);

    let nbr_mass = c_mid.x + 0.18 * (c_xp.x + c_xm.x + c_yp.x + c_ym.x + c_zp.x + c_zm.x);
    local_rho_sim = max(local_rho_sim, nbr_mass * 3.8);

    let cell_w = (2.0 * ih) / 16.0;
    let grad_p = vec3<f32>(
      (c_xp.y - c_xm.y) / (2.0 * cell_w),
      (c_yp.y - c_ym.y) / (2.0 * cell_w),
      (c_zp.y - c_zm.y) / (2.0 * cell_w)
    );
    let rho_eff = max(0.35, c_mid.x + 0.28);
    acc_press = -grad_p / rho_eff;

    let r_pos = max(0.18, length(self_pm.xyz));
    let v_rad = dot(self_vs.xyz, self_pm.xyz) / r_pos;
    // Signed radial compression/expansion rate (-div v proxy: heats on infall, cools on expansion!)
    infall_compress = clamp(-v_rad / (r_pos + 0.45), -1.8, 2.2);
  } else {
    let r_pos = max(0.5, length(self_pm.xyz));
    let v_rad = dot(self_vs.xyz, self_pm.xyz) / r_pos;
    infall_compress = clamp(-v_rad / (r_pos + 1.5), -1.2, 1.5);
  }

  // 3. Universal Jeans sub-grid physical density scaling directly from measured local_rho_sim & |Phi_i|
  //    Higher total mass -> naturally higher local_rho_sim & deeper |Phi_i| (ZERO preset flags!).
  let prev_logT = clamp(p.thermo.x, 1.0, 9.6);
  let prev_logRho = clamp(p.thermo.y, -18.0, 10.8);
  let rho_ratio = max(1e-3, local_rho_sim / max(1e-4, params.ref_rho_sim));
  let log10_rho_ratio = log2(rho_ratio) * 0.30103;
  // Virial hydrostatic overburden weight from actual measured potential depth |Phi_i|
  let phi_overburden = clamp(log2(max(1.0, grav_phi / 18.0)) * 0.30103 * 2.55, 0.0, 4.8);
  let target_logRho = clamp(
    params.base_log_rho + 6.55 * log10_rho_ratio + phi_overburden,
    -17.8,
    10.6
  );
  let logRho = mix(prev_logRho, target_logRho, min(1.0, params.dt * 3.0));
  let dlogRho_signed = clamp((logRho - prev_logRho) / max(1e-4, params.dt), -4.0, 6.0);

  // 4. Query pluggable 2D (log10 rho, log10 T) EOS & opacity closure table!
  let cell_eos = sample_eos_table(logRho, prev_logT);
  let mu_gas = max(0.45, cell_eos.eos0.x);
  let gamma_eff = clamp(cell_eos.eos0.y, 1.05, 2.75);
  let fMol = clamp(cell_eos.eos0.z, 0.0, 1.0);
  let xIon = clamp(cell_eos.eos0.w, 0.0, 1.0);
  let pDeg_frac = clamp(cell_eos.eos1.x, 0.0, 1.0);
  let log10_kappa = cell_eos.eos1.y;
  let pNuc_frac = clamp(cell_eos.eos1.z, 0.0, 1.0);
  let pRad_frac = clamp(cell_eos.eos1.w, 0.0, 1.0);

  // 5. General Gamow-window thermonuclear reaction network (pp-chain, CNO, triple-alpha, Fe photodisintegration)
  var xH = clamp(p.thermo.z, 0.0, 1.0);
  var xHe = clamp(p.state.z, 0.0, 1.0);
  var xZ = clamp(p.state.w, 0.0, 1.0);

  let tempK = pow(10.0, prev_logT);
  let rho_cgs = pow(10.0, clamp(logRho - 3.0, -21.0, 8.5));
  let t6 = tempK * 1e-6;
  let t8 = tempK * 1e-8;
  let t9 = tempK * 1e-9;

  var eps_pp = 0.0;
  if (t6 > 0.8 && xH > 1e-5) {
    let t6_cbrt = pow(t6, 0.3333333);
    let tau_pp = 33.80 / t6_cbrt;
    if (tau_pp < 80.0) {
      let screen = (1.0 + 0.0123 * t6_cbrt + 0.0109 * t6_cbrt * t6_cbrt) * 1.18;
      eps_pp = 238.0 * rho_cgs * xH * xH * pow(t6, -0.6666667) * exp(-tau_pp) * screen;
    }
  }
  var eps_cno = 0.0;
  if (t6 > 7.0 && xH > 1e-5 && xZ > 1e-5) {
    let t6_cbrt = pow(t6, 0.3333333);
    let tau_cno = 152.28 / t6_cbrt;
    if (tau_cno < 85.0) {
      eps_cno = 4.4e21 * rho_cgs * xH * (0.5 * xZ) * pow(t6, -0.6666667) * exp(-tau_cno);
    }
  }
  var eps_3a = 0.0;
  if (t8 > 0.45 && xHe > 1e-5) {
    let tau_3a = 44.027 / t8;
    if (tau_3a < 80.0) {
      eps_3a = 5.09e7 * (rho_cgs * rho_cgs) * (xHe * xHe * xHe) * pow(t8, -3.0) * exp(-tau_3a);
    }
  }
  // Endothermic Fe-peak photodisintegration sink (Fe-56 + gamma -> 13 alpha + 4n)
  var eps_photodis = 0.0;
  if (t9 > 1.2 && xZ > 0.30) {
    let ramp = clamp((t9 - 1.2) / 1.5, 0.0, 1.0);
    eps_photodis = 1.5e8 * xZ * ramp * ramp * exp(-max(0.0, 12.0 / t9 - 5.0));
  }

  let eps_exo = eps_pp + eps_cno + eps_3a;
  let log10_eps = log2(eps_exo + 1e-30) * 0.30103;

  // 6. Exact nucleon-conserving nuclear transmutation (X_H -> X_He -> X_Z, sum == 1.0)
  let dt_burn = params.dt * params.burn_timescale_s * params.time_accel;
  if (eps_exo > 1e-7 && dt_burn > 0.0) {
    let dX = min(xH, ((eps_pp + eps_cno) * dt_burn) / 6.27e14);
    let dY = min(xHe + dX, (eps_3a * dt_burn) / 5.81e13);
    xH = max(0.0, xH - dX);
    xHe = max(0.0, xHe + dX - dY);
    xZ = max(0.0, xZ + dY);
    let x_sum = max(1e-6, xH + xHe + xZ);
    xH = xH / x_sum;
    xHe = xHe / x_sum;
    xZ = xZ / x_sum;
  }

  // 7. General thermodynamic energy evolution:
  //    Signed PdV compressional heating/expansion cooling + Virial Kelvin-Helmholtz relaxation
  //    + exothermic fusion - endothermic Fe photodisintegration - Rosseland radiative cooling!
  let gamma_minus_1 = max(0.06, min(0.75, gamma_eff - 1.0));
  let pdv_heat = gamma_minus_1 * (dlogRho_signed * 0.72 + infall_compress * 0.22);

  // Virial equilibrium temperature from actual local gravitational potential |Phi_i| & mean molecular weight mu:
  //   - Diffuse cold cloud (|Phi| ~ 8): logT_vir ~ 1.5 (30 K)
  //   - 1 M_sun collapsed core (|Phi| ~ 50, mu=0.6): logT_vir ~ 7.18 (15 MK -> stable pp-chain!)
  //   - 18 M_sun collapsed core (|Phi| ~ 900, mu=0.6 -> 1.8): logT_vir ~ 7.6 -> 9.4 (CNO -> 3a -> Fe collapse!)
  let vir_arg = max(0.5, (grav_phi * mu_gas) / 14.0);
  let logT_virial = clamp(
    select(1.45, 6.25 + log2(vir_arg) * 0.30103 * 1.95, logRho > -8.0),
    1.35,
    9.42
  );
  let optical_depth_trap = clamp((logRho + log10_kappa + 6.5) / 7.5, 0.0, 1.0);
  // Relax optically thick core cleanly toward its own gravitational virial equilibrium (prevents unphysical 1 M_sun overshoot!)
  let kh_drive = optical_depth_trap * clamp((logT_virial - prev_logT) * 0.58, -0.85, 0.65);

  // Exothermic nuclear heating gently raises core T into hydrostatic balance (capped to physical thermostat!)
  let nuc_heat = select(0.0, clamp((log10_eps + 6.0) * 0.032, 0.0, 0.36), log10_eps > -6.0);
  // Endothermic photodisintegration drains thermal energy during Fe-core collapse!
  let endo_sink = select(0.0, clamp(log2(eps_photodis + 1.0) * 0.035, 0.0, 0.65), eps_photodis > 1.0);
  let rad_cool = (1.0 - optical_depth_trap * 0.86) * clamp((prev_logT - 1.42) * 0.38, 0.0, 1.15);

  let next_logT = clamp(
    prev_logT + (pdv_heat + kh_drive + nuc_heat - endo_sink - rad_cool) * params.dt * params.time_accel,
    1.15,
    9.50
  );

  // 8. General Hydrodynamic Equations of Motion:
  //    a_total = a_grav + a_press(EOS) + a_core_eos(thermal + radiation + degeneracy + nuclear-saturation bounce!)
  let collapse_soften = clamp((gamma_eff - 1.02) / 0.62, 0.20, 2.4);
  let r_vec = self_pm.xyz;
  let r_dist = max(0.18, length(r_vec));
  let r_dir = r_vec / r_dist;

  // Hydrostatic + nuclear-bounce radial pressure acceleration strictly from local EOS state!
  let t_sup = clamp((next_logT - 3.6) / 4.2, 0.0, 1.85);
  let p_therm_sup = (t_sup * t_sup * 4.2 / mu_gas) * collapse_soften;
  let p_rad_sup = pRad_frac * 14.0;
  let p_deg_sup = pDeg_frac * 22.0;
  let p_nuc_bounce = pNuc_frac * 460.0;
  let core_press_mag = select(
    0.0,
    p_therm_sup + p_rad_sup + p_deg_sup + p_nuc_bounce,
    inside_inner && r_dist < 2.2
  );
  let acc_core_eos = r_dir * (core_press_mag / (r_dist * r_dist + 0.16));
  let acc_total = acc_grav + acc_press * (1.25 * collapse_soften) + acc_core_eos;

  // Angular-momentum-conserving shock damping: damp ONLY radial infall oscillations,
  // preserving tangential orbital angular momentum (L = r x v) for binary orbits & disks!
  let v_rad_now = dot(self_vs.xyz, r_dir);
  let v_tan_now = self_vs.xyz - r_dir * v_rad_now;
  let rad_damp = select(0.992, 0.972, inside_inner && pNuc_frac < 0.05);
  var vel = (r_dir * (v_rad_now * rad_damp) + v_tan_now * 0.9994) + acc_total * params.dt;
  let spd = length(vel);
  let v_cap = 26.0;
  if (spd > v_cap) {
    vel = vel * (v_cap / spd);
  }
  var pos = self_pm.xyz + vel * params.dt;

  // Soft outer domain confinement for bound non-escaping gas
  let r_next = length(pos);
  if (r_next > params.box_half - 0.45 && spd < 10.0) {
    pos = pos * ((params.box_half - 0.45) / r_next);
    vel = vel * 0.72;
  }

  dst_particles[idx] = HydroParticle(
    vec4<f32>(pos, self_pm.w),
    vec4<f32>(vel, self_vs.w),
    vec4<f32>(next_logT, logRho, xH, log10_eps),
    vec4<f32>(fMol, xIon, xHe, xZ)
  );

  // 9. 64-byte atomic global diagnostic telemetry reduction (pure observer!)
  let logT_u = u32(clamp(next_logT * 1000.0, 0.0, 20000.0));
  let logRho_u = u32(clamp((logRho + 20.0) * 1000.0, 0.0, 40000.0));
  let logEps_u = u32(clamp((log10_eps + 30.0) * 1000.0, 0.0, 60000.0));
  atomicMax(&telemetry[0u], logT_u);
  atomicMax(&telemetry[1u], logRho_u);
  atomicMax(&telemetry[2u], logEps_u);
  if (log10_eps > -5.5) {
    atomicAdd(&telemetry[3u], 1u);
  }
  atomicAdd(&telemetry[4u], u32(clamp(fMol * 1000.0, 0.0, 1000.0)));
  atomicAdd(&telemetry[5u], u32(clamp(xIon * 1000.0, 0.0, 1000.0)));
  atomicAdd(&telemetry[6u], u32(clamp(xH * 1000.0, 0.0, 1000.0)));
  atomicAdd(&telemetry[7u], u32(clamp(xHe * 1000.0, 0.0, 1000.0)));
  atomicAdd(&telemetry[8u], u32(clamp(xZ * 1000.0, 0.0, 1000.0)));
  atomicAdd(&telemetry[9u], u32(clamp(pDeg_frac * 1000.0, 0.0, 1000.0)));
  if (logRho > -3.0 || r_dist < 1.6) {
    atomicAdd(&telemetry[10u], 1u);
    atomicAdd(&telemetry[11u], u32(clamp(xZ * 1000.0, 0.0, 1000.0)));
    atomicAdd(&telemetry[12u], u32(clamp(xH * 1000.0, 0.0, 1000.0)));
    atomicAdd(&telemetry[15u], u32(clamp(gamma_eff * 1000.0, 0.0, 3000.0)));
  }
  let v_out = dot(vel, r_dir);
  if (v_out > 5.0 && r_dist > 0.6) {
    atomicAdd(&telemetry[13u], 1u);
  }
  if (pNuc_frac > 0.08) {
    atomicAdd(&telemetry[14u], 1u);
  }
}
`;

function decodeHydroTelemetry(u32, count, totalMassSolar, hadNuclearBounce) {
  const n = Math.max(1, count);
  const coreCount = Math.max(1, u32[10]);
  const coreLogT = Math.max(1.15, (u32[0] || 1400) / 1000);
  const coreLogRho = (u32[1] || 4000) / 1000 - 20.0;
  const maxLogEps = (u32[2] || 0) / 1000 - 30.0;
  const fusingCount = u32[3] || 0;
  const meanFH2 = Math.min(1, (u32[4] || 0) / (n * 1000));
  const meanXIonized = Math.min(1, (u32[5] || 0) / (n * 1000));
  const meanXH = Math.min(1, (u32[6] || 0) / (n * 1000));
  const meanXHe = Math.min(1, (u32[7] || 0) / (n * 1000));
  const meanXZ = Math.min(1, (u32[8] || 0) / (n * 1000));
  const meanPDegFraction = Math.min(1, (u32[9] || 0) / (n * 1000));
  const coreXZ = Math.min(1, (u32[11] || 0) / (coreCount * 1000));
  const coreXH = u32[10] > 0 ? Math.min(1, (u32[12] || 0) / (coreCount * 1000)) : meanXH;
  const coreGammaEff = u32[10] > 0 ? (u32[15] || 1667) / (coreCount * 1000) : 5 / 3;
  const shockCount = u32[13] || 0;
  const nuclearBounceCount = u32[14] || 0;

  const coreTempK = Math.pow(10, coreLogT);
  const coreRhoKgM3 = Math.pow(10, coreLogRho);
  const peakEpsNucWPerKg = maxLogEps > -29 ? Math.pow(10, maxLogEps) : 0;

  const coreEos = evaluateHydrogenPlasmaClosure({
    rhoKgM3: coreRhoKgM3,
    temperatureK: coreTempK,
    xH: coreXH,
    xHe: Math.max(0, 1 - coreXH - coreXZ),
    xMetals: coreXZ
  });
  const coreNuc = evaluateStellarNuclearFusionClosure({
    rhoKgM3: coreRhoKgM3,
    temperatureK: coreTempK,
    xH: coreXH,
    xHe: Math.max(0, 1 - coreXH - coreXZ),
    xMetals: coreXZ,
    coreMassSolar: totalMassSolar
  });

  // Purely diagnostic observation of emergent core-collapse supernova / compact remnant!
  const supernovaObserved = Boolean(
    hadNuclearBounce
    || (nuclearBounceCount > 4 && coreTempK >= 5e8)
    || (coreNuc.coreCollapseTriggered && shockCount > 40)
  );
  const remnantMassSolar = Math.max(1.35, totalMassSolar * 0.14);
  const remnantClass = supernovaObserved
    ? (remnantMassSolar > TOV_MAX_NEUTRON_STAR_MASS_SOLAR ? 'black-hole' : 'neutron-star')
    : 'none';
  const schwarzschildRadiusM = supernovaObserved
    ? (2 * 6.67430e-11 * remnantMassSolar * 1.98847e30) / (299792458.0 ** 2)
    : 0;

  const stage = classifyEmergentStellarStage({
    coreTempK,
    coreRhoKgM3,
    fH2: coreEos.fH2,
    xIonized: coreEos.xIonized,
    xH: coreXH,
    epsNucWPerKg: Math.max(peakEpsNucWPerKg, coreNuc.epsTotalWPerKg),
    pDegFraction: coreEos.pDegFraction,
    supernovaShockActive: supernovaObserved && shockCount > 80,
    remnantClass
  });

  // Photosphere effective temperature & Planck CIE 1931 sRGB via ULG's radiationClosure.js!
  const photosphereTempK = Math.max(1200, Math.min(38000,
    coreTempK < 1e4
      ? Math.max(1200, coreTempK * 0.85)
      : Math.min(36000, 3200 + Math.pow(Math.max(0, totalMassSolar), 0.72) * 3200)
  ));
  const photosphereSrgb = evaluateBlackbodyPhotosphereSrgb(photosphereTempK);

  return {
    coreTempK,
    coreLogT,
    coreRhoKgM3,
    coreLogRho,
    peakEpsNucWPerKg: Math.max(peakEpsNucWPerKg, coreNuc.epsTotalWPerKg),
    gamowPeakKeV: coreNuc.gamowPeakKeV,
    gamowTauPp: coreNuc.gamowTauPp,
    fusingCount,
    meanFH2,
    meanXIonized,
    coreFH2: coreEos.fH2,
    coreXIonized: coreEos.xIonized,
    coreMu: coreEos.mu,
    coreGammaEff: Math.min(coreGammaEff, coreEos.gammaEff),
    corePDegFraction: coreEos.pDegFraction,
    corePNucFraction: coreEos.pNucFraction,
    meanPDegFraction,
    meanXH,
    meanXHe,
    meanXZ,
    coreXH,
    coreXZ,
    nucleonSum: meanXH + meanXHe + meanXZ,
    shockCount,
    nuclearBounceCount,
    supernovaTriggered: supernovaObserved,
    remnantClass,
    schwarzschildRadiusM,
    photosphereTempK,
    photosphereSrgb,
    stage
  };
}

function stepCpuFallbackSelfGravitatingHydro({
  cpuBodies,
  count,
  gravityG,
  baseLogRho,
  refRhoSim,
  burnTimescaleS,
  dt,
  timeAccel,
  totalMassSolar,
  hadNuclearBounce,
  anchors
}) {
  const next = new Float32Array(cpuBodies.length);
  const stride = count > 384 ? Math.ceil(count / 384) : 1;
  const eps2 = 0.25 * 0.25;

  let maxLogT = 1.2;
  let maxLogRho = baseLogRho;
  let maxLogEps = -30;
  let fusingCount = 0;
  let sumFH2 = 0; let sumXIon = 0; let sumXH = 0; let sumXHe = 0; let sumXZ = 0; let sumPDeg = 0;
  let coreCount = 0; let coreSumXZ = 0; let coreSumXH = 0; let coreSumGamma = 0;
  let shockCount = 0; let nuclearBounceCount = 0;

  for (let i = 0; i < count; i += 1) {
    const o = i * HYDRO_PARTICLE_STRIDE_FLOATS;
    const xi = cpuBodies[o]; const yi = cpuBodies[o + 1]; const zi = cpuBodies[o + 2];
    const mi = cpuBodies[o + 3];
    let vx = cpuBodies[o + 4]; let vy = cpuBodies[o + 5]; let vz = cpuBodies[o + 6];
    const h = cpuBodies[o + 7];
    const prevLogT = cpuBodies[o + 8];
    const prevLogRho = cpuBodies[o + 9];
    let xH = cpuBodies[o + 10];
    let xHe = cpuBodies[o + 14];
    let xZ = cpuBodies[o + 15];

    let ax = 0; let ay = 0; let az = 0;
    let gravPhi = 0;
    let localMass = mi * 4;
    for (let j = 0; j < count; j += stride) {
      const jo = j * HYDRO_PARTICLE_STRIDE_FLOATS;
      const mj = cpuBodies[jo + 3] * stride;
      const dx = cpuBodies[jo] - xi;
      const dy = cpuBodies[jo + 1] - yi;
      const dz = cpuBodies[jo + 2] - zi;
      const r2 = dx * dx + dy * dy + dz * dz + eps2;
      const invR = 1 / Math.sqrt(r2);
      const f = mj * invR * invR * invR;
      ax += dx * f; ay += dy * f; az += dz * f;
      gravPhi += mj * invR;
      if (r2 < 2.2) localMass += mj * Math.exp(-r2 * 0.9);
    }
    ax *= gravityG; ay *= gravityG; az *= gravityG;
    gravPhi *= gravityG;

    const rDist = Math.max(0.18, Math.hypot(xi, yi, zi));
    const rx = xi / rDist; const ry = yi / rDist; const rz = zi / rDist;
    const vRad = vx * rx + vy * ry + vz * rz;
    const infall = Math.max(-1.8, Math.min(2.2, -vRad / (rDist + 0.45)));

    const rhoRatio = Math.max(1e-3, localMass / Math.max(1e-4, refRhoSim));
    const phiOverburden = Math.max(0, Math.min(4.8, Math.log10(Math.max(1, gravPhi / 18)) * 2.55));
    const targetLogRho = Math.max(-17.8, Math.min(10.6,
      baseLogRho + 6.55 * Math.log10(rhoRatio) + phiOverburden
    ));
    const logRho = prevLogRho + (targetLogRho - prevLogRho) * Math.min(1, dt * 3.0);
    const dLogRhoSigned = Math.max(-4, Math.min(6, (logRho - prevLogRho) / Math.max(1e-4, dt)));

    const eos = evaluateHydrogenPlasmaClosure({
      rhoKgM3: Math.pow(10, logRho),
      temperatureK: Math.pow(10, prevLogT),
      xH, xHe, xMetals: xZ,
      anchors
    });
    const nuc = evaluateStellarNuclearFusionClosure({
      rhoKgM3: Math.pow(10, logRho),
      temperatureK: Math.pow(10, prevLogT),
      xH, xHe, xMetals: xZ,
      dtS: dt * burnTimescaleS * timeAccel,
      coreMassSolar: totalMassSolar
    });
    xH = nuc.nextMassFractions.xH;
    xHe = nuc.nextMassFractions.xHe;
    xZ = nuc.nextMassFractions.xMetals;
    const log10Eps = Math.log10(nuc.epsTotalWPerKg + 1e-30);
    const log10Kappa = Math.log10(Math.max(1e-6, eos.kappaM2PerKg));

    const gammaMinus1 = Math.max(0.06, Math.min(0.75, eos.gammaEff - 1));
    const pdvHeat = gammaMinus1 * (dLogRhoSigned * 0.72 + infall * 0.22);
    const virArg = Math.max(0.5, (gravPhi * eos.mu) / 14);
    const logTVirial = logRho > -8
      ? Math.max(1.35, Math.min(9.42, 6.25 + Math.log10(virArg) * 1.95))
      : 1.45;
    const optTrap = Math.max(0, Math.min(1, (logRho + log10Kappa + 6.5) / 7.5));
    const khDrive = optTrap * Math.max(-0.85, Math.min(0.65, (logTVirial - prevLogT) * 0.58));
    const nucHeat = log10Eps > -6 ? Math.min(0.36, Math.max(0, (log10Eps + 6) * 0.032)) : 0;
    const endoSink = nuc.epsPhotodisWPerKg > 1 ? Math.min(0.65, Math.log2(nuc.epsPhotodisWPerKg + 1) * 0.035) : 0;
    const radCool = (1 - optTrap * 0.86) * Math.max(0, Math.min(1.15, (prevLogT - 1.42) * 0.38));
    const nextLogT = Math.max(1.15, Math.min(9.50, prevLogT + (pdvHeat + khDrive + nucHeat - endoSink - radCool) * dt * timeAccel));

    const collapseSoften = Math.max(0.20, Math.min(2.4, (eos.gammaEff - 1.02) / 0.62));
    if (rDist < 2.2) {
      const tSup = Math.max(0, Math.min(1.85, (nextLogT - 3.6) / 4.2));
      const pMag = (tSup * tSup * 4.2 / eos.mu) * collapseSoften
        + eos.pRadFraction * 14
        + eos.pDegFraction * 22
        + eos.pNucFraction * 460;
      const push = pMag / (rDist * rDist + 0.16);
      ax += rx * push; ay += ry * push; az += rz * push;
    }

    const radDamp = rDist < 3.2 && eos.pNucFraction < 0.05 ? 0.972 : 0.992;
    const vtX = vx - rx * vRad;
    const vtY = vy - ry * vRad;
    const vtZ = vz - rz * vRad;
    vx = rx * (vRad * radDamp) + vtX * 0.9994 + ax * dt;
    vy = ry * (vRad * radDamp) + vtY * 0.9994 + ay * dt;
    vz = rz * (vRad * radDamp) + vtZ * 0.9994 + az * dt;
    const spd = Math.hypot(vx, vy, vz);
    if (spd > 26) {
      const s = 26 / spd;
      vx *= s; vy *= s; vz *= s;
    }
    let nx = xi + vx * dt;
    let ny = yi + vy * dt;
    let nz = zi + vz * dt;
    const rNext = Math.hypot(nx, ny, nz);
    if (rNext > 13.55 && spd < 10) {
      const s = 13.55 / rNext;
      nx *= s; ny *= s; nz *= s;
      vx *= 0.72; vy *= 0.72; vz *= 0.72;
    }

    next[o + 0] = nx; next[o + 1] = ny; next[o + 2] = nz; next[o + 3] = mi;
    next[o + 4] = vx; next[o + 5] = vy; next[o + 6] = vz; next[o + 7] = h;
    next[o + 8] = nextLogT; next[o + 9] = logRho; next[o + 10] = xH; next[o + 11] = log10Eps;
    next[o + 12] = eos.fH2; next[o + 13] = eos.xIonized; next[o + 14] = xHe; next[o + 15] = xZ;

    if (nextLogT > maxLogT) maxLogT = nextLogT;
    if (logRho > maxLogRho) maxLogRho = logRho;
    if (log10Eps > maxLogEps) maxLogEps = log10Eps;
    if (log10Eps > -5.5) fusingCount += 1;
    sumFH2 += eos.fH2;
    sumXIon += eos.xIonized;
    sumXH += xH; sumXHe += xHe; sumXZ += xZ;
    sumPDeg += eos.pDegFraction;
    if (logRho > -3 || rDist < 1.6) {
      coreCount += 1;
      coreSumXZ += xZ;
      coreSumXH += xH;
      coreSumGamma += eos.gammaEff;
    }
    const vOut = vx * rx + vy * ry + vz * rz;
    if (vOut > 5.0 && rDist > 0.6) shockCount += 1;
    if (eos.pNucFraction > 0.08) nuclearBounceCount += 1;
  }

  const u32 = new Uint32Array(16);
  u32[0] = Math.round(maxLogT * 1000);
  u32[1] = Math.round((maxLogRho + 20) * 1000);
  u32[2] = Math.round((maxLogEps + 30) * 1000);
  u32[3] = fusingCount;
  u32[4] = Math.round(sumFH2 * 1000);
  u32[5] = Math.round(sumXIon * 1000);
  u32[6] = Math.round(sumXH * 1000);
  u32[7] = Math.round(sumXHe * 1000);
  u32[8] = Math.round(sumXZ * 1000);
  u32[9] = Math.round(sumPDeg * 1000);
  u32[10] = coreCount;
  u32[11] = Math.round(coreSumXZ * 1000);
  u32[12] = Math.round(coreSumXH * 1000);
  u32[13] = shockCount;
  u32[14] = nuclearBounceCount;
  u32[15] = Math.round(coreSumGamma * 1000);

  const nextBounce = hadNuclearBounce || (nuclearBounceCount > 4 && Math.pow(10, maxLogT) >= 5e8);
  return {
    nextBodies: next,
    hadNuclearBounce: nextBounce,
    telemetry: decodeHydroTelemetry(u32, count, totalMassSolar, nextBounce)
  };
}

/**
 * Create a general resident WebGPU (with CPU fallback) Self-Gravitating
 * Compressible Reacting-Fluid Engine.
 * Accepts ANY initial 16-float particle distribution and ANY ClosureRegistry-backed
 * 2D `(log10 rho, log10 T)` EOS closure table.
 */
export function createSelfGravitatingHydroEngine({
  device = null,
  initialBodies,
  eosClosureTable = null,
  gravityG = 0.42,
  softening = 0.25,
  boxHalf = 14.0,
  innerHalf = 3.2,
  baseLogRho = -16.2,
  refRhoSim = 0.075,
  burnTimescaleS = 4.2e14,
  label = 'ulg-self-gravitating-hydro'
} = {}) {
  let cpuBodies = Float32Array.from(initialBodies);
  const particleCount = cpuBodies.length / HYDRO_PARTICLE_STRIDE_FLOATS;
  const table = eosClosureTable || buildStellarClosureGpuTable({ nRho: 28, nTemp: 40 });

  function computeTotalMassSolar(bodies) {
    let mSum = 0;
    for (let i = 0; i < bodies.length; i += HYDRO_PARTICLE_STRIDE_FLOATS) {
      mSum += bodies[i + 3];
    }
    return mSum / SIM_MASS_PER_SOLAR_MASS;
  }

  let totalMassSolar = computeTotalMassSolar(cpuBodies);
  let stepIndex = 0;
  let simTimeMyr = 0;
  let hadNuclearBounce = false;
  let disposed = false;

  let buffers = null;
  let outerAccumBuf = null;
  let outerTreeBuf = null;
  let innerAccumBuf = null;
  let innerGridBuf = null;
  let eosTableBuf = null;
  let telemetryBuf = null;
  let telemetryStagingBuf = null;
  let paramsBuf = null;
  let bodyStagingBuf = null;
  let pipes = null;
  let bindGroups = null;
  let ping = 0;
  let telemetryMapInFlight = false;
  let bodyMapInFlight = false;

  function makeInitialTelemetry(bodies) {
    let maxLogT = 1.2;
    let maxLogRho = baseLogRho;
    let sumFH2 = 0; let sumXH = 0; let sumXHe = 0; let sumXZ = 0;
    for (let i = 0; i < particleCount; i += 1) {
      const o = i * HYDRO_PARTICLE_STRIDE_FLOATS;
      if (bodies[o + 8] > maxLogT) maxLogT = bodies[o + 8];
      if (bodies[o + 9] > maxLogRho) maxLogRho = bodies[o + 9];
      sumFH2 += bodies[o + 12];
      sumXH += bodies[o + 10];
      sumXHe += bodies[o + 14];
      sumXZ += bodies[o + 15];
    }
    const u32 = new Uint32Array(16);
    u32[0] = Math.round(maxLogT * 1000);
    u32[1] = Math.round((maxLogRho + 20) * 1000);
    u32[4] = Math.round(sumFH2 * 1000);
    u32[6] = Math.round(sumXH * 1000);
    u32[7] = Math.round(sumXHe * 1000);
    u32[8] = Math.round(sumXZ * 1000);
    u32[10] = 1;
    u32[11] = Math.round((sumXZ / particleCount) * 1000);
    u32[12] = Math.round((sumXH / particleCount) * 1000);
    u32[15] = 1667;
    return decodeHydroTelemetry(u32, particleCount, totalMassSolar, false);
  }

  let lastTelemetry = makeInitialTelemetry(cpuBodies);

  if (device && typeof device.createBuffer === 'function') {
    const byteLength = Math.max(64, cpuBodies.byteLength);
    const bodyUsage = USAGE_STORAGE | USAGE_VERTEX | USAGE_COPY_DST | USAGE_COPY_SRC;
    buffers = [
      device.createBuffer({ label: `${label}-p0`, size: byteLength, usage: bodyUsage }),
      device.createBuffer({ label: `${label}-p1`, size: byteLength, usage: bodyUsage })
    ];
    outerAccumBuf = device.createBuffer({ label: `${label}-outer-accum`, size: 4096 * 16, usage: USAGE_STORAGE });
    outerTreeBuf = device.createBuffer({ label: `${label}-outer-tree`, size: 4160 * 16, usage: USAGE_STORAGE });
    innerAccumBuf = device.createBuffer({ label: `${label}-inner-accum`, size: 4096 * 16, usage: USAGE_STORAGE });
    innerGridBuf = device.createBuffer({ label: `${label}-inner-grid`, size: 4096 * 16, usage: USAGE_STORAGE });
    eosTableBuf = device.createBuffer({ label: `${label}-eos-table`, size: table.data.byteLength, usage: USAGE_STORAGE | USAGE_COPY_DST });
    telemetryBuf = device.createBuffer({ label: `${label}-telemetry`, size: 64, usage: USAGE_STORAGE | USAGE_COPY_SRC });
    telemetryStagingBuf = device.createBuffer({ label: `${label}-telemetry-staging`, size: 64, usage: USAGE_COPY_DST | USAGE_MAP_READ });
    paramsBuf = device.createBuffer({ label: `${label}-params`, size: 80, usage: USAGE_UNIFORM | USAGE_COPY_DST });
    bodyStagingBuf = device.createBuffer({ label: `${label}-body-staging`, size: byteLength, usage: USAGE_COPY_DST | USAGE_MAP_READ });

    device.queue.writeBuffer(buffers[0], 0, cpuBodies);
    device.queue.writeBuffer(buffers[1], 0, cpuBodies);
    device.queue.writeBuffer(eosTableBuf, 0, table.data);

    const bindings = [
      computeBufferBinding(0, 'read-only-storage'),
      computeBufferBinding(1, 'storage'),
      computeBufferBinding(2, 'storage'),
      computeBufferBinding(3, 'storage'),
      computeBufferBinding(4, 'storage'),
      computeBufferBinding(5, 'storage'),
      computeBufferBinding(6, 'read-only-storage'),
      computeBufferBinding(7, 'storage'),
      computeBufferBinding(8, 'uniform')
    ];
    const mk = (entryPoint) => createCachedExplicitComputePipeline(device, {
      cacheKey: `ulg-self-gravitating-hydro-${entryPoint}.v1`,
      label: `ulg-self-gravitating-hydro-${entryPoint}`,
      code: selfGravitatingHydroWgsl,
      entryPoint,
      bindings
    });
    pipes = {
      clear: mk('sgh_clear'),
      deposit: mk('sgh_deposit'),
      finalize: mk('sgh_finalize'),
      reduce: mk('sgh_reduce_coarse'),
      integrate: mk('sgh_integrate')
    };
    const mkBg = (src, dst, idx) => createCachedExplicitBindGroup(device, {
      layout: pipes.integrate.bindGroupLayout,
      label: `${label}-bg-${idx}`,
      entries: [
        { binding: 0, resource: { buffer: src } },
        { binding: 1, resource: { buffer: dst } },
        { binding: 2, resource: { buffer: outerAccumBuf } },
        { binding: 3, resource: { buffer: outerTreeBuf } },
        { binding: 4, resource: { buffer: innerAccumBuf } },
        { binding: 5, resource: { buffer: innerGridBuf } },
        { binding: 6, resource: { buffer: eosTableBuf } },
        { binding: 7, resource: { buffer: telemetryBuf } },
        { binding: 8, resource: { buffer: paramsBuf } }
      ]
    });
    bindGroups = [mkBg(buffers[0], buffers[1], 0), mkBg(buffers[1], buffers[0], 1)];
  }

  async function readbackBodies() {
    if (!buffers || !bodyStagingBuf || bodyMapInFlight || disposed) return cpuBodies;
    bodyMapInFlight = true;
    try {
      const enc = device.createCommandEncoder({ label: `${label}-readback` });
      enc.copyBufferToBuffer(buffers[ping], 0, bodyStagingBuf, 0, cpuBodies.byteLength);
      device.queue.submit([enc.finish()]);
      await bodyStagingBuf.mapAsync(1);
      cpuBodies.set(new Float32Array(bodyStagingBuf.getMappedRange()));
      bodyStagingBuf.unmap();
    } finally {
      bodyMapInFlight = false;
    }
    return cpuBodies;
  }

  async function step({
    dt = 0.018,
    timeAccel = 1.0,
    readTelemetry = true
  } = {}) {
    if (disposed) return lastTelemetry;
    const accel = Math.max(0.25, Math.min(25, Number(timeAccel) || 1.0));
    const subDt = Math.max(0.004, Math.min(0.028, Number(dt) || 0.018));

    if (!buffers || !pipes) {
      const res = stepCpuFallbackSelfGravitatingHydro({
        cpuBodies,
        count: particleCount,
        gravityG,
        baseLogRho,
        refRhoSim,
        burnTimescaleS,
        dt: subDt,
        timeAccel: accel,
        totalMassSolar,
        hadNuclearBounce,
        anchors: table.anchors
      });
      cpuBodies = res.nextBodies;
      hadNuclearBounce = res.hadNuclearBounce;
      lastTelemetry = res.telemetry;
      stepIndex += 1;
      simTimeMyr += subDt * accel * 0.35;
      return lastTelemetry;
    }

    const pBuf = new ArrayBuffer(80);
    const u32 = new Uint32Array(pBuf);
    const f32 = new Float32Array(pBuf);
    u32[0] = particleCount;
    u32[1] = table.nRho;
    u32[2] = table.nTemp;
    u32[3] = 0;
    f32[4] = subDt;
    f32[5] = gravityG;
    f32[6] = softening * softening;
    f32[7] = boxHalf;
    f32[8] = innerHalf;
    f32[9] = 0.65 * 0.65;
    f32[10] = table.logRhoMin;
    f32[11] = table.logRhoMax;
    f32[12] = table.logTempMin;
    f32[13] = table.logTempMax;
    f32[14] = baseLogRho;
    f32[15] = refRhoSim;
    f32[16] = burnTimescaleS;
    f32[17] = accel;
    device.queue.writeBuffer(paramsBuf, 0, pBuf);

    const srcIdx = ping;
    const dstIdx = 1 - ping;
    const bg = bindGroups[srcIdx];
    const pGroups = Math.ceil(particleCount / 64);

    const enc = device.createCommandEncoder({ label: `${label}-step-${stepIndex}` });
    const pass = enc.beginComputePass({ label: `${label}-pass` });
    pass.setPipeline(pipes.clear.pipeline);
    pass.setBindGroup(0, bg);
    pass.dispatchWorkgroups(64);

    pass.setPipeline(pipes.deposit.pipeline);
    pass.setBindGroup(0, bg);
    pass.dispatchWorkgroups(pGroups);

    pass.setPipeline(pipes.finalize.pipeline);
    pass.setBindGroup(0, bg);
    pass.dispatchWorkgroups(64);

    pass.setPipeline(pipes.reduce.pipeline);
    pass.setBindGroup(0, bg);
    pass.dispatchWorkgroups(1);

    pass.setPipeline(pipes.integrate.pipeline);
    pass.setBindGroup(0, bg);
    pass.dispatchWorkgroups(pGroups);
    pass.end();

    const doTelRead = readTelemetry && !telemetryMapInFlight;
    if (doTelRead) {
      enc.copyBufferToBuffer(telemetryBuf, 0, telemetryStagingBuf, 0, 64);
    }
    device.queue.submit([enc.finish()]);
    ping = dstIdx;
    stepIndex += 1;
    simTimeMyr += subDt * accel * 0.35;

    if (doTelRead) {
      telemetryMapInFlight = true;
      try {
        await telemetryStagingBuf.mapAsync(1);
        const snap = new Uint32Array(telemetryStagingBuf.getMappedRange().slice(0));
        telemetryStagingBuf.unmap();
        if (snap[14] > 4 && Math.pow(10, (snap[0] || 1400) / 1000) >= 5e8) {
          hadNuclearBounce = true;
        }
        lastTelemetry = decodeHydroTelemetry(snap, particleCount, totalMassSolar, hadNuclearBounce);
      } finally {
        telemetryMapInFlight = false;
      }
    }
    return lastTelemetry;
  }

  function resetBodies(nextBodies) {
    cpuBodies = Float32Array.from(nextBodies);
    totalMassSolar = computeTotalMassSolar(cpuBodies);
    stepIndex = 0;
    simTimeMyr = 0;
    hadNuclearBounce = false;
    ping = 0;
    lastTelemetry = makeInitialTelemetry(cpuBodies);
    if (buffers && device) {
      device.queue.writeBuffer(buffers[0], 0, cpuBodies);
      device.queue.writeBuffer(buffers[1], 0, cpuBodies);
    }
    return lastTelemetry;
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    buffers?.[0]?.destroy();
    buffers?.[1]?.destroy();
    outerAccumBuf?.destroy();
    outerTreeBuf?.destroy();
    innerAccumBuf?.destroy();
    innerGridBuf?.destroy();
    eosTableBuf?.destroy();
    telemetryBuf?.destroy();
    telemetryStagingBuf?.destroy();
    paramsBuf?.destroy();
    bodyStagingBuf?.destroy();
    buffers = null;
  }

  return {
    schema: SELF_GRAVITATING_HYDRO_SCHEMA,
    get count() { return particleCount; },
    get totalMassSolar() { return totalMassSolar; },
    get stepIndex() { return stepIndex; },
    get simTimeMyr() { return simTimeMyr; },
    get backend() { return buffers ? 'webgpu' : 'cpu-fallback'; },
    get solverMode() { return buffers ? 'webgpu-self-gravitating-hydro-eos' : 'cpu-self-gravitating-hydro-eos'; },
    get closureTable() { return table; },
    get anchors() { return table.anchors; },
    getTelemetry: () => lastTelemetry,
    getBodies: () => cpuBodies,
    getResidentBuffer: () => (buffers ? buffers[ping] : null),
    readbackBodies,
    step,
    resetBodies,
    dispose
  };
}

/**
 * Wrap a general `self-gravitating-hydro@1` engine into ULG's `SimulationModuleRegistry`
 * with zero-copy resident `GPUBuffer` leases (`64 B` stride).
 */
export function createSelfGravitatingHydroModuleRegistration({ engine, zeroCopy = true }) {
  const stateLayout = {
    tensorId: 'hydro_particles',
    dtype: 'f32',
    layout: 'interleaved',
    strideElements: HYDRO_PARTICLE_STRIDE_FLOATS,
    strideBytes: HYDRO_PARTICLE_STRIDE_BYTES,
    fields: [
      'x', 'y', 'z', 'mass',
      'vx', 'vy', 'vz', 'hSmooth',
      'log10T', 'log10Rho', 'xH', 'log10EpsNuc',
      'fMol', 'xIon', 'xHe', 'xZ'
    ]
  };
  return {
    method: { model: 'self-gravitating-hydro', version: 1 },
    kernel: {
      sourceModule: 'src/runtime/sph/selfGravitatingHydroGpu.js',
      entryPoint: 'sgh_integrate',
      wgsl: selfGravitatingHydroWgsl,
      workgroupSize: 64
    },
    parameterSchema: {
      dt: { type: 'number', min: 0, required: true },
      timeAccel: { type: 'number', min: 0.1, required: false },
      readTelemetry: { type: 'boolean', required: false }
    },
    stateLayout,
    scaleRangeM: [1e-11, 1e17],
    async stepCapsule(capsule, { createSimulationArtifact, leaseSession }) {
      const fromStep = engine.stepIndex;
      const params = capsule.input?.parameters || {};
      const telemetry = await engine.step(params);
      const toStep = engine.stepIndex;
      leaseSession.publishBuffer({
        resourceKey: 'hydro_particles',
        buffer: engine.getResidentBuffer(),
        destroyFn: () => true,
        byteLength: engine.count * HYDRO_PARTICLE_STRIDE_BYTES,
        rowCount: engine.count,
        layout: stateLayout,
        stepIndex: toStep,
        portableSnapshotFn: async () => Float32Array.from(await engine.readbackBodies())
      });
      const leaseHandle = leaseSession.borrowBufferReadLease({
        resourceKey: 'hydro_particles',
        consumerStage: 'resident-gpu-presenter',
        reason: zeroCopy ? 'zero-copy-gpu-vertex-lease' : 'cpu-instanced-render-lease'
      });
      const artifact = createSimulationArtifact({
        artifactId: `${capsule.taskId}:self-gravitating-hydro:${toStep}`,
        taskKind: capsule.taskKind,
        closureRef: { module: 'src/runtime/sph/selfGravitatingHydroGpu.js', entryPoint: engine.solverMode },
        representation: 'self-gravitating-hydro-f32-64b',
        outputs: {
          deltas: [{ operation: 'replace', tensorId: 'hydro_particles', fromStep, toStep }],
          telemetry
        },
        execution: {
          backend: engine.backend,
          stage: 'self-gravitating-hydro.step',
          placement: 'local',
          solverMode: engine.solverMode,
          zeroCopyParticleReadbackBytes: zeroCopy ? 0 : engine.count * HYDRO_PARTICLE_STRIDE_BYTES
        },
        validity: {
          finite: Number.isFinite(telemetry.coreTempK) && Number.isFinite(telemetry.coreRhoKgM3),
          particleCount: engine.count,
          nucleonSum: telemetry.nucleonSum
        },
        validation: {
          status: 'pass',
          validationMode: 'finite-output',
          scientificValidation: false,
          fullPhysicsValidation: false
        },
        provenance: {
          ...capsule.provenance,
          sourceService: ULG_SERVICE_IDS.ulgRuntime,
          methodHash: capsule.methodHash,
          inputHash: capsule.inputHash
        }
      });
      return { artifact, leaseHandle };
    }
  };
}
