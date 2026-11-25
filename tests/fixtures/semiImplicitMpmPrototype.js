// A1 larger-dt slice, step 3 prototype (plan/todo/a1-eshkol-coarse-dt.md):
// a self-contained GPU MLS-MPM weakly compressible fluid (Tait gamma 7, the
// same EOS form as packed_pressure) with two pressure treatments at the SAME
// sound speed:
//   explicit       pressure from p(J) in the particle stress (today's scheme;
//                  stable only for c dt / dx below about 1);
//   semiImplicit   linearized backward-Euler pressure on the grid:
//                  p - K dt^2 div(grad p / rho) = p_n - K dt div(v*),
//                  Jacobi iterations, then v = v* - dt grad(p) / rho, with
//                  K = rho dp/drho supplied per particle (the Eshkol-derived
//                  stiffness, eshkolEosStiffness.js).
// Not a production path: it measures whether the operator holds the 1%
// budget at larger dt before it is wired into the canonical route.
export const SEMI_IMPLICIT_MPM_PARTICLE_VEC4 = 5; // [x,m] [v,J] [C row0..2]

export const semiImplicitMpmWgsl = /* wgsl */ `
struct Params {
  grid: vec4<u32>,        // n (nodes per axis), particle count, semi (0/1), unused
  scale: vec4<f32>,       // dx, inv_dx, dt, rest density
  eos: vec4<f32>,         // sound speed, particle volume, gravity y, bound margin (nodes)
  solve: vec4<f32>,       // Jacobi damping omega, unused...
};
@group(0) @binding(0) var<uniform> params: Params;
@group(0) @binding(1) var<storage, read_write> particles: array<vec4<f32>>;
@group(0) @binding(2) var<storage, read_write> grid_acc: array<atomic<i32>>;   // m, px, py, pz, dx, dy, dz
@group(0) @binding(3) var<storage, read_write> grid_v: array<vec4<f32>>;       // current velocity iterate, m
@group(0) @binding(4) var<storage, read_write> grid_b: array<vec4<f32>>;       // explicit velocity b, unused
@group(0) @binding(5) var<storage, read_write> iter_acc: array<atomic<i32>>;   // scatter of K dt div per iteration
@group(0) @binding(6) var<storage, read_write> particle_s: array<f32>;         // K dt div_p(v) per particle
@group(0) @binding(7) var<storage, read_write> cg_r: array<vec4<f32>>;
@group(0) @binding(8) var<storage, read_write> cg_p: array<vec4<f32>>;
@group(0) @binding(9) var<storage, read_write> cg_q: array<vec4<f32>>;
@group(0) @binding(10) var<storage, read_write> scalars: array<atomic<u32>>;    // rr, pq, rr_new (f32 bits)
@group(0) @binding(11) var<storage, read_write> saved: array<vec4<f32>>;        // SSP-RK2 start state
var<workgroup> partial: array<f32, 64>;

const FIX: f32 = 1.0e9;
const FIX_DIAG: f32 = 1.0e5;
const FIX_ITER: f32 = 1.0e6;
const ACC: u32 = 7u;

fn node_index(i: vec3<i32>) -> u32 {
  let n = i32(params.grid.x);
  return u32(i.x + n * (i.y + n * i.z));
}
fn inside(i: vec3<i32>) -> bool {
  let n = i32(params.grid.x);
  return all(i >= vec3<i32>(0)) && all(i < vec3<i32>(n));
}
fn tait_pressure(j: f32) -> f32 {
  let rho0 = params.scale.w;
  let c = params.eos.x;
  let ratio = 1.0 / max(j, 1.0e-6);
  let stiffness = rho0 * c * c / 7.0;
  return max(stiffness * (pow(ratio, 7.0) - 1.0), 0.0);
}
fn tait_stiffness(j: f32) -> f32 {
  // K = rho dp/drho = rho c^2 (rho / rho0)^6 (the Eshkol-derived form). Zero
  // on the physical cavitation floor (ratio < 1 - eps), where the EOS is flat.
  let rho0 = params.scale.w;
  let c = params.eos.x;
  let ratio = 1.0 / max(j, 1.0e-6);
  if (ratio < 0.9999) { return 0.0; }
  return rho0 * ratio * c * c * pow(ratio, 6.0);
}
fn weights(gx: vec3<f32>) -> array<vec3<f32>, 3> {
  let base = floor(gx - 0.5);
  let fx = gx - base;
  return array<vec3<f32>, 3>(0.5 * (1.5 - fx) * (1.5 - fx), 0.75 - (fx - 1.0) * (fx - 1.0), 0.5 * (fx - 0.5) * (fx - 0.5));
}
fn clamp_walls(i: vec3<i32>, v_in: vec3<f32>) -> vec3<f32> {
  var v = v_in;
  let n = i32(params.grid.x);
  let margin = i32(params.eos.w);
  // solve.w > 0.5: equality (always-slip) walls, a linear constraint that
  // keeps the step smooth; otherwise the separating (inequality) walls.
  if (params.solve.w > 0.5) {
    if (i.x <= margin || i.x >= n - 1 - margin) { v.x = 0.0; }
    if (i.y <= margin || i.y >= n - 1 - margin) { v.y = 0.0; }
    if (i.z <= margin || i.z >= n - 1 - margin) { v.z = 0.0; }
    return v;
  }
  if (i.x <= margin && v.x < 0.0) { v.x = 0.0; }
  if (i.x >= n - 1 - margin && v.x > 0.0) { v.x = 0.0; }
  if (i.y <= margin && v.y < 0.0) { v.y = 0.0; }
  if (i.y >= n - 1 - margin && v.y > 0.0) { v.y = 0.0; }
  if (i.z <= margin && v.z < 0.0) { v.z = 0.0; }
  if (i.z >= n - 1 - margin && v.z > 0.0) { v.z = 0.0; }
  return v;
}

@compute @workgroup_size(64)
fn clear_grid(@builtin(global_invocation_id) id: vec3<u32>) {
  let n = params.grid.x;
  if (id.x >= n * n * n) { return; }
  for (var s = 0u; s < ACC; s++) { atomicStore(&grid_acc[id.x * ACC + s], 0); }
}

// Explicit P2G (mass, APIC momentum with the p_n stress), plus, for the
// implicit solve, the per-axis diagonal of A (scaled later by dt^2 / m).
@compute @workgroup_size(64)
fn p2g(@builtin(global_invocation_id) id: vec3<u32>) {
  if (id.x >= params.grid.y) { return; }
  let b = id.x * 5u;
  let xm = particles[b];
  let vj = particles[b + 1u];
  let c = mat3x3<f32>(particles[b + 2u].xyz, particles[b + 3u].xyz, particles[b + 4u].xyz);
  let dx = params.scale.x;
  let inv_dx = params.scale.y;
  let dt = params.scale.z;
  let vol = params.eos.y;
  let m = xm.w;
  let p = tait_pressure(vj.w);
  let k = tait_stiffness(vj.w);
  let q = vol * 4.0 * inv_dx * inv_dx;
  let affine = m * c + mat3x3<f32>(vec3<f32>(1.0, 0.0, 0.0), vec3<f32>(0.0, 1.0, 0.0), vec3<f32>(0.0, 0.0, 1.0)) * (dt * q * p);
  let gx = xm.xyz * inv_dx;
  let base = vec3<i32>(floor(gx - 0.5));
  let fx = gx - vec3<f32>(base);
  let ws = weights(gx);
  for (var a = 0; a < 3; a++) { for (var bb = 0; bb < 3; bb++) { for (var cc = 0; cc < 3; cc++) {
    let off = vec3<i32>(a, bb, cc);
    let node = base + off;
    if (!inside(node)) { continue; }
    let w = ws[a].x * ws[bb].y * ws[cc].z;
    let dpos = (vec3<f32>(off) - fx) * dx;
    let mom = w * (m * vj.xyz + affine * dpos);
    let ni = node_index(node);
    atomicAdd(&grid_acc[ni * ACC], i32(round(w * m * FIX)));
    atomicAdd(&grid_acc[ni * ACC + 1u], i32(round(mom.x * FIX)));
    atomicAdd(&grid_acc[ni * ACC + 2u], i32(round(mom.y * FIX)));
    atomicAdd(&grid_acc[ni * ACC + 3u], i32(round(mom.z * FIX)));
    if (params.grid.z != 0u) {
      // A_ii (axis a) = (dt^2 / m_i) sum_p q (4/dx^2) K_p w^2 dpos_a^2
      let d = q * 4.0 * inv_dx * inv_dx * k * w * w * dpos * dpos;
      atomicAdd(&grid_acc[ni * ACC + 4u], i32(round(d.x * FIX_DIAG)));
      atomicAdd(&grid_acc[ni * ACC + 5u], i32(round(d.y * FIX_DIAG)));
      atomicAdd(&grid_acc[ni * ACC + 6u], i32(round(d.z * FIX_DIAG)));
    }
  }}}
}

@compute @workgroup_size(64)
fn grid_update(@builtin(global_invocation_id) id: vec3<u32>) {
  let n = params.grid.x;
  if (id.x >= n * n * n) { return; }
  let m = f32(atomicLoad(&grid_acc[id.x * ACC])) / FIX;
  let i = vec3<i32>(i32(id.x % n), i32((id.x / n) % n), i32(id.x / (n * n)));
  if (m <= 1.0e-12) {
    grid_v[id.x] = vec4<f32>(0.0);
    grid_b[id.x] = vec4<f32>(0.0);
    return;
  }
  var v = vec3<f32>(f32(atomicLoad(&grid_acc[id.x * ACC + 1u])), f32(atomicLoad(&grid_acc[id.x * ACC + 2u])),
    f32(atomicLoad(&grid_acc[id.x * ACC + 3u]))) / FIX / m;
  v.y = v.y + params.scale.z * params.eos.z;
  v = clamp_walls(i, v);
  grid_v[id.x] = vec4<f32>(v, m);
  grid_b[id.x] = vec4<f32>(v, m);
}

// Iteration, particle half: s_p = K_p dt div_p(v^k).
@compute @workgroup_size(64)
fn particle_divergence(@builtin(global_invocation_id) id: vec3<u32>) {
  if (id.x >= params.grid.y) { return; }
  let b = id.x * 5u;
  let xm = particles[b];
  let vj = particles[b + 1u];
  let dx = params.scale.x;
  let inv_dx = params.scale.y;
  let gx = xm.xyz * inv_dx;
  let base = vec3<i32>(floor(gx - 0.5));
  let fx = gx - vec3<f32>(base);
  let ws = weights(gx);
  var div = 0.0;
  for (var a = 0; a < 3; a++) { for (var bb = 0; bb < 3; bb++) { for (var cc = 0; cc < 3; cc++) {
    let off = vec3<i32>(a, bb, cc);
    let node = base + off;
    if (!inside(node)) { continue; }
    let w = ws[a].x * ws[bb].y * ws[cc].z;
    let dpos = (vec3<f32>(off) - fx) * dx;
    let src_v = select(grid_v[node_index(node)].xyz, cg_p[node_index(node)].xyz, params.solve.y > 0.5);
    div = div + w * 4.0 * inv_dx * inv_dx * dot(src_v, dpos);
  }}}
  // theta (solve.z): 1 = backward Euler, 0.5 = trapezoidal (second order).
  particle_s[id.x] = params.solve.z * tait_stiffness(vj.w) * params.scale.z * div;
}

@compute @workgroup_size(64)
fn clear_iteration(@builtin(global_invocation_id) id: vec3<u32>) {
  let n = params.grid.x;
  if (id.x >= n * n * n) { return; }
  for (var s = 0u; s < 3u; s++) { atomicStore(&iter_acc[id.x * 3u + s], 0); }
}

// Iteration, scatter half: sum_p w q dpos s_p (A v^k = dt / m_i times this).
@compute @workgroup_size(64)
fn scatter_iteration(@builtin(global_invocation_id) id: vec3<u32>) {
  if (id.x >= params.grid.y) { return; }
  let b = id.x * 5u;
  let xm = particles[b];
  let dx = params.scale.x;
  let inv_dx = params.scale.y;
  let q = params.eos.y * 4.0 * inv_dx * inv_dx;
  let s = particle_s[id.x];
  let gx = xm.xyz * inv_dx;
  let base = vec3<i32>(floor(gx - 0.5));
  let fx = gx - vec3<f32>(base);
  let ws = weights(gx);
  for (var a = 0; a < 3; a++) { for (var bb = 0; bb < 3; bb++) { for (var cc = 0; cc < 3; cc++) {
    let off = vec3<i32>(a, bb, cc);
    let node = base + off;
    if (!inside(node)) { continue; }
    let w = ws[a].x * ws[bb].y * ws[cc].z;
    let f = w * q * s * (vec3<f32>(off) - fx) * dx;
    let ni = node_index(node);
    atomicAdd(&iter_acc[ni * 3u], i32(round(f.x * FIX_ITER)));
    atomicAdd(&iter_acc[ni * 3u + 1u], i32(round(f.y * FIX_ITER)));
    atomicAdd(&iter_acc[ni * 3u + 2u], i32(round(f.z * FIX_ITER)));
  }}}
}

fn atomic_add_f32(slot: u32, value: f32) {
  var prior = atomicLoad(&scalars[slot]);
  loop {
    let next = bitcast<u32>(bitcast<f32>(prior) + value);
    let exchanged = atomicCompareExchangeWeak(&scalars[slot], prior, next);
    if (exchanged.exchanged) { break; }
    prior = exchanged.old_value;
  }
}
fn workgroup_sum_into(slot: u32, local: u32, value: f32) {
  partial[local] = value;
  workgroupBarrier();
  var stride = 32u;
  loop {
    if (local < stride) { partial[local] = partial[local] + partial[local + stride]; }
    workgroupBarrier();
    if (stride == 1u) { break; }
    stride = stride / 2u;
  }
  if (local == 0u && partial[0] != 0.0) { atomic_add_f32(slot, partial[0]); }
}
fn scalar(slot: u32) -> f32 { return bitcast<f32>(atomicLoad(&scalars[slot])); }
// Normal components at the wall margin are held at b (Dirichlet in the solve).
fn project(i: vec3<i32>, v_in: vec3<f32>) -> vec3<f32> {
  var v = v_in;
  let n = i32(params.grid.x);
  let margin = i32(params.eos.w);
  if (i.x <= margin || i.x >= n - 1 - margin) { v.x = 0.0; }
  if (i.y <= margin || i.y >= n - 1 - margin) { v.y = 0.0; }
  if (i.z <= margin || i.z >= n - 1 - margin) { v.z = 0.0; }
  return v;
}
fn node_av(index: u32, m: f32) -> vec3<f32> {
  return params.scale.z / m * vec3<f32>(f32(atomicLoad(&iter_acc[index * 3u])), f32(atomicLoad(&iter_acc[index * 3u + 1u])),
    f32(atomicLoad(&iter_acc[index * 3u + 2u]))) / FIX_ITER;
}
fn node_ijk(index: u32) -> vec3<i32> {
  let n = params.grid.x;
  return vec3<i32>(i32(index % n), i32((index / n) % n), i32(index / (n * n)));
}

// CG on (I + A) x = b in the mass inner product, x0 = b: r0 = -A b, p0 = r0.
@compute @workgroup_size(64)
fn cg_init(@builtin(global_invocation_id) id: vec3<u32>, @builtin(local_invocation_index) local: u32) {
  let n = params.grid.x;
  var contribution = 0.0;
  if (id.x < n * n * n) {
    let m = grid_v[id.x].w;
    var r = vec3<f32>(0.0);
    if (m > 1.0e-12) { r = project(node_ijk(id.x), -node_av(id.x, m)); }
    cg_r[id.x] = vec4<f32>(r, 0.0);
    cg_p[id.x] = vec4<f32>(r, 0.0);
    contribution = m * dot(r, r);
  }
  workgroup_sum_into(0u, local, contribution);
}

// q = (I + A) p, accumulate <p, q>_M.
@compute @workgroup_size(64)
fn cg_apply(@builtin(global_invocation_id) id: vec3<u32>, @builtin(local_invocation_index) local: u32) {
  let n = params.grid.x;
  var contribution = 0.0;
  if (id.x < n * n * n) {
    let m = grid_v[id.x].w;
    var q = vec3<f32>(0.0);
    if (m > 1.0e-12) {
      let p = cg_p[id.x].xyz;
      q = project(node_ijk(id.x), p + node_av(id.x, m));
      contribution = m * dot(p, q);
    }
    cg_q[id.x] = vec4<f32>(q, 0.0);
  }
  workgroup_sum_into(1u, local, contribution);
}

// x += alpha p, r -= alpha q, accumulate <r, r>_M (new).
@compute @workgroup_size(64)
fn cg_update_xr(@builtin(global_invocation_id) id: vec3<u32>, @builtin(local_invocation_index) local: u32) {
  let n = params.grid.x;
  var contribution = 0.0;
  let pq = scalar(1u);
  let alpha = select(0.0, scalar(0u) / pq, pq > 0.0);
  if (id.x < n * n * n) {
    let g = grid_v[id.x];
    if (g.w > 1.0e-12) {
      let r = cg_r[id.x].xyz - alpha * cg_q[id.x].xyz;
      grid_v[id.x] = vec4<f32>(g.xyz + alpha * cg_p[id.x].xyz, g.w);
      cg_r[id.x] = vec4<f32>(r, 0.0);
      contribution = g.w * dot(r, r);
    }
  }
  workgroup_sum_into(2u, local, contribution);
}

// p = r + beta p.
@compute @workgroup_size(64)
fn cg_update_p(@builtin(global_invocation_id) id: vec3<u32>) {
  let n = params.grid.x;
  if (id.x >= n * n * n) { return; }
  let rr = scalar(0u);
  let beta = select(0.0, scalar(2u) / rr, rr > 0.0);
  cg_p[id.x] = vec4<f32>(cg_r[id.x].xyz + beta * cg_p[id.x].xyz, 0.0);
}

// rr <- rr_new; pq, rr_new <- 0 (one thread, between iterations).
@compute @workgroup_size(1)
fn cg_shift() {
  atomicStore(&scalars[0], atomicLoad(&scalars[2]));
  atomicStore(&scalars[1], 0u);
  atomicStore(&scalars[2], 0u);
}
@compute @workgroup_size(1)
fn cg_reset() {
  atomicStore(&scalars[0], 0u);
  atomicStore(&scalars[1], 0u);
  atomicStore(&scalars[2], 0u);
}
@compute @workgroup_size(64)
fn cg_finish(@builtin(global_invocation_id) id: vec3<u32>) {
  let n = params.grid.x;
  if (id.x >= n * n * n) { return; }
  let g = grid_v[id.x];
  if (g.w <= 1.0e-12) { return; }
  grid_v[id.x] = vec4<f32>(clamp_walls(node_ijk(id.x), g.xyz), g.w);
}

// SSP-RK2 (Heun): save u_n, take two steps, then u_{n+1} = (u_n + u_2) / 2.
@compute @workgroup_size(64)
fn rk2_save(@builtin(global_invocation_id) id: vec3<u32>) {
  if (id.x >= params.grid.y * 5u) { return; }
  saved[id.x] = particles[id.x];
}
@compute @workgroup_size(64)
fn rk2_average(@builtin(global_invocation_id) id: vec3<u32>) {
  if (id.x >= params.grid.y * 5u) { return; }
  let a = saved[id.x];
  let b = particles[id.x];
  // Word 3 of the first vec4 is mass: keep it exact.
  var avg = 0.5 * (a + b);
  if (id.x % 5u == 0u) { avg.w = a.w; }
  particles[id.x] = avg;
}

@compute @workgroup_size(64)
fn g2p(@builtin(global_invocation_id) id: vec3<u32>) {
  if (id.x >= params.grid.y) { return; }
  let b = id.x * 5u;
  let xm = particles[b];
  let vj = particles[b + 1u];
  let dx = params.scale.x;
  let inv_dx = params.scale.y;
  let dt = params.scale.z;
  let gx = xm.xyz * inv_dx;
  let base = vec3<i32>(floor(gx - 0.5));
  let fx = gx - vec3<f32>(base);
  let ws = weights(gx);
  var v = vec3<f32>(0.0);
  var c = mat3x3<f32>(vec3<f32>(0.0), vec3<f32>(0.0), vec3<f32>(0.0));
  for (var a = 0; a < 3; a++) { for (var bb = 0; bb < 3; bb++) { for (var cc = 0; cc < 3; cc++) {
    let off = vec3<i32>(a, bb, cc);
    let node = base + off;
    if (!inside(node)) { continue; }
    let w = ws[a].x * ws[bb].y * ws[cc].z;
    let gv = grid_v[node_index(node)].xyz;
    let dpos = (vec3<f32>(off) - fx) * dx;
    v = v + w * gv;
    c = c + 4.0 * inv_dx * inv_dx * w * mat3x3<f32>(gv * dpos.x, gv * dpos.y, gv * dpos.z);
  }}}
  let j = vj.w * (1.0 + dt * (c[0].x + c[1].y + c[2].z));
  let n = f32(params.grid.x);
  let lo = params.eos.w * dx;
  // Walls: nodes <= margin and >= n - 1 - margin hold zero normal velocity,
  // and particles stay between those two node planes (symmetric about the
  // grid's centre, (n - 1) dx / 2).
  let hi = (n - 1.0 - params.eos.w) * dx;
  // grid.w = 1: forward-Euler advection (the stage's start velocity), so a
  // SSP-RK2 stage is u + dt f(u) and the average is second order; 0: MPM's
  // usual symplectic advection with the updated velocity.
  let advect = select(v, vj.xyz, params.grid.w == 1u);
  let x = clamp(xm.xyz + dt * advect, vec3<f32>(lo), vec3<f32>(hi));
  particles[b] = vec4<f32>(x, xm.w);
  particles[b + 1u] = vec4<f32>(v, j);
  particles[b + 2u] = vec4<f32>(c[0], 0.0);
  particles[b + 3u] = vec4<f32>(c[1], 0.0);
  particles[b + 4u] = vec4<f32>(c[2], 0.0);
}
`;

