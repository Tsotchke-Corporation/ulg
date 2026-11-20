import { computeBufferBinding, createCachedExplicitComputePipeline } from '../webgpuComputeLayout.js';
import { createSphExactMassWgsl } from './sphExactMassWgsl.js';
import { createSphExactLedgerWgsl, createSphExactLedgerScatterWgsl } from './sphExactLedgerWgsl.js';
import { SPH_EXACT_THERMAL_ENERGY_FORMAT } from './sphExactThermalEnergyWgsl.js';

// G3 SOL-0 (plan/todo/sol-critic.md, plan/todo/g3-solids-proposal.md):
// GPU-resident coherent rigid bodies.
//
// Records (f32/u32 words):
//   frame  peercompute.ulg.schroeder-solid-frame.v0, 32 words per body
//     0  x, y, z (centre of mass, world/chart-local), mass
//     4  quaternion (x, y, z, w): body (principal) frame -> world
//     8  linear momentum P (world), unused
//     12 angular momentum L (world), unused
//     16 principal moments I1, I2, I3, unused (body frame = principal frame)
//     20 bodyId, componentGeneration, memberOffset, memberCount (u32)
//     24 proxyOffset, proxyCount, shapeKey, status (u32)
//     28 reserved
//   member peercompute.ulg.schroeder-solid-member.v0, 8 words per member
//     0  rest x, y, z (principal body frame, about the centre of mass), mass
//     4  bodyId (u32), member id (u32), unused, unused
//   member world rows (written by regenerate_members), 8 words per member
//     0  world x, y, z, mass;  4  world velocity x, y, z, unused
//
// Mass and inertia belong to the members only; contact proxies and shape
// carriers never change them. The rigid body is integrated once per step:
// a half kick of the external wrench, translation, a Dullweber-Leimkuhler-
// McLachlan (1997) symmetric splitting of the free rotation about the
// principal axes (1, 2, 3, 2, 1), and the second half kick. World angular
// momentum is the integrated variable, so a torque-free body conserves it by
// construction; the splitting is symplectic and time-reversible, so the
// kinetic energy error stays bounded without secular drift. Members are
// regenerated from the frame, never advected independently.
//
// The invariant reductions (mass, first moment, linear and angular momentum,
// world inertia) scatter each member's f32 contribution into exact integer
// counters (sphExactLedgerWgsl): every product is rounded once in f32, and
// the sums are exact, so the results do not depend on member order,
// workgroup size or dispatch partition.
export const SCHROEDER_SOLID_FRAME_SCHEMA = 'peercompute.ulg.schroeder-solid-frame.v0';
export const SCHROEDER_SOLID_MEMBER_SCHEMA = 'peercompute.ulg.schroeder-solid-member.v0';
export const SCHROEDER_SOLID_FRAME_WORDS = 32;
export const SCHROEDER_SOLID_MEMBER_WORDS = 8;
// Reduction rows per body: mass, first moment (3), linear momentum (3),
// angular momentum about the frame centre (3), world inertia about the frame
// centre (xx, yy, zz, xy, xz, yz).
export const SCHROEDER_SOLID_REDUCTION_ROWS = 16;
const FORMAT = SPH_EXACT_THERMAL_ENERGY_FORMAT;
const COUNTER_WORDS_PER_ROW = 4 * FORMAT.wordCount;
const GPU_BUFFER_USAGE = Object.freeze({ STORAGE: 0x80, UNIFORM: 0x40, COPY_SRC: 0x04, COPY_DST: 0x08 });

