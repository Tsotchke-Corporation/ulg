import {
  SCHROEDER_SPATIAL_SUPPORT_PROFILE_PRESSURE_CONTACT_V1
} from './schroederSpatialExactNear.js';
import {
  schroederSpatialExactNearTraversalV1Wgsl
} from './schroederSpatialExactNearTraversalWgsl.js';

// Pressure/contact is the first staged exact-near consumer of
// ss-spatial-epoch.v1. It is intentionally separate from legacy particle bins
// and fixed candidate rows: the canonical view needs one directory binding and
// remains within WebGPU's portable eight-storage-buffer limit.
export const sphPressureInterfaceSpatialExactNearContactKinematicsWgsl = /* wgsl */ `
struct SpatialExactNearContactParams {
  element_count: u32,
  particle_count: u32,
  contact_policy_row_count: u32,
  derivation_enabled: u32,
  chart_id: u32,
  level_count: u32,
  expected_generation_id: u32,
  expected_device_ordinal: u32,
  expected_lane_ordinal: u32,
  expected_lease_token: u32,
  expected_source_family_id: u32,
  expected_storage_generation: u32,
  expected_physics_tick: u32,
  expected_physics_substep: u32,
  expected_position_epoch: u32,
  expected_topology_epoch: u32,
  expected_chart_epoch: u32,
  expected_level_epoch: u32,
  expected_support_epoch: u32,
  min_level: i32,
  base_grid_spacing_m: f32,
  max_search_radius_m: f32,
  gap_floor_m: f32,
  _reserved0: f32,
  expected_cell_keys_offset_words: u32,
  expected_cell_offsets_offset_words: u32,
  expected_cell_members_offset_words: u32,
  expected_particle_to_cell_offset_words: u32,
  expected_directory_capacity_words: u32,
  expected_source_capacity: u32,
  expected_cell_capacity: u32,
  _reserved1: u32,
};

@group(0) @binding(0) var<storage, read> interface_elements: array<vec4<f32>>;
@group(0) @binding(1) var<storage, read> particle_state_rows: array<vec4<f32>>;
@group(0) @binding(2) var<storage, read> particle_thermo_rows: array<vec4<f32>>;
@group(0) @binding(3) var<storage, read> contact_policy_rows: array<vec4<f32>>;
@group(0) @binding(4) var<storage, read_write> contact_kinematics_rows: array<vec4<f32>>;
@group(0) @binding(5) var<uniform> params: SpatialExactNearContactParams;
@group(0) @binding(6) var<storage, read> spatial_directory: array<u32>;
@group(0) @binding(7) var<storage, read> particle_identity: array<u32>;

${schroederSpatialExactNearTraversalV1Wgsl}

struct SpatialContactCandidate {
  valid: u32,
  particle_index: u32,
  domain_id: u32,
  material_id: f32,
  phase_id: f32,
  signed_m: f32,
  lateral2: f32,
  velocity: vec3<f32>,
  mass_kg: f32,
  score: f32,
};

struct SpatialContactPair {
  directory_valid: u32,
  ready: u32,
  policy_index: u32,
  source_index: u32,
  target_index: u32,
  score: f32,
  source_signed_m: f32,
  target_signed_m: f32,
  source_velocity: vec3<f32>,
  target_velocity: vec3<f32>,
  source_mass_kg: f32,
  target_mass_kg: f32,
  source_domain_id: u32,
  target_domain_id: u32,
};

fn ss_state_row0(particle_index: u32) -> vec4<f32> {
  return particle_state_rows[particle_index * 2u];
}

fn ss_state_row1(particle_index: u32) -> vec4<f32> {
  return particle_state_rows[particle_index * 2u + 1u];
}

fn ss_thermo_row0(particle_index: u32) -> vec4<f32> {
  return particle_thermo_rows[particle_index * 3u];
}

fn ss_thermo_row2(particle_index: u32) -> vec4<f32> {
  return particle_thermo_rows[particle_index * 3u + 2u];
}

fn ss_phase_matches(particle_phase_id: f32, required_phase_id: f32) -> bool {
  return required_phase_id <= 0.5 || abs(particle_phase_id - required_phase_id) < 0.5;
}

fn ss_finite(value: f32) -> bool {
  return value == value && abs(value) <= 3.402823e38;
}

fn ss_finite3(value: vec3<f32>) -> bool {
  return ss_finite(value.x) && ss_finite(value.y) && ss_finite(value.z);
}

fn ss_endpoint_matches(
  material_id: f32,
  phase_id: f32,
  required_material_id: f32,
  required_phase_id: f32
) -> bool {
  return abs(material_id - required_material_id) < 0.5
    && ss_phase_matches(phase_id, required_phase_id);
}

fn ss_policy_element_side(
  row0: vec4<f32>,
  row2: vec4<f32>,
  material_id: f32,
  phase_id: f32
) -> u32 {
  if (
    !ss_finite(row2.y)
    || row2.y <= 0.0
    || !ss_finite(material_id)
    || !ss_finite(phase_id)
    || !ss_finite(row0.x)
    || !ss_finite(row0.y)
    || !ss_finite(row0.z)
    || !ss_finite(row0.w)
  ) {
    return 0u;
  }
  let matches_a = ss_endpoint_matches(material_id, phase_id, row0.x, row0.z);
  let matches_b = ss_endpoint_matches(material_id, phase_id, row0.y, row0.w);
  if (matches_a && matches_b) {
    let exact_phase_a = row0.z > 0.5 && abs(phase_id - row0.z) < 0.5;
    let exact_phase_b = row0.w > 0.5 && abs(phase_id - row0.w) < 0.5;
    if (exact_phase_b && !exact_phase_a) {
      return 2u;
    }
    return 1u;
  }
  if (matches_a) {
    return 1u;
  }
  if (matches_b) {
    return 2u;
  }
  return 0u;
}

fn ss_exact_domain_id(value: f32) -> u32 {
  if (
    !ss_finite(value)
    || value < 0.5
    || value > 16777215.0
    || abs(value - round(value)) > 0.25
  ) {
    return 0u;
  }
  return u32(round(value));
}

fn ss_normal_from_element(row2: vec4<f32>, row3: vec4<f32>) -> vec3<f32> {
  var normal = row2.xyz;
  if (dot(normal, normal) <= 1.0e-24) {
    normal = vec3<f32>(row2.w, row3.x, row3.y);
  }
  if (dot(normal, normal) <= 1.0e-24) {
    return vec3<f32>(0.0, 1.0, 0.0);
  }
  return normalize(normal);
}

fn ss_exact_near_expectation() -> SchroederSpatialExactNearExpectationV1 {
  return SchroederSpatialExactNearExpectationV1(
    params.particle_count,
    params.derivation_enabled,
    ${SCHROEDER_SPATIAL_SUPPORT_PROFILE_PRESSURE_CONTACT_V1}u,
    params.chart_id,
    params.level_count,
    params.expected_generation_id,
    params.expected_device_ordinal,
    params.expected_lane_ordinal,
    params.expected_lease_token,
    params.expected_source_family_id,
    params.expected_storage_generation,
    params.expected_physics_tick,
    params.expected_physics_substep,
    params.expected_position_epoch,
    params.expected_topology_epoch,
    params.expected_chart_epoch,
    params.expected_level_epoch,
    params.expected_support_epoch,
    params.min_level,
    params.base_grid_spacing_m,
    params.expected_cell_keys_offset_words,
    params.expected_cell_offsets_offset_words,
    params.expected_cell_members_offset_words,
    params.expected_particle_to_cell_offset_words,
    params.expected_directory_capacity_words,
    params.expected_source_capacity,
    params.expected_cell_capacity
  );
}

fn ss_directory_ready() -> bool {
  return params.element_count <= arrayLength(&interface_elements) / 4u
    && params.element_count <= arrayLength(&contact_kinematics_rows) / 2u
    && params.particle_count <= arrayLength(&particle_state_rows) / 2u
    && params.particle_count <= arrayLength(&particle_thermo_rows) / 3u
    && params.particle_count <= arrayLength(&particle_identity)
    && params.contact_policy_row_count <= arrayLength(&contact_policy_rows) / 4u
    && ss_exact_near_directory_admitted(ss_exact_near_expectation());
}

fn ss_signed_order_key(value: i32) -> u32 {
  return ss_exact_near_signed_order_key(value);
}

fn ss_lower_bound_cell_key(
  chart: u32,
  level_order: u32,
  cell_order: vec3<u32>
) -> u32 {
  return ss_exact_near_lower_bound_cell_key(
    ss_exact_near_expectation(),
    chart,
    level_order,
    cell_order
  );
}

fn ss_upper_bound_cell_key(
  chart: u32,
  level_order: u32,
  cell_order: vec3<u32>
) -> u32 {
  return ss_exact_near_upper_bound_cell_key(
    ss_exact_near_expectation(),
    chart,
    level_order,
    cell_order
  );
}

fn ss_lower_bound_cell_key_range(
  chart: u32,
  level_order: u32,
  cell_order: vec3<u32>,
  range_begin: u32,
  range_end: u32
) -> u32 {
  return ss_exact_near_lower_bound_cell_key_range(
    ss_exact_near_expectation(),
    chart,
    level_order,
    cell_order,
    range_begin,
    range_end
  );
}

fn ss_upper_bound_cell_key_range(
  chart: u32,
  level_order: u32,
  cell_order: vec3<u32>,
  range_begin: u32,
  range_end: u32
) -> u32 {
  return ss_exact_near_upper_bound_cell_key_range(
    ss_exact_near_expectation(),
    chart,
    level_order,
    cell_order,
    range_begin,
    range_end
  );
}

fn ss_cell_key_word(cell_index: u32, word_index: u32) -> u32 {
  return ss_exact_near_cell_key_word(
    ss_exact_near_expectation(),
    cell_index,
    word_index
  );
}

fn ss_saturating_sub_radius(value: i32, radius: i32) -> i32 {
  return ss_exact_near_saturating_sub_radius(value, radius);
}

fn ss_saturating_add_radius(value: i32, radius: i32) -> i32 {
  return ss_exact_near_saturating_add_radius(value, radius);
}

fn ss_empty_candidate() -> SpatialContactCandidate {
  return SpatialContactCandidate(
    0u,
    0u,
    0u,
    0.0,
    0.0,
    0.0,
    0.0,
    vec3<f32>(0.0),
    0.0,
    0.0
  );
}

fn ss_candidate_for_particle(
  particle_index: u32,
  centroid: vec3<f32>,
  normal: vec3<f32>,
  search_radius_m: f32,
  search_radius2: f32
) -> SpatialContactCandidate {
  var candidate = ss_empty_candidate();
  if (particle_index >= params.particle_count) {
    return candidate;
  }
  let thermo0 = ss_thermo_row0(particle_index);
  let thermo2 = ss_thermo_row2(particle_index);
  if (
    !ss_finite(thermo0.x)
    || !ss_finite(thermo0.y)
    || !ss_finite(thermo2.z)
    || thermo2.z <= 0.0
  ) {
    return candidate;
  }
  let state0 = ss_state_row0(particle_index);
  let state1 = ss_state_row1(particle_index);
  if (
    !ss_finite3(state0.xyz)
    || !ss_finite(state0.w)
    || state0.w <= 0.0
    || !ss_finite3(state1.xyz)
  ) {
    return candidate;
  }
  let delta = state0.xyz - centroid;
  let signed_m = dot(delta, normal);
  let distance2 = dot(delta, delta);
  let lateral2 = max(distance2 - signed_m * signed_m, 0.0);
  if (
    !ss_finite(signed_m)
    || !ss_finite(lateral2)
    || lateral2 > search_radius2
    || abs(signed_m) > search_radius_m
  ) {
    return candidate;
  }
  let domain_id = particle_identity[particle_index];
  if (domain_id > 16777215u) {
    return candidate;
  }
  candidate.valid = 1u;
  candidate.particle_index = particle_index;
  candidate.domain_id = domain_id;
  candidate.material_id = thermo0.x;
  candidate.phase_id = thermo0.y;
  candidate.signed_m = signed_m;
  candidate.lateral2 = lateral2;
  candidate.velocity = state1.xyz;
  candidate.mass_kg = state0.w;
  return candidate;
}

fn ss_candidate_matches_endpoint(
  candidate: SpatialContactCandidate,
  required_material_id: f32,
  required_phase_id: f32,
  required_domain_id: u32
) -> bool {
  return candidate.valid != 0u
    && ss_endpoint_matches(
      candidate.material_id,
      candidate.phase_id,
      required_material_id,
      required_phase_id
    )
    && (required_domain_id == 0u || candidate.domain_id == required_domain_id);
}

fn ss_score_candidate(
  candidate: SpatialContactCandidate,
  endpoint_ordinal: u32,
  support_radius_m: f32,
  search_radius2: f32
) -> SpatialContactCandidate {
  var result = candidate;
  let wrong_side = select(
    candidate.signed_m > support_radius_m * 0.25,
    candidate.signed_m < -support_radius_m * 0.25,
    endpoint_ordinal != 0u
  );
  let side_penalty = select(0.0, search_radius2, wrong_side);
  result.score = candidate.lateral2
    + candidate.signed_m * candidate.signed_m
    + side_penalty;
  return result;
}

fn ss_candidate_better(
  candidate: SpatialContactCandidate,
  incumbent: SpatialContactCandidate
) -> bool {
  if (candidate.valid == 0u) {
    return false;
  }
  if (incumbent.valid == 0u) {
    return true;
  }
  if (candidate.score < incumbent.score) {
    return true;
  }
  if (candidate.score > incumbent.score) {
    return false;
  }
  if (candidate.domain_id < incumbent.domain_id) {
    return true;
  }
  if (candidate.domain_id > incumbent.domain_id) {
    return false;
  }
  return candidate.particle_index < incumbent.particle_index;
}

fn ss_empty_pair() -> SpatialContactPair {
  return SpatialContactPair(
    1u,
    0u,
    0u,
    0u,
    0u,
    0.0,
    0.0,
    0.0,
    vec3<f32>(0.0),
    vec3<f32>(0.0),
    0.0,
    0.0,
    0u,
    0u
  );
}

fn ss_invalid_directory_pair() -> SpatialContactPair {
  var pair = ss_empty_pair();
  pair.directory_valid = 0u;
  return pair;
}

fn ss_pair_from_candidates(
  source_candidate: SpatialContactCandidate,
  target_candidate: SpatialContactCandidate,
  policy_index: u32
) -> SpatialContactPair {
  var pair = ss_empty_pair();
  if (
    source_candidate.valid == 0u
    || target_candidate.valid == 0u
    || source_candidate.particle_index == target_candidate.particle_index
  ) {
    return pair;
  }
  pair.ready = 1u;
  pair.policy_index = policy_index;
  pair.source_index = source_candidate.particle_index;
  pair.target_index = target_candidate.particle_index;
  pair.score = source_candidate.score + target_candidate.score;
  pair.source_signed_m = source_candidate.signed_m;
  pair.target_signed_m = target_candidate.signed_m;
  pair.source_velocity = source_candidate.velocity;
  pair.target_velocity = target_candidate.velocity;
  pair.source_mass_kg = source_candidate.mass_kg;
  pair.target_mass_kg = target_candidate.mass_kg;
  pair.source_domain_id = source_candidate.domain_id;
  pair.target_domain_id = target_candidate.domain_id;
  return pair;
}

fn ss_pair_better(candidate: SpatialContactPair, incumbent: SpatialContactPair) -> bool {
  if (candidate.ready == 0u) {
    return false;
  }
  if (incumbent.ready == 0u) {
    return true;
  }
  if (candidate.score < incumbent.score) {
    return true;
  }
  if (candidate.score > incumbent.score) {
    return false;
  }
  if (candidate.source_domain_id < incumbent.source_domain_id) {
    return true;
  }
  if (candidate.source_domain_id > incumbent.source_domain_id) {
    return false;
  }
  if (candidate.target_domain_id < incumbent.target_domain_id) {
    return true;
  }
  if (candidate.target_domain_id > incumbent.target_domain_id) {
    return false;
  }
  if (candidate.source_index < incumbent.source_index) {
    return true;
  }
  if (candidate.source_index > incumbent.source_index) {
    return false;
  }
  if (candidate.target_index < incumbent.target_index) {
    return true;
  }
  if (candidate.target_index > incumbent.target_index) {
    return false;
  }
  return candidate.policy_index < incumbent.policy_index;
}

fn ss_pair_for_policy(
  policy_index: u32,
  element_material_id: f32,
  element_phase_id: f32,
  centroid: vec3<f32>,
  normal: vec3<f32>
) -> SpatialContactPair {
  var result = ss_empty_pair();
  let row0 = contact_policy_rows[policy_index * 4u];
  let row1 = contact_policy_rows[policy_index * 4u + 1u];
  let row2 = contact_policy_rows[policy_index * 4u + 2u];
  let row3 = contact_policy_rows[policy_index * 4u + 3u];
  let element_side = ss_policy_element_side(
    row0,
    row2,
    element_material_id,
    element_phase_id
  );
  if (
    element_side == 0u
    || !ss_finite(row1.z)
    || row1.z < 0.0
    || !ss_finite(row3.x)
    || !ss_finite(row3.y)
    || !ss_finite(row3.z)
    || !ss_finite(row3.w)
  ) {
    return result;
  }

  let body_specific = row3.z > 0.5;
  let domain_pair_ready = row3.w > 0.5;
  if (body_specific && !domain_pair_ready) {
    return result;
  }
  let domain_a = select(0u, ss_exact_domain_id(row3.x), domain_pair_ready);
  let domain_b = select(0u, ss_exact_domain_id(row3.y), domain_pair_ready);
  if (domain_pair_ready && (domain_a == 0u || domain_b == 0u)) {
    return result;
  }

  let element_is_a = element_side == 1u;
  let source_material_id = select(row0.y, row0.x, element_is_a);
  let source_phase_id = select(row0.w, row0.z, element_is_a);
  let target_material_id = select(row0.x, row0.y, element_is_a);
  let target_phase_id = select(row0.z, row0.w, element_is_a);
  let source_domain_id = select(domain_b, domain_a, element_is_a);
  let target_domain_id = select(domain_a, domain_b, element_is_a);
  let support_radius_m = max(row1.z, 1.0e-6);
  let search_radius_m = max(
    max(support_radius_m * 2.0, params.max_search_radius_m),
    1.0e-6
  );
  if (!ss_finite(search_radius_m)) {
    return result;
  }
  let search_radius2 = search_radius_m * search_radius_m;
  if (!ss_finite(search_radius2)) {
    return result;
  }
  // The accepted region is a cylinder (independent normal and lateral
  // bounds), so its axis-aligned enclosing radius is sqrt(2) * R.
  let directory_query_radius_m = search_radius_m * 1.4142135623730951;

  var source_first = ss_empty_candidate();
  var source_second = source_first;
  var target_first = source_first;
  var target_second = source_first;

  for (
    var level_ordinal = 0u;
    level_ordinal < params.level_count;
    level_ordinal = level_ordinal + 1u
  ) {
    if (!ss_exact_near_level_occupied(ss_exact_near_expectation(), level_ordinal)) {
      continue;
    }
    let level = params.min_level + i32(level_ordinal);
    let spacing_m = params.base_grid_spacing_m * exp2(f32(level));
    if (!ss_finite(spacing_m) || !(spacing_m > 0.0)) {
      continue;
    }
    let center_cell = vec3<i32>(floor(centroid / spacing_m));
    let radius_cells = max(
      0,
      i32(min(ceil(directory_query_radius_m / spacing_m), 2147483520.0))
    );
    let minimum_cell = vec3<i32>(
      ss_saturating_sub_radius(center_cell.x, radius_cells),
      ss_saturating_sub_radius(center_cell.y, radius_cells),
      ss_saturating_sub_radius(center_cell.z, radius_cells)
    );
    let maximum_cell = vec3<i32>(
      ss_saturating_add_radius(center_cell.x, radius_cells),
      ss_saturating_add_radius(center_cell.y, radius_cells),
      ss_saturating_add_radius(center_cell.z, radius_cells)
    );
    let level_order = ss_signed_order_key(level);
    let minimum_order = vec3<u32>(
      ss_signed_order_key(minimum_cell.x),
      ss_signed_order_key(minimum_cell.y),
      ss_signed_order_key(minimum_cell.z)
    );
    let maximum_order = vec3<u32>(
      ss_signed_order_key(maximum_cell.x),
      ss_signed_order_key(maximum_cell.y),
      ss_signed_order_key(maximum_cell.z)
    );

    // Traverse only occupied lexicographic x/y groups. A dense integer-cell
    // cube is catastrophically large at fine levels even when almost every
    // cell is empty. Binary searches skip directly between occupied prefixes.
    let level_begin = ss_lower_bound_cell_key(
      params.chart_id,
      level_order,
      vec3<u32>(0u)
    );
    let level_end = ss_upper_bound_cell_key(
      params.chart_id,
      level_order,
      vec3<u32>(0xffffffffu)
    );
    if (level_begin >= level_end) {
      continue;
    }
    var x_cursor = ss_lower_bound_cell_key_range(
      params.chart_id,
      level_order,
      vec3<u32>(minimum_order.x, 0u, 0u),
      level_begin,
      level_end
    );
    for (
      var x_iteration = 0u;
      x_iteration < params.particle_count && x_cursor < level_end;
      x_iteration = x_iteration + 1u
    ) {
      let x_order = ss_cell_key_word(x_cursor, 2u);
      if (x_order > maximum_order.x) {
        x_cursor = level_end;
        continue;
      }
      let x_end = ss_upper_bound_cell_key_range(
        params.chart_id,
        level_order,
        vec3<u32>(x_order, 0xffffffffu, 0xffffffffu),
        x_cursor,
        level_end
      );
      // The directory header is authenticated on-device, but a sparse-prefix
      // consumer must still own its termination proof. Fail closed if a torn
      // or backend-miscompiled binary search ever violates strict progress.
      if (x_end <= x_cursor) {
        return ss_invalid_directory_pair();
      }
      var y_cursor = ss_lower_bound_cell_key_range(
        params.chart_id,
        level_order,
        vec3<u32>(x_order, minimum_order.y, 0u),
        x_cursor,
        x_end
      );
      for (
        var y_iteration = 0u;
        y_iteration < params.particle_count && y_cursor < x_end;
        y_iteration = y_iteration + 1u
      ) {
        let y_order = ss_cell_key_word(y_cursor, 3u);
        if (y_order > maximum_order.y) {
          y_cursor = x_end;
          continue;
        }
        let y_end = ss_upper_bound_cell_key_range(
          params.chart_id,
          level_order,
          vec3<u32>(x_order, y_order, 0xffffffffu),
          y_cursor,
          x_end
        );
        if (y_end <= y_cursor) {
          return ss_invalid_directory_pair();
        }
        let z_begin = ss_lower_bound_cell_key_range(
          params.chart_id,
          level_order,
          vec3<u32>(x_order, y_order, minimum_order.z),
          y_cursor,
          y_end
        );
        let z_end = ss_upper_bound_cell_key_range(
          params.chart_id,
          level_order,
          vec3<u32>(x_order, y_order, maximum_order.z),
          z_begin,
          y_end
        );
        for (
          var cell_index = z_begin;
          cell_index < z_end;
          cell_index = cell_index + 1u
        ) {
          let member_range = ss_exact_near_cell_member_range(
            ss_exact_near_expectation(),
            cell_index
          );
          if (member_range.admitted == 0u) {
            return ss_invalid_directory_pair();
          }
          for (
            var member_offset = member_range.begin;
            member_offset < member_range.end;
            member_offset = member_offset + 1u
          ) {
            let source_lookup = ss_exact_near_source_at_member(
              ss_exact_near_expectation(),
              member_offset
            );
            if (source_lookup.admitted == 0u) {
              return ss_invalid_directory_pair();
            }
            let particle_index = source_lookup.source_index;
            let candidate = ss_candidate_for_particle(
              particle_index,
              centroid,
              normal,
              search_radius_m,
              search_radius2
            );
            if (ss_candidate_matches_endpoint(
              candidate,
              source_material_id,
              source_phase_id,
              source_domain_id
            )) {
              let scored = ss_score_candidate(
                candidate,
                0u,
                support_radius_m,
                search_radius2
              );
              if (ss_candidate_better(scored, source_first)) {
                if (source_first.particle_index != scored.particle_index) {
                  source_second = source_first;
                }
                source_first = scored;
              } else if (
                scored.particle_index != source_first.particle_index
                && ss_candidate_better(scored, source_second)
              ) {
                source_second = scored;
              }
            }
            if (ss_candidate_matches_endpoint(
              candidate,
              target_material_id,
              target_phase_id,
              target_domain_id
            )) {
              let scored = ss_score_candidate(
                candidate,
                1u,
                support_radius_m,
                search_radius2
              );
              if (ss_candidate_better(scored, target_first)) {
                if (target_first.particle_index != scored.particle_index) {
                  target_second = target_first;
                }
                target_first = scored;
              } else if (
                scored.particle_index != target_first.particle_index
                && ss_candidate_better(scored, target_second)
              ) {
                target_second = scored;
              }
            }
          }
        }
        y_cursor = y_end;
      }
      if (y_cursor < x_end) {
        return ss_invalid_directory_pair();
      }
      x_cursor = x_end;
    }
    if (x_cursor < level_end) {
      return ss_invalid_directory_pair();
    }
  }

  var candidate_pair = ss_pair_from_candidates(
    source_first,
    target_first,
    policy_index
  );
  if (ss_pair_better(candidate_pair, result)) {
    result = candidate_pair;
  }
  candidate_pair = ss_pair_from_candidates(
    source_first,
    target_second,
    policy_index
  );
  if (ss_pair_better(candidate_pair, result)) {
    result = candidate_pair;
  }
  candidate_pair = ss_pair_from_candidates(
    source_second,
    target_first,
    policy_index
  );
  if (ss_pair_better(candidate_pair, result)) {
    result = candidate_pair;
  }
  candidate_pair = ss_pair_from_candidates(
    source_second,
    target_second,
    policy_index
  );
  if (ss_pair_better(candidate_pair, result)) {
    result = candidate_pair;
  }
  return result;
}

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let element_index = global_id.x;
  if (element_index >= params.element_count) {
    return;
  }
  contact_kinematics_rows[element_index * 2u] = vec4<f32>(0.0);
  contact_kinematics_rows[element_index * 2u + 1u] = vec4<f32>(0.0);
  if (
    params.particle_count == 0u
    || params.contact_policy_row_count == 0u
    || params.level_count == 0u
    || !ss_finite(params.base_grid_spacing_m)
    || params.base_grid_spacing_m <= 0.0
    || !ss_finite(params.max_search_radius_m)
    || params.max_search_radius_m < 0.0
    || !ss_finite(params.gap_floor_m)
    || params.gap_floor_m < 0.0
    || !ss_directory_ready()
  ) {
    return;
  }

  let element_row0 = interface_elements[element_index * 4u];
  let element_row1 = interface_elements[element_index * 4u + 1u];
  let element_row2 = interface_elements[element_index * 4u + 2u];
  let element_row3 = interface_elements[element_index * 4u + 3u];
  let element_material_id = element_row0.y;
  let element_phase_id = element_row0.z;
  let centroid = element_row1.xyz;
  let area_m2 = element_row1.w;
  if (
    !ss_finite(element_material_id)
    || !ss_finite(element_phase_id)
    || !ss_finite3(centroid)
    || !ss_finite(area_m2)
    || area_m2 <= 0.0
    || !ss_finite3(element_row2.xyz)
    || !ss_finite(element_row2.w)
    || !ss_finite(element_row3.x)
    || !ss_finite(element_row3.y)
    || !ss_finite(element_row3.w)
    || element_row3.w <= 0.0
  ) {
    return;
  }

  let normal = ss_normal_from_element(element_row2, element_row3);
  if (!ss_finite3(normal)) {
    return;
  }
  var best_pair = ss_empty_pair();
  for (
    var policy_index = 0u;
    policy_index < params.contact_policy_row_count;
    policy_index = policy_index + 1u
  ) {
    let pair = ss_pair_for_policy(
      policy_index,
      element_material_id,
      element_phase_id,
      centroid,
      normal
    );
    if (pair.directory_valid == 0u) {
      return;
    }
    if (ss_pair_better(pair, best_pair)) {
      best_pair = pair;
    }
  }
  if (best_pair.ready == 0u) {
    return;
  }

  let signed_span_m = best_pair.target_signed_m - best_pair.source_signed_m;
  let direction_sign = select(-1.0, 1.0, signed_span_m >= 0.0);
  let gap_m = max(abs(signed_span_m), params.gap_floor_m);
  let relative_normal_velocity_m_per_s = dot(
    best_pair.target_velocity - best_pair.source_velocity,
    normal * direction_sign
  );
  var representative_mass_kg = 0.0;
  if (best_pair.source_mass_kg > 0.0 && best_pair.target_mass_kg > 0.0) {
    representative_mass_kg = (best_pair.source_mass_kg * best_pair.target_mass_kg)
      / max(best_pair.source_mass_kg + best_pair.target_mass_kg, 1.0e-12);
  }
  let source_domain_id = best_pair.source_domain_id;
  let target_domain_id = best_pair.target_domain_id;
  let domain_pair_ready = source_domain_id > 0u && target_domain_id > 0u;
  contact_kinematics_rows[element_index * 2u] = vec4<f32>(
    gap_m,
    relative_normal_velocity_m_per_s,
    representative_mass_kg,
    2.0
  );
  contact_kinematics_rows[element_index * 2u + 1u] = vec4<f32>(
    f32(source_domain_id),
    f32(target_domain_id),
    select(0.0, 1.0, domain_pair_ready),
    f32(best_pair.policy_index + 1u)
  );
}
`;
