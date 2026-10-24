// Fixed, material/scenario-agnostic functions. The cold table appends exact
// existing thermal graph samples and reference-state DATA to reaction_records.
// Used verbatim by apply and unplaced-product events: no separate energy law.
export const sphReactionEnergyWgsl = `
fn energy_finite(x: f32) -> bool {
  return x == x && abs(x) <= 3.402823e38;
}

fn reaction_energy_enabled(rx: u32) -> bool {
  let mode = reaction_records[rx * 3u + 2u];
  return mode.y == 1.0 && mode.w == 1.0 && mode.z > 0.0;
}

fn reaction_consumed_mass(rx: u32, mass: f32, extent: f32, coefficient: f32, molar_mass: f32) -> f32 {
  if (reaction_energy_enabled(rx) && extent >= mass / (coefficient * molar_mass)) {
    return mass;
  }
  return min(mass, extent * coefficient * molar_mass);
}

fn energy_header(rx: u32) -> u32 {
  return u32(reaction_records[rx * 3u + 2u].z);
}

// kind=0 reactant, keyed by material; kind=1 product, keyed by exact term ID.
fn energy_term(rx: u32, kind: u32, key: f32) -> u32 {
  let lists = reaction_records[energy_header(rx) + 1u];
  let start = u32(select(lists.x, lists.z, kind == 1u));
  let count = u32(select(lists.y, lists.w, kind == 1u));
  for (var i = 0u; i < count; i = i + 1u) {
    let descriptor = u32(reaction_records[start + i].x);
    let term_key = select(reaction_records[descriptor].x,
      reaction_records[descriptor + 2u].x, kind == 1u);
    if (term_key == key) { return descriptor; }
  }
  return 0u;
}

// [value, density, ready, phase]. Inverse reads T and returns specific U.
// Values outside an exact pure-phase domain are rejected, never clamped into
// a different phase. Ambiguous shared-T latent discontinuities also reject.
fn energy_phase_value(descriptor: u32, phase: f32, value: f32, inverse: bool) -> vec4<f32> {
  if (descriptor == 0u || !energy_finite(value)) { return vec4<f32>(0.0); }
  let list = reaction_records[descriptor + 1u];
  var result = vec4<f32>(0.0);
  for (var i = 0u; i < u32(list.y); i = i + 1u) {
    let curve = reaction_records[u32(list.x) + i * 2u];
    let domain = reaction_records[u32(list.x) + i * 2u + 1u];
    if (curve.x != phase) { continue; }
    let lo = select(domain.z, domain.x, inverse);
    let hi = select(domain.w, domain.y, inverse);
    if (value < lo || value > hi) { continue; }
    let start = u32(curve.y);
    for (var s = 1u; s < u32(curve.z); s = s + 1u) {
      let a = reaction_records[start + s - 1u];
      let b = reaction_records[start + s];
      let ax = select(a.x, a.y, inverse);
      let bx = select(b.x, b.y, inverse);
      if (value <= bx) {
        let ay = select(a.y, a.x, inverse);
        let by = select(b.y, b.x, inverse);
        let y = ay + (value - ax) / (bx - ax) * (by - ay);
        if (!energy_finite(y)) { return vec4<f32>(0.0); }
        if (result.z == 1.0 && (result.x != y || result.y != curve.w)) {
          return vec4<f32>(0.0);
        }
        result = vec4<f32>(y, curve.w, 1.0, phase);
        break;
      }
    }
  }
  return result;
}

fn energy_source_ready(rx: u32, thermo0: vec4<f32>, fractions: vec4<f32>,
  thermo2: vec4<f32>, vel_u: vec4<f32>) -> bool {
  if (!all(abs(thermo0) <= vec4<f32>(3.402823e38))
    || !all(abs(fractions) <= vec4<f32>(3.402823e38))
    || !all(abs(thermo2) <= vec4<f32>(3.402823e38))) { return false; }
  let phase = thermo0.y;
  if (phase != 1.0 && phase != 2.0 && phase != 3.0) { return false; }
  let expected = vec4<f32>(select(0.0, 1.0, phase == 1.0),
    select(0.0, 1.0, phase == 2.0), select(0.0, 1.0, phase == 3.0), 0.0);
  let state = energy_phase_value(energy_term(rx, 0u, thermo0.x), phase, vel_u.w, false);
  return thermo2.z == 1.0 && all(fractions == expected) && state.z == 1.0
    && state.x > 0.0 && energy_finite(thermo0.z) && thermo0.w == state.y
    && abs(thermo0.z - state.x) <= 1.0e-4 * state.x
    && all(vel_u == vel_u) && all(abs(vel_u) <= vec4<f32>(3.402823e38));
}

// Restrict the first honest reaction domain to relaxed carriers: no hidden
// elastic/affine kinetic energy is discarded by birth at F=I, C=0, J=1.
fn energy_relaxed_mechanics(a: vec4<f32>, b: vec4<f32>, c: vec4<f32>,
  d: vec4<f32>, e: vec4<f32>) -> bool {
  let identity = vec4<f32>(1.0, 0.0, 0.0, 0.0);
  return all(a == identity) && all(b == identity) && all(c == identity)
    && all(d == vec4<f32>(0.0)) && all(e.xyz == vec3<f32>(0.0, 0.0, 1.0))
    && e.w > 0.0 && energy_finite(e.w);
}

fn energy_product_state(rx: u32, product_term_index: u32, temperature: f32) -> vec4<f32> {
  let descriptor = energy_term(rx, 1u, f32(product_term_index));
  if (descriptor == 0u) { return vec4<f32>(0.0); }
  return energy_phase_value(descriptor, reaction_records[descriptor + 1u].w, temperature, true);
}

// Returns [sum of m*(u(T,phase)-u_ref), ready]. Actual mass normalization
// matters: replacing m by extent*nu*M leaks independently shifted U zeros.
fn energy_product_sensible(rx: u32, temperature: f32, extent: f32, mass_scale: f32) -> vec2<f32> {
  let lists = reaction_records[energy_header(rx) + 1u];
  var total = 0.0;
  for (var i = 0u; i < u32(lists.w); i = i + 1u) {
    let descriptor = u32(reaction_records[u32(lists.z) + i].x);
    let term = reaction_records[descriptor];
    let state = energy_phase_value(descriptor, reaction_records[descriptor + 1u].w, temperature, true);
    if (state.z != 1.0) { return vec2<f32>(0.0); }
    let mass = extent * term.y * term.z * mass_scale;
    total = total + mass * (state.x - term.w);
  }
  return vec2<f32>(total, select(0.0, 1.0, energy_finite(total)));
}

// Closed adiabatic chemistry in the runtime's per-material U gauges:
// sum p*(u_p-u_p_ref) = sum c*(u_r-u_r_ref + relative KE) - extent*DeltaU_ref.
// Formation and latent offsets already in the caloric graphs count ONCE.
// The external heat source is zero. Return [common product T, ready].
fn energy_product_temperature(rx: u32, material0: f32, material1: f32,
  mass0: f32, mass1: f32, vel_u0: vec4<f32>, vel_u1: vec4<f32>,
  extent: f32, mass_scale: f32, velocity: vec3<f32>) -> vec2<f32> {
  let ref0 = energy_term(rx, 0u, material0);
  let ref1 = energy_term(rx, 0u, material1);
  if (ref0 == 0u || ref1 == 0u || !(mass0 > 0.0) || !(mass1 > 0.0)) {
    return vec2<f32>(0.0);
  }
  let relative0 = vel_u0.xyz - velocity;
  let relative1 = vel_u1.xyz - velocity;
  let header = energy_header(rx);
  let target_sensible = mass0 * (vel_u0.w - reaction_records[ref0].w + 0.5 * dot(relative0, relative0))
    + mass1 * (vel_u1.w - reaction_records[ref1].w + 0.5 * dot(relative1, relative1))
    - extent * reaction_records[header].y;
  var lo = reaction_records[header + 2u].x;
  var hi = reaction_records[header + 2u].y;
  let lower = energy_product_sensible(rx, lo, extent, mass_scale);
  let upper = energy_product_sensible(rx, hi, extent, mass_scale);
  if (!energy_finite(target_sensible) || lower.y != 1.0 || upper.y != 1.0
    || target_sensible < lower.x || target_sensible > upper.x) { return vec2<f32>(0.0); }
  for (var i = 0u; i < 32u; i = i + 1u) {
    let mid = lo + 0.5 * (hi - lo);
    let value = energy_product_sensible(rx, mid, extent, mass_scale);
    if (value.y != 1.0) { return vec2<f32>(0.0); }
    if (value.x < target_sensible) { lo = mid; } else { hi = mid; }
  }
  return vec2<f32>(lo + 0.5 * (hi - lo), 1.0);
}
`;

