import { computeBufferBinding, createCachedExplicitBindGroup, createCachedExplicitComputePipeline } from '../webgpuComputeLayout.js';
import { createSphExactMassWgsl } from './sphExactMassWgsl.js';
import { createSphExactLedgerWgsl, createSphExactLedgerScatterWgsl } from './sphExactLedgerWgsl.js';
import { SPH_EXACT_THERMAL_ENERGY_FORMAT } from './sphExactThermalEnergyWgsl.js';
import { LAW_FALLBACK_POLICIES, LAW_SPATIAL_AUTHORITIES } from './lawAdapterContract.js';

// A5 SOL-3, mechanical half (plan/todo/a5-solid-fluid-coupling.md):
// two-way contact between rigid-body members and SPH/MPM particles over the
// canonical Schroeder Simulation (SS) fluid spatial directory
// (`SCHROEDER_SPATIAL_EPOCH_DIRECTORY_ABI`), with bounded direct-pair fallback
// (`LAW_FALLBACK_POLICIES.DIRECT_PAIR`) for standalone unit fixtures without an
// SS epoch. Zero private spatial hash allocations or binning passes.
const FORMAT = SPH_EXACT_THERMAL_ENERGY_FORMAT;
const COUNTER_WORDS_PER_ROW = 4 * FORMAT.wordCount;
const GPU_BUFFER_USAGE = Object.freeze({ STORAGE: 0x80, UNIFORM: 0x40, COPY_SRC: 0x04, COPY_DST: 0x08 });
export const SCHROEDER_SOLID_FLUID_CONTACT_LAW = Object.freeze({ baumgarte: 0.2, maxBiasSpeedMPerS: 0.5, slopM: 2.5e-4 });
export const SCHROEDER_SOLID_FLUID_CONTACT_SPATIAL_AUTHORITY = LAW_SPATIAL_AUTHORITIES.CANONICAL_SS_EPOCH;
export const SCHROEDER_SOLID_FLUID_CONTACT_FALLBACK_POLICY = LAW_FALLBACK_POLICIES.DIRECT_PAIR;