/** The rigid-lane WGSL; `workgroupSize` only changes the member dispatch shape. */
export function schroederSolidRigidWgsl({ workgroupSize = 64 } = {}) {
  if (![16, 32, 64, 128, 256].includes(workgroupSize)) throw new RangeError('Unsupported rigid workgroup size');
  return /* wgsl */ `
${createSphExactMassWgsl(FORMAT)}
${createSphExactLedgerWgsl(FORMAT)}
${createSphExactLedgerScatterWgsl(FORMAT, { prefix: 'rr', counters: 'reduction_counters' })}
${createSphExactLedgerScatterWgsl(FORMAT, { prefix: 'cc', counters: 'contact_counters' })}
struct RigidParams {
  // body_count, member_count, proxy_count, unused
  counts: vec4<u32>,
  // gravity xyz, dt
  gravity_dt: vec4<f32>,
  // external torque xyz (world, applied to every body; driven-rotation gate), unused
  torque: vec4<f32>,
  // box xyz (walls at 0 and box), unused
  box: vec4<f32>,
  // restitution, friction coefficient, Baumgarte factor, penetration slop (m)
  contact: vec4<f32>,
  // restitution threshold speed (m/s), body-body reach speed (m/s), unused...
  contact2: vec4<f32>,
};
@group(0) @binding(0) var<uniform> params: RigidParams;
@group(0) @binding(1) var<storage, read_write> frames: array<vec4<f32>>;
@group(0) @binding(2) var<storage, read_write> members: array<vec4<f32>>;
@group(0) @binding(3) var<storage, read_write> member_world: array<vec4<f32>>;
@group(0) @binding(4) var<storage, read_write> reduction_counters: array<atomic<u32>>;
@group(0) @binding(5) var<storage, read_write> reductions: array<u32>;
// Contact proxies, 8 words: body-frame position xyz, radius; bodyId (u32), member id, unused, unused.
@group(0) @binding(6) var<storage, read_write> proxies: array<vec4<f32>>;
// Per-proxy accumulators, 16 words. Wall contact: normal impulse, approach
// speed at step start, wall tag, unused; tangential impulse xyz, unused. Body
// contact (SOL-2): normal impulse, approach speed, partner proxy + 1, unused;
// tangential impulse xyz, unused.
@group(0) @binding(7) var<storage, read_write> proxy_state: array<vec4<f32>>;
@group(0) @binding(8) var<storage, read_write> contact_counters: array<atomic<u32>>;
// Cumulative exact contact impulse per body (3 rows of EM_WORDS): the
// reaction on the walls is its negative.
@group(0) @binding(9) var<storage, read_write> impulse_ledger: array<u32>;
// Per body, 4 vec4: the seed lattice axes in the body frame (3) and the pitch.
@group(0) @binding(10) var<storage, read_write> lattice: array<vec4<f32>>;
// Per body, 8 vec4: the rebased frame (flag in rebase[base + 7].x).
@group(0) @binding(11) var<storage, read_write> rebase: array<vec4<f32>>;

const FRAME_VEC4: u32 = ${SCHROEDER_SOLID_FRAME_WORDS / 4}u;
const MEMBER_VEC4: u32 = ${SCHROEDER_SOLID_MEMBER_WORDS / 4}u;
const ROWS: u32 = ${SCHROEDER_SOLID_REDUCTION_ROWS}u;

fn quat_mul(a: vec4<f32>, b: vec4<f32>) -> vec4<f32> {
  return vec4<f32>(
    a.w * b.xyz + b.w * a.xyz + cross(a.xyz, b.xyz),
    a.w * b.w - dot(a.xyz, b.xyz));
}
fn quat_rotate(q: vec4<f32>, v: vec3<f32>) -> vec3<f32> {
  let t = 2.0 * cross(q.xyz, v);
  return v + q.w * t + cross(q.xyz, t);
}
fn quat_rotate_inverse(q: vec4<f32>, v: vec3<f32>) -> vec3<f32> {
  return quat_rotate(vec4<f32>(-q.xyz, q.w), v);
}
// A rotation of the body about its own principal axis k by theta: q <- q * r.
fn axis_quat(k: u32, theta: f32) -> vec4<f32> {
  let s = sin(0.5 * theta);
  var axis = vec3<f32>(0.0);
  axis[k] = s;
  return vec4<f32>(axis, cos(0.5 * theta));
}
// Body-frame angular momentum under the body's rotation about axis k by
// theta: pi <- Rot(k, -theta) pi.
fn rotate_pi(pi: vec3<f32>, k: u32, theta: f32) -> vec3<f32> {
  let c = cos(theta); let s = sin(theta);
  var out = pi;
  let a = (k + 1u) % 3u; let b = (k + 2u) % 3u;
  out[a] = c * pi[a] + s * pi[b];
  out[b] = -s * pi[a] + c * pi[b];
  return out;
}
fn free_rotation_substep(state: ptr<function, vec4<f32>>, pi: ptr<function, vec3<f32>>,
    inertia: vec3<f32>, k: u32, h: f32) {
  let theta = h * (*pi)[k] / inertia[k];
  *state = quat_mul(*state, axis_quat(k, theta));
  *pi = rotate_pi(*pi, k, theta);
}

@compute @workgroup_size(64)
fn integrate_bodies(@builtin(global_invocation_id) id: vec3<u32>) {
  let body = id.x;
  if (body >= params.counts.x) { return; }
  let base = body * FRAME_VEC4;
  let f0 = frames[base]; var q = frames[base + 1u]; var p = frames[base + 2u].xyz;
  var l = frames[base + 3u].xyz; let inertia = frames[base + 4u].xyz;
  let mass = f0.w; let h = params.gravity_dt.w;
  if (!(mass > 0.0) || !(h > 0.0)) { return; }
  // Half kick: gravity acts at the centre of mass (no torque); the uniform
  // torque parameter drives rotation for the GPU gates.
  let force = mass * params.gravity_dt.xyz;
  p = p + 0.5 * h * force;
  l = l + 0.5 * h * params.torque.xyz;
  let x = f0.xyz + h * p / mass;
  // Free rotation: world L fixed; body-frame pi rotates with the body.
  var pi = quat_rotate_inverse(q, l);
  free_rotation_substep(&q, &pi, inertia, 0u, 0.5 * h);
  free_rotation_substep(&q, &pi, inertia, 1u, 0.5 * h);
  free_rotation_substep(&q, &pi, inertia, 2u, h);
  free_rotation_substep(&q, &pi, inertia, 1u, 0.5 * h);
  free_rotation_substep(&q, &pi, inertia, 0u, 0.5 * h);
  q = q / length(q);
  p = p + 0.5 * h * force;
  l = l + 0.5 * h * params.torque.xyz;
  frames[base] = vec4<f32>(x, mass);
  frames[base + 1u] = q;
  frames[base + 2u] = vec4<f32>(p, 0.0);
  frames[base + 3u] = vec4<f32>(l, 0.0);
}

fn body_angular_velocity(base: u32) -> vec3<f32> {
  let q = frames[base + 1u]; let l = frames[base + 3u].xyz; let inertia = frames[base + 4u].xyz;
  return quat_rotate(q, quat_rotate_inverse(q, l) / inertia);
}

// ---- Contact path (bodies with proxies): kick, K projected-Jacobi contact
// iterations against the six box walls, then drift. Symplectic Euler.
const CROWS: u32 = 6u;
fn contact_count_word(body: u32) -> u32 { return params.counts.x * CROWS * ${COUNTER_WORDS_PER_ROW}u + body; }

@compute @workgroup_size(64)
fn kick_bodies(@builtin(global_invocation_id) id: vec3<u32>) {
  let body = id.x;
  if (body >= params.counts.x) { return; }
  let base = body * FRAME_VEC4;
  let mass = frames[base].w; let h = params.gravity_dt.w;
  if (!(mass > 0.0) || !(h > 0.0)) { return; }
  frames[base + 2u] = vec4<f32>(frames[base + 2u].xyz + h * mass * params.gravity_dt.xyz, 0.0);
  frames[base + 3u] = vec4<f32>(frames[base + 3u].xyz + h * params.torque.xyz, 0.0);
  // Word 29 counts contact iterations within the step.
  let w7 = frames[base + 7u];
  frames[base + 7u] = vec4<f32>(w7.x, bitcast<f32>(0u), w7.z, w7.w);
}

fn world_inverse_inertia(q: vec4<f32>, inertia: vec3<f32>, a: vec3<f32>) -> vec3<f32> {
  return quat_rotate(q, quat_rotate_inverse(q, a) / inertia);
}

struct ProxyGeometry {
  body: u32, base: u32, wall: u32, valid: u32,
  r: vec3<f32>, gap: f32,
  normal: vec3<f32>, vn: f32,
  vp: vec3<f32>, mass: f32,
};
// World geometry of proxy i against its nearest wall (the box is [0, box]).
fn proxy_geometry(i: u32) -> ProxyGeometry {
  var g: ProxyGeometry;
  let proxy = proxies[i * 2u];
  g.body = bitcast<u32>(proxies[i * 2u + 1u].x);
  if (body_out_of_range(g.body)) { g.valid = 0u; return g; }
  // A released (melted) member no longer touches anything.
  let owner = bitcast<u32>(proxies[i * 2u + 1u].y);
  if (!(members[owner * MEMBER_VEC4].w > 0.0)) { g.valid = 0u; return g; }
  g.valid = 1u; g.base = g.body * FRAME_VEC4;
  let f0 = frames[g.base]; let q = frames[g.base + 1u];
  g.mass = f0.w;
  g.r = quat_rotate(q, proxy.xyz);
  let p = f0.xyz + g.r; let radius = proxy.w;
  g.vp = frames[g.base + 2u].xyz / g.mass + cross(body_angular_velocity(g.base), g.r);
  g.normal = vec3<f32>(0.0, 1.0, 0.0); g.gap = p.y - radius; g.wall = 0u;
  var candidates = array<vec4<f32>, 5>(
    vec4<f32>(0.0, -1.0, 0.0, params.box.y - p.y - radius),
    vec4<f32>(1.0, 0.0, 0.0, p.x - radius), vec4<f32>(-1.0, 0.0, 0.0, params.box.x - p.x - radius),
    vec4<f32>(0.0, 0.0, 1.0, p.z - radius), vec4<f32>(0.0, 0.0, -1.0, params.box.z - p.z - radius));
  for (var k = 0u; k < 5u; k++) {
    if (candidates[k].w < g.gap) { g.gap = candidates[k].w; g.normal = candidates[k].xyz; g.wall = k + 1u; }
  }
  g.vn = dot(g.vp, g.normal);
  return g;
}
fn body_out_of_range(body: u32) -> bool { return body >= params.counts.x; }
fn scatter_contact_impulse(body: u32, r: vec3<f32>, impulse: vec3<f32>) {
  let angular = cross(r, impulse);
  let row = body * CROWS;
  var error = 0u;
  error |= cc_scatter_f32(row, bitcast<u32>(impulse.x)); error |= cc_scatter_f32(row + 1u, bitcast<u32>(impulse.y));
  error |= cc_scatter_f32(row + 2u, bitcast<u32>(impulse.z)); error |= cc_scatter_f32(row + 3u, bitcast<u32>(angular.x));
  error |= cc_scatter_f32(row + 4u, bitcast<u32>(angular.y)); error |= cc_scatter_f32(row + 5u, bitcast<u32>(angular.z));
  if (error != 0u) { atomicOr(&contact_counters[contact_count_word(params.counts.x)], error << 16u); }
}

// Warm start: a proxy still near the same wall keeps last step's accumulated
// normal and friction impulses and applies them before the iterations, so a
// resting load is carried from step to step instead of rebuilt from zero
// (which leaves residual slip and rocking). Otherwise its state resets. The
// approach speed for restitution is recorded here, before any impulse.
@compute @workgroup_size(64)
fn warm_start_proxies(@builtin(global_invocation_id) id: vec3<u32>) {
  let i = id.x;
  if (i >= params.counts.z) { return; }
  let g = proxy_geometry(i);
  if (g.valid == 0u) { return; }
  var state0 = proxy_state[i * 4u]; var state1 = proxy_state[i * 4u + 1u];
  let radius = proxies[i * 2u].w;
  let near = g.gap <= params.contact.w + 0.25 * radius;
  if (u32(state0.z) != g.wall + 1u || !near) {
    proxy_state[i * 4u] = vec4<f32>(0.0, g.vn, f32(g.wall + 1u), 0.0);
    proxy_state[i * 4u + 1u] = vec4<f32>(0.0);
    return;
  }
  proxy_state[i * 4u] = vec4<f32>(state0.x, g.vn, state0.z, 0.0);
  if (state0.x > 0.0) {
    atomicAdd(&contact_counters[contact_count_word(g.body)], 1u);
    scatter_contact_impulse(g.body, g.r, state0.x * g.normal + state1.xyz);
  }
}

@compute @workgroup_size(64)
fn contact_proxies(@builtin(global_invocation_id) id: vec3<u32>) {
  let i = id.x;
  if (i >= params.counts.z) { return; }
  let g = proxy_geometry(i);
  if (g.valid == 0u) { return; }
  let q = frames[g.base + 1u]; let inertia = frames[g.base + 4u].xyz;
  let h = params.gravity_dt.w;
  let previous_count = max(bitcast<u32>(frames[g.base + 7u].x), 1u);
  let state0 = proxy_state[i * 4u]; let state1 = proxy_state[i * 4u + 1u];
  // Speculative contact: a proxy that cannot reach the wall this step and
  // holds no impulse is inactive.
  if (g.gap > 0.0 && g.gap + h * min(g.vn, 0.0) > 0.0 && state0.x == 0.0) { return; }
  atomicAdd(&contact_counters[contact_count_word(g.body)], 1u);
  // Normal target: close a positive gap within the step; push out a
  // penetration beyond the slop (Baumgarte); Newton restitution of the
  // approach speed at the step's start above the threshold.
  var normal_target = -g.gap / h;
  if (g.gap < 0.0) { normal_target = params.contact.z * max(-g.gap - params.contact.w, 0.0) / h; }
  if (state0.y < -params.contact2.x) { normal_target = max(normal_target, -params.contact.x * state0.y); }
  let rn = cross(g.r, g.normal);
  let kn = 1.0 / g.mass + dot(rn, world_inverse_inertia(q, inertia, rn));
  let share = f32(previous_count);
  let lambda_old = state0.x;
  let lambda_new = max(lambda_old + (normal_target - g.vn) / (kn * share), 0.0);
  let dn = lambda_new - lambda_old;
  // Coulomb friction on the accumulated tangential impulse.
  let vt = g.vp - g.vn * g.normal;
  var dt_vec = vec3<f32>(0.0);
  let vt_len = length(vt);
  var tangential = state1.xyz;
  let limit = params.contact.y * lambda_new;
  if (vt_len > 1.0e-9) {
    let t = vt / vt_len; let rt = cross(g.r, t);
    let kt = 1.0 / g.mass + dot(rt, world_inverse_inertia(q, inertia, rt));
    tangential = tangential - t * (vt_len / (kt * share));
  }
  let c_len = length(tangential);
  if (c_len > limit) { tangential = tangential * (limit / max(c_len, 1.0e-30)); }
  dt_vec = tangential - state1.xyz;
  proxy_state[i * 4u] = vec4<f32>(lambda_new, state0.y, state0.z, 0.0);
  proxy_state[i * 4u + 1u] = vec4<f32>(tangential, 0.0);
  scatter_contact_impulse(g.body, g.r, dn * g.normal + dt_vec);
}

// ---- SOL-2 body-body contact. Each proxy pairs with its nearest proxy on
// another body; the lower proxy index owns the pair, so every pair is solved
// once. Equal and opposite impulses are scattered exactly into both bodies,
// so the system's linear momentum is conserved bit-exactly and its angular
// momentum to f32 rounding of the lever arms. The partner is found once per
// step (warm_start_pairs, O(P^2 / 2)) and reused by the iterations.
fn proxy_alive(i: u32) -> bool {
  let body = bitcast<u32>(proxies[i * 2u + 1u].x);
  if (body_out_of_range(body)) { return false; }
  return members[bitcast<u32>(proxies[i * 2u + 1u].y) * MEMBER_VEC4].w > 0.0;
}
fn proxy_body(i: u32) -> u32 { return bitcast<u32>(proxies[i * 2u + 1u].x); }
fn proxy_lever(i: u32) -> vec3<f32> {
  return quat_rotate(frames[proxy_body(i) * FRAME_VEC4 + 1u], proxies[i * 2u].xyz);
}
fn proxy_world_point(i: u32) -> vec3<f32> { return frames[proxy_body(i) * FRAME_VEC4].xyz + proxy_lever(i); }
fn proxy_point_velocity(i: u32, r: vec3<f32>) -> vec3<f32> {
  let base = proxy_body(i) * FRAME_VEC4;
  return frames[base + 2u].xyz / frames[base].w + cross(body_angular_velocity(base), r);
}
struct PairGeometry {
  valid: u32, a: u32, b: u32, unused: u32,
  ra: vec3<f32>, gap: f32,
  rb: vec3<f32>, vn: f32,
  normal: vec3<f32>, k: f32,
  vrel: vec3<f32>, unused2: f32,
};
fn pair_geometry(i: u32, j: u32) -> PairGeometry {
  var g: PairGeometry;
  g.valid = 0u;
  if (j >= params.counts.z || !proxy_alive(i) || !proxy_alive(j)) { return g; }
  g.a = proxy_body(i); g.b = proxy_body(j);
  if (g.a == g.b) { return g; }
  let xa = frames[g.a * FRAME_VEC4].xyz; let xb = frames[g.b * FRAME_VEC4].xyz;
  let pa = xa + proxy_lever(i); let pb = xb + proxy_lever(j);
  let d = pa - pb;
  let dist = length(d);
  if (!(dist > 1.0e-9)) { return g; }
  g.normal = d / dist;
  let radius_b = proxies[j * 2u].w;
  g.gap = dist - proxies[i * 2u].w - radius_b;
  // One shared application point (midway between the sphere surfaces) for
  // both bodies, so friction carries no spurious torque: c x J - c x J = 0.
  let contact = pb + g.normal * (radius_b + 0.5 * g.gap);
  g.ra = contact - xa; g.rb = contact - xb;
  g.vrel = proxy_point_velocity(i, g.ra) - proxy_point_velocity(j, g.rb);
  g.vn = dot(g.vrel, g.normal);
  let qa = frames[g.a * FRAME_VEC4 + 1u]; let ia = frames[g.a * FRAME_VEC4 + 4u].xyz;
  let qb = frames[g.b * FRAME_VEC4 + 1u]; let ib = frames[g.b * FRAME_VEC4 + 4u].xyz;
  let rna = cross(g.ra, g.normal); let rnb = cross(g.rb, g.normal);
  g.k = 1.0 / frames[g.a * FRAME_VEC4].w + 1.0 / frames[g.b * FRAME_VEC4].w
    + dot(rna, world_inverse_inertia(qa, ia, rna)) + dot(rnb, world_inverse_inertia(qb, ib, rnb));
  g.valid = 1u;
  return g;
}
fn pair_tangent_k(g: PairGeometry, t: vec3<f32>) -> f32 {
  let qa = frames[g.a * FRAME_VEC4 + 1u]; let ia = frames[g.a * FRAME_VEC4 + 4u].xyz;
  let qb = frames[g.b * FRAME_VEC4 + 1u]; let ib = frames[g.b * FRAME_VEC4 + 4u].xyz;
  let rta = cross(g.ra, t); let rtb = cross(g.rb, t);
  return 1.0 / frames[g.a * FRAME_VEC4].w + 1.0 / frames[g.b * FRAME_VEC4].w
    + dot(rta, world_inverse_inertia(qa, ia, rta)) + dot(rtb, world_inverse_inertia(qb, ib, rtb));
}
fn scatter_pair_impulse(g: PairGeometry, impulse: vec3<f32>) {
  scatter_contact_impulse(g.a, g.ra, impulse);
  scatter_contact_impulse(g.b, g.rb, -impulse);
}

@compute @workgroup_size(64)
fn warm_start_pairs(@builtin(global_invocation_id) id: vec3<u32>) {
  let i = id.x;
  if (i >= params.counts.z || params.counts.x < 2u) { return; }
  let s0 = proxy_state[i * 4u + 2u]; let s1 = proxy_state[i * 4u + 3u];
  var best = 3.0e38; var partner = 0xffffffffu;
  if (proxy_alive(i)) {
    let body = proxy_body(i);
    let p = proxy_world_point(i); let radius = proxies[i * 2u].w;
    for (var j = i + 1u; j < params.counts.z; j = j + 1u) {
      if (proxy_body(j) == body || !proxy_alive(j)) { continue; }
      let gap = length(proxy_world_point(j) - p) - radius - proxies[j * 2u].w;
      if (gap < best) { best = gap; partner = j; }
    }
  }
  // Reach: the same near band as the walls, widened by this step's approach.
  let reach = params.contact.w + 0.25 * proxies[i * 2u].w;
  if (partner == 0xffffffffu || best > reach + params.gravity_dt.w * 2.0 * params.contact2.y) {
    proxy_state[i * 4u + 2u] = vec4<f32>(0.0, 0.0, 0.0, 0.0);
    proxy_state[i * 4u + 3u] = vec4<f32>(0.0);
    return;
  }
  let g = pair_geometry(i, partner);
  if (g.valid == 0u) { proxy_state[i * 4u + 2u] = vec4<f32>(0.0); proxy_state[i * 4u + 3u] = vec4<f32>(0.0); return; }
  if (u32(s0.z) != partner + 1u || best > reach) {
    proxy_state[i * 4u + 2u] = vec4<f32>(0.0, g.vn, f32(partner + 1u), 0.0);
    proxy_state[i * 4u + 3u] = vec4<f32>(0.0);
    return;
  }
  proxy_state[i * 4u + 2u] = vec4<f32>(s0.x, g.vn, s0.z, 0.0);
  if (s0.x > 0.0) {
    atomicAdd(&contact_counters[contact_count_word(g.a)], 1u);
    atomicAdd(&contact_counters[contact_count_word(g.b)], 1u);
    scatter_pair_impulse(g, s0.x * g.normal + s1.xyz);
  }
}

@compute @workgroup_size(64)
fn contact_pairs(@builtin(global_invocation_id) id: vec3<u32>) {
  let i = id.x;
  if (i >= params.counts.z || params.counts.x < 2u) { return; }
  let s0 = proxy_state[i * 4u + 2u]; let s1 = proxy_state[i * 4u + 3u];
  if (s0.z < 0.5) { return; }
  let g = pair_geometry(i, u32(s0.z) - 1u);
  if (g.valid == 0u) { return; }
  let h = params.gravity_dt.w;
  if (g.gap > 0.0 && g.gap + h * min(g.vn, 0.0) > 0.0 && s0.x == 0.0) { return; }
  atomicAdd(&contact_counters[contact_count_word(g.a)], 1u);
  atomicAdd(&contact_counters[contact_count_word(g.b)], 1u);
  var normal_target = -g.gap / h;
  if (g.gap < 0.0) { normal_target = params.contact.z * max(-g.gap - params.contact.w, 0.0) / h; }
  if (s0.y < -params.contact2.x) { normal_target = max(normal_target, -params.contact.x * s0.y); }
  // Jacobi share: the larger of the two bodies' previous contact counts.
  let share = f32(max(max(bitcast<u32>(frames[g.a * FRAME_VEC4 + 7u].x), bitcast<u32>(frames[g.b * FRAME_VEC4 + 7u].x)), 1u));
  let lambda_new = max(s0.x + (normal_target - g.vn) / (g.k * share), 0.0);
  let dn = lambda_new - s0.x;
  let vt = g.vrel - g.vn * g.normal;
  let vt_len = length(vt);
  var tangential = s1.xyz;
  if (vt_len > 1.0e-9) {
    let t = vt / vt_len;
    tangential = tangential - t * (vt_len / (pair_tangent_k(g, t) * share));
  }
  let limit = params.contact.y * lambda_new;
  let c_len = length(tangential);
  if (c_len > limit) { tangential = tangential * (limit / max(c_len, 1.0e-30)); }
  proxy_state[i * 4u + 2u] = vec4<f32>(lambda_new, s0.y, s0.z, 0.0);
  proxy_state[i * 4u + 3u] = vec4<f32>(tangential, 0.0);
  scatter_pair_impulse(g, dn * g.normal + (tangential - s1.xyz));
}

@compute @workgroup_size(64)
fn apply_contact(@builtin(global_invocation_id) id: vec3<u32>) {
  let body = id.x;
  if (body >= params.counts.x) { return; }
  let base = body * FRAME_VEC4; let row = body * CROWS;
  var sums = array<f32, 6>(0.0, 0.0, 0.0, 0.0, 0.0, 0.0);
  for (var k = 0u; k < CROWS; k++) {
    let total = cc_drain(row + k);
    sums[k] = bitcast<f32>(el_project_f32_bits(total.value).bits);
    if (k < 3u) {
      // Cumulative exact impulse (the wall reaction is its negative).
      var ledger: ExactMass;
      for (var w = 0u; w < EM_WORDS; w++) { ledger.words[w] = impulse_ledger[(body * 3u + k) * EM_WORDS + w]; }
      let next = el_add(ledger, total.value);
      for (var w = 0u; w < EM_WORDS; w++) { impulse_ledger[(body * 3u + k) * EM_WORDS + w] = next.value.words[w]; }
    }
  }
  frames[base + 2u] = vec4<f32>(frames[base + 2u].xyz + vec3<f32>(sums[0], sums[1], sums[2]), 0.0);
  frames[base + 3u] = vec4<f32>(frames[base + 3u].xyz + vec3<f32>(sums[3], sums[4], sums[5]), 0.0);
  let count = atomicExchange(&contact_counters[contact_count_word(body)], 0u);
  let w7 = frames[base + 7u];
  frames[base + 7u] = vec4<f32>(bitcast<f32>(count), bitcast<f32>(bitcast<u32>(w7.y) + 1u), w7.z, w7.w);
}

@compute @workgroup_size(64)
fn drift_bodies(@builtin(global_invocation_id) id: vec3<u32>) {
  let body = id.x;
  if (body >= params.counts.x) { return; }
  let base = body * FRAME_VEC4;
  let f0 = frames[base]; var q = frames[base + 1u]; let p = frames[base + 2u].xyz;
  let l = frames[base + 3u].xyz; let inertia = frames[base + 4u].xyz;
  let mass = f0.w; let h = params.gravity_dt.w;
  if (!(mass > 0.0) || !(h > 0.0)) { return; }
  var pi = quat_rotate_inverse(q, l);
  free_rotation_substep(&q, &pi, inertia, 0u, 0.5 * h);
  free_rotation_substep(&q, &pi, inertia, 1u, 0.5 * h);
  free_rotation_substep(&q, &pi, inertia, 2u, h);
  free_rotation_substep(&q, &pi, inertia, 1u, 0.5 * h);
  free_rotation_substep(&q, &pi, inertia, 0u, 0.5 * h);
  frames[base] = vec4<f32>(f0.xyz + h * p / mass, mass);
  frames[base + 1u] = q / length(q);
}

// One thread per member: world pose and velocity from the frame, and the
// member's contributions to its body's exact invariant reductions.
@compute @workgroup_size(${workgroupSize})
fn regenerate_members(@builtin(global_invocation_id) id: vec3<u32>) {
  let member = id.x;
  if (member >= params.counts.y) { return; }
  let m0 = members[member * MEMBER_VEC4];
  let body = bitcast<u32>(members[member * MEMBER_VEC4 + 1u].x);
  if (body >= params.counts.x) { return; }
  let base = body * FRAME_VEC4;
  let f0 = frames[base]; let q = frames[base + 1u];
  let r = quat_rotate(q, m0.xyz);
  let v = frames[base + 2u].xyz / f0.w + cross(body_angular_velocity(base), r);
  let world = f0.xyz + r;
  member_world[member * 2u] = vec4<f32>(world, m0.w);
  member_world[member * 2u + 1u] = vec4<f32>(v, 0.0);
  let m = m0.w; let row = body * ROWS;
  // Moments about the frame centre use r directly, so they do not carry the
  // rounding of the absolute position.
  let mr = m * r; let mv = m * v;
  let ang = cross(r, mv);
  let values = array<f32, ${SCHROEDER_SOLID_REDUCTION_ROWS}>(
    m, m * world.x, m * world.y, m * world.z, mv.x, mv.y, mv.z, ang.x, ang.y, ang.z,
    m * (r.y * r.y + r.z * r.z), m * (r.x * r.x + r.z * r.z), m * (r.x * r.x + r.y * r.y),
    -mr.x * r.y, -mr.x * r.z, -mr.y * r.z);
  var error = 0u;
  for (var k = 0u; k < ROWS; k++) { error |= rr_scatter_f32(row + k, bitcast<u32>(values[k])); }
  if (error != 0u) { atomicOr(&reduction_counters[params.counts.x * ROWS * ${COUNTER_WORDS_PER_ROW}u], error); }
}

// ---- Rebase after member release (G3 Phase 4b). The fresh exact reductions
// over alive members give the new mass, centre of mass, momentum, angular
// momentum and inertia; the parallel-axis shift moves them to the new
// centre, a cyclic Jacobi sweep re-diagonalizes the inertia, and member,
// proxy and lattice rest coordinates are re-expressed in the new principal
// frame. Momentum carried by released members has already left with them.
fn reduced(body: u32, k: u32) -> f32 {
  var value: ExactMass;
  let row = body * ROWS + k;
  for (var w = 0u; w < EM_WORDS; w++) { value.words[w] = reductions[row * EM_WORDS + w]; }
  return bitcast<f32>(el_project_f32_bits(value).bits);
}
fn quat_from_columns(c0: vec3<f32>, c1: vec3<f32>, c2: vec3<f32>) -> vec4<f32> {
  let trace = c0.x + c1.y + c2.z;
  var q: vec4<f32>;
  if (trace > 0.0) {
    let s = 0.5 / sqrt(trace + 1.0);
    q = vec4<f32>((c1.z - c2.y) * s, (c2.x - c0.z) * s, (c0.y - c1.x) * s, 0.25 / s);
  } else if (c0.x > c1.y && c0.x > c2.z) {
    let s = 2.0 * sqrt(1.0 + c0.x - c1.y - c2.z);
    q = vec4<f32>(0.25 * s, (c1.x + c0.y) / s, (c2.x + c0.z) / s, (c1.z - c2.y) / s);
  } else if (c1.y > c2.z) {
    let s = 2.0 * sqrt(1.0 + c1.y - c0.x - c2.z);
    q = vec4<f32>((c1.x + c0.y) / s, 0.25 * s, (c2.y + c1.z) / s, (c2.x - c0.z) / s);
  } else {
    let s = 2.0 * sqrt(1.0 + c2.z - c0.x - c1.y);
    q = vec4<f32>((c2.x + c0.z) / s, (c2.y + c1.z) / s, 0.25 * s, (c0.y - c1.x) / s);
  }
  return normalize(q);
}

@compute @workgroup_size(64)
fn rebase_prepare(@builtin(global_invocation_id) id: vec3<u32>) {
  let body = id.x;
  if (body >= params.counts.x) { return; }
  let base = body * FRAME_VEC4;
  rebase[base + 7u] = vec4<f32>(0.0);
  let f0 = frames[base];
  let mass = reduced(body, 0u);
  // A release removes at least one member (>= 1/N of the mass); anything
  // smaller is rounding between the seed's f64 mass and the exact f32 sum.
  if (!(f0.w > 0.0) || abs(mass - f0.w) <= 1.0e-5 * f0.w) { return; }
  if (!(mass > 0.0)) {
    // Every member left: the body is gone (zero mass stops integration).
    rebase[base] = vec4<f32>(f0.xyz, 0.0); rebase[base + 1u] = frames[base + 1u];
    rebase[base + 2u] = vec4<f32>(0.0); rebase[base + 3u] = vec4<f32>(0.0);
    rebase[base + 4u] = frames[base + 4u]; rebase[base + 7u] = vec4<f32>(1.0, 0.0, 0.0, 0.0);
    return;
  }
  let centre = vec3<f32>(reduced(body, 1u), reduced(body, 2u), reduced(body, 3u)) / mass;
  let d = centre - f0.xyz;
  let p = vec3<f32>(reduced(body, 4u), reduced(body, 5u), reduced(body, 6u));
  let l = vec3<f32>(reduced(body, 7u), reduced(body, 8u), reduced(body, 9u)) - cross(d, p);
  // Inertia about the new centre: I_c = I_x - M (|d|^2 1 - d d^T).
  var a = array<array<f32, 3>, 3>();
  let dd = dot(d, d);
  a[0][0] = reduced(body, 10u) - mass * (dd - d.x * d.x);
  a[1][1] = reduced(body, 11u) - mass * (dd - d.y * d.y);
  a[2][2] = reduced(body, 12u) - mass * (dd - d.z * d.z);
  a[0][1] = reduced(body, 13u) + mass * d.x * d.y; a[1][0] = a[0][1];
  a[0][2] = reduced(body, 14u) + mass * d.x * d.z; a[2][0] = a[0][2];
  a[1][2] = reduced(body, 15u) + mass * d.y * d.z; a[2][1] = a[1][2];
  var v = array<array<f32, 3>, 3>();
  v[0][0] = 1.0; v[1][1] = 1.0; v[2][2] = 1.0;
  for (var sweep = 0u; sweep < 12u; sweep++) {
    for (var pair = 0u; pair < 3u; pair++) {
      let pi = select(select(1u, 0u, pair < 2u), 0u, pair == 0u);
      let qi = select(select(2u, 2u, pair == 1u), 1u, pair == 0u);
      let apq = a[pi][qi];
      if (abs(apq) < 1.0e-30) { continue; }
      let theta = (a[qi][qi] - a[pi][pi]) / (2.0 * apq);
      let t = sign(theta + select(0.0, 1.0e-30, theta == 0.0)) / (abs(theta) + sqrt(theta * theta + 1.0));
      let c = 1.0 / sqrt(t * t + 1.0); let s = t * c;
      for (var k = 0u; k < 3u; k++) {
        let akp = a[k][pi]; let akq = a[k][qi];
        a[k][pi] = c * akp - s * akq; a[k][qi] = s * akp + c * akq;
      }
      for (var k = 0u; k < 3u; k++) {
        let apk = a[pi][k]; let aqk = a[qi][k];
        a[pi][k] = c * apk - s * aqk; a[qi][k] = s * apk + c * aqk;
      }
      for (var k = 0u; k < 3u; k++) {
        let vkp = v[k][pi]; let vkq = v[k][qi];
        v[k][pi] = c * vkp - s * vkq; v[k][qi] = s * vkp + c * vkq;
      }
    }
  }
  // Ascending principal moments, right-handed axes.
  var order = vec3<u32>(0u, 1u, 2u);
  let ev = vec3<f32>(a[0][0], a[1][1], a[2][2]);
  if (ev[order.y] < ev[order.x]) { order = vec3<u32>(order.y, order.x, order.z); }
  if (ev[order.z] < ev[order.y]) { order = vec3<u32>(order.x, order.z, order.y); }
  if (ev[order.y] < ev[order.x]) { order = vec3<u32>(order.y, order.x, order.z); }
  let c0 = vec3<f32>(v[0][order.x], v[1][order.x], v[2][order.x]);
  let c1 = vec3<f32>(v[0][order.y], v[1][order.y], v[2][order.y]);
  var c2 = vec3<f32>(v[0][order.z], v[1][order.z], v[2][order.z]);
  if (dot(cross(c0, c1), c2) < 0.0) { c2 = -c2; }
  let moments = max(vec3<f32>(ev[order.x], ev[order.y], ev[order.z]), vec3<f32>(1.0e-30));
  rebase[base] = vec4<f32>(centre, mass);
  rebase[base + 1u] = quat_from_columns(c0, c1, c2);
  rebase[base + 2u] = vec4<f32>(p, 0.0);
  rebase[base + 3u] = vec4<f32>(l, 0.0);
  rebase[base + 4u] = vec4<f32>(moments, 0.0);
  rebase[base + 7u] = vec4<f32>(1.0, 0.0, 0.0, 0.0);
}

// Body-frame vector under the old frame re-expressed in the new frame.
fn rebased_rest(base: u32, rest: vec3<f32>, is_point: bool) -> vec3<f32> {
  let old_q = frames[base + 1u]; let new_q = rebase[base + 1u];
  var world = quat_rotate(old_q, rest);
  if (is_point) { world = world + frames[base].xyz - rebase[base].xyz; }
  return quat_rotate_inverse(new_q, world);
}

@compute @workgroup_size(64)
fn rebase_members(@builtin(global_invocation_id) id: vec3<u32>) {
  let member = id.x;
  if (member >= params.counts.y) { return; }
  let body = bitcast<u32>(members[member * MEMBER_VEC4 + 1u].x);
  if (body >= params.counts.x) { return; }
  let base = body * FRAME_VEC4;
  if (rebase[base + 7u].x != 1.0 || !(rebase[base].w > 0.0)) { return; }
  let m0 = members[member * MEMBER_VEC4];
  members[member * MEMBER_VEC4] = vec4<f32>(rebased_rest(base, m0.xyz, true), m0.w);
}

@compute @workgroup_size(64)
fn rebase_proxies(@builtin(global_invocation_id) id: vec3<u32>) {
  let i = id.x;
  if (i >= params.counts.z) { return; }
  let body = bitcast<u32>(proxies[i * 2u + 1u].x);
  if (body >= params.counts.x) { return; }
  let base = body * FRAME_VEC4;
  if (rebase[base + 7u].x != 1.0 || !(rebase[base].w > 0.0)) { return; }
  let p0 = proxies[i * 2u];
  proxies[i * 2u] = vec4<f32>(rebased_rest(base, p0.xyz, true), p0.w);
  // Accumulated impulses refer to the old contact; restart them.
  proxy_state[i * 4u] = vec4<f32>(0.0); proxy_state[i * 4u + 1u] = vec4<f32>(0.0);
  proxy_state[i * 4u + 2u] = vec4<f32>(0.0); proxy_state[i * 4u + 3u] = vec4<f32>(0.0);
}

@compute @workgroup_size(64)
fn rebase_commit(@builtin(global_invocation_id) id: vec3<u32>) {
  let body = id.x;
  if (body >= params.counts.x) { return; }
  let base = body * FRAME_VEC4;
  if (rebase[base + 7u].x != 1.0) { return; }
  if (rebase[base].w > 0.0) {
    for (var k = 0u; k < 3u; k++) {
      lattice[body * 4u + k] = vec4<f32>(rebased_rest(base, lattice[body * 4u + k].xyz, false), 0.0);
    }
  }
  frames[base] = rebase[base]; frames[base + 1u] = rebase[base + 1u];
  frames[base + 2u] = rebase[base + 2u]; frames[base + 3u] = rebase[base + 3u];
  frames[base + 4u] = rebase[base + 4u];
  rebase[base + 7u] = vec4<f32>(0.0);
}

// One thread per body: drain the exact reductions into W-word rows.
@compute @workgroup_size(64)
fn drain_reductions(@builtin(global_invocation_id) id: vec3<u32>) {
  let body = id.x;
  if (body >= params.counts.x) { return; }
  for (var k = 0u; k < ROWS; k++) {
    let row = body * ROWS + k;
    let total = rr_drain(row);
    for (var i = 0u; i < EM_WORDS; i++) { reductions[row * EM_WORDS + i] = total.value.words[i]; }
    if (total.error != 0u) { reductions[params.counts.x * ROWS * EM_WORDS] |= total.error; }
  }
}
`;
}

