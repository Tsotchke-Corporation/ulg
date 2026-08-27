import {
  SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX,
  SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_MAGIC,
  SPH_REACTION_PRODUCT_PLACEMENT_OVERFLOW_FLAGS,
  SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_STATUS,
  SPH_REACTION_PRODUCT_PLACEMENT_TRANSACTION_STATUS,
  SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_VERSION,
  SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_WORDS
} from './sphReactionProductPlacementReceipt.js';

export const SPH_REACTION_PRODUCT_PLACEMENT_CAPTURE_VALUE_ROWS = 6;
export const SPH_REACTION_PRODUCT_PLACEMENT_DIRECT_VALUE_ROWS = 3;
export const SPH_REACTION_PRODUCT_PLACEMENT_EVENT_PLAN_ROWS = 2;
export const SPH_REACTION_PRODUCT_PLACEMENT_SUMMARY_VALUE_ROWS = 9;
export const SPH_REACTION_PRODUCT_PLACEMENT_LAW = Object.freeze({
  schema: 'peercompute.ulg.sph-reaction-product-placement-law.v5',
  mutationOrder:
    'stable-event-plan-then-conserving-capture-segment-reduction-then-disjoint-direct-pair-hyperedges',
  captureReductionOrder:
    'stable-radix-equal-key-order-hillis-steele-fixed-binary-topology',
  captureEnergyLaw:
    'mass-momentum-total-energy-reduction-with-relative-kinetic-energy-thermalization',
  directPairSelection:
    'stable-last-admitted-product-event-per-disjoint-reacting-pair',
  deliberateChangeFromV4:
    'event support volume remains routing geometry while newly materialized product mass is born at target reference density with J=1'
});

const PARAMS = /* wgsl */ `
struct ProductPlacementParams {
  particle_count: u32,
  event_row_count: u32,
  event_stride_vec4: u32,
  state_stride_vec4: u32,
  thermo_stride_vec4: u32,
  mechanics_stride_vec4: u32,
  min_placed_mass_kg: f32,
  product_term_count: u32,
  box_x_m: f32,
  box_y_m: f32,
  box_z_m: f32,
  box_clamp_enabled: u32,
  canonical_spatial_enabled: u32,
  generation_id: u32,
  support_profile_id: u32,
  receipt_version: u32,
};

const PHASE_COMPANION_RESERVED_STATUS: f32 = 254.0;
const INVALID_KEY: u32 = 0xffffffffu;
const REACTION_AVOGADRO_PER_MOL: f32 = 6.02214076e23;

fn phase_is_gas(phase_id: f32) -> bool {
  return phase_id >= 2.5 && phase_id < 3.5;
}

fn finite_scalar(value: f32) -> bool {
  return value == value && abs(value) < 3.0e38;
}

fn finite_vec3(value: vec3<f32>) -> bool {
  return all(value == value) && all(abs(value) < vec3<f32>(3.0e38));
}

fn finite_vec4(value: vec4<f32>) -> bool {
  return all(value == value) && all(abs(value) <= vec4<f32>(3.0e38));
}

fn represented_entity_count_for_product_mass(
  mass_kg: f32,
  molar_mass_kg_per_mol: f32
) -> f32 {
  if (
    !finite_scalar(mass_kg)
    || !finite_scalar(molar_mass_kg_per_mol)
    || !(mass_kg > 0.0)
    || !(molar_mass_kg_per_mol > 0.0)
  ) {
    return 0.0;
  }
  return mass_kg / molar_mass_kg_per_mol * REACTION_AVOGADRO_PER_MOL;
}

fn product_event_moles_match_mass(
  product_mass_kg: f32,
  product_moles: f32,
  molar_mass_kg_per_mol: f32
) -> bool {
  if (
    !finite_scalar(product_mass_kg)
    || !finite_scalar(product_moles)
    || !finite_scalar(molar_mass_kg_per_mol)
    || !(product_mass_kg > 0.0)
    || !(product_moles > 0.0)
    || !(molar_mass_kg_per_mol > 0.0)
  ) {
    return false;
  }
  let derived_moles = product_mass_kg / molar_mass_kg_per_mol;
  if (!finite_scalar(derived_moles) || !(derived_moles > 0.0)) {
    return false;
  }
  let tolerance = max(
    1.0e-20,
    1.0e-5 * max(abs(product_moles), abs(derived_moles))
  );
  return abs(product_moles - derived_moles) <= tolerance;
}

fn support_fits_box(radius_m: f32) -> bool {
  if (params.box_clamp_enabled == 0u) { return true; }
  let dimensions = vec3<f32>(params.box_x_m, params.box_y_m, params.box_z_m);
  return radius_m <= 0.5 * min(dimensions.x, min(dimensions.y, dimensions.z));
}

fn clamp_to_box(position: vec3<f32>, radius_m: f32) -> vec3<f32> {
  if (params.box_clamp_enabled == 0u) { return position; }
  let dimensions = vec3<f32>(params.box_x_m, params.box_y_m, params.box_z_m);
  let maximum_margin = 0.5 * min(dimensions.x, min(dimensions.y, dimensions.z));
  let margin = clamp(radius_m, 0.0, maximum_margin);
  return clamp(position, vec3<f32>(margin), dimensions - vec3<f32>(margin));
}
`;

export const sphReactionProductPlacementPreflightWgsl = /* wgsl */ `
${PARAMS}
@group(0) @binding(0) var<storage, read> compact_counts: array<u32>;
@group(0) @binding(1) var<storage, read_write> placement_control: array<vec4<f32>>;
@group(0) @binding(2) var<uniform> params: ProductPlacementParams;
@group(0) @binding(3) var<storage, read_write> receipt: array<atomic<u32>>;

@compute @workgroup_size(64)
fn preflight_segmented_placement(@builtin(local_invocation_id) local_id: vec3<u32>) {
  if (local_id.x != 0u || arrayLength(&receipt) < ${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_WORDS}u) {
    return;
  }
  atomicStore(&receipt[0], ${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_MAGIC}u);
  atomicStore(&receipt[1], ${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_VERSION}u);
  atomicStore(&receipt[2], params.generation_id);
  atomicStore(&receipt[3], params.support_profile_id);
  atomicStore(&receipt[4], params.event_row_count);
  atomicStore(&receipt[${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX.status}], ${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_STATUS.PENDING}u);
  atomicStore(&receipt[${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX.transactionalTerminalStatus}], ${SPH_REACTION_PRODUCT_PLACEMENT_TRANSACTION_STATUS.PENDING}u);
  atomicStore(&receipt[${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX.applyPreflightPassCount}], 1u);
  atomicStore(&receipt[${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX.serialConflictFoldPassCount}], 0u);
  atomicStore(&receipt[${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX.serialConflictFoldEventCount}], 0u);
  atomicStore(&receipt[${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX.maxSerialConflictFoldSize}], 0u);
  atomicStore(&receipt[${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX.globalSerialEventFoldCount}], 0u);
  if (arrayLength(&placement_control) < 2u) {
    atomicStore(&receipt[${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX.status}], ${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_STATUS.CONTRACT_REJECTED}u);
    return;
  }
  placement_control[1] = vec4<f32>(0.0);
  let active_count = min(compact_counts[0], params.event_row_count);
  let contract_ready = params.canonical_spatial_enabled != 0u
    && params.receipt_version == ${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_VERSION}u
    && params.event_stride_vec4 >= 8u
    && atomicLoad(&receipt[${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX.compactCountPassCount}]) == 1u
    && atomicLoad(&receipt[${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX.compactScanPassCount}]) == 1u
    && atomicLoad(&receipt[${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX.compactScatterPassCount}]) == 1u
    && atomicLoad(&receipt[${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX.activeEventCount}]) == active_count
    && atomicLoad(&receipt[${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX.compactionOverflowCount}]) == 0u
    && atomicLoad(&receipt[${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX.envelopePartialPassCount}]) == 1u
    && atomicLoad(&receipt[${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX.envelopeFinalizePassCount}]) == 1u
    && atomicLoad(&receipt[${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX.envelopeInputVisitCount}]) == params.particle_count
    && atomicLoad(&receipt[${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX.envelopeAdmitted}]) == 1u
    && atomicLoad(&receipt[${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX.classifierPassCount}]) == 1u
    && atomicLoad(&receipt[${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX.spareFlagPassCount}]) == 2u
    && atomicLoad(&receipt[${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX.spareScanPassCount}]) == 2u
    && atomicLoad(&receipt[${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX.spareAssignPassCount}]) == 2u
    && atomicLoad(&receipt[${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX.overflowFlags}]) == 0u;
  let classifier_partition = atomicLoad(&receipt[${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX.classifierReadyCount}])
    + atomicLoad(&receipt[${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX.classifierRejectedCount}])
    + atomicLoad(&receipt[${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX.classifierUnknownCount}]);
  if (!contract_ready) {
    atomicStore(&receipt[${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX.status}], ${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_STATUS.CONTRACT_REJECTED}u);
    return;
  }
  if (classifier_partition != active_count
    || atomicLoad(&receipt[${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX.classifierUnknownCount}]) != 0u) {
    atomicStore(&receipt[${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX.status}], ${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_STATUS.CANONICAL_DECISION_REJECTED}u);
    return;
  }
  placement_control[1] = vec4<f32>(1.0, f32(active_count), 0.0, 0.0);
}
`;

