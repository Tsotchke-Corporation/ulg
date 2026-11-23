import { computeBufferBinding, createCachedExplicitBindGroup, createCachedExplicitComputePipeline } from '../webgpuComputeLayout.js';

// G4 reaction node scope (plan/todo/g4-dynamic-laws-proposal.md): an exact
// per-source activation predicate for canonical reaction discovery
// (schroederSpatialReactionDiscoveryProposalGpu.js).
//
// Discovery evaluates a pair (i, j) for reaction r only when the materials
// are r's two reactants, both phase masks are satisfied,
// max(T_i, T_j) >= T_act(r) and |x_i - x_j| <= contact_radius(r). With cells
// of edge >= the maximum contact radius, every such partner lies in the
// source's 3x3x3 cell halo. A present source is therefore ACTIVE when, for
// some enabled reaction with its material as a reactant, the halo holds the
// co-reactant's material and its maximum temperature reaches T_act. Otherwise
// it can have no feasible pair at all, and skipping its traversal leaves its
// proposal (no partner) bit for bit unchanged. Phase masks are not used (a
// superset), and material ids map to a 32-bit presence mask by id mod 32 (a
// superset). The predicate is symmetric, so a feasible pair has both
// endpoints active. No epsilon: this is exact, not an approximation.
//
// Outputs: dormant[i] (1/0), counts [active, dormant, present, overflow],
// compacted active_indices[0..active-1], and indirect dispatch args at offset
// 16 of countBuffer ([ceil(active/64), 1, 1, active], yielding [0, 1, 1, 0]
// zero-work witness when quiescent). Optional per-source G6/A4 temperature
// uncertainty dT >= 0 expands scattered halo max temperatures to T + dT so
// reaction activation remains conservative when uncertainty straddles T_act.
const GPU_BUFFER_USAGE = Object.freeze({
  STORAGE: 0x80,
  UNIFORM: 0x40,
  COPY_SRC: 0x04,
  COPY_DST: 0x08,
  INDIRECT: 0x0100
});

