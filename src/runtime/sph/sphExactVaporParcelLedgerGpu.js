import {
  acquireQueueOrderedPooledBuffer,
  computeBufferBinding,
  createCachedExplicitBindGroup,
  createCachedExplicitComputePipeline,
  registerQueueOrderedPooledBufferReturn,
  releaseOrDestroyQueueOrderedPooledBuffer
} from '../webgpuComputeLayout.js';
import { createSphExactMassWgsl } from './sphExactMassWgsl.js';
import { createSphExactLedgerWgsl } from './sphExactLedgerWgsl.js';
import { SPH_EXACT_THERMAL_ENERGY_FORMAT, SPH_EXACT_THERMAL_ENERGY_CONTROL_WORDS }
  from './sphExactThermalEnergyWgsl.js';

// G2 integer ledger, Phase 4 (plan/todo/g2-integer-ledger-proposal.md):
// vapor <-> aerosol parcel water exchange as exact packets.
//
// A parcel represents `multiplicity` identical droplets: an insoluble-plus-
// soluble dry core (constant mass, hygroscopicity kappa) and liquid water.
// Its ledger sidecar is [dry mass | water mass | water U], each one row in the
// run format; the f32 parcel fields are projections of it.
//
// Growth law (f32, per droplet), Maxwell-Mason with kappa-Koehler equilibrium:
//   dm/dt = 4 pi r (S - S_eq) / (F_k + F_d)
//   S_eq  = a_w * exp(2 sigma / (rho_w R_v T r)),
//   a_w   = (r^3 - r_d^3) / (r^3 - r_d^3 (1 - kappa))        (Petters & Kreidenweis 2007)
//   F_k   = (L / (R_v T) - 1) L / (k' T),  F_d = R_v T / (D' e_s(T))
//   D' = D_v beta(Kn, alpha_m), k' = k_a beta(Kn, alpha_T), Kn = lambda / r,
//   beta = (1 + Kn) / (1 + (4/(3 alpha) + 0.377) Kn + 4/(3 alpha) Kn^2)  (Fuchs-Sutugin)
// with benchmark property choices (see SPH_EXACT_VAPOR_PARCEL_LAW).
// Activation is not a separate rule: it is the Koehler curve's maximum.
//
// Exchange: one thread per gas cell, sequential over the cell's parcels and
// gas carriers, so every row has one writer. A parcel's packet is converted to
// quanta exactly and clamped to what the donor holds; growth draws from the
// cell's H2O vapor carriers by the remainder rule and evaporation feeds them
// back the same way. Energy follows the quasi-steady droplet of the law
// itself: water joins or leaves the parcel at the parcel's own u, and the
// latent difference from the vapor's u is exchanged with the cell's gas
// (growth warms the air, evaporation cools it). Sensible heat relaxes the
// droplets toward the gas temperature with their own exponential factor. All
// three are exact packets: sum(U) over carriers and parcels is invariant.
export const SPH_EXACT_VAPOR_PARCEL_LAW = Object.freeze({
  gasConstantVaporJPerKgK: 461.5,
  waterDensityKgPerM3: 1000,
  // sigma(T) = 0.0761 - 1.55e-4 (T - 273.15) N/m (Vargaftik et al. 1983 fit)
  surfaceTension: Object.freeze({ a: 0.0761, b: 1.55e-4 }),
  // L(T) = 2.501e6 - 2370 (T - 273.15) J/kg
  latentHeat: Object.freeze({ a: 2.501e6, b: 2370 }),
  // e_s over water, Bolton (1980): 611.2 exp(17.67 t / (t + 243.5)) Pa
  saturation: Object.freeze({ e0: 611.2, a: 17.67, b: 243.5 }),
  // D_v = 2.11e-5 (T/273.15)^1.94 (101325/p) m2/s (Pruppacher & Klett 1997)
  diffusivity: Object.freeze({ d0: 2.11e-5, exponent: 1.94, p0: 101325 }),
  // k_a = 4.1868e-3 (5.69 + 0.017 t) W/mK (Pruppacher & Klett 1997)
  conductivity: Object.freeze({ a: 5.69, b: 0.017 }),
  // lambda = 6.6e-8 (101325/p) (T/293.15) m
  meanFreePath: Object.freeze({ l0: 6.6e-8, p0: 101325, t0: 293.15 }),
  massAccommodation: 1,
  thermalAccommodation: 1,
  waterSpecificHeatJPerKgK: 4186
});
export const SPH_EXACT_VAPOR_PARCEL_ERROR = Object.freeze({ ARITHMETIC: 8192, CELL_OVERFLOW: 16384 });
export const SPH_EXACT_VAPOR_PARCEL_PARCEL_WORDS = 3 * SPH_EXACT_THERMAL_ENERGY_FORMAT.wordCount;
export const SPH_EXACT_VAPOR_PARCEL_MAX_CELL_MEMBERS = 128;
// Parcel f32 parameters, 8 floats per parcel: position xyz, multiplicity,
// dry density, kappa, temperature (projection), radius (projection).
export const SPH_EXACT_VAPOR_PARCEL_PARAM_FLOATS = 8;
const GPU_BUFFER_USAGE = Object.freeze({ STORAGE: 0x80, COPY_SRC: 0x04, COPY_DST: 0x08, UNIFORM: 0x40 });
const fail = message => { throw new TypeError(`Exact vapor-parcel ledger: ${message}`); };

/**
 * Build a custom condensable-vapor / carrier-gas Maxwell-Mason + kappa-Kohler
 * parameter set from material closures (generalizing beyond H2O-in-air while
 * keeping SPH_EXACT_VAPOR_PARCEL_LAW as the explicit H2O/air benchmark default).
 */
