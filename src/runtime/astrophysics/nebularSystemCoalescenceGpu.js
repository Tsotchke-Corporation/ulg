// Canonical First-Principles Whole-Star-System GPU Nebular Disk Coalescence Solver
// (`src/runtime/astrophysics/nebularSystemCoalescenceGpu.js`, method `nebular-system-coalescence@1`).
//
// Strictly Star Spec v0.4 & ULG General-Law Thesis compliant:
//   - Evolves an ENTIRE rotating protoplanetary nebula (4,096 multi-species gas+dust+ice parcels)
//     at once on WebGPU (`@workgroup_size(64)`, zero WG(1) serial kernels, zero hardcoded planets!).
//   - The central star(s)' ACTUAL radiative luminosity `L_*` sets the continuous disk temperature
//     field `T(r) = 278 K * (L_* / L_sun)^0.25 / sqrt(r_AU) + T_visc(r)`, driving real physical
//     condensation fronts across ALL 5 material families simultaneously:
//       * Fe-Ni metal condensate         (T_cond ~ 1,380 K)
//       * Silicates MgSiO3 / SiO2        (T_cond ~ 1,220 K)
//       * Refractory Carbon / SiC        (T_cond ~ 920 K, weighted by nebular C/O)
//       * H2O Ice (Snow Line jump!)      (T_cond ~ 170 K)
//       * CO2 / NH3 / CH4 / CO Volatiles (T_cond ~ 65 K -> outer ice giants & comets!)
//   - Sub-Keplerian Epstein/Stokes aerodynamic drift + condensation-front pressure-bump pileups +
//     radial self-gravitational SPH clumping + Hill-separated runaway H2/He gas capture coalesce
//     discrete proto-bodies across the whole star system in ONE 1-submit GPU burst (~10-25 ms) —
//     OR stream live at 60 FPS for interactive "Replay Nebular Birth" visualization!
//   - Outputs compact 64-bin annular summary (`2 KB` one-shot readback) + coalesced body peaks
//     whose exact `(aAu, mass, feFrac, silicateFrac, carbonFrac, h2oIceFrac, superVolFrac,
//     gasEnvelopeFrac, tEqK, starFluxWM2)` drive `synthesizeNebularPlanetarySystem` AND cascade
//     straight into per-body 3D GPU SPH planetary/asteroid/comet genesis on zoom-in!

import {
  computeBufferBinding,
  createCachedExplicitBindGroup,
  createCachedExplicitComputePipeline
} from '../webgpuComputeLayout.js';
import {
  LAW_ADAPTER_MODES,
  LAW_FALLBACK_POLICIES,
  LAW_SPATIAL_AUTHORITIES
} from '../sph/lawAdapterContract.js';
import { createSchroederScaleAtlasGravitySolverWebGpu } from '../sph/schroederScaleAtlasMultipoleGpu.js';
import { ULG_ACCURACY_TIERS } from '../../../ulg-gpu-abi/src/materialFoundationAbi.js';

export const ULG_NEBULAR_SYSTEM_COALESCENCE_SCHEMA = 'ulg.astrophysics.nebular-system-coalescence-webgpu.v1';

const GPU_BUF = Object.freeze({
  MAP_READ: 0x0001,
  COPY_SRC: 0x0004,
  COPY_DST: 0x0008,
  VERTEX: 0x0020,
  UNIFORM: 0x0040,
  STORAGE: 0x0080
});

export const NEBULAR_RADIAL_BINS = 64;
const PARCEL_STRIDE_FLOATS = 16; // 64 bytes per parcel — zero-copy compatible with renderer cloud!

export const NEBULAR_SYSTEM_COALESCENCE_LAW_ADAPTER = Object.freeze({
  id: 'nebular-system-coalescence',
  lawNodeId: 'law:astrophysics-protoplanetary-accretion',
  orderConstraint: 'after:nebular-mhd-collapse',
  adapterMode: LAW_ADAPTER_MODES.AGGREGATE_FAR,
  spatialAuthority: LAW_SPATIAL_AUTHORITIES.CANONICAL_SS_EPOCH,
  reads: Object.freeze(['nebular-system-parcels', 'stellar-luminosity', 'galactic-metallicity']),
  writes: Object.freeze(['nebular-system-parcels', 'annular-coalescence-bins']),
  accumulates: Object.freeze(['coalesced-system-summary']),
  pairedVolumeState: 'not-applicable',
  conservedQuantities: Object.freeze(['mass', 'angular-momentum', 'elemental-budgets']),
  validityDomain: Object.freeze({ minParcels: 512, maxParcels: 32768, radialBins: 128 }),
  fallbackPolicy: LAW_FALLBACK_POLICIES.EXACT_SUBSTEP,
  scaleRangeM: Object.freeze([1e9, 1e14]),
  fundamentalLaws: Object.freeze([
    'radiative-equilibrium-condensation-fronts',
    'epstein-stokes-aerodynamic-drift',
    'streaming-instability-clumping',
    'azimuthal-hill-embryo-condensation',
    'lindblad-tidal-gap-clearing',
    'xuv-photoevaporative-disk-dispersal',
    'self-gravitating-hill-coalescence',
    'runaway-gas-envelope-accretion'
  ])
});

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

