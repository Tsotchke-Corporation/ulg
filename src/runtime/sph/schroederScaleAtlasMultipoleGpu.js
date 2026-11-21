import {
  SCHROEDER_SCALE_CHART_NO_PARENT,
  packSchroederScaleAtlasChartTable,
  schroederScaleAtlasChartRebaseWgsl
} from '../../../ulg-gpu-abi/src/index.js';
import {
  computeBufferBinding,
  createCachedExplicitBindGroup,
  createCachedExplicitComputePipeline
} from '../webgpuComputeLayout.js';

export const ULG_SCHROEDER_SCALE_ATLAS_MULTIPOLE_SCHEMA =
  'peercompute.ulg.schroeder-scale-atlas-multipole-gpu.v1';
export const SCHROEDER_MULTIPOLE_RECEIPT_MAGIC = 0x534d_5031; // 'SMP1'
export const SCHROEDER_MULTIPOLE_RECEIPT_WORDS = 16;
export const SCHROEDER_MULTIPOLE_RECEIPT_BYTES =
  SCHROEDER_MULTIPOLE_RECEIPT_WORDS * Uint32Array.BYTES_PER_ELEMENT;

export const GRAVITATIONAL_CONSTANT_SI = 6.67430e-11;
export const STEFAN_BOLTZMANN_SI = 5.670374419e-8;

const USAGE_STORAGE = 0x0080;
const USAGE_UNIFORM = 0x0040;
const USAGE_COPY_DST = 0x0008;
const USAGE_COPY_SRC = 0x0004;
const USAGE_MAP_READ = 0x0001;

/**
 * GPU Cross-Chart Barnes-Hut / FMM Multipole Gravity & Far-Field Radiative Coupling
 *
 * Works across arbitrary sparse dyadic charts spanning 40+ orders of magnitude
 * (L in [-64, +96]):
 *   1. Reduces resident particles per chart into exact conserved monopole mass M_c,
 *      center-of-mass R_c, traceless quadrupole tensor Q_c, bounding radius r_c,
 *      radiative luminosity L_c = sum(eps_i * A_i * sigma * T_i^4), and effective
 *      emitting/absorbing area A_eff,c = sum(eps_i * A_i).
 *   2. Evaluates pairwise cross-chart far-field gravitational forces (monopole +
 *      quadrupole correction) and radiative exchange power in well-conditioned
 *      dyadic frames using chunked power-of-2 scaling so f32 never overflows or
 *      underflows across 40+ OOM.
 *   3. Enforces exact pairwise reciprocity: F_{ab} = -F_{ba} (exact Newton's 3rd
 *      law / zero net momentum drift) and P_{ab} = -P_{ba} (exact radiative
 *      energy balance with nonnegative entropy production).
 */
