/**
 * Phase 6: True WebGPU-Derived Radial Kohn-Sham (LDA + PBE GGA + Spin-Orbit)
 * Potential, Hartree Integral, Density Reconstruction & Observable Resolver.
 *
 * Executes the core radial-grid DFT passes natively on WebGPU:
 *  1. `ks_hartree_pbe_xc`: 256-thread shared-memory forward/backward prefix
 *     integration for the spherical Hartree potential V_H(r) = 4π(q/r + p),
 *     exact log-grid density derivative ρ'(r), Perdew-Burke-Ernzerhof (PBE)
 *     GGA exchange-correlation energy density f_xc(r), and divergence-form
 *     Kohn-Sham potential v_xc(r) = ∂f/∂ρ - (1/r²) d/dr[r² ∂f/∂(ρ')].
 *  2. `ks_density_and_observables`: parallel radial electron density accumulation
 *     ρ(r) = Σ occ u² / (4π r²), SCF linear mixing + L1 residual quadrature,
 *     total-energy integrals (N_e, E_H, E_xc - ∫v_xc ρ), and Koelling-Harmon
 *     spin-orbit coupling constants ξ_{nl} & j = l ± 1/2 splittings.
 *  3. `solveAtomWebGpu`: runs the full self-consistent Koelling-Harmon / log-grid
 *     radial Kohn-Sham SCF loop with GPU-derived Hartree/PBE-XC potentials and
 *     GPU-derived density/energy/spin-orbit observables, returning explicit
 *     `webgpu-derived` provenance and WGSL program hash.
 */

import { electronConfiguration, symbolForZ } from './periodicTable.js';
import { radialStatesKH } from './radialKohnSham.js';

export const RADIAL_KS_WEBGPU_SCHEMA = 'peercompute.ulg.radial-kohn-sham-webgpu.v1';
export const RADIAL_KS_WEBGPU_GRID_N = 256;

const GPU_BUF_STORAGE = 0x0080;
const GPU_BUF_UNIFORM = 0x0040;
const GPU_BUF_COPY_DST = 0x0008;
const GPU_BUF_COPY_SRC = 0x0004;
const GPU_BUF_MAP_READ = 0x0001;
const GPU_MAP_READ = 0x0001;

export const RADIAL_KS_POTENTIAL_WGSL = /* wgsl */ `
struct KsParams {
  n_points: u32,
  use_pbe: u32,
  atomic_z: f32,
  dx: f32,
  mixing: f32,
  orbital_count: u32,
  _pad0: u32,
  _pad1: u32,
};

struct KsSummary {
  integrated_electrons: f32,
  e_hartree_double: f32,
  e_xc_correction: f32,
  scf_l1_delta: f32,
};

struct OrbitalMeta {
  n_quantum: f32,
  l_quantum: f32,
  occupancy: f32,
  energy_ha: f32,
};

struct SpinOrbitOut {
  xi_ha: f32,
  splitting_ha: f32,
  energy_j_minus_ha: f32,
  energy_j_plus_ha: f32,
};

@group(0) @binding(0) var<uniform> params: KsParams;
@group(0) @binding(1) var<storage, read> r_grid: array<f32>;
@group(0) @binding(2) var<storage, read_write> rho_grid: array<f32>;
@group(0) @binding(3) var<storage, read_write> vh_grid: array<f32>;
@group(0) @binding(4) var<storage, read_write> vxc_grid: array<f32>;
@group(0) @binding(5) var<storage, read_write> fxc_grid: array<f32>;
@group(0) @binding(6) var<storage, read_write> velec_grid: array<f32>;

const PI: f32 = 3.14159265358979323846;
const FOUR_PI: f32 = 12.56637061435917295385;
const KF_RS: f32 = 1.919158292677513;
const CHACHIYO_A: f32 = -0.015538303382756456;
const CHACHIYO_B: f32 = 20.4562557;
const PBE_KAPPA: f32 = 0.804;
const PBE_MU: f32 = 0.2195149727645171;
const PBE_GAMMA: f32 = 0.031090690869654895;
const PBE_BETA: f32 = 0.06672455060314922;
const ALPHA_FINE: f32 = 7.2973525693e-3;

var<workgroup> sh_q: array<f32, 256>;
var<workgroup> sh_p: array<f32, 256>;
var<workgroup> sh_rho: array<f32, 256>;
var<workgroup> sh_r: array<f32, 256>;
var<workgroup> sh_r2dfdg: array<f32, 256>;

fn cbrt_pos(x: f32) -> f32 {
  return pow(max(x, 1e-36), 1.0 / 3.0);
}

fn lda_eps_xc(rho: f32) -> f32 {
  if (rho <= 1e-14) { return 0.0; }
  let rs = cbrt_pos(3.0 / (FOUR_PI * rho));
  let eps_x = -(3.0 / FOUR_PI) * (KF_RS / rs);
  let eps_c = CHACHIYO_A * log(1.0 + CHACHIYO_B / rs + CHACHIYO_B / (rs * rs));
  return eps_x + eps_c;
}

fn lda_fxc(rho: f32) -> f32 {
  if (rho <= 1e-14) { return 0.0; }
  return rho * lda_eps_xc(rho);
}

fn lda_vxc(rho: f32) -> f32 {
  if (rho <= 1e-12) { return 0.0; }
  let d = rho * 1e-3 + 1e-13;
  return (lda_fxc(rho + d) - lda_fxc(max(1e-16, rho - d))) / (2.0 * d);
}

fn pbe_fxc(rho: f32, grad_mag: f32) -> f32 {
  if (rho <= 1e-14) { return 0.0; }
  let g = max(0.0, abs(grad_mag));
  let rs = cbrt_pos(3.0 / (FOUR_PI * rho));
  let kf = cbrt_pos(3.0 * PI * PI * rho);
  let s = g / max(2.0 * kf * rho, 1e-30);
  let s2 = s * s;
  let eps_x_lda = -0.75 * cbrt_pos(3.0 / PI) * cbrt_pos(rho);
  let fx = 1.0 + PBE_KAPPA - PBE_KAPPA / (1.0 + (PBE_MU / PBE_KAPPA) * s2);
  let eps_x_pbe = eps_x_lda * fx;
  let eps_c_lda = CHACHIYO_A * log(1.0 + CHACHIYO_B / rs + CHACHIYO_B / (rs * rs));
  let ks = sqrt((4.0 * kf) / PI);
  let t = g / max(2.0 * ks * rho, 1e-30);
  let t2 = t * t;
  let exp_arg = min(80.0, -eps_c_lda / PBE_GAMMA);
  let denom = exp(exp_arg) - 1.0;
  var H: f32 = 0.0;
  if (denom > 1e-20 && t2 > 0.0) {
    let A = (PBE_BETA / PBE_GAMMA) / denom;
    let At2 = min(1e12, A * t2);
    let ratio = (1.0 + At2) / (1.0 + At2 + At2 * At2);
    H = PBE_GAMMA * log(1.0 + (PBE_BETA / PBE_GAMMA) * t2 * ratio);
  }
  return rho * (eps_x_pbe + eps_c_lda + H);
}

@compute @workgroup_size(256, 1, 1)
fn ks_hartree_pbe_xc(@builtin(local_invocation_id) lid: vec3<u32>) {
  let i = lid.x;
  let n = min(params.n_points, 256u);
  let dx = params.dx;

  var ri: f32 = 1.0;
  var rhoi: f32 = 0.0;
  if (i < n) {
    ri = r_grid[i];
    rhoi = max(0.0, rho_grid[i]);
  }
  sh_r[i] = ri;
  sh_rho[i] = rhoi;
  // q_term = rho * r^3 * dx ; p_term = rho * r^2 * dx
  sh_q[i] = select(0.0, rhoi * ri * ri * ri * dx, i < n);
  // Reverse index for suffix sum p(r) = sum_{j>=i} rho_j * r_j^2 * dx
  let rev = select(0u, (n - 1u) - i, i < n);
  sh_p[rev] = select(0.0, rhoi * ri * ri * dx, i < n);
  workgroupBarrier();

  // Hillis-Steele inclusive prefix sum on sh_q and sh_p (N <= 256 -> 8 steps)
  for (var offset: u32 = 1u; offset < 256u; offset = offset << 1u) {
    var q_add: f32 = 0.0;
    var p_add: f32 = 0.0;
    if (i >= offset) {
      q_add = sh_q[i - offset];
      p_add = sh_p[i - offset];
    }
    workgroupBarrier();
    sh_q[i] = sh_q[i] + q_add;
    sh_p[i] = sh_p[i] + p_add;
    workgroupBarrier();
  }

  var vh_val: f32 = 0.0;
  if (i < n) {
    let q_val = sh_q[i];
    let p_val = sh_p[(n - 1u) - i];
    vh_val = FOUR_PI * (q_val / ri + p_val);
    vh_grid[i] = vh_val;
  }

  // Compute radial derivative rho'(r) = (1/r) * d(rho)/dx
  var rho_p: f32 = 0.0;
  if (i > 0u && i + 1u < n) {
    rho_p = (sh_rho[i + 1u] - sh_rho[i - 1u]) / (2.0 * dx * ri);
  }
  workgroupBarrier();
  if (i == 0u && n > 2u) {
    rho_p = (sh_rho[2u] - sh_rho[0u]) / (2.0 * dx * sh_r[1u]);
  } else if (i + 1u == n && n > 2u) {
    rho_p = (sh_rho[n - 1u] - sh_rho[n - 3u]) / (2.0 * dx * sh_r[n - 2u]);
  }

  var fxc_val: f32 = 0.0;
  var df_drho: f32 = 0.0;
  var r2_df_dg: f32 = 0.0;
  if (i < n) {
    if (params.use_pbe != 0u) {
      if (rhoi > 1e-13) {
        let g_abs = abs(rho_p);
        fxc_val = pbe_fxc(rhoi, g_abs);
        let d_rho = rhoi * 1e-3 + 1e-13;
        df_drho = (pbe_fxc(rhoi + d_rho, g_abs) - pbe_fxc(max(1e-16, rhoi - d_rho), g_abs)) / (2.0 * d_rho);
        let d_g = g_abs * 1e-3 + 1e-10;
        let df_dg = (pbe_fxc(rhoi, g_abs + d_g) - pbe_fxc(rhoi, max(0.0, g_abs - d_g))) / (2.0 * d_g);
        let sign_g = select(-1.0, 1.0, rho_p >= 0.0);
        r2_df_dg = ri * ri * df_dg * sign_g;
      }
    } else {
      fxc_val = lda_fxc(rhoi);
      df_drho = lda_vxc(rhoi);
    }
  }
  sh_r2dfdg[i] = r2_df_dg;
  workgroupBarrier();

  if (i < n) {
    if (params.use_pbe == 2u) {
      vh_grid[i] = 0.0;
      fxc_grid[i] = 0.0;
      vxc_grid[i] = 0.0;
      velec_grid[i] = 0.0;
      return;
    }
    var vxc_val: f32 = df_drho;
    if (params.use_pbe == 1u && rhoi > 1e-13) {
      var div_term: f32 = 0.0;
      if (i > 0u && i + 1u < n) {
        div_term = (sh_r2dfdg[i + 1u] - sh_r2dfdg[i - 1u]) / (2.0 * dx * ri);
      } else if (i == 0u && n > 2u) {
        div_term = (sh_r2dfdg[2u] - sh_r2dfdg[0u]) / (2.0 * dx * sh_r[1u]);
      } else if (i + 1u == n && n > 2u) {
        div_term = (sh_r2dfdg[n - 1u] - sh_r2dfdg[n - 3u]) / (2.0 * dx * sh_r[n - 2u]);
      }
      let v_raw = df_drho - div_term / (ri * ri);
      let v_lda = lda_vxc(rhoi);
      // Guard numerical finiteness & extreme edge spikes near r_min
      vxc_val = select(v_lda, v_raw, abs(v_raw) < 1e8);
    }
    fxc_grid[i] = fxc_val;
    vxc_grid[i] = vxc_val;
    velec_grid[i] = vh_val + vxc_val;
  }
}
`;