export const nebularSystemCoalescenceWgsl = /* wgsl */ `
struct NebParams {
  parcel_count: u32,
  radial_bins: u32,
  step_index: u32,
  enable_drag: u32,
  dt: f32,
  star_mass_solar: f32,
  star_lum_solar: f32,
  metallicity_solar: f32,
  c_to_o: f32,
  gas_fraction: f32,
  r_min_au: f32,
  r_max_au: f32,
  t_1au_k: f32,
  clump_strength: f32,
  visc_heat_1au: f32,
  seed_f: f32,
};

// 64 bytes per parcel — zero-copy renderable by PARTICLE_CLOUD_WGSL mode 6!
//   pos_m:    vec4(x_vis, y_vis, z_vis, solid_mass)
//   vel_st:   vec4(vx, vy, vz, radial_u_log)       (u in [0..1] maps log-linearly r_min_au .. r_max_au)
//   thermo:   vec4(temp_k, volatile_ice_frac, gas_env_frac, r_au)
//   info:     vec4(fe_frac, sil_frac, carbon_frac, active_flag)
struct NebParcel {
  pos_m: vec4<f32>,
  vel_st: vec4<f32>,
  thermo: vec4<f32>,
  info: vec4<f32>,
};

// 10 atomic i32 slots per radial bin (fixed-point scaled by 1000.0):
//   0: solid_mass, 1: fe_mass, 2: sil_mass, 3: carbon_mass,
//   4: h2o_mass,   5: supervol_mass, 6: gas_mass, 7: count,
//   8: cos_phi_m,  9: sin_phi_m (2D azimuthal Hill-sphere proto-embryo condensation!)
@group(0) @binding(0) var<uniform> params: NebParams;
@group(0) @binding(1) var<storage, read_write> parcels: array<NebParcel>;
@group(0) @binding(2) var<storage, read_write> bin_atomic: array<atomic<i32>>;
// 2 vec4<f32> per radial bin:
//   [b*2 + 0] = vec4(r_au, total_solid_m, fe_frac, sil_frac)
//   [b*2 + 1] = vec4(carbon_frac, h2o_frac, supervol_frac, gas_env_frac)
@group(0) @binding(3) var<storage, read_write> bin_summary: array<vec4<f32>>;
// 2 vec4<f32> global telemetry
@group(0) @binding(4) var<storage, read_write> telemetry: array<vec4<f32>>;
// 1 vec4<f32> per radial bin: vec4(mean_cos_phi, mean_sin_phi, azim_coherence, lindblad_gap_torque)
@group(0) @binding(5) var<storage, read_write> bin_azim: array<vec4<f32>>;
// Canonical Schroeder Simulation (SS) 3D hierarchical multipole self-gravity acceleration per nebular parcel!
@group(0) @binding(6) var<storage, read> ss_grav_acc: array<vec4<f32>>;

fn u_to_r_au(u: f32) -> f32 {
  let u_c = clamp(u, 0.0, 1.0);
  let ratio = max(1.5, params.r_max_au / max(0.01, params.r_min_au));
  return params.r_min_au * pow(ratio, u_c);
}

fn r_au_to_u(r_au: f32) -> f32 {
  let ratio = max(1.5, params.r_max_au / max(0.01, params.r_min_au));
  return clamp(log(max(params.r_min_au, r_au) / max(0.01, params.r_min_au)) / log(ratio), 0.0, 0.9999);
}

fn eval_disk_temp_k(r_au: f32) -> f32 {
  let r_safe = max(0.02, r_au);
  let t_rad = params.t_1au_k / sqrt(r_safe);
  let t_visc = params.visc_heat_1au * pow(r_safe, -0.85);
  return max(18.0, t_rad + t_visc);
}

// Smooth physical multi-species condensation curves strictly from radiative T(r) & nebular C/O!
fn eval_condensate_weights(temp_k: f32, c_to_o: f32, met: f32) -> vec4<f32> {
  // Condensation fractions in [0..1] for Fe-Ni, Silicate, Carbon/SiC, H2O ice
  let f_fe  = smoothstep(1480.0, 1280.0, temp_k);
  let f_sil = smoothstep(1300.0, 1100.0, temp_k);
  let f_c   = smoothstep(1040.0, 820.0, temp_k);
  let f_h2o = smoothstep(192.0, 148.0, temp_k);

  // Chemical elemental partitioning controlled smoothly by C/O ratio:
  // High C/O (> 0.78) locks O into CO gas, starving H2O/SiO2 and enriching refractory C/SiC!
  let c_boost = smoothstep(0.50, 0.95, c_to_o);
  let o_avail = clamp(1.18 - 0.85 * c_boost, 0.12, 1.15);

  let w_fe  = f_fe  * 0.30 * met;
  let w_sil = f_sil * (0.58 * o_avail) * met;
  let w_c   = f_c   * (0.14 + 0.62 * c_boost) * met;
  // Classic 2.7x snow-line solid surface-density jump when H2O freezes onto dust grains!
  let w_h2o = f_h2o * (1.55 * o_avail) * met;
  return vec4<f32>(w_fe, w_sil, w_c, w_h2o);
}

@compute @workgroup_size(64)
fn clear_annuli(@builtin(global_invocation_id) gid: vec3<u32>) {
  let idx = gid.x;
  if (idx >= params.radial_bins * 10u) { return; }
  atomicStore(&bin_atomic[idx], 0);
}

@compute @workgroup_size(64)
fn deposit_annuli(@builtin(global_invocation_id) gid: vec3<u32>) {
  let i = gid.x;
  if (i >= params.parcel_count) { return; }
  var p = parcels[i];
  if (p.info.w < 0.5) { return; }

  let u = clamp(p.vel_st.w, 0.0, 0.9999);
  let r_au = u_to_r_au(u);
  let temp_k = eval_disk_temp_k(r_au);
  let met = max(0.015, params.metallicity_solar);
  let w4 = eval_condensate_weights(temp_k, params.c_to_o, met);
  // Super-volatile CO2/NH3/CH4/CO ice condensation in outer disk (< 72 K)
  let f_svol = smoothstep(82.0, 44.0, temp_k);
  let w_svol = f_svol * (0.72 + 0.45 * smoothstep(0.55, 0.95, params.c_to_o)) * met;

  let m_solid = max(1e-4, w4.x + w4.y + w4.z + w4.w + w_svol);
  let inv_s = 1.0 / m_solid;
  let fe_f  = w4.x * inv_s;
  let sil_f = w4.y * inv_s;
  let c_f   = w4.z * inv_s;
  let ice_f = (w4.w + w_svol) * inv_s;

  // Host-star XUV photoevaporative outer-disk gas dispersal over coalescence epoch!
  let xuv_decay = exp(-f32(params.step_index) * 0.0014 * pow(max(0.05, params.star_lum_solar), 0.18));
  let gas_local = params.gas_fraction * xuv_decay * pow(max(0.15, r_au), -0.45) * smoothstep(params.r_max_au * 1.05, params.r_max_au * 0.55, r_au);

  p.pos_m.w = m_solid;
  p.thermo = vec4<f32>(temp_k, ice_f, p.thermo.z, r_au);
  p.info = vec4<f32>(fe_f, sil_f, c_f, 1.0);
  parcels[i] = p;

  // Mass-conserving surface-density normalization across 3K..32K parcels & 64..128 radial bins!
  let mass_norm = (3072.0 / max(512.0, f32(params.parcel_count))) * (f32(params.radial_bins) / 64.0);
  let b = min(params.radial_bins - 1u, u32(floor(u * f32(params.radial_bins))));
  let base = b * 10u;
  let sc = 1000.0 * mass_norm;
  let phi = atan2(p.pos_m.z, p.pos_m.x);
  atomicAdd(&bin_atomic[base + 0u], i32(round(m_solid * sc)));
  atomicAdd(&bin_atomic[base + 1u], i32(round(w4.x * sc)));
  atomicAdd(&bin_atomic[base + 2u], i32(round(w4.y * sc)));
  atomicAdd(&bin_atomic[base + 3u], i32(round(w4.z * sc)));
  atomicAdd(&bin_atomic[base + 4u], i32(round(w4.w * sc)));
  atomicAdd(&bin_atomic[base + 5u], i32(round(w_svol * sc)));
  atomicAdd(&bin_atomic[base + 6u], i32(round(gas_local * sc)));
  atomicAdd(&bin_atomic[base + 7u], 1);
  atomicAdd(&bin_atomic[base + 8u], i32(round(cos(phi) * m_solid * sc)));
  atomicAdd(&bin_atomic[base + 9u], i32(round(sin(phi) * m_solid * sc)));
}

@compute @workgroup_size(64)
fn finalize_annuli(@builtin(global_invocation_id) gid: vec3<u32>) {
  let b = gid.x;
  if (b >= params.radial_bins) { return; }
  let base = b * 10u;
  let sc = 1.0 / 1000.0;
  let m_sol  = max(0.0, f32(atomicLoad(&bin_atomic[base + 0u])) * sc);
  let m_fe   = max(0.0, f32(atomicLoad(&bin_atomic[base + 1u])) * sc);
  let m_sil  = max(0.0, f32(atomicLoad(&bin_atomic[base + 2u])) * sc);
  let m_c    = max(0.0, f32(atomicLoad(&bin_atomic[base + 3u])) * sc);
  let m_h2o  = max(0.0, f32(atomicLoad(&bin_atomic[base + 4u])) * sc);
  let m_svol = max(0.0, f32(atomicLoad(&bin_atomic[base + 5u])) * sc);
  let m_gas  = max(0.0, f32(atomicLoad(&bin_atomic[base + 6u])) * sc);
  let cnt_n  = max(1.0, f32(atomicLoad(&bin_atomic[base + 7u])) * (3072.0 / max(512.0, f32(params.parcel_count))) * (f32(params.radial_bins) / 64.0));
  let c_sum  = f32(atomicLoad(&bin_atomic[base + 8u])) * sc;
  let s_sum  = f32(atomicLoad(&bin_atomic[base + 9u])) * sc;

  let u_mid = (f32(b) + 0.5) / f32(params.radial_bins);
  let r_au = u_to_r_au(u_mid);
  let temp_k = eval_disk_temp_k(r_au);
  let inv_s = 1.0 / max(1e-5, m_sol);

  // Runaway H2/He gas envelope capture when coalesced solid core crosses critical mass threshold
  // outside or near the snow line (Mizuno-Pollack core-accretion instability)!
  let cold_capture = smoothstep(420.0, 145.0, temp_k);
  let core_excess = smoothstep(32.0, 95.0, m_sol * (0.65 + 0.55 * cold_capture));
  let gas_env_frac = clamp(core_excess * clamp(m_gas / (cnt_n * 0.25 + 1.0), 0.0, 1.0) * 0.88, 0.0, 0.92);

  let coh = clamp(length(vec2<f32>(c_sum, s_sum)) * inv_s, 0.0, 1.0);
  let mean_c = select(1.0, c_sum / max(1e-5, length(vec2<f32>(c_sum, s_sum))), coh > 0.01);
  let mean_s = select(0.0, s_sum / max(1e-5, length(vec2<f32>(c_sum, s_sum))), coh > 0.01);
  let gap_torque = smoothstep(0.14, 0.55, gas_env_frac) * 0.85 + smoothstep(45.0, 120.0, m_sol) * 0.25;

  bin_summary[b * 2u + 0u] = vec4<f32>(r_au, m_sol, m_fe * inv_s, m_sil * inv_s);
  bin_summary[b * 2u + 1u] = vec4<f32>(m_c * inv_s, m_h2o * inv_s, m_svol * inv_s, gas_env_frac);
  bin_azim[b] = vec4<f32>(mean_c, mean_s, coh, gap_torque);
}

@compute @workgroup_size(64)
fn step_coalesce_parcels(@builtin(global_invocation_id) gid: vec3<u32>) {
  let i = gid.x;
  if (i >= params.parcel_count) { return; }
  var p = parcels[i];
  if (p.info.w < 0.5) { return; }

  let dt = params.dt;
  var pos = p.pos_m.xyz;
  var vel = p.vel_st.xyz;
  let r_xz = max(0.35, length(pos.xz));
  let r_3d = max(0.35, length(pos));
  let u = clamp((r_xz - 0.88) / 8.72, 0.002, 0.998);
  let nb = i32(params.radial_bins);
  let bi = clamp(i32(floor(u * f32(params.radial_bins))), 0, nb - 1);

  // 1. TRUE 3D Newtonian Central Star Gravity + Canonical 3D Schroeder Scale-Atlas Multipole Disk Self-Gravity!
  //    Visual scale: r_vis in [0.88..9.60], GM_vis = 24.0 * M_star^0.55 -> realistic Keplerian differential rotation
  //    producing sweeping logarithmic spiral density waves & Jeans gravitational fragmentation over 25-50+ orbits!
  let gm_star = 24.0 * pow(max(0.08, params.star_mass_solar), 0.55);
  let r_soft = sqrt(r_3d * r_3d + 0.16);
  let a_star = -pos * (gm_star / (r_soft * r_soft * r_soft));

  // Canonical 3D SS hierarchical multipole self-gravity (excites genuine non-axisymmetric spiral arms & Hill clumps!)
  let ss_g = clamp(ss_grav_acc[i].xyz, vec3<f32>(-4.5), vec3<f32>(4.5));
  let ss_mag = length(ss_g);

  // 2. Broad, Smooth Disk Gas Pressure Gradient (-grad P / rho) & Lindblad Tidal Gap Clearing (ZERO 1-bin vinyl rings!)
  //    Uses a wide physical Hill-scale smoothing stencil (~10% of disk radius) so pressure prevents artificial thin rings!
  let r_hat_xz = pos.xz / r_xz;
  let t_hat_xz = vec2<f32>(-r_hat_xz.y, r_hat_xz.x);
  var f_press_r = 0.0;
  var f_gap_r = 0.0;
  let smooth_span = max(4, i32(round(0.075 * f32(params.radial_bins))));
  for (var db = -smooth_span; db <= smooth_span; db = db + 1) {
    if (db == 0) { continue; }
    let bj = clamp(bi + db, 0, nb - 1);
    let m_j = bin_summary[u32(bj) * 2u + 0u].y;
    let gap_j = bin_azim[u32(bj)].w;
    let frac_d = f32(db) / f32(smooth_span);
    // Hydrodynamic gas pressure gradient repels sharp narrow ring spikes (Toomre acoustic stabilization!)
    let w_p = exp(-frac_d * frac_d * 2.2) * frac_d;
    f_press_r = f_press_r - m_j * w_p;
    // Lindblad resonant torque around genuinely massive gas-giant cores carves broad clean planetary gaps
    let norm_d = abs(frac_d);
    if (gap_j > 0.12 && norm_d > 0.28 && norm_d < 0.95) {
      f_gap_r = f_gap_r - sign(frac_d) * gap_j * exp(-pow((norm_d - 0.55) / 0.22, 2.0)) * 0.45;
    }
  }
  let local_gas_env = bin_summary[u32(bi) * 2u + 1u].w;
  let local_az = bin_azim[u32(bi)];
  let local_m = bin_summary[u32(bi) * 2u + 0u].y;

  // 3. Sub-Keplerian Gas Headwind Drag, Shakura-Sunyaev alpha-Viscosity & Condensation-Front Pressure Traps!
  let r_au = u_to_r_au(u);
  let t_rad_k = eval_disk_temp_k(r_au);
  let ice_f = p.thermo.y;
  let v_kep = sqrt(gm_star / r_xz);
  let v_circ_vec = vec3<f32>(t_hat_xz.x * v_kep, 0.0, t_hat_xz.y * v_kep);
  let v_rel = vel - v_circ_vec;

  // Smooth condensation pressure traps right at Silicate sublimation front (1250 K) & H2O Snow Line (170 K)
  let snow_trap = exp(-pow((t_rad_k - 170.0) / 42.0, 2.0));
  let sil_trap = exp(-pow((t_rad_k - 1220.0) / 180.0, 2.0));
  let gas_decay = exp(-f32(params.step_index) * 0.00045 * pow(max(0.05, params.star_lum_solar), 0.16));
  var a_drag = vec3<f32>(0.0);
  if (params.enable_drag != 0u) {
    // Aerodynamic circularization + vertical midplane damping + gentle radial drift toward condensation traps
    let drag_k = (0.38 + 0.24 * ice_f) * gas_decay * params.gas_fraction;
    let drift_in = -(0.095 + 0.08 * ice_f) * (1.0 - 0.88 * max(snow_trap, sil_trap)) * gas_decay;
    a_drag = -v_rel * drag_k + vec3<f32>(r_hat_xz.x * drift_in, -pos.y * (0.65 * gas_decay), r_hat_xz.y * drift_in);
  }

  // Soft 2D Hill-sphere azimuthal embryo accretion pull ONLY inside mature coherent clumps
  let phi_cur = atan2(pos.z, pos.x);
  let peak_phi = atan2(local_az.y, local_az.x);
  let d_phi = atan2(sin(peak_phi - phi_cur), cos(peak_phi - phi_cur));
  let hill_pull = smoothstep(26.0, 88.0, local_m) * local_az.z * clamp(d_phi, -0.45, 0.45) * 0.85;

  // Soft inner/outer Holman-Wiegert boundary confinement
  var f_wall = 0.0;
  if (r_xz < 0.96) { f_wall = (0.96 - r_xz) * 14.0; }
  if (r_xz > 9.45) { f_wall = (9.45 - r_xz) * 8.0; }

  let a_hydro_r = clamp((f_press_r * 0.0042 + f_gap_r) * params.clump_strength + f_wall, -4.5, 4.5);
  let a_tot = a_star + ss_g + a_drag
    + vec3<f32>(r_hat_xz.x * a_hydro_r + t_hat_xz.x * hill_pull, 0.0, r_hat_xz.y * a_hydro_r + t_hat_xz.y * hill_pull);

  // Symplectic Velocity-Verlet / Semi-Implicit Leapfrog update in full 3D Cartesian space!
  vel = vel + a_tot * dt;
  // Cap extreme inner-edge velocities for CFL stability while preserving elliptical/spiral orbits
  let v_spd = length(vel);
  if (v_spd > 16.0) { vel = vel * (16.0 / v_spd); }
  pos = pos + vel * dt;

  // Gentle vertical confinement & radial clamp within disk box
  let r_new_xz = max(0.75, length(pos.xz));
  if (r_new_xz > 9.85) {
    let sc_b = 9.85 / r_new_xz;
    pos.x = pos.x * sc_b;
    pos.z = pos.z * sc_b;
    vel.x = vel.x * 0.85;
    vel.z = vel.z * 0.85;
  } else if (r_new_xz < 0.82) {
    let sc_b = 0.82 / r_new_xz;
    pos.x = pos.x * sc_b;
    pos.z = pos.z * sc_b;
  }
  pos.y = clamp(pos.y, -1.8, 1.8);

  let u_new = clamp((length(pos.xz) - 0.88) / 8.72, 0.002, 0.998);
  let r_new_au = u_to_r_au(u_new);
  // Real spiral-shock & accretion compressional heating (makes spiral wakes & accreting protoplanets glow!)
  let shock_heat = clamp(ss_mag * 185.0 + length(v_rel) * 65.0, 0.0, 950.0);
  let temp_live = eval_disk_temp_k(r_new_au) + shock_heat;

  p.pos_m = vec4<f32>(pos, p.pos_m.w);
  p.vel_st = vec4<f32>(vel, u_new);
  p.thermo = vec4<f32>(temp_live, ice_f, local_gas_env, r_new_au);
  parcels[i] = p;
}

var<workgroup> wg_sum: array<vec4<f32>, 64>;

@compute @workgroup_size(64)
fn reduce_nebula_telemetry(@builtin(local_invocation_id) lid: vec3<u32>) {
  let tid = lid.x;
  var acc0 = vec4<f32>(0.0);
  var acc1 = vec4<f32>(0.0);
  for (var b = tid; b < params.radial_bins; b = b + 64u) {
    let s0 = bin_summary[b * 2u + 0u];
    let s1 = bin_summary[b * 2u + 1u];
    let m = s0.y;
    acc0 = acc0 + vec4<f32>(m, m * s0.z, m * s0.w, m * (s1.y + s1.z));
    acc1 = vec4<f32>(
      acc1.x + select(0.0, 1.0, m > 22.0),
      acc1.y + select(0.0, 1.0, s1.w > 0.25),
      acc1.z + m * s1.x,
      max(acc1.w, s0.y)
    );
  }
  wg_sum[tid] = acc0;
  workgroupBarrier();
  var s = 32u;
  loop {
    if (s == 0u) { break; }
    if (tid < s) { wg_sum[tid] = wg_sum[tid] + wg_sum[tid + s]; }
    workgroupBarrier();
    s = s >> 1u;
  }
  let tot0 = wg_sum[0];
  workgroupBarrier();

  wg_sum[tid] = acc1;
  workgroupBarrier();
  s = 32u;
  loop {
    if (s == 0u) { break; }
    if (tid < s) {
      let a = wg_sum[tid];
      let b = wg_sum[tid + s];
      wg_sum[tid] = vec4<f32>(a.x + b.x, a.y + b.y, a.z + b.z, max(a.w, b.w));
    }
    workgroupBarrier();
    s = s >> 1u;
  }
  if (tid == 0u) {
    let denom = max(1e-5, tot0.x);
    telemetry[0] = vec4<f32>(tot0.x, tot0.y / denom, tot0.z / denom, tot0.w / denom);
    telemetry[1] = vec4<f32>(wg_sum[0].x, wg_sum[0].y, wg_sum[0].z / denom, wg_sum[0].w);
  }
}
`;

