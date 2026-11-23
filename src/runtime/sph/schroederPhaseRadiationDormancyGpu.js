import { computeBufferBinding, createCachedExplicitComputePipeline } from '../webgpuComputeLayout.js';

// G4 Slice 2.3 (plan/CURRENT-PLAN.md, plan/todo/g4-dynamic-laws-proposal.md):
// Conservative per-node envelope masks and compacted GPU indirect dispatch for
// Phase Change and Thermal Radiation laws, carrying G6/A4 per-source
// temperature uncertainty intervals dT >= 0.
//
// Both stages execute in ONE WebGPU compute pass and emit:
//   - dormant[i] in {0, 1} (1 = provably dormant, 0 = active or absent)
//   - countBuffer: [active, dormant, present, overflow, dispatchX, 1, 1, active]
//     with GPUBufferUsage.INDIRECT so downstream law kernels dispatch via
//     pass.dispatchWorkgroupsIndirect(stage.indirectDispatchBuffer, stage.indirectDispatchOffset),
//     launching literally 0 workgroups ([0, 1, 1]) when quiescent.
//   - activeIndicesBuffer: compacted [0..active-1] particle indices.
const GPU_BUFFER_USAGE = Object.freeze({
  STORAGE: 0x80,
  UNIFORM: 0x40,
  COPY_SRC: 0x04,
  COPY_DST: 0x08,
  INDIRECT: 0x0100
});

export const STEFAN_BOLTZMANN_W_PER_M2_K4 = 5.670374419e-8;

export const schroederPhaseDormancyWgsl = /* wgsl */ `
struct PhaseDormancyParams {
  // particle_count, window_count, state_stride_vec4, thermo_stride_vec4
  counts: vec4<u32>,
  // epsilon_K, uncertainty_enabled (1/0), uncertainty_word_offset, unused
  config: vec4<f32>,
  // front_enabled (1/0), front_header_words, front_row_words, front_epoch
  front: vec4<u32>,
};
@group(0) @binding(0) var<uniform> params: PhaseDormancyParams;
@group(0) @binding(1) var<storage, read> source_state: array<vec4<f32>>;
@group(0) @binding(2) var<storage, read> source_thermo: array<vec4<f32>>;
// Per-material phase window rows: [material_id, melt_T_K (<=0 none), boil_T_K (<=0 none), unused]
@group(0) @binding(3) var<storage, read> phase_windows: array<vec4<f32>>;
@group(0) @binding(4) var<storage, read> temperature_uncertainty: array<f32>;
@group(0) @binding(5) var<storage, read_write> dormant: array<u32>;
// [active, dormant, present, overflow, dispatchX, dispatchY, dispatchZ, activeCopy]
@group(0) @binding(6) var<storage, read_write> counts: array<atomic<u32>>;
@group(0) @binding(7) var<storage, read_write> active_indices: array<u32>;
// Optional thermal interface skin-front buffer (stamp word at front_row + 19).
@group(0) @binding(8) var<storage, read> interface_front: array<u32>;

fn finite(v: f32) -> bool { return v == v && abs(v) <= 3.402823e38; }

fn uncertainty_of(i: u32) -> f32 {
  if (params.config.y <= 0.5) { return 0.0; }
  let offset = u32(max(0.0, params.config.z));
  let idx = offset + i;
  if (idx >= arrayLength(&temperature_uncertainty)) { return 0.0; }
  return temperature_uncertainty[idx];
}

fn has_interface_front(i: u32) -> bool {
  if (params.front.x == 0u || params.front.w == 0u || params.front.z < 24u) { return false; }
  let row = params.front.y + i * params.front.z;
  if (row + 20u > arrayLength(&interface_front)) { return false; }
  let stamp = interface_front[row + 19u];
  if (params.front.w == 0xffffffffu) { return stamp != 0u; }
  return (stamp >> 3u) == params.front.w;
}

@compute @workgroup_size(64)
fn reset_counts(@builtin(global_invocation_id) id: vec3<u32>) {
  if (id.x < 8u) { atomicStore(&counts[id.x], 0u); }
}

@compute @workgroup_size(64)
fn classify_phase(@builtin(global_invocation_id) id: vec3<u32>) {
  let i = id.x;
  if (i >= params.counts.x) { return; }
  let s0 = source_state[i * params.counts.z];
  if (!(s0.w > 0.0)) { dormant[i] = 0u; return; }
  atomicAdd(&counts[2], 1u);
  let row0 = source_thermo[i * params.counts.w];
  let row1 = source_thermo[i * params.counts.w + 1u];
  let mat = row0.x;
  let phase = row0.y;
  let t = row0.z;
  let dt = uncertainty_of(i);
  var is_active = !(finite(mat) && finite(phase) && finite(t) && t > 0.0 && finite(dt) && dt >= 0.0)
    || has_interface_front(i);
  if (!is_active) {
    // Coexistence / mixed phase is ALWAYS active (must track latent heat & phase transfer).
    let pure_solid = phase == 1.0 && row1.x == 1.0 && row1.y == 0.0 && row1.z == 0.0;
    let pure_liquid = phase == 2.0 && row1.y == 1.0 && row1.x == 0.0 && row1.z == 0.0;
    let pure_gas = phase == 3.0 && row1.z == 1.0 && row1.x == 0.0 && row1.y == 0.0;
    if (!(pure_solid || pure_liquid || pure_gas)) {
      is_active = true;
    } else {
      var found = false;
      var t_melt = 0.0;
      var t_boil = 0.0;
      for (var w = 0u; w < params.counts.y; w++) {
        let row = phase_windows[w];
        if (row.x == mat) {
          found = true;
          t_melt = row.y;
          t_boil = row.z;
          break;
        }
      }
      if (!found) {
        is_active = true;
      } else {
        let margin = dt + params.config.x;
        let t_lo = t - margin;
        let t_hi = t + margin;
        if (pure_solid) {
          if (t_melt > 0.0 && t_hi >= t_melt) { is_active = true; }
          if (t_melt <= 0.0 && t_boil > 0.0 && t_hi >= t_boil) { is_active = true; }
        } else if (pure_liquid) {
          if ((t_melt > 0.0 && t_lo <= t_melt) || (t_boil > 0.0 && t_hi >= t_boil)) { is_active = true; }
        } else {
          // pure_gas
          if (t_boil > 0.0 && t_lo <= t_boil) { is_active = true; }
          else if (t_boil <= 0.0 && t_melt > 0.0 && t_lo <= t_melt) { is_active = true; }
        }
      }
    }
  }
  dormant[i] = select(1u, 0u, is_active);
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

export const schroederRadiationDormancyWgsl = /* wgsl */ `
struct RadiationDormancyParams {
  // particle_count, emissivity_count, state_stride_vec4, thermo_stride_vec4
  counts: vec4<u32>,
  // epsilon_flux_W_per_m2, uncertainty_enabled (1/0), ambient_T_K, sigma_sb
  config: vec4<f32>,
  // wall temperatures xMin, xMax, yMin, yMax (0 = adiabatic/disabled)
  walls0: vec4<f32>,
  // wall temperatures zMin, zMax, unused, unused
  walls1: vec4<f32>,
};
@group(0) @binding(0) var<uniform> params: RadiationDormancyParams;
@group(0) @binding(1) var<storage, read> source_state: array<vec4<f32>>;
@group(0) @binding(2) var<storage, read> source_thermo: array<vec4<f32>>;
// Per-material emissivity rows: [material_id, emissivity (0..1), unused, unused]
@group(0) @binding(3) var<storage, read> emissivity_table: array<vec4<f32>>;
@group(0) @binding(4) var<storage, read> temperature_uncertainty: array<f32>;
@group(0) @binding(5) var<storage, read_write> dormant: array<u32>;
// [0..3]: [active, dormant, present, overflow]
// [4..7]: [dispatchX, dispatchY, dispatchZ, activeCopy]
// [8..9]: [global_min_T_lo_bits, global_max_T_hi_bits]
@group(0) @binding(6) var<storage, read_write> counts_and_env: array<atomic<u32>>;
@group(0) @binding(7) var<storage, read_write> active_indices: array<u32>;

