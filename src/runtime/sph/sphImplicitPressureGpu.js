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
import {
  DEFAULT_TAIT_EOS_REGIONAL_GENERATOR_WGSL,
  adoptExternalRegionalResponseTable,
  createRegionalClosureWorkerLane,
  destroyRegionalClosureWorkerLane,
  encodeRegionalClosureLaneAdopt,
  encodeRegionalClosureLaneEvaluate,
  regionalClosureLaneBindings
} from '../material/regionalClosureWorkerLane.js';
import { packResponseFunctionsForGpu, responseFunctionGpuWgsl } from '../material/responseFunctionGpu.js';
import { createCachedExplicitBindGroup } from '../webgpuComputeLayout.js';
import { unwrapWebGpuCacheDevice } from '../webgpuComputeLayout.js';
import {
  MLS_MPM_GPU_PARTICLE_MECHANICS_ROW_LAYOUT,
  SPH_GPU_PARTICLE_STATE_ROW_LAYOUT,
  SPH_GPU_PARTICLE_THERMO_ROW_LAYOUT,
  generateRepresentedVolumeWgsl,
  generateVec4LaneAccessorsWgsl
} from '../../../ulg-gpu-abi/src/index.js';
import { assertBindGroupMatchesLawDescriptor } from './lawAdapterContract.js';
import { getCanonicalLawAdapterDescriptor } from './lawDagEpochScheduler.js';
import { createGpuResourceLeaseScope } from './gpuResourceLease.js';

export const SPH_IMPLICIT_PRESSURE_LAW_ADAPTER_DESCRIPTOR =
  getCanonicalLawAdapterDescriptor('implicit-pressure-solve');
export const SPH_IMPLICIT_PRESSURE_RESOURCE_BINDING_TABLE = Object.freeze({
  'sph-particle-state': 1,
  'sph-thermo-phase': 2,
  'mls-mpm-mechanics': 3,
  'mls-mpm-grid-velocity': 4,
  'implicit-pressure-cg-scratch': 6
});

const SPH_IMPLICIT_PRESSURE_LANE_ACCESSORS_WGSL = [
  generateVec4LaneAccessorsWgsl({
    layout: SPH_GPU_PARTICLE_STATE_ROW_LAYOUT,
    layoutName: 'SPH_GPU_PARTICLE_STATE_ROW_LAYOUT',
    bufferName: 'sph_state',
    prefix: 'ip_state',
    fields: ['massKg'],
    includeWriters: false
  }),
  generateVec4LaneAccessorsWgsl({
    layout: SPH_GPU_PARTICLE_THERMO_ROW_LAYOUT,
    layoutName: 'SPH_GPU_PARTICLE_THERMO_ROW_LAYOUT',
    bufferName: 'sph_thermo',
    prefix: 'ip_thermo',
    fields: ['restDensityKgPerM3'],
    includeWriters: false
  }),
  generateVec4LaneAccessorsWgsl({
    layout: MLS_MPM_GPU_PARTICLE_MECHANICS_ROW_LAYOUT,
    layoutName: 'MLS_MPM_GPU_PARTICLE_MECHANICS_ROW_LAYOUT',
    bufferName: 'mls_mechanics',
    prefix: 'ip_mech',
    fields: ['solidFlag', 'effectiveBulkModulusPa', 'soundSpeedMPerS', 'eosModelId'],
    includeWriters: false
  }),
  generateRepresentedVolumeWgsl({
    mechanicsLayout: MLS_MPM_GPU_PARTICLE_MECHANICS_ROW_LAYOUT,
    bufferName: 'mls_mechanics'
  })
].join('\n\n');

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
export const SPH_IMPLICIT_PRESSURE_MAX_ADVECTIVE_CFL = 0.5;
export const SPH_IMPLICIT_PRESSURE_MAX_LINEARIZATION_ERROR = 0.05;
export const SPH_IMPLICIT_PRESSURE_ENVELOPE_WATCH_SCHEMA = 'ulg.sph.implicit-pressure-envelope-watch.v1';

/**
 * Evaluate the per-node physical admissibility envelope for Eshkol-AD
 * semi-implicit Tait pressure on coupled multi-material & N-level chain lanes:
 *   1. Acoustic CFL: c * dt / dx <= maxAcousticCfl (6.4)
 *   2. Advective CFL: |v| * dt / dx <= maxAdvectiveCfl (0.5)
 *   3. Tait EOS second-order linearization error:
 *        0.5 * (gamma - 1) * (|v| * dt / dx)^2 <= maxLinearizationError (0.05)
 * Outside the envelope, fallbackMode switches cleanly to 'explicit-substep'
 * with exact dyadic substep recommendation (zero silent extrapolation).
 */
export function evaluateImplicitPressurePerNodeEnvelope({
  soundSpeedMPerS,
  maxFluidSpeedMPerS = 0,
  gridSpacingM,
  dtS,
  gamma = 7,
  maxAcousticCfl = SPH_IMPLICIT_PRESSURE_MAX_CFL,
  maxAdvectiveCfl = SPH_IMPLICIT_PRESSURE_MAX_ADVECTIVE_CFL,
  maxLinearizationError = SPH_IMPLICIT_PRESSURE_MAX_LINEARIZATION_ERROR
} = {}) {
  const c = Math.max(0, Number(soundSpeedMPerS) || 0);
  const v = Math.max(0, Number(maxFluidSpeedMPerS) || 0);
  const dx = Number(gridSpacingM);
  const dt = Number(dtS);
  if (!(dx > 0) || !(dt > 0)) {
    return Object.freeze({
      schema: SPH_IMPLICIT_PRESSURE_ENVELOPE_WATCH_SCHEMA,
      admitted: false,
      acousticCfl: 0,
      advectiveCfl: 0,
      linearizationResidual: 0,
      fallbackMode: 'explicit-substep',
      recommendedSubsteps: 1,
      reason: 'invalid-grid-or-dt'
    });
  }
  const acousticCfl = (c * dt) / dx;
  const advectiveCfl = (v * dt) / dx;
  const linearizationResidual = 0.5 * Math.max(1, Number(gamma) - 1) * advectiveCfl * advectiveCfl;
  let reason = 'admitted';
  if (acousticCfl > maxAcousticCfl) reason = 'acoustic-cfl-exceeded';
  else if (advectiveCfl > maxAdvectiveCfl) reason = 'advective-cfl-exceeded';
  else if (linearizationResidual > maxLinearizationError) reason = 'tait-linearization-exceeded';
  const admitted = reason === 'admitted';
  const neededRatio = Math.max(
    1,
    acousticCfl / Math.max(1e-9, maxAcousticCfl),
    advectiveCfl / Math.max(1e-9, maxAdvectiveCfl),
    Math.sqrt(linearizationResidual / Math.max(1e-9, maxLinearizationError))
  );
  const recommendedSubsteps = admitted ? 1 : Math.min(8, 2 ** Math.ceil(Math.log2(neededRatio)));
  return Object.freeze({
    schema: SPH_IMPLICIT_PRESSURE_ENVELOPE_WATCH_SCHEMA,
    admitted,
    acousticCfl,
    advectiveCfl,
    linearizationResidual,
    fallbackMode: admitted ? 'implicit-cg' : 'explicit-substep',
    recommendedSubsteps,
    reason
  });
}

