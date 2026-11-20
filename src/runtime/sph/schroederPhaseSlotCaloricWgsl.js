// Shared by physical refinement and its exact-ledger admission pass.
export const schroederPhaseSlotCaloricWgsl = /* wgsl */ `
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
`;