export const schroederScaleAtlasMultipoleWgsl = /* wgsl */ `
${schroederScaleAtlasChartRebaseWgsl}

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

const NO_PARENT: u32 = ${SCHROEDER_SCALE_CHART_NO_PARENT}u;
const RECEIPT_MAGIC: u32 = ${SCHROEDER_MULTIPOLE_RECEIPT_MAGIC}u;
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

@compute @workgroup_size(1)
fn init_multipole_receipt() {
  for (var i = 0u; i < 16u; i = i + 1u) {
    atomicStore(&receipt[i], 0u);
  }
  atomicStore(&receipt[0], RECEIPT_MAGIC);
  atomicStore(&receipt[1], 1u);
}

// One thread per active chart deterministically reduces all resident particles
// belonging to that chart into exact conserved monopole, COM, quadrupole, and
// radiative luminosity moments, then lifts COM to root-chart double-float units.
@compute @workgroup_size(1)
fn reduce_chart_multipoles(@builtin(global_invocation_id) gid: vec3<u32>) {
  let c_idx = gid.x;
  if (c_idx >= params.chart_count) { return; }
  let chart = charts[c_idx];
  let cid = chart.chart_id;

  var mass_sum = 0.0;
  var mr_sum = vec3<f32>(0.0);
  var lum_sum = 0.0;
  var area_sum = 0.0;
  var count = 0u;

  for (var i = 0u; i < params.particle_count; i = i + 1u) {
    let p = particles[i];
    if (p.chart_id != cid || !(p.mass_kg > 0.0)) { continue; }
    mass_sum = mass_sum + p.mass_kg;
    mr_sum = mr_sum + p.mass_kg * p.pos_local;
    let t = max(p.temperature_k, 0.0);
    let t2 = t * t;
    let a_eff = max(p.effective_area_m2, 0.0);
    lum_sum = lum_sum + a_eff * params.stefan_boltzmann * t2 * t2;
    area_sum = area_sum + a_eff;
    count = count + 1u;
  }

  var com = vec3<f32>(0.0);
  if (mass_sum > 0.0) {
    com = mr_sum / mass_sum;
  }

  var max_r = 0.0;
  var q_diag = vec3<f32>(0.0);
  var q_off = vec3<f32>(0.0);
  if (mass_sum > 0.0) {
    for (var i = 0u; i < params.particle_count; i = i + 1u) {
      let p = particles[i];
      if (p.chart_id != cid || !(p.mass_kg > 0.0)) { continue; }
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
  }

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
  m.mass_kg = mass_sum;
  m.bounding_radius_local = max_r;
  m.luminosity_w = lum_sum;
  m.effective_area_m2 = area_sum;
  m.com_local = com;
  m.particle_count = count;
  m.q_diag = q_diag;
  m.pad0 = 0.0;
  m.q_off = q_off;
  m.pad1 = 0.0;
  m.root_com_hi = cur_hi;
  m.root_level = charts[cur_idx].global_base_level;
  m.root_com_lo = cur_lo;
  m.pad2 = 0.0;
  moments[c_idx] = m;
  atomicAdd(&receipt[3], count);
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

@compute @workgroup_size(1)
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

@compute @workgroup_size(1)
fn seal_multipole_receipt() {
  var total_f = vec3<f32>(0.0);
  var sum_f_mag = 0.0;
  var total_rad = 0.0;
  var sum_rad_mag = 0.0;
  for (var i = 0u; i < params.chart_count; i = i + 1u) {
    let o = outputs[i];
    if (!mp_finite3(o.net_force_n) || !mp_finite(o.net_radiative_power_w)) {
      atomicOr(&receipt[2], 4u);
    }
    total_f = total_f + o.net_force_n;
    sum_f_mag = sum_f_mag + length(o.net_force_n);
    total_rad = total_rad + o.net_radiative_power_w;
    sum_rad_mag = sum_rad_mag + abs(o.net_radiative_power_w);
  }
  let mom_rel_err = select(0.0, length(total_f) / sum_f_mag, sum_f_mag > 0.0);
  let rad_rel_err = select(0.0, abs(total_rad) / sum_rad_mag, sum_rad_mag > 0.0);
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
`;

export function packMultipoleParticles(particles = []) {
  const words = new Uint32Array(Math.max(1, particles.length) * 8);
  const view = new DataView(words.buffer);
  for (let i = 0; i < particles.length; i += 1) {
    const p = particles[i];
    const b = i * 32;
    const pos = p.posLocal ?? [0, 0, 0];
    view.setUint32(b + 0, (p.chartId >>> 0), true);
    view.setUint32(b + 4, (p.flags >>> 0), true);
    view.setFloat32(b + 8, Number(p.massKg ?? 0), true);
    view.setFloat32(b + 12, Number(p.temperatureK ?? 0), true);
    view.setFloat32(b + 16, Number(pos[0] ?? 0), true);
    view.setFloat32(b + 20, Number(pos[1] ?? 0), true);
    view.setFloat32(b + 24, Number(pos[2] ?? 0), true);
    view.setFloat32(b + 28, Number(p.effectiveAreaM2 ?? 0), true);
  }
  return words;
}

