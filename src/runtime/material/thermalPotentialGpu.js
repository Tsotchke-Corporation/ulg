import { responseFunctionGpuWgsl } from './responseFunctionGpu.js';
import { thermalResponseGraphUploadMatchesDevice } from '../sph/sphThermalGpuKernel.js';
import { THERMAL_POTENTIAL_WORKER_CANDIDATE, THERMAL_POTENTIAL_WORKER_ACK,
  isThermalPotentialWorkerCandidate, thermalPotentialWorkerCandidateEquals } from './thermalPotentialWorkerProtocol.js';

// G6 caloric slice, fixed phase/composition/mechanical coordinates. The retained
// graph is the source, including its energy origin. For an affine positive-Cv
// liquid branch, s(u)=Cv*log(T(u)/Tref), with source-fixed Tref=left endpoint.
// Fit g(x)=log(T/Tm), keeping Cv*log(Tm/Tref) as an explicit entropy offset;
// x=(u-um)/(Cv*Tm), then T=Tm/g', dT/du=-g''/(Cv*g'^2).
// This defines a parametric Helmholtz slice a=u-T*s, a_T=-s,
// a_TT=Cv*g'^3/(Tm*g''). It does not supply pressure or cross a phase knot.
// Authoritative U is never rewritten when this derived representation changes.
export const THERMAL_POTENTIAL_SCHEMA = 'ulg.thermal-potential-gpu.v1';
export const THERMAL_POTENTIAL_LIMITS = Object.freeze({
  terms: 8, heldOut: 65, temperatureRelative: 1e-4, slopeRelative: 1e-3,
  entropyAbsolute: 2e-6, maxGraphs: 4096, maxGenerations: 3
});
const caches = new WeakMap(), candidates = new WeakMap(), deltas = new WeakMap();
let nextOwner = 1;
const sourceFields = ['graphNodeBuffer', 'graphSampleBuffer', 'responseBuffer', 'responseRecordBuffer',
  'responseThermalConductivityBuffer', 'contentFingerprint', 'graphCount'];

export function thermalPotentialLookupWgsl({ table = 'g6_table', metadata = 'g6_metadata', requests = 'g6_requests' } = {}) {
  return /* wgsl */ `
${responseFunctionGpuWgsl(table)}
fn g6_key(v: f32) -> u32 { let b = bitcast<u32>(v); return select(b ^ 0x80000000u, ~b, (b & 0x80000000u) != 0u); }
fn g6_unkey(k: u32) -> f32 { return bitcast<f32>(select(~k, k ^ 0x80000000u, (k & 0x80000000u) != 0u)); }
// Returns (T, dT/du, empirical relative T bound, valid). Invalid points use
// the original graph. Miss requests are GPU-owned; they grant no adoption.
// Supports solid (1), liquid (2), and gas (3) single-phase caloric branches,
// checking each graph's authoritative phaseId stored in metadata[graph*4+3].w.
fn g6_temperature(graph: u32, u: f32, phase: f32) -> vec4<f32> {
  atomicAdd(&${requests}[0u], 1u);
  if (
    !(phase == 1.0 || phase == 2.0 || phase == 3.0)
    || !rf_finite(u)
    || graph >= arrayLength(&${metadata}) / 4u
  ) {
    atomicAdd(&${requests}[3u], 1u); return vec4<f32>(0.0);
  }
  let meta3 = ${metadata}[graph * 4u + 3u];
  if (meta3.w != phase) {
    atomicAdd(&${requests}[3u], 1u); return vec4<f32>(0.0);
  }
  let m = ${metadata}[graph * 4u];
  let bounds = ${metadata}[graph * 4u + 1u];
  if (m.w == 1.0 && u >= bounds.x && u <= bounds.y) {
    let d = rf_eval_differential(graph, vec3<f32>((u - m.x) / (m.y * m.z), 0.0, 0.0));
    if (d.ok == 1u && d.gradient.x > 0.0 && d.hessian[0][0] < 0.0) {
      let temperature = m.z / d.gradient.x;
      let slope = -d.hessian[0][0] / (m.y * d.gradient.x * d.gradient.x);
      if (rf_finite(temperature) && rf_finite(slope) && temperature > 0.0 && slope > 0.0) {
        atomicAdd(&${requests}[1u], 1u);
        return vec4<f32>(temperature, slope, bounds.z, 1.0);
      }
    }
  }
  let base = 16u + graph * 4u;
  atomicMin(&${requests}[base], g6_key(u));
  atomicMax(&${requests}[base + 1u], g6_key(u));
  atomicAdd(&${requests}[base + 2u], 1u);
  atomicAdd(&${requests}[2u], 1u);
  return vec4<f32>(0.0);
}
`;
}

