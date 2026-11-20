// A1 larger-dt slice (plan/todo/a1-eshkol-coarse-dt.md): a semi-implicit
// (theta-method) liquid pressure increment for the canonical MLS-MPM step,
// solved between grid update and G2P.
//
// The explicit P2G keeps the pressure p_n from J. This pass adds the implicit
// increment dp = -theta K dt div(v_{n+1}), K = rho dp/drho of the same packed
// Tait EOS (the Eshkol AD derivation reproduces this closed form to 2e-16,
// tests/eshkolEosStiffness.native.test.mjs). The new grid velocity solves
//   (I + A) v = b,   A = (dt^2 / m) D^T (V K theta) D,
// where b is the updated grid velocity and D the particle divergence on the
// G2P stencil. A is symmetric positive semidefinite in the mass inner product,
// so matrix-free conjugate gradients from x0 = b converge. The normal
// components at the wall-barrier bands are held at b (Dirichlet), so the
// grid-update wall barrier stays authoritative.
//
// Validated standalone in tests/fixtures/semiImplicitMpmPrototype.js: the
// first sloshing mode within 0.01% of analytic at c dt / dx = 6.4, diverging
// at 12.8 regardless of CG iterations. The envelope constant below is that
// measured limit; callers clamp to it.
//
// Scatter sums use f32 compare-and-swap atomics. The flag-on step is
// therefore not bit-reproducible run to run (fixed-point needs a bound on the
// iterate scale); flag-off encodes nothing and is unchanged.

import { ESHKOL_TAIT_STIFFNESS_TABLE } from '../material/eshkolEosStiffnessTable.js';
import { packResponseFunctionsForGpu, responseFunctionGpuWgsl } from '../material/responseFunctionGpu.js';

// The Eshkol-derived Tait stiffness as an A4 response function, packed once
// into the resident GPU response table (responseFunctionGpu.js, rf_eval).
const ESHKOL_TAIT_STIFFNESS_RESPONSE = Object.freeze({
  axes: Object.freeze([Object.freeze({ name: 'rho/rho0', unit: '1', lo: ESHKOL_TAIT_STIFFNESS_TABLE.domain[0],
    hi: ESHKOL_TAIT_STIFFNESS_TABLE.domain[1], degree: ESHKOL_TAIT_STIFFNESS_TABLE.degree })]),
  coefficients: ESHKOL_TAIT_STIFFNESS_TABLE.coefficients,
  residuals: Object.freeze({ relativeBound: ESHKOL_TAIT_STIFFNESS_TABLE.relativeResidualBound })
});
export const SPH_IMPLICIT_PRESSURE_STIFFNESS_TABLE = packResponseFunctionsForGpu([ESHKOL_TAIT_STIFFNESS_RESPONSE]);

export const SPH_IMPLICIT_PRESSURE_MAX_CFL = 6.4;
// The operator's stiffness K is evaluated from the Eshkol-derived response
// (A4 Chebyshev fit of K / (rho0 c^2) over rho / rho0, Eshkol AD of the packed
// Tait EOS: src/runtime/material/eshkolEosStiffnessTable.js). The closed form
// remains as the out-of-domain fallback and the opt-out arm.
export const SPH_IMPLICIT_PRESSURE_STIFFNESS_SOURCES = Object.freeze({
  eshkol: 'eshkol-derived-chebyshev-v1',
  closedForm: 'closed-form-tait'
});
// Default liquid c dt / dx. On the 36,864-particle dam break at 8 ms, 3
// converges by 15 iterations (KE within 0.3% of 60 iterations) while 4 needs
// about 40 (20 leave KE 10% short), so 3 is the cheaper converged point.
export const SPH_IMPLICIT_PRESSURE_DEFAULT_CFL = 3;
export const SPH_IMPLICIT_PRESSURE_MIN_ITERATIONS = 10;

/**
 * CG iterations for a liquid c dt / dx. Unpreconditioned CG needs about
 * sqrt(kappa) iterations and kappa grows with (c dt / dx)^2. Measured on the
 * 36,864-particle water-realtime dam break: at 4 it converges by 20 (20, 40
 * and 60 agree; 10 lags the bulk motion by 13%); at 2, 10 equals 20.
 */
export function sphImplicitPressureIterationsFor(cflNumber) {
  const cfl = Number(cflNumber);
  return Math.min(64, Math.max(SPH_IMPLICIT_PRESSURE_MIN_ITERATIONS, Math.ceil(5 * (Number.isFinite(cfl) ? cfl : 0))));
}
export const SPH_IMPLICIT_PRESSURE_SCHEMA = 'ulg.sph.implicit-pressure.v1';

const PARAMS_BYTES = 96;
const NODE_VEC4_BYTES = 16;

/**
 * Normalize the `implicitPressure` mechanics option. Returns null (off) unless
 * it is truthy; numbers and strings '1'/'true' turn it on with defaults.
 */