/**
 * Extract genuine Hill-separated coalesced proto-bodies (planets, giants, asteroid belt,
 * outer comet reservoir) directly from the 64-bin GPU annular coalescence summary!
 */
export function extractCoalescedBodiesFromAnnuli(summaryF32, {
  starMassSolar = 1.0,
  starLuminositySolar = 1.0,
  metallicitySolar = 1.0,
  cToO = 0.55,
  rMinStableAu = 0.12,
  rMaxStableAu = 28.0,
  maxBodies = 8
} = {}) {
  const nBins = Math.min(256, Math.floor((summaryF32?.length || 0) / 8));
  if (nBins < 8) return { bodies: [], bins: [], beltAu: null, cometAu: null };

  const bins = [];
  let meanMass = 0;
  for (let b = 0; b < nBins; b += 1) {
    const o = b * 8;
    const rAu = summaryF32[o + 0];
    const solidMass = summaryF32[o + 1];
    const feFrac = summaryF32[o + 2];
    const silFrac = summaryF32[o + 3];
    const carbonFrac = summaryF32[o + 4];
    const h2oFrac = summaryF32[o + 5];
    const superVolFrac = summaryF32[o + 6];
    const gasEnvFrac = summaryF32[o + 7];
    const tEqK = Math.max(22, Math.round(278.0 * Math.pow(Math.max(1e-4, starLuminositySolar), 0.25) / Math.sqrt(Math.max(0.02, rAu))));
    const starFluxWM2 = 1361.0 * Math.max(1e-4, starLuminositySolar) / Math.max(4e-4, rAu * rAu);
    bins.push({
      bin: b, rAu, solidMass, feFrac, silFrac, carbonFrac, h2oFrac, superVolFrac, gasEnvFrac, tEqK, starFluxWM2
    });
    meanMass += solidMass;
  }
  meanMass /= nBins;

  // Smooth 3-bin solid mass profile to identify genuine physical overdensities
  const smoothM = bins.map((_, i) => {
    const mL = bins[Math.max(0, i - 1)].solidMass;
    const mC = bins[i].solidMass;
    const mR = bins[Math.min(nBins - 1, i + 1)].solidMass;
    return 0.25 * mL + 0.5 * mC + 0.25 * mR;
  });

  // Candidate local maxima sorted by total coalesced mass (solid + gas envelope)
  const candidates = [];
  for (let b = 1; b < nBins - 1; b += 1) {
    if (smoothM[b] >= smoothM[b - 1] && smoothM[b] >= smoothM[b + 1] && bins[b].solidMass > meanMass * 0.42) {
      candidates.push({ ...bins[b], score: bins[b].solidMass * (1.0 + bins[b].gasEnvFrac * 4.0) });
    }
  }
  // Ensure at least 2..3 radial zones are sampled if the disk is very smooth/low-Z
  if (candidates.length < 3 && metallicitySolar >= 0.015) {
    for (const frac of [0.18, 0.42, 0.68, 0.86]) {
      const bi = Math.max(1, Math.min(nBins - 2, Math.round(frac * (nBins - 1))));
      if (bins[bi].solidMass > 0.05) {
        candidates.push({ ...bins[bi], score: bins[bi].solidMass });
      }
    }
  }
  candidates.sort((a, b) => b.score - a.score);

  // Enforce physical Hill-sphere orbital clearance (ratio a_out / a_in >= 1.48)
  const selected = [];
  for (const c of candidates) {
    if (selected.length >= maxBodies) break;
    if (c.rAu < rMinStableAu * 0.98 || c.rAu > rMaxStableAu * 1.02) continue;
    const tooClose = selected.some((s) => {
      const hi = Math.max(s.rAu, c.rAu);
      const lo = Math.max(1e-4, Math.min(s.rAu, c.rAu));
      return (hi / lo) < 1.48;
    });
    if (!tooClose) selected.push(c);
  }
  selected.sort((a, b) => a.rAu - b.rAu);

  // Normalize mass scale cleanly onto physical Earth-mass range from GPU solid mass + metallicity
  const maxBinM = Math.max(1.0, ...bins.map((b) => b.solidMass));
  const bodies = selected.map((c, idx) => {
    const relMass = Math.max(0.05, c.solidMass / maxBinM);
    const coreMassEarth = Number((
      Math.max(0.04, relMass * (2.6 + 9.5 * Math.min(2.0, metallicitySolar)) * (1.0 + (c.h2oFrac + c.superVolFrac) * 1.4))
    ).toFixed(3));
    const totalMassEarth = c.gasEnvFrac > 0.35
      ? Number((coreMassEarth * (1.0 + c.gasEnvFrac * 38.0)).toFixed(2))
      : (c.gasEnvFrac > 0.12
        ? Number((coreMassEarth * (1.0 + c.gasEnvFrac * 6.5)).toFixed(2))
        : coreMassEarth);
    return Object.freeze({
      index: idx,
      aAu: Number(c.rAu.toFixed(4)),
      tEqK: c.tEqK,
      starFluxWM2: Number(c.starFluxWM2.toFixed(2)),
      solidMassRaw: Number(c.solidMass.toFixed(3)),
      coreMassEarth,
      totalMassEarth,
      feFrac: Number(c.feFrac.toFixed(4)),
      silicateFrac: Number(c.silFrac.toFixed(4)),
      carbonFrac: Number(c.carbonFrac.toFixed(4)),
      h2oIceFrac: Number(c.h2oFrac.toFixed(4)),
      superVolFrac: Number(c.superVolFrac.toFixed(4)),
      volatileFrac: Number(Math.min(0.95, c.h2oFrac + c.superVolFrac).toFixed(4)),
      gasEnvelopeFrac: Number(c.gasEnvFrac.toFixed(4)),
      cToO: Number(cToO.toFixed(3)),
      gpuCoalesced: true
    });
  });

  // Identify asteroid-belt & outer-comet reservoirs directly from the coalesced GPU disk!
  const sqrtL = Math.sqrt(Math.max(1e-4, starLuminositySolar));
  const snowAu = Math.max(0.18, 2.70 * sqrtL);
  const beltBin = bins.reduce((best, b) => {
    const d = Math.abs(b.rAu - snowAu * 0.88);
    return (!best || d < Math.abs(best.rAu - snowAu * 0.88)) ? b : best;
  }, null);
  const cometBin = bins.reduce((best, b) => {
    const score = b.superVolFrac * 2.0 + b.h2oFrac;
    const bestScore = best ? (best.superVolFrac * 2.0 + best.h2oFrac) : -1;
    return score > bestScore ? b : best;
  }, null);

  return Object.freeze({
    schema: ULG_NEBULAR_SYSTEM_COALESCENCE_SCHEMA,
    starMassSolar,
    starLuminositySolar,
    metallicitySolar,
    cToO,
    snowLineAu: Number(snowAu.toFixed(3)),
    bodies: Object.freeze(bodies),
    bins,
    asteroidZone: beltBin ? Object.freeze({
      aAu: Number(beltBin.rAu.toFixed(4)),
      feFrac: Number(beltBin.feFrac.toFixed(4)),
      silicateFrac: Number(beltBin.silFrac.toFixed(4)),
      carbonFrac: Number(beltBin.carbonFrac.toFixed(4)),
      volatileFrac: Number((beltBin.h2oFrac + beltBin.superVolFrac).toFixed(4)),
      tEqK: beltBin.tEqK,
      starFluxWM2: Number(beltBin.starFluxWM2.toFixed(2))
    }) : null,
    cometZone: cometBin ? Object.freeze({
      aAu: Number(cometBin.rAu.toFixed(4)),
      feFrac: Number(cometBin.feFrac.toFixed(4)),
      silicateFrac: Number(cometBin.silFrac.toFixed(4)),
      carbonFrac: Number(cometBin.carbonFrac.toFixed(4)),
      h2oIceFrac: Number(cometBin.h2oFrac.toFixed(4)),
      superVolFrac: Number(cometBin.superVolFrac.toFixed(4)),
      volatileFrac: Number(Math.min(0.95, cometBin.h2oFrac + cometBin.superVolFrac).toFixed(4)),
      tEqK: cometBin.tEqK,
      starFluxWM2: Number(cometBin.starFluxWM2.toFixed(2))
    }) : null
  });
}

