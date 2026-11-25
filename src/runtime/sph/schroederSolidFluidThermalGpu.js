import { computeBufferBinding, createCachedExplicitBindGroup, createCachedExplicitComputePipeline } from '../webgpuComputeLayout.js';
import { createSphExactMassWgsl } from './sphExactMassWgsl.js';
import { createSphExactLedgerWgsl } from './sphExactLedgerWgsl.js';
import { SPH_EXACT_THERMAL_ENERGY_FORMAT } from './sphExactThermalEnergyWgsl.js';
import { LAW_FALLBACK_POLICIES, LAW_SPATIAL_AUTHORITIES } from './lawAdapterContract.js';

// A5 SOL-3, thermal half (plan/todo/a5-solid-fluid-coupling.md): heat
// exchange between rigid-body members and SPH particles (f32 and G2 exact
// integer energy-ledger routes) over the canonical Schroeder Simulation (SS)
// fluid spatial directory (`SCHROEDER_SPATIAL_EPOCH_DIRECTORY_ABI`), with
// exact direct-pair fallback (`LAW_FALLBACK_POLICIES.DIRECT_PAIR`) for
// standalone unit fixtures without an SS epoch. Zero private spatial grids.
const FORMAT = SPH_EXACT_THERMAL_ENERGY_FORMAT;
const GPU_BUFFER_USAGE = Object.freeze({ STORAGE: 0x80, UNIFORM: 0x40, COPY_SRC: 0x04, COPY_DST: 0x08 });
export const SCHROEDER_SOLID_FLUID_THERMAL_LIMIT = 0.125;
export const SCHROEDER_SOLID_FLUID_THERMAL_QUANTUM_J = 1e-9;
export const SCHROEDER_SOLID_FLUID_THERMAL_SPATIAL_AUTHORITY = LAW_SPATIAL_AUTHORITIES.CANONICAL_SS_EPOCH;
export const SCHROEDER_SOLID_FLUID_THERMAL_FALLBACK_POLICY = LAW_FALLBACK_POLICIES.DIRECT_PAIR;

