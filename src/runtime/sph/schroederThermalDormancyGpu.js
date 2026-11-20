import { computeBufferBinding, createCachedExplicitComputePipeline } from '../webgpuComputeLayout.js';

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
// Outputs: dormant[i] (1/0) and counts [active, dormant, present, overflow].
const GPU_BUFFER_USAGE = Object.freeze({ STORAGE: 0x80, UNIFORM: 0x40, COPY_SRC: 0x04, COPY_DST: 0x08 });

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
  // per-source temperature uncertainty word base + 1 (0 = none), unused...
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
  atomicAdd(&counts[select(1u, 0u, is_active)], 1u);
}
`;

/**
 * The dormancy predicate stage over caller-owned source state/thermo buffers.
 * `cellEdgeM` must be at least the conduction support so every conduction
 * partner lies in the 3x3x3 halo.
 */
export function createSchroederThermalDormancyStage({ device, particleCount, boxM, cellEdgeM, epsilonK,
  wallSupportM, wallTemperaturesK = [0, 0, 0, 0, 0, 0], radiationActive = false,
  temperatureHeaderWords = 0, temperatureStrideWords = 12, temperatureWordOffset = 2,
  flagOutputWord = null, maxRadiusWord = null, uncertaintyWordOffset = null,
  supportFloorM = 0, radiusMultiplier = 0, originM = [0, 0, 0] } = {}) {
  if (!(particleCount > 0) || !(cellEdgeM > 0) || !(epsilonK >= 0)) throw new TypeError('Dormancy needs particles, a cell edge and an epsilon');
  const cells = boxM.map(v => Math.max(1, Math.ceil(v / cellEdgeM)));
  const cellCount = cells[0] * cells[1] * cells[2];
  const bindings = ['uniform', 'read-only-storage', 'storage', 'storage', 'storage', 'storage']
    .map((type, binding) => computeBufferBinding(binding, type));
  const pipelines = Object.fromEntries(['reset_cells', 'scatter_temperatures', 'classify_sources'].map(entryPoint =>
    [entryPoint, createCachedExplicitComputePipeline(device, { cacheKey: `ulg-thermal-dormancy-${entryPoint}.v3`,
      label: `ulg-thermal-dormancy-${entryPoint}`, code: schroederThermalDormancyWgsl, entryPoint, bindings })]));
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
  const cellBounds = device.createBuffer({ label: 'ulg-thermal-dormancy-cells', size: cellCount * 8, usage: GPU_BUFFER_USAGE.STORAGE });
  const dormantBuffer = device.createBuffer({ label: 'ulg-thermal-dormant', size: Math.max(16, particleCount * 4),
    usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_SRC });
  const countBuffer = device.createBuffer({ label: 'ulg-thermal-dormancy-counts', size: 16,
    usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_SRC });
  const groups = new Map();
  return Object.freeze({
    cells, dormantBuffer, countBuffer,
    encode(encoder, { stateBuffer, thermoBuffer, temperatureBuffer = thermoBuffer }) {
      let group = groups.get(stateBuffer)?.get(temperatureBuffer);
      if (!group) {
        group = device.createBindGroup({ layout: pipelines.reset_cells.bindGroupLayout,
          entries: [params, stateBuffer, temperatureBuffer, cellBounds, dormantBuffer, countBuffer]
            .map((buffer, binding) => ({ binding, resource: { buffer } })) });
        if (groups.size > 8) groups.clear();
        if (!groups.has(stateBuffer)) groups.set(stateBuffer, new Map());
        groups.get(stateBuffer).set(temperatureBuffer, group);
      }
      for (const [entryPoint, count] of [['reset_cells', Math.max(cellCount, 4)], ['scatter_temperatures', particleCount],
        ['classify_sources', particleCount]]) {
        const pass = encoder.beginComputePass({ label: `ulg-thermal-dormancy-${entryPoint}` });
        pass.setPipeline(pipelines[entryPoint].pipeline); pass.setBindGroup(0, group);
        pass.dispatchWorkgroups(Math.ceil(count / 64)); pass.end();
      }
    },
    destroy() { for (const b of [params, cellBounds, dormantBuffer, countBuffer]) b.destroy(); }
  });
}