export function createSphExactVaporParcelLaw(overrides = {}) {
  return Object.freeze({
    ...SPH_EXACT_VAPOR_PARCEL_LAW,
    ...overrides,
    surfaceTension: Object.freeze({ ...SPH_EXACT_VAPOR_PARCEL_LAW.surfaceTension, ...(overrides.surfaceTension || {}) }),
    latentHeat: Object.freeze({ ...SPH_EXACT_VAPOR_PARCEL_LAW.latentHeat, ...(overrides.latentHeat || {}) }),
    saturation: Object.freeze({ ...SPH_EXACT_VAPOR_PARCEL_LAW.saturation, ...(overrides.saturation || {}) }),
    diffusivity: Object.freeze({ ...SPH_EXACT_VAPOR_PARCEL_LAW.diffusivity, ...(overrides.diffusivity || {}) }),
    conductivity: Object.freeze({ ...SPH_EXACT_VAPOR_PARCEL_LAW.conductivity, ...(overrides.conductivity || {}) }),
    meanFreePath: Object.freeze({ ...SPH_EXACT_VAPOR_PARCEL_LAW.meanFreePath, ...(overrides.meanFreePath || {}) })
  });
}

export function buildSphExactVaporParcelLedgerWgsl(lawConfig = SPH_EXACT_VAPOR_PARCEL_LAW) {
  const custom = createSphExactVaporParcelLaw(lawConfig);
  return sphExactVaporParcelLedgerWgsl
    .replace(`const RV: f32 = ${law.gasConstantVaporJPerKgK};`, `const RV: f32 = ${custom.gasConstantVaporJPerKgK};`)
    .replace(`const RHO_W: f32 = ${law.waterDensityKgPerM3}.0;`, `const RHO_W: f32 = ${custom.waterDensityKgPerM3};`)
    .replace(`const C_W: f32 = ${law.waterSpecificHeatJPerKgK}.0;`, `const C_W: f32 = ${custom.waterSpecificHeatJPerKgK};`);
}

