import {
  createSchroederSpatialExactNearTraversalV1Wgsl,
  createSchroederSpatialExactNearTraversalV2Wgsl
} from './schroederSpatialExactNearTraversalWgsl.js';
import {
  SCHROEDER_SPATIAL_EPOCH_VERSION,
  SCHROEDER_SPATIAL_EPOCH_V2_VERSION
} from './schroederSpatialEpoch.js';
import {
  SCHROEDER_SPATIAL_SUPPORT_PROFILE_REACTION_PRODUCT_PLACEMENT_V1
} from './schroederSpatialExactNear.js';
import {
  SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX,
  SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_WORDS
} from './sphReactionProductPlacementReceipt.js';

// Dedicated product-event classifier. Keep this module deliberately separate
// from the mutation/summary commit shader: native WebGPU backends otherwise
// spend minutes optimizing the combined dynamic traversal and serial reducer.
// The classifier reads the shared canonical directory, exact-filters members
// against the immutable post-reaction/pre-placement state, and writes one
// independent decision row per compact event. The host binds the directory's
// position-authority state only to the displacement envelope pass.
export function createSphReactionProductEventSpatialClassificationWgsl(
  directoryAbiVersion
) {
  const directoryV2 =
    directoryAbiVersion === SCHROEDER_SPATIAL_EPOCH_V2_VERSION;
  if (
    !directoryV2
    && directoryAbiVersion !== SCHROEDER_SPATIAL_EPOCH_VERSION
  ) {
    throw new RangeError(
      `unsupported reaction-product placement directory ABI version: ${
        directoryAbiVersion
      }`
    );
  }
  const exactNearExpectationType = directoryV2
    ? 'SchroederSpatialExactNearExpectationV2'
    : 'SchroederSpatialExactNearExpectationV1';
  const exactNearSourceCountField = directoryV2
    ? 'physical_source_count'
    : 'source_count';
  const exactNearTraversalWgsl = (
    directoryV2
      ? createSchroederSpatialExactNearTraversalV2Wgsl
      : createSchroederSpatialExactNearTraversalV1Wgsl
  )({
    directoryBindingName: 'spatial_directory'
  });
  return /* wgsl */ `
struct ProductEventPlacementParams {
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
  _pad0: u32,
  _pad1: u32,
  _pad2: u32,
};

@group(0) @binding(0) var<storage, read> product_events: array<vec4<f32>>;
@group(0) @binding(2) var<storage, read> next_thermo: array<vec4<f32>>;
@group(0) @binding(3) var<uniform> params: ProductEventPlacementParams;
@group(0) @binding(6) var<storage, read> compact_counts: array<u32>;
@group(0) @binding(7) var<storage, read> spatial_directory: array<u32>;
@group(0) @binding(8) var<uniform> spatial_expectation: ${exactNearExpectationType};
@group(0) @binding(9) var<storage, read> frozen_placement_source_state: array<vec4<f32>>;
@group(0) @binding(10) var<storage, read_write> placement_decisions: array<vec4<f32>>;
@group(0) @binding(11) var<storage, read> placement_control: array<vec4<f32>>;
@group(0) @binding(12) var<storage, read_write> placement_completion_receipt: array<atomic<u32>>;

${exactNearTraversalWgsl}

const PRODUCT_PLACEMENT_SUPPORT_PROFILE_V1: u32 =
  ${SCHROEDER_SPATIAL_SUPPORT_PROFILE_REACTION_PRODUCT_PLACEMENT_V1}u;

fn placement_receipt_increment(index: u32) {
  let previous = atomicAdd(&placement_completion_receipt[index], 1u);
  if (previous == 0xffffffffu) {
    atomicOr(
      &placement_completion_receipt[${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX.overflowFlags}],
      2u
    );
  }
}

fn placement_classifier_phase_is_liquid(phase_id: f32) -> bool {
  return phase_id >= 1.5 && phase_id < 2.5;
}

fn placement_classifier_phase_is_condensed(phase_id: f32) -> bool {
  return phase_id > 0.5 && phase_id < 2.5;
}

fn placement_classifier_phase_is_gas(phase_id: f32) -> bool {
  return phase_id >= 2.5 && phase_id < 3.5;
}

fn placement_classifier_finite_vec4(value: vec4<f32>) -> bool {
  return all(value == value) && all(abs(value) < vec4<f32>(3.0e38));
}

fn placement_classifier_reactant_radius_m(
  position_mass: vec4<f32>,
  thermo0: vec4<f32>
) -> f32 {
  if (!(position_mass.w > 0.0) || !(thermo0.w > 0.0)) {
    return 0.0;
  }
  return pow(
    max(3.0 * position_mass.w / (12.5663706 * thermo0.w), 1.0e-30),
    1.0 / 3.0
  );
}

fn placement_classifier_support_fits_box(support_radius_m: f32) -> bool {
  if (params.box_clamp_enabled == 0u) {
    return true;
  }
  let box_dims = vec3<f32>(params.box_x_m, params.box_y_m, params.box_z_m);
  return support_radius_m <= 0.5 * min(box_dims.x, min(box_dims.y, box_dims.z));
}

fn placement_classifier_clamp_to_box(
  position: vec3<f32>,
  support_margin_m: f32
) -> vec3<f32> {
  if (params.box_clamp_enabled == 0u) {
    return position;
  }
  let box_dims = vec3<f32>(params.box_x_m, params.box_y_m, params.box_z_m);
  let maximum_margin_m = 0.5 * min(box_dims.x, min(box_dims.y, box_dims.z));
  let margin_m = clamp(support_margin_m, 0.0, maximum_margin_m);
  return clamp(position, vec3<f32>(margin_m), box_dims - vec3<f32>(margin_m));
}

fn placement_classifier_gas_target(
  source_index: u32,
  partner_index: u32,
  fallback_position: vec3<f32>,
  product_support_radius_m: f32
) -> vec4<f32> {
  if (
    source_index >= params.particle_count
    || partner_index >= params.particle_count
    || source_index == partner_index
  ) {
    return vec4<f32>(fallback_position, 0.0);
  }
  let source_position_mass = frozen_placement_source_state[
    source_index * params.state_stride_vec4
  ];
  let partner_position_mass = frozen_placement_source_state[
    partner_index * params.state_stride_vec4
  ];
  let source_thermo0 = next_thermo[source_index * params.thermo_stride_vec4];
  let partner_thermo0 = next_thermo[partner_index * params.thermo_stride_vec4];
  let source_radius_m = placement_classifier_reactant_radius_m(
    source_position_mass,
    source_thermo0
  );
  let partner_radius_m = placement_classifier_reactant_radius_m(
    partner_position_mass,
    partner_thermo0
  );
  if (!(source_radius_m > 0.0) || !(partner_radius_m > 0.0)) {
    return vec4<f32>(fallback_position, 0.0);
  }

  let source_liquid = placement_classifier_phase_is_liquid(source_thermo0.y);
  let partner_liquid = placement_classifier_phase_is_liquid(partner_thermo0.y);
  let source_condensed = placement_classifier_phase_is_condensed(source_thermo0.y);
  let partner_condensed = placement_classifier_phase_is_condensed(partner_thermo0.y);
  var host_is_source = source_index < partner_index;
  if (source_liquid != partner_liquid) {
    host_is_source = source_liquid;
  } else if (source_condensed != partner_condensed) {
    host_is_source = source_condensed;
  } else if (abs(source_thermo0.w - partner_thermo0.w) > 1.0e-6) {
    host_is_source = source_thermo0.w > partner_thermo0.w;
  }

  let host_position = select(
    partner_position_mass.xyz,
    source_position_mass.xyz,
    host_is_source
  );
  let free_position = select(
    source_position_mass.xyz,
    partner_position_mass.xyz,
    host_is_source
  );
  let free_radius_m = select(source_radius_m, partner_radius_m, host_is_source);
  let host_to_free = free_position - host_position;
  let separation_squared = dot(host_to_free, host_to_free);
  if (!(separation_squared > 1.0e-20)) {
    return vec4<f32>(fallback_position, 0.0);
  }
  let product_radius_m = max(product_support_radius_m, 0.0);
  if (!placement_classifier_support_fits_box(product_radius_m)) {
    return vec4<f32>(fallback_position, 0.0);
  }
  let outward_normal = host_to_free / sqrt(separation_squared);
  let required_clearance_m = free_radius_m + product_radius_m;
  var target_position = free_position + outward_normal * required_clearance_m;
  target_position = placement_classifier_clamp_to_box(
    target_position,
    product_radius_m
  );
  if (
    dot(target_position - free_position, outward_normal)
      < required_clearance_m - 1.0e-5
  ) {
    return vec4<f32>(fallback_position, 0.0);
  }
  return vec4<f32>(target_position, min(source_radius_m, partner_radius_m));
}

fn placement_classifier_consider_candidate(
  candidate: u32,
  event_position: vec3<f32>,
  event_material_id: f32,
  event_phase_id: f32,
  event_support_radius_m: f32,
  best_slot: ptr<function, u32>,
  best_distance_squared: ptr<function, f32>
) {
  if (candidate >= params.particle_count) {
    return;
  }
  let authority_state0 = frozen_placement_source_state[
    candidate * params.state_stride_vec4
  ];
  // Classification runs before any placement mutation. The placement family
  // guarantees that the distinct destination was initialized from this exact
  // immutable current source, so binding the mutable copy here would consume a
  // ninth storage slot without adding independent evidence.
  let candidate_state0 = authority_state0;
  if (candidate_state0.w <= 0.0) {
    return;
  }
  let candidate_thermo0 = next_thermo[candidate * params.thermo_stride_vec4];
  if (
    candidate_thermo0.x != event_material_id
    || candidate_thermo0.y != event_phase_id
    || !(candidate_thermo0.w > 0.0)
  ) {
    placement_receipt_increment(
      ${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX.ssMaterialPhaseFilterCount}u
    );
    return;
  }
  let candidate_radius_m = pow(
    max(
      3.0 * candidate_state0.w / (12.5663706 * candidate_thermo0.w),
      1.0e-30
    ),
    1.0 / 3.0
  );
  let capture_radius_m = 4.0 * (
    event_support_radius_m + candidate_radius_m
  );
  let delta = event_position - candidate_state0.xyz;
  let distance_squared = dot(delta, delta);
  if (
    distance_squared <= capture_radius_m * capture_radius_m
    && (
      distance_squared < *best_distance_squared
      || (
        distance_squared == *best_distance_squared
        && candidate < *best_slot
      )
    )
  ) {
    *best_slot = candidate;
    *best_distance_squared = distance_squared;
  }
}

@compute @workgroup_size(64)
fn classify_product_events(
  @builtin(global_invocation_id) global_id: vec3<u32>
) {
  let event = global_id.x;
  if (
    event == 0u
    && arrayLength(&placement_completion_receipt)
      >= ${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_WORDS}u
  ) {
    atomicStore(
      &placement_completion_receipt[${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX.classifierPassCount}],
      1u
    );
  }
  let active_event_count = min(compact_counts[0], params.event_row_count);
  if (event >= active_event_count || event >= arrayLength(&placement_decisions)) {
    return;
  }
  placement_decisions[event] = vec4<f32>(
    f32(params.particle_count),
    3.0e38,
    2.0,
    f32(params.particle_count)
  );
  let stride = params.event_stride_vec4;
  if (
    params.canonical_spatial_enabled == 0u
    || stride < 8u
    || arrayLength(&placement_control) == 0u
    || placement_control[0].z != 1.0
    || spatial_expectation.support_profile_id
      != PRODUCT_PLACEMENT_SUPPORT_PROFILE_V1
    || spatial_expectation.${exactNearSourceCountField} != params.particle_count
    || !ss_exact_near_directory_admitted(spatial_expectation)
  ) {
    placement_receipt_increment(
      ${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX.classifierUnknownCount}u
    );
    return;
  }

  let base = event * stride;
  let row0 = product_events[base];
  let row1 = product_events[base + 1u];
  let row2 = product_events[base + 2u];
  let row3 = product_events[base + 3u];
  let row4 = product_events[base + 4u];
  let row5 = product_events[base + 5u];
  let row6 = product_events[base + 6u];
  let row7 = product_events[base + 7u];
  let product_term_f = round(row1.y);
  let source_index_f = round(row1.w);
  let partner_index_f = round(row2.x);
  let event_valid = placement_classifier_finite_vec4(row0)
    && placement_classifier_finite_vec4(row1)
    && placement_classifier_finite_vec4(row2)
    && placement_classifier_finite_vec4(row3)
    && placement_classifier_finite_vec4(row4)
    && placement_classifier_finite_vec4(row5)
    && placement_classifier_finite_vec4(row6)
    && placement_classifier_finite_vec4(row7)
    && product_term_f >= 0.0
    && product_term_f < f32(params.product_term_count)
    && row1.y == product_term_f
    && source_index_f >= 0.0
    && partner_index_f >= 0.0
    && source_index_f < f32(params.particle_count)
    && partner_index_f < f32(params.particle_count)
    && row1.w == source_index_f
    && row2.x == partner_index_f
    && source_index_f != partner_index_f
    && row0.w >= 0.0
    && row3.x >= 0.0
    && row3.y >= 0.0
    && row7.z == 1.0
    && row4.z == 1.0
    && row2.w > 0.0
    && row4.y > 0.0
    && row5.w >= 0.0;
  let unplaced_mass_kg = max(row3.y, 0.0);
  if (!event_valid) {
    placement_decisions[event].z = 3.0;
    placement_receipt_increment(
      ${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX.classifierRejectedCount}u
    );
    return;
  }
  if (unplaced_mass_kg <= params.min_placed_mass_kg) {
    placement_decisions[event].z = 1.0;
    placement_receipt_increment(
      ${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX.classifierReadyCount}u
    );
    return;
  }

  var event_support_radius_m = 0.05;
  if (row5.w > 0.0) {
    event_support_radius_m = pow(
      row5.w * 0.238732414637843,
      1.0 / 3.0
    );
  }
  var event_position = row0.xyz;
  if (placement_classifier_phase_is_gas(row2.w) && row0.w > 0.0) {
    let gas_target = placement_classifier_gas_target(
      u32(source_index_f),
      u32(partner_index_f),
      event_position,
      event_support_radius_m
    );
    if (gas_target.w > 0.0) {
      event_position = gas_target.xyz;
    }
  }

  let search_radius_m = 4.0 * (
    max(event_support_radius_m, 0.0)
      + max(placement_control[0].x, 0.0)
  ) + max(placement_control[0].y, 0.0);
  if (!ss_exact_near_finite(search_radius_m)) {
    placement_receipt_increment(
      ${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX.classifierUnknownCount}u
    );
    return;
  }

  var best_slot = params.particle_count;
  var best_distance_squared = 3.0e38;
  var malformed = false;
  for (
    var level_ordinal = 0u;
    level_ordinal < spatial_expectation.level_count;
    level_ordinal = level_ordinal + 1u
  ) {
    if (!ss_exact_near_level_occupied(spatial_expectation, level_ordinal)) {
      continue;
    }
    let level = spatial_expectation.min_level + i32(level_ordinal);
    let spacing_m = spatial_expectation.base_grid_spacing_m * exp2(f32(level));
    if (!ss_exact_near_finite(spacing_m) || spacing_m <= 0.0) {
      malformed = true;
      break;
    }
    let center_cell = vec3<i32>(floor(event_position / spacing_m));
    let radius_cells = max(0, i32(min(
      // Match reaction discovery's conservative boundary certificate. One
      // cell covers downward f32 rounding at an exact cell face while the
      // exact current-position distance filter below still rejects extras.
      ceil(search_radius_m / spacing_m) + 1.0,
      2147483520.0
    )));
    let minimum_cell = vec3<i32>(
      ss_exact_near_saturating_sub_radius(center_cell.x, radius_cells),
      ss_exact_near_saturating_sub_radius(center_cell.y, radius_cells),
      ss_exact_near_saturating_sub_radius(center_cell.z, radius_cells)
    );
    let maximum_cell = vec3<i32>(
      ss_exact_near_saturating_add_radius(center_cell.x, radius_cells),
      ss_exact_near_saturating_add_radius(center_cell.y, radius_cells),
      ss_exact_near_saturating_add_radius(center_cell.z, radius_cells)
    );
    let level_order = ss_exact_near_signed_order_key(level);
    let minimum_order = vec3<u32>(
      ss_exact_near_signed_order_key(minimum_cell.x),
      ss_exact_near_signed_order_key(minimum_cell.y),
      ss_exact_near_signed_order_key(minimum_cell.z)
    );
    let maximum_order = vec3<u32>(
      ss_exact_near_signed_order_key(maximum_cell.x),
      ss_exact_near_signed_order_key(maximum_cell.y),
      ss_exact_near_signed_order_key(maximum_cell.z)
    );
    let level_begin = ss_exact_near_lower_bound_cell_key(
      spatial_expectation,
      spatial_expectation.chart_id,
      level_order,
      vec3<u32>(0u)
    );
    let level_end = ss_exact_near_upper_bound_cell_key(
      spatial_expectation,
      spatial_expectation.chart_id,
      level_order,
      vec3<u32>(0xffffffffu)
    );
    var x_cursor = ss_exact_near_lower_bound_cell_key_range(
      spatial_expectation,
      spatial_expectation.chart_id,
      level_order,
      vec3<u32>(minimum_order.x, 0u, 0u),
      level_begin,
      level_end
    );
    for (
      var x_iteration = 0u;
      x_iteration < spatial_expectation.${exactNearSourceCountField}
        && x_cursor < level_end;
      x_iteration = x_iteration + 1u
    ) {
      let x_order = ss_exact_near_cell_key_word(
        spatial_expectation,
        x_cursor,
        2u
      );
      if (x_order > maximum_order.x) {
        x_cursor = level_end;
        continue;
      }
      let x_end = ss_exact_near_upper_bound_cell_key_range(
        spatial_expectation,
        spatial_expectation.chart_id,
        level_order,
        vec3<u32>(x_order, 0xffffffffu, 0xffffffffu),
        x_cursor,
        level_end
      );
      if (x_end <= x_cursor) {
        malformed = true;
        break;
      }
      var y_cursor = ss_exact_near_lower_bound_cell_key_range(
        spatial_expectation,
        spatial_expectation.chart_id,
        level_order,
        vec3<u32>(x_order, minimum_order.y, 0u),
        x_cursor,
        x_end
      );
      for (
        var y_iteration = 0u;
        y_iteration < spatial_expectation.${exactNearSourceCountField}
          && y_cursor < x_end;
        y_iteration = y_iteration + 1u
      ) {
        let y_order = ss_exact_near_cell_key_word(
          spatial_expectation,
          y_cursor,
          3u
        );
        if (y_order > maximum_order.y) {
          y_cursor = x_end;
          continue;
        }
        let y_end = ss_exact_near_upper_bound_cell_key_range(
          spatial_expectation,
          spatial_expectation.chart_id,
          level_order,
          vec3<u32>(x_order, y_order, 0xffffffffu),
          y_cursor,
          x_end
        );
        if (y_end <= y_cursor) {
          malformed = true;
          break;
        }
        let z_begin = ss_exact_near_lower_bound_cell_key_range(
          spatial_expectation,
          spatial_expectation.chart_id,
          level_order,
          vec3<u32>(x_order, y_order, minimum_order.z),
          y_cursor,
          y_end
        );
        let z_end = ss_exact_near_upper_bound_cell_key_range(
          spatial_expectation,
          spatial_expectation.chart_id,
          level_order,
          vec3<u32>(x_order, y_order, maximum_order.z),
          z_begin,
          y_end
        );
        for (var cell_index = z_begin; cell_index < z_end; cell_index = cell_index + 1u) {
          placement_receipt_increment(
            ${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX.ssCellVisitCount}u
          );
          let member_range = ss_exact_near_cell_member_range(
            spatial_expectation,
            cell_index
          );
          if (member_range.admitted == 0u) {
            malformed = true;
            break;
          }
          for (
            var member_offset = member_range.begin;
            member_offset < member_range.end;
            member_offset = member_offset + 1u
          ) {
            placement_receipt_increment(
              ${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX.ssMemberVisitCount}u
            );
            let lookup = ss_exact_near_source_at_member(
              spatial_expectation,
              member_offset
            );
            if (lookup.admitted == 0u) {
              malformed = true;
              break;
            }
            placement_classifier_consider_candidate(
              lookup.source_index,
              event_position,
              row1.x,
              row2.w,
              event_support_radius_m,
              &best_slot,
              &best_distance_squared
            );
          }
          if (malformed) {
            break;
          }
        }
        if (malformed) {
          break;
        }
        y_cursor = y_end;
      }
      if (malformed || y_cursor < x_end) {
        malformed = true;
        break;
      }
      x_cursor = x_end;
    }
    if (malformed || x_cursor < level_end) {
      malformed = true;
      break;
    }
  }
  if (malformed) {
    placement_receipt_increment(
      ${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX.classifierUnknownCount}u
    );
    return;
  }
  if (best_slot < params.particle_count) {
    placement_receipt_increment(
      ${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX.ssCaptureHitCount}u
    );
  }
  placement_decisions[event] = vec4<f32>(
    f32(best_slot),
    sqrt(max(best_distance_squared, 0.0)),
    1.0,
    f32(params.particle_count)
  );
  placement_receipt_increment(
    ${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX.classifierReadyCount}u
  );
}
`;
}