export const schroederReactionDormancyWgsl = /* wgsl */ `
struct ReactionDormancyParams {
  // particle count, allocated cells x, y, z
  counts: vec4<u32>,
  // state stride (vec4s), thermo stride (vec4s), reaction count, record stride (vec4s)
  strides: vec4<u32>,
  // cell edge floor (m), maximum contact radius (m), uncertainty enabled (1/0), uncertainty word offset (f32-encoded u32)
  config: vec4<f32>,
  // grid extent x, y, z, write_invalid_proposal (1 = write (-1,-1,0,0) for indirect dispatch, 0 = write -7 sentinel)
  box: vec4<f32>,
  // grid origin x, y, z, unused
  origin: vec4<f32>,
};
@group(0) @binding(0) var<uniform> params: ReactionDormancyParams;
@group(0) @binding(1) var<storage, read> source_state: array<vec4<f32>>;
@group(0) @binding(2) var<storage, read> source_thermo: array<vec4<f32>>;
@group(0) @binding(3) var<storage, read> reaction_records: array<vec4<f32>>;
// Per cell: [material presence mask, maximum temperature key].
@group(0) @binding(4) var<storage, read_write> cell_words: array<atomic<u32>>;
@group(0) @binding(5) var<storage, read_write> dormant: array<u32>;
// [active, dormant, present, overflow, dispatchX, dispatchY, dispatchZ, activeCopy]
@group(0) @binding(6) var<storage, read_write> counts: array<atomic<u32>>;
// The discovery proposal rows: a dormant source's row gets the sentinel the
// discovery pass checks before overwriting its row.
@group(0) @binding(7) var<storage, read_write> proposal_rows: array<vec4<f32>>;
// Compacted active source indices [0..active-1].
@group(0) @binding(8) var<storage, read_write> active_indices: array<u32>;
// Optional per-source G6/A4 temperature uncertainty dT (K); active when params.config.z > 0.5.
@group(0) @binding(9) var<storage, read> temperature_uncertainty: array<f32>;
const REACTION_DORMANCY_SENTINEL: vec4<f32> = vec4<f32>(-7.0, -7.0, -7.0, -7.0);
const REACTION_INVALID_PROPOSAL: vec4<f32> = vec4<f32>(-1.0, -1.0, 0.0, 0.0);

fn finite(value: f32) -> bool { return value == value && abs(value) <= 3.402823e38; }

fn source_uncertainty(i: u32) -> f32 {
  if (params.config.z <= 0.5) { return 0.0; }
  let offset = u32(max(0.0, params.config.w));
  let idx = offset + i;
  if (idx >= arrayLength(&temperature_uncertainty)) { return 0.0; }
  return temperature_uncertainty[idx];
}

fn grid_edge() -> f32 {
  return max(params.config.x, params.config.y) * 1.0001;
}
fn grid_dims(edge: f32) -> vec3<i32> {
  return clamp(vec3<i32>(ceil(params.box.xyz / edge)), vec3<i32>(1), vec3<i32>(params.counts.yzw));
}
// Clamping is 1-Lipschitz per axis, so partners stay within one cell.
fn cell_of(p: vec3<f32>, edge: f32, dims: vec3<i32>) -> vec3<i32> {
  return clamp(vec3<i32>(floor((p - params.origin.xyz) / edge)), vec3<i32>(0), dims - vec3<i32>(1));
}
fn cell_index(c: vec3<i32>, dims: vec3<i32>) -> u32 {
  return u32(c.x) + u32(dims.x) * (u32(c.y) + u32(dims.y) * u32(c.z));
}
fn material_bit(material: f32) -> u32 {
  return 1u << (u32(material) & 31u);
}
fn source_present(i: u32) -> bool {
  return source_state[i * params.strides.x].w > 0.0;
}

@compute @workgroup_size(64)
fn reset_cells(@builtin(global_invocation_id) id: vec3<u32>) {
  let cells = params.counts.y * params.counts.z * params.counts.w;
  if (id.x < cells) {
    atomicStore(&cell_words[id.x * 2u], 0u);
    atomicStore(&cell_words[id.x * 2u + 1u], 0u);
  }
  if (id.x < 4u) { atomicStore(&counts[id.x], 0u); }
}

@compute @workgroup_size(64)
fn scatter_sources(@builtin(global_invocation_id) id: vec3<u32>) {
  let i = id.x;
  if (i >= params.counts.x || !source_present(i)) { return; }
  let edge = grid_edge();
  let dims = grid_dims(edge);
  let p = source_state[i * params.strides.x].xyz;
  let thermo0 = source_thermo[i * params.strides.y];
  let dt = source_uncertainty(i);
  let c = cell_index(cell_of(select(params.origin.xyz, p, finite(p.x) && finite(p.y) && finite(p.z)), edge, dims), dims);
  // A malformed material, temperature, or uncertainty poisons its cell: every
  // material present, maximum temperature, so every source near it stays active.
  let valid = finite(thermo0.x) && thermo0.x >= 0.0 && finite(thermo0.z) && finite(dt) && dt >= 0.0 && dt <= 3.0e38;
  atomicOr(&cell_words[c * 2u], select(0xffffffffu, material_bit(thermo0.x), valid));
  // Temperatures order as their f32 bits when positive; pad by uncertainty +dT.
  let t_hi = min(3.0e38, max(thermo0.z, 0.0) + max(dt, 0.0));
  let key = select(0x7f7fffffu, bitcast<u32>(t_hi), valid);
  atomicMax(&cell_words[c * 2u + 1u], key);
}

@compute @workgroup_size(64)
fn classify_sources(@builtin(global_invocation_id) id: vec3<u32>) {
  let i = id.x;
  if (i >= params.counts.x) { return; }
  if (!source_present(i)) {
    dormant[i] = 0u;
    if (params.box.w > 0.5 && i < arrayLength(&proposal_rows)) {
      proposal_rows[i] = REACTION_INVALID_PROPOSAL;
    }
    return;
  }
  // Present sources only: an absent row is never read as dormant, and a
  // stale sentinel cannot survive (the discovery pass rewrites every row).
  atomicAdd(&counts[2], 1u);
  let p = source_state[i * params.strides.x].xyz;
  let thermo0 = source_thermo[i * params.strides.y];
  let dt = source_uncertainty(i);
  var is_active = !(finite(thermo0.x) && thermo0.x >= 0.0 && finite(thermo0.z)
    && finite(dt) && dt >= 0.0 && dt <= 3.0e38
    && finite(p.x) && finite(p.y) && finite(p.z));
  if (!is_active) {
    let edge = grid_edge();
    let dims = grid_dims(edge);
    let c = cell_of(p, edge, dims);
    var halo_mask = 0u;
    var halo_max_key = 0u;
    for (var dz = -1; dz <= 1; dz++) {
      for (var dy = -1; dy <= 1; dy++) {
        for (var dx = -1; dx <= 1; dx++) {
          let n = c + vec3<i32>(dx, dy, dz);
          if (any(n < vec3<i32>(0)) || any(n >= dims)) { continue; }
          let k = cell_index(n, dims);
          halo_mask = halo_mask | atomicLoad(&cell_words[k * 2u]);
          halo_max_key = max(halo_max_key, atomicLoad(&cell_words[k * 2u + 1u]));
        }
      }
    }
    let halo_max_temperature = bitcast<f32>(halo_max_key);
    let self_material = thermo0.x;
    let stride = params.strides.w;
    for (var r = 0u; r < params.strides.z && !is_active; r++) {
      let base = r * stride;
      if (base + 2u >= arrayLength(&reaction_records)) { is_active = true; break; }
      let row0 = reaction_records[base];
      let row1 = reaction_records[base + 1u];
      let row2 = reaction_records[base + 2u];
      // The discovery kernel's own per-reaction skips.
      if (row2.x != 1.0 || !finite(row1.y) || row1.y <= 0.0 || !finite(row0.w)
        || row0.x == row0.y) { continue; }
      var other = -1.0;
      if (self_material == row0.x) { other = row0.y; }
      else if (self_material == row0.y) { other = row0.x; }
      else { continue; }
      if (!(finite(other) && other >= 0.0)) { is_active = true; break; }
      if ((halo_mask & material_bit(other)) != 0u && halo_max_temperature >= row0.w) {
        is_active = true;
      }
    }
  }
  dormant[i] = select(1u, 0u, is_active);
  if (!is_active && i < arrayLength(&proposal_rows)) {
    proposal_rows[i] = select(REACTION_DORMANCY_SENTINEL, REACTION_INVALID_PROPOSAL, params.box.w > 0.5);
  }
  if (is_active) {
    let slot = atomicAdd(&counts[0], 1u);
    active_indices[slot] = i;
  } else {
    atomicAdd(&counts[1], 1u);
  }
}

@compute @workgroup_size(1)
fn finalize_dispatch() {
  let active_count = atomicLoad(&counts[0]);
  atomicStore(&counts[4], (active_count + 63u) / 64u);
  atomicStore(&counts[5], 1u);
  atomicStore(&counts[6], 1u);
  atomicStore(&counts[7], active_count);
}
`;