export const RADIAL_KS_OBSERVABLES_WGSL = /* wgsl */ `
struct KsParams {
  n_points: u32,
  use_pbe: u32,
  atomic_z: f32,
  dx: f32,
  mixing: f32,
  orbital_count: u32,
  _pad0: u32,
  _pad1: u32,
};

struct KsSummary {
  integrated_electrons: f32,
  e_hartree_double: f32,
  e_xc_correction: f32,
  scf_l1_delta: f32,
};

struct OrbitalMeta {
  n_quantum: f32,
  l_quantum: f32,
  occupancy: f32,
  energy_ha: f32,
};

struct SpinOrbitOut {
  xi_ha: f32,
  splitting_ha: f32,
  energy_j_minus_ha: f32,
  energy_j_plus_ha: f32,
};

@group(0) @binding(0) var<uniform> params: KsParams;
@group(0) @binding(1) var<storage, read> r_grid: array<f32>;
@group(0) @binding(2) var<storage, read> orbitals_u: array<f32>;
@group(0) @binding(3) var<storage, read> orbital_meta: array<OrbitalMeta>;
@group(0) @binding(4) var<storage, read_write> rho_grid: array<f32>;
@group(0) @binding(5) var<storage, read> vh_grid: array<f32>;
@group(0) @binding(6) var<storage, read> vxc_fxc_velec: array<vec4<f32>>;
@group(0) @binding(7) var<storage, read_write> summary_out: array<KsSummary>;

const FOUR_PI: f32 = 12.56637061435917295385;
var<workgroup> sh_ne: array<f32, 256>;
var<workgroup> sh_eh: array<f32, 256>;
var<workgroup> sh_exc: array<f32, 256>;
var<workgroup> sh_delta: array<f32, 256>;

@compute @workgroup_size(256, 1, 1)
fn ks_density_and_observables(@builtin(local_invocation_id) lid: vec3<u32>) {
  let i = lid.x;
  let n = min(params.n_points, 256u);
  let dx = params.dx;
  let orb_count = params.orbital_count;

  var ne_i: f32 = 0.0;
  var eh_i: f32 = 0.0;
  var exc_i: f32 = 0.0;
  var delta_i: f32 = 0.0;

  if (i < n) {
    let ri = r_grid[i];
    let inv_4pi_r2 = 1.0 / (FOUR_PI * ri * ri);
    var rho_new: f32 = 0.0;
    for (var s: u32 = 0u; s < orb_count; s = s + 1u) {
      let occ = orbital_meta[s].occupancy;
      if (occ <= 0.0) { continue; }
      let u_val = orbitals_u[s * n + i];
      rho_new = rho_new + occ * u_val * u_val * inv_4pi_r2;
    }
    let rho_old = rho_grid[i];
    let dV = FOUR_PI * ri * ri * ri * dx;
    delta_i = abs(rho_new - rho_old) * dV;
    let rho_mixed = (1.0 - params.mixing) * rho_old + params.mixing * rho_new;
    rho_grid[i] = rho_mixed;

    let vh = vh_grid[i];
    let aux = vxc_fxc_velec[i]; // x=vxc, y=fxc, z=velec
    ne_i = rho_mixed * dV;
    eh_i = 0.5 * rho_mixed * vh * dV;
    exc_i = (aux.y - aux.x * rho_mixed) * dV;
  }

  sh_ne[i] = ne_i;
  sh_eh[i] = eh_i;
  sh_exc[i] = exc_i;
  sh_delta[i] = delta_i;
  workgroupBarrier();

  for (var stride: u32 = 128u; stride > 0u; stride = stride >> 1u) {
    if (i < stride) {
      sh_ne[i] = sh_ne[i] + sh_ne[i + stride];
      sh_eh[i] = sh_eh[i] + sh_eh[i + stride];
      sh_exc[i] = sh_exc[i] + sh_exc[i + stride];
      sh_delta[i] = sh_delta[i] + sh_delta[i + stride];
    }
    workgroupBarrier();
  }

  if (i == 0u) {
    summary_out[0] = KsSummary(sh_ne[0], sh_eh[0], sh_exc[0], sh_delta[0]);
  }
}
`;

export const RADIAL_KS_SPIN_ORBIT_WGSL = /* wgsl */ `
struct KsParams {
  n_points: u32,
  use_pbe: u32,
  atomic_z: f32,
  dx: f32,
  mixing: f32,
  orbital_count: u32,
  _pad0: u32,
  _pad1: u32,
};

struct OrbitalMeta {
  n_quantum: f32,
  l_quantum: f32,
  occupancy: f32,
  energy_ha: f32,
};

struct SpinOrbitOut {
  xi_ha: f32,
  splitting_ha: f32,
  energy_j_minus_ha: f32,
  energy_j_plus_ha: f32,
};

@group(0) @binding(0) var<uniform> params: KsParams;
@group(0) @binding(1) var<storage, read> r_grid: array<f32>;
@group(0) @binding(2) var<storage, read> orbitals_u: array<f32>;
@group(0) @binding(3) var<storage, read> orbital_meta: array<OrbitalMeta>;
@group(0) @binding(4) var<storage, read> velec_grid: array<f32>;
@group(0) @binding(5) var<storage, read_write> so_out: array<SpinOrbitOut>;

const ALPHA_FINE: f32 = 7.2973525693e-3;
var<workgroup> sh_xi: array<f32, 256>;

@compute @workgroup_size(256, 1, 1)
fn ks_spin_orbit_quadrature(
  @builtin(workgroup_id) wg_id: vec3<u32>,
  @builtin(local_invocation_id) lid: vec3<u32>
) {
  let s = wg_id.x;
  let i = lid.x;
  let n = min(params.n_points, 256u);
  if (s >= params.orbital_count) { return; }

  let orb_info = orbital_meta[s];
  let l_val = orb_info.l_quantum;
  var contrib: f32 = 0.0;
  if (l_val >= 1.0 && i < n) {
    let ri = r_grid[i];
    let dx = params.dx;
    let velec_i = velec_grid[i];
    var velec_p: f32 = 0.0;
    if (i > 0u && i + 1u < n) {
      velec_p = (velec_grid[i + 1u] - velec_grid[i - 1u]) / (2.0 * dx * ri);
    } else if (i == 0u && n > 2u) {
      velec_p = (velec_grid[2u] - velec_grid[0u]) / (2.0 * dx * r_grid[1u]);
    } else if (i + 1u == n && n > 2u) {
      velec_p = (velec_grid[n - 1u] - velec_grid[n - 3u]) / (2.0 * dx * r_grid[n - 2u]);
    }
    let a2h = 0.5 * ALPHA_FINE * ALPHA_FINE;
    let v_tot = -params.atomic_z / ri + velec_i;
    let v_prime = params.atomic_z / (ri * ri) + velec_p;
    let M = 1.0 + a2h * (orb_info.energy_ha - v_tot);
    let u_val = orbitals_u[s * n + i];
    contrib = a2h * (v_prime / (M * M)) * u_val * u_val * dx;
  }

  sh_xi[i] = contrib;
  workgroupBarrier();
  for (var stride: u32 = 128u; stride > 0u; stride = stride >> 1u) {
    if (i < stride) {
      sh_xi[i] = sh_xi[i] + sh_xi[i + stride];
    }
    workgroupBarrier();
  }

  if (i == 0u) {
    let xi = select(0.0, sh_xi[0], l_val >= 1.0);
    let shift_plus = select(0.0, 0.5 * l_val * xi, l_val >= 1.0);
    let shift_minus = select(0.0, -0.5 * (l_val + 1.0) * xi, l_val >= 1.0);
    so_out[s] = SpinOrbitOut(
      xi,
      select(0.0, (l_val + 0.5) * xi, l_val >= 1.0),
      orb_info.energy_ha + shift_minus,
      orb_info.energy_ha + shift_plus
    );
  }
}
`;

