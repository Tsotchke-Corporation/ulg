// Matrix-free Jacobi-preconditioned Conjugate Gradient (PCG) semi-implicit
// (IMEX / theta-method) thermal conduction and linearized 4*sigma*T^3 radiation
// solver. Solves the SPD system:
//
//   (D + theta * dt * L) * dT = r^n
//
// where D_i = C_i + theta * dt * G_{i,w} > 0, L is the symmetric pairwise
// conductance Laplacian L_{ii} = sum_j G_{ij}, L_{ij} = -G_{ij}, and
// r^n_i = dt * (sum_j G_{ij} (T^n_j - T^n_i) + G_{i,w} (T_w - T^n_i)).
//
// After PCG solves for T^{n+1} = T^n + dT, energy updates are projected from
// exact skew-symmetric pairwise fluxes q_{ij} = -q_{ji}, guaranteeing exact
// conservation (sum_i dE_i == sum_i Q_{i,w}) at any iteration count and
// unconditional stability (discrete maximum principle) for any Fourier number
// Fo = alpha * dt / dx^2 >> 1.

import { unwrapWebGpuCacheDevice } from '../webgpuComputeLayout.js';

export const SPH_IMPLICIT_THERMAL_SCHEMA = 'ulg.sph.implicit-thermal.v1';
export const SPH_IMPLICIT_THERMAL_MAX_ITERATIONS = 64;
export const SPH_IMPLICIT_THERMAL_DEFAULT_THETA = 1.0;
export const SPH_IMPLICIT_THERMAL_DEFAULT_RELATIVE_TOLERANCE = 1e-4;
export const STEFAN_BOLTZMANN_W_PER_M2_K4 = 5.670374419e-8;

const GPU_BUFFER_USAGE = {
  MAP_READ: 0x0001,
  COPY_SRC: 0x0004,
  COPY_DST: 0x0008,
  UNIFORM: 0x0040,
  STORAGE: 0x0080
};

export function sphImplicitThermalIterationsFor(maxFourierNumber) {
  const fo = Number(maxFourierNumber);
  if (!Number.isFinite(fo) || fo <= 0) return 8;
  return Math.max(8, Math.min(SPH_IMPLICIT_THERMAL_MAX_ITERATIONS, Math.ceil(4 * Math.sqrt(fo))));
}

export function normalizeSphImplicitThermalOptions(raw) {
  if (raw == null || raw === false || raw === 0 || raw === '0' || raw === 'off' || raw === '') {
    return null;
  }
  const obj = typeof raw === 'object' ? raw : {};
  if (obj.enabled === false) return null;
  const rawTheta = Number(obj.theta ?? SPH_IMPLICIT_THERMAL_DEFAULT_THETA);
  const theta = Number.isFinite(rawTheta) ? Math.min(1, Math.max(0.5, rawTheta)) : SPH_IMPLICIT_THERMAL_DEFAULT_THETA;
  const maxFourierNumber = Number.isFinite(Number(obj.maxFourierNumber)) && Number(obj.maxFourierNumber) > 0
    ? Number(obj.maxFourierNumber)
    : 16;
  const rawIter = obj.iterations != null ? Math.round(Number(obj.iterations)) : sphImplicitThermalIterationsFor(maxFourierNumber);
  const iterations = Number.isFinite(rawIter)
    ? Math.max(1, Math.min(SPH_IMPLICIT_THERMAL_MAX_ITERATIONS, rawIter))
    : sphImplicitThermalIterationsFor(maxFourierNumber);
  const rawTol = Number(obj.relativeTolerance ?? SPH_IMPLICIT_THERMAL_DEFAULT_RELATIVE_TOLERANCE);
  const relativeTolerance = Number.isFinite(rawTol) && rawTol > 0 ? Math.min(0.1, Math.max(1e-7, rawTol)) : SPH_IMPLICIT_THERMAL_DEFAULT_RELATIVE_TOLERANCE;
  return Object.freeze({
    schema: SPH_IMPLICIT_THERMAL_SCHEMA,
    enabled: true,
    theta,
    iterations,
    maxFourierNumber,
    relativeTolerance,
    radiationLinearization: obj.radiationLinearization !== false
  });
}

