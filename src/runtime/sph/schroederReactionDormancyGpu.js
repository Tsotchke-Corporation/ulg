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
  // grid origin x, y, z, ss base grid spacing (m, > 0 in canonical SS mode)
  origin: vec4<f32>,
  // canonical SS [min_level, max_level, levels_valid (1/0), unused]
  ss_levels: vec4<i32>,
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

// Canonical SS-directory reaction dormancy: reduces material masks & max
// temperature per occupied SS cell from SCHROEDER_SPATIAL_EPOCH_DIRECTORY_ABI
// (zero private dense 3D box grid, zero empty-space clearing, zero re-binning).
export const schroederReactionDormancySsWgsl = /* wgsl */ `
${schroederReactionDormancyWgsl}
@group(0) @binding(10) var<storage, read> spatial_directory: array<u32>;

const SS_DIR_MAGIC: u32 = 0x53534531u;
const SS_DIR_STATUS_READY_ADMITTED: u32 = 3u;
const SS_DIR_STATUS_REJECT_MASK: u32 = 28u;

fn ss_dir_valid() -> bool {
  if (arrayLength(&spatial_directory) < 48u) { return false; }
  let status = spatial_directory[2u];
  return spatial_directory[0u] == SS_DIR_MAGIC
    && (spatial_directory[1u] == 1u || spatial_directory[1u] == 2u)
    && (status & SS_DIR_STATUS_READY_ADMITTED) == SS_DIR_STATUS_READY_ADMITTED
    && (status & SS_DIR_STATUS_REJECT_MASK) == 0u;
}

fn ss_find_cell(cell_count: u32, keys_off: u32, want_key: array<u32, 5>) -> u32 {
  var lo = 0u;
  var hi = cell_count;
  while (lo < hi) {
    let mid = lo + ((hi - lo) >> 1u);
    let base = keys_off + mid * 5u;
    var cmp = 0i;
    for (var w = 0u; w < 5u; w = w + 1u) {
      let kv = spatial_directory[base + w];
      if (kv < want_key[w]) { cmp = -1i; break; }
      if (kv > want_key[w]) { cmp = 1i; break; }
    }
    if (cmp == 0i) { return mid; }
    if (cmp < 0i) { lo = mid + 1u; } else { hi = mid; }
  }
  return 0xffffffffu;
}

@compute @workgroup_size(64)
fn reset_cells_ss(@builtin(global_invocation_id) id: vec3<u32>) {
  let max_cells = min(arrayLength(&cell_words) / 2u, select(0u, spatial_directory[18u], ss_dir_valid()));
  if (id.x < max_cells) {
    atomicStore(&cell_words[id.x * 2u], 0u);
    atomicStore(&cell_words[id.x * 2u + 1u], 0u);
  }
  if (id.x < 4u) { atomicStore(&counts[id.x], 0u); }
}

@compute @workgroup_size(64)
fn reduce_ss_cells(@builtin(global_invocation_id) id: vec3<u32>) {
  if (!ss_dir_valid()) { return; }
  let cell_count = min(spatial_directory[18u], arrayLength(&cell_words) / 2u);
  let c = id.x;
  if (c >= cell_count) { return; }
  let offsets_off = spatial_directory[30u];
  let members_off = spatial_directory[31u];
  let begin = spatial_directory[offsets_off + c];
  let end = spatial_directory[offsets_off + c + 1u];
  var mat_mask = 0u;
  var max_t_key = 0u;
  for (var m = begin; m < end; m = m + 1u) {
    let i = spatial_directory[members_off + m];
    if (i >= params.counts.x || !source_present(i)) { continue; }
    let thermo0 = source_thermo[i * params.strides.y];
    let dt = source_uncertainty(i);
    let valid = finite(thermo0.x) && thermo0.x >= 0.0 && finite(thermo0.z) && finite(dt) && dt >= 0.0 && dt <= 3.0e38;
    mat_mask = mat_mask | select(0xffffffffu, material_bit(thermo0.x), valid);
    let t_hi = min(3.0e38, max(thermo0.z, 0.0) + max(dt, 0.0));
    max_t_key = max(max_t_key, select(0x7f7fffffu, bitcast<u32>(t_hi), valid));
  }
  atomicStore(&cell_words[c * 2u], mat_mask);
  atomicStore(&cell_words[c * 2u + 1u], max_t_key);
}

@compute @workgroup_size(64)
fn classify_sources_ss(@builtin(global_invocation_id) id: vec3<u32>) {
  let i = id.x;
  if (i >= params.counts.x) { return; }
  if (!source_present(i)) {
    dormant[i] = 0u;
    if (params.box.w > 0.5 && i < arrayLength(&proposal_rows)) {
      proposal_rows[i] = REACTION_INVALID_PROPOSAL;
    }
    return;
  }
  atomicAdd(&counts[2], 1u);
  let p = source_state[i * params.strides.x].xyz;
  let thermo0 = source_thermo[i * params.strides.y];
  let dt = source_uncertainty(i);
  let dir_ok = ss_dir_valid();
  let ss_base_spacing = params.origin.w;
  var is_active = !(finite(thermo0.x) && thermo0.x >= 0.0 && finite(thermo0.z)
    && finite(dt) && dt >= 0.0 && dt <= 3.0e38
    && finite(p.x) && finite(p.y) && finite(p.z)
    && dir_ok && ss_base_spacing > 0.0);
  if (!is_active) {
    let cell_count = min(spatial_directory[18u], arrayLength(&cell_words) / 2u);
    let keys_off = spatial_directory[29u];
    let p2c_off = spatial_directory[32u];
    let raw_p2c = spatial_directory[p2c_off + i];
    let self_cell = select(raw_p2c, raw_p2c - 1u, spatial_directory[1u] >= 2u);
    let has_cell = select((raw_p2c < cell_count), ((raw_p2c > 0u) && (self_cell < cell_count)), spatial_directory[1u] >= 2u);
    if (!has_cell) {
      is_active = true;
    } else {
      let kb = keys_off + self_cell * 5u;
      let chart_id = spatial_directory[kb + 0u];
      let self_level = bitcast<i32>(spatial_directory[kb + 1u] ^ 0x80000000u);
      var min_level = self_level;
      var max_level = self_level;
      if (params.ss_levels.z != 0i && params.ss_levels.x <= params.ss_levels.y && (params.ss_levels.y - params.ss_levels.x) <= 8i) {
        min_level = min(params.ss_levels.x, self_level);
        max_level = max(params.ss_levels.y, self_level);
      }
      let edge = grid_edge();
      var halo_mask = 0u;
      var halo_max_key = 0u;
      var halo_exceeded = false;
      for (var lvl = min_level; lvl <= max_level && !halo_exceeded; lvl = lvl + 1i) {
        let spacing_m = ss_base_spacing * exp2(f32(lvl));
        let halo_f = ceil(edge / max(spacing_m, 1.0e-30));
        if (!(spacing_m > 0.0) || halo_f > 2.0) {
          halo_exceeded = true;
          break;
        }
        let halo_r = max(1i, i32(halo_f));
        let lvl_key = bitcast<u32>(lvl) ^ 0x80000000u;
        let base_cell = vec3<i32>(floor(p / spacing_m));
        for (var dz = -halo_r; dz <= halo_r; dz = dz + 1i) {
          for (var dy = -halo_r; dy <= halo_r; dy = dy + 1i) {
            for (var dx = -halo_r; dx <= halo_r; dx = dx + 1i) {
              let c = base_cell + vec3<i32>(dx, dy, dz);
              let want_key = array<u32, 5>(
                chart_id,
                lvl_key,
                bitcast<u32>(c.x) ^ 0x80000000u,
                bitcast<u32>(c.y) ^ 0x80000000u,
                bitcast<u32>(c.z) ^ 0x80000000u
              );
              let k = ss_find_cell(cell_count, keys_off, want_key);
              if (k == 0xffffffffu) { continue; }
              halo_mask = halo_mask | atomicLoad(&cell_words[k * 2u]);
              halo_max_key = max(halo_max_key, atomicLoad(&cell_words[k * 2u + 1u]));
            }
          }
        }
      }
      if (halo_exceeded) {
        is_active = true;
      } else {
        let halo_max_temperature = bitcast<f32>(halo_max_key);
        let self_material = thermo0.x;
        let stride = params.strides.w;
        for (var r = 0u; r < params.strides.z && !is_active; r++) {
          let base = r * stride;
          if (base + 2u >= arrayLength(&reaction_records)) { is_active = true; break; }
          let row0 = reaction_records[base];
          let row1 = reaction_records[base + 1u];
          let row2 = reaction_records[base + 2u];
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
`;

