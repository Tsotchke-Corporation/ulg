// A3 (seven-goal-campaign.md) on the GPU: representative homogeneous-region
// samples, conservative envelope expansion and bounded region-wide lookup.
// Nothing runs on the host: the envelope, the homogeneity decision, the
// Chebyshev fit, its held-out validation, the member lookups, the async
// envelope expansion and its schedule-boundary adoption are all compute
// passes. The host only builds pipelines, writes the control uniform, and
// reads fixed-size evidence (counters, per-region state).
//
// The expensive law is a WGSL generator supplied by the consumer:
//   fn a3_generator(x: vec3<f32>) -> f32   // the law, 1-3 axes in x.xyz
//   fn a3_regime(x: vec3<f32>) -> u32      // phase/domain label
// Members are vec4<f32>(x0, x1, x2, bitcast<f32>(region id)).
//
// Per region and evaluation:
//   - the member envelope decides homogeneity against per-axis tolerances and
//     a single regime;
//   - a homogeneous region without an accepted fit is fitted at once over its
//     envelope expanded by `margin` (tensor Chebyshev on first-kind nodes);
//     held-out interior and face points give the relative residual bound
//     (maximum x safetyFactor, empirical); a fit spanning regimes, with a
//     non-finite sample, or over `relativeTolerance` is refused;
//   - members of a fitted region are looked up with the bound; a member
//     outside the box or in another regime is evaluated directly, never
//     extrapolated, and counted as debt;
//   - async policy: a region with debt gets one pending fit over the union of
//     its accepted box and envelope, adopted only by the schedule-boundary
//     pass; strict policy queues nothing;
//   - heterogeneous or refused regions are evaluated directly.
// Accepted fits live in the A4 response-function table layout
// (responseFunctionGpu.js), one record per region, so rf_eval serves lookups.
import { responseFunctionGpuWgsl, RESPONSE_FUNCTION_GPU_HEADER_FLOATS, RESPONSE_FUNCTION_GPU_RECORD_FLOATS,
  RESPONSE_FUNCTION_GPU_MAX_TERMS } from './responseFunctionGpu.js';

export const REGIONAL_CLOSURE_SAMPLER_GPU_SCHEMA = 'peercompute.ulg.regional-closure-sampler-gpu.v1';
export const A3_GPU_MAX_TERMS_PER_REGION = 256;
export const A3_GPU_ENVELOPE_WORDS = 10;
export const A3_GPU_STATE_WORDS = 8;
export const A3_GPU_FIT_BOX_VEC4S = 2;
// Region actions (state word 2).
export const A3_GPU_ACTION = Object.freeze({ EMPTY: 0, DIRECT_HETEROGENEOUS: 1, FIT_NOW: 2, LOOKUP: 3, DIRECT_REFUSED: 4 });
// Member sources (values[m].y).
export const A3_GPU_SOURCE = Object.freeze({ LOOKUP: 0, DIRECT: 1, DIRECT_DEBT: 2 });
// Global counters.
export const A3_GPU_COUNTER = Object.freeze({
  exactEvaluations: 0, lookups: 1, fits: 2, refusedFits: 3, directRegions: 4, debt: 5, adoptions: 6,
  invalidMembers: 7, verifyViolations: 8, verifyMaxRelErrorBits: 9, verifyMembers: 10
});
export const A3_GPU_COUNTER_WORDS = 16;
const PARAMS_BYTES = 96;
const WORKGROUP = 64;

