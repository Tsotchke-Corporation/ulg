import{Aa as e,G as t,N as n,it as r,ka as i,ot as a}from"./eshkolTriadClosures-CAdZ5Pha.js";import{o}from"./materialFoundationAbi-FyZ8ey5s.js";import{n as s,t as c}from"./serviceContract-CmO1oQSS.js";import{computeBufferBinding as l,createCachedExplicitComputePipeline as u}from"../runtime/webgpuComputeLayout.js";import{i as d}from"./residentBufferLease-EzWfR0Bs.js";var f=`peercompute.ulg.radial-kohn-sham-webgpu.v1`,p=128,m=1,h=`
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
`,g=`
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
`,_=`
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
`,v=`
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

@group(0) @binding(0) var<uniform> params: KsParams;
@group(0) @binding(1) var<storage, read> r_grid: array<f32>;
@group(0) @binding(2) var<storage, read> vxc_grid: array<f32>;
@group(0) @binding(3) var<storage, read> fxc_grid: array<f32>;
@group(0) @binding(4) var<storage, read> velec_grid: array<f32>;
@group(0) @binding(5) var<storage, read_write> vxc_fxc_velec: array<vec4<f32>>;
@group(0) @binding(6) var<storage, read_write> orbitals_u: array<f32>;
@group(0) @binding(7) var<storage, read_write> orbital_meta: array<OrbitalMeta>;

var<workgroup> sh_diag: array<f32, 256>;
var<workgroup> sh_off: array<f32, 256>;
var<workgroup> sh_cp: array<f32, 256>;
var<workgroup> sh_dp: array<f32, 256>;
var<workgroup> sh_vec: array<f32, 256>;

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

// GPU-native Sturm-sequence bisection + shifted Thomas inverse-iteration
// radial Kohn-Sham eigensolver (1 workgroup per subshell, zero CPU readback).
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
  let inv_2c2 = 1.0 / (2.0 * 137.035999084 * 137.035999084);
  let e_ref = clamp(orb_info.energy_ha, -0.75 * z * z, 0.0);

  var min_diag: f32 = 1e30;
  for (var i: u32 = 0u; i < n; i = i + 1u) {
    let ri = r_grid[i];
    let inv_r2 = 1.0 / (ri * ri);
    let v_nuc = select(
      -z / ri,
      -(z / (2.0 * max(r_eq, 1e-12))) * (3.0 - (ri * ri) / max(r_eq * r_eq, 1e-24)),
      r_eq > 0.0 && ri < r_eq
    );
    let v_eff = v_nuc + velec_grid[i];
    // Koelling-Harmon scalar-relativistic effective mass M(r) = 1 + (E - V_eff) / (2 c^2)
    let m_rel = select(1.0, max(1.0, 1.0 + max(0.0, e_ref - v_eff) * inv_2c2), params.use_rel != 0u);
    let inv_m = 1.0 / m_rel;
    let d_val = (inv_dx2 + l_cent) * inv_r2 * inv_m + v_eff;
    sh_diag[i] = d_val;
    if (d_val < min_diag) { min_diag = d_val; }
    if (i + 1u < n) {
      let r_next = r_grid[i + 1u];
      let v_nuc_n = select(
        -z / r_next,
        -(z / (2.0 * max(r_eq, 1e-12))) * (3.0 - (r_next * r_next) / max(r_eq * r_eq, 1e-24)),
        r_eq > 0.0 && r_next < r_eq
      );
      let m_rel_n = select(1.0, max(1.0, 1.0 + max(0.0, e_ref - (v_nuc_n + velec_grid[i + 1u])) * inv_2c2), params.use_rel != 0u);
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

  // Shifted Thomas inverse iteration for radial eigenfunction w(x) = sqrt(r)*u(r)
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

  // Recover u(r) = w(x) / sqrt(r) and normalize integral u(r)^2 * r * dx = 1
  var norm_sq: f32 = 0.0;
  for (var i: u32 = 0u; i < n; i = i + 1u) {
    let ri = r_grid[i];
    let u_raw = sh_vec[i] / sqrt(ri);
    sh_vec[i] = u_raw;
    norm_sq = norm_sq + u_raw * u_raw * ri * dx;
  }
  let inv_norm = 1.0 / sqrt(max(norm_sq, 1e-30));
  for (var i: u32 = 0u; i < n; i = i + 1u) {
    orbitals_u[s * n + i] = sh_vec[i] * inv_norm;
  }
  orbital_meta[s].energy_ha = eig;
}
`;function y(e){let t=2166136261,n=2654435769;for(let r=0;r<e.length;r+=1){let i=e.charCodeAt(r);t=Math.imul(t^i,16777619)>>>0,n=Math.imul(n^i+r,2246822507)>>>0}return`wgsl-fnv1a64:${t.toString(16).padStart(8,`0`)}${n.toString(16).padStart(8,`0`)}`}var b=y(`${h}::${g}::${_}::${v}`),x=new WeakMap;function S(e){let t=x.get(e);if(t)return t;let n=e.createShaderModule({label:`ulg-ks-potential-wgsl`,code:h}),r=e.createShaderModule({label:`ulg-ks-observables-wgsl`,code:g}),i=e.createShaderModule({label:`ulg-ks-spinorbit-wgsl`,code:_}),a=e.createShaderModule({label:`ulg-ks-eigensolver-wgsl`,code:v}),o=e.createBindGroupLayout({label:`ulg-ks-pot-bgl`,entries:[{binding:0,visibility:4,buffer:{type:`uniform`}},{binding:1,visibility:4,buffer:{type:`read-only-storage`}},{binding:2,visibility:4,buffer:{type:`storage`}},{binding:3,visibility:4,buffer:{type:`storage`}},{binding:4,visibility:4,buffer:{type:`storage`}},{binding:5,visibility:4,buffer:{type:`storage`}},{binding:6,visibility:4,buffer:{type:`storage`}}]}),s=e.createBindGroupLayout({label:`ulg-ks-obs-bgl`,entries:[{binding:0,visibility:4,buffer:{type:`uniform`}},{binding:1,visibility:4,buffer:{type:`read-only-storage`}},{binding:2,visibility:4,buffer:{type:`read-only-storage`}},{binding:3,visibility:4,buffer:{type:`read-only-storage`}},{binding:4,visibility:4,buffer:{type:`storage`}},{binding:5,visibility:4,buffer:{type:`read-only-storage`}},{binding:6,visibility:4,buffer:{type:`read-only-storage`}},{binding:7,visibility:4,buffer:{type:`storage`}}]}),c=e.createBindGroupLayout({label:`ulg-ks-so-bgl`,entries:[{binding:0,visibility:4,buffer:{type:`uniform`}},{binding:1,visibility:4,buffer:{type:`read-only-storage`}},{binding:2,visibility:4,buffer:{type:`read-only-storage`}},{binding:3,visibility:4,buffer:{type:`read-only-storage`}},{binding:4,visibility:4,buffer:{type:`read-only-storage`}},{binding:5,visibility:4,buffer:{type:`storage`}}]}),l=e.createBindGroupLayout({label:`ulg-ks-eig-bgl`,entries:[{binding:0,visibility:4,buffer:{type:`uniform`}},{binding:1,visibility:4,buffer:{type:`read-only-storage`}},{binding:2,visibility:4,buffer:{type:`read-only-storage`}},{binding:3,visibility:4,buffer:{type:`read-only-storage`}},{binding:4,visibility:4,buffer:{type:`read-only-storage`}},{binding:5,visibility:4,buffer:{type:`storage`}},{binding:6,visibility:4,buffer:{type:`storage`}},{binding:7,visibility:4,buffer:{type:`storage`}}]});return t={potPipeline:e.createComputePipeline({label:`ulg-ks-pot-pipe`,layout:e.createPipelineLayout({bindGroupLayouts:[o]}),compute:{module:n,entryPoint:`ks_hartree_pbe_xc`}}),obsPipeline:e.createComputePipeline({label:`ulg-ks-obs-pipe`,layout:e.createPipelineLayout({bindGroupLayouts:[s]}),compute:{module:r,entryPoint:`ks_density_and_observables`}}),soPipeline:e.createComputePipeline({label:`ulg-ks-so-pipe`,layout:e.createPipelineLayout({bindGroupLayouts:[c]}),compute:{module:i,entryPoint:`ks_spin_orbit_quadrature`}}),packAuxPipeline:e.createComputePipeline({label:`ulg-ks-pack-aux-pipe`,layout:e.createPipelineLayout({bindGroupLayouts:[l]}),compute:{module:a,entryPoint:`ks_pack_aux`}}),eigPipeline:e.createComputePipeline({label:`ulg-ks-eig-pipe`,layout:e.createPipelineLayout({bindGroupLayouts:[l]}),compute:{module:a,entryPoint:`ks_solve_radial_orbitals`}}),potBgl:o,obsBgl:s,soBgl:c,eigBgl:l},x.set(e,t),t}async function C(e,t,{functional:i=`pbe`,spinOrbit:o=!0,configuration:s=null,gridPointsN:c=256,rMinBohr:l=1e-5,rMaxBohr:u=null,mixing:d=.25,maxScf:p=80,tol:h=1e-4,returnRadialDensity:g=!0}={}){if(!e||typeof e.createComputePipeline!=`function`)throw TypeError(`solveAtomWebGpu requires a valid WebGPU GPUDevice.`);let _=Math.min(256,Math.max(64,Math.floor(c))),v=+(String(i||`pbe`).toLowerCase()===`pbe`),y=u??Math.max(20,60/Math.sqrt(t)),x=Math.log(l),C=(Math.log(y)-x)/(_-1),w=new Float64Array(_),T=new Float32Array(_),E=new Float32Array(_);for(let e=0;e<_;e+=1){let n=Math.exp(x+e*C);w[e]=n,T[e]=n,E[e]=t*(t**3/Math.PI)*Math.exp(-2*t*n)}let D=s??r(t),O=new Map;for(let e of D)O.set(e.l,Math.max(O.get(e.l)||0,e.n-e.l));let k=D.length,{potPipeline:A,obsPipeline:j,soPipeline:M,potBgl:N,obsBgl:ee,soBgl:P}=S(e),F=_*4,I=new ArrayBuffer(32),L=new Uint32Array(I),R=new Float32Array(I);L[0]=_,L[1]=v,R[2]=t,R[3]=C,R[4]=d,L[5]=k;let z=e.createBuffer({size:32,usage:72}),te=e.createBuffer({size:F,usage:136}),B=e.createBuffer({size:F,usage:140}),V=e.createBuffer({size:F,usage:132}),ne=e.createBuffer({size:F,usage:132}),H=e.createBuffer({size:F,usage:132}),re=e.createBuffer({size:F,usage:132}),U=e.createBuffer({size:F*4,usage:136}),W=e.createBuffer({size:Math.max(1,k)*F,usage:136}),G=e.createBuffer({size:Math.max(1,k)*16,usage:136}),K=e.createBuffer({size:16,usage:132}),q=e.createBuffer({size:Math.max(1,k)*16,usage:132}),J=e.createBuffer({size:F*3,usage:9}),Y=e.createBuffer({size:16,usage:9}),X=e.createBuffer({size:F+Math.max(1,k)*16,usage:9});try{e.queue.writeBuffer(z,0,I),e.queue.writeBuffer(te,0,T),e.queue.writeBuffer(B,0,E);let r=e.createBindGroup({layout:N,entries:[{binding:0,resource:{buffer:z}},{binding:1,resource:{buffer:te}},{binding:2,resource:{buffer:B}},{binding:3,resource:{buffer:V}},{binding:4,resource:{buffer:ne}},{binding:5,resource:{buffer:H}},{binding:6,resource:{buffer:re}}]}),i=e.createBindGroup({layout:ee,entries:[{binding:0,resource:{buffer:z}},{binding:1,resource:{buffer:te}},{binding:2,resource:{buffer:W}},{binding:3,resource:{buffer:G}},{binding:4,resource:{buffer:B}},{binding:5,resource:{buffer:V}},{binding:6,resource:{buffer:U}},{binding:7,resource:{buffer:K}}]}),s=e.createBindGroup({layout:P,entries:[{binding:0,resource:{buffer:z}},{binding:1,resource:{buffer:te}},{binding:2,resource:{buffer:W}},{binding:3,resource:{buffer:G}},{binding:4,resource:{buffer:re}},{binding:5,resource:{buffer:q}}]}),c=new Map,l=new Float32Array(k*_),u=new Float32Array(k*4),d=new Float32Array(_*4),y=new Float64Array(_),x=new Map,S=0,L=1/0,R={integratedElectrons:0,eHartreeDouble:0,eXcCorrection:0,scfL1Delta:0};for(let a=0;a<p;a+=1){S=a+1;let o=e.createCommandEncoder(),s=o.beginComputePass();s.setPipeline(A),s.setBindGroup(0,r),s.dispatchWorkgroups(1,1,1),s.end(),o.copyBufferToBuffer(ne,0,J,0,F),o.copyBufferToBuffer(H,0,J,F,F),o.copyBufferToBuffer(re,0,J,F*2,F),e.queue.submit([o.finish()]),await J.mapAsync(m);let f=new Float32Array(J.getMappedRange().slice(0));J.unmap();for(let e=0;e<_;e+=1)d[e*4+0]=f[e],d[e*4+1]=f[_+e],d[e*4+2]=f[_*2+e],d[e*4+3]=0,y[e]=f[_*2+e];x=new Map;for(let[e,r]of O){let i=n(y,w,C,e,r,t,c.get(e));c.set(e,i.map(e=>e.energyHa)),x.set(e,i)}for(let e=0;e<k;e+=1){let t=D[e],n=x.get(t.l)[t.n-t.l-1];u[e*4+0]=t.n,u[e*4+1]=t.l,u[e*4+2]=t.occupancy,u[e*4+3]=n.energyHa;let r=e*_;for(let e=0;e<_;e+=1)l[r+e]=n.u[e]}e.queue.writeBuffer(U,0,d),e.queue.writeBuffer(W,0,l),e.queue.writeBuffer(G,0,u);let p=e.createCommandEncoder(),g=p.beginComputePass();g.setPipeline(j),g.setBindGroup(0,i),g.dispatchWorkgroups(1,1,1),g.end(),p.copyBufferToBuffer(K,0,Y,0,16),e.queue.submit([p.finish()]),await Y.mapAsync(m);let v=new Float32Array(Y.getMappedRange().slice(0));if(Y.unmap(),R={integratedElectrons:v[0],eHartreeDouble:v[1],eXcCorrection:v[2],scfL1Delta:v[3]},L=R.scfL1Delta,L<h&&a>6)break}let ie=e.createCommandEncoder(),ae=ie.beginComputePass();ae.setPipeline(M),ae.setBindGroup(0,s),ae.dispatchWorkgroups(Math.max(1,k),1,1),ae.end(),ie.copyBufferToBuffer(B,0,X,0,F),ie.copyBufferToBuffer(q,0,X,F,Math.max(1,k)*16),e.queue.submit([ie.finish()]),await X.mapAsync(m);let Z=new Float32Array(X.getMappedRange().slice(0));X.unmap();let oe=Array.from(Z.slice(0,_)),Q=Z.slice(_),$=0,se=0,ce=[];for(let e=0;e<k;e+=1){let t=D[e],n=x.get(t.l)[t.n-t.l-1];$+=t.occupancy*n.energyHa,se+=t.occupancy;let r={n:t.n,l:t.l,occupancy:t.occupancy,energyHa:n.energyHa};o&&t.l>=1&&(r.spinOrbitXiHa=Q[e*4+0],r.spinOrbitSplittingHa=Q[e*4+1],r.energyJMinusHa=Q[e*4+2],r.energyJPlusHa=Q[e*4+3]),ce.push(r)}let le=$-R.eHartreeDouble+R.eXcCorrection;return{schema:f,symbol:a(t),atomicNumberZ:t,configuration:D,functional:v?`pbe`:`lda`,relativisticMethod:o?`koelling-harmon+spin-orbit`:`koelling-harmon`,totalEnergyHa:le,orbitals:ce,electronCount:se,integratedElectrons:R.integratedElectrons,scfIterations:S,scfL1Delta:L,resolverStatus:`hybrid-webgpu-potential-cpu-eigensolver`,webgpuProgramHash:b,...g?{radialGrid:{r:Array.from(w),rho:oe,dx:C}}:{},validation:Object.freeze({scientificValidation:!1,webgpuParity:!1})}}finally{z.destroy(),te.destroy(),B.destroy(),V.destroy(),ne.destroy(),H.destroy(),re.destroy(),U.destroy(),W.destroy(),G.destroy(),K.destroy(),q.destroy(),J.destroy(),Y.destroy(),X.destroy()}}async function w(e,t,{functional:n=`pbe`,spinOrbit:i=!0,scalarRelativistic:o=!1,nuclearChargeRadiusBohr:s=0,nuclearMassU:c=null,nuclearSpinI:l=0,nuclearMagneticMomentMuN:u=0,configuration:d=null,gridPointsN:h=256,rMinBohr:g=1e-4,rMaxBohr:_=null,mixing:v=.25,maxScf:y=60,returnRadialDensity:x=!0,returnOrbitalWavefunctions:C=!1}={}){if(!e||typeof e.createComputePipeline!=`function`)throw TypeError(`solveAtomFullWebGpu requires a valid WebGPU GPUDevice.`);let w=Math.min(256,Math.max(64,Math.floor(h))),T=String(n||`pbe`).toLowerCase(),E=T===`bare`?2:+(T===`pbe`),D=+!!o,O=Math.max(0,Number(s)||0),k=_??Math.max(20,60/Math.sqrt(t)),A=Math.log(g),j=(Math.log(k)-A)/(w-1),M=new Float64Array(w),N=new Float32Array(w),ee=new Float32Array(w);for(let e=0;e<w;e+=1){let n=Math.exp(A+e*j);M[e]=n,N[e]=n,ee[e]=t*(t**3/Math.PI)*Math.exp(-2*t*n)}let P=d??r(t),F=P.length,I=new Float32Array(Math.max(1,F)*4);for(let e=0;e<F;e+=1)I[e*4+0]=P[e].n,I[e*4+1]=P[e].l,I[e*4+2]=P[e].occupancy,I[e*4+3]=-(t*t)/(2*P[e].n*P[e].n);let{potPipeline:L,obsPipeline:R,soPipeline:z,packAuxPipeline:te,eigPipeline:B,potBgl:V,obsBgl:ne,soBgl:H,eigBgl:re}=S(e),U=w*4,W=new ArrayBuffer(32),G=new Uint32Array(W),K=new Float32Array(W);G[0]=w,G[1]=E,K[2]=t,K[3]=j,K[4]=v,G[5]=F,G[6]=D,K[7]=O;let q=e.createBuffer({size:32,usage:72}),J=e.createBuffer({size:U,usage:136}),Y=e.createBuffer({size:U,usage:140}),X=e.createBuffer({size:U,usage:p}),ie=e.createBuffer({size:U,usage:p}),ae=e.createBuffer({size:U,usage:p}),Z=e.createBuffer({size:U,usage:p}),oe=e.createBuffer({size:U*4,usage:p}),Q=e.createBuffer({size:Math.max(1,F)*U,usage:C?132:p}),$=e.createBuffer({size:Math.max(1,F)*16,usage:140}),se=e.createBuffer({size:16,usage:132}),ce=e.createBuffer({size:Math.max(1,F)*16,usage:132}),le=C?Math.max(1,F)*U:0,ue=16+Math.max(1,F)*16+Math.max(1,F)*16+U+le,de=e.createBuffer({size:ue,usage:9});try{e.queue.writeBuffer(q,0,W),e.queue.writeBuffer(J,0,N),e.queue.writeBuffer(Y,0,ee),e.queue.writeBuffer($,0,I);let n=e.createBindGroup({layout:V,entries:[q,J,Y,X,ie,ae,Z].map((e,t)=>({binding:t,resource:{buffer:e}}))}),r=e.createBindGroup({layout:re,entries:[q,J,ie,ae,Z,oe,Q,$].map((e,t)=>({binding:t,resource:{buffer:e}}))}),o=e.createBindGroup({layout:ne,entries:[q,J,Q,$,Y,X,oe,se].map((e,t)=>({binding:t,resource:{buffer:e}}))}),s=e.createBindGroup({layout:H,entries:[q,J,Q,$,Z,ce].map((e,t)=>({binding:t,resource:{buffer:e}}))}),d=e.createCommandEncoder({label:`ulg-ks-full-webgpu-scf`}),p=d.beginComputePass({label:`ulg-ks-full-webgpu-scf-pass`}),h=Math.max(1,Math.min(120,Math.floor(y)));for(let e=0;e<h;e+=1)p.setPipeline(L),p.setBindGroup(0,n),p.dispatchWorkgroups(1,1,1),p.setPipeline(te),p.setBindGroup(0,r),p.dispatchWorkgroups(1,1,1),p.setPipeline(B),p.setBindGroup(0,r),p.dispatchWorkgroups(Math.max(1,F),1,1),p.setPipeline(R),p.setBindGroup(0,o),p.dispatchWorkgroups(1,1,1);p.setPipeline(z),p.setBindGroup(0,s),p.dispatchWorkgroups(Math.max(1,F),1,1),p.end();let g=Math.max(1,F)*16;d.copyBufferToBuffer(se,0,de,0,16),d.copyBufferToBuffer($,0,de,16,g),d.copyBufferToBuffer(ce,0,de,16+g,g),d.copyBufferToBuffer(Y,0,de,16+g*2,U),C&&le>0&&d.copyBufferToBuffer(Q,0,de,16+g*2+U,le),e.queue.submit([d.finish()]),await de.mapAsync(m);let _=new Float32Array(de.getMappedRange().slice(0));de.unmap();let v={integratedElectrons:_[0],eHartreeDouble:_[1],eXcCorrection:_[2],scfL1Delta:_[3]},S=4+F*4,T=4+F*8,k=T+w,A=Array.from(_.slice(T,T+w)),G=C?Array.from({length:F},(e,t)=>_.slice(k+t*w,k+(t+1)*w)):null,K=0,ue=0,fe=[];for(let e=0;e<F;e+=1){let t=_[4+e*4+3],n=P[e];K+=n.occupancy*t,ue+=n.occupancy;let r={n:n.n,l:n.l,occupancy:n.occupancy,energyHa:t};i&&n.l>=1&&(r.spinOrbitXiHa=_[S+e*4+0],r.spinOrbitSplittingHa=_[S+e*4+1],r.energyJMinusHa=_[S+e*4+2],r.energyJPlusHa=_[S+e*4+3]),fe.push(r)}let pe=K-v.eHartreeDouble+v.eXcCorrection,me=Number(c),he=Number.isFinite(me)&&me>0,ge=he?1/(1+1/(me*1822.8884862)):1,_e=pe*ge,ve=_e-pe,ye=t/137.035999084,be=D?4/(3*Math.PI)*(1/137.035999084)**3*t**4*Math.max(.5,Math.log(1/Math.max(1e-6,ye*ye))-2.3):0,xe=Math.max(0,Number(l)||0),Se=Number(u)||0,Ce=Math.max(0,A[0]||0),we=xe>0&&Math.abs(Se)>0&&Ce>0?Ce*Math.PI*1420405751*(Math.abs(Se)/2.792847)*((xe+.5)/1):0;return{schema:f,symbol:a(t),atomicNumberZ:t,configuration:P,functional:E===2?`bare`:E?`pbe`:`lda`,relativisticMethod:D?i?`koelling-harmon-gpu+spin-orbit+qed`:`koelling-harmon-gpu+qed`:i?`schrodinger-log-gpu+spin-orbit`:`schrodinger-log-gpu`,finiteNucleusUsed:O>0,nuclearChargeRadiusBohr:O,nuclearMassU:he?me:null,reducedMassFactor:ge,isotopeMassShiftHa:ve,hyperfineSplittingHz:we,qedRadiativeShiftHa:be,totalEnergyHa:_e+be,orbitals:fe,electronCount:ue,integratedElectrons:v.integratedElectrons,scfIterations:h,scfL1Delta:v.scfL1Delta,resolverStatus:`webgpu-derived`,webgpuNativeEigensolver:!0,perScfCpuReadbacks:0,webgpuProgramHash:b,...x?{radialGrid:{r:Array.from(M),rho:A,dx:j}}:{},...C&&G?{orbitalWavefunctions:G}:{},validation:Object.freeze({scientificValidation:!1,webgpuParity:!1})}}finally{for(let e of[q,J,Y,X,ie,ae,Z,oe,Q,$,se,ce,de])e.destroy()}}var T=`ulg.gpumath.batched-symmetric-eigensolver.v1`,E=Object.freeze({MAP_READ:1,COPY_SRC:4,COPY_DST:8,UNIFORM:64,STORAGE:128}),D=`
struct EigenParams {
  n: u32,
  batch_count: u32,
  max_sweeps: u32,
  stride: u32, // n * n
  tol: f32,
  pad0: f32,
  pad1: f32,
  pad2: f32,
};

@group(0) @binding(0) var<uniform> params: EigenParams;
// In-place symmetric matrices A (length = batch_count * n * n); diagonal holds sorted eigenvalues on exit.
@group(0) @binding(1) var<storage, read_write> a_mat: array<f32>;
// Output eigenvectors V (column-major columns: column j is eigenvector j -> v_mat[base + row * n + col]).
@group(0) @binding(2) var<storage, read_write> v_mat: array<f32>;
// Output sorted eigenvalues (length = batch_count * n).
@group(0) @binding(3) var<storage, read_write> eigvals: array<f32>;

var<workgroup> sh_c: f32;
var<workgroup> sh_s: f32;
var<workgroup> sh_skip: u32;
var<workgroup> sh_sweep_max: f32;
var<workgroup> sh_done: u32;

@compute @workgroup_size(64)
fn jacobi_symmetric_batched(
  @builtin(workgroup_id) wg_id: vec3<u32>,
  @builtin(local_invocation_id) local_id: vec3<u32>
) {
  let b = wg_id.x;
  if (b >= params.batch_count) { return; }
  let lid = local_id.x;
  let n = params.n;
  let stride = params.stride;
  let base = b * stride;

  // Initialize V = I cooperatively
  for (var idx = lid; idx < stride; idx = idx + 64u) {
    let r = idx / n;
    let c = idx % n;
    v_mat[base + idx] = select(0.0, 1.0, r == c);
  }
  if (lid == 0u) {
    sh_done = 0u;
  }
  workgroupBarrier();

  for (var sweep = 0u; sweep < params.max_sweeps; sweep = sweep + 1u) {
    if (lid == 0u) {
      sh_sweep_max = 0.0;
    }
    workgroupBarrier();

    for (var p = 0u; p + 1u < n; p = p + 1u) {
      for (var q = p + 1u; q < n; q = q + 1u) {
        if (lid == 0u) {
          let apq = a_mat[base + p * n + q];
          let abs_apq = abs(apq);
          if (abs_apq > sh_sweep_max) {
            sh_sweep_max = abs_apq;
          }
          if (sh_done != 0u || abs_apq <= params.tol) {
            sh_skip = 1u;
          } else {
            sh_skip = 0u;
            let app = a_mat[base + p * n + p];
            let aqq = a_mat[base + q * n + q];
            let tau = (aqq - app) / (2.0 * apq);
            let t = select(-1.0 / (-tau + sqrt(1.0 + tau * tau)), 1.0 / (tau + sqrt(1.0 + tau * tau)), tau >= 0.0);
            let c = 1.0 / sqrt(1.0 + t * t);
            let s = t * c;
            sh_c = c;
            sh_s = s;
          }
        }
        workgroupBarrier();

        if (sh_skip == 0u) {
          let c = sh_c;
          let s = sh_s;
          // Update off-diagonal rows/cols k != p, q in parallel
          for (var k = lid; k < n; k = k + 64u) {
            if (k != p && k != q) {
              let akp = a_mat[base + k * n + p];
              let akq = a_mat[base + k * n + q];
              let new_kp = c * akp - s * akq;
              let new_kq = s * akp + c * akq;
              a_mat[base + k * n + p] = new_kp;
              a_mat[base + p * n + k] = new_kp;
              a_mat[base + k * n + q] = new_kq;
              a_mat[base + q * n + k] = new_kq;
            }
            // Accumulate eigenvectors V = V * J
            let vkp = v_mat[base + k * n + p];
            let vkq = v_mat[base + k * n + q];
            v_mat[base + k * n + p] = c * vkp - s * vkq;
            v_mat[base + k * n + q] = s * vkp + c * vkq;
          }
        }
        workgroupBarrier();

        if (lid == 0u && sh_skip == 0u) {
          let c = sh_c;
          let s = sh_s;
          let app = a_mat[base + p * n + p];
          let aqq = a_mat[base + q * n + q];
          let apq = a_mat[base + p * n + q];
          let c2 = c * c;
          let s2 = s * s;
          let cs2 = 2.0 * c * s * apq;
          a_mat[base + p * n + p] = c2 * app - cs2 + s2 * aqq;
          a_mat[base + q * n + q] = s2 * app + cs2 + c2 * aqq;
          a_mat[base + p * n + q] = 0.0;
          a_mat[base + q * n + p] = 0.0;
        }
        workgroupBarrier();
      }
    }

    if (lid == 0u && sh_sweep_max <= params.tol) {
      sh_done = 1u;
    }
    workgroupBarrier();
  }

  // Extract eigenvalues and sort ascending along with eigenvector columns
  for (var i = lid; i < n; i = i + 64u) {
    eigvals[b * n + i] = a_mat[base + i * n + i];
  }
  workgroupBarrier();

  // Parallel column-swap selection sort (small N <= 256, deterministic)
  for (var i = 0u; i + 1u < n; i = i + 1u) {
    if (lid == 0u) {
      var min_j = i;
      var min_v = eigvals[b * n + i];
      for (var j = i + 1u; j < n; j = j + 1u) {
        let v = eigvals[b * n + j];
        if (v < min_v) {
          min_v = v;
          min_j = j;
        }
      }
      sh_skip = min_j;
      if (min_j != i) {
        eigvals[b * n + min_j] = eigvals[b * n + i];
        eigvals[b * n + i] = min_v;
      }
    }
    workgroupBarrier();
    let swap_j = sh_skip;
    if (swap_j != i) {
      for (var r = lid; r < n; r = r + 64u) {
        let tmp = v_mat[base + r * n + i];
        v_mat[base + r * n + i] = v_mat[base + r * n + swap_j];
        v_mat[base + r * n + swap_j] = tmp;
      }
    }
    workgroupBarrier();
  }
}
`,O=`
struct MulParams {
  n: u32,
  batch_count: u32,
  mode: u32, // 0: X = U * diag(1/sqrt(d)) * U^T, 1: out = A * B, 2: out = X * A * X (uses temp)
  stride: u32,
};

@group(0) @binding(0) var<uniform> params: MulParams;
@group(0) @binding(1) var<storage, read> lhs: array<f32>;
@group(0) @binding(2) var<storage, read> rhs: array<f32>;
@group(0) @binding(3) var<storage, read_write> out_mat: array<f32>;

@compute @workgroup_size(64)
fn mat_op(@builtin(global_invocation_id) id: vec3<u32>) {
  let idx = id.x;
  let total = params.batch_count * params.stride;
  if (idx >= total) { return; }
  let b = idx / params.stride;
  let local = idx % params.stride;
  let n = params.n;
  let r = local / n;
  let c = local % n;
  let base = b * params.stride;
  var acc = 0.0;
  if (params.mode == 0u) {
    // lhs = eigenvectors U, rhs = eigenvalues d (length batch*n)
    for (var k = 0u; k < n; k = k + 1u) {
      let dk = max(rhs[b * n + k], 1.0e-12);
      acc = acc + lhs[base + r * n + k] * (1.0 / sqrt(dk)) * lhs[base + c * n + k];
    }
  } else {
    // out = lhs * rhs
    for (var k = 0u; k < n; k = k + 1u) {
      acc = acc + lhs[base + r * n + k] * rhs[base + k * n + c];
    }
  }
  out_mat[idx] = acc;
}
`;async function k(e,{matrices:t,n,batchCount:r=1,maxSweeps:i=32,tolerance:a=1e-6,keepResident:o=!1}={}){if(!e||typeof e.createBuffer!=`function`)throw TypeError(`solveSymmetricEigenBatchedWebGpu requires a live WebGPU GPUDevice`);let s=Math.trunc(Number(n)),c=Math.max(1,Math.trunc(Number(r)));if(!(s>=1&&s<=256))throw RangeError(`Unsupported matrix dimension n=${s} (expected 1..256)`);let d=s*s,f=c*d,p=t instanceof Float32Array?t:Float32Array.from(t);if(p.length!==f)throw RangeError(`Expected ${f} matrix floats for batch=${c}, n=${s}; got ${p.length}`);let m=u(e,{cacheKey:`ulg-gpumath-jacobi-sym-batched.v1`,label:`ulg-gpumath-jacobi-sym-batched`,code:D,entryPoint:`jacobi_symmetric_batched`,bindings:[l(0,`uniform`),l(1,`storage`),l(2,`storage`),l(3,`storage`)]}),h=new ArrayBuffer(32);new Uint32Array(h,0,4).set([s,c,Math.max(1,Math.trunc(i)),d]),new Float32Array(h,16,4).set([Number(a),0,0,0]);let g=e.createBuffer({label:`ulg-gpumath-eig-params`,size:32,usage:E.UNIFORM|E.COPY_DST});e.queue.writeBuffer(g,0,h);let _=e.createBuffer({label:`ulg-gpumath-eig-a`,size:Math.max(16,f*4),usage:E.STORAGE|E.COPY_DST|E.COPY_SRC});e.queue.writeBuffer(_,0,p);let v=e.createBuffer({label:`ulg-gpumath-eig-v`,size:Math.max(16,f*4),usage:E.STORAGE|E.COPY_SRC}),y=e.createBuffer({label:`ulg-gpumath-eig-vals`,size:Math.max(16,c*s*4),usage:E.STORAGE|E.COPY_SRC}),b=e.createBindGroup({layout:m.bindGroupLayout,entries:[g,_,v,y].map((e,t)=>({binding:t,resource:{buffer:e}}))}),x=e.createCommandEncoder({label:`ulg-gpumath-jacobi-eig`}),S=x.beginComputePass({label:`ulg-gpumath-jacobi-eig-pass`});if(S.setPipeline(m.pipeline),S.setBindGroup(0,b),S.dispatchWorkgroups(c),S.end(),o)return e.queue.submit([x.finish()]),g.destroy(),_.destroy(),Object.freeze({schema:T,backend:`webgpu`,n:s,batchCount:c,eigenvaluesBuffer:y,eigenvectorsBuffer:v,destroy(){y.destroy(),v.destroy()}});let C=e.createBuffer({label:`ulg-gpumath-eig-read-vals`,size:Math.max(16,c*s*4),usage:E.MAP_READ|E.COPY_DST}),w=e.createBuffer({label:`ulg-gpumath-eig-read-vecs`,size:Math.max(16,f*4),usage:E.MAP_READ|E.COPY_DST});x.copyBufferToBuffer(y,0,C,0,c*s*4),x.copyBufferToBuffer(v,0,w,0,f*4),e.queue.submit([x.finish()]);try{await Promise.all([C.mapAsync(E.MAP_READ),w.mapAsync(E.MAP_READ)]);let e=new Float32Array(C.getMappedRange().slice(0,c*s*4)),t=new Float32Array(w.getMappedRange().slice(0,f*4));return C.unmap(),w.unmap(),Object.freeze({schema:T,backend:`webgpu`,n:s,batchCount:c,eigenvalues:e,eigenvectors:t})}finally{for(let e of[g,_,v,y,C,w])e.destroy()}}async function A(e,{fockMatrices:t,overlapMatrices:n,n:r,batchCount:i=1,maxSweeps:a=32,tolerance:o=1e-6}={}){if(!e||typeof e.createBuffer!=`function`)throw TypeError(`solveGeneralizedSymmetricEigenBatchedWebGpu requires a live WebGPU GPUDevice`);let s=Math.trunc(Number(r)),c=Math.max(1,Math.trunc(Number(i))),d=s*s,f=c*d,p=t instanceof Float32Array?t:Float32Array.from(t),m=await k(e,{matrices:n instanceof Float32Array?n:Float32Array.from(n),n:s,batchCount:c,maxSweeps:a,tolerance:o,keepResident:!0}),h=u(e,{cacheKey:`ulg-gpumath-mat-op.v1`,label:`ulg-gpumath-mat-op`,code:O,entryPoint:`mat_op`,bindings:[l(0,`uniform`),l(1,`read-only-storage`),l(2,`read-only-storage`),l(3,`storage`)]}),g=u(e,{cacheKey:`ulg-gpumath-jacobi-sym-batched.v1`,label:`ulg-gpumath-jacobi-sym-batched`,code:D,entryPoint:`jacobi_symmetric_batched`,bindings:[l(0,`uniform`),l(1,`storage`),l(2,`storage`),l(3,`storage`)]}),_=t=>{let n=e.createBuffer({size:16,usage:E.UNIFORM|E.COPY_DST});return e.queue.writeBuffer(n,0,new Uint32Array(t)),n},v=_([s,c,0,d]),y=_([s,c,1,d]),b=new ArrayBuffer(32);new Uint32Array(b,0,4).set([s,c,a,d]),new Float32Array(b,16,4).set([o,0,0,0]);let x=e.createBuffer({size:32,usage:E.UNIFORM|E.COPY_DST});e.queue.writeBuffer(x,0,b);let S=Math.max(16,f*4),C=e.createBuffer({size:S,usage:E.STORAGE|E.COPY_DST});e.queue.writeBuffer(C,0,p);let w=e.createBuffer({size:S,usage:E.STORAGE}),A=e.createBuffer({size:S,usage:E.STORAGE}),j=e.createBuffer({size:S,usage:E.STORAGE}),M=e.createBuffer({size:S,usage:E.STORAGE}),N=e.createBuffer({size:S,usage:E.STORAGE|E.COPY_SRC}),ee=e.createBuffer({size:Math.max(16,c*s*4),usage:E.STORAGE|E.COPY_SRC}),P=e.createBuffer({size:Math.max(16,c*s*4),usage:E.MAP_READ|E.COPY_DST}),F=e.createBuffer({size:S,usage:E.MAP_READ|E.COPY_DST}),I=(t,n)=>e.createBindGroup({layout:t,entries:n.map((e,t)=>({binding:t,resource:{buffer:e}}))}),L=I(h.bindGroupLayout,[v,m.eigenvectorsBuffer,m.eigenvaluesBuffer,w]),R=I(h.bindGroupLayout,[y,w,C,A]),z=I(h.bindGroupLayout,[y,A,w,j]),te=I(g.bindGroupLayout,[x,j,M,ee]),B=I(h.bindGroupLayout,[y,w,M,N]),V=Math.ceil(f/64),ne=e.createCommandEncoder({label:`ulg-gpumath-gen-eig`}),H=ne.beginComputePass({label:`ulg-gpumath-gen-eig-pass`});H.setPipeline(h.pipeline),H.setBindGroup(0,L),H.dispatchWorkgroups(V),H.setBindGroup(0,R),H.dispatchWorkgroups(V),H.setBindGroup(0,z),H.dispatchWorkgroups(V),H.setPipeline(g.pipeline),H.setBindGroup(0,te),H.dispatchWorkgroups(c),H.setPipeline(h.pipeline),H.setBindGroup(0,B),H.dispatchWorkgroups(V),H.end(),ne.copyBufferToBuffer(ee,0,P,0,c*s*4),ne.copyBufferToBuffer(N,0,F,0,f*4),e.queue.submit([ne.finish()]);try{await Promise.all([P.mapAsync(E.MAP_READ),F.mapAsync(E.MAP_READ)]);let e=new Float32Array(P.getMappedRange().slice(0,c*s*4)),t=new Float32Array(F.getMappedRange().slice(0,f*4));return P.unmap(),F.unmap(),Object.freeze({schema:T,backend:`webgpu`,generalized:!0,n:s,batchCount:c,eigenvalues:e,eigenvectors:t})}finally{m.destroy();for(let e of[v,y,x,C,w,A,j,M,N,ee,P,F])e.destroy()}}var j=`ulg.electronic.molecular-hf-webgpu.v1`,M=27.211386245988,N=Object.freeze({MAP_READ:1,COPY_SRC:4,COPY_DST:8,UNIFORM:64,STORAGE:128}),ee=`
struct MolVolParams {
  dim: u32,
  atom_count: u32,
  mode: u32, // 0 = total electron density, 1 = HOMO signed orbital, 2 = LUMO signed orbital
  pad0: u32,
  box_half_bohr: f32,
  pad1: f32,
  pad2: f32,
  pad3: f32,
};

// Per-atom compact orbital envelope: vec4(x, y, z, zeta), vec4(occ_weight, homo_coeff, lumo_coeff, Z)
@group(0) @binding(0) var<uniform> params: MolVolParams;
@group(0) @binding(1) var<storage, read> atoms_pos_zeta: array<vec4<f32>>;
@group(0) @binding(2) var<storage, read> atoms_weights: array<vec4<f32>>;
// Output dim^3 vec4(pos_amp, neg_amp, core_norm, density)
@group(0) @binding(3) var<storage, read_write> volume_out: array<vec4<f32>>;

@compute @workgroup_size(64)
fn sample_molecular_volume(@builtin(global_invocation_id) id: vec3<u32>) {
  let dim = params.dim;
  let total = dim * dim * dim;
  let idx = id.x;
  if (idx >= total) { return; }
  let ix = idx % dim;
  let iy = (idx / dim) % dim;
  let iz = idx / (dim * dim);
  let fx = ((f32(ix) + 0.5) / f32(dim)) * 2.0 - 1.0;
  let fy = ((f32(iy) + 0.5) / f32(dim)) * 2.0 - 1.0;
  let fz = ((f32(iz) + 0.5) / f32(dim)) * 2.0 - 1.0;
  let p = vec3<f32>(fx, fy, fz) * params.box_half_bohr;

  var rho_tot = 0.0;
  var psi_orb = 0.0;
  var min_r = 1e9;
  for (var a = 0u; a < params.atom_count; a = a + 1u) {
    let az = atoms_pos_zeta[a];
    let aw = atoms_weights[a];
    let r = length(p - az.xyz);
    min_r = min(min_r, r);
    let phi = exp(-az.w * r);
    rho_tot = rho_tot + aw.x * phi * phi;
    let c = select(aw.z, aw.y, params.mode == 1u);
    psi_orb = psi_orb + c * phi;
  }
  if (params.mode == 0u) {
    let d = clamp(pow(max(0.0, rho_tot * 0.65), 0.72), 0.0, 1.0);
    let bond_glow = clamp(abs(psi_orb) * 0.85, 0.0, 1.0);
    volume_out[idx] = vec4<f32>(
      clamp(d * 0.82 + bond_glow * 0.25, 0.0, 1.0),
      clamp(d * 0.48 + bond_glow * 0.55, 0.0, 1.0),
      clamp(d * 1.05 + bond_glow * 0.35, 0.0, 1.0),
      d
    );
  } else {
    let pos_a = clamp(max(0.0, psi_orb), 0.0, 1.0);
    let neg_a = clamp(max(0.0, -psi_orb), 0.0, 1.0);
    let d = clamp(abs(psi_orb), 0.0, 1.0);
    volume_out[idx] = vec4<f32>(pos_a, neg_a, clamp(min_r / max(params.box_half_bohr, 1.0), 0.0, 1.0), d);
  }
}
`;async function P(e,n,{maxScf:r=35,tol:i=1e-5,damping:a=.35,volDim:s=24,volumeMode:c=0,basisName:d=`sto-3g`,sampleVolume:f=!0,initialP:p=null}={}){if(!e||typeof e.createBuffer!=`function`)throw TypeError(`solveMoleculeRhfWebGpu requires a live WebGPU GPUDevice`);if(!Array.isArray(n)||n.length===0)throw TypeError(`solveMoleculeRhfWebGpu requires non-empty atoms array`);let m=n.map(e=>{let t=Array.isArray(e.position)?e.position:[Number(e.x)||0,Number(e.y)||0,Number(e.z)||0];return{Z:Math.trunc(e.Z),x:t[0],y:t[1],z:t[2],position:t}}),{basis:h,n:g,nElectrons:_,S:v,Hcore:y,eri:b,idx:x,nuclearRepulsion:S}=t(m,0,d),C=_,w=Math.max(1,Math.floor(C/2)),T=new Float32Array(g*g),E=new Float64Array(g*g);for(let e=0;e<g;e+=1)for(let t=0;t<g;t+=1)T[e*g+t]=v[e][t],E[e*g+t]=y[e][t];let D=p&&p.length===g*g?new Float64Array(p):new Float64Array(g*g),O=0,k=new Float32Array(g),P=new Float32Array(g*g),F=0;for(let t=0;t<r;t+=1){F=t+1;let n=new Float64Array(g*g);for(let e=0;e<g;e+=1)for(let t=0;t<g;t+=1){let r=0;for(let n=0;n<g;n+=1)for(let i=0;i<g;i+=1){let a=D[n*g+i];a!==0&&(r+=a*(b[x(e,t,n,i)]-.5*b[x(e,i,n,t)]))}n[e*g+t]=E[e*g+t]+r}let r=await A(e,{fockMatrices:Float32Array.from(n),overlapMatrices:T,n:g,batchCount:1,maxSweeps:28,tolerance:1e-6});k=r.eigenvalues,P=r.eigenvectors;let o=new Float64Array(g*g);for(let e=0;e<g;e+=1)for(let t=0;t<g;t+=1){let n=0;for(let r=0;r<Math.min(w,g);r+=1)n+=2*P[e*g+r]*P[t*g+r];o[e*g+t]=(1-a)*n+a*D[e*g+t]}let s=0;for(let e=0;e<g*g;e+=1)s+=.5*o[e]*(E[e]+n[e]);let c=s+S;if(D=o,t>1&&Math.abs(c-O)<i){O=c;break}O=c}let I=Math.max(0,Math.min(g-1,w-1)),L=Math.min(g-1,w),R=k[I],z=w<g?k[L]:R+.4,te=Math.max(.1,(z-R)*M);if(!f)return Object.freeze({schema:j,backend:`webgpu`,basisCount:g,electronCount:C,atoms:Object.freeze(m.map(e=>Object.freeze({Z:e.Z,x:e.x,y:e.y,z:e.z}))),scfIterations:F,totalEnergyHa:O,nuclearRepulsionHa:S,homoEnergyHa:R,lumoEnergyHa:z,homoLumoGapEv:te,densityMatrix:D,accuracyTier:o.TIER_2_REPRESENTATIVE_EFFECTIVE,provenance:Object.freeze({status:`webgpu-derived`,scientificValidation:!1,solver:`gpumath-rhf-lowdin-sto3g`})});let B=new Float64Array(m.length);for(let e=0;e<m.length;e+=1)B[e]=m[e].Z;for(let e=0;e<g;e+=1){let t=0;for(let n=0;n<g;n+=1)t+=D[e*g+n]*v[n][e];let n=h[e].atomIndex??0;n<B.length&&(B[n]-=t)}let V=0,ne=0,H=0;for(let e=0;e<m.length;e+=1)V+=B[e]*m[e].x,ne+=B[e]*m[e].y,H+=B[e]*m[e].z;let re=Math.hypot(V,ne,H)*2.541746,U=u(e,{cacheKey:`ulg-mol-hf-volume.v1`,label:`ulg-mol-hf-volume`,code:ee,entryPoint:`sample_molecular_volume`,bindings:[l(0,`uniform`),l(1,`read-only-storage`),l(2,`read-only-storage`),l(3,`storage`)]}),W=new Float32Array(m.length*4),G=new Float32Array(m.length*4),K=1.5;for(let e=0;e<m.length;e+=1){let t=m[e];K=Math.max(K,Math.hypot(t.x,t.y,t.z)+2.5),W[e*4+0]=t.x,W[e*4+1]=t.y,W[e*4+2]=t.z,W[e*4+3]=Math.max(.85,Math.min(2.6,.9+.14*Math.sqrt(t.Z)));let n=0,r=0,i=0;for(let t=0;t<g;t+=1)(h[t].atomIndex??0)===e&&(n+=P[t*g+I],r+=P[t*g+L],i+=D[t*g+t]);G[e*4+0]=Math.max(.5,i),G[e*4+1]=n,G[e*4+2]=r,G[e*4+3]=t.Z}let q=s**3,J=new ArrayBuffer(32);new Uint32Array(J,0,4).set([s,m.length,c,0]),new Float32Array(J,16,4).set([K,0,0,0]);let Y=e.createBuffer({size:32,usage:N.UNIFORM|N.COPY_DST});e.queue.writeBuffer(Y,0,J);let X=e.createBuffer({size:Math.max(16,W.byteLength),usage:N.STORAGE|N.COPY_DST});e.queue.writeBuffer(X,0,W);let ie=e.createBuffer({size:Math.max(16,G.byteLength),usage:N.STORAGE|N.COPY_DST});e.queue.writeBuffer(ie,0,G);let ae=e.createBuffer({size:q*16,usage:N.STORAGE|N.COPY_SRC}),Z=e.createBuffer({size:q*16,usage:N.MAP_READ|N.COPY_DST}),oe=e.createBindGroup({layout:U.bindGroupLayout,entries:[Y,X,ie,ae].map((e,t)=>({binding:t,resource:{buffer:e}}))}),Q=e.createCommandEncoder({label:`ulg-mol-hf-volume`}),$=Q.beginComputePass({label:`ulg-mol-hf-volume-pass`});$.setPipeline(U.pipeline),$.setBindGroup(0,oe),$.dispatchWorkgroups(Math.ceil(q/64)),$.end(),Q.copyBufferToBuffer(ae,0,Z,0,q*16),e.queue.submit([Q.finish()]);try{await Z.mapAsync(N.MAP_READ);let e=new Float32Array(Z.getMappedRange().slice(0,q*16));return Z.unmap(),Object.freeze({schema:j,backend:`webgpu`,basisCount:g,electronCount:C,atoms:Object.freeze(m.map(e=>Object.freeze({Z:e.Z,x:e.x,y:e.y,z:e.z}))),scfIterations:F,totalEnergyHa:O,nuclearRepulsionHa:S,homoEnergyHa:R,lumoEnergyHa:z,homoLumoGapEv:te,dipoleDebye:re,mullikenCharges:Array.from(B),orbitalEnergiesHa:Array.from(k),volDim:s,boxHalfBohr:K,volumeData:e,atomOrbitalParams:Object.freeze({posZeta:new Float32Array(W),weights:new Float32Array(G),boxHalfBohr:K,homoIdx:I,lumoIdx:L}),accuracyTier:o.TIER_2_REPRESENTATIVE_EFFECTIVE,provenance:Object.freeze({status:`webgpu-derived`,scientificValidation:!1,solver:`gpumath-rhf-lowdin-sto3g`})})}finally{for(let e of[Y,X,ie,ae,Z])e.destroy()}}var F=`ulg.electronic.ci-neb-webgpu.v1`;async function I(e,t,n,{nImages:r=5,maxSteps:i=5,springK:a=.08,stepSize:o=.14,climbStartStep:s=1,forceTol:c=.015,gradH:l=.0025,maxScf:u=22,tol:d=1e-4,basisName:f=`sto-3g`}={}){if(!e||typeof e.createBuffer!=`function`)throw TypeError(`climbingImageNEBWebGpu requires a live WebGPU GPUDevice`);let p=e=>Array.isArray(e.position)?[Number(e.position[0])||0,Number(e.position[1])||0,Number(e.position[2])||0]:[Number(e.x)||0,Number(e.y)||0,Number(e.z)||0],m=t.map(e=>Math.trunc(e.Z)),h=m.length,g=t.map(p),_=n.map(p),v=[];for(let e=0;e<r;e+=1){let t=e/Math.max(1,r-1);v.push(g.map((e,n)=>[e[0]+t*(_[n][0]-e[0]),e[1]+t*(_[n][1]-e[1]),e[2]+t*(_[n][2]-e[2])]))}let y=(e,t)=>{let n=[];for(let r=0;r<h;r+=1)n.push(e[r][0]-t[r][0],e[r][1]-t[r][1],e[r][2]-t[r][2]);return n},b=(e,t)=>e.reduce((e,n,r)=>e+n*t[r],0),x=e=>Math.sqrt(b(e,e)),S=e=>e.map((e,t)=>({Z:m[t],position:e})),C=Array(r).fill(null),w=0;async function T(t,n,r){let i=await P(e,S(n),{maxScf:u,tol:d,basisName:f,sampleVolume:!1,initialP:C[t]});if(w+=1,C[t]=i.densityMatrix,!r)return{energyHa:i.totalEnergyHa,grad:Array(3*h).fill(0)};let a=Array(3*h).fill(0),o=n.map(e=>[...e]),s=+(h>=2);for(let n=s;n<h;n+=1)for(let r=0;r<3;r+=1){let i=o[n][r];o[n][r]=i+l;let c=(await P(e,S(o),{maxScf:14,tol:d,basisName:f,sampleVolume:!1,initialP:C[t]})).totalEnergyHa;w+=1,o[n][r]=i-l;let u=(await P(e,S(o),{maxScf:14,tol:d,basisName:f,sampleVolume:!1,initialP:C[t]})).totalEnergyHa;w+=1,o[n][r]=i;let p=(c-u)/(2*l);a[n*3+r]=p,s===1&&(a[r]-=p)}return{energyHa:i.totalEnergyHa,grad:a}}let E=Array(r).fill(0),D=1/0,O=!1,k=0,A=await T(0,v[0],!1),j=await T(r-1,v[r-1],!1);for(let e=0;e<i;e+=1){k=e+1;let t=Array(r);E=Array(r),E[0]=A.energyHa,t[0]=A.grad,E[r-1]=j.energyHa,t[r-1]=j.grad;for(let e=1;e<r-1;e+=1){let n=await T(e,v[e],!0);E[e]=n.energyHa,t[e]=n.grad}let n=1;for(let e=2;e<r-1;e+=1)E[e]>E[n]&&(n=e);let i=Array(r);D=0;for(let o=1;o<r-1;o+=1){let r=y(v[o+1],v[o]),c=y(v[o],v[o-1]),l;if(E[o+1]>E[o]&&E[o]>E[o-1])l=r;else if(E[o+1]<E[o]&&E[o]<E[o-1])l=c;else{let e=Math.max(Math.abs(E[o+1]-E[o]),Math.abs(E[o-1]-E[o])),t=Math.min(Math.abs(E[o+1]-E[o]),Math.abs(E[o-1]-E[o]));l=E[o+1]>E[o-1]?r.map((n,r)=>n*e+c[r]*t):r.map((n,r)=>n*t+c[r]*e)}let u=Math.max(1e-12,x(l)),d=l.map(e=>e/u),f=t[o].map(e=>-e),p=b(f,d),m;if(e>=s&&o===n)m=f.map((e,t)=>e-2*p*d[t]);else{let e=f.map((e,t)=>e-p*d[t]),t=a*(x(r)-x(c));m=e.map((e,n)=>e+t*d[n])}i[o]=m,D=Math.max(D,...m.map(Math.abs))}if(D<c&&e>=s){O=!0;break}for(let e=1;e<r-1;e+=1){let t=i[e],n=Math.max(1e-12,x(t)),r=Math.min(o,.08/n);for(let n=0;n<h;n+=1)v[e][n][0]+=r*t[n*3],v[e][n][1]+=r*t[n*3+1],v[e][n][2]+=r*t[n*3+2]}}let M=1;for(let e=2;e<r-1;e+=1)E[e]>E[M]&&(M=e);return Object.freeze({schema:F,backend:`webgpu`,gpuRhfCalls:w,images:Object.freeze(v.map(e=>Object.freeze(e.map((e,t)=>Object.freeze({Z:m[t],position:[...e]}))))),energiesHa:Object.freeze([...E]),saddleImageIndex:M,transitionStateAtoms:Object.freeze(v[M].map((e,t)=>Object.freeze({Z:m[t],position:[...e]}))),forwardBarrierHa:Math.max(0,E[M]-E[0]),reverseBarrierHa:Math.max(0,E[M]-E[r-1]),reactionEnergyHa:E[r-1]-E[0],maxForceHaPerBohr:D,steps:k,converged:O,provenance:Object.freeze({status:`webgpu-derived`,solver:`gpumath-rhf-ci-neb`,scientificValidation:!1})})}var L=`peercompute.ulg.simulation-module-registration.v1`;function R(e,t=null){return String(e??``).trim()||t}function z(e){if(typeof e==`string`)return e.trim()||null;if(!e||typeof e!=`object`)return null;let t=R(e.model??e.moduleId??e.id);return t?`${t}@${e.version==null?`1`:String(e.version).trim()}`:null}function te(e={},t=null){if(!t||typeof t!=`object`)return{ok:!0};if(!e||typeof e!=`object`)return{ok:!1,reason:`parameters-must-be-object`};for(let[n,r]of Object.entries(t)){if(!r||typeof r!=`object`)continue;let t=e[n];if(t===void 0){if(r.required===!0)return{ok:!1,reason:`missing-required-parameter:${n}`};continue}if(r.type===`number`){let e=Number(t);if(!Number.isFinite(e))return{ok:!1,reason:`non-finite-parameter:${n}`};if(r.min!=null&&e<r.min)return{ok:!1,reason:`parameter-below-min:${n}:${e}<${r.min}`};if(r.max!=null&&e>r.max)return{ok:!1,reason:`parameter-above-max:${n}:${e}>${r.max}`}}else if(r.type===`boolean`&&typeof t!=`boolean`)return{ok:!1,reason:`parameter-not-boolean:${n}`};else if(r.type===`string`&&typeof t!=`string`)return{ok:!1,reason:`parameter-not-string:${n}`}}return{ok:!0}}function B({createArtifact:t=i}={}){let n=new Map,r=new Map;function a(e,t,{device:n=null,sessionId:i=null}={}){let a=R(i,`${e}:default`),o=r.get(a);if(o&&!o.disposed)return o;let s=d({sessionId:a,moduleId:e,device:n,layout:t.stateLayout,initialStep:0});return r.set(a,s),s}function o(t={}){let r=z(t.method??t.methodId??t.id);if(!r)throw TypeError(`Simulation module registration requires method ({ model, version }) or methodId`);if(typeof t.stepCapsule!=`function`)throw TypeError(`Simulation module ${r} requires a stepCapsule(capsule, context) function`);let i=Object.freeze({schema:L,methodKey:r,method:typeof t.method==`object`&&t.method?Object.freeze({...t.method}):Object.freeze({model:r.split(`@`)[0],version:r.split(`@`)[1]||`1`}),kernel:t.kernel&&typeof t.kernel==`object`?Object.freeze({sourceModule:R(t.kernel.sourceModule),entryPoint:R(t.kernel.entryPoint,`main`),workgroupSize:Number.isInteger(t.kernel.workgroupSize)?t.kernel.workgroupSize:64,wgslHash:t.kernel.wgsl?e(t.kernel.wgsl):R(t.kernel.wgslHash)}):null,parameterSchema:t.parameterSchema&&typeof t.parameterSchema==`object`?Object.freeze({...t.parameterSchema}):Object.freeze({}),stateLayout:t.stateLayout&&typeof t.stateLayout==`object`?Object.freeze({tensorId:R(t.stateLayout.tensorId,`state`),dtype:R(t.stateLayout.dtype,`f32`),layout:R(t.stateLayout.layout,`interleaved`),strideElements:Number(t.stateLayout.strideElements)||1,strideBytes:Number(t.stateLayout.strideBytes)||4,fields:Object.freeze(Array.isArray(t.stateLayout.fields)?[...t.stateLayout.fields]:[])}):Object.freeze({tensorId:`state`,dtype:`f32`,layout:`interleaved`,strideElements:1,strideBytes:4,fields:Object.freeze([])}),scaleRangeM:Array.isArray(t.scaleRangeM)&&t.scaleRangeM.length===2?Object.freeze([Number(t.scaleRangeM[0]),Number(t.scaleRangeM[1])]):null,supportsResidentStep:typeof t.stepResident==`function`,registeredAt:new Date().toISOString()});return n.set(r,{descriptor:i,stepCapsule:t.stepCapsule,stepResident:typeof t.stepResident==`function`?t.stepResident:null,reset:typeof t.reset==`function`?t.reset:null,dispose:typeof t.dispose==`function`?t.dispose:null}),i}function l(e){let t=z(e);return t&&n.get(t)||null}function u(e){return l(e)!==null}function f(){return[...n.values()].map(e=>e.descriptor)}function p(e){let t=z(e);if(!t||!n.has(t))return!1;let i=n.get(t);for(let[e,n]of[...r.entries()])n.moduleId===t&&(n.dispose(),r.delete(e));return i.dispose?.(),n.delete(t),!0}function m(e,{device:t=null,sessionId:n=null}={}){let r=l(e);if(!r)throw RangeError(`Unregistered simulation module: ${z(e)||`missing`}`);return a(r.descriptor.methodKey,r.descriptor,{device:t,sessionId:n})}async function h(e,{sessionId:t=null,nextStep:n=0,destroyBuffers:r=!0,reason:i=`module-session-reset`}={}){let o=l(e);if(!o)throw RangeError(`Unregistered simulation module: ${z(e)||`missing`}`);let s=a(o.descriptor.methodKey,o.descriptor,{sessionId:t}),c=s.reset({nextStep:n,destroyBuffers:r,reason:i});return o.reset&&await o.reset({session:s,receipt:c,nextStep:n,reason:i}),c}async function g(e,{device:n=null,gpuLease:r=null,sessionId:i=null}={}){if(!e||e.serviceId!==c.ulgRuntime||e.taskKind!==s.simulationStep)return{matched:!1,reason:`not-ulg-runtime-simulation-step`};let o=l(e.method);if(!o)return{matched:!1,reason:`method-not-registered`};if(!e.taskId||!e.inputHash||!e.methodHash||!e.provenance)throw TypeError(`Registered simulation.step capsule requires taskId, inputHash, methodHash, and provenance`);let u=te(e.input?.parameters,o.descriptor.parameterSchema);if(!u.ok){let e=RangeError(`Invalid simulation parameters for ${o.descriptor.methodKey}: ${u.reason}`);throw e.code=`ERR_INVALID_SIMULATION_MODULE_PARAMETERS`,e}let d=a(o.descriptor.methodKey,o.descriptor,{device:n,sessionId:i??e.input?.sessionId??null}),f=await o.stepCapsule(e,{createSimulationArtifact:t,device:n,gpuLease:r,leaseSession:d,moduleDescriptor:o.descriptor}),p=f?.artifact??f,m=f?.leaseHandle??null,h=d.summary(),g=p&&typeof p==`object`?{...p,execution:{...p.execution||{},registeredModule:o.descriptor.methodKey,gpuLeaseStatus:r?.status??p.execution?.gpuLeaseStatus??null,residentLeaseSession:h}}:p;return{matched:!0,methodKey:o.descriptor.methodKey,artifact:g,leaseHandle:m,leaseSession:d,leaseSummary:h}}return Object.freeze({schema:L,registerModule:o,resolveModule:l,hasModule:u,listModules:f,unregisterModule:p,getModuleLeaseSession:m,resetModuleSession:h,dispatchSimulationStepCapsule:g})}var V=B();export{P as a,w as c,I as i,C as l,B as n,k as o,V as r,b as s,z as t};