// Canonical SS fluid-directory solid-fluid thermal coupling: 1 thread per alive
// rigid member queries the already-built SCHROEDER_SPATIAL_EPOCH_DIRECTORY_ABI
// fluid directory (or evaluates bounded direct pairs when ss_geom.x <= 0 in
// standalone fixtures). Zero private spatial hash allocations or binning passes.
export const schroederSolidFluidThermalSsWgsl = /* wgsl */ `
${createSphExactMassWgsl(FORMAT)}
${createSphExactLedgerWgsl(FORMAT)}
struct CouplingParams {
  counts: vec4<u32>,
  solid: vec4<f32>,
  liquid: vec4<f32>,
  melt: vec4<f32>,
  geom: vec4<f32>,
  ss_geom: vec4<f32>,
};
@group(0) @binding(0) var<uniform> params: CouplingParams;
@group(0) @binding(1) var<storage, read> member_world: array<vec4<f32>>;
@group(0) @binding(2) var<storage, read> members: array<vec4<f32>>;
@group(0) @binding(3) var<storage, read_write> member_thermo: array<vec4<f32>>;
@group(0) @binding(4) var<storage, read_write> fluid_state: array<vec4<f32>>;
@group(0) @binding(5) var<storage, read> fluid_thermo: array<vec4<f32>>;
@group(0) @binding(6) var<storage, read> fluid_table: array<vec4<f32>>;
// Per-fluid-particle quantized heat accumulator (net quanta leaving fluid -> solid)
@group(0) @binding(7) var<storage, read_write> fluid_heat: array<atomic<i32>>;
@group(0) @binding(8) var<storage, read_write> coupling_ledger: array<atomic<i32>>;
// Canonical SS fluid directory (SCHROEDER_SPATIAL_EPOCH_DIRECTORY_ABI)
@group(0) @binding(9) var<storage, read> fluid_directory: array<u32>;
@group(0) @binding(10) var<storage, read_write> exact_energy_rows: array<atomic<u32>>;

const PI: f32 = 3.14159265;
const Q_MAX: f32 = 1.0e9;
const SS_DIR_MAGIC: u32 = 0x53534531u;

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

fn couple_member_with_fluid_particle(
  j: u32,
  x_m: vec3<f32>,
  state_y: f32,
  k_m: f32,
  inv_c_m: f32,
  a: f32,
  dt: f32,
  quantum: f32
) -> vec2<i32> {
  if (j >= params.counts.y || j >= arrayLength(&fluid_heat)) { return vec2<i32>(0, 0); }
  let p = fluid_state[j * 2u];
  if (!(p.w > 0.0)) { return vec2<i32>(0, 0); }
  let row0 = fluid_thermo[j * 3u];
  let props = fluid_properties(row0.x, row0.y);
  let k_p = props.x;
  if (!(k_p > 0.0) || !(props.y > 0.0)) { return vec2<i32>(0, 0); }
  let radius = effective_fluid_radius(j);
  let d = length(p.xyz - x_m);
  if (d > a + radius + params.geom.y) { return vec2<i32>(0, 0); }
  let inv_c_p = 1.0 / (p.w * props.y);
  let area = min(4.0 * a * a, PI * radius * radius);
  let k_h = 2.0 * k_m * k_p / (k_m + k_p);
  let length_m = max(d, 0.25 * (a + radius));
  let delta_t = row0.z - state_y;
  var q = k_h * area * delta_t * dt / length_m;
  let equalize = delta_t / (inv_c_m + inv_c_p);
  q = clamp(q, -abs(params.geom.w * equalize), abs(params.geom.w * equalize));
  let quanta_f = clamp(round(q / quantum), -Q_MAX, Q_MAX);
  if (abs(round(q / quantum)) > Q_MAX) { atomicOr(&coupling_ledger[2], 1); }
  let quanta = i32(quanta_f);
  if (quanta != 0) {
    atomicAdd(&fluid_heat[j], quanta);
    return vec2<i32>(quanta, 1);
  }
  return vec2<i32>(0, 0);
}

@compute @workgroup_size(64)
fn reset_ledger_ss(@builtin(global_invocation_id) id: vec3<u32>) {
  if (id.x < params.counts.y && id.x < arrayLength(&fluid_heat)) {
    atomicStore(&fluid_heat[id.x], 0);
  }
  if (id.x == 0u) {
    atomicStore(&coupling_ledger[0], 0);
    atomicStore(&coupling_ledger[1], 0);
    atomicStore(&coupling_ledger[3], 0);
  }
}

@compute @workgroup_size(64)
fn couple_members_ss(@builtin(global_invocation_id) id: vec3<u32>) {
  let i = id.x;
  if (i >= params.counts.x) { return; }
  let state = member_thermo[i];
  let mass_m = members[i * 2u].w;
  if (state.w == 0.0 || !(mass_m > 0.0)) { return; }
  let k_m = mix(params.melt.y, params.melt.z, clamp(state.z, 0.0, 1.0));
  if (!(k_m > 0.0)) { return; }
  let x_m = member_world[i * 2u].xyz;
  let a = params.geom.x;
  let dt = params.melt.w;
  let quantum = params.geom.z;
  var inv_c_m = 0.0;
  if (state.z <= 0.0) { inv_c_m = 1.0 / (mass_m * params.solid.z); }
  else if (state.z >= 1.0) { inv_c_m = 1.0 / (mass_m * params.liquid.z); }

  let base_spacing = params.ss_geom.x;
  var net_quanta = 0;
  var pairs = 0;

  if (base_spacing > 0.0) {
    if (!ss_dir_valid()) { return; }
    let cell_count = fluid_directory[18u];
    let keys_off = fluid_directory[29u];
    let offsets_off = fluid_directory[30u];
    let members_off = fluid_directory[31u];
    let chart_id = u32(max(0.0, floor(params.ss_geom.y + 0.5)));
    let min_level = i32(round(params.ss_geom.z));
    let max_level = i32(round(params.ss_geom.w));
    let max_reach = 4.0 * a + params.geom.y;
    for (var level = min_level; level <= max_level; level = level + 1i) {
      let spacing = base_spacing * exp2(f32(level));
      if (!(spacing > 0.0)) { continue; }
      let level_key = bitcast<u32>(level) ^ 0x80000000u;
      let halo_needed = i32(ceil(max_reach / spacing));
      let halo_r = clamp(halo_needed, 1i, 8i);
      if (halo_needed > 8i) { atomicOr(&coupling_ledger[2], 4); }
      let base_cell = vec3<i32>(floor(x_m / spacing));
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
            for (var m = begin; m < end; m = m + 1u) {
              let j = fluid_directory[members_off + m];
              let res = couple_member_with_fluid_particle(j, x_m, state.y, k_m, inv_c_m, a, dt, quantum);
              net_quanta += res.x;
              pairs += res.y;
            }
          }
        }
      }
    }
  } else {
    // Bounded direct-pair fallback (LAW_FALLBACK_POLICIES.DIRECT_PAIR) for standalone unit tests.
    for (var j = 0u; j < params.counts.y; j = j + 1u) {
      let res = couple_member_with_fluid_particle(j, x_m, state.y, k_m, inv_c_m, a, dt, quantum);
      net_quanta += res.x;
      pairs += res.y;
    }
  }

  if (pairs == 0) { return; }
  let u = state.x + f32(net_quanta) * quantum / mass_m;
  let c = caloric(u);
  member_thermo[i] = vec4<f32>(u, c.x, c.y, state.w);
  atomicAdd(&coupling_ledger[0], net_quanta);
  atomicAdd(&coupling_ledger[1], pairs);
}

@compute @workgroup_size(64)
fn apply_fluid_heat_ss(@builtin(global_invocation_id) id: vec3<u32>) {
  let j = id.x;
  if (j >= params.counts.y || j >= arrayLength(&fluid_heat)) { return; }
  let net_quanta = atomicExchange(&fluid_heat[j], 0);
  if (net_quanta == 0) { return; }
  let p = fluid_state[j * 2u];
  if (!(p.w > 0.0)) { return; }
  let v = fluid_state[j * 2u + 1u];
  let delta_e_fluid = -f32(net_quanta) * params.geom.z;
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
}
`;