export function normalizeSphImplicitPressureOptions(value) {
  if (value == null || value === false || value === 0 || value === '0' || value === 'off' || value === '') return null;
  const source = typeof value === 'object' ? value : {};
  if (typeof value === 'object' && value.enabled === false) return null;
  const theta = Number(source.theta ?? 1);
  const requestedCfl = Number(source.cflSafety ?? SPH_IMPLICIT_PRESSURE_DEFAULT_CFL);
  // The measured stability envelope (c dt / dx <= 6.4); outside it the
  // operator is not admitted, so the cap clamps rather than extrapolates.
  const cflSafety = Number.isFinite(requestedCfl) && requestedCfl > 0
    ? Math.min(requestedCfl, SPH_IMPLICIT_PRESSURE_MAX_CFL)
    : SPH_IMPLICIT_PRESSURE_DEFAULT_CFL;
  const iterations = Math.round(Number(source.iterations ?? sphImplicitPressureIterationsFor(cflSafety)));
  return {
    schema: SPH_IMPLICIT_PRESSURE_SCHEMA,
    enabled: true,
    iterations: Number.isFinite(iterations) ? Math.min(Math.max(iterations, 1), 64)
      : sphImplicitPressureIterationsFor(cflSafety),
    // Jacobi (diagonal) preconditioning, off by default: on the water-realtime
    // dam break at c dt / dx = 4 it slowed convergence of the bulk motion
    // (10 iterations: centre of mass 18% of motion off vs 3.9% without).
    jacobi: source.jacobi === true || source.jacobi === 1 || source.jacobi === '1',
    // Relative residual at which the CG stops early (GPU-side); 0 runs every
    // iteration.
    relativeTolerance: Number.isFinite(Number(source.relativeTolerance)) && Number(source.relativeTolerance) > 0
      ? Math.min(Number(source.relativeTolerance), 0.5) : 0,
    // K from the Eshkol-derived response (default) or the closed form (A/B).
    stiffnessSource: source.stiffnessSource === SPH_IMPLICIT_PRESSURE_STIFFNESS_SOURCES.closedForm
      || source.stiffnessSource === 'closed-form'
      ? SPH_IMPLICIT_PRESSURE_STIFFNESS_SOURCES.closedForm
      : SPH_IMPLICIT_PRESSURE_STIFFNESS_SOURCES.eshkol,
    theta: Number.isFinite(theta) ? Math.min(Math.max(theta, 0.5), 1) : 1,
    requestedCflSafety: Number.isFinite(requestedCfl) ? requestedCfl : SPH_IMPLICIT_PRESSURE_DEFAULT_CFL,
    cflSafety,
    envelopeClamped: Number.isFinite(requestedCfl) && requestedCfl > SPH_IMPLICIT_PRESSURE_MAX_CFL
  };
}