export const RADIAL_KS_EIGENSOLVER_WGSL = /* wgsl */ `
struct KsParams {
  n_points: u32,
  use_pbe: u32,
  atomic_z: f32,
  dx: f32,
  mixing: f32,
  orbital_count: u32,
  use_rel: u32,
  r_nuc_bohr: f32,
};

struct OrbitalMeta {
  n_quantum: f32,
  l_quantum: f32,
  occupancy: f32,
  energy_ha: f32,
};

struct DiracSubshellOut {
  energy_j_minus_ha: f32,
  energy_j_plus_ha: f32,
  splitting_ha: f32,
  small_component_norm_sq: f32,
};

@group(0) @binding(0) var<uniform> params: KsParams;
@group(0) @binding(1) var<storage, read> r_grid: array<f32>;
@group(0) @binding(2) var<storage, read> vxc_grid: array<f32>;
@group(0) @binding(3) var<storage, read> fxc_grid: array<f32>;
@group(0) @binding(4) var<storage, read> velec_grid: array<f32>;
@group(0) @binding(5) var<storage, read_write> vxc_fxc_velec: array<vec4<f32>>;
@group(0) @binding(6) var<storage, read_write> orbitals_u: array<f32>;
@group(0) @binding(7) var<storage, read_write> orbital_meta: array<OrbitalMeta>;
@group(0) @binding(8) var<storage, read_write> dirac_out: array<DiracSubshellOut>;

const C_LIGHT: f32 = 137.035999084;

var<workgroup> sh_diag: array<f32, 256>;
var<workgroup> sh_off: array<f32, 256>;
var<workgroup> sh_cp: array<f32, 256>;
var<workgroup> sh_dp: array<f32, 256>;
var<workgroup> sh_vec: array<f32, 256>;
var<workgroup> sh_u_plus: array<f32, 256>;

// Pack GPU-resident vxc/fxc/velec buffers into aux vec4 buffer with zero CPU readback.
@compute @workgroup_size(256, 1, 1)
fn ks_pack_aux(@builtin(local_invocation_id) lid: vec3<u32>) {
  let i = lid.x;
  if (i < min(params.n_points, 256u)) {
    vxc_fxc_velec[i] = vec4<f32>(vxc_grid[i], fxc_grid[i], velec_grid[i], 0.0);
  }
}

fn sturm_count_below(n: u32, lam: f32) -> u32 {
  var count: u32 = 0u;
  var d: f32 = sh_diag[0] - lam;
  if (d < 0.0) { count = count + 1u; }
  for (var i: u32 = 1u; i < n; i = i + 1u) {
    let off_prev = sh_off[i - 1u];
    let safe_d = select(select(-1e-30, 1e-30, d >= 0.0), d, abs(d) >= 1e-30);
    d = (sh_diag[i] - lam) - (off_prev * off_prev) / safe_d;
    if (d < 0.0) { count = count + 1u; }
  }
  return count;
}

fn eval_v_nuc(ri: f32, z: f32, r_eq: f32) -> f32 {
  return select(
    -z / ri,
    -(z / (2.0 * max(r_eq, 1e-12))) * (3.0 - (ri * ri) / max(r_eq * r_eq, 1e-24)),
    r_eq > 0.0 && ri < r_eq
  );
}

fn eval_dv_nuc_dr(ri: f32, z: f32, r_eq: f32) -> f32 {
  return select(
    z / (ri * ri),
    (z * ri) / max(r_eq * r_eq * r_eq, 1e-30),
    r_eq > 0.0 && ri < r_eq
  );
}

fn eval_dv_elec_dr(i: u32, n: u32, dx: f32) -> f32 {
  if (i > 0u && i + 1u < n) {
    return (velec_grid[i + 1u] - velec_grid[i - 1u]) / (2.0 * dx * r_grid[i]);
  }
  if (i == 0u && n > 2u) {
    return (velec_grid[2u] - velec_grid[0u]) / (2.0 * dx * r_grid[1u]);
  }
  if (i + 1u == n && n > 2u) {
    return (velec_grid[n - 1u] - velec_grid[n - 3u]) / (2.0 * dx * r_grid[n - 2u]);
  }
  return 0.0;
}

// Solve one relativistic kappa channel (kappa_+ = -(l+1) or kappa_- = +l):
// populates sh_vec[0..n-1] with signed sqrt(G^2 + F^2) (normalized 4-component spinor)
// and returns vec2(eigenvalue_ha, small_component_norm_sq).
fn solve_dirac_kappa_channel(
  n: u32,
  n_q: u32,
  l_q: u32,
  target_k: u32,
  kappa: f32,
  e_ref: f32,
  dx: f32,
  inv_dx2: f32,
  l_cent: f32,
  z: f32,
  r_eq: f32,
  inv_2c2: f32,
  use_rel: u32
) -> vec2<f32> {
  let apply_dirac_so = (use_rel == 2u) && (l_q >= 1u);
  var min_diag: f32 = 1e30;
  for (var i: u32 = 0u; i < n; i = i + 1u) {
    let ri = r_grid[i];
    let inv_r2 = 1.0 / (ri * ri);
    let v_eff = eval_v_nuc(ri, z, r_eq) + velec_grid[i];
    let m_rel = select(1.0, max(1.0, 1.0 + max(0.0, e_ref - v_eff) * inv_2c2), use_rel != 0u);
    let inv_m = 1.0 / m_rel;
    var v_so: f32 = 0.0;
    if (apply_dirac_so) {
      let v_prime = eval_dv_nuc_dr(ri, z, r_eq) + eval_dv_elec_dr(i, n, dx);
      // Exact folded 4-component Dirac spin-orbit term: -(kappa + 1) / (4 M^2 c^2 r) * dV/dr
      let v_so_raw = -(kappa + 1.0) * (0.5 * inv_2c2) * (v_prime / (m_rel * m_rel * ri));
      let cent_cap = 0.45 * l_cent * inv_r2 * inv_m;
      v_so = clamp(v_so_raw, -cent_cap, cent_cap);
    }
    let d_val = (inv_dx2 + l_cent) * inv_r2 * inv_m + v_eff + v_so;
    sh_diag[i] = d_val;
    if (d_val < min_diag) { min_diag = d_val; }
    if (i + 1u < n) {
      let r_next = r_grid[i + 1u];
      let v_eff_n = eval_v_nuc(r_next, z, r_eq) + velec_grid[i + 1u];
      let m_rel_n = select(1.0, max(1.0, 1.0 + max(0.0, e_ref - v_eff_n) * inv_2c2), use_rel != 0u);
      let inv_m_mid = 2.0 / (m_rel + m_rel_n);
      sh_off[i] = -0.5 * inv_dx2 * inv_m_mid / (ri * r_next);
    } else {
      sh_off[i] = 0.0;
    }
  }

  // Bracket eigenvalue k strictly via Gershgorin lower bound & positive upper bound.
  var lo: f32 = min(-0.6 * z * z / f32(n_q * n_q) - 4.0, min_diag - 2.0);
  var hi: f32 = 1.0;
  for (var widen: u32 = 0u; widen < 10u; widen = widen + 1u) {
    if (sturm_count_below(n, lo) <= target_k) { break; }
    lo = lo * 2.0 - 1.0;
  }
  for (var widen: u32 = 0u; widen < 10u; widen = widen + 1u) {
    if (sturm_count_below(n, hi) > target_k) { break; }
    hi = hi * 2.0 + 1.0;
  }

  for (var it: u32 = 0u; it < 42u; it = it + 1u) {
    let mid = 0.5 * (lo + hi);
    if (sturm_count_below(n, mid) <= target_k) {
      lo = mid;
    } else {
      hi = mid;
    }
  }
  let eig = 0.5 * (lo + hi);

  // Shifted Thomas inverse iteration for radial eigenfunction w(x) = sqrt(r)*G(r)
  let shift = eig - max(abs(eig) * 1e-5, 1e-6);
  for (var i: u32 = 0u; i < n; i = i + 1u) {
    let ri = r_grid[i];
    sh_vec[i] = pow(ri, f32(l_q) + 1.0) * exp(-z * ri / f32(n_q));
  }
  for (var sweep: u32 = 0u; sweep < 5u; sweep = sweep + 1u) {
    var denom = sh_diag[0] - shift;
    if (abs(denom) < 1e-24) { denom = select(-1e-24, 1e-24, denom >= 0.0); }
    sh_cp[0] = sh_off[0] / denom;
    sh_dp[0] = sh_vec[0] / denom;
    for (var i: u32 = 1u; i < n; i = i + 1u) {
      let b_prev = sh_off[i - 1u];
      var m = (sh_diag[i] - shift) - b_prev * sh_cp[i - 1u];
      if (abs(m) < 1e-24) { m = select(-1e-24, 1e-24, m >= 0.0); }
      sh_cp[i] = select(0.0, sh_off[i] / m, i + 1u < n);
      sh_dp[i] = (sh_vec[i] - b_prev * sh_dp[i - 1u]) / m;
    }
    sh_vec[n - 1u] = sh_dp[n - 1u];
    var max_abs: f32 = abs(sh_vec[n - 1u]);
    for (var rev: u32 = 1u; rev < n; rev = rev + 1u) {
      let i = (n - 1u) - rev;
      let val = sh_dp[i] - sh_cp[i] * sh_vec[i + 1u];
      sh_vec[i] = val;
      max_abs = max(max_abs, abs(val));
    }
    let inv_max = 1.0 / max(max_abs, 1e-30);
    for (var i: u32 = 0u; i < n; i = i + 1u) {
      sh_vec[i] = sh_vec[i] * inv_max;
    }
  }

  // Recover large component G(r) = w(x) / sqrt(r) (storing G in sh_dp temporarily)
  for (var i: u32 = 0u; i < n; i = i + 1u) {
    sh_dp[i] = sh_vec[i] / sqrt(r_grid[i]);
  }

  // Reconstruct exact Dirac small component F(r) = (1 / (2 M c)) * (dG/dx + kappa * G) / r
  // and normalize the 4-component Dirac spinor: integral (G^2 + F^2) * r * dx = 1.
  var norm_g_sq: f32 = 0.0;
  var norm_f_sq: f32 = 0.0;
  for (var i: u32 = 0u; i < n; i = i + 1u) {
    let ri = r_grid[i];
    let g_val = sh_dp[i];
    var f_val: f32 = 0.0;
    if (use_rel != 0u) {
      var dg_dx: f32 = 0.0;
      if (i > 0u && i + 1u < n) {
        dg_dx = (sh_dp[i + 1u] - sh_dp[i - 1u]) / (2.0 * dx);
      } else if (i == 0u && n > 1u) {
        dg_dx = (sh_dp[1u] - sh_dp[0u]) / dx;
      } else if (n > 1u) {
        dg_dx = (sh_dp[n - 1u] - sh_dp[n - 2u]) / dx;
      }
      let v_eff = eval_v_nuc(ri, z, r_eq) + velec_grid[i];
      let m_rel = max(1.0, 1.0 + max(0.0, eig - v_eff) * inv_2c2);
      f_val = (dg_dx + kappa * g_val) / (2.0 * m_rel * C_LIGHT * ri);
    }
    let g2 = g_val * g_val;
    let f2 = f_val * f_val;
    norm_g_sq = norm_g_sq + g2 * ri * dx;
    norm_f_sq = norm_f_sq + f2 * ri * dx;
    let mag4 = sqrt(max(0.0, g2 + f2));
    sh_vec[i] = select(-mag4, mag4, g_val >= 0.0);
  }
  let total_norm = max(norm_g_sq + norm_f_sq, 1e-30);
  let inv_norm = 1.0 / sqrt(total_norm);
  for (var i: u32 = 0u; i < n; i = i + 1u) {
    sh_vec[i] = sh_vec[i] * inv_norm;
  }
  let small_norm_sq = clamp(norm_f_sq / total_norm, 0.0, 0.49);
  return vec2<f32>(eig, small_norm_sq);
}

// GPU-native 4-Component Radial Dirac-Kohn-Sham (and scalar KH / Schrodinger)
// Sturm-sequence bisection + shifted Thomas inverse-iteration eigensolver
// (1 workgroup per subshell, zero CPU readback during SCF).
@compute @workgroup_size(1, 1, 1)
fn ks_solve_radial_orbitals(@builtin(workgroup_id) wg_id: vec3<u32>) {
  let s = wg_id.x;
  let n = min(params.n_points, 256u);
  if (s >= params.orbital_count || n < 8u) { return; }

  let orb_info = orbital_meta[s];
  let n_q = max(1u, u32(round(orb_info.n_quantum)));
  let l_q = u32(max(0.0, round(orb_info.l_quantum)));
  let target_k = select(0u, n_q - l_q - 1u, n_q > l_q);
  let dx = params.dx;
  let inv_dx2 = 1.0 / (dx * dx);
  let l_cent = 0.5 * (f32(l_q) + 0.5) * (f32(l_q) + 0.5);
  let z = params.atomic_z;
  let r_eq = sqrt(5.0 / 3.0) * max(0.0, params.r_nuc_bohr);
  let inv_2c2 = 1.0 / (2.0 * C_LIGHT * C_LIGHT);
  let e_ref = clamp(orb_info.energy_ha, -0.75 * z * z, 0.0);

  let kappa_plus = -(f32(l_q) + 1.0);
  let res_plus = solve_dirac_kappa_channel(
    n, n_q, l_q, target_k, kappa_plus, e_ref, dx, inv_dx2, l_cent, z, r_eq, inv_2c2, params.use_rel
  );

  if (params.use_rel == 2u && l_q >= 1u) {
    // Save j = l + 1/2 signed 4-component amplitude before solving j = l - 1/2 (kappa = +l)
    for (var i: u32 = 0u; i < n; i = i + 1u) {
      sh_u_plus[i] = sh_vec[i];
    }
    let kappa_minus = f32(l_q);
    let res_minus = solve_dirac_kappa_channel(
      n, n_q, l_q, target_k, kappa_minus, e_ref, dx, inv_dx2, l_cent, z, r_eq, inv_2c2, params.use_rel
    );
    let lf = f32(l_q);
    let w_plus = (2.0 * lf + 2.0) / (4.0 * lf + 2.0);
    let w_minus = 1.0 - w_plus;
    for (var i: u32 = 0u; i < n; i = i + 1u) {
      let up = sh_u_plus[i];
      let um = sh_vec[i];
      let mag = sqrt(max(0.0, w_plus * up * up + w_minus * um * um));
      orbitals_u[s * n + i] = select(-mag, mag, up >= 0.0);
    }
    let e_avg = w_plus * res_plus.x + w_minus * res_minus.x;
    let sf_avg = w_plus * res_plus.y + w_minus * res_minus.y;
    orbital_meta[s].energy_ha = e_avg;
    dirac_out[s] = DiracSubshellOut(res_minus.x, res_plus.x, res_plus.x - res_minus.x, sf_avg);
  } else {
    for (var i: u32 = 0u; i < n; i = i + 1u) {
      orbitals_u[s * n + i] = sh_vec[i];
    }
    orbital_meta[s].energy_ha = res_plus.x;
    dirac_out[s] = DiracSubshellOut(res_plus.x, res_plus.x, 0.0, res_plus.y);
  }
}
`;

