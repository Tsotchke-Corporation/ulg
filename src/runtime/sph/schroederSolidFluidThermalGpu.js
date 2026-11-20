import { computeBufferBinding, createCachedExplicitComputePipeline } from '../webgpuComputeLayout.js';

// A5 SOL-3, thermal half (plan/todo/a5-solid-fluid-coupling.md): heat
// exchange between rigid-body members and SPH particles (f32 route).
//
// Pair law, for a member (cube, half pitch a) and a particle (radius r) whose
// centres are within a + r + slop:
//   Q = k_h A (T_p - T_m) dt / L,  k_h = 2 k_m k_p / (k_m + k_p),
//   A = min((2a)^2, pi r^2),        L = max(|x_m - x_p|, (a + r) / 4),
// the same series-conductance form as member-member conduction. Each pair is
// limited to LIMIT of the energy that would equalize the two temperatures
// (C = m c of each side; a member on its melt plateau has unbounded C).
//
// Exactness: Q is quantized once to an integer number of quanta q (i32). The
// member adds q and the particle subtracts the same q through an i32 atomic,
// so the exchanged energy is exactly antisymmetric in quanta; the f32 u
// updates on both sides are the only rounding. The per-step net quanta into
// the solid and the contact pair count are recorded for the energy budget.
//
// Neighbour search is brute force over all particles (members x particles per
// step): bounded and correct; a binned search belongs to A1.
const GPU_BUFFER_USAGE = Object.freeze({ STORAGE: 0x80, UNIFORM: 0x40, COPY_SRC: 0x04, COPY_DST: 0x08 });
export const SCHROEDER_SOLID_FLUID_THERMAL_LIMIT = 0.125;
export const SCHROEDER_SOLID_FLUID_THERMAL_QUANTUM_J = 1e-9;

