import {
  mlsMpmG2pReconstructWgsl,
  mlsMpmP2gGridProjectionWgsl,
  mlsMpmParticleSeparationApplyWgsl,
  mlsMpmParticleSeparationBinFillWgsl,
  mlsMpmParticleSeparationComputeWgsl
} from './wgsl.js';

export const SCHROEDER_MECHANICS_SPATIAL_AUTHORITY_EVIDENCE_WORDS = 16;
export const SCHROEDER_MECHANICS_SPATIAL_AUTHORITY_EVIDENCE_OFFSET_WORDS = 4;
export const SCHROEDER_MECHANICS_SPATIAL_AUTHORITY_EVIDENCE_BYTES =
  SCHROEDER_MECHANICS_SPATIAL_AUTHORITY_EVIDENCE_WORDS * Uint32Array.BYTES_PER_ELEMENT;
export const SCHROEDER_SPATIAL_EPOCH_WITH_MECHANICS_EVIDENCE_WORDS =
  SCHROEDER_MECHANICS_SPATIAL_AUTHORITY_EVIDENCE_OFFSET_WORDS
  + SCHROEDER_MECHANICS_SPATIAL_AUTHORITY_EVIDENCE_WORDS;
export const SCHROEDER_SPATIAL_EPOCH_WITH_MECHANICS_EVIDENCE_BYTES =
  SCHROEDER_SPATIAL_EPOCH_WITH_MECHANICS_EVIDENCE_WORDS * Uint32Array.BYTES_PER_ELEMENT;
export const SCHROEDER_MECHANICS_SPATIAL_AUTHORITY_EVIDENCE_MAGIC = 0x4d534131;

export const SCHROEDER_MECHANICS_SPATIAL_AUTHORITY_EVIDENCE_LAYOUT = Object.freeze({
  magic: 4,
  generationId: 5,
  p2gAttempted: 6,
  p2gDirectoryAdmitted: 7,
  p2gReverseAdmitted: 8,
  p2gSelected: 9,
  g2pAttempted: 10,
  g2pDirectoryAdmitted: 11,
  g2pReverseAdmitted: 12,
  g2pSelected: 13,
  p2gHeaderRejected: 14,
  p2gReverseRejected: 15,
  g2pHeaderRejected: 16,
  g2pReverseRejected: 17,
  p2gComplete: 18,
  g2pComplete: 19
});

function replaceRequired(source, search, replacement, label) {
  if (!source.includes(search)) {
    throw new Error(`Unable to build canonical mechanics WGSL; missing ${label}`);
  }
  return source.replace(search, replacement);
}

function replaceRequiredRange(source, start, end, replacement, label) {
  const startIndex = source.indexOf(start);
  const endIndex = source.indexOf(end, startIndex + start.length);
  if (startIndex < 0 || endIndex < 0) {
    throw new Error(`Unable to build canonical mechanics WGSL; missing ${label}`);
  }
  return `${source.slice(0, startIndex)}${replacement}${source.slice(endIndex)}`;
}