const EVENT_GEOMETRY = /* wgsl */ `
fn reactant_current_volume(index: u32) -> f32 {
  let volume_row = frozen_mechanics[index * params.mechanics_stride_vec4 + 4u];
  let current_volume = volume_row.z * volume_row.w;
  return select(
    0.0,
    current_volume,
    volume_row.z > 0.0 && volume_row.w > 0.0
      && finite_scalar(current_volume) && current_volume > 0.0
  );
}

fn reactant_radius(index: u32) -> f32 {
  let current_volume = reactant_current_volume(index);
  if (!(current_volume > 0.0)) { return 0.0; }
  return pow(max(current_volume * 0.238732414637843, 1.0e-30), 1.0 / 3.0);
}

fn gas_target(
  source_index: u32,
  partner_index: u32,
  fallback_position: vec3<f32>,
  product_radius: f32
) -> vec4<f32> {
  if (source_index >= params.particle_count || partner_index >= params.particle_count
    || source_index == partner_index) {
    return vec4<f32>(fallback_position, 0.0);
  }
  let source_state0 = frozen_state[source_index * params.state_stride_vec4];
  let partner_state0 = frozen_state[partner_index * params.state_stride_vec4];
  let source_current_volume = reactant_current_volume(source_index);
  let partner_current_volume = reactant_current_volume(partner_index);
  let source_radius = reactant_radius(source_index);
  let partner_radius = reactant_radius(partner_index);
  if (!(source_radius > 0.0) || !(partner_radius > 0.0) || !support_fits_box(product_radius)) {
    return vec4<f32>(fallback_position, 0.0);
  }
  var host_is_source = source_index < partner_index;
  let source_current_density = source_state0.w / source_current_volume;
  let partner_current_density = partner_state0.w / partner_current_volume;
  if (abs(source_current_density - partner_current_density) > 1.0e-6) {
    host_is_source = source_current_density > partner_current_density;
  }
  let host_position = select(partner_state0.xyz, source_state0.xyz, host_is_source);
  let free_position = select(source_state0.xyz, partner_state0.xyz, host_is_source);
  let free_radius = select(source_radius, partner_radius, host_is_source);
  let route = free_position - host_position;
  let route2 = dot(route, route);
  if (!(route2 > 1.0e-20)) { return vec4<f32>(fallback_position, 0.0); }
  let normal = route / sqrt(route2);
  let clearance = free_radius + max(product_radius, 0.0);
  let target_position = clamp_to_box(free_position + normal * clearance, product_radius);
  if (dot(target_position - free_position, normal) < clearance - 1.0e-5) {
    return vec4<f32>(fallback_position, 0.0);
  }
  return vec4<f32>(target_position, 1.0);
}
`;

export const sphReactionProductPlacementPlanWgsl = /* wgsl */ `
${PARAMS}
@group(0) @binding(0) var<storage, read> product_events: array<vec4<f32>>;
@group(0) @binding(1) var<storage, read> frozen_state: array<vec4<f32>>;
@group(0) @binding(2) var<storage, read> frozen_mechanics: array<vec4<f32>>;
@group(0) @binding(4) var<storage, read> decisions: array<vec4<f32>>;
@group(0) @binding(5) var<storage, read_write> capture_keys: array<u32>;
@group(0) @binding(6) var<storage, read_write> capture_values: array<vec4<f32>>;
@group(0) @binding(7) var<storage, read_write> event_plan: array<vec4<f32>>;
@group(0) @binding(8) var<storage, read> placement_control: array<vec4<f32>>;
@group(0) @binding(9) var<uniform> params: ProductPlacementParams;

${EVENT_GEOMETRY}

fn clear_capture(event: u32) {
  capture_keys[event] = INVALID_KEY;
  for (var row = 0u; row < ${SPH_REACTION_PRODUCT_PLACEMENT_CAPTURE_VALUE_ROWS}u; row = row + 1u) {
    capture_values[event * ${SPH_REACTION_PRODUCT_PLACEMENT_CAPTURE_VALUE_ROWS}u + row] = vec4<f32>(0.0);
  }
  event_plan[event * ${SPH_REACTION_PRODUCT_PLACEMENT_EVENT_PLAN_ROWS}u] = vec4<f32>(0.0);
  event_plan[event * ${SPH_REACTION_PRODUCT_PLACEMENT_EVENT_PLAN_ROWS}u + 1u] = vec4<f32>(8.0, f32(params.particle_count), f32(params.particle_count), 0.0);
}

@compute @workgroup_size(64)
fn plan_product_events(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let event = global_id.x;
  if (event >= params.event_row_count || event >= arrayLength(&capture_keys)) { return; }
  clear_capture(event);
  if (arrayLength(&placement_control) < 2u) { return; }
  let active_count = min(
    u32(max(round(placement_control[1].y), 0.0)),
    params.event_row_count
  );
  if (event >= active_count || placement_control[1].x != 1.0) { return; }
  let base = event * params.event_stride_vec4;
  let row0 = product_events[base];
  let row1 = product_events[base + 1u];
  let row2 = product_events[base + 2u];
  let row3 = product_events[base + 3u];
  let row4 = product_events[base + 4u];
  let row5 = product_events[base + 5u];
  let row6 = product_events[base + 6u];
  let row7 = product_events[base + 7u];
  let decision = decisions[event];
  let product_term_f = round(row1.y);
  let source_f = round(row1.w);
  let partner_f = round(row2.x);
  let capture_f = round(decision.x);
  let spare_f = round(decision.w);
  let payload_finite = finite_vec4(row0)
    && finite_vec4(row1)
    && finite_vec4(row2)
    && finite_vec4(row3)
    && finite_vec4(row4)
    && finite_vec4(row5)
    && finite_vec4(row6)
    && finite_vec4(row7)
    && finite_vec4(decision);
  let valid_term = product_term_f >= 0.0 && product_term_f < f32(params.product_term_count)
    && row1.y == product_term_f;
  let pair_valid = source_f >= 0.0 && partner_f >= 0.0
    && source_f < f32(params.particle_count) && partner_f < f32(params.particle_count)
    && row1.w == source_f && row2.x == partner_f && source_f != partner_f;
  let decision_indices_valid = capture_f >= 0.0 && spare_f >= 0.0
    && capture_f <= f32(params.particle_count)
    && spare_f <= f32(params.particle_count)
    && decision.x == capture_f && decision.w == spare_f;
  let payload_valid = payload_finite && valid_term && row4.z == 1.0 && row7.z == 1.0
    && row0.w >= 0.0 && row3.x >= 0.0 && row3.y >= 0.0
    && row2.y > 0.0 && row2.w > 0.0 && row3.w > 0.0
    && row4.y > 0.0 && row5.w >= 0.0
    && product_event_moles_match_mass(row0.w, row2.y, row3.w)
    && (row3.y <= 0.0 || row5.w > 0.0)
    && pair_valid && decision_indices_valid;
  var support_radius = 0.05;
  if (row5.w > 0.0) {
    support_radius = pow(row5.w * 0.238732414637843, 1.0 / 3.0);
  }
  var routed_position = row0.xyz;
  var route_planned = false;
  if (payload_valid && phase_is_gas(row2.w) && pair_valid) {
    let gas_route = gas_target(u32(source_f), u32(partner_f), row0.xyz, support_radius);
    if (gas_route.w > 0.0) {
      routed_position = gas_route.xyz;
      route_planned = true;
    }
  }
  let unplaced_mass = max(row3.y, 0.0);
  let represented_entity_count = represented_entity_count_for_product_mass(
    unplaced_mass,
    row3.w
  );
  let speed_squared = dot(row5.xyz, row5.xyz);
  let specific_total_energy = row4.w + 0.5 * speed_squared;
  let mass_position = routed_position * unplaced_mass;
  let mass_momentum = row5.xyz * unplaced_mass;
  let total_energy = specific_total_energy * unplaced_mass;
  let temperature_moment = row4.x * unplaced_mass;
  let rest_volume = unplaced_mass / max(row4.y, 1.0e-20);
  let derived_moments_valid = finite_scalar(speed_squared)
    && finite_scalar(specific_total_energy)
    && finite_scalar(represented_entity_count)
    && finite_vec3(mass_position)
    && finite_vec3(mass_momentum)
    && finite_scalar(total_energy)
    && finite_scalar(temperature_moment)
    && finite_scalar(rest_volume)
    && (unplaced_mass <= 0.0 || represented_entity_count > 0.0)
    && (unplaced_mass <= 0.0 || (
      rest_volume > 0.0
      && row5.w > 0.0
    ));
  let event_valid = payload_valid && derived_moments_valid;
  var disposition = 8.0;
  var merge_slot = params.particle_count;
  var spare_slot = params.particle_count;
  if (event_valid) {
    if (unplaced_mass <= 0.0) {
      disposition = 2.0;
    } else if (unplaced_mass <= params.min_placed_mass_kg) {
      disposition = 6.0;
    } else {
      if (decision.z != 1.0) {
        disposition = 7.0;
      } else if (decision.x >= 0.0 && decision.x < f32(params.particle_count)) {
        disposition = 4.0;
        merge_slot = u32(round(decision.x));
      } else if (decision.w >= 0.0 && decision.w < f32(params.particle_count)) {
        disposition = 3.0;
        spare_slot = u32(round(decision.w));
      } else {
        disposition = 7.0;
      }
    }
  }
  event_plan[event * ${SPH_REACTION_PRODUCT_PLACEMENT_EVENT_PLAN_ROWS}u] = vec4<f32>(
    routed_position,
    select(0.0, 1.0, route_planned)
  );
  event_plan[event * ${SPH_REACTION_PRODUCT_PLACEMENT_EVENT_PLAN_ROWS}u + 1u] = vec4<f32>(
    disposition,
    f32(merge_slot),
    f32(spare_slot),
    support_radius
  );
  if (disposition != 4.0) { return; }
  capture_keys[event] = merge_slot;
  let value_base = event * ${SPH_REACTION_PRODUCT_PLACEMENT_CAPTURE_VALUE_ROWS}u;
  // row0.z is the otherwise-unused exact segmented-reduction lane. It carries
  // the represented formula-unit count belonging to this event's unplaced
  // mass so every equal-key capture fold can publish it with the mass.
  capture_values[value_base] = vec4<f32>(
    1.0,
    f32(event + 1u),
    represented_entity_count,
    0.0
  );
  capture_values[value_base + 1u] = vec4<f32>(unplaced_mass, mass_position);
  // The fourth lane is total energy, not internal energy. The capture apply
  // subtracts the merged COM kinetic energy so relative motion is converted
  // to heat instead of being deleted.
  capture_values[value_base + 2u] = vec4<f32>(mass_momentum, total_energy);
  capture_values[value_base + 3u] = vec4<f32>(
    temperature_moment,
    rest_volume,
    max(decisions[event].y, 0.0),
    // A product event's support volume is spatial routing/scatter geometry,
    // not deformation authority for a newly born material carrier.  The
    // product contributes its target-reference volume to both V0 and current
    // volume, which makes the incoming material exactly J = 1.
    rest_volume
  );
  capture_values[value_base + 4u] = vec4<f32>(row0.xyz, support_radius);
  capture_values[value_base + 5u] = vec4<f32>(routed_position, select(0.0, 1.0, route_planned));
}
`;

