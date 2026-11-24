import { computeBufferBinding, createCachedExplicitBindGroup, createCachedExplicitComputePipeline } from '../webgpuComputeLayout.js';

// G4 slice 1 (plan/todo/g4-dynamic-laws-proposal.md): the conservative
// per-source thermal activation predicate.
//
// A present source (mass > 0) is thermally DORMANT when
//   - every present source in its 3x3x3 cell halo (cells of edge >= the
//     conduction support, so every conduction partner lies in the halo) has a
//     temperature within epsilon_T of its own temperature band, i.e.
//     max(T over halo) - min(T over halo) <= epsilon_T; and
//   - it is farther than the wall support from every box wall, or within
//     epsilon_T of that wall's temperature.
// Halo symmetry makes the predicate pair-conservative: if a pair (a, b) has
// |T_a - T_b| > epsilon_T, both a and b see it in their halos, so both are
// active. Any pair touching a dormant source therefore has |dT| <= epsilon_T,
// and skipping it on BOTH sides keeps exchange exactly antisymmetric; the
// energy not moved is bounded by conductance * epsilon_T * dt per such pair
// (the recorded debt bound). Radiation is not gated here: a stage with an
// ambient/pair radiation law keeps every source active (flag 'radiation').
//
// Temperatures are reduced per cell as order-preserving u32 keys with
// atomicMin/atomicMax (a positive f32's bits order as unsigned integers).
// Outputs: dormant[i] (1/0), counts [active, dormant, present, overflow],
// compacted active_indices[0..active-1], and indirect_dispatch [ceil(active/64), 1, 1, active]
// (yielding [0, 1, 1, 0] zero-work witness when quiescent).
const GPU_BUFFER_USAGE = Object.freeze({
  STORAGE: 0x80,
  UNIFORM: 0x40,
  COPY_SRC: 0x04,
  COPY_DST: 0x08,
  INDIRECT: 0x0100
});

