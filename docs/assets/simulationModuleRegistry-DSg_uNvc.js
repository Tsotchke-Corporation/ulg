import{Ct as e,Ja as t,Tt as n,Ya as r,nt as i}from"./molecularHartreeFockWebGpu-CyJBJHqW.js";import{n as a,t as o}from"./serviceContract-GK6UWqFx.js";import{i as s}from"./residentBufferLease-EzWfR0Bs.js";var c=`peercompute.ulg.radial-kohn-sham-webgpu.v1`,l=128,u=1,d=`
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
`,f=`
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
`,p=`
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
`,m=`
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
`;function h(e){let t=2166136261,n=2654435769;for(let r=0;r<e.length;r+=1){let i=e.charCodeAt(r);t=Math.imul(t^i,16777619)>>>0,n=Math.imul(n^i+r,2246822507)>>>0}return`wgsl-fnv1a64:${t.toString(16).padStart(8,`0`)}${n.toString(16).padStart(8,`0`)}`}var g=h(`${d}::${f}::${p}::${m}`),_=new WeakMap;function v(e){let t=_.get(e);if(t)return t;let n=e.createShaderModule({label:`ulg-ks-potential-wgsl`,code:d}),r=e.createShaderModule({label:`ulg-ks-observables-wgsl`,code:f}),i=e.createShaderModule({label:`ulg-ks-spinorbit-wgsl`,code:p}),a=e.createShaderModule({label:`ulg-ks-eigensolver-wgsl`,code:m}),o=e.createBindGroupLayout({label:`ulg-ks-pot-bgl`,entries:[{binding:0,visibility:4,buffer:{type:`uniform`}},{binding:1,visibility:4,buffer:{type:`read-only-storage`}},{binding:2,visibility:4,buffer:{type:`storage`}},{binding:3,visibility:4,buffer:{type:`storage`}},{binding:4,visibility:4,buffer:{type:`storage`}},{binding:5,visibility:4,buffer:{type:`storage`}},{binding:6,visibility:4,buffer:{type:`storage`}}]}),s=e.createBindGroupLayout({label:`ulg-ks-obs-bgl`,entries:[{binding:0,visibility:4,buffer:{type:`uniform`}},{binding:1,visibility:4,buffer:{type:`read-only-storage`}},{binding:2,visibility:4,buffer:{type:`read-only-storage`}},{binding:3,visibility:4,buffer:{type:`read-only-storage`}},{binding:4,visibility:4,buffer:{type:`storage`}},{binding:5,visibility:4,buffer:{type:`read-only-storage`}},{binding:6,visibility:4,buffer:{type:`read-only-storage`}},{binding:7,visibility:4,buffer:{type:`storage`}}]}),c=e.createBindGroupLayout({label:`ulg-ks-so-bgl`,entries:[{binding:0,visibility:4,buffer:{type:`uniform`}},{binding:1,visibility:4,buffer:{type:`read-only-storage`}},{binding:2,visibility:4,buffer:{type:`read-only-storage`}},{binding:3,visibility:4,buffer:{type:`read-only-storage`}},{binding:4,visibility:4,buffer:{type:`read-only-storage`}},{binding:5,visibility:4,buffer:{type:`storage`}}]}),l=e.createBindGroupLayout({label:`ulg-ks-eig-bgl`,entries:[{binding:0,visibility:4,buffer:{type:`uniform`}},{binding:1,visibility:4,buffer:{type:`read-only-storage`}},{binding:2,visibility:4,buffer:{type:`read-only-storage`}},{binding:3,visibility:4,buffer:{type:`read-only-storage`}},{binding:4,visibility:4,buffer:{type:`read-only-storage`}},{binding:5,visibility:4,buffer:{type:`storage`}},{binding:6,visibility:4,buffer:{type:`storage`}},{binding:7,visibility:4,buffer:{type:`storage`}},{binding:8,visibility:4,buffer:{type:`storage`}}]});return t={potPipeline:e.createComputePipeline({label:`ulg-ks-pot-pipe`,layout:e.createPipelineLayout({bindGroupLayouts:[o]}),compute:{module:n,entryPoint:`ks_hartree_pbe_xc`}}),obsPipeline:e.createComputePipeline({label:`ulg-ks-obs-pipe`,layout:e.createPipelineLayout({bindGroupLayouts:[s]}),compute:{module:r,entryPoint:`ks_density_and_observables`}}),soPipeline:e.createComputePipeline({label:`ulg-ks-so-pipe`,layout:e.createPipelineLayout({bindGroupLayouts:[c]}),compute:{module:i,entryPoint:`ks_spin_orbit_quadrature`}}),packAuxPipeline:e.createComputePipeline({label:`ulg-ks-pack-aux-pipe`,layout:e.createPipelineLayout({bindGroupLayouts:[l]}),compute:{module:a,entryPoint:`ks_pack_aux`}}),eigPipeline:e.createComputePipeline({label:`ulg-ks-eig-pipe`,layout:e.createPipelineLayout({bindGroupLayouts:[l]}),compute:{module:a,entryPoint:`ks_solve_radial_orbitals`}}),potBgl:o,obsBgl:s,soBgl:c,eigBgl:l},_.set(e,t),t}async function y(t,r,{functional:a=`pbe`,spinOrbit:o=!0,configuration:s=null,gridPointsN:l=256,rMinBohr:d=1e-5,rMaxBohr:f=null,mixing:p=.25,maxScf:m=80,tol:h=1e-4,returnRadialDensity:_=!0}={}){if(!t||typeof t.createComputePipeline!=`function`)throw TypeError(`solveAtomWebGpu requires a valid WebGPU GPUDevice.`);let y=Math.min(256,Math.max(64,Math.floor(l))),b=+(String(a||`pbe`).toLowerCase()===`pbe`),x=f??Math.max(20,60/Math.sqrt(r)),S=Math.log(d),C=(Math.log(x)-S)/(y-1),w=new Float64Array(y),T=new Float32Array(y),E=new Float32Array(y);for(let e=0;e<y;e+=1){let t=Math.exp(S+e*C);w[e]=t,T[e]=t,E[e]=r*(r**3/Math.PI)*Math.exp(-2*r*t)}let D=s??e(r),O=new Map;for(let e of D)O.set(e.l,Math.max(O.get(e.l)||0,e.n-e.l));let k=D.length,{potPipeline:A,obsPipeline:ee,soPipeline:te,potBgl:ne,obsBgl:re,soBgl:j}=v(t),M=y*4,N=new ArrayBuffer(32),P=new Uint32Array(N),F=new Float32Array(N);P[0]=y,P[1]=b,F[2]=r,F[3]=C,F[4]=p,P[5]=k;let I=t.createBuffer({size:32,usage:72}),L=t.createBuffer({size:M,usage:136}),R=t.createBuffer({size:M,usage:140}),ie=t.createBuffer({size:M,usage:132}),ae=t.createBuffer({size:M,usage:132}),oe=t.createBuffer({size:M,usage:132}),se=t.createBuffer({size:M,usage:132}),z=t.createBuffer({size:M*4,usage:136}),B=t.createBuffer({size:Math.max(1,k)*M,usage:136}),V=t.createBuffer({size:Math.max(1,k)*16,usage:136}),H=t.createBuffer({size:16,usage:132}),U=t.createBuffer({size:Math.max(1,k)*16,usage:132}),W=t.createBuffer({size:M*3,usage:9}),G=t.createBuffer({size:16,usage:9}),K=t.createBuffer({size:M+Math.max(1,k)*16,usage:9});try{t.queue.writeBuffer(I,0,N),t.queue.writeBuffer(L,0,T),t.queue.writeBuffer(R,0,E);let e=t.createBindGroup({layout:ne,entries:[{binding:0,resource:{buffer:I}},{binding:1,resource:{buffer:L}},{binding:2,resource:{buffer:R}},{binding:3,resource:{buffer:ie}},{binding:4,resource:{buffer:ae}},{binding:5,resource:{buffer:oe}},{binding:6,resource:{buffer:se}}]}),a=t.createBindGroup({layout:re,entries:[{binding:0,resource:{buffer:I}},{binding:1,resource:{buffer:L}},{binding:2,resource:{buffer:B}},{binding:3,resource:{buffer:V}},{binding:4,resource:{buffer:R}},{binding:5,resource:{buffer:ie}},{binding:6,resource:{buffer:z}},{binding:7,resource:{buffer:H}}]}),s=t.createBindGroup({layout:j,entries:[{binding:0,resource:{buffer:I}},{binding:1,resource:{buffer:L}},{binding:2,resource:{buffer:B}},{binding:3,resource:{buffer:V}},{binding:4,resource:{buffer:se}},{binding:5,resource:{buffer:U}}]}),l=new Map,d=new Float32Array(k*y),f=new Float32Array(k*4),p=new Float32Array(y*4),v=new Float64Array(y),x=new Map,S=0,P=1/0,F={integratedElectrons:0,eHartreeDouble:0,eXcCorrection:0,scfL1Delta:0};for(let n=0;n<m;n+=1){S=n+1;let o=t.createCommandEncoder(),s=o.beginComputePass();s.setPipeline(A),s.setBindGroup(0,e),s.dispatchWorkgroups(1,1,1),s.end(),o.copyBufferToBuffer(ae,0,W,0,M),o.copyBufferToBuffer(oe,0,W,M,M),o.copyBufferToBuffer(se,0,W,M*2,M),t.queue.submit([o.finish()]),await W.mapAsync(u);let c=new Float32Array(W.getMappedRange().slice(0));W.unmap();for(let e=0;e<y;e+=1)p[e*4+0]=c[e],p[e*4+1]=c[y+e],p[e*4+2]=c[y*2+e],p[e*4+3]=0,v[e]=c[y*2+e];x=new Map;for(let[e,t]of O){let n=i(v,w,C,e,t,r,l.get(e));l.set(e,n.map(e=>e.energyHa)),x.set(e,n)}for(let e=0;e<k;e+=1){let t=D[e],n=x.get(t.l)[t.n-t.l-1];f[e*4+0]=t.n,f[e*4+1]=t.l,f[e*4+2]=t.occupancy,f[e*4+3]=n.energyHa;let r=e*y;for(let e=0;e<y;e+=1)d[r+e]=n.u[e]}t.queue.writeBuffer(z,0,p),t.queue.writeBuffer(B,0,d),t.queue.writeBuffer(V,0,f);let m=t.createCommandEncoder(),g=m.beginComputePass();g.setPipeline(ee),g.setBindGroup(0,a),g.dispatchWorkgroups(1,1,1),g.end(),m.copyBufferToBuffer(H,0,G,0,16),t.queue.submit([m.finish()]),await G.mapAsync(u);let _=new Float32Array(G.getMappedRange().slice(0));if(G.unmap(),F={integratedElectrons:_[0],eHartreeDouble:_[1],eXcCorrection:_[2],scfL1Delta:_[3]},P=F.scfL1Delta,P<h&&n>6)break}let q=t.createCommandEncoder(),J=q.beginComputePass();J.setPipeline(te),J.setBindGroup(0,s),J.dispatchWorkgroups(Math.max(1,k),1,1),J.end(),q.copyBufferToBuffer(R,0,K,0,M),q.copyBufferToBuffer(U,0,K,M,Math.max(1,k)*16),t.queue.submit([q.finish()]),await K.mapAsync(u);let Y=new Float32Array(K.getMappedRange().slice(0));K.unmap();let ce=Array.from(Y.slice(0,y)),X=Y.slice(y),Z=0,Q=0,le=[];for(let e=0;e<k;e+=1){let t=D[e],n=x.get(t.l)[t.n-t.l-1];Z+=t.occupancy*n.energyHa,Q+=t.occupancy;let r={n:t.n,l:t.l,occupancy:t.occupancy,energyHa:n.energyHa};o&&t.l>=1&&(r.spinOrbitXiHa=X[e*4+0],r.spinOrbitSplittingHa=X[e*4+1],r.energyJMinusHa=X[e*4+2],r.energyJPlusHa=X[e*4+3]),le.push(r)}let ue=Z-F.eHartreeDouble+F.eXcCorrection;return{schema:c,symbol:n(r),atomicNumberZ:r,configuration:D,functional:b?`pbe`:`lda`,relativisticMethod:o?`koelling-harmon+spin-orbit`:`koelling-harmon`,totalEnergyHa:ue,orbitals:le,electronCount:Q,integratedElectrons:F.integratedElectrons,scfIterations:S,scfL1Delta:P,resolverStatus:`hybrid-webgpu-potential-cpu-eigensolver`,webgpuProgramHash:g,..._?{radialGrid:{r:Array.from(w),rho:ce,dx:C}}:{},validation:Object.freeze({scientificValidation:!1,webgpuParity:!1})}}finally{I.destroy(),L.destroy(),R.destroy(),ie.destroy(),ae.destroy(),oe.destroy(),se.destroy(),z.destroy(),B.destroy(),V.destroy(),H.destroy(),U.destroy(),W.destroy(),G.destroy(),K.destroy()}}async function b(t,r,{functional:i=`pbe`,spinOrbit:a=!0,scalarRelativistic:o=!1,nuclearChargeRadiusBohr:s=0,nuclearMassU:d=null,nuclearSpinI:f=0,nuclearMagneticMomentMuN:p=0,configuration:m=null,gridPointsN:h=256,rMinBohr:_=1e-4,rMaxBohr:y=null,mixing:b=.25,maxScf:x=60,returnRadialDensity:S=!0,returnOrbitalWavefunctions:C=!1}={}){if(!t||typeof t.createComputePipeline!=`function`)throw TypeError(`solveAtomFullWebGpu requires a valid WebGPU GPUDevice.`);let w=Math.min(256,Math.max(64,Math.floor(h))),T=String(i||`pbe`).toLowerCase(),E=T===`bare`?2:+(T===`pbe`),D=o?a?2:1:0,O=Math.max(0,Number(s)||0),k=y??Math.max(20,60/Math.sqrt(r)),A=Math.log(_),ee=(Math.log(k)-A)/(w-1),te=new Float64Array(w),ne=new Float32Array(w),re=new Float32Array(w);for(let e=0;e<w;e+=1){let t=Math.exp(A+e*ee);te[e]=t,ne[e]=t,re[e]=r*(r**3/Math.PI)*Math.exp(-2*r*t)}let j=m??e(r),M=j.length,N=new Float32Array(Math.max(1,M)*4);for(let e=0;e<M;e+=1)N[e*4+0]=j[e].n,N[e*4+1]=j[e].l,N[e*4+2]=j[e].occupancy,N[e*4+3]=-(r*r)/(2*j[e].n*j[e].n);let{potPipeline:P,obsPipeline:F,soPipeline:I,packAuxPipeline:L,eigPipeline:R,potBgl:ie,obsBgl:ae,soBgl:oe,eigBgl:se}=v(t),z=w*4,B=new ArrayBuffer(32),V=new Uint32Array(B),H=new Float32Array(B);V[0]=w,V[1]=E,H[2]=r,H[3]=ee,H[4]=b,V[5]=M,V[6]=D,H[7]=O;let U=t.createBuffer({size:32,usage:72}),W=t.createBuffer({size:z,usage:136}),G=t.createBuffer({size:z,usage:140}),K=t.createBuffer({size:z,usage:l}),q=t.createBuffer({size:z,usage:l}),J=t.createBuffer({size:z,usage:l}),Y=t.createBuffer({size:z,usage:l}),ce=t.createBuffer({size:z*4,usage:l}),X=t.createBuffer({size:Math.max(1,M)*z,usage:C?132:l}),Z=t.createBuffer({size:Math.max(1,M)*16,usage:140}),Q=t.createBuffer({size:Math.max(1,M)*16,usage:132}),le=t.createBuffer({size:16,usage:132}),ue=t.createBuffer({size:Math.max(1,M)*16,usage:132}),de=C?Math.max(1,M)*z:0,fe=Math.max(1,M)*16,pe=16+fe*3+z+de,$=t.createBuffer({size:pe,usage:9});try{t.queue.writeBuffer(U,0,B),t.queue.writeBuffer(W,0,ne),t.queue.writeBuffer(G,0,re),t.queue.writeBuffer(Z,0,N);let e=t.createBindGroup({layout:ie,entries:[U,W,G,K,q,J,Y].map((e,t)=>({binding:t,resource:{buffer:e}}))}),i=t.createBindGroup({layout:se,entries:[U,W,q,J,Y,ce,X,Z,Q].map((e,t)=>({binding:t,resource:{buffer:e}}))}),o=t.createBindGroup({layout:ae,entries:[U,W,X,Z,G,K,ce,le].map((e,t)=>({binding:t,resource:{buffer:e}}))}),s=t.createBindGroup({layout:oe,entries:[U,W,X,Z,Y,ue].map((e,t)=>({binding:t,resource:{buffer:e}}))}),l=t.createCommandEncoder({label:`ulg-ks-full-webgpu-scf`}),m=l.beginComputePass({label:`ulg-ks-full-webgpu-scf-pass`}),h=Math.max(1,Math.min(120,Math.floor(x)));for(let t=0;t<h;t+=1)m.setPipeline(P),m.setBindGroup(0,e),m.dispatchWorkgroups(1,1,1),m.setPipeline(L),m.setBindGroup(0,i),m.dispatchWorkgroups(1,1,1),m.setPipeline(R),m.setBindGroup(0,i),m.dispatchWorkgroups(Math.max(1,M),1,1),m.setPipeline(F),m.setBindGroup(0,o),m.dispatchWorkgroups(1,1,1);m.setPipeline(I),m.setBindGroup(0,s),m.dispatchWorkgroups(Math.max(1,M),1,1),m.end();let _=fe;l.copyBufferToBuffer(le,0,$,0,16),l.copyBufferToBuffer(Z,0,$,16,_),l.copyBufferToBuffer(ue,0,$,16+_,_),l.copyBufferToBuffer(Q,0,$,16+_*2,_),l.copyBufferToBuffer(G,0,$,16+_*3,z),C&&de>0&&l.copyBufferToBuffer(X,0,$,16+_*3+z,de),t.queue.submit([l.finish()]),await $.mapAsync(u);let v=new Float32Array($.getMappedRange().slice(0));$.unmap();let y={integratedElectrons:v[0],eHartreeDouble:v[1],eXcCorrection:v[2],scfL1Delta:v[3]},b=4+M*4,T=4+M*8,k=4+M*12,A=k+w,V=Array.from(v.slice(k,k+w)),H=C?Array.from({length:M},(e,t)=>v.slice(A+t*w,A+(t+1)*w)):null,pe=0,me=0,he=0,ge=[];for(let e=0;e<M;e+=1){let t=v[4+e*4+3],n=j[e],r=v[T+e*4+0],i=v[T+e*4+1],o=v[T+e*4+2],s=Math.max(0,Number(v[T+e*4+3])||0);pe+=n.occupancy*t,me+=n.occupancy,he+=n.occupancy*s;let c={n:n.n,l:n.l,occupancy:n.occupancy,energyHa:t,kappaPlus:-(n.l+1),...n.l>=1?{kappaMinus:n.l}:{},smallComponentNormSq:s};a&&n.l>=1&&(D===2&&Number.isFinite(r)&&Number.isFinite(i)?(c.energyJMinusHa=r,c.energyJPlusHa=i,c.spinOrbitSplittingHa=o,c.spinOrbitXiHa=o/(n.l+.5)):(c.spinOrbitXiHa=v[b+e*4+0],c.spinOrbitSplittingHa=v[b+e*4+1],c.energyJMinusHa=v[b+e*4+2],c.energyJPlusHa=v[b+e*4+3])),ge.push(c)}let _e=pe-y.eHartreeDouble+y.eXcCorrection,ve=Number(d),ye=Number.isFinite(ve)&&ve>0,be=ye?1/(1+1/(ve*1822.8884862)):1,xe=_e*be,Se=xe-_e,Ce=r/137.035999084,we=D?4/(3*Math.PI)*(1/137.035999084)**3*r**4*Math.max(.5,Math.log(1/Math.max(1e-6,Ce*Ce))-2.3):0,Te=Math.max(0,Number(f)||0),Ee=Number(p)||0,De=Math.max(0,V[0]||0),Oe=Te>0&&Math.abs(Ee)>0&&De>0?De*Math.PI*1420405751*(Math.abs(Ee)/2.792847)*((Te+.5)/1):0;return{schema:c,symbol:n(r),atomicNumberZ:r,configuration:j,functional:E===2?`bare`:E?`pbe`:`lda`,dirac4Component:D===2,totalSmallComponentNormSq:he,relativisticMethod:D===2?`dirac-4comp-gpu+qed`:D===1?`koelling-harmon-gpu+qed`:a?`schrodinger-log-gpu+spin-orbit`:`schrodinger-log-gpu`,finiteNucleusUsed:O>0,nuclearChargeRadiusBohr:O,nuclearMassU:ye?ve:null,reducedMassFactor:be,isotopeMassShiftHa:Se,hyperfineSplittingHz:Oe,qedRadiativeShiftHa:we,totalEnergyHa:xe+we,orbitals:ge,electronCount:me,integratedElectrons:y.integratedElectrons,scfIterations:h,scfL1Delta:y.scfL1Delta,resolverStatus:`webgpu-derived`,webgpuNativeEigensolver:!0,perScfCpuReadbacks:0,webgpuProgramHash:g,...S?{radialGrid:{r:Array.from(te),rho:V,dx:ee}}:{},...C&&H?{orbitalWavefunctions:H}:{},validation:Object.freeze({scientificValidation:!1,webgpuParity:!1})}}finally{for(let e of[U,W,G,K,q,J,Y,ce,X,Z,Q,le,ue,$])e.destroy()}}var x=`peercompute.ulg.simulation-module-registration.v1`;function S(e,t=null){return String(e??``).trim()||t}function C(e){if(typeof e==`string`)return e.trim()||null;if(!e||typeof e!=`object`)return null;let t=S(e.model??e.moduleId??e.id);return t?`${t}@${e.version==null?`1`:String(e.version).trim()}`:null}function w(e={},t=null){if(!t||typeof t!=`object`)return{ok:!0};if(!e||typeof e!=`object`)return{ok:!1,reason:`parameters-must-be-object`};for(let[n,r]of Object.entries(t)){if(!r||typeof r!=`object`)continue;let t=e[n];if(t===void 0){if(r.required===!0)return{ok:!1,reason:`missing-required-parameter:${n}`};continue}if(r.type===`number`){let e=Number(t);if(!Number.isFinite(e))return{ok:!1,reason:`non-finite-parameter:${n}`};if(r.min!=null&&e<r.min)return{ok:!1,reason:`parameter-below-min:${n}:${e}<${r.min}`};if(r.max!=null&&e>r.max)return{ok:!1,reason:`parameter-above-max:${n}:${e}>${r.max}`}}else if(r.type===`boolean`&&typeof t!=`boolean`)return{ok:!1,reason:`parameter-not-boolean:${n}`};else if(r.type===`string`&&typeof t!=`string`)return{ok:!1,reason:`parameter-not-string:${n}`}}return{ok:!0}}function T({createArtifact:e=t}={}){let n=new Map,i=new Map;function c(e,t,{device:n=null,sessionId:r=null}={}){let a=S(r,`${e}:default`),o=i.get(a);if(o&&!o.disposed)return o;let c=s({sessionId:a,moduleId:e,device:n,layout:t.stateLayout,initialStep:0});return i.set(a,c),c}function l(e={}){let t=C(e.method??e.methodId??e.id);if(!t)throw TypeError(`Simulation module registration requires method ({ model, version }) or methodId`);if(typeof e.stepCapsule!=`function`)throw TypeError(`Simulation module ${t} requires a stepCapsule(capsule, context) function`);let i=Object.freeze({schema:x,methodKey:t,method:typeof e.method==`object`&&e.method?Object.freeze({...e.method}):Object.freeze({model:t.split(`@`)[0],version:t.split(`@`)[1]||`1`}),kernel:e.kernel&&typeof e.kernel==`object`?Object.freeze({sourceModule:S(e.kernel.sourceModule),entryPoint:S(e.kernel.entryPoint,`main`),workgroupSize:Number.isInteger(e.kernel.workgroupSize)?e.kernel.workgroupSize:64,wgslHash:e.kernel.wgsl?r(e.kernel.wgsl):S(e.kernel.wgslHash)}):null,parameterSchema:e.parameterSchema&&typeof e.parameterSchema==`object`?Object.freeze({...e.parameterSchema}):Object.freeze({}),stateLayout:e.stateLayout&&typeof e.stateLayout==`object`?Object.freeze({tensorId:S(e.stateLayout.tensorId,`state`),dtype:S(e.stateLayout.dtype,`f32`),layout:S(e.stateLayout.layout,`interleaved`),strideElements:Number(e.stateLayout.strideElements)||1,strideBytes:Number(e.stateLayout.strideBytes)||4,fields:Object.freeze(Array.isArray(e.stateLayout.fields)?[...e.stateLayout.fields]:[])}):Object.freeze({tensorId:`state`,dtype:`f32`,layout:`interleaved`,strideElements:1,strideBytes:4,fields:Object.freeze([])}),scaleRangeM:Array.isArray(e.scaleRangeM)&&e.scaleRangeM.length===2?Object.freeze([Number(e.scaleRangeM[0]),Number(e.scaleRangeM[1])]):null,supportsResidentStep:typeof e.stepResident==`function`,registeredAt:new Date().toISOString()});return n.set(t,{descriptor:i,stepCapsule:e.stepCapsule,stepResident:typeof e.stepResident==`function`?e.stepResident:null,reset:typeof e.reset==`function`?e.reset:null,dispose:typeof e.dispose==`function`?e.dispose:null}),i}function u(e){let t=C(e);return t&&n.get(t)||null}function d(e){return u(e)!==null}function f(){return[...n.values()].map(e=>e.descriptor)}function p(e){let t=C(e);if(!t||!n.has(t))return!1;let r=n.get(t);for(let[e,n]of[...i.entries()])n.moduleId===t&&(n.dispose(),i.delete(e));return r.dispose?.(),n.delete(t),!0}function m(e,{device:t=null,sessionId:n=null}={}){let r=u(e);if(!r)throw RangeError(`Unregistered simulation module: ${C(e)||`missing`}`);return c(r.descriptor.methodKey,r.descriptor,{device:t,sessionId:n})}async function h(e,{sessionId:t=null,nextStep:n=0,destroyBuffers:r=!0,reason:i=`module-session-reset`}={}){let a=u(e);if(!a)throw RangeError(`Unregistered simulation module: ${C(e)||`missing`}`);let o=c(a.descriptor.methodKey,a.descriptor,{sessionId:t}),s=o.reset({nextStep:n,destroyBuffers:r,reason:i});return a.reset&&await a.reset({session:o,receipt:s,nextStep:n,reason:i}),s}async function g(t,{device:n=null,gpuLease:r=null,sessionId:i=null}={}){if(!t||t.serviceId!==o.ulgRuntime||t.taskKind!==a.simulationStep)return{matched:!1,reason:`not-ulg-runtime-simulation-step`};let s=u(t.method);if(!s)return{matched:!1,reason:`method-not-registered`};if(!t.taskId||!t.inputHash||!t.methodHash||!t.provenance)throw TypeError(`Registered simulation.step capsule requires taskId, inputHash, methodHash, and provenance`);let l=w(t.input?.parameters,s.descriptor.parameterSchema);if(!l.ok){let e=RangeError(`Invalid simulation parameters for ${s.descriptor.methodKey}: ${l.reason}`);throw e.code=`ERR_INVALID_SIMULATION_MODULE_PARAMETERS`,e}let d=c(s.descriptor.methodKey,s.descriptor,{device:n,sessionId:i??t.input?.sessionId??null}),f=await s.stepCapsule(t,{createSimulationArtifact:e,device:n,gpuLease:r,leaseSession:d,moduleDescriptor:s.descriptor}),p=f?.artifact??f,m=f?.leaseHandle??null,h=d.summary(),g=p&&typeof p==`object`?{...p,execution:{...p.execution||{},registeredModule:s.descriptor.methodKey,gpuLeaseStatus:r?.status??p.execution?.gpuLeaseStatus??null,residentLeaseSession:h}}:p;return{matched:!0,methodKey:s.descriptor.methodKey,artifact:g,leaseHandle:m,leaseSession:d,leaseSummary:h}}return Object.freeze({schema:x,registerModule:l,resolveModule:u,hasModule:d,listModules:f,unregisterModule:p,getModuleLeaseSession:m,resetModuleSession:h,dispatchSimulationStepCapsule:g})}var E=T();export{b as a,g as i,T as n,y as o,E as r,C as t};