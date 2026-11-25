// Multi-Phase Continuum Solid-Liquid Unilateral Slip Velocity Separation
// (`src/runtime/sph/sphSolidLiquidVelocitySeparationGpu.js`).
//
// Eliminates single-field MLS-MPM mixed-cell solid-liquid locking (where solid
// and liquid particles sharing a grid node are forced to the same tangential
// velocity) using a two-field GPU projection built strictly on ULG's canonical
// ABI lane accessors & Law Adapter Contract:
//   1. `p2g_split_phase_fields`: scatters solid (`solid_flag > 0.5`) and liquid
//      (`solid_flag <= 0.5`) mass + momentum into disjoint fixed-point L2
//      accumulators on the canonical MPM grid.
//   2. `resolve_mixed_node_unilateral_slip`: on mixed solid+liquid nodes
//      (`m_s > 0 && m_l > 0`), derives the local interface unit normal `n` from
//      the solid-mass gradient across neighboring nodes, resolves ONLY normal
//      approach `(v_l - v_s) . n < 0` to the momentum-conserving shared normal
//      velocity `v_n* = (m_s v_sn + m_l v_ln) / (m_s + m_l)`, while preserving
//      100% tangential slip (`v_t` unchanged) and 100% free normal separation
//      (`(v_l - v_s) . n >= 0`) with exact total linear momentum conservation!
//   3. `g2p_apply_separated_velocities`: updates each particle's velocity from
//      its own phase field (solid from solid field, liquid from liquid field),
//      leaving single-phase nodes bit-exact and translation/rotation invariant.

import {
  MLS_MPM_GPU_PARTICLE_MECHANICS_ROW_LAYOUT,
  SPH_GPU_PARTICLE_STATE_ROW_LAYOUT,
  generateVec4LaneAccessorsWgsl
} from '../../../ulg-gpu-abi/src/index.js';
import {
  LAW_ADAPTER_MODES,
  LAW_FALLBACK_POLICIES,
  LAW_SPATIAL_AUTHORITIES,
  validateLawAdapterDescriptor
} from './lawAdapterContract.js';
import { createGpuResourceLeaseScope } from './gpuResourceLease.js';
import {
  computeBufferBinding,
  createCachedExplicitBindGroup,
  createCachedExplicitComputePipeline
} from '../webgpuComputeLayout.js';

export const ULG_SOLID_LIQUID_SLIP_SCHEMA =
  'peercompute.ulg.solid-liquid-velocity-separation.v1';

export const SOLID_LIQUID_VELOCITY_SEPARATION_LAW_DESCRIPTOR = Object.freeze({
  id: 'solid-liquid-unilateral-slip',
  lawNodeId: 'law:multiphase-solid-liquid-slip',
  orderConstraint: 'after:mls-mpm-g2p',
  adapterMode: LAW_ADAPTER_MODES.CELL_LOCAL,
  spatialAuthority: LAW_SPATIAL_AUTHORITIES.CANONICAL_SS_EPOCH,
  reads: Object.freeze(['sph-particle-state', 'mls-mpm-mechanics']),
  writes: Object.freeze(['sph-particle-state']),
  accumulates: Object.freeze(['solid-liquid-split-grid']),
  pairedVolumeState: 'not-applicable',
  conservedQuantities: Object.freeze(['mass', 'linear-momentum']),
  validityDomain: Object.freeze({ frictionlessSlip: true, unilateralImpenetrability: true }),
  fallbackPolicy: LAW_FALLBACK_POLICIES.DORMANT_SKIP
});

validateLawAdapterDescriptor(SOLID_LIQUID_VELOCITY_SEPARATION_LAW_DESCRIPTOR, {
  requireExtendedMetadata: true
});