export const SCHROEDER_SOLID_RIGID_FORMAT = FORMAT;

function quatFromMatrix(m) {
  // Columns of m are the body axes in world; returns (x, y, z, w).
  const [a, b, c, d, e, f, g, h, i] = [m[0][0], m[0][1], m[0][2], m[1][0], m[1][1], m[1][2], m[2][0], m[2][1], m[2][2]];
  const trace = a + e + i;
  let x, y, z, w;
  if (trace > 0) { const s = 0.5 / Math.sqrt(trace + 1); w = 0.25 / s; x = (h - f) * s; y = (c - g) * s; z = (d - b) * s; }
  else if (a > e && a > i) { const s = 2 * Math.sqrt(1 + a - e - i); w = (h - f) / s; x = 0.25 * s; y = (b + d) / s; z = (c + g) / s; }
  else if (e > i) { const s = 2 * Math.sqrt(1 + e - a - i); w = (c - g) / s; x = (b + d) / s; y = 0.25 * s; z = (f + h) / s; }
  else { const s = 2 * Math.sqrt(1 + i - a - e); w = (d - b) / s; x = (c + g) / s; y = (f + h) / s; z = 0.25 * s; }
  const n = Math.hypot(x, y, z, w);
  return [x / n, y / n, z / n, w / n];
}