// GPU-native per-node semi-implicit pressure envelope watch shader.
// Receipt (6 atomic u32 words):
//   [0] admittedNodes
//   [1] acousticCflBreaches
//   [2] advectiveCflBreaches
//   [3] linearizationBreaches
//   [4] maxAdvectiveCflMicro (u32 fixed-point * 1e6)
//   [5] fallbackRequired (0 or 1)
export const sphImplicitPressureEnvelopeWatchWgsl = /* wgsl */ `
struct EnvelopeWatchParams {
  node_count: u32,
  pad0: u32,
  pad1: u32,
  pad2: u32,
  dt: f32,
  inv_dx: f32,
  sound_speed: f32,
  gamma_minus_1: f32,
  max_acoustic_cfl: f32,
  max_advective_cfl: f32,
  max_lin_err: f32,
  pad3: f32,
};
@group(0) @binding(0) var<uniform> ew_params: EnvelopeWatchParams;
@group(0) @binding(1) var<storage, read> ew_vel_mass: array<vec4<f32>>;
@group(0) @binding(2) var<storage, read_write> ew_receipt: array<atomic<u32>>;

@compute @workgroup_size(64)
fn ip_envelope_watch(@builtin(global_invocation_id) gid: vec3<u32>) {
  let i = gid.x;
  if (i >= ew_params.node_count) { return; }
  let vm = ew_vel_mass[i];
  if (!(vm.w > 0.0)) { return; }
  let speed = length(vm.xyz);
  let adv_cfl = speed * ew_params.dt * ew_params.inv_dx;
  let ac_cfl = ew_params.sound_speed * ew_params.dt * ew_params.inv_dx;
  let lin_err = 0.5 * ew_params.gamma_minus_1 * adv_cfl * adv_cfl;
  atomicMax(&ew_receipt[4], u32(clamp(adv_cfl * 1000000.0, 0.0, 4294967000.0)));
  var breached = false;
  if (ac_cfl > ew_params.max_acoustic_cfl) { atomicAdd(&ew_receipt[1], 1u); breached = true; }
  if (adv_cfl > ew_params.max_advective_cfl) { atomicAdd(&ew_receipt[2], 1u); breached = true; }
  if (lin_err > ew_params.max_lin_err) { atomicAdd(&ew_receipt[3], 1u); breached = true; }
  if (breached) {
    atomicStore(&ew_receipt[5], 1u);
  } else {
    atomicAdd(&ew_receipt[0], 1u);
  }
}
`;

export async function runSphImplicitPressureEnvelopeWatchWebGpu(device, {
  nodeVelocityMassRows,
  gridSpacingM,
  dtS,
  soundSpeedMPerS = 180,
  gamma = 7,
  maxAcousticCfl = SPH_IMPLICIT_PRESSURE_MAX_CFL,
  maxAdvectiveCfl = SPH_IMPLICIT_PRESSURE_MAX_ADVECTIVE_CFL,
  maxLinearizationError = SPH_IMPLICIT_PRESSURE_MAX_LINEARIZATION_ERROR
} = {}) {
  const n = Math.floor((nodeVelocityMassRows?.length || 0) / 4);
  if (!(n > 0)) throw new RangeError('runSphImplicitPressureEnvelopeWatchWebGpu requires non-empty nodeVelocityMassRows');
  const stage = globalThis.GPUShaderStage?.COMPUTE ?? 4;
  const mod = device.createShaderModule({ label: 'ulg-ip-envelope-watch', code: sphImplicitPressureEnvelopeWatchWgsl });
  const layout = device.createBindGroupLayout({
    entries: [
      { binding: 0, visibility: stage, buffer: { type: 'uniform' } },
      { binding: 1, visibility: stage, buffer: { type: 'read-only-storage' } },
      { binding: 2, visibility: stage, buffer: { type: 'storage' } }
    ]
  });
  const pipeline = device.createComputePipeline({
    label: 'ulg-ip-envelope-watch-pipeline',
    layout: device.createPipelineLayout({ bindGroupLayouts: [layout] }),
    compute: { module: mod, entryPoint: 'ip_envelope_watch' }
  });
  const paramsBytes = new ArrayBuffer(48);
  new Uint32Array(paramsBytes).set([n, 0, 0, 0]);
  new Float32Array(paramsBytes).set([
    Math.fround(dtS), Math.fround(1 / gridSpacingM), Math.fround(soundSpeedMPerS), Math.fround(Math.max(1, gamma - 1)),
    Math.fround(maxAcousticCfl), Math.fround(maxAdvectiveCfl), Math.fround(maxLinearizationError), 0
  ], 4);
  const leaseScope = createGpuResourceLeaseScope({ scopeId: 'sph-implicit-pressure-envelope-watch' });
  const pBuf = device.createBuffer({ size: 48, usage: 0x40 | 0x08 });
  const vmData = nodeVelocityMassRows instanceof Float32Array ? nodeVelocityMassRows : new Float32Array(nodeVelocityMassRows);
  const vmBuf = device.createBuffer({ size: Math.max(16, vmData.byteLength), usage: 0x80 | 0x08 });
  const rcBuf = device.createBuffer({ size: 24, usage: 0x80 | 0x04 | 0x08 });
  const readBuf = device.createBuffer({ size: 24, usage: 0x01 | 0x08 });
  const leases = [
    leaseScope.issue(pBuf, { label: 'ip-ew-params', producer: 'implicit-pressure-envelope-watch', onRelease: (b) => b.destroy() }),
    leaseScope.issue(vmBuf, { label: 'ip-ew-vel-mass', producer: 'implicit-pressure-envelope-watch', onRelease: (b) => b.destroy() }),
    leaseScope.issue(rcBuf, { label: 'ip-ew-receipt', producer: 'implicit-pressure-envelope-watch', onRelease: (b) => b.destroy() }),
    leaseScope.issue(readBuf, { label: 'ip-ew-readback', producer: 'implicit-pressure-envelope-watch', onRelease: (b) => b.destroy() })
  ];
  device.queue.writeBuffer(pBuf, 0, paramsBytes);
  device.queue.writeBuffer(vmBuf, 0, vmData);
  device.queue.writeBuffer(rcBuf, 0, new Uint32Array(6));
  try {
    const bg = device.createBindGroup({
      layout,
      entries: [
        { binding: 0, resource: { buffer: pBuf } },
        { binding: 1, resource: { buffer: vmBuf } },
        { binding: 2, resource: { buffer: rcBuf } }
      ]
    });
    const enc = device.createCommandEncoder({ label: 'ulg-ip-envelope-watch' });
    const pass = enc.beginComputePass({ label: 'ulg-ip-envelope-watch-pass' });
    pass.setPipeline(pipeline);
    pass.setBindGroup(0, bg);
    pass.dispatchWorkgroups(Math.ceil(n / 64));
    pass.end();
    enc.copyBufferToBuffer(rcBuf, 0, readBuf, 0, 24);
    device.queue.submit([enc.finish()]);
    await readBuf.mapAsync(0x01);
    const words = new Uint32Array(readBuf.getMappedRange().slice(0));
    readBuf.unmap();
    return Object.freeze({
      schema: SPH_IMPLICIT_PRESSURE_ENVELOPE_WATCH_SCHEMA,
      admittedNodes: words[0],
      acousticCflBreaches: words[1],
      advectiveCflBreaches: words[2],
      linearizationBreaches: words[3],
      maxAdvectiveCfl: words[4] / 1e6,
      fallbackRequired: words[5] === 1
    });
  } finally {
    for (const lease of leases) leaseScope.release(lease, { by: 'implicit-pressure-envelope-watch-finally' });
    leaseScope.assertDrained({ requireAllReleased: true });
  }
}
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
    // Relative residual at which the CG stops early (GPU-side); defaults to
    // 1e-3 (squared 1e-6) so converged solves skip redundant iterations while
    // explicit 0 runs every iteration unconditionally.
    relativeTolerance: source.relativeTolerance === undefined
      ? 1e-3
      : (Number.isFinite(Number(source.relativeTolerance)) && Number(source.relativeTolerance) > 0
          ? Math.min(Number(source.relativeTolerance), 0.5)
          : 0),
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
@group(0) @binding(6) var<storage, read_write> iter_acc: array<atomic<i32>>;
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