const ACCESSORS_WGSL = [
  generateVec4LaneAccessorsWgsl({
    layout: SPH_GPU_PARTICLE_STATE_ROW_LAYOUT,
    layoutName: 'SPH_GPU_PARTICLE_STATE_ROW_LAYOUT',
    bufferName: 'sph_state',
    prefix: 'sl_state',
    fields: ['massKg'],
    includeWriters: false
  }),
  generateVec4LaneAccessorsWgsl({
    layout: MLS_MPM_GPU_PARTICLE_MECHANICS_ROW_LAYOUT,
    layoutName: 'MLS_MPM_GPU_PARTICLE_MECHANICS_ROW_LAYOUT',
    bufferName: 'mls_mechanics',
    prefix: 'sl_mech',
    fields: ['solidFlag', 'eosModelId'],
    includeWriters: false
  })
].join('\n\n');

export const sphSolidLiquidVelocitySeparationWgsl = /* wgsl */ `
struct SlipParams {
  particle_count: u32,
  grid_nx: u32,
  grid_ny: u32,
  grid_nz: u32,
  shift: u32,
  node_count: u32,
  pad0: u32,
  pad1: u32,
  inv_dx: f32,
  fixed_scale: f32,
  inv_fixed_scale: f32,
  blend_alpha: f32,
};

@group(0) @binding(0) var<uniform> params: SlipParams;
@group(0) @binding(1) var<storage, read_write> sph_state: array<vec4<f32>>;
@group(0) @binding(2) var<storage, read> mls_mechanics: array<vec4<f32>>;
// Split grid accumulators: per node = 8 i32 words:
//   [0..3] solid (m, px, py, pz)
//   [4..7] fluid (m, px, py, pz)
@group(0) @binding(3) var<storage, read_write> split_acc: array<atomic<i32>>;
// Resolved phase velocity deltas (exact momentum-conserving FLIP impulse):
//   [node*2 + 0] = (dv_s.x, dv_s.y, dv_s.z, ms)
//   [node*2 + 1] = (dv_l.x, dv_l.y, dv_l.z, ml)
@group(0) @binding(4) var<storage, read_write> split_vel: array<vec4<f32>>;
// Compact diagnostic receipt: [mixed_nodes, unilateral_contacts, separated_nodes, 0]
@group(0) @binding(5) var<storage, read_write> slip_receipt: array<atomic<u32>>;

${ACCESSORS_WGSL}

fn sl_weights(fx: f32) -> vec3<f32> {
  let a = 1.5 - fx;
  let b = fx - 1.0;
  let c = fx - 0.5;
  return vec3<f32>(0.5 * a * a, 0.75 - b * b, 0.5 * c * c);
}
fn sl_w(w: vec3<f32>, o: i32) -> f32 {
  if (o == 0) { return w.x; }
  if (o == 1) { return w.y; }
  return w.z;
}
fn sl_in_range(i: i32, j: i32, k: i32) -> bool {
  let s = i32(params.shift);
  return i + s >= 0 && j + s >= 0 && k + s >= 0
    && i + s < i32(params.grid_nx) && j + s < i32(params.grid_ny) && k + s < i32(params.grid_nz);
}
fn sl_node_idx(i: i32, j: i32, k: i32) -> u32 {
  let s = i32(params.shift);
  return (u32(i + s) * params.grid_ny + u32(j + s)) * params.grid_nz + u32(k + s);
}
fn sl_q(v: f32) -> i32 {
  return i32(round(clamp(v * params.fixed_scale, -2147483000.0, 2147483000.0)));
}

@compute @workgroup_size(64)
fn clear_split_grid(@builtin(global_invocation_id) id: vec3<u32>) {
  let node = id.x;
  if (node == 0u) {
    atomicStore(&slip_receipt[0], 0u);
    atomicStore(&slip_receipt[1], 0u);
    atomicStore(&slip_receipt[2], 0u);
    atomicStore(&slip_receipt[3], 0u);
  }
  if (node >= params.node_count) { return; }
  let base = node * 8u;
  for (var w = 0u; w < 8u; w = w + 1u) {
    atomicStore(&split_acc[base + w], 0);
  }
  split_vel[node * 2u] = vec4<f32>(0.0);
  split_vel[node * 2u + 1u] = vec4<f32>(0.0);
}

@compute @workgroup_size(64)
fn p2g_split_phase_fields(@builtin(global_invocation_id) id: vec3<u32>) {
  let p = id.x;
  if (p >= params.particle_count) { return; }
  let m = sl_state_mass_kg(p);
  if (!(m > 0.0)) { return; }
  let is_solid = sl_mech_solid_flag(p) > 0.5;
  let eos = sl_mech_eos_model_id(p);
  let is_liquid = !is_solid && (eos > 0.5 && eos < 1.5);
  if (!is_solid && !is_liquid) { return; }

  let pos = sph_state[p * 2u].xyz;
  let vel = sph_state[p * 2u + 1u].xyz;
  let pg = pos * params.inv_dx;
  let bx = i32(floor(pg.x - 0.5));
  let by = i32(floor(pg.y - 0.5));
  let bz = i32(floor(pg.z - 0.5));
  let wx = sl_weights(pg.x - f32(bx));
  let wy = sl_weights(pg.y - f32(by));
  let wz = sl_weights(pg.z - f32(bz));
  let lane_off = select(4u, 0u, is_solid);

  for (var ox = 0i; ox < 3i; ox = ox + 1i) {
    for (var oy = 0i; oy < 3i; oy = oy + 1i) {
      for (var oz = 0i; oz < 3i; oz = oz + 1i) {
        let ni = bx + ox;
        let nj = by + oy;
        let nk = bz + oz;
        if (!sl_in_range(ni, nj, nk)) { continue; }
        let w = sl_w(wx, ox) * sl_w(wy, oy) * sl_w(wz, oz);
        if (!(w > 1.0e-7)) { continue; }
        let base = sl_node_idx(ni, nj, nk) * 8u + lane_off;
        let wm = w * m;
        atomicAdd(&split_acc[base + 0u], sl_q(wm));
        atomicAdd(&split_acc[base + 1u], sl_q(wm * vel.x));
        atomicAdd(&split_acc[base + 2u], sl_q(wm * vel.y));
        atomicAdd(&split_acc[base + 3u], sl_q(wm * vel.z));
      }
    }
  }
}

fn node_solid_mass(ni: i32, nj: i32, nk: i32) -> f32 {
  if (!sl_in_range(ni, nj, nk)) { return 0.0; }
  return f32(atomicLoad(&split_acc[sl_node_idx(ni, nj, nk) * 8u])) * params.inv_fixed_scale;
}

@compute @workgroup_size(64)
fn resolve_mixed_node_unilateral_slip(@builtin(global_invocation_id) id: vec3<u32>) {
  let node = id.x;
  if (node >= params.node_count) { return; }
  let base = node * 8u;
  let inv = params.inv_fixed_scale;
  let ms = f32(atomicLoad(&split_acc[base + 0u])) * inv;
  let ps = vec3<f32>(
    f32(atomicLoad(&split_acc[base + 1u])) * inv,
    f32(atomicLoad(&split_acc[base + 2u])) * inv,
    f32(atomicLoad(&split_acc[base + 3u])) * inv
  );
  let ml = f32(atomicLoad(&split_acc[base + 4u])) * inv;
  let pl = vec3<f32>(
    f32(atomicLoad(&split_acc[base + 5u])) * inv,
    f32(atomicLoad(&split_acc[base + 6u])) * inv,
    f32(atomicLoad(&split_acc[base + 7u])) * inv
  );
  let vs = select(vec3<f32>(0.0), ps / max(ms, 1.0e-30), ms > 1.0e-12);
  let vl = select(vec3<f32>(0.0), pl / max(ml, 1.0e-30), ml > 1.0e-12);
  var dv_s = vec3<f32>(0.0);
  var dv_l = vec3<f32>(0.0);

  if (ms > 1.0e-12 && ml > 1.0e-12) {
    atomicAdd(&slip_receipt[0], 1u);
    let plane = params.grid_ny * params.grid_nz;
    let i_u = node / plane;
    let rem = node - i_u * plane;
    let j_u = rem / params.grid_nz;
    let k_u = rem - j_u * params.grid_nz;
    let s = i32(params.shift);
    let ni = i32(i_u) - s;
    let nj = i32(j_u) - s;
    let nk = i32(k_u) - s;

    // Outward solid surface normal points down the solid-mass gradient (from solid -> liquid).
    let grad_s = vec3<f32>(
      node_solid_mass(ni - 1, nj, nk) - node_solid_mass(ni + 1, nj, nk),
      node_solid_mass(ni, nj - 1, nk) - node_solid_mass(ni, nj + 1, nk),
      node_solid_mass(ni, nj, nk - 1) - node_solid_mass(ni, nj, nk + 1)
    );
    let g_len = length(grad_s);
    if (g_len > 1.0e-12) {
      let n = grad_s / g_len;
      let v_rel_n = dot(vl - vs, n);
      if (v_rel_n < 0.0) {
        // Unilateral normal impenetrability via exact momentum-conserving FLIP
        // impulse delta: sum_p m_p (alpha * sum_i w_pi dv_i) = alpha * sum_i (-J_i + J_i) n_i = 0.
        // Tangential velocities (v - dot(v, n) * n) remain 100% frictionless!
        let m_tot = ms + ml;
        let impulse_n = (ms * ml / m_tot) * (-v_rel_n);
        dv_l = (impulse_n / ml) * n;
        dv_s = -(impulse_n / ms) * n;
        atomicAdd(&slip_receipt[1], 1u);
      } else {
        // Separating or purely tangential flow: zero artificial mixed-cell suction/locking!
        atomicAdd(&slip_receipt[2], 1u);
      }
    }
  }
  split_vel[node * 2u] = vec4<f32>(dv_s, ms);
  split_vel[node * 2u + 1u] = vec4<f32>(dv_l, ml);
}

@compute @workgroup_size(64)
fn g2p_apply_separated_velocities(@builtin(global_invocation_id) id: vec3<u32>) {
  let p = id.x;
  if (p >= params.particle_count) { return; }
  let m = sl_state_mass_kg(p);
  if (!(m > 0.0)) { return; }
  let is_solid = sl_mech_solid_flag(p) > 0.5;
  let eos = sl_mech_eos_model_id(p);
  let is_liquid = !is_solid && (eos > 0.5 && eos < 1.5);
  if (!is_solid && !is_liquid) { return; }

  let pos = sph_state[p * 2u].xyz;
  let vel_u = sph_state[p * 2u + 1u];
  let pg = pos * params.inv_dx;
  let bx = i32(floor(pg.x - 0.5));
  let by = i32(floor(pg.y - 0.5));
  let bz = i32(floor(pg.z - 0.5));
  let wx = sl_weights(pg.x - f32(bx));
  let wy = sl_weights(pg.y - f32(by));
  let wz = sl_weights(pg.z - f32(bz));
  let row_off = select(1u, 0u, is_solid);

  var dv_acc = vec3<f32>(0.0);
  var touched_mixed = false;
  for (var ox = 0i; ox < 3i; ox = ox + 1i) {
    for (var oy = 0i; oy < 3i; oy = oy + 1i) {
      for (var oz = 0i; oz < 3i; oz = oz + 1i) {
        let ni = bx + ox;
        let nj = by + oy;
        let nk = bz + oz;
        if (!sl_in_range(ni, nj, nk)) { continue; }
        let w = sl_w(wx, ox) * sl_w(wy, oy) * sl_w(wz, oz);
        if (!(w > 1.0e-7)) { continue; }
        let node = sl_node_idx(ni, nj, nk);
        let vs_row = split_vel[node * 2u];
        let vl_row = split_vel[node * 2u + 1u];
        if (vs_row.w > 1.0e-12 && vl_row.w > 1.0e-12) {
          touched_mixed = true;
          let chosen = select(vl_row, vs_row, row_off == 0u);
          dv_acc = dv_acc + w * chosen.xyz;
        }
      }
    }
  }
  if (!touched_mixed) { return; }
  let v_new = vel_u.xyz + clamp(params.blend_alpha, 0.0, 1.0) * dv_acc;
  sph_state[p * 2u + 1u] = vec4<f32>(v_new, vel_u.w);
}
`;