// Cyclic Jacobi eigen-decomposition of a symmetric 3x3 matrix (f64).
function symmetricEigen3(matrix) {
  const a = matrix.map(row => [...row]);
  const v = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
  for (let sweep = 0; sweep < 50; sweep++) {
    const off = Math.abs(a[0][1]) + Math.abs(a[0][2]) + Math.abs(a[1][2]);
    if (off < 1e-300) break;
    for (const [p, q] of [[0, 1], [0, 2], [1, 2]]) {
      if (a[p][q] === 0) continue;
      const theta = (a[q][q] - a[p][p]) / (2 * a[p][q]);
      const t = Math.sign(theta || 1) / (Math.abs(theta) + Math.sqrt(theta * theta + 1));
      const c = 1 / Math.sqrt(t * t + 1), s = t * c;
      for (let k = 0; k < 3; k++) {
        const akp = a[k][p], akq = a[k][q];
        a[k][p] = c * akp - s * akq; a[k][q] = s * akp + c * akq;
      }
      for (let k = 0; k < 3; k++) {
        const apk = a[p][k], aqk = a[q][k];
        a[p][k] = c * apk - s * aqk; a[q][k] = s * apk + c * aqk;
      }
      for (let k = 0; k < 3; k++) {
        const vkp = v[k][p], vkq = v[k][q];
        v[k][p] = c * vkp - s * vkq; v[k][q] = s * vkp + c * vkq;
      }
    }
  }
  return { values: [a[0][0], a[1][1], a[2][2]], vectors: v };
}