export const schroederSolidFluidThermalWgsl = /* wgsl */ `
struct CouplingParams {
  // member count, particle count, fluid table rows, unused
  counts: vec4<u32>,
  // member solid branch: reference T, reference u, cv, energy max (plateau start)
  solid: vec4<f32>,
  // member liquid branch: reference T, reference u, cv, energy min (plateau end)
  liquid: vec4<f32>,
  // melt temperature, solid conductivity, liquid conductivity, dt
  melt: vec4<f32>,
  // member half pitch, contact slop, energy quantum (J), pair limit fraction
  geom: vec4<f32>,
};
@group(0) @binding(0) var<uniform> params: CouplingParams;
@group(0) @binding(1) var<storage, read> member_world: array<vec4<f32>>;
@group(0) @binding(2) var<storage, read> members: array<vec4<f32>>;
@group(0) @binding(3) var<storage, read_write> member_thermo: array<vec4<f32>>;
@group(0) @binding(4) var<storage, read_write> fluid_state: array<vec4<f32>>;
@group(0) @binding(5) var<storage, read> fluid_thermo: array<vec4<f32>>;
// Fluid conductivity/heat capacity rows: [material id, GPU phase id, k (W/m/K), c (J/kg/K)].
@group(0) @binding(6) var<storage, read> fluid_table: array<vec4<f32>>;
@group(0) @binding(7) var<storage, read_write> particle_heat: array<atomic<i32>>;
// [net quanta into the solid this step, contact pairs this step, overflow flags, unused]
@group(0) @binding(8) var<storage, read_write> coupling_ledger: array<atomic<i32>>;

const PI: f32 = 3.14159265;
const Q_MAX: f32 = 1.0e9;

fn caloric(u: f32) -> vec2<f32> {
  if (u <= params.solid.w) { return vec2<f32>(params.solid.x + (u - params.solid.y) / params.solid.z, 0.0); }
  if (u < params.liquid.w) {
    return vec2<f32>(params.melt.x, (u - params.solid.w) / (params.liquid.w - params.solid.w));
  }
  return vec2<f32>(params.liquid.x + (u - params.liquid.y) / params.liquid.z, 1.0);
}

fn fluid_properties(material: f32, phase: f32) -> vec2<f32> {
  for (var r = 0u; r < params.counts.z; r++) {
    let row = fluid_table[r];
    if (row.x == material && row.y == phase) { return row.zw; }
  }
  return vec2<f32>(0.0, 0.0);
}

@compute @workgroup_size(64)
fn couple_members(@builtin(global_invocation_id) id: vec3<u32>) {
  let i = id.x;
  if (i >= params.counts.x) { return; }
  let state = member_thermo[i];
  let mass_m = members[i * 2u].w;
  if (state.w == 0.0 || !(mass_m > 0.0)) { return; }
  let x_m = member_world[i * 2u].xyz;
  let a = params.geom.x;
  let k_m = mix(params.melt.y, params.melt.z, clamp(state.z, 0.0, 1.0));
  // Inverse heat capacity of the member: zero on the plateau (latent heat absorbs).
  var inv_c_m = 0.0;
  if (state.z <= 0.0) { inv_c_m = 1.0 / (mass_m * params.solid.z); }
  else if (state.z >= 1.0) { inv_c_m = 1.0 / (mass_m * params.liquid.z); }
  let dt = params.melt.w;
  let quantum = params.geom.z;
  var net_quanta = 0;
  var pairs = 0;
  for (var j = 0u; j < params.counts.y; j++) {
    let p = fluid_state[j * 2u];
    if (!(p.w > 0.0)) { continue; }
    let row0 = fluid_thermo[j * 3u];
    let radius = fluid_thermo[j * 3u + 2u].w;
    let d = length(p.xyz - x_m);
    if (!(d <= a + radius + params.geom.y)) { continue; }
    let props = fluid_properties(row0.x, row0.y);
    let k_p = props.x;
    if (!(k_p > 0.0) || !(k_m > 0.0) || !(props.y > 0.0)) { continue; }
    let k_h = 2.0 * k_m * k_p / (k_m + k_p);
    let area = min(4.0 * a * a, PI * radius * radius);
    let length_m = max(d, 0.25 * (a + radius));
    let delta_t = row0.z - state.y;
    var q = k_h * area * delta_t * dt / length_m;
    // Pair limiter: at most LIMIT of the equalizing energy.
    let equalize = delta_t / (inv_c_m + 1.0 / (p.w * props.y));
    q = clamp(q, -abs(params.geom.w * equalize), abs(params.geom.w * equalize));
    let quanta_f = clamp(round(q / quantum), -Q_MAX, Q_MAX);
    if (abs(round(q / quantum)) > Q_MAX) { atomicOr(&coupling_ledger[2], 1); }
    let quanta = i32(quanta_f);
    if (quanta == 0) { continue; }
    net_quanta += quanta;
    pairs += 1;
    atomicSub(&particle_heat[j], quanta);
  }
  if (pairs == 0) { return; }
  let u = state.x + f32(net_quanta) * quantum / mass_m;
  let c = caloric(u);
  member_thermo[i] = vec4<f32>(u, c.x, c.y, state.w);
  atomicAdd(&coupling_ledger[0], net_quanta);
  atomicAdd(&coupling_ledger[1], pairs);
}

@compute @workgroup_size(64)
fn apply_fluid_heat(@builtin(global_invocation_id) id: vec3<u32>) {
  let j = id.x;
  if (j >= params.counts.y) { return; }
  let quanta = atomicExchange(&particle_heat[j], 0);
  if (quanta == 0) { return; }
  let p = fluid_state[j * 2u];
  if (!(p.w > 0.0)) { return; }
  let v = fluid_state[j * 2u + 1u];
  fluid_state[j * 2u + 1u] = vec4<f32>(v.xyz, v.w + f32(quanta) * params.geom.z / p.w);
}

@compute @workgroup_size(4)
fn reset_ledger(@builtin(global_invocation_id) id: vec3<u32>) {
  if (id.x < 2u) { atomicStore(&coupling_ledger[id.x], 0); }
}
`;

/**
 * Fluid conductivity / heat-capacity rows for the materials in a scene:
 * [{ materialId, phaseId, conductivityWPerMK, heatCapacityJPerKgK }].
 */
export function packSchroederSolidFluidTable(rows) {
  const table = new Float32Array(Math.max(1, rows.length) * 4);
  rows.forEach((row, r) => table.set([row.materialId, row.phaseId, row.conductivityWPerMK, row.heatCapacityJPerKgK], r * 4));
  return table;
}

/**
 * The coupling stage over the member thermal stage's buffers and the fluid
 * lane's state/thermo buffers. `encode` runs after the member conduction.
 */
