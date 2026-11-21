import{t as e}from"./rolldown-runtime-DK3Fl9T5.js";import{c as t,l as n,p as r}from"./webgpuComputeLayout-DLLtg7sT.js";import{t as i}from"./sphExactMassWgsl-ChqpSzqB.js";import{h as a,n as o,t as s}from"./sphExactThermalEnergyWgsl-BcKhzD6f.js";const c=`
// Existing packed phase caloric segments provide U(T), including each
// material's energy zero. Never infer temperature from mass-weighted T.
fn phase_temperature(material: f32, u: f32, phase: f32) -> f32 {
  var result = -1.0;
  var kind = 0.0; var phase_mask = 0u; var row_count = 0u;
  for (var r = 0u; r < params.segment_count; r++) {
    let a = segments[r * 3u]; let b = segments[r * 3u + 1u]; let c = segments[r * 3u + 2u];
    if (a.x != material) { continue; }
    // These explicit caloric branches define physical U(T). Legacy ladders
    // can need a pressure-carrier transform; do not treat their reference
    // energy as a physical gas caloric closure. Such merges remain unmodified
    // until that closure is provided by the resident thermodynamics owner.
    if (a.y != 3.0 && a.y != 4.0 && a.y != 5.0) { return -1.0; }
    if (row_count == 0u) { kind = a.y; }
    if (kind != a.y || !integer(a.z) || a.z < 1.0 || a.z > 3.0 || a.z != a.w) { return -1.0; }
    let bit = 1u << u32(a.z);
    if ((phase_mask & bit) != 0u) { return -1.0; }
    phase_mask |= bit; row_count++;
    if (!finite4(b) || c.z != 1.0 || b.y <= b.x || b.w <= b.z || b.z <= 0.0) { return -1.0; }
    if (a.z != phase) { continue; }
    if (u >= b.x && u <= b.y) {
      let t = b.z + (u - b.x) * (b.w - b.z) / (b.y - b.x);
      if (!finite(t) || (result > 0.0 && abs(t - result) > 1e-4 * max(t, result))) { return -1.0; }
      result = t;
    }
  }
  if ((kind == 3.0 && (row_count != 2u || phase_mask != 12u))
      || (kind == 4.0 && (row_count != 3u || phase_mask != 14u))
      || (kind == 5.0 && (row_count != 1u || phase_mask != 8u))) { return -1.0; }
  return result;
}
fn gas_temperature(material: f32, u: f32) -> f32 {
  return phase_temperature(material, u, 3.0);
}
`,l=Object.freeze({gasConstantVaporJPerKgK:461.5,waterDensityKgPerM3:1e3,surfaceTension:Object.freeze({a:.0761,b:155e-6}),latentHeat:Object.freeze({a:2501e3,b:2370}),saturation:Object.freeze({e0:611.2,a:17.67,b:243.5}),diffusivity:Object.freeze({d0:211e-7,exponent:1.94,p0:101325}),conductivity:Object.freeze({a:5.69,b:.017}),meanFreePath:Object.freeze({l0:66e-9,p0:101325,t0:293.15}),massAccommodation:1,thermalAccommodation:1,waterSpecificHeatJPerKgK:4186}),u=Object.freeze({ARITHMETIC:8192,CELL_OVERFLOW:16384});3*o.wordCount;const d=Object.freeze({STORAGE:128,COPY_SRC:4,COPY_DST:8,UNIFORM:64}),f=e=>{throw TypeError(`Exact vapor-parcel ledger: ${e}`)},p=l,m=`
${i(o)}
${a(o)}
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
const RV: f32 = ${p.gasConstantVaporJPerKgK};
const RHO_W: f32 = ${p.waterDensityKgPerM3}.0;
const C_W: f32 = ${p.waterSpecificHeatJPerKgK}.0;
const MAX_MEMBERS: u32 = 128u;
const PARAM_FLOATS: u32 = 8u;
const E_ARITHMETIC: u32 = ${u.ARITHMETIC}u;
const E_OVERFLOW: u32 = ${u.CELL_OVERFLOW}u;

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
  return ${p.saturation.e0} * exp(${p.saturation.a} * c / (c + ${p.saturation.b}));
}
fn fuchs_sutugin(kn: f32, alpha: f32) -> f32 {
  let g = 4.0 / (3.0 * alpha);
  return (1.0 + kn) / (1.0 + (g + 0.377) * kn + g * kn * kn);
}
// Per-droplet mass rate (kg/s); also returns S_eq in .y.
fn droplet_rate(r: f32, r_dry: f32, kappa: f32, t: f32, p: f32, s: f32) -> vec2<f32> {
  let c = t - 273.15;
  let sigma = ${p.surfaceTension.a} - ${p.surfaceTension.b} * c;
  let latent = ${p.latentHeat.a} - ${p.latentHeat.b}.0 * c;
  let r3 = r * r * r; let d3 = r_dry * r_dry * r_dry;
  let a_w = max(r3 - d3, 0.0) / max(r3 - d3 * (1.0 - kappa), 1.0e-36);
  let s_eq = a_w * exp(2.0 * sigma / (RHO_W * RV * t * r));
  let lambda = ${p.meanFreePath.l0} * (${p.meanFreePath.p0}.0 / p) * (t / ${p.meanFreePath.t0});
  let kn = lambda / r;
  let d_v = ${p.diffusivity.d0} * pow(t / 273.15, ${p.diffusivity.exponent}) * (${p.diffusivity.p0}.0 / p)
    * fuchs_sutugin(kn, ${p.massAccommodation}.0);
  let k_a = 4.1868e-3 * (${p.conductivity.a} + ${p.conductivity.b} * c) * fuchs_sutugin(kn, ${p.thermalAccommodation}.0);
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
  let k_cond = 4.1868e-3 * (${p.conductivity.a} + ${p.conductivity.b} * (t_air - 273.15));
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
      let kn = (${p.meanFreePath.l0} * (${p.meanFreePath.p0}.0 / pressure) * (t_air / ${p.meanFreePath.t0})) / r;
      let conductance = 4.0 * PI * r * k_cond * fuchs_sutugin(kn, ${p.thermalAccommodation}.0) * n;
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
`;function h({device:e,gasCount:r,parcelCount:i,dims:a,origin:o,cellSizeM:s,vaporMaterialId:c,pressurePa:l,waterReferenceU0:u,gasStateBuffer:p,gasThermoBuffer:h,gasMassBuffer:g,gasEnergyBuffer:_,parcelBuffer:v,parcelLedgerBuffer:y,gasMechanicsBuffer:b=null,gasMassRange:x=null}={}){let S=a[0]*a[1]*a[2];(!(S>0)||!(r>0)||!(i>=0)||!(s>0))&&f(`grid and counts required`);let C=6*S+2+r+i,w=e.createBuffer({label:`ulg-exact-vapor-parcel-cells`,size:C*4,usage:d.STORAGE|d.COPY_DST}),T=e.createBuffer({label:`ulg-exact-vapor-parcel-rate-probe`,size:Math.max(i,1)*16,usage:d.STORAGE|d.COPY_SRC}),E=e.createBuffer({label:`ulg-exact-vapor-parcel-params`,size:64,usage:d.UNIFORM|d.COPY_DST}),D=new ArrayBuffer(64),O=new Uint32Array(D),k=new Float32Array(D);O.set([r,i,S,new Uint32Array(new Float32Array([c]).buffer)[0]],0),O.set([a[0],a[1],a[2],128],4),k.set([o[0],o[1],o[2],s],8),k.set([0,l,u,0],12);let A=[`uniform`,`storage`,`read-only-storage`,`storage`,`storage`,`storage`,`storage`,`storage`,`storage`,`storage`].map((e,n)=>t(n,e)),j=Object.fromEntries([`count_members`,`scan_members`,`scatter_members`,`exchange_cells`].map(t=>[t,n(e,{cacheKey:`ulg-exact-vapor-parcel-${t}.v1`,label:`ulg-exact-vapor-parcel-${t}`,code:m,entryPoint:t,bindings:A})])),M=b?null:e.createBuffer({label:`ulg-exact-vapor-parcel-mechanics-scratch`,size:r*128,usage:d.STORAGE}),N=e.createBindGroup({layout:j.exchange_cells.bindGroupLayout,entries:[E,p,h,g,_,v,y,w,T,b??M].map((e,t)=>({binding:t,resource:t===3&&x?{buffer:e,offset:x.offset,size:x.size}:{buffer:e}}))}),P=Math.max(r,i);return Object.freeze({probeBuffer:T,encode(t,n){k[12]=n,e.queue.writeBuffer(E,0,D),t.clearBuffer(w);for(let[e,n]of[[`count_members`,Math.ceil(P/64)],[`scan_members`,1],[`scatter_members`,Math.ceil(P/64)],[`exchange_cells`,Math.ceil(S/64)]]){let r=t.beginComputePass({label:`ulg-exact-vapor-parcel-${e}`});r.setPipeline(j[e].pipeline),r.setBindGroup(0,N),r.dispatchWorkgroups(n),r.end()}},destroy(){w.destroy(),T.destroy(),E.destroy(),M?.destroy()}})}const g=Object.freeze({ARITHMETIC:32768,STOKES_DECLARATION:65536});Object.freeze({AIRBORNE:1,DEPOSITED_CARRIER:2,DEPOSITED_WALL:3});const _=Object.freeze({STORAGE:128,COPY_SRC:4,COPY_DST:8,UNIFORM:64}),v=e=>{throw TypeError(`Exact parcel transport: ${e}`)},y=`
${i(o)}
${a(o)}
struct TransportParams {
  // carrier_count, parcel_count, cell_count, water_material_bits
  counts: vec4<u32>,
  dims: vec4<u32>,
  // origin xyz, cell size
  grid: vec4<f32>,
  // box size xyz, dt
  box: vec4<f32>,
  // gravity y, air density, air viscosity, mean free path
  air: vec4<f32>,
};
@group(0) @binding(0) var<uniform> params: TransportParams;
@group(0) @binding(1) var<storage, read_write> carrier_state: array<vec4<f32>>;
@group(0) @binding(2) var<storage, read> carrier_thermo: array<vec4<f32>>;
@group(0) @binding(3) var<storage, read_write> carrier_mass: array<u32>;
@group(0) @binding(4) var<storage, read_write> carrier_energy: array<atomic<u32>>;
@group(0) @binding(5) var<storage, read_write> parcels: array<f32>;
@group(0) @binding(6) var<storage, read_write> parcel_ledger: array<u32>;
@group(0) @binding(7) var<storage, read_write> parcel_target: array<u32>;
@group(0) @binding(8) var<storage, read_write> sinks: array<u32>;
@group(0) @binding(9) var<storage, read_write> carrier_mechanics: array<vec4<f32>>;

const PI: f32 = 3.14159265358979;
const RHO_W: f32 = 1000.0;
const PARAM_FLOATS: u32 = 8u;
const NONE: u32 = 0xffffffffu;
const WALL: u32 = 0xfffffffeu;
const E_ARITHMETIC: u32 = ${g.ARITHMETIC}u;
const E_STOKES: u32 = ${g.STOKES_DECLARATION}u;

fn rows() -> u32 { return params.counts.x * EM_WORDS; }
fn flag(bits: u32) { atomicOr(&carrier_energy[2u * rows()], bits); }
fn load_parcel(p: u32, slot: u32) -> ExactMass {
  var v = ExactMass(); let base = (p * 3u + slot) * EM_WORDS;
  for (var i = 0u; i < EM_WORDS; i++) { v.words[i] = parcel_ledger[base + i]; } return v;
}
fn store_parcel(p: u32, slot: u32, v: ExactMass) {
  let base = (p * 3u + slot) * EM_WORDS;
  for (var i = 0u; i < EM_WORDS; i++) { parcel_ledger[base + i] = v.words[i]; }
}
fn load_sink(slot: u32) -> ExactMass {
  var v = ExactMass(); for (var i = 0u; i < EM_WORDS; i++) { v.words[i] = sinks[slot * EM_WORDS + i]; } return v;
}
fn store_sink(slot: u32, v: ExactMass) { for (var i = 0u; i < EM_WORDS; i++) { sinks[slot * EM_WORDS + i] = v.words[i]; } }
fn view(a: ExactMass) -> f32 { return bitcast<f32>(em_project_f32_bits(a).bits); }
fn is_water_carrier(row: u32) -> bool {
  let t = carrier_thermo[row * 3u];
  let phase = u32(t.y + 0.5);
  return bitcast<u32>(t.x) == params.counts.w && (phase == 1u || phase == 2u) && carrier_state[row * 2u].w > 0.0;
}

// Pass 1, one thread per airborne parcel: move it, then choose its fate.
@compute @workgroup_size(64)
fn transport_parcels(@builtin(global_invocation_id) id: vec3<u32>) {
  let p = id.x;
  if (p >= params.counts.y) { return; }
  parcel_target[p] = NONE;
  let base = p * PARAM_FLOATS;
  let n = max(parcels[base + 3u], 1.0);
  let water = load_parcel(p, 1u); let dry = load_parcel(p, 0u);
  if (em_zero(water) && em_zero(dry)) { return; }
  var position = vec3<f32>(parcels[base], parcels[base + 1u], parcels[base + 2u]);
  // Cell gas velocity: mass-weighted over gas carriers in the parcel's cell.
  let local = (position - params.grid.xyz) / params.grid.w;
  let dims = vec3<i32>(params.dims.xyz);
  let cell = clamp(vec3<i32>(floor(local)), vec3<i32>(0), dims - vec3<i32>(1));
  var momentum = vec3<f32>(0.0); var gas = 0.0;
  for (var row = 0u; row < params.counts.x; row++) {
    let s0 = carrier_state[row * 2u];
    if (u32(carrier_thermo[row * 3u].y + 0.5) != 3u || s0.w <= 0.0) { continue; }
    let rc = clamp(vec3<i32>(floor((s0.xyz - params.grid.xyz) / params.grid.w)), vec3<i32>(0), dims - vec3<i32>(1));
    if (any(rc != cell)) { continue; }
    momentum += s0.w * carrier_state[row * 2u + 1u].xyz; gas += s0.w;
  }
  let gas_velocity = select(vec3<f32>(0.0), momentum / gas, gas > 0.0);
  // Stokes settling with the Cunningham correction.
  let m_d = view(dry) / n; let m_w = view(water) / n;
  let dry_density = parcels[base + 4u];
  let volume = m_w / RHO_W + m_d / dry_density;
  let r = pow(3.0 * volume / (4.0 * PI), 1.0 / 3.0);
  let rho_p = (m_w + m_d) / max(volume, 1.0e-36);
  let kn = params.air.w / r;
  let slip = 1.0 + kn * (1.257 + 0.4 * exp(-1.1 / kn));
  let relaxation = rho_p * (2.0 * r) * (2.0 * r) * slip / (18.0 * params.air.z);
  if (relaxation > params.box.w) { flag(E_STOKES); return; }
  let settling = relaxation * (1.0 - params.air.y / rho_p) * params.air.x;
  let velocity = gas_velocity + vec3<f32>(0.0, settling, 0.0);
  position += velocity * params.box.w;
  parcels[base] = position.x; parcels[base + 1u] = position.y; parcels[base + 2u] = position.z;
  parcels[base + 7u] = r;
  if (any(position < vec3<f32>(0.0)) || any(position > params.box.xyz)) { parcel_target[p] = WALL; return; }
  // Nearest condensed water carrier within contact distance (lowest row on ties).
  var best = NONE; var best_d2 = 3.4e38;
  for (var row = 0u; row < params.counts.x; row++) {
    if (!is_water_carrier(row)) { continue; }
    let s0 = carrier_state[row * 2u];
    let half_edge = 0.5 * pow(s0.w / RHO_W, 1.0 / 3.0);
    let reach = half_edge + r;
    let d = s0.xyz - position;
    let d2 = dot(d, d);
    if (d2 <= reach * reach && d2 < best_d2) { best = row; best_d2 = d2; }
  }
  parcel_target[p] = best;
}

// Pass 2, one thread per carrier: add every parcel that deposits into it.
@compute @workgroup_size(64)
fn deposit_into_carriers(@builtin(global_invocation_id) id: vec3<u32>) {
  let row = id.x;
  if (row >= params.counts.x) { return; }
  var mass = ExactMass(); var energy = ExactMass(); var any_parcel = false;
  for (var p = 0u; p < params.counts.y; p++) {
    if (parcel_target[p] != row) { continue; }
    let added_mass = em_add(mass, load_parcel(p, 1u));
    let added_energy = el_add(energy, load_parcel(p, 2u));
    if ((added_mass.error | added_energy.error) != 0u) { flag(E_ARITHMETIC); return; }
    mass = added_mass.value; energy = added_energy.value;
    any_parcel = true;
  }
  if (!any_parcel) { return; }
  var held = ExactMass(); var held_energy = ExactMass();
  for (var i = 0u; i < EM_WORDS; i++) {
    held.words[i] = carrier_mass[row * EM_WORDS + i];
    held_energy.words[i] = atomicLoad(&carrier_energy[row * EM_WORDS + i]);
  }
  let next = em_add(held, mass); let next_energy = el_add(held_energy, energy);
  if ((next.error | next_energy.error) != 0u) { flag(E_ARITHMETIC); return; }
  for (var i = 0u; i < EM_WORDS; i++) {
    carrier_mass[row * EM_WORDS + i] = next.value.words[i];
    atomicStore(&carrier_energy[row * EM_WORDS + i], next_energy.value.words[i]);
  }
  // The receiver's f32 view: mass, u = U/m, and its mass-derived mechanics lanes.
  let m = view(next.value);
  let state0 = carrier_state[row * 2u]; let state1 = carrier_state[row * 2u + 1u];
  let u = bitcast<f32>(el_project_f32_bits(next_energy.value).bits) / max(m, 1.0e-36);
  if (state0.w > 0.0) {
    let m4 = carrier_mechanics[row * 8u + 4u];
    carrier_mechanics[row * 8u + 4u] = vec4<f32>(m4.xyz, m4.w * m / state0.w);
  }
  let m7 = carrier_mechanics[row * 8u + 7u];
  carrier_mechanics[row * 8u + 7u] = vec4<f32>(m7.xyz, m);
  carrier_state[row * 2u] = vec4<f32>(state0.xyz, m);
  carrier_state[row * 2u + 1u] = vec4<f32>(state1.xyz, u);
}

// Pass 3, one thread: the wall sink takes whole wall parcels; the solute sink
// takes the dry cores of carrier-deposited parcels.
@compute @workgroup_size(1)
fn deposit_into_sinks() {
  var wall_mass = load_sink(0u); var wall_energy = load_sink(1u); var solute = load_sink(2u);
  for (var p = 0u; p < params.counts.y; p++) {
    let target_row = parcel_target[p];
    if (target_row == WALL) {
      let a = em_add(wall_mass, load_parcel(p, 0u));
      let b = em_add(a.value, load_parcel(p, 1u));
      let c = el_add(wall_energy, load_parcel(p, 2u));
      if ((a.error | b.error | c.error) != 0u) { flag(E_ARITHMETIC); return; }
      wall_mass = b.value; wall_energy = c.value;
    } else if (target_row != NONE) {
      let added = em_add(solute, load_parcel(p, 0u));
      if (added.error != 0u) { flag(E_ARITHMETIC); return; }
      solute = added.value;
    }
  }
  store_sink(0u, wall_mass); store_sink(1u, wall_energy); store_sink(2u, solute);
}

// Pass 4, one thread per parcel: a deposited parcel's rows become exact zero.
@compute @workgroup_size(64)
fn retire_deposited(@builtin(global_invocation_id) id: vec3<u32>) {
  let p = id.x;
  if (p >= params.counts.y || parcel_target[p] == NONE) { return; }
  store_parcel(p, 0u, ExactMass()); store_parcel(p, 1u, ExactMass()); store_parcel(p, 2u, ExactMass());
  parcels[p * PARAM_FLOATS + 7u] = 0.0;
}
`;function b({device:e,carrierCount:r,parcelCount:i,dims:a,origin:o,cellSizeM:s,boxM:c,waterMaterialId:l,airDensityKgPerM3:u=1.2,airViscosityPaS:d=181e-7,meanFreePathM:f=66e-9,gravityMPerS2:p=-9.81,carrierStateBuffer:m,carrierThermoBuffer:h,carrierMassBuffer:g,carrierEnergyBuffer:b,parcelBuffer:x,parcelLedgerBuffer:S,sinkBuffer:C,carrierMechanicsBuffer:w=null,carrierMassRange:T=null}={}){(!(r>0)||!(i>0)||!(s>0))&&v(`counts and grid required`);let E=e.createBuffer({label:`ulg-exact-parcel-target`,size:i*4,usage:_.STORAGE|_.COPY_SRC}),D=e.createBuffer({label:`ulg-exact-parcel-transport-params`,size:80,usage:_.UNIFORM|_.COPY_DST}),O=new ArrayBuffer(80),k=new Uint32Array(O),A=new Float32Array(O);k.set([r,i,a[0]*a[1]*a[2],new Uint32Array(new Float32Array([l]).buffer)[0]],0),k.set([a[0],a[1],a[2],0],4),A.set([o[0],o[1],o[2],s],8),A.set([c[0],c[1],c[2],0],12),A.set([p,u,d,f],16);let j=[`uniform`,`storage`,`read-only-storage`,`storage`,`storage`,`storage`,`storage`,`storage`,`storage`,`storage`].map((e,n)=>t(n,e)),M=Object.fromEntries([`transport_parcels`,`deposit_into_carriers`,`deposit_into_sinks`,`retire_deposited`].map(t=>[t,n(e,{cacheKey:`ulg-exact-parcel-transport-${t}.v2`,label:`ulg-exact-parcel-transport-${t}`,code:y,entryPoint:t,bindings:j})])),N=w?null:e.createBuffer({label:`ulg-exact-parcel-mechanics-scratch`,size:r*128,usage:_.STORAGE}),P=e.createBindGroup({layout:M.transport_parcels.bindGroupLayout,entries:[D,m,h,g,b,x,S,E,C,w??N].map((e,t)=>({binding:t,resource:t===3&&T?{buffer:e,offset:T.offset,size:T.size}:{buffer:e}}))});return Object.freeze({targetBuffer:E,encode(t,n){A[15]=n,e.queue.writeBuffer(D,0,O);for(let[e,n]of[[`transport_parcels`,Math.ceil(i/64)],[`deposit_into_carriers`,Math.ceil(r/64)],[`deposit_into_sinks`,1],[`retire_deposited`,Math.ceil(i/64)]]){let r=t.beginComputePass({label:`ulg-exact-parcel-transport-${e}`});r.setPipeline(M[e].pipeline),r.setBindGroup(0,P),r.dispatchWorkgroups(n),r.end()}},destroy(){E.destroy(),D.destroy(),N?.destroy()}})}function x({device:e,particleCount:r,stateBuffer:i,thermoBuffer:a,energy:o,thermalMaterialTable:l}){if(!l?.segments||!Number.isInteger(l.segmentCount))throw TypeError(`Ledger parcel caloric refresh requires the current thermal table`);let u=n(e,{cacheKey:`ulg-ledger-parcel-caloric.v1`,label:`ulg-ledger-parcel-caloric`,code:`
    struct Params { particle_count:u32, segment_count:u32, error_offset:u32, pad:u32 };
    @group(0) @binding(0) var<uniform> params:Params;
    @group(0) @binding(1) var<storage,read> state:array<vec4<f32>>;
    @group(0) @binding(2) var<storage,read_write> thermo:array<vec4<f32>>;
    @group(0) @binding(3) var<storage,read> segments:array<vec4<f32>>;
    @group(0) @binding(4) var<storage,read_write> ledger:array<atomic<u32>>;
    fn finite(v:f32)->bool{return (bitcast<u32>(v)&0x7f800000u)!=0x7f800000u;}
    fn finite4(v:vec4<f32>)->bool{return finite(v.x)&&finite(v.y)&&finite(v.z)&&finite(v.w);}
    fn integer(v:f32)->bool{return finite(v)&&v>=0.0&&v==floor(v);}
    ${c}
    @compute @workgroup_size(64) fn refresh(@builtin(global_invocation_id) id:vec3<u32>){
      let i=id.x;if(i>=params.particle_count || state[2u*i].w<=0.0){return;}
      let t=thermo[3u*i];var has_caloric=false;
      for(var r=0u;r<params.segment_count;r++){
        let a=segments[3u*r];if(a.x==t.x && (a.y==3.0||a.y==4.0||a.y==5.0)){has_caloric=true;}
      }
      if(!has_caloric){return;}
      let temperature=phase_temperature(t.x,state[2u*i+1u].w,t.y);
      if(!(temperature>0.0)){atomicOr(&ledger[params.error_offset],${s.OUTSIDE_DOMAIN}u);return;}
      thermo[3u*i]=vec4<f32>(t.xy,temperature,t.w);
    }`,entryPoint:`refresh`,bindings:[`uniform`,`read-only-storage`,`storage`,`read-only-storage`,`storage`].map((e,n)=>t(n,e))}),d=[],f=(t,n)=>{let r=e.createBuffer({size:Math.max(16,t.byteLength),usage:n|GPUBufferUsage.COPY_DST});return d.push(r),e.queue.writeBuffer(r,0,t),r};try{let t=f(new Uint32Array([r,l.segmentCount,2*r*o.format.wordCount,0]),GPUBufferUsage.UNIFORM),n=f(l.segments,GPUBufferUsage.STORAGE),s=e.createBindGroup({layout:u.bindGroupLayout,entries:[t,i,a,n,o.energyBuffer].map((e,t)=>({binding:t,resource:{buffer:e}}))});return{encode(e){let t=e.beginComputePass({label:`ulg-ledger-parcel-caloric`});t.setPipeline(u.pipeline),t.setBindGroup(0,s),t.dispatchWorkgroups(Math.ceil(r/64)),t.end()},destroy(){for(let e of d)e.destroy()}}}catch(e){for(let e of d)e.destroy();throw e}}var S=e({prepareSphLedgerParcelStagesWebGpu:()=>C,runSphLedgerParcelStagesWebGpu:()=>w});function C({device:e,parcels:t,particleCount:n,dtSeconds:r,stateBuffer:i,thermoBuffer:a,mechanicsBuffer:o,massRead:s,energy:c,thermalMaterialTable:l}={}){if(!t?.count||!(r>0)||!s?.buffer||!c?.energyBuffer||s.rowCount!==n||c.rowCount!==n)throw TypeError(`Ledger parcel stages require the parcel family and complete carrier records`);let u=t.boxDimensionsM,d=t.cellsPerAxis;if(!u.every(e=>Math.abs(e-u[0])<=1e-9*u[0]))throw TypeError(`Ledger parcel stages require cubic gas cells (a cubic box)`);let f=u[0]/d,p=[d,d,d],m={offset:s.byteOffset,size:s.byteLength},g=h({device:e,gasCount:n,parcelCount:t.count,dims:p,origin:[0,0,0],cellSizeM:f,vaporMaterialId:t.vaporMaterialId,pressurePa:t.pressurePa,waterReferenceU0:t.waterReferenceU0,gasStateBuffer:i,gasThermoBuffer:a,gasMassBuffer:s.buffer,gasMassRange:m,gasEnergyBuffer:c.energyBuffer,parcelBuffer:t.paramsBuffer,parcelLedgerBuffer:t.ledgerBuffer,gasMechanicsBuffer:o}),_=null,v=null;try{return _=b({device:e,carrierCount:n,parcelCount:t.count,dims:p,origin:[0,0,0],cellSizeM:f,boxM:u,waterMaterialId:t.vaporMaterialId,carrierStateBuffer:i,carrierThermoBuffer:a,carrierMassBuffer:s.buffer,carrierMassRange:m,carrierEnergyBuffer:c.energyBuffer,parcelBuffer:t.paramsBuffer,parcelLedgerBuffer:t.ledgerBuffer,sinkBuffer:t.sinkBuffer,carrierMechanicsBuffer:o}),v=x({device:e,particleCount:n,stateBuffer:i,thermoBuffer:a,energy:c,thermalMaterialTable:l}),Object.freeze({targetBuffer:_.targetBuffer,encode(e){g.encode(e,r),_.encode(e,r),v.encode(e)},destroy(){for(let e of[g,_,v])e?.destroy()}})}catch(e){for(let e of[g,_,v])e?.destroy();throw e}}async function w(e){let t=C(e);try{let n=e.device.createCommandEncoder({label:`ulg-ledger-parcel-stages`});t.encode(n),e.device.queue.submit([n.finish()])}finally{r(e.device,t.destroy)}return!0}export{S as n,c as r,C as t};