export const sphImplicitPressureWgsl = /* wgsl */ `
struct ImplicitPressureParams {
  particle_count: u32,
  grid_node_count: u32,
  grid_nx: u32,
  grid_ny: u32,
  grid_nz: u32,
  shift: u32,
  // 0: apply A to the grid velocity, 1: to the CG direction, 2: accumulate
  // the diagonal of A (Jacobi preconditioner).
  source_is_direction: u32,
  // bit 0: Jacobi preconditioner.
  flags: u32,
  grid_spacing_m: f32,
  inv_grid_spacing_m: f32,
  dt: f32,
  theta: f32,
  box_x: f32,
  box_y: f32,
  box_z: f32,
  internal_pressure_scale: f32,
  // Bound inputs for the fixed-point scale: the grid-update CFL speed cap
  // (cfl_factor dx / dt) and the liquid c dt / dx.
  max_speed_m_per_s: f32,
  cfl_number: f32,
  // Convergence: stop once <r, z>_M <= rz_tolerance <r0, z0>_M (the squared
  // relative residual); later iterations are GPU-side no-ops.
  rz_tolerance: f32,
  pad2: f32,
  // x: 1 = K from the Eshkol-derived response (rf_table function 0), 0 = the
  // closed form.
  stiffness_source: vec4<f32>,
};

@group(0) @binding(0) var<uniform> params: ImplicitPressureParams;
@group(0) @binding(1) var<storage, read> sph_state: array<vec4<f32>>;
@group(0) @binding(2) var<storage, read> sph_thermo: array<vec4<f32>>;
@group(0) @binding(3) var<storage, read> mls_mechanics: array<vec4<f32>>;
@group(0) @binding(4) var<storage, read_write> grid_nodes: array<vec4<f32>>;
@group(0) @binding(5) var<storage, read_write> cg_diag: array<vec4<f32>>;
@group(0) @binding(6) var<storage, read_write> iter_acc: array<atomic<u32>>;
@group(0) @binding(7) var<storage, read_write> cg_r: array<vec4<f32>>;
@group(0) @binding(8) var<storage, read_write> cg_p: array<vec4<f32>>;
@group(0) @binding(9) var<storage, read_write> cg_q: array<vec4<f32>>;
// scalars: 0 rz, 1 pq, 2 rz_new, 3 alpha, 4 beta, 5 apply fixed-point scale,
// 6 diagonal fixed-point scale, 7 per-source bound, 8 rz0, 9 converged flag,
// 10 iterations taken (f32 bits).
@group(0) @binding(10) var<storage, read_write> scalars: array<atomic<u32>>;
// One partial sum per node workgroup, reduced in a fixed order by
// ip_reduce_* (no contended atomics; the CG scalars are deterministic).
@group(0) @binding(11) var<storage, read_write> partials: array<f32>;
// A4 resident response table (responseFunctionGpu.js layout).
@group(0) @binding(12) var<storage, read> rf_table: array<f32>;

var<workgroup> partial: array<f32, 256>;

fn ip_weights(fx: f32) -> vec3<f32> {
  let a = 1.5 - fx;
  let b = fx - 1.0;
  let c = fx - 0.5;
  return vec3<f32>(0.5 * a * a, 0.75 - b * b, 0.5 * c * c);
}
fn ip_weight_at(w: vec3<f32>, o: i32) -> f32 {
  if (o == 0) { return w.x; }
  if (o == 1) { return w.y; }
  return w.z;
}
fn ip_in_range(i: i32, j: i32, k: i32) -> bool {
  let s = i32(params.shift);
  return i + s >= 0 && j + s >= 0 && k + s >= 0
    && i + s < i32(params.grid_nx) && j + s < i32(params.grid_ny) && k + s < i32(params.grid_nz);
}
fn ip_grid_index(i: i32, j: i32, k: i32) -> u32 {
  let s = i32(params.shift);
  return (u32(i + s) * params.grid_ny + u32(j + s)) * params.grid_nz + u32(k + s);
}

${responseFunctionGpuWgsl('rf_table')}

// K V theta of a particle on the implicit operator: Tait liquids only, the
// same density, rest density, sound speed and cavitation floor as P2G's
// packed_pressure; solids, gas and invalid volumes contribute nothing.
fn ip_particle_weight(particle_index: u32) -> f32 {
  let mb = particle_index * 8u;
  let row4 = mls_mechanics[mb + 4u];
  let row5 = mls_mechanics[mb + 5u];
  let row6 = mls_mechanics[mb + 6u];
  let volume = select(0.0, row4.w * row4.z, row4.w > 0.0 && row4.z > 0.0);
  if (!(volume > 0.0)) { return 0.0; }
  if (row5.x > 0.5 && row5.w > 0.0) { return 0.0; }
  if (!(row6.z > 0.5 && row6.z < 1.5)) { return 0.0; }
  let c = row6.y;
  let rho0 = sph_thermo[particle_index * 3u].w;
  let mass = sph_state[particle_index * 2u].w;
  if (!(c > 0.0) || !(rho0 > 0.0) || !(mass > 0.0)) { return 0.0; }
  let rho = mass / volume;
  let ratio = rho / rho0;
  let stiffness = rho0 * c * c / 7.0;
  // On the cavitation floor dp/drho = 0.
  if (stiffness * (pow(ratio, 7.0) - 1.0) <= -0.05 * stiffness) { return 0.0; }
  // K = rho0 c^2 K_hat(rho / rho0): the Eshkol-derived response inside its
  // fitted domain (liquid J is clamped to [0.95, 1.05]); the closed form
  // rho c^2 (rho / rho0)^6 outside it or when the table is off.
  var k = rho * c * c * pow(ratio, 6.0);
  if (params.stiffness_source.x > 0.5) {
    // Strict lookup: outside the fitted box rf_eval refuses (ok = 0) and the
    // closed form stands.
    let k_hat = rf_eval(0u, vec3<f32>(ratio, 0.0, 0.0));
    if (k_hat.y > 0.5) { k = rho0 * c * c * k_hat.x; }
  }
  return params.theta * params.internal_pressure_scale * k * volume;
}

// Normal components inside the grid-update wall-barrier bands are Dirichlet.
fn ip_project(node_row: vec4<f32>, v_in: vec3<f32>) -> vec3<f32> {
  var v = v_in;
  let h = params.grid_spacing_m;
  let eps = max(1.0e-7, abs(h) * 1.0e-6);
  let pos = node_row.xyz;
  if (pos.y < h - eps || pos.y >= params.box_y - h - eps) { v.y = 0.0; }
  if (pos.x <= h + eps || pos.x >= params.box_x - h - eps) { v.x = 0.0; }
  if (pos.z <= h + eps || pos.z >= params.box_z - h - eps) { v.z = 0.0; }
  return v;
}

// One particle pass applies A: s_p = (K V theta)_p dt div_p(source) on the
// G2P stencil (4 / h^2 w dpos), then s_p (4 / h^2) w dpos scattered to the
// same nodes. The gather reads grid velocity or the CG direction; the scatter
// writes iter_acc, so the two halves fuse without a cross-particle hazard.
// Deterministic fixed-point sums. Each component keeps a positive and a
// negative 64-bit magnitude (u32 lo/hi words): a typical contribution is one
// u32 atomicAdd (carry is rare), and integer atomics are order-independent
// and far cheaper here than an f32 compare-and-swap loop. The 2^64 range
// absorbs the dynamic range a global 31-bit scale cannot (low-mass surface
// nodes make max |p| large). q = |value| * scale, scale = 2^50 / bound.
fn ip_atomic_add_fixed(component: u32, value: f32, scale: f32) {
  let q = abs(value) * scale;
  if (!(q >= 0.5)) { return; }
  let base = component * 4u + select(0u, 2u, value < 0.0);
  var lo = 0u;
  var hi = 0u;
  if (q < 4294967040.0) {
    lo = u32(round(q));
  } else {
    let h = floor(q / 4294967296.0);
    hi = u32(min(h, 4294967040.0));
    lo = u32(min(q - h * 4294967296.0, 4294967040.0));
  }
  let old = atomicAdd(&iter_acc[base], lo);
  let carry = select(0u, 1u, old > 0xffffffffu - lo);
  if (hi + carry != 0u) { atomicAdd(&iter_acc[base + 1u], hi + carry); }
}
// (positive - negative) as a signed 64-bit integer, then to f32.
fn ip_take_fixed(component: u32, scale: f32) -> f32 {
  let b = component * 4u;
  let pl = atomicExchange(&iter_acc[b], 0u);
  let ph = atomicExchange(&iter_acc[b + 1u], 0u);
  let nl = atomicExchange(&iter_acc[b + 2u], 0u);
  let nh = atomicExchange(&iter_acc[b + 3u], 0u);
  let lo = pl - nl;
  let hi = bitcast<i32>(ph - nh - select(0u, 1u, pl < nl));
  if ((hi == 0 && lo < 0x80000000u) || (hi == -1 && lo >= 0x80000000u)) {
    return f32(bitcast<i32>(lo)) / scale;
  }
  return (f32(hi) * 4294967296.0 + f32(lo)) / scale;
}

@compute @workgroup_size(64)
fn ip_particle_apply(@builtin(global_invocation_id) id: vec3<u32>) {
  if (id.x >= params.particle_count) { return; }
  // A converged solve skips the expensive particle half of A.
  if (params.source_is_direction == 1u && ip_converged()) { return; }
  let kv = ip_particle_weight(id.x);
  if (kv == 0.0) { return; }
  let p_grid = sph_state[id.x * 2u].xyz * params.inv_grid_spacing_m;
  let bx = i32(floor(p_grid.x - 0.5));
  let by = i32(floor(p_grid.y - 0.5));
  let bz = i32(floor(p_grid.z - 0.5));
  let wx = ip_weights(p_grid.x - f32(bx));
  let wy = ip_weights(p_grid.y - f32(by));
  let wz = ip_weights(p_grid.z - f32(bz));
  let scale = 4.0 * params.inv_grid_spacing_m * params.inv_grid_spacing_m;
  if (params.source_is_direction == 2u) {
    // diag(A)_i,axis = dt / m_i sum_p (K V theta)_p dt (4 / h^2 w dpos_axis)^2
    for (var a = 0i; a < 3i; a = a + 1i) {
      for (var b = 0i; b < 3i; b = b + 1i) {
        for (var c = 0i; c < 3i; c = c + 1i) {
          let ni = bx + a; let nj = by + b; let nk = bz + c;
          if (!ip_in_range(ni, nj, nk)) { continue; }
          let idx = ip_grid_index(ni, nj, nk);
          if (!(grid_nodes[idx * 2u].x > 0.0)) { continue; }
          let w = ip_weight_at(wx, a) * ip_weight_at(wy, b) * ip_weight_at(wz, c);
          let g = scale * w * (vec3<f32>(f32(ni), f32(nj), f32(nk)) - p_grid) * params.grid_spacing_m;
          let d = kv * params.dt * g * g;
          let diag_scale = ip_scalar(6u);
          ip_atomic_add_fixed(idx * 3u, d.x, diag_scale);
          ip_atomic_add_fixed(idx * 3u + 1u, d.y, diag_scale);
          ip_atomic_add_fixed(idx * 3u + 2u, d.z, diag_scale);
        }
      }
    }
    return;
  }
  var div = 0.0;
  for (var a = 0i; a < 3i; a = a + 1i) {
    for (var b = 0i; b < 3i; b = b + 1i) {
      for (var c = 0i; c < 3i; c = c + 1i) {
        let ni = bx + a; let nj = by + b; let nk = bz + c;
        if (!ip_in_range(ni, nj, nk)) { continue; }
        let idx = ip_grid_index(ni, nj, nk);
        if (!(grid_nodes[idx * 2u].x > 0.0)) { continue; }
        let w = ip_weight_at(wx, a) * ip_weight_at(wy, b) * ip_weight_at(wz, c);
        let source = select(grid_nodes[idx * 2u].yzw, cg_p[idx].xyz, params.source_is_direction != 0u);
        let dpos = (vec3<f32>(f32(ni), f32(nj), f32(nk)) - p_grid) * params.grid_spacing_m;
        div = div + scale * w * dot(source, dpos);
      }
    }
  }
  let s = kv * params.dt * div;
  if (s == 0.0) { return; }
  let fixed_scale = ip_scalar(5u);
  for (var a = 0i; a < 3i; a = a + 1i) {
    for (var b = 0i; b < 3i; b = b + 1i) {
      for (var c = 0i; c < 3i; c = c + 1i) {
        let ni = bx + a; let nj = by + b; let nk = bz + c;
        if (!ip_in_range(ni, nj, nk)) { continue; }
        let idx = ip_grid_index(ni, nj, nk);
        if (!(grid_nodes[idx * 2u].x > 0.0)) { continue; }
        let w = ip_weight_at(wx, a) * ip_weight_at(wy, b) * ip_weight_at(wz, c);
        let dpos = (vec3<f32>(f32(ni), f32(nj), f32(nk)) - p_grid) * params.grid_spacing_m;
        let f = s * scale * w * dpos;
        ip_atomic_add_fixed(idx * 3u, f.x, fixed_scale);
        ip_atomic_add_fixed(idx * 3u + 1u, f.y, fixed_scale);
        ip_atomic_add_fixed(idx * 3u + 2u, f.z, fixed_scale);
      }
    }
  }
}

@compute @workgroup_size(64)
fn ip_clear_iteration(@builtin(global_invocation_id) id: vec3<u32>) {
  if (id.x >= params.grid_node_count) { return; }
  for (var w = 0u; w < 12u; w = w + 1u) { atomicStore(&iter_acc[id.x * 12u + w], 0u); }
}

// The fixed-point scales, from max_p (K V theta) on the GPU: one particle
// pass of workgroup maxima, then ip_reduce_scale.
@compute @workgroup_size(64)
fn ip_particle_kv_max(@builtin(global_invocation_id) id: vec3<u32>, @builtin(local_invocation_index) local: u32,
    @builtin(workgroup_id) group: vec3<u32>) {
  var kv = 0.0;
  if (id.x < params.particle_count) { kv = ip_particle_weight(id.x); }
  partial[local] = kv;
  workgroupBarrier();
  var stride = 32u;
  loop {
    if (local < stride) { partial[local] = max(partial[local], partial[local + stride]); }
    workgroupBarrier();
    if (stride == 1u) { break; }
    stride = stride / 2u;
  }
  if (local == 0u) { partials[group.x] = partial[0]; }
}

// Bound every node sum below 2^50 quanta: at most 64 particles per cell x 27
// stencil cells contribute; |s| <= kv_max dt (10.4 / h) |source|_max and each
// contribution carries (4 / h^2) w |dpos| <= 10.4 / h. The velocity source is
// bounded by the grid-update speed cap; each CG direction by its own max
// (ip_reduce_pscale). Slot 7 keeps 1728 kv_max dt (10.4 / h)^2.
const IP_FIXED_LIMIT: f32 = 1.1258999e15;
@compute @workgroup_size(256)
fn ip_reduce_scale(@builtin(local_invocation_index) local: u32) {
  let groups = (params.particle_count + 63u) / 64u;
  var kv_max = 0.0;
  for (var i = local; i < groups; i = i + 256u) { kv_max = max(kv_max, partials[i]); }
  partial[local] = kv_max;
  workgroupBarrier();
  var stride = 128u;
  loop {
    if (local < stride) { partial[local] = max(partial[local], partial[local + stride]); }
    workgroupBarrier();
    if (stride == 1u) { break; }
    stride = stride / 2u;
  }
  if (local == 0u) {
    let g = 10.4 * params.inv_grid_spacing_m;
    let per_source = 1728.0 * partial[0] * params.dt * g * g;
    ip_set_scalar(7u, per_source);
    let apply_bound = per_source * max(params.max_speed_m_per_s, 1.0e-6);
    ip_set_scalar(5u, select(1.0, IP_FIXED_LIMIT / apply_bound, apply_bound > 0.0));
    ip_set_scalar(6u, select(1.0, IP_FIXED_LIMIT / per_source, per_source > 0.0));
  }
}
// The next application's scale from max |p| (node workgroup maxima in
// partials[groups..2 groups)).
fn ip_set_direction_scale(local: u32) {
  let groups = (params.grid_node_count + 63u) / 64u;
  var p_max = 0.0;
  for (var i = local; i < groups; i = i + 256u) { p_max = max(p_max, partials[groups + i]); }
  workgroupBarrier();
  partial[local] = p_max;
  workgroupBarrier();
  var stride = 128u;
  loop {
    if (local < stride) { partial[local] = max(partial[local], partial[local + stride]); }
    workgroupBarrier();
    if (stride == 1u) { break; }
    stride = stride / 2u;
  }
  if (local == 0u) {
    let bound = ip_scalar(7u) * partial[0];
    ip_set_scalar(5u, select(1.0, IP_FIXED_LIMIT / bound, bound > 0.0));
  }
}
fn ip_workgroup_max_into(group: u32, local: u32, value: f32) {
  let groups = (params.grid_node_count + 63u) / 64u;
  workgroupBarrier();
  partial[local] = value;
  workgroupBarrier();
  var stride = 32u;
  loop {
    if (local < stride) { partial[local] = max(partial[local], partial[local + stride]); }
    workgroupBarrier();
    if (stride == 1u) { break; }
    stride = stride / 2u;
  }
  if (local == 0u) { partials[groups + group] = partial[0]; }
}
@compute @workgroup_size(256)
fn ip_reduce_pscale(@builtin(local_invocation_index) local: u32) {
  ip_set_direction_scale(local);
}

// Workgroup tree sum of 64 values; the workgroup's sum goes to partials.
fn ip_workgroup_partial(group: u32, local: u32, value: f32) {
  partial[local] = value;
  workgroupBarrier();
  var stride = 32u;
  loop {
    if (local < stride) { partial[local] = partial[local] + partial[local + stride]; }
    workgroupBarrier();
    if (stride == 1u) { break; }
    stride = stride / 2u;
  }
  if (local == 0u) { partials[group] = partial[0]; }
}
// One 256-thread workgroup sums every node workgroup's partial in a fixed order.
fn ip_reduce_partials(local: u32) -> f32 {
  let groups = (params.grid_node_count + 63u) / 64u;
  var sum = 0.0;
  for (var i = local; i < groups; i = i + 256u) { sum = sum + partials[i]; }
  partial[local] = sum;
  workgroupBarrier();
  var stride = 128u;
  loop {
    if (local < stride) { partial[local] = partial[local] + partial[local + stride]; }
    workgroupBarrier();
    if (stride == 1u) { break; }
    stride = stride / 2u;
  }
  return partial[0];
}
fn ip_set_scalar(slot: u32, value: f32) { atomicStore(&scalars[slot], bitcast<u32>(value)); }
fn ip_converged() -> bool { return bitcast<f32>(atomicLoad(&scalars[9])) > 0.5; }
fn ip_scalar(slot: u32) -> f32 { return bitcast<f32>(atomicLoad(&scalars[slot])); }
fn ip_take_node_av(index: u32, m: f32, scale: f32) -> vec3<f32> {
  let sum = vec3<f32>(ip_take_fixed(index * 3u, scale), ip_take_fixed(index * 3u + 1u, scale),
    ip_take_fixed(index * 3u + 2u, scale));
  return params.dt / max(m, 1.0e-30) * sum;
}

// Jacobi preconditioner: diag(I + A) per axis (1 where off or massless).
@compute @workgroup_size(64)
fn ip_build_diag(@builtin(global_invocation_id) id: vec3<u32>) {
  if (id.x >= params.grid_node_count) { return; }
  let m = grid_nodes[id.x * 2u].x;
  let av = ip_take_node_av(id.x, m, ip_scalar(6u));
  var d = vec3<f32>(1.0);
  if ((params.flags & 1u) != 0u && m > 0.0) { d = d + max(av, vec3<f32>(0.0)); }
  cg_diag[id.x] = vec4<f32>(d, 0.0);
}

// rz <- sum (after init).
@compute @workgroup_size(256)
fn ip_reduce_rz(@builtin(local_invocation_index) local: u32) {
  let rz = ip_reduce_partials(local);
  if (local == 0u) {
    ip_set_scalar(0u, rz);
    ip_set_scalar(8u, rz);
    ip_set_scalar(9u, select(0.0, 1.0, !(rz > 0.0)));
    ip_set_scalar(10u, 0.0);
  }
  ip_set_direction_scale(local);
}
// pq <- sum; alpha = rz / pq (after apply).
@compute @workgroup_size(256)
fn ip_reduce_alpha(@builtin(local_invocation_index) local: u32) {
  let pq = ip_reduce_partials(local);
  if (local == 0u) {
    ip_set_scalar(1u, pq);
    ip_set_scalar(3u, select(0.0, ip_scalar(0u) / pq, pq > 0.0 && !ip_converged()));
  }
}
// rz_new <- sum; beta = rz_new / rz; rz <- rz_new (after update_xr).
@compute @workgroup_size(256)
fn ip_reduce_beta(@builtin(local_invocation_index) local: u32) {
  let rz_new = ip_reduce_partials(local);
  if (local == 0u && !ip_converged()) {
    let rz = ip_scalar(0u);
    ip_set_scalar(2u, rz_new);
    ip_set_scalar(4u, select(0.0, rz_new / rz, rz > 0.0));
    ip_set_scalar(0u, rz_new);
    ip_set_scalar(10u, ip_scalar(10u) + 1.0);
    if (rz_new <= params.rz_tolerance * ip_scalar(8u)) { ip_set_scalar(9u, 1.0); }
  }
}

// PCG in the mass inner product with z = r / diag(I + A).
// x0 = b: r0 = -A b (projected), p0 = z0, accumulate <r, z>_M. (A warm
// start from the previous step's correction was measured worse on the dam
// break: plan/todo/a1-eshkol-coarse-dt.md.)
@compute @workgroup_size(64)
fn ip_cg_init(@builtin(global_invocation_id) id: vec3<u32>, @builtin(local_invocation_index) local: u32,
    @builtin(workgroup_id) group: vec3<u32>) {
  var contribution = 0.0;
  var p_abs = 0.0;
  // Barrier reductions: every invocation reaches workgroupBarrier.
  if (id.x < params.grid_node_count) {
    let m = grid_nodes[id.x * 2u].x;
    let av = ip_take_node_av(id.x, m, ip_scalar(5u));
    var r = vec3<f32>(0.0);
    if (m > 0.0) { r = ip_project(grid_nodes[id.x * 2u + 1u], -av); }
    let z = r / cg_diag[id.x].xyz;
    cg_r[id.x] = vec4<f32>(r, 0.0);
    cg_p[id.x] = vec4<f32>(z, 0.0);
    contribution = max(m, 0.0) * dot(r, z);
    p_abs = max(abs(z.x), max(abs(z.y), abs(z.z)));
  }
  ip_workgroup_partial(group.x, local, contribution);
  ip_workgroup_max_into(group.x, local, p_abs);
}

// q = (I + A) p (projected), accumulate <p, q>_M.
@compute @workgroup_size(64)
fn ip_cg_apply(@builtin(global_invocation_id) id: vec3<u32>, @builtin(local_invocation_index) local: u32,
    @builtin(workgroup_id) group: vec3<u32>) {
  var contribution = 0.0;
  if (id.x < params.grid_node_count) {
    let m = grid_nodes[id.x * 2u].x;
    let av = ip_take_node_av(id.x, m, ip_scalar(5u));
    var q = vec3<f32>(0.0);
    if (m > 0.0 && !ip_converged()) {
      let p = cg_p[id.x].xyz;
      q = ip_project(grid_nodes[id.x * 2u + 1u], p + av);
      contribution = m * dot(p, q);
    }
    cg_q[id.x] = vec4<f32>(q, 0.0);
  }
  ip_workgroup_partial(group.x, local, contribution);
}

// x += alpha p (the grid velocity in place), r -= alpha q, accumulate <r, z>_M.
@compute @workgroup_size(64)
fn ip_cg_update_xr(@builtin(global_invocation_id) id: vec3<u32>, @builtin(local_invocation_index) local: u32,
    @builtin(workgroup_id) group: vec3<u32>) {
  var contribution = 0.0;
  let alpha = ip_scalar(3u);
  if (id.x < params.grid_node_count) {
    let row = grid_nodes[id.x * 2u];
    if (row.x > 0.0) {
      let r = cg_r[id.x].xyz - alpha * cg_q[id.x].xyz;
      grid_nodes[id.x * 2u] = vec4<f32>(row.x, row.yzw + alpha * cg_p[id.x].xyz);
      cg_r[id.x] = vec4<f32>(r, 0.0);
      contribution = row.x * dot(r, r / cg_diag[id.x].xyz);
    }
  }
  ip_workgroup_partial(group.x, local, contribution);
}

// p = z + beta p.
@compute @workgroup_size(64)
fn ip_cg_update_p(@builtin(global_invocation_id) id: vec3<u32>, @builtin(local_invocation_index) local: u32,
    @builtin(workgroup_id) group: vec3<u32>) {
  var p_abs = 0.0;
  if (id.x < params.grid_node_count) {
    let beta = ip_scalar(4u);
    var p = cg_p[id.x].xyz;
    if (!ip_converged()) {
      p = cg_r[id.x].xyz / cg_diag[id.x].xyz + beta * p;
      cg_p[id.x] = vec4<f32>(p, 0.0);
    }
    p_abs = max(abs(p.x), max(abs(p.y), abs(p.z)));
  }
  ip_workgroup_max_into(group.x, local, p_abs);
}

`;