// Compute symmetric linearized radiative conductance G_rad = 4 * sigma * eps_eff * F_ij * T_bar^3.
export function linearizedRadiativeConductanceWPerK(tempIK, tempJK, effectiveEmissivity, exchangeAreaM2) {
  const ti = Number(tempIK);
  const tj = Number(tempJK);
  const eps = Number(effectiveEmissivity);
  const area = Number(exchangeAreaM2);
  if (!(ti > 0) || !(tj > 0) || !(eps > 0) || !(area > 0)) return 0;
  // Exact factorization of T_j^4 - T_i^4 = (T_j - T_i) * (T_i + T_j) * (T_i^2 + T_j^2)
  // preserves exact pairwise symmetry and reproduces exact T^4 flux at T^n.
  return STEFAN_BOLTZMANN_W_PER_M2_K4 * eps * area * (ti + tj) * (ti * ti + tj * tj);
}

// Pack uniform params: [nodeCount, edgeCount, dt, theta] + [relTol, 0, 0, 0] (32 bytes).
export function packSphImplicitThermalParams({ nodeCount, edgeCount, dt, theta = 1.0, relativeTolerance = 1e-4 } = {}) {
  const buf = new ArrayBuffer(32);
  const u = new Uint32Array(buf);
  const f = new Float32Array(buf);
  u[0] = Math.max(0, Math.round(Number(nodeCount) || 0));
  u[1] = Math.max(0, Math.round(Number(edgeCount) || 0));
  f[2] = Math.fround(Number(dt) || 0);
  f[3] = Math.fround(Math.min(1, Math.max(0.5, Number(theta) || 1)));
  f[4] = Math.fround(Number(relativeTolerance) || 1e-4);
  return buf;
}