export const sphReactionProductEventSpatialClassificationWgsl =
  createSphReactionProductEventSpatialClassificationWgsl(
    SCHROEDER_SPATIAL_EPOCH_VERSION
  );
export const sphReactionProductEventSpatialClassificationV2Wgsl =
  createSphReactionProductEventSpatialClassificationWgsl(
    SCHROEDER_SPATIAL_EPOCH_V2_VERSION
  );

const productSpareScanParamsWgsl = /* wgsl */ `
struct ProductSpareScanParams {
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

const PHASE_COMPANION_RESERVED_STATUS_FOR_SPARE_SCAN: f32 = 254.0;
`;

// Stable ascending free-particle discovery. Each workgroup performs a parallel
// exclusive prefix; the group totals are scanned separately, so no invocation
// walks the full particle range.
export const sphReactionProductSpareParticleMarkWgsl = /* wgsl */ `
${productSpareScanParamsWgsl}
@group(0) @binding(0) var<storage, read> next_state: array<vec4<f32>>;
@group(0) @binding(1) var<storage, read> next_thermo: array<vec4<f32>>;
@group(0) @binding(2) var<storage, read_write> local_prefix_flags: array<u32>;
@group(0) @binding(3) var<storage, read_write> group_counts: array<u32>;
@group(0) @binding(4) var<uniform> params: ProductSpareScanParams;
@group(0) @binding(5) var<storage, read_write> placement_completion_receipt: array<atomic<u32>>;
var<workgroup> spare_particle_scan: array<u32, 64>;

@compute @workgroup_size(64)
fn mark_spare_particles(
  @builtin(global_invocation_id) global_id: vec3<u32>,
  @builtin(local_invocation_id) local_id: vec3<u32>,
  @builtin(workgroup_id) workgroup_id: vec3<u32>
) {
  let particle = global_id.x;
  let lane = local_id.x;
  var available = 0u;
  if (particle < params.particle_count) {
    let state0 = next_state[particle * params.state_stride_vec4];
    let reserved_status = next_thermo[
      particle * params.thermo_stride_vec4 + 2u
    ].z;
    available = select(
      0u,
      1u,
      state0.w <= 0.0
        && abs(reserved_status - PHASE_COMPANION_RESERVED_STATUS_FOR_SPARE_SCAN) >= 0.5
    );
  }
  spare_particle_scan[lane] = available;
  workgroupBarrier();
  var offset = 1u;
  loop {
    if (offset >= 64u) { break; }
    var preceding = 0u;
    if (lane >= offset) { preceding = spare_particle_scan[lane - offset]; }
    workgroupBarrier();
    let current = spare_particle_scan[lane];
    workgroupBarrier();
    spare_particle_scan[lane] = current + preceding;
    workgroupBarrier();
    offset = offset * 2u;
  }
  if (particle < params.particle_count && particle < arrayLength(&local_prefix_flags)) {
    local_prefix_flags[particle] = (spare_particle_scan[lane] - available)
      | select(0u, 0x80000000u, available != 0u);
  }
  if (lane == 63u && workgroup_id.x < arrayLength(&group_counts)) {
    group_counts[workgroup_id.x] = spare_particle_scan[63u];
  }
  if (particle == 0u) {
    atomicAdd(
      &placement_completion_receipt[${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX.spareFlagPassCount}],
      1u
    );
    atomicStore(
      &placement_completion_receipt[${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX.spareCandidateVisitCount}],
      params.particle_count
    );
  }
}
`;

