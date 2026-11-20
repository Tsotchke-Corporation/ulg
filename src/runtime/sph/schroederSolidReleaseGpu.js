import { computeBufferBinding, createCachedExplicitComputePipeline } from '../webgpuComputeLayout.js';

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
// with zero mass, hence zero entities). A zero-entity liquid would hand zero
// molecules to any vapor it later forms, which the gas-ledger EOS rejects.
const GPU_BUFFER_USAGE = Object.freeze({ UNIFORM: 0x40, COPY_DST: 0x08 });

export const schroederSolidReleaseWgsl = /* wgsl */ `
struct ReleaseParams {
  // max events, unused...
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
  fluid_state[row * 2u] = vec4<f32>(e1.xyz, mass);
  fluid_state[row * 2u + 1u] = vec4<f32>(e2.xyz, e0.z);
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
  const bindings = ['uniform', 'read-only-storage', 'storage', 'read-only-storage', 'storage', 'storage', 'storage']
    .map((type, binding) => computeBufferBinding(binding, type));
  const pipelines = Object.fromEntries(['activate_releases', 'clear_releases'].map(entryPoint => [entryPoint,
    createCachedExplicitComputePipeline(device, { cacheKey: `ulg-solid-release-${entryPoint}.v1`,
      label: `ulg-solid-release-${entryPoint}`, code: schroederSolidReleaseWgsl, entryPoint, bindings })]));
  const params = device.createBuffer({ label: 'ulg-solid-release-params', size: 32, usage: GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST });
  const words = new ArrayBuffer(32), u = new Uint32Array(words), f = new Float32Array(words);
  u.set([memberCount, 0, 0, 0], 0); f.set([liquidMaterialId, liquidDensityKgPerM3, liquidPhaseId,
    Number.isFinite(liquidEntitiesPerKg) && liquidEntitiesPerKg > 0 ? liquidEntitiesPerKg : 0], 4);
  device.queue.writeBuffer(params, 0, words);
  const rowsBuffer = device.createBuffer({ label: 'ulg-solid-release-rows', size: Math.max(16, releaseRows.byteLength),
    usage: 0x80 | GPU_BUFFER_USAGE.COPY_DST });
  device.queue.writeBuffer(rowsBuffer, 0, releaseRows);
  const groups = new Map();
  return Object.freeze({
    encode(encoder, { stateBuffer, thermoBuffer, mechanicsBuffer }) {
      const key = [stateBuffer, thermoBuffer, mechanicsBuffer];
      let group = [...groups.entries()].find(([k]) => k.every((b, i) => b === key[i]))?.[1];
      if (!group) {
        group = device.createBindGroup({ layout: pipelines.activate_releases.bindGroupLayout,
          entries: [params, releaseEventBuffer, releaseCountBuffer, rowsBuffer, stateBuffer, thermoBuffer, mechanicsBuffer]
            .map((buffer, binding) => ({ binding, resource: { buffer } })) });
        if (groups.size > 8) groups.clear();
        groups.set(key, group);
      }
      for (const [entryPoint, count] of [['activate_releases', Math.ceil(memberCount / 64)], ['clear_releases', 1]]) {
        const pass = encoder.beginComputePass({ label: `ulg-solid-release-${entryPoint}` });
        pass.setPipeline(pipelines[entryPoint].pipeline); pass.setBindGroup(0, group);
        pass.dispatchWorkgroups(count); pass.end();
      }
    },
    destroy() { params.destroy(); rowsBuffer.destroy(); }
  });
}