// Canonical SS fluid-directory solid-fluid contact: 1 thread per rigid member
// queries the already-built SCHROEDER_SPATIAL_EPOCH_DIRECTORY_ABI fluid directory
// (or evaluates bounded direct pairs when ss_geom.x <= 0 in standalone fixtures).
export const schroederSolidFluidContactSsWgsl = /* wgsl */ `
${createSphExactMassWgsl(FORMAT)}
${createSphExactLedgerWgsl(FORMAT)}
${createSphExactLedgerScatterWgsl(FORMAT, { prefix: 'fc', counters: 'impulse_counters' })}
struct ContactParams {
  counts: vec4<u32>,
  law: vec4<f32>,
  time: vec4<f32>,
  ss_geom: vec4<f32>,
};
@group(0) @binding(0) var<uniform> params: ContactParams;
@group(0) @binding(1) var<storage, read> member_world: array<vec4<f32>>;
@group(0) @binding(2) var<storage, read> members: array<vec4<f32>>;
@group(0) @binding(3) var<storage, read_write> frames: array<vec4<f32>>;
@group(0) @binding(4) var<storage, read_write> fluid_state: array<vec4<f32>>;
@group(0) @binding(5) var<storage, read> fluid_thermo: array<vec4<f32>>;
@group(0) @binding(6) var<storage, read_write> impulse_counters: array<atomic<u32>>;
@group(0) @binding(7) var<storage, read_write> contact_ledger: array<atomic<u32>>;
// Canonical SS fluid directory (SCHROEDER_SPATIAL_EPOCH_DIRECTORY_ABI)
@group(0) @binding(8) var<storage, read> fluid_directory: array<u32>;
// Fixed-point (1e6 m/s) per-fluid-particle delta-v accumulators + contact count:
// [dvx, dvy, dvz, contact_count] (4 atomic<i32> words per fluid particle)
@group(0) @binding(9) var<storage, read_write> fluid_dv: array<atomic<i32>>;

const ROWS: u32 = 6u;
const SS_DIR_MAGIC: u32 = 0x53534531u;
const DV_SCALE: f32 = 1.0e6;
const DV_CLAMP: f32 = 1.0e9;

fn ss_dir_valid() -> bool {
  if (arrayLength(&fluid_directory) < 48u) { return false; }
  let status = fluid_directory[2u];
  return fluid_directory[0u] == SS_DIR_MAGIC
    && (fluid_directory[1u] == 1u || fluid_directory[1u] == 2u)
    && (status & 3u) == 3u
    && (status & 28u) == 0u;
}

fn ss_find_cell(cell_count: u32, keys_off: u32, want_key: array<u32, 5>) -> u32 {
  var lo = 0u;
  var hi = cell_count;
  while (lo < hi) {
    let mid = lo + ((hi - lo) >> 1u);
    let base = keys_off + mid * 5u;
    var cmp = 0i;
    for (var w = 0u; w < 5u; w = w + 1u) {
      let kv = fluid_directory[base + w];
      if (kv < want_key[w]) { cmp = -1i; break; }
      if (kv > want_key[w]) { cmp = 1i; break; }
    }
    if (cmp == 0i) { return mid; }
    if (cmp < 0i) { lo = mid + 1u; } else { hi = mid; }
  }
  return 0xffffffffu;
}

fn count_member_with_fluid_particle(
  j: u32,
  xm: vec3<f32>,
  vm: vec3<f32>,
  a: f32,
  dt: f32
) {
  if (j >= params.counts.y || (j * 4u + 3u) >= arrayLength(&fluid_dv)) { return; }
  let p = fluid_state[j * 2u];
  let mass_p = p.w;
  if (!(mass_p > 0.0)) { return; }
  let radius_p = fluid_thermo[j * 3u + 2u].w;
  let offset = p.xyz - xm;
  let d = length(offset);
  let reach = a + radius_p;
  if (!(d < reach && d > 1.0e-9)) { return; }
  let n = offset / d;
  let v = fluid_state[j * 2u + 1u].xyz;
  let vn = dot(v - vm, n);
  let goal_speed = min(params.law.z * max(reach - d - params.law.y, 0.0) / dt, params.law.w);
  if (!(vn < goal_speed)) { return; }
  atomicAdd(&fluid_dv[j * 4u + 3u], 1);
}

fn quat_rotate_inverse(q: vec4<f32>, v: vec3<f32>) -> vec3<f32> {
  let qi = vec4<f32>(-q.xyz, q.w);
  let t = 2.0 * cross(qi.xyz, v);
  return v + qi.w * t + cross(qi.xyz, t);
}

fn contact_member_with_fluid_particle(
  j: u32,
  body: u32,
  xm: vec3<f32>,
  vm: vec3<f32>,
  frame0: vec4<f32>,
  frame1: vec4<f32>,
  frame4: vec4<f32>,
  a: f32,
  dt: f32
) -> vec2<u32> {
  if (j >= params.counts.y || (j * 4u + 3u) >= arrayLength(&fluid_dv)) { return vec2<u32>(0u, 0u); }
  let p = fluid_state[j * 2u];
  let mass_p = p.w;
  if (!(mass_p > 0.0)) { return vec2<u32>(0u, 0u); }
  let radius_p = fluid_thermo[j * 3u + 2u].w;
  let offset = p.xyz - xm;
  let d = length(offset);
  let reach = a + radius_p;
  if (!(d < reach && d > 1.0e-9)) { return vec2<u32>(0u, 0u); }
  let n = offset / d;
  let v = fluid_state[j * 2u + 1u].xyz;
  let vn = dot(v - vm, n);
  let goal_speed = min(params.law.z * max(reach - d - params.law.y, 0.0) / dt, params.law.w);
  if (!(vn < goal_speed)) { return vec2<u32>(0u, 0u); }
  let lever = (xm + n * a) - frame0.xyz;
  // Exact rotational inertia compliance (r x n)^T I^{-1} (r x n) in principal frame
  // (identically 0 for central impacts where r x n == 0 or immovable bodies frame0.w <= 0).
  let rn_body = quat_rotate_inverse(frame1, cross(lever, n));
  let inv_i = vec3<f32>(
    select(0.0, 1.0 / frame4.x, frame4.x > 1.0e-12),
    select(0.0, 1.0 / frame4.y, frame4.y > 1.0e-12),
    select(0.0, 1.0 / frame4.z, frame4.z > 1.0e-12)
  );
  let rot_inv = dot(rn_body * rn_body, inv_i);
  // Exact Jacobi mass-splitting: when K rigid members simultaneously touch fluid
  // particle j, each contact gets 1/K of the fluid particle's mass (eff_inv_mass =
  // K/mass_p + 1/M_body + (r x n)^T I^{-1} (r x n)).
  let n_contacts = max(1, atomicLoad(&fluid_dv[j * 4u + 3u]));
  let inv_mass = f32(n_contacts) / mass_p + select(0.0, 1.0 / frame0.w + rot_inv, frame0.w > 0.0);
  let impulse = ((goal_speed - vn) / inv_mass) * n;
  let dv = impulse / mass_p;
  let qx = i32(clamp(round(dv.x * DV_SCALE), -DV_CLAMP, DV_CLAMP));
  let qy = i32(clamp(round(dv.y * DV_SCALE), -DV_CLAMP, DV_CLAMP));
  let qz = i32(clamp(round(dv.z * DV_SCALE), -DV_CLAMP, DV_CLAMP));
  atomicAdd(&fluid_dv[j * 4u + 0u], qx);
  atomicAdd(&fluid_dv[j * 4u + 1u], qy);
  atomicAdd(&fluid_dv[j * 4u + 2u], qz);
  let applied_impulse = (vec3<f32>(f32(qx), f32(qy), f32(qz)) / DV_SCALE) * mass_p;
  let reaction = -applied_impulse;
  let angular = cross(lever, reaction);
  let row = body * ROWS;
  var err = 0u;
  err |= fc_scatter_f32(row, bitcast<u32>(reaction.x));
  err |= fc_scatter_f32(row + 1u, bitcast<u32>(reaction.y));
  err |= fc_scatter_f32(row + 2u, bitcast<u32>(reaction.z));
  err |= fc_scatter_f32(row + 3u, bitcast<u32>(angular.x));
  err |= fc_scatter_f32(row + 4u, bitcast<u32>(angular.y));
  err |= fc_scatter_f32(row + 5u, bitcast<u32>(angular.z));
  return vec2<u32>(1u, err);
}

@compute @workgroup_size(64)
fn reset_ledger_ss(@builtin(global_invocation_id) id: vec3<u32>) {
  if (id.x < params.counts.y && (id.x * 4u + 3u) < arrayLength(&fluid_dv)) {
    atomicStore(&fluid_dv[id.x * 4u + 0u], 0);
    atomicStore(&fluid_dv[id.x * 4u + 1u], 0);
    atomicStore(&fluid_dv[id.x * 4u + 2u], 0);
    atomicStore(&fluid_dv[id.x * 4u + 3u], 0);
  }
  if (id.x == 0u) {
    atomicStore(&contact_ledger[0], 0u);
    atomicStore(&contact_ledger[2], 0u);
  }
}

@compute @workgroup_size(64)
fn count_contacts_ss(@builtin(global_invocation_id) id: vec3<u32>) {
  let i = id.x;
  if (i >= params.counts.x) { return; }
  let m = members[i * 2u];
  if (!(m.w > 0.0)) { return; }
  let body = bitcast<u32>(members[i * 2u + 1u].x);
  if (body >= params.counts.z) { return; }
  let xm = member_world[i * 2u].xyz;
  let vm = member_world[i * 2u + 1u].xyz;
  let a = params.law.x;
  let dt = params.time.x;
  let base_spacing = params.ss_geom.x;

  if (base_spacing > 0.0) {
    if (!ss_dir_valid()) { return; }
    let cell_count = fluid_directory[18u];
    let keys_off = fluid_directory[29u];
    let offsets_off = fluid_directory[30u];
    let members_off = fluid_directory[31u];
    let chart_id = u32(max(0.0, floor(params.ss_geom.y + 0.5)));
    let min_level = i32(round(params.ss_geom.z));
    let max_level = i32(round(params.ss_geom.w));
    let max_reach = 3.0 * a + params.law.y;

    for (var level = min_level; level <= max_level; level = level + 1i) {
      let spacing = base_spacing * exp2(f32(level));
      if (!(spacing > 0.0)) { continue; }
      let level_key = bitcast<u32>(level) ^ 0x80000000u;
      let reach_level = max(max_reach, a + spacing + params.law.y);
      let halo_needed = i32(ceil(reach_level / spacing));
      let halo_r = clamp(halo_needed, 1i, 8i);
      let base_cell = vec3<i32>(floor(xm / spacing));
      for (var dz = -halo_r; dz <= halo_r; dz = dz + 1i) {
        for (var dy = -halo_r; dy <= halo_r; dy = dy + 1i) {
          for (var dx = -halo_r; dx <= halo_r; dx = dx + 1i) {
            let c = base_cell + vec3<i32>(dx, dy, dz);
            let want_key = array<u32, 5>(
              chart_id,
              level_key,
              bitcast<u32>(c.x) ^ 0x80000000u,
              bitcast<u32>(c.y) ^ 0x80000000u,
              bitcast<u32>(c.z) ^ 0x80000000u
            );
            let cell_idx = ss_find_cell(cell_count, keys_off, want_key);
            if (cell_idx == 0xffffffffu) { continue; }
            let begin = fluid_directory[offsets_off + cell_idx];
            let end = fluid_directory[offsets_off + cell_idx + 1u];
            for (var mm = begin; mm < end; mm = mm + 1u) {
              let j = fluid_directory[members_off + mm];
              count_member_with_fluid_particle(j, xm, vm, a, dt);
            }
          }
        }
      }
    }
  } else {
    for (var j = 0u; j < params.counts.y; j = j + 1u) {
      count_member_with_fluid_particle(j, xm, vm, a, dt);
    }
  }
}

@compute @workgroup_size(64)
fn contact_members_ss(@builtin(global_invocation_id) id: vec3<u32>) {
  let i = id.x;
  if (i >= params.counts.x) { return; }
  let m = members[i * 2u];
  if (!(m.w > 0.0)) { return; }
  let body = bitcast<u32>(members[i * 2u + 1u].x);
  if (body >= params.counts.z) { return; }
  let xm = member_world[i * 2u].xyz;
  let vm = member_world[i * 2u + 1u].xyz;
  let frame0 = frames[body * 8u];
  let frame1 = frames[body * 8u + 1u];
  let frame4 = frames[body * 8u + 4u];
  let a = params.law.x;
  let dt = params.time.x;
  let base_spacing = params.ss_geom.x;
  var contacts = 0u;
  var error = 0u;

  if (base_spacing > 0.0) {
    if (!ss_dir_valid()) { return; }
    let cell_count = fluid_directory[18u];
    let keys_off = fluid_directory[29u];
    let offsets_off = fluid_directory[30u];
    let members_off = fluid_directory[31u];
    let chart_id = u32(max(0.0, floor(params.ss_geom.y + 0.5)));
    let min_level = i32(round(params.ss_geom.z));
    let max_level = i32(round(params.ss_geom.w));
    let max_reach = 3.0 * a + params.law.y;

    for (var level = min_level; level <= max_level; level = level + 1i) {
      let spacing = base_spacing * exp2(f32(level));
      if (!(spacing > 0.0)) { continue; }
      let level_key = bitcast<u32>(level) ^ 0x80000000u;
      let reach_level = max(max_reach, a + spacing + params.law.y);
      let halo_needed = i32(ceil(reach_level / spacing));
      let halo_r = clamp(halo_needed, 1i, 8i);
      if (halo_needed > 8i) { error |= 2u; }
      let base_cell = vec3<i32>(floor(xm / spacing));
      for (var dz = -halo_r; dz <= halo_r; dz = dz + 1i) {
        for (var dy = -halo_r; dy <= halo_r; dy = dy + 1i) {
          for (var dx = -halo_r; dx <= halo_r; dx = dx + 1i) {
            let c = base_cell + vec3<i32>(dx, dy, dz);
            let want_key = array<u32, 5>(
              chart_id,
              level_key,
              bitcast<u32>(c.x) ^ 0x80000000u,
              bitcast<u32>(c.y) ^ 0x80000000u,
              bitcast<u32>(c.z) ^ 0x80000000u
            );
            let cell_idx = ss_find_cell(cell_count, keys_off, want_key);
            if (cell_idx == 0xffffffffu) { continue; }
            let begin = fluid_directory[offsets_off + cell_idx];
            let end = fluid_directory[offsets_off + cell_idx + 1u];
            for (var mm = begin; mm < end; mm = mm + 1u) {
              let j = fluid_directory[members_off + mm];
              let res = contact_member_with_fluid_particle(j, body, xm, vm, frame0, frame1, frame4, a, dt);
              contacts += res.x;
              error |= res.y;
            }
          }
        }
      }
    }
  } else {
    // Bounded direct-pair fallback (LAW_FALLBACK_POLICIES.DIRECT_PAIR) for standalone unit tests.
    for (var j = 0u; j < params.counts.y; j = j + 1u) {
      let res = contact_member_with_fluid_particle(j, body, xm, vm, frame0, frame1, frame4, a, dt);
      contacts += res.x;
      error |= res.y;
    }
  }

  if (contacts > 0u) { atomicAdd(&contact_ledger[0], contacts); }
  if (error != 0u) { atomicOr(&contact_ledger[1], error); }
}

@compute @workgroup_size(64)
fn apply_fluid_dv_ss(@builtin(global_invocation_id) id: vec3<u32>) {
  let j = id.x;
  if (j >= params.counts.y || (j * 4u + 3u) >= arrayLength(&fluid_dv)) { return; }
  let ix = atomicExchange(&fluid_dv[j * 4u + 0u], 0);
  let iy = atomicExchange(&fluid_dv[j * 4u + 1u], 0);
  let iz = atomicExchange(&fluid_dv[j * 4u + 2u], 0);
  atomicStore(&fluid_dv[j * 4u + 3u], 0);
  if (ix == 0 && iy == 0 && iz == 0) { return; }
  let old = fluid_state[j * 2u + 1u];
  fluid_state[j * 2u + 1u] = vec4<f32>(old.xyz + vec3<f32>(f32(ix), f32(iy), f32(iz)) / DV_SCALE, old.w);
}

// One thread per body: the exact reaction sums join the frame's P and L.
@compute @workgroup_size(64)
fn apply_impulses(@builtin(global_invocation_id) id: vec3<u32>) {
  let body = id.x;
  if (body >= params.counts.z) { return; }
  var sums = array<f32, 6>(0.0, 0.0, 0.0, 0.0, 0.0, 0.0);
  for (var k = 0u; k < ROWS; k++) {
    let total = fc_drain(body * ROWS + k);
    sums[k] = bitcast<f32>(el_project_f32_bits(total.value).bits);
    if (total.error != 0u) { atomicOr(&contact_ledger[1], total.error << 8u); }
  }
  let base = body * 8u;
  let momentum = frames[base + 2u];
  let angular = frames[base + 3u];
  frames[base + 2u] = vec4<f32>(momentum.xyz + vec3<f32>(sums[0], sums[1], sums[2]), momentum.w);
  frames[base + 3u] = vec4<f32>(angular.xyz + vec3<f32>(sums[3], sums[4], sums[5]), angular.w);
}
`;