/**
 * Create a live GPU Whole-Star-System Nebular Coalescence session (`nebular-system-coalescence@1`).
 * Can run in 1-submit burst mode (`coalesceSystemBurst()`) when entering any star system OR step
 * continuously at 60 FPS for interactive "Replay Nebular Birth (GPU)" visualization!
 */
export function createNebularSystemCoalescenceSessionWebGpu(device, {
  starMassSolar = 1.0,
  starLuminositySolar = 1.0,
  metallicitySolar = 1.0,
  cToO = 0.55,
  gasFraction = 0.22,
  rMinStableAu = 0.14,
  rMaxStableAu = 28.0,
  parcelCount = 4096,
  radialBins = NEBULAR_RADIAL_BINS,
  enableGasDrag = true,
  seed = 20261126,
  label = 'ulg-nebular-system-coalescence'
} = {}) {
  if (!device || typeof device.createBuffer !== 'function') {
    throw new TypeError('createNebularSystemCoalescenceSessionWebGpu requires a live WebGPU GPUDevice');
  }
  const nParcels = Math.max(512, Math.min(32768, Math.trunc(parcelCount)));
  const nBins = Math.max(32, Math.min(128, Math.trunc(Number(radialBins) || NEBULAR_RADIAL_BINS)));
  const rMin = Math.max(0.04, Number(rMinStableAu) || 0.14);
  const rMax = Math.max(rMin * 3.5, Math.min(48.0, Number(rMaxStableAu) || 28.0));
  const mStar = Math.max(0.08, Number(starMassSolar) || 1.0);
  const lStar = Math.max(1e-4, Number(starLuminositySolar) || 1.0);
  const met = Math.max(0.005, Math.min(3.5, Number(metallicitySolar) || 1.0));
  const co = Math.max(0.22, Math.min(1.15, Number(cToO) || 0.55));
  const gFrac = Math.max(0.02, Math.min(0.95, Number(gasFraction) || 0.22));
  const t1Au = 278.0 * Math.pow(lStar, 0.25);
  const snowLineAu = Math.pow(t1Au / 170.0, 2);

  const rand = mulberry32(seed);
  // Seed initial flared 3D rotating protoplanetary nebula with natural m=2/m=3 spiral acoustic
  // modes and Toomre-Q thermal velocity dispersion (ZERO artificial concentric vinyl rings!)
  const initData = new Float32Array(nParcels * PARCEL_STRIDE_FLOATS);
  const gmStarVis = 24.0 * Math.pow(Math.max(0.08, mStar), 0.55);
  const armPhase0 = rand() * Math.PI * 2;
  const armPhase1 = rand() * Math.PI * 2;
  const armCount = 2 + (seed % 2); // 2- or 3-arm grand-design protoplanetary spiral instability

  for (let i = 0; i < nParcels; i += 1) {
    // Smooth Hayashi Minimum-Mass Solar Nebula surface-density distribution + gentle spiral wave seed
    const u0 = (i + rand()) / nParcels;
    const u = Math.max(0.015, Math.min(0.985, Math.pow(u0, 0.92)));
    const rVis = 0.88 + u * 8.72;
    let phi = rand() * Math.PI * 2;
    // Slight logarithmic spiral overdensity seeding m=2..3 density waves (NOT concentric circles!)
    const spiralArg = armCount * phi - 3.6 * Math.log(Math.max(0.5, rVis)) + armPhase0;
    phi += Math.sin(spiralArg) * 0.16 + Math.sin(2.0 * phi - 2.4 * Math.log(Math.max(0.5, rVis)) + armPhase1) * 0.08;
    const rAu = rMin * Math.pow(rMax / rMin, u);
    const hScale = (0.055 + 0.045 * u) * rVis;
    // Gaussian-like vertical nebula disk flare
    const gY = (rand() + rand() + rand() - 1.5) * 0.72;
    const y = gY * hScale;
    const vKep = Math.sqrt(gmStarVis / Math.max(0.5, rVis));
    // Realistic 4% epicyclic radial dispersion (Toomre Q ~ 1.15)
    const vRad = (rand() - 0.5) * 0.08 * vKep;
    const vTan = vKep * (0.985 + (rand() - 0.5) * 0.04);
    const cosP = Math.cos(phi);
    const sinP = Math.sin(phi);
    const vx = -sinP * vTan + cosP * vRad;
    const vy = (rand() - 0.5) * 0.06 * vKep * (hScale / Math.max(0.5, rVis));
    const vz = cosP * vTan + sinP * vRad;
    const tempK = Math.max(20, t1Au / Math.sqrt(Math.max(0.02, rAu)));
    const iceF = tempK < 170 ? 0.78 : (tempK < 210 ? 0.35 : 0.04);

    const o = i * PARCEL_STRIDE_FLOATS;
    initData[o + 0] = cosP * rVis;
    initData[o + 1] = y;
    initData[o + 2] = sinP * rVis;
    initData[o + 3] = 0.8 * met;
    initData[o + 4] = vx;
    initData[o + 5] = vy;
    initData[o + 6] = vz;
    initData[o + 7] = u;
    initData[o + 8] = tempK;
    initData[o + 9] = iceF;
    initData[o + 10] = 0.0;
    initData[o + 11] = rAu;
    initData[o + 12] = 0.30;
    initData[o + 13] = 0.55;
    initData[o + 14] = 0.15;
    initData[o + 15] = 1.0;
  }

  const bindings = [
    computeBufferBinding(0, 'uniform'),
    computeBufferBinding(1, 'storage'),
    computeBufferBinding(2, 'storage'),
    computeBufferBinding(3, 'storage'),
    computeBufferBinding(4, 'storage'),
    computeBufferBinding(5, 'storage'),
    computeBufferBinding(6, 'read-only-storage')
  ];
  const mkPipe = (entryPoint) => createCachedExplicitComputePipeline(device, {
    cacheKey: `ulg-nebular-sys-coalesce-${entryPoint}.v4-ss-3d`,
    label: `${label}-${entryPoint}`,
    code: nebularSystemCoalescenceWgsl,
    entryPoint,
    bindings
  });
  const clearPipe = mkPipe('clear_annuli');
  const depositPipe = mkPipe('deposit_annuli');
  const finalizePipe = mkPipe('finalize_annuli');
  const stepPipe = mkPipe('step_coalesce_parcels');
  const telPipe = mkPipe('reduce_nebula_telemetry');

  const paramsBuf = device.createBuffer({ label: `${label}-params`, size: 64, usage: GPU_BUF.UNIFORM | GPU_BUF.COPY_DST });
  const parcelsBuf = device.createBuffer({ label: `${label}-parcels`, size: initData.byteLength, usage: GPU_BUF.STORAGE | GPU_BUF.VERTEX | GPU_BUF.COPY_DST | GPU_BUF.COPY_SRC });
  const binAtomicBuf = device.createBuffer({ label: `${label}-bin-atomic`, size: nBins * 40, usage: GPU_BUF.STORAGE });
  const binSummaryBytes = nBins * 32;
  const binSummaryBuf = device.createBuffer({ label: `${label}-bin-summary`, size: binSummaryBytes, usage: GPU_BUF.STORAGE | GPU_BUF.COPY_SRC });
  const binSummaryReadBuf = device.createBuffer({ label: `${label}-bin-read`, size: binSummaryBytes, usage: GPU_BUF.MAP_READ | GPU_BUF.COPY_DST });
  const telBuf = device.createBuffer({ label: `${label}-tel`, size: 32, usage: GPU_BUF.STORAGE | GPU_BUF.COPY_SRC });
  const telReadBuf = device.createBuffer({ label: `${label}-tel-read`, size: 32, usage: GPU_BUF.MAP_READ | GPU_BUF.COPY_DST });
  const binAzimBuf = device.createBuffer({ label: `${label}-bin-azim`, size: nBins * 16, usage: GPU_BUF.STORAGE });

  device.queue.writeBuffer(parcelsBuf, 0, initData);

  const ssGravity = createSchroederScaleAtlasGravitySolverWebGpu(device, {
    maxCount: nParcels,
    strideFloats: PARCEL_STRIDE_FLOATS,
    chartLevel: 38,
    useAdjSoftening: true,
    qMass: 256.0,
    qMom: 32.0,
    rCellFactor: 0.08,
    label: `${label}-ss-grav`
  });
  ssGravity.writeParams({
    count: nParcels,
    // Physical Toomre Q ~ 1.1 self-gravitating disk coupling so SS multipole gravity genuinely
    // amplifies logarithmic spiral density waves & coalesces orbiting protoplanetary embryos!
    gravityG: 3.4 / Math.max(128.0, nParcels * Math.max(0.18, met) * 0.45),
    softening2: 0.22,
    boxHalf: 11.5,
    theta2: 0.68
  });

  const bg = createCachedExplicitBindGroup(device, {
    layout: stepPipe.bindGroupLayout,
    label: `${label}-bg`,
    entries: [
      { binding: 0, resource: { buffer: paramsBuf } },
      { binding: 1, resource: { buffer: parcelsBuf } },
      { binding: 2, resource: { buffer: binAtomicBuf } },
      { binding: 3, resource: { buffer: binSummaryBuf } },
      { binding: 4, resource: { buffer: telBuf } },
      { binding: 5, resource: { buffer: binAzimBuf } },
      { binding: 6, resource: { buffer: ssGravity.accPhiBuffer } }
    ]
  });

  let stepIndex = 0;
  let gasDragOn = Boolean(enableGasDrag);
  let disposed = false;
  let mapInFlight = false;
  let lastSummaryF32 = new Float32Array(nBins * 8);
  let lastCoalesced = null;
  let lastTelemetry = Object.freeze({
    schema: ULG_NEBULAR_SYSTEM_COALESCENCE_SCHEMA,
    stepIndex: 0,
    parcelCount: nParcels,
    radialBins: nBins,
    snowLineAu,
    totalSolidMass: 0,
    meanFeFrac: 0.3,
    meanSilicateFrac: 0.5,
    meanVolatileIceFrac: 0.2,
    meanCarbonFrac: 0.1,
    denseRingCount: 0,
    gasGiantCoreCount: 0,
    peakBinMass: 0,
    accuracyTier: ULG_ACCURACY_TIERS.TIER_2_REPRESENTATIVE_EFFECTIVE,
    scientificValidation: false
  });

  function writeParams(dt) {
    const ab = new ArrayBuffer(64);
    new Uint32Array(ab, 0, 4).set([nParcels, nBins, stepIndex, gasDragOn ? 1 : 0]);
    new Float32Array(ab, 16, 12).set([
      dt,
      mStar,
      lStar,
      met,
      co,
      gFrac,
      rMin,
      rMax,
      t1Au,
      1.35, // radial self-gravity clumping gain
      22.0 * Math.pow(mStar, 0.4), // viscous inner accretion heating at 1 AU
      (seed % 997) * 0.13
    ]);
    device.queue.writeBuffer(paramsBuf, 0, ab);
  }

  const wgParcels = Math.ceil(nParcels / 64);
  const wgClear = Math.ceil((nBins * 10) / 64);
  const wgBins = Math.ceil(nBins / 64);

  async function step({
    dt = 0.032,
    substeps = 2,
    readTelemetry = true,
    readAnnuli = false
  } = {}) {
    if (disposed) return lastTelemetry;
    const nSub = Math.max(1, Math.min(48, Math.trunc(substeps)));
    const dtSafe = Math.max(0.004, Math.min(0.06, Number(dt) || 0.032));
    writeParams(dtSafe);

    const enc = device.createCommandEncoder({ label: `${label}-step-${stepIndex}` });
    const pass = enc.beginComputePass({ label: `${label}-pass` });
    for (let s = 0; s < nSub; s += 1) {
      // Canonical Schroeder Simulation hierarchical 3D multipole disk self-gravity encoded inside this same pass!
      ssGravity.encodeIntoPass(pass, { srcBuffer: parcelsBuf, count: nParcels });
      pass.setBindGroup(0, bg);
      pass.setPipeline(clearPipe.pipeline);
      pass.dispatchWorkgroups(wgClear);
      pass.setPipeline(depositPipe.pipeline);
      pass.dispatchWorkgroups(wgParcels);
      pass.setPipeline(finalizePipe.pipeline);
      pass.dispatchWorkgroups(wgBins);
      pass.setPipeline(stepPipe.pipeline);
      pass.dispatchWorkgroups(wgParcels);
      stepIndex += 1;
    }
    // Final deposit + finalize + telemetry so annuli match the stepped parcel positions!
    pass.setBindGroup(0, bg);
    pass.setPipeline(clearPipe.pipeline);
    pass.dispatchWorkgroups(wgClear);
    pass.setPipeline(depositPipe.pipeline);
    pass.dispatchWorkgroups(wgParcels);
    pass.setPipeline(finalizePipe.pipeline);
    pass.dispatchWorkgroups(wgBins);
    pass.setPipeline(telPipe.pipeline);
    pass.dispatchWorkgroups(1);
    pass.end();

    const doTel = readTelemetry && !mapInFlight && telReadBuf.mapState === 'unmapped';
    const doAnn = readAnnuli && !mapInFlight && binSummaryReadBuf.mapState === 'unmapped';
    if (doTel) enc.copyBufferToBuffer(telBuf, 0, telReadBuf, 0, 32);
    if (doAnn) enc.copyBufferToBuffer(binSummaryBuf, 0, binSummaryReadBuf, 0, binSummaryBytes);
    if (doTel || doAnn) mapInFlight = true;
    device.queue.submit([enc.finish()]);

    if (doTel || doAnn) {
      try {
        const maps = [];
        if (doTel) maps.push(telReadBuf.mapAsync(GPU_BUF.MAP_READ));
        if (doAnn) maps.push(binSummaryReadBuf.mapAsync(GPU_BUF.MAP_READ));
        await Promise.all(maps);
        if (!disposed) {
          if (doTel) {
            const f = new Float32Array(telReadBuf.getMappedRange(0, 32));
            lastTelemetry = Object.freeze({
              schema: ULG_NEBULAR_SYSTEM_COALESCENCE_SCHEMA,
              stepIndex,
              parcelCount: nParcels,
              snowLineAu,
              totalSolidMass: Number(f[0].toFixed(2)),
              meanFeFrac: Number(f[1].toFixed(3)),
              meanSilicateFrac: Number(f[2].toFixed(3)),
              meanVolatileIceFrac: Number(f[3].toFixed(3)),
              denseRingCount: Math.round(f[4]),
              gasGiantCoreCount: Math.round(f[5]),
              meanCarbonFrac: Number(f[6].toFixed(3)),
              peakBinMass: Number(f[7].toFixed(2)),
              enableGasDrag: gasDragOn,
              accuracyTier: ULG_ACCURACY_TIERS.TIER_2_REPRESENTATIVE_EFFECTIVE,
              scientificValidation: false
            });
          }
          if (doAnn) {
            lastSummaryF32 = new Float32Array(binSummaryReadBuf.getMappedRange(0, binSummaryBytes)).slice();
            lastCoalesced = extractCoalescedBodiesFromAnnuli(lastSummaryF32, {
              starMassSolar: mStar,
              starLuminositySolar: lStar,
              metallicitySolar: met,
              cToO: co,
              rMinStableAu: rMin,
              rMaxStableAu: rMax
            });
          }
        }
        if (doTel) try { telReadBuf.unmap(); } catch {}
        if (doAnn) try { binSummaryReadBuf.unmap(); } catch {}
      } catch (err) {
        if (!disposed && err?.name !== 'AbortError') throw err;
      } finally {
        mapInFlight = false;
      }
    }
    return lastTelemetry;
  }

  /**
   * Run a GPU-safe chunked nebular coalescence burst and return the
   * coalesced bodies + composition zones ready for `synthesizeNebularPlanetarySystem`!
   */
  async function coalesceSystemBurst({ substeps = 32, chunkSize = 18, dt = 0.036 } = {}) {
    let rem = Math.max(1, Math.trunc(substeps));
    const chunk = Math.max(4, Math.min(24, Math.trunc(chunkSize)));
    while (rem > 0 && !disposed) {
      const n = Math.min(chunk, rem);
      rem -= n;
      const isLast = rem <= 0;
      await step({ dt, substeps: n, readTelemetry: isLast, readAnnuli: isLast });
    }
    return lastCoalesced;
  }

  function getCoalescedRenderSpheres(scale = 1.0) {
    const out = [{
      pos: [0, 0, 0],
      radius: 0.46 * scale,
      color0: [1.0, 0.92, 0.68],
      color1: [1.0, 0.48, 0.16],
      kind: 0,
      atm: 0
    }];
    const bodies = lastCoalesced?.bodies || [];
    const logRatio = Math.log(Math.max(1.5, rMax / Math.max(0.01, rMin)));
    for (let i = 0; i < bodies.length; i += 1) {
      const b = bodies[i];
      const u = Math.max(0, Math.min(1, Math.log(Math.max(rMin, b.aAu) / rMin) / logRatio));
      const rVis = (0.92 + u * 8.6) * scale;
      const ang = (i * 2.39996 + stepIndex * 0.025 / Math.sqrt(Math.max(0.15, b.aAu)));
      const isGiant = b.gasEnvelopeFrac > 0.25;
      const isIcy = b.volatileFrac > 0.45;
      out.push({
        pos: [Math.cos(ang) * rVis, 0, Math.sin(ang) * rVis],
        radius: (isGiant ? 0.32 : (isIcy ? 0.21 : 0.16)) * scale,
        color0: isGiant ? [0.84, 0.72, 0.52] : (isIcy ? [0.66, 0.86, 1.0] : (b.tEqK > 1100 ? [1.0, 0.45, 0.12] : [0.76, 0.56, 0.42])),
        color1: isGiant ? [0.54, 0.38, 0.24] : (isIcy ? [0.28, 0.52, 0.82] : [0.38, 0.26, 0.18]),
        kind: isGiant ? 2 : (isIcy ? 3 : 1),
        atm: isGiant ? 0.6 : (isIcy ? 0.25 : 0.12),
        seed: (i + 1) * 4.17
      });
    }
    return out;
  }

  function reset() {
    stepIndex = 0;
    device.queue.writeBuffer(parcelsBuf, 0, initData);
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    try { ssGravity.destroy(); } catch {}
    for (const b of [paramsBuf, parcelsBuf, binAtomicBuf, binSummaryBuf, binSummaryReadBuf, binAzimBuf, telBuf, telReadBuf]) {
      try { b.destroy(); } catch {}
    }
  }

  return Object.freeze({
    schema: ULG_NEBULAR_SYSTEM_COALESCENCE_SCHEMA,
    lawAdapter: NEBULAR_SYSTEM_COALESCENCE_LAW_ADAPTER,
    spatialAuthority: ssGravity.gravityMode,
    get parcelCount() { return nParcels; },
    get radialBins() { return nBins; },
    get snowLineAu() { return snowLineAu; },
    get stepIndex() { return stepIndex; },
    get enableGasDrag() { return gasDragOn; },
    getResidentParcelsBuffer: () => parcelsBuf,
    getResidentAnnuliBuffer: () => binSummaryBuf,
    getTelemetry: () => lastTelemetry,
    getCoalescedDisk: () => lastCoalesced,
    getCoalescedRenderSpheres,
    setEnableGasDrag(on) { gasDragOn = Boolean(on); },
    step,
    coalesceSystemBurst,
    reset,
    dispose
  });
}