export const sphImplicitThermalWgsl = /* wgsl */ `
struct ThermalParams {
  node_count: u32,
  edge_count: u32,
  dt: f32,
  theta: f32,
  rel_tol: f32,
  pad0: u32,
  pad1: u32,
  pad2: u32,
};

// Per-node thermal state:
//   node_state[i] = vec4<f32>(heat_capacity_J_per_K, T_n_K, wall_G_W_per_K, wall_T_K)
// CSR adjacency:
//   row_offsets[i .. i+1] indexes into edge_neighbors[k] (u32) and edge_conductance[k] (f32, G_ij >= 0).
@group(0) @binding(0) var<uniform> params: ThermalParams;
@group(0) @binding(1) var<storage, read> node_state: array<vec4<f32>>;
@group(0) @binding(2) var<storage, read> row_offsets: array<u32>;
@group(0) @binding(3) var<storage, read> edge_neighbors: array<u32>;
@group(0) @binding(4) var<storage, read> edge_conductance: array<f32>;

// PCG vectors & outputs:
//   vec_x[i] = dT_i, vec_r[i] = residual, vec_z[i] = M^-1 r, vec_p[i] = search dir,
//   vec_ap[i] = A p, diag_inv[i] = 1 / M_ii
//   out_energy[i] = vec4<f32>(T_next_K, delta_E_total_J, delta_E_wall_J, delta_E_pair_J)
//   scalars[0] = rz, [1] = pAp, [2] = rz_new, [3] = r0_norm2, [4] = r_norm2
@group(0) @binding(5) var<storage, read_write> vec_x: array<f32>;
@group(0) @binding(6) var<storage, read_write> vec_r: array<f32>;
@group(0) @binding(7) var<storage, read_write> vec_z: array<f32>;
@group(0) @binding(8) var<storage, read_write> vec_p: array<f32>;
@group(0) @binding(9) var<storage, read_write> vec_ap: array<f32>;
@group(0) @binding(10) var<storage, read_write> diag_inv: array<f32>;
@group(0) @binding(11) var<storage, read_write> out_energy: array<vec4<f32>>;
@group(0) @binding(12) var<storage, read_write> scalars: array<f32>;

var<workgroup> wg_sum_a: array<f32, 64>;
var<workgroup> wg_sum_b: array<f32, 64>;

@compute @workgroup_size(64)
fn it_cg_init(@builtin(global_invocation_id) gid: vec3<u32>) {
  let i = gid.x;
  if (i >= params.node_count) { return; }
  let ns = node_state[i];
  let cap = max(ns.x, 1e-30);
  let ti = ns.y;
  let gw = max(ns.z, 0.0);
  let tw = ns.w;
  let start = row_offsets[i];
  let end = row_offsets[i + 1u];
  var g_sum = 0.0;
  var flux_sum = gw * (tw - ti);
  for (var e = start; e < end; e++) {
    let j = edge_neighbors[e];
    let gij = max(edge_conductance[e], 0.0);
    g_sum += gij;
    flux_sum += gij * (node_state[j].y - ti);
  }
  let rhs = params.dt * flux_sum;
  let m_ii = cap + params.theta * params.dt * (gw + g_sum);
  let inv_m = select(0.0, 1.0 / m_ii, m_ii > 0.0);
  diag_inv[i] = inv_m;
  vec_x[i] = 0.0;
  vec_r[i] = rhs;
  let z = rhs * inv_m;
  vec_z[i] = z;
  vec_p[i] = z;
}

@compute @workgroup_size(64)
fn it_reduce_init(@builtin(local_invocation_id) lid: vec3<u32>) {
  let tid = lid.x;
  var s_rz = 0.0;
  var s_rr = 0.0;
  var idx = tid;
  loop {
    if (idx >= params.node_count) { break; }
    let r = vec_r[idx];
    s_rz += r * vec_z[idx];
    s_rr += r * r;
    idx += 64u;
  }
  wg_sum_a[tid] = s_rz;
  wg_sum_b[tid] = s_rr;
  workgroupBarrier();
  for (var stride = 32u; stride > 0u; stride >>= 1u) {
    if (tid < stride) {
      wg_sum_a[tid] += wg_sum_a[tid + stride];
      wg_sum_b[tid] += wg_sum_b[tid + stride];
    }
    workgroupBarrier();
  }
  if (tid == 0u) {
    scalars[0] = wg_sum_a[0];
    scalars[1] = 0.0;
    scalars[2] = wg_sum_a[0];
    scalars[3] = wg_sum_b[0];
    scalars[4] = wg_sum_b[0];
  }
}

@compute @workgroup_size(64)
fn it_cg_apply(@builtin(global_invocation_id) gid: vec3<u32>) {
  let i = gid.x;
  if (i >= params.node_count) { return; }
  let ns = node_state[i];
  let cap = max(ns.x, 1e-30);
  let gw = max(ns.z, 0.0);
  let pi = vec_p[i];
  let start = row_offsets[i];
  let end = row_offsets[i + 1u];
  var lap = 0.0;
  for (var e = start; e < end; e++) {
    let j = edge_neighbors[e];
    let gij = max(edge_conductance[e], 0.0);
    lap += gij * (pi - vec_p[j]);
  }
  vec_ap[i] = (cap + params.theta * params.dt * gw) * pi + params.theta * params.dt * lap;
}

@compute @workgroup_size(64)
fn it_reduce_pap(@builtin(local_invocation_id) lid: vec3<u32>) {
  let tid = lid.x;
  var s = 0.0;
  var idx = tid;
  loop {
    if (idx >= params.node_count) { break; }
    s += vec_p[idx] * vec_ap[idx];
    idx += 64u;
  }
  wg_sum_a[tid] = s;
  workgroupBarrier();
  for (var stride = 32u; stride > 0u; stride >>= 1u) {
    if (tid < stride) { wg_sum_a[tid] += wg_sum_a[tid + stride]; }
    workgroupBarrier();
  }
  if (tid == 0u) { scalars[1] = wg_sum_a[0]; }
}

@compute @workgroup_size(64)
fn it_cg_update_xr(@builtin(global_invocation_id) gid: vec3<u32>) {
  let i = gid.x;
  if (i >= params.node_count) { return; }
  let rz = scalars[0];
  let pap = scalars[1];
  let r0 = scalars[3];
  let rr = scalars[4];
  let tol2 = params.rel_tol * params.rel_tol * r0;
  if (pap <= 1e-30 || rz <= 1e-30 || rr <= tol2) { return; }
  let alpha = rz / pap;
  vec_x[i] = vec_x[i] + alpha * vec_p[i];
  let r_new = vec_r[i] - alpha * vec_ap[i];
  vec_r[i] = r_new;
  vec_z[i] = r_new * diag_inv[i];
}

@compute @workgroup_size(64)
fn it_reduce_rz_new(@builtin(local_invocation_id) lid: vec3<u32>) {
  let tid = lid.x;
  var s_rz = 0.0;
  var s_rr = 0.0;
  var idx = tid;
  loop {
    if (idx >= params.node_count) { break; }
    let r = vec_r[idx];
    s_rz += r * vec_z[idx];
    s_rr += r * r;
    idx += 64u;
  }
  wg_sum_a[tid] = s_rz;
  wg_sum_b[tid] = s_rr;
  workgroupBarrier();
  for (var stride = 32u; stride > 0u; stride >>= 1u) {
    if (tid < stride) {
      wg_sum_a[tid] += wg_sum_a[tid + stride];
      wg_sum_b[tid] += wg_sum_b[tid + stride];
    }
    workgroupBarrier();
  }
  if (tid == 0u) {
    scalars[2] = wg_sum_a[0];
    scalars[4] = wg_sum_b[0];
  }
}

@compute @workgroup_size(64)
fn it_cg_update_p(@builtin(global_invocation_id) gid: vec3<u32>) {
  let i = gid.x;
  if (i >= params.node_count) { return; }
  let rz_old = scalars[0];
  let rz_new = scalars[2];
  let beta = select(0.0, rz_new / rz_old, rz_old > 1e-30);
  vec_p[i] = vec_z[i] + beta * vec_p[i];
}

@compute @workgroup_size(1)
fn it_commit_rz() {
  scalars[0] = scalars[2];
}

// Project exact skew-symmetric pairwise fluxes q_ij = -q_ji from T^n and T^{n+1}.
// Total energy is conserved identically regardless of iteration count.
@compute @workgroup_size(64)
fn it_project_conservative_flux(@builtin(global_invocation_id) gid: vec3<u32>) {
  let i = gid.x;
  if (i >= params.node_count) { return; }
  let ns = node_state[i];
  let cap = max(ns.x, 1e-30);
  let ti0 = ns.y;
  let ti1 = ti0 + vec_x[i];
  let ti_eff = params.theta * ti1 + (1.0 - params.theta) * ti0;
  let gw = max(ns.z, 0.0);
  let tw = ns.w;
  let q_wall = params.dt * gw * (tw - ti_eff);
  let start = row_offsets[i];
  let end = row_offsets[i + 1u];
  var q_pair = 0.0;
  for (var e = start; e < end; e++) {
    let j = edge_neighbors[e];
    let gij = max(edge_conductance[e], 0.0);
    let tj0 = node_state[j].y;
    let tj1 = tj0 + vec_x[j];
    let tj_eff = params.theta * tj1 + (1.0 - params.theta) * tj0;
    // Exact skew-symmetry: (tj_eff - ti_eff) == -(ti_eff - tj_eff) in IEEE-754.
    q_pair += params.dt * gij * (tj_eff - ti_eff);
  }
  let q_total = q_pair + q_wall;
  let t_cons = ti0 + q_total / cap;
  out_energy[i] = vec4<f32>(t_cons, q_total, q_wall, q_pair);
}
`;