fn finite(v: f32) -> bool { return v == v && abs(v) <= 3.402823e38; }

fn uncertainty_of(i: u32) -> f32 {
  if (params.config.y <= 0.5 || i >= arrayLength(&temperature_uncertainty)) { return 0.0; }
  return temperature_uncertainty[i];
}

fn emissivity_for(material: f32) -> f32 {
  for (var r = 0u; r < params.counts.y; r++) {
    let row = emissivity_table[r];
    if (row.x == material) { return clamp(row.y, 0.0, 1.0); }
  }
  // Conservative default for unknown materials: blackbody emissivity = 1.0.
  return 1.0;
}

// Factored |a^4 - b^4| = |a - b| * (a + b) * (a^2 + b^2): avoids f32
// catastrophic cancellation and GPU FMA contraction when a == b.
fn diff_pow4(a: f32, b: f32) -> f32 {
  let d = abs(a - b);
  if (d == 0.0) { return 0.0; }
  return d * (a + b) * (a * a + b * b);
}

@compute @workgroup_size(64)
fn reset_envelope(@builtin(global_invocation_id) id: vec3<u32>) {
  if (id.x < 8u) { atomicStore(&counts_and_env[id.x], 0u); }
  if (id.x == 8u) { atomicStore(&counts_and_env[8], 0xffffffffu); }
  if (id.x == 9u) { atomicStore(&counts_and_env[9], 0u); }
}

@compute @workgroup_size(64)
fn reduce_envelope(@builtin(global_invocation_id) id: vec3<u32>) {
  let i = id.x;
  if (i >= params.counts.x) { return; }
  let s0 = source_state[i * params.counts.z];
  if (!(s0.w > 0.0)) { return; }
  let t = source_thermo[i * params.counts.w].z;
  let dt = uncertainty_of(i);
  let valid = finite(t) && t > 0.0 && t <= 3.0e38 && finite(dt) && dt >= 0.0 && dt <= 3.0e38;
  let t_lo = select(0.0, max(1.0e-6, t - dt), valid);
  let t_hi = select(3.402823e38, min(3.0e38, t + dt), valid);
  atomicMin(&counts_and_env[8], select(0u, bitcast<u32>(t_lo), valid));
  atomicMax(&counts_and_env[9], select(0x7f7fffffu, bitcast<u32>(t_hi), valid));
}