export const sphReactionProductPlacementEventApplyWgsl = /* wgsl */ `
${PARAMS}
@group(0) @binding(0) var<storage, read_write> product_events: array<vec4<f32>>;
@group(0) @binding(1) var<storage, read_write> next_state: array<vec4<f32>>;
@group(0) @binding(2) var<storage, read_write> next_thermo: array<vec4<f32>>;
@group(0) @binding(3) var<storage, read_write> next_mechanics: array<vec4<f32>>;
@group(0) @binding(5) var<storage, read> event_plan: array<vec4<f32>>;
@group(0) @binding(6) var<storage, read_write> summary_keys: array<u32>;
@group(0) @binding(7) var<storage, read_write> summary_values: array<vec4<f32>>;
@group(0) @binding(8) var<storage, read_write> receipt: array<atomic<u32>>;
@group(0) @binding(9) var<uniform> params: ProductPlacementParams;

fn summary_row(event: u32, row: u32) -> u32 {
  return event * ${SPH_REACTION_PRODUCT_PLACEMENT_SUMMARY_VALUE_ROWS}u + row;
}

fn clear_summary(event: u32) {
  summary_keys[event] = INVALID_KEY;
  for (var row = 0u; row < ${SPH_REACTION_PRODUCT_PLACEMENT_SUMMARY_VALUE_ROWS}u; row = row + 1u) {
    summary_values[summary_row(event, row)] = vec4<f32>(0.0);
  }
}

@compute @workgroup_size(64)
fn apply_unique_events_and_emit_summaries(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let event = global_id.x;
  if (event >= params.event_row_count || event >= arrayLength(&summary_keys)) { return; }
  clear_summary(event);
  if (event == 0u) {
    atomicStore(&receipt[${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX.intentEmitPassCount}], 1u);
    atomicStore(&receipt[${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX.applyPassCount}], 1u);
    atomicStore(&receipt[${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX.mutationIntentCapacity}], params.event_row_count * 2u);
  }
  let active_count = min(
    atomicLoad(&receipt[${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX.activeEventCount}]),
    params.event_row_count
  );
  if (event >= active_count) { return; }
  atomicAdd(&receipt[${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX.summaryContributionCount}], 1u);
  atomicAdd(&receipt[${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX.applyVisitedCount}], 1u);
  let base = event * params.event_stride_vec4;
  let row0 = product_events[base];
  let row1 = product_events[base + 1u];
  let row2 = product_events[base + 2u];
  let row3 = product_events[base + 3u];
  let row4 = product_events[base + 4u];
  let row5 = product_events[base + 5u];
  let row6 = product_events[base + 6u];
  let row7 = product_events[base + 7u];
  let plan0 = event_plan[event * ${SPH_REACTION_PRODUCT_PLACEMENT_EVENT_PLAN_ROWS}u];
  let plan1 = event_plan[event * ${SPH_REACTION_PRODUCT_PLACEMENT_EVENT_PLAN_ROWS}u + 1u];
  let disposition = u32(max(round(plan1.x), 0.0));
  let product_term_f = round(row1.y);
  let valid_term = product_term_f >= 0.0 && product_term_f < f32(params.product_term_count)
    && row1.y == product_term_f;
  if (!valid_term || disposition == 8u) {
    atomicAdd(&receipt[${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX.rejectedEventCount}], 1u);
    let rejected_mass = max(max(row0.w, 0.0), max(row3.y, 0.0));
    if (valid_term) {
      summary_keys[event] = u32(product_term_f);
      summary_values[summary_row(event, 0u)] = vec4<f32>(row1.x, row1.y, row1.z, row2.z);
      summary_values[summary_row(event, 1u)] = vec4<f32>(row2.w, 0.0, 0.0, 0.0);
      summary_values[summary_row(event, 3u)] = vec4<f32>(0.0, 0.0, 1.0, 0.0);
      summary_values[summary_row(event, 5u)] = vec4<f32>(0.0, 0.0, 0.0, rejected_mass);
      summary_values[summary_row(event, 8u)] = vec4<f32>(f32(event + 1u), 1.0, 0.0, 0.0);
    }
    product_events[base + 3u] = vec4<f32>(row3.x, 0.0, row3.z, row3.w);
    product_events[base + 4u] = vec4<f32>(row4.x, row4.y, 0.0, row4.w);
    product_events[base + 7u] = vec4<f32>(row7.xyz, 8.0);
    return;
  }
  let term = u32(product_term_f);
  summary_keys[event] = term;
  summary_values[summary_row(event, 0u)] = vec4<f32>(row1.x, row1.y, row1.z, row2.z);
  summary_values[summary_row(event, 1u)] = vec4<f32>(row2.w, 0.0, select(0.0, 1.0, row0.w > 0.0), select(0.0, 1.0, row3.y > 0.0));
  summary_values[summary_row(event, 4u)] = vec4<f32>(max(row0.w, 0.0), min(max(row3.x, 0.0), max(row0.w, 0.0)), 0.0, 0.0);
  summary_values[summary_row(event, 7u)].w = max(row0.w, 0.0);
  summary_values[summary_row(event, 8u)] = vec4<f32>(f32(event + 1u), 1.0, 0.0, 0.0);
  let unplaced_mass = max(row3.y, 0.0);
  if (plan0.w == 1.0) {
    summary_values[summary_row(event, 3u)].w = 1.0;
  }
  product_events[base] = vec4<f32>(plan0.xyz, row0.w);
  if (disposition == 2u) {
    atomicAdd(&receipt[${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX.directOnlyEventCount}], 1u);
    summary_values[summary_row(event, 2u)].x = select(0.0, 1.0, row3.x > 0.0);
    product_events[base + 4u] = vec4<f32>(row4.x, row4.y, 0.0, row4.w);
    product_events[base + 7u] = vec4<f32>(row7.xyz, 2.0);
    return;
  }
  if (disposition == 6u) {
    atomicAdd(&receipt[${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX.subthresholdEventCount}], 1u);
    summary_values[summary_row(event, 3u)] = vec4<f32>(1.0, 1.0, 0.0, summary_values[summary_row(event, 3u)].w);
    summary_values[summary_row(event, 5u)] = vec4<f32>(0.0, unplaced_mass, unplaced_mass, 0.0);
    summary_values[summary_row(event, 6u)].w = unplaced_mass;
    product_events[base + 7u] = vec4<f32>(row7.xyz, 6.0);
    return;
  }
  if (disposition == 7u) {
    atomicAdd(&receipt[${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX.noCarrierEventCount}], 1u);
    summary_values[summary_row(event, 3u)].x = 1.0;
    summary_values[summary_row(event, 5u)].y = unplaced_mass;
    summary_values[summary_row(event, 6u)].w = unplaced_mass;
    product_events[base + 7u] = vec4<f32>(row7.xyz, 7.0);
    return;
  }
  if (disposition == 4u) {
    atomicAdd(&receipt[${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX.captureMergeEventCount}], 1u);
    atomicAdd(&receipt[${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX.mutationIntentCount}], 1u);
    summary_values[summary_row(event, 2u)].z = 1.0;
    summary_values[summary_row(event, 4u)].w = unplaced_mass;
    summary_values[summary_row(event, 6u)].y = unplaced_mass;
    summary_values[summary_row(event, 7u)].x = max(0.0, 0.0);
    product_events[base + 3u] = vec4<f32>(row3.x, 0.0, row3.z, row3.w);
    product_events[base + 4u] = vec4<f32>(row4.x, row4.y, 0.0, row4.w);
    product_events[base + 7u] = vec4<f32>(row7.xyz, 4.0);
    return;
  }
  // disposition 3: prefix-assigned spare destinations are unique by contract.
  let slot = u32(round(plan1.z));
  if (slot >= params.particle_count) {
    atomicAdd(&receipt[${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX.unknownDispositionCount}], 1u);
    return;
  }
  atomicAdd(&receipt[${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX.sparePlacementEventCount}], 1u);
  atomicAdd(&receipt[${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX.mutationIntentCount}], 1u);
  let state_base = slot * params.state_stride_vec4;
  next_state[state_base] = vec4<f32>(plan0.xyz, unplaced_mass);
  next_state[state_base + 1u] = vec4<f32>(row5.xyz, row4.w);
  let thermo_base = slot * params.thermo_stride_vec4;
  let phase = row2.w;
  next_thermo[thermo_base] = vec4<f32>(row1.x, phase, row4.x, row4.y);
  next_thermo[thermo_base + 1u] = vec4<f32>(
    select(0.0, 1.0, phase > 0.5 && phase < 1.5),
    select(0.0, 1.0, phase >= 1.5 && phase < 2.5),
    select(0.0, 1.0, phase >= 2.5 && phase < 3.5),
    select(0.0, 1.0, phase >= 3.5)
  );
  let represented_entity_count = represented_entity_count_for_product_mass(
    unplaced_mass,
    row3.w
  );
  next_thermo[thermo_base + 2u] = vec4<f32>(
    plan1.w,
    represented_entity_count,
    1.0,
    plan1.w
  );
  let mechanics_base = slot * params.mechanics_stride_vec4;
  let rest_volume = unplaced_mass / max(row4.y, 1.0e-20);
  let deformation_j = 1.0;
  let deformation_scale = 1.0;
  if (!(rest_volume > 0.0) || !finite_scalar(rest_volume)) {
    atomicOr(
      &receipt[${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX.overflowFlags}],
      ${SPH_REACTION_PRODUCT_PLACEMENT_OVERFLOW_FLAGS.VOLUME_AUTHORITY}u
    );
    return;
  }
  next_mechanics[mechanics_base] = vec4<f32>(deformation_scale, 0.0, 0.0, 0.0);
  next_mechanics[mechanics_base + 1u] = vec4<f32>(deformation_scale, 0.0, 0.0, 0.0);
  next_mechanics[mechanics_base + 2u] = vec4<f32>(deformation_scale, 0.0, 0.0, 0.0);
  next_mechanics[mechanics_base + 3u] = vec4<f32>(0.0);
  next_mechanics[mechanics_base + 4u] = vec4<f32>(0.0, 0.0, deformation_j, rest_volume);
  next_mechanics[mechanics_base + 5u] = vec4<f32>(row7.y, row7.z, row6.x, row6.y);
  next_mechanics[mechanics_base + 6u] = vec4<f32>(row6.z, row6.w, row7.x, row7.z);
  next_mechanics[mechanics_base + 7u] = vec4<f32>(0.0);
  summary_values[summary_row(event, 2u)].y = 1.0;
  summary_values[summary_row(event, 4u)].z = unplaced_mass;
  summary_values[summary_row(event, 6u)].x = unplaced_mass;
  summary_values[summary_row(event, 7u)].z = plan1.w;
  product_events[base + 3u] = vec4<f32>(row3.x + unplaced_mass, 0.0, row3.z, row3.w);
  product_events[base + 4u] = vec4<f32>(row4.x, row4.y, 0.0, row4.w);
  product_events[base + 7u] = vec4<f32>(row7.xyz, 3.0);
  atomicAdd(&receipt[${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX.destinationMutationCount}], 1u);
  atomicMax(&receipt[${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX.maxDestinationSegmentSize}], 1u);
}
`;