/**
 * Cold seed of one coherent rigid body from member samples (initial
 * conditions, f64 on the host like every other scene seed): the centre of
 * mass, the principal frame, principal moments, and member rest coordinates
 * in that frame. `members` are { x: [x, y, z] (world), massKg }.
 */
export function seedSchroederSolidRigidBody({ bodyId, members, velocity = [0, 0, 0], angularVelocity = [0, 0, 0] }) {
  if (!Number.isSafeInteger(bodyId) || bodyId < 0 || !members?.length) {
    throw new TypeError('A rigid body seed needs a bodyId and members');
  }
  let mass = 0; const com = [0, 0, 0];
  for (const member of members) {
    if (!(member.massKg > 0) || member.x.some(v => !Number.isFinite(v))) throw new TypeError('Rigid members need positive mass and finite positions');
    mass += member.massKg; for (let k = 0; k < 3; k++) com[k] += member.massKg * member.x[k];
  }
  for (let k = 0; k < 3; k++) com[k] /= mass;
  const inertia = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  for (const member of members) {
    const r = member.x.map((v, k) => v - com[k]); const r2 = r[0] * r[0] + r[1] * r[1] + r[2] * r[2];
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) inertia[i][j] += member.massKg * ((i === j ? r2 : 0) - r[i] * r[j]);
  }
  const { values, vectors } = symmetricEigen3(inertia);
  // Order principal axes by moment and keep a right-handed frame.
  const order = [0, 1, 2].sort((p, q) => values[p] - values[q]);
  const axes = order.map(k => [vectors[0][k], vectors[1][k], vectors[2][k]]);
  const crossed = [axes[0][1] * axes[1][2] - axes[0][2] * axes[1][1], axes[0][2] * axes[1][0] - axes[0][0] * axes[1][2],
    axes[0][0] * axes[1][1] - axes[0][1] * axes[1][0]];
  if (crossed[0] * axes[2][0] + crossed[1] * axes[2][1] + crossed[2] * axes[2][2] < 0) axes[2] = axes[2].map(v => -v);
  const principal = order.map(k => values[k]);
  if (!(principal[0] > 0)) throw new TypeError('A rigid body needs a non-degenerate inertia tensor');
  const rotation = [[axes[0][0], axes[1][0], axes[2][0]], [axes[0][1], axes[1][1], axes[2][1]], [axes[0][2], axes[1][2], axes[2][2]]];
  const quaternion = quatFromMatrix(rotation);
  const rest = members.map(member => {
    const r = member.x.map((v, k) => v - com[k]);
    return [0, 1, 2].map(a => axes[a][0] * r[0] + axes[a][1] * r[1] + axes[a][2] * r[2]);
  });
  // World angular momentum L = R I R^T omega.
  const omegaBody = [0, 1, 2].map(a => axes[a][0] * angularVelocity[0] + axes[a][1] * angularVelocity[1] + axes[a][2] * angularVelocity[2]);
  const lBody = omegaBody.map((w, a) => principal[a] * w);
  const angularMomentum = [0, 1, 2].map(k => axes[0][k] * lBody[0] + axes[1][k] * lBody[1] + axes[2][k] * lBody[2]);
  return Object.freeze({ schema: SCHROEDER_SOLID_FRAME_SCHEMA, bodyId, massKg: mass, centerOfMass: com, quaternion,
    principalMoments: principal, linearMomentum: velocity.map(v => mass * v), angularMomentum,
    members: members.map((member, i) => ({ rest: rest[i], massKg: member.massKg })) });
}