export const sphReactionProductSpareEventMarkWgsl = /* wgsl */ `
${productSpareScanParamsWgsl}
@group(0) @binding(0) var<storage, read> product_events: array<vec4<f32>>;
@group(0) @binding(1) var<storage, read> compact_counts: array<u32>;
@group(0) @binding(2) var<storage, read> placement_decisions: array<vec4<f32>>;
@group(0) @binding(3) var<storage, read_write> local_prefix_flags: array<u32>;
@group(0) @binding(4) var<storage, read_write> group_counts: array<u32>;
@group(0) @binding(5) var<uniform> params: ProductSpareScanParams;
@group(0) @binding(6) var<storage, read_write> placement_completion_receipt: array<atomic<u32>>;
var<workgroup> spare_event_scan: array<u32, 64>;

@compute @workgroup_size(64)
fn mark_spare_events(
  @builtin(global_invocation_id) global_id: vec3<u32>,
  @builtin(local_invocation_id) local_id: vec3<u32>,
  @builtin(workgroup_id) workgroup_id: vec3<u32>
) {
  let event = global_id.x;
  let lane = local_id.x;
  let active_event_count = min(compact_counts[0], params.event_row_count);
  var needs_spare = 0u;
  if (event < active_event_count) {
    let base = event * params.event_stride_vec4;
    let row3 = product_events[base + 3u];
    let row4 = product_events[base + 4u];
    let row7 = product_events[base + 7u];
    let decision = placement_decisions[event];
    needs_spare = select(
      0u,
      1u,
      decision.z == 1.0
        && decision.x >= f32(params.particle_count)
        && row4.z == 1.0
        && row7.z == 1.0
        && row3.y > params.min_placed_mass_kg
    );
  }
  spare_event_scan[lane] = needs_spare;
  workgroupBarrier();
  var offset = 1u;
  loop {
    if (offset >= 64u) { break; }
    var preceding = 0u;
    if (lane >= offset) { preceding = spare_event_scan[lane - offset]; }
    workgroupBarrier();
    let current = spare_event_scan[lane];
    workgroupBarrier();
    spare_event_scan[lane] = current + preceding;
    workgroupBarrier();
    offset = offset * 2u;
  }
  if (event < params.event_row_count && event < arrayLength(&local_prefix_flags)) {
    local_prefix_flags[event] = (spare_event_scan[lane] - needs_spare)
      | select(0u, 0x80000000u, needs_spare != 0u);
  }
  if (lane == 63u && workgroup_id.x < arrayLength(&group_counts)) {
    group_counts[workgroup_id.x] = spare_event_scan[63u];
  }
  if (event == 0u) {
    atomicAdd(
      &placement_completion_receipt[${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX.spareFlagPassCount}],
      1u
    );
  }
}
`;