const REDUCTION_PARAMS = /* wgsl */ `
struct SegmentedReductionParams {
  element_count: u32,
  stride: u32,
  value_stride_vec4: u32,
  key_stride_words: u32,
};
const INVALID_KEY: u32 = 0xffffffffu;
`;

export const sphReactionProductPlacementCaptureReduceWgsl = /* wgsl */ `
${REDUCTION_PARAMS}
@group(0) @binding(0) var<storage, read> keys: array<u32>;
@group(0) @binding(1) var<storage, read> sorted_indices: array<u32>;
@group(0) @binding(2) var<storage, read> source_values: array<vec4<f32>>;
@group(0) @binding(3) var<storage, read> input_values: array<vec4<f32>>;
@group(0) @binding(4) var<storage, read_write> output_values: array<vec4<f32>>;
@group(0) @binding(5) var<uniform> reduce: SegmentedReductionParams;

fn source_key(sorted_position: u32) -> u32 {
  return keys[sorted_indices[sorted_position]];
}

@compute @workgroup_size(64)
fn initialize_capture_segments(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let position = global_id.x;
  if (position >= reduce.element_count) { return; }
  let source = sorted_indices[position];
  for (var row = 0u; row < ${SPH_REACTION_PRODUCT_PLACEMENT_CAPTURE_VALUE_ROWS}u; row = row + 1u) {
    output_values[position * ${SPH_REACTION_PRODUCT_PLACEMENT_CAPTURE_VALUE_ROWS}u + row] =
      source_values[source * ${SPH_REACTION_PRODUCT_PLACEMENT_CAPTURE_VALUE_ROWS}u + row];
  }
}

@compute @workgroup_size(64)
fn reduce_capture_segments(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let position = global_id.x;
  if (position >= reduce.element_count) { return; }
  let out = position * ${SPH_REACTION_PRODUCT_PLACEMENT_CAPTURE_VALUE_ROWS}u;
  for (var row = 0u; row < ${SPH_REACTION_PRODUCT_PLACEMENT_CAPTURE_VALUE_ROWS}u; row = row + 1u) {
    output_values[out + row] = input_values[out + row];
  }
  if (position < reduce.stride || source_key(position) == INVALID_KEY
    || source_key(position) != source_key(position - reduce.stride)) { return; }
  let left = (position - reduce.stride) * ${SPH_REACTION_PRODUCT_PLACEMENT_CAPTURE_VALUE_ROWS}u;
  let current0 = input_values[out];
  let prior0 = input_values[left];
  let choose_prior_metadata = prior0.y > current0.y;
  output_values[out] = vec4<f32>(
    current0.x + prior0.x,
    max(current0.y, prior0.y),
    current0.z + prior0.z,
    0.0
  );
  output_values[out + 1u] = input_values[out + 1u] + input_values[left + 1u];
  output_values[out + 2u] = input_values[out + 2u] + input_values[left + 2u];
  let current3 = input_values[out + 3u];
  let prior3 = input_values[left + 3u];
  output_values[out + 3u] = vec4<f32>(
    current3.x + prior3.x,
    current3.y + prior3.y,
    max(current3.z, prior3.z),
    current3.w + prior3.w
  );
  if (choose_prior_metadata) {
    output_values[out + 4u] = input_values[left + 4u];
    output_values[out + 5u] = input_values[left + 5u];
  }
}
`;

const MERGE_ROUTE = /* wgsl */ `
fn route_merged_gas(
  original_position: vec3<f32>,
  routed_position: vec3<f32>,
  support_radius: f32,
  merged_volume: f32,
  fallback: vec3<f32>
) -> vec4<f32> {
  let route = routed_position - original_position;
  let route2 = dot(route, route);
  if (!(route2 > 1.0e-20) || !(merged_volume > 0.0)) { return vec4<f32>(fallback, 0.0); }
  let radius = pow(max(merged_volume * 0.238732414637843, 1.0e-30), 1.0 / 3.0);
  if (!support_fits_box(radius)) { return vec4<f32>(fallback, 0.0); }
  let normal = route / sqrt(route2);
  let required = routed_position + normal * max(radius - support_radius, 0.0);
  let projected = fallback + normal * max(dot(required - fallback, normal), 0.0);
  let clamped = clamp_to_box(projected, radius);
  if (dot(clamped - required, normal) < -1.0e-5) { return vec4<f32>(fallback, 0.0); }
  return vec4<f32>(clamped, 1.0);
}
`;

export const sphReactionProductPlacementCaptureApplyWgsl = /* wgsl */ `
${PARAMS}
@group(0) @binding(0) var<storage, read> keys: array<u32>;
@group(0) @binding(1) var<storage, read> sorted_indices: array<u32>;
@group(0) @binding(2) var<storage, read> reduced_values: array<vec4<f32>>;
@group(0) @binding(3) var<storage, read_write> next_state: array<vec4<f32>>;
@group(0) @binding(4) var<storage, read_write> next_thermo: array<vec4<f32>>;
@group(0) @binding(5) var<storage, read_write> next_mechanics: array<vec4<f32>>;
@group(0) @binding(6) var<storage, read_write> summary_values: array<vec4<f32>>;
@group(0) @binding(7) var<storage, read_write> receipt: array<atomic<u32>>;
@group(0) @binding(8) var<uniform> params: ProductPlacementParams;

${MERGE_ROUTE}

@compute @workgroup_size(64)
fn apply_capture_segment_tails(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let position = global_id.x;
  if (position >= params.event_row_count) { return; }
  if (position == 0u) {
    atomicStore(&receipt[${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX.destinationApplyPassCount}], 1u);
    atomicStore(&receipt[${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX.destinationIntentVisitedCount}], params.event_row_count * 2u);
  }
  let source = sorted_indices[position];
  let key = keys[source];
  if (key == INVALID_KEY || key >= params.particle_count) { return; }
  if (position + 1u < params.event_row_count && keys[sorted_indices[position + 1u]] == key) { return; }
  let value = position * ${SPH_REACTION_PRODUCT_PLACEMENT_CAPTURE_VALUE_ROWS}u;
  let aggregate0 = reduced_values[value];
  let aggregate1 = reduced_values[value + 1u];
  let aggregate2 = reduced_values[value + 2u];
  let aggregate3 = reduced_values[value + 3u];
  let state_base = key * params.state_stride_vec4;
  let state0 = next_state[state_base];
  let state1 = next_state[state_base + 1u];
  let total_mass = state0.w + aggregate1.x;
  if (!(state0.w > 0.0) || !(aggregate1.x > 0.0) || !(total_mass > 0.0)
    || !finite_vec4(state0) || !finite_vec4(state1)
    || !finite_vec4(aggregate0) || !finite_vec4(aggregate1)
    || !finite_vec4(aggregate2) || !finite_vec4(aggregate3)
    || !finite_scalar(total_mass)) {
    atomicOr(
      &receipt[${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX.overflowFlags}],
      ${SPH_REACTION_PRODUCT_PLACEMENT_OVERFLOW_FLAGS.CONSERVATION_MOMENT}u
    );
    return;
  }
  let inv_mass = 1.0 / total_mass;
  var position_out = (state0.xyz * state0.w + aggregate1.yzw) * inv_mass;
  let velocity_out = (state1.xyz * state0.w + aggregate2.xyz) * inv_mass;
  let destination_total_energy =
    state0.w * (state1.w + 0.5 * dot(state1.xyz, state1.xyz));
  let merged_total_energy = destination_total_energy + aggregate2.w;
  let internal_out = (
    merged_total_energy
    - 0.5 * total_mass * dot(velocity_out, velocity_out)
  ) * inv_mass;
  let mechanics_base = key * params.mechanics_stride_vec4;
  let mechanics4 = next_mechanics[mechanics_base + 4u];
  let thermo_base = key * params.thermo_stride_vec4;
  let thermo0 = next_thermo[thermo_base];
  let thermo2 = next_thermo[thermo_base + 2u];
  let merged_represented_entity_count = thermo2.y + aggregate0.z;
  let incoming_reference_volume = aggregate3.w;
  let merged_current_volume = mechanics4.z * mechanics4.w
    + incoming_reference_volume;
  let merged_rest_volume = mechanics4.w + aggregate3.y;
  let merged_j = merged_current_volume / max(merged_rest_volume, 1.0e-20);
  let deformation_scale = pow(
    max(merged_j / max(mechanics4.z, 1.0e-20), 1.0e-20),
    1.0 / 3.0
  );
  if (!(mechanics4.z > 0.0) || !(mechanics4.w > 0.0)
    || !(aggregate3.y > 0.0) || !(incoming_reference_volume > 0.0)
    || !(merged_rest_volume > 0.0) || !(merged_current_volume > 0.0)
    || !(merged_j > 0.0) || !finite_scalar(merged_rest_volume)
    || !finite_scalar(merged_current_volume) || !finite_scalar(merged_j)
    || !finite_scalar(deformation_scale)
    || !finite_vec3(position_out)
    || !finite_vec3(velocity_out)
    || !finite_scalar(destination_total_energy)
    || !finite_scalar(merged_total_energy)
    || !finite_scalar(internal_out)
    || !finite_vec4(thermo0)
    || !finite_vec4(thermo2)
    || !finite_scalar(aggregate0.z)
    || !finite_scalar(merged_represented_entity_count)
    || !finite_vec4(mechanics4)) {
    atomicOr(
      &receipt[${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX.overflowFlags}],
      ${SPH_REACTION_PRODUCT_PLACEMENT_OVERFLOW_FLAGS.CONSERVATION_MOMENT}u
    );
    return;
  }
  let temperature_out = (thermo0.z * state0.w + aggregate3.x) * inv_mass;
  if (!finite_scalar(temperature_out)) {
    atomicOr(
      &receipt[${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX.overflowFlags}],
      ${SPH_REACTION_PRODUCT_PLACEMENT_OVERFLOW_FLAGS.CONSERVATION_MOMENT}u
    );
    return;
  }
  let selected4 = reduced_values[value + 4u];
  let selected5 = reduced_values[value + 5u];
  if (phase_is_gas(thermo0.y) && selected5.w > 0.0) {
    let routed = route_merged_gas(
      selected4.xyz,
      selected5.xyz,
      selected4.w,
      merged_current_volume,
      position_out
    );
    if (routed.w > 0.0) { position_out = routed.xyz; }
  }
  next_state[state_base] = vec4<f32>(position_out, total_mass);
  next_state[state_base + 1u] = vec4<f32>(velocity_out, internal_out);
  next_thermo[thermo_base] = vec4<f32>(thermo0.xy, temperature_out, thermo0.w);
  next_thermo[thermo_base + 2u] = vec4<f32>(
    thermo2.x,
    merged_represented_entity_count,
    thermo2.z,
    thermo2.w
  );
  next_mechanics[mechanics_base] =
    next_mechanics[mechanics_base] * deformation_scale;
  next_mechanics[mechanics_base + 1u] =
    next_mechanics[mechanics_base + 1u] * deformation_scale;
  let deformation_row2 = next_mechanics[mechanics_base + 2u];
  next_mechanics[mechanics_base + 2u] = vec4<f32>(
    deformation_row2.x * deformation_scale,
    deformation_row2.yzw
  );
  next_mechanics[mechanics_base + 4u] = vec4<f32>(
    mechanics4.xy,
    merged_j,
    merged_rest_volume
  );
  let selected_event = u32(max(aggregate0.y, 1.0)) - 1u;
  if (selected_event < params.event_row_count) {
    let summary_base = selected_event * ${SPH_REACTION_PRODUCT_PLACEMENT_SUMMARY_VALUE_ROWS}u;
    let maxima = summary_values[summary_base + 6u];
    summary_values[summary_base + 6u] = vec4<f32>(maxima.xy, max(maxima.z, total_mass), maxima.w);
    let distances = summary_values[summary_base + 7u];
    summary_values[summary_base + 7u] = vec4<f32>(max(distances.x, aggregate3.z), distances.yzw);
  }
  atomicAdd(&receipt[${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX.destinationMutationCount}], 1u);
  atomicMax(&receipt[${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX.maxDestinationSegmentSize}], u32(aggregate0.x));
}
`;