export const schroederThermalDormancyWgsl = /* wgsl */ `
struct DormancyParams {
  // particle count, cells x, cells y, cells z
  counts: vec4<u32>,
  // cell edge (m), epsilon_T (K), wall support (m), radiation active (1/0)
  config: vec4<f32>,
  // grid extent x, y, z (from the origin), unused
  box: vec4<f32>,
  // wall temperatures x min, x max, y min, y max
  walls0: vec4<f32>,
  // wall temperatures z min, z max, unused, unused
  walls1: vec4<f32>,
  // temperature word offset, row stride (words), flag output word + 1
  // (0 = none), maximum-radius word + 1 (0 = none)
  temps: vec4<u32>,
  // conduction support floor (m), maximum-radius multiplier, unused, unused
  support: vec4<f32>,
  // grid origin x, y, z, unused
  origin: vec4<f32>,
  // per-source temperature uncertainty word base + 1 (0 = none), ss base spacing f32 bits,
  // ss min_level biased (i32^0x80000000), ss max_level biased (i32^0x80000000)
  uncertainty: vec4<u32>,
};
@group(0) @binding(0) var<uniform> params: DormancyParams;
@group(0) @binding(1) var<storage, read> source_state: array<vec4<f32>>;
// Temperatures as f32 bits at temps.x + i * temps.y. The thermal stage binds
// its derived buffer here: rows hold its own per-source temperature at word
// 0, the header holds its maximum particle radius, and the flags are also
// written into a tail of the same buffer the proposal kernel reads.
@group(0) @binding(2) var<storage, read_write> temperature_words: array<u32>;
@group(0) @binding(3) var<storage, read_write> cell_bounds: array<atomic<u32>>;
@group(0) @binding(4) var<storage, read_write> dormant: array<u32>;
@group(0) @binding(5) var<storage, read_write> counts: array<atomic<u32>>;
@group(0) @binding(6) var<storage, read_write> active_indices: array<u32>;
// Indirect dispatch arguments: [ceil(active / 64), 1, 1, active]
@group(0) @binding(7) var<storage, read_write> indirect_dispatch: array<u32>;

// The cell edge is at least every pair law's support: the configured floor,
// and, when the thermal stage's maximum radius is bound, max(conduction
// floor, multiplier * max radius), padded so that a partner within the
// support is never more than one cell away after f32 rounding. A nonfinite
// radius returns 0 (every source active).
fn grid_edge() -> f32 {
  var edge = params.config.x;
  if (params.temps.w != 0u) {
    let r = bitcast<f32>(temperature_words[params.temps.w - 1u]);
    if (!(r >= 0.0 && r <= 3.0e38)) { return 0.0; }
    edge = max(edge, max(params.support.x, params.support.y * r));
  }
  return edge * 1.0001;
}
fn grid_dims(edge: f32) -> vec3<i32> {
  let wanted = vec3<i32>(ceil(params.box.xyz / edge));
  return clamp(wanted, vec3<i32>(1), vec3<i32>(params.counts.yzw));
}
// Clamping is 1-Lipschitz per axis, so partners stay within one cell.
fn cell_of(p: vec3<f32>, edge: f32, dims: vec3<i32>) -> vec3<i32> {
  let c = vec3<i32>(floor((p - params.origin.xyz) / edge));
  return clamp(c, vec3<i32>(0), dims - vec3<i32>(1));
}
fn cell_index(c: vec3<i32>, dims: vec3<i32>) -> u32 {
  return u32(c.x) + u32(dims.x) * (u32(c.y) + u32(dims.y) * u32(c.z));
}
fn write_flag(i: u32, flag: u32) {
  dormant[i] = flag;
  if (params.temps.z != 0u) { temperature_words[params.temps.z - 1u + i] = flag; }
}
fn source_uncertainty(i: u32) -> f32 {
  if (params.uncertainty.x == 0u) { return 0.0; }
  return bitcast<f32>(temperature_words[params.uncertainty.x - 1u + i]);
}

@compute @workgroup_size(64)
fn reset_cells(@builtin(global_invocation_id) id: vec3<u32>) {
  let cells = params.counts.y * params.counts.z * params.counts.w;
  if (id.x < cells) {
    atomicStore(&cell_bounds[id.x * 2u], 0xffffffffu);
    atomicStore(&cell_bounds[id.x * 2u + 1u], 0u);
  }
  if (id.x < 4u) { atomicStore(&counts[id.x], 0u); }
}

@compute @workgroup_size(64)
fn scatter_temperatures(@builtin(global_invocation_id) id: vec3<u32>) {
  let i = id.x;
  if (i >= params.counts.x) { return; }
  let s0 = source_state[i * 2u];
  if (!(s0.w > 0.0)) { return; }
  let edge = grid_edge();
  if (!(edge > 0.0)) { return; }
  let dims = grid_dims(edge);
  let t = bitcast<f32>(temperature_words[params.temps.x + i * params.temps.y]);
  let dt = source_uncertainty(i);
  let c = cell_index(cell_of(s0.xyz, edge, dims), dims);
  // A present source without a positive finite temperature or valid
  // uncertainty poisons its cell (span = the whole f32 range), so every
  // source near it stays active. Otherwise scatter its conservative interval
  // [t - dt, t + dt] so halo span hi - lo >= |T_a - T_b| + dt_a + dt_b.
  let valid = t > 0.0 && t <= 3.0e38 && dt >= 0.0 && dt <= 3.0e38;
  let t_lo = select(0.0, max(1.0e-6, t - dt), valid);
  let t_hi = select(3.402823e38, min(3.0e38, t + dt), valid);
  atomicMin(&cell_bounds[c * 2u], select(0u, bitcast<u32>(t_lo), valid));
  atomicMax(&cell_bounds[c * 2u + 1u], select(0x7f7fffffu, bitcast<u32>(t_hi), valid));
}

@compute @workgroup_size(64)
fn classify_sources(@builtin(global_invocation_id) id: vec3<u32>) {
  let i = id.x;
  if (i >= params.counts.x) { return; }
  let s0 = source_state[i * 2u];
  if (!(s0.w > 0.0)) { write_flag(i, 0u); return; }
  atomicAdd(&counts[2], 1u);
  let t = bitcast<f32>(temperature_words[params.temps.x + i * params.temps.y]);
  let dt = source_uncertainty(i);
  let edge = grid_edge();
  let valid_dt = dt >= 0.0 && dt <= 3.0e38;
  var is_active = params.config.w != 0.0 || !(t > 0.0) || !valid_dt || !(edge > 0.0);
  if (!is_active) {
    let dims = grid_dims(edge);
    let c = cell_of(s0.xyz, edge, dims);
    var lo = 3.402823e38; var hi = 0.0;
    for (var dz = -1; dz <= 1; dz++) {
      for (var dy = -1; dy <= 1; dy++) {
        for (var dx = -1; dx <= 1; dx++) {
          let n = c + vec3<i32>(dx, dy, dz);
          if (any(n < vec3<i32>(0)) || any(n >= dims)) { continue; }
          let k = cell_index(n, dims);
          let lo_bits = atomicLoad(&cell_bounds[k * 2u]);
          if (lo_bits == 0xffffffffu) { continue; }
          lo = min(lo, bitcast<f32>(lo_bits));
          hi = max(hi, bitcast<f32>(atomicLoad(&cell_bounds[k * 2u + 1u])));
        }
      }
    }
    is_active = hi - lo > params.config.y;
  }
  if (!is_active) {
    // Walls within the support at a temperature outside the uncertainty-padded band.
    let p = s0.xyz - params.origin.xyz; let r = params.config.z;
    let gaps = array<f32, 6>(p.x, params.box.x - p.x, p.y, params.box.y - p.y, p.z, params.box.z - p.z);
    let temps = array<f32, 6>(params.walls0.x, params.walls0.y, params.walls0.z, params.walls0.w,
      params.walls1.x, params.walls1.y);
    for (var w = 0u; w < 6u; w++) {
      if (gaps[w] <= r && temps[w] > 0.0 && abs(temps[w] - t) + dt > params.config.y) { is_active = true; }
    }
  }
  write_flag(i, select(1u, 0u, is_active));
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
  indirect_dispatch[0] = (active_count + 63u) / 64u;
  indirect_dispatch[1] = 1u;
  indirect_dispatch[2] = 1u;
  indirect_dispatch[3] = active_count;
}
`;