// Both particle and event group totals use this ABI. mode=0 scans particles;
// mode=1 scans events after the particle pass has published availability.
export const sphReactionProductSpareGroupScanWgsl = /* wgsl */ `
struct SpareGroupScanParams {
  group_count: u32,
  mode: u32,
  capacity: u32,
  _pad0: u32,
};
@group(0) @binding(0) var<storage, read> group_counts: array<u32>;
@group(0) @binding(1) var<storage, read_write> group_offsets: array<u32>;
@group(0) @binding(2) var<storage, read_write> spare_control: array<u32>;
@group(0) @binding(3) var<uniform> scan_params: SpareGroupScanParams;
@group(0) @binding(4) var<storage, read_write> placement_completion_receipt: array<atomic<u32>>;

@compute @workgroup_size(1)
fn scan_spare_groups(@builtin(global_invocation_id) global_id: vec3<u32>) {
  if (global_id.x != 0u) { return; }
  var total = 0u;
  var overflow = 0u;
  let group_count = min(scan_params.group_count, arrayLength(&group_counts));
  for (var group = 0u; group < group_count; group = group + 1u) {
    if (group >= arrayLength(&group_offsets)) {
      overflow = overflow + 1u;
      continue;
    }
    group_offsets[group] = total;
    let next_total = total + group_counts[group];
    if (next_total < total || next_total > scan_params.capacity) {
      overflow = overflow + 1u;
    }
    total = min(next_total, scan_params.capacity);
  }
  if (arrayLength(&spare_control) >= 4u) {
    if (scan_params.mode == 0u) {
      spare_control[0] = select(total, 0u, overflow != 0u);
      atomicStore(
        &placement_completion_receipt[${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX.spareAvailableCount}],
        spare_control[0]
      );
    } else {
      spare_control[1] = select(total, 0u, overflow != 0u);
      spare_control[2] = min(spare_control[0], spare_control[1]);
      atomicStore(
        &placement_completion_receipt[${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX.spareAssignedCount}],
        spare_control[2]
      );
    }
    spare_control[3] = spare_control[3] | select(0u, 1u, overflow != 0u);
  }
  if (overflow != 0u) {
    atomicOr(
      &placement_completion_receipt[${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX.overflowFlags}],
      1u
    );
  }
  atomicAdd(
    &placement_completion_receipt[${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX.spareScanPassCount}],
    1u
  );
}
`;