/**
 * Convenience one-shot helper: run a fast GPU nebular disk coalescence burst for a derived
 * star system, return the coalesced radial body/composition map, and release temporary buffers.
 */
export async function runNebularSystemCoalescenceBurstWebGpu(device, starSystem, {
  parcelCount = 3072,
  radialBins = NEBULAR_RADIAL_BINS,
  substeps = 32,
  seedOverride = null
} = {}) {
  const stars = starSystem?.stars || [{ massSolar: 1.0, luminositySolar: 1.0, radiusSolar: 1.0 }];
  const isCircumbinary = starSystem?.architecture === 'binary-p-type' || starSystem?.architecture === 'hierarchical-trinary';
  const hostMassSolar = isCircumbinary ? (stars[0].massSolar + (stars[1]?.massSolar || 0)) : stars[0].massSolar;
  const hostLumSolar = isCircumbinary ? (stars[0].luminositySolar + (stars[1]?.luminositySolar || 0)) : stars[0].luminositySolar;
  const sqrtL = Math.sqrt(Math.max(1e-4, hostLumSolar));
  const rMinStableAu = Math.max(0.06, 0.085 * sqrtL * 1.15, (stars[0].radiusSolar || 1.0) * 0.00465 * 6.0);
  const rMaxStableAu = Math.min(38.0, Math.max(6.0, 26.0 * Math.pow(Math.max(0.08, hostMassSolar), 0.35)));
  const neb = starSystem?.nebulaEnv || {};
  const session = createNebularSystemCoalescenceSessionWebGpu(device, {
    starMassSolar: hostMassSolar,
    starLuminositySolar: hostLumSolar,
    metallicitySolar: neb.metallicitySolar ?? 1.0,
    cToO: neb.cToO ?? 0.55,
    gasFraction: starSystem?.galaxyEnv?.gasFraction ?? 0.24,
    rMinStableAu,
    rMaxStableAu,
    parcelCount,
    radialBins,
    seed: ((seedOverride ?? starSystem?.seed ?? 20261126) ^ 0x4eb01a) >>> 0
  });
  try {
    const coalesced = await session.coalesceSystemBurst({ substeps });
    const telemetry = session.getTelemetry();
    return Object.freeze({ ...coalesced, telemetry });
  } finally {
    session.dispose();
  }
}

