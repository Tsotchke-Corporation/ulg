import { computeBufferBinding, createCachedExplicitComputePipeline } from '../webgpuComputeLayout.js';
import { createSphExactMassWgsl } from './sphExactMassWgsl.js';
import { createSphExactLedgerWgsl } from './sphExactLedgerWgsl.js';
import { SPH_EXACT_THERMAL_ENERGY_FORMAT } from './sphExactThermalEnergyWgsl.js';

// A5 SOL-3, thermal half (plan/todo/a5-solid-fluid-coupling.md): heat
// exchange between rigid-body members and SPH particles (f32 and G2 exact
// integer energy-ledger routes).
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
// member adds q through an i32 atomic and the particle subtracts the same q,
// so the exchanged energy is exactly antisymmetric in quanta; on the G2 exact
// energy-ledger route, the exact signed 2^-149 J packet is added to both U
// and S so sum(U - S) stays bit-invariant while u projects from U/m.
//
// Neighbour search uses a GPU-resident 4096-bucket 3D spatial cell hash over
// alive rigid members (O(N + M), zero host round-trips, bucket deduplication).
const FORMAT = SPH_EXACT_THERMAL_ENERGY_FORMAT;
const GRID_BUCKETS = 4096;
const GPU_BUFFER_USAGE = Object.freeze({ STORAGE: 0x80, UNIFORM: 0x40, COPY_SRC: 0x04, COPY_DST: 0x08 });
export const SCHROEDER_SOLID_FLUID_THERMAL_LIMIT = 0.125;
export const SCHROEDER_SOLID_FLUID_THERMAL_QUANTUM_J = 1e-9;