@compute @workgroup_size(64)
fn classify_radiation(@builtin(global_invocation_id) id: vec3<u32>) {
  let i = id.x;
  if (i >= params.counts.x) { return; }
  let s0 = source_state[i * params.counts.z];
  if (!(s0.w > 0.0)) { dormant[i] = 0u; return; }
  atomicAdd(&counts_and_env[2], 1u);
  let row0 = source_thermo[i * params.counts.w];
  let t = row0.z;
  let dt = uncertainty_of(i);
  var is_active = !(finite(t) && t > 0.0 && t <= 3.0e38 && finite(dt) && dt >= 0.0 && dt <= 3.0e38);
  if (!is_active) {
    let eps = emissivity_for(row0.x);
    if (eps > 0.0) {
      let min_bits = atomicLoad(&counts_and_env[8]);
      let max_bits = atomicLoad(&counts_and_env[9]);
      var env_min = select(bitcast<f32>(min_bits), 0.0, min_bits == 0xffffffffu);
      var env_max = bitcast<f32>(max_bits);
      let walls = array<f32, 7>(
        params.walls0.x, params.walls0.y, params.walls0.z, params.walls0.w,
        params.walls1.x, params.walls1.y, params.config.z
      );
      for (var w = 0u; w < 7u; w++) {
        let tw = walls[w];
        if (tw > 0.0) {
          env_min = min(env_min, tw);
          env_max = max(env_max, tw);
        }
      }
      let t_lo = max(0.0, t - dt);
      let t_hi = t + dt;
      let diff_hi = diff_pow4(t_hi, env_min);
      let diff_lo = diff_pow4(env_max, t_lo);
      let flux_bound = eps * params.config.w * max(diff_hi, diff_lo);
      if (!(flux_bound <= params.config.x)) { is_active = true; }
    }
  }
  dormant[i] = select(1u, 0u, is_active);
  if (is_active) {
    let slot = atomicAdd(&counts_and_env[0], 1u);
    active_indices[slot] = i;
  } else {
    atomicAdd(&counts_and_env[1], 1u);
  }
}