const ENTRY_POINTS = Object.freeze([
  'it_cg_init',
  'it_reduce_init',
  'it_cg_apply',
  'it_reduce_pap',
  'it_cg_update_xr',
  'it_reduce_rz_new',
  'it_cg_update_p',
  'it_commit_rz',
  'it_project_conservative_flux'
]);

const pipelineCacheByDevice = new WeakMap();

function implicitThermalPipelines(device) {
  const keyDevice = unwrapWebGpuCacheDevice(device);
  let cached = pipelineCacheByDevice.get(keyDevice);
  if (cached) return cached;
  const stage = globalThis.GPUShaderStage?.COMPUTE ?? 4;
  const module = device.createShaderModule({
    label: 'ulg-sph-implicit-thermal',
    code: sphImplicitThermalWgsl
  });
  const layout = device.createBindGroupLayout({
    label: 'ulg-sph-implicit-thermal-layout',
    entries: [
      { binding: 0, visibility: stage, buffer: { type: 'uniform' } },
      { binding: 1, visibility: stage, buffer: { type: 'read-only-storage' } },
      { binding: 2, visibility: stage, buffer: { type: 'read-only-storage' } },
      { binding: 3, visibility: stage, buffer: { type: 'read-only-storage' } },
      { binding: 4, visibility: stage, buffer: { type: 'read-only-storage' } },
      ...[5, 6, 7, 8, 9, 10, 11, 12].map((binding) => ({
        binding,
        visibility: stage,
        buffer: { type: 'storage' }
      }))
    ]
  });
  const pipelineLayout = device.createPipelineLayout({ bindGroupLayouts: [layout] });
  const pipelines = Object.fromEntries(
    ENTRY_POINTS.map((entryPoint) => [
      entryPoint,
      device.createComputePipeline({
        label: `ulg-sph-implicit-thermal-${entryPoint}`,
        layout: pipelineLayout,
        compute: { module, entryPoint }
      })
    ])
  );
  cached = Object.freeze({ module, layout, pipelines });
  pipelineCacheByDevice.set(keyDevice, cached);
  return cached;
}