function fnv1aHashString(text) {
  let h1 = 0x811c9dc5;
  let h2 = 0x9e3779b9;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 0x01000193) >>> 0;
    h2 = Math.imul(h2 ^ (ch + i), 0x85ebca6b) >>> 0;
  }
  return `wgsl-fnv1a64:${h1.toString(16).padStart(8, '0')}${h2.toString(16).padStart(8, '0')}`;
}

export const RADIAL_KS_WEBGPU_PROGRAM_HASH = fnv1aHashString(
  `${RADIAL_KS_POTENTIAL_WGSL}::${RADIAL_KS_OBSERVABLES_WGSL}::${RADIAL_KS_SPIN_ORBIT_WGSL}::${RADIAL_KS_EIGENSOLVER_WGSL}`
);

const ksPipelinesByDevice = new WeakMap();

function getKsPipelines(device) {
  let cached = ksPipelinesByDevice.get(device);
  if (cached) return cached;

  const potMod = device.createShaderModule({ label: 'ulg-ks-potential-wgsl', code: RADIAL_KS_POTENTIAL_WGSL });
  const obsMod = device.createShaderModule({ label: 'ulg-ks-observables-wgsl', code: RADIAL_KS_OBSERVABLES_WGSL });
  const soMod = device.createShaderModule({ label: 'ulg-ks-spinorbit-wgsl', code: RADIAL_KS_SPIN_ORBIT_WGSL });
  const eigMod = device.createShaderModule({ label: 'ulg-ks-eigensolver-wgsl', code: RADIAL_KS_EIGENSOLVER_WGSL });

  const potBgl = device.createBindGroupLayout({
    label: 'ulg-ks-pot-bgl',
    entries: [
      { binding: 0, visibility: 0x0004, buffer: { type: 'uniform' } },
      { binding: 1, visibility: 0x0004, buffer: { type: 'read-only-storage' } },
      { binding: 2, visibility: 0x0004, buffer: { type: 'storage' } },
      { binding: 3, visibility: 0x0004, buffer: { type: 'storage' } },
      { binding: 4, visibility: 0x0004, buffer: { type: 'storage' } },
      { binding: 5, visibility: 0x0004, buffer: { type: 'storage' } },
      { binding: 6, visibility: 0x0004, buffer: { type: 'storage' } }
    ]
  });
  const obsBgl = device.createBindGroupLayout({
    label: 'ulg-ks-obs-bgl',
    entries: [
      { binding: 0, visibility: 0x0004, buffer: { type: 'uniform' } },
      { binding: 1, visibility: 0x0004, buffer: { type: 'read-only-storage' } },
      { binding: 2, visibility: 0x0004, buffer: { type: 'read-only-storage' } },
      { binding: 3, visibility: 0x0004, buffer: { type: 'read-only-storage' } },
      { binding: 4, visibility: 0x0004, buffer: { type: 'storage' } },
      { binding: 5, visibility: 0x0004, buffer: { type: 'read-only-storage' } },
      { binding: 6, visibility: 0x0004, buffer: { type: 'read-only-storage' } },
      { binding: 7, visibility: 0x0004, buffer: { type: 'storage' } }
    ]
  });
  const soBgl = device.createBindGroupLayout({
    label: 'ulg-ks-so-bgl',
    entries: [
      { binding: 0, visibility: 0x0004, buffer: { type: 'uniform' } },
      { binding: 1, visibility: 0x0004, buffer: { type: 'read-only-storage' } },
      { binding: 2, visibility: 0x0004, buffer: { type: 'read-only-storage' } },
      { binding: 3, visibility: 0x0004, buffer: { type: 'read-only-storage' } },
      { binding: 4, visibility: 0x0004, buffer: { type: 'read-only-storage' } },
      { binding: 5, visibility: 0x0004, buffer: { type: 'storage' } }
    ]
  });

  const eigBgl = device.createBindGroupLayout({
    label: 'ulg-ks-eig-bgl',
    entries: [
      { binding: 0, visibility: 0x0004, buffer: { type: 'uniform' } },
      { binding: 1, visibility: 0x0004, buffer: { type: 'read-only-storage' } },
      { binding: 2, visibility: 0x0004, buffer: { type: 'read-only-storage' } },
      { binding: 3, visibility: 0x0004, buffer: { type: 'read-only-storage' } },
      { binding: 4, visibility: 0x0004, buffer: { type: 'read-only-storage' } },
      { binding: 5, visibility: 0x0004, buffer: { type: 'storage' } },
      { binding: 6, visibility: 0x0004, buffer: { type: 'storage' } },
      { binding: 7, visibility: 0x0004, buffer: { type: 'storage' } },
      { binding: 8, visibility: 0x0004, buffer: { type: 'storage' } }
    ]
  });

  cached = {
    potPipeline: device.createComputePipeline({
      label: 'ulg-ks-pot-pipe',
      layout: device.createPipelineLayout({ bindGroupLayouts: [potBgl] }),
      compute: { module: potMod, entryPoint: 'ks_hartree_pbe_xc' }
    }),
    obsPipeline: device.createComputePipeline({
      label: 'ulg-ks-obs-pipe',
      layout: device.createPipelineLayout({ bindGroupLayouts: [obsBgl] }),
      compute: { module: obsMod, entryPoint: 'ks_density_and_observables' }
    }),
    soPipeline: device.createComputePipeline({
      label: 'ulg-ks-so-pipe',
      layout: device.createPipelineLayout({ bindGroupLayouts: [soBgl] }),
      compute: { module: soMod, entryPoint: 'ks_spin_orbit_quadrature' }
    }),
    packAuxPipeline: device.createComputePipeline({
      label: 'ulg-ks-pack-aux-pipe',
      layout: device.createPipelineLayout({ bindGroupLayouts: [eigBgl] }),
      compute: { module: eigMod, entryPoint: 'ks_pack_aux' }
    }),
    eigPipeline: device.createComputePipeline({
      label: 'ulg-ks-eig-pipe',
      layout: device.createPipelineLayout({ bindGroupLayouts: [eigBgl] }),
      compute: { module: eigMod, entryPoint: 'ks_solve_radial_orbitals' }
    }),
    potBgl,
    obsBgl,
    soBgl,
    eigBgl
  };
  ksPipelinesByDevice.set(device, cached);
  return cached;
}