export const sphReactionProductPlacementDirectPlanWgsl = /* wgsl */ `
${PARAMS}
@group(0) @binding(0) var<storage, read> product_events: array<vec4<f32>>;
@group(0) @binding(1) var<storage, read> next_state: array<vec4<f32>>;
@group(0) @binding(2) var<storage, read> next_thermo: array<vec4<f32>>;
@group(0) @binding(3) var<storage, read> compact_counts: array<u32>;
@group(0) @binding(4) var<storage, read> event_plan: array<vec4<f32>>;
@group(0) @binding(5) var<storage, read_write> direct_keys: array<u32>;
@group(0) @binding(6) var<storage, read_write> direct_values: array<vec4<f32>>;
@group(0) @binding(7) var<storage, read_write> receipt: array<atomic<u32>>;
@group(0) @binding(8) var<uniform> params: ProductPlacementParams;

fn carrier_matches(index: u32, material: f32, phase: f32) -> bool {
  if (index >= params.particle_count) { return false; }
  let state0 = next_state[index * params.state_stride_vec4];
  let thermo0 = next_thermo[index * params.thermo_stride_vec4];
  return state0.w > 0.0 && abs(thermo0.x - material) < 0.5 && abs(thermo0.y - phase) < 0.5;
}

@compute @workgroup_size(64)
fn emit_direct_pair_hyperedges(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let event = global_id.x;
  if (event >= params.event_row_count) { return; }
  direct_keys[event * 2u] = INVALID_KEY;
  direct_keys[event * 2u + 1u] = INVALID_KEY;
  for (var row = 0u; row < ${SPH_REACTION_PRODUCT_PLACEMENT_DIRECT_VALUE_ROWS}u; row = row + 1u) {
    direct_values[event * ${SPH_REACTION_PRODUCT_PLACEMENT_DIRECT_VALUE_ROWS}u + row] = vec4<f32>(0.0);
  }
  let active_count = min(compact_counts[0], params.event_row_count);
  if (event >= active_count) { return; }
  let base = event * params.event_stride_vec4;
  let row0 = product_events[base];
  let row1 = product_events[base + 1u];
  let row2 = product_events[base + 2u];
  let row3 = product_events[base + 3u];
  let plan0 = event_plan[event * ${SPH_REACTION_PRODUCT_PLACEMENT_EVENT_PLAN_ROWS}u];
  let direct_mass = min(max(row3.x, 0.0), max(row0.w, 0.0));
  let source_f = round(row1.w);
  let partner_f = round(row2.x);
  if (direct_mass <= 0.0 || !phase_is_gas(row2.w) || plan0.w != 1.0
    || source_f < 0.0 || partner_f < 0.0
    || source_f >= f32(params.particle_count) || partner_f >= f32(params.particle_count)
    || source_f == partner_f) { return; }
  let source = u32(source_f);
  let partner = u32(partner_f);
  let source_matches = carrier_matches(source, row1.x, row2.w);
  let partner_matches = carrier_matches(partner, row1.x, row2.w);
  if (!source_matches && !partner_matches) { return; }
  direct_keys[event * 2u] = min(source, partner);
  direct_keys[event * 2u + 1u] = max(source, partner);
  let value = event * ${SPH_REACTION_PRODUCT_PLACEMENT_DIRECT_VALUE_ROWS}u;
  direct_values[value] = vec4<f32>(1.0, f32(event + 1u), f32(source), f32(partner));
  direct_values[value + 1u] = vec4<f32>(row1.x, row2.w, select(0.0, 1.0, source_matches), select(0.0, 1.0, partner_matches));
  direct_values[value + 2u] = vec4<f32>(plan0.xyz, event_plan[event * ${SPH_REACTION_PRODUCT_PLACEMENT_EVENT_PLAN_ROWS}u + 1u].w);
  atomicAdd(&receipt[${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX.mutationIntentCount}], 1u);
}
`;

export const sphReactionProductPlacementDirectReduceWgsl = /* wgsl */ `
${REDUCTION_PARAMS}
@group(0) @binding(0) var<storage, read> keys: array<u32>;
@group(0) @binding(1) var<storage, read> sorted_indices: array<u32>;
@group(0) @binding(2) var<storage, read> source_values: array<vec4<f32>>;
@group(0) @binding(3) var<storage, read> input_values: array<vec4<f32>>;
@group(0) @binding(4) var<storage, read_write> output_values: array<vec4<f32>>;
@group(0) @binding(5) var<uniform> reduce: SegmentedReductionParams;

fn keys_equal_at(left_position: u32, right_position: u32) -> bool {
  let left = sorted_indices[left_position] * 2u;
  let right = sorted_indices[right_position] * 2u;
  return keys[left] == keys[right] && keys[left + 1u] == keys[right + 1u];
}

@compute @workgroup_size(64)
fn initialize_direct_segments(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let position = global_id.x;
  if (position >= reduce.element_count) { return; }
  let source = sorted_indices[position];
  for (var row = 0u; row < ${SPH_REACTION_PRODUCT_PLACEMENT_DIRECT_VALUE_ROWS}u; row = row + 1u) {
    output_values[position * ${SPH_REACTION_PRODUCT_PLACEMENT_DIRECT_VALUE_ROWS}u + row] =
      source_values[source * ${SPH_REACTION_PRODUCT_PLACEMENT_DIRECT_VALUE_ROWS}u + row];
  }
}

@compute @workgroup_size(64)
fn reduce_direct_segments(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let position = global_id.x;
  if (position >= reduce.element_count) { return; }
  let out = position * ${SPH_REACTION_PRODUCT_PLACEMENT_DIRECT_VALUE_ROWS}u;
  for (var row = 0u; row < ${SPH_REACTION_PRODUCT_PLACEMENT_DIRECT_VALUE_ROWS}u; row = row + 1u) {
    output_values[out + row] = input_values[out + row];
  }
  let source_key = sorted_indices[position] * 2u;
  if (position < reduce.stride || keys[source_key] == INVALID_KEY
    || !keys_equal_at(position, position - reduce.stride)) { return; }
  let left = (position - reduce.stride) * ${SPH_REACTION_PRODUCT_PLACEMENT_DIRECT_VALUE_ROWS}u;
  let current = input_values[out];
  let prior = input_values[left];
  var selected = current;
  if (prior.y > current.y) {
    selected = prior;
    output_values[out + 1u] = input_values[left + 1u];
    output_values[out + 2u] = input_values[left + 2u];
  }
  output_values[out] = vec4<f32>(current.x + prior.x, selected.yzw);
}
`;