export function encodeSphImplicitThermalSolve(device, encoder, {
  nodeCount,
  edgeCount,
  dt,
  options = {},
  nodeStateBuffer,
  rowOffsetsBuffer,
  edgeNeighborsBuffer,
  edgeConductanceBuffer,
  workspace = null
} = {}) {
  const normalized = normalizeSphImplicitThermalOptions(options) ?? normalizeSphImplicitThermalOptions({});
  const n = Math.max(1, Math.round(Number(nodeCount) || 0));
  const e = Math.max(1, Math.round(Number(edgeCount) || 0));
  const { layout, pipelines } = implicitThermalPipelines(device);
  const owned = [];
  const makeBuf = (label, size, usage) => {
    const b = device.createBuffer({ label, size: Math.max(16, size), usage });
    owned.push(b);
    return b;
  };
  const ws = workspace && workspace.nodeCapacity >= n ? workspace : {
    nodeCapacity: n,
    params: makeBuf('ulg-it-params', 32, GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST),
    x: makeBuf('ulg-it-x', n * 4, GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_SRC),
    r: makeBuf('ulg-it-r', n * 4, GPU_BUFFER_USAGE.STORAGE),
    z: makeBuf('ulg-it-z', n * 4, GPU_BUFFER_USAGE.STORAGE),
    p: makeBuf('ulg-it-p', n * 4, GPU_BUFFER_USAGE.STORAGE),
    ap: makeBuf('ulg-it-ap', n * 4, GPU_BUFFER_USAGE.STORAGE),
    diagInv: makeBuf('ulg-it-diag-inv', n * 4, GPU_BUFFER_USAGE.STORAGE),
    outEnergy: makeBuf('ulg-it-out-energy', n * 16, GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_SRC),
    scalars: makeBuf('ulg-it-scalars', 32, GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_SRC),
    destroy() { for (const b of owned.splice(0)) b.destroy(); }
  };
  device.queue.writeBuffer(
    ws.params,
    0,
    packSphImplicitThermalParams({
      nodeCount: n,
      edgeCount: e,
      dt,
      theta: normalized.theta,
      relativeTolerance: normalized.relativeTolerance
    })
  );
  const bindGroup = device.createBindGroup({
    label: 'ulg-sph-implicit-thermal-bg',
    layout,
    entries: [
      { binding: 0, resource: { buffer: ws.params } },
      { binding: 1, resource: { buffer: nodeStateBuffer } },
      { binding: 2, resource: { buffer: rowOffsetsBuffer } },
      { binding: 3, resource: { buffer: edgeNeighborsBuffer } },
      { binding: 4, resource: { buffer: edgeConductanceBuffer } },
      { binding: 5, resource: { buffer: ws.x } },
      { binding: 6, resource: { buffer: ws.r } },
      { binding: 7, resource: { buffer: ws.z } },
      { binding: 8, resource: { buffer: ws.p } },
      { binding: 9, resource: { buffer: ws.ap } },
      { binding: 10, resource: { buffer: ws.diagInv } },
      { binding: 11, resource: { buffer: ws.outEnergy } },
      { binding: 12, resource: { buffer: ws.scalars } }
    ]
  });
  const wg = Math.max(1, Math.ceil(n / 64));
  const runPass = (entryPoint, groups) => {
    const pass = encoder.beginComputePass({ label: `ulg-it-${entryPoint}` });
    pass.setPipeline(pipelines[entryPoint]);
    pass.setBindGroup(0, bindGroup);
    pass.dispatchWorkgroups(groups);
    pass.end();
  };
  runPass('it_cg_init', wg);
  runPass('it_reduce_init', 1);
  for (let iter = 0; iter < normalized.iterations; iter += 1) {
    runPass('it_cg_apply', wg);
    runPass('it_reduce_pap', 1);
    runPass('it_cg_update_xr', wg);
    runPass('it_reduce_rz_new', 1);
    runPass('it_cg_update_p', wg);
    runPass('it_commit_rz', 1);
  }
  runPass('it_project_conservative_flux', wg);
  return {
    schema: SPH_IMPLICIT_THERMAL_SCHEMA,
    options: normalized,
    nodeCount: n,
    outEnergyBuffer: ws.outEnergy,
    scalarsBuffer: ws.scalars,
    workspace: ws,
    destroy: () => { if (!workspace) ws.destroy(); }
  };
}