// Canonical SS-directory thermal dormancy: reduces per occupied SS cell from
// SCHROEDER_SPATIAL_EPOCH_DIRECTORY_ABI (zero private dense 3D box grid, zero
// empty-space clearing, zero particle re-binning, binary-searched sorted 5-word keys).
export const schroederThermalDormancySsWgsl = /* wgsl */ `
${schroederThermalDormancyWgsl}
@group(0) @binding(8) var<storage, read> spatial_directory: array<u32>;

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
  let max_cells = min(arrayLength(&cell_bounds) / 2u, select(0u, spatial_directory[18u], ss_dir_valid()));
  if (id.x < max_cells) {
    atomicStore(&cell_bounds[id.x * 2u], 0xffffffffu);
    atomicStore(&cell_bounds[id.x * 2u + 1u], 0u);
  }
  if (id.x < 4u) { atomicStore(&counts[id.x], 0u); }
}

@compute @workgroup_size(64)
fn reduce_ss_cells(@builtin(global_invocation_id) id: vec3<u32>) {
  if (!ss_dir_valid()) { return; }
  let cell_count = min(spatial_directory[18u], arrayLength(&cell_bounds) / 2u);
  let c = id.x;
  if (c >= cell_count) { return; }
  let offsets_off = spatial_directory[30u];
  let members_off = spatial_directory[31u];
  let begin = spatial_directory[offsets_off + c];
  let end = spatial_directory[offsets_off + c + 1u];
  var lo_bits = 0xffffffffu;
  var hi_bits = 0u;
  for (var m = begin; m < end; m = m + 1u) {
    let i = spatial_directory[members_off + m];
    if (i >= params.counts.x) { continue; }
    let s0 = source_state[i * 2u];
    if (!(s0.w > 0.0)) { continue; }
    let t = bitcast<f32>(temperature_words[params.temps.x + i * params.temps.y]);
    let dt = source_uncertainty(i);
    let valid = t > 0.0 && t <= 3.0e38 && dt >= 0.0 && dt <= 3.0e38;
    let t_lo = select(0.0, max(1.0e-6, t - dt), valid);
    let t_hi = select(3.402823e38, min(3.0e38, t + dt), valid);
    lo_bits = min(lo_bits, select(0u, bitcast<u32>(t_lo), valid));
    hi_bits = max(hi_bits, select(0x7f7fffffu, bitcast<u32>(t_hi), valid));
  }
  atomicStore(&cell_bounds[c * 2u], lo_bits);
  atomicStore(&cell_bounds[c * 2u + 1u], hi_bits);
}

@compute @workgroup_size(64)
fn classify_sources_ss(@builtin(global_invocation_id) id: vec3<u32>) {
  let i = id.x;
  if (i >= params.counts.x) { return; }
  let s0 = source_state[i * 2u];
  if (!(s0.w > 0.0)) { write_flag(i, 0u); return; }
  atomicAdd(&counts[2], 1u);
  let t = bitcast<f32>(temperature_words[params.temps.x + i * params.temps.y]);
  let dt = source_uncertainty(i);
  let edge = grid_edge();
  let valid_dt = dt >= 0.0 && dt <= 3.0e38;
  let dir_ok = ss_dir_valid();
  let ss_base_spacing = bitcast<f32>(params.uncertainty.y);
  var is_active = params.config.w != 0.0 || !(t > 0.0) || !valid_dt || !(edge > 0.0) || !dir_ok || !(ss_base_spacing > 0.0);
  if (!is_active) {
    let cell_count = min(spatial_directory[18u], arrayLength(&cell_bounds) / 2u);
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
      if (params.uncertainty.z != 0u || params.uncertainty.w != 0u) {
        let cfg_min = bitcast<i32>(params.uncertainty.z ^ 0x80000000u);
        let cfg_max = bitcast<i32>(params.uncertainty.w ^ 0x80000000u);
        if (cfg_min <= cfg_max && (cfg_max - cfg_min) <= 8i) {
          min_level = min(cfg_min, self_level);
          max_level = max(cfg_max, self_level);
        }
      }
      var lo = 3.402823e38;
      var hi = 0.0;
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
        let base_cell = vec3<i32>(floor(s0.xyz / spacing_m));
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
              let lo_bits = atomicLoad(&cell_bounds[k * 2u]);
              if (lo_bits == 0xffffffffu) { continue; }
              lo = min(lo, bitcast<f32>(lo_bits));
              hi = max(hi, bitcast<f32>(atomicLoad(&cell_bounds[k * 2u + 1u])));
            }
          }
        }
      }
      is_active = halo_exceeded || (hi - lo > params.config.y);
    }
  }
  if (!is_active) {
    let p = s0.xyz - params.origin.xyz; let r = params.config.z;
    let gaps = array<f32, 6>(p.x, params.box.x - p.x, p.y, params.box.y - p.y, p.z, params.box.z - p.z);
    let temps = array<f32, 6>(params.walls0.x, params.walls0.y, params.walls0.z, params.walls0.w,
      params.walls1.x, params.walls1.y);
    for (var w = 0u; w < 6u; w++) {
      if (gaps[w] <= r && temps[w] > 0.0 && abs(temps[w] - t) + dt > params.config.y) { is_active = true; }
    }
  }
  write_flag(i, select(1u, 0u, is_active));
  if (is_active) {
    let slot = atomicAdd(&counts[0], 1u);
    active_indices[slot] = i;
  } else {
    atomicAdd(&counts[1], 1u);
  }
}
`;