const mixedContinuumDetectCache = new WeakMap();
const cachedDeviceSlipStages = new WeakMap();

const SOLID_FLAG_OFFSET = MLS_MPM_GPU_PARTICLE_MECHANICS_ROW_LAYOUT.findIndex((s) => s.startsWith('solidFlag:'));
const EOS_MODEL_OFFSET = MLS_MPM_GPU_PARTICLE_MECHANICS_ROW_LAYOUT.findIndex((s) => s.startsWith('eosModelId:'));
const MECHANICS_STRIDE = MLS_MPM_GPU_PARTICLE_MECHANICS_ROW_LAYOUT.length;
const STATE_STRIDE = SPH_GPU_PARTICLE_STATE_ROW_LAYOUT.length;

/**
 * Memoized O(1) steady-state check whether a packed continuum particle set
 * contains BOTH solid (`solidFlag > 0.5`) and liquid (`!solid && eos == 1`)
 * continuum MPM carriers, plus a representative particle mass for fixed-point
 * accumulator scaling.
 */
export function detectMixedSolidLiquidContinuumState(mlsMpmParticleState, sphParticleState = null) {
  if (!mlsMpmParticleState || typeof mlsMpmParticleState !== 'object') {
    return { hasMixedSolidLiquid: false, refParticleMassKg: 1.0 };
  }
  const cached = mixedContinuumDetectCache.get(mlsMpmParticleState);
  if (cached) return cached;
  const mechanics = mlsMpmParticleState.mechanics;
  const count = Math.max(0, Math.trunc(mlsMpmParticleState.particleCount ?? sphParticleState?.particleCount ?? 0));
  let hasSolid = false;
  let hasLiquid = false;
  if (mechanics && mechanics.length >= count * MECHANICS_STRIDE && SOLID_FLAG_OFFSET >= 0 && EOS_MODEL_OFFSET >= 0) {
    for (let i = 0; i < count; i += 1) {
      const base = i * MECHANICS_STRIDE;
      const isSolid = mechanics[base + SOLID_FLAG_OFFSET] > 0.5;
      if (isSolid) {
        hasSolid = true;
      } else {
        const eos = mechanics[base + EOS_MODEL_OFFSET];
        if (eos > 0.5 && eos < 1.5) hasLiquid = true;
      }
      if (hasSolid && hasLiquid) break;
    }
  }
  let refMass = 1.0;
  const state = sphParticleState?.state;
  if (hasSolid && hasLiquid && state && state.length >= count * STATE_STRIDE && count > 0) {
    let massSum = 0;
    let massCount = 0;
    const step = Math.max(1, Math.floor(count / 256));
    for (let i = 0; i < count; i += step) {
      const m = state[i * STATE_STRIDE + 3];
      if (Number.isFinite(m) && m > 0) {
        massSum += m;
        massCount += 1;
      }
    }
    if (massCount > 0) refMass = massSum / massCount;
  }
  const info = Object.freeze({ hasMixedSolidLiquid: hasSolid && hasLiquid, refParticleMassKg: refMass });
  mixedContinuumDetectCache.set(mlsMpmParticleState, info);
  return info;
}

