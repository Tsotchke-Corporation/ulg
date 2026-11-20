import { computeBufferBinding, createCachedExplicitComputePipeline } from '../webgpuComputeLayout.js';
import { createSphExactMassWgsl } from './sphExactMassWgsl.js';
import { createSphExactLedgerWgsl } from './sphExactLedgerWgsl.js';
import { SPH_EXACT_THERMAL_ENERGY_FORMAT } from './sphExactThermalEnergyWgsl.js';

// G3 Phase 4b (plan/todo/g3-solids-proposal.md): ownership transfer of a
// melted rigid-body member into the fluid lane. Each member owns one reserved
// dormant fluid row (mass 0, seeded as a liquid particle of the member's
// material). A release event activates it with the member's mass, specific
// internal energy, world position and rigid velocity v + omega x r; the
// mechanics row restarts undeformed (F = I, C = 0, J = 1) at the liquid rest
// volume m / rho_l, keeping the row's seeded constitutive fields; the thermo
// row becomes pure liquid at the member's temperature. Mass, energy and
// momentum leave the body exactly as they arrive in the row, and so do the
// represented molecules: entities = mass * N_A / M (the dormant row was seeded
// with zero mass, hence zero entities). On the G2 exact-ledger route, the
// released mass and extensive internal energy U = m * u are also booked into
// exact_mass_rows and exact_energy_rows (adding U to both U and S so the fluid
// ledger's sum(U - S) stays bit-invariant across ownership transfer).
const FORMAT = SPH_EXACT_THERMAL_ENERGY_FORMAT;
const GPU_BUFFER_USAGE = Object.freeze({ STORAGE: 0x80, UNIFORM: 0x40, COPY_DST: 0x08 });

export const schroederSolidReleaseWgsl = /* wgsl */ `
${createSphExactMassWgsl(FORMAT)}
${createSphExactLedgerWgsl(FORMAT)}
struct ReleaseParams {
  // max events, exact energy ledger row count (0 = f32 only), exact mass enabled (1/0), unused
  counts: vec4<u32>,
  // material id (f32), liquid density, liquid phase id, entities per kg
  liquid: vec4<f32>,
};
@group(0) @binding(0) var<uniform> params: ReleaseParams;
@group(0) @binding(1) var<storage, read> release_events: array<vec4<f32>>;
@group(0) @binding(2) var<storage, read_write> release_count: array<u32>;
@group(0) @binding(3) var<storage, read> release_rows: array<u32>;
@group(0) @binding(4) var<storage, read_write> fluid_state: array<vec4<f32>>;
@group(0) @binding(5) var<storage, read_write> fluid_thermo: array<vec4<f32>>;
@group(0) @binding(6) var<storage, read_write> fluid_mechanics: array<vec4<f32>>;
@group(0) @binding(7) var<storage, read_write> exact_energy_rows: array<atomic<u32>>;
@group(0) @binding(8) var<storage, read_write> exact_mass_rows: array<u32>;

fn release_energy_load(word: u32) -> ExactMass {
  var value: ExactMass;
  for (var w = 0u; w < EM_WORDS; w++) { value.words[w] = atomicLoad(&exact_energy_rows[word + w]); }
  return value;
}

fn release_energy_store(word: u32, value: ExactMass) {
  for (var w = 0u; w < EM_WORDS; w++) { atomicStore(&exact_energy_rows[word + w], value.words[w]); }
}

@compute @workgroup_size(64)
fn activate_releases(@builtin(global_invocation_id) id: vec3<u32>) {
  let slot = id.x;
  let count = min(release_count[0], params.counts.x);
  if (slot >= count) { return; }
  let e0 = release_events[slot * 3u]; let e1 = release_events[slot * 3u + 1u]; let e2 = release_events[slot * 3u + 2u];
  let member = bitcast<u32>(e0.x);
  let row = release_rows[member];
  if (row == 0xffffffffu) { return; }
  let mass = e0.y;
  var specific_u = e0.z;
  if (params.counts.z != 0u) {
    let exact_m = el_from_f32_bits(bitcast<u32>(mass));
    if (exact_m.error == 0u) {
      for (var w = 0u; w < EM_WORDS; w++) { exact_mass_rows[row * EM_WORDS + w] = exact_m.value.words[w]; }
    }
  }
  if (params.counts.y > 0u && row < params.counts.y) {
    let exact_u = el_from_f32_bits(bitcast<u32>(mass * specific_u));
    let u_word = row * EM_WORDS;
    let s_word = params.counts.y * EM_WORDS + u_word;
    let next_u = el_add(release_energy_load(u_word), exact_u.value);
    let next_s = el_add(release_energy_load(s_word), exact_u.value);
    let proj = el_project_f32_bits(next_u.value);
    if ((exact_u.error | next_u.error | next_s.error | proj.error) == 0u && mass > 0.0) {
      release_energy_store(u_word, next_u.value);
      release_energy_store(s_word, next_s.value);
      specific_u = bitcast<f32>(proj.bits) / mass;
    }
  }
  fluid_state[row * 2u] = vec4<f32>(e1.xyz, mass);
  fluid_state[row * 2u + 1u] = vec4<f32>(e2.xyz, specific_u);
  fluid_thermo[row * 3u] = vec4<f32>(params.liquid.x, params.liquid.z, e0.w, params.liquid.y);
  fluid_thermo[row * 3u + 1u] = vec4<f32>(0.0, 1.0, 0.0, 0.0);
  // Keep the seeded smoothing length, status and radius; set the entities.
  let seeded = fluid_thermo[row * 3u + 2u];
  fluid_thermo[row * 3u + 2u] = vec4<f32>(seeded.x, mass * params.liquid.w, seeded.z, seeded.w);
  // F = I, C = 0, J = 1, rest volume m / rho_l; words 20.. keep the seeded liquid fields.
  fluid_mechanics[row * 8u] = vec4<f32>(1.0, 0.0, 0.0, 0.0);
  fluid_mechanics[row * 8u + 1u] = vec4<f32>(1.0, 0.0, 0.0, 0.0);
  fluid_mechanics[row * 8u + 2u] = vec4<f32>(1.0, 0.0, 0.0, 0.0);
  fluid_mechanics[row * 8u + 3u] = vec4<f32>(0.0, 0.0, 0.0, 0.0);
  fluid_mechanics[row * 8u + 4u] = vec4<f32>(0.0, 0.0, 1.0, mass / params.liquid.y);
}

// One thread: the events are consumed.
@compute @workgroup_size(1)
fn clear_releases() { release_count[0] = 0u; }
`;