/**
 * Run the prototype on a device. Returns the particle array after `steps`.
 * options: { semiImplicit, dt, steps, soundSpeed, gridN, block, jacobiIterations }
 */
export async function runSemiImplicitMpmPrototype(device, {
  semiImplicit = false, dt, steps, soundSpeed, gridN = 32, jacobiIterations = 40, omega = 0.6, theta = 1, rk2 = false,
  equalityWalls = false, wallMarginNodes = 2,
  block = { min: [0.06, 0.06, 0.06], max: [0.36, 0.56, 0.36] }, restDensity = 1000, gravity = -9.81,
  // Optional sloshing surface: keep particles below y = h0 + slope (x - xMid).
  surface = null,
  // Optional time series: summarize the state every this many steps (and at t = 0).
  sampleEverySteps = 0
}) {
  const dx = 1 / gridN;
  const spacing = dx / 2;
  const particles = [];
  const xMid = 0.5 * (block.min[0] + block.max[0]);
  for (let x = block.min[0] + spacing / 2; x < block.max[0]; x += spacing) {
    for (let y = block.min[1] + spacing / 2; y < block.max[1]; y += spacing) {
      if (surface && y > surface.h0 + surface.slope * (x - xMid)) continue;
      for (let z = block.min[2] + spacing / 2; z < block.max[2]; z += spacing) particles.push([x, y, z]);
    }
  }
  const count = particles.length;
  const vol = spacing ** 3;
  const mass = restDensity * vol;
  const data = new Float32Array(count * SEMI_IMPLICIT_MPM_PARTICLE_VEC4 * 4);
  particles.forEach(([x, y, z], i) => { data.set([x, y, z, mass, 0, 0, 0, 1], i * 20); });
  const nodes = gridN ** 3;
  const S = GPUBufferUsage;
  const buf = (size, usage) => device.createBuffer({ size, usage });
  const particleBuffer = buf(data.byteLength, S.STORAGE | S.COPY_DST | S.COPY_SRC);
  device.queue.writeBuffer(particleBuffer, 0, data);
  const gridAcc = buf(nodes * 7 * 4, S.STORAGE);
  const gridV = buf(nodes * 16, S.STORAGE);
  const gridB = buf(nodes * 16, S.STORAGE);
  const iterAcc = buf(nodes * 3 * 4, S.STORAGE);
  const particleS = buf(Math.max(16, count * 4), S.STORAGE);
  const cgR = buf(nodes * 16, S.STORAGE);
  const cgP = buf(nodes * 16, S.STORAGE);
  const cgQ = buf(nodes * 16, S.STORAGE);
  const scalars = buf(16, S.STORAGE);
  const savedState = buf(data.byteLength, S.STORAGE);
  // Two params blocks: particle divergence reads grid_v (0) or cg_p (1).
  const paramBlocks = [0, 1].map((source) => {
    const block = buf(64, S.UNIFORM | S.COPY_DST);
    device.queue.writeBuffer(block, 0, new Float32Array([
      ...new Float32Array(new Uint32Array([gridN, count, semiImplicit ? 1 : 0, rk2 ? 1 : 0]).buffer),
      dx, 1 / dx, dt, restDensity, soundSpeed, vol, gravity, wallMarginNodes, omega, source, theta, equalityWalls ? 1 : 0
    ]));
    return block;
  });
  const params = paramBlocks[0];
  const module = device.createShaderModule({ code: semiImplicitMpmWgsl });
  const info = await module.getCompilationInfo();
  const errors = info.messages.filter((m) => m.type === 'error');
  if (errors.length) throw new Error(errors.map((m) => `${m.lineNum}: ${m.message}`).join('\n'));
  const layout = device.createBindGroupLayout({ entries: [
    { binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'uniform' } },
    ...[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((binding) => ({ binding, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } }))
  ] });
  const pipelineLayout = device.createPipelineLayout({ bindGroupLayouts: [layout] });
  const pipeline = (entryPoint) => device.createComputePipeline({ layout: pipelineLayout, compute: { module, entryPoint } });
  const pipes = Object.fromEntries(['clear_grid', 'p2g', 'grid_update', 'particle_divergence', 'clear_iteration',
    'scatter_iteration', 'cg_init', 'cg_apply', 'cg_update_xr', 'cg_update_p', 'cg_shift', 'cg_reset', 'cg_finish',
    'rk2_save', 'rk2_average', 'g2p'].map((name) => [name, pipeline(name)]));
  const groups = paramBlocks.map((block) => device.createBindGroup({ layout, entries: [
    { binding: 0, resource: { buffer: block } }, { binding: 1, resource: { buffer: particleBuffer } },
    { binding: 2, resource: { buffer: gridAcc } }, { binding: 3, resource: { buffer: gridV } },
    { binding: 4, resource: { buffer: gridB } }, { binding: 5, resource: { buffer: iterAcc } },
    { binding: 6, resource: { buffer: particleS } }, { binding: 7, resource: { buffer: cgR } },
    { binding: 8, resource: { buffer: cgP } }, { binding: 9, resource: { buffer: cgQ } },
    { binding: 10, resource: { buffer: scalars } }, { binding: 11, resource: { buffer: savedState } }] }));
  const group = groups[0];
  const gridGroups = Math.ceil(nodes / 64);
  const particleGroups = Math.ceil(count / 64);
  const batch = 25;
  const samples = [];
  const sampleRead = sampleEverySteps ? buf(data.byteLength, S.MAP_READ | S.COPY_DST) : null;
  const sample = async (step) => {
    const encoder = device.createCommandEncoder();
    encoder.copyBufferToBuffer(particleBuffer, 0, sampleRead, 0, data.byteLength);
    device.queue.submit([encoder.finish()]);
    await sampleRead.mapAsync(GPUMapMode.READ);
    const state = new Float32Array(sampleRead.getMappedRange());
    samples.push({ t: step * dt, ...summarizeSemiImplicitMpmSample(count, state, gravity) });
    sampleRead.unmap();
  };
  if (sampleEverySteps) await sample(0);
  for (let done = 0; done < steps;) {
    const chunk = Math.min(batch, steps - done,
      sampleEverySteps ? sampleEverySteps - (done % sampleEverySteps) : batch);
    const encoder = device.createCommandEncoder();
    const pass = encoder.beginComputePass();
    for (let s = 0; s < chunk; s += 1) {
      const run = (name, groupsCount, g = group) => {
        pass.setBindGroup(0, g); pass.setPipeline(pipes[name]); pass.dispatchWorkgroups(groupsCount);
      };
      const stateGroups = Math.ceil(count * 5 / 64);
      if (rk2) run('rk2_save', stateGroups);
      for (let stage = 0; stage < (rk2 ? 2 : 1); stage += 1) {
      run('clear_grid', gridGroups);
      run('p2g', particleGroups);
      run('grid_update', gridGroups);
      if (semiImplicit) {
        // r0 = -A b (x0 = b), then CG iterations in the mass inner product.
        run('cg_reset', 1);
        run('particle_divergence', particleGroups, groups[0]);
        run('clear_iteration', gridGroups);
        run('scatter_iteration', particleGroups);
        run('cg_init', gridGroups);
        for (let k = 0; k < jacobiIterations; k += 1) {
          run('particle_divergence', particleGroups, groups[1]);
          run('clear_iteration', gridGroups);
          run('scatter_iteration', particleGroups);
          run('cg_apply', gridGroups);
          run('cg_update_xr', gridGroups);
          run('cg_update_p', gridGroups);
          run('cg_shift', 1);
        }
        run('cg_finish', gridGroups);
      }
      run('g2p', particleGroups);
      }
      if (rk2) run('rk2_average', stateGroups);
    }
    pass.end();
    device.queue.submit([encoder.finish()]);
    done += chunk;
    if (sampleEverySteps && done % sampleEverySteps === 0) await sample(done);
  }
  sampleRead?.destroy();
  const read = buf(data.byteLength, S.MAP_READ | S.COPY_DST);
  const encoder = device.createCommandEncoder();
  encoder.copyBufferToBuffer(particleBuffer, 0, read, 0, data.byteLength);
  device.queue.submit([encoder.finish()]);
  await read.mapAsync(GPUMapMode.READ);
  const out = new Float32Array(read.getMappedRange().slice(0));
  read.unmap();
  for (const b of [particleBuffer, gridAcc, gridV, gridB, iterAcc, particleS, cgR, cgP, cgQ, scalars, savedState, ...paramBlocks, read]) b.destroy();
  return { count, state: out, samples };
}