const ENTRY_POINTS = [
  'ip_particle_apply', 'ip_clear_iteration', 'ip_particle_kv_max', 'ip_reduce_scale', 'ip_build_diag',
  'ip_cg_init', 'ip_reduce_rz',
  'ip_cg_apply', 'ip_reduce_alpha', 'ip_cg_update_xr', 'ip_reduce_beta', 'ip_cg_update_p', 'ip_reduce_pscale'
];

const pipelineCache = new WeakMap();

function implicitPressurePipelines(device) {
  let cached = pipelineCache.get(device);
  if (cached) return cached;
  const module = device.createShaderModule({ label: 'ulg-sph-implicit-pressure', code: sphImplicitPressureWgsl });
  const layout = device.createBindGroupLayout({
    label: 'ulg-sph-implicit-pressure-layout',
    entries: [
      { binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'uniform' } },
      { binding: 1, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'read-only-storage' } },
      { binding: 2, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'read-only-storage' } },
      { binding: 3, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'read-only-storage' } },
      ...[4, 5, 6, 7, 8, 9, 10, 11].map((binding) => ({
        binding, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' }
      })),
      { binding: 12, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'read-only-storage' } }
    ]
  });
  const pipelineLayout = device.createPipelineLayout({ bindGroupLayouts: [layout] });
  const pipelines = Object.fromEntries(ENTRY_POINTS.map((entryPoint) => [entryPoint, device.createComputePipeline({
    label: `ulg-sph-implicit-pressure-${entryPoint}`,
    layout: pipelineLayout,
    compute: { module, entryPoint }
  })]));
  const stiffnessTable = device.createBuffer({ label: 'ulg-sph-implicit-pressure-response-table',
    size: SPH_IMPLICIT_PRESSURE_STIFFNESS_TABLE.data.byteLength, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST });
  device.queue.writeBuffer(stiffnessTable, 0, SPH_IMPLICIT_PRESSURE_STIFFNESS_TABLE.data);
  cached = { module, layout, pipelines, workspaces: [], stiffnessTable };
  pipelineCache.set(device, cached);
  return cached;
}

