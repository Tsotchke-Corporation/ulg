import{Aa as e,G as t,J as n,N as r,at as i,ja as a,st as o}from"./eshkolTriadClosures-uD3XuPuP.js";import{o as s}from"./materialFoundationAbi-FyZ8ey5s.js";import{n as c,t as l}from"./serviceContract-BLlUScco.js";import{computeBufferBinding as u,createCachedExplicitComputePipeline as d}from"../runtime/webgpuComputeLayout.js";import{i as f}from"./residentBufferLease-EzWfR0Bs.js";var p=`peercompute.ulg.radial-kohn-sham-webgpu.v1`,m=128,h=1,g=`
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
`,v=`
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
`,y=`
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
`;function b(e){let t=2166136261,n=2654435769;for(let r=0;r<e.length;r+=1){let i=e.charCodeAt(r);t=Math.imul(t^i,16777619)>>>0,n=Math.imul(n^i+r,2246822507)>>>0}return`wgsl-fnv1a64:${t.toString(16).padStart(8,`0`)}${n.toString(16).padStart(8,`0`)}`}var x=b(`${g}::${_}::${v}::${y}`),S=new WeakMap;function C(e){let t=S.get(e);if(t)return t;let n=e.createShaderModule({label:`ulg-ks-potential-wgsl`,code:g}),r=e.createShaderModule({label:`ulg-ks-observables-wgsl`,code:_}),i=e.createShaderModule({label:`ulg-ks-spinorbit-wgsl`,code:v}),a=e.createShaderModule({label:`ulg-ks-eigensolver-wgsl`,code:y}),o=e.createBindGroupLayout({label:`ulg-ks-pot-bgl`,entries:[{binding:0,visibility:4,buffer:{type:`uniform`}},{binding:1,visibility:4,buffer:{type:`read-only-storage`}},{binding:2,visibility:4,buffer:{type:`storage`}},{binding:3,visibility:4,buffer:{type:`storage`}},{binding:4,visibility:4,buffer:{type:`storage`}},{binding:5,visibility:4,buffer:{type:`storage`}},{binding:6,visibility:4,buffer:{type:`storage`}}]}),s=e.createBindGroupLayout({label:`ulg-ks-obs-bgl`,entries:[{binding:0,visibility:4,buffer:{type:`uniform`}},{binding:1,visibility:4,buffer:{type:`read-only-storage`}},{binding:2,visibility:4,buffer:{type:`read-only-storage`}},{binding:3,visibility:4,buffer:{type:`read-only-storage`}},{binding:4,visibility:4,buffer:{type:`storage`}},{binding:5,visibility:4,buffer:{type:`read-only-storage`}},{binding:6,visibility:4,buffer:{type:`read-only-storage`}},{binding:7,visibility:4,buffer:{type:`storage`}}]}),c=e.createBindGroupLayout({label:`ulg-ks-so-bgl`,entries:[{binding:0,visibility:4,buffer:{type:`uniform`}},{binding:1,visibility:4,buffer:{type:`read-only-storage`}},{binding:2,visibility:4,buffer:{type:`read-only-storage`}},{binding:3,visibility:4,buffer:{type:`read-only-storage`}},{binding:4,visibility:4,buffer:{type:`read-only-storage`}},{binding:5,visibility:4,buffer:{type:`storage`}}]}),l=e.createBindGroupLayout({label:`ulg-ks-eig-bgl`,entries:[{binding:0,visibility:4,buffer:{type:`uniform`}},{binding:1,visibility:4,buffer:{type:`read-only-storage`}},{binding:2,visibility:4,buffer:{type:`read-only-storage`}},{binding:3,visibility:4,buffer:{type:`read-only-storage`}},{binding:4,visibility:4,buffer:{type:`read-only-storage`}},{binding:5,visibility:4,buffer:{type:`storage`}},{binding:6,visibility:4,buffer:{type:`storage`}},{binding:7,visibility:4,buffer:{type:`storage`}},{binding:8,visibility:4,buffer:{type:`storage`}}]});return t={potPipeline:e.createComputePipeline({label:`ulg-ks-pot-pipe`,layout:e.createPipelineLayout({bindGroupLayouts:[o]}),compute:{module:n,entryPoint:`ks_hartree_pbe_xc`}}),obsPipeline:e.createComputePipeline({label:`ulg-ks-obs-pipe`,layout:e.createPipelineLayout({bindGroupLayouts:[s]}),compute:{module:r,entryPoint:`ks_density_and_observables`}}),soPipeline:e.createComputePipeline({label:`ulg-ks-so-pipe`,layout:e.createPipelineLayout({bindGroupLayouts:[c]}),compute:{module:i,entryPoint:`ks_spin_orbit_quadrature`}}),packAuxPipeline:e.createComputePipeline({label:`ulg-ks-pack-aux-pipe`,layout:e.createPipelineLayout({bindGroupLayouts:[l]}),compute:{module:a,entryPoint:`ks_pack_aux`}}),eigPipeline:e.createComputePipeline({label:`ulg-ks-eig-pipe`,layout:e.createPipelineLayout({bindGroupLayouts:[l]}),compute:{module:a,entryPoint:`ks_solve_radial_orbitals`}}),potBgl:o,obsBgl:s,soBgl:c,eigBgl:l},S.set(e,t),t}async function w(e,t,{functional:n=`pbe`,spinOrbit:a=!0,configuration:s=null,gridPointsN:c=256,rMinBohr:l=1e-5,rMaxBohr:u=null,mixing:d=.25,maxScf:f=80,tol:m=1e-4,returnRadialDensity:g=!0}={}){if(!e||typeof e.createComputePipeline!=`function`)throw TypeError(`solveAtomWebGpu requires a valid WebGPU GPUDevice.`);let _=Math.min(256,Math.max(64,Math.floor(c))),v=+(String(n||`pbe`).toLowerCase()===`pbe`),y=u??Math.max(20,60/Math.sqrt(t)),b=Math.log(l),S=(Math.log(y)-b)/(_-1),w=new Float64Array(_),T=new Float32Array(_),E=new Float32Array(_);for(let e=0;e<_;e+=1){let n=Math.exp(b+e*S);w[e]=n,T[e]=n,E[e]=t*(t**3/Math.PI)*Math.exp(-2*t*n)}let D=s??i(t),O=new Map;for(let e of D)O.set(e.l,Math.max(O.get(e.l)||0,e.n-e.l));let k=D.length,{potPipeline:A,obsPipeline:ee,soPipeline:te,potBgl:ne,obsBgl:j,soBgl:M}=C(e),N=_*4,P=new ArrayBuffer(32),F=new Uint32Array(P),I=new Float32Array(P);F[0]=_,F[1]=v,I[2]=t,I[3]=S,I[4]=d,F[5]=k;let L=e.createBuffer({size:32,usage:72}),R=e.createBuffer({size:N,usage:136}),z=e.createBuffer({size:N,usage:140}),B=e.createBuffer({size:N,usage:132}),V=e.createBuffer({size:N,usage:132}),H=e.createBuffer({size:N,usage:132}),re=e.createBuffer({size:N,usage:132}),U=e.createBuffer({size:N*4,usage:136}),W=e.createBuffer({size:Math.max(1,k)*N,usage:136}),G=e.createBuffer({size:Math.max(1,k)*16,usage:136}),K=e.createBuffer({size:16,usage:132}),q=e.createBuffer({size:Math.max(1,k)*16,usage:132}),J=e.createBuffer({size:N*3,usage:9}),Y=e.createBuffer({size:16,usage:9}),X=e.createBuffer({size:N+Math.max(1,k)*16,usage:9});try{e.queue.writeBuffer(L,0,P),e.queue.writeBuffer(R,0,T),e.queue.writeBuffer(z,0,E);let n=e.createBindGroup({layout:ne,entries:[{binding:0,resource:{buffer:L}},{binding:1,resource:{buffer:R}},{binding:2,resource:{buffer:z}},{binding:3,resource:{buffer:B}},{binding:4,resource:{buffer:V}},{binding:5,resource:{buffer:H}},{binding:6,resource:{buffer:re}}]}),i=e.createBindGroup({layout:j,entries:[{binding:0,resource:{buffer:L}},{binding:1,resource:{buffer:R}},{binding:2,resource:{buffer:W}},{binding:3,resource:{buffer:G}},{binding:4,resource:{buffer:z}},{binding:5,resource:{buffer:B}},{binding:6,resource:{buffer:U}},{binding:7,resource:{buffer:K}}]}),s=e.createBindGroup({layout:M,entries:[{binding:0,resource:{buffer:L}},{binding:1,resource:{buffer:R}},{binding:2,resource:{buffer:W}},{binding:3,resource:{buffer:G}},{binding:4,resource:{buffer:re}},{binding:5,resource:{buffer:q}}]}),c=new Map,l=new Float32Array(k*_),u=new Float32Array(k*4),d=new Float32Array(_*4),y=new Float64Array(_),b=new Map,C=0,F=1/0,I={integratedElectrons:0,eHartreeDouble:0,eXcCorrection:0,scfL1Delta:0};for(let a=0;a<f;a+=1){C=a+1;let o=e.createCommandEncoder(),s=o.beginComputePass();s.setPipeline(A),s.setBindGroup(0,n),s.dispatchWorkgroups(1,1,1),s.end(),o.copyBufferToBuffer(V,0,J,0,N),o.copyBufferToBuffer(H,0,J,N,N),o.copyBufferToBuffer(re,0,J,N*2,N),e.queue.submit([o.finish()]),await J.mapAsync(h);let f=new Float32Array(J.getMappedRange().slice(0));J.unmap();for(let e=0;e<_;e+=1)d[e*4+0]=f[e],d[e*4+1]=f[_+e],d[e*4+2]=f[_*2+e],d[e*4+3]=0,y[e]=f[_*2+e];b=new Map;for(let[e,n]of O){let i=r(y,w,S,e,n,t,c.get(e));c.set(e,i.map(e=>e.energyHa)),b.set(e,i)}for(let e=0;e<k;e+=1){let t=D[e],n=b.get(t.l)[t.n-t.l-1];u[e*4+0]=t.n,u[e*4+1]=t.l,u[e*4+2]=t.occupancy,u[e*4+3]=n.energyHa;let r=e*_;for(let e=0;e<_;e+=1)l[r+e]=n.u[e]}e.queue.writeBuffer(U,0,d),e.queue.writeBuffer(W,0,l),e.queue.writeBuffer(G,0,u);let p=e.createCommandEncoder(),g=p.beginComputePass();g.setPipeline(ee),g.setBindGroup(0,i),g.dispatchWorkgroups(1,1,1),g.end(),p.copyBufferToBuffer(K,0,Y,0,16),e.queue.submit([p.finish()]),await Y.mapAsync(h);let v=new Float32Array(Y.getMappedRange().slice(0));if(Y.unmap(),I={integratedElectrons:v[0],eHartreeDouble:v[1],eXcCorrection:v[2],scfL1Delta:v[3]},F=I.scfL1Delta,F<m&&a>6)break}let ie=e.createCommandEncoder(),ae=ie.beginComputePass();ae.setPipeline(te),ae.setBindGroup(0,s),ae.dispatchWorkgroups(Math.max(1,k),1,1),ae.end(),ie.copyBufferToBuffer(z,0,X,0,N),ie.copyBufferToBuffer(q,0,X,N,Math.max(1,k)*16),e.queue.submit([ie.finish()]),await X.mapAsync(h);let oe=new Float32Array(X.getMappedRange().slice(0));X.unmap();let se=Array.from(oe.slice(0,_)),Z=oe.slice(_),Q=0,ce=0,le=[];for(let e=0;e<k;e+=1){let t=D[e],n=b.get(t.l)[t.n-t.l-1];Q+=t.occupancy*n.energyHa,ce+=t.occupancy;let r={n:t.n,l:t.l,occupancy:t.occupancy,energyHa:n.energyHa};a&&t.l>=1&&(r.spinOrbitXiHa=Z[e*4+0],r.spinOrbitSplittingHa=Z[e*4+1],r.energyJMinusHa=Z[e*4+2],r.energyJPlusHa=Z[e*4+3]),le.push(r)}let ue=Q-I.eHartreeDouble+I.eXcCorrection;return{schema:p,symbol:o(t),atomicNumberZ:t,configuration:D,functional:v?`pbe`:`lda`,relativisticMethod:a?`koelling-harmon+spin-orbit`:`koelling-harmon`,totalEnergyHa:ue,orbitals:le,electronCount:ce,integratedElectrons:I.integratedElectrons,scfIterations:C,scfL1Delta:F,resolverStatus:`hybrid-webgpu-potential-cpu-eigensolver`,webgpuProgramHash:x,...g?{radialGrid:{r:Array.from(w),rho:se,dx:S}}:{},validation:Object.freeze({scientificValidation:!1,webgpuParity:!1})}}finally{L.destroy(),R.destroy(),z.destroy(),B.destroy(),V.destroy(),H.destroy(),re.destroy(),U.destroy(),W.destroy(),G.destroy(),K.destroy(),q.destroy(),J.destroy(),Y.destroy(),X.destroy()}}async function T(e,t,{functional:n=`pbe`,spinOrbit:r=!0,scalarRelativistic:a=!1,nuclearChargeRadiusBohr:s=0,nuclearMassU:c=null,nuclearSpinI:l=0,nuclearMagneticMomentMuN:u=0,configuration:d=null,gridPointsN:f=256,rMinBohr:g=1e-4,rMaxBohr:_=null,mixing:v=.25,maxScf:y=60,returnRadialDensity:b=!0,returnOrbitalWavefunctions:S=!1}={}){if(!e||typeof e.createComputePipeline!=`function`)throw TypeError(`solveAtomFullWebGpu requires a valid WebGPU GPUDevice.`);let w=Math.min(256,Math.max(64,Math.floor(f))),T=String(n||`pbe`).toLowerCase(),E=T===`bare`?2:+(T===`pbe`),D=a?r?2:1:0,O=Math.max(0,Number(s)||0),k=_??Math.max(20,60/Math.sqrt(t)),A=Math.log(g),ee=(Math.log(k)-A)/(w-1),te=new Float64Array(w),ne=new Float32Array(w),j=new Float32Array(w);for(let e=0;e<w;e+=1){let n=Math.exp(A+e*ee);te[e]=n,ne[e]=n,j[e]=t*(t**3/Math.PI)*Math.exp(-2*t*n)}let M=d??i(t),N=M.length,P=new Float32Array(Math.max(1,N)*4);for(let e=0;e<N;e+=1)P[e*4+0]=M[e].n,P[e*4+1]=M[e].l,P[e*4+2]=M[e].occupancy,P[e*4+3]=-(t*t)/(2*M[e].n*M[e].n);let{potPipeline:F,obsPipeline:I,soPipeline:L,packAuxPipeline:R,eigPipeline:z,potBgl:B,obsBgl:V,soBgl:H,eigBgl:re}=C(e),U=w*4,W=new ArrayBuffer(32),G=new Uint32Array(W),K=new Float32Array(W);G[0]=w,G[1]=E,K[2]=t,K[3]=ee,K[4]=v,G[5]=N,G[6]=D,K[7]=O;let q=e.createBuffer({size:32,usage:72}),J=e.createBuffer({size:U,usage:136}),Y=e.createBuffer({size:U,usage:140}),X=e.createBuffer({size:U,usage:m}),ie=e.createBuffer({size:U,usage:m}),ae=e.createBuffer({size:U,usage:m}),oe=e.createBuffer({size:U,usage:m}),se=e.createBuffer({size:U*4,usage:m}),Z=e.createBuffer({size:Math.max(1,N)*U,usage:S?132:m}),Q=e.createBuffer({size:Math.max(1,N)*16,usage:140}),ce=e.createBuffer({size:Math.max(1,N)*16,usage:132}),le=e.createBuffer({size:16,usage:132}),ue=e.createBuffer({size:Math.max(1,N)*16,usage:132}),de=S?Math.max(1,N)*U:0,fe=Math.max(1,N)*16,pe=16+fe*3+U+de,$=e.createBuffer({size:pe,usage:9});try{e.queue.writeBuffer(q,0,W),e.queue.writeBuffer(J,0,ne),e.queue.writeBuffer(Y,0,j),e.queue.writeBuffer(Q,0,P);let n=e.createBindGroup({layout:B,entries:[q,J,Y,X,ie,ae,oe].map((e,t)=>({binding:t,resource:{buffer:e}}))}),i=e.createBindGroup({layout:re,entries:[q,J,ie,ae,oe,se,Z,Q,ce].map((e,t)=>({binding:t,resource:{buffer:e}}))}),a=e.createBindGroup({layout:V,entries:[q,J,Z,Q,Y,X,se,le].map((e,t)=>({binding:t,resource:{buffer:e}}))}),s=e.createBindGroup({layout:H,entries:[q,J,Z,Q,oe,ue].map((e,t)=>({binding:t,resource:{buffer:e}}))}),d=e.createCommandEncoder({label:`ulg-ks-full-webgpu-scf`}),f=d.beginComputePass({label:`ulg-ks-full-webgpu-scf-pass`}),m=Math.max(1,Math.min(120,Math.floor(y)));for(let e=0;e<m;e+=1)f.setPipeline(F),f.setBindGroup(0,n),f.dispatchWorkgroups(1,1,1),f.setPipeline(R),f.setBindGroup(0,i),f.dispatchWorkgroups(1,1,1),f.setPipeline(z),f.setBindGroup(0,i),f.dispatchWorkgroups(Math.max(1,N),1,1),f.setPipeline(I),f.setBindGroup(0,a),f.dispatchWorkgroups(1,1,1);f.setPipeline(L),f.setBindGroup(0,s),f.dispatchWorkgroups(Math.max(1,N),1,1),f.end();let g=fe;d.copyBufferToBuffer(le,0,$,0,16),d.copyBufferToBuffer(Q,0,$,16,g),d.copyBufferToBuffer(ue,0,$,16+g,g),d.copyBufferToBuffer(ce,0,$,16+g*2,g),d.copyBufferToBuffer(Y,0,$,16+g*3,U),S&&de>0&&d.copyBufferToBuffer(Z,0,$,16+g*3+U,de),e.queue.submit([d.finish()]),await $.mapAsync(h);let _=new Float32Array($.getMappedRange().slice(0));$.unmap();let v={integratedElectrons:_[0],eHartreeDouble:_[1],eXcCorrection:_[2],scfL1Delta:_[3]},C=4+N*4,T=4+N*8,k=4+N*12,A=k+w,G=Array.from(_.slice(k,k+w)),K=S?Array.from({length:N},(e,t)=>_.slice(A+t*w,A+(t+1)*w)):null,pe=0,me=0,he=0,ge=[];for(let e=0;e<N;e+=1){let t=_[4+e*4+3],n=M[e],i=_[T+e*4+0],a=_[T+e*4+1],o=_[T+e*4+2],s=Math.max(0,Number(_[T+e*4+3])||0);pe+=n.occupancy*t,me+=n.occupancy,he+=n.occupancy*s;let c={n:n.n,l:n.l,occupancy:n.occupancy,energyHa:t,kappaPlus:-(n.l+1),...n.l>=1?{kappaMinus:n.l}:{},smallComponentNormSq:s};r&&n.l>=1&&(D===2&&Number.isFinite(i)&&Number.isFinite(a)?(c.energyJMinusHa=i,c.energyJPlusHa=a,c.spinOrbitSplittingHa=o,c.spinOrbitXiHa=o/(n.l+.5)):(c.spinOrbitXiHa=_[C+e*4+0],c.spinOrbitSplittingHa=_[C+e*4+1],c.energyJMinusHa=_[C+e*4+2],c.energyJPlusHa=_[C+e*4+3])),ge.push(c)}let _e=pe-v.eHartreeDouble+v.eXcCorrection,ve=Number(c),ye=Number.isFinite(ve)&&ve>0,be=ye?1/(1+1/(ve*1822.8884862)):1,xe=_e*be,Se=xe-_e,Ce=t/137.035999084,we=D?4/(3*Math.PI)*(1/137.035999084)**3*t**4*Math.max(.5,Math.log(1/Math.max(1e-6,Ce*Ce))-2.3):0,Te=Math.max(0,Number(l)||0),Ee=Number(u)||0,De=Math.max(0,G[0]||0),Oe=Te>0&&Math.abs(Ee)>0&&De>0?De*Math.PI*1420405751*(Math.abs(Ee)/2.792847)*((Te+.5)/1):0;return{schema:p,symbol:o(t),atomicNumberZ:t,configuration:M,functional:E===2?`bare`:E?`pbe`:`lda`,dirac4Component:D===2,totalSmallComponentNormSq:he,relativisticMethod:D===2?`dirac-4comp-gpu+qed`:D===1?`koelling-harmon-gpu+qed`:r?`schrodinger-log-gpu+spin-orbit`:`schrodinger-log-gpu`,finiteNucleusUsed:O>0,nuclearChargeRadiusBohr:O,nuclearMassU:ye?ve:null,reducedMassFactor:be,isotopeMassShiftHa:Se,hyperfineSplittingHz:Oe,qedRadiativeShiftHa:we,totalEnergyHa:xe+we,orbitals:ge,electronCount:me,integratedElectrons:v.integratedElectrons,scfIterations:m,scfL1Delta:v.scfL1Delta,resolverStatus:`webgpu-derived`,webgpuNativeEigensolver:!0,perScfCpuReadbacks:0,webgpuProgramHash:x,...b?{radialGrid:{r:Array.from(te),rho:G,dx:ee}}:{},...S&&K?{orbitalWavefunctions:K}:{},validation:Object.freeze({scientificValidation:!1,webgpuParity:!1})}}finally{for(let e of[q,J,Y,X,ie,ae,oe,se,Z,Q,ce,le,ue,$])e.destroy()}}var E=`ulg.gpumath.batched-symmetric-eigensolver.v1`,D=Object.freeze({MAP_READ:1,COPY_SRC:4,COPY_DST:8,UNIFORM:64,STORAGE:128}),O=`
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
`,k=`
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
`;async function A(e,{matrices:t,n,batchCount:r=1,maxSweeps:i=32,tolerance:a=1e-6,keepResident:o=!1}={}){if(!e||typeof e.createBuffer!=`function`)throw TypeError(`solveSymmetricEigenBatchedWebGpu requires a live WebGPU GPUDevice`);let s=Math.trunc(Number(n)),c=Math.max(1,Math.trunc(Number(r)));if(!(s>=1&&s<=256))throw RangeError(`Unsupported matrix dimension n=${s} (expected 1..256)`);let l=s*s,f=c*l,p=t instanceof Float32Array?t:Float32Array.from(t);if(p.length!==f)throw RangeError(`Expected ${f} matrix floats for batch=${c}, n=${s}; got ${p.length}`);let m=d(e,{cacheKey:`ulg-gpumath-jacobi-sym-batched.v1`,label:`ulg-gpumath-jacobi-sym-batched`,code:O,entryPoint:`jacobi_symmetric_batched`,bindings:[u(0,`uniform`),u(1,`storage`),u(2,`storage`),u(3,`storage`)]}),h=new ArrayBuffer(32);new Uint32Array(h,0,4).set([s,c,Math.max(1,Math.trunc(i)),l]),new Float32Array(h,16,4).set([Number(a),0,0,0]);let g=e.createBuffer({label:`ulg-gpumath-eig-params`,size:32,usage:D.UNIFORM|D.COPY_DST});e.queue.writeBuffer(g,0,h);let _=e.createBuffer({label:`ulg-gpumath-eig-a`,size:Math.max(16,f*4),usage:D.STORAGE|D.COPY_DST|D.COPY_SRC});e.queue.writeBuffer(_,0,p);let v=e.createBuffer({label:`ulg-gpumath-eig-v`,size:Math.max(16,f*4),usage:D.STORAGE|D.COPY_SRC}),y=e.createBuffer({label:`ulg-gpumath-eig-vals`,size:Math.max(16,c*s*4),usage:D.STORAGE|D.COPY_SRC}),b=e.createBindGroup({layout:m.bindGroupLayout,entries:[g,_,v,y].map((e,t)=>({binding:t,resource:{buffer:e}}))}),x=e.createCommandEncoder({label:`ulg-gpumath-jacobi-eig`}),S=x.beginComputePass({label:`ulg-gpumath-jacobi-eig-pass`});if(S.setPipeline(m.pipeline),S.setBindGroup(0,b),S.dispatchWorkgroups(c),S.end(),o)return e.queue.submit([x.finish()]),g.destroy(),_.destroy(),Object.freeze({schema:E,backend:`webgpu`,n:s,batchCount:c,eigenvaluesBuffer:y,eigenvectorsBuffer:v,destroy(){y.destroy(),v.destroy()}});let C=e.createBuffer({label:`ulg-gpumath-eig-read-vals`,size:Math.max(16,c*s*4),usage:D.MAP_READ|D.COPY_DST}),w=e.createBuffer({label:`ulg-gpumath-eig-read-vecs`,size:Math.max(16,f*4),usage:D.MAP_READ|D.COPY_DST});x.copyBufferToBuffer(y,0,C,0,c*s*4),x.copyBufferToBuffer(v,0,w,0,f*4),e.queue.submit([x.finish()]);try{await Promise.all([C.mapAsync(D.MAP_READ),w.mapAsync(D.MAP_READ)]);let e=new Float32Array(C.getMappedRange().slice(0,c*s*4)),t=new Float32Array(w.getMappedRange().slice(0,f*4));return C.unmap(),w.unmap(),Object.freeze({schema:E,backend:`webgpu`,n:s,batchCount:c,eigenvalues:e,eigenvectors:t})}finally{for(let e of[g,_,v,y,C,w])e.destroy()}}async function ee(e,{fockMatrices:t,overlapMatrices:n,n:r,batchCount:i=1,maxSweeps:a=32,tolerance:o=1e-6}={}){if(!e||typeof e.createBuffer!=`function`)throw TypeError(`solveGeneralizedSymmetricEigenBatchedWebGpu requires a live WebGPU GPUDevice`);let s=Math.trunc(Number(r)),c=Math.max(1,Math.trunc(Number(i))),l=s*s,f=c*l,p=t instanceof Float32Array?t:Float32Array.from(t),m=await A(e,{matrices:n instanceof Float32Array?n:Float32Array.from(n),n:s,batchCount:c,maxSweeps:a,tolerance:o,keepResident:!0}),h=d(e,{cacheKey:`ulg-gpumath-mat-op.v1`,label:`ulg-gpumath-mat-op`,code:k,entryPoint:`mat_op`,bindings:[u(0,`uniform`),u(1,`read-only-storage`),u(2,`read-only-storage`),u(3,`storage`)]}),g=d(e,{cacheKey:`ulg-gpumath-jacobi-sym-batched.v1`,label:`ulg-gpumath-jacobi-sym-batched`,code:O,entryPoint:`jacobi_symmetric_batched`,bindings:[u(0,`uniform`),u(1,`storage`),u(2,`storage`),u(3,`storage`)]}),_=t=>{let n=e.createBuffer({size:16,usage:D.UNIFORM|D.COPY_DST});return e.queue.writeBuffer(n,0,new Uint32Array(t)),n},v=_([s,c,0,l]),y=_([s,c,1,l]),b=new ArrayBuffer(32);new Uint32Array(b,0,4).set([s,c,a,l]),new Float32Array(b,16,4).set([o,0,0,0]);let x=e.createBuffer({size:32,usage:D.UNIFORM|D.COPY_DST});e.queue.writeBuffer(x,0,b);let S=Math.max(16,f*4),C=e.createBuffer({size:S,usage:D.STORAGE|D.COPY_DST});e.queue.writeBuffer(C,0,p);let w=e.createBuffer({size:S,usage:D.STORAGE}),T=e.createBuffer({size:S,usage:D.STORAGE}),ee=e.createBuffer({size:S,usage:D.STORAGE}),te=e.createBuffer({size:S,usage:D.STORAGE}),ne=e.createBuffer({size:S,usage:D.STORAGE|D.COPY_SRC}),j=e.createBuffer({size:Math.max(16,c*s*4),usage:D.STORAGE|D.COPY_SRC}),M=e.createBuffer({size:Math.max(16,c*s*4),usage:D.MAP_READ|D.COPY_DST}),N=e.createBuffer({size:S,usage:D.MAP_READ|D.COPY_DST}),P=(t,n)=>e.createBindGroup({layout:t,entries:n.map((e,t)=>({binding:t,resource:{buffer:e}}))}),F=P(h.bindGroupLayout,[v,m.eigenvectorsBuffer,m.eigenvaluesBuffer,w]),I=P(h.bindGroupLayout,[y,w,C,T]),L=P(h.bindGroupLayout,[y,T,w,ee]),R=P(g.bindGroupLayout,[x,ee,te,j]),z=P(h.bindGroupLayout,[y,w,te,ne]),B=Math.ceil(f/64),V=e.createCommandEncoder({label:`ulg-gpumath-gen-eig`}),H=V.beginComputePass({label:`ulg-gpumath-gen-eig-pass`});H.setPipeline(h.pipeline),H.setBindGroup(0,F),H.dispatchWorkgroups(B),H.setBindGroup(0,I),H.dispatchWorkgroups(B),H.setBindGroup(0,L),H.dispatchWorkgroups(B),H.setPipeline(g.pipeline),H.setBindGroup(0,R),H.dispatchWorkgroups(c),H.setPipeline(h.pipeline),H.setBindGroup(0,z),H.dispatchWorkgroups(B),H.end(),V.copyBufferToBuffer(j,0,M,0,c*s*4),V.copyBufferToBuffer(ne,0,N,0,f*4),e.queue.submit([V.finish()]);try{await Promise.all([M.mapAsync(D.MAP_READ),N.mapAsync(D.MAP_READ)]);let e=new Float32Array(M.getMappedRange().slice(0,c*s*4)),t=new Float32Array(N.getMappedRange().slice(0,f*4));return M.unmap(),N.unmap(),Object.freeze({schema:E,backend:`webgpu`,generalized:!0,n:s,batchCount:c,eigenvalues:e,eigenvectors:t})}finally{m.destroy();for(let e of[v,y,x,C,w,T,ee,te,ne,j,M,N])e.destroy()}}var te=`ulg.electronic.molecular-hf-webgpu.v1`,ne=27.211386245988,j=Object.freeze({MAP_READ:1,COPY_SRC:4,COPY_DST:8,UNIFORM:64,STORAGE:128}),M=`
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
`;function N(e,t=`auto`){let n=String(t||`auto`).trim().toLowerCase();if(n===`valence-sto3g`||n===`ecp-sto3g`||e.some(e=>e.Z>18))return`valence-sto3g`;if(n===`auto`){let t=0;for(let n of e)t+=n.Z<=2?1:n.Z<=10?5:9;return t>28?`valence-sto3g`:`sto-3g`}return n}async function P(e,r,{maxScf:i=35,tol:a=1e-5,damping:o=.35,volDim:c=24,volumeMode:l=0,basisName:f=`auto`,charge:p=0,sampleVolume:m=!0,initialP:h=null}={}){if(!e||typeof e.createBuffer!=`function`)throw TypeError(`solveMoleculeRhfWebGpu requires a live WebGPU GPUDevice`);if(!Array.isArray(r)||r.length===0)throw TypeError(`solveMoleculeRhfWebGpu requires non-empty atoms array`);let g=r.map(e=>{let t=Array.isArray(e.position)?e.position:[Number(e.x)||0,Number(e.y)||0,Number(e.z)||0];return{Z:Math.max(1,Math.min(118,Math.trunc(e.Z))),x:t[0],y:t[1],z:t[2],position:t}}),_=N(g,f),{basis:v,n:y,nElectrons:b,effCharges:x,S,Hcore:C,eri:w,idx:T,nuclearRepulsion:E}=t(g,p,_),D=Array.isArray(x)&&x.length===g.length?x:g.map(e=>e.Z),O=b,k=Math.max(1,Math.min(y,Math.floor(O/2))),A=new Float32Array(y*y),P=new Float64Array(y*y);for(let e=0;e<y;e+=1)for(let t=0;t<y;t+=1)A[e*y+t]=S[e][t],P[e*y+t]=C[e][t];let F=h&&h.length===y*y?new Float64Array(h):new Float64Array(y*y),I=0,L=new Float32Array(y),R=new Float32Array(y*y),z=0;for(let t=0;t<i;t+=1){z=t+1;let n=new Float64Array(y*y);for(let e=0;e<y;e+=1)for(let t=0;t<y;t+=1){let r=0;for(let n=0;n<y;n+=1)for(let i=0;i<y;i+=1){let a=F[n*y+i];a!==0&&(r+=a*(w[T(e,t,n,i)]-.5*w[T(e,i,n,t)]))}n[e*y+t]=P[e*y+t]+r}let r=await ee(e,{fockMatrices:Float32Array.from(n),overlapMatrices:A,n:y,batchCount:1,maxSweeps:28,tolerance:1e-6});L=r.eigenvalues,R=r.eigenvectors;let i=new Float64Array(y*y);for(let e=0;e<y;e+=1)for(let t=0;t<y;t+=1){let n=0;for(let r=0;r<Math.min(k,y);r+=1)n+=2*R[e*y+r]*R[t*y+r];i[e*y+t]=(1-o)*n+o*F[e*y+t]}let s=0;for(let e=0;e<y*y;e+=1)s+=.5*i[e]*(P[e]+n[e]);let c=s+E;if(F=i,t>1&&Math.abs(c-I)<a){I=c;break}I=c}let B=Math.max(0,Math.min(y-1,k-1)),V=Math.min(y-1,k),H=L[B],re=k<y?L[V]:H+.4,U=Math.max(.1,(re-H)*ne),W=new Float64Array(g.length);for(let e=0;e<g.length;e+=1)W[e]=D[e];for(let e=0;e<y;e+=1){let t=0;for(let n=0;n<y;n+=1)t+=F[e*y+n]*S[n][e];let n=v[e].atomIndex??0;n<W.length&&(W[n]-=t)}let G=0,K=0,q=0;for(let e=0;e<g.length;e+=1)G+=W[e]*g[e].x,K+=W[e]*g[e].y,q+=W[e]*g[e].z;let J=2.541746,Y=Object.freeze([G*J,K*J,q*J]),X=Math.hypot(Y[0],Y[1],Y[2]),{bondOrderMatrix:ie,bonds:ae}=n(F,S,v,g,y);if(!m)return Object.freeze({schema:te,backend:`webgpu`,basisUsed:_,basisCount:y,electronCount:O,atoms:Object.freeze(g.map(e=>Object.freeze({Z:e.Z,x:e.x,y:e.y,z:e.z}))),scfIterations:z,totalEnergyHa:I,nuclearRepulsionHa:E,homoEnergyHa:H,lumoEnergyHa:re,homoLumoGapEv:U,dipoleDebye:X,dipoleVecDebye:Y,mullikenCharges:Array.from(W),bonds:Object.freeze(ae),bondOrderMatrix:ie,densityMatrix:F,accuracyTier:s.TIER_2_REPRESENTATIVE_EFFECTIVE,provenance:Object.freeze({status:`webgpu-derived`,scientificValidation:!1,solver:_===`valence-sto3g`?`gpumath-rhf-lowdin-valence-sto3g`:`gpumath-rhf-lowdin-sto3g`})});let oe=d(e,{cacheKey:`ulg-mol-hf-volume.v1`,label:`ulg-mol-hf-volume`,code:M,entryPoint:`sample_molecular_volume`,bindings:[u(0,`uniform`),u(1,`read-only-storage`),u(2,`read-only-storage`),u(3,`storage`)]}),se=new Float32Array(g.length*4),Z=new Float32Array(g.length*4),Q=1.5;for(let e=0;e<g.length;e+=1){let t=g[e];Q=Math.max(Q,Math.hypot(t.x,t.y,t.z)+2.5),se[e*4+0]=t.x,se[e*4+1]=t.y,se[e*4+2]=t.z,se[e*4+3]=Math.max(.85,Math.min(2.6,.9+.14*Math.sqrt(t.Z)));let n=0,r=0,i=0;for(let t=0;t<y;t+=1)(v[t].atomIndex??0)===e&&(n+=R[t*y+B],r+=R[t*y+V],i+=F[t*y+t]);Z[e*4+0]=Math.max(.5,i),Z[e*4+1]=n,Z[e*4+2]=r,Z[e*4+3]=t.Z}let ce=c**3,le=new ArrayBuffer(32);new Uint32Array(le,0,4).set([c,g.length,l,0]),new Float32Array(le,16,4).set([Q,0,0,0]);let ue=e.createBuffer({size:32,usage:j.UNIFORM|j.COPY_DST});e.queue.writeBuffer(ue,0,le);let de=e.createBuffer({size:Math.max(16,se.byteLength),usage:j.STORAGE|j.COPY_DST});e.queue.writeBuffer(de,0,se);let fe=e.createBuffer({size:Math.max(16,Z.byteLength),usage:j.STORAGE|j.COPY_DST});e.queue.writeBuffer(fe,0,Z);let pe=e.createBuffer({size:ce*16,usage:j.STORAGE|j.COPY_SRC}),$=e.createBuffer({size:ce*16,usage:j.MAP_READ|j.COPY_DST}),me=e.createBindGroup({layout:oe.bindGroupLayout,entries:[ue,de,fe,pe].map((e,t)=>({binding:t,resource:{buffer:e}}))}),he=e.createCommandEncoder({label:`ulg-mol-hf-volume`}),ge=he.beginComputePass({label:`ulg-mol-hf-volume-pass`});ge.setPipeline(oe.pipeline),ge.setBindGroup(0,me),ge.dispatchWorkgroups(Math.ceil(ce/64)),ge.end(),he.copyBufferToBuffer(pe,0,$,0,ce*16),e.queue.submit([he.finish()]);try{await $.mapAsync(j.MAP_READ);let e=new Float32Array($.getMappedRange().slice(0,ce*16));return $.unmap(),Object.freeze({schema:te,backend:`webgpu`,basisUsed:_,basisCount:y,electronCount:O,atoms:Object.freeze(g.map(e=>Object.freeze({Z:e.Z,x:e.x,y:e.y,z:e.z}))),scfIterations:z,totalEnergyHa:I,nuclearRepulsionHa:E,homoEnergyHa:H,lumoEnergyHa:re,homoLumoGapEv:U,dipoleDebye:X,dipoleVecDebye:Y,mullikenCharges:Array.from(W),bonds:Object.freeze(ae),bondOrderMatrix:ie,orbitalEnergiesHa:Array.from(L),volDim:c,boxHalfBohr:Q,volumeData:e,atomOrbitalParams:Object.freeze({posZeta:new Float32Array(se),weights:new Float32Array(Z),boxHalfBohr:Q,homoIdx:B,lumoIdx:V}),accuracyTier:s.TIER_2_REPRESENTATIVE_EFFECTIVE,provenance:Object.freeze({status:`webgpu-derived`,scientificValidation:!1,solver:_===`valence-sto3g`?`gpumath-rhf-lowdin-valence-sto3g`:`gpumath-rhf-lowdin-sto3g`})})}finally{for(let e of[ue,de,fe,pe,$])e.destroy()}}var F=`ulg.electronic.ci-neb-webgpu.v1`;async function I(e,t,n,{nImages:r=5,maxSteps:i=5,springK:a=.08,stepSize:o=.14,climbStartStep:s=1,forceTol:c=.015,gradH:l=.0025,maxScf:u=22,tol:d=1e-4,basisName:f=`auto`,oneSidedGrad:p=!1,saddleOnlyGrad:m=!1}={}){if(!e||typeof e.createBuffer!=`function`)throw TypeError(`climbingImageNEBWebGpu requires a live WebGPU GPUDevice`);let h=e=>Array.isArray(e.position)?[Number(e.position[0])||0,Number(e.position[1])||0,Number(e.position[2])||0]:[Number(e.x)||0,Number(e.y)||0,Number(e.z)||0],g=t.map(e=>Math.trunc(e.Z)),_=g.length,v=t.map(h),y=n.map(h),b=[];for(let e=0;e<r;e+=1){let t=e/Math.max(1,r-1),n=v.map((e,n)=>[e[0]+t*(y[n][0]-e[0]),e[1]+t*(y[n][1]-e[1]),e[2]+t*(y[n][2]-e[2])]);if(e>0&&e<r-1&&_>=3)for(let e=0;e<6;e+=1)for(let e=0;e<_;e+=1)for(let t=e+1;t<_;t+=1){let r=g[e]===1||g[t]===1?1.4:2.15,i=n[t][0]-n[e][0],a=n[t][1]-n[e][1],o=n[t][2]-n[e][2],s=Math.hypot(i,a,o);if(s<r){s<1e-4&&(i=0,a=.5,o=.866);let c=Math.max(1e-4,Math.hypot(i,a,o)),l=.52*(r-s);n[e][0]-=i/c*l,n[e][1]-=a/c*l,n[e][2]-=o/c*l,n[t][0]+=i/c*l,n[t][1]+=a/c*l,n[t][2]+=o/c*l}}b.push(n)}let x=(e,t)=>{let n=[];for(let r=0;r<_;r+=1)n.push(e[r][0]-t[r][0],e[r][1]-t[r][1],e[r][2]-t[r][2]);return n},S=(e,t)=>e.reduce((e,n,r)=>e+n*t[r],0),C=e=>Math.sqrt(S(e,e)),w=e=>e.map((e,t)=>({Z:g[t],position:e})),T=Array(r).fill(null),E=0;async function D(t,n,r){let i=await P(e,w(n),{maxScf:u,tol:d,basisName:f,sampleVolume:!1,initialP:T[t]});if(E+=1,T[t]=i.densityMatrix,!r)return{energyHa:i.totalEnergyHa,grad:Array(3*_).fill(0)};let a=Array(3*_).fill(0),o=n.map(e=>[...e]),s=+(_>=2);for(let n=s;n<_;n+=1)for(let r=0;r<3;r+=1){let c=o[n][r];o[n][r]=c+l;let u=(await P(e,w(o),{maxScf:12,tol:d,basisName:f,sampleVolume:!1,initialP:T[t]})).totalEnergyHa;E+=1;let m;if(p)m=(u-i.totalEnergyHa)/l;else{o[n][r]=c-l;let i=(await P(e,w(o),{maxScf:12,tol:d,basisName:f,sampleVolume:!1,initialP:T[t]})).totalEnergyHa;E+=1,m=(u-i)/(2*l)}o[n][r]=c,a[n*3+r]=m,s===1&&(a[r]-=m)}return{energyHa:i.totalEnergyHa,grad:a}}let O=Array(r).fill(0),k=1/0,A=!1,ee=0,te=await D(0,b[0],!1),ne=await D(r-1,b[r-1],!1);for(let e=0;e<i;e+=1){ee=e+1;let t=Array(r);if(O=Array(r),O[0]=te.energyHa,t[0]=te.grad,O[r-1]=ne.energyHa,t[r-1]=ne.grad,m){for(let e=1;e<r-1;e+=1){let n=await D(e,b[e],!1);O[e]=n.energyHa,t[e]=n.grad}let e=1;for(let t=2;t<r-1;t+=1)O[t]>O[e]&&(e=t);let n=await D(e,b[e],!0);O[e]=n.energyHa,t[e]=n.grad}else for(let e=1;e<r-1;e+=1){let n=await D(e,b[e],!0);O[e]=n.energyHa,t[e]=n.grad}let n=1;for(let e=2;e<r-1;e+=1)O[e]>O[n]&&(n=e);let i=Array(r);k=0;for(let o=1;o<r-1;o+=1){let r=x(b[o+1],b[o]),c=x(b[o],b[o-1]),l;if(O[o+1]>O[o]&&O[o]>O[o-1])l=r;else if(O[o+1]<O[o]&&O[o]<O[o-1])l=c;else{let e=Math.max(Math.abs(O[o+1]-O[o]),Math.abs(O[o-1]-O[o])),t=Math.min(Math.abs(O[o+1]-O[o]),Math.abs(O[o-1]-O[o]));l=O[o+1]>O[o-1]?r.map((n,r)=>n*e+c[r]*t):r.map((n,r)=>n*t+c[r]*e)}let u=Math.max(1e-12,C(l)),d=l.map(e=>e/u),f=t[o].map(e=>-e),p=S(f,d),m;if(e>=s&&o===n)m=f.map((e,t)=>e-2*p*d[t]);else{let e=f.map((e,t)=>e-p*d[t]),t=a*(C(r)-C(c));m=e.map((e,n)=>e+t*d[n])}i[o]=m,k=Math.max(k,...m.map(Math.abs))}if(k<c&&e>=s){A=!0;break}for(let e=1;e<r-1;e+=1){let t=i[e],n=Math.max(1e-12,C(t)),r=Math.min(o,.08/n);for(let n=0;n<_;n+=1)b[e][n][0]+=r*t[n*3],b[e][n][1]+=r*t[n*3+1],b[e][n][2]+=r*t[n*3+2]}}let j=1;for(let e=2;e<r-1;e+=1)O[e]>O[j]&&(j=e);return Object.freeze({schema:F,backend:`webgpu`,gpuRhfCalls:E,images:Object.freeze(b.map(e=>Object.freeze(e.map((e,t)=>Object.freeze({Z:g[t],position:[...e]}))))),energiesHa:Object.freeze([...O]),saddleImageIndex:j,transitionStateAtoms:Object.freeze(b[j].map((e,t)=>Object.freeze({Z:g[t],position:[...e]}))),forwardBarrierHa:Math.max(0,O[j]-O[0]),reverseBarrierHa:Math.max(0,O[j]-O[r-1]),reactionEnergyHa:O[r-1]-O[0],maxForceHaPerBohr:k,steps:ee,converged:A,provenance:Object.freeze({status:`webgpu-derived`,solver:`gpumath-rhf-ci-neb`,scientificValidation:!1})})}function L(e){return!e||typeof e.registerModule!=`function`?null:e.registerModule({method:{model:`molecular-rhf-gpu`,version:`1`},kernel:{sourceModule:`src/runtime/electronicStructure/molecularHartreeFockWebGpu.js`,entryPoint:`sample_molecular_volume`,workgroupSize:64,wgsl:M},parameterSchema:{atoms:{type:`array`},basisName:{type:`string`,default:`auto`},maxScf:{type:`number`,min:4,max:120}},stateLayout:{tensorId:`molecular_rhf_density_and_wiberg_bonds`,dtype:`f32`,components:4},stepCapsule:async(e,t)=>{let n=t?.device;if(!n)throw Error(`molecular-rhf-gpu@1 requires a WebGPU device`);let r=e?.parameters||{};return{status:`ok`,result:await P(n,r.atoms||[],{basisName:r.basisName??`auto`,maxScf:r.maxScf??30,sampleVolume:r.sampleVolume!==!1})}}})}var R=`peercompute.ulg.simulation-module-registration.v1`;function z(e,t=null){return String(e??``).trim()||t}function B(e){if(typeof e==`string`)return e.trim()||null;if(!e||typeof e!=`object`)return null;let t=z(e.model??e.moduleId??e.id);return t?`${t}@${e.version==null?`1`:String(e.version).trim()}`:null}function V(e={},t=null){if(!t||typeof t!=`object`)return{ok:!0};if(!e||typeof e!=`object`)return{ok:!1,reason:`parameters-must-be-object`};for(let[n,r]of Object.entries(t)){if(!r||typeof r!=`object`)continue;let t=e[n];if(t===void 0){if(r.required===!0)return{ok:!1,reason:`missing-required-parameter:${n}`};continue}if(r.type===`number`){let e=Number(t);if(!Number.isFinite(e))return{ok:!1,reason:`non-finite-parameter:${n}`};if(r.min!=null&&e<r.min)return{ok:!1,reason:`parameter-below-min:${n}:${e}<${r.min}`};if(r.max!=null&&e>r.max)return{ok:!1,reason:`parameter-above-max:${n}:${e}>${r.max}`}}else if(r.type===`boolean`&&typeof t!=`boolean`)return{ok:!1,reason:`parameter-not-boolean:${n}`};else if(r.type===`string`&&typeof t!=`string`)return{ok:!1,reason:`parameter-not-string:${n}`}}return{ok:!0}}function H({createArtifact:t=e}={}){let n=new Map,r=new Map;function i(e,t,{device:n=null,sessionId:i=null}={}){let a=z(i,`${e}:default`),o=r.get(a);if(o&&!o.disposed)return o;let s=f({sessionId:a,moduleId:e,device:n,layout:t.stateLayout,initialStep:0});return r.set(a,s),s}function o(e={}){let t=B(e.method??e.methodId??e.id);if(!t)throw TypeError(`Simulation module registration requires method ({ model, version }) or methodId`);if(typeof e.stepCapsule!=`function`)throw TypeError(`Simulation module ${t} requires a stepCapsule(capsule, context) function`);let r=Object.freeze({schema:R,methodKey:t,method:typeof e.method==`object`&&e.method?Object.freeze({...e.method}):Object.freeze({model:t.split(`@`)[0],version:t.split(`@`)[1]||`1`}),kernel:e.kernel&&typeof e.kernel==`object`?Object.freeze({sourceModule:z(e.kernel.sourceModule),entryPoint:z(e.kernel.entryPoint,`main`),workgroupSize:Number.isInteger(e.kernel.workgroupSize)?e.kernel.workgroupSize:64,wgslHash:e.kernel.wgsl?a(e.kernel.wgsl):z(e.kernel.wgslHash)}):null,parameterSchema:e.parameterSchema&&typeof e.parameterSchema==`object`?Object.freeze({...e.parameterSchema}):Object.freeze({}),stateLayout:e.stateLayout&&typeof e.stateLayout==`object`?Object.freeze({tensorId:z(e.stateLayout.tensorId,`state`),dtype:z(e.stateLayout.dtype,`f32`),layout:z(e.stateLayout.layout,`interleaved`),strideElements:Number(e.stateLayout.strideElements)||1,strideBytes:Number(e.stateLayout.strideBytes)||4,fields:Object.freeze(Array.isArray(e.stateLayout.fields)?[...e.stateLayout.fields]:[])}):Object.freeze({tensorId:`state`,dtype:`f32`,layout:`interleaved`,strideElements:1,strideBytes:4,fields:Object.freeze([])}),scaleRangeM:Array.isArray(e.scaleRangeM)&&e.scaleRangeM.length===2?Object.freeze([Number(e.scaleRangeM[0]),Number(e.scaleRangeM[1])]):null,supportsResidentStep:typeof e.stepResident==`function`,registeredAt:new Date().toISOString()});return n.set(t,{descriptor:r,stepCapsule:e.stepCapsule,stepResident:typeof e.stepResident==`function`?e.stepResident:null,reset:typeof e.reset==`function`?e.reset:null,dispose:typeof e.dispose==`function`?e.dispose:null}),r}function s(e){let t=B(e);return t&&n.get(t)||null}function u(e){return s(e)!==null}function d(){return[...n.values()].map(e=>e.descriptor)}function p(e){let t=B(e);if(!t||!n.has(t))return!1;let i=n.get(t);for(let[e,n]of[...r.entries()])n.moduleId===t&&(n.dispose(),r.delete(e));return i.dispose?.(),n.delete(t),!0}function m(e,{device:t=null,sessionId:n=null}={}){let r=s(e);if(!r)throw RangeError(`Unregistered simulation module: ${B(e)||`missing`}`);return i(r.descriptor.methodKey,r.descriptor,{device:t,sessionId:n})}async function h(e,{sessionId:t=null,nextStep:n=0,destroyBuffers:r=!0,reason:a=`module-session-reset`}={}){let o=s(e);if(!o)throw RangeError(`Unregistered simulation module: ${B(e)||`missing`}`);let c=i(o.descriptor.methodKey,o.descriptor,{sessionId:t}),l=c.reset({nextStep:n,destroyBuffers:r,reason:a});return o.reset&&await o.reset({session:c,receipt:l,nextStep:n,reason:a}),l}async function g(e,{device:n=null,gpuLease:r=null,sessionId:a=null}={}){if(!e||e.serviceId!==l.ulgRuntime||e.taskKind!==c.simulationStep)return{matched:!1,reason:`not-ulg-runtime-simulation-step`};let o=s(e.method);if(!o)return{matched:!1,reason:`method-not-registered`};if(!e.taskId||!e.inputHash||!e.methodHash||!e.provenance)throw TypeError(`Registered simulation.step capsule requires taskId, inputHash, methodHash, and provenance`);let u=V(e.input?.parameters,o.descriptor.parameterSchema);if(!u.ok){let e=RangeError(`Invalid simulation parameters for ${o.descriptor.methodKey}: ${u.reason}`);throw e.code=`ERR_INVALID_SIMULATION_MODULE_PARAMETERS`,e}let d=i(o.descriptor.methodKey,o.descriptor,{device:n,sessionId:a??e.input?.sessionId??null}),f=await o.stepCapsule(e,{createSimulationArtifact:t,device:n,gpuLease:r,leaseSession:d,moduleDescriptor:o.descriptor}),p=f?.artifact??f,m=f?.leaseHandle??null,h=d.summary(),g=p&&typeof p==`object`?{...p,execution:{...p.execution||{},registeredModule:o.descriptor.methodKey,gpuLeaseStatus:r?.status??p.execution?.gpuLeaseStatus??null,residentLeaseSession:h}}:p;return{matched:!0,methodKey:o.descriptor.methodKey,artifact:g,leaseHandle:m,leaseSession:d,leaseSummary:h}}return Object.freeze({schema:R,registerModule:o,resolveModule:s,hasModule:u,listModules:d,unregisterModule:p,getModuleLeaseSession:m,resetModuleSession:h,dispatchSimulationStepCapsule:g})}var re=H();export{L as a,x as c,I as i,T as l,H as n,P as o,re as r,A as s,B as t,w as u};