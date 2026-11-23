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

/** The contact stage over the rigid family's buffers and the fluid lane's state. */
export function createSchroederSolidFluidContactStage({ device, memberCount, bodyCount, memberBuffer, memberWorldBuffer,
  frameBuffer, memberRadiusM, law = SCHROEDER_SOLID_FLUID_CONTACT_LAW } = {}) {
  const bindings = ['uniform', 'read-only-storage', 'read-only-storage', 'storage', 'storage', 'read-only-storage',
    'storage', 'storage', 'storage'].map((type, binding) => computeBufferBinding(binding, type));
  const pipelines = Object.fromEntries(['reset_ledger', 'measure_fluid_radius', 'bin_members', 'contact_particles',
    'apply_impulses'].map((entryPoint) =>
    [entryPoint, createCachedExplicitComputePipeline(device, { cacheKey: `ulg-solid-fluid-contact-${entryPoint}.v2`,
      label: `ulg-solid-fluid-contact-${entryPoint}`, code: schroederSolidFluidContactWgsl, entryPoint, bindings })]));
  const counters = device.createBuffer({ label: 'ulg-solid-fluid-contact-counters',
    size: (bodyCount * 6 * COUNTER_WORDS_PER_ROW + 4) * 4, usage: GPU_BUFFER_USAGE.STORAGE });
  const ledgerBuffer = device.createBuffer({ label: 'ulg-solid-fluid-contact-ledger', size: 16,
    usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_SRC | GPU_BUFFER_USAGE.COPY_DST });
  const spatialGrid = device.createBuffer({ label: 'ulg-solid-fluid-contact-grid',
    size: (GRID_BUCKETS + Math.max(1, memberCount) + 1) * 4, usage: GPU_BUFFER_USAGE.STORAGE });
  const params = device.createBuffer({ label: 'ulg-solid-fluid-contact-params', size: 48,
    usage: GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST });
  const words = new ArrayBuffer(48), u = new Uint32Array(words), f = new Float32Array(words);
  f.set([memberRadiusM, law.slopM, law.baumgarte, law.maxBiasSpeedMPerS], 4);
  return Object.freeze({
    ledgerBuffer,
    prepare(dtSeconds, { particleCount = 0, sharedSpatialGrid = null, sharedGridSlopM = 0 } = {}) {
      if (!(particleCount > 0) || !(dtSeconds > 0)) return false;
      u.set([memberCount, particleCount, bodyCount, sharedSpatialGrid ? 1 : 0], 0);
      f[8] = dtSeconds;
      f[9] = sharedSpatialGrid ? Number(sharedGridSlopM) || 0 : 0;
      device.queue.writeBuffer(params, 0, words);
      return true;
    },
    encode(encoder, dtSeconds, { fluidStateBuffer, fluidThermoBuffer, particleCount,
      sharedSpatialGrid = null, sharedGridSlopM = 0, pass: sharedPass = null, prepared = false }) {
      if (!(particleCount > 0) || !(dtSeconds > 0)) return false;
      const useShared = Boolean(sharedSpatialGrid);
      if (!prepared) {
        u.set([memberCount, particleCount, bodyCount, useShared ? 1 : 0], 0);
        f[8] = dtSeconds;
        f[9] = useShared ? Number(sharedGridSlopM) || 0 : 0;
        device.queue.writeBuffer(params, 0, words);
      }
      const activeGrid = useShared ? sharedSpatialGrid : spatialGrid;
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
    destroy() { for (const b of [counters, ledgerBuffer, spatialGrid, params]) b.destroy(); }
  });
}