export function createSchroederSolidFluidThermalStage({ device, memberCount, memberBuffer, memberWorldBuffer,
  fluidTable, solidBranch, liquidBranch, meltTemperatureK, solidConductivity, liquidConductivity, halfPitchM,
  slopM = 5e-4, quantumJ = SCHROEDER_SOLID_FLUID_THERMAL_QUANTUM_J, limit = SCHROEDER_SOLID_FLUID_THERMAL_LIMIT } = {}) {
  const bindings = ['uniform', 'read-only-storage', 'read-only-storage', 'storage', 'storage', 'read-only-storage',
    'read-only-storage', 'storage', 'storage'].map((type, binding) => computeBufferBinding(binding, type));
  const pipelines = Object.fromEntries(['couple_members', 'apply_fluid_heat', 'reset_ledger'].map((entryPoint) =>
    [entryPoint, createCachedExplicitComputePipeline(device, { cacheKey: `ulg-solid-fluid-thermal-${entryPoint}.v0`,
      label: `ulg-solid-fluid-thermal-${entryPoint}`, code: schroederSolidFluidThermalWgsl, entryPoint, bindings })]));
  const tableBuffer = device.createBuffer({ label: 'ulg-solid-fluid-thermal-table', size: Math.max(16, fluidTable.byteLength),
    usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_DST });
  device.queue.writeBuffer(tableBuffer, 0, fluidTable);
  const ledgerBuffer = device.createBuffer({ label: 'ulg-solid-fluid-thermal-ledger', size: 16,
    usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_SRC | GPU_BUFFER_USAGE.COPY_DST });
  const params = device.createBuffer({ label: 'ulg-solid-fluid-thermal-params', size: 80,
    usage: GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST });
  const words = new ArrayBuffer(80), u = new Uint32Array(words), f = new Float32Array(words);
  f.set([solidBranch.referenceTemperatureK, solidBranch.referenceInternalEnergyJPerKg, solidBranch.cvJPerKgK,
    solidBranch.energyMaxJPerKg], 4);
  f.set([liquidBranch.referenceTemperatureK, liquidBranch.referenceInternalEnergyJPerKg, liquidBranch.cvJPerKgK,
    liquidBranch.energyMinJPerKg], 8);
  f.set([meltTemperatureK, solidConductivity, liquidConductivity, 0], 12);
  f.set([halfPitchM, slopM, quantumJ, limit], 16);
  let particleHeat = null, particleCapacity = 0;
  const groups = new Map();
  return Object.freeze({
    ledgerBuffer, quantumJ,
    encode(encoder, dtSeconds, { memberThermoBuffer, fluidStateBuffer, fluidThermoBuffer, particleCount }) {
      if (!(particleCount > 0)) return false;
      if (particleCount > particleCapacity) {
        particleHeat?.destroy(); groups.clear();
        particleCapacity = particleCount;
        particleHeat = device.createBuffer({ label: 'ulg-solid-fluid-particle-heat', size: particleCapacity * 4,
          usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_DST });
        encoder.clearBuffer(particleHeat);
      }
      u.set([memberCount, particleCount, fluidTable.length / 4, 0], 0);
      f[15] = dtSeconds;
      device.queue.writeBuffer(params, 0, words);
      const key = [memberThermoBuffer, fluidStateBuffer, fluidThermoBuffer];
      let group = [...groups.entries()].find(([k]) => k.every((b, n) => b === key[n]))?.[1];
      if (!group) {
        group = device.createBindGroup({ layout: pipelines.couple_members.bindGroupLayout,
          entries: [params, memberWorldBuffer, memberBuffer, memberThermoBuffer, fluidStateBuffer, fluidThermoBuffer,
            tableBuffer, particleHeat, ledgerBuffer].map((buffer, binding) => ({ binding, resource: { buffer } })) });
        if (groups.size > 8) groups.clear();
        groups.set(key, group);
      }
      for (const [entryPoint, count, size] of [['reset_ledger', 1, 4], ['couple_members', memberCount, 64],
        ['apply_fluid_heat', particleCount, 64]]) {
        const pass = encoder.beginComputePass({ label: `ulg-solid-fluid-thermal-${entryPoint}` });
        pass.setPipeline(pipelines[entryPoint].pipeline); pass.setBindGroup(0, group);
        pass.dispatchWorkgroups(Math.ceil(count / size)); pass.end();
      }
      return true;
    },
    destroy() { for (const b of [tableBuffer, ledgerBuffer, params, particleHeat]) b?.destroy(); }
  });
}
