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
@compute @workgroup_size(1)
fn scan_members() {
  var gas_total = 0u; var parcel_total = 0u;
  for (var c = 0u; c < cell_count(); c++) {
    atomicStore(&cells[gas_offset_word(c)], gas_total);
    atomicStore(&cells[parcel_offset_word(c)], parcel_total);
    atomicStore(&cells[gas_cursor_word(c)], gas_total);
    atomicStore(&cells[parcel_cursor_word(c)], parcel_total);
    gas_total += atomicLoad(&cells[gas_count_word(c)]);
    parcel_total += atomicLoad(&cells[parcel_count_word(c)]);
  }
  atomicStore(&cells[gas_offset_word(cell_count())], gas_total);
  atomicStore(&cells[parcel_offset_word(cell_count())], parcel_total);
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
// Per-droplet mass rate (kg/s); also returns S_eq in .y.
fn droplet_rate(r: f32, r_dry: f32, kappa: f32, t: f32, p: f32, s: f32) -> vec2<f32> {
  let c = t - 273.15;
  let sigma = ${law.surfaceTension.a} - ${law.surfaceTension.b} * c;
  let latent = ${law.latentHeat.a} - ${law.latentHeat.b}.0 * c;
  let r3 = r * r * r; let d3 = r_dry * r_dry * r_dry;
  let a_w = max(r3 - d3, 0.0) / max(r3 - d3 * (1.0 - kappa), 1.0e-36);
  let s_eq = a_w * exp(2.0 * sigma / (RHO_W * RV * t * r));
  let lambda = ${law.meanFreePath.l0} * (${law.meanFreePath.p0}.0 / p) * (t / ${law.meanFreePath.t0});
  let kn = lambda / r;
  let d_v = ${law.diffusivity.d0} * pow(t / 273.15, ${law.diffusivity.exponent}) * (${law.diffusivity.p0}.0 / p)
    * fuchs_sutugin(kn, ${law.massAccommodation}.0);
  let k_a = 4.1868e-3 * (${law.conductivity.a} + ${law.conductivity.b} * c) * fuchs_sutugin(kn, ${law.thermalAccommodation}.0);
  let f_k = (latent / (RV * t) - 1.0) * latent / (k_a * t);
  let f_d = RV * t / (d_v * saturation_pa(t));
  return vec2<f32>(4.0 * PI * r * (s - s_eq) / (f_k + f_d), s_eq);
}

// ---- exchange: one thread per cell ------------------------------------------
@compute @workgroup_size(64)
fn exchange_cells(@builtin(global_invocation_id) id: vec3<u32>) {
  let c = id.x;
  if (c >= cell_count()) { return; }
  let gas_begin = atomicLoad(&cells[gas_offset_word(c)]);
  let gas_end = atomicLoad(&cells[gas_offset_word(c + 1u)]);
  let parcel_begin = atomicLoad(&cells[parcel_offset_word(c)]);
  let parcel_end = atomicLoad(&cells[parcel_offset_word(c + 1u)]);
  if (parcel_end == parcel_begin || gas_end == gas_begin) { return; }
  if (gas_end - gas_begin > MAX_MEMBERS || parcel_end - parcel_begin > MAX_MEMBERS) { flag(E_OVERFLOW); return; }
  // Deterministic member order: insertion sort of this cell's lists by row.
  var gas_rows = array<u32, MAX_MEMBERS>();
  var parcel_rows = array<u32, MAX_MEMBERS>();
  let ng = gas_end - gas_begin; let np = parcel_end - parcel_begin;
  for (var k = 0u; k < ng; k++) {
    let value = atomicLoad(&cells[gas_row_word(gas_begin + k)]);
    var j = k;
    while (j > 0u && gas_rows[j - 1u] > value) { gas_rows[j] = gas_rows[j - 1u]; j--; }
    gas_rows[j] = value;
  }
  for (var k = 0u; k < np; k++) {
    let value = atomicLoad(&cells[parcel_row_word(parcel_begin + k)]);
    var j = k;
    while (j > 0u && parcel_rows[j - 1u] > value) { parcel_rows[j] = parcel_rows[j - 1u]; j--; }
    parcel_rows[j] = value;
  }
  // Cell state from its gas carriers: vapor mass, mass-weighted temperature,
  // and the vapor carriers' mass-weighted specific internal energy.
  let volume = params.grid.w * params.grid.w * params.grid.w;
  var vapor_mass = 0.0; var gas_mass_sum = 0.0; var t_sum = 0.0; var u_vapor_sum = 0.0;
  for (var k = 0u; k < ng; k++) {
    let row = gas_rows[k];
    let m = gas_state[row * 2u].w;
    gas_mass_sum += m; t_sum += m * gas_thermo[row * 3u].z;
    if (is_vapor(row)) { vapor_mass += m; u_vapor_sum += m * gas_state[row * 2u + 1u].w; }
  }
  // Latent and sensible heat are exchanged with the cell's dry air, whose
  // ideal-gas ladders span the cold range; the vapor's own u then changes
  // only with the mass it moves. A cell without dry air uses all its gas.
  let dry_mass = gas_mass_sum - vapor_mass;
  let heat_to_dry_air = dry_mass > 0.0;
  let heat_mass_sum = select(gas_mass_sum, dry_mass, heat_to_dry_air);
  var last_heat_row = ng;
  for (var k = 0u; k < ng; k++) { if (!heat_to_dry_air || !is_vapor(gas_rows[k])) { last_heat_row = k; } }
  if (gas_mass_sum <= 0.0) { return; }
  let t_air = t_sum / gas_mass_sum;
  let pressure = params.physics.y;
  let saturation = vapor_mass * RV * t_air / volume / saturation_pa(t_air);
  let u_vapor = select(0.0, u_vapor_sum / vapor_mass, vapor_mass > 0.0);
  let dt = params.physics.x;
  let k_cond = 4.1868e-3 * (${law.conductivity.a} + ${law.conductivity.b} * (t_air - 273.15));
  for (var q = 0u; q < np; q++) {
    let p = parcel_rows[q];
    let pbase = p * PARAM_FLOATS;
    let multiplicity = parcels[pbase + 3u];
    let dry_density = parcels[pbase + 4u];
    let kappa = parcels[pbase + 5u];
    let dry = load_parcel(p, 0u); var water = load_parcel(p, 1u); var energy = load_parcel(p, 2u);
    let n = max(multiplicity, 1.0);
    let m_w = view(water) / n; let m_d = view(dry) / n;
    let r_dry = pow(3.0 * m_d / (4.0 * PI * dry_density), 1.0 / 3.0);
    let r = pow(3.0 * (m_w / RHO_W + m_d / dry_density) / (4.0 * PI), 1.0 / 3.0);
    let rate0 = droplet_rate(r, r_dry, kappa, t_air, pressure, saturation);
    rate_probe[p * 4u] = rate0.x; rate_probe[p * 4u + 1u] = rate0.y;
    rate_probe[p * 4u + 2u] = saturation; rate_probe[p * 4u + 3u] = r;
    // The droplet ODE is stiff for small radii: integrate it over the step
    // with substeps of at most a quarter of its mass e-folding time (the cell
    // vapor is held for the step). Near equilibrium the rate vanishes, so the
    // substeps lengthen and the droplet settles without overshoot.
    var m_sub = m_w; var t_left = dt; var dm_droplet = 0.0;
    for (var it = 0u; it < 48u && t_left > 0.0; it++) {
      let r_sub = pow(3.0 * (m_sub / RHO_W + m_d / dry_density) / (4.0 * PI), 1.0 / 3.0);
      let rr = droplet_rate(r_sub, r_dry, kappa, t_air, pressure, saturation).x;
      if (rr == 0.0) { break; }
      let tau = (m_sub + 1.0e-3 * m_d) / abs(rr);
      let h = min(t_left, 0.25 * tau);
      var dm = rr * h;
      if (m_sub + dm < 0.0) { dm = -m_sub; }
      m_sub += dm; dm_droplet += dm; t_left -= h;
    }
    let rate = vec2<f32>(dm_droplet / dt, rate0.y);
    // Quasi-steady droplet (Maxwell-Mason): water joins or leaves the
    // parcel at the parcel's own specific energy; the latent difference from
    // the vapor's u is exchanged with the cell's gas, split over all gas
    // carriers by mass with the remainder rule.
    let u_parcel = select(params.physics.z + C_W * (t_air - 273.15), sview(energy) / max(view(water), 1.0e-36),
      view(water) > 0.0);
    var latent = ExactMass();
    if (rate.x > 0.0) {
      var want = quanta(rate.x * n * dt);
      for (var k = 0u; k < ng && !em_zero(want); k++) {
        let row = gas_rows[k];
        if (!is_vapor(row)) { continue; }
        let held = load_gas_mass(row);
        let take = min_exact(want, held);
        if (em_zero(take)) { continue; }
        let e_held = load_gas_energy(row);
        var e_take = squanta(view(take) * gas_state[row * 2u + 1u].w);
        if (em_compare(take, held) == 0) { e_take = e_held; }
        let e_parcel = squanta(view(take) * u_parcel);
        store_gas_mass(row, em_subtract(held, take).value);
        store_gas_energy(row, el_subtract(e_held, e_take).value);
        water = em_add(water, take).value;
        energy = el_add(energy, e_parcel).value;
        latent = el_add(latent, el_subtract(e_take, e_parcel).value).value;
        want = em_subtract(want, take).value;
      }
    } else if (rate.x < 0.0 && vapor_mass > 0.0) {
      let give = min_exact(quanta(-rate.x * n * dt), water);
      if (!em_zero(give)) {
        var e_give = squanta(view(give) * u_parcel);
        if (em_compare(give, water) == 0) { e_give = energy; }
        let e_vapor_total = squanta(view(give) * u_vapor);
        var left = give; var e_left = e_vapor_total;
        var last_vapor = ng;
        for (var k = 0u; k < ng; k++) { if (is_vapor(gas_rows[k])) { last_vapor = k; } }
        for (var k = 0u; k < ng; k++) {
          let row = gas_rows[k];
          if (!is_vapor(row)) { continue; }
          var part = left; var e_part = e_left;
          if (k != last_vapor) {
            part = min_exact(quanta(view(give) * gas_state[row * 2u].w / vapor_mass), left);
            e_part = squanta(view(part) * u_vapor);
          }
          store_gas_mass(row, em_add(load_gas_mass(row), part).value);
          store_gas_energy(row, el_add(load_gas_energy(row), e_part).value);
          left = em_subtract(left, part).value;
          e_left = el_subtract(e_left, e_part).value;
        }
        water = em_subtract(water, give).value;
        energy = el_subtract(energy, e_give).value;
        // The gas supplies what the vapor holds beyond the liquid it left.
        latent = el_subtract(e_give, e_vapor_total).value;
      }
    }
    // Sensible heat: the droplets relax toward the gas temperature with the
    // exact exponential factor of their own heat capacity, so they cannot
    // overshoot; the gas gives what they take.
    let m_water_now = view(water);
    var heat = 0.0;
    if (m_water_now > 0.0) {
      let t_drop = 273.15 + (sview(energy) / m_water_now - params.physics.z) / C_W;
      let capacity = m_water_now * C_W;
      let kn = (${law.meanFreePath.l0} * (${law.meanFreePath.p0}.0 / pressure) * (t_air / ${law.meanFreePath.t0})) / r;
      let conductance = 4.0 * PI * r * k_cond * fuchs_sutugin(kn, ${law.thermalAccommodation}.0) * n;
      heat = (t_air - t_drop) * capacity * (1.0 - exp(-dt * conductance / capacity));
    }
    let sensible = squanta(heat);
    energy = el_add(energy, sensible).value;
    // Gas carriers receive latent - sensible (remainder rule by mass).
    let to_gas = el_subtract(latent, sensible).value;
    let to_gas_f = sview(to_gas);
    var gas_left = to_gas;
    for (var k = 0u; k < ng; k++) {
      let row = gas_rows[k];
      if (heat_to_dry_air && is_vapor(row)) { continue; }
      var part = gas_left;
      if (k != last_heat_row) { part = squanta(to_gas_f * gas_state[row * 2u].w / heat_mass_sum); }
      store_gas_energy(row, el_add(load_gas_energy(row), part).value);
      gas_left = el_subtract(gas_left, part).value;
    }
    if (view(water) > 0.0) {
      parcels[pbase + 6u] = 273.15 + (sview(energy) / view(water) - params.physics.z) / C_W;
    }
    store_parcel(p, 1u, water);
    store_parcel(p, 2u, energy);
    let m_w_now = view(water) / n;
    parcels[pbase + 7u] = pow(3.0 * (m_w_now / RHO_W + m_d / dry_density) / (4.0 * PI), 1.0 / 3.0);
  }
  // f32 projections of the touched gas rows.
  for (var k = 0u; k < ng; k++) {
    let row = gas_rows[k];
    let m = view(load_gas_mass(row));
    let state0 = gas_state[row * 2u]; let state1 = gas_state[row * 2u + 1u];
    // Mass-derived mechanics lanes follow the new mass: rest volume scales
    // with it and lane 31 is the reference mass.
    if (bitcast<u32>(state0.w) != bitcast<u32>(m) && state0.w > 0.0) {
      let m4 = gas_mechanics[row * 8u + 4u];
      gas_mechanics[row * 8u + 4u] = vec4<f32>(m4.xyz, m4.w * m / state0.w);
      let m7 = gas_mechanics[row * 8u + 7u];
      gas_mechanics[row * 8u + 7u] = vec4<f32>(m7.xyz, m);
    }
    gas_state[row * 2u] = vec4<f32>(state0.xyz, m);
    // A projection within rounding of the current u keeps that u: at a
    // caloric-domain bound the ulp would leave the row unclassifiable.
    // Rounding is 8 ulps, as in the phase reconcile: the ledger thermal view
    // sits up to 4 ulps inside the domain while U/m may sit up to 4 outside.
    // U stays exact; the next ledger step books the view's rounding to S.
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
    [entryPoint, createCachedExplicitComputePipeline(device, { cacheKey: `ulg-exact-vapor-parcel-${entryPoint}.v1`,
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
        ['scatter_members', Math.ceil(members / 64)], ['exchange_cells', Math.ceil(cellCount / 64)]]) {
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
export function sphExactVaporParcelDropletRate({ r, rDry, kappa, t, p, s }) {
  const c = t - 273.15;
  const sigma = law.surfaceTension.a - law.surfaceTension.b * c;
  const latent = law.latentHeat.a - law.latentHeat.b * c;
  const r3 = r ** 3, d3 = rDry ** 3;
  const aw = Math.max(r3 - d3, 0) / Math.max(r3 - d3 * (1 - kappa), 1e-36);
  const sEq = aw * Math.exp(2 * sigma / (law.waterDensityKgPerM3 * law.gasConstantVaporJPerKgK * t * r));
  const lambda = law.meanFreePath.l0 * (law.meanFreePath.p0 / p) * (t / law.meanFreePath.t0);
  const kn = lambda / r;
  const fs = alpha => { const g = 4 / (3 * alpha); return (1 + kn) / (1 + (g + 0.377) * kn + g * kn * kn); };
  const dv = law.diffusivity.d0 * (t / 273.15) ** law.diffusivity.exponent * (law.diffusivity.p0 / p) * fs(law.massAccommodation);
  const ka = 4.1868e-3 * (law.conductivity.a + law.conductivity.b * c) * fs(law.thermalAccommodation);
  const es = law.saturation.e0 * Math.exp(law.saturation.a * c / (c + law.saturation.b));
  const fk = (latent / (law.gasConstantVaporJPerKgK * t) - 1) * latent / (ka * t);
  const fd = law.gasConstantVaporJPerKgK * t / (dv * es);
  return { rate: 4 * Math.PI * r * (s - sEq) / (fk + fd), sEq, saturationPa: es };
}
export { SPH_EXACT_THERMAL_ENERGY_CONTROL_WORDS };