const law = SPH_EXACT_VAPOR_PARCEL_LAW;
export const sphExactVaporParcelLedgerWgsl = /* wgsl */ `
${createSphExactMassWgsl(SPH_EXACT_THERMAL_ENERGY_FORMAT)}
${createSphExactLedgerWgsl(SPH_EXACT_THERMAL_ENERGY_FORMAT)}
struct ExchangeParams {
  // gas_count, parcel_count, cell_count, vapor_material_bits
  counts: vec4<u32>,
  // dims xyz, max members
  dims: vec4<u32>,
  // origin xyz, cell size
  grid: vec4<f32>,
  // dt, total pressure, water reference u at 273.15 K, unused
  physics: vec4<f32>,
};
@group(0) @binding(0) var<uniform> params: ExchangeParams;
@group(0) @binding(1) var<storage, read_write> gas_state: array<vec4<f32>>;
@group(0) @binding(2) var<storage, read> gas_thermo: array<vec4<f32>>;
@group(0) @binding(3) var<storage, read_write> gas_mass: array<u32>;
@group(0) @binding(4) var<storage, read_write> gas_energy: array<atomic<u32>>;
@group(0) @binding(5) var<storage, read_write> parcels: array<f32>;
@group(0) @binding(6) var<storage, read_write> parcel_ledger: array<u32>;
@group(0) @binding(7) var<storage, read_write> cells: array<atomic<u32>>;
@group(0) @binding(8) var<storage, read_write> rate_probe: array<f32>;
@group(0) @binding(9) var<storage, read_write> gas_mechanics: array<vec4<f32>>;

const PI: f32 = 3.14159265358979;
const RV: f32 = ${law.gasConstantVaporJPerKgK};
const RHO_W: f32 = ${law.waterDensityKgPerM3}.0;
const C_W: f32 = ${law.waterSpecificHeatJPerKgK}.0;
const MAX_MEMBERS: u32 = ${SPH_EXACT_VAPOR_PARCEL_MAX_CELL_MEMBERS}u;
const PARAM_FLOATS: u32 = ${SPH_EXACT_VAPOR_PARCEL_PARAM_FLOATS}u;
const E_ARITHMETIC: u32 = ${SPH_EXACT_VAPOR_PARCEL_ERROR.ARITHMETIC}u;
const E_OVERFLOW: u32 = ${SPH_EXACT_VAPOR_PARCEL_ERROR.CELL_OVERFLOW}u;

// cells layout: [gas counts (C) | parcel counts (C) | gas offsets (C+1) |
//   parcel offsets (C+1) | gas cursors (C) | parcel cursors (C) |
//   gas rows (G) | parcel rows (P)]
fn cell_count() -> u32 { return params.counts.z; }
fn gas_count_word(c: u32) -> u32 { return c; }
fn parcel_count_word(c: u32) -> u32 { return cell_count() + c; }
fn gas_offset_word(c: u32) -> u32 { return 2u * cell_count() + c; }
fn parcel_offset_word(c: u32) -> u32 { return 3u * cell_count() + 1u + c; }
fn gas_cursor_word(c: u32) -> u32 { return 4u * cell_count() + 2u + c; }
fn parcel_cursor_word(c: u32) -> u32 { return 5u * cell_count() + 2u + c; }
fn gas_row_word(i: u32) -> u32 { return 6u * cell_count() + 2u + i; }
fn parcel_row_word(i: u32) -> u32 { return 6u * cell_count() + 2u + params.counts.x + i; }

fn cell_of(position: vec3<f32>) -> u32 {
  let local = (position - params.grid.xyz) / params.grid.w;
  let dims = vec3<i32>(params.dims.xyz);
  let index = clamp(vec3<i32>(floor(local)), vec3<i32>(0), dims - vec3<i32>(1));
  return u32(index.x + dims.x * (index.y + dims.y * index.z));
}
fn rows() -> u32 { return params.counts.x * EM_WORDS; }
fn flag(bits: u32) { atomicOr(&gas_energy[2u * rows()], bits); }
fn load_gas_mass(row: u32) -> ExactMass {
  var v = ExactMass(); for (var i = 0u; i < EM_WORDS; i++) { v.words[i] = gas_mass[row * EM_WORDS + i]; } return v;
}
fn store_gas_mass(row: u32, v: ExactMass) { for (var i = 0u; i < EM_WORDS; i++) { gas_mass[row * EM_WORDS + i] = v.words[i]; } }
fn load_gas_energy(row: u32) -> ExactMass {
  var v = ExactMass(); for (var i = 0u; i < EM_WORDS; i++) { v.words[i] = atomicLoad(&gas_energy[row * EM_WORDS + i]); } return v;
}
fn store_gas_energy(row: u32, v: ExactMass) { for (var i = 0u; i < EM_WORDS; i++) { atomicStore(&gas_energy[row * EM_WORDS + i], v.words[i]); } }
// Parcel ledger: [dry | water | U] per parcel.
fn load_parcel(p: u32, slot: u32) -> ExactMass {
  var v = ExactMass(); let base = (p * 3u + slot) * EM_WORDS;
  for (var i = 0u; i < EM_WORDS; i++) { v.words[i] = parcel_ledger[base + i]; } return v;
}
fn store_parcel(p: u32, slot: u32, v: ExactMass) {
  let base = (p * 3u + slot) * EM_WORDS;
  for (var i = 0u; i < EM_WORDS; i++) { parcel_ledger[base + i] = v.words[i]; }
}
fn view(a: ExactMass) -> f32 { return bitcast<f32>(em_project_f32_bits(a).bits); }
fn sview(a: ExactMass) -> f32 { return bitcast<f32>(el_project_f32_bits(a).bits); }
fn quanta(x: f32) -> ExactMass {
  let r = em_from_f32_bits(bitcast<u32>(max(x, 0.0)));
  if (r.error != 0u) { flag(E_ARITHMETIC); return ExactMass(); }
  return r.value;
}
fn squanta(x: f32) -> ExactMass {
  let r = el_from_f32_bits(bitcast<u32>(x));
  if (r.error != 0u) { flag(E_ARITHMETIC); return ExactMass(); }
  return r.value;
}
fn min_exact(a: ExactMass, b: ExactMass) -> ExactMass { if (em_compare(a, b) <= 0) { return a; } return b; }
fn is_vapor(row: u32) -> bool {
  let thermo = gas_thermo[row * 3u];
  return bitcast<u32>(thermo.x) == params.counts.w && u32(thermo.y + 0.5) == 3u;
}

// ---- counting sort into cells --------------------------------------------
@compute @workgroup_size(64)
fn count_members(@builtin(global_invocation_id) id: vec3<u32>) {
  let i = id.x;
  if (i < params.counts.x && gas_state[i * 2u].w > 0.0 && u32(gas_thermo[i * 3u].y + 0.5) == 3u) {
    atomicAdd(&cells[gas_count_word(cell_of(gas_state[i * 2u].xyz))], 1u);
  }
  if (i < params.counts.y) {
    let base = i * PARAM_FLOATS;
    atomicAdd(&cells[parcel_count_word(cell_of(vec3<f32>(parcels[base], parcels[base + 1u], parcels[base + 2u])))], 1u);
  }
}
var<workgroup> scan_gas_wg: array<u32, 64>;
var<workgroup> scan_parcel_wg: array<u32, 64>;
var<workgroup> scan_gas_carry: u32;
var<workgroup> scan_parcel_carry: u32;

@compute @workgroup_size(64)
fn scan_members(@builtin(local_invocation_id) lid: vec3<u32>) {
  let lane = lid.x;
  let total_cells = cell_count();
  if (lane == 0u) {
    scan_gas_carry = 0u;
    scan_parcel_carry = 0u;
  }
  workgroupBarrier();
  let tiles = (total_cells + 63u) / 64u;
  for (var tile = 0u; tile < tiles; tile = tile + 1u) {
    let c = tile * 64u + lane;
    var gc = 0u;
    var pc = 0u;
    if (c < total_cells) {
      gc = atomicLoad(&cells[gas_count_word(c)]);
      pc = atomicLoad(&cells[parcel_count_word(c)]);
    }
    scan_gas_wg[lane] = gc;
    scan_parcel_wg[lane] = pc;
    workgroupBarrier();
    var offset = 1u;
    loop {
      if (offset >= 64u) { break; }
      var ga = 0u;
      var pa = 0u;
      if (lane >= offset) {
        ga = scan_gas_wg[lane - offset];
        pa = scan_parcel_wg[lane - offset];
      }
      workgroupBarrier();
      scan_gas_wg[lane] = scan_gas_wg[lane] + ga;
      scan_parcel_wg[lane] = scan_parcel_wg[lane] + pa;
      workgroupBarrier();
      offset = offset * 2u;
    }
    let g_carry = scan_gas_carry;
    let p_carry = scan_parcel_carry;
    if (c < total_cells) {
      let g_off = g_carry + (scan_gas_wg[lane] - gc);
      let p_off = p_carry + (scan_parcel_wg[lane] - pc);
      atomicStore(&cells[gas_offset_word(c)], g_off);
      atomicStore(&cells[parcel_offset_word(c)], p_off);
      atomicStore(&cells[gas_cursor_word(c)], g_off);
      atomicStore(&cells[parcel_cursor_word(c)], p_off);
    }
    workgroupBarrier();
    if (lane == 63u) {
      scan_gas_carry = g_carry + scan_gas_wg[63u];
      scan_parcel_carry = p_carry + scan_parcel_wg[63u];
    }
    workgroupBarrier();
  }
  if (lane == 0u) {
    atomicStore(&cells[gas_offset_word(total_cells)], scan_gas_carry);
    atomicStore(&cells[parcel_offset_word(total_cells)], scan_parcel_carry);
  }
}
@compute @workgroup_size(64)
fn scatter_members(@builtin(global_invocation_id) id: vec3<u32>) {
  let i = id.x;
  if (i < params.counts.x && gas_state[i * 2u].w > 0.0 && u32(gas_thermo[i * 3u].y + 0.5) == 3u) {
    let slot = atomicAdd(&cells[gas_cursor_word(cell_of(gas_state[i * 2u].xyz))], 1u);
    atomicStore(&cells[gas_row_word(slot)], i);
  }
  if (i < params.counts.y) {
    let base = i * PARAM_FLOATS;
    let slot = atomicAdd(&cells[parcel_cursor_word(cell_of(vec3<f32>(parcels[base], parcels[base + 1u], parcels[base + 2u])))], 1u);
    atomicStore(&cells[parcel_row_word(slot)], i);
  }
}

// ---- the f32 law ------------------------------------------------------------
fn saturation_pa(t: f32) -> f32 {
  let c = t - 273.15;
  return ${law.saturation.e0} * exp(${law.saturation.a} * c / (c + ${law.saturation.b}));
}
fn fuchs_sutugin(kn: f32, alpha: f32) -> f32 {
  let g = 4.0 / (3.0 * alpha);
  return (1.0 + kn) / (1.0 + (g + 0.377) * kn + g * kn * kn);
}
// Per-droplet mass rate (kg/s) using cell-invariant thermodynamic factors; returns S_eq in .y.
fn droplet_rate_fast(
  r: f32, r3: f32, d3: f32, kappa: f32, s: f32,
  kelvin_coeff: f32, lambda_air: f32, f_k_base: f32, f_d_base: f32
) -> vec2<f32> {
  let a_w = max(r3 - d3, 0.0) / max(r3 - d3 * (1.0 - kappa), 1.0e-36);
  let s_eq = a_w * exp(kelvin_coeff / r);
  let kn = lambda_air / r;
  let f_k = f_k_base / fuchs_sutugin(kn, ${law.thermalAccommodation}.0);
  let f_d = f_d_base / fuchs_sutugin(kn, ${law.massAccommodation}.0);
  return vec2<f32>(4.0 * PI * r * (s - s_eq) / (f_k + f_d), s_eq);
}

var<workgroup> sh_gas_rows: array<u32, MAX_MEMBERS>;
var<workgroup> sh_parcel_rows: array<u32, MAX_MEMBERS>;
var<workgroup> sh_gas_m: array<f32, MAX_MEMBERS>;
var<workgroup> sh_gas_u: array<f32, MAX_MEMBERS>;
var<workgroup> sh_gas_is_vapor: array<u32, MAX_MEMBERS>;
var<workgroup> sh_vapor_list: array<u32, MAX_MEMBERS>;
var<workgroup> sh_f0: array<f32, MAX_MEMBERS>;
var<workgroup> sh_f1: array<f32, MAX_MEMBERS>;
var<workgroup> sh_f2: array<f32, MAX_MEMBERS>;
var<workgroup> sh_f3: array<f32, MAX_MEMBERS>;
var<workgroup> sh_em: array<ExactMass, MAX_MEMBERS>;
var<workgroup> sh_gas_begin: u32;
var<workgroup> sh_parcel_begin: u32;
var<workgroup> sh_ng: u32;
var<workgroup> sh_np: u32;
var<workgroup> sh_nv: u32;
var<workgroup> sh_has_work: u32;
var<workgroup> sh_heat_to_dry_air: u32;
var<workgroup> sh_last_heat_k: u32;
var<workgroup> sh_vapor_mass: f32;
var<workgroup> sh_heat_mass_sum: f32;
var<workgroup> sh_t_air: f32;
var<workgroup> sh_saturation: f32;
var<workgroup> sh_u_vapor: f32;
var<workgroup> sh_kelvin_coeff: f32;
var<workgroup> sh_lambda_air: f32;
var<workgroup> sh_f_k_base: f32;
var<workgroup> sh_f_d_base: f32;
var<workgroup> sh_k_cond: f32;
var<workgroup> sh_total_to_gas: ExactMass;
var<workgroup> sh_to_gas_nonzero: u32;
var<workgroup> sh_any_vapor_changed: u32;

// ---- exchange: one 128-thread workgroup per cell ----------------------------
@compute @workgroup_size(128)
fn exchange_cells(
  @builtin(workgroup_id) wg_id: vec3<u32>,
  @builtin(local_invocation_id) local_id: vec3<u32>
) {
  let c = wg_id.x;
  let lid = local_id.x;
  if (c >= cell_count()) { return; }
  if (lid == 0u) {
    let gb = atomicLoad(&cells[gas_offset_word(c)]);
    let ge = atomicLoad(&cells[gas_offset_word(c + 1u)]);
    let pb = atomicLoad(&cells[parcel_offset_word(c)]);
    let pe = atomicLoad(&cells[parcel_offset_word(c + 1u)]);
    let ng = ge - gb;
    let np = pe - pb;
    sh_ng = ng;
    sh_np = np;
    sh_has_work = 0u;
    if (np > 0u && ng > 0u) {
      if (ng > MAX_MEMBERS || np > MAX_MEMBERS) {
        flag(E_OVERFLOW);
      } else {
        sh_gas_begin = gb;
        sh_parcel_begin = pb;
        sh_has_work = 1u;
      }
    }
  }
  if (workgroupUniformLoad(&sh_has_work) == 0u) { return; }
  let ng = workgroupUniformLoad(&sh_ng);
  let np = workgroupUniformLoad(&sh_np);
  let gas_begin = sh_gas_begin;
  let parcel_begin = sh_parcel_begin;

  // Deterministic ascending row order via parallel bitonic sort over 128 slots.
  sh_gas_rows[lid] = select(0xffffffffu, atomicLoad(&cells[gas_row_word(gas_begin + lid)]), lid < ng);
  sh_parcel_rows[lid] = select(0xffffffffu, atomicLoad(&cells[parcel_row_word(parcel_begin + lid)]), lid < np);
  workgroupBarrier();
  for (var k = 2u; k <= MAX_MEMBERS; k <<= 1u) {
    for (var j = k >> 1u; j > 0u; j >>= 1u) {
      let ixj = lid ^ j;
      if (ixj > lid) {
        let asc = (lid & k) == 0u;
        let ga = sh_gas_rows[lid];
        let gb_v = sh_gas_rows[ixj];
        if ((asc && ga > gb_v) || (!asc && ga < gb_v)) {
          sh_gas_rows[lid] = gb_v;
          sh_gas_rows[ixj] = ga;
        }
        let pa = sh_parcel_rows[lid];
        let pb_v = sh_parcel_rows[ixj];
        if ((asc && pa > pb_v) || (!asc && pa < pb_v)) {
          sh_parcel_rows[lid] = pb_v;
          sh_parcel_rows[ixj] = pa;
        }
      }
      workgroupBarrier();
    }
  }

  // Cell state from its gas carriers: parallel reduction across 128 threads.
  var m_i = 0.0;
  var t_i = 0.0;
  var v_m = 0.0;
  var v_u = 0.0;
  if (lid < ng) {
    let row = sh_gas_rows[lid];
    let s0 = gas_state[row * 2u];
    let s1 = gas_state[row * 2u + 1u];
    let th = gas_thermo[row * 3u];
    let vap = bitcast<u32>(th.x) == params.counts.w && u32(th.y + 0.5) == 3u;
    m_i = s0.w;
    t_i = m_i * th.z;
    sh_gas_m[lid] = m_i;
    sh_gas_u[lid] = s1.w;
    sh_gas_is_vapor[lid] = select(0u, 1u, vap);
    if (vap) {
      v_m = m_i;
      v_u = m_i * s1.w;
    }
  } else {
    sh_gas_m[lid] = 0.0;
    sh_gas_u[lid] = 0.0;
    sh_gas_is_vapor[lid] = 0u;
  }
  sh_f0[lid] = v_m;
  sh_f1[lid] = m_i;
  sh_f2[lid] = t_i;
  sh_f3[lid] = v_u;
  workgroupBarrier();
  for (var stride = 64u; stride > 0u; stride >>= 1u) {
    if (lid < stride) {
      sh_f0[lid] += sh_f0[lid + stride];
      sh_f1[lid] += sh_f1[lid + stride];
      sh_f2[lid] += sh_f2[lid + stride];
      sh_f3[lid] += sh_f3[lid + stride];
    }
    workgroupBarrier();
  }
  if (lid == 0u) {
    let vapor_mass = sh_f0[0u];
    let gas_mass_sum = sh_f1[0u];
    let t_sum = sh_f2[0u];
    let u_vapor_sum = sh_f3[0u];
    sh_has_work = select(0u, 1u, gas_mass_sum > 0.0);
    if (gas_mass_sum > 0.0) {
      let dry_mass = gas_mass_sum - vapor_mass;
      let heat_to_dry = dry_mass > 0.0;
      sh_vapor_mass = vapor_mass;
      sh_heat_to_dry_air = select(0u, 1u, heat_to_dry);
      sh_heat_mass_sum = select(gas_mass_sum, dry_mass, heat_to_dry);
      var last_heat = ng;
      var nv = 0u;
      for (var k = 0u; k < ng; k++) {
        let is_v = sh_gas_is_vapor[k] != 0u;
        if (is_v) {
          sh_vapor_list[nv] = k;
          nv++;
        }
        if (!heat_to_dry || !is_v) { last_heat = k; }
      }
      sh_nv = nv;
      sh_last_heat_k = last_heat;
      let volume = params.grid.w * params.grid.w * params.grid.w;
      let t_air = t_sum / gas_mass_sum;
      let pressure = params.physics.y;
      let c_air = t_air - 273.15;
      let es_air = saturation_pa(t_air);
      let sigma = ${law.surfaceTension.a} - ${law.surfaceTension.b} * c_air;
      let latent_h = ${law.latentHeat.a} - ${law.latentHeat.b}.0 * c_air;
      let lambda_air = ${law.meanFreePath.l0} * (${law.meanFreePath.p0}.0 / pressure) * (t_air / ${law.meanFreePath.t0});
      let d_v_base = ${law.diffusivity.d0} * pow(t_air / 273.15, ${law.diffusivity.exponent}) * (${law.diffusivity.p0}.0 / pressure);
      let k_a_base = 4.1868e-3 * (${law.conductivity.a} + ${law.conductivity.b} * c_air);
      sh_t_air = t_air;
      sh_saturation = vapor_mass * RV * t_air / volume / es_air;
      sh_u_vapor = select(0.0, u_vapor_sum / vapor_mass, vapor_mass > 0.0);
      sh_kelvin_coeff = 2.0 * sigma / (RHO_W * RV * t_air);
      sh_lambda_air = lambda_air;
      sh_f_k_base = (latent_h / (RV * t_air) - 1.0) * latent_h / (k_a_base * t_air);
      sh_f_d_base = RV * t_air / (d_v_base * es_air);
      sh_k_cond = k_a_base;
    }
  }
  if (workgroupUniformLoad(&sh_has_work) == 0u) { return; }

  // Phase A: integrate all np parcels' Maxwell-Mason ODEs in parallel across lid < np.
  let dt = params.physics.x;
  let t_air = sh_t_air;
  if (lid < np) {
    let p = sh_parcel_rows[lid];
    let pbase = p * PARAM_FLOATS;
    let multiplicity = parcels[pbase + 3u];
    let dry_density = parcels[pbase + 4u];
    let kappa = parcels[pbase + 5u];
    let dry = load_parcel(p, 0u);
    let water = load_parcel(p, 1u);
    let energy = load_parcel(p, 2u);
    let n = max(multiplicity, 1.0);
    let w_view = view(water);
    let m_w = w_view / n;
    let m_d = view(dry) / n;
    let three_over_4pi = 3.0 / (4.0 * PI);
    let v_dry = m_d / dry_density;
    let d3 = three_over_4pi * v_dry;
    let r3_0 = three_over_4pi * (m_w / RHO_W + v_dry);
    let r = pow(r3_0, 1.0 / 3.0);
    let kelvin_coeff = sh_kelvin_coeff;
    let lambda_air = sh_lambda_air;
    let f_k_base = sh_f_k_base;
    let f_d_base = sh_f_d_base;
    let saturation = sh_saturation;
    let rate0 = droplet_rate_fast(r, r3_0, d3, kappa, saturation, kelvin_coeff, lambda_air, f_k_base, f_d_base);
    rate_probe[p * 4u] = rate0.x;
    rate_probe[p * 4u + 1u] = rate0.y;
    rate_probe[p * 4u + 2u] = saturation;
    rate_probe[p * 4u + 3u] = r;
    var m_sub = m_w;
    var t_left = dt;
    var dm_droplet = 0.0;
    for (var it = 0u; it < 48u && t_left > 0.0; it++) {
      var rr = rate0.x;
      if (it > 0u) {
        let r3_sub = three_over_4pi * (m_sub / RHO_W + v_dry);
        let r_sub = pow(r3_sub, 1.0 / 3.0);
        rr = droplet_rate_fast(r_sub, r3_sub, d3, kappa, saturation, kelvin_coeff, lambda_air, f_k_base, f_d_base).x;
      }
      if (rr == 0.0) { break; }
      let tau = (m_sub + 1.0e-3 * m_d) / abs(rr);
      let h = min(t_left, 0.25 * tau);
      var dm = rr * h;
      if (m_sub + dm < 0.0) { dm = -m_sub; }
      m_sub += dm;
      dm_droplet += dm;
      t_left -= h;
    }
    let u_parcel = select(params.physics.z + C_W * (t_air - 273.15), sview(energy) / max(w_view, 1.0e-36), w_view > 0.0);
    sh_f0[lid] = dm_droplet / dt;
    sh_f1[lid] = r;
    sh_f2[lid] = u_parcel;
    sh_f3[lid] = m_d;
  }
  workgroupBarrier();

  // Phase B: exact vapor packet exchange in deterministic parcel order (touching only vapor rows),
  // accumulating exact dry-air heat transfer across all parcels for a single parallel pass.
  if (lid == 0u) {
    let nv = sh_nv;
    let vapor_mass = sh_vapor_mass;
    let u_vapor = sh_u_vapor;
    let heat_to_dry = sh_heat_to_dry_air != 0u;
    let heat_mass_sum = sh_heat_mass_sum;
    let last_heat_k = sh_last_heat_k;
    let lambda_air = sh_lambda_air;
    let k_cond = sh_k_cond;
    var total_to_gas = ExactMass();
    var any_vapor_changed = 0u;
    for (var q = 0u; q < np; q++) {
      let p = sh_parcel_rows[q];
      let pbase = p * PARAM_FLOATS;
      let n = max(parcels[pbase + 3u], 1.0);
      let dry_density = parcels[pbase + 4u];
      var water = load_parcel(p, 1u);
      var energy = load_parcel(p, 2u);
      let rate_x = sh_f0[q];
      let r = sh_f1[q];
      let u_parcel = sh_f2[q];
      let m_d = sh_f3[q];
      var latent = ExactMass();
      if (rate_x > 0.0 && nv > 0u) {
        var want = quanta(rate_x * n * dt);
        for (var vi = 0u; vi < nv && !em_zero(want); vi++) {
          let k = sh_vapor_list[vi];
          let row = sh_gas_rows[k];
          let held = load_gas_mass(row);
          let take = min_exact(want, held);
          if (em_zero(take)) { continue; }
          let e_held = load_gas_energy(row);
          var e_take = squanta(view(take) * sh_gas_u[k]);
          if (em_compare(take, held) == 0) { e_take = e_held; }
          let e_parcel = squanta(view(take) * u_parcel);
          store_gas_mass(row, em_subtract(held, take).value);
          store_gas_energy(row, el_subtract(e_held, e_take).value);
          water = em_add(water, take).value;
          energy = el_add(energy, e_parcel).value;
          latent = el_add(latent, el_subtract(e_take, e_parcel).value).value;
          want = em_subtract(want, take).value;
          any_vapor_changed = 1u;
        }
      } else if (rate_x < 0.0 && vapor_mass > 0.0 && nv > 0u) {
        let give = min_exact(quanta(-rate_x * n * dt), water);
        if (!em_zero(give)) {
          var e_give = squanta(view(give) * u_parcel);
          if (em_compare(give, water) == 0) { e_give = energy; }
          let e_vapor_total = squanta(view(give) * u_vapor);
          var left = give;
          var e_left = e_vapor_total;
          let last_vi = nv - 1u;
          for (var vi = 0u; vi < nv; vi++) {
            let k = sh_vapor_list[vi];
            let row = sh_gas_rows[k];
            var part = left;
            var e_part = e_left;
            if (vi != last_vi) {
              part = min_exact(quanta(view(give) * sh_gas_m[k] / vapor_mass), left);
              e_part = squanta(view(part) * u_vapor);
            }
            store_gas_mass(row, em_add(load_gas_mass(row), part).value);
            store_gas_energy(row, el_add(load_gas_energy(row), e_part).value);
            left = em_subtract(left, part).value;
            e_left = el_subtract(e_left, e_part).value;
          }
          water = em_subtract(water, give).value;
          energy = el_subtract(energy, e_give).value;
          latent = el_subtract(e_give, e_vapor_total).value;
          any_vapor_changed = 1u;
        }
      }
      let m_water_now = view(water);
      var heat = 0.0;
      if (m_water_now > 0.0) {
        let t_drop = 273.15 + (sview(energy) / m_water_now - params.physics.z) / C_W;
        let capacity = m_water_now * C_W;
        let kn = lambda_air / r;
        let conductance = 4.0 * PI * r * k_cond * fuchs_sutugin(kn, ${law.thermalAccommodation}.0) * n;
        heat = (t_air - t_drop) * capacity * (1.0 - exp(-dt * conductance / capacity));
      }
      let sensible = squanta(heat);
      energy = el_add(energy, sensible).value;
      let to_gas = el_subtract(latent, sensible).value;
      if (heat_to_dry) {
        if (!em_zero(to_gas)) {
          let acc = el_add(total_to_gas, to_gas);
          if (acc.error != 0u) { flag(E_ARITHMETIC); }
          total_to_gas = acc.value;
        }
      } else if (!em_zero(to_gas)) {
        // Pure-vapor cell (no dry air): apply per-parcel so any subsequent full drain sees updated e_held.
        let to_gas_f = sview(to_gas);
        var gas_left = to_gas;
        for (var k = 0u; k < ng; k++) {
          let row = sh_gas_rows[k];
          var part = gas_left;
          if (k != last_heat_k) { part = squanta(to_gas_f * sh_gas_m[k] / heat_mass_sum); }
          store_gas_energy(row, el_add(load_gas_energy(row), part).value);
          gas_left = el_subtract(gas_left, part).value;
        }
        any_vapor_changed = 1u;
      }
      if (m_water_now > 0.0) {
        parcels[pbase + 6u] = 273.15 + (sview(energy) / m_water_now - params.physics.z) / C_W;
      }
      store_parcel(p, 1u, water);
      store_parcel(p, 2u, energy);
      let m_w_now = m_water_now / n;
      parcels[pbase + 7u] = pow(3.0 * (m_w_now / RHO_W + m_d / dry_density) / (4.0 * PI), 1.0 / 3.0);
    }
    sh_total_to_gas = total_to_gas;
    sh_to_gas_nonzero = select(0u, 1u, !em_zero(total_to_gas));
    sh_any_vapor_changed = any_vapor_changed;
  }
  storageBarrier();
  let to_gas_nz = workgroupUniformLoad(&sh_to_gas_nonzero);
  let any_vap = workgroupUniformLoad(&sh_any_vapor_changed);

  // Parallel exact remainder-rule distribution of accumulated dry-air heat (1 pass over ng threads).
  if (to_gas_nz != 0u) {
    let total_to_gas = sh_total_to_gas;
    let to_gas_f = sview(total_to_gas);
    let last_heat_k = sh_last_heat_k;
    let heat_mass_sum = sh_heat_mass_sum;
    let is_heat_row = lid < ng && (sh_heat_to_dry_air == 0u || sh_gas_is_vapor[lid] == 0u);
    var my_part = ExactMass();
    if (is_heat_row && lid != last_heat_k) {
      my_part = squanta(to_gas_f * sh_gas_m[lid] / heat_mass_sum);
    }
    sh_em[lid] = my_part;
    workgroupBarrier();
    for (var stride = 64u; stride > 0u; stride >>= 1u) {
      if (lid < stride) {
        let sum = el_add(sh_em[lid], sh_em[lid + stride]);
        if (sum.error != 0u) { flag(E_ARITHMETIC); }
        sh_em[lid] = sum.value;
      }
      workgroupBarrier();
    }
    if (is_heat_row) {
      if (lid == last_heat_k) {
        let rem = el_subtract(total_to_gas, sh_em[0u]);
        if (rem.error != 0u) { flag(E_ARITHMETIC); }
        my_part = rem.value;
      }
      if (!em_zero(my_part)) {
        let row = sh_gas_rows[lid];
        let next_e = el_add(load_gas_energy(row), my_part);
        if (next_e.error != 0u) { flag(E_ARITHMETIC); }
        store_gas_energy(row, next_e.value);
      }
    }
  }

  // Phase C: parallel f32 projection of touched gas rows across lid < ng.
  if ((any_vap | to_gas_nz) != 0u && lid < ng) {
    let row = sh_gas_rows[lid];
    let m = view(load_gas_mass(row));
    let state0 = gas_state[row * 2u];
    let state1 = gas_state[row * 2u + 1u];
    if (bitcast<u32>(state0.w) != bitcast<u32>(m) && state0.w > 0.0) {
      let m4 = gas_mechanics[row * 8u + 4u];
      gas_mechanics[row * 8u + 4u] = vec4<f32>(m4.xyz, m4.w * m / state0.w);
      let m7 = gas_mechanics[row * 8u + 7u];
      gas_mechanics[row * 8u + 7u] = vec4<f32>(m7.xyz, m);
    }
    gas_state[row * 2u] = vec4<f32>(state0.xyz, m);
    let projected_u = select(state1.w, sview(load_gas_energy(row)) / m, m > 0.0);
    let ulps = abs(bitcast<i32>(projected_u) - bitcast<i32>(state1.w));
    let keep = (projected_u >= 0.0) == (state1.w >= 0.0) && ulps <= 8;
    gas_state[row * 2u + 1u] = vec4<f32>(state1.xyz, select(projected_u, state1.w, keep));
  }
}
`;