function createCanonicalP2gWgsl() {
  const withEvidenceBinding = replaceRequired(
    mlsMpmP2gGridProjectionWgsl,
    '@group(0) @binding(7) var<storage, read> schroeder_level_assignments: array<f32>;',
    '@group(0) @binding(7) var<storage, read_write> schroeder_spatial_authority_evidence: array<atomic<u32>>;',
    'P2G assignment binding'
  );
  const withCanonicalGate = replaceRequiredRange(
    withEvidenceBinding,
    '// Canonical SS mechanics admits particles through the directory reverse map.',
    '\nfn p2g_finalize_node_index',
    `// Canonical SS mechanics has one level/topology authority. Binding 7 is
// compact, opt-in evidence in this variant; no assignment row is declared.
// Invocation zero authenticates the immutable directory header/query once.
// Every particle independently bounds-checks its reverse-map and chart reads;
// the ordered grid finalizer globally zeroes all output if either check fails.
fn p2g_canonical_query_geometry_admitted() -> bool {
  let source_count = schroeder_spatial_directory[16u];
  let particle_to_cell_offset_words = schroeder_spatial_directory[32u];
  let physical_upper_bound_words = schroeder_spatial_directory[47u];
  let query_offset_words = particle_to_cell_offset_words + source_count;
  if (
    schroeder_spatial_directory[46u]
      != SCHROEDER_SPATIAL_SOURCE_ADAPTER_EXACT_NEAR_QUERY
    || !p2g_spatial_range_within(query_offset_words, 4u, physical_upper_bound_words)
  ) {
    return false;
  }
  let query_min_level = bitcast<i32>(schroeder_spatial_directory[query_offset_words + 1u]);
  let query_max_level = bitcast<i32>(schroeder_spatial_directory[query_offset_words + 2u]);
  let base_spacing_m = bitcast<f32>(schroeder_spatial_directory[query_offset_words + 3u]);
  let expected_spacing_m = base_spacing_m * exp2(f32(params.schroeder_selected_level));
  return query_min_level <= params.schroeder_selected_level
    && params.schroeder_selected_level <= query_max_level
    && base_spacing_m > 0.0
    && expected_spacing_m > 0.0
    && bitcast<u32>(expected_spacing_m) == bitcast<u32>(params.grid_spacing_m);
}

fn p2g_spatial_evidence_add(word: u32, value: u32) {
  if (
    params.schroeder_spatial_pad0 != 0u
    && word < arrayLength(&schroeder_spatial_authority_evidence)
  ) {
    atomicAdd(&schroeder_spatial_authority_evidence[word], value);
  }
}

fn p2g_spatial_reject(word: u32) {
  atomicAdd(&schroeder_spatial_authority_evidence[word], 1u);
}

fn p2g_spatial_authority_rejected() -> bool {
  return atomicLoad(&schroeder_spatial_authority_evidence[14u]) != 0u
    || atomicLoad(&schroeder_spatial_authority_evidence[15u]) != 0u;
}

fn p2g_spatial_evidence_identity(particle_index: u32) {
  if (params.schroeder_spatial_pad0 == 0u || particle_index != 0u) {
    return;
  }
  atomicStore(&schroeder_spatial_authority_evidence[4u], 0x4d534131u);
  atomicStore(
    &schroeder_spatial_authority_evidence[5u],
    params.schroeder_spatial_generation_id
  );
}

fn p2g_authenticate_spatial_header(particle_index: u32) {
  if (particle_index != 0u) {
    return;
  }
  p2g_spatial_evidence_identity(particle_index);
  p2g_spatial_evidence_add(6u, params.particle_count);
  var directory_admitted = p2g_spatial_directory_admitted();
  if (directory_admitted) {
    directory_admitted = p2g_canonical_query_geometry_admitted();
  }
  if (directory_admitted) {
    p2g_spatial_evidence_add(7u, params.particle_count);
  } else {
    p2g_spatial_reject(14u);
  }
}

fn p2g_particle_enabled(particle_index: u32) -> bool {
  p2g_authenticate_spatial_header(particle_index);
  let bound_words = arrayLength(&schroeder_spatial_directory);
  if (bound_words < SCHROEDER_SPATIAL_HEADER_WORDS) {
    p2g_spatial_reject(15u);
    return false;
  }
  let source_count = schroeder_spatial_directory[16u];
  let cell_count = schroeder_spatial_directory[18u];
  let cell_keys_offset_words = schroeder_spatial_directory[29u];
  let particle_to_cell_offset_words = schroeder_spatial_directory[32u];
  if (
    particle_index >= source_count
    || !p2g_spatial_range_within(
      particle_to_cell_offset_words,
      source_count,
      bound_words
    )
    || cell_keys_offset_words > bound_words
    || cell_count > (bound_words - cell_keys_offset_words)
      / SCHROEDER_SPATIAL_KEY_WORDS
  ) {
    p2g_spatial_reject(15u);
    return false;
  }
  let query_offset_words = particle_to_cell_offset_words + source_count;
  if (!p2g_spatial_range_within(query_offset_words, 4u, bound_words)) {
    p2g_spatial_reject(15u);
    return false;
  }
  let cell_index = schroeder_spatial_directory[
    particle_to_cell_offset_words + particle_index
  ];
  if (cell_index >= cell_count) {
    p2g_spatial_reject(15u);
    return false;
  }
  let cell_key_offset_words = cell_keys_offset_words
    + cell_index * SCHROEDER_SPATIAL_KEY_WORDS;
  if (
    schroeder_spatial_directory[cell_key_offset_words]
      != schroeder_spatial_directory[query_offset_words]
  ) {
    p2g_spatial_reject(15u);
    return false;
  }
  let spatial_level = bitcast<i32>(
    schroeder_spatial_directory[cell_key_offset_words + 1u] ^ 0x80000000u
  );
  p2g_spatial_evidence_add(8u, 1u);
  let selected = spatial_level == params.schroeder_selected_level;
  if (selected) {
    p2g_spatial_evidence_add(9u, 1u);
  }
  if (particle_index + 1u == params.particle_count) {
    p2g_spatial_evidence_add(18u, 1u);
  }
  return selected;
}
`,
    'P2G authority gate'
  );
  return replaceRequired(
    withCanonicalGate,
    `  let accumulator_base = node_index * 4u;
  let mass = f32(atomicLoad(&grid_accumulators[accumulator_base])) * P2G_ATOMIC_INV_SCALE;`,
    `  let accumulator_base = node_index * 4u;
  if (p2g_spatial_authority_rejected()) {
    grid_nodes[node_index * 2u] = vec4<f32>(0.0);
    grid_nodes[node_index * 2u + 1u] = vec4<f32>(0.0);
    return;
  }
  let mass = f32(atomicLoad(&grid_accumulators[accumulator_base])) * P2G_ATOMIC_INV_SCALE;`,
    'P2G fail-closed finalize gate'
  );
}