function a3Wgsl({ generatorWgsl, maxTerms, regionCapacity }) {
  return /* wgsl */ `
struct A3Params {
  axes: u32, region_count: u32, member_count: u32, max_terms: u32,
  n0: u32, n1: u32, n2: u32, held_out_per_axis: u32,
  policy: u32, _p0: u32, _p1: u32, _p2: u32,
  margin: f32, relative_tolerance: f32, safety_factor: f32, verify_slack: f32,
  tol0: f32, tol1: f32, tol2: f32, _p3: f32,
};
@group(0) @binding(0) var<uniform> params: A3Params;
@group(0) @binding(1) var<storage, read> members: array<vec4<f32>>;
// One atomic control buffer (8 storage bindings per stage by default):
// counters at word 0, then the per-region envelope, then per-region debt.
@group(0) @binding(2) var<storage, read_write> control: array<atomic<u32>>;
@group(0) @binding(3) var<storage, read_write> region_state: array<u32>;
@group(0) @binding(4) var<storage, read_write> rf_table: array<f32>;
@group(0) @binding(5) var<storage, read_write> pending_table: array<f32>;
@group(0) @binding(6) var<storage, read_write> values: array<vec4<f32>>;
@group(0) @binding(7) var<storage, read_write> fit_box: array<vec4<f32>>;

${generatorWgsl}
${responseFunctionGpuWgsl('rf_table')}

const MAX_TERMS: u32 = ${maxTerms}u;
const PI: f32 = 3.14159265358979;
const ENV: u32 = ${A3_GPU_ENVELOPE_WORDS}u;
const ST: u32 = ${A3_GPU_STATE_WORDS}u;
const HEADER: u32 = ${RESPONSE_FUNCTION_GPU_HEADER_FLOATS}u;
const RECORD: u32 = ${RESPONSE_FUNCTION_GPU_RECORD_FLOATS}u;
const ENV_BASE: u32 = ${A3_GPU_COUNTER_WORDS}u;
const DEBT_BASE: u32 = ${A3_GPU_COUNTER_WORDS}u + ${regionCapacity}u * ENV;

fn a3_key(v: f32) -> u32 {
  let b = bitcast<u32>(v);
  return select(b ^ 0x80000000u, ~b, (b & 0x80000000u) != 0u);
}
fn a3_unkey(k: u32) -> f32 {
  return bitcast<f32>(select(~k, k ^ 0x80000000u, (k & 0x80000000u) != 0u));
}
fn a3_finite(v: f32) -> bool { return abs(v) <= 3.4028234e38; }
fn a3_tol(a: u32) -> f32 { return select(select(params.tol2, params.tol1, a == 1u), params.tol0, a == 0u); }
fn a3_n(a: u32) -> u32 { return select(select(params.n2, params.n1, a == 1u), params.n0, a == 0u); }
fn a3_terms() -> u32 { return params.n0 * params.n1 * params.n2; }
// Matches the table header written at creation (sized by region capacity).
fn a3_coefficient_base() -> u32 { return HEADER + ${regionCapacity}u * RECORD; }

// Conservative expansion of [lo, hi] (the host plan's rule, f32 floor).
fn a3_expand(lo: f32, hi: f32, a: u32) -> vec2<f32> {
  let pad = max(max((hi - lo) * params.margin, a3_tol(a) * params.margin), abs(hi) * 1.0e-6);
  return vec2<f32>(lo - pad, hi + pad);
}

@compute @workgroup_size(${WORKGROUP})
fn clear_envelope(@builtin(global_invocation_id) id: vec3<u32>) {
  let r = id.x;
  if (r >= params.region_count) { return; }
  for (var a = 0u; a < 3u; a = a + 1u) {
    atomicStore(&control[ENV_BASE + r * ENV + a], 0xffffffffu);
    atomicStore(&control[ENV_BASE + r * ENV + 3u + a], 0u);
  }
  atomicStore(&control[ENV_BASE + r * ENV + 6u], 0u);
  atomicStore(&control[ENV_BASE + r * ENV + 7u], 0xffffffffu);
  atomicStore(&control[ENV_BASE + r * ENV + 8u], 0u);
  atomicStore(&control[ENV_BASE + r * ENV + 9u], 0u);
  atomicStore(&control[DEBT_BASE + r], 0u);
}

@compute @workgroup_size(${WORKGROUP})
fn accumulate_envelope(@builtin(global_invocation_id) id: vec3<u32>) {
  let m = id.x;
  if (m >= params.member_count) { return; }
  let member = members[m];
  let r = bitcast<u32>(member.w);
  if (r >= params.region_count) { atomicAdd(&control[${A3_GPU_COUNTER.invalidMembers}u], 1u); return; }
  for (var a = 0u; a < params.axes; a = a + 1u) {
    let x = member[a];
    if (!a3_finite(x)) { atomicOr(&control[ENV_BASE + r * ENV + 9u], 1u); }
    atomicMin(&control[ENV_BASE + r * ENV + a], a3_key(x));
    atomicMax(&control[ENV_BASE + r * ENV + 3u + a], a3_key(x));
  }
  let regime = a3_regime(member.xyz);
  atomicMin(&control[ENV_BASE + r * ENV + 7u], regime);
  atomicMax(&control[ENV_BASE + r * ENV + 8u], regime);
  atomicAdd(&control[ENV_BASE + r * ENV + 6u], 1u);
}

// State words: [0] accepted, [1] pending, [2] action, [3] accepted regime,
// [4] pending fit requested, [5] pending regime.
@compute @workgroup_size(${WORKGROUP})
fn plan_regions(@builtin(global_invocation_id) id: vec3<u32>) {
  let r = id.x;
  if (r >= params.region_count) { return; }
  let s = r * ST;
  region_state[s + 4u] = 0u;
  let count = atomicLoad(&control[ENV_BASE + r * ENV + 6u]);
  if (count == 0u) { region_state[s + 2u] = ${A3_GPU_ACTION.EMPTY}u; return; }
  var homogeneous = atomicLoad(&control[ENV_BASE + r * ENV + 9u]) == 0u
    && atomicLoad(&control[ENV_BASE + r * ENV + 7u]) == atomicLoad(&control[ENV_BASE + r * ENV + 8u]);
  var lo = vec3<f32>(0.0);
  var hi = vec3<f32>(0.0);
  for (var a = 0u; a < params.axes; a = a + 1u) {
    lo[a] = a3_unkey(atomicLoad(&control[ENV_BASE + r * ENV + a]));
    hi[a] = a3_unkey(atomicLoad(&control[ENV_BASE + r * ENV + 3u + a]));
    if (!(hi[a] - lo[a] <= a3_tol(a))) { homogeneous = false; }
  }
  if (!homogeneous) {
    region_state[s + 2u] = ${A3_GPU_ACTION.DIRECT_HETEROGENEOUS}u;
    atomicAdd(&control[${A3_GPU_COUNTER.directRegions}u], 1u);
    return;
  }
  if (region_state[s] == 1u) { region_state[s + 2u] = ${A3_GPU_ACTION.LOOKUP}u; return; }
  var box_lo = vec4<f32>(0.0);
  var box_hi = vec4<f32>(0.0);
  for (var a = 0u; a < params.axes; a = a + 1u) {
    let b = a3_expand(lo[a], hi[a], a);
    box_lo[a] = b.x;
    box_hi[a] = b.y;
  }
  box_lo.w = f32(atomicLoad(&control[ENV_BASE + r * ENV + 7u]));
  fit_box[r * 2u] = box_lo;
  fit_box[r * 2u + 1u] = box_hi;
  region_state[s + 2u] = ${A3_GPU_ACTION.FIT_NOW}u;
}

// Async expansion: one pending fit over the union of the accepted box and
// this evaluation's envelope, for a fitted region that took debt.
@compute @workgroup_size(${WORKGROUP})
fn plan_pending(@builtin(global_invocation_id) id: vec3<u32>) {
  let r = id.x;
  if (r >= params.region_count) { return; }
  let s = r * ST;
  region_state[s + 4u] = 0u;
  if (params.policy != 0u || region_state[s + 2u] != ${A3_GPU_ACTION.LOOKUP}u
    || region_state[s + 1u] != 0u || atomicLoad(&control[DEBT_BASE + r]) == 0u) { return; }
  let rec = HEADER + r * RECORD;
  var box_lo = vec4<f32>(0.0);
  var box_hi = vec4<f32>(0.0);
  for (var a = 0u; a < params.axes; a = a + 1u) {
    let lo = min(rf_table[rec + 5u + 2u * a], a3_unkey(atomicLoad(&control[ENV_BASE + r * ENV + a])));
    let hi = max(rf_table[rec + 6u + 2u * a], a3_unkey(atomicLoad(&control[ENV_BASE + r * ENV + 3u + a])));
    let b = a3_expand(lo, hi, a);
    box_lo[a] = b.x;
    box_hi[a] = b.y;
  }
  box_lo.w = f32(region_state[s + 3u]);
  fit_box[r * 2u] = box_lo;
  fit_box[r * 2u + 1u] = box_hi;
  region_state[s + 4u] = 1u;
}

var<workgroup> wg_a: array<f32, MAX_TERMS>;
var<workgroup> wg_b: array<f32, MAX_TERMS>;
var<workgroup> wg_flags: atomic<u32>;
var<workgroup> wg_max_rel: atomic<u32>;
var<workgroup> wg_go: u32;
var<workgroup> wg_ok: u32;

fn a3_node_x(ts: vec3<f32>, lo: vec4<f32>, hi: vec4<f32>) -> vec3<f32> {
  var x = vec3<f32>(0.0);
  for (var a = 0u; a < params.axes; a = a + 1u) { x[a] = lo[a] + (ts[a] + 1.0) * (hi[a] - lo[a]) * 0.5; }
  return x;
}

fn a3_fit_eval(ts: vec3<f32>) -> f32 {
  let tx = rf_chebyshev(ts.x, params.n0);
  let ty = rf_chebyshev(ts.y, params.n1);
  let tz = rf_chebyshev(ts.z, params.n2);
  var sum = 0.0;
  for (var i = 0u; i < params.n0; i = i + 1u) {
    for (var j = 0u; j < params.n1; j = j + 1u) {
      for (var k = 0u; k < params.n2; k = k + 1u) {
        sum = sum + wg_a[(i * params.n1 + j) * params.n2 + k] * tx[i] * ty[j] * tz[k];
      }
    }
  }
  return sum;
}

// One workgroup per region. The target is the accepted table (fit_now) or the
// pending table (pending). Deterministic: every output is one thread's
// fixed-order sum; maxima are order-independent atomics.
fn a3_fit_region(r: u32, lid: u32, pending: bool) {
  let s = r * ST;
  if (lid == 0u) {
    let requested = select(region_state[s + 2u] == ${A3_GPU_ACTION.FIT_NOW}u, region_state[s + 4u] == 1u, pending);
    wg_go = select(0u, 1u, requested);
    atomicStore(&wg_flags, 0u);
    atomicStore(&wg_max_rel, 0u);
  }
  if (workgroupUniformLoad(&wg_go) == 0u) { return; }
  let lo = fit_box[r * 2u];
  let hi = fit_box[r * 2u + 1u];
  let regime = u32(lo.w);
  let terms = a3_terms();
  var evaluations = 0u;
  // Samples at the tensor grid of first-kind Chebyshev nodes (row-major).
  for (var idx = lid; idx < terms; idx = idx + ${WORKGROUP}u) {
    let i0 = idx / (params.n1 * params.n2);
    let i1 = (idx / params.n2) % params.n1;
    let i2 = idx % params.n2;
    let ts = vec3<f32>(
      cos(PI * (f32(i0) + 0.5) / f32(params.n0)),
      cos(PI * (f32(i1) + 0.5) / f32(params.n1)),
      cos(PI * (f32(i2) + 0.5) / f32(params.n2)));
    let x = a3_node_x(ts, lo, hi);
    if (a3_regime(x) != regime) { atomicOr(&wg_flags, 1u); }
    let f = a3_generator(x);
    evaluations = evaluations + 1u;
    if (!a3_finite(f)) { atomicOr(&wg_flags, 2u); }
    wg_a[idx] = f;
  }
  workgroupBarrier();
  // Tensor Chebyshev transform, one axis at a time.
  for (var axis = 0u; axis < params.axes; axis = axis + 1u) {
    let n = a3_n(axis);
    var stride = 1u;
    for (var b = axis + 1u; b < 3u; b = b + 1u) { stride = stride * a3_n(b); }
    for (var idx = lid; idx < terms; idx = idx + ${WORKGROUP}u) {
      let s_index = idx % stride;
      let j = (idx / stride) % n;
      let o = idx / (stride * n);
      var sum = 0.0;
      for (var k = 0u; k < n; k = k + 1u) {
        sum = sum + wg_a[(o * n + k) * stride + s_index] * cos(PI * f32(j) * (f32(k) + 0.5) / f32(n));
      }
      wg_b[idx] = select(2.0, 1.0, j == 0u) * sum / f32(n);
    }
    workgroupBarrier();
    for (var idx = lid; idx < terms; idx = idx + ${WORKGROUP}u) { wg_a[idx] = wg_b[idx]; }
    workgroupBarrier();
  }
  // Held-out points: an interior lattice offset from every node, then the
  // same lattice on each box face.
  let h = params.held_out_per_axis;
  var interior = 1u;
  for (var a = 0u; a < params.axes; a = a + 1u) { interior = interior * h; }
  let total = interior * (1u + 2u * params.axes);
  for (var p = lid; p < total; p = p + ${WORKGROUP}u) {
    let q = select(p - interior, p, p < interior);
    let lattice = q % interior;
    var ts = vec3<f32>(0.0);
    var rest = lattice;
    for (var a = params.axes; a > 0u; a = a - 1u) {
      ts[a - 1u] = -1.0 + 2.0 * (f32(rest % h) + 0.5) / f32(h);
      rest = rest / h;
    }
    if (p >= interior) {
      let face_axis = q / (2u * interior);
      let face = (q / interior) % 2u;
      ts[face_axis] = select(-1.0, 1.0, face == 1u);
    }
    let x = a3_node_x(ts, lo, hi);
    if (a3_regime(x) != regime) { atomicOr(&wg_flags, 4u); }
    let exact = a3_generator(x);
    evaluations = evaluations + 1u;
    let rel = abs(a3_fit_eval(ts) - exact) / max(abs(exact), 1.0e-30);
    if (!a3_finite(rel)) { atomicOr(&wg_flags, 8u); } else { atomicMax(&wg_max_rel, bitcast<u32>(rel)); }
  }
  if (evaluations > 0u) { atomicAdd(&control[${A3_GPU_COUNTER.exactEvaluations}u], evaluations); }
  workgroupBarrier();
  if (lid == 0u) {
    let bound = bitcast<f32>(atomicLoad(&wg_max_rel)) * params.safety_factor;
    let ok = atomicLoad(&wg_flags) == 0u && a3_finite(bound) && bound <= params.relative_tolerance;
    wg_ok = select(0u, 1u, ok);
    if (ok) {
      let rec = HEADER + r * RECORD;
      var record: array<f32, ${RESPONSE_FUNCTION_GPU_RECORD_FLOATS}>;
      record[0] = f32(params.axes);
      record[1] = f32(r * MAX_TERMS);
      record[2] = f32(params.n0);
      record[3] = f32(params.n1);
      record[4] = f32(params.n2);
      for (var a = 0u; a < 3u; a = a + 1u) {
        record[5u + 2u * a] = select(0.0, lo[a], a < params.axes);
        record[6u + 2u * a] = select(1.0, hi[a], a < params.axes);
      }
      record[11] = bound;
      for (var w = 0u; w < RECORD; w = w + 1u) {
        if (pending) { pending_table[rec + w] = record[w]; } else { rf_table[rec + w] = record[w]; }
      }
      if (pending) {
        region_state[s + 1u] = 1u;
        region_state[s + 5u] = regime;
      } else {
        region_state[s] = 1u;
        region_state[s + 3u] = regime;
        region_state[s + 2u] = ${A3_GPU_ACTION.LOOKUP}u;
      }
      atomicAdd(&control[${A3_GPU_COUNTER.fits}u], 1u);
    } else {
      atomicAdd(&control[${A3_GPU_COUNTER.refusedFits}u], 1u);
      if (!pending) {
        region_state[s + 2u] = ${A3_GPU_ACTION.DIRECT_REFUSED}u;
        atomicAdd(&control[${A3_GPU_COUNTER.directRegions}u], 1u);
      }
    }
    region_state[s + 4u] = 0u;
  }
  if (workgroupUniformLoad(&wg_ok) == 1u) {
    let base = a3_coefficient_base() + r * MAX_TERMS;
    for (var idx = lid; idx < terms; idx = idx + ${WORKGROUP}u) {
      if (pending) { pending_table[base + idx] = wg_a[idx]; } else { rf_table[base + idx] = wg_a[idx]; }
    }
  }
}

@compute @workgroup_size(${WORKGROUP})
fn fit_now(@builtin(workgroup_id) wid: vec3<u32>, @builtin(local_invocation_index) lid: u32) {
  if (wid.x >= params.region_count) { return; }
  a3_fit_region(wid.x, lid, false);
}

@compute @workgroup_size(${WORKGROUP})
fn fit_pending(@builtin(workgroup_id) wid: vec3<u32>, @builtin(local_invocation_index) lid: u32) {
  if (wid.x >= params.region_count) { return; }
  a3_fit_region(wid.x, lid, true);
}

@compute @workgroup_size(${WORKGROUP})
fn lookup_members(@builtin(global_invocation_id) id: vec3<u32>) {
  let m = id.x;
  if (m >= params.member_count) { return; }
  let member = members[m];
  let r = bitcast<u32>(member.w);
  if (r >= params.region_count) { values[m] = vec4<f32>(0.0, -1.0, 0.0, 0.0); return; }
  let s = r * ST;
  let action = region_state[s + 2u];
  if (action == ${A3_GPU_ACTION.LOOKUP}u) {
    let bound = rf_table[HEADER + r * RECORD + 11u];
    if (a3_regime(member.xyz) == region_state[s + 3u]) {
      let fit = rf_eval(r, member.xyz);
      if (fit.y == 1.0) {
        atomicAdd(&control[${A3_GPU_COUNTER.lookups}u], 1u);
        values[m] = vec4<f32>(fit.x, ${A3_GPU_SOURCE.LOOKUP}.0, bound, f32(r));
        return;
      }
    }
    // Never extrapolate: direct work for this member, counted as debt.
    atomicAdd(&control[${A3_GPU_COUNTER.exactEvaluations}u], 1u);
    atomicAdd(&control[${A3_GPU_COUNTER.debt}u], 1u);
    atomicAdd(&control[DEBT_BASE + r], 1u);
    values[m] = vec4<f32>(a3_generator(member.xyz), ${A3_GPU_SOURCE.DIRECT_DEBT}.0, bound, f32(r));
    return;
  }
  atomicAdd(&control[${A3_GPU_COUNTER.exactEvaluations}u], 1u);
  values[m] = vec4<f32>(a3_generator(member.xyz), ${A3_GPU_SOURCE.DIRECT}.0, 0.0, f32(r));
}

// Schedule boundary: pending (expanded) fits become the accepted ones.
@compute @workgroup_size(${WORKGROUP})
fn adopt_pending(@builtin(global_invocation_id) id: vec3<u32>) {
  let r = id.x;
  if (r >= params.region_count) { return; }
  let s = r * ST;
  if (region_state[s + 1u] != 1u) { return; }
  let rec = HEADER + r * RECORD;
  for (var w = 0u; w < RECORD; w = w + 1u) { rf_table[rec + w] = pending_table[rec + w]; }
  let base = a3_coefficient_base() + r * MAX_TERMS;
  for (var idx = 0u; idx < MAX_TERMS; idx = idx + 1u) { rf_table[base + idx] = pending_table[base + idx]; }
  region_state[s] = 1u;
  region_state[s + 1u] = 0u;
  region_state[s + 3u] = region_state[s + 5u];
  atomicAdd(&control[${A3_GPU_COUNTER.adoptions}u], 1u);
}

// GPU self-check: every member's value against a direct evaluation, within
// its bound plus an f32 comparison slack. Fixed-size evidence only.
@compute @workgroup_size(${WORKGROUP})
fn verify_members(@builtin(global_invocation_id) id: vec3<u32>) {
  let m = id.x;
  if (m >= params.member_count) { return; }
  let v = values[m];
  if (v.y < 0.0) { return; }
  let exact = a3_generator(members[m].xyz);
  let rel = abs(v.x - exact) / max(abs(exact), 1.0e-30);
  atomicAdd(&control[${A3_GPU_COUNTER.verifyMembers}u], 1u);
  if (!a3_finite(rel) || rel > v.z + params.verify_slack) {
    atomicAdd(&control[${A3_GPU_COUNTER.verifyViolations}u], 1u);
  }
  if (a3_finite(rel)) { atomicMax(&control[${A3_GPU_COUNTER.verifyMaxRelErrorBits}u], bitcast<u32>(rel)); }
}
`;
}

