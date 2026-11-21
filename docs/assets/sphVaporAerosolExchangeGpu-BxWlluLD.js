import{Uo as e}from"./src-C-de1tSE.js";import{Nr as t,P as n,_ as r,g as i,ia as a,ra as o,ta as s,vi as c,vr as l,x as u,yr as d}from"./sphGpuBuffers-CJXVL_XO.js";import{c as f,o as p,p as m}from"./webgpuComputeLayout-C73FiFLJ.js";import{i as h,r as g,s as _}from"./sphGpuDeviceIdentity-CsdIpAMj.js";import{n as v,t as y}from"./sphExactRationalQuantityWgsl-rrOl4iO8.js";import{h as b,l as x,m as S,p as C,u as w}from"./sphReactionLineageGpu-Bcvwq-Ms.js";Object.freeze({PENDING:0,READY:1,FAILED:2});const T=Object.freeze({LAYOUT:1,EOS:2,CALORIC:4,MATERIAL:8,PRODUCT_COUNT:16,PRODUCT:32,PARCEL:64,EDGE:128,OVERLAP:256,SOURCE:512,MECHANICS:1024,DOMAIN:2048,NUMERIC:4096,CONSERVATION:8192,COMPLETION:16384});Object.freeze({MAGIC:0,VERSION:1,STATUS:2,ERROR_BITS:3,EDGE_COUNT:4,ACCEPTED_EDGES:5,PRODUCT_LIVE_COUNT:6,READY_PARCEL_COUNT:7,OUTPUT_COUNT_GENERATION:8,OUTPUT_COUNT_SEAL:9,EXPECTED_EOS_GENERATION:10}),Object.freeze({PARTICLE_COUNT:0,PRODUCT_CAPACITY:1,AEROSOL_CAPACITY:2,EDGE_COUNT:3,MATERIAL_COUNT:4,STATE_OFFSET:5,THERMO_OFFSET:6,MECHANICS_OFFSET:7,PRODUCT_OFFSET:8,PARCEL_OFFSET:9,EOS_CONTROL_OFFSET:10,COMPACT_OFFSET:11,CALORIC_CELLS_OFFSET:12,PRODUCT_COUNT_OFFSET:13,EXPECTED_EOS_GENERATION:14,COMPACT_CAPACITY:15,CALORIC_CELL_CAPACITY:16,SOURCE_WORD_COUNT:17,PRODUCT_COUNT_PRESENT:18,OUTPUT_COUNT_GENERATION:19,OUTPUT_COUNT_SEAL:20,SOURCE_COUNT_GENERATION:21,SOURCE_COUNT_SEAL:22}),Object.freeze({GAS_KIND:0,GAS_INDEX:1,PARCEL_INDEX:2,MATERIAL_ROW:3,DELTA_MASS:4,ENTHALPY_CORRECTION:5,CONDUCTIVE_HEAT:6,PRESSURE_WORK_INTO_LIQUID:7}),Object.freeze({PARTICLE:0,UNPLACED_PRODUCT:1}),Object.freeze({MATERIAL_ID:0,MOLAR_MASS:1,GAS_U_LO:2,GAS_U_HI:3,LIQUID_U_LO:4,LIQUID_U_HI:5,TEMPERATURE_MIN:6,TEMPERATURE_MAX:7,LIQUID_DENSITY:8,SIGMA_INTERCEPT:9,SIGMA_SLOPE:10,SURFACE_READY:11,GAS_CV:12,GAMMA:13,MAX_PRESSURE:14,GAS_ONLY:15}),Object.freeze({OLD_AREA:0,OLD_INTERNAL_ENERGY:1,NEW_AREA:2,NEW_INTERNAL_ENERGY:3});const E=`
struct ExchangeParams { words: array<vec4<u32>, 8>, };
@group(0) @binding(0) var<uniform> params: ExchangeParams;
@group(0) @binding(1) var<storage, read> source: array<u32>;
@group(0) @binding(2) var<storage, read> edges: array<u32>;
@group(0) @binding(3) var<storage, read> materials: array<f32>;
@group(0) @binding(4) var<storage, read_write> candidate: array<u32>;
@group(0) @binding(5) var<storage, read_write> surfaces: array<f32>;
@group(0) @binding(6) var<storage, read_write> control: array<atomic<u32>>;

const EXCHANGE_MAGIC: u32 = 1447118128u;
const EXCHANGE_VERSION: u32 = 1u;
${Object.entries(T).map(([e,t])=>`const ERROR_${e}: u32 = ${t}u;`).join(`
`)}
const EXCHANGE_MAX_F32: f32 = 3.402823466e38;
const EXCHANGE_R: f32 = 8.31446261815324;
const EXCHANGE_AVOGADRO: f32 = 6.02214076e23;
const EXCHANGE_PI4: f32 = 12.566370614359172;
const EXCHANGE_SHARED_MASS_SUPPORTED: bool = false;

fn xp(lane: u32) -> u32 { return params.words[lane / 4u][lane % 4u]; }
fn xf(word: u32) -> f32 { return bitcast<f32>(source[word]); }
fn xc(word: u32, value: f32) { candidate[word] = bitcast<u32>(value); }
fn xfinite(x: f32) -> bool { return x == x && abs(x) <= EXCHANGE_MAX_F32; }
fn xpos(x: f32) -> bool { return xfinite(x) && x > 0.0; }
fn xnonneg(x: f32) -> bool { return xfinite(x) && x >= 0.0; }
fn xrelative(a: f32, b: f32) -> bool {
  return xfinite(a) && xfinite(b) && abs(a - b) <= 1.0e-5 * max(abs(a), abs(b));
}
fn xtemperature(a: f32, b: f32, max_t: f32) -> bool {
  return xfinite(a) && xfinite(b) && abs(a - b) <= max(1.0e-4, max_t * 1.0e-6);
}
fn xvecfinite(v: vec3<f32>) -> bool {
  return all(v == v) && all(abs(v) <= vec3<f32>(EXCHANGE_MAX_F32));
}
fn exchange_record_error(error: u32) { atomicOr(&control[3u], error); }
fn xedge_fail(edge: u32, error: u32) {
  exchange_record_error(error); atomicStore(&control[16u + edge], 0x80000000u | error);
}
fn xrange(offset: u32, count: u32, stride: u32) -> bool {
  return offset <= xp(17u) && count <= (xp(17u) - min(offset, xp(17u))) / stride;
}
fn xlayout() -> bool {
  if (xp(17u) > arrayLength(&source) || xp(17u) > arrayLength(&candidate)
      || arrayLength(&control) < 16u || xp(3u) > arrayLength(&control) - 16u
      || xp(3u) > arrayLength(&edges) / 8u
      || xp(4u) == 0u || xp(4u) > arrayLength(&materials) / 16u
      || xp(2u) > arrayLength(&surfaces) / 4u || xp(3u) == 0u
      || xp(0u) > 16777215u || xp(1u) > 16777215u
      || xp(18u) > 1u || (xp(18u) == 0u && xp(1u) != 0u)
      || (xp(18u) == 0u && (xp(21u) != 0u || xp(22u) != 0u))
      || (xp(18u) == 1u && (xp(21u) == 0u || xp(22u) == 0u))
      || (xp(18u) == 1u && (xp(1u) == 0u || xp(13u) % 64u != 0u))
      || xp(14u) == 0u || xp(19u) == 0u || xp(20u) == 0u) { return false; }
  for (var lane = 23u; lane < 32u; lane++) { if (xp(lane) != 0u) { return false; } }
  if (!xrange(xp(5u), xp(0u), 8u) || !xrange(xp(6u), xp(0u), 12u)
      || !xrange(xp(7u), xp(0u), 32u) || !xrange(xp(8u), xp(1u), 32u)
      || !xrange(xp(9u), xp(2u), 24u) || !xrange(xp(10u), 1u, 36u)
      || !xrange(xp(11u), xp(15u), 16u) || !xrange(xp(12u), xp(16u), 8u)
      || !xrange(xp(13u), xp(18u), 64u)) { return false; }
  var segments: array<vec2<u32>, 9>;
  segments[0] = vec2<u32>(xp(5u), xp(0u) * 8u);
  segments[1] = vec2<u32>(xp(6u), xp(0u) * 12u);
  segments[2] = vec2<u32>(xp(7u), xp(0u) * 32u);
  segments[3] = vec2<u32>(xp(8u), xp(1u) * 32u);
  segments[4] = vec2<u32>(xp(9u), xp(2u) * 24u);
  segments[5] = vec2<u32>(xp(10u), 36u);
  segments[6] = vec2<u32>(xp(11u), xp(15u) * 16u);
  segments[7] = vec2<u32>(xp(12u), xp(16u) * 8u);
  segments[8] = vec2<u32>(xp(13u), xp(18u) * 64u);
  for (var i = 0u; i < 9u; i++) {
    for (var j = i + 1u; j < 9u; j++) {
      let a = segments[i]; let b = segments[j];
      if (a.y != 0u && b.y != 0u && a.x < b.x + b.y && b.x < a.x + a.y) { return false; }
    }
  }
  return true;
}
fn xmaterial_valid(row: u32) -> bool {
  let m = row * 16u;
  for (var lane = 0u; lane < 16u; lane++) { if (!xfinite(materials[m + lane])) { return false; } }
  let id = materials[m]; let min_t = materials[m + 6u]; let max_t = materials[m + 7u];
  if (!(id >= 1.0 && id <= 16777215.0 && floor(id) == id)
      || !xpos(materials[m + 1u]) || !xpos(materials[m + 3u] - materials[m + 2u])
      || !xpos(min_t) || !xpos(max_t - min_t) || !xpos(materials[m + 12u])
      || !(materials[m + 13u] > 1.0) || !xpos(materials[m + 14u])) { return false; }
  if (materials[m + 15u] == 1.0) {
    if (materials[m + 4u] != 0.0 || materials[m + 5u] != 0.0 || materials[m + 8u] != 0.0
      || materials[m + 9u] != 0.0 || materials[m + 10u] != 0.0 || materials[m + 11u] != 0.0) { return false; }
  } else if (materials[m + 15u] != 0.0 || !xpos(materials[m + 5u] - materials[m + 4u])
    || !xpos(materials[m + 8u])) { return false; }
  // Ordinary inert gas members need caloric authority, not an invented
  // liquid-surface law. Only a parcel/selected transfer needs surfaceReady1.
  if (materials[m + 11u] == 1.0) {
    if (!xpos(materials[m + 9u])
        || !xpos(materials[m + 9u] + materials[m + 10u] * min_t)
        || !xpos(materials[m + 9u] + materials[m + 10u] * max_t)) { return false; }
  } else if (materials[m + 11u] != 0.0 || materials[m + 9u] != 0.0 || materials[m + 10u] != 0.0) { return false; }
  let cv = (materials[m + 3u] - materials[m + 2u]) / (max_t - min_t);
  let gamma = 1.0 + (EXCHANGE_R / materials[m + 1u]) / materials[m + 12u];
  return xrelative(cv, materials[m + 12u]) && xrelative(gamma, materials[m + 13u]);
}
fn xmaterial_for(id: u32) -> u32 {
  for (var row = 0u; row < xp(4u); row++) { if (materials[row * 16u] == f32(id)) { return row; } }
  return 0xffffffffu;
}
fn xphase_t(row: u32, u: f32, liquid: bool) -> f32 {
  let m = row * 16u; let offset = select(2u, 4u, liquid);
  if (liquid && materials[m + 15u] == 1.0) { return -1.0; }
  let lo = materials[m + offset]; let hi = materials[m + offset + 1u];
  if (!xfinite(u) || u < lo || u > hi) { return -1.0; }
  let t = materials[m + 6u] + ((u - lo) / (hi - lo)) * (materials[m + 7u] - materials[m + 6u]);
  if (!xpos(t) || t < materials[m + 6u] || t > materials[m + 7u]) { return -1.0; }
  return t;
}
fn xradius(mass: f32, density: f32, lo: u32, hi: u32) -> f32 {
  let population = f32(hi) * 4294967296.0 + f32(lo);
  return exp((log(mass) - log(density) - log(population) - 1.432411958301181) / 3.0);
}
fn xarea(radius: f32, lo: u32, hi: u32) -> f32 {
  let population = f32(hi) * 4294967296.0 + f32(lo);
  return (EXCHANGE_PI4 * radius) * (population * radius);
}
fn xall_zero(offset: u32, count: u32) -> bool {
  for (var i = 0u; i < count; i++) { if (source[offset + i] != 0u) { return false; } }
  return true;
}
fn xeos_valid() -> bool {
  let e = xp(10u); let status = source[e + 2u];
  let live = source[e + 8u]; let cells = source[e + 10u];
  if (source[e] != 0x53474133u || source[e + 1u] != 4u
      || (status & 31u) != 31u || (status & 0x80000000u) != 0u || source[e + 3u] != 0u
      || source[e + 4u] != xp(14u) || source[e + 5u] != xp(14u)
      || source[e + 7u] != xp(15u) || live > xp(15u)
      || cells > xp(16u) || cells > live || source[e + 11u] != cells
      || source[e + 31u] != cells || source[e + 28u] != 16u
      || source[e + 29u] != 16u || source[e + 30u] != 12u) { return false; }
  for (var lane = 12u; lane < 16u; lane++) { if (source[e + lane] != 0u) { return false; } }
  return true;
}
fn xcaloric_valid() -> bool {
  let count = source[xp(10u) + 10u];
  for (var cell = 0u; cell < count; cell++) {
    let row = xp(12u) + cell * 8u;
    for (var lane = 0u; lane < 8u; lane++) { if (!xfinite(xf(row + lane))) { return false; } }
    let capacity = xf(row); let anchor = xf(row + 2u); let equilibrium = xf(row + 3u);
    let min_t = xf(row + 4u); let max_t = xf(row + 5u); let members = xf(row + 6u);
    if (!xpos(capacity) || !xpos(min_t) || !(max_t >= min_t) || !xpos(members)
        || floor(members) != members || xf(row + 7u) != 1.0
        || anchor < min_t || anchor > max_t || equilibrium < min_t || equilibrium > max_t
        || !xtemperature(anchor + xf(row + 1u) / capacity, equilibrium, max_t)) { return false; }
  }
  return true;
}
fn xproduct_count() -> u32 {
  if (xp(18u) == 0u) { return 0u; }
  let c = xp(13u); let live = source[c + 3u];
  if (source[c] != 0x50484731u || source[c + 1u] != 1u || source[c + 2u] != 1u
      || live > xp(1u) || source[c + 4u] != xp(1u) || source[c + 5u] != 8u
      || source[c + 6u] != xp(21u) || source[c + 7u] != xp(22u)
      || source[c + 8u] != live / 64u + select(0u, 1u, live % 64u != 0u)
      || source[c + 9u] != 1u || source[c + 10u] != 1u || source[c + 11u] != 0u) {
    exchange_record_error(ERROR_PRODUCT_COUNT); return 0u;
  }
  return live;
}

@compute @workgroup_size(1)
fn initialize_vapor_aerosol_exchange() {
  if (arrayLength(&control) < 16u) { return; }
  for (var lane = 0u; lane < 16u; lane++) { atomicStore(&control[lane], 0u); }
  atomicStore(&control[0u], EXCHANGE_MAGIC); atomicStore(&control[1u], EXCHANGE_VERSION);
  atomicStore(&control[4u], xp(3u)); atomicStore(&control[8u], xp(19u));
  atomicStore(&control[9u], xp(20u)); atomicStore(&control[10u], xp(14u));
  if (!xlayout()) { exchange_record_error(ERROR_LAYOUT); return; }
  for (var edge = 0u; edge < xp(3u); edge++) { atomicStore(&control[16u + edge], 0u); }
  if (!xeos_valid()) { exchange_record_error(ERROR_EOS); return; }
  if (!xcaloric_valid()) { exchange_record_error(ERROR_CALORIC); return; }
  for (var row = 0u; row < xp(4u); row++) {
    if (!xmaterial_valid(row)) { exchange_record_error(ERROR_MATERIAL); return; }
    for (var other = 0u; other < row; other++) {
      if (materials[row * 16u] == materials[other * 16u]) { exchange_record_error(ERROR_MATERIAL); return; }
    }
  }
  let live = xproduct_count();
  if (atomicLoad(&control[3u]) != 0u) { return; }
  atomicStore(&control[6u], live);
  // The original history includes placed mass already present in S/T/M.
  // Candidate history owns ONLY its original unplaced residual. Preserve
  // every inventory kind; this is not a gas-only history rewrite.
  for (var index = 0u; index < xp(1u); index++) {
    let h = xp(8u) + index * 32u;
    if (index >= live) {
      if (!xall_zero(h, 32u)) { exchange_record_error(ERROR_PRODUCT_COUNT); return; }
      continue;
    }
    let mass = xf(h + 3u); let placed = xf(h + 12u); let residual = xf(h + 13u);
    if (!xnonneg(mass) || !xnonneg(placed) || !xnonneg(residual)
        || !xrelative(mass, placed + residual)) { exchange_record_error(ERROR_PRODUCT); return; }
    if (residual == 0.0) {
      // Keep row identity, density and provenance: the real successor gas
      // adapter validates those fields even before skipping zero inventory.
      // Historical U/T may be nonfinite in an empty row and are not energy.
      xc(h + 3u, 0.0); xc(h + 9u, 0.0); xc(h + 12u, 0.0);
      xc(h + 13u, 0.0); xc(h + 23u, 0.0);
      continue;
    }
    for (var lane = 0u; lane < 32u; lane++) { if (!xfinite(xf(h + lane))) { exchange_record_error(ERROR_PRODUCT); return; } }
    let fraction = residual / mass;
    let n = xf(h + 9u) * fraction; let volume = xf(h + 23u) * fraction;
    if (!xpos(mass) || placed > mass || residual > mass || xf(h + 18u) != 1.0
        || !(xf(h + 11u) >= 1.0 && xf(h + 11u) <= 4.0)
        || !xpos(n) || !xpos(volume) || !xpos(xf(h + 17u)) || !xpos(xf(h + 16u))) {
      exchange_record_error(ERROR_PRODUCT); return;
    }
    xc(h + 3u, residual); xc(h + 9u, n); xc(h + 12u, 0.0);
    xc(h + 13u, residual); xc(h + 23u, volume);
  }
  for (var index = 0u; index < xp(2u); index++) {
    let a = xp(9u) + index * 24u;
    for (var lane = 0u; lane < 4u; lane++) { surfaces[index * 4u + lane] = 0.0; }
    if (xall_zero(a, 24u)) { continue; }
    for (var lane = 0u; lane < 11u; lane++) { if (!xfinite(xf(a + lane))) { exchange_record_error(ERROR_PARCEL); return; } }
    let row = xmaterial_for(source[a + 12u]);
    if (row == 0xffffffffu || source[a + 13u] != 2u || source[a + 22u] != 1u
        || source[a + 11u] != 0u || (source[a + 14u] | source[a + 15u]) == 0u
        || (source[a + 16u] | source[a + 17u]) == 0u
        || (source[a + 20u] | source[a + 21u]) == 0u
        || (source[a + 23u] != 1u && source[a + 23u] != 2u)
        || !xpos(xf(a + 3u)) || !xpos(xf(a + 9u)) || !xpos(xf(a + 10u))) { exchange_record_error(ERROR_PARCEL); return; }
    let m = row * 16u; let t = xphase_t(row, xf(a + 7u), true);
    if (materials[m + 11u] != 1.0) { exchange_record_error(ERROR_PARCEL); return; }
    let radius = xradius(xf(a + 3u), materials[m + 8u], source[a + 14u], source[a + 15u]);
    let area = xarea(xf(a + 10u), source[a + 14u], source[a + 15u]);
    let energy = materials[m + 9u] * area;
    if (!(t > 0.0) || !xtemperature(t, xf(a + 8u), materials[m + 7u])
        || xf(a + 9u) != materials[m + 8u] || !xrelative(radius, xf(a + 10u))
        || !xpos(area) || !xpos(energy)) { exchange_record_error(ERROR_PARCEL); return; }
    surfaces[index * 4u] = area; surfaces[index * 4u + 1u] = energy;
    surfaces[index * 4u + 2u] = area; surfaces[index * 4u + 3u] = energy;
    atomicAdd(&control[7u], 1u);
  }
  // Heat graphs may share endpoints; mass transfers remain fully disjoint.
  // Check the complete batch BEFORE any transfer dispatch.
  for (var edge = 0u; edge < xp(3u); edge++) {
    let b = edge * 8u;
    if (edges[b] > 1u || edges[b + 2u] >= xp(2u) || edges[b + 3u] >= xp(4u)
        || (edges[b] == 0u && edges[b + 1u] >= xp(0u))
        || (edges[b] == 1u && edges[b + 1u] >= live)) { xedge_fail(edge, ERROR_EDGE); return; }
    for (var other = 0u; other < edge; other++) {
      let c = other * 8u;
      if (!EXCHANGE_SHARED_MASS_SUPPORTED && ((edges[b] == edges[c] && edges[b + 1u] == edges[c + 1u])
          || edges[b + 2u] == edges[c + 2u])
          && (((edges[b + 4u] | edges[c + 4u]) & 0x7fffffffu) != 0u)) {
        xedge_fail(edge, ERROR_OVERLAP); return;
      }
    }
  }
}

struct ExchangeGas {
  position: vec3<f32>, velocity: vec3<f32>, mass: f32, u: f32,
  temperature: f32, density: f32, moles: f32, valid: u32,
};
fn xgas(edge: u32, material_row: u32) -> ExchangeGas {
  var result: ExchangeGas;
  let b = edge * 8u; let kind = edges[b]; let index = edges[b + 1u];
  let material = materials[material_row * 16u];
  if (kind == 0u) {
    let s = xp(5u) + index * 8u; let t = xp(6u) + index * 12u;
    for (var lane = 0u; lane < 8u; lane++) { if (!xfinite(xf(s + lane))) { return result; } }
    for (var lane = 0u; lane < 12u; lane++) { if (!xfinite(xf(t + lane))) { return result; } }
    if (xf(t) != material || xf(t + 1u) != 3.0 || xf(t + 4u) != 0.0
        || xf(t + 5u) != 0.0 || xf(t + 6u) != 1.0 || xf(t + 7u) != 0.0
        || xf(t + 10u) != 1.0 || !xpos(xf(t + 9u))
        || !xpos(xf(t + 8u)) || !xnonneg(xf(t + 11u))) { return result; }
    result.position = vec3<f32>(xf(s), xf(s + 1u), xf(s + 2u));
    result.velocity = vec3<f32>(xf(s + 4u), xf(s + 5u), xf(s + 6u));
    result.mass = xf(s + 3u); result.u = xf(s + 7u); result.temperature = xf(t + 2u);
    result.density = xf(t + 3u); result.moles = xf(t + 9u) / EXCHANGE_AVOGADRO;
  } else {
    let h = xp(8u) + index * 32u;
    if (xf(h + 4u) != material || xf(h + 11u) != 3.0 || xf(h + 10u) != 1.0 || xf(h + 18u) != 1.0) { return result; }
    result.position = vec3<f32>(xf(h), xf(h + 1u), xf(h + 2u));
    result.velocity = vec3<f32>(xf(h + 20u), xf(h + 21u), xf(h + 22u));
    result.mass = xf(h + 13u); result.u = xf(h + 19u); result.temperature = xf(h + 16u);
    result.density = xf(h + 17u); result.moles = xf(h + 9u) * (result.mass / xf(h + 3u));
  }
  if (!xpos(result.mass) || !xpos(result.density) || !xpos(result.moles)
      || !xrelative(result.mass / result.moles, materials[material_row * 16u + 1u])) { return result; }
  let resolved_t = xphase_t(material_row, result.u, false);
  if (!(resolved_t > 0.0) || !xtemperature(resolved_t, result.temperature, materials[material_row * 16u + 7u])) { return result; }
  // Membership is a witness from the exact actual EOS source, not a caller's
  // manufactured compact row. -1 identifies particles; products carry their
  // real term index, NOT the edge's 0/1 discriminant.
  let live = source[xp(10u) + 8u]; var matches = 0u;
  for (var member = 0u; member < live; member++) {
    let c = xp(11u) + member * 16u;
    var discriminant = -1.0;
    if (kind == 1u) { discriminant = xf(xp(8u) + index * 32u + 5u); }
    if (xf(c + 8u) != discriminant || xf(c + 9u) != f32(index)) { continue; }
    for (var lane = 0u; lane < 16u; lane++) { if (!xfinite(xf(c + lane))) { return result; } }
    if (any(vec3<f32>(xf(c), xf(c + 1u), xf(c + 2u)) != result.position)
        || xf(c + 3u) != material || xf(c + 4u) != result.mass
        || !xrelative(xf(c + 5u), result.moles) || xf(c + 6u) != result.temperature
        || !xrelative(xf(c + 7u), result.mass / result.density)
        || xf(c + 10u) != 1.0 || xf(c + 11u) != 1.0 || xf(c + 12u) != result.u
        || xf(c + 13u) != result.temperature || xf(c + 14u) != 3.0 || xf(c + 15u) != 0.0) { return result; }
    matches++;
  }
  if (matches == 1u) { result.valid = 1u; }
  return result;
}
fn xmechanics_valid(kind: u32, index: u32, gas: ExchangeGas, row: u32) -> bool {
  let m = row * 16u;
  let expected_c = sqrt(materials[m + 13u] * (EXCHANGE_R / materials[m + 1u]) * gas.temperature);
  if (!xpos(expected_c)) { return false; }
  if (kind == 1u) {
    let h = xp(8u) + index * 32u;
    return xrelative(xf(h + 23u), xf(h + 3u) / gas.density)
      && xnonneg(xf(h + 24u)) && xf(h + 25u) == 0.0 && xf(h + 26u) == 0.0
      && xrelative(xf(h + 27u), expected_c) && xf(h + 28u) == 2.0
      && xf(h + 29u) == 0.0 && xf(h + 30u) == 1.0;
  }
  let b = xp(7u) + index * 32u;
  for (var lane = 0u; lane < 32u; lane++) { if (!xfinite(xf(b + lane))) { return false; } }
  for (var lane = 0u; lane < 9u; lane++) {
    if (xf(b + lane) != select(0.0, 1.0, lane == 0u || lane == 4u || lane == 8u)) { return false; }
  }
  for (var lane = 9u; lane < 18u; lane++) { if (xf(b + lane) != 0.0) { return false; } }
  return xf(b + 18u) == 1.0 && xrelative(xf(b + 19u), gas.mass / gas.density)
    && xf(b + 20u) == 0.0 && xf(b + 21u) == 1.0 && xnonneg(xf(b + 22u))
    && xf(b + 23u) == 0.0 && xf(b + 24u) == 0.0 && xrelative(xf(b + 25u), expected_c)
    && xf(b + 26u) == 2.0 && xf(b + 27u) == 1.0 && xnonneg(xf(b + 28u))
    && xnonneg(xf(b + 29u)) && xf(b + 30u) == 0.0 && xrelative(xf(b + 31u), gas.mass);
}

// Exact accumulation of the supplied f32 heat packets, including cancellation.
// A finite f32 is an integer multiple of 2^-149. Ten u32 limbs cover the full
// f32 range plus all 24 bits of supported edge count. This is proposal-sum
// bookkeeping, NOT a replacement representation for resident mass or energy.
fn xheat_add(words: ptr<function, array<u32, 10>>, start: u32, addend: u32) {
  var carry = addend;
  for (var i = start; i < 10u && carry != 0u; i++) {
    let old = (*words)[i]; let next = old + carry;
    (*words)[i] = next; carry = select(0u, 1u, next < old);
  }
}
struct ExchangeHeatTotal { value: f32, first: u32, valid: u32, };
fn xheat_total(edge: u32, gas_endpoint: bool) -> ExchangeHeatTotal {
  var result: ExchangeHeatTotal; result.first = 0xffffffffu;
  var positive: array<u32, 10>; var negative: array<u32, 10>;
  let b = edge * 8u;
  for (var other = 0u; other < xp(3u); other++) {
    let c = other * 8u;
    let same = select(edges[b + 2u] == edges[c + 2u],
      edges[b] == edges[c] && edges[b + 1u] == edges[c + 1u], gas_endpoint);
    if (!same) { continue; }
    if (((edges[c + 4u] | edges[c + 5u] | edges[c + 7u]) & 0x7fffffffu) != 0u) { return result; }
    result.first = min(result.first, other);
    let bits = edges[c + 6u]; let exponent = (bits >> 23u) & 255u;
    if (exponent == 255u) { return result; }
    let significand = (bits & 0x007fffffu) | select(0u, 0x00800000u, exponent != 0u);
    let shift = select(0u, exponent - 1u, exponent != 0u);
    let word = shift / 32u; let offset = shift % 32u;
    let lo = significand << offset; var hi = 0u;
    if (offset != 0u) { hi = significand >> (32u - offset); }
    if ((bits & 0x80000000u) == 0u) {
      xheat_add(&positive, word, lo); xheat_add(&positive, word + 1u, hi);
    } else {
      xheat_add(&negative, word, lo); xheat_add(&negative, word + 1u, hi);
    }
  }
  var is_negative = false;
  for (var i = 10u; i > 0u; i--) {
    if (positive[i - 1u] != negative[i - 1u]) {
      is_negative = positive[i - 1u] < negative[i - 1u]; break;
    }
  }
  var magnitude: array<u32, 10>; var borrow = 0u;
  for (var i = 0u; i < 10u; i++) {
    let a = select(positive[i], negative[i], is_negative);
    let c = select(negative[i], positive[i], is_negative);
    magnitude[i] = a - c - borrow;
    borrow = select(0u, 1u, a < c || (borrow == 1u && a == c));
  }
  var high = 0xffffffffu;
  for (var i = 10u; i > 0u; i--) {
    if (magnitude[i - 1u] != 0u) { high = (i - 1u) * 32u + 31u - countLeadingZeros(magnitude[i - 1u]); break; }
  }
  if (high == 0xffffffffu) { result.valid = 1u; return result; }
  if (high > 276u) { return result; } // No finite f32 endpoint sum.
  let sign = select(0u, 0x80000000u, is_negative);
  // WebGPU backends may flush subnormals. Never call a nonzero exact packet
  // zero merely because its floating projection is flushed on this device.
  if (high < 23u) { return result; }
  let shift = high - 23u; let word = shift / 32u; let offset = shift % 32u;
  for (var i = 0u; i < word; i++) { if (magnitude[i] != 0u) { return result; } }
  if ((magnitude[word] & ((1u << offset) - 1u)) != 0u) { return result; }
  var significand = magnitude[word] >> offset;
  if (offset != 0u) { significand |= magnitude[word + 1u] << (32u - offset); }
  result.value = bitcast<f32>(sign | ((high - 22u) << 23u) | (significand & 0x007fffffu));
  result.valid = 1u; return result;
}

fn xapply_heat(edge: u32) {
  let b = edge * 8u; let kind = edges[b]; let index = edges[b + 1u];
  let parcel_index = edges[b + 2u]; let row = edges[b + 3u]; let m = row * 16u;
  let a = xp(9u) + parcel_index * 24u;
  if (((edges[b + 5u] | edges[b + 7u]) & 0x7fffffffu) != 0u
      || !xfinite(bitcast<f32>(edges[b + 6u]))) { xedge_fail(edge, ERROR_EDGE); return; }
  let gas = xgas(edge, row); let liquid_row = xmaterial_for(source[a + 12u]);
  if (gas.valid != 1u || liquid_row == 0xffffffffu || source[a + 22u] != 1u
      || source[a + 13u] != 2u
      || any(vec3<f32>(xf(a), xf(a + 1u), xf(a + 2u)) != gas.position)) { xedge_fail(edge, ERROR_SOURCE); return; }
  if (!xmechanics_valid(kind, index, gas, row)) { xedge_fail(edge, ERROR_MECHANICS); return; }
  let gas_heat = xheat_total(edge, true); let liquid_heat = xheat_total(edge, false);
  if (gas_heat.valid != 1u || liquid_heat.valid != 1u) { xedge_fail(edge, ERROR_NUMERIC); return; }
  // Each endpoint has exactly one writer. Every gather uses immutable source,
  // including when several species exchange heat with several shared parcels.
  if (gas_heat.first == edge && gas_heat.value != 0.0) {
    let u = gas.u - gas_heat.value / gas.mass; let t = xphase_t(row, u, false);
    let c = sqrt(materials[m + 13u] * (EXCHANGE_R / materials[m + 1u]) * t);
    if (!xpos(t) || !xpos(c)) { xedge_fail(edge, ERROR_DOMAIN); return; }
    if (kind == 0u) {
      xc(xp(5u) + index * 8u + 7u, u); xc(xp(6u) + index * 12u + 2u, t);
      xc(xp(7u) + index * 32u + 25u, c);
    } else {
      let h = xp(8u) + index * 32u;
      xc(h + 19u, u); xc(h + 16u, t); xc(h + 27u, c);
    }
  }
  if (liquid_heat.first == edge && liquid_heat.value != 0.0) {
    let u = xf(a + 7u) + liquid_heat.value / xf(a + 3u); let t = xphase_t(liquid_row, u, true);
    if (!xpos(t)) { xedge_fail(edge, ERROR_DOMAIN); return; }
    xc(a + 7u, u); xc(a + 8u, t);
  }
  // Fixed masses/densities/population imply fixed area and U_surface=a*A.
  // No phase credit, pressure work, velocity, radius or volume change occurs.
  atomicStore(&control[16u + edge], 1u); atomicAdd(&control[5u], 1u);
}

@compute @workgroup_size(64)
fn apply_vapor_aerosol_exchange(
  @builtin(global_invocation_id) id: vec3<u32>,
  @builtin(num_workgroups) groups: vec3<u32>
) {
  let edge = id.x + groups.x * 64u * (id.y + groups.y * id.z);
  if (arrayLength(&control) < 16u || edge >= xp(3u) || !xlayout()) { return; }
  if (atomicLoad(&control[3u]) != 0u) { return; }
  let b = edge * 8u; let kind = edges[b]; let index = edges[b + 1u];
  let parcel_index = edges[b + 2u]; let row = edges[b + 3u]; let m = row * 16u;
  let a = xp(9u) + parcel_index * 24u;
  let dm_requested = bitcast<f32>(edges[b + 4u]);
  let enthalpy_correction = bitcast<f32>(edges[b + 5u]);
  let conductive_heat = bitcast<f32>(edges[b + 6u]);
  let pressure_work = bitcast<f32>(edges[b + 7u]);
  // Classify the supplied request by integer bits, never by floating zero.
  let dm_magnitude = edges[b + 4u] & 0x7fffffffu;
  if (dm_magnitude == 0u) { xapply_heat(edge); return; }
  if (dm_magnitude < 0x00800000u) { xedge_fail(edge, ERROR_NUMERIC); return; }
  if (!xfinite(dm_requested) || dm_requested == 0.0 || !xfinite(enthalpy_correction)
      || !xfinite(conductive_heat) || !xfinite(pressure_work)) { xedge_fail(edge, ERROR_EDGE); return; }
  let gas = xgas(edge, row);
  if (gas.valid != 1u || source[a + 22u] != 1u || source[a + 13u] != 2u
      || f32(source[a + 12u]) != materials[m] || materials[m + 11u] != 1.0
      || any(vec3<f32>(xf(a), xf(a + 1u), xf(a + 2u)) != gas.position)) { xedge_fail(edge, ERROR_SOURCE); return; }
  if (!xmechanics_valid(kind, index, gas, row)) { xedge_fail(edge, ERROR_MECHANICS); return; }
  let ml = xf(a + 3u); let ul = xf(a + 7u);
  let vl = vec3<f32>(xf(a + 4u), xf(a + 5u), xf(a + 6u));
  var mg_next = gas.mass - dm_requested; var ml_next = ml;
  var dm = 0.0; var common_debit_credit = false;
  // At most three f32 lattice projections. This reconciles different owner
  // ulps; it does NOT choose a kinetic rate or allow a nonconservative debit.
  for (var attempt = 0u; attempt < 3u; attempt++) {
    let gas_debit = gas.mass - mg_next;
    ml_next = ml + gas_debit;
    let liquid_credit = ml_next - ml;
    mg_next = gas.mass - liquid_credit;
    dm = gas.mass - mg_next;
    if (dm == liquid_credit) { common_debit_credit = true; break; }
  }
  if (!xpos(mg_next) || !xpos(ml_next)) { xedge_fail(edge, ERROR_DOMAIN); return; }
  // Use ONE actual, representable debit/credit. No epsilon erasure of a
  // positive carrier and no gauge-dependent unequal species mass update.
  if (!common_debit_credit || dm == 0.0 || !xrelative(dm, dm_requested)
      || (dm > 0.0) != (dm_requested > 0.0)) { xedge_fail(edge, ERROR_NUMERIC); return; }
  let condenses = dm > 0.0; let moved = abs(dm);
  let donor_u = select(ul, gas.u, condenses);
  let donor_v = select(vl, gas.velocity, condenses);
  let delta_v = gas.velocity - vl;
  let receiver_fraction = select(gas.mass / mg_next, ml / ml_next, condenses);
  let mixing_heat = 0.5 * moved * receiver_fraction * dot(delta_v, delta_v);
  let heat_into_liquid = enthalpy_correction + conductive_heat;
  let transfer_into_liquid = heat_into_liquid + pressure_work;
  var vg_next = gas.velocity; var vl_next = vl;
  if (condenses) { vl_next = vl + (moved / ml_next) * (gas.velocity - vl); }
  else { vg_next = gas.velocity + (moved / mg_next) * (vl - gas.velocity); }
  let radius_next = xradius(ml_next, materials[m + 8u], source[a + 14u], source[a + 15u]);
  let area_next = xarea(radius_next, source[a + 14u], source[a + 15u]);
  let surface_next = materials[m + 9u] * area_next;
  let surface_before = surfaces[parcel_index * 4u + 1u];
  let surface_change = surface_next - surface_before;
  // Center both phases on the SAME species gauge. The phase U offsets are
  // still present, so there is deliberately no independent +L*dm term.
  let gauge = materials[m + 4u];
  let gas_centered_before = gas.mass * (gas.u - gauge);
  let liquid_centered_before = ml * (ul - gauge);
  let carried_centered = dm * (donor_u - gauge);
  let gas_centered_next = gas_centered_before - carried_centered - transfer_into_liquid
    + select(mixing_heat, 0.0, condenses);
  let liquid_centered_next = liquid_centered_before + carried_centered + transfer_into_liquid
    + select(0.0, mixing_heat, condenses) - surface_change;
  let ug_next = gauge + gas_centered_next / mg_next;
  let ul_next = gauge + liquid_centered_next / ml_next;
  let tg_next = xphase_t(row, ug_next, false); let tl_next = xphase_t(row, ul_next, true);
  let volume_next = mg_next / gas.density;
  let moles_next = gas.moles * (mg_next / gas.mass);
  let entities_next = moles_next * EXCHANGE_AVOGADRO;
  let c_next = sqrt(materials[m + 13u] * (EXCHANGE_R / materials[m + 1u]) * tg_next);
  var visual_radius_next = 0.0;
  if (kind == 0u) {
    let old_visual_radius = xf(xp(6u) + index * 12u + 11u);
    if (old_visual_radius > 0.0) {
      visual_radius_next = old_visual_radius * exp(log(mg_next / gas.mass) / 3.0);
      if (!xpos(visual_radius_next)) { xedge_fail(edge, ERROR_NUMERIC); return; }
    }
  }
  if (!xfinite(mixing_heat) || mixing_heat < 0.0 || !xfinite(heat_into_liquid)
      || !xfinite(transfer_into_liquid) || !xvecfinite(donor_v) || !xvecfinite(vg_next)
      || !xvecfinite(vl_next) || !xpos(radius_next) || !xpos(area_next) || !xpos(surface_next)
      || !xfinite(surface_change) || !xfinite(gas_centered_before) || !xfinite(liquid_centered_before)
      || !xfinite(carried_centered) || !xfinite(gas_centered_next) || !xfinite(liquid_centered_next)
      || !xpos(tg_next) || !xpos(tl_next) || !xpos(volume_next) || !xpos(moles_next)
      || !xpos(entities_next) || !xpos(c_next)
      || !xpos(materials[m + 9u] + materials[m + 10u] * tl_next)) { xedge_fail(edge, ERROR_DOMAIN); return; }
  // Proposal-local check only: WGSL may reassociate these expressions.
  // Finalization independently re-reads actual STORED endpoint state.
  // Momentum has no absolute world-velocity epsilon; scaling uses the sum of
  // magnitudes of the two contributions, including cancelling momenta.
  let pg = gas.mass * gas.velocity; let pl = ml * vl;
  let pg_next = mg_next * vg_next; let pl_next = ml_next * vl_next;
  let momentum_error = abs((pg_next + pl_next) - (pg + pl));
  let momentum_scale = abs(pg) + abs(pl) + abs(pg_next) + abs(pl_next);
  let kg = 0.5 * gas.mass * dot(gas.velocity, gas.velocity);
  let kl = 0.5 * ml * dot(vl, vl);
  let kg_next = 0.5 * mg_next * dot(vg_next, vg_next);
  let kl_next = 0.5 * ml_next * dot(vl_next, vl_next);
  let e_before = gas_centered_before + liquid_centered_before + kg + kl + surface_before;
  let actual_gas_energy = mg_next * (ug_next - gauge);
  let actual_liquid_energy = ml_next * (ul_next - gauge);
  let e_next = actual_gas_energy + actual_liquid_energy + kg_next + kl_next + surface_next;
  let energy_scale = abs(gas_centered_before) + abs(liquid_centered_before) + abs(kg) + abs(kl)
    + abs(surface_before) + abs(actual_gas_energy) + abs(actual_liquid_energy)
    + abs(kg_next) + abs(kl_next) + abs(surface_next);
  if (!xvecfinite(pg) || !xvecfinite(pl) || !xvecfinite(pg_next) || !xvecfinite(pl_next)
      || !xvecfinite(momentum_error) || !xvecfinite(momentum_scale)
      || any(momentum_error > 2.0e-5 * momentum_scale)
      || !xfinite(e_before) || !xfinite(e_next) || !xfinite(energy_scale)
      || abs(e_next - e_before) > 2.0e-5 * energy_scale) { xedge_fail(edge, ERROR_CONSERVATION); return; }
  if (kind == 0u) {
    let s = xp(5u) + index * 8u; let t = xp(6u) + index * 12u; let mech = xp(7u) + index * 32u;
    xc(s + 3u, mg_next); xc(s + 4u, vg_next.x); xc(s + 5u, vg_next.y); xc(s + 6u, vg_next.z); xc(s + 7u, ug_next);
    xc(t + 2u, tg_next); xc(t + 9u, entities_next); xc(t + 11u, visual_radius_next);
    // T8 is the chosen kernel resolution, not a physical volume. Preserve
    // it; a positive authored T11 radius retains visual volume per mass.
    xc(mech + 19u, volume_next); xc(mech + 25u, c_next); xc(mech + 31u, mg_next);
    // M28 is copied HISTORICAL pressure, not a newly resolved SS pressure.
    // This candidate requires actual successor EOS before continuation.
  } else {
    let h = xp(8u) + index * 32u;
    xc(h + 3u, mg_next); xc(h + 9u, moles_next); xc(h + 12u, 0.0); xc(h + 13u, mg_next);
    xc(h + 16u, tg_next); xc(h + 19u, ug_next); xc(h + 20u, vg_next.x);
    xc(h + 21u, vg_next.y); xc(h + 22u, vg_next.z); xc(h + 23u, volume_next); xc(h + 27u, c_next);
  }
  xc(a + 3u, ml_next); xc(a + 4u, vl_next.x); xc(a + 5u, vl_next.y); xc(a + 6u, vl_next.z);
  xc(a + 7u, ul_next); xc(a + 8u, tl_next); xc(a + 10u, radius_next);
  surfaces[parcel_index * 4u + 2u] = area_next;
  surfaces[parcel_index * 4u + 3u] = surface_next;
  atomicStore(&control[16u + edge], 1u); atomicAdd(&control[5u], 1u);
}

// A separate dispatch is the rounding/ownership boundary, not an extra let
// binding in apply. WGSL permits reassociation of (m-(m-dm)); native-v3
// exposed READY with bitwise unchanged masses for dm=1e-25. Here integer
// words come from the completed candidate buffer, not that expression DAG.
fn xmass_pair_exact_subtraction(old_bits: u32, new_bits: u32) -> bool {
  // Positive finite f32 bit order is numeric order. Compare larger <= 2*smaller
  // in the integer encoding, without rounding that bound. Doubling a normal
  // increments its exponent; doubling a subnormal shifts its significand.
  // A doubled top-bin normal may encode >=infinity, but every finite larger
  // endpoint is then correctly below the exact doubled value. Never bitcast
  // the doubled bound to float. This is the Sterbenz exact-difference domain.
  let smaller = min(old_bits, new_bits); let larger = max(old_bits, new_bits);
  var doubled = smaller + 0x00800000u;
  if (smaller < 0x00800000u) { doubled = smaller << 1u; }
  return larger <= doubled;
}
fn xheat_stored_endpoint_error(mass_word: u32, u_word: u32, t_word: u32,
  row: u32, liquid: bool, heat: f32) -> u32 {
  if (source[mass_word] != candidate[mass_word]) { return ERROR_CONSERVATION; }
  let mass = xf(mass_word); let u = bitcast<f32>(candidate[u_word]);
  let t = bitcast<f32>(candidate[t_word]);
  if (!xpos(mass) || !xfinite(u) || !xpos(t)
      || !xtemperature(xphase_t(row, u, liquid), t, materials[row * 16u + 7u])) { return ERROR_DOMAIN; }
  if (heat == 0.0) {
    if (source[u_word] != candidate[u_word]) { return ERROR_NUMERIC; }
    return 0u;
  }
  if (source[u_word] == candidate[u_word]) { return ERROR_NUMERIC; }
  let actual_heat = mass * (u - xf(u_word));
  // Packet-relative, not a tolerance scaled by a huge reservoir or U gauge.
  if (!xrelative(actual_heat, heat)) { return ERROR_CONSERVATION; }
  return 0u;
}
fn xstored_heat_error(edge: u32) -> u32 {
  let b = edge * 8u; let kind = edges[b]; let index = edges[b + 1u];
  let p = edges[b + 2u]; let a = xp(9u) + p * 24u; let row = edges[b + 3u];
  let liquid_row = xmaterial_for(source[a + 12u]);
  let gas_heat = xheat_total(edge, true); let liquid_heat = xheat_total(edge, false);
  if (gas_heat.valid != 1u || liquid_heat.valid != 1u) { return ERROR_NUMERIC; }
  if (liquid_row == 0xffffffffu) { return ERROR_MATERIAL; }
  var mass_word = xp(5u) + index * 8u + 3u; var u_word = xp(5u) + index * 8u + 7u;
  var t_word = xp(6u) + index * 12u + 2u; var c_word = xp(7u) + index * 32u + 25u;
  if (kind == 0u) {
    for (var lane = 0u; lane < 8u; lane++) {
      let w = xp(5u) + index * 8u + lane;
      if (lane != 7u && source[w] != candidate[w]) { return ERROR_CONSERVATION; }
    }
    for (var lane = 0u; lane < 12u; lane++) {
      let w = xp(6u) + index * 12u + lane;
      if (lane != 2u && source[w] != candidate[w]) { return ERROR_CONSERVATION; }
    }
    for (var lane = 0u; lane < 32u; lane++) {
      let w = xp(7u) + index * 32u + lane;
      if (lane != 25u && source[w] != candidate[w]) { return ERROR_CONSERVATION; }
    }
  } else {
    let h = xp(8u) + index * 32u;
    mass_word = h + 13u; u_word = h + 19u; t_word = h + 16u; c_word = h + 27u;
    for (var lane = 0u; lane < 32u; lane++) {
      // initialize owns normalization of historical placed+residual inventory.
      if (lane == 3u || lane == 9u || lane == 12u || lane == 13u || lane == 23u
          || lane == 16u || lane == 19u || lane == 27u) { continue; }
      if (source[h + lane] != candidate[h + lane]) { return ERROR_CONSERVATION; }
    }
    if (candidate[h + 3u] != source[h + 13u] || candidate[h + 12u] != 0u
        || !xrelative(bitcast<f32>(candidate[h + 9u]), xf(h + 9u) * (xf(h + 13u) / xf(h + 3u)))
        || !xrelative(bitcast<f32>(candidate[h + 23u]), xf(h + 23u) * (xf(h + 13u) / xf(h + 3u)))) { return ERROR_CONSERVATION; }
  }
  let gas_error = xheat_stored_endpoint_error(mass_word, u_word, t_word, row, false, -gas_heat.value);
  if (gas_error != 0u) { return gas_error; }
  let liquid_error = xheat_stored_endpoint_error(a + 3u, a + 7u, a + 8u, liquid_row, true, liquid_heat.value);
  if (liquid_error != 0u) { return liquid_error; }
  let gas_t = bitcast<f32>(candidate[t_word]);
  let expected_c = sqrt(materials[row * 16u + 13u] * (EXCHANGE_R / materials[row * 16u + 1u]) * gas_t);
  if (!xrelative(bitcast<f32>(candidate[c_word]), expected_c)) { return ERROR_MECHANICS; }
  for (var lane = 0u; lane < 24u; lane++) {
    if (lane != 7u && lane != 8u && source[a + lane] != candidate[a + lane]) { return ERROR_CONSERVATION; }
  }
  if (bitcast<u32>(surfaces[p * 4u]) != bitcast<u32>(surfaces[p * 4u + 2u])
      || bitcast<u32>(surfaces[p * 4u + 1u]) != bitcast<u32>(surfaces[p * 4u + 3u])) { return ERROR_CONSERVATION; }
  return 0u;
}
fn xstored_transfer_error(edge: u32) -> u32 {
  if ((edges[edge * 8u + 4u] & 0x7fffffffu) == 0u) { return xstored_heat_error(edge); }
  let b = edge * 8u; let kind = edges[b]; let index = edges[b + 1u];
  let parcel_index = edges[b + 2u]; let row = edges[b + 3u]; let m = row * 16u;
  let a = xp(9u) + parcel_index * 24u;
  var gas_mass_word = xp(5u) + index * 8u + 3u;
  var gas_u_word = xp(5u) + index * 8u + 7u;
  var gas_v_word = xp(5u) + index * 8u + 4u;
  var gas_t_word = xp(6u) + index * 12u + 2u;
  if (kind == 1u) {
    gas_mass_word = xp(8u) + index * 32u + 13u;
    gas_u_word = xp(8u) + index * 32u + 19u;
    gas_v_word = xp(8u) + index * 32u + 20u;
    gas_t_word = xp(8u) + index * 32u + 16u;
  }
  let old_gas_bits = source[gas_mass_word]; let new_gas_bits = candidate[gas_mass_word];
  let old_liquid_bits = source[a + 3u]; let new_liquid_bits = candidate[a + 3u];
  // Integer equality cannot turn into the request by floating reassociation.
  // BOTH endpoints must visibly change in the actual stored representation.
  if (old_gas_bits == new_gas_bits || old_liquid_bits == new_liquid_bits) { return ERROR_NUMERIC; }
  // Reject zero/sign/nonfinite encodings before interpreting stored mass as
  // float (do not rely on a backend preserving NaN comparison behavior).
  if (old_gas_bits == 0u || old_gas_bits >= 0x7f800000u
      || new_gas_bits == 0u || new_gas_bits >= 0x7f800000u
      || old_liquid_bits == 0u || old_liquid_bits >= 0x7f800000u
      || new_liquid_bits == 0u || new_liquid_bits >= 0x7f800000u) { return ERROR_NUMERIC; }
  // Outside this explicit bounded domain, rounded debit equality can hide
  // unequal real differences of the stored f32 endpoints. Do not accept it.
  if (!xmass_pair_exact_subtraction(old_gas_bits, new_gas_bits)
      || !xmass_pair_exact_subtraction(old_liquid_bits, new_liquid_bits)) { return ERROR_NUMERIC; }
  let mg = bitcast<f32>(old_gas_bits); let mg_next = bitcast<f32>(new_gas_bits);
  let ml = bitcast<f32>(old_liquid_bits); let ml_next = bitcast<f32>(new_liquid_bits);
  let requested = bitcast<f32>(edges[b + 4u]);
  if (!xpos(mg) || !xpos(mg_next) || !xpos(ml) || !xpos(ml_next)
      || !xfinite(requested) || requested == 0.0) { return ERROR_NUMERIC; }
  let gas_debit = mg - mg_next; let liquid_credit = ml_next - ml;
  if (!xfinite(gas_debit) || !xfinite(liquid_credit) || gas_debit == 0.0
      || gas_debit != liquid_credit || !xrelative(gas_debit, requested)
      || (gas_debit > 0.0) != (requested > 0.0)
      || (requested > 0.0 && (!(mg_next < mg) || !(ml_next > ml)))
      || (requested < 0.0 && (!(mg_next > mg) || !(ml_next < ml)))) { return ERROR_NUMERIC; }

  let ug = xf(gas_u_word); let ug_next = bitcast<f32>(candidate[gas_u_word]);
  let ul = xf(a + 7u); let ul_next = bitcast<f32>(candidate[a + 7u]);
  let tg_next = bitcast<f32>(candidate[gas_t_word]);
  let tl_next = bitcast<f32>(candidate[a + 8u]);
  let vg = vec3<f32>(xf(gas_v_word), xf(gas_v_word + 1u), xf(gas_v_word + 2u));
  let vg_next = vec3<f32>(bitcast<f32>(candidate[gas_v_word]),
    bitcast<f32>(candidate[gas_v_word + 1u]), bitcast<f32>(candidate[gas_v_word + 2u]));
  let vl = vec3<f32>(xf(a + 4u), xf(a + 5u), xf(a + 6u));
  let vl_next = vec3<f32>(bitcast<f32>(candidate[a + 4u]),
    bitcast<f32>(candidate[a + 5u]), bitcast<f32>(candidate[a + 6u]));
  let old_area = surfaces[parcel_index * 4u]; let old_surface = surfaces[parcel_index * 4u + 1u];
  let new_area = surfaces[parcel_index * 4u + 2u]; let new_surface = surfaces[parcel_index * 4u + 3u];
  if (!xfinite(ug) || !xfinite(ug_next) || !xfinite(ul) || !xfinite(ul_next)
      || !xpos(tg_next) || !xpos(tl_next) || !xvecfinite(vg) || !xvecfinite(vg_next)
      || !xvecfinite(vl) || !xvecfinite(vl_next) || !xpos(old_area) || !xpos(old_surface)
      || !xpos(new_area) || !xpos(new_surface)
      || !xtemperature(xphase_t(row, ug_next, false), tg_next, materials[m + 7u])
      || !xtemperature(xphase_t(row, ul_next, true), tl_next, materials[m + 7u])
      || !xrelative(old_surface, materials[m + 9u] * old_area)
      || !xrelative(new_surface, materials[m + 9u] * new_area)) { return ERROR_DOMAIN; }
  // These are four independently loaded stored momentum contributions, not
  // the apply stage's donor-transfer algebra. Likewise U and surface below.
  let pg = mg * vg; let pl = ml * vl;
  let pg_next = mg_next * vg_next; let pl_next = ml_next * vl_next;
  let momentum_error = abs((pg_next + pl_next) - (pg + pl));
  let momentum_scale = abs(pg) + abs(pl) + abs(pg_next) + abs(pl_next);
  let gauge = materials[m + 4u];
  let eg = mg * (ug - gauge); let el = ml * (ul - gauge);
  let eg_next = mg_next * (ug_next - gauge); let el_next = ml_next * (ul_next - gauge);
  let kg = 0.5 * mg * dot(vg, vg); let kl = 0.5 * ml * dot(vl, vl);
  let kg_next = 0.5 * mg_next * dot(vg_next, vg_next); let kl_next = 0.5 * ml_next * dot(vl_next, vl_next);
  let e_before = eg + el + kg + kl + old_surface;
  let e_after = eg_next + el_next + kg_next + kl_next + new_surface;
  let energy_scale = abs(eg) + abs(el) + abs(kg) + abs(kl) + abs(old_surface)
    + abs(eg_next) + abs(el_next) + abs(kg_next) + abs(kl_next) + abs(new_surface);
  if (!xvecfinite(pg) || !xvecfinite(pl) || !xvecfinite(pg_next) || !xvecfinite(pl_next)
      || !xvecfinite(momentum_error) || !xvecfinite(momentum_scale)
      || any(momentum_error > 2.0e-5 * momentum_scale)
      || !xfinite(e_before) || !xfinite(e_after) || !xfinite(energy_scale)
      || abs(e_after - e_before) > 2.0e-5 * energy_scale) { return ERROR_CONSERVATION; }
  return 0u;
}

@compute @workgroup_size(1)
fn finalize_vapor_aerosol_exchange() {
  if (arrayLength(&control) < 16u) { return; }
  if (!xlayout()) { exchange_record_error(ERROR_LAYOUT); }
  if (atomicLoad(&control[5u]) != xp(3u)) { exchange_record_error(ERROR_COMPLETION); }
  if (atomicLoad(&control[0u]) != EXCHANGE_MAGIC || atomicLoad(&control[1u]) != EXCHANGE_VERSION
      || atomicLoad(&control[4u]) != xp(3u) || atomicLoad(&control[8u]) != xp(19u)
      || atomicLoad(&control[9u]) != xp(20u) || atomicLoad(&control[10u]) != xp(14u)) { exchange_record_error(ERROR_COMPLETION); }
  // Header5 counts independently validated STORED endpoints after this
  // dispatch, not how many apply invocations once proposed an accepted edge.
  atomicStore(&control[5u], 0u);
  let errors = atomicLoad(&control[3u]);
  if (errors != 0u) { atomicStore(&control[2u], 2u); return; }
  for (var edge = 0u; edge < xp(3u); edge++) {
    if (atomicLoad(&control[16u + edge]) != 1u) { xedge_fail(edge, ERROR_COMPLETION); continue; }
    let stored_error = xstored_transfer_error(edge);
    if (stored_error != 0u) { xedge_fail(edge, stored_error); }
    else { atomicAdd(&control[5u], 1u); }
  }
  if (atomicLoad(&control[3u]) != 0u) { atomicStore(&control[2u], 2u); return; }
  // A newly GPU-authored count record. Never copy a claimed-ready input
  // generation/seal as the successor's count authority.
  if (xp(18u) == 1u) {
    let c = xp(13u); let live = atomicLoad(&control[6u]);
    for (var lane = 0u; lane < 64u; lane++) { candidate[c + lane] = 0u; }
    candidate[c] = 0x50484731u; candidate[c + 1u] = 1u; candidate[c + 2u] = 1u;
    candidate[c + 3u] = live; candidate[c + 4u] = xp(1u); candidate[c + 5u] = 8u;
    candidate[c + 6u] = xp(19u); candidate[c + 7u] = xp(20u);
    candidate[c + 8u] = live / 64u + select(0u, 1u, live % 64u != 0u);
    candidate[c + 9u] = 1u; candidate[c + 10u] = 1u;
  }
  atomicStore(&control[2u], 1u);
}
`;function D({shared:e=!1,cellPressureWork:t=!1,integrateRates:n=!1,midpointDonors:r=!1,transportPacketMode:i=`exact-rational`}={}){let a=d(i)===`rounded-dyadic-53`;if(e||=t,r&&(!t||!n))throw TypeError(`Midpoint donors require exact rate and pressure work`);let o=t?50:e?42:30,s=o+16,c=o+(r?17:0),l=[],u=c+Number(n),f=(e,t,n)=>{let r=u++;return l.push([e,t,n,r]),r},p=(e,t)=>f(0,e,t),m=(e,t)=>f(1,e,t),h=(e,t)=>f(2,e,t),g=(e,t)=>f(3,e,t),_=e=>a?f(4,e,e):e,[v,y,b,x]=[16,17,18,19].map(e=>n?h(e,c):e),S=null,C=0;if(e){let e=g(v,22);S=[v,...[23,24,25].map(t=>_(h(e,t))),_(p(h(e,26),p(p(y,b),x)))],C=l.length}let w=e?[m(0,40),m(8,41)]:null,T=[m(0,e?30:v)],E=[p(8,e?35:v)],D=g(v,22);for(let t=1;t<=3;t++){let n=e?30+t:_(h(D,22+t));T.push(m(t,n)),E.push(p(8+t,e?35+t:n))}T.push(0),E.push(0);let O=g(T[0],0),k=g(E[0],8);for(let e=5;e<8;e++)T.push(h(e,O)),E.push(h(8+e,k));let A=t?h(g(35,46),49):null,j=t?g(h(h(g(r?o:0,42),44),43),45):null,M=t?_(m(48,h(j,A))):null,N=l.length,P=t?m(r?s:45,47):null,F=l.length,I=e?34:_(p(h(D,26),p(p(y,b),x)));T[4]=m(4,I),E[4]=m(p(12,e?39:I),m(21,20));let L=[T[0],E[0]];for(let e of[T,E])for(let t=1;t<=3;t++)L.push(g(e[t],e[0]));for(let e of[T,E]){let t=g([1,2,3].map(t=>h(e[t],e[t])).reduce(p),p(e[0],e[0]));L.push(g(m(e[4],t),e[0]))}return L.push(...T.slice(5),...E.slice(5)),{operations:l,registers:u,transferBoundary:C,transfers:S,available:w,surfaceBoundary:F,gas:T,liquid:E,views:L,pressureBoundary:N,pressureWork:M,volumeChange:A,remainingFreeVolume:P,massPacket:v,intervalSlot:c,stageSlot:o,originalVolumeSlot:s}}function O(e){let t=e.length/8,n=new Map,r=[],i=new Map;for(let a=0;a<t;a++){let t=`${e[a*8]}:${e[a*8+1]}:${e[a*8+2]}`;i.has(t)||i.set(t,a);for(let o of[`g:${e[a*8]}:${e[a*8+1]}`,`a:${e[a*8+2]}`]){n.has(o)||n.set(o,[]);let e=n.get(o);e.push(a),r.push({group:e,pair:i.get(t)})}}let a=new Uint32Array(t*10),o=new Map,s=t*8,c=1;for(let e of n.values())o.set(e,s),a.set(e,s),s+=e.length,c=Math.max(c,e.length);return r.forEach(({group:e,pair:t},n)=>a.set([o.get(e),e.length,e[0],t],n*4)),{words:a,maxDegree:c,shared:c>1}}async function k({device:e,format:t,layout:n,edgeRows:r,cellPressureWork:i=!1,dtSeconds:a=null,intervalScaleExponent:o=0,transportPacketMode:s=`exact-rational`,donorPairs:c=null,predictorProjection:u=null,particleRead:d,historyRead:f,aerosolRead:h,edges:g,control:_,surfaces:b,allocate:x,validate:S}){S();let C=r.length/8,w=n.recordWords,T=n.scalar,E=v({wordCount:2*T.wordCount+1}),k=E.recordWords,A=O(r);i&&(A.shared=!0);let j=a!==null;if(j&&(typeof a!=`number`||!Number.isFinite(a)||a<=0))throw RangeError(`Rate integration requires the positive original binary64 interval`);if(!Number.isInteger(o)||o<-1024||o>0||!!c!=!!u)throw TypeError(`Invalid exact stage interval or predictor`);let M=!!c,N=D({...A,cellPressureWork:i,integrateRates:j,midpointDonors:M,transportPacketMode:s}),P=e.limits.minUniformBufferOffsetAlignment,F=A.shared?A.maxDegree:0,I=N.operations.length+F,L=C*2*w*4,R=C*N.registers*k*4,ee=L*(M?2:1);if(Math.max(ee,R)>e.limits.maxStorageBufferBindingSize||Math.max(ee,R,I*P)>e.limits.maxBufferSize||Math.ceil(C*16/32)>e.limits.maxComputeWorkgroupsPerDimension)throw RangeError(`Exact exchange quantities exceed device capacity`);let z=x(`exact-source`,ee,140),B=x(`exact-pairs`,L,140),V=x(`exact-scratch`,R,136),te=x(`exact-projection`,C*32*4,140),H=x(`exact-params`,16,72),ne=x(`exact-operations`,I*P,72),U=x(`exact-adjacency`,A.words.byteLength,136),W=new Uint32Array(ne.size/4);N.operations.forEach((e,t)=>W.set(e,t*P/4));for(let e=0;e<F;e++)W[(N.operations.length+e)*P/4]=e;e.queue.writeBuffer(ne,0,W),e.queue.writeBuffer(U,0,A.words);let re=new DataView(new ArrayBuffer(8));re.setFloat64(0,a??0,!0),e.queue.writeBuffer(H,0,new Uint32Array([C,re.getUint32(0,!0),re.getUint32(4,!0),o]));let ie=y({wordCount:E.wordCount})+(s===`rounded-dyadic-53`?l():``)+`
@group(0) @binding(0) var<storage, read> xq_source: array<u32>;
@group(0) @binding(1) var<storage, read_write> xq_output: array<u32>;
@group(0) @binding(2) var<storage, read_write> xq_scratch: array<u32>;
@group(0) @binding(3) var<storage, read_write> xq_projection: array<u32>;
@group(0) @binding(4) var<storage, read> xq_edges: array<u32>;
@group(0) @binding(5) var<storage, read_write> xq_control: array<atomic<u32>>;
@group(0) @binding(6) var<storage, read> xq_surfaces: array<u32>;
@group(0) @binding(7) var<uniform> xq_params: vec4<u32>;
@group(0) @binding(8) var<uniform> xq_op: vec4<u32>;
@group(0) @binding(9) var<storage, read> xq_adjacency: array<u32>;
fn xq_at(edge: u32, slot: u32) -> u32 { return (edge * ${N.registers}u + slot) * ${k}u; }
fn xq_fail() { atomicOr(&xq_control[3u], 4096u); }
fn xq_load(edge: u32, slot: u32) -> ExactRational {
  let at = xq_at(edge, slot); var v: ExactRational;
  v.negative = xq_scratch[at]; v.error = xq_scratch[at + 1u]; v.exponent = bitcast<i32>(xq_scratch[at + 2u]); v.reserved = xq_scratch[at + 3u];
  for (var i = 0u; i < XR_WORDS; i++) { v.numerator[i] = xq_scratch[at + 4u + i]; v.denominator[i] = xq_scratch[at + 4u + XR_WORDS + i]; }
  return v;
}
fn xq_store(edge: u32, slot: u32, v: ptr<function, ExactRational>) {
  let at = xq_at(edge, slot); xq_scratch[at] = (*v).negative; xq_scratch[at + 1u] = (*v).error;
  xq_scratch[at + 2u] = bitcast<u32>((*v).exponent); xq_scratch[at + 3u] = (*v).reserved;
  for (var i = 0u; i < XR_WORDS; i++) { xq_scratch[at + 4u + i] = (*v).numerator[i]; xq_scratch[at + 4u + XR_WORDS + i] = (*v).denominator[i]; }
  if ((*v).error != 0u) { xq_fail(); }
}
fn xq_ingress(edge: u32, slot: u32, bits: u32) {
  let at = xq_at(edge, slot); let encoded = (bits >> 23u) & 255u;
  if (encoded == 255u) { xq_fail(); return; }
  let coefficient = (bits & 0x7fffffu) | select(0u, 0x800000u, encoded != 0u);
  if (coefficient == 0u) { return; }
  let shift = countTrailingZeros(coefficient); xq_scratch[at] = bits >> 31u;
  xq_scratch[at + 2u] = bitcast<u32>(select(-149, i32(encoded) - 150, encoded != 0u) + i32(shift));
  xq_scratch[at + 4u] = coefficient >> shift;
}
@compute @workgroup_size(32)
fn prepare_exact_exchange(@builtin(global_invocation_id) id: vec3<u32>) {
  let edge = id.x; if (edge >= xq_params.x || atomicLoad(&xq_control[3u]) != 0u) { return; }
  for (var slot = 0u; slot < ${N.registers}u; slot++) { xq_scratch[xq_at(edge, slot) + 4u + XR_WORDS] = 1u; }
  xq_projection[edge * 32u + 19u] = xq_adjacency[edge * 8u + 2u];
  xq_projection[edge * 32u + 20u] = xq_adjacency[edge * 8u + 6u];
  for (var endpoint = 0u; endpoint < ${M?4:2}u; endpoint++) {
    let base = (edge * 2u + endpoint % 2u + (endpoint / 2u) * xq_params.x * 2u) * ${w}u;
    let first_slot = select(endpoint * 8u, ${N.stageSlot}u + (endpoint % 2u) * 8u, endpoint >= 2u);
    if (xq_source[base] != 1u || xq_source[base + 1u] != 0u) { xq_fail(); return; }
    let at = xq_at(edge, first_slot); var mass = 0u;
    xq_scratch[at + 2u] = bitcast<u32>(${t.quantumExponent}i);
    for (var i = 0u; i < ${t.wordCount}u; i++) {
      let word = xq_source[base + ${n.massOffsetWords}u + i]; mass |= word; xq_scratch[at + 4u + i] = word;
    }
    if (mass == 0u) { xq_fail(); return; }
    for (var field = 0u; field < 7u; field++) {
      let source_offset = base + ${n.scalarOffsetWords}u + field * ${T.recordWords}u;
      let to = xq_at(edge, first_slot + field + 1u);
      for (var i = 0u; i < 4u; i++) { xq_scratch[to + i] = xq_source[source_offset + i]; }
      for (var i = 0u; i < ${T.wordCount}u; i++) {
        xq_scratch[to + 4u + i] = xq_source[source_offset + 4u + i];
        xq_scratch[to + 4u + XR_WORDS + i] = xq_source[source_offset + ${4+T.wordCount}u + i];
      }
    }
  }
  for (var lane = 0u; lane < 4u; lane++) { xq_ingress(edge, 16u + lane, xq_edges[edge * 8u + 4u + lane]); }
  ${j?`
  let encoded = (xq_params.z >> 20u) & 2047u;
  var lo = xq_params.y; var hi = (xq_params.z & 0xfffffu) | select(0u, 0x100000u, encoded != 0u);
  if ((xq_params.z >> 31u) != 0u || encoded == 2047u || (lo | hi) == 0u
      || bitcast<i32>(xq_params.w) > 0 || bitcast<i32>(xq_params.w) < -1024) { xq_fail(); return; }
  var shift = 0u;
  if (lo == 0u) { shift = 32u + countTrailingZeros(hi); lo = hi >> (shift - 32u); hi = 0u; }
  else {
    shift = countTrailingZeros(lo);
    if (shift != 0u) { lo = (lo >> shift) | (hi << (32u - shift)); hi >>= shift; }
  }
  let dt_at = xq_at(edge, ${N.intervalSlot}u);
  xq_scratch[dt_at + 2u] = bitcast<u32>(select(-1074, i32(encoded) - 1075, encoded != 0u)
    + i32(shift) + bitcast<i32>(xq_params.w));
  xq_scratch[dt_at + 4u] = lo;
  ${n.scalar.wordCount>1?`xq_scratch[dt_at + 5u] = hi;`:`if (hi != 0u) { xq_fail(); return; }`}
  `:``}
  let donor = ${M?N.stageSlot:0}u + select(0u, 8u, (xq_edges[edge * 8u + 4u] & 0x80000000u) != 0u);
  for (var field = 0u; field < 8u; field++) {
    for (var i = 0u; i < ${k}u; i++) { xq_scratch[xq_at(edge, 22u + field) + i] = xq_scratch[xq_at(edge, donor + field) + i]; }
  }
}
@compute @workgroup_size(32)
fn execute_exact_exchange(@builtin(global_invocation_id) id: vec3<u32>) {
  let edge = id.x; if (edge >= xq_params.x || atomicLoad(&xq_control[3u]) != 0u) { return; }
  var a = xq_load(edge, xq_op.y); var b = xq_load(edge, xq_op.z); var v: ExactRational;
  switch xq_op.x {
    case 0u: { xrp_rational_add(&v, &a, &b); }
    case 1u: { xrp_rational_subtract(&v, &a, &b); }
    case 2u: { xrp_rational_multiply(&v, &a, &b); }
    case 3u: { xrp_rational_divide(&v, &a, &b); }
    ${s===`rounded-dyadic-53`?`case 4u: { xrp_round_transfer53(&v, &a); }`:``}
    default: { v.error = 1u; }
  }
  xq_store(edge, xq_op.w, &v);
}
${A.shared?`
@compute @workgroup_size(32)
fn reduce_exact_exchange(@builtin(global_invocation_id) id: vec3<u32>) {
  let edge = id.x / 12u; let lane = id.x % 12u; let endpoint = lane / 6u; let field = lane % 6u;
  if (edge >= xq_params.x || atomicLoad(&xq_control[3u]) != 0u) { return; }
  let group = edge * 8u + endpoint * 4u;
  if (xq_op.x >= xq_adjacency[group + 1u]) { return; }
  let other = xq_adjacency[xq_adjacency[group] + xq_op.x];
  let slots = array<u32,5>(${N.transfers.map(e=>`${e}u`).join(`,`)});
  var slot = 30u + endpoint * 5u + field;
  var packet = xq_load(other, slots[min(field, 4u)]);
  if (field == 5u) {
    slot = 40u + endpoint; packet = xq_load(other, ${N.massPacket}u);
    // A simultaneous incoming packet cannot finance an overdraft from the
    // original donor. Track gross outgoing demand separately from net mass.
    if (packet.negative != endpoint) { return; }
    packet.negative = 0u;
  }
  var sum = xq_load(edge, slot);
  var next: ExactRational; xrp_rational_add(&next, &sum, &packet);
  xq_store(edge, slot, &next);
}
`:``}
${i?`
@compute @workgroup_size(32)
fn ingress_exact_pressure_work(@builtin(global_invocation_id) id: vec3<u32>) {
  let edge = id.x; if (edge >= xq_params.x || atomicLoad(&xq_control[3u]) != 0u) { return; }
  for (var lane = 0u; lane < 5u; lane++) {
    let bits = xq_projection[edge * 32u + 21u + lane];
    if (bits < 0x00800000u || bits >= 0x7f800000u) { xq_fail(); return; }
    xq_ingress(edge, 42u + lane, bits);
  }
  let weight = xq_projection[edge * 32u + 26u];
  if (weight < 0x00800000u || weight > 0x3f800000u) { xq_fail(); return; }
  xq_ingress(edge, 49u, weight);
  ${M?`
  let original_volume = xq_projection[edge * 32u + 28u];
  if (original_volume < 0x00800000u || original_volume >= 0x7f800000u) { xq_fail(); return; }
  xq_ingress(edge, ${N.originalVolumeSlot}u, original_volume);`:``}
}
@compute @workgroup_size(32)
fn reduce_exact_pressure_work(@builtin(global_invocation_id) id: vec3<u32>) {
  let edge = id.x / 3u; let lane = id.x % 3u;
  if (edge >= xq_params.x || atomicLoad(&xq_control[3u]) != 0u) { return; }
  let group = edge * 8u + select(0u, 4u, lane == 1u);
  if (xq_op.x >= xq_adjacency[group + 1u]) { return; }
  let other = xq_adjacency[xq_adjacency[group] + xq_op.x];
  // Multiple mass/heat edges for one gas/parcel pair cause only one pressure
  // work packet. Their net liquid volume change was already reduced exactly.
  if (xq_adjacency[other * 8u + 3u] != other) { return; }
  let slot = select(select(34u, 39u, lane == 1u), 47u, lane == 2u);
  var packet = xq_load(other, select(${N.pressureWork}u, ${N.volumeChange}u, lane == 2u));
  var sum = xq_load(edge, slot); var next: ExactRational;
  xrp_rational_add(&next, &sum, &packet); xq_store(edge, slot, &next);
}
`:``}
@compute @workgroup_size(32)
fn project_exact_exchange_mass(@builtin(global_invocation_id) id: vec3<u32>) {
  let edge = id.x; if (edge >= xq_params.x || atomicLoad(&xq_control[3u]) != 0u) { return; }
  ${A.shared?`
  for (var endpoint = 0u; endpoint < 2u; endpoint++) {
    var available = xq_load(edge, select(${N.available[0]}u, ${N.available[1]}u, endpoint == 1u));
    if (available.error != 0u || available.negative != 0u) { xq_fail(); return; }
  }`:``}
  ${i?`
  var free_volume = xq_load(edge, ${N.remainingFreeVolume}u);
  let projected_volume = xrp_project_f32_bits(&free_volume);
  if (projected_volume.error != 0u || projected_volume.bits < 0x00800000u
      || projected_volume.bits >= 0x7f800000u) { xq_fail(); return; }
  xq_projection[edge * 32u + 27u] = projected_volume.bits;`:``}
  for (var endpoint = 0u; endpoint < 2u; endpoint++) {
    var raw = xq_load(edge, select(${N.gas[0]}u, ${N.liquid[0]}u, endpoint == 1u));
    var v: ExactRational; xrp_normalize(&v, &raw);
    // M is an integer number of run quanta. Never round a rational mass back
    // onto the inventory lattice, erase a positive remainder or wrap a debit.
    if (v.error != 0u || v.negative != 0u || v.denominator[0u] != 1u || v.exponent < ${t.quantumExponent}i) { xq_fail(); return; }
    for (var i = 1u; i < XR_WORDS; i++) { if (v.denominator[i] != 0u) { xq_fail(); return; } }
    var integer: ExactRationalWide; xrp_numerator(&integer, &v); xrp_shift_left(&integer, u32(v.exponent - ${t.quantumExponent}i));
    if (integer.error != 0u) { xq_fail(); return; }
    for (var i = ${t.wordCount}u; i < XR_SCRATCH_WORDS; i++) { if (integer.words[i] != 0u) { xq_fail(); return; } }
    let p = xrp_project_f32_bits(&v);
    if (p.error != 0u || p.bits < 0x00800000u || p.bits >= 0x7f800000u) { xq_fail(); return; }
    xq_projection[edge * 32u + endpoint] = p.bits;
    for (var i = 0u; i < ${t.wordCount}u; i++) { xq_output[(edge * 2u + endpoint) * ${w}u + ${n.massOffsetWords}u + i] = integer.words[i]; }
  }
}
@compute @workgroup_size(32)
fn ingress_exact_exchange_surface(@builtin(global_invocation_id) id: vec3<u32>) {
  let edge = id.x; if (edge >= xq_params.x || atomicLoad(&xq_control[3u]) != 0u) { return; }
  let parcel = xq_edges[edge * 8u + 2u];
  xq_ingress(edge, 20u, xq_surfaces[parcel * 4u + 1u]); xq_ingress(edge, 21u, xq_surfaces[parcel * 4u + 3u]);
}
@compute @workgroup_size(32)
fn project_exact_exchange(@builtin(global_invocation_id) id: vec3<u32>) {
  let edge = id.x / 16u; let lane = id.x % 16u;
  if (edge >= xq_params.x || atomicLoad(&xq_control[3u]) != 0u) { return; }
  let slots = array<u32,16>(${N.views.map(e=>`${e}u`).join(`,`)});
  var v = xq_load(edge, slots[lane]); let p = xrp_project_f32_bits(&v);
  if (p.error != 0u || (p.bits & 0x7fffffffu) >= 0x7f800000u
      || ((lane < 2u || lane >= 10u) && (p.bits < 0x00800000u || p.bits >= 0x7f800000u))) { xq_fail(); return; }
  xq_projection[edge * 32u + lane] = p.bits;
}
@compute @workgroup_size(32)
fn store_exact_exchange(@builtin(global_invocation_id) id: vec3<u32>) {
  let edge = id.x; if (edge >= xq_params.x || atomicLoad(&xq_control[3u]) != 0u) { return; }
  let slots = array<u32,14>(${[...N.gas.slice(1),...N.liquid.slice(1)].map(e=>`${e}u`).join(`,`)});
  for (var field = 0u; field < 14u; field++) {
    let value_at = xq_at(edge, slots[field]);
    // Never truncate a widened computation into the original inventory.
    for (var i = ${T.wordCount}u; i < XR_WORDS; i++) {
      if ((xq_scratch[value_at + 4u + i] | xq_scratch[value_at + 4u + XR_WORDS + i]) != 0u) {
        xq_fail(); return;
      }
    }
    let to = (edge * 2u + field / 7u) * ${w}u + ${n.scalarOffsetWords}u + (field % 7u) * ${T.recordWords}u;
    for (var i = 0u; i < 4u; i++) { xq_output[to + i] = xq_scratch[value_at + i]; }
    for (var i = 0u; i < ${T.wordCount}u; i++) {
      xq_output[to + 4u + i] = xq_scratch[value_at + 4u + i];
      xq_output[to + ${4+T.wordCount}u + i] = xq_scratch[value_at + 4u + XR_WORDS + i];
    }
  }
  xq_projection[edge * 32u + 31u] = 1u;
}
`,G=[`prepare_exact_exchange`,`execute_exact_exchange`,`project_exact_exchange_mass`,`ingress_exact_exchange_surface`,`project_exact_exchange`,`store_exact_exchange`];A.shared&&G.push(`reduce_exact_exchange`),i&&G.push(`ingress_exact_pressure_work`,`reduce_exact_pressure_work`);let K=[];for(let n of G){let r=await m(e,{code:ie,entryPoint:n,cacheKey:`ulg-${n}-v8-${s}-${t.wordCount}-${t.quantumExponent}-${T.wordCount}-${E.wordCount}-${A.shared}-${i}-${j}-${M}`,label:`ulg-${n}`,bindings:[`read-only-storage`,`storage`,`storage`,`storage`,`read-only-storage`,`storage`,`read-only-storage`,`uniform`,`uniform`,`read-only-storage`].map((e,t)=>p(t,e))});if(!r.pipeline)throw r.error??Error(`Exact exchange pipeline unavailable: ${n}`);S(),K.push(r)}let ae=[z,B,V,te,g,_,b,H,ne,U],q=(t,n,r=0)=>{let i=e.createBindGroup({layout:K[n].bindGroupLayout,entries:ae.map((e,t)=>({binding:t,resource:t===8?{buffer:e,offset:r*P,size:16}:{buffer:e}}))}),a=t.beginComputePass();a.setPipeline(K[n].pipeline),a.setBindGroup(0,i),a.dispatchWorkgroups(Math.ceil(C*(n===4?16:n===6?12:n===8?3:1)/32)),a.end()};return{output:B,projection:te,layout:Object.freeze({...n,rowCount:C*2,byteLength:L}),format:t,dispatchCount:N.operations.length+5+F+(i?1+F:0),transient:[z,V,H,ne,U],prepare(e,t=null){if(S(),e.clearBuffer(V),e.clearBuffer(te),t)e.copyBufferToBuffer(t,0,z,0,L);else for(let t=0;t<C;t++){let n=r[t*8],i=r[t*8+1],a=r[t*8+2],o=n===0?d.quantities.quantityBuffer:f.buffer,s=n===0?i*w:i*f.layout.rowWords+f.layout.quantityOffsetWords;e.copyBufferToBuffer(o,s*4,z,t*2*w*4,w*4),e.copyBufferToBuffer(h.exactQuantities.quantityBuffer,a*w*4,z,(t*2+1)*w*4,w*4)}if(e.copyBufferToBuffer(z,0,B,0,L),M){e.copyBufferToBuffer(c,0,z,L,L);for(let t=0;t<C;t++)e.copyBufferToBuffer(u,(t*32+24)*4,te,(t*32+28)*4,4)}q(e,0)},accumulate(e){i&&q(e,7);for(let t=0;t<N.transferBoundary;t++)q(e,1,t);for(let t=0;t<F;t++)q(e,6,N.operations.length+t);for(let t=N.transferBoundary;t<N.pressureBoundary;t++)q(e,1,t);if(i)for(let t=0;t<F;t++)q(e,8,N.operations.length+t);for(let t=N.pressureBoundary;t<N.surfaceBoundary;t++)q(e,1,t);q(e,2)},finish(e){q(e,3);for(let t=N.surfaceBoundary;t<N.operations.length;t++)q(e,1,t);q(e,4),q(e,5)}}}async function A({device:e,particleRead:t,historyRead:n,aerosolRead:r,particleCount:i,edgeCount:a,edges:o,pairs:s,projection:l,candidateArena:u,productOffsetWords:d,control:f,allocate:h,validate:g}){g();let _=r.exactQuantities.quantityLayout.recordWords,v=n?.layout??null,y=n?.descriptor.rowCapacity??0,b=h(`exact-particle-endpoints`,i*_*4,140),x=h(`exact-aerosol-endpoints`,r.capacity*_*4,140),S=h(`exact-history-endpoints`,v?y*v.rowBytes:4,140),C=v?`
    let h = row * ${v.rowWords}u;
    let event = ${d}u + row * 32u;
    let state = h + ${v.stateOffsetWords}u;
    let thermo = h + ${v.thermoOffsetWords}u;
    let mechanics = h + ${v.mechanicsOffsetWords}u;
    let old_mass = bitcast<f32>(history[state + 3u]);
    let new_mass = bitcast<f32>(projected[edge * 32u]);
    for (var i = 0u; i < ${_}u; i++) { history[h + ${v.quantityOffsetWords}u + i] = pair_words[gas + i]; }
    // Produced/placed amounts and reaction lineage remain birth evidence.
    // The residual companion follows the current extensive quantity row.
    for (var i = 0u; i < ${v.massWordCount}u; i++) {
      history[h + ${v.residualMassOffsetWords}u + i] = pair_words[gas + 16u + i];
    }
    for (var i = 0u; i < 8u; i++) {
      let lane = array<u32, 8>(13u, 16u, 19u, 20u, 21u, 22u, 23u, 27u)[i];
      history[h + lane] = candidate[event + lane];
    }
    history[state + 3u] = projected[edge * 32u];
    for (var axis = 0u; axis < 3u; axis++) { history[state + 4u + axis] = projected[edge * 32u + 2u + axis]; }
    history[state + 7u] = projected[edge * 32u + 8u];
    history[thermo + 2u] = candidate[event + 16u];
    history[thermo + 9u] = bitcast<u32>(bitcast<f32>(candidate[event + 9u]) * 6.02214076e23);
    let old_radius = bitcast<f32>(history[thermo + 11u]);
    if (old_radius > 0.0) {
      let radius = old_radius * exp(log(new_mass / old_mass) / 3.0);
      if (!(radius > 0.0) || (bitcast<u32>(radius) & 0x7f800000u) == 0x7f800000u) {
        atomicOr(&control[3u], 4096u); return;
      }
      history[thermo + 11u] = bitcast<u32>(radius);
    }
    // M, V0 and V have the same exact scale factor: F and J are unchanged.
    // The outer integration still owes mechanics/pressure refresh before use.
    history[mechanics + 19u] = projected[edge * 32u + 10u];
    history[mechanics + 25u] = candidate[event + 27u];
    history[mechanics + 31u] = projected[edge * 32u + 12u];
    if (!exact_history_valid(0u, row)) { atomicOr(&control[3u], 4096u); }
  `:`atomicOr(&control[3u], 4096u);`,w=await m(e,{code:`
@group(0) @binding(0) var<storage, read> edges: array<u32>;
@group(0) @binding(1) var<storage, read> pair_words: array<u32>;
@group(0) @binding(2) var<storage, read> projected: array<u32>;
@group(0) @binding(3) var<storage, read> candidate: array<u32>;
@group(0) @binding(4) var<storage, read_write> particles: array<u32>;
@group(0) @binding(5) var<storage, read_write> aerosols: array<u32>;
@group(0) @binding(6) var<storage, read_write> history: array<u32>;
@group(0) @binding(7) var<storage, read_write> control: array<atomic<u32>>;
${v?c(v,`history`):``}
@compute @workgroup_size(64)
fn materialize_exact_vapor_endpoints(@builtin(global_invocation_id) id: vec3<u32>) {
  let edge = id.x; if (edge >= ${a}u || atomicLoad(&control[3u]) != 0u) { return; }
  if (atomicLoad(&control[16u + edge]) != 1u || projected[edge * 32u + 31u] != 1u) {
    atomicOr(&control[3u], 4096u); return;
  }
  let kind = edges[edge * 8u]; let row = edges[edge * 8u + 1u]; let parcel = edges[edge * 8u + 2u];
  let gas = edge * 2u * ${_}u; let liquid = gas + ${_}u;
  if (projected[edge * 32u + 20u] == edge) {
    for (var i = 0u; i < ${_}u; i++) { aerosols[parcel * ${_}u + i] = pair_words[liquid + i]; }
  }
  if (projected[edge * 32u + 19u] != edge) { return; }
  if (kind == 0u) {
    for (var i = 0u; i < ${_}u; i++) { particles[row * ${_}u + i] = pair_words[gas + i]; }
  } else { ${C} }
}
`,entryPoint:`materialize_exact_vapor_endpoints`,label:`ulg-materialize-exact-vapor-endpoints`,cacheKey:`ulg-exact-vapor-endpoints-v3:${_}:${v?.massWordCount??0}:${v?.rationalWordCount??0}:${v?.rowWords??0}:${a}:${d}`,bindings:[`read-only-storage`,`read-only-storage`,`read-only-storage`,`read-only-storage`,`storage`,`storage`,`storage`,`storage`].map((e,t)=>p(t,e))});if(!w.pipeline)throw w.error??Error(`Exact endpoint materialization pipeline unavailable`);g();let T=e.createBindGroup({layout:w.bindGroupLayout,entries:[o,s,l,u,b,x,S,f].map((e,t)=>({binding:t,resource:{buffer:e}}))});return Object.freeze({particleBuffer:b,aerosolBuffer:x,historyBuffer:v?S:null,particleLayout:Object.freeze({...t.quantities.quantityLayout,rowCount:i,byteLength:i*_*4,wordLength:i*_}),aerosolLayout:r.exactQuantities.quantityLayout,historyLayout:v,retainedBuffers:Object.freeze([b,x,S]),dispatchCount:1,encode(e){g(),e.copyBufferToBuffer(t.quantities.quantityBuffer,0,b,0,b.size),e.copyBufferToBuffer(r.exactQuantities.quantityBuffer,0,x,0,x.size),v?e.copyBufferToBuffer(n.buffer,0,S,0,S.size):e.clearBuffer(S);let i=e.beginComputePass();i.setPipeline(w.pipeline),i.setBindGroup(0,T),i.dispatchWorkgroups(Math.ceil(a/64)),i.end()}})}const j=e+`
struct ExchangeGeometry { words: array<vec4<u32>, 6>, };
@group(0) @binding(9) var<uniform> pressure_geometry: ExchangeGeometry;
fn xgp(lane: u32) -> u32 { return pressure_geometry.words[lane / 4u][lane % 4u]; }
fn xwork_axis(node: i32, cell: i32, axis: u32) -> f32 {
  let indexed = node + bitcast<i32>(xgp(7u));
  if (indexed < 0 || indexed >= i32(xgp(8u + axis))) { return -1.0; }
  let b = 12u + axis * 4u;
  let w = qcv_axis_projection(node, bitcast<i32>(xgp(b)), bitcast<f32>(xgp(b + 1u)),
    bitcast<i32>(xgp(b + 2u)), bitcast<f32>(xgp(b + 3u)));
  if (w.valid == 0u || !(w.capacity > 0.0)) { return -1.0; }
  return select(0.0, w.weight0, cell == w.cell0) + select(0.0, w.weight1, cell == w.cell1);
}
fn xwork_weight(position: vec3<f32>, cell: vec3<i32>) -> f32 {
  let levels = xgp(0u); let spacing = bitcast<f32>(xgp(1u));
  if ((levels != 1u && levels != 2u) || !xpos(spacing)) { return -1.0; }
  let p = position * (1.0 / spacing);
  if (!xvecfinite(p) || any(abs(p) > vec3<f32>(2147483000.0))) { return -1.0; }
  let base_f = floor(p - vec3<f32>(0.5)); let base = vec3<i32>(base_f); let f = p - base_f;
  var weights = vec3<f32>(0.0);
  // The tensor product is separable. Evaluate three one-dimensional adjoints
  // instead of visiting 27 fine nodes and up to eight parents for each pair.
  for (var axis = 0u; axis < 3u; axis++) {
    for (var ordinal = 0u; ordinal < 3u; ordinal++) {
      let delta = select(1.5 - f[axis], f[axis] - 0.5, ordinal == 2u);
      var b = 0.5 * delta * delta;
      if (ordinal == 1u) { let d = f[axis] - 1.0; b = 0.75 - d * d; }
      if (b == 0.0) { continue; }
      let node = base[axis] + i32(ordinal); let indexed = node + bitcast<i32>(xgp(2u));
      if (indexed < 0 || indexed >= i32(xgp(4u + axis))) { return -1.0; }
      var w = 0.0;
      if (levels == 1u) {
        w = xwork_axis(node, cell[axis], axis);
        if (w < 0.0) { return -1.0; }
      } else {
        // Same canonical 2:1 geometric A as the volume producer. Positive
        // out-of-grid support rejects; it is never clipped and redistributed.
        let coarse = f32(node) * 0.5 + f32(bitcast<i32>(xgp(7u)));
        let lo = floor(coarse); let fraction = coarse - lo;
        for (var corner = 0u; corner < 2u; corner++) {
          let a = select(1.0 - fraction, fraction, corner == 1u);
          if (a == 0.0) { continue; }
          let c = i32(lo) + i32(corner) - bitcast<i32>(xgp(7u));
          let v = xwork_axis(c, cell[axis], axis);
          if (v < 0.0) { return -1.0; }
          w += a * v;
        }
      }
      weights[axis] += b * w;
    }
  }
  return weights.x * weights.y * weights.z;
}
`;function M(e=32,t=!1){let n=`// Exact accumulation of the supplied f32 heat packets`,r=`const EXCHANGE_SHARED_MASS_SUPPORTED: bool = false;`;if(!E.includes(n)||!E.includes(r))throw Error(`Review original exchange admission before specializing`);return E.slice(0,E.indexOf(n)).replace(r,`const EXCHANGE_SHARED_MASS_SUPPORTED: bool = true;`).replace(`var<storage, read> edges:`,`var<storage, ${t?`read_write`:`read`}> edges:`).replace(`for (var lane = 23u; lane < 32u;`,`if (!xpos(bitcast<f32>(xp(23u))) || xp(24u) > 1u
        || (xp(24u) == 0u && (xp(25u) != 0u || xp(26u) != 0u))
        || (xp(24u) == 1u && (!xrange(xp(25u), xp(16u), 12u)
          || !xpos(bitcast<f32>(xp(26u)))))) { return false; }
      for (var lane = 27u; lane < 32u;`).replace(`array<vec2<u32>, 9>`,`array<vec2<u32>, 10>`).replace(`for (var i = 0u; i < 9u;`,`segments[9] = vec2<u32>(xp(25u), xp(24u) * xp(16u) * 12u);
  for (var i = 0u; i < 10u;`).replace(`for (var j = i + 1u; j < 9u;`,`for (var j = i + 1u; j < 10u;`).replace(`source[c + 5u] != 8u`,`source[c + 5u] != ${e/4}u`)+j+(t?`
fn xr_log1p(x: f32) -> f32 {
  if (abs(x) >= 0.01) { return log(1.0 + x); }
  var result = 0.0; var power = x;
  for (var k = 1u; k <= 7u; k++) {
    result += select(-1.0, 1.0, k % 2u == 1u) * power / f32(k); power *= x;
  }
  return result;
}
fn xr_thermal_affinity(x: f32) -> f32 {
  if (abs(x) >= 0.01) { return 0.5 * x * (2.0 + x) / (1.0 + x) - xr_log1p(x); }
  var result = 0.0; var power = x * x * x;
  for (var k = 3u; k <= 9u; k++) {
    result += select(-1.0, 1.0, k % 2u == 1u) * (0.5 - 1.0 / f32(k)) * power; power *= x;
  }
  return result;
}
fn xr_free_volume(key: vec3<f32>) -> f32 {
  var volume = 0.0; var matches = 0u;
  for (var cell = 0u; cell < source[xp(10u) + 10u]; cell++) {
    let p = xp(25u) + cell * 12u;
    if (all(vec3<f32>(xf(p), xf(p + 1u), xf(p + 2u)) == key)) {
      if (xf(p + 3u) != 1.0) { return -1.0; }
      volume = xf(p + 11u); matches++;
    }
  }
  return select(-1.0, volume, matches == 1u && xpos(volume));
}
fn xr_evaluate_rates(edge: u32, write_rates: bool) {
  if (edge >= xp(3u) || atomicLoad(&control[3u]) != 0u) { return; }
  let b = edge * 8u; let parcel = edges[b + 2u]; let row = edges[b + 3u];
  let a = xp(9u) + parcel * 24u; let gas = xgas(edge, row);
  let liquid = xmaterial_for(source[a + 12u]);
  if (gas.valid != 1u || liquid == 0xffffffffu || source[a + 22u] != 1u || source[a + 13u] != 2u) {
    xedge_fail(edge, ERROR_SOURCE); return;
  }
  let position = vec3<f32>(xf(a), xf(a + 1u), xf(a + 2u));
  // Neighboring cells contribute boundary work later, without nonlocal rates.
  if (!xq_same_cell(position, gas.position)) { return; }
  let m = liquid * 16u; let r = xp(4u) * 16u + m;
  if (materials[r] != 1.0) { xedge_fail(edge, ERROR_MATERIAL); return; }
  let key = floor(position / bitcast<f32>(xp(23u)));
  let volume = xr_free_volume(key);
  if (!xpos(volume)) { xedge_fail(edge, ERROR_SOURCE); return; }
  var total_pressure = 0.0; var vapor_pressure = 0.0; var vapor_t = 0.0;
  var species_mass = 0.0;
  for (var member = 0u; member < source[xp(10u) + 8u]; member++) {
    let c = xp(11u) + member * 16u;
    let member_key = floor(vec3<f32>(xf(c), xf(c + 1u), xf(c + 2u)) / bitcast<f32>(xp(23u)));
    let weight = xwork_weight(position, vec3<i32>(member_key));
    if (!xfinite(weight) || weight < 0.0) { xedge_fail(edge, ERROR_SOURCE); return; }
    if (weight == 0.0) { continue; }
    let member_volume = xr_free_volume(member_key);
    if (!xpos(member_volume)) { xedge_fail(edge, ERROR_SOURCE); return; }
    let pressure = xf(c + 5u) * bitcast<f32>(xp(26u)) * xf(c + 6u) / member_volume;
    if (!xpos(pressure)) { xedge_fail(edge, ERROR_DOMAIN); return; }
    // The liquid pressure uses the SAME occupancy adjoint as -p_j dV_j.
    // A point-cell pressure would be inconsistent with distributed volume work.
    total_pressure += pressure * weight;
    if (any(member_key != key)) { continue; }
    if (xf(c + 3u) == materials[row * 16u]) { species_mass += xf(c + 4u); }
    if (xf(c + 3u) == materials[m]) {
      if (vapor_t != 0.0 && vapor_t != xf(c + 6u)) { xedge_fail(edge, ERROR_DOMAIN); return; }
      vapor_t = xf(c + 6u); vapor_pressure += pressure;
    }
  }
  let tl = xf(a + 8u); let radius = xf(a + 10u); let area = xarea(radius, source[a + 14u], source[a + 15u]);
  let rho = materials[m + 8u]; let sigma = materials[m + 9u] + materials[m + 10u] * tl;
  let liquid_pressure = total_pressure + 2.0 * sigma / radius;
  let delta_t = gas.temperature - tl;
  if (!xpos(vapor_pressure) || !xpos(species_mass) || !xpos(liquid_pressure)
      || liquid_pressure > materials[m + 14u] || abs(delta_t) > materials[r + 11u]
      || abs(vapor_t - tl) > materials[r + 11u]) { xedge_fail(edge, ERROR_DOMAIN); return; }
  let t0 = materials[r + 1u]; let p0 = materials[r + 2u]; let rs = materials[r + 6u];
  let relative_t = (tl - t0) / t0;
  let log_pstar = log(p0) + materials[r + 3u] / rs * relative_t / tl
    + (materials[r + 5u] - materials[r + 4u]) / rs * (xr_log1p(relative_t) - (tl - t0) / tl)
    + (liquid_pressure - p0) / (rho * rs * tl);
  let pstar = exp(log_pstar);
  if (!xpos(pstar)) { xedge_fail(edge, ERROR_DOMAIN); return; }
  let dp = (vapor_pressure - pstar) / pstar;
  var log_s = log(vapor_pressure) - log_pstar;
  if (abs(dp) < 0.5) { log_s = xr_log1p(dp); }
  let affinity = rs * log_s + materials[r + 5u] * xr_thermal_affinity((vapor_t - tl) / tl);
  if (!xfinite(affinity) || abs(affinity) > materials[r + 10u]) { xedge_fail(edge, ERROR_DOMAIN); return; }
  // Partition each species' conductance and vapor flux over its actual
  // carriers; splitting a carrier must not multiply the interface area.
  let share = gas.mass / species_mass;
  let heat_coefficient = materials[xp(4u) * 32u + liquid * xp(4u) + row];
  let heat = area * heat_coefficient * delta_t * share;
  var rate = 0.0; var enthalpy_correction = 0.0;
  if (row == liquid) {
    rate = area * materials[r + 9u] * affinity * share;
    let mean_t = tl + (vapor_t - tl) * 0.5;
    let hv = materials[r + 8u] + materials[r + 7u] * (mean_t - t0) + rs * mean_t;
    let donor_u = select(gas.u, xf(a + 7u), rate < 0.0);
    // Exact transport already advects donor bulk U and kinetic energy.
    // Add only the enthalpy correction; never an extra latent-heat credit.
    enthalpy_correction = rate * (hv - donor_u);
  }
  if (!xfinite(rate) || !xfinite(heat) || !xfinite(enthalpy_correction)) { xedge_fail(edge, ERROR_NUMERIC); return; }
  if ((row == liquid && materials[r + 9u] > 0.0 && affinity != 0.0 && abs(rate) < 1.175494351e-38)
      || (heat_coefficient > 0.0 && delta_t != 0.0 && abs(heat) < 1.175494351e-38)) {
    xedge_fail(edge, ERROR_NUMERIC); return;
  }
  if (write_rates) {
    edges[b + 4u] = bitcast<u32>(rate); edges[b + 5u] = bitcast<u32>(enthalpy_correction);
    edges[b + 6u] = bitcast<u32>(heat);
  }
}
@compute @workgroup_size(64)
fn produce_exact_vapor_rates(@builtin(global_invocation_id) id: vec3<u32>) { xr_evaluate_rates(id.x, true); }
@compute @workgroup_size(64)
fn validate_exact_vapor_rate_endpoint(@builtin(global_invocation_id) id: vec3<u32>) { xr_evaluate_rates(id.x, false); }

fn xs_refresh(reset_completion: bool) {
  if (atomicLoad(&control[3u]) != 0u) { return; }
  if (atomicLoad(&control[5u]) != xp(3u)) { exchange_record_error(ERROR_COMPLETION); return; }
  for (var edge = 0u; edge < xp(3u); edge++) {
    if (atomicLoad(&control[16u + edge]) != 1u || exact_projection[edge * 32u + 31u] != 1u) {
      exchange_record_error(ERROR_COMPLETION); return;
    }
  }
  for (var member = 0u; member < source[xp(10u) + 8u]; member++) {
    let c = xp(11u) + member * 16u; let kind = select(1u, 0u, xf(c + 8u) == -1.0);
    let index = u32(xf(c + 9u));
    var found = false;
    for (var edge = 0u; edge < xp(3u); edge++) {
      let b = edge * 8u;
      if (edges[b] != kind || edges[b + 1u] != index) { continue; }
      found = true; break;
    }
    if (!found) { continue; }
    var mass = 0.0; var temperature = 0.0; var moles = 0.0; var energy = 0.0; var density = 0.0;
    if (kind == 0u) {
      let s = xp(5u) + index * 8u; let t = xp(6u) + index * 12u;
      mass = bitcast<f32>(candidate[s + 3u]); energy = bitcast<f32>(candidate[s + 7u]);
      temperature = bitcast<f32>(candidate[t + 2u]); density = bitcast<f32>(candidate[t + 3u]);
      moles = bitcast<f32>(candidate[t + 9u]) / EXCHANGE_AVOGADRO;
    } else {
      let h = xp(8u) + index * 32u;
      mass = bitcast<f32>(candidate[h + 13u]); energy = bitcast<f32>(candidate[h + 19u]);
      temperature = bitcast<f32>(candidate[h + 16u]); density = bitcast<f32>(candidate[h + 17u]);
      moles = bitcast<f32>(candidate[h + 9u]);
    }
    if (!xpos(mass) || !xpos(temperature) || !xpos(moles) || !xpos(density) || !xfinite(energy)) {
      exchange_record_error(ERROR_DOMAIN); return;
    }
    xc(c + 4u, mass); xc(c + 5u, moles); xc(c + 6u, temperature); xc(c + 7u, mass / density);
    xc(c + 12u, energy); xc(c + 13u, temperature);
  }
  for (var cell = 0u; cell < source[xp(10u) + 10u]; cell++) {
    let p = xp(25u) + cell * 12u; let key = vec3<f32>(xf(p), xf(p + 1u), xf(p + 2u));
    var volume_bits = 0u;
    for (var edge = 0u; edge < xp(3u); edge++) {
      let b = edge * 8u; let index = edges[b + 1u];
      let at = select(xp(5u) + index * 8u, xp(8u) + index * 32u, edges[b] == 1u);
      let gas_key = floor(vec3<f32>(xf(at), xf(at + 1u), xf(at + 2u)) / bitcast<f32>(xp(23u)));
      if (any(gas_key != key)) { continue; }
      let proposed = exact_projection[edge * 32u + 27u];
      if (proposed < 0x00800000u || proposed >= 0x7f800000u || (volume_bits != 0u && proposed != volume_bits)) {
        exchange_record_error(ERROR_NUMERIC); return;
      }
      volume_bits = proposed;
    }
    if (volume_bits != 0u) { candidate[p + 11u] = volume_bits; }
  }
  if (reset_completion) {
    atomicStore(&control[5u], 0u);
    for (var edge = 0u; edge < xp(3u); edge++) { atomicStore(&control[16u + edge], 0u); }
  }
}
@compute @workgroup_size(1)
fn prepare_exact_vapor_midpoint() { xs_refresh(true); }
@compute @workgroup_size(1)
fn prepare_exact_vapor_endpoint() { xs_refresh(false); }
@compute @workgroup_size(1)
fn begin_exact_vapor_substep() {
  if (atomicLoad(&control[3u]) != 0u) { return; }
  if (atomicLoad(&control[5u]) != xp(3u)) { exchange_record_error(ERROR_COMPLETION); return; }
  for (var edge = 0u; edge < xp(3u); edge++) {
    if (atomicLoad(&control[16u + edge]) != 1u || exact_projection[edge * 32u + 31u] != 1u) {
      exchange_record_error(ERROR_COMPLETION); return;
    }
  }
  for (var parcel = 0u; parcel < xp(2u); parcel++) {
    surfaces[parcel * 4u] = surfaces[parcel * 4u + 2u];
    surfaces[parcel * 4u + 1u] = surfaces[parcel * 4u + 3u];
  }
  atomicStore(&control[5u], 0u);
  for (var edge = 0u; edge < xp(3u); edge++) { atomicStore(&control[16u + edge], 0u); }
}
`:``)+`
@group(0) @binding(7) var<storage, read_write> exact_projection: array<u32>;
@group(0) @binding(8) var<storage, read> exact_history_validation: array<u32>;
fn xqf(edge: u32, lane: u32) -> f32 { return bitcast<f32>(exact_projection[edge * 32u + lane]); }
fn xq_same_cell(a: vec3<f32>, b: vec3<f32>) -> bool {
  // Same floor(position/native_spacing) and safe i32 range as the original
  // Schroeder uniform gas directory. Gas membership was witnessed by xgas.
  // Uniform word 23 comes from that retained EOS owner's private grid record.
  let spacing = bitcast<f32>(xp(23u));
  let first = floor(a / spacing); let second = floor(b / spacing);
  return all(abs(first) <= vec3<f32>(2147483520.0))
    && all(abs(second) <= vec3<f32>(2147483520.0)) && all(first == second);
}
fn xq_edge_local(edge: u32, parcel_position: vec3<f32>, gas_position: vec3<f32>) -> bool {
  if (xq_same_cell(parcel_position, gas_position)) { return true; }
  let b = edge * 8u;
  // Only boundary work reaches neighboring cells through the original volume
  // stencil. This does not authorize nonlocal mass or conductive heat packets.
  return xp(24u) == 1u && ((edges[b + 4u] | edges[b + 5u] | edges[b + 6u]) & 0x7fffffffu) == 0u
    && xwork_weight(parcel_position, vec3<i32>(floor(gas_position / bitcast<f32>(xp(23u))))) > 0.0;
}
// Frozen initial-state pressure is the stage value for -p_j dV_liquid.
// It is not a finite-interval pressure integral or a kinetic authorization.
// Every actual gas population in the cell must be present, including multiple
// carriers of the same species and carriers exchanging neither mass nor heat.
@compute @workgroup_size(64)
fn prepare_exact_vapor_pressure(@builtin(global_invocation_id) id: vec3<u32>) {
  let edge = id.x; if (edge >= xp(3u) || atomicLoad(&control[3u]) != 0u) { return; }
  if (xp(24u) != 1u || exact_history_validation[0u] != 0u) { xedge_fail(edge, ERROR_SOURCE); return; }
  let b = edge * 8u; let parcel = edges[b + 2u]; let row = edges[b + 3u];
  let a = xp(9u) + parcel * 24u; let gas = xgas(edge, row);
  let position = vec3<f32>(xf(a), xf(a + 1u), xf(a + 2u));
  let liquid_row = xmaterial_for(source[a + 12u]);
  if (gas.valid != 1u || liquid_row == 0xffffffffu
      || !xq_edge_local(edge, position, gas.position)
      || (edges[b + 7u] & 0x7fffffffu) != 0u) { xedge_fail(edge, ERROR_SOURCE); return; }
  let key = floor(gas.position / bitcast<f32>(xp(23u)));
  let weight = xwork_weight(position, vec3<i32>(key));
  if (!xpos(weight) || weight > 1.0) { xedge_fail(edge, ERROR_SOURCE); return; }
  var volume = 0.0; var matches = 0u;
  for (var cell = 0u; cell < source[xp(10u) + 10u]; cell++) {
    let p = xp(25u) + cell * 12u;
    if (any(vec3<f32>(xf(p), xf(p + 1u), xf(p + 2u)) != key)) { continue; }
    if (xf(p + 3u) != 1.0 || !xpos(xf(p + 11u))) { xedge_fail(edge, ERROR_SOURCE); return; }
    volume = xf(p + 11u); matches++;
  }
  if (matches != 1u) { xedge_fail(edge, ERROR_SOURCE); return; }
  for (var member = 0u; member < source[xp(10u) + 8u]; member++) {
    let c = xp(11u) + member * 16u;
    let member_key = vec3<i32>(floor(vec3<f32>(xf(c), xf(c + 1u), xf(c + 2u)) / bitcast<f32>(xp(23u))));
    let member_weight = xwork_weight(position, member_key);
    if (member_weight < 0.0 || !xfinite(member_weight)) { xedge_fail(edge, ERROR_SOURCE); return; }
    if (member_weight == 0.0) { continue; }
    let kind = select(1u, 0u, xf(c + 8u) == -1.0);
    var covered = false;
    for (var other = 0u; other < xp(3u); other++) {
      let o = other * 8u;
      if (edges[o] == kind && f32(edges[o + 1u]) == xf(c + 9u) && edges[o + 2u] == parcel) { covered = true; }
    }
    if (!covered) { xedge_fail(edge, ERROR_SOURCE); return; }
  }
  // Scalar material/state inputs are GPU copies. Exact M and net dM are used
  // by the rational stage; no projected mass delta or total-pressure split.
  exact_projection[edge * 32u + 21u] = bitcast<u32>(materials[row * 16u + 1u]);
  exact_projection[edge * 32u + 22u] = bitcast<u32>(gas.temperature);
  exact_projection[edge * 32u + 23u] = xp(26u);
  exact_projection[edge * 32u + 24u] = bitcast<u32>(volume);
  exact_projection[edge * 32u + 25u] = bitcast<u32>(materials[liquid_row * 16u + 8u]);
  exact_projection[edge * 32u + 26u] = bitcast<u32>(weight);
}
@compute @workgroup_size(64)
fn prepare_exact_vapor_surface(@builtin(global_invocation_id) id: vec3<u32>) {
  let edge = id.x; if (edge >= xp(3u) || atomicLoad(&control[3u]) != 0u) { return; }
  if (exact_history_validation[0u] != 0u) { xedge_fail(edge, ERROR_PRODUCT); return; }
  let b = edge * 8u; let parcel = edges[b + 2u]; let row = edges[b + 3u];
  let a = xp(9u) + parcel * 24u; let gas = xgas(edge, row);
  let liquid_row = xmaterial_for(source[a + 12u]);
  if (gas.valid != 1u || liquid_row == 0xffffffffu || source[a + 22u] != 1u || source[a + 13u] != 2u
      || !xq_edge_local(edge, vec3<f32>(xf(a), xf(a + 1u), xf(a + 2u)), gas.position)) { xedge_fail(edge, ERROR_SOURCE); return; }
  if (!xmechanics_valid(edges[b], edges[b + 1u], gas, row)) { xedge_fail(edge, ERROR_MECHANICS); return; }
  let has_mass = (edges[b + 4u] & 0x7fffffffu) != 0u;
  if (has_mass && (liquid_row != row || materials[row * 16u + 11u] != 1.0)) { xedge_fail(edge, ERROR_MATERIAL); return; }
  let radius = xradius(xqf(edge, 1u), materials[liquid_row * 16u + 8u], source[a + 14u], source[a + 15u]);
  let area = xarea(radius, source[a + 14u], source[a + 15u]);
  let energy = materials[liquid_row * 16u + 9u] * area;
  if (!xpos(radius) || !xpos(area) || !xpos(energy)) { xedge_fail(edge, ERROR_DOMAIN); return; }
  // Preserve the actual old geometry for bitwise unchanged projected mass.
  // This avoids a spurious surface-energy jump from recomputing the same radius.
  let unchanged = exact_projection[edge * 32u + 1u] == source[a + 3u];
  exact_projection[edge * 32u + 18u] = select(bitcast<u32>(radius), source[a + 10u], unchanged);
  if (exact_projection[edge * 32u + 20u] == edge) {
    surfaces[parcel * 4u + 2u] = select(area, surfaces[parcel * 4u], unchanged);
    surfaces[parcel * 4u + 3u] = select(energy, surfaces[parcel * 4u + 1u], unchanged);
  }
}
@compute @workgroup_size(64)
fn apply_exact_vapor_aerosol_exchange(@builtin(global_invocation_id) id: vec3<u32>) {
  let edge = id.x; if (edge >= xp(3u) || atomicLoad(&control[3u]) != 0u) { return; }
  if (exact_projection[edge * 32u + 31u] != 1u) { xedge_fail(edge, ERROR_COMPLETION); return; }
  let b = edge * 8u; let kind = edges[b]; let index = edges[b + 1u]; let parcel = edges[b + 2u]; let row = edges[b + 3u];
  let a = xp(9u) + parcel * 24u; let liquid_row = xmaterial_for(source[a + 12u]);
  let mg = xqf(edge, 0u); let ml = xqf(edge, 1u); let ug = xqf(edge, 8u); let ul = xqf(edge, 9u);
  let tg = xphase_t(row, ug, false); let tl = xphase_t(liquid_row, ul, true);
  let moles = mg / materials[row * 16u + 1u]; let entities = moles * EXCHANGE_AVOGADRO;
  let sound = sqrt(materials[row * 16u + 13u] * EXCHANGE_R / materials[row * 16u + 1u] * tg);
  if (!xpos(tg) || !xpos(tl) || !xpos(sound) || !xpos(moles) || !xpos(entities)
      || !xpos(materials[liquid_row * 16u + 9u] + materials[liquid_row * 16u + 10u] * tl)) { xedge_fail(edge, ERROR_DOMAIN); return; }
  if (exact_projection[edge * 32u + 19u] == edge) {
  if (kind == 0u) {
    let s = xp(5u) + index * 8u; let t = xp(6u) + index * 12u; let m = xp(7u) + index * 32u;
    xc(s + 3u, mg); for (var axis = 0u; axis < 3u; axis++) { candidate[s + 4u + axis] = exact_projection[edge * 32u + 2u + axis]; }
    xc(s + 7u, ug); xc(t + 2u, tg); xc(t + 9u, entities);
    if (xf(t + 11u) > 0.0) {
      let radius = xf(t + 11u) * exp(log(mg / xf(s + 3u)) / 3.0);
      if (!xpos(radius)) { xedge_fail(edge, ERROR_DOMAIN); return; } xc(t + 11u, radius);
    }
    xc(m + 19u, xqf(edge, 10u)); xc(m + 25u, sound); xc(m + 31u, xqf(edge, 12u));
  } else {
    let h = xp(8u) + index * 32u;
    xc(h + 3u, mg); xc(h + 13u, mg); xc(h + 12u, 0.0); xc(h + 9u, moles);
    xc(h + 19u, ug); xc(h + 16u, tg); xc(h + 23u, xqf(edge, 11u)); xc(h + 27u, sound);
    for (var axis = 0u; axis < 3u; axis++) { candidate[h + 20u + axis] = exact_projection[edge * 32u + 2u + axis]; }
  }
  }
  if (exact_projection[edge * 32u + 20u] == edge) {
    xc(a + 3u, ml); xc(a + 7u, ul); xc(a + 8u, tl); candidate[a + 10u] = exact_projection[edge * 32u + 18u];
    for (var axis = 0u; axis < 3u; axis++) { candidate[a + 4u + axis] = exact_projection[edge * 32u + 5u + axis]; }
  }
  atomicStore(&control[16u + edge], 1u); atomicAdd(&control[5u], 1u);
}
@compute @workgroup_size(1)
fn finalize_exact_vapor_aerosol_exchange() {
  if (!xlayout()) { exchange_record_error(ERROR_LAYOUT); }
  if (atomicLoad(&control[5u]) != xp(3u)) { exchange_record_error(ERROR_COMPLETION); }
  for (var edge = 0u; edge < xp(3u); edge++) {
    if (exact_projection[edge * 32u + 31u] != 1u || atomicLoad(&control[16u + edge]) != 1u) { exchange_record_error(ERROR_COMPLETION); }
  }
  // This producer has a complete numerical candidate, but has not issued a
  // new physical history/count or adopted either endpoint. The original
  // source count remains a historical input; it is never re-registered.
  atomicStore(&control[2u], select(2u, 1u, atomicLoad(&control[3u]) == 0u));
}
`}const N=new WeakMap,P=new WeakMap;function F(e){let t=P.get(e);return t||(t={lost:!1,listeners:new Set},P.set(e,t),Promise.resolve(e.lost).then(()=>{t.lost=!0;for(let e of[...t.listeners])e();t.listeners.clear()},()=>{})),t}function I(e,t,{positive:n=!1,maximum:r=4294967295}={}){if(!Number.isSafeInteger(e)||Object.is(e,-0)||e<+!!n||e>r)throw RangeError(`${t} must be an exact ${n?`positive `:``}u32`);return e}function L(e,t,n){let r=e&&Object.getOwnPropertyDescriptor(e,t);if(!r){if(e&&t in e)throw TypeError(`${t} must be an own data property`);if(arguments.length===3)return n;throw TypeError(`${t} is required`)}if(!Object.hasOwn(r,`value`))throw TypeError(`${t} must be an own data property`);return r.value}function R(e,t,n,r,i=4){if(!t||!_(t,e)||t.destroyed||!Number.isSafeInteger(t.size)||t.size<n||!Number.isInteger(t.usage)||(t.usage&i)!==i)throw TypeError(`${r} requires a live same-device buffer with exact capacity and usage`);return t}function ee(e,t){if(I(e,t),!Number.isSafeInteger(e*4))throw RangeError(`${t} byte size overflow`);return e}function z(e,t,n,r,i,a,o){if(!Array.isArray(e)||!e.length)throw TypeError(`Nonempty prescribed edges required`);I(e.length,`edge count`,{maximum:16777215});let s=new Uint32Array(e.length*8),c=new Float32Array(s.buffer),l=new Map,u=new Map;for(let d=0;d<e.length;d++){let f=L(e,String(d)),p=I(L(f,`gasKind`),`gas kind`,{maximum:1}),m=I(L(f,`gasIndex`),`gas index`),h=I(L(f,`parcelIndex`),`parcel index`),g=I(L(f,`materialRow`),`material row`),_=`${p}:${m}`;if(m>=(p===0?t:n)||h>=r||g>=i)throw RangeError(`Prescribed edges require in-range source and parcel indices`);let v=d*8;s.set([p,m,h,g],v);for(let[e,t]of[`deltaMassKg`,`transportEnthalpyCorrectionJ`,`conductiveHeatJ`,`pressureWorkIntoLiquidJ`].entries()){let n=L(f,t),r=Math.fround(n);if(typeof n!=`number`||!Number.isFinite(n)||!Number.isFinite(r)||n!==0&&r===0)throw RangeError(`${t} must be representable finite f32`);c[v+4+e]=r}let y=c[v+4]===0;if(o&&c[v+7]!==0)throw RangeError(`Initial-cell pressure work is derived; prescribed work must be zero`);if(y&&(c[v+5]!==0||c[v+7]!==0))throw RangeError(`Heat-only edges cannot carry mass enthalpy or pressure work`);if(!a&&(l.has(_)&&(!y||!l.get(_))||u.has(h)&&(!y||!u.get(h))))throw RangeError(`Mass-transfer edges require disjoint source and parcel indices`);l.set(_,y),u.set(h,y)}return s}function B(e){let t=new Set,n=F(e),r=new Set,i=n.lost,a=!1,o,s=new Promise(e=>{o=e}),c=()=>{i=!0,o(!1);for(let e of[...r])e()};i?c():n.listeners.add(c);let l=e=>{if(t.delete(e)){try{e.mapState===`mapped`&&e.unmap()}catch{}try{e.destroy()}catch{}}};return{resources:t,get lost(){return i},get quarantined(){return a},assertLive(){if(i)throw Error(`Vapor/aerosol candidate device lost`)},onLoss(e){i?e():r.add(e)},wait(e){return Promise.race([e,s.then(()=>{throw Error(`Vapor/aerosol candidate device lost`)})])},allocate(n,r,i){if(this.assertLive(),!Number.isSafeInteger(r)||r<=0||r%4!=0||r>(e.limits?.maxBufferSize??268435456)||i&128&&r>(e.limits?.maxStorageBufferBindingSize??134217728))throw RangeError(`${n} exceeds supported buffer limits`);let a=e.createBuffer({label:`ulg-vapor-aerosol-exchange-${n}`,size:r,usage:i});return t.add(a),h(a,e),a},async queuePoint(){if(i)return!1;let t;try{if(t=e.queue.onSubmittedWorkDone(),!t||typeof t.then!=`function`)throw Error(`Missing queue fence`)}catch{return a=!0,s}return await Promise.race([Promise.resolve(t).then(()=>!0,()=>(a=!0,s)),s])&&!i},destroy:l,destroyAll(){[...t].forEach(l),n.listeners.delete(c),r.clear()}}}async function V(e={}){let c=L(e,`device`);if(!c?.createBuffer||!c?.createCommandEncoder||!c?.queue?.writeBuffer||!c?.queue?.submit||!c?.queue?.onSubmittedWorkDone||!c?.lost?.then)throw TypeError(`Vapor/aerosol exchange requires a WebGPU device with confirmed retirement`);let l=I(L(e,`particleCount`),`particle count`,{positive:!0,maximum:16777215}),m=I(L(e,`compactCapacity`),`compact capacity`,{positive:!0,maximum:16777215}),h=I(L(e,`cellCapacity`),`cell capacity`,{positive:!0}),g=I(L(e,`executionGeneration`),`EOS generation`,{positive:!0}),_=R(c,L(e,`sourceStateBuffer`),l*32,`source state`),v=R(c,L(e,`sourceThermoBuffer`),l*48,`source thermo`),y=R(c,L(e,`sourceMechanicsBuffer`),l*128,`source mechanics`),x=R(c,L(e,`eosControlBuffer`),144,`EOS control`),S=R(c,L(e,`compactRowsBuffer`),m*64,`compact rows`),C=R(c,L(e,`caloricRowsBuffer`),h*32,`caloric cells`),w=L(e,`residentProductMass`,null),T=L(e,`productEventLiveCountDescriptor`,null),D=L(e,`aerosolRead`),O=D?.exactQuantities??null,j=L(e,`pressureWorkMode`,`prescribed`);if(![`prescribed`,`initial-cell-pressure`].includes(j)||!O&&j!==`prescribed`)throw TypeError(`Initial-cell pressure work requires exact exchange quantities`);let P=j===`initial-cell-pressure`,F=P?R(c,L(e,`pressureCellsBuffer`),h*48,`original EOS pressure cells`):null,V=P?L(e,`spatialGasConstantJPerMolK`):null;if(P&&(typeof V!=`number`||!Number.isFinite(V)||V<=0||Math.fround(V)!==V))throw RangeError(`Initial-cell pressure work requires the original f32 EOS gas constant`);let H=P?L(e,`pressureGeometryWords`):new Uint32Array(24);if(!(H instanceof Uint32Array)||H.length!==24)throw TypeError(`Pressure work requires the original complete occupancy geometry`);let ne=H.slice(),U=O?L(e,`spatialGasCellSizeM`):null;if(O&&(typeof U!=`number`||!Number.isFinite(U)||U<=0||Math.fround(U)!==U))throw RangeError(`Exact exchange requires the original finite positive f32 gas cell spacing`);let W=L(e,`exactParticleRead`,null),re=L(e,`exactPostMechanicsRead`,null);if(W&&re)throw TypeError(`Exchange cannot combine different exact source producers`);let ie=re?await import(`./sphGpuBuffers-CJXVL_XO.js`).then(e=>e.oi):null,G=ie?.resolveMlsMpmPostMechanicsExactGasRead(re,{device:c}),K=G?{...G,read:G.massRead}:W;if(O&&(!G&&!n(W,{device:c,sourceSphUpload:W?.sourceSphUpload})||!K?.quantities||K.read.format!==O.format||K.quantities.quantityLayout.recordWords!==O.quantityLayout.recordWords||K.sourceSphUpload.stateBuffer!==_||K.sourceSphUpload.thermoBuffer!==v||K.particleCount!==l||G&&G.sourceMlsUpload.mechanicsBuffer!==y))throw TypeError(`Exact exchange requires the matching original particle quantities`);let ae=0,q=null;if(w!=null){if(!b(T,{handle:w,device:c})||!O&&T.rowStrideFloats!==32||L(w,`productEventRowCount`)!==T.rowCapacity||L(w,`productEventStrideFloats`)!==T.rowStrideFloats)throw TypeError(`Exact full retained product count descriptor required`);ae=I(T.rowCapacity,`product capacity`,{positive:!0,maximum:16777215}),q=R(c,L(w,`productEventBuffer`),ae*128,`source products`),R(c,T.controlBuffer,T.controlOffsetBytes+256,`source product count`)}else if(T!=null)throw TypeError(`Absent history cannot carry a count descriptor`);let oe={device:c,family:D?.family,expectedGeneration:D?.generation};if(!a(D,oe))throw TypeError(`Exact retained aerosol read required`);let se=I(D.capacity,`aerosol capacity`,{positive:!0,maximum:16777215});R(c,D.buffer,se*96,`source parcels`);let ce=L(e,`materialRows`);if(!(ce instanceof Float32Array)||!ce.length||ce.length%16!=0)throw TypeError(`Complete Float32Array material rows required`);let le=Float32Array.prototype.slice.call(ce);if(!le.every(Number.isFinite))throw RangeError(`Material rows must be finite`);let ue=le.length/16,de=z(L(e,`edges`),l,ae,se,ue,!!O,P),fe=L(e,`rateRows`,null),J=fe!==null,pe=L(e,`rateIntegration`,`initial-rate`);if(![`initial-rate`,`midpoint`].includes(pe)||!J&&pe!==`initial-rate`)throw TypeError(`Rate integration requires an explicit supported state-derived method`);let me=J&&pe===`midpoint`,Y=L(e,`rateSubsteps`,1);if(!Number.isSafeInteger(Y)||Y<1||Y>1024||Y&Y-1||Y!==1&&!me)throw TypeError(`Rate substeps require midpoint and a power of two from 1 through 1024`);let he=d(L(e,`transportPacketMode`,`exact-rational`));if(!O&&he!==`exact-rational`)throw TypeError(`Rounded transport packets require exact inventory`);let ge=-Math.log2(Y),_e=le;if(J){if(!O||!G||!P||!(G.dtSeconds>0)||!Number.isFinite(G.dtSeconds)||!(fe instanceof Float32Array)||fe.length!==ue*(16+ue)||!fe.every(Number.isFinite))throw TypeError(`State-derived rates require original current quantities, interval, pressure and complete coefficients`);let e=new Set;for(let t=0;t<de.length;t+=8){let n=`${de[t]}:${de[t+1]}:${de[t+2]}`;if(e.has(n)||de.slice(t+4,t+8).some(e=>(e&2147483647)!=0))throw TypeError(`Rate edges require unique gas/parcel pairs and zero prescribed transfers`);e.add(n)}_e=new Float32Array(le.length+fe.length),_e.set(le),_e.set(fe,le.length)}let ve=de.length/8,ye=Math.ceil(ve/64);if(ye>(c.limits?.maxComputeWorkgroupsPerDimension??65535))throw RangeError(`Exchange edge dispatch exceeds device limit`);let be=Math.max(N.get(c)??0,T?.expectedGeneration??0)+1;I(be,`output count generation`,{positive:!0}),N.set(c,be);let X=0,xe=[],Se=(e,t,n=null,r=0)=>{let i={name:e,offset:X,words:t,source:n,sourceOffset:r};return X=ee(X+t,`source arena words`),xe.push(i),i},Ce=Se(`state`,l*8,_),we=Se(`thermo`,l*12,v),Te=Se(`mechanics`,l*32,y),Ee=Se(`products`,ae*32,q),De=Se(`parcels`,se*24,D.buffer),Oe=Se(`eos`,36,x),ke=Se(`compact`,m*16,S),Ae=Se(`caloric`,h*8,C);X=Math.ceil(X/64)*64;let je=Se(`product-count`,64,T?.controlBuffer??null,T?.controlOffsetBytes??0),Me=P?Se(`pressure-cells`,h*12,F):null,Ne=new Uint32Array(32);Ne.set([l,ae,se,ve,ue,Ce.offset,we.offset,Te.offset,Ee.offset,De.offset,Oe.offset,ke.offset,Ae.offset,je.offset,g,m,h,X,w==null?0:1,be,be,T?.expectedGeneration??0,T?.expectedSeal??0]),O&&(new Float32Array(Ne.buffer)[23]=U),P&&(Ne.set([1,Me.offset],24),new Float32Array(Ne.buffer)[26]=V);let Z=B(c),Pe=[],Fe=null,Ie=null,Le=null,Re=null,Q=null,ze=null,Be=null,$=null,Ve=!1,He=null,Ue=()=>{if(Fe){let e=Fe;Fe=null,o(e)}Re&&=(Re.release(),null),Ie&&=(u(Ie),null),Le&&=(ie.releaseMlsMpmPostMechanicsExactGasRead(Le),null)},We=()=>{if(Z.assertLive(),!a(Fe,oe)||w!=null&&(!b(T,{handle:w,device:c})||L(w,`productEventRowCount`)!==ae||L(w,`productEventStrideFloats`)!==T.rowStrideFloats))throw TypeError(`Exchange source read changed`);if(O&&!G&&!n(Ie,{device:c,sourceSphUpload:W.sourceSphUpload}))throw TypeError(`Exact exchange particle source changed`);Le&&ie.resolveMlsMpmPostMechanicsExactGasRead(Le,{device:c}),Re?.validate()};try{if(Fe=s(D,oe),O&&(G?Le=ie.forkMlsMpmPostMechanicsExactGasRead(re,{device:c}):Ie=i(W,{device:c,sourceSphUpload:W.sourceSphUpload}),w)){if(Re=(await import(`./sphMlsMpmGpuStep-C0mXorOX.js`).then(e=>e.C)).acquireResidentProductExactHistoryRead(w,{device:c,identityBuffer:K.sourceSphUpload.identityBuffer}),Re.layout.format!==O.format||Re.layout.quantityWords!==O.quantityLayout.recordWords)throw TypeError(`Exact exchange history must share the original run format`);Ve=!0,Be=await t({device:c,source:Re,allocate:e=>{let t=Z.allocate(e.label,e.size,e.usage);return Pe.push(t),t}}),Ee.source=Be.outputBuffer}let e=Z.allocate(`source-arena`,X*4,140),n=Z.allocate(`output-arena`,X*4,140),a=me?Z.allocate(`midpoint-arena`,X*4,140):null,o=Y>1?Z.allocate(`substep-arena`,X*4,140):e;o!==e&&Pe.push(o);let u=me?Z.allocate(`midpoint-initial-rates`,de.byteLength,140):null,d=Z.allocate(`params`,Ne.byteLength,72),m=Z.allocate(`edges`,de.byteLength,136|(J?4:0)),h=Z.allocate(`materials`,_e.byteLength,136),_=O?Z.allocate(`pressure-geometry`,96,72):null,v=Z.allocate(`control`,(16+ve)*4,140),y=Z.allocate(`surface`,se*4*4,140),b=me?Z.allocate(`midpoint-surfaces`,y.size,140):null,x=Z.allocate(`verdict`,64,9);Pe.push(e,n,d,h,x),J||Pe.push(m),_&&Pe.push(_);let S=new Map([Ce,we,Te,Ee,De,je].filter(e=>e.words>0&&(e!==je||w!=null&&!O)).map(e=>[e,Z.allocate(`candidate-${e.name}`,e.words*4,140)])),C=G?.sourceParticleRead??Ie;O&&r(C,[...S.values()],{mechanicsBuffers:[S.get(Te)]});let j=Be?.validationBuffer;O&&(j||(j=Z.allocate(`absent-history-validation`,16,140),Pe.push(j)),Ve=!0,me&&($=await k({device:c,format:O.format,layout:O.quantityLayout,edgeRows:de,cellPressureWork:P,transportPacketMode:he,dtSeconds:G.dtSeconds,intervalScaleExponent:ge-1,particleRead:K,historyRead:Re,aerosolRead:Fe,edges:m,control:v,surfaces:y,allocate:(e,t,n)=>Z.allocate(`midpoint-${e}`,t,n),validate:We}),Pe.push(...$.transient),r(C,[$.output,$.projection])),Q=await k({device:c,format:O.format,layout:O.quantityLayout,edgeRows:de,cellPressureWork:P,transportPacketMode:he,dtSeconds:J?G.dtSeconds:null,intervalScaleExponent:ge,donorPairs:$?.output??null,predictorProjection:$?.projection??null,particleRead:G?K:Ie,historyRead:Re,aerosolRead:Fe,edges:m,control:v,surfaces:y,allocate:(e,t,n)=>Z.allocate(e,t,n),validate:We}),Pe.push(...Q.transient),r(C,[Q.output,Q.projection]),ze=await A({device:c,particleRead:G?K:Ie,historyRead:Re,aerosolRead:Fe,particleCount:l,edgeCount:ve,edges:m,pairs:Q.output,projection:Q.projection,candidateArena:n,productOffsetWords:Ee.offset,control:v,allocate:(e,t,n)=>Z.allocate(e,t,n),validate:We}),r(C,ze.retainedBuffers));let N=O?[`initialize_vapor_aerosol_exchange`,...J?[`produce_exact_vapor_rates`]:[],...P?[`prepare_exact_vapor_pressure`]:[],`prepare_exact_vapor_surface`,`apply_exact_vapor_aerosol_exchange`,`finalize_exact_vapor_aerosol_exchange`]:[`initialize_vapor_aerosol_exchange`,`apply_vapor_aerosol_exchange`,`finalize_vapor_aerosol_exchange`],F=(e,t=Q,r=o,i=n,a=`final`)=>({entryPoint:e,work:t,from:r,to:i,role:a}),I=[...me?[F(`initialize_vapor_aerosol_exchange`,Q,e),...[`produce_exact_vapor_rates`,`prepare_exact_vapor_pressure`,`prepare_exact_vapor_surface`,`apply_exact_vapor_aerosol_exchange`,`prepare_exact_vapor_midpoint`].map(e=>F(e,$,o,a,`predictor`)),F(`produce_exact_vapor_rates`,Q,a),F(`prepare_exact_vapor_pressure`,Q,a),F(`prepare_exact_vapor_surface`),F(`apply_exact_vapor_aerosol_exchange`),F(`prepare_exact_vapor_endpoint`),F(`validate_exact_vapor_rate_endpoint`,Q,n,a),F(`finalize_exact_vapor_aerosol_exchange`)]:N.map(e=>F(e)),...Y>1?[F(`begin_exact_vapor_substep`)]:[]].map(({entryPoint:e,work:t,from:n,to:r,role:i})=>{let a=f(c,{cacheKey:`ulg-${e}.v1.${O?`exact-rk-substeps-${J}-${T?.rowStrideFloats??32}`:`legacy`}`,label:`ulg-${e}`,entryPoint:e,code:O?M(T?.rowStrideFloats??32,J):E,bindings:[`uniform`,`read-only-storage`,J?`storage`:`read-only-storage`,`read-only-storage`,`storage`,`storage`,`storage`,...O?[`storage`,`read-only-storage`,`uniform`]:[]].map((e,t)=>p(t,e))});return{info:a,bindGroup:c.createBindGroup({layout:a.bindGroupLayout,entries:[d,n,m,h,r,y,v,...O?[t.projection,j,_]:[]].map((e,t)=>({binding:t,resource:{buffer:e}}))}),entryPoint:e,work:t,role:i}}),L=Y>1?I.pop():null,R={midpointSourceWords:a,midpointInitialRateWords:u,midpointPairWords:$?.output,midpointProjectionWords:$?.projection,midpointSurfaceValues:b,rateWords:m,exactPairWords:Q?.output,exactProjectionWords:Q?.projection,surfaceValues:y,endpointSourceWords:n},ee=Y>1?Array.from({length:Y},(e,t)=>Object.fromEntries(Object.entries(R).map(([e,n])=>[e,Z.allocate(`substep-${t}-${e}`,n.size,140)]))):[];Ve=!0,c.queue.writeBuffer(d,0,Ne),c.queue.writeBuffer(m,0,de),c.queue.writeBuffer(h,0,_e),_&&c.queue.writeBuffer(_,0,ne);let z=c.createCommandEncoder({label:`ulg-vapor-aerosol-exchange`});z.clearBuffer(e),z.clearBuffer(v),z.clearBuffer(y),Be?Be.encode(z):O&&z.clearBuffer(j);for(let t of xe)t.source&&t.words&&z.copyBufferToBuffer(t.source,t.sourceOffset,e,t.offset*4,t.words*4);z.copyBufferToBuffer(e,0,n,0,X*4);for(let t=0;t<Y;t++){if(t>0){z.copyBufferToBuffer(n,0,o,0,X*4),z.copyBufferToBuffer(n,0,a,0,X*4);let e=z.beginComputePass();e.setPipeline(L.info.pipeline),e.setBindGroup(0,L.bindGroup),e.dispatchWorkgroups(1),e.end()}for(let[r,{info:i,bindGroup:s,entryPoint:c,work:l,role:d}]of I.entries()){if(r===0&&t!==0||r===I.length-1&&t!==Y-1)continue;let f=z.beginComputePass();f.setPipeline(i.pipeline),f.setBindGroup(0,s);let p=r===0||r===I.length-1||[`prepare_exact_vapor_midpoint`,`prepare_exact_vapor_endpoint`].includes(c);f.dispatchWorkgroups(p?1:ye),f.end(),me&&r===0&&(z.copyBufferToBuffer(n,0,a,0,X*4),o!==e&&z.copyBufferToBuffer(n,0,o,0,X*4)),O&&(J?c===`produce_exact_vapor_rates`:r===0)&&(l.prepare(z,t>0?Q.output:null),P||l.accumulate(z),d===`predictor`&&z.copyBufferToBuffer(m,0,u,0,m.size)),c===`prepare_exact_vapor_pressure`&&l.accumulate(z),c===`prepare_exact_vapor_surface`&&(l.finish(z),d===`predictor`&&z.copyBufferToBuffer(y,0,b,0,y.size)),c===`apply_exact_vapor_aerosol_exchange`&&d===`final`&&t===Y-1&&ze.encode(z)}if(ee.length)for(let[e,n]of Object.entries(R))z.copyBufferToBuffer(n,0,ee[t][e],0,n.size)}for(let[e,t]of S)z.copyBufferToBuffer(n,e.offset*4,t,0,e.words*4);z.copyBufferToBuffer(v,0,x,0,x.size);let B=z.finish();We(),c.queue.submit([B]);let V=Z.queuePoint(),H=null,U=null;try{await Z.wait(x.mapAsync(1)),He=x,U=new Uint32Array(x.getMappedRange()).slice(),x.unmap(),He=null}catch(e){H=e}if(!await V)throw Error(`Vapor/aerosol candidate device lost before confirmed source retirement`);if(H)throw H;if(We(),U.length!==16||U[0]!==1447118128||U[1]!==1||![1,2].includes(U[2])||U[4]!==ve||U[5]>ve||U[6]>ae||U[7]>se||U[8]!==be||U[9]!==be||U[10]!==g||U.slice(11).some(e=>e!==0)||U[2]===1&&(U[3]!==0||U[5]!==ve)||U[2]===2&&U[3]===0)throw Error(`Malformed vapor/aerosol GPU candidate verdict`);let q=U[2]===1,ce=Object.freeze({magic:U[0],version:U[1],status:U[2],errorBits:U[3],edgeCount:ve,acceptedEdges:U[5],productLiveCount:U[6],readyParcelCount:U[7],outputCountGeneration:O?null:U[8],outputCountSeal:O?null:U[9],candidateGeneration:U[8],productCountIssued:!O&&w!=null,expectedEosGeneration:U[10],words:Object.freeze([...U])});return Ue(),Pe.forEach(Z.destroy),te({device:c,cell:Z,ready:q,receipt:ce,particleCount:l,productCapacity:ae,aerosolCapacity:se,generation:be,stateBuffer:S.get(Ce),thermoBuffer:S.get(we),mechanicsBuffer:S.get(Te),productEventBuffer:S.get(Ee)??null,parcelBuffer:S.get(De),productCountBuffer:S.get(je)??null,surfaceBuffer:y,controlBuffer:v,sourceHistory:w,rateBuffer:J?m:null,rateIntervalSeconds:J?G.dtSeconds:null,rateIntegration:J?pe:null,rateSubsteps:J?Y:null,transportPacketMode:he,substepStages:ee,midpointStage:me?{sourceBuffer:a,rateBuffer:u,surfaceBuffer:b,pairBuffer:$.output,projectionBuffer:$.projection,productOffsetWords:Ee.offset,parcelOffsetWords:De.offset,pressureOffsetWords:Me.offset}:null,dispatchCount:Y*(I.length-2+(Q?.dispatchCount??0)+($?.dispatchCount??0))+2+Y-1+(ze?.dispatchCount??0)+(Be?.encodedDispatchCount??0),exactQuantities:Q?Object.freeze({pairBuffer:Q.output,projectionBuffer:Q.projection,quantityLayout:Q.layout,format:Q.format,edgeCount:ve,endpoints:Object.freeze({particleBuffer:ze.particleBuffer,particleLayout:ze.particleLayout,aerosolBuffer:ze.aerosolBuffer,aerosolLayout:ze.aerosolLayout,historyBuffer:ze.historyBuffer,historyLayout:ze.historyLayout})}):null})}catch(e){try{He&&He.unmap()}catch{}throw Ve&&!Z.lost&&await Z.queuePoint(),Z.destroyAll(),Ue(),e}}function te({device:e,cell:t,ready:n,receipt:r,particleCount:i,productCapacity:a,aerosolCapacity:o,generation:s,stateBuffer:c,thermoBuffer:l,mechanicsBuffer:u,productEventBuffer:d,parcelBuffer:f,productCountBuffer:p,surfaceBuffer:m,controlBuffer:h,sourceHistory:_,rateBuffer:v=null,rateIntervalSeconds:y=null,rateIntegration:T=null,rateSubsteps:E=null,transportPacketMode:D=`exact-rational`,substepStages:O=[],midpointStage:k=null,exactQuantities:A=null,dispatchCount:j=3}){let M,N=!1,P=!1,F=!1,L=0,R=0,ee=null,z,B=null,V=null,te=n?`vapor-aerosol-candidate-ready-not-adopted`:`vapor-aerosol-candidate-rejected`,H=()=>{if(t.assertLive(),N||P||F)throw Error(`Exchange candidate is released or has an active observation`);if(B&&(!b(V,{handle:B,device:e})||B.productEventBuffer!==d))throw TypeError(`Candidate product history changed`)},ne=async()=>{P||F||!t.lost&&(L||R)||(P=!0,await t.queuePoint(),B&&S(B),t.destroyAll(),z?.(!0))},U=()=>ee||(N=!0,ee=new Promise(e=>{z=e}),B&&C(B),ne(),ee),W=()=>{R++;let e=!1,n=Object.freeze({stateBuffer:c,thermoBuffer:l,mechanicsBuffer:u,parcelBuffer:f,exactQuantities:A,validate(){if(this!==n||e||P)throw TypeError(`Original live exchange producer read required`);return t.assertLive(),!0},retain(){return n.validate.call(this),W()},release(){if(this!==n)throw TypeError(`Original exchange producer read required`);return e?!1:(e=!0,R--,N&&ne(),!0)}});return n};return n&&d&&!A&&(B=g({schema:`peercompute.ulg.sph-residual-product-history-candidate.v0`,status:`residual-product-history-candidate-not-adopted`,productEventBuffer:d,productEventBufferRetained:!0,productEventBufferByteLength:a*128,productEventRowCount:a,productEventStrideFloats:32,productEventStrideBytes:128,sourceResidentProductMass:_,inventoryScope:`current-unplaced-residual-products-only`,consumeMassPolicy:`unplaced-product-mass-only`,historicalProductionTotals:!1,kineticsAdmitted:!1,exchangeIntervalAdmitted:!1,published:!1,destroyResidentProductMassBuffers:U},e),Object.defineProperty(B,"__ulgActiveBorrowCount",{enumerable:!1,configurable:!1,get:()=>L,set(e){I(e,`candidate product borrow count`),!((N||P)&&e>L)&&(L=e,N&&!L&&ne())}}),w(B,{device:e,controlBuffer:p,controlOffsetBytes:0,rowCapacity:a,rowStrideFloats:32,generation:s,seal:s,zeroTailSealed:!0}),V=x(B,e)),M=Object.freeze({schema:`peercompute.ulg.sph-vapor-aerosol-exchange-resource-owner.v0`,ready:n,status:te,receipt:r,particleCount:i,aerosolCapacity:o,productCapacity:a,stateBuffer:c,thermoBuffer:l,mechanicsBuffer:u,productEventBuffer:d,parcelBuffer:f,surfaceBuffer:m,controlBuffer:h,productCountBuffer:p,exactQuantities:A,residentProductMass:B,productEventLiveCountDescriptor:V,sourceAuthority:!1,kineticsAdmitted:!1,exchangeIntervalAdmitted:!1,published:!1,residentAdopted:!1,scientificValidation:!1,pressureRequiresRefresh:!0,mechanicsContinuationAdmitted:!1,outerPublicationAdmitted:!1,readbackByteLength:64,dispatchCount:j,rateIntervalSeconds:y,rateIntegration:T,rateSubsteps:E,transportPacketMode:D,retainProducer(){if(this!==M)throw TypeError(`Exact exchange resource owner required`);if(H(),!n||!A)throw TypeError(`Complete exact exchange output required`);return W()},async observe(){if(this!==M)throw TypeError(`Exact exchange resource owner required`);H(),F=!0;let i=null,a=!1,o=!1;try{let s=[[`stateValues`,c,Float32Array],[`thermoValues`,l,Float32Array],[`mechanicsValues`,u,Float32Array],[`productEventValues`,d,Float32Array],[`parcelWords`,f,Uint32Array],[`surfaceValues`,m,Float32Array],[`rateWords`,v,Uint32Array],[`midpointSourceWords`,k?.sourceBuffer,Uint32Array],[`midpointInitialRateWords`,k?.rateBuffer,Uint32Array],[`midpointPairWords`,k?.pairBuffer,Uint32Array],[`midpointProjectionWords`,k?.projectionBuffer,Uint32Array],[`midpointSurfaceValues`,k?.surfaceBuffer,Float32Array],[`productCountWords`,p,Uint32Array],[`controlWords`,h,Uint32Array],[`exactPairWords`,A?.pairBuffer,Uint32Array],[`exactProjectionWords`,A?.projectionBuffer,Uint32Array],[`exactParticleWords`,A?.endpoints.particleBuffer,Uint32Array],[`exactAerosolWords`,A?.endpoints.aerosolBuffer,Uint32Array],[`exactHistoryWords`,A?.endpoints.historyBuffer,Uint32Array]];O.forEach((e,t)=>{for(let[n,r]of Object.entries(e))s.push([`substep${t}:${n}`,r,n.endsWith(`Values`)?Float32Array:Uint32Array])});let g=0,_=s.map(([e,t,n])=>{let r={key:e,buffer:t,Type:n,offset:g,bytes:t?.size??0};return g+=r.bytes,r});i=t.allocate(`observation`,g,9);let b=e.createCommandEncoder({label:`ulg-vapor-aerosol-exchange-observation`});for(let e of _)e.buffer&&b.copyBufferToBuffer(e.buffer,0,i,e.offset,e.bytes);let x=b.finish();o=!0,e.queue.submit([x]);let S=t.queuePoint(),C=null,w=null;try{await t.wait(i.mapAsync(1)),a=!0,w=i.getMappedRange().slice(0),i.unmap(),a=!1}catch(e){C=e}if(!await S)throw Error(`Exchange observation lost its device`);if(C)throw C;return{ready:n,status:te,receipt:r,rateIntervalSeconds:y,rateIntegration:T,rateSubsteps:E,transportPacketMode:D,midpointViewLayout:k?{productOffsetWords:k.productOffsetWords,parcelOffsetWords:k.parcelOffsetWords,pressureOffsetWords:k.pressureOffsetWords}:null,...Object.fromEntries(_.map(e=>[e.key,e.buffer?new e.Type(w.slice(e.offset,e.offset+e.bytes)):null]))}}finally{try{a&&i.unmap()}catch{}o&&!t.lost&&await t.queuePoint(),i&&t.destroy(i),F=!1,N&&ne()}},release(){if(this!==M)throw TypeError(`Exact exchange resource owner required`);return U()}}),t.onLoss(()=>{L=0,U()}),M}export{V as runSphVaporAerosolExchangeCandidateGpu};