const G2P_SPATIAL_VALIDATION_WGSL = `
const G2P_SCHROEDER_SPATIAL_MAGIC: u32 = 0x53534531u;
const G2P_SCHROEDER_SPATIAL_VERSION: u32 = 1u;
const G2P_SCHROEDER_SPATIAL_STATUS_READY: u32 = 1u;
const G2P_SCHROEDER_SPATIAL_STATUS_ADMITTED: u32 = 2u;
const G2P_SCHROEDER_SPATIAL_STATUS_FAIL_CLOSED: u32 = 4u;
const G2P_SCHROEDER_SPATIAL_STATUS_INVALID_SOURCE: u32 = 8u;
const G2P_SCHROEDER_SPATIAL_STATUS_CAPACITY_OVERFLOW: u32 = 16u;
const G2P_SCHROEDER_SPATIAL_PRIMITIVE_STATUS_READY: u32 = 1u;
const G2P_SCHROEDER_SPATIAL_PRIMITIVE_STATUS_FAIL_CLOSED: u32 = 4u;
const G2P_SCHROEDER_SPATIAL_HEADER_WORDS: u32 = 48u;
const G2P_SCHROEDER_SPATIAL_KEY_WORDS: u32 = 5u;
const G2P_SCHROEDER_SPATIAL_SORT_BOUNDED_ATLAS_U32: u32 = 1u;
const G2P_SCHROEDER_SPATIAL_SORT_LEXICOGRAPHIC_U32X5: u32 = 2u;
const G2P_SCHROEDER_SPATIAL_SOURCE_ADAPTER_ACTIVE_NODE_ROWS: u32 = 1u;
const G2P_SCHROEDER_SPATIAL_SOURCE_ADAPTER_EXACT_NEAR_QUERY: u32 = 2u;

fn g2p_spatial_range_within(start: u32, count: u32, limit: u32) -> bool {
  return start <= limit && count <= limit - start;
}

fn g2p_spatial_directory_admitted() -> bool {
  if (params.schroeder_spatial_directory_enabled == 0u) {
    return false;
  }
  let bound_words = arrayLength(&schroeder_spatial_directory);
  if (bound_words < G2P_SCHROEDER_SPATIAL_HEADER_WORDS) {
    return false;
  }
  let flags = schroeder_spatial_directory[2u];
  let source_count = schroeder_spatial_directory[16u];
  let source_capacity = schroeder_spatial_directory[17u];
  let cell_count = schroeder_spatial_directory[18u];
  let cell_capacity = schroeder_spatial_directory[19u];
  let logical_required_words = schroeder_spatial_directory[20u];
  let logical_admitted_words = schroeder_spatial_directory[21u];
  let directory_capacity_words = schroeder_spatial_directory[22u];
  let cell_keys_offset_words = schroeder_spatial_directory[29u];
  let cell_offsets_offset_words = schroeder_spatial_directory[30u];
  let cell_members_offset_words = schroeder_spatial_directory[31u];
  let particle_to_cell_offset_words = schroeder_spatial_directory[32u];
  let physical_upper_bound_words = schroeder_spatial_directory[47u];
  let rejected_flags = G2P_SCHROEDER_SPATIAL_STATUS_FAIL_CLOSED
    | G2P_SCHROEDER_SPATIAL_STATUS_INVALID_SOURCE
    | G2P_SCHROEDER_SPATIAL_STATUS_CAPACITY_OVERFLOW;
  let sort_key_words = schroeder_spatial_directory[26u];
  let sort_mode = schroeder_spatial_directory[27u];
  let sort_mode_admitted = (
    sort_mode == G2P_SCHROEDER_SPATIAL_SORT_BOUNDED_ATLAS_U32
      && sort_key_words == 1u
  ) || (
    sort_mode == G2P_SCHROEDER_SPATIAL_SORT_LEXICOGRAPHIC_U32X5
      && sort_key_words == G2P_SCHROEDER_SPATIAL_KEY_WORDS
  );
  let build_ordinal = schroeder_spatial_directory[33u];
  let primitive_status = schroeder_spatial_directory[41u];
  if (
    directory_capacity_words > bound_words
    || directory_capacity_words < G2P_SCHROEDER_SPATIAL_HEADER_WORDS
    || cell_keys_offset_words > directory_capacity_words
    || cell_offsets_offset_words > directory_capacity_words
    || cell_members_offset_words > directory_capacity_words
    || particle_to_cell_offset_words > directory_capacity_words
    || cell_capacity > (directory_capacity_words - cell_keys_offset_words)
      / G2P_SCHROEDER_SPATIAL_KEY_WORDS
    || cell_offsets_offset_words < cell_keys_offset_words
      + cell_capacity * G2P_SCHROEDER_SPATIAL_KEY_WORDS
    || cell_capacity + 1u > directory_capacity_words - cell_offsets_offset_words
    || cell_members_offset_words < cell_offsets_offset_words + cell_capacity + 1u
    || source_capacity > directory_capacity_words - cell_members_offset_words
    || particle_to_cell_offset_words < cell_members_offset_words + source_capacity
    || source_capacity > directory_capacity_words - particle_to_cell_offset_words
  ) {
    return false;
  }
  return schroeder_spatial_directory[0u] == G2P_SCHROEDER_SPATIAL_MAGIC
    && schroeder_spatial_directory[1u] == G2P_SCHROEDER_SPATIAL_VERSION
    && (flags & (
      G2P_SCHROEDER_SPATIAL_STATUS_READY | G2P_SCHROEDER_SPATIAL_STATUS_ADMITTED
    )) == (
      G2P_SCHROEDER_SPATIAL_STATUS_READY | G2P_SCHROEDER_SPATIAL_STATUS_ADMITTED
    )
    && (flags & rejected_flags) == 0u
    && schroeder_spatial_directory[3u] == params.schroeder_spatial_generation_id
    && params.schroeder_spatial_generation_id > 0u
    && schroeder_spatial_directory[4u] == params.schroeder_spatial_device_ordinal
    && schroeder_spatial_directory[5u] == params.schroeder_spatial_lane_ordinal
    && schroeder_spatial_directory[6u] == params.schroeder_spatial_lease_token
    && schroeder_spatial_directory[7u] == params.schroeder_spatial_source_family_id
    && schroeder_spatial_directory[8u] == params.schroeder_spatial_storage_generation
    && schroeder_spatial_directory[9u] == params.schroeder_spatial_physics_tick
    && schroeder_spatial_directory[10u] == params.schroeder_spatial_physics_substep
    && schroeder_spatial_directory[11u] == params.schroeder_spatial_position_epoch
    && schroeder_spatial_directory[12u] == params.schroeder_spatial_topology_epoch
    && schroeder_spatial_directory[13u] == params.schroeder_spatial_chart_epoch
    && schroeder_spatial_directory[14u] == params.schroeder_spatial_level_epoch
    && schroeder_spatial_directory[15u] == params.schroeder_spatial_support_epoch
    && source_count == params.particle_count
    && source_count > 0u
    && source_count <= source_capacity
    && cell_count > 0u
    && cell_count <= source_count
    && cell_count <= cell_capacity
    && logical_required_words == logical_admitted_words
    && logical_admitted_words >= G2P_SCHROEDER_SPATIAL_HEADER_WORDS
    && logical_admitted_words <= physical_upper_bound_words
    && schroeder_spatial_directory[23u] == 0u
    && schroeder_spatial_directory[24u] == 0u
    && schroeder_spatial_directory[25u] == G2P_SCHROEDER_SPATIAL_KEY_WORDS
    && sort_mode_admitted
    && schroeder_spatial_directory[28u] == G2P_SCHROEDER_SPATIAL_HEADER_WORDS
    && cell_keys_offset_words == G2P_SCHROEDER_SPATIAL_HEADER_WORDS
    && build_ordinal != 0u
    && schroeder_spatial_directory[34u] == build_ordinal
    && schroeder_spatial_directory[35u] == build_ordinal
    && schroeder_spatial_directory[36u] == params.schroeder_spatial_generation_id
    && schroeder_spatial_directory[37u] == source_count
    && schroeder_spatial_directory[38u] == cell_count
    && schroeder_spatial_directory[39u] != 0u
    && schroeder_spatial_directory[40u] == 0u
    && (primitive_status & G2P_SCHROEDER_SPATIAL_PRIMITIVE_STATUS_READY) != 0u
    && (primitive_status & G2P_SCHROEDER_SPATIAL_PRIMITIVE_STATUS_FAIL_CLOSED) == 0u
    && schroeder_spatial_directory[45u] >= G2P_SCHROEDER_SPATIAL_HEADER_WORDS
    && (
      schroeder_spatial_directory[46u]
        == G2P_SCHROEDER_SPATIAL_SOURCE_ADAPTER_ACTIVE_NODE_ROWS
      || schroeder_spatial_directory[46u]
        == G2P_SCHROEDER_SPATIAL_SOURCE_ADAPTER_EXACT_NEAR_QUERY
    )
    && physical_upper_bound_words <= directory_capacity_words
    && g2p_spatial_range_within(
      cell_keys_offset_words,
      cell_count * G2P_SCHROEDER_SPATIAL_KEY_WORDS,
      physical_upper_bound_words
    )
    && g2p_spatial_range_within(
      cell_offsets_offset_words,
      cell_count + 1u,
      physical_upper_bound_words
    )
    && g2p_spatial_range_within(
      cell_members_offset_words,
      source_count,
      physical_upper_bound_words
    )
    && g2p_spatial_range_within(
      particle_to_cell_offset_words,
      source_count,
      physical_upper_bound_words
    );
}

fn g2p_spatial_particle_level(particle_index: u32) -> i32 {
  let cell_count = schroeder_spatial_directory[18u];
  let cell_keys_offset_words = schroeder_spatial_directory[29u];
  let particle_to_cell_offset_words = schroeder_spatial_directory[32u];
  let cell_index = schroeder_spatial_directory[particle_to_cell_offset_words + particle_index];
  if (cell_index >= cell_count) {
    return bitcast<i32>(0x80000000u);
  }
  let level_order_key = schroeder_spatial_directory[
    cell_keys_offset_words + cell_index * G2P_SCHROEDER_SPATIAL_KEY_WORDS + 1u
  ];
  return bitcast<i32>(level_order_key ^ 0x80000000u);
}

fn g2p_spatial_evidence_add(word: u32, value: u32) {
  if (
    params.schroeder_spatial_evidence_enabled != 0u
    && word < arrayLength(&schroeder_spatial_authority_evidence)
  ) {
    atomicAdd(&schroeder_spatial_authority_evidence[word], value);
  }
}

fn g2p_canonical_query_geometry_admitted() -> bool {
  let source_count = schroeder_spatial_directory[16u];
  let particle_to_cell_offset_words = schroeder_spatial_directory[32u];
  let physical_upper_bound_words = schroeder_spatial_directory[47u];
  let query_offset_words = particle_to_cell_offset_words + source_count;
  if (
    schroeder_spatial_directory[46u]
      != G2P_SCHROEDER_SPATIAL_SOURCE_ADAPTER_EXACT_NEAR_QUERY
    || !g2p_spatial_range_within(query_offset_words, 4u, physical_upper_bound_words)
  ) {
    return false;
  }
  let query_min_level = bitcast<i32>(schroeder_spatial_directory[query_offset_words + 1u]);
  let query_max_level = bitcast<i32>(schroeder_spatial_directory[query_offset_words + 2u]);
  let base_spacing_m = bitcast<f32>(schroeder_spatial_directory[query_offset_words + 3u]);
  let expected_spacing_m = base_spacing_m * exp2(f32(params.schroeder_selected_level));
  return query_min_level <= params.schroeder_selected_level
    && params.schroeder_selected_level <= query_max_level
    && base_spacing_m > 0.0
    && expected_spacing_m > 0.0
    && bitcast<u32>(expected_spacing_m) == bitcast<u32>(params.grid_spacing_m);
}

fn g2p_spatial_reject(word: u32) {
  atomicAdd(&schroeder_spatial_authority_evidence[word], 1u);
}

fn g2p_p2g_authority_rejected() -> bool {
  return atomicLoad(&schroeder_spatial_authority_evidence[14u]) != 0u
    || atomicLoad(&schroeder_spatial_authority_evidence[15u]) != 0u;
}

fn g2p_spatial_authority_rejected() -> bool {
  return atomicLoad(&schroeder_spatial_authority_evidence[16u]) != 0u
    || atomicLoad(&schroeder_spatial_authority_evidence[17u]) != 0u;
}

fn g2p_spatial_evidence_identity(particle_index: u32) {
  if (params.schroeder_spatial_evidence_enabled == 0u || particle_index != 0u) {
    return;
  }
  atomicStore(&schroeder_spatial_authority_evidence[4u], 0x4d534131u);
  atomicStore(
    &schroeder_spatial_authority_evidence[5u],
    params.schroeder_spatial_generation_id
  );
}

fn g2p_authenticate_spatial_header(particle_index: u32) {
  if (particle_index != 0u) {
    return;
  }
  g2p_spatial_evidence_identity(particle_index);
  g2p_spatial_evidence_add(10u, params.particle_count);
  if (g2p_p2g_authority_rejected()) {
    return;
  }
  var directory_admitted = g2p_spatial_directory_admitted();
  if (directory_admitted) {
    directory_admitted = g2p_canonical_query_geometry_admitted();
  }
  if (directory_admitted) {
    g2p_spatial_evidence_add(11u, params.particle_count);
  } else {
    g2p_spatial_reject(16u);
  }
}
`;