// Exact CPU reference mirror for host parity & physical invariant tests.
export function solveSphImplicitThermalCpuReference({
  nodeState,
  rowOffsets,
  edgeNeighbors,
  edgeConductance,
  dt,
  options = {}
} = {}) {
  const normalized = normalizeSphImplicitThermalOptions(options) ?? normalizeSphImplicitThermalOptions({});
  const n = Math.floor(nodeState.length / 4);
  const theta = normalized.theta;
  const x = new Float64Array(n);
  const r = new Float64Array(n);
  const z = new Float64Array(n);
  const p = new Float64Array(n);
  const ap = new Float64Array(n);
  const diagInv = new Float64Array(n);
  let rz = 0;
  let r0 = 0;
  for (let i = 0; i < n; i += 1) {
    const cap = Math.max(nodeState[i * 4], 1e-30);
    const ti = nodeState[i * 4 + 1];
    const gw = Math.max(nodeState[i * 4 + 2], 0);
    const tw = nodeState[i * 4 + 3];
    let gSum = 0;
    let flux = gw * (tw - ti);
    for (let e = rowOffsets[i]; e < rowOffsets[i + 1]; e += 1) {
      const j = edgeNeighbors[e];
      const gij = Math.max(edgeConductance[e], 0);
      gSum += gij;
      flux += gij * (nodeState[j * 4 + 1] - ti);
    }
    const rhs = dt * flux;
    const m = cap + theta * dt * (gw + gSum);
    diagInv[i] = m > 0 ? 1 / m : 0;
    r[i] = rhs;
    z[i] = rhs * diagInv[i];
    p[i] = z[i];
    rz += r[i] * z[i];
    r0 += r[i] * r[i];
  }
  let rr = r0;
  const tol2 = normalized.relativeTolerance * normalized.relativeTolerance * r0;
  let iterationsRun = 0;
  for (let iter = 0; iter < normalized.iterations; iter += 1) {
    if (rr <= tol2 || rz <= 1e-30) break;
    let pap = 0;
    for (let i = 0; i < n; i += 1) {
      const cap = Math.max(nodeState[i * 4], 1e-30);
      const gw = Math.max(nodeState[i * 4 + 2], 0);
      const pi = p[i];
      let lap = 0;
      for (let e = rowOffsets[i]; e < rowOffsets[i + 1]; e += 1) {
        lap += Math.max(edgeConductance[e], 0) * (pi - p[edgeNeighbors[e]]);
      }
      ap[i] = (cap + theta * dt * gw) * pi + theta * dt * lap;
      pap += pi * ap[i];
    }
    if (pap <= 1e-30) break;
    const alpha = rz / pap;
    let rzNew = 0;
    rr = 0;
    for (let i = 0; i < n; i += 1) {
      x[i] += alpha * p[i];
      r[i] -= alpha * ap[i];
      z[i] = r[i] * diagInv[i];
      rzNew += r[i] * z[i];
      rr += r[i] * r[i];
    }
    const beta = rz > 1e-30 ? rzNew / rz : 0;
    for (let i = 0; i < n; i += 1) p[i] = z[i] + beta * p[i];
    rz = rzNew;
    iterationsRun += 1;
  }
  const out = new Float64Array(n * 4);
  let totalPairEnergy = 0;
  let totalWallEnergy = 0;
  for (let i = 0; i < n; i += 1) {
    const cap = Math.max(nodeState[i * 4], 1e-30);
    const ti0 = nodeState[i * 4 + 1];
    const ti1 = ti0 + x[i];
    const tiEff = theta * ti1 + (1 - theta) * ti0;
    const gw = Math.max(nodeState[i * 4 + 2], 0);
    const tw = nodeState[i * 4 + 3];
    const qWall = dt * gw * (tw - tiEff);
    let qPair = 0;
    for (let e = rowOffsets[i]; e < rowOffsets[i + 1]; e += 1) {
      const j = edgeNeighbors[e];
      const gij = Math.max(edgeConductance[e], 0);
      const tj0 = nodeState[j * 4 + 1];
      const tj1 = tj0 + x[j];
      const tjEff = theta * tj1 + (1 - theta) * tj0;
      qPair += dt * gij * (tjEff - tiEff);
    }
    const qTotal = qPair + qWall;
    out[i * 4] = ti0 + qTotal / cap;
    out[i * 4 + 1] = qTotal;
    out[i * 4 + 2] = qWall;
    out[i * 4 + 3] = qPair;
    totalPairEnergy += qPair;
    totalWallEnergy += qWall;
  }
  return {
    outEnergy: out,
    iterationsRun,
    relativeResidual: r0 > 0 ? Math.sqrt(rr / r0) : 0,
    totalPairEnergyJ: totalPairEnergy,
    totalWallEnergyJ: totalWallEnergy
  };
}