const STORAGE = 0x80, UNIFORM = 0x40, COPY_DST = 0x08, COPY_SRC = 0x04;

export function createRegionalClosureSamplerGpu(device, {
  generatorWgsl, axes, regionCapacity, memberCapacity, degrees, tolerances, margin = 0.25, policy = 'async',
  relativeTolerance = 1e-5, heldOutPerAxis = 3, safetyFactor = 2, verifySlack = 2.4e-7
} = {}) {
  if (typeof generatorWgsl !== 'string' || !/fn a3_generator\b/.test(generatorWgsl) || !/fn a3_regime\b/.test(generatorWgsl)) {
    throw new TypeError('generatorWgsl must define a3_generator(x: vec3<f32>) -> f32 and a3_regime(x: vec3<f32>) -> u32');
  }
  if (!Number.isInteger(axes) || axes < 1 || axes > 3) throw new RangeError('A3 GPU supports 1-3 axes');
  if (!Array.isArray(degrees) || degrees.length !== axes || !Array.isArray(tolerances) || tolerances.length !== axes) {
    throw new TypeError('one degree and one tolerance per axis');
  }
  if (policy !== 'async' && policy !== 'strict') throw new TypeError(`unknown policy ${policy}`);
  const n = [0, 1, 2].map((a) => (a < axes ? degrees[a] + 1 : 1));
  if (n.some((k) => !Number.isInteger(k) || k < 1 || k > RESPONSE_FUNCTION_GPU_MAX_TERMS)) {
    throw new RangeError(`each axis needs 1-${RESPONSE_FUNCTION_GPU_MAX_TERMS} Chebyshev terms`);
  }
  const terms = n[0] * n[1] * n[2];
  if (terms > A3_GPU_MAX_TERMS_PER_REGION) throw new RangeError(`at most ${A3_GPU_MAX_TERMS_PER_REGION} terms per region`);
  if (!Number.isInteger(regionCapacity) || regionCapacity < 1 || regionCapacity > 65535
    || !Number.isInteger(memberCapacity) || memberCapacity < 1) {
    throw new RangeError('regionCapacity must be 1-65535 (one fit workgroup each) and memberCapacity positive');
  }
  if (!Number.isInteger(heldOutPerAxis) || heldOutPerAxis < 1) throw new RangeError('heldOutPerAxis must be >= 1');
  const maxTerms = A3_GPU_MAX_TERMS_PER_REGION;
  const tableFloats = RESPONSE_FUNCTION_GPU_HEADER_FLOATS + regionCapacity * (RESPONSE_FUNCTION_GPU_RECORD_FLOATS + maxTerms);
  if (tableFloats >= 2 ** 24) throw new RangeError('A3 table exceeds exact f32 indexing');
  const buffer = (label, size, usage) => device.createBuffer({ label: `ulg-a3-${label}`, size: Math.max(16, size), usage });
  const params = buffer('params', PARAMS_BYTES, UNIFORM | COPY_DST);
  const controlWords = A3_GPU_COUNTER_WORDS + regionCapacity * (A3_GPU_ENVELOPE_WORDS + 1);
  const control = buffer('control', controlWords * 4, STORAGE | COPY_SRC | COPY_DST);
  const regionState = buffer('region-state', regionCapacity * A3_GPU_STATE_WORDS * 4, STORAGE | COPY_SRC | COPY_DST);
  const table = buffer('accepted-table', tableFloats * 4, STORAGE | COPY_SRC | COPY_DST);
  const pendingTable = buffer('pending-table', tableFloats * 4, STORAGE | COPY_DST);
  const values = buffer('values', memberCapacity * 16, STORAGE | COPY_SRC);
  const fitBox = buffer('fit-box', regionCapacity * A3_GPU_FIT_BOX_VEC4S * 16, STORAGE);
  // Table header: the region count is the function count, so rf_eval(r, x)
  // addresses region r; unfitted regions are never looked up (state gate).
  const header = new Float32Array([regionCapacity, RESPONSE_FUNCTION_GPU_HEADER_FLOATS + regionCapacity * RESPONSE_FUNCTION_GPU_RECORD_FLOATS, 0, 0]);
  device.queue.writeBuffer(table, 0, header);
  device.queue.writeBuffer(pendingTable, 0, header);

  const module = device.createShaderModule({ label: 'ulg-a3-regional-closure-sampler', code: a3Wgsl({ generatorWgsl, maxTerms, regionCapacity }) });
  const storage = (binding, type = 'storage') => ({ binding, visibility: 4, buffer: { type } });
  const layout = device.createBindGroupLayout({ label: 'ulg-a3-layout', entries: [
    { binding: 0, visibility: 4, buffer: { type: 'uniform' } }, storage(1, 'read-only-storage'),
    storage(2), storage(3), storage(4), storage(5), storage(6), storage(7)] });
  const pipelineLayout = device.createPipelineLayout({ bindGroupLayouts: [layout] });
  const pipelines = Object.fromEntries(['clear_envelope', 'accumulate_envelope', 'plan_regions', 'fit_now', 'lookup_members',
    'plan_pending', 'fit_pending', 'adopt_pending', 'verify_members'].map((entryPoint) => [entryPoint,
    device.createComputePipeline({ label: `ulg-a3-${entryPoint}`, layout: pipelineLayout, compute: { module, entryPoint } })]));
  const bindGroups = new WeakMap();
  const bindGroupFor = (membersBuffer) => {
    let group = bindGroups.get(membersBuffer);
    if (!group) {
      group = device.createBindGroup({ layout, entries: [params, membersBuffer, control, regionState, table, pendingTable,
        values, fitBox].map((b, binding) => ({ binding, resource: { buffer: b } })) });
      bindGroups.set(membersBuffer, group);
    }
    return group;
  };
  return Object.freeze({
    schema: REGIONAL_CLOSURE_SAMPLER_GPU_SCHEMA, axes, n, terms, maxTerms, regionCapacity, memberCapacity, policy,
    buffers: Object.freeze({ params, control, regionState, table, pendingTable, values, fitBox }),
    // Word offsets inside buffers.control.
    controlLayout: Object.freeze({ countersWord: 0, envelopeWord: A3_GPU_COUNTER_WORDS,
      debtWord: A3_GPU_COUNTER_WORDS + regionCapacity * A3_GPU_ENVELOPE_WORDS, words: controlWords }),
    pipelines, bindGroupFor,
    writeParams({ regionCount, memberCount }) {
      if (!Number.isInteger(regionCount) || regionCount < 1 || regionCount > regionCapacity) throw new RangeError('regionCount out of capacity');
      if (!Number.isInteger(memberCount) || memberCount < 0 || memberCount > memberCapacity) throw new RangeError('memberCount out of capacity');
      const data = new ArrayBuffer(PARAMS_BYTES);
      const u = new Uint32Array(data), f = new Float32Array(data);
      u.set([axes, regionCount, memberCount, maxTerms, n[0], n[1], n[2], heldOutPerAxis, policy === 'async' ? 0 : 1]);
      f[12] = margin; f[13] = relativeTolerance; f[14] = safetyFactor; f[15] = verifySlack;
      tolerances.forEach((t, a) => { f[16 + a] = t; });
      device.queue.writeBuffer(params, 0, data);
    }
  });
}