export const sphReactionProductSpareScatterWgsl = /* wgsl */ `
${productSpareScanParamsWgsl}
@group(0) @binding(0) var<storage, read> particle_prefix_flags: array<u32>;
@group(0) @binding(1) var<storage, read> particle_group_offsets: array<u32>;
@group(0) @binding(2) var<storage, read_write> spare_slots: array<u32>;
@group(0) @binding(3) var<uniform> params: ProductSpareScanParams;
@group(0) @binding(4) var<storage, read_write> placement_completion_receipt: array<atomic<u32>>;

@compute @workgroup_size(64)
fn scatter_spare_particles(
  @builtin(global_invocation_id) global_id: vec3<u32>,
  @builtin(workgroup_id) workgroup_id: vec3<u32>
) {
  let particle = global_id.x;
  if (particle == 0u) {
    atomicAdd(
      &placement_completion_receipt[${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX.spareAssignPassCount}],
      1u
    );
  }
  if (
    particle >= params.particle_count
    || particle >= arrayLength(&particle_prefix_flags)
    || workgroup_id.x >= arrayLength(&particle_group_offsets)
  ) { return; }
  let packed_prefix = particle_prefix_flags[particle];
  if ((packed_prefix & 0x80000000u) == 0u) { return; }
  let rank = particle_group_offsets[workgroup_id.x]
    + (packed_prefix & 0x7fffffffu);
  if (rank < arrayLength(&spare_slots)) {
    spare_slots[rank] = particle;
  }
}
`;