export const schroederSolidFluidThermalWgsl = schroederSolidFluidThermalSsWgsl;

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
 * Canonical SS solid-fluid thermal coupling stage (zero private spatial hash).
 */
export function createSchroederSolidFluidThermalStage({ device, memberCount, memberBuffer, memberWorldBuffer,
  fluidTable, solidBranch, liquidBranch, meltTemperatureK, solidConductivity, liquidConductivity, halfPitchM,
  slopM = 5e-4, quantumJ = SCHROEDER_SOLID_FLUID_THERMAL_QUANTUM_J, limit = SCHROEDER_SOLID_FLUID_THERMAL_LIMIT } = {}) {
  const ssBindings = ['uniform', 'read-only-storage', 'read-only-storage', 'storage', 'storage', 'read-only-storage',
    'read-only-storage', 'storage', 'storage', 'read-only-storage', 'storage'].map((type, binding) => computeBufferBinding(binding, type));
  const ssPipelines = Object.fromEntries(['reset_ledger_ss', 'couple_members_ss', 'apply_fluid_heat_ss'].map((entryPoint) =>
    [entryPoint, createCachedExplicitComputePipeline(device, { cacheKey: `ulg-solid-fluid-thermal-ss-${entryPoint}.v2`,
      label: `ulg-solid-fluid-thermal-ss-${entryPoint}`, code: schroederSolidFluidThermalSsWgsl, entryPoint, bindings: ssBindings })]));
  const tableBuffer = device.createBuffer({ label: 'ulg-solid-fluid-thermal-table', size: Math.max(16, fluidTable.byteLength),
    usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_DST });
  device.queue.writeBuffer(tableBuffer, 0, fluidTable);
  let fluidHeat = null;
  let fluidHeatCapacity = 0;
  function ensureFluidHeat(count) {
    const needed = Math.max(64, count);
    if (fluidHeat && fluidHeatCapacity >= needed) return fluidHeat;
    fluidHeat?.destroy();
    fluidHeatCapacity = needed;
    fluidHeat = device.createBuffer({
      label: 'ulg-solid-fluid-ss-heat',
      size: needed * 4,
      usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_DST
    });
    return fluidHeat;
  }
  const ledgerBuffer = device.createBuffer({ label: 'ulg-solid-fluid-thermal-ledger', size: 16,
    usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_SRC | GPU_BUFFER_USAGE.COPY_DST });
  const fluidDirectoryPlaceholder = device.createBuffer({ label: 'ulg-solid-fluid-thermal-dir-placeholder',
    size: 16, usage: GPU_BUFFER_USAGE.STORAGE });
  const exactEnergyPlaceholder = device.createBuffer({ label: 'ulg-solid-fluid-thermal-exact-placeholder',
    size: 16, usage: GPU_BUFFER_USAGE.STORAGE });
  const params = device.createBuffer({ label: 'ulg-solid-fluid-thermal-params', size: 96,
    usage: GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST });
  const words = new ArrayBuffer(96), u = new Uint32Array(words), f = new Float32Array(words);
  f.set([solidBranch.referenceTemperatureK, solidBranch.referenceInternalEnergyJPerKg, solidBranch.cvJPerKgK,
    solidBranch.energyMaxJPerKg], 4);
  f.set([liquidBranch.referenceTemperatureK, liquidBranch.referenceInternalEnergyJPerKg, liquidBranch.cvJPerKgK,
    liquidBranch.energyMinJPerKg], 8);
  f.set([meltTemperatureK, solidConductivity, liquidConductivity, 0], 12);
  f.set([halfPitchM, slopM, quantumJ, limit], 16);
  return Object.freeze({
    ledgerBuffer, quantumJ, slopM,
    spatialAuthority: SCHROEDER_SOLID_FLUID_THERMAL_SPATIAL_AUTHORITY,
    prepare(encoder, dtSeconds, { particleCount = 0, exactEnergyBuffer = null, exactEnergyRowCount = 0,
      fluidDirectoryBuffer = null, fluidBaseGridSpacingM = 0, fluidChartId = 0, fluidMinLevel = 0, fluidMaxLevel = 0 } = {}) {
      if (!(particleCount > 0)) return false;
      ensureFluidHeat(particleCount);
      const useSs = Boolean(fluidDirectoryBuffer && Number(fluidBaseGridSpacingM) > 0);
      const ledgerRows = exactEnergyBuffer && exactEnergyRowCount > 0 ? exactEnergyRowCount : 0;
      u.set([memberCount, particleCount, fluidTable.length / 4, ledgerRows], 0);
      f[15] = dtSeconds;
      f.set([useSs ? Number(fluidBaseGridSpacingM) : 0, Number(fluidChartId) || 0, Number(fluidMinLevel) || 0, Number(fluidMaxLevel) || 0], 20);
      device.queue.writeBuffer(params, 0, words);
      return true;
    },
    encode(encoder, dtSeconds, { memberThermoBuffer, fluidStateBuffer, fluidThermoBuffer, particleCount,
      exactEnergyBuffer = null, exactEnergyRowCount = 0, fluidDirectoryBuffer = null, fluidBaseGridSpacingM = 0,
      fluidChartId = 0, fluidMinLevel = 0, fluidMaxLevel = 0, pass: sharedPass = null, prepared = false }) {
      if (!(particleCount > 0)) return false;
      const useSs = Boolean(fluidDirectoryBuffer && Number(fluidBaseGridSpacingM) > 0);
      const ledgerRows = exactEnergyBuffer && exactEnergyRowCount > 0 ? exactEnergyRowCount : 0;
      const boundExactEnergy = ledgerRows > 0 ? exactEnergyBuffer : exactEnergyPlaceholder;
      const boundFluidDir = useSs ? fluidDirectoryBuffer : fluidDirectoryPlaceholder;
      const fh = ensureFluidHeat(particleCount);
      if (!prepared) {
        u.set([memberCount, particleCount, fluidTable.length / 4, ledgerRows], 0);
        f[15] = dtSeconds;
        f.set([useSs ? Number(fluidBaseGridSpacingM) : 0, Number(fluidChartId) || 0, Number(fluidMinLevel) || 0, Number(fluidMaxLevel) || 0], 20);
        device.queue.writeBuffer(params, 0, words);
      }
      const group = createCachedExplicitBindGroup(device, {
        label: 'ulg-solid-fluid-thermal-ss-bg',
        layout: ssPipelines.couple_members_ss.bindGroupLayout,
        entries: [params, memberWorldBuffer, memberBuffer, memberThermoBuffer, fluidStateBuffer, fluidThermoBuffer,
          tableBuffer, fh, ledgerBuffer, boundFluidDir, boundExactEnergy]
          .map((buffer, binding) => ({ binding, resource: { buffer } }))
      });
      const pass = sharedPass ?? encoder.beginComputePass({ label: 'ulg-solid-fluid-thermal-ss' });
      pass.setBindGroup(0, group);
      for (const [entryPoint, count] of [
        ['reset_ledger_ss', Math.max(1, particleCount)],
        ['couple_members_ss', memberCount],
        ['apply_fluid_heat_ss', particleCount]
      ]) {
        pass.setPipeline(ssPipelines[entryPoint].pipeline);
        pass.dispatchWorkgroups(Math.ceil(count / 64));
      }
      if (!sharedPass) pass.end();
      return true;
    },
    destroy() {
      fluidHeat?.destroy();
      for (const b of [tableBuffer, ledgerBuffer, fluidDirectoryPlaceholder, exactEnergyPlaceholder, params]) b.destroy();
    }
  });
}
