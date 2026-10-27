import {
  SPH_VAPOR_AEROSOL_EXCHANGE_MAGIC,
  SPH_VAPOR_AEROSOL_EXCHANGE_VERSION,
  SPH_VAPOR_AEROSOL_EXCHANGE_ERROR as ERROR
} from '../../../ulg-gpu-abi/src/sphVaporAerosolExchange.js';

// This deliberately has no kinetic producer, timestep, saturation fit,
// nucleation rule, pressure-authority writer or publication operation.
// initialize/apply/finalize MUST be separate ordered GPU dispatches. The
// owner retains every real source and never exposes a failed candidate.
export const sphVaporAerosolExchangeWgsl = /* wgsl */ `
struct ExchangeParams { words: array<vec4<u32>, 8>, };
@group(0) @binding(0) var<uniform> params: ExchangeParams;
@group(0) @binding(1) var<storage, read> source: array<u32>;
@group(0) @binding(2) var<storage, read> edges: array<u32>;
@group(0) @binding(3) var<storage, read> materials: array<f32>;
@group(0) @binding(4) var<storage, read_write> candidate: array<u32>;
@group(0) @binding(5) var<storage, read_write> surfaces: array<f32>;
@group(0) @binding(6) var<storage, read_write> control: array<atomic<u32>>;

const EXCHANGE_MAGIC: u32 = ${SPH_VAPOR_AEROSOL_EXCHANGE_MAGIC}u;
const EXCHANGE_VERSION: u32 = ${SPH_VAPOR_AEROSOL_EXCHANGE_VERSION}u;
${Object.entries(ERROR).map(([name, value]) => `const ERROR_${name}: u32 = ${value}u;`).join('\n')}
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
`;