/** Pack seeds into frame and member words (f32/u32 views of one ArrayBuffer each). */
export function packSchroederSolidRigidBodies(seeds) {
  const memberCount = seeds.reduce((sum, seed) => sum + seed.members.length, 0);
  const frames = new ArrayBuffer(seeds.length * SCHROEDER_SOLID_FRAME_WORDS * 4);
  const ff = new Float32Array(frames), fu = new Uint32Array(frames);
  const membersBuffer = new ArrayBuffer(memberCount * SCHROEDER_SOLID_MEMBER_WORDS * 4);
  const mf = new Float32Array(membersBuffer), mu = new Uint32Array(membersBuffer);
  let offset = 0;
  seeds.forEach((seed, body) => {
    const b = body * SCHROEDER_SOLID_FRAME_WORDS;
    ff.set([...seed.centerOfMass, seed.massKg, ...seed.quaternion, ...seed.linearMomentum, 0,
      ...seed.angularMomentum, 0, ...seed.principalMoments, 0], b);
    fu.set([seed.bodyId, 0, offset, seed.members.length, 0, 0, 0, 1], b + 20);
    seed.members.forEach((member, i) => {
      const m = (offset + i) * SCHROEDER_SOLID_MEMBER_WORDS;
      mf.set([...member.rest, member.massKg], m);
      mu.set([body, offset + i, 0, 0], m + 4);
    });
    offset += seed.members.length;
  });
  return { frames, members: membersBuffer, bodyCount: seeds.length, memberCount };
}