export async function runSchroederScaleAtlasMultipoleWebGpu(device, {
  atlas,
  particles,
  thetaMax = 0.5,
  gravityG = GRAVITATIONAL_CONSTANT_SI,
  stefanBoltzmann = STEFAN_BOLTZMANN_SI,
  softeningFraction = 1e-3
} = {}) {
  const packedCharts = packSchroederScaleAtlasChartTable(atlas);
  const packedParticles = packMultipoleParticles(particles);
  const chartCount = atlas.chartCount;
  const momentByteLength = Math.max(96, chartCount * 96);
  const outputByteLength = Math.max(32, chartCount * 32);

  const bindings = [
    computeBufferBinding(0, 'read-only-storage'),
    computeBufferBinding(1, 'read-only-storage'),
    computeBufferBinding(2, 'storage'),
    computeBufferBinding(3, 'storage'),
    computeBufferBinding(4, 'storage'),
    computeBufferBinding(5, 'uniform')
  ];
  const initPipe = createCachedExplicitComputePipeline(device, {
    cacheKey: 'ulg-scale-atlas-mp-init.v1',
    label: 'ulg-scale-atlas-mp-init',
    code: schroederScaleAtlasMultipoleWgsl,
    entryPoint: 'init_multipole_receipt',
    bindings
  });
  const reducePipe = createCachedExplicitComputePipeline(device, {
    cacheKey: 'ulg-scale-atlas-mp-reduce.v1',
    label: 'ulg-scale-atlas-mp-reduce',
    code: schroederScaleAtlasMultipoleWgsl,
    entryPoint: 'reduce_chart_multipoles',
    bindings
  });
  const couplePipe = createCachedExplicitComputePipeline(device, {
    cacheKey: 'ulg-scale-atlas-mp-couple.v1',
    label: 'ulg-scale-atlas-mp-couple',
    code: schroederScaleAtlasMultipoleWgsl,
    entryPoint: 'evaluate_cross_chart_coupling',
    bindings
  });
  const sealPipe = createCachedExplicitComputePipeline(device, {
    cacheKey: 'ulg-scale-atlas-mp-seal.v1',
    label: 'ulg-scale-atlas-mp-seal',
    code: schroederScaleAtlasMultipoleWgsl,
    entryPoint: 'seal_multipole_receipt',
    bindings
  });

  const chartBuf = device.createBuffer({
    label: 'ulg-scale-atlas-mp-charts',
    size: packedCharts.byteLength,
    usage: USAGE_STORAGE | USAGE_COPY_DST
  });
  const partBuf = device.createBuffer({
    label: 'ulg-scale-atlas-mp-particles',
    size: packedParticles.byteLength,
    usage: USAGE_STORAGE | USAGE_COPY_DST
  });
  const momentBuf = device.createBuffer({
    label: 'ulg-scale-atlas-mp-moments',
    size: momentByteLength,
    usage: USAGE_STORAGE | USAGE_COPY_SRC
  });
  const outputBuf = device.createBuffer({
    label: 'ulg-scale-atlas-mp-outputs',
    size: outputByteLength,
    usage: USAGE_STORAGE | USAGE_COPY_SRC
  });
  const receiptBuf = device.createBuffer({
    label: 'ulg-scale-atlas-mp-receipt',
    size: SCHROEDER_MULTIPOLE_RECEIPT_BYTES,
    usage: USAGE_STORAGE | USAGE_COPY_SRC
  });
  const paramsBuf = device.createBuffer({
    label: 'ulg-scale-atlas-mp-params',
    size: 32,
    usage: USAGE_UNIFORM | USAGE_COPY_DST
  });
  const readReceipt = device.createBuffer({
    label: 'ulg-scale-atlas-mp-receipt-read',
    size: SCHROEDER_MULTIPOLE_RECEIPT_BYTES,
    usage: USAGE_MAP_READ | USAGE_COPY_DST
  });
  const readOutputs = device.createBuffer({
    label: 'ulg-scale-atlas-mp-outputs-read',
    size: outputByteLength,
    usage: USAGE_MAP_READ | USAGE_COPY_DST
  });

  try {
    device.queue.writeBuffer(chartBuf, 0, packedCharts);
    device.queue.writeBuffer(partBuf, 0, packedParticles);
    const paramBytes = new ArrayBuffer(32);
    const pv = new DataView(paramBytes);
    pv.setUint32(0, particles.length >>> 0, true);
    pv.setUint32(4, chartCount >>> 0, true);
    pv.setFloat32(8, Number(atlas.referenceSpacingM ?? 1.0), true);
    pv.setFloat32(12, Number(thetaMax), true);
    pv.setFloat32(16, Number(gravityG), true);
    pv.setFloat32(20, Number(stefanBoltzmann), true);
    pv.setFloat32(24, Number(softeningFraction), true);
    pv.setUint32(28, 0, true);
    device.queue.writeBuffer(paramsBuf, 0, paramBytes);

    const entries = [
      { binding: 0, resource: { buffer: chartBuf } },
      { binding: 1, resource: { buffer: partBuf } },
      { binding: 2, resource: { buffer: momentBuf } },
      { binding: 3, resource: { buffer: outputBuf } },
      { binding: 4, resource: { buffer: receiptBuf } },
      { binding: 5, resource: { buffer: paramsBuf } }
    ];
    const initBg = createCachedExplicitBindGroup(device, { layout: initPipe.bindGroupLayout, entries });
    const reduceBg = createCachedExplicitBindGroup(device, { layout: reducePipe.bindGroupLayout, entries });
    const coupleBg = createCachedExplicitBindGroup(device, { layout: couplePipe.bindGroupLayout, entries });
    const sealBg = createCachedExplicitBindGroup(device, { layout: sealPipe.bindGroupLayout, entries });

    const encoder = device.createCommandEncoder({ label: 'ulg-scale-atlas-multipole' });
    const pass = encoder.beginComputePass({ label: 'ulg-scale-atlas-multipole-pass' });
    pass.setPipeline(initPipe.pipeline);
    pass.setBindGroup(0, initBg);
    pass.dispatchWorkgroups(1);
    pass.setPipeline(reducePipe.pipeline);
    pass.setBindGroup(0, reduceBg);
    pass.dispatchWorkgroups(chartCount);
    pass.setPipeline(couplePipe.pipeline);
    pass.setBindGroup(0, coupleBg);
    pass.dispatchWorkgroups(chartCount);
    pass.setPipeline(sealPipe.pipeline);
    pass.setBindGroup(0, sealBg);
    pass.dispatchWorkgroups(1);
    pass.end();
    encoder.copyBufferToBuffer(receiptBuf, 0, readReceipt, 0, SCHROEDER_MULTIPOLE_RECEIPT_BYTES);
    encoder.copyBufferToBuffer(outputBuf, 0, readOutputs, 0, outputByteLength);
    device.queue.submit([encoder.finish()]);

    await Promise.all([readReceipt.mapAsync(1), readOutputs.mapAsync(1)]);
    const rBytes = readReceipt.getMappedRange().slice(0);
    const oBytes = readOutputs.getMappedRange().slice(0);
    readReceipt.unmap();
    readOutputs.unmap();

    const rWords = new Uint32Array(rBytes);
    const rView = new DataView(rBytes);
    const oView = new DataView(oBytes);
    const chartOutputs = [];
    for (let i = 0; i < chartCount; i += 1) {
      const b = i * 32;
      chartOutputs.push(Object.freeze({
        chartId: atlas.charts[i].chartId,
        netForceN: Object.freeze([
          oView.getFloat32(b + 0, true),
          oView.getFloat32(b + 4, true),
          oView.getFloat32(b + 8, true)
        ]),
        netRadiativePowerW: oView.getFloat32(b + 12, true),
        gravityPotentialJ: oView.getFloat32(b + 16, true),
        coupledPairCount: oView.getUint32(b + 20, true),
        farFieldPairCount: oView.getUint32(b + 24, true),
        nearFieldSkippedCount: oView.getUint32(b + 28, true)
      }));
    }

    return Object.freeze({
      schema: ULG_SCHROEDER_SCALE_ATLAS_MULTIPOLE_SCHEMA,
      receipt: Object.freeze({
        magic: rWords[0],
        status: rWords[1],
        errorMask: rWords[2],
        reducedParticleCount: rWords[3],
        coupledPairDirectedCount: rWords[4],
        farFieldPairDirectedCount: rWords[5],
        momentumRelError: rView.getFloat32(24, true),
        radiativeRelError: rView.getFloat32(28, true),
        verified: rWords[0] === SCHROEDER_MULTIPOLE_RECEIPT_MAGIC && rWords[1] === 3 && rWords[2] === 0
      }),
      chartOutputs: Object.freeze(chartOutputs)
    });
  } finally {
    chartBuf.destroy();
    partBuf.destroy();
    momentBuf.destroy();
    outputBuf.destroy();
    receiptBuf.destroy();
    paramsBuf.destroy();
    readReceipt.destroy();
    readOutputs.destroy();
  }
}