function createCanonicalG2pWgsl() {
  const withParams = replaceRequired(
    mlsMpmG2pReconstructWgsl,
    `  schroeder_level_filter_enabled: u32,
};`,
    `  schroeder_level_filter_enabled: u32,
  schroeder_spatial_directory_enabled: u32,
  schroeder_spatial_storage_generation: u32,
  schroeder_spatial_position_epoch: u32,
  schroeder_spatial_topology_epoch: u32,
  schroeder_spatial_required: u32,
  schroeder_spatial_generation_id: u32,
  schroeder_spatial_device_ordinal: u32,
  schroeder_spatial_lane_ordinal: u32,
  schroeder_spatial_lease_token: u32,
  schroeder_spatial_source_family_id: u32,
  schroeder_spatial_physics_tick: u32,
  schroeder_spatial_physics_substep: u32,
  schroeder_spatial_chart_epoch: u32,
  schroeder_spatial_level_epoch: u32,
  schroeder_spatial_support_epoch: u32,
  schroeder_spatial_evidence_enabled: u32,
  schroeder_spatial_pad0: u32,
};`,
    'G2P canonical parameter fields'
  );
  const withBindings = replaceRequired(
    withParams,
    '@group(0) @binding(7) var<storage, read> schroeder_level_assignments: array<f32>;',
    `@group(0) @binding(7) var<storage, read_write> schroeder_spatial_authority_evidence: array<atomic<u32>>;
@group(0) @binding(8) var<storage, read> schroeder_spatial_directory: array<u32>;`,
    'G2P assignment binding'
  );
  const withValidation = replaceRequired(
    withBindings,
    '// Level-filtered G2P with copy-through:',
    `${G2P_SPATIAL_VALIDATION_WGSL}
// Canonical level-filtered G2P with copy-through:`,
    'G2P authority insertion point'
  );
  const withCanonicalGate = replaceRequiredRange(
    withValidation,
    '// Canonical level-filtered G2P with copy-through:',
    '\nfn g2p_copy_input_particle',
    `// Canonical level-filtered G2P with copy-through. Binding 7 is compact
// evidence in this variant; no particle-parallel assignment row is declared.
fn g2p_particle_enabled(particle_index: u32) -> bool {
  g2p_authenticate_spatial_header(particle_index);
  let bound_words = arrayLength(&schroeder_spatial_directory);
  if (bound_words < G2P_SCHROEDER_SPATIAL_HEADER_WORDS) {
    g2p_spatial_reject(17u);
    return false;
  }
  let source_count = schroeder_spatial_directory[16u];
  let cell_count = schroeder_spatial_directory[18u];
  let cell_keys_offset_words = schroeder_spatial_directory[29u];
  let particle_to_cell_offset_words = schroeder_spatial_directory[32u];
  if (
    particle_index >= source_count
    || !g2p_spatial_range_within(
      particle_to_cell_offset_words,
      source_count,
      bound_words
    )
    || cell_keys_offset_words > bound_words
    || cell_count > (bound_words - cell_keys_offset_words)
      / G2P_SCHROEDER_SPATIAL_KEY_WORDS
  ) {
    g2p_spatial_reject(17u);
    return false;
  }
  let query_offset_words = particle_to_cell_offset_words + source_count;
  if (!g2p_spatial_range_within(query_offset_words, 4u, bound_words)) {
    g2p_spatial_reject(17u);
    return false;
  }
  let cell_index = schroeder_spatial_directory[
    particle_to_cell_offset_words + particle_index
  ];
  if (cell_index >= cell_count) {
    g2p_spatial_reject(17u);
    return false;
  }
  let cell_key_offset_words = cell_keys_offset_words
    + cell_index * G2P_SCHROEDER_SPATIAL_KEY_WORDS;
  if (
    schroeder_spatial_directory[cell_key_offset_words]
      != schroeder_spatial_directory[query_offset_words]
  ) {
    g2p_spatial_reject(17u);
    return false;
  }
  let spatial_level = bitcast<i32>(
    schroeder_spatial_directory[cell_key_offset_words + 1u] ^ 0x80000000u
  );
  g2p_spatial_evidence_add(12u, 1u);
  let selected = spatial_level == params.schroeder_selected_level;
  if (selected) {
    g2p_spatial_evidence_add(13u, 1u);
  }
  if (particle_index + 1u == params.particle_count) {
    g2p_spatial_evidence_add(19u, 1u);
  }
  return selected;
}
`,
    'G2P authority gate'
  );
  return `${withCanonicalGate}

// G2P writes particle-parallel output before every reverse-map invocation can
// know whether a sibling rejected the shared directory. A second ordered
// dispatch restores the immutable input family for every particle whenever
// any invocation rejected. Separation runs only after this global gate.
@compute @workgroup_size(64)
fn finalize_canonical_spatial_authority(
  @builtin(global_invocation_id) global_id: vec3<u32>
) {
  let particle_index = global_id.x;
  if (particle_index >= params.particle_count) {
    return;
  }
  if (
    g2p_p2g_authority_rejected()
    || g2p_spatial_authority_rejected()
  ) {
    g2p_copy_input_particle(particle_index * 2u, particle_index * 8u);
  }
}
`;
}

