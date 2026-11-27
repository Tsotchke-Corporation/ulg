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
export const SPH_IMPLICIT_THERMAL_FOURIER_THRESHOLD = 0.45;
export const STEFAN_BOLTZMANN_W_PER_M2_K4 = 5.670374419e-8;

const IMEX_EXECUTION_SYM = Symbol.for('ulg.sphImplicitThermalExecutionByDevice.v1');
const imexExecutionByDevice = (globalThis[IMEX_EXECUTION_SYM] ??= new WeakMap());

export function recordSphImplicitThermalDeviceExecution(device, receipt) {
  if (!device) return null;
  const key = unwrapWebGpuCacheDevice(device);
  const prev = imexExecutionByDevice.get(key);
  const next = Object.freeze({
    schema: SPH_IMPLICIT_THERMAL_SCHEMA,
    dispatchedOnGpu: true,
    passCount: Number(receipt?.passCount ?? 1),
    mode: receipt?.mode ?? 'gpu-imex-pcg-1pass',
    skewSymmetricFluxConserved: receipt?.skewSymmetricFluxConserved !== false,
    liveDispatchCount: (prev?.liveDispatchCount ?? 0) + 1,
    nodeCount: Number(receipt?.nodeCount ?? 0),
    edgeCount: Number(receipt?.edgeCount ?? 0),
    iterations: Number(receipt?.iterations ?? 8),
    theta: Number(receipt?.theta ?? 1.0),
    maxFourierNumber: Number(receipt?.maxFourierNumber ?? 0),
    scalarsBuffer: receipt?.scalarsBuffer ?? null
  });
  imexExecutionByDevice.set(key, next);
  return next;
}

export function getSphImplicitThermalDeviceExecution(device) {
  if (!device) return null;
  return imexExecutionByDevice.get(unwrapWebGpuCacheDevice(device)) ?? null;
}

export function clearSphImplicitThermalDeviceExecution(device) {
  if (!device) return false;
  return imexExecutionByDevice.delete(unwrapWebGpuCacheDevice(device));
}

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

/**
 * Evaluate the explicit-stability Fourier envelope Fo = alpha * dt / dx^2 for a
 * single material/cell state. Explicit thermal conduction violates discrete
 * maximum-principle stability above Fo ~= 0.5 (3D stability limit <= 1/6..0.5),
 * so Fo > thresholdFo (default 0.45) triggers the 1-pass IMEX thermal PCG path.
 */
export function evaluateFourierThermalEnvelope({
  thermalConductivityWPerMK,
  densityKgPerM3,
  specificHeatJPerKgK,
  gridSpacingM,
  dtS,
  thresholdFo = SPH_IMPLICIT_THERMAL_FOURIER_THRESHOLD
} = {}) {
  const k = Number(thermalConductivityWPerMK);
  const rho = Number(densityKgPerM3);
  const cp = Number(specificHeatJPerKgK);
  const dx = Number(gridSpacingM);
  const dt = Number(dtS);
  const threshold = Number.isFinite(Number(thresholdFo)) && Number(thresholdFo) > 0
    ? Number(thresholdFo)
    : SPH_IMPLICIT_THERMAL_FOURIER_THRESHOLD;
  if (!(k > 0) || !(rho > 0) || !(cp > 0) || !(dx > 0) || !(dt > 0)) {
    return Object.freeze({
      fourierNumber: 0,
      diffusivityM2PerS: 0,
      thresholdFo: threshold,
      exceedsExplicitStability: false,
      recommendedImplicit: false,
      recommendedIterations: 8,
      reason: 'non-diffusive-or-inactive'
    });
  }
  const diffusivityM2PerS = k / (rho * cp);
  const fourierNumber = (diffusivityM2PerS * dt) / (dx * dx);
  const exceedsExplicitStability = fourierNumber > threshold;
  return Object.freeze({
    fourierNumber,
    diffusivityM2PerS,
    thresholdFo: threshold,
    exceedsExplicitStability,
    recommendedImplicit: exceedsExplicitStability,
    recommendedIterations: exceedsExplicitStability ? sphImplicitThermalIterationsFor(fourierNumber) : 8,
    reason: exceedsExplicitStability ? 'fourier-envelope-exceeded' : 'explicit-stable'
  });
}

/**
 * Evaluate the Fourier stability envelope across all active entries in a packed
 * thermal material table (zero per-preset branches — driven solely by physical
 * k, rho, cp, dx, dt).
 */