function dispatch(encoder, sampler, membersBuffer, entryPoint, groups) {
  if (groups < 1) return;
  const pass = encoder.beginComputePass({ label: `ulg-a3-${entryPoint}` });
  pass.setPipeline(sampler.pipelines[entryPoint]);
  pass.setBindGroup(0, sampler.bindGroupFor(membersBuffer));
  pass.dispatchWorkgroups(groups);
  pass.end();
}

/**
 * Encode one evaluation of `memberCount` members over `regionCount` regions.
 * Call sampler.writeParams({ regionCount, memberCount }) before the submit
 * that carries this encoder (one evaluation per submit).
 */
export function encodeRegionalClosureEvaluate(encoder, sampler, { membersBuffer, regionCount, memberCount }) {
  const regionGroups = Math.ceil(regionCount / WORKGROUP);
  const memberGroups = Math.ceil(memberCount / WORKGROUP);
  dispatch(encoder, sampler, membersBuffer, 'clear_envelope', regionGroups);
  dispatch(encoder, sampler, membersBuffer, 'accumulate_envelope', memberGroups);
  dispatch(encoder, sampler, membersBuffer, 'plan_regions', regionGroups);
  dispatch(encoder, sampler, membersBuffer, 'fit_now', regionCount);
  dispatch(encoder, sampler, membersBuffer, 'lookup_members', memberGroups);
  if (sampler.policy === 'async') {
    dispatch(encoder, sampler, membersBuffer, 'plan_pending', regionGroups);
    dispatch(encoder, sampler, membersBuffer, 'fit_pending', regionCount);
  }
}

/** Encode the schedule boundary: pending expanded fits become live. */
export function encodeRegionalClosureScheduleBoundary(encoder, sampler, { membersBuffer, regionCount }) {
  dispatch(encoder, sampler, membersBuffer, 'adopt_pending', Math.ceil(regionCount / WORKGROUP));
}

/** Encode the GPU self-check of the latest evaluation's member values. */
export function encodeRegionalClosureVerify(encoder, sampler, { membersBuffer, memberCount }) {
  dispatch(encoder, sampler, membersBuffer, 'verify_members', Math.ceil(memberCount / WORKGROUP));
}