export const schroederSolidFluidThermalWgsl = /* wgsl */ `
${createSphExactMassWgsl(FORMAT)}
${createSphExactLedgerWgsl(FORMAT)}
struct CouplingParams {
  // member count, particle count, fluid table rows, exact energy ledger row count (0 = f32 only)
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
@group(0) @binding(7) var<storage, read_write> member_heat: array<atomic<i32>>;
// [net quanta into the solid this step, contact pairs this step, overflow flags, max fluid radius i32 bits]
@group(0) @binding(8) var<storage, read_write> coupling_ledger: array<atomic<i32>>;
// [cell_head[4096], member_next[memberCount]]
@group(0) @binding(9) var<storage, read_write> spatial_grid: array<atomic<u32>>;
// Optional G2 exact signed energy rows ([U rows][S rows][control]), active when params.counts.w > 0.
@group(0) @binding(10) var<storage, read_write> exact_energy_rows: array<atomic<u32>>;

const PI: f32 = 3.14159265;
const Q_MAX: f32 = 1.0e9;
const GRID_BUCKETS: u32 = ${GRID_BUCKETS}u;
const GRID_MASK: u32 = ${GRID_BUCKETS - 1}u;
const EMPTY_NODE: u32 = 0xffffffffu;

fn hash_cell(c: vec3<i32>) -> u32 {
  return ((bitcast<u32>(c.x) * 73856093u) ^ (bitcast<u32>(c.y) * 19349663u) ^ (bitcast<u32>(c.z) * 83492791u)) & GRID_MASK;
}

fn grid_cell_edge() -> f32 {
  let max_r = bitcast<f32>(atomicLoad(&coupling_ledger[3]));
  return max(max(2.0 * params.geom.x, params.geom.x + max_r + params.geom.y) * 1.01, 1.0e-5);
}

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

fn energy_row_load(word: u32) -> ExactMass {
  var value: ExactMass;
  for (var w = 0u; w < EM_WORDS; w++) { value.words[w] = atomicLoad(&exact_energy_rows[word + w]); }
  return value;
}

fn energy_row_store(word: u32, value: ExactMass) {
  for (var w = 0u; w < EM_WORDS; w++) { atomicStore(&exact_energy_rows[word + w], value.words[w]); }
}

@compute @workgroup_size(64)
fn reset_ledger(@builtin(global_invocation_id) id: vec3<u32>) {
  if (id.x < GRID_BUCKETS) { atomicStore(&spatial_grid[id.x], EMPTY_NODE); }
  if (id.x == 0u) {
    atomicStore(&coupling_ledger[0], 0);
    atomicStore(&coupling_ledger[1], 0);
    atomicStore(&coupling_ledger[3], 0);
  }
}

fn effective_fluid_radius(j: u32) -> f32 {
  let mass_kg = fluid_state[j * 2u].w;
  if (!(mass_kg > 0.0)) { return 0.0; }
  let row0 = fluid_thermo[j * 3u];
  var r = fluid_thermo[j * 3u + 2u].w;
  if (row0.y >= 2.5 && row0.w > 0.0) {
    let gas_r = pow(max(0.75 * mass_kg / (PI * row0.w), 0.0), 1.0 / 3.0);
    r = max(r, min(gas_r, 3.0 * params.geom.x));
  }
  return r;
}

@compute @workgroup_size(64)
fn measure_fluid_radius(@builtin(global_invocation_id) id: vec3<u32>) {
  let j = id.x;
  if (j >= params.counts.y) { return; }
  let r = effective_fluid_radius(j);
  if (r > 0.0) { atomicMax(&coupling_ledger[3], bitcast<i32>(r)); }
}

@compute @workgroup_size(64)
fn bin_members(@builtin(global_invocation_id) id: vec3<u32>) {
  let i = id.x;
  if (i >= params.counts.x) { return; }
  let state = member_thermo[i];
  let mass_m = members[i * 2u].w;
  if (state.w == 0.0 || !(mass_m > 0.0)) { return; }
  let x_m = member_world[i * 2u].xyz;
  let edge = grid_cell_edge();
  let bucket = hash_cell(vec3<i32>(floor(x_m / edge)));
  let prev = atomicExchange(&spatial_grid[bucket], i);
  atomicStore(&spatial_grid[GRID_BUCKETS + i], prev);
}

@compute @workgroup_size(64)
fn couple_particles(@builtin(global_invocation_id) id: vec3<u32>) {
  let j = id.x;
  if (j >= params.counts.y) { return; }
  let p = fluid_state[j * 2u];
  if (!(p.w > 0.0)) { return; }
  let row0 = fluid_thermo[j * 3u];
  let props = fluid_properties(row0.x, row0.y);
  let k_p = props.x;
  if (!(k_p > 0.0) || !(props.y > 0.0)) { return; }
  let radius = effective_fluid_radius(j);
  let a = params.geom.x;
  let dt = params.melt.w;
  let quantum = params.geom.z;
  let inv_c_p = 1.0 / (p.w * props.y);
  let area = min(4.0 * a * a, PI * radius * radius);
  let edge = grid_cell_edge();
  let base_cell = vec3<i32>(floor(p.xyz / edge));
  var seen: array<u32, 27>;
  var seen_count = 0u;
  var net_quanta = 0;
  var pairs = 0;
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
          let state = member_thermo[i];
          let mass_m = members[i * 2u].w;
          if (state.w != 0.0 && mass_m > 0.0) {
            let x_m = member_world[i * 2u].xyz;
            let d = length(p.xyz - x_m);
            if (d <= a + radius + params.geom.y) {
              let k_m = mix(params.melt.y, params.melt.z, clamp(state.z, 0.0, 1.0));
              if (k_m > 0.0) {
                var inv_c_m = 0.0;
                if (state.z <= 0.0) { inv_c_m = 1.0 / (mass_m * params.solid.z); }
                else if (state.z >= 1.0) { inv_c_m = 1.0 / (mass_m * params.liquid.z); }
                let k_h = 2.0 * k_m * k_p / (k_m + k_p);
                let length_m = max(d, 0.25 * (a + radius));
                let delta_t = row0.z - state.y;
                var q = k_h * area * delta_t * dt / length_m;
                let equalize = delta_t / (inv_c_m + inv_c_p);
                q = clamp(q, -abs(params.geom.w * equalize), abs(params.geom.w * equalize));
                let quanta_f = clamp(round(q / quantum), -Q_MAX, Q_MAX);
                if (abs(round(q / quantum)) > Q_MAX) { atomicOr(&coupling_ledger[2], 1); }
                let quanta = i32(quanta_f);
                if (quanta != 0) {
                  net_quanta += quanta;
                  pairs += 1;
                  atomicAdd(&member_heat[i], quanta);
                }
              }
            }
          }
          i = next_i;
        }
      }
    }
  }
  if (pairs == 0) { return; }
  let v = fluid_state[j * 2u + 1u];
  let delta_e_fluid = -f32(net_quanta) * quantum;
  if (params.counts.w > 0u && j < params.counts.w) {
    let pkt = el_from_f32_bits(bitcast<u32>(delta_e_fluid));
    let u_word = j * EM_WORDS;
    let s_word = params.counts.w * EM_WORDS + u_word;
    let next_u = el_add(energy_row_load(u_word), pkt.value);
    let next_s = el_add(energy_row_load(s_word), pkt.value);
    let proj = el_project_f32_bits(next_u.value);
    if ((pkt.error | next_u.error | next_s.error | proj.error) == 0u) {
      energy_row_store(u_word, next_u.value);
      energy_row_store(s_word, next_s.value);
      fluid_state[j * 2u + 1u] = vec4<f32>(v.xyz, bitcast<f32>(proj.bits) / p.w);
    } else {
      atomicOr(&coupling_ledger[2], 2);
      fluid_state[j * 2u + 1u] = vec4<f32>(v.xyz, v.w + delta_e_fluid / p.w);
    }
  } else {
    fluid_state[j * 2u + 1u] = vec4<f32>(v.xyz, v.w + delta_e_fluid / p.w);
  }
  atomicAdd(&coupling_ledger[0], net_quanta);
  atomicAdd(&coupling_ledger[1], pairs);
}

@compute @workgroup_size(64)
fn apply_member_heat(@builtin(global_invocation_id) id: vec3<u32>) {
  let i = id.x;
  if (i >= params.counts.x) { return; }
  let quanta = atomicExchange(&member_heat[i], 0);
  if (quanta == 0) { return; }
  let state = member_thermo[i];
  let mass_m = members[i * 2u].w;
  if (state.w == 0.0 || !(mass_m > 0.0)) { return; }
  let u = state.x + f32(quanta) * params.geom.z / mass_m;
  let c = caloric(u);
  member_thermo[i] = vec4<f32>(u, c.x, c.y, state.w);
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
    'read-only-storage', 'storage', 'storage', 'storage', 'storage'].map((type, binding) => computeBufferBinding(binding, type));
  const pipelines = Object.fromEntries(['reset_ledger', 'measure_fluid_radius', 'bin_members', 'couple_particles',
    'apply_member_heat'].map((entryPoint) =>
    [entryPoint, createCachedExplicitComputePipeline(device, { cacheKey: `ulg-solid-fluid-thermal-${entryPoint}.v1`,
      label: `ulg-solid-fluid-thermal-${entryPoint}`, code: schroederSolidFluidThermalWgsl, entryPoint, bindings })]));
  const tableBuffer = device.createBuffer({ label: 'ulg-solid-fluid-thermal-table', size: Math.max(16, fluidTable.byteLength),
    usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_DST });
  device.queue.writeBuffer(tableBuffer, 0, fluidTable);
  const memberHeat = device.createBuffer({ label: 'ulg-solid-fluid-member-heat', size: Math.max(1, memberCount) * 4,
    usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_DST });
  const ledgerBuffer = device.createBuffer({ label: 'ulg-solid-fluid-thermal-ledger', size: 16,
    usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_SRC | GPU_BUFFER_USAGE.COPY_DST });
  const spatialGrid = device.createBuffer({ label: 'ulg-solid-fluid-thermal-grid',
    size: (GRID_BUCKETS + Math.max(1, memberCount)) * 4, usage: GPU_BUFFER_USAGE.STORAGE });
  const exactEnergyPlaceholder = device.createBuffer({ label: 'ulg-solid-fluid-thermal-exact-placeholder',
    size: 16, usage: GPU_BUFFER_USAGE.STORAGE });
  const params = device.createBuffer({ label: 'ulg-solid-fluid-thermal-params', size: 80,
    usage: GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST });
  const words = new ArrayBuffer(80), u = new Uint32Array(words), f = new Float32Array(words);
  f.set([solidBranch.referenceTemperatureK, solidBranch.referenceInternalEnergyJPerKg, solidBranch.cvJPerKgK,
    solidBranch.energyMaxJPerKg], 4);
  f.set([liquidBranch.referenceTemperatureK, liquidBranch.referenceInternalEnergyJPerKg, liquidBranch.cvJPerKgK,
    liquidBranch.energyMinJPerKg], 8);
  f.set([meltTemperatureK, solidConductivity, liquidConductivity, 0], 12);
  f.set([halfPitchM, slopM, quantumJ, limit], 16);
  let memberHeatCleared = false;
  const groups = new Map();
  return Object.freeze({
    ledgerBuffer, quantumJ,
    prepare(encoder, dtSeconds, { particleCount = 0, exactEnergyBuffer = null, exactEnergyRowCount = 0 } = {}) {
      if (!(particleCount > 0)) return false;
      if (!memberHeatCleared) {
        encoder.clearBuffer(memberHeat);
        memberHeatCleared = true;
      }
      const ledgerRows = exactEnergyBuffer && exactEnergyRowCount > 0 ? exactEnergyRowCount : 0;
      u.set([memberCount, particleCount, fluidTable.length / 4, ledgerRows], 0);
      f[15] = dtSeconds;
      device.queue.writeBuffer(params, 0, words);
      return true;
    },
    encode(encoder, dtSeconds, { memberThermoBuffer, fluidStateBuffer, fluidThermoBuffer, particleCount,
      exactEnergyBuffer = null, exactEnergyRowCount = 0, pass: sharedPass = null, prepared = false }) {
      if (!(particleCount > 0)) return false;
      const ledgerRows = exactEnergyBuffer && exactEnergyRowCount > 0 ? exactEnergyRowCount : 0;
      const boundExactEnergy = ledgerRows > 0 ? exactEnergyBuffer : exactEnergyPlaceholder;
      if (!prepared) {
        if (!memberHeatCleared) {
          encoder.clearBuffer(memberHeat);
          memberHeatCleared = true;
        }
        u.set([memberCount, particleCount, fluidTable.length / 4, ledgerRows], 0);
        f[15] = dtSeconds;
        device.queue.writeBuffer(params, 0, words);
      }
      const key = [memberThermoBuffer, fluidStateBuffer, fluidThermoBuffer, boundExactEnergy];
      let group = [...groups.entries()].find(([k]) => k.every((b, n) => b === key[n]))?.[1];
      if (!group) {
        group = device.createBindGroup({ layout: pipelines.couple_particles.bindGroupLayout,
          entries: [params, memberWorldBuffer, memberBuffer, memberThermoBuffer, fluidStateBuffer, fluidThermoBuffer,
            tableBuffer, memberHeat, ledgerBuffer, spatialGrid, boundExactEnergy]
            .map((buffer, binding) => ({ binding, resource: { buffer } })) });
        if (groups.size > 8) groups.clear();
        groups.set(key, group);
      }
      const pass = sharedPass ?? encoder.beginComputePass({ label: 'ulg-solid-fluid-thermal' });
      pass.setBindGroup(0, group);
      for (const [entryPoint, count] of [
        ['reset_ledger', GRID_BUCKETS],
        ['measure_fluid_radius', particleCount],
        ['bin_members', memberCount],
        ['couple_particles', particleCount],
        ['apply_member_heat', memberCount]
      ]) {
        pass.setPipeline(pipelines[entryPoint].pipeline);
        pass.dispatchWorkgroups(Math.ceil(count / 64));
      }
      if (!sharedPass) pass.end();
      return true;
    },
    destroy() {
      for (const b of [tableBuffer, memberHeat, ledgerBuffer, spatialGrid, exactEnergyPlaceholder, params]) b.destroy();
    }
  });
}