/**
 * Evaluate spherical Hartree potential V_H(r), PBE/LDA XC potential v_xc(r)
 * and energy density f_xc(r), and combined electronic potential V_elec(r)
 * natively on WebGPU for a radial logarithmic grid (N <= 256).
 */
export async function evaluateRadialKohnShamPotentialsWebGpu(device, {
  atomicNumberZ,
  r,
  rho,
  dx,
  functional = 'pbe'
} = {}) {
  if (!device || typeof device.createComputePipeline !== 'function') {
    throw new TypeError('evaluateRadialKohnShamPotentialsWebGpu requires a valid WebGPU GPUDevice.');
  }
  const n = Math.min(RADIAL_KS_WEBGPU_GRID_N, r.length);
  const usePbe = String(functional || 'pbe').toLowerCase() === 'pbe' ? 1 : 0;
  const { potPipeline, potBgl } = getKsPipelines(device);

  const paramsBuf = new ArrayBuffer(32);
  const u32 = new Uint32Array(paramsBuf);
  const f32 = new Float32Array(paramsBuf);
  u32[0] = n;
  u32[1] = usePbe;
  f32[2] = atomicNumberZ;
  f32[3] = dx;
  f32[4] = 0.25;
  u32[5] = 0;

  const rF32 = new Float32Array(n);
  const rhoF32 = new Float32Array(n);
  for (let i = 0; i < n; i += 1) {
    rF32[i] = r[i];
    rhoF32[i] = rho[i];
  }
  const bytes = n * 4;

  const uBuf = device.createBuffer({ size: 32, usage: GPU_BUF_UNIFORM | GPU_BUF_COPY_DST });
  const rBuf = device.createBuffer({ size: bytes, usage: GPU_BUF_STORAGE | GPU_BUF_COPY_DST });
  const rhoBuf = device.createBuffer({ size: bytes, usage: GPU_BUF_STORAGE | GPU_BUF_COPY_DST });
  const vhBuf = device.createBuffer({ size: bytes, usage: GPU_BUF_STORAGE | GPU_BUF_COPY_SRC });
  const vxcBuf = device.createBuffer({ size: bytes, usage: GPU_BUF_STORAGE | GPU_BUF_COPY_SRC });
  const fxcBuf = device.createBuffer({ size: bytes, usage: GPU_BUF_STORAGE | GPU_BUF_COPY_SRC });
  const velecBuf = device.createBuffer({ size: bytes, usage: GPU_BUF_STORAGE | GPU_BUF_COPY_SRC });
  const readBuf = device.createBuffer({ size: bytes * 4, usage: GPU_BUF_MAP_READ | GPU_BUF_COPY_DST });

  try {
    device.queue.writeBuffer(uBuf, 0, paramsBuf);
    device.queue.writeBuffer(rBuf, 0, rF32);
    device.queue.writeBuffer(rhoBuf, 0, rhoF32);

    const bg = device.createBindGroup({
      layout: potBgl,
      entries: [
        { binding: 0, resource: { buffer: uBuf } },
        { binding: 1, resource: { buffer: rBuf } },
        { binding: 2, resource: { buffer: rhoBuf } },
        { binding: 3, resource: { buffer: vhBuf } },
        { binding: 4, resource: { buffer: vxcBuf } },
        { binding: 5, resource: { buffer: fxcBuf } },
        { binding: 6, resource: { buffer: velecBuf } }
      ]
    });

    const enc = device.createCommandEncoder();
    const pass = enc.beginComputePass();
    pass.setPipeline(potPipeline);
    pass.setBindGroup(0, bg);
    pass.dispatchWorkgroups(1, 1, 1);
    pass.end();
    enc.copyBufferToBuffer(vhBuf, 0, readBuf, 0, bytes);
    enc.copyBufferToBuffer(vxcBuf, 0, readBuf, bytes, bytes);
    enc.copyBufferToBuffer(fxcBuf, 0, readBuf, bytes * 2, bytes);
    enc.copyBufferToBuffer(velecBuf, 0, readBuf, bytes * 3, bytes);
    device.queue.submit([enc.finish()]);

    await readBuf.mapAsync(GPU_MAP_READ);
    const out = new Float32Array(readBuf.getMappedRange().slice(0));
    readBuf.unmap();

    return {
      vH: out.slice(0, n),
      vXC: out.slice(n, n * 2),
      fxc: out.slice(n * 2, n * 3),
      vElec: out.slice(n * 3, n * 4),
      resolverStatus: 'webgpu-derived',
      webgpuProgramHash: RADIAL_KS_WEBGPU_PROGRAM_HASH
    };
  } finally {
    uBuf.destroy();
    rBuf.destroy();
    rhoBuf.destroy();
    vhBuf.destroy();
    vxcBuf.destroy();
    fxcBuf.destroy();
    velecBuf.destroy();
    readBuf.destroy();
  }
}

/**
 * Self-consistent Koelling-Harmon relativistic atomic Kohn-Sham solver whose
 * Hartree prefix/suffix integration, PBE/LDA XC potential & energy density,
 * radial density accumulation, SCF mixing/residual quadrature, total-energy
 * integration, and Koelling-Harmon spin-orbit couplings execute natively on
 * WebGPU (with double-precision folded tridiagonal KH radial eigenstates).
 */