@compute @workgroup_size(1)
fn finalize_dispatch() {
  let active_count = atomicLoad(&counts_and_env[0]);
  atomicStore(&counts_and_env[4], (active_count + 63u) / 64u);
  atomicStore(&counts_and_env[5], 1u);
  atomicStore(&counts_and_env[6], 1u);
  atomicStore(&counts_and_env[7], active_count);
}
`;

/** Pack material phase-window records: [{ materialId, meltTemperatureK, boilTemperatureK }]. */
export function packSchroederPhaseWindows(rows = []) {
  const out = new Float32Array(Math.max(1, rows.length) * 4);
  rows.forEach((row, index) => {
    out.set([
      Number(row.materialId) || 0,
      Number(row.meltTemperatureK) > 0 ? Number(row.meltTemperatureK) : 0,
      Number(row.boilTemperatureK) > 0 ? Number(row.boilTemperatureK) : 0,
      0
    ], index * 4);
  });
  return out;
}

/** Pack material emissivity records: [{ materialId, emissivity }]. */
export function packSchroederRadiationEmissivityRows(rows = []) {
  const out = new Float32Array(Math.max(1, rows.length) * 4);
  rows.forEach((row, index) => {
    out.set([
      Number(row.materialId) || 0,
      Number.isFinite(Number(row.emissivity)) ? Number(row.emissivity) : 1,
      0,
      0
    ], index * 4);
  });
  return out;
}

/**
 * Derive phase-window rows directly from arbitrary runtime material property
 * closures (`stableOpticalMaterialId(key)` + solid->liquid / liquid->gas transitions).
 */
export function phaseWindowsFromMaterialProperties(materialPropertiesByKey, stableMaterialIdFn) {
  const rows = [];
  for (const [key, props] of Object.entries(materialPropertiesByKey || {})) {
    const transitions = Array.isArray(props?.transitions) ? props.transitions : [];
    const melt = transitions.find((t) => t.from === 'solid' && t.to === 'liquid')?.temperatureK ?? 0;
    const boil = transitions.find((t) => t.from === 'liquid' && t.to === 'gas')?.temperatureK
      ?? transitions.find((t) => t.from === 'solid' && t.to === 'gas')?.temperatureK
      ?? 0;
    rows.push({
      materialId: stableMaterialIdFn(key),
      meltTemperatureK: Number(melt) > 0 ? Number(melt) : 0,
      boilTemperatureK: Number(boil) > 0 ? Number(boil) : 0
    });
  }
  return rows;
}

function minPositive(current, candidate) {
  if (!(candidate > 0)) return current;
  return current > 0 ? Math.min(current, candidate) : candidate;
}

function explicitBoilingExcessJs(tRef, pRef, hFg, dCp, rGas, vLiq, temperature, pressure) {
  const dt = temperature - tRef;
  return Math.log(pRef)
    + (hFg / rGas) * (dt / tRef) / temperature
    + (dCp / rGas) * (Math.log(1 + dt / tRef) - dt / temperature)
    + vLiq * (pressure - pRef) / (rGas * temperature)
    - Math.log(pressure);
}

/**
 * Derive conservative phase-window rows directly from any runtime
 * `thermalMaterialTable` (arbitrary elements, compounds, or random pairs).
 */
export function phaseWindowsFromThermalMaterialTable(
  thermalMaterialTable,
  { absolutePressureAuthority = false } = {}
) {
  const byMat = new Map();
  const entryFor = (matId) => {
    let entry = byMat.get(matId);
    if (!entry) {
      entry = { materialId: matId, meltTemperatureK: 0, boilTemperatureK: 0, liquidLo: 0, liquidHi: 0 };
      byMat.set(matId, entry);
    }
    return entry;
  };
  const segments = thermalMaterialTable?.segments;
  if (segments instanceof Float32Array) {
    for (let i = 0; i + 11 < segments.length; i += 12) {
      const matId = segments[i];
      const segType = Math.round(segments[i + 1]);
      const fromPhase = Math.round(segments[i + 2]);
      const toPhase = Math.round(segments[i + 3]);
      const tLo = segments[i + 6];
      const tHi = segments[i + 7];
      if (!(matId > 0)) continue;
      const entry = entryFor(matId);
      if (segType === 2) {
        if ((fromPhase === 1 && toPhase === 2) || (fromPhase === 2 && toPhase === 1)) {
          entry.meltTemperatureK = minPositive(entry.meltTemperatureK, tLo);
        } else if ((fromPhase === 2 && toPhase === 3) || (fromPhase === 1 && toPhase === 3)) {
          entry.boilTemperatureK = minPositive(entry.boilTemperatureK, tLo);
        }
      } else if (segType >= 3 && fromPhase === 2 && toPhase === 2 && tHi > tLo && tLo > 0) {
        entry.liquidLo = minPositive(entry.liquidLo, tLo);
        entry.liquidHi = Math.max(entry.liquidHi, tHi);
      }
    }
  }
  const records = thermalMaterialTable?.records;
  if (records instanceof Float32Array) {
    for (let i = 0; i + 7 < records.length; i += 8) {
      const matId = records[i];
      if (!(matId > 0)) continue;
      const entry = entryFor(matId);
      const pressureLawId = Math.round(records[i + 5]);
      const fusionT = records[i + 7];
      if (pressureLawId === 2 && fusionT > 0) {
        entry.meltTemperatureK = minPositive(entry.meltTemperatureK, fusionT);
      }
    }
  }
  const vap = thermalMaterialTable?.explicitVaporizationRecords;
  if (vap instanceof Float32Array) {
    for (let i = 0; i + 7 < vap.length; i += 8) {
      const matId = vap[i];
      const tRef = vap[i + 1];
      const pRef = vap[i + 2];
      const hFg = vap[i + 3];
      const dCp = vap[i + 4];
      const rGas = vap[i + 5];
      const vLiq = vap[i + 6];
      const pTarget = vap[i + 7];
      if (!(matId > 0) || !(pTarget > 0)) continue;
      const entry = entryFor(matId);
      if (absolutePressureAuthority) {
        // Under live low/variable absolute pressure, boiling can occur down to
        // the lower liquid branch bound; stay strictly conservative.
        entry.boilTemperatureK = minPositive(entry.boilTemperatureK, entry.liquidLo || entry.meltTemperatureK || tRef);
      } else if (entry.liquidHi > entry.liquidLo && entry.liquidLo > 0) {
        let lo = entry.liquidLo;
        let hi = entry.liquidHi;
        const exLo = explicitBoilingExcessJs(tRef, pRef, hFg, dCp, rGas, vLiq, lo, pTarget);
        const exHi = explicitBoilingExcessJs(tRef, pRef, hFg, dCp, rGas, vLiq, hi, pTarget);
        if (exLo > 0) {
          entry.boilTemperatureK = minPositive(entry.boilTemperatureK, lo);
        } else if (exHi > 0) {
          for (let iter = 0; iter < 40; iter += 1) {
            const mid = 0.5 * (lo + hi);
            if (explicitBoilingExcessJs(tRef, pRef, hFg, dCp, rGas, vLiq, mid, pTarget) > 0) hi = mid;
            else lo = mid;
          }
          entry.boilTemperatureK = minPositive(entry.boilTemperatureK, Math.max(1e-3, lo - 1e-3));
        } else {
          entry.boilTemperatureK = minPositive(entry.boilTemperatureK, Math.max(1e-3, entry.liquidHi - 1e-3));
        }
      } else {
        entry.boilTemperatureK = minPositive(entry.boilTemperatureK, Math.max(1e-3, tRef - 1e-3));
      }
    }
  }
  return Array.from(byMat.values(), ({ materialId, meltTemperatureK, boilTemperatureK }) => ({
    materialId,
    meltTemperatureK,
    boilTemperatureK
  }));
}

/** Single-pass GPU phase-change dormancy stage with compacted indirect dispatch. */
export function createSchroederPhaseDormancyStage({
  device,
  particleCount,
  phaseWindows = [],
  epsilonK = 0,
  stateStrideVec4s = 2,
  thermoStrideVec4s = 3,
  frontEnabled = false,
  frontHeaderWords = 0,
  frontRowWords = 0,
  frontEpoch = 0xffffffff
} = {}) {
  if (!(particleCount > 0) || !(epsilonK >= 0)) {
    throw new TypeError('Phase dormancy needs a positive particleCount and non-negative epsilonK');
  }
  const packedWindows = phaseWindows instanceof Float32Array ? phaseWindows : packSchroederPhaseWindows(phaseWindows);
  const windowCount = phaseWindows instanceof Float32Array ? phaseWindows.length / 4 : phaseWindows.length;
  const bindings = ['uniform', 'read-only-storage', 'read-only-storage', 'read-only-storage', 'read-only-storage',
    'storage', 'storage', 'storage', 'read-only-storage'].map((type, binding) => computeBufferBinding(binding, type));
  const pipelines = Object.fromEntries(['reset_counts', 'classify_phase', 'finalize_dispatch'].map((entryPoint) => [
    entryPoint,
    createCachedExplicitComputePipeline(device, {
      cacheKey: `ulg-phase-dormancy-${entryPoint}.v2`,
      label: `ulg-phase-dormancy-${entryPoint}`,
      code: schroederPhaseDormancyWgsl,
      entryPoint,
      bindings
    })
  ]));
  const params = device.createBuffer({
    label: 'ulg-phase-dormancy-params',
    size: 48,
    usage: GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST
  });
  const words = new ArrayBuffer(48);
  const u = new Uint32Array(words);
  const f = new Float32Array(words);
  u.set([particleCount, windowCount, stateStrideVec4s, thermoStrideVec4s], 0);
  f.set([epsilonK, 0, 0, 0], 4);
  u.set([frontEnabled ? 1 : 0, frontHeaderWords >>> 0, frontRowWords >>> 0, frontEpoch >>> 0], 8);
  device.queue.writeBuffer(params, 0, words);
  const windowsBuffer = device.createBuffer({
    label: 'ulg-phase-dormancy-windows',
    size: Math.max(16, packedWindows.byteLength),
    usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_DST
  });
  device.queue.writeBuffer(windowsBuffer, 0, packedWindows);
  const dormantBuffer = device.createBuffer({
    label: 'ulg-phase-dormant',
    size: Math.max(16, particleCount * 4),
    usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_SRC
  });
  const countBuffer = device.createBuffer({
    label: 'ulg-phase-dormancy-counts',
    size: 32,
    usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.INDIRECT | GPU_BUFFER_USAGE.COPY_SRC
  });
  const activeIndicesBuffer = device.createBuffer({
    label: 'ulg-phase-dormancy-active-indices',
    size: Math.max(16, particleCount * 4),
    usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_SRC
  });
  const uncertaintyPlaceholder = device.createBuffer({
    label: 'ulg-phase-dormancy-uncertainty-placeholder',
    size: 16,
    usage: GPU_BUFFER_USAGE.STORAGE
  });
  const frontPlaceholder = device.createBuffer({
    label: 'ulg-phase-dormancy-front-placeholder',
    size: 16,
    usage: GPU_BUFFER_USAGE.STORAGE
  });
  let group = null;
  let groupKey = null;
  let lastUncertaintyFlag = 0;
  let lastUncertaintyOffset = 0;
  function encodeIntoPass(pass, {
    stateBuffer,
    thermoBuffer,
    uncertaintyBuffer = null,
    uncertaintyWordOffset = 0,
    interfaceFrontBuffer = null
  }) {
    const hasUncertainty = uncertaintyBuffer ? 1 : 0;
    const uOffset = Math.max(0, Math.trunc(Number(uncertaintyWordOffset) || 0));
    if (hasUncertainty !== lastUncertaintyFlag || uOffset !== lastUncertaintyOffset) {
      lastUncertaintyFlag = hasUncertainty;
      lastUncertaintyOffset = uOffset;
      f[5] = hasUncertainty;
      f[6] = uOffset;
      device.queue.writeBuffer(params, 0, words);
    }
    const boundUncertainty = uncertaintyBuffer ?? uncertaintyPlaceholder;
    const boundFront = interfaceFrontBuffer ?? frontPlaceholder;
    if (
      !group
      || groupKey[0] !== stateBuffer
      || groupKey[1] !== thermoBuffer
      || groupKey[2] !== boundUncertainty
      || groupKey[3] !== boundFront
    ) {
      group = device.createBindGroup({
        layout: pipelines.reset_counts.bindGroupLayout,
        entries: [params, stateBuffer, thermoBuffer, windowsBuffer, boundUncertainty, dormantBuffer, countBuffer,
          activeIndicesBuffer, boundFront].map((buffer, binding) => ({ binding, resource: { buffer } }))
      });
      groupKey = [stateBuffer, thermoBuffer, boundUncertainty, boundFront];
    }
    pass.setBindGroup(0, group);
    pass.setPipeline(pipelines.reset_counts.pipeline);
    pass.dispatchWorkgroups(1);
    pass.setPipeline(pipelines.classify_phase.pipeline);
    pass.dispatchWorkgroups(Math.ceil(particleCount / 64));
    pass.setPipeline(pipelines.finalize_dispatch.pipeline);
    pass.dispatchWorkgroups(1);
  }
  return Object.freeze({
    dormantBuffer,
    countBuffer,
    activeIndicesBuffer,
    indirectDispatchBuffer: countBuffer,
    indirectDispatchOffset: 16,
    encodeIntoPass,
    encode(encoder, args) {
      const pass = encoder.beginComputePass({ label: 'ulg-phase-dormancy' });
      encodeIntoPass(pass, args);
      pass.end();
    },
    destroy() {
      for (const b of [
        params, windowsBuffer, dormantBuffer, countBuffer, activeIndicesBuffer,
        uncertaintyPlaceholder, frontPlaceholder
      ]) b.destroy();
    }
  });
}

/** Single-pass GPU radiation dormancy stage with compacted indirect dispatch. */
export function createSchroederRadiationDormancyStage({
  device,
  particleCount,
  emissivityRows = [],
  wallTemperaturesK = [0, 0, 0, 0, 0, 0],
  ambientTemperatureK = 0,
  epsilonFluxWPerM2 = 0,
  stateStrideVec4s = 2,
  thermoStrideVec4s = 3
} = {}) {
  if (!(particleCount > 0) || !(epsilonFluxWPerM2 >= 0)) {
    throw new TypeError('Radiation dormancy needs a positive particleCount and non-negative epsilonFluxWPerM2');
  }
  const packedEmissivity = emissivityRows instanceof Float32Array
    ? emissivityRows
    : packSchroederRadiationEmissivityRows(emissivityRows);
  const emissivityCount = emissivityRows instanceof Float32Array ? emissivityRows.length / 4 : emissivityRows.length;
  const bindings = ['uniform', 'read-only-storage', 'read-only-storage', 'read-only-storage', 'read-only-storage',
    'storage', 'storage', 'storage'].map((type, binding) => computeBufferBinding(binding, type));
  const pipelines = Object.fromEntries(['reset_envelope', 'reduce_envelope', 'classify_radiation', 'finalize_dispatch']
    .map((entryPoint) => [
      entryPoint,
      createCachedExplicitComputePipeline(device, {
        cacheKey: `ulg-radiation-dormancy-${entryPoint}.v2`,
        label: `ulg-radiation-dormancy-${entryPoint}`,
        code: schroederRadiationDormancyWgsl,
        entryPoint,
        bindings
      })
    ]));
  const params = device.createBuffer({
    label: 'ulg-radiation-dormancy-params',
    size: 64,
    usage: GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST
  });
  const words = new ArrayBuffer(64);
  const u = new Uint32Array(words);
  const f = new Float32Array(words);
  u.set([particleCount, emissivityCount, stateStrideVec4s, thermoStrideVec4s], 0);
  f.set([epsilonFluxWPerM2, 0, Number(ambientTemperatureK) > 0 ? Number(ambientTemperatureK) : 0, STEFAN_BOLTZMANN_W_PER_M2_K4], 4);
  f.set(wallTemperaturesK.slice(0, 4).map((v) => (Number(v) > 0 ? Number(v) : 0)), 8);
  f.set([...wallTemperaturesK.slice(4, 6).map((v) => (Number(v) > 0 ? Number(v) : 0)), 0, 0], 12);
  device.queue.writeBuffer(params, 0, words);
  const emissivityBuffer = device.createBuffer({
    label: 'ulg-radiation-dormancy-emissivity',
    size: Math.max(16, packedEmissivity.byteLength),
    usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_DST
  });
  device.queue.writeBuffer(emissivityBuffer, 0, packedEmissivity);
  const dormantBuffer = device.createBuffer({
    label: 'ulg-radiation-dormant',
    size: Math.max(16, particleCount * 4),
    usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_SRC
  });
  // 10 u32s = 40 bytes ([active, dormant, present, overflow], [dx, dy, dz, active], [minT, maxT]).
  const countBuffer = device.createBuffer({
    label: 'ulg-radiation-dormancy-counts',
    size: 40,
    usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.INDIRECT | GPU_BUFFER_USAGE.COPY_SRC
  });
  const activeIndicesBuffer = device.createBuffer({
    label: 'ulg-radiation-dormancy-active-indices',
    size: Math.max(16, particleCount * 4),
    usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_SRC
  });
  const uncertaintyPlaceholder = device.createBuffer({
    label: 'ulg-radiation-dormancy-uncertainty-placeholder',
    size: 16,
    usage: GPU_BUFFER_USAGE.STORAGE
  });
  let group = null;
  let groupKey = null;
  let lastUncertaintyFlag = 0;
  function encodeIntoPass(pass, { stateBuffer, thermoBuffer, uncertaintyBuffer = null }) {
    const hasUncertainty = uncertaintyBuffer ? 1 : 0;
    if (hasUncertainty !== lastUncertaintyFlag) {
      lastUncertaintyFlag = hasUncertainty;
      f[5] = hasUncertainty;
      device.queue.writeBuffer(params, 0, words);
    }
    const boundUncertainty = uncertaintyBuffer ?? uncertaintyPlaceholder;
    if (!group || groupKey[0] !== stateBuffer || groupKey[1] !== thermoBuffer || groupKey[2] !== boundUncertainty) {
      group = device.createBindGroup({
        layout: pipelines.reset_envelope.bindGroupLayout,
        entries: [params, stateBuffer, thermoBuffer, emissivityBuffer, boundUncertainty, dormantBuffer, countBuffer,
          activeIndicesBuffer].map((buffer, binding) => ({ binding, resource: { buffer } }))
      });
      groupKey = [stateBuffer, thermoBuffer, boundUncertainty];
    }
    pass.setBindGroup(0, group);
    pass.setPipeline(pipelines.reset_envelope.pipeline);
    pass.dispatchWorkgroups(1);
    pass.setPipeline(pipelines.reduce_envelope.pipeline);
    pass.dispatchWorkgroups(Math.ceil(particleCount / 64));
    pass.setPipeline(pipelines.classify_radiation.pipeline);
    pass.dispatchWorkgroups(Math.ceil(particleCount / 64));
    pass.setPipeline(pipelines.finalize_dispatch.pipeline);
    pass.dispatchWorkgroups(1);
  }
  return Object.freeze({
    dormantBuffer,
    countBuffer,
    activeIndicesBuffer,
    indirectDispatchBuffer: countBuffer,
    indirectDispatchOffset: 16,
    encodeIntoPass,
    encode(encoder, args) {
      const pass = encoder.beginComputePass({ label: 'ulg-radiation-dormancy' });
      encodeIntoPass(pass, args);
      pass.end();
    },
    destroy() {
      for (const b of [params, emissivityBuffer, dormantBuffer, countBuffer, activeIndicesBuffer, uncertaintyPlaceholder]) b.destroy();
    }
  });
}

export const schroederDerivedRadiationDormancyWgsl = /* wgsl */ `
struct DerivedRadiationDormancyParams {
  // particle_count, temp_offset_words, stride_words, emissivity_offset_words
  layout0: vec4<u32>,
  // flag_output_word_plus_1, flag_bit_mask, uncertainty_word_plus_1, flag_row_offset_words
  layout1: vec4<u32>,
  // epsilon_flux_W_per_m2, ambient_T_K, sigma_sb, unused
  config: vec4<f32>,
  // walls xMin, xMax, yMin, yMax
  walls0: vec4<f32>,
  // walls zMin, zMax, unused, unused
  walls1: vec4<f32>,
};
@group(0) @binding(0) var<uniform> params: DerivedRadiationDormancyParams;
@group(0) @binding(1) var<storage, read> source_state: array<vec4<f32>>;
@group(0) @binding(2) var<storage, read_write> derived_words: array<u32>;
@group(0) @binding(3) var<storage, read_write> dormant: array<u32>;
// [0..3]: [active, dormant, present, overflow]
// [4..7]: [dispatchX, dispatchY, dispatchZ, activeCopy]
// [8..9]: [global_min_T_lo_bits, global_max_T_hi_bits]
@group(0) @binding(4) var<storage, read_write> counts_and_env: array<atomic<u32>>;
@group(0) @binding(5) var<storage, read_write> active_indices: array<u32>;

