import { computeBufferBinding, createCachedExplicitBindGroup, createCachedExplicitComputePipeline } from '../webgpuComputeLayout.js';
import { createSphExactMassWgsl } from './sphExactMassWgsl.js';
import { createSphExactLedgerWgsl, createSphExactLedgerScatterWgsl } from './sphExactLedgerWgsl.js';
import { SPH_EXACT_THERMAL_ENERGY_FORMAT } from './sphExactThermalEnergyWgsl.js';

// A5 SOL-3, mechanical half (plan/todo/a5-solid-fluid-coupling.md):
// two-way contact between rigid-body members and SPH/MPM particles.
//
// One thread per particle visits every member (Gauss-Seidel over the
// particle's own contacts). A member is a sphere of radius a (half its
// pitch); a contact is |x_p - x_m| < a + r_p. When the normal relative
// velocity is below the Baumgarte target (beta * penetration / dt, capped),
// the particle receives the normal impulse that reaches it,
//   J = m_eff (target - v_n) n,   m_eff = 1 / (1/m_p + 1/M_body),
// (inelastic, frictionless: a fluid slips along the solid), and the body
// receives -J at the contact point (linear and angular). The body side is
// scattered as f32 values into exact integer counters
// (sphExactLedgerWgsl), so its sums are order-independent; a per-body pass
// adds them to the frame's world P and L. Momentum is conserved up to the
// f32 updates of each side; positions are never moved directly.
//
// Neighbour search uses a GPU-resident 4096-bucket 3D spatial cell hash over
// alive rigid members (O(N + M), zero host round-trips). Bucket collisions in
// the 27-cell stencil are deduplicated per thread so every member is tested at
// most once.
const FORMAT = SPH_EXACT_THERMAL_ENERGY_FORMAT;
const COUNTER_WORDS_PER_ROW = 4 * FORMAT.wordCount;
const GRID_BUCKETS = 4096;
const GPU_BUFFER_USAGE = Object.freeze({ STORAGE: 0x80, UNIFORM: 0x40, COPY_SRC: 0x04, COPY_DST: 0x08 });
export const SCHROEDER_SOLID_FLUID_CONTACT_LAW = Object.freeze({ baumgarte: 0.2, maxBiasSpeedMPerS: 0.5, slopM: 2.5e-4 });