export const mlsMpmP2gGridProjectionCanonicalSpatialWgsl = createCanonicalP2gWgsl();
export const mlsMpmG2pReconstructCanonicalSpatialWgsl = createCanonicalG2pWgsl();

function createUnobservedCanonicalMechanicsWgsl(source, prefix, nextFunction) {
  const withoutSuccessEvidence = replaceRequiredRange(
    source,
    `fn ${prefix}_spatial_evidence_add(word: u32, value: u32) {`,
    `\nfn ${nextFunction}`,
    `fn ${prefix}_spatial_evidence_add(word: u32, value: u32) {\n}`,
    `${prefix.toUpperCase()} optional evidence helper`
  );
  if (prefix === 'p2g') {
    const withRejectSummary = replaceRequired(
      withoutSuccessEvidence,
      `fn p2g_spatial_reject(word: u32) {
  atomicAdd(&schroeder_spatial_authority_evidence[word], 1u);
}`,
      `fn p2g_spatial_reject(word: u32) {
  atomicStore(&schroeder_spatial_authority_evidence[14u], 1u);
}`,
      'P2G unobserved rejection summary'
    );
    return replaceRequired(
      withRejectSummary,
      `fn p2g_spatial_authority_rejected() -> bool {
  return atomicLoad(&schroeder_spatial_authority_evidence[14u]) != 0u
    || atomicLoad(&schroeder_spatial_authority_evidence[15u]) != 0u;
}`,
      `fn p2g_spatial_authority_rejected() -> bool {
  return atomicLoad(&schroeder_spatial_authority_evidence[14u]) != 0u;
}`,
      'P2G unobserved rejection summary read'
    );
  }
  const withRejectSummary = replaceRequired(
    withoutSuccessEvidence,
    `fn g2p_spatial_reject(word: u32) {
  atomicAdd(&schroeder_spatial_authority_evidence[word], 1u);
}`,
    `fn g2p_spatial_reject(word: u32) {
  atomicStore(&schroeder_spatial_authority_evidence[14u], 1u);
}`,
    'G2P unobserved rejection summary'
  );
  const withUpstreamNormalization = replaceRequired(
    withRejectSummary,
    `  if (g2p_p2g_authority_rejected()) {
    return;
  }`,
    `  if (g2p_p2g_authority_rejected()) {
    atomicStore(&schroeder_spatial_authority_evidence[14u], 1u);
    return;
  }`,
    'G2P unobserved upstream rejection normalization'
  );
  return replaceRequired(
    withUpstreamNormalization,
    `fn g2p_spatial_authority_rejected() -> bool {
  return atomicLoad(&schroeder_spatial_authority_evidence[16u]) != 0u
    || atomicLoad(&schroeder_spatial_authority_evidence[17u]) != 0u;
}`,
    `fn g2p_spatial_authority_rejected() -> bool {
  return atomicLoad(&schroeder_spatial_authority_evidence[14u]) != 0u;
}`,
    'G2P unobserved rejection summary read'
  );
}