export const sphReactionProductSpareAssignWgsl = /* wgsl */ `
${productSpareScanParamsWgsl}
@group(0) @binding(0) var<storage, read> event_prefix_flags: array<u32>;
@group(0) @binding(1) var<storage, read> event_group_offsets: array<u32>;
@group(0) @binding(2) var<storage, read> spare_slots: array<u32>;
@group(0) @binding(3) var<storage, read> spare_control: array<u32>;
@group(0) @binding(4) var<storage, read_write> placement_decisions: array<vec4<f32>>;
@group(0) @binding(5) var<uniform> params: ProductSpareScanParams;
@group(0) @binding(6) var<storage, read_write> placement_completion_receipt: array<atomic<u32>>;

@compute @workgroup_size(64)
fn assign_spare_events(
  @builtin(global_invocation_id) global_id: vec3<u32>,
  @builtin(workgroup_id) workgroup_id: vec3<u32>
) {
  let event = global_id.x;
  if (event == 0u) {
    atomicAdd(
      &placement_completion_receipt[${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX.spareAssignPassCount}],
      1u
    );
  }
  if (
    event >= params.event_row_count
    || event >= arrayLength(&event_prefix_flags)
    || event >= arrayLength(&placement_decisions)
    || workgroup_id.x >= arrayLength(&event_group_offsets)
  ) { return; }
  let packed_prefix = event_prefix_flags[event];
  if ((packed_prefix & 0x80000000u) == 0u) { return; }
  let rank = event_group_offsets[workgroup_id.x]
    + (packed_prefix & 0x7fffffffu);
  var assigned_slot = params.particle_count;
  if (
    arrayLength(&spare_control) >= 3u
    && rank < spare_control[2]
    && rank < arrayLength(&spare_slots)
  ) {
    assigned_slot = spare_slots[rank];
  }
  let decision = placement_decisions[event];
  placement_decisions[event] = vec4<f32>(
    decision.xyz,
    f32(assigned_slot)
  );
}
`;
