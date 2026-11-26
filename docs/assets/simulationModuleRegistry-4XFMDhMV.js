import{Gt as e,Jt as t,Kt as n,Ut as r,Vt as i,Wt as a,Yt as o,_ as s,_t as c,a as l,bt as u,mo as d,n as f,p,po as m,qt as h,r as g,s as _,vt as v,wt as y,yt as b}from"./molecularDynamicsWebGpu-CVM2Trpi.js";import{S as x,_ as S,n as C}from"./batchedSymmetricEigensolverGpu-DvdPNMKk.js";import{n as w,r as T}from"./ClosureRegistry-BkvnpwMz.js";import{i as E}from"./residentBufferLease-EzWfR0Bs.js";import{a as D}from"./webgpuCompat-C1bfdHJP.js";var O=`peercompute.ulg.radial-kohn-sham-webgpu.v1`,k=128,A=1,j=`
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
`,M=`
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
`,N=`
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
`,P=`
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
`;function F(e){let t=2166136261,n=2654435769;for(let r=0;r<e.length;r+=1){let i=e.charCodeAt(r);t=Math.imul(t^i,16777619)>>>0,n=Math.imul(n^i+r,2246822507)>>>0}return`wgsl-fnv1a64:${t.toString(16).padStart(8,`0`)}${n.toString(16).padStart(8,`0`)}`}var ee=F(`${j}::${M}::${N}::${P}`),te=new WeakMap;function I(e){let t=te.get(e);if(t)return t;let n=e.createShaderModule({label:`ulg-ks-potential-wgsl`,code:j}),r=e.createShaderModule({label:`ulg-ks-observables-wgsl`,code:M}),i=e.createShaderModule({label:`ulg-ks-spinorbit-wgsl`,code:N}),a=e.createShaderModule({label:`ulg-ks-eigensolver-wgsl`,code:P}),o=e.createBindGroupLayout({label:`ulg-ks-pot-bgl`,entries:[{binding:0,visibility:4,buffer:{type:`uniform`}},{binding:1,visibility:4,buffer:{type:`read-only-storage`}},{binding:2,visibility:4,buffer:{type:`storage`}},{binding:3,visibility:4,buffer:{type:`storage`}},{binding:4,visibility:4,buffer:{type:`storage`}},{binding:5,visibility:4,buffer:{type:`storage`}},{binding:6,visibility:4,buffer:{type:`storage`}}]}),s=e.createBindGroupLayout({label:`ulg-ks-obs-bgl`,entries:[{binding:0,visibility:4,buffer:{type:`uniform`}},{binding:1,visibility:4,buffer:{type:`read-only-storage`}},{binding:2,visibility:4,buffer:{type:`read-only-storage`}},{binding:3,visibility:4,buffer:{type:`read-only-storage`}},{binding:4,visibility:4,buffer:{type:`storage`}},{binding:5,visibility:4,buffer:{type:`read-only-storage`}},{binding:6,visibility:4,buffer:{type:`read-only-storage`}},{binding:7,visibility:4,buffer:{type:`storage`}}]}),c=e.createBindGroupLayout({label:`ulg-ks-so-bgl`,entries:[{binding:0,visibility:4,buffer:{type:`uniform`}},{binding:1,visibility:4,buffer:{type:`read-only-storage`}},{binding:2,visibility:4,buffer:{type:`read-only-storage`}},{binding:3,visibility:4,buffer:{type:`read-only-storage`}},{binding:4,visibility:4,buffer:{type:`read-only-storage`}},{binding:5,visibility:4,buffer:{type:`storage`}}]}),l=e.createBindGroupLayout({label:`ulg-ks-eig-bgl`,entries:[{binding:0,visibility:4,buffer:{type:`uniform`}},{binding:1,visibility:4,buffer:{type:`read-only-storage`}},{binding:2,visibility:4,buffer:{type:`read-only-storage`}},{binding:3,visibility:4,buffer:{type:`read-only-storage`}},{binding:4,visibility:4,buffer:{type:`read-only-storage`}},{binding:5,visibility:4,buffer:{type:`storage`}},{binding:6,visibility:4,buffer:{type:`storage`}},{binding:7,visibility:4,buffer:{type:`storage`}},{binding:8,visibility:4,buffer:{type:`storage`}}]});return t={potPipeline:e.createComputePipeline({label:`ulg-ks-pot-pipe`,layout:e.createPipelineLayout({bindGroupLayouts:[o]}),compute:{module:n,entryPoint:`ks_hartree_pbe_xc`}}),obsPipeline:e.createComputePipeline({label:`ulg-ks-obs-pipe`,layout:e.createPipelineLayout({bindGroupLayouts:[s]}),compute:{module:r,entryPoint:`ks_density_and_observables`}}),soPipeline:e.createComputePipeline({label:`ulg-ks-so-pipe`,layout:e.createPipelineLayout({bindGroupLayouts:[c]}),compute:{module:i,entryPoint:`ks_spin_orbit_quadrature`}}),packAuxPipeline:e.createComputePipeline({label:`ulg-ks-pack-aux-pipe`,layout:e.createPipelineLayout({bindGroupLayouts:[l]}),compute:{module:a,entryPoint:`ks_pack_aux`}}),eigPipeline:e.createComputePipeline({label:`ulg-ks-eig-pipe`,layout:e.createPipelineLayout({bindGroupLayouts:[l]}),compute:{module:a,entryPoint:`ks_solve_radial_orbitals`}}),potBgl:o,obsBgl:s,soBgl:c,eigBgl:l},te.set(e,t),t}async function ne(t,n,{functional:r=`pbe`,spinOrbit:i=!0,scalarRelativistic:a=!1,nuclearChargeRadiusBohr:o=0,nuclearMassU:s=null,nuclearSpinI:c=0,nuclearMagneticMomentMuN:l=0,configuration:u=null,gridPointsN:d=256,rMinBohr:f=1e-4,rMaxBohr:p=null,mixing:m=.25,maxScf:g=60,returnRadialDensity:_=!0,returnOrbitalWavefunctions:v=!1}={}){if(!t||typeof t.createComputePipeline!=`function`)throw TypeError(`solveAtomFullWebGpu requires a valid WebGPU GPUDevice.`);let y=Math.min(256,Math.max(64,Math.floor(d))),b=String(r||`pbe`).toLowerCase(),x=b===`bare`?2:+(b===`pbe`),S=a?i?2:1:0,C=Math.max(0,Number(o)||0),w=p??Math.max(20,60/Math.sqrt(n)),T=Math.log(f),E=(Math.log(w)-T)/(y-1),D=new Float64Array(y),j=new Float32Array(y),M=new Float32Array(y);for(let e=0;e<y;e+=1){let t=Math.exp(T+e*E);D[e]=t,j[e]=t,M[e]=n*(n**3/Math.PI)*Math.exp(-2*n*t)}let N=u??e(n),P=N.length,F=new Float32Array(Math.max(1,P)*4);for(let e=0;e<P;e+=1)F[e*4+0]=N[e].n,F[e*4+1]=N[e].l,F[e*4+2]=N[e].occupancy,F[e*4+3]=-(n*n)/(2*N[e].n*N[e].n);let{potPipeline:te,obsPipeline:ne,soPipeline:re,packAuxPipeline:ie,eigPipeline:ae,potBgl:L,obsBgl:R,soBgl:z,eigBgl:oe}=I(t),B=y*4,se=new ArrayBuffer(32),V=new Uint32Array(se),ce=new Float32Array(se);V[0]=y,V[1]=x,ce[2]=n,ce[3]=E,ce[4]=m,V[5]=P,V[6]=S,ce[7]=C;let le=t.createBuffer({size:32,usage:72}),ue=t.createBuffer({size:B,usage:136}),de=t.createBuffer({size:B,usage:140}),fe=t.createBuffer({size:B,usage:k}),pe=t.createBuffer({size:B,usage:k}),me=t.createBuffer({size:B,usage:k}),H=t.createBuffer({size:B,usage:k}),U=t.createBuffer({size:B*4,usage:k}),he=t.createBuffer({size:Math.max(1,P)*B,usage:v?132:k}),ge=t.createBuffer({size:Math.max(1,P)*16,usage:140}),_e=t.createBuffer({size:Math.max(1,P)*16,usage:132}),W=t.createBuffer({size:16,usage:132}),ve=t.createBuffer({size:Math.max(1,P)*16,usage:132}),ye=v?Math.max(1,P)*B:0,be=Math.max(1,P)*16,xe=16+be*3+B+ye,G=t.createBuffer({size:xe,usage:9});try{t.queue.writeBuffer(le,0,se),t.queue.writeBuffer(ue,0,j),t.queue.writeBuffer(de,0,M),t.queue.writeBuffer(ge,0,F);let e=t.createBindGroup({layout:L,entries:[le,ue,de,fe,pe,me,H].map((e,t)=>({binding:t,resource:{buffer:e}}))}),r=t.createBindGroup({layout:oe,entries:[le,ue,pe,me,H,U,he,ge,_e].map((e,t)=>({binding:t,resource:{buffer:e}}))}),a=t.createBindGroup({layout:R,entries:[le,ue,he,ge,de,fe,U,W].map((e,t)=>({binding:t,resource:{buffer:e}}))}),o=t.createBindGroup({layout:z,entries:[le,ue,he,ge,H,ve].map((e,t)=>({binding:t,resource:{buffer:e}}))}),u=t.createCommandEncoder({label:`ulg-ks-full-webgpu-scf`}),d=u.beginComputePass({label:`ulg-ks-full-webgpu-scf-pass`}),f=Math.max(1,Math.min(120,Math.floor(g)));for(let t=0;t<f;t+=1)d.setPipeline(te),d.setBindGroup(0,e),d.dispatchWorkgroups(1,1,1),d.setPipeline(ie),d.setBindGroup(0,r),d.dispatchWorkgroups(1,1,1),d.setPipeline(ae),d.setBindGroup(0,r),d.dispatchWorkgroups(Math.max(1,P),1,1),d.setPipeline(ne),d.setBindGroup(0,a),d.dispatchWorkgroups(1,1,1);d.setPipeline(re),d.setBindGroup(0,o),d.dispatchWorkgroups(Math.max(1,P),1,1),d.end();let p=be;u.copyBufferToBuffer(W,0,G,0,16),u.copyBufferToBuffer(ge,0,G,16,p),u.copyBufferToBuffer(ve,0,G,16+p,p),u.copyBufferToBuffer(_e,0,G,16+p*2,p),u.copyBufferToBuffer(de,0,G,16+p*3,B),v&&ye>0&&u.copyBufferToBuffer(he,0,G,16+p*3+B,ye),t.queue.submit([u.finish()]),await G.mapAsync(A);let m=new Float32Array(G.getMappedRange().slice(0));G.unmap();let b={integratedElectrons:m[0],eHartreeDouble:m[1],eXcCorrection:m[2],scfL1Delta:m[3]},w=4+P*4,T=4+P*8,k=4+P*12,I=k+y,V=Array.from(m.slice(k,k+y)),ce=v?Array.from({length:P},(e,t)=>m.slice(I+t*y,I+(t+1)*y)):null,xe=0,K=0,Se=0,Ce=[];for(let e=0;e<P;e+=1){let t=m[4+e*4+3],n=N[e],r=m[T+e*4+0],a=m[T+e*4+1],o=m[T+e*4+2],s=Math.max(0,Number(m[T+e*4+3])||0);xe+=n.occupancy*t,K+=n.occupancy,Se+=n.occupancy*s;let c={n:n.n,l:n.l,occupancy:n.occupancy,energyHa:t,kappaPlus:-(n.l+1),...n.l>=1?{kappaMinus:n.l}:{},smallComponentNormSq:s};i&&n.l>=1&&(S===2&&Number.isFinite(r)&&Number.isFinite(a)?(c.energyJMinusHa=r,c.energyJPlusHa=a,c.spinOrbitSplittingHa=o,c.spinOrbitXiHa=o/(n.l+.5)):(c.spinOrbitXiHa=m[w+e*4+0],c.spinOrbitSplittingHa=m[w+e*4+1],c.energyJMinusHa=m[w+e*4+2],c.energyJPlusHa=m[w+e*4+3])),Ce.push(c)}let q=xe-b.eHartreeDouble+b.eXcCorrection,we=Number(s),Te=Number.isFinite(we)&&we>0,J=Te?1/(1+1/(we*1822.8884862)):1,Ee=q*J,De=Ee-q,Oe=n/137.035999084,ke=S?4/(3*Math.PI)*(1/137.035999084)**3*n**4*Math.max(.5,Math.log(1/Math.max(1e-6,Oe*Oe))-2.3):0,Ae=Math.max(0,Number(c)||0),je=Number(l)||0,Me=Math.max(0,V[0]||0),Y=Ae>0&&Math.abs(je)>0&&Me>0?Me*Math.PI*1420405751*(Math.abs(je)/2.792847)*((Ae+.5)/1):0;return{schema:O,symbol:h(n),atomicNumberZ:n,configuration:N,functional:x===2?`bare`:x?`pbe`:`lda`,dirac4Component:S===2,totalSmallComponentNormSq:Se,relativisticMethod:S===2?`dirac-4comp-gpu+qed`:S===1?`koelling-harmon-gpu+qed`:i?`schrodinger-log-gpu+spin-orbit`:`schrodinger-log-gpu`,finiteNucleusUsed:C>0,nuclearChargeRadiusBohr:C,nuclearMassU:Te?we:null,reducedMassFactor:J,isotopeMassShiftHa:De,hyperfineSplittingHz:Y,qedRadiativeShiftHa:ke,totalEnergyHa:Ee+ke,orbitals:Ce,electronCount:K,integratedElectrons:b.integratedElectrons,scfIterations:f,scfL1Delta:b.scfL1Delta,resolverStatus:`webgpu-derived`,webgpuNativeEigensolver:!0,perScfCpuReadbacks:0,webgpuProgramHash:ee,..._?{radialGrid:{r:Array.from(D),rho:V,dx:E}}:{},...v&&ce?{orbitalWavefunctions:ce}:{},validation:Object.freeze({scientificValidation:!1,webgpuParity:!1})}}finally{for(let e of[le,ue,de,fe,pe,me,H,U,he,ge,_e,W,ve,G])e.destroy()}}var re=`ulg.electronic.periodic-bulk-dft-webgpu.v1`,ie=27.211386245988,ae=v/c**3*1e-9,L=c*1e10,R=1054571817e-43,z=1380649e-29;function oe(t){let n=e(t),r=n.reduce((e,t)=>Math.max(e,t.n),0),i=n.find(e=>e.n===r&&e.l===0),a=n.find(e=>e.n===r&&e.l===1),o=n.find(e=>e.n===r&&e.l===2),s=o||n.find(e=>e.n===r-1&&e.l===2),c=o?0:i?.occupancy??0,l=o?0:a?.occupancy??0;return{maxN:r,sSub:i,pSub:a,dSub:s,sOcc:c,pOcc:l,dOcc:s?.occupancy??0,isClosedShell:(r===1&&c===2||l===6)&&!o,isMolecularNonmetal:!o&&(r===1&&c===1||l===5||r===2&&l>=3&&l<=4),isCovalentTetrahedral:!o&&(r>=2&&r<=5&&l===2||r===2&&l===1)}}var B=Object.freeze({fcc:Object.freeze({id:`fcc`,spaceGroup:`Fm-3m (225)`,madelungAlpha:-1.79175,coord:12,atomsPerConv:4,packingFactor:Math.PI/(3*Math.SQRT2),shearRatioGOverK:.45,basisFractional:[[0,0,0]]}),bcc:Object.freeze({id:`bcc`,spaceGroup:`Im-3m (229)`,madelungAlpha:-1.79186,coord:8,atomsPerConv:2,packingFactor:Math.PI*Math.sqrt(3)/8,shearRatioGOverK:.48,basisFractional:[[0,0,0]]}),hcp:Object.freeze({id:`hcp`,spaceGroup:`P6_3/mmc (194)`,madelungAlpha:-1.79168,coord:12,atomsPerConv:4,packingFactor:Math.PI/(3*Math.SQRT2),shearRatioGOverK:.46,basisFractional:[[0,0,0],[1/3,2/3,.5]]}),diamond:Object.freeze({id:`diamond`,spaceGroup:`Fd-3m (227)`,madelungAlpha:-1.67085,coord:4,atomsPerConv:8,packingFactor:Math.PI*Math.sqrt(3)/16,shearRatioGOverK:.72,basisFractional:[[-.125,-.125,-.125],[.125,.125,.125]]}),"vdw-fcc":Object.freeze({id:`vdw-fcc`,spaceGroup:`Fm-3m (vdW)`,madelungAlpha:-1.79175,coord:12,atomsPerConv:4,packingFactor:Math.PI/(3*Math.SQRT2),shearRatioGOverK:.32,basisFractional:[[0,0,0]]})});function se(e){let t=oe(e);return t.isClosedShell||t.isMolecularNonmetal?[`vdw-fcc`]:t.isCovalentTetrahedral?[`diamond`,`fcc`]:!t.dSub&&!t.pSub&&t.sOcc===1?[`bcc`,`fcc`]:!t.dSub&&!t.pSub&&t.sOcc===2?[`hcp`,`fcc`,`bcc`]:t.dOcc>=1&&t.dOcc<=9?[`bcc`,`fcc`,`hcp`]:[`fcc`,`bcc`,`hcp`]}var V=Object.freeze([[0,0,0],[1,1,1],[-1,1,1],[1,-1,1],[1,1,-1],[-1,-1,1],[-1,1,-1],[1,-1,-1],[-1,-1,-1],[2,0,0],[-2,0,0],[0,2,0],[0,-2,0],[0,0,2],[0,0,-2]]);function ce(e,t,n,r,i){let a=V.length,o=new Float32Array(a*a),s=2*Math.PI/Math.max(1.5,t),c=i===`bcc`?t**3/2:i===`diamond`?t**3/8:t**3/4,l=y(n/Math.max(1e-6,c)),u=1.919158292677513/Math.max(.25,l);for(let t=0;t<a;t+=1){let l=V[t],d=(e[0]+l[0])*s,f=(e[1]+l[1])*s,p=(e[2]+l[2])*s;o[t*a+t]=.5*(d*d+f*f+p*p);for(let e=t+1;e<a;e+=1){let d=V[e],f=(l[0]-d[0])*s,p=(l[1]-d[1])*s,m=(l[2]-d[2])*s,h=Math.hypot(f,p,m);if(h<1e-8)continue;let g=-(4*Math.PI*n/(c*h*h))*Math.cos(h*r),_=h/(2*u),v=_<1e-4?1:Math.abs(_-1)<1e-4?.5:.5+(1-_*_)/(4*_)*Math.log(Math.abs((1+_)/(1-_))),y=1+4*u/(Math.PI*h*h)*v,b=1;if(i===`diamond`){let e=(l[0]-d[0]+(l[1]-d[1])+(l[2]-d[2]))*(Math.PI/4);b=Math.cos(e)}else if(i===`hcp`){let e=((l[0]-d[0])/3+2*(l[1]-d[1])/3+.5*(l[2]-d[2]))*Math.PI;b=Math.cos(e)}let x=g/y*b;o[t*a+e]=x,o[e*a+t]=x}}return o}function le(){let e=[{label:`Γ`,k:[0,0,0]},{label:`X`,k:[0,1,0]},{label:`W`,k:[.5,1,0]},{label:`L`,k:[.5,.5,.5]},{label:`Γ`,k:[0,0,0]}],t=[];for(let n=0;n<e.length-1;n+=1){let r=e[n].k,i=e[n+1].k;for(let a=0;a<4;a+=1){let o=a/4;t.push({label:a===0?e[n].label:``,k:[r[0]+o*(i[0]-r[0]),r[1]+o*(i[1]-r[1]),r[2]+o*(i[2]-r[2])]})}}return t.push(e[e.length-1]),t}function ue(e,t,n){let r=Math.max(.8,e),{Z:i,zv:a,rcBohr:o,polarizabilityBohr3:s,rVdwBohr:c,dOcc:l,fOcc:d,relSContraction:f,spGapHa:p}=n,m=4*Math.PI/3*r**3;if(t.id===`vdw-fcc`){let e=r*2.2097,t=.75*Math.max(.15,n.ionizationPotentialHa||.5)*s*s,i=Math.max(2.2,c*1.52),a=(i/e)**6;return 2*Math.max(1e-5,t/(4*i**6))*(12.13188*a*a-14.45392*a)}let h=r/Math.cbrt(Math.max(1,a)),g=1.10495/(h*h)*a,_=(u(h)+b(h))*a,v=t.madelungAlpha*a*a/(2*r),y=2*Math.PI*a*a*o*o/m,x=0;if(l>0&&l<10){let e=.38*Math.min(1.6,1+.008*i)*(3/r)**3.2;x-=.5*e*l*(1-l/10),x+=.16*e*(l/10+.35)*(2.85/r)**6}if(d>0&&d<14){let e=.08*(3.4/r)**4;x-=.25*e*d*(1-d/14)}if(t.id===`diamond`){let e=r*1.3959,t=Math.max(2.6,o*2.35),n=Math.exp(-.9*(e-t)),i=Math.max(.25,.11*a*a/Math.max(2,t));x+=(a>=3&&a<=5?2.4:.5)*i*(n*n-2*n)}l===10&&a===2&&f>.08&&(x+=.18*f*(p||.2)*(3.2/r)**2.5);let{sOcc:S=0,pOcc:C=0}=n,w=0;return t.id===`bcc`?w=l>=3&&l<=6||l===0&&C===0&&S===1?-.0085:.0045:t.id===`fcc`?w=l>=8&&l<=10&&!(l===10&&S===2&&C===0)||l===0&&S===2&&C>=1||l===10&&C>=1?-.0095:.0015:t.id===`hcp`&&(w=l===0&&C===0&&S===2||l===1||l===2||l===7||l===10&&S===2&&C===0||d>0&&d<14?-.009:.002),g+_+v+y+x+w}function de(e,t){let n=0;for(let e=1;e<t.length;e+=1)t[e]<t[n]&&(n=e);let r=Math.max(1,Math.min(t.length-2,n)),i=4*Math.PI/3*e[r-1]**3,a=4*Math.PI/3*e[r]**3,o=4*Math.PI/3*e[r+1]**3,s=t[r-1],c=t[r],l=t[r+1],u=(c-s)/(a-i),d=(l-c)/(o-a),f=2*(d-u)/(o-i),p=.5*(u+d),m=a-(f>1e-12?p/f:0);m=Math.max(i*.9,Math.min(o*1.1,m));let h=Math.cbrt(3*m/(4*Math.PI)),g=c-(f>1e-12?.5*p*p/f:0),_=Math.max(1e-7,m*Math.max(1e-9,f))*ae;return{rWsEq:h,vEqBohr3:m,eMinHa:g,bulkModulusGPa:_}}function fe(t,n){let r=e(t),i=r.reduce((e,t)=>Math.max(e,t.n),0),a=r.find(e=>e.n===i&&e.l===2),s=a||r.find(e=>e.n===i-1&&e.l===2),c=r.find(e=>e.n===i-2&&e.l===3),l=a?null:r.find(e=>e.n===i&&e.l===0),u=a?null:r.find(e=>e.n===i&&e.l===1),d=Math.max(1,o(t)||(s?Math.min(4,s.occupancy):1)),f=2,p=3.2,m=6,h=n?.radialGrid;if(h?.r&&h?.rho){let{r:e,rho:t,dx:n}=h,r=0,i=0;for(let r=0;r<e.length;r+=1)i+=4*Math.PI*e[r]*e[r]*e[r]*t[r]*n;let a=0,o=0;for(let s=0;s<e.length;s+=1){let c=4*Math.PI*e[s]*e[s]*e[s]*t[s]*n;r+=c,r>=.88*i&&f===2&&(f=e[s]),t[s]>=.001&&(p=e[s]),r>=Math.max(0,i-d-1)&&(a+=e[s]*e[s]*c,o+=c)}o>1e-6&&(m=a/o)}let g=Math.max(.55,Math.min(3.2,f*.78)),_=Array.isArray(n?.orbitals)?n.orbitals.filter(e=>Number(e.occupancy??1)>0):[],v=_.length?Math.max(..._.map(e=>Number(e.energyHa??e.energy??-.4))):-.35,y=Math.max(.12,-v),b=s?_.find(e=>e.n===s.n&&e.l===2):null,x=c?_.find(e=>e.n===c.n&&e.l===3):null,S=b?Number(b.energyHa??b.energy??-.35):null,C=x?Number(x.energyHa??x.energy??-.45):null,w=Math.max(1.2,Math.min(450,4/(9*Math.max(1,d))*m**2*d)),T=Math.min(.35,.5*(t/137.036)**2);return Object.freeze({Z:t,maxN:i,zv:d,rcBohr:g,rVdwBohr:Math.max(1.8,p),meanR2Valence:m,polarizabilityBohr3:w,ionizationPotentialHa:y,dOcc:s?.occupancy??0,dPrincipalN:s?.n??0,dOrbitalEnergyHa:S,fOcc:c?.occupancy??0,fPrincipalN:c?.n??0,fOrbitalEnergyHa:C,sOcc:l?.occupancy??0,pOcc:u?.occupancy??0,relSContraction:T,spGapHa:.22+.4*T})}async function pe(e,t,i,{densityGridN:a=16,atomicMassU:o=null}={}){if(!e||typeof e.createBuffer!=`function`)throw TypeError(`solveBulkCrystalWebGpu requires a live WebGPU GPUDevice`);let s=fe(t,i),l=se(t),u=null;for(let e of l){let t=B[e],n=e===`vdw-fcc`?Math.max(2,s.rVdwBohr*.72):Math.max(1.3,s.rcBohr*1.15),r=e===`vdw-fcc`?Math.max(n+2.5,s.rVdwBohr*1.45):Math.max(n+2.8,s.rcBohr*3.1),i=new Float64Array(19),a=new Float64Array(19);for(let e=0;e<19;e+=1)i[e]=n+e/18*(r-n),a[e]=ue(i[e],t,s);let o=de(i,a);(!u||o.eMinHa<u.fit.eMinHa)&&(u={struct:t,fit:o})}let{struct:d,fit:f}=u,p=Number(o),m=Number.isFinite(p)&&p>0?p*16605390666e-37:r(t),g=Math.max(1e6,f.bulkModulusGPa*1e9),_=g*d.shearRatioGOverK,v=f.vEqBohr3*c**3,y=m/v,b=Math.sqrt((g+4/3*_)/y),x=Math.sqrt(_/y),w=Math.cbrt(3/(1/b**3+2/x**3)),T=R/z*Math.cbrt(6*Math.PI*Math.PI/v)*w,E=Math.min(.18,1.5*1.6*z*T/Math.max(1e-24,g*v)),O=f.vEqBohr3*(1+E),k=O*c**3,A=m/k,j=Math.cbrt(d.atomsPerConv*O),M=j*L,N=(3*g-2*_)/(2*(3*g+_)),P=g+4/3*_,F=g-2/3*_,ee=_,te=Math.sqrt((g+4/3*_)/A),I=Math.sqrt(_/A),ne=Math.cbrt(3/(1/te**3+2/I**3)),ae=1/k,pe=R/z*Math.cbrt(6*Math.PI*Math.PI*ae)*ne,me=Math.max(.01,Math.min(11,Math.abs(f.eMinHa)*ie*.45+(d.id===`vdw-fcc`?0:.6))),H=le(),U=V.length,he=new Float32Array(H.length*U*U);for(let e=0;e<H.length;e+=1){let t=ce(H[e].k,j,s.zv,s.rcBohr,d.id);he.set(t,e*U*U)}let ge=await C(e,{matrices:he,n:U,batchCount:H.length,maxSweeps:28,tolerance:1e-5}),_e=[],W=[],ve=Math.max(1,Math.ceil(s.zv/2)),ye=-1/0,be=1/0;for(let e=0;e<H.length;e+=1){let t=[];for(let n=0;n<Math.min(8,U);n+=1){let r=ge.eigenvalues[e*U+n]*ie;t.push(r),W.push(r)}_e.push(t);let n=Math.min(t.length-2,ve-1);ye=Math.max(ye,t[n]),be=Math.min(be,t[n+1])}W.sort((e,t)=>e-t);let xe=W[Math.min(W.length-1,Math.floor(H.length*(s.zv/2)))],G=a,K=G**3,Se=new Float32Array(K*2);for(let e=0;e<U;e+=1){let[t,n,r]=V[e],i=(t%G+G)%G,a=(n%G+G)%G,o=((r%G+G)%G*G+a)*G+i,s=ge.eigenvectors[e*U+0],c=ve>1?ge.eigenvectors[e*U+1]:0;Se[o*2]+=s,Se[o*2+1]+=c}let Ce=await D(e,{data:Se,n:G,inverse:!0}),q=new Float32Array(K),we=1e-12;for(let e=0;e<K;e+=1){let t=Ce.data[e*2],n=Ce.data[e*2+1],r=t*t+n*n;q[e]=r,r>we&&(we=r)}for(let e=0;e<K;e+=1)q[e]/=we;let Te=1/(2*Math.max(.08,j/G)),J=0;for(let e=0;e<G;e+=1){let t=(e+G-1)%G,n=(e+1)%G;for(let r=0;r<G;r+=1){let i=(r+G-1)%G,a=(r+1)%G;for(let o=0;o<G;o+=1){let s=(o+G-1)%G,c=(o+1)%G,l=(e*G+r)*G+o,u=Math.max(.025,q[l]),d=(q[(e*G+r)*G+c]-q[(e*G+r)*G+s])*Te,f=(q[(e*G+a)*G+o]-q[(e*G+i)*G+o])*Te,p=(q[(n*G+r)*G+o]-q[(t*G+r)*G+o])*Te;J+=Math.hypot(d,f,p)/u}}}let Ee=J/Math.max(1,K),De=1.35;if(i?.radialGrid?.r&&i?.radialGrid?.rho){let{r:e,rho:t,dx:n}=i.radialGrid,r=Math.max(.25,s.rcBohr*.35),a=Math.max(r+.5,f.rWsEq),o=0,c=0;for(let i=1;i+1<e.length;i+=1){let s=e[i];if(s<r||s>a)continue;let l=Math.max(1e-8,t[i]),u=Math.abs(t[i+1]-t[i-1])/(2*n*s),d=4*Math.PI*s*s*s*n;o+=Math.min(8,u/l)*d,c+=d}c>1e-6&&(De=o/c)}let Oe=.65*De+.35*Ee,ke=Math.max(1.05,Math.min(1.95,-.012+1.023*Math.sqrt(Math.max(.05,Oe)))),Ae=n(t).reduce((e,t)=>e+(t.occUp-t.occDown),0),je=s.dOcc>0&&s.dOcc<10,Me=s.fOcc>0&&s.fOcc<14,Y=0,X=0,Z=0;if(Me){let e=Math.max(.18,Math.min(2,Math.abs(s.fOrbitalEnergyHa??-.45))),t=s.fPrincipalN<=4?1:.68;Y=Math.max(2.6,Math.min(7.4,7.6*e**.35*t));let n=s.fOcc/14;X=.5*Y*s.fOcc*(1-n),Z=Ae/7*Y*.32}else if(je){let e=Math.max(.14,Math.min(1.5,Math.abs(s.dOrbitalEnergyHa??-.35))),t=3/Math.max(3,s.dPrincipalN||3);Y=Math.max(1,Math.min(6.2,5.4*e**.35*t));let n=s.dOcc/10;X=.5*Y*s.dOcc*(1-n),Z=Ae/5*Y*.28}let Ne=.5*Z,Pe=Object.freeze({up:Object.freeze(_e.map(e=>Object.freeze(e.map(e=>e-Ne)))),down:Object.freeze(_e.map(e=>Object.freeze(e.map(e=>e+Ne))))}),Fe=Math.max(0,be-ye),Ie=.65+.35*ke;if(d.id===`vdw-fcc`){let e=oe(t);Fe=Math.max(Fe,Math.min(21.5,s.ionizationPotentialHa*ie*(e.isClosedShell?.85:.42)*Math.max(.92,Math.min(1.15,Ie))))}else d.id===`diamond`?Fe=Math.max(.4,(Fe+.35)*Ie*(1+1.55/Math.max(1.5,M*.45))):Fe<.25&&(Fe=0);let Le=Math.min(...W)-2,Re=Math.max(...W)+2,ze=new Float32Array(48),Be=new Float32Array(48),Ve=Math.max(.35,(Re-Le)/36);for(let e=0;e<48;e+=1){let t=Le+e/47*(Re-Le);ze[e]=t;let n=0;for(let e of W){let r=(t-e)/Ve;n+=Math.exp(-.5*r*r)}Be[e]=2*n/(H.length*Ve*Math.sqrt(2*Math.PI))}let He=0;if(Fe===0){let e=Math.max(0,Math.min(47,Math.round((xe-Le)/Math.max(1e-6,Re-Le)*47)));He=Math.max(.15,Be[e]+(s.dOcc>0&&s.dOcc<10?.32*Math.sin(Math.PI*s.dOcc/10)*6.5:0))}return Object.freeze({schema:re,backend:`webgpu`,Z:t,symbol:h(t),crystalStructure:d.id,spaceGroup:d.spaceGroup,coordinationNumber:d.coord,latticeConstantA:M,wignerSeitzRadiusBohr:f.rWsEq,densityKgPerM3:A,cohesiveEnergyEv:me,bulkModulusPa:g,bulkModulusGPa:g*1e-9,shearModulusPa:_,poissonRatio:N,elasticConstantsGPa:Object.freeze({c11:P*1e-9,c12:F*1e-9,c44:ee*1e-9}),soundSpeedLongMPerS:te,soundSpeedTransMPerS:I,debyeTemperatureK:pe,fermiEnergyEv:xe,bandGapEv:Fe,isMetal:Fe===0,dosAtFermiStatesPerEvAtom:He,mbjCParameter:ke,mbjAvgGradRhoOverRho:Oe,dftUHubbardEv:Y,dftUCorrelationEnergyEv:X,dftUExchangeSplittingEv:Z,spinSplitBandsEv:Pe,kPathLabels:H.map(e=>e.label),bandsEv:_e,dosEnergyEv:ze,dosValues:Be,blochDensityGridN:G,blochDensity3d:q,spinUnpairedElectrons:Ae,accuracyTier:t<=100?d.id===`vdw-fcc`||s.fOcc>0?S.TIER_2_REPRESENTATIVE_EFFECTIVE:S.TIER_1_QUANTITATIVE:S.TIER_3_THEORETICAL_ENVELOPE,provenance:Object.freeze({status:`webgpu-derived`,scientificValidation:!1,solver:`gpumath-bloch-pw-fft3d-mbj-dftu-bm3`})})}var me=`ulg.electromagnetic.closure-webgpu.v1`,H=1602176634e-28,U=91093837015e-41,he=88541878128e-22,ge=125663706212e-17,_e=92740100783e-34,W=1054571817e-43,ve=1380649e-29,ye=1602176634e-28,be=27.211386245988;async function xe(t,{Z:r,atomResult:i,bulkResult:a,temperatureK:o=300}={}){let s=e(r),l=n(r),u=s.reduce((e,t)=>Math.max(e,t.n),0),d=s.find(e=>e.n===u&&e.l===2),f=d||s.find(e=>e.n===u-1&&e.l===2),p=s.find(e=>e.n===u-2&&e.l===3),m=d?null:s.find(e=>e.n===u&&e.l===0),h=d?null:s.find(e=>e.n===u&&e.l===1),g=f?.occupancy??0,v=p?.occupancy??0,y=m?.occupancy??0,b=h?.occupancy??0,x=l.reduce((e,t)=>e+(t.occUp-t.occDown),0),C=d?1.2:Math.max(1,y+b+.18*Math.min(g,10-g)),w=4*Math.PI/3*(a.wignerSeitzRadiusBohr*c)**3,T=1/Math.max(1e-32,w),E=a.isMetal?C*T:0,D=W*(a.isMetal?Math.sqrt(E*H*H/(he*U)):0)/ye,O=1,k=1,A=a.wignerSeitzRadiusBohr,j=!!(f&&f.n>=u-1&&g>0);if(a.isMetal&&!j){if(b===0&&y>=1&&y<=2&&i?.radialGrid?.r&&i?.radialGrid?.rho){let{r:e,rho:t,dx:n}=i.radialGrid,r=0;for(let i=0;i<e.length;i+=1)r+=4*Math.PI*e[i]**3*t[i]*n;let a=0,o=0,s=0,c=Math.max(0,r-y);for(let r=0;r<e.length;r+=1){let i=4*Math.PI*e[r]**3*t[r]*n;a+=i,a>=c&&(o+=e[r]*i,s+=i)}if(s>.15){let e=o/s*.86;Number.isFinite(e)&&e>A&&(A=Math.min(6,e))}}let e=Array.isArray(i?.orbitals)?i.orbitals.find(e=>e.n===u-1&&e.l===1&&Number(e.occupancy??e.occ??0)>=6):null;if(e){let t=Math.max(.28,Math.abs(Number(e.energyHa??e.energy??-.8))),n=1.35/(t*t)*(Math.max(1,e.n)/2)**1.35,r=Math.max(8,Math.max(2,A||3.5)**3);O=1+Math.min(.85,3*n/r)}if(y<=2&&b===0&&u>=4){let e=Math.max(0,u-3);k=1+.046*e*e*(y===1?1:.45)}}let M=4*Math.PI/3*(A*c)**3,N=a.isMetal?C/Math.max(1e-32,M):0,P=a.isMetal?W*Math.sqrt(N*H*H/(he*U))/ye:0,F=a.isMetal?P/Math.sqrt(O*k):0,ee=Math.max(0,Number(a.dftUHubbardEv||0)),te=Number.isFinite(Number(a.mbjCParameter))?Number(a.mbjCParameter):null,I=((u===4&&g>0&&g<10?.92:v>0&&v<14?.58:g>0&&g<10?.55:.25)+.045*Math.min(6,ee))*(.5*(a.dosAtFermiStatesPerEvAtom||0)),ne=r*(.65*c)**2;if(i?.radialGrid?.r&&i?.radialGrid?.rho){let{r:e,rho:t,dx:n}=i.radialGrid,r=0;for(let i=0;i<e.length;i+=1)r+=4*Math.PI*e[i]**5*t[i]*n;Number.isFinite(r)&&r>0&&(ne=r*c**2)}let re=-(T*ge*H*H*ne)/(6*U),ie=a.isMetal?ge*_e*_e*(a.dosAtFermiStatesPerEvAtom/ye)*T:0,ae=`diamagnetic`,L=0,R=0,z=re+2/3*ie;a.isMetal&&u===4&&g>=6&&g<=8&&I>.85?(ae=`ferromagnetic`,L=Math.max(.55,(10-g)*.62-.12),R=Math.max(350,320*L*I),z=o>R?ge*T*(L*_e)**2/(3*ve*Math.max(10,o-R)):1e3):a.isMetal&&v>=6&&v<=11?(ae=`ferromagnetic`,L=x*.95,R=Math.max(20,42*(x*(x+2))/20),z=o>R?ge*T*(L*_e)**2/(3*ve*Math.max(10,o-R)):500):a.isMetal&&u===4&&(g===4||g===5)?(ae=`antiferromagnetic`,L=.6+.35*(g-4),R=g===5?210:120,z=ge*T*(L*_e)**2/(3*ve*(o+R))):x>0&&!a.isMetal?(ae=`paramagnetic`,L=Math.sqrt(x*(x+2)),z=re+ge*T*(L*_e)**2/(3*ve*Math.max(1,o))):z>0&&(ae=`paramagnetic`);let oe=Math.max(30,a.debyeTemperatureK||250),B=a.isMetal?Math.max(.08,Math.min(1.8,.14+.16*(a.dosAtFermiStatesPerEvAtom||.5)*(300/oe))):0,se=0;if(a.isMetal){let e=o/oe,t=e>=.4?1:(e/.4)**4,n=Math.max(1e11,2*Math.PI*B*ve*o/W*t);se=E*H*H/(U*n)}else{let e=a.bandGapEv*ye,t=2*(U*ve*o/(2*Math.PI*W*W))**1.5*Math.exp(-e/(2*ve*Math.max(1,o))),n=.05*(300/Math.max(10,o))**1.5;se=Math.max(1e-18,t*H*n)}let V=1/Math.max(1e-20,se),ce=Array.isArray(i?.orbitals)?i.orbitals.filter(e=>Number(e.occupancy??1)>0):[],le=ce.length?Math.max(...ce.map(e=>Number(e.energyHa??e.energy??-.35))):-.35,ue=Math.max(1.8,Math.min(6.5,-le*be*.52+.65)),de=a.isMetal?1/0:1+((F||10.5)/Math.max(.5,a.bandGapEv*1.4))**2,fe=.12,pe=y+b,xe=a.dosAtFermiStatesPerEvAtom||.5,G=g>0&&g<10?.31*xe*(450/oe)**.35:0,K=pe>=2?.18*(pe-.85)*(350/Math.max(80,oe))**.5*(1+.28*xe):0,Se=a.isMetal?Math.max(B,Math.min(1.65,.08+G+K)):0,Ce=0;if(a.isMetal&&ae!==`ferromagnetic`&&ae!==`antiferromagnetic`&&Se>fe*1.45){let e=-(1.04*(1+Se))/Math.max(.05,Se-fe*(1+.62*Se));Ce=Math.max(0,oe/1.45*Math.exp(e))}let q=[`s`,`p`,`d`,`f`,`g`],we=[];if(a.isMetal&&Array.isArray(i?.orbitals)&&i.orbitals.length>0){let e=Math.max(1e-9,E)*c**3,t=Math.cbrt(3*Math.PI*Math.PI*e),n=Math.sqrt(4*t/Math.PI),r=.5*be*n*n,o=i.orbitals.filter(e=>Number(e.occupancy??e.occ??0)>0),s=i.orbitals.filter(e=>Number(e.occupancy??e.occ??0)<2*(2*e.l+1));for(let e of o){if(e.l<2)continue;let t=2*(2*e.l+1),n=Number(e.occupancy??e.occ??0),i=Number.isFinite(e.energyJPlusHa),o=i?e.energyJPlusHa:Number(e.energyHa??e.energy??-.5);for(let c of s){if(c.n===e.n&&c.l===e.l||Math.abs(c.l-e.l)!==1)continue;let s=Number(c.energyHa??c.energy??-.05);if(!(s>o))continue;let l=Math.max(0,Math.min(1.6,.16*Number(a.fermiEnergyEv||0))),u=(s-o)*be+l;if(!(u>.2&&u<9.5))continue;let d=2*(2*c.l+1),f=Number(c.occupancy??c.occ??0),p=Math.min(1,Math.max(0,n/t)),m=Math.min(1,Math.max(0,1-f/d)),h=c.l>e.l?(e.l+1)/(2*e.l+1):e.l/(2*e.l+1),g=p*m*h*(e.l===2?1.85:.75);if(!(g>0))continue;let _=Math.max(.22,.1*u+.032*r*Math.sqrt(g)),v=i?`(${2*e.l+1}/2)`:``,y=`${e.n}${q[e.l]||e.l}${v}→${c.n}${q[c.l]||c.l}`;we.push(Object.freeze({energyEv:u,dampingEv:_,strengthWeight:g,transitionLabel:y}))}}we.sort((e,t)=>e.energyEv-t.energyEv||t.strengthWeight-e.strengthWeight),we.splice(4)}let Te=a.isMetal?Math.max(.08,Math.min(2.6,W*(E*H*H)/Math.max(1e-20,U*se)/ye+(g>0&&g<10?.55:0))):.25,J=null;t&&typeof t.createBuffer==`function`&&(J=(await _(t,[a.isMetal?{mode:0,atomicNumberZ:r,conductionElectronDensityPerM3:Math.max(1e27,E),plasmaEnergyEv:Math.max(1,F),dampingEv:Te,interbandOscillators:we,pathLengthM:.1}:{mode:2,atomicNumberZ:r,electronicGapEv:Math.max(.2,a.bandGapEv),pathLengthM:.1}]))?.results?.[0]??null);let Ee=J?.spectralSamples?.find(e=>Math.abs(e.wavelengthNm-550)<=6)||J?.spectralSamples?.[Math.floor((J?.spectralSamples?.length||1)/2)]||null,De=Array.isArray(J?.baseColorSrgb)&&J.baseColorSrgb.length===3?J.baseColorSrgb.map(e=>Math.max(0,Math.min(1,Number(e)||0))):a.isMetal?[.7,.72,.76]:[.85,.9,.96],Oe=Number.isFinite(Ee?.nRe)&&Ee.nRe>0?Ee.nRe:a.isMetal?1.5:Math.sqrt(Math.max(1,de)),ke=Number.isFinite(Ee?.reflectance)?Ee.reflectance:Number.isFinite(J?.reflectance)?J.reflectance:a.isMetal?.72:.04;return Object.freeze({schema:me,backend:J?`webgpu`:`analytical-em`,Z:r,temperatureK:o,isMetal:a.isMetal,bandGapEv:a.bandGapEv,plasmaEnergyEv:F,barePlasmaEnergyEv:D,coreDielectricInf:O,drudeDampingEv:Te,interbandOscillators:Object.freeze(we),workFunctionEv:ue,electronPhononLambda:B,electricalConductivitySPerM:se,electricalResistivityOhmM:V,staticDielectricConstant:de,magneticPhase:ae,stonerProduct:I,dftUHubbardEv:ee,mbjCParameter:te,magneticMomentMuB:L,curieOrNeelTempK:R,magneticSusceptibilitySi:z,superconductingTcK:Ce,opticalSrgb:De,refractiveIndex550Nm:Oe,reflectance550Nm:ke,spectralWavelengthsNm:J?.spectralSamples?.map(e=>e.wavelengthNm)??null,spectralReflectance:J?.spectralSamples?.map(e=>e.reflectance??0)??null,spectralNRe:J?.spectralSamples?.map(e=>e.nRe??1)??null,spectralAbsorptionPerM:J?.spectralSamples?.map(e=>e.absorptionPerM??0)??null,accuracyTier:S.TIER_2_REPRESENTATIVE_EFFECTIVE,provenance:Object.freeze({status:J?J.resolverStatus||`webgpu-derived`:`reduced-estimate`,oscillatorSource:J?.oscillatorSource??`none`,scientificValidation:!1,model:`stoner-bloch-gruneisen-kubo-drude-mcmillan`})})}var G=`ulg.thermodynamic.element-md-webgpu.v1`,K=1380649e-29,Se=602214076e15,Ce=1602176634e-28,q=8.314462618,we=2.44300455e-8;function Te(e,t,n){let r=Math.max(.5,Number(e)),i=Math.max(1,Number(t)),a=i/r,o=0,s=a/32;for(let e=0;e<32;e+=1){let t=(e+.5)*s;if(t>60)continue;let n=Math.exp(t);o+=t*t*t*t*n/((n-1)*(n-1))*s}return 9*K*(r/i)**3*o/Math.max(1e-30,n)}function J({Z:t,bulkResult:n}){let r=n.crystalStructure,i=Math.max(2,n.latticeConstantA),a=Math.max(.005,n.cohesiveEnergyEv),o=n.coordinationNumber||12,s=r===`bcc`?i*Math.sqrt(3)/2:r===`diamond`?i*Math.sqrt(3)/4:i/Math.SQRT2;if(r===`vdw-fcc`){let e=s/2**(1/6),t=Math.max(5e-4,a/8.61);return Object.freeze({potentialModel:f.LENNARD_JONES,modelName:`shifted-force-lj-london`,epsilonEv:t,sigmaOrR0A:e,alphaOrLambda:0,rcutA:Math.min(i*1.45,e*2.5),eamAEv:0,eamBeta:0,swGamma:0,rNearestNeighborA:s})}if(r===`diamond`){let e=s/1.1225,t=Math.max(.2,a/2);return Object.freeze({potentialModel:f.STILLINGER_WEBER,modelName:`stillinger-weber-sp3`,epsilonEv:t,sigmaOrR0A:e,alphaOrLambda:21,rcutA:Math.min(i*1.35,e*1.8),eamAEv:0,eamBeta:0,swGamma:1.2,rNearestNeighborA:s})}let c=(n.bulkModulusPa||5e10)/160217663400,l=i**3/(r===`bcc`?2:4),u=.55*a/(.5*o),d=.45*a/Math.sqrt(o),p=e(Math.max(1,Math.min(118,Math.trunc(Number(t)||1)))),m=p.reduce((e,t)=>Math.max(e,t.n),1),h=p.find(e=>e.n===m-2&&e.l===3)?.occupancy??0,g=h>0&&h<14?m>=7?.78:.88:1,_=Math.sqrt(Math.max(.08,9*c*l/Math.max(1e-4,2*o*u*s*s))),v=Math.max(.85,Math.min(2.25,_*g)),y=Math.min(i*1.45,s*1.85),b=v*1.05,x=(r===`bcc`?[[8,1],[6,2/Math.sqrt(3)],[12,Math.sqrt(8/3)],[24,Math.sqrt(11/3)]]:r===`hcp`?[[12,1],[6,Math.SQRT2],[2,Math.sqrt(8/3)],[18,Math.sqrt(3)]]:[[12,1],[6,Math.SQRT2],[24,Math.sqrt(3)]]).map(([e,t])=>({count:e,r:s*t})).filter(e=>e.r<y-1e-4),S=e=>{let t=0;for(let n of x){let r=1-n.r/y;t+=n.count*Math.exp(-b*(n.r-e))*r*r}let n=-d/(2*Math.sqrt(Math.max(t,1e-8))),r=0;for(let t of x){let i=1-t.r/y,a=i*i,o=Math.exp(-v*(t.r-e)),s=u*(o*o-2*o),c=2*u*v*(o-o*o)*a-s*(2*i/y),l=Math.exp(-b*(t.r-e))*(-b*a-2*i/y),d=-c-2*n*l;r+=t.count*t.r*d}return r},C=s+.01/v,w=s+1.8/v;for(;S(w)<0&&w<s+4/v;)w+=.6/v;for(let e=0;e<24;e+=1){let e=.5*(C+w);S(e)<0?C=e:w=e}let T=.5*(C+w);return Object.freeze({potentialModel:f.MORSE_EAM,modelName:`morse-finnis-sinclair-eam`,epsilonEv:u,sigmaOrR0A:T,alphaOrLambda:v,rcutA:y,eamAEv:d,eamBeta:b,swGamma:0,rNearestNeighborA:s,fShellSoftness:g})}async function Ee(e,{Z:t,atomicMassU:n=null,bulkResult:a,emResult:o,temperatureK:s=300,runLiveMd:c=!0,mdSteps:u=20,mdCellsPerSide:d=3}={}){let f=Number(n),p=Number.isFinite(f)&&f>0?f:i[t-1]||r(t)/16605390666e-37,m=p*16605390666e-37,h=p*.001,_=J({Z:t,bulkResult:a}),v=Math.max(15,a.debyeTemperatureK),y=a.cohesiveEnergyEv*Ce,b=_.rNearestNeighborA*1e-10,x=m*(K*v/1054571817e-43)**2*(.095*b)**2/(9*K),C=a.crystalStructure===`vdw-fcc`?.68*_.epsilonEv*Ce/K:.029*y/K,w=Math.min(.35*C,.085*v),T=a.crystalStructure===`vdw-fcc`?Math.max(1.5,C-w):Math.max(1.5,.55*C+.45*Math.min(C*1.8,x)-.15*w),E=Math.max(1,Math.min(4200,T)),D=Math.max(1500,y*Se*(a.crystalStructure===`vdw-fcc`?.92:.88)),O=Math.max(E*1.15+2,D/88),k=q*1.15*E/h,A=D/h,j=Te(s,v,m)+(o?.isMetal?Math.PI*Math.PI/3*K*K*((a.dosAtFermiStatesPerEvAtom||.5)/Ce)/m:0)*s,M=a.crystalStructure===`diamond`?.85:1.75,N=M*j*a.densityKgPerM3/Math.max(1e6,a.bulkModulusPa),P=j+s*a.bulkModulusPa*N*N/Math.max(1,a.densityKgPerM3),F=null;if(c&&e&&typeof e.createBuffer==`function`){let t=Math.max(10,Math.min(s,.65*E)),n=l(e,{...g({crystalStructure:a.crystalStructure,cellsPerSide:d,latticeConstantA:Math.max(2.2,a.latticeConstantA),massU:p,temperatureK:t}),potentialModel:_.potentialModel,epsilonEv:_.epsilonEv,sigmaOrR0A:_.sigmaOrR0A,alphaOrLambda:_.alphaOrLambda,rcutA:_.rcutA,eamAEv:_.eamAEv,eamBeta:_.eamBeta,swGamma:_.swGamma,dtFs:Math.min(2,Math.max(.4,.08*Math.sqrt(p))),targetTemperatureK:t,thermostatCouplingFs:40});try{F=await n.stepBatch(u,{readTelemetry:!0,temperatureK:t})}finally{n.destroy()}}let ee=E;if(F&&Number.isFinite(F.temperatureK)&&F.temperatureK>0){let e=Math.max(0,Number(F.msdA2)||0),t=Math.max(1.2,_.rNearestNeighborA),n=Math.sqrt(e)/t;if(n>1e-4&&n<.45){let e=F.temperatureK*(.1/Math.max(.015,n))**2,t=Math.max(.85,Math.min(1.15,e/Math.max(1,E)));ee=Math.max(1,Math.min(4200,E*(.85+.15*t)))}}let te=ee,I=Math.max(te*1.15+2,O),ne=a.densityKgPerM3*(a.crystalStructure===`diamond`?1.05:.92),re=Math.max(s,E*1.05),ie=Math.max(1e-5,18e-8*Math.sqrt(p*E)/(h/Math.max(1,ne)*1e6)**(2/3)*Math.exp(2.6*(E/re-1))),ae=Math.max(18e-11,_.rNearestNeighborA*92e-12),L=5/(16*Math.sqrt(Math.PI))*Math.sqrt(m*K*Math.max(s,O))/(ae*ae),R=(m/Math.max(1,ne))**(2/3),z=Math.max(.001,.16*y/Math.max(1e-21,R)),oe=o?.isMetal?we*(o.electricalConductivitySPerM||0)*s:0,B=Math.max(.02,31e-9*p*Math.cbrt(m/Math.max(1,a.densityKgPerM3))*1e10*v**3/Math.max(1,M*M*s)),se=Math.min(2500,oe+Math.min(400,B)),V=1/ne-1/a.densityKgPerM3,ce=Math.max(-60,Math.min(180,E*V/Math.max(1e3,k)*101325*Math.LN10)),le=Math.max(5,Math.min(900,q*O*O*Math.LN10/Math.max(1e3,D)));return Object.freeze({schema:G,backend:F?`webgpu-md+qha`:`qha-analytical`,Z:t,temperatureK:s,potential:_,heatCapacityCvJPerKgK:j,heatCapacityCpJPerKgK:P,thermalExpansionVolPerK:N,meltingPointK:te,boilingPointK:I,latentHeatFusionJPerKg:k,latentHeatVaporizationJPerKg:A,meltingSlopeKPerLogP:ce,boilingSlopeKPerLogP:le,liquidDensityKgPerM3:ne,dynamicViscosityLiquidPaS:ie,dynamicViscosityGasPaS:L,surfaceTensionNPerM:z,thermalConductivityWPerMK:se,kElectronicWPerMK:oe,kPhononWPerMK:Math.min(400,B),mdTelemetry:F,accuracyTier:t<=100?S.TIER_2_REPRESENTATIVE_EFFECTIVE:S.TIER_3_THEORETICAL_ENVELOPE,provenance:Object.freeze({status:F?`webgpu-derived`:`reduced-estimate`,scientificValidation:!1,model:`dft-fitted-md-qha-wiedemann-franz-andrade`})})}var De=`ulg-periodic-table-engine-webgpu.v1`,Oe=Object.freeze({1:{symbol:`H`,bPerAMeV:0,rhoKgM3:88,meltingK:14.01,boilingK:20.28,mag:`diamagnetic`},2:{symbol:`He`,bPerAMeV:7.074,rhoKgM3:145,meltingK:.95,boilingK:4.22,mag:`diamagnetic`},6:{symbol:`C`,bPerAMeV:7.68,rhoKgM3:3515,meltingK:3823,boilingK:4300,mag:`diamagnetic`},10:{symbol:`Ne`,bPerAMeV:8.032,rhoKgM3:1444,meltingK:24.56,boilingK:27.07,mag:`diamagnetic`},11:{symbol:`Na`,bPerAMeV:8.111,rhoKgM3:968,meltingK:370.9,boilingK:1156,mag:`paramagnetic`},13:{symbol:`Al`,bPerAMeV:8.332,rhoKgM3:2700,meltingK:933.5,boilingK:2792,mag:`paramagnetic`},14:{symbol:`Si`,bPerAMeV:8.448,rhoKgM3:2329,meltingK:1687,boilingK:3538,mag:`diamagnetic`},18:{symbol:`Ar`,bPerAMeV:8.595,rhoKgM3:1623,meltingK:83.8,boilingK:87.3,mag:`diamagnetic`},26:{symbol:`Fe`,bPerAMeV:8.79,rhoKgM3:7874,meltingK:1811,boilingK:3134,mag:`ferromagnetic`},29:{symbol:`Cu`,bPerAMeV:8.752,rhoKgM3:8960,meltingK:1358,boilingK:2835,mag:`diamagnetic`},47:{symbol:`Ag`,bPerAMeV:8.554,rhoKgM3:10490,meltingK:1235,boilingK:2435,mag:`diamagnetic`},79:{symbol:`Au`,bPerAMeV:8,rhoKgM3:19300,meltingK:1337,boilingK:3129,mag:`diamagnetic`},80:{symbol:`Hg`,bPerAMeV:7.921,rhoKgM3:13534,meltingK:234.3,boilingK:629.9,mag:`diamagnetic`},82:{symbol:`Pb`,bPerAMeV:7.867,rhoKgM3:11340,meltingK:600.6,boilingK:2022,mag:`diamagnetic`},92:{symbol:`U`,bPerAMeV:7.57,rhoKgM3:19050,meltingK:1405,boilingK:4404,mag:`paramagnetic`}});function ke(e,t){let n=Oe[e]||null;if(!n)return Object.freeze({g7Advisory:!0,hasReference:!1,note:e>100?`Superheavy element: no experimental bulk properties exist (tier-3 theoretical prediction).`:`No checked-in G7 snapshot benchmark row for this Z.`});let r=(e,t)=>t>0?Math.abs(e-t)/t:Math.abs(e-t);return Object.freeze({g7Advisory:!0,hasReference:!0,bindingPerNucleonRelErr:r(t.nuclear.bindingPerNucleonMeV,n.bPerAMeV),densityRelErr:r(t.mechanical.densityKgPerM3,n.rhoKgM3),meltingRelErr:r(t.thermodynamic.meltingPointK,n.meltingK),boilingRelErr:r(t.thermodynamic.boilingPointK,n.boilingK),magneticPhaseMatch:t.electromagnetic.magneticPhase===n.mag,reference:n})}async function Ae(r,i,{massNumberA:o=null,temperatureK:c=300,runNuclearGpuVolume:l=!0,runLiveMd:u=!0,mdSteps:d=16,mdCellsPerSide:f=3,atomicMaxScf:m=55,atomicGridPointsN:g=256,nuclearVolDim:_=24,blochGridN:v=16,functional:y=`pbe`,scalarRelativistic:b=!0,spinOrbit:C=!0,returnOrbitalWavefunctions:w=!1}={}){let T=Math.trunc(Number(i));if(!(T>=1&&T<=118))throw RangeError(`Element atomicNumberZ out of range 1..118: ${i}`);let E=h(T),D=l?await s(r,T,o,{volDim:_}):p(T,o),O=e(T),k=O.map(e=>({...e})),A=(e,t)=>{let n=Math.max(e,t+1);for(;k.some(e=>e.n===n&&e.l===t);)n+=1;k.push({n,l:t,occupancy:0})};for(let e of O)e.occupancy>0&&e.l>=2&&(e.l-1>=0&&A(e.n+1,e.l-1),e.l+1<=4&&A(e.n+1,e.l+1));k.sort((e,t)=>e.n+e.l-(t.n+t.l)||e.n-t.n||e.l-t.l);let j=await ne(r,T,{functional:y,spinOrbit:C,scalarRelativistic:b,configuration:k,nuclearChargeRadiusBohr:D.chargeRadiusBohr,nuclearMassU:D.atomicMassU,nuclearSpinI:D.spinI,nuclearMagneticMomentMuN:D.magneticMomentMuN,gridPointsN:g,rMinBohr:Math.min(1e-4,Math.max(1e-5,D.chargeRadiusBohr*.5)),maxScf:m,returnRadialDensity:!0,returnOrbitalWavefunctions:w}),M=await pe(r,T,j,{densityGridN:v,atomicMassU:D.atomicMassU}),N=await xe(r,{Z:T,atomResult:j,bulkResult:M,temperatureK:c}),P=await Ee(r,{Z:T,atomicMassU:D.atomicMassU,bulkResult:M,emResult:N,temperatureK:c,runLiveMd:u,mdSteps:d,mdCellsPerSide:f}),F=T>100?S.TIER_3_THEORETICAL_ENVELOPE:M.accuracyTier===S.TIER_1_QUANTITATIVE?S.TIER_1_QUANTITATIVE:S.TIER_2_REPRESENTATIVE_EFFECTIVE,ee=x({materialKey:o==null?E:D.isotope,symbol:E,atomicNumber:T,massNumberA:D.A,isotope:D.isotope,family:`element`,accuracyTier:F,generatorFingerprint:De,nuclear:{isotope:D.isotope,Z:D.Z,N:D.N,A:D.A,bindingEnergyMeV:D.bindingEnergyMeV,bindingPerNucleonMeV:D.bindingPerNucleonMeV,atomicMassU:D.atomicMassU,massExcessMeV:D.massExcessMeV,chargeRadiusFm:D.chargeRadiusFm,chargeRadiusBohr:D.chargeRadiusBohr,spinI:D.spinI,parity:D.parity,shellLabel:D.shellLabel,magneticMomentMuN:D.magneticMomentMuN,fissility:D.fissility,fissionBarrierMeV:D.fissionBarrierMeV,qAlphaMeV:D.qAlphaMeV,qBetaMinusMeV:D.qBetaMinusMeV,qElectronCaptureMeV:D.qElectronCaptureMeV,dominantMode:D.dominantMode,daughterZ:D.daughterZ,daughterA:D.daughterA,log10HalfLifeS:D.log10HalfLifeS},atomic:{configurationString:a(T),configuration:e(T),spinConfiguration:n(T),unpairedElectrons:t(T),totalEnergyHa:j.totalEnergyHa,qedRadiativeShiftHa:j.qedRadiativeShiftHa??0,reducedMassFactor:j.reducedMassFactor??1,isotopeMassShiftHa:j.isotopeMassShiftHa??0,hyperfineSplittingHz:j.hyperfineSplittingHz??0,finiteNucleusUsed:!!j.finiteNucleusUsed,dirac4Component:!!j.dirac4Component,totalSmallComponentNormSq:j.totalSmallComponentNormSq??0,relativisticMethod:j.relativisticMethod,resolverStatus:j.resolverStatus,perScfCpuReadbacks:j.perScfCpuReadbacks,integratedElectrons:j.integratedElectrons,orbitals:j.orbitals},electromagnetic:{isMetal:N.isMetal,bandGapEv:N.bandGapEv,mbjCParameter:M.mbjCParameter??N.mbjCParameter??null,dftUHubbardEv:M.dftUHubbardEv??N.dftUHubbardEv??0,dftUExchangeSplittingEv:M.dftUExchangeSplittingEv??0,fermiEnergyEv:M.fermiEnergyEv,dosAtFermiStatesPerEvAtom:M.dosAtFermiStatesPerEvAtom,plasmaEnergyEv:N.plasmaEnergyEv,drudeDampingEv:N.drudeDampingEv,interbandOscillators:N.interbandOscillators,workFunctionEv:N.workFunctionEv,electricalConductivitySPerM:N.electricalConductivitySPerM,electricalResistivityOhmM:N.electricalResistivityOhmM,staticDielectricConstant:N.staticDielectricConstant,magneticPhase:N.magneticPhase,stonerProduct:N.stonerProduct,magneticMomentMuB:N.magneticMomentMuB,curieOrNeelTempK:N.curieOrNeelTempK,magneticSusceptibilitySi:N.magneticSusceptibilitySi,superconductingTcK:N.superconductingTcK,opticalSrgb:N.opticalSrgb,refractiveIndex550Nm:N.refractiveIndex550Nm,reflectance550Nm:N.reflectance550Nm,spectralWavelengthsNm:N.spectralWavelengthsNm,spectralReflectance:N.spectralReflectance,spectralNRe:N.spectralNRe,oscillatorSource:N.provenance?.oscillatorSource??`none`},mechanical:{crystalStructure:M.crystalStructure,spaceGroup:M.spaceGroup,coordinationNumber:M.coordinationNumber,latticeConstantA:M.latticeConstantA,densityKgPerM3:M.densityKgPerM3,cohesiveEnergyEv:M.cohesiveEnergyEv,bulkModulusPa:M.bulkModulusPa,shearModulusPa:M.shearModulusPa,poissonRatio:M.poissonRatio,elasticConstantsGPa:M.elasticConstantsGPa,soundSpeedLongMPerS:M.soundSpeedLongMPerS,soundSpeedTransMPerS:M.soundSpeedTransMPerS,debyeTemperatureK:M.debyeTemperatureK},thermodynamic:{temperatureK:c,heatCapacityCvJPerKgK:P.heatCapacityCvJPerKgK,heatCapacityCpJPerKgK:P.heatCapacityCpJPerKgK,thermalExpansionVolPerK:P.thermalExpansionVolPerK,meltingPointK:P.meltingPointK,boilingPointK:P.boilingPointK,latentHeatFusionJPerKg:P.latentHeatFusionJPerKg,latentHeatVaporizationJPerKg:P.latentHeatVaporizationJPerKg,meltingSlopeKPerLogP:P.meltingSlopeKPerLogP,boilingSlopeKPerLogP:P.boilingSlopeKPerLogP,liquidDensityKgPerM3:P.liquidDensityKgPerM3,dynamicViscosityLiquidPaS:P.dynamicViscosityLiquidPaS,dynamicViscosityGasPaS:P.dynamicViscosityGasPaS,surfaceTensionNPerM:P.surfaceTensionNPerM,thermalConductivityWPerMK:P.thermalConductivityWPerMK,potentialModel:P.potential.modelName,mdEnergyEv:P.mdTelemetry?.totalEnergyEv??null,mdTempK:P.mdTelemetry?.temperatureK??null,mdPressureGPa:P.mdTelemetry?.pressureGPa??null,mdMsdA2:P.mdTelemetry?.msdA2??null},provenance:{status:N.provenance?.status===`hybrid-webgpu-spectral-cpu-oscillators`?`hybrid-webgpu-spectral-cpu-oscillators`:`webgpu-derived`,scientificValidation:!1,extrapolationPolicy:`fail-closed`}}),te=ke(T,ee);return Object.freeze({bundle:ee,g7Advisory:te,visualData:Object.freeze({nuclear:D,atom:j,bulk:M,em:N,thermo:P})})}var je=`ulg.electronic.orbital-cloud-webgpu.v1`,Me=1/137.035999084,Y=512,X=256,Z=Object.freeze({COPY_SRC:4,COPY_DST:8,VERTEX:32,UNIFORM:64,STORAGE:128});function Ne(e){let t=1;for(let n=2;n<=e;n+=1)t*=n;return t}function Pe(e,t){return t<0||t>e?0:Ne(e)/(Ne(t)*Ne(e-t))}function Fe(e,t,n){let r=0,i=1;for(let a=0;a<=e;a+=1){let o=a&1?-1:1;r+=o*Pe(e+t,e-a)/Ne(a)*i,i*=n}return r}function Ie(e,t,n){let r=Math.max(-1,Math.min(1,n)),i=1;if(t>0){let e=Math.sqrt(Math.max(0,(1-r)*(1+r))),n=1;for(let r=1;r<=t;r+=1)i*=-n*e,n+=2}if(e===t)return i;let a=r*(2*t+1)*i;if(e===t+1)return a;let o=0;for(let n=t+2;n<=e;n+=1)o=((2*n-1)*r*a-(n+t-1)*i)/(n-t),i=a,a=o;return o}function Le(e,t,n,r){if(!r)return e;let i=0;for(let e=1;e<t;e+=1)i+=2*e*e;let a=Math.max(0,Math.min(2*t*t,e-i)),o=t>1?i-2*(t-1)*(t-1):0,s=t>1?Math.max(0,Math.min(2*(t-1)*(t-1),e-o-a)):0,c=Math.max(0,a-1),l=Math.max(0,e-a-s),u=n<=1?.85:1,d=n>0?.02*((2*n+1)/Math.max(1,t)):0;return Math.max(1,Math.min(e,e-(.35*c+u*s+l)+d))}function Re(e,t,n,r){if(!r)return e;let i=(Me*e)**2,a=n<=1?1+i*.36/(Math.max(1,t)*(n+1)):Math.max(.75,1-i*.18/Math.max(1,t));return Math.max(.8,e*a)}function ze({Z:e=26,n:t=3,l:n=2,m:r=0,rGrid:i=null,orbitalU:a=null,screeningExchange:o=!0,relativisticSpinOrbit:s=!0}={}){let c=Math.max(1,Math.min(8,Math.trunc(t))),l=Math.max(0,Math.min(c-1,Math.trunc(n))),u=Math.max(-l,Math.min(l,Math.trunc(r))),d=Math.abs(u),f=new Float32Array(Y),p=new Float32Array(Y),m=new Float32Array(Y),h=new Float32Array(Y),g=Array.isArray(i)&&i.length>=32&&a&&a.length===i.length,_=6,v=`analytic-laguerre-slater`;if(g){v=`webgpu-kohn-sham-eigenstate`;let e=new Float64Array(i.length),t=0;for(let n=0;n<i.length;n+=1){let r=n===0?i[1]-i[0]:n===i.length-1?i[n]-i[n-1]:.5*(i[n+1]-i[n-1]),o=a[n],s=o*o*Math.max(1e-8,r);e[n]=s,t+=s}let n=0;_=Math.max(1.5,i[i.length-1]*.5);for(let r=0;r<i.length;r+=1)if(n+=e[r],n>=t*.994){_=Math.max(.8,Math.min(36,i[r]*1.15));break}let r=0,o=0,s=0,c=0;for(let e=0;e<Y;e+=1){let t=(e+.5)/Y*_;for(f[e]=t;c+1<i.length&&i[c+1]<t;)c+=1;let n=Math.min(i.length-2,c),l=i[n],u=Math.max(l+1e-9,i[n+1]),d=Math.max(0,Math.min(1,(t-l)/(u-l))),g=a[n]*(1-d)+a[n+1]*d,v=g>=0?1:-1;s!==0&&v!==s&&Math.abs(g)>1e-6&&(o+=1),Math.abs(g)>1e-6&&(s=v),r+=g*g,p[e]=r,m[e]=o,h[e]=v}let l=r>0?1/r:1;for(let e=0;e<Y;e+=1)p[e]*=l}else{let t=Re(Le(e,c,l,o),c,l,s),n=(3*c*c-l*(l+1))/(2*Math.max(.5,t));_=Math.max(1.2,Math.min(42,n*2.55+1.4/Math.sqrt(Math.max(1,t))));let r=Math.sqrt((2*t/c)**3*(Ne(c-l-1)/(2*c*Ne(c+l)))),i=0,a=0,u=0;for(let e=0;e<Y;e+=1){let n=(e+.5)/Y*_;f[e]=n;let o=2*t*n/c,s=Fe(c-l-1,2*l+1,o),d=n*(r*Math.exp(-.5*o)*o**+l*s),g=d>=0?1:-1;u!==0&&g!==u&&Math.abs(d)>1e-8&&(a+=1),Math.abs(d)>1e-8&&(u=g),i+=d*d,p[e]=i,m[e]=a,h[e]=g}let d=i>0?1/i:1;for(let e=0;e<Y;e+=1)p[e]*=d}let y=(Me*Le(e,c,l,o))**2,b=s&&l>0&&u!==0?y*.28*l/Math.max(1,c*c):0,x=new Float32Array(X),S=new Float32Array(X),C=0;for(let e=0;e<X;e+=1){let t=-1+(e+.5)/X*2,n=Ie(l,d,t),r=b>0?Math.max(.35,Math.min(1.65,1+b*t*(u/Math.max(1,l)))):1;C+=n*n*r,x[e]=C,S[e]=n>=0?1:-1}let w=C>0?1/C:1;for(let e=0;e<X;e+=1)x[e]*=w;let T=new Float32Array(Y*4);for(let e=0;e<Y;e+=1)T[e*4+0]=f[e]/Math.max(1e-6,_),T[e*4+1]=p[e],T[e*4+2]=m[e],T[e*4+3]=h[e];let E=new Float32Array(X*2);for(let e=0;e<X;e+=1)E[e*2+0]=x[e],E[e*2+1]=S[e];return Object.freeze({radialPacked:T,polarPacked:E,rExtentBohr:_,n:c,l,m:u,radialNodeCount:Math.max(0,Math.round(m[Y-1])),sourceKind:v})}var Be=`
struct OrbitalSampleParams {
  point_count: u32,
  radial_bins: u32,
  polar_bins: u32,
  seed: u32,
  m_signed: i32,
  m_abs: u32,
  color_mode: u32, // 0 = alternating radial shells (MoonLab), 1 = signed wavefunction phase (+psi / -psi)
  pad0: u32,
};

@group(0) @binding(0) var<uniform> p: OrbitalSampleParams;
// radial_table[i] = vec4(r_norm, cdf, shell_idx, radial_sign)
@group(0) @binding(1) var<storage, read> radial_table: array<vec4<f32>>;
// polar_table[i] = vec2(cdf, polar_sign)
@group(0) @binding(2) var<storage, read> polar_table: array<vec2<f32>>;
// Output points: vec4(x_norm, y_norm, z_norm, packed_meta)
//   packed_meta: sign bit encodes shell/phase color parity (+1 = Color A, -1 = Color B),
//                abs(packed_meta) in (0.1..1.0) encodes radial brightness falloff!
@group(0) @binding(3) var<storage, read_write> points_out: array<vec4<f32>>;

const TWO_PI: f32 = 6.283185307179586;

fn pcg_next(state: ptr<function, u32>) -> u32 {
  let old = *state;
  *state = old * 747796405u + 2891336453u;
  let word = ((old >> ((old >> 28u) + 4u)) ^ old) * 277803737u;
  return (word >> 22u) ^ word;
}

fn rand01(state: ptr<function, u32>) -> f32 {
  return f32(pcg_next(state) & 0x00ffffffu) * (1.0 / 16777216.0);
}

@compute @workgroup_size(64)
fn sample_orbital_cloud(@builtin(global_invocation_id) gid: vec3<u32>) {
  let idx = gid.x;
  if (idx >= p.point_count) { return; }

  var rng = ((idx + 1u) * 1664525u) ^ (p.seed * 22695477u + 1013904223u);
  let _w = pcg_next(&rng);

  // 1. Exact continuous radial inverse-CDF sampling (binary search in 512 bins)
  let u_r = rand01(&rng);
  var lo = 0u;
  var hi = p.radial_bins - 1u;
  for (var iter = 0u; iter < 10u; iter = iter + 1u) {
    let mid = (lo + hi) >> 1u;
    if (radial_table[mid].y < u_r) { lo = mid + 1u; } else { hi = mid; }
  }
  let r_idx = min(lo, p.radial_bins - 1u);
  let r_prev = select(0.0, radial_table[r_idx - 1u].x, r_idx > 0u);
  let r_curr = radial_table[r_idx].x;
  let c_prev = select(0.0, radial_table[r_idx - 1u].y, r_idx > 0u);
  let c_curr = radial_table[r_idx].y;
  let frac_r = clamp((u_r - c_prev) / max(1e-7, c_curr - c_prev), 0.0, 1.0);
  let r_norm = mix(r_prev, r_curr, frac_r);
  let shell_idx = u32(max(0.0, floor(radial_table[r_idx].z + 0.5)));
  let rad_sign = radial_table[r_idx].w;

  // 2. Exact continuous polar inverse-CDF sampling (binary search in 256 bins)
  let u_th = rand01(&rng);
  var plo = 0u;
  var phi_hi = p.polar_bins - 1u;
  for (var iter = 0u; iter < 9u; iter = iter + 1u) {
    let mid = (plo + phi_hi) >> 1u;
    if (polar_table[mid].x < u_th) { plo = mid + 1u; } else { phi_hi = mid; }
  }
  let p_idx = min(plo, p.polar_bins - 1u);
  let pc_prev = select(0.0, polar_table[p_idx - 1u].x, p_idx > 0u);
  let pc_curr = polar_table[p_idx].x;
  let frac_p = clamp((u_th - pc_prev) / max(1e-7, pc_curr - pc_prev), 0.0, 1.0);
  let mu_bin = (f32(p_idx) + frac_p) / f32(p.polar_bins);
  let cos_theta = clamp(-1.0 + 2.0 * mu_bin, -1.0, 1.0);
  let sin_theta = sqrt(max(0.0, 1.0 - cos_theta * cos_theta));
  let pol_sign = polar_table[p_idx].y;

  // 3. Exact azimuthal rejection sampling for cos^2(m phi) or sin^2(m phi)
  var phi = rand01(&rng) * TWO_PI;
  var az_sign = 1.0;
  if (p.m_abs > 0u) {
    let mf = f32(p.m_abs);
    for (var attempt = 0u; attempt < 16u; attempt = attempt + 1u) {
      let cand = rand01(&rng) * TWO_PI;
      let trig = select(sin(mf * cand), cos(mf * cand), p.m_signed > 0);
      if (rand01(&rng) <= trig * trig) {
        phi = cand;
        az_sign = select(-1.0, 1.0, trig >= 0.0);
        break;
      }
    }
  }

  // Standard physics spherical -> 3D viewport (Y-up = polar z-axis for crisp vertical d_z2/p_z lobes!)
  let x = r_norm * sin_theta * cos(phi);
  let y = r_norm * cos_theta;
  let z = r_norm * sin_theta * sin(phi);

  let shade = clamp(0.95 - 0.42 * r_norm, 0.25, 1.0);
  var parity = 1.0;
  if (p.color_mode == 0u) {
    parity = select(-1.0, 1.0, (shell_idx & 1u) == 0u);
  } else {
    let psi_sign = rad_sign * pol_sign * az_sign;
    parity = select(-1.0, 1.0, psi_sign >= 0.0);
  }
  points_out[idx] = vec4<f32>(x, y, z, parity * shade);
}
`,Ve=`
struct MolCloudParams {
  point_count: u32,
  atom_count: u32,
  mode: u32, // 0 = Total electron density, 1 = HOMO signed orbital, 2 = LUMO signed orbital
  seed: u32,
  box_half_bohr: f32,
  pad0: f32,
  pad1: f32,
  pad2: f32,
};

@group(0) @binding(0) var<uniform> p: MolCloudParams;
@group(0) @binding(1) var<storage, read> atoms_pos_zeta: array<vec4<f32>>;
@group(0) @binding(2) var<storage, read> atoms_weights: array<vec4<f32>>;
@group(0) @binding(3) var<storage, read_write> points_out: array<vec4<f32>>;

fn pcg_next(state: ptr<function, u32>) -> u32 {
  let old = *state;
  *state = old * 747796405u + 2891336453u;
  let word = ((old >> ((old >> 28u) + 4u)) ^ old) * 277803737u;
  return (word >> 22u) ^ word;
}

fn rand01(state: ptr<function, u32>) -> f32 {
  return f32(pcg_next(state) & 0x00ffffffu) * (1.0 / 16777216.0);
}

fn eval_mol_field(pos: vec3<f32>) -> vec2<f32> {
  var rho_tot = 0.0;
  var psi_orb = 0.0;
  for (var a = 0u; a < p.atom_count; a = a + 1u) {
    let az = atoms_pos_zeta[a];
    let aw = atoms_weights[a];
    let r = length(pos - az.xyz);
    let phi = exp(-az.w * r);
    rho_tot = rho_tot + aw.x * phi * phi;
    let c = select(aw.z, aw.y, p.mode == 1u);
    psi_orb = psi_orb + c * phi;
  }
  if (p.mode == 0u) {
    return vec2<f32>(rho_tot, select(-1.0, 1.0, psi_orb >= 0.0));
  }
  return vec2<f32>(psi_orb * psi_orb, select(-1.0, 1.0, psi_orb >= 0.0));
}

@compute @workgroup_size(64)
fn sample_molecular_cloud(@builtin(global_invocation_id) gid: vec3<u32>) {
  let idx = gid.x;
  if (idx >= p.point_count || p.atom_count == 0u) { return; }

  var rng = ((idx + 1u) * 747796405u) ^ (p.seed * 2891336453u + 1234567u);
  let _w = pcg_next(&rng);

  // Seed around a randomly chosen nucleus with exponential radial draw + Metropolis refinement
  let a0 = pcg_next(&rng) % p.atom_count;
  let az0 = atoms_pos_zeta[a0];
  let inv_z = 1.0 / max(0.55, az0.w);

  // Draw initial point near atom center
  let r_init = -log(max(1e-5, rand01(&rng))) * inv_z * 1.15;
  let cz = -1.0 + 2.0 * rand01(&rng);
  let sz = sqrt(max(0.0, 1.0 - cz * cz));
  let ph = rand01(&rng) * 6.2831853;
  var pos = az0.xyz + vec3<f32>(sz * cos(ph), cz, sz * sin(ph)) * r_init;
  var cur = eval_mol_field(pos);

  let step_s = max(0.35, p.box_half_bohr * 0.24);
  for (var mstep = 0u; mstep < 14u; mstep = mstep + 1u) {
    let cand = pos + vec3<f32>(rand01(&rng) - 0.5, rand01(&rng) - 0.5, rand01(&rng) - 0.5) * (2.0 * step_s);
    let ev = eval_mol_field(cand);
    let ratio = ev.x / max(1e-10, cur.x);
    if (ratio >= 1.0 || rand01(&rng) < ratio) {
      pos = cand;
      cur = ev;
    }
  }

  let p_norm = clamp(pos / max(0.5, p.box_half_bohr), vec3<f32>(-1.0), vec3<f32>(1.0));
  let shade = clamp(0.95 - 0.35 * length(p_norm), 0.32, 1.0);
  points_out[idx] = vec4<f32>(p_norm, cur.y * shade);
}
`,He=new WeakMap;function Ue(e){let t=He.get(e);if(t)return t;let n=e.createShaderModule({label:`ulg-orbital-cloud-sampler`,code:Be}),r=e.createComputePipeline({label:`ulg-orbital-cloud-sampler-pipe`,layout:`auto`,compute:{module:n,entryPoint:`sample_orbital_cloud`}}),i=e.createShaderModule({label:`ulg-mol-cloud-sampler`,code:Ve});return t={atomPipe:r,molPipe:e.createComputePipeline({label:`ulg-mol-cloud-sampler-pipe`,layout:`auto`,compute:{module:i,entryPoint:`sample_molecular_cloud`}}),atomParamsBuf:e.createBuffer({size:32,usage:Z.UNIFORM|Z.COPY_DST}),radialTableBuf:e.createBuffer({size:Y*16,usage:Z.STORAGE|Z.COPY_DST}),polarTableBuf:e.createBuffer({size:X*8,usage:Z.STORAGE|Z.COPY_DST}),molParamsBuf:e.createBuffer({size:32,usage:Z.UNIFORM|Z.COPY_DST}),molAzBuf:null,molAzSize:0,molWBuf:null,molWSize:0},He.set(e,t),t}function We(e,{Z:t=26,n=3,l:r=2,m:i=0,pointCount:a=25e4,rGrid:o=null,orbitalU:s=null,screeningExchange:c=!0,relativisticSpinOrbit:l=!0,colorMode:u=0,seed:d=1,reuseBuffer:f=null}={}){let p=Math.max(4096,Math.min(5e5,Math.trunc(a))),m=ze({Z:t,n,l:r,m:i,rGrid:o,orbitalU:s,screeningExchange:c,relativisticSpinOrbit:l}),{atomPipe:h,atomParamsBuf:g,radialTableBuf:_,polarTableBuf:v}=Ue(e),y=p*16,b=f&&f.size>=y?f:e.createBuffer({label:`ulg-orbital-cloud-pts`,size:y,usage:Z.STORAGE|Z.VERTEX|Z.COPY_SRC}),x=new ArrayBuffer(32),S=new Uint32Array(x),C=new Int32Array(x);S[0]=p>>>0,S[1]=Y>>>0,S[2]=X>>>0,S[3]=d>>>0||1,C[4]=m.m,S[5]=Math.abs(m.m)>>>0,S[6]=u>>>0,S[7]=0,e.queue.writeBuffer(g,0,x),e.queue.writeBuffer(_,0,m.radialPacked),e.queue.writeBuffer(v,0,m.polarPacked);let w=e.createBindGroup({layout:h.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:g}},{binding:1,resource:{buffer:_}},{binding:2,resource:{buffer:v}},{binding:3,resource:{buffer:b}}]}),T=e.createCommandEncoder({label:`ulg-orbital-cloud-sample-enc`}),E=T.beginComputePass();return E.setPipeline(h),E.setBindGroup(0,w),E.dispatchWorkgroups(Math.ceil(p/64)),E.end(),e.queue.submit([T.finish()]),Object.freeze({schema:je,pointsBuffer:b,pointCount:p,rExtentBohr:m.rExtentBohr,n:m.n,l:m.l,m:m.m,radialNodeCount:m.radialNodeCount,sourceKind:m.sourceKind})}function Ge(e,{posZeta:t,weights:n,boxHalfBohr:r=4,mode:i=0,pointCount:a=16e4,seed:o=1,reuseBuffer:s=null}={}){if(!t||!n||t.length<4)return null;let c=Math.floor(t.length/4),l=Math.max(4096,Math.min(35e4,Math.trunc(a))),u=Ue(e),{molPipe:d,molParamsBuf:f}=u,p=l*16,m=s&&s.size>=p?s:e.createBuffer({label:`ulg-mol-cloud-pts`,size:p,usage:Z.STORAGE|Z.VERTEX|Z.COPY_SRC}),h=Math.max(16,t.byteLength),g=Math.max(16,n.byteLength);(!u.molAzBuf||u.molAzSize<h)&&(u.molAzBuf=e.createBuffer({size:Math.max(256,h),usage:Z.STORAGE|Z.COPY_DST}),u.molAzSize=Math.max(256,h)),(!u.molWBuf||u.molWSize<g)&&(u.molWBuf=e.createBuffer({size:Math.max(256,g),usage:Z.STORAGE|Z.COPY_DST}),u.molWSize=Math.max(256,g));let _=new ArrayBuffer(32);new Uint32Array(_,0,4).set([l>>>0,c>>>0,i>>>0,o>>>0||1]),new Float32Array(_,16,4).set([Math.max(1,Number(r)||4),0,0,0]),e.queue.writeBuffer(f,0,_),e.queue.writeBuffer(u.molAzBuf,0,t),e.queue.writeBuffer(u.molWBuf,0,n);let v=e.createBindGroup({layout:d.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:f}},{binding:1,resource:{buffer:u.molAzBuf}},{binding:2,resource:{buffer:u.molWBuf}},{binding:3,resource:{buffer:m}}]}),y=e.createCommandEncoder({label:`ulg-mol-cloud-sample-enc`}),b=y.beginComputePass();return b.setPipeline(d),b.setBindGroup(0,v),b.dispatchWorkgroups(Math.ceil(l/64)),b.end(),e.queue.submit([y.finish()]),Object.freeze({schema:je,pointsBuffer:m,pointCount:l,boxHalfBohr:Math.max(1,Number(r)||4),mode:i,sourceKind:`webgpu-molecular-rhf`})}function Ke(e){return!e||typeof e.registerModule!=`function`?null:{orbitalCloudMod:e.registerModule({method:{model:`quantum-orbital-cloud`,version:`1`},kernel:{sourceModule:`src/runtime/electronicStructure/orbitalPointCloudWebGpu.js`,entryPoint:`sample_orbital_cloud`,workgroupSize:64,wgsl:Be},parameterSchema:{Z:{type:`number`,min:1,max:118,required:!0},n:{type:`number`,min:1,max:8,required:!0},l:{type:`number`,min:0,max:7,required:!0},m:{type:`number`,min:-7,max:7},pointCount:{type:`number`,min:4096,max:5e5}},stateLayout:{tensorId:`orbital_points_vec4`,dtype:`f32`,components:4},stepCapsule:async(e,t)=>{let n=t?.device;if(!n)throw Error(`quantum-orbital-cloud@1 requires a WebGPU device`);let r=We(n,e?.parameters||{});return{status:`ok`,pointCount:r.pointCount,rExtentBohr:r.rExtentBohr,radialNodeCount:r.radialNodeCount,sourceKind:r.sourceKind,pointsBuffer:r.pointsBuffer}}}),tdksPhotonMod:e.registerModule({method:{model:`quantum-tdks-photon`,version:`1`},kernel:{sourceModule:`src/runtime/electronicStructure/orbitalPointCloudWebGpu.js`,entryPoint:`sample_dipole_coupled_pair`,workgroupSize:64,wgsl:qe},parameterSchema:{Z:{type:`number`,min:1,max:118,required:!0},pointCount:{type:`number`,min:4096,max:3e5}},stateLayout:{tensorId:`tdks_dipole_pair_cloud`,dtype:`f32`,components:8},stepCapsule:async(e,t)=>{let n=t?.device;if(!n)throw Error(`quantum-tdks-photon@1 requires a WebGPU device`);let r=Ze(n,e?.parameters||{});return{status:`ok`,pointCount:r.pointCount,rExtentBohr:r.rExtentBohr}}})}}var qe=`
struct DipolePairParams {
  point_count: u32,
  radial_bins: u32,
  polar_bins: u32,
  seed: u32,
  m_abs: u32,
  m_signed: i32,
  pad0: u32,
  pad1: u32,
};

@group(0) @binding(0) var<uniform> p: DipolePairParams;
// joint_radial[i] = vec4(r_norm, joint_cdf, R0_norm, R1_norm)
@group(0) @binding(1) var<storage, read> joint_radial: array<vec4<f32>>;
// joint_polar[i]  = vec4(joint_cdf, Y0_norm, Y1_norm, cos_theta)
@group(0) @binding(2) var<storage, read> joint_polar: array<vec4<f32>>;
// Output pos_out[i] = vec4(x_norm, y_norm, z_norm, r_norm)
@group(0) @binding(3) var<storage, read_write> pos_out: array<vec4<f32>>;
// Output amp_out[i] = vec4(phi0_tilde, phi1_tilde, y_dipole, shell_parity)
@group(0) @binding(4) var<storage, read_write> amp_out: array<vec4<f32>>;

const TWO_PI: f32 = 6.283185307179586;

fn pcg_next(state: ptr<function, u32>) -> u32 {
  let old = *state;
  *state = old * 747796405u + 2891336453u;
  let word = ((old >> ((old >> 28u) + 4u)) ^ old) * 277803737u;
  return (word >> 22u) ^ word;
}

fn rand01(state: ptr<function, u32>) -> f32 {
  return f32(pcg_next(state) & 0x00ffffffu) * (1.0 / 16777216.0);
}

@compute @workgroup_size(64)
fn sample_dipole_coupled_pair(@builtin(global_invocation_id) gid: vec3<u32>) {
  let idx = gid.x;
  if (idx >= p.point_count) { return; }

  var rng = ((idx + 1u) * 2654435761u) ^ (p.seed * 2246822519u + 3266489917u);
  let _w = pcg_next(&rng);

  // 1. Sample radius r continuously from joint radial envelope 0.5*(|u0|^2 + |u1|^2)
  let u_r = rand01(&rng);
  var rlo = 0u;
  var rhi = p.radial_bins - 1u;
  for (var it = 0u; it < 10u; it = it + 1u) {
    let mid = (rlo + rhi) >> 1u;
    if (joint_radial[mid].y < u_r) { rlo = mid + 1u; } else { rhi = mid; }
  }
  let ri = min(rlo, p.radial_bins - 1u);
  let rp = select(vec4<f32>(0.0, 0.0, 0.0, 0.0), joint_radial[ri - 1u], ri > 0u);
  let rc = joint_radial[ri];
  let fr = clamp((u_r - rp.y) / max(1e-7, rc.y - rp.y), 0.0, 1.0);
  let r_norm = mix(rp.x, rc.x, fr);
  let r0_amp = mix(rp.z, rc.z, fr);
  let r1_amp = mix(rp.w, rc.w, fr);

  // 2. Sample polar angle cos(theta) continuously from joint polar envelope 0.5*(|Y0|^2 + |Y1|^2)
  let u_p = rand01(&rng);
  var plo = 0u;
  var phi_hi = p.polar_bins - 1u;
  for (var it = 0u; it < 9u; it = it + 1u) {
    let mid = (plo + phi_hi) >> 1u;
    if (joint_polar[mid].x < u_p) { plo = mid + 1u; } else { phi_hi = mid; }
  }
  let pi_idx = min(plo, p.polar_bins - 1u);
  let pp = select(vec4<f32>(0.0, joint_polar[0].y, joint_polar[0].z, -1.0), joint_polar[pi_idx - 1u], pi_idx > 0u);
  let pc = joint_polar[pi_idx];
  let fp = clamp((u_p - pp.x) / max(1e-7, pc.x - pp.x), 0.0, 1.0);
  let cos_th = clamp(mix(pp.w, pc.w, fp), -1.0, 1.0);
  let sin_th = sqrt(max(0.0, 1.0 - cos_th * cos_th));
  let y0_amp = mix(pp.y, pc.y, fp);
  let y1_amp = mix(pp.z, pc.z, fp);

  // 3. Azimuthal angle phi (same m for Delta m = 0 linear E_y dipole transition!)
  var phi = rand01(&rng) * TWO_PI;
  var az = 1.0;
  if (p.m_abs > 0u) {
    let mf = f32(p.m_abs);
    for (var attempt = 0u; attempt < 16u; attempt = attempt + 1u) {
      let cand = rand01(&rng) * TWO_PI;
      let trig = select(sin(mf * cand), cos(mf * cand), p.m_signed > 0);
      if (rand01(&rng) <= trig * trig) {
        phi = cand;
        az = trig;
        break;
      }
    }
  }

  // Exact importance-normalized amplitudes phi0_tilde, phi1_tilde with |phi0|^2 + |phi1|^2 = 2
  let raw0 = r0_amp * y0_amp * az;
  let raw1 = r1_amp * y1_amp * az;
  let inv_env = 1.0 / sqrt(max(1e-8, 0.5 * (raw0 * raw0 + raw1 * raw1)));
  let phi0_t = clamp(raw0 * inv_env, -1.4142, 1.4142);
  let phi1_t = clamp(raw1 * inv_env, -1.4142, 1.4142);

  // Y-axis = electric field polarization axis E_y (so dipole interference sloshes vertically!)
  let x = r_norm * sin_th * cos(phi);
  let y = r_norm * cos_th;
  let z = r_norm * sin_th * sin(phi);
  let parity = select(-1.0, 1.0, r0_amp >= 0.0);

  pos_out[idx] = vec4<f32>(x, y, z, r_norm);
  amp_out[idx] = vec4<f32>(phi0_t, phi1_t, y, parity);
}
`,Je=new WeakMap;function Ye(e){let t=Je.get(e);if(t)return t;let n=e.createShaderModule({label:`ulg-dipole-pair-sampler`,code:qe});return t={pipe:e.createComputePipeline({label:`ulg-dipole-pair-sampler-pipe`,layout:`auto`,compute:{module:n,entryPoint:`sample_dipole_coupled_pair`}}),paramsBuf:e.createBuffer({size:32,usage:Z.UNIFORM|Z.COPY_DST}),radBuf:e.createBuffer({size:Y*16,usage:Z.STORAGE|Z.COPY_DST}),polBuf:e.createBuffer({size:X*16,usage:Z.STORAGE|Z.COPY_DST})},Je.set(e,t),t}function Xe(e,t,n,r,i,a,o,s){let c=new Float32Array(a.length);if(Array.isArray(r)&&r.length>=32&&i&&i.length===r.length){let e=0;for(let t=0;t<a.length;t+=1){let n=a[t];for(;e+1<r.length&&r[e+1]<n;)e+=1;let o=Math.min(r.length-2,e),s=r[o],l=Math.max(s+1e-9,r[o+1]),u=Math.max(0,Math.min(1,(n-s)/(l-s)));c[t]=i[o]*(1-u)+i[o+1]*u}}else{let r=Re(Le(e,t,n,o),t,n,s),i=Math.sqrt((2*r/t)**3*(Ne(t-n-1)/(2*t*Ne(t+n))));for(let e=0;e<a.length;e+=1){let o=a[e],s=2*r*o/t,l=Fe(t-n-1,2*n+1,s);c[e]=o*i*Math.exp(-.5*s)*s**+n*l}}let l=0;for(let e=0;e<c.length;e+=1)l+=c[e]*c[e];let u=1/Math.sqrt(Math.max(1e-12,l));for(let e=0;e<c.length;e+=1)c[e]*=u;return c}function Ze(e,{Z:t=79,n0:n=5,l0:r=2,n1:i=6,l1:a=1,m:o=0,rGrid:s=null,u0:c=null,u1:l=null,pointCount:u=18e4,screeningExchange:d=!0,relativisticSpinOrbit:f=!0,seed:p=1,reusePosBuffer:m=null,reuseAmpBuffer:h=null}={}){let g=Math.max(8192,Math.min(3e5,Math.trunc(u))),_=Math.max(1,Math.min(8,Math.trunc(n))),v=Math.max(0,Math.min(_-1,Math.trunc(r))),y=Math.max(1,Math.min(8,Math.trunc(i))),b=Math.max(0,Math.min(y-1,Math.trunc(a))),x=Math.max(-Math.min(v,b),Math.min(Math.min(v,b),Math.trunc(o))),S=Math.abs(x),C=ze({Z:t,n:_,l:v,m:x,rGrid:s,orbitalU:c,screeningExchange:d,relativisticSpinOrbit:f}),w=ze({Z:t,n:y,l:b,m:x,rGrid:s,orbitalU:l,screeningExchange:d,relativisticSpinOrbit:f}),T=Math.max(C.rExtentBohr,Math.min(C.rExtentBohr*1.45,w.rExtentBohr)),E=new Float32Array(Y);for(let e=0;e<Y;e+=1)E[e]=(e+.5)/Y*T;let D=Xe(t,_,v,s,c,E,d,f),O=Xe(t,y,b,s,l,E,d,f),k=new Float32Array(Y*4),A=0;for(let e=0;e<Y;e+=1)A+=.5*(D[e]*D[e]+O[e]*O[e]),k[e*4+0]=E[e]/T,k[e*4+1]=A,k[e*4+2]=D[e],k[e*4+3]=O[e];let j=A>0?1/A:1;for(let e=0;e<Y;e+=1)k[e*4+1]*=j;let M=new Float32Array(X),N=new Float32Array(X),P=0,F=0;for(let e=0;e<X;e+=1){let t=-1+(e+.5)/X*2;M[e]=Ie(v,S,t),N[e]=Ie(b,S,t),P+=M[e]*M[e],F+=N[e]*N[e]}let ee=1/Math.sqrt(Math.max(1e-12,P/X)),te=1/Math.sqrt(Math.max(1e-12,F/X)),I=new Float32Array(X*4),ne=0;for(let e=0;e<X;e+=1){let t=-1+(e+.5)/X*2,n=M[e]*ee,r=N[e]*te;ne+=.5*(n*n+r*r),I[e*4+0]=ne,I[e*4+1]=n,I[e*4+2]=r,I[e*4+3]=t}let re=ne>0?1/ne:1;for(let e=0;e<X;e+=1)I[e*4+0]*=re;let{pipe:ie,paramsBuf:ae,radBuf:L,polBuf:R}=Ye(e),z=g*16,oe=m&&m.size>=z?m:e.createBuffer({label:`ulg-tdks-pair-pos`,size:z,usage:Z.STORAGE|Z.VERTEX}),B=h&&h.size>=z?h:e.createBuffer({label:`ulg-tdks-pair-amp`,size:z,usage:Z.STORAGE}),se=new ArrayBuffer(32),V=new Uint32Array(se),ce=new Int32Array(se);V[0]=g>>>0,V[1]=Y>>>0,V[2]=X>>>0,V[3]=p>>>0||1,V[4]=S>>>0,ce[5]=x,V[6]=0,V[7]=0,e.queue.writeBuffer(ae,0,se),e.queue.writeBuffer(L,0,k),e.queue.writeBuffer(R,0,I);let le=e.createBindGroup({layout:ie.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:ae}},{binding:1,resource:{buffer:L}},{binding:2,resource:{buffer:R}},{binding:3,resource:{buffer:oe}},{binding:4,resource:{buffer:B}}]}),ue=e.createCommandEncoder({label:`ulg-tdks-pair-sample`}),de=ue.beginComputePass();return de.setPipeline(ie),de.setBindGroup(0,le),de.dispatchWorkgroups(Math.ceil(g/64)),de.end(),e.queue.submit([ue.finish()]),Object.freeze({posBuffer:oe,ampBuffer:B,pointCount:g,rExtentBohr:T,n0:_,l0:v,n1:y,l1:b,m:x,groundSource:C.sourceKind,excitedSource:w.sourceKind})}function Qe(e={},{probeWavelengthNm:t=440}={}){let n=1239.841984,r=.6582119569,i=!!e?.isMetal,a=Array.isArray(e?.interbandOscillators)?e.interbandOscillators:[],o=5,s=.45,c=`Valence→Cond`;if(i&&a.length>0){let e=a.find(e=>e.energyEv>=2.2&&e.energyEv<=4.2)||a[0];o=Math.max(.6,Number(e.energyEv)||3),s=Math.max(.22,Number(e.dampingEv)||.55),c=e.transitionLabel||`d→p`}else if(i){let t=Math.max(1.2,Math.min(8.5,Number(e?.plasmaEnergyEv)||4.5));o=t,s=Math.max(.22,Math.min(1.1,(Number(e?.drudeDampingEv)||.25)*1.4)),c=`Plasma/Valence (${t.toFixed(2)} eV)`}else{let t=Math.max(.5,Number(e?.bandGapEv)||5.5);o=Math.max(2.6,t+1.4),s=t<3.4?.4:.14,c=`Valence→Cond (${o.toFixed(1)} eV)`}let l=o/r,u=s/r,d=u*.42,f=1.65,p=[610,535,440,Math.max(380,Math.min(780,Number(t)||440))].map(e=>({wavelengthNm:e,photonEv:n/e,omega:n/e/r,rho01Re:0,rho01Im:0,rho11:0,dipole:0,dipolePrev:0,dipoleAccel:0,absorbedEnergy:0,incidentEnergy:0,eNow:0,radHistory:new Float32Array(128)})),m=0,h=0,g=4.2,_=2.4;function v(e,t){let n=t-g;return Math.exp(n/_*-.5*(n/_))*Math.cos(e.omega*n)}function y(e=null){if(m=0,h=0,e!=null){let t=Math.max(380,Math.min(780,Number(e)||440));p[3].wavelengthNm=t,p[3].photonEv=n/t,p[3].omega=p[3].photonEv/r}for(let e of p)e.rho01Re=0,e.rho01Im=0,e.rho11=0,e.dipole=0,e.dipolePrev=0,e.dipoleAccel=0,e.absorbedEnergy=0,e.incidentEnergy=0,e.eNow=0,e.radHistory.fill(0)}function b(e=.08){let t=e/12;for(let e=0;e<12;e+=1){let n=m+e*t;for(let e of p){let r=f*v(e,n),i=(e,t,n,r)=>{let i=2*n-1;return[-l*t-.5*u*e,l*e-.5*u*t+r*i,-d*n-2*r*t]},[a,o,s]=i(e.rho01Re,e.rho01Im,e.rho11,r),c=f*v(e,n+.5*t),[p,m,h]=i(e.rho01Re+.5*t*a,e.rho01Im+.5*t*o,e.rho11+.5*t*s,c),[g,_,y]=i(e.rho01Re+.5*t*p,e.rho01Im+.5*t*m,e.rho11+.5*t*h,c),b=v(e,n+t),x=f*b,[S,C,w]=i(e.rho01Re+t*g,e.rho01Im+t*_,e.rho11+t*y,x),T=2*e.rho01Re;e.rho01Re+=t/6*(a+2*p+2*g+S),e.rho01Im+=t/6*(o+2*m+2*_+C),e.rho11=Math.max(0,Math.min(.98,e.rho11+t/6*(s+2*h+2*y+w)));let E=2*e.rho01Re,D=(E-T)/t;e.dipoleAccel=(E-2*e.dipole+e.dipolePrev)/Math.max(1e-6,t*t),e.dipolePrev=e.dipole,e.dipole=E,e.eNow=b,e.absorbedEnergy+=Math.max(0,b*D*t),e.incidentEnergy+=b*b*t}}m+=e,h=(h+1)%128;for(let e of p)e.radHistory[h]=Math.max(-2.5,Math.min(2.5,-e.dipoleAccel*.045));m>13.5&&y()}return Object.freeze({transEv:o,gammaEv:s,transLabel:c,historyLen:128,channels:p,getTimeFs:()=>m,getHistCursor:()=>h,pulseT0Fs:g,pulseWidthFs:_,reset:y,stepFs:b})}var $e=27.211386245988,et=.529177210903,tt=51.4220674763;function nt({atomResult:e=null,eFieldVPerA:t=0}={}){let n=Number(t)||0,r=n/tt,i=4,a=24,o=Math.max(1,Number(e?.electronCount)||1);if(e?.radialGrid?.r&&e?.radialGrid?.rho){let{r:t,rho:n,dx:r}=e.radialGrid,s=0,c=0,l=0;for(let e=0;e<t.length;e+=1){let i=4*Math.PI*t[e]**3*n[e]*r;s+=i,c+=i*t[e]**2,l+=i*t[e]**4}s>.1&&(o=s,i=c/s,a=l/s)}let s=Array.isArray(e?.orbitals)?e.orbitals.filter(e=>Number(e.occupancy??1)>0):[],c=s.length?Math.max(...s.map(e=>Number(e.energyHa??e.energy??-.35))):-.35,l=Math.max(.12,-c),u=Math.max(1,Math.sqrt(Math.max(1,a))*.85),d=Math.max(.8,Math.min(450,.55*(4/9*o*i*i)+.45*(2*u/(3*l)))),f=d*et**3,p=d*r,m=p*2.541746473,h=-.5*d*r*r*$e,g=Math.max(-.65,Math.min(.65,p/Math.max(1.2,Math.sqrt(u)*3)));return Object.freeze({eFieldVPerA:n,eFieldAu:r,alpha0Bohr3:d,alpha0Angstrom3:f,inducedDipoleAu:p,inducedDipoleDebye:m,starkShiftEv:h,starkMixLambda:g,homoBindingEv:l*$e})}async function rt(e,{Z:t,solveAtomFullWebGpu:n,baseConfiguration:r,baseAtomResult:i,functional:a=`pbe`,scalarRelativistic:o=!0,spinOrbit:s=!0,nuclearChargeRadiusBohr:c=null,nuclearMassU:l=null}={}){if(!e||typeof n!=`function`)throw TypeError(`solveDeltaScfIonizationWebGpu requires GPUDevice and solveAtomFullWebGpu.`);let u=(r||[]).map(e=>({...e})),d=-1,f=-1;for(let e=0;e<u.length;e+=1)if((u[e].occupancy||0)>0){let t=u[e].n*10+u[e].l;t>=f&&(f=t,d=e)}if(d<0)return null;let p=u[d],m=`${p.n}${[`s`,`p`,`d`,`f`,`g`][p.l]||p.l}`;u[d].occupancy=Math.max(0,u[d].occupancy-1);let h=await n(e,t,{functional:a,scalarRelativistic:o,spinOrbit:s,configuration:u,nuclearChargeRadiusBohr:c,nuclearMassU:l,maxScf:50,gridPointsN:Math.max(64,Math.min(512,Number(i?.radialGrid?.r?.length)||512)),returnRadialDensity:!0,returnOrbitalWavefunctions:!0}),g=Number(h.totalEnergyHa)-Number(i?.totalEnergyHa??0),_=(i?.orbitals||[]).find(e=>e.n===p.n&&e.l===p.l),v=(h?.orbitals||[]).find(e=>e.n===p.n&&e.l===p.l),y=Number(_?.energyHa??_?.energy),b=Number(v?.energyHa??v?.energy),x=Number.isFinite(y)&&Number.isFinite(b)?-.5*(y+b)*$e:g*$e,S=Math.max(1.5,x);return Object.freeze({Z:t,chargeState:1,removedShell:m,neutralEnergyHa:Number(i?.totalEnergyHa??0),cationEnergyHa:Number(h.totalEnergyHa),rawDeltaScfEv:g*$e,neutralOrbitalEv:Number.isFinite(y)?y*$e:null,cationOrbitalEv:Number.isFinite(b)?b*$e:null,ionizationEnergyEv:S,cationAtom:h})}var it=`ulg.optics.photon-shell-fdtd-2d-webgpu.v1`,at=`ulg.nuclear.tunneling-tdse-webgpu.v1`,ot=16384,st=2e-8,ct=.5,lt=ct*st/299792458,ut=6582119569e-25,dt=1239.841984,ft=.36,Q=Object.freeze({MAP_READ:1,COPY_SRC:4,COPY_DST:8,UNIFORM:64,STORAGE:128});function pt(e={},{probeWavelengthNm:t=535}={}){let n=!!e?.isMetal,r=n?Math.max(.5,Math.min(24,Number(e?.plasmaEnergyEv)||8)):0,i=n?Math.max(.05,Math.min(4,Number(e?.drudeDampingEv)||Math.max(.15,r/25))):0,a=[];if(n){let t=Array.isArray(e?.interbandOscillators)?e.interbandOscillators:[],n=r*r;for(let e=0;e<Math.min(4,t.length);e+=1){let r=t[e],i=Math.max(.25,Math.min(18,Number(r.energyEv)||3)),o=Math.max(.12,Math.min(6,Number(r.dampingEv)||.45)),s=Math.max(0,Math.min(8,Number(r.strengthWeight)||0)),c=ft*n*s/(i*i);a.push({energyEv:i,dampingEv:o,deltaEps:Math.min(25,c),label:r.transitionLabel||`Interband #${e+1}`})}}else{let t=Math.max(.25,Math.min(18,Number(e?.bandGapEv)||5)),n=Number(e?.refractiveIndex550Nm),r=Number.isFinite(n)&&n>=1.005?Math.min(3.8,n):Math.min(3.8,Math.sqrt(1+(13.6/(t+3.47))**2)),i=dt/550,o=Math.max(i*1.48,t+1.65),s=Math.max(.02,r*r-1)*(1-i*i/(o*o));if(a.push({energyEv:o,dampingEv:t<3.4?.42:.06,deltaEps:Math.min(16,Math.max(.02,s)),label:`Valence→Cond UV (${o.toFixed(1)} eV)`}),t<3.35){let e=Math.max(.6,t+.35);a.push({energyEv:e,dampingEv:Math.max(.25,.22*t),deltaEps:Math.min(4,Math.max(.15,(3.4-t)*.6)),label:`Band-Edge (${e.toFixed(2)} eV)`})}}for(;a.length<4;)a.push({energyEv:10,dampingEv:1,deltaEps:0,label:`inactive`});let o=lt/ut,s=r*o,c=i*o,l=n?(1-.5*c)/(1+.5*c):0,u=n?s*s/(1+.5*c):0,d=a.map(e=>{let t=e.energyEv*o,n=1.35/Math.sqrt(1+Math.max(0,e.deltaEps)),r=Math.min(t,n),i=e.dampingEv*o,a=1+.5*i;return{a:(1-.5*i)/a,b:r*r/a,c:e.deltaEps,active:+(e.deltaEps>1e-6),...e}}),f=[610,535,440,Math.max(380,Math.min(780,Number(t)||535))],p=f.map(e=>dt/e*o);return Object.freeze({isMetal:n,plasmaEv:r,drudeGammaEv:i,kDrude:l,betaDrude:u,oscillators:Object.freeze(d),wavelengthsNm:Object.freeze(f),omegaDtChannels:Object.freeze(p),expectedIor550:Number(e?.refractiveIndex550Nm)||1,slabX0:64,slabX1:104,incidenceDeg:24})}function mt(e){let t=Math.max(0,Math.min(1,Number(e)||0));return t<=.0031308?12.92*t:1.055*t**(1/2.4)-.055}function ht(e,t){let n=dt/Math.max(200,t),r=1,i=0;if(e.isMetal&&e.plasmaEv>0){let t=e.plasmaEv*e.plasmaEv,a=n*n,o=n*e.drudeGammaEv,s=Math.max(1e-30,a*a+o*o);r-=t*a/s,i+=t*o/s}for(let t of e.oscillators){if(!(t.deltaEps>1e-6))continue;let e=t.deltaEps*t.energyEv*t.energyEv,a=t.energyEv*t.energyEv-n*n,o=-t.dampingEv*n,s=Math.max(1e-30,a*a+o*o);r+=e*a/s,i-=e*o/s}let a=Math.hypot(r,i),o=Math.sqrt(Math.max(0,.5*(a+r))),s=Math.sqrt(Math.max(0,.5*(a-r))),c=(o-1)*(o-1)+s*s,l=Math.max(1e-30,(o+1)*(o+1)+s*s);return{nRe:o,kIm:s,reflectance:Math.max(0,Math.min(1,c/l))}}var gt=`
struct Fdtd2dParams {
  nx: u32,
  ny: u32,
  n_channels: u32,
  step_index: u32,

  slab_x0: u32,
  slab_x1: u32,
  src_x: u32,
  sensor_x: u32,

  tr_sensor_x: u32,
  src_y_center: u32,
  pml_width: u32,
  pad0: u32,

  courant: f32,
  k_drude: f32,
  beta_drude: f32,
  pulse_t0: f32,

  pulse_width: f32,
  sin_theta: f32,
  cos_theta: f32,
  beam_waist: f32,

  omega_dt: vec4<f32>,
  osc_a: vec4<f32>,
  osc_b: vec4<f32>,
  osc_c: vec4<f32>,
};

@group(0) @binding(0) var<uniform> p: Fdtd2dParams;
@group(0) @binding(1) var<storage, read_write> ez_field: array<f32>;
@group(0) @binding(2) var<storage, read_write> hx_field: array<f32>;
@group(0) @binding(3) var<storage, read_write> hy_field: array<f32>;
@group(0) @binding(4) var<storage, read_write> j_drude: array<f32>;
@group(0) @binding(5) var<storage, read_write> p_curr: array<vec4<f32>>;
@group(0) @binding(6) var<storage, read_write> p_prev: array<vec4<f32>>;
@group(0) @binding(7) var<storage, read_write> shell_state: array<vec4<f32>>; // (P_tot, J_D, abs_inst, Ez)
@group(0) @binding(8) var<storage, read_write> obs_accum: array<vec4<f32>>;

fn boundary_damp(x: u32, y: u32) -> f32 {
  let w = f32(p.pml_width);
  let dx_l = max(0.0, w - f32(x)) / w;
  let dx_r = max(0.0, f32(x) - (f32(p.nx - 1u) - w)) / w;
  let dy_b = max(0.0, w - f32(y)) / w;
  let dy_t = max(0.0, f32(y) - (f32(p.ny - 1u) - w)) / w;
  let d = max(max(dx_l, dx_r), max(dy_b, dy_t));
  if (d <= 0.0) { return 1.0; }
  return exp(-0.24 * d * d * d);
}

fn slab_mask(x: u32, y: u32) -> f32 {
  if (x < p.slab_x0 || x > p.slab_x1 || y < p.pml_width || y > p.ny - 1u - p.pml_width) {
    return 0.0;
  }
  if (x == p.slab_x0 || x == p.slab_x1) { return 0.5; }
  return 1.0;
}

fn oblique_packet_source(ch: u32, y: u32, t_step: f32) -> f32 {
  let dy = f32(y) - f32(p.src_y_center);
  let waist = max(4.0, p.beam_waist);
  let spat = exp(-0.5 * (dy / waist) * (dy / waist));
  if (spat < 1e-4) { return 0.0; }
  // Phase lag along Y launches a crisp collimated photon wavepacket at oblique angle theta_inc!
  let k_vac = p.omega_dt[ch] / max(0.05, p.courant);
  let t_delay = (dy * p.sin_theta) / max(0.05, p.courant);
  let dt_rel = (t_step - t_delay) - p.pulse_t0;
  let env = exp(-0.5 * (dt_rel / max(4.0, p.pulse_width)) * (dt_rel / max(4.0, p.pulse_width)));
  if (env < 1e-5) { return 0.0; }
  return spat * env * sin(p.omega_dt[ch] * (t_step - p.pulse_t0) - k_vac * dy * p.sin_theta);
}

@compute @workgroup_size(64)
fn fdtd2d_step_h(@builtin(global_invocation_id) gid: vec3<u32>) {
  let cells_per_ch = p.nx * p.ny;
  let total = cells_per_ch * p.n_channels;
  let idx = gid.x;
  if (idx >= total) { return; }

  let ch = idx / cells_per_ch;
  let rem = idx % cells_per_ch;
  let x = rem % p.nx;
  let y = rem / p.nx;
  let base = ch * cells_per_ch;
  let damp = boundary_damp(x, y);

  if (y + 1u < p.ny) {
    let dez_dy = ez_field[base + (y + 1u) * p.nx + x] - ez_field[idx];
    hx_field[idx] = damp * (hx_field[idx] - p.courant * dez_dy);
  }
  if (x + 1u < p.nx) {
    let dez_dx = ez_field[base + y * p.nx + (x + 1u)] - ez_field[idx];
    var hy_new = damp * (hy_field[idx] + p.courant * dez_dx);
    // Unidirectional rightward TF/SF magnetic injection along x = src_x - 1
    if (x + 1u == p.src_x && y >= p.pml_width && y < p.ny - p.pml_width) {
      let e_inc = oblique_packet_source(ch, y, f32(p.step_index));
      hy_new = hy_new - p.courant * e_inc;
    }
    hy_field[idx] = hy_new;
  }

  // Exact time-symmetric half-step polarization current updates (n-1/2 -> n+1/2)
  // using integer-step E^n and P^n (zero spurious phase lead; 100% passive for any gamma >= 0!):
  //   p_prev stores J_k^{n+1/2} = dP_k/dt * dt; p_curr stores P_k^n!
  let mask = slab_mask(x, y);
  if (mask > 0.0) {
    let e_n = ez_field[idx];
    let p_n = p_curr[idx];
    let j_k_old = p_prev[idx];
    let j_d_new = damp * (p.k_drude * j_drude[idx] + (p.beta_drude * mask) * e_n);
    let j_k_new = damp * (p.osc_a * j_k_old + p.osc_b * ((p.osc_c * mask) * e_n - p_n));
    j_drude[idx] = j_d_new;
    p_prev[idx] = j_k_new;
  }
}

@compute @workgroup_size(64)
fn fdtd2d_step_e_and_shells(@builtin(global_invocation_id) gid: vec3<u32>) {
  let cells_per_ch = p.nx * p.ny;
  let total = cells_per_ch * p.n_channels;
  let idx = gid.x;
  if (idx >= total) { return; }

  let ch = idx / cells_per_ch;
  let rem = idx % cells_per_ch;
  let x = rem % p.nx;
  let y = rem / p.nx;
  if (x == 0u || y == 0u || x + 1u >= p.nx || y + 1u >= p.ny) {
    ez_field[idx] = 0.0;
    shell_state[idx] = vec4<f32>(0.0);
    return;
  }

  let base = ch * cells_per_ch;
  let damp = boundary_damp(x, y);
  let e_old = ez_field[idx];
  let dhy_dx = hy_field[idx] - hy_field[base + y * p.nx + (x - 1u)];
  let dhx_dy = hx_field[idx] - hx_field[base + (y - 1u) * p.nx + x];
  let curl_h = dhy_dx - dhx_dy;

  var src_corr = 0.0;
  if (x == p.src_x && y >= p.pml_width && y < p.ny - p.pml_width) {
    let t_h = f32(p.step_index) + 0.5 + (0.5 * p.cos_theta) / max(0.05, p.courant);
    let e_inc_h = oblique_packet_source(ch, y, t_h);
    src_corr = p.courant * p.cos_theta * e_inc_h;
  }

  let mask = slab_mask(x, y);
  if (mask <= 0.0) {
    let e_new = damp * (e_old + p.courant * curl_h + src_corr);
    ez_field[idx] = e_new;
    shell_state[idx] = vec4<f32>(0.0, 0.0, 0.0, e_new);
    return;
  }

  // Exact integer-step update E^{n+1} & P_k^{n+1} from half-step H^{n+1/2}, J_D^{n+1/2}, J_k^{n+1/2}!
  let j_d = j_drude[idx];
  let j_k = p_prev[idx];
  let j_k_sum = j_k.x + j_k.y + j_k.z + j_k.w;
  let p_new = damp * (p_curr[idx] + j_k);
  let e_new = damp * (e_old + p.courant * curl_h + src_corr - j_d - j_k_sum);

  ez_field[idx] = e_new;
  p_curr[idx] = p_new;

  let e_mid = 0.5 * (e_new + e_old);
  let p_tot = p_new.x + p_new.y + p_new.z + p_new.w;
  let abs_inst = e_mid * (j_d + j_k_sum);
  shell_state[idx] = vec4<f32>(p_tot, j_d, abs_inst, e_new);
}

var<workgroup> sh_inc: array<f32, 64>;
var<workgroup> sh_ref: array<f32, 64>;
var<workgroup> sh_tr: array<f32, 64>;
var<workgroup> sh_abs: array<f32, 64>;
var<workgroup> sh_e2: array<f32, 64>;
var<workgroup> sh_grad2: array<f32, 64>;
var<workgroup> sh_sx_slab: array<f32, 64>;
var<workgroup> sh_sy_slab: array<f32, 64>;

@compute @workgroup_size(64)
fn fdtd2d_reduce_observables(
  @builtin(workgroup_id) wg_id: vec3<u32>,
  @builtin(local_invocation_id) lid: vec3<u32>
) {
  let ch = wg_id.x;
  let tid = lid.x;
  if (ch >= p.n_channels) { return; }
  let cells_per_ch = p.nx * p.ny;
  let base = ch * cells_per_ch;

  var loc_inc = 0.0;
  var loc_ref = 0.0;
  var loc_tr = 0.0;
  var loc_abs = 0.0;
  var loc_e2 = 0.0;
  var loc_grad2 = 0.0;
  var loc_sx_slab = 0.0;
  var loc_sy_slab = 0.0;

  // 1. Poynting flux across vertical sensor lines (S_x = -E_z * H_y)
  for (var y = p.pml_width + tid; y < p.ny - p.pml_width; y = y + 64u) {
    // Left sensor plane x = sensor_x: rightward (+S_x) = incident, leftward (-S_x) = reflected!
    let idx_l = base + y * p.nx + p.sensor_x;
    let ez_l = ez_field[idx_l];
    let hy_l = 0.5 * (hy_field[idx_l] + hy_field[idx_l - 1u]);
    let sx_l = -ez_l * hy_l * p.courant;
    if (sx_l > 0.0) {
      loc_inc = loc_inc + sx_l;
    } else {
      loc_ref = loc_ref + (-sx_l);
    }

    // Right exit sensor plane x = tr_sensor_x: rightward (+S_x) = transmitted!
    let idx_r = base + y * p.nx + p.tr_sensor_x;
    let ez_r = ez_field[idx_r];
    let hy_r = 0.5 * (hy_field[idx_r] + hy_field[idx_r - 1u]);
    let sx_r = -ez_r * hy_r * p.courant;
    if (sx_r > 0.0) {
      loc_tr = loc_tr + sx_r;
    }
  }

  // 2. Interior slab absorption, 2D spatial wavevector compression k_slab^2, and Snell Poynting angle!
  let sx0 = p.slab_x0;
  let sx1 = p.slab_x1;
  let slab_w = sx1 - sx0 + 1u;
  let y0 = p.pml_width + 2u;
  let y1 = p.ny - p.pml_width - 2u;
  let slab_h = y1 - y0;
  let slab_total = slab_w * slab_h;
  for (var k = tid; k < slab_total; k = k + 64u) {
    let lx = k % slab_w;
    let ly = k / slab_w;
    let x = sx0 + lx;
    let y = y0 + ly;
    let idx = base + y * p.nx + x;
    let ss = shell_state[idx];
    loc_abs = loc_abs + ss.z;

    if (x >= sx0 + 3u && x <= sx1 - 3u) {
      let ez = ez_field[idx];
      let dex = 0.5 * (ez_field[idx + 1u] - ez_field[idx - 1u]);
      let dey = 0.5 * (ez_field[idx + p.nx] - ez_field[idx - p.nx]);
      loc_e2 = loc_e2 + ez * ez;
      loc_grad2 = loc_grad2 + (dex * dex + dey * dey);

      let hy = 0.5 * (hy_field[idx] + hy_field[idx - 1u]);
      let hx = 0.5 * (hx_field[idx] + hx_field[idx - p.nx]);
      // TM_z Poynting vector: S_x = -E_z * H_y, S_y = +E_z * H_x
      let sx = -ez * hy;
      let sy = ez * hx;
      if (sx > 0.0) {
        loc_sx_slab = loc_sx_slab + sx;
        loc_sy_slab = loc_sy_slab + sy;
      }
    }
  }

  sh_inc[tid] = loc_inc;
  sh_ref[tid] = loc_ref;
  sh_tr[tid] = loc_tr;
  sh_abs[tid] = loc_abs;
  sh_e2[tid] = loc_e2;
  sh_grad2[tid] = loc_grad2;
  sh_sx_slab[tid] = loc_sx_slab;
  sh_sy_slab[tid] = loc_sy_slab;
  workgroupBarrier();

  for (var stride = 32u; stride > 0u; stride = stride >> 1u) {
    if (tid < stride) {
      sh_inc[tid] = sh_inc[tid] + sh_inc[tid + stride];
      sh_ref[tid] = sh_ref[tid] + sh_ref[tid + stride];
      sh_tr[tid] = sh_tr[tid] + sh_tr[tid + stride];
      sh_abs[tid] = sh_abs[tid] + sh_abs[tid + stride];
      sh_e2[tid] = sh_e2[tid] + sh_e2[tid + stride];
      sh_grad2[tid] = sh_grad2[tid] + sh_grad2[tid + stride];
      sh_sx_slab[tid] = sh_sx_slab[tid] + sh_sx_slab[tid + stride];
      sh_sy_slab[tid] = sh_sy_slab[tid] + sh_sy_slab[tid + stride];
    }
    workgroupBarrier();
  }

  if (tid == 0u) {
    let o0 = obs_accum[ch * 2u + 0u];
    let o1 = obs_accum[ch * 2u + 1u];
    obs_accum[ch * 2u + 0u] = vec4<f32>(
      o0.x + sh_inc[0],
      o0.y + sh_ref[0],
      o0.z + sh_tr[0],
      o0.w + sh_abs[0]
    );
    obs_accum[ch * 2u + 1u] = vec4<f32>(
      o1.x + sh_e2[0],
      o1.y + sh_grad2[0],
      o1.z + sh_sx_slab[0],
      o1.w + sh_sy_slab[0]
    );
  }
}
`,_t=new WeakMap;function vt(e){let t=_t.get(e);if(t)return t;let n=e.createShaderModule({label:`ulg-photon-shell-fdtd-2d-wgsl`,code:gt}),r=e.createBindGroupLayout({label:`ulg-photon-shell-fdtd-2d-bgl`,entries:[{binding:0,visibility:4,buffer:{type:`uniform`}},{binding:1,visibility:4,buffer:{type:`storage`}},{binding:2,visibility:4,buffer:{type:`storage`}},{binding:3,visibility:4,buffer:{type:`storage`}},{binding:4,visibility:4,buffer:{type:`storage`}},{binding:5,visibility:4,buffer:{type:`storage`}},{binding:6,visibility:4,buffer:{type:`storage`}},{binding:7,visibility:4,buffer:{type:`storage`}},{binding:8,visibility:4,buffer:{type:`storage`}}]}),i=e.createPipelineLayout({bindGroupLayouts:[r]});return t={bgl:r,stepHPipe:e.createComputePipeline({label:`ulg-fdtd2d-step-h`,layout:i,compute:{module:n,entryPoint:`fdtd2d_step_h`}}),stepEPipe:e.createComputePipeline({label:`ulg-fdtd2d-step-e`,layout:i,compute:{module:n,entryPoint:`fdtd2d_step_e_and_shells`}}),reducePipe:e.createComputePipeline({label:`ulg-fdtd2d-reduce`,layout:i,compute:{module:n,entryPoint:`fdtd2d_reduce_observables`}})},_t.set(e,t),t}function yt(e,t={},{probeWavelengthNm:n=535,pulseWidthSteps:r=34,pulseT0Steps:i=78}={}){if(!e||typeof e.createComputePipeline!=`function`)throw TypeError(`createPhotonShellOpticsSessionWebGpu requires a valid WebGPU GPUDevice.`);let{bgl:a,stepHPipe:o,stepEPipe:s,reducePipe:c}=vt(e),l=ot*4,u=l*4,d=l*16,f=e.createBuffer({label:`ulg-fdtd2d-ez`,size:u,usage:Q.STORAGE|Q.COPY_DST|Q.COPY_SRC}),p=e.createBuffer({label:`ulg-fdtd2d-hx`,size:u,usage:Q.STORAGE|Q.COPY_DST}),m=e.createBuffer({label:`ulg-fdtd2d-hy`,size:u,usage:Q.STORAGE|Q.COPY_DST}),h=e.createBuffer({label:`ulg-fdtd2d-jd`,size:u,usage:Q.STORAGE|Q.COPY_DST}),g=e.createBuffer({label:`ulg-fdtd2d-pcurr`,size:d,usage:Q.STORAGE|Q.COPY_DST}),_=e.createBuffer({label:`ulg-fdtd2d-pprev`,size:d,usage:Q.STORAGE|Q.COPY_DST}),v=e.createBuffer({label:`ulg-fdtd2d-shell`,size:d,usage:Q.STORAGE|Q.COPY_DST|Q.COPY_SRC}),y=e.createBuffer({size:128,usage:Q.STORAGE|Q.COPY_DST|Q.COPY_SRC}),b=e.createBuffer({size:128,usage:Q.MAP_READ|Q.COPY_DST}),x=Array.from({length:24},()=>e.createBuffer({size:144,usage:Q.UNIFORM|Q.COPY_DST})),S=x.map(t=>e.createBindGroup({layout:a,entries:[t,f,p,m,h,g,_,v,y].map((e,t)=>({binding:t,resource:{buffer:e}}))})),C=pt(t,{probeWavelengthNm:n}),w=0,T=null,E=!1,D=new Float32Array(l),O=new Float32Array(l*4),k=new Float32Array(32),A=24*Math.PI/180,j=Math.sin(A),M=Math.cos(A);function N(t,n){let a=new ArrayBuffer(144),o=new Uint32Array(a),s=new Float32Array(a);o[0]=128,o[1]=128,o[2]=4,o[3]=n>>>0,o[4]=C.slabX0,o[5]=C.slabX1,o[6]=18,o[7]=42,o[8]=110,o[9]=36,o[10]=12,o[11]=0,s[12]=ct,s[13]=C.kDrude,s[14]=C.betaDrude,s[15]=i,s[16]=r,s[17]=j,s[18]=M,s[19]=11.5;for(let e=0;e<4;e+=1)s[20+e]=C.omegaDtChannels[e],s[24+e]=C.oscillators[e].a,s[28+e]=C.oscillators[e].b,s[32+e]=C.oscillators[e].c;e.queue.writeBuffer(t,0,a)}function P(n=null,{nextProbeWavelengthNm:r=null}={}){(n||r!=null)&&(C=pt(n||t,{probeWavelengthNm:r??C.wavelengthsNm[3]}),n&&(t=n)),w=0,e.queue.writeBuffer(f,0,D),e.queue.writeBuffer(p,0,D),e.queue.writeBuffer(m,0,D),e.queue.writeBuffer(h,0,D),e.queue.writeBuffer(g,0,O),e.queue.writeBuffer(_,0,O),e.queue.writeBuffer(v,0,O),e.queue.writeBuffer(y,0,k)}P();function F(t=4){let n=Math.max(1,Math.min(24,Math.trunc(t)));for(let e=0;e<n;e+=1)N(x[e],w+e);let r=Math.ceil(l/64),i=e.createCommandEncoder({label:`ulg-fdtd2d-batch`}),a=i.beginComputePass({label:`ulg-fdtd2d-pass`});for(let e=0;e<n;e+=1){let t=S[e];a.setPipeline(o),a.setBindGroup(0,t),a.dispatchWorkgroups(r),a.setPipeline(s),a.setBindGroup(0,t),a.dispatchWorkgroups(r),a.setPipeline(c),a.setBindGroup(0,t),a.dispatchWorkgroups(4)}a.end(),e.queue.submit([i.finish()]),w+=n}async function ee({nonBlocking:t=!1}={}){if(E)return null;if(T){if(t)return null;try{await T}catch{}if(E)return null}let n=(async()=>{if(E)return null;let t=e.createCommandEncoder({label:`ulg-fdtd2d-read-obs`});if(t.copyBufferToBuffer(y,0,b,0,128),e.queue.submit([t.finish()]),await b.mapAsync(Q.MAP_READ),E){try{b.unmap()}catch{}return null}let n=new Float32Array(b.getMappedRange().slice(0,128));b.unmap();let r=[];for(let e=0;e<4;e+=1){let t=e*8,i=n[t+0],a=n[t+1],o=n[t+2],s=n[t+3],c=n[t+4],l=n[t+5],u=n[t+6],d=n[t+7],f=i>1e-4,p=f?Math.max(0,Math.min(1.1,a/i)):0,m=f?Math.max(0,Math.min(1.1,o/i)):0,h=f?Math.max(0,Math.min(1.1,s/i)):0,g=C.omegaDtChannels[e]/ct,_=null;if(!C.isMetal&&c>.001&&l>1e-6&&g>1e-5){let e=Math.asin(Math.min(.99,Math.sqrt(l/c)))/g;Number.isFinite(e)&&e>=.95&&e<=5.5&&(_=e)}let v=null,y=null;if(!C.isMetal&&u>.001){let e=Math.atan2(Math.abs(d),u);if(y=e*180/Math.PI,e>.04){let t=j/Math.sin(e);Number.isFinite(t)&&t>=.95&&t<=5.5&&(v=t)}}let b=ht(C,C.wavelengthsNm[e]);r.push(Object.freeze({wavelengthNm:C.wavelengthsNm[e],photonEv:dt/C.wavelengthsNm[e],fluxInc:i,fluxRef:a,fluxTr:o,fluxAbs:s,reflectance:p,transmittance:m,absorption:h,energyBalance:p+m+h,nPhaseFdtd:_,nSnellFdtd:v,refractAngleDeg:y,nMeasuredFdtd:_??v??null,analyticNRe:b.nRe,analyticKIm:b.kIm,analyticReflectance:b.reflectance}))}let i=Math.max(0,Math.min(1,r[0].reflectance)),a=Math.max(0,Math.min(1,r[1].reflectance)),o=Math.max(0,Math.min(1,r[2].reflectance)),s=[mt(i),mt(a),mt(o)];return Object.freeze({schema:it,stepIndex:w,simTimeFs:w*lt*0x38d7ea4c68000,isMetal:C.isMetal,plasmaEv:C.plasmaEv,drudeGammaEv:C.drudeGammaEv,oscillators:C.oscillators,channels:Object.freeze(r),emergentReflectedSrgb:Object.freeze(s),analyticReflectedSrgb:Object.freeze([mt(r[0].analyticReflectance),mt(r[1].analyticReflectance),mt(r[2].analyticReflectance)])})})();T=n;try{return await n}finally{T===n&&(T=null)}}async function te(e=16,{readObs:t=!0}={}){let n=Math.max(1,Math.trunc(e));for(;n>0;){let e=Math.min(24,n);F(e),n-=e}return t?ee({nonBlocking:!1}):null}function I(){E=!0;for(let e of[f,p,m,h,g,_,v,y,b,...x])try{e.destroy()}catch{}}return Object.freeze({schema:it,nx:128,ny:128,nCells:ot,nChannels:4,slabX0:64,slabX1:104,eFieldBuffer:f,ezFieldBuffer:f,hxFieldBuffer:p,hyFieldBuffer:m,shellPowerBuffer:v,shellStateBuffer:v,getParams:()=>C,getStepIndex:()=>w,reset:P,stepSync:F,stepBatch:te,readTelemetry:ee,destroy:I})}var $=256,bt=`
struct TdseParams {
  n: u32,
  r_touch_idx: u32,
  r_turn_idx: u32,
  pad0: u32,
  inv_2mu_dx2: f32,
  dt_scale: f32,
  cap_start: f32,
  cap_strength: f32,
};

@group(0) @binding(0) var<uniform> p: TdseParams;
@group(0) @binding(1) var<storage, read> pot_v: array<f32>;
@group(0) @binding(2) var<storage, read_write> psi_re: array<f32>;
@group(0) @binding(3) var<storage, read_write> psi_im: array<f32>;
@group(0) @binding(4) var<storage, read_write> prob_out: array<f32>;

@compute @workgroup_size(64)
fn tdse_step_re(@builtin(global_invocation_id) gid: vec3<u32>) {
  let i = gid.x;
  let n = p.n;
  if (i >= n) { return; }
  if (i == 0u || i + 1u == n) { psi_re[i] = 0.0; return; }
  let lap = psi_im[i + 1u] - 2.0 * psi_im[i] + psi_im[i - 1u];
  let h_im = -p.inv_2mu_dx2 * lap + pot_v[i] * psi_im[i];
  var next_re = psi_re[i] + p.dt_scale * h_im;
  let frac = f32(i) / f32(n - 1u);
  if (frac > p.cap_start) {
    let s = (frac - p.cap_start) / max(0.01, 1.0 - p.cap_start);
    next_re = next_re * exp(-p.cap_strength * s * s);
  }
  psi_re[i] = next_re;
}

@compute @workgroup_size(64)
fn tdse_step_im(@builtin(global_invocation_id) gid: vec3<u32>) {
  let i = gid.x;
  let n = p.n;
  if (i >= n) { return; }
  if (i == 0u || i + 1u == n) { psi_im[i] = 0.0; prob_out[i] = 0.0; return; }
  let lap = psi_re[i + 1u] - 2.0 * psi_re[i] + psi_re[i - 1u];
  let h_re = -p.inv_2mu_dx2 * lap + pot_v[i] * psi_re[i];
  var next_im = psi_im[i] - p.dt_scale * h_re;
  let frac = f32(i) / f32(n - 1u);
  if (frac > p.cap_start) {
    let s = (frac - p.cap_start) / max(0.01, 1.0 - p.cap_start);
    next_im = next_im * exp(-p.cap_strength * s * s);
  }
  psi_im[i] = next_im;
  prob_out[i] = psi_re[i] * psi_re[i] + next_im * next_im;
}
`,xt=new WeakMap;function St(e){let t=xt.get(e);if(t)return t;let n=e.createShaderModule({label:`ulg-nuclear-tdse-wgsl`,code:bt}),r=e.createBindGroupLayout({entries:[{binding:0,visibility:4,buffer:{type:`uniform`}},{binding:1,visibility:4,buffer:{type:`read-only-storage`}},{binding:2,visibility:4,buffer:{type:`storage`}},{binding:3,visibility:4,buffer:{type:`storage`}},{binding:4,visibility:4,buffer:{type:`storage`}}]}),i=e.createPipelineLayout({bindGroupLayouts:[r]});return t={bgl:r,stepRe:e.createComputePipeline({layout:i,compute:{module:n,entryPoint:`tdse_step_re`}}),stepIm:e.createComputePipeline({layout:i,compute:{module:n,entryPoint:`tdse_step_im`}})},xt.set(e,t),t}function Ct(e,t){if(!e||typeof e.createComputePipeline!=`function`)return null;let{bgl:n,stepRe:r,stepIm:i}=St(e),a=t?.alphaWkb,o=Array.isArray(a?.rFm)?a.rFm:Array.from({length:64},(e,t)=>t/63*45),s=Array.isArray(a?.vMeV)?a.vMeV:o.map(e=>e<6?-20:120/e),c=Math.max(24,Number(o[o.length-1])||45),l=Math.max(2.5,Number(a?.rTouchFm)||(t?.chargeRadiusFm||4)*1.35),u=c/($-1),d=new Float32Array($),f=new Float32Array($),p=1;for(let e=0;e<$;e+=1){let t=e*u;d[e]=t;let n=t/c*(o.length-1),r=Math.max(0,Math.min(o.length-2,Math.floor(n))),i=Math.max(0,Math.min(1,n-r)),a=s[r]*(1-i)+s[r+1]*i;f[e]=a,a>p&&(p=a)}let m=Math.max(3.5,Math.min(p*.82,Number(t?.qAlphaMeV)>.5?Number(t.qAlphaMeV):p*.55)),h=197.32698*197.32698/(2*3727.38*u*u),g=4*h+Math.max(p,25),_=.35/Math.max(1,g),v=Math.max(4,Math.min($-16,Math.round(l/u))),y=Math.min($-12,v+24);for(let e=v+1;e<$-4;e+=1)if(f[e]<=m){y=e;break}let b=e.createBuffer({size:32,usage:Q.UNIFORM|Q.COPY_DST}),x=e.createBuffer({size:$*4,usage:Q.STORAGE|Q.COPY_DST}),S=e.createBuffer({size:$*4,usage:Q.STORAGE|Q.COPY_DST}),C=e.createBuffer({size:$*4,usage:Q.STORAGE|Q.COPY_DST}),w=e.createBuffer({size:$*4,usage:Q.STORAGE|Q.COPY_DST|Q.COPY_SRC}),T=e.createBuffer({size:$*4,usage:Q.MAP_READ|Q.COPY_DST}),E=new ArrayBuffer(32);new Uint32Array(E,0,4).set([$,v,y,0]),new Float32Array(E,16,4).set([h,_,.88,.08]),e.queue.writeBuffer(b,0,E),e.queue.writeBuffer(x,0,f);let D=e.createBindGroup({layout:n,entries:[b,x,S,C,w].map((e,t)=>({binding:t,resource:{buffer:e}}))}),O=0,k=null,A=!1;function j(){O=0;let t=new Float32Array($),n=new Float32Array($),r=new Float32Array($),i=Math.max(1.5,l*.52),a=Math.max(.85,l*.22),o=Math.sqrt(Math.max(.2,(m+18)/Math.max(1e-4,h*u*u))),s=0;for(let e=1;e<$-1;e+=1){let r=d[e],c=Math.exp(-.5*((r-i)/a)**2);t[e]=c*Math.cos(o*(r-i)),n[e]=c*Math.sin(o*(r-i)),s+=t[e]*t[e]+n[e]*n[e]}let c=1/Math.sqrt(Math.max(1e-12,s));for(let e=0;e<$;e+=1)t[e]*=c,n[e]*=c,r[e]=t[e]*t[e]+n[e]*n[e];e.queue.writeBuffer(S,0,t),e.queue.writeBuffer(C,0,n),e.queue.writeBuffer(w,0,r)}j();async function M(t=12,{nonBlocking:n=!1}={}){if(A)return null;if(k){if(n)return null;try{await k}catch{}if(A)return null}let a=(async()=>{if(A)return null;let n=Math.max(1,Math.min(64,Math.trunc(t))),a=Math.ceil($/64),o=e.createCommandEncoder({label:`ulg-nuclear-tdse`}),s=o.beginComputePass();for(let e=0;e<n;e+=1)s.setPipeline(r),s.setBindGroup(0,D),s.dispatchWorkgroups(a),s.setPipeline(i),s.setBindGroup(0,D),s.dispatchWorkgroups(a);if(s.end(),o.copyBufferToBuffer(w,0,T,0,$*4),e.queue.submit([o.finish()]),O+=n,await T.mapAsync(Q.MAP_READ),A){try{T.unmap()}catch{}return null}let c=new Float32Array(T.getMappedRange().slice(0,$*4));T.unmap();let u=0,p=0,h=0;for(let e=0;e<$;e+=1)e<=v?u+=c[e]:e<=y?p+=c[e]:h+=c[e];return Object.freeze({schema:at,stepCount:O,rGridFm:d,potRawMeV:f,prob:c,qEffMeV:m,rTouchFm:l,pInside:u,pBarrier:p,pTunneled:h})})();k=a;try{return await a}finally{k===a&&(k=null)}}function N(){A=!0;for(let e of[b,x,S,C,w,T])try{e.destroy()}catch{}}return Object.freeze({schema:at,rGridFm:d,potRawMeV:f,qEffMeV:m,resetWavepacket:j,stepBatch:M,destroy:N})}async function wt({closureRegistry:e,materialKey:t=`unknown`,electromagnetic:n={},telemetry:r=null,closureId:i=null}={}){let a=pt(n),o={closureId:i||`ulg-photon-shell-fdtd-optics:${t}.v1`,closureKind:`optical-photon-shell-fdtd-dispersion`,inputHash:`${t}:metal=${+!!a.isMetal}:wp=${a.plasmaEv.toFixed(3)}:osc=${a.oscillators.filter(e=>e.active).length}`,methodHash:`maxwell-2d-ade-fdtd-drude-lorentz-webgpu.v1`,execution:{mode:`webgpu-2d-maxwell-ade-fdtd`,params:a,measuredChannels:r?.channels??null,emergentReflectedSrgb:r?.emergentReflectedSrgb??null},validity:{wavelengthNm:[380,780],dxMeters:st,courant:ct,incidenceDeg:24},provenance:{schema:it,sourceModule:`src/runtime/material/photonShellOpticsWebGpu.js`,scientificValidation:!1}};return{ref:e?await e.store(o):null,artifact:o}}function Tt(e){return!e||typeof e.registerModule!=`function`?null:{opticsMod:e.registerModule({method:{model:`photon-shell-fdtd`,version:`1`},kernel:{sourceModule:`src/runtime/material/photonShellOpticsWebGpu.js`,entryPoint:`fdtd2d_step_e_and_shells`,workgroupSize:64,wgsl:gt},parameterSchema:{steps:{type:`number`,min:1,max:4096},probeWavelengthNm:{type:`number`,min:380,max:780}},stateLayout:{tensorId:`fdtd2d_em_shell_fields`,dtype:`f32`,components:4},stepCapsule:async(e,t)=>{let n=t?.device;if(!n)throw Error(`photon-shell-fdtd@1 requires a WebGPU device`);let r=e?.parameters||{},i=yt(n,r.electromagnetic||{},{probeWavelengthNm:r.probeWavelengthNm??535});try{return{status:`ok`,telemetry:await i.stepBatch(r.steps??280,{readObs:!0})}}finally{i.destroy()}}}),tdseMod:e.registerModule({method:{model:`nuclear-tunneling-tdse`,version:`1`},kernel:{sourceModule:`src/runtime/material/photonShellOpticsWebGpu.js`,entryPoint:`tdse_step_re`,workgroupSize:64,wgsl:bt},parameterSchema:{steps:{type:`number`,min:1,max:2048}},stateLayout:{tensorId:`tdse_wavepacket_prob`,dtype:`f32`,components:1},stepCapsule:async(e,t)=>{let n=t?.device;if(!n)throw Error(`nuclear-tunneling-tdse@1 requires a WebGPU device`);let r=e?.parameters||{},i=Ct(n,r.nuclear||{});try{return{status:`ok`,telemetry:await i.stepBatch(r.steps??48)}}finally{i.destroy()}}})}}var Et=`peercompute.ulg.simulation-module-registration.v1`;function Dt(e,t=null){return String(e??``).trim()||t}function Ot(e){if(typeof e==`string`)return e.trim()||null;if(!e||typeof e!=`object`)return null;let t=Dt(e.model??e.moduleId??e.id);return t?`${t}@${e.version==null?`1`:String(e.version).trim()}`:null}function kt(e={},t=null){if(!t||typeof t!=`object`)return{ok:!0};if(!e||typeof e!=`object`)return{ok:!1,reason:`parameters-must-be-object`};for(let[n,r]of Object.entries(t)){if(!r||typeof r!=`object`)continue;let t=e[n];if(t===void 0){if(r.required===!0)return{ok:!1,reason:`missing-required-parameter:${n}`};continue}if(r.type===`number`){let e=Number(t);if(!Number.isFinite(e))return{ok:!1,reason:`non-finite-parameter:${n}`};if(r.min!=null&&e<r.min)return{ok:!1,reason:`parameter-below-min:${n}:${e}<${r.min}`};if(r.max!=null&&e>r.max)return{ok:!1,reason:`parameter-above-max:${n}:${e}>${r.max}`}}else if(r.type===`boolean`&&typeof t!=`boolean`)return{ok:!1,reason:`parameter-not-boolean:${n}`};else if(r.type===`string`&&typeof t!=`string`)return{ok:!1,reason:`parameter-not-string:${n}`}}return{ok:!0}}function At({createArtifact:e=m}={}){let t=new Map,n=new Map;function r(e,t,{device:r=null,sessionId:i=null}={}){let a=Dt(i,`${e}:default`),o=n.get(a);if(o&&!o.disposed)return o;let s=E({sessionId:a,moduleId:e,device:r,layout:t.stateLayout,initialStep:0});return n.set(a,s),s}function i(e={}){let n=Ot(e.method??e.methodId??e.id);if(!n)throw TypeError(`Simulation module registration requires method ({ model, version }) or methodId`);if(typeof e.stepCapsule!=`function`)throw TypeError(`Simulation module ${n} requires a stepCapsule(capsule, context) function`);let r=Object.freeze({schema:Et,methodKey:n,method:typeof e.method==`object`&&e.method?Object.freeze({...e.method}):Object.freeze({model:n.split(`@`)[0],version:n.split(`@`)[1]||`1`}),kernel:e.kernel&&typeof e.kernel==`object`?Object.freeze({sourceModule:Dt(e.kernel.sourceModule),entryPoint:Dt(e.kernel.entryPoint,`main`),workgroupSize:Number.isInteger(e.kernel.workgroupSize)?e.kernel.workgroupSize:64,wgslHash:e.kernel.wgsl?d(e.kernel.wgsl):Dt(e.kernel.wgslHash)}):null,parameterSchema:e.parameterSchema&&typeof e.parameterSchema==`object`?Object.freeze({...e.parameterSchema}):Object.freeze({}),stateLayout:e.stateLayout&&typeof e.stateLayout==`object`?Object.freeze({tensorId:Dt(e.stateLayout.tensorId,`state`),dtype:Dt(e.stateLayout.dtype,`f32`),layout:Dt(e.stateLayout.layout,`interleaved`),strideElements:Number(e.stateLayout.strideElements)||1,strideBytes:Number(e.stateLayout.strideBytes)||4,fields:Object.freeze(Array.isArray(e.stateLayout.fields)?[...e.stateLayout.fields]:[])}):Object.freeze({tensorId:`state`,dtype:`f32`,layout:`interleaved`,strideElements:1,strideBytes:4,fields:Object.freeze([])}),scaleRangeM:Array.isArray(e.scaleRangeM)&&e.scaleRangeM.length===2?Object.freeze([Number(e.scaleRangeM[0]),Number(e.scaleRangeM[1])]):null,supportsResidentStep:typeof e.stepResident==`function`,registeredAt:new Date().toISOString()});return t.set(n,{descriptor:r,stepCapsule:e.stepCapsule,stepResident:typeof e.stepResident==`function`?e.stepResident:null,reset:typeof e.reset==`function`?e.reset:null,dispose:typeof e.dispose==`function`?e.dispose:null}),r}function a(e){let n=Ot(e);return n&&t.get(n)||null}function o(e){return a(e)!==null}function s(){return[...t.values()].map(e=>e.descriptor)}function c(e){let r=Ot(e);if(!r||!t.has(r))return!1;let i=t.get(r);for(let[e,t]of[...n.entries()])t.moduleId===r&&(t.dispose(),n.delete(e));return i.dispose?.(),t.delete(r),!0}function l(e,{device:t=null,sessionId:n=null}={}){let i=a(e);if(!i)throw RangeError(`Unregistered simulation module: ${Ot(e)||`missing`}`);return r(i.descriptor.methodKey,i.descriptor,{device:t,sessionId:n})}async function u(e,{sessionId:t=null,nextStep:n=0,destroyBuffers:i=!0,reason:o=`module-session-reset`}={}){let s=a(e);if(!s)throw RangeError(`Unregistered simulation module: ${Ot(e)||`missing`}`);let c=r(s.descriptor.methodKey,s.descriptor,{sessionId:t}),l=c.reset({nextStep:n,destroyBuffers:i,reason:o});return s.reset&&await s.reset({session:c,receipt:l,nextStep:n,reason:o}),l}async function f(t,{device:n=null,gpuLease:i=null,sessionId:o=null}={}){if(!t||t.serviceId!==w.ulgRuntime||t.taskKind!==T.simulationStep)return{matched:!1,reason:`not-ulg-runtime-simulation-step`};let s=a(t.method);if(!s)return{matched:!1,reason:`method-not-registered`};if(!t.taskId||!t.inputHash||!t.methodHash||!t.provenance)throw TypeError(`Registered simulation.step capsule requires taskId, inputHash, methodHash, and provenance`);let c=kt(t.input?.parameters,s.descriptor.parameterSchema);if(!c.ok){let e=RangeError(`Invalid simulation parameters for ${s.descriptor.methodKey}: ${c.reason}`);throw e.code=`ERR_INVALID_SIMULATION_MODULE_PARAMETERS`,e}let l=r(s.descriptor.methodKey,s.descriptor,{device:n,sessionId:o??t.input?.sessionId??null}),u=await s.stepCapsule(t,{createSimulationArtifact:e,device:n,gpuLease:i,leaseSession:l,moduleDescriptor:s.descriptor}),d=u?.artifact??u,f=u?.leaseHandle??null,p=l.summary(),m=d&&typeof d==`object`?{...d,execution:{...d.execution||{},registeredModule:s.descriptor.methodKey,gpuLeaseStatus:i?.status??d.execution?.gpuLeaseStatus??null,residentLeaseSession:p}}:d;return{matched:!0,methodKey:s.descriptor.methodKey,artifact:m,leaseHandle:f,leaseSession:l,leaseSummary:p}}return Object.freeze({schema:Et,registerModule:i,resolveModule:a,hasModule:o,listModules:s,unregisterModule:c,getModuleLeaseSession:l,resetModuleSession:u,dispatchSimulationStepCapsule:f})}var jt=At();export{Tt as a,Ke as c,Ge as d,rt as f,wt as i,We as l,ne as m,Ct as n,nt as o,Ae as p,yt as r,Qe as s,jt as t,Ze as u};