// Production keeps rejection atomics live for fail-close while compiling the
// opt-in success counters out of the hot particle path. Diagnostic callers
// select the observed variants above and retain exact per-particle evidence.
export const mlsMpmP2gGridProjectionCanonicalSpatialUnobservedWgsl =
  createUnobservedCanonicalMechanicsWgsl(
    mlsMpmP2gGridProjectionCanonicalSpatialWgsl,
    'p2g',
    'p2g_spatial_reject'
  );
export const mlsMpmG2pReconstructCanonicalSpatialUnobservedWgsl =
  createUnobservedCanonicalMechanicsWgsl(
    mlsMpmG2pReconstructCanonicalSpatialWgsl,
    'g2p',
    'g2p_canonical_query_geometry_admitted'
  );

function createCanonicalSeparationWgsl(source, {
  binding,
  insertion,
  gateInsertion,
  rejectionBody = '    return;'
}) {
  const withBinding = replaceRequired(
    source,
    insertion,
    `${insertion}
@group(0) @binding(${binding}) var<storage, read> mechanics_spatial_authority_evidence: array<u32>;

fn separation_mechanics_spatial_authority_rejected() -> bool {
  return mechanics_spatial_authority_evidence[14u] != 0u
    || mechanics_spatial_authority_evidence[15u] != 0u
    || mechanics_spatial_authority_evidence[16u] != 0u
    || mechanics_spatial_authority_evidence[17u] != 0u;
}`,
    `separation binding ${binding}`
  );
  return replaceRequired(
    withBinding,
    gateInsertion,
    `${gateInsertion}
  if (separation_mechanics_spatial_authority_rejected()) {
${rejectionBody}
  }`,
    'separation canonical fail-closed gate'
  );
}