export const sphReactionProductPlacementDirectApplyWgsl = /* wgsl */ `
${PARAMS}
@group(0) @binding(0) var<storage, read> keys: array<u32>;
@group(0) @binding(1) var<storage, read> sorted_indices: array<u32>;
@group(0) @binding(2) var<storage, read> reduced_values: array<vec4<f32>>;
@group(0) @binding(3) var<storage, read_write> next_state: array<vec4<f32>>;
@group(0) @binding(4) var<storage, read> next_thermo: array<vec4<f32>>;
@group(0) @binding(5) var<storage, read> next_mechanics: array<vec4<f32>>;
@group(0) @binding(6) var<storage, read_write> receipt: array<atomic<u32>>;
@group(0) @binding(7) var<storage, read_write> endpoint_claims: array<atomic<u32>>;
@group(0) @binding(8) var<uniform> params: ProductPlacementParams;

${MERGE_ROUTE}

fn current_volume(index: u32) -> f32 {
  let mechanics4 = next_mechanics[index * params.mechanics_stride_vec4 + 4u];
  let volume = mechanics4.z * mechanics4.w;
  return select(
    0.0,
    volume,
    mechanics4.z > 0.0 && mechanics4.w > 0.0
      && finite_scalar(volume) && volume > 0.0
  );
}

@compute @workgroup_size(64)
fn initialize_direct_endpoint_claims(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let particle = global_id.x;
  if (particle < params.particle_count && particle < arrayLength(&endpoint_claims)) {
    atomicStore(&endpoint_claims[particle], INVALID_KEY);
  }
}

@compute @workgroup_size(64)
fn claim_direct_pair_hyperedge_endpoints(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let position = global_id.x;
  if (position >= params.event_row_count) { return; }
  let record = sorted_indices[position];
  let key_base = record * 2u;
  let left_key = keys[key_base];
  let right_key = keys[key_base + 1u];
  if (left_key == INVALID_KEY || right_key == INVALID_KEY) { return; }
  if (position + 1u < params.event_row_count) {
    let next_record = sorted_indices[position + 1u] * 2u;
    if (keys[next_record] == left_key && keys[next_record + 1u] == right_key) { return; }
  }
  let value = position * ${SPH_REACTION_PRODUCT_PLACEMENT_DIRECT_VALUE_ROWS}u;
  let aggregate0 = reduced_values[value];
  let aggregate1 = reduced_values[value + 1u];
  let source = u32(aggregate0.z);
  let partner = u32(aggregate0.w);
  let priority = u32(max(aggregate0.y, 1.0)) - 1u;
  if (aggregate1.z > 0.5 && source < arrayLength(&endpoint_claims)) {
    atomicMin(&endpoint_claims[source], priority);
  }
  if (aggregate1.w > 0.5 && partner < arrayLength(&endpoint_claims)) {
    atomicMin(&endpoint_claims[partner], priority);
  }
}

@compute @workgroup_size(64)
fn apply_direct_pair_hyperedge_tails(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let position = global_id.x;
  if (position >= params.event_row_count) { return; }
  if (position == 0u) {
    atomicStore(&receipt[${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX.destinationApplyPassCount}], 2u);
  }
  let record = sorted_indices[position];
  let key_base = record * 2u;
  let left_key = keys[key_base];
  let right_key = keys[key_base + 1u];
  if (left_key == INVALID_KEY || right_key == INVALID_KEY) { return; }
  if (position + 1u < params.event_row_count) {
    let next_record = sorted_indices[position + 1u] * 2u;
    if (keys[next_record] == left_key && keys[next_record + 1u] == right_key) { return; }
  }
  let value = position * ${SPH_REACTION_PRODUCT_PLACEMENT_DIRECT_VALUE_ROWS}u;
  let aggregate0 = reduced_values[value];
  let aggregate1 = reduced_values[value + 1u];
  let aggregate2 = reduced_values[value + 2u];
  let source = u32(aggregate0.z);
  let partner = u32(aggregate0.w);
  if (source >= params.particle_count || partner >= params.particle_count || source == partner) { return; }
  let source_matches = aggregate1.z > 0.5;
  let partner_matches = aggregate1.w > 0.5;
  if (!source_matches && !partner_matches) { return; }
  let priority = u32(max(aggregate0.y, 1.0)) - 1u;
  let owns_source = !source_matches || atomicLoad(&endpoint_claims[source]) == priority;
  let owns_partner = !partner_matches || atomicLoad(&endpoint_claims[partner]) == priority;
  if (!owns_source || !owns_partner) {
    atomicAdd(&receipt[${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX.mutationConflictRetryCount}], 1u);
    return;
  }
  let source_base = source * params.state_stride_vec4;
  let partner_base = partner * params.state_stride_vec4;
  let source_state0 = next_state[source_base];
  let partner_state0 = next_state[partner_base];
  var applied = false;
  if (source_matches && partner_matches) {
    let source_volume = current_volume(source);
    let partner_volume = current_volume(partner);
    if (!(source_volume > 0.0) || !(partner_volume > 0.0)) {
      atomicOr(
        &receipt[${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX.overflowFlags}],
        ${SPH_REACTION_PRODUCT_PLACEMENT_OVERFLOW_FLAGS.VOLUME_AUTHORITY}u
      );
      return;
    }
    let source_radius = pow(max(source_volume * 0.238732414637843, 1.0e-30), 1.0 / 3.0);
    let partner_radius = pow(max(partner_volume * 0.238732414637843, 1.0e-30), 1.0 / 3.0);
    let midpoint = 0.5 * (source_state0.xyz + partner_state0.xyz);
    let pair_separation = source_state0.xyz - partner_state0.xyz;
    let pair_radius = 0.5 * sqrt(dot(pair_separation, pair_separation)) + max(source_radius, partner_radius);
    let pair_volume = pair_radius * pair_radius * pair_radius / 0.238732414637843;
    let routed = route_merged_gas(midpoint, aggregate2.xyz, aggregate2.w, pair_volume, midpoint);
    if (routed.w > 0.0) {
      let shift = routed.xyz - midpoint;
      next_state[source_base] = vec4<f32>(source_state0.xyz + shift, source_state0.w);
      next_state[partner_base] = vec4<f32>(partner_state0.xyz + shift, partner_state0.w);
      applied = true;
    }
  } else {
    let destination = select(partner, source, source_matches);
    let destination_base = destination * params.state_stride_vec4;
    let state0 = next_state[destination_base];
    if (!(current_volume(destination) > 0.0)) {
      atomicOr(
        &receipt[${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX.overflowFlags}],
        ${SPH_REACTION_PRODUCT_PLACEMENT_OVERFLOW_FLAGS.VOLUME_AUTHORITY}u
      );
      return;
    }
    let routed = route_merged_gas(
      state0.xyz,
      aggregate2.xyz,
      aggregate2.w,
      current_volume(destination),
      state0.xyz
    );
    if (routed.w > 0.0) {
      next_state[destination_base] = vec4<f32>(routed.xyz, state0.w);
      applied = true;
    }
  }
  if (applied) {
    atomicAdd(&receipt[${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX.destinationMutationCount}], 1u);
  }
  atomicMax(&receipt[${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX.maxDestinationSegmentSize}], u32(aggregate0.x));
}
`;

export const sphReactionProductPlacementSummaryReduceWgsl = /* wgsl */ `
${REDUCTION_PARAMS}
@group(0) @binding(0) var<storage, read> keys: array<u32>;
@group(0) @binding(1) var<storage, read> sorted_indices: array<u32>;
@group(0) @binding(2) var<storage, read> source_values: array<vec4<f32>>;
@group(0) @binding(3) var<storage, read> input_values: array<vec4<f32>>;
@group(0) @binding(4) var<storage, read_write> output_values: array<vec4<f32>>;
@group(0) @binding(5) var<uniform> reduce: SegmentedReductionParams;

fn sorted_key(position: u32) -> u32 { return keys[sorted_indices[position]]; }

@compute @workgroup_size(64)
fn initialize_summary_segments(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let position = global_id.x;
  if (position >= reduce.element_count) { return; }
  let source = sorted_indices[position];
  for (var row = 0u; row < ${SPH_REACTION_PRODUCT_PLACEMENT_SUMMARY_VALUE_ROWS}u; row = row + 1u) {
    output_values[position * ${SPH_REACTION_PRODUCT_PLACEMENT_SUMMARY_VALUE_ROWS}u + row] =
      source_values[source * ${SPH_REACTION_PRODUCT_PLACEMENT_SUMMARY_VALUE_ROWS}u + row];
  }
}

@compute @workgroup_size(64)
fn reduce_summary_segments(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let position = global_id.x;
  if (position >= reduce.element_count) { return; }
  let out = position * ${SPH_REACTION_PRODUCT_PLACEMENT_SUMMARY_VALUE_ROWS}u;
  for (var row = 0u; row < ${SPH_REACTION_PRODUCT_PLACEMENT_SUMMARY_VALUE_ROWS}u; row = row + 1u) {
    output_values[out + row] = input_values[out + row];
  }
  if (position < reduce.stride || sorted_key(position) == INVALID_KEY
    || sorted_key(position) != sorted_key(position - reduce.stride)) { return; }
  let left = (position - reduce.stride) * ${SPH_REACTION_PRODUCT_PLACEMENT_SUMMARY_VALUE_ROWS}u;
  let current_meta = input_values[out + 8u];
  let prior_meta = input_values[left + 8u];
  let choose_prior_metadata = prior_meta.y > 0.0
    && (current_meta.y <= 0.0 || prior_meta.x < current_meta.x);
  if (choose_prior_metadata) {
    output_values[out] = input_values[left];
    output_values[out + 8u] = prior_meta;
  }
  let current1 = input_values[out + 1u];
  let prior1 = input_values[left + 1u];
  output_values[out + 1u] = vec4<f32>(
    select(current1.x, prior1.x, choose_prior_metadata),
    current1.y,
    current1.z + prior1.z,
    current1.w + prior1.w
  );
  for (var row = 2u; row <= 5u; row = row + 1u) {
    output_values[out + row] = input_values[out + row] + input_values[left + row];
  }
  output_values[out + 6u] = max(input_values[out + 6u], input_values[left + 6u]);
  output_values[out + 7u] = max(input_values[out + 7u], input_values[left + 7u]);
}
`;

export const sphReactionProductPlacementSummaryApplyWgsl = /* wgsl */ `
${PARAMS}
@group(0) @binding(0) var<storage, read> keys: array<u32>;
@group(0) @binding(1) var<storage, read> sorted_indices: array<u32>;
@group(0) @binding(2) var<storage, read> reduced_values: array<vec4<f32>>;
@group(0) @binding(3) var<storage, read_write> placement_summary: array<vec4<f32>>;
@group(0) @binding(4) var<storage, read_write> receipt: array<atomic<u32>>;
@group(0) @binding(5) var<uniform> params: ProductPlacementParams;

@compute @workgroup_size(64)
fn initialize_product_term_summaries(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let term = global_id.x;
  if (term >= params.product_term_count) { return; }
  let base = term * 8u;
  let header = placement_summary[base + 1u];
  placement_summary[base + 1u] = vec4<f32>(header.x, 1.0, header.z, header.w);
}

@compute @workgroup_size(64)
fn apply_product_term_segment_tails(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let position = global_id.x;
  if (position >= params.event_row_count) { return; }
  if (position == 0u) {
    atomicStore(&receipt[${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX.summaryApplyPassCount}], 1u);
  }
  let source = sorted_indices[position];
  let term = keys[source];
  if (term == INVALID_KEY || term >= params.product_term_count) { return; }
  if (position + 1u < params.event_row_count && keys[sorted_indices[position + 1u]] == term) { return; }
  let reduced = position * ${SPH_REACTION_PRODUCT_PLACEMENT_SUMMARY_VALUE_ROWS}u;
  let destination = term * 8u;
  placement_summary[destination] = reduced_values[reduced];
  let old1 = placement_summary[destination + 1u];
  let add1 = reduced_values[reduced + 1u];
  placement_summary[destination + 1u] = vec4<f32>(add1.x, 1.0, old1.z + add1.z, old1.w + add1.w);
  for (var row = 2u; row <= 5u; row = row + 1u) {
    placement_summary[destination + row] = placement_summary[destination + row] + reduced_values[reduced + row];
  }
  placement_summary[destination + 6u] = max(placement_summary[destination + 6u], reduced_values[reduced + 6u]);
  placement_summary[destination + 7u] = max(placement_summary[destination + 7u], reduced_values[reduced + 7u]);
}
`;