export async function runSphImplicitThermalSolveWebGpu(device, {
  nodeState,
  rowOffsets,
  edgeNeighbors,
  edgeConductance,
  dt,
  options = {}
} = {}) {
  const n = Math.floor(nodeState.length / 4);
  const e = Math.max(1, edgeNeighbors.length);
  const makeUploaded = (label, typed, usage) => {
    const b = device.createBuffer({ label, size: Math.max(16, typed.byteLength), usage: usage | GPU_BUFFER_USAGE.COPY_DST });
    if (typed.byteLength > 0) device.queue.writeBuffer(b, 0, typed);
    return b;
  };
  const nodeStateBuf = makeUploaded('ulg-it-node-state', new Float32Array(nodeState), GPU_BUFFER_USAGE.STORAGE);
  const rowOffsetsBuf = makeUploaded('ulg-it-row-offsets', new Uint32Array(rowOffsets), GPU_BUFFER_USAGE.STORAGE);
  const edgeNeighborsBuf = makeUploaded('ulg-it-edge-neighbors', new Uint32Array(edgeNeighbors.length ? edgeNeighbors : [0]), GPU_BUFFER_USAGE.STORAGE);
  const edgeConductanceBuf = makeUploaded('ulg-it-edge-conductance', new Float32Array(edgeConductance.length ? edgeConductance : [0]), GPU_BUFFER_USAGE.STORAGE);
  const readOut = device.createBuffer({ label: 'ulg-it-read-out', size: Math.max(16, n * 16), usage: GPU_BUFFER_USAGE.MAP_READ | GPU_BUFFER_USAGE.COPY_DST });
  const readScalars = device.createBuffer({ label: 'ulg-it-read-scalars', size: 32, usage: GPU_BUFFER_USAGE.MAP_READ | GPU_BUFFER_USAGE.COPY_DST });
  let solved = null;
  try {
    const encoder = device.createCommandEncoder({ label: 'ulg-sph-implicit-thermal-solve' });
    solved = encodeSphImplicitThermalSolve(device, encoder, {
      nodeCount: n,
      edgeCount: e,
      dt,
      options,
      nodeStateBuffer: nodeStateBuf,
      rowOffsetsBuffer: rowOffsetsBuf,
      edgeNeighborsBuffer: edgeNeighborsBuf,
      edgeConductanceBuffer: edgeConductanceBuf
    });
    encoder.copyBufferToBuffer(solved.outEnergyBuffer, 0, readOut, 0, n * 16);
    encoder.copyBufferToBuffer(solved.scalarsBuffer, 0, readScalars, 0, 32);
    device.queue.submit([encoder.finish()]);
    await Promise.all([readOut.mapAsync(GPU_BUFFER_USAGE.MAP_READ), readScalars.mapAsync(GPU_BUFFER_USAGE.MAP_READ)]);
    const outEnergy = new Float32Array(readOut.getMappedRange().slice(0));
    const scalars = new Float32Array(readScalars.getMappedRange().slice(0));
    readOut.unmap();
    readScalars.unmap();
    return {
      schema: SPH_IMPLICIT_THERMAL_SCHEMA,
      outEnergy,
      scalars,
      relativeResidual: scalars[3] > 0 ? Math.sqrt(Math.max(0, scalars[4]) / scalars[3]) : 0
    };
  } finally {
    solved?.destroy();
    nodeStateBuf.destroy();
    rowOffsetsBuf.destroy();
    edgeNeighborsBuf.destroy();
    edgeConductanceBuf.destroy();
    readOut.destroy();
    readScalars.destroy();
  }
}