fn finite(v: f32) -> bool { return v == v && abs(v) <= 3.402823e38; }

fn diff_pow4(a: f32, b: f32) -> f32 {
  let d = abs(a - b);
  if (d == 0.0) { return 0.0; }
  return d * (a + b) * (a * a + b * b);
}

fn source_uncertainty(i: u32) -> f32 {
  if (params.layout1.z == 0u) { return 0.0; }
  let idx = params.layout1.z - 1u + i;
  if (idx >= arrayLength(&derived_words)) { return 0.0; }
  return bitcast<f32>(derived_words[idx]);
}

@compute @workgroup_size(64)
fn reset_envelope(@builtin(global_invocation_id) id: vec3<u32>) {
  if (id.x < 8u) { atomicStore(&counts_and_env[id.x], 0u); }
  if (id.x == 8u) { atomicStore(&counts_and_env[8], 0xffffffffu); }
  if (id.x == 9u) { atomicStore(&counts_and_env[9], 0u); }
}

@compute @workgroup_size(64)
fn reduce_envelope(@builtin(global_invocation_id) id: vec3<u32>) {
  let i = id.x;
  if (i >= params.layout0.x) { return; }
  let s0 = source_state[i * 2u];
  if (!(s0.w > 0.0)) { return; }
  let row_base = params.layout0.y + i * params.layout0.z;
  let t = bitcast<f32>(derived_words[row_base]);
  let eps = bitcast<f32>(derived_words[row_base + params.layout0.w]);
  let dt = source_uncertainty(i);
  let valid_eps = finite(eps) && eps >= 0.0;
  if (valid_eps && eps == 0.0) { return; }
  let valid = valid_eps && finite(t) && t > 0.0 && t <= 3.0e38 && finite(dt) && dt >= 0.0 && dt <= 3.0e38;
  let t_lo = select(0.0, max(1.0e-6, t - dt), valid);
  let t_hi = select(3.402823e38, min(3.0e38, t + dt), valid);
  atomicMin(&counts_and_env[8], select(0u, bitcast<u32>(t_lo), valid));
  atomicMax(&counts_and_env[9], select(0x7f7fffffu, bitcast<u32>(t_hi), valid));
}