fn ip_particle_kv_offset() -> u32 {
  let node_groups = (params.grid_node_count + 127u) / 128u;
  let particle_groups = (params.particle_count + 127u) / 128u;
  return max(2u * node_groups, particle_groups);
}
fn ip_sorted_particle_offset() -> u32 {
  return ip_particle_kv_offset() + params.particle_count;
}
fn ip_bucket_dims() -> vec3<u32> {
  return vec3<u32>(
    max(1u, min(32u, (params.grid_nx + 1u) / 2u)),
    max(1u, min(32u, (params.grid_ny + 1u) / 2u)),
    max(1u, min(32u, (params.grid_nz + 1u) / 2u))
  );
}
fn ip_particle_bucket(pos: vec3<f32>, bdims: vec3<u32>) -> u32 {
  let p_grid = pos * params.inv_grid_spacing_m;
  let s = i32(params.shift);
  let cx = u32(clamp((i32(floor(p_grid.x - 0.5)) + s) >> 1, 0i, i32(bdims.x) - 1i));
  let cy = u32(clamp((i32(floor(p_grid.y - 0.5)) + s) >> 1, 0i, i32(bdims.y) - 1i));
  let cz = u32(clamp((i32(floor(p_grid.z - 0.5)) + s) >> 1, 0i, i32(bdims.z) - 1i));
  return (cx * bdims.y + cy) * bdims.z + cz;
}

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

${SPH_IMPLICIT_PRESSURE_LANE_ACCESSORS_WGSL}

