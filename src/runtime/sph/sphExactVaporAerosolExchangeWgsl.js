import { sphVaporAerosolExchangeWgsl } from './sphVaporAerosolExchangeWgsl.js';
import { sphVaporAerosolPressureGeometryWgsl } from './sphVaporAerosolPressureGeometryWgsl.js';
import { sphVaporAerosolRatesWgsl } from './sphVaporAerosolRatesWgsl.js';
import { sphVaporAerosolStageWgsl } from './sphVaporAerosolStageWgsl.js';

// Keep the original material, source membership, caloric and mechanics checks.
// Exact transfers share the original EOS cell geometry, rather than requiring
// carriers of distinct species to have identical point coordinates.
export function createSphExactVaporAerosolExchangeWgsl(historyStride = 32, produceRates = false) {
  const marker = '// Exact accumulation of the supplied f32 heat packets';
  const shared = 'const EXCHANGE_SHARED_MASS_SUPPORTED: bool = false;';
  if (!sphVaporAerosolExchangeWgsl.includes(marker) || !sphVaporAerosolExchangeWgsl.includes(shared)) {
    throw new Error('Review original exchange admission before specializing');
  }
  const admission = sphVaporAerosolExchangeWgsl.slice(0, sphVaporAerosolExchangeWgsl.indexOf(marker))
    .replace(shared, 'const EXCHANGE_SHARED_MASS_SUPPORTED: bool = true;')
    .replace('var<storage, read> edges:', `var<storage, ${produceRates ? 'read_write' : 'read'}> edges:`)
    .replace('for (var lane = 23u; lane < 32u;',
      `if (!xpos(bitcast<f32>(xp(23u))) || xp(24u) > 1u
        || (xp(24u) == 0u && (xp(25u) != 0u || xp(26u) != 0u))
        || (xp(24u) == 1u && (!xrange(xp(25u), xp(16u), 12u)
          || !xpos(bitcast<f32>(xp(26u)))))) { return false; }
      for (var lane = 27u; lane < 32u;`)
    .replace('array<vec2<u32>, 9>', 'array<vec2<u32>, 10>')
    .replace('for (var i = 0u; i < 9u;',
      'segments[9] = vec2<u32>(xp(25u), xp(24u) * xp(16u) * 12u);\n  for (var i = 0u; i < 10u;')
    .replace('for (var j = i + 1u; j < 9u;', 'for (var j = i + 1u; j < 10u;')
    .replace('source[c + 5u] != 8u', `source[c + 5u] != ${historyStride / 4}u`);
  return admission + sphVaporAerosolPressureGeometryWgsl
    + (produceRates ? sphVaporAerosolRatesWgsl + sphVaporAerosolStageWgsl : '') + /* wgsl */ `
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
`;
}