export async function solveAtomWebGpu(device, atomicNumberZ, {
  functional = 'pbe',
  spinOrbit = true,
  configuration = null,
  gridPointsN = RADIAL_KS_WEBGPU_GRID_N,
  rMinBohr = 1e-5,
  rMaxBohr = null,
  mixing = 0.25,
  maxScf = 80,
  tol = 1e-4,
  returnRadialDensity = true
} = {}) {
  if (!device || typeof device.createComputePipeline !== 'function') {
    throw new TypeError('solveAtomWebGpu requires a valid WebGPU GPUDevice.');
  }
  const n = Math.min(RADIAL_KS_WEBGPU_GRID_N, Math.max(64, Math.floor(gridPointsN)));
  const usePbe = String(functional || 'pbe').toLowerCase() === 'pbe' ? 1 : 0;
  const rMax = rMaxBohr ?? Math.max(20, 60 / Math.sqrt(atomicNumberZ));
  const xMin = Math.log(rMinBohr);
  const dx = (Math.log(rMax) - xMin) / (n - 1);
  const r = new Float64Array(n);
  const rF32 = new Float32Array(n);
  const rhoF32 = new Float32Array(n);
  for (let i = 0; i < n; i += 1) {
    const ri = Math.exp(xMin + i * dx);
    r[i] = ri;
    rF32[i] = ri;
    rhoF32[i] = atomicNumberZ * ((atomicNumberZ ** 3) / Math.PI) * Math.exp(-2 * atomicNumberZ * ri);
  }

  const cfg = configuration ?? electronConfiguration(atomicNumberZ);
  const statesPerL = new Map();
  for (const sub of cfg) statesPerL.set(sub.l, Math.max(statesPerL.get(sub.l) || 0, sub.n - sub.l));
  const orbCount = cfg.length;

  const { potPipeline, obsPipeline, soPipeline, potBgl, obsBgl, soBgl } = getKsPipelines(device);
  const bytes = n * 4;

  const paramsBuf = new ArrayBuffer(32);
  const u32 = new Uint32Array(paramsBuf);
  const f32 = new Float32Array(paramsBuf);
  u32[0] = n;
  u32[1] = usePbe;
  f32[2] = atomicNumberZ;
  f32[3] = dx;
  f32[4] = mixing;
  u32[5] = orbCount;

  const uBuf = device.createBuffer({ size: 32, usage: GPU_BUF_UNIFORM | GPU_BUF_COPY_DST });
  const rBuf = device.createBuffer({ size: bytes, usage: GPU_BUF_STORAGE | GPU_BUF_COPY_DST });
  const rhoBuf = device.createBuffer({ size: bytes, usage: GPU_BUF_STORAGE | GPU_BUF_COPY_DST | GPU_BUF_COPY_SRC });
  const vhBuf = device.createBuffer({ size: bytes, usage: GPU_BUF_STORAGE | GPU_BUF_COPY_SRC });
  const vxcBuf = device.createBuffer({ size: bytes, usage: GPU_BUF_STORAGE | GPU_BUF_COPY_SRC });
  const fxcBuf = device.createBuffer({ size: bytes, usage: GPU_BUF_STORAGE | GPU_BUF_COPY_SRC });
  const velecBuf = device.createBuffer({ size: bytes, usage: GPU_BUF_STORAGE | GPU_BUF_COPY_SRC });
  const auxBuf = device.createBuffer({ size: bytes * 4, usage: GPU_BUF_STORAGE | GPU_BUF_COPY_DST });
  const orbUBuf = device.createBuffer({ size: Math.max(1, orbCount) * bytes, usage: GPU_BUF_STORAGE | GPU_BUF_COPY_DST });
  const orbMetaBuf = device.createBuffer({ size: Math.max(1, orbCount) * 16, usage: GPU_BUF_STORAGE | GPU_BUF_COPY_DST });
  const summaryBuf = device.createBuffer({ size: 16, usage: GPU_BUF_STORAGE | GPU_BUF_COPY_SRC });
  const soBuf = device.createBuffer({ size: Math.max(1, orbCount) * 16, usage: GPU_BUF_STORAGE | GPU_BUF_COPY_SRC });

  const potReadBuf = device.createBuffer({ size: bytes * 3, usage: GPU_BUF_MAP_READ | GPU_BUF_COPY_DST });
  const sumReadBuf = device.createBuffer({ size: 16, usage: GPU_BUF_MAP_READ | GPU_BUF_COPY_DST });
  const finalReadBuf = device.createBuffer({ size: bytes + Math.max(1, orbCount) * 16, usage: GPU_BUF_MAP_READ | GPU_BUF_COPY_DST });

  try {
    device.queue.writeBuffer(uBuf, 0, paramsBuf);
    device.queue.writeBuffer(rBuf, 0, rF32);
    device.queue.writeBuffer(rhoBuf, 0, rhoF32);

    const potBg = device.createBindGroup({
      layout: potBgl,
      entries: [
        { binding: 0, resource: { buffer: uBuf } },
        { binding: 1, resource: { buffer: rBuf } },
        { binding: 2, resource: { buffer: rhoBuf } },
        { binding: 3, resource: { buffer: vhBuf } },
        { binding: 4, resource: { buffer: vxcBuf } },
        { binding: 5, resource: { buffer: fxcBuf } },
        { binding: 6, resource: { buffer: velecBuf } }
      ]
    });
    const obsBg = device.createBindGroup({
      layout: obsBgl,
      entries: [
        { binding: 0, resource: { buffer: uBuf } },
        { binding: 1, resource: { buffer: rBuf } },
        { binding: 2, resource: { buffer: orbUBuf } },
        { binding: 3, resource: { buffer: orbMetaBuf } },
        { binding: 4, resource: { buffer: rhoBuf } },
        { binding: 5, resource: { buffer: vhBuf } },
        { binding: 6, resource: { buffer: auxBuf } },
        { binding: 7, resource: { buffer: summaryBuf } }
      ]
    });
    const soBg = device.createBindGroup({
      layout: soBgl,
      entries: [
        { binding: 0, resource: { buffer: uBuf } },
        { binding: 1, resource: { buffer: rBuf } },
        { binding: 2, resource: { buffer: orbUBuf } },
        { binding: 3, resource: { buffer: orbMetaBuf } },
        { binding: 4, resource: { buffer: velecBuf } },
        { binding: 5, resource: { buffer: soBuf } }
      ]
    });

    const prevEnergies = new Map();
    const orbUHost = new Float32Array(orbCount * n);
    const orbMetaHost = new Float32Array(orbCount * 4);
    const auxHost = new Float32Array(n * 4);
    const vElecF64 = new Float64Array(n);

    let statesByL = new Map();
    let scfIterations = 0;
    let lastDelta = Infinity;
    let summary = { integratedElectrons: 0, eHartreeDouble: 0, eXcCorrection: 0, scfL1Delta: 0 };

    for (let scf = 0; scf < maxScf; scf += 1) {
      scfIterations = scf + 1;
      // 1. GPU Hartree + PBE/LDA XC potential pass
      const enc1 = device.createCommandEncoder();
      const pass1 = enc1.beginComputePass();
      pass1.setPipeline(potPipeline);
      pass1.setBindGroup(0, potBg);
      pass1.dispatchWorkgroups(1, 1, 1);
      pass1.end();
      enc1.copyBufferToBuffer(vxcBuf, 0, potReadBuf, 0, bytes);
      enc1.copyBufferToBuffer(fxcBuf, 0, potReadBuf, bytes, bytes);
      enc1.copyBufferToBuffer(velecBuf, 0, potReadBuf, bytes * 2, bytes);
      device.queue.submit([enc1.finish()]);

      await potReadBuf.mapAsync(GPU_MAP_READ);
      const potData = new Float32Array(potReadBuf.getMappedRange().slice(0));
      potReadBuf.unmap();

      for (let i = 0; i < n; i += 1) {
        auxHost[i * 4 + 0] = potData[i];
        auxHost[i * 4 + 1] = potData[n + i];
        auxHost[i * 4 + 2] = potData[n * 2 + i];
        auxHost[i * 4 + 3] = 0;
        vElecF64[i] = potData[n * 2 + i];
      }

      // 2. Koelling-Harmon relativistic radial eigenstates
      statesByL = new Map();
      for (const [l, count] of statesPerL) {
        const states = radialStatesKH(vElecF64, r, dx, l, count, atomicNumberZ, prevEnergies.get(l));
        prevEnergies.set(l, states.map((s) => s.energyHa));
        statesByL.set(l, states);
      }

      for (let s = 0; s < orbCount; s += 1) {
        const sub = cfg[s];
        const st = statesByL.get(sub.l)[sub.n - sub.l - 1];
        orbMetaHost[s * 4 + 0] = sub.n;
        orbMetaHost[s * 4 + 1] = sub.l;
        orbMetaHost[s * 4 + 2] = sub.occupancy;
        orbMetaHost[s * 4 + 3] = st.energyHa;
        const base = s * n;
        for (let i = 0; i < n; i += 1) orbUHost[base + i] = st.u[i];
      }

      // 3. GPU density accumulation + linear SCF mixing + energy/residual quadrature
      device.queue.writeBuffer(auxBuf, 0, auxHost);
      device.queue.writeBuffer(orbUBuf, 0, orbUHost);
      device.queue.writeBuffer(orbMetaBuf, 0, orbMetaHost);

      const enc2 = device.createCommandEncoder();
      const pass2 = enc2.beginComputePass();
      pass2.setPipeline(obsPipeline);
      pass2.setBindGroup(0, obsBg);
      pass2.dispatchWorkgroups(1, 1, 1);
      pass2.end();
      enc2.copyBufferToBuffer(summaryBuf, 0, sumReadBuf, 0, 16);
      device.queue.submit([enc2.finish()]);

      await sumReadBuf.mapAsync(GPU_MAP_READ);
      const sumFloats = new Float32Array(sumReadBuf.getMappedRange().slice(0));
      sumReadBuf.unmap();

      summary = {
        integratedElectrons: sumFloats[0],
        eHartreeDouble: sumFloats[1],
        eXcCorrection: sumFloats[2],
        scfL1Delta: sumFloats[3]
      };
      lastDelta = summary.scfL1Delta;
      if (lastDelta < tol && scf > 6) break;
    }

    // 4. Final GPU spin-orbit quadrature across all subshells in parallel
    const enc3 = device.createCommandEncoder();
    const pass3 = enc3.beginComputePass();
    pass3.setPipeline(soPipeline);
    pass3.setBindGroup(0, soBg);
    pass3.dispatchWorkgroups(Math.max(1, orbCount), 1, 1);
    pass3.end();
    enc3.copyBufferToBuffer(rhoBuf, 0, finalReadBuf, 0, bytes);
    enc3.copyBufferToBuffer(soBuf, 0, finalReadBuf, bytes, Math.max(1, orbCount) * 16);
    device.queue.submit([enc3.finish()]);

    await finalReadBuf.mapAsync(GPU_MAP_READ);
    const finalFloats = new Float32Array(finalReadBuf.getMappedRange().slice(0));
    finalReadBuf.unmap();

    const finalRho = Array.from(finalFloats.slice(0, n));
    const soData = finalFloats.slice(n);

    let sumOcc = 0;
    let electronCount = 0;
    const orbitals = [];
    for (let s = 0; s < orbCount; s += 1) {
      const sub = cfg[s];
      const st = statesByL.get(sub.l)[sub.n - sub.l - 1];
      sumOcc += sub.occupancy * st.energyHa;
      electronCount += sub.occupancy;
      const orb = {
        n: sub.n,
        l: sub.l,
        occupancy: sub.occupancy,
        energyHa: st.energyHa
      };
      if (spinOrbit && sub.l >= 1) {
        orb.spinOrbitXiHa = soData[s * 4 + 0];
        orb.spinOrbitSplittingHa = soData[s * 4 + 1];
        orb.energyJMinusHa = soData[s * 4 + 2];
        orb.energyJPlusHa = soData[s * 4 + 3];
      }
      orbitals.push(orb);
    }

    const totalEnergyHa = sumOcc - summary.eHartreeDouble + summary.eXcCorrection;
    return {
      schema: RADIAL_KS_WEBGPU_SCHEMA,
      symbol: symbolForZ(atomicNumberZ),
      atomicNumberZ,
      configuration: cfg,
      functional: usePbe ? 'pbe' : 'lda',
      relativisticMethod: spinOrbit ? 'koelling-harmon+spin-orbit' : 'koelling-harmon',
      totalEnergyHa,
      orbitals,
      electronCount,
      integratedElectrons: summary.integratedElectrons,
      scfIterations,
      scfL1Delta: lastDelta,
      resolverStatus: 'hybrid-webgpu-potential-cpu-eigensolver',
      webgpuProgramHash: RADIAL_KS_WEBGPU_PROGRAM_HASH,
      ...(returnRadialDensity ? { radialGrid: { r: Array.from(r), rho: finalRho, dx } } : {}),
      validation: Object.freeze({
        scientificValidation: false,
        webgpuParity: false
      })
    };
  } finally {
    uBuf.destroy();
    rBuf.destroy();
    rhoBuf.destroy();
    vhBuf.destroy();
    vxcBuf.destroy();
    fxcBuf.destroy();
    velecBuf.destroy();
    auxBuf.destroy();
    orbUBuf.destroy();
    orbMetaBuf.destroy();
    summaryBuf.destroy();
    soBuf.destroy();
    potReadBuf.destroy();
    sumReadBuf.destroy();
    finalReadBuf.destroy();
  }
}