@compute @workgroup_size(64)
fn classify_radiation(@builtin(global_invocation_id) id: vec3<u32>) {
  let i = id.x;
  if (i >= params.layout0.x) { return; }
  let s0 = source_state[i * 2u];
  if (!(s0.w > 0.0)) { dormant[i] = 0u; return; }
  atomicAdd(&counts_and_env[2], 1u);
  let row_base = params.layout0.y + i * params.layout0.z;
  let t = bitcast<f32>(derived_words[row_base]);
  let eps = bitcast<f32>(derived_words[row_base + params.layout0.w]);
  let dt = source_uncertainty(i);
  var is_active = !(finite(t) && t > 0.0 && t <= 3.0e38 && finite(eps) && eps >= 0.0 && finite(dt) && dt >= 0.0 && dt <= 3.0e38);
  if (!is_active && eps > 0.0) {
    let clamped_eps = min(eps, 1.0);
    let min_bits = atomicLoad(&counts_and_env[8]);
    let max_bits = atomicLoad(&counts_and_env[9]);
    var env_min = select(bitcast<f32>(min_bits), 0.0, min_bits == 0xffffffffu);
    var env_max = bitcast<f32>(max_bits);
    let walls = array<f32, 7>(
      params.walls0.x, params.walls0.y, params.walls0.z, params.walls0.w,
      params.walls1.x, params.walls1.y, params.config.y
    );
    for (var w = 0u; w < 7u; w++) {
      let tw = walls[w];
      if (tw > 0.0) {
        env_min = min(env_min, tw);
        env_max = max(env_max, tw);
      }
    }
    let t_lo = max(0.0, t - dt);
    let t_hi = t + dt;
    let flux_bound = clamped_eps * params.config.z * max(diff_pow4(t_hi, env_min), diff_pow4(env_max, t_lo));
    if (!(flux_bound <= params.config.x)) { is_active = true; }
  }
  let flag = select(1u, 0u, is_active);
  dormant[i] = flag;
  if (params.layout1.w != 0u) {
    let f_idx = row_base + params.layout1.w;
    if (f_idx < arrayLength(&derived_words)) {
      derived_words[f_idx] = flag;
    }
  } else if (params.layout1.x != 0u) {
    let f_idx = params.layout1.x - 1u + i;
    if (f_idx < arrayLength(&derived_words)) {
      let mask = params.layout1.y;
      derived_words[f_idx] = select(derived_words[f_idx] | mask, derived_words[f_idx] & (~mask), is_active);
    }
  }
  if (is_active) {
    let slot = atomicAdd(&counts_and_env[0], 1u);
    active_indices[slot] = i;
  } else {
    atomicAdd(&counts_and_env[1], 1u);
  }
}