export const thermalPotentialFitWgsl = /* wgsl */ `
@group(0) @binding(0) var<storage, read> nodes: array<vec4<f32>>;
@group(0) @binding(1) var<storage, read> samples: array<vec4<f32>>;
@group(0) @binding(2) var<storage, read_write> requests: array<atomic<u32>>;
@group(0) @binding(3) var<storage, read_write> table: array<f32>;
@group(0) @binding(4) var<storage, read_write> metadata: array<vec4<f32>>;
@group(0) @binding(5) var<storage, read_write> receipt: array<atomic<u32>>;
${responseFunctionGpuWgsl('table')}
fn key(v: f32) -> u32 { let b = bitcast<u32>(v); return select(b ^ 0x80000000u, ~b, (b & 0x80000000u) != 0u); }
fn unkey(k: u32) -> f32 { return bitcast<f32>(select(~k, k ^ 0x80000000u, (k & 0x80000000u) != 0u)); }
@compute @workgroup_size(64)
fn reset(@builtin(global_invocation_id) id: vec3<u32>) {
  let g = id.x;
  if (g < 16u) { atomicStore(&requests[g], 0u); }
  if (g >= arrayLength(&metadata) / 4u) { return; }
  atomicStore(&requests[16u + g*4u], 0xffffffffu);
  atomicStore(&requests[17u + g*4u], 0u);
  atomicStore(&requests[18u + g*4u], 0u);
  atomicStore(&requests[19u + g*4u], 0u);
  var graph_phase = 0.0;
  if (g * 4u + 3u < arrayLength(&nodes)) {
    let candidate_phase = nodes[g * 4u + 3u].z;
    if (candidate_phase == 1.0 || candidate_phase == 2.0 || candidate_phase == 3.0) {
      graph_phase = candidate_phase;
    }
  }
  metadata[g * 4u] = vec4<f32>(0.0);
  metadata[g * 4u + 1u] = vec4<f32>(0.0);
  metadata[g * 4u + 2u] = vec4<f32>(0.0);
  metadata[g * 4u + 3u] = vec4<f32>(0.0, 0.0, 0.0, graph_phase);
}
@compute @workgroup_size(64)
fn clear_misses(@builtin(global_invocation_id) id: vec3<u32>) {
  let g=id.x; if(g>=arrayLength(&metadata)/4u){return;}
  atomicStore(&requests[16u+g*4u],0xffffffffu);
  atomicStore(&requests[17u+g*4u],0u);
  atomicStore(&requests[18u+g*4u],0u);
}
fn g6_knot_slope(offset: u32, sample_count: u32, idx: u32) -> f32 {
  if (sample_count < 2u) { return 0.0; }
  if (idx == 0u) {
    let a = samples[offset].xy;
    let b = samples[offset + 1u].xy;
    let h0 = b.x - a.x;
    let d0 = (b.y - a.y) / h0;
    if (sample_count == 2u) { return d0; }
    let c = samples[offset + 2u].xy;
    let h1 = c.x - b.x;
    let d1 = (c.y - b.y) / h1;
    // Second-order monotone-clamped PCHIP endpoint derivative (exact on quadratics).
    var m = ((2.0 * h0 + h1) * d0 - h0 * d1) / (h0 + h1);
    if (m <= 0.0) { return 0.5 * d0; }
    if (m > 3.0 * d0) { m = 3.0 * d0; }
    return m;
  }
  if (idx + 1u >= sample_count) {
    let a = samples[offset + sample_count - 2u].xy;
    let b = samples[offset + sample_count - 1u].xy;
    let h1 = b.x - a.x;
    let d1 = (b.y - a.y) / h1;
    if (sample_count == 2u) { return d1; }
    let p = samples[offset + sample_count - 3u].xy;
    let h0 = a.x - p.x;
    let d0 = (a.y - p.y) / h0;
    var m = ((2.0 * h1 + h0) * d1 - h1 * d0) / (h0 + h1);
    if (m <= 0.0) { return 0.5 * d1; }
    if (m > 3.0 * d1) { m = 3.0 * d1; }
    return m;
  }
  let p = samples[offset + idx - 1u].xy;
  let c = samples[offset + idx].xy;
  let q = samples[offset + idx + 1u].xy;
  let d0 = (c.y - p.y) / (c.x - p.x);
  let d1 = (q.y - c.y) / (q.x - c.x);
  if (!(d0 > 0.0) || !(d1 > 0.0)) { return 0.0; }
  // Monotone-preserving Fritsch-Carlson harmonic mean slope (C^1 smooth, exact on linear).
  let w0 = 2.0 * (q.x - c.x) + (c.x - p.x);
  let w1 = (q.x - c.x) + 2.0 * (c.x - p.x);
  return (w0 + w1) / (w0 / d0 + w1 / d1);
}
fn g6_eval_source_caloric(offset: u32, sample_count: u32, u: f32) -> vec3<f32> {
  if (sample_count < 2u || offset + sample_count > arrayLength(&samples) || !rf_finite(u)) {
    return vec3<f32>(0.0, 0.0, 0.0);
  }
  var lo = 0u;
  var hi = sample_count - 2u;
  // Binary search the strictly monotone sample table for segment [lo, lo + 1].
  loop {
    if (lo >= hi) { break; }
    let mid = (lo + hi + 1u) / 2u;
    if (samples[offset + mid].x <= u) {
      lo = mid;
    } else {
      hi = mid - 1u;
    }
  }
  let left = samples[offset + lo].xy;
  let right = samples[offset + lo + 1u].xy;
  let du = right.x - left.x;
  let dT = right.y - left.y;
  if (
    !all(vec4<bool>(rf_finite(left.x), rf_finite(left.y), rf_finite(right.x), rf_finite(right.y)))
    || !(du > 0.0)
    || !(dT > 0.0)
    || !(left.y > 0.0)
  ) {
    return vec3<f32>(0.0, 0.0, 0.0);
  }
  let t = clamp((u - left.x) / du, 0.0, 1.0);
  var temp = left.y + t * dT;
  var slope = dT / du;
  if (sample_count >= 3u) {
    let m0 = g6_knot_slope(offset, sample_count, lo);
    let m1 = g6_knot_slope(offset, sample_count, lo + 1u);
    if (!(m0 > 0.0) || !(m1 > 0.0)) { return vec3<f32>(0.0, 0.0, 0.0); }
    let t2 = t * t;
    let t3 = t2 * t;
    let h00 = 2.0 * t3 - 3.0 * t2 + 1.0;
    let h10 = t3 - 2.0 * t2 + t;
    let h01 = -2.0 * t3 + 3.0 * t2;
    let h11 = t3 - t2;
    temp = h00 * left.y + h10 * du * m0 + h01 * right.y + h11 * du * m1;
    let dh00 = 6.0 * t2 - 6.0 * t;
    let dh10 = 3.0 * t2 - 4.0 * t + 1.0;
    let dh01 = -6.0 * t2 + 6.0 * t;
    let dh11 = 3.0 * t2 - 2.0 * t;
    slope = (dh00 * left.y + dh01 * right.y) / du + dh10 * m0 + dh11 * m1;
  }
  if (!rf_finite(temp) || !rf_finite(slope) || !(temp > 0.0) || !(slope > 0.0)) {
    return vec3<f32>(0.0, 0.0, 0.0);
  }
  return vec3<f32>(temp, slope, 1.0);
}
// High-order Gauss-Legendre entropy integral int_{u_a}^{u_b} du / T(u) over C^1 Hermite source.
fn g6_source_entropy_delta(offset: u32, sample_count: u32, u_a: f32, u_b: f32) -> vec2<f32> {
  if (u_b <= u_a) { return vec2<f32>(0.0, 1.0); }
  let gl_x = array<f32, 4>(-0.861136312, -0.339981044, 0.339981044, 0.861136312);
  let gl_w = array<f32, 4>(0.347854845, 0.652145155, 0.652145155, 0.347854845);
  var total = 0.0;
  for (var i = 0u; i + 1u < sample_count; i++) {
    let left = samples[offset + i].xy;
    let right = samples[offset + i + 1u].xy;
    if (right.x <= u_a) { continue; }
    if (left.x >= u_b) { break; }
    let seg_lo = max(left.x, u_a);
    let seg_hi = min(right.x, u_b);
    if (seg_hi <= seg_lo) { continue; }
    let mid = 0.5 * (seg_lo + seg_hi);
    let half = 0.5 * (seg_hi - seg_lo);
    for (var q = 0u; q < 4u; q++) {
      let ev = g6_eval_source_caloric(offset, sample_count, mid + half * gl_x[q]);
      if (ev.z != 1.0) { return vec2<f32>(0.0, 0.0); }
      total += half * gl_w[q] / ev.x;
    }
  }
  return vec2<f32>(total, select(0.0, 1.0, rf_finite(total)));
}
// Each graph gets one fixed-order thread. Fits single-phase solid (1), liquid (2),
// and gas (3) graphs — both single-affine segments and smooth multi-sample
// nonlinear (e.g. Debye) caloric curves — validated across 65 held-out probes.
@compute @workgroup_size(1)
fn fit(@builtin(global_invocation_id) id: vec3<u32>) {
  let g = id.x;
  if(g==0u){atomicStore(&receipt[0u],0x47365031u);atomicStore(&receipt[7u],atomicLoad(&requests[1u]));}
  if (g >= arrayLength(&metadata) / 4u || atomicLoad(&requests[18u+g*4u]) == 0u) { return; }
  atomicAdd(&receipt[1u],1u);
  atomicAdd(&requests[4u], 1u);
  atomicStore(&requests[19u+g*4u], 1u);
  if (g*4u+3u >= arrayLength(&nodes)) { return; }
  let graph_phase = nodes[g*4u+3u].z;
  if (!(graph_phase == 1.0 || graph_phase == 2.0 || graph_phase == 3.0)) { return; }
  let n = nodes[g*4u+1u];
  if (!rf_finite(n.x) || n.x < 0.0 || n.x != floor(n.x) || n.x >= 16777216.0
      || !rf_finite(n.y) || n.y < 2.0 || n.y != floor(n.y) || n.y > 256.0) { return; }
  let offset = u32(n.x);
  let sample_count = u32(n.y);
  if (offset >= arrayLength(&samples) || arrayLength(&samples)-offset < sample_count) { return; }
  let left = samples[offset].xy;
  let right = samples[offset + sample_count - 1u].xy;
  if (!all(vec4<bool>(rf_finite(left.x), rf_finite(left.y), rf_finite(right.x), rf_finite(right.y)))
    || !(right.x > left.x) || !(right.y > left.y) || !(left.y > 0.0)
    || n.z != left.x || n.w != right.x) { return; }
  // Verify strict monotonicity across every subsegment so plateaus reject cleanly.
  for (var s = 0u; s + 1u < sample_count; s++) {
    let a = samples[offset + s].xy;
    let b = samples[offset + s + 1u].xy;
    if (!all(vec4<bool>(rf_finite(a.x), rf_finite(a.y), rf_finite(b.x), rf_finite(b.y)))
      || !(b.x > a.x) || !(b.y > a.y) || !(a.y > 0.0)) { return; }
  }
  atomicOr(&requests[6u], 1u);
  let request_lo = unkey(atomicLoad(&requests[16u+g*4u]));
  let request_hi = unkey(atomicLoad(&requests[17u+g*4u]));
  if (!rf_finite(request_lo) || !rf_finite(request_hi) || request_lo < left.x || request_hi > right.x || request_lo > request_hi) { return; }
  let um = request_lo + (request_hi-request_lo)*0.5;
  var tm = 0.0;
  var cv = 0.0;
  if (sample_count == 2u) {
    let du = right.x - left.x;
    let dT = right.y - left.y;
    cv = du / dT;
    tm = left.y + ((um - left.x) / du) * dT;
  } else {
    let mid = g6_eval_source_caloric(offset, sample_count, um);
    if (mid.z != 1.0) { return; }
    tm = mid.x;
    cv = 1.0 / mid.y;
  }
  let scale = cv*tm;
  let padding = max((request_hi-request_lo)*0.25, scale*0.02);
  let ulo = max(left.x, request_lo-padding); let uhi = min(right.x, request_hi+padding);
  let xlo = (ulo-um)/scale; let xhi = (uhi-um)/scale;
  let max_x_span = select(0.5, 0.25, sample_count == 2u);
  if (!rf_finite(scale) || !(cv > 0.0) || !(tm > 0.0) || !(xhi > xlo) || xlo < -max_x_span || xhi > max_x_span) { return; }
  atomicOr(&requests[6u], 2u);
  let base = u32(table[1]) + g*8u; let record = 4u+g*16u;
  var old_record:array<f32,16>;var old_coefficients:array<f32,8>;
  for(var i=0u;i<16u;i++){old_record[i]=table[record+i];}
  for(var i=0u;i<8u;i++){old_coefficients[i]=table[base+i];}
  if (sample_count == 2u) {
    // Form the coefficients of log(1+x); no source values are read back.
    for (var j=0u; j<8u; j++) {
      var sum = 0.0;
      for (var k=0u; k<8u; k++) {
        let angle = 3.141592653589793*(f32(k)+0.5)/8.0;
        let x = xlo+(cos(angle)+1.0)*0.5*(xhi-xlo);
        let z=x/(2.0+x);let z2=z*z;
        let residual=-x*x/(2.0+x)+2.0*z*z2*(1.0/3.0+z2*(1.0/5.0+z2*(1.0/7.0+z2*(1.0/9.0+z2/11.0))));
        sum += residual*cos(f32(j)*angle);
      }
      table[base+j] = sum*select(0.25, 0.125, j==0u);
    }
    table[base] += (xlo+xhi)*0.5;
    table[base+1u] += (xhi-xlo)*0.5;
  } else {
    // Spectral Chebyshev fit of g'(x) = tm / T_src(um + x*scale) integrated
    // analytically to g(x) with g(xlo) = 0 (exact entropy shift stored in meta3.x).
    var b: array<f32, 8>;
    for (var j=0u; j<8u; j++) {
      var sum = 0.0;
      for (var k=0u; k<8u; k++) {
        let angle = 3.141592653589793*(f32(k)+0.5)/8.0;
        let x = xlo+(cos(angle)+1.0)*0.5*(xhi-xlo);
        let u_k = clamp(um + x * scale, left.x, right.x);
        let ev = g6_eval_source_caloric(offset, sample_count, u_k);
        if (ev.z != 1.0) {
          for(var r=0u;r<16u;r++){table[record+r]=old_record[r];}
          for(var r=0u;r<8u;r++){table[base+r]=old_coefficients[r];}
          return;
        }
        sum += (tm / ev.x) * cos(f32(j) * angle);
      }
      b[j] = sum * select(0.25, 0.125, j == 0u);
    }
    let half_w = 0.5 * (xhi - xlo);
    var a: array<f32, 8>;
    a[1] = half_w * (b[0] - 0.5 * b[2]);
    a[2] = half_w * (b[1] - b[3]) / 4.0;
    a[3] = half_w * (b[2] - b[4]) / 6.0;
    a[4] = half_w * (b[3] - b[5]) / 8.0;
    a[5] = half_w * (b[4] - b[6]) / 10.0;
    a[6] = half_w * (b[5] - b[7]) / 12.0;
    a[7] = half_w * b[6] / 14.0;
    // Shift a[0] so g(xlo) = g(xi = -1) = 0.
    a[0] = -(-a[1] + a[2] - a[3] + a[4] - a[5] + a[6] - a[7]);
    for (var j=0u; j<8u; j++) { table[base+j] = a[j]; }
  }
  table[record] = 1.0; table[record+1u] = f32(g*8u);
  table[record+2u] = 8.0; table[record+3u] = 1.0; table[record+4u] = 1.0;
  table[record+5u] = xlo; table[record+6u] = xhi;
  table[record+7u] = 0.0; table[record+8u] = 1.0;
  table[record+9u] = 0.0; table[record+10u] = 1.0; table[record+11u] = 0.0;
  var valid = true; var t_error = 0.0; var slope_error = 0.0; var entropy_error = 0.0;
  for (var p=0u; p<65u; p++) {
    // Endpoints plus an interior lattice shifted away from fit nodes.
    var fraction = (f32(p)-0.618033989)/63.0;
    if (p==0u) { fraction = 0.0; } if (p==64u) { fraction = 1.0; }
    let x = clamp(xlo + fraction * (xhi - xlo), xlo, xhi);
    let d = rf_eval_differential(g, vec3<f32>(x,0.0,0.0));
    if (d.ok != 1u || !(d.gradient.x > 0.0) || !(d.hessian[0][0] < 0.0)) { valid=false; continue; }
    if (sample_count == 2u) {
      t_error = max(t_error, abs(1.0/d.gradient.x-(1.0+x))/(1.0+x));
      slope_error = max(slope_error, abs(-d.hessian[0][0]/(d.gradient.x*d.gradient.x)-1.0));
      entropy_error = max(entropy_error, abs(d.value-log(1.0+x)));
    } else {
      let u_p = clamp(um + x * scale, left.x, right.x);
      let ev = g6_eval_source_caloric(offset, sample_count, u_p);
      let ent = g6_source_entropy_delta(offset, sample_count, ulo, u_p);
      if (ev.z != 1.0 || ent.y != 1.0) { valid = false; continue; }
      let t_fit = tm / d.gradient.x;
      let slope_fit = -d.hessian[0][0] / (cv * d.gradient.x * d.gradient.x);
      t_error = max(t_error, abs(t_fit - ev.x) / ev.x);
      slope_error = max(slope_error, abs(slope_fit - ev.y) / ev.y);
      entropy_error = max(entropy_error, abs(d.value - ent.x / cv));
    }
  }
  atomicOr(&requests[6u], select(4u, 8u, valid));
  atomicMax(&requests[7u], bitcast<u32>(t_error));
  atomicMax(&requests[8u], bitcast<u32>(slope_error));
  atomicMax(&requests[9u], bitcast<u32>(entropy_error));
  atomicOr(&receipt[3u], select(1u,2u,valid));
  atomicMax(&receipt[4u],bitcast<u32>(t_error));
  atomicMax(&receipt[5u],bitcast<u32>(slope_error));
  atomicMax(&receipt[6u],bitcast<u32>(entropy_error));
  if (!valid || t_error*2.0 > ${THERMAL_POTENTIAL_LIMITS.temperatureRelative}
    || slope_error*2.0 > ${THERMAL_POTENTIAL_LIMITS.slopeRelative}
    || entropy_error*2.0 > ${THERMAL_POTENTIAL_LIMITS.entropyAbsolute}) {
    for(var i=0u;i<16u;i++){table[record+i]=old_record[i];}
    for(var i=0u;i<8u;i++){table[base+i]=old_coefficients[i];}
    return;
  }
  table[record+11u] = entropy_error*2.0;
  var entropy_offset = 0.0;
  if (sample_count == 2u) {
    entropy_offset = cv * log(tm / left.y);
  } else {
    let base_ent = g6_source_entropy_delta(offset, sample_count, left.x, ulo);
    entropy_offset = select(0.0, base_ent.x, base_ent.y == 1.0);
  }
  metadata[g*4u] = vec4<f32>(um,cv,tm,1.0);
  metadata[g*4u+1u] = vec4<f32>(ulo,uhi,t_error*2.0,slope_error*2.0);
  metadata[g*4u+2u] = vec4<f32>(left, right);
  metadata[g*4u+3u] = vec4<f32>(entropy_offset,left.y,entropy_error*2.0,graph_phase);
  atomicStore(&requests[19u+g*4u], 2u);
  atomicAdd(&requests[5u], 1u);
  atomicAdd(&receipt[2u],1u);
}
`;