// K V theta of a particle on the implicit operator: Tait liquids only, the
// same density, rest density, sound speed and cavitation floor as P2G's
// packed_pressure; solids, gas and invalid volumes contribute nothing.
// Reads canonical ABI lanes via generated vec4 accessors + paired RepresentedVolume.
fn ip_particle_weight(particle_index: u32) -> f32 {
  let rep_vol = represented_volume_from_mechanics(particle_index);
  let volume = select(0.0, rep_vol.current_m3, rep_vol.valid == 1u);
  if (!(volume > 0.0)) { return 0.0; }
  if (ip_mech_solid_flag(particle_index) > 0.5 && ip_mech_effective_bulk_modulus_pa(particle_index) > 0.0) { return 0.0; }
  let eos_model = ip_mech_eos_model_id(particle_index);
  if (!(eos_model > 0.5 && eos_model < 1.5)) { return 0.0; }
  let c = ip_mech_sound_speed_m_per_s(particle_index);
  let rho0 = ip_thermo_rest_density_kg_per_m3(particle_index);
  let mass = ip_state_mass_kg(particle_index);
  if (!(c > 0.0) || !(rho0 > 0.0) || !(mass > 0.0)) { return 0.0; }
  let rho = mass / volume;
  let ratio = rho / rho0;
  // Physical cavitation floor (P_gauge >= 0): expanded/cavitated liquid has
  // dp/drho = 0 so implicit pressure never applies artificial bulk tensile
  // pull. Rest-density and compressed liquid (ratio >= 1 - eps) retains full
  // bulk modulus K to project compressive velocity fields divergence-free.
  if (ratio < 0.9999) { return 0.0; }
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
// Deterministic signed 32-bit fixed-point L2 reduction sums (3 i32 words =
// 12 bytes/node, 4x smaller than split 64-bit). Because the return value of
// atomicAdd is unused, SPIR-V/PTX emits fire-and-forget RED.E.ADD in L2
// without SM round-trip stalls while staying commutative and bit-reproducible.
fn ip_atomic_add_twos64(component: u32, scaled_value: f32) {
  let qi = i32(round(clamp(scaled_value, -2147483520.0, 2147483520.0)));
  if (qi != 0) { atomicAdd(&iter_acc[component], qi); }
}
fn ip_take_fixed(component: u32, scale: f32) -> f32 {
  return f32(atomicExchange(&iter_acc[component], 0)) / scale;
}

// Matrix-free Q2 quadratic B-spline (3x3x3) divergence operator D matching G2P:
// A = (dt^2 / m) D^T (V K theta) D, strictly SPD in the mass inner product.
// Uses biased two's-complement 64-bit accumulators (24 B/node) and cg_p.w mass
// packing (halving gather loads across all CG iterations) with a compact loop
// to keep SM register pressure low and Blackwell occupancy high.
@compute @workgroup_size(128)
fn ip_particle_apply(@builtin(global_invocation_id) id: vec3<u32>) {
  let active_count = atomicLoad(&scalars[11]);
  if (id.x >= active_count) { return; }
  if (params.source_is_direction == 1u && ip_converged()) { return; }
  let sorted_base = ip_sorted_particle_offset() + id.x * 4u;
  let pos = vec3<f32>(partials[sorted_base], partials[sorted_base + 1u], partials[sorted_base + 2u]);
  let kv = partials[sorted_base + 3u];
  if (kv == 0.0) { return; }
  let inv_h = params.inv_grid_spacing_m;
  let p_grid = pos * inv_h;
  let bx = i32(floor(p_grid.x - 0.5));
  let by = i32(floor(p_grid.y - 0.5));
  let bz = i32(floor(p_grid.z - 0.5));
  let wx = ip_weights(p_grid.x - f32(bx));
  let wy = ip_weights(p_grid.y - f32(by));
  let wz = ip_weights(p_grid.z - f32(bz));
  let rx = vec3<f32>(f32(bx), f32(bx + 1i), f32(bx + 2i)) - vec3<f32>(p_grid.x);
  let ry = vec3<f32>(f32(by), f32(by + 1i), f32(by + 2i)) - vec3<f32>(p_grid.y);
  let rz = vec3<f32>(f32(bz), f32(bz + 1i), f32(bz + 2i)) - vec3<f32>(p_grid.z);
  if (params.source_is_direction == 2u) {
    let coeff = kv * params.dt * (16.0 * inv_h * inv_h) * ip_scalar(6u);
    for (var a = 0i; a < 3i; a = a + 1i) {
      let wa = ip_weight_at(wx, a);
      let rxa = ip_weight_at(rx, a);
      let ni = bx + a;
      for (var b = 0i; b < 3i; b = b + 1i) {
        let wab = wa * ip_weight_at(wy, b);
        let ryb = ip_weight_at(ry, b);
        let nj = by + b;
        for (var c = 0i; c < 3i; c = c + 1i) {
          let nk = bz + c;
          if (!ip_in_range(ni, nj, nk)) { continue; }
          let idx = ip_grid_index(ni, nj, nk);
          if (!(grid_nodes[idx * 2u].x > 0.0)) { continue; }
          let w = wab * ip_weight_at(wz, c);
          let w2 = coeff * w * w;
          let rzc = ip_weight_at(rz, c);
          ip_atomic_add_twos64(idx * 3u, w2 * rxa * rxa);
          ip_atomic_add_twos64(idx * 3u + 1u, w2 * ryb * ryb);
          ip_atomic_add_twos64(idx * 3u + 2u, w2 * rzc * rzc);
        }
      }
    }
    return;
  }
  let s_shift = i32(params.shift);
  let interior = bx + s_shift >= 0 && by + s_shift >= 0 && bz + s_shift >= 0
    && bx + s_shift + 2 < i32(params.grid_nx)
    && by + s_shift + 2 < i32(params.grid_ny)
    && bz + s_shift + 2 < i32(params.grid_nz);
  let use_dir = params.source_is_direction != 0u;
  var div = 0.0;
  var active_mask = 0u;
  if (interior) {
    let ny = params.grid_ny;
    let nz = params.grid_nz;
    let stride_x = ny * nz;
    let base_idx = (u32(bx + s_shift) * ny + u32(by + s_shift)) * nz + u32(bz + s_shift);
    var bit = 1u;
    if (use_dir) {
      for (var a = 0u; a < 3u; a = a + 1u) {
        let wa = wx[a];
        let rxa = rx[a];
        let row_x = base_idx + a * stride_x;
        for (var b = 0u; b < 3u; b = b + 1u) {
          let wab = wa * wy[b];
          let ryb = ry[b];
          let row_xy = row_x + b * nz;
          for (var c = 0u; c < 3u; c = c + 1u) {
            let p4 = cg_p[row_xy + c];
            if (p4.w > 0.0) {
              active_mask = active_mask | bit;
              div = div + (wab * wz[c]) * (p4.x * rxa + p4.y * ryb + p4.z * rz[c]);
            }
            bit = bit << 1u;
          }
        }
      }
    } else {
      for (var a = 0u; a < 3u; a = a + 1u) {
        let wa = wx[a];
        let rxa = rx[a];
        let row_x = base_idx + a * stride_x;
        for (var b = 0u; b < 3u; b = b + 1u) {
          let wab = wa * wy[b];
          let ryb = ry[b];
          let row_xy = row_x + b * nz;
          for (var c = 0u; c < 3u; c = c + 1u) {
            let n0 = grid_nodes[(row_xy + c) * 2u];
            if (n0.x > 0.0) {
              active_mask = active_mask | bit;
              div = div + (wab * wz[c]) * (n0.y * rxa + n0.z * ryb + n0.w * rz[c]);
            }
            bit = bit << 1u;
          }
        }
      }
    }
    let s_scaled = kv * params.dt * (16.0 * inv_h * inv_h) * div * ip_scalar(5u);
    if (s_scaled == 0.0) { return; }
    bit = 1u;
    for (var a = 0u; a < 3u; a = a + 1u) {
      let wa = wx[a];
      let rxa = rx[a];
      let row_x = base_idx + a * stride_x;
      for (var b = 0u; b < 3u; b = b + 1u) {
        let swab = s_scaled * wa * wy[b];
        let ryb = ry[b];
        let row_xy = row_x + b * nz;
        for (var c = 0u; c < 3u; c = c + 1u) {
          if ((active_mask & bit) != 0u) {
            let idx = row_xy + c;
            let sw = swab * wz[c];
            ip_atomic_add_twos64(idx * 3u, sw * rxa);
            ip_atomic_add_twos64(idx * 3u + 1u, sw * ryb);
            ip_atomic_add_twos64(idx * 3u + 2u, sw * rz[c]);
          }
          bit = bit << 1u;
        }
      }
    }
    return;
  }
  var bit = 1u;
  for (var a = 0i; a < 3i; a = a + 1i) {
    let wa = ip_weight_at(wx, a);
    let rxa = ip_weight_at(rx, a);
    let ni = bx + a;
    for (var b = 0i; b < 3i; b = b + 1i) {
      let wab = wa * ip_weight_at(wy, b);
      let ryb = ip_weight_at(ry, b);
      let nj = by + b;
      for (var c = 0i; c < 3i; c = c + 1i) {
        let nk = bz + c;
        if (ip_in_range(ni, nj, nk)) {
          let idx = ip_grid_index(ni, nj, nk);
          if (use_dir) {
            let p4 = cg_p[idx];
            if (p4.w > 0.0) {
              active_mask = active_mask | bit;
              div = div + (wab * ip_weight_at(wz, c)) * (p4.x * rxa + p4.y * ryb + p4.z * ip_weight_at(rz, c));
            }
          } else {
            let node0 = grid_nodes[idx * 2u];
            if (node0.x > 0.0) {
              active_mask = active_mask | bit;
              div = div + (wab * ip_weight_at(wz, c)) * (node0.y * rxa + node0.z * ryb + node0.w * ip_weight_at(rz, c));
            }
          }
        }
        bit = bit << 1u;
      }
    }
  }
  let s_scaled = kv * params.dt * (16.0 * inv_h * inv_h) * div * ip_scalar(5u);
  if (s_scaled == 0.0) { return; }
  bit = 1u;
  for (var a = 0i; a < 3i; a = a + 1i) {
    let wa = ip_weight_at(wx, a);
    let rxa = ip_weight_at(rx, a);
    let ni = bx + a;
    for (var b = 0i; b < 3i; b = b + 1i) {
      let swab = s_scaled * wa * ip_weight_at(wy, b);
      let ryb = ip_weight_at(ry, b);
      let nj = by + b;
      for (var c = 0i; c < 3i; c = c + 1i) {
        if ((active_mask & bit) != 0u) {
          let nk = bz + c;
          let idx = ip_grid_index(ni, nj, nk);
          let sw = swab * ip_weight_at(wz, c);
          ip_atomic_add_twos64(idx * 3u, sw * rxa);
          ip_atomic_add_twos64(idx * 3u + 1u, sw * ryb);
          ip_atomic_add_twos64(idx * 3u + 2u, sw * ip_weight_at(rz, c));
        }
        bit = bit << 1u;
      }
    }
  }
}

@compute @workgroup_size(128)
fn ip_clear_iteration(@builtin(global_invocation_id) id: vec3<u32>) {
  if (id.x >= params.grid_node_count) { return; }
  let base = id.x * 3u;
  atomicStore(&iter_acc[base], 0);
  atomicStore(&iter_acc[base + 1u], 0);
  atomicStore(&iter_acc[base + 2u], 0);
  let bdims = ip_bucket_dims();
  let num_buckets = bdims.x * bdims.y * bdims.z;
  if (id.x < num_buckets) {
    atomicStore(&scalars[16u + id.x], 0u);
  }
}

// The fixed-point scales, from max_p (K V theta) on the GPU: one particle
// pass of workgroup maxima + 2x2x2 super-cell bucket counting, then ip_reduce_scale.
@compute @workgroup_size(128)
fn ip_particle_kv_max(@builtin(global_invocation_id) id: vec3<u32>, @builtin(local_invocation_index) local: u32,
    @builtin(workgroup_id) group: vec3<u32>) {
  var kv = 0.0;
  if (id.x < params.particle_count) {
    kv = ip_particle_weight(id.x);
    partials[ip_particle_kv_offset() + id.x] = kv;
    if (kv > 0.0) {
      let bdims = ip_bucket_dims();
      let bucket = ip_particle_bucket(sph_state[id.x * 2u].xyz, bdims);
      atomicAdd(&scalars[16u + bucket], 1u);
    }
  }
  partial[local] = kv;
  workgroupBarrier();
  var stride = 64u;
  loop {
    if (local < stride) { partial[local] = max(partial[local], partial[local + stride]); }
    workgroupBarrier();
    if (stride == 1u) { break; }
    stride = stride / 2u;
  }
  if (local == 0u) { partials[group.x] = partial[0]; }
}

const IP_FIXED_LIMIT: f32 = 1.6106127e9;
@compute @workgroup_size(256)
fn ip_reduce_scale(@builtin(local_invocation_index) local: u32) {
  let groups = (params.particle_count + 127u) / 128u;
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
    let inv_h = params.inv_grid_spacing_m;
    let per_source = 128.0 * partial[0] * params.dt * inv_h * inv_h;
    ip_set_scalar(7u, per_source);
    let apply_bound = per_source * max(params.max_speed_m_per_s, 1.0e-6);
    ip_set_scalar(5u, select(1.0, IP_FIXED_LIMIT / apply_bound, apply_bound > 0.0));
    ip_set_scalar(6u, select(1.0, IP_FIXED_LIMIT / per_source, per_source > 0.0));
  }
  workgroupBarrier();
  // Prefix-sum the 2x2x2 super-cell bucket counts into scalars[16 + 32768 ..]
  // and publish compacted active liquid count at scalars[11].
  let bdims = ip_bucket_dims();
  let num_buckets = bdims.x * bdims.y * bdims.z;
  let chunk = (num_buckets + 255u) / 256u;
  let b_start = local * chunk;
  let b_end = min(num_buckets, b_start + chunk);
  var thread_sum = 0u;
  for (var b = b_start; b < b_end; b = b + 1u) {
    thread_sum = thread_sum + atomicLoad(&scalars[16u + b]);
  }
  partial[local] = f32(thread_sum);
  workgroupBarrier();
  if (local == 0u) {
    var acc = 0.0;
    for (var t = 0u; t < 256u; t = t + 1u) {
      let c_val = partial[t];
      partial[t] = acc;
      acc = acc + c_val;
    }
    atomicStore(&scalars[11], u32(acc));
  }
  workgroupBarrier();
  var cursor = u32(partial[local]);
  for (var b = b_start; b < b_end; b = b + 1u) {
    let cnt = atomicLoad(&scalars[16u + b]);
    atomicStore(&scalars[16u + 32768u + b], cursor);
    cursor = cursor + cnt;
  }
}