/** The WGSL compilation messages of the solver module (for compile checks). */
export async function sphImplicitPressureCompilationErrors(device) {
  const info = await implicitPressurePipelines(device).module.getCompilationInfo();
  return info.messages.filter((m) => m.type === 'error').map((m) => `${m.lineNum}:${m.linePos} ${m.message}`);
}

function workspaceFor(device, cache, { gridNodeCount, particleCount }) {
  const fits = (w) => w.gridNodeCount >= gridNodeCount && w.particleCount >= particleCount;
  let workspace = cache.workspaces.find(fits);
  if (workspace) return workspace;
  for (const old of cache.workspaces.splice(0)) for (const b of old.buffers) b.destroy();
  const S = GPUBufferUsage;
  const make = (label, size, usage = S.STORAGE) => device.createBuffer({ label, size: Math.max(16, size), usage });
  const nodes = Math.max(1, Math.ceil(gridNodeCount * 1.25));
  const particles = Math.max(1, Math.ceil(particleCount * 1.25));
  workspace = {
    gridNodeCount: nodes,
    particleCount: particles,
    cgDiag: make('ulg-sph-implicit-pressure-cg-diag', nodes * NODE_VEC4_BYTES),
    iterAcc: make('ulg-sph-implicit-pressure-iteration', nodes * 48),
    cgR: make('ulg-sph-implicit-pressure-cg-r', nodes * NODE_VEC4_BYTES),
    cgP: make('ulg-sph-implicit-pressure-cg-p', nodes * NODE_VEC4_BYTES),
    cgQ: make('ulg-sph-implicit-pressure-cg-q', nodes * NODE_VEC4_BYTES),
    scalars: make('ulg-sph-implicit-pressure-scalars', 64),
    partials: make('ulg-sph-implicit-pressure-partials', Math.ceil(Math.max(2 * nodes, particles) / 64) * 4 + 16),
    params: [0, 1, 2].map((source) => make(`ulg-sph-implicit-pressure-params-${source}`, PARAMS_BYTES,
      S.UNIFORM | S.COPY_DST)),
    bindGroups: new Map()
  };
  workspace.buffers = [workspace.cgDiag, workspace.iterAcc, workspace.cgR, workspace.cgP, workspace.cgQ,
    workspace.scalars, workspace.partials, ...workspace.params];
  cache.workspaces.push(workspace);
  return workspace;
}