/** One time-series sample: centre of mass, momentum, kinetic and potential energy. */
export function summarizeSemiImplicitMpmSample(count, state, gravity) {
  let m = 0, cx = 0, cy = 0, px = 0, ke = 0;
  for (let i = 0; i < count; i += 1) {
    const o = i * 20, mass = state[o + 3];
    const vx = state[o + 4], vy = state[o + 5], vz = state[o + 6];
    m += mass; cx += mass * state[o]; cy += mass * state[o + 1]; px += mass * vx;
    ke += 0.5 * mass * (vx * vx + vy * vy + vz * vz);
  }
  return { comX: cx / m, comY: cy / m, px, kinetic: ke, potential: -gravity * cy };
}

/** Momentum, kinetic energy, centre of mass and finiteness of a state. */
export function summarizeSemiImplicitMpmState({ count, state }) {
  let m = 0, px = 0, py = 0, pz = 0, ke = 0, cx = 0, cy = 0, cz = 0, finite = true, j = 0;
  for (let i = 0; i < count; i += 1) {
    const o = i * 20, mass = state[o + 3];
    const x = state[o], y = state[o + 1], z = state[o + 2], vx = state[o + 4], vy = state[o + 5], vz = state[o + 6];
    if (![x, y, z, vx, vy, vz].every(Number.isFinite)) { finite = false; continue; }
    m += mass; px += mass * vx; py += mass * vy; pz += mass * vz;
    ke += 0.5 * mass * (vx * vx + vy * vy + vz * vz);
    cx += mass * x; cy += mass * y; cz += mass * z; j += state[o + 7];
  }
  return { finite, mass: m, momentum: [px, py, pz], kinetic: ke, centerOfMass: [cx / m, cy / m, cz / m],
    meanJ: j / count, nonFiniteJ: Array.from({ length: count }, (_, i) => state[i * 20 + 7]).filter((x) => !Number.isFinite(x)).length };
}