export const schroederSolidFluidContactWgsl = /* wgsl */ `
${createSphExactMassWgsl(FORMAT)}
${createSphExactLedgerWgsl(FORMAT)}
${createSphExactLedgerScatterWgsl(FORMAT, { prefix: 'fc', counters: 'impulse_counters' })}
struct ContactParams {
  // member count, particle count, body count, unused
  counts: vec4<u32>,
  // member radius (half pitch), penetration slop, Baumgarte beta, max bias speed
  law: vec4<f32>,
  // dt, unused...
  time: vec4<f32>,
  // canonical SS fluid directory geometry: [base_grid_spacing_m, chart_id, min_level, max_level]
  ss_geom: vec4<f32>,
};
@group(0) @binding(0) var<uniform> params: ContactParams;
@group(0) @binding(1) var<storage, read> member_world: array<vec4<f32>>;
@group(0) @binding(2) var<storage, read> members: array<vec4<f32>>;
@group(0) @binding(3) var<storage, read_write> frames: array<vec4<f32>>;
@group(0) @binding(4) var<storage, read_write> fluid_state: array<vec4<f32>>;
@group(0) @binding(5) var<storage, read> fluid_thermo: array<vec4<f32>>;
@group(0) @binding(6) var<storage, read_write> impulse_counters: array<atomic<u32>>;
// [contacts this step, scatter error flags, max fluid radius f32 bits, unused]
@group(0) @binding(7) var<storage, read_write> contact_ledger: array<atomic<u32>>;
// [cell_head[4096], member_next[memberCount]]
@group(0) @binding(8) var<storage, read_write> spatial_grid: array<atomic<u32>>;

const ROWS: u32 = 6u;
const GRID_BUCKETS: u32 = ${GRID_BUCKETS}u;
const GRID_MASK: u32 = ${GRID_BUCKETS - 1}u;
const EMPTY_NODE: u32 = 0xffffffffu;

fn hash_cell(c: vec3<i32>) -> u32 {
  return ((bitcast<u32>(c.x) * 73856093u) ^ (bitcast<u32>(c.y) * 19349663u) ^ (bitcast<u32>(c.z) * 83492791u)) & GRID_MASK;
}

fn grid_cell_edge() -> f32 {
  let max_r = select(
    bitcast<f32>(atomicLoad(&contact_ledger[2])),
    bitcast<f32>(atomicLoad(&spatial_grid[GRID_BUCKETS + params.counts.x])),
    params.counts.w != 0u
  );
  let extra_slop = select(0.0, params.time.y, params.counts.w != 0u);
  return max(max(2.0 * params.law.x, params.law.x + max_r + extra_slop) * 1.01, 1.0e-5);
}

@compute @workgroup_size(64)
fn reset_ledger(@builtin(global_invocation_id) id: vec3<u32>) {
  if (params.counts.w == 0u && id.x < GRID_BUCKETS) { atomicStore(&spatial_grid[id.x], EMPTY_NODE); }
  if (id.x == 0u) {
    atomicStore(&contact_ledger[0], 0u);
    if (params.counts.w == 0u) { atomicStore(&contact_ledger[2], 0u); }
  }
}

@compute @workgroup_size(64)
fn measure_fluid_radius(@builtin(global_invocation_id) id: vec3<u32>) {
  let j = id.x;
  if (j >= params.counts.y) { return; }
  if (!(fluid_state[j * 2u].w > 0.0)) { return; }
  let r = fluid_thermo[j * 3u + 2u].w;
  if (r > 0.0) { atomicMax(&contact_ledger[2], bitcast<u32>(r)); }
}

@compute @workgroup_size(64)
fn bin_members(@builtin(global_invocation_id) id: vec3<u32>) {
  let i = id.x;
  if (i >= params.counts.x) { return; }
  if (!(members[i * 2u].w > 0.0)) { return; }
  let xm = member_world[i * 2u].xyz;
  let edge = grid_cell_edge();
  let bucket = hash_cell(vec3<i32>(floor(xm / edge)));
  let prev = atomicExchange(&spatial_grid[bucket], i);
  atomicStore(&spatial_grid[GRID_BUCKETS + i], prev);
}

@compute @workgroup_size(64)
fn contact_particles(@builtin(global_invocation_id) id: vec3<u32>) {
  let j = id.x;
  if (j >= params.counts.y) { return; }
  let p = fluid_state[j * 2u];
  let mass_p = p.w;
  if (!(mass_p > 0.0)) { return; }
  let radius_p = fluid_thermo[j * 3u + 2u].w;
  var v = fluid_state[j * 2u + 1u].xyz;
  let a = params.law.x;
  let dt = params.time.x;
  let edge = grid_cell_edge();
  let base_cell = vec3<i32>(floor(p.xyz / edge));
  var seen: array<u32, 27>;
  var seen_count = 0u;
  var contacts = 0u;
  var error = 0u;
  for (var dz = -1i; dz <= 1i; dz++) {
    for (var dy = -1i; dy <= 1i; dy++) {
      for (var dx = -1i; dx <= 1i; dx++) {
        let bucket = hash_cell(base_cell + vec3<i32>(dx, dy, dz));
        var dup = false;
        for (var s = 0u; s < seen_count; s++) {
          if (seen[s] == bucket) { dup = true; break; }
        }
        if (dup) { continue; }
        seen[seen_count] = bucket;
        seen_count += 1u;
        var i = atomicLoad(&spatial_grid[bucket]);
        while (i != EMPTY_NODE) {
          let next_i = atomicLoad(&spatial_grid[GRID_BUCKETS + i]);
          let m = members[i * 2u];
          if (m.w > 0.0) {
            let xm = member_world[i * 2u].xyz;
            let offset = p.xyz - xm;
            let d = length(offset);
            let reach = a + radius_p;
            if (d < reach && d > 1.0e-9) {
              let body = bitcast<u32>(members[i * 2u + 1u].x);
              if (body < params.counts.z) {
                let n = offset / d;
                let vm = member_world[i * 2u + 1u].xyz;
                let vn = dot(v - vm, n);
                let goal_speed = min(params.law.z * max(reach - d - params.law.y, 0.0) / dt, params.law.w);
                if (vn < goal_speed) {
                  let frame0 = frames[body * 8u];
                  let inv_mass = 1.0 / mass_p + select(0.0, 1.0 / frame0.w, frame0.w > 0.0);
                  let impulse = ((goal_speed - vn) / inv_mass) * n;
                  v = v + impulse / mass_p;
                  // The body's reaction: -impulse at the contact point (member surface).
                  let lever = (xm + n * a) - frame0.xyz;
                  let reaction = -impulse;
                  let angular = cross(lever, reaction);
                  let row = body * ROWS;
                  error |= fc_scatter_f32(row, bitcast<u32>(reaction.x));
                  error |= fc_scatter_f32(row + 1u, bitcast<u32>(reaction.y));
                  error |= fc_scatter_f32(row + 2u, bitcast<u32>(reaction.z));
                  error |= fc_scatter_f32(row + 3u, bitcast<u32>(angular.x));
                  error |= fc_scatter_f32(row + 4u, bitcast<u32>(angular.y));
                  error |= fc_scatter_f32(row + 5u, bitcast<u32>(angular.z));
                  contacts += 1u;
                }
              }
            }
          }
          i = next_i;
        }
      }
    }
  }
  if (contacts == 0u) { return; }
  let old = fluid_state[j * 2u + 1u];
  fluid_state[j * 2u + 1u] = vec4<f32>(v, old.w);
  atomicAdd(&contact_ledger[0], contacts);
  if (error != 0u) { atomicOr(&contact_ledger[1], error); }
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

// Canonical SS fluid-directory solid-fluid contact: 1 thread per rigid member
// queries the already-built SCHROEDER_SPATIAL_EPOCH_DIRECTORY_ABI fluid directory
// (zero private 4096-bucket spatial_grid allocation/binning).
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
// Fixed-point (1e6 m/s) per-fluid-particle delta-v accumulators [dvx, dvy, dvz]
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

@compute @workgroup_size(64)
fn reset_ledger_ss(@builtin(global_invocation_id) id: vec3<u32>) {
  if (id.x < params.counts.y && (id.x * 3u + 2u) < arrayLength(&fluid_dv)) {
    atomicStore(&fluid_dv[id.x * 3u + 0u], 0);
    atomicStore(&fluid_dv[id.x * 3u + 1u], 0);
    atomicStore(&fluid_dv[id.x * 3u + 2u], 0);
  }
  if (id.x == 0u) {
    atomicStore(&contact_ledger[0], 0u);
    atomicStore(&contact_ledger[2], 0u);
  }
}

@compute @workgroup_size(64)
fn contact_members_ss(@builtin(global_invocation_id) id: vec3<u32>) {
  let i = id.x;
  if (i >= params.counts.x || !ss_dir_valid()) { return; }
  let m = members[i * 2u];
  if (!(m.w > 0.0)) { return; }
  let body = bitcast<u32>(members[i * 2u + 1u].x);
  if (body >= params.counts.z) { return; }
  let xm = member_world[i * 2u].xyz;
  let vm = member_world[i * 2u + 1u].xyz;
  let frame0 = frames[body * 8u];
  let a = params.law.x;
  let dt = params.time.x;

  let cell_count = fluid_directory[18u];
  let keys_off = fluid_directory[29u];
  let offsets_off = fluid_directory[30u];
  let members_off = fluid_directory[31u];
  let base_spacing = params.ss_geom.x;
  let chart_id = u32(max(0.0, floor(params.ss_geom.y + 0.5)));
  let min_level = i32(round(params.ss_geom.z));
  let max_level = i32(round(params.ss_geom.w));
  let max_reach = 3.0 * a + params.law.y;
  var contacts = 0u;
  var error = 0u;

  for (var level = min_level; level <= max_level; level = level + 1i) {
    let spacing = base_spacing * exp2(f32(level));
    if (!(spacing > 0.0)) { continue; }
    let level_key = bitcast<u32>(level) ^ 0x80000000u;
    let reach_level = max(max_reach, a + spacing + params.law.y);
    let halo_needed = i32(ceil(reach_level / spacing));
    let halo_r = clamp(halo_needed, 1i, 6i);
    if (halo_needed > 6i && level < max_level) { continue; }
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
            if (j >= params.counts.y || (j * 3u + 2u) >= arrayLength(&fluid_dv)) { continue; }
            let p = fluid_state[j * 2u];
            let mass_p = p.w;
            if (!(mass_p > 0.0)) { continue; }
            let radius_p = fluid_thermo[j * 3u + 2u].w;
            let offset = p.xyz - xm;
            let d = length(offset);
            let reach = a + radius_p;
            if (d < reach && d > 1.0e-9) {
              let n = offset / d;
              let v = fluid_state[j * 2u + 1u].xyz;
              let vn = dot(v - vm, n);
              let goal_speed = min(params.law.z * max(reach - d - params.law.y, 0.0) / dt, params.law.w);
              if (vn < goal_speed) {
                let inv_mass = 1.0 / mass_p + select(0.0, 1.0 / frame0.w, frame0.w > 0.0);
                let impulse = ((goal_speed - vn) / inv_mass) * n;
                let dv = impulse / mass_p;
                let qx = i32(clamp(round(dv.x * DV_SCALE), -DV_CLAMP, DV_CLAMP));
                let qy = i32(clamp(round(dv.y * DV_SCALE), -DV_CLAMP, DV_CLAMP));
                let qz = i32(clamp(round(dv.z * DV_SCALE), -DV_CLAMP, DV_CLAMP));
                atomicAdd(&fluid_dv[j * 3u + 0u], qx);
                atomicAdd(&fluid_dv[j * 3u + 1u], qy);
                atomicAdd(&fluid_dv[j * 3u + 2u], qz);
                let applied_impulse = (vec3<f32>(f32(qx), f32(qy), f32(qz)) / DV_SCALE) * mass_p;
                let lever = (xm + n * a) - frame0.xyz;
                let reaction = -applied_impulse;
                let angular = cross(lever, reaction);
                let row = body * ROWS;
                error |= fc_scatter_f32(row, bitcast<u32>(reaction.x));
                error |= fc_scatter_f32(row + 1u, bitcast<u32>(reaction.y));
                error |= fc_scatter_f32(row + 2u, bitcast<u32>(reaction.z));
                error |= fc_scatter_f32(row + 3u, bitcast<u32>(angular.x));
                error |= fc_scatter_f32(row + 4u, bitcast<u32>(angular.y));
                error |= fc_scatter_f32(row + 5u, bitcast<u32>(angular.z));
                contacts += 1u;
              }
            }
          }
        }
      }
    }
  }
  if (contacts == 0u) { return; }
  atomicAdd(&contact_ledger[0], contacts);
  if (error != 0u) { atomicOr(&contact_ledger[1], error); }
}

@compute @workgroup_size(64)
fn apply_fluid_dv_ss(@builtin(global_invocation_id) id: vec3<u32>) {
  let j = id.x;
  if (j >= params.counts.y || (j * 3u + 2u) >= arrayLength(&fluid_dv)) { return; }
  let ix = atomicExchange(&fluid_dv[j * 3u + 0u], 0);
  let iy = atomicExchange(&fluid_dv[j * 3u + 1u], 0);
  let iz = atomicExchange(&fluid_dv[j * 3u + 2u], 0);
  if (ix == 0 && iy == 0 && iz == 0) { return; }
  let old = fluid_state[j * 2u + 1u];
  fluid_state[j * 2u + 1u] = vec4<f32>(old.xyz + vec3<f32>(f32(ix), f32(iy), f32(iz)) / DV_SCALE, old.w);
}

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

/** The contact stage over the rigid family's buffers and the fluid lane's state. */
export function createSchroederSolidFluidContactStage({ device, memberCount, bodyCount, memberBuffer, memberWorldBuffer,
  frameBuffer, memberRadiusM, law = SCHROEDER_SOLID_FLUID_CONTACT_LAW } = {}) {
  const bindings = ['uniform', 'read-only-storage', 'read-only-storage', 'storage', 'storage', 'read-only-storage',
    'storage', 'storage', 'storage'].map((type, binding) => computeBufferBinding(binding, type));
  const ssBindings = ['uniform', 'read-only-storage', 'read-only-storage', 'storage', 'storage', 'read-only-storage',
    'storage', 'storage', 'read-only-storage', 'storage'].map((type, binding) => computeBufferBinding(binding, type));
  const pipelines = Object.fromEntries(['reset_ledger', 'measure_fluid_radius', 'bin_members', 'contact_particles',
    'apply_impulses'].map((entryPoint) =>
    [entryPoint, createCachedExplicitComputePipeline(device, { cacheKey: `ulg-solid-fluid-contact-${entryPoint}.v3`,
      label: `ulg-solid-fluid-contact-${entryPoint}`, code: schroederSolidFluidContactWgsl, entryPoint, bindings })]));
  let ssPipelines = null;
  function getSsPipelines() {
    if (!ssPipelines) {
      ssPipelines = Object.fromEntries(['reset_ledger_ss', 'contact_members_ss', 'apply_fluid_dv_ss', 'apply_impulses'].map((entryPoint) =>
        [entryPoint, createCachedExplicitComputePipeline(device, { cacheKey: `ulg-solid-fluid-contact-ss-${entryPoint}.v1`,
          label: `ulg-solid-fluid-contact-ss-${entryPoint}`, code: schroederSolidFluidContactSsWgsl, entryPoint, bindings: ssBindings })]));
    }
    return ssPipelines;
  }
  const counters = device.createBuffer({ label: 'ulg-solid-fluid-contact-counters',
    size: (bodyCount * 6 * COUNTER_WORDS_PER_ROW + 4) * 4, usage: GPU_BUFFER_USAGE.STORAGE });
  const ledgerBuffer = device.createBuffer({ label: 'ulg-solid-fluid-contact-ledger', size: 16,
    usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_SRC | GPU_BUFFER_USAGE.COPY_DST });
  let spatialGrid = null;
  function ensureSpatialGrid() {
    if (!spatialGrid) {
      spatialGrid = device.createBuffer({ label: 'ulg-solid-fluid-contact-grid',
        size: (GRID_BUCKETS + Math.max(1, memberCount) + 1) * 4, usage: GPU_BUFFER_USAGE.STORAGE });
    }
    return spatialGrid;
  }
  let fluidDv = null;
  let fluidDvCapacity = 0;
  function ensureFluidDv(count) {
    const needed = Math.max(64, count);
    if (fluidDv && fluidDvCapacity >= needed) return fluidDv;
    fluidDv?.destroy();
    fluidDvCapacity = needed;
    fluidDv = device.createBuffer({
      label: 'ulg-solid-fluid-contact-ss-dv',
      size: needed * 3 * 4,
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
    prepare(dtSeconds, { particleCount = 0, sharedSpatialGrid = null, sharedGridSlopM = 0,
      fluidDirectoryBuffer = null, fluidBaseGridSpacingM = 0, fluidChartId = 0, fluidMinLevel = 0, fluidMaxLevel = 0 } = {}) {
      if (!(particleCount > 0) || !(dtSeconds > 0)) return false;
      const useSs = Boolean(fluidDirectoryBuffer && Number(fluidBaseGridSpacingM) > 0);
      if (useSs) ensureFluidDv(particleCount);
      u.set([memberCount, particleCount, bodyCount, sharedSpatialGrid ? 1 : 0], 0);
      f[8] = dtSeconds;
      f[9] = sharedSpatialGrid ? Number(sharedGridSlopM) || 0 : 0;
      f.set([Number(fluidBaseGridSpacingM) || 0, Number(fluidChartId) || 0, Number(fluidMinLevel) || 0, Number(fluidMaxLevel) || 0], 12);
      device.queue.writeBuffer(params, 0, words);
      return true;
    },
    encode(encoder, dtSeconds, { fluidStateBuffer, fluidThermoBuffer, particleCount,
      sharedSpatialGrid = null, sharedGridSlopM = 0, fluidDirectoryBuffer = null, fluidBaseGridSpacingM = 0,
      fluidChartId = 0, fluidMinLevel = 0, fluidMaxLevel = 0, pass: sharedPass = null, prepared = false }) {
      if (!(particleCount > 0) || !(dtSeconds > 0)) return false;
      const useSs = Boolean(fluidDirectoryBuffer && Number(fluidBaseGridSpacingM) > 0);
      const useShared = Boolean(sharedSpatialGrid) && !useSs;
      if (!prepared) {
        if (useSs) ensureFluidDv(particleCount);
        u.set([memberCount, particleCount, bodyCount, useShared ? 1 : 0], 0);
        f[8] = dtSeconds;
        f[9] = useShared ? Number(sharedGridSlopM) || 0 : 0;
        f.set([Number(fluidBaseGridSpacingM) || 0, Number(fluidChartId) || 0, Number(fluidMinLevel) || 0, Number(fluidMaxLevel) || 0], 12);
        device.queue.writeBuffer(params, 0, words);
      }
      if (useSs) {
        const sp = getSsPipelines();
        const dvBuf = ensureFluidDv(particleCount);
        const group = createCachedExplicitBindGroup(device, {
          label: 'ulg-solid-fluid-contact-ss-bg',
          layout: sp.contact_members_ss.bindGroupLayout,
          entries: [params, memberWorldBuffer, memberBuffer, frameBuffer, fluidStateBuffer, fluidThermoBuffer, counters,
            ledgerBuffer, fluidDirectoryBuffer, dvBuf].map((buffer, binding) => ({ binding, resource: { buffer } }))
        });
        const pass = sharedPass ?? encoder.beginComputePass({ label: 'ulg-solid-fluid-contact-ss' });
        pass.setBindGroup(0, group);
        for (const [entryPoint, count] of [
          ['reset_ledger_ss', Math.max(1, particleCount)],
          ['contact_members_ss', memberCount],
          ['apply_fluid_dv_ss', particleCount],
          ['apply_impulses', bodyCount]
        ]) {
          pass.setPipeline(sp[entryPoint].pipeline);
          pass.dispatchWorkgroups(Math.ceil(count / 64));
        }
        if (!sharedPass) pass.end();
        return true;
      }
      const activeGrid = useShared ? sharedSpatialGrid : ensureSpatialGrid();
      const group = createCachedExplicitBindGroup(device, {
        label: 'ulg-solid-fluid-contact-bg',
        layout: pipelines.contact_particles.bindGroupLayout,
        entries: [params, memberWorldBuffer, memberBuffer, frameBuffer, fluidStateBuffer, fluidThermoBuffer, counters,
          ledgerBuffer, activeGrid].map((buffer, binding) => ({ binding, resource: { buffer } }))
      });
      const pass = sharedPass ?? encoder.beginComputePass({ label: 'ulg-solid-fluid-contact' });
      pass.setBindGroup(0, group);
      const stages = useShared
        ? [
            ['reset_ledger', 1],
            ['contact_particles', particleCount],
            ['apply_impulses', bodyCount]
          ]
        : [
            ['reset_ledger', GRID_BUCKETS],
            ['measure_fluid_radius', particleCount],
            ['bin_members', memberCount],
            ['contact_particles', particleCount],
            ['apply_impulses', bodyCount]
          ];
      for (const [entryPoint, count] of stages) {
        pass.setPipeline(pipelines[entryPoint].pipeline);
        pass.dispatchWorkgroups(Math.ceil(count / 64));
      }
      if (!sharedPass) pass.end();
      return true;
    },
    destroy() {
      fluidDv?.destroy();
      spatialGrid?.destroy();
      for (const b of [counters, ledgerBuffer, params]) b.destroy();
    }
  });
}
