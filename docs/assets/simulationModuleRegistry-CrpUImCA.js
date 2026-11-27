import{Ha as e,Qi as t,na as n,qa as r}from"./src-B-qApvaQ.js";import{n as i,r as a}from"./ClosureRegistry-C2WszvQB.js";import{a as o,bt as s,d as c,dt as l,gt as u,ht as d,mt as f,n as p,pt as m,r as h,s as g,ut as _}from"./molecularDynamicsWebGpu-CbAExWmN.js";import{C as v,D as y,E as b,S as x,T as S,a as C,l as w,n as T,w as E,x as D,y as O}from"./batchedSymmetricEigensolverGpu-BLwG_jI7.js";import{i as k}from"./residentBufferLease-EzWfR0Bs.js";import{o as A}from"./ulgMaterialPbrWgsl-DR6dAUHI.js";var j=`peercompute.ulg.radial-kohn-sham-webgpu.v1`,M=128,N=1,P=`
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
`,F=`
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
`,I=`
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
`,ee=`
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
`;function L(e){let t=2166136261,n=2654435769;for(let r=0;r<e.length;r+=1){let i=e.charCodeAt(r);t=Math.imul(t^i,16777619)>>>0,n=Math.imul(n^i+r,2246822507)>>>0}return`wgsl-fnv1a64:${t.toString(16).padStart(8,`0`)}${n.toString(16).padStart(8,`0`)}`}var te=L(`${P}::${F}::${I}::${ee}`),ne=new WeakMap;function re(e){let t=ne.get(e);if(t)return t;let n=e.createShaderModule({label:`ulg-ks-potential-wgsl`,code:P}),r=e.createShaderModule({label:`ulg-ks-observables-wgsl`,code:F}),i=e.createShaderModule({label:`ulg-ks-spinorbit-wgsl`,code:I}),a=e.createShaderModule({label:`ulg-ks-eigensolver-wgsl`,code:ee}),o=e.createBindGroupLayout({label:`ulg-ks-pot-bgl`,entries:[{binding:0,visibility:4,buffer:{type:`uniform`}},{binding:1,visibility:4,buffer:{type:`read-only-storage`}},{binding:2,visibility:4,buffer:{type:`storage`}},{binding:3,visibility:4,buffer:{type:`storage`}},{binding:4,visibility:4,buffer:{type:`storage`}},{binding:5,visibility:4,buffer:{type:`storage`}},{binding:6,visibility:4,buffer:{type:`storage`}}]}),s=e.createBindGroupLayout({label:`ulg-ks-obs-bgl`,entries:[{binding:0,visibility:4,buffer:{type:`uniform`}},{binding:1,visibility:4,buffer:{type:`read-only-storage`}},{binding:2,visibility:4,buffer:{type:`read-only-storage`}},{binding:3,visibility:4,buffer:{type:`read-only-storage`}},{binding:4,visibility:4,buffer:{type:`storage`}},{binding:5,visibility:4,buffer:{type:`read-only-storage`}},{binding:6,visibility:4,buffer:{type:`read-only-storage`}},{binding:7,visibility:4,buffer:{type:`storage`}}]}),c=e.createBindGroupLayout({label:`ulg-ks-so-bgl`,entries:[{binding:0,visibility:4,buffer:{type:`uniform`}},{binding:1,visibility:4,buffer:{type:`read-only-storage`}},{binding:2,visibility:4,buffer:{type:`read-only-storage`}},{binding:3,visibility:4,buffer:{type:`read-only-storage`}},{binding:4,visibility:4,buffer:{type:`read-only-storage`}},{binding:5,visibility:4,buffer:{type:`storage`}}]}),l=e.createBindGroupLayout({label:`ulg-ks-eig-bgl`,entries:[{binding:0,visibility:4,buffer:{type:`uniform`}},{binding:1,visibility:4,buffer:{type:`read-only-storage`}},{binding:2,visibility:4,buffer:{type:`read-only-storage`}},{binding:3,visibility:4,buffer:{type:`read-only-storage`}},{binding:4,visibility:4,buffer:{type:`read-only-storage`}},{binding:5,visibility:4,buffer:{type:`storage`}},{binding:6,visibility:4,buffer:{type:`storage`}},{binding:7,visibility:4,buffer:{type:`storage`}},{binding:8,visibility:4,buffer:{type:`storage`}}]});return t={potPipeline:e.createComputePipeline({label:`ulg-ks-pot-pipe`,layout:e.createPipelineLayout({bindGroupLayouts:[o]}),compute:{module:n,entryPoint:`ks_hartree_pbe_xc`}}),obsPipeline:e.createComputePipeline({label:`ulg-ks-obs-pipe`,layout:e.createPipelineLayout({bindGroupLayouts:[s]}),compute:{module:r,entryPoint:`ks_density_and_observables`}}),soPipeline:e.createComputePipeline({label:`ulg-ks-so-pipe`,layout:e.createPipelineLayout({bindGroupLayouts:[c]}),compute:{module:i,entryPoint:`ks_spin_orbit_quadrature`}}),packAuxPipeline:e.createComputePipeline({label:`ulg-ks-pack-aux-pipe`,layout:e.createPipelineLayout({bindGroupLayouts:[l]}),compute:{module:a,entryPoint:`ks_pack_aux`}}),eigPipeline:e.createComputePipeline({label:`ulg-ks-eig-pipe`,layout:e.createPipelineLayout({bindGroupLayouts:[l]}),compute:{module:a,entryPoint:`ks_solve_radial_orbitals`}}),potBgl:o,obsBgl:s,soBgl:c,eigBgl:l},ne.set(e,t),t}async function ie(e,t,{functional:n=`pbe`,spinOrbit:r=!0,scalarRelativistic:i=!1,nuclearChargeRadiusBohr:a=0,nuclearMassU:o=null,nuclearSpinI:s=0,nuclearMagneticMomentMuN:c=0,configuration:l=null,gridPointsN:u=256,rMinBohr:d=1e-4,rMaxBohr:f=null,mixing:p=.25,maxScf:m=60,returnRadialDensity:h=!0,returnOrbitalWavefunctions:g=!1}={}){if(!e||typeof e.createComputePipeline!=`function`)throw TypeError(`solveAtomFullWebGpu requires a valid WebGPU GPUDevice.`);let _=Math.min(256,Math.max(64,Math.floor(u))),y=String(n||`pbe`).toLowerCase(),b=y===`bare`?2:+(y===`pbe`),x=i?r?2:1:0,C=Math.max(0,Number(a)||0),w=f??Math.max(20,60/Math.sqrt(t)),T=Math.log(d),E=(Math.log(w)-T)/(_-1),D=new Float64Array(_),O=new Float32Array(_),k=new Float32Array(_);for(let e=0;e<_;e+=1){let n=Math.exp(T+e*E);D[e]=n,O[e]=n,k[e]=t*(t**3/Math.PI)*Math.exp(-2*t*n)}let A=l??v(t),P=A.length,F=new Float32Array(Math.max(1,P)*4);for(let e=0;e<P;e+=1)F[e*4+0]=A[e].n,F[e*4+1]=A[e].l,F[e*4+2]=A[e].occupancy,F[e*4+3]=-(t*t)/(2*A[e].n*A[e].n);let{potPipeline:I,obsPipeline:ee,soPipeline:L,packAuxPipeline:ne,eigPipeline:ie,potBgl:ae,obsBgl:R,soBgl:z,eigBgl:oe}=re(e),B=_*4,se=new ArrayBuffer(32),V=new Uint32Array(se),ce=new Float32Array(se);V[0]=_,V[1]=b,ce[2]=t,ce[3]=E,ce[4]=p,V[5]=P,V[6]=x,ce[7]=C;let le=e.createBuffer({size:32,usage:72}),ue=e.createBuffer({size:B,usage:136}),de=e.createBuffer({size:B,usage:140}),fe=e.createBuffer({size:B,usage:M}),pe=e.createBuffer({size:B,usage:M}),me=e.createBuffer({size:B,usage:M}),he=e.createBuffer({size:B,usage:M}),ge=e.createBuffer({size:B*4,usage:M}),_e=e.createBuffer({size:Math.max(1,P)*B,usage:g?132:M}),H=e.createBuffer({size:Math.max(1,P)*16,usage:140}),ve=e.createBuffer({size:Math.max(1,P)*16,usage:132}),ye=e.createBuffer({size:16,usage:132}),be=e.createBuffer({size:Math.max(1,P)*16,usage:132}),U=g?Math.max(1,P)*B:0,xe=Math.max(1,P)*16,Se=16+xe*3+B+U,W=e.createBuffer({size:Se,usage:9});try{e.queue.writeBuffer(le,0,se),e.queue.writeBuffer(ue,0,O),e.queue.writeBuffer(de,0,k),e.queue.writeBuffer(H,0,F);let n=e.createBindGroup({layout:ae,entries:[le,ue,de,fe,pe,me,he].map((e,t)=>({binding:t,resource:{buffer:e}}))}),i=e.createBindGroup({layout:oe,entries:[le,ue,pe,me,he,ge,_e,H,ve].map((e,t)=>({binding:t,resource:{buffer:e}}))}),a=e.createBindGroup({layout:R,entries:[le,ue,_e,H,de,fe,ge,ye].map((e,t)=>({binding:t,resource:{buffer:e}}))}),l=e.createBindGroup({layout:z,entries:[le,ue,_e,H,he,be].map((e,t)=>({binding:t,resource:{buffer:e}}))}),u=e.createCommandEncoder({label:`ulg-ks-full-webgpu-scf`}),d=u.beginComputePass({label:`ulg-ks-full-webgpu-scf-pass`}),f=Math.max(1,Math.min(120,Math.floor(m)));for(let e=0;e<f;e+=1)d.setPipeline(I),d.setBindGroup(0,n),d.dispatchWorkgroups(1,1,1),d.setPipeline(ne),d.setBindGroup(0,i),d.dispatchWorkgroups(1,1,1),d.setPipeline(ie),d.setBindGroup(0,i),d.dispatchWorkgroups(Math.max(1,P),1,1),d.setPipeline(ee),d.setBindGroup(0,a),d.dispatchWorkgroups(1,1,1);d.setPipeline(L),d.setBindGroup(0,l),d.dispatchWorkgroups(Math.max(1,P),1,1),d.end();let p=xe;u.copyBufferToBuffer(ye,0,W,0,16),u.copyBufferToBuffer(H,0,W,16,p),u.copyBufferToBuffer(be,0,W,16+p,p),u.copyBufferToBuffer(ve,0,W,16+p*2,p),u.copyBufferToBuffer(de,0,W,16+p*3,B),g&&U>0&&u.copyBufferToBuffer(_e,0,W,16+p*3+B,U),e.queue.submit([u.finish()]),await W.mapAsync(N);let v=new Float32Array(W.getMappedRange().slice(0));W.unmap();let y={integratedElectrons:v[0],eHartreeDouble:v[1],eXcCorrection:v[2],scfL1Delta:v[3]},w=4+P*4,T=4+P*8,M=4+P*12,re=M+_,V=Array.from(v.slice(M,M+_)),ce=g?Array.from({length:P},(e,t)=>v.slice(re+t*_,re+(t+1)*_)):null,Se=0,Ce=0,G=0,we=[];for(let e=0;e<P;e+=1){let t=v[4+e*4+3],n=A[e],i=v[T+e*4+0],a=v[T+e*4+1],o=v[T+e*4+2],s=Math.max(0,Number(v[T+e*4+3])||0);Se+=n.occupancy*t,Ce+=n.occupancy,G+=n.occupancy*s;let c={n:n.n,l:n.l,occupancy:n.occupancy,energyHa:t,kappaPlus:-(n.l+1),...n.l>=1?{kappaMinus:n.l}:{},smallComponentNormSq:s};r&&n.l>=1&&(x===2&&Number.isFinite(i)&&Number.isFinite(a)?(c.energyJMinusHa=i,c.energyJPlusHa=a,c.spinOrbitSplittingHa=o,c.spinOrbitXiHa=o/(n.l+.5)):(c.spinOrbitXiHa=v[w+e*4+0],c.spinOrbitSplittingHa=v[w+e*4+1],c.energyJMinusHa=v[w+e*4+2],c.energyJPlusHa=v[w+e*4+3])),we.push(c)}let Te=Se-y.eHartreeDouble+y.eXcCorrection,Ee=Number(o),K=Number.isFinite(Ee)&&Ee>0,De=K?1/(1+1/(Ee*1822.8884862)):1,q=Te*De,Oe=q-Te,ke=t/137.035999084,Ae=x?4/(3*Math.PI)*(1/137.035999084)**3*t**4*Math.max(.5,Math.log(1/Math.max(1e-6,ke*ke))-2.3):0,je=Math.max(0,Number(s)||0),Me=Number(c)||0,Ne=Math.max(0,V[0]||0),Pe=0,Fe=0;for(let e of we){let n=2*(2*e.l+1);e.l===0&&e.electrons>0&&e.electrons<n?Pe=Math.max(Pe,1/(Math.max(1,e.n)**3*Math.max(1,t**1.4))):e.l>0&&e.electrons>0&&e.electrons<n&&(Fe=Math.max(Fe,.002/(Math.max(1,e.n)**3*Math.max(1,t**1.6))))}let Ie=t===1?Ne:Ne*Math.max(Pe,Fe),Le=je>0&&Math.abs(Me)>0&&Ie>0?Ie*Math.PI*1420405751*(Math.abs(Me)/2.792847)*((je+.5)/1):0;return{schema:j,symbol:S(t),atomicNumberZ:t,configuration:A,functional:b===2?`bare`:b?`pbe`:`lda`,dirac4Component:x===2,totalSmallComponentNormSq:G,relativisticMethod:x===2?`dirac-4comp-gpu+qed`:x===1?`koelling-harmon-gpu+qed`:r?`schrodinger-log-gpu+spin-orbit`:`schrodinger-log-gpu`,finiteNucleusUsed:C>0,nuclearChargeRadiusBohr:C,nuclearMassU:K?Ee:null,reducedMassFactor:De,isotopeMassShiftHa:Oe,hyperfineSplittingHz:Le,qedRadiativeShiftHa:Ae,totalEnergyHa:q+Ae,orbitals:we,electronCount:Ce,integratedElectrons:y.integratedElectrons,scfIterations:f,scfL1Delta:y.scfL1Delta,resolverStatus:`webgpu-derived`,webgpuNativeEigensolver:!0,perScfCpuReadbacks:0,webgpuProgramHash:te,...h?{radialGrid:{r:Array.from(D),rho:V,dx:E}}:{},...g&&ce?{orbitalWavefunctions:ce}:{},validation:Object.freeze({scientificValidation:!1,webgpuParity:!1})}}finally{for(let e of[le,ue,de,fe,pe,me,he,ge,_e,H,ve,ye,be,W])e.destroy()}}var ae=`ulg.electronic.periodic-bulk-dft-webgpu.v1`,R=27.211386245988,z=f/m**3*1e-9,oe=m*1e10,B=1054571817e-43,se=1380649e-29;function V(e){let t=v(e),n=t.reduce((e,t)=>Math.max(e,t.n),0),r=t.find(e=>e.n===n&&e.l===0),i=t.find(e=>e.n===n&&e.l===1),a=t.find(e=>e.n===n&&e.l===2),o=a||t.find(e=>e.n===n-1&&e.l===2),s=a?0:r?.occupancy??0,c=a?0:i?.occupancy??0;return{maxN:n,sSub:r,pSub:i,dSub:o,sOcc:s,pOcc:c,dOcc:o?.occupancy??0,isClosedShell:(n===1&&s===2||c===6)&&!a,isMolecularNonmetal:!a&&(n===1&&s===1||c===5||n<=3&&c>=3&&c<=4||n===4&&c===4),isCovalentTetrahedral:!a&&(n>=2&&n<=5&&c===2||n===2&&c===1)}}var ce=Object.freeze({fcc:Object.freeze({id:`fcc`,spaceGroup:`Fm-3m (225)`,madelungAlpha:-1.79175,coord:12,atomsPerConv:4,packingFactor:Math.PI/(3*Math.SQRT2),shearRatioGOverK:.45,basisFractional:[[0,0,0]]}),bcc:Object.freeze({id:`bcc`,spaceGroup:`Im-3m (229)`,madelungAlpha:-1.79186,coord:8,atomsPerConv:2,packingFactor:Math.PI*Math.sqrt(3)/8,shearRatioGOverK:.48,basisFractional:[[0,0,0]]}),hcp:Object.freeze({id:`hcp`,spaceGroup:`P6_3/mmc (194)`,madelungAlpha:-1.79168,coord:12,atomsPerConv:4,packingFactor:Math.PI/(3*Math.SQRT2),shearRatioGOverK:.46,basisFractional:[[0,0,0],[1/3,2/3,.5]]}),diamond:Object.freeze({id:`diamond`,spaceGroup:`Fd-3m (227)`,madelungAlpha:-1.67085,coord:4,atomsPerConv:8,packingFactor:Math.PI*Math.sqrt(3)/16,shearRatioGOverK:.72,basisFractional:[[-.125,-.125,-.125],[.125,.125,.125]]}),"vdw-fcc":Object.freeze({id:`vdw-fcc`,spaceGroup:`Fm-3m (vdW)`,madelungAlpha:-1.79175,coord:12,atomsPerConv:4,packingFactor:Math.PI/(3*Math.SQRT2),shearRatioGOverK:.32,basisFractional:[[0,0,0]]})});function le(e){let t=V(e);return t.isClosedShell||t.isMolecularNonmetal?[`vdw-fcc`]:t.isCovalentTetrahedral?[`diamond`,`fcc`]:!t.dSub&&!t.pSub&&t.sOcc===1?[`bcc`,`fcc`]:!t.dSub&&!t.pSub&&t.sOcc===2?[`hcp`,`fcc`,`bcc`]:t.dOcc>=1&&t.dOcc<=9?[`bcc`,`fcc`,`hcp`]:[`fcc`,`bcc`,`hcp`]}var ue=Object.freeze([[0,0,0],[1,1,1],[-1,1,1],[1,-1,1],[1,1,-1],[-1,-1,1],[-1,1,-1],[1,-1,-1],[-1,-1,-1],[2,0,0],[-2,0,0],[0,2,0],[0,-2,0],[0,0,2],[0,0,-2]]);function de(e,t,n,r,i){let a=ue.length,o=new Float32Array(a*a),c=2*Math.PI/Math.max(1.5,t),l=i===`bcc`?t**3/2:i===`diamond`?t**3/8:t**3/4,u=s(n/Math.max(1e-6,l)),d=1.919158292677513/Math.max(.25,u);for(let t=0;t<a;t+=1){let s=ue[t],u=(e[0]+s[0])*c,f=(e[1]+s[1])*c,p=(e[2]+s[2])*c;o[t*a+t]=.5*(u*u+f*f+p*p);for(let e=t+1;e<a;e+=1){let u=ue[e],f=(s[0]-u[0])*c,p=(s[1]-u[1])*c,m=(s[2]-u[2])*c,h=Math.hypot(f,p,m);if(h<1e-8)continue;let g=-(4*Math.PI*n/(l*h*h))*Math.cos(h*r),_=h/(2*d),v=_<1e-4?1:Math.abs(_-1)<1e-4?.5:.5+(1-_*_)/(4*_)*Math.log(Math.abs((1+_)/(1-_))),y=1+4*d/(Math.PI*h*h)*v,b=1;if(i===`diamond`){let e=(s[0]-u[0]+(s[1]-u[1])+(s[2]-u[2]))*(Math.PI/4);b=Math.cos(e)}else if(i===`hcp`){let e=((s[0]-u[0])/3+2*(s[1]-u[1])/3+.5*(s[2]-u[2]))*Math.PI;b=Math.cos(e)}let x=g/y*b;o[t*a+e]=x,o[e*a+t]=x}}return o}function fe(){let e=[{label:`Γ`,k:[0,0,0]},{label:`X`,k:[0,1,0]},{label:`W`,k:[.5,1,0]},{label:`L`,k:[.5,.5,.5]},{label:`Γ`,k:[0,0,0]}],t=[];for(let n=0;n<e.length-1;n+=1){let r=e[n].k,i=e[n+1].k;for(let a=0;a<4;a+=1){let o=a/4;t.push({label:a===0?e[n].label:``,k:[r[0]+o*(i[0]-r[0]),r[1]+o*(i[1]-r[1]),r[2]+o*(i[2]-r[2])]})}}return t.push(e[e.length-1]),t}function pe(e,t,n){let r=Math.max(.8,e),{Z:i,zv:a,rcBohr:o,polarizabilityBohr3:s,rVdwBohr:c,dOcc:l,fOcc:f,relSContraction:p,spGapHa:m}=n,h=4*Math.PI/3*r**3;if(t.id===`vdw-fcc`){let e=r*1.80941,t=.75*Math.max(.15,n.ionizationPotentialHa||.5)*s*s,i=Math.max(2.2,c*1.38),a=(i/e)**6;return 2*Math.max(1e-5,t/(4*i**6))*(12.13188*a*a-14.45392*a)}let g=r/Math.cbrt(Math.max(1,a)),_=1.10495/(g*g)*a,v=(u(g)+d(g))*a,y=t.madelungAlpha*a*a/(2*r),b=2*Math.PI*a*a*o*o/h,x=0;if(l>0&&l<10){let e=Math.max(3,n.dPrincipalN||3),t=2.65+.16*(e-3),i=.145*(e/3)**.45*(t/r)**3.2;x-=.5*i*l*(1-l/10),x+=.22*i*(l/10+.38)*(t/r)**6}else if(l===10&&n.sOcc===1&&n.pOcc===0){let e=Math.max(3,n.dPrincipalN||3),t=2.62+.14*(e-3),i=.085*(e/3)**.35*(t/r)**3.4;x-=1.35*i,x+=.65*i*(t/r)**5.5}if(f>0&&f<14){let e=(n.fPrincipalN||4)<=4,t=e?3.55:3.35,i=(e?.025:.055)*(t/r)**3.5;x-=.25*i*f*(1-f/14),x+=.28*i*(f/14+.4)*(t/r)**6}if(t.id===`diamond`){let e=r*1.3959,t=Math.max(2.85,Math.sqrt(Math.max(2,n.meanR2Valence||6))*1.44),i=Math.exp(-.56*(e-t)),o=Math.max(.12,.072*a*a/Math.max(2.2,t));x+=(a>=3&&a<=5?2.25:.5)*o*(i*i-2*i)}l===10&&a===2&&p>.08&&(x+=.18*p*(m||.2)*(3.2/r)**2.5);let{sOcc:S=0,pOcc:C=0}=n,w=0;return t.id===`bcc`?w=l>=3&&l<=6||l===0&&C===0&&S===1?-.0085:.0045:t.id===`fcc`?w=l>=8&&l<=10&&!(l===10&&S===2&&C===0)||l===0&&S===2&&C>=1||l===10&&C>=1?-.0095:.0015:t.id===`hcp`&&(w=l===0&&C===0&&S===2||l===1||l===2||l===7||l===10&&S===2&&C===0||f>0&&f<14?-.009:.002),_+v+y+b+x+w}function me(e,t){let n=0;for(let e=1;e<t.length;e+=1)t[e]<t[n]&&(n=e);let r=Math.max(1,Math.min(t.length-2,n)),i=4*Math.PI/3*e[r-1]**3,a=4*Math.PI/3*e[r]**3,o=4*Math.PI/3*e[r+1]**3,s=t[r-1],c=t[r],l=t[r+1],u=(c-s)/(a-i),d=(l-c)/(o-a),f=2*(d-u)/(o-i),p=.5*(u+d),m=a-(f>1e-12?p/f:0);m=f>1e-12?Math.max(i,Math.min(o,m)):a;let h=Math.cbrt(3*m/(4*Math.PI)),g=c-(f>1e-12?.5*p*p/f:0),_=Math.max(1e-7,m*Math.max(1e-7,f))*z;return{rWsEq:h,vEqBohr3:m,eMinHa:g,bulkModulusGPa:_}}function he(e,t){let n=v(e),r=n.reduce((e,t)=>Math.max(e,t.n),0),i=n.find(e=>e.n===r&&e.l===2),a=i||n.find(e=>e.n===r-1&&e.l===2),o=n.find(e=>e.n===r-2&&e.l===3),s=i?null:n.find(e=>e.n===r&&e.l===0),c=i?null:n.find(e=>e.n===r&&e.l===1),l=s?.occupancy??0,u=c?.occupancy??0,d=a?.occupancy??0,f=o?.occupancy??0,p=Math.max(1,y(e)||(a?Math.min(4,a.occupancy):1)),m=2,h=!1,g=3.2,_=6,b=t?.radialGrid;if(b?.r&&b?.rho){let{r:e,rho:t,dx:n}=b,r=0,i=0;for(let r=0;r<e.length;r+=1)i+=4*Math.PI*e[r]*e[r]*e[r]*t[r]*n;let a=Math.max(1,l+u+.55*(u===0?d:0)+.55*(f<14?f:0)),o=Math.max(.5,i-a),s=0,c=0;for(let a=0;a<e.length;a+=1){let l=4*Math.PI*e[a]*e[a]*e[a]*t[a]*n;r+=l,r>=o&&!h&&(m=e[a],h=!0),t[a]>=5e-4&&(g=e[a]),r>=Math.max(0,i-p-1)&&(s+=e[a]*e[a]*l,c+=l)}c>1e-6&&(_=s/c)}let x=Math.max(.55,Math.min(2.85,m*.82)),S=Array.isArray(t?.orbitals)?t.orbitals.filter(e=>Number(e.occupancy??1)>0):[],C=S.length?Math.max(...S.map(e=>Number(e.energyHa??e.energy??-.4))):-.35,w=Math.max(.14,-C*1.65),T=a?S.find(e=>e.n===a.n&&e.l===2):null,E=o?S.find(e=>e.n===o.n&&e.l===3):null,D=T?Number(T.energyHa??T.energy??-.35):null,O=E?Number(E.energyHa??E.energy??-.45):null,k=Math.max(1.2,Math.min(450,2/9*Math.max(1,p)*_**2)),A=Math.min(.35,.5*(e/137.036)**2);return Object.freeze({Z:e,maxN:r,zv:p,rcBohr:x,rVdwBohr:Math.max(1.8,g),meanR2Valence:_,polarizabilityBohr3:k,ionizationPotentialHa:w,dOcc:d,dPrincipalN:a?.n??0,dOrbitalEnergyHa:D,fOcc:f,fPrincipalN:o?.n??0,fOrbitalEnergyHa:O,sOcc:l,pOcc:u,relSContraction:A,spGapHa:.22+.4*A})}async function ge(t,n,r,{densityGridN:i=16,atomicMassU:a=null}={}){if(!t||typeof t.createBuffer!=`function`)throw TypeError(`solveBulkCrystalWebGpu requires a live WebGPU GPUDevice`);let o=he(n,r),s=le(n),c=null;for(let e of s){let t=ce[e],n=e===`vdw-fcc`?Math.max(2,o.rVdwBohr*.72):Math.max(1.3,o.rcBohr*1.15),r=e===`vdw-fcc`?Math.max(n+2.5,o.rVdwBohr*1.45):Math.max(n+2.8,o.rcBohr*3.1),i=new Float64Array(19),a=new Float64Array(19);for(let e=0;e<19;e+=1)i[e]=n+e/18*(r-n),a[e]=pe(i[e],t,o);let s=me(i,a);(!c||s.eMinHa<c.fit.eMinHa)&&(c={struct:t,fit:s})}let{struct:l,fit:f}=c,p=Number(a),h=Number.isFinite(p)&&p>0?p*16605390666e-37:D(n),g=Math.max(1e6,f.bulkModulusGPa*1e9),_=g*l.shearRatioGOverK,v=f.vEqBohr3*m**3,y=h/v,b=Math.sqrt((g+4/3*_)/y),x=Math.sqrt(_/y),C=Math.cbrt(3/(1/b**3+2/x**3)),w=B/se*Math.cbrt(6*Math.PI*Math.PI/v)*C,O=Math.min(.18,1.5*1.6*se*w/Math.max(1e-24,g*v)),k=f.vEqBohr3*(1+O),j=k*m**3,M=h/j,N=Math.cbrt(l.atomsPerConv*k),P=N*oe,F=(3*g-2*_)/(2*(3*g+_)),I=g+4/3*_,ee=g-2/3*_,L=_,te=Math.sqrt((g+4/3*_)/M),ne=Math.sqrt(_/M),re=Math.cbrt(3/(1/te**3+2/ne**3)),ie=1/j,z=B/se*Math.cbrt(6*Math.PI*Math.PI*ie)*re,ge;if(l.id===`vdw-fcc`)ge=Math.max(8e-4,Math.min(2.5,Math.abs(f.eMinHa)*R));else{let e=Math.max(1.2,f.rWsEq),t=e/Math.cbrt(Math.max(1,o.zv)),n=1.10495/(t*t)*o.zv+(u(t)+d(t))*o.zv+l.madelungAlpha*o.zv*o.zv/(2*e)+2*Math.PI*o.zv*o.zv*o.rcBohr*o.rcBohr/(4*Math.PI/3*e**3),r=Math.max(0,(n-f.eMinHa)*R),i=5.45*Math.max(1,o.zv)**.65/Math.max(1.6,e);if(o.dOcc===10&&o.sOcc===2&&o.pOcc===0){let e=Math.max(.18,1-2.9*o.relSContraction);i*=.44*e}else o.dOcc===0&&o.pOcc===0&&o.sOcc===2&&(i*=.72);let a=l.id===`diamond`?.55:.85;ge=Math.max(.15,Math.min(9.5,i+a*r))}let _e=fe(),H=ue.length,ve=new Float32Array(_e.length*H*H);for(let e=0;e<_e.length;e+=1){let t=de(_e[e].k,N,o.zv,o.rcBohr,l.id);ve.set(t,e*H*H)}let ye=await T(t,{matrices:ve,n:H,batchCount:_e.length,maxSweeps:28,tolerance:1e-5}),be=[],U=[],xe=Math.max(1,Math.ceil(o.zv/2)),Se=-1/0,W=1/0;for(let e=0;e<_e.length;e+=1){let t=[];for(let n=0;n<Math.min(8,H);n+=1){let r=ye.eigenvalues[e*H+n]*R;t.push(r),U.push(r)}be.push(t);let n=Math.min(t.length-2,xe-1);Se=Math.max(Se,t[n]),W=Math.min(W,t[n+1])}U.sort((e,t)=>e-t);let Ce=U[Math.min(U.length-1,Math.floor(_e.length*(o.zv/2)))],G=i,we=G**3,Te=new Float32Array(we*2);for(let e=0;e<H;e+=1){let[t,n,r]=ue[e],i=(t%G+G)%G,a=(n%G+G)%G,o=((r%G+G)%G*G+a)*G+i,s=ye.eigenvectors[e*H+0],c=xe>1?ye.eigenvectors[e*H+1]:0;Te[o*2]+=s,Te[o*2+1]+=c}let Ee=await A(t,{data:Te,n:G,inverse:!0}),K=new Float32Array(we),De=1e-12;for(let e=0;e<we;e+=1){let t=Ee.data[e*2],n=Ee.data[e*2+1],r=t*t+n*n;K[e]=r,r>De&&(De=r)}for(let e=0;e<we;e+=1)K[e]/=De;let q=1/(2*Math.max(.08,N/G)),Oe=0;for(let e=0;e<G;e+=1){let t=(e+G-1)%G,n=(e+1)%G;for(let r=0;r<G;r+=1){let i=(r+G-1)%G,a=(r+1)%G;for(let o=0;o<G;o+=1){let s=(o+G-1)%G,c=(o+1)%G,l=(e*G+r)*G+o,u=Math.max(.025,K[l]),d=(K[(e*G+r)*G+c]-K[(e*G+r)*G+s])*q,f=(K[(e*G+a)*G+o]-K[(e*G+i)*G+o])*q,p=(K[(n*G+r)*G+o]-K[(t*G+r)*G+o])*q;Oe+=Math.hypot(d,f,p)/u}}}let ke=Oe/Math.max(1,we),Ae=1.35;if(r?.radialGrid?.r&&r?.radialGrid?.rho){let{r:e,rho:t,dx:n}=r.radialGrid,i=Math.max(.25,o.rcBohr*.35),a=Math.max(i+.5,f.rWsEq),s=0,c=0;for(let r=1;r+1<e.length;r+=1){let o=e[r];if(o<i||o>a)continue;let l=Math.max(1e-8,t[r]),u=Math.abs(t[r+1]-t[r-1])/(2*n*o),d=4*Math.PI*o*o*o*n;s+=Math.min(8,u/l)*d,c+=d}c>1e-6&&(Ae=s/c)}let je=.65*Ae+.35*ke,Me=Math.max(1.05,Math.min(1.95,-.012+1.023*Math.sqrt(Math.max(.05,je)))),Ne=E(n).reduce((e,t)=>e+(t.occUp-t.occDown),0),Pe=o.dOcc>0&&o.dOcc<10,Fe=o.fOcc>0&&o.fOcc<14,Ie=0,Le=0,Re=0;if(Fe){let e=Math.max(.18,Math.min(2,Math.abs(o.fOrbitalEnergyHa??-.45))),t=o.fPrincipalN<=4?1:.68;Ie=Math.max(2.6,Math.min(7.4,7.6*e**.35*t));let n=o.fOcc/14;Le=.5*Ie*o.fOcc*(1-n),Re=Ne/7*Ie*.32}else if(Pe){let e=Math.max(.14,Math.min(1.5,Math.abs(o.dOrbitalEnergyHa??-.35))),t=3/Math.max(3,o.dPrincipalN||3);Ie=Math.max(1,Math.min(6.2,5.4*e**.35*t));let n=o.dOcc/10;Le=.5*Ie*o.dOcc*(1-n),Re=Ne/5*Ie*.28}let ze=.5*Re,Be=Object.freeze({up:Object.freeze(be.map(e=>Object.freeze(e.map(e=>e-ze)))),down:Object.freeze(be.map(e=>Object.freeze(e.map(e=>e+ze))))}),J=Math.max(0,W-Se),Ve=.65+.35*Me;if(l.id===`vdw-fcc`){let e=V(n);J=Math.max(J,Math.min(21.5,o.ionizationPotentialHa*R*(e.isClosedShell?.85:.42)*Math.max(.92,Math.min(1.15,Ve))))}else l.id===`diamond`?J=Math.max(.4,(J+.35)*Ve*(1+1.55/Math.max(1.5,P*.45))):J<.25&&(J=0);let He=Math.min(...U)-2,Ue=Math.max(...U)+2,We=new Float32Array(48),Ge=new Float32Array(48),Ke=Math.max(.35,(Ue-He)/36);for(let e=0;e<48;e+=1){let t=He+e/47*(Ue-He);We[e]=t;let n=0;for(let e of U){let r=(t-e)/Ke;n+=Math.exp(-.5*r*r)}Ge[e]=2*n/(_e.length*Ke*Math.sqrt(2*Math.PI))}let qe=0;if(J===0){let e=Math.max(0,Math.min(47,Math.round((Ce-He)/Math.max(1e-6,Ue-He)*47)));qe=Math.max(.15,Ge[e]+(o.dOcc>0&&o.dOcc<10?.32*Math.sin(Math.PI*o.dOcc/10)*6.5:0))}return Object.freeze({schema:ae,backend:`webgpu`,Z:n,symbol:S(n),crystalStructure:l.id,spaceGroup:l.spaceGroup,coordinationNumber:l.coord,latticeConstantA:P,wignerSeitzRadiusBohr:f.rWsEq,densityKgPerM3:M,cohesiveEnergyEv:ge,bulkModulusPa:g,bulkModulusGPa:g*1e-9,shearModulusPa:_,poissonRatio:F,elasticConstantsGPa:Object.freeze({c11:I*1e-9,c12:ee*1e-9,c44:L*1e-9}),soundSpeedLongMPerS:te,soundSpeedTransMPerS:ne,debyeTemperatureK:z,fermiEnergyEv:Ce,bandGapEv:J,isMetal:J===0,dosAtFermiStatesPerEvAtom:qe,mbjCParameter:Me,mbjAvgGradRhoOverRho:je,dftUHubbardEv:Ie,dftUCorrelationEnergyEv:Le,dftUExchangeSplittingEv:Re,spinSplitBandsEv:Be,kPathLabels:_e.map(e=>e.label),bandsEv:be,dosEnergyEv:We,dosValues:Ge,blochDensityGridN:G,blochDensity3d:K,spinUnpairedElectrons:Ne,accuracyTier:n<=100?l.id===`vdw-fcc`||o.fOcc>0?e.TIER_2_REPRESENTATIVE_EFFECTIVE:e.TIER_1_QUANTITATIVE:e.TIER_3_THEORETICAL_ENVELOPE,provenance:Object.freeze({status:`webgpu-derived`,scientificValidation:!1,solver:`gpumath-bloch-pw-fft3d-mbj-dftu-bm3`})})}var _e=`ulg.electromagnetic.closure-webgpu.v1`,H=1602176634e-28,ve=91093837015e-41,ye=88541878128e-22,be=125663706212e-17,U=92740100783e-34,xe=1054571817e-43,Se=1380649e-29,W=1602176634e-28,Ce=27.211386245988;async function G(t,{Z:n,atomResult:r,bulkResult:i,temperatureK:a=300}={}){let o=v(n),s=E(n),c=o.reduce((e,t)=>Math.max(e,t.n),0),l=o.find(e=>e.n===c&&e.l===2),u=l||o.find(e=>e.n===c-1&&e.l===2),d=o.find(e=>e.n===c-2&&e.l===3),f=l?null:o.find(e=>e.n===c&&e.l===0),p=l?null:o.find(e=>e.n===c&&e.l===1),h=u?.occupancy??0,_=d?.occupancy??0,y=f?.occupancy??0,b=p?.occupancy??0,x=s.reduce((e,t)=>e+(t.occUp-t.occDown),0),S=l?1.2:Math.max(1,y+b+.18*Math.min(h,10-h)),C=4*Math.PI/3*(i.wignerSeitzRadiusBohr*m)**3,w=1/Math.max(1e-32,C),T=i.isMetal?S*w:0,D=xe*(i.isMetal?Math.sqrt(T*H*H/(ye*ve)):0)/W,O=1,k=1,A=i.wignerSeitzRadiusBohr,j=!!(u&&u.n>=c-1&&h>0);if(i.isMetal&&!j){if(b===0&&y>=1&&y<=2&&r?.radialGrid?.r&&r?.radialGrid?.rho){let{r:e,rho:t,dx:n}=r.radialGrid,i=0;for(let r=0;r<e.length;r+=1)i+=4*Math.PI*e[r]**3*t[r]*n;let a=0,o=0,s=0,c=Math.max(0,i-y);for(let r=0;r<e.length;r+=1){let i=4*Math.PI*e[r]**3*t[r]*n;a+=i,a>=c&&(o+=e[r]*i,s+=i)}if(s>.15){let e=o/s*.86;Number.isFinite(e)&&e>A&&(A=Math.min(6,e))}}let e=Array.isArray(r?.orbitals)?r.orbitals.find(e=>e.n===c-1&&e.l===1&&Number(e.occupancy??e.occ??0)>=6):null;if(e){let t=Math.max(.28,Math.abs(Number(e.energyHa??e.energy??-.8))),n=1.35/(t*t)*(Math.max(1,e.n)/2)**1.35,r=Math.max(8,Math.max(2,A||3.5)**3);O=1+Math.min(.85,3*n/r)}if(y<=2&&b===0&&c>=4){let e=Math.max(0,c-3);k=1+.046*e*e*(y===1?1:.45)}}let M=4*Math.PI/3*(A*m)**3,N=i.isMetal?S/Math.max(1e-32,M):0,P=i.isMetal?xe*Math.sqrt(N*H*H/(ye*ve))/W:0,F=i.isMetal?P/Math.sqrt(O*k):0,I=Math.max(0,Number(i.dftUHubbardEv||0)),ee=Number.isFinite(Number(i.mbjCParameter))?Number(i.mbjCParameter):null,L=((c===4&&h>0&&h<10?.92:_>0&&_<14?.58:h>0&&h<10?.55:.25)+.045*Math.min(6,I))*(.5*(i.dosAtFermiStatesPerEvAtom||0)),te=Math.max(.25,i.isMetal?Math.max(.5,n-S):n)*(.55*m)**2;if(r?.radialGrid?.r&&r?.radialGrid?.rho){let{r:e,rho:t,dx:n}=r.radialGrid,a=0;for(let r=0;r<e.length;r+=1)a+=4*Math.PI*e[r]**3*t[r]*n;let o=i.isMetal?Math.max(0,a-S):1/0,s=0,c=0;for(let r=0;r<e.length;r+=1){let i=4*Math.PI*e[r]**3*t[r]*n;if(s>=o)break;let a=s+i>o?Math.max(0,(o-s)/Math.max(1e-12,i)):1;c+=e[r]*e[r]*i*a,s+=i}Number.isFinite(c)&&c>0&&(te=c*m**2)}let ne=-(w*be*H*H*te)/(6*ve),re=i.isMetal?be*U*U*(i.dosAtFermiStatesPerEvAtom/W)*w:0,ie=!i.isMetal&&(i.crystalStructure===`diamond`||i.crystalStructure===`zincblende`)?0:x,ae=`diamagnetic`,R=0,z=0,oe=ne+2/3*re;i.isMetal&&c===4&&h>=6&&h<=8&&L>.85?(ae=`ferromagnetic`,R=Math.max(.55,(10-h)*.62-.12),z=Math.max(350,320*R*L),oe=a>z?be*w*(R*U)**2/(3*Se*Math.max(10,a-z)):1e3):i.isMetal&&_>=6&&_<=11?(ae=`ferromagnetic`,R=x*.95,z=Math.max(20,42*(x*(x+2))/20),oe=a>z?be*w*(R*U)**2/(3*Se*Math.max(10,a-z)):500):i.isMetal&&c===4&&(h===4||h===5)?(ae=`antiferromagnetic`,R=.6+.35*(h-4),z=h===5?210:120,oe=be*w*(R*U)**2/(3*Se*(a+z))):ie>0&&!i.isMetal?(ae=`paramagnetic`,R=Math.sqrt(ie*(ie+2)),oe=ne+be*w*(R*U)**2/(3*Se*Math.max(1,a))):oe>0&&(ae=`paramagnetic`);let B=Math.max(30,i.debyeTemperatureK||250),se=i.isMetal?Math.max(.08,Math.min(1.8,.14+.16*(i.dosAtFermiStatesPerEvAtom||.5)*(300/B))):0,V=0;if(i.isMetal){let e=a/B,t=e>=.4?1:(e/.4)**4,n=Math.max(1e11,2*Math.PI*se*Se*a/xe*t);V=T*H*H/(ve*n)}else{let e=i.bandGapEv*W,t=2*(ve*Se*a/(2*Math.PI*xe*xe))**1.5*Math.exp(-e/(2*Se*Math.max(1,a))),n=.05*(300/Math.max(10,a))**1.5;V=Math.max(1e-18,t*H*n)}let ce=1/Math.max(1e-20,V),le=Array.isArray(r?.orbitals)?r.orbitals.filter(e=>Number(e.occupancy??1)>0):[],ue=le.length?Math.max(...le.map(e=>Number(e.energyHa??e.energy??-.35))):-.35,de=Math.max(1.8,Math.min(6.5,-ue*Ce*.52+.65)),fe=i.isMetal?1/0:1+((F||10.5)/Math.max(.5,i.bandGapEv*1.4))**2,pe=.12,me=y+b,he=i.dosAtFermiStatesPerEvAtom||.5,ge=h>0&&h<10?.31*he*(450/B)**.35:0,G=me>=2?.18*(me-.85)*(350/Math.max(80,B))**.5*(1+.28*he):0,we=i.isMetal?Math.max(se,Math.min(1.65,.08+ge+G)):0,Te=0;if(i.isMetal&&ae!==`ferromagnetic`&&ae!==`antiferromagnetic`&&we>pe*1.45){let e=-(1.04*(1+we))/Math.max(.05,we-pe*(1+.62*we));Te=Math.max(0,B/1.45*Math.exp(e))}let Ee=[`s`,`p`,`d`,`f`,`g`],K=[];if(i.isMetal&&Array.isArray(r?.orbitals)&&r.orbitals.length>0){let e=Math.max(1e-9,T)*m**3,t=Math.cbrt(3*Math.PI*Math.PI*e),n=Math.sqrt(4*t/Math.PI),a=.5*Ce*n*n,o=r.orbitals.filter(e=>Number(e.occupancy??e.occ??0)>0),s=r.orbitals.filter(e=>Number(e.occupancy??e.occ??0)<2*(2*e.l+1));for(let e of o){if(e.l<2)continue;let t=2*(2*e.l+1),n=Number(e.occupancy??e.occ??0),r=Number.isFinite(e.energyJPlusHa),o=r?e.energyJPlusHa:Number(e.energyHa??e.energy??-.5);for(let c of s){if(c.n===e.n&&c.l===e.l||Math.abs(c.l-e.l)!==1)continue;let s=Number(c.energyHa??c.energy??-.05);if(!(s>o))continue;let l=Math.max(0,Math.min(1.6,.16*Number(i.fermiEnergyEv||0))),u=(s-o)*Ce+l;if(!(u>.2&&u<9.5))continue;let d=2*(2*c.l+1),f=Number(c.occupancy??c.occ??0),p=Math.min(1,Math.max(0,n/t)),m=Math.min(1,Math.max(0,1-f/d)),h=c.l>e.l?(e.l+1)/(2*e.l+1):e.l/(2*e.l+1),g=p*m*h*(e.l===2?1.85:.75);if(!(g>0))continue;let _=Math.max(.22,.1*u+.032*a*Math.sqrt(g)),v=r?`(${2*e.l+1}/2)`:``,y=`${e.n}${Ee[e.l]||e.l}${v}→${c.n}${Ee[c.l]||c.l}`;K.push(Object.freeze({energyEv:u,dampingEv:_,strengthWeight:g,transitionLabel:y}))}}K.sort((e,t)=>e.energyEv-t.energyEv||t.strengthWeight-e.strengthWeight),K.splice(4)}let De=i.isMetal?Math.max(.08,Math.min(2.6,xe*(T*H*H)/Math.max(1e-20,ve*V)/W+(h>0&&h<10?.55:0))):.25,q=null;t&&typeof t.createBuffer==`function`&&(q=(await g(t,[i.isMetal?{mode:0,atomicNumberZ:n,conductionElectronDensityPerM3:Math.max(1e27,T),plasmaEnergyEv:Math.max(1,F),dampingEv:De,interbandOscillators:K,pathLengthM:.1}:{mode:2,atomicNumberZ:n,electronicGapEv:Math.max(.2,i.bandGapEv),pathLengthM:.1}]))?.results?.[0]??null);let Oe=q?.spectralSamples?.find(e=>Math.abs(e.wavelengthNm-550)<=6)||q?.spectralSamples?.[Math.floor((q?.spectralSamples?.length||1)/2)]||null,ke=Array.isArray(q?.baseColorSrgb)&&q.baseColorSrgb.length===3?q.baseColorSrgb.map(e=>Math.max(0,Math.min(1,Number(e)||0))):i.isMetal?[.7,.72,.76]:[.85,.9,.96],Ae=Number.isFinite(Oe?.nRe)&&Oe.nRe>0?Oe.nRe:i.isMetal?1.5:Math.sqrt(Math.max(1,fe)),je=Number.isFinite(Oe?.reflectance)?Oe.reflectance:Number.isFinite(q?.reflectance)?q.reflectance:i.isMetal?.72:.04;return Object.freeze({schema:_e,backend:q?`webgpu`:`analytical-em`,Z:n,temperatureK:a,isMetal:i.isMetal,bandGapEv:i.bandGapEv,plasmaEnergyEv:F,barePlasmaEnergyEv:D,coreDielectricInf:O,drudeDampingEv:De,interbandOscillators:Object.freeze(K),workFunctionEv:de,electronPhononLambda:se,electricalConductivitySPerM:V,electricalResistivityOhmM:ce,staticDielectricConstant:fe,magneticPhase:ae,stonerProduct:L,dftUHubbardEv:I,mbjCParameter:ee,magneticMomentMuB:R,curieOrNeelTempK:z,magneticSusceptibilitySi:oe,superconductingTcK:Te,opticalSrgb:ke,refractiveIndex550Nm:Ae,reflectance550Nm:je,spectralWavelengthsNm:q?.spectralSamples?.map(e=>e.wavelengthNm)??null,spectralReflectance:q?.spectralSamples?.map(e=>e.reflectance??0)??null,spectralNRe:q?.spectralSamples?.map(e=>e.nRe??1)??null,spectralAbsorptionPerM:q?.spectralSamples?.map(e=>e.absorptionPerM??0)??null,accuracyTier:e.TIER_2_REPRESENTATIVE_EFFECTIVE,provenance:Object.freeze({status:q?q.resolverStatus||`webgpu-derived`:`reduced-estimate`,oscillatorSource:q?.oscillatorSource??`none`,scientificValidation:!1,model:`stoner-bloch-gruneisen-kubo-drude-mcmillan`})})}var we=`ulg.thermodynamic.element-md-webgpu.v1`,Te=1380649e-29,Ee=602214076e15,K=1602176634e-28,De=8.314462618,q=2.44300455e-8;function Oe(e,t,n){let r=Math.max(.5,Number(e)),i=Math.max(1,Number(t)),a=i/r,o=0,s=a/32;for(let e=0;e<32;e+=1){let t=(e+.5)*s;if(t>60)continue;let n=Math.exp(t);o+=t*t*t*t*n/((n-1)*(n-1))*s}return 9*Te*(r/i)**3*o/Math.max(1e-30,n)}function ke({Z:e,bulkResult:t}){let n=t.crystalStructure,r=Math.max(2,t.latticeConstantA),i=Math.max(.005,t.cohesiveEnergyEv),a=t.coordinationNumber||12,o=n===`bcc`?r*Math.sqrt(3)/2:n===`diamond`?r*Math.sqrt(3)/4:r/Math.SQRT2;if(n===`vdw-fcc`){let e=o/2**(1/6),t=Math.max(5e-4,i/8.61);return Object.freeze({potentialModel:p.LENNARD_JONES,modelName:`shifted-force-lj-london`,epsilonEv:t,sigmaOrR0A:e,alphaOrLambda:0,rcutA:Math.min(r*1.45,e*2.5),eamAEv:0,eamBeta:0,swGamma:0,rNearestNeighborA:o})}if(n===`diamond`){let e=o/1.1225,t=Math.max(.2,i/2);return Object.freeze({potentialModel:p.STILLINGER_WEBER,modelName:`stillinger-weber-sp3`,epsilonEv:t,sigmaOrR0A:e,alphaOrLambda:21,rcutA:Math.min(r*1.35,e*1.8),eamAEv:0,eamBeta:0,swGamma:1.2,rNearestNeighborA:o})}let s=(t.bulkModulusPa||5e10)/160217663400,c=r**3/(n===`bcc`?2:4),l=.55*i/(.5*a),u=.45*i/Math.sqrt(a),d=v(Math.max(1,Math.min(118,Math.trunc(Number(e)||1)))),f=d.reduce((e,t)=>Math.max(e,t.n),1),m=d.find(e=>e.n===f-2&&e.l===3)?.occupancy??0,h=m>0&&m<14?f>=7?.78:.88:1,g=Math.sqrt(Math.max(.08,9*s*c/Math.max(1e-4,2*a*l*o*o))),_=Math.max(.85,Math.min(2.25,g*h)),y=Math.min(r*1.45,o*1.85),b=_*1.05,x=(n===`bcc`?[[8,1],[6,2/Math.sqrt(3)],[12,Math.sqrt(8/3)],[24,Math.sqrt(11/3)]]:n===`hcp`?[[12,1],[6,Math.SQRT2],[2,Math.sqrt(8/3)],[18,Math.sqrt(3)]]:[[12,1],[6,Math.SQRT2],[24,Math.sqrt(3)]]).map(([e,t])=>({count:e,r:o*t})).filter(e=>e.r<y-1e-4),S=e=>{let t=0;for(let n of x){let r=1-n.r/y;t+=n.count*Math.exp(-b*(n.r-e))*r*r}let n=-u/(2*Math.sqrt(Math.max(t,1e-8))),r=0;for(let t of x){let i=1-t.r/y,a=i*i,o=Math.exp(-_*(t.r-e)),s=l*(o*o-2*o),c=2*l*_*(o-o*o)*a-s*(2*i/y),u=Math.exp(-b*(t.r-e))*(-b*a-2*i/y),d=-c-2*n*u;r+=t.count*t.r*d}return r},C=o+.01/_,w=o+1.8/_;for(;S(w)<0&&w<o+4/_;)w+=.6/_;for(let e=0;e<24;e+=1){let e=.5*(C+w);S(e)<0?C=e:w=e}let T=.5*(C+w);return Object.freeze({potentialModel:p.MORSE_EAM,modelName:`morse-finnis-sinclair-eam`,epsilonEv:l,sigmaOrR0A:T,alphaOrLambda:_,rcutA:y,eamAEv:u,eamBeta:b,swGamma:0,rNearestNeighborA:o,fShellSoftness:h})}async function Ae(t,{Z:n,atomicMassU:r=null,bulkResult:i,emResult:a,temperatureK:s=300,runLiveMd:c=!0,mdSteps:l=20,mdCellsPerSide:u=3}={}){let d=Number(r),f=Number.isFinite(d)&&d>0?d:O[n-1]||D(n)/16605390666e-37,p=f*16605390666e-37,m=f*.001,g=ke({Z:n,bulkResult:i}),_=Math.max(15,i.debyeTemperatureK),v=i.cohesiveEnergyEv*K,y=g.rNearestNeighborA*1e-10,b=p*(Te*_/1054571817e-43)**2*(.095*y)**2/(9*Te),x=i.crystalStructure===`vdw-fcc`?.68*g.epsilonEv*K/Te:.029*v/Te,S=Math.min(.35*x,.085*_),C=i.crystalStructure===`vdw-fcc`?Math.max(1.5,x-S):Math.max(1.5,.55*x+.45*Math.min(x*1.8,b)-.15*S),w=Math.max(1,Math.min(4200,C)),T=Math.max(50,v*Ee*(i.crystalStructure===`vdw-fcc`?.92:.88)),E=i.crystalStructure===`vdw-fcc`?88:104,k=Math.max(w*1.15+2,T/E),A=De*1.15*w/m,j=T/m,M=Oe(s,_,p)+(a?.isMetal?Math.PI*Math.PI/3*Te*Te*((i.dosAtFermiStatesPerEvAtom||.5)/K)/p:0)*s,N=i.crystalStructure===`diamond`?.85:1.75,P=N*M*i.densityKgPerM3/Math.max(1e6,i.bulkModulusPa),F=M+s*i.bulkModulusPa*P*P/Math.max(1,i.densityKgPerM3),I=null;if(c&&t&&typeof t.createBuffer==`function`){let e=Math.max(10,Math.min(s,.65*w)),n=o(t,{...h({crystalStructure:i.crystalStructure,cellsPerSide:u,latticeConstantA:Math.max(2.2,i.latticeConstantA),massU:f,temperatureK:e}),potentialModel:g.potentialModel,epsilonEv:g.epsilonEv,sigmaOrR0A:g.sigmaOrR0A,alphaOrLambda:g.alphaOrLambda,rcutA:g.rcutA,eamAEv:g.eamAEv,eamBeta:g.eamBeta,swGamma:g.swGamma,dtFs:Math.min(2,Math.max(.4,.08*Math.sqrt(f))),targetTemperatureK:e,thermostatCouplingFs:40});try{I=await n.stepBatch(l,{readTelemetry:!0,temperatureK:e})}finally{n.destroy()}}let ee=w;if(I&&Number.isFinite(I.temperatureK)&&I.temperatureK>0){let e=Math.max(0,Number(I.msdA2)||0),t=Math.max(1.2,g.rNearestNeighborA),n=Math.sqrt(e)/t;if(n>1e-4&&n<.45){let e=I.temperatureK*(.1/Math.max(.015,n))**2,t=Math.max(.85,Math.min(1.15,e/Math.max(1,w)));ee=Math.max(1,Math.min(4200,w*(.85+.15*t)))}}let L=ee,te=Math.max(L*1.15+2,k),ne=i.densityKgPerM3*(i.crystalStructure===`diamond`?1.05:.92),re=Math.max(s,w*1.05),ie=Math.max(1e-5,18e-8*Math.sqrt(f*w)/(m/Math.max(1,ne)*1e6)**(2/3)*Math.exp(2.6*(w/re-1))),ae=Math.max(18e-11,g.rNearestNeighborA*92e-12),R=5/(16*Math.sqrt(Math.PI))*Math.sqrt(p*Te*Math.max(s,k))/(ae*ae),z=(p/Math.max(1,ne))**(2/3),oe=Math.max(.001,.16*v/Math.max(1e-21,z)),B=a?.isMetal?q*(a.electricalConductivitySPerM||0)*s:0,se=Math.max(.02,31e-9*f*Math.cbrt(p/Math.max(1,i.densityKgPerM3))*1e10*_**3/Math.max(1,N*N*s)),V=Math.min(2500,B+Math.min(400,se)),ce=1/ne-1/i.densityKgPerM3,le=Math.max(-60,Math.min(180,w*ce/Math.max(1e3,A)*101325*Math.LN10)),ue=Math.max(5,Math.min(900,De*k*k*Math.LN10/Math.max(1e3,T)));return Object.freeze({schema:we,backend:I?`webgpu-md+qha`:`qha-analytical`,Z:n,temperatureK:s,potential:g,heatCapacityCvJPerKgK:M,heatCapacityCpJPerKgK:F,thermalExpansionVolPerK:P,meltingPointK:L,boilingPointK:te,latentHeatFusionJPerKg:A,latentHeatVaporizationJPerKg:j,meltingSlopeKPerLogP:le,boilingSlopeKPerLogP:ue,liquidDensityKgPerM3:ne,dynamicViscosityLiquidPaS:ie,dynamicViscosityGasPaS:R,surfaceTensionNPerM:oe,thermalConductivityWPerMK:V,kElectronicWPerMK:B,kPhononWPerMK:Math.min(400,se),mdTelemetry:I,accuracyTier:n<=100?e.TIER_2_REPRESENTATIVE_EFFECTIVE:e.TIER_3_THEORETICAL_ENVELOPE,provenance:Object.freeze({status:I?`webgpu-derived`:`reduced-estimate`,scientificValidation:!1,model:`dft-fitted-md-qha-wiedemann-franz-andrade`})})}var je=`ulg-periodic-table-engine-webgpu.v1`,Me=Object.freeze({1:{symbol:`H`,bPerAMeV:0,rhoKgM3:88,meltingK:14.01,boilingK:20.28,mag:`diamagnetic`},2:{symbol:`He`,bPerAMeV:7.074,rhoKgM3:145,meltingK:.95,boilingK:4.22,mag:`diamagnetic`},6:{symbol:`C`,bPerAMeV:7.68,rhoKgM3:3515,meltingK:3823,boilingK:4300,mag:`diamagnetic`},10:{symbol:`Ne`,bPerAMeV:8.032,rhoKgM3:1444,meltingK:24.56,boilingK:27.07,mag:`diamagnetic`},11:{symbol:`Na`,bPerAMeV:8.111,rhoKgM3:968,meltingK:370.9,boilingK:1156,mag:`paramagnetic`},13:{symbol:`Al`,bPerAMeV:8.332,rhoKgM3:2700,meltingK:933.5,boilingK:2792,mag:`paramagnetic`},14:{symbol:`Si`,bPerAMeV:8.448,rhoKgM3:2329,meltingK:1687,boilingK:3538,mag:`diamagnetic`},18:{symbol:`Ar`,bPerAMeV:8.595,rhoKgM3:1623,meltingK:83.8,boilingK:87.3,mag:`diamagnetic`},26:{symbol:`Fe`,bPerAMeV:8.79,rhoKgM3:7874,meltingK:1811,boilingK:3134,mag:`ferromagnetic`},29:{symbol:`Cu`,bPerAMeV:8.752,rhoKgM3:8960,meltingK:1358,boilingK:2835,mag:`diamagnetic`},47:{symbol:`Ag`,bPerAMeV:8.554,rhoKgM3:10490,meltingK:1235,boilingK:2435,mag:`diamagnetic`},79:{symbol:`Au`,bPerAMeV:8,rhoKgM3:19300,meltingK:1337,boilingK:3129,mag:`diamagnetic`},80:{symbol:`Hg`,bPerAMeV:7.921,rhoKgM3:13534,meltingK:234.3,boilingK:629.9,mag:`diamagnetic`},82:{symbol:`Pb`,bPerAMeV:7.867,rhoKgM3:11340,meltingK:600.6,boilingK:2022,mag:`diamagnetic`},92:{symbol:`U`,bPerAMeV:7.57,rhoKgM3:19050,meltingK:1405,boilingK:4404,mag:`paramagnetic`}});function Ne(e,t){let n=Me[e]||null;if(!n)return Object.freeze({g7Advisory:!0,hasReference:!1,note:e>100?`Superheavy element: no experimental bulk properties exist (tier-3 theoretical prediction).`:`No checked-in G7 snapshot benchmark row for this Z.`});let r=(e,t)=>t>0?Math.abs(e-t)/t:Math.abs(e-t);return Object.freeze({g7Advisory:!0,hasReference:!0,bindingPerNucleonRelErr:r(t.nuclear.bindingPerNucleonMeV,n.bPerAMeV),densityRelErr:r(t.mechanical.densityKgPerM3,n.rhoKgM3),meltingRelErr:r(t.thermodynamic.meltingPointK,n.meltingK),boilingRelErr:r(t.thermodynamic.boilingPointK,n.boilingK),magneticPhaseMatch:t.electromagnetic.magneticPhase===n.mag,reference:n})}async function Pe(t,n,{massNumberA:i=null,temperatureK:a=300,runNuclearGpuVolume:o=!0,runLiveMd:s=!0,mdSteps:c=16,mdCellsPerSide:l=3,atomicMaxScf:u=55,atomicGridPointsN:d=256,nuclearVolDim:f=24,blochGridN:p=16,functional:m=`pbe`,scalarRelativistic:h=!0,spinOrbit:g=!0,returnOrbitalWavefunctions:_=!1}={}){let y=Math.trunc(Number(n));if(!(y>=1&&y<=118))throw RangeError(`Element atomicNumberZ out of range 1..118: ${n}`);let T=S(y),D=o?await w(t,y,i,{volDim:f}):C(y,i),O=v(y),k=O.map(e=>({...e})),A=(e,t)=>{let n=Math.max(e,t+1);for(;k.some(e=>e.n===n&&e.l===t);)n+=1;k.push({n,l:t,occupancy:0})};for(let e of O)e.occupancy>0&&e.l>=2&&(e.l-1>=0&&A(e.n+1,e.l-1),e.l+1<=4&&A(e.n+1,e.l+1));k.sort((e,t)=>e.n+e.l-(t.n+t.l)||e.n-t.n||e.l-t.l);let j=await ie(t,y,{functional:m,spinOrbit:g,scalarRelativistic:h,configuration:k,nuclearChargeRadiusBohr:D.chargeRadiusBohr,nuclearMassU:D.atomicMassU,nuclearSpinI:D.spinI,nuclearMagneticMomentMuN:D.magneticMomentMuN,gridPointsN:d,rMinBohr:Math.min(1e-4,Math.max(1e-5,D.chargeRadiusBohr*.5)),maxScf:u,returnRadialDensity:!0,returnOrbitalWavefunctions:_}),M=await ge(t,y,j,{densityGridN:p,atomicMassU:D.atomicMassU}),N=await G(t,{Z:y,atomResult:j,bulkResult:M,temperatureK:a}),P=await Ae(t,{Z:y,atomicMassU:D.atomicMassU,bulkResult:M,emResult:N,temperatureK:a,runLiveMd:s,mdSteps:c,mdCellsPerSide:l}),F=y>100?e.TIER_3_THEORETICAL_ENVELOPE:M.accuracyTier===e.TIER_1_QUANTITATIVE?e.TIER_1_QUANTITATIVE:e.TIER_2_REPRESENTATIVE_EFFECTIVE,I=r({materialKey:i==null?T:D.isotope,symbol:T,atomicNumber:y,massNumberA:D.A,isotope:D.isotope,family:`element`,accuracyTier:F,generatorFingerprint:je,nuclear:{isotope:D.isotope,Z:D.Z,N:D.N,A:D.A,bindingEnergyMeV:D.bindingEnergyMeV,bindingPerNucleonMeV:D.bindingPerNucleonMeV,atomicMassU:D.atomicMassU,massExcessMeV:D.massExcessMeV,chargeRadiusFm:D.chargeRadiusFm,chargeRadiusBohr:D.chargeRadiusBohr,spinI:D.spinI,parity:D.parity,shellLabel:D.shellLabel,magneticMomentMuN:D.magneticMomentMuN,fissility:D.fissility,fissionBarrierMeV:D.fissionBarrierMeV,qAlphaMeV:D.qAlphaMeV,qBetaMinusMeV:D.qBetaMinusMeV,qElectronCaptureMeV:D.qElectronCaptureMeV,dominantMode:D.dominantMode,daughterZ:D.daughterZ,daughterA:D.daughterA,log10HalfLifeS:D.log10HalfLifeS},atomic:{configurationString:x(y),configuration:v(y),spinConfiguration:E(y),unpairedElectrons:b(y),totalEnergyHa:j.totalEnergyHa,qedRadiativeShiftHa:j.qedRadiativeShiftHa??0,reducedMassFactor:j.reducedMassFactor??1,isotopeMassShiftHa:j.isotopeMassShiftHa??0,hyperfineSplittingHz:j.hyperfineSplittingHz??0,finiteNucleusUsed:!!j.finiteNucleusUsed,dirac4Component:!!j.dirac4Component,totalSmallComponentNormSq:j.totalSmallComponentNormSq??0,relativisticMethod:j.relativisticMethod,resolverStatus:j.resolverStatus,perScfCpuReadbacks:j.perScfCpuReadbacks,integratedElectrons:j.integratedElectrons,orbitals:j.orbitals},electromagnetic:{isMetal:N.isMetal,bandGapEv:N.bandGapEv,mbjCParameter:M.mbjCParameter??N.mbjCParameter??null,dftUHubbardEv:M.dftUHubbardEv??N.dftUHubbardEv??0,dftUExchangeSplittingEv:M.dftUExchangeSplittingEv??0,fermiEnergyEv:M.fermiEnergyEv,dosAtFermiStatesPerEvAtom:M.dosAtFermiStatesPerEvAtom,plasmaEnergyEv:N.plasmaEnergyEv,drudeDampingEv:N.drudeDampingEv,interbandOscillators:N.interbandOscillators,workFunctionEv:N.workFunctionEv,electricalConductivitySPerM:N.electricalConductivitySPerM,electricalResistivityOhmM:N.electricalResistivityOhmM,staticDielectricConstant:N.staticDielectricConstant,magneticPhase:N.magneticPhase,stonerProduct:N.stonerProduct,magneticMomentMuB:N.magneticMomentMuB,curieOrNeelTempK:N.curieOrNeelTempK,magneticSusceptibilitySi:N.magneticSusceptibilitySi,superconductingTcK:N.superconductingTcK,opticalSrgb:N.opticalSrgb,refractiveIndex550Nm:N.refractiveIndex550Nm,reflectance550Nm:N.reflectance550Nm,spectralWavelengthsNm:N.spectralWavelengthsNm,spectralReflectance:N.spectralReflectance,spectralNRe:N.spectralNRe,oscillatorSource:N.provenance?.oscillatorSource??`none`},mechanical:{crystalStructure:M.crystalStructure,spaceGroup:M.spaceGroup,coordinationNumber:M.coordinationNumber,latticeConstantA:M.latticeConstantA,densityKgPerM3:M.densityKgPerM3,cohesiveEnergyEv:M.cohesiveEnergyEv,bulkModulusPa:M.bulkModulusPa,shearModulusPa:M.shearModulusPa,poissonRatio:M.poissonRatio,elasticConstantsGPa:M.elasticConstantsGPa,soundSpeedLongMPerS:M.soundSpeedLongMPerS,soundSpeedTransMPerS:M.soundSpeedTransMPerS,debyeTemperatureK:M.debyeTemperatureK},thermodynamic:{temperatureK:a,heatCapacityCvJPerKgK:P.heatCapacityCvJPerKgK,heatCapacityCpJPerKgK:P.heatCapacityCpJPerKgK,thermalExpansionVolPerK:P.thermalExpansionVolPerK,meltingPointK:P.meltingPointK,boilingPointK:P.boilingPointK,latentHeatFusionJPerKg:P.latentHeatFusionJPerKg,latentHeatVaporizationJPerKg:P.latentHeatVaporizationJPerKg,meltingSlopeKPerLogP:P.meltingSlopeKPerLogP,boilingSlopeKPerLogP:P.boilingSlopeKPerLogP,liquidDensityKgPerM3:P.liquidDensityKgPerM3,dynamicViscosityLiquidPaS:P.dynamicViscosityLiquidPaS,dynamicViscosityGasPaS:P.dynamicViscosityGasPaS,surfaceTensionNPerM:P.surfaceTensionNPerM,thermalConductivityWPerMK:P.thermalConductivityWPerMK,potentialModel:P.potential.modelName,mdEnergyEv:P.mdTelemetry?.totalEnergyEv??null,mdTempK:P.mdTelemetry?.temperatureK??null,mdPressureGPa:P.mdTelemetry?.pressureGPa??null,mdMsdA2:P.mdTelemetry?.msdA2??null},provenance:{status:N.provenance?.status===`hybrid-webgpu-spectral-cpu-oscillators`?`hybrid-webgpu-spectral-cpu-oscillators`:`webgpu-derived`,scientificValidation:!1,extrapolationPolicy:`fail-closed`}}),ee=Ne(y,I);return Object.freeze({bundle:I,g7Advisory:ee,visualData:Object.freeze({nuclear:D,atom:j,bulk:M,em:N,thermo:P})})}var Fe=`ulg.material-pbr-optics.v1`,Ie=Object.freeze([650,550,450]),Le=Object.freeze([1239.84193/650,1239.84193/550,1239.84193/450]),Re=new Map,ze=new Map;for(let e of c?.records||[]){let t=Math.trunc(Number(e?.atomicNumber));t>=1&&t<=118&&(Re.set(t,e),e.symbol&&ze.set(String(e.symbol).toLowerCase(),e))}function Be(e){return Math.max(0,Math.min(1,Number.isFinite(e)?e:0))}function J(e,t,n){return Math.max(t,Math.min(n,Number.isFinite(e)?e:t))}function Ve(e){let t=Be(e);return t<=.04045?t/12.92:((t+.055)/1.055)**2.4}function He(e,t,n){if(!Array.isArray(e)||!Array.isArray(t)||e.length===0||e.length!==t.length)return null;if(n<=e[0])return Number(t[0]);let r=e.length-1;if(n>=e[r])return Number(t[r]);for(let i=1;i<=r;i+=1){let a=Number(e[i-1]),o=Number(e[i]);if(n>o&&i<r)continue;let s=Math.abs(o-a)>1e-6?(n-a)/(o-a):0;return Number(t[i-1])+(Number(t[i])-Number(t[i-1]))*s}return Number(t[r])}function Ue(e){let t=Math.max(1,Number(e)||1.45),n=(t-1)/(t+1);return J(n*n,.015,.35)}function We({phase:e=`solid`,metallic:t=0,surfaceFinish:n=null}={}){return n===`liquid`||e===`liquid`?t>.5?.08:.06:n===`crystal`?t>.5?.16:.22:n===`machined`?.24:n===`ice`?.28:n===`organic`?.42:n===`regolith`?.84:n===`rock`?.72:t>.65?.2:t>.2?.32:.4}function Ge(e,{phase:t=`solid`,surfaceFinish:n=null,fallbackZ:r=null}={}){let i=e?.electromagnetic||null,a=Math.trunc(Number(e?.atomic?.Z??e?.Z??r??0)),o=a>=1?Re.get(a):null,s=e?.symbol||o?.symbol||null,c=null,u=null,d=`elements-bank-optical-pbr`;if(i&&Array.isArray(i.spectralWavelengthsNm)&&Array.isArray(i.spectralNRe)&&Array.isArray(i.spectralKIm)){let e=Ie.map(e=>He(i.spectralWavelengthsNm,i.spectralNRe,e)),t=Ie.map(e=>He(i.spectralWavelengthsNm,i.spectralKIm,e));e.every(Number.isFinite)&&t.every(Number.isFinite)&&(c=e.map(e=>J(e,.05,8)),u=t.map(e=>J(e,0,12)),d=`gate1-electromagnetic-spectral-nk`)}if(!c&&s){let e=Le.map(e=>_(s,e));e.every(e=>e&&Number.isFinite(e.n)&&Number.isFinite(e.k))&&(c=e.map(e=>J(e.n,.05,8)),u=e.map(e=>J(e.k,0,12)),d=`conductor-optical-constants-nk`)}let f=Number(i?.refractiveIndex550Nm??o?.opticalPbr?.ior??1.48),p=Number(i?.extinctionCoeff550Nm??0);c||(c=[J(f,1,6),J(f,1,6),J(f,1,6)],u=[J(p,0,10),J(p,0,10),J(p,0,10)],i&&(d=`gate1-electromagnetic-550nm`));let m=u[1],h=Number(i?.bandGapEv??e?.bulk?.bandGapEv),g=Number(i?.dcConductivitySPerM??i?.electricalConductivitySPerM),v;if(m>.08||Number.isFinite(h)||Number.isFinite(g)){let e=Be((m-.12)/1.15),t=Number.isFinite(h)?Be(1-h/.85):0,n=Number.isFinite(g)&&g>100?Be((Math.log10(g)-3)/3):0;v=Be(Math.max(e,Math.min(t,Math.max(e,n*.95)))),d===`conductor-optical-constants-nk`&&(v=Math.max(v,.92))}else v=Be(Number(o?.opticalPbr?.metalness??0));let y=Array.isArray(i?.opticalSrgb)&&i.opticalSrgb.length===3?i.opticalSrgb:Array.isArray(o?.opticalPbr?.baseColorSrgb)&&o.opticalPbr.baseColorSrgb.length===3?o.opticalPbr.baseColorSrgb:[.68,.74,.82],b=[Be(y[0]),Be(y[1]),Be(y[2])],x=[Ve(b[0]),Ve(b[1]),Ve(b[2])],S=[0,1,2].map(e=>{let t=l({n:c[e],k:u[e]});return Number.isFinite(t)?J(t,.02,.99):Ue(f)}),C;if(v>.35&&d!==`gate1-electromagnetic-spectral-nk`&&d!==`conductor-optical-constants-nk`){let e=J(Number(i?.reflectance550Nm??S[1]??.72),.35,.98)/Math.max(.15,x[0],x[1],x[2]);C=[J(x[0]*e,.04,.99),J(x[1]*e,.04,.99),J(x[2]*e,.04,.99)]}else{let e=Ue(c[1]);C=[0,1,2].map(t=>J(e*(1-v)+S[t]*v,.02,.99))}let w=Number(o?.opticalPbr?.roughness),T=J(n?We({phase:t,metallic:v,surfaceFinish:n}):Number.isFinite(w)?w:We({phase:t,metallic:v}),.04,.96);return Object.freeze({schema:Fe,source:d,albedoSrgb:Object.freeze(b),albedoLinear:Object.freeze(x),nRgb:Object.freeze(c),kRgb:Object.freeze(u),f0Rgb:Object.freeze(C),metallic:Number(v.toFixed(4)),roughness:Number(T.toFixed(4)),ior:Number(J(c[1],1,4).toFixed(4))})}var Ke=new Map;function qe(e,{phase:t=`solid`,surfaceFinish:n=null,bundle:r=null}={}){if(r?.electromagnetic)return Ge(r,{phase:t,surfaceFinish:n,fallbackZ:e});let i=Math.max(1,Math.min(118,Math.trunc(Number(e)||14))),a=`${i}|${t}|${n||``}`,o=Ke.get(a);if(o)return o;let s=Ge(null,{phase:t,surfaceFinish:n,fallbackZ:i});return Ke.set(a,s),s}function Je({surfZ:e=14,feFrac:t=.22,silicateFrac:n=.52,carbonFrac:r=.08,volatileFrac:i=.04,isMetallicAsteroid:a=!1,isOceanic:o=!1,isIcy:s=!1}={}){let c=qe(26,{surfaceFinish:a?`machined`:`rock`}),l=qe(14,{surfaceFinish:`rock`}),u=qe(6,{surfaceFinish:`rock`}),d=qe(e,{surfaceFinish:s?`ice`:`rock`}),f=Be(t)*(a?1.8:.75),p=Be(n),m=Be(r),h=Be(i)*(s?1.6:.55),g=Math.max(1e-4,f+p+m+h),_=(f*c.metallic+m*.22+p*.04)/g,v=J(a?Math.max(.68,_):e===26?Math.max(.42,_):_*.45,0,.94),y=(f*.34+p*.78+m*.62+h*.28)/g;o&&(y=Math.min(y,.14)),a&&(y=J(y*.58,.22,.48));let b=o?1.333:s?1.31:J(d.ior,1.35,2.45),x=Ue(b),S=[0,1,2].map(e=>J(x*(1-v)+(f*c.f0Rgb[e]+m*u.f0Rgb[e]+p*l.f0Rgb[e])/Math.max(1e-4,f+m+p)*v,.02,.96));return Object.freeze({schema:Fe,source:`ulg-planetary-material-blend`,f0Rgb:Object.freeze(S),metallic:Number(v.toFixed(4)),roughness:Number(J(y,.06,.94).toFixed(4)),ior:Number(b.toFixed(4))})}var Ye=`ulg.electronic.orbital-cloud-webgpu.v1`,Xe=1/137.035999084,Y=512,X=256,Z=Object.freeze({COPY_SRC:4,COPY_DST:8,VERTEX:32,UNIFORM:64,STORAGE:128});function Ze(e){let t=1;for(let n=2;n<=e;n+=1)t*=n;return t}function Qe(e,t){return t<0||t>e?0:Ze(e)/(Ze(t)*Ze(e-t))}function $e(e,t,n){let r=0,i=1;for(let a=0;a<=e;a+=1){let o=a&1?-1:1;r+=o*Qe(e+t,e-a)/Ze(a)*i,i*=n}return r}function et(e,t,n){let r=Math.max(-1,Math.min(1,n)),i=1;if(t>0){let e=Math.sqrt(Math.max(0,(1-r)*(1+r))),n=1;for(let r=1;r<=t;r+=1)i*=-n*e,n+=2}if(e===t)return i;let a=r*(2*t+1)*i;if(e===t+1)return a;let o=0;for(let n=t+2;n<=e;n+=1)o=((2*n-1)*r*a-(n+t-1)*i)/(n-t),i=a,a=o;return o}function tt(e,t,n,r){if(!r)return e;let i=0;for(let e=1;e<t;e+=1)i+=2*e*e;let a=Math.max(0,Math.min(2*t*t,e-i)),o=t>1?i-2*(t-1)*(t-1):0,s=t>1?Math.max(0,Math.min(2*(t-1)*(t-1),e-o-a)):0,c=Math.max(0,a-1),l=Math.max(0,e-a-s),u=n<=1?.85:1,d=n>0?.02*((2*n+1)/Math.max(1,t)):0;return Math.max(1,Math.min(e,e-(.35*c+u*s+l)+d))}function nt(e,t,n,r){if(!r)return e;let i=(Xe*e)**2,a=n<=1?1+i*.36/(Math.max(1,t)*(n+1)):Math.max(.75,1-i*.18/Math.max(1,t));return Math.max(.8,e*a)}function rt({Z:e=26,n:t=3,l:n=2,m:r=0,rGrid:i=null,orbitalU:a=null,screeningExchange:o=!0,relativisticSpinOrbit:s=!0}={}){let c=Math.max(1,Math.min(8,Math.trunc(t))),l=Math.max(0,Math.min(c-1,Math.trunc(n))),u=Math.max(-l,Math.min(l,Math.trunc(r))),d=Math.abs(u),f=new Float32Array(Y),p=new Float32Array(Y),m=new Float32Array(Y),h=new Float32Array(Y),g=(Array.isArray(i)||ArrayBuffer.isView(i))&&i.length>=32,_=(Array.isArray(a)||ArrayBuffer.isView(a))&&a.length===i?.length,v=g&&_,y=6,b=`analytic-laguerre-slater`;if(v){b=`webgpu-kohn-sham-eigenstate`;let e=new Float64Array(i.length),t=0;for(let n=0;n<i.length;n+=1){let r=n===0?i[1]-i[0]:n===i.length-1?i[n]-i[n-1]:.5*(i[n+1]-i[n-1]),o=a[n],s=o*o*Math.max(1e-8,r);e[n]=s,t+=s}let n=0;y=Math.max(1.5,i[i.length-1]*.5);for(let r=0;r<i.length;r+=1)if(n+=e[r],n>=t*.994){y=Math.max(.8,Math.min(36,i[r]*1.15));break}let r=0,o=0,s=0,c=0;for(let e=0;e<Y;e+=1){let t=(e+.5)/Y*y;for(f[e]=t;c+1<i.length&&i[c+1]<t;)c+=1;let n=Math.min(i.length-2,c),l=i[n],u=Math.max(l+1e-9,i[n+1]),d=Math.max(0,Math.min(1,(t-l)/(u-l))),g=a[n]*(1-d)+a[n+1]*d,_=g>=0?1:-1;s!==0&&_!==s&&Math.abs(g)>1e-6&&(o+=1),Math.abs(g)>1e-6&&(s=_),r+=g*g,p[e]=r,m[e]=o,h[e]=_}let l=r>0?1/r:1;for(let e=0;e<Y;e+=1)p[e]*=l}else{let t=nt(tt(e,c,l,o),c,l,s),n=(3*c*c-l*(l+1))/(2*Math.max(.5,t));y=Math.max(1.2,Math.min(42,n*2.55+1.4/Math.sqrt(Math.max(1,t))));let r=Math.sqrt((2*t/c)**3*(Ze(c-l-1)/(2*c*Ze(c+l)))),i=0,a=0,u=0;for(let e=0;e<Y;e+=1){let n=(e+.5)/Y*y;f[e]=n;let o=2*t*n/c,s=$e(c-l-1,2*l+1,o),d=n*(r*Math.exp(-.5*o)*o**+l*s),g=d>=0?1:-1;u!==0&&g!==u&&Math.abs(d)>1e-8&&(a+=1),Math.abs(d)>1e-8&&(u=g),i+=d*d,p[e]=i,m[e]=a,h[e]=g}let d=i>0?1/i:1;for(let e=0;e<Y;e+=1)p[e]*=d}let x=(Xe*tt(e,c,l,o))**2,S=s&&l>0?Math.min(.45,x*.65):0,C=Math.min(l,Math.abs(d===l?Math.max(0,d-1):d+1)),w=new Float32Array(X),T=new Float32Array(X),E=0,D=1;if(S>0){let e=0,t=0;for(let n=0;n<X;n+=1){let r=-1+(n+.5)/X*2,i=et(l,d,r),a=et(l,C,r);e+=i*i,t+=a*a}D=t>1e-12?e/t:1}for(let e=0;e<X;e+=1){let t=-1+(e+.5)/X*2,n=et(l,d,t),r=n*n;if(S>0){let e=et(l,C,t);r=(1-S)*r+S*(e*e*D)}E+=r,w[e]=E,T[e]=n>=0?1:-1}let O=E>0?1/E:1;for(let e=0;e<X;e+=1)w[e]*=O;let k=new Float32Array(Y*4);for(let e=0;e<Y;e+=1)k[e*4+0]=f[e]/Math.max(1e-6,y),k[e*4+1]=p[e],k[e*4+2]=m[e],k[e*4+3]=h[e];let A=new Float32Array(X*2);for(let e=0;e<X;e+=1)A[e*2+0]=w[e],A[e*2+1]=T[e];return Object.freeze({radialPacked:k,polarPacked:A,rExtentBohr:y,n:c,l,m:u,radialNodeCount:Math.max(0,Math.round(m[Y-1])),sourceKind:b})}var it=`
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
`,at=`
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
`,ot=new WeakMap;function st(e){let t=ot.get(e);if(t)return t;let n=e.createShaderModule({label:`ulg-orbital-cloud-sampler`,code:it}),r=e.createComputePipeline({label:`ulg-orbital-cloud-sampler-pipe`,layout:`auto`,compute:{module:n,entryPoint:`sample_orbital_cloud`}}),i=e.createShaderModule({label:`ulg-mol-cloud-sampler`,code:at});return t={atomPipe:r,molPipe:e.createComputePipeline({label:`ulg-mol-cloud-sampler-pipe`,layout:`auto`,compute:{module:i,entryPoint:`sample_molecular_cloud`}}),atomParamsBuf:e.createBuffer({size:32,usage:Z.UNIFORM|Z.COPY_DST}),radialTableBuf:e.createBuffer({size:Y*16,usage:Z.STORAGE|Z.COPY_DST}),polarTableBuf:e.createBuffer({size:X*8,usage:Z.STORAGE|Z.COPY_DST}),molParamsBuf:e.createBuffer({size:32,usage:Z.UNIFORM|Z.COPY_DST}),molAzBuf:null,molAzSize:0,molWBuf:null,molWSize:0},ot.set(e,t),t}function ct(e,{Z:t=26,n=3,l:r=2,m:i=0,pointCount:a=25e4,rGrid:o=null,orbitalU:s=null,screeningExchange:c=!0,relativisticSpinOrbit:l=!0,colorMode:u=0,seed:d=1,reuseBuffer:f=null}={}){let p=Math.max(4096,Math.min(5e5,Math.trunc(a))),m=rt({Z:t,n,l:r,m:i,rGrid:o,orbitalU:s,screeningExchange:c,relativisticSpinOrbit:l}),{atomPipe:h,atomParamsBuf:g,radialTableBuf:_,polarTableBuf:v}=st(e),y=p*16,b=f&&f.size>=y?f:e.createBuffer({label:`ulg-orbital-cloud-pts`,size:y,usage:Z.STORAGE|Z.VERTEX|Z.COPY_SRC}),x=new ArrayBuffer(32),S=new Uint32Array(x),C=new Int32Array(x);S[0]=p>>>0,S[1]=Y>>>0,S[2]=X>>>0,S[3]=d>>>0||1,C[4]=m.m,S[5]=Math.abs(m.m)>>>0,S[6]=u>>>0,S[7]=0,e.queue.writeBuffer(g,0,x),e.queue.writeBuffer(_,0,m.radialPacked),e.queue.writeBuffer(v,0,m.polarPacked);let w=e.createBindGroup({layout:h.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:g}},{binding:1,resource:{buffer:_}},{binding:2,resource:{buffer:v}},{binding:3,resource:{buffer:b}}]}),T=e.createCommandEncoder({label:`ulg-orbital-cloud-sample-enc`}),E=T.beginComputePass();return E.setPipeline(h),E.setBindGroup(0,w),E.dispatchWorkgroups(Math.ceil(p/64)),E.end(),e.queue.submit([T.finish()]),Object.freeze({schema:Ye,pointsBuffer:b,pointCount:p,rExtentBohr:m.rExtentBohr,n:m.n,l:m.l,m:m.m,radialNodeCount:m.radialNodeCount,sourceKind:m.sourceKind})}function lt(e,{posZeta:t,weights:n,boxHalfBohr:r=4,mode:i=0,pointCount:a=16e4,seed:o=1,reuseBuffer:s=null}={}){if(!t||!n||t.length<4)return null;let c=Math.floor(t.length/4),l=Math.max(4096,Math.min(35e4,Math.trunc(a))),u=st(e),{molPipe:d,molParamsBuf:f}=u,p=l*16,m=s&&s.size>=p?s:e.createBuffer({label:`ulg-mol-cloud-pts`,size:p,usage:Z.STORAGE|Z.VERTEX|Z.COPY_SRC}),h=Math.max(16,t.byteLength),g=Math.max(16,n.byteLength);(!u.molAzBuf||u.molAzSize<h)&&(u.molAzBuf=e.createBuffer({size:Math.max(256,h),usage:Z.STORAGE|Z.COPY_DST}),u.molAzSize=Math.max(256,h)),(!u.molWBuf||u.molWSize<g)&&(u.molWBuf=e.createBuffer({size:Math.max(256,g),usage:Z.STORAGE|Z.COPY_DST}),u.molWSize=Math.max(256,g));let _=new ArrayBuffer(32);new Uint32Array(_,0,4).set([l>>>0,c>>>0,i>>>0,o>>>0||1]),new Float32Array(_,16,4).set([Math.max(1,Number(r)||4),0,0,0]),e.queue.writeBuffer(f,0,_),e.queue.writeBuffer(u.molAzBuf,0,t),e.queue.writeBuffer(u.molWBuf,0,n);let v=e.createBindGroup({layout:d.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:f}},{binding:1,resource:{buffer:u.molAzBuf}},{binding:2,resource:{buffer:u.molWBuf}},{binding:3,resource:{buffer:m}}]}),y=e.createCommandEncoder({label:`ulg-mol-cloud-sample-enc`}),b=y.beginComputePass();return b.setPipeline(d),b.setBindGroup(0,v),b.dispatchWorkgroups(Math.ceil(l/64)),b.end(),e.queue.submit([y.finish()]),Object.freeze({schema:Ye,pointsBuffer:m,pointCount:l,boxHalfBohr:Math.max(1,Number(r)||4),mode:i,sourceKind:`webgpu-molecular-rhf`})}function ut(e){return!e||typeof e.registerModule!=`function`?null:{orbitalCloudMod:e.registerModule({method:{model:`quantum-orbital-cloud`,version:`1`},kernel:{sourceModule:`src/runtime/electronicStructure/orbitalPointCloudWebGpu.js`,entryPoint:`sample_orbital_cloud`,workgroupSize:64,wgsl:it},parameterSchema:{Z:{type:`number`,min:1,max:118,required:!0},n:{type:`number`,min:1,max:8,required:!0},l:{type:`number`,min:0,max:7,required:!0},m:{type:`number`,min:-7,max:7},pointCount:{type:`number`,min:4096,max:5e5}},stateLayout:{tensorId:`orbital_points_vec4`,dtype:`f32`,components:4},stepCapsule:async(e,t)=>{let n=t?.device;if(!n)throw Error(`quantum-orbital-cloud@1 requires a WebGPU device`);let r=ct(n,e?.parameters||{});return{status:`ok`,pointCount:r.pointCount,rExtentBohr:r.rExtentBohr,radialNodeCount:r.radialNodeCount,sourceKind:r.sourceKind,pointsBuffer:r.pointsBuffer}}}),tdksPhotonMod:e.registerModule({method:{model:`quantum-tdks-photon`,version:`1`},kernel:{sourceModule:`src/runtime/electronicStructure/orbitalPointCloudWebGpu.js`,entryPoint:`sample_dipole_coupled_pair`,workgroupSize:64,wgsl:dt},parameterSchema:{Z:{type:`number`,min:1,max:118,required:!0},pointCount:{type:`number`,min:4096,max:3e5}},stateLayout:{tensorId:`tdks_dipole_pair_cloud`,dtype:`f32`,components:8},stepCapsule:async(e,t)=>{let n=t?.device;if(!n)throw Error(`quantum-tdks-photon@1 requires a WebGPU device`);let r=ht(n,e?.parameters||{});return{status:`ok`,pointCount:r.pointCount,rExtentBohr:r.rExtentBohr}}})}}var dt=`
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
`,ft=new WeakMap;function pt(e){let t=ft.get(e);if(t)return t;let n=e.createShaderModule({label:`ulg-dipole-pair-sampler`,code:dt});return t={pipe:e.createComputePipeline({label:`ulg-dipole-pair-sampler-pipe`,layout:`auto`,compute:{module:n,entryPoint:`sample_dipole_coupled_pair`}}),paramsBuf:e.createBuffer({size:32,usage:Z.UNIFORM|Z.COPY_DST}),radBuf:e.createBuffer({size:Y*16,usage:Z.STORAGE|Z.COPY_DST}),polBuf:e.createBuffer({size:X*16,usage:Z.STORAGE|Z.COPY_DST})},ft.set(e,t),t}function mt(e,t,n,r,i,a,o,s){let c=new Float32Array(a.length);if((Array.isArray(r)||ArrayBuffer.isView(r))&&r.length>=32&&(Array.isArray(i)||ArrayBuffer.isView(i))&&i.length===r.length){let e=0;for(let t=0;t<a.length;t+=1){let n=a[t];for(;e+1<r.length&&r[e+1]<n;)e+=1;let o=Math.min(r.length-2,e),s=r[o],l=Math.max(s+1e-9,r[o+1]),u=Math.max(0,Math.min(1,(n-s)/(l-s)));c[t]=i[o]*(1-u)+i[o+1]*u}}else{let r=nt(tt(e,t,n,o),t,n,s),i=Math.sqrt((2*r/t)**3*(Ze(t-n-1)/(2*t*Ze(t+n))));for(let e=0;e<a.length;e+=1){let o=a[e],s=2*r*o/t,l=$e(t-n-1,2*n+1,s);c[e]=o*i*Math.exp(-.5*s)*s**+n*l}}let l=0;for(let e=0;e<c.length;e+=1)l+=c[e]*c[e];let u=1/Math.sqrt(Math.max(1e-12,l));for(let e=0;e<c.length;e+=1)c[e]*=u;return c}function ht(e,{Z:t=79,n0:n=5,l0:r=2,n1:i=6,l1:a=1,m:o=0,rGrid:s=null,u0:c=null,u1:l=null,pointCount:u=18e4,screeningExchange:d=!0,relativisticSpinOrbit:f=!0,seed:p=1,reusePosBuffer:m=null,reuseAmpBuffer:h=null}={}){let g=Math.max(8192,Math.min(3e5,Math.trunc(u))),_=Math.max(1,Math.min(8,Math.trunc(n))),v=Math.max(0,Math.min(_-1,Math.trunc(r))),y=Math.max(1,Math.min(8,Math.trunc(i))),b=Math.max(0,Math.min(y-1,Math.trunc(a))),x=Math.max(-Math.min(v,b),Math.min(Math.min(v,b),Math.trunc(o))),S=Math.abs(x),C=rt({Z:t,n:_,l:v,m:x,rGrid:s,orbitalU:c,screeningExchange:d,relativisticSpinOrbit:f}),w=rt({Z:t,n:y,l:b,m:x,rGrid:s,orbitalU:l,screeningExchange:d,relativisticSpinOrbit:f}),T=Math.max(C.rExtentBohr,Math.min(C.rExtentBohr*1.45,w.rExtentBohr)),E=new Float32Array(Y);for(let e=0;e<Y;e+=1)E[e]=(e+.5)/Y*T;let D=mt(t,_,v,s,c,E,d,f),O=mt(t,y,b,s,l,E,d,f),k=new Float32Array(Y*4),A=0;for(let e=0;e<Y;e+=1)A+=.5*(D[e]*D[e]+O[e]*O[e]),k[e*4+0]=E[e]/T,k[e*4+1]=A,k[e*4+2]=D[e],k[e*4+3]=O[e];let j=A>0?1/A:1;for(let e=0;e<Y;e+=1)k[e*4+1]*=j;let M=new Float32Array(X),N=new Float32Array(X),P=0,F=0;for(let e=0;e<X;e+=1){let t=-1+(e+.5)/X*2;M[e]=et(v,S,t),N[e]=et(b,S,t),P+=M[e]*M[e],F+=N[e]*N[e]}let I=1/Math.sqrt(Math.max(1e-12,P/X)),ee=1/Math.sqrt(Math.max(1e-12,F/X)),L=new Float32Array(X*4),te=0;for(let e=0;e<X;e+=1){let t=-1+(e+.5)/X*2,n=M[e]*I,r=N[e]*ee;te+=.5*(n*n+r*r),L[e*4+0]=te,L[e*4+1]=n,L[e*4+2]=r,L[e*4+3]=t}let ne=te>0?1/te:1;for(let e=0;e<X;e+=1)L[e*4+0]*=ne;let{pipe:re,paramsBuf:ie,radBuf:ae,polBuf:R}=pt(e),z=g*16,oe=m&&m.size>=z?m:e.createBuffer({label:`ulg-tdks-pair-pos`,size:z,usage:Z.STORAGE|Z.VERTEX}),B=h&&h.size>=z?h:e.createBuffer({label:`ulg-tdks-pair-amp`,size:z,usage:Z.STORAGE}),se=new ArrayBuffer(32),V=new Uint32Array(se),ce=new Int32Array(se);V[0]=g>>>0,V[1]=Y>>>0,V[2]=X>>>0,V[3]=p>>>0||1,V[4]=S>>>0,ce[5]=x,V[6]=0,V[7]=0,e.queue.writeBuffer(ie,0,se),e.queue.writeBuffer(ae,0,k),e.queue.writeBuffer(R,0,L);let le=e.createBindGroup({layout:re.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:ie}},{binding:1,resource:{buffer:ae}},{binding:2,resource:{buffer:R}},{binding:3,resource:{buffer:oe}},{binding:4,resource:{buffer:B}}]}),ue=e.createCommandEncoder({label:`ulg-tdks-pair-sample`}),de=ue.beginComputePass();return de.setPipeline(re),de.setBindGroup(0,le),de.dispatchWorkgroups(Math.ceil(g/64)),de.end(),e.queue.submit([ue.finish()]),Object.freeze({posBuffer:oe,ampBuffer:B,pointCount:g,rExtentBohr:T,n0:_,l0:v,n1:y,l1:b,m:x,groundSource:C.sourceKind,excitedSource:w.sourceKind})}function gt(e={},{probeWavelengthNm:t=440}={}){let n=1239.841984,r=.6582119569,i=!!e?.isMetal,a=Array.isArray(e?.interbandOscillators)?e.interbandOscillators:[],o=5,s=.45,c=`Valence→Cond`;if(i&&a.length>0){let e=a.find(e=>e.energyEv>=2.2&&e.energyEv<=4.2)||a[0];o=Math.max(.6,Number(e.energyEv)||3),s=Math.max(.22,Number(e.dampingEv)||.55),c=e.transitionLabel||`d→p`}else if(i){let t=Math.max(1.2,Math.min(8.5,Number(e?.plasmaEnergyEv)||4.5));o=t,s=Math.max(.22,Math.min(1.1,(Number(e?.drudeDampingEv)||.25)*1.4)),c=`Plasma/Valence (${t.toFixed(2)} eV)`}else{let t=Math.max(.5,Number(e?.bandGapEv)||5.5);o=Math.max(2.6,t+1.4),s=t<3.4?.4:.14,c=`Valence→Cond (${o.toFixed(1)} eV)`}let l=o/r,u=s/r,d=u*.42,f=1.65,p=[610,535,440,Math.max(380,Math.min(780,Number(t)||440))].map(e=>({wavelengthNm:e,photonEv:n/e,omega:n/e/r,rho01Re:0,rho01Im:0,rho11:0,dipole:0,dipolePrev:0,dipoleAccel:0,absorbedEnergy:0,incidentEnergy:0,eNow:0,radHistory:new Float32Array(128)})),m=0,h=0,g=4.2,_=2.4;function v(e,t){let n=t-g;return Math.exp(n/_*-.5*(n/_))*Math.cos(e.omega*n)}function y(e=null){if(m=0,h=0,e!=null){let t=Math.max(380,Math.min(780,Number(e)||440));p[3].wavelengthNm=t,p[3].photonEv=n/t,p[3].omega=p[3].photonEv/r}for(let e of p)e.rho01Re=0,e.rho01Im=0,e.rho11=0,e.dipole=0,e.dipolePrev=0,e.dipoleAccel=0,e.absorbedEnergy=0,e.incidentEnergy=0,e.eNow=0,e.radHistory.fill(0)}function b(e=.08){let t=e/12;for(let e=0;e<12;e+=1){let n=m+e*t;for(let e of p){let r=f*v(e,n),i=(e,t,n,r)=>{let i=2*n-1;return[-l*t-.5*u*e,l*e-.5*u*t+r*i,-d*n-2*r*t]},[a,o,s]=i(e.rho01Re,e.rho01Im,e.rho11,r),c=f*v(e,n+.5*t),[p,m,h]=i(e.rho01Re+.5*t*a,e.rho01Im+.5*t*o,e.rho11+.5*t*s,c),[g,_,y]=i(e.rho01Re+.5*t*p,e.rho01Im+.5*t*m,e.rho11+.5*t*h,c),b=v(e,n+t),x=f*b,[S,C,w]=i(e.rho01Re+t*g,e.rho01Im+t*_,e.rho11+t*y,x),T=2*e.rho01Re;e.rho01Re+=t/6*(a+2*p+2*g+S),e.rho01Im+=t/6*(o+2*m+2*_+C),e.rho11=Math.max(0,Math.min(.98,e.rho11+t/6*(s+2*h+2*y+w)));let E=2*e.rho01Re,D=(E-T)/t;e.dipoleAccel=(E-2*e.dipole+e.dipolePrev)/Math.max(1e-6,t*t),e.dipolePrev=e.dipole,e.dipole=E,e.eNow=b,e.absorbedEnergy+=Math.max(0,b*D*t),e.incidentEnergy+=b*b*t}}m+=e,h=(h+1)%128;for(let e of p)e.radHistory[h]=Math.max(-2.5,Math.min(2.5,-e.dipoleAccel*.045));m>13.5&&y()}return Object.freeze({transEv:o,gammaEv:s,transLabel:c,historyLen:128,channels:p,getTimeFs:()=>m,getHistCursor:()=>h,pulseT0Fs:g,pulseWidthFs:_,reset:y,stepFs:b})}var _t=27.211386245988,vt=.529177210903,yt=51.4220674763;function bt({atomResult:e=null,eFieldVPerA:t=0}={}){let n=Number(t)||0,r=n/yt,i=4,a=24,o=Math.max(1,Number(e?.electronCount)||1);if(e?.radialGrid?.r&&e?.radialGrid?.rho){let{r:t,rho:n,dx:r}=e.radialGrid,s=0,c=0,l=0;for(let e=0;e<t.length;e+=1){let i=4*Math.PI*t[e]**3*n[e]*r;s+=i,c+=i*t[e]**2,l+=i*t[e]**4}s>.1&&(o=s,i=c/s,a=l/s)}let s=Array.isArray(e?.orbitals)?e.orbitals.filter(e=>Number(e.occupancy??1)>0):[],c=s.length?Math.max(...s.map(e=>Number(e.energyHa??e.energy??-.35))):-.35,l=Math.max(.12,-c),u=Math.max(1,Math.sqrt(Math.max(1,a))*.85),d=Math.max(.8,Math.min(450,.55*(4/9*o*i*i)+.45*(2*u/(3*l)))),f=d*vt**3,p=d*r,m=p*2.541746473,h=-.5*d*r*r*_t,g=Math.max(-.65,Math.min(.65,p/Math.max(1.2,Math.sqrt(u)*3)));return Object.freeze({eFieldVPerA:n,eFieldAu:r,alpha0Bohr3:d,alpha0Angstrom3:f,inducedDipoleAu:p,inducedDipoleDebye:m,starkShiftEv:h,starkMixLambda:g,homoBindingEv:l*_t})}async function xt(e,{Z:t,solveAtomFullWebGpu:n,baseConfiguration:r,baseAtomResult:i,functional:a=`pbe`,scalarRelativistic:o=!0,spinOrbit:s=!0,nuclearChargeRadiusBohr:c=null,nuclearMassU:l=null}={}){if(!e||typeof n!=`function`)throw TypeError(`solveDeltaScfIonizationWebGpu requires GPUDevice and solveAtomFullWebGpu.`);let u=(r||[]).map(e=>({...e})),d=-1,f=-1;for(let e=0;e<u.length;e+=1)if((u[e].occupancy||0)>0){let t=u[e].n*10+u[e].l;t>=f&&(f=t,d=e)}if(d<0)return null;let p=u[d],m=`${p.n}${[`s`,`p`,`d`,`f`,`g`][p.l]||p.l}`;u[d].occupancy=Math.max(0,u[d].occupancy-1);let h=await n(e,t,{functional:a,scalarRelativistic:o,spinOrbit:s,configuration:u,nuclearChargeRadiusBohr:c,nuclearMassU:l,maxScf:50,gridPointsN:Math.max(64,Math.min(512,Number(i?.radialGrid?.r?.length)||512)),returnRadialDensity:!0,returnOrbitalWavefunctions:!0}),g=Number(h.totalEnergyHa)-Number(i?.totalEnergyHa??0),_=(i?.orbitals||[]).find(e=>e.n===p.n&&e.l===p.l),v=(h?.orbitals||[]).find(e=>e.n===p.n&&e.l===p.l),y=Number(_?.energyHa??_?.energy),b=Number(v?.energyHa??v?.energy),x=Number.isFinite(y)&&Number.isFinite(b)?-.5*(y+b)*_t:g*_t,S=Math.max(1.5,x);return Object.freeze({Z:t,chargeState:1,removedShell:m,neutralEnergyHa:Number(i?.totalEnergyHa??0),cationEnergyHa:Number(h.totalEnergyHa),rawDeltaScfEv:g*_t,neutralOrbitalEv:Number.isFinite(y)?y*_t:null,cationOrbitalEv:Number.isFinite(b)?b*_t:null,ionizationEnergyEv:S,cationAtom:h})}var St=`ulg.optics.photon-shell-fdtd-2d-webgpu.v1`,Ct=`ulg.nuclear.tunneling-tdse-webgpu.v1`,wt=16384,Tt=2e-8,Et=.5,Dt=Et*Tt/299792458,Ot=6582119569e-25,kt=1239.841984,At=.36,Q=Object.freeze({MAP_READ:1,COPY_SRC:4,COPY_DST:8,UNIFORM:64,STORAGE:128});function jt(e={},{probeWavelengthNm:t=535}={}){let n=!!e?.isMetal,r=n?Math.max(.5,Math.min(24,Number(e?.plasmaEnergyEv)||8)):0,i=n?Math.max(.05,Math.min(4,Number(e?.drudeDampingEv)||Math.max(.15,r/25))):0,a=[];if(n){let t=Array.isArray(e?.interbandOscillators)?e.interbandOscillators:[],n=r*r;for(let e=0;e<Math.min(4,t.length);e+=1){let r=t[e],i=Math.max(.25,Math.min(18,Number(r.energyEv)||3)),o=Math.max(.12,Math.min(6,Number(r.dampingEv)||.45)),s=Math.max(0,Math.min(8,Number(r.strengthWeight)||0)),c=At*n*s/(i*i);a.push({energyEv:i,dampingEv:o,deltaEps:Math.min(25,c),label:r.transitionLabel||`Interband #${e+1}`})}}else{let t=Math.max(.25,Math.min(18,Number(e?.bandGapEv)||5)),n=Number(e?.refractiveIndex550Nm),r=Number.isFinite(n)&&n>=1.005?Math.min(3.8,n):Math.min(3.8,Math.sqrt(1+(13.6/(t+3.47))**2)),i=kt/550,o=Math.max(i*1.48,t+1.65),s=Math.max(.02,r*r-1)*(1-i*i/(o*o));if(a.push({energyEv:o,dampingEv:t<3.4?.42:.06,deltaEps:Math.min(16,Math.max(.02,s)),label:`Valence→Cond UV (${o.toFixed(1)} eV)`}),t<3.35){let e=Math.max(.6,t+.35);a.push({energyEv:e,dampingEv:Math.max(.25,.22*t),deltaEps:Math.min(4,Math.max(.15,(3.4-t)*.6)),label:`Band-Edge (${e.toFixed(2)} eV)`})}}for(;a.length<4;)a.push({energyEv:10,dampingEv:1,deltaEps:0,label:`inactive`});let o=Dt/Ot,s=r*o,c=i*o,l=n?(1-.5*c)/(1+.5*c):0,u=n?s*s/(1+.5*c):0,d=a.map(e=>{let t=e.energyEv*o,n=1.35/Math.sqrt(1+Math.max(0,e.deltaEps)),r=Math.min(t,n),i=e.dampingEv*o,a=1+.5*i;return{a:(1-.5*i)/a,b:r*r/a,c:e.deltaEps,active:+(e.deltaEps>1e-6),...e}}),f=[610,535,440,Math.max(380,Math.min(780,Number(t)||535))],p=f.map(e=>kt/e*o);return Object.freeze({isMetal:n,plasmaEv:r,drudeGammaEv:i,kDrude:l,betaDrude:u,oscillators:Object.freeze(d),wavelengthsNm:Object.freeze(f),omegaDtChannels:Object.freeze(p),expectedIor550:Number(e?.refractiveIndex550Nm)||1,slabX0:64,slabX1:104,incidenceDeg:24})}function Mt(e){let t=Math.max(0,Math.min(1,Number(e)||0));return t<=.0031308?12.92*t:1.055*t**(1/2.4)-.055}function Nt(e,t){let n=kt/Math.max(200,t),r=1,i=0;if(e.isMetal&&e.plasmaEv>0){let t=e.plasmaEv*e.plasmaEv,a=n*n,o=n*e.drudeGammaEv,s=Math.max(1e-30,a*a+o*o);r-=t*a/s,i+=t*o/s}for(let t of e.oscillators){if(!(t.deltaEps>1e-6))continue;let e=t.deltaEps*t.energyEv*t.energyEv,a=t.energyEv*t.energyEv-n*n,o=-t.dampingEv*n,s=Math.max(1e-30,a*a+o*o);r+=e*a/s,i-=e*o/s}let a=Math.hypot(r,i),o=Math.sqrt(Math.max(0,.5*(a+r))),s=Math.sqrt(Math.max(0,.5*(a-r))),c=(o-1)*(o-1)+s*s,l=Math.max(1e-30,(o+1)*(o+1)+s*s);return{nRe:o,kIm:s,reflectance:Math.max(0,Math.min(1,c/l))}}var Pt=`
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
`,Ft=new WeakMap;function It(e){let t=Ft.get(e);if(t)return t;let n=e.createShaderModule({label:`ulg-photon-shell-fdtd-2d-wgsl`,code:Pt}),r=e.createBindGroupLayout({label:`ulg-photon-shell-fdtd-2d-bgl`,entries:[{binding:0,visibility:4,buffer:{type:`uniform`}},{binding:1,visibility:4,buffer:{type:`storage`}},{binding:2,visibility:4,buffer:{type:`storage`}},{binding:3,visibility:4,buffer:{type:`storage`}},{binding:4,visibility:4,buffer:{type:`storage`}},{binding:5,visibility:4,buffer:{type:`storage`}},{binding:6,visibility:4,buffer:{type:`storage`}},{binding:7,visibility:4,buffer:{type:`storage`}},{binding:8,visibility:4,buffer:{type:`storage`}}]}),i=e.createPipelineLayout({bindGroupLayouts:[r]});return t={bgl:r,stepHPipe:e.createComputePipeline({label:`ulg-fdtd2d-step-h`,layout:i,compute:{module:n,entryPoint:`fdtd2d_step_h`}}),stepEPipe:e.createComputePipeline({label:`ulg-fdtd2d-step-e`,layout:i,compute:{module:n,entryPoint:`fdtd2d_step_e_and_shells`}}),reducePipe:e.createComputePipeline({label:`ulg-fdtd2d-reduce`,layout:i,compute:{module:n,entryPoint:`fdtd2d_reduce_observables`}})},Ft.set(e,t),t}function Lt(e,t={},{probeWavelengthNm:n=535,pulseWidthSteps:r=34,pulseT0Steps:i=78}={}){if(!e||typeof e.createComputePipeline!=`function`)throw TypeError(`createPhotonShellOpticsSessionWebGpu requires a valid WebGPU GPUDevice.`);let{bgl:a,stepHPipe:o,stepEPipe:s,reducePipe:c}=It(e),l=wt*4,u=l*4,d=l*16,f=e.createBuffer({label:`ulg-fdtd2d-ez`,size:u,usage:Q.STORAGE|Q.COPY_DST|Q.COPY_SRC}),p=e.createBuffer({label:`ulg-fdtd2d-hx`,size:u,usage:Q.STORAGE|Q.COPY_DST}),m=e.createBuffer({label:`ulg-fdtd2d-hy`,size:u,usage:Q.STORAGE|Q.COPY_DST}),h=e.createBuffer({label:`ulg-fdtd2d-jd`,size:u,usage:Q.STORAGE|Q.COPY_DST}),g=e.createBuffer({label:`ulg-fdtd2d-pcurr`,size:d,usage:Q.STORAGE|Q.COPY_DST}),_=e.createBuffer({label:`ulg-fdtd2d-pprev`,size:d,usage:Q.STORAGE|Q.COPY_DST}),v=e.createBuffer({label:`ulg-fdtd2d-shell`,size:d,usage:Q.STORAGE|Q.COPY_DST|Q.COPY_SRC}),y=e.createBuffer({size:128,usage:Q.STORAGE|Q.COPY_DST|Q.COPY_SRC}),b=e.createBuffer({size:128,usage:Q.MAP_READ|Q.COPY_DST}),x=Array.from({length:24},()=>e.createBuffer({size:144,usage:Q.UNIFORM|Q.COPY_DST})),S=x.map(t=>e.createBindGroup({layout:a,entries:[t,f,p,m,h,g,_,v,y].map((e,t)=>({binding:t,resource:{buffer:e}}))})),C=jt(t,{probeWavelengthNm:n}),w=0,T=null,E=!1,D=new Float32Array(l),O=new Float32Array(l*4),k=new Float32Array(32),A=24*Math.PI/180,j=Math.sin(A),M=Math.cos(A);function N(t,n){let a=new ArrayBuffer(144),o=new Uint32Array(a),s=new Float32Array(a);o[0]=128,o[1]=128,o[2]=4,o[3]=n>>>0,o[4]=C.slabX0,o[5]=C.slabX1,o[6]=18,o[7]=42,o[8]=110,o[9]=36,o[10]=12,o[11]=0,s[12]=Et,s[13]=C.kDrude,s[14]=C.betaDrude,s[15]=i,s[16]=r,s[17]=j,s[18]=M,s[19]=11.5;for(let e=0;e<4;e+=1)s[20+e]=C.omegaDtChannels[e],s[24+e]=C.oscillators[e].a,s[28+e]=C.oscillators[e].b,s[32+e]=C.oscillators[e].c;e.queue.writeBuffer(t,0,a)}function P(n=null,{nextProbeWavelengthNm:r=null}={}){(n||r!=null)&&(C=jt(n||t,{probeWavelengthNm:r??C.wavelengthsNm[3]}),n&&(t=n)),w=0,e.queue.writeBuffer(f,0,D),e.queue.writeBuffer(p,0,D),e.queue.writeBuffer(m,0,D),e.queue.writeBuffer(h,0,D),e.queue.writeBuffer(g,0,O),e.queue.writeBuffer(_,0,O),e.queue.writeBuffer(v,0,O),e.queue.writeBuffer(y,0,k)}P();function F(t=4){let n=Math.max(1,Math.min(24,Math.trunc(t)));for(let e=0;e<n;e+=1)N(x[e],w+e);let r=Math.ceil(l/64),i=e.createCommandEncoder({label:`ulg-fdtd2d-batch`}),a=i.beginComputePass({label:`ulg-fdtd2d-pass`});for(let e=0;e<n;e+=1){let t=S[e];a.setPipeline(o),a.setBindGroup(0,t),a.dispatchWorkgroups(r),a.setPipeline(s),a.setBindGroup(0,t),a.dispatchWorkgroups(r),a.setPipeline(c),a.setBindGroup(0,t),a.dispatchWorkgroups(4)}a.end(),e.queue.submit([i.finish()]),w+=n}async function I({nonBlocking:t=!1}={}){if(E)return null;if(T){if(t)return null;try{await T}catch{}if(E)return null}let n=(async()=>{if(E)return null;let t=e.createCommandEncoder({label:`ulg-fdtd2d-read-obs`});if(t.copyBufferToBuffer(y,0,b,0,128),e.queue.submit([t.finish()]),await b.mapAsync(Q.MAP_READ),E){try{b.unmap()}catch{}return null}let n=new Float32Array(b.getMappedRange().slice(0,128));b.unmap();let r=[];for(let e=0;e<4;e+=1){let t=e*8,i=n[t+0],a=n[t+1],o=n[t+2],s=n[t+3],c=n[t+4],l=n[t+5],u=n[t+6],d=n[t+7],f=i>1e-4,p=f?Math.max(0,Math.min(1.1,a/i)):0,m=f?Math.max(0,Math.min(1.1,o/i)):0,h=f?Math.max(0,Math.min(1.1,s/i)):0,g=C.omegaDtChannels[e]/Et,_=null;if(!C.isMetal&&c>.001&&l>1e-6&&g>1e-5){let e=Math.asin(Math.min(.99,Math.sqrt(l/c)))/g;Number.isFinite(e)&&e>=.95&&e<=5.5&&(_=e)}let v=null,y=null;if(!C.isMetal&&u>.001){let e=Math.atan2(Math.abs(d),u);if(y=e*180/Math.PI,e>.04){let t=j/Math.sin(e);Number.isFinite(t)&&t>=.95&&t<=5.5&&(v=t)}}let b=Nt(C,C.wavelengthsNm[e]);r.push(Object.freeze({wavelengthNm:C.wavelengthsNm[e],photonEv:kt/C.wavelengthsNm[e],fluxInc:i,fluxRef:a,fluxTr:o,fluxAbs:s,reflectance:p,transmittance:m,absorption:h,energyBalance:p+m+h,nPhaseFdtd:_,nSnellFdtd:v,refractAngleDeg:y,nMeasuredFdtd:_??v??null,analyticNRe:b.nRe,analyticKIm:b.kIm,analyticReflectance:b.reflectance}))}let i=Math.max(0,Math.min(1,r[0].reflectance)),a=Math.max(0,Math.min(1,r[1].reflectance)),o=Math.max(0,Math.min(1,r[2].reflectance)),s=[Mt(i),Mt(a),Mt(o)];return Object.freeze({schema:St,stepIndex:w,simTimeFs:w*Dt*0x38d7ea4c68000,isMetal:C.isMetal,plasmaEv:C.plasmaEv,drudeGammaEv:C.drudeGammaEv,oscillators:C.oscillators,channels:Object.freeze(r),emergentReflectedSrgb:Object.freeze(s),analyticReflectedSrgb:Object.freeze([Mt(r[0].analyticReflectance),Mt(r[1].analyticReflectance),Mt(r[2].analyticReflectance)])})})();T=n;try{return await n}finally{T===n&&(T=null)}}async function ee(e=16,{readObs:t=!0}={}){let n=Math.max(1,Math.trunc(e));for(;n>0;){let e=Math.min(24,n);F(e),n-=e}return t?I({nonBlocking:!1}):null}function L(){E=!0;for(let e of[f,p,m,h,g,_,v,y,b,...x])try{e.destroy()}catch{}}return Object.freeze({schema:St,nx:128,ny:128,nCells:wt,nChannels:4,slabX0:64,slabX1:104,eFieldBuffer:f,ezFieldBuffer:f,hxFieldBuffer:p,hyFieldBuffer:m,shellPowerBuffer:v,shellStateBuffer:v,getParams:()=>C,getStepIndex:()=>w,reset:P,stepSync:F,stepBatch:ee,readTelemetry:I,destroy:L})}var $=256,Rt=`
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
  let prev_im = psi_im[i];
  var next_im = prev_im - p.dt_scale * h_re;
  let frac = f32(i) / f32(n - 1u);
  if (frac > p.cap_start) {
    let s = (frac - p.cap_start) / max(0.01, 1.0 - p.cap_start);
    next_im = next_im * exp(-p.cap_strength * s * s);
  }
  psi_im[i] = next_im;
  // Exact Visscher (1991) time-centered conserved probability density P(t_n) = Re(t_n)^2 + Im(t_n - dt/2) * Im(t_n + dt/2)!
  prob_out[i] = max(0.0, psi_re[i] * psi_re[i] + prev_im * next_im);
}
`,zt=new WeakMap;function Bt(e){let t=zt.get(e);if(t)return t;let n=e.createShaderModule({label:`ulg-nuclear-tdse-wgsl`,code:Rt}),r=e.createBindGroupLayout({entries:[{binding:0,visibility:4,buffer:{type:`uniform`}},{binding:1,visibility:4,buffer:{type:`read-only-storage`}},{binding:2,visibility:4,buffer:{type:`storage`}},{binding:3,visibility:4,buffer:{type:`storage`}},{binding:4,visibility:4,buffer:{type:`storage`}}]}),i=e.createPipelineLayout({bindGroupLayouts:[r]});return t={bgl:r,stepRe:e.createComputePipeline({layout:i,compute:{module:n,entryPoint:`tdse_step_re`}}),stepIm:e.createComputePipeline({layout:i,compute:{module:n,entryPoint:`tdse_step_im`}})},zt.set(e,t),t}function Vt(e,t){if(!e||typeof e.createComputePipeline!=`function`)return null;let{bgl:n,stepRe:r,stepIm:i}=Bt(e),a=t?.alphaWkb,o=(Array.isArray(a?.rFm)||ArrayBuffer.isView(a?.rFm))&&a.rFm.length>=8,s=(Array.isArray(a?.vMeV)||ArrayBuffer.isView(a?.vMeV))&&a.vMeV.length===a?.rFm?.length,c=o?a.rFm:Array.from({length:64},(e,t)=>t/63*45),l=s?a.vMeV:c.map(e=>e<6?-20:120/e),u=Math.max(24,Number(c[c.length-1])||45),d=Math.max(2.5,Number(a?.rTouchFm)||(t?.chargeRadiusFm||4)*1.35),f=u/($-1),p=new Float32Array($),m=new Float32Array($),h=1;for(let e=0;e<$;e+=1){let t=e*f;p[e]=t;let n=t/u*(c.length-1),r=Math.max(0,Math.min(c.length-2,Math.floor(n))),i=Math.max(0,Math.min(1,n-r)),a=l[r]*(1-i)+l[r+1]*i;m[e]=a,a>h&&(h=a)}let g=Number(t?.qAlphaMeV),_=Number.isFinite(g)?g>.05:!!a?.tunnelingAllowed,v=_?Math.max(.25,Math.min(h*.92,g)):0,y=Math.max(5,Number(t?.A)||56),b=Math.max(1,y-4),x=197.32698*197.32698/(2*(Number.isFinite(Number(a?.muMeV))&&Number(a.muMeV)>100?Number(a.muMeV):4*b/(4+b)*931.4941)*f*f),S=4*x+Math.max(h,25),C=.35/Math.max(1,S),w=Math.max(4,Math.min($-16,Math.round(d/f))),T=Math.min($-12,w+24);if(_){for(let e=w+1;e<$-4;e+=1)if(m[e]<=v){T=e;break}}else T=$-2;let E=e.createBuffer({size:32,usage:Q.UNIFORM|Q.COPY_DST}),D=e.createBuffer({size:$*4,usage:Q.STORAGE|Q.COPY_DST}),O=e.createBuffer({size:$*4,usage:Q.STORAGE|Q.COPY_DST}),k=e.createBuffer({size:$*4,usage:Q.STORAGE|Q.COPY_DST}),A=e.createBuffer({size:$*4,usage:Q.STORAGE|Q.COPY_DST|Q.COPY_SRC}),j=e.createBuffer({size:$*4,usage:Q.MAP_READ|Q.COPY_DST}),M=new ArrayBuffer(32);new Uint32Array(M,0,4).set([$,w,T,0]),new Float32Array(M,16,4).set([x,C,.88,.08]),e.queue.writeBuffer(E,0,M),e.queue.writeBuffer(D,0,m);let N=e.createBindGroup({layout:n,entries:[E,D,O,k,A].map((e,t)=>({binding:t,resource:{buffer:e}}))}),P=0,F=null,I=!1;function ee(){P=0;let t=new Float32Array($),n=new Float32Array($),r=new Float32Array($),i=new Float32Array($),a=Math.max(1.5,d*.52),o=Math.max(.75,d*.2),s=Math.max(1,Math.min($-2,Math.round(a/f))),c=Math.max(1,-m[s]),l=_?Math.sqrt(Math.max(.1,(v+c*.45)/Math.max(1e-4,x*f*f))):0,u=0;for(let e=1;e<$-1;e+=1){let r=p[e],i=Math.exp(-.5*((r-a)/o)**2);t[e]=i*Math.cos(l*(r-a)),n[e]=i*Math.sin(l*(r-a)),u+=t[e]*t[e]+n[e]*n[e]}let h=1/Math.sqrt(Math.max(1e-12,u));for(let e=0;e<$;e+=1)t[e]*=h,n[e]*=h;for(let e=1;e<$-1;e+=1){let a=t[e+1]-2*t[e]+t[e-1],o=-x*a+m[e]*t[e];r[e]=n[e]-.5*C*o,i[e]=t[e]*t[e]+n[e]*n[e]}e.queue.writeBuffer(O,0,t),e.queue.writeBuffer(k,0,r),e.queue.writeBuffer(A,0,i)}ee();async function L(t=12,{nonBlocking:n=!1}={}){if(I)return null;if(F){if(n)return null;try{await F}catch{}if(I)return null}let a=(async()=>{if(I)return null;let n=Math.max(1,Math.min(64,Math.trunc(t))),a=Math.ceil($/64),o=e.createCommandEncoder({label:`ulg-nuclear-tdse`}),s=o.beginComputePass();for(let e=0;e<n;e+=1)s.setPipeline(r),s.setBindGroup(0,N),s.dispatchWorkgroups(a),s.setPipeline(i),s.setBindGroup(0,N),s.dispatchWorkgroups(a);if(s.end(),o.copyBufferToBuffer(A,0,j,0,$*4),e.queue.submit([o.finish()]),P+=n,await j.mapAsync(Q.MAP_READ),I){try{j.unmap()}catch{}return null}let c=new Float32Array(j.getMappedRange().slice(0,$*4));j.unmap();let l=0,u=0,f=0;for(let e=0;e<$;e+=1)e<=w?l+=c[e]:e<=T?u+=c[e]:f+=c[e];return Object.freeze({schema:Ct,stepCount:P,rGridFm:p,potRawMeV:m,prob:c,qEffMeV:v,rTouchFm:d,pInside:l,pBarrier:u,pTunneled:f})})();F=a;try{return await a}finally{F===a&&(F=null)}}function te(){I=!0;for(let e of[E,D,O,k,A,j])try{e.destroy()}catch{}}return Object.freeze({schema:Ct,rGridFm:p,potRawMeV:m,qEffMeV:v,resetWavepacket:ee,stepBatch:L,destroy:te})}async function Ht({closureRegistry:e,materialKey:t=`unknown`,electromagnetic:n={},telemetry:r=null,closureId:i=null}={}){let a=jt(n),o={closureId:i||`ulg-photon-shell-fdtd-optics:${t}.v1`,closureKind:`optical-photon-shell-fdtd-dispersion`,inputHash:`${t}:metal=${+!!a.isMetal}:wp=${a.plasmaEv.toFixed(3)}:osc=${a.oscillators.filter(e=>e.active).length}`,methodHash:`maxwell-2d-ade-fdtd-drude-lorentz-webgpu.v1`,execution:{mode:`webgpu-2d-maxwell-ade-fdtd`,params:a,measuredChannels:r?.channels??null,emergentReflectedSrgb:r?.emergentReflectedSrgb??null},validity:{wavelengthNm:[380,780],dxMeters:Tt,courant:Et,incidenceDeg:24},provenance:{schema:St,sourceModule:`src/runtime/material/photonShellOpticsWebGpu.js`,scientificValidation:!1}};return{ref:e?await e.store(o):null,artifact:o}}function Ut(e){return!e||typeof e.registerModule!=`function`?null:{opticsMod:e.registerModule({method:{model:`photon-shell-fdtd`,version:`1`},kernel:{sourceModule:`src/runtime/material/photonShellOpticsWebGpu.js`,entryPoint:`fdtd2d_step_e_and_shells`,workgroupSize:64,wgsl:Pt},parameterSchema:{steps:{type:`number`,min:1,max:4096},probeWavelengthNm:{type:`number`,min:380,max:780}},stateLayout:{tensorId:`fdtd2d_em_shell_fields`,dtype:`f32`,components:4},stepCapsule:async(e,t)=>{let n=t?.device;if(!n)throw Error(`photon-shell-fdtd@1 requires a WebGPU device`);let r=e?.parameters||{},i=Lt(n,r.electromagnetic||{},{probeWavelengthNm:r.probeWavelengthNm??535});try{return{status:`ok`,telemetry:await i.stepBatch(r.steps??280,{readObs:!0})}}finally{i.destroy()}}}),tdseMod:e.registerModule({method:{model:`nuclear-tunneling-tdse`,version:`1`},kernel:{sourceModule:`src/runtime/material/photonShellOpticsWebGpu.js`,entryPoint:`tdse_step_re`,workgroupSize:64,wgsl:Rt},parameterSchema:{steps:{type:`number`,min:1,max:2048}},stateLayout:{tensorId:`tdse_wavepacket_prob`,dtype:`f32`,components:1},stepCapsule:async(e,t)=>{let n=t?.device;if(!n)throw Error(`nuclear-tunneling-tdse@1 requires a WebGPU device`);let r=e?.parameters||{},i=Vt(n,r.nuclear||{});try{return{status:`ok`,telemetry:await i.stepBatch(r.steps??48)}}finally{i.destroy()}}})}}var Wt=`peercompute.ulg.simulation-module-registration.v1`;function Gt(e,t=null){return String(e??``).trim()||t}function Kt(e){if(typeof e==`string`)return e.trim()||null;if(!e||typeof e!=`object`)return null;let t=Gt(e.model??e.moduleId??e.id);return t?`${t}@${e.version==null?`1`:String(e.version).trim()}`:null}function qt(e={},t=null){if(!t||typeof t!=`object`)return{ok:!0};if(!e||typeof e!=`object`)return{ok:!1,reason:`parameters-must-be-object`};for(let[n,r]of Object.entries(t)){if(!r||typeof r!=`object`)continue;let t=e[n];if(t===void 0){if(r.required===!0)return{ok:!1,reason:`missing-required-parameter:${n}`};continue}if(r.type===`number`){let e=Number(t);if(!Number.isFinite(e))return{ok:!1,reason:`non-finite-parameter:${n}`};if(r.min!=null&&e<r.min)return{ok:!1,reason:`parameter-below-min:${n}:${e}<${r.min}`};if(r.max!=null&&e>r.max)return{ok:!1,reason:`parameter-above-max:${n}:${e}>${r.max}`}}else if(r.type===`boolean`&&typeof t!=`boolean`)return{ok:!1,reason:`parameter-not-boolean:${n}`};else if(r.type===`string`&&typeof t!=`string`)return{ok:!1,reason:`parameter-not-string:${n}`}}return{ok:!0}}function Jt({createArtifact:e=t}={}){let r=new Map,o=new Map;function s(e,t,{device:n=null,sessionId:r=null}={}){let i=Gt(r,`${e}:default`),a=o.get(i);if(a&&!a.disposed)return a;let s=k({sessionId:i,moduleId:e,device:n,layout:t.stateLayout,initialStep:0});return o.set(i,s),s}function c(e={}){let t=Kt(e.method??e.methodId??e.id);if(!t)throw TypeError(`Simulation module registration requires method ({ model, version }) or methodId`);if(typeof e.stepCapsule!=`function`)throw TypeError(`Simulation module ${t} requires a stepCapsule(capsule, context) function`);let i=Object.freeze({schema:Wt,methodKey:t,method:typeof e.method==`object`&&e.method?Object.freeze({...e.method}):Object.freeze({model:t.split(`@`)[0],version:t.split(`@`)[1]||`1`}),kernel:e.kernel&&typeof e.kernel==`object`?Object.freeze({sourceModule:Gt(e.kernel.sourceModule),entryPoint:Gt(e.kernel.entryPoint,`main`),workgroupSize:Number.isInteger(e.kernel.workgroupSize)?e.kernel.workgroupSize:64,wgslHash:e.kernel.wgsl?n(e.kernel.wgsl):Gt(e.kernel.wgslHash)}):null,parameterSchema:e.parameterSchema&&typeof e.parameterSchema==`object`?Object.freeze({...e.parameterSchema}):Object.freeze({}),stateLayout:e.stateLayout&&typeof e.stateLayout==`object`?Object.freeze({tensorId:Gt(e.stateLayout.tensorId,`state`),dtype:Gt(e.stateLayout.dtype,`f32`),layout:Gt(e.stateLayout.layout,`interleaved`),strideElements:Number(e.stateLayout.strideElements)||1,strideBytes:Number(e.stateLayout.strideBytes)||4,fields:Object.freeze(Array.isArray(e.stateLayout.fields)?[...e.stateLayout.fields]:[])}):Object.freeze({tensorId:`state`,dtype:`f32`,layout:`interleaved`,strideElements:1,strideBytes:4,fields:Object.freeze([])}),scaleRangeM:Array.isArray(e.scaleRangeM)&&e.scaleRangeM.length===2?Object.freeze([Number(e.scaleRangeM[0]),Number(e.scaleRangeM[1])]):null,supportsResidentStep:typeof e.stepResident==`function`,registeredAt:new Date().toISOString()});return r.set(t,{descriptor:i,stepCapsule:e.stepCapsule,stepResident:typeof e.stepResident==`function`?e.stepResident:null,reset:typeof e.reset==`function`?e.reset:null,dispose:typeof e.dispose==`function`?e.dispose:null}),i}function l(e){let t=Kt(e);return t&&r.get(t)||null}function u(e){return l(e)!==null}function d(){return[...r.values()].map(e=>e.descriptor)}function f(e){let t=Kt(e);if(!t||!r.has(t))return!1;let n=r.get(t);for(let[e,n]of[...o.entries()])n.moduleId===t&&(n.dispose(),o.delete(e));return n.dispose?.(),r.delete(t),!0}function p(e,{device:t=null,sessionId:n=null}={}){let r=l(e);if(!r)throw RangeError(`Unregistered simulation module: ${Kt(e)||`missing`}`);return s(r.descriptor.methodKey,r.descriptor,{device:t,sessionId:n})}async function m(e,{sessionId:t=null,nextStep:n=0,destroyBuffers:r=!0,reason:i=`module-session-reset`}={}){let a=l(e);if(!a)throw RangeError(`Unregistered simulation module: ${Kt(e)||`missing`}`);let o=s(a.descriptor.methodKey,a.descriptor,{sessionId:t}),c=o.reset({nextStep:n,destroyBuffers:r,reason:i});return a.reset&&await a.reset({session:o,receipt:c,nextStep:n,reason:i}),c}async function h(t,{device:n=null,gpuLease:r=null,sessionId:o=null}={}){if(!t||t.serviceId!==i.ulgRuntime||t.taskKind!==a.simulationStep)return{matched:!1,reason:`not-ulg-runtime-simulation-step`};let c=l(t.method);if(!c)return{matched:!1,reason:`method-not-registered`};if(!t.taskId||!t.inputHash||!t.methodHash||!t.provenance)throw TypeError(`Registered simulation.step capsule requires taskId, inputHash, methodHash, and provenance`);let u=qt(t.input?.parameters,c.descriptor.parameterSchema);if(!u.ok){let e=RangeError(`Invalid simulation parameters for ${c.descriptor.methodKey}: ${u.reason}`);throw e.code=`ERR_INVALID_SIMULATION_MODULE_PARAMETERS`,e}let d=s(c.descriptor.methodKey,c.descriptor,{device:n,sessionId:o??t.input?.sessionId??null}),f=await c.stepCapsule(t,{createSimulationArtifact:e,device:n,gpuLease:r,leaseSession:d,moduleDescriptor:c.descriptor}),p=f?.artifact??f,m=f?.leaseHandle??null,h=d.summary(),g=p&&typeof p==`object`?{...p,execution:{...p.execution||{},registeredModule:c.descriptor.methodKey,gpuLeaseStatus:r?.status??p.execution?.gpuLeaseStatus??null,residentLeaseSession:h}}:p;return{matched:!0,methodKey:c.descriptor.methodKey,artifact:g,leaseHandle:m,leaseSession:d,leaseSummary:h}}return Object.freeze({schema:Wt,registerModule:c,resolveModule:l,hasModule:u,listModules:d,unregisterModule:f,getModuleLeaseSession:p,resetModuleSession:m,dispatchSimulationStepCapsule:h})}var Yt=Jt();export{Ut as a,ut as c,lt as d,xt as f,ie as g,Pe as h,Ht as i,ct as l,Je as m,Vt as n,bt as o,Ge as p,Lt as r,gt as s,Yt as t,ht as u};