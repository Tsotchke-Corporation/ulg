// Private RK stage views, owned by this exchange operation. Membership,
// positions and cell topology are retained from the original EOS; only the
// staged numerical M/U/T/n and exact volume-change projection are refreshed.
// These buffers never register an EOS/history/count or publication authority.
export const sphVaporAerosolStageWgsl = /* wgsl */ `
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
`;