/**
 * The dormancy predicate stage over caller-owned source state/thermo buffers.
 * When `spatialDirectoryBuffer` is provided at encode time (canonical SS runs),
 * executes directly over canonical SS occupied cells (zero dense 3D box grid).
 */
export function createSchroederThermalDormancyStage({ device, particleCount, boxM, cellEdgeM, epsilonK,
  wallSupportM, wallTemperaturesK = [0, 0, 0, 0, 0, 0], radiationActive = false,
  temperatureHeaderWords = 0, temperatureStrideWords = 12, temperatureWordOffset = 2,
  flagOutputWord = null, maxRadiusWord = null, uncertaintyWordOffset = null,
  supportFloorM = 0, radiusMultiplier = 0, originM = [0, 0, 0],
  canonicalSsDirectoryMode = false } = {}) {
  if (!(particleCount > 0) || !(cellEdgeM > 0) || !(epsilonK >= 0)) throw new TypeError('Dormancy needs particles, a cell edge and an epsilon');
  const cells = boxM.map(v => Math.max(1, Math.ceil(v / cellEdgeM)));
  const denseCellCount = cells[0] * cells[1] * cells[2];
  const cellCapacity = canonicalSsDirectoryMode
    ? Math.max(64, particleCount)
    : Math.max(denseCellCount, Math.min(65536, particleCount));
  const bindings = ['uniform', 'read-only-storage', 'storage', 'storage', 'storage', 'storage', 'storage', 'storage']
    .map((type, binding) => computeBufferBinding(binding, type));
  const ssBindings = [...bindings, computeBufferBinding(8, 'read-only-storage')];
  const pipelines = Object.fromEntries(['reset_cells', 'scatter_temperatures', 'classify_sources', 'finalize_dispatch'].map(entryPoint =>
    [entryPoint, createCachedExplicitComputePipeline(device, { cacheKey: `ulg-thermal-dormancy-${entryPoint}.v4`,
      label: `ulg-thermal-dormancy-${entryPoint}`, code: schroederThermalDormancyWgsl, entryPoint, bindings })]));
  let ssPipelines = null;
  function getSsPipelines() {
    if (!ssPipelines) {
      ssPipelines = Object.fromEntries(['reset_cells_ss', 'reduce_ss_cells', 'classify_sources_ss', 'finalize_dispatch'].map(entryPoint =>
        [entryPoint, createCachedExplicitComputePipeline(device, { cacheKey: `ulg-thermal-dormancy-ss-${entryPoint}.v1`,
          label: `ulg-thermal-dormancy-ss-${entryPoint}`, code: schroederThermalDormancySsWgsl, entryPoint, bindings: ssBindings })]));
    }
    return ssPipelines;
  }
  const params = device.createBuffer({ label: 'ulg-thermal-dormancy-params', size: 144, usage: GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST });
  const words = new ArrayBuffer(144), u = new Uint32Array(words), f = new Float32Array(words);
  u.set([particleCount, ...cells], 0);
  f.set([cellEdgeM, epsilonK, wallSupportM ?? cellEdgeM, radiationActive ? 1 : 0], 4);
  f.set([...boxM, 0], 8); f.set(wallTemperaturesK.slice(0, 4), 12); f.set([...wallTemperaturesK.slice(4, 6), 0, 0], 16);
  // The default (header 0, stride 12, offset 2) reads a thermo row's T
  // (vec4 row 0, lane z); the thermal stage passes its derived rows instead.
  u.set([temperatureHeaderWords + temperatureWordOffset, temperatureStrideWords,
    flagOutputWord == null ? 0 : flagOutputWord + 1, maxRadiusWord == null ? 0 : maxRadiusWord + 1], 20);
  f.set([supportFloorM, radiusMultiplier, 0, 0], 24);
  f.set([...originM, 0], 28);
  u.set([uncertaintyWordOffset == null ? 0 : uncertaintyWordOffset + 1, 0, 0, 0], 32);
  device.queue.writeBuffer(params, 0, words);
  let lastSsSpacingBits = 0;
  let lastSsMinLevelBits = 0;
  let lastSsMaxLevelBits = 0;
  const cellBounds = device.createBuffer({
    label: canonicalSsDirectoryMode ? 'ulg-thermal-dormancy-ss-cells' : 'ulg-thermal-dormancy-cells',
    size: cellCapacity * 8,
    usage: GPU_BUFFER_USAGE.STORAGE
  });
  let fallbackCellBounds = null;
  function getDenseCellBounds() {
    if (cellCapacity >= denseCellCount) return cellBounds;
    if (!fallbackCellBounds) {
      fallbackCellBounds = device.createBuffer({
        label: 'ulg-thermal-dormancy-fallback-dense-cells',
        size: denseCellCount * 8,
        usage: GPU_BUFFER_USAGE.STORAGE
      });
    }
    return fallbackCellBounds;
  }
  const dormantBuffer = device.createBuffer({ label: 'ulg-thermal-dormant', size: Math.max(16, particleCount * 4),
    usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_SRC });
  const countBuffer = device.createBuffer({ label: 'ulg-thermal-dormancy-counts', size: 16,
    usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_SRC });
  const activeIndicesBuffer = device.createBuffer({ label: 'ulg-thermal-dormancy-active-indices',
    size: Math.max(16, particleCount * 4), usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_SRC });
  const indirectDispatchBuffer = device.createBuffer({ label: 'ulg-thermal-dormancy-indirect',
    size: 16, usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.INDIRECT | GPU_BUFFER_USAGE.COPY_SRC });
  function resolveGroup(stateBuffer, temperatureBuffer) {
    return createCachedExplicitBindGroup(device, {
      label: 'ulg-thermal-dormancy-bg',
      layout: pipelines.reset_cells.bindGroupLayout,
      entries: [params, stateBuffer, temperatureBuffer, getDenseCellBounds(), dormantBuffer, countBuffer,
        activeIndicesBuffer, indirectDispatchBuffer]
        .map((buffer, binding) => ({ binding, resource: { buffer } }))
    });
  }
  function encodeIntoPass(pass, { stateBuffer, thermoBuffer, temperatureBuffer = thermoBuffer,
    spatialDirectoryBuffer = null, spatialBaseGridSpacingM = 0, spatialMinLevel = 0, spatialMaxLevel = 0 }) {
    const maxStorage = device?.limits?.maxStorageBuffersPerShaderStage;
    const useSs = Boolean(
      spatialDirectoryBuffer
      && Number(spatialBaseGridSpacingM) > 0
      && (maxStorage == null || maxStorage >= 8)
    );
    if (useSs) {
      f[33] = Number(spatialBaseGridSpacingM);
      const minLvlBits = ((Math.trunc(Number(spatialMinLevel) || 0) ^ 0x80000000) >>> 0);
      const maxLvlBits = ((Math.trunc(Number(spatialMaxLevel) || 0) ^ 0x80000000) >>> 0);
      if (u[33] !== lastSsSpacingBits || minLvlBits !== lastSsMinLevelBits || maxLvlBits !== lastSsMaxLevelBits) {
        lastSsSpacingBits = u[33];
        lastSsMinLevelBits = minLvlBits;
        lastSsMaxLevelBits = maxLvlBits;
        u[34] = minLvlBits;
        u[35] = maxLvlBits;
        device.queue.writeBuffer(params, 0, words);
      }
      const sp = getSsPipelines();
      const ssGroup = createCachedExplicitBindGroup(device, {
        label: 'ulg-thermal-dormancy-ss-bg',
        layout: sp.reset_cells_ss.bindGroupLayout,
        entries: [params, stateBuffer, temperatureBuffer, cellBounds, dormantBuffer, countBuffer,
          activeIndicesBuffer, indirectDispatchBuffer, spatialDirectoryBuffer]
          .map((buffer, binding) => ({ binding, resource: { buffer } }))
      });
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
      return;
    }
    const group = resolveGroup(stateBuffer, temperatureBuffer);
    pass.setBindGroup(0, group);
    for (const [entryPoint, groupsCount] of [
      ['reset_cells', Math.ceil(Math.max(denseCellCount, 4) / 64)],
      ['scatter_temperatures', Math.ceil(particleCount / 64)],
      ['classify_sources', Math.ceil(particleCount / 64)],
      ['finalize_dispatch', 1]
    ]) {
      pass.setPipeline(pipelines[entryPoint].pipeline);
      pass.dispatchWorkgroups(groupsCount);
    }
  }
  return Object.freeze({
    cells, canonicalSsDirectoryMode, dormantBuffer, countBuffer, activeIndicesBuffer, indirectDispatchBuffer, indirectDispatchOffset: 0,
    encodeIntoPass,
    encode(encoder, args) {
      const pass = encoder.beginComputePass({ label: 'ulg-thermal-dormancy' });
      encodeIntoPass(pass, args);
      pass.end();
    },
    destroy() {
      fallbackCellBounds?.destroy();
      for (const b of [params, cellBounds, dormantBuffer, countBuffer, activeIndicesBuffer, indirectDispatchBuffer]) b.destroy();
    }
  });
}