@compute @workgroup_size(128)
fn ip_scatter_particles(@builtin(global_invocation_id) id: vec3<u32>) {
  if (id.x >= params.particle_count) { return; }
  let kv = partials[ip_particle_kv_offset() + id.x];
  if (!(kv > 0.0)) { return; }
  let pos = sph_state[id.x * 2u].xyz;
  let bdims = ip_bucket_dims();
  let bucket = ip_particle_bucket(pos, bdims);
  let slot = atomicAdd(&scalars[16u + 32768u + bucket], 1u);
  let dst = ip_sorted_particle_offset() + slot * 4u;
  partials[dst] = pos.x;
  partials[dst + 1u] = pos.y;
  partials[dst + 2u] = pos.z;
  partials[dst + 3u] = kv;
}
// The next application's scale from max |p| (node workgroup maxima in
// partials[groups..2 groups)).
fn ip_set_direction_scale(local: u32) {
  let groups = (params.grid_node_count + 127u) / 128u;
  var p_max = 0.0;
  if (!ip_converged()) {
    for (var i = local; i < groups; i = i + 256u) { p_max = max(p_max, partials[groups + i]); }
  }
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
  if (local == 0u && !ip_converged()) {
    let bound = ip_scalar(7u) * partial[0];
    ip_set_scalar(5u, select(1.0, IP_FIXED_LIMIT / bound, bound > 0.0));
  }
}
fn ip_workgroup_max_into(group: u32, local: u32, value: f32) {
  let groups = (params.grid_node_count + 127u) / 128u;
  workgroupBarrier();
  partial[local] = value;
  workgroupBarrier();
  var stride = 64u;
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

// Workgroup tree sum of 128 values; the workgroup's sum goes to partials.
fn ip_workgroup_partial(group: u32, local: u32, value: f32) {
  partial[local] = value;
  workgroupBarrier();
  var stride = 64u;
  loop {
    if (local < stride) { partial[local] = partial[local] + partial[local + stride]; }
    workgroupBarrier();
    if (stride == 1u) { break; }
    stride = stride / 2u;
  }
  if (local == 0u) { partials[group] = partial[0]; }
}
// One 256-thread workgroup sums every node workgroup's partial in a fixed order.
fn ip_reduce_partials(local: u32, skip_if_converged: bool) -> f32 {
  let groups = (params.grid_node_count + 127u) / 128u;
  var sum = 0.0;
  if (!(skip_if_converged && ip_converged())) {
    for (var i = local; i < groups; i = i + 256u) { sum = sum + partials[i]; }
  }
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
@compute @workgroup_size(128)
fn ip_build_diag(@builtin(global_invocation_id) id: vec3<u32>) {
  if (id.x >= params.grid_node_count) { return; }
  let m = grid_nodes[id.x * 2u].x;
  var d = vec3<f32>(1.0);
  if ((params.flags & 1u) != 0u && m > 0.0) {
    let av = ip_take_node_av(id.x, m, ip_scalar(6u));
    d = d + max(av, vec3<f32>(0.0));
  }
  cg_diag[id.x] = vec4<f32>(d, 0.0);
}

// rz <- sum (after init).
@compute @workgroup_size(256)
fn ip_reduce_rz(@builtin(local_invocation_index) local: u32) {
  let rz = ip_reduce_partials(local, false);
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
  let pq = ip_reduce_partials(local, true);
  if (local == 0u && !ip_converged()) {
    ip_set_scalar(1u, pq);
    ip_set_scalar(3u, select(0.0, ip_scalar(0u) / pq, pq > 0.0));
  }
}
// rz_new <- sum; beta = rz_new / rz; rz <- rz_new (after update_xr).
@compute @workgroup_size(256)
fn ip_reduce_beta(@builtin(local_invocation_index) local: u32) {
  let rz_new = ip_reduce_partials(local, true);
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
// x0 = b: r0 = -A b (projected), p0 = z0 (with mass packed in p.w), accumulate <r, z>_M.
@compute @workgroup_size(128)
fn ip_cg_init(@builtin(global_invocation_id) id: vec3<u32>, @builtin(local_invocation_index) local: u32,
    @builtin(workgroup_id) group: vec3<u32>) {
  var contribution = 0.0;
  var p_abs = 0.0;
  // Barrier reductions: every invocation reaches workgroupBarrier.
  if (id.x < params.grid_node_count) {
    let m = grid_nodes[id.x * 2u].x;
    if (m > 0.0) {
      let av = ip_take_node_av(id.x, m, ip_scalar(5u));
      let r = ip_project(grid_nodes[id.x * 2u + 1u], -av);
      var z = r;
      if ((params.flags & 1u) != 0u) { z = r / cg_diag[id.x].xyz; }
      cg_r[id.x] = vec4<f32>(r, 0.0);
      cg_p[id.x] = vec4<f32>(z, m);
      contribution = m * dot(r, z);
      p_abs = max(abs(z.x), max(abs(z.y), abs(z.z)));
    } else {
      cg_r[id.x] = vec4<f32>(0.0);
      cg_p[id.x] = vec4<f32>(0.0);
    }
  }
  ip_workgroup_partial(group.x, local, contribution);
  ip_workgroup_max_into(group.x, local, p_abs);
}

// q = (I + A) p (projected), accumulate <p, q>_M.
@compute @workgroup_size(128)
fn ip_cg_apply(@builtin(global_invocation_id) id: vec3<u32>, @builtin(local_invocation_index) local: u32,
    @builtin(workgroup_id) group: vec3<u32>) {
  var contribution = 0.0;
  if (!ip_converged() && id.x < params.grid_node_count) {
    let p4 = cg_p[id.x];
    let m = p4.w;
    if (m > 0.0) {
      let av = ip_take_node_av(id.x, m, ip_scalar(5u));
      let q = ip_project(grid_nodes[id.x * 2u + 1u], p4.xyz + av);
      cg_q[id.x] = vec4<f32>(q, 0.0);
      contribution = m * dot(p4.xyz, q);
    }
  }
  ip_workgroup_partial(group.x, local, contribution);
}

// x += alpha p (the grid velocity in place), r -= alpha q, accumulate <r, z>_M.
@compute @workgroup_size(128)
fn ip_cg_update_xr(@builtin(global_invocation_id) id: vec3<u32>, @builtin(local_invocation_index) local: u32,
    @builtin(workgroup_id) group: vec3<u32>) {
  var contribution = 0.0;
  if (!ip_converged() && id.x < params.grid_node_count) {
    let p4 = cg_p[id.x];
    let m = p4.w;
    if (m > 0.0) {
      let alpha = ip_scalar(3u);
      let row = grid_nodes[id.x * 2u];
      let r = cg_r[id.x].xyz - alpha * cg_q[id.x].xyz;
      grid_nodes[id.x * 2u] = vec4<f32>(row.x, row.yzw + alpha * p4.xyz);
      cg_r[id.x] = vec4<f32>(r, 0.0);
      var z = r;
      if ((params.flags & 1u) != 0u) { z = r / cg_diag[id.x].xyz; }
      contribution = m * dot(r, z);
    }
  }
  ip_workgroup_partial(group.x, local, contribution);
}

// p = z + beta p (preserving mass in p.w).
@compute @workgroup_size(128)
fn ip_cg_update_p(@builtin(global_invocation_id) id: vec3<u32>, @builtin(local_invocation_index) local: u32,
    @builtin(workgroup_id) group: vec3<u32>) {
  var p_abs = 0.0;
  if (!ip_converged() && id.x < params.grid_node_count) {
    let p4 = cg_p[id.x];
    let m = p4.w;
    if (m > 0.0) {
      let beta = ip_scalar(4u);
      var z = cg_r[id.x].xyz;
      if ((params.flags & 1u) != 0u) { z = z / cg_diag[id.x].xyz; }
      let p = z + beta * p4.xyz;
      cg_p[id.x] = vec4<f32>(p, m);
      p_abs = max(abs(p.x), max(abs(p.y), abs(p.z)));
    }
  }
  ip_workgroup_max_into(group.x, local, p_abs);
}

`;

const ENTRY_POINTS = [
  'ip_particle_apply', 'ip_clear_iteration', 'ip_particle_kv_max', 'ip_reduce_scale', 'ip_scatter_particles',
  'ip_build_diag', 'ip_cg_init', 'ip_reduce_rz',
  'ip_cg_apply', 'ip_reduce_alpha', 'ip_cg_update_xr', 'ip_reduce_beta', 'ip_cg_update_p', 'ip_reduce_pscale'
];

// A3 GPU-resident member packer: projects live liquid Tait density ratios
// (rho / rho0) directly into regionalClosureSamplerGpu's vec4<f32> member buffer
// without any host readback. Region 0 holds the bulk liquid envelope; non-liquid
// particles get region 0xffffffffu so A3 skips them cleanly.
const REGIONAL_MEMBER_PACK_WGSL = /* wgsl */ `
struct PackParams {
  particle_count: u32,
  pad0: u32,
  pad1: u32,
  pad2: u32,
};
@group(0) @binding(0) var<uniform> pack_params: PackParams;
@group(0) @binding(1) var<storage, read> sph_state: array<vec4<f32>>;
@group(0) @binding(2) var<storage, read> sph_thermo: array<vec4<f32>>;
@group(0) @binding(3) var<storage, read> mls_mechanics: array<vec4<f32>>;
@group(0) @binding(4) var<storage, read_write> members: array<vec4<f32>>;

@compute @workgroup_size(128)
fn ip_pack_regional_members(@builtin(global_invocation_id) id: vec3<u32>) {
  let p = id.x;
  if (p >= pack_params.particle_count) { return; }
  let mb = p * 8u;
  let row4 = mls_mechanics[mb + 4u];
  let row5 = mls_mechanics[mb + 5u];
  let row6 = mls_mechanics[mb + 6u];
  let volume = select(0.0, row4.w * row4.z, row4.w > 0.0 && row4.z > 0.0);
  let rho0 = sph_thermo[p * 3u].w;
  let mass = sph_state[p * 2u].w;
  let is_liquid = volume > 0.0
    && !(row5.x > 0.5 && row5.w > 0.0)
    && row6.z > 0.5 && row6.z < 1.5
    && row6.y > 0.0 && rho0 > 0.0 && mass > 0.0;
  if (is_liquid) {
    let ratio = clamp((mass / volume) / rho0, 0.5, 2.0);
    members[p] = vec4<f32>(ratio, 0.0, 0.0, bitcast<f32>(0u));
  } else {
    // Region id 1u is >= region_count (1u) and non-NaN in f32 bitcast, so A3 skips it cleanly.
    members[p] = vec4<f32>(1.0, 0.0, 0.0, bitcast<f32>(1u));
  }
}
`;

const pipelineCache = new WeakMap();

function implicitPressurePipelines(device) {
  const keyDevice = unwrapWebGpuCacheDevice(device);
  let cached = pipelineCache.get(keyDevice);
  if (cached) return cached;
  const module = keyDevice.createShaderModule({ label: 'ulg-sph-implicit-pressure', code: sphImplicitPressureWgsl });
  const layoutEntries = [
    { binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'uniform' } },
    { binding: 1, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'read-only-storage' } },
    { binding: 2, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'read-only-storage' } },
    { binding: 3, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'read-only-storage' } },
    ...[4, 5, 6, 7, 8, 9, 10, 11].map((binding) => ({
      binding, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' }
    })),
    { binding: 12, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'read-only-storage' } }
  ];
  // Enforce canonical Law Adapter Contract on declared physics bindings once per device.
  const declaredBindingSet = new Set([0, ...Object.values(SPH_IMPLICIT_PRESSURE_RESOURCE_BINDING_TABLE)]);
  assertBindGroupMatchesLawDescriptor(
    SPH_IMPLICIT_PRESSURE_LAW_ADAPTER_DESCRIPTOR,
    SPH_IMPLICIT_PRESSURE_RESOURCE_BINDING_TABLE,
    layoutEntries.filter((e) => declaredBindingSet.has(e.binding)),
    { uniformBindings: [0] }
  );
  const layout = keyDevice.createBindGroupLayout({
    label: 'ulg-sph-implicit-pressure-layout',
    entries: layoutEntries
  });
  const pipelineLayout = keyDevice.createPipelineLayout({ bindGroupLayouts: [layout] });
  const pipelines = Object.fromEntries(ENTRY_POINTS.map((entryPoint) => [entryPoint, keyDevice.createComputePipeline({
    label: `ulg-sph-implicit-pressure-${entryPoint}`,
    layout: pipelineLayout,
    compute: { module, entryPoint }
  })]));
  const stiffnessTable = keyDevice.createBuffer({ label: 'ulg-sph-implicit-pressure-response-table',
    size: SPH_IMPLICIT_PRESSURE_STIFFNESS_TABLE.data.byteLength, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST });
  keyDevice.queue.writeBuffer(stiffnessTable, 0, SPH_IMPLICIT_PRESSURE_STIFFNESS_TABLE.data);
  cached = {
    module,
    layout,
    pipelines,
    workspaces: [],
    stiffnessTable,
    regionalPackPipeline: null,
    regionalPackLayout: null,
    regionalPackParamsBuffer: null,
    regionalMembersBuffer: null,
    regionalMemberCapacity: 0,
    regionalLane: null,
    regionalEvaluatedSchedules: 0,
    regionalAdoptedSchedules: 0
  };
  pipelineCache.set(keyDevice, cached);
  return cached;
}

function ensureRegionalClosureSamplerResources(device, cache, particleCount) {
  const keyDevice = unwrapWebGpuCacheDevice(device);
  if (!cache.regionalPackPipeline) {
    const packModule = keyDevice.createShaderModule({
      label: 'ulg-sph-implicit-pressure-a3-pack',
      code: REGIONAL_MEMBER_PACK_WGSL
    });
    cache.regionalPackLayout = keyDevice.createBindGroupLayout({
      label: 'ulg-sph-implicit-pressure-a3-pack-layout',
      entries: [
        { binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'uniform' } },
        { binding: 1, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'read-only-storage' } },
        { binding: 2, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'read-only-storage' } },
        { binding: 3, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'read-only-storage' } },
        { binding: 4, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } }
      ]
    });
    cache.regionalPackPipeline = keyDevice.createComputePipeline({
      label: 'ulg-sph-implicit-pressure-a3-pack-pipeline',
      layout: keyDevice.createPipelineLayout({ bindGroupLayouts: [cache.regionalPackLayout] }),
      compute: { module: packModule, entryPoint: 'ip_pack_regional_members' }
    });
    cache.regionalPackParamsBuffer = keyDevice.createBuffer({
      label: 'ulg-sph-implicit-pressure-a3-pack-params',
      size: 16,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    });
  }
  const needed = Math.max(256, 1 << Math.ceil(Math.log2(Math.max(1, particleCount))));
  if (!cache.regionalLane || cache.regionalMemberCapacity < needed) {
    if (cache.regionalLane) destroyRegionalClosureWorkerLane(cache.regionalLane);
    cache.regionalMembersBuffer?.destroy?.();
    cache.regionalMemberCapacity = needed;
    cache.regionalMembersBuffer = keyDevice.createBuffer({
      label: `ulg-sph-implicit-pressure-a3-members-${needed}`,
      size: needed * 16,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
    });
    cache.regionalLane = createRegionalClosureWorkerLane(keyDevice, {
      name: 'ulg-sph-implicit-pressure-a3-lane',
      generatorWgsl: DEFAULT_TAIT_EOS_REGIONAL_GENERATOR_WGSL,
      axes: 1,
      regionCapacity: 1,
      memberCapacity: needed,
      degrees: [8],
      tolerances: [0.35],
      margin: 0.25,
      policy: 'async',
      relativeTolerance: 1e-5,
      heldOutPerAxis: 3,
      safetyFactor: 2
    });
    for (const workspace of cache.workspaces) workspace.bindGroups.clear();
  }
  return cache.regionalLane;
}

/**
 * Access the live G5-reserved A3 regional closure lane on `device` (or null
 * before the first implicit-pressure schedule runs).
 */
export function getSphImplicitPressureRegionalClosureLane(device) {
  if (!device) return null;
  const cached = pipelineCache.get(unwrapWebGpuCacheDevice(device));
  return cached?.regionalLane ?? null;
}

/**
 * Encode one GPU-resident A3 regional envelope/sample/fit + G5 CAS schedule-
 * boundary adoption tick for the live implicit pressure lane (zero host
 * readback). Called once per schedule so per-substep pass budgets stay flat.
 */
export function encodeSphImplicitPressureRegionalClosureScheduleTick(device, encoder, {
  stateBuffer,
  thermoBuffer,
  mechanicsBuffer,
  particleCount,
  scheduleId = null
}) {
  if (!(particleCount > 0) || globalThis.__ulgDisableA3RegionalLane === true) return null;
  const cache = implicitPressurePipelines(device);
  const lane = ensureRegionalClosureSamplerResources(device, cache, particleCount);
  device.queue.writeBuffer(
    cache.regionalPackParamsBuffer,
    0,
    new Uint32Array([particleCount, 0, 0, 0])
  );
  const packGroup = createCachedExplicitBindGroup(device, {
    label: 'ulg-sph-implicit-pressure-a3-pack-group',
    layout: cache.regionalPackLayout,
    entries: [
      { binding: 0, resource: { buffer: cache.regionalPackParamsBuffer } },
      { binding: 1, resource: { buffer: stateBuffer } },
      { binding: 2, resource: { buffer: thermoBuffer } },
      { binding: 3, resource: { buffer: mechanicsBuffer } },
      { binding: 4, resource: { buffer: cache.regionalMembersBuffer } }
    ]
  });
  const packPass = encoder.beginComputePass({ label: 'ulg-sph-implicit-pressure-a3-pack' });
  packPass.setPipeline(cache.regionalPackPipeline);
  packPass.setBindGroup(0, packGroup);
  packPass.dispatchWorkgroups(Math.max(1, Math.ceil(particleCount / 128)));
  packPass.end();

  encodeRegionalClosureLaneEvaluate(lane, encoder, {
    membersBuffer: cache.regionalMembersBuffer,
    regionCount: 1,
    memberCount: particleCount
  });
  cache.regionalEvaluatedSchedules += 1;
  const adopted = encodeRegionalClosureLaneAdopt(lane, encoder, {
    membersBuffer: cache.regionalMembersBuffer,
    regionCount: 1,
    scheduleId
  });
  cache.regionalAdoptedSchedules += 1;
  const bindings = regionalClosureLaneBindings(lane);
  globalThis.__ulgA3RegionalClosureStatus = Object.freeze({
    active: true,
    ordinal: bindings.ordinal,
    regionCount: 1,
    memberCount: particleCount,
    evaluatedSchedules: cache.regionalEvaluatedSchedules,
    adoptedSchedules: cache.regionalAdoptedSchedules,
    externalSourceFingerprint: bindings.externalSourceFingerprint
  });
  return adopted;
}

/**
 * Update the cached Eshkol/A4 stiffness response table buffer on `device` at a
 * schedule boundary (accepting either an array of A4 response functions or an
 * already-packed table from `packResponseFunctionsForGpu`).
 */
export function updateSphImplicitPressureStiffnessTable(device, responseFunctionsOrPacked) {
  const cache = implicitPressurePipelines(device);
  const packed = responseFunctionsOrPacked?.data instanceof Float32Array
    ? responseFunctionsOrPacked
    : packResponseFunctionsForGpu(
        Array.isArray(responseFunctionsOrPacked)
          ? responseFunctionsOrPacked
          : [responseFunctionsOrPacked]
      );
  if (packed.data.byteLength <= cache.stiffnessTable.size) {
    device.queue.writeBuffer(cache.stiffnessTable, 0, packed.data);
  } else {
    const next = device.createBuffer({
      label: 'ulg-sph-implicit-pressure-response-table',
      size: packed.data.byteLength,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
    });
    device.queue.writeBuffer(next, 0, packed.data);
    cache.stiffnessTable.destroy();
    cache.stiffnessTable = next;
    for (const workspace of cache.workspaces) workspace.bindGroups.clear();
  }
  if (cache.regionalLane) {
    adoptExternalRegionalResponseTable(cache.regionalLane, packed, {
      sourceFingerprint: 'sph-implicit-pressure-external-a4'
    });
    for (const workspace of cache.workspaces) workspace.bindGroups.clear();
  }
  return cache.stiffnessTable;
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
    iterAcc: make('ulg-sph-implicit-pressure-iteration', nodes * 12),
    cgR: make('ulg-sph-implicit-pressure-cg-r', nodes * NODE_VEC4_BYTES),
    cgP: make('ulg-sph-implicit-pressure-cg-p', nodes * NODE_VEC4_BYTES),
    cgQ: make('ulg-sph-implicit-pressure-cg-q', nodes * NODE_VEC4_BYTES),
    scalars: make('ulg-sph-implicit-pressure-scalars', (16 + 65536) * 4),
    partials: make(
      'ulg-sph-implicit-pressure-partials',
      (Math.max(2 * Math.ceil(nodes / 128), Math.ceil(particles / 128)) + 5 * particles + 16) * 4
    ),
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
  timestampPassExtras = null,
  regionalSampleOnScheduleBoundary = false,
  scheduleId = null
}) {
  if (!options?.enabled || !(particleCount > 0) || !(dt > 0)) return 0;
  const cache = implicitPressurePipelines(device);
  const workspace = workspaceFor(device, cache, { gridNodeCount: gridSpec.gridNodeCount, particleCount });
  const theta = options.theta ?? 1;
  const jacobi = options.jacobi === true;
  const stiffnessTable = options.stiffnessSource === SPH_IMPLICIT_PRESSURE_STIFFNESS_SOURCES.closedForm
    ? null : ESHKOL_TAIT_STIFFNESS_TABLE;
  if (
    regionalSampleOnScheduleBoundary === true
    && stiffnessTable != null
    && !options.stiffnessTableBuffer
    && globalThis.__ulgDisableA3RegionalLane !== true
  ) {
    encodeSphImplicitPressureRegionalClosureScheduleTick(device, encoder, {
      stateBuffer,
      thermoBuffer,
      mechanicsBuffer,
      particleCount,
      scheduleId
    });
  }
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
  const activeA3Table = cache.regionalLane && globalThis.__ulgDisableA3RegionalLane !== true
    ? regionalClosureLaneBindings(cache.regionalLane).tableBuffer
    : null;
  const activeStiffnessTable = options.stiffnessTableBuffer ?? activeA3Table ?? cache.stiffnessTable;
  const bindGroup = (source) => createCachedExplicitBindGroup(device, {
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
      { binding: 12, resource: { buffer: activeStiffnessTable } }
    ]
  });
  const fromVelocity = bindGroup(0);
  const fromDirection = bindGroup(1);
  const forDiagonal = bindGroup(2);
  const nodeGroups = Math.max(1, Math.ceil(gridSpec.gridNodeCount / 128));
  const particleGroups = Math.max(1, Math.ceil(particleCount / 128));
  // Keep all CG dispatches in a single compute pass by default so pass-census
  // probes measure real production pass counts (set __ulgPassCensusSplitImplicit
  // only when drilling down per-kernel CG timings).
  const splitPasses = Boolean(
    device.__ulgPassTimestampCensus
    && globalThis.__ulgPassCensusSplitImplicit === true
  );
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
  // The accumulator is cleared once; the diagonal build (when jacobi), init and
  // apply read-and-clear every occupied node.
  run('ip_clear_iteration', nodeGroups);
  run('ip_particle_kv_max', particleGroups);
  run('ip_reduce_scale', 1);
  run('ip_scatter_particles', particleGroups);
  if (jacobi) {
    run('ip_particle_apply', particleGroups, forDiagonal);
    run('ip_build_diag', nodeGroups);
  }
  run('ip_particle_apply', particleGroups, fromVelocity);
  run('ip_cg_init', nodeGroups);
  run('ip_reduce_rz', 1);
  for (let k = 0; k < options.iterations; k += 1) {
    run('ip_particle_apply', particleGroups, fromDirection);
    run('ip_cg_apply', nodeGroups);
    run('ip_reduce_alpha', 1);
    run('ip_cg_update_xr', nodeGroups);
    run('ip_reduce_beta', 1);
    if (k + 1 < options.iterations) {
      run('ip_cg_update_p', nodeGroups);
      run('ip_reduce_pscale', 1);
    }
  }
  if (!splitPasses) pass.end();
  return dispatches;
}