function createUnobservedCanonicalSeparationWgsl(source) {
  return replaceRequired(
    source,
    `fn separation_mechanics_spatial_authority_rejected() -> bool {
  return mechanics_spatial_authority_evidence[14u] != 0u
    || mechanics_spatial_authority_evidence[15u] != 0u
    || mechanics_spatial_authority_evidence[16u] != 0u
    || mechanics_spatial_authority_evidence[17u] != 0u;
}`,
    `fn separation_mechanics_spatial_authority_rejected() -> bool {
  return mechanics_spatial_authority_evidence[14u] != 0u;
}`,
    'unobserved separation rejection summary'
  );
}

const mlsMpmParticleSeparationBinFillAuthorityRestoreWgsl = replaceRequired(
  replaceRequired(
    replaceRequired(
      mlsMpmParticleSeparationBinFillWgsl,
      '@group(0) @binding(0) var<storage, read> in_state: array<vec4<f32>>;',
      '@group(0) @binding(0) var<storage, read_write> in_state: array<vec4<f32>>;',
      'separation bin-fill writable state binding'
    ),
    '@group(0) @binding(1) var<storage, read> in_mechanics: array<vec4<f32>>;',
    '@group(0) @binding(1) var<storage, read_write> in_mechanics: array<vec4<f32>>;',
    'separation bin-fill writable mechanics binding'
  ),
  '@group(0) @binding(3) var<uniform> params: SeparationParams;',
  `@group(0) @binding(3) var<uniform> params: SeparationParams;
@group(0) @binding(5) var<storage, read> authority_restore_state: array<vec4<f32>>;
@group(0) @binding(6) var<storage, read> authority_restore_mechanics: array<vec4<f32>>;`,
  'separation bin-fill immutable authority restore bindings'
);