/**
 * The reaction dormancy stage. When `spatialDirectoryBuffer` is provided at
 * encode time (canonical SS runs), executes directly over canonical SS occupied
 * cells (zero private dense 3D box grid).
 */
export function createSchroederReactionDormancyStage({ device, particleCount, boxM, originM = [0, 0, 0],
  maximumContactRadiusM, minCellEdgeM = 0, reactionCount, reactionRecordStrideVec4s,
  stateStrideVec4s = 2, thermoStrideVec4s = 3, canonicalSsDirectoryMode = false } = {}) {
  if (!(particleCount > 0) || !(maximumContactRadiusM >= 0) || !(reactionCount >= 0)) {
    throw new TypeError('Reaction dormancy needs particles, a contact radius and a reaction count');
  }
  // The edge floor is the maximum contact radius; it grows only to keep the
  // standalone fallback grid within a 2^20-cell (8 MB) budget.
  let floorM = Math.max(Number(minCellEdgeM) || 0, maximumContactRadiusM, Math.max(...boxM) / 4096);
  if (!(floorM > 0)) throw new TypeError('Reaction dormancy needs a positive cell edge');
  const cellsFor = (edge) => boxM.map((v) => Math.max(1, Math.ceil(v / edge)));
  while (cellsFor(floorM).reduce((a, b) => a * b, 1) > 1 << 20) floorM *= 1.25;
  const cells = cellsFor(floorM);
  const denseCellCount = cells[0] * cells[1] * cells[2];
  const cellCapacity = canonicalSsDirectoryMode
    ? Math.max(64, particleCount)
    : Math.max(denseCellCount, Math.min(65536, particleCount));
  const bindings = ['uniform', 'read-only-storage', 'read-only-storage', 'read-only-storage', 'storage', 'storage',
    'storage', 'storage', 'storage', 'read-only-storage']
    .map((type, binding) => computeBufferBinding(binding, type));
  const ssBindings = [...bindings, computeBufferBinding(10, 'read-only-storage')];
  const pipelines = Object.fromEntries(['reset_cells', 'scatter_sources', 'classify_sources', 'finalize_dispatch'].map((entryPoint) =>
    [entryPoint, createCachedExplicitComputePipeline(device, { cacheKey: `ulg-reaction-dormancy-${entryPoint}.v2`,
      label: `ulg-reaction-dormancy-${entryPoint}`, code: schroederReactionDormancyWgsl, entryPoint, bindings })]));
  let ssPipelines = null;
  function getSsPipelines() {
    if (!ssPipelines) {
      ssPipelines = Object.fromEntries(['reset_cells_ss', 'reduce_ss_cells', 'classify_sources_ss', 'finalize_dispatch'].map((entryPoint) =>
        [entryPoint, createCachedExplicitComputePipeline(device, { cacheKey: `ulg-reaction-dormancy-ss-${entryPoint}.v1`,
          label: `ulg-reaction-dormancy-ss-${entryPoint}`, code: schroederReactionDormancySsWgsl, entryPoint, bindings: ssBindings })]));
    }
    return ssPipelines;
  }
  const params = device.createBuffer({ label: 'ulg-reaction-dormancy-params', size: 96,
    usage: GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST });
  const words = new ArrayBuffer(96), u = new Uint32Array(words), f = new Float32Array(words), i32 = new Int32Array(words);
  u.set([particleCount, ...cells], 0);
  u.set([stateStrideVec4s, thermoStrideVec4s, reactionCount, reactionRecordStrideVec4s], 4);
  f.set([floorM, maximumContactRadiusM, 0, 0], 8);
  f.set([...boxM, 0], 12);
  f.set([...originM, 0], 16);
  i32.set([0, 0, 0, 0], 20);
  device.queue.writeBuffer(params, 0, words);
  const cellWords = device.createBuffer({
    label: canonicalSsDirectoryMode ? 'ulg-reaction-dormancy-ss-cells' : 'ulg-reaction-dormancy-cells',
    size: cellCapacity * 8,
    usage: GPU_BUFFER_USAGE.STORAGE
  });
  let fallbackCellWords = null;
  function getDenseCellWords() {
    if (cellCapacity >= denseCellCount) return cellWords;
    if (!fallbackCellWords) {
      fallbackCellWords = device.createBuffer({
        label: 'ulg-reaction-dormancy-fallback-dense-cells',
        size: denseCellCount * 8,
        usage: GPU_BUFFER_USAGE.STORAGE
      });
    }
    return fallbackCellWords;
  }
  const dormantBuffer = device.createBuffer({ label: 'ulg-reaction-dormant', size: Math.max(16, particleCount * 4),
    usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_SRC });
  const countBuffer = device.createBuffer({ label: 'ulg-reaction-dormancy-counts', size: 32,
    usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.INDIRECT | GPU_BUFFER_USAGE.COPY_SRC });
  const activeIndicesBuffer = device.createBuffer({ label: 'ulg-reaction-dormancy-active-indices',
    size: Math.max(16, particleCount * 4), usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_SRC });
  const uncertaintyPlaceholder = device.createBuffer({ label: 'ulg-reaction-dormancy-uncertainty-placeholder',
    size: 16, usage: GPU_BUFFER_USAGE.STORAGE });
  let lastUncertaintyFlag = 0;
  let lastUncertaintyOffset = 0;
  let lastWriteInvalid = 0;
  let lastSsSpacing = 0;
  let lastSsMinLevel = 0;
  let lastSsMaxLevel = 0;
  let lastSsLevelsValid = 0;
  return Object.freeze({
    cells, canonicalSsDirectoryMode, cellEdgeFloorM: floorM, dormantBuffer, countBuffer, activeIndicesBuffer,
    indirectDispatchBuffer: countBuffer, indirectDispatchOffset: 16,
    encode(encoder, { stateBuffer, thermoBuffer, reactionRecordBuffer, proposalBuffer, proposalByteLength,
      uncertaintyBuffer = null, uncertaintyWordOffset = 0, writeInvalidProposalOnDormant = false,
      spatialDirectoryBuffer = null, spatialBaseGridSpacingM = 0, spatialMinLevel = 0, spatialMaxLevel = 0 }) {
      const hasUncertainty = uncertaintyBuffer ? 1 : 0;
      const uOffset = Math.max(0, Math.trunc(Number(uncertaintyWordOffset) || 0));
      const writeInvalid = writeInvalidProposalOnDormant ? 1 : 0;
      const maxStorage = device?.limits?.maxStorageBuffersPerShaderStage;
      const useSs = Boolean(
        spatialDirectoryBuffer
        && Number(spatialBaseGridSpacingM) > 0
        && (maxStorage == null || maxStorage >= 10)
      );
      const ssSpacing = useSs ? Number(spatialBaseGridSpacingM) : 0;
      const ssMin = useSs ? Math.trunc(Number(spatialMinLevel) || 0) : 0;
      const ssMax = useSs ? Math.trunc(Number(spatialMaxLevel) || 0) : 0;
      const ssLevelsValid = useSs ? 1 : 0;
      if (
        hasUncertainty !== lastUncertaintyFlag
        || uOffset !== lastUncertaintyOffset
        || writeInvalid !== lastWriteInvalid
        || ssSpacing !== lastSsSpacing
        || ssMin !== lastSsMinLevel
        || ssMax !== lastSsMaxLevel
        || ssLevelsValid !== lastSsLevelsValid
      ) {
        lastUncertaintyFlag = hasUncertainty;
        lastUncertaintyOffset = uOffset;
        lastWriteInvalid = writeInvalid;
        lastSsSpacing = ssSpacing;
        lastSsMinLevel = ssMin;
        lastSsMaxLevel = ssMax;
        lastSsLevelsValid = ssLevelsValid;
        f[10] = hasUncertainty;
        f[11] = uOffset;
        f[15] = writeInvalid;
        f[19] = ssSpacing;
        i32.set([ssMin, ssMax, ssLevelsValid, 0], 20);
        device.queue.writeBuffer(params, 0, words);
      }
      const boundUncertainty = uncertaintyBuffer ?? uncertaintyPlaceholder;
      if (useSs) {
        const sp = getSsPipelines();
        const ssGroup = createCachedExplicitBindGroup(device, {
          label: 'ulg-reaction-dormancy-ss-bg',
          layout: sp.reset_cells_ss.bindGroupLayout,
          entries: [
            ...[params, stateBuffer, thermoBuffer, reactionRecordBuffer, cellWords, dormantBuffer, countBuffer]
              .map((buffer, binding) => ({ binding, resource: { buffer } })),
            { binding: 7, resource: { buffer: proposalBuffer, offset: 0, size: proposalByteLength ?? proposalBuffer.size } },
            { binding: 8, resource: { buffer: activeIndicesBuffer } },
            { binding: 9, resource: { buffer: boundUncertainty } },
            { binding: 10, resource: { buffer: spatialDirectoryBuffer } }
          ]
        });
        const pass = encoder.beginComputePass({ label: 'ulg-reaction-dormancy-ss' });
        pass.setBindGroup(0, ssGroup);
        for (const [entryPoint, groupsCount] of [
          ['reset_cells_ss', Math.ceil(Math.max(cellCapacity, 4) / 64)],
          ['reduce_ss_cells', Math.ceil(Math.max(cellCapacity, 1) / 64)],
          ['classify_sources_ss', Math.ceil(particleCount / 64)],
          ['finalize_dispatch', 1]
        ]) {
          pass.setPipeline(sp[entryPoint].pipeline);
          pass.dispatchWorkgroups(groupsCount);
        }
        pass.end();
        return;
      }
      const group = createCachedExplicitBindGroup(device, {
        label: 'ulg-reaction-dormancy-bg',
        layout: pipelines.reset_cells.bindGroupLayout,
        entries: [
          ...[params, stateBuffer, thermoBuffer, reactionRecordBuffer, getDenseCellWords(), dormantBuffer, countBuffer]
            .map((buffer, binding) => ({ binding, resource: { buffer } })),
          { binding: 7, resource: { buffer: proposalBuffer, offset: 0, size: proposalByteLength ?? proposalBuffer.size } },
          { binding: 8, resource: { buffer: activeIndicesBuffer } },
          { binding: 9, resource: { buffer: boundUncertainty } }
        ]
      });
      const pass = encoder.beginComputePass({ label: 'ulg-reaction-dormancy' });
      pass.setBindGroup(0, group);
      for (const [entryPoint, groupsCount] of [
        ['reset_cells', Math.ceil(Math.max(denseCellCount, 4) / 64)],
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
      fallbackCellWords?.destroy();
      for (const b of [params, cellWords, dormantBuffer, countBuffer, activeIndicesBuffer, uncertaintyPlaceholder]) b.destroy();
    }
  });
}
