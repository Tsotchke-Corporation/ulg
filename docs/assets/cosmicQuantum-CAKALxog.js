import{Bi as e,Go as t,Jn as n,Li as r,Nt as i,Pn as a,Qi as o,Ro as s,Rs as c,Sr as l,To as u,U as d,V as f,W as p,Wo as m,X as h,ea as g,ei as _,hc as v,kr as y,li as b,m as x,mc as S,n as C,na as w,qt as T,r as ee,rn as te,rt as ne,ti as E,vo as re,wr as D,yc as O,zn as ie}from"./three.webgpu-CS9zZwr2.js";import{n as ae,t as oe}from"./clientDerivationPeers-2eOWXuyw.js";import{E as se,M as ce,P as k,U as le,et as A,i as ue,tt as de,w as j,xw as fe}from"./eshkolTriadClosures-2aA1ll1H.js";import{i as M}from"./nuclearCherenkovClosure-CAxMue-1.js";import{computeBufferBinding as N,createCachedExplicitBindGroup as P,createCachedExplicitComputePipeline as F}from"../runtime/webgpuComputeLayout.js";import{a as I,i as L,r as R,t as pe}from"./elementClosures-DHXGlVwO.js";import{a as me,c as he,d as ge,f as _e,i as ve,l as ye,m as be,n as xe,o as Se,p as Ce,r as we,s as Te,t as Ee,u as De}from"./volumetricOrbitalRaymarcher-CrgVTiqZ.js";import{t as Oe}from"./schroederScaleAtlasMultipoleGpu-D4MpqC8R.js";var ke=`peercompute.ulg.radial-kohn-sham-webgpu.v1`,Ae=1,z=`
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
    var vxc_val: f32 = df_drho;
    if (params.use_pbe != 0u && rhoi > 1e-13) {
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
`,je=`
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
`,B=`
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
`;function V(e){let t=2166136261,n=2654435769;for(let r=0;r<e.length;r+=1){let i=e.charCodeAt(r);t=Math.imul(t^i,16777619)>>>0,n=Math.imul(n^i+r,2246822507)>>>0}return`wgsl-fnv1a64:${t.toString(16).padStart(8,`0`)}${n.toString(16).padStart(8,`0`)}`}var Me=V(`${z}::${je}::${B}`),Ne=new WeakMap;function H(e){let t=Ne.get(e);if(t)return t;let n=e.createShaderModule({label:`ulg-ks-potential-wgsl`,code:z}),r=e.createShaderModule({label:`ulg-ks-observables-wgsl`,code:je}),i=e.createShaderModule({label:`ulg-ks-spinorbit-wgsl`,code:B}),a=e.createBindGroupLayout({label:`ulg-ks-pot-bgl`,entries:[{binding:0,visibility:4,buffer:{type:`uniform`}},{binding:1,visibility:4,buffer:{type:`read-only-storage`}},{binding:2,visibility:4,buffer:{type:`storage`}},{binding:3,visibility:4,buffer:{type:`storage`}},{binding:4,visibility:4,buffer:{type:`storage`}},{binding:5,visibility:4,buffer:{type:`storage`}},{binding:6,visibility:4,buffer:{type:`storage`}}]}),o=e.createBindGroupLayout({label:`ulg-ks-obs-bgl`,entries:[{binding:0,visibility:4,buffer:{type:`uniform`}},{binding:1,visibility:4,buffer:{type:`read-only-storage`}},{binding:2,visibility:4,buffer:{type:`read-only-storage`}},{binding:3,visibility:4,buffer:{type:`read-only-storage`}},{binding:4,visibility:4,buffer:{type:`storage`}},{binding:5,visibility:4,buffer:{type:`read-only-storage`}},{binding:6,visibility:4,buffer:{type:`read-only-storage`}},{binding:7,visibility:4,buffer:{type:`storage`}}]}),s=e.createBindGroupLayout({label:`ulg-ks-so-bgl`,entries:[{binding:0,visibility:4,buffer:{type:`uniform`}},{binding:1,visibility:4,buffer:{type:`read-only-storage`}},{binding:2,visibility:4,buffer:{type:`read-only-storage`}},{binding:3,visibility:4,buffer:{type:`read-only-storage`}},{binding:4,visibility:4,buffer:{type:`read-only-storage`}},{binding:5,visibility:4,buffer:{type:`storage`}}]});return t={potPipeline:e.createComputePipeline({label:`ulg-ks-pot-pipe`,layout:e.createPipelineLayout({bindGroupLayouts:[a]}),compute:{module:n,entryPoint:`ks_hartree_pbe_xc`}}),obsPipeline:e.createComputePipeline({label:`ulg-ks-obs-pipe`,layout:e.createPipelineLayout({bindGroupLayouts:[o]}),compute:{module:r,entryPoint:`ks_density_and_observables`}}),soPipeline:e.createComputePipeline({label:`ulg-ks-so-pipe`,layout:e.createPipelineLayout({bindGroupLayouts:[s]}),compute:{module:i,entryPoint:`ks_spin_orbit_quadrature`}}),potBgl:a,obsBgl:o,soBgl:s},Ne.set(e,t),t}async function Pe(e,t,{functional:n=`pbe`,spinOrbit:r=!0,configuration:i=null,gridPointsN:a=256,rMinBohr:o=1e-5,rMaxBohr:s=null,mixing:c=.25,maxScf:l=80,tol:u=1e-4,returnRadialDensity:d=!0}={}){if(!e||typeof e.createComputePipeline!=`function`)throw TypeError(`solveAtomWebGpu requires a valid WebGPU GPUDevice.`);let f=Math.min(256,Math.max(64,Math.floor(a))),p=+(String(n||`pbe`).toLowerCase()===`pbe`),m=s??Math.max(20,60/Math.sqrt(t)),h=Math.log(o),g=(Math.log(m)-h)/(f-1),_=new Float64Array(f),v=new Float32Array(f),y=new Float32Array(f);for(let e=0;e<f;e+=1){let n=Math.exp(h+e*g);_[e]=n,v[e]=n,y[e]=t*(t**3/Math.PI)*Math.exp(-2*t*n)}let b=i??A(t),x=new Map;for(let e of b)x.set(e.l,Math.max(x.get(e.l)||0,e.n-e.l));let S=b.length,{potPipeline:C,obsPipeline:w,soPipeline:T,potBgl:ee,obsBgl:te,soBgl:ne}=H(e),E=f*4,re=new ArrayBuffer(32),D=new Uint32Array(re),O=new Float32Array(re);D[0]=f,D[1]=p,O[2]=t,O[3]=g,O[4]=c,D[5]=S;let ie=e.createBuffer({size:32,usage:72}),ae=e.createBuffer({size:E,usage:136}),oe=e.createBuffer({size:E,usage:140}),se=e.createBuffer({size:E,usage:132}),k=e.createBuffer({size:E,usage:132}),le=e.createBuffer({size:E,usage:132}),ue=e.createBuffer({size:E,usage:132}),j=e.createBuffer({size:E*4,usage:136}),fe=e.createBuffer({size:Math.max(1,S)*E,usage:136}),M=e.createBuffer({size:Math.max(1,S)*16,usage:136}),N=e.createBuffer({size:16,usage:132}),P=e.createBuffer({size:Math.max(1,S)*16,usage:132}),F=e.createBuffer({size:E*3,usage:9}),I=e.createBuffer({size:16,usage:9}),L=e.createBuffer({size:E+Math.max(1,S)*16,usage:9});try{e.queue.writeBuffer(ie,0,re),e.queue.writeBuffer(ae,0,v),e.queue.writeBuffer(oe,0,y);let n=e.createBindGroup({layout:ee,entries:[{binding:0,resource:{buffer:ie}},{binding:1,resource:{buffer:ae}},{binding:2,resource:{buffer:oe}},{binding:3,resource:{buffer:se}},{binding:4,resource:{buffer:k}},{binding:5,resource:{buffer:le}},{binding:6,resource:{buffer:ue}}]}),i=e.createBindGroup({layout:te,entries:[{binding:0,resource:{buffer:ie}},{binding:1,resource:{buffer:ae}},{binding:2,resource:{buffer:fe}},{binding:3,resource:{buffer:M}},{binding:4,resource:{buffer:oe}},{binding:5,resource:{buffer:se}},{binding:6,resource:{buffer:j}},{binding:7,resource:{buffer:N}}]}),a=e.createBindGroup({layout:ne,entries:[{binding:0,resource:{buffer:ie}},{binding:1,resource:{buffer:ae}},{binding:2,resource:{buffer:fe}},{binding:3,resource:{buffer:M}},{binding:4,resource:{buffer:ue}},{binding:5,resource:{buffer:P}}]}),o=new Map,s=new Float32Array(S*f),c=new Float32Array(S*4),m=new Float32Array(f*4),h=new Float64Array(f),D=new Map,O=0,A=1/0,R={integratedElectrons:0,eHartreeDouble:0,eXcCorrection:0,scfL1Delta:0};for(let r=0;r<l;r+=1){O=r+1;let a=e.createCommandEncoder(),l=a.beginComputePass();l.setPipeline(C),l.setBindGroup(0,n),l.dispatchWorkgroups(1,1,1),l.end(),a.copyBufferToBuffer(k,0,F,0,E),a.copyBufferToBuffer(le,0,F,E,E),a.copyBufferToBuffer(ue,0,F,E*2,E),e.queue.submit([a.finish()]),await F.mapAsync(Ae);let d=new Float32Array(F.getMappedRange().slice(0));F.unmap();for(let e=0;e<f;e+=1)m[e*4+0]=d[e],m[e*4+1]=d[f+e],m[e*4+2]=d[f*2+e],m[e*4+3]=0,h[e]=d[f*2+e];D=new Map;for(let[e,n]of x){let r=ce(h,_,g,e,n,t,o.get(e));o.set(e,r.map(e=>e.energyHa)),D.set(e,r)}for(let e=0;e<S;e+=1){let t=b[e],n=D.get(t.l)[t.n-t.l-1];c[e*4+0]=t.n,c[e*4+1]=t.l,c[e*4+2]=t.occupancy,c[e*4+3]=n.energyHa;let r=e*f;for(let e=0;e<f;e+=1)s[r+e]=n.u[e]}e.queue.writeBuffer(j,0,m),e.queue.writeBuffer(fe,0,s),e.queue.writeBuffer(M,0,c);let p=e.createCommandEncoder(),v=p.beginComputePass();v.setPipeline(w),v.setBindGroup(0,i),v.dispatchWorkgroups(1,1,1),v.end(),p.copyBufferToBuffer(N,0,I,0,16),e.queue.submit([p.finish()]),await I.mapAsync(Ae);let y=new Float32Array(I.getMappedRange().slice(0));if(I.unmap(),R={integratedElectrons:y[0],eHartreeDouble:y[1],eXcCorrection:y[2],scfL1Delta:y[3]},A=R.scfL1Delta,A<u&&r>6)break}let pe=e.createCommandEncoder(),me=pe.beginComputePass();me.setPipeline(T),me.setBindGroup(0,a),me.dispatchWorkgroups(Math.max(1,S),1,1),me.end(),pe.copyBufferToBuffer(oe,0,L,0,E),pe.copyBufferToBuffer(P,0,L,E,Math.max(1,S)*16),e.queue.submit([pe.finish()]),await L.mapAsync(Ae);let he=new Float32Array(L.getMappedRange().slice(0));L.unmap();let ge=Array.from(he.slice(0,f)),_e=he.slice(f),ve=0,ye=0,be=[];for(let e=0;e<S;e+=1){let t=b[e],n=D.get(t.l)[t.n-t.l-1];ve+=t.occupancy*n.energyHa,ye+=t.occupancy;let i={n:t.n,l:t.l,occupancy:t.occupancy,energyHa:n.energyHa};r&&t.l>=1&&(i.spinOrbitXiHa=_e[e*4+0],i.spinOrbitSplittingHa=_e[e*4+1],i.energyJMinusHa=_e[e*4+2],i.energyJPlusHa=_e[e*4+3]),be.push(i)}let xe=ve-R.eHartreeDouble+R.eXcCorrection;return{schema:ke,symbol:de(t),atomicNumberZ:t,configuration:b,functional:p?`pbe`:`lda`,relativisticMethod:r?`koelling-harmon+spin-orbit`:`koelling-harmon`,totalEnergyHa:xe,orbitals:be,electronCount:ye,integratedElectrons:R.integratedElectrons,scfIterations:O,scfL1Delta:A,resolverStatus:`webgpu-derived`,webgpuProgramHash:Me,...d?{radialGrid:{r:Array.from(_),rho:ge,dx:g}}:{},validation:Object.freeze({scientificValidation:!1,webgpuParity:!1})}}finally{ie.destroy(),ae.destroy(),oe.destroy(),se.destroy(),k.destroy(),le.destroy(),ue.destroy(),j.destroy(),fe.destroy(),M.destroy(),N.destroy(),P.destroy(),F.destroy(),I.destroy(),L.destroy()}}var Fe=`peercompute.ulg.optical-resolver-webgpu.v1`,Ie=6582119569e-25,U=1,Le=`
struct OpticalDescriptor {
  plasma_energy_ev: f32,
  damping_ev: f32,
  path_length_m: f32,
  osc_offset: f32,
  osc_count: f32,
  mode: f32,
  param0: f32,
  param1: f32,
};

struct OpticalOscillator {
  energy_ev: f32,
  damping_ev: f32,
  strength_weight: f32,
  _pad: f32,
};

struct OpticalOutputRow {
  base_r: f32,
  base_g: f32,
  base_b: f32,
  reflectance: f32,
  absorption_or_photons: f32,
  optical_depth_or_angle_deg: f32,
  opacity_or_active: f32,
  transmission: f32,
  metalness: f32,
  roughness: f32,
  cie_x: f32,
  cie_y: f32,
  cie_z: f32,
  plasma_energy_ev: f32,
  osc_count: f32,
  mode: f32,
};

struct SpectralSampleRow {
  wavelength_nm: f32,
  reflectance: f32,
  absorption_per_m: f32,
  n_re: f32,
};

@group(0) @binding(0) var<storage, read> descriptors: array<OpticalDescriptor>;
@group(0) @binding(1) var<storage, read> oscillators: array<OpticalOscillator>;
@group(0) @binding(2) var<storage, read_write> outputs: array<OpticalOutputRow>;
@group(0) @binding(3) var<storage, read_write> spectral_samples: array<SpectralSampleRow>;

const PI: f32 = 3.14159265358979323846;
const FINE_STRUCTURE_ALPHA: f32 = 0.0072973525693;
const INTERBAND_STRENGTH_SCALE: f32 = 0.36;
const NUM_WAVELENGTHS: u32 = 81u;

var<workgroup> sh_x: array<f32, 128>;
var<workgroup> sh_y: array<f32, 128>;
var<workgroup> sh_z: array<f32, 128>;
var<workgroup> sh_norm: array<f32, 128>;
var<workgroup> sh_refl: array<f32, 128>;
var<workgroup> sh_abs: array<f32, 128>;
var<workgroup> sh_peak: array<f32, 128>;
var<workgroup> sh_raw_spec: array<f32, 128>;

fn gauss_piecewise(x: f32, mu: f32, s1: f32, s2: f32) -> f32 {
  let inv_s = select(1.0 / s2, 1.0 / s1, x < mu);
  let t = (x - mu) * inv_s;
  return exp(-0.5 * t * t);
}

fn cie_x(nm: f32) -> f32 {
  return 1.056 * gauss_piecewise(nm, 599.8, 37.9, 31.0)
    + 0.362 * gauss_piecewise(nm, 442.0, 16.0, 26.7)
    - 0.065 * gauss_piecewise(nm, 501.1, 20.4, 26.2);
}

fn cie_y(nm: f32) -> f32 {
  return 0.821 * gauss_piecewise(nm, 568.8, 46.9, 40.5)
    + 0.286 * gauss_piecewise(nm, 530.9, 16.3, 31.1);
}

fn cie_z(nm: f32) -> f32 {
  return 1.217 * gauss_piecewise(nm, 437.0, 11.8, 36.0)
    + 0.681 * gauss_piecewise(nm, 459.0, 26.0, 13.8);
}

fn srgb_encode(c: f32) -> f32 {
  let x = clamp(c, 0.0, 1.0);
  if (x <= 0.0031308) {
    return 12.92 * x;
  }
  return 1.055 * pow(x, 1.0 / 2.4) - 0.055;
}

fn cdiv(a: vec2<f32>, b: vec2<f32>) -> vec2<f32> {
  let denom = max(b.x * b.x + b.y * b.y, 1e-30);
  return vec2<f32>(
    (a.x * b.x + a.y * b.y) / denom,
    (a.y * b.x - a.x * b.y) / denom
  );
}

@compute @workgroup_size(128, 1, 1)
fn resolve_optical_materials(
  @builtin(workgroup_id) wg_id: vec3<u32>,
  @builtin(local_invocation_id) lid: vec3<u32>
) {
  let mat_idx = wg_id.x;
  let tid = lid.x;
  if (mat_idx >= arrayLength(&descriptors)) {
    return;
  }

  let desc = descriptors[mat_idx];
  let mode = u32(round(desc.mode));
  let active_wl = tid < NUM_WAVELENGTHS;
  let nm = 380.0 + 5.0 * f32(tid);
  let wy = select(0.0, cie_y(nm), active_wl);
  let wx = select(0.0, cie_x(nm), active_wl);
  let wz = select(0.0, cie_z(nm), active_wl);

  var s_resp: f32 = 0.0;
  var refl_val: f32 = 0.0;
  var abs_val: f32 = 0.0;
  var n_re_val: f32 = 1.0;
  var raw_cherenkov: f32 = 0.0;

  if (active_wl) {
    let photon_ev = 1239.841984 / nm;
    if (mode == 0u) {
      // Drude-Lorentz + spin-orbit relativistic interband dielectric
      let wp2 = desc.plasma_energy_ev * desc.plasma_energy_ev;
      var eps = vec2<f32>(1.0, 0.0) - cdiv(
        vec2<f32>(wp2, 0.0),
        vec2<f32>(photon_ev * photon_ev, photon_ev * desc.damping_ev)
      );
      let osc_start = u32(max(0.0, desc.osc_offset));
      let osc_count = u32(max(0.0, desc.osc_count));
      let osc_limit = arrayLength(&oscillators);
      for (var k: u32 = 0u; k < osc_count; k = k + 1u) {
        let idx = osc_start + k;
        if (idx >= osc_limit) { break; }
        let osc = oscillators[idx];
        let strength_ev2 = INTERBAND_STRENGTH_SCALE * wp2 * osc.strength_weight;
        eps = eps + cdiv(
          vec2<f32>(strength_ev2, 0.0),
          vec2<f32>(osc.energy_ev * osc.energy_ev - photon_ev * photon_ev, -osc.damping_ev * photon_ev)
        );
      }
      let mag = sqrt(eps.x * eps.x + eps.y * eps.y);
      let n_re = sqrt(max(0.0, 0.5 * (mag + eps.x)));
      let k_im = sqrt(max(0.0, 0.5 * (mag - eps.x)));
      let num_r = (n_re - 1.0) * (n_re - 1.0) + k_im * k_im;
      let den_r = max((n_re + 1.0) * (n_re + 1.0) + k_im * k_im, 1e-30);
      refl_val = clamp(num_r / den_r, 0.0, 1.0);
      abs_val = (4.0 * PI * k_im) / (nm * 1e-9);
      n_re_val = n_re;
      s_resp = refl_val;
    } else if (mode == 1u) {
      // Frank-Tamm Cherenkov spectral photon density d^2N/(dx dlambda)
      let beta = desc.param0;
      let n_ior = max(1.0, desc.param1);
      let z_charge = desc.plasma_energy_ev;
      let sin2 = select(-1.0, 1.0 - 1.0 / (beta * beta * n_ior * n_ior), beta > 0.0);
      if (sin2 > 0.0) {
        let lam_m = nm * 1e-9;
        raw_cherenkov = ((2.0 * PI * FINE_STRUCTURE_ALPHA * z_charge * z_charge) / (lam_m * lam_m)) * sin2;
      }
      abs_val = raw_cherenkov * 5e-9; // photons per meter in this 5 nm bin
      n_re_val = n_ior;
    } else {
      // Mode 2: Band-gap Beer-Lambert transmission
      let gap_ev = desc.param0;
      let density_cross = desc.param1;
      let osc_frac = select(0.0, clamp((photon_ev - gap_ev) / max(1.0, photon_ev), 0.0, 1.0), photon_ev > gap_ev);
      abs_val = density_cross * osc_frac;
      refl_val = 0.04;
      n_re_val = 1.4;
      s_resp = exp(-min(80.0, abs_val * max(0.0, desc.path_length_m)));
    }
  }

  // For Cherenkov mode, first reduce peak spectrum across the workgroup so s_resp = raw / peak
  sh_raw_spec[tid] = raw_cherenkov;
  sh_peak[tid] = raw_cherenkov;
  workgroupBarrier();

  for (var stride: u32 = 64u; stride > 0u; stride = stride >> 1u) {
    if (tid < stride) {
      sh_peak[tid] = max(sh_peak[tid], sh_peak[tid + stride]);
    }
    workgroupBarrier();
  }

  if (mode == 1u && active_wl) {
    let peak = sh_peak[0];
    s_resp = select(0.0, clamp(sh_raw_spec[tid] / peak, 0.0, 1.0), peak > 0.0);
    refl_val = s_resp;
  }

  // Write the 9 canonical spectral sample slots: indices 0, 10, 20, ..., 80 -> 380, 430, ..., 780 nm
  if (active_wl && (tid % 10u) == 0u) {
    let sample_idx = tid / 10u;
    let out_sample = mat_idx * 9u + sample_idx;
    if (out_sample < arrayLength(&spectral_samples)) {
      spectral_samples[out_sample] = SpectralSampleRow(nm, refl_val, abs_val, n_re_val);
    }
  }

  sh_x[tid] = s_resp * wx;
  sh_y[tid] = s_resp * wy;
  sh_z[tid] = s_resp * wz;
  sh_norm[tid] = wy;
  sh_refl[tid] = refl_val * wy;
  sh_abs[tid] = select(abs_val * wy, abs_val, mode == 1u);
  workgroupBarrier();

  for (var stride: u32 = 64u; stride > 0u; stride = stride >> 1u) {
    if (tid < stride) {
      sh_x[tid] = sh_x[tid] + sh_x[tid + stride];
      sh_y[tid] = sh_y[tid] + sh_y[tid + stride];
      sh_z[tid] = sh_z[tid] + sh_z[tid + stride];
      sh_norm[tid] = sh_norm[tid] + sh_norm[tid + stride];
      sh_refl[tid] = sh_refl[tid] + sh_refl[tid + stride];
      sh_abs[tid] = sh_abs[tid] + sh_abs[tid + stride];
    }
    workgroupBarrier();
  }

  if (tid == 0u) {
    let norm = max(sh_norm[0], 1e-30);
    let X = sh_x[0] / norm;
    let Y = sh_y[0] / norm;
    let Z = sh_z[0] / norm;
    let lin_r = 3.2406 * X - 1.5372 * Y - 0.4986 * Z;
    let lin_g = -0.9689 * X + 1.8758 * Y + 0.0415 * Z;
    let lin_b = 0.0557 * X - 0.2040 * Y + 1.0570 * Z;
    var base_r = srgb_encode(max(0.0, lin_r));
    var base_g = srgb_encode(max(0.0, lin_g));
    var base_b = srgb_encode(max(0.0, lin_b));
    let mean_refl = sh_refl[0] / norm;
    var abs_or_photons = select(sh_abs[0] / norm, sh_abs[0], mode == 1u);
    var depth_or_angle: f32 = 0.0;
    var opacity_or_active: f32 = 0.0;
    var transmission: f32 = 1.0;
    var metalness: f32 = 0.0;
    var roughness: f32 = 0.32;

    if (mode == 1u) {
      let peak = sh_peak[0];
      let is_active = peak > 0.0 && abs_or_photons > 0.0;
      if (is_active) {
        let beta = desc.param0;
        let n_ior = max(1.0, desc.param1);
        let cos_t = clamp(1.0 / max(beta * n_ior, 1e-12), -1.0, 1.0);
        depth_or_angle = acos(cos_t) * (180.0 / PI);
        opacity_or_active = 1.0;
      } else {
        base_r = 0.0;
        base_g = 0.0;
        base_b = 0.0;
        abs_or_photons = 0.0;
        depth_or_angle = 0.0;
        opacity_or_active = 0.0;
      }
      roughness = 0.1;
    } else {
      depth_or_angle = abs_or_photons * max(0.0, desc.path_length_m);
      opacity_or_active = select(0.0, 1.0 - exp(-min(80.0, depth_or_angle)), depth_or_angle > 0.0);
      transmission = exp(-min(80.0, depth_or_angle));
      if (mode == 0u) {
        metalness = select(opacity_or_active, 1.0, opacity_or_active > 0.5);
        roughness = 0.32;
      } else {
        metalness = 0.0;
        roughness = 0.4;
      }
    }

    outputs[mat_idx] = OpticalOutputRow(
      base_r, base_g, base_b, mean_refl,
      abs_or_photons, depth_or_angle, opacity_or_active, transmission,
      metalness, roughness, X, Y, Z,
      desc.plasma_energy_ev, desc.osc_count, desc.mode
    );
  }
}
`;function W(e){let t=2166136261,n=2654435769;for(let r=0;r<e.length;r+=1){let i=e.charCodeAt(r);t=Math.imul(t^i,16777619)>>>0,n=Math.imul(n^i+r,2246822507)>>>0}return`wgsl-fnv1a64:${t.toString(16).padStart(8,`0`)}${n.toString(16).padStart(8,`0`)}`}var Re=W(Le),ze=new WeakMap;function Be(e){let t=ze.get(e);if(t)return t;let n=e.createShaderModule({label:`ulg-optical-resolver-wgsl`,code:Le}),r=e.createBindGroupLayout({label:`ulg-optical-resolver-bgl`,entries:[{binding:0,visibility:4,buffer:{type:`read-only-storage`}},{binding:1,visibility:4,buffer:{type:`read-only-storage`}},{binding:2,visibility:4,buffer:{type:`storage`}},{binding:3,visibility:4,buffer:{type:`storage`}}]}),i=e.createPipelineLayout({label:`ulg-optical-resolver-pl`,bindGroupLayouts:[r]});return t={pipeline:e.createComputePipeline({label:`ulg-optical-resolver-pipeline`,layout:i,compute:{module:n,entryPoint:`resolve_optical_materials`}}),bindGroupLayout:r},ze.set(e,t),t}function G(e=[]){let t=Array.isArray(e)?e:[],n=new Float32Array(Math.max(1,t.length)*8),r=[];for(let e=0;e<t.length;e+=1){let i=t[e]||{},a=Number.isInteger(i.mode)?i.mode:0,o=e*8;if(a===0){let e=Number.isFinite(i.plasmaRadPerS)?i.plasmaRadPerS:j(Math.max(1e10,Number(i.conductionElectronDensityPerM3)||1e28)),t=Number.isFinite(i.plasmaEnergyEv)?i.plasmaEnergyEv:Ie*e,a=Number.isFinite(i.dampingEv)?i.dampingEv:t/30,s=Array.isArray(i.interbandOscillators)?i.interbandOscillators:i.atomicNumberZ?se({atomicNumberZ:i.atomicNumberZ,conductionElectronDensityPerM3:i.conductionElectronDensityPerM3,options:i.interbandOptions||{}}):[],c=r.length;for(let e of s)r.push([Number(e.energyEv)||0,Number(e.dampingEv)||.22,Number(e.strengthWeight)||0,0]);n[o+0]=t,n[o+1]=a,n[o+2]=Number.isFinite(i.pathLengthM)?i.pathLengthM:.3,n[o+3]=c,n[o+4]=s.length,n[o+5]=0,n[o+6]=0,n[o+7]=0}else a===1?(n[o+0]=Number.isFinite(i.chargeZ)?i.chargeZ:1,n[o+1]=0,n[o+2]=0,n[o+3]=0,n[o+4]=0,n[o+5]=1,n[o+6]=Math.max(0,Math.min(.9999999,Number(i.beta)||0)),n[o+7]=Math.max(1,Number(i.refractiveIndex)||1.333)):(n[o+0]=0,n[o+1]=0,n[o+2]=Number.isFinite(i.pathLengthM)?i.pathLengthM:.3,n[o+3]=0,n[o+4]=0,n[o+5]=2,n[o+6]=Math.max(0,Number(i.electronicGapEv)||0),n[o+7]=Math.max(0,Number(i.densityCrossSectionPerM)||0))}let i=new Float32Array(Math.max(1,r.length)*4);for(let e=0;e<r.length;e+=1){let t=r[e],n=e*4;i[n+0]=t[0],i[n+1]=t[1],i[n+2]=t[2],i[n+3]=t[3]}return{materialCount:t.length,oscillatorCount:r.length,descData:n,oscData:i}}async function K(e,t=[],{keepResident:n=!1}={}){if(!e||typeof e.createComputePipeline!=`function`)throw TypeError(`resolveOpticalBatchWebGpu requires a valid WebGPU GPUDevice.`);let r=G(t),i=r.materialCount;if(i===0)return{schema:Fe,resolverStatus:`webgpu-derived`,webgpuProgramHash:Re,results:[],residentBuffers:null};let{pipeline:a,bindGroupLayout:o}=Be(e),s=e.createBuffer({label:`ulg-opt-desc`,size:r.descData.byteLength,usage:136}),c=e.createBuffer({label:`ulg-opt-osc`,size:r.oscData.byteLength,usage:136}),l=i*16*Float32Array.BYTES_PER_ELEMENT,u=e.createBuffer({label:`ulg-opt-out`,size:l,usage:132}),d=i*9*4*Float32Array.BYTES_PER_ELEMENT,f=e.createBuffer({label:`ulg-opt-spec`,size:d,usage:132}),p=e.createBuffer({label:`ulg-opt-out-read`,size:l,usage:9}),m=e.createBuffer({label:`ulg-opt-spec-read`,size:d,usage:9});try{e.queue.writeBuffer(s,0,r.descData),e.queue.writeBuffer(c,0,r.oscData);let t=e.createBindGroup({label:`ulg-opt-bg`,layout:o,entries:[{binding:0,resource:{buffer:s}},{binding:1,resource:{buffer:c}},{binding:2,resource:{buffer:u}},{binding:3,resource:{buffer:f}}]}),h=e.createCommandEncoder({label:`ulg-opt-resolver-enc`}),g=h.beginComputePass({label:`ulg-opt-resolver-pass`});g.setPipeline(a),g.setBindGroup(0,t),g.dispatchWorkgroups(i,1,1),g.end(),h.copyBufferToBuffer(u,0,p,0,l),h.copyBufferToBuffer(f,0,m,0,d),e.queue.submit([h.finish()]),await Promise.all([p.mapAsync(U),m.mapAsync(U)]);let _=new Float32Array(p.getMappedRange().slice(0)),v=new Float32Array(m.getMappedRange().slice(0));p.unmap(),m.unmap();let y=[];for(let e=0;e<i;e+=1){let t=e*16,n=Math.round(_[t+15]),r=[];for(let t=0;t<9;t+=1){let n=(e*9+t)*4;r.push({wavelengthNm:v[n+0],reflectance:v[n+1],absorptionCoefficientPerM:v[n+2],nRe:v[n+3]})}let i=[_[t+0],_[t+1],_[t+2]];y.push({mode:n,baseColorSrgb:i,r:i[0],g:i[1],b:i[2],reflectance:_[t+3],absorptionCoefficientPerM:n===1?0:_[t+4],photonsPerMeter:n===1?_[t+4]:0,opticalDepth:n===1?0:_[t+5],cherenkovAngleDeg:n===1?_[t+5]:0,opacity:n===1?0:_[t+6],active:n===1?_[t+6]>.5:!0,transmission:_[t+7],metalness:_[t+8],roughness:_[t+9],cieXYZ:[_[t+10],_[t+11],_[t+12]],plasmaEnergyEv:_[t+13],oscillatorCount:Math.round(_[t+14]),spectralSamples:r,resolverStatus:`webgpu-derived`,webgpuProgramHash:Re,validation:Object.freeze({scientificValidation:!1,opticalValidation:!1,webgpuParity:!1})})}return{schema:Fe,resolverStatus:`webgpu-derived`,webgpuProgramHash:Re,materialCount:i,results:y,residentBuffers:n?{outputBuffer:u,spectralBuffer:f,destroy(){u.destroy(),f.destroy()}}:null}}finally{s.destroy(),c.destroy(),p.destroy(),m.destroy(),n||(u.destroy(),f.destroy())}}async function Ve(e,{atomicNumberZ:t=null,conductionElectronDensityPerM3:n,pathLengthM:r=.3,interbandOscillators:i=null,interbandOptions:a={},keepResident:o=!1}={}){let s=await K(e,[{mode:0,atomicNumberZ:t,conductionElectronDensityPerM3:n,pathLengthM:r,interbandOscillators:i,interbandOptions:a}],{keepResident:o});return{...s.results[0],residentBuffers:s.residentBuffers}}var q=`peercompute.ulg.material-resolver-manifest.v0`,J=Object.freeze({CPU_DERIVED:`cpu-derived`,WEBGPU_DERIVED:`webgpu-derived`,WEBGPU_DERIVED_WITH_CPU_FALLBACK:`webgpu-derived-with-cpu-fallback`,CPU_DERIVED_GPU_LOOKUP_CONSUMED:`cpu-derived-gpu-lookup-consumed`,CPU_BUILT_GPU_CONSUMED:`cpu-built-gpu-consumed`,MIXED_WEBGPU_RUNTIME_CPU_PROPERTY_DERIVED:`mixed-webgpu-runtime-cpu-property-derived`,CPU_DERIVED_GPU_CONTACT_CONSUMED:`cpu-derived-gpu-contact-consumed`,CPU_EMISSION_ONLY_NUCLEAR_PLANNED:`cpu-emission-only-nuclear-planned`,CPU_CONTROL_PLANE_POLICY:`cpu-control-plane-policy`}),He=Object.freeze([`cpuReferenceParity`,`webgpuParity`,`scientificValidation`,`productionReadiness`]);function Ue(){return Object.fromEntries(He.map(e=>[e,!1]))}function We(e){if(!e||typeof e!=`object`||Object.isFrozen(e))return e;for(let t of Object.values(e))We(t);return Object.freeze(e)}We({schema:q,families:[{id:`peercompute.ulg.material-resolver.electronic-structure-band-optics.v0`,family:`electronic-structure-band-optics`,label:`Electronic structure and band optics`,cpu:{status:`known-cpu-entrypoints`,entrypoints:[{module:`src/runtime/electronicStructure/radialKohnSham.js`,exports:[`solveAtom`,`solveKohnShamAtomKH`,`radialStatesKH`]},{module:`src/runtime/electronicStructure/radialKohnShamWebGpu.js`,exports:[`solveAtomWebGpu`,`evaluateRadialKohnShamPotentialsWebGpu`,`RADIAL_KS_WEBGPU_PROGRAM_HASH`]},{module:`src/runtime/material/elementClosures.js`,exports:[`deriveElementProperties`,`elementMaterialClosure`]},{module:`src/runtime/material/opticalClosure.js`,exports:[`relativisticInterbandOscillators`,`metalRelativisticColorSrgb`]}]},webgpuResidencyTarget:{target:`webgpu-derived-resident-electronic-row-family`,residency:`worker-owned radial-grid, SCF, eigensolver, orbital, and interband oscillator buffers feeding material and optical rows without CPU recomputation`},cacheKeyIngredients:[`atomicNumberZ`,`electronConfiguration`,`solverVariant`,`radialGridShape`,`scfTolerance`,`spinRelativisticFlags`,`interbandModelParameters`,`webgpuProgramHash`,`schemaVersion`,`generatorFingerprint`],currentStatus:J.WEBGPU_DERIVED_WITH_CPU_FALLBACK,validationFlags:Ue()},{id:`peercompute.ulg.material-resolver.molecular-geometry-md.v0`,family:`molecular-geometry-md`,label:`Molecular geometry and MD`,cpu:{status:`known-cpu-entrypoints`,entrypoints:[{module:`src/runtime/electronicStructure/molecularHartreeFock.js`,exports:[`rhf`,`uhf`,`mp2`,`optimizeGeometry`,`vibrationalFrequencies`,`bornOppenheimerMD`]},{module:`src/runtime/electronicStructure/allElementMolecularSolver.js`,exports:[`allElementMolecularEnergy`,`allElementReactionEnergyHa`]},{module:`src/runtime/material/materialDerivation.js`,exports:[`formulaUnitGeometry`,`deriveFormulaMaterialProperties`]}]},webgpuResidencyTarget:{target:`webgpu-derived-resident-molecular-row-family`,residency:`batched small-molecule matrix, SCF, geometry, Hessian, and Born-Oppenheimer work queues producing reusable molecular closure rows`},cacheKeyIngredients:[`formulaAtomVector`,`charge`,`spinMultiplicity`,`initialGeometryHash`,`basisOrHamiltonianMethod`,`optimizerOrMdStepPolicy`,`temperatureBucket`,`schemaVersion`,`generatorFingerprint`],currentStatus:J.CPU_DERIVED,validationFlags:Ue()},{id:`peercompute.ulg.material-resolver.thermodynamic-phase-eos.v0`,family:`thermodynamic-phase-eos`,label:`Thermodynamic phase and EOS`,cpu:{status:`known-cpu-entrypoints`,entrypoints:[{module:`src/runtime/material/phaseEquilibrium.js`,exports:[`stablePhaseAt`,`stablePhaseFromSpecificEnergy`,`equilibriumFromSpecificEnergy`]},{module:`src/runtime/material/thermoState.js`,exports:[`specificInternalEnergyJPerKg`,`heatCapacityJPerKgK`,`orderedSegments`]},{module:`src/runtime/material/gruneisenEos.js`,exports:[`densityAtTemperature`,`createGruneisenEosClosure`]},{module:`src/runtime/sph/sphThermalGpuKernel.js`,exports:[`buildSphThermalMaterialTable`,`buildSphThermalPhaseResponseTable`,`resolveThermalStateFromTable`]}]},webgpuResidencyTarget:{target:`webgpu-built-resident-phase-response-graph`,residency:`resident phase segments, latent-heat ladders, EOS rows, and thermal graph banks consumed by thermal, mechanics, gas, optics, and render kernels`},cacheKeyIngredients:[`materialClosureHash`,`phaseSegmentHash`,`transitionLedgerHash`,`eosModelHash`,`temperatureEnergyBucketPolicy`,`pressureDomain`,`schemaVersion`,`generatorFingerprint`],currentStatus:J.CPU_BUILT_GPU_CONSUMED,validationFlags:Ue()},{id:`peercompute.ulg.material-resolver.mechanical-properties.v0`,family:`mechanical-properties`,label:`Mechanical properties`,cpu:{status:`known-cpu-entrypoints`,entrypoints:[{module:`src/runtime/material/elementClosures.js`,exports:[`deriveElementProperties`]},{module:`src/runtime/sph/multiMaterialEos.js`,exports:[`createPhaseAwareEos`]},{module:`src/runtime/sph/mlsMpmCarrier.js`,exports:[`createMlsMpmCarrier`]},{module:`src/runtime/sph/sphMechanicsGpuKernel.js`,exports:[`predictMlsMpmMechanicsCpu`,`runMlsMpmMechanicsPredictWebGpu`]}]},webgpuResidencyTarget:{target:`webgpu-resident-mechanics-material-rows`,residency:`phase-aware density, bulk/shear modulus, sound-speed, viscosity, transport, and mechanics reset rows updated from GPU material and phase outputs`},cacheKeyIngredients:[`materialClosureHash`,`phaseStateHash`,`eosRowLayoutVersion`,`mechanicsModelVersion`,`transportModelVersion`,`gridAndParticleAbiVersion`,`schemaVersion`,`generatorFingerprint`],currentStatus:J.MIXED_WEBGPU_RUNTIME_CPU_PROPERTY_DERIVED,validationFlags:Ue()},{id:`peercompute.ulg.material-resolver.optical-pbr-closures.v0`,family:`optical-pbr-closures`,label:`Optical PBR closures`,cpu:{status:`known-cpu-entrypoints`,entrypoints:[{module:`src/runtime/material/opticalClosure.js`,exports:[`opticalRenderParams`,`metalRelativisticColorSrgb`,`waterDropletOpticalMicrophysics`]},{module:`src/runtime/material/opticalResolverWebGpu.js`,exports:[`resolveOpticalBatchWebGpu`,`resolveMetalOpticalWebGpu`,`OPTICAL_RESOLVER_WEBGPU_PROGRAM_HASH`]},{module:`src/runtime/material/opticalGpuBuffers.js`,exports:[`buildOpticalGpuTable`,`runOpticalGpuLookupWithOptionalWebGpu`]}]},webgpuResidencyTarget:{target:`webgpu-derived-resident-optical-pbr-row-family`,residency:`spectral, Drude-Lorentz, CIE, opacity, emission-coupled, vapor, and droplet-scattering rows derived on GPU from electronic, molecular, and thermodynamic state rows`},cacheKeyIngredients:[`materialClosureHash`,`phaseStateHash`,`opticalStateBucket`,`pathLengthBucket`,`spectralGridVersion`,`microstructureSummaryHash`,`electronicBandRowHash`,`webgpuProgramHash`,`schemaVersion`,`generatorFingerprint`],currentStatus:J.WEBGPU_DERIVED_WITH_CPU_FALLBACK,validationFlags:Ue()},{id:`peercompute.ulg.material-resolver.reaction-energetics-products.v0`,family:`reaction-energetics-products`,label:`Reaction energetics and products`,cpu:{status:`known-cpu-entrypoints`,entrypoints:[{module:`src/runtime/chemistry/formula.js`,exports:[`describeChemicalFormula`,`tallyFormulaSide`]},{module:`src/runtime/chemistry/reactionCandidates.js`,exports:[`discoverReactionCandidates`]},{module:`src/runtime/sph/reactionDiscovery.js`,exports:[`discoverReactions`,`createReactionDiscoveryCacheKey`]},{module:`src/runtime/sph/reactiveChemistry.js`,exports:[`deriveReactionEnthalpyJPerKg`,`reactiveStep`]},{module:`src/runtime/sph/sphReactionGpuKernel.js`,exports:[`buildSphReactionTable`,`runSphReactionStepWebGpu`]}]},webgpuResidencyTarget:{target:`webgpu-resident-balanced-reaction-closure-rows`,residency:`balanced candidate, product-closure, energetics, extent, gas-byproduct, pressure, and atom-ledger buffers consumed by contact and chemistry kernels`},cacheKeyIngredients:[`reactantAtomVectors`,`candidateFamilyId`,`balancedEquationHash`,`reactantMaterialClosureHashes`,`productMaterialClosureHashes`,`thermochemistryMethodHash`,`phaseRequirementHash`,`schemaVersion`,`generatorFingerprint`],currentStatus:J.CPU_DERIVED_GPU_CONTACT_CONSUMED,validationFlags:Ue()},{id:`peercompute.ulg.material-resolver.radiation-nuclear-closures.v0`,family:`radiation-nuclear-closures`,label:`Radiation and nuclear closures`,cpu:{status:`partial-cpu-entrypoints`,entrypoints:[{module:`src/runtime/material/radiationClosure.js`,exports:[`createRadiationClosure`,`incandescentColor`,`blackbodyColorSrgb`]},{module:`src/runtime/material/nuclearCherenkovClosure.js`,exports:[`packNuclearChannelRows`,`stepIsotopeInventoryLedger`,`evaluateCherenkovClosure`]}]},webgpuResidencyTarget:{target:`webgpu-resident-radiation-nuclear-source-rows`,residency:`isotope, decay-channel, fission/fusion, radiation-deposition, ionization, radiolysis, and Cherenkov source buffers coupled into thermal, chemistry, gas, and optical kernels`},cacheKeyIngredients:[`isotopeInventoryHash`,`decayChannelLibraryVersion`,`particleSpectrumHash`,`mediumOpticalRowHash`,`transportGridHash`,`depositionCouplingVersion`,`schemaVersion`,`generatorFingerprint`],currentStatus:J.CPU_EMISSION_ONLY_NUCLEAR_PLANNED,validationFlags:Ue()},{id:`peercompute.ulg.material-resolver.cache-fingerprint-policy.v0`,family:`cache-fingerprint-policy`,label:`Cache and fingerprint policy`,cpu:{status:`known-cpu-control-plane`,entrypoints:[{module:`src/runtime/material/propertyProvenance.js`,exports:[`materialDerivationSummary`,`requireFirstPrinciplesMaterialProperties`]},{module:`src/runtime/material/MaterialRegistry.js`,exports:[`MaterialRegistry`]},{module:`src/runtime/material/materialResolverPipeline.js`,exports:[`createMaterialResolverPipeline`,`MATERIAL_RESOLVER_PIPELINE_SCHEMA`]},{module:`src/runtime/material/materialPropertyBank.js`,exports:[`normalizeMaterialPropertyBank`,`materialPropertyBankWarmInput`]},{module:`src/runtime/sph/sphLocalClosureCache.js`,exports:[`createSphLocalCacheLookup`,`createPeerClosureCacheWrite`]},{module:`src/runtime/sph/sphColdStartCache.js`,exports:[`parseSphColdStartCacheSnapshot`,`emptySphStaticTableCache`]}]},webgpuResidencyTarget:{target:`cpu-validated-webgpu-resident-closure-graph-policy`,residency:`CPU validates schemas, provenance, cache guards, and graph program hashes once; accepted flat node, edge, and program rows stay GPU-resident for resolver execution`},cacheKeyIngredients:[`schemaVersion`,`recordSchema`,`methodVersion`,`inputHash`,`methodHash`,`validityDomainHash`,`lowerLevelClosureHashes`,`materialPropertyBankSchemaVersion`,`materialPropertyBankGeneratorFingerprint`,`webgpuProgramHash`,`abiLayoutHash`,`generatorFingerprint`],currentStatus:J.CPU_CONTROL_PLANE_POLICY,validationFlags:Ue()}].map(e=>We(e))});var Ge=`peercompute.ulg.material-resolver-pipeline.v1`,Ke=`${pe}::${me}::${Re}::${Me}`;function qe(e){let t=JSON.stringify(e),n=2166136261,r=2654435769;for(let e=0;e<t.length;e+=1){let i=t.charCodeAt(e);n=Math.imul(n^i,16777619)>>>0,r=Math.imul(r^i+e,2246822507)>>>0}return`fnv1a64:${n.toString(16).padStart(8,`0`)}${r.toString(16).padStart(8,`0`)}`}function Je({generatorFingerprint:e=Ke,workerDispatch:t=null,device:n=null,maxEntries:r=256}={}){let i=new Map,a=String(e),o=n||null,s=0,c=0,l=0,u=0;function d(e){o=e||null}function f(){for(;i.size>r;){let e=i.keys().next().value;i.delete(e)}}function p(e){let t=i.get(e);return t?t.generatorFingerprint===a?(s+=1,t):(i.delete(e),u+=1,null):null}function m(e,t,n){i.set(e,Object.freeze({cacheKey:e,generatorFingerprint:a,storedAtMs:Date.now(),...n,value:t})),f()}function h(e){let t=String(e||``).trim();if(!t||t===a)return 0;let n=i.size;return i.clear(),u+=n,a=t,n}async function g(e,n={}){let r=String(n.functional||`pbe`).toLowerCase(),i=n.scalarRelativistic!==!1,s=n.includeGasPhase===!0,u=n.includeClosure!==!1,d=n.gridPointsN??500,f=n.device===void 0?o:n.device,h=!!(f&&typeof f.createComputePipeline==`function`&&n.useWebGpu!==!1),g=qe([`element`,a,e,r,i,s,u,d,h?`webgpu`:`cpu`]),_=p(g);if(_)return{..._.value,resolverStatus:`cache-hit`,derivedBackend:_.backend,cacheKey:g,generatorFingerprint:a};c+=1;let v,y=`cpu-derived`;if(h){let t=R(e,{...n,functional:r,scalarRelativistic:i,gridPointsN:d}),a=await Pe(f,e,{functional:r,spinOrbit:!0,gridPointsN:Math.min(256,d),maxScf:n.webgpuMaxScf??64,tol:n.webgpuTol??5e-4,returnRadialDensity:!0}),o=null;t.conductionElectronDensityPerM3>0&&(o=await Ve(f,{atomicNumberZ:e,conductionElectronDensityPerM3:t.conductionElectronDensityPerM3,interbandOscillators:t.opticalInterbandOscillators||null,interbandOptions:n.opticalInterbandOptions||{}}));let c={...t,...o?{opticalColorSrgb:o.baseColorSrgb,webgpuOptical:o}:{},webgpuAtomicStructure:{schema:a.schema,totalEnergyHa:a.totalEnergyHa,integratedElectrons:a.integratedElectrons,scfIterations:a.scfIterations,scfL1Delta:a.scfL1Delta,orbitals:a.orbitals,webgpuProgramHash:a.webgpuProgramHash},webgpuDerived:!0},p=u?I(e,{...n,functional:r,scalarRelativistic:i,includeGasPhase:s,gridPointsN:d}):null;p&&o&&(p.properties={...p.properties,opticalColorSrgb:o.baseColorSrgb,webgpuOptical:o,webgpuDerived:!0}),v={properties:c,closure:p,webgpuAtom:a,webgpuOptical:o,webgpuProgramHashes:Object.freeze({optical:Re,radialKohnSham:Me})},y=`webgpu-derived`,l+=1}else if(typeof t==`function`){let n=await t({kind:`material.resolve-element`,atomicNumberZ:e,options:{functional:r,scalarRelativistic:i,includeGasPhase:s,includeClosure:u,gridPointsN:d},generatorFingerprint:a});n&&(v=n,y=n.resolverStatus||`worker-cpu-derived`)}return v||={properties:R(e,{...n,functional:r,scalarRelativistic:i,gridPointsN:d}),closure:u?I(e,{...n,functional:r,scalarRelativistic:i,includeGasPhase:s,gridPointsN:d}):null},m(g,v,{family:`electronic-structure-band-optics`,backend:y}),{...v,resolverStatus:y,derivedBackend:y,cacheKey:g,generatorFingerprint:a}}async function _(e=[],t={}){let n=t.device===void 0?o:t.device;if(n&&typeof n.createComputePipeline==`function`&&t.useWebGpu!==!1){let r=await K(n,e,{keepResident:t.keepResident===!0});return l+=1,{...r,generatorFingerprint:a}}return{schema:Ge,resolverStatus:`cpu-derived`,generatorFingerprint:a,results:(e||[]).map(e=>e.mode===1?M(e):{...e,resolverStatus:`cpu-derived`}),residentBuffers:null}}async function v(e={},t={}){let n=t.device===void 0?o:t.device;if(n&&typeof n.createComputePipeline==`function`&&t.useWebGpu!==!1){let t=await K(n,[{mode:1,beta:e.beta,refractiveIndex:e.refractiveIndex??1.333,chargeZ:e.chargeZ??1}]);l+=1;let r=t.results[0];return{...r,srgb:r.baseColorSrgb,beta:e.beta,thresholdBeta:1/Math.max(1,e.refractiveIndex??1.333),resolverStatus:`webgpu-derived`,generatorFingerprint:a}}return{...M(e),resolverStatus:`cpu-derived`,generatorFingerprint:a}}async function y({formula:e=`H2O`,atoms:n,basis:r=`sto-3g`,functional:i=`pbe`,includeVisualizationBundle:o=!1,gridDim:s=12}={}){let l=qe([`molecule`,a,e,n,r,i,o,s]),u=p(l);if(u)return{...u.value,resolverStatus:`cache-hit`,derivedBackend:u.backend,cacheKey:l,generatorFingerprint:a};c+=1;let d,f=`cpu-derived`;if(typeof t==`function`){let c=await t({kind:`material.resolve-molecule`,formula:e,atoms:n,basis:r,functional:i,includeVisualizationBundle:o,gridDim:s,generatorFingerprint:a});c&&(d=c,f=c.resolverStatus||`worker-cpu-derived`)}return d||={bulkClosure:L({formula:e,atoms:n,basis:r}),visualizationBundle:o?Te({materialKey:String(e).toLowerCase(),formula:e,atoms:n,basis:r,functional:i,gridDim:s,includeUmp2:!1,includeQhaClosure:!1,includeTriadA4Replay:!0}):null},m(l,d,{family:`molecular-geometry-md`,backend:f}),{...d,resolverStatus:f,derivedBackend:f,cacheKey:l,generatorFingerprint:a}}function b(){return Object.freeze({schema:Ge,manifestSchema:q,generatorFingerprint:a,webgpuDeviceAttached:!!o,webgpuProgramHashes:Object.freeze({optical:Re,radialKohnSham:Me}),entryCount:i.size,maxEntries:r,hits:s,misses:c,webgpuDerivations:l,staleEvictions:u})}function x(){i.clear()}return Object.freeze({schema:Ge,setDevice:d,resolveElement:g,resolveMolecule:y,resolveOpticalBatch:_,resolveCherenkov:v,invalidateForFingerprint:h,stats:b,clear:x})}var Ye=128;function Xe(e){let t=e>>>0;return()=>{t|=0,t=t+1831565813|0;let e=Math.imul(t^t>>>15,1|t);return e=e+Math.imul(e^e>>>7,61|e)^e,((e^e>>>14)>>>0)/4294967296}}function Ze({count:e=4096,preset:t=`disk`,seed:n=825,gravity:r=1,softening:i=.22}={}){let a=Math.max(64,Math.min(262144,Math.floor(e))),o=new Float32Array(a*8),s=Xe(n),c=()=>{let e=Math.max(1e-7,s()),t=s();return Math.sqrt(-2*Math.log(e))*Math.cos(2*Math.PI*t)},l=4096/Math.max(4096,a);if(t===`binary`){let e=a>>1;for(let t=0;t<2;t+=1){let n=t===0?-1:1,u=n*6.5,d=n*1.4,f=n*-1.8,p=-n*1.15,m=n*.35,h=n*.95,g=t*e,_=t===0?e:a;o.set([u,d,f,180,p,m,h,.45],g*8);for(let e=g+1;e<_;e+=1){let n=e&1,a=.6+s()**1.45*5.2,v=n*Math.PI+a*.72+c()*.28,y=c()*(.18+.04*a),b=t===0?.32:-.45,x=a*Math.cos(v),S=a*Math.sin(v),C=y,w=Math.cos(b),T=Math.sin(b),ee=x,te=C*w-S*T,ne=C*T+S*w,E=180+(_-g)*.08*l*(1-Math.exp(-a/2.2)),re=Math.sqrt(r*E/Math.hypot(a,i)),D=-Math.sin(v)*re,O=Math.cos(v)*re,ie=D,ae=-O*T,oe=O*w,se=(.05+s()*.14)*l,ce=.03+.04*Math.cbrt(se);o.set([u+ee,d+te,f+ne,se,p+ie,m+ae,h+oe,ce],e*8)}}return o}if(t===`sphere`){o.set([0,0,0,120,0,0,0,.4],0);for(let e=1;e<a;e+=1){let t=Math.max(1e-4,Math.min(.995,s())),n=2.6/Math.sqrt(t**(-2/3)-1),i=Math.min(12,n),u=2*s()-1,d=Math.sqrt(Math.max(0,1-u*u)),f=2*Math.PI*s(),p=i*d*Math.cos(f),m=i*u,h=i*d*Math.sin(f),g=Math.sqrt(r*(120+a*.04*l)/Math.hypot(i,1.8))*.45,_=(.04+s()*.12)*l;o.set([p,m,h,_,c()*g,c()*g,c()*g,.03+.03*Math.cbrt(_)],e*8)}return o}o.set([0,0,0,260,0,0,0,.55],0);let u=a*.09*l;for(let e=1;e<a;e+=1)if(e<a*.16){let t=Math.abs(c())*1.1+.12,n=2*Math.PI*s(),a=c()*.42,d=t*Math.cos(n),f=t*Math.sin(n),p=Math.sqrt(r*(260+u*.12)/Math.hypot(t,i)),m=(.08+s()*.25)*l;o.set([d,a,f,m,-Math.sin(n)*p*.92+c()*.35,c()*.25,Math.cos(n)*p*.92+c()*.35,.04+.04*Math.cbrt(m)],e*8)}else{let t=e&1,n=.8+s()**1.35*9.8,a=.62*Math.log(1+n*1.45)*3.1,d=(.14+.042*n)*c(),f=t*Math.PI+a+d,p=c()*(.14+.025*n),m=n*Math.cos(f),h=n*Math.sin(f),g=260+u*(1-Math.exp(-n/3.4)),_=Math.sqrt(r*g/Math.hypot(n,i)),v=(.04+s()**2.2*.22)*l;o.set([m,p,h,v,-Math.sin(f)*_+c()*.16,c()*.06,Math.cos(f)*_+c()*.16,.025+.04*Math.cbrt(v)],e*8)}return o}function Qe({count:e=3072,seed:t=1370}={}){let n=Math.max(64,Math.min(65536,Math.floor(e))),r=new Float32Array(n*8),i=Xe(t),a=[];for(let e=0;e<10;e+=1)a.push({kx:(i()-.5)*.85,ky:(i()-.5)*.85,kz:(i()-.5)*.85,phase:i()*Math.PI*2,amp:.75+i()*.9});for(let e=0;e<n;e+=1){let t,n,o;do t=(i()*2-1)*10.2,n=(i()*2-1)*10.2,o=(i()*2-1)*10.2;while(t*t+n*n+o*o>10.2*10.2);let s=0,c=0,l=0;for(let e of a){let r=Math.sin(e.kx*t+e.ky*n+e.kz*o+e.phase)*e.amp;s+=e.kx*r,c+=e.ky*r,l+=e.kz*r}let u=t+s*1.85,d=n+c*1.85,f=o+l*1.85,p=.5+i()**2.5*6;r.set([u,d,f,p,s*.12,c*.12,l*.12,.06+.05*Math.cbrt(p)],e*8)}return r}var $e=`
struct Body {
  pos_mass: vec4<f32>,
  vel_radius: vec4<f32>,
};

struct StepParams {
  count: u32,
  mode: u32,
  pad0: u32,
  pad1: u32,
  dt: f32,
  gravity: f32,
  softening2: f32,
  hubble_drag: f32,
  inv_a3: f32,
  pad2: f32,
  pad3: f32,
  pad4: f32,
};

@group(0) @binding(0) var<storage, read> src_bodies: array<Body>;
@group(0) @binding(1) var<storage, read_write> dst_bodies: array<Body>;
@group(0) @binding(2) var<uniform> params: StepParams;

var<workgroup> tile: array<vec4<f32>, 64>;

@compute @workgroup_size(64)
fn step_nbody(
  @builtin(global_invocation_id) gid: vec3<u32>,
  @builtin(local_invocation_id) lid: vec3<u32>
) {
  let idx = gid.x;
  let n = params.count;
  var self_pm = vec4<f32>(0.0);
  var self_vr = vec4<f32>(0.0);
  let alive = idx < n;
  if (alive) {
    self_pm = src_bodies[idx].pos_mass;
    self_vr = src_bodies[idx].vel_radius;
  }

  var acc = vec3<f32>(0.0);
  let num_tiles = (n + 63u) / 64u;
  for (var t = 0u; t < num_tiles; t = t + 1u) {
    let j = t * 64u + lid.x;
    if (j < n) {
      tile[lid.x] = src_bodies[j].pos_mass;
    } else {
      tile[lid.x] = vec4<f32>(0.0);
    }
    workgroupBarrier();

    if (alive && self_pm.w > 0.0) {
      let limit = min(64u, n - t * 64u);
      for (var k = 0u; k < limit; k = k + 1u) {
        let other = tile[k];
        if (other.w <= 0.0) { continue; }
        let d = other.xyz - self_pm.xyz;
        let r2 = dot(d, d) + params.softening2;
        let inv_r = inverseSqrt(r2);
        let inv_r3 = inv_r * inv_r * inv_r;
        acc = acc + d * (other.w * inv_r3);
      }
    }
    workgroupBarrier();
  }

  if (!alive) { return; }
  if (self_pm.w <= 0.0) {
    dst_bodies[idx] = Body(vec4<f32>(0.0), vec4<f32>(0.0));
    return;
  }

  var vel = self_vr.xyz;
  if (params.mode == 1u) {
    let drag = max(0.0, 1.0 - params.hubble_drag * params.dt);
    vel = vel * drag + acc * (params.gravity * params.inv_a3 * params.dt);
  } else {
    vel = vel + acc * (params.gravity * params.dt);
  }
  let pos = self_pm.xyz + vel * params.dt;
  dst_bodies[idx] = Body(vec4<f32>(pos, self_pm.w), vec4<f32>(vel, self_vr.w));
}
`,et=`
struct Body {
  pos_mass: vec4<f32>,
  vel_radius: vec4<f32>,
};

struct BhParams {
  count: u32,
  mode: u32,
  pad0: u32,
  pad1: u32,
  dt: f32,
  gravity: f32,
  softening2: f32,
  hubble_drag: f32,
  inv_a3: f32,
  box_half: f32,
  theta2: f32,
  pad2: f32,
};

@group(0) @binding(0) var<storage, read> src_bodies: array<Body>;
@group(0) @binding(1) var<storage, read_write> dst_bodies: array<Body>;
// 4,096 leaves * 4 i32 slots = 16,384 atomic<i32>: [mass_q, mx_q, my_q, mz_q]
@group(0) @binding(2) var<storage, read_write> leaf_accum: array<atomic<i32>>;
// 4,096 L2 monopole nodes (com.xyz, mass) + 64 L1 coarse monopole nodes = 4,160 vec4<f32>
@group(0) @binding(3) var<storage, read_write> tree_nodes: array<vec4<f32>>;
@group(0) @binding(4) var<uniform> params: BhParams;

const L2_DIM: u32 = 16u;
const L2_COUNT: u32 = 4096u;
const L1_DIM: u32 = 4u;
const L1_COUNT: u32 = 64u;
const Q_MASS: f32 = 4096.0;
const Q_MOM: f32 = 256.0;

@compute @workgroup_size(64)
fn bh_clear_tree(@builtin(global_invocation_id) gid: vec3<u32>) {
  let i = gid.x;
  if (i < L2_COUNT) {
    let base = i * 4u;
    atomicStore(&leaf_accum[base + 0u], 0);
    atomicStore(&leaf_accum[base + 1u], 0);
    atomicStore(&leaf_accum[base + 2u], 0);
    atomicStore(&leaf_accum[base + 3u], 0);
    tree_nodes[i] = vec4<f32>(0.0);
  }
  if (i < L1_COUNT) {
    tree_nodes[L2_COUNT + i] = vec4<f32>(0.0);
  }
}

fn clamp_cell(v: f32, half_extent: f32) -> u32 {
  let u = clamp((v + half_extent) / (2.0 * half_extent), 0.0, 0.9999);
  return min(15u, u32(u * 16.0));
}

@compute @workgroup_size(64)
fn bh_deposit_leaves(@builtin(global_invocation_id) gid: vec3<u32>) {
  let i = gid.x;
  if (i >= params.count) { return; }
  let pm = src_bodies[i].pos_mass;
  if (pm.w <= 0.0) { return; }
  let cx = clamp_cell(pm.x, params.box_half);
  let cy = clamp_cell(pm.y, params.box_half);
  let cz = clamp_cell(pm.z, params.box_half);
  let cell = (cz * 256u) + (cy * 16u) + cx;
  let base = cell * 4u;
  let mq = i32(clamp(pm.w * Q_MASS, -1e8, 1e8));
  let mxq = i32(clamp(pm.w * pm.x * Q_MOM, -1e8, 1e8));
  let myq = i32(clamp(pm.w * pm.y * Q_MOM, -1e8, 1e8));
  let mzq = i32(clamp(pm.w * pm.z * Q_MOM, -1e8, 1e8));
  atomicAdd(&leaf_accum[base + 0u], mq);
  atomicAdd(&leaf_accum[base + 1u], mxq);
  atomicAdd(&leaf_accum[base + 2u], myq);
  atomicAdd(&leaf_accum[base + 3u], mzq);
}

@compute @workgroup_size(64)
fn bh_finalize_leaves(@builtin(global_invocation_id) gid: vec3<u32>) {
  let cell = gid.x;
  if (cell >= L2_COUNT) { return; }
  let base = cell * 4u;
  let m = f32(atomicLoad(&leaf_accum[base + 0u])) / Q_MASS;
  if (m > 1e-6) {
    let inv_m = 1.0 / m;
    let cx = (f32(atomicLoad(&leaf_accum[base + 1u])) / Q_MOM) * inv_m;
    let cy = (f32(atomicLoad(&leaf_accum[base + 2u])) / Q_MOM) * inv_m;
    let cz = (f32(atomicLoad(&leaf_accum[base + 3u])) / Q_MOM) * inv_m;
    tree_nodes[cell] = vec4<f32>(cx, cy, cz, m);
  } else {
    tree_nodes[cell] = vec4<f32>(0.0);
  }
}

@compute @workgroup_size(64)
fn bh_reduce_coarse(@builtin(global_invocation_id) gid: vec3<u32>) {
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
        let lx = px * 4u + dx;
        let ly = py * 4u + dy;
        let lz = pz * 4u + dz;
        let leaf = tree_nodes[(lz * 256u) + (ly * 16u) + lx];
        if (leaf.w > 0.0) {
          m_sum = m_sum + leaf.w;
          mom = mom + leaf.xyz * leaf.w;
        }
      }
    }
  }
  if (m_sum > 1e-6) {
    tree_nodes[L2_COUNT + p] = vec4<f32>(mom / m_sum, m_sum);
  } else {
    tree_nodes[L2_COUNT + p] = vec4<f32>(0.0);
  }
}

@compute @workgroup_size(64)
fn bh_integrate(@builtin(global_invocation_id) gid: vec3<u32>) {
  let idx = gid.x;
  if (idx >= params.count) { return; }
  let self_pm = src_bodies[idx].pos_mass;
  let self_vr = src_bodies[idx].vel_radius;
  if (self_pm.w <= 0.0) {
    dst_bodies[idx] = Body(vec4<f32>(0.0), vec4<f32>(0.0));
    return;
  }

  let l1_size = (2.0 * params.box_half) / 4.0;
  let open_thresh2 = (l1_size * l1_size) / max(0.05, params.theta2);
  let self_cell_x = clamp_cell(self_pm.x, params.box_half);
  let self_cell_y = clamp_cell(self_pm.y, params.box_half);
  let self_cell_z = clamp_cell(self_pm.z, params.box_half);
  let self_leaf_id = (self_cell_z * 256u) + (self_cell_y * 16u) + self_cell_x;

  var acc = vec3<f32>(0.0);
  for (var p = 0u; p < L1_COUNT; p = p + 1u) {
    let coarse = tree_nodes[L2_COUNT + p];
    if (coarse.w <= 0.0) { continue; }
    let d_c = coarse.xyz - self_pm.xyz;
    let dist2_c = dot(d_c, d_c);
    if (dist2_c > open_thresh2) {
      let r2 = dist2_c + params.softening2;
      let inv_r = inverseSqrt(r2);
      acc = acc + d_c * (coarse.w * inv_r * inv_r * inv_r);
    } else {
      let px = p & 3u;
      let py = (p >> 2u) & 3u;
      let pz = (p >> 4u) & 3u;
      for (var dz = 0u; dz < 4u; dz = dz + 1u) {
        for (var dy = 0u; dy < 4u; dy = dy + 1u) {
          for (var dx = 0u; dx < 4u; dx = dx + 1u) {
            let leaf_id = ((pz * 4u + dz) * 256u) + ((py * 4u + dy) * 16u) + (px * 4u + dx);
            let leaf = tree_nodes[leaf_id];
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
            acc = acc + d * (eff_m * inv_r * inv_r * inv_r);
          }
        }
      }
    }
  }

  var vel = self_vr.xyz;
  if (params.mode == 1u) {
    let drag = max(0.0, 1.0 - params.hubble_drag * params.dt);
    vel = vel * drag + acc * (params.gravity * params.inv_a3 * params.dt);
  } else {
    vel = vel + acc * (params.gravity * params.dt);
  }
  let pos = self_pm.xyz + vel * params.dt;
  dst_bodies[idx] = Body(vec4<f32>(pos, self_pm.w), vec4<f32>(vel, self_vr.w));
}
`;function tt({cpuBodies:e,count:t,mode:n,scaleFactorA:r,dt:i,gravity:a,softening:o,hubbleRate:s}){let c=new Float32Array(e.length),l=o*o,u=n===1?1/Math.max(.05,r**3):1,d=n===1?Math.max(0,1-2*s*i):1,f=t>512?Math.ceil(t/512):1;for(let n=0;n<t;n+=1){let r=n*8,o=e[r+3];if(!(o>0))continue;let s=e[r],p=e[r+1],m=e[r+2],h=0,g=0,_=0;for(let n=0;n<t;n+=f){let t=n*8,r=e[t+3];if(!(r>0))continue;let i=e[t]-s,a=e[t+1]-p,o=e[t+2]-m,c=i*i+a*a+o*o+l,u=r*f/(c*Math.sqrt(c));h+=i*u,g+=a*u,_+=o*u}let v=a*u*i,y=e[r+4]*d+h*v,b=e[r+5]*d+g*v,x=e[r+6]*d+_*v;c[r]=s+y*i,c[r+1]=p+b*i,c[r+2]=m+x*i,c[r+3]=o,c[r+4]=y,c[r+5]=b,c[r+6]=x,c[r+7]=e[r+7]}return c}function nt({device:e=null,initialBodies:t,mode:n=0,label:r=`ulg-cosmic-nbody`}){let i=Float32Array.from(t),a=i.length/8,o=0,s=n===1?.25:1,c=!1,l=null,u=null,d=null,f=null,p=null,m=0;if(e&&typeof e.createBuffer==`function`){let t=Math.max(32,i.byteLength);l=[e.createBuffer({label:`${r}-buf-0`,size:t,usage:172}),e.createBuffer({label:`${r}-buf-1`,size:t,usage:172})],u=e.createBuffer({label:`${r}-params`,size:48,usage:72}),d=e.createBuffer({label:`${r}-staging`,size:t,usage:9}),e.queue.writeBuffer(l[0],0,i),e.queue.writeBuffer(l[1],0,i),f=F(e,{cacheKey:`ulg-cosmic-nbody-tiled.v1`,label:`ulg-cosmic-nbody-tiled`,code:$e,entryPoint:`step_nbody`,bindings:[N(0,`read-only-storage`),N(1,`storage`),N(2,`uniform`)]}),p=[P(e,{layout:f.bindGroupLayout,label:`${r}-bg-0`,entries:[{binding:0,resource:{buffer:l[0]}},{binding:1,resource:{buffer:l[1]}},{binding:2,resource:{buffer:u}}]}),P(e,{layout:f.bindGroupLayout,label:`${r}-bg-1`,entries:[{binding:0,resource:{buffer:l[1]}},{binding:1,resource:{buffer:l[0]}},{binding:2,resource:{buffer:u}}]})]}let h=!1;async function g(){if(!l||!d||h||c)return i;h=!0;try{let t=e.createCommandEncoder({label:`${r}-readback`});t.copyBufferToBuffer(l[m],0,d,0,i.byteLength),e.queue.submit([t.finish()]),await d.mapAsync(1),i.set(new Float32Array(d.getMappedRange())),d.unmap()}finally{h=!1}return i}async function _({dt:t=.014,gravity:g=1,softening:_=.22,hubbleRate:v=.12,readback:y=!0}={}){if(c)return i;if(!l||!f)return i=tt({cpuBodies:i,count:a,mode:n,scaleFactorA:s,dt:t,gravity:g,softening:_,hubbleRate:v}),o+=1,n===1&&(s=Math.min(2,s+t*v*s)),i;let b=new ArrayBuffer(48),x=new Uint32Array(b),S=new Float32Array(b),C=n===1?1/Math.max(.05,s**3):1;x[0]=a,x[1]=n,S[4]=t,S[5]=g,S[6]=_*_,S[7]=n===1?2*v:0,S[8]=C,e.queue.writeBuffer(u,0,b);let w=m,T=1-m,ee=e.createCommandEncoder({label:`${r}-step-${o}`}),te=ee.beginComputePass({label:`${r}-pass`});te.setPipeline(f.pipeline),te.setBindGroup(0,p[w]),te.dispatchWorkgroups(Math.ceil(a/64)),te.end();let ne=y&&!h;if(ne&&ee.copyBufferToBuffer(l[T],0,d,0,i.byteLength),e.queue.submit([ee.finish()]),m=T,o+=1,n===1&&(s=Math.min(2,s+t*v*s)),ne){h=!0;try{await d.mapAsync(1),i.set(new Float32Array(d.getMappedRange())),d.unmap()}finally{h=!1}}return i}function v(t){i=Float32Array.from(t),o=0,s=n===1?.25:1,m=0,l&&e&&(e.queue.writeBuffer(l[0],0,i),e.queue.writeBuffer(l[1],0,i))}function y(){return l?l[m]:null}function b(){c||(c=!0,l?.[0]?.destroy(),l?.[1]?.destroy(),u?.destroy(),d?.destroy(),l=null)}return{get count(){return a},get activeCount(){return a},get stepIndex(){return o},get scaleFactorA(){return s},get backend(){return l?`webgpu`:`cpu-fallback`},get gravityMode(){return l?`webgpu-tiled-direct`:`cpu-fallback`},getBodies:()=>i,readbackBodies:g,getResidentBuffer:y,step:_,resetBodies:v,dispose:b}}function rt({device:e=null,initialBodies:t,mode:n=0,boxHalf:r=16,theta:i=.65,label:a=`ulg-cosmic-bh`}){let o=Float32Array.from(t),s=o.length/8,c=0,l=n===1?.25:1,u=!1,d=null,f=null,p=null,m=null,h=null,g=null,_=null,v=0;if(e&&typeof e.createBuffer==`function`){let t=Math.max(32,o.byteLength);d=[e.createBuffer({label:`${a}-buf-0`,size:t,usage:172}),e.createBuffer({label:`${a}-buf-1`,size:t,usage:172})],f=e.createBuffer({label:`${a}-leaf-accum`,size:4096*16,usage:Ye}),p=e.createBuffer({label:`${a}-tree-nodes`,size:4160*16,usage:Ye}),m=e.createBuffer({label:`${a}-params`,size:48,usage:72}),h=e.createBuffer({label:`${a}-staging`,size:t,usage:9}),e.queue.writeBuffer(d[0],0,o),e.queue.writeBuffer(d[1],0,o);let n=[N(0,`read-only-storage`),N(1,`storage`),N(2,`storage`),N(3,`storage`),N(4,`uniform`)],r=t=>F(e,{cacheKey:`ulg-cosmic-bh-${t}.v1`,label:`ulg-cosmic-bh-${t}`,code:et,entryPoint:t,bindings:n});g={clear:r(`bh_clear_tree`),deposit:r(`bh_deposit_leaves`),finalize:r(`bh_finalize_leaves`),reduce:r(`bh_reduce_coarse`),integrate:r(`bh_integrate`)};let i=(t,n,r)=>P(e,{layout:g.integrate.bindGroupLayout,label:`${a}-bg-${r}`,entries:[{binding:0,resource:{buffer:t}},{binding:1,resource:{buffer:n}},{binding:2,resource:{buffer:f}},{binding:3,resource:{buffer:p}},{binding:4,resource:{buffer:m}}]});_=[i(d[0],d[1],0),i(d[1],d[0],1)]}let y=!1;async function b(){if(!d||!h||y||u)return o;y=!0;try{let t=e.createCommandEncoder({label:`${a}-readback`});t.copyBufferToBuffer(d[v],0,h,0,o.byteLength),e.queue.submit([t.finish()]),await h.mapAsync(1),o.set(new Float32Array(h.getMappedRange())),h.unmap()}finally{y=!1}return o}async function x({dt:t=.012,gravity:f=1,softening:p=.24,hubbleRate:b=.12,readback:x=!1}={}){if(u)return o;if(!d||!g)return o=tt({cpuBodies:o,count:s,mode:n,scaleFactorA:l,dt:t,gravity:f,softening:p,hubbleRate:b}),c+=1,n===1&&(l=Math.min(2,l+t*b*l)),o;let S=new ArrayBuffer(48),C=new Uint32Array(S),w=new Float32Array(S),T=n===1?1/Math.max(.05,l**3):1;C[0]=s,C[1]=n,w[4]=t,w[5]=f,w[6]=p*p,w[7]=n===1?2*b:0,w[8]=T,w[9]=r,w[10]=i*i,e.queue.writeBuffer(m,0,S);let ee=v,te=1-v,ne=_[ee],E=Math.ceil(s/64),re=e.createCommandEncoder({label:`${a}-bh-step-${c}`}),D=re.beginComputePass({label:`${a}-bh-pass`});D.setPipeline(g.clear.pipeline),D.setBindGroup(0,ne),D.dispatchWorkgroups(64),D.setPipeline(g.deposit.pipeline),D.setBindGroup(0,ne),D.dispatchWorkgroups(E),D.setPipeline(g.finalize.pipeline),D.setBindGroup(0,ne),D.dispatchWorkgroups(64),D.setPipeline(g.reduce.pipeline),D.setBindGroup(0,ne),D.dispatchWorkgroups(1),D.setPipeline(g.integrate.pipeline),D.setBindGroup(0,ne),D.dispatchWorkgroups(E),D.end();let O=x&&!y;if(O&&re.copyBufferToBuffer(d[te],0,h,0,o.byteLength),e.queue.submit([re.finish()]),v=te,c+=1,n===1&&(l=Math.min(2,l+t*b*l)),O){y=!0;try{await h.mapAsync(1),o.set(new Float32Array(h.getMappedRange())),h.unmap()}finally{y=!1}}return o}function S(t){o=Float32Array.from(t),c=0,l=n===1?.25:1,v=0,d&&e&&(e.queue.writeBuffer(d[0],0,o),e.queue.writeBuffer(d[1],0,o))}function C(){return d?d[v]:null}function w(){u||(u=!0,d?.[0]?.destroy(),d?.[1]?.destroy(),f?.destroy(),p?.destroy(),m?.destroy(),h?.destroy(),d=null)}return{get count(){return s},get activeCount(){return s},get stepIndex(){return c},get scaleFactorA(){return l},get backend(){return d?`webgpu`:`cpu-fallback`},get gravityMode(){return d?`webgpu-barnes-hut-octree`:`cpu-fallback`},getBodies:()=>o,readbackBodies:b,getResidentBuffer:C,step:x,resetBodies:S,dispose:w}}function it({count:e=1024,phase:t=`liquid`,seed:n=4201}={}){let r=Math.max(64,Math.min(8192,Math.floor(e))),i=new Float32Array(r*8),a=Xe(n);if(t===`gas`){for(let e=0;e<r;e+=1){let t=(a()-.5)*4.4,n=-.8+a()*3.4,r=(a()-.5)*4.4,o=(a()-.5)*2.8,s=(a()-.5)*2.8,c=(a()-.5)*2.8;i.set([t,n,r,.25,o,s,c,.085],e*8)}return i}let o=Math.ceil(Math.cbrt(r)),s=t===`solid`?.2:.19,c=(o-1)*s/2,l=0;for(let e=0;e<o&&l<r;e+=1)for(let n=0;n<o&&l<r;n+=1)for(let u=0;u<o&&l<r;u+=1){let r=u*s-c,o=n*s-c,d=e*s-c;if(t===`liquid`){let e=Math.hypot(r,o,d)>1e-4?Math.min(1.15,1.15/Math.max(.8,Math.max(Math.abs(r),Math.abs(o),Math.abs(d)))*.85):1;i.set([r*Math.min(1,e)+(a()-.5)*.03,.35+o*Math.min(1,e)+(a()-.5)*.03,d*Math.min(1,e)+(a()-.5)*.03,1,(a()-.5)*.25,-.35,(a()-.5)*.25,.105],l*8)}else{let e=.28,t=Math.cos(e),n=Math.sin(e),a=r*t-o*n,s=r*n+o*t;i.set([a,.55+s,d,1,0,-.15,0,.105],l*8)}l+=1}return i}var at=`
struct Body {
  pos_mass: vec4<f32>,
  vel_radius: vec4<f32>,
};

struct MicroSphParams {
  count: u32,
  phase_mode: u32, // 0=liquid (SPH pressure+cohesion+viscosity), 1=solid (elastic crystal), 2=gas (thermal kinetic)
  pad0: u32,
  pad1: u32,
  dt: f32,
  gravity: f32,
  stiffness: f32,
  cohesion: f32,
  viscosity: f32,
  floor_y: f32,
  box_half: f32,
  rest_dist: f32,
};

@group(0) @binding(0) var<storage, read> src_bodies: array<Body>;
@group(0) @binding(1) var<storage, read_write> dst_bodies: array<Body>;
@group(0) @binding(2) var<uniform> params: MicroSphParams;

var<workgroup> tile_p: array<vec4<f32>, 64>;
var<workgroup> tile_v: array<vec4<f32>, 64>;

@compute @workgroup_size(64)
fn step_continuum_micro_sph(
  @builtin(global_invocation_id) gid: vec3<u32>,
  @builtin(local_invocation_id) lid: vec3<u32>
) {
  let idx = gid.x;
  let n = params.count;
  let alive = idx < n;
  var pm = vec4<f32>(0.0);
  var vr = vec4<f32>(0.0);
  if (alive) {
    pm = src_bodies[idx].pos_mass;
    vr = src_bodies[idx].vel_radius;
  }

  var force = vec3<f32>(0.0);
  let h = params.rest_dist * 1.95;
  let h2 = h * h;
  let rest = params.rest_dist;
  let num_tiles = (n + 63u) / 64u;

  for (var t: u32 = 0u; t < num_tiles; t = t + 1u) {
    let j = t * 64u + lid.x;
    if (j < n) {
      tile_p[lid.x] = src_bodies[j].pos_mass;
      tile_v[lid.x] = src_bodies[j].vel_radius;
    } else {
      tile_p[lid.x] = vec4<f32>(0.0);
      tile_v[lid.x] = vec4<f32>(0.0);
    }
    workgroupBarrier();

    if (alive && pm.w > 0.0) {
      let tile_count = min(64u, n - t * 64u);
      for (var k: u32 = 0u; k < tile_count; k = k + 1u) {
        let other_p = tile_p[k];
        if (other_p.w <= 0.0) { continue; }
        let d = pm.xyz - other_p.xyz;
        let r2 = dot(d, d);
        if (r2 > 1e-7 && r2 < h2) {
          let r = sqrt(r2);
          let dir = d / r;
          let q = 1.0 - r / h;
          if (params.phase_mode == 0u) {
            // Liquid: SPH pressure repulsion + short-range surface-tension cohesion + XSPH viscosity
            let rep = params.stiffness * max(0.0, rest - r) / rest;
            let coh = -params.cohesion * q * (1.0 - q) * 4.0;
            force = force + dir * (rep + coh);
            force = force + (tile_v[k].xyz - vr.xyz) * (params.viscosity * q);
          } else if (params.phase_mode == 1u) {
            // Solid: stiff elastic crystal bonds holding lattice spacing + damping
            let stretch = (rest - r) / rest;
            force = force + dir * (params.stiffness * 1.8 * stretch);
            force = force + (tile_v[k].xyz - vr.xyz) * (params.viscosity * 2.2 * q);
          } else {
            // Gas: soft short-range kinetic collisions
            let rep = params.stiffness * 0.25 * max(0.0, 0.75 * rest - r) / rest;
            force = force + dir * rep;
          }
        }
      }
    }
    workgroupBarrier();
  }

  if (alive) {
    var pos = pm.xyz;
    var vel = vr.xyz;
    if (params.phase_mode != 2u) {
      force.y = force.y - params.gravity;
      // Gentle pedestal confinement bowl so liquid Hg forms a dynamic oscillating puddle
      let r_xz = length(pos.xz);
      if (r_xz > 1.45) {
        force.x = force.x - (pos.x / r_xz) * (r_xz - 1.45) * 14.0;
        force.z = force.z - (pos.z / r_xz) * (r_xz - 1.45) * 14.0;
      }
    }

    let dt = params.dt;
    vel = vel + force * dt;
    let damp = select(select(0.992, 0.986, params.phase_mode == 1u), 0.9995, params.phase_mode == 2u);
    vel = vel * damp;
    let sp = length(vel);
    if (sp > 6.5) {
      vel = vel * (6.5 / sp);
    }
    pos = pos + vel * dt;

    // Pedestal floor and lab cage reflections
    let floor_y = params.floor_y;
    let ceil_y = params.box_half;
    let bound_xz = select(params.box_half, 1.55, params.phase_mode != 2u);
    let bounce = select(select(0.28, 0.45, params.phase_mode == 1u), 0.98, params.phase_mode == 2u);
    if (pos.y < floor_y) { pos.y = floor_y; vel.y = abs(vel.y) * bounce; vel.x = vel.x * 0.92; vel.z = vel.z * 0.92; }
    if (pos.y > ceil_y) { pos.y = ceil_y; vel.y = -abs(vel.y) * bounce; }
    if (pos.x < -bound_xz) { pos.x = -bound_xz; vel.x = abs(vel.x) * bounce; }
    if (pos.x > bound_xz) { pos.x = bound_xz; vel.x = -abs(vel.x) * bounce; }
    if (pos.z < -bound_xz) { pos.z = -bound_xz; vel.z = abs(vel.z) * bounce; }
    if (pos.z > bound_xz) { pos.z = bound_xz; vel.z = -abs(vel.z) * bounce; }

    dst_bodies[idx] = Body(vec4<f32>(pos, pm.w), vec4<f32>(vel, vr.w));
  }
}
`;function ot({device:e=null,initialBodies:t,phase:n=`liquid`,bulkModulusPa:r=25e9,label:i=`ulg-continuum-micro-sph`}={}){let a=Float32Array.from(t),o=a.length/8,s=n===`solid`?1:n===`gas`?2:0,c=Math.min(28,Math.max(8,10+Math.log10(Math.max(1e7,r))*1.4)),l=0,u=!1,d=null,f=null,p=null,m=null,h=null,g=0;if(e&&typeof e.createBuffer==`function`){let t=Math.max(32,a.byteLength);d=[e.createBuffer({label:`${i}-buf-0`,size:t,usage:172}),e.createBuffer({label:`${i}-buf-1`,size:t,usage:172})],f=e.createBuffer({label:`${i}-params`,size:48,usage:72}),p=e.createBuffer({label:`${i}-staging`,size:t,usage:9}),e.queue.writeBuffer(d[0],0,a),e.queue.writeBuffer(d[1],0,a),m=F(e,{cacheKey:`ulg-continuum-micro-sph.v1`,label:`ulg-continuum-micro-sph-pipe`,code:at,entryPoint:`step_continuum_micro_sph`,bindings:[N(0,`read-only-storage`),N(1,`storage`),N(2,`uniform`)]}),h=[P(e,{layout:m.bindGroupLayout,label:`${i}-bg-0`,entries:[{binding:0,resource:{buffer:d[0]}},{binding:1,resource:{buffer:d[1]}},{binding:2,resource:{buffer:f}}]}),P(e,{layout:m.bindGroupLayout,label:`${i}-bg-1`,entries:[{binding:0,resource:{buffer:d[1]}},{binding:1,resource:{buffer:d[0]}},{binding:2,resource:{buffer:f}}]})]}let _=!1;async function v(){if(!d||!p||_||u)return a;_=!0;try{let t=e.createCommandEncoder({label:`${i}-readback`});t.copyBufferToBuffer(d[g],0,p,0,a.byteLength),e.queue.submit([t.finish()]),await p.mapAsync(1),a.set(new Float32Array(p.getMappedRange())),p.unmap()}finally{_=!1}return a}async function y({dt:t=.014,gravity:n=4.8,readback:r=!1}={}){if(u)return a;if(!d||!m){let e=-.92,r=s===2?2.6:1.5;for(let i=0;i<o;i+=1){let o=i*8;s!==2&&(a[o+5]-=n*t),a[o+0]+=a[o+4]*t,a[o+1]+=a[o+5]*t,a[o+2]+=a[o+6]*t,a[o+1]<e&&(a[o+1]=e,a[o+5]=Math.abs(a[o+5])*.35),a[o+1]>2.6&&(a[o+1]=2.6,a[o+5]=-Math.abs(a[o+5])*.9),Math.abs(a[o+0])>r&&(a[o+0]=Math.sign(a[o+0])*r,a[o+4]*=-.8),Math.abs(a[o+2])>r&&(a[o+2]=Math.sign(a[o+2])*r,a[o+6]*=-.8)}return l+=1,a}let v=new ArrayBuffer(48),y=new Uint32Array(v),b=new Float32Array(v);y[0]=o,y[1]=s,b[4]=t,b[5]=n,b[6]=c,b[7]=s===0?4.2:0,b[8]=s===0?.85:1.4,b[9]=-.92,b[10]=2.65,b[11]=.2,e.queue.writeBuffer(f,0,v);let x=g,S=1-g,C=e.createCommandEncoder({label:`${i}-step-${l}`}),w=C.beginComputePass({label:`${i}-pass`});w.setPipeline(m.pipeline),w.setBindGroup(0,h[x]),w.dispatchWorkgroups(Math.ceil(o/64)),w.end();let T=r&&!_;if(T&&C.copyBufferToBuffer(d[S],0,p,0,a.byteLength),e.queue.submit([C.finish()]),g=S,l+=1,T){_=!0;try{await p.mapAsync(1),a.set(new Float32Array(p.getMappedRange())),p.unmap()}finally{_=!1}}return a}return{get count(){return o},get activeCount(){return o},get stepIndex(){return l},get scaleFactorA(){return 1},get phase(){return n},get backend(){return d?`webgpu`:`cpu-fallback`},get gravityMode(){return d?`webgpu-micro-sph-${n}`:`cpu-micro-sph-${n}`},getBodies:()=>a,readbackBodies:v,getResidentBuffer:()=>d?d[g]:null,step:y,dispose(){u||(u=!0,d?.[0]?.destroy(),d?.[1]?.destroy(),f?.destroy(),p?.destroy(),d=null)}}}function st({method:e,engine:t,scaleRangeM:n,zeroCopy:r=!1}){let i={tensorId:`bodies`,dtype:`f32`,layout:`interleaved`,strideElements:8,strideBytes:32,fields:[`x`,`y`,`z`,`mass`,`vx`,`vy`,`vz`,`radius`]};return{method:e,kernel:{sourceModule:`src/demos/cosmicQuantumGpuKernels.js`,entryPoint:t.gravityMode?.startsWith(`webgpu-micro-sph`)?`step_continuum_micro_sph`:t.gravityMode===`webgpu-barnes-hut-octree`?`bh_integrate`:`step_nbody`,wgsl:t.gravityMode?.startsWith(`webgpu-micro-sph`)?at:t.gravityMode===`webgpu-barnes-hut-octree`?et:$e,workgroupSize:64},parameterSchema:{dt:{type:`number`,min:0,required:!0},gravity:{type:`number`,min:0,required:!0},softening:{type:`number`,min:0,required:!1},hubbleRate:{type:`number`,min:0,required:!1},readback:{type:`boolean`,required:!1}},stateLayout:i,scaleRangeM:n,async stepCapsule(n,{createSimulationArtifact:a,leaseSession:o}){let s=t.stepIndex,c=n.input?.parameters||{},l=c.readback===void 0?!r:!!c.readback,u=await t.step({...c,readback:l}),d=t.stepIndex;o.publishBuffer({resourceKey:`bodies`,buffer:t.getResidentBuffer(),destroyFn:()=>!0,byteLength:u.byteLength,rowCount:t.count,layout:i,stepIndex:d,portableSnapshotFn:async()=>Float32Array.from(l?u:await t.readbackBodies())});let f=o.borrowBufferReadLease({resourceKey:`bodies`,consumerStage:`cosmic-quantum-renderer`,reason:r?`zero-copy-gpu-vertex-lease`:`live-render-frame-lease`});return{artifact:a({artifactId:`${n.taskId}:${e.model}:${d}`,taskKind:n.taskKind,closureRef:{module:`src/demos/cosmicQuantumGpuKernels.js`,entryPoint:t.gravityMode},representation:`nbody-interleaved-f32`,outputs:{deltas:[{operation:`replace`,tensorId:`bodies`,fromStep:s,toStep:d}]},execution:{backend:t.backend,stage:`${e.model}.step`,placement:`local`,gravityMode:t.gravityMode,zeroCopyReadbackSkipped:!l,scaleFactorA:t.scaleFactorA},validity:{finite:!0,bodyCount:t.activeCount,slotCount:t.count},validation:{status:`pass`,validationMode:`finite-output`,scientificValidation:!1,fullPhysicsValidation:!1},provenance:{...n.provenance,sourceService:S.ulgRuntime,methodHash:n.methodHash,inputHash:n.inputHash}}),leaseHandle:f}}}}var ct=27.211386245988,lt=Object.freeze([{Z:80,label:`Hg (Z=80 · Liquid Metal)`},{Z:79,label:`Au (Z=79 · Gold)`},{Z:47,label:`Ag (Z=47 · Silver)`},{Z:29,label:`Cu (Z=29 · Copper)`},{Z:26,label:`Fe (Z=26 · Iron)`},{Z:35,label:`Br (Z=35 · Liquid Halogen)`},{Z:31,label:`Ga (Z=31 · Gallium)`},{Z:17,label:`Cl (Z=17 · Gas)`},{Z:11,label:`Na (Z=11 · Sodium)`},{Z:10,label:`Ne (Z=10 · Neon)`},{Z:6,label:`C (Z=6 · Carbon)`},{Z:1,label:`H (Z=1 · Hydrogen)`}]),ut=Object.freeze({H2O:{formula:`H2O`,label:`H₂O (Water)`,atoms:[{Z:8,position:[0,0,0]},{Z:1,position:[1.43,0,1.108]},{Z:1,position:[-1.43,0,1.108]}]},H2:{formula:`H2`,label:`H₂ (Dihydrogen)`,atoms:[{Z:1,position:[0,0,-.7]},{Z:1,position:[0,0,.7]}]},CO:{formula:`CO`,label:`CO (Carbon Monoxide)`,atoms:[{Z:6,position:[0,0,-1.07]},{Z:8,position:[0,0,1.07]}]},HF:{formula:`HF`,label:`HF (Hydrogen Fluoride)`,atoms:[{Z:9,position:[0,0,-.18]},{Z:1,position:[0,0,1.56]}]}}),dt=Object.freeze({"4k-direct":{id:`4k-direct`,label:`4K Direct`,count:4096,mode:`direct`},"32k-bh":{id:`32k-bh`,label:`32K BH Octree`,count:32768,mode:`barnes-hut`},"65k-bh":{id:`65k-bh`,label:`65K BH Octree`,count:65536,mode:`barnes-hut`}}),ft=Object.freeze({"atomic-orbital":-10.5,"molecular-lattice":-8.8,"continuum-sph-solids":-.3,"planetary-orbital":10.6,"galactic-nbody":20.6,"supergalactic-cosmic":26.2}),pt=Object.freeze({1:15135487,6:6583435,7:3900150,8:15680580,9:3462041,10:3718648,11:11032055,17:8702998,26:16096779,29:14251846,31:9741240,35:12131356,47:14870768,79:16436245,80:14412542});function mt(e){return!(e>0)||!Number.isFinite(e)?`—`:e<1e-9?`${(e*0xe8d4a51000).toFixed(1)} pm (${(e/k).toFixed(2)} a₀)`:e<1e-6?`${(e*1e9).toFixed(2)} nm`:e<.001?`${(e*1e6).toFixed(1)} µm`:e<1e3?`${e.toFixed(e<10?2:0)} m`:e<1e9?`${(e/1e3).toFixed(1)} km`:e<0x5af3107a4000?`${(e/149597870700).toFixed(2)} AU`:e<0x834b28866a89c000?`${(e/9460730472580800).toFixed(2)} ly`:e<30857e18?`${(e/0x834b443d5de46000).toFixed(1)} kly`:e<94607e20?`${(e/3085677581491367e7).toFixed(1)} Mpc`:`${(e/94607304725808e11).toFixed(1)} Gly`}function ht(e){let t=e?.radialProfile?.samples||[];if(!t.length)return``;let n=Math.max(1e-6,...t.map(e=>e.radialProbabilityPerBohr)),r=Math.max(1e-6,e.radialProfile.rMaxBohr),i=t.map(e=>{let t=e.rBohr/r*244+8,i=66-e.radialProbabilityPerBohr/n*56;return`${t.toFixed(1)},${i.toFixed(1)}`}).join(` `),a=e.summary?.containmentRadii?.r95Bohr??0,o=Math.min(252,a/r*244+8);return`<svg viewBox="0 0 260 76" style="width:100%;height:76px;display:block;background:rgba(4,12,18,0.72);border-radius:6px;border:1px solid rgba(94,234,212,0.18);">
    <polyline fill="none" stroke="#5eead4" stroke-width="1.8" points="${i}" />
    <line x1="${o.toFixed(1)}" y1="6" x2="${o.toFixed(1)}" y2="68" stroke="#fbbf24" stroke-dasharray="3,2" stroke-width="1" />
    <text x="8" y="13" fill="#94a3b8" font-size="9" font-family="monospace">4πr²ρ(r) · r95=${a.toFixed(2)} a₀</text>
  </svg>`}function gt(){let t=new n(new e(.38,0),new E({color:16777215}),900);t.frustumCulled=!1;let i=new r,a=new ne,o=424242,s=()=>(o=Math.imul(o,1664525)+1013904223>>>0,o/4294967296);for(let e=0;e<900;e+=1){let n=s()*2-1,r=s()*Math.PI*2,o=Math.sqrt(Math.max(0,1-n*n)),c=150+s()*90;i.position.set(c*o*Math.cos(r),c*n,c*o*Math.sin(r)),i.scale.setScalar(.45+s()*.95),i.updateMatrix(),t.setMatrixAt(e,i.matrix);let l=s();a.setRGB(l>.72?.95:.68,l>.35?.88:.74,1),t.setColorAt(e,a)}return t.instanceMatrix.needsUpdate=!0,t.instanceColor&&(t.instanceColor.needsUpdate=!0),t}function _t(){let e=document.createElement(`canvas`);e.width=128,e.height=128;let t=e.getContext(`2d`),n=t.createRadialGradient(64,64,0,64,64,64);n.addColorStop(0,`rgba(255,255,255,1.0)`),n.addColorStop(.18,`rgba(255,248,232,0.78)`),n.addColorStop(.45,`rgba(255,220,165,0.28)`),n.addColorStop(.75,`rgba(180,205,255,0.07)`),n.addColorStop(1,`rgba(0,0,0,0.0)`),t.fillStyle=n,t.fillRect(0,0,128,128);let r=new h(e);return r.needsUpdate=!0,r}function vt(e,n,r,i=.88){let a=new m(new t({map:e,color:n,transparent:!0,opacity:i,blending:2,depthWrite:!1}));return a.scale.set(r,r,1),a}async function yt(e){let t=document.createElement(`div`);t.id=`ulg-cosmic-quantum-root`,t.style.cssText=[`position:fixed`,`inset:0`,`background:#040811`,`color:#e2f1ec`,`font-family:"Inter",system-ui,-apple-system,sans-serif`,`overflow:hidden`,`user-select:none`].join(`;`),e.innerHTML=``,e.appendChild(t);let m=document.createElement(`div`);m.style.cssText=`position:absolute;inset:0;`,t.appendChild(m);let h=new URLSearchParams(window.location.search),se=h.get(`scale`),ce=se!==null&&se.trim()!==``?Number(se):NaN,k=Number.isFinite(ce)?ce:ft[h.get(`regime`)]??ft[`galactic-nbody`],A=k,de=Number.parseInt(h.get(`Z`)||`80`,10)||80,j=h.get(`functional`)===`lda`?`lda`:`pbe`,M=Ee.some(e=>e.id===h.get(`orbital`))?h.get(`orbital`):`total-density`,N=ut[h.get(`molecule`)]?h.get(`molecule`):`H2O`,P=h.get(`basis`)===`6-31g(d)`?`6-31g(d)`:`sto-3g`,F=`density`,I=h.get(`neb`)===`1`,L=.5,R=[`disk`,`binary`,`sphere`].includes(h.get(`galaxy`))?h.get(`galaxy`):`disk`,pe=h.get(`paused`)!==`1`,ke=h.get(`tour`)===`1`,Ae=-1,z=(h.get(`peerRelay`)||``).trim(),je=(h.get(`peerRoom`)||`ulg-cosmic-quantum-mesh-v1`).trim(),B=[`requester`,`responder`,`observer`].includes(h.get(`peerRole`))?h.get(`peerRole`):`requester`,V=null,Me=`CPU fallback (WebGPU unavailable)`;try{let e=await navigator.gpu?.requestAdapter?.({powerPreference:`high-performance`});e&&(V=await e.requestDevice(),Me=e.info?.description||e.info?.vendor||`WebGPU GPU`)}catch{V=null}let Ne=dt[h.get(`tier`)]?h.get(`tier`):V?`32k-bh`:`4k-direct`,H=null,Pe=`three-webgl`;if(V&&typeof C==`function`)try{let e=new C({antialias:!0,device:V});e.setPixelRatio(Math.min(2,window.devicePixelRatio||1)),e.setSize(window.innerWidth,window.innerHeight),e.setClearColor(264209,1),e.toneMapping=4,e.toneMappingExposure=1.22,await e.init(),H=e,Pe=`three-webgpu`}catch{H=null}if(!H){let e=await fe(()=>import(`./three.module-BCyWaJXC.js`).then(e=>e.r),[],import.meta.url);H=new e.WebGLRenderer({antialias:!0,powerPreference:`high-performance`}),H.setPixelRatio(Math.min(2,window.devicePixelRatio||1)),H.setSize(window.innerWidth,window.innerHeight),H.setClearColor(264209,1),H.toneMapping=e.ACESFilmicToneMapping,H.toneMappingExposure=1.22,Pe=`three-webgl`}m.appendChild(H.domElement);let Fe=!!(V&&H.isWebGPURenderer),Ie=Je({device:V}),U=null,Le=null,W={connected:!1,role:B,relayUrl:z,roomId:je,remotePeers:0,quorumReady:!1,dispatches:0,lastResult:null,error:null};async function Re(){if(!Le)return;let e=Le;Le=null;try{await e.stop?.()}catch{}try{e.transport?.close?.()}catch{}W={...W,connected:!1,remotePeers:0,quorumReady:!1}}async function ze({relayUrl:e=z,roomId:t=je,role:n=B}={}){if(await Re(),z=String(e||``).trim(),je=String(t||`ulg-cosmic-quantum-mesh-v1`).trim(),B=[`requester`,`responder`,`observer`].includes(n)?n:`requester`,!z)return W={...W,connected:!1,relayUrl:``,roomId:je,role:B,error:null},W;try{let e=`cq-${B}-${Math.random().toString(36).slice(2,8)}`,t=new URL(`data:text/javascript;base64,LyoqCiAqIERldGVybWluaXN0aWMgUGVlckNvbXB1dGUgcmVzcG9uZGVyIGRlcml2YXRpb24gdGFzayBmb3IgdGhlIENvc21pYyA8LT4gUXVhbnR1bQogKiBkaXN0cmlidXRlZCBtZXNoIChgc3RhcnRMaXZlQ2xpZW50RGVyaXZhdGlvblBlZXJNZXNoYCkuCiAqCiAqIEV4ZWN1dGVkIGluc2lkZSByZXNwb25kZXIgYnJvd3NlciBjb250ZXh0cyB2aWEgUGVlckNvbXB1dGUgYENvbXB1dGVNYW5hZ2VyYAogKiBvdmVyIFdlYlNvY2tldC9XZWJSVEMgcmVsYXlzIGFuZCB2YWxpZGF0ZWQgYnkgMi1vZi0yIHF1b3J1bSBoYXNoaW5nLgogKi8KCmltcG9ydCB7IGRlcml2ZUVsZW1lbnRQcm9wZXJ0aWVzIH0gZnJvbSAnLi4vcnVudGltZS9tYXRlcmlhbC9lbGVtZW50Q2xvc3VyZXMuanMnOwppbXBvcnQgeyBldmFsdWF0ZUNoZXJlbmtvdkNsb3N1cmUgfSBmcm9tICcuLi9ydW50aW1lL21hdGVyaWFsL251Y2xlYXJDaGVyZW5rb3ZDbG9zdXJlLmpzJzsKCmV4cG9ydCBjb25zdCBDT1NNSUNfUVVBTlRVTV9QRUVSX1RBU0tfU0NIRU1BID0gJ3BlZXJjb21wdXRlLnVsZy5jb3NtaWMtcXVhbnR1bS1wZWVyLXRhc2sudjEnOwoKZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIHJ1bihkYXRhID0ge30pIHsKICBjb25zdCBraW5kID0gU3RyaW5nKGRhdGE/LmtpbmQgfHwgJ21hdGVyaWFsLnJlc29sdmUtZWxlbWVudCcpOwogIGNvbnN0IHBheWxvYWQgPSBkYXRhPy5wYXlsb2FkIHx8IGRhdGEgfHwge307CgogIGlmIChraW5kID09PSAnbnVjbGVhci5jaGVyZW5rb3YnKSB7CiAgICBjb25zdCBraW5ldGljRW5lcmd5TWVWID0gTnVtYmVyKHBheWxvYWQua2luZXRpY0VuZXJneU1lViA/PyAxLjApOwogICAgY29uc3QgcmVmcmFjdGl2ZUluZGV4ID0gTnVtYmVyKHBheWxvYWQucmVmcmFjdGl2ZUluZGV4ID8/IDEuMzMzKTsKICAgIGNvbnN0IGNoID0gZXZhbHVhdGVDaGVyZW5rb3ZDbG9zdXJlKHsga2luZXRpY0VuZXJneU1lViwgcmVmcmFjdGl2ZUluZGV4IH0pOwogICAgY29uc3QgdmFsdWUgPSB7CiAgICAgIHNjaGVtYTogQ09TTUlDX1FVQU5UVU1fUEVFUl9UQVNLX1NDSEVNQSwKICAgICAga2luZCwKICAgICAgYWN0aXZlOiBjaC5hY3RpdmUsCiAgICAgIGJldGE6IE51bWJlcihjaC5iZXRhLnRvRml4ZWQoNikpLAogICAgICBjaGVyZW5rb3ZBbmdsZURlZzogTnVtYmVyKGNoLmNoZXJlbmtvdkFuZ2xlRGVnLnRvRml4ZWQoNCkpLAogICAgICBwaG90b25zUGVyTWV0ZXI6IE1hdGgucm91bmQoY2gucGhvdG9uc1Blck1ldGVyKSwKICAgICAgc2NpZW50aWZpY1ZhbGlkYXRpb246IGZhbHNlCiAgICB9OwogICAgcmV0dXJuIHsKICAgICAgdmFsdWUsCiAgICAgIGNvbW1pdERlbHRhOiB7CiAgICAgICAgdGFza0lkOiBgY3EtcGVlcjoke2tpbmR9OiR7a2luZXRpY0VuZXJneU1lVn06JHtyZWZyYWN0aXZlSW5kZXh9YCwKICAgICAgICBzY29wZTogJ2Nvc21pYy1xdWFudHVtLXBlZXItbWVzaCcsCiAgICAgICAgcGF5bG9hZDogdmFsdWUKICAgICAgfQogICAgfTsKICB9CgogIGNvbnN0IGF0b21pY051bWJlclogPSBNYXRoLm1heCgxLCBNYXRoLm1pbigxMTgsIE1hdGguZmxvb3IoTnVtYmVyKHBheWxvYWQuYXRvbWljTnVtYmVyWiA/PyA4MCkgfHwgODApKSk7CiAgY29uc3QgZnVuY3Rpb25hbCA9IFN0cmluZyhwYXlsb2FkLmZ1bmN0aW9uYWwgfHwgJ3BiZScpLnRvTG93ZXJDYXNlKCk7CiAgY29uc3QgcHJvcHMgPSBkZXJpdmVFbGVtZW50UHJvcGVydGllcyhhdG9taWNOdW1iZXJaLCB7CiAgICBmdW5jdGlvbmFsLAogICAgc2NhbGFyUmVsYXRpdmlzdGljOiB0cnVlLAogICAgc3Bpbk9yYml0OiB0cnVlLAogICAgaW5jbHVkZUdhc1BoYXNlOiB0cnVlLAogICAgZ3JpZFBvaW50c046IDI2MAogIH0pOwogIGNvbnN0IHZhbHVlID0gewogICAgc2NoZW1hOiBDT1NNSUNfUVVBTlRVTV9QRUVSX1RBU0tfU0NIRU1BLAogICAga2luZDogJ21hdGVyaWFsLnJlc29sdmUtZWxlbWVudCcsCiAgICBhdG9taWNOdW1iZXJaLAogICAgc3ltYm9sOiBwcm9wcy5zeW1ib2wsCiAgICBmdW5jdGlvbmFsLAogICAgYm9uZGluZ0NsYXNzOiBwcm9wcy5ib25kaW5nQ2xhc3MsCiAgICBzdGFuZGFyZFBoYXNlQXQyOThLOiBwcm9wcy5zdGFuZGFyZFBoYXNlQXQyOThLLAogICAgbWVsdGluZ1BvaW50SzogTWF0aC5yb3VuZChwcm9wcy5tZWx0aW5nUG9pbnRLID8/IHByb3BzLnZkd0dhc1Byb3BlcnRpZXM/Lm1lbHRpbmdQb2ludEsgPz8gMCksCiAgICBib2lsaW5nUG9pbnRLOiBNYXRoLnJvdW5kKHByb3BzLmJvaWxpbmdQb2ludEsgPz8gcHJvcHMudmR3R2FzUHJvcGVydGllcz8uYm9pbGluZ1BvaW50SyA/PyAwKSwKICAgIGRlbnNpdHlLZ1Blck0zOiBNYXRoLnJvdW5kKHByb3BzLmRlbnNpdHlLZ1Blck0zID8/IHByb3BzLnZkd0dhc1Byb3BlcnRpZXM/LmNvbmRlbnNlZERlbnNpdHlLZ1Blck0zID8/IDApLAogICAgYnVsa01vZHVsdXNHUGE6IE51bWJlcigoKChwcm9wcy5idWxrTW9kdWx1c1BhID8/IHByb3BzLnZkd0dhc1Byb3BlcnRpZXM/LmJ1bGtNb2R1bHVzUGEgPz8gMCkgLyAxZTkpKS50b0ZpeGVkKDIpKSwKICAgIGNsb3N1cmVCYWNrZWQ6IHRydWUsCiAgICBzY2llbnRpZmljVmFsaWRhdGlvbjogZmFsc2UKICB9OwogIHJldHVybiB7CiAgICB2YWx1ZSwKICAgIGNvbW1pdERlbHRhOiB7CiAgICAgIHRhc2tJZDogYGNxLXBlZXI6ZWxlbWVudDoke2F0b21pY051bWJlclp9OiR7ZnVuY3Rpb25hbH1gLAogICAgICBzY29wZTogJ2Nvc21pYy1xdWFudHVtLXBlZXItbWVzaCcsCiAgICAgIHBheWxvYWQ6IHZhbHVlCiAgICB9CiAgfTsKfQo=`,``+import.meta.url).href,n=null,r=null;if(B===`observer`){r=oe({relayUrl:z,roomId:je,peerId:e,enableWebRtc:!1});let t=new Set,i=0,a=null;r.onMessage(e=>{i+=1,a=e?.type||null,e?.from&&t.add(e.from),e?.type===`presence`&&e?.alive===!1&&e?.from&&t.delete(e.from),e?.type===`peer-disconnect`&&e?.peerId&&t.delete(e.peerId),W.remotePeers=t.size,W.witnessedMessages=i,W.lastWitnessedType=a}),n={getPeers:()=>[...t],getStatus:()=>({connected:r.isConnected(),remotePeerCount:t.size,remotePeerIds:[...t],quorumReady:!1,witnessedMessages:i,lastWitnessedType:a}),async stop(){r.close()}}}else{let i=ae({relayUrl:z,roomId:je,peerId:e,enableWebRtc:!1,taskModuleUrl:t,announceIntervalMs:120,staleMs:1200,timeoutMs:15e3});r=i.transport,n={mesh:i,getPeers:()=>i.getStatus().remotePeerIds,getStatus:()=>i.getStatus(),getActiveRequester:()=>i.getActiveRequester(),async stop(){i.stop()}}}Le={transport:r,handle:n,peerId:e,role:B,stop:()=>n?.stop?.()};let i=n?.getStatus?.()||{};W={connected:!0,role:B,relayUrl:z,roomId:je,peerId:e,remotePeers:i.remotePeerCount??0,remotePeerIds:[...i.remotePeerIds||[]],quorumReady:!!i.quorumReady,witnessedMessages:i.witnessedMessages??0,lastWitnessedType:i.lastWitnessedType??null,dispatches:0,lastResult:null,error:null}}catch(e){W={...W,connected:!1,relayUrl:z,roomId:je,role:B,error:e instanceof Error?e.message:String(e)}}return W}let Be=Ce();Be.registerModule(ye());let G=null,K=null,Ve=Qe({count:3072,seed:1370}),q=nt({device:V,initialBodies:Ve,mode:1,label:`ulg-cosmic-web-lcdm`});Be.registerModule(st({method:{model:`cosmology-comoving-nbody`,version:1},engine:q,scaleRangeM:[1e22,1e28],zeroCopy:Fe}));let J=new u,He=new o(48,window.innerWidth/window.innerHeight,.01,600),Ue=.56,We=.62,Ge=15.5,Ke=new x(10212326,.78),qe=new T(16774624,1.8);qe.position.set(14,18,12);let Ye=new T(3718648,1.1);Ye.position.set(-14,-8,-12),J.add(Ke,qe,Ye);let Xe=_t();J.add(gt());let $e={};for(let e of we){let t=new a;t.name=e.id,J.add(t),$e[e.id]=t}let et=new r,tt=new ne,at=$e[`supergalactic-cosmic`],yt=_e({THREE:ee,TSL:be,renderer:H,bodyCount:q.count,palette:`cosmic-web`,initialBuffer:q.getResidentBuffer()});at.add(yt.mesh),yt.zeroCopy||yt.syncFromCpuBodies(q.getBodies());let bt=new _(new s(11.6,32,20),new E({color:5195493,wireframe:!0,transparent:!0,opacity:.11}));at.add(bt);let xt=new p,St=new Float32Array(1300*2*3);xt.setAttribute(`position`,new d(St,3));let Ct=new y(xt,new D({color:8490232,transparent:!0,opacity:.44}));Ct.frustumCulled=!1,Ct.visible=!yt.zeroCopy,at.add(Ct);function wt(e){let t=e.length/8,n=0,r=1300,i=Math.max(1,Math.floor(t/220));for(let a=0;a<t&&n<r;a+=i){let o=a*8;for(let s=a+i;s<Math.min(t,a+i*24)&&n<r;s+=i){let t=s*8,r=(e[o]-e[t])**2+(e[o+1]-e[t+1])**2+(e[o+2]-e[t+2])**2;if(r>.14&&r<6.8){let r=n*6;St[r]=e[o],St[r+1]=e[o+1],St[r+2]=e[o+2],St[r+3]=e[t],St[r+4]=e[t+1],St[r+5]=e[t+2],n+=1}}}xt.setDrawRange(0,n*2),xt.attributes.position.needsUpdate=!0}wt(Ve);let Tt=$e[`galactic-nbody`],Et=vt(Xe,16765565,5.2,.9);Tt.add(Et);async function Dt({tierId:e=Ne,preset:t=R}={}){Ne=dt[e]?e:`32k-bh`,R=[`disk`,`binary`,`sphere`].includes(t)?t:`disk`;let n=dt[Ne];K&&=(Tt.remove(K.mesh),K.dispose(),null),G&&=(Be.unregisterModule({model:`nbody-gravity`,version:1}),G.dispose(),null);let r=Ze({count:n.count,preset:R,seed:825});G=n.mode===`barnes-hut`&&V?rt({device:V,initialBodies:r,mode:0,boxHalf:16,theta:.65,label:`ulg-galactic-bh-${n.count}`}):nt({device:V,initialBodies:r,mode:0,label:`ulg-galactic-direct-${n.count}`}),Be.registerModule(st({method:{model:`nbody-gravity`,version:1},engine:G,scaleRangeM:[1e6,1e22],zeroCopy:Fe})),K=_e({THREE:ee,TSL:be,renderer:H,bodyCount:G.count,palette:`galactic`,initialBuffer:G.getResidentBuffer()}),Tt.add(K.mesh),K.zeroCopy||K.syncFromCpuBodies(G.getBodies()),Et.position.set(r[0],r[1],r[2]),Et.visible=R!==`binary`}await Dt();let Y=ve({moduleRegistry:Be}),Ot=null;if(V)try{let e=Y.atlasRuntime.snapshotAtlas(),t=Y.summary().chartByRegimeId;Ot=(await Oe(V,{atlas:e,particles:[{chartId:t[`planetary-orbital`],flags:1,massKg:1989e27,temperatureK:5778,posLocal:[0,0,0],effectiveAreaM2:0x548406bbda210000},{chartId:t[`galactic-nbody`],flags:1,massKg:2e41,temperatureK:4200,posLocal:[2.5,.2,-1.8],effectiveAreaM2:1e32},{chartId:t[`supergalactic-cosmic`],flags:1,massKg:2e45,temperatureK:3e3,posLocal:[-4.2,1.5,3.1],effectiveAreaM2:1e36}]})).receipt}catch{Ot=null}let kt=$e[`planetary-orbital`],At=new _(new s(1.38,32,24),new E({color:16773306})),jt=vt(Xe,16754734,8.8,.88),Mt=new w(16773580,95,48,1.35);kt.add(At,jt,Mt);let Nt=[{name:`Inner Rocky`,a:3.1,r:.28,color:13933162,omega:1.55,phase:.4,tilt:.05},{name:`Ocean World (H₂O/Fe)`,a:4.9,r:.42,color:3718648,omega:.92,phase:1.9,tilt:.03},{name:`Ringed Giant`,a:7.7,r:.78,color:15122058,omega:.46,phase:3.6,tilt:.08,ringed:!0},{name:`Ice Giant`,a:10.4,r:.52,color:8246268,omega:.26,phase:5.1,tilt:.04}];for(let e of Nt){let t=[];for(let n=0;n<=96;n+=1){let r=n/96*Math.PI*2;t.push(new c(Math.cos(r)*e.a,Math.sin(r)*e.a*Math.sin(e.tilt),Math.sin(r)*e.a))}kt.add(new l(new p().setFromPoints(t),new D({color:3718648,transparent:!0,opacity:.34})));let n=new _(new s(e.r,28,20),new b({color:e.color,roughness:.38,metalness:.12}));if(e.ringed){let t=new _(new re(e.r*1.35,e.r*2.2,56),new E({color:14664863,side:2,transparent:!0,opacity:.62}));t.rotation.x=Math.PI/2.35,n.add(t)}e.mesh=n,kt.add(n)}let Pt=$e[`continuum-sph-solids`],Ft=new a;Pt.add(Ft);let It=new y(new te(new f(6.4,6.4,6.4)),new D({color:3003583,transparent:!0,opacity:.52}));Pt.add(It);let Lt=null,Rt=null,zt=null,Bt=`liquid`,X=null,Z=null;function Vt(e){for(;e.children.length>0;)e.children.pop().traverse?.(e=>{e.isSprite||e.geometry?.dispose?.(),Array.isArray(e.material)?e.material.forEach(e=>e.dispose?.()):e.material?.dispose?.()})}async function Ht(){Z&&=(Ft.remove(Z.mesh),Z.dispose(),null),X&&=(Be.unregisterModule({model:`continuum-micro-sph`,version:1}),X.dispose(),null),Vt(Ft),Lt=null,Rt=null,zt=null,U=await Ie.resolveElement(de,{functional:j,scalarRelativistic:!0,includeGasPhase:!0,gridPointsN:360});let e=U.properties,t=e.vdwGasProperties,n=e.standardPhaseAt298K||`solid`;Bt=n;let r=e.densityKgPerM3??t?.condensedDensityKgPerM3??1e3,i=e.bulkModulusPa??t?.bulkModulusPa??22e8,o=e.cpJPerKgK??400,[s,c,l]=e.opticalColorSrgb||[.78,.85,.92],u=new ne(s,c,l),d=new _(new f(3.4,.42,3.4),new b({color:1981023,emissive:795707,emissiveIntensity:.4,roughness:.2,metalness:.15,transparent:!0,opacity:.58}));d.position.set(0,-1.25,0);let p=new y(new te(new f(3.42,.44,3.42)),new D({color:8246268,transparent:!0,opacity:.55}));p.position.copy(d.position),Ft.add(d,p);let m=it({count:1024,phase:n,seed:4201+de*17});X=ot({device:V,initialBodies:m,phase:n,bulkModulusPa:i,label:`ulg-continuum-${e.symbol.toLowerCase()}-${n}`}),Be.registerModule(st({method:{model:`continuum-micro-sph`,version:1},engine:X,scaleRangeM:[1e-4,100],zeroCopy:Fe})),Z=_e({THREE:ee,TSL:be,renderer:H,bodyCount:X.count,palette:`continuum-material`,tintColor:[s,c,l],particleScale:n===`gas`?.085:.115,initialBuffer:X.getResidentBuffer()}),Ft.add(Z.mesh),Z.zeroCopy||Z.syncFromCpuBodies(X.getBodies());let h=vt(Xe,u.getHex(),4.4,n===`gas`?.24:.4);h.position.set(0,n===`liquid`?-.35:.2,0),Ft.add(h);let v=1/Math.max(10,r),x=ue({material:e.symbol.toLowerCase(),cvJPerKgK:Math.max(50,o),rSpecificJPerKgK:8.314462618/Math.max(.001,e.molarMassKgPerMol),bulkModulusPa:Math.max(1e7,i),refTemperatureK:293.15,refSpecificVolumeM3PerKg:v}),S=new g(5.8,5.8,22,22);S.rotateX(-Math.PI/2);let C=S.attributes.position,w=1/0,T=-1/0,re=new Float64Array(C.count);for(let e=0;e<C.count;e+=1){let t=(C.getX(e)+2.9)/5.8,n=(C.getZ(e)+2.9)/5.8,r=180+t*420,i=v*(.92+n*.16),a=x.closedForm.a(r,i);re[e]=a,a<w&&(w=a),a>T&&(T=a)}let O=Math.max(1e-6,T-w);for(let e=0;e<C.count;e+=1)C.setY(e,-2.95+(re[e]-w)/O*1.45);C.needsUpdate=!0,S.computeVertexNormals(),Rt=new a,Rt.add(new _(S,new b({color:1357990,emissive:1013358,emissiveIntensity:.42,side:2,transparent:!0,opacity:.34,roughness:.35})),new _(S,new E({color:6220500,wireframe:!0,transparent:!0,opacity:.56}))),Ft.add(Rt)}let Ut=$e[`molecular-lattice`],Wt=null,Gt=null,Kt=`worker-cpu-derived`,qt=null,Jt=`accepted`;function Yt(){return qt||(qt=le([{Z:8,position:[0,0,0]},{Z:1,position:[1.43,1.108,0]},{Z:1,position:[-1.43,1.108,0]}],[{Z:8,position:[0,0,0]},{Z:1,position:[1.43,-1.108,0]},{Z:1,position:[-1.43,-1.108,0]}],{nImages:7,maxSteps:14,springK:.12,stepSize:.16,basis:`sto-3g`}),qt)}function Xt(e,t){let n=e?.energiesHa||[];if(n.length<3)return``;let r=n[0],i=n.map(e=>(e-r)*ct),a=Math.min(...i),o=Math.max(a+.1,...i),s=i.map((e,t)=>{let n=10+t/(i.length-1)*240,r=56-(e-a)/(o-a)*44;return`${n.toFixed(1)},${r.toFixed(1)}`}).join(` `),c=10+Math.max(0,Math.min(1,t))*240,l=10+e.saddleImageIndex/(i.length-1)*240;return`<svg viewBox="0 0 260 66" style="width:100%;height:66px;display:block;background:rgba(4,12,18,0.72);border-radius:6px;border:1px solid rgba(251,191,36,0.28);">
      <polyline fill="none" stroke="#fbbf24" stroke-width="1.8" points="${s}" />
      <line x1="${l.toFixed(1)}" y1="6" x2="${l.toFixed(1)}" y2="58" stroke="#f87171" stroke-dasharray="2,2" stroke-width="1" />
      <line x1="${c.toFixed(1)}" y1="6" x2="${c.toFixed(1)}" y2="58" stroke="#34d399" stroke-width="1.5" />
      <text x="8" y="13" fill="#fde68a" font-size="9" font-family="monospace">CI-NEB H₂O Inversion · Ea=${(e.forwardBarrierHa*ct).toFixed(2)} eV</text>
    </svg>`}function Zt(e,t){let n=e.images,r=Math.max(0,Math.min(1,t))*(n.length-1),i=Math.min(n.length-2,Math.floor(r)),a=r-i;return n[i].map((e,t)=>({Z:e.Z,position:[e.position[0]+a*(n[i+1][t].position[0]-e.position[0]),e.position[1]+a*(n[i+1][t].position[1]-e.position[1]),e.position[2]+a*(n[i+1][t].position[2]-e.position[2])]}))}async function Qt(){Vt(Ut);let e,t,r=P;if(I)e=Zt(Yt(),L),t=`H2O`,r=`sto-3g`,Jt=L>.35&&L<.65?`boundary-saddle`:`accepted`;else{let n=ut[N]||ut.H2O;e=n.atoms,t=n.formula,Jt=`accepted`}let a={formula:t,atoms:e},o=r===`6-31g(d)`?16:18,l=he(a.atoms,{formula:a.formula,basis:r,gridDim:o,includeUmp2:!1,includeAnalyticGradient:!1,includeOrbitals:!0});Gt=l.artifact;{let e=Jt===`accepted`?3462041:16498468,t=new y(new te(new f(6.8,5.2,5.2)),new D({color:e,transparent:!0,opacity:.34}));Ut.add(t)}let u=l.densePayloads[l.artifact.grid.payloadHandles.chargeDensity.key];if(Kt=`worker-cpu-derived`,F===`density`&&V)try{let e=await De(V,{basis:l.hf.basis,densityMatrix:l.hf.P,boundsMinBohr:l.artifact.grid.boundsMinBohr,boundsMaxBohr:l.artifact.grid.boundsMaxBohr,dimensions:l.artifact.grid.dimensions});u=e.density,Kt=e.statusBadge}catch{Kt=`worker-cpu-derived`}else F===`homo`&&l.artifact.grid.payloadHandles.homoOrbital?u=l.densePayloads[l.artifact.grid.payloadHandles.homoOrbital.key]:F===`lumo`&&l.artifact.grid.payloadHandles.lumoOrbital&&(u=l.densePayloads[l.artifact.grid.payloadHandles.lumoOrbital.key]);Wt=Te({materialKey:a.formula.toLowerCase(),formula:a.formula,atoms:a.atoms,basis:`sto-3g`,functional:j,gridDim:10,includeUmp2:!1,includeQhaClosure:!1,includeTriadA4Replay:!0}).bundle;let d=1.95;for(let e=0;e<a.atoms.length;e+=1){let t=a.atoms[e],n=new _(new s(t.Z===1?.42:.72,28,22),new b({color:pt[t.Z]??9741240,emissive:pt[t.Z]??4674921,emissiveIntensity:.25,roughness:.25,metalness:.22}));n.position.set(t.position[0]*d,t.position[1]*d,t.position[2]*d),Ut.add(n)}for(let e of l.artifact.bondDiscoveryTrace.bonds){let t=new c(...a.atoms[e.atomA].position).multiplyScalar(d),n=new c(...a.atoms[e.atomB].position).multiplyScalar(d),r=new c().subVectors(n,t),o=r.length(),s=.1+.1*Math.min(3,e.mayerBondOrder),l=new _(new i(s,s,o,20),new b({color:10090212,emissive:1357990,emissiveIntensity:.35,roughness:.28,metalness:.2}));l.position.copy(t).add(n).multiplyScalar(.5),l.quaternion.setFromUnitVectors(new c(0,1,0),r.normalize()),Ut.add(l)}let[p,m,h]=l.artifact.grid.dimensions,g=l.artifact.grid.boundsMinBohr,v=l.artifact.grid.voxelSpacingBohr,x=0;for(let e=0;e<u.length;e+=1){let t=Math.abs(u[e]);t>x&&(x=t)}let S=x*(F===`density`?.004:.045),C=[],w=[],T=0,ee=0;for(let e=0;e<h;e+=1)for(let t=0;t<m;t+=1)for(let n=0;n<p;n+=1){let r=u[ee++],i=Math.abs(r);if(i<S)continue;let a=(i/Math.max(1e-9,x))**.55;T+=a,C.push({ix:n,iy:t,iz:e,val:r,mag:i}),w.push(T)}if(C.length>0&&T>0){let e=2600,t=new n(new ie(1,1),new E({color:16777215,transparent:!0,opacity:.075,blending:2,depthWrite:!1}),e);t.frustumCulled=!1;let r=918273,i=()=>(r=Math.imul(r,1664525)+1013904223>>>0,r/4294967296),a=Math.min(v[0],v[1],v[2])*d*.34;for(let n=0;n<e;n+=1){let e=i()*T,r=0,o=w.length-1;for(;r<o;){let t=r+o>>1;w[t]<e?r=t+1:o=t}let s=C[r],c=(g[0]+(s.ix+(i()-.5))*v[0])*d,l=(g[1]+(s.iy+(i()-.5))*v[1])*d,u=(g[2]+(s.iz+(i()-.5))*v[2])*d,f=Math.min(1,(s.mag/Math.max(1e-9,x))**.35);et.position.set(c,l,u),et.scale.setScalar(a*(.45+.85*f)),et.updateMatrix(),t.setMatrixAt(n,et.matrix),F===`density`?tt.setRGB(.1+.52*f,.72+.28*f,1):s.val>=0?tt.setRGB(.12,.85*f+.15,1):tt.setRGB(1,.28*f+.14,.52),t.setColorAt(n,tt)}t.instanceMatrix.needsUpdate=!0,t.instanceColor&&(t.instanceColor.needsUpdate=!0),Ut.add(t)}}let $t=$e[`atomic-orbital`],en=null,tn=null;function nn(){tn&&=($t.remove(tn.mesh),tn.dispose(),null),Vt($t);let e=Se(de,{functional:j,scalarRelativistic:!0,spinOrbit:!0,gridPointsN:520,cloudGridDim:16,maxGridDim:24});en=e.artifact;let t=e.artifact.orbitalCloudGrid.boundsBohr.max[0],n=4.9/Math.max(1.5,t),r=new _(new s(.24,24,18),new E({color:16707722})),i=vt(Xe,16498468,2.4,.9);$t.add(r,i);let a=new _(new s(Math.min(5,e.artifact.summary.containmentRadii.r95Bohr*n),28,18),new E({color:16498468,wireframe:!0,transparent:!0,opacity:.16}));$t.add(a),tn=xe({THREE:ee,TSL:be,renderer:H,radialSamples:e.artifact.radialProfile.samples||[],rMaxBohr:e.artifact.radialProfile.rMaxBohr||t,r95Bohr:e.artifact.summary.containmentRadii.r95Bohr||2.5,modeId:M,boxHalfExtent:5.1,dim:40}),$t.add(tn.mesh)}nn(),await Ht(),await Qt(),z&&await ze({relayUrl:z,roomId:je,role:B});let rn=document.createElement(`div`);rn.style.cssText=`position:absolute;top:14px;left:16px;right:16px;display:flex;align-items:center;justify-content:space-between;gap:12px;pointer-events:none;z-index:10;`,rn.innerHTML=`
    <div style="pointer-events:auto;display:flex;align-items:center;gap:10px;padding:8px 14px;border-radius:10px;background:rgba(6,14,24,0.82);border:1px solid rgba(94,234,212,0.28);backdrop-filter:blur(10px);">
      <span style="width:9px;height:9px;border-radius:50%;background:#34d399;box-shadow:0 0 10px #34d399;"></span>
      <div>
        <div id="cq-regime-title" style="font-size:13px;font-weight:700;letter-spacing:0.01em;color:#f0fdf4;">Galactic N-Body</div>
        <div id="cq-scale-readout" style="font-size:11px;font-family:monospace;color:#7dd3fc;">10^20.6 m · Chart L=70</div>
      </div>
    </div>
    <div style="pointer-events:auto;display:flex;align-items:center;gap:8px;">
      <button id="cq-tour-btn" type="button" style="padding:7px 12px;border-radius:8px;border:1px solid rgba(94,234,212,0.45);background:rgba(16,42,48,0.88);color:#99f6e4;font-size:12px;font-weight:600;cursor:pointer;">▶ Powers of Ten Tour</button>
      <button id="cq-play-btn" type="button" style="padding:7px 12px;border-radius:8px;border:1px solid rgba(148,163,184,0.35);background:rgba(12,22,34,0.86);color:#e2e8f0;font-size:12px;font-weight:600;cursor:pointer;">⏸ Sim Running</button>
      <a href="./stellar-genesis.html" style="padding:7px 12px;border-radius:8px;border:1px solid rgba(56,189,248,0.45);background:rgba(10,32,52,0.86);color:#bae6fd;font-size:12px;font-weight:600;text-decoration:none;">Stellar Genesis ↗</a>
      <a href="./?preset=iron-ice-quench" style="padding:7px 12px;border-radius:8px;border:1px solid rgba(251,191,36,0.4);background:rgba(36,24,10,0.85);color:#fde68a;font-size:12px;font-weight:600;text-decoration:none;">SPH Lab ↗</a>
    </div>
  `,t.appendChild(rn);let Q=document.createElement(`aside`);Q.id=`cq-inspector`,Q.style.cssText=`position:absolute;top:72px;right:16px;width:320px;max-height:calc(100vh - 178px);overflow:auto;padding:14px;border-radius:12px;background:rgba(6,14,24,0.84);border:1px solid rgba(148,186,180,0.24);backdrop-filter:blur(12px);font-size:12px;line-height:1.45;z-index:10;display:flex;flex-direction:column;gap:10px;`,t.appendChild(Q);let an=document.createElement(`div`);an.style.cssText=`position:absolute;left:16px;right:16px;bottom:14px;padding:10px 14px;border-radius:12px;background:rgba(6,14,24,0.86);border:1px solid rgba(94,234,212,0.24);backdrop-filter:blur(10px);z-index:10;display:flex;flex-direction:column;gap:8px;`,an.innerHTML=`
    <div style="display:flex;align-items:center;gap:10px;">
      <span style="font-size:11px;font-family:monospace;color:#94a3b8;white-space:nowrap;">10⁻¹¹ m</span>
      <input id="cq-zoom-slider" type="range" min="-11.3" max="27.2" step="0.05" value="${A}" style="flex:1;accent-color:#34d399;cursor:pointer;" />
      <span style="font-size:11px;font-family:monospace;color:#94a3b8;white-space:nowrap;">10²⁷ m (93 Gly)</span>
    </div>
    <div id="cq-regime-pills" style="display:flex;flex-wrap:wrap;gap:6px;justify-content:space-between;"></div>
  `,t.appendChild(an);let on=an.querySelector(`#cq-regime-pills`),sn=new Map,cn={"atomic-orbital":`10⁻¹¹m Atomic DFT`,"molecular-lattice":`10⁻⁹m Molecular 6-31G(d)`,"continuum-sph-solids":`10⁰m Continuum & A4`,"planetary-orbital":`10¹⁰m Planetary`,"galactic-nbody":`10²¹m Galactic N-Body`,"supergalactic-cosmic":`10²⁷m Cosmic Web`};for(let e of we){let t=document.createElement(`button`);t.type=`button`,t.dataset.regimeJump=e.id,t.textContent=cn[e.id]||e.id,t.style.cssText=`flex:1;min-width:128px;padding:5px 8px;border-radius:7px;border:1px solid rgba(148,163,184,0.25);background:rgba(12,24,36,0.75);color:#cbd5e1;font-size:11px;font-weight:600;cursor:pointer;`,t.addEventListener(`click`,()=>{ke=!1,mn(),k=ft[e.id]}),on.appendChild(t),sn.set(e.id,t)}let ln=rn.querySelector(`#cq-regime-title`),un=rn.querySelector(`#cq-scale-readout`),dn=rn.querySelector(`#cq-tour-btn`),fn=rn.querySelector(`#cq-play-btn`),pn=an.querySelector(`#cq-zoom-slider`);function mn(){dn.textContent=ke?`⏸ Stop Zoom Tour`:`▶ Powers of Ten Tour`}function hn(){fn.textContent=pe?`⏸ Sim Running`:`▶ Sim Paused`}dn.addEventListener(`click`,()=>{ke=!ke,mn()}),fn.addEventListener(`click`,()=>{pe=!pe,hn()}),pn.addEventListener(`input`,()=>{ke=!1,mn(),k=Number(pn.value)});let gn=!1,_n=0,vn=0;H.domElement.addEventListener(`pointerdown`,e=>{gn=!0,_n=e.clientX,vn=e.clientY}),window.addEventListener(`pointerup`,()=>{gn=!1}),window.addEventListener(`pointermove`,e=>{if(!gn)return;let t=e.clientX-_n,n=e.clientY-vn;_n=e.clientX,vn=e.clientY,Ue-=t*.006,We=Math.max(-1.25,Math.min(1.25,We+n*.006))}),H.domElement.addEventListener(`wheel`,e=>{e.preventDefault(),ke=!1,mn(),k=Math.max(-11.3,Math.min(27.2,k+e.deltaY*.0035))},{passive:!1});let yn=null,bn=null;function $(e){let t=e.primaryRegime.id,n=Y.summary(),r=en,i=Gt,a=U?.properties,o=Wt?ge(Wt,{expectedGeneratorFingerprint:me,strict:!0}):null,s=Ot?`<span style="color:#34d399;">${Ot.verified?`PASS`:`WARN`}</span> (|ΣF|=${Ot.momentumRelError.toExponential(1)})`:`CPU-only`,c=``;if(t===`atomic-orbital`&&r){let e=r.orbitals.filter(e=>e.spinOrbitSplittingHa>0),t=e.length>0?e.slice(-2).map(e=>`${e.n}${`spdf`[e.l]||e.l}: ${(e.spinOrbitSplittingHa*ct).toFixed(3)} eV`).join(` · `):`s-shell only (ΔE_SO = 0)`,n=a?.standardPhaseAt298K?.toUpperCase()||`—`,i=Ee.map(e=>`<button type="button" data-orbital-mode="${e.id}" style="padding:3px 5px;border-radius:4px;border:1px solid ${M===e.id?`#34d399`:`rgba(148,163,184,0.28)`};background:${M===e.id?`rgba(52,211,153,0.18)`:`#0b1724`};color:#e2f1ec;font-size:10px;cursor:pointer;">${e.label}</button>`).join(``);c=`
        <div style="border-top:1px solid rgba(148,163,184,0.18);padding-top:8px;">
          <div style="font-weight:600;color:#5eead4;margin-bottom:6px;">Schrödinger Relativistic KS-DFT (3D Volumetric)</div>
          <div style="display:flex;gap:6px;margin-bottom:6px;">
            <select id="cq-elem-sel" style="flex:1;padding:4px 6px;border-radius:6px;background:#0b1724;color:#e2f1ec;border:1px solid rgba(94,234,212,0.3);">
              ${lt.map(e=>`<option value="${e.Z}" ${e.Z===de?`selected`:``}>${e.label}</option>`).join(``)}
            </select>
            <select id="cq-func-sel" style="width:72px;padding:4px 6px;border-radius:6px;background:#0b1724;color:#e2f1ec;border:1px solid rgba(94,234,212,0.3);">
              <option value="pbe" ${j===`pbe`?`selected`:``}>PBE</option>
              <option value="lda" ${j===`lda`?`selected`:``}>LDA</option>
            </select>
          </div>
          <div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:6px;">${i}</div>
          ${ht(r)}
          <div style="margin-top:6px;font-family:monospace;font-size:11px;color:#cbd5e1;">
            E_tot: ${r.summary.totalEnergyHa.toFixed(3)} Ha · ∫ρ=${r.summary.integratedElectrons.toFixed(4)}e<br/>
            SO (L·S): ${t}<br/>
            Bulk @293K: <span style="color:#6ee7b7;">${n}</span> (Tm=${Math.round(a?.meltingPointK??a?.vdwGasProperties?.meltingPointK??0)}K, Tb=${Math.round(a?.boilingPointK??a?.vdwGasProperties?.boilingPointK??0)}K)<br/>
            Volume: <span style="color:#7dd3fc;">${tn?.mode||`fallback`}</span><br/>
            Label: <span style="color:#fde68a;">${tn?.provenance||`radial-atomic-density-reconstruction`}</span>
          </div>
        </div>
      `}else if(t===`molecular-lattice`&&i){let e=i.bondDiscoveryTrace.bonds.map(e=>`B=${e.mayerBondOrder.toFixed(2)} (${(e.distanceM*0xe8d4a51000).toFixed(0)}pm)`).join(`, `),t=I?Xt(Yt(),L):``;c=`
        <div style="border-top:1px solid rgba(148,163,184,0.18);padding-top:8px;">
          <div style="font-weight:600;color:#5eead4;margin-bottom:6px;">Molecular HF Density, CI-NEB &amp; Polytopes</div>
          <div style="display:flex;gap:6px;margin-bottom:6px;">
            <select id="cq-mol-sel" style="flex:1;padding:4px 6px;border-radius:6px;background:#0b1724;color:#e2f1ec;border:1px solid rgba(94,234,212,0.3);">
              ${Object.values(ut).map(e=>`<option value="${e.formula}" ${e.formula===N?`selected`:``}>${e.label}</option>`).join(``)}
            </select>
            <select id="cq-basis-sel" style="width:90px;padding:4px 6px;border-radius:6px;background:#0b1724;color:#e2f1ec;border:1px solid rgba(94,234,212,0.3);">
              <option value="sto-3g" ${P===`sto-3g`?`selected`:``}>STO-3G</option>
              <option value="6-31g(d)" ${P===`6-31g(d)`?`selected`:``}>6-31G(d)</option>
            </select>
          </div>
          <div style="display:flex;gap:4px;margin-bottom:6px;">
            ${[`density`,`homo`,`lumo`].map(e=>`<button type="button" data-mol-view="${e}" style="flex:1;padding:4px;border-radius:5px;border:1px solid ${F===e?`#34d399`:`rgba(148,163,184,0.3)`};background:${F===e?`rgba(52,211,153,0.18)`:`#0b1724`};color:#e2f1ec;font-size:11px;cursor:pointer;">${e.toUpperCase()}</button>`).join(``)}
            <button id="cq-neb-toggle" type="button" style="padding:4px 7px;border-radius:5px;border:1px solid ${I?`#fbbf24`:`rgba(148,163,184,0.3)`};background:${I?`rgba(251,191,36,0.2)`:`#0b1724`};color:#fde68a;font-size:11px;cursor:pointer;">CI-NEB</button>
          </div>
          ${I?`
            ${t}
            <div style="display:flex;align-items:center;gap:6px;margin:6px 0;">
              <span style="font-size:10px;font-family:monospace;color:#fde68a;">ξ=${L.toFixed(2)}</span>
              <input id="cq-neb-slider" type="range" min="0" max="1" step="0.05" value="${L}" style="flex:1;accent-color:#fbbf24;" />
            </div>
          `:``}
          <div style="font-family:monospace;font-size:11px;color:#cbd5e1;">
            E_RHF: ${i.electronicSummary.rhfTotalEnergyHa.toFixed(4)} Ha (${i.electronicSummary.nBasis} AOs)<br/>
            HOMO-LUMO: ${i.electronicSummary.homoLumoGapHa==null?`—`:(i.electronicSummary.homoLumoGapHa*ct).toFixed(2)+` eV`}<br/>
            Mayer: ${e||`none`}<br/>
            Polytope: <span style="color:${Jt===`accepted`?`#34d399`:`#fbbf24`};">${Jt}</span> · Sampler: <span style="color:#7dd3fc;">${Kt}</span> · Strict: ${o?.ok?`PASS`:`BLOCKED`}
          </div>
        </div>
      `}else if(t===`continuum-sph-solids`){let e=Math.round(a?.meltingPointK??a?.vdwGasProperties?.meltingPointK??0),t=Math.round(a?.boilingPointK??a?.vdwGasProperties?.boilingPointK??0),n=Math.round(a?.densityKgPerM3??a?.vdwGasProperties?.condensedDensityKgPerM3??0),r=((a?.bulkModulusPa??a?.vdwGasProperties?.bulkModulusPa??0)/1e9).toFixed(1),i=Z?.getStats();c=`
        <div style="border-top:1px solid rgba(148,163,184,0.18);padding-top:8px;">
          <div style="font-weight:600;color:#5eead4;margin-bottom:6px;">Quantum → Live GPU Continuum &amp; Eshkol A4</div>
          <select id="cq-cont-elem-sel" style="width:100%;margin-bottom:6px;padding:4px 6px;border-radius:6px;background:#0b1724;color:#e2f1ec;border:1px solid rgba(94,234,212,0.3);">
            ${lt.map(e=>`<option value="${e.Z}" ${e.Z===de?`selected`:``}>${e.label}</option>`).join(``)}
          </select>
          <div style="font-family:monospace;font-size:11px;color:#cbd5e1;">
            Element: <span style="color:#fef08a;">${a?.symbol||`?`}</span> (${a?.bondingClass||`derived`})<br/>
            Phase @293K: <span style="color:#34d399;font-weight:700;">${(a?.standardPhaseAt298K||`solid`).toUpperCase()}</span> · Tm=${e}K · Tb=${t}K<br/>
            ρ=${n.toLocaleString()} kg/m³ · B=${r} GPa<br/>
            Micro-SPH: ${X?.count??0} pts · <span style="color:#7dd3fc;">${i?.zeroCopy?`zero-copy GPU (0 B/frame)`:`cpu-instanced`}</span><br/>
            Resolver: <span style="color:#6ee7b7;">${U?.derivedBackend||U?.resolverStatus||`cpu-derived`}</span> (${U?.resolverStatus||`derived`})
          </div>
        </div>
      `}else if(t===`galactic-nbody`){let e=K?.getStats();c=`
        <div style="border-top:1px solid rgba(148,163,184,0.18);padding-top:8px;">
          <div style="font-weight:600;color:#fbbf24;margin-bottom:6px;">Galactic WebGPU N-Body (Eshkol ABI)</div>
          <div style="display:flex;gap:4px;margin-bottom:5px;">
            ${[[`disk`,`Spiral`],[`binary`,`Merger`],[`sphere`,`Globular`]].map(([e,t])=>`<button type="button" data-galaxy-preset="${e}" style="flex:1;padding:4px;border-radius:5px;border:1px solid ${R===e?`#fbbf24`:`rgba(148,163,184,0.3)`};background:${R===e?`rgba(251,191,36,0.16)`:`#0b1724`};color:#fef3c7;font-size:11px;cursor:pointer;">${t}</button>`).join(``)}
          </div>
          <div style="display:flex;gap:4px;margin-bottom:6px;">
            ${Object.values(dt).map(e=>`<button type="button" data-galaxy-tier="${e.id}" style="flex:1;padding:3px;border-radius:5px;border:1px solid ${Ne===e.id?`#34d399`:`rgba(148,163,184,0.28)`};background:${Ne===e.id?`rgba(52,211,153,0.16)`:`#0b1724`};color:#d1fae5;font-size:10px;cursor:pointer;">${e.label}</button>`).join(``)}
          </div>
          <div style="font-family:monospace;font-size:11px;color:#cbd5e1;">
            Bodies: ${G.count.toLocaleString()} · Step: <span id="cq-gal-step">${G.stepIndex}</span><br/>
            Solver: <span style="color:#34d399;">${G.gravityMode}</span><br/>
            Presenter: <span style="color:#7dd3fc;">${e?.zeroCopy?`zero-copy GPU (0 B/frame)`:`cpu-instanced`}</span><br/>
            Lease Epoch: <span id="cq-lease-epoch">${bn?.resetEpoch??0}</span> · Valid: true
          </div>
        </div>
      `}else if(t===`supergalactic-cosmic`){let t=Math.max(0,1/Math.max(.05,q.scaleFactorA)-1);c=`
        <div style="border-top:1px solid rgba(148,163,184,0.18);padding-top:8px;">
          <div style="font-weight:600;color:#a5b4fc;margin-bottom:4px;">Observable Universe Comoving Headroom</div>
          <div style="font-family:monospace;font-size:11px;color:#cbd5e1;">
            Horizon: ~93 Gly (8.8×10²⁶ m) · L=90<br/>
            a(t): <span id="cq-cosmo-a">${q.scaleFactorA.toFixed(3)}</span> · Redshift z: <span id="cq-cosmo-z">${t.toFixed(2)}</span><br/>
            H(a): ${e.cosmologyFrame.hubbleParameterPerS.toExponential(2)} s⁻¹<br/>
            Nodes: ${q.count.toLocaleString()} · ${yt.zeroCopy?`zero-copy GPU`:`cpu-instanced`}
          </div>
        </div>
      `}else c=`
        <div style="border-top:1px solid rgba(148,163,184,0.18);padding-top:8px;">
          <div style="font-weight:600;color:#7dd3fc;margin-bottom:4px;">Planetary Orbital Chart (L=33)</div>
          <div style="font-family:monospace;font-size:11px;color:#cbd5e1;">
            G-type star + 4 worlds (Ocean H₂O/Fe world at 1 AU)<br/>
            Coupled via GPU cross-chart multipole to L=70 &amp; L=90
          </div>
        </div>
      `;let l=typeof Le?.handle?.getPeers==`function`?Le.handle.getPeers().length:W.remotePeers;W.remotePeers=l,W.quorumReady=W.connected&&l>=2;let u=`
      <div style="border-top:1px solid rgba(148,163,184,0.18);padding-top:8px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:5px;">
          <span style="font-weight:600;color:#c4b5fd;font-size:11px;">PeerCompute Mesh</span>
          <span id="cq-peer-badge" style="font-family:monospace;font-size:10px;color:${W.connected?`#34d399`:`#94a3b8`};">${W.connected?`${W.role} · peers=${l}`:`local-only`}</span>
        </div>
        <div style="display:flex;gap:4px;margin-bottom:4px;">
          <input id="cq-peer-url" type="text" placeholder="ws://127.0.0.1:8787" value="${z}" style="flex:1;min-width:0;padding:3px 6px;border-radius:5px;background:#0b1724;color:#e2f1ec;border:1px solid rgba(167,139,250,0.3);font-size:10px;font-family:monospace;" />
          <select id="cq-peer-role" style="width:74px;padding:3px;border-radius:5px;background:#0b1724;color:#e2f1ec;border:1px solid rgba(167,139,250,0.3);font-size:10px;">
            <option value="requester" ${B===`requester`?`selected`:``}>Req</option>
            <option value="responder" ${B===`responder`?`selected`:``}>Resp</option>
            <option value="observer" ${B===`observer`?`selected`:``}>Obs</option>
          </select>
          <button id="cq-peer-connect" type="button" style="padding:3px 7px;border-radius:5px;border:1px solid rgba(167,139,250,0.45);background:rgba(76,29,149,0.35);color:#ddd6fe;font-size:10px;cursor:pointer;">${W.connected?`Off`:`Join`}</button>
        </div>
      </div>
    `;Q.innerHTML=`
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <span style="font-weight:700;letter-spacing:0.04em;font-size:11px;text-transform:uppercase;color:#94a3b8;">Schroeder Scale Atlas</span>
        <span style="padding:2px 6px;border-radius:4px;background:rgba(52,211,153,0.15);color:#6ee7b7;font-family:monospace;font-size:10px;">${n.totalSpanOrdersOfMagnitude.toFixed(1)} OOM</span>
      </div>
      <div style="font-family:monospace;font-size:11px;color:#94a3b8;line-height:1.5;">
        Chart: <span style="color:#e2f1ec;">#${e.primaryChartId} (L=${e.primaryRegime.globalBaseLevel})</span> · Active: ${n.activeChartCount}<br/>
        Module: <span style="color:#7dd3fc;">${e.primaryMethodKey}</span><br/>
        Device: <span style="color:#e2f1ec;">${Me.slice(0,24)} (${Pe})</span><br/>
        Multipole: ${s}<br/>
        Validation: <span style="color:#fde68a;">scientificValidation=false</span>
      </div>
      ${c}
      ${u}
    `;let d=async e=>{de=e,nn(),await Ht(),$(Y.evaluateContinuousZoomCamera(A))};Q.querySelector(`#cq-elem-sel`)?.addEventListener(`change`,e=>{d(Number(e.target.value))}),Q.querySelector(`#cq-cont-elem-sel`)?.addEventListener(`change`,e=>{d(Number(e.target.value))}),Q.querySelector(`#cq-func-sel`)?.addEventListener(`change`,async e=>{j=e.target.value,nn(),await Ht(),$(Y.evaluateContinuousZoomCamera(A))});for(let e of Q.querySelectorAll(`[data-orbital-mode]`))e.addEventListener(`click`,()=>{M=e.dataset.orbitalMode,nn(),$(Y.evaluateContinuousZoomCamera(A))});Q.querySelector(`#cq-mol-sel`)?.addEventListener(`change`,async e=>{I=!1,N=e.target.value,await Qt(),$(Y.evaluateContinuousZoomCamera(A))}),Q.querySelector(`#cq-basis-sel`)?.addEventListener(`change`,async e=>{P=e.target.value,await Qt(),$(Y.evaluateContinuousZoomCamera(A))});for(let e of Q.querySelectorAll(`[data-mol-view]`))e.addEventListener(`click`,async()=>{F=e.dataset.molView,await Qt(),$(Y.evaluateContinuousZoomCamera(A))});Q.querySelector(`#cq-neb-toggle`)?.addEventListener(`click`,async()=>{I=!I,await Qt(),$(Y.evaluateContinuousZoomCamera(A))}),Q.querySelector(`#cq-neb-slider`)?.addEventListener(`input`,async e=>{L=Number(e.target.value),await Qt(),$(Y.evaluateContinuousZoomCamera(A))}),Q.querySelector(`#cq-peer-connect`)?.addEventListener(`click`,async()=>{if(W.connected)await Re();else{let e=Q.querySelector(`#cq-peer-url`)?.value||``,t=Q.querySelector(`#cq-peer-role`)?.value||`requester`;await ze({relayUrl:e,roomId:je,role:t})}$(Y.evaluateContinuousZoomCamera(A))});for(let e of Q.querySelectorAll(`[data-galaxy-preset]`))e.addEventListener(`click`,async()=>{await Dt({tierId:Ne,preset:e.dataset.galaxyPreset}),$(Y.evaluateContinuousZoomCamera(A))});for(let e of Q.querySelectorAll(`[data-galaxy-tier]`))e.addEventListener(`click`,async()=>{await Dt({tierId:e.dataset.galaxyTier,preset:R}),$(Y.evaluateContinuousZoomCamera(A))})}let xn=!1;async function Sn(e){if(!xn){xn=!0;try{let t=e.primaryRegime.id,n=e.secondaryRegime?.id;if((t===`continuum-sph-solids`||n===`continuum-sph-solids`)&&X&&Z){let e=O({taskId:`cq-cont-${X.stepIndex}`,serviceId:S.ulgRuntime,taskKind:v.simulationStep,method:{model:`continuum-micro-sph`,version:1},input:{stepIndex:X.stepIndex,parameters:{dt:.015,gravity:4.8,readback:!Z.zeroCopy}}}),t=await Be.dispatchSimulationStepCapsule(e,{device:V});bn=t.leaseSummary,Z.zeroCopy?Z.bindLeaseHandle(t.leaseHandle):Z.syncFromCpuBodies(X.getBodies()),t.leaseHandle?.release?.()}if(t===`galactic-nbody`||n===`galactic-nbody`){let e=O({taskId:`cq-gal-${G.stepIndex}`,serviceId:S.ulgRuntime,taskKind:v.simulationStep,method:{model:`nbody-gravity`,version:1},input:{stepIndex:G.stepIndex,parameters:{dt:.011,gravity:1,softening:.24,readback:!K.zeroCopy}}}),t=await Be.dispatchSimulationStepCapsule(e,{device:V});bn=t.leaseSummary,K.zeroCopy?K.bindLeaseHandle(t.leaseHandle):K.syncFromCpuBodies(G.getBodies()),t.leaseHandle?.release?.()}if(t===`supergalactic-cosmic`||n===`supergalactic-cosmic`){let e=O({taskId:`cq-cosmo-${q.stepIndex}`,serviceId:S.ulgRuntime,taskKind:v.simulationStep,method:{model:`cosmology-comoving-nbody`,version:1},input:{stepIndex:q.stepIndex,parameters:{dt:.016,gravity:.08,softening:.85,hubbleRate:.14,readback:!yt.zeroCopy}}}),t=await Be.dispatchSimulationStepCapsule(e,{device:V});bn=t.leaseSummary,yt.zeroCopy?yt.bindLeaseHandle(t.leaseHandle):(yt.syncFromCpuBodies(q.getBodies()),wt(q.getBodies())),t.leaseHandle?.release?.()}}finally{xn=!1}}}let Cn=0,wn=0,Tn=!1;function En(){let e=Y.evaluateContinuousZoomCamera(A);for(let t of we){let n=$e[t.id],r=ft[t.id]-A,i=t.id===e.primaryRegime.id,a=t.id===e.secondaryRegime?.id,o=i||a&&Math.abs(r)<1.55;if(n.visible=o,o){let e=Math.max(-1.6,Math.min(1.6,r));n.scale.setScalar(10**(e*.58))}}He.position.set(Ge*Math.cos(We)*Math.sin(Ue),Ge*Math.sin(We),Ge*Math.cos(We)*Math.cos(Ue)),He.lookAt(0,0,0),ln.textContent=e.primaryRegime.label,un.textContent=`${mt(e.viewSpanM)} · 10^${A.toFixed(1)} m · Chart #${e.primaryChartId} (L=${e.primaryRegime.globalBaseLevel})`,pn.value=A.toFixed(2);for(let[t,n]of sn.entries()){let r=t===e.primaryRegime.id;n.style.borderColor=r?`#34d399`:`rgba(148,163,184,0.25)`,n.style.background=r?`rgba(52,211,153,0.2)`:`rgba(12,24,36,0.75)`,n.style.color=r?`#ecfdf5`:`#cbd5e1`}if(yn!==e.primaryRegime.id)yn=e.primaryRegime.id,$(e);else{let e=Q.querySelector(`#cq-gal-step`);e&&(e.textContent=String(G.stepIndex));let t=Q.querySelector(`#cq-lease-epoch`);t&&bn&&(t.textContent=String(bn.resetEpoch));let n=Q.querySelector(`#cq-cosmo-a`);n&&(n.textContent=q.scaleFactorA.toFixed(3));let r=Q.querySelector(`#cq-cosmo-z`);r&&(r.textContent=Math.max(0,1/Math.max(.05,q.scaleFactorA)-1).toFixed(2))}return e}function Dn(){if(Tn)return;if(wn=requestAnimationFrame(Dn),ke&&(k+=Ae*.055,k<=-11&&(k=-11,Ae=1),k>=26.8&&(k=26.8,Ae=-1)),A+=(k-A)*.14,Math.abs(k-A)<1e-4&&(A=k),pe){Cn+=.016;for(let e of Nt){let t=e.phase+Cn*e.omega;e.mesh.position.set(Math.cos(t)*e.a,Math.sin(t)*e.a*Math.sin(e.tilt),Math.sin(t)*e.a)}if(Lt)if(Bt===`liquid`){let e=1+.045*Math.sin(Cn*3.1);Lt.scale.set(e,1/Math.sqrt(e),2-e),Lt.rotation.y+=.005}else Lt.rotation.y+=.008;if(zt){let e=zt.userData.seeds;for(let t=0;t<e.length;t+=1){let n=e[t],r=-.9+(n.y+.9+Cn*n.speed)%3.4;et.position.set(n.x+Math.sin(Cn*1.4+n.phase)*.22,r,n.z+Math.cos(Cn*1.2+n.phase)*.22),et.scale.setScalar(n.scale),et.updateMatrix(),zt.setMatrixAt(t,et.matrix)}zt.instanceMatrix.needsUpdate=!0}Rt&&(Rt.rotation.y-=.003),Ut.rotation.y+=.004,$t.rotation.y+=.005}let e=En();pe&&Sn(e),H.render(J,He)}function On(){He.aspect=window.innerWidth/window.innerHeight,He.updateProjectionMatrix(),H.setSize(window.innerWidth,window.innerHeight)}window.addEventListener(`resize`,On),$(En()),wn=requestAnimationFrame(Dn);let kn={getState(){let e=Y.evaluateContinuousZoomCamera(A),t=K?.getStats()||null;return{ready:!0,log10ViewSpanM:A,viewSpanM:e.viewSpanM,primaryRegimeId:e.primaryRegime.id,primaryChartId:e.primaryChartId,primaryMethodKey:e.primaryMethodKey,totalSpanOom:Y.summary().totalSpanOrdersOfMagnitude,gpuBackend:V?`webgpu`:`cpu-fallback`,rendererBackend:Pe,gpuAdapterName:Me,galacticSteps:G.stepIndex,galacticBodyCount:G.count,galacticGravityMode:G.gravityMode,galacticTierId:Ne,zeroCopyPresenter:!!t?.zeroCopy,zeroCopyBoundFrames:t?.zeroCopyBoundFrames??0,readbackBytesPerFrame:t?.readbackBytesPerFrame??null,cosmicWebSteps:q.stepIndex,cosmicScaleFactorA:q.scaleFactorA,atomicElementZ:de,atomicFunctional:j,orbitalModeId:M,orbitalRaymarchMode:tn?.mode??null,orbitalProvenance:tn?.provenance??null,continuumElementSymbol:U?.properties?.symbol??null,continuumElementPhase:U?.properties?.standardPhaseAt298K??null,continuumElementTmK:U?.properties?.meltingPointK??null,continuumMicroSphSteps:X?.stepIndex??0,continuumBodyCount:X?.count??0,continuumZeroCopy:!!Z?.zeroCopy,materialResolverBackend:U?.derivedBackend??U?.resolverStatus??null,nebModeActive:I,nebReactionXi:L,nebBarrierEv:qt?qt.forwardBarrierHa*ct:null,polytopeStatus:Jt,peerMeshState:(()=>{let e=Le?.handle?.getStatus?.();return{...W,connected:e?!!e.connected:W.connected,remotePeers:e?e.remotePeerCount:W.remotePeers,remotePeerIds:e?[...e.remotePeerIds||[]]:W.remotePeerIds||[],quorumReady:e?!!e.quorumReady:W.quorumReady,witnessedMessages:e?.witnessedMessages??W.witnessedMessages??0,lastWitnessedType:e?.lastWitnessedType??W.lastWitnessedType??null}})(),crossChartMultipoleVerified:!!Ot?.verified,crossChartMultipoleMomentumRelError:Ot?.momentumRelError??null,molecularFormula:N,molecularBasis:P,molecularBackend:Kt,registeredModules:Be.listModules().map(e=>e.methodKey),lastLeaseSummary:bn}},setLog10Span(e){ke=!1,mn(),A=Math.max(-11.3,Math.min(27.2,Number(e)||0)),k=A;let t=En();return $(t),H.render(J,He),t},async selectElement(e,t=j){de=e,j=t,nn(),await Ht(),$(Y.evaluateContinuousZoomCamera(A))},selectOrbitalMode(e){Ee.some(t=>t.id===e)&&(M=e,nn(),$(Y.evaluateContinuousZoomCamera(A)),H.render(J,He))},async setNebMode(e,t=L){I=!!e,L=Math.max(0,Math.min(1,Number(t)||0)),await Qt(),$(Y.evaluateContinuousZoomCamera(A)),H.render(J,He)},connectPeerMesh:ze,async dispatchPeerDerivation(e=de){let t=Le?.handle?.getActiveRequester?.();if(!t||typeof t.submitWithProvenance!=`function`){let e=Error(`Peer mesh 2-of-2 quorum requester is not ready (requires >= 2 live remote responders)`);throw e.code=`ERR_CLIENT_PEER_QUORUM_UNAVAILABLE`,e}let n=`cq-quorum-${Date.now()}-${W.dispatches+1}`,r=await t.submitWithProvenance(n,{service:`cosmic-quantum-material`,kind:`material.resolve-element`,payload:{atomicNumberZ:e,functional:j}});return W.dispatches+=1,W.lastResult=r,r},async selectMolecule(e,t=P,n=F){I=!1,N=e,P=t,F=n,await Qt(),$(Y.evaluateContinuousZoomCamera(A))},async selectGalaxyPreset(e,t=Ne){await Dt({tierId:t,preset:e}),$(Y.evaluateContinuousZoomCamera(A))},async stepOnce(){await Sn(Y.evaluateContinuousZoomCamera(A)),H.render(J,He)},dispose(){Tn=!0,cancelAnimationFrame(wn),window.removeEventListener(`resize`,On),Re(),tn?.dispose?.(),Z?.dispose?.(),X?.dispose?.(),K?.dispose(),yt?.dispose(),G?.dispose(),q?.dispose(),H.dispose()}};return globalThis.__ulgCosmicQuantumDemo=kn,kn}yt(document.getElementById(`cosmic-quantum-app`)||document.body);