/** Host packing of the params block (exported for tests). */
export function packSphImplicitPressureParams({
  particleCount, gridSpec, dt, theta, internalPressureScale = 1, sourceIsDirection = false,
  sourceMode = sourceIsDirection ? 1 : 0, jacobi = false, maxSpeedMPerS = 0, cflNumber = 0,
  stiffnessTable = ESHKOL_TAIT_STIFFNESS_TABLE, relativeTolerance = 0
}) {
  const data = new ArrayBuffer(PARAMS_BYTES);
  const u = new Uint32Array(data);
  const f = new Float32Array(data);
  u[0] = particleCount; u[1] = gridSpec.gridNodeCount;
  u[2] = gridSpec.gridDims[0]; u[3] = gridSpec.gridDims[1]; u[4] = gridSpec.gridDims[2];
  u[5] = gridSpec.shift; u[6] = sourceMode; u[7] = jacobi ? 1 : 0;
  f[8] = gridSpec.gridSpacingM; f[9] = 1 / gridSpec.gridSpacingM; f[10] = dt; f[11] = theta;
  f[12] = gridSpec.boxDimsM[0]; f[13] = gridSpec.boxDimsM[1]; f[14] = gridSpec.boxDimsM[2];
  f[15] = internalPressureScale;
  f[16] = maxSpeedMPerS; f[17] = cflNumber;
  f[18] = Math.max(Number(relativeTolerance) || 0, 0) ** 2;
  f[20] = stiffnessTable ? 1 : 0;
  return data;
}