/** Encode the activation of pending releases into the fluid rows, then clear them. */
export function createSchroederSolidReleaseStage({ device, memberCount, releaseRows, liquidMaterialId,
  liquidDensityKgPerM3, liquidPhaseId = 2, liquidEntitiesPerKg = 0, releaseEventBuffer, releaseCountBuffer } = {}) {
  const bindings = ['uniform', 'read-only-storage', 'storage', 'read-only-storage', 'storage', 'storage', 'storage',
    'storage', 'storage'].map((type, binding) => computeBufferBinding(binding, type));
  const pipelines = Object.fromEntries(['activate_releases', 'clear_releases'].map(entryPoint => [entryPoint,
    createCachedExplicitComputePipeline(device, { cacheKey: `ulg-solid-release-${entryPoint}.v2`,
      label: `ulg-solid-release-${entryPoint}`, code: schroederSolidReleaseWgsl, entryPoint, bindings })]));
  const params = device.createBuffer({ label: 'ulg-solid-release-params', size: 32, usage: GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST });
  const words = new ArrayBuffer(32), u = new Uint32Array(words), f = new Float32Array(words);
  u.set([memberCount, 0, 0, 0], 0); f.set([liquidMaterialId, liquidDensityKgPerM3, liquidPhaseId,
    Number.isFinite(liquidEntitiesPerKg) && liquidEntitiesPerKg > 0 ? liquidEntitiesPerKg : 0], 4);
  device.queue.writeBuffer(params, 0, words);
  const rowsBuffer = device.createBuffer({ label: 'ulg-solid-release-rows', size: Math.max(16, releaseRows.byteLength),
    usage: 0x80 | GPU_BUFFER_USAGE.COPY_DST });
  device.queue.writeBuffer(rowsBuffer, 0, releaseRows);
  const exactEnergyPlaceholder = device.createBuffer({ label: 'ulg-solid-release-exact-energy-placeholder',
    size: 16, usage: GPU_BUFFER_USAGE.STORAGE });
  const exactMassPlaceholder = device.createBuffer({ label: 'ulg-solid-release-exact-mass-placeholder',
    size: 16, usage: GPU_BUFFER_USAGE.STORAGE });
  const groups = new Map();
  return Object.freeze({
    prepare({ exactEnergyBuffer = null, exactEnergyRowCount = 0, exactMassBuffer = null } = {}) {
      const ledgerRows = exactEnergyBuffer && exactEnergyRowCount > 0 ? exactEnergyRowCount : 0;
      const hasExactMass = exactMassBuffer ? 1 : 0;
      if (u[1] !== ledgerRows || u[2] !== hasExactMass) {
        u[1] = ledgerRows; u[2] = hasExactMass;
        device.queue.writeBuffer(params, 0, words);
      }
    },
    encode(encoder, { stateBuffer, thermoBuffer, mechanicsBuffer, exactEnergyBuffer = null, exactEnergyRowCount = 0,
      exactMassBuffer = null, pass: sharedPass = null, prepared = false }) {
      const ledgerRows = exactEnergyBuffer && exactEnergyRowCount > 0 ? exactEnergyRowCount : 0;
      const hasExactMass = exactMassBuffer ? 1 : 0;
      const boundExactEnergy = ledgerRows > 0 ? exactEnergyBuffer : exactEnergyPlaceholder;
      const boundExactMass = hasExactMass ? exactMassBuffer : exactMassPlaceholder;
      if (!prepared && (u[1] !== ledgerRows || u[2] !== hasExactMass)) {
        u[1] = ledgerRows; u[2] = hasExactMass;
        device.queue.writeBuffer(params, 0, words);
      }
      const key = [stateBuffer, thermoBuffer, mechanicsBuffer, boundExactEnergy, boundExactMass];
      let group = [...groups.entries()].find(([k]) => k.every((b, i) => b === key[i]))?.[1];
      if (!group) {
        group = device.createBindGroup({ layout: pipelines.activate_releases.bindGroupLayout,
          entries: [params, releaseEventBuffer, releaseCountBuffer, rowsBuffer, stateBuffer, thermoBuffer,
            mechanicsBuffer, boundExactEnergy, boundExactMass]
            .map((buffer, binding) => ({ binding, resource: { buffer } })) });
        if (groups.size > 8) groups.clear();
        groups.set(key, group);
      }
      const pass = sharedPass ?? encoder.beginComputePass({ label: 'ulg-solid-release' });
      pass.setBindGroup(0, group);
      for (const [entryPoint, count] of [['activate_releases', Math.ceil(memberCount / 64)], ['clear_releases', 1]]) {
        pass.setPipeline(pipelines[entryPoint].pipeline);
        pass.dispatchWorkgroups(count);
      }
      if (!sharedPass) pass.end();
    },
    destroy() { params.destroy(); rowsBuffer.destroy(); exactEnergyPlaceholder.destroy(); exactMassPlaceholder.destroy(); }
  });
}