/**
 * Benchmark contact law for SOL-1 wall contact (declared choices, not
 * measurements): Newton restitution 0.3 above 0.05 m/s approach speed,
 * Coulomb friction 0.3, Baumgarte 0.2 with 0.5 mm penetration slop, and 8
 * projected-Jacobi iterations per step.
 */
export const SCHROEDER_SOLID_BENCHMARK_CONTACT_LAW = Object.freeze({
  restitution: 0.3, friction: 0.3, baumgarte: 0.2, slopM: 5e-4, restitutionThresholdMPerS: 0.05, iterations: 8
});
export const SCHROEDER_SOLID_PROXY_WORDS = 8;
export const SCHROEDER_SOLID_LATTICE_FLOATS = 16;

/** Per body: the seed-time world lattice axes in the body frame, and the pitch. */
export function packSchroederSolidLattice(seeds, pitchByAxisM) {
  const out = new Float32Array(seeds.length * SCHROEDER_SOLID_LATTICE_FLOATS);
  seeds.forEach((seed, body) => {
    const [x, y, z, w] = seed.quaternion;
    const rotInv = v => { const qx = -x, qy = -y, qz = -z;
      const t = [2 * (qy * v[2] - qz * v[1]), 2 * (qz * v[0] - qx * v[2]), 2 * (qx * v[1] - qy * v[0])];
      return [v[0] + w * t[0] + (qy * t[2] - qz * t[1]), v[1] + w * t[1] + (qz * t[0] - qx * t[2]), v[2] + w * t[2] + (qx * t[1] - qy * t[0])]; };
    [[1, 0, 0], [0, 1, 0], [0, 0, 1]].forEach((e, k) => out.set([...rotInv(e), 0], body * 16 + k * 4));
    out.set([...pitchByAxisM[body], 0], body * 16 + 12);
  });
  return out;
}

/** Contact proxies at member rest positions (radius = half the member pitch). */
export function packSchroederSolidContactProxies(seeds, { radiusM, memberFilter = null } = {}) {
  if (!(radiusM > 0)) throw new TypeError('Contact proxies need a positive radius');
  const rows = [];
  seeds.forEach((seed, body) => seed.members.forEach((member, index) => {
    if (!memberFilter || memberFilter(member, index, seed)) rows.push([body, index, member.rest]);
  }));
  const buffer = new ArrayBuffer(Math.max(1, rows.length) * SCHROEDER_SOLID_PROXY_WORDS * 4);
  const f = new Float32Array(buffer), u = new Uint32Array(buffer);
  rows.forEach(([body, index, rest], i) => {
    f.set([...rest, radiusM], i * SCHROEDER_SOLID_PROXY_WORDS);
    u.set([body, index, 0, 0], i * SCHROEDER_SOLID_PROXY_WORDS + 4);
  });
  return { proxies: buffer, proxyCount: rows.length };
}

/**
 * The rigid stage over caller-owned frame/member/proxy buffers. Without
 * proxies a step integrates with the symmetric (leapfrog) scheme; with
 * proxies it kicks, runs the contact iterations against the box walls, and
 * drifts. Then members are regenerated and their exact reductions drained.
 */