function live(cache, device, upload) {
  const r = caches.get(cache);
  if (!r || r.closed || r.device !== device || r.upload !== upload || upload.destroyed
    || sourceFields.some(k => upload[k] !== r.source[k])) throw new Error('G6 thermal source/cache identity is stale');
  return r;
}
function generationReservationLive(r,gen) {
  if(!gen.reservation)return true;
  const f=r.ledger.fence(gen.reservation.key);
  return !r.ledger.destroyed && f.state==='consumed' && f.epoch===gen.reservation.epoch && f.owner===gen.reservation.owner;
}
function requireGenerationReservation(r,gen) {
  if(!generationReservationLive(r,gen))throw new Error('G6 reservation revoked');
}
function isRealWebGpuDevice(device) {
  return typeof globalThis.GPUDevice === 'function' && device instanceof globalThis.GPUDevice;
}
function allocation(r) {
  if (r.generations.size >= THERMAL_POTENTIAL_LIMITS.maxGenerations) throw new Error('G6 generation capacity exhausted');
  const buffer = (label, size) => r.device.createBuffer({ label, size, usage: 0x80|0x08|0x04 });
  const slot = [0,1,2].find(i=>![...r.generations].some(g=>g.slot===i));
  const gen = {slot,refs:0,retired:false,destroyed:false,bindGroup:null,receiptRead:null,receiptCopied:false};
  try {
    gen.table=buffer('g6-potential-table',(4+r.count*24)*4);
    gen.metadata=buffer('g6-potential-metadata',r.count*64);
    gen.receipt=buffer('g6-potential-receipt',32);
    if (isRealWebGpuDevice(r.device)) {
      gen.receiptRead=r.device.createBuffer({ label:'g6-potential-receipt-read', size:32, usage:1|8 });
    }
    r.device.queue.writeBuffer(gen.table,0,new Float32Array([r.count,4+r.count*16,0,0]));
    r.generations.add(gen);return gen;
  }catch(error){gen.table?.destroy();gen.metadata?.destroy();gen.receipt?.destroy();gen.receiptRead?.destroy();throw error;}
}
function collect(r, gen) {
  if (!gen.retired || gen.refs || gen.destroyed) return;
  gen.destroyed=true;
  gen.bindGroup=null;
  gen.table.destroy(); gen.metadata.destroy(); gen.receipt.destroy(); gen.receiptRead?.destroy(); r.generations.delete(gen);
  if(gen.reservation)releaseReservation(r,{token:gen.reservation});
  if (r.closed && r.generations.size === 0) r.requests.destroy();
}
function releaseReservation(r, c) {
  const f = r.ledger.fence(c.token.key);
  if(f?.state==='reserved'){r.ledger.cancel(c.token);return;}
  if (f?.epoch === c.token.epoch && f?.owner === c.token.owner) {
    r.ledger.retire(c.token.key, { expectedEpoch: c.token.epoch });
  }
}
export function createThermalPotentialGpu(device, { thermalResponseGraphUpload: upload, reservationLedger } = {}) {
  if (!thermalResponseGraphUploadMatchesDevice(upload,device) || !upload.contentFingerprint
    || !Number.isInteger(upload.graphCount) || upload.graphCount<1 || upload.graphCount>THERMAL_POTENTIAL_LIMITS.maxGraphs) {
    throw new TypeError('G6 requires the original bounded thermal graph upload');
  }
  if (!reservationLedger || ['reserve','commit','cancel','retire','fence'].some(k=>typeof reservationLedger[k]!=='function')) {
    throw new TypeError('G6 requires the G5 reservation ledger');
  }
  const r = { device, upload, source: Object.fromEntries(sourceFields.map(k=>[k,upload[k]])),
    count: upload.graphCount, ledger: reservationLedger, owner:`ulg-g6-thermal-${nextOwner++}`,
    generations:new Set(), ordinal:0, closed:false, pending:null };
  try {
  r.requests=device.createBuffer({ label:'g6-potential-requests',size:(16+r.count*4)*4,usage:0x80|0x08|0x04 });
  const module=device.createShaderModule({label:'g6-thermal-potential-fit',code:thermalPotentialFitWgsl});
  const layout=device.createBindGroupLayout({entries:[0,1,2,3,4,5].map(binding=>({binding,visibility:4,buffer:{type:binding<2?'read-only-storage':'storage'}}))});
  const pipelineLayout=device.createPipelineLayout({bindGroupLayouts:[layout]});
  r.layout=layout;
  r.pipelines=Object.fromEntries(['reset','fit','clear_misses'].map(entryPoint=>[entryPoint,device.createComputePipeline({layout:pipelineLayout,compute:{module,entryPoint}})]));
  r.current=allocation(r);
  const cache=Object.freeze({schema:THERMAL_POTENTIAL_SCHEMA}); caches.set(cache,r);
  const encoder=device.createCommandEncoder(); encodeReset(r,encoder,r.current); device.queue.submit([encoder.finish()]);
  device.lost?.then(()=>destroyThermalPotentialGpu(cache),()=>destroyThermalPotentialGpu(cache));
  return cache;
  }catch(error){r.closed=true;for(const g of r.generations){g.retired=true;collect(r,g);}r.requests?.destroy();throw error;}
}
function dispatch(r,encoder,gen,entry) {
  if (!gen.bindGroup) {
    const buffers=[r.source.graphNodeBuffer,r.source.graphSampleBuffer,r.requests,gen.table,gen.metadata,gen.receipt];
    gen.bindGroup=r.device.createBindGroup({layout:r.layout,entries:buffers.map((buffer,binding)=>({binding,resource:{buffer}}))});
  }
  const pass=encoder.beginComputePass({label:`g6-potential-${entry}`});pass.setPipeline(r.pipelines[entry]);pass.setBindGroup(0,gen.bindGroup);
  pass.dispatchWorkgroups(entry==='fit'?r.count:Math.ceil(Math.max(16,r.count)/64));pass.end();
}
function encodeReset(r,encoder,gen) { dispatch(r,encoder,gen,'reset'); }
export function thermalPotentialGpuBindings(cache, device, upload) {
  const r=live(cache,device,upload), gen=r.current;
  requireGenerationReservation(r,gen);
  return Object.freeze({table:gen.table,metadata:gen.metadata,requests:r.requests,ordinal:r.ordinal,
    retain() { if(r.current!==gen)throw new Error('G6 generation changed during preparation');return retainThermalPotentialGpu(cache,device,upload); }});
}
export function retainThermalPotentialGpu(cache, device, upload) {
  const r=live(cache,device,upload), gen=r.current;requireGenerationReservation(r,gen);gen.refs++;
  let released=false;
  return Object.freeze({table:gen.table,metadata:gen.metadata,requests:r.requests,ordinal:r.ordinal,
    assertLive() { live(cache,device,upload); if(released) throw new Error('G6 consumer lease released');
      requireGenerationReservation(r,gen); },
    release() { if(released)return; released=true;gen.refs--;collect(r,gen); }});
}
export function encodeThermalPotentialCandidateGpu(cache, encoder) {
  const r=caches.get(cache);live(cache,r?.device,r?.upload);
  requireGenerationReservation(r,r.current);
  if(r.pending) throw new Error('G6 derive already pending');
  const slot=[0,1,2].find(i=>![...r.generations].some(g=>g.slot===i));
  if(slot===undefined)throw Object.assign(new Error('G6 generation capacity exhausted'),{code:'ERR_G6_FIT_CAPACITY'});
  const key=`${THERMAL_POTENTIAL_SCHEMA}:${r.source.contentFingerprint}:${slot}`;
  const reserved=r.ledger.reserve({key,consumerId:r.owner});
  if(!reserved.ok) throw Object.assign(new Error(`G6 reservation refused: ${reserved.reason}`),{code:'ERR_G6_FIT_CAPACITY'});
  let gen;
  try {
    gen=allocation(r);
    encoder.copyBufferToBuffer(r.current.table,0,gen.table,0,(4+r.count*24)*4);
    encoder.copyBufferToBuffer(r.current.metadata,0,gen.metadata,0,r.count*64);
    dispatch(r,encoder,gen,'fit');
    dispatch(r,encoder,gen,'clear_misses');
    if (gen.receiptRead) {
      encoder.copyBufferToBuffer(gen.receipt,0,gen.receiptRead,0,32);
      gen.receiptCopied=true;
    }
  } catch(error) { if(gen){gen.retired=true;collect(r,gen);}r.ledger.cancel(reserved.token);throw error; }
  const candidate=Object.freeze({schema:THERMAL_POTENTIAL_SCHEMA});
  const c={r,cache,gen,encoder,parent:r.current,token:reserved.token,ready:false,submitted:false,settled:false,attached:false};
  candidates.set(candidate,c);r.pending=c;return candidate;
}
export function submitThermalPotentialCandidateGpu(candidate) {
  const c=candidates.get(candidate);if(!c||c.submitted||c.settled)throw new Error('G6 candidate submission refused');
  live(c.cache,c.r.device,c.r.upload);
  try{c.r.device.queue.submit([c.encoder.finish()]);c.submitted=true;c.encoder=null;
    c.gen.refs++;
    const release=()=>{c.gen.refs--;collect(c.r,c.gen);};
    c.r.device.queue.onSubmittedWorkDone().then(release,release);
  }
  catch(error){settle(c,false);throw error;}
}
export async function completeThermalPotentialCandidateGpu(candidate) {
  const c=candidates.get(candidate);if(!c||c.settled)throw new Error('G6 candidate unavailable');
  if(!c.submitted)throw new Error('G6 candidate was not submitted');
  c.completion ??= completeCandidateReceipt(c);
  return c.completion;
}
async function completeCandidateReceipt(c) {
  c.gen.refs++;
  let read = null;
  let ownedRead = false;
  try{
    if (c.gen.receiptRead && c.gen.receiptCopied) {
      read = c.gen.receiptRead;
    } else {
      read=c.r.device.createBuffer({size:32,usage:1|8});
      ownedRead = true;
      const encoder=c.r.device.createCommandEncoder();encoder.copyBufferToBuffer(c.gen.receipt,0,read,0,32);
      c.r.device.queue.submit([encoder.finish()]);
    }
    await read.mapAsync(1);
    const words=new Uint32Array(read.getMappedRange().slice(0, 32));
    read.unmap?.();
    if(words[0]!==0x47365031||words[1]===0||words[2]===0){
      const error=new Error(`G6 GPU candidate validation refused: ${Array.from(words)}`);
      if(words[0]===0x47365031){error.code='ERR_G6_NO_VALID_FIT';error.cumulativeConsumerHits=words[7];}
      throw error;
    }
    live(c.cache,c.r.device,c.r.upload);
    requireGenerationReservation(c.r,c.parent);
    if(c.settled)throw new Error('G6 candidate cancelled');c.ready=true;
    return Object.freeze({cumulativeConsumerHits:words[7]});
  }catch(error){settle(c,false);throw error;}
  finally{if(ownedRead)read?.destroy();c.gen.refs--;collect(c.r,c.gen);}
}
export function attachThermalPotentialCandidateToDelta(candidate,delta) {
  const c=candidates.get(candidate);
  if(!c||!c.ready||c.settled||c.attached||!delta||typeof delta!=='object'||deltas.has(delta)) throw new Error('G6 delta attachment refused');
  live(c.cache,c.r.device,c.r.upload);c.attached=true;deltas.set(delta,c);
}
// A worker retains the candidate privately. Only the exact descriptor persisted
// by the page StateManager can acknowledge it for a named subsequent schedule.
// This is separate from same-realm delta identity; structured-cloned deltas
// still cannot settle the original same-realm association.
export function bindThermalPotentialCandidateToWorkerSchedule(candidate, identity) {
  const c=candidates.get(candidate);
  if(!c||!c.ready||c.settled||c.attached)throw new Error('G6 worker binding refused');
  live(c.cache,c.r.device,c.r.upload);
  const receipt=Object.freeze({schema:THERMAL_POTENTIAL_WORKER_CANDIDATE,
    candidateId:globalThis.crypto.randomUUID(), scheduleId:identity?.scheduleId,
    laneId:identity?.laneId,stateKey:identity?.stateKey,lineageKey:identity?.lineageKey,
    sourceFingerprint:c.r.source.contentFingerprint,parentOrdinal:c.r.ordinal});
  if(!isThermalPotentialWorkerCandidate(receipt))throw new TypeError('G6 worker schedule identity required');
  c.attached=true;c.workerReceipt=receipt;return receipt;
}
export function acceptThermalPotentialWorkerCandidate(candidate, acknowledgement, targetScheduleId) {
  const c=candidates.get(candidate);
  if(!c||c.settled||!c.workerReceipt||acknowledgement?.schema!==THERMAL_POTENTIAL_WORKER_ACK
    ||acknowledgement.status!=='state-manager-committed'
    ||typeof targetScheduleId!=='string'||!targetScheduleId
    ||targetScheduleId===c.workerReceipt.scheduleId||acknowledgement.targetScheduleId!==targetScheduleId
    ||!thermalPotentialWorkerCandidateEquals(acknowledgement.candidate,c.workerReceipt))return false;
  return settle(c,true);
}
// Called only by the existing resident StateManager commit bridge. Identity is
// private; cloning a delta cannot carry its candidate or grant adoption.
export function settleThermalPotentialDelta(delta,accepted) {
  const c=deltas.get(delta);if(!c)return false;deltas.delete(delta);return settle(c,accepted);
}
function settle(c,accepted) {
  if(c.settled)return false;c.settled=true;c.encoder=null;const r=c.r;
  let valid=false;
  try {live(c.cache,r.device,r.upload);valid=c.ready&&r.pending===c&&r.current===c.parent&&generationReservationLive(r,c.parent);} catch {}
  const committed=accepted&&valid&&r.ledger.commit(c.token,{admissionId:`g6:${r.ordinal+1}`});
  try{live(c.cache,r.device,r.upload);valid=valid&&r.pending===c&&r.current===c.parent&&generationReservationLive(r,c.parent);}catch{valid=false;}
  const fence=r.ledger.fence(c.token.key);
  valid=Boolean(valid && committed?.ok && fence?.epoch===c.token.epoch && fence?.owner===c.token.owner && fence?.state==='consumed' && !r.closed);
  if(r.pending===c)r.pending=null;
  if(valid){const old=r.current;c.gen.reservation=c.token;r.current=c.gen;r.ordinal++;old.retired=true;collect(r,old);}
  else {c.gen.retired=true;collect(r,c.gen);releaseReservation(r,c);}
  return valid;
}
export function cancelThermalPotentialCandidateGpu(candidate) {const c=candidates.get(candidate);return c?settle(c,false):false;}
export function destroyThermalPotentialGpu(cache) {
  const r=caches.get(cache);if(!r||r.closed)return;r.closed=true;
  if(r.pending)settle(r.pending,false);
  for(const g of r.generations){g.retired=true;collect(r,g);}
}
