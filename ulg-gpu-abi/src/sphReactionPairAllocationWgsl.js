// One record per lower particle index, followed by all global product terms.
// This first producer uses the existing f32 physical-energy domain. Integer
// packet selection and exact carrier/history adoption remain separate work.
export const SPH_REACTION_PAIR_HEADER_VEC4S = 8;
export const SPH_REACTION_PAIR_EVENT_VEC4S = 8;

export const sphReactionPairAddressWgsl = `
fn pair_allocation_base(index: u32) -> u32 {
  return index * (8u + params.product_term_count * 8u);
}
fn pair_event_base(index: u32, term: u32) -> u32 {
  return pair_allocation_base(index) + 8u + term * 8u;
}
fn pair_allocation_ready(rx: u32, a: u32, b: u32) -> bool {
  if (a >= params.particle_count || b >= params.particle_count || a >= b) { return false; }
  let base = pair_allocation_base(a);
  if (base + 8u > arrayLength(&pair_allocations)) { return false; }
  return all(pair_allocations[base] == vec4<f32>(1.0, f32(b), f32(rx), 3.0));
}
`;

export const sphReactionPairWriterWgsl = `
@group(0) @binding(25) var<storage, read_write> pair_allocations: array<vec4<f32>>;
${sphReactionPairAddressWgsl}

// Header 5 certifies preparation within the owning invocation, never acceptance.
// Header 6 holds [remaining_a, remaining_b, source_mass_a, source_mass_b]. These
// are current f32 values; future exact zero/activity decisions require their own
// integer predicate and must not be inferred from this projection.
fn pair_allocation_prepared(rx: u32, a: u32, b: u32) -> bool {
  if (a >= params.particle_count || b >= params.particle_count || a >= b) { return false; }
  let base = pair_allocation_base(a);
  if (base + 8u > arrayLength(&pair_allocations)) { return false; }
  return all(pair_allocations[base + 5u] == vec4<f32>(1.0, f32(b), f32(rx), 1.0));
}

fn pair_selected_remainder(a: u32, b: u32) -> vec2<f32> {
  if (a >= params.particle_count) { return vec2<f32>(-1.0); }
  let base = pair_allocation_base(a);
  if (base + 8u > arrayLength(&pair_allocations)) { return vec2<f32>(-1.0); }
  let prepared = pair_allocations[base + 5u];
  if (prepared.z < 0.0 || prepared.z >= f32(params.reaction_count)
    || prepared.z != floor(prepared.z)
    || !pair_allocation_prepared(u32(prepared.z), a, b)) { return vec2<f32>(-1.0); }
  return pair_allocations[base + 6u].xy;
}

fn pair_selected_product_mass(a: u32, rx: u32, term: u32) -> f32 {
  if (a >= params.particle_count || term >= params.product_term_count) { return 0.0; }
  let base = pair_allocation_base(a);
  if (base + 8u > arrayLength(&pair_allocations)) { return 0.0; }
  let prepared = pair_allocations[base + 5u];
  if (prepared.y < 0.0 || prepared.y >= f32(params.particle_count)
    || prepared.y != floor(prepared.y)
    || !pair_allocation_prepared(rx, a, u32(prepared.y))) { return 0.0; }
  let event = pair_event_base(a, term);
  if (event + 8u > arrayLength(&pair_allocations)) { return 0.0; }
  let identity = pair_allocations[event + 1u];
  if (identity.y != f32(term) || identity.z != f32(rx) || identity.w != f32(a)) { return 0.0; }
  return pair_allocations[event].w;
}

// Choose the physical allocation ONCE, before COM or caloric evaluation. Only
// the lower mutual endpoint prepares it; later endpoint/event writes read it.
fn prepare_allocated_pair(a: u32, b: u32, rx: u32, extent: f32,
  consumed_a: f32, consumed_b: f32, raw_mass: f32, consumed_volume: f32) -> bool {
  if (a >= params.particle_count || b >= params.particle_count || a >= b
    || rx >= params.reaction_count) { return false; }
  let base = pair_allocation_base(a);
  if (base + 8u + params.product_term_count * 8u > arrayLength(&pair_allocations)) { return false; }
  pair_allocations[base] = vec4<f32>(0.0);
  pair_allocations[base + 5u] = vec4<f32>(0.0);
  let source_a = state_pos_mass(a).w;
  let source_b = state_pos_mass(b).w;
  let total = consumed_a + consumed_b;
  let scale = total / raw_mass;
  let remaining_a = max(source_a - consumed_a, 0.0);
  let remaining_b = max(source_b - consumed_b, 0.0);
  if (!all(abs(vec4<f32>(extent, consumed_a, consumed_b, raw_mass)) <= vec4<f32>(3.402823e38))
    || !all(abs(vec4<f32>(total, scale, consumed_volume, source_a)) <= vec4<f32>(3.402823e38))
    || !energy_finite(source_b) || !(extent > 0.0) || !(raw_mass > 0.0)
    || !(consumed_a > 0.0) || !(consumed_b > 0.0) || !(total > 0.0)
    || !(consumed_volume > 0.0) || consumed_a > source_a || consumed_b > source_b
    // Keep this gate until exact carrier and residual owners are wired.
    || remaining_a >= source_a || remaining_b >= source_b) { return false; }
  let count_value = reaction_header_row1(rx).x;
  let offset_value = reaction_header_row0(rx).w;
  if (!(count_value > 0.0) || count_value != floor(count_value)
    || count_value > f32(params.product_term_count)
    || !(offset_value >= 0.0) || offset_value != floor(offset_value)
    || offset_value + count_value > f32(params.product_term_count)) { return false; }
  let count = u32(count_value);
  let offset = u32(offset_value);
  for (var local = 0u; local < count; local++) {
    let term_index = offset + local;
    let term0 = product_term_row0(term_index);
    let term1 = product_term_row1(term_index);
    var mass = extent * term0.z * term0.w * scale;
    // A single product owns the full consumed pair, including the case where
    // its direct representation is split over both freed endpoints.
    if (count == 1u) { mass = total; }
    if (!(mass > 0.0) || !energy_finite(mass) || term1.w != 1.0
      || !(term0.y > 0.0) || !(term0.z > 0.0) || !(term0.w > 0.0)
      || !all(abs(term0) <= vec4<f32>(3.402823e38))) { return false; }
    let event = pair_event_base(a, term_index);
    pair_allocations[event] = vec4<f32>(0.0, 0.0, 0.0, mass);
    pair_allocations[event + 1u] = vec4<f32>(term0.y, f32(term_index), f32(rx), f32(a));
  }
  pair_allocations[base + 1u] = vec4<f32>(extent, consumed_a, consumed_b, raw_mass);
  pair_allocations[base + 2u] = vec4<f32>(total, scale, consumed_volume, 0.0);
  pair_allocations[base + 6u] = vec4<f32>(remaining_a, remaining_b, source_a, source_b);
  // No output or product event is accepted by this preparation marker.
  pair_allocations[base + 5u] = vec4<f32>(1.0, f32(b), f32(rx), 1.0);
  return true;
}

@compute @workgroup_size(64)
fn initialize_pairs(@builtin(global_invocation_id) id: vec3<u32>) {
  if (id.x >= params.particle_count) { return; }
  copy_particle(id.x);
  let base = pair_allocation_base(id.x);
  // Clear the whole record on each invocation, including warm reuse. A later
  // rejected pair cannot expose a prior accepted event or completion marker.
  for (var i = 0u; i < 8u + params.product_term_count * 8u; i++) {
    pair_allocations[base + i] = vec4<f32>(0.0);
  }
}

fn pair_endpoint_ready(index: u32) -> bool {
  let base = index * REACTION_PARTICLE_RECORD_VEC4S;
  for (var i = 0u; i < REACTION_PARTICLE_RECORD_VEC4S; i++) {
    if (!all(abs(out_particle_records[base + i]) <= vec4<f32>(3.402823e38))) { return false; }
  }
  let mass = out_particle_records[base].w;
  let volume = out_particle_records[base + 9u];
  return mass >= 0.0 && (mass == 0.0 || (volume.z > 0.0 && volume.w > 0.0));
}

fn reject_allocated_pair(a: u32, b: u32, reason: u32) {
  copy_particle(a); copy_particle(b);
  pair_allocations[pair_allocation_base(a)] = vec4<f32>(0.0);
  pair_allocations[pair_allocation_base(a) + 4u] = vec4<f32>(f32(reason), 0.0, 0.0, 0.0);
  pair_allocations[pair_allocation_base(a) + 5u] = vec4<f32>(0.0);
}

// Only the lower mutual endpoint invokes this function. Both output rows and
// all event payloads are speculative until its final acceptance marker. The
// next dispatch observes the complete choice, never one endpoint alone.
fn commit_allocated_pair(a: u32, b: u32, rx: u32, temperature: f32, velocity: vec3<f32>) {
  if (!pair_allocation_prepared(rx, a, b)) {
    reject_allocated_pair(a, b, 7u); return;
  }
  let base = pair_allocation_base(a);
  let selected = pair_allocations[base + 1u];
  let consumed_a = selected.y;
  let consumed_b = selected.z;
  let allocation = pair_allocations[base + 2u];
  let total = allocation.x;
  let consumed_volume = allocation.z;
  let remaining = pair_selected_remainder(a, b);
  let remaining_a = remaining.x;
  let remaining_b = remaining.y;
  let free_a = remaining_a == 0.0;
  let free_b = remaining_b == 0.0;
  let count = u32(reaction_header_row1(rx).x);
  let offset = u32(reaction_header_row0(rx).w);
  var direct_terms = array<u32, 2>(0xffffffffu, 0xffffffffu);
  var direct_masses = array<f32, 2>(0.0, 0.0);
  copy_particle_with_mass(a, remaining_a, true);
  copy_particle_with_mass(b, remaining_b, true);
  for (var slot = 0u; slot < 2u; slot++) {
    let index = select(a, b, slot == 1u);
    let available = select(free_a, free_b, slot == 1u);
    if (!available) { continue; }
    let parent_slot = select(0u, 1u, count > 1u && slot == 1u && free_a);
    let term = product_term_for_parent_slot(rx, parent_slot);
    if (term.status != 1.0 || !(term.material_id > 0.0)) { continue; }
    var mass = pair_selected_product_mass(a, rx, term.term_index);
    if (count == 1u) {
      mass = select(mass, select(consumed_a, consumed_b, slot == 1u), free_a && free_b);
    }
    let state = energy_product_state(rx, term.term_index, temperature);
    let volume = consumed_volume * mass / max(total, 1.0e-20);
    if (state.z != 1.0 || !write_product_particle(index, term.material_id, mass, volume,
        state.x, velocity, represented_entity_count_from_mass(mass, term.molar_mass), state.w)) {
      reject_allocated_pair(a, b, 1u); return;
    }
    direct_terms[slot] = term.term_index; direct_masses[slot] = mass;
  }
  if (!pair_endpoint_ready(a) || !pair_endpoint_ready(b)) {
    reject_allocated_pair(a, b, 2u); return;
  }
  let midpoint = (state_pos_mass(a).xyz * consumed_a + state_pos_mass(b).xyz * consumed_b) / total;
  for (var local = 0u; local < count; local++) {
    let term_index = offset + local;
    let term0 = product_term_row0(term_index);
    let term1 = product_term_row1(term_index);
    let mass = pair_selected_product_mass(a, rx, term_index);
    let direct = min(mass, select(0.0, direct_masses[0], direct_terms[0] == term_index)
      + select(0.0, direct_masses[1], direct_terms[1] == term_index));
    let residual = max(mass - direct, 0.0);
    let state = energy_product_state(rx, term_index, temperature);
    let mechanics = find_product_mechanics(term0.y, state.w, temperature);
    let support = (consumed_volume * mass / max(total, 1.0e-20)) * residual / max(mass, 1.0e-20);
    let moles = mass / term0.w;
    if (!(mass > 0.0) || !energy_finite(mass) || !energy_finite(moles)
      || !all(abs(midpoint) <= vec3<f32>(3.402823e38))
      || state.z != 1.0 || !(state.y > 0.0) || !(state.w > 0.0)
      || !energy_finite(state.x) || !energy_finite(temperature) || !(temperature > 0.0)
      || mechanics.status != 1.0 || !(mechanics.sound_speed >= 0.0)
      || !all(abs(vec4<f32>(mechanics.bulk, mechanics.shear, mechanics.lambda, mechanics.sound_speed)) <= vec4<f32>(3.402823e38))
      || !energy_finite(support) || (residual > 0.0 && !(support > 0.0))) {
      reject_allocated_pair(a, b, 3u); return;
    }
    let out = pair_event_base(a, term_index);
    pair_allocations[out] = vec4<f32>(midpoint, mass);
    pair_allocations[out + 1u] = vec4<f32>(term0.y, f32(term_index), f32(rx), f32(a));
    pair_allocations[out + 2u] = vec4<f32>(f32(b), moles, term1.y, state.w);
    pair_allocations[out + 3u] = vec4<f32>(direct, residual, term0.z, term0.w);
    pair_allocations[out + 4u] = vec4<f32>(temperature, state.y, 1.0, state.x);
    pair_allocations[out + 5u] = vec4<f32>(velocity, support);
    pair_allocations[out + 6u] = vec4<f32>(mechanics.bulk, mechanics.shear, mechanics.lambda, mechanics.sound_speed);
    pair_allocations[out + 7u] = vec4<f32>(mechanics.eos_model, mechanics.solid, mechanics.status, 1.0);
  }
  pair_allocations[base + 2u] = vec4<f32>(allocation.xyz, temperature);
  pair_allocations[base + 3u] = vec4<f32>(velocity, 0.0);
  // Completion follows both stored endpoints and all actual term payloads.
  pair_allocations[base] = vec4<f32>(1.0, f32(b), f32(rx), 3.0);
}
`;

export const sphReactionPairReaderWgsl = `
@group(0) @binding(9) var<storage, read> pair_allocations: array<vec4<f32>>;
${sphReactionPairAddressWgsl}
// [mass, moles, direct placed mass, unplaced mass]. Filter on the actual term
// payload, preserving distinct terms even when their material IDs are equal.
fn pair_product_totals(a: u32, rx: u32, material: f32, gas_only: bool) -> vec4<f32> {
  var result = vec4<f32>(0.0);
  for (var term = 0u; term < params.product_term_count; term++) {
    let base = pair_event_base(a, term);
    let identity = pair_allocations[base + 1u];
    let chemistry = pair_allocations[base + 2u];
    if (pair_allocations[base + 4u].z != 1.0 || identity.z != f32(rx)
      || (material > 0.0 && identity.x != material) || (gas_only && chemistry.z != 1.0)) { continue; }
    let shares = pair_allocations[base + 3u];
    result += vec4<f32>(pair_allocations[base].w, chemistry.y, shares.x, shares.y);
  }
  return result;
}
`;
