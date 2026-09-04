import{A as e,Cn as t,Sn as n,Tn as r,u as i,wn as a}from"./schroederSpatialEpochGpu-9YQHRmR5.js";var o=Object.defineProperty,s=(e,t)=>{let n={};for(var r in e)o(n,r,{get:e[r],enumerable:!0});return t||o(n,Symbol.toStringTag,{value:`Module`}),n};Uint32Array.from([1116352408,1899447441,3049323471,3921009573,961987163,1508970993,2453635748,2870763221,3624381080,310598401,607225278,1426881987,1925078388,2162078206,2614888103,3248222580,3835390401,4022224774,264347078,604807628,770255983,1249150122,1555081692,1996064986,2554220882,2821834349,2952996808,3210313671,3336571891,3584528711,113926993,338241895,666307205,773529912,1294757372,1396182291,1695183700,1986661051,2177026350,2456956037,2730485921,2820302411,3259730800,3345764771,3516065817,3600352804,4094571909,275423344,430227734,506948616,659060556,883997877,958139571,1322822218,1537002063,1747873779,1955562222,2024104815,2227730452,2361852424,2428436474,2756734187,3204031479,3329325298]);const c=1e-6,l=1071494104;Object.freeze({revision:`canonical-contact-epoch-trust-wall-shell-v1`,positionTrustDiameters:16,positionToleranceAbsoluteM:c,positionToleranceEpsilonMultiplier:64,wallShellEuclideanUpperF32Bits:l});const u=new Float32Array(1),d=new Uint32Array(u.buffer);d[0]=2139095039,u[0];const f=`
const REACTION_MOTION_F32_MAX_BITS: u32 = 0x7f7fffffu;
const REACTION_MOTION_UPWARD_ULPS: u32 = 64u;
const REACTION_MOTION_ROUNDING_PER_SUBSTEP: f32 = 0.000003814697265625;
const REACTION_MOTION_F32_EPSILON: f32 = 1.1920928955078125e-7;
const REACTION_MOTION_CONTACT_TRUST_DIAMETERS: f32 =
  16.0;
const REACTION_MOTION_CONTACT_TOLERANCE_ABSOLUTE_M: f32 =
  ${c};
const REACTION_MOTION_CONTACT_TOLERANCE_EPSILON_MULTIPLIER: f32 =
  64.0;
const REACTION_MOTION_SQRT_THREE_UPPER: f32 = bitcast<f32>(
  ${l}u
);

fn reaction_motion_finite(value: f32) -> bool {
  // Reserve the largest finite f32 bit pattern as an in-band arithmetic
  // failure marker. WGSL validation rejects a constant-expression infinity,
  // while this value is portable and every watch treats it as non-finite.
  return (bitcast<u32>(value) & 0x7fffffffu)
    < REACTION_MOTION_F32_MAX_BITS;
}

fn reaction_motion_vec4_finite(value: vec4<f32>) -> bool {
  return all(vec4<bool>(
    reaction_motion_finite(value.x),
    reaction_motion_finite(value.y),
    reaction_motion_finite(value.z),
    reaction_motion_finite(value.w)
  ));
}

fn reaction_motion_upward(value: f32) -> f32 {
  if (!(value > 0.0) || !reaction_motion_finite(value)) {
    return value;
  }
  let bits = bitcast<u32>(value);
  if (bits > REACTION_MOTION_F32_MAX_BITS - REACTION_MOTION_UPWARD_ULPS) {
    return bitcast<f32>(REACTION_MOTION_F32_MAX_BITS);
  }
  return bitcast<f32>(bits + REACTION_MOTION_UPWARD_ULPS);
}

fn reaction_motion_ceil_div_3(value: i32) -> i32 {
  if (value >= 0) {
    return (value + 2) / 3;
  }
  return -((-value) / 3);
}

fn reaction_motion_rest_diameter_upper(rest_volume_m3: f32) -> f32 {
  if (!(rest_volume_m3 > 0.0) || !reaction_motion_finite(rest_volume_m3)) {
    return 0.0;
  }
  // The mechanics separation kernel evaluates cbrt(max(V, 1e-18)). For a
  // positive normal f32 with unbiased exponent e, V < 2^(e+1), hence
  // cbrt(V) < 2^ceil((e+1)/3). Constructing that power directly avoids an
  // implementation-dependent pow underestimate in the safety envelope.
  // max(V, 1e-18) is normal, so no subnormal exponent branch is required.
  let bounded_volume = max(rest_volume_m3, 1.0e-18);
  let volume_bits = bitcast<u32>(bounded_volume);
  let unbiased_exponent = i32((volume_bits >> 23u) & 0xffu) - 127;
  let upper_exponent = reaction_motion_ceil_div_3(unbiased_exponent + 1);
  let upper_exponent_bits = u32(upper_exponent + 127) << 23u;
  return reaction_motion_upward(bitcast<f32>(upper_exponent_bits));
}

fn reaction_motion_box_dims_admitted(box_dims_m: vec3<f32>) -> bool {
  return all(vec3<bool>(
    reaction_motion_finite(box_dims_m.x) && box_dims_m.x > 0.0,
    reaction_motion_finite(box_dims_m.y) && box_dims_m.y > 0.0,
    reaction_motion_finite(box_dims_m.z) && box_dims_m.z > 0.0
  ));
}

fn reaction_motion_position_inside_box(
  position_m: vec3<f32>,
  box_dims_m: vec3<f32>
) -> bool {
  return reaction_motion_box_dims_admitted(box_dims_m)
    && all(position_m >= vec3<f32>(0.0))
    && all(position_m <= box_dims_m);
}

fn reaction_motion_wall_shell_transition_upper(
  grid_spacing_m: f32,
  box_dims_m: vec3<f32>
) -> f32 {
  let minimum_box_dimension_m = min(
    box_dims_m.x,
    min(box_dims_m.y, box_dims_m.z)
  );
  let grid_clearance_upper_m = reaction_motion_upward(
    0.5 * reaction_motion_upward(grid_spacing_m)
  );
  let box_clearance_upper_m = reaction_motion_upward(
    0.49 * reaction_motion_upward(minimum_box_dimension_m)
  );
  let axis_shell_upper_m = min(
    grid_clearance_upper_m,
    box_clearance_upper_m
  );
  return reaction_motion_upward(
    REACTION_MOTION_SQRT_THREE_UPPER * axis_shell_upper_m
  );
}

fn reaction_motion_position_store_rounding_upper(
  max_abs_position_m: f32,
  maximum_contact_radius_m: f32,
  physical_relative_reach_m: f32,
  max_future_substeps: u32
) -> f32 {
  let position_scale_m = reaction_motion_upward(
    reaction_motion_upward(max_abs_position_m)
      + reaction_motion_upward(maximum_contact_radius_m)
      + reaction_motion_upward(physical_relative_reach_m)
  );
  if (!(position_scale_m > 0.0) || !reaction_motion_finite(position_scale_m)) {
    return bitcast<f32>(REACTION_MOTION_F32_MAX_BITS);
  }
  let scale_bits = bitcast<u32>(position_scale_m);
  let exponent_bits = (scale_bits >> 23u) & 0xffu;
  // One exact power-of-two quantum at eight f32 ULPs of the enclosing
  // coordinate binade covers both 3-D endpoints, their store additions, and
  // the later distance arithmetic. Clamp tiny coordinates to the minimum
  // normal quantum; this is deliberately loose and remains finite.
  var rounding_quantum_m = bitcast<f32>(0x00800000u);
  if (exponent_bits > 20u) {
    rounding_quantum_m = bitcast<f32>((exponent_bits - 20u) << 23u);
  }
  return reaction_motion_upward(
    reaction_motion_upward(f32(max_future_substeps))
      * rounding_quantum_m
  );
}

fn reaction_motion_relative_reach_upper(
  max_future_substeps: u32,
  cfl_factor: f32,
  grid_spacing_m: f32,
  max_rest_diameter_m: f32,
  separation_enabled: bool,
  contact_correction_enabled: bool,
  box_dims_m: vec3<f32>,
  max_abs_position_m: f32,
  maximum_contact_radius_m: f32
) -> f32 {
  let advective_one_particle = reaction_motion_upward(
    reaction_motion_upward(cfl_factor) * reaction_motion_upward(grid_spacing_m)
  );
  let wall_shell_transition_m = reaction_motion_wall_shell_transition_upper(
    grid_spacing_m,
    box_dims_m
  );
  let g2p_one_particle = reaction_motion_upward(
    advective_one_particle + wall_shell_transition_m
  );
  let separation_one_particle = reaction_motion_upward(
    reaction_motion_upward(
      g2p_one_particle
        + reaction_motion_upward(0.5 * max_rest_diameter_m)
    ) + wall_shell_transition_m
  );
  let contact_trust_without_tolerance = reaction_motion_upward(
    reaction_motion_upward(
      REACTION_MOTION_CONTACT_TRUST_DIAMETERS * max_rest_diameter_m
    ) + reaction_motion_upward(
      2.0 * advective_one_particle
    ) + reaction_motion_upward(
      3.0 * wall_shell_transition_m
    )
  );
  let contact_tolerance_m = reaction_motion_upward(max(
    REACTION_MOTION_CONTACT_TOLERANCE_ABSOLUTE_M,
    reaction_motion_upward(
      REACTION_MOTION_CONTACT_TOLERANCE_EPSILON_MULTIPLIER
        * REACTION_MOTION_F32_EPSILON
        * max(contact_trust_without_tolerance, 1.0)
    )
  ));
  let contact_one_particle = reaction_motion_upward(
    contact_trust_without_tolerance + contact_tolerance_m
  );
  let one_particle_per_substep = max(
    g2p_one_particle,
    max(
      select(g2p_one_particle, separation_one_particle, separation_enabled),
      select(
        g2p_one_particle,
        contact_one_particle,
        contact_correction_enabled
      )
    )
  );
  let raw_relative = reaction_motion_upward(
    reaction_motion_upward(2.0 * f32(max_future_substeps))
      * one_particle_per_substep
  );
  let accumulated_rounding = reaction_motion_upward(
    1.0 + f32(max_future_substeps)
      * REACTION_MOTION_ROUNDING_PER_SUBSTEP
  );
  let physical_relative_reach = reaction_motion_upward(
    raw_relative * accumulated_rounding
  );
  let position_store_rounding = reaction_motion_position_store_rounding_upper(
    max_abs_position_m,
    maximum_contact_radius_m,
    physical_relative_reach,
    max_future_substeps
  );
  return reaction_motion_upward(
    physical_relative_reach + position_store_rounding
  );
}
`;Object.freeze([`partnerParticleIndex:f32`,`reactionIndex:f32`,`reactantRole:f32`,`distanceSquaredM2:f32`]),Object.freeze(`sourceDispatchCount:u32.directoryAdmissionCount:u32.directoryRejectionCount:u32.candidateVisitCount:u32.compatiblePairCount:u32.malformedTraversalCount:u32.proposalCount:u32.sealedRowCount:u32.sourceIdentityRejectionCount:u32.supportProfileId:u32.generationId:u32.supportEpoch:u32.particleCount:u32.reactionCount:u32.privateLookupBuildCount:u32.overflowCount:u32.ruleIndexPairLookupCount:u32.ruleIndexPairMissCount:u32.ruleIndexRuleVisitCount:u32.fullRuleScanRuleVisitCount:u32.maximumDisplacementBits:u32.displacementCertificateStatusBits:u32.authorityActiveCount:u32.currentActiveCount:u32.exactCellTreeNodeVisitCount:u32.exactCellTreeLeafVisitCount:u32.exactCellTreeMemberVisitCount:u32`.split(`.`)),Uint32Array.BYTES_PER_ELEMENT,4*Uint32Array.BYTES_PER_ELEMENT,globalThis.GPUBufferUsage?.MAP_READ,globalThis.GPUBufferUsage?.COPY_SRC,globalThis.GPUBufferUsage?.COPY_DST,globalThis.GPUBufferUsage?.STORAGE,globalThis.GPUBufferUsage?.UNIFORM,globalThis.GPUMapMode?.READ;function p(e){let i=e===2;if(!i&&e!==1)throw RangeError(`unsupported reaction discovery directory ABI version: ${e}`);let o=(i?r:a)({directoryBindingName:`spatial_directory`}),s=(i?t:n)({treeBindingName:`exact_near_cell_tree`,directoryBindingName:`spatial_directory`});return`
struct ReactionDiscoveryParams {
  particle_count: u32,
  reaction_count: u32,
  reaction_record_stride_vec4s: u32,
  support_profile_id: u32,
  maximum_contact_radius_m: f32,
  active_node_stride_floats: u32,
  thermo_stride_vec4s: u32,
  state_stride_vec4s: u32,
  reaction_rule_index_mode: u32,
  reaction_rule_index_pair_offset_vec4s: u32,
  reaction_rule_index_pair_count: u32,
  reaction_rule_index_rule_offset_vec4s: u32,
  reaction_rule_index_rule_count: u32,
  reaction_rule_index_record_vec4_count: u32,
  collect_diagnostic_evidence: u32,
  activation_thermal_phase_evolution_enabled: u32,
  activation_max_future_substeps: u32,
  activation_separation_enabled: u32,
  activation_cfl_factor: f32,
  activation_grid_spacing_m: f32,
  activation_box_dim_x_m: f32,
  activation_box_dim_y_m: f32,
  activation_box_dim_z_m: f32,
  activation_contact_correction_enabled: u32,
};

@group(0) @binding(0) var<storage, read> source_state_authority: array<vec4<f32>>;
@group(0) @binding(1) var<storage, read> source_thermo: array<vec4<f32>>;
@group(0) @binding(2) var<storage, read> source_state: array<vec4<f32>>;
@group(0) @binding(3) var<storage, read> reaction_records: array<vec4<f32>>;
@group(0) @binding(4) var<storage, read> spatial_directory: array<u32>;
@group(0) @binding(5) var<storage, read> exact_near_cell_tree: array<u32>;
@group(0) @binding(6) var<storage, read_write> reaction_proposals: array<vec4<f32>>;
@group(0) @binding(7) var<storage, read_write> traversal_evidence: array<atomic<u32>>;
@group(0) @binding(8) var<uniform> spatial_expectation: ${i?`SchroederSpatialExactNearExpectationV2`:`SchroederSpatialExactNearExpectationV1`};
@group(0) @binding(9) var<uniform> params: ReactionDiscoveryParams;
@group(0) @binding(10) var<storage, read_write> reaction_activation_observation: array<atomic<u32>>;

${o}
${s}
${f}

const REACTION_DISCOVERY_INVALID_INDEX: f32 = -1.0;
const REACTION_DISCOVERY_MAX_F32: f32 = 3.402823e38;
const REACTION_DISCOVERY_CERTIFICATE_READY_BITS: u32 = 0x3f800000u;
const REACTION_DISCOVERY_CERTIFICATE_REJECTED_BITS: u32 = 0x40000000u;
const REACTION_DISCOVERY_RULE_INDEX_MODE_FULL_SCAN: u32 = 0u;
const REACTION_DISCOVERY_RULE_INDEX_MODE_MATERIAL_PAIR: u32 = 1u;
const REACTION_DISCOVERY_RULE_INDEX_RULES_PER_VEC4: u32 = 4u;
const REACTION_DISCOVERY_EVIDENCE_OVERFLOW: u32 = 15u;
const REACTION_DISCOVERY_EVIDENCE_RULE_INDEX_PAIR_LOOKUPS: u32 = 16u;
const REACTION_DISCOVERY_EVIDENCE_RULE_INDEX_PAIR_MISSES: u32 = 17u;
const REACTION_DISCOVERY_EVIDENCE_RULE_INDEX_RULE_VISITS: u32 = 18u;
const REACTION_DISCOVERY_EVIDENCE_FULL_RULE_SCAN_VISITS: u32 = 19u;
const REACTION_DISCOVERY_EVIDENCE_MAXIMUM_DISPLACEMENT_BITS: u32 = 20u;
const REACTION_DISCOVERY_EVIDENCE_CERTIFICATE_STATUS_BITS: u32 = 21u;
const REACTION_DISCOVERY_EVIDENCE_AUTHORITY_ACTIVE_COUNT: u32 = 22u;
const REACTION_DISCOVERY_EVIDENCE_CURRENT_ACTIVE_COUNT: u32 = 23u;
const REACTION_DISCOVERY_EVIDENCE_TREE_NODE_VISITS: u32 = 24u;
const REACTION_DISCOVERY_EVIDENCE_TREE_LEAF_VISITS: u32 = 25u;
const REACTION_DISCOVERY_EVIDENCE_TREE_MEMBER_VISITS: u32 = 26u;
const REACTION_ACTIVATION_OBSERVATION_ENCODED_FAILURE: u32 = 0u;
const REACTION_ACTIVATION_OBSERVATION_COUNT_BIAS: u32 = 1u;
const REACTION_ACTIVATION_RESULT_WORD: u32 = 0u;
const REACTION_ACTIVATION_TRIGGERED_SOURCE_COUNT_WORD: u32 = 1u;
const REACTION_ACTIVATION_MAX_REST_DIAMETER_BITS_WORD: u32 = 2u;
const REACTION_ACTIVATION_FAILURE_WORD: u32 = 3u;

fn reaction_discovery_invalid_proposal() -> vec4<f32> {
  return vec4<f32>(
    REACTION_DISCOVERY_INVALID_INDEX,
    REACTION_DISCOVERY_INVALID_INDEX,
    0.0,
    REACTION_DISCOVERY_MAX_F32
  );
}

// This is the immediate path for completion and fail-closed counters. The
// candidate/tree diagnostics below are deliberately the only batched fields.
fn reaction_discovery_increment_control_counter(counter_index: u32) {
  let previous = atomicAdd(&traversal_evidence[counter_index], 1u);
  if (previous == 0xffffffffu) {
    atomicStore(&traversal_evidence[REACTION_DISCOVERY_EVIDENCE_OVERFLOW], 1u);
  }
}

// S9D_HOT_COUNTER_AGGREGATION_BEGIN
// These are invocation-private accumulators. They are observable only when
// requested, and never participate in traversal, rule selection, or sealing
// except to fail closed on an arithmetic overflow.
var<private> reaction_discovery_hot_candidate_visits: u32;
var<private> reaction_discovery_hot_compatible_pairs: u32;
var<private> reaction_discovery_hot_rule_index_pair_lookups: u32;
var<private> reaction_discovery_hot_rule_index_pair_misses: u32;
var<private> reaction_discovery_hot_rule_index_rule_visits: u32;
var<private> reaction_discovery_hot_full_rule_scan_visits: u32;
var<private> reaction_discovery_hot_tree_node_visits: u32;
var<private> reaction_discovery_hot_tree_leaf_visits: u32;
var<private> reaction_discovery_hot_tree_member_visits: u32;
var<private> reaction_discovery_hot_counter_overflow: u32;

fn reaction_discovery_reset_hot_counters() {
  reaction_discovery_hot_candidate_visits = 0u;
  reaction_discovery_hot_compatible_pairs = 0u;
  reaction_discovery_hot_rule_index_pair_lookups = 0u;
  reaction_discovery_hot_rule_index_pair_misses = 0u;
  reaction_discovery_hot_rule_index_rule_visits = 0u;
  reaction_discovery_hot_full_rule_scan_visits = 0u;
  reaction_discovery_hot_tree_node_visits = 0u;
  reaction_discovery_hot_tree_leaf_visits = 0u;
  reaction_discovery_hot_tree_member_visits = 0u;
  reaction_discovery_hot_counter_overflow = 0u;
}

fn reaction_discovery_increment_hot_counter(counter_index: u32) {
  if (
    params.collect_diagnostic_evidence == 0u
    || reaction_discovery_hot_counter_overflow != 0u
  ) {
    return;
  }
  switch (counter_index) {
    case 3u: {
      if (reaction_discovery_hot_candidate_visits == 0xffffffffu) {
        reaction_discovery_hot_counter_overflow = 1u;
      } else {
        reaction_discovery_hot_candidate_visits =
          reaction_discovery_hot_candidate_visits + 1u;
      }
    }
    case 4u: {
      if (reaction_discovery_hot_compatible_pairs == 0xffffffffu) {
        reaction_discovery_hot_counter_overflow = 1u;
      } else {
        reaction_discovery_hot_compatible_pairs =
          reaction_discovery_hot_compatible_pairs + 1u;
      }
    }
    case REACTION_DISCOVERY_EVIDENCE_RULE_INDEX_PAIR_LOOKUPS: {
      if (reaction_discovery_hot_rule_index_pair_lookups == 0xffffffffu) {
        reaction_discovery_hot_counter_overflow = 1u;
      } else {
        reaction_discovery_hot_rule_index_pair_lookups =
          reaction_discovery_hot_rule_index_pair_lookups + 1u;
      }
    }
    case REACTION_DISCOVERY_EVIDENCE_RULE_INDEX_PAIR_MISSES: {
      if (reaction_discovery_hot_rule_index_pair_misses == 0xffffffffu) {
        reaction_discovery_hot_counter_overflow = 1u;
      } else {
        reaction_discovery_hot_rule_index_pair_misses =
          reaction_discovery_hot_rule_index_pair_misses + 1u;
      }
    }
    case REACTION_DISCOVERY_EVIDENCE_RULE_INDEX_RULE_VISITS: {
      if (reaction_discovery_hot_rule_index_rule_visits == 0xffffffffu) {
        reaction_discovery_hot_counter_overflow = 1u;
      } else {
        reaction_discovery_hot_rule_index_rule_visits =
          reaction_discovery_hot_rule_index_rule_visits + 1u;
      }
    }
    case REACTION_DISCOVERY_EVIDENCE_FULL_RULE_SCAN_VISITS: {
      if (reaction_discovery_hot_full_rule_scan_visits == 0xffffffffu) {
        reaction_discovery_hot_counter_overflow = 1u;
      } else {
        reaction_discovery_hot_full_rule_scan_visits =
          reaction_discovery_hot_full_rule_scan_visits + 1u;
      }
    }
    case REACTION_DISCOVERY_EVIDENCE_TREE_NODE_VISITS: {
      if (reaction_discovery_hot_tree_node_visits == 0xffffffffu) {
        reaction_discovery_hot_counter_overflow = 1u;
      } else {
        reaction_discovery_hot_tree_node_visits =
          reaction_discovery_hot_tree_node_visits + 1u;
      }
    }
    case REACTION_DISCOVERY_EVIDENCE_TREE_LEAF_VISITS: {
      if (reaction_discovery_hot_tree_leaf_visits == 0xffffffffu) {
        reaction_discovery_hot_counter_overflow = 1u;
      } else {
        reaction_discovery_hot_tree_leaf_visits =
          reaction_discovery_hot_tree_leaf_visits + 1u;
      }
    }
    case REACTION_DISCOVERY_EVIDENCE_TREE_MEMBER_VISITS: {
      if (reaction_discovery_hot_tree_member_visits == 0xffffffffu) {
        reaction_discovery_hot_counter_overflow = 1u;
      } else {
        reaction_discovery_hot_tree_member_visits =
          reaction_discovery_hot_tree_member_visits + 1u;
      }
    }
    default: {}
  }
}

fn reaction_discovery_flush_hot_counter(counter_index: u32, count: u32) -> bool {
  if (count == 0u) {
    return true;
  }
  let previous = atomicAdd(&traversal_evidence[counter_index], count);
  return previous <= 0xffffffffu - count;
}

fn reaction_discovery_flush_hot_counters() -> bool {
  if (params.collect_diagnostic_evidence == 0u) {
    return true;
  }
  let candidate_visits_admitted = reaction_discovery_flush_hot_counter(
    3u,
    reaction_discovery_hot_candidate_visits
  );
  let compatible_pairs_admitted = reaction_discovery_flush_hot_counter(
    4u,
    reaction_discovery_hot_compatible_pairs
  );
  let pair_lookups_admitted = reaction_discovery_flush_hot_counter(
    REACTION_DISCOVERY_EVIDENCE_RULE_INDEX_PAIR_LOOKUPS,
    reaction_discovery_hot_rule_index_pair_lookups
  );
  let pair_misses_admitted = reaction_discovery_flush_hot_counter(
    REACTION_DISCOVERY_EVIDENCE_RULE_INDEX_PAIR_MISSES,
    reaction_discovery_hot_rule_index_pair_misses
  );
  let rule_visits_admitted = reaction_discovery_flush_hot_counter(
    REACTION_DISCOVERY_EVIDENCE_RULE_INDEX_RULE_VISITS,
    reaction_discovery_hot_rule_index_rule_visits
  );
  let full_scan_visits_admitted = reaction_discovery_flush_hot_counter(
    REACTION_DISCOVERY_EVIDENCE_FULL_RULE_SCAN_VISITS,
    reaction_discovery_hot_full_rule_scan_visits
  );
  let tree_node_visits_admitted = reaction_discovery_flush_hot_counter(
    REACTION_DISCOVERY_EVIDENCE_TREE_NODE_VISITS,
    reaction_discovery_hot_tree_node_visits
  );
  let tree_leaf_visits_admitted = reaction_discovery_flush_hot_counter(
    REACTION_DISCOVERY_EVIDENCE_TREE_LEAF_VISITS,
    reaction_discovery_hot_tree_leaf_visits
  );
  let tree_member_visits_admitted = reaction_discovery_flush_hot_counter(
    REACTION_DISCOVERY_EVIDENCE_TREE_MEMBER_VISITS,
    reaction_discovery_hot_tree_member_visits
  );
  if (
    reaction_discovery_hot_counter_overflow != 0u
    || !candidate_visits_admitted
    || !compatible_pairs_admitted
    || !pair_lookups_admitted
    || !pair_misses_admitted
    || !rule_visits_admitted
    || !full_scan_visits_admitted
    || !tree_node_visits_admitted
    || !tree_leaf_visits_admitted
    || !tree_member_visits_admitted
  ) {
    atomicStore(&traversal_evidence[REACTION_DISCOVERY_EVIDENCE_OVERFLOW], 1u);
    return false;
  }
  return true;
}

fn reaction_discovery_increment_counter(counter_index: u32) {
  if (
    counter_index == 3u
    || counter_index == 4u
    || counter_index == REACTION_DISCOVERY_EVIDENCE_RULE_INDEX_PAIR_LOOKUPS
    || counter_index == REACTION_DISCOVERY_EVIDENCE_RULE_INDEX_PAIR_MISSES
    || counter_index == REACTION_DISCOVERY_EVIDENCE_RULE_INDEX_RULE_VISITS
    || counter_index == REACTION_DISCOVERY_EVIDENCE_FULL_RULE_SCAN_VISITS
    || counter_index == REACTION_DISCOVERY_EVIDENCE_TREE_NODE_VISITS
    || counter_index == REACTION_DISCOVERY_EVIDENCE_TREE_LEAF_VISITS
    || counter_index == REACTION_DISCOVERY_EVIDENCE_TREE_MEMBER_VISITS
  ) {
    reaction_discovery_increment_hot_counter(counter_index);
    return;
  }
  reaction_discovery_increment_control_counter(counter_index);
}
// S9D_HOT_COUNTER_AGGREGATION_END

fn reaction_discovery_source_row_admitted(source_index: u32) -> bool {
  let offset = source_index * params.state_stride_vec4s;
  if (
    offset >= arrayLength(&source_state_authority)
    || offset >= arrayLength(&source_state)
  ) {
    return false;
  }
  let authority_position_mass = source_state_authority[offset];
  let current_position_mass = source_state[offset];
  return all(vec3<bool>(
      ss_exact_near_finite(authority_position_mass.x),
      ss_exact_near_finite(authority_position_mass.y),
      ss_exact_near_finite(authority_position_mass.z)
    ))
    && all(vec3<bool>(
      ss_exact_near_finite(current_position_mass.x),
      ss_exact_near_finite(current_position_mass.y),
      ss_exact_near_finite(current_position_mass.z)
    ))
    && ss_exact_near_finite(authority_position_mass.w)
    && ss_exact_near_finite(current_position_mass.w);
}

fn reaction_discovery_position(source_index: u32) -> vec3<f32> {
  return source_state[source_index * params.state_stride_vec4s].xyz;
}

fn reaction_discovery_thermo0(source_index: u32) -> vec4<f32> {
  return source_thermo[source_index * params.thermo_stride_vec4s];
}

fn reaction_discovery_mass(source_index: u32) -> f32 {
  return source_state[source_index * params.state_stride_vec4s].w;
}

fn reaction_discovery_phase_mask_satisfied(mask_f: f32, phase_id_f: f32) -> bool {
  if (
    !ss_exact_near_finite(mask_f)
    || !ss_exact_near_finite(phase_id_f)
    || mask_f < 0.0
    || phase_id_f < 0.0
  ) {
    return false;
  }
  let mask = u32(mask_f + 0.5);
  if (mask == 0u) {
    return true;
  }
  let phase_id = u32(phase_id_f + 0.5);
  return phase_id < 31u && (mask & (1u << phase_id)) != 0u;
}

// One invocation authenticates one source row. Non-negative finite f32 bit
// patterns preserve numeric order as u32, so atomicMax is an exact parallel
// reduction for the maximum displacement. Dispatch ordering makes the sealed
// certificate visible to the traversal without a host fence or readback.
@compute @workgroup_size(64)
fn prepare_displacement_certificate(
  @builtin(global_invocation_id) global_id: vec3<u32>
) {
  let source_index = global_id.x;
  if (
    source_index >= params.particle_count
    || arrayLength(&traversal_evidence)
      < REACTION_DISCOVERY_EVIDENCE_TREE_MEMBER_VISITS + 1u
  ) {
    return;
  }
  if (!reaction_discovery_source_row_admitted(source_index)) {
    atomicStore(
      &traversal_evidence[REACTION_DISCOVERY_EVIDENCE_CERTIFICATE_STATUS_BITS],
      REACTION_DISCOVERY_CERTIFICATE_REJECTED_BITS
    );
    return;
  }
  let offset = source_index * params.state_stride_vec4s;
  let authority_position_mass = source_state_authority[offset];
  let current_position_mass = source_state[offset];
  let source_active = authority_position_mass.w > 0.0;
  let current_active = current_position_mass.w > 0.0;
  atomicAdd(
    &traversal_evidence[REACTION_DISCOVERY_EVIDENCE_AUTHORITY_ACTIVE_COUNT],
    select(0u, 1u, source_active)
  );
  atomicAdd(
    &traversal_evidence[REACTION_DISCOVERY_EVIDENCE_CURRENT_ACTIVE_COUNT],
    select(0u, 1u, current_active)
  );
  if (source_active != current_active) {
    atomicStore(
      &traversal_evidence[REACTION_DISCOVERY_EVIDENCE_CERTIFICATE_STATUS_BITS],
      REACTION_DISCOVERY_CERTIFICATE_REJECTED_BITS
    );
    return;
  }
  if (!source_active) {
    return;
  }
  let displacement_m = length(
    current_position_mass.xyz - authority_position_mass.xyz
  );
  if (!ss_exact_near_finite(displacement_m) || displacement_m < 0.0) {
    atomicStore(
      &traversal_evidence[REACTION_DISCOVERY_EVIDENCE_CERTIFICATE_STATUS_BITS],
      REACTION_DISCOVERY_CERTIFICATE_REJECTED_BITS
    );
    return;
  }
  atomicMax(
    &traversal_evidence[REACTION_DISCOVERY_EVIDENCE_MAXIMUM_DISPLACEMENT_BITS],
    bitcast<u32>(displacement_m)
  );
}

struct ReactionRuleIndexInteger {
  admitted: u32,
  value: u32,
};

struct ReactionRuleIndexLookup {
  indexed: u32,
  found: u32,
  rule_begin: u32,
  rule_count: u32,
};

fn reaction_discovery_rule_index_integer(value: f32) -> ReactionRuleIndexInteger {
  if (
    !ss_exact_near_finite(value)
    || value < 0.0
    || value > 16777215.0
    || floor(value) != value
  ) {
    return ReactionRuleIndexInteger(0u, 0u);
  }
  return ReactionRuleIndexInteger(1u, u32(value));
}

fn reaction_discovery_rule_index_available() -> bool {
  if (
    params.reaction_rule_index_mode
      != REACTION_DISCOVERY_RULE_INDEX_MODE_MATERIAL_PAIR
    || params.reaction_rule_index_record_vec4_count
      > arrayLength(&reaction_records)
  ) {
    return false;
  }
  let reaction_prefix_vec4s =
    params.reaction_count * params.reaction_record_stride_vec4s;
  if (
    params.reaction_rule_index_pair_offset_vec4s < reaction_prefix_vec4s
    || params.reaction_rule_index_pair_offset_vec4s
      > params.reaction_rule_index_rule_offset_vec4s
    || params.reaction_rule_index_pair_count
      > params.reaction_rule_index_rule_offset_vec4s
        - params.reaction_rule_index_pair_offset_vec4s
    || params.reaction_rule_index_rule_count > 0xfffffffcu
  ) {
    return false;
  }
  let rule_vec4_count = (
    params.reaction_rule_index_rule_count
      + (REACTION_DISCOVERY_RULE_INDEX_RULES_PER_VEC4 - 1u)
  ) / REACTION_DISCOVERY_RULE_INDEX_RULES_PER_VEC4;
  return params.reaction_rule_index_rule_offset_vec4s
      <= params.reaction_rule_index_record_vec4_count
    && rule_vec4_count
      <= params.reaction_rule_index_record_vec4_count
        - params.reaction_rule_index_rule_offset_vec4s;
}

fn reaction_discovery_pair_less(
  left_lo: f32,
  left_hi: f32,
  right_lo: f32,
  right_hi: f32
) -> bool {
  return left_lo < right_lo || (left_lo == right_lo && left_hi < right_hi);
}

fn reaction_discovery_rule_index_lookup(
  self_material: f32,
  other_material: f32
) -> ReactionRuleIndexLookup {
  if (
    !reaction_discovery_rule_index_available()
    || !ss_exact_near_finite(self_material)
    || !ss_exact_near_finite(other_material)
  ) {
    return ReactionRuleIndexLookup(0u, 0u, 0u, 0u);
  }
  let material_lo = min(self_material, other_material);
  let material_hi = max(self_material, other_material);
  var lower = 0u;
  var upper = params.reaction_rule_index_pair_count;
  var iteration = 0u;
  loop {
    if (lower >= upper || iteration >= params.reaction_rule_index_pair_count) {
      break;
    }
    let middle = lower + (upper - lower) / 2u;
    let entry = reaction_records[
      params.reaction_rule_index_pair_offset_vec4s + middle
    ];
    if (
      !ss_exact_near_finite(entry.x)
      || !ss_exact_near_finite(entry.y)
      || entry.x >= entry.y
    ) {
      return ReactionRuleIndexLookup(0u, 0u, 0u, 0u);
    }
    if (reaction_discovery_pair_less(entry.x, entry.y, material_lo, material_hi)) {
      lower = middle + 1u;
    } else {
      upper = middle;
    }
    iteration = iteration + 1u;
  }
  if (lower >= params.reaction_rule_index_pair_count) {
    return ReactionRuleIndexLookup(1u, 0u, 0u, 0u);
  }
  let entry = reaction_records[
    params.reaction_rule_index_pair_offset_vec4s + lower
  ];
  if (
    !ss_exact_near_finite(entry.x)
    || !ss_exact_near_finite(entry.y)
    || entry.x >= entry.y
  ) {
    return ReactionRuleIndexLookup(0u, 0u, 0u, 0u);
  }
  if (entry.x != material_lo || entry.y != material_hi) {
    return ReactionRuleIndexLookup(1u, 0u, 0u, 0u);
  }
  let rule_begin = reaction_discovery_rule_index_integer(entry.z);
  let rule_count = reaction_discovery_rule_index_integer(entry.w);
  if (
    rule_begin.admitted == 0u
    || rule_count.admitted == 0u
    || rule_count.value == 0u
    || rule_begin.value > params.reaction_rule_index_rule_count
    || rule_count.value
      > params.reaction_rule_index_rule_count - rule_begin.value
  ) {
    return ReactionRuleIndexLookup(0u, 0u, 0u, 0u);
  }
  return ReactionRuleIndexLookup(
    1u,
    1u,
    rule_begin.value,
    rule_count.value
  );
}

fn reaction_discovery_rule_index_rule_at(
  rule_offset: u32
) -> ReactionRuleIndexInteger {
  let row = reaction_records[
    params.reaction_rule_index_rule_offset_vec4s
      + rule_offset / REACTION_DISCOVERY_RULE_INDEX_RULES_PER_VEC4
  ];
  let lane = rule_offset % REACTION_DISCOVERY_RULE_INDEX_RULES_PER_VEC4;
  var value = row.x;
  if (lane == 1u) {
    value = row.y;
  } else if (lane == 2u) {
    value = row.z;
  } else if (lane == 3u) {
    value = row.w;
  }
  return reaction_discovery_rule_index_integer(value);
}

fn reaction_discovery_consider_reaction(
  self_index: u32,
  other_index: u32,
  self_material: f32,
  other_material: f32,
  self_thermo0: vec4<f32>,
  other_thermo0: vec4<f32>,
  distance_squared: f32,
  reaction_index: u32,
  best: ptr<function, vec4<f32>>
) {
  if (reaction_index >= params.reaction_count) {
    return;
  }
  let reaction_base = reaction_index * params.reaction_record_stride_vec4s;
  let row0 = reaction_records[reaction_base];
  let row1 = reaction_records[reaction_base + 1u];
  let row2 = reaction_records[reaction_base + 2u];
  if (row2.x != 1.0 || !ss_exact_near_finite(row1.y) || row1.y <= 0.0) {
    return;
  }
  if (
    !all(vec4<bool>(
      ss_exact_near_finite(self_thermo0.x),
      ss_exact_near_finite(self_thermo0.y),
      ss_exact_near_finite(self_thermo0.z),
      ss_exact_near_finite(other_thermo0.x)
    ))
    || !ss_exact_near_finite(other_thermo0.y)
    || !ss_exact_near_finite(other_thermo0.z)
    || !ss_exact_near_finite(row0.w)
    || !ss_exact_near_finite(row1.z)
    || !ss_exact_near_finite(row1.w)
    || row0.x == row0.y
  ) {
    return;
  }
  var role = 0.0;
  var self_phase_mask = 0.0;
  var other_phase_mask = 0.0;
  if (self_material == row0.x && other_material == row0.y) {
    role = 1.0;
    self_phase_mask = row1.z;
    other_phase_mask = row1.w;
  } else if (self_material == row0.y && other_material == row0.x) {
    role = 2.0;
    self_phase_mask = row1.w;
    other_phase_mask = row1.z;
  } else {
    return;
  }
  if (
    !reaction_discovery_phase_mask_satisfied(self_phase_mask, self_thermo0.y)
    || !reaction_discovery_phase_mask_satisfied(other_phase_mask, other_thermo0.y)
    || max(self_thermo0.z, other_thermo0.z) < row0.w
  ) {
    return;
  }
  if (distance_squared > row1.y * row1.y) {
    return;
  }
  reaction_discovery_increment_counter(4u);
  let current_partner = select(0xffffffffu, u32((*best).x + 0.5), (*best).x >= 0.0);
  let current_reaction = select(0xffffffffu, u32((*best).y + 0.5), (*best).y >= 0.0);
  if (
    distance_squared < (*best).w
    || (
      distance_squared == (*best).w
      && (
        other_index < current_partner
        || (other_index == current_partner && reaction_index < current_reaction)
      )
    )
  ) {
    *best = vec4<f32>(
      f32(other_index),
      f32(reaction_index),
      role,
      distance_squared
    );
  }
}

fn reaction_discovery_consider_all_reactions(
  self_index: u32,
  other_index: u32,
  self_material: f32,
  other_material: f32,
  self_thermo0: vec4<f32>,
  other_thermo0: vec4<f32>,
  distance_squared: f32,
  best: ptr<function, vec4<f32>>
) {
  for (
    var reaction_index = 0u;
    reaction_index < params.reaction_count;
    reaction_index = reaction_index + 1u
  ) {
    reaction_discovery_increment_counter(
      REACTION_DISCOVERY_EVIDENCE_FULL_RULE_SCAN_VISITS
    );
    reaction_discovery_consider_reaction(
      self_index,
      other_index,
      self_material,
      other_material,
      self_thermo0,
      other_thermo0,
      distance_squared,
      reaction_index,
      best
    );
  }
}

fn reaction_discovery_consider_indexed_reactions(
  self_index: u32,
  other_index: u32,
  self_material: f32,
  other_material: f32,
  self_thermo0: vec4<f32>,
  other_thermo0: vec4<f32>,
  distance_squared: f32,
  lookup: ReactionRuleIndexLookup,
  best: ptr<function, vec4<f32>>
) {
  var previous_reaction_index = 0u;
  for (
    var rule_ordinal = 0u;
    rule_ordinal < lookup.rule_count;
    rule_ordinal = rule_ordinal + 1u
  ) {
    let decoded = reaction_discovery_rule_index_rule_at(
      lookup.rule_begin + rule_ordinal
    );
    if (
      decoded.admitted == 0u
      || decoded.value >= params.reaction_count
      || (rule_ordinal > 0u && decoded.value <= previous_reaction_index)
    ) {
      reaction_discovery_consider_all_reactions(
        self_index,
        other_index,
        self_material,
        other_material,
        self_thermo0,
        other_thermo0,
        distance_squared,
        best
      );
      return;
    }
    previous_reaction_index = decoded.value;
  }
  for (
    var rule_ordinal = 0u;
    rule_ordinal < lookup.rule_count;
    rule_ordinal = rule_ordinal + 1u
  ) {
    let reaction_index = reaction_discovery_rule_index_rule_at(
      lookup.rule_begin + rule_ordinal
    ).value;
    reaction_discovery_increment_counter(
      REACTION_DISCOVERY_EVIDENCE_RULE_INDEX_RULE_VISITS
    );
    reaction_discovery_consider_reaction(
      self_index,
      other_index,
      self_material,
      other_material,
      self_thermo0,
      other_thermo0,
      distance_squared,
      reaction_index,
      best
    );
  }
}

fn reaction_discovery_consider_pair(
  self_index: u32,
  other_index: u32,
  self_material: f32,
  self_position: vec3<f32>,
  best: ptr<function, vec4<f32>>
) {
  if (other_index == self_index || other_index >= params.particle_count) {
    return;
  }
  reaction_discovery_increment_counter(3u);
  if (!reaction_discovery_source_row_admitted(other_index)) {
    reaction_discovery_increment_control_counter(8u);
    return;
  }
  if (reaction_discovery_mass(other_index) <= 0.0) {
    return;
  }
  let self_thermo0 = reaction_discovery_thermo0(self_index);
  let other_thermo0 = reaction_discovery_thermo0(other_index);
  let other_material = other_thermo0.x;
  let other_position = reaction_discovery_position(other_index);
  let displacement = self_position - other_position;
  let distance_squared = dot(displacement, displacement);
  if (!ss_exact_near_finite(distance_squared)) {
    reaction_discovery_increment_control_counter(5u);
    return;
  }
  let lookup = reaction_discovery_rule_index_lookup(
    self_material,
    other_material
  );
  if (lookup.indexed != 0u) {
    reaction_discovery_increment_counter(
      REACTION_DISCOVERY_EVIDENCE_RULE_INDEX_PAIR_LOOKUPS
    );
    if (lookup.found == 0u) {
      reaction_discovery_increment_counter(
        REACTION_DISCOVERY_EVIDENCE_RULE_INDEX_PAIR_MISSES
      );
      return;
    }
    reaction_discovery_consider_indexed_reactions(
      self_index,
      other_index,
      self_material,
      other_material,
      self_thermo0,
      other_thermo0,
      distance_squared,
      lookup,
      best
    );
    return;
  }
  reaction_discovery_consider_all_reactions(
    self_index,
    other_index,
    self_material,
    other_material,
    self_thermo0,
    other_thermo0,
    distance_squared,
    best
  );
}

@compute @workgroup_size(64)
fn propose(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let particle_index = global_id.x;
  if (particle_index >= params.particle_count) {
    return;
  }
  reaction_proposals[particle_index] = reaction_discovery_invalid_proposal();
  reaction_discovery_reset_hot_counters();
  atomicAdd(&traversal_evidence[0u], 1u);
  if (
    spatial_expectation.support_profile_id != params.support_profile_id
    || !ss_exact_near_directory_admitted(spatial_expectation)
    || !ss_exact_cell_tree_admitted(spatial_expectation)
    || arrayLength(&traversal_evidence)
      < REACTION_DISCOVERY_EVIDENCE_TREE_MEMBER_VISITS + 1u
    || atomicLoad(
      &traversal_evidence[REACTION_DISCOVERY_EVIDENCE_CERTIFICATE_STATUS_BITS]
    )
      != REACTION_DISCOVERY_CERTIFICATE_READY_BITS
  ) {
    atomicAdd(&traversal_evidence[2u], 1u);
    return;
  }
  atomicAdd(&traversal_evidence[1u], 1u);
  if (
    arrayLength(&source_thermo) < params.particle_count * params.thermo_stride_vec4s
    || arrayLength(&source_state) < params.particle_count * params.state_stride_vec4s
    || arrayLength(&reaction_records)
      < params.reaction_count * params.reaction_record_stride_vec4s
    || !reaction_discovery_source_row_admitted(particle_index)
  ) {
    reaction_discovery_increment_control_counter(8u);
    return;
  }
  if (reaction_discovery_mass(particle_index) <= 0.0) {
    return;
  }
  if (
    !ss_exact_near_finite(params.maximum_contact_radius_m)
    || params.maximum_contact_radius_m < 0.0
  ) {
    reaction_discovery_increment_control_counter(5u);
    return;
  }
  if (params.maximum_contact_radius_m == 0.0) {
    return;
  }

  let self_position = reaction_discovery_position(particle_index);
  let self_material = reaction_discovery_thermo0(particle_index).x;
  let certified_search_radius_m = params.maximum_contact_radius_m
    + max(bitcast<f32>(atomicLoad(
      &traversal_evidence[REACTION_DISCOVERY_EVIDENCE_MAXIMUM_DISPLACEMENT_BITS]
    )), 0.0);
  if (!ss_exact_near_finite(certified_search_radius_m)) {
    reaction_discovery_increment_control_counter(5u);
    return;
  }
  var best = reaction_discovery_invalid_proposal();
  var malformed = false;

  let query_extent = vec3<f32>(certified_search_radius_m);
  let query_minimum = self_position - query_extent;
  let query_maximum = self_position + query_extent;
  let tree_cell_count = exact_near_cell_tree[18u];
  let tree_leaf_capacity = exact_near_cell_tree[20u];
  let tree_leaf_offset = tree_leaf_capacity - 1u;
  let tree_node_capacity = exact_near_cell_tree[21u];
  let tree_depth = exact_near_cell_tree[23u];
  // This is a complete-tree-depth proof, not a per-source candidate budget.
  // The builder rejects depths above 30, so all pending siblings fit here.
  var node_stack: array<u32, 32>;
  var stack_count = 0u;
  if (
    tree_node_capacity == 0u
    || tree_depth >= 32u
    || !ss_exact_near_finite(query_minimum.x)
    || !ss_exact_near_finite(query_minimum.y)
    || !ss_exact_near_finite(query_minimum.z)
    || !ss_exact_near_finite(query_maximum.x)
    || !ss_exact_near_finite(query_maximum.y)
    || !ss_exact_near_finite(query_maximum.z)
    || !all(query_minimum <= query_maximum)
  ) {
    malformed = true;
  } else {
    node_stack[0u] = 0u;
    stack_count = 1u;
    for (
      var node_iteration = 0u;
      node_iteration < tree_node_capacity && stack_count > 0u;
      node_iteration = node_iteration + 1u
    ) {
      stack_count = stack_count - 1u;
      let node_index = node_stack[stack_count];
      if (node_index >= tree_node_capacity) {
        malformed = true;
        break;
      }
      reaction_discovery_increment_counter(
        REACTION_DISCOVERY_EVIDENCE_TREE_NODE_VISITS
      );
      if (!ss_exact_cell_tree_node_intersects(
        node_index,
        query_minimum,
        query_maximum
      )) {
        continue;
      }
      if (ss_exact_cell_tree_node_is_leaf(node_index)) {
        reaction_discovery_increment_counter(
          REACTION_DISCOVERY_EVIDENCE_TREE_LEAF_VISITS
        );
        let cell_index = ss_exact_cell_tree_leaf_cell_index(node_index);
        if (
          node_index < tree_leaf_offset
          || cell_index >= tree_cell_count
          || cell_index >= spatial_expectation.expected_cell_capacity
        ) {
          malformed = true;
          break;
        }
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
          reaction_discovery_increment_counter(
            REACTION_DISCOVERY_EVIDENCE_TREE_MEMBER_VISITS
          );
          let lookup = ss_exact_near_source_at_member(
            spatial_expectation,
            member_offset
          );
          if (lookup.admitted == 0u) {
            malformed = true;
            break;
          }
          reaction_discovery_consider_pair(
            particle_index,
            lookup.source_index,
            self_material,
            self_position,
            &best
          );
        }
        if (malformed) {
          break;
        }
        continue;
      }
      if (
        node_index >= tree_leaf_offset
        || !ss_exact_cell_tree_node_is_internal(node_index)
      ) {
        malformed = true;
        break;
      }
      let left_child = node_index * 2u + 1u;
      let right_child = left_child + 1u;
      if (
        right_child >= tree_node_capacity
        || stack_count + 2u > 32u
      ) {
        malformed = true;
        break;
      }
      // Right then left preserves complete-tree canonical leaf order.
      node_stack[stack_count] = right_child;
      node_stack[stack_count + 1u] = left_child;
      stack_count = stack_count + 2u;
    }
    if (stack_count != 0u) {
      malformed = true;
    }
  }

  if (!reaction_discovery_flush_hot_counters()) {
    malformed = true;
  }
  if (malformed) {
    reaction_discovery_increment_control_counter(5u);
    return;
  }
  if (best.x >= 0.0 && best.y >= 0.0) {
    reaction_proposals[particle_index] = best;
    reaction_discovery_increment_counter(6u);
  }
}

// This second dispatch performs no lookup. It turns any directory, source, or
// traversal rejection into a complete invalid proposal set before a later
// chemistry kernel can observe the artifact.
@compute @workgroup_size(64)
fn seal(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let particle_index = global_id.x;
  if (particle_index >= params.particle_count) {
    return;
  }
  let fail_closed = atomicLoad(&traversal_evidence[2u]) != 0u
    || atomicLoad(&traversal_evidence[5u]) != 0u
    || atomicLoad(&traversal_evidence[8u]) != 0u
    || atomicLoad(&traversal_evidence[REACTION_DISCOVERY_EVIDENCE_OVERFLOW]) != 0u
    || atomicLoad(&traversal_evidence[0u]) != params.particle_count
    || atomicLoad(&traversal_evidence[1u]) != params.particle_count;
  if (fail_closed) {
    reaction_proposals[particle_index] = reaction_discovery_invalid_proposal();
  }
  reaction_discovery_increment_counter(7u);
}

fn reaction_activation_fail_closed() {
  atomicOr(
    &reaction_activation_observation[REACTION_ACTIVATION_FAILURE_WORD],
    0x80000000u
  );
}

fn reaction_activation_source_row_admitted(source_index: u32) -> bool {
  let state_offset = source_index * params.state_stride_vec4s;
  let thermo_offset = source_index * params.thermo_stride_vec4s;
  if (
    state_offset + 1u >= arrayLength(&source_state)
    || thermo_offset + 2u >= arrayLength(&source_thermo)
  ) {
    return false;
  }
  for (var row = 0u; row < 2u; row = row + 1u) {
    if (!reaction_motion_vec4_finite(source_state[state_offset + row])) {
      return false;
    }
  }
  for (var row = 0u; row < 3u; row = row + 1u) {
    if (!reaction_motion_vec4_finite(source_thermo[thermo_offset + row])) {
      return false;
    }
  }
  // The mutation shader's wildcard phase mask bypasses phase conversion.
  // Refuse a negative phase here so the watch cannot seal a false zero.
  return source_thermo[thermo_offset].y >= 0.0;
}

// Binding 0 is intentionally rebound to the terminal mechanics family for
// this entry point. The declaration is a raw vec4 array, so the exact same
// shader module can retain the canonical position authority for proposal
// production while the watch-only pipeline certifies row4.w rest volumes.
@compute @workgroup_size(64)
fn prepare_activation_motion_bounds(
  @builtin(global_invocation_id) global_id: vec3<u32>
) {
  let source_index = global_id.x;
  if (source_index >= params.particle_count) {
    return;
  }
  if (
    arrayLength(&reaction_activation_observation) < 4u
    || params.activation_max_future_substeps == 0u
    || !reaction_motion_finite(params.activation_cfl_factor)
    || !(params.activation_cfl_factor > 0.0)
    || !reaction_motion_finite(params.activation_grid_spacing_m)
    || !(params.activation_grid_spacing_m > 0.0)
    || params.activation_separation_enabled > 1u
    || params.activation_contact_correction_enabled > 1u
    || params.activation_thermal_phase_evolution_enabled > 1u
    || !reaction_motion_box_dims_admitted(vec3<f32>(
      params.activation_box_dim_x_m,
      params.activation_box_dim_y_m,
      params.activation_box_dim_z_m
    ))
    || arrayLength(&source_state_authority) < params.particle_count * 8u
    || !reaction_activation_source_row_admitted(source_index)
  ) {
    reaction_activation_fail_closed();
    return;
  }
  let mechanics_offset = source_index * 8u;
  for (var row = 0u; row < 8u; row = row + 1u) {
    if (!reaction_motion_vec4_finite(
      source_state_authority[mechanics_offset + row]
    )) {
      reaction_activation_fail_closed();
      return;
    }
  }
  let position_mass = source_state[
    source_index * params.state_stride_vec4s
  ];
  if (position_mass.w <= 0.0) {
    return;
  }
  if (!reaction_motion_position_inside_box(
    position_mass.xyz,
    vec3<f32>(
      params.activation_box_dim_x_m,
      params.activation_box_dim_y_m,
      params.activation_box_dim_z_m
    )
  )) {
    reaction_activation_fail_closed();
    return;
  }
  if (
    params.activation_separation_enabled == 0u
    && params.activation_contact_correction_enabled == 0u
  ) {
    return;
  }
  let rest_volume_m3 = source_state_authority[source_index * 8u + 4u].w;
  let diameter_m = reaction_motion_rest_diameter_upper(rest_volume_m3);
  if (!(diameter_m > 0.0) || !reaction_motion_finite(diameter_m)) {
    reaction_activation_fail_closed();
    return;
  }
  atomicMax(
    &reaction_activation_observation[
      REACTION_ACTIVATION_MAX_REST_DIAMETER_BITS_WORD
    ],
    bitcast<u32>(diameter_m)
  );
}

fn reaction_activation_pair_triggered(
  self_index: u32,
  other_index: u32,
  relative_reach_m: f32
) -> bool {
  if (other_index == self_index || other_index >= params.particle_count) {
    return false;
  }
  if (!reaction_activation_source_row_admitted(other_index)) {
    reaction_activation_fail_closed();
    return false;
  }
  let other_position_mass = source_state[
    other_index * params.state_stride_vec4s
  ];
  if (other_position_mass.w <= 0.0) {
    return false;
  }
  let self_position_mass = source_state[
    self_index * params.state_stride_vec4s
  ];
  let self_thermo0 = source_thermo[
    self_index * params.thermo_stride_vec4s
  ];
  let other_thermo0 = source_thermo[
    other_index * params.thermo_stride_vec4s
  ];
  let distance_m = length(self_position_mass.xyz - other_position_mass.xyz);
  if (!reaction_motion_finite(distance_m)) {
    reaction_activation_fail_closed();
    return false;
  }
  for (
    var reaction_index = 0u;
    reaction_index < params.reaction_count;
    reaction_index = reaction_index + 1u
  ) {
    let reaction_base = reaction_index
      * params.reaction_record_stride_vec4s;
    let row0 = reaction_records[reaction_base];
    let row1 = reaction_records[reaction_base + 1u];
    let row2 = reaction_records[reaction_base + 2u];
    if (row2.x != 1.0) {
      continue;
    }
    if (
      !all(vec4<bool>(
        reaction_motion_finite(row0.x),
        reaction_motion_finite(row0.y),
        reaction_motion_finite(row0.z),
        reaction_motion_finite(row0.w)
      ))
      || !all(vec4<bool>(
        reaction_motion_finite(row1.x),
        reaction_motion_finite(row1.y),
        reaction_motion_finite(row1.z),
        reaction_motion_finite(row1.w)
      ))
      || !reaction_motion_finite(row2.x)
      || row0.x == row0.y
    ) {
      reaction_activation_fail_closed();
      continue;
    }
    // A ready zero-radius rule cannot mutate. Match the dedicated watcher by
    // treating it as a deterministic non-match instead of malformed input.
    if (!(row1.y > 0.0)) {
      continue;
    }
    var self_phase_mask = 0.0;
    var other_phase_mask = 0.0;
    if (self_thermo0.x == row0.x && other_thermo0.x == row0.y) {
      self_phase_mask = row1.z;
      other_phase_mask = row1.w;
    } else if (
      self_thermo0.x == row0.y && other_thermo0.x == row0.x
    ) {
      self_phase_mask = row1.w;
      other_phase_mask = row1.z;
    } else {
      continue;
    }
    if (
      !reaction_discovery_phase_mask_satisfied(
        self_phase_mask,
        self_thermo0.y
      )
      || !reaction_discovery_phase_mask_satisfied(
        other_phase_mask,
        other_thermo0.y
      )
      || max(self_thermo0.z, other_thermo0.z) < row0.w
    ) {
      continue;
    }
    let expanded_radius_m = reaction_motion_upward(
      row1.y + relative_reach_m
    );
    if (!reaction_motion_finite(expanded_radius_m)) {
      reaction_activation_fail_closed();
      continue;
    }
    if (distance_m <= expanded_radius_m) {
      return true;
    }
  }
  return false;
}

@compute @workgroup_size(64)
fn watch_activation_motion_envelope(
  @builtin(global_invocation_id) global_id: vec3<u32>
) {
  let particle_index = global_id.x;
  if (particle_index >= params.particle_count) {
    return;
  }
  var triggered = false;
  var malformed = false;
  if (
    arrayLength(&reaction_activation_observation) < 4u
    || spatial_expectation.support_profile_id != params.support_profile_id
    || !ss_exact_near_directory_admitted(spatial_expectation)
    || !ss_exact_cell_tree_admitted(spatial_expectation)
    || arrayLength(&reaction_records)
      < params.reaction_count * params.reaction_record_stride_vec4s
    || !reaction_activation_source_row_admitted(particle_index)
  ) {
    malformed = true;
  }
  let position_mass = source_state[
    particle_index * params.state_stride_vec4s
  ];
  if (
    !malformed
    && params.activation_thermal_phase_evolution_enabled != 0u
  ) {
    // A dynamic thermal/phase/rest-volume writer can satisfy the reaction
    // predicate or enlarge/activate a carrier without terminal motion. Count
    // every fixed carrier slot positive before consulting terminal mass,
    // temperature, phase, rest diameter, or spatial reach.
    triggered = true;
  }
  if (!malformed && position_mass.w > 0.0 && !triggered) {
    let max_rest_diameter_m = bitcast<f32>(atomicLoad(
      &reaction_activation_observation[
        REACTION_ACTIVATION_MAX_REST_DIAMETER_BITS_WORD
      ]
    ));
    let max_abs_position_m = max(
      abs(position_mass.x),
      max(abs(position_mass.y), abs(position_mass.z))
    );
    let relative_reach_m = reaction_motion_relative_reach_upper(
      params.activation_max_future_substeps,
      params.activation_cfl_factor,
      params.activation_grid_spacing_m,
      max_rest_diameter_m,
      params.activation_separation_enabled != 0u,
      params.activation_contact_correction_enabled != 0u,
      vec3<f32>(
        params.activation_box_dim_x_m,
        params.activation_box_dim_y_m,
        params.activation_box_dim_z_m
      ),
      max_abs_position_m,
      params.maximum_contact_radius_m
    );
    let certified_search_radius_m = reaction_motion_upward(
      reaction_motion_upward(params.maximum_contact_radius_m)
        + reaction_motion_upward(bitcast<f32>(atomicLoad(
          &traversal_evidence[
            REACTION_DISCOVERY_EVIDENCE_MAXIMUM_DISPLACEMENT_BITS
          ]
        )))
        + relative_reach_m
    );
    if (
      !reaction_motion_finite(relative_reach_m)
      || !reaction_motion_finite(certified_search_radius_m)
      || !(certified_search_radius_m >= 0.0)
    ) {
      malformed = true;
    } else if (certified_search_radius_m > 0.0) {
      let query_extent = vec3<f32>(certified_search_radius_m);
      let query_minimum = position_mass.xyz - query_extent;
      let query_maximum = position_mass.xyz + query_extent;
      let tree_cell_count = exact_near_cell_tree[18u];
      let tree_leaf_capacity = exact_near_cell_tree[20u];
      let tree_leaf_offset = tree_leaf_capacity - 1u;
      let tree_node_capacity = exact_near_cell_tree[21u];
      let tree_depth = exact_near_cell_tree[23u];
      var node_stack: array<u32, 32>;
      var stack_count = 0u;
      if (
        tree_node_capacity == 0u
        || tree_depth >= 32u
        || !all(vec3<bool>(
          reaction_motion_finite(query_minimum.x),
          reaction_motion_finite(query_minimum.y),
          reaction_motion_finite(query_minimum.z)
        ))
        || !all(vec3<bool>(
          reaction_motion_finite(query_maximum.x),
          reaction_motion_finite(query_maximum.y),
          reaction_motion_finite(query_maximum.z)
        ))
        || !all(query_minimum <= query_maximum)
      ) {
        malformed = true;
      } else {
        node_stack[0u] = 0u;
        stack_count = 1u;
        for (
          var node_iteration = 0u;
          node_iteration < tree_node_capacity && stack_count > 0u;
          node_iteration = node_iteration + 1u
        ) {
          stack_count = stack_count - 1u;
          let node_index = node_stack[stack_count];
          if (node_index >= tree_node_capacity) {
            malformed = true;
            break;
          }
          if (!ss_exact_cell_tree_node_intersects(
            node_index,
            query_minimum,
            query_maximum
          )) {
            continue;
          }
          if (ss_exact_cell_tree_node_is_leaf(node_index)) {
            let cell_index = ss_exact_cell_tree_leaf_cell_index(node_index);
            if (
              node_index < tree_leaf_offset
              || cell_index >= tree_cell_count
              || cell_index >= spatial_expectation.expected_cell_capacity
            ) {
              malformed = true;
              break;
            }
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
              let lookup = ss_exact_near_source_at_member(
                spatial_expectation,
                member_offset
              );
              if (lookup.admitted == 0u) {
                malformed = true;
                break;
              }
              if (reaction_activation_pair_triggered(
                particle_index,
                lookup.source_index,
                relative_reach_m
              )) {
                triggered = true;
                break;
              }
            }
            if (malformed || triggered) {
              break;
            }
            continue;
          }
          if (
            node_index >= tree_leaf_offset
            || !ss_exact_cell_tree_node_is_internal(node_index)
          ) {
            malformed = true;
            break;
          }
          let left_child = node_index * 2u + 1u;
          let right_child = left_child + 1u;
          if (right_child >= tree_node_capacity || stack_count + 2u > 32u) {
            malformed = true;
            break;
          }
          node_stack[stack_count] = right_child;
          node_stack[stack_count + 1u] = left_child;
          stack_count = stack_count + 2u;
        }
        if (stack_count != 0u && !triggered) {
          malformed = true;
        }
      }
    }
  }
  if (malformed) {
    reaction_activation_fail_closed();
  }
  if (triggered) {
    atomicAdd(
      &reaction_activation_observation[
        REACTION_ACTIVATION_TRIGGERED_SOURCE_COUNT_WORD
      ],
      1u
    );
  }
  atomicAdd(
    &reaction_activation_observation[REACTION_ACTIVATION_FAILURE_WORD],
    1u
  );
}

@compute @workgroup_size(1)
fn seal_activation_motion_watch(
  @builtin(global_invocation_id) global_id: vec3<u32>
) {
  if (global_id.x != 0u || arrayLength(&reaction_activation_observation) < 4u) {
    return;
  }
  let control = atomicLoad(
    &reaction_activation_observation[REACTION_ACTIVATION_FAILURE_WORD]
  );
  let triggered_source_count = atomicLoad(
    &reaction_activation_observation[
      REACTION_ACTIVATION_TRIGGERED_SOURCE_COUNT_WORD
    ]
  );
  let admitted = (control & 0x80000000u) == 0u
    && (control & 0x7fffffffu) == params.particle_count
    && triggered_source_count <= params.particle_count
    && atomicLoad(&traversal_evidence[0u]) == params.particle_count
    && atomicLoad(&traversal_evidence[1u]) == params.particle_count
    && atomicLoad(&traversal_evidence[2u]) == 0u
    && atomicLoad(&traversal_evidence[5u]) == 0u
    && atomicLoad(&traversal_evidence[7u]) == params.particle_count
    && atomicLoad(&traversal_evidence[8u]) == 0u
    && atomicLoad(&traversal_evidence[REACTION_DISCOVERY_EVIDENCE_OVERFLOW]) == 0u
    && atomicLoad(
      &traversal_evidence[REACTION_DISCOVERY_EVIDENCE_CERTIFICATE_STATUS_BITS]
    ) == REACTION_DISCOVERY_CERTIFICATE_READY_BITS;
  atomicStore(
    &reaction_activation_observation[REACTION_ACTIVATION_RESULT_WORD],
    select(
      REACTION_ACTIVATION_OBSERVATION_ENCODED_FAILURE,
      triggered_source_count + REACTION_ACTIVATION_OBSERVATION_COUNT_BIAS,
      admitted
    )
  );
}

// The schedule boundary maps only this word. An encoded one is a trustworthy
// public zero only when
// the same GPU submission proves every completion/admission field that the
// optional 27-word diagnostic readback validates on the host. Any torn,
// rejected, or overflowing traversal remains WebGPU's zero-initialized
// fail-closed word. particle_count is capped far below u32 overflow.
@compute @workgroup_size(1)
fn reduce_activation_watch(
  @builtin(global_invocation_id) global_id: vec3<u32>
) {
  if (
    global_id.x != 0u
    || arrayLength(&traversal_evidence)
      < REACTION_DISCOVERY_EVIDENCE_TREE_MEMBER_VISITS + 1u
    || arrayLength(&reaction_activation_observation) < 1u
  ) {
    return;
  }
  let proposal_count = atomicLoad(&traversal_evidence[6u]);
  let admitted = atomicLoad(&traversal_evidence[0u]) == params.particle_count
    && atomicLoad(&traversal_evidence[1u]) == params.particle_count
    && atomicLoad(&traversal_evidence[2u]) == 0u
    && atomicLoad(&traversal_evidence[5u]) == 0u
    && proposal_count <= params.particle_count
    && atomicLoad(&traversal_evidence[7u]) == params.particle_count
    && atomicLoad(&traversal_evidence[8u]) == 0u
    && atomicLoad(&traversal_evidence[9u]) == params.support_profile_id
    && atomicLoad(&traversal_evidence[10u])
      == spatial_expectation.expected_generation_id
    && atomicLoad(&traversal_evidence[11u])
      == spatial_expectation.expected_support_epoch
    && atomicLoad(&traversal_evidence[12u]) == params.particle_count
    && atomicLoad(&traversal_evidence[13u]) == params.reaction_count
    && atomicLoad(&traversal_evidence[14u]) == 0u
    && atomicLoad(&traversal_evidence[REACTION_DISCOVERY_EVIDENCE_OVERFLOW]) == 0u
    && atomicLoad(
      &traversal_evidence[REACTION_DISCOVERY_EVIDENCE_CERTIFICATE_STATUS_BITS]
    ) == REACTION_DISCOVERY_CERTIFICATE_READY_BITS;
  atomicStore(
    &reaction_activation_observation[0u],
    select(
      REACTION_ACTIVATION_OBSERVATION_ENCODED_FAILURE,
      proposal_count + REACTION_ACTIVATION_OBSERVATION_COUNT_BIAS,
      admitted
    )
  );
}
`}p(1),p(2);var m=s({SCHROEDER_SPATIAL_REACTION_PLACEMENT_SOURCE_FAMILY_ID:()=>SCHROEDER_SPATIAL_REACTION_PLACEMENT_SOURCE_FAMILY_ID,SCHROEDER_SPATIAL_REACTION_PLACEMENT_STAGE_ID:()=>SCHROEDER_SPATIAL_REACTION_PLACEMENT_STAGE_ID,ULG_SCHROEDER_SPATIAL_REACTION_PLACEMENT_LIVENESS_SCHEMA:()=>_,ULG_SCHROEDER_SPATIAL_REACTION_PLACEMENT_POSITION_EPOCH_FLOOR_RECEIPT_SCHEMA:()=>g,ULG_SCHROEDER_SPATIAL_REACTION_PLACEMENT_SOURCE_FAMILY_SCHEMA:()=>h,ULG_SPH_REACTION_RESOLVE_POSITION_INVARIANT_CERTIFICATE_SCHEMA:()=>ULG_SPH_REACTION_RESOLVE_POSITION_INVARIANT_CERTIFICATE_SCHEMA,ULG_SPH_REACTION_WARM_ARENA_LEASE_SCHEMA:()=>ULG_SPH_REACTION_WARM_ARENA_LEASE_SCHEMA,ULG_SPH_REACTION_WARM_ARENA_SCHEMA:()=>ULG_SPH_REACTION_WARM_ARENA_SCHEMA,isSchroederSpatialReactionPlacementSourceFamily:()=>T,resolveSchroederSpatialReactionPlacementSourceFamily:()=>E,schroederSpatialReactionPlacementSourceFamilyLiveness:()=>D,validateSchroederSpatialReactionPlacementPositionEpochFloor:()=>O});const h=`peercompute.ulg.schroeder-spatial-reaction-placement-source-family.v2`;e({producerFamily:`schroeder-reaction-placement-source-family`}),e({producerFamily:`schroeder-reaction-placement-transferred-destination`});const g=`peercompute.ulg.schroeder-spatial-reaction-placement-position-epoch-floor-receipt.v1`,_=`peercompute.ulg.schroeder-spatial-reaction-placement-liveness.v1`;globalThis.GPUBufferUsage?.COPY_SRC,globalThis.GPUBufferUsage?.COPY_DST,globalThis.GPUBufferUsage?.STORAGE,globalThis.GPUBufferUsage?.UNIFORM;const v=new WeakSet,y=new WeakMap,b=new WeakSet,x=new WeakMap;function S(e,t=`CONTRACT`){let n=Error(e);return n.code=`ERR_SCHROEDER_SPATIAL_REACTION_PLACEMENT_EPOCH_${t}`,n}function C(e,t){return Number.isInteger(e)&&e>=0&&e<4294967295&&Number.isInteger(t)&&t===e+1}function w({frozenSourceStateBuffer:e,frozenSourceThermoBuffer:t,frozenSourceMechanicsBuffer:n,placedDestinationStateBuffer:r,placedDestinationThermoBuffer:i,placedDestinationMechanicsBuffer:a}){let o=[e,t,n],s=[r,i,a];if(new Set(o).size!==o.length)throw S(`frozen placement state, thermo, and mechanics sources must be distinct buffers`,`SOURCE_ALIAS`);for(let e of s)if(o.includes(e))throw S(`frozen placement sources and mutable placed destinations must never alias`,`SOURCE_DESTINATION_ALIAS`);if(new Set(s).size!==s.length)throw S(`placed state, thermo, and mechanics destinations must be distinct buffers`,`DESTINATION_ALIAS`)}function T(e){return!!(e&&v.has(e)&&e.schema===`peercompute.ulg.schroeder-spatial-reaction-placement-source-family.v2`&&e.ready===!0&&e.authenticated===!0)}function E(e,{device:t=null}={}){if(!T(e))throw S(`placement source family was not minted by the shared-directory epoch builder`,`SOURCE_FAMILY_BRAND`);let n=y.get(e);if(!n||t&&n.device!==t)throw S(`placement source family belongs to another device`,`DEVICE_MISMATCH`);if(n.deviceLost)throw S(`placement source family is quarantined after device loss: ${n.lifecycle.deviceLossReason}`,`DEVICE_LOST`);if(n.lifecycle.releaseScheduled===!0||n.lifecycle.releaseStatus===`released-after-final-consumer`)throw S(`placement source family is terminal or retiring`,`RETIRED`);if(w(e),e.generation!==n.generation||e.ancestorPublicGeneration!==n.generation||e.sharedSpatialAuthorityBorrowed!==!0||e.private!==!1||n.ownsGeneration!==!1||e.directoryBuffer!==n.generation.execution.directoryBuffer||e.directorySourceBuffer!==n.generation.source.sourceBuffer||e.directoryPositionAuthorityStateBuffer!==n.generation.source.sourceStateBuffer)throw S(`placement source family no longer identifies its exact borrowed canonical generation`,`SOURCE_FAMILY_IDENTITY`);return e}function D(e,{device:t=null}={}){if(!T(e))throw S(`placement source family was not minted by the shared-directory epoch builder`,`SOURCE_FAMILY_BRAND`);let n=y.get(e);if(!n||t&&n.device!==t)throw S(`placement source family belongs to another device`,`DEVICE_MISMATCH`);return Object.freeze({schema:_,status:n.deviceLost?`schroeder-reaction-placement-source-family-device-lost-quarantined`:n.lifecycle.releaseScheduled?`schroeder-reaction-placement-source-family-retiring`:`schroeder-reaction-placement-source-family-active`,active:!n.deviceLost&&n.lifecycle.releaseScheduled!==!0,releaseScheduled:n.lifecycle.releaseScheduled===!0,releaseStatus:n.lifecycle.releaseStatus,deviceLost:n.deviceLost===!0,deviceLossStatus:n.lifecycle.deviceLossStatus,destinationOwnershipTransferred:n.destinationOwnershipTransferred,destinationStorageGeneration:e.placedDestinationStorageGeneration,deviceId:e.deviceId,generationId:e.generationId})}function O(e,{device:t,ancestorPublicGeneration:n}={}){let r=x.get(e);return!!(r&&b.has(e)&&Object.isFrozen(e)&&e.schema===`peercompute.ulg.schroeder-spatial-reaction-placement-position-epoch-floor-receipt.v1`&&e.finalized===!0&&e.authenticated===!0&&e.positionEpochFloorAuthenticated===!0&&e.destinationSafetyAuthenticated===!0&&e.placementOutcomeAuthenticated===!1&&e.placementOutcomeObserved===!1&&e.transactionalPublicationGateEncoded===!0&&e.transactionalTerminalSealEncoded===!0&&e.transactionalFailClosedRecoveryEncoded===!0&&e.transactionalAuxiliaryMaterializationEncoded===!0&&e.destinationPublicationMode===`gpu-terminal-safe-placed-or-exact-pre-reaction-fallback`&&e.positionMutationObserved===!1&&e.positionMayHaveChanged===!0&&e.positionEpochAdvanceRequired===!0&&r.device===t&&e.deviceId===i(t)&&r.ancestorPublicGeneration===n&&r.sourceFamily.ancestorPublicGeneration===n&&r.sourcePositionEpoch===r.sourceFamily.epochIdentity.positionEpoch&&e.sourcePositionEpoch===r.sourcePositionEpoch&&e.positionEpochFloor===r.positionEpochFloor&&C(e.sourcePositionEpoch,e.positionEpochFloor)&&e.sourcePositionEpoch>=n?.execution?.positionEpoch&&e.positionEpochFloor>n?.execution?.positionEpoch)}export{s as a,c as i,m as n,D as r,E as t};