export function resolveSolidLiquidSlipFixedScale(refParticleMassKg = 1.0) {
  const m = Number.isFinite(refParticleMassKg) && refParticleMassKg > 0 ? refParticleMassKg : 1.0;
  return Math.min(1.0e9, Math.max(1.0e5, Math.round(1.0e4 / Math.max(1.0e-6, m))));
}

export function createSphSolidLiquidVelocitySeparationStage(device, {
  gridDims,
  gridSpacingM,
  shift = 2,
  fixedScale = 1.0e5,
  blendAlpha = 1.0
} = {}) {
  const nx = Math.max(1, Math.trunc(gridDims?.[0] ?? 1));
  const ny = Math.max(1, Math.trunc(gridDims?.[1] ?? 1));
  const nz = Math.max(1, Math.trunc(gridDims?.[2] ?? 1));
  const nodeCount = nx * ny * nz;
  const bindings = [
    computeBufferBinding(0, 'uniform'),
    computeBufferBinding(1, 'storage'),
    computeBufferBinding(2, 'read-only-storage'),
    computeBufferBinding(3, 'storage'),
    computeBufferBinding(4, 'storage'),
    computeBufferBinding(5, 'storage')
  ];
  const pipelines = Object.fromEntries(
    ['clear_split_grid', 'p2g_split_phase_fields', 'resolve_mixed_node_unilateral_slip', 'g2p_apply_separated_velocities'].map(
      (entryPoint) => [
        entryPoint,
        createCachedExplicitComputePipeline(device, {
          cacheKey: `ulg-solid-liquid-slip-v2-flip-${entryPoint}`,
          label: `ulg-solid-liquid-slip-${entryPoint}`,
          code: sphSolidLiquidVelocitySeparationWgsl,
          entryPoint,
          bindings
        })
      ]
    )
  );
  const leaseScope = createGpuResourceLeaseScope({ scopeId: 'solid-liquid-velocity-separation' });
  const U = globalThis.GPUBufferUsage ?? { STORAGE: 0x80, UNIFORM: 0x40, COPY_SRC: 0x04, COPY_DST: 0x08 };
  const splitAcc = device.createBuffer({ label: 'ulg-sl-split-acc', size: Math.max(32, nodeCount * 32), usage: U.STORAGE });
  const splitVel = device.createBuffer({ label: 'ulg-sl-split-vel', size: Math.max(32, nodeCount * 32), usage: U.STORAGE });
  const receiptBuffer = device.createBuffer({ label: 'ulg-sl-receipt', size: 16, usage: U.STORAGE | U.COPY_SRC | U.COPY_DST });
  const paramsBuffer = device.createBuffer({ label: 'ulg-sl-params', size: 48, usage: U.UNIFORM | U.COPY_DST });
  const leases = [splitAcc, splitVel, receiptBuffer, paramsBuffer].map((buf, idx) =>
    leaseScope.issue(buf, { label: `sl-buf-${idx}`, producer: 'solid-liquid-unilateral-slip', onRelease: (b) => b.destroy() })
  );
  const paramsBytes = new ArrayBuffer(48);
  const pu = new Uint32Array(paramsBytes);
  const pf = new Float32Array(paramsBytes);

  return Object.freeze({
    schema: ULG_SOLID_LIQUID_SLIP_SCHEMA,
    descriptor: SOLID_LIQUID_VELOCITY_SEPARATION_LAW_DESCRIPTOR,
    gridDims: Object.freeze([nx, ny, nz]),
    receiptBuffer,
    encode(encoder, {
      stateBuffer,
      mechanicsBuffer,
      particleCount,
      gridSpacingM: stepGridSpacingM = gridSpacingM,
      shift: stepShift = shift,
      fixedScale: stepFixedScale = fixedScale,
      blendAlpha: stepBlendAlpha = blendAlpha
    }) {
      if (!(particleCount > 0) || !(stepGridSpacingM > 0)) return 0;
      pu.set([particleCount, nx, ny, nz, stepShift, nodeCount, 0, 0], 0);
      pf.set([1 / stepGridSpacingM, stepFixedScale, 1 / stepFixedScale, stepBlendAlpha], 8);
      device.queue.writeBuffer(paramsBuffer, 0, paramsBytes);
      const bg = createCachedExplicitBindGroup(device, {
        label: 'ulg-sl-slip-bg',
        layout: pipelines.clear_split_grid.bindGroupLayout,
        entries: [paramsBuffer, stateBuffer, mechanicsBuffer, splitAcc, splitVel, receiptBuffer].map((buffer, binding) => ({
          binding,
          resource: { buffer }
        }))
      });
      const pass = encoder.beginComputePass({ label: 'ulg-solid-liquid-unilateral-slip' });
      pass.setBindGroup(0, bg);
      const nodeGroups = Math.max(1, Math.ceil(nodeCount / 64));
      const particleGroups = Math.max(1, Math.ceil(particleCount / 64));
      pass.setPipeline(pipelines.clear_split_grid.pipeline);
      pass.dispatchWorkgroups(nodeGroups);
      pass.setPipeline(pipelines.p2g_split_phase_fields.pipeline);
      pass.dispatchWorkgroups(particleGroups);
      pass.setPipeline(pipelines.resolve_mixed_node_unilateral_slip.pipeline);
      pass.dispatchWorkgroups(nodeGroups);
      pass.setPipeline(pipelines.g2p_apply_separated_velocities.pipeline);
      pass.dispatchWorkgroups(particleGroups);
      pass.end();
      return 4;
    },
    destroy() {
      for (const lease of leases) leaseScope.release(lease, { by: 'solid-liquid-slip-destroy', allowAlreadyReleased: true });
      leaseScope.assertDrained({ requireAllReleased: true });
    }
  });
}