// Diagnostic/sidecar consumers must not turn a rejected proposal into product
// mass. Apply commits a pair atomically; unchanged current buffers are no-op
// evidence, not evidence of an event. Never mutate borrowed discovery rows.
export const sphReactionAppliedPairWgsl = `
fn physical_reaction_pair_applied(rx: u32, a: u32, b: u32) -> bool {
  if (reaction_records[rx * 3u + 2u].y != 1.0) { return true; }
  var changed = false;
  for (var i = 0u; i < 2u; i = i + 1u) {
    let index = select(a, b, i == 1u);
    let before_m = source_state[index * 2u].w;
    let after_m = next_state[index * 2u].w;
    let before_u = source_state[index * 2u + 1u];
    let after_u = next_state[index * 2u + 1u];
    let before_t = source_thermo[index * 3u];
    let after_t = next_thermo[index * 3u];
    if (!(before_m > 0.0) || !(after_m >= 0.0)
      || !all(abs(before_u) <= vec4<f32>(3.402823e38))
      || !all(abs(after_u) <= vec4<f32>(3.402823e38))
      || !all(abs(before_t) <= vec4<f32>(3.402823e38))
      || !all(abs(after_t) <= vec4<f32>(3.402823e38))) { return false; }
    changed = changed || before_m != after_m || any(before_u != after_u) || any(before_t != after_t);
  }
  return changed;
}
`;