export function createSchroederSolidRigidStage({ device, bodyCount, memberCount, frameBuffer, memberBuffer,
  gravity = [0, 0, 0], torque = [0, 0, 0], workgroupSize = 64, proxyBuffer = null, proxyCount = 0,
  boxM = [5, 5, 5], contactLaw = SCHROEDER_SOLID_BENCHMARK_CONTACT_LAW, latticeBuffer = null } = {}) {
  if (!(bodyCount > 0) || !(memberCount > 0) || !frameBuffer || !memberBuffer) {
    throw new TypeError('The rigid stage needs bodies, members and their buffers');
  }
  if (proxyCount > 0 && !proxyBuffer) throw new TypeError('Contact proxies need their buffer');
  if (!(Number(device.limits?.maxStorageBuffersPerShaderStage) >= 11)) {
    throw new RangeError('The rigid lane binds 11 storage buffers; request the resident SPH device limits');
  }
  const code = schroederSolidRigidWgsl({ workgroupSize });
  const bindings = ['uniform', 'storage', 'storage', 'storage', 'storage', 'storage',
    'storage', 'storage', 'storage', 'storage', 'storage', 'storage'].map((type, binding) => computeBufferBinding(binding, type));
  const pipelines = Object.fromEntries(['integrate_bodies', 'regenerate_members', 'drain_reductions',
    'kick_bodies', 'warm_start_proxies', 'contact_proxies', 'warm_start_pairs', 'contact_pairs', 'apply_contact',
    'drift_bodies',
    'rebase_prepare', 'rebase_members', 'rebase_proxies', 'rebase_commit']
    .map(entryPoint => [entryPoint, createCachedExplicitComputePipeline(device, {
      cacheKey: `ulg-solid-rigid-${entryPoint}-wg${workgroupSize}.v0`, label: `ulg-solid-rigid-${entryPoint}`, code, entryPoint, bindings })]));
  const params = device.createBuffer({ label: 'ulg-solid-rigid-params', size: 96,
    usage: GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST });
  const memberWorldBuffer = device.createBuffer({ label: 'ulg-solid-member-world', size: memberCount * 32,
    usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_SRC });
  const rows = bodyCount * SCHROEDER_SOLID_REDUCTION_ROWS;
  const counterBuffer = device.createBuffer({ label: 'ulg-solid-rigid-reduction-counters',
    size: (rows * COUNTER_WORDS_PER_ROW + 4) * 4, usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_SRC });
  const reductionBuffer = device.createBuffer({ label: 'ulg-solid-rigid-reductions',
    size: (rows * FORMAT.wordCount + 4) * 4,
    usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_SRC | GPU_BUFFER_USAGE.COPY_DST });
  const placeholderProxies = proxyCount > 0 ? null : device.createBuffer({ label: 'ulg-solid-proxy-placeholder',
    size: 32, usage: GPU_BUFFER_USAGE.STORAGE });
  const ownedLattice = latticeBuffer ? null : device.createBuffer({ label: 'ulg-solid-lattice',
    size: bodyCount * SCHROEDER_SOLID_LATTICE_FLOATS * 4, usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_SRC });
  const rebaseBuffer = device.createBuffer({ label: 'ulg-solid-rebase', size: bodyCount * SCHROEDER_SOLID_FRAME_WORDS * 4,
    usage: GPU_BUFFER_USAGE.STORAGE });
  const proxyStateBuffer = device.createBuffer({ label: 'ulg-solid-proxy-state', size: Math.max(1, proxyCount) * 64,
    usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_SRC });
  const contactCounterBuffer = device.createBuffer({ label: 'ulg-solid-contact-counters',
    size: (bodyCount * 6 * COUNTER_WORDS_PER_ROW + bodyCount + 2) * 4,
    usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_SRC });
  const impulseLedgerBuffer = device.createBuffer({ label: 'ulg-solid-impulse-ledger',
    size: bodyCount * 3 * FORMAT.wordCount * 4, usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_SRC });
  const words = new ArrayBuffer(96), u = new Uint32Array(words), f = new Float32Array(words);
  u.set([bodyCount, memberCount, proxyCount, 0], 0);
  f.set([...gravity, 0], 4); f.set([...torque, 0], 8); f.set([...boxM, 0], 12);
  f.set([contactLaw.restitution, contactLaw.friction, contactLaw.baumgarte, contactLaw.slopM], 16);
  // Body-body partner reach: proxies closer than the near band plus two steps
  // at this speed are paired at warm start (SOL-2).
  f.set([contactLaw.restitutionThresholdMPerS, contactLaw.pairReachSpeedMPerS ?? 5, 0, 0], 20);
  const bindGroup = device.createBindGroup({ layout: pipelines.integrate_bodies.bindGroupLayout,
    entries: [params, frameBuffer, memberBuffer, memberWorldBuffer, counterBuffer, reductionBuffer,
      proxyBuffer ?? placeholderProxies, proxyStateBuffer, contactCounterBuffer, impulseLedgerBuffer,
      latticeBuffer ?? ownedLattice, rebaseBuffer]
      .map((buffer, binding) => ({ binding, resource: { buffer } })) });
  const encodePass = (encoder, entryPoint, groups) => {
    const pass = encoder.beginComputePass({ label: `ulg-solid-rigid-${entryPoint}` });
    pass.setPipeline(pipelines[entryPoint].pipeline); pass.setBindGroup(0, bindGroup);
    pass.dispatchWorkgroups(groups); pass.end();
  };
  return Object.freeze({
    memberWorldBuffer, reductionBuffer, counterBuffer, reductionRows: rows, impulseLedgerBuffer, proxyStateBuffer,
    /** Encode one step: integrate (when dt > 0), regenerate, drain. */
    encode(encoder, dtSeconds) {
      f[7] = dtSeconds; device.queue.writeBuffer(params, 0, words);
      const bodyGroups = Math.ceil(bodyCount / 64);
      if (dtSeconds > 0) {
        // Fresh exact reductions over the alive members, then a rebase when a
        // release changed the body's mass (a no-op otherwise).
        encodePass(encoder, 'regenerate_members', Math.ceil(memberCount / workgroupSize));
        encodePass(encoder, 'drain_reductions', bodyGroups);
        encodePass(encoder, 'rebase_prepare', bodyGroups);
        encodePass(encoder, 'rebase_members', Math.ceil(memberCount / 64));
        if (proxyCount > 0) encodePass(encoder, 'rebase_proxies', Math.ceil(proxyCount / 64));
        encodePass(encoder, 'rebase_commit', bodyGroups);
      }
      if (dtSeconds > 0 && proxyCount > 0) {
        const proxyGroups = Math.ceil(proxyCount / 64);
        const bodyPairs = bodyCount >= 2;
        encodePass(encoder, 'kick_bodies', bodyGroups);
        encodePass(encoder, 'warm_start_proxies', proxyGroups);
        if (bodyPairs) encodePass(encoder, 'warm_start_pairs', proxyGroups);
        encodePass(encoder, 'apply_contact', bodyGroups);
        for (let k = 0; k < contactLaw.iterations; k++) {
          encodePass(encoder, 'contact_proxies', proxyGroups);
          if (bodyPairs) encodePass(encoder, 'contact_pairs', proxyGroups);
          encodePass(encoder, 'apply_contact', bodyGroups);
        }
        encodePass(encoder, 'drift_bodies', bodyGroups);
      } else if (dtSeconds > 0) encodePass(encoder, 'integrate_bodies', bodyGroups);
      encodePass(encoder, 'regenerate_members', Math.ceil(memberCount / workgroupSize));
      encodePass(encoder, 'drain_reductions', Math.ceil(bodyCount / 64));
    },
    destroy() {
      for (const buffer of [params, memberWorldBuffer, counterBuffer, reductionBuffer, proxyStateBuffer,
        contactCounterBuffer, impulseLedgerBuffer, placeholderProxies, ownedLattice, rebaseBuffer]) buffer?.destroy();
    }
  });
}
