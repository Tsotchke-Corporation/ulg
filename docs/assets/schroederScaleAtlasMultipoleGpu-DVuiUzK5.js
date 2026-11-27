import{Ap as e,Dp as t,vp as n}from"./batchedSymmetricEigensolverGpu-CVsmzRbl.js";import{computeBufferBinding as r,createCachedExplicitBindGroup as i,createCachedExplicitComputePipeline as a}from"../runtime/webgpuComputeLayout.js";var o=`peercompute.ulg.schroeder-scale-atlas-multipole-gpu.v1`,s=1397575729,c=16*Uint32Array.BYTES_PER_ELEMENT,l=66743e-15,u=5.670374419e-8,d=128,f=`
${e}

struct MultipoleParticleInput {
  chart_id: u32,
  flags: u32,
  mass_kg: f32,
  temperature_k: f32,
  pos_local: vec3<f32>,
  effective_area_m2: f32, // emissivity * surface_area_m2
};

struct ChartMultipoleMoment {
  mass_kg: f32,
  bounding_radius_local: f32,
  luminosity_w: f32,
  effective_area_m2: f32,
  com_local: vec3<f32>,
  particle_count: u32,
  // Symmetric traceless quadrupole tensor in chart-local units (kg * local^2):
  // q_diag = (Q_xx, Q_yy, Q_zz), q_off = (Q_xy, Q_xz, Q_yz)
  q_diag: vec3<f32>,
  pad0: f32,
  q_off: vec3<f32>,
  pad1: f32,
  // Anchor center-of-mass expressed in root-chart dyadic units via chunked shifts:
  root_com_hi: vec3<f32>,
  root_level: i32,
  root_com_lo: vec3<f32>,
  pad2: f32,
};

struct ChartCouplingOutput {
  net_force_n: vec3<f32>,
  net_radiative_power_w: f32,
  gravity_potential_j: f32,
  coupled_pair_count: u32,
  far_field_pair_count: u32,
  near_field_skipped_count: u32,
};

struct MultipoleParams {
  particle_count: u32,
  chart_count: u32,
  reference_spacing_m: f32,
  theta_max: f32,
  gravity_g: f32,
  stefan_boltzmann: f32,
  softening_fraction: f32,
  pad0: u32,
};

@group(0) @binding(0) var<storage, read> charts: array<SchroederScaleChartRecord>;
@group(0) @binding(1) var<storage, read> particles: array<MultipoleParticleInput>;
@group(0) @binding(2) var<storage, read_write> moments: array<ChartMultipoleMoment>;
@group(0) @binding(3) var<storage, read_write> outputs: array<ChartCouplingOutput>;
@group(0) @binding(4) var<storage, read_write> receipt: array<atomic<u32>>;
@group(0) @binding(5) var<uniform> params: MultipoleParams;

const NO_PARENT: u32 = ${n}u;
const RECEIPT_MAGIC: u32 = ${s}u;
const MAX_HOPS: u32 = 32u;
const FOUR_PI: f32 = 12.566370614359172;

fn mp_finite(v: f32) -> bool {
  return (bitcast<u32>(v) & 0x7f800000u) != 0x7f800000u;
}

fn mp_finite3(v: vec3<f32>) -> bool {
  return mp_finite(v.x) && mp_finite(v.y) && mp_finite(v.z);
}

fn mp_dyadic_scale_f32(v: f32, exp_shift: i32) -> f32 {
  return ss_atlas_dyadic_scale_vec3(vec3<f32>(v, 0.0, 0.0), exp_shift).x;
}

fn mp_find_chart(chart_id: u32) -> u32 {
  if (chart_id < params.chart_count && charts[chart_id].chart_id == chart_id) {
    return chart_id;
  }
  for (var i = 0u; i < params.chart_count; i = i + 1u) {
    if (charts[i].chart_id == chart_id) {
      return i;
    }
  }
  return NO_PARENT;
}

var<workgroup> wg_mp_m: array<f32, 64>;
var<workgroup> wg_mp_mr: array<vec3<f32>, 64>;
var<workgroup> wg_mp_lum: array<f32, 64>;
var<workgroup> wg_mp_area: array<f32, 64>;
var<workgroup> wg_mp_cnt: array<u32, 64>;
var<workgroup> wg_mp_com: vec3<f32>;
var<workgroup> wg_mp_mass_tot: f32;
var<workgroup> wg_mp_maxr: array<f32, 64>;
var<workgroup> wg_mp_qd: array<vec3<f32>, 64>;
var<workgroup> wg_mp_qo: array<vec3<f32>, 64>;

@compute @workgroup_size(64)
fn init_multipole_receipt(@builtin(local_invocation_id) lid: vec3<u32>) {
  let i = lid.x;
  if (i < 16u) {
    var val = 0u;
    if (i == 0u) { val = RECEIPT_MAGIC; }
    else if (i == 1u) { val = 1u; }
    atomicStore(&receipt[i], val);
  }
}

// Parallel 64-thread workgroup per active chart deterministically reduces all
// resident particles belonging to that chart into exact conserved monopole,
// COM, quadrupole, and radiative luminosity moments, then lifts COM to root-chart
// double-float units via canonical SchroederScaleAtlas dyadic rebasing.
@compute @workgroup_size(64)
fn reduce_chart_multipoles(
  @builtin(workgroup_id) wid: vec3<u32>,
  @builtin(local_invocation_id) lid: vec3<u32>
) {
  let c_idx = wid.x;
  if (c_idx >= params.chart_count) { return; }
  let tid = lid.x;
  let chart = charts[c_idx];
  let cid = chart.chart_id;

  var mass_sum = 0.0;
  var mr_sum = vec3<f32>(0.0);
  var lum_sum = 0.0;
  var area_sum = 0.0;
  var count = 0u;

  var i = tid;
  loop {
    if (i >= params.particle_count) { break; }
    let p = particles[i];
    if (p.chart_id == cid && p.mass_kg > 0.0) {
      mass_sum = mass_sum + p.mass_kg;
      mr_sum = mr_sum + p.mass_kg * p.pos_local;
      let t = max(p.temperature_k, 0.0);
      let t2 = t * t;
      let a_eff = max(p.effective_area_m2, 0.0);
      lum_sum = lum_sum + a_eff * params.stefan_boltzmann * t2 * t2;
      area_sum = area_sum + a_eff;
      count = count + 1u;
    }
    i = i + 64u;
  }

  wg_mp_m[tid] = mass_sum;
  wg_mp_mr[tid] = mr_sum;
  wg_mp_lum[tid] = lum_sum;
  wg_mp_area[tid] = area_sum;
  wg_mp_cnt[tid] = count;
  workgroupBarrier();

  var stride = 32u;
  loop {
    if (stride == 0u) { break; }
    if (tid < stride) {
      wg_mp_m[tid] = wg_mp_m[tid] + wg_mp_m[tid + stride];
      wg_mp_mr[tid] = wg_mp_mr[tid] + wg_mp_mr[tid + stride];
      wg_mp_lum[tid] = wg_mp_lum[tid] + wg_mp_lum[tid + stride];
      wg_mp_area[tid] = wg_mp_area[tid] + wg_mp_area[tid + stride];
      wg_mp_cnt[tid] = wg_mp_cnt[tid] + wg_mp_cnt[tid + stride];
    }
    workgroupBarrier();
    stride = stride >> 1u;
  }

  if (tid == 0u) {
    let m_tot = wg_mp_m[0u];
    wg_mp_mass_tot = m_tot;
    wg_mp_com = select(vec3<f32>(0.0), wg_mp_mr[0u] / max(m_tot, 1e-30), m_tot > 0.0);
  }
  workgroupBarrier();

  let com = wg_mp_com;
  let m_tot = wg_mp_mass_tot;
  var max_r = 0.0;
  var q_diag = vec3<f32>(0.0);
  var q_off = vec3<f32>(0.0);
  if (m_tot > 0.0) {
    var j = tid;
    loop {
      if (j >= params.particle_count) { break; }
      let p = particles[j];
      if (p.chart_id == cid && p.mass_kg > 0.0) {
        let d = p.pos_local - com;
        let d2 = dot(d, d);
        max_r = max(max_r, sqrt(d2));
        q_diag.x = q_diag.x + p.mass_kg * (3.0 * d.x * d.x - d2);
        q_diag.y = q_diag.y + p.mass_kg * (3.0 * d.y * d.y - d2);
        q_diag.z = q_diag.z + p.mass_kg * (3.0 * d.z * d.z - d2);
        q_off.x = q_off.x + p.mass_kg * (3.0 * d.x * d.y);
        q_off.y = q_off.y + p.mass_kg * (3.0 * d.x * d.z);
        q_off.z = q_off.z + p.mass_kg * (3.0 * d.y * d.z);
      }
      j = j + 64u;
    }
  }

  wg_mp_maxr[tid] = max_r;
  wg_mp_qd[tid] = q_diag;
  wg_mp_qo[tid] = q_off;
  workgroupBarrier();

  stride = 32u;
  loop {
    if (stride == 0u) { break; }
    if (tid < stride) {
      wg_mp_maxr[tid] = max(wg_mp_maxr[tid], wg_mp_maxr[tid + stride]);
      wg_mp_qd[tid] = wg_mp_qd[tid] + wg_mp_qd[tid + stride];
      wg_mp_qo[tid] = wg_mp_qo[tid] + wg_mp_qo[tid + stride];
    }
    workgroupBarrier();
    stride = stride >> 1u;
  }

  if (tid == 0u) {
    // Lift COM to root chart in double-float units via exact dyadic scaling.
    var cur_hi = com;
    var cur_lo = vec3<f32>(0.0);
    var cur_idx = c_idx;
    for (var step = 0u; step < MAX_HOPS; step = step + 1u) {
      let cur_c = charts[cur_idx];
      if (cur_c.parent_chart_id == NO_PARENT || (cur_c.flags & 1u) == 0u) { break; }
      let parent_idx = mp_find_chart(cur_c.parent_chart_id);
      if (parent_idx == NO_PARENT) {
        atomicOr(&receipt[2], 1u);
        break;
      }
      let rebased = ss_atlas_rebase_child_to_parent(cur_hi + cur_lo, cur_c);
      cur_hi = rebased[0];
      cur_lo = rebased[1];
      cur_idx = parent_idx;
    }

    var m: ChartMultipoleMoment;
    m.mass_kg = m_tot;
    m.bounding_radius_local = wg_mp_maxr[0u];
    m.luminosity_w = wg_mp_lum[0u];
    m.effective_area_m2 = wg_mp_area[0u];
    m.com_local = com;
    m.particle_count = wg_mp_cnt[0u];
    m.q_diag = wg_mp_qd[0u];
    m.pad0 = 0.0;
    m.q_off = wg_mp_qo[0u];
    m.pad1 = 0.0;
    m.root_com_hi = cur_hi;
    m.root_level = charts[cur_idx].global_base_level;
    m.root_com_lo = cur_lo;
    m.pad2 = 0.0;
    moments[c_idx] = m;
    atomicAdd(&receipt[3], wg_mp_cnt[0u]);
  }
}

// Compute the exact pairwise displacement (target_com - source_com) in meters,
// using double-float difference in the shared root chart scaled by chunked
// dyadic 2^(root_level) to remain well-conditioned across 40+ OOM.
fn mp_chart_displacement_m(a: ChartMultipoleMoment, b: ChartMultipoleMoment) -> vec3<f32> {
  // Exact double-float difference (b - a) in root units.
  let d_hi = b.root_com_hi - a.root_com_hi;
  let d_lo = b.root_com_lo - a.root_com_lo;
  let d_root = d_hi + d_lo;
  return ss_atlas_dyadic_scale_vec3(d_root, a.root_level) * params.reference_spacing_m;
}

// Evaluate symmetric pairwise gravitational force (monopole + quadrupole) on chart a
// exerted by chart b, and net radiative power absorbed by chart a from chart b.
// Strict antisymmetry: pair_force(a, b) == -pair_force(b, a) and
// pair_rad_power(a, b) == -pair_rad_power(b, a) when evaluated in canonical (lo, hi) order!
fn mp_quadrupole_force_on_unit_mass(q_diag: vec3<f32>, q_off: vec3<f32>, r_vec: vec3<f32>, inv_r: f32) -> vec3<f32> {
  let n = r_vec * inv_r;
  // Q * n
  let qn = vec3<f32>(
    q_diag.x * n.x + q_off.x * n.y + q_off.y * n.z,
    q_off.x * n.x + q_diag.y * n.y + q_off.z * n.z,
    q_off.y * n.x + q_off.z * n.y + q_diag.z * n.z
  );
  let n_q_n = dot(n, qn);
  let inv_r4 = inv_r * inv_r * inv_r * inv_r;
  // Gradient of quadrupole potential Phi_Q = -G/(2 r^3) * (n^T Q n):
  // F_Q / m = G / r^4 * ( Q*n - 2.5 * (n^T Q n) * n )
  return (params.gravity_g * inv_r4) * (qn - 2.5 * n_q_n * n);
}

@compute @workgroup_size(64)
fn evaluate_cross_chart_coupling(@builtin(global_invocation_id) gid: vec3<u32>) {
  let a_idx = gid.x;
  if (a_idx >= params.chart_count) { return; }
  let ma = moments[a_idx];
  let ca = charts[a_idx];

  var net_f = vec3<f32>(0.0);
  var net_rad = 0.0;
  var grav_pot = 0.0;
  var coupled = 0u;
  var far_pairs = 0u;
  var near_skipped = 0u;

  if (ma.mass_kg > 0.0 || ma.effective_area_m2 > 0.0) {
    let ra_m = mp_dyadic_scale_f32(ma.bounding_radius_local, ca.global_base_level) * params.reference_spacing_m;
    let qa_scale = mp_dyadic_scale_f32(1.0, ca.global_base_level) * params.reference_spacing_m;
    let qa_scale2 = qa_scale * qa_scale;

    for (var b_idx = 0u; b_idx < params.chart_count; b_idx = b_idx + 1u) {
      if (b_idx == a_idx) { continue; }
      let mb = moments[b_idx];
      if (!(mb.mass_kg > 0.0) && !(mb.effective_area_m2 > 0.0)) { continue; }
      let cb = charts[b_idx];
      let rb_m = mp_dyadic_scale_f32(mb.bounding_radius_local, cb.global_base_level) * params.reference_spacing_m;

      // Evaluate geometry in canonical ordered pair (lo, hi) so floating-point
      // rounding is bit-exact antisymmetric: F(a<-b) == -F(b<-a), P(a<-b) == -P(b<-a).
      let lo = min(a_idx, b_idx);
      let hi = max(a_idx, b_idx);
      let sign = select(-1.0, 1.0, a_idx == lo);
      let m_lo = moments[lo];
      let m_hi = moments[hi];
      let c_lo = charts[lo];
      let c_hi = charts[hi];
      let r_lo_m = mp_dyadic_scale_f32(m_lo.bounding_radius_local, c_lo.global_base_level) * params.reference_spacing_m;
      let r_hi_m = mp_dyadic_scale_f32(m_hi.bounding_radius_local, c_hi.global_base_level) * params.reference_spacing_m;

      // Displacement vector from lo -> hi in physical meters.
      let r_vec = mp_chart_displacement_m(m_lo, m_hi);
      let r_len = length(r_vec);
      let max_r_pair = max(r_lo_m, r_hi_m);
      let eps = max(1e-30, params.softening_fraction * max(max_r_pair, 1e-18));
      if (!(r_len > eps)) {
        near_skipped = near_skipped + 1u;
        continue;
      }
      // Barnes-Hut opening angle check: theta = (r_lo + r_hi) / r_len <= theta_max.
      let opening = (r_lo_m + r_hi_m) / r_len;
      let is_far_field = opening <= params.theta_max;
      if (is_far_field) {
        far_pairs = far_pairs + 1u;
      }

      // Compute pairwise gravity using normalized unit vector + exponent-safe scaling:
      // F_mono_on_lo = +G * m_lo * m_hi / r^2 * (r_vec / r)
      let inv_r = 1.0 / r_len;
      let n_hat = r_vec * inv_r;
      let g_mag = (params.gravity_g * m_lo.mass_kg * inv_r) * (m_hi.mass_kg * inv_r);
      var f_on_lo = g_mag * n_hat;

      // Symmetrized monopole-quadrupole mutual attraction (exact Newton 3rd law!):
      // F_on_lo += m_lo * F_Q(Q_hi, +r_vec) - m_hi * F_Q(Q_lo, -r_vec)
      if (is_far_field && mp_finite(qa_scale2)) {
        let s_lo = mp_dyadic_scale_f32(1.0, c_lo.global_base_level) * params.reference_spacing_m;
        let s_hi = mp_dyadic_scale_f32(1.0, c_hi.global_base_level) * params.reference_spacing_m;
        let s_lo2 = s_lo * s_lo;
        let s_hi2 = s_hi * s_hi;
        if (mp_finite(s_lo2) && mp_finite(s_hi2)) {
          let fq_hi = mp_quadrupole_force_on_unit_mass(m_hi.q_diag * s_hi2, m_hi.q_off * s_hi2, r_vec, inv_r);
          let fq_lo = mp_quadrupole_force_on_unit_mass(m_lo.q_diag * s_lo2, m_lo.q_off * s_lo2, -r_vec, inv_r);
          if (mp_finite3(fq_hi) && mp_finite3(fq_lo)) {
            f_on_lo = f_on_lo + m_lo.mass_kg * fq_hi - m_hi.mass_kg * fq_lo;
          }
        }
      }

      // Exact symmetric far-field radiative view-factor exchange (Kirchhoff reciprocity):
      // View factor F_geom = min(1.0, A_lo * A_hi / (4*pi*r^2) / max(A_lo, A_hi))
      // P_lo_from_hi = view * (I_hi - I_lo) where I_c = L_c / A_c = sigma * T_eff^4.
      // Strict antisymmetry: P(lo<-hi) = -P(hi<-lo), zero net radiative creation!
      var p_on_lo = 0.0;
      if (m_lo.effective_area_m2 > 0.0 && m_hi.effective_area_m2 > 0.0) {
        let flux_lo = m_lo.luminosity_w / m_lo.effective_area_m2;
        let flux_hi = m_hi.luminosity_w / m_hi.effective_area_m2;
        let inv_4pi_r2 = (inv_r * inv_r) / FOUR_PI;
        let geom_conductance = min(
          min(m_lo.effective_area_m2, m_hi.effective_area_m2),
          (m_lo.effective_area_m2 * inv_4pi_r2) * m_hi.effective_area_m2
        );
        p_on_lo = geom_conductance * (flux_hi - flux_lo);
      }

      if (!mp_finite3(f_on_lo) || !mp_finite(p_on_lo)) {
        atomicOr(&receipt[2], 2u);
        continue;
      }

      net_f = net_f + sign * f_on_lo;
      net_rad = net_rad + sign * p_on_lo;
      grav_pot = grav_pot - 0.5 * (params.gravity_g * m_lo.mass_kg * inv_r) * m_hi.mass_kg;
      coupled = coupled + 1u;
    }
  }

  outputs[a_idx] = ChartCouplingOutput(
    net_f,
    net_rad,
    grav_pot,
    coupled,
    far_pairs,
    near_skipped
  );
  atomicAdd(&receipt[4], coupled);
  atomicAdd(&receipt[5], far_pairs);
}

@compute @workgroup_size(64)
fn seal_multipole_receipt(@builtin(local_invocation_id) lid: vec3<u32>) {
  let tid = lid.x;
  var total_f = vec3<f32>(0.0);
  var sum_f_mag = 0.0;
  var total_rad = 0.0;
  var sum_rad_mag = 0.0;
  var i = tid;
  loop {
    if (i >= params.chart_count) { break; }
    let o = outputs[i];
    if (!mp_finite3(o.net_force_n) || !mp_finite(o.net_radiative_power_w)) {
      atomicOr(&receipt[2], 4u);
    }
    total_f = total_f + o.net_force_n;
    sum_f_mag = sum_f_mag + length(o.net_force_n);
    total_rad = total_rad + o.net_radiative_power_w;
    sum_rad_mag = sum_rad_mag + abs(o.net_radiative_power_w);
    i = i + 64u;
  }
  wg_mp_mr[tid] = total_f;
  wg_mp_m[tid] = sum_f_mag;
  wg_mp_lum[tid] = total_rad;
  wg_mp_area[tid] = sum_rad_mag;
  workgroupBarrier();

  var stride = 32u;
  loop {
    if (stride == 0u) { break; }
    if (tid < stride) {
      wg_mp_mr[tid] = wg_mp_mr[tid] + wg_mp_mr[tid + stride];
      wg_mp_m[tid] = wg_mp_m[tid] + wg_mp_m[tid + stride];
      wg_mp_lum[tid] = wg_mp_lum[tid] + wg_mp_lum[tid + stride];
      wg_mp_area[tid] = wg_mp_area[tid] + wg_mp_area[tid + stride];
    }
    workgroupBarrier();
    stride = stride >> 1u;
  }

  if (tid == 0u) {
    let tf = wg_mp_mr[0u];
    let sf = wg_mp_m[0u];
    let tr = wg_mp_lum[0u];
    let sr = wg_mp_area[0u];
    let mom_rel_err = select(0.0, length(tf) / sf, sf > 0.0);
    let rad_rel_err = select(0.0, abs(tr) / sr, sr > 0.0);
    atomicStore(&receipt[6], bitcast<u32>(mom_rel_err));
    atomicStore(&receipt[7], bitcast<u32>(rad_rel_err));
    if (!(mom_rel_err <= 1e-5)) {
      atomicOr(&receipt[2], 8u);
    }
    if (!(rad_rel_err <= 1e-5)) {
      atomicOr(&receipt[2], 16u);
    }
    let err = atomicLoad(&receipt[2]);
    atomicStore(&receipt[1], select(5u, 3u, err == 0u));
  }
}
`;function p(e=[]){let t=new Uint32Array(Math.max(1,e.length)*8),n=new DataView(t.buffer);for(let t=0;t<e.length;t+=1){let r=e[t],i=t*32,a=r.posLocal??[0,0,0];n.setUint32(i+0,r.chartId>>>0,!0),n.setUint32(i+4,r.flags>>>0,!0),n.setFloat32(i+8,Number(r.massKg??0),!0),n.setFloat32(i+12,Number(r.temperatureK??0),!0),n.setFloat32(i+16,Number(a[0]??0),!0),n.setFloat32(i+20,Number(a[1]??0),!0),n.setFloat32(i+24,Number(a[2]??0),!0),n.setFloat32(i+28,Number(r.effectiveAreaM2??0),!0)}return t}async function m(e,{atlas:n,particles:s,thetaMax:d=.5,gravityG:m=l,stefanBoltzmann:h=u,softeningFraction:g=.001}={}){let _=t(n),v=p(s),y=n.chartCount,b=Math.max(96,y*96),x=Math.max(32,y*32),S=[r(0,`read-only-storage`),r(1,`read-only-storage`),r(2,`storage`),r(3,`storage`),r(4,`storage`),r(5,`uniform`)],C=a(e,{cacheKey:`ulg-scale-atlas-mp-init.v2-wg64`,label:`ulg-scale-atlas-mp-init`,code:f,entryPoint:`init_multipole_receipt`,bindings:S}),w=a(e,{cacheKey:`ulg-scale-atlas-mp-reduce.v2-wg64`,label:`ulg-scale-atlas-mp-reduce`,code:f,entryPoint:`reduce_chart_multipoles`,bindings:S}),T=a(e,{cacheKey:`ulg-scale-atlas-mp-couple.v2-wg64`,label:`ulg-scale-atlas-mp-couple`,code:f,entryPoint:`evaluate_cross_chart_coupling`,bindings:S}),E=a(e,{cacheKey:`ulg-scale-atlas-mp-seal.v2-wg64`,label:`ulg-scale-atlas-mp-seal`,code:f,entryPoint:`seal_multipole_receipt`,bindings:S}),D=e.createBuffer({label:`ulg-scale-atlas-mp-charts`,size:_.byteLength,usage:136}),O=e.createBuffer({label:`ulg-scale-atlas-mp-particles`,size:v.byteLength,usage:136}),k=e.createBuffer({label:`ulg-scale-atlas-mp-moments`,size:b,usage:132}),A=e.createBuffer({label:`ulg-scale-atlas-mp-outputs`,size:x,usage:132}),j=e.createBuffer({label:`ulg-scale-atlas-mp-receipt`,size:c,usage:132}),M=e.createBuffer({label:`ulg-scale-atlas-mp-params`,size:32,usage:72}),N=e.createBuffer({label:`ulg-scale-atlas-mp-receipt-read`,size:c,usage:9}),P=e.createBuffer({label:`ulg-scale-atlas-mp-outputs-read`,size:x,usage:9});try{e.queue.writeBuffer(D,0,_),e.queue.writeBuffer(O,0,v);let t=new ArrayBuffer(32),r=new DataView(t);r.setUint32(0,s.length>>>0,!0),r.setUint32(4,y>>>0,!0),r.setFloat32(8,Number(n.referenceSpacingM??1),!0),r.setFloat32(12,Number(d),!0),r.setFloat32(16,Number(m),!0),r.setFloat32(20,Number(h),!0),r.setFloat32(24,Number(g),!0),r.setUint32(28,0,!0),e.queue.writeBuffer(M,0,t);let a=[{binding:0,resource:{buffer:D}},{binding:1,resource:{buffer:O}},{binding:2,resource:{buffer:k}},{binding:3,resource:{buffer:A}},{binding:4,resource:{buffer:j}},{binding:5,resource:{buffer:M}}],l=i(e,{layout:C.bindGroupLayout,entries:a}),u=i(e,{layout:w.bindGroupLayout,entries:a}),f=i(e,{layout:T.bindGroupLayout,entries:a}),p=i(e,{layout:E.bindGroupLayout,entries:a}),b=e.createCommandEncoder({label:`ulg-scale-atlas-multipole`}),S=b.beginComputePass({label:`ulg-scale-atlas-multipole-pass`});S.setPipeline(C.pipeline),S.setBindGroup(0,l),S.dispatchWorkgroups(1),S.setPipeline(w.pipeline),S.setBindGroup(0,u),S.dispatchWorkgroups(y),S.setPipeline(T.pipeline),S.setBindGroup(0,f),S.dispatchWorkgroups(Math.max(1,Math.ceil(y/64))),S.setPipeline(E.pipeline),S.setBindGroup(0,p),S.dispatchWorkgroups(1),S.end(),b.copyBufferToBuffer(j,0,N,0,c),b.copyBufferToBuffer(A,0,P,0,x),e.queue.submit([b.finish()]),await Promise.all([N.mapAsync(1),P.mapAsync(1)]);let F=N.getMappedRange().slice(0),I=P.getMappedRange().slice(0);N.unmap(),P.unmap();let L=new Uint32Array(F),R=new DataView(F),z=new DataView(I),B=[];for(let e=0;e<y;e+=1){let t=e*32;B.push(Object.freeze({chartId:n.charts[e].chartId,netForceN:Object.freeze([z.getFloat32(t+0,!0),z.getFloat32(t+4,!0),z.getFloat32(t+8,!0)]),netRadiativePowerW:z.getFloat32(t+12,!0),gravityPotentialJ:z.getFloat32(t+16,!0),coupledPairCount:z.getUint32(t+20,!0),farFieldPairCount:z.getUint32(t+24,!0),nearFieldSkippedCount:z.getUint32(t+28,!0)}))}return Object.freeze({schema:o,receipt:Object.freeze({magic:L[0],status:L[1],errorMask:L[2],reducedParticleCount:L[3],coupledPairDirectedCount:L[4],farFieldPairDirectedCount:L[5],momentumRelError:R.getFloat32(24,!0),radiativeRelError:R.getFloat32(28,!0),verified:L[0]===1397575729&&L[1]===3&&L[2]===0}),chartOutputs:Object.freeze(B)})}finally{D.destroy(),O.destroy(),k.destroy(),A.destroy(),j.destroy(),M.destroy(),N.destroy(),P.destroy()}}var h=`peercompute.ulg.schroeder-scale-atlas-resident-gravity.v1`,g=4096,_=64,v=4160,y=`
struct AtlasGravityParams {
  count: u32,
  stride_vec4: u32,
  use_adj_softening: u32,
  chart_level: i32,
  gravity_g: f32,
  softening2: f32,
  box_half: f32,
  theta2: f32,
  q_mass: f32,
  q_mom: f32,
  r_cell_factor: f32,
  pad0: f32,
};

@group(0) @binding(0) var<storage, read> src_raw: array<vec4<f32>>;
@group(0) @binding(1) var<storage, read_write> chart_accum: array<atomic<i32>>;
@group(0) @binding(2) var<storage, read_write> atlas_moments: array<vec4<f32>>;
@group(0) @binding(3) var<storage, read_write> acc_phi: array<vec4<f32>>;
@group(0) @binding(4) var<uniform> params: AtlasGravityParams;

const SS_L2_COUNT: u32 = ${g}u;
const SS_L1_COUNT: u32 = ${_}u;

var<workgroup> wg_ss_m: array<f32, 256>;
var<workgroup> wg_ss_p: array<vec3<f32>, 256>;
var<workgroup> wg_ss_v: array<vec3<f32>, 256>;

fn ss_clamp_chart16(v: f32, half_extent: f32) -> u32 {
  let u = clamp((v + half_extent) / max(2.0 * half_extent, 1e-6), 0.0, 0.9999);
  return min(15u, u32(u * 16.0));
}

fn ss_chart_idx16(cx: u32, cy: u32, cz: u32) -> u32 {
  return (cz * 256u) + (cy * 16u) + cx;
}

@compute @workgroup_size(64)
fn ss_atlas_grav_clear(@builtin(global_invocation_id) gid: vec3<u32>) {
  let i = gid.x;
  if (i < SS_L2_COUNT) {
    let base = i * 4u;
    atomicStore(&chart_accum[base + 0u], 0);
    atomicStore(&chart_accum[base + 1u], 0);
    atomicStore(&chart_accum[base + 2u], 0);
    atomicStore(&chart_accum[base + 3u], 0);
    atlas_moments[i] = vec4<f32>(0.0);
  }
  if (i < SS_L1_COUNT) {
    atlas_moments[SS_L2_COUNT + i] = vec4<f32>(0.0);
  }
}

@compute @workgroup_size(256)
fn ss_atlas_grav_com_reduce(@builtin(local_invocation_id) lid: vec3<u32>) {
  let tid = lid.x;
  let sv = params.stride_vec4;
  var m_sum = 0.0;
  var p_sum = vec3<f32>(0.0);
  var v_sum = vec3<f32>(0.0);
  var i = tid;
  loop {
    if (i >= params.count) { break; }
    let pm = src_raw[i * sv + 0u];
    let vel = src_raw[i * sv + 1u].xyz;
    if (pm.w > 0.0) {
      m_sum = m_sum + pm.w;
      p_sum = p_sum + pm.xyz * pm.w;
      v_sum = v_sum + vel * pm.w;
    }
    i = i + 256u;
  }
  wg_ss_m[tid] = m_sum;
  wg_ss_p[tid] = p_sum;
  wg_ss_v[tid] = v_sum;
  workgroupBarrier();

  var stride = 128u;
  loop {
    if (stride == 0u) { break; }
    if (tid < stride) {
      wg_ss_m[tid] = wg_ss_m[tid] + wg_ss_m[tid + stride];
      wg_ss_p[tid] = wg_ss_p[tid] + wg_ss_p[tid + stride];
      wg_ss_v[tid] = wg_ss_v[tid] + wg_ss_v[tid + stride];
    }
    workgroupBarrier();
    stride = stride >> 1u;
  }
  if (tid == 0u) {
    let m_tot = wg_ss_m[0u];
    if (m_tot > 1e-6) {
      let inv_m = 1.0 / m_tot;
      acc_phi[params.count] = vec4<f32>(wg_ss_p[0u] * inv_m, m_tot);
      acc_phi[params.count + 1u] = vec4<f32>(wg_ss_v[0u] * inv_m, 0.0);
    } else {
      acc_phi[params.count] = vec4<f32>(0.0);
      acc_phi[params.count + 1u] = vec4<f32>(0.0);
    }
  }
}

@compute @workgroup_size(64)
fn ss_atlas_grav_bin_charts(@builtin(global_invocation_id) gid: vec3<u32>) {
  let i = gid.x;
  if (i >= params.count) { return; }
  let pm = src_raw[i * params.stride_vec4 + 0u];
  if (!(pm.w > 0.0)) { return; }
  let com = acc_phi[params.count].xyz;
  let rel = pm.xyz - com;
  let cx = ss_clamp_chart16(rel.x, params.box_half);
  let cy = ss_clamp_chart16(rel.y, params.box_half);
  let cz = ss_clamp_chart16(rel.z, params.box_half);
  let base = ss_chart_idx16(cx, cy, cz) * 4u;
  atomicAdd(&chart_accum[base + 0u], i32(round(clamp(pm.w * params.q_mass, -1e8, 1e8))));
  atomicAdd(&chart_accum[base + 1u], i32(round(clamp(pm.w * rel.x * params.q_mom, -1e8, 1e8))));
  atomicAdd(&chart_accum[base + 2u], i32(round(clamp(pm.w * rel.y * params.q_mom, -1e8, 1e8))));
  atomicAdd(&chart_accum[base + 3u], i32(round(clamp(pm.w * rel.z * params.q_mom, -1e8, 1e8))));
}

@compute @workgroup_size(64)
fn ss_atlas_grav_finalize_charts(@builtin(global_invocation_id) gid: vec3<u32>) {
  let cell = gid.x;
  if (cell >= SS_L2_COUNT) { return; }
  let base = cell * 4u;
  let m = f32(atomicLoad(&chart_accum[base + 0u])) / params.q_mass;
  if (m > 1e-6) {
    let inv_m = 1.0 / m;
    let cx = (f32(atomicLoad(&chart_accum[base + 1u])) / params.q_mom) * inv_m;
    let cy = (f32(atomicLoad(&chart_accum[base + 2u])) / params.q_mom) * inv_m;
    let cz = (f32(atomicLoad(&chart_accum[base + 3u])) / params.q_mom) * inv_m;
    atlas_moments[cell] = vec4<f32>(cx, cy, cz, m);
  } else {
    atlas_moments[cell] = vec4<f32>(0.0);
  }
}

@compute @workgroup_size(64)
fn ss_atlas_grav_rollup_parents(@builtin(global_invocation_id) gid: vec3<u32>) {
  let p = gid.x;
  if (p >= SS_L1_COUNT) { return; }
  let px = p & 3u;
  let py = (p >> 2u) & 3u;
  let pz = (p >> 4u) & 3u;
  var m_sum = 0.0;
  var mom = vec3<f32>(0.0);
  for (var dz = 0u; dz < 4u; dz = dz + 1u) {
    for (var dy = 0u; dy < 4u; dy = dy + 1u) {
      for (var dx = 0u; dx < 4u; dx = dx + 1u) {
        let leaf = atlas_moments[ss_chart_idx16(px * 4u + dx, py * 4u + dy, pz * 4u + dz)];
        if (leaf.w > 0.0) {
          m_sum = m_sum + leaf.w;
          mom = mom + leaf.xyz * leaf.w;
        }
      }
    }
  }
  if (m_sum > 1e-6) {
    atlas_moments[SS_L2_COUNT + p] = vec4<f32>(mom / m_sum, m_sum);
  } else {
    atlas_moments[SS_L2_COUNT + p] = vec4<f32>(0.0);
  }
}

@compute @workgroup_size(64)
fn ss_atlas_grav_eval_particles(@builtin(global_invocation_id) gid: vec3<u32>) {
  let idx = gid.x;
  if (idx >= params.count) { return; }
  let self_pm = src_raw[idx * params.stride_vec4 + 0u];
  if (!(self_pm.w > 0.0)) {
    acc_phi[idx] = vec4<f32>(0.0);
    return;
  }
  let com = acc_phi[params.count].xyz;
  let self_rel = self_pm.xyz - com;
  let l1_size = (2.0 * params.box_half) / 4.0;
  let leaf_w = (2.0 * params.box_half) / 16.0;
  let r_cell2 = params.r_cell_factor * leaf_w * leaf_w + params.softening2;
  let open_thresh2 = (l1_size * l1_size) / max(0.05, params.theta2);
  let self_cx = ss_clamp_chart16(self_rel.x, params.box_half);
  let self_cy = ss_clamp_chart16(self_rel.y, params.box_half);
  let self_cz = ss_clamp_chart16(self_rel.z, params.box_half);
  let self_chart_id = ss_chart_idx16(self_cx, self_cy, self_cz);

  var acc = vec3<f32>(0.0);
  var phi = 0.0;
  for (var p = 0u; p < SS_L1_COUNT; p = p + 1u) {
    let coarse = atlas_moments[SS_L2_COUNT + p];
    if (coarse.w <= 0.0) { continue; }
    let d_c = coarse.xyz - self_rel;
    let dist2_c = dot(d_c, d_c);
    if (dist2_c > open_thresh2) {
      let r2 = dist2_c + params.softening2;
      let inv_r = inverseSqrt(r2);
      acc = acc + d_c * (coarse.w * inv_r * inv_r * inv_r);
      phi = phi + coarse.w * inv_r;
    } else {
      let px = p & 3u;
      let py = (p >> 2u) & 3u;
      let pz = (p >> 4u) & 3u;
      for (var dz = 0u; dz < 4u; dz = dz + 1u) {
        for (var dy = 0u; dy < 4u; dy = dy + 1u) {
          for (var dx = 0u; dx < 4u; dx = dx + 1u) {
            let lx = px * 4u + dx;
            let ly = py * 4u + dy;
            let lz = pz * 4u + dz;
            let chart_id = ss_chart_idx16(lx, ly, lz);
            let leaf = atlas_moments[chart_id];
            if (leaf.w <= 0.0) { continue; }
            if (chart_id == self_chart_id) {
              // Exact Newton's Shell Theorem self-chart gravity: sum m_i a_i == 0 identically.
              let eff_m = leaf.w - self_pm.w;
              if (eff_m <= 1e-6) { continue; }
              let eff_pos = (leaf.xyz * leaf.w - self_rel * self_pm.w) / eff_m;
              let d = eff_pos - self_rel;
              let inv_rc = inverseSqrt(r_cell2);
              acc = acc + d * (eff_m * inv_rc * inv_rc * inv_rc);
              phi = phi + eff_m * inverseSqrt(dot(d, d) + params.softening2);
              continue;
            }
            let d = leaf.xyz - self_rel;
            var r2 = dot(d, d) + params.softening2;
            if (params.use_adj_softening != 0u) {
              let is_adj = (abs(i32(lx) - i32(self_cx)) <= 1)
                && (abs(i32(ly) - i32(self_cy)) <= 1)
                && (abs(i32(lz) - i32(self_cz)) <= 1);
              r2 = dot(d, d) + select(params.softening2, r_cell2, is_adj);
            }
            let inv_r = inverseSqrt(r2);
            acc = acc + d * (leaf.w * inv_r * inv_r * inv_r);
            phi = phi + leaf.w * inverseSqrt(dot(d, d) + params.softening2);
          }
        }
      }
    }
  }
  acc_phi[idx] = vec4<f32>(acc * params.gravity_g, phi * params.gravity_g);
}
`;function b(e,{maxCount:t,strideFloats:n=8,chartLevel:o=35,useAdjSoftening:s=!1,qMass:c=8192,qMom:l=512,rCellFactor:u=.05,label:f=`ulg-ss-atlas-gravity`}={}){if(!e||typeof e.createBuffer!=`function`)throw TypeError(`createSchroederScaleAtlasGravitySolverWebGpu requires a live WebGPU GPUDevice`);let p=Math.max(1,Math.trunc(Number(t))),m=Math.max(2,Math.trunc(Number(n)/4)),b=e.createBuffer({label:`${f}-chart-accum`,size:g*16,usage:d}),x=e.createBuffer({label:`${f}-moments`,size:v*16,usage:132}),S=e.createBuffer({label:`${f}-acc-phi`,size:(p+2)*16,usage:132}),C=e.createBuffer({label:`${f}-params`,size:48,usage:72}),w=[r(0,`read-only-storage`),r(1,`storage`),r(2,`storage`),r(3,`storage`),r(4,`uniform`)],T=t=>a(e,{cacheKey:`ulg-ss-atlas-resident-grav-${t}.v1`,label:`ulg-ss-atlas-resident-grav-${t}`,code:y,entryPoint:t,bindings:w}),E={clear:T(`ss_atlas_grav_clear`),comReduce:T(`ss_atlas_grav_com_reduce`),binCharts:T(`ss_atlas_grav_bin_charts`),finalizeCharts:T(`ss_atlas_grav_finalize_charts`),rollupParents:T(`ss_atlas_grav_rollup_parents`),evalParticles:T(`ss_atlas_grav_eval_particles`)};function D({count:t=p,gravityG:n=1,softening2:r=.04,boxHalf:i=16,theta2:a=.65*.65}={}){let d=new ArrayBuffer(48),f=new Uint32Array(d),h=new Int32Array(d),g=new Float32Array(d);f[0]=Math.min(p,Math.max(1,Math.trunc(Number(t)))),f[1]=m,f[2]=+!!s,h[3]=Math.trunc(Number(o)),g[4]=Number(n),g[5]=Number(r),g[6]=Number(i),g[7]=Number(a),g[8]=Number(c),g[9]=Number(l),g[10]=Number(u),g[11]=0,e.queue.writeBuffer(C,0,d)}function O(t){return i(e,{label:`${f}-bg`,layout:E.evalParticles.bindGroupLayout,entries:[{binding:0,resource:{buffer:t}},{binding:1,resource:{buffer:b}},{binding:2,resource:{buffer:x}},{binding:3,resource:{buffer:S}},{binding:4,resource:{buffer:C}}]})}function k(e,{srcBuffer:t,count:n=p}={}){let r=Math.min(p,Math.max(1,Math.trunc(Number(n)))),i=O(t),a=Math.ceil(r/64);e.setPipeline(E.clear.pipeline),e.setBindGroup(0,i),e.dispatchWorkgroups(Math.ceil(g/64)),e.setPipeline(E.comReduce.pipeline),e.setBindGroup(0,i),e.dispatchWorkgroups(1),e.setPipeline(E.binCharts.pipeline),e.setBindGroup(0,i),e.dispatchWorkgroups(a),e.setPipeline(E.finalizeCharts.pipeline),e.setBindGroup(0,i),e.dispatchWorkgroups(Math.ceil(g/64)),e.setPipeline(E.rollupParents.pipeline),e.setBindGroup(0,i),e.dispatchWorkgroups(Math.ceil(_/64)),e.setPipeline(E.evalParticles.pipeline),e.setBindGroup(0,i),e.dispatchWorkgroups(a)}return Object.freeze({schema:h,gravityMode:`webgpu-schroeder-scale-atlas-multipole`,maxCount:p,strideFloats:m*4,accPhiBuffer:S,atlasMomentsBuffer:x,comPosSlotIndex:p,comVelSlotIndex:p+1,writeParams:D,encodeIntoPass:k,destroy(){b.destroy(),x.destroy(),S.destroy(),C.destroy()}})}export{m as n,b as t};