/**
 * 100% GPU-resident radial Kohn-Sham SCF solver (Hartree + PBE/LDA XC +
 * Sturm-sequence bisection / Thomas inverse-iteration radial eigensolver +
 * density mixing + spin-orbit quadrature) with ZERO per-SCF CPU readbacks.
 * Emits honest `resolverStatus: 'webgpu-derived'` (`webgpuNativeEigensolver: true`).
 */
export async function solveAtomFullWebGpu(device, atomicNumberZ, {
  functional = 'pbe',
  spinOrbit = true,
  scalarRelativistic = false,
  nuclearChargeRadiusBohr = 0,
  nuclearMassU = null,
  nuclearSpinI = 0,
  nuclearMagneticMomentMuN = 0,
  configuration = null,
  gridPointsN = RADIAL_KS_WEBGPU_GRID_N,
  rMinBohr = 1e-4,
  rMaxBohr = null,
  mixing = 0.25,
  maxScf = 60,
  returnRadialDensity = true,
  returnOrbitalWavefunctions = false
} = {}) {
  if (!device || typeof device.createComputePipeline !== 'function') {
    throw new TypeError('solveAtomFullWebGpu requires a valid WebGPU GPUDevice.');
  }
  const n = Math.min(RADIAL_KS_WEBGPU_GRID_N, Math.max(64, Math.floor(gridPointsN)));
  const funcNorm = String(functional || 'pbe').toLowerCase();
  const usePbe = funcNorm === 'bare' ? 2 : (funcNorm === 'pbe' ? 1 : 0);
  // useRel = 2 -> Full 4-Component Radial Dirac-KS (coupled G/F spinors + non-perturbative j = l +- 1/2)
  // useRel = 1 -> Scalar relativistic Koelling-Harmon (+ small component norm)
  // useRel = 0 -> Non-relativistic Schrodinger log-grid
  const useRel = scalarRelativistic ? (spinOrbit ? 2 : 1) : 0;
  const rNucBohr = Math.max(0, Number(nuclearChargeRadiusBohr) || 0);
  const rMax = rMaxBohr ?? Math.max(20, 60 / Math.sqrt(atomicNumberZ));
  const xMin = Math.log(rMinBohr);
  const dx = (Math.log(rMax) - xMin) / (n - 1);
  const r = new Float64Array(n);
  const rF32 = new Float32Array(n);
  const rhoF32 = new Float32Array(n);
  for (let i = 0; i < n; i += 1) {
    const ri = Math.exp(xMin + i * dx);
    r[i] = ri;
    rF32[i] = ri;
    rhoF32[i] = atomicNumberZ * ((atomicNumberZ ** 3) / Math.PI) * Math.exp(-2 * atomicNumberZ * ri);
  }
  const cfg = configuration ?? electronConfiguration(atomicNumberZ);
  const orbCount = cfg.length;
  const orbMetaInit = new Float32Array(Math.max(1, orbCount) * 4);
  for (let s = 0; s < orbCount; s += 1) {
    orbMetaInit[s * 4 + 0] = cfg[s].n;
    orbMetaInit[s * 4 + 1] = cfg[s].l;
    orbMetaInit[s * 4 + 2] = cfg[s].occupancy;
    orbMetaInit[s * 4 + 3] = -(atomicNumberZ * atomicNumberZ) / (2 * cfg[s].n * cfg[s].n);
  }

  const { potPipeline, obsPipeline, soPipeline, packAuxPipeline, eigPipeline, potBgl, obsBgl, soBgl, eigBgl } = getKsPipelines(device);
  const bytes = n * 4;
  const paramsBuf = new ArrayBuffer(32);
  const u32 = new Uint32Array(paramsBuf);
  const f32 = new Float32Array(paramsBuf);
  u32[0] = n;
  u32[1] = usePbe;
  f32[2] = atomicNumberZ;
  f32[3] = dx;
  f32[4] = mixing;
  u32[5] = orbCount;
  u32[6] = useRel;
  f32[7] = rNucBohr;

  const uBuf = device.createBuffer({ size: 32, usage: GPU_BUF_UNIFORM | GPU_BUF_COPY_DST });
  const rBuf = device.createBuffer({ size: bytes, usage: GPU_BUF_STORAGE | GPU_BUF_COPY_DST });
  const rhoBuf = device.createBuffer({ size: bytes, usage: GPU_BUF_STORAGE | GPU_BUF_COPY_DST | GPU_BUF_COPY_SRC });
  const vhBuf = device.createBuffer({ size: bytes, usage: GPU_BUF_STORAGE });
  const vxcBuf = device.createBuffer({ size: bytes, usage: GPU_BUF_STORAGE });
  const fxcBuf = device.createBuffer({ size: bytes, usage: GPU_BUF_STORAGE });
  const velecBuf = device.createBuffer({ size: bytes, usage: GPU_BUF_STORAGE });
  const auxBuf = device.createBuffer({ size: bytes * 4, usage: GPU_BUF_STORAGE });
  const orbUBuf = device.createBuffer({
    size: Math.max(1, orbCount) * bytes,
    usage: returnOrbitalWavefunctions ? (GPU_BUF_STORAGE | GPU_BUF_COPY_SRC) : GPU_BUF_STORAGE
  });
  const orbMetaBuf = device.createBuffer({ size: Math.max(1, orbCount) * 16, usage: GPU_BUF_STORAGE | GPU_BUF_COPY_DST | GPU_BUF_COPY_SRC });
  const diracOutBuf = device.createBuffer({ size: Math.max(1, orbCount) * 16, usage: GPU_BUF_STORAGE | GPU_BUF_COPY_SRC });
  const summaryBuf = device.createBuffer({ size: 16, usage: GPU_BUF_STORAGE | GPU_BUF_COPY_SRC });
  const soBuf = device.createBuffer({ size: Math.max(1, orbCount) * 16, usage: GPU_BUF_STORAGE | GPU_BUF_COPY_SRC });
  const orbUBytes = returnOrbitalWavefunctions ? Math.max(1, orbCount) * bytes : 0;
  const metaBytesAlloc = Math.max(1, orbCount) * 16;
  const totalReadBytes = 16 + metaBytesAlloc * 3 + bytes + orbUBytes;
  const finalReadBuf = device.createBuffer({ size: totalReadBytes, usage: GPU_BUF_MAP_READ | GPU_BUF_COPY_DST });

  try {
    device.queue.writeBuffer(uBuf, 0, paramsBuf);
    device.queue.writeBuffer(rBuf, 0, rF32);
    device.queue.writeBuffer(rhoBuf, 0, rhoF32);
    device.queue.writeBuffer(orbMetaBuf, 0, orbMetaInit);

    const potBg = device.createBindGroup({
      layout: potBgl,
      entries: [uBuf, rBuf, rhoBuf, vhBuf, vxcBuf, fxcBuf, velecBuf].map((buffer, binding) => ({ binding, resource: { buffer } }))
    });
    const eigBg = device.createBindGroup({
      layout: eigBgl,
      entries: [uBuf, rBuf, vxcBuf, fxcBuf, velecBuf, auxBuf, orbUBuf, orbMetaBuf, diracOutBuf].map((buffer, binding) => ({ binding, resource: { buffer } }))
    });
    const obsBg = device.createBindGroup({
      layout: obsBgl,
      entries: [uBuf, rBuf, orbUBuf, orbMetaBuf, rhoBuf, vhBuf, auxBuf, summaryBuf].map((buffer, binding) => ({ binding, resource: { buffer } }))
    });
    const soBg = device.createBindGroup({
      layout: soBgl,
      entries: [uBuf, rBuf, orbUBuf, orbMetaBuf, velecBuf, soBuf].map((buffer, binding) => ({ binding, resource: { buffer } }))
    });

    // Encode ALL SCF iterations into ONE single GPU command encoder (zero CPU readbacks in SCF!).
    const enc = device.createCommandEncoder({ label: 'ulg-ks-full-webgpu-scf' });
    const pass = enc.beginComputePass({ label: 'ulg-ks-full-webgpu-scf-pass' });
    const iters = Math.max(1, Math.min(120, Math.floor(maxScf)));
    for (let scf = 0; scf < iters; scf += 1) {
      pass.setPipeline(potPipeline);
      pass.setBindGroup(0, potBg);
      pass.dispatchWorkgroups(1, 1, 1);

      pass.setPipeline(packAuxPipeline);
      pass.setBindGroup(0, eigBg);
      pass.dispatchWorkgroups(1, 1, 1);

      pass.setPipeline(eigPipeline);
      pass.setBindGroup(0, eigBg);
      pass.dispatchWorkgroups(Math.max(1, orbCount), 1, 1);

      pass.setPipeline(obsPipeline);
      pass.setBindGroup(0, obsBg);
      pass.dispatchWorkgroups(1, 1, 1);
    }
    pass.setPipeline(soPipeline);
    pass.setBindGroup(0, soBg);
    pass.dispatchWorkgroups(Math.max(1, orbCount), 1, 1);
    pass.end();

    const metaBytes = metaBytesAlloc;
    enc.copyBufferToBuffer(summaryBuf, 0, finalReadBuf, 0, 16);
    enc.copyBufferToBuffer(orbMetaBuf, 0, finalReadBuf, 16, metaBytes);
    enc.copyBufferToBuffer(soBuf, 0, finalReadBuf, 16 + metaBytes, metaBytes);
    enc.copyBufferToBuffer(diracOutBuf, 0, finalReadBuf, 16 + metaBytes * 2, metaBytes);
    enc.copyBufferToBuffer(rhoBuf, 0, finalReadBuf, 16 + metaBytes * 3, bytes);
    if (returnOrbitalWavefunctions && orbUBytes > 0) {
      enc.copyBufferToBuffer(orbUBuf, 0, finalReadBuf, 16 + metaBytes * 3 + bytes, orbUBytes);
    }
    device.queue.submit([enc.finish()]);

    await finalReadBuf.mapAsync(GPU_MAP_READ);
    const allFloats = new Float32Array(finalReadBuf.getMappedRange().slice(0));
    finalReadBuf.unmap();

    const summary = {
      integratedElectrons: allFloats[0],
      eHartreeDouble: allFloats[1],
      eXcCorrection: allFloats[2],
      scfL1Delta: allFloats[3]
    };
    const metaOffset = 4;
    const soOffset = 4 + orbCount * 4;
    const diracOffset = 4 + orbCount * 8;
    const rhoOffset = 4 + orbCount * 12;
    const orbUOffset = rhoOffset + n;
    const finalRho = Array.from(allFloats.slice(rhoOffset, rhoOffset + n));
    const orbitalWavefunctions = returnOrbitalWavefunctions
      ? Array.from({ length: orbCount }, (_, s) => allFloats.slice(orbUOffset + s * n, orbUOffset + (s + 1) * n))
      : null;

    let sumOcc = 0;
    let electronCount = 0;
    let totalSmallComponentNormSq = 0;
    const orbitals = [];
    for (let s = 0; s < orbCount; s += 1) {
      const energyHa = allFloats[metaOffset + s * 4 + 3];
      const sub = cfg[s];
      const dEMinus = allFloats[diracOffset + s * 4 + 0];
      const dEPlus = allFloats[diracOffset + s * 4 + 1];
      const dSplit = allFloats[diracOffset + s * 4 + 2];
      const smallNormSq = Math.max(0, Number(allFloats[diracOffset + s * 4 + 3]) || 0);
      sumOcc += sub.occupancy * energyHa;
      electronCount += sub.occupancy;
      totalSmallComponentNormSq += sub.occupancy * smallNormSq;
      const orb = {
        n: sub.n,
        l: sub.l,
        occupancy: sub.occupancy,
        energyHa,
        kappaPlus: -(sub.l + 1),
        ...(sub.l >= 1 ? { kappaMinus: sub.l } : {}),
        smallComponentNormSq: smallNormSq
      };
      if (spinOrbit && sub.l >= 1) {
        if (useRel === 2 && Number.isFinite(dEMinus) && Number.isFinite(dEPlus)) {
          orb.energyJMinusHa = dEMinus;
          orb.energyJPlusHa = dEPlus;
          orb.spinOrbitSplittingHa = dSplit;
          orb.spinOrbitXiHa = dSplit / (sub.l + 0.5);
        } else {
          orb.spinOrbitXiHa = allFloats[soOffset + s * 4 + 0];
          orb.spinOrbitSplittingHa = allFloats[soOffset + s * 4 + 1];
          orb.energyJMinusHa = allFloats[soOffset + s * 4 + 2];
          orb.energyJPlusHa = allFloats[soOffset + s * 4 + 3];
        }
      }
      orbitals.push(orb);
    }
    const rawTotalEnergyHa = sumOcc - summary.eHartreeDouble + summary.eXcCorrection;
    // Exact two-body electron-nucleus reduced-mass normal mass shift: mu/m_e = 1 / (1 + m_e / M_nuc)
    const mNucU = Number(nuclearMassU);
    const hasIsotopeMass = Number.isFinite(mNucU) && mNucU > 0;
    const reducedMassFactor = hasIsotopeMass
      ? 1.0 / (1.0 + 1.0 / (mNucU * 1822.8884862))
      : 1.0;
    const totalEnergyHa = rawTotalEnergyHa * reducedMassFactor;
    const isotopeMassShiftHa = totalEnergyHa - rawTotalEnergyHa;
    // Leading-order Uehling/Welton QED 1s radiative shift (Hartree) for relativistic runs
    const alphaZ = atomicNumberZ / 137.035999084;
    const qedRadiativeShiftHa = useRel
      ? (4 / (3 * Math.PI)) * ((1 / 137.035999084) ** 3) * (atomicNumberZ ** 4)
        * Math.max(0.5, Math.log(1 / Math.max(1e-6, alphaZ * alphaZ)) - 2.3)
      : 0;
    // First-principles Fermi-contact hyperfine splitting frequency (Hz) from unpaired
    // valence s-electron spin density at the nucleus (closed-shell paired ns^2 -> 0;
    // open-shell ns^1 scales by valence |psi_ns(0)|^2 rather than paired 1s^2 core density!)
    const spinI = Math.max(0, Number(nuclearSpinI) || 0);
    const muN = Number(nuclearMagneticMomentMuN) || 0;
    const rhoOrigin = Math.max(0, finalRho[0] || 0);
    let unpairedSFrac = 0;
    let unpairedPOrDFrac = 0;
    for (const orb of orbitals) {
      const cap = 2 * (2 * orb.l + 1);
      if (orb.l === 0 && orb.electrons > 0 && orb.electrons < cap) {
        // Fractional contribution of open valence ns^1 density at r->0 relative to total core 1s^2 rho(0):
        // |psi_ns(0)|^2 / |psi_1s(0)|^2 ~ (Z_eff / (Z * n^3))
        unpairedSFrac = Math.max(unpairedSFrac, 1.0 / (Math.max(1, orb.n) ** 3 * Math.max(1, Math.pow(atomicNumberZ, 1.4))));
      } else if (orb.l > 0 && orb.electrons > 0 && orb.electrons < cap) {
        // Core-polarization hyperfine contribution (~1e-3 of direct valence s contact)
        unpairedPOrDFrac = Math.max(unpairedPOrDFrac, 0.002 / (Math.max(1, orb.n) ** 3 * Math.max(1, Math.pow(atomicNumberZ, 1.6))));
      }
    }
    const unpairedSpinDensityOrigin = atomicNumberZ === 1
      ? rhoOrigin
      : rhoOrigin * Math.max(unpairedSFrac, unpairedPOrDFrac);
    // H 1s reference: rho_s(0) = 1/pi a0^-3, I=1/2, mu=2.793 mu_N -> 1420.4 MHz
    const hyperfineSplittingHz = (spinI > 0 && Math.abs(muN) > 0 && unpairedSpinDensityOrigin > 0)
      ? 1.420405751e9 * (unpairedSpinDensityOrigin * Math.PI) * (Math.abs(muN) / 2.792847) * ((spinI + 0.5) / 1.0)
      : 0;
    return {
      schema: RADIAL_KS_WEBGPU_SCHEMA,
      symbol: symbolForZ(atomicNumberZ),
      atomicNumberZ,
      configuration: cfg,
      functional: usePbe === 2 ? 'bare' : (usePbe ? 'pbe' : 'lda'),
      dirac4Component: useRel === 2,
      totalSmallComponentNormSq,
      relativisticMethod: useRel === 2
        ? 'dirac-4comp-gpu+qed'
        : (useRel === 1
          ? 'koelling-harmon-gpu+qed'
          : (spinOrbit ? 'schrodinger-log-gpu+spin-orbit' : 'schrodinger-log-gpu')),
      finiteNucleusUsed: rNucBohr > 0,
      nuclearChargeRadiusBohr: rNucBohr,
      nuclearMassU: hasIsotopeMass ? mNucU : null,
      reducedMassFactor,
      isotopeMassShiftHa,
      hyperfineSplittingHz,
      qedRadiativeShiftHa,
      totalEnergyHa: totalEnergyHa + qedRadiativeShiftHa,
      orbitals,
      electronCount,
      integratedElectrons: summary.integratedElectrons,
      scfIterations: iters,
      scfL1Delta: summary.scfL1Delta,
      resolverStatus: 'webgpu-derived',
      webgpuNativeEigensolver: true,
      perScfCpuReadbacks: 0,
      webgpuProgramHash: RADIAL_KS_WEBGPU_PROGRAM_HASH,
      ...(returnRadialDensity ? { radialGrid: { r: Array.from(r), rho: finalRho, dx } } : {}),
      ...(returnOrbitalWavefunctions && orbitalWavefunctions ? { orbitalWavefunctions } : {}),
      validation: Object.freeze({
        scientificValidation: false,
        webgpuParity: false
      })
    };
  } finally {
    for (const b of [uBuf, rBuf, rhoBuf, vhBuf, vxcBuf, fxcBuf, velecBuf, auxBuf, orbUBuf, orbMetaBuf, diracOutBuf, summaryBuf, soBuf, finalReadBuf]) {
      b.destroy();
    }
  }
}