export const mlsMpmParticleSeparationBinFillCanonicalSpatialWgsl =
  createCanonicalSeparationWgsl(mlsMpmParticleSeparationBinFillAuthorityRestoreWgsl, {
    binding: 4,
    insertion: '@group(0) @binding(3) var<uniform> params: SeparationParams;',
    gateInsertion: `  if (particle_index >= params.particle_count) {
    return;
  }`,
    rejectionBody: `    let state_base = particle_index * 2u;
    let mechanics_base = particle_index * 8u;
    in_state[state_base] = authority_restore_state[state_base];
    in_state[state_base + 1u] = authority_restore_state[state_base + 1u];
    for (var row = 0u; row < 8u; row = row + 1u) {
      in_mechanics[mechanics_base + row] = authority_restore_mechanics[mechanics_base + row];
    }
    return;`
  });

export const mlsMpmParticleSeparationComputeCanonicalSpatialWgsl =
  createCanonicalSeparationWgsl(mlsMpmParticleSeparationComputeWgsl, {
    binding: 5,
    insertion: '@group(0) @binding(4) var<storage, read> bins: array<u32>;',
    gateInsertion: `  corrections[particle_index * 2u] = vec4<f32>(0.0, 0.0, 0.0, 0.0);
  corrections[particle_index * 2u + 1u] = vec4<f32>(0.0, 0.0, 0.0, 0.0);`
  });

export const mlsMpmParticleSeparationApplyCanonicalSpatialWgsl =
  createCanonicalSeparationWgsl(mlsMpmParticleSeparationApplyWgsl, {
    binding: 4,
    insertion: '@group(0) @binding(3) var<uniform> params: SeparationParams;',
    gateInsertion: `  if (particle_index >= params.particle_count) {
    return;
  }`
  });

export const mlsMpmParticleSeparationBinFillCanonicalSpatialUnobservedWgsl =
  createUnobservedCanonicalSeparationWgsl(
    mlsMpmParticleSeparationBinFillCanonicalSpatialWgsl
  );
export const mlsMpmParticleSeparationComputeCanonicalSpatialUnobservedWgsl =
  createUnobservedCanonicalSeparationWgsl(
    mlsMpmParticleSeparationComputeCanonicalSpatialWgsl
  );
export const mlsMpmParticleSeparationApplyCanonicalSpatialUnobservedWgsl =
  createUnobservedCanonicalSeparationWgsl(
    mlsMpmParticleSeparationApplyCanonicalSpatialWgsl
  );