/** Prepares the exchange passes over existing buffers. The caller owns them. */
export function createSphExactVaporParcelExchangeStage({ device, gasCount, parcelCount, dims, origin, cellSizeM,
  vaporMaterialId, pressurePa, waterReferenceU0, gasStateBuffer, gasThermoBuffer, gasMassBuffer, gasEnergyBuffer,
  parcelBuffer, parcelLedgerBuffer, gasMechanicsBuffer = null, gasMassRange = null } = {}) {
  const cellCount = dims[0] * dims[1] * dims[2];
  if (!(cellCount > 0) || !(gasCount > 0) || !(parcelCount >= 0) || !(cellSizeM > 0)) fail('grid and counts required');
  const useQueueOrderedPool = Boolean(
    typeof globalThis.GPUDevice === 'function'
    && device instanceof globalThis.GPUDevice
  );
  const alloc = (label, size, usage) => (
    useQueueOrderedPool
      ? registerQueueOrderedPooledBufferReturn(
          acquireQueueOrderedPooledBuffer(device, { bucketKey: label, label, size, usage }),
          device,
          { bucketKey: label, size, usage }
        )
      : device.createBuffer({ label, size, usage })
  );
  const cellWords = 6 * cellCount + 2 + gasCount + parcelCount;
  const cells = alloc('ulg-exact-vapor-parcel-cells', cellWords * 4,
    GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_DST);
  const probe = alloc('ulg-exact-vapor-parcel-rate-probe', Math.max(parcelCount, 1) * 16,
    GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_SRC | (useQueueOrderedPool ? GPU_BUFFER_USAGE.COPY_DST : 0));
  const params = alloc('ulg-exact-vapor-parcel-params', 64,
    GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST);
  const words = new ArrayBuffer(64), u = new Uint32Array(words), f = new Float32Array(words);
  u.set([gasCount, parcelCount, cellCount, new Uint32Array(new Float32Array([vaporMaterialId]).buffer)[0]], 0);
  u.set([dims[0], dims[1], dims[2], SPH_EXACT_VAPOR_PARCEL_MAX_CELL_MEMBERS], 4);
  f.set([origin[0], origin[1], origin[2], cellSizeM], 8);
  f.set([0, pressurePa, waterReferenceU0, 0], 12);
  const bindings = ['uniform', 'storage', 'read-only-storage', 'storage', 'storage', 'storage', 'storage', 'storage', 'storage',
    'storage'].map((type, binding) => computeBufferBinding(binding, type));
  const pipelines = Object.fromEntries(['count_members', 'scan_members', 'scatter_members', 'exchange_cells'].map(entryPoint =>
    [entryPoint, createCachedExplicitComputePipeline(device, { cacheKey: `ulg-exact-vapor-parcel-${entryPoint}.v2`,
      label: `ulg-exact-vapor-parcel-${entryPoint}`, code: sphExactVaporParcelLedgerWgsl, entryPoint, bindings })]));
  // Without a mechanics buffer (unit fixtures) the lanes go to a scratch row set.
  const scratchMechanics = gasMechanicsBuffer ? null : device.createBuffer({ label: 'ulg-exact-vapor-parcel-mechanics-scratch',
    size: gasCount * 128, usage: GPU_BUFFER_USAGE.STORAGE });
  const bindGroup = createCachedExplicitBindGroup(device, { layout: pipelines.exchange_cells.bindGroupLayout, entries: [params,
    gasStateBuffer, gasThermoBuffer, gasMassBuffer, gasEnergyBuffer, parcelBuffer, parcelLedgerBuffer, cells, probe,
    gasMechanicsBuffer ?? scratchMechanics]
    .map((buffer, binding) => ({ binding, resource: binding === 3 && gasMassRange
      ? { buffer, offset: gasMassRange.offset, size: gasMassRange.size } : { buffer } })) });
  const members = Math.max(gasCount, parcelCount);
  let encoded = false;
  return Object.freeze({
    probeBuffer: probe,
    encode(encoder, dt) {
      encoded = true;
      f[12] = dt; device.queue.writeBuffer(params, 0, words);
      encoder.clearBuffer(cells);
      if (useQueueOrderedPool) encoder.clearBuffer(probe);
      for (const [name, groups] of [['count_members', Math.ceil(members / 64)], ['scan_members', 1],
        ['scatter_members', Math.ceil(members / 64)], ['exchange_cells', cellCount]]) {
        const pass = encoder.beginComputePass({ label: `ulg-exact-vapor-parcel-${name}` });
        pass.setPipeline(pipelines[name].pipeline); pass.setBindGroup(0, bindGroup);
        pass.dispatchWorkgroups(groups); pass.end();
      }
    },
    destroy() {
      releaseOrDestroyQueueOrderedPooledBuffer(cells, { allowPool: encoded });
      releaseOrDestroyQueueOrderedPooledBuffer(probe, { allowPool: encoded });
      releaseOrDestroyQueueOrderedPooledBuffer(params, { allowPool: encoded });
      scratchMechanics?.destroy();
    }
  });
}