export const sphReactionProductPlacementFinalizeWgsl = /* wgsl */ `
${PARAMS}
@group(0) @binding(0) var<storage, read> compact_counts: array<u32>;
@group(0) @binding(1) var<storage, read> placement_control: array<vec4<f32>>;
@group(0) @binding(2) var<storage, read_write> receipt: array<atomic<u32>>;
@group(0) @binding(3) var<uniform> params: ProductPlacementParams;

fn placement_reduction_level_count(element_count: u32) -> u32 {
  var levels = 0u;
  var covered = 1u;
  loop {
    if (covered >= max(element_count, 1u)) { break; }
    if (covered > 0x7fffffffu) { return 0xffffffffu; }
    covered = covered * 2u;
    levels = levels + 1u;
  }
  return levels;
}

@compute @workgroup_size(64)
fn finalize_segmented_placement_receipt(@builtin(local_invocation_id) local_id: vec3<u32>) {
  if (local_id.x != 0u) { return; }
  let active_count = min(compact_counts[0], params.event_row_count);
  let disposition_count = atomicLoad(&receipt[${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX.directOnlyEventCount}])
    + atomicLoad(&receipt[${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX.sparePlacementEventCount}])
    + atomicLoad(&receipt[${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX.captureMergeEventCount}])
    + atomicLoad(&receipt[${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX.fallbackEventCount}])
    + atomicLoad(&receipt[${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX.subthresholdEventCount}])
    + atomicLoad(&receipt[${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX.noCarrierEventCount}])
    + atomicLoad(&receipt[${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX.rejectedEventCount}])
    + atomicLoad(&receipt[${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX.unknownDispositionCount}]);
  let classifier_partition =
    atomicLoad(&receipt[${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX.classifierReadyCount}])
    + atomicLoad(&receipt[${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX.classifierRejectedCount}])
    + atomicLoad(&receipt[${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX.classifierUnknownCount}]);
  let reduction_levels = placement_reduction_level_count(params.event_row_count);
  let mutation_intent_count = atomicLoad(
    &receipt[${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX.mutationIntentCount}]
  );
  let complete = arrayLength(&placement_control) >= 2u
    && placement_control[1].x == 1.0
    && atomicLoad(&receipt[${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX.magic}])
      == ${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_MAGIC}u
    && atomicLoad(&receipt[${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX.version}])
      == ${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_VERSION}u
    && atomicLoad(&receipt[${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX.generationId}])
      == params.generation_id
    && atomicLoad(&receipt[${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX.supportProfileId}])
      == params.support_profile_id
    && atomicLoad(&receipt[${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX.eventCapacity}])
      == params.event_row_count
    && atomicLoad(&receipt[${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX.compactCountPassCount}]) == 1u
    && atomicLoad(&receipt[${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX.compactScanPassCount}]) == 1u
    && atomicLoad(&receipt[${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX.compactScatterPassCount}]) == 1u
    && atomicLoad(&receipt[${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX.activeEventCount}]) == active_count
    && atomicLoad(&receipt[${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX.compactionInputVisitCount}]) == params.event_row_count
    && atomicLoad(&receipt[${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX.compactionLiveFlagCount}]) == active_count
    && atomicLoad(&receipt[${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX.compactionOverflowCount}]) == 0u
    && atomicLoad(&receipt[${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX.envelopePartialPassCount}]) == 1u
    && atomicLoad(&receipt[${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX.envelopeFinalizePassCount}]) == 1u
    && atomicLoad(&receipt[${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX.envelopeInputVisitCount}]) == params.particle_count
    && atomicLoad(&receipt[${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX.envelopeAdmitted}]) == 1u
    && atomicLoad(&receipt[${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX.classifierPassCount}]) == 1u
    && classifier_partition == active_count
    && atomicLoad(&receipt[${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX.classifierRejectedCount}]) == 0u
    && atomicLoad(&receipt[${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX.classifierUnknownCount}]) == 0u
    && atomicLoad(&receipt[${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX.ssCellVisitCount}])
      <= atomicLoad(&receipt[${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX.ssMemberVisitCount}])
    && atomicLoad(&receipt[${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX.ssMaterialPhaseFilterCount}])
      <= atomicLoad(&receipt[${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX.ssMemberVisitCount}])
    && atomicLoad(&receipt[${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX.ssCaptureHitCount}])
      <= atomicLoad(&receipt[${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX.ssMemberVisitCount}])
    && atomicLoad(&receipt[${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX.ssCaptureHitCount}])
      <= atomicLoad(&receipt[${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX.classifierReadyCount}])
    && atomicLoad(&receipt[${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX.spareFlagPassCount}]) == 2u
    && atomicLoad(&receipt[${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX.spareScanPassCount}]) == 2u
    && atomicLoad(&receipt[${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX.spareAssignPassCount}]) == 2u
    && atomicLoad(&receipt[${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX.spareCandidateVisitCount}]) == params.particle_count
    && atomicLoad(&receipt[${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX.spareAssignedCount}])
      <= atomicLoad(&receipt[${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX.spareAvailableCount}])
    && atomicLoad(&receipt[${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX.applyPreflightPassCount}]) == 1u
    && atomicLoad(&receipt[${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX.intentEmitPassCount}]) == 1u
    && atomicLoad(&receipt[${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX.applyPassCount}]) == 1u
    && atomicLoad(&receipt[${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX.applyVisitedCount}]) == active_count
    && disposition_count == active_count
    && atomicLoad(&receipt[${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX.captureMergeEventCount}])
      == atomicLoad(&receipt[${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX.ssCaptureHitCount}])
    && atomicLoad(&receipt[${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX.sparePlacementEventCount}])
      == atomicLoad(&receipt[${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX.spareAssignedCount}])
    && atomicLoad(&receipt[${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX.fallbackEventCount}]) == 0u
    // Above-threshold product mass must become a moving carrier.  Treat
    // reserve exhaustion as a rejected transaction so the same-command
    // publication gate restores every speculative destination and ledger.
    && atomicLoad(&receipt[${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX.noCarrierEventCount}]) == 0u
    && atomicLoad(&receipt[${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX.rejectedEventCount}]) == 0u
    && atomicLoad(&receipt[${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX.unknownDispositionCount}]) == 0u
    && atomicLoad(&receipt[${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX.serialConflictFoldPassCount}]) == 0u
    && atomicLoad(&receipt[${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX.serialConflictFoldEventCount}]) == 0u
    && atomicLoad(&receipt[${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX.maxSerialConflictFoldSize}]) == 0u
    && atomicLoad(&receipt[${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX.globalSerialEventFoldCount}]) == 0u
    && atomicLoad(&receipt[${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX.privateLookupBuildCount}]) == 0u
    && atomicLoad(&receipt[${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX.exhaustiveTraversalCount}]) == 0u
    && atomicLoad(&receipt[${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX.overflowFlags}]) == 0u
    && atomicLoad(&receipt[${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX.mutationIntentCapacity}])
      == params.event_row_count * 2u
    && mutation_intent_count
      <= atomicLoad(&receipt[${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX.mutationIntentCapacity}])
    && atomicLoad(&receipt[${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX.destinationRadixPassCount}]) == 24u
    && atomicLoad(&receipt[${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX.destinationSegmentReducePassCount}])
      == reduction_levels * 2u
    && atomicLoad(&receipt[${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX.destinationApplyPassCount}]) == 2u
    && atomicLoad(&receipt[${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX.destinationIntentVisitedCount}])
      == params.event_row_count * 2u
    && atomicLoad(&receipt[${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX.destinationMutationCount}])
      <= mutation_intent_count * 2u
    && atomicLoad(&receipt[${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX.maxDestinationSegmentSize}]) <= active_count
    && atomicLoad(&receipt[${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX.summaryRadixPassCount}]) == 8u
    && atomicLoad(&receipt[${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX.summarySegmentReducePassCount}])
      == reduction_levels
    && atomicLoad(&receipt[${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX.summaryApplyPassCount}]) == 1u
    && atomicLoad(&receipt[${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX.summaryContributionCount}]) == active_count;
  atomicStore(
    &receipt[${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX.status}],
    select(${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_STATUS.CONTRACT_REJECTED}u, ${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_STATUS.COMPLETE}u, complete)
  );
}
`;

// Reaction resolve and placement mutations are one speculative transaction
// until the compact completion receipt is finalized. This same-queue
// publication gate keeps the post-reaction candidate only for COMPLETE; every
// rejected/unknown state restores the exact pre-reaction family before any
// successor consumer can run. The hot path therefore remains fully GPU
// resident without treating queue submission itself as proof of atomic
// reaction-plus-placement acceptance.
export const sphReactionProductPlacementTransactionalPublishWgsl = /* wgsl */ `
${PARAMS}
@group(0) @binding(0) var<storage, read> rollback_state: array<vec4<f32>>;
@group(0) @binding(1) var<storage, read> rollback_thermo: array<vec4<f32>>;
@group(0) @binding(2) var<storage, read> rollback_mechanics: array<vec4<f32>>;
@group(0) @binding(3) var<storage, read_write> destination_state: array<vec4<f32>>;
@group(0) @binding(4) var<storage, read_write> destination_thermo: array<vec4<f32>>;
@group(0) @binding(5) var<storage, read_write> destination_mechanics: array<vec4<f32>>;
@group(0) @binding(6) var<storage, read_write> receipt: array<atomic<u32>>;
@group(0) @binding(7) var<uniform> params: ProductPlacementParams;

@compute @workgroup_size(64)
fn publish_or_restore_placement_destination(
  @builtin(global_invocation_id) global_id: vec3<u32>
) {
  let particle = global_id.x;
  if (particle == 0u) {
    atomicStore(
      &receipt[${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX.transactionalPublishPassCount}],
      1u
    );
  }
  if (particle >= params.particle_count) {
    return;
  }
  let placement_complete = atomicLoad(
    &receipt[${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX.status}]
  ) == ${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_STATUS.COMPLETE}u;
  if (placement_complete) {
    atomicAdd(
      &receipt[${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX.transactionalCommittedParticleCount}],
      1u
    );
  } else {
    let state_base = particle * params.state_stride_vec4;
    let thermo_base = particle * params.thermo_stride_vec4;
    let mechanics_base = particle * params.mechanics_stride_vec4;
    for (var row = 0u; row < params.state_stride_vec4; row = row + 1u) {
      destination_state[state_base + row] = rollback_state[state_base + row];
    }
    for (var row = 0u; row < params.thermo_stride_vec4; row = row + 1u) {
      destination_thermo[thermo_base + row] = rollback_thermo[thermo_base + row];
    }
    for (var row = 0u; row < params.mechanics_stride_vec4; row = row + 1u) {
      destination_mechanics[mechanics_base + row] = rollback_mechanics[mechanics_base + row];
    }
    atomicAdd(
      &receipt[${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX.transactionalFallbackParticleCount}],
      1u
    );
  }
  atomicAdd(
    &receipt[${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX.transactionalVisitedParticleCount}],
    1u
  );
}
`;