@compute @workgroup_size(1)
fn finalize_dispatch() {
  let active_count = atomicLoad(&counts_and_env[0]);
  atomicStore(&counts_and_env[4], (active_count + 63u) / 64u);
  atomicStore(&counts_and_env[5], 1u);
  atomicStore(&counts_and_env[6], 1u);
  atomicStore(&counts_and_env[7], active_count);
}
`;

/**
 * Canonical derived-buffer radiation dormancy stage for the live thermal
 * proposal hot loop: shares the `ulg-thermal-dormancy` compute pass (zero
 * extra passes), reads fresh derived T/emissivity/dT, sets bit 1 on the
 * dormancy flag tail, and emits compacted active indices + indirect dispatch.
 */
export function createSchroederDerivedRadiationDormancyStage({
  device,
  particleCount,
  temperatureHeaderWords = 0,
  temperatureStrideWords = 24,
  temperatureWordOffset = 0,
  emissivityWordOffset = 3,
  flagOutputWord = null,
  flagRowWordOffset = 0,
  flagBitMask = 2,
  uncertaintyWordOffset = null,
  epsilonFluxWPerM2 = 0,
  wallTemperaturesK = [0, 0, 0, 0, 0, 0],
  ambientTemperatureK = 0
} = {}) {
  if (!(particleCount > 0) || !(epsilonFluxWPerM2 >= 0)) {
    throw new TypeError('Derived radiation dormancy needs positive particleCount and non-negative epsilonFluxWPerM2');
  }
  const bindings = ['uniform', 'read-only-storage', 'storage', 'storage', 'storage', 'storage']
    .map((type, binding) => computeBufferBinding(binding, type));
  const pipelines = Object.fromEntries(['reset_envelope', 'reduce_envelope', 'classify_radiation', 'finalize_dispatch']
    .map((entryPoint) => [
      entryPoint,
      createCachedExplicitComputePipeline(device, {
        cacheKey: `ulg-derived-radiation-dormancy-${entryPoint}.v2`,
        label: `ulg-derived-radiation-dormancy-${entryPoint}`,
        code: schroederDerivedRadiationDormancyWgsl,
        entryPoint,
        bindings
      })
    ]));
  const params = device.createBuffer({
    label: 'ulg-derived-radiation-dormancy-params',
    size: 80,
    usage: GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST
  });
  const words = new ArrayBuffer(80);
  const u = new Uint32Array(words);
  const f = new Float32Array(words);
  u.set([
    particleCount,
    temperatureHeaderWords + temperatureWordOffset,
    temperatureStrideWords,
    emissivityWordOffset
  ], 0);
  u.set([
    flagOutputWord == null ? 0 : flagOutputWord + 1,
    flagBitMask >>> 0,
    uncertaintyWordOffset == null ? 0 : uncertaintyWordOffset + 1,
    flagRowWordOffset >>> 0
  ], 4);
  f.set([
    epsilonFluxWPerM2,
    Number(ambientTemperatureK) > 0 ? Number(ambientTemperatureK) : 0,
    STEFAN_BOLTZMANN_W_PER_M2_K4,
    0
  ], 8);
  f.set(wallTemperaturesK.slice(0, 4).map((v) => (Number(v) > 0 ? Number(v) : 0)), 12);
  f.set([...wallTemperaturesK.slice(4, 6).map((v) => (Number(v) > 0 ? Number(v) : 0)), 0, 0], 16);
  device.queue.writeBuffer(params, 0, words);
  const dormantBuffer = device.createBuffer({
    label: 'ulg-derived-radiation-dormant',
    size: Math.max(16, particleCount * 4),
    usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_SRC
  });
  const countBuffer = device.createBuffer({
    label: 'ulg-derived-radiation-dormancy-counts',
    size: 40,
    usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.INDIRECT | GPU_BUFFER_USAGE.COPY_SRC
  });
  const activeIndicesBuffer = device.createBuffer({
    label: 'ulg-derived-radiation-dormancy-active-indices',
    size: Math.max(16, particleCount * 4),
    usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_SRC
  });
  const groups = new Map();
  function encodeIntoPass(pass, { stateBuffer, derivedBuffer }) {
    let group = groups.get(stateBuffer)?.get(derivedBuffer);
    if (!group) {
      group = device.createBindGroup({
        layout: pipelines.reset_envelope.bindGroupLayout,
        entries: [params, stateBuffer, derivedBuffer, dormantBuffer, countBuffer, activeIndicesBuffer]
          .map((buffer, binding) => ({ binding, resource: { buffer } }))
      });
      if (groups.size > 8) groups.clear();
      if (!groups.has(stateBuffer)) groups.set(stateBuffer, new Map());
      groups.get(stateBuffer).set(derivedBuffer, group);
    }
    pass.setBindGroup(0, group);
    pass.setPipeline(pipelines.reset_envelope.pipeline);
    pass.dispatchWorkgroups(1);
    pass.setPipeline(pipelines.reduce_envelope.pipeline);
    pass.dispatchWorkgroups(Math.ceil(particleCount / 64));
    pass.setPipeline(pipelines.classify_radiation.pipeline);
    pass.dispatchWorkgroups(Math.ceil(particleCount / 64));
    pass.setPipeline(pipelines.finalize_dispatch.pipeline);
    pass.dispatchWorkgroups(1);
  }
  return Object.freeze({
    dormantBuffer,
    countBuffer,
    activeIndicesBuffer,
    indirectDispatchBuffer: countBuffer,
    indirectDispatchOffset: 16,
    encodeIntoPass,
    encode(encoder, args) {
      const pass = encoder.beginComputePass({ label: 'ulg-derived-radiation-dormancy' });
      encodeIntoPass(pass, args);
      pass.end();
    },
    destroy() {
      for (const b of [params, dormantBuffer, countBuffer, activeIndicesBuffer]) b.destroy();
    }
  });
}