/**
 * Zero-churn device-cached runner wired into ULG's canonical MLS-MPM continuum
 * step loop. Encodes into an already-open command encoder (`0` extra submits,
 * `0` steady-state buffer allocations, `0` bind-group churn) or submits cleanly
 * when called standalone.
 */
export function runCachedSphSolidLiquidVelocitySeparationStep({
  device,
  stateBuffer,
  mechanicsBuffer,
  particleCount,
  gridDims,
  gridSpacingM,
  shift = 2,
  blendAlpha = 1.0,
  fixedScale = null,
  refParticleMassKg = 1.0,
  encoder = null
} = {}) {
  if (!device?.createBuffer || !device.queue?.writeBuffer || !stateBuffer || !mechanicsBuffer) return false;
  if (!(particleCount > 0) || !(gridSpacingM > 0) || !Array.isArray(gridDims) || gridDims.length < 3) return false;
  const nx = Math.max(1, Math.trunc(gridDims[0]));
  const ny = Math.max(1, Math.trunc(gridDims[1]));
  const nz = Math.max(1, Math.trunc(gridDims[2]));
  const nodeCount = nx * ny * nz;
  const maxBinding = device.limits?.maxStorageBufferBindingSize ?? (128 * 1024 * 1024);
  if (nodeCount * 32 > maxBinding) return false;

  let byDims = cachedDeviceSlipStages.get(device);
  if (!byDims) {
    byDims = new Map();
    cachedDeviceSlipStages.set(device, byDims);
  }
  const key = `${nx}x${ny}x${nz}`;
  let stage = byDims.get(key);
  if (!stage) {
    if (byDims.size >= 4) {
      const oldestKey = byDims.keys().next().value;
      byDims.get(oldestKey)?.destroy();
      byDims.delete(oldestKey);
    }
    stage = createSphSolidLiquidVelocitySeparationStage(device, {
      gridDims: [nx, ny, nz],
      gridSpacingM,
      shift,
      fixedScale: fixedScale ?? resolveSolidLiquidSlipFixedScale(refParticleMassKg),
      blendAlpha
    });
    byDims.set(key, stage);
  }

  const resolvedFixedScale = fixedScale ?? resolveSolidLiquidSlipFixedScale(refParticleMassKg);
  const ownedEncoder = !encoder;
  const activeEncoder = encoder || device.createCommandEncoder({ label: 'ulg-solid-liquid-slip-step' });
  const dispatches = stage.encode(activeEncoder, {
    stateBuffer,
    mechanicsBuffer,
    particleCount,
    gridSpacingM,
    shift,
    fixedScale: resolvedFixedScale,
    blendAlpha
  });
  if (ownedEncoder) {
    device.queue.submit([activeEncoder.finish()]);
  }
  const prev = globalThis.__ulgSolidLiquidSlipStatus;
  globalThis.__ulgSolidLiquidSlipStatus = {
    schema: ULG_SOLID_LIQUID_SLIP_SCHEMA,
    active: true,
    steps: (prev?.steps ?? 0) + 1,
    lastParticleCount: particleCount,
    gridDims: [nx, ny, nz],
    gridSpacingM,
    dispatches,
    sharedEncoder: !ownedEncoder
  };
  return true;
}