/** f64 host evaluation of the same per-droplet law, for the gate's rate check. */
export function sphExactVaporParcelDropletRate({ r, rDry, kappa, t, p, s, law: customLaw = null }) {
  const activeLaw = customLaw ? createSphExactVaporParcelLaw(customLaw) : law;
  const c = t - 273.15;
  const sigma = activeLaw.surfaceTension.a - activeLaw.surfaceTension.b * c;
  const latent = activeLaw.latentHeat.a - activeLaw.latentHeat.b * c;
  const r3 = r ** 3, d3 = rDry ** 3;
  const aw = Math.max(r3 - d3, 0) / Math.max(r3 - d3 * (1 - kappa), 1e-36);
  const sEq = aw * Math.exp(2 * sigma / (activeLaw.waterDensityKgPerM3 * activeLaw.gasConstantVaporJPerKgK * t * r));
  const lambda = activeLaw.meanFreePath.l0 * (activeLaw.meanFreePath.p0 / p) * (t / activeLaw.meanFreePath.t0);
  const kn = lambda / r;
  const fs = alpha => { const g = 4 / (3 * alpha); return (1 + kn) / (1 + (g + 0.377) * kn + g * kn * kn); };
  const dv = activeLaw.diffusivity.d0 * (t / 273.15) ** activeLaw.diffusivity.exponent * (activeLaw.diffusivity.p0 / p) * fs(activeLaw.massAccommodation);
  const ka = 4.1868e-3 * (activeLaw.conductivity.a + activeLaw.conductivity.b * c) * fs(activeLaw.thermalAccommodation);
  const es = activeLaw.saturation.e0 * Math.exp(activeLaw.saturation.a * c / (c + activeLaw.saturation.b));
  const fk = (latent / (activeLaw.gasConstantVaporJPerKgK * t) - 1) * latent / (ka * t);
  const fd = activeLaw.gasConstantVaporJPerKgK * t / (dv * es);
  return { rate: 4 * Math.PI * r * (s - sEq) / (fk + fd), sEq, saturationPa: es };
}
export { SPH_EXACT_THERMAL_ENERGY_CONTROL_WORDS };