// Product-event and per-term summary mutation also remain speculative. This
// pre-terminal pass records the total publication disposition only; it never
// mutates either published ledger. The terminal proof below therefore cannot
// discover an unsafe transaction after candidate bytes have escaped.
export const sphReactionProductPlacementTransactionalAuxiliaryPublishWgsl = /* wgsl */ `
${PARAMS}
@group(0) @binding(0) var<storage, read> candidate_events: array<vec4<f32>>;
@group(0) @binding(1) var<storage, read_write> published_events: array<vec4<f32>>;
@group(0) @binding(2) var<storage, read> candidate_summary: array<vec4<f32>>;
@group(0) @binding(3) var<storage, read_write> published_summary: array<vec4<f32>>;
@group(0) @binding(4) var<storage, read_write> receipt: array<atomic<u32>>;
@group(0) @binding(5) var<uniform> params: ProductPlacementParams;

@compute @workgroup_size(64)
fn publish_or_retain_placement_ledgers(
  @builtin(global_invocation_id) global_id: vec3<u32>
) {
  let row = global_id.x;
  if (row == 0u) {
    atomicStore(
      &receipt[${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX.transactionalEventPublishPassCount}],
      1u
    );
    atomicStore(
      &receipt[${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX.transactionalSummaryPublishPassCount}],
      1u
    );
  }
  let placement_complete = atomicLoad(
    &receipt[${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX.status}]
  ) == ${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_STATUS.COMPLETE}u;
  let event_row_count = params.event_row_count * params.event_stride_vec4;
  if (row < event_row_count) {
    if (placement_complete) {
      atomicAdd(
        &receipt[${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX.transactionalCommittedEventRowCount}],
        1u
      );
    } else {
      atomicAdd(
        &receipt[${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX.transactionalFallbackEventRowCount}],
        1u
      );
    }
    atomicAdd(
      &receipt[${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX.transactionalVisitedEventRowCount}],
      1u
    );
  }
  let summary_row_count = params.product_term_count * 8u;
  if (row < summary_row_count) {
    if (placement_complete) {
      atomicAdd(
        &receipt[${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX.transactionalCommittedSummaryRowCount}],
        1u
      );
    } else {
      atomicAdd(
        &receipt[${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX.transactionalFallbackSummaryRowCount}],
        1u
      );
    }
    atomicAdd(
      &receipt[${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX.transactionalVisitedSummaryRowCount}],
      1u
    );
  }
}
`;

// Terminal proof for the exact publication chain. It is intentionally a
// separate pass so all prior dispatch writes are visible before the successor
// family can be admitted on the same queue.
export const sphReactionProductPlacementTransactionalTerminalWgsl = /* wgsl */ `
${PARAMS}
@group(0) @binding(0) var<storage, read_write> receipt: array<atomic<u32>>;
@group(0) @binding(1) var<uniform> params: ProductPlacementParams;

@compute @workgroup_size(1)
fn seal_transactional_placement_publication(
  @builtin(global_invocation_id) global_id: vec3<u32>
) {
  if (global_id.x != 0u) { return; }
  atomicStore(
    &receipt[${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX.transactionalTerminalSealPassCount}],
    1u
  );
  let event_row_count = params.event_row_count * params.event_stride_vec4;
  let summary_row_count = params.product_term_count * 8u;
  let particle_publication_complete =
    atomicLoad(&receipt[${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX.transactionalPublishPassCount}]) == 1u
    && atomicLoad(&receipt[${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX.transactionalVisitedParticleCount}]) == params.particle_count;
  let event_publication_complete =
    atomicLoad(&receipt[${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX.transactionalEventPublishPassCount}]) == 1u
    && atomicLoad(&receipt[${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX.transactionalVisitedEventRowCount}]) == event_row_count;
  let summary_publication_complete =
    atomicLoad(&receipt[${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX.transactionalSummaryPublishPassCount}]) == 1u
    && atomicLoad(&receipt[${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX.transactionalVisitedSummaryRowCount}]) == summary_row_count;
  let core_status = atomicLoad(
    &receipt[${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX.status}]
  );
  let safe_placed = core_status == ${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_STATUS.COMPLETE}u
    && particle_publication_complete
    && event_publication_complete
    && summary_publication_complete
    && atomicLoad(&receipt[${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX.transactionalCommittedParticleCount}]) == params.particle_count
    && atomicLoad(&receipt[${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX.transactionalFallbackParticleCount}]) == 0u
    && atomicLoad(&receipt[${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX.transactionalCommittedEventRowCount}]) == event_row_count
    && atomicLoad(&receipt[${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX.transactionalFallbackEventRowCount}]) == 0u
    && atomicLoad(&receipt[${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX.transactionalCommittedSummaryRowCount}]) == summary_row_count
    && atomicLoad(&receipt[${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX.transactionalFallbackSummaryRowCount}]) == 0u;
  let core_rejected = core_status == ${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_STATUS.CANONICAL_DECISION_REJECTED}u
    || core_status == ${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_STATUS.CONTRACT_REJECTED}u;
  let safe_fallback = core_rejected
    && particle_publication_complete
    && event_publication_complete
    && summary_publication_complete
    && atomicLoad(&receipt[${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX.transactionalCommittedParticleCount}]) == 0u
    && atomicLoad(&receipt[${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX.transactionalFallbackParticleCount}]) == params.particle_count
    && atomicLoad(&receipt[${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX.transactionalCommittedEventRowCount}]) == 0u
    && atomicLoad(&receipt[${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX.transactionalFallbackEventRowCount}]) == event_row_count
    && atomicLoad(&receipt[${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX.transactionalCommittedSummaryRowCount}]) == 0u
    && atomicLoad(&receipt[${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX.transactionalFallbackSummaryRowCount}]) == summary_row_count;
  var terminal_status = ${SPH_REACTION_PRODUCT_PLACEMENT_TRANSACTION_STATUS.UNSAFE}u;
  if (safe_placed) {
    terminal_status = ${SPH_REACTION_PRODUCT_PLACEMENT_TRANSACTION_STATUS.SAFE_PLACED}u;
  } else if (safe_fallback) {
    terminal_status = ${SPH_REACTION_PRODUCT_PLACEMENT_TRANSACTION_STATUS.SAFE_FROZEN_FALLBACK}u;
  }
  atomicStore(
    &receipt[${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX.transactionalTerminalStatus}],
    terminal_status
  );
}
`;

// The terminal status is the sole destination-publication selector. Even when
// the core receipt said COMPLETE, any incomplete or inconsistent pre-terminal
// publication evidence produces UNSAFE and this total pass restores every
// destination row from the exact pre-reaction rollback family.
export const sphReactionProductPlacementTransactionalDestinationRecoveryWgsl = /* wgsl */ `
${PARAMS}
@group(0) @binding(0) var<storage, read> rollback_state: array<vec4<f32>>;
@group(0) @binding(1) var<storage, read> rollback_thermo: array<vec4<f32>>;
@group(0) @binding(2) var<storage, read> rollback_mechanics: array<vec4<f32>>;
@group(0) @binding(3) var<storage, read_write> destination_state: array<vec4<f32>>;
@group(0) @binding(4) var<storage, read_write> destination_thermo: array<vec4<f32>>;
@group(0) @binding(5) var<storage, read_write> destination_mechanics: array<vec4<f32>>;
@group(0) @binding(6) var<storage, read_write> receipt: array<atomic<u32>>;
@group(0) @binding(7) var<uniform> params: ProductPlacementParams;

@compute @workgroup_size(64)
fn recover_unsafe_placement_destination(
  @builtin(global_invocation_id) global_id: vec3<u32>
) {
  let particle = global_id.x;
  if (particle >= params.particle_count) { return; }
  let safe_placed = atomicLoad(
    &receipt[${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX.transactionalTerminalStatus}]
  ) == ${SPH_REACTION_PRODUCT_PLACEMENT_TRANSACTION_STATUS.SAFE_PLACED}u;
  if (safe_placed) { return; }
  let state_base = particle * params.state_stride_vec4;
  let thermo_base = particle * params.thermo_stride_vec4;
  let mechanics_base = particle * params.mechanics_stride_vec4;
  for (var row = 0u; row < params.state_stride_vec4; row = row + 1u) {
    destination_state[state_base + row] = rollback_state[state_base + row];
  }
  for (var row = 0u; row < params.thermo_stride_vec4; row = row + 1u) {
    destination_thermo[thermo_base + row] = rollback_thermo[thermo_base + row];
  }
  for (var row = 0u; row < params.mechanics_stride_vec4; row = row + 1u) {
    destination_mechanics[mechanics_base + row] = rollback_mechanics[mechanics_base + row];
  }
}
`;

// Published current-step events are materialized only after the terminal
// proof. A rejected/unsafe reaction-plus-placement transaction clears its
// speculative event rows so restored reactants cannot coexist with newly
// retained product mass. The placement summary can be caller-owned across
// steps, so rejection leaves it untouched; SAFE_PLACED alone replaces it with
// the candidate summary that already includes the prior accumulator.
export const sphReactionProductPlacementTransactionalAuxiliaryMaterializeWgsl = /* wgsl */ `
${PARAMS}
@group(0) @binding(0) var<storage, read> candidate_events: array<vec4<f32>>;
@group(0) @binding(1) var<storage, read_write> published_events: array<vec4<f32>>;
@group(0) @binding(2) var<storage, read> candidate_summary: array<vec4<f32>>;
@group(0) @binding(3) var<storage, read_write> published_summary: array<vec4<f32>>;
@group(0) @binding(4) var<storage, read_write> receipt: array<atomic<u32>>;
@group(0) @binding(5) var<uniform> params: ProductPlacementParams;

@compute @workgroup_size(64)
fn materialize_safe_placement_ledgers(
  @builtin(global_invocation_id) global_id: vec3<u32>
) {
  let row = global_id.x;
  let safe_placed = atomicLoad(
    &receipt[${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX.transactionalTerminalStatus}]
  ) == ${SPH_REACTION_PRODUCT_PLACEMENT_TRANSACTION_STATUS.SAFE_PLACED}u;
  let event_row_count = params.event_row_count * params.event_stride_vec4;
  if (row < event_row_count) {
    published_events[row] = select(
      vec4<f32>(0.0),
      candidate_events[row],
      safe_placed
    );
  }
  let summary_row_count = params.product_term_count * 8u;
  if (row < summary_row_count && safe_placed) {
    published_summary[row] = candidate_summary[row];
  }
}
`;
