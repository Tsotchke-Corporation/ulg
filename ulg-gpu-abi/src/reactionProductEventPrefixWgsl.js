// GPU-authored exact-live product-event prefix. The pre-resolve upper bound
// is deliberately conservative: if its bounded output arena cannot hold every
// possible product term, reaction mutation is rejected before resolve. The
// resolve publishes one compact admitted outcome per canonical mutual pair.
// The post-resolve pass counts only positive unplaced rows from that outcome,
// scans by source particle, and emits the stable exact prefix without rerunning
// reactant lookup, transport-limited extent, or product mass normalization.
export const sphReactionProductEventPrefixWgsl = /* wgsl */ `
struct ProductEventPrefixParams {
  particle_count: u32,
  reaction_count: u32,
  product_phase_count: u32,
  reactant_term_count: u32,
  product_term_count: u32,
  gas_product_count: u32,
  partial_count: u32,
  has_proposals: u32,
  atom_term_count: u32,
  dt_s: f32,
  _pad2: u32,
  _pad3: u32,
  event_capacity_rows: u32,
  generation_id: u32,
  min_live_mass_kg: f32,
  particle_dispatch_x: u32,
  max_dispatch_x: u32,
  _pad4: u32,
  _pad5: u32,
  _pad6: u32,
};

struct ProductMechanics {
  rest_density: f32,
  effective_bulk: f32,
  shear: f32,
  lambda: f32,
  sound_speed: f32,
  eos_model_id: f32,
  solid_flag: f32,
  status: f32,
};

struct AdmittedReactionOutcome {
  partner_index: u32,
  reaction_index: u32,
  product_term_offset: u32,
  product_term_count: u32,
  extent_mol: f32,
  product_mass_scale: f32,
  source_consumed_mass_kg: f32,
  partner_consumed_mass_kg: f32,
  valid: u32,
};

struct ProductEventEvaluation {
  row0: vec4<f32>,
  row1: vec4<f32>,
  row2: vec4<f32>,
  row3: vec4<f32>,
  row4: vec4<f32>,
  row5: vec4<f32>,
  row6: vec4<f32>,
  row7: vec4<f32>,
  live: u32,
};

@group(0) @binding(0) var<storage, read> source_state: array<vec4<f32>>;
@group(0) @binding(1) var<storage, read> source_thermo: array<vec4<f32>>;
@group(0) @binding(2) var<storage, read> next_state: array<vec4<f32>>;
@group(0) @binding(3) var<storage, read> next_thermo: array<vec4<f32>>;
@group(0) @binding(4) var<storage, read> reaction_records: array<vec4<f32>>;
@group(0) @binding(6) var<storage, read_write> product_events: array<vec4<f32>>;
@group(0) @binding(7) var<uniform> params: ProductEventPrefixParams;
@group(0) @binding(8) var<storage, read_write> event_counts: array<u32>;
@group(0) @binding(9) var<storage, read> event_offsets: array<u32>;
@group(0) @binding(10) var<storage, read_write> prefix_metadata: array<atomic<u32>>;
@group(0) @binding(11) var<storage, read_write> dispatch_indirect: array<u32>;
@group(0) @binding(12) var<storage, read> reaction_outcomes: array<vec4<u32>>;

const PRODUCT_EVENT_PREFIX_MAGIC: u32 = 0x554c4752u;
const PRODUCT_EVENT_PREFIX_VERSION: u32 = 0u;
const PRODUCT_EVENT_PREFIX_OVERFLOW_CAPACITY: u32 = 1u;
const PRODUCT_EVENT_PREFIX_OVERFLOW_EXACT_COUNT: u32 = 2u;
const PRODUCT_EVENT_PREFIX_OVERFLOW_EMISSION: u32 = 4u;
const PRODUCT_EVENT_WORKGROUP_SIZE: u32 = 64u;
const REACTION_ADMITTED_OUTCOME_READY_MAGIC: u32 = 0x4f555443u;

fn reaction_header_row0(reaction_index: u32) -> vec4<f32> {
  let base = (params.reaction_count + params.product_phase_count) * 3u;
  return reaction_records[base + reaction_index * 4u];
}

fn reaction_header_row1(reaction_index: u32) -> vec4<f32> {
  let base = (params.reaction_count + params.product_phase_count) * 3u;
  return reaction_records[base + reaction_index * 4u + 1u];
}

fn product_term_row0(term_index: u32) -> vec4<f32> {
  let header_base = (params.reaction_count + params.product_phase_count) * 3u;
  let reactant_base = header_base + params.reaction_count * 4u;
  let product_base = reactant_base + params.reactant_term_count * 3u;
  return reaction_records[product_base + term_index * 4u];
}

fn product_term_row1(term_index: u32) -> vec4<f32> {
  let header_base = (params.reaction_count + params.product_phase_count) * 3u;
  let product_base = header_base + params.reaction_count * 4u
    + params.reactant_term_count * 3u;
  return reaction_records[product_base + term_index * 4u + 1u];
}

fn product_phase_row0(phase_index: u32) -> vec4<f32> {
  let phase_base = params.reaction_count * 3u;
  return reaction_records[phase_base + phase_index * 3u];
}

fn product_phase_row1(phase_index: u32) -> vec4<f32> {
  let phase_base = params.reaction_count * 3u;
  return reaction_records[phase_base + phase_index * 3u + 1u];
}

fn product_phase_row2(phase_index: u32) -> vec4<f32> {
  let phase_base = params.reaction_count * 3u;
  return reaction_records[phase_base + phase_index * 3u + 2u];
}

fn reaction_row1(reaction_index: u32) -> vec4<f32> {
  return reaction_records[reaction_index * 3u + 1u];
}

fn product_mechanics_for(material_id: f32, phase_id: f32) -> ProductMechanics {
  for (var phase_index = 0u; phase_index < params.product_phase_count; phase_index = phase_index + 1u) {
    let row0 = product_phase_row0(phase_index);
    let row1 = product_phase_row1(phase_index);
    let row2 = product_phase_row2(phase_index);
    if (row0.x == material_id && row0.y == phase_id && row2.y == 1.0) {
      return ProductMechanics(
        row0.z, row0.w, row1.x, row1.y, row1.z, row1.w, row2.x, row2.y
      );
    }
  }
  return ProductMechanics(0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0);
}

fn empty_product_event() -> ProductEventEvaluation {
  let zero = vec4<f32>(0.0);
  return ProductEventEvaluation(zero, zero, zero, zero, zero, zero, zero, zero, 0u);
}

fn invalid_reaction_outcome() -> AdmittedReactionOutcome {
  return AdmittedReactionOutcome(0xffffffffu, 0u, 0u, 0u, 0.0, 0.0, 0.0, 0.0, 0u);
}

fn admitted_reaction_outcome(particle_index: u32) -> AdmittedReactionOutcome {
  let base = particle_index * 2u;
  if (particle_index >= params.particle_count || arrayLength(&reaction_outcomes) < base + 2u) {
    return invalid_reaction_outcome();
  }
  let identity = reaction_outcomes[base];
  let kinetics = reaction_outcomes[base + 1u];
  let extent_mol = bitcast<f32>(kinetics.x);
  let product_mass_scale = bitcast<f32>(kinetics.y);
  let source_consumed_mass_kg = bitcast<f32>(kinetics.z);
  let partner_consumed_mass_kg = bitcast<f32>(kinetics.w);
  let term_range_valid = identity.z < params.product_term_count
    && identity.w > 0u
    && identity.w <= params.product_term_count - identity.z;
  let valid = identity.x < params.particle_count
    && particle_index < identity.x
    && identity.y < params.reaction_count
    && term_range_valid
    && extent_mol > 0.0
    && product_mass_scale > 0.0
    && source_consumed_mass_kg >= 0.0
    && partner_consumed_mass_kg >= 0.0
    && source_consumed_mass_kg + partner_consumed_mass_kg > 0.0;
  return AdmittedReactionOutcome(
    identity.x,
    identity.y,
    identity.z,
    identity.w,
    extent_mol,
    product_mass_scale,
    source_consumed_mass_kg,
    partner_consumed_mass_kg,
    select(0u, 1u, valid)
  );
}

fn product_event_mass(
  particle_index: u32,
  outcome: AdmittedReactionOutcome,
  product_term_index: u32
) -> vec4<f32> {
  if (outcome.valid == 0u || product_term_index >= params.product_term_count) {
    return vec4<f32>(0.0);
  }
  let term0 = product_term_row0(product_term_index);
  let term1 = product_term_row1(product_term_index);
  if (u32(max(term0.x, 0.0)) != outcome.reaction_index || term1.w != 1.0
    || term0.z <= 0.0 || term0.w <= 0.0) {
    return vec4<f32>(0.0);
  }
  let row_mass = outcome.extent_mol * term0.z * term0.w * outcome.product_mass_scale;
  let next0 = next_thermo[particle_index * 3u];
  let next1 = next_thermo[outcome.partner_index * 3u];
  var visible_mass_kg = 0.0;
  if (next0.x == term0.y) {
    visible_mass_kg = visible_mass_kg + next_state[particle_index * 2u].w;
  }
  if (next1.x == term0.y) {
    visible_mass_kg = visible_mass_kg + next_state[outcome.partner_index * 2u].w;
  }
  let unplaced_mass = max(row_mass - visible_mass_kg, 0.0);
  return vec4<f32>(
    row_mass,
    visible_mass_kg,
    unplaced_mass,
    select(0.0, 1.0, unplaced_mass > params.min_live_mass_kg)
  );
}

fn evaluate_product_event(
  particle_index: u32,
  outcome: AdmittedReactionOutcome,
  product_term_index: u32
) -> ProductEventEvaluation {
  if (outcome.valid == 0u || product_term_index >= params.product_term_count) {
    return empty_product_event();
  }
  let partner_index = outcome.partner_index;
  let reaction_index = outcome.reaction_index;
  let term0 = product_term_row0(product_term_index);
  let term1 = product_term_row1(product_term_index);
  let material_id = term0.y;
  let coefficient = term0.z;
  let molar_mass = term0.w;
  if (u32(max(term0.x, 0.0)) != reaction_index || term1.w != 1.0
    || molar_mass <= 0.0 || coefficient <= 0.0) {
    return empty_product_event();
  }
  let source_pos_mass = source_state[particle_index * 2u];
  let partner_source_pos_mass = source_state[partner_index * 2u];
  let source_row0 = source_thermo[particle_index * 3u];
  let partner_source_row0 = source_thermo[partner_index * 3u];
  let source_consumed = outcome.source_consumed_mass_kg;
  let partner_consumed = outcome.partner_consumed_mass_kg;
  let consumed_mass = source_consumed + partner_consumed;
  let mass = product_event_mass(particle_index, outcome, product_term_index);
  if (mass.w == 0.0 || consumed_mass <= 0.0) {
    return empty_product_event();
  }
  let row_mass = mass.x;
  let row_moles = row_mass / molar_mass;
  let next0 = next_thermo[particle_index * 3u];
  let next1 = next_thermo[partner_index * 3u];
  var visible_mass_kg = 0.0;
  var phase_id = term1.z;
  var temperature_k = 0.5 * (source_row0.z + partner_source_row0.z);
  var rest_density = 0.0;
  if (next0.x == material_id) {
    visible_mass_kg = visible_mass_kg + next_state[particle_index * 2u].w;
    phase_id = select(phase_id, next0.y, phase_id <= 0.0);
    temperature_k = next0.z;
    rest_density = next0.w;
  }
  if (next1.x == material_id) {
    visible_mass_kg = visible_mass_kg + next_state[partner_index * 2u].w;
    phase_id = select(phase_id, next1.y, phase_id <= 0.0);
    temperature_k = next1.z;
    rest_density = next1.w;
  }
  let unplaced_mass = mass.z;
  let mechanics = product_mechanics_for(material_id, phase_id);
  rest_density = select(
    rest_density,
    mechanics.rest_density,
    rest_density <= 0.0 && mechanics.rest_density > 0.0
  );
  let source_velocity = source_state[particle_index * 2u + 1u].xyz;
  let partner_velocity = source_state[partner_index * 2u + 1u].xyz;
  let product_velocity = (
    source_velocity * source_consumed + partner_velocity * partner_consumed
  ) / max(consumed_mass, 1.0e-20);
  let source_u = source_state[particle_index * 2u + 1u].w;
  let partner_u = source_state[partner_index * 2u + 1u].w;
  let rx1 = reaction_row1(reaction_index);
  let product_u = (
    source_consumed * source_u + partner_consumed * partner_u - rx1.x * consumed_mass
  ) / max(consumed_mass, 1.0e-20);
  let support_volume = select(
    0.0,
    unplaced_mass / max(rest_density, 1.0e-20),
    unplaced_mass > 0.0 && rest_density > 0.0
  );
  let midpoint = 0.5 * (source_pos_mass.xyz + partner_source_pos_mass.xyz);
  return ProductEventEvaluation(
    vec4<f32>(midpoint, row_mass),
    vec4<f32>(material_id, f32(product_term_index), f32(reaction_index), f32(particle_index)),
    vec4<f32>(f32(partner_index), row_moles, term1.y, phase_id),
    vec4<f32>(visible_mass_kg, unplaced_mass, coefficient, molar_mass),
    vec4<f32>(temperature_k, rest_density, 1.0, product_u),
    vec4<f32>(product_velocity, support_volume),
    vec4<f32>(
      mechanics.effective_bulk, mechanics.shear, mechanics.lambda, mechanics.sound_speed
    ),
    vec4<f32>(mechanics.eos_model_id, mechanics.solid_flag, mechanics.status, 0.0),
    1u
  );
}

fn scanned_event_total() -> u32 {
  if (params.particle_count == 0u) { return 0u; }
  let last = params.particle_count - 1u;
  return event_offsets[last] + event_counts[last];
}

fn particle_invocation_index(local_id: vec3<u32>, workgroup_id: vec3<u32>) -> u32 {
  let linear_group = workgroup_id.x + workgroup_id.y * params.particle_dispatch_x;
  return linear_group * PRODUCT_EVENT_WORKGROUP_SIZE + local_id.x;
}

fn prefix_identity_valid() -> bool {
  return arrayLength(&prefix_metadata) >= 20u
    && atomicLoad(&prefix_metadata[0]) == PRODUCT_EVENT_PREFIX_MAGIC
    && atomicLoad(&prefix_metadata[1]) == PRODUCT_EVENT_PREFIX_VERSION
    && atomicLoad(&prefix_metadata[2]) == params.generation_id
    && atomicLoad(&prefix_metadata[3]) == params.particle_count
    && atomicLoad(&prefix_metadata[4]) == params.event_capacity_rows
    && atomicLoad(&prefix_metadata[11]) == 32u
    && atomicLoad(&prefix_metadata[18]) == params.generation_id
    && atomicLoad(&prefix_metadata[19]) == REACTION_ADMITTED_OUTCOME_READY_MAGIC;
}

@compute @workgroup_size(1)
fn finalize_product_event_admission() {
  // The allocation bound is already exact for the worst legal proposal set:
  // mutual proposals are disjoint pairs, so at most floor(N/2) pairs can each
  // emit the maximum product-term count of one reaction. The host rejects a
  // smaller allocation before encoding; this GPU pass publishes that admitted
  // bound for resolve without redundantly scanning every proposal first.
  let potential_count = params.event_capacity_rows;
  let overflow = 0u;
  atomicStore(&prefix_metadata[0], PRODUCT_EVENT_PREFIX_MAGIC);
  atomicStore(&prefix_metadata[1], PRODUCT_EVENT_PREFIX_VERSION);
  atomicStore(&prefix_metadata[2], params.generation_id);
  atomicStore(&prefix_metadata[3], params.particle_count);
  atomicStore(&prefix_metadata[4], params.event_capacity_rows);
  atomicStore(&prefix_metadata[5], potential_count);
  atomicStore(&prefix_metadata[6], 0u);
  atomicStore(&prefix_metadata[7], overflow);
  atomicStore(&prefix_metadata[8], select(1u, 0u, overflow != 0u));
  atomicStore(&prefix_metadata[9], 0u);
  atomicStore(&prefix_metadata[10], 0u);
  atomicStore(&prefix_metadata[11], 32u);
  atomicStore(&prefix_metadata[12], 0u);
  atomicStore(&prefix_metadata[13], 1u);
  atomicStore(&prefix_metadata[14], 1u);
  atomicStore(&prefix_metadata[15], params.product_term_count);
  atomicStore(&prefix_metadata[16], params.particle_count);
  atomicStore(&prefix_metadata[17], select(1u, 3u, overflow != 0u));
  atomicStore(&prefix_metadata[18], 0u);
  atomicStore(&prefix_metadata[19], 0u);
  dispatch_indirect[0] = 0u;
  dispatch_indirect[1] = 1u;
  dispatch_indirect[2] = 1u;
}

@compute @workgroup_size(64)
fn count_live_product_events(
  @builtin(local_invocation_id) local_id: vec3<u32>,
  @builtin(workgroup_id) workgroup_id: vec3<u32>
) {
  let particle = particle_invocation_index(local_id, workgroup_id);
  if (particle >= params.particle_count) { return; }
  if (!prefix_identity_valid() || atomicLoad(&prefix_metadata[8]) != 1u) {
    event_counts[particle] = 0u;
    return;
  }
  let outcome = admitted_reaction_outcome(particle);
  if (outcome.valid == 0u) {
    event_counts[particle] = 0u;
    return;
  }
  var live_count = 0u;
  for (var local = 0u; local < outcome.product_term_count; local = local + 1u) {
    let mass = product_event_mass(particle, outcome, outcome.product_term_offset + local);
    live_count = live_count + select(0u, 1u, mass.w == 1.0);
  }
  event_counts[particle] = live_count;
}

@compute @workgroup_size(1)
fn finalize_live_product_event_prefix() {
  if (!prefix_identity_valid() || atomicLoad(&prefix_metadata[8]) != 1u) {
    dispatch_indirect[0] = 0u;
    return;
  }
  let exact_count = scanned_event_total();
  let potential_count = atomicLoad(&prefix_metadata[5]);
  if (exact_count > potential_count || exact_count > params.event_capacity_rows) {
    atomicOr(&prefix_metadata[7], PRODUCT_EVENT_PREFIX_OVERFLOW_EXACT_COUNT);
    atomicStore(&prefix_metadata[8], 0u);
    atomicStore(&prefix_metadata[9], 0u);
    atomicStore(&prefix_metadata[17], 3u);
    dispatch_indirect[0] = 0u;
    return;
  }
  let workgroups = (exact_count + PRODUCT_EVENT_WORKGROUP_SIZE - 1u)
    / PRODUCT_EVENT_WORKGROUP_SIZE;
  var dispatch_x = 0u;
  var dispatch_y = 1u;
  if (workgroups > 0u) {
    dispatch_x = min(workgroups, max(params.max_dispatch_x, 1u));
    dispatch_y = (workgroups + dispatch_x - 1u) / dispatch_x;
  }
  atomicStore(&prefix_metadata[6], exact_count);
  atomicStore(&prefix_metadata[9], 1u);
  atomicStore(&prefix_metadata[10], 0u);
  atomicStore(&prefix_metadata[12], dispatch_x);
  atomicStore(&prefix_metadata[13], dispatch_y);
  atomicStore(&prefix_metadata[14], 1u);
  atomicStore(&prefix_metadata[17], 2u);
  dispatch_indirect[0] = dispatch_x;
  dispatch_indirect[1] = dispatch_y;
  dispatch_indirect[2] = 1u;
}

fn source_particle_for_event(event_index: u32) -> u32 {
  var low = 0u;
  var high = params.particle_count;
  while (low < high) {
    let middle = low + (high - low) / 2u;
    let end = event_offsets[middle] + event_counts[middle];
    if (event_index < end) {
      high = middle;
    } else {
      low = middle + 1u;
    }
  }
  return low;
}

@compute @workgroup_size(64)
fn emit_live_product_events(
  @builtin(local_invocation_id) local_id: vec3<u32>,
  @builtin(workgroup_id) workgroup_id: vec3<u32>
) {
  let linear_group = workgroup_id.x
    + workgroup_id.y * atomicLoad(&prefix_metadata[12]);
  let event_index = linear_group * PRODUCT_EVENT_WORKGROUP_SIZE + local_id.x;
  if (!prefix_identity_valid() || atomicLoad(&prefix_metadata[8]) != 1u
    || atomicLoad(&prefix_metadata[9]) != 1u
    || atomicLoad(&prefix_metadata[7]) != 0u
    || event_index >= atomicLoad(&prefix_metadata[6])) {
    return;
  }
  let particle = source_particle_for_event(event_index);
  if (particle >= params.particle_count) {
    atomicOr(&prefix_metadata[7], PRODUCT_EVENT_PREFIX_OVERFLOW_EMISSION);
    return;
  }
  let outcome = admitted_reaction_outcome(particle);
  if (outcome.valid == 0u) {
    atomicOr(&prefix_metadata[7], PRODUCT_EVENT_PREFIX_OVERFLOW_EMISSION);
    return;
  }
  var local_rank = event_index - event_offsets[particle];
  for (var local = 0u; local < outcome.product_term_count; local = local + 1u) {
    let term_index = outcome.product_term_offset + local;
    let mass = product_event_mass(particle, outcome, term_index);
    if (mass.w == 0.0) { continue; }
    if (local_rank > 0u) {
      local_rank = local_rank - 1u;
      continue;
    }
    let event = evaluate_product_event(particle, outcome, term_index);
    if (event.live == 0u) {
      atomicOr(&prefix_metadata[7], PRODUCT_EVENT_PREFIX_OVERFLOW_EMISSION);
      return;
    }
    let out = event_index * 8u;
    product_events[out] = event.row0;
    product_events[out + 1u] = event.row1;
    product_events[out + 2u] = event.row2;
    product_events[out + 3u] = event.row3;
    product_events[out + 4u] = event.row4;
    product_events[out + 5u] = event.row5;
    product_events[out + 6u] = event.row6;
    product_events[out + 7u] = event.row7;
    atomicAdd(&prefix_metadata[10], 1u);
    return;
  }
  atomicOr(&prefix_metadata[7], PRODUCT_EVENT_PREFIX_OVERFLOW_EMISSION);
}

@compute @workgroup_size(1)
fn finalize_product_event_emission() {
  if (!prefix_identity_valid() || atomicLoad(&prefix_metadata[8]) != 1u) {
    dispatch_indirect[0] = 0u;
    return;
  }
  if (atomicLoad(&prefix_metadata[7]) != 0u
    || atomicLoad(&prefix_metadata[10]) != atomicLoad(&prefix_metadata[6])) {
    atomicOr(&prefix_metadata[7], PRODUCT_EVENT_PREFIX_OVERFLOW_EMISSION);
    atomicStore(&prefix_metadata[9], 0u);
    atomicStore(&prefix_metadata[17], 3u);
    dispatch_indirect[0] = 0u;
    return;
  }
  atomicStore(&prefix_metadata[17], 4u);
}
`;