/**
 * Encode the implicit pressure solve into `encoder`, between grid update and
 * G2P: it rewrites the velocities in `gridBuffer` (updated_grid_nodes) in
 * place. Returns the dispatch count. Params are written with
 * queue.writeBuffer, so one encoder must not carry two solves with different
 * dt (all substeps of a Tier-0 sequence share one dt).
 */
export function encodeSphImplicitPressureSolve(device, encoder, {
  options,
  stateBuffer,
  thermoBuffer,
  mechanicsBuffer,
  gridBuffer,
  gridSpec,
  particleCount,
  dt,
  internalPressureScale = 1,
  cflFactor = 0.6,
  timestampPassExtras = null
}) {
  if (!options?.enabled || !(particleCount > 0) || !(dt > 0)) return 0;
  const cache = implicitPressurePipelines(device);
  const workspace = workspaceFor(device, cache, { gridNodeCount: gridSpec.gridNodeCount, particleCount });
  const theta = options.theta ?? 1;
  const jacobi = options.jacobi === true;
  const stiffnessTable = options.stiffnessSource === SPH_IMPLICIT_PRESSURE_STIFFNESS_SOURCES.closedForm
    ? null : ESHKOL_TAIT_STIFFNESS_TABLE;
  // The grid update clamps node speed to cfl_factor dx / dt; the bound's
  // source speed starts from that cap.
  const maxSpeedMPerS = Math.max(Number(cflFactor) || 0.6, 1e-3) * gridSpec.gridSpacingM / dt;
  const cflNumber = options.cflSafety ?? 0;
  const paramsKey = `${particleCount}:${gridSpec.gridNodeCount}:${dt}:${theta}:${internalPressureScale}:${jacobi}`
    + `:${maxSpeedMPerS}:${cflNumber}:${stiffnessTable ? 'eshkol' : 'closed'}:${options.relativeTolerance ?? 0}`;
  if (workspace.paramsKey !== paramsKey) {
    workspace.params.forEach((buffer, source) => device.queue.writeBuffer(buffer, 0, packSphImplicitPressureParams({
      particleCount, gridSpec, dt, theta, internalPressureScale, sourceMode: source, jacobi, maxSpeedMPerS, cflNumber,
      stiffnessTable, relativeTolerance: options.relativeTolerance ?? 0
    })));
    workspace.paramsKey = paramsKey;
  }
  const groupKey = (source) => [source, stateBuffer, thermoBuffer, mechanicsBuffer, gridBuffer];
  const bindGroup = (source) => {
    const key = groupKey(source);
    for (const [cachedKey, group] of workspace.bindGroups) {
      if (cachedKey.every((entry, i) => entry === key[i])) return group;
    }
    const group = device.createBindGroup({
      label: `ulg-sph-implicit-pressure-group-${source}`,
      layout: cache.layout,
      entries: [
        { binding: 0, resource: { buffer: workspace.params[source] } },
        { binding: 1, resource: { buffer: stateBuffer } },
        { binding: 2, resource: { buffer: thermoBuffer } },
        { binding: 3, resource: { buffer: mechanicsBuffer } },
        { binding: 4, resource: { buffer: gridBuffer } },
        { binding: 5, resource: { buffer: workspace.cgDiag } },
        { binding: 6, resource: { buffer: workspace.iterAcc } },
        { binding: 7, resource: { buffer: workspace.cgR } },
        { binding: 8, resource: { buffer: workspace.cgP } },
        { binding: 9, resource: { buffer: workspace.cgQ } },
        { binding: 10, resource: { buffer: workspace.scalars } },
        { binding: 11, resource: { buffer: workspace.partials } },
        { binding: 12, resource: { buffer: cache.stiffnessTable } }
      ]
    });
    if (workspace.bindGroups.size >= 16) workspace.bindGroups.clear();
    workspace.bindGroups.set(key, group);
    return group;
  };
  const fromVelocity = bindGroup(0);
  const fromDirection = bindGroup(1);
  const forDiagonal = bindGroup(2);
  const nodeGroups = Math.max(1, Math.ceil(gridSpec.gridNodeCount / 64));
  const particleGroups = Math.max(1, Math.ceil(particleCount / 64));
  // Under the per-pass timestamp census (diagnostic only) each kernel gets its
  // own labelled pass so its GPU time is attributable; otherwise one pass.
  const splitPasses = Boolean(device.__ulgPassTimestampCensus);
  let pass = splitPasses ? null
    : encoder.beginComputePass({ label: 'ulg-sph-implicit-pressure', ...(timestampPassExtras ?? {}) });
  let dispatches = 0;
  const run = (entryPoint, groups, group = fromVelocity) => {
    if (splitPasses) pass = encoder.beginComputePass({ label: `ulg-sph-implicit-pressure-${entryPoint}` });
    pass.setPipeline(cache.pipelines[entryPoint]);
    pass.setBindGroup(0, group);
    pass.dispatchWorkgroups(groups);
    if (splitPasses) pass.end();
    dispatches += 1;
  };
  // The accumulator is cleared once; the diagonal build, init and apply
  // read-and-clear it.
  run('ip_clear_iteration', nodeGroups);
  run('ip_particle_kv_max', particleGroups);
  run('ip_reduce_scale', 1);
  if (jacobi) run('ip_particle_apply', particleGroups, forDiagonal);
  run('ip_build_diag', nodeGroups);
  run('ip_particle_apply', particleGroups, fromVelocity);
  run('ip_cg_init', nodeGroups);
  run('ip_reduce_rz', 1);
  for (let k = 0; k < options.iterations; k += 1) {
    run('ip_particle_apply', particleGroups, fromDirection);
    run('ip_cg_apply', nodeGroups);
    run('ip_reduce_alpha', 1);
    run('ip_cg_update_xr', nodeGroups);
    run('ip_reduce_beta', 1);
    run('ip_cg_update_p', nodeGroups);
    run('ip_reduce_pscale', 1);
  }
  if (!splitPasses) pass.end();
  return dispatches;
}