/**
 * The reaction dormancy stage. `maximumContactRadiusM` is the discovery
 * stage's own maximum (every reaction's contact radius is at most it).
 */
export function createSchroederReactionDormancyStage({ device, particleCount, boxM, originM = [0, 0, 0],
  maximumContactRadiusM, minCellEdgeM = 0, reactionCount, reactionRecordStrideVec4s,
  stateStrideVec4s = 2, thermoStrideVec4s = 3 } = {}) {
  if (!(particleCount > 0) || !(maximumContactRadiusM >= 0) || !(reactionCount >= 0)) {
    throw new TypeError('Reaction dormancy needs particles, a contact radius and a reaction count');
  }
  // The edge floor is the maximum contact radius; it grows only to keep the
  // grid within a 2^20-cell (8 MB) budget.
  let floorM = Math.max(Number(minCellEdgeM) || 0, maximumContactRadiusM, Math.max(...boxM) / 4096);
  if (!(floorM > 0)) throw new TypeError('Reaction dormancy needs a positive cell edge');
  const cellsFor = (edge) => boxM.map((v) => Math.max(1, Math.ceil(v / edge)));
  while (cellsFor(floorM).reduce((a, b) => a * b, 1) > 1 << 20) floorM *= 1.25;
  const cells = cellsFor(floorM);
  const cellCount = cells[0] * cells[1] * cells[2];
  const bindings = ['uniform', 'read-only-storage', 'read-only-storage', 'read-only-storage', 'storage', 'storage',
    'storage', 'storage', 'storage', 'read-only-storage']
    .map((type, binding) => computeBufferBinding(binding, type));
  const pipelines = Object.fromEntries(['reset_cells', 'scatter_sources', 'classify_sources', 'finalize_dispatch'].map((entryPoint) =>
    [entryPoint, createCachedExplicitComputePipeline(device, { cacheKey: `ulg-reaction-dormancy-${entryPoint}.v2`,
      label: `ulg-reaction-dormancy-${entryPoint}`, code: schroederReactionDormancyWgsl, entryPoint, bindings })]));
  const params = device.createBuffer({ label: 'ulg-reaction-dormancy-params', size: 80,
    usage: GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST });
  const words = new ArrayBuffer(80), u = new Uint32Array(words), f = new Float32Array(words);
  u.set([particleCount, ...cells], 0);
  u.set([stateStrideVec4s, thermoStrideVec4s, reactionCount, reactionRecordStrideVec4s], 4);
  f.set([floorM, maximumContactRadiusM, 0, 0], 8);
  f.set([...boxM, 0], 12);
  f.set([...originM, 0], 16);
  device.queue.writeBuffer(params, 0, words);
  const cellWords = device.createBuffer({ label: 'ulg-reaction-dormancy-cells', size: cellCount * 8, usage: GPU_BUFFER_USAGE.STORAGE });
  const dormantBuffer = device.createBuffer({ label: 'ulg-reaction-dormant', size: Math.max(16, particleCount * 4),
    usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_SRC });
  const countBuffer = device.createBuffer({ label: 'ulg-reaction-dormancy-counts', size: 32,
    usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.INDIRECT | GPU_BUFFER_USAGE.COPY_SRC });
  const activeIndicesBuffer = device.createBuffer({ label: 'ulg-reaction-dormancy-active-indices',
    size: Math.max(16, particleCount * 4), usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_SRC });
  const uncertaintyPlaceholder = device.createBuffer({ label: 'ulg-reaction-dormancy-uncertainty-placeholder',
    size: 16, usage: GPU_BUFFER_USAGE.STORAGE });
  let group = null, groupKey = null;
  let lastUncertaintyFlag = 0;
  let lastUncertaintyOffset = 0;
  let lastWriteInvalid = 0;
  return Object.freeze({
    cells, cellEdgeFloorM: floorM, dormantBuffer, countBuffer, activeIndicesBuffer,
    indirectDispatchBuffer: countBuffer, indirectDispatchOffset: 16,
    encode(encoder, { stateBuffer, thermoBuffer, reactionRecordBuffer, proposalBuffer, proposalByteLength,
      uncertaintyBuffer = null, uncertaintyWordOffset = 0, writeInvalidProposalOnDormant = false }) {
      const hasUncertainty = uncertaintyBuffer ? 1 : 0;
      const uOffset = Math.max(0, Math.trunc(Number(uncertaintyWordOffset) || 0));
      const writeInvalid = writeInvalidProposalOnDormant ? 1 : 0;
      if (
        hasUncertainty !== lastUncertaintyFlag
        || uOffset !== lastUncertaintyOffset
        || writeInvalid !== lastWriteInvalid
      ) {
        lastUncertaintyFlag = hasUncertainty;
        lastUncertaintyOffset = uOffset;
        lastWriteInvalid = writeInvalid;
        f[10] = hasUncertainty;
        f[11] = uOffset;
        f[15] = writeInvalid;
        device.queue.writeBuffer(params, 0, words);
      }
      const boundUncertainty = uncertaintyBuffer ?? uncertaintyPlaceholder;
      const group = createCachedExplicitBindGroup(device, {
        label: 'ulg-reaction-dormancy-bg',
        layout: pipelines.reset_cells.bindGroupLayout,
        entries: [
          ...[params, stateBuffer, thermoBuffer, reactionRecordBuffer, cellWords, dormantBuffer, countBuffer]
            .map((buffer, binding) => ({ binding, resource: { buffer } })),
          { binding: 7, resource: { buffer: proposalBuffer, offset: 0, size: proposalByteLength ?? proposalBuffer.size } },
          { binding: 8, resource: { buffer: activeIndicesBuffer } },
          { binding: 9, resource: { buffer: boundUncertainty } }
        ]
      });
      const pass = encoder.beginComputePass({ label: 'ulg-reaction-dormancy' });
      pass.setBindGroup(0, group);
      for (const [entryPoint, groupsCount] of [
        ['reset_cells', Math.ceil(Math.max(cellCount, 4) / 64)],
        ['scatter_sources', Math.ceil(particleCount / 64)],
        ['classify_sources', Math.ceil(particleCount / 64)],
        ['finalize_dispatch', 1]
      ]) {
        pass.setPipeline(pipelines[entryPoint].pipeline);
        pass.dispatchWorkgroups(groupsCount);
      }
      pass.end();
    },
    destroy() {
      for (const b of [params, cellWords, dormantBuffer, countBuffer, activeIndicesBuffer, uncertaintyPlaceholder]) b.destroy();
    }
  });
}