export const schroederSolidFluidContactWgsl = schroederSolidFluidContactSsWgsl;

/** Canonical SS solid-fluid contact stage (zero private spatial hash). */
export function createSchroederSolidFluidContactStage({ device, memberCount, bodyCount, memberBuffer, memberWorldBuffer,
  frameBuffer, memberRadiusM, law = SCHROEDER_SOLID_FLUID_CONTACT_LAW } = {}) {
  const ssBindings = ['uniform', 'read-only-storage', 'read-only-storage', 'storage', 'storage', 'read-only-storage',
    'storage', 'storage', 'read-only-storage', 'storage'].map((type, binding) => computeBufferBinding(binding, type));
  const ssPipelines = Object.fromEntries(['reset_ledger_ss', 'count_contacts_ss', 'contact_members_ss', 'apply_fluid_dv_ss', 'apply_impulses'].map((entryPoint) =>
    [entryPoint, createCachedExplicitComputePipeline(device, { cacheKey: `ulg-solid-fluid-contact-ss-${entryPoint}.v4`,
      label: `ulg-solid-fluid-contact-ss-${entryPoint}`, code: schroederSolidFluidContactSsWgsl, entryPoint, bindings: ssBindings })]));
  const counters = device.createBuffer({ label: 'ulg-solid-fluid-contact-counters',
    size: (bodyCount * 6 * COUNTER_WORDS_PER_ROW + 4) * 4, usage: GPU_BUFFER_USAGE.STORAGE });
  const ledgerBuffer = device.createBuffer({ label: 'ulg-solid-fluid-contact-ledger', size: 16,
    usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_SRC | GPU_BUFFER_USAGE.COPY_DST });
  const fluidDirectoryPlaceholder = device.createBuffer({ label: 'ulg-solid-fluid-contact-dir-placeholder',
    size: 16, usage: GPU_BUFFER_USAGE.STORAGE });
  let fluidDv = null;
  let fluidDvCapacity = 0;
  function ensureFluidDv(count) {
    const needed = Math.max(64, count);
    if (fluidDv && fluidDvCapacity >= needed) return fluidDv;
    fluidDv?.destroy();
    fluidDvCapacity = needed;
    fluidDv = device.createBuffer({
      label: 'ulg-solid-fluid-contact-ss-dv',
      size: needed * 4 * 4,
      usage: GPU_BUFFER_USAGE.STORAGE
    });
    return fluidDv;
  }
  const params = device.createBuffer({ label: 'ulg-solid-fluid-contact-params', size: 64,
    usage: GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST });
  const words = new ArrayBuffer(64), u = new Uint32Array(words), f = new Float32Array(words);
  f.set([memberRadiusM, law.slopM, law.baumgarte, law.maxBiasSpeedMPerS], 4);
  return Object.freeze({
    ledgerBuffer,
    spatialAuthority: SCHROEDER_SOLID_FLUID_CONTACT_SPATIAL_AUTHORITY,
    prepare(dtSeconds, { particleCount = 0,
      fluidDirectoryBuffer = null, fluidBaseGridSpacingM = 0, fluidChartId = 0, fluidMinLevel = 0, fluidMaxLevel = 0 } = {}) {
      if (!(particleCount > 0) || !(dtSeconds > 0)) return false;
      ensureFluidDv(particleCount);
      const useSs = Boolean(fluidDirectoryBuffer && Number(fluidBaseGridSpacingM) > 0);
      u.set([memberCount, particleCount, bodyCount, 0], 0);
      f[8] = dtSeconds;
      f[9] = 0;
      f.set([useSs ? Number(fluidBaseGridSpacingM) : 0, Number(fluidChartId) || 0, Number(fluidMinLevel) || 0, Number(fluidMaxLevel) || 0], 12);
      device.queue.writeBuffer(params, 0, words);
      return true;
    },
    encode(encoder, dtSeconds, { fluidStateBuffer, fluidThermoBuffer, particleCount,
      fluidDirectoryBuffer = null, fluidBaseGridSpacingM = 0,
      fluidChartId = 0, fluidMinLevel = 0, fluidMaxLevel = 0, pass: sharedPass = null, prepared = false }) {
      if (!(particleCount > 0) || !(dtSeconds > 0)) return false;
      const useSs = Boolean(fluidDirectoryBuffer && Number(fluidBaseGridSpacingM) > 0);
      const dvBuf = ensureFluidDv(particleCount);
      const boundFluidDir = useSs ? fluidDirectoryBuffer : fluidDirectoryPlaceholder;
      if (!prepared) {
        u.set([memberCount, particleCount, bodyCount, 0], 0);
        f[8] = dtSeconds;
        f[9] = 0;
        f.set([useSs ? Number(fluidBaseGridSpacingM) : 0, Number(fluidChartId) || 0, Number(fluidMinLevel) || 0, Number(fluidMaxLevel) || 0], 12);
        device.queue.writeBuffer(params, 0, words);
      }
      const group = createCachedExplicitBindGroup(device, {
        label: 'ulg-solid-fluid-contact-ss-bg',
        layout: ssPipelines.contact_members_ss.bindGroupLayout,
        entries: [params, memberWorldBuffer, memberBuffer, frameBuffer, fluidStateBuffer, fluidThermoBuffer, counters,
          ledgerBuffer, boundFluidDir, dvBuf].map((buffer, binding) => ({ binding, resource: { buffer } }))
      });
      const pass = sharedPass ?? encoder.beginComputePass({ label: 'ulg-solid-fluid-contact-ss' });
      pass.setBindGroup(0, group);
      for (const [entryPoint, count] of [
        ['reset_ledger_ss', Math.max(1, particleCount)],
        ['count_contacts_ss', memberCount],
        ['contact_members_ss', memberCount],
        ['apply_fluid_dv_ss', particleCount],
        ['apply_impulses', bodyCount]
      ]) {
        pass.setPipeline(ssPipelines[entryPoint].pipeline);
        pass.dispatchWorkgroups(Math.ceil(count / 64));
      }
      if (!sharedPass) pass.end();
      return true;
    },
    destroy() {
      fluidDv?.destroy();
      for (const b of [counters, ledgerBuffer, fluidDirectoryPlaceholder, params]) b.destroy();
    }
  });
}
