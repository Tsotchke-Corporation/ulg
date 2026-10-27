// Existing-interface near-equilibrium Onsager model, matching
// condensableFiniteCell.js. This is an explicit phenomenological model, not
// calibrated all-Kn transport, activation, or a claim of interval accuracy.
// Every hot operand comes from the retained source/EOS buffers. Distinct
// noncondensable temperatures remain distinct; unequal-T vapor reservoirs
// reject because this model requires one thermodynamic vapor reservoir.
export const sphVaporAerosolRatesWgsl = /* wgsl */ `
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
`;