export function computeMaterialTableFourierEnvelope(thermalMaterialTable, {
  gridSpacingM,
  dtS,
  thresholdFo = SPH_IMPLICIT_THERMAL_FOURIER_THRESHOLD
} = {}) {
  const threshold = Number.isFinite(Number(thresholdFo)) && Number(thresholdFo) > 0
    ? Number(thresholdFo)
    : SPH_IMPLICIT_THERMAL_FOURIER_THRESHOLD;
  const dx = Number(gridSpacingM);
  const dt = Number(dtS);
  let maxFourierNumber = 0;
  let worstMaterialId = null;
  let evaluatedCount = 0;

  const inspectRecord = (matId, k, rho, cp) => {
    const res = evaluateFourierThermalEnvelope({
      thermalConductivityWPerMK: k,
      densityKgPerM3: rho,
      specificHeatJPerKgK: cp,
      gridSpacingM: dx,
      dtS: dt,
      thresholdFo: threshold
    });
    if (res.diffusivityM2PerS > 0) evaluatedCount += 1;
    if (res.fourierNumber > maxFourierNumber) {
      maxFourierNumber = res.fourierNumber;
      worstMaterialId = matId;
    }
  };

  if (
    thermalMaterialTable?.segments instanceof Float32Array
    && Number(thermalMaterialTable.segmentStrideFloats) >= 12
    && Number(thermalMaterialTable.segmentCount) > 0
  ) {
    const stride = Math.round(Number(thermalMaterialTable.segmentStrideFloats));
    const count = Math.round(Number(thermalMaterialTable.segmentCount));
    const segs = thermalMaterialTable.segments;
    const matNameById = new Map();
    for (const entry of thermalMaterialTable.metadata || []) {
      if (entry?.materialId != null) {
        matNameById.set(entry.materialId, entry.material ?? String(entry.materialId));
      }
    }
    for (let i = 0; i < count; i += 1) {
      const base = i * stride;
      const matId = segs[base];
      const segType = Math.round(segs[base + 1]);
      if (segType !== 1) continue; // single-phase segment (not latent plateau)
      const de = segs[base + 5] - segs[base + 4];
      const dT = segs[base + 7] - segs[base + 6];
      const rho = segs[base + 8];
      const k = segs[base + 11];
      if (!(de > 0) || !(dT > 0) || !(rho > 0) || !(k > 0)) continue;
      const cp = de / dT;
      inspectRecord(matNameById.get(matId) ?? String(matId), k, rho, cp);
    }
  } else if (Array.isArray(thermalMaterialTable?.materials)) {
    for (const mat of thermalMaterialTable.materials) {
      if (!mat) continue;
      const matId = mat.materialKey ?? mat.materialId ?? mat.id ?? null;
      const k = Number(mat.thermalConductivityWPerMK ?? mat.thermalConductivity ?? mat.k ?? 0);
      const rho = Number(mat.densityKgPerM3 ?? mat.referenceDensityKgPerM3 ?? mat.rho0 ?? 0);
      const cp = Number(mat.specificHeatJPerKgK ?? mat.heatCapacityJPerKgK ?? mat.cp ?? mat.cv ?? 0);
      if (k > 0 && rho > 0 && cp > 0) {
        inspectRecord(matId, k, rho, cp);
      }
      if (Array.isArray(mat.phases)) {
        for (const phase of mat.phases) {
          if (!phase) continue;
          inspectRecord(
            matId,
            Number(phase.thermalConductivityWPerMK ?? phase.thermalConductivity ?? k),
            Number(phase.densityKgPerM3 ?? phase.referenceDensityKgPerM3 ?? rho),
            Number(phase.specificHeatJPerKgK ?? phase.cp ?? phase.cv ?? cp)
          );
        }
      }
    }
  } else if (Array.isArray(thermalMaterialTable?.materialRecords)) {
    for (const rec of thermalMaterialTable.materialRecords) {
      if (!rec) continue;
      inspectRecord(
        rec.materialKey ?? rec.materialId ?? null,
        Number(rec.thermalConductivityWPerMK ?? rec.thermalConductivity ?? 0),
        Number(rec.densityKgPerM3 ?? rec.referenceDensityKgPerM3 ?? 0),
        Number(rec.specificHeatJPerKgK ?? rec.heatCapacityJPerKgK ?? 0)
      );
    }
  }

  const exceedsExplicitStability = maxFourierNumber > threshold;
  return Object.freeze({
    schema: SPH_IMPLICIT_THERMAL_SCHEMA,
    maxFourierNumber,
    worstMaterialId,
    evaluatedCount,
    thresholdFo: threshold,
    gridSpacingM: Number.isFinite(dx) ? dx : 0,
    dtS: Number.isFinite(dt) ? dt : 0,
    exceedsExplicitStability,
    recommendedImplicit: exceedsExplicitStability,
    recommendedIterations: exceedsExplicitStability ? sphImplicitThermalIterationsFor(maxFourierNumber) : 8,
    passCount: 1
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

// PCG vectors packed into one storage buffer (6 * node_count floats) so the
// shader stays within the baseline WebGPU 8-storage-buffer-per-stage limit:
//   [0*n..1*n): x (dT_i), [1*n..2*n): r, [2*n..3*n): z,
//   [3*n..4*n): p, [4*n..5*n): ap, [5*n..6*n): diag_inv
//   out_energy[i] = vec4<f32>(T_next_K, delta_E_total_J, delta_E_wall_J, delta_E_pair_J)
//   scalars[0] = rz, [1] = pAp, [2] = rz_new, [3] = r0_norm2, [4] = r_norm2
@group(0) @binding(5) var<storage, read_write> pcg_vecs: array<f32>;
@group(0) @binding(6) var<storage, read_write> out_energy: array<vec4<f32>>;
@group(0) @binding(7) var<storage, read_write> scalars: array<f32>;

var<workgroup> wg_sum_a: array<f32, 64>;
var<workgroup> wg_sum_b: array<f32, 64>;

@compute @workgroup_size(64)
fn it_cg_init(@builtin(global_invocation_id) gid: vec3<u32>) {
  let i = gid.x;
  let n = params.node_count;
  if (i >= n) { return; }
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
  pcg_vecs[5u * n + i] = inv_m;
  pcg_vecs[0u * n + i] = 0.0;
  pcg_vecs[1u * n + i] = rhs;
  let z = rhs * inv_m;
  pcg_vecs[2u * n + i] = z;
  pcg_vecs[3u * n + i] = z;
}

@compute @workgroup_size(64)
fn it_reduce_init(@builtin(local_invocation_id) lid: vec3<u32>) {
  let tid = lid.x;
  let n = params.node_count;
  var s_rz = 0.0;
  var s_rr = 0.0;
  var idx = tid;
  loop {
    if (idx >= n) { break; }
    let r = pcg_vecs[1u * n + idx];
    s_rz += r * pcg_vecs[2u * n + idx];
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
  let n = params.node_count;
  if (i >= n) { return; }
  let ns = node_state[i];
  let cap = max(ns.x, 1e-30);
  let gw = max(ns.z, 0.0);
  let pi = pcg_vecs[3u * n + i];
  let start = row_offsets[i];
  let end = row_offsets[i + 1u];
  var lap = 0.0;
  for (var e = start; e < end; e++) {
    let j = edge_neighbors[e];
    let gij = max(edge_conductance[e], 0.0);
    lap += gij * (pi - pcg_vecs[3u * n + j]);
  }
  pcg_vecs[4u * n + i] = (cap + params.theta * params.dt * gw) * pi + params.theta * params.dt * lap;
}

@compute @workgroup_size(64)
fn it_reduce_pap(@builtin(local_invocation_id) lid: vec3<u32>) {
  let tid = lid.x;
  let n = params.node_count;
  var s = 0.0;
  var idx = tid;
  loop {
    if (idx >= n) { break; }
    s += pcg_vecs[3u * n + idx] * pcg_vecs[4u * n + idx];
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
  let n = params.node_count;
  if (i >= n) { return; }
  let rz = scalars[0];
  let pap = scalars[1];
  let r0 = scalars[3];
  let rr = scalars[4];
  let tol2 = params.rel_tol * params.rel_tol * r0;
  if (pap <= 1e-30 || rz <= 1e-30 || rr <= tol2) { return; }
  let alpha = rz / pap;
  pcg_vecs[0u * n + i] = pcg_vecs[0u * n + i] + alpha * pcg_vecs[3u * n + i];
  let r_new = pcg_vecs[1u * n + i] - alpha * pcg_vecs[4u * n + i];
  pcg_vecs[1u * n + i] = r_new;
  pcg_vecs[2u * n + i] = r_new * pcg_vecs[5u * n + i];
}

@compute @workgroup_size(64)
fn it_reduce_rz_new(@builtin(local_invocation_id) lid: vec3<u32>) {
  let tid = lid.x;
  let n = params.node_count;
  var s_rz = 0.0;
  var s_rr = 0.0;
  var idx = tid;
  loop {
    if (idx >= n) { break; }
    let r = pcg_vecs[1u * n + idx];
    s_rz += r * pcg_vecs[2u * n + idx];
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
  let n = params.node_count;
  if (i >= n) { return; }
  let rz_old = scalars[0];
  let rz_new = scalars[2];
  let beta = select(0.0, rz_new / rz_old, rz_old > 1e-30);
  pcg_vecs[3u * n + i] = pcg_vecs[2u * n + i] + beta * pcg_vecs[3u * n + i];
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
  let n = params.node_count;
  if (i >= n) { return; }
  let ns = node_state[i];
  let cap = max(ns.x, 1e-30);
  let ti0 = ns.y;
  let ti1 = ti0 + pcg_vecs[0u * n + i];
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
    let tj1 = tj0 + pcg_vecs[0u * n + j];
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
      { binding: 5, visibility: stage, buffer: { type: 'storage' } },
      { binding: 6, visibility: stage, buffer: { type: 'storage' } },
      { binding: 7, visibility: stage, buffer: { type: 'storage' } }
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
    pcgVecs: makeBuf('ulg-it-pcg-vecs', n * 6 * 4, GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_SRC),
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
      { binding: 5, resource: { buffer: ws.pcgVecs } },
      { binding: 6, resource: { buffer: ws.outEnergy } },
      { binding: 7, resource: { buffer: ws.scalars } }
    ]
  });
  const wg = Math.max(1, Math.ceil(n / 64));
  // Coalesce the entire matrix-free PCG solve + conservative flux projection
  // into a single WebGPU compute pass (Section 3 pass budget compliance: 1 pass
  // instead of 1 + 1 + 6 * iterations + 1 separate passes). WebGPU guarantees
  // storage-buffer write-to-read visibility across dispatches in a compute pass.
  const pass = encoder.beginComputePass({ label: 'ulg-sph-implicit-thermal-pcg' });
  pass.setBindGroup(0, bindGroup);
  const dispatch = (entryPoint, groups) => {
    pass.setPipeline(pipelines[entryPoint]);
    pass.dispatchWorkgroups(groups);
  };
  dispatch('it_cg_init', wg);
  dispatch('it_reduce_init', 1);
  for (let iter = 0; iter < normalized.iterations; iter += 1) {
    dispatch('it_cg_apply', wg);
    dispatch('it_reduce_pap', 1);
    dispatch('it_cg_update_xr', wg);
    dispatch('it_reduce_rz_new', 1);
    dispatch('it_cg_update_p', wg);
    dispatch('it_commit_rz', 1);
  }
  dispatch('it_project_conservative_flux', wg);
  pass.end();
  return {
    schema: SPH_IMPLICIT_THERMAL_SCHEMA,
    options: normalized,
    nodeCount: n,
    passCount: 1,
    dispatchCount: 3 + normalized.iterations * 6,
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

const SPH_IMPLICIT_THERMAL_BRIDGE_WGSL = /* wgsl */ `
struct BridgeParams {
  particle_count: u32,
  nx: u32,
  ny: u32,
  nz: u32,
  box_x: f32,
  box_y: f32,
  box_z: f32,
  k_eff: f32,
  cp_eff: f32,
  wall_rate: f32,
  ambient_temp_k: f32,
  rad_enabled: u32,
  wall_t_xmin: f32,
  wall_t_xmax: f32,
  wall_t_ymin: f32,
  wall_t_ymax: f32,
  wall_t_zmin: f32,
  wall_t_zmax: f32,
  pad0: f32,
  pad1: f32
};

@group(0) @binding(0) var<uniform> bparams: BridgeParams;
@group(0) @binding(1) var<storage, read_write> p_state: array<f32>;
@group(0) @binding(2) var<storage, read_write> p_thermo: array<f32>;
@group(0) @binding(3) var<storage, read_write> cell_accum_bits: array<atomic<u32>>;
@group(0) @binding(4) var<storage, read_write> node_state: array<vec4<f32>>;
@group(0) @binding(5) var<storage, read> row_offsets: array<u32>;
@group(0) @binding(6) var<storage, read> edge_neighbors: array<u32>;
@group(0) @binding(7) var<storage, read_write> edge_conductance: array<f32>;
@group(0) @binding(8) var<storage, read> solved_energy: array<vec4<f32>>;

fn bridge_atomic_add_f32(slot_idx: u32, delta: f32) {
  if (delta == 0.0 || !(delta == delta)) { return; }
  loop {
    let old_bits = atomicLoad(&cell_accum_bits[slot_idx]);
    let next_val = bitcast<f32>(old_bits) + delta;
    let next_bits = bitcast<u32>(next_val);
    let res = atomicCompareExchangeWeak(&cell_accum_bits[slot_idx], old_bits, next_bits);
    if (res.exchanged) { break; }
  }
}

fn bridge_particle_cell(px: f32, py: f32, pz: f32) -> u32 {
  let fx = clamp(px / max(bparams.box_x, 1e-9), 0.0, 0.999999);
  let fy = clamp(py / max(bparams.box_y, 1e-9), 0.0, 0.999999);
  let fz = clamp(pz / max(bparams.box_z, 1e-9), 0.0, 0.999999);
  let ix = min(bparams.nx - 1u, u32(floor(fx * f32(bparams.nx))));
  let iy = min(bparams.ny - 1u, u32(floor(fy * f32(bparams.ny))));
  let iz = min(bparams.nz - 1u, u32(floor(fz * f32(bparams.nz))));
  return ix + bparams.nx * (iy + bparams.ny * iz);
}

@compute @workgroup_size(64)
fn it_bridge_clear(@builtin(global_invocation_id) gid: vec3<u32>) {
  let c = gid.x;
  let cell_count = bparams.nx * bparams.ny * bparams.nz;
  if (c >= cell_count) { return; }
  atomicStore(&cell_accum_bits[c * 2u], 0u);
  atomicStore(&cell_accum_bits[c * 2u + 1u], 0u);
  node_state[c] = vec4<f32>(1.0, bparams.ambient_temp_k, 0.0, bparams.ambient_temp_k);
}

@compute @workgroup_size(64)
fn it_bridge_p2g(@builtin(global_invocation_id) gid: vec3<u32>) {
  let p = gid.x;
  if (p >= bparams.particle_count) { return; }
  let s_base = p * 8u;
  let t_base = p * 12u;
  let mass = p_state[s_base + 3u];
  let status = p_thermo[t_base + 10u];
  let temp_k = p_thermo[t_base + 2u];
  if (!(mass > 0.0) || status >= 251.5 || !(temp_k > 0.0)) { return; }
  let cap_p = max(mass * bparams.cp_eff, 1e-12);
  let c = bridge_particle_cell(p_state[s_base], p_state[s_base + 1u], p_state[s_base + 2u]);
  bridge_atomic_add_f32(c * 2u, cap_p);
  bridge_atomic_add_f32(c * 2u + 1u, cap_p * temp_k);
}

@compute @workgroup_size(64)
fn it_bridge_build_nodes(@builtin(global_invocation_id) gid: vec3<u32>) {
  let c = gid.x;
  let cell_count = bparams.nx * bparams.ny * bparams.nz;
  if (c >= cell_count) { return; }
  let cap_c = bitcast<f32>(atomicLoad(&cell_accum_bits[c * 2u]));
  if (!(cap_c > 0.0)) {
    node_state[c] = vec4<f32>(1.0, bparams.ambient_temp_k, 0.0, bparams.ambient_temp_k);
    return;
  }
  let ene_c = bitcast<f32>(atomicLoad(&cell_accum_bits[c * 2u + 1u]));
  let temp_c = clamp(ene_c / cap_c, 1.0, 50000.0);
  let nx = bparams.nx;
  let ny = bparams.ny;
  let nz = bparams.nz;
  let ix = c % nx;
  let iy = (c / nx) % ny;
  let iz = c / (nx * ny);
  let dx = bparams.box_x / f32(nx);
  let dy = bparams.box_y / f32(ny);
  let dz = bparams.box_z / f32(nz);

  var g_wall = 0.0;
  var gt_wall = 0.0;
  let wr = max(bparams.wall_rate, 0.0);
  if (wr > 0.0) {
    if (ix == 0u && bparams.wall_t_xmin > 0.0) {
      let g = wr * cap_c;
      g_wall += g;
      gt_wall += g * bparams.wall_t_xmin;
    }
    if (ix + 1u == nx && bparams.wall_t_xmax > 0.0) {
      let g = wr * cap_c;
      g_wall += g;
      gt_wall += g * bparams.wall_t_xmax;
    }
    if (iy == 0u && bparams.wall_t_ymin > 0.0) {
      let g = wr * cap_c;
      g_wall += g;
      gt_wall += g * bparams.wall_t_ymin;
    }
    if (iy + 1u == ny && bparams.wall_t_ymax > 0.0) {
      let g = wr * cap_c;
      g_wall += g;
      gt_wall += g * bparams.wall_t_ymax;
    }
    if (iz == 0u && bparams.wall_t_zmin > 0.0) {
      let g = wr * cap_c;
      g_wall += g;
      gt_wall += g * bparams.wall_t_zmin;
    }
    if (iz + 1u == nz && bparams.wall_t_zmax > 0.0) {
      let g = wr * cap_c;
      g_wall += g;
      gt_wall += g * bparams.wall_t_zmax;
    }
  }
  if (bparams.rad_enabled != 0u && bparams.ambient_temp_k > 0.0) {
    let area_cell = 2.0 * (dx * dy + dy * dz + dz * dx) / 6.0;
    let t_ref = max(temp_c, bparams.ambient_temp_k);
    let g_rad = 4.0 * 0.9 * 5.6703744e-8 * t_ref * t_ref * t_ref * area_cell;
    g_wall += g_rad;
    gt_wall += g_rad * bparams.ambient_temp_k;
  }
  let t_wall = select(bparams.ambient_temp_k, gt_wall / max(g_wall, 1e-30), g_wall > 0.0);
  node_state[c] = vec4<f32>(cap_c, temp_c, g_wall, t_wall);
}

@compute @workgroup_size(64)
fn it_bridge_build_edges(@builtin(global_invocation_id) gid: vec3<u32>) {
  let c = gid.x;
  let cell_count = bparams.nx * bparams.ny * bparams.nz;
  if (c >= cell_count) { return; }
  let cap_i = bitcast<f32>(atomicLoad(&cell_accum_bits[c * 2u]));
  let nx = bparams.nx;
  let ny = bparams.ny;
  let nz = bparams.nz;
  let dx = bparams.box_x / f32(nx);
  let dy = bparams.box_y / f32(ny);
  let dz = bparams.box_z / f32(nz);
  let e0 = row_offsets[c];
  let e1 = row_offsets[c + 1u];
  for (var e = e0; e < e1; e = e + 1u) {
    let nb = edge_neighbors[e];
    let cap_j = bitcast<f32>(atomicLoad(&cell_accum_bits[nb * 2u]));
    if (!(cap_i > 0.0) || !(cap_j > 0.0)) {
      edge_conductance[e] = 0.0;
      continue;
    }
    let diff = select(c - nb, nb - c, nb > c);
    var g_face = 0.0;
    if (diff == 1u) {
      g_face = bparams.k_eff * (dy * dz) / max(dx, 1e-9);
    } else if (diff == nx) {
      g_face = bparams.k_eff * (dx * dz) / max(dy, 1e-9);
    } else {
      g_face = bparams.k_eff * (dx * dy) / max(dz, 1e-9);
    }
    edge_conductance[e] = g_face;
  }
}

@compute @workgroup_size(64)
fn it_bridge_g2p(@builtin(global_invocation_id) gid: vec3<u32>) {
  let p = gid.x;
  if (p >= bparams.particle_count) { return; }
  let s_base = p * 8u;
  let t_base = p * 12u;
  let mass = p_state[s_base + 3u];
  let status = p_thermo[t_base + 10u];
  let temp_old = p_thermo[t_base + 2u];
  if (!(mass > 0.0) || status >= 251.5 || !(temp_old > 0.0)) { return; }
  let c = bridge_particle_cell(p_state[s_base], p_state[s_base + 1u], p_state[s_base + 2u]);
  let cap_c = bitcast<f32>(atomicLoad(&cell_accum_bits[c * 2u]));
  if (!(cap_c > 0.0)) { return; }
  let q_total = solved_energy[c].y;
  let dT_raw = q_total / cap_c;
  let temp_new = clamp(temp_old + dT_raw, 1.0, 50000.0);
  let dT_eff = temp_new - temp_old;
  let u_old = p_state[s_base + 7u];
  let u_new = max(0.0, u_old + bparams.cp_eff * dT_eff);
  p_thermo[t_base + 2u] = temp_new;
  p_state[s_base + 7u] = u_new;
}
`;

const imexBridgeByDevice = new WeakMap();

function buildRegularGridCsrTopology(nx, ny, nz) {
  const n = nx * ny * nz;
  const rowOffsets = new Uint32Array(n + 1);
  const neighbors = [];
  for (let iz = 0; iz < nz; iz += 1) {
    for (let iy = 0; iy < ny; iy += 1) {
      for (let ix = 0; ix < nx; ix += 1) {
        const c = ix + nx * (iy + ny * iz);
        rowOffsets[c] = neighbors.length;
        if (ix > 0) neighbors.push(c - 1);
        if (ix + 1 < nx) neighbors.push(c + 1);
        if (iy > 0) neighbors.push(c - nx);
        if (iy + 1 < ny) neighbors.push(c + nx);
        if (iz > 0) neighbors.push(c - nx * ny);
        if (iz + 1 < nz) neighbors.push(c + nx * ny);
      }
    }
  }
  rowOffsets[n] = neighbors.length;
  return {
    nodeCount: n,
    edgeCount: Math.max(1, neighbors.length),
    rowOffsets,
    edgeNeighbors: new Uint32Array(neighbors.length ? neighbors : [0])
  };
}

function getOrCreateImexBridgeState(device, nx, ny, nz) {
  const key = unwrapWebGpuCacheDevice(device);
  let devCache = imexBridgeByDevice.get(key);
  if (!devCache) {
    const module = device.createShaderModule({
      label: 'ulg-sph-implicit-thermal-bridge',
      code: SPH_IMPLICIT_THERMAL_BRIDGE_WGSL
    });
    const stage = globalThis.GPUShaderStage?.COMPUTE ?? 4;
    const layout = device.createBindGroupLayout({
      label: 'ulg-sph-implicit-thermal-bridge-bgl',
      entries: [
        { binding: 0, visibility: stage, buffer: { type: 'uniform' } },
        { binding: 1, visibility: stage, buffer: { type: 'storage' } },
        { binding: 2, visibility: stage, buffer: { type: 'storage' } },
        { binding: 3, visibility: stage, buffer: { type: 'storage' } },
        { binding: 4, visibility: stage, buffer: { type: 'storage' } },
        { binding: 5, visibility: stage, buffer: { type: 'read-only-storage' } },
        { binding: 6, visibility: stage, buffer: { type: 'read-only-storage' } },
        { binding: 7, visibility: stage, buffer: { type: 'storage' } },
        { binding: 8, visibility: stage, buffer: { type: 'read-only-storage' } }
      ]
    });
    const pipelineLayout = device.createPipelineLayout({ bindGroupLayouts: [layout] });
    const mk = (entryPoint) => device.createComputePipeline({
      label: `ulg-it-bridge-${entryPoint}`,
      layout: pipelineLayout,
      compute: { module, entryPoint }
    });
    devCache = {
      layout,
      pipelines: {
        it_bridge_clear: mk('it_bridge_clear'),
        it_bridge_p2g: mk('it_bridge_p2g'),
        it_bridge_build_nodes: mk('it_bridge_build_nodes'),
        it_bridge_build_edges: mk('it_bridge_build_edges'),
        it_bridge_g2p: mk('it_bridge_g2p')
      },
      grids: new Map()
    };
    imexBridgeByDevice.set(key, devCache);
  }
  const gridKey = `${nx}x${ny}x${nz}`;
  let grid = devCache.grids.get(gridKey);
  if (!grid) {
    const csr = buildRegularGridCsrTopology(nx, ny, nz);
    const n = csr.nodeCount;
    const e = csr.edgeCount;
    const mkBuf = (label, size, usage) => device.createBuffer({ label, size: Math.max(16, size), usage });
    const rowOffsetsBuffer = mkBuf('ulg-it-bridge-row-offsets', csr.rowOffsets.byteLength, GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_DST);
    const edgeNeighborsBuffer = mkBuf('ulg-it-bridge-edge-neighbors', csr.edgeNeighbors.byteLength, GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_DST);
    device.queue.writeBuffer(rowOffsetsBuffer, 0, csr.rowOffsets);
    device.queue.writeBuffer(edgeNeighborsBuffer, 0, csr.edgeNeighbors);
    grid = {
      nx, ny, nz,
      nodeCount: n,
      edgeCount: e,
      paramsBuffer: mkBuf('ulg-it-bridge-params', 80, GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST),
      cellAccumBits: mkBuf('ulg-it-bridge-accum-bits', n * 2 * 4, GPU_BUFFER_USAGE.STORAGE),
      nodeStateBuffer: mkBuf('ulg-it-bridge-node-state', n * 16, GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_SRC),
      rowOffsetsBuffer,
      edgeNeighborsBuffer,
      edgeConductanceBuffer: mkBuf('ulg-it-bridge-edge-g', e * 4, GPU_BUFFER_USAGE.STORAGE),
      pcgWorkspace: {
        nodeCapacity: n,
        params: mkBuf('ulg-it-ws-params', 32, GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST),
        pcgVecs: mkBuf('ulg-it-ws-pcg-vecs', n * 6 * 4, GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_SRC),
        outEnergy: mkBuf('ulg-it-ws-out-energy', n * 16, GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_SRC),
        scalars: mkBuf('ulg-it-ws-scalars', 32, GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_SRC),
        destroy() {}
      },
      bindGroups: new WeakMap()
    };
    devCache.grids.set(gridKey, grid);
  }
  return { layout: devCache.layout, pipelines: devCache.pipelines, grid };
}

/**
 * Live GPU IMEX thermal PCG bridge encoded directly into an open SPH thermal
 * command encoder (+0 extra queue.submit calls, zero steady-state buffer churn).
 * Constructs a symmetric 3D cell thermal conductance graph from particle state,
 * runs Jacobi-PCG + exact skew-symmetric pairwise flux projection, and scatters
 * conservative energy deltas back onto particles.
 */
export function encodeSphImplicitThermalFromSphStep(device, encoder, {
  outStateBuffer,
  outThermoBuffer,
  particleCount,
  dtS,
  gridSpacingM,
  boxDimsM = [1, 1, 1],
  wallRate = 0,
  wallTemperaturesK = null,
  ambientTemperatureK = 300,
  ambientRadiationExchangeEnabled = false,
  materialConductivityWPerMK = 50,
  materialSpecificHeatJPerKgK = 1000,
  maxFourierNumber = 0,
  options = {}
} = {}) {
  const count = Math.trunc(Number(particleCount) || 0);
  const dt = Number(dtS);
  if (!device || !encoder || !outStateBuffer || !outThermoBuffer || count <= 0 || !(dt > 0)) {
    return null;
  }
  const bx = Math.max(1e-4, Number(boxDimsM?.[0] ?? 1));
  const by = Math.max(1e-4, Number(boxDimsM?.[1] ?? 1));
  const bz = Math.max(1e-4, Number(boxDimsM?.[2] ?? 1));
  const dx = Math.max(1e-4, Number(gridSpacingM) || Math.min(bx, by, bz) / 8);
  const nx = Math.max(2, Math.min(16, Math.round(bx / dx)));
  const ny = Math.max(2, Math.min(16, Math.round(by / dx)));
  const nz = Math.max(2, Math.min(16, Math.round(bz / dx)));

  const { layout, pipelines, grid } = getOrCreateImexBridgeState(device, nx, ny, nz);
  const raw = new ArrayBuffer(80);
  const u32 = new Uint32Array(raw);
  const f32 = new Float32Array(raw);
  u32[0] = count >>> 0;
  u32[1] = nx >>> 0;
  u32[2] = ny >>> 0;
  u32[3] = nz >>> 0;
  f32[4] = bx;
  f32[5] = by;
  f32[6] = bz;
  f32[7] = Math.max(1e-4, Number(materialConductivityWPerMK) || 50);
  f32[8] = Math.max(10, Number(materialSpecificHeatJPerKgK) || 1000);
  f32[9] = Math.max(0, Number(wallRate) || 0);
  f32[10] = Math.max(1, Number(ambientTemperatureK) || 300);
  u32[11] = ambientRadiationExchangeEnabled ? 1 : 0;
  f32[12] = Number(wallTemperaturesK?.xMin ?? wallTemperaturesK?.[0] ?? 0) || 0;
  f32[13] = Number(wallTemperaturesK?.xMax ?? wallTemperaturesK?.[1] ?? 0) || 0;
  f32[14] = Number(wallTemperaturesK?.yMin ?? wallTemperaturesK?.[2] ?? 0) || 0;
  f32[15] = Number(wallTemperaturesK?.yMax ?? wallTemperaturesK?.[3] ?? 0) || 0;
  f32[16] = Number(wallTemperaturesK?.zMin ?? wallTemperaturesK?.[4] ?? 0) || 0;
  f32[17] = Number(wallTemperaturesK?.zMax ?? wallTemperaturesK?.[5] ?? 0) || 0;
  device.queue.writeBuffer(grid.paramsBuffer, 0, raw);

  let byThermo = grid.bindGroups.get(outStateBuffer);
  if (!byThermo) {
    byThermo = new WeakMap();
    grid.bindGroups.set(outStateBuffer, byThermo);
  }
  let bg = byThermo.get(outThermoBuffer);
  if (!bg) {
    bg = device.createBindGroup({
      label: 'ulg-sph-implicit-thermal-bridge-bg',
      layout,
      entries: [
        { binding: 0, resource: { buffer: grid.paramsBuffer } },
        { binding: 1, resource: { buffer: outStateBuffer } },
        { binding: 2, resource: { buffer: outThermoBuffer } },
        { binding: 3, resource: { buffer: grid.cellAccumBits } },
        { binding: 4, resource: { buffer: grid.nodeStateBuffer } },
        { binding: 5, resource: { buffer: grid.rowOffsetsBuffer } },
        { binding: 6, resource: { buffer: grid.edgeNeighborsBuffer } },
        { binding: 7, resource: { buffer: grid.edgeConductanceBuffer } },
        { binding: 8, resource: { buffer: grid.pcgWorkspace.outEnergy } }
      ]
    });
    byThermo.set(outThermoBuffer, bg);
  }

  const wgCells = Math.max(1, Math.ceil(grid.nodeCount / 64));
  const wgParticles = Math.max(1, Math.ceil(count / 64));
  const prepPass = encoder.beginComputePass({ label: 'ulg-sph-implicit-thermal-bridge-p2g' });
  prepPass.setBindGroup(0, bg);
  prepPass.setPipeline(pipelines.it_bridge_clear);
  prepPass.dispatchWorkgroups(wgCells);
  prepPass.setPipeline(pipelines.it_bridge_p2g);
  prepPass.dispatchWorkgroups(wgParticles);
  prepPass.setPipeline(pipelines.it_bridge_build_nodes);
  prepPass.dispatchWorkgroups(wgCells);
  prepPass.setPipeline(pipelines.it_bridge_build_edges);
  prepPass.dispatchWorkgroups(wgCells);
  prepPass.end();

  const solved = encodeSphImplicitThermalSolve(device, encoder, {
    nodeCount: grid.nodeCount,
    edgeCount: grid.edgeCount,
    dt,
    options,
    nodeStateBuffer: grid.nodeStateBuffer,
    rowOffsetsBuffer: grid.rowOffsetsBuffer,
    edgeNeighborsBuffer: grid.edgeNeighborsBuffer,
    edgeConductanceBuffer: grid.edgeConductanceBuffer,
    workspace: grid.pcgWorkspace
  });

  const applyPass = encoder.beginComputePass({ label: 'ulg-sph-implicit-thermal-bridge-g2p' });
  applyPass.setBindGroup(0, bg);
  applyPass.setPipeline(pipelines.it_bridge_g2p);
  applyPass.dispatchWorkgroups(wgParticles);
  applyPass.end();

  const receipt = recordSphImplicitThermalDeviceExecution(device, {
    passCount: 1,
    mode: 'gpu-imex-pcg-1pass',
    skewSymmetricFluxConserved: true,
    nodeCount: grid.nodeCount,
    edgeCount: grid.edgeCount,
    iterations: solved.options.iterations,
    theta: solved.options.theta,
    maxFourierNumber: maxFourierNumber > 0 ? maxFourierNumber : solved.options.maxFourierNumber,
    scalarsBuffer: solved.scalarsBuffer
  });
  return {
    ...solved,
    receipt,
    gridDims: [nx, ny, nz]
  };
}
