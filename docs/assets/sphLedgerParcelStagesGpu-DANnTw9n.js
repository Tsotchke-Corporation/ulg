import{S as e,c as t,k as n,l as r,m as i,n as a,u as o,x as s}from"./webgpuComputeLayout-tWh43k53.js";import{t as c}from"./sphExactMassWgsl-quqzAZyn.js";import{h as l,n as u,t as d}from"./sphExactThermalEnergyWgsl-K1BIaB5N.js";const f=`
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
`,p=Object.freeze({gasConstantVaporJPerKgK:461.5,waterDensityKgPerM3:1e3,surfaceTension:Object.freeze({a:.0761,b:155e-6}),latentHeat:Object.freeze({a:2501e3,b:2370}),saturation:Object.freeze({e0:611.2,a:17.67,b:243.5}),diffusivity:Object.freeze({d0:211e-7,exponent:1.94,p0:101325}),conductivity:Object.freeze({a:5.69,b:.017}),meanFreePath:Object.freeze({l0:66e-9,p0:101325,t0:293.15}),massAccommodation:1,thermalAccommodation:1,waterSpecificHeatJPerKgK:4186}),m=Object.freeze({ARITHMETIC:8192,CELL_OVERFLOW:16384});3*u.wordCount;const h=Object.freeze({STORAGE:128,COPY_SRC:4,COPY_DST:8,UNIFORM:64}),g=e=>{throw TypeError(`Exact vapor-parcel ledger: ${e}`)},_=p,v=`
${c(u)}
${l(u)}
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
const RV: f32 = ${_.gasConstantVaporJPerKgK};
const RHO_W: f32 = ${_.waterDensityKgPerM3}.0;
const C_W: f32 = ${_.waterSpecificHeatJPerKgK}.0;
const MAX_MEMBERS: u32 = 128u;
const PARAM_FLOATS: u32 = 8u;
const E_ARITHMETIC: u32 = ${m.ARITHMETIC}u;
const E_OVERFLOW: u32 = ${m.CELL_OVERFLOW}u;

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
  return ${_.saturation.e0} * exp(${_.saturation.a} * c / (c + ${_.saturation.b}));
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
  let f_k = f_k_base / fuchs_sutugin(kn, ${_.thermalAccommodation}.0);
  let f_d = f_d_base / fuchs_sutugin(kn, ${_.massAccommodation}.0);
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
      let sigma = ${_.surfaceTension.a} - ${_.surfaceTension.b} * c_air;
      let latent_h = ${_.latentHeat.a} - ${_.latentHeat.b}.0 * c_air;
      let lambda_air = ${_.meanFreePath.l0} * (${_.meanFreePath.p0}.0 / pressure) * (t_air / ${_.meanFreePath.t0});
      let d_v_base = ${_.diffusivity.d0} * pow(t_air / 273.15, ${_.diffusivity.exponent}) * (${_.diffusivity.p0}.0 / pressure);
      let k_a_base = 4.1868e-3 * (${_.conductivity.a} + ${_.conductivity.b} * c_air);
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
        let conductance = 4.0 * PI * r * k_cond * fuchs_sutugin(kn, ${_.thermalAccommodation}.0) * n;
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
`;function y({device:n,gasCount:i,parcelCount:c,dims:l,origin:u,cellSizeM:d,vaporMaterialId:f,pressurePa:p,waterReferenceU0:m,gasStateBuffer:_,gasThermoBuffer:y,gasMassBuffer:b,gasEnergyBuffer:x,parcelBuffer:S,parcelLedgerBuffer:C,gasMechanicsBuffer:w=null,gasMassRange:T=null}={}){let E=l[0]*l[1]*l[2];(!(E>0)||!(i>0)||!(c>=0)||!(d>0))&&g(`grid and counts required`);let D=typeof globalThis.GPUDevice==`function`&&n instanceof globalThis.GPUDevice,O=(e,t,r)=>D?s(a(n,{bucketKey:e,label:e,size:t,usage:r}),n,{bucketKey:e,size:t,usage:r}):n.createBuffer({label:e,size:t,usage:r}),k=O(`ulg-exact-vapor-parcel-cells`,(6*E+2+i+c)*4,h.STORAGE|h.COPY_DST),A=O(`ulg-exact-vapor-parcel-rate-probe`,Math.max(c,1)*16,h.STORAGE|h.COPY_SRC|(D?h.COPY_DST:0)),j=O(`ulg-exact-vapor-parcel-params`,64,h.UNIFORM|h.COPY_DST),M=new ArrayBuffer(64),N=new Uint32Array(M),P=new Float32Array(M);N.set([i,c,E,new Uint32Array(new Float32Array([f]).buffer)[0]],0),N.set([l[0],l[1],l[2],128],4),P.set([u[0],u[1],u[2],d],8),P.set([0,p,m,0],12);let F=[`uniform`,`storage`,`read-only-storage`,`storage`,`storage`,`storage`,`storage`,`storage`,`storage`,`storage`].map((e,n)=>t(n,e)),I=Object.fromEntries([`count_members`,`scan_members`,`scatter_members`,`exchange_cells`].map(e=>[e,o(n,{cacheKey:`ulg-exact-vapor-parcel-${e}.v2`,label:`ulg-exact-vapor-parcel-${e}`,code:v,entryPoint:e,bindings:F})])),L=w?null:n.createBuffer({label:`ulg-exact-vapor-parcel-mechanics-scratch`,size:i*128,usage:h.STORAGE}),R=r(n,{layout:I.exchange_cells.bindGroupLayout,entries:[j,_,y,b,x,S,C,k,A,w??L].map((e,t)=>({binding:t,resource:t===3&&T?{buffer:e,offset:T.offset,size:T.size}:{buffer:e}}))}),z=Math.max(i,c),B=!1;return Object.freeze({probeBuffer:A,encode(e,t){B=!0,P[12]=t,n.queue.writeBuffer(j,0,M),e.clearBuffer(k),D&&e.clearBuffer(A);for(let[t,n]of[[`count_members`,Math.ceil(z/64)],[`scan_members`,1],[`scatter_members`,Math.ceil(z/64)],[`exchange_cells`,E]]){let r=e.beginComputePass({label:`ulg-exact-vapor-parcel-${t}`});r.setPipeline(I[t].pipeline),r.setBindGroup(0,R),r.dispatchWorkgroups(n),r.end()}},destroy(){e(k,{allowPool:B}),e(A,{allowPool:B}),e(j,{allowPool:B}),L?.destroy()}})}const b=Object.freeze({ARITHMETIC:32768,STOKES_DECLARATION:65536});Object.freeze({AIRBORNE:1,DEPOSITED_CARRIER:2,DEPOSITED_WALL:3});const x=Object.freeze({STORAGE:128,COPY_SRC:4,COPY_DST:8,UNIFORM:64}),S=e=>{throw TypeError(`Exact parcel transport: ${e}`)},C=`
${c(u)}
${l(u)}
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
@group(0) @binding(10) var<storage, read_write> prep: array<atomic<u32>>;

const PI: f32 = 3.14159265358979;
const RHO_W: f32 = 1000.0;
const PARAM_FLOATS: u32 = 8u;
const NONE: u32 = 0xffffffffu;
const WALL: u32 = 0xfffffffeu;
const E_ARITHMETIC: u32 = ${b.ARITHMETIC}u;
const E_STOKES: u32 = ${b.STOKES_DECLARATION}u;

// prep layout (atomic<u32>):
//   [0] water_count, [1] carrier_dep_count, [2] any_dep_count, [3] pad
//   [4 .. 4 + 4*C)       per-cell gas velocity (vx, vy, vz, mass) bitcast as u32
//   [4 + 4*C .. +5*N)    compacted condensed water carriers (px, py, pz, half_edge, row)
//   [4 + 4*C + 5*N .. +C) per-cell two-way parcel drag momentum reaction J_y (fixed-point 1e9 nN*s as i32 bits)
const DRAG_MOMENTUM_FIXED_SCALE: f32 = 1.0e9;
fn drag_base_word() -> u32 { return 4u + params.counts.z * 4u + params.counts.x * 5u; }
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

// Pass 0a, one thread per carrier: compact condensed water carriers and precompute half_edge once.
@compute @workgroup_size(256)
fn prep_water_carriers(@builtin(global_invocation_id) id: vec3<u32>) {
  let row = id.x;
  if (row >= params.counts.x || !is_water_carrier(row)) { return; }
  let s0 = carrier_state[row * 2u];
  let half_edge = 0.5 * pow(s0.w / RHO_W, 1.0 / 3.0);
  let slot = atomicAdd(&prep[0u], 1u);
  let base = 4u + params.counts.z * 4u + slot * 5u;
  atomicStore(&prep[base], bitcast<u32>(s0.x));
  atomicStore(&prep[base + 1u], bitcast<u32>(s0.y));
  atomicStore(&prep[base + 2u], bitcast<u32>(s0.z));
  atomicStore(&prep[base + 3u], bitcast<u32>(half_edge));
  atomicStore(&prep[base + 4u], row);
}

var<workgroup> sh_mom_gas: array<vec4<f32>, 128>;

// Pass 0b, one 128-thread workgroup per gas cell: deterministic mass-weighted cell gas velocity.
@compute @workgroup_size(128)
fn reduce_cell_gas(
  @builtin(workgroup_id) wg_id: vec3<u32>,
  @builtin(local_invocation_id) local_id: vec3<u32>
) {
  let c = wg_id.x;
  let lid = local_id.x;
  if (c >= params.counts.z) { return; }
  let dims = vec3<i32>(params.dims.xyz);
  let ci = i32(c);
  let cell = vec3<i32>(ci % dims.x, (ci / dims.x) % dims.y, ci / (dims.x * dims.y));
  var mom = vec3<f32>(0.0);
  var gas = 0.0;
  for (var row = lid; row < params.counts.x; row += 128u) {
    let s0 = carrier_state[row * 2u];
    if (u32(carrier_thermo[row * 3u].y + 0.5) != 3u || s0.w <= 0.0) { continue; }
    let rc = clamp(vec3<i32>(floor((s0.xyz - params.grid.xyz) / params.grid.w)), vec3<i32>(0), dims - vec3<i32>(1));
    if (any(rc != cell)) { continue; }
    mom += s0.w * carrier_state[row * 2u + 1u].xyz;
    gas += s0.w;
  }
  sh_mom_gas[lid] = vec4<f32>(mom, gas);
  workgroupBarrier();
  for (var stride = 64u; stride > 0u; stride >>= 1u) {
    if (lid < stride) {
      sh_mom_gas[lid] += sh_mom_gas[lid + stride];
    }
    workgroupBarrier();
  }
  if (lid == 0u) {
    let total = sh_mom_gas[0u];
    let vel = select(vec3<f32>(0.0), total.xyz / total.w, total.w > 0.0);
    let base = 4u + c * 4u;
    atomicStore(&prep[base], bitcast<u32>(vel.x));
    atomicStore(&prep[base + 1u], bitcast<u32>(vel.y));
    atomicStore(&prep[base + 2u], bitcast<u32>(vel.z));
    atomicStore(&prep[base + 3u], bitcast<u32>(total.w));
  }
}

var<workgroup> sh_parcel_pos_r: vec4<f32>;
var<workgroup> sh_parcel_active: u32;
var<workgroup> sh_water_count: u32;
var<workgroup> sh_best_d2: array<f32, 128>;
var<workgroup> sh_best_row: array<u32, 128>;

// Pass 1, one 128-thread workgroup per parcel: O(1) gas velocity lookup, Stokes move,
// then parallel associative min-reduction over compacted condensed water carriers.
@compute @workgroup_size(128)
fn transport_parcels(
  @builtin(workgroup_id) wg_id: vec3<u32>,
  @builtin(local_invocation_id) local_id: vec3<u32>
) {
  let p = wg_id.x;
  let lid = local_id.x;
  if (p >= params.counts.y) { return; }
  if (lid == 0u) {
    sh_parcel_active = 0u;
    sh_water_count = atomicLoad(&prep[0u]);
    parcel_target[p] = NONE;
    let base = p * PARAM_FLOATS;
    let n = max(parcels[base + 3u], 1.0);
    let water = load_parcel(p, 1u);
    let dry = load_parcel(p, 0u);
    if (!em_zero(water) || !em_zero(dry)) {
      var position = vec3<f32>(parcels[base], parcels[base + 1u], parcels[base + 2u]);
      let local = (position - params.grid.xyz) / params.grid.w;
      let dims = vec3<i32>(params.dims.xyz);
      let cell = clamp(vec3<i32>(floor(local)), vec3<i32>(0), dims - vec3<i32>(1));
      let c = u32(cell.x + dims.x * (cell.y + dims.y * cell.z));
      let cbase = 4u + c * 4u;
      let gas_velocity = vec3<f32>(
        bitcast<f32>(atomicLoad(&prep[cbase])),
        bitcast<f32>(atomicLoad(&prep[cbase + 1u])),
        bitcast<f32>(atomicLoad(&prep[cbase + 2u]))
      );
      // Stokes settling with the Cunningham correction.
      let m_d = view(dry) / n;
      let m_w = view(water) / n;
      let dry_density = parcels[base + 4u];
      let volume = m_w / RHO_W + m_d / dry_density;
      let r = pow(3.0 * volume / (4.0 * PI), 1.0 / 3.0);
      let rho_p = (m_w + m_d) / max(volume, 1.0e-36);
      let kn = params.air.w / r;
      let slip = 1.0 + kn * (1.257 + 0.4 * exp(-1.1 / kn));
      let relaxation = rho_p * (2.0 * r) * (2.0 * r) * slip / (18.0 * params.air.z);
      if (relaxation > params.box.w) {
        flag(E_STOKES);
      } else {
        let settling = relaxation * (1.0 - params.air.y / rho_p) * params.air.x;
        let velocity = gas_velocity + vec3<f32>(0.0, settling, 0.0);
        // Optional two-way Stokes drag momentum reaction onto suspending cell gas:
        // At terminal Stokes speed, the parcel transmits its buoyant weight
        // J_drag_y = (m_w + m_d) * n * (1 - rho_a / rho_p) * g_y * dt into the gas.
        if (params.dims.w != 0u) {
          let total_parcel_mass = (m_w + m_d) * n;
          let drag_impulse_y = total_parcel_mass * (1.0 - params.air.y / rho_p) * params.air.x * params.box.w;
          let drag_fixed = i32(clamp(round(drag_impulse_y * DRAG_MOMENTUM_FIXED_SCALE), -2.0e9, 2.0e9));
          atomicAdd(&prep[drag_base_word() + c], bitcast<u32>(drag_fixed));
        }
        position += velocity * params.box.w;
        parcels[base] = position.x;
        parcels[base + 1u] = position.y;
        parcels[base + 2u] = position.z;
        parcels[base + 7u] = r;
        if (any(position < vec3<f32>(0.0)) || any(position > params.box.xyz)) {
          parcel_target[p] = WALL;
          atomicAdd(&prep[2u], 1u);
        } else {
          sh_parcel_pos_r = vec4<f32>(position, r);
          sh_parcel_active = 1u;
        }
      }
    }
  }
  let is_active = workgroupUniformLoad(&sh_parcel_active);
  if (is_active == 0u) { return; }
  let water_count = workgroupUniformLoad(&sh_water_count);
  if (water_count == 0u) { return; }
  let pos_r = sh_parcel_pos_r;
  let position = pos_r.xyz;
  let r = pos_r.w;
  let list_base = 4u + params.counts.z * 4u;
  // Nearest condensed water carrier within contact distance (lowest row on ties).
  var my_best = NONE;
  var my_d2 = 3.4e38;
  for (var idx = lid; idx < water_count; idx += 128u) {
    let wbase = list_base + idx * 5u;
    let wp = vec3<f32>(
      bitcast<f32>(atomicLoad(&prep[wbase])),
      bitcast<f32>(atomicLoad(&prep[wbase + 1u])),
      bitcast<f32>(atomicLoad(&prep[wbase + 2u]))
    );
    let half_edge = bitcast<f32>(atomicLoad(&prep[wbase + 3u]));
    let reach = half_edge + r;
    let d = wp - position;
    let d2 = dot(d, d);
    if (d2 <= reach * reach) {
      let row = atomicLoad(&prep[wbase + 4u]);
      if (d2 < my_d2 || (d2 == my_d2 && row < my_best)) {
        my_best = row;
        my_d2 = d2;
      }
    }
  }
  sh_best_d2[lid] = my_d2;
  sh_best_row[lid] = my_best;
  workgroupBarrier();
  for (var stride = 64u; stride > 0u; stride >>= 1u) {
    if (lid < stride) {
      let od2 = sh_best_d2[lid + stride];
      let orow = sh_best_row[lid + stride];
      let cd2 = sh_best_d2[lid];
      let crow = sh_best_row[lid];
      if (orow != NONE && (crow == NONE || od2 < cd2 || (od2 == cd2 && orow < crow))) {
        sh_best_d2[lid] = od2;
        sh_best_row[lid] = orow;
      }
    }
    workgroupBarrier();
  }
  if (lid == 0u) {
    let best = sh_best_row[0u];
    parcel_target[p] = best;
    if (best != NONE) {
      atomicAdd(&prep[1u], 1u);
      atomicAdd(&prep[2u], 1u);
    }
  }
}

// Pass 1b (optional two-way drag): distribute per-cell Stokes drag momentum
// impulse uniformly across gas carriers in each cell (exact Newton's 3rd law).
@compute @workgroup_size(64)
fn apply_parcel_drag_to_gas(@builtin(global_invocation_id) id: vec3<u32>) {
  if (params.dims.w == 0u) { return; }
  let row = id.x;
  if (row >= params.counts.x) { return; }
  let s0 = carrier_state[row * 2u];
  if (u32(carrier_thermo[row * 3u].y + 0.5) != 3u || s0.w <= 0.0) { return; }
  let dims = vec3<i32>(params.dims.xyz);
  let rc = clamp(vec3<i32>(floor((s0.xyz - params.grid.xyz) / params.grid.w)), vec3<i32>(0), dims - vec3<i32>(1));
  let c = u32(rc.x + dims.x * (rc.y + dims.y * rc.z));
  let gas_mass_cell = bitcast<f32>(atomicLoad(&prep[4u + c * 4u + 3u]));
  if (!(gas_mass_cell > 0.0)) { return; }
  let drag_fixed = bitcast<i32>(atomicLoad(&prep[drag_base_word() + c]));
  if (drag_fixed == 0) { return; }
  let dv_y = (f32(drag_fixed) / DRAG_MOMENTUM_FIXED_SCALE) / gas_mass_cell;
  let s1 = carrier_state[row * 2u + 1u];
  carrier_state[row * 2u + 1u] = vec4<f32>(s1.x, s1.y + dv_y, s1.z, s1.w);
}

// Pass 2, one thread per carrier: add every parcel that deposits into it.
@compute @workgroup_size(64)
fn deposit_into_carriers(@builtin(global_invocation_id) id: vec3<u32>) {
  if (atomicLoad(&prep[1u]) == 0u) { return; }
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

// Pass 3, workgroup-parallel exact 9-limb reduction (64 lanes * 3 * 9 * 4 B = 6,912 B):
// the wall sink takes whole wall parcels; the solute sink takes the dry cores of carrier-deposited parcels.
var<workgroup> sh_sink_wall_m: array<ExactMass, 64>;
var<workgroup> sh_sink_wall_e: array<ExactMass, 64>;
var<workgroup> sh_sink_solute: array<ExactMass, 64>;
var<workgroup> sh_sink_err: array<u32, 64>;

@compute @workgroup_size(64)
fn deposit_into_sinks(@builtin(local_invocation_id) lid: vec3<u32>) {
  let lane = lid.x;
  let sink_active = atomicLoad(&prep[2u]) != 0u;
  var wall_mass = ExactMass();
  var wall_energy = ExactMass();
  var solute = ExactMass();
  var err = 0u;
  if (sink_active) {
    for (var p = lane; p < params.counts.y; p = p + 64u) {
      let target_row = parcel_target[p];
      if (target_row == WALL) {
        let a = em_add(wall_mass, load_parcel(p, 0u));
        let b = em_add(a.value, load_parcel(p, 1u));
        let c = el_add(wall_energy, load_parcel(p, 2u));
        err |= a.error | b.error | c.error;
        wall_mass = b.value; wall_energy = c.value;
      } else if (target_row != NONE) {
        let added = em_add(solute, load_parcel(p, 0u));
        err |= added.error;
        solute = added.value;
      }
    }
  }
  sh_sink_wall_m[lane] = wall_mass;
  sh_sink_wall_e[lane] = wall_energy;
  sh_sink_solute[lane] = solute;
  sh_sink_err[lane] = err;
  workgroupBarrier();
  var stride = 32u;
  loop {
    if (stride == 0u) { break; }
    if (lane < stride && sink_active) {
      let a = em_add(sh_sink_wall_m[lane], sh_sink_wall_m[lane + stride]);
      let b = el_add(sh_sink_wall_e[lane], sh_sink_wall_e[lane + stride]);
      let c = em_add(sh_sink_solute[lane], sh_sink_solute[lane + stride]);
      sh_sink_wall_m[lane] = a.value;
      sh_sink_wall_e[lane] = b.value;
      sh_sink_solute[lane] = c.value;
      sh_sink_err[lane] |= sh_sink_err[lane + stride] | a.error | b.error | c.error;
    }
    workgroupBarrier();
    stride = stride / 2u;
  }
  if (sink_active && lane == 0u) {
    let total_m = em_add(load_sink(0u), sh_sink_wall_m[0]);
    let total_e = el_add(load_sink(1u), sh_sink_wall_e[0]);
    let total_s = em_add(load_sink(2u), sh_sink_solute[0]);
    if ((sh_sink_err[0] | total_m.error | total_e.error | total_s.error) != 0u) {
      flag(E_ARITHMETIC);
      return;
    }
    store_sink(0u, total_m.value);
    store_sink(1u, total_e.value);
    store_sink(2u, total_s.value);
  }
}

// Pass 4, one thread per parcel: a deposited parcel's rows become exact zero.
@compute @workgroup_size(64)
fn retire_deposited(@builtin(global_invocation_id) id: vec3<u32>) {
  if (atomicLoad(&prep[2u]) == 0u) { return; }
  let p = id.x;
  if (p >= params.counts.y || parcel_target[p] == NONE) { return; }
  store_parcel(p, 0u, ExactMass()); store_parcel(p, 1u, ExactMass()); store_parcel(p, 2u, ExactMass());
  parcels[p * PARAM_FLOATS + 7u] = 0.0;
}
`;function w({device:n,carrierCount:i,parcelCount:c,dims:l,origin:u,cellSizeM:d,boxM:f,waterMaterialId:p,airDensityKgPerM3:m=1.2,airViscosityPaS:h=181e-7,meanFreePathM:g=66e-9,gravityMPerS2:_=-9.81,twoWayDrag:v=!1,carrierStateBuffer:y,carrierThermoBuffer:b,carrierMassBuffer:w,carrierEnergyBuffer:T,parcelBuffer:E,parcelLedgerBuffer:D,sinkBuffer:O,carrierMechanicsBuffer:k=null,carrierMassRange:A=null}={}){let j=l[0]*l[1]*l[2];(!(i>0)||!(c>0)||!(j>0)||!(d>0))&&S(`counts and grid required`);let M=typeof globalThis.GPUDevice==`function`&&n instanceof globalThis.GPUDevice,N=(e,t,r)=>M?s(a(n,{bucketKey:e,label:e,size:t,usage:r}),n,{bucketKey:e,size:t,usage:r}):n.createBuffer({label:e,size:t,usage:r}),P=N(`ulg-exact-parcel-target`,c*4,x.STORAGE|x.COPY_SRC),F=4+j*4+i*5,I=N(`ulg-exact-parcel-transport-prep`,(F+j)*4,x.STORAGE|x.COPY_DST),L=N(`ulg-exact-parcel-transport-params`,80,x.UNIFORM|x.COPY_DST),R=new ArrayBuffer(80),z=new Uint32Array(R),B=new Float32Array(R);z.set([i,c,j,new Uint32Array(new Float32Array([p]).buffer)[0]],0),z.set([l[0],l[1],l[2],+!!v],4),B.set([u[0],u[1],u[2],d],8),B.set([f[0],f[1],f[2],0],12),B.set([_,m,h,g],16);let V=[`uniform`,`storage`,`read-only-storage`,`storage`,`storage`,`storage`,`storage`,`storage`,`storage`,`storage`,`storage`].map((e,n)=>t(n,e)),H=Object.fromEntries([`prep_water_carriers`,`reduce_cell_gas`,`transport_parcels`,`apply_parcel_drag_to_gas`,`deposit_into_carriers`,`deposit_into_sinks`,`retire_deposited`].map(e=>[e,o(n,{cacheKey:`ulg-exact-parcel-transport-${e}.v4`,label:`ulg-exact-parcel-transport-${e}`,code:C,entryPoint:e,bindings:V})])),U=k?null:n.createBuffer({label:`ulg-exact-parcel-mechanics-scratch`,size:i*128,usage:x.STORAGE}),W=r(n,{layout:H.transport_parcels.bindGroupLayout,entries:[L,y,b,w,T,E,D,P,O,k??U,I].map((e,t)=>({binding:t,resource:t===3&&A?{buffer:e,offset:A.offset,size:A.size}:{buffer:e}}))}),G=!1;return Object.freeze({targetBuffer:P,encode(e,t){G=!0,B[15]=t,n.queue.writeBuffer(L,0,R),e.clearBuffer(I,0,16),v&&e.clearBuffer(I,F*4,j*4);let r=[[`prep_water_carriers`,Math.ceil(i/256)],[`reduce_cell_gas`,j],[`transport_parcels`,c],...v?[[`apply_parcel_drag_to_gas`,Math.ceil(i/64)]]:[],[`deposit_into_carriers`,Math.ceil(i/64)],[`deposit_into_sinks`,1],[`retire_deposited`,Math.ceil(c/64)]];for(let[t,n]of r){let r=e.beginComputePass({label:`ulg-exact-parcel-transport-${t}`});r.setPipeline(H[t].pipeline),r.setBindGroup(0,W),r.dispatchWorkgroups(n),r.end()}},destroy(){e(P,{allowPool:G}),e(I,{allowPool:G}),e(L,{allowPool:G}),U?.destroy()}})}const T=new WeakMap;function E({device:i,particleCount:c,stateBuffer:l,thermoBuffer:u,energy:p,thermalMaterialTable:m}){if(!m?.segments||!Number.isInteger(m.segmentCount))throw TypeError(`Ledger parcel caloric refresh requires the current thermal table`);let h=o(i,{cacheKey:`ulg-ledger-parcel-caloric.v1`,label:`ulg-ledger-parcel-caloric`,code:`
    struct Params { particle_count:u32, segment_count:u32, error_offset:u32, pad:u32 };
    @group(0) @binding(0) var<uniform> params:Params;
    @group(0) @binding(1) var<storage,read> state:array<vec4<f32>>;
    @group(0) @binding(2) var<storage,read_write> thermo:array<vec4<f32>>;
    @group(0) @binding(3) var<storage,read> segments:array<vec4<f32>>;
    @group(0) @binding(4) var<storage,read_write> ledger:array<atomic<u32>>;
    fn finite(v:f32)->bool{return (bitcast<u32>(v)&0x7f800000u)!=0x7f800000u;}
    fn finite4(v:vec4<f32>)->bool{return finite(v.x)&&finite(v.y)&&finite(v.z)&&finite(v.w);}
    fn integer(v:f32)->bool{return finite(v)&&v>=0.0&&v==floor(v);}
    ${f}
    @compute @workgroup_size(64) fn refresh(@builtin(global_invocation_id) id:vec3<u32>){
      let i=id.x;if(i>=params.particle_count || state[2u*i].w<=0.0){return;}
      let t=thermo[3u*i];var has_caloric=false;
      for(var r=0u;r<params.segment_count;r++){
        let a=segments[3u*r];if(a.x==t.x && (a.y==3.0||a.y==4.0||a.y==5.0)){has_caloric=true;}
      }
      if(!has_caloric){return;}
      let temperature=phase_temperature(t.x,state[2u*i+1u].w,t.y);
      if(!(temperature>0.0)){atomicOr(&ledger[params.error_offset],${d.OUTSIDE_DOMAIN}u);return;}
      thermo[3u*i]=vec4<f32>(t.xy,temperature,t.w);
    }`,entryPoint:`refresh`,bindings:[`uniform`,`read-only-storage`,`storage`,`read-only-storage`,`storage`].map((e,n)=>t(n,e))}),g=typeof globalThis.GPUDevice==`function`&&i instanceof globalThis.GPUDevice,_=[],v=(e,t,n,r=!1)=>{let o=Math.max(16,t.byteLength),c=n|GPUBufferUsage.COPY_DST,l=g&&r?s(a(i,{bucketKey:e,label:e,size:o,usage:c}),i,{bucketKey:e,size:o,usage:c}):i.createBuffer({label:e,size:o,usage:c});return _.push(l),i.queue.writeBuffer(l,0,t),l},y=!1;try{let t=v(`ulg-ledger-parcel-caloric-params`,new Uint32Array([c,m.segmentCount,2*c*p.format.wordCount,0]),GPUBufferUsage.UNIFORM,!0),a;if(g&&m.segments?.byteLength>0){let e=n(i),t=T.get(e);t||(t=new WeakMap,T.set(e,t)),a=t.get(m.segments),a||(a=i.createBuffer({label:`ulg-ledger-parcel-caloric-segments`,size:Math.max(16,m.segments.byteLength),usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST}),i.queue.writeBuffer(a,0,m.segments),t.set(m.segments,a))}else a=v(`ulg-ledger-parcel-caloric-segments`,m.segments,GPUBufferUsage.STORAGE);let o=r(i,{layout:h.bindGroupLayout,entries:[t,l,u,a,p.energyBuffer].map((e,t)=>({binding:t,resource:{buffer:e}}))});return{encode(e){y=!0;let t=e.beginComputePass({label:`ulg-ledger-parcel-caloric`});t.setPipeline(h.pipeline),t.setBindGroup(0,o),t.dispatchWorkgroups(Math.ceil(c/64)),t.end()},destroy(){for(let t of _)e(t,{allowPool:y})}}}catch(t){for(let t of _)e(t,{allowPool:!1});throw t}}function D({device:e,parcels:t,particleCount:n,dtSeconds:r,stateBuffer:i,thermoBuffer:a,mechanicsBuffer:o,massRead:s,energy:c,thermalMaterialTable:l}={}){if(!t?.count||!(r>0)||!s?.buffer||!c?.energyBuffer||s.rowCount!==n||c.rowCount!==n)throw TypeError(`Ledger parcel stages require the parcel family and complete carrier records`);let u=t.boxDimensionsM,d=t.cellsPerAxis;if(!u.every(e=>Math.abs(e-u[0])<=1e-9*u[0]))throw TypeError(`Ledger parcel stages require cubic gas cells (a cubic box)`);let f=u[0]/d,p=[d,d,d],m={offset:s.byteOffset,size:s.byteLength},h=y({device:e,gasCount:n,parcelCount:t.count,dims:p,origin:[0,0,0],cellSizeM:f,vaporMaterialId:t.vaporMaterialId,pressurePa:t.pressurePa,waterReferenceU0:t.waterReferenceU0,gasStateBuffer:i,gasThermoBuffer:a,gasMassBuffer:s.buffer,gasMassRange:m,gasEnergyBuffer:c.energyBuffer,parcelBuffer:t.paramsBuffer,parcelLedgerBuffer:t.ledgerBuffer,gasMechanicsBuffer:o}),g=null,_=null;try{return g=w({device:e,carrierCount:n,parcelCount:t.count,dims:p,origin:[0,0,0],cellSizeM:f,boxM:u,waterMaterialId:t.vaporMaterialId,carrierStateBuffer:i,carrierThermoBuffer:a,carrierMassBuffer:s.buffer,carrierMassRange:m,carrierEnergyBuffer:c.energyBuffer,parcelBuffer:t.paramsBuffer,parcelLedgerBuffer:t.ledgerBuffer,sinkBuffer:t.sinkBuffer,carrierMechanicsBuffer:o}),_=E({device:e,particleCount:n,stateBuffer:i,thermoBuffer:a,energy:c,thermalMaterialTable:l}),Object.freeze({targetBuffer:g.targetBuffer,encode(e){h.encode(e,r),g.encode(e,r),_.encode(e)},destroy(){for(let e of[h,g,_])e?.destroy()}})}catch(e){for(let e of[h,g,_])e?.destroy();throw e}}async function O(e){let t=D(e);try{let n=e.device.createCommandEncoder({label:`ulg-ledger-parcel-stages`});t.encode(n),e.device.queue.submit([n.finish()])}finally{i(e.device,t.destroy)}return!0}export{O as n,f as r,D as t};