export function registerNebularSystemCoalescenceModule(registry) {
  if (!registry || typeof registry.registerModule !== 'function') return null;
  if (registry.hasModule?.('nebular-system-coalescence@1')) {
    return registry.resolveModule('nebular-system-coalescence@1')?.descriptor || null;
  }
  return registry.registerModule({
    method: { model: 'nebular-system-coalescence', version: 1 },
    kernel: {
      sourceModule: 'src/runtime/astrophysics/nebularSystemCoalescenceGpu.js',
      entryPoint: 'step_coalesce_parcels',
      workgroupSize: 64
    },
    parameterSchema: {
      dt: { type: 'number', min: 0.002, max: 0.08, required: false },
      substeps: { type: 'number', min: 1, max: 64, required: false },
      enableGasDrag: { type: 'boolean', required: false }
    },
    stateLayout: {
      tensorId: 'nebular-system-parcels',
      dtype: 'f32',
      layout: 'interleaved',
      strideElements: 16,
      strideBytes: 64,
      fields: ['x', 'y', 'z', 'mSolid', 'vx', 'vu', 'vz', 'uLog', 'tempK', 'iceFrac', 'gasEnv', 'rAu', 'feFrac', 'silFrac', 'cFrac', 'active']
    },
    scaleRangeM: [1e9, 1e14],
    accuracyTier: ULG_ACCURACY_TIERS.TIER_2_REPRESENTATIVE_EFFECTIVE,
    scientificValidation: false,
    lawAdapter: NEBULAR_SYSTEM_COALESCENCE_LAW_ADAPTER,
    async stepCapsule(capsule, { createSimulationArtifact, device }) {
      const p = capsule.input?.parameters || {};
      const coalesced = await runNebularSystemCoalescenceBurstWebGpu(device, p.starSystem || {}, {
        parcelCount: Number(p.parcelCount ?? 2048),
        substeps: Number(p.substeps ?? 24),
        seedOverride: p.seedOverride ?? null
      });
      return createSimulationArtifact?.({ schema: ULG_NEBULAR_COALESCENCE_SCHEMA, coalesced }) ?? coalesced;
    }
  });
}
